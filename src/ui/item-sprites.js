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

export function itemSpriteSources(item) {
  return item?.id ? ITEM_SPRITE_SOURCES[item.id] || null : null
}

export function itemSpriteUrl(item) {
  return itemSpriteSources(item)?.medium || ''
}
