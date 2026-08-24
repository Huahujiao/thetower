import { GRIP } from '../../data/cards.js'

function itemDef(item) {
  return item?.def || item || null
}

function itemKey(item) {
  return item?.uid || item
}

function uniqueItems(items) {
  const seen = new Set()
  return items.filter((item) => {
    if (!item) return false
    const key = itemKey(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Two-hand weapon loadout.
 *
 * A one-handed weapon occupies one hand; a two-handed weapon occupies both
 * hands. The public slot view keeps a two-handed weapon in the right-hand
 * slot and marks the left-hand slot unavailable, while `items` is the unique
 * list used by combat and shop logic.
 */
export class WeaponLoadout {
  constructor(handCount = 2) {
    if (!Number.isInteger(handCount) || handCount < 1) throw new TypeError('Hand count must be a positive integer')
    this.handCount = handCount
    this.placements = []
  }

  get length() { return this.handCount }

  get slots() {
    return Array.from({ length: this.handCount }, (_, hand) => {
      const placement = this.placements.find((entry) => entry.hands.includes(hand))
      return placement && !this.isUnavailable(hand) ? placement.item : null
    })
  }

  isUnavailable(handIndex) {
    const placement = this.placements.find((entry) => entry.hands.includes(handIndex))
    // The current two-hand UI reserves the right-hand slot as the visible
    // carrier and leaves the left-hand slot visibly unavailable.
    return !!placement && placement.hands.length > 1 && handIndex === 0
  }

  get items() {
    return uniqueItems(this.placements.map((entry) => entry.item))
  }

  _requiredHands(item, handIndex = 0) {
    const def = itemDef(item)
    if (!def || def.atk === undefined) return null
    if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= this.handCount) return null
    if (def.grip === GRIP.TWO) return this.handCount < 2 ? null : [0, 1]
    return [handIndex]
  }

  _overlapping(hands) {
    return uniqueItems(this.placements
      .filter((entry) => entry.hands.some((hand) => hands.includes(hand)))
      .map((entry) => entry.item))
  }

  canEquip(item, handIndex = 0, { allowOccupied = false } = {}) {
    const hands = this._requiredHands(item, handIndex)
    if (!hands) return false
    const overlapping = this._overlapping(hands)
    return allowOccupied || overlapping.length === 0
  }

  firstAvailableHand(item) {
    for (let hand = 0; hand < this.handCount; hand++) {
      if (this.canEquip(item, hand)) return hand
    }
    return -1
  }

  equip(item, handIndex = 0, { replace = true } = {}) {
    const hands = this._requiredHands(item, handIndex)
    if (!hands) return { ok: false, removed: [], reason: 'not-weapon' }
    const overlapping = this._overlapping(hands)
    if (!replace && overlapping.length) return { ok: false, removed: overlapping, reason: 'occupied' }
    this.placements = this.placements.filter((entry) => !entry.hands.some((hand) => hands.includes(hand)))
    this.placements.push({ item, hands: hands.slice() })
    return { ok: true, removed: overlapping }
  }

  removeAt(handIndex) {
    if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= this.handCount) return []
    const removed = this._overlapping([handIndex])
    this.placements = this.placements.filter((entry) => !entry.hands.includes(handIndex))
    return removed
  }

  removeByUid(uid) {
    const removed = this.placements.filter((entry) => entry.item?.uid === uid).map((entry) => entry.item)
    if (!removed.length) return null
    this.placements = this.placements.filter((entry) => entry.item?.uid !== uid)
    return removed[0]
  }

  findByUid(uid) {
    return this.placements.find((entry) => entry.item?.uid === uid)?.item || null
  }

  replaceFromSlots(slots) {
    if (!Array.isArray(slots)) throw new TypeError('Weapon slots must be an array')
    this.placements = []
    const seen = new Set()
    slots.slice(0, this.handCount).forEach((item, index) => {
      if (!item || seen.has(itemKey(item))) return
      const preferredHand = itemDef(item).grip === GRIP.TWO ? 0 : index
      const result = this.equip(item, preferredHand, { replace: false })
      if (result.ok) seen.add(itemKey(item))
    })
  }

  serialize(serializeItem) {
    return {
      handCount: this.handCount,
      placements: this.placements.map((entry) => ({
        hands: entry.hands.slice(),
        item: serializeItem(entry.item),
      })),
    }
  }

  restore(payload, deserializeItem) {
    this.placements = []
    if (!payload || !Array.isArray(payload.placements)) return
    for (const entry of payload.placements) {
      const item = deserializeItem(entry.item)
      const hand = Array.isArray(entry.hands) && Number.isInteger(entry.hands[0]) ? entry.hands[0] : 0
      if (item) this.equip(item, hand, { replace: false })
    }
  }
}
