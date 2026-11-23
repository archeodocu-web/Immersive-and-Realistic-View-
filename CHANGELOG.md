## 0.4.3-alpha.1
- Rebased on the Alpha 0.4.2 `ApplicationV2` panel and retained the floating translucent window style.
- Added native Foundry vision enable/range/mode controls using TokenDocument updates and `updateVisionMode`.
- Added multi-token editing: the panel lists all selected tokens and applies the first selected token's profile to the selected group.
- Added a dedicated adjustable vision-edge transition zone and black opacity control.
- Added fine-to-coarse distance pixel sizing while retaining the prior per-cell dissolve shader.
- Retained independent Immersive View and Darkness controls.
- Added a Tremorsense-only Echo option that enables native Feel Tremor detection when registered and displays an expanding echo pulse. Actual geometry-aware wall reflections are not yet implemented.

## 0.4.2-alpha.1
- Added an independent per-token Darkness mode to darken the scene beyond the selected token's nominal vision range.
- Added controls for enable/disable, darkening onset (as a percentage of token range), and darkness strength.
- Darkness is applied independently of Realistic View and Immersive View.
- Clarified that the radial darkness post-process is not yet clipped to wall-blocked visibility polygons and does not replace Foundry Fog of War.

# Changelog

## 0.4.1-alpha.1
- Reworked Realistic View from a continuous radial pixelation blend to a token-anchored pixel-cell dissolve.
- Pixel cells now receive staggered, stable fade thresholds to reduce the visible circular wave/ring.
- The former transition-width control is now labelled Pixel Dissolve Spread and controls the variation between individual block fade points.
- Reduced the default maximum pixel block size to 12 px and limited the slider to 24 px for finer mosaic detail.
- Immersive View remains a separate effect and can still be enabled independently.

## 0.4.0-alpha.1
- Added a dedicated IRV eye control to the Token scene controls.
- Added per-token Realistic View and Immersive View profiles.
- Added English and German localization.
