import assert from 'node:assert/strict'
import { PerspectiveCamera, Vector3 } from 'three'
import { createArtTweakRun } from '../src/game/art-tweak.js'
import { ATTRIBUTE_ORDER } from '../src/game/data/attributes.js'
import { StaminaDeck } from '../src/game/model/stamina-deck.js'
import { roomOverviewDistance } from '../src/render/camera-view.js'

// Opening, playing and restarting the review page must never touch a save.
const storageCalls = []
globalThis.localStorage = {
  getItem: key => { storageCalls.push(['get', key]); return 'existing-game-save' },
  setItem: (...args) => storageCalls.push(['set', ...args]),
  removeItem: key => storageCalls.push(['remove', key]),
}
const run = createArtTweakRun()
const snapshot = run.serialize()
const room = run.currentRoom
assert.equal(run.backpack.usedCells, 15)
assert.equal(run.backpack.capacity, 32)
assert.ok(run.backpack.items.some(item => item.id === 'light-armor'))
assert.ok(run.backpack.items.some(item => item.id === 'wood-shield'))
assert.equal(run.battle.active, true)
assert.equal(run.battle.stage, 'player')
assert.ok(StaminaDeck.valid(run.staminaDeck.serialize()))
const enemies = [...room.entities.values()].filter(entity => entity.kind === 'enemy' && room.isRevealed(entity.pos))
assert.equal(enemies.length, 3)
assert.deepEqual(run.player.pos, { c: 2, r: 2 })
let hiddenBelow = 0, coloredBelow = 0
for (let r = run.player.pos.r + 1; r < room.height; r++) {
  for (let c = 0; c < room.width; c++) {
    assert.equal(room.isRevealed({ c, r }), false)
    hiddenBelow++
    if (ATTRIBUTE_ORDER.includes(room.entityAt({ c, r })?.item?.attribute)) coloredBelow++
  }
}
assert.ok(coloredBelow / hiddenBelow >= 0.75)
run.selectInventory(run.backpack.originIndex(run.backpack.placements[0]))
assert.ok(enemies.every(enemy => run.previewTileAction(enemy.pos.c, enemy.pos.r)))
const backs = new Set([...room.entities.values()]
  .filter(entity => !room.isRevealed(entity.pos) && run.tileCanBeFlipped(entity.pos))
  .map(entity => entity.kind === 'enemy' ? entity.attribute : entity.item?.type === 'weapon' ? entity.item.attribute : null))
assert.deepEqual(backs, new Set([...ATTRIBUTE_ORDER, null]))
assert.ok(run.clickTile(1, 3))
run.clearSave()
run.reset()
assert.deepEqual(run.serialize(), snapshot)
assert.deepEqual(storageCalls, [])
assert.match(run.log.at(-1), /\u7f8e\u672f\u8c03\u6574\u6b8b\u5c40/)

// Validate actual perspective projection for tall, wide and square viewports.
for (const aspect of [0.45, 0.75, 1, 2, 4]) {
  const { framing } = run.sceneView
  const halfWidth = framing.halfWidth * 1.14, halfDepth = framing.halfDepth * 1.14, height = framing.height
  const elevation = run.sceneView.cameraElevation
  const camera = new PerspectiveCamera(45, aspect, 0.1, 80)
  const distance = roomOverviewDistance({ halfWidth, halfDepth, height, elevation, verticalFov: Math.PI / 4, aspect })
  const overviewDistance = roomOverviewDistance({ halfWidth: 4.17, halfDepth: 4.17, height: 2.052, elevation, verticalFov: Math.PI / 4, aspect })
  assert.ok(distance < overviewDistance * 0.8, 'Initial view should be substantially closer than the whole room')
  camera.position.set(0, -0.35 + distance * Math.sin(elevation), distance * Math.cos(elevation))
  camera.lookAt(0, -0.35, 0)
  camera.updateMatrixWorld(true)
  for (const x of [-halfWidth, halfWidth]) {
    for (const y of [0, height]) {
      for (const z of [-halfDepth, halfDepth]) {
        const point = new Vector3(x, y, z).project(camera)
        assert.ok(Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && point.z > -1 && point.z < 1, `Room clipped at aspect ${aspect}`)
      }
    }
  }
}
console.log('Art tweak: reachable card backs, combat routes, deterministic reset, save isolation and camera framing passed.')
