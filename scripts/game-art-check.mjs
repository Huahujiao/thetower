import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import * as THREE from 'three'
import { createServer } from 'vite'
import { GameRun, SAVE_KEY } from '../src/game/run.js'
import { createArtTweakRun } from '../src/game/art-tweak.js'
import { GAME_SCENE_VIEW } from '../src/settings/scene-view.js'

const previousStorage = globalThis.localStorage
const previousDocument = globalThis.document
const saves = new Map(), calls = []
globalThis.localStorage = {
  getItem(key) { calls.push(['get', key]); return saves.get(key) ?? null },
  setItem(key, value) { calls.push(['set', key]); saves.set(key, value) },
  removeItem(key) { calls.push(['remove', key]); saves.delete(key) },
}
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
try {
  const run = new GameRun({ autoLoad: false, random: () => .99 })
  assert.equal(run.sceneView, GAME_SCENE_VIEW)
  assert.equal(run.sceneView.environment, 'mountain-temple')
  assert.equal(run.sceneView.focus, undefined, 'Real rooms follow the player instead of the authored review position')
  assert.equal(run.sceneView.leftEdge, undefined)
  assert.equal(run.sceneView.cameraAzimuth, undefined, 'Keep normal pan-driven camera controls')
  assert(run.persistenceEnabled)
  assert.equal(run.player.gold, 0); assert.equal(run.player.hp, 20)
  assert.equal(run.initialRelicChoices.length, 3, 'The ordinary game opening is retained')
  run.player.gold = 43; run._persist()
  const loaded = new GameRun()
  assert(loaded._loaded, 'Accepted saves open with the production artwork')
  assert.equal(loaded.player.gold, 43)
  assert.equal(loaded.sceneView, GAME_SCENE_VIEW)
  assert.equal(JSON.parse(saves.get(SAVE_KEY)).sceneView, undefined, 'Visual defaults do not change the save format')
  loaded.reset(); assert.equal(loaded.sceneView, GAME_SCENE_VIEW)
  const writes = calls.length, savedGame = saves.get(SAVE_KEY)
  const review = createArtTweakRun(); review.reset()
  assert.equal(calls.length, writes, 'The review fixture stays isolated from game saves')
  assert.equal(saves.get(SAVE_KEY), savedGame)
  assert.equal(review.sceneView.framing, GAME_SCENE_VIEW.framing)
  assert.equal(review.sceneView.environment, run.sceneView.environment)

  // Execute the real route switch with only DOM/Vue mounting substituted.
  const main = (await readFile(new URL('../src/main.js', import.meta.url), 'utf8'))
    .replace(/^import .*$/gm, '').replaceAll('import(', 'loadModule(')
  for (const pathname of ['/', '/arttweak', '/wiki', '/animepreview']) {
    const classes = new Set(), mounts = []
    const context = {
      window: { location: { pathname }, addEventListener() {} },
      document: { body: { classList: { add: name => classes.add(name) } } },
      finishStartup() {},
      createApp(page, props) { mounts.push({ page, props }); return { mount() {}, unmount() {} } },
      async loadModule(path) {
        if (path === './game/run.js') return { GameRun }
        if (path === './game/art-tweak.js') return { createArtTweakRun }
        if (path === './ui/wiki.js') return { WikiPage: class {} }
        return { default: path }
      },
    }
    await vm.runInNewContext('(async () => {' + main + '})()', context)
    const gamePage = pathname === '/' || pathname === '/arttweak'
    assert.equal(classes.has('temple-game-page'), gamePage, 'Theme is shared by both game entries only')
    if (gamePage) assert.equal(mounts[0].props.run.sceneView.environment, 'mountain-temple')
  }
  // Restarting with a shared scene preset must not clear the normal debug setting.
  const hud = await readFile(new URL('../src/ui/VueHud.vue', import.meta.url), 'utf8')
  const restart = hud.slice(hud.indexOf('function restartGame()'), hud.indexOf('\nfunction ', hud.indexOf('function restartGame()') + 1))
  for (const live of [run, review]) {
    const reveal = { value: true }; let resetViews = 0
    vm.runInNewContext(restart + '; restartGame()', {
      run: live, reveal, scene: { value: { resetView() { resetViews++ } } },
      closeDetailPanel() {}, topPanel: {}, helpOpen: {}, craftOpen: {}, merchantTab: {},
    })
    assert.equal(reveal.value, live.persistenceEnabled, 'Restart retains normal settings and clears review reveal')
    assert.equal(resetViews, 1, 'Restart returns both game and review to their initial shot')
  }
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert(!styles.includes('body.art-tweak-page'), 'No finished HUD styling remains restricted to review')
  assert(!styles.includes('--art-tweak-width'))
  assert(styles.includes('body.temple-game-page .temple-backdrop.temple-parallax-backdrop'))
  assert(styles.includes('body.temple-game-page .vital-armor'))

  const context = new Proxy({}, { get: (_target, key) => key === 'createRadialGradient' || key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {} })
  globalThis.document = { createElement: () => ({ getContext: () => context }) }
  const { GameScene } = await server.ssrLoadModule('/src/render/scene.js')
  const { TempleEnvironment } = await server.ssrLoadModule('/src/render/temple-environment.js')
  const environment = Object.create(TempleEnvironment.prototype)
  for (const name of ['stone', 'masonry', 'soilStone', 'gateWood']) {
    environment[name] = new THREE.Texture(); environment[name].userData.boardShared = true
  }
  environment.props = { get: () => environment.stone }
  const scene = Object.create(GameScene.prototype)
  Object.assign(scene, { run, environment, scene: new THREE.Scene(), roomGroup: new THREE.Group(), tileMeshes: [], doorMeshes: [],
    camera: new THREE.PerspectiveCamera(45, 1, .1, 80), cameraElevation: run.sceneView.cameraElevation, zoom: 1,
    container: { clientWidth: 400, clientHeight: 650 },
  })
  scene._addLights()
  assert(scene.templeLighting.getObjectByName('temple-key-light'), 'Real game selects temple lighting')
  for (const room of [...run.dungeon.rooms.values()].slice(0, 3)) {
    run.player.roomId = room.id; run.player.pos = room.entry ? { ...room.entry } : { c: Math.floor(room.width / 2), r: Math.floor(room.height / 2) }
    for (const door of run.dungeon.doorsForRoom(room.id)) door.discovered = true
    scene._rebuildRoomStructure(room)
    for (const name of ['temple-inner-rail', 'temple-maple-in-planting', 'temple-wind-banner', 'temple-planting-belt', 'platform-foundation-wall']) {
      assert(scene.structureGroup.getObjectByName(name), 'Missing production scenery: ' + name)
    }
    assert(scene.structureGroup.children.some(group => group.children.some(child => child.material?.userData.stoneCarving)), 'Carved stone rails appear in real rooms')
    for (const mesh of scene.doorMeshes) assert(mesh.userData.templeGate && mesh.userData.stoneFrame.visible)
    assert(scene.doorMeshes.length > 0)
    for (const [width, height] of [[320, 480], [400, 650], [520, 620]]) {
      scene.container.clientWidth = width; scene.container.clientHeight = height
      scene._frameRoom(room, { resetView: true })
      const point = scene._gridPosition(room, run.player.pos)
      assert(Math.abs(scene.roomGroup.position.x + point.x) < 1e-8)
      assert(Math.abs(scene.roomGroup.position.z + point.z) < 1e-8)
      for (const y of [0, 1.6]) {
        const projected = new THREE.Vector3(0, y, 0).project(scene.camera)
        assert(Math.abs(projected.x) < .95 && Math.abs(projected.y) < .95 && projected.z > -1 && projected.z < 1, 'Player and standing model remain inside the opening shot')
      }
    }
    scene.roomGroup.position.x = 1
    scene._updateCamera()
    assert(scene.cameraAzimuth < 0, 'Normal camera orbit still responds to panning')
  }
  console.log('Game art migration passed: real/review routes share the theme, ordinary opening/save/restart, review isolation, temple lights/scenery/carvings/doors in three generated rooms and player framing across phone/desktop sizes.')
} finally {
  globalThis.localStorage = previousStorage
  globalThis.document = previousDocument
  await server.close()
}
