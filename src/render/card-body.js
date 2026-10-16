import * as THREE from 'three'
import { setSurfaceColor } from './surface-color.js'

export const HIDDEN_CARD_THICKNESS = 0.18
export const HIDDEN_CARD_SCALE = 0.95
// Keep the textured face clear of the card body's top surface at every camera angle.
export const CARD_FACE_CLEARANCE = 0.02
const EDGE_COLORS = { neutral: 0xb2a58d, scorch: 0xa66b50, wither: 0xafa16e, drown: 0x819eb2, blocked: 0x555a62 }

// Every tile shares this ground level; cards sit on top rather than lowering it.
export function groundSurfaceY(baseThickness) {
  return baseThickness / 2 + CARD_FACE_CLEARANCE
}

export function hiddenCardBodyY(baseThickness) {
  return groundSurfaceY(baseThickness) + HIDDEN_CARD_THICKNESS / 2
}

export function cardFaceY(hidden, baseThickness) {
  return hidden
    ? groundSurfaceY(baseThickness) + HIDDEN_CARD_THICKNESS + CARD_FACE_CLEARANCE
    : groundSurfaceY(baseThickness)
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
  body.material.color.setHex(hidden ? (blocked ? EDGE_COLORS.blocked : EDGE_COLORS[attribute] ?? EDGE_COLORS.neutral) : 0x262a36)
  body.material.needsUpdate = true
}

// Only hidden card artwork receives relief lighting. Front canvases and standing
// token overlays retain their original unlit, transparent presentation.
export function createCardFaceMaterial(texture, normalMap = null, options = {}, surfaceMap = null) {
  const common = {
    map: texture, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
    ...options,
  }
  if (!normalMap) return new THREE.MeshBasicMaterial(common)
  const material = new THREE.MeshStandardMaterial({
    ...common, normalMap, normalScale: new THREE.Vector2(1.3, 1.3),
    roughness: surfaceMap ? 1 : .82, metalness: surfaceMap ? 1 : .08,
    roughnessMap: surfaceMap, metalnessMap: surfaceMap, aoMap: surfaceMap, aoMapIntensity: .5,
    // Surface colour comes from the albedo and real light, without emissive fill.
    emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0,
  })
  return setSurfaceColor(material, material.color.clone(), 0xafb2a9)
}
