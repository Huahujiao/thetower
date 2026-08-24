// Data-only definitions for monster abilities. Runtime execution lives in
// game/rules/monster-skills.js and dispatches generic atomic state actions.

export const MONSTER_SKILL_TRIGGERS = Object.freeze({
  REVEAL: 'reveal',
  TURN_START: 'turn:start',
  ATTACK_AFTER: 'attack:after',
  DAMAGED: 'damaged',
})

export const MONSTER_SKILL_DEFS = Object.freeze({
  ms_ambush: {
    id: 'ms_ambush',
    name: '\u7a81\u88ad',
    desc: '\u7ffb\u51fa\u7684\u56de\u5408\u7acb\u5373\u653b\u51fb\u4e00\u6b21\u3002',
    trigger: MONSTER_SKILL_TRIGGERS.REVEAL,
    effects: [{ type: 'attack', sanity: 1 }],
  },
  ms_stone_skin: {
    id: 'ms_stone_skin',
    name: '\u77f3\u80a4',
    desc: '\u6bcf\u9694 3 \u56de\u5408\u83b7\u5f97 2 \u70b9\u4f24\u5bb3\u51cf\u514d\uff0c\u6301\u7eed\u5230\u56de\u5408\u7ed3\u675f\u3002',
    trigger: MONSTER_SKILL_TRIGGERS.TURN_START,
    cooldown: 3,
    effects: [{
      type: 'status',
      status: {
        id: 'monster:stone-skin',
        group: 'monster:stone-skin',
        amount: 2,
        turns: 2,
        stackRule: 'replace',
        data: { kind: 'buff', damageReduction: 2 },
      },
    }],
  },
  ms_wail: {
    id: 'ms_wail',
    name: '\u54c0\u568e',
    desc: '\u653b\u51fb\u540e\u989d\u5916\u4f7f\u73a9\u5bb6\u5931\u53bb 1 \u70b9\u7406\u667a\u3002',
    trigger: MONSTER_SKILL_TRIGGERS.ATTACK_AFTER,
    cooldown: 2,
    effects: [{ type: 'sanity', amount: 1 }],
  },
  ms_skitter: {
    id: 'ms_skitter',
    name: '\u8df3\u52a8',
    desc: '\u53d7\u4f24\u540e\u5411\u968f\u673a\u76f8\u90bb\u7a7a\u683c\u79fb\u52a8\u3002',
    trigger: MONSTER_SKILL_TRIGGERS.DAMAGED,
    cooldown: 1,
    effects: [{ type: 'move', mode: 'random-empty-neighbor' }],
  },
})

export function getMonsterSkillDef(id) {
  return MONSTER_SKILL_DEFS[id] || null
}

