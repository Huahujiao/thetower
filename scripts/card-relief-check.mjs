import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { Group, Texture } from 'three'

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
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
    run, cameraAzimuth: .25, contactShadowTexture: new Texture(), boardTextures: new BoardTextures(), roomGroup: new Group(), tileMeshes: [], tileMeshByKey: new Map(),
    flipAnimations: [], animationQueue: [], framedRoomId: room.id,
    _clearGroundSprite() {}, _attachEnemyFigure() {}, _attachGroundSprite() {},
    _setEnemyStatusOverlay() {}, _setContactShadow() {}, _drainAnimationQueue() {}, _emitMoveCompleteIfIdle() {},
  })
  room.tile(position).revealed = false
  scene._addTile(room, position)
  const face = scene.tileMeshes[0]
  const backTexture = face.material.map, backColor = face.material.color.clone()
  const backTone = scene._cardColorVariant(backTexture, position)
  const backUV = Array.from(face.geometry.attributes.uv.array)
  const floorUV = Array.from(face.userData.floorBacking.geometry.attributes.uv.array)
  const normal = scene.boardTextures.backNormal(face.material.map)
  assert(face.material.userData.sealMist)
  assert.equal(face.material.normalMap, undefined)
  assert(face.receiveShadow)
  let disposedNormals = 0
  normal.addEventListener('dispose', () => disposedNormals++)
  room.tile(position).revealed = true
  assert(scene._refreshTile(room, position))
  assert(face.material.isMeshBasicMaterial, 'Revealed ground must not keep a back normal')
  assert.equal(face.material.normalMap, undefined)
  room.tile(position).revealed = false
  assert(scene._refreshTile(room, position))
  assert(face.material.userData.sealMist)
  assert.equal(face.material.normalMap, undefined)
  assert.equal(face.material.map, backTexture, 'Rehide keeps the authored pattern')
  assert.deepEqual(Array.from(face.geometry.attributes.uv.array), backUV, 'Rehide restores the card texture rotation')
  assert.equal(scene._cardColorVariant(face.material.map, position), backTone, 'Refresh keeps the pigment colour')
  assert(face.material.color.equals(backColor), 'Refresh preserves per-card value without shifting hue')
  const snapshot = scene._snapshotFlipBack({ roomId: room.id, position })
  assert.equal(scene.boardTextures.backNormal(snapshot), normal)
  const { createLootEntity, makeItemById } = await server.ssrLoadModule('/src/game/data/content.js')
  room.addEntity(createLootEntity(makeItemById('ember-axe'), position))
  const itemTexture = new Texture({ width: 128, height: 128 })
  itemTexture.userData.boardShared = true
  scene._clearGroundSprite = GameScene.prototype._clearGroundSprite
  // Use a ready texture while exercising the real sprite mesh and refresh path.
  scene._attachGroundSprite = (face, card, point, position, revealed) => {
    scene._clearGroundSprite(face)
    const descriptor = revealed && scene._groundSpriteDescriptor(card, position)
    if (descriptor) scene._groundSpriteMesh(face, itemTexture, descriptor, point, position)
  }
  room.tile(position).revealed = true
  assert(scene._startFlip({ roomId: room.id, position }, snapshot))
  const flip = scene.flipAnimations[0]
  assert(flip.dispelling, 'Revealing now dissolves smoke instead of flipping geometry')
  assert(flip.back.material.userData.sealMist)
  assert.equal(flip.group.rotation.x, 0)
  assert(flip.back.material.color.equals(backColor))
  assert.equal(scene._cardColorVariant(flip.back.material.map, position), backTone)
  assert.deepEqual(Array.from(face.userData.floorBacking.geometry.attributes.uv.array), floorUV)
  const itemSprite = face.userData.groundSprite
  assert(itemSprite, 'Loot is visible while the seal dispels')
  scene._updateFlipAnimations(.35)
  scene._updateItemSprites(.35)
  const spin = { ...itemSprite.userData.itemSpin }
  const heading = itemSprite.rotation.y, floatY = itemSprite.position.y
  scene._updateFlipAnimations(.4)
  assert.equal(face.userData.groundSprite, itemSprite, 'Finishing dispelling keeps the live item mesh')
  assert.deepEqual(itemSprite.userData.itemSpin, spin, 'Finishing dispelling preserves the rotation timeline')
  assert.equal(itemSprite.rotation.y, heading)
  assert.equal(itemSprite.position.y, floatY, 'Hovering phase must also remain continuous')
  scene._updateItemSprites(.02)
  assert(Math.abs(itemSprite.userData.itemSpin.angle - spin.angle - .02 * spin.speed) < 1e-9)
  // A changed entity must still refresh when dispelling ends.
  room.tile(position).revealed = false
  scene._refreshTile(room, position)
  room.tile(position).revealed = true
  assert(scene._startFlip({ roomId: room.id, position }))
  room.removeEntity(room.entityAt(position).id)
  scene._updateFlipAnimations(1)
  assert.equal(face.userData.groundSprite, null, 'Changed loot cannot survive the final refresh')
  scene._clearGroundSprite(face)
  itemTexture.dispose()
  scene._attachGroundSprite = () => {}
  assert.equal(scene.flipAnimations.length, 0)
  assert(face.material.isMeshBasicMaterial)
  assert.equal(disposedNormals, 0, 'Refreshing and finishing a flip must preserve shared normals')
  // Reachability controls the back for all attributes, including the art review.
  run.sceneView = { showUnreachableCardAttributes: true } // A stale preview flag must not bypass the rule.
  for (const entity of [...room.entities.values()]) room.removeEntity(entity.id)
  for (const row of room.tiles) for (const tile of row) Object.assign(tile, { revealed: false, peeked: false })
  run.player.pos = { c: 0, r: 0 }
  room.reveal(run.player.pos)
  const target = { c: 2, r: 0 }
  room.addEntity(createLootEntity(makeItemById('ember-axe'), target))
  assert.equal(run.tileCanBeFlipped(target), false)
  scene._addTile(room, target)
  const distant = scene.tileMeshByKey.get('2:0')
  const blocked = scene.boardTextures.back('neutral', true)
  assert.equal(distant.material.map, blocked, 'Unreachable weapon attributes stay concealed')
  assert.equal(distant.userData.body.material.map, blocked, 'Card edges use the same blocked back')
  const blockedColor = distant.material.color.clone()
  for (const [index, kind] of ['neutral', 'scorch', 'wither', 'drown'].entries()) {
    const position = { c: index, r: 4 }
    const texture = scene._makeBackTexture(kind, { unflippable: true, position })
    assert.equal(texture, blocked, 'All unreachable attributes share one back')
    const material = scene._makeCardFaceMaterial(texture, {}, position)
    assert(material.color.equals(blockedColor), 'Unreachable backs have one uniform dark finish')
    assert.equal(scene._cardColorVariant(texture, position), 0)
    material.dispose()
  }
  room.reveal({ c: 1, r: 0 })
  assert(run.tileCanBeFlipped(target), 'An explored route makes the target reachable')
  scene._refreshTile(room, target)
  const reachableBack = distant.material.map
  assert.equal(reachableBack.userData.cardBackKind, 'scorch', 'Newly reachable backs expose their attribute')
  assert.equal(distant.userData.body.material.map, reachableBack)
  scene._refreshTile(room, target, { force: true })
  assert.equal(distant.material.map, reachableBack, 'Refresh keeps the chosen attribute pattern')
  assert(distant.material.uniforms.mistSeal.value, 'Reachable seals bind their shared calligraphy mask')
  assert(!distant.userData.body.visible, 'No card edge remains under the mist')
  room.tile({ c: 1, r: 0 }).revealed = false
  scene._refreshTile(room, target)
  assert.equal(distant.material.map, blocked, 'Losing access restores the uniform blocked back')
  assert(distant.material.color.equals(blockedColor))
  scene.sealMist.dispose()
  scene.boardTextures.dispose()
  scene.contactShadowTexture.dispose()
  assert.equal(disposedNormals, 1)
  console.log('seal scene passed: reveal, rehide, continuous item spin, changed loot refresh, reachability masking and shared resource lifetime')
} finally {
  if (previousDocument === undefined) delete globalThis.document
  else globalThis.document = previousDocument
  await server.close()
}
