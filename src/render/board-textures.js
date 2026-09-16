import * as THREE from 'three'
import floorUrl from '../assets/board-floor-plain-v1.jpg'
import cardBackUrl from '../assets/board-card-back-v1.jpg'
import scorchBackUrl from '../assets/board-card-back-scorch-v1.jpg'
import witherBackUrl from '../assets/board-card-back-wither-v1.jpg'
import drownBackUrl from '../assets/board-card-back-drown-v1.jpg'

const SIZE = 512
const BACK_URLS = { neutral: cardBackUrl, scorch: scorchBackUrl, wither: witherBackUrl, drown: drownBackUrl }

function surface(draw) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.userData.boardShared = true
  const repaint = image => {
    const ctx = canvas.getContext('2d')
    ctx.save()
    draw(ctx, image)
    ctx.restore()
    texture.needsUpdate = true
  }
  repaint(null)
  return { texture, repaint }
}

// Plain stone identifies explored ground; ornate artwork is reserved for cards.
export class BoardTextures {
  constructor() {
    this.disposed = false
    this.floors = [surface((ctx, image) => {
      ctx.fillStyle = '#827e73'
      ctx.fillRect(0, 0, SIZE, SIZE)
      if (image) {
        ctx.drawImage(image, 0, 0, SIZE, SIZE)
      }
    })]
    this.backs = new Map()
    for (const attribute of Object.keys(BACK_URLS)) {
      for (const blocked of [false, true]) {
        this.backs.set(`${attribute}:${blocked}`, surface((ctx, image) => {
          ctx.fillStyle = '#49463f'
          ctx.fillRect(0, 0, SIZE, SIZE)
          if (image) ctx.drawImage(image, 0, 0, SIZE, SIZE)
          if (blocked) {
            ctx.fillStyle = 'rgba(8, 12, 15, 0.28)'
            ctx.fillRect(0, 0, SIZE, SIZE)
          }
        }))
      }
    }
    this.ready = Promise.all([
      this.load(floorUrl, this.floors),
      ...Object.entries(BACK_URLS).map(([attribute, url]) => this.load(url, [
        this.backs.get(`${attribute}:false`), this.backs.get(`${attribute}:true`),
      ])),
    ])
  }

  load(url, surfaces) {
    return new Promise(resolve => {
      const image = document.createElement('img')
      image.onload = () => {
        if (!this.disposed) surfaces.forEach(entry => entry.repaint(image))
        resolve(true)
      }
      image.onerror = () => { console.warn('Board texture failed to load:', url); resolve(false) }
      image.src = url
    })
  }

  floor() {
    return this.floors[0].texture
  }

  back(attribute, blocked) {
    return this.backs.get(`${BACK_URLS[attribute] ? attribute : 'neutral'}:${!!blocked}`).texture
  }

  dispose() {
    this.disposed = true
    for (const entry of [...this.floors, ...this.backs.values()]) entry.texture.dispose()
  }
}
