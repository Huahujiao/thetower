import assert from 'node:assert/strict'
import { boundaryPillarPoint, evenPillarOffsets } from '../src/render/wall-kit.js'

assert.deepEqual(evenPillarOffsets(1), [0])
assert.deepEqual(evenPillarOffsets(2), [0, 1])
assert.deepEqual(evenPillarOffsets(5), [0, 2, 4])
assert.deepEqual(evenPillarOffsets(9), [0, 3, 5, 8])
assert.deepEqual(evenPillarOffsets(9, [3]), [0, 2, 5, 8])
for (const length of [3, 5, 8, 9, 12, 15]) {
  const offsets = evenPillarOffsets(length)
  assert.equal(offsets[0], 0)
  assert.equal(offsets.at(-1), length - 1)
  assert(offsets.slice(1).every((offset, index) => offset > offsets[index]))
  assert(Math.max(...offsets.slice(1).map((offset, index) => offset - offsets[index])) <= 3)
}
const room = { width: 9, height: 5 }
const inset = 0.14 / 2 + 0.012
const topLeft = boundaryPillarPoint(room, 'top', 0, 1.14, inset)
const leftTop = boundaryPillarPoint(room, 'left', 0, 1.14, inset)
const bottomRight = boundaryPillarPoint(room, 'bottom', room.width - 1, 1.14, inset)
const rightBottom = boundaryPillarPoint(room, 'right', room.height - 1, 1.14, inset)
assert.deepEqual(topLeft, leftTop)
assert.deepEqual(bottomRight, rightBottom)
assert(topLeft.x < -4.5 && topLeft.z < -2.5)
console.log('wall-kit-check passed: corner dedupe inputs, length-based spacing, door avoidance')
