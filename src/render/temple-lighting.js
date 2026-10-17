import * as THREE from 'three'
import { setSurfaceColor } from './surface-color.js'

// Room-local: the sun and its target follow board panning together.
// The rig used to flood the room with ambient plus hemisphere fill, which
// washed the painted albedo out to the same grey everywhere and left the whole
// frame in one narrow value band. Most of that fill is now carried by the IBL,
// so the key can stay the only thing modelling form and the painted surfaces
// keep their own colour.
export const TEMPLE_LIGHTING = Object.freeze({
  keyPosition: Object.freeze([-4, 8, -7]),
  keyColor: 0xf6ecdb, keyIntensity: 2.35,
  ambientColor: 0xd8ded5, ambientIntensity: .34,
  skyColor: 0xa8c4cf, groundColor: 0x4d5850, skyIntensity: .46,
  fillPosition: Object.freeze([4, 5, 6]), fillColor: 0xa8c2cc, fillIntensity: .16,
})

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
  return setSurfaceColor(material, material.color.clone(), 0xc0d4db)
}

// Stone keeps the directional glint without reflecting the entire cloudy sky
// at the same strength as the architectural fill. One shared PMREM, no extra map.
export function applyTempleGroundEnvironment(material, scene) {
  if (!scene?.environment || !material.userData.templeGround) return material
  const changed = material.envMap !== scene.environment
  material.envMap = scene.environment
  material.envMapIntensity = scene.environmentIntensity * .22
  material.envMapRotation.copy(scene.environmentRotation)
  if (changed) material.needsUpdate = true
  return material
}
