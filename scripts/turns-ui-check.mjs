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
  let html = await render()
  assert(!endButton(html)); assert(html.includes('6/6'))
  assert(html.includes('\u63a2\u7d22'))
  const target = enemy(run, { attack: 2, actionDelay: 0 })
  run._synchronizeBattle(); select(run, potion)
  html = await render()
  assert(endButton(html)); assert(!endButton(html).includes('disabled'))
  assert(html.includes('\u73a9\u5bb6\u56de\u5408 1'))
  run.endPlayerTurn(); html = await render()
  assert(endButton(html).includes('disabled')); assert(useButton(html).includes('disabled'))
  assert(html.includes('\u654c\u4eba\u56de\u5408'))
  settleAnimations(run); html = await render()
  assert(!endButton(html).includes('disabled')); assert(html.includes('\u73a9\u5bb6\u56de\u5408 2'))
  run._damageEnemy(target, 500); run._endTurn(); settleAnimations(run)
  html = await render(); assert(!endButton(html)); assert(!html.includes('\ufffd'))
  console.log('turns-ui-check passed: exploration, player stage, enemy input lock, refill and decoded labels')
} finally { await server.close() }
