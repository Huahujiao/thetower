import * as THREE from 'three'

export const HIDDEN_CARD_THICKNESS = 0.18
export const HIDDEN_CARD_SCALE = 0.95
const EDGE_COLORS = { neutral: 0xb2a58d, scorch: 0xa66b50, wither: 0xafa16e, drown: 0x819eb2 }

export function cardBodyGeometry(size, thickness) {
  const geometry = new THREE.BoxGeometry(size, thickness, size)
  const uv = geometry.attributes.uv
  // Reuse the generated artwork's narrow outer band, not its central emblem.
  for (let i = 0; i < uv.count; i++) uv.setY(i, 0.035 + uv.getY(i) * 0.055)
  return geometry
}

export function styleCardBody(body, { hidden, attribute, texture, baseThickness }) {
  body.scale.set(hidden ? HIDDEN_CARD_SCALE : 1, hidden ? HIDDEN_CARD_THICKNESS / baseThickness : 1, hidden ? HIDDEN_CARD_SCALE : 1)
  body.userData.baseY = hidden ? (HIDDEN_CARD_THICKNESS - baseThickness) / 2 : 0
  body.position.y = body.userData.baseY
  body.material.map = hidden ? texture : null
  body.material.color.setHex(hidden ? EDGE_COLORS[attribute] ?? EDGE_COLORS.neutral : 0x262a36)
  body.material.needsUpdate = true
}
