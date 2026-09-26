import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { ARTICLE_PAGES, CATALOG_PAGES, WIKI_PAGES, WIKI_PAGE_BY_ID, WIKI_SECTIONS } from '../src/ui/wiki-pages.js'
import { catalogContent } from '../src/ui/wiki-catalog.js'

assert.equal(ARTICLE_PAGES.length, 17)
assert.equal(CATALOG_PAGES.length, 6)
assert.equal(WIKI_PAGE_BY_ID.size, WIKI_PAGES.length)
const sectionIds = new Set(WIKI_SECTIONS.map((section) => section.id))

for (const page of WIKI_PAGES) {
  assert(sectionIds.has(page.section), `Unknown Wiki section: ${page.id}`)
  assert(page.title && page.summary, `Missing Wiki metadata: ${page.id}`)
}

for (const page of ARTICLE_PAGES) {
  const { default: markdown } = await page.load()
  assert(markdown.length > 100, `Empty Wiki article: ${page.id}`)
  assert(!markdown.includes('\uFFFD'), `Invalid Unicode in Wiki article: ${page.id}`)
  assert(!/\]\([^)]*\.md\)/.test(markdown), `Old Markdown link: ${page.id}`)
  for (const [, target] of markdown.matchAll(/\]\(\/wiki\/([a-z0-9-]+)\)/g)) {
    assert(WIKI_PAGE_BY_ID.has(target), `Broken Wiki link in ${page.id}: ${target}`)
  }
}

assert((await WIKI_PAGE_BY_ID.get('build-archetypes').load()).default.includes('物品协同方向'))
assert((await WIKI_PAGE_BY_ID.get('02-dungeon').load()).default.includes('普通地面随机格不会生成防具'))

for (const page of CATALOG_PAGES) {
  assert(catalogContent(page.id).includes('wiki-card'), `Empty Wiki catalog: ${page.id}`)
}

for (const directory of ['.', 'docs', 'art', 'art/generated']) {
  assert(!readdirSync(directory).some((name) => name.endsWith('.md')), `Markdown documents remain in ${directory}`)
}

console.log('wiki-check passed: 17 articles, 6 live catalogs, valid page links, no Markdown documents')
