/* global URL */
// Keep these as literal `new URL` expressions so Vite fingerprints and copies the
// PNGs for production builds. Node-based item checks can still resolve the URL
// without importing the binary asset itself.
const rustSword = new URL('../assets/inventory/weapon-rust-sword-v2.png', import.meta.url).href
const boneKnife = new URL('../assets/inventory/weapon-bone-knife-v1.png', import.meta.url).href
const emberSpear = new URL('../assets/inventory/weapon-ember-spear-v1.png', import.meta.url).href
const rootAxe = new URL('../assets/inventory/weapon-root-axe-v1.png', import.meta.url).href
const mountainMaul = new URL('../assets/inventory/weapon-mountain-maul-v1.png', import.meta.url).href
const silverGuard = new URL('../assets/inventory/weapon-silver-guard-v1.png', import.meta.url).href
const emberAxe = new URL('../assets/inventory/weapon-ember-axe-v1.png', import.meta.url).href
const tideBlade = new URL('../assets/inventory/weapon-tide-blade-v1.png', import.meta.url).href
const thornSpear = new URL('../assets/inventory/weapon-thorn-spear-v1.png', import.meta.url).href
const woodBow = new URL('../assets/inventory/weapon-wood-bow-v1.png', import.meta.url).href
const ashBow = new URL('../assets/inventory/weapon-ash-bow-v1.png', import.meta.url).href
const woodShield = new URL('../assets/inventory/defense-wood-shield-v1.png', import.meta.url).href
const healthPotion = new URL('../assets/inventory/item-health-potion-v1.png', import.meta.url).href
const ironPowder = new URL('../assets/inventory/item-iron-powder-v1.png', import.meta.url).href
const energyPotion = new URL('../assets/inventory/item-energy-potion-v1.png', import.meta.url).href
const cleanse = new URL('../assets/inventory/item-cleanse-v1.png', import.meta.url).href
const rageWine = new URL('../assets/inventory/item-rage-wine-v1.png', import.meta.url).href
const teleport = new URL('../assets/inventory/item-teleport-v1.png', import.meta.url).href

const ITEM_SPRITES = Object.freeze({
  'rust-sword': rustSword,
  'bone-knife': boneKnife,
  'ember-spear': emberSpear,
  'root-axe': rootAxe,
  'mountain-maul': mountainMaul,
  'silver-guard': silverGuard,
  'ember-axe': emberAxe,
  'tide-blade': tideBlade,
  'thorn-spear': thornSpear,
  'wood-bow': woodBow,
  'ash-bow': ashBow,
  'wood-shield': woodShield,
  'health-potion': healthPotion,
  'iron-powder': ironPowder,
  'energy-potion': energyPotion,
  cleanse,
  'rage-wine': rageWine,
  teleport,
})

export function itemSpriteUrl(item) {
  return item?.id ? ITEM_SPRITES[item.id] || '' : ''
}
