import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { fixture, add, enemy, select, settleAnimations } from './item-test-helpers.mjs'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { default: Hud } = await server.ssrLoadModule('/src/ui/VueHud.vue')
  const run = fixture(), weapon = add(run, 'rust-sword'), potion = add(run, 'health-potion')
  const render = () => renderToString(createSSRApp(Hud, { run }))
  const endButton = html => html.match(/<button\b[^>]*data-action="end-turn"[^>]*>/)?.[0]
  const ballButtons = html => html.match(/<button\b[^>]*class="[^"]*stamina-ball[^>]*>/g) || []
  let html = await render()
  assert(!endButton(html)); assert.equal(ballButtons(html).length, 0)
  assert(!html.includes('翻出敌人后抽球'))
  run.showItemDetail(weapon)
  html = await render()
  assert(/class="(?=[^"]*stamina-ball-icon)(?=[^"]*scorch)[^"]*"/.test(html))
  assert(!html.includes('万能球可替代') && !html.includes('进入战斗后抽球') && !html.includes('💪'))
  const pet = add(run, 'mountain-hound')
  run.showItemDetail(pet)
  html = await render()
  assert(/class="(?=[^"]*stamina-ball-icon)(?=[^"]*wild)[^"]*"/.test(html))
  assert(!html.includes('占2格') && !html.includes('宠物不区分球属性'))
  assert.equal(run.detailPanel.description, '')
  assert(!html.includes('vital-energy-fill'))
  const target = enemy(run)
  run._synchronizeBattle(); select(run, weapon)
  html = await render()
  assert.equal(ballButtons(html).length, 6)
  assert(!html.includes('stamina-count'))
  const renderedBalls = html.match(/<button\b[^>]*class="[^"]*stamina-ball[^>]*>[\s\S]*?<\/button>/g) || []
  assert(renderedBalls.every(button => !button.replace(/<[^>]+>/g, '').trim()))
  assert(html.includes('--ball-slots:8'))
  assert(html.includes('原地攻击')); assert(html.includes('球池'))
  assert(/class="(?=[^"]*stamina-ball-icon)(?=[^"]*scorch)[^"]*"/.test(html))
  assert(!endButton(html).includes('disabled'))
  const id = run.staminaDeck.hand[0].id
  assert(run.toggleStaminaBall(id)); html = await render()
  assert(ballButtons(html).some(button => button.includes('aria-pressed="true"')))
  run.staminaDeck.discardHand()
  html = await render()
  assert(html.includes('无可用球')); assert(!endButton(html).includes('disabled'))
  select(run, potion); html = await render()
  assert(html.match(/<button\b[^>]*data-action="use"[^>]*>/)?.[0].includes('disabled'))
  assert(run.endPlayerTurn()); html = await render()
  assert(endButton(html).includes('disabled')); assert.equal(ballButtons(html).length, 0)
  settleAnimations(run); html = await render()
  assert.equal(ballButtons(html).length, 6)
  run._damageEnemy(target, 500); run._endTurn(); settleAnimations(run)
  html = await render(); assert(!endButton(html)); assert.equal(ballButtons(html).length, 0)
  assert(!html.includes('\ufffd'))
  console.log('stamina-ui-check passed: colored balls, selected payment, manual empty turn, pet/enemy lock, refill, decoded labels')
} finally { await server.close() }
