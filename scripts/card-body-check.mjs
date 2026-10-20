import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createCardFaceMaterial, cardBodyGeometry, styleCardBody, cardFaceY, groundSurfaceY, cardRestY, hiddenCardBodyY, CARD_FACE_CLEARANCE, CARD_FLOOR_GAP, HIDDEN_CARD_THICKNESS, HIDDEN_CARD_SCALE } from '../src/render/card-body.js'

const FLOOR_THICKNESS = 0.08

const geometry = cardBodyGeometry(1.14, 0.08)
const body = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial())
const texture = new THREE.Texture()
texture.userData.boardShared = true
const close = (a, b) => assert(Math.abs(a - b) < 1e-8)

// A card must read as a thin object hovering over the paving, not as another
// slab: thinner than the floor it sits on, with real air beneath it. The air
// has to be measured against the visible stone, not folded into its height.
assert(HIDDEN_CARD_THICKNESS < FLOOR_THICKNESS, 'Card body must be thinner than the floor slab')
assert(CARD_FLOOR_GAP > CARD_FACE_CLEARANCE, 'Cards must float clear of the floor, not lie on it')
close(groundSurfaceY(FLOOR_THICKNESS) - FLOOR_THICKNESS / 2, CARD_FACE_CLEARANCE)
close(cardRestY(FLOOR_THICKNESS) - groundSurfaceY(FLOOR_THICKNESS), CARD_FLOOR_GAP)
close(cardFaceY(false, FLOOR_THICKNESS), cardRestY(FLOOR_THICKNESS))
close(hiddenCardBodyY(FLOOR_THICKNESS) - HIDDEN_CARD_THICKNESS / 2, cardRestY(FLOOR_THICKNESS))
close(cardFaceY(true, FLOOR_THICKNESS) - cardRestY(FLOOR_THICKNESS), HIDDEN_CARD_THICKNESS + CARD_FACE_CLEARANCE)

const colors = new Set()
for (const attribute of ['neutral', 'scorch', 'wither', 'drown']) {
  styleCardBody(body, { hidden: true, attribute, texture, baseThickness: 0.08 })
  close(body.scale.y * 0.08, HIDDEN_CARD_THICKNESS)
  close(body.position.y - HIDDEN_CARD_THICKNESS / 2, cardFaceY(false, 0.08))
  close(body.position.y + HIDDEN_CARD_THICKNESS / 2, cardFaceY(false, 0.08) + HIDDEN_CARD_THICKNESS)
  close(cardFaceY(true, 0.08) - (body.position.y + HIDDEN_CARD_THICKNESS / 2), CARD_FACE_CLEARANCE)
  close(body.scale.x, HIDDEN_CARD_SCALE)
  assert.equal(body.material.map, texture)
  colors.add(body.material.color.getHex())
}
assert.equal(colors.size, 4)
styleCardBody(body, { hidden: true, attribute: 'scorch', blocked: true, texture, baseThickness: 0.08 })
assert.equal(body.material.color.getHex(), 0x3d4447)
for (let i = 0; i < geometry.attributes.uv.count; i++) {
  const v = geometry.attributes.uv.getY(i)
  assert(v >= 0.0349 && v <= 0.0901)
}
styleCardBody(body, { hidden: false, baseThickness: 0.08 })
assert.deepEqual(body.scale.toArray(), [1, 1, 1])
assert.equal(body.position.y, 0)
close(cardFaceY(false, 0.08) - 0.04, CARD_FACE_CLEARANCE + CARD_FLOOR_GAP)
assert.equal(body.material.map, null)
assert.equal(texture.userData.boardShared, true)
const normal = new THREE.Texture()
normal.colorSpace = THREE.NoColorSpace
normal.userData.boardShared = true
const back = createCardFaceMaterial(texture, normal, { depthWrite: false })
assert(back.isMeshStandardMaterial, 'Rough stone backs respond to scene lighting')
assert(back.roughness >= .75, 'Restore the matte stone finish')
assert.equal(back.metalness, 0)
assert.equal(back.normalMap, normal)
assert.equal(back.normalMapType, THREE.TangentSpaceNormalMap)
assert.equal(back.emissiveMap, texture)
assert.equal(back.depthWrite, false)
assert.equal(back.side, THREE.DoubleSide)
assert.equal(back.polygonOffset, true)
const front = createCardFaceMaterial(texture, null, { transparent: true, opacity: .46 })
assert(front.isMeshBasicMaterial, 'Revealed faces keep their unlit art and alpha')
assert.equal(front.transparent, true)
assert.equal(front.opacity, .46)
assert.equal(front.normalMap, undefined)
let normalsDisposed = 0
normal.addEventListener('dispose', () => normalsDisposed++)
back.dispose(); front.dispose()
assert.equal(normalsDisposed, 0, 'Face material disposal must not destroy the shared normal')
normal.dispose()
geometry.dispose()
body.material.dispose()
texture.dispose()
console.log('card-body-check passed: raised slab, inset edges, four themes, border UVs, revealed reset')
