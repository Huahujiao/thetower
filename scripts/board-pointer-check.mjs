import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { Vector3 } from 'three'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const previousWindow = globalThis.window
globalThis.window = { setTimeout, clearTimeout }
try {
  const { GameScene } = await server.ssrLoadModule('/src/render/scene.js')
  const { fixture, add, select, enemy } = await server.ssrLoadModule('/scripts/item-test-helpers.mjs')
  const { TOTEM_BADGES } = await server.ssrLoadModule('/src/game/data/totems.js')
  const { getItemDefinition, makeItemById, createLootEntity } = await server.ssrLoadModule('/src/game/data/content.js')
  const { GameRun, SAVE_KEY } = await server.ssrLoadModule('/src/game/run.js')
  assert.equal(getItemDefinition('teleport').name, '\u98de\u8eab\u7b26')
  const savedRun = fixture(), bagItem = add(savedRun, 'teleport')
  const stashItem = makeItemById('teleport'), floorItem = makeItemById('teleport')
  for (const item of [bagItem, stashItem, floorItem]) item.name = '\u6362\u4f4d\u7b26'
  savedRun.inventoryStash.push(stashItem)
  savedRun.currentRoom.addEntity(createLootEntity(floorItem, { c: 1, r: 1 }))
  const saved = JSON.stringify(savedRun.serialize()), previousStorage = globalThis.localStorage
  globalThis.localStorage = { getItem: key => key === SAVE_KEY ? saved : null, setItem() {}, removeItem() {} }
  try {
    const restored = new GameRun()
    const restoredItems = [...restored.backpack.items, ...restored.inventoryStash, restored.currentRoom.entityAt({ c: 1, r: 1 }).item]
    for (const original of [bagItem, stashItem, floorItem]) {
      assert.equal(restoredItems.find(item => item.uid === original.uid)?.name, '\u98de\u8eab\u7b26')
    }
  } finally { globalThis.localStorage = previousStorage }

  const cases = [
    { id: 'teleport', target: { c: 5, r: 3 } },
    { id: TOTEM_BADGES[0].id, target: { c: 2, r: 3 } },
    { id: 'explosive', target: { c: 4, r: 3 } },
    { id: 'poison', target: { c: 4, r: 3 }, enemy: true },
  ]
  // Use the real selection/consumption rules, with only WebGL and picking stubbed.
  function prepare(testCase) {
    const run = fixture(), item = add(run, testCase.id)
    if (testCase.enemy) enemy(run, { pos: testCase.target })
    select(run, item)
    assert(run.useSelected(), testCase.id)
    assert(run.itemTargeting)
    const scene = Object.create(GameScene.prototype)
    Object.assign(scene, {
      run, activePointers: new Map(), drag: null, pinch: null, boardHold: null,
      lastDragMoved: false, zoom: 1, flipAnimations: [], animationQueue: [],
      roomGroup: { position: new Vector3() }, camera: { clone: () => ({}) },
      renderer: { domElement: { setPointerCapture() {}, releasePointerCapture() {} } },
      attackRangeOverlay: { clearEnemy() {} },
      _groundPoint: event => new Vector3(event.clientX / 100, 0, event.clientY / 100),
      _pickTile: () => ({ userData: { position: testCase.target } }),
      _pickDoor: () => { throw new Error('target selection must not use doors') },
      _clearPathPreview() { this.pathPreview = null },
      _updateHover() {}, _clampPan() {}, _setZoom() {},
    })
    const clickTile = run.clickTile.bind(run)
    let calls = 0
    run.clickTile = (...args) => { calls++; return clickTile(...args) }
    return { scene, run, item, calls: () => calls }
  }
  const event = (type, x = 100, y = 100, id = 1) => ({ type, clientX: x, clientY: y, pointerId: id, pointerType: 'touch' })
  for (const testCase of cases) {
    for (const gesture of ['drag', 'release-displacement', 'pinch', 'cancel']) {
      const { scene, run, calls } = prepare(testCase)
      const before = JSON.stringify(run.serialize())
      scene._handlePointerDown(event('pointerdown'))
      assert.equal(calls(), 0, testCase.id + ': must not act on touch down')
      if (gesture === 'drag') scene._handlePointerMove(event('pointermove', 130))
      if (gesture === 'pinch') {
        scene._handlePointerDown(event('pointerdown', 200, 100, 2))
        scene._handlePointerUp(event('pointerup', 200, 100, 2))
      }
      scene._handlePointerUp(event(gesture === 'cancel' ? 'pointercancel' : 'pointerup',
        ['drag', 'release-displacement'].includes(gesture) ? 130 : 100))
      scene._handleClick(event('click'))
      assert.equal(calls(), 0, testCase.id + ': ' + gesture + ' must not select a target')
      assert.equal(JSON.stringify(run.serialize()), before, 'gesture must not consume resources or act')
      assert(run.itemTargeting)
      // The next ordinary tap must work, including distant targets in one tap.
      scene._handlePointerDown(event('pointerdown'))
      scene._handlePointerUp(event('pointerup', 102))
      assert.equal(calls(), 0)
      scene._handleClick(event('click', 102))
      assert.equal(calls(), 1)
      assert.equal(run.itemTargeting, false, testCase.id + ': tap did not execute')
      if (testCase.id === 'teleport') assert.deepEqual(run.player.pos, testCase.target)
      if (testCase.id === TOTEM_BADGES[0].id) assert(run.totems.active(TOTEM_BADGES[0].totemId))
    }
  }
  console.log('Board pointer checks passed: teleport, totems, explosives and poison tap/drag/pinch/cancel.')
} finally {
  globalThis.window = previousWindow
  await server.close()
}
