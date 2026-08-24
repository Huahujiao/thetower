import { random } from '../core/rng.js'
import { MODIFIER_OPERATIONS, resolveNumber } from './modifiers.js'

export const COUNTER = { '劈砍': 'blood', '穿刺': 'shell', '钝击': 'spirit', '元素': 'spirit' }
export const WEAKTO = { '劈砍': 'shell', '穿刺': 'spirit', '钝击': 'blood', '元素': 'shell' }

export function catOf(weaponType) {
  return COUNTER[weaponType]
}

export function counterMult(weaponType, monster) {
  if (COUNTER[weaponType] === monster.category) return 1.3
  if (WEAKTO[weaponType] === monster.category) return 0.7
  return 1.0
}

export function durFactor(currentDurability) {
  if (currentDurability <= 0) return 0
  if (currentDurability >= 7) return 1
  if (currentDurability >= 4) return 0.8
  return 0.6
}

export function weaponPower(weapon) {
  const modifiers = []
  if (weapon.tags.includes('锋锐')) modifiers.push({ operation: MODIFIER_OPERATIONS.ADD, value: 2 })
  if (weapon.tags.includes('锋锐+1')) modifiers.push({ operation: MODIFIER_OPERATIONS.ADD, value: 1 })
  if (weapon.pollutAtk) modifiers.push({ operation: MODIFIER_OPERATIONS.ADD, value: weapon.pollutAtk })
  return resolveNumber(weapon.def.atk, modifiers)
}

export function computeDamage(weapon, monsterDef, buff, {
  roll = random,
  modifiers = [],
  powerModifiers = [],
  durabilityFactorModifiers = [],
} = {}) {
  let multiplier = counterMult(weapon.def.type, monsterDef)
  if (buff && buff.ignoreCounter) multiplier = 1.3
  if (weapon.tags.includes('元素亲和') && weapon.def.type === '元素' && monsterDef.category === 'spirit') multiplier = 2.0

  const power = resolveNumber(weapon.def.atk, [
    ...(weapon.tags.includes('锋锐') ? [{ operation: MODIFIER_OPERATIONS.ADD, value: 2 }] : []),
    ...(weapon.tags.includes('锋锐+1') ? [{ operation: MODIFIER_OPERATIONS.ADD, value: 1 }] : []),
    ...(weapon.pollutAtk ? [{ operation: MODIFIER_OPERATIONS.ADD, value: weapon.pollutAtk }] : []),
    ...(buff && buff.atk ? [{ operation: MODIFIER_OPERATIONS.ADD, value: buff.atk }] : []),
    ...powerModifiers,
  ])
  const durabilityFactor = resolveNumber(durFactor(weapon.curDur), durabilityFactorModifiers)
  const attack = Math.floor(power * Math.max(0, durabilityFactor))
  let damage = Math.floor(attack * multiplier)
  if (buff && buff.bonus) damage += buff.bonus
  if (weapon.tags.includes('屠魔') && monsterDef.category === 'blood') damage += Math.floor(damage * 0.3)
  if (weapon.tags.includes('破甲') && monsterDef.category === 'shell') damage += Math.floor(damage * 0.3)
  if (weapon.tags.includes('驱灵') && monsterDef.category === 'spirit') damage += Math.floor(damage * 0.3)

  let crit = false
  if ((weapon.tags.includes('致命') && roll() < 0.15) || (buff && buff.forceCrit)) {
    crit = true
    damage = Math.floor(damage * 1.5)
  }
  damage = Math.floor(resolveNumber(damage, modifiers))
  return { dmg: Math.max(1, damage), crit }
}
