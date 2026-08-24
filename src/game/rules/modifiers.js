export const DAMAGE_STAGES = Object.freeze({
  FLAT: 'flat',
  MULTIPLY: 'multiply',
})

export function damageModifier(stage, value, source = 'unknown') {
  return { stage, value: Number(value) || 0, source }
}

export function resolveDamage(baseDamage, modifiers = []) {
  const base = Math.max(0, Number(baseDamage) || 0)
  const flat = modifiers
    .filter((modifier) => modifier.stage === DAMAGE_STAGES.FLAT)
    .reduce((total, modifier) => total + modifier.value, 0)
  const multiplier = modifiers
    .filter((modifier) => modifier.stage === DAMAGE_STAGES.MULTIPLY)
    .reduce((total, modifier) => total * modifier.value, 1)
  return {
    base,
    flat,
    multiplier,
    total: Math.max(1, Math.floor((base + flat) * multiplier)),
    modifiers: modifiers.map((modifier) => ({ ...modifier })),
  }
}

const COUNTERED_CATEGORY = Object.freeze({
  slash: 'blood',
  pierce: 'shell',
  blunt: 'spirit',
})

const RESISTED_CATEGORY = Object.freeze({
  slash: 'shell',
  pierce: 'spirit',
  blunt: 'blood',
})

export function attackTypeModifier(weapon, target) {
  const damageType = weapon?.damageType
  const category = target?.category
  if (!damageType || !category) return { multiplier: 1, countered: false, resisted: false }
  if (COUNTERED_CATEGORY[damageType] === category) return { multiplier: 1.6, countered: true, resisted: false }
  if (RESISTED_CATEGORY[damageType] === category) return { multiplier: 0.65, countered: false, resisted: true }
  return { multiplier: 1, countered: false, resisted: false }
}

export function computeAttackDamage({ weapon, target, pendingAttackBonus = 0, relicModifiers = [], terrainModifiers = [] } = {}) {
  if (!weapon) return { damage: 0, countered: false, resisted: false, resolution: resolveDamage(0) }
  const type = attackTypeModifier(weapon, target)
  const modifiers = [
    ...(pendingAttackBonus ? [damageModifier(DAMAGE_STAGES.FLAT, pendingAttackBonus, 'pending-buff')] : []),
    ...(weapon.durability === 1 ? [damageModifier(DAMAGE_STAGES.MULTIPLY, 0.5, 'last-durability')] : []),
    ...(type.multiplier !== 1 ? [damageModifier(DAMAGE_STAGES.MULTIPLY, type.multiplier, type.countered ? 'counter' : 'resisted')] : []),
    ...relicModifiers,
    ...terrainModifiers,
  ]
  const resolution = resolveDamage(weapon.attack, modifiers)
  return { damage: resolution.total, countered: type.countered, resisted: type.resisted, resolution }
}
