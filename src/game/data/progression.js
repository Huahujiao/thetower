import { ATTRIBUTE_ORDER, attributeLabel } from './attributes.js'

export const PROGRESSION = Object.freeze({
  startingLevel: 1,
  baseExperienceToLevel: 8,
  experienceStep: 2,
  levelChoiceCount: 3,
  emergencySupply: Object.freeze({ gold: 3, heal: 3 }),
})

export const LEVEL_UP_OPTIONS = Object.freeze([
  Object.freeze({ id: 'vitality', name: '\u4f53\u9b44', description: '\u6700\u5927\u751f\u547d +2\uff0c\u5e76\u6062\u590d 2 \u70b9\u751f\u547d\u3002' }),
  Object.freeze({ id: 'left-strength', name: '\u5de6\u624b\u529b\u91cf', description: '\u5de6\u624b\u6b66\u5668\u653b\u51fb +1\u3002' }),
  Object.freeze({ id: 'right-strength', name: '\u53f3\u624b\u529b\u91cf', description: '\u53f3\u624b\u6b66\u5668\u653b\u51fb +1\u3002' }),
  Object.freeze({ id: 'left-mastery', name: '\u5de6\u624b\u638c\u63a7', description: '\u5de6\u624b\u6b66\u5668\u6709\u51e0\u7387\u4e0d\u6d88\u8017\u8010\u4e45\u3002' }),
  Object.freeze({ id: 'right-mastery', name: '\u53f3\u624b\u638c\u63a7', description: '\u53f3\u624b\u6b66\u5668\u6709\u51e0\u7387\u4e0d\u6d88\u8017\u8010\u4e45\u3002' }),
  Object.freeze({ id: 'left-adaptation', name: '\u5de6\u624b\u5c5e\u6027\u9002\u5e94', description: '\u4e3a\u5de6\u624b\u9009\u62e9\u4e00\u79cd\u9002\u5e94\u5c5e\u6027\u3002' }),
  Object.freeze({ id: 'right-adaptation', name: '\u53f3\u624b\u5c5e\u6027\u9002\u5e94', description: '\u4e3a\u53f3\u624b\u9009\u62e9\u4e00\u79cd\u9002\u5e94\u5c5e\u6027\u3002' }),
  Object.freeze({ id: 'emergency-supply', name: '\u5e94\u6025\u8865\u7ed9', description: '\u83b7\u5f97 3 \u91d1\u5e01\u5e76\u6062\u590d 3 \u70b9\u751f\u547d\uff0c\u653e\u5f03\u6c38\u4e45\u6210\u957f\u3002' }),
])

const OPTION_BY_ID = new Map(LEVEL_UP_OPTIONS.map((option) => [option.id, option]))

export function experienceToNextLevel(level) {
  const normalized = Math.max(PROGRESSION.startingLevel, Number(level) || PROGRESSION.startingLevel)
  return PROGRESSION.baseExperienceToLevel + (normalized - PROGRESSION.startingLevel) * PROGRESSION.experienceStep
}

export function masteryPreservationChance(level) {
  const normalized = Math.max(0, Number(level) || 0)
  return normalized / (normalized + 10)
}

export function getLevelUpOption(id) { return OPTION_BY_ID.get(id) || null }

export function buildLevelUpChoices(player, { count = PROGRESSION.levelChoiceCount, random = Math.random } = {}) {
  const unavailable = new Set()
  if (player?.adaptations?.[0]) unavailable.add('left-adaptation')
  if (player?.adaptations?.[1]) unavailable.add('right-adaptation')
  const pool = LEVEL_UP_OPTIONS.filter((option) => !unavailable.has(option.id))
  for (let index = pool.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]]
  }
  return pool.slice(0, Math.min(count, pool.length)).map((option) => option.id)
}

export function adaptationChoices() {
  return ATTRIBUTE_ORDER.map((attribute) => ({
    id: attribute,
    name: attributeLabel(attribute),
    description: `\u4f7f\u7528${attributeLabel(attribute)}\u6b66\u5668\u65f6\uff0c\u514b\u5236\u00d71.8\uff0c\u53d7\u5236\u00d70.8\u3002`,
  }))
}
