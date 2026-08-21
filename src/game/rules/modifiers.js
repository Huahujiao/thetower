// Numeric modifier pipeline. Modifiers are ordered by priority and acquisition
// order. Percent additions in the same phase are grouped, so +5% and +5%
// produce +10% rather than compounding to 10.25%.
export const MODIFIER_OPERATIONS = Object.freeze({
  ADD: 'add',
  PERCENT_ADD: 'percentAdd',
  MULTIPLY: 'multiply',
  SET: 'set',
  MIN: 'min',
  MAX: 'max',
})

function ordered(modifiers) {
  return modifiers
    .map((modifier, index) => ({ ...modifier, _order: modifier.order ?? index }))
    .sort((a, b) => (a.priority || 0) - (b.priority || 0) || a._order - b._order)
}

export class ModifierPipeline {
  constructor(baseValue) {
    this.baseValue = baseValue
    this.modifiers = []
  }

  add(modifier) {
    if (!modifier || modifier.value === undefined) return this
    this.modifiers.push({ ...modifier, order: modifier.order ?? this.modifiers.length })
    return this
  }

  addAll(modifiers = []) {
    for (const modifier of modifiers) this.add(modifier)
    return this
  }

  resolve() {
    let value = this.baseValue
    let percentPhase = null
    let percentTotal = 0

    const flushPercent = () => {
      if (percentPhase !== null) value *= 1 + percentTotal
      percentPhase = null
      percentTotal = 0
    }

    for (const modifier of ordered(this.modifiers)) {
      const operation = modifier.operation || MODIFIER_OPERATIONS.ADD
      if (operation === MODIFIER_OPERATIONS.PERCENT_ADD) {
        const phase = modifier.phase || 'default'
        if (percentPhase !== null && percentPhase !== phase) flushPercent()
        percentPhase = phase
        percentTotal += modifier.value
        continue
      }

      flushPercent()
      if (operation === MODIFIER_OPERATIONS.ADD) value += modifier.value
      else if (operation === MODIFIER_OPERATIONS.MULTIPLY) value *= modifier.value
      else if (operation === MODIFIER_OPERATIONS.SET) value = modifier.value
      else if (operation === MODIFIER_OPERATIONS.MIN) value = Math.min(value, modifier.value)
      else if (operation === MODIFIER_OPERATIONS.MAX) value = Math.max(value, modifier.value)
      else throw new Error(`Unknown modifier operation: ${operation}`)
    }
    flushPercent()
    return value
  }
}

export function resolveNumber(baseValue, modifiers = []) {
  return new ModifierPipeline(baseValue).addAll(modifiers).resolve()
}
