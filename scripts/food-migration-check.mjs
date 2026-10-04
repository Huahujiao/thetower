import assert from 'node:assert/strict'
import { fixture, add } from './item-test-helpers.mjs'
import { GameRun } from '../src/game/run.js'
import { createLootEntity, getItemDefinition, makeItemById } from '../src/game/data/content.js'
import { createMerchantEntity, merchantItemPrice } from '../src/game/data/merchants.js'
import { migrateFoodPoints, FOOD_POINTS_REVISION } from '../src/game/data/food-point-migration.js'

const run = fixture()
const full = add(run, 'food-9'), partial = add(run, 'food-7')
full.energy = 9
partial.energy = 2
const stash = makeItemById('food-5'); stash.energy = 5; run.inventoryStash.push(stash)
const ground = makeItemById('food-7'); ground.energy = 7
const entity = createLootEntity(ground, { c: 0, r: 0 }); run.currentRoom.addEntity(entity)
const merchant = createMerchantEntity('merchant', { c: 1, r: 0 })
merchant.stock = [{ itemId: 'food-9', price: 9 }, { itemId: 'food-5', price: 7 }]
run.currentRoom.addEntity(merchant)
run.phase = 'reward'
run.roomReward = { roomId: run.currentRoom.id, type: 'supply', choices: [{ kind: 'item', itemId: 'food-9' }] }
const data = run.serialize(); delete data.foodPointsRevision
const placements = data.backpack.placements.map(({ item, x, y, rotation }) => ({ uid: item.uid, x, y, rotation }))
const previousStorage = globalThis.localStorage
let removed = 0, persisted = null
globalThis.localStorage = {
  getItem: () => JSON.stringify(data),
  setItem: (_key, value) => { persisted = JSON.parse(value) },
  removeItem: () => { removed++ },
}
try {
  const loaded = new GameRun({ autoLoad: true })
  assert(loaded._loaded)
  assert.equal(removed, 0)
  assert.equal(loaded.backpack.items.find(item => item.uid === full.uid).energy, 6)
  assert.equal(loaded.backpack.items.find(item => item.uid === partial.uid).energy, 2)
  assert.equal(loaded.inventoryStash.find(item => item.uid === stash.uid).energy, 4)
  assert.equal(loaded.currentRoom.entity(entity.id).item.energy, 5)
  assert.deepEqual(loaded.backpack.serialize().placements.map(({ item, x, y, rotation }) => ({ uid: item.uid, x, y, rotation })), placements)
  assert.deepEqual(loaded.currentRoom.entity(merchant.id).stock.map(stock => stock.price), [merchantItemPrice('food-9'), merchantItemPrice('food-5')])
  assert.equal(loaded.roomReward.choices[0].itemId, 'food-9')
  assert.equal(persisted.foodPointsRevision, FOOD_POINTS_REVISION)
  const snapshot = globalThis.structuredClone(persisted)
  assert.equal(migrateFoodPoints(persisted), false)
  assert.deepEqual(persisted, snapshot)
  assert.equal(getItemDefinition('meat-scrap').energy, 2)
} finally { globalThis.localStorage = previousStorage }

for (const energy of [0, -1, 1.5, '9']) {
  const invalid = globalThis.structuredClone(data)
  invalid.backpack.placements[0].item.energy = energy
  migrateFoodPoints(invalid)
  assert.equal(invalid.backpack.placements[0].item.energy, energy)
}
console.log('food-migration-check passed: old saves, partial food, ground, stash, prices, rewards and idempotence')
