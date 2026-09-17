import assert from 'node:assert/strict'
import { bagShapeLayout } from '../src/ui/bag-shape.js'

const layout = bagShapeLayout([[1, 1], [1, 0]])
assert.equal(layout.cells.length, 3)
assert.deepEqual(layout.cells.map(({ x, y }) => [x, y]), [[0, 0], [1, 0], [0, 1]])
assert.deepEqual(layout.cells.map(({ edges }) => edges), [
  [true, false, false, true],
  [true, true, true, false],
  [false, true, true, true],
])
assert.deepEqual(layout.name, { x: 0, y: 0, width: 2 })
assert.deepEqual(layout.detail, { x: 0, y: 1, width: 1 })
assert.equal(layout.cells.filter(({ edges }) => edges[0]).length, 2)
assert.equal(layout.cells.filter(({ edges }) => edges[1]).length, 2)

const rotated = bagShapeLayout([[1, 0], [1, 1]])
assert.equal(rotated.cells.length, 3)
assert(rotated.cells.every(({ edges }) => edges.some(Boolean)))
console.log('bag-shape-check passed: only occupied cells receive fill/border/labels')
