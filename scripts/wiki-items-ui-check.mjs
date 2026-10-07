import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { readFileSync } from 'node:fs'
import { ACTIVE_ITEMS } from '../src/ui/wiki-data.js'
import { detailForItem } from '../src/game/data/item-details.js'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { default: Page } = await server.ssrLoadModule('/src/ui/WikiItems.vue')
  const { default: Cost } = await server.ssrLoadModule('/src/ui/StaminaCost.vue')
  const html = await renderToString(createSSRApp(Page))
  assert(html.includes('wiki-inventory-viewport'))
  assert.equal((html.match(/class="bag-item /g) || []).length, ACTIVE_ITEMS.filter(item => item.type !== 'money-pouch').length)
  assert.equal((html.match(/data-category=/g) || []).length, 6)
  assert(!html.includes('money-pouch-count'))
  assert(html.includes('--bag-columns:8'))
  assert(html.includes('weapon-rust-sword-v2-small.png'))
  assert(html.includes('pet-mountain-hound-v1-small.png'))
  assert(!html.includes('\ufffd'))
  for (const item of ACTIVE_ITEMS) {
    const detail = detailForItem(item)
    assert.equal(detail.title, item.name)
    assert.equal(detail.description, item.type === 'pet' && item.description === '无特殊效果。' ? '' : item.description || '')
    if (item.type === 'weapon') {
      assert.deepEqual(detail.statLines, [`⚔ ${item.attack}`, `🏹 ${item.range}`])
      assert.equal(detail.energyCost, item.energyCost)
      assert.equal(detail.energyAttribute, item.attribute)
    }
    if (item.type === 'pet') {
      assert.equal(detail.energyCost, item.ballCost)
      assert.equal(detail.energyAttribute, 'wild')
      assert.equal(detail.effectLines.length, 0)
    }
  }
  for (const attribute of ['scorch', 'wither', 'drown', 'wild']) {
    const cost = await renderToString(createSSRApp(Cost, { cost: 3, attribute }))
    assert(new RegExp(`class="(?=[^"]*stamina-ball-icon)(?=[^"]*${attribute})[^"]*"`).test(cost), cost)
    assert(cost.includes('>3</span>'))
  }
  const css = readFileSync(new URL('../src/wiki.css', import.meta.url), 'utf8')
  assert(/body\.wiki-items-page\s*\{[^}]*overflow: hidden/.test(css))
  assert(/\.wiki-inventory-viewport\s*\{[^}]*height: calc\(var\(--wiki-cell\) \* 8 \+ 14px\)[^}]*overflow-y: auto/.test(css))
  assert(/\.wiki-item-stage \.wiki-item-detail\s*\{[^}]*position: absolute/.test(css))
  const source = readFileSync(new URL('../src/ui/WikiItems.vue', import.meta.url), 'utf8')
  assert(!source.includes('detail-badges') && !source.includes('万能球可替代') && !source.includes(' · 占 '))
  console.log('wiki-items-ui-check passed: shared backpack renders every active item, current details, fixed shell, eight visible rows and absolute detail overlay')
} finally { await server.close() }
