import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'
import { ARTICLE_PAGES, CATALOG_PAGES, WIKI_PAGES, WIKI_PAGE_BY_ID, WIKI_SECTIONS } from '../src/ui/wiki-pages.js'
import { catalogContent } from '../src/ui/wiki-catalog.js'
import { ALL_ITEM_DEFS } from '../src/game/data/content.js'
import catalog from '../src/game/data/catalog.json' with { type: 'json' }
import { ENEMY_HP_MULTIPLIER } from '../src/game/data/enemies.js'
import { ACTIVE_ITEMS, SHOP_ITEMS, enemyDistribution } from '../src/ui/wiki-data.js'
import { itemSpriteSources } from '../src/ui/item-sprites.js'
import { createEnemyShadowProjects } from '../src/animation/shadow-enemies.js'

assert.equal(ARTICLE_PAGES.length, 17)
assert.equal(CATALOG_PAGES.length, 6)
assert.equal(WIKI_PAGE_BY_ID.size, WIKI_PAGES.length)
const sectionIds = new Set(WIKI_SECTIONS.map((section) => section.id))

for (const page of WIKI_PAGES) {
  assert(sectionIds.has(page.section), `Unknown Wiki section: ${page.id}`)
  assert(page.title && page.summary, `Missing Wiki metadata: ${page.id}`)
}

const articles = new Map()
for (const page of ARTICLE_PAGES) {
  const { default: markdown } = await page.load()
  articles.set(page.id, markdown)
  assert(markdown.length > 100, `Empty Wiki article: ${page.id}`)
  assert(!markdown.includes('\uFFFD') && !markdown.includes('\\uFFFD'), `Invalid Unicode in Wiki article: ${page.id}`)
  assert(!/\]\([^)]*\.md\)/.test(markdown), `Old Markdown link: ${page.id}`)
  assert(!/四章|十二层|前三章|第四章|127种|食物初始3、5、7/.test(markdown), `Obsolete rules: ${page.id}`)
  assert(marked.parse(markdown).includes('<'), `Article cannot render: ${page.id}`)
  for (const [, target] of markdown.matchAll(/\]\(\/wiki\/([a-z0-9-]+)\)/g)) {
    assert(WIKI_PAGE_BY_ID.has(target), `Broken Wiki link in ${page.id}: ${target}`)
  }
}

assert((await WIKI_PAGE_BY_ID.get('build-archetypes').load()).default.includes('物品协同方向'))
assert((await WIKI_PAGE_BY_ID.get('02-dungeon').load()).default.includes('普通地面随机格不会生成防具'))

for (const page of CATALOG_PAGES) {
  const content = catalogContent(page.id)
  assert(content.includes('wiki-card'), `Empty Wiki catalog: ${page.id}`)
  assert.equal((content.match(/class="wiki-card /g) || []).length, (content.match(/class="wiki-card-media"/g) || []).length, `Missing image slot: ${page.id}`)
}
assert(catalogContent('weapons').includes('weapon-rust-sword-v2-small.png'))
assert(catalogContent('relics').includes('relic-empty-v1-small.png'))
assert(catalogContent('items').includes('item-health-potion-v1-small.png'))
assert(catalogContent('enemies').includes('wiki-media-placeholder'))

// Verify both the prose table and the live cards project every runtime value.
const enemyHtml = catalogContent('enemies')
for (const enemy of [...catalog.enemies, catalog.boss]) {
  const row = articles.get('07-enemies').split('\n').find(line => line.startsWith(`| ${enemy.name} |`))
  assert(row, `Missing enemy row: ${enemy.id}`)
  assert(row.includes(`| ${enemy.hp * ENEMY_HP_MULTIPLIER} | ${enemy.attack} | ${enemy.range} | ${enemy.speed} | ${enemy.initialActionDelay} |`), `Enemy stats drift: ${enemy.id}`)
  assert(row.includes(enemyDistribution(enemy)), `Enemy distribution drift: ${enemy.id}`)
  const card = enemyHtml.match(/<article\b[\s\S]*?<\/article>/g).find(html => html.includes(`<h2>${enemy.name}</h2>`))
  assert(card?.includes(`<dd>${enemy.hp * ENEMY_HP_MULTIPLIER}</dd>`), `Enemy card stats drift: ${enemy.id}`)
}
const itemsArticle = articles.get('05-items')
assert(articles.get('06-progression').includes(`候选共${SHOP_ITEMS.length}种`))
for (const item of ACTIVE_ITEMS) {
  const row = itemsArticle.split('\n').find(line => line.startsWith(`| ${item.name} |`))
  assert(row, `Missing active item row: ${item.id}`)
  for (const url of Object.values(itemSpriteSources(item) || {})) assert(existsSync(fileURLToPath(url)), `Missing sprite file: ${item.id}`)
  assert(itemSpriteSources(item)?.small && itemSpriteSources(item)?.medium, `Missing sprite sizes: ${item.id}`)
  if (item.type === 'weapon') assert(row.includes(`| ${item.attack} | ${item.range} | ${item.energyCost} |`), `Weapon stats drift: ${item.id}`)
}
assert(!ALL_ITEM_DEFS.some(item => item.type === 'energy'))
assert(itemsArticle.includes('球消耗'))
assert(articles.get('03-turn-and-combat').includes('32个球'))
assert(articles.get('06-progression').includes('万能球+1'))
for (const item of ALL_ITEM_DEFS.filter(item => item.disabled)) {
  const html = catalogContent(item.type === 'relic' ? 'relics' : 'items')
  assert(!html.includes(`<h2>${item.name}</h2>`), `Disabled item in live catalog: ${item.id}`)
  assert(!itemsArticle.includes(`| ${item.name} |`), `Disabled item in current table: ${item.id}`)
}
assert(!catalogContent('growth').includes('物品压缩'))
assert.equal(catalogContent('growth').match(/<article\b/g).length, 5)
assert(!catalogContent('relics').includes('<h2>回气图腾</h2>'))
for (const project of createEnemyShadowProjects({ includeBoss: true })) for (const part of project.parts) {
  if (part.visual.type !== 'texture') continue
  assert(existsSync(new URL(`../public${part.visual.texture}`, import.meta.url)), `Missing enemy texture: ${project.enemyId}/${part.id}`)
}

console.log(`wiki-check passed: ${ARTICLE_PAGES.length} articles, ${CATALOG_PAGES.length} live catalogs, runtime stats, active pools, sprite files and valid links`)
