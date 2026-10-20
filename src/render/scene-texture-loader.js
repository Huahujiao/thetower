import * as THREE from 'three'

// Keep the texture identity stable while its tracked image arrives.
export function loadSceneTexture(url, assets, { defer = false, onLoad } = {}) {
  if (!assets) return new THREE.TextureLoader().load(url, onLoad)
  const texture = new THREE.Texture()
  let disposed = false, started = false, settle
  texture.addEventListener('dispose', () => { disposed = true })
  texture.userData.ready = new Promise(resolve => { settle = resolve })
  texture.userData.startLoading = () => {
    if (started) return
    started = true
    assets.image(url).then(image => {
      if (!disposed) { texture.image = image; texture.needsUpdate = true; onLoad?.(texture) }
      settle(true)
    }, error => { if (!assets.closed) console.warn('Scene texture unavailable:', url, error); settle(false) })
  }
  if (!defer) texture.userData.startLoading()
  return texture
}
