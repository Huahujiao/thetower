import * as THREE from 'three'
import { setSurfaceColor } from './surface-color.js'
import { applyCardPaletteMaterial } from './card-palette-material.js'

// A card is a thin object resting just clear of the paving, not a second paving
// slab. The body used to be 0.18 against a 0.08 floor - two and a quarter times
// the slab it sat on - which is why the board read as tiled masonry.
export const HIDDEN_CARD_THICKNESS = 0.06
export const HIDDEN_CARD_SCALE = 0.95

// Air under the card, so it hovers a little instead of lying flat on the stone
// and the key light leaves a readable contact shadow beneath it. Deliberately
// separate from the face offset below, which only avoids z-fighting.
export const CARD_FLOOR_GAP = 0.045

// Keep the textured face clear of the card body's top surface at every camera angle.
export const CARD_FACE_CLEARANCE = 0.02
// Rough stone retains the ornament relief and its surface tooth.
export const CARD_BACK_NORMAL_SCALE = .65
const EDGE_COLORS = { neutral: 0xb2a58d, scorch: 0x923b3b, wither: 0xa79736, drown: 0x3f6b9c, blocked: 0x3d4447 }

// Every tile shares this ground level. This is the visible stone, which cards
// deliberately do not touch.
export function groundSurfaceY(baseThickness) {
  return baseThickness / 2 + CARD_FACE_CLEARANCE
}

// Where a card comes to rest: a visible band of air above the stone, so the key
// light drops a contact shadow under it and it reads as an object on a surface
// rather than as one more paving slab.
export function cardRestY(baseThickness) {
  return groundSurfaceY(baseThickness) + CARD_FLOOR_GAP
}

export function hiddenCardBodyY(baseThickness) {
  return cardRestY(baseThickness) + HIDDEN_CARD_THICKNESS / 2
}

export function cardFaceY(hidden, baseThickness) {
  return hidden
    ? cardRestY(baseThickness) + HIDDEN_CARD_THICKNESS + CARD_FACE_CLEARANCE
    : cardRestY(baseThickness)
}

export function cardBodyGeometry(size, thickness) {
  const geometry = new THREE.BoxGeometry(size, thickness, size)
  const uv = geometry.attributes.uv
  // Reuse the generated artwork's narrow outer band, not its central emblem.
  for (let i = 0; i < uv.count; i++) uv.setY(i, 0.035 + uv.getY(i) * 0.055)
  return geometry
}

export function styleCardBody(body, { hidden, attribute, texture, baseThickness, blocked = false }) {
  body.scale.set(hidden ? HIDDEN_CARD_SCALE : 1, hidden ? HIDDEN_CARD_THICKNESS / baseThickness : 1, hidden ? HIDDEN_CARD_SCALE : 1)
  body.userData.baseY = hidden ? hiddenCardBodyY(baseThickness) : 0
  body.position.y = body.userData.baseY
  body.material.map = hidden ? texture : null
  body.material.roughness = hidden ? .46 : .9
  body.material.color.setHex(hidden ? (blocked ? EDGE_COLORS.blocked : EDGE_COLORS[attribute] ?? EDGE_COLORS.neutral) : 0x262a36)
  body.material.needsUpdate = true
}

// Only hidden card artwork receives relief lighting. Front canvases and standing
// token overlays retain their original unlit, transparent presentation.
export function createCardFaceMaterial(texture, normalMap = null, options = {}, surfaceMap = null, wearMap = null, paletteUniforms = null) {
  const common = {
    map: texture, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
    ...options,
  }
  if (!normalMap) return new THREE.MeshBasicMaterial(common)
  const material = new THREE.MeshStandardMaterial({
    ...common, normalMap, normalScale: new THREE.Vector2(CARD_BACK_NORMAL_SCALE, CARD_BACK_NORMAL_SCALE),
    roughness: surfaceMap ? 1 : .82, metalness: 0,
    roughnessMap: surfaceMap, metalnessMap: surfaceMap, aoMap: surfaceMap, aoMapIntensity: .5,
    emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0,
  })
  const tinted = setSurfaceColor(material, material.color.clone(), 0xf0f0ed)
  if (!wearMap) return applyCardPaletteMaterial(tinted, paletteUniforms)
  // Pigment and water-stain variants remain independent of the rough relief.
  const previous = material.onBeforeCompile
  material.onBeforeCompile = shader => {
    previous?.(shader)
    shader.uniforms.uCardWear = { value: wearMap }
    shader.fragmentShader = `uniform sampler2D uCardWear;\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        diffuseColor.rgb *= texture2D(uCardWear, vMapUv).rgb * 2.0;
      `)
  }
  const key = material.customProgramCacheKey
  material.customProgramCacheKey = function () { return (key ? key.call(this) + '|' : '') + 'card-wear' }
  return applyCardPaletteMaterial(tinted, paletteUniforms)
}
