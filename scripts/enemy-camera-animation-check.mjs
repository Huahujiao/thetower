import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { Euler, Group, Matrix4, PerspectiveCamera, Vector3 } from 'three'
import { CARD_FACE_CLEARANCE } from '../src/render/card-body.js'

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
  function assertFacing(expected) {
    scene._positionEnemyFigure(face)
    const actor = face.userData.enemyFigure
    const rootYaw = enemyPuppetProject(actor.userData.enemyId).joints.find(joint => joint.id === 'root').rotationY * Math.PI / 180
    const world = new Matrix4().multiplyMatrices(face.matrix, actor.matrix)
    const relative = new Matrix4().makeRotationX(Math.PI / 9)
      .multiply(new Matrix4().makeRotationY(-scene.cameraAzimuth)).multiply(world)
    const effectiveYaw = new Euler().setFromRotationMatrix(relative.clone().extractRotation(relative)).y + rootYaw
    assert(Math.abs(effectiveYaw - expected) < 1e-9, actor.userData.enemyId + ': relative facing')
    const up = new Vector3(0, 1, 0).transformDirection(world)
    const expectedUp = new Vector3(0, Math.cos(Math.PI / 9), -Math.sin(Math.PI / 9)).applyAxisAngle(new Vector3(0, 1, 0), scene.cameraAzimuth)
    assert(up.distanceTo(expectedUp) < 1e-9, 'Every enemy leans back 20 degrees')
    for (let axis = 0; axis < 3; axis++) assert(Math.abs(new Vector3().setFromMatrixColumn(world, axis).length() - 1.1) < 1e-9, 'Uniform 10% enlargement')
    assert(new Vector3().setFromMatrixPosition(world).distanceTo(new Vector3(face.position.x, .04 + CARD_FACE_CLEARANCE, face.position.z)) < 1e-9, 'Display changes preserve the floor pivot')
    return world
  }
  const left = -Math.PI / 6, right = Math.PI / 6
  scene.run.player.pos.c = 4; assertFacing(0) // Newly revealed in the same column.
  scene.run.player.pos.c = 5; assertFacing(right)
  scene.run.player.pos.c = 4; assertFacing(0) // Return to front instead of remembering a side.
  face.userData.enemyFigure = createEnemyFigure('gnawer')
  face.userData.enemyFigure.userData.enemyInstanceId = 'instance-1'
  assertFacing(0) // Rebuild/movement keeps a frontal same-column view.
  face.userData.enemyFigure.userData.enemyInstanceId = 'instance-2'
  assertFacing(0)
  face.userData.enemyFigure = figure
  scene.run.player.pos.c = 3; assertFacing(left)
  scene.run.player.pos.c = 4; assertFacing(0)
  enemyPosition.c = 3; assertFacing(right) // Enemy movement updates relative columns.
  enemyPosition.c = 4
  const { createEnemyShadowProjects } = await server.ssrLoadModule('/src/animation/shadow-enemies.js')
  for (const project of createEnemyShadowProjects({ includeBoss: true })) {
    face.userData.enemyFigure = createEnemyFigure(project.enemyId)
    for (const azimuth of [0, .4]) {
      scene.cameraAzimuth = azimuth
      for (const [column, facing] of [[3, left], [4, 0], [5, right]]) {
        scene.run.player.pos.c = column
        assertFacing(facing)
      }
    }
  }
  face.userData.enemyFigure = figure
  scene.cameraAzimuth = 0
  scene.run.player.pos.c = 3
  // A newly revealed enemy must settle into exactly the same display pose.
  room.id = 'facing-room'
  face.userData.body = new Group()
  Object.assign(scene, {
    framedRoomId: room.id, flipAnimations: [], tileMeshByKey: new Map([['4:3', face]]),
    _gridPosition: () => ({ x: face.position.x, z: face.position.z }),
    _cardFaceData: () => ({ type: 'monster', enemyId: 'gnawer' }),
    _makeEmptyGroundFace: () => new Group(),
  })
  const idleWorld = assertFacing(left)
  assert(scene._startFlip({ roomId: room.id, position: face.userData.position }))
  const flip = scene.flipAnimations[0]
  scene._updateFlipAnimations(.26)
  flip.group.updateMatrix()
  flip.figure.updateMatrix()
  const settledWorld = new Matrix4().multiplyMatrices(flip.group.matrix, flip.figure.matrix)
  settledWorld.elements.forEach((value, index) => assert(Math.abs(value - idleWorld.elements[index]) < 1e-9, 'Reveal and idle display transforms must match'))
  roomGroup.remove(flip.group, flip.ground)
  scene.flipAnimations = []
  face.visible = true
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
  console.log('Enemy camera checks passed: all-enemy left/right/frontal facing, back lean and scale; camera preserves poses; idle advances every frame.')
} finally {
  globalThis.Image = previousImage
  if (previousWindow === undefined) delete globalThis.window
  else globalThis.window = previousWindow
  await server.close()
}
