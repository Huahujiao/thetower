import { nextEntityId } from './content.js'
import { POISON_TURNS } from '../rules/statuses.js'

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
    fatigueLayers: 1,
    description: '获得1层疲劳：战斗中立即减少1个体力球；探索中下个战斗回合少获取1个球。',
  },
  {
    id: 'poison-fog',
    name: '\u6bd2\u96fe\u9677\u9631',
    effect: 'poison',
    poisonTurns: POISON_TURNS,
    poisonDamage: 2,
    description: '中毒3回合，从下一个敌人阶段开始，每阶段无视护甲扣2点生命。探索时不计时。',
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
