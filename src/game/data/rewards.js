import catalog from './catalog.json' with { type: 'json' }
import { getItemDefinition, randomConsumableDefinition } from './content.js'
import { buildRelicChoices } from './relics.js'
import { suggestedSynergyId } from '../rules/synergies.js'

const WEAPONS = Object.freeze([...catalog.weapons.filter(w => !w.crafted), ...catalog.defenses])

function pick(values, random) { return values[Math.floor(random() * values.length)] || null }

function eligible(values, floor) { return values.filter((value) => floor >= (value.minFloor || 1)) }

function itemChoice(definition) { return definition ? { kind: 'item', itemId: definition.id } : null }

function goldChoice(floor) { return { kind: 'gold', amount: 3 + Math.max(1, floor || 1) } }

export function buildSupplyRewardChoices({ floor, count = 3, random = Math.random, items = [] } = {}) {
  const suggestedId = suggestedSynergyId(items, 'item', random, (id) => floor >= (getItemDefinition(id)?.minFloor || 1))
  const suggested = getItemDefinition(suggestedId)
  const choices = [
    itemChoice(suggested && floor >= (suggested.minFloor || 1) ? suggested : pick(eligible(WEAPONS, floor), random)),
    itemChoice(randomConsumableDefinition(floor, random)),
    goldChoice(floor),
  ].filter(Boolean)
  while (choices.length < count) choices.push(goldChoice(floor))
  return choices.slice(0, count)
}

export function buildRelicRewardChoices(collection, { floor, count = 3, random = Math.random, items = [] } = {}) {
  const relics = buildRelicChoices(collection, { count, random, preferredId: suggestedSynergyId(items, 'relic', random) })
  const choices = relics.map((relic) => ({ kind: 'relic', relicId: relic.id }))
  while (choices.length < count) choices.push(goldChoice(floor))
  return choices
}

export function buildRoomRewardChoices(collection, { floor, type = 'supply', count = 3, random = Math.random, items = [] } = {}) {
  if (type === 'relic') {
    const choices = buildRelicRewardChoices(collection, { floor, count, random, items })
    if (choices.some((choice) => choice.kind === 'relic')) return { type: 'relic', choices }
  }
  return { type: 'supply', choices: buildSupplyRewardChoices({ floor, count, random, items }) }
}
