import { inBounds, posKey } from '../core/geometry.js'
import { randomCardBackAttribute } from '../data/attributes.js'

function makeTile(random) {
  return { revealed: false, peeked: false, entityId: null, terrain: 'plain', backAttribute: randomCardBackAttribute(random) }
}

export class Room {
  constructor({ id, floor, width, height = 8, random = Math.random }) {
    this.id = id
    this.floor = floor
    this.width = width
    this.height = height
    this.tiles = Array.from({ length: height }, () => Array.from({ length: width }, () => makeTile(random)))
    this.entities = new Map()
    this.revealCounter = 0
    this.visited = false
    this.entry = null
  }

  contains(position) { return inBounds(position, this.width, this.height) }

  tile(position) {
    if (!this.contains(position)) return null
    return this.tiles[position.r][position.c]
  }

  reveal(position) {
    const tile = this.tile(position)
    if (!tile || tile.revealed) return false
    tile.revealed = true
    tile.peeked = false
    const entity = this.entityAt(position)
    if (entity && entity.revealOrder == null) entity.revealOrder = ++this.revealCounter
    return true
  }

  isRevealed(position) { return !!this.tile(position)?.revealed }

  addEntity(entity) {
    const tile = this.tile(entity.pos)
    if (!tile) throw new Error(`Entity ${entity.id} is outside room ${this.id}`)
    if (tile.entityId) throw new Error(`Tile ${posKey(entity.pos)} in ${this.id} is occupied`)
    this.entities.set(entity.id, entity)
    tile.entityId = entity.id
    return entity
  }

  entityAt(position) {
    const id = this.tile(position)?.entityId
    return id ? this.entities.get(id) || null : null
  }

  entity(id) { return this.entities.get(id) || null }

  removeEntity(id) {
    const entity = this.entities.get(id)
    if (!entity) return null
    const tile = this.tile(entity.pos)
    if (tile?.entityId === id) tile.entityId = null
    this.entities.delete(id)
    return entity
  }

  moveEntity(id, position) {
    const entity = this.entity(id)
    const target = this.tile(position)
    if (!entity || !target || target.entityId) return false
    const source = this.tile(entity.pos)
    if (source?.entityId === id) source.entityId = null
    target.entityId = id
    entity.pos = { ...position }
    return true
  }

  isEmpty(position) { return this.contains(position) && !this.entityAt(position) }

  serialize() {
    return {
      id: this.id,
      floor: this.floor,
      width: this.width,
      height: this.height,
      tiles: this.tiles.map((row) => row.map((tile) => ({ ...tile }))),
      entities: [...this.entities.values()].map((entity) => ({ ...entity, pos: { ...entity.pos }, arrival: entity.arrival ? { ...entity.arrival } : null })),
      revealCounter: this.revealCounter,
      visited: this.visited,
      entry: this.entry ? { ...this.entry } : null,
    }
  }

  static hydrate(data) {
    const room = new Room(data)
    room.tiles = data.tiles.map((row) => row.map((tile) => ({ ...tile })))
    room.entities = new Map(data.entities.map((entity) => [entity.id, {
      ...entity,
      pos: { ...entity.pos },
      arrival: entity.arrival ? { ...entity.arrival } : null,
    }]))
    room.revealCounter = data.revealCounter || 0
    room.visited = !!data.visited
    room.entry = data.entry ? { ...data.entry } : null
    return room
  }
}
