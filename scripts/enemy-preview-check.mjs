import assert from 'node:assert/strict'
import { URLSearchParams } from 'node:url'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createEnemyPreviewModels, enemyDetailHref } from '../src/animation/shadow-preview-models.js'
import { ENEMY_DEFS } from '../src/game/data/enemies.js'
import catalog from '../src/game/data/catalog.json' with { type: 'json' }

const previousWindow = globalThis.window
let cacheAccesses = 0
globalThis.window = { location: new URL('http://localhost/animepreview'), URLSearchParams,
  get localStorage() { cacheAccesses++; throw new Error('preview must not read manual model drafts') } }
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const models = createEnemyPreviewModels()
  assert.equal(models.length, ENEMY_DEFS.length + 1)
  assert.equal(new Set(models.map(p => p.enemyId)).size, models.length)
  assert(models.some(p => p.enemyId === catalog.boss.id))
  const { default: Gallery } = await server.ssrLoadModule('/src/ui/AnimePreview.vue')
  const gallery = await renderToString(createSSRApp(Gallery))
  assert.equal((gallery.match(/class="anime-enemy-card"/g) || []).length, models.length)
  for (const model of models) assert(gallery.includes(`href="${enemyDetailHref(model.enemyId)}"`))
  assert(gallery.includes('\u654c\u4eba\u9884\u89c8'))
  const { default: Detail } = await server.ssrLoadModule('/src/ui/AnimeDetail.vue')
  for (const model of models) {
    window.location = new URL(enemyDetailHref(model.enemyId), 'http://localhost')
    const html = await renderToString(createSSRApp(Detail))
    assert(html.includes(`<h1>${model.name}</h1>`), `detail selected the wrong model: ${model.enemyId}`)
    assert(html.includes('anime-detail-stage') && html.includes('role="tablist"'))
    assert(html.includes('\u9aa8\u67b6') && html.includes('\u8d34\u56fe'))
    assert(!html.includes('\ufffd'), `invalid Unicode in ${model.enemyId}`)
  }
  window.location = new URL('http://localhost/animedetail?enemy=moss-colossus')
  assert((await renderToString(createSSRApp(Detail))).includes('<h1>\u82d4\u85d3\u5de8\u50cf</h1>'))
  window.location = new URL('http://localhost/animedetail/missing-enemy')
  const missing = await renderToString(createSSRApp(Detail))
  assert(missing.includes('anime-detail-missing') && missing.includes('href="/animepreview"'))
  assert(!missing.includes('anime-detail-stage'))
  assert.equal(cacheAccesses, 0, 'manual drafts cannot override the review pages')
} finally {
  await server.close()
  if (previousWindow === undefined) delete globalThis.window
  else globalThis.window = previousWindow
}
console.log('Enemy review: all code models, gallery/detail selection, query links, missing model and draft isolation passed (SSR).')
