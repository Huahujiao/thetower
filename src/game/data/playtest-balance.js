import { getItemDefinition } from './content.js'
import { merchantItemPrice } from './merchants.js'

export const PLAYTEST_BALANCE_REVISION = 1

// Migrate authored balance once without resetting a run or its instance upgrades.
export function migratePlaytestBalance(data) {
  if (!data || (data.playtestBalanceRevision ?? 0) >= PLAYTEST_BALANCE_REVISION) return
  const retired = item => item?.id === 'cleanse'
  const update = (item, floor = null) => {
    if (!item) return
    if (floor !== null && floor < 3 && item.id === 'demon-seeker') {
      const replacement = getItemDefinition('rust-sword')
      Object.assign(item, replacement, { shape: replacement.shape.map(row => [...row]) })
    }
    const definition = getItemDefinition(item.id)
    if (item.type === 'weapon' && definition) {
      item.attack = definition.attack + Math.max(0, Number(item.reinforcement) || 0)
      item.energyCost = definition.energyCost
      item.description = definition.description
      item.minFloor = definition.minFloor
    }
  }
  if (Array.isArray(data.backpack?.placements)) {
    data.backpack.placements = data.backpack.placements.filter(p => !retired(p.item))
    for (const p of data.backpack.placements) update(p.item)
  }
  if (Array.isArray(data.inventoryStash)) {
    data.inventoryStash = data.inventoryStash.filter(item => !retired(item))
    for (const item of data.inventoryStash) update(item)
  }
  for (const room of data.dungeon?.rooms || []) {
    if (!Array.isArray(room.entities)) continue
    room.entities = room.entities.filter(e => !retired(e.item))
    for (const entity of room.entities) {
      update(entity.item, room.progressionFloor ?? room.floor)
      if (entity.kind === 'enemy' && entity.enemyId === 'tide-shadow-cub') entity.attack = 1
      if (Array.isArray(entity.stock)) {
        entity.stock = entity.stock.filter(stock => stock.itemId !== 'cleanse')
        for (const stock of entity.stock) {
          if ((room.progressionFloor ?? room.floor) < 3 && stock.itemId === 'demon-seeker') stock.itemId = 'rust-sword'
          if (getItemDefinition(stock.itemId)?.type === 'weapon') stock.price = merchantItemPrice(stock.itemId)
        }
      }
    }
  }
  if (Array.isArray(data.roomReward?.choices)) {
    const room = data.dungeon?.rooms?.find(room => room.id === data.roomReward.roomId)
    const floor = room?.progressionFloor ?? room?.floor ?? 1
    data.roomReward.choices = data.roomReward.choices.map(choice => {
      if (choice.kind !== 'item') return choice
      if (choice.itemId === 'cleanse') return { kind: 'item', itemId: 'health-potion' }
      if (floor < 3 && choice.itemId === 'demon-seeker') return { kind: 'item', itemId: 'rust-sword' }
      return choice
    })
  }
  data.playtestBalanceRevision = PLAYTEST_BALANCE_REVISION
}
