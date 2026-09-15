import * as THREE from 'three'
import floorAtlasUrl from '../assets/board-floor-atlas-v1.jpg'
import cardBackUrl from '../assets/board-card-back-v1.jpg'

const SIZE = 512
const THEMES = {
  neutral: { tint: '#777570', ink: '#d1bc90', symbol: 'ring' },
  scorch: { tint: '#cc6450', ink: '#ffc290', symbol: 'flame' },
  wither: { tint: '#c0a44f', ink: '#f4dc8c', symbol: 'thorn' },
  drown: { tint: '#568ab0', ink: '#a6d9e6', symbol: 'wave' },
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

function drawSymbol(ctx, kind) {
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  if (kind === 'wave') {
    for (const y of [-15, 10, 35]) {
      ctx.moveTo(-36, y)
      ctx.bezierCurveTo(-12, y - 26, 12, y + 26, 36, y)
    }
  } else if (kind === 'thorn') {
    ctx.moveTo(0, 42); ctx.lineTo(0, -42)
    for (const y of [-20, 10]) {
      ctx.moveTo(0, y + 15); ctx.lineTo(-28, y - 8)
      ctx.moveTo(0, y + 15); ctx.lineTo(28, y - 8)
    }
  } else if (kind === 'flame') {
    ctx.moveTo(0, -44)
    ctx.bezierCurveTo(5, -12, 44, 0, 30, 28)
    ctx.bezierCurveTo(18, 50, -22, 50, -32, 24)
    ctx.bezierCurveTo(-43, 0, -16, -15, 0, -44)
    ctx.moveTo(0, 30); ctx.lineTo(4, 8)
  } else ctx.arc(0, 0, 25, 0, Math.PI * 2)
  ctx.stroke()
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
        ctx.filter = 'saturate(0.45) brightness(0.85)'
        ctx.drawImage(image, x * image.width, y * image.height, w * image.width, h * image.height, 0, 0, SIZE, SIZE)
        ctx.filter = 'none'
      }
    }))
    this.backs = new Map()
    for (const [attribute, theme] of Object.entries(THEMES)) {
      for (const blocked of [false, true]) {
        this.backs.set(`${attribute}:${blocked}`, surface((ctx, image) => {
          ctx.fillStyle = '#49463f'
          ctx.fillRect(0, 0, SIZE, SIZE)
          if (image) ctx.drawImage(image, 0, 0, SIZE, SIZE)
          ctx.globalCompositeOperation = 'color'
          ctx.fillStyle = theme.tint
          ctx.fillRect(0, 0, SIZE, SIZE)
          ctx.globalCompositeOperation = 'source-over'
          // A subtle pigment wash makes attribute identity readable on small tiles.
          ctx.globalAlpha = 0.22
          ctx.fillRect(0, 0, SIZE, SIZE)
          ctx.globalAlpha = 1
          ctx.translate(SIZE / 2, SIZE / 2)
          ctx.fillStyle = '#232421'
          ctx.beginPath(); ctx.arc(0, 0, 60, 0, Math.PI * 2); ctx.fill()
          ctx.strokeStyle = theme.ink
          drawSymbol(ctx, theme.symbol)
          ctx.translate(-SIZE / 2, -SIZE / 2)
          if (blocked) {
            ctx.fillStyle = 'rgba(8, 12, 15, 0.48)'
            ctx.fillRect(0, 0, SIZE, SIZE)
          } else {
            ctx.strokeStyle = theme.ink
            ctx.lineWidth = 3
            ctx.strokeRect(15, 15, SIZE - 30, SIZE - 30)
          }
        }))
      }
    }
    this.ready = Promise.all([
      this.load(floorAtlasUrl, this.floors),
      this.load(cardBackUrl, [...this.backs.values()]),
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
    return this.backs.get(`${THEMES[attribute] ? attribute : 'neutral'}:${!!blocked}`).texture
  }

  dispose() {
    this.disposed = true
    for (const entry of [...this.floors, ...this.backs.values()]) entry.texture.dispose()
  }
}
