const SIDES = ['top', 'bottom', 'left', 'right']

export function templeDoorPlacement(room, door, tileSize, inset) {
  const horizontal = door.side === 'top' || door.side === 'bottom'
  const length = horizontal ? room.width : room.height
  // Only two cell-centre posts can form a doorway. Corner-to-post end bays
  // are excluded, including when the requested offset is at either end.
  const first = Math.max(0, Math.min(length - 2, Math.floor(door.offset / 2) * 2))
  const centre = (first + .5 - (length - 1) / 2) * tileSize
  const normal = (horizontal ? room.height : room.width) * tileSize / 2 + inset
  const sign = door.side === 'top' || door.side === 'left' ? -1 : 1
  return {
    first, indices: [first, first + 1], openingWidth: tileSize - .16,
    x: horizontal ? centre : sign * normal,
    z: horizontal ? sign * normal : centre,
  }
}

export function templeBoundaryLayout(room, doors, tileSize, inset) {
  const halfX = room.width * tileSize / 2 + inset
  const halfZ = room.height * tileSize / 2 + inset
  const corners = [
    { x: -halfX, z: -halfZ }, { x: halfX, z: -halfZ },
    { x: -halfX, z: halfZ }, { x: halfX, z: halfZ },
  ]
  const sides = SIDES.map(side => {
    const horizontal = side === 'top' || side === 'bottom'
    const length = horizontal ? room.width : room.height
    const normal = horizontal ? (side === 'top' ? -halfZ : halfZ) : (side === 'left' ? -halfX : halfX)
    const point = along => horizontal ? { x: along, z: normal } : { x: normal, z: along }
    const cornerAlong = horizontal ? halfX : halfZ
    const entries = doors.filter(door => door.side === side).map(door => ({ door, ...templeDoorPlacement(room, door, tileSize, inset) }))
    const replaced = new Set(entries.flatMap(entry => entry.indices))
    const slots = Array.from({ length }, (_, index) => ({
      index, ...point((index - (length - 1) / 2) * tileSize),
      kind: index % 2 === 0 ? 'small' : 'medium',
    }))
    const nodes = [point(-cornerAlong), ...slots, point(cornerAlong)]
    const rails = []
    for (let index = 0; index < nodes.length - 1; index++) {
      const betweenGridPosts = index > 0 && index < nodes.length - 2
      if (betweenGridPosts && entries.some(entry => index === entry.first + 1)) continue
      const a = nodes[index], b = nodes[index + 1]
      rails.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, length: Math.hypot(b.x - a.x, b.z - a.z) })
    }
    return { side, horizontal, posts: slots.filter(slot => !replaced.has(slot.index)), slots, rails, entries }
  })
  return { corners, sides }
}
