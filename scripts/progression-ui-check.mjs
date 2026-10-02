import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { fixture, add } from './item-test-helpers.mjs'
import { makeItemById } from '../src/game/data/content.js'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { default: Hud } = await server.ssrLoadModule('/src/ui/VueHud.vue')
  const run = fixture(), weapon = add(run, 'rust-sword')
  run.player.experience = run.player.experienceToNext
  run.phase = 'level-up'
  run.levelUp = { choices: ['relic', 'weapon-upgrade', 'item-compression'] }
  const render = () => renderToString(createSSRApp(Hud, { run }))
  const upgradeVisible = markup => markup.match(/class="([^"]*relic-choice[^"]*level-up[^"]*)"/)[1].split(/\s+/).includes('show')
  let html = await render()
  assert.equal((html.match(/data-level-up-choice=/g) || []).length, 3)
  assert.match(html, /disabled[^>]*data-level-up-choice="item-compression"|data-level-up-choice="item-compression"[^>]*disabled/)
  assert(html.includes('\u9009\u62e9\u5347\u7ea7\u5956\u52b1'))
  assert(!html.includes('\u5929\u8d4b'))
  assert(upgradeVisible(html))
  const overflow = makeItemById('health-potion'), offered = JSON.stringify(run.levelUp)
  run.stageInventoryItem(overflow)
  html = await render()
  assert(html.includes('inventory-staging'))
  assert(!upgradeVisible(html), 'staging has exclusive UI priority over the upgrade panel')
  assert.equal(JSON.stringify(run.levelUp), offered)
  assert(run.discardInventoryItem(overflow.uid))
  html = await render()
  assert(!html.includes('inventory-staging'))
  assert(upgradeVisible(html), 'upgrade panel returns after staging clears')
  assert.equal(JSON.stringify(run.levelUp), offered)
  assert(run.chooseLevelUpOption('relic'))
  html = await render()
  assert.equal((html.match(/data-level-up-relic=/g) || []).length, 3)
  assert(html.includes('\u8fd4\u56de\u5347\u7ea7\u9009\u9879'))
  assert(run.backToLevelUpChoices()); assert(run.chooseLevelUpOption('weapon-upgrade'))
  html = await render()
  assert(html.includes(`data-level-up-weapon="${weapon.uid}"`))
  assert(html.includes(`${weapon.attack} \u2192 ${weapon.attack + 1}`))
  assert(html.includes('\u80cc\u5305\u683c\u4f4d'))
  assert(!html.includes('\ufffd'))
  while (run.backpack.add(makeItemById('health-potion'))) { /* Fill every cell. */ }
  run.phase = 'reward'
  run.roomReward = { roomId: run.currentRoom.id, choices: [{ kind: 'item', itemId: 'rust-sword' }, { kind: 'relic', relicId: 'r-loot-pouch' }] }
  html = await render()
  const rewardButtons = html.match(/<button\b[^>]*data-room-reward="[01]"[^>]*>/g) || []
  assert.equal(rewardButtons.length, 2)
  for (const button of rewardButtons) assert(!/\bdisabled\b/.test(button), 'full backpack must not disable room item or relic rewards')
  console.log('progression-ui-check passed: staging priority, three cards, disabled placeholder, nested relic and weapon screens, decoded Chinese')
} finally { await server.close() }
