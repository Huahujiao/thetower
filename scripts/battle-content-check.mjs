import assert from 'node:assert/strict'
import { fixture, add, enemy, select, attack, round } from './item-test-helpers.mjs'
import { GameRun } from '../src/game/run.js'
import { createLootEntity, createMinion, makeItemById } from '../src/game/data/content.js'
import { createMerchantEntity } from '../src/game/data/merchants.js'
import { buildRelicChoices } from '../src/game/data/relics.js'
import { migrateBattleContent } from '../src/game/data/battle-content-migration.js'
import { getStatus } from '../src/game/rules/statuses.js'

function summon(run, badge, pos = { c: 2, r: 3 }) {
  select(run, badge); assert(run.useSelected()); assert(run.clickTile(pos.c, pos.r))
  return run.totems.active(badge.totemId)
}
function restore(data) {
  const previous = globalThis.localStorage
  let payload = JSON.stringify(data), removed = false
  globalThis.localStorage = { getItem: () => payload, setItem: (_key, value) => { payload = value }, removeItem: () => { removed = true } }
  try {
    const run = new GameRun({ autoLoad: true, random: () => .99 })
    assert(!removed && run._loaded, 'old save must survive migration')
    return { run, saved: JSON.parse(payload) }
  } finally { globalThis.localStorage = previous }
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
  run.player.energy = 2
  run._damageEnemy(first, 999); run._endTurn()
  assert(!run.battle.active && !run.currentRoom.entity(totem.id))
  assert(run.currentRoom.entity(hidden.id) && !run.currentRoom.isRevealed(hidden.pos))
  assert.equal(run.player.maxEnergy, 6); assert.equal(run.player.energy, 2)
}
// Pet kills and poison kills also close the battle and clear reservations.
for (const source of ['pet', 'poison']) {
  const run = fixture(), badge = add(run, 'r-totem-ward')
  const target = enemy(run, { hp: 1, attack: 1, actionDelay: 0 })
  run._synchronizeBattle(); const totem = summon(run, badge)
  if (source === 'pet') { add(run, 'mountain-hound', 1, 0); add(run, 'food-3', 1, 1) }
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
// Legacy badges, world entities and pending selections migrate without resetting
// partial food, reinforced weapons, current stamina or the rest of the map.
{
  const run = fixture(), weapon = add(run, 'rust-sword'), wardBadge = add(run, 'r-totem-ward')
  weapon.attack += 2; weapon.reinforcement = 2; weapon.compression = 1
  const breathBadge = add(run, 'r-totem-breath')
  run.inventoryStash.push(makeItemById('r-totem-breath'))
  const target = enemy(run); run._synchronizeBattle(); const ward = summon(run, wardBadge)
  const breath = { ...ward, id: 'totem-990001', totemId: 'breath', name: breathBadge.name, pos: { c: 1, r: 1 } }
  run.currentRoom.addEntity(breath); run.player.maxEnergy--; run.player.energy = 2
  run.currentRoom.addEntity(createLootEntity(makeItemById('r-totem-breath'), { c: 0, r: 0 }))
  const merchant = createMerchantEntity('merchant', { c: 0, r: 1 })
  merchant.stock = [{ itemId: 'r-totem-breath', price: 9 }, { itemId: 'food-3', price: 6 }]
  merchant.relicChoices = ['r-totem-breath', 'r-empty']; run.currentRoom.addEntity(merchant)
  run.phase = 'level-up'; run.levelUp = { choices: ['relic', 'item-compression', 'weapon-upgrade'], relicChoices: ['r-totem-breath', 'r-empty'] }
  const data = run.serialize(); delete data.battleContentRevision
  for (const entity of data.dungeon.rooms.flatMap(room => room.entities)) if (entity.kind === 'totem') {
    delete entity.lifetime; entity.expiresAt = entity.bornAt + 10
  }
  const { run: loaded, saved } = restore(data)
  assert(loaded.currentRoom.entity(target.id))
  assert(!loaded.totems.active('breath')); assert.equal(loaded.totems.active('ward').lifetime, 'battle')
  assert.equal(loaded.player.maxEnergy, 5); assert.equal(loaded.player.energy, 2)
  const savedWeapon = loaded.backpack.items.find(item => item.uid === weapon.uid)
  assert.equal(savedWeapon.attack, weapon.attack); assert.equal(savedWeapon.reinforcement, 2); assert(!Object.hasOwn(savedWeapon, 'compression'))
  assert(![...loaded.backpack.items, ...loaded.inventoryStash].some(item => item.id === breathBadge.id))
  assert(!loaded.currentRoom.entity(merchant.id).stock.some(stock => stock.itemId === breathBadge.id))
  assert(!loaded.levelUp.relicChoices.includes(breathBadge.id)); assert(!loaded.levelUp.choices.includes('item-compression'))
  assert.equal(loaded.levelUp.choices.length, 3); assert.equal(new Set(loaded.levelUp.choices).size, 3)
  const snapshot = globalThis.structuredClone(saved)
  assert.equal(migrateBattleContent(saved), false); assert.deepEqual(saved, snapshot)
}
for (const phase of ['initial', 'reward']) {
  const run = fixture(), data = run.serialize(); delete data.battleContentRevision
  if (phase === 'initial') data.initialRelicChoices = ['r-totem-breath', 'r-empty', 'r-traveler']
  else { data.phase = 'reward'; data.roomReward = { roomId: run.currentRoom.id, choices: [{ kind: 'relic', relicId: 'r-totem-breath' }] } }
  const { run: loaded } = restore(data)
  if (phase === 'initial') { assert.equal(loaded.initialRelicChoices.length, 3); assert(!loaded.initialRelicChoices.includes('r-totem-breath')) }
  else { assert.equal(loaded.phase, 'reward'); assert.equal(loaded.roomReward.choices[0].kind, 'gold') }
}
// Identity-based checks also protect old minions with stale reward flags.
// All death sources still produce zero experience, items and coins.
for (const source of ['weapon', 'pet', 'poison', 'explosion']) for (const id of ['broodling', 'leech-larva', 'tide-shadow']) {
  const run = fixture(); add(run, 'r-loot-pouch')
  const target = createMinion(id, { c: 4, r: 3 })
  Object.assign(target, { hp: 1, experience: 99, noExperience: false, noLoot: false, drop: { chance: 1, itemId: 'venom-sac' } })
  run.currentRoom.addEntity(target); run.pets.state.butcher.push(target.id)
  if (source === 'weapon') attack(run, add(run, 'gold-hook'), target)
  else if (source === 'pet') { add(run, 'mountain-hound', 1, 0); add(run, 'food-3', 1, 1); round(run) }
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
// Revision 1 saves keep the run and remaining shorter poison durations intact.
{
  const run = fixture(), target = enemy(run)
  const potion = add(run, 'poison'), sac = add(run, 'venom-sac')
  potion.description = 'legacy poison'; sac.description = 'legacy sac'
  run._applyPoison(10, 2)
  run.applyStatus(target, 'enemy-poison', { turns: 100, layers: 2, damage: 5, showTurns: false })
  const data = run.serialize()
  data.battleContentRevision = 1
  const { run: loaded, saved } = restore(data)
  assert.equal(loaded.player.poisonedTurns, 3)
  const poison = getStatus(loaded.currentRoom.entity(target.id), 'enemy-poison')
  assert.equal(poison.turns, 2)
  assert.equal(poison.damage, 5)
  assert.equal(poison.showTurns, true)
  assert.equal(poison.showLayers, false)
  assert.equal(poison.trigger, 'turn')
  assert.equal(loaded.backpack.items.find(item => item.uid === potion.uid).description, makeItemById('poison').description)
  assert.equal(loaded.backpack.items.find(item => item.uid === sac.uid).description, makeItemById('venom-sac').description)
  const copy = JSON.stringify(saved)
  assert.equal(migrateBattleContent(saved), false)
  assert.equal(JSON.stringify(saved), copy)
  const short = run.serialize()
  short.battleContentRevision = 1
  short.player.statuses['player-poison'].turns = 1
  assert.equal(restore(short).run.player.poisonedTurns, 1)
}

console.log('battle-content-check passed: battle lifetime, legacy poison timing, no summoned rewards, retired content and migration')
