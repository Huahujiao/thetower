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
    "description": "移动后立即进行的武器攻击体力-2；连续攻击时体力消耗+1。",
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
  }
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
