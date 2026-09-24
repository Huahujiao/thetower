import { createBoss, createEnemyById, createGoldEntity, createKeyEntity, createLootEntity, createMonster, makeItemById, nextEntityId, randomItem, resetEntityIds, synchronizeEntityIds } from '../data/content.js'
import { createMerchantEntity } from '../data/merchants.js'
import { createTrapEntity, randomTrapId } from '../data/traps.js'
import { neighbors8, pos, posKey } from '../core/geometry.js'
import { Room } from './room.js'
import { arrangeTacticalEnemies } from './tactical-layouts.js'

const DOOR_SIDES = Object.freeze(['left', 'right', 'top', 'bottom'])
const ROOM_LAYOUT_GAP = 0.54
const LAYOUT_EPSILON = 0.0001
const MAX_LAYOUT_GENERATION_ATTEMPTS = 24

export const DUNGEON_CONFIG = Object.freeze({
  chapters: 4,
  roomSizes: [6, 7, 8, 9],
  chapterBossIds: ['shellguard', 'moss-colossus', 'molten-core-beast'],
  merchantIds: ['merchant', 'merchant', 'collector', 'collector'],
})

export class Dungeon {
  constructor() {
    this.rooms = new Map()
    this.edges = new Map()
    this.roomOrder = []
    this.doorIndex = new Map()
    this.roomLayouts = new Map()
  }

  addRoom(room, layout = null) {
    this.rooms.set(room.id, room)
    this.roomOrder.push(room.id)
    if (layout) this.setRoomLayout(room.id, layout)
    return room
  }

  setRoomLayout(roomId, layout) {
    if (!this.rooms.has(roomId) || !Number.isFinite(layout?.c) || !Number.isFinite(layout?.r)) return false
    this.roomLayouts.set(roomId, { c: layout.c, r: layout.r })
    return true
  }

  floorRooms(floor) {
    return this.roomOrder.map((roomId) => this.room(roomId)).filter((room) => room?.floor === floor)
  }

  roomLayout(roomId) {
    const layout = this.roomLayouts.get(roomId)
    if (layout) return { ...layout }
    const room = this.room(roomId)
    const fallbackIndex = room ? this.floorRooms(room.floor).findIndex((candidate) => candidate.id === roomId) : 0
    return { c: Math.max(0, fallbackIndex), r: 0 }
  }

  addEdge(edge) {
    this.edges.set(edge.id, edge)
    for (const door of [edge.fromDoor, edge.toDoor]) this.doorIndex.set(door.id, edge.id)
    return edge
  }

  room(id) { return this.rooms.get(id) || null }
  edge(id) { return this.edges.get(id) || null }
  edgeForDoor(doorId) { return this.edge(this.doorIndex.get(doorId)) }

  door(doorId) {
    const edge = this.edgeForDoor(doorId)
    if (!edge) return null
    return edge.fromDoor.id === doorId ? edge.fromDoor : edge.toDoor.id === doorId ? edge.toDoor : null
  }

  doorsForRoom(roomId) {
    const doors = []
    for (const edge of this.edges.values()) {
      if (edge.fromDoor.roomId === roomId) doors.push(edge.fromDoor)
      if (edge.toDoor.roomId === roomId) doors.push(edge.toDoor)
    }
    return doors
  }

  otherDoor(door) {
    const edge = this.edgeForDoor(door.id)
    if (!edge) return null
    return edge.fromDoor.id === door.id ? edge.toDoor : edge.toDoor.id === door.id ? edge.fromDoor : null
  }

  serialize() {
    return {
      rooms: [...this.rooms.values()].map((room) => room.serialize()),
      edges: [...this.edges.values()].map((edge) => ({
        ...edge,
        fromDoor: { ...edge.fromDoor, arrival: { ...edge.fromDoor.arrival } },
        toDoor: { ...edge.toDoor, arrival: { ...edge.toDoor.arrival } },
      })),
      roomOrder: [...this.roomOrder],
      roomLayouts: [...this.roomLayouts.entries()].map(([roomId, layout]) => ({ roomId, ...layout })),
    }
  }

  static hydrate(data) {
    if (!Array.isArray(data?.rooms) || !Array.isArray(data?.edges)) throw new Error('Invalid dungeon save')
    const dungeon = new Dungeon()
    for (const roomData of data.rooms || []) dungeon.addRoom(Room.hydrate(roomData))
    dungeon.roomOrder = [...(data.roomOrder || dungeon.roomOrder)]
    for (const layout of data.roomLayouts || []) dungeon.setRoomLayout(layout.roomId, layout)
    for (const edgeData of data.edges || []) {
      const edge = { ...edgeData }
      if (!edge.fromDoor || !edge.toDoor) throw new Error(`Invalid door data for ${edge.id}`)
      edge.fromDoor = { ...edge.fromDoor, edgeId: edge.id, roomId: edge.fromRoomId, arrival: { ...edge.fromDoor.arrival }, discovered: edge.fromDoor.discovered === true }
      edge.toDoor = { ...edge.toDoor, edgeId: edge.id, roomId: edge.toRoomId, arrival: { ...edge.toDoor.arrival }, discovered: edge.toDoor.discovered === true }
      edge.fromDoorId = edge.fromDoor.id
      edge.toDoorId = edge.toDoor.id
      dungeon.addEdge(edge)
    }
    synchronizeEntityIds([
      ...dungeon.rooms.values()].flatMap((room) => [...room.entities.values()].flatMap((entity) => [entity.id, entity.item?.uid]))
      .concat([...dungeon.edges.values()].flatMap((edge) => [edge.fromDoor.id, edge.toDoor.id])))
    return dungeon
  }
}

function shuffled(values, random) {
  const copy = [...values]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function randomOpenPosition(room, reserved, random, { requiresEmptyNeighbor = false } = {}) {
  const positions = []
  for (let r = 0; r < room.height; r++) {
    for (let c = 0; c < room.width; c++) {
      const candidate = pos(c, r)
      const hasEmptyNeighbor = neighbors8(candidate, room.width, room.height)
        .some((neighbor) => !reserved.has(posKey(neighbor)) && room.isEmpty(neighbor))
      if (!reserved.has(posKey(candidate)) && room.isEmpty(candidate) && (!requiresEmptyNeighbor || hasEmptyNeighbor)) positions.push(candidate)
    }
  }
  return shuffled(positions, random)[0] || null
}

function addDoor(room, edgeId, side, reserved, random) {
  const horizontal = side === 'top' || side === 'bottom'
  const length = horizontal ? room.width : room.height
  const offsets = shuffled(Array.from({ length: Math.max(1, length - 2) }, (_, index) => index + 1), random)
  for (const offset of offsets) {
    const arrival = side === 'left'
      ? pos(0, offset)
      : side === 'right'
        ? pos(room.width - 1, offset)
        : side === 'top'
          ? pos(offset, 0)
          : pos(offset, room.height - 1)
    if (reserved.has(posKey(arrival))) continue
    reserved.add(posKey(arrival))
    return {
      id: nextEntityId('door'),
      edgeId,
      roomId: room.id,
      side,
      offset,
      arrival,
      discovered: false,
    }
  }
  throw new Error(`Could not place a door in ${room.id}`)
}

function oppositeDoorSide(side) {
  return { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }[side] || 'left'
}

function doorArrival(room, side, offset) {
  if (side === 'left') return pos(0, offset)
  if (side === 'right') return pos(room.width - 1, offset)
  if (side === 'top') return pos(offset, 0)
  return pos(offset, room.height - 1)
}

function doorPoint(room, door) {
  if (door.side === 'top' || door.side === 'bottom') {
    return {
      x: door.offset - (room.width - 1) / 2,
      z: door.side === 'top' ? -room.height / 2 : room.height / 2,
    }
  }
  return {
    x: door.side === 'left' ? -room.width / 2 : room.width / 2,
    z: door.offset - (room.height - 1) / 2,
  }
}

function outwardForDoor(side) {
  if (side === 'left') return { x: -1, z: 0 }
  if (side === 'right') return { x: 1, z: 0 }
  if (side === 'top') return { x: 0, z: -1 }
  return { x: 0, z: 1 }
}

function sideForLayoutDelta(fromLayout, toLayout) {
  const deltaC = toLayout.c - fromLayout.c
  const deltaR = toLayout.r - fromLayout.r
  if (deltaC === 1 && deltaR === 0) return 'right'
  if (deltaC === -1 && deltaR === 0) return 'left'
  if (deltaC === 0 && deltaR === 1) return 'bottom'
  if (deltaC === 0 && deltaR === -1) return 'top'
  return null
}

function layoutAssertion(condition, message) {
  if (!condition) throw new Error(`Invalid dungeon layout: ${message}`)
}

function validateDoor(room, door, edgeId, seenDoorIds, roomDoorLocations, roomDoorSides) {
  layoutAssertion(door && typeof door.id === 'string', `${edgeId} has an invalid door id`)
  layoutAssertion(!seenDoorIds.has(door.id), `${edgeId} reuses door ${door.id}`)
  seenDoorIds.add(door.id)
  layoutAssertion(door.edgeId === edgeId && door.roomId === room.id, `${edgeId} door ${door.id} has mismatched ownership`)
  layoutAssertion(DOOR_SIDES.includes(door.side), `${edgeId} door ${door.id} has invalid side`)
  const length = door.side === 'top' || door.side === 'bottom' ? room.width : room.height
  layoutAssertion(Number.isInteger(door.offset) && door.offset > 0 && door.offset < length - 1, `${edgeId} door ${door.id} has invalid offset`)
  const expectedArrival = doorArrival(room, door.side, door.offset)
  layoutAssertion(door.arrival?.c === expectedArrival.c && door.arrival?.r === expectedArrival.r, `${edgeId} door ${door.id} arrival does not match its wall position`)
  const arrivalKey = posKey(door.arrival)
  layoutAssertion(!roomDoorLocations.has(arrivalKey), `${room.id} has overlapping door arrivals`)
  roomDoorLocations.add(arrivalKey)
  layoutAssertion(!roomDoorSides.has(door.side), `${room.id} has more than one door on its ${door.side} wall`)
  roomDoorSides.add(door.side)
  layoutAssertion(!room.entityAt(door.arrival), `${room.id} door ${door.id} arrival is occupied`)
}

function sameFloorCenters(dungeon, floor) {
  const rooms = dungeon.floorRooms(floor)
  const spacing = Math.max(...rooms.map((room) => Math.max(room.width, room.height))) + ROOM_LAYOUT_GAP
  const centers = new Map()
  for (const root of rooms) {
    if (centers.has(root.id)) continue
    const layout = dungeon.roomLayout(root.id)
    centers.set(root.id, { x: layout.c * spacing, z: layout.r * spacing })
    const queue = [root]
    while (queue.length) {
      const room = queue.shift()
      const center = centers.get(room.id)
      for (const edge of dungeon.edges.values()) {
        const fromCurrent = edge.fromRoomId === room.id
        const toCurrent = edge.toRoomId === room.id
        if (!fromCurrent && !toCurrent) continue
        const otherRoom = dungeon.room(fromCurrent ? edge.toRoomId : edge.fromRoomId)
        if (!otherRoom || otherRoom.floor !== floor) continue
        const ownDoor = fromCurrent ? edge.fromDoor : edge.toDoor
        const otherDoor = fromCurrent ? edge.toDoor : edge.fromDoor
        const ownPoint = doorPoint(room, ownDoor)
        const otherPoint = doorPoint(otherRoom, otherDoor)
        const outward = outwardForDoor(ownDoor.side)
        const expectedCenter = {
          x: center.x + ownPoint.x + outward.x * ROOM_LAYOUT_GAP - otherPoint.x,
          z: center.z + ownPoint.z + outward.z * ROOM_LAYOUT_GAP - otherPoint.z,
        }
        const knownCenter = centers.get(otherRoom.id)
        if (knownCenter) {
          layoutAssertion(Math.abs(knownCenter.x - expectedCenter.x) < LAYOUT_EPSILON && Math.abs(knownCenter.z - expectedCenter.z) < LAYOUT_EPSILON, `${room.id} and ${otherRoom.id} have inconsistent physical door placement`)
          continue
        }
        centers.set(otherRoom.id, expectedCenter)
        queue.push(otherRoom)
      }
    }
  }
  return centers
}

function validateRoomFootprints(dungeon, floor) {
  const rooms = dungeon.floorRooms(floor)
  const centers = sameFloorCenters(dungeon, floor)
  for (let index = 0; index < rooms.length; index += 1) {
    const room = rooms[index]
    const center = centers.get(room.id)
    const bounds = {
      minX: center.x - room.width / 2,
      maxX: center.x + room.width / 2,
      minZ: center.z - room.height / 2,
      maxZ: center.z + room.height / 2,
    }
    for (const otherRoom of rooms.slice(index + 1)) {
      const otherCenter = centers.get(otherRoom.id)
      const otherBounds = {
        minX: otherCenter.x - otherRoom.width / 2,
        maxX: otherCenter.x + otherRoom.width / 2,
        minZ: otherCenter.z - otherRoom.height / 2,
        maxZ: otherCenter.z + otherRoom.height / 2,
      }
      const overlapsX = bounds.minX < otherBounds.maxX - LAYOUT_EPSILON && bounds.maxX > otherBounds.minX + LAYOUT_EPSILON
      const overlapsZ = bounds.minZ < otherBounds.maxZ - LAYOUT_EPSILON && bounds.maxZ > otherBounds.minZ + LAYOUT_EPSILON
      layoutAssertion(!(overlapsX && overlapsZ), `${room.id} overlaps ${otherRoom.id} on floor ${floor}`)
    }
  }
}

export function validateDungeonLayout(dungeon) {
  layoutAssertion(dungeon instanceof Dungeon, 'dungeon is missing')
  layoutAssertion(dungeon.roomOrder.length === dungeon.rooms.size, 'room order does not include every room exactly once')
  layoutAssertion(new Set(dungeon.roomOrder).size === dungeon.roomOrder.length, 'room order contains duplicates')
  layoutAssertion(dungeon.edges.size >= dungeon.rooms.size - 1, 'room graph has too few edges')

  const layoutsByFloor = new Map()
  for (const roomId of dungeon.roomOrder) {
    const room = dungeon.room(roomId)
    layoutAssertion(room?.id === roomId && Number.isInteger(room.floor) && room.floor > 0, `invalid room ${roomId}`)
    layoutAssertion(Number.isInteger(room.width) && room.width >= 3 && Number.isInteger(room.height) && room.height >= 3, `${roomId} has invalid dimensions`)
    const layout = dungeon.roomLayout(roomId)
    layoutAssertion(Number.isInteger(layout.c) && Number.isInteger(layout.r), `${roomId} has invalid layout coordinates`)
    if (!layoutsByFloor.has(room.floor)) layoutsByFloor.set(room.floor, new Set())
    const positions = layoutsByFloor.get(room.floor)
    const layoutKey = `${layout.c},${layout.r}`
    layoutAssertion(!positions.has(layoutKey), `floor ${room.floor} overlaps rooms at ${layoutKey}`)
    positions.add(layoutKey)
  }

  const seenDoorIds = new Set()
  const roomDoorLocations = new Map([...dungeon.rooms.keys()].map((roomId) => [roomId, new Set()]))
  const roomDoorSides = new Map([...dungeon.rooms.keys()].map((roomId) => [roomId, new Set()]))
  for (const edge of dungeon.edges.values()) {
    const fromRoom = dungeon.room(edge.fromRoomId)
    const toRoom = dungeon.room(edge.toRoomId)
    layoutAssertion(fromRoom && toRoom && fromRoom !== toRoom, `${edge.id} has invalid endpoints`)
    validateDoor(fromRoom, edge.fromDoor, edge.id, seenDoorIds, roomDoorLocations.get(fromRoom.id), roomDoorSides.get(fromRoom.id))
    validateDoor(toRoom, edge.toDoor, edge.id, seenDoorIds, roomDoorLocations.get(toRoom.id), roomDoorSides.get(toRoom.id))
    layoutAssertion(edge.fromDoor.side === oppositeDoorSide(edge.toDoor.side), `${edge.id} doors do not face each other`)
    if (fromRoom.floor === toRoom.floor) {
      const expectedSide = sideForLayoutDelta(dungeon.roomLayout(fromRoom.id), dungeon.roomLayout(toRoom.id))
      layoutAssertion(expectedSide, `${edge.id} connects non-adjacent rooms on floor ${fromRoom.floor}`)
      layoutAssertion(edge.fromDoor.side === expectedSide, `${edge.id} door direction disagrees with the room layout`)
    } else {
      layoutAssertion(toRoom.floor === fromRoom.floor + 1, `${edge.id} must lead exactly one floor upward`)
    }
  }

  const startId = dungeon.roomOrder[0]
  const reachable = new Set([startId])
  const queue = [startId]
  while (queue.length) {
    const roomId = queue.shift()
    for (const edge of dungeon.edges.values()) {
      if (edge.fromRoomId !== roomId || reachable.has(edge.toRoomId)) continue
      reachable.add(edge.toRoomId)
      queue.push(edge.toRoomId)
    }
  }
  layoutAssertion(reachable.size === dungeon.rooms.size, 'some rooms cannot be reached from the start')
  layoutAssertion(dungeon.room(dungeon.roomOrder.at(-1))?.role === 'boss', 'final room is not a boss room')

  for (const floor of layoutsByFloor.keys()) validateRoomFootprints(dungeon, floor)
  return true
}

function addMonster(room, reserved, random, index) {
  const position = randomOpenPosition(room, reserved, random)
  if (!position) return false
  const monster = createMonster(room.chapter, Math.floor(random() * 10000) + index)
  monster.pos = position
  room.addEntity(monster)
  return true
}

function addLoot(room, reserved, random, item) {
  const position = randomOpenPosition(room, reserved, random)
  if (!position) return false
  room.addEntity(createLootEntity(item, position))
  return true
}

function addGold(room, reserved, random) {
  const position = randomOpenPosition(room, reserved, random)
  if (!position) return false
  room.addEntity(createGoldEntity(2 + room.floor, position))
  return true
}

function addTrap(room, reserved, random) {
  const position = randomOpenPosition(room, reserved, random)
  if (!position) return false
  room.addEntity(createTrapEntity(randomTrapId(random), position))
  return true
}

function populateRoom(room, reserved, random, config) {
  const role = room.role
  const targetDensity = { entry: 0.58, elite: 0.64, supply: 0.48, boss: 0.42 }[role] || 0.5
  const targetCount = Math.ceil(room.width * room.height * targetDensity)
  const layoutKind = ['scattered', 'firing', 'wall'][(Number(room.id.split('-').at(-1)) - 1) % 3]
  let monsterIndex = role === 'boss' || role === 'supply' ? 0 : arrangeTacticalEnemies(room, reserved, layoutKind)
  if (role === 'boss') {
    const position = randomOpenPosition(room, reserved, random)
    if (!position) throw new Error(`Could not place boss in ${room.id}`)
    const boss = room.chapter === config.chapters
      ? createBoss(position)
      : createEnemyById(config.chapterBossIds[room.chapter - 1], position)
    if (!boss) throw new Error(`Missing chapter boss for ${room.id}`)
    boss.boss = true
    boss.finalBoss = room.chapter === config.chapters
    room.addEntity(boss)
  }
  const targetMonsterCount = role === 'boss' ? 0 : role === 'supply' ? 1 : role === 'elite' ? 5 : 3
  while (monsterIndex < targetMonsterCount && addMonster(room, reserved, random, monsterIndex)) {
    monsterIndex += 1
  }
  for (const itemId of role === 'supply' ? ['health-potion', 'iron-powder'] : []) {
    if (!addLoot(room, reserved, random, makeItemById(itemId))) break
  }
  addGold(room, reserved, random)
  while (room.entities.size < targetCount) {
    const roll = random()
    if (roll < 0.03 && addTrap(room, reserved, random)) continue
    if (roll < 0.86 && addLoot(room, reserved, random, randomItem(room.floor, random))) continue
    if (addGold(room, reserved, random)) continue
    break
  }
}

function reserveRoute(room, reserved, start) {
  const startKey = posKey(start)
  const queue = [{ ...start }]
  const seen = new Set([startKey])
  const cameFrom = new Map()
  let connected = null
  while (queue.length) {
    const current = queue.shift()
    const currentKey = posKey(current)
    if (currentKey !== startKey && reserved.has(currentKey)) {
      connected = current
      break
    }
    for (const candidate of neighbors8(current, room.width, room.height)) {
      const key = posKey(candidate)
      if (seen.has(key) || room.entityAt(candidate)) continue
      seen.add(key)
      cameFrom.set(key, current)
      queue.push(candidate)
    }
  }
  if (!connected) throw new Error(`Could not reserve route in ${room.id}`)
  let current = connected
  while (posKey(current) !== startKey) {
    reserved.add(posKey(current))
    current = cameFrom.get(posKey(current))
  }
  reserved.add(startKey)
}

function placeMerchant(room, reserved, merchantId, random) {
  const position = randomOpenPosition(room, reserved, random, { requiresEmptyNeighbor: true })
  if (!position) throw new Error(`Could not place merchant ${merchantId}`)
  const approach = shuffled(neighbors8(position, room.width, room.height)
    .filter((candidate) => !reserved.has(posKey(candidate)) && room.isEmpty(candidate)), random)[0]
  if (!approach) throw new Error(`Could not reserve merchant approach in ${room.id}`)
  room.addEntity(createMerchantEntity(merchantId, position, { floor: room.floor, random }))
  reserved.add(posKey(approach))
  return approach
}

export function createChapterDungeon({ config = DUNGEON_CONFIG, random = Math.random } = {}) {
  let failure = null
  for (let attempt = 0; attempt < MAX_LAYOUT_GENERATION_ATTEMPTS; attempt += 1) {
    try {
      const generated = createChapterDungeonAttempt({ config, random })
      validateDungeonLayout(generated.dungeon)
      return generated
    } catch (error) {
      failure = error
    }
  }
  throw new Error(`Could not generate a valid dungeon layout after ${MAX_LAYOUT_GENERATION_ATTEMPTS} attempts: ${failure?.message || 'unknown error'}`)
}

function createChapterDungeonAttempt({ config, random }) {
  resetEntityIds()
  const dungeon = new Dungeon()
  const reservations = new Map()
  const openAnchors = new Map()
  const doorSidesByRoom = new Map()
  const chapters = []
  for (let chapter = 1; chapter <= config.chapters; chapter++) {
    const size = config.roomSizes[chapter - 1]
    const roles = [
      ['entry', 0, { c: 0, r: 0 }],
      ['elite', 1, { c: -1, r: 0 }],
      ['supply', 1, { c: 1, r: 0 }],
      ['boss', 2, { c: 0, r: 0 }],
    ]
    const rooms = {}
    for (const [role, floorOffset, layout] of roles) {
      const room = new Room({ id: `room-${dungeon.roomOrder.length + 1}`, floor: (chapter - 1) * 3 + floorOffset + 1, width: size, height: size, chapter, role })
      dungeon.addRoom(room, layout)
      rooms[role] = room
      reservations.set(room.id, new Set())
      openAnchors.set(room.id, [])
      doorSidesByRoom.set(room.id, new Set())
    }
    chapters.push(rooms)
  }

  const firstRoom = dungeon.room(dungeon.roomOrder[0])
  const start = pos(0, firstRoom.height - 1)
  firstRoom.reveal(start)
  firstRoom.visited = true
  firstRoom.entry = { ...start }
  reservations.get(firstRoom.id).add(posKey(start))
  openAnchors.get(firstRoom.id).push(start)

  const connect = (fromRoom, toRoom, fromSide, branch = null) => {
    const edgeId = `edge-${dungeon.edges.size + 1}`
    const toSide = oppositeDoorSide(fromSide)
    if (doorSidesByRoom.get(fromRoom.id).has(fromSide) || doorSidesByRoom.get(toRoom.id).has(toSide)) throw new Error(`Door side conflict for ${edgeId}`)
    const fromDoor = addDoor(fromRoom, edgeId, fromSide, reservations.get(fromRoom.id), random)
    const toDoor = addDoor(toRoom, edgeId, toSide, reservations.get(toRoom.id), random)
    if (fromRoom.role === 'entry' && branch) fromDoor.discovered = true
    doorSidesByRoom.get(fromRoom.id).add(fromSide)
    doorSidesByRoom.get(toRoom.id).add(toSide)
    openAnchors.get(fromRoom.id).push(fromDoor.arrival)
    openAnchors.get(toRoom.id).push(toDoor.arrival)
    dungeon.addEdge({
      id: edgeId,
      fromRoomId: fromRoom.id,
      toRoomId: toRoom.id,
      fromDoor,
      toDoor,
      fromDoorId: fromDoor.id,
      toDoorId: toDoor.id,
      locked: toRoom.role === 'boss',
      unlocked: toRoom.role !== 'boss',
      branch,
      sealed: false,
    })
  }

  chapters.forEach((rooms, index) => {
    const chapter = index + 1
    connect(rooms.entry, rooms.elite, 'left', { chapter, option: 'elite' })
    connect(rooms.entry, rooms.supply, 'right', { chapter, option: 'supply' })
    connect(rooms.elite, rooms.boss, 'bottom', { chapter, option: 'elite' })
    connect(rooms.supply, rooms.boss, 'right', { chapter, option: 'supply' })
    if (chapters[index + 1]) connect(rooms.boss, chapters[index + 1].entry, 'bottom')
    const room = rooms.supply
    const approach = placeMerchant(room, reservations.get(room.id), config.merchantIds[index], random)
    openAnchors.get(room.id).push(approach)
  })

  for (const edge of dungeon.edges.values()) {
    if (!edge.locked) continue
    const source = dungeon.room(edge.fromRoomId)
    const position = randomOpenPosition(source, reservations.get(source.id), random)
    if (!position) throw new Error(`Could not place key for ${edge.id}`)
    source.addEntity(createKeyEntity(edge.id, position))
  }

  for (const room of dungeon.rooms.values()) {
    const anchors = openAnchors.get(room.id)
    for (let index = 1; index < anchors.length; index++) {
      reserveRoute(room, reservations.get(room.id), anchors[index])
    }
    populateRoom(room, reservations.get(room.id), random, config)
  }

  return { dungeon, startRoomId: firstRoom.id, start }
}
