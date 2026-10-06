import assert from 'node:assert/strict'
import { fixture, enemy, settleAnimations, setBalls } from './item-test-helpers.mjs'
import { createGoldEntity, createKeyEntity, createLootEntity, makeItemById, makeRelicItem } from '../src/game/data/content.js'
import { RELIC_DEFS } from '../src/game/data/relics.js'

const relicId = RELIC_DEFS.find(relic => !relic.disabled).id
function loot(run, kind, pos) {
  let entity
  if (kind === 'gold') entity = createGoldEntity(4, pos)
  else if (kind === 'key') {
    const edge = [...run.dungeon.edges.values()][0]
    edge.unlocked = false
    entity = createKeyEntity(edge.id, pos)
  } else entity = createLootEntity(kind === 'relic' ? makeRelicItem(relicId) : makeItemById('health-potion'), pos)
  run.currentRoom.addEntity(entity)
  return entity
}
function collected(run, entity) {
  assert.equal(run.currentRoom.entity(entity.id), null, 'collected loot must leave the board')
  if (entity.kind === 'gold') assert.equal(run.player.gold, 4)
  else if (entity.kind === 'key') assert(run.dungeon.edge(entity.edgeId).unlocked)
  else if (entity.item.type === 'relic') assert(run.relics.has(entity.item.relicId))
  else assert([...run.backpack.items, ...run.inventoryStash].some(item => item.uid === entity.item.uid))
}
function ambusher(run, pos, attack = 2) {
  const target = enemy(run, { pos, attack, range: 1, actionDelay: 0, behavior: 'ambush' })
  run.currentRoom.tile(pos).revealed = false
  return target
}

for (const kind of ['item', 'gold', 'key', 'relic']) {
  // Spending the last movement point still collects the destination cell.
  for (const steps of [1, 3]) {
    const run = fixture()
    enemy(run, { pos: { c: 0, r: 0 } }); run._synchronizeBattle()
    const entity = loot(run, kind, { c: 3 - steps, r: 3 })
    setBalls(run, steps)
    assert(run.clickTile(entity.pos.c, entity.pos.r))
    assert.equal(run.player.energy, 0); assert.equal(run.globalTurn, 0)
    assert.deepEqual(run.player.pos, entity.pos); collected(run, entity)
  }
  // Reaching loot and triggering an ambush must finish collection without a
  // second charge after exploration becomes a newly refilled player turn.
  const run = fixture(), entity = loot(run, kind, { c: 4, r: 3 })
  const target = ambusher(run, { c: 4, r: 4 })
  setBalls(run, 0)
  const events = []
  run.on('animate:move', () => events.push('move'))
  run.on('animate:flip', () => events.push('flip'))
  run.on('animate:attack', () => events.push('attack'))
  assert(run.clickTile(4, 3))
  assert.deepEqual(events, ['move', 'flip', 'attack'])
  assert(run.battle.active); assert.equal(run.battle.stage, 'player')
  assert.equal(run.player.energy, 6); assert.equal(run.player.hp, 18)
  assert(target.ambushTriggered); assert.equal(run.globalTurn, 0)
  collected(run, entity)
  assert(run.clickTile(3, 3)); assert.equal(run.currentRoom.entityAt({ c: 4, r: 3 }), null)
}

// An ambush before arrival must still stop the remaining route and leave loot.
{
  const run = fixture(), entity = loot(run, 'item', { c: 0, r: 3 })
  ambusher(run, { c: 2, r: 4 })
  assert(run.clickTile(0, 3))
  assert.deepEqual(run.player.pos, { c: 2, r: 3 })
  assert(run.currentRoom.entity(entity.id)); assert.equal(run.backpack.length, 0)
}
// An unaffordable route must not spend partial energy or consume loot.
{
  const run = fixture(); enemy(run, { pos: { c: 0, r: 0 } }); run._synchronizeBattle()
  const entity = loot(run, 'item', { c: 5, r: 3 })
  setBalls(run, 1)
  assert.equal(run.clickTile(5, 3), false)
  assert.deepEqual(run.player.pos, { c: 3, r: 3 }); assert.equal(run.player.energy, 1)
  assert(run.currentRoom.entity(entity.id))
}
// Standalone pickup remains paid; a full bag stages loot once, even on ambush.
{
  const run = fixture(); enemy(run, { pos: { c: 0, r: 0 } }); run._synchronizeBattle()
  const entity = loot(run, 'item', run.player.pos)
  setBalls(run, 1)
  assert(run.clickTile(3, 3)); assert.equal(run.player.energy, 0); collected(run, entity)
}
{
  const run = fixture()
  while (run.backpack.add(makeItemById('health-potion'))) { /* fill every cell */ }
  const entity = loot(run, 'item', { c: 4, r: 3 })
  ambusher(run, { c: 4, r: 4 })
  assert(run.clickTile(4, 3)); collected(run, entity)
  assert.equal(run.inventoryStash.filter(item => item.uid === entity.item.uid).length, 1)
}
// Lethal ambushes still halt actions and retain the uncollected item.
{
  const run = fixture(), entity = loot(run, 'item', { c: 4, r: 3 })
  ambusher(run, { c: 4, r: 4 }, 30)
  assert(run.clickTile(4, 3)); assert(run.gameOver)
  assert(run.currentRoom.entity(entity.id)); settleAnimations(run)
}
console.log('Pickup/ambush checks passed: combined cost, exact stamina, arrivals, interrupted routes, stash and lethal ambush.')
