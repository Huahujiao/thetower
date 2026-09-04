import { nextEntityId } from './content.js'

export const TRAP_DEFS = Object.freeze([
  {
    id: 'explosion',
    name: '\u7206\u70b8\u9677\u9631',
    effect: 'explosion',
    damage: 2,
    radius: 1,
    description: '\u89e6\u53d1\u540e\u5bf9\u73a9\u5bb6\u548c\u516b\u90bb\u57df\u5185\u5df2\u7ffb\u5f00\u654c\u4eba\u9020\u6210 2 \u70b9\u4f24\u5bb3\u3002',
  },
  {
    id: 'alarm',
    name: '\u58f0\u54cd\u9677\u9631',
    effect: 'alarm',
    radius: 2,
    description: '\u89e6\u53d1\u540e\u7ffb\u5f00\u534a\u5f84 2 \u5185\u7684\u9690\u85cf\u654c\u4eba\u3002',
  },
  {
    id: 'corrosion',
    name: '\u8150\u8680\u9677\u9631',
    effect: 'corrosion',
    durabilityLoss: 1,
    description: '\u5df2\u88c5\u5907\u7684\u53cc\u624b\u6b66\u5668\u5404\u5931\u53bb 1 \u70b9\u8010\u4e45\uff1b\u8010\u4e45\u5f52\u96f6\u65f6\u6309\u6b63\u5e38\u89c4\u5219\u635f\u6bc1\u3002',
  },
  {
    id: 'poison-fog',
    name: '\u6bd2\u96fe\u9677\u9631',
    effect: 'poison',
    poisonTurns: 3,
    poisonDamage: 2,
    description: '\u4e2d\u6bd2 3 \u4e2a\u5168\u5c40\u56de\u5408\uff0c\u4ece\u7ffb\u5f00\u540e\u7684\u4e0b\u4e00\u4e2a\u5168\u5c40\u56de\u5408\u5f00\u59cb\uff0c\u6bcf\u56de\u5408\u65e0\u89c6\u62a4\u7532\u6263 2 \u70b9\u751f\u547d\u3002',
  },
])

const BY_ID = new Map(TRAP_DEFS.map((definition) => [definition.id, definition]))

export function getTrapDefinition(id) { return BY_ID.get(id) || null }

export function createTrapEntity(trapId, position) {
  const definition = getTrapDefinition(trapId)
  if (!definition) throw new Error(`Unknown trap: ${trapId}`)
  return {
    id: nextEntityId('trap'),
    kind: 'trap',
    trapId: definition.id,
    name: definition.name,
    pos: { ...position },
    revealOrder: null,
  }
}

export function randomTrapId(random = Math.random) {
  return TRAP_DEFS[Math.floor(random() * TRAP_DEFS.length)]?.id || TRAP_DEFS[0].id
}
