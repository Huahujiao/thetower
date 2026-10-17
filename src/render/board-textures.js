import * as THREE from 'three'
import floorAUrl from '../assets/board-runtime/floor-a-color.webp'
import floorBUrl from '../assets/board-runtime/floor-b-color.webp'
import floorCUrl from '../assets/board-runtime/floor-c-color.webp'
import floorDUrl from '../assets/board-runtime/floor-d-color.webp'
import cardBackUrl from '../assets/board-runtime/card-neutral-color.webp'
import blockedBackUrl from '../assets/board-runtime/card-blocked-color.webp'
import scorchBackUrl from '../assets/board-runtime/card-scorch-color.webp'
import witherBackUrl from '../assets/board-runtime/card-wither-color.webp'
import drownBackUrl from '../assets/board-runtime/card-drown-color.webp'

import neutralNormalUrl from '../assets/board-runtime/card-neutral-normal.png'
import scorchNormalUrl from '../assets/board-runtime/card-scorch-normal.png'
import witherNormalUrl from '../assets/board-runtime/card-wither-normal.png'
import drownNormalUrl from '../assets/board-runtime/card-drown-normal.png'
import blockedNormalUrl from '../assets/board-runtime/card-blocked-normal.png'

import neutralSurfaceUrl from '../assets/board-runtime/card-neutral-surface.png'
import scorchSurfaceUrl from '../assets/board-runtime/card-scorch-surface.png'
import witherSurfaceUrl from '../assets/board-runtime/card-wither-surface.png'
import drownSurfaceUrl from '../assets/board-runtime/card-drown-surface.png'
import blockedSurfaceUrl from '../assets/board-runtime/card-blocked-surface.png'
import flooraNormalUrl from '../assets/board-runtime/floor-a-normal.png'
import flooraSurfaceUrl from '../assets/board-runtime/floor-a-surface.png'
import floorbNormalUrl from '../assets/board-runtime/floor-b-normal.png'
import floorbSurfaceUrl from '../assets/board-runtime/floor-b-surface.png'
import floorcNormalUrl from '../assets/board-runtime/floor-c-normal.png'
import floorcSurfaceUrl from '../assets/board-runtime/floor-c-surface.png'
import floordNormalUrl from '../assets/board-runtime/floor-d-normal.png'
import floordSurfaceUrl from '../assets/board-runtime/floor-d-surface.png'

// Card tone lives in its own low-resolution layer, kept apart from the painted
// pattern so the scene can pick a different stain layout per tile.
import neutralWear0 from '../assets/board-runtime/card-neutral-wear0.png'
import neutralWear1 from '../assets/board-runtime/card-neutral-wear1.png'
import neutralWear2 from '../assets/board-runtime/card-neutral-wear2.png'
import scorchWear0 from '../assets/board-runtime/card-scorch-wear0.png'
import scorchWear1 from '../assets/board-runtime/card-scorch-wear1.png'
import scorchWear2 from '../assets/board-runtime/card-scorch-wear2.png'
import witherWear0 from '../assets/board-runtime/card-wither-wear0.png'
import witherWear1 from '../assets/board-runtime/card-wither-wear1.png'
import witherWear2 from '../assets/board-runtime/card-wither-wear2.png'
import drownWear0 from '../assets/board-runtime/card-drown-wear0.png'
import drownWear1 from '../assets/board-runtime/card-drown-wear1.png'
import drownWear2 from '../assets/board-runtime/card-drown-wear2.png'
import blockedWear0 from '../assets/board-runtime/card-blocked-wear0.png'
import blockedWear1 from '../assets/board-runtime/card-blocked-wear1.png'
import blockedWear2 from '../assets/board-runtime/card-blocked-wear2.png'

const BACK_SURFACE_URLS = {neutral:neutralSurfaceUrl,scorch:scorchSurfaceUrl,wither:witherSurfaceUrl,drown:drownSurfaceUrl,blocked:blockedSurfaceUrl}
const FLOOR_NORMAL_URLS = [flooraNormalUrl,floorbNormalUrl,floorcNormalUrl,floordNormalUrl]
const FLOOR_SURFACE_URLS = [flooraSurfaceUrl,floorbSurfaceUrl,floorcSurfaceUrl,floordSurfaceUrl]

const SIZE = 256
// Display-only exposure: keep bare stone behind the illustrated card backs.
// Source artwork stays intact; the shared inset ornament is composited at runtime.
export const FLOOR_URLS = [floorAUrl, floorBUrl, floorCUrl, floorDUrl]
const NEUTRAL_BACK_BRIGHTNESS = 1
const BLOCKED_BACK_COLOR = '#687574'
const BACK_PLACEHOLDER_COLORS = { neutral: '#8d9b91', scorch: '#b18d7a', wither: '#aaa789', drown: '#7d9ca0' }
const BACK_URLS = { neutral: cardBackUrl, scorch: scorchBackUrl, wither: witherBackUrl, drown: drownBackUrl }
const CARD_WEAR_URLS = {
  neutral: [neutralWear0, neutralWear1, neutralWear2],
  scorch: [scorchWear0, scorchWear1, scorchWear2],
  wither: [witherWear0, witherWear1, witherWear2],
  drown: [drownWear0, drownWear1, drownWear2],
  blocked: [blockedWear0, blockedWear1, blockedWear2],
}
export const CARD_WEAR_VARIANTS = CARD_WEAR_URLS.neutral.length
const BACK_NORMAL_URLS = { neutral: neutralNormalUrl, scorch: scorchNormalUrl, wither: witherNormalUrl, drown: drownNormalUrl, blocked: blockedNormalUrl }

function drawFloorRim(ctx) {
  ctx.save()
  ctx.scale(SIZE / 512, SIZE / 512)
  // Match the original inset ornament's 94%-sized plane on a full floor tile.
  ctx.translate(256, 256)
  ctx.scale(.94, .94)
  ctx.translate(-256, -256)
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

function surface(draw, colorSpace = THREE.SRGBColorSpace) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = colorSpace
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
      ctx.fillStyle = '#82988f'
      ctx.fillRect(0, 0, SIZE, SIZE)
      // Each generated image is one complete metre-scale slab.
      if (image) ctx.drawImage(image, 0, 0, SIZE, SIZE)
      drawFloorRim(ctx)
    }))
    this.floors.forEach((entry, index) => { entry.texture.userData.boardFloor = true; entry.texture.userData.floorVariant = index })
    this.backs = new Map()
    for (const attribute of Object.keys(BACK_URLS)) {
      this.backs.set(attribute, surface((ctx, image) => {
        ctx.fillStyle = BACK_PLACEHOLDER_COLORS[attribute]
        ctx.fillRect(0, 0, SIZE, SIZE)
        if (image) {
          if (attribute === 'neutral') ctx.filter = `brightness(${NEUTRAL_BACK_BRIGHTNESS})`
          ctx.drawImage(image, 0, 0, SIZE, SIZE)
          ctx.filter = 'none'
        }
      }))
    }
    for (const [attribute, entry] of this.backs) entry.texture.userData.cardBackKind = attribute
    // Tone variants are data, not colour: sampled as a multiplier.
    this.cardWear = new Map()
    const wearPending = []
    for (const [kind, urls] of Object.entries(CARD_WEAR_URLS)) {
      const list = urls.map((url) => {
        const entry = surface((ctx, image) => {
          ctx.fillStyle = '#808080'
          ctx.fillRect(0, 0, SIZE, SIZE)
          if (image) ctx.drawImage(image, 0, 0, SIZE, SIZE)
        }, THREE.NoColorSpace)
        entry.texture.userData.cardWearKind = kind
        wearPending.push(this.load(url, [entry]))
        return entry.texture
      })
      this.cardWear.set(kind, list)
    }
    this.blockedBack = surface((ctx, image) => {
      ctx.fillStyle = BLOCKED_BACK_COLOR
      ctx.fillRect(0, 0, SIZE, SIZE)
      if (image) ctx.drawImage(image, 0, 0, SIZE, SIZE)
    })
    this.blockedBack.texture.userData.cardBackKind = 'blocked'
    this.backNormals = new Map(Object.keys(BACK_NORMAL_URLS).map(kind => [kind, surface((ctx, image) => {
      // Tangent-space vectors are linear data; the unloaded fallback is flat +Z.
      ctx.fillStyle = '#8080ff'
      ctx.fillRect(0, 0, SIZE, SIZE)
      if (image) ctx.drawImage(image, 0, 0, SIZE, SIZE)
    }, THREE.NoColorSpace)]))
    const dataSurface = color => surface((ctx, image) => {
      ctx.fillStyle = color
      ctx.fillRect(0, 0, SIZE, SIZE)
      if (image) ctx.drawImage(image, 0, 0, SIZE, SIZE)
    }, THREE.NoColorSpace)
    this.backSurfaces = new Map(Object.keys(BACK_SURFACE_URLS).map(kind => [kind, dataSurface('#ffc200')]))
    this.floorNormals = FLOOR_NORMAL_URLS.map(() => dataSurface('#8080ff'))
    this.floorSurfaces = FLOOR_SURFACE_URLS.map(() => dataSurface('#ffb300'))
    this.ready = Promise.all([
      ...wearPending,
      ...Object.entries(BACK_SURFACE_URLS).map(([kind, url]) => this.load(url, [this.backSurfaces.get(kind)])),
      ...FLOOR_NORMAL_URLS.map((url, index) => this.load(url, [this.floorNormals[index]])),
      ...FLOOR_SURFACE_URLS.map((url, index) => this.load(url, [this.floorSurfaces[index]])),
      ...FLOOR_URLS.map((url, index) => this.load(url, [this.floors[index]])),
      ...Object.entries(BACK_URLS).map(([attribute, url]) => this.load(url, [
        this.backs.get(attribute),
      ])),
      this.load(blockedBackUrl, [this.blockedBack]),
      ...Object.entries(BACK_NORMAL_URLS).map(([kind, url]) => this.load(url, [this.backNormals.get(kind)])),
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

  backNormal(texture) {
    // The primitive kind tag survives Texture.clone() for queued flip snapshots.
    return this.backNormals.get(texture?.userData.cardBackKind)?.texture || null
  }

  // Wear is a greyscale multiplier encoded so byte 128 means "no change".
  wear(texture, variant = 0) {
    const kind = texture?.userData?.cardBackKind
    const list = this.cardWear.get(kind ? kind : 'neutral')
    if (!list) return null
    return list[Math.abs(Math.trunc(variant)) % list.length]
  }

  surfaceData(texture) {
    if (texture?.userData.boardFloor) {
      const index = texture.userData.floorVariant ?? 0
      return { normal: this.floorNormals[index].texture, surface: this.floorSurfaces[index].texture }
    }
    return { normal: this.backNormal(texture), surface: this.backSurfaces.get(texture?.userData.cardBackKind)?.texture || null }
  }

  dispose() {
    this.disposed = true
    for (const entry of [...this.floors, ...this.backs.values(), this.blockedBack, ...this.backNormals.values(), ...this.backSurfaces.values(), ...this.floorNormals, ...this.floorSurfaces]) entry.texture.dispose()
    for (const texture of [...this.cardWear.values()].flat()) texture.dispose()
  }
}

export function floorTextureIndex(position) {
  // Coordinate hash: stable through flips/moves and independent of gameplay RNG.
  let hash = Math.imul(position.c + 1, 374761393) ^ Math.imul(position.r + 1, 668265263)
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177)
  return ((hash ^ (hash >>> 16)) >>> 0) % FLOOR_URLS.length
}
