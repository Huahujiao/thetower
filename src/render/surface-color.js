import * as THREE from 'three'

// Keep the material's art direction when reachability/selection updates its tint.
export function setSurfaceColor(material, color, baseTint = material.userData.surfaceTint) {
  material.color.set(color)
  if (baseTint !== undefined) {
    material.userData.surfaceTint = baseTint
    material.color.multiply(new THREE.Color(baseTint))
  }
  return material
}
