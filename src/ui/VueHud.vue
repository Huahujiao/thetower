<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { merchantSellPrice } from '../game/data/merchants.js'
import { getItemDefinition } from '../game/data/content.js'
import { getRelicDefinition } from '../game/data/relics.js'
import { INVENTORY_COLUMNS, INVENTORY_ROWS } from '../game/run.js'
import { GameScene } from '../render/scene.js'
import { bagShapeLayout } from './bag-shape.js'
import { itemSpriteSources } from './item-sprites.js'
import InventorySprite from './InventorySprite.vue'

const props = defineProps({ run: { type: Object, required: true } })
const run = props.run

const LABELS = Object.freeze({
  floor: '\u697c\u5c42', health: '\u751f\u547d', armor: '\u62a4\u7532', energy: '\u4f53\u529b', gold: '\u91d1\u5e01',
  turn: '\u5168\u5c40\u56de\u5408', poison: '\u4e2d\u6bd2', burning: '\u71c3\u70e7', level: '\u7b49\u7ea7', experience: '\u7ecf\u9a8c',
  character: '\u89d2\u8272', characterGrowth: '\u89d2\u8272\u6210\u957f', maxHealth: '\u751f\u547d\u4e0a\u9650', talents: '\u5929\u8d4b',
  talentGraph: '\u5929\u8d4b\u7f51', fixedGrowth: '\u5f3a\u5316\u4f53\u683c', help: '\u5e2e\u52a9', basicGameplay: '\u57fa\u672c\u73a9\u6cd5',
  close: '\u5173\u95ed', craft: '\u5408\u6210', buildStatus: '\u6784\u7b51\u72b6\u6001', settings: '\u8bbe\u7f6e', camera: '\u89c6\u89d2', cameraAzimuth: '\u65cb\u8f6c\u89d2\u5ea6',
  cameraPitch: '\u4fef\u4ef0\u89d2\u5ea6', cameraPitchDecrease: '\u51cf\u5c0f\u4fef\u4ef0\u89d2\u5ea6', cameraPitchIncrease: '\u589e\u52a0\u4fef\u4ef0\u89d2\u5ea6',
  log: '\u65e5\u5fd7', copyLog: '\u590d\u5236\u65e5\u5fd7', copied: '\u5df2\u590d\u5236', copyFailed: '\u590d\u5236\u5931\u8d25',
  reveal: '\u8c03\u8bd5\uff1a\u663e\u793a\u724c\u5185\u5bb9', discard: '\u4e22\u5f03', rotate: '\u65cb\u8f6c', use: '\u4f7f\u7528',
  empty: '\u7a7a', relics: '\u5723\u9057\u7269', relicOverload: '\u5723\u9057\u7269\u8d85\u8f7d', initialRelic: '\u9009\u62e9\u521d\u59cb\u5723\u9057\u7269',
  leaveMerchant: '\u79bb\u5f00', sold: '\u5df2\u552e\u7f44', buy: '\u8d2d\u4e70', merchantRelicsTab: '\u5723\u9057\u7269',
  noRelicsAvailable: '\u6682\u65e0\u53ef\u83b7\u5f97\u7684\u5723\u9057\u7269', relicChoice: '\u9009\u62e9\u4e00\u4ef6\u5723\u9057\u7269',
  roomReward: '\u65b0\u623f\u95f4\u5956\u52b1', growthChoice: '\u9009\u62e9\u5929\u8d4b\u6216\u5f3a\u5316\u4f53\u683c', skipReward: '\u8df3\u8fc7',
  sellSelected: '\u51fa\u552e\u6240\u9009', refreshStock: '\u5237\u65b0\u8d27\u67b6', weaponClass: '\u7c7b\u522b', restart: '\u91cd\u65b0\u5f00\u59cb',
  restartConfirm: '\u786e\u5b9a\u8981\u91cd\u65b0\u5f00\u59cb\u5417\uff1f\u5f53\u524d\u8fdb\u5ea6\u5c06\u88ab\u6e05\u9664\u3002',
  win: '\u9003\u51fa\u5730\u7262', lose: '\u4f60\u5df2\u9668\u843d', winMessage: '\u4f60\u51fb\u8d25\u4e86\u76d1\u89c6\u8005\u3002', loseMessage: '\u751f\u547d\u5f52\u96f6\u3002\u53ef\u4ee5\u91cd\u65b0\u5f00\u59cb\u6311\u6218\u3002',
})
const DETAIL_ICONS = Object.freeze({ enemy: '\u2694', weapon: '\u2694', potion: '\u271a', armor: '\u26e8', energy: '\u26a1', buff: '\u2726', relic: '\u25c6', trap: '!', gold: '\u25cf', key: '\ud83d\udd11', merchant: '\u25c9', item: '\u25a0' })
const WEAPON_CLASS_LABELS = Object.freeze({ sword: '\u5251', axe: '\u65a7', dagger: '\u5315\u9996', polearm: '\u957f\u67c4', heavy: '\u91cd\u6b66\u5668', bow: '\u5f13' })
const TALENT_LINE_LABELS = Object.freeze({ flow: '\u6362\u52bf', guard: '\u5b88\u5fa1', harmony: '\u8c03\u548c', sword: '\u5251', axe: '\u65a7', dagger: '\u5315\u9996', polearm: '\u957f\u67c4', heavy: '\u91cd\u6b66\u5668', bow: '\u5f13', scorch: '\u707c\u70ed', wither: '\u67af\u840e', drown: '\u6c89\u6eba', survival: '\u751f\u5b58' })
const ATTRIBUTE_LABELS = Object.freeze({ scorch: '\u707c\u70ed', wither: '\u67af\u840e', drown: '\u6c89\u6eba' })
const EDGE_NAMES = ['top', 'right', 'bottom', 'left']
const HELP_SECTIONS = Object.freeze([
  { title: '\u884c\u52a8\u4e0e\u4f53\u529b', items: ['\u6bcf\u6b21\u79fb\u52a8\u3001\u7ffb\u724c\u3001\u62fe\u53d6\u548c\u666e\u901a\u4ea4\u4e92\u90fd\u4f1a\u63a8\u8fdb\u56de\u5408\u3002', '\u6b66\u5668\u653b\u51fb\u4f1a\u6d88\u8017\u4f53\u529b\uff0c\u4f7f\u7528\u7269\u54c1\u3001\u5408\u6210\u3001\u79fb\u52a8\u548c\u65cb\u8f6c\u4e5f\u53ef\u80fd\u63a8\u8fdb\u56de\u5408\u3002'] },
  { title: '\u80cc\u5305\u4e0e\u5408\u6210', items: ['\u80cc\u5305\u662f 8 \u5217 4 \u884c\uff0c\u7269\u54c1\u6309\u5f62\u72b6\u5360\u683c\u3002', '\u70b9\u51fb\u9009\u62e9\u7269\u54c1\uff0c\u518d\u70b9\u51fb\u7a7a\u683c\u53ef\u79fb\u52a8\uff1b\u957f\u6309\u53ef\u67e5\u770b\u8be6\u60c5\u3002', '\u5408\u6210\u9762\u677f\u53ea\u663e\u793a\u5f53\u524d\u80cc\u5305\u53ef\u5408\u6210\u7684\u914d\u65b9\u3002'] },
  { title: '\u5929\u8d4b\u4e0e\u5723\u9057\u7269', items: ['\u5347\u7ea7\u65f6\u9009\u62e9\u5929\u8d4b\u8def\u7ebf\u6216\u5f3a\u5316\u4f53\u683c\u3002', '\u5723\u9057\u7269\u653e\u5728\u80cc\u5305\u4e2d\u5373\u53ef\u751f\u6548\uff0c\u79bb\u5f00\u623f\u95f4\u4e0d\u4f1a\u91cd\u7f6e\u3002'] },
  { title: '\u6218\u6597\u4e0e\u63a2\u7d22', items: ['\u9009\u62e9\u6b66\u5668\u540e\u70b9\u51fb\u654c\u4eba\u53d1\u8d77\u653b\u51fb\uff0c\u8fdc\u5904\u76ee\u6807\u4f1a\u5148\u9884\u89c8\u8def\u5f84\u3002', '\u957f\u6309\u68cb\u76d8\u6216\u80cc\u5305\u7269\u54c1\u67e5\u770b\u8be6\u60c5\uff0c\u8fde\u7eed\u79fb\u52a8\u89c6\u89d2\u53ef\u4f7f\u7528\u62d6\u62fd\u548c\u6eda\u8f6e\u7f29\u653e\u3002'] },
])

const revision = ref(0)
const detailRevision = ref(0)
const uiRevision = ref(0)
const sceneContainer = ref(null)
const scene = shallowRef(null)
const topPanel = ref(null)
const craftOpen = ref(false)
const buildStatusOpen = ref(false)
const helpOpen = ref(false)
const merchantTab = ref('stock')
const copyLabel = ref(LABELS.copyLog)
const reveal = ref(typeof localStorage !== 'undefined' && localStorage.getItem('v2_opt_reveal') === '1')
const hold = ref(null)
let ignoreClicksUntil = 0
const subscriptions = []

const state = computed(() => {
  revision.value
  return run
})
const detailPanel = computed(() => {
  detailRevision.value
  return run.detailPanel
})
const cameraAngles = computed(() => {
  uiRevision.value
  return scene.value?.cameraAngles?.() || null
})
const selectedItem = computed(() => state.value.selectedItem)
const actionsAvailable = computed(() => {
  const current = state.value
  return current.phase === 'explore' && !current.gameOver && current.initialRelicChoices.length === 0 && !current.merchantEntering && !current.roomEntering
})
const craftAvailable = computed(() => {
  const current = state.value
  return !current.gameOver && current.initialRelicChoices.length === 0 && ['explore', 'merchant'].includes(current.phase) && !current.itemTargeting && !current.merchantEntering && !current.roomEntering
})
const selectedUsable = computed(() => {
  const item = selectedItem.value
  return actionsAvailable.value && !!item && ['potion', 'armor', 'energy', 'buff', 'cleanse', 'teleport'].includes(item.type)
})
const selectedRotatable = computed(() => {
  const current = state.value
  const item = selectedItem.value
  if (!item || current.itemTargeting || !craftAvailable.value) return false
  const placement = current.backpack.placementOf(item.uid)
  if (!placement) return false
  const shape = current.backpack.shapeFor(item, placement.rotation)
  const nextShape = current.backpack.shapeFor(item, placement.rotation + 1)
  return JSON.stringify(shape) !== JSON.stringify(nextShape)
})
const hints = computed(() => {
  const current = state.value
  const item = selectedItem.value?.type === 'weapon' ? selectedItem.value : null
  const lines = [...run.itemRules.pendingLines(item)]
  if (current.player.poisonedTurns > 0) lines.push(`${LABELS.poison} ${current.player.poisonedTurns}${LABELS.turn}`)
  if (current.player.burningTurns > 0) lines.push(`${LABELS.burning} ${current.player.burningTurns}${LABELS.turn}`)
  return lines.join(' · ')
})
const statusLines = computed(() => {
  state.value
  return run.itemRules.statusLines()
})
const experienceProgress = computed(() => {
  const player = state.value.player
  return player.experienceToNext > 0 ? Math.min(100, Math.max(0, player.experience / player.experienceToNext * 100)) : 0
})
const characterExperienceProgress = experienceProgress
const talentGraph = computed(() => {
  state.value
  return run.talentGraph()
})
const talentLines = computed(() => {
  const graph = talentGraph.value
  const names = new Map(graph.map((node) => [node.id, node.name]))
  return [...new Set(graph.map((node) => node.line))].map((line) => ({
    line,
    title: TALENT_LINE_LABELS[line] || line,
    nodes: graph.filter((node) => node.line === line).map((node) => ({
      ...node,
      prerequisites: node.prerequisites.length ? `\u524d\u7f6e\uff1a${node.prerequisites.map((id) => names.get(id) || id).join('\u3001')}` : '\u524d\u7f6e：\u65e0',
    })),
  }))
})
const backpackCells = computed(() => Array.from({ length: INVENTORY_COLUMNS * INVENTORY_ROWS }, (_, index) => {
  const current = state.value
  const placement = current.backpack.placementForCellIndex(index)
  return { index, placement, action: run.previewInventoryCellAction(index), selected: placement?.item?.uid === selectedItem.value?.uid, label: placement?.item?.name || LABELS.empty }
}))
const backpackItems = computed(() => {
  const current = state.value
  return current.backpack.placements.map((placement) => {
  const item = placement.item
  const shape = current.backpack.shapeFor(item, placement.rotation)
  const layout = bagShapeLayout(shape)
  const originIndex = current.backpack.originIndex(placement)
  const cells = layout.cells.map(({ x, y, edges }) => ({
    x,
    y,
    index: (placement.y + y) * INVENTORY_COLUMNS + placement.x + x,
    edgeNames: edges.map((visible, index) => visible ? EDGE_NAMES[index] : null).filter(Boolean),
    style: { gridColumn: x + 1, gridRow: y + 1, borderWidth: edges.map((edge) => edge ? '1px' : '0').join(' ') },
  }))
  const oddRotation = placement.rotation % 2 === 1
  return {
    item,
    shape,
    cells,
    detail: itemDetail(item),
    originIndex,
    selected: current.selectedInventoryIndex === originIndex,
    spriteSources: itemSpriteSources(item),
    itemClasses: ['bag-item', item.type, ...(itemSpriteSources(item) ? ['has-sprite'] : []), ...(item.attribute ? [`attribute-${item.attribute}`] : []), ...(item.type === 'relic' && run.relicOverload() > 0 ? ['overloaded'] : []), ...(current.selectedInventoryIndex === originIndex ? ['selected'] : [])],
    itemStyle: { gridColumn: `${placement.x + 1} / span ${shape[0].length}`, gridRow: `${placement.y + 1} / span ${shape.length}` },
    shapeStyle: { gridTemplateColumns: `repeat(${shape[0].length}, 1fr)`, gridTemplateRows: `repeat(${shape.length}, 1fr)` },
    nameStyle: layout.name ? { gridColumn: `${layout.name.x + 1} / span ${layout.name.width}`, gridRow: layout.name.y + 1 } : undefined,
    detailStyle: layout.detail ? { gridColumn: `${layout.detail.x + 1} / span ${layout.detail.width}`, gridRow: layout.detail.y + 1 } : undefined,
    spriteStyle: { width: oddRotation ? `${shape.length / shape[0].length * 100}%` : '100%', height: oddRotation ? `${shape[0].length / shape.length * 100}%` : '100%', transform: `translate(-50%, -50%) rotate(${placement.rotation * 90}deg)` },
  }
  })
})
const initialRelics = computed(() => {
  const current = state.value
  return current.initialRelicChoices.map((id) => getRelicDefinition(id)).filter(Boolean)
})
const initialRelicOpen = computed(() => {
  const current = state.value
  return initialRelics.value.length > 0 && current.relics.entries.length === 0
})
const roomRewardOpen = computed(() => {
  const current = state.value
  return current.phase === 'reward' && !!current.roomReward && !current.roomEntering
})
const levelUpOpen = computed(() => {
  const current = state.value
  return current.phase === 'level-up' && !!current.levelUp
})
const levelUpChoices = computed(() => {
  state.value
  return run.levelUpChoices()
})
const levelUpTalents = computed(() => levelUpChoices.value.filter((choice) => !choice.fixed))
const levelUpFixed = computed(() => levelUpChoices.value.find((choice) => choice.fixed))
const merchant = computed(() => state.value.merchantEntity)
const merchantOpen = computed(() => {
  const current = state.value
  return current.phase === 'merchant' && !!merchant.value && !current.merchantEntering
})
const merchantServices = computed(() => merchant.value?.services || state.value.merchantDefinition?.services || [])
const merchantTabs = computed(() => [merchantServices.value.includes('stock') ? 'stock' : null, merchantServices.value.includes('relic-choice') ? 'relics' : null].filter(Boolean))
const merchantOffers = computed(() => (merchant.value?.relicOfferResolved ? [] : (merchant.value?.relicChoices || []).map((id) => getRelicDefinition(id)).filter(Boolean)))
const craftRows = computed(() => {
  state.value
  return run.availableRecipes()
})
const detailIcon = computed(() => DETAIL_ICONS[detailPanel.value?.icon] || DETAIL_ICONS.item)

watch(merchantTabs, (tabs) => {
  if (!tabs.includes(merchantTab.value)) merchantTab.value = tabs[0] || 'stock'
}, { immediate: true })
watch(craftAvailable, (available) => {
  if (!available) craftOpen.value = false
}, { immediate: true })

function itemDetail(item) {
  if (item.type === 'weapon') return `${WEAPON_CLASS_LABELS[item.weaponClass] || LABELS.weaponClass} · ATK ${item.attack} · R ${run.weaponRange(item)} · ${LABELS.energy} ${run.weaponEnergyCost(item)}`
  if (item.type === 'potion') return `HP +${item.heal}`
  if (item.type === 'armor') return `${LABELS.armor} +${item.armor}`
  if (item.type === 'energy') return `${LABELS.energy} +${item.energy}`
  if (item.type === 'buff') return `ATK +${item.attackBonus}`
  if (item.type === 'defense') return LABELS.armor
  return item.description || ''
}

function rewardDetail(definition) {
  return definition.type === 'weapon' ? `${WEAPON_CLASS_LABELS[definition.weaponClass] || LABELS.weaponClass} · ATK ${definition.attack} · R ${run.weaponRange(definition)} · ${LABELS.energy} ${run.weaponEnergyCost(definition)}` : itemDetail(definition)
}

function itemAttribute(item) { return item?.attribute ? ATTRIBUTE_LABELS[item.attribute] || item.attribute : '' }
function toggleTopPanel(panel) { topPanel.value = topPanel.value === panel ? null : panel }
function selectInitialRelic(id) { run.chooseInitialRelic(id) }
function chooseRoomReward(index) { run.chooseRoomReward(index) }
function chooseLevelUp(id) { run.chooseLevelUpOption(id) }
function chooseMerchantRelic(id) { run.chooseMerchantRelic(id) }
function selectMerchantTab(tab) { merchantTab.value = tab }
function roomRewardDisabled(choice) {
  if (choice.kind === 'relic') return !run.canFitRelic(choice.relicId)
  if (choice.kind === 'item') return !run.backpack.canFit({ ...getItemDefinition(choice.itemId), uid: 'reward-preview' })
  return false
}
function roomRewardTitle(choice) {
  if (choice.kind === 'relic') return getRelicDefinition(choice.relicId)?.name || ''
  if (choice.kind === 'item') return getItemDefinition(choice.itemId)?.name || ''
  return `${LABELS.gold} +${choice.amount}`
}
function roomRewardDescription(choice) {
  if (choice.kind === 'relic') return getRelicDefinition(choice.relicId)?.description || ''
  if (choice.kind === 'item') { const definition = getItemDefinition(choice.itemId); return definition ? rewardDetail(definition) : '' }
  return ''
}

function detailActionFor(target) {
  const formula = target.closest('[data-craft-item]')
  if (formula) return () => run.showItemDetail(getItemDefinition(formula.dataset.craftItem))
  const relic = target.closest('[data-relic-detail]')
  if (relic) return () => run.showRelicDetail(relic.dataset.relicDetail)
  const bagItem = target.closest('[data-bag-item]')
  if (bagItem) { const item = run.backpack.placementForCellIndex(Number(bagItem.dataset.bagItem))?.item; return item ? () => run.showItemDetail(item) : null }
  const bagCell = target.closest('[data-bag-cell]')
  if (bagCell) { const item = run.backpack.placementForCellIndex(Number(bagCell.dataset.bagCell))?.item; return item ? () => run.showItemDetail(item) : null }
  const inventory = target.closest('[data-slot]')
  if (inventory) { const item = run.backpack.placementForCellIndex(Number(inventory.dataset.slot))?.item; return item ? () => run.showItemDetail(item) : null }
  const stock = target.closest('[data-merchant-stock]')
  if (stock) { const entry = merchant.value?.stock?.[Number(stock.dataset.merchantStock)]; const definition = getItemDefinition(entry?.itemId); return definition ? () => run.showItemDetail({ ...definition, uid: `merchant-preview-${definition.id}` }) : null }
  const merchantRelic = target.closest('[data-merchant-relic-choice]')
  if (merchantRelic) return () => run.showRelicDetail(merchantRelic.dataset.merchantRelicChoice)
  return null
}

function onPointerDown(event) {
  if (event.button !== undefined && event.button !== 0) return
  const openDetail = detailActionFor(event.target)
  if (!openDetail) return
  const nextHold = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, opened: false, timer: null }
  nextHold.timer = window.setTimeout(() => {
    if (hold.value !== nextHold) return
    nextHold.opened = openDetail()
  }, 420)
  hold.value = nextHold
}
function onPointerMove(event) {
  const current = hold.value
  if (!current || current.pointerId !== event.pointerId || current.opened) return
  if (Math.abs(event.clientX - current.x) + Math.abs(event.clientY - current.y) <= 8) return
  window.clearTimeout(current.timer)
  hold.value = null
}
function onPointerUp(event) {
  const current = hold.value
  if (!current || current.pointerId !== event.pointerId) return
  window.clearTimeout(current.timer)
  hold.value = null
  if (!current.opened) return
  run.closeDetail()
  ignoreClicksUntil = Date.now() + 120
}
function onContextMenu(event) { if (event.target instanceof Element && event.target.closest('.backpack-grid')) event.preventDefault() }

function onClick(event) {
  if (Date.now() < ignoreClicksUntil) return
  const target = event.target
  const craft = target.closest('[data-craft-result]')
  if (craft) { run.craft(craft.dataset.craftResult); return }
  const merchantTabButton = target.closest('[data-merchant-tab]')
  if (merchantTabButton) { selectMerchantTab(merchantTabButton.dataset.merchantTab); return }
  const levelChoice = target.closest('[data-level-up-choice]')
  if (levelChoice) { chooseLevelUp(levelChoice.dataset.levelUpChoice); return }
  const roomReward = target.closest('[data-room-reward]')
  if (roomReward && !roomReward.disabled) { chooseRoomReward(Number(roomReward.dataset.roomReward)); return }
  const relicChoice = target.closest('[data-relic-choice]')
  if (relicChoice) { selectInitialRelic(relicChoice.dataset.relicChoice); return }
  const stock = target.closest('[data-merchant-stock]')
  if (stock) { run.buyMerchantItem(Number(stock.dataset.merchantStock)); return }
  const merchantRelic = target.closest('[data-merchant-relic-choice]')
  if (merchantRelic && merchantRelic.getAttribute('aria-disabled') !== 'true') { chooseMerchantRelic(merchantRelic.dataset.merchantRelicChoice); return }
  const bagTarget = target.closest('[data-bag-item]') || target.closest('[data-bag-cell]')
  if (bagTarget) {
    const index = Number(bagTarget.dataset.bagItem ?? bagTarget.dataset.bagCell)
    if (run.itemTargeting) run.clearSelection()
    else run.clickInventoryCell(index)
    return
  }
  const action = target.closest('[data-action]')?.dataset.action
  if (!action) return
  if (action === 'copy-log') { void copyLog(); return }
  if (action === 'build-status') { buildStatusOpen.value = !buildStatusOpen.value; return }
  if (action === 'build-status-close') { buildStatusOpen.value = false; return }
  if (action === 'craft-open') { if (craftAvailable.value) craftOpen.value = true; return }
  if (action === 'craft-close') { craftOpen.value = false; return }
  if (action === 'use') run.useSelected()
  if (action === 'discard') run.discardSelected()
  if (action === 'rotate-bag') run.rotateSelectedInventory()
  if (action === 'camera-pitch-minus') { scene.value?.adjustCameraPitch(-1); uiRevision.value++ }
  if (action === 'camera-pitch-plus') { scene.value?.adjustCameraPitch(1); uiRevision.value++ }
  if (action === 'restart') { run.clearSave(); run.reset() }
  if (action === 'restart-settings') { if (window.confirm(LABELS.restartConfirm)) { run.clearSave(); run.reset(); topPanel.value = null } }
  if (action === 'close-merchant') run.closeMerchant()
  if (action === 'merchant-sell') run.sellSelectedMerchantItem()
  if (action === 'merchant-refresh') run.refreshMerchantInventory()
  if (action === 'skip-room-reward') run.skipRoomReward()
  if (action === 'close-detail') run.closeDetail()
  if (action === 'log') toggleTopPanel('log')
  if (action === 'settings') toggleTopPanel('settings')
  if (action === 'character') toggleTopPanel('characterpanel')
  if (action === 'talents') toggleTopPanel('talentpanel')
  if (action === 'help') { topPanel.value = null; helpOpen.value = true }
  if (action === 'close-help') helpOpen.value = false
}

async function copyLog() {
  const text = run.log.slice(0, 40).join('\n')
  if (!text) return
  let copied = false
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); copied = true } } catch { copied = false }
  if (!copied) {
    const textarea = document.createElement('textarea')
    textarea.value = text; textarea.setAttribute('readonly', ''); textarea.style.position = 'fixed'; textarea.style.opacity = '0'
    document.body.appendChild(textarea); textarea.select()
    try { copied = document.execCommand('copy') } catch { copied = false }
    textarea.remove()
  }
  copyLabel.value = copied ? LABELS.copied : LABELS.copyFailed
  window.setTimeout(() => { copyLabel.value = LABELS.copyLog }, 1600)
}
function closeHelp() { helpOpen.value = false }
function updateReveal() {
  run.setDebugReveal(reveal.value)
  if (typeof localStorage !== 'undefined') localStorage.setItem('v2_opt_reveal', reveal.value ? '1' : '0')
}

onMounted(() => {
  scene.value = new GameScene(run, sceneContainer.value)
  subscriptions.push(run.on('change', () => { revision.value++ }))
  subscriptions.push(run.on('detail', () => { detailRevision.value++ }))
  run.setDebugReveal(reveal.value)
})
onBeforeUnmount(() => {
  for (const unsubscribe of subscriptions) unsubscribe?.()
  if (hold.value?.timer) window.clearTimeout(hold.value.timer)
  scene.value?.dispose()
})
</script>

<template>
  <div class="vue-hud-root" @click="onClick" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp" @contextmenu="onContextMenu">
    <div class="hud-top">
      <div class="hud-stats"><div class="stat floor"><span class="label">{{ LABELS.floor }}</span><span class="value">{{ state.currentRoom?.floor || '' }}</span></div><div class="stat level"><span class="label">{{ LABELS.level }}</span><span class="value">{{ state.player.level }}</span></div><div class="stat gold"><span class="label">{{ LABELS.gold }}</span><span class="value">{{ state.player.gold }}</span></div></div>
      <div class="hud-btns"><button type="button" class="hud-icon" data-action="craft-open" :disabled="!craftAvailable" :title="LABELS.craft" :aria-label="LABELS.craft"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 3 7 7-4 4-7-7zM12 12 3 21M4 3v6M1 6h6"/></svg></button><button type="button" class="hud-icon" data-action="build-status" :title="LABELS.buildStatus" :aria-label="LABELS.buildStatus"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M9 6h9v6M15 18H6v-6"/></svg></button><button class="hud-icon talent-book-top" data-action="talents" :title="LABELS.talentGraph" :aria-label="LABELS.talentGraph">✶</button><button class="hud-icon" data-action="character" :title="LABELS.character" :aria-label="LABELS.character">♙</button><button class="hud-icon" data-action="help" :title="LABELS.help" :aria-label="LABELS.help">?</button><button class="hud-icon" data-action="settings" :title="LABELS.settings" :aria-label="LABELS.settings">⚙</button><button class="hud-icon" data-action="log" :title="LABELS.log" :aria-label="LABELS.log">▤</button></div>
    </div>
    <div class="hud-emotion" :class="{ overloaded: state.relicOverload() > 0 }"><span class="emotion-text">{{ hints }}</span></div>
    <div class="experience-bar-row" :aria-label="LABELS.experience"><div class="experience-bar"><span class="experience-fill" :style="{ width: `${experienceProgress}%` }"></span><span class="experience-value">{{ state.player.experience }}/{{ state.player.experienceToNext }}</span></div></div>
    <div id="app" ref="sceneContainer" aria-label="game board"></div>

    <section class="detail-panel" :class="{ show: !!detailPanel }" :aria-hidden="detailPanel ? 'false' : 'true'"><div class="detail-card" data-action="close-detail"><div class="detail-icon" aria-hidden="true">{{ detailIcon }}</div><div class="detail-content"><div class="detail-head"><div class="detail-title">{{ detailPanel?.title || '' }}</div><div class="detail-badges"><span v-for="badge in (detailPanel?.badges || [])" :key="badge">{{ badge }}</span></div></div><div class="detail-lines"><div v-for="(line, index) in (detailPanel?.lines || [])" :key="`${index}-${line}`">{{ line }}</div></div><div class="detail-description">{{ detailPanel?.description || '' }}</div></div></div></section>

    <div class="hud-settings" :class="{ show: topPanel === 'settings' }"><label class="settings-row"><input v-model="reveal" type="checkbox" @change="updateReveal"> {{ LABELS.reveal }}</label><div class="settings-camera" :aria-label="LABELS.camera"><div class="settings-camera-row"><span>{{ LABELS.cameraAzimuth }}</span><strong>{{ cameraAngles ? '自动（-15° ~ 15°）' : '' }}</strong></div><div class="settings-camera-row"><span>{{ LABELS.cameraPitch }} <strong>{{ cameraAngles ? `${cameraAngles.pitch}°` : '' }}</strong></span><div class="settings-camera-controls"><button type="button" class="settings-camera-button" data-action="camera-pitch-minus">−</button><button type="button" class="settings-camera-button" data-action="camera-pitch-plus">+</button></div></div></div><button class="settings-restart" data-action="restart-settings">{{ LABELS.restart }}</button></div>

    <section class="character-panel" :class="{ show: topPanel === 'characterpanel' }" :aria-hidden="topPanel === 'characterpanel' ? 'false' : 'true'"><div class="character-panel-head"><span>{{ LABELS.characterGrowth }}</span><strong>Lv. {{ state.player.level }}</strong></div><div class="character-summary"><div class="character-stat"><span>{{ LABELS.experience }}</span><strong>{{ state.player.experience }} / {{ state.player.experienceToNext }}</strong></div><div class="character-stat"><span>{{ LABELS.maxHealth }}</span><strong>{{ state.player.hp }} / {{ state.player.maxHp }}</strong></div></div><div class="character-expbar"><span :style="{ width: `${characterExperienceProgress}%` }"></span></div><div class="character-talents"><section class="character-talent-summary"><div class="character-talent-title">{{ LABELS.talents }}</div><div class="character-row"><span>{{ LABELS.talents }}</span><strong>{{ state.player.talents?.length || 0 }}</strong></div><div class="character-row sub"><span>{{ LABELS.fixedGrowth }}</span><strong>{{ state.player.talentRuntime?.bodyStrength || 0 }}</strong></div></section></div></section>
    <section class="talent-panel" :class="{ show: topPanel === 'talentpanel' }" :aria-hidden="topPanel === 'talentpanel' ? 'false' : 'true'"><div class="talent-panel-head"><span>{{ LABELS.talentGraph }}</span><strong>{{ talentGraph.filter((node) => node.state === 'owned').length }}/{{ talentGraph.length }}</strong></div><div class="talent-graph"><div v-for="group in talentLines" :key="group.line" class="talent-line"><div class="talent-line-title">{{ group.title }}</div><div v-for="node in group.nodes" :key="node.id" class="talent-node" :class="node.state" :title="`${node.description} · ${node.prerequisites}`"><span class="talent-node-slot">{{ node.slot }}</span><b>{{ node.name }}</b><small>{{ node.description }}</small><small class="talent-node-prereq">{{ node.prerequisites }}</small></div></div></div></section>

    <div class="hud-log" :class="{ show: topPanel === 'log' }"><div class="log-head"><span class="log-title">{{ LABELS.log }}</span><button class="log-copy" data-action="copy-log" type="button">{{ copyLabel }}</button></div><div class="log-body"><div v-for="(line, index) in state.log.slice(0, 40)" :key="`${index}-${line}`" class="line">{{ line }}</div></div></div>
    <div class="help-modal" :class="{ show: helpOpen }" :aria-hidden="helpOpen ? 'false' : 'true'"><div class="help-modal-backdrop" data-action="close-help"></div><section class="help-modal-panel" role="dialog" aria-modal="true"><header class="help-modal-head"><div><span class="help-modal-kicker">{{ LABELS.help }}</span><h2>{{ LABELS.basicGameplay }}</h2></div><button class="help-modal-close" data-action="close-help" :aria-label="LABELS.close">×</button></header><div class="help-modal-body"><section v-for="section in HELP_SECTIONS" :key="section.title" class="help-section"><h3>{{ section.title }}</h3><ul><li v-for="item in section.items" :key="item">{{ item }}</li></ul></section></div></section></div>

    <div class="relic-choice" :class="{ show: initialRelicOpen }"><div class="relic-choice-title">{{ LABELS.initialRelic }}</div><div class="relic-choice-row"><button v-for="relic in initialRelics" :key="relic.id" class="relic-choice-card" :data-relic-choice="relic.id"><span class="relic-name">{{ relic.name }}</span><span class="relic-desc">{{ relic.description }}</span></button></div></div>
    <div class="relic-choice room-reward" :class="{ show: roomRewardOpen }"><div class="relic-choice-title">{{ LABELS.roomReward }}</div><div class="relic-choice-row"><button v-for="(choice, index) in (state.roomReward?.choices || [])" :key="index" class="relic-choice-card" :data-room-reward="index" :disabled="roomRewardDisabled(choice)"><span class="relic-name">{{ roomRewardTitle(choice) }}</span><span class="relic-desc">{{ roomRewardDescription(choice) }}</span></button></div><button class="reward-skip" data-action="skip-room-reward">{{ LABELS.skipReward }}</button></div>
    <div class="relic-choice level-up" :class="{ show: levelUpOpen }"><div class="relic-choice-title">{{ LABELS.growthChoice }}</div><div class="relic-choice-row level-up-talent-row"><button v-for="choice in levelUpTalents" :key="choice.id" class="relic-choice-card talent-choice-card" :data-level-up-choice="choice.id"><span class="talent-choice-branch">{{ TALENT_LINE_LABELS[choice.line] || choice.line }}</span><span class="relic-name">{{ choice.name }}</span><span class="relic-desc">{{ choice.description }}</span></button></div><div class="level-up-fixed-row"><div v-if="levelUpFixed" class="level-up-fixed-label">{{ LABELS.fixedGrowth }}</div><button v-if="levelUpFixed" class="relic-choice-card level-up-fixed-choice" :data-level-up-choice="levelUpFixed.id"><span class="relic-name">{{ levelUpFixed.name }}</span><span class="relic-desc">{{ levelUpFixed.description }}</span></button></div></div>

    <div class="hud-rest" :class="{ show: merchantOpen }"><section class="merchant-panel"><div class="merchant-head"><span class="merchant-title">{{ merchant?.name }}</span><div class="merchant-tabs"><button v-for="tab in merchantTabs" :key="tab" type="button" class="merchant-tab" :class="{ active: merchantTab === tab }" :data-merchant-tab="tab" :aria-selected="merchantTab === tab">{{ tab === 'stock' ? LABELS.buy : LABELS.merchantRelicsTab }}</button></div><button data-action="close-merchant">{{ LABELS.leaveMerchant }}</button></div><div class="merchant-tab-page merchant-purchase-page" :class="{ show: merchantTab === 'stock' }"><div class="merchant-stock"><button v-for="(entry, index) in (merchant?.stock || [])" :key="`${entry.itemId}-${index}`" class="merchant-stock-item" :data-merchant-stock="index"><b>{{ getItemDefinition(entry.itemId)?.name }}</b><small>{{ LABELS.buy }} {{ entry.price }}</small></button></div><div class="merchant-trade"><button data-action="merchant-sell" :disabled="!selectedItem">{{ LABELS.sellSelected }}{{ selectedItem ? ` ${merchantSellPrice(selectedItem)}` : '' }}</button><button v-if="merchant?.restockPrice > 0" data-action="merchant-refresh" :disabled="state.player.gold < merchant.restockPrice">{{ LABELS.refreshStock }} {{ merchant.restockPrice }}</button></div></div><div class="merchant-relics" :class="{ show: merchantTab === 'relics' }"><section v-if="merchantOffers.length" class="merchant-relic-section merchant-relic-offer"><div class="merchant-relic-title">{{ LABELS.relicChoice }}</div><div class="merchant-relic-grid"><button v-for="relic in merchantOffers" :key="relic.id" class="merchant-relic-item" :class="{ disabled: state.player.gold < (merchant?.relicOfferPrice || 0) }" :data-merchant-relic-choice="relic.id" :aria-disabled="state.player.gold < (merchant?.relicOfferPrice || 0)"><b>{{ relic.name }}</b><small>{{ relic.description }} · {{ LABELS.buy }} {{ merchant.relicOfferPrice }}</small></button></div></section><div v-else class="merchant-relic-empty">{{ LABELS.noRelicsAvailable }}</div></div></section></div>

    <div class="hud-bottom"><div class="backpack-toolbar" :aria-label="`${LABELS.health} ${LABELS.armor} ${LABELS.energy}`"><div class="backpack-action-slot act-drop-slot"><button class="backpack-action act-drop" data-action="discard" :hidden="!actionsAvailable || !state.selectedItem" :disabled="!actionsAvailable || !state.selectedItem">{{ LABELS.discard }}</button></div><div class="vital-armor" :title="LABELS.armor"><strong>{{ state.player.armor }}</strong></div><div class="vital-bars"><div class="vital-health" :title="LABELS.health"><span class="vital-health-fill" :style="{ width: `${Math.max(0, Math.min(100, state.player.hp / Math.max(1, state.player.maxHp) * 100))}%` }"></span><strong>{{ state.player.hp }}/{{ state.player.maxHp }}</strong></div><div class="vital-energy" :title="LABELS.energy"><span class="vital-energy-fill" :style="{ width: `${Math.max(0, Math.min(100, state.player.energy / Math.max(1, state.player.maxEnergy) * 100))}%` }"></span><strong>{{ state.player.energy }}/{{ state.player.maxEnergy }}</strong></div></div><div class="backpack-action-slot act-use-slot"><button class="backpack-action act-use" data-action="use" :hidden="!selectedUsable" :disabled="!selectedUsable">{{ LABELS.use }}</button></div><button class="backpack-action bag-rotate" data-action="rotate-bag" :disabled="!selectedRotatable" :title="LABELS.rotate">↻</button></div><section class="backpack-panel"><div class="backpack-grid-wrap"><div class="backpack-grid" data="backpack" :style="{ '--bag-columns': INVENTORY_COLUMNS, '--bag-rows': INVENTORY_ROWS }"><button v-for="cell in backpackCells" :key="`cell-${cell.index}`" class="bag-cell" :class="{ 'drop-valid': cell.action === 'move', 'selected-cell': cell.selected }" :data-bag-cell="cell.index" :aria-label="cell.label" :style="{ gridColumn: cell.index % INVENTORY_COLUMNS + 1, gridRow: Math.floor(cell.index / INVENTORY_COLUMNS) + 1 }"></button><div v-for="entry in backpackItems" :key="entry.item.uid" :class="entry.itemClasses" :style="entry.itemStyle"><span class="bag-shape" :style="entry.shapeStyle"><InventorySprite v-if="entry.spriteSources" :sources="entry.spriteSources" :item-index="entry.originIndex" :style="entry.spriteStyle"/><span v-for="cell in entry.cells" :key="cell.index" class="occupied" :data-bag-item="cell.index" :style="cell.style"><i v-for="edge in cell.edgeNames" :key="edge" class="shape-edge" :class="`edge-${edge}`" aria-hidden="true"></i></span><b v-if="entry.nameStyle" class="bag-name" :style="entry.nameStyle">{{ entry.item.name }}</b><small v-if="entry.detailStyle" class="bag-detail" :style="entry.detailStyle">{{ entry.detail }}</small></span></div></div></div></section></div>

    <section class="build-status-panel" :hidden="!buildStatusOpen"><header><strong>{{ LABELS.talentGraph }}</strong><button data-action="build-status-close">{{ LABELS.close }}</button></header><div><p v-for="line in statusLines" :key="line">{{ line }}</p><p v-if="!statusLines.length">当前没有待用增益或次数效果。</p></div></section>
    <section class="craft-panel" :hidden="!craftOpen"><div class="craft-dialog"><header><h2>{{ LABELS.craft }}</h2><button data-action="craft-close">{{ LABELS.close }}</button></header><p>消耗背包中的原料，合成会推进 1 回合。长按配方中的物品查看详情。</p><div><div v-for="recipe in craftRows" :key="recipe.result" class="craft-row"><button class="craft-item" :data-craft-item="recipe.a">{{ getItemDefinition(recipe.a)?.name }}</button><span>+</span><button class="craft-item" :data-craft-item="recipe.b">{{ getItemDefinition(recipe.b)?.name }}</button><span>=</span><button :data-craft-result="recipe.result" :disabled="!recipe.canFit">{{ recipe.canFit ? '合成' : '空间不足' }}</button></div><p v-if="!craftRows.length">背包内暂无可合成方案。</p></div></div></section>
    <div class="hud-over" :class="{ show: state.gameOver, win: state.win, lose: !state.win }"><h1>{{ state.win ? LABELS.win : LABELS.lose }}</h1><p>{{ state.win ? LABELS.winMessage : LABELS.loseMessage }}</p><button data-action="restart">{{ LABELS.restart }}</button></div>
  </div>
</template>
