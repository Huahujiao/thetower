import assert from 'node:assert/strict'
import { URLSearchParams } from 'node:url'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createEnemyPreviewModels, enemyDetailHref, enemyGalleryHref } from '../src/animation/shadow-preview-models.js'
import { ENEMY_TEXTURE_STYLES, enemyTextureUrl, normalizeEnemyTextureStyle } from '../src/animation/enemy-texture-styles.js'
import { ENEMY_DEFS } from '../src/game/data/enemies.js'
import catalog from '../src/game/data/catalog.json' with { type: 'json' }
import portraits from '../src/render/enemy-thumbnails.generated.json' with { type: 'json' }

const previousWindow = globalThis.window
let cacheAccesses = 0
globalThis.window = { location: new URL('http://localhost/animepreview'), URLSearchParams,
  get localStorage() { cacheAccesses++; throw new Error('preview must not read manual model drafts') } }
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const models = createEnemyPreviewModels()
  assert.equal(portraits.enemies.length, models.length)
  assert.equal(portraits.width, 300)
  assert.equal(portraits.height, 360)
  for (const style of ENEMY_TEXTURE_STYLES) {
    let bytes = 0
    for (const model of models) {
      const entry = portraits.enemies.find(entry => entry.enemyId === model.enemyId)
      assert.equal(entry?.name, model.name)
      const url = entry.images[style.id].url
      assert(/^\/assets\/enemies\/thumbnails\/[a-z-]+\/[a-z0-9-]+-[a-f0-9]{20}\.webp$/.test(url))
      const image = readFileSync(`public${url}`)
      assert.equal(image.toString('ascii', 0, 4), 'RIFF')
      assert.equal(image.toString('ascii', 8, 12), 'WEBP')
      bytes += statSync(`public${url}`).size
    }
    assert(bytes < 10_000_000, `${style.id} thumbnail gallery must be smaller than 10 MB`)
  }
  const gallerySource = readFileSync('src/ui/AnimePreview.vue', 'utf8')
  assert(!/createEnemyPreviewModels|createEnemyThumbnailRenderer|createEnemyThumbnailCache/.test(gallerySource), 'gallery must load shared images without building rigs or rendering on each device')
  assert.equal(models.length, ENEMY_DEFS.length + 1)
  assert.equal(new Set(models.map(p => p.enemyId)).size, models.length)
  assert(models.some(p => p.enemyId === catalog.boss.id))
  assert(ENEMY_TEXTURE_STYLES.some(style => style.id === 'original') && ENEMY_TEXTURE_STYLES.some(style => style.id === 'pale'))
  assert.equal(normalizeEnemyTextureStyle('unknown-style'), 'original')
  assert.equal(enemyTextureUrl('/custom-upload.png', 'pale'), '/custom-upload.png')
  for (const model of models) for (const part of model.parts) {
    const source = part.visual.texture
    assert.equal(enemyTextureUrl(source).split('?')[0], source, 'original selection must keep the code model texture path')
    assert(enemyTextureUrl(source).includes('?v='), 'original artwork needs a stable cache revision')
    const styled = enemyTextureUrl(source, 'pale')
    assert(styled.startsWith('/assets/enemies/styles/pale/') && styled.includes('?v='), 'all code model textures must have a generated pale variant')
    assert(existsSync(`public${styled.split('?')[0]}`), `missing styled part: ${model.enemyId}/${part.id}`)
  }
  const { default: Gallery } = await server.ssrLoadModule('/src/ui/AnimePreview.vue')
  const gallery = await renderToString(createSSRApp(Gallery))
  assert.equal((gallery.match(/class="anime-enemy-card"/g) || []).length, models.length)
  assert.equal((gallery.match(/<img /g) || []).length, models.length)
  assert(gallery.includes('loading="lazy"') && gallery.includes('loading="eager"'))
  for (const entry of portraits.enemies) assert(gallery.includes(`src="${entry.images.original.url}"`))
  for (const model of models) assert(gallery.includes(`href="${enemyDetailHref(model.enemyId)}"`))
  assert(gallery.includes('\u654c\u4eba\u9884\u89c8'))
  assert(gallery.includes('aria-label="\u8d34\u56fe\u98ce\u683c"') && gallery.includes('value="original"') && gallery.includes('value="pale"'), 'gallery needs a style selector for the entire enemy list')
  window.location = new URL(enemyGalleryHref('pale'), 'http://localhost')
  const paleGallery = await renderToString(createSSRApp(Gallery))
  for (const entry of portraits.enemies) assert(paleGallery.includes(`src="${entry.images.pale.url}"`))
  assert(paleGallery.includes('value="pale" selected'), 'gallery should restore the chosen style from its URL')
  for (const model of models) assert(paleGallery.includes(`href="${enemyDetailHref(model.enemyId, 'pale')}"`), 'gallery links must carry the chosen style into every detail page')
  window.location = new URL('http://localhost/animepreview?style=invalid')
  assert((await renderToString(createSSRApp(Gallery))).includes('value="original" selected'), 'gallery should fall back to original for unknown styles')
  const { default: Detail } = await server.ssrLoadModule('/src/ui/AnimeDetail.vue')
  for (const model of models) {
    window.location = new URL(enemyDetailHref(model.enemyId), 'http://localhost')
    const html = await renderToString(createSSRApp(Detail))
    assert(html.includes(`<h1>${model.name}</h1>`), `detail selected the wrong model: ${model.enemyId}`)
    assert(html.includes('anime-detail-stage') && html.includes('role="tablist"'))
    assert(html.includes('\u9aa8\u67b6') && html.includes('\u8d34\u56fe'))
    assert(html.includes('aria-label="\u8d34\u56fe\u98ce\u683c"') && html.includes('value="original"') && html.includes('value="pale"'), 'each enemy detail needs the texture style dropdown')
    assert(!html.includes('\ufffd'), `invalid Unicode in ${model.enemyId}`)
  }
  window.location = new URL('http://localhost/animedetail?enemy=moss-colossus')
  assert((await renderToString(createSSRApp(Detail))).includes('<h1>\u82d4\u85d3\u5de8\u50cf</h1>'))
  window.location = new URL(enemyDetailHref('moss-colossus', 'pale'), 'http://localhost')
  const paleDetail = await renderToString(createSSRApp(Detail))
  assert(paleDetail.includes('value="pale" selected'), 'style query should restore the selected texture set')
  assert(paleDetail.includes('?style=pale'), 'switching enemies should retain the selected style')
  assert(paleDetail.includes(`href="${enemyGalleryHref('pale')}"`), 'returning to the gallery should retain the detail style')
  window.location = new URL('http://localhost/animedetail/moss-colossus?style=invalid')
  assert((await renderToString(createSSRApp(Detail))).includes('value="original" selected'), 'invalid styles should fall back to original textures')
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
