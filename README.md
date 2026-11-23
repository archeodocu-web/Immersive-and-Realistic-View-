# Immersive and Realistic Views — Alpha 0.4.3-alpha.1

Module ID: `immersive-and-realistic-views`.

This release deliberately starts from the Alpha 0.4.2 implementation. It keeps the floating `ApplicationV2` side panel and the existing Realistic View / Immersive View / Darkness post-process instead of replacing them with a generic Dialog.

## Controls
- Select one or more tokens, then open the eye tool in the Token scene controls.
- The panel lists the selected tokens. With multiple selections, values from the first selected token are used as the starting profile and applied to all selected tokens.
- Vision enabled, native Vision Mode, and native Vision Range update the actual TokenDocument.
- Detection modes are enumerated from `CONFIG.Canvas.detectionModes`; the basic sight entry is left to Foundry.
- Realistic View retains the token-anchored per-cell dissolve and adds a minimum-to-maximum pixel block size range.
- The soft vision boundary has its own enable switch, inward width, and black opacity setting.
- Immersive View and Darkness remain independent effects. Darkness retains onset and strength settings.
- The Echo option appears when the selected Vision Mode is Tremorsense. When enabled, it uses native `feelTremor` detection if available and renders an expanding visual pulse.

## Important limitations
- This is an experimental alpha. JavaScript syntax and package-level validation are checked, but this package has not been executed in the user's live Foundry VTT instance.
- The post-process remains a screen-space effect and is not clipped to Foundry's exact wall-blocked vision polygon. Foundry remains responsible for the authoritative vision/Fog of War rules.
- Echo currently provides native Feel Tremor token detection where registered plus an expanding sonar-style pulse. Geometry-aware reflection from wall surfaces is not implemented yet.
- Multi-selection bulk-applies the first selected token's IRV visual profile and the chosen native sight configuration to all selected tokens; it does not preserve different per-token profiles within that bulk operation.
- The module does not change the How to be a Hero system files. It uses Foundry's token data and Canvas registries.

## Install
1. Stop Foundry.
2. Back up the current `Data/modules/immersive-and-realistic-views` folder.
3. Replace it with the `immersive-and-realistic-views` folder from this ZIP, making sure `module.json` is not nested one folder too deep.
4. Start Foundry, enable the module, select token(s), activate the Token controls and click the eye tool.
5. Test on a duplicate scene before using it in a live session.
