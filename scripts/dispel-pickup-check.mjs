import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { Group, Texture } from 'three'

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
const previousDocument = globalThis.document
const context = new Proxy({}, { get: (target, key) => key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : key === 'measureText' ? text => ({ width: String(text).length * 8 }) : target[key] ?? (() => {}) })
globalThis.document = { createElement: tag => tag === 'img' ? {} : { getContext: () => context } }
const cleanups = []
try {
  const { GameScene } = await server.ssrLoadModule('/src/render/scene.js')
  const { BoardTextures } = await server.ssrLoadModule('/src/render/board-textures.js')
  const { fixture, enemy, setBalls } = await server.ssrLoadModule('/scripts/item-test-helpers.mjs')
  const { createLootEntity, makeItemById, createGoldEntity, createKeyEntity } = await server.ssrLoadModule('/src/game/data/content.js')
  function prepare(kind = 'item', position = { c: 4, r: 3 }) {
    const run = fixture(), room = run.currentRoom
    let loot
    if (kind === 'gold') loot = createGoldEntity(4, position)
    else if (kind === 'key') {
      const edge = [...run.dungeon.edges.values()][0]
      edge.unlocked = false
      loot = createKeyEntity(edge.id, position)
    } else loot = createLootEntity(makeItemById('health-potion'), position)
    room.addEntity(loot)
    room.tile(position).revealed = false
    const scene = Object.create(GameScene.prototype), itemTexture = new Texture({ width: 128, height: 128 })
    itemTexture.userData.boardShared = true
    Object.assign(scene, {
      run, roomGroup: new Group(), structureGroup: new Group(), boardTextures: new BoardTextures(), contactShadowTexture: new Texture(),
      tileMeshes: [], tileMeshByKey: new Map(), flipAnimations: [], animationQueue: [], framedRoomId: room.id,
      cameraAzimuth: .25, depressedTileKeys: new Set(), lastDragMoved: false, pendingRebuild: false,
      pickPosition: position, attackRangeOverlay: { refresh() {} },
      _attachEnemyFigure() {}, _setEnemyStatusOverlay() {}, _setContactShadow() {},
      _rebuildRoomStructure() {}, _frameRoom() {}, _refreshDoors() {},
      _pickTile() { return this.tileMeshByKey.get(this.pickPosition.c + ':' + this.pickPosition.r) },
      _pickDoor: () => null,
    })
    scene._attachGroundSprite = (face, card, point, position, revealed) => {
      scene._clearGroundSprite(face)
      const descriptor = revealed && scene._groundSpriteDescriptor(card, position)
      if (descriptor) scene._groundSpriteMesh(face, itemTexture, descriptor, point, position)
    }
    scene.visibleDoorKey = scene.structureKey = scene._visibleDoorKey(room)
    for (let r = 0; r < room.height; r++) for (let c = 0; c < room.width; c++) scene._addTile(room, { c, r })
    const stops = [
      run.on('animate:flip', payload => scene._queueAnimation('flip', payload)),
      run.on('animate:move', payload => scene._queueAnimation('move', payload)),
      run.on('change', () => scene.rebuild()),
    ]
    cleanups.push(() => {
      stops.forEach(stop => stop())
      scene.explorationFog?.dispose()
      const geometries = new Set(), materials = new Set(), textures = new Set()
      scene.roomGroup.traverse(part => {
        if (part.geometry) geometries.add(part.geometry)
        if (part.material) materials.add(part.material)
        if (part.material?.map && !part.material.map.userData.boardShared) textures.add(part.material.map)
      })
      geometries.forEach(resource => resource.dispose())
      materials.forEach(resource => resource.dispose())
      textures.forEach(resource => resource.dispose())
      scene.sealMist?.dispose(); scene.boardTextures.dispose(); scene.contactShadowTexture.dispose(); itemTexture.dispose()
    })
    const face = scene.tileMeshByKey.get(position.c + ':' + position.r)
    const reveal = () => {
      scene._handleClick({})
      assert.equal(room.isRevealed(position), true)
      assert.equal(scene.flipAnimations.length, 1)
      return scene.flipAnimations[0]
    }
    return { run, room, scene, loot, face, position, reveal }
  }
  function collected({ run, room, loot }) {
    assert.equal(room.entity(loot.id), null)
    if (loot.kind === 'item') assert.equal([...run.backpack.items, ...run.inventoryStash].filter(item => item.uid === loot.item.uid).length, 1)
    else if (loot.kind === 'gold') assert.equal(run.player.gold, 4)
    else assert(run.dungeon.edge(loot.edgeId).unlocked)
  }
  for (const kind of ['item', 'gold', 'key']) {
    const state = prepare(kind), { scene, face } = state
    const fog = state.reveal()
    let released = 0
    fog.backTexture.addEventListener('dispose', () => released++)
    scene._updateFlipAnimations(.08)
    scene._handleClick({})
    collected(state)
    assert(scene.movementAnimation, 'Pickup movement starts before the fog ends')
    assert.equal(scene.flipAnimations[0], fog, 'Pickup does not cancel the remaining dissolve')
    const afterPickup = JSON.stringify(state.run.serialize())
    scene._handleClick({})
    assert.equal(JSON.stringify(state.run.serialize()), afterPickup, 'A second tap during movement cannot collect twice')
    scene._updateMovementAnimation(.20)
    assert.equal(scene.movementAnimation, null)
    assert.equal(face.userData.groundSprite, null, 'The collected sprite vanishes without waiting for the fog')
    assert(face.userData.standing, 'The resting player replaces its movement marker once')
    assert.equal(scene.playerMarker, null)
    scene._updateFlipAnimations(.8)
    assert.equal(scene.flipAnimations.length, 0)
    assert.equal(released, 1, 'Concurrent pickup releases the dissolve snapshot once')
    assert.equal(face.userData.groundSprite, null, 'Finishing the fog cannot resurrect collected loot')
    collected(state)
  }
  // Picking up near the end of the dissolve must not draw a stationary player
  // at the destination while its movement marker is still travelling there.
  {
    const state = prepare(), { scene, face } = state
    state.reveal(); scene._updateFlipAnimations(.68); scene._handleClick({})
    assert(scene.movementAnimation)
    scene._updateFlipAnimations(.08)
    assert.equal(scene.flipAnimations.length, 0)
    assert.equal(face.userData.standing, false)
    scene._updateMovementAnimation(.2)
    assert.equal(face.userData.standing, true)
    assert.equal(face.userData.groundSprite, null)
    collected(state)
  }
  // Distant pickup keeps the normal preview/confirm interaction. Its movement
  // steps can proceed together with the active cosmetic dissolve.
  {
    const state = prepare('item', { c: 5, r: 3 }), { scene, room, position } = state
    room.reveal(position)
    scene._queueAnimation('flip', { roomId: room.id, position })
    scene._handleClick({})
    assert.equal(scene.pathPreview?.target.c, 5)
    assert(room.entity(state.loot.id))
    scene._handleClick({})
    collected(state)
    for (let step = 0; step < 2; step++) {
      assert(scene.movementAnimation)
      scene._updateMovementAnimation(.2)
    }
    assert.equal(scene.movementAnimation, null)
    assert.equal(scene.flipAnimations.length, 1)
    scene._updateFlipAnimations(1)
    collected(state)
  }
  {
    const state = prepare(), { scene, run, room, position } = state
    state.reveal()
    const before = JSON.stringify(run.serialize())
    for (const blocker of ['movement', 'attack', 'queue', 'targeting', 'drag']) {
      scene.movementAnimation = blocker === 'movement' ? {} : null
      scene.attackAnimation = blocker === 'attack' ? {} : null
      scene.animationQueue = blocker === 'queue' ? [{ type: 'attack' }] : []
      run.itemTargeting = blocker === 'targeting'
      scene.lastDragMoved = blocker === 'drag'
      scene._handleClick({})
      assert(room.entity(state.loot.id), blocker + ' still blocks input')
    }
    scene.movementAnimation = scene.attackAnimation = null; scene.animationQueue = []; run.itemTargeting = false
    scene.pickPosition = { c: 3, r: 2 }
    scene._handleClick({})
    assert.equal(JSON.stringify(run.serialize()), before, 'Empty-floor movement stays blocked during dispelling')
    scene.pickPosition = position
    enemy(run, { pos: { c: 0, r: 0 } }); run._synchronizeBattle(); setBalls(run, 0)
    scene._handleClick({})
    assert(room.entity(state.loot.id), 'Early pickup cannot bypass movement energy costs')
    assert.equal(scene.movementAnimation, null)
  }
  {
    const state = prepare(), { scene } = state
    state.reveal()
    let attacks = 0
    scene._startAttack = () => { attacks++; return true }
    scene._queueAnimation('attack', { actor: 'enemy' })
    assert.equal(attacks, 0, 'Combat animations do not bypass the reveal queue')
    scene._updateFlipAnimations(1)
    assert.equal(attacks, 1, 'Combat resumes in its original order after the fog')
  }
  console.log('Dispel pickup passed: early item/gold/key collection, concurrent movement, distant confirmation, late-fog completion, no duplicates/resurrection, resource lifetime and retained action locks/costs.')
} finally {
  cleanups.forEach(cleanup => cleanup())
  if (previousDocument === undefined) delete globalThis.document
  else globalThis.document = previousDocument
  await server.close()
}
