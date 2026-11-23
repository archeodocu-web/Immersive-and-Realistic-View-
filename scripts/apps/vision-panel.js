const MODULE_ID = "immersive-and-realistic-views";
const FLAG_KEY = "visionProfile";
const TEMPLATE = `modules/${MODULE_ID}/templates/vision-panel.hbs`;

const DEFAULT_PROFILE = Object.freeze({
  realisticEnabled: false,
  realisticStartPercent: 60,
  realisticTransitionPercent: 65,
  minPixelSize: 2,
  maxPixelSize: 12,
  immersiveEnabled: false,
  immersiveStartPercent: 70,
  immersiveStrength: 55,
  useVisionRange: true,
  fallbackDistance: 12,
  darknessEnabled: false,
  darknessStartPercent: 88,
  darknessStrength: 95,
  transitionEnabled: true,
  transitionWidthPercent: 12,
  transitionOpacity: 100,
  echoEnabled: false,
  echoStrength: 65
});

export function getDefaultProfile() {
  const read = (key, fallback) => {
    try { return game.settings.get(MODULE_ID, key) ?? fallback; }
    catch (_error) { return fallback; }
  };
  return {
    ...DEFAULT_PROFILE,
    realisticEnabled: Boolean(read("enabled", DEFAULT_PROFILE.realisticEnabled)),
    immersiveEnabled: Boolean(read("immersiveEnabled", DEFAULT_PROFILE.immersiveEnabled)),
    useVisionRange: Boolean(read("useTokenVisionRange", DEFAULT_PROFILE.useVisionRange)),
    fallbackDistance: Number(read("fallbackDistance", DEFAULT_PROFILE.fallbackDistance)),
    maxPixelSize: Number(read("maxPixelSize", DEFAULT_PROFILE.maxPixelSize)),
    immersiveStartPercent: Number(read("immersiveStartPercent", DEFAULT_PROFILE.immersiveStartPercent)),
    immersiveStrength: Number(read("immersiveStrength", DEFAULT_PROFILE.immersiveStrength))
  };
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const HandlebarsApplication = HandlebarsApplicationMixin(ApplicationV2);

function sourceDetectionModes(token) {
  const raw = token?.document?.toObject?.()?.detectionModes ?? {};
  if (Array.isArray(raw)) return Object.fromEntries(raw.filter(m => m?.id).map(m => [m.id, m]));
  return raw && typeof raw === "object" ? raw : {};
}

function getVisionModes(selectedMode) {
  const registry = CONFIG.Canvas?.visionModes ?? {};
  const modes = Object.entries(registry).map(([id, definition]) => ({
    id,
    label: game.i18n.localize(definition?.label ?? id),
    selected: id === selectedMode
  }));
  if (!modes.some(mode => mode.id === selectedMode)) {
    modes.unshift({ id: selectedMode || "basic", label: selectedMode || "Basic Vision", selected: true });
  }
  return modes;
}

function getDetectionModes(token, visionRange) {
  const registry = CONFIG.Canvas?.detectionModes ?? {};
  const source = sourceDetectionModes(token);
  return Object.entries(registry)
    .filter(([id]) => id !== "basicSight")
    .map(([id, definition]) => {
      const value = source[id] ?? {};
      return {
        id,
        label: game.i18n.localize(definition?.label ?? id),
        enabled: Boolean(value.enabled),
        range: Number.isFinite(Number(value.range)) ? Number(value.range) : visionRange
      };
    });
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
}

export class VisionPanel extends HandlebarsApplication {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-vision-panel`,
    classes: ["irv-vision-panel"],
    window: {
      title: "IRV.Panel.Title",
      icon: "fa-solid fa-eye",
      resizable: true
    },
    position: { width: 490, height: 820 }
  };

  static PARTS = { main: { template: TEMPLATE } };

  async _prepareContext(_options) {
    const controlled = [...(canvas.tokens?.controlled ?? [])];
    const token = controlled[0] ?? null;
    const canEdit = controlled.length > 0 && controlled.every(t => game.user.isGM || t.isOwner);
    const defaults = getDefaultProfile();
    const profile = token
      ? { ...defaults, ...(token.document.getFlag(MODULE_ID, FLAG_KEY) ?? {}) }
      : { ...defaults };
    profile.minPixelSize = clampNumber(profile.minPixelSize, 2, 2, 16);
    profile.maxPixelSize = clampNumber(profile.maxPixelSize, 12, profile.minPixelSize, 24);

    const selectedMode = token?.document?.sight?.visionMode ?? "basic";
    const range = Number(token?.document?.sight?.range);
    const visionRange = Number.isFinite(range) && range > 0 ? range : 30;
    const hasTremorsense = String(selectedMode).toLowerCase().includes("tremor");
    const detectionModes = getDetectionModes(token, visionRange);
    const selectedNames = controlled.map(t => t.name ?? t.document?.name ?? "Unbenannter Token");
    let selectionMessage = game.i18n.localize("IRV.Panel.SelectOneToken");
    if (controlled.length > 1) selectionMessage = game.i18n.localize("IRV.Panel.MultiTokenHint");
    else if (controlled.length === 1 && !canEdit) selectionMessage = game.i18n.localize("IRV.Panel.NoPermission");

    return {
      hasToken: Boolean(token),
      canEdit,
      tokenName: token?.name ?? "",
      selectedNames,
      selectedCount: controlled.length,
      selectionMessage,
      profile,
      visionModes: getVisionModes(selectedMode),
      selectedMode,
      visionEnabled: Boolean(token?.document?.sight?.enabled),
      visionRange,
      detectionModes,
      showEcho: hasTremorsense,
      echoEnabled: Boolean(profile.echoEnabled),
      showDisabledMessage: !canEdit
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const form = this.element.querySelector("form[data-irv-form]");
    if (!form) return;

    form.addEventListener("submit", event => {
      event.preventDefault();
      this.#applyChanges(form, true);
    });

    for (const slider of form.querySelectorAll('input[type="range"][data-output]')) {
      slider.addEventListener("input", () => {
        const output = form.querySelector(`[data-output-value="${slider.dataset.output}"]`);
        if (output) output.textContent = `${slider.value}${slider.dataset.suffix ?? ""}`;
      });
    }

    form.addEventListener("change", event => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
      // Sliders fire "change" on release. Each change immediately updates the
      // selected token(s) and stores the visual profile; no separate save step.
      this.#applyChanges(form, false);
      if (target.name === "visionMode") {
        const echoSection = form.querySelector("[data-echo-section]");
        if (echoSection) echoSection.hidden = !String(target.value).toLowerCase().includes("tremor");
      }
    });
  }

  async #applyChanges(form, showNotification) {
    const controlled = [...(canvas.tokens?.controlled ?? [])];
    if (!controlled.length) {
      ui.notifications.warn(game.i18n.localize("IRV.Panel.SelectOneToken"));
      return;
    }
    if (!controlled.every(token => game.user.isGM || token.isOwner)) {
      ui.notifications.warn(game.i18n.localize("IRV.Panel.NoPermission"));
      return;
    }

    const field = name => form.elements.namedItem(name);
    const read = (name, fallback, min, max) => clampNumber(field(name)?.value, fallback, min, max);
    const visionEnabled = Boolean(field("visionEnabled")?.checked);
    const visionRange = read("visionRange", 30, 1, 500);
    const visionMode = String(field("visionMode")?.value ?? "basic");
    const echoVisible = visionMode.toLowerCase().includes("tremor");
    const echoEnabled = echoVisible && Boolean(field("echoEnabled")?.checked);

    const profile = {
      realisticEnabled: Boolean(field("realisticEnabled")?.checked),
      realisticStartPercent: read("realisticStartPercent", DEFAULT_PROFILE.realisticStartPercent, 0, 95),
      realisticTransitionPercent: read("realisticTransitionPercent", DEFAULT_PROFILE.realisticTransitionPercent, 1, 100),
      minPixelSize: read("minPixelSize", DEFAULT_PROFILE.minPixelSize, 2, 16),
      maxPixelSize: read("maxPixelSize", DEFAULT_PROFILE.maxPixelSize, 2, 24),
      immersiveEnabled: Boolean(field("immersiveEnabled")?.checked),
      immersiveStartPercent: read("immersiveStartPercent", DEFAULT_PROFILE.immersiveStartPercent, 10, 95),
      immersiveStrength: read("immersiveStrength", DEFAULT_PROFILE.immersiveStrength, 0, 100),
      useVisionRange: true,
      fallbackDistance: visionRange,
      darknessEnabled: Boolean(field("darknessEnabled")?.checked),
      darknessStartPercent: read("darknessStartPercent", DEFAULT_PROFILE.darknessStartPercent, 50, 99),
      darknessStrength: read("darknessStrength", DEFAULT_PROFILE.darknessStrength, 0, 100),
      transitionEnabled: Boolean(field("transitionEnabled")?.checked),
      transitionWidthPercent: read("transitionWidthPercent", DEFAULT_PROFILE.transitionWidthPercent, 1, 75),
      transitionOpacity: read("transitionOpacity", DEFAULT_PROFILE.transitionOpacity, 10, 100),
      echoEnabled,
      echoStrength: read("echoStrength", DEFAULT_PROFILE.echoStrength, 0, 100)
    };
    if (profile.maxPixelSize < profile.minPixelSize) profile.maxPixelSize = profile.minPixelSize;

    try {
      await Promise.all(controlled.map(async token => {
        const document = token.document;
        if (typeof document.updateVisionMode === "function") {
          if (document.sight?.visionMode !== visionMode) await document.updateVisionMode(visionMode);
        } else {
          await document.update({ "sight.visionMode": visionMode });
        }

        // Change native Foundry sight settings, not just the IRV profile.
        await document.update({
          "sight.enabled": visionEnabled,
          "sight.range": visionRange
        });

        // Keep all registered, non-basic detection modes. Echo mode additionally
        // enables native Feel Tremor when Foundry exposes it.
        const detectionModes = sourceDetectionModes(token);
        for (const id of Object.keys(CONFIG.Canvas?.detectionModes ?? {})) {
          if (id === "basicSight") continue;
          const enabledField = field(`detectionEnabled_${id}`);
          const rangeField = field(`detectionRange_${id}`);
          if (!enabledField && !rangeField) continue;
          const current = detectionModes[id] ?? {};
          detectionModes[id] = {
            ...current,
            enabled: Boolean(enabledField?.checked),
            range: read(`detectionRange_${id}`, visionRange, 0, 500)
          };
        }
        if (echoEnabled && CONFIG.Canvas?.detectionModes?.feelTremor) {
          const current = detectionModes.feelTremor ?? {};
          detectionModes.feelTremor = { ...current, enabled: true, range: visionRange };
        }
        if (Object.keys(detectionModes).length) await document.update({ detectionModes });

        await document.setFlag(MODULE_ID, FLAG_KEY, profile);
      }));

      Hooks.callAll("irvTokenVisionUpdated", controlled);
      if (showNotification) {
        ui.notifications.info(game.i18n.localize("IRV.Panel.Saved"));
      }
    } catch (error) {
      console.error(`${MODULE_ID} | Could not update selected token vision settings.`, error);
      ui.notifications.error(game.i18n.localize("IRV.Panel.SaveFailed"));
    }
  }
}

export { DEFAULT_PROFILE, FLAG_KEY };
