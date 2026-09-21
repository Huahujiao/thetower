function finiteSize(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

export function inventoryItemLayout(backpack, item, rotation, gridRect, columns, rows) {
  const shape = backpack.shapeFor(item, rotation)
  const width = Math.max(1, shape[0]?.length || 1)
  const height = Math.max(1, shape.length || 1)
  const cellWidth = finiteSize(gridRect?.width, columns * 36) / columns
  const cellHeight = finiteSize(gridRect?.height, rows * 36) / rows
  return {
    shape,
    width,
    height,
    cellWidth,
    cellHeight,
    pixelWidth: cellWidth * width,
    pixelHeight: cellHeight * height,
  }
}

// The drag preview is centered below the touch. Snap the preview's bounding
// box center to the backpack grid, rather than treating the touch as the
// item's top-left anchor. Rounding gives a half-cell acceptance tolerance.
export function inventoryDropAnchorAtCenter({ backpack, item, rotation, gridRect, clientX, clientY, columns, rows }) {
  if (!gridRect || clientX < gridRect.left || clientX >= gridRect.right || clientY < gridRect.top || clientY >= gridRect.bottom) return null
  const layout = inventoryItemLayout(backpack, item, rotation, gridRect, columns, rows)
  const originX = Math.round((clientX - gridRect.left) / layout.cellWidth - layout.width / 2)
  const originY = Math.round((clientY - gridRect.top) / layout.cellHeight - layout.height / 2)
  const anchor = backpack.anchorFor(item, rotation)
  const anchorX = originX + anchor.x
  const anchorY = originY + anchor.y
  if (anchorX < 0 || anchorX >= columns || anchorY < 0 || anchorY >= rows) return null
  return anchorY * columns + anchorX
}

function clampCenter(position, layout, stashRect) {
  const halfWidth = layout.pixelWidth / 2
  const halfHeight = layout.pixelHeight / 2
  const minX = Math.min(stashRect.width / 2, halfWidth + 4)
  const maxX = Math.max(stashRect.width / 2, stashRect.width - halfWidth - 4)
  const minY = Math.min(stashRect.height / 2, halfHeight + 4)
  const maxY = Math.max(stashRect.height / 2, stashRect.height - halfHeight - 4)
  const x = Math.max(minX, Math.min(maxX, position.x))
  const y = Math.max(minY, Math.min(maxY, position.y))
  return { x: x / stashRect.width * 100, y: y / stashRect.height * 100 }
}

export function stashPositionAtPoint({ item, rotation, clientX, clientY, stashRect, gridRect, backpack, columns, rows }) {
  if (!stashRect) return { x: 50, y: 50, pendingAuto: true }
  const layout = inventoryItemLayout(backpack, item, rotation, gridRect, columns, rows)
  return clampCenter({ x: clientX - stashRect.left, y: clientY - stashRect.top }, layout, stashRect)
}

function occupiedRects(item, position, rotation, options) {
  const layout = inventoryItemLayout(options.backpack, item, rotation, options.gridRect, options.columns, options.rows)
  const centerX = options.stashRect.width * Number(position?.x || 50) / 100
  const centerY = options.stashRect.height * Number(position?.y || 50) / 100
  const left = centerX - layout.pixelWidth / 2
  const top = centerY - layout.pixelHeight / 2
  const cells = []
  for (let y = 0; y < layout.height; y += 1) {
    for (let x = 0; x < layout.width; x += 1) {
      if (!layout.shape[y]?.[x]) continue
      cells.push({ x: left + x * layout.cellWidth, y: top + y * layout.cellHeight, width: layout.cellWidth, height: layout.cellHeight })
    }
  }
  return cells
}

function overlapArea(left, right) {
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x))
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y))
  return width * height
}

// Prefer an exact non-overlapping placement. If the staging canvas is already
// crowded, choose the candidate with the smallest occupied-cell overlap.
export function automaticStashPosition({ item, rotation, stashItems, positions, stashRect, gridRect, backpack, columns, rows }) {
  if (!stashRect || stashRect.width <= 0 || stashRect.height <= 0) return null
  const options = { stashRect, gridRect, backpack, columns, rows }
  const layout = inventoryItemLayout(backpack, item, rotation, gridRect, columns, rows)
  const existing = stashItems
    .filter((candidate) => candidate?.uid && candidate.uid !== item.uid && positions[candidate.uid]?.x != null && positions[candidate.uid]?.y != null)
    .flatMap((candidate) => occupiedRects(candidate, positions[candidate.uid], Number(candidate.bagRotation) || 0, options))
  const halfWidth = layout.pixelWidth / 2
  const halfHeight = layout.pixelHeight / 2
  const minX = Math.min(stashRect.width / 2, halfWidth + 4)
  const maxX = Math.max(stashRect.width / 2, stashRect.width - halfWidth - 4)
  const minY = Math.min(stashRect.height / 2, halfHeight + 4)
  const maxY = Math.max(stashRect.height / 2, stashRect.height - halfHeight - 4)
  const stepX = Math.max(8, layout.cellWidth + 4)
  const stepY = Math.max(8, layout.cellHeight + 4)
  let best = null
  let order = 0
  for (let y = minY; y <= maxY + .01; y += stepY) {
    for (let x = minX; x <= maxX + .01; x += stepX) {
      const position = { x: x / stashRect.width * 100, y: y / stashRect.height * 100 }
      const score = occupiedRects(item, position, rotation, options)
        .reduce((total, cell) => total + existing.reduce((overlap, other) => overlap + overlapArea(cell, other), 0), 0)
      if (!best || score < best.score || (score === best.score && order < best.order)) best = { position, score, order }
      order += 1
    }
  }
  return best?.position || { x: 50, y: 50 }
}
