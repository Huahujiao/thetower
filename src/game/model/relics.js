export class RelicCollection {
  constructor({ entries = [] } = {}) {
    const knownIds = new Set()
    this.entries = []
    for (const entry of Array.isArray(entries) ? entries : []) {
      if (!entry || typeof entry.id !== 'string' || knownIds.has(entry.id)) continue
      knownIds.add(entry.id)
      this.entries.push({ id: entry.id, uid: typeof entry.uid === 'string' ? entry.uid : null })
    }
  }

  // Relics are active for as long as their one-cell item remains in the backpack.
  get active() { return this.entries }
  has(id) { return this.entries.some((entry) => entry.id === id) }
  isActive(id) { return this.has(id) }

  acquire(id, { uid = null } = {}) {
    if (!id || this.has(id)) return null
    const entry = { id, uid: typeof uid === 'string' ? uid : null }
    this.entries.push(entry)
    return entry
  }

  remove(idOrUid) {
    const index = this.entries.findIndex((entry) => entry.id === idOrUid || entry.uid === idOrUid)
    return index < 0 ? null : this.entries.splice(index, 1)[0]
  }

  serialize() { return { entries: this.entries.map((entry) => ({ id: entry.id, uid: entry.uid })) } }

  static fromItems(items = []) {
    return new RelicCollection({
      entries: (Array.isArray(items) ? items : [])
        .filter((item) => item?.type === 'relic' && typeof item.relicId === 'string')
        .map((item) => ({ id: item.relicId, uid: item.uid })),
    })
  }

  static hydrate(data) { return new RelicCollection(data || {}) }
}
