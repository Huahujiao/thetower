import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { Group } from 'three'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const previousDocument = globalThis.document
const context = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}) })
globalThis.document = { createElement: tag => tag === 'img' ? {} : { getContext: () => context } }
try {
  const { GameScene } = await server.ssrLoadModule('/src/render/scene.js')
  const { BoardTextures } = await server.ssrLoadModule('/src/render/board-textures.js')
  const { fixture } = await server.ssrLoadModule('/scripts/item-test-helpers.mjs')
  const run = fixture(), room = run.currentRoom, position = { c: 2, r: 3 }
  const scene = Object.create(GameScene.prototype)
  Object.assign(scene, {
    run, boardTextures: new BoardTextures(), roomGroup: new Group(), tileMeshes: [], tileMeshByKey: new Map(),
    flipAnimations: [], animationQueue: [], framedRoomId: room.id,
    _clearGroundSprite() {}, _attachEnemyFigure() {}, _attachGroundSprite() {},
    _setEnemyStatusOverlay() {}, _setContactShadow() {}, _drainAnimationQueue() {}, _emitMoveCompleteIfIdle() {},
  })
  room.tile(position).revealed = false
  scene._addTile(room, position)
  const face = scene.tileMeshes[0]
  const normal = scene.boardTextures.backNormal(face.material.map)
  assert(face.material.isMeshStandardMaterial)
  assert.equal(face.material.normalMap, normal)
  assert(face.receiveShadow)
  let disposedNormals = 0
  normal.addEventListener('dispose', () => disposedNormals++)
  room.tile(position).revealed = true
  assert(scene._refreshTile(room, position))
  assert(face.material.isMeshBasicMaterial, 'Revealed ground must not keep a back normal')
  assert.equal(face.material.normalMap, undefined)
  room.tile(position).revealed = false
  assert(scene._refreshTile(room, position))
  assert(face.material.isMeshStandardMaterial)
  assert.equal(face.material.normalMap, normal)
  const snapshot = scene._snapshotFlipBack({ roomId: room.id, position })
  assert.equal(scene.boardTextures.backNormal(snapshot), normal)
  room.tile(position).revealed = true
  assert(scene._startFlip({ roomId: room.id, position }, snapshot))
  const flip = scene.flipAnimations[0]
  assert(flip.front.material.isMeshBasicMaterial)
  assert(flip.back.material.isMeshStandardMaterial)
  assert.equal(flip.back.material.normalMap, normal, 'Flip snapshot must retain the same relief')
  scene._updateFlipAnimations(1)
  assert.equal(scene.flipAnimations.length, 0)
  assert(face.material.isMeshBasicMaterial)
  assert.equal(disposedNormals, 0, 'Refreshing and finishing a flip must preserve shared normals')
  scene.boardTextures.dispose()
  assert.equal(disposedNormals, 1)
  console.log('card-relief-check passed: initial back, reveal, rehide, queued snapshot, flip lighting and shared normal lifetime')
} finally {
  if (previousDocument === undefined) delete globalThis.document
  else globalThis.document = previousDocument
  await server.close()
}
