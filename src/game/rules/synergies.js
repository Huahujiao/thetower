import { ALL_ITEM_DEFS } from '../data/content.js'
import { adjacentItems } from './backpack-geometry.js'

// These tags affect only reward suggestions. They never activate an item effect.
const HINTS = Object.freeze({
  'r-far-whistle': ['pet', 'range'], 'r-hunting-horn': ['pet'], 'hunter-shortbow': ['pet'],
  'wall-core': ['armor'], 'return-axle': ['switch'], 'corrosive-heart-core': ['poison'],
  'soul-chain': ['collision'], 'beast-hunting-horn': ['pet', 'range'], 'mountain-break-stone': ['empty'],
  'r-pack-hunt': ['pet'], 'beast-armor': ['pet', 'armor'], 'r-feeding-charm': ['pet', 'food'],
  'butcher-knife': ['pet', 'food'], 'r-vampire-fang': ['pet', 'food'],
  'venom-toad': ['poison'], 'spirit-raven': ['reveal'],
  'silver-guard': ['armor'], 'wood-shield': ['armor'], conduit: ['armor'], 'fork-connector': ['armor'], 'shield-core': ['armor'],
  'wall-sword': ['armor'], 'r-guard-return': ['armor'], 'iron-powder': ['armor'],
  'return-axe': ['switch'], spring: ['switch'], 'r-relay-badge': ['switch'],
  'tide-blade': ['switch', 'movement'], 'r-traveler': ['switch', 'movement'],
  'triad-wither': ['poison'],
  'r-phase-pointer': ['attributes'], 'r-three': ['attributes'],
  'coin-blade': ['gold'], 'r-money-scale': ['gold'], 'r-trade-voucher': ['gold'],
  'gold-hook': ['gold'], 'r-ledger': ['gold'],
  'mountain-maul': ['empty'], 'r-empty': ['empty'], 'r-scales': ['empty'], 'r-heavy-wrist': ['empty'],
  'r-step-boots': ['movement'], 'r-turn-shield': ['movement'], 'ash-bow': ['movement'],
  'eagle-bow': ['range'], scope: ['range'], 'range-disc': ['range'], 'steady-clip': ['range'],
  'soul-spear': ['collision'], chain: ['collision'], 'bone-nail': ['collision'], 'ember-spear': ['collision'],
  'erosion-knife': ['poison'], 'venom-sac': ['poison'], 'r-poison-hourglass': ['poison'],
  'toxin-vial': ['poison'], 'vine-armor': ['poison'],
  'r-step-edge': ['movement'], 'r-single-seal': ['repeat'], 'r-switch-ring': ['switch'],
  'r-neutral-stone': ['attributes'], 'phase-armor': ['armor'],
  'r-lone-edge': ['empty'], 'r-armor-command': ['armor'], 'r-iron-will': ['armor'],
  'r-armor-ring': ['armor'], 'renewal-armor': ['armor'], 'mountain-shield': ['armor', 'consumables'],
  'r-miasma-sac': ['poison'], 'r-bone-incense': ['poison'], 'r-plague-bell': ['poison'],
  'demon-seeker': ['reveal'], 'scouting-bow': ['reveal', 'range'], 'r-pill-ticket': ['reveal', 'consumables'],
  'r-extreme-range': ['range'], 'r-range-mirror': ['range'], 'farwatch-armor': ['range', 'armor'],
  'bounty-bow': ['range', 'gold'], 'r-wealth-scale': ['gold'], 'r-gold-fuel': ['gold'],
  'gold-pick-armor': ['gold', 'armor'], 'coin-armor': ['gold', 'armor'],
  'r-furnace': ['consumables'], 'r-loot-pouch': ['consumables'], 'r-chain-drink': ['consumables'],
  'bath-robe': ['consumables', 'armor'], 'r-launcher': ['consumables'],
  'r-totem-drum': ['totem'], 'r-totem-ward': ['totem'], 'r-totem-breath': ['totem', 'movement'],
  'r-totem-spirit': ['totem', 'reveal'], 'r-totem-bind': ['totem', 'collision'],
  'r-totem-gas': ['totem', 'poison'], 'r-totem-soul': ['totem'],
})

function tagsOf(item) {
  const tags = new Set(HINTS[item.id] || [])
  if (item.type === 'pet') { tags.add('pet'); tags.add('food') }
  if (['energy', 'potion'].includes(item.type)) tags.add('food')
  if (item.type === 'weapon' && item.range >= 2) tags.add('range')
  if (item.type === 'weapon' && item.energyCost >= 5) tags.add('empty')
  return tags
}

export function suggestedSynergyId(items, kind, random = Math.random, eligible = () => true) {
  const owned = new Set(items.map((item) => item.id))
  const ownedAttributes = new Set(items.filter((item) => item.type === 'weapon').map((item) => item.attribute).filter(Boolean))
  const wantsAttributeCoverage = items.some((item) => tagsOf(item).has('attributes'))
  const tags = new Map()
  for (const item of items) for (const tag of tagsOf(item)) tags.set(tag, (tags.get(tag) || 0) + 1)
  tags.set('attributes', (tags.get('attributes') || 0) + ownedAttributes.size)
  const candidates = ALL_ITEM_DEFS.filter((item) => !item.disabled && !item.starterOnly && !item.generatedOnly && !owned.has(item.id) && eligible(item.id) &&
    (item.type === 'relic' ? 'relic' : 'item') === kind)
    .map((item) => ({ id: item.id, score: [...tagsOf(item)].reduce((sum, tag) => sum + (tags.get(tag) || 0), 0) +
      Number(item.type === 'weapon' && item.attribute && wantsAttributeCoverage && !ownedAttributes.has(item.attribute)) * 2 }))
  const bestScore = Math.max(0, ...candidates.map((item) => item.score))
  if (bestScore === 0) return null
  const best = candidates.filter((item) => item.score === bestScore)
  return best[Math.floor(random() * best.length)]?.id || null
}

export function activeConduits(backpack) {
  return backpack.items.filter((item) => item.id === 'conduit' &&
    adjacentItems(backpack, item).some((neighbor) => neighbor.type === 'defense'))
}

export function conduitCapacity(backpack, weapon) {
  const conduits = activeConduits(backpack)
  if (conduits.some((wire) => adjacentItems(backpack, wire).some((item) => item.uid === weapon.uid))) return 3
  return 0
}

export function forkBridgeActive(backpack, weapon) {
  return backpack.items.some((item) => item.id === 'fork-connector' &&
    adjacentItems(backpack, item).some((neighbor) => neighbor.type === 'defense') &&
    adjacentItems(backpack, item).some((neighbor) => neighbor.uid === weapon.uid))
}
