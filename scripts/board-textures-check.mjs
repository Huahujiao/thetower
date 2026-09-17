import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// Exercise async loading and GPU-resource ownership without launching a browser.
const pendingImages = []
const canvasContext = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}) })
globalThis.document = {
  createElement(tag) {
    if (tag === 'img') {
      const image = { width: 1024, height: 1024 }
      pendingImages.push(image)
      return image
    }
    return { getContext: () => canvasContext }
  },
}
const source = (await readFile(new URL('../src/render/board-textures.js', import.meta.url), 'utf8'))
  .replace("from 'three'", `from '${import.meta.resolve('three')}'`)
  .replace(/import (\w+) from '[^']+\.jpg'/g, "const $1 = 'test-image.jpg'")
const { BoardTextures } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const textures = new BoardTextures()
const all = new Set()
for (let c = 0; c < 9; c++) for (let r = 0; r < 5; r++) {
  const texture = textures.floor({ c, r })
  assert.equal(texture, textures.floor({ c, r }), 'Variant must remain stable across redraws')
  all.add(texture)
}
assert.equal(all.size, 4)
for (const attr of ['neutral', 'scorch', 'wither', 'drown']) {
  for (const blocked of [true, false]) {
    const texture = textures.back(attr, blocked)
    assert.equal(texture, textures.back(attr, blocked))
    all.add(texture)
  }
}
assert.equal(all.size, 12)
assert.equal(textures.back('unknown', false), textures.back('neutral', false))
const before = textures.back('scorch', false).version
pendingImages.splice(0).forEach(image => image.onload())
assert.deepEqual(await textures.ready, Array(8).fill(true))
assert(textures.back('scorch', false).version > before)
let disposed = 0
for (const texture of all) {
  assert.equal(texture.userData.boardShared, true)
  texture.addEventListener('dispose', () => disposed++)
}
const snapshot = textures.back('scorch', false).clone()
snapshot.userData.boardShared = false
assert.equal(textures.back('scorch', false).userData.boardShared, true)
snapshot.dispose()
assert.equal(disposed, 0)
textures.dispose()
assert.equal(disposed, 12)

const closed = new BoardTextures()
const lastVersion = closed.floor().version
closed.dispose()
pendingImages.splice(0).forEach(image => image.onload())
await closed.ready
assert.equal(closed.floor().version, lastVersion)
delete globalThis.document
console.log('board-textures-check passed: bounded cache, async refresh, isolated flip snapshots, disposal')
