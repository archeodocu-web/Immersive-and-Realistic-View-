import { DistancePixelationFilter } from "./filters/distance-pixelation.js";
import { VisionPanel, getDefaultProfile } from "./apps/vision-panel.js";

const MODULE_ID = "immersive-and-realistic-views";
const FLAG_KEY = "visionProfile";
const MAX_TRACKED_TOKENS = 10;
const UPDATE_LOGIC_EVERY_FRAMES = 8;

let filter = null;
let ticker = null;
let frameCount = 0;
let trackedTokens = [];
let visionPanel = null;
const warnings = new Set();

function registerStoredDefaults() {
  // Preserve hidden Alpha 0.3 settings. Token flags override these defaults.
  const storedDefaults = [
    { key: "enabled", type: Boolean, default: false },
    { key: "immersiveEnabled", type: Boolean, default: false },
    { key: "useTokenVisionRange", type: Boolean, default: true },
    { key: "fallbackDistance", type: Number, default: 12 },
    { key: "maxPixelSize", type: Number, default: 12 },
    { key: "immersiveStartPercent", type: Number, default: 70 },
    { key: "immersiveStrength", type: Number, default: 55 }
  ];
  for (const setting of storedDefaults) {
    game.settings.register(MODULE_ID, setting.key, {
      scope: "world",
      config: false,
      type: setting.type,
      default: setting.default
    });
  }
}

Hooks.once("init", () => {
  registerStoredDefaults();
  console.info(`${MODULE_ID} | Initialized ${game.modules.get(MODULE_ID)?.version ?? ""}`);
});

Hooks.on("getSceneControlButtons", controls => {
  const tokenControl = controls?.tokens;
  if (!tokenControl?.tools) {
    warnOnce("controls", "Token scene controls were not available when IRV registered its eye button.");
    return;
  }

  tokenControl.tools.irvVision = {
    name: "irvVision",
    title: "IRV.Controls.OpenVisionPanel",
    icon: "fa-solid fa-eye",
    order: Object.keys(tokenControl.tools).length,
    button: true,
    visible: true,
    onChange: () => toggleVisionPanel()
  };
});

Hooks.on("canvasReady", () => {
  installFilter();
  startTicker();
  refreshTrackedTokens();
});

Hooks.on("canvasTearDown", () => {
  stopTicker();
  removeFilter();
  trackedTokens = [];
  visionPanel?.close();
  visionPanel = null;
});

Hooks.on("controlToken", () => {
  refreshTrackedTokens();
  if (visionPanel?.rendered) visionPanel.render();
});
Hooks.on("updateToken", () => refreshTrackedTokens());
Hooks.on("createToken", () => refreshTrackedTokens());
Hooks.on("deleteToken", () => refreshTrackedTokens());
Hooks.on("updateScene", () => refreshTrackedTokens());
Hooks.on("irvTokenVisionUpdated", () => refreshTrackedTokens());

function toggleVisionPanel() {
  if (visionPanel?.rendered) {
    visionPanel.close();
    return;
  }
  visionPanel ??= new VisionPanel();
  visionPanel.render({ force: true });
}

function installFilter() {
  removeFilter();
  const BaseFilter = foundry?.canvas?.rendering?.filters?.AbstractBaseFilter;
  if (!BaseFilter || !canvas?.app?.stage) {
    warnOnce("api", "Foundry V14 AbstractBaseFilter or canvas stage is unavailable. IRV visual effects are disabled.");
    return;
  }

  try {
    filter = DistancePixelationFilter.create();
    filter.enabled = false;
    const existing = canvas.app.stage.filters ?? [];
    canvas.app.stage.filters = [...existing.filter(f => f !== filter), filter];
  } catch (error) {
    console.error(`${MODULE_ID} | Could not create the IRV shader filter.`, error);
    filter = null;
  }
}

function removeFilter() {
  if (canvas?.app?.stage && filter) {
    canvas.app.stage.filters = (canvas.app.stage.filters ?? []).filter(f => f !== filter);
  }
  filter?.destroy?.();
  filter = null;
}

function startTicker() {
  const appTicker = canvas?.app?.ticker;
  if (!appTicker || !filter) return;
  appTicker.remove(updateFilter);
  appTicker.add(updateFilter);
  ticker = appTicker;
}

function stopTicker() {
  ticker?.remove(updateFilter);
  ticker = null;
}

function refreshTrackedTokens() {
  if (!canvas?.ready) return;
  trackedTokens = [...(canvas.tokens?.controlled ?? [])]
    .filter(token => token?.visible && !token.document?.hidden && (game.user.isGM || token.isOwner))
    .slice(0, MAX_TRACKED_TOKENS);
}

function updateFilter() {
  if (!filter || !canvas?.ready) return;

  frameCount++;
  if (frameCount >= UPDATE_LOGIC_EVERY_FRAMES) {
    frameCount = 0;
    refreshTrackedTokens();
  }

  if (trackedTokens.length === 0) {
    filter.enabled = false;
    filter.uniforms.uTokenCount = 0;
    return;
  }

  const renderer = canvas.app?.renderer;
  const stage = canvas.stage;
  if (!renderer || !stage) {
    filter.enabled = false;
    return;
  }

  const width = renderer.screen?.width ?? renderer.width;
  const height = renderer.screen?.height ?? renderer.height;
  const minDimension = Math.max(1, Math.min(width, height));
  const zoom = Number(stage.scale?.x ?? 1);
  const distancePixels = Number(canvas.dimensions?.distancePixels ?? 0);
  if (!Number.isFinite(distancePixels) || distancePixels <= 0) {
    filter.enabled = false;
    warnOnce("grid", "The scene does not expose a usable distancePixels scale. Configure a scene grid before using IRV.");
    return;
  }

  const positions = new Float32Array(MAX_TRACKED_TOKENS * 2);
  const radii = new Float32Array(MAX_TRACKED_TOKENS);
  const realisticEnabled = new Float32Array(MAX_TRACKED_TOKENS);
  const realisticStart = new Float32Array(MAX_TRACKED_TOKENS);
  const realisticTransition = new Float32Array(MAX_TRACKED_TOKENS);
  const minPixelSizes = new Float32Array(MAX_TRACKED_TOKENS);
  const maxPixelSizes = new Float32Array(MAX_TRACKED_TOKENS);
  const immersiveEnabled = new Float32Array(MAX_TRACKED_TOKENS);
  const immersiveStart = new Float32Array(MAX_TRACKED_TOKENS);
  const immersiveStrength = new Float32Array(MAX_TRACKED_TOKENS);
  const darknessEnabled = new Float32Array(MAX_TRACKED_TOKENS);
  const darknessStart = new Float32Array(MAX_TRACKED_TOKENS);
  const darknessStrength = new Float32Array(MAX_TRACKED_TOKENS);
  const boundaryEnabled = new Float32Array(MAX_TRACKED_TOKENS);
  const boundaryWidth = new Float32Array(MAX_TRACKED_TOKENS);
  const boundaryOpacity = new Float32Array(MAX_TRACKED_TOKENS);
  const echoEnabled = new Float32Array(MAX_TRACKED_TOKENS);
  const echoStrength = new Float32Array(MAX_TRACKED_TOKENS);
  let count = 0;

  for (const token of trackedTokens) {
    if (!token?.visible || count >= MAX_TRACKED_TOKENS) continue;
    const profile = { ...getDefaultProfile(), ...(token.document.getFlag(MODULE_ID, FLAG_KEY) ?? {}) };
    const nativeRange = Number(token.document?.sight?.range);
    const detailDistance = profile.useVisionRange && Number.isFinite(nativeRange) && nativeRange > 0
      ? nativeRange
      : Number(profile.fallbackDistance);
    const echoModeActive = Boolean(profile.echoEnabled)
      && String(token.document?.sight?.visionMode ?? "").toLowerCase().includes("tremor");

    if (!profile.realisticEnabled && !profile.immersiveEnabled && !profile.darknessEnabled
      && !profile.transitionEnabled && !echoModeActive) continue;

    const screenPosition = stage.toGlobal(token.center);
    positions[count * 2] = screenPosition.x / width;
    positions[count * 2 + 1] = screenPosition.y / height;
    radii[count] = (Math.max(1, detailDistance) * distancePixels * zoom) / minDimension;

    realisticEnabled[count] = profile.realisticEnabled ? 1 : 0;
    realisticStart[count] = Math.min(0.95, Math.max(0, Number(profile.realisticStartPercent) / 100));
    realisticTransition[count] = Math.min(1, Math.max(0.01, Number(profile.realisticTransitionPercent) / 100));
    minPixelSizes[count] = Math.min(16, Math.max(2, Number(profile.minPixelSize) || 2));
    maxPixelSizes[count] = Math.min(24, Math.max(minPixelSizes[count], Number(profile.maxPixelSize) || 12));
    immersiveEnabled[count] = profile.immersiveEnabled ? 1 : 0;
    immersiveStart[count] = Math.min(0.95, Math.max(0.10, Number(profile.immersiveStartPercent) / 100));
    immersiveStrength[count] = Math.min(1, Math.max(0, Number(profile.immersiveStrength) / 100));
    darknessEnabled[count] = profile.darknessEnabled ? 1 : 0;
    darknessStart[count] = Math.min(0.99, Math.max(0, Number(profile.darknessStartPercent) / 100));
    darknessStrength[count] = Math.min(1, Math.max(0, Number(profile.darknessStrength) / 100));
    boundaryEnabled[count] = profile.transitionEnabled ? 1 : 0;
    boundaryWidth[count] = Math.min(0.75, Math.max(0.01, Number(profile.transitionWidthPercent) / 100));
    boundaryOpacity[count] = Math.min(1, Math.max(0.10, Number(profile.transitionOpacity) / 100));
    echoEnabled[count] = echoModeActive ? 1 : 0;
    echoStrength[count] = Math.min(1, Math.max(0, Number(profile.echoStrength) / 100));
    count++;
  }

  if (!count) {
    filter.enabled = false;
    filter.uniforms.uTokenCount = 0;
    return;
  }

  filter.update({
    positions, radii, realisticEnabled, realisticStart, realisticTransition,
    minPixelSizes, maxPixelSizes, immersiveEnabled, immersiveStart,
    immersiveStrength, darknessEnabled, darknessStart, darknessStrength,
    boundaryEnabled, boundaryWidth, boundaryOpacity, echoEnabled, echoStrength,
    time: performance.now() / 1000,
    count, resolution: [width, height]
  });
  filter.enabled = true;
}

function warnOnce(key, message) {
  if (warnings.has(key)) return;
  warnings.add(key);
  console.warn(`${MODULE_ID} | ${message}`);
}
