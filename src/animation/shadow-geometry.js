import { ExtrudeGeometry, Shape, ShapeGeometry } from 'three'

// Parts use top-left image pivots, but their geometry lives in +Y-up space.
export function shadowPartShape(part) {
  const { width, height } = part
  const left = -width * part.pivotX
  const top = height * part.pivotY
  const bottom = top - height
  const shape = new Shape()
  if (part.shape === 'hexagon') {
    for (const [i, [x, y]] of [[.25, 0], [.75, 0], [1, .5], [.75, 1], [.25, 1], [0, .5]].entries()) {
      if (i === 0) shape.moveTo(left + x * width, top - y * height)
      else shape.lineTo(left + x * width, top - y * height)
    }
    shape.closePath()
  } else if (part.shape === 'circle' || part.shape === 'ellipse') {
    shape.absellipse(left + width / 2, top - height / 2, width / 2, height / 2, 0, Math.PI * 2, false)
  } else if (part.shape === 'capsule') {
    const r = Math.min(width, height) / 2
    shape.moveTo(left + r, bottom)
    shape.lineTo(left + width - r, bottom)
    shape.quadraticCurveTo(left + width, bottom, left + width, bottom + r)
    shape.lineTo(left + width, top - r)
    shape.quadraticCurveTo(left + width, top, left + width - r, top)
    shape.lineTo(left + r, top)
    shape.quadraticCurveTo(left, top, left, top - r)
    shape.lineTo(left, bottom + r)
    shape.quadraticCurveTo(left, bottom, left + r, bottom)
  } else if (part.shape === 'triangle') {
    shape.moveTo(left + width / 2, top)
    shape.lineTo(left, bottom)
    shape.lineTo(left + width, bottom)
    shape.closePath()
  } else if (part.shape === 'diamond') {
    shape.moveTo(left + width / 2, top)
    shape.lineTo(left, top - height / 2)
    shape.lineTo(left + width / 2, bottom)
    shape.lineTo(left + width, top - height / 2)
    shape.closePath()
  } else {
    shape.moveTo(left, bottom)
    shape.lineTo(left + width, bottom)
    shape.lineTo(left + width, top)
    shape.lineTo(left, top)
    shape.closePath()
  }
  return shape
}

export function shadowPartGeometry(part) {
  const shape = shadowPartShape(part)
  const { width, height } = part
  const depth = Math.max(0, part.depth || 0)
  if (!depth) return new ShapeGeometry(shape, 24)
  const bevel = Math.min(3, depth * .16, Math.min(width, height) * .12)
  const geometry = new ExtrudeGeometry(shape, {
    depth, steps: 1, curveSegments: 16,
    bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2,
  })
  geometry.translate(0, 0, -depth / 2)
  return geometry
}
