import assert from 'node:assert/strict'
import { NoColorSpace, SRGBColorSpace } from 'three'
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
  .replace(/import (\w+) from '[^']+\.(?:jpg|png|webp)'/g, "const $1 = 'test-image.jpg'")
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
  const texture = textures.back(attr, false)
  assert.equal(texture, textures.back(attr, false))
  all.add(texture)
}
const blockedBack = textures.back('neutral', true)
for (const attr of ['neutral', 'scorch', 'wither', 'drown', 'unknown']) assert.equal(textures.back(attr, true), blockedBack)
all.add(blockedBack)
assert.equal(all.size, 9)
assert.equal(textures.back('unknown', false), textures.back('neutral', false))
assert.equal(textures.backNormal(textures.floor()), null)
const normals = new Set()
for (const texture of [...all].filter(texture => texture.userData.cardBackKind)) {
  assert.equal(texture.colorSpace, SRGBColorSpace)
  const normal = textures.backNormal(texture)
  assert(normal)
  assert.equal(normal, textures.backNormal(texture))
  assert.equal(normal.colorSpace, NoColorSpace, 'Normal vectors must not undergo sRGB decoding')
  normals.add(normal)
  all.add(normal)
}
assert.equal(normals.size, 5, 'Each card-back pattern needs its own normal map')
assert.equal(all.size, 14)
const wear = []
for (const [kind, list] of textures.cardWear) {
  assert.equal(list.length, 3, `${kind} needs three tone variants`)
  for (const texture of list) {
    assert.equal(texture.colorSpace, NoColorSpace, 'Wear is a multiplier, not colour')
    assert.equal(texture.userData.cardWearKind, kind)
    wear.push(texture)
    all.add(texture)
  }
}
assert.equal(wear.length, 15, 'Five card kinds x three tone variants')
assert.equal(all.size, 29)
for (const texture of [...all].filter(texture => texture.userData.boardFloor || texture.userData.cardBackKind)) {
  const maps = textures.surfaceData(texture)
  assert(maps.normal && maps.surface)
  assert.equal(maps.surface.colorSpace, NoColorSpace)
  assert.equal(maps.normal.colorSpace, NoColorSpace)
  all.add(maps.normal); all.add(maps.surface)
  const clone = texture.clone()
  assert.equal(textures.surfaceData(clone).surface, maps.surface, 'Flip snapshots preserve shared PBR data')
  clone.dispose()
}
assert.equal(all.size, 42)
const before = textures.back('scorch', false).version
pendingImages.splice(0).forEach(image => image.onload())
assert.deepEqual(await textures.ready, Array(42).fill(true))
assert(textures.back('scorch', false).version > before)
let disposed = 0
for (const texture of all) {
  assert.equal(texture.image.width, 256, 'Board textures must remain compact on the GPU')
  assert.equal(texture.image.height, 256)
  assert.equal(texture.userData.boardShared, true)
  texture.addEventListener('dispose', () => disposed++)
}
const snapshot = textures.back('scorch', false).clone()
snapshot.userData.boardShared = false
assert.equal(textures.backNormal(snapshot), textures.backNormal(textures.back('scorch', false)), 'Queued flip snapshots must retain their matching shared normal')
assert.equal(textures.back('scorch', false).userData.boardShared, true)
snapshot.dispose()
assert.equal(disposed, 0)
textures.dispose()
assert.equal(disposed, 42)

const closed = new BoardTextures()
const lastVersion = closed.floor().version
const lastNormal = closed.backNormal(closed.back('neutral', true))
const lastNormalVersion = lastNormal.version
closed.dispose()
pendingImages.splice(0).forEach(image => image.onload())
await closed.ready
assert.equal(closed.floor().version, lastVersion)
assert.equal(lastNormal.version, lastNormalVersion)
delete globalThis.document
console.log('board-textures-check passed: bounded cache, async refresh, isolated flip snapshots, disposal')
