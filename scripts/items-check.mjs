import assert from 'node:assert/strict'
import { GameRun } from '../src/game/run.js'
import { getItemDefinition, makeItemById, randomConsumableDefinition } from '../src/game/data/content.js'

assert.equal(getItemDefinition('energy-potion')?.type, 'energy')
assert.equal(randomConsumableDefinition(1, () => 0)?.id, 'armor-potion')
assert.equal(randomConsumableDefinition(1, () => 0.999)?.id, 'battle-charm')
assert(getItemDefinition('battle-charm').supplyWeight < getItemDefinition('small-potion').supplyWeight)

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
  run.player.energy = 5
  const globalTurn = run.globalTurn
  assert(run.useSelected())
  assert.equal(run.player.energy, 6)
  assert.equal(run.globalTurn, globalTurn + 1)
  assert.equal(run.selectedItem, null)
  assert.equal(run.backpack.placementOf(item.uid), null)
}

const energyCase = runWithSelectedItem('energy-potion')
energyCase.run.player.energy = 5
assert(energyCase.run.useSelected())
assert.equal(energyCase.run.player.energy, 8)
assert.equal(energyCase.run.backpack.placementOf(energyCase.item.uid), null)

console.log('items-check passed')
