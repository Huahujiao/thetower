import assert from 'node:assert/strict'
import { fixture, add, attack, enemy } from './item-test-helpers.mjs'
import { ALL_ITEM_DEFS, getItemDefinition, makeItemById } from '../src/game/data/content.js'
import { buildRelicChoices } from '../src/game/data/relics.js'
import { buildMerchantStock } from '../src/game/data/merchants.js'
import { buildRoomRewardChoices } from '../src/game/data/rewards.js'
import { suggestedSynergyId } from '../src/game/rules/synergies.js'
import { PLAIN_ATTRIBUTE_ITEM_IDS, SUSPENDED_ATTRIBUTE_RELIC_IDS } from '../src/game/data/attribute-item-retirement.js'
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

assert.equal(ALL_ITEM_DEFS.filter(item => !item.disabled && !item.generatedOnly).length, 118)
console.log('attribute-items-check passed: acquisition, plain equipment, recipes and retired attribute effects')
