import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fixture, add, enemy, select, attack } from './item-test-helpers.mjs'
import { GameRun, SAVE_VERSION } from '../src/game/run.js'
import { ALL_ITEM_DEFS, makeItemById } from '../src/game/data/content.js'
import { PETS, PET_RELICS } from '../src/game/data/pets.js'
import { getStatus } from '../src/game/rules/statuses.js'
import { catalogContent } from '../src/ui/wiki-catalog.js'
import { buildSupplyRewardChoices } from '../src/game/data/rewards.js'
import { MERCHANT_DEFS } from '../src/game/data/merchants.js'

function feed(run, id = 'food-3', points = null, x = 0, y = 1) {
  const item = add(run, id, x, y)
  if (points !== null) item[item.type === 'energy' ? 'energy' : 'heal'] = points
  return item
}
function phase(run, options = {}) { run._endTurn({ skipEnemyPhase: true, recoverEnergy: false, ...options }) }

assert.equal(PETS.length, 8)
assert.equal(ALL_ITEM_DEFS.length, 132)
assert.equal(ALL_ITEM_DEFS.filter(item => !item.starterOnly && !item.generatedOnly && !item.disabled).length, 123)
assert.equal(makeItemById('r-feeding-charm').name, '\u9972\u517d\u7b26')
for (const pet of PETS) {
  const item = makeItemById(pet.id)
  assert.equal(item.type, 'pet'); assert.deepEqual(item.shape, [[1, 1]])
  assert(catalogContent('items').includes(pet.name))
}
for (const relic of PET_RELICS) assert(catalogContent('relics').includes(relic.name))
assert(Object.keys(MERCHANT_DEFS).length > 0)
assert(Array.from({ length: 100 }, (_, index) => buildSupplyRewardChoices({ floor: 1, items: [makeItemById('r-feeding-charm')], random: () => index / 100 })[0])
  .some(choice => PETS.some(pet => pet.id === choice.itemId)))

// No target/no sufficient budget means atomic no-op, even with partial food.
{
  const run = fixture(), pet = add(run, 'mandrill-beast', 0, 0), first = feed(run, 'food-3', 1)
  phase(run); assert.equal(first.energy, 1)
  const target = enemy(run); phase(run); assert.equal(first.energy, 1); assert.equal(target.hp, 100)
  const second = feed(run, 'food-3', 2, 1, 1)
  phase(run); assert.equal(target.hp, 92); assert(!run.backpack.placementOf(first.uid)); assert(!run.backpack.placementOf(second.uid))
  assert(run.backpack.placementOf(pet.uid)); assert.equal(run.globalTurn, 3)
}
// Every pet's base damage, costs and nearest-target attack run in an independent phase.
for (const definition of PETS) {
  const run = fixture(), pet = add(run, definition.id, 0, 0), food = feed(run, 'food-9')
  const target = enemy(run), other = enemy(run, { pos: { c: 5, r: 3 } })
  phase(run)
  assert.equal(target.hp, 100 - definition.attack, definition.id)
  assert.equal(food.energy, 9 - definition.foodCost, definition.id)
  if (pet.id === 'venom-toad') {
    const poison = getStatus(target, 'enemy-poison'); assert(poison); assert.equal(poison.turns, 100); assert.equal(poison.layers, 100)
    assert.equal(poison.showTurns, false); assert.equal(poison.showLayers, false)
  }
  if (pet.id === 'shadow-spider') assert.equal(target.actionDelay, 101)
  if (pet.id === 'thunder-raven') assert.equal(other.hp, 99)
}
// Physical backpack order, not acquisition order, including rotated two-cell pets.
{
  const run = fixture(), later = add(run, 'mountain-hound', 3, 0), earlier = add(run, 'venom-toad', 0, 0)
  assert(run.backpack.move(later.uid, 3, 0, 1))
  feed(run, 'food-9'); feed(run, 'food-9', null, 4, 0)
  enemy(run)
  const order = []; run.on('pet:attacked', ({ pet }) => order.push(pet.uid))
  phase(run); assert.deepEqual(order, [earlier.uid, later.uid])
}
// Shared food is consumed once in row-major pet order, stash pets never act.
{
  const run = fixture(), first = add(run, 'mountain-hound', 0, 0), second = add(run, 'mountain-hound', 0, 2)
  feed(run, 'food-3', 1); const target = enemy(run)
  const order = []; run.on('pet:attacked', ({ pet }) => order.push(pet.uid))
  phase(run); assert.deepEqual(order, [first.uid]); assert.equal(target.hp, 96)
  run.backpack.removeByUid(first.uid); run.inventoryStash.push(first)
  feed(run, 'food-3', 2); phase(run); assert.deepEqual(order, [first.uid, second.uid])
}
// Food partly eaten by pets still recovers exactly its remaining points for the player.
{
  const run = fixture(); add(run, 'mountain-hound', 0, 0)
  const food = feed(run, 'food-5'), target = enemy(run)
  phase(run); assert.equal(food.energy, 4)
  run.player.energy = 0; select(run, food); assert(run.useSelected())
  assert.equal(run.player.energy, 4); assert(!run.backpack.placementOf(food.uid)); assert.equal(target.hp, 96)
}
// Pet phase precedes enemy attacks; fatal pet hits prevent enemy action entirely.
{
  const run = fixture(); add(run, 'mountain-hound', 0, 0); feed(run)
  enemy(run, { hp: 4, attack: 10, actionDelay: 0 }); const hp = run.player.hp
  const phases = []; run.on('pets:started', () => phases.push('pets'))
  run.on('turn:ended', () => phases.push('end'))
  run._endTurn({ recoverEnergy: false }); assert.equal(run.player.hp, hp); assert.deepEqual(phases, ['pets', 'end'])
}
// Player animation waits before pets, and each player turn resolves pets exactly once.
{
  const run = fixture(), weapon = add(run, 'hunter-shortbow', 4, 0)
  add(run, 'mountain-hound', 0, 0); const food = feed(run), target = enemy(run)
  select(run, weapon); assert(run._attack(target)); assert.equal(food.energy, 3); assert(getStatus(target, 'prey'))
  run.bus.emit('animate:attack-complete', { actor: 'player' }); assert.equal(food.energy, 2)
  assert.equal(target.hp, 88); assert.equal(getStatus(target, 'prey'), null)
  run.bus.emit('animate:attack-complete', { actor: 'player' }); assert.equal(food.energy, 2)
}
// Spider delays the upcoming enemy action; the following turn can act normally.
{
  const run = fixture(), pet = add(run, 'shadow-spider', 0, 0); feed(run, 'food-3', 2)
  const target = enemy(run, { actionDelay: 0, attack: 5 }); const hp = run.player.hp
  run._endTurn({ recoverEnergy: false }); assert.equal(target.actionDelay, 0); assert.equal(run.player.hp, hp)
  run.backpack.removeByUid(pet.uid); run._endTurn({ recoverEnergy: false }); assert.equal(run.player.hp, hp - 5)
}
// Defense piercing ignores BOTH traits without consuming the shield.
{
  const run = fixture(); add(run, 'iron-beetle', 0, 0); feed(run)
  const target = enemy(run, { hp: 6, traits: ['shield', 'heavy-armor'] })
  phase(run); assert.equal(target.hp, 1); assert.equal(target.shieldConsumed, undefined)
}
// Rat restores exactly the consumed partial stack and full stack identity/placement.
for (const points of [1, 3]) {
  const run = fixture(); add(run, 'carrion-rat', 0, 0)
  const food = feed(run, 'food-3', points), placement = { ...run.backpack.placementOf(food.uid) }
  enemy(run, { hp: 3 }); add(run, 'r-furnace', 5, 0); add(run, 'r-loot-pouch', 6, 0)
  phase(run); assert.equal(food.energy, points)
  assert.deepEqual(run.backpack.placementOf(food.uid), placement)
  assert.equal(run.itemRules.expansion.state.consumedTierOne, 0)
}
// A kill gives armor, reveals a card (with normal trap consequences), and triggers butcher.
{
  const run = fixture(); add(run, 'spirit-raven', 0, 0); feed(run); add(run, 'beast-armor', 4, 0)
  const target = enemy(run, { hp: 2 }), hidden = { c: 4, r: 4 }
  run.currentRoom.tile(hidden).revealed = false
  run.pets.state.butcher.push(target.id)
  const before = run.player.armor; phase(run)
  assert.equal(run.player.armor, before + 2); assert(run.currentRoom.isRevealed(hidden))
  assert(run.backpack.items.some(item => item.id === 'meat-scrap' && item.energy === 2))
}
// Vampire discount is bottle-only; charm is adjacency-only, both clamp to one.
{
  const run = fixture(), pet = add(run, 'mandrill-beast', 0, 0), food = feed(run, 'food-5')
  add(run, 'r-vampire-fang', 5, 0); enemy(run)
  phase(run); assert.equal(food.energy, 2) // pure ordinary food costs 3
  const bottle = feed(run, 'health-potion', null, 1, 1), healing = bottle.heal
  phase(run); assert.equal(bottle.heal, healing - 1); assert.equal(food.energy, 1) // mixture spends 2, includes bottle
  add(run, 'r-feeding-charm', 2, 0); assert.equal(run.pets.cost(pet), 2)
  phase(run); assert.equal(bottle.heal, healing - 2); assert.equal(food.energy, 1) // bottle-only discounted cost 1
  run.backpack.removeByUid(food.uid); run.backpack.removeByUid(pet.uid)
  run.player.hp = 1; select(run, bottle); assert(run.useSelected()); assert.equal(run.player.hp, 1 + healing - 2)
}
// In a mixed plan ordinary food is spent before extra bottle points, regardless of backpack order.
{
  const run = fixture(); add(run, 'mandrill-beast', 0, 0); add(run, 'r-vampire-fang', 5, 0)
  const bottle = feed(run, 'health-potion', 5, 0, 1), food = feed(run, 'food-3', 2, 1, 1)
  enemy(run); phase(run)
  assert.equal(bottle.heal, 4); assert.equal(food.energy, 1)
}
// Blood without fang is ineligible; no targets and insufficient discounted total spend nothing.
{
  const run = fixture(); add(run, 'mandrill-beast', 0, 0); const bottle = feed(run, 'health-potion', 1)
  enemy(run); phase(run); assert.equal(bottle.heal, 1)
  add(run, 'r-vampire-fang', 5, 0); phase(run); assert.equal(bottle.heal, 1)
  run.currentRoom.entities.clear(); phase(run); assert.equal(bottle.heal, 1)
}
// Pack counts different INSTANCES, resets per turn. Global whistle and horn stack per target.
{
  const run = fixture(); add(run, 'mountain-hound', 0, 0); add(run, 'mountain-hound', 0, 2)
  feed(run, 'food-9'); add(run, 'r-pack-hunt', 5, 0)
  const target = enemy(run); phase(run); assert.equal(target.hp, 91)
  phase(run); assert.equal(target.hp, 82)
}
{
  const run = fixture(), pet = add(run, 'mountain-hound', 0, 0), food = feed(run)
  add(run, 'r-far-whistle', 5, 0); add(run, 'r-hunting-horn', 6, 0)
  const target = enemy(run, { pos: { c: 0, r: 2 } })
  phase(run); assert.equal(food.energy, 3)
  run.pets.playerAttack(target); assert.equal(run.pets.range(pet, target), 5)
  phase(run); assert.equal(target.hp, 96)
  phase(run); assert.equal(target.hp, 96); assert.equal(run.pets.range(pet, target), 3)
}
// Prey priority within effective range, bonus and marks expire at the end of the turn.
{
  const run = fixture(); add(run, 'mountain-hound', 0, 0); feed(run)
  const nearest = enemy(run), prey = enemy(run, { pos: { c: 3, r: 5 } })
  run.pets.playerHit(makeItemById('hunter-shortbow'), prey); phase(run)
  assert.equal(nearest.hp, 100); assert.equal(prey.hp, 94)
  phase(run); assert.equal(nearest.hp, 96)
}
// Butcher instant kills and delayed enemy-poison deaths both award one meat per target.
{
  const run = fixture(), weapon = add(run, 'butcher-knife', 0, 0), target = enemy(run, { hp: 4 })
  attack(run, weapon, target); assert.equal(run.backpack.items.filter(item => item.id === 'meat-scrap').length, 1)
}
{
  const run = fixture(), weapon = add(run, 'butcher-knife', 0, 0)
  const target = enemy(run, { hp: 5, attack: 4, actionDelay: 0 }); run.applyStatus(target, 'enemy-poison', { damage: 1 })
  attack(run, weapon, target); assert.equal(run.backpack.items.filter(item => item.id === 'meat-scrap').length, 1)
}
// Feeding does not activate player-use chains or bath armor, exhaustion counts for furnace.
{
  const run = fixture(); add(run, 'mountain-hound', 0, 0); feed(run, 'food-3', 1)
  add(run, 'bath-robe', 4, 0); add(run, 'r-furnace', 6, 0)
  run.itemRules.expansion.state.consumedTierOne = 1; const armor = run.player.armor; enemy(run)
  phase(run); assert.equal(run.player.armor, armor); assert.equal(run.itemRules.expansion.state.consumedTierOne, 2)
  assert(run.backpack.items.some(item => item.tier === 2))
}
// Partial points and pending attack marks survive load; invalid points/old saves restart.
{
  const run = fixture(), weapon = add(run, 'hunter-shortbow', 4, 0)
  add(run, 'mountain-hound', 0, 0); const food = feed(run, 'food-3', 2), target = enemy(run)
  select(run, weapon); assert(run._attack(target))
  const original = run.serialize(), previous = globalThis.localStorage
  let payload = JSON.stringify(original), removed = 0
  globalThis.localStorage = { getItem: () => payload, setItem: (_key, value) => { payload = value }, removeItem: () => { removed++; payload = null } }
  try {
    const loaded = new GameRun({ autoLoad: true })
    assert.equal(removed, 0); assert.equal(loaded.backpack.items.find(item => item.uid === food.uid).energy, 1)
    assert.equal(loaded.currentRoom.entity(target.id).hp, 88); assert.equal(loaded.globalTurn, 1)
    for (const mutate of [data => { data.version = SAVE_VERSION - 1 }, data => { data.backpack.placements.find(p => p.item.uid === food.uid).item.energy = 0 },
      data => { data.player.itemState.pets.prey = null }]) {
      const bad = globalThis.structuredClone(original); mutate(bad); payload = JSON.stringify(bad)
      const fresh = new GameRun({ autoLoad: true }); assert.equal(fresh.globalTurn, 0)
    }
    assert.equal(removed, 3)
  } finally { globalThis.localStorage = previous }
}
const badge = await readFile(new URL('../src/ui/ItemValueBadge.vue', import.meta.url), 'utf8')
assert(badge.includes('{{ item.energy }}')); assert(badge.includes('{{ item.heal }}'))
console.log('pets-check passed: eight pets, phase order, atomic/partial/shared food, blood-only discount, kills, prey, pack, horn and saves')
