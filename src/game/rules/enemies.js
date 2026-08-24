import { combatDistance } from '../core/geometry.js'

function waitForCooldown(enemy) {
  if (enemy.cooldown > 0) {
    enemy.cooldown -= 1
    return true
  }
  return false
}

function attackIfInRange(enemy, { player, attack }) {
  if (combatDistance(enemy.pos, player.pos, enemy.range) > enemy.range) return { acted: false, reason: 'out-of-range' }
  attack(enemy)
  return { acted: true, reason: 'attack' }
}

export function stationaryBehavior(enemy, context) {
  if (waitForCooldown(enemy)) return { acted: false, reason: 'cooldown' }
  return attackIfInRange(enemy, context)
}

export const ENEMY_BEHAVIORS = Object.freeze({ stationary: stationaryBehavior })

export function stepEnemy(enemy, context) {
  const behavior = ENEMY_BEHAVIORS[enemy.behavior] || stationaryBehavior
  return behavior(enemy, context)
}
