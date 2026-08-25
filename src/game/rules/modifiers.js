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

export function attackAttributeModifier(weapon, target) {
  return attributeModifier(weapon?.attribute, target?.attribute)
}

export function computeAttackDamage({ weapon, target, pendingAttackBonus = 0, relicModifiers = [], terrainModifiers = [] } = {}) {
  if (!weapon) return { damage: 0, countered: false, resisted: false, resolution: resolveDamage(0) }
  const type = attackAttributeModifier(weapon, target)
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
import { attributeModifier } from '../data/attributes.js'
