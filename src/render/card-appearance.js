// Presentation-only randomness: independent of gameplay RNG and stable for a room.
export const CARD_PATTERN_VARIANTS = 4
export const CARD_COLOR_VARIANTS = 3
export const CARD_VALUE_RANGE = .035

function hash(value) {
  let result = 2166136261
  for (const character of String(value)) {
    result = Math.imul(result ^ character.charCodeAt(0), 16777619)
  }
  return result >>> 0
}

export function cardPatternIndex(position, roomId = '') {
  if (!position) return 0
  const c = Math.floor(position.c), r = Math.floor(position.r)
  // Shuffle each 2x2 patch: all four patterns appear before one repeats.
  // Adjacent patches shuffle independently to avoid a visible repeating grid.
  let seed = hash(`pattern:${roomId}:${Math.floor(c / 2)}:${Math.floor(r / 2)}`)
  const variants = Array.from({ length: CARD_PATTERN_VARIANTS }, (_, index) => index)
  for (let i = variants.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const j = seed % (i + 1)
    ;[variants[i], variants[j]] = [variants[j], variants[i]]
  }
  return variants[((r % 2 + 2) % 2) * 2 + (c % 2 + 2) % 2]
}

export function cardValue(position, roomId = '') {
  if (!position) return 1
  const seed = hash(`value:${roomId}:${position.c}:${position.r}`)
  return 1 + (seed / 0xffffffff * 2 - 1) * CARD_VALUE_RANGE
}

// Independent of the ornament shuffle: every pattern can use all three pigments.
export function cardColorIndex(position, roomId = '') {
  if (!position) return 1
  return hash(`pigment:${roomId}:${position.c}:${position.r}`) % CARD_COLOR_VARIANTS
}

// Rotate square artwork in quarter turns without moving or tilting the tile.
export function boardTextureRotation(position, roomId = '', surface = 'card') {
  if (!position) return 0
  let seed = hash(`rotation:${surface}:${roomId}:${position.c}:${position.r}`)
  seed = Math.imul(seed ^ (seed >>> 16), 2246822507)
  seed = Math.imul(seed ^ (seed >>> 13), 3266489909)
  return ((seed ^ (seed >>> 16)) >>> 0) % 4
}

export function rotateBoardUV(geometry, quarterTurns = 0) {
  const turn = ((Math.trunc(quarterTurns) % 4) + 4) % 4
  if (geometry.userData.boardQuarterTurn === turn) return
  const uv = geometry.attributes.uv
  const original = geometry.userData.boardOriginalUV ||= uv.array.slice()
  for (let index = 0; index < uv.count; index++) {
    let u = original[index * 2], v = original[index * 2 + 1]
    for (let step = 0; step < turn; step++) [u, v] = [1 - v, u]
    uv.setXY(index, u, v)
  }
  uv.needsUpdate = true
  geometry.userData.boardQuarterTurn = turn
}
