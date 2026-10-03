import { getItemDefinition } from './content.js'
import { merchantItemPrice } from './merchants.js'

export const FOOD_POINTS_REVISION = 1
const FOOD_IDS = new Set(['food-3', 'food-5', 'food-7', 'food-9'])

export function migrateFoodPoints(data) {
  if (!data || (data.foodPointsRevision || 0) >= FOOD_POINTS_REVISION) return false
  const update = item => {
    if (!FOOD_IDS.has(item?.id) || item.type !== 'energy') return
    const definition = getItemDefinition(item.id)
    // Preserve partially eaten food; lowering its capacity must never refill it.
    if (Number.isInteger(item.energy) && item.energy > 0) item.energy = Math.min(item.energy, definition.energy)
    item.name = definition.name
    item.description = definition.description
  }
  for (const placement of data.backpack?.placements || []) update(placement.item)
  for (const item of data.inventoryStash || []) update(item)
  for (const room of data.dungeon?.rooms || []) for (const entity of room.entities || []) {
    update(entity.item)
    for (const stock of entity.stock || []) if (FOOD_IDS.has(stock.itemId)) stock.price = merchantItemPrice(stock.itemId)
  }
  data.foodPointsRevision = FOOD_POINTS_REVISION
  return true
}
