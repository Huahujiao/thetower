/* global URL */
// Keep every URL literal so Vite fingerprints and copies both runtime sizes.
// The HUD starts with the small image, then upgrades to medium after decoding.
const ITEM_SPRITE_SOURCES = Object.freeze({
  'rust-sword': {
    small: new URL('../assets/inventory/weapon-rust-sword-v2-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-rust-sword-v2-medium.png', import.meta.url).href,
  },
  'bone-knife': {
    small: new URL('../assets/inventory/weapon-bone-knife-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-bone-knife-v1-medium.png', import.meta.url).href,
  },
  'ember-spear': {
    small: new URL('../assets/inventory/weapon-ember-spear-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-ember-spear-v1-medium.png', import.meta.url).href,
  },
  'root-axe': {
    small: new URL('../assets/inventory/weapon-root-axe-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-root-axe-v1-medium.png', import.meta.url).href,
  },
  'rock-maul': {
    small: new URL('../assets/inventory/weapon-rock-maul-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-rock-maul-v1-medium.png', import.meta.url).href,
  },
  'bell-maul': {
    small: new URL('../assets/inventory/weapon-bell-maul-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-bell-maul-v1-medium.png', import.meta.url).href,
  },
  'wall-sword': {
    small: new URL('../assets/inventory/weapon-wall-sword-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-wall-sword-v1-medium.png', import.meta.url).href,
  },
  'return-axe': {
    small: new URL('../assets/inventory/weapon-return-axe-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-return-axe-v1-medium.png', import.meta.url).href,
  },
  'mountain-maul': {
    small: new URL('../assets/inventory/weapon-mountain-maul-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-mountain-maul-v1-medium.png', import.meta.url).href,
  },
  'silver-guard': {
    small: new URL('../assets/inventory/weapon-silver-guard-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-silver-guard-v1-medium.png', import.meta.url).href,
  },
  'ember-axe': {
    small: new URL('../assets/inventory/weapon-ember-axe-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-ember-axe-v1-medium.png', import.meta.url).href,
  },
  'tide-blade': {
    small: new URL('../assets/inventory/weapon-tide-blade-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-tide-blade-v1-medium.png', import.meta.url).href,
  },
  'erosion-knife': {
    small: new URL('../assets/inventory/weapon-erosion-knife-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-erosion-knife-v1-medium.png', import.meta.url).href,
  },
  'thorn-spear': {
    small: new URL('../assets/inventory/weapon-thorn-spear-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-thorn-spear-v1-medium.png', import.meta.url).href,
  },
  'soul-spear': {
    small: new URL('../assets/inventory/weapon-soul-spear-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-soul-spear-v1-medium.png', import.meta.url).href,
  },
  'wood-bow': {
    small: new URL('../assets/inventory/weapon-wood-bow-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-wood-bow-v1-medium.png', import.meta.url).href,
  },
  'ash-bow': {
    small: new URL('../assets/inventory/weapon-ash-bow-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-ash-bow-v1-medium.png', import.meta.url).href,
  },
  'eagle-bow': {
    small: new URL('../assets/inventory/weapon-eagle-bow-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-eagle-bow-v1-medium.png', import.meta.url).href,
  },
  'r-three': {
    small: new URL('../assets/inventory/relic-three-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-three-v1-medium.png', import.meta.url).href,
  },
  'r-empty': {
    small: new URL('../assets/inventory/relic-empty-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-empty-v1-medium.png', import.meta.url).href,
  },
  'r-reverse': {
    small: new URL('../assets/inventory/relic-reverse-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-reverse-v1-medium.png', import.meta.url).href,
  },
  'r-traveler': {
    small: new URL('../assets/inventory/relic-traveler-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-traveler-v1-medium.png', import.meta.url).href,
  },
  'r-blood': {
    small: new URL('../assets/inventory/relic-blood-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-blood-v1-medium.png', import.meta.url).href,
  },
  'r-scales': {
    small: new URL('../assets/inventory/relic-scales-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-scales-v1-medium.png', import.meta.url).href,
  },
  'r-heavy-wrist': {
    small: new URL('../assets/inventory/relic-heavy-wrist-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-heavy-wrist-v1-medium.png', import.meta.url).href,
  },
  'r-step-boots': {
    small: new URL('../assets/inventory/relic-step-boots-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-step-boots-v1-medium.png', import.meta.url).href,
  },
  'r-turn-shield': {
    small: new URL('../assets/inventory/relic-turn-shield-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-turn-shield-v1-medium.png', import.meta.url).href,
  },
  'r-poison-hourglass': {
    small: new URL('../assets/inventory/relic-poison-hourglass-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-poison-hourglass-v1-medium.png', import.meta.url).href,
  },
  'wood-shield': {
    small: new URL('../assets/inventory/defense-wood-shield-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-wood-shield-v1-medium.png', import.meta.url).href,
  },
  'thorn-shield': {
    small: new URL('../assets/inventory/defense-thorn-shield-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-thorn-shield-v1-medium.png', import.meta.url).href,
  },
  'tide-shield': {
    small: new URL('../assets/inventory/defense-tide-shield-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-tide-shield-v1-medium.png', import.meta.url).href,
  },
  'red-shield': {
    small: new URL('../assets/inventory/defense-red-shield-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-red-shield-v1-medium.png', import.meta.url).href,
  },
  'light-armor': {
    small: new URL('../assets/inventory/defense-light-armor-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-light-armor-v1-medium.png', import.meta.url).href,
  },
  'red-armor': {
    small: new URL('../assets/inventory/defense-red-armor-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-red-armor-v1-medium.png', import.meta.url).href,
  },
  'vine-armor': {
    small: new URL('../assets/inventory/defense-vine-armor-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-vine-armor-v1-medium.png', import.meta.url).href,
  },
  'tide-cloak': {
    small: new URL('../assets/inventory/defense-tide-cloak-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-tide-cloak-v1-medium.png', import.meta.url).href,
  },
  'shield-core': {
    small: new URL('../assets/inventory/material-shield-core-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-shield-core-v1-medium.png', import.meta.url).href,
  },
  spring: {
    small: new URL('../assets/inventory/material-spring-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-spring-v1-medium.png', import.meta.url).href,
  },
  'venom-sac': {
    small: new URL('../assets/inventory/material-venom-sac-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-venom-sac-v1-medium.png', import.meta.url).href,
  },
  chain: {
    small: new URL('../assets/inventory/material-chain-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-chain-v1-medium.png', import.meta.url).href,
  },
  scope: {
    small: new URL('../assets/inventory/material-scope-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-scope-v1-medium.png', import.meta.url).href,
  },
  weight: {
    small: new URL('../assets/inventory/material-weight-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-weight-v1-medium.png', import.meta.url).href,
  },
  'range-disc': {
    small: new URL('../assets/inventory/material-range-disc-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-range-disc-v1-medium.png', import.meta.url).href,
  },
  'steady-clip': {
    small: new URL('../assets/inventory/material-steady-clip-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-steady-clip-v1-medium.png', import.meta.url).href,
  },
  'bone-nail': {
    small: new URL('../assets/inventory/material-bone-nail-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-bone-nail-v1-medium.png', import.meta.url).href,
  },
  'toxin-vial': {
    small: new URL('../assets/inventory/material-toxin-vial-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-toxin-vial-v1-medium.png', import.meta.url).href,
  },
  'health-potion': {
    small: new URL('../assets/inventory/item-health-potion-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-health-potion-v1-medium.png', import.meta.url).href,
  },
  'iron-powder': {
    small: new URL('../assets/inventory/item-iron-powder-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-iron-powder-v1-medium.png', import.meta.url).href,
  },
  'energy-potion': {
    small: new URL('../assets/inventory/item-energy-potion-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-energy-potion-v1-medium.png', import.meta.url).href,
  },
  cleanse: {
    small: new URL('../assets/inventory/item-cleanse-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-cleanse-v1-medium.png', import.meta.url).href,
  },
  'rage-wine': {
    small: new URL('../assets/inventory/item-rage-wine-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-rage-wine-v1-medium.png', import.meta.url).href,
  },
  teleport: {
    small: new URL('../assets/inventory/item-teleport-talisman-v2-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-teleport-talisman-v2-medium.png', import.meta.url).href,
  },
})

// Temporary symbols for the first build batch. They use one compact SVG each
// until shape-matched inventory illustrations are commissioned.
const BUILD_PLACEHOLDERS = Object.freeze({
  'triad-ember': ['烬', '#d77b54'],
  'triad-wither': ['腐', '#98ba70'],
  'triad-tide': ['潮', '#69aacb'],
  'coin-blade': ['币', '#d8b45b'],
  conduit: ['导', '#8cb8cb'],
  'fork-connector': ['叉', '#8cb8cb'],
  'r-relay-badge': ['接', '#c69a67'],
  'r-guard-return': ['甲', '#8eaec5'],
  'r-phase-pointer': ['相', '#b09cd0'],
  'r-money-scale': ['秤', '#d8b45b'],
  'r-trade-voucher': ['券', '#d8b45b'],
  'r-gold-hook': ['钩', '#d8b45b'],
  'r-ledger': ['账', '#d8b45b'],
})

const BUILD_SPRITE_SOURCES = Object.freeze(Object.fromEntries(Object.entries(BUILD_PLACEHOLDERS).map(([id, [glyph, color]]) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect x="9" y="9" width="110" height="110" rx="22" fill="#101924" fill-opacity=".9" stroke="${color}" stroke-width="5"/><path d="M25 102H103" stroke="${color}" stroke-width="3" opacity=".6"/><text x="64" y="83" text-anchor="middle" font-family="sans-serif" font-size="61" font-weight="700" fill="${color}">${glyph}</text></svg>`
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  return [id, { small: url, medium: url }]
})))

// Gold is a room-floor entity rather than an inventory item.  Keep its
// quantity-specific artwork in its own map so it cannot be confused with an
// item id or accidentally enter the backpack sprite contract.
const GOLD_SPRITE_SOURCES = Object.freeze({
  3: {
    small: new URL('../assets/inventory/gold-pile-3-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/gold-pile-3-v1-medium.png', import.meta.url).href,
  },
  4: {
    small: new URL('../assets/inventory/gold-pile-4-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/gold-pile-4-v1-medium.png', import.meta.url).href,
  },
  5: {
    small: new URL('../assets/inventory/gold-pile-5-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/gold-pile-5-v1-medium.png', import.meta.url).href,
  },
  6: {
    small: new URL('../assets/inventory/gold-pile-6-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/gold-pile-6-v1-medium.png', import.meta.url).href,
  },
  7: {
    small: new URL('../assets/inventory/gold-pile-7-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/gold-pile-7-v1-medium.png', import.meta.url).href,
  },
})

export function itemSpriteSources(item) {
  return item?.id ? ITEM_SPRITE_SOURCES[item.id] || BUILD_SPRITE_SOURCES[item.id] || null : null
}

export function goldSpriteSources(amount) {
  return GOLD_SPRITE_SOURCES[amount] || null
}

export function itemSpriteUrl(item) {
  return itemSpriteSources(item)?.medium || ''
}
