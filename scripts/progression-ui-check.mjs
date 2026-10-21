import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { fixture, add, enemy, setBalls, select } from './item-test-helpers.mjs'
import { makeItemById } from '../src/game/data/content.js'
const server = await createServer({ configFile: false, plugins: [vue()], server: { middlewareMode: true, hmr: false, ws: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
try {
  const { default: Hud } = await server.ssrLoadModule('/src/ui/VueHud.vue')
  const run = fixture(), weapon = add(run, 'rust-sword')
  run.player.experience = run.player.experienceToNext; run.phase = 'level-up'
  run.levelUp = { choices: ['wild-fire', 'purify', 'convert-scorch', 'enchant-sharp'], ballOffers: {} }
  const render = () => renderToString(createSSRApp(Hud, { run }))
  const upgradeVisible = html => html.match(/class="([^"]*relic-choice[^"]*level-up[^"]*)"/)[1].split(/\s+/).includes('show')
  let html = await render()
  assert.equal((html.match(/data-level-up-choice=/g) || []).length, 4)
  assert(html.includes('升级奖励 · 四选一')); assert(upgradeVisible(html))
  assert(!html.includes('data-level-up-relic')); assert(!html.includes('data-level-up-weapon'))
  const overflow = makeItemById('health-potion'), original = JSON.stringify(run.levelUp)
  run.stageInventoryItem(overflow); html = await render()
  assert(!upgradeVisible(html)); assert.equal(JSON.stringify(run.levelUp), original)
  run.discardInventoryItem(overflow.uid); assert(upgradeVisible(await render()))
  assert(run.chooseLevelUpOption('enchant-sharp')); html = await render()
  assert.equal((html.match(/data-level-up-fire=/g) || []).length, 5)
  assert(html.includes('class="relic-choice-title">锋利</div>')); assert(html.includes('>跳过</button>'))
  const candidates = run.levelUpSpiritFires()
  candidates[0].enchantment = 'bulwark'
  for (const ball of candidates.slice(1)) delete ball.enchantment
  html = await render()
  const targetCards = html.match(/<button\b[^>]*data-level-up-fire="[^"]*"[^>]*>[\s\S]*?<\/button>/g) || []
  const visibleLabel = card => card.replace(/<svg\b[\s\S]*?<\/svg>/g, '').replace(/<[^>]*>/g, '').trim()
  assert.equal(targetCards.length, 5)
  assert.equal(visibleLabel(targetCards[0]), '铁壁', 'Only the existing enchantment name labels a target')
  assert(targetCards.slice(1).every(card => visibleLabel(card) === ''), 'Unenchanted targets have no placeholder text')
  assert(targetCards.every(card => !/编号|尚未附魔|未附魔|获得2点护甲/.test(card)))
  assert(targetCards.every(card => card.includes('aria-label="')), 'Flame colors remain available to screen readers')
  assert(!html.includes('随机展示5颗')); assert(!html.includes('替换已有附魔'))
  const ids = candidates.map(ball => ball.id)
  run.backToLevelUpChoices(); run.chooseLevelUpOption('enchant-sharp')
  assert.deepEqual(run.levelUpSpiritFires().map(ball => ball.id), ids)
  assert(run.chooseLevelUpSpiritFire(ids[0])); assert.equal(run.player.level, 2)
  enemy(run); run._synchronizeBattle(); setBalls(run, 6, weapon.attribute)
  const ball = run.staminaDeck.hand[0]; ball.enchantment = 'rekindle'; ball.rekindleReturns = 2
  select(run, weapon); html = await render()
  const buttons = html.match(/<button\b[^>]*class="[^"]*stamina-ball[^>]*>/g) || []
  assert.equal(buttons.length, 6)
  assert(buttons.every(button => button.includes('aria-disabled="true"') && !/\sdisabled(?:=|[ >])/.test(button)), 'Weapon payment remains locked while hold details stay available')
  assert(html.includes('当前返还概率：30%'))
  assert(run.showSpiritFireDetail(ball.id)); assert(run.detailPanel.description.includes('30%'))
  while (run.backpack.add(makeItemById('health-potion'))) { /* Keep room reward overflow coverage. */ }
  run.phase = 'reward'; run.roomReward = { roomId: run.currentRoom.id, choices: [{ kind: 'item', itemId: 'rust-sword' }, { kind: 'relic', relicId: 'r-loot-pouch' }] }
  html = await render()
  const rewards = html.match(/<button\b[^>]*data-room-reward="[01]"[^>]*>/g) || []
  assert.equal(rewards.length, 2); assert(rewards.every(button => !/\bdisabled\b/.test(button)))

  // Exercise the actual pointer handlers with a controlled clock, without a browser.
  const source = await readFile(new URL('../src/ui/StaminaHand.vue', import.meta.url), 'utf8')
  const code = source.slice(source.indexOf("const emit = defineEmits"), source.indexOf('const timers ='))
  const callbacks = new Map(), selected = [], shown = []; let now = 0, serial = 0, closed = 0
  const context = {
    props: { enabled: true, run: { showSpiritFireDetail(id) { shown.push(id); return true }, closeDetail() { closed++ } } },
    defineEmits: () => (_event, id) => selected.push(id), DETAIL_HOLD_MS: 150,
    Date: { now: () => now }, Math,
    setTimeout(callback) { const id = ++serial; callbacks.set(id, callback); return id },
    clearTimeout(id) { callbacks.delete(id) },
  }
  vm.createContext(context); vm.runInContext(code, context)
  const event = { isPrimary: true, pointerType: 'touch', clientX: 10, clientY: 10, currentTarget: { setPointerCapture() {} }, pointerId: 1 }
  context.startFireHold({ id: 7 }, event); context.endFireHold(); context.selectFire(7)
  assert.deepEqual(selected, [7]); assert.equal(callbacks.size, 0, 'A short tap selects once')
  context.startFireHold({ id: 8 }, event); [...callbacks.values()][0](); context.endFireHold(); context.selectFire(8)
  assert.deepEqual(shown, [8]); assert.equal(closed, 1); assert.deepEqual(selected, [7], 'A long press cannot also select')
  now = 300; context.props.enabled = false
  context.startFireHold({ id: 9 }, event); [...callbacks.values()][0](); context.endFireHold(); context.selectFire(9)
  assert.deepEqual(shown, [8, 9]); assert.deepEqual(selected, [7], 'Weapon-locked flames can still be inspected')
  now = 600; context.props.enabled = true
  context.startFireHold({ id: 10 }, event); context.moveFireHold({ clientX: 40, clientY: 10 }); context.selectFire(10)
  assert.equal(callbacks.size, 0); assert.deepEqual(selected, [7], 'Dragging cancels hold and accidental selection')
  console.log('Progression UI passed: four offers, five target flames with only existing enchantment names, skip/back, staging priority, long press details and click/weapon/drag isolation.')
} finally { await server.close() }
