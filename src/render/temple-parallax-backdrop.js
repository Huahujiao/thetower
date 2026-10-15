import * as THREE from 'three'
import farUrl from '../assets/environment/temple-mountains-v1.jpg'
import middleUrl from '../assets/environment/temple-parallax-peaks-v2.webp'
import cloudsUrl from '../assets/environment/temple-parallax-clouds-v1.webp'

export class TempleParallaxBackdrop {
  constructor(container) {
    this.container = container
    this.element = document.createElement('div')
    this.element.className = 'temple-backdrop temple-parallax-backdrop'
    this.element.setAttribute('aria-hidden', 'true')
    // Tighten only the mountain silhouette alpha. Rock interiors stay opaque;
    // clouds retain their own unmodified soft alpha on a separate layer.
    const definitions = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    definitions.setAttribute('width', '0')
    definitions.setAttribute('height', '0')
    definitions.style.position = 'absolute'
    definitions.innerHTML = '<defs><filter id="temple-solid-rock-alpha" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncA type="table" tableValues="0 0 0 0 1 1 1 1 1"/></feComponentTransfer></filter></defs>'
    this.element.appendChild(definitions)
    this.layers = [
      { name: 'far', url: farUrl, strength: .055, zoomStrength: .025 },
      { name: 'middle', url: middleUrl, strength: .20, zoomStrength: .09 },
      { name: 'clouds', url: cloudsUrl, strength: .34, zoomStrength: .14 },
    ].map(layer => {
      const element = document.createElement('div')
      element.className = 'temple-parallax-layer temple-parallax-' + layer.name
      element.style.backgroundImage = 'url("' + layer.url + '")'
      this.element.appendChild(element)
      return { ...layer, element }
    })
    const shade = document.createElement('div')
    shade.className = 'temple-parallax-shade'
    this.element.appendChild(shade)
    container.prepend(this.element)
    this.point = new THREE.Vector3()
    this.reference = null
  }

  update(seconds, still, camera, platform) {
    if (!camera || !platform) return
    camera.updateMatrixWorld()
    platform.group.updateWorldMatrix(true, false)
    this.point.set(0, 0, 0).applyMatrix4(platform.group.matrixWorld).project(camera)
    const distance = camera.position.length()
    if (!this.reference) this.reference = { x: this.point.x, y: this.point.y, distance }
    const reference = this.reference
    const width = this.container.clientWidth, height = this.container.clientHeight
    // Use the board's actual projection once. Separate mouse and yaw offsets
    // used to fight the scene's pan-driven orbit, especially on direction changes.
    const x = (this.point.x - reference.x) * width / 2
    const y = (reference.y - this.point.y) * height / 2
    const zoom = reference.distance / Math.max(distance, .01)
    for (const layer of this.layers) {
      const drift = !still && layer.name === 'clouds' ? Math.sin(seconds * .012) * 12 : 0
      const dx = THREE.MathUtils.clamp(x * layer.strength, -width * .09, width * .09)
      const dy = THREE.MathUtils.clamp(y * layer.strength, -height * .09, height * .09)
      const scale = 1.05 + THREE.MathUtils.clamp((zoom - 1) * layer.zoomStrength, -.035, .15)
      layer.element.style.transform = 'translate3d(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px,0) scale(' + scale.toFixed(4) + ')'
      // Autonomous cloud drift belongs to the image, not the camera transform.
      if (layer.name === 'clouds') layer.element.style.backgroundPosition = 'calc(50% + ' + drift.toFixed(2) + 'px) 74%'
      layer.element.dataset.offsetX = dx.toFixed(3)
      layer.element.dataset.offsetY = dy.toFixed(3)
    }
  }

  dispose() { this.element.remove() }
}
