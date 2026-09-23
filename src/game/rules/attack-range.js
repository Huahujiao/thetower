import { combatDistance, samePos } from '../core/geometry.js'

export function attackRangeCells(room, origin, range) {
  if (!room?.contains(origin) || !Number.isFinite(range) || range < 1) return []
  const cells = []
  for (let r = 0; r < room.height; r += 1) {
    for (let c = 0; c < room.width; c += 1) {
      const position = { c, r }
      if (samePos(position, origin) || !room.isRevealed(position)) continue
      if (combatDistance(origin, position, range) <= range) cells.push(position)
    }
  }
  return cells
}

export function weaponTargetCells(room, origin, range) {
  return attackRangeCells(room, origin, range)
    .filter((position) => room.entityAt(position)?.kind === 'enemy')
}

export function enemyThreatCells(room, enemy, playerPosition) {
  if (!enemy || enemy.kind !== 'enemy' || enemy.downed || !(enemy.attack > 0) || !(enemy.range > 0)) return []
  return attackRangeCells(room, enemy.pos, Number(enemy.range))
    .filter((position) => room.isEmpty(position) || samePos(position, playerPosition))
}
