import assert from 'node:assert/strict'
import { fixture, add, select, enemy } from './item-test-helpers.mjs'
import { GameRun, SAVE_KEY } from '../src/game/run.js'
import { createEnemyById } from '../src/game/data/content.js'
import { combatMotionAt, combatMotionTime, deathMotion, explosionMotion, hitMotion, idleMotion } from '../src/render/character-motion.js'

assert.deepEqual(combatMotionAt(0, 0.5, true), { attack: 0, hit: 0, death: 0, done: false })
assert.equal(combatMotionAt(0.15, 0.5, true).death, 0)
assert.equal(combatMotionAt(0.3, 0.5, true).hit, 1)
assert.equal(combatMotionAt(0.3, 0.5, true).death, 0)
assert.equal(combatMotionAt(0.4, 0.5, true).attack, 0.8)
assert.equal(combatMotionAt(0.5, 0.5, false).done, true)
assert.equal(combatMotionAt(0.5, 0.5, true).done, false)
assert.equal(combatMotionAt(combatMotionTime(0.5, true), 0.5, true).done, true)
assert.equal(deathMotion(1).opacity, 0)
assert.equal(explosionMotion(1).opacity, 0)
assert.equal(hitMotion(0).scale, 1)
assert.ok(idleMotion(0).scale > 0)

const killRun = fixture()
const weapon = add(killRun, 'rust-sword')
select(killRun, weapon)
killRun.player.energy = 10
const target = enemy(killRun, { hp: 1, noExperience: false, experience: killRun.player.experienceToNext })
const killEvents = []
killRun.on('animate:attack', (event) => killEvents.push(event))
assert.equal(killRun._attack(target), true)
assert.equal(killEvents.length, 1)
assert.equal(killEvents[0].actor, 'player')
assert.deepEqual(killEvents[0].targetPosition, target.pos)
assert.equal(killEvents[0].targetDefeated, true)
assert.equal(killRun.phase, 'level-up')
assert.equal(killRun.combatResolving, true)
assert.equal(killRun.globalTurn, 0)
const savedKill = JSON.stringify(killRun.serialize())
const previousStorage = globalThis.localStorage
globalThis.localStorage = { getItem: (key) => key === SAVE_KEY ? savedKill : null, setItem() {}, removeItem() {} }
try {
  const restored = new GameRun()
  assert.equal(restored.combatResolving, false)
  assert.equal(restored.globalTurn, 1)
  assert.equal(restored.phase, 'level-up')
} finally {
  globalThis.localStorage = previousStorage
}
killRun.bus.emit('animate:attack-complete', { actor: 'player' })
assert.equal(killRun.combatResolving, false)
assert.equal(killRun.globalTurn, 1)
assert.equal(killRun.phase, 'level-up')

const hitRun = fixture()
const hitWeapon = add(hitRun, 'rust-sword')
select(hitRun, hitWeapon)
hitRun.player.energy = 10
const survivor = enemy(hitRun, { hp: 100 })
let hitEvent
hitRun.on('animate:attack', (event) => { hitEvent = event })
assert.equal(hitRun._attack(survivor), true)
assert.equal(hitEvent.targetDefeated, false)
assert.deepEqual(hitEvent.targetPosition, survivor.pos)

const deathRun = fixture()
const attacker = enemy(deathRun, { attack: 10 })
deathRun.player.hp = 1
let deathEvent
deathRun.on('animate:attack', (event) => { deathEvent = event })
deathRun._enemyAttack(attacker)
assert.equal(deathEvent.actor, 'enemy')
assert.equal(deathEvent.targetDefeated, true)
assert.equal(deathRun.deathAnimationPending, true)
deathRun.bus.emit('animate:attack-complete', { actor: 'enemy' })
assert.equal(deathRun.deathAnimationPending, false)

const hazardRun = fixture()
const hazardEnemy = enemy(hazardRun, { hp: 1, noExperience: false, experience: hazardRun.player.experienceToNext })
const impacts = []
hazardRun.on('animate:impact', (event) => impacts.push(event))
hazardRun._damageEnemy(hazardEnemy, 1, { source: 'trap:explosion' })
assert.equal(impacts[0].target, 'enemy')
assert.equal(impacts[0].defeated, true)
assert.equal(hazardRun.enemyDeathAnimationsPending, 1)
hazardRun.bus.emit('animate:impact-complete', { target: 'enemy', defeated: false })
assert.equal(hazardRun.enemyDeathAnimationsPending, 1)
hazardRun.bus.emit('animate:impact-complete', { target: 'enemy', defeated: true })
assert.equal(hazardRun.enemyDeathAnimationsPending, 0)

const fallRun = fixture()
fallRun.player.hp = 1
let fallImpact
fallRun.on('animate:impact', (event) => { fallImpact = event })
fallRun._damagePlayer(2, { source: 'trap:explosion', ignoreArmor: true })
assert.equal(fallImpact.target, 'player')
assert.equal(fallImpact.defeated, true)
assert.equal(fallRun.deathAnimationPending, true)
fallRun.bus.emit('animate:impact-complete', { target: 'player', defeated: true })
assert.equal(fallRun.deathAnimationPending, false)

const explosionRun = fixture()
const explosionWeapon = add(explosionRun, 'rust-sword')
select(explosionRun, explosionWeapon)
explosionRun.player.energy = 10
explosionRun.player.hp = 1
const explosive = enemy(explosionRun, { hp: 1, deathExplosionDamage: 3, explosionRadius: 1 })
const explosionOrder = []
explosionRun.on('animate:attack', () => explosionOrder.push('attack'))
explosionRun.on('animate:impact', () => explosionOrder.push('impact'))
let deathExplosion
explosionRun.on('animate:explode', (event) => { explosionOrder.push('explode'); deathExplosion = event })
assert.equal(explosionRun._attack(explosive), true)
assert.deepEqual(explosionOrder, ['attack', 'explode'])
assert.equal(deathExplosion.targetDefeated, true)
assert.equal(explosionRun.enemyDeathAnimationsPending, 1)
assert.equal(explosionRun.deathAnimationPending, true)
explosionRun.bus.emit('animate:attack-complete', { actor: 'player' })
assert.equal(explosionRun.enemyDeathAnimationsPending, 1)
explosionRun.bus.emit('animate:explode-complete', { targetDefeated: true })
assert.equal(explosionRun.enemyDeathAnimationsPending, 0)
assert.equal(explosionRun.deathAnimationPending, false)

assert.equal(createEnemyById('bomb-wisp', { c: 1, r: 1 }).selfDestructOnAttack, true)
const activeRun = fixture()
activeRun.player.hp = 30
const selfDestructing = enemy(activeRun, { attack: 12, deathExplosionDamage: 6, explosionRadius: 2, selfDestructOnAttack: true })
const activeEvents = []
activeRun.on('animate:attack', () => activeEvents.push('attack'))
activeRun.on('animate:explode', () => activeEvents.push('explode'))
activeRun._enemyAttack(selfDestructing)
assert.deepEqual(activeEvents, ['explode'])
assert.equal(activeRun.currentRoom.entity(selfDestructing.id), null)
assert.ok(activeRun.player.hp < 30)
assert.equal(activeRun.enemyDeathAnimationsPending, 1)

const distantRun = fixture()
const distantExplosive = enemy(distantRun, { hp: 1, pos: { c: 1, r: 1 }, deathExplosionDamage: 3, explosionRadius: 1 })
let distantExplosion
distantRun.on('animate:explode', (event) => { distantExplosion = event })
distantRun._damageEnemy(distantExplosive, 1, { source: 'trap:explosion' })
assert.equal(distantExplosion.targetPosition, null)
assert.equal(distantExplosion.targetDefeated, false)

console.log('combat-motion-check passed')
