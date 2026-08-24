import catalog from './catalog.json' with { type: 'json' }

export const ENEMY_DEFS = Object.freeze(catalog.enemies)

export function enemyDefinitionFor(floor, index) {
  const available = ENEMY_DEFS.filter((definition) => definition.minFloor <= floor)
  return available[index % available.length]
}
