import { combatDistance } from '../core/geometry.js'
import { findPath } from './pathfinding.js'
import { consumeStatus, getStatus } from './statuses.js'

function tickCounter(enemy, key) {
  if ((enemy[key] || 0) <= 0) return false
  enemy[key] -= 1
  return true
}

function cooldownWaitTurns(interval) { return Math.max(0, Number(interval) - 1) }

function hasNormalAttack(enemy) {
  return (enemy.attack || 0) > 0 && (enemy.range || 0) > 0
}

function attackIfInRange(enemy, { player, attack }) {
  if (!hasNormalAttack(enemy)) return { acted: false, reason: 'no-normal-attack' }
  if (combatDistance(enemy.pos, player.pos, enemy.range) > enemy.range) return { acted: false, reason: 'out-of-range' }
  attack(enemy)
  return { acted: true, reason: 'attack' }
}

function moveTowardPlayer(enemy, context) {
  if (hasNormalAttack(enemy) && combatDistance(enemy.pos, context.player.pos, enemy.range) <= enemy.range) {
    return { acted: false, reason: 'in-range' }
  }
  const maxSteps = enemy.traits?.includes('swift') ? 2 : 1
  let movedSteps = 0
  while (movedSteps < maxSteps) {
    if (getStatus(enemy, 'rooted')) break
    const route = context.path ? context.path(enemy) : findPath(context.room, enemy.pos, context.player.pos)
    const next = route?.[0]
    const obstacle = next && context.room.entityAt(next)?.kind === 'totem' ? context.room.entityAt(next) : null
    if (obstacle && context.attackObstacle) {
      if ((enemy.attackCooldown || 0) > 0) break
      context.attackObstacle?.(enemy, obstacle)
      return { acted: true, reason: 'totem-attack', movedSteps, skipAttack: true }
    }
    if (next?.c === context.player.pos.c && next?.r === context.player.pos.r) break
    if (!next || !context.move?.(enemy, next)) break
    movedSteps += 1
  }
  if (movedSteps === 0) return { acted: false, reason: 'blocked' }
  return {
    acted: true,
    reason: 'move',
    movedSteps,
    skipAttack: movedSteps >= 2 || !!getStatus(enemy, 'rooted')?.blocksAttack,
  }
}

export function stationaryBehavior() { return { acted: false, reason: 'idle' } }

export function chaserBehavior(enemy, context) { return moveTowardPlayer(enemy, context) }

export function ambushBehavior() { return stationaryBehavior() }

export const ENEMY_BEHAVIORS = Object.freeze({
  stationary: stationaryBehavior,
  chaser: chaserBehavior,
  ambush: ambushBehavior,
})

export function stepEnemy(enemy, context) {
  const rooted = getStatus(enemy, 'rooted')
  if (rooted) {
    consumeStatus(enemy, 'rooted', rooted)
    tickCounter(enemy, 'actionDelay'); tickCounter(enemy, 'attackCooldown')
    return { acted: false, reason: 'rooted' }
  }
  if (tickCounter(enemy, 'actionDelay')) return { acted: false, reason: 'action-delay' }

  const behavior = ENEMY_BEHAVIORS[enemy.behavior] || stationaryBehavior
  const movement = behavior(enemy, context)
  if (movement.acted) enemy.hasActed = true
  if (movement.reason === 'totem-attack') return movement
  const attackCooling = tickCounter(enemy, 'attackCooldown')

  if (!movement.skipAttack && !attackCooling) {
    const attack = attackIfInRange(enemy, context)
    if (attack.acted) {
      enemy.attackCooldown = cooldownWaitTurns(enemy.attackCooldownMax)
      enemy.hasActed = true
      return { ...attack, moved: movement.acted }
    }
  }

  return movement
}
