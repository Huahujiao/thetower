export class RelicCollection {
  constructor({ maxActive = 5, entries = [] } = {}) {
    this.maxActive = Number.isInteger(maxActive) && maxActive > 0 ? maxActive : 5
    const knownIds = new Set()
    this.entries = []
    for (const entry of Array.isArray(entries) ? entries : []) {
      if (!entry || typeof entry.id !== 'string' || knownIds.has(entry.id)) continue
      knownIds.add(entry.id)
      this.entries.push({ id: entry.id, active: !!entry.active && this.active.length < this.maxActive })
    }
  }

  get active() { return this.entries.filter((entry) => entry.active) }
  has(id) { return this.entries.some((entry) => entry.id === id) }
  isActive(id) { return !!this.entries.find((entry) => entry.id === id)?.active }

  acquire(id, { activate = false } = {}) {
    if (!id || this.has(id)) return null
    const entry = { id, active: activate && this.active.length < this.maxActive }
    this.entries.push(entry)
    return entry
  }

  activate(id) {
    const entry = this.entries.find((candidate) => candidate.id === id)
    if (!entry || entry.active || this.active.length >= this.maxActive) return false
    entry.active = true
    return true
  }

  deactivate(id) {
    const entry = this.entries.find((candidate) => candidate.id === id)
    if (!entry || !entry.active) return false
    entry.active = false
    return true
  }

  serialize() { return { maxActive: this.maxActive, entries: this.entries.map((entry) => ({ ...entry })) } }

  static hydrate(data) { return new RelicCollection(data || {}) }
}
