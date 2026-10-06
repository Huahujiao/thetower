import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as THREE from 'three'
import { ALL_ITEM_DEFS, createEnemyById, getItemDefinition, makeItemById, randomConsumableDefinition, randomWeapon } from '../src/game/data/content.js'
import { buildMerchantStock } from '../src/game/data/merchants.js'
import { buildSupplyRewardChoices } from '../src/game/data/rewards.js'
import { getStatus } from '../src/game/rules/statuses.js'
import { fixture, add, select } from './item-test-helpers.mjs'

// Import the actual scene methods without constructing WebGL or loading JPGs.
const sceneUrl = new URL('../src/render/scene.js', import.meta.url)
const sceneSource = (await readFile(sceneUrl, 'utf8'))
  .replace("import { BoardTextures } from './board-textures.js'", 'class BoardTextures {}')
  .replace(/from '([^']+)'/g, (_, path) => `from '${path.startsWith('.') ? new URL(path, sceneUrl).href : import.meta.resolve(path)}'`)
const { GameScene } = await import(`data:text/javascript;base64,${Buffer.from(sceneSource).toString('base64')}`)

// Filling the bag does not prevent crafting. Freed ingredient cells are used
// first, and the new instance never inherits reinforcement or compression.
{
  const run = fixture(), weapon = add(run, 'rust-sword', 0, 0)
  add(run, 'shield-core', 0, 2)
  weapon.attack += 2; weapon.reinforcement = 2; weapon.compression = 1
  while (run.backpack.canFit(makeItemById('health-potion'))) add(run, 'health-potion')
  assert.equal(run.backpack.placements.reduce((sum, p) => sum + p.item.shape.flat().filter(Boolean).length, 0), 32)
  assert(run.craft('silver-guard'))
  const output = run.backpack.items.find(item => item.id === 'silver-guard')
  assert(output); assert.equal(run.inventoryStash.length, 0)
  assert.notEqual(output.uid, weapon.uid)
  assert.equal(output.attack, getItemDefinition('silver-guard').attack)
  assert.equal(output.reinforcement, undefined); assert.equal(output.compression, undefined)
  assert.equal(run.globalTurn, 0)
  const before = run.backpack.serialize()
  assert.equal(run.craft('silver-guard'), false)
  assert.deepEqual(run.backpack.serialize(), before); assert.equal(run.globalTurn, 0)
}
assert.equal(getItemDefinition('cleanse'), null)
assert(!ALL_ITEM_DEFS.some(item => item.type === 'cleanse'))
for (const floor of [1, 2]) for (let index = 0; index < 500; index++) {
  const random = () => index / 500
  assert.notEqual(randomWeapon(floor, random).id, 'demon-seeker')
  assert.notEqual(randomConsumableDefinition(floor, random).id, 'cleanse')
  assert(!buildSupplyRewardChoices({ floor, random }).some(choice => ['demon-seeker', 'cleanse'].includes(choice.itemId)))
  assert(!buildMerchantStock('merchant', floor, random).some(stock => ['demon-seeker', 'cleanse'].includes(stock.itemId)))
}
assert(Array.from({ length: 500 }, (_, index) => randomWeapon(3, () => index / 500)).some(item => item.id === 'demon-seeker'))
assert.equal(createEnemyById('tide-shadow-cub').attack, 1)
{
  const run = fixture(), potion = add(run, 'health-potion')
  run.player.hp = 10; run.applyStatus(run.player, 'player-poison')
  select(run, potion); assert(run.useSelected())
  assert(getStatus(run.player, 'player-poison'), 'healing must not cleanse poison')
}

// Transparent animation margins enlarge the plane, keeping visible pixels
// at the original world scale. Repeated refreshes must not accumulate scale.
{
  const scene = Object.create(GameScene.prototype), texture = new THREE.Texture()
  texture.userData.canvasExtent = 1.8
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.14, 1.14), new THREE.MeshBasicMaterial({ map: texture }))
  const width = () => { face.geometry.computeBoundingBox(); return face.geometry.boundingBox.max.x - face.geometry.boundingBox.min.x }
  scene._setFacePose(face, { x: 0, z: 0 }, true)
  assert(Math.abs(width() / 1.8 - 1.14) < 1e-6)
  scene._setFacePose(face, { x: 0, z: 0 }, true)
  assert(Math.abs(width() / 1.8 - 1.14) < 1e-6)
  texture.userData.canvasExtent = 1
  scene._setFacePose(face, { x: 0, z: 0 }, false)
  assert(Math.abs(width() - 1.14) < 1e-6)
}

// All wall sides/offsets place the ring on the actual inside door face and
// terminate the arc at that same point, independent of room dimensions.
let doorsChecked = 0
for (const [width, height] of [[6, 6], [8, 7], [10, 10]]) for (const side of ['top', 'bottom', 'left', 'right']) {
  for (let offset = 0; offset < (['top', 'bottom'].includes(side) ? width : height); offset++) {
    const room = { id: 'test-room', width, height }, door = { id: 'test-door', roomId: room.id, side, offset }
    const scene = Object.create(GameScene.prototype)
    scene.run = { currentRoom: room, player: { pos: { c: 1, r: 1 } }, dungeon: { door: id => id === door.id ? door : null } }
    scene.roomGroup = new THREE.Group(); scene.pathPreview = null
    scene._showPathPreview({ doorId: door.id, target: { c: width - 1, r: offset }, arrival: { c: 1, r: 1 }, path: [{ c: 2, r: 1 }], targeted: true })
    const children = scene.pathPreview.group.children, marker = children.at(-1)
    const center = scene._doorPosition(room, side, offset), outward = scene._doorOutward(side)
    assert(Math.abs(marker.position.x - (center.x - outward.x * .108)) < 1e-6)
    assert(Math.abs(marker.position.z - (center.z - outward.z * .108)) < 1e-6)
    assert.equal(marker.position.y, .4)
    const normal = new THREE.Vector3(0, 0, 1).applyEuler(marker.rotation)
    assert(Math.abs(normal.x + outward.x) < 1e-6); assert(Math.abs(normal.z + outward.z) < 1e-6)
    const arc = children.filter(child => child.isLine).at(-1), vertices = arc.geometry.attributes.position
    assert(new THREE.Vector3().fromBufferAttribute(vertices, vertices.count - 1).distanceTo(marker.position) < 1e-6)
    assert(children.every(child => child.material.depthTest === false && child.material.depthWrite === false))
    assert.equal(scene.pathPreview.doorId, door.id)
    scene._clearPathPreview(); doorsChecked++
    scene._showPathPreview({ doorId: 'unknown-door', target: { c: 0, r: 0 } })
    assert.equal(scene.pathPreview, null)
  }
}
console.log(`playtest-balance-check passed: crafting, instance isolation, acquisition gates, retired consumables, ${doorsChecked} door markers`)
