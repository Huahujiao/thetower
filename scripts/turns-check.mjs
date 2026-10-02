import assert from 'node:assert/strict'
import { fixture, add, select, enemy } from './item-test-helpers.mjs'
import { GameRun, ENERGY_MAX } from '../src/game/run.js'
import { TURN_KINDS, TurnLedger } from '../src/game/core/turns.js'
import { createLootEntity, makeItemById } from '../src/game/data/content.js'
import { getStatus } from '../src/game/rules/statuses.js'

const idle = run => {
  if (run.combatResolving) run.bus.emit('animate:attack-complete', { actor: 'player' })
  while (run.enemyDeathAnimationsPending) run.bus.emit('animate:impact-complete', { target: 'enemy', defeated: true })
  run.bus.emit('animate:idle')
}
function hiddenEnemy(run, options = {}) {
  const target = enemy(run, { noExperience: true, actionDelay: 0, attack: 2, range: 4, ...options })
  run.currentRoom.tile(target.pos).revealed = false
  return target
}
function activate(run, options = {}) {
  const target = hiddenEnemy(run, options)
  assert(run.clickTile(target.pos.c, target.pos.r))
  return target
}
function restore(data) {
  const previous = globalThis.localStorage
  let payload = JSON.stringify(data)
  globalThis.localStorage = { getItem: () => payload, setItem: (_key, value) => { payload = value }, removeItem: () => assert.fail('save must survive') }
  try { return new GameRun({ autoLoad: true }) } finally { globalThis.localStorage = previous }
}

assert.equal(ENERGY_MAX, 6)
const ledger = new TurnLedger()
ledger.advance(TURN_KINDS.ATTACK); ledger.advance(TURN_KINDS.ATTACK); ledger.advance(TURN_KINDS.MOVEMENT)
assert.deepEqual(ledger.snapshot(), { attackCount: 2, globalTurn: 0 })
ledger.advance(TURN_KINDS.ROUND)
assert.deepEqual(ledger.snapshot(), { attackCount: 2, globalTurn: 1 })
assert.throws(() => ledger.advance('invalid'))

// Exploration actions leave the energy and round clocks untouched.
{
  const run = fixture(), potion = add(run, 'health-potion')
  run.player.energy = 2
  assert(run._moveTo({ c: 2, r: 3 }))
  assert(run.moveInventoryToStash(potion.uid))
  assert(run.discardInventoryItem(potion.uid))
  run.currentRoom.tile({ c: 2, r: 2 }).revealed = false
  assert(run.clickTile(2, 2))
  const loot = createLootEntity(makeItemById('food-3'), { c: 1, r: 3 })
  run.currentRoom.addEntity(loot)
  assert(run._pickUp(loot))
  assert.equal(run.player.energy, 2); assert.equal(run.globalTurn, 0)
  assert.equal(run.battle.active, false)
  assert.equal(run.endPlayerTurn(), false)
}

// First reveal fills energy; further reveals and attacks do not trigger enemies.
{
  const run = fixture(), sword = add(run, 'rust-sword')
  const target = hiddenEnemy(run), extra = hiddenEnemy(run, { pos: { c: 3, r: 4 } })
  run.player.energy = 2
  assert(run.clickTile(4, 3)); assert.equal(run.player.energy, 6)
  assert.equal(run.player.hp, 20); assert.equal(run.battle.stage, 'player')
  assert(run.clickTile(3, 4)); assert.equal(run.player.energy, 5)
  assert.equal(run.player.hp, 20); assert.equal(extra.hasActed, false)
  select(run, sword); assert(run._attack(target))
  assert.equal(run.combatResolving, true)
  idle(run)
  assert.equal(run.player.energy, 2); assert.equal(run.globalTurn, 0)
  assert.equal(run.player.hp, 20); assert.equal(run.attackCount, 1)
  assert(run.endPlayerTurn())
  assert.equal(run.globalTurn, 1); assert.equal(run.roundResolving, true)
  assert.equal(run._canAct(), false); assert.equal(run.endPlayerTurn(), false)
  idle(run)
  assert.equal(run.player.energy, 6); assert.equal(run.battle.round, 2)
  assert.equal(run.battle.stage, 'player')
  assert(run.player.hp < 20)
}

// Exhaustion ends the round exactly once and interrupts a longer movement route.
{
  const run = fixture(); activate(run)
  const path = Array.from({ length: 8 }, (_, index) => ({ c: index % 2 ? 3 : 2, r: 3 }))
  assert.equal(run._walk(path).stopped, true)
  assert.equal(run.globalTurn, 1); assert.equal(run.player.energy, 0)
  assert.equal(run.player.hp, 18)
  assert.deepEqual(run.player.pos, { c: 3, r: 3 })
  idle(run); assert.equal(run.player.energy, 6)
}

// Ambush happens on reveal, ignoring ordinary reveal delay, only once.
{
  const run = fixture(), target = hiddenEnemy(run, { behavior: 'ambush', range: 1, actionDelay: 9 })
  assert(run.clickTile(4, 3))
  assert.equal(run.player.hp, 18); assert.equal(run.player.energy, 6)
  assert.equal(target.ambushTriggered, true); assert.equal(run.globalTurn, 0)
  run._activateRevealedEnemy(run.currentRoom, target)
  assert.equal(run.player.hp, 18)
  assert(run.endPlayerTurn()); idle(run)
  assert.equal(run.player.hp, 16)
}

// Pets act once after the player, before enemies.
{
  const run = fixture(), pet = add(run, 'mountain-hound', 0, 0), food = add(run, 'food-9', 2, 0)
  const target = activate(run), stages = []
  run.on('pets:started', () => stages.push('pets'))
  run.on('enemies:started', () => stages.push('enemies'))
  const potion = add(run, 'health-potion')
  assert(run.moveInventoryToStash(potion.uid))
  assert.equal(target.hp, 100); assert.equal(food.energy, 9)
  assert(run.endPlayerTurn()); idle(run)
  assert.deepEqual(stages, ['pets', 'enemies'])
  assert.equal(target.hp, 100 - pet.attack)
  assert.equal(food.energy, 9 - pet.foodCost)
}

// Refunds can keep a player turn alive; hidden enemies do not prevent exploration.
{
  const run = fixture(), sword = add(run, 'triad-tide')
  run.player.pos = { c: 2, r: 3 }
  const target = hiddenEnemy(run, { hp: 1, pos: { c: 5, r: 3 } })
  run._revealEnemy(run.currentRoom, target)
  hiddenEnemy(run, { pos: { c: 0, r: 0 } })
  const second = hiddenEnemy(run, { pos: { c: 2, r: 4 } })
  assert(run.clickTile(2, 4))
  run.player.energy = sword.energyCost
  select(run, sword); assert(run._attack(target)); idle(run)
  assert.equal(run.player.energy, 1); assert.equal(run.globalTurn, 0)
  assert.equal(run.battle.active, true)
  run._damageEnemy(second, 500, { source: 'item:test' })
  run._endTurn(); idle(run)
  assert.equal(run.battle.active, false)
  assert.equal(run.currentRoom.entityAt({ c: 0, r: 0 }).kind, 'enemy')
  const remaining = run.player.energy
  assert(run._moveTo({ c: 3, r: 3 })); assert.equal(run.player.energy, remaining)
}

// Control and status durations use rounds, not individual actions.
{
  const run = fixture(), target = activate(run)
  run.applyStatus(target, 'rooted', { turns: 1 })
  assert(run._moveTo({ c: 2, r: 3 }))
  assert.equal(getStatus(target, 'rooted').turns, 1)
  assert(run.endPlayerTurn()); idle(run)
  assert.equal(run.player.hp, 20); assert.equal(getStatus(target, 'rooted'), null)
  assert(run.endPlayerTurn()); idle(run)
  assert.equal(run.player.hp, 18)
}

// Save/load preserves a partial player turn and never repeats a resolved enemy stage.
{
  const run = fixture(); activate(run)
  run._moveTo({ c: 2, r: 3 })
  let loaded = restore(run.serialize())
  assert.equal(loaded.player.energy, 5); assert.equal(loaded.battle.round, 1)
  assert.equal(loaded.globalTurn, 0)
  run.endPlayerTurn()
  loaded = restore(run.serialize())
  assert.equal(loaded.player.hp, run.player.hp)
  assert.equal(loaded.globalTurn, 1); assert.equal(loaded.player.energy, 6)
  assert.equal(loaded.battle.round, 2)
}

// Legacy saves retain earned cap upgrades while changing the base from ten to six.
{
  const run = fixture(), data = run.serialize()
  delete data.bigRoundRevision; delete data.battle
  data.player.baseMaxEnergy = 12; data.player.maxEnergy = 12; data.player.energy = 4
  const loaded = restore(data)
  assert.equal(loaded.player.baseMaxEnergy, 8); assert.equal(loaded.player.maxEnergy, 8)
  assert.equal(loaded.battle.active, false)
}

// Failed routes are atomic; food refunds happen before exhaustion is checked.
{
  const run = fixture(); activate(run, { actionDelay: 2 })
  const target = hiddenEnemy(run, { pos: { c: 0, r: 0 } })
  const position = { ...run.player.pos }
  run.player.energy = 1
  assert.equal(run._flipAt(target.pos), false)
  assert.deepEqual(run.player.pos, position); assert.equal(run.player.energy, 1)
  assert.equal(run.currentRoom.isRevealed(target.pos), false)
  const food = add(run, 'food-3'); select(run, food)
  assert(run.useSelected()); assert.equal(run.player.energy, 3); assert.equal(run.globalTurn, 0)
  const potion = add(run, 'health-potion'); select(run, potion); run.player.energy = 1
  assert(run.useSelected()); assert.equal(run.globalTurn, 1); assert.equal(run.roundResolving, true)
  idle(run); assert.equal(run.player.energy, 6)
}

// Exhaustion plus a level-up and full-bag loot pauses the round until choices finish.
{
  const run = fixture(), sword = add(run, 'rust-sword')
  add(run, 'r-loot-pouch')
  while (run.backpack.add(makeItemById('health-potion'))) { /* Fill the backpack. */ }
  const target = hiddenEnemy(run, { hp: 1, noExperience: false, experience: run.player.experienceToNext })
  run._revealEnemy(run.currentRoom, target)
  const remaining = hiddenEnemy(run, { pos: { c: 3, r: 4 } })
  run._revealEnemy(run.currentRoom, remaining)
  run.player.energy = sword.energyCost; select(run, sword)
  assert(run._attack(target)); idle(run)
  assert.equal(run.phase, 'level-up'); assert.equal(run.pendingRoundEnd, true)
  assert.equal(run.globalTurn, 0); assert.equal(run.player.hp, 20)
  assert.equal(run.inventoryStash.length, 1)
  const loaded = restore(run.serialize())
  assert.equal(loaded.pendingRoundEnd, true); assert.equal(loaded.globalTurn, 0)
  assert(loaded.discardInventoryItem(loaded.inventoryStash[0].uid))
  assert.equal(loaded.player.energy, 0); assert.equal(loaded.globalTurn, 0)
  loaded.levelUp.choices = ['heal', 'max-health', 'max-energy']
  assert(loaded.chooseLevelUpOption('heal'))
  assert.equal(loaded.globalTurn, 1); assert.equal(loaded.roundResolving, true)
  assert(loaded.player.hp < 20); idle(loaded)
  assert.equal(loaded.player.energy, 6); assert.equal(loaded.battle.round, 2)
}

// Revealed reviving enemies keep combat alive; a pet's final kill returns to exploration.
{
  const run = fixture(), corpse = hiddenEnemy(run, { hp: 0, maxHp: 10, downed: true, reviveTurns: 1, attack: 0 })
  run._revealEnemy(run.currentRoom, corpse)
  assert.equal(run.battle.active, true)
  assert(run.endPlayerTurn()); idle(run)
  assert.equal(corpse.downed, false); assert(corpse.hp > 0); assert.equal(run.battle.active, true)
}
{
  const run = fixture(); add(run, 'mountain-hound', 0, 0); add(run, 'food-3', 2, 0)
  const target = activate(run, { hp: 4, attack: 10 })
  const hidden = hiddenEnemy(run, { pos: { c: 0, r: 0 } })
  assert(run.endPlayerTurn()); idle(run)
  assert.equal(run.currentRoom.entity(target.id), null); assert.equal(run.player.hp, 20)
  assert.equal(run.battle.active, false); assert.equal(run.battle.stage, 'explore')
  assert(run.currentRoom.entity(hidden.id)); assert.equal(run.globalTurn, 1)
}

// Ordinary delays/cooldowns tick once per enemy stage, never per player action.
{
  const run = fixture(), target = activate(run, { actionDelay: 1, attackCooldownMax: 2 })
  assert(run._moveTo({ c: 2, r: 3 })); assert(run._moveTo({ c: 3, r: 3 }))
  assert.equal(target.actionDelay, 1)
  run.endPlayerTurn(); idle(run); assert.equal(target.actionDelay, 0); assert.equal(run.player.hp, 20)
  run.endPlayerTurn(); idle(run); assert.equal(run.player.hp, 18); assert.equal(target.attackCooldown, 1)
  run.endPlayerTurn(); idle(run); assert.equal(run.player.hp, 18); assert.equal(target.attackCooldown, 0)
  run.endPlayerTurn(); idle(run); assert.equal(run.player.hp, 16)
}
console.log('turns-check passed: exploration, activation, costs, phases, ambush, refunds, control and saves')
