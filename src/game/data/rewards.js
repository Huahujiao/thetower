import catalog from './catalog.json' with { type: 'json' }
import { buildRelicChoices } from './relics.js'

const WEAPONS = Object.freeze(catalog.weapons)
const CONSUMABLES = Object.freeze(catalog.consumables)

function pick(values, random) { return values[Math.floor(random() * values.length)] || null }

function eligible(values, floor) { return values.filter((value) => floor >= (value.minFloor || 1)) }

export function buildRoomRewardChoices(collection, { floor, count = 3, random = Math.random } = {}) {
  const choices = []
  const relic = buildRelicChoices(collection, { count: 1, random })[0]
  if (relic) choices.push({ kind: 'relic', relicId: relic.id })
  const weapon = pick(eligible(WEAPONS, floor), random)
  if (weapon) choices.push({ kind: 'item', itemId: weapon.id })
  const consumable = pick(eligible(CONSUMABLES, floor), random)
  if (consumable) choices.push({ kind: 'item', itemId: consumable.id })
  while (choices.length < count) choices.push({ kind: 'gold', amount: 2 + floor })
  return choices.slice(0, count)
}
