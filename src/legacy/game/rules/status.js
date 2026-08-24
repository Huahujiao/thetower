let statusSequence = 0

export const STATUS_STACK_RULES = Object.freeze({
  INDEPENDENT: 'independent',
  REPLACE: 'replace',
  REFRESH: 'refresh',
  MAX: 'max',
})

export class StatusStore {
  constructor(entries = []) {
    this.entries = []
    for (const entry of entries) this.add(entry)
  }

  add(status) {
    if (!status || !status.id) throw new TypeError('A status must have an id')
    const stackRule = status.stackRule || STATUS_STACK_RULES.INDEPENDENT
    const group = status.group || status.id
    const existing = this.entries.filter((entry) => entry.group === group)

    if (stackRule === STATUS_STACK_RULES.REPLACE && existing.length) {
      this.entries = this.entries.filter((entry) => entry.group !== group)
    } else if (stackRule === STATUS_STACK_RULES.REFRESH && existing.length) {
      const target = existing[existing.length - 1]
      if (status.turns !== null && status.turns !== undefined) target.turns = Math.max(target.turns ?? 0, status.turns)
      target.amount = status.amount ?? target.amount
      return target
    } else if (stackRule === STATUS_STACK_RULES.MAX && existing.length) {
      const target = existing[existing.length - 1]
      target.amount = Math.max(target.amount ?? 0, status.amount ?? 0)
      if (status.turns !== null && status.turns !== undefined) target.turns = Math.max(target.turns ?? 0, status.turns)
      return target
    }

    const instance = {
      uid: status.uid || `status:${++statusSequence}`,
      id: status.id,
      group,
      stackRule,
      amount: status.amount ?? 1,
      turns: status.turns ?? null,
      sourceOrder: status.sourceOrder ?? this.entries.length,
      data: status.data ? { ...status.data } : {},
    }
    this.entries.push(instance)
    return instance
  }

  has(id) { return this.entries.some((entry) => entry.id === id) }
  get(id) { return this.entries.find((entry) => entry.id === id) || null }
  all(id) { return id ? this.entries.filter((entry) => entry.id === id) : this.entries.slice() }
  totalAmount(id) { return this.all(id).reduce((sum, entry) => sum + (entry.amount || 0), 0) }

  remove(uidOrId) {
    const before = this.entries.length
    this.entries = this.entries.filter((entry) => entry.uid !== uidOrId && entry.id !== uidOrId)
    return before !== this.entries.length
  }

  tick() {
    const expired = []
    for (const entry of this.entries) {
      if (entry.turns === null) continue
      entry.turns--
      if (entry.turns <= 0) expired.push(entry)
    }
    if (expired.length) {
      const expiredIds = new Set(expired.map((entry) => entry.uid))
      this.entries = this.entries.filter((entry) => !expiredIds.has(entry.uid))
    }
    return expired
  }

  serialize() { return this.entries.map((entry) => ({ ...entry, data: { ...entry.data } })) }
}
