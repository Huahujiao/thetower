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

// Three low-resolution linear pigment multipliers vary hue/chroma, independent
// of the ornament. Every pattern can carry every colour impression.
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

import neutralVariant1color from '../assets/board-runtime/card-neutral-variant1-color.webp'
import neutralVariant1normal from '../assets/board-runtime/card-neutral-variant1-normal.png'
import neutralVariant1surface from '../assets/board-runtime/card-neutral-variant1-surface.png'
import neutralVariant2color from '../assets/board-runtime/card-neutral-variant2-color.webp'
import neutralVariant2normal from '../assets/board-runtime/card-neutral-variant2-normal.png'
import neutralVariant2surface from '../assets/board-runtime/card-neutral-variant2-surface.png'
import neutralVariant3color from '../assets/board-runtime/card-neutral-variant3-color.webp'
import neutralVariant3normal from '../assets/board-runtime/card-neutral-variant3-normal.png'
import neutralVariant3surface from '../assets/board-runtime/card-neutral-variant3-surface.png'
import scorchVariant1color from '../assets/board-runtime/card-scorch-variant1-color.webp'
import scorchVariant1normal from '../assets/board-runtime/card-scorch-variant1-normal.png'
import scorchVariant1surface from '../assets/board-runtime/card-scorch-variant1-surface.png'
import scorchVariant2color from '../assets/board-runtime/card-scorch-variant2-color.webp'
import scorchVariant2normal from '../assets/board-runtime/card-scorch-variant2-normal.png'
import scorchVariant2surface from '../assets/board-runtime/card-scorch-variant2-surface.png'
import scorchVariant3color from '../assets/board-runtime/card-scorch-variant3-color.webp'
import scorchVariant3normal from '../assets/board-runtime/card-scorch-variant3-normal.png'
import scorchVariant3surface from '../assets/board-runtime/card-scorch-variant3-surface.png'
import witherVariant1color from '../assets/board-runtime/card-wither-variant1-color.webp'
import witherVariant1normal from '../assets/board-runtime/card-wither-variant1-normal.png'
import witherVariant1surface from '../assets/board-runtime/card-wither-variant1-surface.png'
import witherVariant2color from '../assets/board-runtime/card-wither-variant2-color.webp'
import witherVariant2normal from '../assets/board-runtime/card-wither-variant2-normal.png'
import witherVariant2surface from '../assets/board-runtime/card-wither-variant2-surface.png'
import witherVariant3color from '../assets/board-runtime/card-wither-variant3-color.webp'
import witherVariant3normal from '../assets/board-runtime/card-wither-variant3-normal.png'
import witherVariant3surface from '../assets/board-runtime/card-wither-variant3-surface.png'
import drownVariant1color from '../assets/board-runtime/card-drown-variant1-color.webp'
import drownVariant1normal from '../assets/board-runtime/card-drown-variant1-normal.png'
import drownVariant1surface from '../assets/board-runtime/card-drown-variant1-surface.png'
import drownVariant2color from '../assets/board-runtime/card-drown-variant2-color.webp'
import drownVariant2normal from '../assets/board-runtime/card-drown-variant2-normal.png'
import drownVariant2surface from '../assets/board-runtime/card-drown-variant2-surface.png'
import drownVariant3color from '../assets/board-runtime/card-drown-variant3-color.webp'
import drownVariant3normal from '../assets/board-runtime/card-drown-variant3-normal.png'
import drownVariant3surface from '../assets/board-runtime/card-drown-variant3-surface.png'

const BACK_VARIANT_ASSETS = {
  neutral: [{ color: neutralVariant1color, normal: neutralVariant1normal, surface: neutralVariant1surface }, { color: neutralVariant2color, normal: neutralVariant2normal, surface: neutralVariant2surface }, { color: neutralVariant3color, normal: neutralVariant3normal, surface: neutralVariant3surface }],
  scorch: [{ color: scorchVariant1color, normal: scorchVariant1normal, surface: scorchVariant1surface }, { color: scorchVariant2color, normal: scorchVariant2normal, surface: scorchVariant2surface }, { color: scorchVariant3color, normal: scorchVariant3normal, surface: scorchVariant3surface }],
  wither: [{ color: witherVariant1color, normal: witherVariant1normal, surface: witherVariant1surface }, { color: witherVariant2color, normal: witherVariant2normal, surface: witherVariant2surface }, { color: witherVariant3color, normal: witherVariant3normal, surface: witherVariant3surface }],
  drown: [{ color: drownVariant1color, normal: drownVariant1normal, surface: drownVariant1surface }, { color: drownVariant2color, normal: drownVariant2normal, surface: drownVariant2surface }, { color: drownVariant3color, normal: drownVariant3normal, surface: drownVariant3surface }],
}
const backKey = (kind, variant = 0) => variant ? `${kind}:${variant}` : kind

const BACK_SURFACE_URLS = {neutral:neutralSurfaceUrl,scorch:scorchSurfaceUrl,wither:witherSurfaceUrl,drown:drownSurfaceUrl,blocked:blockedSurfaceUrl}
const FLOOR_NORMAL_URLS = [flooraNormalUrl,floorbNormalUrl,floorcNormalUrl,floordNormalUrl]
const FLOOR_SURFACE_URLS = [flooraSurfaceUrl,floorbSurfaceUrl,floorcSurfaceUrl,floordSurfaceUrl]

const SIZE = 256
// Display-only exposure: keep bare stone behind the illustrated card backs.
// Source artwork stays intact; the shared inset ornament is composited at runtime.
export const FLOOR_URLS = [floorAUrl, floorBUrl, floorCUrl, floorDUrl]
const NEUTRAL_BACK_BRIGHTNESS = .96
const BLOCKED_BACK_COLOR = '#343b3d'
const BACK_PLACEHOLDER_COLORS = { neutral: '#8d9b91', scorch: '#793b3b', wither: '#847a24', drown: '#36567b' }
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
  constructor({ assets = null, defer = false } = {}) {
    this.assets = assets
    this.deferred = defer
    this.pendingLoads = []
    this.disposed = false
    this.floors = FLOOR_URLS.map(() => surface((ctx, image) => {
      ctx.fillStyle = '#353f40'
      ctx.fillRect(0, 0, SIZE, SIZE)
      // Each generated image is one complete metre-scale slab.
      if (image) ctx.drawImage(image, 0, 0, SIZE, SIZE)
      drawFloorRim(ctx)
    }))
    this.floors.forEach((entry, index) => { entry.texture.userData.boardFloor = true; entry.texture.userData.floorVariant = index })
    this.backs = new Map()
    this.backVariants = new Map()
    this.backNormals = new Map()
    this.backSurfaces = new Map()
    const backPending = []
    for (const [kind, color] of Object.entries({ ...BACK_URLS, blocked: blockedBackUrl })) {
      const assets = [{ color, normal: BACK_NORMAL_URLS[kind], surface: BACK_SURFACE_URLS[kind] }, ...(BACK_VARIANT_ASSETS[kind] || [])]
      const entries = assets.map((maps, variant) => {
        const entry = surface((ctx, image) => {
          ctx.fillStyle = kind === 'blocked' ? BLOCKED_BACK_COLOR : BACK_PLACEHOLDER_COLORS[kind]
          ctx.fillRect(0, 0, SIZE, SIZE)
          if (image) {
            if (kind === 'neutral') ctx.filter = `brightness(${NEUTRAL_BACK_BRIGHTNESS})`
            ctx.drawImage(image, 0, 0, SIZE, SIZE)
            ctx.filter = 'none'
          }
        })
        Object.assign(entry.texture.userData, { cardBackKind: kind, cardBackVariant: variant })
        const normal = surface((ctx, image) => {
          ctx.fillStyle = '#8080ff'
          ctx.fillRect(0, 0, SIZE, SIZE)
          if (image) ctx.drawImage(image, 0, 0, SIZE, SIZE)
        }, THREE.NoColorSpace)
        const packed = surface((ctx, image) => {
          ctx.fillStyle = '#ffc200'
          ctx.fillRect(0, 0, SIZE, SIZE)
          if (image) ctx.drawImage(image, 0, 0, SIZE, SIZE)
        }, THREE.NoColorSpace)
        this.backNormals.set(backKey(kind, variant), normal)
        this.backSurfaces.set(backKey(kind, variant), packed)
        backPending.push(this.load(maps.color, [entry]), this.load(maps.normal, [normal]), this.load(maps.surface, [packed]))
        return entry
      })
      this.backVariants.set(kind, entries)
      if (kind === 'blocked') this.blockedBack = entries[0]
      else this.backs.set(kind, entries[0])
    }
    // Pigment variants are linear RGB multipliers, not sRGB colour textures.
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
    const dataSurface = color => surface((ctx, image) => {
      ctx.fillStyle = color
      ctx.fillRect(0, 0, SIZE, SIZE)
      if (image) ctx.drawImage(image, 0, 0, SIZE, SIZE)
    }, THREE.NoColorSpace)
    this.floorNormals = FLOOR_NORMAL_URLS.map(() => dataSurface('#8080ff'))
    this.floorSurfaces = FLOOR_SURFACE_URLS.map(() => dataSurface('#ffb300'))
    this.ready = Promise.all([
      ...backPending, ...wearPending,
      ...FLOOR_NORMAL_URLS.map((url, index) => this.load(url, [this.floorNormals[index]])),
      ...FLOOR_SURFACE_URLS.map((url, index) => this.load(url, [this.floorSurfaces[index]])),
      ...FLOOR_URLS.map((url, index) => this.load(url, [this.floors[index]])),
    ])
  }

  startLoading() {
    this.deferred = false
    for (const start of this.pendingLoads.splice(0)) start()
  }

  load(url, surfaces) {
    if (this.deferred) return new Promise(resolve => this.pendingLoads.push(() => resolve(this.load(url, surfaces))))
    if (this.assets) return this.assets.image(url).then(image => {
      if (!this.disposed) surfaces.forEach(entry => entry.repaint(image))
      return true
    }, error => { if (!this.assets.closed) console.warn('Board texture failed to load:', url, error); return false })
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

  back(attribute, blocked, variant = 0) {
    const kind = blocked ? 'blocked' : BACK_URLS[attribute] ? attribute : 'neutral'
    const list = this.backVariants.get(kind)
    return list[Math.abs(Math.trunc(variant)) % list.length].texture
  }

  backNormal(texture) {
    // The primitive kind tag survives Texture.clone() for queued flip snapshots.
    return this.backNormals.get(backKey(texture?.userData.cardBackKind, texture?.userData.cardBackVariant))?.texture || null
  }

  // Each RGB channel is a multiplier; byte 128 is approximately neutral after x2.
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
    return { normal: this.backNormal(texture), surface: this.backSurfaces.get(backKey(texture?.userData.cardBackKind, texture?.userData.cardBackVariant))?.texture || null }
  }

  dispose() {
    this.disposed = true
    for (const entry of [...this.floors, ...[...this.backVariants.values()].flat(), ...this.backNormals.values(), ...this.backSurfaces.values(), ...this.floorNormals, ...this.floorSurfaces]) entry.texture.dispose()
    for (const texture of [...this.cardWear.values()].flat()) texture.dispose()
  }
}

export function floorTextureIndex(position) {
  // Coordinate hash: stable through flips/moves and independent of gameplay RNG.
  let hash = Math.imul(position.c + 1, 374761393) ^ Math.imul(position.r + 1, 668265263)
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177)
  return ((hash ^ (hash >>> 16)) >>> 0) % FLOOR_URLS.length
}
