<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { getItemDefinition } from '../game/data/content.js'
import { getRelicDefinition } from '../game/data/relics.js'
import { INVENTORY_COLUMNS, INVENTORY_ROWS } from '../game/run.js'
import { GameScene } from '../render/scene.js'
import './whiteline.css'

const props = defineProps({ run: { type: Object, required: true } })
const run = props.run
const revision = ref(0)
const detailRevision = ref(0)
const panel = ref(null)
const merchantTab = ref('stock')
const craftOpen = ref(false)
const helpOpen = ref(false)
const copyLabel = ref('COPY LOG')
const reveal = ref(false)
const sceneContainer = ref(null)
const scene = ref(null)
const hold = shallowRef(null)
const detailPanelVisible = ref(false)
const LONG_PRESS_MS = 300
let ignoreClicksUntil = 0
const subscriptions = []

function runView() {
  return new Proxy(run, {
    get(target, property) {
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

const state = computed(() => {
  revision.value
  return runView()
})
const detailPanel = computed(() => {
  detailRevision.value
  return run.detailPanel
})
const room = computed(() => state.value.currentRoom)
const inventoryCells = computed(() => Array.from({ length: INVENTORY_COLUMNS * INVENTORY_ROWS }, (_, index) => {
  const placement = state.value.backpack.placementForCellIndex(index)
  const action = run.previewInventoryCellAction(index)
  const origin = placement ? state.value.backpack.originIndex(placement) : null
  return { index, placement, action, origin, selected: origin === state.value.selectedInventoryIndex }
}))
const selectedItem = computed(() => state.value.selectedItem)
const actionsAvailable = computed(() => state.value.phase === 'explore' && !state.value.gameOver && !state.value.initialRelicChoices.length && !state.value.merchantEntering && !state.value.roomEntering)
const craftAvailable = computed(() => !state.value.gameOver && !state.value.initialRelicChoices.length && ['explore', 'merchant'].includes(state.value.phase) && !state.value.itemTargeting && !state.value.merchantEntering && !state.value.roomEntering)
const selectedUsable = computed(() => actionsAvailable.value && ['potion', 'armor', 'energy', 'buff', 'cleanse', 'teleport'].includes(selectedItem.value?.type))
const selectedRotatable = computed(() => {
  const item = selectedItem.value
  if (!item || !craftAvailable.value) return false
  const placement = state.value.backpack.placementOf(item.uid)
  if (!placement) return false
  return JSON.stringify(state.value.backpack.shapeFor(item, placement.rotation)) !== JSON.stringify(state.value.backpack.shapeFor(item, placement.rotation + 1))
})
const initialRelics = computed(() => state.value.initialRelicChoices.map((id) => getRelicDefinition(id)).filter(Boolean))
const roomRewardOpen = computed(() => state.value.phase === 'reward' && !!state.value.roomReward && !state.value.roomEntering)
const levelUpOpen = computed(() => state.value.phase === 'level-up' && !!state.value.levelUp)
const levelUpChoices = computed(() => run.levelUpChoices())
const merchant = computed(() => state.value.merchantEntity)
const merchantOpen = computed(() => state.value.phase === 'merchant' && !!merchant.value && !state.value.merchantEntering)
const merchantTabs = computed(() => [merchant.value?.services?.includes('stock') ? 'stock' : null, merchant.value?.services?.includes('relic-choice') ? 'relics' : null].filter(Boolean))
const merchantOffers = computed(() => (merchant.value?.relicOfferResolved ? [] : (merchant.value?.relicChoices || []).map((id) => getRelicDefinition(id)).filter(Boolean)))
const craftRows = computed(() => { state.value; return run.availableRecipes() })
const talentGraph = computed(() => { state.value; return run.talentGraph() })
const statusEntries = computed(() => {
  const current = state.value
  const entries = []
  if (current.player.poisonedTurns > 0) entries.push({ id: 'poison', name: 'POISONED', glyph: 'P', badge: String(current.player.poisonedTurns), description: `POISONED: ${current.player.poisonedTurns} TURN(S) REMAINING.` })
  if (current.player.burningTurns > 0) entries.push({ id: 'burning', name: 'BURNING', glyph: 'B', badge: String(current.player.burningTurns), description: `BURNING: ${current.player.burningTurns} TURN(S) REMAINING.` })
  for (const [id, buff] of Object.entries(current.player.itemState?.buffs || {})) {
    if (id.startsWith('r-') || (id === 'spring' && !run.itemRules.has(id))) continue
    entries.push({ id: `buff-${id}`, name: 'ACTIVE BUFF', glyph: 'B', badge: buff.flat ? `+${buff.flat}` : buff.discount ? `-${buff.discount}` : '', description: 'A temporary consumable, combat, or talent effect is active.' })
  }
  return entries
})
const detailTitle = computed(() => detailPanel.value ? String(detailPanel.value.type || 'DETAIL').toUpperCase() : '')
const detailLines = computed(() => detailPanel.value ? [`TARGET TYPE: ${String(detailPanel.value.type || 'OBJECT').toUpperCase()}`, `DATA LINES: ${(detailPanel.value.lines || []).length}`, 'INTERACTION DETAIL AVAILABLE'] : [])
const detailDescription = computed(() => detailPanel.value ? 'The same gameplay detail is open in the debug skin.' : '')

function itemToken(item) { return String(item?.id || item?.type || 'ITEM').toUpperCase() }
function cellLabel(cell) { return cell.placement ? `CELL ${cell.index}: ${itemToken(cell.placement.item)}` : `CELL ${cell.index}: EMPTY` }
function selectInitialRelic(id) { run.chooseInitialRelic(id) }
function chooseRoomReward(index) { run.chooseRoomReward(index) }
function chooseLevelUp(id) { run.chooseLevelUpOption(id) }
function chooseMerchantRelic(id) { run.chooseMerchantRelic(id) }
function roomRewardDisabled(choice) {
  if (choice.kind === 'relic') return !run.canFitRelic(choice.relicId)
  if (choice.kind === 'item') return !run.backpack.canFit({ ...getItemDefinition(choice.itemId), uid: 'reward-preview' })
  return false
}
function roomRewardToken(choice) {
  if (choice.kind === 'relic') return `RELIC: ${choice.relicId}`
  if (choice.kind === 'item') return `ITEM: ${choice.itemId}`
  return `GOLD: ${choice.amount}`
}
function onInventoryCell(index) {
  if (Date.now() < ignoreClicksUntil) return
  if (run.itemTargeting) run.clearSelection()
  else run.clickInventoryCell(index)
}
function restartGame() {
  run.closeDetail(); run.clearSave(); run.reset()
  detailPanelVisible.value = false
  panel.value = null; craftOpen.value = false; helpOpen.value = false; merchantTab.value = 'stock'
}
function restartWithConfirm() { if (window.confirm('Restart the run and clear current progress?')) restartGame() }
function togglePanel(name) { panel.value = panel.value === name ? null : name }
async function copyLog() {
  const text = run.log.slice(0, 40).join('\n')
  if (!text) return
  let copied = false
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); copied = true } } catch { /* Clipboard access is optional. */ }
  copyLabel.value = copied ? 'COPIED' : 'COPY FAILED'
  window.setTimeout(() => { copyLabel.value = 'COPY LOG' }, 1600)
}
function updateReveal() {
  run.setDebugReveal(reveal.value)
  try { localStorage.setItem('v2_opt_reveal', reveal.value ? '1' : '0') } catch { /* Storage can be unavailable in private contexts. */ }
}
function touchPoint(event, identifier = null) {
  const points = [...(event.touches || []), ...(event.changedTouches || [])]
  return points.find((point) => identifier == null || point.identifier === identifier) || null
}
function cancelLongPress() {
  if (hold.value?.timer) window.clearTimeout(hold.value.timer)
  hold.value = null
}
function showItemDetail(item) {
  return run.showItemDetail(item)
}
function showStatusDetail(entry) {
  return run._showDetail({ position: 'top', title: entry.name, type: 'STATUS', icon: 'item', lines: entry.badge ? [entry.badge] : [], description: entry.description })
}
function detailActionFor(target, event = null) {
  if (!(target instanceof Element)) return null
  const candidates = []
  if (event?.composedPath) candidates.push(...event.composedPath())
  candidates.push(target)
  const find = (selector) => candidates.map((candidate) => candidate?.closest?.(selector)).find(Boolean)
  const cell = find('[data-inventory-cell]')
  if (cell) {
    const item = run.backpack.placementForCellIndex(Number(cell.dataset.inventoryCell))?.item
    return item ? () => showItemDetail(item) : null
  }
  const craft = find('[data-craft-item]')
  if (craft) return () => showItemDetail(getItemDefinition(craft.dataset.craftItem))
  const stock = find('[data-stock]')
  if (stock) {
    const entry = merchant.value?.stock?.[Number(stock.dataset.stock)]
    const definition = getItemDefinition(entry?.itemId)
    return definition ? () => showItemDetail({ ...definition, uid: `preview-${definition.id}` }) : null
  }
  const relic = find('[data-relic-detail]')
  if (relic) return () => run.showRelicDetail(relic.dataset.relicDetail)
  const board = find('[data-board-cell]')
  if (board) return () => run.showBoardDetail({ c: Number(board.dataset.c), r: Number(board.dataset.r) })
  return null
}
function startLongPress(openDetail, event) {
  const point = touchPoint(event)
  if (!openDetail || !point || event.touches?.length > 1) return
  cancelLongPress()
  const next = { identifier: point.identifier, x: point.clientX, y: point.clientY, opened: false, timer: null }
  next.timer = window.setTimeout(() => {
    if (hold.value !== next) return
    next.opened = Boolean(openDetail())
  }, LONG_PRESS_MS)
  hold.value = next
}
function onInventoryTouchStart(index, event) {
  const item = run.backpack.placementForCellIndex(index)?.item
  if (item) startLongPress(() => showItemDetail(item), event)
}
function onStatusTouchStart(entry, event) {
  startLongPress(() => showStatusDetail(entry), event)
}
function onTouchMove(event) {
  const current = hold.value
  const point = touchPoint(event, current?.identifier)
  if (!current || !point || current.opened) return
  if (Math.abs(point.clientX - current.x) + Math.abs(point.clientY - current.y) <= 18) return
  cancelLongPress()
}
function onTouchEnd(event) {
  const current = hold.value
  if (!current || !touchPoint(event, current.identifier)) return
  if (current.timer) window.clearTimeout(current.timer)
  hold.value = null
  if (current.opened) {
    run.closeDetail()
    detailPanelVisible.value = false
    ignoreClicksUntil = Date.now() + 250
  }
}
function onTouchCancel(event) {
  const current = hold.value
  if (current && touchPoint(event, current.identifier)) cancelLongPress()
}
function onAction(action) {
  if (Date.now() < ignoreClicksUntil) return
  if (action === 'craft-open' && craftAvailable.value) craftOpen.value = true
  if (action === 'craft-close') craftOpen.value = false
  if (action === 'help') { panel.value = null; helpOpen.value = true }
  if (action === 'close-help') helpOpen.value = false
  if (action === 'character') togglePanel('character')
  if (action === 'talents') togglePanel('talents')
  if (action === 'settings') togglePanel('settings')
  if (action === 'log') togglePanel('log')
  if (action === 'copy-log') void copyLog()
  if (action === 'use') run.useSelected()
  if (action === 'discard') run.discardSelected()
  if (action === 'rotate') run.rotateSelectedInventory()
  if (action === 'close-detail') { run.closeDetail(); detailPanelVisible.value = false }
  if (action === 'restart') restartGame()
  if (action === 'restart-settings') restartWithConfirm()
  if (action === 'close-merchant') run.closeMerchant()
  if (action === 'merchant-sell') run.sellSelectedMerchantItem()
  if (action === 'merchant-refresh') run.refreshMerchantInventory()
  if (action === 'skip-reward') run.skipRoomReward()
}
function onActionValue(action, value) {
  if (Date.now() < ignoreClicksUntil) return
  if (action === 'craft-result') run.craft(value)
  if (action === 'merchant-stock') run.buyMerchantItem(Number(value))
  if (action === 'merchant-relic') { if (state.value.player.gold >= (merchant.value?.relicOfferPrice || 0)) chooseMerchantRelic(value) }
  if (action === 'merchant-tab') merchantTab.value = value
  if (action === 'level-up') chooseLevelUp(value)
  if (action === 'room-reward') chooseRoomReward(Number(value))
  if (action === 'relic-choice') selectInitialRelic(value)
  if (action === 'inventory-cell') onInventoryCell(Number(value))
}
function onDetailTouchStart(event) {
  startLongPress(detailActionFor(event.currentTarget, event), event)
}

onMounted(() => {
  try { reveal.value = localStorage.getItem('v2_opt_reveal') === '1' } catch { /* Storage can be unavailable in private contexts. */ }
  subscriptions.push(run.on('change', () => { revision.value++ }))
  subscriptions.push(run.on('detail', () => {
    detailRevision.value++
    detailPanelVisible.value = Boolean(run.detailPanel)
  }))
  scene.value = new GameScene(run, sceneContainer.value, { skin: 'whiteline' })
  run.setDebugReveal(reveal.value)
})
onBeforeUnmount(() => {
  for (const unsubscribe of subscriptions) unsubscribe?.()
  if (hold.value?.timer) window.clearTimeout(hold.value.timer)
  scene.value?.dispose()
})
</script>

<template>
  <div class="wl-root">
    <header class="wl-header">
      <div class="wl-title">WHITE LINE DEBUG</div>
      <div class="wl-stats"><span>FLOOR {{ room?.floor || '' }}</span><span>HP {{ state.player.hp }}/{{ state.player.maxHp }}</span><span>ARMOR {{ state.player.armor }}</span><span>ENERGY {{ state.player.energy }}/{{ state.player.maxEnergy }}</span><span>GOLD {{ state.player.gold }}</span><span>TURN {{ state.turn }}</span></div>
      <nav class="wl-nav"><button data-action="craft-open" :disabled="!craftAvailable" @click="onAction('craft-open')">CRAFT</button><button data-action="talents" @click="onAction('talents')">TALENTS</button><button data-action="character" @click="onAction('character')">CHARACTER</button><button data-action="help" @click="onAction('help')">HELP</button><button data-action="settings" @click="onAction('settings')">SETTINGS</button><button data-action="log" @click="onAction('log')">LOG</button></nav>
    </header>
    <div class="wl-experience">EXPERIENCE {{ state.player.experience }}/{{ state.player.experienceToNext }}</div>
    <div id="app" ref="sceneContainer" aria-label="game board">
      <section v-if="statusEntries.length" class="wl-scene-status" aria-label="STATUS">
        <button v-for="entry in statusEntries" :key="entry.id" :aria-label="entry.name" @touchstart.stop.prevent="onStatusTouchStart(entry, $event)" @touchmove.stop="onTouchMove" @touchend.stop="onTouchEnd" @touchcancel.stop="onTouchCancel" @contextmenu.prevent><span>{{ entry.glyph }}</span><b v-if="entry.badge">{{ entry.badge }}</b></button>
      </section>
    </div>
    <div class="wl-bottom">
      <div class="wl-toolbar"><button data-action="discard" :hidden="!selectedItem" :disabled="!selectedItem" @click="onAction('discard')">DISCARD</button><span>ARMOR {{ state.player.armor }}</span><span>HP {{ state.player.hp }}/{{ state.player.maxHp }} | ENERGY {{ state.player.energy }}/{{ state.player.maxEnergy }}</span><button data-action="use" :hidden="!selectedUsable" :disabled="!selectedUsable" @click="onAction('use')">USE</button><button data-action="rotate" :disabled="!selectedRotatable" @click="onAction('rotate')">ROTATE</button></div>
      <section class="wl-inventory-panel"><div class="wl-inventory" :style="{ '--wl-cols': INVENTORY_COLUMNS, '--wl-rows': INVENTORY_ROWS }"><button v-for="cell in inventoryCells" :key="cell.index" class="wl-inventory-cell" :class="{ occupied: cell.placement, selected: cell.selected, valid: cell.action === 'move', blocked: cell.action === 'blocked' }" :data-inventory-cell="cell.index" :aria-label="cellLabel(cell)" @click="onActionValue('inventory-cell', cell.index)" @touchstart.stop="onInventoryTouchStart(cell.index, $event)" @touchmove.stop="onTouchMove($event)" @touchend.stop="onTouchEnd($event)" @touchcancel.stop="onTouchCancel($event)"><span v-if="cell.origin === cell.index">{{ itemToken(cell.placement.item) }}</span><small>{{ cell.index + 1 }}</small></button></div></section>
    </div>

    <section v-if="panel === 'character'" class="wl-overlay-panel"><header><b>CHARACTER</b><button data-action="character" @click="onAction('character')">CLOSE</button></header><p>LEVEL {{ state.player.level }}</p><p>EXPERIENCE {{ state.player.experience }}/{{ state.player.experienceToNext }}</p><p>HEALTH {{ state.player.hp }}/{{ state.player.maxHp }}</p><p>TALENTS {{ state.player.talents.length }}</p><p>BODY STRENGTH {{ state.player.talentRuntime?.bodyStrength || 0 }}</p></section>
    <section v-if="panel === 'talents'" class="wl-overlay-panel wl-scroll"><header><b>TALENT GRAPH</b><button data-action="talents" @click="onAction('talents')">CLOSE</button></header><p v-for="node in talentGraph" :key="node.id" :class="`talent-${node.state}`">{{ node.id.toUpperCase() }} / {{ node.state.toUpperCase() }}</p></section>
    <section v-if="panel === 'settings'" class="wl-overlay-panel"><header><b>SETTINGS</b><button data-action="settings" @click="onAction('settings')">CLOSE</button></header><label><input v-model="reveal" type="checkbox" @change="updateReveal"> REVEAL DEBUG CONTENT</label><button data-action="restart-settings" @click="onAction('restart-settings')">RESTART RUN</button></section>
    <section v-if="panel === 'log'" class="wl-overlay-panel wl-scroll"><header><b>EVENT LOG</b><button data-action="log" @click="onAction('log')">CLOSE</button></header><button data-action="copy-log" @click="onAction('copy-log')">{{ copyLabel }}</button><p v-for="(_, index) in state.log.slice(0, 40)" :key="index">EVENT {{ index + 1 }}</p></section>
    <section v-if="helpOpen" class="wl-overlay-panel wl-help"><header><b>HELP</b><button data-action="close-help" @click="onAction('close-help')">CLOSE</button></header><p>CLICK A BOARD CELL TO MOVE, FLIP, ATTACK, OR INTERACT.</p><p>CLICK AN INVENTORY CELL TO SELECT OR MOVE AN ITEM.</p><p>HOLD AN ITEM OR BOARD TARGET TO INSPECT IT.</p><p>ALL ACTIONS USE THE SAME GAME MODEL AS THE MAIN SKIN.</p></section>

    <section v-show="detailPanelVisible" class="wl-detail"><header><b>{{ detailPanel ? detailTitle : 'DETAIL PANEL' }}</b><button data-action="close-detail" @click="onAction('close-detail')">CLOSE</button></header><p v-for="line in detailLines" :key="line">{{ line }}</p><p>{{ detailPanel ? detailDescription : 'LONG-PRESS AN ITEM TO INSPECT.' }}</p></section>
    <section v-if="initialRelics.length" class="wl-choice"><h2>CHOOSE AN INITIAL RELIC</h2><button v-for="relic in initialRelics" :key="relic.id" :data-relic-choice="relic.id" @click="onActionValue('relic-choice', relic.id)"><b>{{ relic.id.toUpperCase() }}</b><small>RELIC OPTION</small></button></section>
    <section v-if="roomRewardOpen" class="wl-choice"><h2>CHOOSE A ROOM REWARD</h2><button v-for="(choice, index) in state.roomReward.choices" :key="index" :data-room-reward="index" :data-disabled="roomRewardDisabled(choice) ? 'true' : 'false'" :disabled="roomRewardDisabled(choice)" @click="onActionValue('room-reward', index)"><b>{{ roomRewardToken(choice) }}</b><small>REWARD OPTION</small></button><button data-action="skip-reward" @click="onAction('skip-reward')">SKIP REWARD</button></section>
    <section v-if="levelUpOpen" class="wl-choice"><h2>CHOOSE GROWTH</h2><button v-for="choice in levelUpChoices" :key="choice.id" :data-level-up="choice.id" @click="onActionValue('level-up', choice.id)"><b>{{ choice.id.toUpperCase() }}</b><small>{{ choice.fixed ? 'FIXED GROWTH' : 'TALENT OPTION' }}</small></button></section>

    <section v-if="merchantOpen" class="wl-merchant"><header><b>MERCHANT</b><button data-action="close-merchant" @click="onAction('close-merchant')">LEAVE</button></header><div class="wl-tabs"><button v-for="tab in merchantTabs" :key="tab" :data-merchant-tab="tab" :class="{ active: merchantTab === tab }" @click="onActionValue('merchant-tab', tab)">{{ tab.toUpperCase() }}</button></div><div v-if="merchantTab === 'stock'" class="wl-merchant-grid"><button v-for="(entry, index) in merchant.stock" :key="`${entry.itemId}-${index}`" :data-stock="index" @click="onActionValue('merchant-stock', index)" @touchstart.stop="onDetailTouchStart($event)" @touchmove.stop="onTouchMove" @touchend.stop="onTouchEnd" @touchcancel.stop="onTouchCancel"><b>{{ entry.itemId.toUpperCase() }}</b><small>BUY {{ entry.price }}</small></button><button data-action="merchant-sell" :disabled="!selectedItem" @click="onAction('merchant-sell')">SELL SELECTED</button><button v-if="merchant.restockPrice > 0" data-action="merchant-refresh" :disabled="state.player.gold < merchant.restockPrice" @click="onAction('merchant-refresh')">REFRESH {{ merchant.restockPrice }}</button></div><div v-else class="wl-merchant-grid"><button v-for="relic in merchantOffers" :key="relic.id" :data-merchant-relic="relic.id" :data-disabled="state.player.gold < merchant.relicOfferPrice ? 'true' : 'false'" :disabled="state.player.gold < merchant.relicOfferPrice" @click="onActionValue('merchant-relic', relic.id)" @touchstart.stop="onDetailTouchStart($event)" @touchmove.stop="onTouchMove" @touchend.stop="onTouchEnd" @touchcancel.stop="onTouchCancel">{{ relic.id.toUpperCase() }} / BUY {{ merchant.relicOfferPrice }}</button><p v-if="!merchantOffers.length">NO RELIC OFFERS.</p></div></section>

    <section v-if="craftOpen" class="wl-overlay-panel wl-craft"><header><b>CRAFT</b><button data-action="craft-close" @click="onAction('craft-close')">CLOSE</button></header><p>CRAFTING USES THE SAME RECIPES AND TURN RULES.</p><div v-for="recipe in craftRows" :key="recipe.result" class="wl-craft-row"><button :data-craft-item="recipe.a" @touchstart.stop="onDetailTouchStart($event)" @touchmove.stop="onTouchMove" @touchend.stop="onTouchEnd" @touchcancel.stop="onTouchCancel">{{ recipe.a.toUpperCase() }}</button><span>+</span><button :data-craft-item="recipe.b" @touchstart.stop="onDetailTouchStart($event)" @touchmove.stop="onTouchMove" @touchend.stop="onTouchEnd" @touchcancel.stop="onTouchCancel">{{ recipe.b.toUpperCase() }}</button><span>=</span><button :data-craft-result="recipe.result" :disabled="!recipe.canFit" @click="onActionValue('craft-result', recipe.result)">{{ recipe.canFit ? 'CRAFT' : 'NO SPACE' }}</button></div><p v-if="!craftRows.length">NO AVAILABLE RECIPES.</p></section>
    <section v-if="state.gameOver" class="wl-choice"><h2>{{ state.win ? 'RUN COMPLETE' : 'RUN OVER' }}</h2><p>{{ state.win ? 'EXIT REACHED.' : 'PLAYER DEFEATED.' }}</p><button data-action="restart" @click="onAction('restart')">RESTART</button></section>
  </div>
</template>
