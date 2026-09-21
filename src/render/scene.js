import * as THREE from 'three'
import { getAttributeDefinition } from '../game/data/attributes.js'
import { enemyCardSubtitle } from '../game/data/enemy-features.js'
import { isAdjacent8 } from '../game/core/geometry.js'
import { BoardTextures } from './board-textures.js'
import { DEFAULT_CAMERA_ELEVATION, panAzimuth } from './camera-view.js'
import { cardBodyGeometry, styleCardBody, cardFaceY, CARD_FACE_CLEARANCE, HIDDEN_CARD_THICKNESS, HIDDEN_CARD_SCALE } from './card-body.js'
import { boundaryPillarPoint, createDoorFrame, createLowPolyPillar, createLowPolyWall, evenPillarOffsets } from './wall-kit.js'
import { itemSpriteSources } from '../ui/item-sprites.js'

const TILE_SIZE = 1.14
const CARD_SIZE = TILE_SIZE
const CARD_THICKNESS = 0.08
const WALL_THICKNESS = 0.14
const DOOR_DEPTH = WALL_THICKNESS * 1.4
const BOUNDARY_GAP = 0.012
const WALL_HEIGHT = 0.62
const UNREACHABLE_HIDDEN_CARD_TINT = 0xffffff
const DEFAULT_ZOOM = 1
const MIN_ZOOM = 0.66
const MAX_ZOOM = 3.2
const DRAG_THRESHOLD = 8
const LONG_PRESS_MS = 300
const CAMERA_FOV = 45
const CAMERA_NEAR = 0.1
const CAMERA_FAR = 80
const DEFAULT_CAMERA_AZIMUTH = 0
const CAMERA_ORBIT_DISTANCE_RATIO = Math.hypot(0.74, 0.41)
const CAMERA_ELEVATION_STEP = 4 * Math.PI / 180
const MIN_CAMERA_ELEVATION = 38 * Math.PI / 180
const MAX_CAMERA_ELEVATION = 78 * Math.PI / 180
const STANDING_BACK_LEAN = 30 * Math.PI / 180
const GHOST_ROOM_GAP = TILE_SIZE * 0.54
const ENEMY_STATUS_LAYER_OFFSET = 0.012
const ENEMY_STATUS_HEALTH_Y = CARD_SIZE * 0.46
const ENEMY_STATUS_NAME_Y = CARD_SIZE * 0.58
const ENEMY_STATUS_BOTTOM_Y = -CARD_SIZE * 0.43
const ITEM_SPRITE_SIZE = CARD_SIZE * 0.7
const ITEM_SPRITE_PITCH = -Math.PI / 4
const ITEM_SPRITE_MIN_SPEED = 0.22
const ITEM_SPRITE_SPEED_STEP = 0.025
const ITEM_SPRITE_MAX_SPEED_VARIANT = 8
const ITEM_SPRITE_FLOAT_AMPLITUDE = 0.018
const ITEM_SPRITE_FLOAT_SPEED = 1.35
const ATTACK_ANIMATION_DURATION = 0.5
const PLAYER_ATTACK_LIFT = 0.045
const ENEMY_ATTACK_LIFT = 0.075
const TILE_RENDER_ORDER_BASE = 100
const TILE_RENDER_ORDER_ROW_STEP = 16
const FOOTPRINT_PRESS_DEPTH = 0.1

const ITEM_SPRITE_TEXTURES = new Map()
const ITEM_SPRITE_LOADER = new THREE.TextureLoader()

const CARD_COLORS = Object.freeze({
  monster: '#5b1a1a',
  weapon: '#1a2b4a',
  potion: '#1a3b2a',
  energy: '#4a3d16',
  buff: '#21402e',
  item: '#2a3b4a',
  gold: '#4a3a0a',
  key: '#3a1a4a',
  door: '#4a2a0a',
  merchant: '#3c2a16',
  relic: '#3d3157',
  trap: '#4a2338',
  entry: '#2a2a2a',
  empty: '#20242d',
})

const WEAPON_CLASS_LABELS = Object.freeze({ sword: '\u5251', axe: '\u65a7', dagger: '\u5315\u9996', polearm: '\u957f\u67c4', heavy: '\u91cd\u6b66\u5668', bow: '\u5f13' })

const NO_RAYCAST = () => {}

function makeCanvasTexture(draw, { width = 480, height = 480, scale = 3 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.save()
  context.scale(scale, scale)
  draw(context)
  context.restore()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function redrawCanvasTexture(texture, draw, { width = 160, height = 160 } = {}) {
  const canvas = texture?.image
  const context = canvas?.getContext?.('2d')
  if (!context) return false
  context.save()
  // Always redraw from an identity transform. Canvas transforms are
  // persistent; accumulating the previous scale would zoom the attack pose
  // until only a corner of the character remained visible.
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.scale(canvas.width / width, canvas.height / height)
  draw(context)
  context.restore()
  texture.needsUpdate = true
  return true
}

function stableHash(value) {
  let hash = 2166136261
  for (const character of String(value || '')) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function itemSpriteTexture(sources, onReady) {
  const key = sources?.medium
  if (!key) return null
  let entry = ITEM_SPRITE_TEXTURES.get(key)
  if (!entry) {
    entry = { texture: null, listeners: new Set(), failed: false }
    ITEM_SPRITE_TEXTURES.set(key, entry)
    ITEM_SPRITE_LOADER.load(key, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = 4
      texture.userData.boardShared = true
      entry.texture = texture
      for (const listener of entry.listeners) listener(texture)
      entry.listeners.clear()
    }, undefined, () => {
      entry.failed = true
      entry.listeners.clear()
    })
  }
  if (entry.texture) return entry.texture
  if (!entry.failed && onReady) entry.listeners.add(onReady)
  return null
}

function makeLockIndicatorTexture() {
  return makeCanvasTexture((context) => {
    context.clearRect(0, 0, 160, 160)
    context.strokeStyle = '#ffe08a'
    context.fillStyle = '#8a5a1c'
    context.lineWidth = 11
    context.lineCap = 'round'
    context.beginPath()
    context.arc(80, 74, 25, Math.PI, 0, true)
    context.stroke()
    context.fillRect(42, 72, 76, 54)
    context.strokeRect(42, 72, 76, 54)
    context.fillStyle = '#ffeab0'
    context.beginPath()
    context.arc(80, 96, 7, 0, Math.PI * 2)
    context.fill()
    context.fillRect(76, 96, 8, 17)
  })
}

function drawCenteredText(context, text, y, { color = '#fff', size = 12, weight = 'normal' } = {}) {
  let actualSize = size
  do {
    context.font = `${weight} ${actualSize}px sans-serif`
    actualSize -= 1
  } while (actualSize > 9 && context.measureText(text).width > 142)
  context.fillStyle = color
  context.textAlign = 'center'
  context.fillText(text, 80, y)
}

function drawAttributeLabel(context, attribute) {
  const definition = getAttributeDefinition(attribute)
  if (!definition) return
  context.font = 'bold 12px sans-serif'
  context.textAlign = 'right'
  context.fillStyle = definition.color
  context.shadowColor = 'rgba(0,0,0,.9)'
  context.shadowBlur = 3
  context.fillText(definition.name, 148, 18)
  context.shadowBlur = 0
}

function drawStickFigure(context, { armLift = 0, legSpread = 1 } = {}) {
  context.strokeStyle = '#f4dca7'
  context.fillStyle = '#f4dca7'
  context.lineWidth = 8
  context.lineCap = 'round'
  context.beginPath()
  context.arc(80, 47, 14, 0, Math.PI * 2)
  context.fill()
  context.beginPath()
  context.moveTo(80, 65)
  context.lineTo(80, 104)
  context.moveTo(80, 76)
  context.lineTo(52 - armLift * 4, 94 - armLift * 42)
  context.moveTo(80, 76)
  context.lineTo(108 + armLift * 4, 94 - armLift * 42)
  context.moveTo(80, 104)
  context.lineTo(80 - 23 * legSpread, 132)
  context.moveTo(80, 104)
  context.lineTo(80 + 23 * legSpread, 132)
  context.stroke()
}

function drawEmptyCardBase(context) {
  const gradient = context.createLinearGradient(0, 0, 0, 160)
  gradient.addColorStop(0, CARD_COLORS.empty)
  gradient.addColorStop(1, '#0a0a12')
  context.fillStyle = gradient
  context.fillRect(0, 0, 160, 160)
  context.strokeStyle = '#30384a'
  context.lineWidth = 3
  context.strokeRect(4, 4, 152, 152)
}

const WHITE_LINE_CARD_LABELS = Object.freeze({
  monster: 'ENEMY', merchant: 'MERCHANT', entry: 'PLAYER', weapon: 'WEAPON', potion: 'POTION',
  armor: 'ARMOR', energy: 'ENERGY', buff: 'BUFF', relic: 'RELIC', trap: 'TRAP', gold: 'GOLD',
  key: 'KEY', door: 'DOOR', item: 'ITEM', empty: 'EMPTY',
})

function drawWhiteLineCard(context, { label = 'OBJECT', value = '', detail = '', back = false } = {}) {
  context.clearRect(0, 0, 160, 160)
  context.fillStyle = '#050505'
  context.fillRect(0, 0, 160, 160)
  context.strokeStyle = '#f4f4f4'
  context.lineWidth = 3
  context.strokeRect(5, 5, 150, 150)
  context.strokeStyle = '#777'
  context.lineWidth = 1
  context.strokeRect(12, 12, 136, 136)
  context.fillStyle = '#f4f4f4'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = 'bold 17px monospace'
  context.fillText(back ? (label === 'BLOCKED' ? 'BLOCKED' : 'HIDDEN') : label, 80, 48)
  if (value) {
    context.font = 'bold 25px monospace'
    context.fillText(String(value), 80, 86)
  }
  if (detail) {
    context.font = '11px monospace'
    context.fillStyle = '#bbb'
    context.fillText(String(detail).slice(0, 22), 80, 121)
  }
}

function drawStandingToken(context, card, { headLift = 0, bodySway = 0 } = {}) {
  context.clearRect(0, 0, 160, 160)
  const merchant = card.type === 'merchant'
  const attribute = !merchant ? getAttributeDefinition(card.attribute) : null
  const color = merchant ? '#d5a85d' : card.boss ? '#ff7777' : '#e36b6b'
  context.fillStyle = color
  context.strokeStyle = merchant ? '#ffe3a3' : '#ffc0c0'
  context.lineWidth = 4
  const drawSilhouette = ({ fill = false } = {}) => {
    context.save()
    context.translate(bodySway * 5, 0)
    context.translate(80, 100)
    context.rotate(bodySway * 0.055)
    context.translate(-80, -100)
    context.beginPath()
    context.moveTo(34, 142)
    context.lineTo(126, 142)
    context.lineTo(80, 58)
    context.closePath()
    if (fill) context.fill()
    context.stroke()
    context.restore()
    context.beginPath()
    context.arc(80, 42 - headLift * 8, 27, 0, Math.PI * 2)
    if (fill) context.fill()
    context.stroke()
  }
  drawSilhouette({ fill: true })
  if (attribute) {
    // Keep the red danger outline and add a quieter attribute-colored trim.
    context.strokeStyle = attribute.color
    context.globalAlpha = 0.78
    context.lineWidth = 2
    drawSilhouette()
    context.globalAlpha = 1
  }
  const glyph = Array.from(String(card.title || '?'))[0] || '?'
  context.fillStyle = '#241c24'
  context.font = 'bold 29px sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(glyph, 80, 42 - headLift * 8)
  context.font = 'bold 23px sans-serif'
  context.fillText(String(card.value ?? ''), 80 + bodySway * 5, 112)
}

function tileKey(position) { return `${position.c}:${position.r}` }

// South rows (larger r values) are intentionally rendered later so they sit
// in front of north rows even when the camera orbit changes.
function tileRenderOrder(position, layer = 0) {
  const row = Number.isFinite(Number(position?.r)) ? Number(position.r) : 0
  return TILE_RENDER_ORDER_BASE + row * TILE_RENDER_ORDER_ROW_STEP + layer
}

function samePosition(left, right) {
  return !!left && !!right && left.c === right.c && left.r === right.r
}

function turnCounter(value) {
  return Math.max(0, Math.floor(Number(value) || 0))
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.()
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    for (const material of materials) {
      if (material?.map && !material.map.userData.boardShared) material.map.dispose?.()
      material?.dispose?.()
    }
  })
}

export class GameScene {
  constructor(run, container, { skin = 'default' } = {}) {
    this.run = run
    this.skin = skin
    this.container = container
    this.boardTextures = skin === 'whiteline' ? null : new BoardTextures()
    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    this.tileMeshes = []
    this.tileMeshByKey = new Map()
    this.doorMeshes = []
    this.structureGroup = null
    this.flipAnimations = []
    this.animationQueue = []
    this.attackAnimation = null
    this.movementAnimation = null
    this.moveCompletionPending = false
    this.playerMarker = null
    this.pathPreview = null
    this.pendingRebuild = false
    this.hoveredTileKey = null
    this.depressedTileKeys = new Set()
    this.lastFootprintKey = null
    this.lastFootprintTurn = 0
    this.visibleDoorKey = ''
    this.structureKey = ''
    this.zoom = DEFAULT_ZOOM
    this.cameraAzimuth = DEFAULT_CAMERA_AZIMUTH
    this.cameraElevation = DEFAULT_CAMERA_ELEVATION
    this.framedRoomId = null
    this.viewportWidth = 0
    this.viewportHeight = 0
    this.activePointers = new Map()
    this.drag = null
    this.pinch = null
    this.lastDragMoved = false
    this.boardHold = null
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(skin === 'whiteline' ? 0x050505 : 0x111722)
    this.baseCameraDistance = 12
    this.sceneBounds = null
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR)
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.shadowMap.enabled = skin !== 'whiteline'
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    Object.assign(this.renderer.domElement.style, { position: 'absolute', inset: '0', zIndex: '0' })
    this.container.appendChild(this.renderer.domElement)
    this.roomGroup = new THREE.Group()
    this.scene.add(this.roomGroup)
    this._addLights()
    this._onResize = () => this._resize()
    this._onPointerDown = (event) => this._handlePointerDown(event)
    this._onPointerMove = (event) => this._handlePointerMove(event)
    this._onPointerUp = (event) => this._handlePointerUp(event)
    this._onClick = (event) => this._handleClick(event)
    this._onWheel = (event) => this._handleWheel(event)
    this._onPointerLeave = () => this._setHoveredTile(null)
    this._onFlip = (payload) => this._queueAnimation('flip', payload)
    this._onFlipBatch = (payload) => this._queueAnimation('flip-batch', payload)
    this._onMove = (payload) => this._queueAnimation('move', payload)
    this._onAttack = (payload) => this._queueAnimation('attack', payload)
    window.addEventListener('resize', this._onResize)
    this.renderer.domElement.addEventListener('pointerdown', this._onPointerDown)
    this.renderer.domElement.addEventListener('pointermove', this._onPointerMove)
    this.renderer.domElement.addEventListener('pointerup', this._onPointerUp)
    this.renderer.domElement.addEventListener('pointercancel', this._onPointerUp)
    this.renderer.domElement.addEventListener('pointerleave', this._onPointerLeave)
    this.renderer.domElement.addEventListener('click', this._onClick)
    this.renderer.domElement.addEventListener('wheel', this._onWheel, { passive: false })
    this.unsubscribe = this.run.on('change', () => {
      if (!this.movementAnimation && !this.attackAnimation && !this.animationQueue.length && this.lastFootprintKey && this.run.turns.globalTurn > this.lastFootprintTurn) this._releaseFootprints()
      this._clearPathPreview()
      this.rebuild()
    })
    this.flipUnsubscribe = this.run.on('animate:flip', this._onFlip)
    this.flipBatchUnsubscribe = this.run.on('animate:flip-batch', this._onFlipBatch)
    this.moveUnsubscribe = this.run.on('animate:move', this._onMove)
    this.attackUnsubscribe = this.run.on('animate:attack', this._onAttack)
    this.rebuild()
    this._resize(true)
    this._animate = this._animate.bind(this)
    this._frame = requestAnimationFrame(this._animate)
  }

  _addLights() {
    this.scene.add(new THREE.HemisphereLight(0xd5e8ff, 0x162133, 1.3))
    const key = new THREE.DirectionalLight(0xfff0dc, 1.5)
    key.position.set(5, 10, 6)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    this.scene.add(key)
    const fill = new THREE.PointLight(0x7b72d8, 2.0, 20)
    fill.position.set(-4, 5, -3)
    this.scene.add(fill)
  }

  _gridPosition(room, position) {
    return {
      x: (position.c - (room.width - 1) / 2) * TILE_SIZE,
      z: (position.r - (room.height - 1) / 2) * TILE_SIZE,
    }
  }

  _visibleDoorKey(room) {
    if (!room) return ''
    return this.run.dungeon.doorsForRoom(room.id)
      .filter((door) => this.run.isDoorRevealed(door))
      .map((door) => door.id)
      .sort()
      .join('|')
  }

  rebuild() {
    const room = this.run.currentRoom
    if (this.movementAnimation || this.attackAnimation || this.animationQueue.length || (this.flipAnimations.length && room?.id === this.framedRoomId)) {
      this.pendingRebuild = true
      return
    }
    const visibleDoorKey = this._visibleDoorKey(room)
    const structureKey = visibleDoorKey
    const sameRoom = room?.id === this.framedRoomId && this.tileMeshes.length === room.width * room.height && !!this.structureGroup
    if (sameRoom) {
      this._clearPathPreview()
      this._clearMovementAnimation()
      this._clearPlayerMarker()
      if (this._refreshRoom(room)) {
        if (this.structureKey !== structureKey) {
          this._rebuildRoomStructure(room)
          this.visibleDoorKey = visibleDoorKey
          this.structureKey = structureKey
        } else this._refreshDoors()
        return
      }
    }
    if (room?.id !== this.framedRoomId) {
      this.animationQueue = []
      this.pendingRebuild = false
      this.visibleDoorKey = ''
      this.structureKey = ''
      this._releaseFootprints()
    }
    this._clearPathPreview()
    this._clearMovementAnimation()
    this._clearPlayerMarker()
    disposeObject(this.roomGroup)
    this.roomGroup.clear()
    this.tileMeshes = []
    this.tileMeshByKey.clear()
    this.doorMeshes = []
    this.structureGroup = null
    this.sceneBounds = null
    if (!room) return
    const floorTint = [0x111722, 0x111722, 0x151522, 0x1b1625, 0x221628, 0x29172a][room.floor] || 0x111722
    this.scene.background.setHex(floorTint)

    for (let r = 0; r < room.height; r++) {
      for (let c = 0; c < room.width; c++) this._addTile(room, { c, r })
    }
    this._rebuildRoomStructure(room)
    this._frameRoom(room, { resetView: room.id !== this.framedRoomId })
    this.visibleDoorKey = visibleDoorKey
    this.structureKey = structureKey
    this.framedRoomId = room.id
  }

  _addTile(room, position) {
    const visual = this._tileVisualState(room, position)
    const { revealed, peeked, flippable } = visual
    const geometry = cardBodyGeometry(CARD_SIZE, CARD_THICKNESS)
    const material = new THREE.MeshStandardMaterial({
      color: this.skin === 'whiteline' ? 0x666666 : 0x262a36,
      roughness: 0.9,
      wireframe: this.skin === 'whiteline',
    })
    const mesh = new THREE.Mesh(geometry, material)
    const point = this._gridPosition(room, position)
    mesh.position.set(point.x, 0, point.z)
    mesh.receiveShadow = true
    this.roomGroup.add(mesh)
    const card = revealed || peeked ? this._cardFaceData(room, position) : null
    const standing = revealed && (card?.type === 'monster' || card?.type === 'merchant' || card?.type === 'entry')
    const emptyGround = standing && (card?.type === 'monster' || card?.type === 'merchant' || card?.type === 'entry')
    const texture = card
      ? this._makeFrontTexture(card, position, revealed)
      : this._makeBackTexture(this._backAttributeFor(room, position), { unflippable: !flippable })
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_SIZE, CARD_SIZE),
      new THREE.MeshBasicMaterial({
        map: texture,
        color: revealed || peeked || flippable ? 0xffffff : UNREACHABLE_HIDDEN_CARD_TINT,
        // Standing tokens keep opacity 1, but their cleared canvas pixels must
        // still be composited as transparent. Raycast is disabled below so
        // the ground tile remains clickable without making the figure fade.
        transparent: standing || peeked,
        opacity: peeked ? 0.46 : 1,
        depthTest: !standing,
        side: THREE.DoubleSide,
        depthWrite: !standing,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -4,
      }),
    )
    this._setFacePose(face, point, standing, !revealed)
    this._styleTileBody(mesh, room, position, visual)
    face.renderOrder = tileRenderOrder(position, standing ? 4 : 1)
    // Standing tokens are visual overlays. Let the ground tile receive the
    // pointer instead so a character/enemy cannot block the tile behind it.
    face.raycast = standing ? NO_RAYCAST : THREE.Mesh.prototype.raycast
    face.userData.position = { ...position }
    face.userData.lift = 0
    face.userData.press = 0
    face.userData.body = mesh
    face.userData.groundFace = emptyGround ? this._makeEmptyGroundFace(point, position) : null
    face.userData.visualKey = visual.key
    if (face.userData.groundFace) this.roomGroup.add(face.userData.groundFace)
    this.roomGroup.add(face)
    this._attachItemSprite(face, card, point, position, revealed)
    this._setEnemyStatusOverlay(face, face.userData.groundFace, revealed && card?.type === 'monster' ? room.entityAt(position) : null)
    this.tileMeshes.push(face)
    this.tileMeshByKey.set(tileKey(position), face)
  }

  _styleTileBody(body, room, position, { revealed, flippable }) {
    if (this.skin === 'whiteline') {
      body.scale.set(revealed ? 1 : HIDDEN_CARD_SCALE, revealed ? 1 : HIDDEN_CARD_THICKNESS / CARD_THICKNESS, revealed ? 1 : HIDDEN_CARD_SCALE)
      body.userData.baseY = revealed ? 0 : (HIDDEN_CARD_THICKNESS - CARD_THICKNESS) / 2
      body.position.y = body.userData.baseY
      body.material.map = null
      body.material.color.setHex(revealed ? 0x666666 : (flippable ? 0xaaaaaa : 0x444444))
      body.material.wireframe = true
      body.material.needsUpdate = true
      return
    }
    const attribute = this._backAttributeFor(room, position)
    styleCardBody(body, {
      hidden: !revealed, attribute, blocked: !flippable, baseThickness: CARD_THICKNESS,
      texture: this._makeBackTexture(attribute, { unflippable: !flippable }),
    })
  }

  _setFacePose(face, point, standing, hidden = false) {
    const baseY = standing ? CARD_SIZE / 2 + CARD_THICKNESS / 2 : cardFaceY(hidden, CARD_THICKNESS)
    face.scale.setScalar(hidden ? HIDDEN_CARD_SCALE : 1)
    face.rotation.order = standing ? 'YXZ' : 'XYZ'
    face.rotation.set(standing ? -STANDING_BACK_LEAN : -Math.PI / 2, standing ? this.cameraAzimuth : 0, 0)
    face.position.set(point.x, baseY, point.z)
    face.userData.baseY = baseY
    face.userData.standing = standing
  }

  _clearItemSprite(face) {
    const sprite = face?.userData?.itemSprite
    if (sprite) {
      this.roomGroup.remove(sprite)
      disposeObject(sprite)
    }
    face.userData.itemSprite = null
    face.userData.itemSpriteState = null
    face.userData.itemSpriteRequestKey = null
  }

  _itemSpriteMesh(face, texture, item, point, position, elapsed = 0) {
    const image = texture.image
    const aspect = image?.width && image?.height ? image.width / image.height : 1
    const width = aspect >= 1 ? ITEM_SPRITE_SIZE : ITEM_SPRITE_SIZE * aspect
    const height = aspect >= 1 ? ITEM_SPRITE_SIZE / aspect : ITEM_SPRITE_SIZE
    const geometry = new THREE.PlaneGeometry(width, height)
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      alphaTest: 0.02,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const sprite = new THREE.Mesh(geometry, material)
    const spinSeed = stableHash(`${item?.uid || item?.id || 'item'}:${position?.c || 0}:${position?.r || 0}`)
    const speed = ITEM_SPRITE_MIN_SPEED + (spinSeed % (ITEM_SPRITE_MAX_SPEED_VARIANT + 1)) * ITEM_SPRITE_SPEED_STEP
    // The mesh origin is the tile center, so the pitch rotates around the
    // image's half-height line and heading rotation stays centered on the tile.
    const groundY = cardFaceY(false, CARD_THICKNESS)
    const uprightCenterY = groundY + height / 2
    const pitchLift = (height / 2) * (1 - Math.cos(Math.abs(ITEM_SPRITE_PITCH)))
    const groundedCenterY = uprightCenterY - pitchLift
    sprite.position.set(point.x, groundedCenterY + 0.004, point.z)
    sprite.rotation.order = 'YXZ'
    sprite.rotation.set(ITEM_SPRITE_PITCH, this.cameraAzimuth, 0)
    sprite.renderOrder = tileRenderOrder(position, 8)
    sprite.raycast = NO_RAYCAST
    sprite.userData.itemSprite = true
    sprite.userData.position = position ? { ...position } : null
    sprite.userData.itemSpin = { angle: (elapsed * speed) % (Math.PI * 2), elapsed, speed, baseY: sprite.position.y }
    face.userData.itemSprite = sprite
    face.userData.itemSpriteState = { source: itemSpriteSources(item), position: position ? { ...position } : null }
    this.roomGroup.add(sprite)
  }

  _attachItemSprite(face, card, point, position, revealed = false) {
    this._clearItemSprite(face)
    if (!revealed) return
    const entity = position ? this.run.currentRoom?.entityAt(position) : null
    const item = card?.item || (entity?.kind === 'item' ? entity.item : null)
    if (this.skin === 'whiteline' || !item) return
    const sources = itemSpriteSources(item)
    if (!sources) return
    const sourceKey = sources.medium
    const startedAt = Date.now()
    face.userData.itemSpriteRequestKey = sourceKey
    const applyTexture = (texture) => {
      if (!texture || !face.parent || face.userData.itemSpriteRequestKey !== sourceKey || face.userData.position?.c !== position?.c || face.userData.position?.r !== position?.r) return
      this._clearItemSprite(face)
      this._itemSpriteMesh(face, texture, item, point, position, Math.max(0, (Date.now() - startedAt) / 1000))
    }
    const texture = itemSpriteTexture(sources, applyTexture)
    if (texture) applyTexture(texture)
  }

  _makeEmptyGroundFace(point, position = null) {
    const groundFace = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_SIZE, CARD_SIZE),
      new THREE.MeshBasicMaterial({ map: this.skin === 'whiteline' ? this._makeFrontTexture({ type: 'empty' }, position) : this.boardTextures.floor(position), side: THREE.DoubleSide }),
    )
    groundFace.rotation.x = -Math.PI / 2
    groundFace.position.set(point.x, CARD_THICKNESS / 2 + 0.003, point.z)
    groundFace.userData.position = position ? { ...position } : null
    groundFace.raycast = THREE.Mesh.prototype.raycast
    return groundFace
  }

  _setEnemyStatusOverlay(face, groundFace, enemy) {
    for (const [owner, key] of [[face, 'enemyHealthOverlay'], [groundFace, 'enemyTurnOverlay']]) {
      const previous = owner?.userData?.[key]
      if (!previous) continue
      owner.remove(previous)
      disposeObject(previous)
      owner.userData[key] = null
    }
    if (enemy?.kind !== 'enemy' || !groundFace) return

    const healthOverlay = new THREE.Group()
    healthOverlay.position.z = ENEMY_STATUS_LAYER_OFFSET
    healthOverlay.userData.renderOrder = tileRenderOrder(face.userData.position, 6)
    healthOverlay.raycast = NO_RAYCAST
    this._addEnemyHealthMeter(healthOverlay, enemy)
    this._addEnemyNameLabel(healthOverlay, enemy)
    face.add(healthOverlay)
    face.userData.enemyHealthOverlay = healthOverlay

    const turnOverlay = new THREE.Group()
    turnOverlay.position.z = ENEMY_STATUS_LAYER_OFFSET
    turnOverlay.userData.renderOrder = tileRenderOrder(face.userData.position, 5)
    turnOverlay.raycast = NO_RAYCAST

    const actionDelay = turnCounter(enemy.actionDelay)
    if (actionDelay > 0) {
      this._addEnemyTurnMeter(turnOverlay, {
        axis: 'horizontal',
        x: 0,
        y: ENEMY_STATUS_BOTTOM_Y,
        total: Math.max(actionDelay, turnCounter(enemy.initialActionDelay)),
        remaining: actionDelay,
        color: 0xf4d56d,
      })
    } else if (turnCounter(enemy.attackCooldown) > 0) {
      this._addEnemyTurnMeter(turnOverlay, {
        axis: 'horizontal',
        x: 0,
        y: ENEMY_STATUS_BOTTOM_Y,
        total: Math.max(1, turnCounter(enemy.attackCooldownMax) - 1, turnCounter(enemy.attackCooldown)),
        remaining: turnCounter(enemy.attackCooldown),
        color: 0xff7777,
      })
    }

    if (turnOverlay.children.length > 0) {
      groundFace.add(turnOverlay)
      groundFace.userData.enemyTurnOverlay = turnOverlay
    }
  }

  _addEnemyHealthMeter(overlay, enemy) {
    const width = CARD_SIZE * 0.7
    const height = CARD_SIZE * 0.062
    const maxHealth = Math.max(1, turnCounter(enemy.maxHp))
    const healthRatio = Math.min(1, turnCounter(enemy.hp) / maxHealth)
    this._addEnemyStatusPlane(overlay, width + CARD_SIZE * 0.018, height + CARD_SIZE * 0.018, 0, ENEMY_STATUS_HEALTH_Y, 0x1a1014, 0.92)
    this._addEnemyStatusPlane(overlay, width, height, 0, ENEMY_STATUS_HEALTH_Y, 0x36191f, 0.96)
    if (healthRatio <= 0) return
    const fillWidth = width * healthRatio
    this._addEnemyStatusPlane(
      overlay,
      fillWidth,
      height * 0.62,
      -width / 2 + fillWidth / 2,
      ENEMY_STATUS_HEALTH_Y,
      enemy.boss ? 0xff7777 : 0xe95b62,
      1,
    )
  }

  _addEnemyNameLabel(overlay, enemy) {
    const label = String(enemy?.name || '').trim()
    if (!label) return
    // This texture deliberately matches the label plane's wide aspect ratio.
    // A square canvas on a narrow strip vertically crushes text into a line.
    const texture = makeCanvasTexture((context) => {
      let size = 26
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      do {
        context.font = `bold ${size}px sans-serif`
        size -= 1
      } while (size > 16 && context.measureText(label).width > 154)
      context.lineWidth = 1
      context.strokeStyle = 'rgba(4,7,12,.88)'
      context.strokeText(label, 80, 20)
      context.fillStyle = '#f0e6d2'
      context.fillText(label, 80, 20)
    }, { width: 480, height: 120 })
    const nameLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_SIZE * 0.7, CARD_SIZE * 0.175),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    )
    nameLabel.position.set(0, ENEMY_STATUS_NAME_Y, overlay.children.length * 0.0002)
    nameLabel.raycast = NO_RAYCAST
    nameLabel.renderOrder = (overlay.userData.renderOrder || 1) + overlay.children.length * 0.001
    overlay.add(nameLabel)
  }

  _addEnemyTurnMeter(overlay, { axis, x, y, total, remaining, color }) {
    const segmentCount = Math.max(1, Math.min(8, turnCounter(total)))
    const filledSegments = Math.min(segmentCount, Math.ceil(segmentCount * turnCounter(remaining) / Math.max(1, turnCounter(total))))
    const length = axis === 'horizontal' ? CARD_SIZE * 0.74 : CARD_SIZE * 0.67
    const thickness = CARD_SIZE * 0.058
    const gap = CARD_SIZE * 0.014
    const segmentLength = (length - gap * (segmentCount - 1)) / segmentCount
    for (let index = 0; index < segmentCount; index += 1) {
      const offset = -length / 2 + segmentLength / 2 + index * (segmentLength + gap)
      const filled = index < filledSegments
      const width = axis === 'horizontal' ? segmentLength : thickness
      const height = axis === 'horizontal' ? thickness : segmentLength
      this._addEnemyStatusPlane(
        overlay,
        width,
        height,
        axis === 'horizontal' ? x + offset : x,
        axis === 'horizontal' ? y : y + offset,
        filled ? color : 0x1d2634,
        filled ? 0.98 : 0.8,
      )
    }
  }

  _addEnemyStatusPlane(overlay, width, height, x, y, color, opacity) {
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, side: THREE.DoubleSide }),
    )
    plane.position.set(x, y, overlay.children.length * 0.0002)
    plane.raycast = NO_RAYCAST
    plane.renderOrder = (overlay.userData.renderOrder || 1) + overlay.children.length * 0.001
    overlay.add(plane)
  }

  _tileVisualState(room, position) {
    const tile = room.tile(position)
    const revealed = this.run.debugReveal || tile.revealed
    const peeked = !revealed && !!tile.peeked
    const flippable = !revealed && this.run.tileCanBeFlipped(position)
    const isPlayer = samePosition(this.run.player.pos, position)
    const entity = room.entityAt(position)
    return {
      revealed,
      peeked,
      flippable,
      key: JSON.stringify({
        revealed,
        peeked,
        flippable,
        entity,
        player: isPlayer ? {
          hp: this.run.player.hp,
          maxHp: this.run.player.maxHp,
          armor: this.run.player.armor,
        } : null,
      }),
    }
  }

  _boundaryPosition(room, side, offset) {
    const inset = WALL_THICKNESS / 2 + BOUNDARY_GAP
    if (side === 'top' || side === 'bottom') {
      return {
        x: (offset - (room.width - 1) / 2) * TILE_SIZE,
        z: side === 'top' ? -room.height * TILE_SIZE / 2 - inset : room.height * TILE_SIZE / 2 + inset,
      }
    }
    return {
      x: side === 'left' ? -room.width * TILE_SIZE / 2 - inset : room.width * TILE_SIZE / 2 + inset,
      z: (offset - (room.height - 1) / 2) * TILE_SIZE,
    }
  }

  _doorPosition(room, side, offset) {
    const point = this._boundaryPosition(room, side, offset)
    const outward = this._doorOutward(side)
    const extra = (DOOR_DEPTH - WALL_THICKNESS) / 2
    return { x: point.x + outward.x * extra, z: point.z + outward.z * extra }
  }

  _addWallSegment(room, side, offset) {
    const horizontal = side === 'top' || side === 'bottom'
    const point = this._boundaryPosition(room, side, offset)
    const wall = createLowPolyWall({ horizontal, length: horizontal ? TILE_SIZE : TILE_SIZE, thickness: WALL_THICKNESS, height: WALL_HEIGHT })
    wall.position.set(point.x, 0, point.z)
    if (side === 'bottom') this._setSouthBoundaryRenderLayer(room, wall)
    this.structureGroup.add(wall)
  }

  _addBoundaryPillar(room, side, offset, seen) {
    const inset = WALL_THICKNESS / 2 + BOUNDARY_GAP
    const point = boundaryPillarPoint(room, side, offset, TILE_SIZE, inset)
    const key = `${point.x.toFixed(3)}:${point.z.toFixed(3)}`
    if (seen.has(key)) return
    seen.add(key)
    const pillar = createLowPolyPillar({ height: WALL_HEIGHT + 0.28 })
    pillar.position.set(point.x, 0, point.z)
    if (side === 'bottom') this._setSouthBoundaryRenderLayer(room, pillar)
    this.structureGroup.add(pillar)
  }

  _setSouthBoundaryRenderLayer(room, object) {
    // The camera-facing boundary must remain in front of the nearest row.
    // Its order is intentionally independent of a tile's temporary Y press,
    // which otherwise changes the depth-buffer result while a footprint sinks.
    const renderOrder = tileRenderOrder({ r: room.height }, TILE_RENDER_ORDER_ROW_STEP - 1)
    object.traverse((child) => {
      if (!child?.isMesh && !child?.isSprite) return
      child.userData.southBoundaryFront = true
      child.renderOrder = renderOrder
      if (!child.material) return
      child.material.depthTest = false
      child.material.depthWrite = false
      child.material.needsUpdate = true
    })
  }

  _addBoundaryPillars(room, doors) {
    const seen = new Set()
    const hasDoor = (side, offset) => doors.some(door => door.side === side && door.offset === offset)
    for (const side of ['top', 'bottom']) {
      const forbidden = doors.filter(door => door.side === side).map(door => door.offset)
      const offsets = side === 'bottom' ? [0, room.width - 1] : evenPillarOffsets(room.width, forbidden)
      for (const offset of offsets) {
        if (!hasDoor(side, offset)) this._addBoundaryPillar(room, side, offset, seen)
      }
    }
    for (const side of ['left', 'right']) {
      const forbidden = doors.filter(door => door.side === side).map(door => door.offset)
      for (const offset of evenPillarOffsets(room.height, forbidden)) {
        if (!hasDoor(side, offset)) this._addBoundaryPillar(room, side, offset, seen)
      }
    }
  }

  _setDoorAppearance(mesh) {
    const door = this.run.dungeon.door(mesh.userData.doorId)
    const locked = this.run.isDoorLocked(door)
    mesh.material.color.setHex(this.skin === 'whiteline' ? (locked ? 0x555555 : 0xbbbbbb) : (locked ? 0x5a341d : 0x9a6533))
    mesh.material.emissive?.setHex(locked ? 0x1c0e05 : 0x2b1608)
    mesh.userData.lockIndicator.visible = locked
  }

  _addDoorMesh(room, door) {
    const horizontal = door.side === 'top' || door.side === 'bottom'
    const point = this._doorPosition(room, door.side, door.offset)
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? TILE_SIZE * 0.68 : DOOR_DEPTH, WALL_HEIGHT + 0.18, horizontal ? DOOR_DEPTH : TILE_SIZE * 0.68),
      new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.46 }),
    )
    mesh.position.set(point.x, (WALL_HEIGHT + 0.18) / 2, point.z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData.doorId = door.id
    if (this.skin !== 'whiteline') {
      const lockIndicator = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeLockIndicatorTexture(), transparent: true, depthTest: false }))
      lockIndicator.position.set(0, WALL_HEIGHT * 0.48, 0)
      lockIndicator.scale.set(0.44, 0.44, 1)
      mesh.userData.lockIndicator = lockIndicator
      mesh.add(lockIndicator)
    } else {
      mesh.userData.lockIndicator = { visible: false }
    }
    const frame = createDoorFrame({ horizontal, width: TILE_SIZE * 0.68, depth: DOOR_DEPTH, height: WALL_HEIGHT + 0.18 })
    frame.position.set(point.x, 0, point.z)
    if (door.side === 'bottom') {
      this._setSouthBoundaryRenderLayer(room, frame)
      this._setSouthBoundaryRenderLayer(room, mesh)
    }
    this.structureGroup.add(frame)
    this._setDoorAppearance(mesh)
    this.doorMeshes.push(mesh)
    this.structureGroup.add(mesh)
  }

  _addRoomBoundary(room) {
    const doors = this.run.dungeon.doorsForRoom(room.id).filter((door) => this.run.isDoorRevealed(door))
    const hasDoor = (side, offset) => doors.some((door) => door.side === side && door.offset === offset)
    for (const side of ['top', 'bottom']) {
      for (let c = 0; c < room.width; c++) if (!hasDoor(side, c)) this._addWallSegment(room, side, c)
    }
    for (const side of ['left', 'right']) {
      for (let r = 0; r < room.height; r++) if (!hasDoor(side, r)) this._addWallSegment(room, side, r)
    }
    this._addBoundaryPillars(room, doors)
    for (const door of doors) this._addDoorMesh(room, door)
  }

  _rebuildRoomStructure(room) {
    if (this.structureGroup) {
      this.roomGroup.remove(this.structureGroup)
      disposeObject(this.structureGroup)
    }
    this.structureGroup = new THREE.Group()
    this.roomGroup.add(this.structureGroup)
    this.doorMeshes = []
    this._addRoomBoundary(room)
    this._addExploredRoomGhosts(room)
    if (this.skin === 'whiteline') {
      this._lineifyStructure()
      this._refreshDoors()
    }
  }

  _lineifyStructure() {
    this.structureGroup?.traverse((child) => {
      if (!child.isMesh) return
      const old = child.material
      child.material = new THREE.MeshBasicMaterial({ color: 0x888888, wireframe: true })
      if (child.userData.southBoundaryFront) {
        child.material.depthTest = false
        child.material.depthWrite = false
      }
      if (old && !Array.isArray(old)) old.dispose?.()
    })
  }

  _resetSceneBounds(room) {
    const halfWidth = room.width * TILE_SIZE / 2 + WALL_THICKNESS
    const halfDepth = room.height * TILE_SIZE / 2 + WALL_THICKNESS
    this.sceneBounds = { minX: -halfWidth, maxX: halfWidth, minZ: -halfDepth, maxZ: halfDepth }
  }

  _includeSceneBounds(center, room, margin = WALL_THICKNESS) {
    const halfWidth = room.width * TILE_SIZE / 2 + margin
    const halfDepth = room.height * TILE_SIZE / 2 + margin
    this.sceneBounds.minX = Math.min(this.sceneBounds.minX, center.x - halfWidth)
    this.sceneBounds.maxX = Math.max(this.sceneBounds.maxX, center.x + halfWidth)
    this.sceneBounds.minZ = Math.min(this.sceneBounds.minZ, center.z - halfDepth)
    this.sceneBounds.maxZ = Math.max(this.sceneBounds.maxZ, center.z + halfDepth)
  }

  _includeScenePoint(point, margin = 0) {
    this.sceneBounds.minX = Math.min(this.sceneBounds.minX, point.x - margin)
    this.sceneBounds.maxX = Math.max(this.sceneBounds.maxX, point.x + margin)
    this.sceneBounds.minZ = Math.min(this.sceneBounds.minZ, point.z - margin)
    this.sceneBounds.maxZ = Math.max(this.sceneBounds.maxZ, point.z + margin)
  }

  _doorOutward(side) {
    if (side === 'left') return { x: -1, z: 0 }
    if (side === 'right') return { x: 1, z: 0 }
    if (side === 'top') return { x: 0, z: -1 }
    return { x: 0, z: 1 }
  }

  _doorPoint(room, door, center) {
    const local = this._doorPosition(room, door.side, door.offset)
    return { x: center.x + local.x, z: center.z + local.z }
  }

  _exploredRoomLayout(currentRoom) {
    const centers = new Map([[currentRoom.id, { x: 0, z: 0 }]])
    const connectors = []
    const queue = [currentRoom]
    while (queue.length) {
      const room = queue.shift()
      const center = centers.get(room.id)
      for (const edge of this.run.dungeon.edges.values()) {
        const fromRoom = this.run.dungeon.room(edge.fromRoomId)
        const toRoom = this.run.dungeon.room(edge.toRoomId)
        const endpoint = fromRoom?.id === room.id
          ? { door: edge.fromDoor, otherRoom: toRoom, otherDoor: edge.toDoor }
          : toRoom?.id === room.id
            ? { door: edge.toDoor, otherRoom: fromRoom, otherDoor: edge.fromDoor }
            : null
        if (!endpoint || endpoint.otherRoom?.floor !== currentRoom.floor || !endpoint.otherRoom.visited || centers.has(endpoint.otherRoom.id)) continue
        const ownDoor = this._doorPosition(room, endpoint.door.side, endpoint.door.offset)
        const otherDoor = this._doorPosition(endpoint.otherRoom, endpoint.otherDoor.side, endpoint.otherDoor.offset)
        const outward = this._doorOutward(endpoint.door.side)
        const otherCenter = {
          x: center.x + ownDoor.x + outward.x * GHOST_ROOM_GAP - otherDoor.x,
          z: center.z + ownDoor.z + outward.z * GHOST_ROOM_GAP - otherDoor.z,
        }
        centers.set(endpoint.otherRoom.id, otherCenter)
        connectors.push({
          from: this._doorPoint(room, endpoint.door, center),
          to: this._doorPoint(endpoint.otherRoom, endpoint.otherDoor, otherCenter),
        })
        queue.push(endpoint.otherRoom)
      }
    }
    return { centers, connectors }
  }

  _addGhostRoom(room, center) {
    const group = new THREE.Group()
    group.position.set(center.x, 0, center.z)
    const width = room.width * TILE_SIZE
    const depth = room.height * TILE_SIZE
    const outline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-width / 2, CARD_THICKNESS / 2 + 0.012, -depth / 2),
        new THREE.Vector3(width / 2, CARD_THICKNESS / 2 + 0.012, -depth / 2),
        new THREE.Vector3(width / 2, CARD_THICKNESS / 2 + 0.012, depth / 2),
        new THREE.Vector3(-width / 2, CARD_THICKNESS / 2 + 0.012, depth / 2),
        new THREE.Vector3(-width / 2, CARD_THICKNESS / 2 + 0.012, -depth / 2),
      ]),
      new THREE.LineBasicMaterial({ color: 0x9ab8df, transparent: true, opacity: 0.4, depthWrite: false }),
    )
    group.add(outline)
    for (const door of this.run.dungeon.doorsForRoom(room.id)) {
      const horizontal = door.side === 'top' || door.side === 'bottom'
      const point = this._doorPosition(room, door.side, door.offset)
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? TILE_SIZE * 0.62 : WALL_THICKNESS * 1.65, 0.035, horizontal ? WALL_THICKNESS * 1.65 : TILE_SIZE * 0.62),
        new THREE.MeshBasicMaterial({ color: 0xbc8350, transparent: true, opacity: 0.58, depthWrite: false }),
      )
      marker.position.set(point.x, CARD_THICKNESS / 2 + 0.027, point.z)
      group.add(marker)
    }
    this.structureGroup.add(group)
  }

  _addGhostRoomConnector(from, to) {
    const connector = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(from.x, CARD_THICKNESS / 2 + 0.022, from.z),
        new THREE.Vector3(to.x, CARD_THICKNESS / 2 + 0.022, to.z),
      ]),
      new THREE.LineBasicMaterial({ color: 0x9ab8df, transparent: true, opacity: 0.46, depthWrite: false }),
    )
    this.structureGroup.add(connector)
  }

  _addFloorTransitionGhost(room, door, direction, center = { x: 0, z: 0 }) {
    const point = this._doorPoint(room, door, center)
    const outward = this._doorOutward(door.side)
    const length = TILE_SIZE * 1.16
    const width = TILE_SIZE * 0.62
    const baseHeight = CARD_THICKNESS / 2 + 0.08
    const rise = direction === 'up' ? 1.32 : -1.0
    const slope = Math.atan2(rise, length)
    const end = { x: point.x + outward.x * length, z: point.z + outward.z * length }
    const group = new THREE.Group()
    group.position.set(point.x, 0, point.z)
    group.rotation.y = { bottom: 0, right: Math.PI / 2, top: Math.PI, left: -Math.PI / 2 }[door.side] || 0
    const color = direction === 'up' ? 0x3d566d : 0x304456
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.46, depthWrite: false })
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, length), material)
    ramp.rotation.x = -slope
    ramp.position.set(0, baseHeight + rise / 2, length / 2)
    group.add(ramp)
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, length), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, depthWrite: false }))
      rail.rotation.x = -slope
      rail.position.set(side * width * 0.44, baseHeight + rise / 2 + 0.11, length / 2)
      group.add(rail)
    }
    const endHeight = baseHeight + rise
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.48, 0.055), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.66, depthWrite: false }))
      post.position.set(side * width * 0.34, endHeight + 0.24, length + 0.04)
      group.add(post)
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.055, 0.055), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.66, depthWrite: false }))
    top.position.set(0, endHeight + 0.46, length + 0.04)
    group.add(top)
    this.structureGroup.add(group)
    this._includeScenePoint(end, 0.44)
  }

  _addExploredRoomGhosts(currentRoom) {
    this._resetSceneBounds(currentRoom)
    const { centers, connectors } = this._exploredRoomLayout(currentRoom)
    for (const room of this.run.dungeon.floorRooms(currentRoom.floor)) {
      const center = centers.get(room.id)
      if (!room.visited || room.id === currentRoom.id || !center) continue
      this._addGhostRoom(room, center)
      this._includeSceneBounds(center, room, WALL_THICKNESS + 0.04)
    }
    for (const connector of connectors) this._addGhostRoomConnector(connector.from, connector.to)
    for (const edge of this.run.dungeon.edges.values()) {
      const fromRoom = this.run.dungeon.room(edge.fromRoomId)
      const toRoom = this.run.dungeon.room(edge.toRoomId)
      const endpoint = fromRoom?.floor === currentRoom.floor
        ? { room: fromRoom, door: edge.fromDoor, other: toRoom }
        : toRoom?.floor === currentRoom.floor
          ? { room: toRoom, door: edge.toDoor, other: fromRoom }
          : null
      const center = endpoint && centers.get(endpoint.room.id)
      if (!endpoint || !center || endpoint.other?.floor === currentRoom.floor || !endpoint.room.visited || !endpoint.other?.visited) continue
      this._addFloorTransitionGhost(endpoint.room, endpoint.door, endpoint.other.floor > currentRoom.floor ? 'up' : 'down', center)
    }
  }

  _refreshDoors() {
    for (const mesh of this.doorMeshes) this._setDoorAppearance(mesh)
  }

  _refreshTile(room, position, { force = false } = {}) {
    const face = this.tileMeshByKey.get(tileKey(position))
    const body = face?.userData?.body
    if (!face || !body) return false
    const visual = this._tileVisualState(room, position)
    const { revealed, peeked, flippable } = visual
    if (!force && face.visible && face.userData.visualKey === visual.key) return true
    this._clearItemSprite(face)
    const oldTexture = face.material.map
    const card = revealed || peeked ? this._cardFaceData(room, position) : null
    const standing = revealed && (card?.type === 'monster' || card?.type === 'merchant' || card?.type === 'entry')
    const emptyGround = standing && (card?.type === 'monster' || card?.type === 'merchant' || card?.type === 'entry')
    face.material.map = card
      ? this._makeFrontTexture(card, position, revealed)
      : this._makeBackTexture(this._backAttributeFor(room, position), { unflippable: !flippable })
    face.material.needsUpdate = true
    // Click-through is handled by the custom raycast below. Standing tokens
    // remain visually opaque while their cleared canvas pixels stay transparent.
    face.material.transparent = standing || peeked
    face.material.opacity = peeked ? 0.46 : 1
    face.material.depthWrite = !standing
    face.material.depthTest = !standing
    face.material.color.setHex(revealed || peeked || flippable ? 0xffffff : UNREACHABLE_HIDDEN_CARD_TINT)
    if (!oldTexture?.userData.boardShared) oldTexture?.dispose()
    face.visible = true
    face.userData.lift = 0
    face.userData.press ??= 0
    this._setFacePose(face, this._gridPosition(room, position), standing, !revealed)
    face.renderOrder = tileRenderOrder(position, standing ? 4 : 1)
    face.raycast = standing ? NO_RAYCAST : THREE.Mesh.prototype.raycast
    body.visible = true
    this._styleTileBody(body, room, position, visual)
    if (emptyGround && !face.userData.groundFace) {
      face.userData.groundFace = this._makeEmptyGroundFace(this._gridPosition(room, position), position)
      this.roomGroup.add(face.userData.groundFace)
    }
    if (face.userData.groundFace) face.userData.groundFace.visible = emptyGround
    this._attachItemSprite(face, card, this._gridPosition(room, position), position, revealed)
    this._setEnemyStatusOverlay(face, face.userData.groundFace, revealed && card?.type === 'monster' ? room.entityAt(position) : null)
    face.userData.visualKey = visual.key
    return true
  }

  _refreshRoom(room) {
    for (let r = 0; r < room.height; r += 1) {
      for (let c = 0; c < room.width; c += 1) {
        if (!this._refreshTile(room, { c, r })) return false
      }
    }
    return true
  }

  _queueAnimation(type, payload) {
    const animation = { type, payload }
    if (type === 'flip') animation.sourceBackTexture = this._snapshotFlipBack(payload)
    if (type === 'flip-batch') {
      animation.sourceBackTextures = (payload?.flips || [])
        .map((flip) => this._snapshotFlipBack({ roomId: payload?.roomId, ...flip }))
    }
    this.animationQueue.push(animation)
    this._drainAnimationQueue()
  }

  _snapshotFlipBack({ roomId, position } = {}) {
    const room = this.run.currentRoom
    if (!room || room.id !== roomId || room.id !== this.framedRoomId || !position) return null
    const face = this.tileMeshByKey.get(tileKey(position))
    const texture = face?.visible ? face.material.map : null
    if (!texture) return null
    const snapshot = texture.clone()
    snapshot.userData.boardShared = false
    snapshot.needsUpdate = true
    return snapshot
  }

  _drainAnimationQueue() {
    if (this.movementAnimation || this.attackAnimation || this.flipAnimations.length) return
    while (this.animationQueue.length) {
      const animation = this.animationQueue.shift()
      const started = animation.type === 'move'
        ? this._startMove(animation.payload)
        : animation.type === 'flip-batch'
          ? this._startFlipBatch(animation.payload, animation.sourceBackTextures)
          : animation.type === 'attack'
            ? this._startAttack(animation.payload)
            : this._startFlip(animation.payload, animation.sourceBackTexture)
      if (started) return
      animation.sourceBackTexture?.dispose()
      for (const texture of animation.sourceBackTextures || []) texture?.dispose()
    }
    this._flushPendingRebuild()
  }

  _flushPendingRebuild() {
    if (!this.pendingRebuild || this.movementAnimation || this.attackAnimation || this.flipAnimations.length || this.animationQueue.length) return
    this.pendingRebuild = false
    this.rebuild()
  }

  _startFlip({ roomId, position, backUnflippable = false } = {}, sourceBackTexture = null) {
    const room = this.run.currentRoom
    if (!room || room.id !== roomId || room.id !== this.framedRoomId || !position) return false
    const key = tileKey(position)
    const face = this.tileMeshByKey.get(key)
    if (!face || !face.visible || this.flipAnimations.some((animation) => animation.key === key)) return false
    const point = this._gridPosition(room, position)
    const group = new THREE.Group()
    const startY = (HIDDEN_CARD_THICKNESS - CARD_THICKNESS) / 2 + (face.userData.lift || 0)
    group.position.set(point.x, startY, point.z)
    group.scale.set(HIDDEN_CARD_SCALE, 1, HIDDEN_CARD_SCALE)
    group.rotation.x = Math.PI
    const frontTexture = this._makeFrontTexture(this._cardFaceData(room, position), position, true)
    const backTexture = sourceBackTexture || this._makeBackTexture(this._backAttributeFor(room, position), { unflippable: backUnflippable })
    const front = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_SIZE, CARD_SIZE),
      new THREE.MeshBasicMaterial({ map: frontTexture, side: THREE.DoubleSide, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }),
    )
    front.rotation.x = -Math.PI / 2
    front.position.y = HIDDEN_CARD_THICKNESS / 2 + CARD_FACE_CLEARANCE
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_SIZE, CARD_SIZE),
      new THREE.MeshBasicMaterial({ map: backTexture, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }),
    )
    back.rotation.x = Math.PI / 2
    back.position.y = -HIDDEN_CARD_THICKNESS / 2 - CARD_FACE_CLEARANCE
    const edge = new THREE.Mesh(cardBodyGeometry(CARD_SIZE, CARD_THICKNESS), new THREE.MeshStandardMaterial({ roughness: 0.9 }))
    this._styleTileBody(edge, room, position, { revealed: false, flippable: !backUnflippable })
    edge.position.y = 0
    edge.scale.x = edge.scale.z = 1
    group.add(front, back, edge)
    face.visible = false
    face.userData.body.visible = false
    this.roomGroup.add(group)
    this.flipAnimations.push({ key, group, front, back, edge, startY, frontTexture, backTexture, elapsed: 0, duration: 0.34 })
    return true
  }

  _startFlipBatch({ roomId, flips } = {}, sourceBackTextures = []) {
    if (!Array.isArray(flips) || flips.length === 0) return false
    let started = false
    for (let index = 0; index < flips.length; index += 1) {
      const flip = flips[index]
      const didStart = this._startFlip({ roomId, ...flip }, sourceBackTextures[index])
      if (didStart) started = true
      else sourceBackTextures[index]?.dispose()
    }
    return started
  }

  _startMove({ roomId, from, path } = {}) {
    const room = this.run.dungeon?.room(roomId) || this.run.currentRoom
    if (!room || room.id !== roomId || room.id !== this.framedRoomId || !from || !Array.isArray(path) || path.length === 0) return false
    this._clearPlayerMarker()
    const startFace = this.tileMeshByKey.get(tileKey(from))
    if (startFace?.visible) {
      const oldTexture = startFace.material.map
      startFace.material.map = this._makeFrontTexture({ type: 'empty' }, from)
      startFace.material.needsUpdate = true
      startFace.material.transparent = false
      startFace.material.depthWrite = true
      this._setFacePose(startFace, this._gridPosition(room, from), false)
      startFace.raycast = THREE.Mesh.prototype.raycast
      if (!oldTexture?.userData.boardShared) oldTexture?.dispose()
    }
    const startPoint = this._gridPosition(room, from)
    const group = new THREE.Group()
    group.position.set(startPoint.x, CARD_THICKNESS / 2 + 0.006, startPoint.z)
    group.userData.baseY = CARD_THICKNESS / 2 + 0.006
    const marker = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_SIZE, CARD_SIZE),
      new THREE.MeshBasicMaterial({
        map: this._makeFrontTexture({ type: 'entry' }),
        side: THREE.DoubleSide,
        transparent: true,
        depthTest: false,
      }),
    )
    marker.raycast = NO_RAYCAST
    marker.rotation.order = 'YXZ'
    marker.rotation.set(-STANDING_BACK_LEAN, this.cameraAzimuth, 0)
    marker.userData.cameraFacing = true
    marker.position.y = CARD_SIZE / 2
    marker.renderOrder = tileRenderOrder(from, 8)
    group.add(marker)
    this.roomGroup.add(group)
    const route = [{ ...from }, ...path.map((step) => ({ ...step }))]
    const distances = route.slice(1).map((step, index) => Math.hypot(step.c - route[index].c, step.r - route[index].r))
    const totalDistance = distances.reduce((sum, distance) => sum + distance, 0)
    this.movementAnimation = {
      group,
      room,
      route,
      distances,
      totalDistance,
      elapsed: 0,
      duration: Math.max(0.18, totalDistance * 0.16),
    }
    return true
  }

  _startAttack({ roomId, actor = 'enemy', position } = {}) {
    const room = this.run.currentRoom
    if (!room || room.id !== roomId || room.id !== this.framedRoomId || !position) return false
    const face = this.tileMeshByKey.get(tileKey(position))
    if (!face) return false
    const marker = actor === 'player' && this.playerMarker?.visible ? this.playerMarker : null
    const object = marker || face
    const mesh = marker?.children.find((child) => child?.isMesh && child.material?.map) || face
    if (!object.visible || !mesh?.material) return false

    const sourceTexture = mesh.material.map
    const attackTexture = this.skin === 'whiteline'
      ? null
      : makeCanvasTexture((context) => actor === 'player'
        ? drawStickFigure(context, { armLift: 0, legSpread: 1 })
        : drawStandingToken(context, this._cardFaceData(room, position), { headLift: 0, bodySway: 0 }))
    if (attackTexture) {
      mesh.material.map = attackTexture
      mesh.material.needsUpdate = true
    }
    this.attackAnimation = {
      actor,
      object,
      mesh,
      face,
      tileFace: object === face,
      sourceTexture,
      attackTexture,
      baseScale: object.scale.clone(),
      baseRotationZ: object.rotation.z,
      elapsed: 0,
      duration: ATTACK_ANIMATION_DURATION,
    }
    this._setAttackPose(this.attackAnimation, 0)
    return true
  }

  _setAttackPose(animation, progress) {
    const wave = Math.sin(progress * Math.PI)
    const sway = Math.sin(progress * Math.PI * 4) * wave
    if (animation.attackTexture) {
      if (animation.actor === 'player') {
        redrawCanvasTexture(animation.attackTexture, (context) => drawStickFigure(context, {
          armLift: wave,
          legSpread: 1 - wave * 0.35,
        }))
      } else {
        redrawCanvasTexture(animation.attackTexture, (context) => drawStandingToken(
          context,
          this._cardFaceData(this.run.currentRoom, animation.face.userData.position),
          { headLift: wave, bodySway: sway },
        ))
      }
    }
    const lift = animation.actor === 'player' ? wave * PLAYER_ATTACK_LIFT : wave * ENEMY_ATTACK_LIFT
    const baseY = animation.tileFace
      ? animation.face.userData.baseY
      : animation.object.userData.baseY || animation.object.position.y
    const heldOffset = animation.tileFace
      ? (animation.face.userData.lift || 0) + (animation.face.userData.press || 0)
      : (animation.face.userData.press || 0)
    animation.object.position.y = baseY + heldOffset + lift
    animation.object.rotation.z = animation.baseRotationZ + (animation.actor === 'enemy' ? sway * 0.045 : Math.sin(progress * Math.PI * 2) * 0.035)
  }

  _clearAttackAnimation({ continueQueue = false } = {}) {
    const animation = this.attackAnimation
    if (!animation) return
    if (animation.mesh?.material && animation.mesh.material.map === animation.attackTexture) {
      animation.mesh.material.map = animation.sourceTexture || null
      animation.mesh.material.needsUpdate = true
    }
    animation.object.scale.copy(animation.baseScale)
    animation.object.rotation.z = animation.baseRotationZ
    const baseY = animation.tileFace
      ? animation.face.userData.baseY
      : animation.object.userData.baseY || animation.object.position.y
    const heldOffset = animation.tileFace
      ? (animation.face.userData.lift || 0) + (animation.face.userData.press || 0)
      : (animation.face.userData.press || 0)
    animation.object.position.y = baseY + heldOffset
    animation.attackTexture?.dispose()
    this.attackAnimation = null
    if (continueQueue) {
      this._drainAnimationQueue()
      this._emitMoveCompleteIfIdle()
    }
  }

  _clearMovementAnimation() {
    const animation = this.movementAnimation
    if (!animation) return
    this.roomGroup.remove(animation.group)
    disposeObject(animation.group)
    this.movementAnimation = null
  }

  _clearPlayerMarker() {
    if (!this.playerMarker) return
    this.roomGroup.remove(this.playerMarker)
    disposeObject(this.playerMarker)
    this.playerMarker = null
  }

  _releaseFootprints() {
    this.depressedTileKeys.clear()
    this.lastFootprintKey = null
    this.lastFootprintTurn = 0
  }

  _landFootprint(position) {
    const key = tileKey(position)
    if (this.lastFootprintKey && this.lastFootprintKey !== key) this.depressedTileKeys.delete(this.lastFootprintKey)
    this.depressedTileKeys.add(key)
    this.lastFootprintKey = key
    this.lastFootprintTurn = this.run.turns.globalTurn
  }

  _updateMovementAnimation(delta) {
    const animation = this.movementAnimation
    if (!animation) return
    animation.elapsed += delta
    const progress = Math.min(1, animation.elapsed / animation.duration)
    const travelled = animation.totalDistance * progress
    let accumulated = 0
    let segmentIndex = animation.distances.length - 1
    for (let index = 0; index < animation.distances.length; index += 1) {
      if (travelled <= accumulated + animation.distances[index]) {
        segmentIndex = index
        break
      }
      accumulated += animation.distances[index]
    }
    const from = animation.route[segmentIndex]
    const to = animation.route[segmentIndex + 1]
    const segmentDistance = animation.distances[segmentIndex] || 1
    const ratio = Math.min(1, Math.max(0, (travelled - accumulated) / segmentDistance))
    const room = animation.room
    if (room && to) {
      const start = this._gridPosition(room, from)
      const end = this._gridPosition(room, to)
      animation.group.position.set(
        THREE.MathUtils.lerp(start.x, end.x, ratio),
        CARD_THICKNESS / 2 + 0.006 + Math.sin(progress * Math.PI) * 0.13,
        THREE.MathUtils.lerp(start.z, end.z, ratio),
      )
      const marker = animation.group.children[0]
      if (marker) marker.renderOrder = tileRenderOrder({ r: from.r + (to.r - from.r) * ratio }, 8)
    }
    if (progress < 1) return
    this.movementAnimation = null
    this.playerMarker = animation.group
    const landed = animation.route.at(-1)
    if (landed) {
      this.playerMarker.userData.footprintKey = tileKey(landed)
      this._landFootprint(landed)
    }
    this.moveCompletionPending = true
    this._drainAnimationQueue()
    this._emitMoveCompleteIfIdle()
  }

  _emitMoveCompleteIfIdle() {
    if (!this.moveCompletionPending || this.movementAnimation || this.attackAnimation || this.flipAnimations.length || this.animationQueue.length) return
    this.moveCompletionPending = false
    this.run.bus?.emit('animate:move-complete')
  }

  _showPathPreview(preview, { doorId = null } = {}) {
    const room = this.run.currentRoom
    if (!room || !preview?.target) return
    this._clearPathPreview()
    const group = new THREE.Group()
    const color = preview.danger ? 0xff786f : 0x76dcff
    const linePositions = [{ ...this.run.player.pos }, ...(preview.path || [])]
    if (linePositions.length > 1) {
      const points = linePositions.map((position) => {
        const point = this._gridPosition(room, position)
        return new THREE.Vector3(point.x, CARD_THICKNESS / 2 + 0.05, point.z)
      })
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const material = new THREE.LineDashedMaterial({
        color,
        dashSize: 0.16,
        gapSize: 0.1,
        transparent: true,
        opacity: 0.96,
        depthTest: false,
      })
      const line = new THREE.Line(geometry, material)
      line.computeLineDistances()
      group.add(line)
    }
    const arrival = preview.arrival || preview.path?.at(-1) || this.run.player.pos
    const targetPoint = preview.doorId
      ? this._doorPosition(room, this.run.dungeon.door(preview.doorId).side, this.run.dungeon.door(preview.doorId).offset)
      : this._gridPosition(room, preview.target)
    if (preview.targeted) {
      const arrivalPoint = this._gridPosition(room, arrival)
      const baseHeight = CARD_THICKNESS / 2 + 0.05
      const distance = Math.hypot(arrivalPoint.x - targetPoint.x, arrivalPoint.z - targetPoint.z)
      if (distance > 0) {
        const arcHeight = Math.min(1.08, Math.max(0.42, distance * 0.34))
        const controlPoint = new THREE.Vector3(
          (arrivalPoint.x + targetPoint.x) / 2,
          baseHeight + arcHeight * 2,
          (arrivalPoint.z + targetPoint.z) / 2,
        )
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(arrivalPoint.x, baseHeight, arrivalPoint.z),
          controlPoint,
          new THREE.Vector3(targetPoint.x, baseHeight, targetPoint.z),
        )
        const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(Math.max(12, Math.ceil(distance * 16))))
        const material = new THREE.LineDashedMaterial({
          color,
          dashSize: 0.12,
          gapSize: 0.08,
          transparent: true,
          opacity: 0.96,
          depthTest: false,
        })
        const arc = new THREE.Line(geometry, material)
        arc.computeLineDistances()
        group.add(arc)
      }
    }
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.35, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false }),
    )
    marker.rotation.x = -Math.PI / 2
    marker.position.set(targetPoint.x, CARD_THICKNESS / 2 + 0.055, targetPoint.z)
    group.add(marker)
    this.roomGroup.add(group)
    this.pathPreview = { target: { ...preview.target }, doorId, group }
  }

  _clearPathPreview() {
    if (!this.pathPreview) return
    this.roomGroup.remove(this.pathPreview.group)
    disposeObject(this.pathPreview.group)
    this.pathPreview = null
  }

  _setHoveredTile(key) {
    this.hoveredTileKey = key
    this.renderer.domElement.style.cursor = key ? 'pointer' : 'grab'
  }

  _pickTile(event) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.roomGroup.updateMatrixWorld(true)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const pickableTiles = this.tileMeshes
      .filter((mesh) => mesh.visible)
      .flatMap((mesh) => mesh.userData.groundFace?.visible ? [mesh.userData.groundFace] : [mesh])
    return this.raycaster.intersectObjects(pickableTiles, false)[0]?.object || null
  }

  _pickDoor(event) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.roomGroup.updateMatrixWorld(true)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    return this.raycaster.intersectObjects(this.doorMeshes, false)[0]?.object || null
  }

  _updateHover(event) {
    const door = this._pickDoor(event)
    if (door?.userData?.doorId) {
      this._setHoveredTile(null)
      this.renderer.domElement.style.cursor = this.run.previewDoorAction(door.userData.doorId) ? 'pointer' : 'grab'
      return
    }
    const face = this._pickTile(event)
    const position = face?.userData?.position
    const key = this.run.phase === 'explore' && position && this.run.tileCanBeFlipped(position) ? tileKey(position) : null
    this._setHoveredTile(key)
  }

  _updateHoverLift() {
    for (const [key, face] of this.tileMeshByKey) {
      const position = face.userData.position
      const canLift = face.visible && key === this.hoveredTileKey && this.run.tileCanBeFlipped(position)
      const target = canLift ? 0.16 : 0
      face.userData.lift += (target - face.userData.lift) * 0.22
      const pressTarget = this.depressedTileKeys.has(key) ? -FOOTPRINT_PRESS_DEPTH : 0
      face.userData.press = (face.userData.press || 0) + (pressTarget - (face.userData.press || 0)) * 0.2
      const offset = face.userData.lift + face.userData.press
      face.position.y = face.userData.baseY + offset
      face.userData.body.position.y = (face.userData.body.userData.baseY || 0) + offset
      if (key === this.playerMarker?.userData?.footprintKey) this.playerMarker.position.y = (this.playerMarker.userData.baseY || 0) + face.userData.press
    }
  }

  _updateItemSprites(delta) {
    for (const face of this.tileMeshes) {
      const sprite = face?.userData?.itemSprite
      const spin = sprite?.userData?.itemSpin
      if (!sprite || !spin) continue
      spin.elapsed += delta
      spin.angle = (spin.angle + delta * spin.speed) % (Math.PI * 2)
      sprite.rotation.y = this.cameraAzimuth + spin.angle
      sprite.position.y = spin.baseY + Math.sin(spin.elapsed * ITEM_SPRITE_FLOAT_SPEED) * ITEM_SPRITE_FLOAT_AMPLITUDE
    }
  }

  _updateFlipAnimations(delta) {
    for (let index = this.flipAnimations.length - 1; index >= 0; index--) {
      const animation = this.flipAnimations[index]
      animation.elapsed += delta
      const progress = Math.min(1, animation.elapsed / animation.duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      animation.group.rotation.x = Math.PI * (1 - eased)
      animation.group.position.y = THREE.MathUtils.lerp(animation.startY, CARD_THICKNESS / 2, eased) + Math.sin(eased * Math.PI) * 0.28
      const thickness = HIDDEN_CARD_THICKNESS * (1 - eased)
      animation.front.position.y = thickness / 2 + 0.002
      animation.back.position.y = -thickness / 2 - 0.002
      animation.edge.scale.y = Math.max(0.001, thickness / CARD_THICKNESS)
      animation.group.scale.x = animation.group.scale.z = THREE.MathUtils.lerp(HIDDEN_CARD_SCALE, 1, eased)
      if (progress < 1) continue
      this.roomGroup.remove(animation.group)
      disposeObject(animation.group)
      this.flipAnimations.splice(index, 1)
      const room = this.run.currentRoom
      const face = this.tileMeshByKey.get(animation.key)
      if (room?.id === this.framedRoomId && face?.userData?.position) this._refreshTile(room, face.userData.position, { force: true })
    }
    if (this.flipAnimations.length === 0) {
      this._drainAnimationQueue()
      this._emitMoveCompleteIfIdle()
    }
  }

  _updateAttackAnimation(delta) {
    const animation = this.attackAnimation
    if (!animation) return
    animation.elapsed += delta
    const progress = Math.min(1, animation.elapsed / animation.duration)
    this._setAttackPose(animation, progress)
    if (progress < 1) return
    this._clearAttackAnimation({ continueQueue: true })
  }

  _backAttributeFor(room, position) {
    const entity = room.entityAt(position)
    if (entity?.kind === 'enemy') return entity.attribute
    if (entity?.kind === 'item' && entity.item?.type === 'weapon') return entity.item.attribute
    return null
  }

  _makeBackTexture(attribute, { unflippable = false } = {}) {
    if (this.skin === 'whiteline') {
      return makeCanvasTexture((context) => drawWhiteLineCard(context, { label: unflippable ? 'BLOCKED' : 'CARD', back: true }))
    }
    return this.boardTextures.back(attribute, unflippable)
  }

  _makeFrontTexture(card, position = null, revealed = false) {
    if (this.skin === 'whiteline') {
      const label = WHITE_LINE_CARD_LABELS[card?.type] || 'OBJECT'
      const rawValue = card?.type === 'monster' && Number.isFinite(card.maxValue) ? `${card.value}/${card.maxValue}` : card?.value || ''
      const value = /^[\x20-\x7e]+$/.test(String(rawValue)) ? rawValue : ''
      const detail = card?.type === 'monster' ? `ATK ${card.attack || 0} / RANGE ${card.range || 1}` : card?.type === 'weapon' ? `ATK ${card.attack || 0} / RANGE ${card.range || 1}` : ''
      return makeCanvasTexture((context) => drawWhiteLineCard(context, { label, value, detail }))
    }
    const entity = position ? this.run.currentRoom?.entityAt(position) : null
    const item = card?.item || (entity?.kind === 'item' ? entity.item : null)
    if (revealed && itemSpriteSources(item)) return this.boardTextures.floor(position)
    if (card.type === 'empty') return this.boardTextures.floor(position)
    return makeCanvasTexture((context) => {
      if (card.type === 'monster') {
        drawStandingToken(context, card)
        return
      }
      if (card.type === 'merchant') {
        drawStandingToken(context, card)
        return
      }
      if (card.type === 'entry') {
        context.clearRect(0, 0, 160, 160)
        drawStickFigure(context)
        return
      }
      const base = CARD_COLORS[card.type] || CARD_COLORS.empty
      const gradient = context.createLinearGradient(0, 0, 0, 160)
      gradient.addColorStop(0, base)
      gradient.addColorStop(1, '#0a0a12')
      context.fillStyle = gradient
      context.fillRect(0, 0, 160, 160)
      if (card.type === 'empty') {
        drawEmptyCardBase(context)
        return
      }
      context.strokeStyle = card.boss ? '#d98080' : '#888'
      context.lineWidth = card.boss ? 5 : 3
      context.strokeRect(4, 4, 152, 152)
      if (card.attribute && card.type !== 'weapon') drawAttributeLabel(context, card.attribute)
      const isBuff = card.type === 'buff'
      const isMonster = card.type === 'monster'
      const isWeapon = card.type === 'weapon'
      const value = isMonster && Number.isFinite(card.maxValue) ? `${card.value}/${card.maxValue}` : card.value
      const subtitle = isMonster || isWeapon ? card.subtitle : ''
      const detail = isMonster ? `ATK ${card.attack}` : isWeapon ? `\u6c14 ${card.energyCost} \u00b7 \u5c04\u7a0b ${card.range}` : card.type === 'door' ? card.detail : ''
      const footer = isMonster ? card.footer : ''
      const valueColor = isWeapon ? getAttributeDefinition(card.attribute)?.color || card.valueColor || '#fff' : card.valueColor || '#fff'
      drawCenteredText(context, card.title, 32, { color: card.boss ? '#fbb' : '#fff', size: 22, weight: 'bold' })
      if (!isBuff && subtitle) drawCenteredText(context, subtitle, 50, { color: '#ffa', size: 14 })
      if (value) drawCenteredText(context, value, 90, { color: valueColor, size: 36, weight: 'bold' })
      if (!isBuff && detail) drawCenteredText(context, detail, 116, { color: '#d8e4ff', size: 14 })
      if (!isBuff && footer) drawCenteredText(context, footer, 136, { color: card.footerColor || '#ffd56b', size: 13, weight: 'bold' })
    })
  }

  _cardFaceData(room, position) {
    if (position.c === this.run.player.pos.c && position.r === this.run.player.pos.r) {
      return {
        type: 'entry',
        title: '你',
        subtitle: '当前位置',
        value: `HP ${this.run.player.hp}/${this.run.player.maxHp}`,
        valueColor: '#f4dca7',
        detail: `护甲 ${this.run.player.armor}`,
      }
    }
    const entity = room.entityAt(position)
    if (!entity) return { type: 'empty', title: '空地', value: '·', valueColor: '#9aa4b5' }
    if (entity.kind === 'enemy') {
      return {
        type: 'monster',
        title: entity.name,
        subtitle: enemyCardSubtitle(entity),
        value: String(Math.max(0, entity.hp)),
        valueColor: entity.boss ? '#ff7777' : '#ff7777',
        maxValue: entity.maxHp,
        attack: entity.attack,
        detail: `血 ${Math.max(0, entity.hp)}/${entity.maxHp}  攻 ${entity.attack}`,
        footer: `射程 ${entity.range}`,
        attribute: entity.attribute,
        boss: !!entity.boss,
      }
    }
    if (entity.kind === 'item') return { ...this._itemCardFaceData(entity.item), item: entity.item, attribute: entity.item.type === 'weapon' ? entity.item.attribute : null }
    if (entity.kind === 'trap') {
      const triggered = entity.triggered === true
      return {
        type: 'trap',
        title: entity.name,
        value: triggered ? '✓' : '!',
        valueColor: triggered ? '#d2b9c0' : '#ffabb7',
        detail: triggered ? '已触发' : '未触发',
        footer: triggered ? '下一个全局回合后消失' : '触发后显示',
      }
    }
    if (entity.kind === 'gold') {
      return { type: 'gold', title: '金币', value: `+${entity.amount}`, valueColor: '#ffd56b', detail: '点击拾取', clickHint: '点击拾取' }
    }
    if (entity.kind === 'key') {
      return { type: 'key', title: '开门机关', value: '锁', valueColor: '#d8b7ff', detail: '解锁对应的门', clickHint: '点击拾取' }
    }
    if (entity.kind === 'door') {
      const locked = this.run.isDoorLocked(entity)
      return {
        type: 'door',
        title: '门',
        value: locked ? '锁' : '→',
        valueColor: locked ? '#ffb86e' : '#86d7ff',
        detail: locked ? '机关锁住' : '连接下一个房间',
        footer: locked ? '找到开门机关' : '点击进入',
      }
    }
    if (entity.kind === 'merchant') {
      return { type: 'merchant', title: entity.name, value: '商人', valueColor: '#ffd56b', detail: '点击交谈' }
    }
    return { type: 'empty', title: '未知牌', value: '?' }
  }

  _itemCardFaceData(item) {
    if (item.type === 'defense' || item.type === 'material') {
      return { type: 'item', title: item.name, value: item.type === 'defense' ? '防具' : '材料', valueColor: '#d8ccac', detail: '背包内被动生效', clickHint: '点击拾取' }
    }
    if (item.type === 'weapon') {
      return {
        type: 'weapon',
         title: item.name,
         subtitle: WEAPON_CLASS_LABELS[item.weaponClass] || '\u6b66\u5668',
        value: String(item.attack),
        valueColor: '#a9d8ff',
        energyCost: this.run.weaponEnergyCost(item),
        range: this.run.weaponRange(item),
        detail: `ATK ${item.attack} · EN ${this.run.weaponEnergyCost(item)}`,
        footer: `射程 ${this.run.weaponRange(item)}`,
        clickHint: '点击拾取',
      }
    }
    if (item.type === 'potion') {
      return { type: 'potion', title: item.name, value: `+${item.heal} HP`, valueColor: '#8eff9f', detail: '使用后生效', footer: '消耗行动', clickHint: '点击拾取' }
    }
    if (item.type === 'armor') {
      return { type: 'potion', title: item.name, value: `ARMOR +${item.armor}`, valueColor: '#8ed7ff', detail: '使用后获得护甲', footer: '消耗行动', clickHint: '点击拾取' }
    }
    if (item.type === 'energy') {
      return { type: 'energy', title: item.name, value: `+${item.energy} \u4f53\u529b`, valueColor: '#ffd56b', detail: '\u4f7f\u7528\u540e\u6062\u590d\u4f53\u529b', footer: '\u6d88\u8017\u884c\u52a8', clickHint: '\u70b9\u51fb\u62fe\u53d6' }
    }
    if (item.type === 'buff') {
      return { type: 'buff', title: item.name, value: `攻击 +${item.attackBonus}`, valueColor: '#8effc8', detail: '下次攻击生效', footer: '消耗行动', clickHint: '点击拾取' }
    }
    if (item.type === 'relic') {
      return { type: 'relic', title: item.name, value: '✦', valueColor: '#e5d5ff', detail: '放入背包后生效', clickHint: '点击拾取' }
    }
    return { type: 'item', title: item.name || '道具', value: '道具', clickHint: '点击拾取' }
  }

  _frameRoom(room, { resetView = false } = {}) {
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    const aspect = width / height
    const verticalFov = THREE.MathUtils.degToRad(CAMERA_FOV)
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect)
    const bounds = {
      minX: -room.width * TILE_SIZE / 2,
      maxX: room.width * TILE_SIZE / 2,
      minZ: -room.height * TILE_SIZE / 2,
      maxZ: room.height * TILE_SIZE / 2,
    }
    const halfWidth = Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX)) + 0.75
    const halfDepth = Math.max(Math.abs(bounds.minZ), Math.abs(bounds.maxZ)) + 0.75
    const widthDistance = halfWidth / Math.tan(horizontalFov / 2)
    const depthDistance = halfDepth / Math.tan(verticalFov / 2)
    this.baseCameraDistance = Math.max(widthDistance, depthDistance) * 0.68
    if (resetView) {
      this.zoom = DEFAULT_ZOOM
      const playerPoint = this._gridPosition(room, this.run.player.pos)
      this.roomGroup.position.set(-playerPoint.x, 0, -playerPoint.z)
    }
    this.camera.aspect = aspect
    this._updateCamera()
    if (!resetView) this._clampPan(room)
  }

  _updateCamera() {
    const room = this.run.currentRoom
    this.cameraAzimuth = panAzimuth(-this.roomGroup.position.x, room ? room.width * TILE_SIZE / 2 + BOUNDARY_GAP : 0)
    const distance = this.baseCameraDistance / this.zoom
    const orbitDistance = distance * CAMERA_ORBIT_DISTANCE_RATIO
    const horizontal = orbitDistance * Math.cos(this.cameraElevation)
    this.camera.position.set(
      Math.sin(this.cameraAzimuth) * horizontal,
      -0.35 + orbitDistance * Math.sin(this.cameraElevation),
      Math.cos(this.cameraAzimuth) * horizontal,
    )
    this.camera.lookAt(0, -0.35, 0)
    this.camera.updateProjectionMatrix()
    this.camera.updateMatrixWorld(true)
    this._updateCameraFacingTokens()
  }

  adjustCameraPitch(direction = 0) {
    const amount = Math.sign(Number(direction) || 0)
    if (!amount) return
    this.cameraElevation = THREE.MathUtils.clamp(
      this.cameraElevation + amount * CAMERA_ELEVATION_STEP,
      MIN_CAMERA_ELEVATION,
      MAX_CAMERA_ELEVATION,
    )
    this._updateCamera()
  }

  cameraAngles() {
    return {
      azimuth: Math.round(THREE.MathUtils.radToDeg(this.cameraAzimuth)),
      pitch: Math.round(THREE.MathUtils.radToDeg(this.cameraElevation)),
    }
  }

  _updateCameraFacingTokens() {
    for (const face of this.tileMeshes) {
      if (face?.userData?.standing) face.rotation.y = this.cameraAzimuth
      const sprite = face?.userData?.itemSprite
      const spin = sprite?.userData?.itemSpin
      if (sprite && spin) sprite.rotation.y = this.cameraAzimuth + spin.angle
    }
    for (const group of [this.movementAnimation?.group, this.playerMarker]) {
      for (const child of group?.children || []) {
        if (child?.userData?.cameraFacing) child.rotation.y = this.cameraAzimuth
      }
    }
  }

  _resize(force = false) {
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    if (!force && width === this.viewportWidth && height === this.viewportHeight) return
    this.viewportWidth = width
    this.viewportHeight = height
    this.renderer.setSize(width, height)
    if (this.run.currentRoom) this._frameRoom(this.run.currentRoom)
  }

  _setZoom(value) {
    this.zoom = THREE.MathUtils.clamp(value, MIN_ZOOM, MAX_ZOOM)
    this._updateCamera()
    this._clampPan(this.run.currentRoom)
  }

  _clampPan(room) {
    if (!room) return
    const bounds = this.sceneBounds || {
      minX: -room.width * TILE_SIZE / 2,
      maxX: room.width * TILE_SIZE / 2,
      minZ: -room.height * TILE_SIZE / 2,
      maxZ: room.height * TILE_SIZE / 2,
    }
    const limitX = Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX)) + 1.2
    const limitZ = Math.max(Math.abs(bounds.minZ), Math.abs(bounds.maxZ)) + 1.2
    this.roomGroup.position.x = THREE.MathUtils.clamp(this.roomGroup.position.x, -limitX, limitX)
    this.roomGroup.position.z = THREE.MathUtils.clamp(this.roomGroup.position.z, -limitZ, limitZ)
    this._updateCamera()
  }

  _pointerPosition(event) {
    return { x: event.clientX, y: event.clientY }
  }

  _groundPoint(event, camera = this.camera) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, camera)
    return this.raycaster.ray.intersectPlane(this.groundPlane, new THREE.Vector3())
  }

  _pinchDistance() {
    const [first, second] = [...this.activePointers.values()]
    return first && second ? Math.hypot(first.x - second.x, first.y - second.y) : 0
  }

  _startBoardHold(event) {
    const position = this._pickTile(event)?.userData?.position
    if (!position) return
    if (this.run.itemTargeting && this.run.selectedItem?.type === 'teleport') {
      this._clearPathPreview()
      this.run.clickTile(position.c, position.r)
      return
    }
    const hold = {
      pointerId: event.pointerId,
      position: { ...position },
      opened: false,
      triggered: false,
      timer: null,
    }
    hold.timer = window.setTimeout(() => {
      if (this.boardHold !== hold || this.drag?.moved || this.pinch) return
      hold.triggered = true
      hold.opened = this.run.showBoardDetail(hold.position)
    }, LONG_PRESS_MS)
    this.boardHold = hold
  }

  _cancelBoardHold({ close = false } = {}) {
    const hold = this.boardHold
    if (!hold) return false
    window.clearTimeout(hold.timer)
    this.boardHold = null
    if (close && hold.opened) this.run.closeDetail()
    return hold.triggered
  }

  _handlePointerDown(event) {
    this.renderer.domElement.setPointerCapture?.(event.pointerId)
    this.activePointers.set(event.pointerId, this._pointerPosition(event))
    if (this.activePointers.size === 1) {
      this.lastDragMoved = false
      this.drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        boardX: this.roomGroup.position.x,
        boardZ: this.roomGroup.position.z,
        startWorld: this._groundPoint(event),
        projectionCamera: this.camera.clone(),
        moved: false,
      }
      this._startBoardHold(event)
    } else if (this.activePointers.size === 2) {
      this._cancelBoardHold({ close: true })
      this.pinch = { distance: this._pinchDistance(), zoom: this.zoom, moved: false }
      this.drag = null
    }
  }

  _handlePointerMove(event) {
    this._updateHover(event)
    if (!this.activePointers.has(event.pointerId)) return
    this.activePointers.set(event.pointerId, this._pointerPosition(event))
    if (this.pinch && this.activePointers.size >= 2) {
      const distance = this._pinchDistance()
      if (Math.abs(distance - this.pinch.distance) >= 2) this.pinch.moved = true
      if (this.pinch.distance > 0) this._setZoom(this.pinch.zoom * distance / this.pinch.distance)
      return
    }
    if (!this.drag || this.drag.pointerId !== event.pointerId) return
    const deltaX = event.clientX - this.drag.startX
    const deltaY = event.clientY - this.drag.startY
    if (Math.abs(deltaX) + Math.abs(deltaY) > DRAG_THRESHOLD) {
      this.drag.moved = true
      this._cancelBoardHold({ close: true })
    }
    if (!this.drag.moved) return
    // Freeze the drag projection so auto-rotation cannot feed back into panning.
    const currentWorld = this._groundPoint(event, this.drag.projectionCamera)
    if (!this.drag.startWorld || !currentWorld) return
    this.roomGroup.position.x = this.drag.boardX + currentWorld.x - this.drag.startWorld.x
    this.roomGroup.position.z = this.drag.boardZ + currentWorld.z - this.drag.startWorld.z
    this._clampPan(this.run.currentRoom)
  }

  _handlePointerUp(event) {
    if (!this.activePointers.has(event.pointerId)) return
    const wasPinching = !!this.pinch
    const pinchMoved = this.pinch?.moved
    const dragMoved = this.drag?.moved
    const longPressTriggered = this.boardHold?.pointerId === event.pointerId
      ? this._cancelBoardHold({ close: true })
      : false
    this.activePointers.delete(event.pointerId)
    this.renderer.domElement.releasePointerCapture?.(event.pointerId)
    if (wasPinching) this.pinch = null
    this.drag = null
    this.lastDragMoved = this.lastDragMoved || !!pinchMoved || !!dragMoved || longPressTriggered
  }

  _handleWheel(event) {
    event.preventDefault()
    this._setZoom(this.zoom * Math.exp(-event.deltaY * 0.0015))
  }

  _handleClick(event) {
    if (this.lastDragMoved) {
      this.lastDragMoved = false
      return
    }
    if (this.movementAnimation || this.attackAnimation || this.flipAnimations.length || this.animationQueue.length) return
    const door = this._pickDoor(event)
    if (door?.userData?.doorId) {
      const doorId = door.userData.doorId
      const preview = this.run.previewDoorAction(doorId)
      if (!preview) {
        this._clearPathPreview()
        this.run.clickDoor(doorId)
        return
      }
      if (preview.path.length === 0 || this.pathPreview?.doorId === doorId) {
        this._clearPathPreview()
        this.run.clickDoor(doorId)
        return
      }
      this._showPathPreview(preview, { doorId })
      return
    }
    const position = this._pickTile(event)?.userData?.position
    if (!position) return
    const previewedDoorId = this.pathPreview?.doorId
    if (previewedDoorId && samePosition(this.pathPreview.target, position) && this.run.previewDoorAction(previewedDoorId)) {
      this._clearPathPreview()
      this.run.clickDoor(previewedDoorId)
      return
    }
    const preview = this.run.previewTileAction(position.c, position.r)
    if (preview && isAdjacent8(this.run.player.pos, position)) {
      this._clearPathPreview()
      this.run.clickTile(position.c, position.r)
      return
    }
    if (samePosition(this.pathPreview?.target, position)) {
      this._clearPathPreview()
      if (preview) this.run.clickTile(position.c, position.r)
      return
    }
    if (preview) this._showPathPreview(preview)
    else this._clearPathPreview()
  }

  _animate() {
    this._resize()
    const now = Date.now()
    const delta = Math.min(0.05, Math.max(0, (now - (this.lastFrameTime || now)) / 1000))
    this.lastFrameTime = now
    this._updateMovementAnimation(delta)
    this._updateFlipAnimations(delta)
    this._updateItemSprites(delta)
    this._updateHoverLift()
    this._updateAttackAnimation(delta)
    this.renderer.render(this.scene, this.camera)
    this._frame = requestAnimationFrame(this._animate)
  }

  dispose() {
    cancelAnimationFrame(this._frame)
    this._cancelBoardHold({ close: true })
    this.unsubscribe?.()
    this.moveUnsubscribe?.()
    window.removeEventListener('resize', this._onResize)
    this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown)
    this.renderer.domElement.removeEventListener('pointermove', this._onPointerMove)
    this.renderer.domElement.removeEventListener('pointerup', this._onPointerUp)
    this.renderer.domElement.removeEventListener('pointercancel', this._onPointerUp)
    this.renderer.domElement.removeEventListener('pointerleave', this._onPointerLeave)
    this.renderer.domElement.removeEventListener('click', this._onClick)
    this.renderer.domElement.removeEventListener('wheel', this._onWheel)
    this.flipUnsubscribe?.()
    this.flipBatchUnsubscribe?.()
    this.attackUnsubscribe?.()
    this._clearPathPreview()
    this._clearAttackAnimation()
    this._clearMovementAnimation()
    this._clearPlayerMarker()
    disposeObject(this.roomGroup)
    this.boardTextures?.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
