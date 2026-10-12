import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createEnemyThumbnailCache, enemyThumbnailModelRevision } from '../src/render/enemy-thumbnail-cache.js'
import { enemyTextureUrl } from '../src/animation/enemy-texture-styles.js'
import portraits from '../src/render/enemy-thumbnails.generated.json' with { type: 'json' }

const { fetch, queueMicrotask, structuredClone } = globalThis

// A shared backing store models independent page instances and transaction
// failures, without needing a GPU or altering any real browser storage.
const records = new Map()
let failWrite = false
const storage = { open() {
  const request = {}
  queueMicrotask(() => {
    request.result = {
      close() {},
      transaction(_store, mode) {
        const transaction = { objectStore: () => ({
          get(key) {
            const result = { result: structuredClone(records.get(key)) }
            queueMicrotask(() => transaction.oncomplete())
            return result
          },
          put(record, key) {
            if (!failWrite) records.set(key, structuredClone(record))
            queueMicrotask(() => failWrite && mode === 'readwrite' ? transaction.onabort() : transaction.oncomplete())
            return { result: key }
          },
        }) }
        return transaction
      },
    }
    request.onsuccess()
  })
  return request
} }

const projects = ['gnawer', 'drown-shadow-hunter'].map(enemyId => ({ enemyId,
  joints: [{ id: 'root', x: 0, y: 0, z: 0 }], bones: [], parts: [{ id: 'body', width: 40, height: 80 }],
  grounding: { floating: false, floorY: 0, supports: [] },
}))
const images = { gnawer: 'data:image/webp;base64,first', 'drown-shadow-hunter': 'data:image/webp;base64,hunter' }
const memory = new Map()
const coldPage = () => createEnemyThumbnailCache(() => storage, new Map())
const firstPage = createEnemyThumbnailCache(() => storage, memory)
assert.deepEqual(await firstPage.load('original', projects), {})
await firstPage.save('original', projects, { gnawer: images.gnawer })
const interruptedPage = coldPage()
assert.deepEqual(await interruptedPage.load('original', projects), { gnawer: images.gnawer },
  'finished portraits must survive a reload before the whole batch completes')
interruptedPage.close()
await firstPage.save('original', projects, images)
await firstPage.save('pale', projects, { gnawer: 'data:image/webp;base64,pale' })
firstPage.close()
const hotPage = createEnemyThumbnailCache(() => { throw new Error('HMR should use memory first') }, memory)
assert.deepEqual(hotPage.peek('original', projects), images, 'Vue remounts can display remembered images synchronously')
assert.deepEqual(await hotPage.load('original', projects), images, 'an unchanged hot update needs no storage or renderer')
hotPage.close()
const nextPage = coldPage()
assert.deepEqual(await nextPage.load('original', projects), images, 'portraits survive a page reload')
assert.equal((await nextPage.load('pale', projects)).gnawer, 'data:image/webp;base64,pale', 'styles retain separate portraits')
nextPage.close()

const changed = structuredClone(projects)
changed[1].joints[0].x = 15
const changedPage = coldPage()
assert.deepEqual(await changedPage.load('original', changed), { gnawer: images.gnawer },
  'changing the hunter must retain every unrelated enemy portrait')
const replacement = { ...images, 'drown-shadow-hunter': 'data:image/webp;base64,new-hunter' }
await changedPage.save('original', changed, replacement)
assert.deepEqual(changedPage.peek('original', changed), replacement)
assert.equal(enemyThumbnailModelRevision({ ...projects[0], enemyArtPackVersion: 999,
  animations: { attack: { duration: 1234 } } }), enemyThumbnailModelRevision(projects[0]),
  'pack counters and animation-only edits do not change standing portraits')
changedPage.close()
const restoredPage = coldPage()
await restoredPage.save('original', projects, images)
restoredPage.close()
assert.equal(records.size, 2, 'replace outdated records instead of accumulating every pack revision')
records.get('original').revision = 'previous-texture-content'
const stalePage = coldPage()
assert.deepEqual(await stalePage.load('original', projects), {}, 'changed texture or renderer revisions must regenerate portraits')
await stalePage.save('original', projects, images)
stalePage.close()
records.get('original').images['drown-shadow-hunter'] = 'not-an-image'
const invalidPage = coldPage()
assert.deepEqual(await invalidPage.load('original', projects), { gnawer: images.gnawer }, 'ignore invalid cached images')
await invalidPage.save('original', projects, images)
invalidPage.close()
failWrite = true
const quotaPage = coldPage()
await quotaPage.save('original', projects, { gnawer: 'data:image/webp;base64,rejected' })
assert.equal(quotaPage.peek('original', projects).gnawer, 'data:image/webp;base64,rejected',
  'memory cache remains usable when a persistent write fails')
quotaPage.close()
const retainedPage = coldPage()
assert.deepEqual(await retainedPage.load('original', projects), images, 'a failed transaction must preserve existing disk portraits')
retainedPage.close()
for (const getStorage of [() => undefined, () => { throw new Error('Storage blocked') }, () => ({ open() { throw new Error('Quota exceeded') } })]) {
  const cache = createEnemyThumbnailCache(getStorage, new Map())
  assert.deepEqual(await cache.load('original', projects), {})
  await cache.save('original', projects, images)
  assert.deepEqual(cache.peek('original', projects), images, 'blocked storage can still reuse portraits during HMR')
  cache.close()
}

const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } })
try {
  await server.listen()
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  const source = '/assets/enemies/components-v1/gnawer/part_001.png'
  const versioned = enemyTextureUrl(source)
  assert.equal(versioned, enemyTextureUrl(source), 'cache keys stay stable between page loads')
  const response = await fetch(base + versioned, { method: 'HEAD' })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable')
  const revalidated = await fetch(base + versioned, { method: 'HEAD', headers: { 'If-None-Match': response.headers.get('etag') } })
  assert.equal(revalidated.status, 304)
  assert.equal(revalidated.headers.get('cache-control'), response.headers.get('cache-control'))
  for (const style of portraits.styles) {
    const url = portraits.enemies[0].images[style].url
    const thumbnail = await fetch(base + url, { method: 'HEAD' })
    assert.equal(thumbnail.status, 200)
    assert(thumbnail.headers.get('content-type')?.startsWith('image/webp'))
    assert.equal(thumbnail.headers.get('cache-control'), 'public, max-age=31536000, immutable', 'shared thumbnails should remain cached across page loads')
    const cached = await fetch(base + url, { method: 'HEAD', headers: { 'If-None-Match': thumbnail.headers.get('etag') } })
    assert.equal(cached.status, 304)
    assert.equal(cached.headers.get('cache-control'), thumbnail.headers.get('cache-control'))
  }
  for (const path of [source, '/src/main.js', '/']) {
    const fresh = await fetch(base + path, { method: 'HEAD' })
    assert(!fresh.headers.get('cache-control')?.includes('immutable'), 'unversioned assets and application code stay up to date')
  }
  const missing = await fetch(base + '/assets/enemies/missing.png?v=test', { method: 'HEAD', headers: { Accept: 'image/png' } })
  assert.equal(missing.status, 404)
  assert(!missing.headers.get('cache-control')?.includes('immutable'), 'never persist failed asset responses')
} finally {
  await server.close()
}
console.log('Enemy cache: per-model invalidation, HMR memory reuse, partial progress, persistent portraits, style isolation and HTTP headers passed.')
