// Terrain has no authored content yet. Keeping this query at the rule boundary
// lets future terrain data affect attacks without branching inside GameRun.
export function terrainDamageModifiers(room, position) {
  const terrain = room?.tile(position)?.terrain || 'plain'
  if (terrain === 'altar') return [{ stage: 'flat', value: 1, source: 'terrain:altar' }]
  return []
}
