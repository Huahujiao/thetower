import assert from 'node:assert/strict'
import { fixture, add, enemy, attack, select, round } from './item-test-helpers.mjs'
import { GameRun, SAVE_KEY, SAVE_VERSION } from '../src/game/run.js'
import { ALL_ITEM_DEFS, getItemDefinition } from '../src/game/data/content.js'
import { buildRelicChoices } from '../src/game/data/relics.js'
import { buildMerchantStock } from '../src/game/data/merchants.js'
import { suggestedSynergyId } from '../src/game/rules/synergies.js'
import { getStatus, statusCounterText } from '../src/game/rules/statuses.js'

// Poison deals damage for three enemy phases without requiring attacks.
{
  const run = fixture(), target = enemy(run)
  const status = run.applyStatus(target, 'enemy-poison', { damage: 5 })
  assert.equal(status.layers, 100); assert.equal(status.turns, 3)
  assert.equal(statusCounterText(status), '剩余3回合')
  for (let turn = 0; turn < 2; turn++) round(run)
  assert.equal(status.turns, 1); assert.equal(status.layers, 98)
  round(run)
  assert.equal(getStatus(target, 'enemy-poison'), null)
  assert.equal(target.hp, 85)
  assert(!getItemDefinition('poison').description.includes('100'))
}

// Erosion detonates three times even with one layer, bypasses armor and clears
// poison rather than allowing an adjacent sac to reapply it on the same hit.
{
  const run = fixture(), blade = add(run, 'bone-knife', 0, 0)
  add(run, 'venom-sac', 1, 0)
  blade.attack = 1 // Force a zero-damage hit independently of attribute penalties.
  const target = enemy(run, { attribute: 'scorch', traits: ['heavy-armor'] })
  attack(run, blade, target)
  assert.equal(target.hp, 100)
  assert.equal(getStatus(target, 'enemy-poison').turns, 3)
  const fresh = enemy(run, { pos: { c: 2, r: 3 } })
  run.applyStatus(fresh, 'dodge')
  attack(run, blade, fresh)
  assert.equal(getStatus(fresh, 'enemy-poison'), null)
}
{
  const run = fixture(), blade = add(run, 'erosion-knife', 0, 0)
  add(run, 'venom-sac', 1, 0)
  const target = enemy(run, { traits: ['heavy-armor'] })
  run.applyStatus(target, 'enemy-poison', { layers: 1, damage: 5 })
  attack(run, blade, target)
  assert.equal(target.hp, 81)
  assert.equal(getStatus(target, 'enemy-poison'), null)
  assert.equal(run.player.energy, 4)
  run.applyStatus(target, 'enemy-poison', { layers: 1, damage: 5 })
  run.applyStatus(target, 'dodge')
  const hp = target.hp
  attack(run, blade, target)
  assert.equal(target.hp, hp); assert.equal(getStatus(target, 'enemy-poison').layers, 1)
}
{
  const run = fixture(), blade = add(run, 'erosion-knife'), target = enemy(run, { hp: 10 })
  run.applyStatus(target, 'enemy-poison', { layers: 1, damage: 5 })
  const events = []
  run.on('animate:attack', event => events.push(['attack', event]))
  run.on('animate:impact', event => events.push(['impact', event]))
  attack(run, blade, target)
  assert.equal(run.currentRoom.entity(target.id), null)
  assert.equal(events[0][0], 'attack')
  assert.equal(events[0][1].targetDefeated, false)
  assert.equal(events.filter(([type, event]) => type === 'impact' && event.defeated).length, 1)
}

// Gold belongs only to this weapon's own kills, with no room cap.
{
  const run = fixture(), hook = add(run, 'gold-hook'), blade = add(run, 'bone-knife')
  for (let index = 0; index < 5; index++) attack(run, hook, enemy(run, { hp: 1 }))
  assert.equal(run.player.gold, 5)
  attack(run, blade, enemy(run, { hp: 1 }))
  run._damageEnemy(enemy(run, { hp: 1 }), 5, { source: 'item:poison' })
  assert.equal(run.player.gold, 5)
  assert.equal(getItemDefinition('r-gold-hook'), null)
}

// The first attack->movement turn grants dodge and counter before enemies act.
// A dodge does not consume counter; the second hit uses the rounded snapshot.
{
  const run = fixture(), hook = add(run, 'gold-hook')
  add(run, 'r-step-boots'); add(run, 'r-turn-shield'); add(run, 'r-traveler')
  attack(run, hook, enemy(run))
  const first = enemy(run, { pos: { c: 2, r: 2 }, attack: 2, actionDelay: 0 })
  const second = enemy(run, { pos: { c: 1, r: 3 }, attack: 2, actionDelay: 0 })
  run.player.energy = 5
  run._walk([{ c: 2, r: 3 }])
  assert.equal(run.player.energy, 5); assert.equal(run.player.hp, 20)
  assert(getStatus(run.player, 'dodge')); assert(getStatus(run.player, 'counter'))
  round(run)
  assert.equal(run.player.hp, 18)
  assert.equal(first.hp, 100); assert.equal(second.hp, 98)
  assert.equal(getStatus(run.player, 'dodge'), null); assert.equal(getStatus(run.player, 'counter'), null)
  run.currentRoom.removeEntity(first.id); run.currentRoom.removeEntity(second.id)
  run._walk([{ c: 3, r: 3 }])
  assert.equal(run.player.energy, 5)
  assert.equal(getStatus(run.player, 'dodge'), null)
}
for (const interrupted of [false, true]) {
  const run = fixture(), hook = add(run, 'gold-hook')
  add(run, 'r-step-boots'); add(run, 'r-turn-shield')
  attack(run, hook, enemy(run))
  if (interrupted) run._endTurn({ skipEnemyPhase: true, action: 'organize' })
  run.itemRules.move()
  assert.equal(!!getStatus(run.player, 'dodge'), !interrupted)
  run._endTurn({ skipEnemyPhase: true, action: 'movement' })
  round(run)
  assert.equal(getStatus(run.player, 'dodge'), null); assert.equal(getStatus(run.player, 'counter'), null)
}
{
  const run = fixture(), hook = add(run, 'gold-hook')
  add(run, 'r-step-boots')
  attack(run, hook, enemy(run))
  const ambusher = enemy(run, { pos: { c: 1, r: 2 }, attack: 3, behavior: 'ambush', actionDelay: 0, attackCooldownMax: 3 })
  run.currentRoom.tile(ambusher.pos).revealed = false
  run._walk([{ c: 2, r: 3 }])
  assert.equal(run.player.hp, 20)
  assert.equal(getStatus(run.player, 'dodge'), null)
}
{
  const run = fixture(), hook = add(run, 'gold-hook')
  add(run, 'r-step-boots'); add(run, 'r-traveler')
  attack(run, hook, enemy(run))
  const target = enemy(run, { pos: { c: 1, r: 3 } })
  select(run, hook); run.player.energy = 3
  assert(run._attack(target)) // One final step is paired with the strike.
  assert.equal(run.player.energy, 0)
  assert(getStatus(run.player, 'dodge'))
}

// Single-weapon count ignores staging, and its power is saved before damage multipliers.
{
  const run = fixture(), hook = add(run, 'gold-hook')
  add(run, 'r-scales'); add(run, 'r-turn-shield')
  const target = enemy(run)
  attack(run, hook, target)
  assert.equal(run.player.lastAttackPower, 6)
  run.itemRules.move()
  assert.equal(getStatus(run.player, 'counter').damage, 3)
  assert.equal(run.weaponRange(hook), 2)
  const other = add(run, 'bone-knife')
  assert.equal(run.itemRules.attackContext(hook, target).attackMultiplier, 1)
  run.backpack.removeByUid(other.uid); run.inventoryStash.push(other)
  assert.equal(run.itemRules.attackContext(hook, target).attackMultiplier, 2)
}

// Relay tracks instances and live adjacency at both ends, even when IDs match.
{
  const run = fixture(), first = add(run, 'gold-hook', 0, 0), badge = add(run, 'r-relay-badge', 1, 0)
  const other = add(run, 'gold-hook', 2, 0), far = add(run, 'bone-knife', 5, 0)
  const target = enemy(run, { hp: 200 })
  attack(run, far, target)
  assert.equal(run.itemRules.attackContext(other, target).multiplier, 1)
  attack(run, first, target)
  assert.equal(run.itemRules.attackContext(first, target).multiplier, 1)
  assert.equal(run.itemRules.attackContext(other, target).multiplier, 1.7)
  attack(run, far, target) // Unrelated attacks neither get nor consume the bonus.
  assert.equal(run.itemRules.attackContext(other, target).multiplier, 1.7)
  run.backpack.move(badge.uid, 7, 0)
  assert.equal(run.itemRules.attackContext(other, target).multiplier, 1)
  run.backpack.move(badge.uid, 1, 0)
  const hp = target.hp
  attack(run, other, target)
  assert.equal(target.hp, hp - 5)
  assert.equal(run.itemRules.attackContext(first, target).multiplier, 1.7)
}

// Exclude suspended items from merchants, all relic choices and recommendations.
{
  const suspended = new Set(['toxin-vial', 'r-poison-hourglass', 'r-gold-hook'])
  assert(buildRelicChoices(null, { count: 99, preferredId: 'r-poison-hourglass' }).every(item => !suspended.has(item.id)))
  const source = [getItemDefinition('venom-sac')]
  assert.equal(suggestedSynergyId(source, 'item', () => 0, id => id === 'toxin-vial'), null)
  assert.equal(suggestedSynergyId(source, 'relic', () => 0, id => id === 'r-poison-hourglass'), null)
  for (let value = 0; value < ALL_ITEM_DEFS.length; value++) {
    assert(buildMerchantStock('merchant', 12, () => value / ALL_ITEM_DEFS.length).every(stock => !suspended.has(stock.itemId)))
  }
}

// Reject incompatible/corrupt data, remove exactly the game save, and restart.
for (const mutate of [data => { data.version = SAVE_VERSION - 1 }, data => { delete data.player.statuses },
  data => { data.backpack.placements[0].item.id = 'r-gold-hook' },
  data => { data.initialRelicChoices = ['r-poison-hourglass'] },
  data => { data.backpack.placements.push(data.backpack.placements[0]) },
  data => { data.player.statuses.counter = { id: 'counter', layers: 1 } },
]) {
  const data = new GameRun({ autoLoad: false }).serialize()
  mutate(data)
  const previous = globalThis.localStorage, removed = []
  globalThis.localStorage = { getItem: () => JSON.stringify(data), setItem() {}, removeItem(key) { removed.push(key) } }
  try {
    const run = new GameRun()
    assert.equal(run._loaded, false); assert.deepEqual(removed, [SAVE_KEY])
    assert.equal(run.globalTurn, 0); assert.equal(run.player.hp, 20)
    assert(run.backpack.items.some(item => item.id === 'money-pouch'))
  } finally { globalThis.localStorage = previous }
}

console.log('item-redesign-check passed: poison, erosion, gold, movement timing, counter rounding, adjacency, pools and save rejection')
