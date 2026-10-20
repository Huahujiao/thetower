import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { Group, PerspectiveCamera, Vector3 } from 'three'
import { SceneLoading, nextScenePaint, waitForSceneModule } from '../src/render/scene-loading.js'

const flush = () => new Promise(resolve => globalThis.setTimeout(resolve, 0))
const controllers = new Map(), snapshots = [], requests = []
const assets = new SceneLoading(state => snapshots.push(state), {
  concurrency: 2,
  fetcher: async url => {
    requests.push(url)
    return new globalThis.Response(new globalThis.ReadableStream({ start(controller) { controllers.set(url, controller) } }), { headers: { 'content-length': '3' } })
  },
})
assets.begin('background')
const first = assets.arrayBuffer('/a'), second = assets.arrayBuffer('/b'), third = assets.arrayBuffer('/c')
assert.equal(assets.arrayBuffer('/a'), first, 'Duplicate requests share one download')
assert.equal(requests.length, 2, 'The third request waits for a download slot')
controllers.get('/a').enqueue(new Uint8Array([1, 2]))
await flush()
assert.equal(assets.snapshot().bytes, 2, 'Byte count changes before a response finishes')
assert.equal(assets.snapshot().completed, 0)
assert(assets.snapshot().progress < 40, 'A partial background is not reported complete')
controllers.get('/a').enqueue(new Uint8Array([3])); controllers.get('/a').close()
assert.deepEqual([...new Uint8Array(await first)], [1, 2, 3])
await flush()
assert.equal(requests.length, 3)
for (const url of ['/b', '/c']) { controllers.get(url).enqueue(new Uint8Array([4, 5, 6])); controllers.get(url).close() }
await Promise.all([second, third]); await assets.idle()
assert.equal(assets.snapshot().bytes, 9)
assert.equal(assets.snapshot().completed, 3)
assets.recordTiming({ name: 'http://localhost/a', encodedBodySize: 3 })
assert.equal(assets.snapshot().total, 3, 'ResourceTiming does not double-count tracked fetches')
assets.completeStage(); assets.begin('structure'); assets.setWork(1, 2)
assert(snapshots.every((state, i) => i === 0 || state.progress >= snapshots[i - 1].progress), 'Overall progress never moves backwards')
assets.dispose()

const reused = new SceneLoading(() => {}, { fetcher: async () => new globalThis.Response(new Uint8Array([1, 2, 3])) })
reused.recordTiming({ name: 'http://localhost/cached', encodedBodySize: 3 })
await reused.arrayBuffer('/cached')
assert.equal(reused.snapshot().total, 1)
assert.equal(reused.snapshot().bytes, 3, 'A previously observed image is not charged a second time')
reused.dispose()

const failed = new SceneLoading(() => {}, { fetcher: async () => new globalThis.Response('', { status: 404 }) })
await assert.rejects(failed.arrayBuffer('/missing'), /404/)
assert.equal(failed.snapshot().failed, 1)
assert.equal(failed.snapshot().completed, 0)
await failed.idle(); failed.dispose()

const cancelled = new SceneLoading(() => {}, {
  concurrency: 1,
  fetcher: (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })),
})
const stopped = Promise.allSettled([cancelled.arrayBuffer('/active'), cancelled.arrayBuffer('/queued')])
cancelled.dispose()
assert((await stopped).every(result => result.status === 'rejected'), 'Unmount cancels active and queued downloads')
await cancelled.idle()
await assert.rejects(cancelled.arrayBuffer('/late'), /cancelled/)

// A phone can stop delivering animation frames without rejecting a promise.
const originalFrame = globalThis.requestAnimationFrame
const originalCancelFrame = globalThis.cancelAnimationFrame
try {
  const cancelledFrames = []
  globalThis.requestAnimationFrame = () => 7
  globalThis.cancelAnimationFrame = id => cancelledFrames.push(id)
  await nextScenePaint()
  assert(cancelledFrames.includes(7), 'A suspended first frame cannot block startup forever')
  let frame = 0
  globalThis.requestAnimationFrame = callback => {
    frame++
    if (frame === 1) queueMicrotask(callback)
    return frame
  }
  await nextScenePaint()
  assert.equal(frame, 2, 'A suspended second frame also has a fallback')
  delete globalThis.requestAnimationFrame
  await nextScenePaint()
} finally {
  if (originalFrame === undefined) delete globalThis.requestAnimationFrame
  else globalThis.requestAnimationFrame = originalFrame
  if (originalCancelFrame === undefined) delete globalThis.cancelAnimationFrame
  else globalThis.cancelAnimationFrame = originalCancelFrame
}
assert.equal(await waitForSceneModule(Promise.resolve('ready'), 'module', 20), 'ready')
await assert.rejects(waitForSceneModule(Promise.reject(new Error('broken import')), 'module', 20), /broken import/)
await assert.rejects(waitForSceneModule(new Promise(() => {}), '三维场景模块加载', 10), /三维场景模块加载超时/)
const hung = new SceneLoading(() => {}, { requestTimeout: 15, fetcher: () => new Promise(() => {}) })
await assert.rejects(hung.arrayBuffer('/no-response'), /资源响应超时/)
await hung.idle()
assert.equal(hung.snapshot().failed, 1)
hung.dispose()
const noBody = new SceneLoading(() => {}, {
  requestTimeout: 15,
  fetcher: async () => new Response(new ReadableStream({ start() {} })),
})
await assert.rejects(noBody.arrayBuffer('/stalled-stream'), /资源响应超时/)
await noBody.idle(); noBody.dispose()
const slow = new SceneLoading(() => {}, {
  requestTimeout: 80,
  fetcher: async () => new Response(new ReadableStream({ async start(controller) {
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 45))
      controller.enqueue(new Uint8Array([i]))
    }
    controller.close()
  } })),
})
assert.equal((await slow.arrayBuffer('/slow-but-active')).byteLength, 3, 'Slow active downloads reset the inactivity deadline')
slow.dispose()
const decodeDocument = globalThis.document
try {
  globalThis.document = { createElement: () => ({}) }
  const decode = new SceneLoading(() => {}, { decodeTimeout: 10, fetcher: async () => new Response(new Uint8Array([1])) })
  await assert.rejects(decode.image('/decode-stalled'), /图片解码超时/)
  await decode.idle()
  assert.equal(decode.objectUrls.size, 0)
  assert.equal(decode.snapshot().failed, 1)
  decode.dispose()
  const cancelledDecode = new SceneLoading(() => {}, { fetcher: async () => new Response(new Uint8Array([1])) })
  const pendingDecode = assert.rejects(cancelledDecode.image('/decode-cancelled'), /cancelled/)
  await flush()
  cancelledDecode.dispose()
  await pendingDecode
  await cancelledDecode.idle()
} finally {
  if (decodeDocument === undefined) delete globalThis.document
  else globalThis.document = decodeDocument
}

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
const oldFrame = globalThis.requestAnimationFrame
const oldDocument = globalThis.document
try {
  const { BoardTextures } = await server.ssrLoadModule('/src/render/board-textures.js')
  const context = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}) })
  globalThis.document = { createElement: () => ({ getContext: () => context }) }
  let imageRequests = 0
  const board = new BoardTextures({ defer: true, assets: { image: async () => { imageRequests++; return {} } } })
  assert.equal(imageRequests, 0, 'Floor resources do not compete with background downloads')
  board.startLoading(); await board.ready
  assert(imageRequests > 0)
  board.dispose()
  const { TempleParallaxBackdrop } = await server.ssrLoadModule('/src/render/temple-parallax-backdrop.js')
  const element = () => ({ style: {}, dataset: {}, setAttribute() {}, appendChild() {}, remove() {} })
  globalThis.document = { createElement: element, createElementNS: element }
  let backgrounds = 0
  const container = { clientWidth: 400, clientHeight: 700, prepend() {} }
  const backdrop = new TempleParallaxBackdrop(container, { image: async url => { backgrounds++; return { src: url } } })
  await backdrop.ready
  assert.equal(backgrounds, 3, 'All background layers can arrive before a camera exists')
  assert.equal(backdrop.point, null)
  const camera = new PerspectiveCamera(43, 400 / 700, .05, 40)
  camera.position.set(5, 8, 7); camera.lookAt(0, 0, 0)
  const platform = { group: new Group() }
  backdrop.update(0, true, camera, platform)
  const reference = new Vector3().project(camera)
  platform.group.position.x = 1
  backdrop.update(2, false, camera, platform)
  const shifted = new Vector3().applyMatrix4(platform.group.matrixWorld).project(camera)
  const expectedOffset = Math.max(-36, Math.min(36, (shifted.x - reference.x) * 200 * .20))
  assert(Math.abs(Number(backdrop.layers[1].element.dataset.offsetX) - expectedOffset) < .001, 'Removing the engine import preserves camera-based parallax')
  backdrop.dispose()
  const { GameScene } = await server.ssrLoadModule('/src/render/scene.js')
  const scene = Object.create(GameScene.prototype)
  const events = [], states = []
  const loading = new SceneLoading(state => states.push(state), { fetcher: async () => { throw new Error('Unexpected request') } })
  const room = { id: 'startup', width: 2, height: 3 }
  Object.assign(scene, {
    run: { currentRoom: room }, startupPending: true, actorsDeferred: true, disposed: false,
    tileMeshes: [], assets: loading,
    boardTextures: { startLoading() { events.push('textures') }, ready: Promise.resolve() },
    attackRangeOverlay: { refresh() { events.push('overlay') } },
    _rebuildRoomStructure() { events.push('structure') }, _frameRoom() {}, _syncExplorationFog() {},
    _visibleDoorKey() { return 'doors' },
    _addTile(_room, position) { assert(scene.actorsDeferred); scene.tileMeshes.push({ userData: { position } }); events.push('tile') },
    async _prepareEnemyAssets() { assert.equal(scene.tileMeshes.length, 6); assert(scene.actorsDeferred); events.push('enemy-assets') },
    _refreshTile() { assert(!scene.actorsDeferred); events.push('actor') },
  })
  let frames = 0
  globalThis.requestAnimationFrame = callback => {
    events.push('paint:' + scene.tileMeshes.length)
    globalThis.queueMicrotask(() => callback(frames++))
    return frames
  }
  await scene.initializeProgressively(loading)
  assert.equal(scene.startupPending, false)
  assert.equal(scene.framedRoomId, room.id)
  assert(events.indexOf('structure') < events.indexOf('tile'))
  assert(events.indexOf('tile') < events.indexOf('enemy-assets'))
  assert(events.indexOf('enemy-assets') < events.indexOf('actor'))
  assert(events.includes('paint:2') && events.includes('paint:4'), 'Rows are painted before the complete board exists')
  assert(states.some(state => state.label === '铺设地板与迷雾'))
  assert.equal(loading.snapshot().progress, 100)
  loading.dispose()
  scene.disposed = false; scene.actorsDeferred = true; scene.tileMeshes = []
  const interrupted = new SceneLoading()
  globalThis.requestAnimationFrame = callback => { scene.disposed = true; globalThis.queueMicrotask(callback); return 0 }
  await assert.rejects(scene.initializeProgressively(interrupted), /cancelled/)
  assert.equal(scene.tileMeshes.length, 0, 'Disposal during a paint yield stops later scene stages')
  interrupted.dispose()
  console.log('Scene loading passed: suspended frames, module timeouts, stalled response/decode recovery, active slow downloads, streaming bytes, request deduplication/queue, failures, cancellation, stage order, row paint yields and final readiness.')
} finally {
  globalThis.requestAnimationFrame = oldFrame
  if (oldDocument === undefined) delete globalThis.document
  else globalThis.document = oldDocument
  await server.close()
}
