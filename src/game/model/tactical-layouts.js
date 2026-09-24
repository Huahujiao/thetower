import { createMonster } from '../data/content.js'
import { posKey, manhattan } from '../core/geometry.js'

export const TACTICAL_LAYOUT_LABELS = Object.freeze({ scattered: '散布', firing: '开阔射线', wall: '靠墙敌阵' })

// Reserve empty approach cells before random population. Doors, keys, merchants,
// and their existing routes always take precedence over a tactical template.
export function arrangeTacticalEnemies(room, reserved, kind) {
  room.tacticalLayout = 'scattered'
  room.tacticalCells = []
  const targetFree = p => room.isEmpty(p) && !reserved.has(posKey(p))
  const empty = p => room.contains(p) && room.isEmpty(p)
  const place = (targets, approaches) => {
    for (const [index, p] of targets.entries()) {
      const enemy = createMonster(room.chapter, index + (room.chapter - 1) * 3)
      enemy.pos = { ...p }
      room.addEntity(enemy)
    }
    for (const p of approaches) reserved.add(posKey(p))
    room.tacticalLayout = kind
    room.tacticalCells = approaches.map(p => ({ ...p }))
    return targets.length
  }
  if (kind === 'firing') {
    for (let r = 1; r < room.height - 1; r++) {
      const targets = [{ c: 0, r }, { c: room.width - 1, r }]
      const lane = Array.from({ length: room.width - 2 }, (_, i) => ({ c: i + 1, r }))
      if (targets.every(targetFree) && lane.every(empty)) return place(targets, lane)
    }
  }
  if (kind === 'wall') {
    const targets = [], approaches = []
    for (let r = 1; r < room.height - 1; r++) {
      for (const c of [0, room.width - 1]) {
        const target = { c, r }, direction = c === 0 ? 1 : -1
        const approach = [1, 2].map(distance => ({ c: c + direction * distance, r }))
        if (!targetFree(target) || !approach.every(empty) || targets.some(p => manhattan(p, target) < 3)) continue
        targets.push(target); approaches.push(...approach)
        if (targets.length === 2) return place(targets, approaches)
      }
    }
  }
  return 0
}
