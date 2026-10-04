import { buildRelicChoices } from './relics.js'
import { LEVEL_UP_OPTIONS } from './progression.js'
import { getItemDefinition } from './content.js'
import { POISON_TURNS, DEFAULT_STATUS_LAYERS } from '../rules/statuses.js'

export const BATTLE_CONTENT_REVISION = 2
const RETIRED_BADGE = 'r-totem-breath'

export function migrateBattleContent(data, { random = Math.random } = {}) {
  if (!data || (data.battleContentRevision || 0) >= BATTLE_CONTENT_REVISION) return false
  const keep = item => item?.id !== RETIRED_BADGE
  const refresh = item => {
    if (!item) return
    delete item.compression
    if (['poison', 'venom-sac', 'r-miasma-sac', 'r-totem-gas'].includes(item.id)) item.description = getItemDefinition(item.id).description
  }
  const migratePoison = actor => {
    for (const id of ['player-poison', 'enemy-poison']) {
      const status = actor?.statuses?.[id]
      if (!status) continue
      // Preserve shorter remaining effects rather than refill them during migration.
      status.turns = Math.min(status.turns, status.layers, POISON_TURNS)
      status.layers = DEFAULT_STATUS_LAYERS
      status.trigger = 'turn'
      status.showLayers = false
      status.showTurns = true
    }
  }
  migratePoison(data.player)
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
    if (!Array.isArray(choices) || !choices.includes(RETIRED_BADGE)) return choices
    const retained = choices.filter(id => id !== RETIRED_BADGE)
    return [...retained, ...buildRelicChoices({ has: id => owned.has(id) || retained.includes(id) },
      { count: choices.length - retained.length, random }).map(relic => relic.id)]
  }
  data.initialRelicChoices = refreshChoices(data.initialRelicChoices)
  if (data.levelUp?.relicChoices) data.levelUp.relicChoices = refreshChoices(data.levelUp.relicChoices)
  if (data.levelUp?.choices?.includes('item-compression')) {
    const used = new Set(data.levelUp.choices.filter(id => id !== 'item-compression'))
    data.levelUp.choices = data.levelUp.choices.map(id => {
      if (id !== 'item-compression') return id
      const replacements = LEVEL_UP_OPTIONS.filter(option => !used.has(option.id))
      const replacement = replacements[Math.floor(random() * replacements.length)]?.id
      used.add(replacement)
      return replacement
    }).filter(Boolean)
  }
  if (data.levelUp?.selectedOption === 'item-compression') delete data.levelUp.selectedOption
  for (const room of data.dungeon?.rooms || []) {
    if (!Array.isArray(room.entities)) continue
    room.entities = room.entities.filter(entity => {
      if (entity.kind === 'totem' && entity.totemId === 'breath') {
        // Refund the reservation without refilling current stamina or masking a bad save.
        if (room.id === data.player?.roomId) data.player.maxEnergy++
        return false
      }
      return keep(entity.item)
    })
    for (const entity of room.entities) {
      migratePoison(entity)
      if (entity.kind === 'enemy' && entity.deathStatus === 'poison') entity.deathStatusTurns = POISON_TURNS
      refresh(entity.item)
      if (entity.kind === 'totem' && Number.isInteger(entity.bornAt) && entity.expiresAt === entity.bornAt + 10) {
        entity.lifetime = 'battle'
        delete entity.expiresAt
      }
      if (Array.isArray(entity.stock)) entity.stock = entity.stock.filter(stock => stock.itemId !== RETIRED_BADGE)
      if (entity.relicChoices) entity.relicChoices = refreshChoices(entity.relicChoices)
    }
  }
  if (Array.isArray(data.roomReward?.choices)) {
    const room = data.dungeon?.rooms?.find(room => room.id === data.roomReward.roomId)
    data.roomReward.choices = data.roomReward.choices.map(choice =>
      (choice.itemId || choice.relicId) === RETIRED_BADGE ? { kind: 'gold', amount: 3 + (room?.progressionFloor ?? room?.floor ?? 1) } : choice)
  }
  data.battleContentRevision = BATTLE_CONTENT_REVISION
  return true
}
