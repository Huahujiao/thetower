import rustSword from '../assets/inventory/weapon-rust-sword-v2.png'
import boneKnife from '../assets/inventory/weapon-bone-knife-v1.png'
import emberSpear from '../assets/inventory/weapon-ember-spear-v1.png'
import rootAxe from '../assets/inventory/weapon-root-axe-v1.png'
import mountainMaul from '../assets/inventory/weapon-mountain-maul-v1.png'
import woodShield from '../assets/inventory/defense-wood-shield-v1.png'

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
