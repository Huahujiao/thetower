import * as THREE from 'three'
import floorAtlasUrl from '../assets/board-floor-atlas-v1.jpg'
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

// Only the two dark cells of the existing atlas are floors. The colored wave
// cells remain unused so visual decoration cannot imply an active terrain rule.
export class BoardTextures {
  constructor() {
    this.disposed = false
    this.floors = [
      [14 / 1254, 12 / 1254, 608 / 1254, 608 / 1254],
      [642 / 1254, 642 / 1254, 598 / 1254, 598 / 1254],
    ].map(rect => surface((ctx, image) => {
      ctx.fillStyle = '#252824'
      ctx.fillRect(0, 0, SIZE, SIZE)
      if (image) {
        const [x, y, w, h] = rect
        ctx.drawImage(image, x * image.width, y * image.height, w * image.width, h * image.height, 0, 0, SIZE, SIZE)
      }
    }))
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
      this.load(floorAtlasUrl, this.floors),
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

  floor(position = null) {
    const index = position ? Math.abs(position.c * 13 + position.r * 7) % this.floors.length : 0
    return this.floors[index].texture
  }

  back(attribute, blocked) {
    return this.backs.get(`${BACK_URLS[attribute] ? attribute : 'neutral'}:${!!blocked}`).texture
  }

  dispose() {
    this.disposed = true
    for (const entry of [...this.floors, ...this.backs.values()]) entry.texture.dispose()
  }
}
