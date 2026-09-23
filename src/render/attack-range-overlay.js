import * as THREE from 'three'
import { enemyThreatCells, weaponTargetCells } from '../game/rules/attack-range.js'

const TEXTURE_SIZE = 256
const SHRINK_SECONDS = 1.2
const EXPAND_SECONDS = 0.8
const PULSE_SECONDS = SHRINK_SECONDS + EXPAND_SECONDS
const NO_RAYCAST = () => {}

export function rangePulse(elapsed) {
  const time = Math.max(0, elapsed) % PULSE_SECONDS
  const shrinking = time < SHRINK_SECONDS
  const progress = shrinking ? time / SHRINK_SECONDS : (time - SHRINK_SECONDS) / EXPAND_SECONDS
  const eased = progress * progress * (3 - 2 * progress)
  return shrinking
    ? { scale: 1 - eased * 0.5, opacity: 1 - eased }
    : { scale: 0.5 + eased * 0.5, opacity: eased }
}

function canvasTexture(draw) {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE
  const context = canvas.getContext('2d')
  draw(context)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function drawAim(context, color) {
  const stroke = (blur, alpha, width) => {
    context.save()
    context.filter = `blur(${blur}px)`
    context.strokeStyle = `rgba(${color}, ${alpha})`
    context.lineWidth = width
    context.lineCap = 'round'
    context.beginPath()
    context.arc(128, 128, 78, 0, Math.PI * 2)
    context.stroke()
    for (let side = 0; side < 4; side += 1) {
      context.save()
      context.translate(128, 128)
      context.rotate(side * Math.PI / 2)
      context.beginPath()
      context.moveTo(0, -91)
      context.lineTo(0, -111)
      context.stroke()
      context.restore()
    }
    context.restore()
  }
  stroke(15, 0.65, 12)
  stroke(7, 0.28, 7)
}

export class AttackRangeOverlay {
  constructor(scene, board, run, pointFor, cardSize, cardThickness) {
    this.run = run
    this.board = board
    this.pointFor = pointFor
    this.height = cardThickness / 2 + 0.065
    this.group = new THREE.Group()
    scene.add(this.group)
    this.geometry = new THREE.PlaneGeometry(cardSize * 0.96, cardSize * 0.96)
    this.textures = {
      weapon: canvasTexture((context) => drawAim(context, '100, 216, 255')),
      enemy: canvasTexture((context) => drawAim(context, '255, 91, 104')),
    }
    this.materials = Object.fromEntries(Object.entries(this.textures).map(([mode, map]) => [mode, new THREE.MeshBasicMaterial({
      map, transparent: true, opacity: 0, depthTest: false, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
    })]))
    this.key = ''
    this.mode = null
    this.elapsed = 0
    this.heldWeapon = null
    this.heldEnemy = null
  }

  showWeapon(uid) {
    this.heldWeapon = uid
    this.refresh()
  }

  clearWeapon() {
    if (!this.heldWeapon) return
    this.heldWeapon = null
    this.refresh()
  }

  showEnemy(roomId, id) {
    this.heldEnemy = { roomId, id }
    this.refresh()
  }

  clearEnemy() {
    if (!this.heldEnemy) return
    this.heldEnemy = null
    this.refresh()
  }

  syncPosition() {
    this.group.position.copy(this.board.position)
  }

  refresh() {
    const room = this.run.currentRoom
    const heldEnemy = this.heldEnemy
    const enemy = heldEnemy && room?.id === heldEnemy.roomId ? room.entity(heldEnemy.id) : null
    const heldWeapon = this.heldWeapon
    const weapon = !enemy && heldWeapon ? this.run.backpack.placementOf(heldWeapon)?.item : null
    const mode = enemy ? 'enemy' : weapon?.type === 'weapon' ? 'weapon' : null
    const origin = enemy?.pos || (mode === 'weapon' ? this.run.player.pos : null)
    const range = enemy ? Number(enemy.range) || 0 : weapon ? this.run.weaponRange(weapon) : 0
    const cells = mode === 'enemy'
      ? enemyThreatCells(room, enemy, this.run.player.pos)
      : mode === 'weapon' ? weaponTargetCells(room, origin, range) : []
    const key = mode ? [mode, room.id, enemy?.id || weapon.uid, origin.c, origin.r, range,
      ...cells.map(({ c, r }) => `${c},${r}`)].join(':') : ''
    if (key === this.key) return
    this.group.clear()
    this.key = key
    this.mode = mode
    this.elapsed = 0
    if (!mode) return
    for (const position of cells) {
      const point = this.pointFor(room, position)
      const effect = new THREE.Mesh(this.geometry, this.materials[mode])
      effect.rotation.x = -Math.PI / 2
      effect.position.set(point.x, this.height, point.z)
      effect.renderOrder = 900
      effect.raycast = NO_RAYCAST
      this.group.add(effect)
    }
  }

  update(delta) {
    if (!this.group.children.length || !this.mode) return
    this.elapsed = (this.elapsed + delta) % PULSE_SECONDS
    const { scale, opacity } = rangePulse(this.elapsed)
    this.materials[this.mode].opacity = (this.mode === 'weapon' ? 0.8 : 0.75) * opacity
    for (const effect of this.group.children) effect.scale.setScalar(scale)
  }

  dispose() {
    this.group.clear()
    this.group.removeFromParent()
    this.geometry.dispose()
    for (const material of Object.values(this.materials)) material.dispose()
    for (const texture of Object.values(this.textures)) texture.dispose()
  }
}
