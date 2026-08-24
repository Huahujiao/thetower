export const BAG_COLUMNS = 10
export const BAG_ROWS = 5

function cloneShape(shape) {
  const source = Array.isArray(shape) && shape.length ? shape : [[1]]
  const width = Math.max(1, ...source.map((row) => Array.isArray(row) ? row.length : 0))
  return source.map((row) => Array.from({ length: width }, (_, index) => row?.[index] ? 1 : 0))
}

export function rotateShape(shape, turns = 0) {
  let result = cloneShape(shape)
  const count = ((turns % 4) + 4) % 4
  for (let turn = 0; turn < count; turn++) {
    const height = result.length
    const width = result[0].length
    result = Array.from({ length: width }, (_, y) =>
      Array.from({ length: height }, (_, x) => result[height - 1 - x][y]))
  }
  return result
}

function itemKey(item) {
  return item?.uid || item
}

function itemShape(item) {
  return item?.def?.shape || item?.shape || [[1]]
}

function shapeSignature(shape) {
  return shape.map((row) => row.join('')).join('/')
}

/**
 * A fixed 10×5 item grid. Placement coordinates are zero-based and refer to
 * the top-left cell of the item's rotated footprint. Item effects do not
 * depend on coordinates; the coordinates only answer fit/occupancy queries
 * and provide future relics with stable placement data.
 */
export class BackpackGrid {
  constructor(columns = BAG_COLUMNS, rows = BAG_ROWS) {
    if (!Number.isInteger(columns) || columns < 1) throw new TypeError('Backpack columns must be a positive integer')
    if (!Number.isInteger(rows) || rows < 1) throw new TypeError('Backpack rows must be a positive integer')
    this.columns = columns
    this.rows = rows
    this.placements = []
  }

  get capacity() { return this.columns * this.rows }
  get items() { return this.placements.map((placement) => placement.item) }
  get length() { return this.placements.length }
  get usedCells() {
    return this.placements.reduce((total, placement) => total + this.cellsForPlacement(placement).length, 0)
  }
  get isFull() { return this.usedCells >= this.capacity }

  shapeFor(item, rotation = 0) {
    return rotateShape(itemShape(item), rotation)
  }

  cellsFor(item, x, y, rotation = 0) {
    const shape = this.shapeFor(item, rotation)
    const cells = []
    for (let row = 0; row < shape.length; row++) {
      for (let column = 0; column < shape[row].length; column++) {
        if (shape[row][column]) cells.push({ x: x + column, y: y + row })
      }
    }
    return cells
  }

  cellsForPlacement(placement) {
    return this.cellsFor(placement.item, placement.x, placement.y, placement.rotation)
  }

  placementOf(itemOrUid) {
    const uid = typeof itemOrUid === 'object' ? itemOrUid?.uid : itemOrUid
    return this.placements.find((placement) => placement.item?.uid === uid || itemKey(placement.item) === uid) || null
  }

  canPlace(item, x, y, rotation = 0, ignoreUid = item?.uid) {
    if (!item || !Number.isInteger(x) || !Number.isInteger(y)) return false
    const shape = this.shapeFor(item, rotation)
    const cells = this.cellsFor(item, x, y, rotation)
    if (!cells.length) return false
    if (shape.length + y > this.rows || shape[0].length + x > this.columns || x < 0 || y < 0) return false
    const occupied = new Set()
    for (const placement of this.placements) {
      if (placement.item?.uid === ignoreUid) continue
      for (const cell of this.cellsForPlacement(placement)) occupied.add(`${cell.x},${cell.y}`)
    }
    return cells.every((cell) => !occupied.has(`${cell.x},${cell.y}`))
  }

  _rotationOptions(item, preferredRotation = 0) {
    const rotations = [((preferredRotation % 4) + 4) % 4]
    if (item?.def?.rotatable === false) return rotations
    for (const rotation of [0, 1, 2, 3]) {
      if (!rotations.includes(rotation)) rotations.push(rotation)
    }
    return rotations.filter((rotation, index, all) => {
      const signature = shapeSignature(this.shapeFor(item, rotation))
      return all.findIndex((candidate) => shapeSignature(this.shapeFor(item, candidate)) === signature) === index
    })
  }

  firstFit(item, preferredRotation = 0) {
    for (const rotation of this._rotationOptions(item, preferredRotation)) {
      const shape = this.shapeFor(item, rotation)
      for (let y = 0; y <= this.rows - shape.length; y++) {
        for (let x = 0; x <= this.columns - shape[0].length; x++) {
          if (this.canPlace(item, x, y, rotation)) return { x, y, rotation }
        }
      }
    }
    return null
  }

  canFit(item) { return !!this.firstFit(item, item?.bagRotation || 0) }

  add(item, preferredRotation = item?.bagRotation || 0) {
    const placement = this.firstFit(item, preferredRotation)
    if (!placement) return null
    this.placements.push({ ...placement, item })
    item.bagRotation = placement.rotation
    return placement
  }

  move(itemOrUid, x, y, rotation = null) {
    const placement = this.placementOf(itemOrUid)
    if (!placement) return false
    const nextRotation = rotation == null ? placement.rotation : rotation
    if (!this.canPlace(placement.item, x, y, nextRotation, placement.item.uid)) return false
    placement.x = x
    placement.y = y
    placement.rotation = ((nextRotation % 4) + 4) % 4
    placement.item.bagRotation = placement.rotation
    return true
  }

  rotate(itemOrUid) {
    const placement = this.placementOf(itemOrUid)
    if (!placement || placement.item?.def?.rotatable === false) return false
    const nextRotation = (placement.rotation + 1) % 4
    if (!this.canPlace(placement.item, placement.x, placement.y, nextRotation, placement.item.uid)) return false
    placement.rotation = nextRotation
    placement.item.bagRotation = nextRotation
    return true
  }

  removeByUid(uid) {
    const index = this.placements.findIndex((placement) => placement.item?.uid === uid)
    if (index < 0) return null
    return this.placements.splice(index, 1)[0].item
  }

  removeAt(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.placements.length) return null
    return this.placements.splice(index, 1)[0].item
  }

  replace(items) {
    if (!Array.isArray(items)) throw new TypeError('Backpack items must be an array')
    this.placements = []
    const failed = []
    for (const item of items) if (!this.add(item)) failed.push(item)
    return failed
  }

  serialize(serializeItem) {
    return {
      columns: this.columns,
      rows: this.rows,
      placements: this.placements.map((placement) => ({
        x: placement.x,
        y: placement.y,
        rotation: placement.rotation,
        item: serializeItem(placement.item),
      })),
    }
  }

  restore(payload, deserializeItem) {
    this.placements = []
    if (!payload || !Array.isArray(payload.placements)) return
    for (const saved of payload.placements) {
      const item = deserializeItem(saved.item)
      if (!item) continue
      const rotation = Number.isInteger(saved.rotation) ? saved.rotation : 0
      if (this.canPlace(item, saved.x, saved.y, rotation)) {
        this.placements.push({ item, x: saved.x, y: saved.y, rotation: ((rotation % 4) + 4) % 4 })
        item.bagRotation = rotation
      } else {
        this.add(item, rotation)
      }
    }
  }
}
