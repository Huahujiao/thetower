import assert from 'node:assert/strict'
import { fixture, add, attack, enemy } from './item-test-helpers.mjs'
import { GameRun } from '../src/game/run.js'
import { ALL_ITEM_DEFS, createLootEntity, getItemDefinition, makeItemById } from '../src/game/data/content.js'
import { buildRelicChoices } from '../src/game/data/relics.js'
import { buildMerchantStock, createMerchantEntity } from '../src/game/data/merchants.js'
import { buildRoomRewardChoices } from '../src/game/data/rewards.js'
import { suggestedSynergyId } from '../src/game/rules/synergies.js'
import { migrateAttributeItems, PLAIN_ATTRIBUTE_ITEM_IDS, SUSPENDED_ATTRIBUTE_RELIC_IDS } from '../src/game/data/attribute-item-retirement.js'
import { catalogContent } from '../src/ui/wiki-catalog.js'

const suspended = id => SUSPENDED_ATTRIBUTE_RELIC_IDS.includes(id)
for (const id of SUSPENDED_ATTRIBUTE_RELIC_IDS) {
  assert(getItemDefinition(id).disabled)
  const run = fixture()
  assert.equal(run.acquireRelic(id), false)
  assert(!catalogContent('relics').includes(getItemDefinition(id).name))
}
assert(buildRelicChoices(null, { count: 99 }).every(item => !suspended(item.id)))
for (let index = 0; index < 150; index++) {
  const random = () => index / 150
  assert(buildMerchantStock('merchant', 12, random).every(stock => !suspended(stock.itemId)))
  const items = [makeItemById('rust-sword'), makeItemById('bone-knife'), makeItemById('tide-blade')]
  assert(!suspended(suggestedSynergyId(items, 'relic', random)))
  const reward = buildRoomRewardChoices(null, { floor: 12, type: 'relic', items, random })
  assert(reward.choices.every(choice => !suspended(choice.relicId)))
}

// Plain equipment keeps its base room armor and recipes, without attribute triggers.
{
  const run = fixture()
  const plain = PLAIN_ATTRIBUTE_ITEM_IDS.map(id => add(run, id))
  for (const item of plain) assert(!getItemDefinition(item.id).disabled)
  run.itemRules.enter(true)
  assert.equal(run.player.armor, 4)
  const dagger = add(run, 'bone-knife'), sword = plain[0], target = enemy(run, { hp: 500 })
  run.player.hp = 9
  attack(run, dagger, target)
  assert.equal(run.itemRules.attackContext(sword, target).flat, 0)
  attack(run, sword, target)
  const tide = add(run, 'tide-blade')
  attack(run, tide, target)
  assert.equal(run.player.armor, 4, 'attribute changes and hits do not generate extra armor')
  run._damagePlayer(4, { source: 'enemy:attack', enemy: target })
  assert.equal(run.itemRules.state.buffs['red-shield'], undefined)
  add(run, 'conduit')
  assert(run.availableRecipes().some(recipe => recipe.a === 'triad-ember' && recipe.result === 'coin-blade'))
}

// Already migrated saves retain progress, equipment instances and upgrades.
{
  const run = fixture(), sword = add(run, 'triad-ember')
  sword.reinforcement = 2; sword.attack = 5; sword.description = 'old effect'
  add(run, 'r-three'); add(run, 'r-reverse')
  run.stageInventoryItem(makeItemById('r-phase-pointer'))
  const ground = createLootEntity(makeItemById('r-neutral-stone'), { c: 0, r: 0 })
  run.currentRoom.addEntity(ground)
  const merchant = createMerchantEntity('collector', { c: 1, r: 0 })
  merchant.stock = [{ itemId: 'r-three', price: 9 }, { itemId: 'health-potion', price: 6 }]
  merchant.relicChoices = ['r-three', 'r-reverse', 'r-neutral-stone']
  run.currentRoom.addEntity(merchant)
  run.player.gold = 37; run.player.hp = 13
  run.itemRules.buff('red-shield', { attribute: 'scorch', flat: 2 })
  run.itemRules.buff('r-phase-pointer', { flat: 1, discount: 1 })
  run.phase = 'level-up'
  run.levelUp = { choices: ['relic', 'max-health', 'max-energy'], selectedOption: 'relic', relicChoices: ['r-three', 'r-reverse', 'r-neutral-stone'] }
  const data = run.serialize()
  data.roomReward = { roomId: run.currentRoom.id, choices: [{ kind: 'relic', relicId: 'r-three' }] }
  const originalPayload = JSON.stringify(data)
  migrateAttributeItems(data, { random: () => .99 })
  assert.equal(data.roomReward.choices[0].kind, 'gold')
  const initial = globalThis.structuredClone(data)
  initial.initialRelicChoices = ['r-three', 'r-reverse', 'r-neutral-stone']
  migrateAttributeItems(initial, { random: () => .99 })
  assert.equal(initial.initialRelicChoices.length, 3)
  assert(initial.initialRelicChoices.every(id => !suspended(id)))
  const snapshot = globalThis.structuredClone(data)
  migrateAttributeItems(data); assert.deepEqual(data, snapshot, 'migration is idempotent')
  const previous = globalThis.localStorage
  let payload = originalPayload, persisted = false
  globalThis.localStorage = { getItem: () => payload, setItem: (_key, value) => { payload = value; persisted = true }, removeItem: () => assert.fail('save must not restart') }
  try {
    const loaded = new GameRun({ autoLoad: true })
    const retained = loaded.backpack.items.find(item => item.uid === sword.uid)
    assert.equal(retained.attack, 5); assert.equal(retained.reinforcement, 2)
    assert.equal(retained.description, getItemDefinition(sword.id).description)
    assert.equal(loaded.player.gold, 37); assert.equal(loaded.player.hp, 13)
    assert(![...loaded.backpack.items, ...loaded.inventoryStash].some(item => suspended(item.id)))
    assert.equal(loaded.currentRoom.entity(ground.id), null)
    assert.equal(loaded.currentRoom.entity(merchant.id).stock.length, 1)
    assert(loaded.currentRoom.entity(merchant.id).relicChoices.every(id => !suspended(id)))
    assert.equal(loaded.levelUp.relicChoices.length, 3)
    assert(loaded.levelUp.relicChoices.every(id => !suspended(id)))
    assert.equal(loaded.itemRules.state.buffs['red-shield'], undefined)
    assert.equal(loaded.itemRules.state.buffs['r-phase-pointer'], undefined)
    assert(persisted, 'migration is saved so refreshed candidates cannot reroll on reload')
    const choices = [...loaded.levelUp.relicChoices]
    const reloaded = new GameRun({ autoLoad: true, random: () => .01 })
    assert.deepEqual(reloaded.levelUp.relicChoices, choices)
  } finally { globalThis.localStorage = previous }
}
assert.equal(ALL_ITEM_DEFS.filter(item => !item.disabled && !item.generatedOnly).length, 124)
console.log('attribute-items-check passed: acquisition, plain equipment, recipes and save migration')
