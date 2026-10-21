export const SPIRIT_FIRE_NAMES = Object.freeze({ scorch: '赤色灵火', wither: '黄色灵火', drown: '蓝色灵火', wild: '万能灵火' })
export const FIRE_ENCHANTMENTS = Object.freeze([
  { id: 'sharp', name: '锋利', mark: '锋', trigger: '攻击消耗时', description: '本次攻击的攻击力+3。' },
  { id: 'amplify', name: '增幅', mark: '增', trigger: '攻击消耗时', description: '本次攻击伤害倍率+0.2。' },
  { id: 'berserk', name: '狂暴', mark: '狂', trigger: '攻击消耗时', description: '本次攻击伤害×2，但有25%概率永久销毁此灵火。' },
  { id: 'greed', name: '贪财', mark: '财', trigger: '攻击消耗时', description: '获得2金币。' },
  { id: 'bulwark', name: '铁壁', mark: '壁', trigger: '攻击消耗时', description: '获得2点护甲。' },
  { id: 'temper', name: '淬炼', mark: '炼', trigger: '攻击消耗时', description: '本次使用的武器永久+1攻击力。' },
  { id: 'rekindle', name: '回火', mark: '回', trigger: '攻击消耗时', description: '50%概率返还自身；每次成功返还后，本回合此灵火的返还概率降低10个百分点，最低0%；每回合开始重置为50%。' },
  { id: 'leech', name: '吸血', mark: '吸', trigger: '攻击消耗时', description: '本次攻击造成生命伤害时恢复1点生命。' },
  { id: 'flame-step', name: '踏焰', mark: '踏', trigger: '移动消耗时', description: '移动后，对所在格八邻域的已激活敌人各造成2点伤害。' },
  { id: 'light-foot', name: '轻盈', mark: '轻', trigger: '移动消耗时', description: '获得2点护甲。' },
  { id: 'explore', name: '探索', mark: '探', trigger: '翻牌消耗时', description: '获得1金币。' },
  { id: 'economy', name: '节约', mark: '节', trigger: '翻牌或拾取消耗时', description: '有30%概率返还自身。' },
  { id: 'retain', name: '留存', mark: '留', trigger: '回合结束仍未消耗时', description: '保留到下一回合，并正常抽取下一回合的灵火。' },
  { id: 'guardian', name: '守护', mark: '护', trigger: '回合结束仍未消耗时', description: '获得2点护甲。' },
  { id: 'fuel', name: '助燃', mark: '燃', trigger: '攻击时未消耗', description: '为本次攻击提供+1攻击力。' },
  { id: 'resonance', name: '共鸣', mark: '鸣', trigger: '攻击时未消耗', description: '若本次攻击消耗了同色灵火，本次攻击伤害倍率+0.1；万能灵火仅与万能灵火视为同色。' },
  { id: 'stance', name: '守势', mark: '势', trigger: '攻击时未消耗', description: '获得1点护甲。' },
  { id: 'gather', name: '聚财', mark: '聚', trigger: '攻击时未消耗', description: '若本次攻击击杀敌人，获得1金币。' },
].map(Object.freeze))
export function fireEnchantment(id) { return FIRE_ENCHANTMENTS.find(effect => effect.id === id) || null }
export function spiritFireName(ball) { return SPIRIT_FIRE_NAMES[ball.attribute] || '灵火' }
export function spiritFireMark(ball) { return fireEnchantment(ball.enchantment)?.mark || ball.mark || '' }
export function rekindleChance(ball) { return Math.max(0, 50 - (ball.rekindleReturns || 0) * 10) / 100 }
export function spiritFireDescription(ball) {
  const effect = fireEnchantment(ball.enchantment)
  return effect ? effect.trigger + '：' + effect.description + (effect.id === 'rekindle' ? ' 当前返还概率：' + Math.round(rekindleChance(ball) * 100) + '%。' : '') : '尚未附魔。每颗灵火只能拥有一种附魔，再次附魔会替换当前效果。'
}
