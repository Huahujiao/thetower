import { EXPANSION_RELICS } from './expansion-items.js'
import { TOTEM_BADGES } from './totems.js'
import { PET_RELICS } from './pets.js'

export const RELIC_DEFS = Object.freeze([
  {
    "id": "r-three",
    "disabled": true,
    "name": "三相轮",
    "description": "背包同时持有三种属性武器时，克制倍率变为2.2，被克制时仍为1倍。",
    "attribute": null
  },
  {
    "id": "r-empty",
    "name": "空匣印",
    "description": "背包空格不少于8时，所有武器体力球消耗-1。",
    "attribute": null
  },
  {
    "id": "r-reverse",
    "disabled": true,
    "name": "逆克石",
    "description": "所有武器的属性克制关系反转：原本克制变为被克制，原本被克制变为克制。",
    "attribute": null
  },
  {
    "id": "r-traveler",
    "name": "旅者骨牌",
    "description": "战斗中，攻击后紧接的第一个主动移动操作，额外抽取1个体力球。",
    "attribute": null
  },
  {
    "id": "r-blood",
    "name": "血契铜镜",
    "description": "所有治疗量减半并向下取整；生命不高于50%时，武器攻击+3。",
    "attribute": "wither"
  },
  {
    "id": "r-scales",
    "name": "断刃秤",
    "description": "\u80cc\u5305\u4e2d\u53ea\u67091\u628a\u6b66\u5668\u65f6\uff0c\u8be5\u6b66\u5668\u653b\u51fb\u529b\u00d72\u3001\u5c04\u7a0b+1\u3002",
    "attribute": null
  },
  {
    "id": "r-relay-badge",
    "name": "接力徽记",
    "description": "\u4e0e\u672c\u5723\u9057\u7269\u76f8\u90bb\u7684\u6b66\u5668\u653b\u51fb\u540e\uff0c\u4e0b\u4e00\u6b21\u4f7f\u7528\u4e0e\u672c\u5723\u9057\u7269\u76f8\u90bb\u7684\u53e6\u4e00\u628a\u6b66\u5668\u653b\u51fb\u65f6\uff0c\u4f24\u5bb3\u00d71.7\u3002",
    "attribute": null
  },
  {
    "id": "r-guard-return",
    "name": "回甲刻印",
    "description": "自身护甲因武器效果或敌人普通攻击降低后，返还1点护甲。",
    "attribute": null
  },
  {
    "id": "r-phase-pointer",
    "disabled": true,
    "name": "换相指针",
    "description": "用与上次攻击不同属性的武器有效命中后，下一次武器攻击伤害+1、体力消耗-1；不叠加。",
    "attribute": null
  },
  {
    "id": "r-money-scale",
    "name": "钱秤",
    "description": "拾取每堆金币额外获得1金币。",
    "attribute": null
  },
  {
    "id": "r-trade-voucher",
    "name": "交易券",
    "description": "普通商人货品价格减少1金币，最低为1金币。",
    "attribute": null
  },
  {
    "id": "r-ledger",
    "name": "折价账本",
    "description": "普通商人刷新货架费用减少2金币，最低为1金币。",
    "attribute": null
  },
  {
    "id": "r-heavy-wrist",
    "name": "重腕护符",
    "description": "\u56db\u5411\u6ca1\u6709\u76f8\u90bb\u7269\u54c1\u4e14\u57fa\u7840\u4f53\u529b\u6d88\u8017\u22655\u7684\u6b66\u5668\uff0c\u4f53\u529b\u6d88\u8017-1\uff0c\u6700\u4f4e\u51cf\u4e3a1\u3002",
    "attribute": null
  },
  {
    "id": "r-step-boots",
    "name": "步痕靴",
    "description": "攻击后紧接的第一个主动移动操作，获得1层闪避，持续至当次敌人阶段结束。",
    "attribute": null
  },
  {
    "id": "r-turn-shield",
    "name": "回身盾",
    "description": "攻击后紧接的第一个主动移动操作，获得1层反击；伤害为上次武器攻击力的一半，向上取整，持续至当次敌人阶段结束。",
    "attribute": null
  },
  {
    "id": "r-poison-hourglass",
    "disabled": true,
    "name": "蚀时漏斗",
    "description": "武器附毒每次造成伤害时积1点蓄毒，至多3点；下一次任意武器攻击消耗并等量增伤。",
    "attribute": "wither"
  },
  ...EXPANSION_RELICS,
  ...TOTEM_BADGES,
  ...PET_RELICS
])

const BY_ID = new Map(RELIC_DEFS.map((definition) => [definition.id, definition]))

export function getRelicDefinition(id) { return BY_ID.get(id) || null }

export function buildRelicChoices(collection, { count = 3, random = Math.random, preferredId = null } = {}) {
  const candidates = RELIC_DEFS.filter((definition) => !definition.disabled && !collection?.has(definition.id))
  const shuffled = [...candidates]
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  if (preferredId) {
    const index = shuffled.findIndex((definition) => definition.id === preferredId)
    if (index > 0) shuffled.unshift(shuffled.splice(index, 1)[0])
  }
  return shuffled.slice(0, count)
}
