import { DAMAGE_STAGES, damageModifier } from '../rules/modifiers.js'

export const RELIC_DEFS = Object.freeze([
  {
    id: 'r-last-edge',
    name: '\u7834\u5203\u4f59\u70ec',
    description: '\u6b66\u5668\u53ea\u5269 1 \u70b9\u8010\u4e45\u65f6\uff0c\u653b\u51fb +3\u3002',
    damageModifiers: ({ weapon }) => weapon?.durability === 1
      ? [damageModifier(DAMAGE_STAGES.FLAT, 3, 'relic:last-edge')]
      : [],
  },
  {
    id: 'r-hunter-mark',
    name: '\u730e\u624b\u5370\u8bb0',
    description: '\u89e6\u53d1\u6b66\u5668\u514b\u5236\u65f6\uff0c\u6700\u7ec8\u4f24\u5bb3\u00d71.25\u3002',
    damageModifiers: ({ countered }) => countered
      ? [damageModifier(DAMAGE_STAGES.MULTIPLY, 1.25, 'relic:hunter-mark')]
      : [],
  },
  {
    id: 'r-desperate-force',
    name: '\u80cc\u6c34\u4e4b\u529b',
    description: '\u751f\u547d\u4e0d\u9ad8\u4e8e\u4e00\u534a\u65f6\uff0c\u653b\u51fb +2\u3002',
    damageModifiers: ({ player }) => player && player.hp <= player.maxHp / 2
      ? [damageModifier(DAMAGE_STAGES.FLAT, 2, 'relic:desperate-force')]
      : [],
  },
  {
    id: 'r-close-quarters',
    name: '\u8fd1\u6218\u8a93\u7ea6',
    description: '\u5f53\u524d\u6b66\u5668\u5c04\u7a0b\u4e3a 1 \u65f6\uff0c\u653b\u51fb +2\u3002',
    damageModifiers: ({ weapon }) => weapon?.range === 1
      ? [damageModifier(DAMAGE_STAGES.FLAT, 2, 'relic:close-quarters')]
      : [],
  },
  {
    id: 'r-long-reach',
    name: '\u8fdc\u89c1\u94ed\u6587',
    description: '\u5f53\u524d\u6b66\u5668\u5c04\u7a0b\u81f3\u5c11\u4e3a 2 \u65f6\uff0c\u653b\u51fb +2\u3002',
    damageModifiers: ({ weapon }) => weapon?.range >= 2
      ? [damageModifier(DAMAGE_STAGES.FLAT, 2, 'relic:long-reach')]
      : [],
  },
  {
    id: 'r-armored-strike',
    name: '\u94c1\u58c1\u73a0\u7b26',
    description: '\u6709\u62a4\u7532\u65f6\uff0c\u653b\u51fb +1\u3002',
    damageModifiers: ({ player }) => player?.armor > 0
      ? [damageModifier(DAMAGE_STAGES.FLAT, 1, 'relic:armored-strike')]
      : [],
  },
  {
    id: 'r-fragile-rhythm',
    name: '\u78e8\u635f\u8282\u62cd',
    description: '\u6b66\u5668\u5269 2 \u70b9\u6216\u66f4\u5c11\u8010\u4e45\u65f6\uff0c\u653b\u51fb +1\u3002',
    damageModifiers: ({ weapon }) => weapon?.durability > 0 && weapon.durability <= 2
      ? [damageModifier(DAMAGE_STAGES.FLAT, 1, 'relic:fragile-rhythm')]
      : [],
  },
  {
    id: 'r-steady-hand',
    name: '\u7a33\u5b9a\u4e4b\u624b',
    description: '\u751f\u547d\u6ee1\u503c\u65f6\uff0c\u653b\u51fb +2\u3002',
    damageModifiers: ({ player }) => player && player.hp === player.maxHp
      ? [damageModifier(DAMAGE_STAGES.FLAT, 2, 'relic:steady-hand')]
      : [],
  },
  {
    id: 'r-blood-hunger',
    name: '\u8840\u9965\u5370\u8bb0',
    description: '\u76ee\u6807\u4e3a\u8840\u8089\u65f6\uff0c\u653b\u51fb +1\u3002',
    damageModifiers: ({ target }) => target?.category === 'blood'
      ? [damageModifier(DAMAGE_STAGES.FLAT, 1, 'relic:blood-hunger')]
      : [],
  },
  {
    id: 'r-coin-salve',
    name: '\u94b1\u5e01\u6696\u5370',
    description: '\u6bcf\u6b21\u62fe\u53d6\u91d1\u5e01\u540e\u6062\u590d 1 \u70b9\u751f\u547d\u3002',
    events: {
      'gold:collected': () => [{ type: 'heal', amount: 1, log: '\u94b1\u5e01\u6696\u5370\uff1a\u6062\u590d 1 \u70b9\u751f\u547d\u3002' }],
    },
  },
  {
    id: 'r-command-shout',
    name: '\u53f7\u4ee4\u4e4b\u58f0',
    description: '\u4e3b\u52a8\uff1a\u7ffb\u5f00\u672c\u623f\u95f4\u6240\u6709\u654c\u4eba\uff0c\u5e76\u5c06\u81f3\u591a 8 \u4e2a\u62c9\u81f3\u5165\u53e3\u9644\u8fd1\u3002',
    activeSkill: {
      id: 'command-shout',
      name: '\u53f7\u4ee4\u4e4b\u58f0',
      cooldown: 4,
    },
  },
  {
    id: 'r-shadow-hide',
    name: '\u85cf\u533f\u4e4b\u5f71',
    description: '\u4e3b\u52a8\uff1a\u85cf\u533f 3 \u56de\u5408\uff0c\u5176\u95f4\u654c\u4eba\u4e0d\u884c\u52a8\uff0c\u6bcf\u56de\u5408\u7ffb\u5f00\u4e00\u5f20\u724c\u3002',
    activeSkill: {
      id: 'shadow-hide',
      name: '\u85cf\u533f\u4e4b\u5f71',
      cooldown: 5,
    },
  },
])

const BY_ID = new Map(RELIC_DEFS.map((definition) => [definition.id, definition]))

export function getRelicDefinition(id) { return BY_ID.get(id) || null }

export function buildRelicChoices(collection, { count = 3, random = Math.random } = {}) {
  const candidates = RELIC_DEFS.filter((definition) => !collection?.has(definition.id))
  const shuffled = [...candidates]
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled.slice(0, count)
}
