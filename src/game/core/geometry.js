export const DIRECTIONS_8 = Object.freeze([
  { c: -1, r: -1 }, { c: 0, r: -1 }, { c: 1, r: -1 },
  { c: -1, r: 0 },                    { c: 1, r: 0 },
  { c: -1, r: 1 },  { c: 0, r: 1 },  { c: 1, r: 1 },
])

export function pos(c, r) { return { c, r } }
export function posKey({ c, r }) { return `${c},${r}` }
export function samePos(a, b) { return !!a && !!b && a.c === b.c && a.r === b.r }
export function isAdjacent8(a, b) { return !!a && !!b && !samePos(a, b) && chebyshev(a, b) === 1 }
export function manhattan(a, b) { return Math.abs(a.c - b.c) + Math.abs(a.r - b.r) }
export function chebyshev(a, b) { return Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r)) }
export function combatDistance(a, b, range) { return range <= 1 ? chebyshev(a, b) : manhattan(a, b) }
export function addPos(a, b) { return pos(a.c + b.c, a.r + b.r) }
export function inBounds({ c, r }, width, height) {
  return Number.isInteger(c) && Number.isInteger(r) && c >= 0 && r >= 0 && c < width && r < height
}

export function neighbors8(origin, width, height) {
  return DIRECTIONS_8
    .map((direction) => addPos(origin, direction))
    .filter((candidate) => inBounds(candidate, width, height))
}
