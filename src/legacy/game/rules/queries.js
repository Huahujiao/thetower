export function chebyshevDistance(a, b) {
  return Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r))
}

export function isAdjacent8(a, b) {
  return a !== b && chebyshevDistance(a, b) <= 1
}

export function isWithinDistance(a, b, distance) {
  return a !== b && chebyshevDistance(a, b) <= distance
}

export function neighbors8(card, board) {
  return board.filter((other) => other && other.uid !== card.uid && isAdjacent8(card, other))
}

export function cardsWithinDistance(card, board, distance) {
  return board.filter((other) => other && other.uid !== card.uid && isWithinDistance(card, other, distance))
}
