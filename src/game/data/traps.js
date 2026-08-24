import { nextEntityId } from './content.js'

export const TRAP_DEFS = Object.freeze([
  {
    id: 'explosion',
    name: '\u7206\u70b8\u9677\u9631',
    effect: 'explosion',
    damage: 2,
    radius: 1,
  },
  {
    id: 'alarm',
    name: '\u58f0\u54cd\u9677\u9631',
    effect: 'alarm',
    radius: 2,
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
