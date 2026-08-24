export const RESOLUTION_PHASES = Object.freeze({
  BEFORE_ACTION: 10,
  DAMAGE: 20,
  DURABILITY: 30,
  RETALIATION: 40,
  SECONDARY: 45,
  DEATH: 50,
  AFTER_ACTION: 60,
  TURN_START: 70,
  TURN_STATUS: 80,
  TURN_END: 90,
})

const MAX_EFFECTS_PER_RESOLUTION = 1000

function phaseValue(phase) {
  return typeof phase === 'number' ? phase : RESOLUTION_PHASES[phase] ?? 0
}

export class EffectQueue {
  constructor({ maxEffects = MAX_EFFECTS_PER_RESOLUTION } = {}) {
    this.maxEffects = maxEffects
    this.pending = []
    this.trace = []
    this.sequence = 0
  }

  enqueue(effect, options = {}) {
    if (typeof effect === 'function') effect = { apply: effect }
    if (!effect || typeof effect.apply !== 'function') throw new TypeError('An effect must provide apply(context)')
    this.pending.push({
      id: effect.id || options.id || `effect:${this.sequence}`,
      apply: effect.apply,
      when: effect.when || options.when,
      phase: phaseValue(effect.phase ?? options.phase ?? 0),
      priority: effect.priority ?? options.priority ?? 0,
      sourceOrder: effect.sourceOrder ?? options.sourceOrder ?? this.sequence,
      sequence: this.sequence++,
      source: effect.source || options.source || null,
    })
    return this
  }

  enqueueAll(effects = [], options = {}) {
    effects.forEach((effect, index) => this.enqueue(effect, { ...options, sourceOrder: effect.sourceOrder ?? index }))
    return this
  }

  run(context = {}) {
    let applied = 0
    while (this.pending.length) {
      if (++applied > this.maxEffects) throw new Error('Effect queue exceeded its safety limit')
      this.pending.sort((a, b) => a.phase - b.phase || a.priority - b.priority || a.sourceOrder - b.sourceOrder || a.sequence - b.sequence)
      const item = this.pending.shift()
      if (item.when && !item.when(context)) continue
      const result = item.apply(context)
      this.trace.push({ id: item.id, phase: item.phase, priority: item.priority, sourceOrder: item.sourceOrder, source: item.source })
      if (Array.isArray(result)) this.enqueueAll(result)
    }
    return this.trace.slice()
  }
}

export function resolveEffects(effects, context = {}, options = {}) {
  return new EffectQueue(options).enqueueAll(effects).run(context)
}
