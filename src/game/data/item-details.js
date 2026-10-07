import { attributeLabel } from './attributes.js'
import { weaponTier } from './content.js'

export const DETAIL_LABELS = Object.freeze({
  weapon: '\u6b66\u5668',
  pet: '\u5ba0\u7269',
  potion: '\u836f\u5242',
  armor: '\u62a4\u7532',
  defense: '防具', material: '合成材料', teleport: '飞身符',
  throwable: '\u6295\u63b7\u6d88\u8017\u54c1', 'money-pouch': '\u94b1\u888b',
  buff: '\u589e\u76ca',
  relic: '\u5723\u9057\u7269',
  enemy: '\u654c\u4eba',
  trap: '\u9677\u9631',
  resource: '\u8d44\u6e90',
  key: '\u5f00\u95e8\u673a\u5173',
  merchant: '\u5546\u4eba',
  attack: '\u653b\u51fb',
  level: '\u7b49\u7ea7',
  range: '\u5c04\u7a0b',
  health: '\u751f\u547d',
  energy: '\u4f53\u529b',
  armorValue: '\u62a4\u7532',
  nextAttack: '\u4e0b\u6b21\u653b\u51fb',
  attribute: '\u5c5e\u6027',
  actionDelay: '\u884c\u52a8\u5ef6\u8fdf',
  cooldown: '\u51b7\u5374',
  normalAttack: '\u666e\u901a\u653b\u51fb',
  normalAttackCooldown: '\u666e\u653b\u51b7\u5374',
  speed: '\u901f\u5ea6',
  features: '\u7279\u6027',
  explosion: '\u89e6\u53d1\u540e\u5bf9\u516b\u90bb\u57df\u9020\u6210\u4f24\u5bb3\u3002',
  alarm: '\u89e6\u53d1\u540e\u7ffb\u5f00\u9644\u8fd1\u7684\u724c\u3002',
  keyHint: '\u62fe\u53d6\u540e\u4f1a\u6c38\u4e45\u5f00\u542f\u5bf9\u5e94\u7684\u623f\u95f4\u95e8\u3002',
})

const DEFENSE_CLASS_LABELS = Object.freeze({ shield: '\u76fe\u724c', armor: '\u62a4\u7532' })

function defenseClassLabel(value) { return DEFENSE_CLASS_LABELS[value] || DEFENSE_CLASS_LABELS.armor }
function itemTier(item) {
  const fallback = item?.type === 'weapon' ? weaponTier(item) : 1
  return Math.max(1, Math.min(3, Math.floor(Number(item?.tier) || fallback)))
}
function itemTierStars(item) { return '\u2605'.repeat(itemTier(item)) }

function weaponAttackRange(weapon) { return Math.max(1, Number(weapon?.range) || 1) }

function weaponEnergyCost(weapon) {
  return Math.max(1, Math.floor(Number(weapon?.energyCost) || 3))
}

export function detailForItem(item, player = null) {
  const type = DETAIL_LABELS[item?.type] || '\u7269\u54c1'
  const statLines = []
  const effectLines = []
  const badges = []
  let energyCost = null
  let energyAttribute = 'wild'
  if (item?.type === 'weapon') {
    if (item.attribute) badges.push(attributeLabel(item.attribute))
    badges.push(itemTierStars(item))
    statLines.push(`\u2694 ${item.attack || 0}`)
    statLines.push(`\u{1F3F9} ${weaponAttackRange(item, player)}`)
    energyCost = weaponEnergyCost(item)
    energyAttribute = item.attribute || 'wild'
  } else if (item?.type === 'pet') {
    statLines.push(`\u2694 ${item.attack}`, `\u5c04\u7a0b ${item.range}`)
    energyCost = item.ballCost
  } else if (item?.type === 'defense') {
    badges.push(defenseClassLabel(item.defenseClass), itemTierStars(item))
    statLines.push(`\u62a4\u7532 ${item.armorValue || 1}`)
    effectLines.push('\u9996\u6b21\u8fdb\u5165\u65b0\u623f\u95f4\u65f6\u83b7\u5f97\u8be5\u62a4\u7532\u503c\u3002')
  } else if (item?.type === 'money-pouch') {
    statLines.push(`\u91d1\u5e01 ${player?.gold || 0}`)
  } else if (item?.type === 'throwable') {
    badges.push(itemTierStars(item))
    statLines.push(`\u6295\u63b7\u8303\u56f4 ${item.range || 4}`)
    if (item.damage) statLines.push(`\u4f24\u5bb3 ${item.damage}`)
    if (item.effect === 'shield-bash') statLines.push(`当前伤害 ${player?.armor || 0}；消耗护甲 ${Math.ceil((player?.armor || 0) / 2)}`)
  } else if (item?.type === 'potion') {
    effectLines.push(`${DETAIL_LABELS.health} +${item.heal || 0}`)
  } else if (item?.type === 'armor') {
    effectLines.push(`${DETAIL_LABELS.armorValue} +${item.armor || 0}`)
  } else if (item?.type === 'buff') {
    const target = item.attackTarget === 'melee' ? '\u4e0b\u6b21\u8fd1\u6218\u653b\u51fb' : DETAIL_LABELS.nextAttack
    effectLines.push(`${target} +${item.attackBonus || 0}`)
  }
  if (item?.tier && !['weapon', 'defense', 'throwable'].includes(item.type)) badges.push(itemTierStars(item))
  const description = item?.type === 'pet' && item.description === '无特殊效果。' ? '' : item?.description || ''
  return {
    title: item?.name || type,
    type,
    icon: item?.type || 'item',
    itemId: item?.id || item?.relicId || null,
    badges,
    energyCost,
    energyAttribute,
    statLines,
    effectLines,
    lines: [...statLines, ...effectLines],
    description,
  }
}
