import * as THREE from 'three'
import { setSurfaceColor } from './surface-color.js'

// Room-local: the sun and its target follow board panning together.
// The key models form; sky and ground bounce keep shaded stone readable.
export const TEMPLE_LIGHTING = Object.freeze({
  keyPosition: Object.freeze([-4, 8, -7]),
  keyColor: 0xf6ecdb, keyIntensity: 3.2,
  ambientColor: 0xaebec2, ambientIntensity: .24,
  skyColor: 0x9fb8c0, groundColor: 0x4f5c57, skyIntensity: .48,
  fillPosition: Object.freeze([4, 5, 6]), fillColor: 0x8fa9b4, fillIntensity: .28,
})

// Paving and architecture share the same sky, with only a small ground lift.
export const TEMPLE_GROUND_ENV_FACTOR = 1.1

export function addTempleLighting(parent) {
  const rig = new THREE.Group()
  rig.name = 'temple-lighting'
  // An omnidirectional floor preserves detail on sun-facing and back-facing
  // stone alike. Keep the sun stronger so the volume and cast shadows remain.
  const ambient = new THREE.AmbientLight(TEMPLE_LIGHTING.ambientColor, TEMPLE_LIGHTING.ambientIntensity)
  ambient.name = 'temple-ambient-light'
  const sky = new THREE.HemisphereLight(TEMPLE_LIGHTING.skyColor, TEMPLE_LIGHTING.groundColor, TEMPLE_LIGHTING.skyIntensity)
  const key = new THREE.DirectionalLight(TEMPLE_LIGHTING.keyColor, TEMPLE_LIGHTING.keyIntensity)
  key.name = 'temple-key-light'
  key.position.set(...TEMPLE_LIGHTING.keyPosition)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: .1, far: 40 })
  key.shadow.normalBias = .008
  key.shadow.bias = -.00012
  key.shadow.camera.updateProjectionMatrix()
  const fill = new THREE.DirectionalLight(TEMPLE_LIGHTING.fillColor, TEMPLE_LIGHTING.fillIntensity)
  fill.position.set(...TEMPLE_LIGHTING.fillPosition)
  for (const light of [ambient, sky, fill]) light.userData.iblFill = true
  rig.add(ambient, sky, key, key.target, fill, fill.target)
  parent.add(rig)
  return rig
}

export function createTempleGroundMaterial(texture, options = {}, maps = {}) {
  const material = new THREE.MeshPhysicalMaterial({
    map: texture, normalMap: maps.normal || null, normalScale: new THREE.Vector2(.8, .8),
    roughnessMap: maps.surface || null, aoMap: maps.surface || null, aoMapIntensity: .6,
    roughness: maps.surface ? 1 : .34, metalness: 0,
    clearcoat: 0, specularIntensity: .32,
    side: THREE.DoubleSide,
    ...options,
  })
  material.userData.templeGround = true
  // A nearly neutral cool tint keeps the paving charcoal under the warm key light.
  return setSurfaceColor(material, material.color.clone(), 0xdddfe0)
}

// Stone keeps the directional glint without reflecting the entire cloudy sky
// at the same strength as the architectural fill. One shared PMREM, no extra map.
export function applyTempleGroundEnvironment(material, scene) {
  if (!scene?.environment || !material.userData.templeGround) return material
  const changed = material.envMap !== scene.environment
  material.envMap = scene.environment
  material.envMapIntensity = scene.environmentIntensity * TEMPLE_GROUND_ENV_FACTOR
  material.envMapRotation.copy(scene.environmentRotation)
  if (changed) material.needsUpdate = true
  return material
}
