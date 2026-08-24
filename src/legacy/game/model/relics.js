import { RELIC_MAX_ACTIVE } from '../../data/relics.js'

function uniqueIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : []).filter(Boolean))]
}

function cloneRuntime(runtime) {
  if (!runtime || typeof runtime !== 'object') return {}
  try { return JSON.parse(JSON.stringify(runtime)) } catch { return {} }
}

/**
 * Run-scoped relic ownership and activation state.
 *
 * Collection is ordered by acquisition. That order is the stable tie-breaker
 * for all relic hooks and modifiers, even when the active five are changed in
 * a shop. Relics are never removed from collection during a run.
 */
export class RelicState {
  constructor(definitions = [], maxActive = RELIC_MAX_ACTIVE) {
    this.maxActive = Math.max(0, Math.floor(maxActive))
    this.definitions = new Map()
    this.setDefinitions(definitions)
    this.reset()
  }

  setDefinitions(definitions = []) {
    this.definitions = new Map(
      (Array.isArray(definitions) ? definitions : [])
        .filter((def) => def && def.id)
        .map((def) => [def.id, def]),
    )
    return this
  }

  reset() {
    this.collectedIds = []
    this.activeIds = []
    this.runtime = Object.create(null)
  }

  get collection() { return this.collectedIds.slice() }
  get active() { return this.activeIds.slice() }
  get size() { return this.collectedIds.length }
  get activeSize() { return this.activeIds.length }

  has(id) { return this.collectedIds.includes(id) }
  isActive(id) { return this.activeIds.includes(id) }
  getDef(id) { return this.definitions.get(id) || null }
  getRuntime(id) {
    if (!this.runtime[id]) this.runtime[id] = {}
    return this.runtime[id]
  }

  acquisitionOrder(id) {
    return this.collectedIds.indexOf(id)
  }

  availableIds() {
    return [...this.definitions.keys()].filter((id) => !this.has(id))
  }

  acquire(id, { activate = false } = {}) {
    if (!this.definitions.has(id)) return { ok: false, reason: 'unknown' }
    if (this.has(id)) return { ok: false, reason: 'already-collected' }
    this.collectedIds.push(id)
    this.runtime[id] = {}
    let activated = false
    if (activate && this.activeIds.length < this.maxActive) {
      this.activeIds.push(id)
      activated = true
    }
    return { ok: true, id, activated }
  }

  activate(id) {
    if (!this.has(id)) return { ok: false, reason: 'not-collected' }
    if (this.isActive(id)) return { ok: true, id, changed: false }
    if (this.activeIds.length >= this.maxActive) return { ok: false, reason: 'active-full' }
    this.activeIds.push(id)
    return { ok: true, id, changed: true }
  }

  deactivate(id) {
    const index = this.activeIds.indexOf(id)
    if (index < 0) return { ok: true, id, changed: false }
    this.activeIds.splice(index, 1)
    return { ok: true, id, changed: true }
  }

  setActive(ids) {
    const next = uniqueIds(ids)
    if (next.length > this.maxActive) return { ok: false, reason: 'active-full' }
    if (next.some((id) => !this.has(id))) return { ok: false, reason: 'not-collected' }
    this.activeIds = next
    return { ok: true, changed: true }
  }

  serialize() {
    return {
      collection: this.collection,
      active: this.active,
      runtime: Object.fromEntries(
        this.collectedIds.map((id) => [id, cloneRuntime(this.runtime[id])]),
      ),
    }
  }

  restore(payload = {}) {
    const collection = uniqueIds(payload.collection)
      .filter((id) => this.definitions.has(id))
    const collected = new Set(collection)
    const active = uniqueIds(payload.active)
      .filter((id) => collected.has(id))
      .slice(0, this.maxActive)
    this.collectedIds = collection
    this.activeIds = active
    this.runtime = Object.create(null)
    for (const id of collection) this.runtime[id] = cloneRuntime(payload.runtime?.[id])
    return this
  }
}
