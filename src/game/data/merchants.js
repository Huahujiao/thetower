import catalog from './catalog.json' with { type: 'json' }
import { nextEntityId } from './content.js'

const ITEM_DEFS = Object.freeze([...catalog.weapons, ...catalog.consumables, ...(catalog.enemyLoot || []), ...(catalog.merchantWeapons || [])])
const ITEM_BY_ID = new Map(ITEM_DEFS.map((definition) => [definition.id, definition]))
export const MERCHANT_STOCK_SIZE = 4

export const MERCHANT_DEFS = Object.freeze([
  {
    id: 'merchant',
    name: '\u5546\u4eba',
    services: ['stock', 'relic-management', 'sell'],
    stockPool: 'all',
    restockPrice: 6,
  },
  {
    id: 'collector',
    name: '\u6536\u85cf\u5bb6',
    services: ['relic-management', 'relic-choice', 'sell'],
    stockPool: null,
    restockPrice: 0,
    relicPrice: 9,
  },
])

const BY_ID = new Map(MERCHANT_DEFS.map((definition) => [definition.id, definition]))

function availableItems(floor) {
  return ITEM_DEFS.filter((definition) => {
    if (floor < (definition.minFloor || 1)) return false
    return definition.dropOnly === true || definition.merchantOnly === true
  })
}

function stockCandidates(definition, floor) {
  const items = availableItems(floor)
  if (definition?.stockPool === 'all') return items
  return []
}

export function merchantItemPrice(itemOrId) {
  const item = typeof itemOrId === 'string' ? ITEM_BY_ID.get(itemOrId) : itemOrId
  if (!item) return 0
  if (item.type === 'weapon') {
    const durability = Number(item.durability ?? item.durabilityRange?.[1] ?? 1) || 1
    return 4 + (Number(item.attack) || 0) + durability + (Number(item.range) || 1)
  }
  if (item.type === 'potion') return 3 + Math.ceil(item.heal / 2)
  if (item.type === 'armor') return 3 + Math.ceil(item.armor / 2)
  if (item.type === 'whetstone') return 3 + item.repair
  if (item.type === 'buff') return 4 + item.attackBonus
  return 4
}

export function merchantSellPrice(item) { return Math.max(1, Math.floor(merchantItemPrice(item) / 2)) }

function makeStockEntry(definition) { return { itemId: definition.id, price: merchantItemPrice(definition) } }

function pickStockEntry(merchantId, floor, random = Math.random, excludedIds = new Set()) {
  const definition = getMerchantDefinition(merchantId)
  const candidates = stockCandidates(definition, floor).filter((item) => !excludedIds.has(item.id))
  const item = candidates[Math.floor(random() * candidates.length)] || null
  return item ? makeStockEntry(item) : null
}

export function buildMerchantStock(merchantId, floor, random = Math.random) {
  const entries = []
  const usedIds = new Set()
  for (let index = 0; index < MERCHANT_STOCK_SIZE; index++) {
    const entry = pickStockEntry(merchantId, floor, random, usedIds)
    if (!entry) break
    entries.push(entry)
    usedIds.add(entry.itemId)
  }
  return entries
}

export function refreshMerchantSlot(merchant, floor, index, random = Math.random) {
  if (!merchant?.merchantId || !Number.isInteger(index) || index < 0 || index >= merchant.stock.length) return false
  const excludedIds = new Set(merchant.stock.filter((_, slot) => slot !== index).map((stock) => stock.itemId))
  const entry = pickStockEntry(merchant.merchantId, floor, random, excludedIds)
  if (!entry) return false
  merchant.stock[index] = entry
  return true
}

export function refreshMerchantStock(merchant, floor, random = Math.random) {
  if (!merchant?.merchantId) return false
  const stock = buildMerchantStock(merchant.merchantId, floor, random)
  if (stock.length === 0) return false
  merchant.stock = stock
  return true
}

export function getMerchantDefinition(id) { return BY_ID.get(id) || null }

export function createMerchantEntity(merchantId, position, { floor = 1, random = Math.random } = {}) {
  const definition = getMerchantDefinition(merchantId)
  if (!definition) throw new Error(`Unknown merchant: ${merchantId}`)
  return {
    id: nextEntityId('merchant'),
    kind: 'merchant',
    merchantId: definition.id,
    name: definition.name,
    services: [...definition.services],
    stock: buildMerchantStock(definition.id, floor, random),
    restockPrice: definition.restockPrice,
    relicChoices: [],
    relicOfferResolved: false,
    relicOfferPrice: definition.relicPrice || 0,
    relicManagementConfirmed: false,
    pos: { ...position },
    revealOrder: null,
  }
}
