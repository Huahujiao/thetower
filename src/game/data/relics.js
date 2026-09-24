export const RELIC_DEFS = Object.freeze([
  {
    "id": "r-three",
    "name": "三相轮",
    "description": "背包同时持有三种属性武器时，克制倍率变为2.2，被克制倍率变为0.5。",
    "attribute": null
  },
  {
    "id": "r-empty",
    "name": "空匣印",
    "description": "背包空格不少于8时，所有武器体力消耗-1。",
    "attribute": null
  },
  {
    "id": "r-reverse",
    "name": "逆克石",
    "description": "所有武器的属性克制关系反转：原本克制变为被克制，原本被克制变为克制。",
    "attribute": null
  },
  {
    "id": "r-traveler",
    "name": "旅者骨牌",
    "description": "移动后立即进行的武器攻击体力消耗-2；连续攻击时体力消耗+1。",
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
    "description": "背包恰好只有一把武器时，该武器攻击+4、射程+1。",
    "attribute": null
  },
  {
    "id": "r-relay-badge",
    "name": "接力徽记",
    "description": "任意武器有效命中后，下一次换用其他武器攻击伤害+1；不叠加。",
    "attribute": null
  },
  {
    "id": "r-guard-return",
    "name": "回甲刻印",
    "description": "用武器攻击使自身护甲减少后，返还1点护甲。",
    "attribute": null
  },
  {
    "id": "r-phase-pointer",
    "name": "换相指针",
    "description": "任意武器按灼热→枯萎→沉溺的顺序有效命中后，下一次武器攻击伤害+3、体力消耗-1；每房首次错序命中保留已有印记。",
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
    "id": "r-gold-hook",
    "name": "拾金钩",
    "description": "任意武器主攻击击杀获得1金币，每房间最多3次。",
    "attribute": null
  },
  {
    "id": "r-ledger",
    "name": "折价账本",
    "description": "普通商人货品价格减少1金币，最低为1金币；可与其他折扣叠加。",
    "attribute": null
  },
  {
    "id": "r-heavy-wrist",
    "name": "重腕护符",
    "description": "四向没有相邻物品的重武器体力消耗-1，最低仍为1。",
    "attribute": null
  },
  {
    "id": "r-step-boots",
    "name": "步痕靴",
    "description": "主动移动后立即进行的任意武器攻击伤害+1；有效命中后将护甲补足至1。",
    "attribute": null
  },
  {
    "id": "r-turn-shield",
    "name": "回身盾",
    "description": "主动移动后立即用任意武器有效命中，将护甲补足至2。",
    "attribute": null
  },
  {
    "id": "r-poison-hourglass",
    "name": "蚀时漏斗",
    "description": "武器附毒每次造成伤害时积1点蓄毒，至多3点；下一次任意武器攻击消耗并等量增伤。",
    "attribute": "wither"
  }
])

const BY_ID = new Map(RELIC_DEFS.map((definition) => [definition.id, definition]))

export function getRelicDefinition(id) { return BY_ID.get(id) || null }

export function buildRelicChoices(collection, { count = 3, random = Math.random, preferredId = null } = {}) {
  const candidates = RELIC_DEFS.filter((definition) => !collection?.has(definition.id))
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
