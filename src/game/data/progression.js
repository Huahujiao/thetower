import { FIRE_ENCHANTMENTS, SPIRIT_FIRE_NAMES } from './spirit-fire.js'

const ENCHANTMENT_REWARD_TRIGGERS = Object.freeze({
  '攻击消耗时': '使用此灵火攻击时',
  '移动消耗时': '使用此灵火移动时',
  '翻牌消耗时': '使用此灵火翻牌时',
  '翻牌或拾取消耗时': '使用此灵火翻牌或拾取时',
  '回合结束仍未消耗时': '回合结束时此灵火未被消耗',
  '攻击时未消耗': '攻击时此灵火未被消耗',
})

export const PROGRESSION = Object.freeze({ startingLevel: 1, baseExperienceToLevel: 8, experienceStep: 2, levelChoiceCount: 4 })
export const LEVEL_UP_OPTIONS = Object.freeze([
  ...['wild', 'scorch', 'wither', 'drown'].map(attribute => ({ id: attribute + '-fire', kind: 'add', attribute, name: SPIRIT_FIRE_NAMES[attribute], description: '获得1颗' + SPIRIT_FIRE_NAMES[attribute] + '。' })),
  { id: 'purify', kind: 'remove', name: '净化', description: '永久删除1颗灵火。' },
  ...['scorch', 'drown', 'wither', 'wild'].map(attribute => ({ id: 'convert-' + attribute, kind: 'convert', attribute, name: { scorch: '红色转换', drown: '蓝色转换', wither: '黄色转换', wild: '万能转换' }[attribute], description: '将1颗灵火转换为' + SPIRIT_FIRE_NAMES[attribute] + '，保留附魔。' })),
  ...FIRE_ENCHANTMENTS.map(effect => ({
    id: 'enchant-' + effect.id, kind: 'enchant', enchantment: effect.id, name: effect.name,
    description: '为一枚灵火附加「' + effect.name + '」',
    effectDescription: effect.name + '：' + ENCHANTMENT_REWARD_TRIGGERS[effect.trigger] + '，' + effect.description,
  })),
].map(Object.freeze))
export function buildLevelUpChoices({ count = PROGRESSION.levelChoiceCount, random = Math.random } = {}) {
  const pool = LEVEL_UP_OPTIONS.map(option => option.id)
  for (let index = pool.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]]
  }
  return pool.slice(0, Math.max(0, count))
}
export function experienceToNextLevel(level) {
  const normalized = Math.max(PROGRESSION.startingLevel, Number(level) || PROGRESSION.startingLevel)
  return PROGRESSION.baseExperienceToLevel + (normalized - PROGRESSION.startingLevel) * PROGRESSION.experienceStep
}
export function getLevelUpOption(id) { return LEVEL_UP_OPTIONS.find(option => option.id === id) || null }
