import { createBoss, createGoldEntity, createKeyEntity, createLootEntity, createMonster, makeItemById, nextEntityId, randomItem, resetEntityIds, synchronizeEntityIds } from '../data/content.js'
import { createMerchantEntity } from '../data/merchants.js'
import { createTrapEntity, randomTrapId } from '../data/traps.js'
import { neighbors8, pos, posKey } from '../core/geometry.js'
import { Room } from './room.js'

export const DUNGEON_CONFIG = Object.freeze({
  roomsPerFloor: [1, 3, 4, 3, 1],
  roomSizes: [7, 8, 9, 9, 10],
  lockedEdgeIndexes: [2, 7],
  merchantRoomIndexes: [2, 6, 9],
  merchantIds: ['merchant', 'merchant', 'collector'],
  minimumOccupiedRatio: 0.8,
})

export class Dungeon {
  constructor() {
    this.rooms = new Map()
    this.edges = new Map()
    this.roomOrder = []
    this.doorIndex = new Map()
  }

  addRoom(room) {
    this.rooms.set(room.id, room)
    this.roomOrder.push(room.id)
    return room
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
    }
  }

  static hydrate(data) {
    if (!Array.isArray(data?.rooms) || !Array.isArray(data?.edges)) throw new Error('Invalid dungeon save')
    const dungeon = new Dungeon()
    for (const roomData of data.rooms || []) dungeon.addRoom(Room.hydrate(roomData))
    dungeon.roomOrder = [...(data.roomOrder || dungeon.roomOrder)]
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
      edge.fromDoor = { ...edge.fromDoor, edgeId: edge.id, roomId: edge.fromRoomId, arrival: { ...edge.fromDoor.arrival } }
      edge.toDoor = { ...edge.toDoor, edgeId: edge.id, roomId: edge.toRoomId, arrival: { ...edge.toDoor.arrival } }
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
  const rows = shuffled(Array.from({ length: Math.max(1, room.height - 2) }, (_, index) => index + 1), random)
  for (const r of rows) {
    const arrival = side === 'left' ? pos(0, r) : pos(room.width - 1, r)
    if (reserved.has(posKey(arrival))) continue
    reserved.add(posKey(arrival))
    return {
      id: nextEntityId('door'),
      edgeId,
      roomId: room.id,
      side,
      offset: r,
      arrival,
    }
  }
  throw new Error(`Could not place a door in ${room.id}`)
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

function reserveRoute(room, reserved, start, goal) {
  const startKey = posKey(start)
  const goalKey = posKey(goal)
  const queue = [{ ...start }]
  const seen = new Set([startKey])
  const cameFrom = new Map()
  while (queue.length) {
    const current = queue.shift()
    const currentKey = posKey(current)
    if (currentKey === goalKey) break
    for (const candidate of neighbors8(current, room.width, room.height)) {
      const key = posKey(candidate)
      if (seen.has(key) || room.entityAt(candidate)) continue
      seen.add(key)
      cameFrom.set(key, current)
      queue.push(candidate)
    }
  }
  if (!seen.has(goalKey)) throw new Error(`Could not reserve route in ${room.id}`)
  let current = { ...goal }
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
  resetEntityIds()
  const dungeon = new Dungeon()
  const reservations = new Map()
  const openAnchors = new Map()
  let sequence = 0

  config.roomsPerFloor.forEach((count, floorIndex) => {
    const floor = floorIndex + 1
    for (let roomIndex = 0; roomIndex < count; roomIndex++) {
      const size = config.roomSizes[floorIndex]
      const room = new Room({ id: `room-${sequence + 1}`, floor, width: size, height: size, random })
      dungeon.addRoom(room)
      reservations.set(room.id, new Set())
      openAnchors.set(room.id, [])
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
    const fromDoor = addDoor(fromRoom, edgeId, 'right', reservations.get(fromRoom.id), random)
    const toDoor = addDoor(toRoom, edgeId, 'left', reservations.get(toRoom.id), random)
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
      reserveRoute(room, reservations.get(room.id), anchors[0], anchors[index])
    }
    populateRoom(room, reservations.get(room.id), random, {
      bossRoom: room.id === lastRoomId,
      minimumOccupiedRatio: config.minimumOccupiedRatio,
    })
  }

  return { dungeon, startRoomId: firstRoom.id, start }
}
