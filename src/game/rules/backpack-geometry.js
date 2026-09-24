// Adjacency uses occupied cells, including rotated and irregular shapes.
export function adjacentItems(backpack, item) {
  const placement = backpack.placementOf(item.uid)
  if (!placement) return []
  const own = backpack.cellsForPlacement(placement)
  return backpack.items.filter((other) => other.uid !== item.uid && backpack.cellsForPlacement(backpack.placementOf(other.uid))
    .some((b) => own.some((a) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1)))
}

export function adjacentItemIds(backpack, firstId, secondId) {
  return backpack.items.filter((item) => item.id === firstId)
    .some((item) => adjacentItems(backpack, item).some((other) => other.id === secondId))
}
