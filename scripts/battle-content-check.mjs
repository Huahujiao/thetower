import assert from 'node:assert/strict'
import { fixture, add, enemy, select, attack, round, setBalls } from './item-test-helpers.mjs'
import { createMinion } from '../src/game/data/content.js'
import { buildRelicChoices } from '../src/game/data/relics.js'
import { getStatus } from '../src/game/rules/statuses.js'

function summon(run, badge, pos = { c: 2, r: 3 }) {
  select(run, badge); assert(run.useSelected()); assert(run.clickTile(pos.c, pos.r))
  return run.totems.active(badge.totemId)
}
// Exploration placement survives actions, then ends with the first actual fight;
// another hidden enemy does not keep its lifetime alive or refill stamina.
{
  const run = fixture(), badge = add(run, 'r-totem-drum')
  const first = enemy(run, { hp: 1 }), hidden = enemy(run, { pos: { c: 5, r: 5 } })
  for (const target of [first, hidden]) run.currentRoom.tile(target.pos).revealed = false
  const totem = summon(run, badge)
  for (let n = 0; n < 20; n++) run._endTurn({ action: 'organize' })
  assert(!run.battle.active && run.currentRoom.entity(totem.id))
  run._revealEnemy(run.currentRoom, first, { triggerAlert: false })
  assert(run.battle.active && run.currentRoom.entity(totem.id))
  setBalls(run, 2)
  run._damageEnemy(first, 999); run._endTurn()
  assert(!run.battle.active && !run.currentRoom.entity(totem.id))
  assert(run.currentRoom.entity(hidden.id) && !run.currentRoom.isRevealed(hidden.pos))
  assert.equal(run.player.energy, 0)
}
// Pet kills and poison kills also close the battle and clear reservations.
for (const source of ['pet', 'poison']) {
  const run = fixture(), badge = add(run, 'r-totem-ward')
  const target = enemy(run, { hp: 1, attack: 1, actionDelay: 0 })
  run._synchronizeBattle(); const totem = summon(run, badge)
  if (source === 'pet') { add(run, 'mountain-hound', 1, 0) }
  else run.applyStatus(target, 'enemy-poison', { layers: 1, damage: 1 })
  round(run)
  assert(!run.battle.active && !run.currentRoom.entity(totem.id))
  assert.equal(run.player.maxEnergy, 6)
}
// Reviving enemies keep combat (and the totem) alive until the finishing blow.
{
  const run = fixture(), badge = add(run, 'r-totem-drum')
  const target = enemy(run, { hp: 1, deathRule: 'revive' })
  run._synchronizeBattle(); const totem = summon(run, badge)
  run._damageEnemy(target, 999); run._endTurn()
  assert(target.downed && run.battle.active && run.currentRoom.entity(totem.id))
  run._damageEnemy(target, 999); run._endTurn()
  assert(!run.battle.active && !run.currentRoom.entity(totem.id))
}
// Identity-based checks also protect old minions with stale reward flags.
// All death sources still produce zero experience, items and coins.
for (const source of ['weapon', 'pet', 'poison', 'explosion']) for (const id of ['broodling', 'leech-larva', 'tide-shadow']) {
  const run = fixture(); add(run, 'r-loot-pouch')
  const target = createMinion(id, { c: 4, r: 3 })
  Object.assign(target, { hp: 1, experience: 99, noExperience: false, noLoot: false, drop: { chance: 1, itemId: 'venom-sac' } })
  run.currentRoom.addEntity(target); run.pets.state.butcher.push(target.id)
  if (source === 'weapon') attack(run, add(run, 'gold-hook'), target)
  else if (source === 'pet') { add(run, 'mountain-hound', 1, 0); round(run) }
  else if (source === 'poison') { target.attack = 1; target.actionDelay = 0; run.applyStatus(target, 'enemy-poison', { damage: 99 }); round(run) }
  else { run._damageEnemy(target, 99, { source: 'item:explosion' }); run._endTurn() }
  assert(!run.currentRoom.entity(target.id))
  assert.equal(run.player.experience, 0); assert.equal(run.player.gold, 0)
  assert(!run.inventoryStash.length && ![...run.currentRoom.entities.values()].some(entity => entity.kind === 'item'))
  assert(!run.backpack.items.some(item => item.id === 'meat-scrap' || ['potion', 'armor', 'buff', 'teleport'].includes(item.type)))
}
// Normal-enemy kills keep their item rewards; the retired movement loop loses stamina.
{
  const run = fixture(); add(run, 'r-loot-pouch'); const target = enemy(run, { hp: 1 })
  run._damageEnemy(target, 1)
  assert(run.backpack.items.some(item => item.type !== 'relic'))
  assert(!buildRelicChoices(null, { count: 100 }).some(item => item.id === 'r-totem-breath'))
}
{
  const run = fixture(), weapon = add(run, 'bone-knife'); add(run, 'r-empty'); add(run, 'r-traveler')
  const target = enemy(run, { hp: 100 }); run._synchronizeBattle()
  const before = run.player.energy
  select(run, weapon); assert(run._attack(target)); run.bus.emit('animate:attack-complete', { actor: 'player' })
  run._walk([{ c: 3, r: 2 }])
  assert.equal(run.player.energy, before - 1)
  assert.equal(getStatus(target, 'enemy-poison'), null)
}
console.log('battle-content-check passed: battle lifetime, no summoned rewards and retired content')
