import { combatDistance, manhattan, neighbors8, posKey, samePos } from '../core/geometry.js'

function reconstruct(cameFrom, startKey, endKey) {
  const path = []
  let key = endKey
  while (key !== startKey) {
    const node = cameFrom.get(key)
    if (!node) return null
    path.unshift(node.position)
    key = node.from
  }
  return path
}

function stepCost(from, to) {
  return from.c !== to.c && from.r !== to.r ? Math.SQRT2 : 1
}

function pathCost(start, path) {
  let total = 0
  let previous = start
  for (const step of path) {
    total += stepCost(previous, step)
    previous = step
  }
  return total
}

export function findPath(room, start, goal, { allowGoalOccupied = false } = {}) {
  if (!room.isRevealed(start) || !room.isRevealed(goal)) return null
  const startKey = posKey(start)
  const goalKey = posKey(goal)
  if (startKey === goalKey) return []
  const queue = [{ position: { ...start }, cost: 0 }]
  const costs = new Map([[startKey, 0]])
  const cameFrom = new Map()

  while (queue.length) {
    queue.sort((left, right) => left.cost - right.cost)
    const current = queue.shift()
    const currentKey = posKey(current.position)
    if (current.cost !== costs.get(currentKey)) continue
    if (currentKey === goalKey) return reconstruct(cameFrom, startKey, goalKey)
    for (const candidate of neighbors8(current.position, room.width, room.height)) {
      const key = posKey(candidate)
      if (!room.isRevealed(candidate)) continue
      const isGoal = key === goalKey
      if (!room.isEmpty(candidate) && !(isGoal && allowGoalOccupied)) continue
      const cost = current.cost + stepCost(current.position, candidate)
      if (cost >= (costs.get(key) ?? Infinity)) continue
      costs.set(key, cost)
      cameFrom.set(key, { from: currentKey, position: candidate })
      queue.push({ position: candidate, cost })
    }
  }
  return null
}

export function findShortestPathToAny(room, start, goals) {
  let result = null
  for (const goal of goals) {
    const path = findPath(room, start, goal)
    if (!path) continue
    const cost = pathCost(start, path)
    if (!result || cost < result.cost) result = { goal, path, cost }
  }
  return result
}

function revealApproaches(room, target, distance) {
  if (distance <= 1) return neighbors8(target, room.width, room.height)
  const approaches = []
  for (let r = 0; r < room.height; r++) {
    for (let c = 0; c < room.width; c++) {
      const candidate = { c, r }
      if (manhattan(candidate, target) <= distance) approaches.push(candidate)
    }
  }
  return approaches
}

export function findRevealPath(room, start, target, { distance = 1 } = {}) {
  if (room.isRevealed(target)) return null
  const approaches = revealApproaches(room, target, distance)
    .filter((candidate) => room.isRevealed(candidate) && room.isEmpty(candidate))
  return findShortestPathToAny(room, start, approaches)
}

export function findDoorPath(room, start, door) {
  if (!door?.arrival || !room.isRevealed(door.arrival) || !room.isEmpty(door.arrival)) return null
  return findPath(room, start, door.arrival)
}

export function findInteractionPath(room, start, target) {
  const approaches = neighbors8(target.pos, room.width, room.height)
    .filter((candidate) => room.isRevealed(candidate) && room.isEmpty(candidate))
  return findShortestPathToAny(room, start, approaches)
}

export function findAttackPath(room, start, enemy, weapons) {
  const ranges = Array.isArray(weapons) ? weapons.map((weapon) => weapon.range) : [weapons]
  const positions = []
  for (let r = 0; r < room.height; r++) {
    for (let c = 0; c < room.width; c++) {
      const candidate = { c, r }
      if (!room.isRevealed(candidate) || !room.isEmpty(candidate)) continue
      if (ranges.some((range) => combatDistance(candidate, enemy.pos, range) <= range)) positions.push(candidate)
    }
  }
  return findShortestPathToAny(room, start, positions)
}

export function pathLeavesRange(path, enemy, range) {
  const finalPosition = path[path.length - 1]
  return !!finalPosition && combatDistance(finalPosition, enemy.pos, range) > range
}

export function isSamePathPosition(path, position) {
  return path.some((step) => samePos(step, position))
}
