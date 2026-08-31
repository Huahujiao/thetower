import { combatDistance } from '../core/geometry.js'
import { findPath } from './pathfinding.js'

function tickCounter(enemy, key) {
  if ((enemy[key] || 0) <= 0) return false
  enemy[key] -= 1
  return true
}

function cooldownWaitTurns(interval) {
  return Math.max(0, Math.floor(Number(interval) || 0) - 1)
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
  const route = findPath(context.room, enemy.pos, context.player.pos)
  const next = route?.[0]
  if (next?.c === context.player.pos.c && next?.r === context.player.pos.r) return { acted: false, reason: 'blocked' }
  if (!next || !context.move?.(enemy, next)) return { acted: false, reason: 'blocked' }
  return { acted: true, reason: 'move' }
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
  if (tickCounter(enemy, 'actionDelay')) return { acted: false, reason: 'action-delay' }

  const behavior = ENEMY_BEHAVIORS[enemy.behavior] || stationaryBehavior
  const movement = behavior(enemy, context)
  if (movement.acted) enemy.hasActed = true
  const attackCooling = tickCounter(enemy, 'attackCooldown')
  const activeSkillCooling = tickCounter(enemy, 'activeSkillCooldown')
  if (!activeSkillCooling && enemy.activeSkill) {
    const outcome = context.activeSkill?.(enemy, enemy.activeSkill)
    if (outcome?.acted) {
      enemy.activeSkillCooldown = cooldownWaitTurns(enemy.activeSkill.cooldown)
      enemy.hasActed = true
      return { ...outcome, moved: movement.acted }
    }
  }

  if (!attackCooling) {
    const attack = attackIfInRange(enemy, context)
    if (attack.acted) {
      enemy.attackCooldown = cooldownWaitTurns(enemy.attackCooldownMax)
      enemy.hasActed = true
      return { ...attack, moved: movement.acted }
    }
  }

  return movement
}
