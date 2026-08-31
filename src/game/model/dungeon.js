import { createBoss, createGoldEntity, createKeyEntity, createLootEntity, createMonster, makeItemById, nextEntityId, randomItem, resetEntityIds, synchronizeEntityIds } from '../data/content.js'
import { createMerchantEntity } from '../data/merchants.js'
import { createTrapEntity, randomTrapId } from '../data/traps.js'
import { neighbors8, pos, posKey } from '../core/geometry.js'
import { Room } from './room.js'

const DOOR_SIDES = Object.freeze(['left', 'right', 'top', 'bottom'])
const ROOM_LAYOUT_GAP = 0.54
const LAYOUT_EPSILON = 0.0001
const MAX_LAYOUT_GENERATION_ATTEMPTS = 24

export const DUNGEON_CONFIG = Object.freeze({
  roomsPerFloor: [1, 2, 2, 2, 1],
  roomSizes: [7, 8, 9, 9, 10],
  lockedEdgeIndexes: [1, 4],
  merchantRoomIndexes: [1, 3, 5],
  merchantIds: ['merchant', 'merchant', 'collector'],
  minimumOccupiedRatio: 0.8,
  firstFloorTestContent: Object.freeze({
    alarmTraps: 1,
  }),
})

// Rooms are still traversed in a deliberate sequence, but their floor-plan
// positions describe the physical direction of each connection.  This keeps
// a floor readable as a small route rather than a row of left-to-right rooms.
const FLOOR_ROOM_LAYOUTS = Object.freeze([
  Object.freeze([{ c: 0, r: 0 }]),
  Object.freeze([{ c: 0, r: 0 }, { c: 0, r: 1 }]),
  Object.freeze([{ c: 1, r: 0 }, { c: 0, r: 0 }]),
  Object.freeze([{ c: 0, r: 1 }, { c: 0, r: 0 }]),
  Object.freeze([{ c: 0, r: 0 }]),
])

function layoutForRoom(floorIndex, roomIndex) {
  const layout = FLOOR_ROOM_LAYOUTS[floorIndex]?.[roomIndex]
  return layout ? { ...layout } : { c: roomIndex, r: 0 }
}

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
      const fromRoom = dungeon.room(edge.fromRoomId)
      const toRoom = dungeon.room(edge.toRoomId)
      if (!edge.fromDoor || !edge.toDoor) {
        const legacyFromDoor = fromRoom?.entity(edge.fromDoorId)
        const legacyToDoor = toRoom?.entity(edge.toDoorId)
        if (!legacyFromDoor || !legacyToDoor) throw new Error(`Invalid door data for ${edge.id}`)
        edge.fromDoor = {
          id: legacyFromDoor.id,
          edgeId: edge.id,
          roomId: edge.fromRoomId,
          side: legacyFromDoor.pos.c === 0 ? 'left' : 'right',
          offset: legacyFromDoor.pos.r,
          arrival: { ...legacyFromDoor.pos },
        }
        edge.toDoor = {
          id: legacyToDoor.id,
          edgeId: edge.id,
          roomId: edge.toRoomId,
          side: legacyToDoor.pos.c === 0 ? 'left' : 'right',
          offset: legacyToDoor.pos.r,
          arrival: { ...legacyToDoor.pos },
        }
        fromRoom.removeEntity(legacyFromDoor.id)
        toRoom.removeEntity(legacyToDoor.id)
      }
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
  if (rooms.length <= 1) return new Map(rooms.map((room) => [room.id, { x: 0, z: 0 }]))
  const centers = new Map([[rooms[0].id, { x: 0, z: 0 }]])
  const queue = [rooms[0]]
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
  layoutAssertion(centers.size === rooms.length, `floor ${floor} is not internally connected`)
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
  layoutAssertion(dungeon.edges.size === Math.max(0, dungeon.roomOrder.length - 1), 'linear room sequence has an invalid edge count')

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
  for (let index = 0; index < dungeon.roomOrder.length - 1; index += 1) {
    const edge = dungeon.edge(`edge-${index + 1}`)
    const fromRoomId = dungeon.roomOrder[index]
    const toRoomId = dungeon.roomOrder[index + 1]
    layoutAssertion(edge?.fromRoomId === fromRoomId && edge?.toRoomId === toRoomId, `edge-${index + 1} does not follow the room sequence`)
    const fromRoom = dungeon.room(fromRoomId)
    const toRoom = dungeon.room(toRoomId)
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

  for (const floor of layoutsByFloor.keys()) validateRoomFootprints(dungeon, floor)
  return true
}

function connectionSide(fromLayout, toLayout, edgeIndex) {
  const deltaC = toLayout.c - fromLayout.c
  const deltaR = toLayout.r - fromLayout.r
  const horizontal = () => deltaC >= 0 ? 'right' : 'left'
  const vertical = () => deltaR >= 0 ? 'bottom' : 'top'
  if (deltaC === 0 && deltaR === 0) return ['right', 'bottom', 'left', 'top'][edgeIndex % 4]
  if (Math.abs(deltaC) > Math.abs(deltaR)) return horizontal()
  if (Math.abs(deltaR) > Math.abs(deltaC)) return vertical()
  return edgeIndex % 2 === 0 ? vertical() : horizontal()
}

function connectionDoorSides(preferredSide, fromUsedSides = new Set(), toUsedSides = new Set()) {
  const sides = ['right', 'bottom', 'top', 'left']
  const preferredIndex = Math.max(0, sides.indexOf(preferredSide))
  const candidates = [0, 1, -1, 2].map((offset) => sides[(preferredIndex + offset + sides.length) % sides.length])
  const fromSide = candidates.find((side) => !fromUsedSides.has(side) && !toUsedSides.has(oppositeDoorSide(side)))
  if (!fromSide) throw new Error('Could not assign distinct door sides for room connection')
  return { fromSide, toSide: oppositeDoorSide(fromSide) }
}

function addMonster(room, reserved, random, index) {
  const position = randomOpenPosition(room, reserved, random)
  if (!position) return false
  const monster = createMonster(room.floor, index)
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

function addNamedTrap(room, reserved, random, trapId) {
  const position = randomOpenPosition(room, reserved, random)
  if (!position) return false
  room.addEntity(createTrapEntity(trapId, position))
  return true
}

function addFirstFloorTestContent(room, reserved, random, content) {
  if (room.floor !== 1 || !content) return
  for (let index = 0; index < (content.alarmTraps || 0); index += 1) {
    if (!addNamedTrap(room, reserved, random, 'alarm')) break
  }
}

function populateRoom(room, reserved, random, { bossRoom = false, minimumOccupiedRatio = 0.8 } = {}) {
  const targetCount = Math.ceil(room.width * room.height * minimumOccupiedRatio)
  let monsterIndex = 0
  if (bossRoom) {
    const position = randomOpenPosition(room, reserved, random)
    if (!position) throw new Error(`Could not place boss in ${room.id}`)
    room.addEntity(createBoss(position))
  }
  const targetMonsterCount = bossRoom ? 3 : Math.round(room.width * room.height * 0.25)
  while (monsterIndex < targetMonsterCount && addMonster(room, reserved, random, monsterIndex)) {
    monsterIndex += 1
  }
  for (const itemId of ['small-potion', 'armor-potion', 'battle-charm', 'whetstone', 'short-sword']) {
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

export function createLinearDungeon({ config = DUNGEON_CONFIG, random = Math.random } = {}) {
  let failure = null
  for (let attempt = 0; attempt < MAX_LAYOUT_GENERATION_ATTEMPTS; attempt += 1) {
    try {
      const generated = createLinearDungeonAttempt({ config, random })
      validateDungeonLayout(generated.dungeon)
      return generated
    } catch (error) {
      failure = error
    }
  }
  throw new Error(`Could not generate a valid dungeon layout after ${MAX_LAYOUT_GENERATION_ATTEMPTS} attempts: ${failure?.message || 'unknown error'}`)
}

function createLinearDungeonAttempt({ config, random }) {
  resetEntityIds()
  const dungeon = new Dungeon()
  const reservations = new Map()
  const openAnchors = new Map()
  const doorSidesByRoom = new Map()
  let sequence = 0

  config.roomsPerFloor.forEach((count, floorIndex) => {
    const floor = floorIndex + 1
    for (let roomIndex = 0; roomIndex < count; roomIndex++) {
      const size = config.roomSizes[floorIndex]
      const room = new Room({ id: `room-${sequence + 1}`, floor, width: size, height: size, random })
      dungeon.addRoom(room, layoutForRoom(floorIndex, roomIndex))
      reservations.set(room.id, new Set())
      openAnchors.set(room.id, [])
      doorSidesByRoom.set(room.id, new Set())
      sequence += 1
    }
  })

  const firstRoom = dungeon.room(dungeon.roomOrder[0])
  const start = pos(0, firstRoom.height - 1)
  firstRoom.reveal(start)
  firstRoom.visited = true
  firstRoom.entry = { ...start }
  reservations.get(firstRoom.id).add(posKey(start))
  openAnchors.get(firstRoom.id).push(start)

  for (let index = 0; index < dungeon.roomOrder.length - 1; index++) {
    const fromRoom = dungeon.room(dungeon.roomOrder[index])
    const toRoom = dungeon.room(dungeon.roomOrder[index + 1])
    const edgeId = `edge-${index + 1}`
    let fromSide
    let toSide
    if (fromRoom.floor === toRoom.floor) {
      fromSide = sideForLayoutDelta(dungeon.roomLayout(fromRoom.id), dungeon.roomLayout(toRoom.id))
      if (!fromSide) throw new Error(`Invalid same-floor layout for ${edgeId}`)
      toSide = oppositeDoorSide(fromSide)
      if (doorSidesByRoom.get(fromRoom.id).has(fromSide) || doorSidesByRoom.get(toRoom.id).has(toSide)) {
        throw new Error(`Same-floor door direction conflicts with an existing door for ${edgeId}`)
      }
    } else {
      const preferredSide = connectionSide(dungeon.roomLayout(fromRoom.id), dungeon.roomLayout(toRoom.id), index)
      const reservedTargetSides = new Set(doorSidesByRoom.get(toRoom.id))
      const nextRoom = dungeon.room(dungeon.roomOrder[index + 2])
      if (nextRoom?.floor === toRoom.floor) {
        const nextSide = sideForLayoutDelta(dungeon.roomLayout(toRoom.id), dungeon.roomLayout(nextRoom.id))
        if (!nextSide) throw new Error(`Invalid target-floor layout for ${edgeId}`)
        reservedTargetSides.add(nextSide)
      }
      ;({ fromSide, toSide } = connectionDoorSides(preferredSide, doorSidesByRoom.get(fromRoom.id), reservedTargetSides))
    }
    const fromDoor = addDoor(fromRoom, edgeId, fromSide, reservations.get(fromRoom.id), random)
    const toDoor = addDoor(toRoom, edgeId, toSide, reservations.get(toRoom.id), random)
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
      locked: config.lockedEdgeIndexes.includes(index),
      unlocked: !config.lockedEdgeIndexes.includes(index),
    })
  }

  config.merchantRoomIndexes.forEach((roomIndex, merchantIndex) => {
    const room = dungeon.room(dungeon.roomOrder[roomIndex])
    if (!room) throw new Error(`Could not locate merchant room ${merchantIndex + 1}`)
    const approach = placeMerchant(room, reservations.get(room.id), config.merchantIds[merchantIndex], random)
    openAnchors.get(room.id).push(approach)
  })

  for (const edge of dungeon.edges.values()) {
    if (!edge.locked) continue
    const source = dungeon.room(edge.fromRoomId)
    const position = randomOpenPosition(source, reservations.get(source.id), random)
    if (!position) throw new Error(`Could not place key for ${edge.id}`)
    source.addEntity(createKeyEntity(edge.id, position))
  }

  const lastRoomId = dungeon.roomOrder[dungeon.roomOrder.length - 1]
  for (const room of dungeon.rooms.values()) {
    const anchors = openAnchors.get(room.id)
    for (let index = 1; index < anchors.length; index++) {
      reserveRoute(room, reservations.get(room.id), anchors[index])
    }
    addFirstFloorTestContent(room, reservations.get(room.id), random, config.firstFloorTestContent)
    populateRoom(room, reservations.get(room.id), random, {
      bossRoom: room.id === lastRoomId,
      minimumOccupiedRatio: config.minimumOccupiedRatio,
    })
  }

  return { dungeon, startRoomId: firstRoom.id, start }
}
