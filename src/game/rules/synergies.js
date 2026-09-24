import { ALL_ITEM_DEFS } from '../data/content.js'
import { adjacentItems } from './backpack-geometry.js'

// These tags affect only reward suggestions. They never activate an item effect.
const HINTS = Object.freeze({
  'silver-guard': ['armor'], 'wood-shield': ['armor'], conduit: ['armor'], 'shield-core': ['armor'],
  'wall-sword': ['armor'], 'r-guard-return': ['armor'], 'iron-powder': ['armor'],
  'return-axe': ['switch'], spring: ['switch'], 'r-relay-badge': ['switch'],
  'tide-blade': ['switch', 'movement'], 'r-traveler': ['switch', 'movement'],
  'triad-ember': ['attributes'], 'triad-wither': ['attributes'], 'triad-tide': ['attributes'],
  'r-phase-pointer': ['attributes'], 'r-three': ['attributes'],
  'coin-blade': ['gold'], 'r-money-scale': ['gold'], 'r-trade-voucher': ['gold'],
  'r-gold-hook': ['gold'], 'r-ledger': ['gold'],
  'mountain-maul': ['empty'], 'r-empty': ['empty'], 'r-scales': ['empty'], 'r-heavy-wrist': ['empty'],
  'r-step-boots': ['movement'], 'r-turn-shield': ['movement'], 'ash-bow': ['movement'],
  'eagle-bow': ['range'], scope: ['range'], 'range-disc': ['range'], 'steady-clip': ['range'],
  'soul-spear': ['collision'], chain: ['collision'], 'bone-nail': ['collision'], 'ember-spear': ['collision'],
  'erosion-knife': ['poison'], 'venom-sac': ['poison'], 'r-poison-hourglass': ['poison'],
  'toxin-vial': ['poison'], 'vine-armor': ['poison'],
})

function tagsOf(item) {
  const tags = new Set(HINTS[item.id] || [])
  if (item.weaponClass === 'bow') tags.add('range')
  if (item.weaponClass === 'polearm') tags.add('collision')
  if (item.weaponClass === 'heavy') tags.add('empty')
  return tags
}

export function suggestedSynergyId(items, kind, random = Math.random, eligible = () => true) {
  const owned = new Set(items.map((item) => item.id))
  const tags = new Map()
  for (const item of items) for (const tag of tagsOf(item)) tags.set(tag, (tags.get(tag) || 0) + 1)
  const candidates = ALL_ITEM_DEFS.filter((item) => !owned.has(item.id) && eligible(item.id) &&
    (item.type === 'relic' ? 'relic' : 'item') === kind)
    .map((item) => ({ id: item.id, score: [...tagsOf(item)].reduce((sum, tag) => sum + (tags.get(tag) || 0), 0) }))
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
  const fork = backpack.items.some((item) => item.id === 'fork-connector' &&
    adjacentItems(backpack, item).some((neighbor) => conduits.some((wire) => wire.uid === neighbor.uid)) &&
    adjacentItems(backpack, item).some((neighbor) => neighbor.uid === weapon.uid))
  return fork ? 1 : 0
}
