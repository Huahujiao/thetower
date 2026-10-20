import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { Group } from 'three'
import { CARD_BACK_PALETTE_KEY, CARD_BACK_COLOR_DEFAULTS, loadCardBackPalette, saveCardBackPalette, normalizeCardBackColor } from '../src/settings/card-back-palette.js'

const stored = new Map([['game-save', 'keep-this-save']])
const storage = { getItem: key => stored.get(key) ?? null, setItem: (key,value) => stored.set(key,value), removeItem: key => stored.delete(key) }
assert.deepEqual(loadCardBackPalette(storage), CARD_BACK_COLOR_DEFAULTS)
assert.equal(normalizeCardBackColor(' #AbC '), '#aabbcc')
assert.equal(normalizeCardBackColor('not-a-color'), null)
assert(saveCardBackPalette({ ...CARD_BACK_COLOR_DEFAULTS, scorch: '#1849C0' }, storage))
assert.equal(loadCardBackPalette(storage).scorch, '#1849c0')
assert.equal(stored.get('game-save'), 'keep-this-save')
assert(saveCardBackPalette(CARD_BACK_COLOR_DEFAULTS, storage))
assert(!stored.has(CARD_BACK_PALETTE_KEY), 'Reset removes only the palette override')
stored.set(CARD_BACK_PALETTE_KEY, '{broken')
assert.deepEqual(loadCardBackPalette(storage), CARD_BACK_COLOR_DEFAULTS)
stored.set(CARD_BACK_PALETTE_KEY, JSON.stringify({ scorch: 'invalid', drown: '#426780' }))
assert.equal(loadCardBackPalette(storage).scorch, CARD_BACK_COLOR_DEFAULTS.scorch)
assert.equal(loadCardBackPalette(storage).drown, '#426780')
const denied = { getItem() { throw Error('denied') }, setItem() { throw Error('denied') }, removeItem() { throw Error('denied') } }
assert.deepEqual(loadCardBackPalette(denied), CARD_BACK_COLOR_DEFAULTS)
assert.equal(saveCardBackPalette({ scorch: '#123456' }, denied), false)

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
const previousDocument = globalThis.document
const context = new Proxy({}, { get: (target,key) => {
  if (key === 'fillText' || key === 'strokeText') return () => assert.fail('Seal patterns must contain no written characters')
  return target[key] ?? (() => {})
} })
globalThis.document = { createElement: tag => tag === 'img' ? {} : { getContext: () => context } }
try {
  const { GameScene } = await server.ssrLoadModule('/src/render/scene.js')
  const { BoardTextures } = await server.ssrLoadModule('/src/render/board-textures.js')
  const { createCardPaletteUniforms } = await server.ssrLoadModule('/src/render/card-palette-material.js')
  const { fixture } = await server.ssrLoadModule('/scripts/item-test-helpers.mjs')
  const { createLootEntity, makeItemById } = await server.ssrLoadModule('/src/game/data/content.js')
  const run = fixture(), room = run.currentRoom
  for (const row of room.tiles) for (const tile of row) Object.assign(tile,{ revealed: false, peeked: false })
  run.player.pos = { c: 3, r: 3 }
  room.reveal(run.player.pos)
  for (const [id,position] of [['ember-axe',{c:2,r:2}],['root-axe',{c:3,r:2}],['tide-blade',{c:4,r:2}]]) room.addEntity(createLootEntity(makeItemById(id),position))
  const scene = Object.create(GameScene.prototype)
  Object.assign(scene, { run, roomGroup: new Group(), boardTextures: new BoardTextures(), cardPaletteUniforms: createCardPaletteUniforms(),
    tileMeshes: [], tileMeshByKey: new Map(), flipAnimations: [], animationQueue: [], framedRoomId: room.id,
    _clearGroundSprite() {}, _attachEnemyFigure() {}, _attachGroundSprite() {}, _setEnemyStatusOverlay() {}, _setContactShadow() {}, _drainAnimationQueue() {}, _emitMoveCompleteIfIdle() {},
  })
  for (const position of [{c:2,r:2},{c:3,r:2},{c:4,r:2},{c:0,r:0}]) scene._addTile(room,position)
  const face = scene.tileMeshByKey.get('2:2')
  const material = face.material, map = material.map, seal = material.uniforms.mistSeal.value
  assert(material.userData.sealMist)
  assert.equal(material.uniforms.mistArt.value, material.map, 'The seal reuses its original ornament texture')
  assert.equal(material.uniforms.mistRelief.value, scene.boardTextures.backNormal(material.map), 'The seal reuses its matching engraving data')
  const veil = face.userData.sealVeil, upperMist = veil.userData.upperMist
  const plumes = veil.userData.plumes, runes = veil.userData.runes
  assert.equal(runes.parent, veil)
  assert.equal(runes.material.uniforms.runeTime, material.uniforms.mistTime)
  assert.equal(runes.material.uniforms.runeColor.value, material.uniforms.mistColor.value)
  assert.equal(runes.material.uniforms.runeTint, material.uniforms.mistTint)
  assert.equal(runes.material.uniforms.runeDissolve, material.uniforms.mistDissolve)
  assert(upperMist.renderOrder < runes.renderOrder && runes.renderOrder < plumes.renderOrder)
  let runeMaterialReleased = 0, runeGeometryReleased = 0
  runes.material.addEventListener('dispose', () => runeMaterialReleased++)
  runes.geometry.addEventListener('dispose', () => runeGeometryReleased++)
  assert.deepEqual([material, veil.material, upperMist.material].map(layer => layer.uniforms.mistLayer.value), [0, 1, 2])
  for (const layer of [veil.material, upperMist.material]) {
    assert.equal(layer.uniforms.mistTime, material.uniforms.mistTime, 'Three haze heights follow the advancing clock')
    assert.equal(layer.uniforms.mistColor.value, material.uniforms.mistColor.value, 'Every haze layer follows live palette updates')
    assert.equal(layer.uniforms.mistDissolve, material.uniforms.mistDissolve, 'All haze heights dissipate together')
  }
  assert.equal(upperMist.parent, veil, 'Hidden seals hide every haze height through their parent')
  assert(upperMist.position.z > 0)
  assert.equal(upperMist.geometry, veil.geometry, 'The added height reuses existing veil mesh data')
  assert(veil.renderOrder < upperMist.renderOrder && upperMist.renderOrder < plumes.renderOrder)
  let hazeReleased = 0, hazeGeometryReleased = 0
  for (const layer of [veil.material, upperMist.material]) layer.addEventListener('dispose', () => hazeReleased++)
  veil.geometry.addEventListener('dispose', () => hazeGeometryReleased++)
  assert.equal(plumes.material.uniforms.plumeColor.value, material.uniforms.mistColor.value, 'Energy flow follows the selected seal colour')
  assert.equal(plumes.material.uniforms.plumeDissolve, material.uniforms.mistDissolve, 'Energy flow dissipates with the base seal')
  assert.equal(plumes.userData.filaments.material.uniforms.plumeColor.value, material.uniforms.mistColor.value)
  assert.equal(plumes.userData.filaments.material.uniforms.plumeDissolve, material.uniforms.mistDissolve)
  assert.equal(plumes.material.uniforms.plumeTime, material.uniforms.mistTime, 'Dense energy sheets share the advancing seal clock')
  assert.equal(plumes.userData.filaments.material.uniforms.plumeTime, material.uniforms.mistTime, 'Thin currents move with the dense sheets')
  assert.equal(plumes.material.uniforms.flowDetail.value, 0)
  assert.equal(plumes.userData.filaments.material.uniforms.flowDetail.value, 1)
  assert.equal(face.userData.body.visible, false, 'A seal has no physical card slab')
  const initialY = face.position.y
  scene.hoveredTileKey = '2:2'
  scene.depressedTileKeys = new Set()
  scene._updateHoverLift()
  assert.equal(face.position.y, initialY, 'Hovering a seal never lifts a card')
  const time = material.uniforms.mistTime.value
  scene.sealMist.update(.3)
  assert.equal(material.uniforms.mistTime.value, time + .3)
  const before = JSON.stringify(run.serialize()), color = material.uniforms.mistColor.value
  const custom = { scorch: '#1849c0', wither: '#c19020', drown: '#228a70' }
  scene.setCardBackPalette(custom)
  assert.equal(JSON.stringify(run.serialize()), before, 'Tuning spends no action and changes no game state')
  assert.equal(face.material, material)
  assert.equal(material.map, map)
  assert.equal(material.uniforms.mistSeal.value, seal)
  assert.equal(material.uniforms.mistColor.value, color, 'Live colour uniform identity is stable')
  assert.equal(color.getHexString(), '1849c0')
  const blocked = scene.tileMeshByKey.get('0:0')
  assert(blocked.userData.fogged)
  assert(!blocked.material.visible, 'Unknown regions reveal no attribute')
  const materialCount = scene.sealMist.materials.size
  scene._refreshTile(room, { c: 2, r: 2 }, { force: true })
  assert.equal(scene.sealMist.materials.size, materialCount, 'Refreshing releases the previous fog and floating-layer materials')
  assert.equal(hazeReleased, 2, 'Both raised haze materials are released on refresh')
  assert.equal(hazeGeometryReleased, 1, 'Shared haze mesh data is released once')
  assert.equal(runeMaterialReleased, 1, 'Refreshing releases the previous rising-symbol material')
  assert.equal(runeGeometryReleased, 1, 'Refreshing releases the previous symbol geometry')
  assert.equal(face.material.uniforms.mistColor.value, color)
  const snapshot = scene._snapshotFlipBack({ roomId: room.id, position: { c: 2, r: 2 } })
  let released = 0
  snapshot.addEventListener('dispose', () => released++)
  room.reveal({ c: 2, r: 2 })
  assert(scene._startFlip({ roomId: room.id, position: { c: 2, r: 2 } }, snapshot))
  const dispel = scene.flipAnimations[0]
  assert(dispel.dispelling)
  assert.equal(dispel.group.rotation.x, 0, 'Dispelling never rotates a card')
  assert.equal(dispel.back.material.uniforms.mistColor.value, color)
  scene.setCardBackPalette({ ...custom, scorch: '#18c040' })
  assert.equal(dispel.back.material.uniforms.mistColor.value.getHexString(), '18c040')
  const dispelRunes = dispel.back.getObjectByName('seal-rising-runes')
  assert.equal(dispelRunes.material.uniforms.runeColor.value.getHexString(), '18c040', 'Dispersing symbols recolour in place too')
  assert.equal(dispelRunes.material.uniforms.runeDissolve, dispel.back.material.uniforms.mistDissolve)
  scene._updateFlipAnimations(.15)
  assert(dispel.back.material.uniforms.mistDissolve.value > 0)
  assert.equal(dispel.group.rotation.x, 0)
  scene.setCardBackPalette(CARD_BACK_COLOR_DEFAULTS)
  assert.equal(color.getHexString(), CARD_BACK_COLOR_DEFAULTS.scorch.slice(1))
  scene._updateFlipAnimations(1)
  assert.equal(released, 1, 'Completed dispelling releases its snapshot')
  assert.equal(scene.flipAnimations.length, 0)
  assert.equal(face.material.isMeshBasicMaterial, true, 'Revealed content keeps its existing art')
  let masksDisposed = 0
  for (const seal of scene.sealMist.seals) seal.addEventListener('dispose', () => masksDisposed++)
  scene.sealMist.dispose()
  assert.equal(masksDisposed, 4)
  assert.equal(scene.sealMist.materials.size, 0)
  scene.explorationFog?.dispose()
  scene.boardTextures.dispose()
  console.log('Seal palette passed: isolated persistence/reset, live smoke colours, stable masks, hidden regions, refresh, dispelling and resource lifetime.')
} finally {
  if(previousDocument===undefined)delete globalThis.document
  else globalThis.document=previousDocument
  await server.close()
}
