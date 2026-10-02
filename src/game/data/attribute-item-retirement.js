import { getItemDefinition } from './content.js'
import { buildRelicChoices } from './relics.js'

export const SUSPENDED_ATTRIBUTE_RELIC_IDS = Object.freeze(['r-three', 'r-reverse', 'r-phase-pointer', 'r-neutral-stone'])
export const PLAIN_ATTRIBUTE_ITEM_IDS = Object.freeze(['triad-ember', 'tide-shield', 'red-shield', 'red-armor', 'phase-armor'])

// Apply even to saves which already received the earlier playtest migration.
// Only the explicitly retired relics and effects change; instance stats survive.
export function migrateAttributeItems(data, { random = Math.random } = {}) {
  if (!data) return
  let changed = false
  const suspended = id => SUSPENDED_ATTRIBUTE_RELIC_IDS.includes(id)
  const keep = item => {
    if (!suspended(item?.id)) return true
    changed = true
    return false
  }
  const refresh = item => {
    if (PLAIN_ATTRIBUTE_ITEM_IDS.includes(item?.id) && item.description !== getItemDefinition(item.id).description) {
      item.description = getItemDefinition(item.id).description
      changed = true
    }
  }
  if (Array.isArray(data.backpack?.placements)) {
    data.backpack.placements = data.backpack.placements.filter(placement => keep(placement.item))
    for (const placement of data.backpack.placements) refresh(placement.item)
  }
  if (Array.isArray(data.inventoryStash)) {
    data.inventoryStash = data.inventoryStash.filter(keep)
    for (const item of data.inventoryStash) refresh(item)
  }
  const owned = new Set([...(data.backpack?.placements?.map(placement => placement.item) || []), ...(data.inventoryStash || [])]
    .filter(item => item?.type === 'relic').map(item => item.relicId))
  const refreshChoices = choices => {
    if (!Array.isArray(choices) || !choices.some(suspended)) return choices
    changed = true
    const retained = choices.filter(id => !suspended(id))
    const replacements = buildRelicChoices({ has: id => owned.has(id) || retained.includes(id) }, { count: choices.length - retained.length, random })
    return [...retained, ...replacements.map(relic => relic.id)]
  }
  data.initialRelicChoices = refreshChoices(data.initialRelicChoices)
  if (data.levelUp?.relicChoices) data.levelUp.relicChoices = refreshChoices(data.levelUp.relicChoices)
  for (const room of data.dungeon?.rooms || []) {
    if (!Array.isArray(room.entities)) continue
    room.entities = room.entities.filter(entity => keep(entity.item))
    for (const entity of room.entities) {
      refresh(entity.item)
      if (Array.isArray(entity.stock)) entity.stock = entity.stock.filter(stock => keep({ id: stock.itemId }))
      if (entity.relicChoices) entity.relicChoices = refreshChoices(entity.relicChoices)
    }
  }
  if (Array.isArray(data.roomReward?.choices)) {
    const floor = data.dungeon?.rooms?.find(room => room.id === data.roomReward.roomId)?.floor || 1
    data.roomReward.choices = data.roomReward.choices.map(choice => {
      if (!suspended(choice.relicId || choice.itemId)) return choice
      changed = true
      return { kind: 'gold', amount: 3 + floor }
    })
  }
  const buffs = data.player?.itemState?.buffs
  if (buffs) {
    if (buffs['r-phase-pointer'] || buffs['red-shield']) changed = true
    delete buffs['r-phase-pointer']
    delete buffs['red-shield']
  }
  return changed
}
