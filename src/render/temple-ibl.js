import * as THREE from 'three'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { applyTempleGroundEnvironment } from './temple-lighting.js'
import skyUrl from '../assets/environment/kloofendal-overcast-puresky-128.hdr?url'

export const TEMPLE_IBL = Object.freeze({
  localUrl: skyUrl,
  intensity: .30,
  // Align the source sky glow (~29 degrees azimuth) with the tree-side sun.
  rotationY: 149 * Math.PI / 180,
})

// Created once for the renderer, independent of procedural room rebuilds.
// Keep the old fill until HDR + PMREM are ready, including failed/offline loads.
export function loadTempleIBL(renderer, scene, rig, {
  loader = new HDRLoader(), createPMREM = () => new THREE.PMREMGenerator(renderer),
} = {}) {
  let disposed = false, target = null
  const previous = { environment: scene.environment, intensity: scene.environmentIntensity, rotation: scene.environmentRotation.clone() }
  const fill = rig.children.filter(light => light.userData.iblFill)
  const fillIntensities = fill.map(light => light.intensity)
  const ready = (async () => {
    let hdr
    for (const url of [TEMPLE_IBL.localUrl]) {
      try { hdr = await loader.loadAsync(url); break } catch { if (disposed) return false }
    }
    if (!hdr) { console.warn('Temple IBL unavailable; retaining global fill. Check the bundled HDR asset.'); return false }
    let pmrem
    try {
      if (disposed) return false
      hdr.mapping = THREE.EquirectangularReflectionMapping
      pmrem = createPMREM()
      target = pmrem.fromEquirectangular(hdr)
      scene.environment = target.texture
      scene.environmentIntensity = TEMPLE_IBL.intensity
      scene.environmentRotation.set(0, TEMPLE_IBL.rotationY, 0)
      fill.forEach(light => { light.intensity = 0 })
      scene.traverse(object => {
        for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
          if (material?.userData.templeGround) applyTempleGroundEnvironment(material, scene)
        }
      })
      return true
    } catch (error) {
      target?.dispose(); target = null
      console.warn('Temple IBL preparation failed; retaining global fill.', error)
      return false
    } finally { hdr.dispose(); pmrem?.dispose() }
  })()
  return { ready, dispose() {
    if (disposed) return
    disposed = true
    if (target && scene.environment === target.texture) {
      scene.traverse(object => {
        for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
          if (material?.userData.templeGround && material.envMap === target.texture) {
            material.envMap = null
            material.needsUpdate = true
          }
        }
      })
      scene.environment = previous.environment
      scene.environmentIntensity = previous.intensity
      scene.environmentRotation.copy(previous.rotation)
      fill.forEach((light, index) => { light.intensity = fillIntensities[index] })
    }
    target?.dispose(); target = null
  } }
}
