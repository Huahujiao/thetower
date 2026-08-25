import { combatDistance } from '../core/geometry.js'
import { findPath } from './pathfinding.js'

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

function moveTowardPlayer(enemy, context) {
  const route = findPath(context.room, enemy.pos, context.player.pos)
  const next = route?.[0]
  if (!next || !context.move?.(enemy, next)) return { acted: false, reason: 'blocked' }
  return { acted: true, reason: 'move' }
}

export function chaserBehavior(enemy, context) {
  if (waitForCooldown(enemy)) return { acted: false, reason: 'cooldown' }
  if (combatDistance(enemy.pos, context.player.pos, enemy.range) <= enemy.range) return attackIfInRange(enemy, context)
  return moveTowardPlayer(enemy, context)
}

export function patrolBehavior(enemy, context) {
  if (waitForCooldown(enemy)) return { acted: false, reason: 'cooldown' }
  if (combatDistance(enemy.pos, context.player.pos, enemy.range) <= enemy.range) return attackIfInRange(enemy, context)
  const path = Array.isArray(enemy.patrolPath) ? enemy.patrolPath : []
  if (path.length < 2) return { acted: false, reason: 'blocked' }
  const nextIndex = (Number.isInteger(enemy.patrolIndex) ? enemy.patrolIndex + 1 : 1) % path.length
  const next = path[nextIndex]
  if (!context.room.isRevealed(next) || !context.move?.(enemy, next)) return { acted: false, reason: 'blocked' }
  enemy.patrolIndex = nextIndex
  return { acted: true, reason: 'patrol' }
}

export function ambushBehavior(enemy, context) {
  return stationaryBehavior(enemy, context)
}

export function summonerBehavior(enemy, context) {
  if (waitForCooldown(enemy)) return { acted: false, reason: 'cooldown' }
  return context.summon?.(enemy) || { acted: false, reason: 'summon' }
}

export function selfDestructBehavior(enemy, context) {
  if (waitForCooldown(enemy)) return { acted: false, reason: 'cooldown' }
  if (combatDistance(enemy.pos, context.player.pos, enemy.range) > enemy.range) return { acted: false, reason: 'out-of-range' }
  return context.charge?.(enemy) || { acted: false, reason: 'charge' }
}

export const ENEMY_BEHAVIORS = Object.freeze({
  stationary: stationaryBehavior,
  chaser: chaserBehavior,
  patrol: patrolBehavior,
  ambush: ambushBehavior,
  summoner: summonerBehavior,
  'self-destruct': selfDestructBehavior,
})

export function stepEnemy(enemy, context) {
  const behavior = ENEMY_BEHAVIORS[enemy.behavior] || stationaryBehavior
  return behavior(enemy, context)
}
