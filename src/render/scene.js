import * as THREE from 'three'
import { getAttributeDefinition } from '../game/data/attributes.js'

const TILE_SIZE = 1.14
const CARD_SIZE = TILE_SIZE
const CARD_THICKNESS = 0.08
const DEFAULT_ZOOM = 1
const MIN_ZOOM = 0.66
const MAX_ZOOM = 3.2
const DRAG_THRESHOLD = 8
const LONG_PRESS_MS = 420
const CAMERA_FOV = 45
const CAMERA_NEAR = 0.1
const CAMERA_FAR = 80
const CAMERA_HEIGHT_RATIO = 0.91
const CAMERA_DEPTH_RATIO = 0.41

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

const ENEMY_BEHAVIOR_LABELS = Object.freeze({
  stationary: '\u9a7b\u5b88',
  ambush: '\u4f0f\u51fb',
  chaser: '\u8ffd\u51fb',
  patrol: '\u5de1\u903b',
  'self-destruct': '\u81ea\u7206',
  summoner: '\u53ec\u5524',
})

const ENEMY_TRAIT_LABELS = Object.freeze({
  shield: '\u62a4\u76fe',
  'heavy-armor': '\u91cd\u7532',
  split: '\u5206\u88c2',
  regen: '\u518d\u751f',
  revive: '\u590d\u751f',
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

function enemyFeatureLabel(entity) {
  return [
    entity.boss ? '\u9996\u9886' : '',
    ENEMY_BEHAVIOR_LABELS[entity.behavior] || '',
    ...(entity.traits || []).map((trait) => ENEMY_TRAIT_LABELS[trait] || trait),
    entity.deathRule ? ENEMY_TRAIT_LABELS[entity.deathRule] || entity.deathRule : '',
  ].filter(Boolean).join('\u00b7')
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
    this.flipAnimations = []
    this.animationQueue = []
    this.movementAnimation = null
    this.playerMarker = null
    this.pathPreview = null
    this.pendingRebuild = false
    this.hoveredTileKey = null
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

  rebuild() {
    const room = this.run.currentRoom
    if ((this.movementAnimation || this.flipAnimations.length || this.animationQueue.length) && room?.id === this.framedRoomId) {
      this.pendingRebuild = true
      return
    }
    if (room?.id !== this.framedRoomId) {
      this.animationQueue = []
      this.pendingRebuild = false
    }
    this._clearPathPreview()
    this._clearMovementAnimation()
    this._clearPlayerMarker()
    disposeObject(this.roomGroup)
    this.roomGroup.clear()
    this.tileMeshes = []
    this.tileMeshByKey.clear()
    if (!room) return
    const floorTint = [0x111722, 0x111722, 0x151522, 0x1b1625, 0x221628, 0x29172a][room.floor] || 0x111722
    this.scene.background.setHex(floorTint)

    for (let r = 0; r < room.height; r++) {
      for (let c = 0; c < room.width; c++) this._addTile(room, { c, r })
    }
    this._frameRoom(room, { resetView: room.id !== this.framedRoomId })
    this.framedRoomId = room.id
  }

  _addTile(room, position) {
    const tile = room.tile(position)
    const revealed = this.run.debugReveal || tile.revealed
    const geometry = new THREE.BoxGeometry(CARD_SIZE, CARD_THICKNESS, CARD_SIZE)
    const material = new THREE.MeshStandardMaterial({ color: revealed ? 0x262a36 : 0x17172b, roughness: 0.72 })
    const mesh = new THREE.Mesh(geometry, material)
    const point = this._gridPosition(room, position)
    mesh.position.set(point.x, 0, point.z)
    mesh.receiveShadow = true
    this.roomGroup.add(mesh)
    const texture = revealed ? this._makeFrontTexture(this._cardFaceData(room, position)) : this._makeBackTexture(this._backAttributeFor(room, position))
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_SIZE, CARD_SIZE),
      new THREE.MeshBasicMaterial({ map: texture }),
    )
    face.rotation.x = -Math.PI / 2
    face.position.set(point.x, CARD_THICKNESS / 2 + 0.002, point.z)
    face.userData.position = { ...position }
    face.userData.baseY = CARD_THICKNESS / 2 + 0.002
    face.userData.lift = 0
    face.userData.body = mesh
    this.roomGroup.add(face)
    this.tileMeshes.push(face)
    this.tileMeshByKey.set(tileKey(position), face)
  }

  _queueAnimation(type, payload) {
    this.animationQueue.push({ type, payload })
    this._drainAnimationQueue()
  }

  _drainAnimationQueue() {
    if (this.movementAnimation || this.flipAnimations.length) return
    while (this.animationQueue.length) {
      const animation = this.animationQueue.shift()
      const started = animation.type === 'move'
        ? this._startMove(animation.payload)
        : this._startFlip(animation.payload)
      if (started) return
    }
    this._flushPendingRebuild()
  }

  _flushPendingRebuild() {
    if (!this.pendingRebuild || this.movementAnimation || this.flipAnimations.length || this.animationQueue.length) return
    this.pendingRebuild = false
    this.rebuild()
  }

  _startFlip({ roomId, position } = {}) {
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
    const backTexture = this._makeBackTexture(this._backAttributeFor(room, position))
    const front = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_SIZE, CARD_SIZE),
      new THREE.MeshBasicMaterial({ map: frontTexture, side: THREE.DoubleSide }),
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

  _startMove({ roomId, from, path } = {}) {
    const room = this.run.currentRoom
    if (!room || room.id !== roomId || room.id !== this.framedRoomId || !from || !Array.isArray(path) || path.length === 0) return false
    this._clearPlayerMarker()
    const startFace = this.tileMeshByKey.get(tileKey(from))
    if (startFace?.visible) {
      const oldTexture = startFace.material.map
      startFace.material.map = this._makeFrontTexture({ type: 'empty' })
      startFace.material.needsUpdate = true
      oldTexture?.dispose()
    }
    const startPoint = this._gridPosition(room, from)
    const group = new THREE.Group()
    group.position.set(startPoint.x, CARD_THICKNESS / 2 + 0.006, startPoint.z)
    const marker = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_SIZE, CARD_SIZE),
      new THREE.MeshBasicMaterial({ map: this._makeFrontTexture({ type: 'entry' }) }),
    )
    marker.rotation.x = -Math.PI / 2
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

  _showPathPreview(preview) {
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
    const targetPoint = this._gridPosition(room, preview.target)
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.35, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false }),
    )
    marker.rotation.x = -Math.PI / 2
    marker.position.set(targetPoint.x, CARD_THICKNESS / 2 + 0.055, targetPoint.z)
    group.add(marker)
    this.roomGroup.add(group)
    this.pathPreview = { target: { ...preview.target }, group }
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

  _updateHover(event) {
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
    }
    if (this.flipAnimations.length === 0) this._drainAnimationQueue()
  }

  _backAttributeFor(room, position) {
    const entity = room.entityAt(position)
    return entity?.attribute || entity?.item?.attribute || room.tile(position)?.backAttribute || 'scorch'
  }

  _makeBackTexture(attribute) {
    return makeCanvasTexture((context) => {
      const definition = getAttributeDefinition(attribute) || getAttributeDefinition('scorch')
      const gradient = context.createLinearGradient(0, 0, 0, 160)
      gradient.addColorStop(0, '#293247')
      gradient.addColorStop(1, '#141a28')
      context.fillStyle = gradient
      context.fillRect(0, 0, 160, 160)
      context.strokeStyle = '#46536c'
      context.lineWidth = 4
      context.strokeRect(6, 6, 148, 148)
      context.strokeStyle = definition.color
      context.globalAlpha = 0.3
      context.lineWidth = 3
      context.beginPath()
      context.moveTo(80, 22)
      context.lineTo(132, 80)
      context.lineTo(80, 138)
      context.lineTo(28, 80)
      context.closePath()
      context.stroke()
      context.globalAlpha = 0.17
      context.lineWidth = 2
      context.beginPath()
      context.moveTo(80, 44)
      context.lineTo(110, 80)
      context.lineTo(80, 116)
      context.lineTo(50, 80)
      context.closePath()
      context.stroke()
      context.globalAlpha = 0.28
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
        subtitle: enemyFeatureLabel(entity),
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
    const halfWidth = room.width * TILE_SIZE / 2 + 0.75
    const halfDepth = room.height * TILE_SIZE / 2 + 0.75
    const widthDistance = halfWidth / Math.tan(horizontalFov / 2)
    const depthDistance = halfDepth / Math.tan(verticalFov / 2)
    this.baseCameraDistance = Math.max(widthDistance, depthDistance) * 1.28
    if (resetView) {
      this.zoom = DEFAULT_ZOOM
      this.roomGroup.position.set(0, 0, 0)
    }
    this.camera.aspect = aspect
    this._updateCamera()
    this._clampPan(room)
  }

  _updateCamera() {
    const distance = this.baseCameraDistance / this.zoom
    this.camera.position.set(0, distance * CAMERA_HEIGHT_RATIO, distance * CAMERA_DEPTH_RATIO)
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
    const limitX = room.width * TILE_SIZE / 2 + 1.2
    const limitZ = room.height * TILE_SIZE / 2 + 1.2
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
    const position = this._pickTile(event)?.userData?.position
    if (!position) return
    const preview = this.run.previewTileAction(position.c, position.r)
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
    this._clearPathPreview()
    this._clearMovementAnimation()
    this._clearPlayerMarker()
    disposeObject(this.roomGroup)
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
