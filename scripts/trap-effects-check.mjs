import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createServer } from 'vite'
import { TrapEffects } from '../src/render/trap-effects.js'
import { createTrapEntity, trapEffectCells, TRAP_EFFECT_SECONDS } from '../src/game/data/traps.js'
import { fixture, enemy } from './item-test-helpers.mjs'
import { GameRun } from '../src/game/run.js'

assert.equal(TRAP_EFFECT_SECONDS, 3)
const roomShape = { id: 'effect-room', width: 5, height: 5, contains: ({ c, r }) => c >= 0 && r >= 0 && c < 5 && r < 5 }
assert.equal(trapEffectCells(roomShape, { c: 2, r: 2 }, 'explosion').length, 9)
assert.equal(trapEffectCells(roomShape, { c: 0, r: 0 }, 'explosion').length, 4)
assert.equal(trapEffectCells(roomShape, { c: 4, r: 2 }, 'poison-fog').length, 6)
for (const trapId of ['explosion', 'poison-fog']) {
  const run = fixture(), room = run.currentRoom
  const trap = createTrapEntity(trapId, { c: 3, r: 3 }); room.addEntity(trap)
  const near = enemy(run, { hp: 10, pos: { c: 4, r: 4 } }), far = enemy(run, { hp: 10, pos: { c: 5, r: 5 } })
  const events = []
  run.on('animate:trap', event => { assert.equal(room.entity(trap.id), null, 'The visual cannot block gameplay removal'); events.push(event) })
  const hp = run.player.hp, turn = run.globalTurn
  assert(run._triggerTrap(trap)); assert.equal(run._triggerTrap(trap), false)
  assert.equal(events.length, 1); assert.equal(events[0].cells.length, 9)
  assert.equal(room.entityAt(trap.pos), null); assert.equal(trap.removeAfterGlobalTurn, undefined)
  assert.equal(run.globalTurn, turn)
  if (trapId === 'explosion') { assert.equal(run.player.hp, hp - 2); assert.equal(near.hp, 8); assert.equal(far.hp, 10) }
  else { assert.equal(run.player.hp, hp); assert.equal(run.player.poisonedTurns, 3); assert.equal(near.hp, 10); assert.equal(far.hp, 10) }
  const payload = JSON.stringify(run.serialize()), previous = globalThis.localStorage
  globalThis.localStorage = { getItem: () => payload, setItem() {}, removeItem() { assert.fail('Save rejected') } }
  try { const loaded = new GameRun(); assert(loaded._loaded); assert.equal(loaded.currentRoom.entity(trap.id), null) } finally { globalThis.localStorage = previous }
}
// Older saves with already-triggered devices must also lose the stale entity.
{
  const run = fixture(), trap = createTrapEntity('explosion', { c: 2, r: 2 })
  Object.assign(trap, { triggered: true, removeAfterGlobalTurn: 999 }); run.currentRoom.addEntity(trap)
  const payload = JSON.stringify(run.serialize()), previous = globalThis.localStorage
  globalThis.localStorage = { getItem: () => payload, setItem() {}, removeItem() { assert.fail('Save rejected') } }
  try { const loaded = new GameRun(); assert(loaded._loaded); assert.equal(loaded.currentRoom.entity(trap.id), null) } finally { globalThis.localStorage = previous }
}
{
  const run = fixture(), trap = createTrapEntity('explosion', { c: 2, r: 2 }); run.currentRoom.addEntity(trap)
  const emit = run._emitRelicEvent.bind(run); let visuals = 0
  run.on('animate:trap', () => visuals++)
  run._emitRelicEvent = (event, context) => { if (event === 'trap:before-trigger') run.suppressedTrapIds.add(trap.id); else emit(event, context) }
  const hp = run.player.hp; assert(run._triggerTrap(trap)); assert.equal(run.player.hp, hp); assert.equal(visuals, 0)
}
for (const trapId of ['explosion', 'poison-fog']) for (const position of [{ c: 2, r: 2 }, { c: 0, r: 0 }]) {
  let now = 0
  const parent = new THREE.Group(), effects = new TrapEffects(parent, { clock: () => now })
  const cells = trapEffectCells(roomShape, position, trapId)
  const event = { roomId: roomShape.id, trapId, entityId: trapId, position, cells }
  assert(effects.start(event, roomShape)); assert.equal(effects.start(event, roomShape), false)
  assert.equal(effects.entries.size, 1)
  const entry = [...effects.entries.values()][0], geometryDisposals = new Map(), materialDisposals = new Map()
  entry.group.traverse(object => {
    const hits = []; object.raycast(null, hits); assert.equal(hits.length, 0)
    if (object.geometry && !geometryDisposals.has(object.geometry)) {
      const geometry = object.geometry; geometryDisposals.set(geometry, 0)
      geometry.addEventListener('dispose', () => geometryDisposals.set(geometry, geometryDisposals.get(geometry) + 1))
      for (const attribute of Object.values(geometry.attributes)) assert([...attribute.array].every(Number.isFinite))
    }
    if (object.material && !materialDisposals.has(object.material)) {
      const material = object.material; materialDisposals.set(material, 0)
      material.addEventListener('dispose', () => materialDisposals.set(material, materialDisposals.get(material) + 1))
    }
  })
  const floor = entry.group.getObjectByName('trap-area'); floor.geometry.computeBoundingBox()
  const bounds = entry.uniforms.uBounds.value
  assert(Math.abs(floor.geometry.boundingBox.min.x - bounds.x) < 1e-6)
  assert(Math.abs(floor.geometry.boundingBox.max.z - bounds.w) < 1e-6)
  assert.equal(entry.group.getObjectByName('trap-clouds').geometry.attributes.aCenter.count, cells.length * 3 * 4)
  now = .8; effects.update(); assert(entry.device.userData.lid.rotation.x < -.5)
  parent.position.set(2, 0, 3); parent.updateMatrixWorld(true)
  assert.equal(entry.group.getWorldPosition(new THREE.Vector3()).x, entry.group.position.x + 2, 'Effects follow board panning')
  now = 2.99; effects.update(); assert.equal(effects.entries.size, 1)
  now = 3; effects.update(); assert.equal(effects.entries.size, 0); assert.equal(effects.group.children.length, 0)
  effects.dispose(); effects.dispose()
  assert([...geometryDisposals.values()].every(count => count === 1)); assert([...materialDisposals.values()].every(count => count === 1))
}
// A suspended tab skips straight past expiry without replaying three more seconds.
{
  let now = 0
  const effects = new TrapEffects(new THREE.Group(), { clock: () => now })
  const position = { c: 2, r: 2 }
  effects.start({ roomId: roomShape.id, entityId: 'suspend', trapId: 'explosion', position, cells: trapEffectCells(roomShape, position, 'explosion') }, roomShape)
  now = 30; effects.update(); assert.equal(effects.entries.size, 0)
  effects.dispose()
}
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
const previousDocument = globalThis.document
const context = new Proxy({}, { get: (_target, key) => key === 'createLinearGradient' || key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} })
globalThis.document = { createElement: () => ({ getContext: () => context }) }
try {
  const { GameScene } = await server.ssrLoadModule('/src/render/scene.js')
  const { BoardTextures } = await server.ssrLoadModule('/src/render/board-textures.js')
  const run = fixture(), room = run.currentRoom, trap = createTrapEntity('poison-fog', { c: 3, r: 4 })
  room.addEntity(trap); room.tile(trap.pos).revealed = false
  const scene = Object.create(GameScene.prototype)
  Object.assign(scene, { run, scene: Object.assign(new THREE.Scene(), { background: new THREE.Color(0x111722) }), roomGroup: new THREE.Group(), structureGroup: new THREE.Group(), boardTextures: new BoardTextures(), contactShadowTexture: new THREE.Texture(),
    tileMeshes: [], tileMeshByKey: new Map(), flipAnimations: [], animationQueue: [], framedRoomId: room.id, cameraAzimuth: 0,
    depressedTileKeys: new Set(), _attachEnemyFigure() {}, _attachGroundSprite() {}, _setEnemyStatusOverlay() {}, _setContactShadow() {},
    _rebuildRoomStructure() {}, _frameRoom() {}, _refreshDoors() {},
  })
  const deviceFace = new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial())
  scene.roomGroup.add(deviceFace); deviceFace.userData.position = trap.pos
  GameScene.prototype._attachGroundSprite.call(scene, deviceFace, { type: 'trap', trapId: 'poison-fog' }, scene._gridPosition(room, trap.pos), trap.pos, true)
  assert.equal(deviceFace.userData.groundSprite.name, 'trap-device-gas', 'A revealed live trap shows the same box device')
  scene._clearGroundSprite(deviceFace); assert.equal(deviceFace.userData.groundSprite, null)
  deviceFace.removeFromParent(); deviceFace.geometry.dispose(); deviceFace.material.dispose()
  scene.visibleDoorKey = scene.structureKey = scene._visibleDoorKey(room)
  for (let r = 0; r < room.height; r++) for (let c = 0; c < room.width; c++) scene._addTile(room, { c, r })
  const stops = [run.on('animate:flip', event => scene._queueAnimation('flip', event)), run.on('animate:trap', event => scene._startTrapEffect(event)), run.on('change', () => scene.rebuild())]
  scene.movementAnimation = { actor: 'player' }
  assert(run._revealTile(trap.pos)); assert.equal(scene.trapEffects, undefined); assert.equal(scene.pendingTrapEffects.size, 1, 'Do not show a trap ahead of its queued reveal')
  scene.movementAnimation = null; scene._drainAnimationQueue()
  assert.equal(scene.pendingTrapEffects.size, 0); assert.equal(scene.trapEffects.entries.size, 1)
  const entry = [...scene.trapEffects.entries.values()][0]
  scene._updateFlipAnimations(1); scene.rebuild()
  assert.equal([...scene.trapEffects.entries.values()][0], entry, 'HUD/model refresh cannot restart or remove the effect')
  assert.equal(scene._cardFaceData(room, trap.pos).type, 'empty')
  scene.trapEffects.update(entry.started + 3); assert.equal(scene.trapEffects.entries.size, 0)
  assert.equal(scene.attackAnimation, undefined, 'Trap effects never occupy the action animation lock')
  const event = { roomId: room.id, trapId: 'explosion', entityId: 'switch-test', position: trap.pos, cells: trapEffectCells(room, trap.pos, 'explosion') }
  scene._startTrapEffect(event)
  const manager = scene.trapEffects
  run.player.roomId = [...run.dungeon.rooms.values()].find(other => other.id !== room.id).id
  scene.rebuild(); assert.equal(manager.entries.size, 0); assert.equal(manager.group.parent, null)
  assert.equal(scene._startTrapEffect(event), false, 'Old-room events cannot appear in a new room')
  stops.forEach(stop => stop()); scene.explorationFog?.dispose(); scene.sealMist?.dispose(); scene.boardTextures.dispose(); scene.contactShadowTexture.dispose()
  console.log('Trap effects passed: immediate single trigger/removal, unchanged damage/poison, clipped nine-cell footprints, three-second wall-clock lifetime, all resource disposal once, queued reveal, refresh, no action lock, save and room-change cleanup.')
} finally { globalThis.document = previousDocument; await server.close() }
