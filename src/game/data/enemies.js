import catalog from './catalog.json' with { type: 'json' }

export const ENEMY_DEFS = Object.freeze(catalog.enemies)
const BY_ID = new Map(ENEMY_DEFS.map((definition) => [definition.id, definition]))

export function enemyDefinitionFor(floor, index) {
  const available = ENEMY_DEFS.filter((definition) => definition.minFloor <= floor && !definition.spawnOnly)
  return available[index % available.length]
}

export function getEnemyDefinition(id) { return BY_ID.get(id) || null }
