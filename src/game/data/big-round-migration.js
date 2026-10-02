export const BIG_ROUND_REVISION = 1
export const BASE_ACTION_ENERGY = 6

export function migrateBigRounds(data) {
  if (!data || (data.bigRoundRevision || 0) >= BIG_ROUND_REVISION) return false
  const player = data.player
  if (!player || !data.dungeon) return false
  const previousBase = Number(player.baseMaxEnergy ?? player.maxEnergy ?? 10)
  player.baseMaxEnergy = BASE_ACTION_ENERGY + Math.max(0, previousBase - 10)
  const room = data.dungeon.rooms?.find(candidate => candidate.id === player.roomId)
  const totems = (room?.entities || []).filter(entity => entity.kind === 'totem').length
  player.maxEnergy = Math.max(1, player.baseMaxEnergy - totems)
  player.energy = player.maxEnergy
  const active = (room?.entities || []).some(entity => entity.kind === 'enemy' && room.tiles?.[entity.pos.r]?.[entity.pos.c]?.revealed)
  data.battle = { active, stage: active ? 'player' : 'explore', round: active ? 1 : 0 }
  data.roundResolving = false
  data.pendingRoundEnd = false
  // Old per-action clocks remain historical; future ticks advance only by rounds.
  data.bigRoundRevision = BIG_ROUND_REVISION
  return true
}
