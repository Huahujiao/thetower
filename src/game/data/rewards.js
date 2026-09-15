import catalog from './catalog.json' with { type: 'json' }
import { randomConsumableDefinition } from './content.js'
import { buildRelicChoices } from './relics.js'

const WEAPONS = Object.freeze([...catalog.weapons.filter(w => !w.crafted), ...catalog.defenses])

function pick(values, random) { return values[Math.floor(random() * values.length)] || null }

function eligible(values, floor) { return values.filter((value) => floor >= (value.minFloor || 1)) }

function itemChoice(definition) { return definition ? { kind: 'item', itemId: definition.id } : null }

function goldChoice(floor) { return { kind: 'gold', amount: 3 + Math.max(1, floor || 1) } }

export function buildSupplyRewardChoices({ floor, count = 3, random = Math.random } = {}) {
  const choices = [
    itemChoice(pick(eligible(WEAPONS, floor), random)),
    itemChoice(randomConsumableDefinition(floor, random)),
    goldChoice(floor),
  ].filter(Boolean)
  while (choices.length < count) choices.push(goldChoice(floor))
  return choices.slice(0, count)
}

export function buildRelicRewardChoices(collection, { floor, count = 3, random = Math.random } = {}) {
  const relics = buildRelicChoices(collection, { count, random })
  const choices = relics.map((relic) => ({ kind: 'relic', relicId: relic.id }))
  while (choices.length < count) choices.push(goldChoice(floor))
  return choices
}

export function buildRoomRewardChoices(collection, { floor, type = 'supply', count = 3, random = Math.random } = {}) {
  if (type === 'relic') {
    const choices = buildRelicRewardChoices(collection, { floor, count, random })
    if (choices.some((choice) => choice.kind === 'relic')) return { type: 'relic', choices }
  }
  return { type: 'supply', choices: buildSupplyRewardChoices({ floor, count, random }) }
}
