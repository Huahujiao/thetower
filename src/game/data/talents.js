export const FIXED_GROWTH = Object.freeze({ id: 'body-strength', name: '强化体格', description: '最大生命+2，可重复选择。', fixed: true })

export const TALENT_DEFS = Object.freeze([
  {
    "id": "flow-step",
    "line": "flow",
    "tier": 1,
    "slot": "1A",
    "name": "踏势",
    "description": "上次实际行动是主动移动时，攻击+1。",
    "prerequisites": [],
    "effects": {}
  },
  {
    "id": "flow-switch",
    "line": "flow",
    "tier": 1,
    "slot": "1B",
    "name": "交锋",
    "description": "与上次攻击使用不同武器，且攻击距离至少2格时，伤害+2。",
    "prerequisites": [],
    "effects": {}
  },
  {
    "id": "flow-walk",
    "line": "flow",
    "tier": 2,
    "slot": "2A",
    "name": "稳步",
    "description": "主动移动后，武器命中时将护甲补足至1。",
    "prerequisites": [
      "flow-step"
    ],
    "effects": {}
  },
  {
    "id": "flow-relay",
    "line": "flow",
    "tier": 2,
    "slot": "2B",
    "name": "接力",
    "description": "主攻击击杀后，下次用不同武器攻击体力-1，不叠加。",
    "prerequisites": [
      "flow-switch"
    ],
    "effects": {}
  },
  {
    "id": "flow-master",
    "line": "flow",
    "tier": 3,
    "slot": "3",
    "name": "行云",
    "description": "同时满足移动后攻击和切换武器时，再+2伤害。",
    "prerequisites": [
      "flow-walk",
      "flow-relay"
    ],
    "effects": {}
  },
  {
    "id": "guard-shell",
    "line": "guard",
    "tier": 1,
    "slot": "1A",
    "name": "厚壳",
    "description": "首次进入新房间获得2护甲。",
    "prerequisites": [],
    "effects": {}
  },
  {
    "id": "guard-gain",
    "line": "guard",
    "tier": 1,
    "slot": "1B",
    "name": "固甲",
    "description": "防具补足护甲的目标值+1；从0护甲直接获得防具护甲时额外+1。",
    "prerequisites": [],
    "effects": {}
  },
  {
    "id": "guard-hard",
    "line": "guard",
    "tier": 2,
    "slot": "2A",
    "name": "硬化",
    "description": "有护甲时，敌人普通攻击伤害-1。",
    "prerequisites": [
      "guard-shell"
    ],
    "effects": {}
  },
  {
    "id": "guard-reply",
    "line": "guard",
    "tier": 2,
    "slot": "2B",
    "name": "还击",
    "description": "通过防具获得护甲后，下一次攻击+1，不叠加。",
    "prerequisites": [
      "guard-gain"
    ],
    "effects": {}
  },
  {
    "id": "guard-last",
    "line": "guard",
    "tier": 3,
    "slot": "3",
    "name": "余甲",
    "description": "护甲被敌人打空后，下一次武器攻击+2；不叠加。",
    "prerequisites": [
      "guard-hard",
      "guard-reply"
    ],
    "effects": {}
  },
  {
    "id": "harmony-counter",
    "line": "harmony",
    "tier": 1,
    "slot": "1A",
    "name": "克敌",
    "description": "克制攻击+1伤害。",
    "prerequisites": [],
    "effects": {}
  },
  {
    "id": "harmony-switch",
    "line": "harmony",
    "tier": 1,
    "slot": "1B",
    "name": "应变",
    "description": "换用不同属性的武器命中存活敌人后，使其下一次普通攻击伤害-1；再次触发刷新。",
    "prerequisites": [],
    "effects": {}
  },
  {
    "id": "harmony-kill",
    "line": "harmony",
    "tier": 2,
    "slot": "2A",
    "name": "乘胜",
    "description": "主攻击克制击杀恢复1体力。",
    "prerequisites": [
      "harmony-counter"
    ],
    "effects": {}
  },
  {
    "id": "harmony-resist",
    "line": "harmony",
    "tier": 2,
    "slot": "2B",
    "name": "留势",
    "description": "被克制攻击后，下一次不同属性攻击+2，不叠加。",
    "prerequisites": [
      "harmony-switch"
    ],
    "effects": {}
  },
  {
    "id": "harmony-three",
    "line": "harmony",
    "tier": 3,
    "slot": "3",
    "name": "三相护身",
    "description": "背包同时持有三种属性武器时，属性敌人的普通攻击伤害-1。",
    "prerequisites": [
      "harmony-kill",
      "harmony-resist"
    ],
    "effects": {}
  },
  {
    "id": "survival-vigor",
    "line": "survival",
    "tier": 1,
    "slot": "1A",
    "name": "强健",
    "description": "最大生命+3，并恢复3生命。",
    "prerequisites": [],
    "effects": {
      "maxHp": 3,
      "heal": 3
    }
  },
  {
    "id": "survival-low",
    "line": "survival",
    "tier": 1,
    "slot": "1B",
    "name": "背水",
    "description": "生命≤50%时，武器攻击+1。",
    "prerequisites": [],
    "effects": {}
  },
  {
    "id": "survival-heal",
    "line": "survival",
    "tier": 2,
    "slot": "2A",
    "name": "疗养",
    "description": "生命药额外恢复2生命。",
    "prerequisites": [
      "survival-vigor"
    ],
    "effects": {}
  },
  {
    "id": "survival-energy",
    "line": "survival",
    "tier": 2,
    "slot": "2B",
    "name": "续命",
    "description": "低血时每第2次受到敌人生命伤害并存活，恢复1体力。",
    "prerequisites": [
      "survival-low"
    ],
    "effects": {}
  },
  {
    "id": "survival-last",
    "line": "survival",
    "tier": 3,
    "slot": "3",
    "name": "绝境",
    "description": "生命不高于25%时，生命药额外恢复5生命。",
    "prerequisites": [
      "survival-heal",
      "survival-energy"
    ],
    "effects": {}
  }
])

const TALENT_BY_ID = new Map(TALENT_DEFS.map((definition) => [definition.id, definition]))

export function getTalentDefinition(id) { return TALENT_BY_ID.get(id) || null }

export function ownedTalentIds(player) {
  return new Set(Array.isArray(player?.talents) ? player.talents.filter((id) => TALENT_BY_ID.has(id)) : [])
}

export function hasTalent(player, id) { return ownedTalentIds(player).has(id) }

export function unlockableTalents(player) {
  const owned = ownedTalentIds(player)
  return TALENT_DEFS.filter((definition) => !owned.has(definition.id) && definition.prerequisites.every((id) => owned.has(id)))
}

export function buildLevelUpChoices(player, { count = 4, random = Math.random } = {}) {
  const pool = unlockableTalents(player).slice()
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]]
  }
  return [...pool.slice(0, Math.max(0, count)).map((definition) => definition.id), FIXED_GROWTH.id]
}

export function talentGraphState(player) {
  const owned = ownedTalentIds(player)
  return TALENT_DEFS.map((definition) => ({
    ...definition,
    state: owned.has(definition.id) ? 'owned' : definition.prerequisites.every((id) => owned.has(id)) ? 'unlockable' : 'locked',
  }))
}
