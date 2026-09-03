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
    // All rule calculations are floored and may legitimately resolve to 0.
    // Individual callers can impose a minimum where the game rule requires
    // one (for example, an enemy's normal attack), but the generic damage
    // resolver must not silently turn a zero result into 1.
    total: Math.max(0, Math.floor((base + flat) * multiplier)),
    modifiers: modifiers.map((modifier) => ({ ...modifier })),
  }
}

export function attackAttributeModifier(weapon, target, { counterBonus = 0 } = {}) {
  const result = attributeModifier(weapon?.attribute, target?.attribute)
  return result.countered ? { ...result, multiplier: result.multiplier + Math.max(0, Number(counterBonus) || 0) } : result
}

export function computeAttackDamage({ weapon, target, pendingAttackBonus = 0, relicModifiers = [], terrainModifiers = [], finalStrike = false, counterBonus = 0 } = {}) {
  if (!weapon) return { damage: 0, countered: false, resisted: false, resolution: resolveDamage(0) }
  const type = attackAttributeModifier(weapon, target, { counterBonus })
  const modifiers = [
    ...(pendingAttackBonus ? [damageModifier(DAMAGE_STAGES.FLAT, pendingAttackBonus, 'pending-buff')] : []),
    ...(finalStrike && weapon.weaponClass === 'heavy' ? [damageModifier(DAMAGE_STAGES.MULTIPLY, 1.5, 'weapon:heavy-final')] : []),
    ...(type.multiplier !== 1 ? [damageModifier(DAMAGE_STAGES.MULTIPLY, type.multiplier, type.countered ? 'counter' : 'resisted')] : []),
    ...relicModifiers,
    ...terrainModifiers,
  ]
  const resolution = resolveDamage(weapon.attack || 0, modifiers)
  return { damage: resolution.total, countered: type.countered, resisted: type.resisted, resolution }
}
import { attributeModifier } from '../data/attributes.js'
