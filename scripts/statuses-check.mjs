import assert from 'node:assert/strict'
import { fixture, enemy, add, attack, round } from './item-test-helpers.mjs'
import { GameRun } from '../src/game/run.js'
import { applyStatus, consumeStatus, getStatus, registerStatusDamageResolver, statusCounterText, statusSnapshot, tickStatusSnapshot } from '../src/game/rules/statuses.js'
import { playerStatusEntries } from '../src/ui/status-presentation.js'

// Either independent counter ends a status. Unspecified values are finite and hidden.
{
  const holder = {}
  const status = applyStatus(holder, 'counter', { damage: 3 })
  assert.equal(status.layers, 100); assert.equal(status.turns, 100)
  assert.equal(statusCounterText(status), '')
  consumeStatus(holder, 'counter')
  assert.equal(status.layers, 99); assert.equal(status.turns, 100)
  tickStatusSnapshot(statusSnapshot(holder))
  assert.equal(status.layers, 99); assert.equal(status.turns, 99)
  applyStatus(holder, 'counter', { layers: 2, turns: 8 })
  consumeStatus(holder, 'counter'); consumeStatus(holder, 'counter')
  assert.equal(getStatus(holder, 'counter'), null)
  applyStatus(holder, 'counter', { layers: 8, turns: 2 })
  tickStatusSnapshot(statusSnapshot(holder)); tickStatusSnapshot(statusSnapshot(holder))
  assert.equal(getStatus(holder, 'counter'), null)
  applyStatus(holder, 'counter')
  for (let i = 0; i < 100; i++) tickStatusSnapshot(statusSnapshot(holder))
  assert.equal(getStatus(holder, 'counter'), null)
}

// A final turn remains usable. Multiple attacks use layers, not multiple duration ticks.
{
  const run = fixture(), attacker = enemy(run, { attack: 4, actionDelay: 0 })
  run.applyStatus(run.player, 'counter', { layers: 3, turns: 1, damage: 2 })
  round(run)
  assert.equal(attacker.hp, 98)
  assert.equal(getStatus(run.player, 'counter'), null)
}
{
  const run = fixture()
  const a = enemy(run, { attack: 2, actionDelay: 0 })
  const b = enemy(run, { attack: 2, actionDelay: 0, pos: { c: 3, r: 4 } })
  run.applyStatus(run.player, 'counter', { layers: 3, turns: 4, damage: 2 })
  round(run)
  assert.equal(a.hp, 98); assert.equal(b.hp, 98)
  assert.equal(getStatus(run.player, 'counter').layers, 1)
  assert.equal(getStatus(run.player, 'counter').turns, 3)
}

// Hidden and remote enemies freeze; player buffs age only in a combat round.
{
  const run = fixture()
  const target = enemy(run)
  run.currentRoom.tile(target.pos).revealed = false
  run.applyStatus(target, 'enemy-poison', { layers: 3, turns: 1 })
  const other = [...run.dungeon.rooms.values()].find(room => room.id !== run.currentRoom.id)
  const remote = [...other.entities.values()].find(entity => entity.kind === 'enemy')
  assert(remote)
  run.applyStatus(remote, 'dodge', { layers: 5, turns: 1 })
  run.itemRules.buff('test', { flat: 9, layers: 5, turns: 1 })
  run._endTurn()
  assert.equal(run.itemRules.state.buffs.test.turns, 1)
  enemy(run, { pos: { c: 2, r: 3 } })
  round(run)
  assert.equal(getStatus(target, 'enemy-poison').turns, 1)
  assert.equal(getStatus(remote, 'dodge').turns, 1)
  assert.equal(run.itemRules.state.buffs.test, undefined)
}

// Both poison types tick once per enemy phase, even during action delay.
{
  const run = fixture(), target = enemy(run, { attack: 2, actionDelay: 2 })
  assert.equal(run.applyStatus(run.player, 'enemy-poison'), null)
  assert.equal(run.applyStatus(target, 'player-poison'), null)
  run.player.armor = 10; run.player.hp = 40
  run._applyPoison()
  const playerPoison = getStatus(run.player, 'player-poison')
  assert.equal(playerPoison.layers, 100); assert.equal(playerPoison.turns, 3)
  assert.equal(playerPoison.showLayers, false)
  run.applyStatus(target, 'enemy-poison', { layers: 2, damage: 5 })
  round(run)
  assert.equal(run.player.hp, 38); assert.equal(run.player.armor, 10)
  assert.equal(playerPoison.layers, 99); assert.equal(playerPoison.turns, 2)
  assert.equal(target.hp, 95); assert.equal(getStatus(target, 'enemy-poison').layers, 1)
  assert.equal(getStatus(target, 'enemy-poison').turns, 2)
  round(run); assert.equal(target.hp, 90)
  round(run); assert.equal(target.hp, 90)
  round(run); assert.equal(target.hp, 90)
  assert.equal(getStatus(target, 'enemy-poison'), null)
  run.removeStatus(run.player, 'player-poison')
  run._applyPoison()
  for (let i = 0; i < 10; i++) round(run)
  assert.equal(getStatus(run.player, 'player-poison'), null)
}

// Dodge is consumed before mitigation, damage hooks, and on-hit statuses.
{
  const run = fixture(), target = enemy(run, { attack: 7, traits: ['burning', 'pull', 'split'], burningTurns: 2 })
  run.player.armor = 4
  run.applyStatus(run.player, 'parry', { multiplier: 0.7 })
  run.applyStatus(run.player, 'counter', { layers: 1, damage: 10 })
  run.applyStatus(run.player, 'dodge')
  let hitEvents = 0
  run.on('player:damaged', () => hitEvents++)
  const result = run._enemyAttack(target)
  assert.equal(result.evaded, true)
  assert.equal(run.player.hp, 20); assert.equal(run.player.armor, 4)
  assert.equal(target.hp, 100); assert.equal(hitEvents, 0)
  assert.equal(getStatus(run.player, 'dodge'), null)
  assert(getStatus(run.player, 'parry')); assert.equal(getStatus(run.player, 'counter').layers, 1)
  assert.equal(getStatus(run.player, 'burning'), null)
  assert.equal(target.splitTriggered, undefined)
  const incoming = []
  run.on('animate:attack', event => incoming.push(event))
  run.applyStatus(run.player, 'dodge')
  run._enemyAttack(target)
  assert.equal(incoming[0].evaded, true)
}
{
  const run = fixture(), target = enemy(run, { attack: 3 })
  run.applyStatus(run.player, 'dodge')
  run._damagePlayer(2, { source: 'trap:explosion' })
  assert(getStatus(run.player, 'dodge'))
  run._applyPoison(); run._tickPlayerStatuses()
  assert(getStatus(run.player, 'dodge'))
  run._enemyAttack(target)
  assert.equal(getStatus(run.player, 'dodge'), null)
}

// Gain-time damage is frozen; trigger-time damage follows each attack and can be patched.
{
  const run = fixture(), weapon = add(run, 'rust-sword'), target = enemy(run, { attack: 2 })
  attack(run, weapon, target)
  run.applyStatus(run.player, 'counter', { layers: 2, damage: { mode: 'last-player-attack', stage: 'gain', ratio: 2 } })
  assert.equal(getStatus(run.player, 'counter').damage, 6)
  run.player.lastAttackPower = 90
  const before = target.hp
  run._enemyAttack(target)
  assert.equal(target.hp, before - 6)
  run.updateStatus(run.player, 'counter', { damage: 9 })
  assert.equal(getStatus(run.player, 'counter').layers, 1)
  run._enemyAttack(target)
  assert.equal(target.hp, before - 15)
  assert.equal(getStatus(run.player, 'counter'), null)
}
{
  const run = fixture(), target = enemy(run, { attack: 8 })
  run.player.armor = 20
  run.applyStatus(run.player, 'counter', { layers: 3, damage: { mode: 'incoming-attack', ratio: 0.5 } })
  run._enemyAttack(target)
  assert.equal(target.hp, 96); assert.equal(run.player.hp, 20)
  target.attack = 4
  run._enemyAttack(target); assert.equal(target.hp, 94)
  run.updateStatus(run.player, 'counter', { damage: { mode: 'incoming-attack', ratio: 1 } })
  run._enemyAttack(target); assert.equal(target.hp, 90)
}

// A registered trigger can edit its own damage at the reaction stage without resetting its clock.
{
  const run = fixture(), target = enemy(run, { attack: 4, actionDelay: 0 })
  registerStatusDamageResolver('test-stage', context => {
    assert.equal(context.stage, 'trigger')
    assert.equal(context.holder.hp, 16) // Incoming health loss is already settled.
    context.run.updateStatus(context.holder, 'counter', { damage: 7 })
    return 7
  })
  run.applyStatus(run.player, 'counter', { layers: 2, turns: 3, damage: { mode: 'test-stage' } })
  round(run)
  assert.equal(target.hp, 93)
  assert.equal(getStatus(run.player, 'counter').layers, 1)
  assert.equal(getStatus(run.player, 'counter').turns, 2)
}

// Reactions are not attacks: they cannot reflect forever or consume another dodge.
{
  const run = fixture(), target = enemy(run, { attack: 4 })
  run.applyStatus(run.player, 'counter', { layers: 2, damage: 3 })
  run.applyStatus(target, 'counter', { layers: 2, damage: 99 })
  run.applyStatus(target, 'dodge')
  const order = []
  run.on('animate:attack', () => order.push('attack'))
  run.on('animate:impact', impact => { if (impact.target === 'enemy') order.push('counter') })
  run._enemyAttack(target)
  assert.equal(run.player.hp, 16); assert.equal(target.hp, 97)
  assert.equal(getStatus(target, 'counter').layers, 2)
  assert(getStatus(target, 'dodge'))
  assert.deepEqual(order, ['attack', 'counter'])
}
{
  const run = fixture(), target = enemy(run, { attack: 25 })
  run.applyStatus(run.player, 'counter', { layers: 1, damage: 99 })
  run._enemyAttack(target)
  assert.equal(run.gameOver, true); assert.equal(target.hp, 100)
  assert.equal(getStatus(run.player, 'counter').layers, 1)
}
{
  const run = fixture(), target = enemy(run, { hp: 3, attack: 1 })
  run.applyStatus(run.player, 'counter', { layers: 1, damage: 5 })
  run._enemyAttack(target)
  assert.equal(run.player.hp, 19)
  assert.equal(run.currentRoom.entity(target.id), null)
}

// Enemy reactions share the same counters, while their damage cannot trigger player reactions.
{
  const run = fixture(), weapon = add(run, 'rust-sword'), target = enemy(run)
  run.applyStatus(target, 'dodge')
  attack(run, weapon, target)
  assert.equal(target.hp, 100)
  assert.equal(getStatus(target, 'dodge'), null)
  run.applyStatus(run.player, 'dodge')
  run.applyStatus(run.player, 'counter', { layers: 1, damage: 90 })
  run.applyStatus(target, 'counter', { layers: 2, damage: { mode: 'incoming-attack', ratio: 2 } })
  attack(run, weapon, target)
  assert.equal(target.hp, 97); assert.equal(run.player.hp, 14)
  assert.equal(getStatus(target, 'counter').layers, 1)
  assert.equal(getStatus(run.player, 'counter').layers, 1)
  assert(getStatus(run.player, 'dodge'))
}

// A non-canonical save is deleted and starts a new game, with no migration.
{
  const run = fixture(), target = enemy(run)
  const data = run.serialize()
  delete data.player.statuses
  Object.assign(data.player, { poisonedTurns: 3, poisonDamage: 4, burningTurns: 2, burningDamage: 1, parry: { multiplier: 0.7 } })
  data.player.itemState = { buffs: { test: { flat: 2 } }, turnShieldReady: true }
  const saved = data.dungeon.rooms.find(room => room.id === run.currentRoom.id).entities.find(entity => entity.id === target.id)
  delete saved.statuses
  Object.assign(saved, { itemPoisonTurns: 2, itemPoisonDamage: 5, nextAttackReduction: 1 })
  const payload = JSON.stringify(data), previous = globalThis.localStorage
  let deleted = false
  globalThis.localStorage = { getItem: () => payload, setItem() {}, removeItem() { deleted = true } }
  try {
    const loaded = new GameRun()
    assert.equal(loaded._loaded, false)
    assert.equal(deleted, true)
    assert.equal(getStatus(loaded.player, 'player-poison'), null)
    assert.equal(loaded.globalTurn, 0)
    assert(loaded.backpack.items.some(item => item.id === 'money-pouch'))
  } finally { globalThis.localStorage = previous }
}

// Save specs as data, preserving both counters and display flags across reloads.
{
  const run = fixture(), target = enemy(run)
  run._applyPoison()
  run.applyStatus(run.player, 'counter', { layers: 3, turns: 5, damage: { mode: 'incoming-attack', ratio: 0.5 } })
  run.applyStatus(target, 'enemy-poison', { layers: 2 })
  run.itemRules.buff('test', { flat: 3, layers: 2, turns: 5 })
  const data = run.serialize()
  assert.equal(Object.hasOwn(data.player, 'poisonedTurns'), false)
  const payload = JSON.stringify(data), previous = globalThis.localStorage
  globalThis.localStorage = { getItem: () => payload, setItem() {}, removeItem() {} }
  try {
    const loaded = new GameRun()
    assert.equal(loaded._loaded, true)
    assert.deepEqual(getStatus(loaded.player, 'counter'), getStatus(run.player, 'counter'))
    assert.equal(getStatus(loaded.player, 'player-poison').showLayers, false)
    assert.equal(getStatus(loaded.currentRoom.entity(target.id), 'enemy-poison').layers, 2)
    assert.equal(loaded.itemRules.state.buffs.test.layers, 2)
    const entries = playerStatusEntries(loaded)
    assert.equal(entries.find(entry => entry.id === 'player-poison').badge, '3')
    assert(!entries.find(entry => entry.id === 'player-poison').description.includes('100'))
    assert(entries.find(entry => entry.id === 'counter').description.includes('\u5269\u4f593\u5c42'))
  } finally { globalThis.localStorage = previous }
}
// Roots and distance do not suppress poison, and ordinary attacks cannot double-tick it.
{
  const run = fixture(), target = enemy(run, { pos: { c: 0, r: 0 }, attack: 2, actionDelay: 0 })
  run.applyStatus(target, 'enemy-poison', { damage: 5 })
  run.applyStatus(target, 'rooted')
  round(run)
  assert.equal(target.hp, 95)
  assert.equal(target.itemPoisonTurns, 2)
  run._enemyAttack(target); run._enemyAttack(target)
  assert.equal(target.hp, 95)
  assert.equal(target.itemPoisonTurns, 2)
  round(run); round(run)
  assert.equal(target.hp, 85)
  assert.equal(getStatus(target, 'enemy-poison'), null)
}

// Poison spread during the enemy phase waits until the next phase, regardless of order.
for (const sourceFirst of [true, false]) {
  const run = fixture(); add(run, 'r-plague-bell')
  let source, target
  if (sourceFirst) source = enemy(run, { hp: 1 })
  target = enemy(run, { pos: { c: 5, r: 3 } })
  if (!sourceFirst) source = enemy(run, { hp: 1 })
  run.applyStatus(source, 'enemy-poison', { damage: 1 })
  round(run)
  assert.equal(run.currentRoom.entity(source.id), null)
  assert.equal(target.hp, 100)
  assert.equal(target.itemPoisonTurns, 3)
  round(run)
  assert.equal(target.hp, 99)
  assert.equal(target.itemPoisonTurns, 2)
}

// Death poison acquired during enemy-phase damage starts next phase at full duration.
{
  const run = fixture()
  const source = enemy(run, { hp: 1, deathStatus: 'poison', deathStatusTurns: 3, deathStatusDamage: 2 })
  enemy(run, { pos: { c: 0, r: 0 } })
  run.applyStatus(source, 'enemy-poison')
  const hp = run.player.hp
  round(run)
  assert.equal(run.player.hp, hp)
  assert.equal(run.player.poisonedTurns, 3)
  round(run)
  assert.equal(run.player.hp, hp - 2)
  assert.equal(run.player.poisonedTurns, 2)
}

// Downing during the poison phase cannot spend a revival turn in that same phase.
{
  const run = fixture(), target = enemy(run, { hp: 1, deathRule: 'revive' })
  run.applyStatus(target, 'enemy-poison')
  round(run)
  assert.equal(target.downed, true)
  assert.equal(target.reviveTurns, 2)
  round(run)
  assert.equal(target.downed, true)
  assert.equal(target.reviveTurns, 1)
  round(run)
  assert.equal(target.downed, false)
}

// Pets ending the battle skip both damage and duration consumption.
{
  const run = fixture(); enemy(run, { hp: 1 })
  add(run, 'venom-toad')
  run._applyPoison()
  const hp = run.player.hp
  round(run)
  assert.equal(run.battle.active, false)
  assert.equal(run.player.hp, hp)
  assert.equal(run.player.poisonedTurns, 3)
}

// A toad reapplying poison every pet phase must not defer its damage forever.
{
  const run = fixture(), target = enemy(run)
  const pet = add(run, 'venom-toad')
  round(run); round(run)
  assert.equal(target.hp, 100 - 2 * (pet.attack + 1))
  assert.equal(target.itemPoisonTurns, 2)
}

console.log('statuses-check passed: counters, poison phase timing, roots, spread order, revival, pets, reactions, UI and saves')
