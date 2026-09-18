import assert from 'node:assert/strict'
import * as THREE from 'three'
import { cardBodyGeometry, styleCardBody, cardFaceY, CARD_FACE_CLEARANCE, HIDDEN_CARD_THICKNESS, HIDDEN_CARD_SCALE } from '../src/render/card-body.js'

const geometry = cardBodyGeometry(1.14, 0.08)
const body = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial())
const texture = new THREE.Texture()
texture.userData.boardShared = true
const close = (a, b) => assert(Math.abs(a - b) < 1e-8)
const colors = new Set()
for (const attribute of ['neutral', 'scorch', 'wither', 'drown']) {
  styleCardBody(body, { hidden: true, attribute, texture, baseThickness: 0.08 })
  close(body.scale.y * 0.08, HIDDEN_CARD_THICKNESS)
  close(body.position.y - HIDDEN_CARD_THICKNESS / 2, -0.04)
  close(body.position.y + HIDDEN_CARD_THICKNESS / 2, 0.14)
  close(cardFaceY(true, 0.08) - (body.position.y + HIDDEN_CARD_THICKNESS / 2), CARD_FACE_CLEARANCE)
  close(body.scale.x, HIDDEN_CARD_SCALE)
  assert.equal(body.material.map, texture)
  colors.add(body.material.color.getHex())
}
assert.equal(colors.size, 4)
styleCardBody(body, { hidden: true, attribute: 'scorch', blocked: true, texture, baseThickness: 0.08 })
assert.equal(body.material.color.getHex(), 0x555a62)
for (let i = 0; i < geometry.attributes.uv.count; i++) {
  const v = geometry.attributes.uv.getY(i)
  assert(v >= 0.0349 && v <= 0.0901)
}
styleCardBody(body, { hidden: false, baseThickness: 0.08 })
assert.deepEqual(body.scale.toArray(), [1, 1, 1])
assert.equal(body.position.y, 0)
close(cardFaceY(false, 0.08) - 0.04, CARD_FACE_CLEARANCE)
assert.equal(body.material.map, null)
assert.equal(texture.userData.boardShared, true)
geometry.dispose()
body.material.dispose()
texture.dispose()
console.log('card-body-check passed: raised slab, inset edges, four themes, border UVs, revealed reset')
