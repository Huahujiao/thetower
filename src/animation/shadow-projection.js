import { shadowPartShape } from './shadow-geometry.js'

const contours = new Map()

function contour(part) {
  const key = [part.shape, part.width, part.height, part.pivotX, part.pivotY].join(':')
  if (!contours.has(key)) {
    if (contours.size > 512) contours.clear()
    const points = shadowPartShape(part).getPoints(8)
    if (points[0].distanceTo(points.at(-1)) < .001) points.pop()
    const area = points.reduce((sum, p, i) => sum + p.x * points[(i + 1) % points.length].y - p.y * points[(i + 1) % points.length].x, 0)
    if (area < 0) points.reverse()
    contours.set(key, points)
  }
  return contours.get(key)
}

function worldPoint(matrix, p, z) {
  const e = matrix.elements
  return { x: e[0] * p.x + e[4] * p.y + e[8] * z + e[12],
    y: e[1] * p.x + e[5] * p.y + e[9] * z + e[13],
    z: e[2] * p.x + e[6] * p.y + e[10] * z + e[14] }
}

function face(points, entry) {
  const a = points[0], b = points[1], c = points[2]
  const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z
  const vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
  const length = Math.hypot(nx, ny, nz)
  if (length < .0001) return null
  if (nz <= 0 && entry.part.depth > 0) return null
  if (nz < 0) { nx = -nx; ny = -ny; nz = -nz }
  const light = .67 + .33 * Math.max(0, (-.3 * nx + .5 * ny + .81 * nz) / length)
  const hex = entry.part.fill.replace('#', '')
  const color = /^[a-f\d]{6}$/i.test(hex) ? parseInt(hex, 16) : 0x809080
  const shade = (shift) => Math.round(((color >> shift) & 255) * light)
  return { points: points.map((p) => ({ x: p.x, y: -p.y })),
    z: points.reduce((sum, p) => sum + p.z, 0) / points.length,
    fill: `rgb(${shade(16)},${shade(8)},${shade(0)})`, opacity: entry.opacity,
    layer: entry.part.layer, partId: entry.part.id }
}

// Orthographic sprite projection of the same Y-up, Z-front volumes used by
// the editor. Only the final screen coordinates have downward-positive Y.
export function projectShadowFaces(evaluation) {
  const faces = []
  for (const entry of evaluation.parts) {
    if (entry.part.visual.type === 'texture') continue
    const points = contour(entry.part)
    const half = (entry.part.depth || 0) / 2
    const front = points.map((p) => worldPoint(entry.matrix, p, half))
    const cap = face(front, entry)
    if (cap) faces.push(cap)
    if (!half) continue
    const back = points.map((p) => worldPoint(entry.matrix, p, -half))
    const backCap = face([...back].reverse(), entry)
    if (backCap) faces.push(backCap)
    for (let i = 0; i < points.length; i += 1) {
      const j = (i + 1) % points.length
      const side = face([back[i], back[j], front[j], front[i]], entry)
      if (side) faces.push(side)
    }
  }
  return faces.sort((a, b) => a.z - b.z || a.layer - b.layer)
}
