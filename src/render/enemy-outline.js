import { Color, Vector2 } from 'three'

// Shadow-puppet parts are alpha-cut quads, so a silhouette outline has to come
// from neighbour alpha taps rather than from pushed geometry. Eight taps cost
// the same whether the ink runs all the way round or only down the backlit
// side - the directional case just weights them - so the single-sided outline
// is not the expensive option.
//
// The temple key sits up and behind the board, so the lower right of a puppet
// is the side that faces away from the light. That is the default ink side.
export const ENEMY_OUTLINE = Object.freeze({
  color: 0x0e1214,
  width: 2.1,
  softness: 0.45,
  direction: new Vector2(0.7071, -0.7071),
})

// Offsets and their dot with the ink direction. Normalising keeps the falloff
// independent of how many taps are enabled.
const TAPS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071],
]

export function applyEnemyOutline(material, options = {}) {
  const color = options.color ?? ENEMY_OUTLINE.color
  const width = options.width ?? ENEMY_OUTLINE.width
  const softness = options.softness ?? ENEMY_OUTLINE.softness
  const texel = options.texel ?? new Vector2(1 / 256, 1 / 256)
  const previous = material.onBeforeCompile
  const previousKey = material.customProgramCacheKey

  // Normalised ink direction; the zero vector means "ink every side".
  const requested = options.direction ?? ENEMY_OUTLINE.direction
  const direction = requested instanceof Vector2 ? requested : new Vector2(Number(requested?.x) || 0, Number(requested?.y) || 0)
  const length = direction.length()
  const ink = length > 1e-6 ? direction.clone().divideScalar(length) : new Vector2()
  const directional = length > 1e-6
  const samples = TAPS.map(([x, y]) => `vec2(${(x * Math.SQRT1_2).toFixed(4)}, ${(y * Math.SQRT1_2).toFixed(4)})`)
  const weights = TAPS.map(([x, y]) => {
    const norm = Math.hypot(x, y)
    return (directional ? Math.max(0, (x / norm) * ink.x + (y / norm) * ink.y) : 1).toFixed(4)
  })

  material.onBeforeCompile = shader => {
    previous?.(shader)
    shader.uniforms.uOutlineColor = { value: new Color(color) }
    shader.uniforms.uOutlineTexel = { value: texel.clone().multiplyScalar(width) }
    shader.uniforms.uOutlineSoftness = { value: softness }
    shader.fragmentShader = `uniform vec3 uOutlineColor;
uniform vec2 uOutlineTexel;
uniform float uOutlineSoftness;
${shader.fragmentShader}`
      .replace('#include <alphatest_fragment>', `
        #ifdef USE_MAP
          float inkEdge = 0.0;
          float inkFacing = 0.0;
          vec2 inkOffsets[8] = vec2[8](${samples.join(', ')});
          float inkWeights[8] = float[8](${weights.join(', ')});
          for (int inkTap = 0; inkTap < 8; inkTap++) {
            float inkSample = texture2D(map, vMapUv + inkOffsets[inkTap] * uOutlineTexel).a;
            float inkSolid = step(0.5, inkSample);
            inkEdge = max(inkEdge, inkSolid);
            inkFacing = max(inkFacing, inkSolid * inkWeights[inkTap]);
          }
          if (inkEdge > 0.5 && texture2D(map, vMapUv).a < 0.5) {
            // Ink fades out where the silhouette faces the light.
            float inkAlpha = smoothstep(0.0, uOutlineSoftness, inkFacing);
            if (inkAlpha > 0.01) {
              diffuseColor.rgb = mix(diffuseColor.rgb, uOutlineColor, inkAlpha);
              diffuseColor.a = max(diffuseColor.a, inkAlpha);
            }
          }
        #endif
        #include <alphatest_fragment>
      `)
  }
  const key = directional ? `puppet-outline-directional-${width}-${softness}-${color}` : `puppet-outline-full-${width}-${softness}-${color}`
  // Three's default cache key reads this.onBeforeCompile, so chaining onto it
  // has to keep the material as the receiver.
  material.customProgramCacheKey = function () { return (previousKey ? previousKey.call(this) + '|' : '') + key }
  return material
}