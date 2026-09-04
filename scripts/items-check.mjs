import assert from 'node:assert/strict'
import { GameRun } from '../src/game/run.js'
import { makeItemById } from '../src/game/data/content.js'

function runWithSelectedItem(itemId) {
  const run = new GameRun({ autoLoad: false, random: () => 0.25 })
  assert(run.chooseInitialRelic(run.initialRelicChoices[0]))
  const item = makeItemById(itemId, () => 0.25)
  assert(run.backpack.add(item))
  run.selectedInventoryIndex = run.backpack.originIndex(run.backpack.placementOf(item.uid))
  return { run, item }
}

for (const itemId of ['small-potion', 'armor-potion', 'battle-charm']) {
  const { run, item } = runWithSelectedItem(itemId)
  const actionCount = run.actionCount
  const globalTurn = run.globalTurn
  assert(run.useSelected())
  assert.equal(run.actionCount, actionCount + 1)
  assert.equal(run.globalTurn, globalTurn + 1)
  assert.equal(run.selectedItem, null)
  assert.equal(run.backpack.placementOf(item.uid), null)
}

const whetstoneRun = runWithSelectedItem('whetstone').run
assert.equal(whetstoneRun.useSelected(), true)
assert.equal(whetstoneRun.actionCount, 0)
assert.equal(whetstoneRun.itemTargeting, true)
assert.equal(whetstoneRun.applySelectedItemToEquipment(0), true)
assert.equal(whetstoneRun.actionCount, 1)
assert.equal(whetstoneRun.globalTurn, 1)

console.log('items-check passed')
