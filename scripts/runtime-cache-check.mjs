import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { preview } from 'vite'

const workspace = resolve('.')
const temporaryRoot = resolve(workspace, 'tmp')
await mkdir(temporaryRoot, { recursive: true })
const fixture = await mkdtemp(resolve(temporaryRoot, 'runtime-cache-check-'))
const hashed = '/assets/card-neutral-normal-AbCd1234.png'
let server
try {
  await mkdir(resolve(fixture, 'assets/enemies'), { recursive: true })
  await writeFile(resolve(fixture, 'index.html'), '<!doctype html><title>Runtime cache fixture</title>')
  await writeFile(resolve(fixture, '.' + hashed), 'image-fixture')
  await writeFile(resolve(fixture, 'assets/entry-AbCd1234.js'), 'export const ready = true')
  await writeFile(resolve(fixture, 'assets/enemies/gnawer.png'), 'enemy-fixture')
  server = await preview({
    configFile: resolve(workspace, 'vite.config.js'), logLevel: 'silent',
    build: { outDir: fixture },
    preview: { host: '127.0.0.1', port: 0, strictPort: false, open: false },
  })
  const base = 'http://127.0.0.1:' + server.httpServer.address().port
  const request = (path, options = {}) => globalThis.fetch(base + path, options)
  const image = await request(hashed)
  assert.equal(image.status, 200)
  assert.equal(image.headers.get('cache-control'), 'public, max-age=31536000, immutable')
  const script = await request('/assets/entry-AbCd1234.js')
  assert.match(script.headers.get('cache-control'), /immutable/)
  const etag = image.headers.get('etag')
  assert(etag)
  const unchanged = await request(hashed, { headers: { 'If-None-Match': etag } })
  assert.equal(unchanged.status, 304)
  assert.match(unchanged.headers.get('cache-control'), /immutable/)
  const sourceWrapper = await request(hashed + '?import')
  assert(!sourceWrapper.headers.get('cache-control')?.includes('immutable'))
  const versioned = await request('/assets/enemies/gnawer.png?v=2')
  assert.match(versioned.headers.get('cache-control'), /immutable/)
  const unversioned = await request('/assets/enemies/gnawer.png')
  assert(!unversioned.headers.get('cache-control')?.includes('immutable'))
  for (const path of ['/', '/arttweak']) {
    const entry = await request(path)
    assert.equal(entry.status, 200)
    assert(!entry.headers.get('cache-control')?.includes('immutable'))
  }
  const missing = await request('/assets/missing-AbCd1234.js')
  assert.match(missing.headers.get('content-type'), /text\/html/)
  assert.match(await missing.text(), /Runtime cache fixture/)
  assert(!missing.headers.get('cache-control')?.includes('immutable'))
  console.log('Runtime cache passed: hashed scripts/images, 304, versioned enemies, fresh HTML, module wrappers and missing files.')
} finally {
  await server?.close()
  assert(fixture.startsWith(temporaryRoot + sep), 'Cleanup stays inside the workspace temporary directory')
  await rm(fixture, { recursive: true, force: true })
}
