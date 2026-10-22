import assert from 'node:assert/strict'
import { fixture, add, enemy, select, setBalls, settleAnimations, round } from './item-test-helpers.mjs'
import { GameRun } from '../src/game/run.js'
import { getStatus } from '../src/game/rules/statuses.js'
import { playerStatusEntries } from '../src/ui/status-presentation.js'

function setup() {
  const run = fixture(), weapon = add(run, 'bone-knife')
  // Keep both test movement positions in range so the strike adds no approach steps.
  weapon.range = 3
  add(run, 'r-step-boots')
  const target = enemy(run, { hp: 1000, attack: 2 })
  run._synchronizeBattle()
  return { run, weapon, target }
}
function gain(run, weapon, target, pos) {
  run._synchronizeBattle()
  setBalls(run, Math.max(run.weaponEnergyCost(weapon) + 1, run.player.maxEnergy), weapon.attribute)
  select(run, weapon)
  assert(run._attack(target))
  run.bus.emit('animate:attack-complete', { actor: 'player' })
  settleAnimations(run)
  run._walk([pos])
}
const layers = run => getStatus(run.player, 'step-dodge')?.layers || 0
const hit = (run, target) => run._enemyAttack(target, 1, { animate: false })

// Two real attack/move sequences stack; a plain extra move grants no extra layer.
{
  const { run, weapon, target } = setup()
  gain(run, weapon, target, { c: 3, r: 2 })
  gain(run, weapon, target, { c: 3, r: 3 })
  assert.equal(layers(run), 2)
  run._walk([{ c: 3, r: 2 }])
  assert.equal(layers(run), 2)
  const entry = playerStatusEntries(run).find(entry => entry.id === 'step-dodge')
  assert.equal(entry.badge, '2')
  assert(entry.description.includes('第一次受攻击不触发'))
  assert(!hit(run, target).evaded)
  assert.equal(run.player.hp, 18)
  assert.equal(layers(run), 2)
  assert(hit(run, target).evaded)
  assert.equal(layers(run), 1)
  assert(hit(run, target).evaded)
  assert.equal(layers(run), 0)
  assert(!hit(run, target).evaded)
  assert.equal(run.player.hp, 16)
}

// Even many layers cannot dodge a lone enemy's first attack each round.
{
  const { run, weapon, target } = setup()
  target.actionDelay = 0
  target.attackCooldownMax = 0
  for (let turn = 0; turn < 3; turn++) {
    gain(run, weapon, target, { c: 3, r: 2 })
    gain(run, weapon, target, { c: 3, r: 3 })
    round(run)
    assert.equal(run.player.hp, 20 - 2 * (turn + 1))
    assert.equal(layers(run), 0)
    assert.equal(run.itemRules.state.attacksReceivedThisTurn, 0)
  }
}

// Three enemies in an actual enemy phase hit once, then spend the two stacked layers.
{
  const { run, weapon, target } = setup()
  target.actionDelay = 0
  target.attackCooldownMax = 0
  enemy(run, { pos: { c: 3, r: 4 }, attack: 3, actionDelay: 0, attackCooldownMax: 0 })
  enemy(run, { pos: { c: 2, r: 3 }, attack: 4, actionDelay: 0, attackCooldownMax: 0 })
  gain(run, weapon, target, { c: 3, r: 2 })
  gain(run, weapon, target, { c: 3, r: 3 })
  const evaded = []
  run.on('animate:attack', event => { if (event.actor === 'enemy') evaded.push(event.evaded) })
  round(run)
  assert.deepEqual(evaded, [false, true, true])
  assert.equal(run.player.hp, 18)
  assert.equal(layers(run), 0)
}

// A hit before the first gain still counts; gaining again after consumption does not skip another hit.
{
  const { run, weapon, target } = setup()
  assert(!hit(run, target).evaded)
  gain(run, weapon, target, { c: 3, r: 2 })
  assert(hit(run, target).evaded)
  gain(run, weapon, target, { c: 3, r: 3 })
  assert(hit(run, target).evaded)
  assert.equal(run.player.hp, 18)
}

// Nonattack damage cannot unlock the second-attack dodge; armor absorbing a hit does count.
{
  const { run, weapon, target } = setup()
  gain(run, weapon, target, { c: 3, r: 2 })
  for (const source of ['trap:explosion', 'status:poison', 'status:burning', 'status:counter']) {
    run._damagePlayer(1, { source })
  }
  assert.equal(run.itemRules.state.attacksReceivedThisTurn, 0)
  run.player.armor = 2
  assert(!hit(run, target).evaded)
  assert.equal(run.player.armor, 0)
  assert.equal(run.player.hp, 16)
  assert(hit(run, target).evaded)
}

// The first hit may use counter; the second dodge blocks damage and attack effects.
{
  const { run, weapon, target } = setup()
  add(run, 'r-turn-shield')
  gain(run, weapon, target, { c: 3, r: 2 })
  const hp = target.hp, counter = getStatus(run.player, 'counter').damage
  assert(!hit(run, target).evaded)
  assert.equal(target.hp, hp - counter)
  assert.equal(getStatus(run.player, 'counter'), null)
  target.traits = ['burning', 'pull', 'split']
  const pos = { ...run.player.pos }
  assert(hit(run, target).evaded)
  assert.equal(run.player.hp, 18)
  assert.equal(getStatus(run.player, 'burning'), null)
  assert.deepEqual(run.player.pos, pos)
  assert.equal(target.splitTriggered, undefined)
}

// A movement ambush is the first attack; it is not evaded, but unlocks the next dodge.
{
  const { run, weapon, target } = setup()
  setBalls(run, 6, weapon.attribute)
  select(run, weapon)
  assert(run._attack(target))
  run.bus.emit('animate:attack-complete', { actor: 'player' })
  settleAnimations(run)
  const ambusher = enemy(run, { pos: { c: 1, r: 2 }, attack: 3, behavior: 'ambush', actionDelay: 0, attackCooldownMax: 3 })
  run.currentRoom.tile(ambusher.pos).revealed = false
  run._walk([{ c: 2, r: 3 }])
  assert.equal(run.player.hp, 17)
  assert.equal(run.itemRules.state.attacksReceivedThisTurn, 1)
  assert.equal(layers(run), 1)
  assert(hit(run, target).evaded)
}

// Ordinary dodge remains independent: it may evade the first hit and does not spend a boot layer.
{
  const { run, weapon, target } = setup()
  gain(run, weapon, target, { c: 3, r: 2 })
  run.applyStatus(run.player, 'dodge')
  assert(hit(run, target).evaded)
  assert.equal(layers(run), 1)
  assert.equal(getStatus(run.player, 'dodge'), null)
  assert(hit(run, target).evaded)
  assert.equal(layers(run), 0)
}

// Reloading the same round preserves both the received-attack count and pending layers.
{
  const { run, weapon, target } = setup()
  gain(run, weapon, target, { c: 3, r: 2 })
  assert(!hit(run, target).evaded)
  const payload = JSON.stringify(run.serialize()), previous = globalThis.localStorage
  globalThis.localStorage = { getItem: () => payload, setItem() {}, removeItem() {} }
  try {
    const loaded = new GameRun()
    assert(loaded._loaded)
    assert.equal(loaded.itemRules.state.attacksReceivedThisTurn, 1)
    assert.equal(layers(loaded), 1)
    assert(hit(loaded, loaded.currentRoom.entity(target.id)).evaded)
  } finally { globalThis.localStorage = previous }
}

// Ending a battle clears pending boot layers, even without an enemy phase.
{
  const { run, weapon, target } = setup()
  gain(run, weapon, target, { c: 3, r: 2 })
  run.currentRoom.removeEntity(target.id)
  run._synchronizeBattle()
  assert.equal(layers(run), 0)
  assert.equal(run.itemRules.state.attacksReceivedThisTurn, 0)
  enemy(run)
  run._synchronizeBattle()
  assert.equal(layers(run), 0)
}
console.log('step-boots-check passed: stacking, first-hit exclusion, turn/battle reset, nonattack damage, counter, ordinary dodge and reload')
