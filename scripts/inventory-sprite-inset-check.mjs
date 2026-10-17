import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import {
  BAG_CELL_BORDER,
  INVENTORY_SPRITE_INSET,
  inventorySpriteStyle,
} from '../src/ui/inventory-sprite-layout.js'

const total = (BAG_CELL_BORDER + INVENTORY_SPRITE_INSET) * 2
assert.equal(total, 6, 'artwork viewport must clear the 1px cell border plus 2px of room')

// Quarter turns swap the axes so the box keeps the same clearance sideways.
const upright = inventorySpriteStyle(0)
assert.equal(upright.width, 'calc(100% - 6px)')
assert.equal(upright.height, 'calc(100% - 6px)')
for (let turns = 0; turns < 4; turns++) {
  const style = inventorySpriteStyle(turns)
  const odd = turns % 2 === 1
  assert.equal(style.width, odd ? 'calc(100cqh - 6px)' : 'calc(100% - 6px)')
  assert.equal(style.height, odd ? 'calc(100cqw - 6px)' : 'calc(100% - 6px)')
  assert(style.transform.includes(`rotate(${turns * 90}deg)`), `rotation ${turns}`)
}
// Negative and overflowing rotations normalize into the same four boxes.
for (const [rotation, expected] of [[-1, 3], [4, 0], [9, 1]]) {
  assert.equal(inventorySpriteStyle(rotation).width, inventorySpriteStyle(expected).width, `rotation ${rotation}`)
}

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8')
const css = read('../src/styles.css')
assert(/\.bag-sprite\s*\{[^}]*width: calc\(100% - 6px\); height: calc\(100% - 6px\)/.test(css))
assert(/\.bag-cell\s*\{[^}]*border: 1px solid/.test(css), 'cell border width assumption')

// Every item panel reuses the backpack crop instead of the whole transparent
// PNG, so one item reads at the same weight everywhere.
const sprite = read('../src/ui/InventorySprite.vue')
assert(sprite.includes(':class="spriteClass"'), 'sprite class must be overridable')
assert(sprite.includes(':data-bag-item="itemIndex ?? undefined"'), 'only backpack sprites may expose a cell index')
assert(sprite.includes("spriteClass: { type: String, default: 'bag-sprite' }"))
for (const source of [read('../src/ui/VueHud.vue'), read('../src/ui/WikiItems.vue')]) {
  assert(!/<img[^>]*class="detail-sprite"/.test(source), 'detail panels must not fall back to a plain img')
  assert(source.includes('sprite-class="detail-sprite"'))
}
assert(read('../src/ui/VueHud.vue').includes('sprite-class="detail-upgrade-sprite"'))
assert(read('../src/ui/WikiItems.vue').includes('sprite-class="wiki-recipe-sprite"'))
// object-fit on an <svg> root would override the tight viewBox crop.
assert(!/\.detail-sprite\s*\{[^}]*object-fit/.test(css))
assert(/\.detail-upgrade-icon\s*\{[^}]*--detail-upgrade-inset: 2px/.test(css))
assert(/\.detail-upgrade-sprite\s*\{[^}]*calc\(100% - 2 \* var\(--detail-upgrade-inset\)\)/.test(css))
assert(/\.wiki-item-detail \.detail-icon\s*\{[^}]*padding: 2px/.test(read('../src/wiki.css')))

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { default: Sprite } = await server.ssrLoadModule('/src/ui/InventorySprite.vue')
  const bounds = { small: [128, 128, 10, 4, 100, 120], medium: [256, 256, 20, 8, 200, 240] }
  const sources = { bounds, small: 'small.png', medium: 'medium.png' }
  const panel = await renderToString(createSSRApp(Sprite, { sources, spriteClass: 'detail-sprite' }))
  assert(panel.includes('class="detail-sprite"'), panel)
  assert(/viewbox="10 4 100 120"/.test(panel), panel)
  assert(/preserveaspectratio="xMidYMid meet"/.test(panel), panel)
  assert(!panel.includes('data-bag-item'), panel)
  const cell = await renderToString(createSSRApp(Sprite, { sources, itemIndex: 7 }))
  assert(cell.includes('data-bag-item="7"') && cell.includes('class="bag-sprite"'), cell)
} finally { await server.close() }

console.log('inventory-sprite-inset-check passed: artwork keeps its aspect ratio, stays ' + INVENTORY_SPRITE_INSET + 'px clear of the ' + BAG_CELL_BORDER + 'px cell border, and the backpack, detail panel, upgrade routes and wiki all share one tight crop')