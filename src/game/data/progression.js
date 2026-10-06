export const PROGRESSION = Object.freeze({
  startingLevel: 1,
  baseExperienceToLevel: 8,
  experienceStep: 2,
  levelChoiceCount: 3,
})

export const LEVEL_UP_OPTIONS = Object.freeze([
  { id: 'heal', name: '\u56de\u590d5\u70b9\u751f\u547d', description: '\u7acb\u5373\u56de\u590d5\u70b9\u751f\u547d\uff0c\u4e0d\u8d85\u8fc7\u751f\u547d\u4e0a\u9650\u3002' },
  { id: 'max-health', name: '\u6700\u5927\u751f\u547d+2', description: '\u6c38\u4e45\u589e\u52a02\u70b9\u751f\u547d\u4e0a\u9650\uff0c\u4e0d\u56de\u590d\u5f53\u524d\u751f\u547d\u3002' },
  { id: 'wild-ball', name: '万能球+1', description: '向球池永久加入1个万能球，进入弃球堆，不立即增加手中球。' },
  { id: 'relic', name: '\u83b7\u5f97\u5723\u9057\u7269', description: '\u4ece\u968f\u673a3\u4e2a\u672a\u62e5\u6709\u7684\u5723\u9057\u7269\u4e2d\u9009\u62e91\u4e2a\u3002' },
  { id: 'weapon-upgrade', name: '\u6b66\u5668\u5f3a\u5316', description: '\u9009\u62e9\u80cc\u5305\u4e2d\u76841\u628a\u6b66\u5668\uff0c\u8be5\u6b66\u5668\u57fa\u7840\u653b\u51fb\u529b+1\uff1b\u5408\u6210\u540e\u4e0d\u7ee7\u627f\u3002' },
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

export function getLevelUpOption(id) {
  return LEVEL_UP_OPTIONS.find(option => option.id === id) || null
}
