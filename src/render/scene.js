import * as THREE from 'three'
import { getAttributeDefinition } from '../game/data/attributes.js'
import { enemyCardSubtitle } from '../game/data/enemy-features.js'
import { isAdjacent8 } from '../game/core/geometry.js'

const TILE_SIZE = 1.14
const CARD_SIZE = TILE_SIZE
const CARD_THICKNESS = 0.08
const WALL_THICKNESS = 0.14
const DOOR_DEPTH = WALL_THICKNESS * 1.4
const BOUNDARY_GAP = 0.012
const WALL_HEIGHT = 0.44
const HIDDEN_CARD_BODY_COLOR = 0x17172b
const UNREACHABLE_HIDDEN_CARD_BODY_COLOR = HIDDEN_CARD_BODY_COLOR
const UNREACHABLE_HIDDEN_CARD_TINT = 0xffffff
const DEFAULT_ZOOM = 1
const MIN_ZOOM = 0.66
const MAX_ZOOM = 3.2
const DRAG_THRESHOLD = 8
const LONG_PRESS_MS = 420
const CAMERA_FOV = 45
const CAMERA_NEAR = 0.1
const CAMERA_FAR = 80
const CAMERA_HEIGHT_RATIO = 0.74
const CAMERA_DEPTH_RATIO = 0.41
const CAMERA_AZIMUTH = 30 * Math.PI / 180
const STANDING_BACK_LEAN = 30 * Math.PI / 180
const GHOST_ROOM_GAP = TILE_SIZE * 0.54

const CARD_COLORS = Object.freeze({
  monster: '#5b1a1a',
  weapon: '#1a2b4a',
  potion: '#1a3b2a',
  buff: '#21402e',
  item: '#2a3b4a',
  gold: '#4a3a0a',
  key: '#3a1a4a',
  door: '#4a2a0a',
  merchant: '#3c2a16',
  trap: '#4a2338',
  entry: '#2a2a2a',
  empty: '#20242d',
})

function makeCanvasTexture(draw) {
  const canvas = document.createElement('canvas')
  canvas.width = 480
  canvas.height = 480
  const context = canvas.getContext('2d')
  context.scale(3, 3)
  draw(context)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
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

function drawStickFigure(context) {
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
  context.lineTo(52, 94)
  context.moveTo(80, 76)
  context.lineTo(108, 94)
  context.moveTo(80, 104)
  context.lineTo(57, 132)
  context.moveTo(80, 104)
  context.lineTo(103, 132)
  context.stroke()
}

function drawStandingToken(context, card) {
  context.clearRect(0, 0, 160, 160)
  const merchant = card.type === 'merchant'
  const color = merchant ? '#d5a85d' : card.boss ? '#ff7777' : '#e36b6b'
  context.fillStyle = color
  context.strokeStyle = merchant ? '#ffe3a3' : '#ffc0c0'
  context.lineWidth = 4
  context.beginPath()
  context.moveTo(34, 142)
  context.lineTo(126, 142)
  context.lineTo(80, 58)
  context.closePath()
  context.fill()
  context.stroke()
  context.beginPath()
  context.arc(80, 42, 27, 0, Math.PI * 2)
  context.fill()
  context.stroke()
  const glyph = Array.from(String(card.title || '?'))[0] || '?'
  context.fillStyle = '#241c24'
  context.font = 'bold 29px sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(glyph, 80, 42)
  context.font = 'bold 23px sans-serif'
  context.fillText(String(card.value ?? ''), 80, 112)
}

function tileKey(position) { return `${position.c}:${position.r}` }

function samePosition(left, right) {
  return !!left && !!right && left.c === right.c && left.r === right.r
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.()
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    for (const material of materials) {
      material?.map?.dispose?.()
      material?.dispose?.()
    }
  })
}

export class GameScene {
  constructor(run, container) {
    this.run = run
    this.container = container
    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    this.tileMeshes = []
    this.tileMeshByKey = new Map()
    this.doorMeshes = []
    this.flipAnimations = []
    this.animationQueue = []
    this.movementAnimation = null
    this.playerMarker = null
    this.pathPreview = null
    this.pendingRebuild = false
    this.hoveredTileKey = null
    this.visibleDoorKey = ''
    this.zoom = DEFAULT_ZOOM
    this.framedRoomId = null
    this.viewportWidth = 0
    this.viewportHeight = 0
    this.activePointers = new Map()
    this.drag = null
    this.pinch = null
    this.lastDragMoved = false
    this.boardHold = null
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x111722)
    this.baseCameraDistance = 12
    this.sceneBounds = null
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR)
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.shadowMap.enabled = true
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
    window.addEventListener('resize', this._onResize)
    this.renderer.domElement.addEventListener('pointerdown', this._onPointerDown)
    this.renderer.domElement.addEventListener('pointermove', this._onPointerMove)
    this.renderer.domElement.addEventListener('pointerup', this._onPointerUp)
    this.renderer.domElement.addEventListener('pointercancel', this._onPointerUp)
    this.renderer.domElement.addEventListener('pointerleave', this._onPointerLeave)
    this.renderer.domElement.addEventListener('click', this._onClick)
    this.renderer.domElement.addEventListener('wheel', this._onWheel, { passive: false })
    this.unsubscribe = this.run.on('change', () => {
      this._clearPathPreview()
      this.rebuild()
    })
    this.flipUnsubscribe = this.run.on('animate:flip', this._onFlip)
    this.flipBatchUnsubscribe = this.run.on('animate:flip-batch', this._onFlipBatch)
    this.moveUnsubscribe = this.run.on('animate:move', this._onMove)
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
    if ((this.movementAnimation || this.flipAnimations.length || this.animationQueue.length) && room?.id === this.framedRoomId) {
      this.pendingRebuild = true
      return
    }
    const visibleDoorKey = this._visibleDoorKey(room)
    const sameRoom = room?.id === this.framedRoomId && this.tileMeshes.length === room.width * room.height && this.visibleDoorKey === visibleDoorKey
    if (sameRoom) {
      this._clearPathPreview()
      this._clearMovementAnimation()
      this._clearPlayerMarker()
      if (this._refreshRoom(room)) {
        this._refreshDoors()
        return
      }
    }
    if (room?.id !== this.framedRoomId) {
      this.animationQueue = []
      this.pendingRebuild = false
      this.visibleDoorKey = ''
    }
    this._clearPathPreview()
    this._clearMovementAnimation()
    this._clearPlayerMarker()
    disposeObject(this.roomGroup)
    this.roomGroup.clear()
    this.tileMeshes = []
    this.tileMeshByKey.clear()
    this.doorMeshes = []
    this.sceneBounds = null
    if (!room) return
    const floorTint = [0x111722, 0x111722, 0x151522, 0x1b1625, 0x221628, 0x29172a][room.floor] || 0x111722
    this.scene.background.setHex(floorTint)

    for (let r = 0; r < room.height; r++) {
      for (let c = 0; c < room.width; c++) this._addTile(room, { c, r })
    }
    this._addRoomBoundary(room)
    this._addExploredRoomGhosts(room)
    this._frameRoom(room, { resetView: room.id !== this.framedRoomId })
    this.visibleDoorKey = visibleDoorKey
    this.framedRoomId = room.id
  }

  _addTile(room, position) {
    const visual = this._tileVisualState(room, position)
    const { revealed, peeked, flippable } = visual
    const isPlayer = samePosition(this.run.player.pos, position)
    const geometry = new THREE.BoxGeometry(CARD_SIZE, CARD_THICKNESS, CARD_SIZE)
    const material = new THREE.MeshStandardMaterial({
      color: revealed ? isPlayer ? 0x20242d : 0x262a36 : flippable ? HIDDEN_CARD_BODY_COLOR : UNREACHABLE_HIDDEN_CARD_BODY_COLOR,
      roughness: 0.72,
    })
    const mesh = new THREE.Mesh(geometry, material)
    const point = this._gridPosition(room, position)
    mesh.position.set(point.x, 0, point.z)
    mesh.receiveShadow = true
    this.roomGroup.add(mesh)
    const card = revealed || peeked ? this._cardFaceData(room, position) : null
    const standing = revealed && (card?.type === 'monster' || card?.type === 'merchant' || card?.type === 'entry')
    const texture = card
      ? this._makeFrontTexture(card)
      : this._makeBackTexture(this._backAttributeFor(room, position), { unflippable: !flippable })
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_SIZE, CARD_SIZE),
      new THREE.MeshBasicMaterial({
        map: texture,
        color: revealed || peeked || flippable ? 0xffffff : UNREACHABLE_HIDDEN_CARD_TINT,
        transparent: standing || peeked,
        opacity: peeked ? 0.46 : 1,
        side: THREE.DoubleSide,
        depthWrite: !standing,
      }),
    )
    this._setFacePose(face, point, standing)
    face.userData.position = { ...position }
    face.userData.lift = 0
    face.userData.body = mesh
    face.userData.visualKey = visual.key
    this.roomGroup.add(face)
    this.tileMeshes.push(face)
    this.tileMeshByKey.set(tileKey(position), face)
  }

  _setFacePose(face, point, standing) {
    const baseY = standing ? CARD_SIZE / 2 + CARD_THICKNESS / 2 : CARD_THICKNESS / 2 + 0.002
    face.rotation.order = standing ? 'YXZ' : 'XYZ'
    face.rotation.set(standing ? -STANDING_BACK_LEAN : -Math.PI / 2, standing ? CAMERA_AZIMUTH : 0, 0)
    face.position.set(point.x, baseY, point.z)
    face.userData.baseY = baseY
    face.userData.standing = standing
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
        backAttribute: tile.backAttribute,
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
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? TILE_SIZE : WALL_THICKNESS, WALL_HEIGHT, horizontal ? WALL_THICKNESS : TILE_SIZE),
      new THREE.MeshStandardMaterial({ color: 0x55575c, roughness: 0.84, metalness: 0.08 }),
    )
    mesh.position.set(point.x, WALL_HEIGHT / 2, point.z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.roomGroup.add(mesh)
  }

  _setDoorAppearance(mesh) {
    const door = this.run.dungeon.door(mesh.userData.doorId)
    const locked = this.run.isDoorLocked(door)
    mesh.material.color.setHex(locked ? 0x5a341d : 0x9a6533)
    mesh.material.emissive.setHex(locked ? 0x1c0e05 : 0x2b1608)
    mesh.userData.lockIndicator.visible = locked
  }

  _addDoorMesh(room, door) {
    const horizontal = door.side === 'top' || door.side === 'bottom'
    const point = this._doorPosition(room, door.side, door.offset)
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? TILE_SIZE * 0.72 : DOOR_DEPTH, WALL_HEIGHT + 0.18, horizontal ? DOOR_DEPTH : TILE_SIZE * 0.72),
      new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.46 }),
    )
    mesh.position.set(point.x, (WALL_HEIGHT + 0.18) / 2, point.z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData.doorId = door.id
    const lockIndicator = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeLockIndicatorTexture(), transparent: true, depthTest: false }))
    lockIndicator.position.set(0, WALL_HEIGHT * 0.48, 0)
    lockIndicator.scale.set(0.44, 0.44, 1)
    mesh.userData.lockIndicator = lockIndicator
    mesh.add(lockIndicator)
    this._setDoorAppearance(mesh)
    this.doorMeshes.push(mesh)
    this.roomGroup.add(mesh)
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
    for (const door of doors) this._addDoorMesh(room, door)
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
    this.roomGroup.add(group)
  }

  _addGhostRoomConnector(from, to) {
    const connector = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(from.x, CARD_THICKNESS / 2 + 0.022, from.z),
        new THREE.Vector3(to.x, CARD_THICKNESS / 2 + 0.022, to.z),
      ]),
      new THREE.LineBasicMaterial({ color: 0x9ab8df, transparent: true, opacity: 0.46, depthWrite: false }),
    )
    this.roomGroup.add(connector)
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
    this.roomGroup.add(group)
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
    const oldTexture = face.material.map
    const card = revealed || peeked ? this._cardFaceData(room, position) : null
    const standing = revealed && (card?.type === 'monster' || card?.type === 'merchant' || card?.type === 'entry')
    face.material.map = card
      ? this._makeFrontTexture(card)
      : this._makeBackTexture(this._backAttributeFor(room, position), { unflippable: !flippable })
    face.material.needsUpdate = true
    face.material.transparent = standing || peeked
    face.material.opacity = peeked ? 0.46 : 1
    face.material.depthWrite = !standing
    face.material.color.setHex(revealed || peeked || flippable ? 0xffffff : UNREACHABLE_HIDDEN_CARD_TINT)
    oldTexture?.dispose()
    face.visible = true
    face.userData.lift = 0
    this._setFacePose(face, this._gridPosition(room, position), standing)
    body.visible = true
    body.position.y = 0
    const isPlayer = samePosition(this.run.player.pos, position)
    body.material.color.setHex(revealed ? isPlayer ? 0x20242d : 0x262a36 : flippable ? HIDDEN_CARD_BODY_COLOR : UNREACHABLE_HIDDEN_CARD_BODY_COLOR)
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
    snapshot.needsUpdate = true
    return snapshot
  }

  _drainAnimationQueue() {
    if (this.movementAnimation || this.flipAnimations.length) return
    while (this.animationQueue.length) {
      const animation = this.animationQueue.shift()
      const started = animation.type === 'move'
        ? this._startMove(animation.payload)
        : animation.type === 'flip-batch'
          ? this._startFlipBatch(animation.payload, animation.sourceBackTextures)
          : this._startFlip(animation.payload, animation.sourceBackTexture)
      if (started) return
      animation.sourceBackTexture?.dispose()
      for (const texture of animation.sourceBackTextures || []) texture?.dispose()
    }
    this._flushPendingRebuild()
  }

  _flushPendingRebuild() {
    if (!this.pendingRebuild || this.movementAnimation || this.flipAnimations.length || this.animationQueue.length) return
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
    group.position.set(point.x, CARD_THICKNESS / 2 + 0.004, point.z)
    group.rotation.x = Math.PI
    const frontTexture = this._makeFrontTexture(this._cardFaceData(room, position))
    const backTexture = sourceBackTexture || this._makeBackTexture(this._backAttributeFor(room, position), { unflippable: backUnflippable })
    const front = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_SIZE, CARD_SIZE),
      new THREE.MeshBasicMaterial({ map: frontTexture, side: THREE.DoubleSide, transparent: true }),
    )
    front.rotation.x = -Math.PI / 2
    front.position.y = 0.002
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_SIZE, CARD_SIZE),
      new THREE.MeshBasicMaterial({ map: backTexture, side: THREE.DoubleSide }),
    )
    back.rotation.x = Math.PI / 2
    back.position.y = -0.002
    group.add(front, back)
    face.visible = false
    this.roomGroup.add(group)
    this.flipAnimations.push({ key, group, frontTexture, backTexture, elapsed: 0, duration: 0.34 })
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
    const room = this.run.currentRoom
    if (!room || room.id !== roomId || room.id !== this.framedRoomId || !from || !Array.isArray(path) || path.length === 0) return false
    this._clearPlayerMarker()
    const startFace = this.tileMeshByKey.get(tileKey(from))
    if (startFace?.visible) {
      const oldTexture = startFace.material.map
      startFace.material.map = this._makeFrontTexture({ type: 'empty' })
      startFace.material.needsUpdate = true
      startFace.material.transparent = false
      startFace.material.depthWrite = true
      this._setFacePose(startFace, this._gridPosition(room, from), false)
      oldTexture?.dispose()
    }
    const startPoint = this._gridPosition(room, from)
    const group = new THREE.Group()
    group.position.set(startPoint.x, CARD_THICKNESS / 2 + 0.006, startPoint.z)
    const marker = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_SIZE, CARD_SIZE),
      new THREE.MeshBasicMaterial({ map: this._makeFrontTexture({ type: 'entry' }), side: THREE.DoubleSide, transparent: true }),
    )
    marker.rotation.order = 'YXZ'
    marker.rotation.set(-STANDING_BACK_LEAN, CAMERA_AZIMUTH, 0)
    marker.position.y = CARD_SIZE / 2
    group.add(marker)
    this.roomGroup.add(group)
    const route = [{ ...from }, ...path.map((step) => ({ ...step }))]
    const distances = route.slice(1).map((step, index) => Math.hypot(step.c - route[index].c, step.r - route[index].r))
    const totalDistance = distances.reduce((sum, distance) => sum + distance, 0)
    this.movementAnimation = {
      group,
      route,
      distances,
      totalDistance,
      elapsed: 0,
      duration: Math.max(0.18, totalDistance * 0.16),
    }
    return true
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
    const room = this.run.currentRoom
    if (room && to) {
      const start = this._gridPosition(room, from)
      const end = this._gridPosition(room, to)
      animation.group.position.set(
        THREE.MathUtils.lerp(start.x, end.x, ratio),
        CARD_THICKNESS / 2 + 0.006 + Math.sin(progress * Math.PI) * 0.13,
        THREE.MathUtils.lerp(start.z, end.z, ratio),
      )
    }
    if (progress < 1) return
    this.movementAnimation = null
    this.playerMarker = animation.group
    this._drainAnimationQueue()
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
    return this.raycaster.intersectObjects(this.tileMeshes.filter((mesh) => mesh.visible), false)[0]?.object || null
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
      face.position.y = face.userData.baseY + face.userData.lift
      face.userData.body.position.y = face.userData.lift
    }
  }

  _updateFlipAnimations(delta) {
    for (let index = this.flipAnimations.length - 1; index >= 0; index--) {
      const animation = this.flipAnimations[index]
      animation.elapsed += delta
      const progress = Math.min(1, animation.elapsed / animation.duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      animation.group.rotation.x = Math.PI * (1 - eased)
      animation.group.position.y = CARD_THICKNESS / 2 + 0.004 + Math.sin(eased * Math.PI) * 0.28
      if (progress < 1) continue
      this.roomGroup.remove(animation.group)
      disposeObject(animation.group)
      this.flipAnimations.splice(index, 1)
      const room = this.run.currentRoom
      const face = this.tileMeshByKey.get(animation.key)
      if (room?.id === this.framedRoomId && face?.userData?.position) this._refreshTile(room, face.userData.position, { force: true })
    }
    if (this.flipAnimations.length === 0) this._drainAnimationQueue()
  }

  _backAttributeFor(room, position) {
    const entity = room.entityAt(position)
    return entity?.attribute || entity?.item?.attribute || room.tile(position)?.backAttribute || 'scorch'
  }

  _makeBackTexture(attribute, { unflippable = false } = {}) {
    return makeCanvasTexture((context) => {
      const definition = getAttributeDefinition(attribute) || getAttributeDefinition('scorch')
      const gradient = context.createLinearGradient(0, 0, 0, 160)
      gradient.addColorStop(0, unflippable ? '#18213d' : '#293247')
      gradient.addColorStop(1, unflippable ? '#090e20' : '#141a28')
      context.fillStyle = gradient
      context.fillRect(0, 0, 160, 160)
      context.strokeStyle = unflippable ? '#202b50' : '#46536c'
      context.lineWidth = 4
      context.strokeRect(6, 6, 148, 148)
      context.strokeStyle = definition.color
      context.globalAlpha = unflippable ? 0.15 : 0.3
      context.lineWidth = 3
      context.beginPath()
      context.moveTo(80, 22)
      context.lineTo(132, 80)
      context.lineTo(80, 138)
      context.lineTo(28, 80)
      context.closePath()
      context.stroke()
      context.globalAlpha = unflippable ? 0.085 : 0.17
      context.lineWidth = 2
      context.beginPath()
      context.moveTo(80, 44)
      context.lineTo(110, 80)
      context.lineTo(80, 116)
      context.lineTo(50, 80)
      context.closePath()
      context.stroke()
      context.globalAlpha = unflippable ? 0.14 : 0.28
      context.fillStyle = definition.color
      for (const [x, y] of [[22, 22], [138, 22], [22, 138], [138, 138]]) {
        context.beginPath()
        context.arc(x, y, 4, 0, Math.PI * 2)
        context.fill()
      }
      context.globalAlpha = 1
    })
  }

  _makeFrontTexture(card) {
    return makeCanvasTexture((context) => {
      if (card.type === 'monster' || card.type === 'merchant') {
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
        context.strokeStyle = '#30384a'
        context.lineWidth = 3
        context.strokeRect(4, 4, 152, 152)
        return
      }
      if (card.type === 'entry') {
        context.strokeStyle = '#d9bc76'
        context.lineWidth = 3
        context.strokeRect(4, 4, 152, 152)
        drawStickFigure(context)
        return
      }
      context.strokeStyle = card.boss ? '#d98080' : '#888'
      context.lineWidth = card.boss ? 5 : 3
      context.strokeRect(4, 4, 152, 152)
      drawAttributeLabel(context, card.attribute)
      const isBuff = card.type === 'buff'
      const isMonster = card.type === 'monster'
      const isWeapon = card.type === 'weapon'
      const value = isMonster && Number.isFinite(card.maxValue) ? `${card.value}/${card.maxValue}` : card.value
      const subtitle = isMonster || isWeapon ? card.subtitle : ''
      const detail = isMonster ? `ATK ${card.attack}` : isWeapon ? `\u8010 ${card.durability}` : card.type === 'door' ? card.detail : ''
      const footer = isMonster || isWeapon ? card.footer : ''
      drawCenteredText(context, card.title, 32, { color: card.boss ? '#fbb' : '#fff', size: 22, weight: 'bold' })
      if (!isBuff && subtitle) drawCenteredText(context, subtitle, 50, { color: '#ffa', size: 14 })
      if (value) drawCenteredText(context, value, 90, { color: card.valueColor || '#fff', size: 36, weight: 'bold' })
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
    if (entity.kind === 'item') return { ...this._itemCardFaceData(entity.item), attribute: entity.item.attribute }
    if (entity.kind === 'trap') return { type: 'trap', title: entity.name, value: '!', valueColor: '#ffabb7' }
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
    if (item.type === 'weapon') {
      return {
        type: 'weapon',
        title: item.name,
        subtitle: '',
        value: `ATK ${item.attack}`,
        valueColor: '#a9d8ff',
        durability: item.durability,
        detail: `攻 ${item.attack}  耐 ${item.durability}`,
        footer: `射程 ${item.range}`,
        clickHint: '点击拾取',
      }
    }
    if (item.type === 'potion') {
      return { type: 'potion', title: item.name, value: `+${item.heal} HP`, valueColor: '#8eff9f', detail: '使用后生效', footer: '不耗回合', clickHint: '点击拾取' }
    }
    if (item.type === 'armor') {
      return { type: 'potion', title: item.name, value: `ARMOR +${item.armor}`, valueColor: '#8ed7ff', detail: 'Use to gain armor', footer: 'No turn cost', clickHint: 'Click to pick up' }
    }
    if (item.type === 'buff') {
      return { type: 'buff', title: item.name, value: `攻击 +${item.attackBonus}`, valueColor: '#8effc8', detail: '下次攻击生效', footer: '不耗回合', clickHint: '点击拾取' }
    }
    if (item.type === 'whetstone') {
      return { type: 'item', title: item.name, value: `修理 +${item.repair}`, valueColor: '#b8d6ff', detail: '耐久度恢复', footer: '消耗回合', clickHint: '点击拾取' }
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
    this.baseCameraDistance = Math.max(widthDistance, depthDistance) * 0.64
    if (resetView) {
      this.zoom = DEFAULT_ZOOM
      const playerPoint = this._gridPosition(room, this.run.player.pos)
      this.roomGroup.position.set(-playerPoint.x, 0, -playerPoint.z)
    }
    this.camera.aspect = aspect
    this._updateCamera()
    this._clampPan(room)
  }

  _updateCamera() {
    const distance = this.baseCameraDistance / this.zoom
    const horizontal = distance * CAMERA_DEPTH_RATIO
    this.camera.position.set(Math.sin(CAMERA_AZIMUTH) * horizontal, distance * CAMERA_HEIGHT_RATIO, Math.cos(CAMERA_AZIMUTH) * horizontal)
    this.camera.lookAt(0, -0.35, 0)
    this.camera.updateProjectionMatrix()
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
  }

  _pointerPosition(event) {
    return { x: event.clientX, y: event.clientY }
  }

  _groundPoint(event) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    return this.raycaster.ray.intersectPlane(this.groundPlane, new THREE.Vector3())
  }

  _pinchDistance() {
    const [first, second] = [...this.activePointers.values()]
    return first && second ? Math.hypot(first.x - second.x, first.y - second.y) : 0
  }

  _startBoardHold(event) {
    const position = this._pickTile(event)?.userData?.position
    if (!position) return
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
    const currentWorld = this._groundPoint(event)
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
    if (this.movementAnimation || this.flipAnimations.length || this.animationQueue.length) return
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
    this._updateHoverLift()
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
    this._clearPathPreview()
    this._clearMovementAnimation()
    this._clearPlayerMarker()
    disposeObject(this.roomGroup)
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
