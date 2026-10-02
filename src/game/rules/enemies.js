import { combatDistance } from '../core/geometry.js'
import { findPath } from './pathfinding.js'
import { consumeStatus, getStatus } from './statuses.js'

function tickCounter(enemy, key) {
  if ((enemy[key] || 0) <= 0) return false
  enemy[key] -= 1
  return true
}

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
  const maxSteps = Math.max(0, Math.floor(Number(enemy.speed) || 0))
  if (maxSteps === 0) return { acted: false, reason: 'immobile' }
  let movedSteps = 0
  while (movedSteps < maxSteps) {
    if (getStatus(enemy, 'rooted')) break
    if (hasNormalAttack(enemy) && combatDistance(enemy.pos, context.player.pos, enemy.range) <= enemy.range) break
    const route = context.path ? context.path(enemy) : findPath(context.room, enemy.pos, context.player.pos)
    const next = route?.[0]
    const obstacle = next && context.room.entityAt(next)?.kind === 'totem' ? context.room.entityAt(next) : null
    if (obstacle && context.attackObstacle) {
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
    skipAttack: !!getStatus(enemy, 'rooted')?.blocksAttack,
  }
}

export function stepEnemy(enemy, context) {
  enemy.attackCooldown = 0
  const rooted = getStatus(enemy, 'rooted')
  if (rooted) {
    consumeStatus(enemy, 'rooted', rooted)
    tickCounter(enemy, 'actionDelay')
    return { acted: false, reason: 'rooted' }
  }
  if (tickCounter(enemy, 'actionDelay')) return { acted: false, reason: 'action-delay' }

  const movement = moveTowardPlayer(enemy, context)
  if (movement.acted) enemy.hasActed = true
  if (movement.reason === 'totem-attack') return movement
  if (!movement.skipAttack) {
    const attack = attackIfInRange(enemy, context)
    if (attack.acted) {
      enemy.hasActed = true
      return { ...attack, moved: movement.acted }
    }
  }

  return movement
}
