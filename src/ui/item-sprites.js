/* global URL */
// Keep every URL literal so Vite fingerprints and copies each resolution.
// The HUD starts with the small image, then upgrades to medium and full size
// after the browser has decoded each next stage.
const ITEM_SPRITE_SOURCES = Object.freeze({
  'rust-sword': {
    small: new URL('../assets/inventory/weapon-rust-sword-v2-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-rust-sword-v2-medium.png', import.meta.url).href,
    high: new URL('../assets/inventory/weapon-rust-sword-v2.png', import.meta.url).href,
  },
  'bone-knife': {
    small: new URL('../assets/inventory/weapon-bone-knife-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-bone-knife-v1-medium.png', import.meta.url).href,
    high: new URL('../assets/inventory/weapon-bone-knife-v1.png', import.meta.url).href,
  },
  'ember-spear': {
    small: new URL('../assets/inventory/weapon-ember-spear-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-ember-spear-v1-medium.png', import.meta.url).href,
    high: new URL('../assets/inventory/weapon-ember-spear-v1.png', import.meta.url).href,
  },
  'root-axe': {
    small: new URL('../assets/inventory/weapon-root-axe-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-root-axe-v1-medium.png', import.meta.url).href,
    high: new URL('../assets/inventory/weapon-root-axe-v1.png', import.meta.url).href,
  },
  'rock-maul': {
    small: new URL('../assets/inventory/weapon-rock-maul-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-rock-maul-v1-medium.png', import.meta.url).href,
    high: new URL('../assets/inventory/weapon-rock-maul-v1.png', import.meta.url).href,
  },
  'bell-maul': {
    small: new URL('../assets/inventory/weapon-bell-maul-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-bell-maul-v1-medium.png', import.meta.url).href,
    high: new URL('../assets/inventory/weapon-bell-maul-v1.png', import.meta.url).href,
  },
  'wall-sword': {
    small: new URL('../assets/inventory/weapon-wall-sword-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-wall-sword-v1-medium.png', import.meta.url).href,
    high: new URL('../assets/inventory/weapon-wall-sword-v1.png', import.meta.url).href,
  },
  'return-axe': {
    small: new URL('../assets/inventory/weapon-return-axe-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-return-axe-v1-medium.png', import.meta.url).href,
    high: new URL('../assets/inventory/weapon-return-axe-v1.png', import.meta.url).href,
  },
  'mountain-maul': {
    small: new URL('../assets/inventory/weapon-mountain-maul-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-mountain-maul-v1-medium.png', import.meta.url).href,
    high: new URL('../assets/inventory/weapon-mountain-maul-v1.png', import.meta.url).href,
  },
  'silver-guard': {
    small: new URL('../assets/inventory/weapon-silver-guard-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-silver-guard-v1-medium.png', import.meta.url).href,
    high: new URL('../assets/inventory/weapon-silver-guard-v1.png', import.meta.url).href,
  },
  'ember-axe': {
    small: new URL('../assets/inventory/weapon-ember-axe-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-ember-axe-v1-medium.png', import.meta.url).href,
    high: new URL('../assets/inventory/weapon-ember-axe-v1.png', import.meta.url).href,
  },
  'tide-blade': {
    small: new URL('../assets/inventory/weapon-tide-blade-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-tide-blade-v1-medium.png', import.meta.url).href,
    high: new URL('../assets/inventory/weapon-tide-blade-v1.png', import.meta.url).href,
  },
  'thorn-spear': {
    small: new URL('../assets/inventory/weapon-thorn-spear-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-thorn-spear-v1-medium.png', import.meta.url).href,
    high: new URL('../assets/inventory/weapon-thorn-spear-v1.png', import.meta.url).href,
  },
  'wood-bow': {
    small: new URL('../assets/inventory/weapon-wood-bow-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-wood-bow-v1-medium.png', import.meta.url).href,
    high: new URL('../assets/inventory/weapon-wood-bow-v1.png', import.meta.url).href,
  },
  'ash-bow': {
    small: new URL('../assets/inventory/weapon-ash-bow-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-ash-bow-v1-medium.png', import.meta.url).href,
    high: new URL('../assets/inventory/weapon-ash-bow-v1.png', import.meta.url).href,
  },
  'wood-shield': {
    small: new URL('../assets/inventory/defense-wood-shield-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-wood-shield-v1-medium.png', import.meta.url).href,
    high: new URL('../assets/inventory/defense-wood-shield-v1.png', import.meta.url).href,
  },
  'health-potion': {
    small: new URL('../assets/inventory/item-health-potion-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-health-potion-v1-medium.png', import.meta.url).href,
    high: new URL('../assets/inventory/item-health-potion-v1.png', import.meta.url).href,
  },
  'iron-powder': {
    small: new URL('../assets/inventory/item-iron-powder-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-iron-powder-v1-medium.png', import.meta.url).href,
    high: new URL('../assets/inventory/item-iron-powder-v1.png', import.meta.url).href,
  },
  'energy-potion': {
    small: new URL('../assets/inventory/item-energy-potion-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-energy-potion-v1-medium.png', import.meta.url).href,
    high: new URL('../assets/inventory/item-energy-potion-v1.png', import.meta.url).href,
  },
  cleanse: {
    small: new URL('../assets/inventory/item-cleanse-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-cleanse-v1-medium.png', import.meta.url).href,
    high: new URL('../assets/inventory/item-cleanse-v1.png', import.meta.url).href,
  },
  'rage-wine': {
    small: new URL('../assets/inventory/item-rage-wine-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-rage-wine-v1-medium.png', import.meta.url).href,
    high: new URL('../assets/inventory/item-rage-wine-v1.png', import.meta.url).href,
  },
  teleport: {
    small: new URL('../assets/inventory/item-teleport-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-teleport-v1-medium.png', import.meta.url).href,
    high: new URL('../assets/inventory/item-teleport-v1.png', import.meta.url).href,
  },
})

export function itemSpriteSources(item) {
  return item?.id ? ITEM_SPRITE_SOURCES[item.id] || null : null
}

export function itemSpriteUrl(item) {
  return itemSpriteSources(item)?.high || ''
}
