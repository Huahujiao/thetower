import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { fixture, add, enemy, select, settleAnimations } from './item-test-helpers.mjs'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { default: Hud } = await server.ssrLoadModule('/src/ui/VueHud.vue')
  const run = fixture(), potion = add(run, 'health-potion')
  const render = () => renderToString(createSSRApp(Hud, { run }))
  const endButton = html => html.match(/<button\b[^>]*data-action="end-turn"[^>]*>/)?.[0]
  const useButton = html => html.match(/<button\b[^>]*data-action="use"[^>]*>/)?.[0]
  const energyText = html => html.match(/<div\b[^>]*class="vital-energy"[^>]*>[\s\S]*?<strong>([^<]*)<\/strong>/)?.[1].trim()
  let html = await render()
  assert(!endButton(html)); assert(html.includes('6/6'))
  assert.equal(energyText(html), '6/6')
  const target = enemy(run, { attack: 2, actionDelay: 0 })
  run._synchronizeBattle(); select(run, potion)
  html = await render()
  assert(endButton(html)); assert(!endButton(html).includes('disabled'))
  assert.equal(energyText(html), '6/6')
  run.endPlayerTurn(); html = await render()
  assert(endButton(html).includes('disabled')); assert(useButton(html).includes('disabled'))
  assert(html.includes('\u654c\u4eba\u56de\u5408'))
  settleAnimations(run); html = await render()
  assert(!endButton(html).includes('disabled')); assert.equal(energyText(html), '6/6')
  const food = add(run, 'food-3'); run.player.energy = 0
  assert(run.selectInventory(run.backpack.originIndex(run.backpack.placementOf(food.uid))))
  html = await render()
  assert(!useButton(html).includes('disabled'), 'food button must work at zero stamina')
  assert(!endButton(html).includes('disabled'))
  assert(run.useSelected()); assert.equal(run.player.energy, 3); assert.equal(run.globalTurn, 1)
  run._damageEnemy(target, 500); run._endTurn(); settleAnimations(run)
  html = await render(); assert(!endButton(html)); assert(!html.includes('\ufffd'))
  console.log('turns-ui-check passed: exploration, player stage, enemy input lock, zero-stamina food, refill and decoded labels')
} finally { await server.close() }
