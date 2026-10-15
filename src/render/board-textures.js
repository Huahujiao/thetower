import * as THREE from 'three'
import floorAUrl from '../assets/board-floor-temple-a-v4.jpg'
import floorBUrl from '../assets/board-floor-temple-b-v4.jpg'
import floorCUrl from '../assets/board-floor-temple-c-v4.jpg'
import floorDUrl from '../assets/board-floor-temple-d-v4.jpg'
import cardBackUrl from '../assets/board-card-back-temple-v2.jpg'
import blockedBackUrl from '../assets/board-card-back-blocked-v1.jpg'
import scorchBackUrl from '../assets/board-card-back-scorch-temple-v2.jpg'
import witherBackUrl from '../assets/board-card-back-wither-temple-v2.jpg'
import drownBackUrl from '../assets/board-card-back-drown-temple-v2.jpg'

const SIZE = 512
// Display-only exposure: keep bare stone behind the illustrated card backs.
// Source artwork stays intact; the shared inset ornament is composited at runtime.
export const FLOOR_URLS = [floorAUrl, floorBUrl, floorCUrl, floorDUrl]
const NEUTRAL_BACK_BRIGHTNESS = 1
const BLOCKED_BACK_COLOR = '#363a40'
const BACK_URLS = { neutral: cardBackUrl, scorch: scorchBackUrl, wither: witherBackUrl, drown: drownBackUrl }

function drawFloorRim(ctx) {
  ctx.save()
  // Match the original inset ornament's 94%-sized plane on a full floor tile.
  ctx.translate(SIZE / 2, SIZE / 2)
  ctx.scale(.94, .94)
  ctx.translate(-SIZE / 2, -SIZE / 2)
  ctx.strokeStyle = '#b6a37a'
  ctx.globalAlpha = .7
  ctx.lineWidth = 3
  ctx.strokeRect(14, 14, 484, 484)
  for (const [x, y, rotation] of [[28,28,0],[484,28,Math.PI/2],[484,484,Math.PI],[28,484,-Math.PI/2]]) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rotation)
    ctx.beginPath()
    ctx.moveTo(0,45); ctx.lineTo(0,0); ctx.lineTo(45,0)
    ctx.moveTo(3,24); ctx.bezierCurveTo(24,22,9,9,24,3)
    ctx.moveTo(7,7); ctx.lineTo(16,7); ctx.lineTo(16,16); ctx.lineTo(7,16); ctx.closePath()
    ctx.stroke()
    ctx.restore()
  }
  ctx.restore()
}

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


// Every explored floor shares the same restrained inset border and corner ornament.
export class BoardTextures {
  constructor() {
    this.disposed = false
    this.floors = FLOOR_URLS.map(() => surface((ctx, image) => {
      ctx.fillStyle = '#253332'
      ctx.fillRect(0, 0, SIZE, SIZE)
      // Each generated image is one complete metre-scale slab.
      if (image) ctx.drawImage(image, 0, 0, SIZE, SIZE)
      drawFloorRim(ctx)
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
  return ((hash ^ (hash >>> 16)) >>> 0) % FLOOR_URLS.length
}
