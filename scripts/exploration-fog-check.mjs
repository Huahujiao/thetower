import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { Group, Raycaster, Vector3 } from 'three'

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
const previousDocument = globalThis.document
const context = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}) })
globalThis.document = { createElement: tag => tag === 'img' ? {} : { getContext: () => context } }
try {
  const { ExplorationFog, explorationFogMask } = await server.ssrLoadModule('/src/render/exploration-fog.js')
  const mask = explorationFogMask(3, 2, [1, 1, 0, 1, 1, 0])
  const sample = (c, r) => mask.data[Math.floor(r * 16) * mask.width + Math.floor(c * 16)]
  assert.equal(sample(.99, .5), 255, 'Adjacent hidden cells have no internal seam')
  assert.equal(sample(1.01, .5), 255)
  assert.equal(sample(1.97, .5), 255, 'The mask still selects unknown cells near the boundary')
  assert(mask.data.every(value => value === 0 || value === 255), 'The mask selects regions; shader opacity supplies gaps')
  assert.equal(sample(2.5, .5), 0, 'Visible cells stay clear')
  assert.equal(sample(.02, .02), 255, 'The mask includes room-edge cells')
  const group = new Group(), fog = new ExplorationFog(group, { tileSize: 1.14, surfaceY: .05 })
  const roomDescriptor = { id: 'mask-test', width: 3, height: 2 }
  fog.sync(roomDescriptor, [1, 1, 0, 1, 1, 0])
  assert.equal(group.children.length, 1, 'All unknown cells share one connected fog object')
  assert.equal(fog.mesh.children.length, 0, 'Low billows form one contoured layer without a separate raised deck')
  assert(fog.mesh.geometry.attributes.position.count > 100, 'The fog has mesh detail for real silhouette deformation')
  assert([...fog.mesh.geometry.attributes.position.array].filter((_, i) => i % 3 === 1).every(y => Math.abs(y) < 1e-6))
  assert.equal(fog.material.transparent, true)
  assert.equal(fog.material.depthWrite, false)
  assert.equal(fog.material.uniforms.fogDensity.value, 2.5)
  const geometry = fog.mesh.geometry
  // Evaluate scalar density functions from the real shader. Dense fragments
  // have 2.5x the coloured haze optical depth while holes remain transparent.
  const functionBody = (name, source = fog.material.fragmentShader) => {
    const start = source.indexOf('float ' + name + '(')
    assert(start >= 0)
    const begin = source.indexOf('{', start)
    const end = source.indexOf('}', begin)
    return source.slice(begin + 1, end).replace(/\bfloat\b/g, 'let')
  }
  const heightAt = new Function('x', 'z', 'time', 'const sin=Math.sin;' + functionBody('fogHeight', fog.material.vertexShader))
  let minHeight = Infinity, maxHeight = 0, motion = 0
  for (let x = -2.7; x < 2.8; x += .27) for (let z = -1.6; z < 1.7; z += .21) {
    for (const time of [0, 1.5, 7, 40]) {
      const height = heightAt(x, z, time)
      assert(Number.isFinite(height) && height >= .012 && height <= .140001, 'Black billows stay low and above the floor')
      minHeight = Math.min(minHeight, height); maxHeight = Math.max(maxHeight, height)
    }
    motion = Math.max(motion, Math.abs(heightAt(x, z, 0) - heightAt(x, z, 2)))
  }
  assert(maxHeight - minHeight > .08, 'Real high and low contours replace the flat plane')
  assert(motion > .03, 'The black cloud silhouette rises and falls over time')
  const sealAlpha = new Function('haze', 'flecks', 'layer', 'const mix=(a,b,t)=>a*(1-t)+b*t;const step=(a,b)=>b<a?0:1;' + functionBody('sealHazeAlpha'))
  const darkAlpha = new Function('haze', 'flecks', 'tufts', 'fogDensity', 'sealHazeAlpha', 'const pow=Math.pow;' + functionBody('darkMistAlpha'))
  for (const haze of [0, .25, .5, .75, 1]) for (const flecks of [0, .5, 1]) {
    const transmission = [0, 1, 2].reduce((value, layer) => value * (1 - sealAlpha(haze, flecks, layer)), 1)
    const dense = darkAlpha(haze, flecks, 1, fog.material.uniforms.fogDensity.value, sealAlpha)
    assert(dense > 1 - transmission && dense < 1, 'Dense charcoal haze stays stronger and translucent')
    assert(Math.abs(-Math.log(1 - dense) / -Math.log(transmission) - 2.5) < 1e-10)
    assert.equal(darkAlpha(haze, flecks, 0, 2.5, sealAlpha), 0, 'Fragment gaps expose the floor completely')
  }
  const initial = fog.to
  fog.sync(roomDescriptor, [1, 1, 0, 1, 1, 0])
  assert.equal(fog.to, initial, 'Unchanged masks do not allocate textures')
  let retired = 0
  initial.addEventListener('dispose', () => retired++)
  fog.sync(roomDescriptor, [1, 0, 0, 1, 0, 0])
  assert.equal(retired, 1)
  assert.equal(fog.mesh.geometry, geometry, 'Exploration changes reuse the contoured mist geometry')
  fog.update(.2)
  const partial = fog.from.image.data.map((value, i) => Math.round(value * (1-fog.blend) + fog.to.image.data[i] * fog.blend))
  fog.sync(roomDescriptor, [0, 0, 0, 0, 0, 0])
  assert.deepEqual(fog.from.image.data, partial, 'Interrupted fades start at the displayed mask')
  assert(fog.mesh.visible)
  fog.update(1)
  assert(!fog.mesh.visible, 'Cleared rooms finish without a translucent overlay')
  assert(fog.material.uniforms.fogTime.value > 0, 'Swirl time advances independently of grid state')
  let geometryRetired = 0
  geometry.addEventListener('dispose', () => geometryRetired++)
  fog.sync({ id: 'wider-room', width: 4, height: 2 }, [1, 1, 1, 1, 1, 1, 1, 1])
  assert.equal(geometryRetired, 1, 'Changing room dimensions releases the previous billow mesh once')
  assert.notEqual(fog.mesh.geometry, geometry)
  fog.sync({ ...roomDescriptor, id: 'another-room' }, [1, 1, 1, 1, 1, 1])
  assert.equal(fog.blend, 1, 'Room changes do not inherit the previous mask')
  assert(fog.from.image.data.every(value => value === 255))
  const resources = [fog.from, fog.to, fog.mesh.geometry, fog.material]
  let released = 0
  for (const resource of resources) resource.addEventListener('dispose', () => released++)
  fog.dispose()
  assert.equal(released, 4)
  assert.equal(group.children.length, 0)

  const { GameScene } = await server.ssrLoadModule('/src/render/scene.js')
  const { BoardTextures } = await server.ssrLoadModule('/src/render/board-textures.js')
  const { fixture } = await server.ssrLoadModule('/scripts/item-test-helpers.mjs')
  const run = fixture(), room = run.currentRoom
  for (const row of room.tiles) for (const tile of row) Object.assign(tile, { revealed: false, peeked: false })
  run.player.pos = { c: 0, r: 0 }
  room.reveal(run.player.pos)
  const scene = Object.create(GameScene.prototype)
  Object.assign(scene, {
    run, boardTextures: new BoardTextures(), roomGroup: new Group(), tileMeshes: [], tileMeshByKey: new Map(),
    flipAnimations: [], animationQueue: [], framedRoomId: room.id,
    _clearGroundSprite() {}, _attachEnemyFigure() {}, _attachGroundSprite() {},
    _setEnemyStatusOverlay() {}, _setContactShadow() {}, _drainAnimationQueue() {}, _emitMoveCompleteIfIdle() {},
  })
  for (let r = 0; r < room.height; r++) for (let c = 0; c < room.width; c++) scene._addTile(room, { c, r })
  scene._syncExplorationFog(room)
  const at = key => scene.tileMeshByKey.get(key)
  assert(at('2:0').userData.fogged)
  assert(!at('2:0').material.visible)
  assert(!at('2:0').userData.sealVeil.visible, 'Unknown regions suppress the floating seal layer as well')
  assert(!at('2:0').userData.body.visible, 'Hidden card rims disappear')
  assert(at('2:0').userData.floorBacking.visible, 'Unknown regions show neutral floor through fragmented mist')
  assert(at('2:0').userData.floorBacking.material.map.userData.boardFloor, 'Only the ordinary floor is exposed')
  assert.equal(at('2:0').userData.enemyId, null, 'Floor visibility reveals no unknown enemy')
  assert(at('1:0').material.visible, 'Reachable cards stay distinct')
  assert(!at('0:0').userData.fogged, 'Explored ground is never concealed')
  scene.roomGroup.updateMatrixWorld(true)
  const point = at('2:0').position
  const ray = new Raycaster(new Vector3(point.x, 10, point.z), new Vector3(0, -1, 0))
  assert.equal(ray.intersectObject(at('2:0'), false).length, 1, 'Invisible faces preserve grid picking')
  room.reveal({ c: 1, r: 0 })
  scene._refreshRoom(room)
  assert(!at('2:0').userData.fogged)
  assert(at('2:0').material.visible && !at('2:0').userData.body.visible, 'Exposed seals show smoke without a raised card body')
  assert(at('2:0').userData.floorBacking.visible, 'Exposed cards retain their floor backing')
  assert.equal(scene.explorationFog.blend, 0, 'New reachability dissolves the old fog edge')
  room.tile({ c: 1, r: 0 }).revealed = false
  room.tile({ c: 4, r: 0 }).peeked = true
  room.reveal({ c: 4, r: 4 })
  scene._refreshRoom(room)
  assert(at('2:0').userData.fogged, 'Losing a route hides unknown cards again')
  assert(!at('4:0').userData.fogged, 'Existing peek effects retain their visible window')
  assert(!at('4:4').userData.fogged, 'Previously explored distant ground remains visible')
  assert(run.tileCanBeFlipped({ c: 4, r: 3 }), 'A distant explored frontier is exposed without a route from the player')
  assert(!at('4:3').userData.fogged)
  const { findRevealPath } = await server.ssrLoadModule('/src/game/rules/pathfinding.js')
  assert.equal(findRevealPath(room, run.player.pos, { c: 4, r: 3 }), null, 'Action routing remains separate from frontier visibility')
  const distantMask = scene.explorationFog.to
  run.player.pos = { c: 4, r: 4 }
  scene._refreshRoom(room)
  assert.equal(scene.explorationFog.to, distantMask, 'Moving near or far does not change the fog mask')
  run.player.pos = { c: 0, r: 0 }
  scene._refreshRoom(room)
  assert.equal(scene.explorationFog.to, distantMask)
  room.tile({ c: 4, r: 4 }).revealed = false
  scene._refreshRoom(room)
  assert(at('4:3').userData.fogged, 'Removing explored ground, rather than moving the player, conceals the frontier')
  room.reveal({ c: 2, r: 0 })
  assert(scene._startFlip({ roomId: room.id, position: { c: 2, r: 0 }, backUnflippable: true }))
  const index = 8 * scene.explorationFog.to.image.width + 2 * 16 + 8
  assert.equal(scene.explorationFog.to.image.data[index], 0, 'Forced reveals cut through fog during the flip')
  scene._updateFlipAnimations(1)
  assert(!at('2:0').userData.fogged)
  run.debugReveal = true
  scene._refreshRoom(room)
  scene.explorationFog.update(1)
  assert(!scene.explorationFog.mesh.visible, 'Debug reveal clears the whole overlay')
  scene.explorationFog.dispose()
  scene.sealMist?.dispose()
  scene.boardTextures.dispose()
  console.log('exploration-fog-check passed: low animated 3D billows, 2.5x optical density, visible neutral floors, mask fades, resource lifetime, reachability, picking, explored/peeked windows and forced flips')
} finally {
  if (previousDocument === undefined) delete globalThis.document
  else globalThis.document = previousDocument
  await server.close()
}
