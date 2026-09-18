/* global URL */
// Keep these as literal `new URL` expressions so Vite fingerprints and copies the
// PNGs for production builds. Node-based item checks can still resolve the URL
// without importing the binary asset itself.
const rustSword = new URL('../assets/inventory/weapon-rust-sword-v2.png', import.meta.url).href
const boneKnife = new URL('../assets/inventory/weapon-bone-knife-v1.png', import.meta.url).href
const emberSpear = new URL('../assets/inventory/weapon-ember-spear-v1.png', import.meta.url).href
const rootAxe = new URL('../assets/inventory/weapon-root-axe-v1.png', import.meta.url).href
const mountainMaul = new URL('../assets/inventory/weapon-mountain-maul-v1.png', import.meta.url).href
const woodShield = new URL('../assets/inventory/defense-wood-shield-v1.png', import.meta.url).href

const ITEM_SPRITES = Object.freeze({
  'rust-sword': rustSword,
  'bone-knife': boneKnife,
  'ember-spear': emberSpear,
  'root-axe': rootAxe,
  'mountain-maul': mountainMaul,
  'wood-shield': woodShield,
})

export function itemSpriteUrl(item) {
  return item?.id ? ITEM_SPRITES[item.id] || '' : ''
}
