import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { Euler, Group, Matrix4, PerspectiveCamera } from 'three'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const previousImage = globalThis.Image
const previousWindow = globalThis.window
// Leave textures unloaded: skeleton/animation verification needs no rasterizer.
globalThis.Image = class { complete = false }
try {
  const { GameScene } = await server.ssrLoadModule('/src/render/scene.js')
  const { prepareEnemyPuppets, createEnemyFigure, enemyPuppetProject } = await server.ssrLoadModule('/src/render/enemy-puppet.js')
  const { loadCurrentShadowRoster } = await server.ssrLoadModule('/src/animation/shadow-editor-cache.js')
  const { saveShadowRoster, SHADOW_PUPPET_ROSTER_STORAGE_KEY } = await server.ssrLoadModule('/src/animation/shadow-rig.js')
  const cache = new Map()
  globalThis.window = { localStorage: {
    getItem: key => cache.get(key) ?? null,
    setItem: (key, value) => cache.set(key, value),
    removeItem: key => cache.delete(key),
  } }
  const draft = loadCurrentShadowRoster()
  draft.characters.find(c => c.project.enemyId === 'gnawer').project.joints.find(j => j.id === 'root').x = 777
  saveShadowRoster(draft)
  prepareEnemyPuppets(() => {})
  assert.notEqual(enemyPuppetProject('gnawer').joints.find(j => j.id === 'root').x, 777, 'gameplay uses the code model even when a current-version manual draft exists')
  assert.equal(JSON.parse(cache.get(SHADOW_PUPPET_ROSTER_STORAGE_KEY)).characters.find(c => c.project.enemyId === 'gnawer').project.joints.find(j => j.id === 'root').x, 777, 'same-version editing remains available in the editor')
  const figure = createEnemyFigure('gnawer'), face = new Group(), roomGroup = new Group()
  assert(figure)
  face.add(figure); roomGroup.add(face)
  figure.matrixAutoUpdate = false
  Object.assign(face.userData, { enemyFigure: figure, enemyId: 'gnawer', standing: true, position: { c: 4, r: 3 } })
  face.position.set(1.14, .61, 0); face.rotation.x = -Math.PI / 6
  const enemyPosition = { c: 4, r: 3 }
  const room = { width: 6, height: 6, entityAt: () => ({ kind: 'enemy' }), entity: () => ({ pos: enemyPosition }) }
  figure.userData.enemyInstanceId = 'instance-1'
  const scene = Object.create(GameScene.prototype)
  Object.assign(scene, {
    run: { currentRoom: room, player: { pos: { c: 3, r: 3 } } },
    roomGroup, tileMeshes: [face], camera: new PerspectiveCamera(45, 1, .1, 80),
    cameraElevation: .8, cameraAzimuth: 0, baseCameraDistance: 12, zoom: 1,
    characterIdleTime: 0,
  })
  const snapshot = () => JSON.stringify({
    rig: figure.userData.rig.position.toArray(),
    parts: [...figure.userData.meshes.values()].map(mesh => ({
      matrix: mesh.matrix.toArray(), opacity: mesh.material.opacity,
      color: mesh.material.color.toArray(), visible: mesh.visible,
    })),
  })
  const rootYaw = enemyPuppetProject('gnawer').joints.find(joint => joint.id === 'root').rotationY * Math.PI / 180
  function assertFacing(expected) {
    scene._positionEnemyFigure(face)
    const world = new Matrix4().multiplyMatrices(face.matrix, face.userData.enemyFigure.matrix)
    const effectiveYaw = new Euler().setFromRotationMatrix(world).y - scene.cameraAzimuth + rootYaw
    assert(Math.abs(effectiveYaw - expected) < 1e-9)
  }
  const left = -Math.PI / 6, right = Math.PI / 6
  scene.run.player.pos.c = 4; assertFacing(left) // Newly revealed in the same column.
  scene.run.player.pos.c = 5; assertFacing(right)
  scene.run.player.pos.c = 4; assertFacing(right) // Same column keeps the last side.
  face.userData.enemyFigure = createEnemyFigure('gnawer')
  face.userData.enemyFigure.userData.enemyInstanceId = 'instance-1'
  assertFacing(right) // Rebuild/movement must not lose an instance's facing.
  face.userData.enemyFigure.userData.enemyInstanceId = 'instance-2'
  assertFacing(left) // Another enemy of the same species gets its own default.
  face.userData.enemyFigure = figure
  scene.run.player.pos.c = 3; assertFacing(left)
  scene.run.player.pos.c = 4; assertFacing(left)
  enemyPosition.c = 3; assertFacing(right) // Enemy movement updates relative columns.
  enemyPosition.c = 4; scene.run.player.pos.c = 3
  for (const action of ['idle', 'move', 'attack', 'hit', 'death']) {
    scene._poseEnemyFigure(face, action, 137, { opacity: .47, flash: .3 })
    const before = snapshot()
    for (let i = 0; i < 20; i++) {
      roomGroup.position.set((i - 10) * .1, 0, i * .02)
      scene._clampPan(room)
      scene._setZoom(1 + i * .03)
      scene.adjustCameraPitch(i % 2 ? 1 : -1)
      assert.equal(snapshot(), before, action + ': camera gesture changed pose/materials')
    }
  }
  let previous
  for (let frame = 0; frame < 6; frame++) {
    scene._updateCharacterIdle(1 / 60)
    const current = snapshot()
    if (previous) assert.notEqual(current, previous, 'idle pose must advance every render frame')
    previous = current
    scene._clampPan(room)
    assert.equal(snapshot(), current, 'camera updates between frames reset idle pose')
  }
  console.log('Enemy camera checks passed: per-instance left/right/same-column facing; camera preserves poses; idle advances every frame.')
} finally {
  globalThis.Image = previousImage
  if (previousWindow === undefined) delete globalThis.window
  else globalThis.window = previousWindow
  await server.close()
}
