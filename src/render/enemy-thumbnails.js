import { Box3, DirectionalLight, DoubleSide, HemisphereLight, Mesh, MeshBasicMaterial, OrthographicCamera, Scene, SRGBColorSpace, TextureLoader, Vector3, WebGLRenderer } from 'three'
import { evaluateShadowProject } from '../animation/shadow-rig.js'
import { shadowPartGeometry } from '../animation/shadow-geometry.js'
import { shadowTextureGeometry } from '../animation/shadow-texture-geometry.js'
import { applyTextureBacking } from './texture-backing.js'

// One temporary WebGL context renders the whole list, then releases its GPU
// resources. The gallery keeps ordinary images rather than 34 live stages.
export function createEnemyThumbnailRenderer() {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(1)
  renderer.setSize(300, 360)
  const scene = new Scene()
  scene.add(new HemisphereLight('#e8f2ff', '#46515d', 1.2))
  const light = new DirectionalLight('#ffe5c4', 1.2)
  light.position.set(-200, 350, 500)
  scene.add(light)
  const camera = new OrthographicCamera(-150, 150, 180, -180, .1, 5000)
  const loader = new TextureLoader(), textures = new Map()
  let disposed = false
  function loadTexture(url) {
    if (!textures.has(url)) textures.set(url, loader.loadAsync(url).then(texture => {
      texture.colorSpace = SRGBColorSpace
      if (disposed) texture.dispose()
      return texture
    }))
    return textures.get(url)
  }
  return {
    async render(project) {
      const pose = evaluateShadowProject(project)
      const urls = new Set(pose.parts.flatMap(({ part }) => [part.visual.texture, part.visual.skinTexture].filter(Boolean)))
      const loaded = new Map(await Promise.all([...urls].map(async url => [url, await loadTexture(url)])))
      if (disposed) return null
      const meshes = [], bounds = new Box3()
      try {
        for (const entry of pose.parts) {
          if (entry.opacity <= .01) continue
          const part = entry.part, texture = loaded.get(part.visual.texture)
          const geometry = texture ? shadowTextureGeometry(part, texture) : shadowPartGeometry(part)
          const material = new MeshBasicMaterial({ color: texture ? '#ffffff' : part.fill, map: texture || null,
            side: DoubleSide, transparent: true, opacity: entry.opacity, alphaTest: .02 })
          applyTextureBacking(material, part.visual.backingColor, loaded.get(part.visual.skinTexture))
          const mesh = new Mesh(geometry, material)
          mesh.matrixAutoUpdate = false
          mesh.matrix.copy(entry.matrix)
          mesh.renderOrder = 10 + entry.order
          scene.add(mesh); meshes.push(mesh)
          geometry.computeBoundingBox()
          bounds.union(geometry.boundingBox.clone().applyMatrix4(entry.matrix))
        }
        const center = bounds.getCenter(new Vector3()), size = bounds.getSize(new Vector3())
        const halfHeight = Math.max(size.y, size.x * 360 / 300, 1) * .57
        camera.left = -halfHeight * 300 / 360; camera.right = -camera.left
        camera.top = halfHeight; camera.bottom = -halfHeight
        camera.position.set(center.x, center.y, bounds.max.z + 1000)
        camera.lookAt(center); camera.updateProjectionMatrix()
        renderer.render(scene, camera)
        return renderer.domElement.toDataURL('image/webp', .9)
      } finally {
        for (const mesh of meshes) { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose() }
        for (const [url, texture] of loaded) { texture.dispose(); textures.delete(url) }
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const pending of textures.values()) pending.then(texture => texture.dispose(), () => {})
      textures.clear()
      renderer.dispose(); renderer.forceContextLoss()
    },
  }
}
