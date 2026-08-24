// Phase-one containers keep the current array-facing API while centralising
// capacity and slot semantics for the future backpack and hand-loadout models.
export class LinearContainer {
  constructor(capacity = Infinity, items = []) {
    this.capacity = capacity
    this.items = []
    this.replace(items)
  }

  replace(items) {
    if (!Array.isArray(items)) throw new TypeError('Container items must be an array')
    if (items.length > this.capacity) throw new Error('Container capacity exceeded')
    this.items = items.slice()
  }

  get length() { return this.items.length }
  get isFull() { return this.items.length >= this.capacity }
  canAdd(count = 1) { return this.items.length + count <= this.capacity }
  add(item) {
    if (!this.canAdd()) return false
    this.items.push(item)
    return true
  }
  removeAt(index) { return this.items.splice(index, 1)[0] || null }
  removeByUid(uid) {
    const index = this.items.findIndex((item) => item && item.uid === uid)
    return index < 0 ? null : this.removeAt(index)
  }
}

export class SlotContainer {
  constructor(size, slots = []) {
    if (!Number.isInteger(size) || size < 0) throw new TypeError('Slot count must be a non-negative integer')
    this.slots = Array.from({ length: size }, (_, index) => slots[index] || null)
  }

  get length() { return this.slots.length }
  get(index) { return this.slots[index] || null }
  set(index, item) {
    if (!Number.isInteger(index) || index < 0 || index >= this.slots.length) throw new RangeError('Invalid slot')
    this.slots[index] = item || null
  }
  replace(slots) {
    if (!Array.isArray(slots)) throw new TypeError('Slots must be an array')
    this.slots = Array.from({ length: this.slots.length }, (_, index) => slots[index] || null)
  }
}
