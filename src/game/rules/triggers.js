export class TriggerRegistry {
  constructor() {
    this.entries = []
    this.sequence = 0
  }

  register({ event, priority = 0, sourceOrder, when, effects }) {
    if (!event || typeof effects !== 'function') throw new TypeError('A trigger requires an event and effects(context)')
    const entry = {
      event,
      priority,
      sourceOrder: sourceOrder ?? this.sequence,
      sequence: this.sequence++,
      when,
      effects,
    }
    this.entries.push(entry)
    return () => {
      const index = this.entries.indexOf(entry)
      if (index >= 0) this.entries.splice(index, 1)
    }
  }

  collect(event, context = {}) {
    const matching = this.entries
      .filter((entry) => entry.event === event && (!entry.when || entry.when(context)))
      .sort((a, b) => a.priority - b.priority || a.sourceOrder - b.sourceOrder || a.sequence - b.sequence)
    const effects = []
    for (const entry of matching) {
      const produced = entry.effects(context)
      if (!produced) continue
      const list = Array.isArray(produced) ? produced : [produced]
      for (const effect of list) {
        if (typeof effect === 'function') effects.push({ apply: effect, sourceOrder: entry.sourceOrder })
        else effects.push({ ...effect, sourceOrder: effect.sourceOrder ?? entry.sourceOrder })
      }
    }
    return effects
  }

  clear() { this.entries.length = 0 }
}
