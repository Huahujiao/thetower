import * as THREE from 'three'
import floorAUrl from '../assets/board-floor-dungeon-a-v1.jpg'
import floorBUrl from '../assets/board-floor-dungeon-b-v1.jpg'
import floorCUrl from '../assets/board-floor-dungeon-c-v1.jpg'
import floorDUrl from '../assets/board-floor-dungeon-d-v1.jpg'
import cardBackUrl from '../assets/board-card-back-v1.jpg'
import blockedBackUrl from '../assets/board-card-back-blocked-v1.jpg'
import scorchBackUrl from '../assets/board-card-back-scorch-v1.jpg'
import witherBackUrl from '../assets/board-card-back-wither-v1.jpg'
import drownBackUrl from '../assets/board-card-back-drown-v1.jpg'

const SIZE = 512
// Display-only exposure: keep bare stone behind the illustrated card backs.
// Source artwork stays intact; no painted symbols or opaque color washes.
export const FLOOR_URLS = [floorAUrl, floorBUrl, floorCUrl, floorDUrl]
const NEUTRAL_BACK_BRIGHTNESS = 1.3
const BLOCKED_BACK_COLOR = '#363a40'
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

// Cool dark flagstones identify explored ground; ornate artwork is reserved for cards.
export class BoardTextures {
  constructor() {
    this.disposed = false
    this.floors = FLOOR_URLS.map(() => surface((ctx, image) => {
      ctx.fillStyle = '#253332'
      ctx.fillRect(0, 0, SIZE, SIZE)
      if (image) {
        ctx.drawImage(image, 0, 0, SIZE, SIZE)
      }
    }))
    this.backs = new Map()
    for (const attribute of Object.keys(BACK_URLS)) {
      this.backs.set(attribute, surface((ctx, image) => {
        ctx.fillStyle = attribute === 'neutral' ? '#5f5b52' : '#49463f'
        ctx.fillRect(0, 0, SIZE, SIZE)
        if (image) {
          if (attribute === 'neutral') ctx.filter = `brightness(${NEUTRAL_BACK_BRIGHTNESS})`
          ctx.drawImage(image, 0, 0, SIZE, SIZE)
          ctx.filter = 'none'
        }
      }))
    }
    this.blockedBack = surface((ctx, image) => {
      ctx.fillStyle = BLOCKED_BACK_COLOR
      ctx.fillRect(0, 0, SIZE, SIZE)
      if (image) ctx.drawImage(image, 0, 0, SIZE, SIZE)
    })
    this.ready = Promise.all([
      ...FLOOR_URLS.map((url, index) => this.load(url, [this.floors[index]])),
      ...Object.entries(BACK_URLS).map(([attribute, url]) => this.load(url, [
        this.backs.get(attribute),
      ])),
      this.load(blockedBackUrl, [this.blockedBack]),
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
    if (!position) return this.floors[0].texture
    return this.floors[floorTextureIndex(position)].texture
  }

  back(attribute, blocked) {
    if (blocked) return this.blockedBack.texture
    return this.backs.get(BACK_URLS[attribute] ? attribute : 'neutral').texture
  }

  dispose() {
    this.disposed = true
    for (const entry of [...this.floors, ...this.backs.values(), this.blockedBack]) entry.texture.dispose()
  }
}

export function floorTextureIndex(position) {
  // Coordinate hash: stable through flips/moves and independent of gameplay RNG.
  let hash = Math.imul(position.c + 1, 374761393) ^ Math.imul(position.r + 1, 668265263)
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177)
  const bucket = ((hash ^ (hash >>> 16)) >>> 0) % 10
  return bucket < 5 ? 0 : bucket < 7 ? 1 : bucket < 9 ? 2 : 3
}
