export const TOTEM_SUMMON_RANGE = 4
export const TOTEM_DURATION = 10
export const TOTEM_COOLDOWN = 2

export const TOTEM_BADGES = Object.freeze([
  { id: 'r-totem-drum', totemId: 'drum', name: '战鼓图腾', glyph: '鼓', color: '#e9a555', description: '玩家在图腾2格内，每有一个背包中的图腾徽章，攻击力+2。' },
  { id: 'r-totem-ward', totemId: 'ward', name: '护身图腾', glyph: '护', color: '#80b5e4', description: '玩家在图腾2格内，每回合第一次受击伤害-2。' },
  { id: 'r-totem-breath', totemId: 'breath', name: '回气图腾', glyph: '气', color: '#8cdaba', description: '玩家在图腾2格内移动时，额外恢复1点体力。' },
  { id: 'r-totem-spirit', totemId: 'spirit', name: '探灵图腾', glyph: '灵', color: '#b0b4f0', description: '图腾3格内敌人死亡时，随机翻开其8邻域内一张未翻开的牌。' },
  { id: 'r-totem-bind', totemId: 'bind', name: '地缚图腾', glyph: '缚', color: '#ba9b6f', description: '敌人经过图腾的4邻域时，被缠绕一回合。' },
  { id: 'r-totem-gas', totemId: 'gas', name: '毒气图腾', glyph: '毒', color: '#acd265', description: '使图腾2格内的敌人中毒，已中毒的敌人不受影响。' },
  { id: 'r-totem-soul', totemId: 'soul', name: '招魂图腾', glyph: '魂', color: '#d18fd5', description: '每2回合将范围内敌人拉近1格，按距离从近到远判定；与路径下一格的卡牌换位，8邻域敌人会攻击并占据图腾格。范围初始为1，每个背包中的其他图腾徽章使范围+1。' },
].map(definition => Object.freeze({ ...definition, attribute: null, summonRange: TOTEM_SUMMON_RANGE })))

const BY_BADGE = new Map(TOTEM_BADGES.map(definition => [definition.id, definition]))
const BY_TOTEM = new Map(TOTEM_BADGES.map(definition => [definition.totemId, definition]))
export function getTotemDefinition(id) { return BY_TOTEM.get(id) || null }
export function isTotemBadge(item) { return item?.type === 'relic' && BY_BADGE.has(item.id) }
