/**
 * Per-token IRV vision presentation filter.
 *
 * Realistic View now uses a token-anchored pixel grid and a per-cell dissolve.
 * Each pixel block receives its own stable threshold, so blocks pixelate and
 * fade out at slightly different distances instead of forming one smooth,
 * circular transition band.
 *
 * Immersive View remains a separate peripheral softening/desaturation effect.
 *
 * Alpha limitation: this post-process is not yet clipped to Foundry's exact
 * wall-blocked visibility polygon. Core visibility and Fog of War remain the
 * authority for what a player is allowed to see.
 */
export class DistancePixelationFilter extends foundry.canvas.rendering.filters.AbstractBaseFilter {
  static get defaultUniforms() {
    return {
      uTokenPos: new Float32Array(20),
      uTokenRadii: new Float32Array(10),
      uRealisticEnabled: new Float32Array(10),
      uRealisticStart: new Float32Array(10),
      uRealisticTransition: new Float32Array(10),
      uMinPixelSizes: new Float32Array(10),
      uMaxPixelSizes: new Float32Array(10),
      uImmersiveEnabled: new Float32Array(10),
      uImmersiveStart: new Float32Array(10),
      uImmersiveStrength: new Float32Array(10),
      uDarknessEnabled: new Float32Array(10),
      uDarknessStart: new Float32Array(10),
      uDarknessStrength: new Float32Array(10),
      uBoundaryEnabled: new Float32Array(10),
      uBoundaryWidth: new Float32Array(10),
      uBoundaryOpacity: new Float32Array(10),
      uEchoEnabled: new Float32Array(10),
      uEchoStrength: new Float32Array(10),
      uTime: 0,
      uTokenCount: 0,
      uResolution: [window.innerWidth, window.innerHeight]
    };
  }

  static _createFragmentShader() {
    return `
      precision mediump float;
      const int MAX_TOKENS = 10;
      varying vec2 vTextureCoord;
      uniform sampler2D uSampler;
      uniform vec2 uTokenPos[MAX_TOKENS];
      uniform float uTokenRadii[MAX_TOKENS];
      uniform float uRealisticEnabled[MAX_TOKENS];
      uniform float uRealisticStart[MAX_TOKENS];
      uniform float uRealisticTransition[MAX_TOKENS];
      uniform float uMinPixelSizes[MAX_TOKENS];
      uniform float uMaxPixelSizes[MAX_TOKENS];
      uniform float uImmersiveEnabled[MAX_TOKENS];
      uniform float uImmersiveStart[MAX_TOKENS];
      uniform float uImmersiveStrength[MAX_TOKENS];
      uniform float uDarknessEnabled[MAX_TOKENS];
      uniform float uDarknessStart[MAX_TOKENS];
      uniform float uDarknessStrength[MAX_TOKENS];
      uniform float uBoundaryEnabled[MAX_TOKENS];
      uniform float uBoundaryWidth[MAX_TOKENS];
      uniform float uBoundaryOpacity[MAX_TOKENS];
      uniform float uEchoEnabled[MAX_TOKENS];
      uniform float uEchoStrength[MAX_TOKENS];
      uniform float uTime;
      uniform int uTokenCount;
      uniform vec2 uResolution;

      // Stable pseudo-random value per pixel cell. This is deliberately not
      // animated: blocks must not flicker while the scene is stationary.
      float irvHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      void main(void) {
        vec2 resolution = max(uResolution, vec2(1.0));
        float minDimension = min(resolution.x, resolution.y);
        vec2 aspect = resolution / minDimension;
        vec2 pixelPosition = vTextureCoord * resolution;
        vec2 uvCorrected = vTextureCoord * aspect;

        vec4 originalColor = texture2D(uSampler, vTextureCoord);
        vec4 resultColor = originalColor;

        // Select the strongest Realistic View contribution at this fragment.
        // Pixel size and dissolve decisions are calculated once per token-
        // anchored cell, so a whole little block changes together.
        float bestProgress = -1.0;
        float bestPixelSize = 10.0;
        float bestPixelMix = 0.0;
        float bestDissolve = 0.0;
        vec2 bestPixelUV = vTextureCoord;

        float immersiveAmount = 0.0;
        float immersiveLoss = 0.0;
        float outsideDarkness = 0.0;
        bool hasDarknessProfile = false;
        float edgeDarkness = 0.0;
        bool hasBoundaryProfile = false;
        float echoAmount = 0.0;

        for (int i = 0; i < MAX_TOKENS; i++) {
          if (i >= uTokenCount) break;

          vec2 tokenPosition = uTokenPos[i];
          float tokenRadius = max(0.00001, uTokenRadii[i]);
          vec2 tokenScreenPx = tokenPosition * resolution;

          float radialDistance = distance(uvCorrected, tokenPosition * aspect) / tokenRadius;

          if (uRealisticEnabled[i] > 0.5) {
            float sizeProgress = smoothstep(uRealisticStart[i], 1.0, radialDistance);
            float blockSize = mix(clamp(uMinPixelSizes[i], 2.0, 16.0),
                                  clamp(uMaxPixelSizes[i], uMinPixelSizes[i], 24.0),
                                  sizeProgress);
            vec2 cell = floor((pixelPosition - tokenScreenPx) / blockSize);
            vec2 cellCenterPx = tokenScreenPx + (cell + 0.5) * blockSize;
            vec2 cellCenterUV = clamp(cellCenterPx / resolution, vec2(0.0), vec2(1.0));
            vec2 cellCenterCorrected = cellCenterUV * aspect;
            vec2 tokenPositionCorrected = tokenPosition * aspect;

            float normalizedDistance = distance(cellCenterCorrected, tokenPositionCorrected) / tokenRadius;
            float startAt = clamp(uRealisticStart[i], 0.0, 0.95);
            float progress = clamp((normalizedDistance - startAt) / max(0.05, 1.0 - startAt), 0.0, 1.0);

            // Two different stable noise values keep the pixelation onset and
            // the later block dissolve from lining up as a single circular rim.
            float onsetNoise = irvHash(cell + vec2(float(i) * 19.1, 7.7));
            float dissolveNoise = irvHash(cell + vec2(31.7 + float(i) * 13.3, 91.9));
            float pixelStart = onsetNoise * 0.18;
            float pixelMix = smoothstep(pixelStart, min(1.0, pixelStart + 0.42), progress);

            // The setting formerly called "transition width" now controls
            // how widely individual blocks are distributed along the fade.
            // Even at low values there is some variation, avoiding a hard ring.
            float spread = clamp(uRealisticTransition[i], 0.01, 1.0);
            float fadeStart = clamp(0.66 + (dissolveNoise - 0.5) * (0.24 + spread * 0.72), 0.12, 0.88);
            float fadeEnd = min(1.0, fadeStart + 0.12);
            float dissolve = smoothstep(fadeStart, fadeEnd, progress);

            if (progress > bestProgress) {
              bestProgress = progress;
              bestPixelSize = blockSize;
              bestPixelMix = pixelMix;
              bestDissolve = dissolve;
              bestPixelUV = cellCenterUV;
            }
          }

          if (uImmersiveEnabled[i] > 0.5) {
            float d = distance(uvCorrected, tokenPosition * aspect);
            float peripheral = smoothstep(tokenRadius * uImmersiveStart[i], tokenRadius, d);
            float amount = peripheral * clamp(uImmersiveStrength[i], 0.0, 1.0);
            if (amount > immersiveAmount) {
              immersiveAmount = amount;
              immersiveLoss = peripheral;
            }
          }

          // DARKNESS: independently darken the area beyond the selected token's
          // nominal vision radius. The feather is confined to the outer edge;
          // beyond the radius the configured darkness level remains in effect.
          // With multiple selected tokens, the least-dark contribution wins so
          // the union of their ranges remains comparatively visible.
          if (uDarknessEnabled[i] > 0.5) {
            float darknessStartAt = clamp(uDarknessStart[i], 0.0, 0.99);
            float outsideRange = smoothstep(darknessStartAt, 1.0, radialDistance);
            float tokenDarkness = outsideRange * clamp(uDarknessStrength[i], 0.0, 1.0);
            if (!hasDarknessProfile) {
              outsideDarkness = tokenDarkness;
              hasDarknessProfile = true;
            } else {
              outsideDarkness = min(outsideDarkness, tokenDarkness);
            }
          }

          // Soft vision boundary: the fade starts inside the native vision
          // radius, reaches the configured black opacity at the edge, and
          // continues at that level outside. Darkness can independently deepen it.
          if (uBoundaryEnabled[i] > 0.5) {
            float width = clamp(uBoundaryWidth[i], 0.01, 0.75);
            float fade = smoothstep(1.0 - width, 1.0, radialDistance)
                       * clamp(uBoundaryOpacity[i], 0.10, 1.0);
            if (!hasBoundaryProfile) {
              edgeDarkness = fade;
              hasBoundaryProfile = true;
            } else {
              edgeDarkness = min(edgeDarkness, fade);
            }
          }

          // Echo presentation: a quiet, expanding sonar pulse. Native Feel Tremor
          // handles detection; wall-surface reflections are a later extension.
          if (uEchoEnabled[i] > 0.5) {
            float phase = fract(uTime * 0.18);
            float ringDistance = abs(radialDistance - phase);
            float ring = 1.0 - smoothstep(0.008, 0.035, ringDistance);
            float decay = 1.0 - phase * 0.55;
            echoAmount = max(echoAmount, ring * decay * clamp(uEchoStrength[i], 0.0, 1.0));
          }
        }

        // REALISTIC VIEW: preserve a fixed token-anchored grid. Each cell first
        // loses detail, then dissolves independently into a low-luminance
        // version of its own pixel. No continuous radial blur band is applied.
        if (bestProgress > 0.0) {
          vec4 pixelBlockColor = texture2D(uSampler, bestPixelUV);
          vec4 pixelated = mix(originalColor, pixelBlockColor, bestPixelMix);
          vec3 fadeToDark = pixelBlockColor.rgb * 0.045;
          resultColor.rgb = mix(pixelated.rgb, fadeToDark, bestDissolve);
        }

        // IMMERSIVE VIEW is independent and can be enabled without Realistic View.
        if (immersiveAmount > 0.001) {
          vec2 blurStep = (1.0 / resolution) * mix(0.6, 2.0, immersiveLoss);
          vec4 blurColor = originalColor * 0.40;
          blurColor += texture2D(uSampler, clamp(vTextureCoord + vec2(blurStep.x, 0.0), vec2(0.0), vec2(1.0))) * 0.15;
          blurColor += texture2D(uSampler, clamp(vTextureCoord - vec2(blurStep.x, 0.0), vec2(0.0), vec2(1.0))) * 0.15;
          blurColor += texture2D(uSampler, clamp(vTextureCoord + vec2(0.0, blurStep.y), vec2(0.0), vec2(1.0))) * 0.15;
          blurColor += texture2D(uSampler, clamp(vTextureCoord - vec2(0.0, blurStep.y), vec2(0.0), vec2(1.0))) * 0.15;

          resultColor.rgb = mix(resultColor.rgb, blurColor.rgb, immersiveAmount * 0.38);
          float luminance = dot(resultColor.rgb, vec3(0.299, 0.587, 0.114));
          resultColor.rgb = mix(resultColor.rgb, vec3(luminance), immersiveAmount * 0.62);
          resultColor.rgb *= (1.0 - immersiveAmount * 0.20);
        }

        // DARKNESS is applied last so it also darkens the immersive and
        // realistic treatments. It changes presentation only; it does not
        // alter Foundry's actual vision polygon, walls, or Fog of War data.
        float combinedDarkness = max(outsideDarkness, edgeDarkness);
        if ((hasDarknessProfile || hasBoundaryProfile) && combinedDarkness > 0.001) {
          resultColor.rgb *= (1.0 - combinedDarkness);
        }

        if (echoAmount > 0.001) {
          vec3 echoTint = vec3(0.38, 0.72, 0.88);
          resultColor.rgb = mix(resultColor.rgb, echoTint, echoAmount * 0.32);
        }

        resultColor.a = originalColor.a;
        gl_FragColor = resultColor;
      }
    `;
  }

  constructor(...args) {
    super(...args);
    this._positionBuffer = new Float32Array(20);
    this._buffers = {
      radii: new Float32Array(10),
      realisticEnabled: new Float32Array(10),
      realisticStart: new Float32Array(10),
      realisticTransition: new Float32Array(10),
      minPixelSizes: new Float32Array(10),
      maxPixelSizes: new Float32Array(10),
      immersiveEnabled: new Float32Array(10),
      immersiveStart: new Float32Array(10),
      immersiveStrength: new Float32Array(10),
      darknessEnabled: new Float32Array(10),
      darknessStart: new Float32Array(10),
      darknessStrength: new Float32Array(10),
      boundaryEnabled: new Float32Array(10),
      boundaryWidth: new Float32Array(10),
      boundaryOpacity: new Float32Array(10),
      echoEnabled: new Float32Array(10),
      echoStrength: new Float32Array(10)
    };
  }

  update({ positions, radii, realisticEnabled, realisticStart, realisticTransition,
    minPixelSizes, maxPixelSizes, immersiveEnabled, immersiveStart, immersiveStrength,
    darknessEnabled, darknessStart, darknessStrength, boundaryEnabled, boundaryWidth,
    boundaryOpacity, echoEnabled, echoStrength, time, count, resolution }) {
    this._positionBuffer.fill(0);
    this._positionBuffer.set(positions.subarray(0, this._positionBuffer.length));
    this.uniforms.uTokenPos = this._positionBuffer;

    const values = {
      radii: "uTokenRadii",
      realisticEnabled: "uRealisticEnabled",
      realisticStart: "uRealisticStart",
      realisticTransition: "uRealisticTransition",
      minPixelSizes: "uMinPixelSizes",
      maxPixelSizes: "uMaxPixelSizes",
      immersiveEnabled: "uImmersiveEnabled",
      immersiveStart: "uImmersiveStart",
      immersiveStrength: "uImmersiveStrength",
      darknessEnabled: "uDarknessEnabled",
      darknessStart: "uDarknessStart",
      darknessStrength: "uDarknessStrength",
      boundaryEnabled: "uBoundaryEnabled",
      boundaryWidth: "uBoundaryWidth",
      boundaryOpacity: "uBoundaryOpacity",
      echoEnabled: "uEchoEnabled",
      echoStrength: "uEchoStrength"
    };

    for (const [key, uniform] of Object.entries(values)) {
      const buffer = this._buffers[key];
      buffer.fill(0);
      buffer.set(arguments[0][key].subarray(0, buffer.length));
      this.uniforms[uniform] = buffer;
    }

    this.uniforms.uTime = Number(time) || 0;
    this.uniforms.uTokenCount = Math.max(0, Math.min(10, count | 0));
    this.uniforms.uResolution = resolution;
  }
}
