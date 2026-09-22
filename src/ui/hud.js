// Deprecated compatibility surface. Runtime mounting now lives in VueHud.vue;
// this class remains only for the existing Node-side contract checks.
import { INVENTORY_COLUMNS, INVENTORY_ROWS } from '../game/run.js'
import { getItemDefinition } from '../game/data/content.js'
import { getRelicDefinition } from '../game/data/relics.js'
import { merchantSellPrice } from '../game/data/merchants.js'
import { bagShapeLayout } from './bag-shape.js'
import { itemSpriteSources } from './item-sprites.js'

const LABELS = Object.freeze({
  floor: '\u697c\u5c42',
  health: '\u751f\u547d',
  armor: '\u62a4\u7532',
  energy: '\u4f53\u529b',
  gold: '\u91d1\u5e01',
  turn: '\u5168\u5c40\u56de\u5408',
  poison: '\u4e2d\u6bd2',
  burning: '\u71c3\u70e7',
  level: '\u7b49\u7ea7',
  experience: '\u7ecf\u9a8c',
  character: '\u89d2\u8272',
  characterGrowth: '\u89d2\u8272\u6210\u957f',
  maxHealth: '\u751f\u547d\u4e0a\u9650',
  talents: '\u5929\u8d4b',
  talentGraph: '\u5929\u8d4b\u7f51',
  fixedGrowth: '\u5f3a\u5065\u4f53\u9b44',
  help: '\u5e2e\u52a9',
  basicGameplay: '\u57fa\u672c\u73a9\u6cd5',
  close: '\u5173\u95ed',
  settings: '\u8bbe\u7f6e',
  camera: '\u89c6\u89d2',
  cameraAzimuth: '\u65cb\u8f6c\u89d2\u5ea6',
  cameraPitch: '\u4fef\u4ef0\u89d2\u5ea6',
  cameraAzimuthDecrease: '\u51cf\u5c0f\u65cb\u8f6c\u89d2\u5ea6',
  cameraAzimuthIncrease: '\u589e\u52a0\u65cb\u8f6c\u89d2\u5ea6',
  cameraPitchDecrease: '\u51cf\u5c0f\u4fef\u4ef0\u89d2\u5ea6',
  cameraPitchIncrease: '\u589e\u52a0\u4fef\u4ef0\u89d2\u5ea6',
  log: '\u65e5\u5fd7',
  copyLog: '\u590d\u5236\u65e5\u5fd7',
  copied: '\u5df2\u590d\u5236',
  copyFailed: '\u590d\u5236\u5931\u8d25',
  reveal: '\u8c03\u8bd5\uff1a\u663e\u793a\u724c\u5185\u5bb9',
  discard: '\u4e22\u5f03',
  rotate: '\u65cb\u8f6c',
  use: '\u4f7f\u7528',
  empty: '\u7a7a',
  nextAttack: '\u4e0b\u6b21\u653b\u51fb',
  nextMeleeAttack: '\u4e0b\u6b21\u8fd1\u6218\u653b\u51fb',
  relics: '\u5723\u9057\u7269',
  relicOverload: '\u5723\u9057\u7269\u8d85\u8f7d',
  initialRelic: '\u9009\u62e9\u521d\u59cb\u5723\u9057\u7269',
  leaveMerchant: '\u79bb\u5f00',
  sold: '\u5df2\u552e\u7f44',
  buy: '\u8d2d\u4e70',
  merchantRelicsTab: '\u5723\u9057\u7269',
  noRelicsAvailable: '\u6682\u65e0\u53ef\u83b7\u5f97\u7684\u5723\u9057\u7269',
  relicChoice: '\u9009\u62e9\u4e00\u4ef6\u5723\u9057\u7269',
  roomReward: '\u65b0\u623f\u95f4\u5956\u52b1',
  growthChoice: '\u9009\u62e9\u5929\u8d4b\u6216\u5f3a\u5065\u4f53\u9b44',
  skipReward: '\u8df3\u8fc7',
  sellSelected: '\u51fa\u552e\u6240\u9009',
  refreshStock: '\u5237\u65b0\u8d27\u67b6',
  weaponClass: '\u7c7b\u522b',
  restart: '\u91cd\u65b0\u5f00\u59cb',
  restartConfirm: '\u786e\u5b9a\u8981\u91cd\u65b0\u5f00\u59cb\u5417\uff1f\u5f53\u524d\u8fdb\u5ea6\u5c06\u88ab\u6e05\u9664\u3002',
  win: '\u9003\u51fa\u5730\u7262',
  lose: '\u4f60\u5df2\u9668\u843d',
  winMessage: '\u4f60\u51fb\u8d25\u4e86\u76d1\u89c6\u8005\u3002',
  loseMessage: '\u751f\u547d\u5f52\u96f6\u3002\u53ef\u4ee5\u91cd\u65b0\u5f00\u59cb\u6311\u6218\u3002',
})

const DETAIL_ICONS = Object.freeze({
  enemy: '\u2694',
  weapon: '\u2694',
  potion: '\u271a',
  armor: '\u26e8',
  energy: '\u26a1',
  buff: '\u2726',
  relic: '\u25c6',
  trap: '!',
  gold: '\u25cf',
  key: '\ud83d\udd11',
  merchant: '\u25c9',
  item: '\u25a0',
})

const WEAPON_CLASS_LABELS = Object.freeze({ sword: '\u5251', axe: '\u65a7', dagger: '\u5315\u9996', polearm: '\u957f\u67c4', heavy: '\u91cd\u6b66\u5668', bow: '\u5f13' })
const TALENT_LINE_LABELS = Object.freeze({
  flow: '换势', guard: '守御', harmony: '调和',
  sword: '\u5251', axe: '\u65a7', dagger: '\u5315\u9996', polearm: '\u957f\u67c4', heavy: '\u91cd\u6b66\u5668', bow: '\u5f13',
  scorch: '\u707c\u70ed', wither: '\u67af\u840e', drown: '\u6c89\u6eba', survival: '\u751f\u5b58',
})

const HELP_SECTIONS = Object.freeze([
  {
    "title": "行动与体力",
    "items": [
      "实际每移动一格推进1回合，恢复1体力；翻牌、拾取和普通交互也恢复1体力。",
      "武器攻击按当前费用消耗体力，最低1；使用消耗品、合成、移动与旋转背包物品各推进1回合，不自动回体力。"
    ]
  },
  {
    "title": "背包与合成",
    "items": [
      "\u80cc\u5305\u4e3a8\u52174\u884c\uff0c\u7269\u54c1\u56db\u5411\u76f8\u90bb\u751f\u6548\u3002\u540c\u540d\u88ab\u52a8\u4e0d\u53e0\u52a0\u3002",
      "所有防具均为被动，放在背包内生效。成功移动或旋转物品消耗1回合；选择、取消、失败操作免费。",
      "合成面板列出背包内拥有原料的配方。成品放不下时不能合成；长按公式物品查看详情。",
      "材料仅由敌人掉落或在商店购买，不在随机地面与房间奖励中生成。商店可售卖所有物品。"
    ]
  },
  {
    "title": "天赋与圣遗物",
    "items": [
      "升级时选择换势、守御、调和、求生四条路线的天赋，也可重复选择强健体魄。",
      "圣遗物没有超载限制，持有时生效。每房间次数不会因离开再进入或整理背包重置。"
    ]
  },
  {
    "title": "战斗与探索",
    "items": [
      "选择武器后点击敌人；远处目标先预览路径，再次点击执行。自动接近也算主动移动。",
      "换位符只推进1回合，不累计移动步数。长按棋盘或背包物品查看详情。",
      "穿过五层并击败监视者获胜。"
    ]
  }
])

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]))
}

function helpContentHtml() {
  return HELP_SECTIONS.map((section) => `<section class="help-section"><h3>${escapeHtml(section.title)}</h3><ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`).join('')
}

function merchantSellText(item) { return `+${merchantSellPrice(item)}` }

export class HUD {
  constructor(run) {
    this.run = run
    this.root = document.getElementById('hud')
    if (!this.root) throw new Error('Missing #hud container')
    this.merchantTab = 'stock'
    this.scene = null
    this._spriteUpgradeTimers = new Set()
    this._build()
    this._onClick = (event) => this._handleClick(event)
    this._onPointerDown = (event) => this._handlePointerDown(event)
    this._onPointerMove = (event) => this._handlePointerMove(event)
    this._onPointerUp = (event) => this._handlePointerUp(event)
    this._onContextMenu = (event) => {
      if (event.target.closest('[data=backpack]')) event.preventDefault()
    }
    this._onKeyDown = (event) => {
      if (event.key !== 'Escape' || !this.q('helpmodal')?.classList.contains('show')) return
      event.preventDefault()
      this._setHelpModal(false)
    }
    this.root.addEventListener('click', this._onClick)
    this.root.addEventListener('pointerdown', this._onPointerDown)
    this.root.addEventListener('pointermove', this._onPointerMove)
    this.root.addEventListener('pointerup', this._onPointerUp)
    this.root.addEventListener('pointercancel', this._onPointerUp)
    this.root.addEventListener('contextmenu', this._onContextMenu)
    document.addEventListener('keydown', this._onKeyDown)
    this.unsubscribe = this.run.on('change', () => this.render())
    // Detail panels are an overlay-only update. Re-rendering the whole HUD
    // here would replace every backpack sprite and restart its low->high
    // image upgrade, which makes unrelated equipment visibly flash.
    this.detailUnsubscribe = this.run.on('detail', () => this._renderDetailPanel())
    this.render()
  }

  _build() {
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-stats">
          <div class="stat floor"><span class="label">${LABELS.floor}</span><span class="value" data=floor></span></div>
          <div class="stat level"><span class="label">${LABELS.level}</span><span class="value" data=level></span></div>
          <div class="stat gold"><span class="label">${LABELS.gold}</span><span class="value" data=gold></span></div>
        </div>
        <div class="hud-btns">
          <button type="button" class="hud-icon" data-action="craft-open" title="合成" aria-label="合成"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 3 7 7-4 4-7-7zM12 12 3 21M4 3v6M1 6h6"/></svg></button>
          <button type="button" class="hud-icon" data-action="build-status" title="构筑状态" aria-label="构筑状态"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M9 6h9v6M15 18H6v-6"/></svg></button>
          <button class="hud-icon talent-book-top" data-action="talents" title="${LABELS.talentGraph}" aria-label="${LABELS.talentGraph}">\u2736</button>
          <button class="hud-icon" data-action="character" title="${LABELS.character}" aria-label="${LABELS.character}">\ud83d\udc64</button>
          <button class="hud-icon" data-action="help" title="${LABELS.help}" aria-label="${LABELS.help}">?</button>
          <button class="hud-icon" data-action="settings" title="${LABELS.settings}" aria-label="${LABELS.settings}">\u2699</button>
          <button class="hud-icon" data-action="log" title="${LABELS.log}" aria-label="${LABELS.log}">\ud83d\udcdc</button>
        </div>
      </div>

      <div class="hud-emotion" data=hintrow>
        <span class="emotion-text" data=hint></span>
      </div>

      <div class="experience-bar-row" aria-label="${LABELS.experience}">
        <div class="experience-bar" data=experiencebar>
          <span class="experience-fill" data=experiencefill></span>
          <span class="experience-value" data=experiencevalue></span>
        </div>
      </div>

      <div id="app" aria-label="game board"></div>

      <section class="detail-panel" data=detailpanel aria-hidden="true">
        <div class="detail-card" data-action="close-detail">
          <div class="detail-icon" data=detailicon aria-hidden="true"></div>
          <div class="detail-content">
            <div class="detail-head"><div class="detail-title" data=detailtitle></div><div class="detail-badges" data=detailbadges></div></div>
            <div class="detail-lines" data=detaillines></div>
            <div class="detail-description" data=detaildescription></div>
          </div>
        </div>
      </section>

      <div class="hud-settings" data=settings>
        <label class="settings-row"><input type="checkbox" data=revealtoggle> ${LABELS.reveal}</label>
        <div class="settings-camera" aria-label="${LABELS.camera}">
          <div class="settings-camera-row"><span>${LABELS.cameraAzimuth}</span><strong data=cameraazimuthvalue></strong></div>
          <div class="settings-camera-row"><span>${LABELS.cameraPitch} <strong data=camerapitchvalue></strong></span><div class="settings-camera-controls"><button type="button" class="settings-camera-button" data-action="camera-pitch-minus" title="${LABELS.cameraPitchDecrease}" aria-label="${LABELS.cameraPitchDecrease}">&minus;</button><button type="button" class="settings-camera-button" data-action="camera-pitch-plus" title="${LABELS.cameraPitchIncrease}" aria-label="${LABELS.cameraPitchIncrease}">+</button></div></div>
        </div>
        <button class="settings-restart" data-action="restart-settings">${LABELS.restart}</button>
      </div>

      <section class="character-panel" data=characterpanel aria-hidden="true">
        <div class="character-panel-head"><span>${LABELS.characterGrowth}</span><strong data=characterlevel></strong></div>
        <div class="character-summary">
          <div class="character-stat"><span>${LABELS.experience}</span><strong data=characterexperience></strong></div>
          <div class="character-stat"><span>${LABELS.maxHealth}</span><strong data=characterhealth></strong></div>
        </div>
        <div class="character-expbar" aria-hidden="true"><span data=characterexperiencebar></span></div>
        <div class="character-talents" data=charactertalents></div>
      </section>

      <section class="talent-panel" data=talentpanel aria-hidden="true">
        <div class="talent-panel-head"><span>${LABELS.talentGraph}</span><strong data=talentcount></strong></div>
        <div class="talent-graph" data=talentgraph></div>
      </section>

      <div class="hud-log" data=log>
        <div class="log-head"><span class="log-title">${LABELS.log}</span><button class="log-copy" data=logcopy data-action="copy-log" type="button">${LABELS.copyLog}</button></div>
        <div class="log-body" data=logbody></div>
      </div>

      <div class="help-modal" data=helpmodal aria-hidden="true">
        <div class="help-modal-backdrop" data-action="close-help"></div>
        <section class="help-modal-panel" role="dialog" aria-modal="true" aria-labelledby="help-title">
          <header class="help-modal-head">
            <div><span class="help-modal-kicker">${LABELS.help}</span><h2 id="help-title">${LABELS.basicGameplay}</h2></div>
            <button class="help-modal-close" data=helpclose data-action="close-help" aria-label="${LABELS.close}" title="${LABELS.close}">\u00d7</button>
          </header>
          <div class="help-modal-body" data=helpcontent></div>
        </section>
      </div>

      <div class="relic-choice" data=initialrelics>
        <div class="relic-choice-title">${LABELS.initialRelic}</div>
        <div class="relic-choice-row" data=initialrelicrow></div>
      </div>

      <div class="relic-choice room-reward" data=roomreward>
        <div class="relic-choice-title">${LABELS.roomReward}</div>
        <div class="relic-choice-row" data=roomrewardrow></div>
        <button class="reward-skip" data-action="skip-room-reward">${LABELS.skipReward}</button>
      </div>

      <div class="relic-choice level-up" data=levelup>
        <div class="relic-choice-title" data=leveluptitle></div>
        <div class="relic-choice-row level-up-talent-row" data=leveluprow></div>
        <div class="level-up-fixed-row" data=levelupfixed></div>
      </div>

        <div class="hud-rest" data=merchantpanel>
          <section class="merchant-panel">
            <div class="merchant-head"><span class="merchant-title" data=merchanttitle></span><div class="merchant-tabs" data=merchanttabs></div><button data-action="close-merchant">${LABELS.leaveMerchant}</button></div>
            <div class="merchant-tab-page merchant-purchase-page" data=merchantpurchase>
              <div class="merchant-stock" data=merchantstock></div>
              <div class="merchant-trade" data=merchanttrade></div>
            </div>
            <div class="merchant-relics" data=merchantrelics></div>
          </section>
        </div>

        <div class="hud-bottom">
          <div class="backpack-toolbar" data=actions aria-label="${LABELS.health} ${LABELS.armor} ${LABELS.energy}">
            <div class="backpack-action-slot act-drop-slot"><button class="backpack-action act-drop" data-action="discard" hidden>${LABELS.discard}</button></div>
            <div class="vital-armor" title="${LABELS.armor}"><strong data=armorstrip></strong></div>
            <div class="vital-bars">
              <div class="vital-health" title="${LABELS.health}"><span class="vital-health-fill" data=healthfill></span><strong data=hpstrip></strong></div>
              <div class="vital-energy" title="${LABELS.energy}"><span class="vital-energy-fill" data=energyfill></span><strong data=energystrip></strong></div>
            </div>
            <div class="backpack-action-slot act-use-slot"><button class="backpack-action act-use" data-action="use" hidden>${LABELS.use}</button></div>
            <button class="backpack-action bag-rotate" data-action="rotate-bag" title="${LABELS.rotate}" aria-label="${LABELS.rotate}" hidden>\u21bb</button>
          </div>
          <section class="backpack-panel">
            <div class="backpack-grid-wrap">
              <div class="backpack-grid" data=backpack></div>
            </div>
          </section>
        </div>

      <section class="build-status-panel" data=buildstatuspanel hidden aria-label="构筑状态">
        <header><strong>构筑状态</strong><button data-action="build-status-close">关闭</button></header>
        <div data=buildstatus></div>
      </section>
      <section class="craft-panel" data=craftpanel role="dialog" aria-modal="true" aria-label="合成" hidden>
        <div class="craft-dialog"><header><h2>合成</h2><button data-action="craft-close" aria-label="关闭合成">关闭</button></header>
        <p>消耗背包中的原料，合成推进1回合。长按公式中的物品查看详情。</p>
        <div data=craftrows></div></div>
      </section>
      <div class="hud-over" data=over>
        <h1 data=overtitle></h1><p data=overmessage></p>
        <button data-action="restart">${LABELS.restart}</button>
      </div>`
    this.q = (key) => this.root.querySelector(`[data="${key}"]`)
    this.q('helpcontent').innerHTML = helpContentHtml()
    const revealToggle = this.q('revealtoggle')
    revealToggle.checked = typeof localStorage !== 'undefined' && localStorage.getItem('v2_opt_reveal') === '1'
    this.run.setDebugReveal(revealToggle.checked)
    revealToggle.addEventListener('change', () => {
      this.run.setDebugReveal(revealToggle.checked)
      if (typeof localStorage !== 'undefined') localStorage.setItem('v2_opt_reveal', revealToggle.checked ? '1' : '0')
    })
  }

  get sceneContainer() {
    const container = this.root.querySelector('#app')
    if (!container) throw new Error('Missing #app container')
    return container
  }

  setScene(scene) {
    this.scene = scene || null
    this._renderCameraSettings()
  }

  render() {
    this._renderCraft()
    const { player } = this.run
    const room = this.run.currentRoom
    this.q('floor').textContent = room ? String(room.floor) : ''
    this.q('hpstrip').textContent = `${player.hp}/${player.maxHp}`
    this.q('armorstrip').textContent = String(player.armor)
    this.q('healthfill').style.width = `${Math.max(0, Math.min(100, player.hp / Math.max(1, player.maxHp) * 100))}%`
    this.q('gold').textContent = String(player.gold)
    this.q('energystrip').textContent = `${player.energy}/${player.maxEnergy}`
    this.q('energyfill').style.width = `${Math.max(0, Math.min(100, player.energy / Math.max(1, player.maxEnergy) * 100))}%`
    this.q('level').textContent = String(player.level)
    this._renderCameraSettings()
    this.q('experiencevalue').textContent = `${player.experience}/${player.experienceToNext}`
    const experienceProgress = player.experienceToNext > 0 ? Math.min(100, Math.max(0, player.experience / player.experienceToNext * 100)) : 0
    this.q('experiencefill').style.width = `${experienceProgress}%`
    this._renderCharacterPanel(player)
    this._renderTalentPanel()
    const hints = this.run.itemRules.pendingLines(this.run.selectedItem?.type === 'weapon' ? this.run.selectedItem : null)
    this.q('hintrow').classList.remove('overloaded')
    const stateLines = this.run.itemRules.statusLines()
    this.q('buildstatus').innerHTML = stateLines.length ? stateLines.map(line => `<p>${escapeHtml(line)}</p>`).join('') : '<p>当前没有待用增益或次数效果。</p>'
    if (player.poisonedTurns > 0) hints.push(`${LABELS.poison} ${player.poisonedTurns}${LABELS.turn}`)
    if (player.burningTurns > 0) hints.push(`${LABELS.burning} ${player.burningTurns}${LABELS.turn}`)
    this.q('hint').textContent = hints.join(' · ')

    this._renderInitialRelicChoice()
    this._renderRoomReward()
    this._renderLevelUp()
    this._renderMerchant()
    this._renderBackpack()
    this._renderActions()
    this._renderDetailPanel()
    const logBody = this.q('logbody')
    logBody.innerHTML = this.run.log.slice(0, 40).map((line) => `<div class="line">${escapeHtml(line)}</div>`).join('')

    const over = this.q('over')
    over.classList.toggle('show', this.run.gameOver)
    over.classList.toggle('win', this.run.win)
    over.classList.toggle('lose', !this.run.win)
    this.q('overtitle').textContent = this.run.win ? LABELS.win : LABELS.lose
    this.q('overmessage').textContent = this.run.win ? LABELS.winMessage : LABELS.loseMessage
  }

  _renderCharacterPanel(player) {
    this.q('characterlevel').textContent = `Lv. ${player.level}`
    this.q('characterexperience').textContent = `${player.experience} / ${player.experienceToNext}`
    this.q('characterhealth').textContent = `${player.hp} / ${player.maxHp}`
    const progress = player.experienceToNext > 0 ? Math.min(100, Math.max(0, player.experience / player.experienceToNext * 100)) : 0
    this.q('characterexperiencebar').style.width = `${progress}%`
    this.q('charactertalents').innerHTML = `<section class="character-talent-summary"><div class="character-talent-title">${LABELS.talents}</div><div class="character-row"><span>${LABELS.talents}</span><strong>${player.talents?.length || 0}</strong></div><div class="character-row sub"><span>${LABELS.fixedGrowth}</span><strong>${player.talentRuntime?.bodyStrength || 0}</strong></div></section>`
    return
  }

  _renderCameraSettings() {
    const angles = this.scene?.cameraAngles?.()
    this.q('cameraazimuthvalue').textContent = '\u81ea\u52a8\uff08-15\u00b0 ~ 15\u00b0\uff09'
    this.q('camerapitchvalue').textContent = angles ? `${angles.pitch}\u00b0` : ''
  }

  _renderTalentPanel() {
    const graph = this.run.talentGraph()
    const owned = graph.filter((node) => node.state === 'owned').length
    this.q('talentcount').textContent = `${owned}/${graph.length}`
    const lines = [...new Set(graph.map((node) => node.line))]
    const names = new Map(graph.map((node) => [node.id, node.name]))
    this.q('talentgraph').innerHTML = lines.map((line) => {
      const nodes = graph.filter((node) => node.line === line)
      const lineTitle = TALENT_LINE_LABELS[line] || line
      return `<div class="talent-line" data-talent-line="${escapeHtml(line)}"><div class="talent-line-title">${escapeHtml(lineTitle)}</div>${nodes.map((node) => {
        const prerequisites = node.prerequisites.length
          ? `\u524d\u7f6e：${node.prerequisites.map((id) => names.get(id) || id).join('\u3001')}`
          : '\u524d\u7f6e：\u65e0'
        return `<div class="talent-node ${node.state}" title="${escapeHtml(`${node.description} · ${prerequisites}`)}"><span class="talent-node-slot">${escapeHtml(node.slot)}</span><b>${escapeHtml(node.name)}</b><small>${escapeHtml(node.description)}</small><small class="talent-node-prereq">${escapeHtml(prerequisites)}</small></div>`
      }).join('')}</div>`
    }).join('')
  }

  _renderInitialRelicChoice() {
    const choices = this.run.initialRelicChoices.map((id) => getRelicDefinition(id)).filter(Boolean)
    const panel = this.q('initialrelics')
    panel.classList.toggle('show', choices.length > 0 && this.run.relics.entries.length === 0)
    this.q('initialrelicrow').innerHTML = choices.map((definition) => (
      `<button class="relic-choice-card" data-relic-choice="${definition.id}"><span class="relic-name">${escapeHtml(definition.name)}</span><span class="relic-desc">${escapeHtml(definition.description)}</span></button>`
    )).join('')
  }

  _renderRoomReward() {
    const reward = this.run.roomReward
    const panel = this.q('roomreward')
    const open = this.run.phase === 'reward' && !!reward && !this.run.roomEntering
    panel.classList.toggle('show', open)
    if (!open) return
    this.q('roomrewardrow').innerHTML = reward.choices.map((choice, index) => {
      if (choice.kind === 'relic') {
        const definition = getRelicDefinition(choice.relicId)
        if (!definition) return ''
        const disabled = this.run.canFitRelic(choice.relicId) ? '' : ' disabled'
        return `<button class="relic-choice-card" data-room-reward="${index}"${disabled}><span class="relic-name">${escapeHtml(definition.name)}</span><span class="relic-desc">${escapeHtml(definition.description)}</span></button>`
      }
      if (choice.kind === 'item') {
        const definition = getItemDefinition(choice.itemId)
        if (!definition) return ''
        const detail = definition.type === 'weapon'
          ? `${WEAPON_CLASS_LABELS[definition.weaponClass] || LABELS.weaponClass} · ATK ${definition.attack} · R ${this.run.weaponRange(definition)} · ${LABELS.energy} ${this.run.weaponEnergyCost(definition)}`
          : definition.type === 'potion' ? `HP +${definition.heal}`
            : definition.type === 'armor' ? `${LABELS.armor} +${definition.armor}`
              : definition.type === 'energy' ? `${LABELS.energy} +${definition.energy}`
              : escapeHtml(definition.description || '')
        const item = { ...definition, uid: 'reward-preview' }
        const disabled = !this.run.backpack.canFit(item) ? ' disabled' : ''
        return `<button class="relic-choice-card" data-room-reward="${index}"${disabled}><span class="relic-name">${escapeHtml(definition.name)}</span><span class="relic-desc">${detail}</span></button>`
      }
      return `<button class="relic-choice-card" data-room-reward="${index}"><span class="relic-name">${LABELS.gold} +${choice.amount}</span></button>`
    }).join('')
  }

  _renderLevelUp() {
    const panel = this.q('levelup')
    const open = this.run.phase === 'level-up' && !!this.run.levelUp
    panel.classList.toggle('show', open)
    if (!open) return
    this.q('leveluptitle').textContent = LABELS.growthChoice
    const choices = this.run.levelUpChoices()
    const talents = choices.filter((choice) => !choice.fixed)
    const fixed = choices.find((choice) => choice.fixed)
    this.q('leveluprow').innerHTML = talents.map((choice) => {
      const branch = TALENT_LINE_LABELS[choice.line] || choice.line
      return `<button class="relic-choice-card talent-choice-card" data-level-up-choice="${choice.id}"><span class="talent-choice-head"><span class="relic-name">${escapeHtml(choice.name)}</span><span class="talent-choice-branch">${escapeHtml(branch)}</span></span><span class="relic-desc">${escapeHtml(choice.description)}</span></button>`
    }).join('')
    this.q('levelupfixed').innerHTML = fixed
      ? `<button class="relic-choice-card level-up-fixed-choice" data-level-up-choice="${fixed.id}"><span class="relic-name">${escapeHtml(fixed.name)}</span><span class="relic-desc">${escapeHtml(fixed.description)}</span></button>`
      : ''
  }

  _renderMerchant() {
    const panel = this.q('merchantpanel')
    const merchant = this.run.merchantEntity
    const open = this.run.phase === 'merchant' && !!merchant && !this.run.merchantEntering
    panel.classList.toggle('show', open)
    if (!open) return
    this.q('merchanttitle').textContent = merchant.name
    const services = merchant.services || this.run.merchantDefinition?.services || []
    const canBuy = services.includes('stock')
    const canRelics = services.includes('relic-choice')
    const availableTabs = [canBuy ? 'stock' : null, canRelics ? 'relics' : null].filter(Boolean)
    if (!availableTabs.includes(this.merchantTab)) this.merchantTab = availableTabs[0] || null
    const tabs = this.q('merchanttabs')
    tabs.hidden = availableTabs.length < 2
    tabs.innerHTML = availableTabs.map((tab) => `<button type="button" class="merchant-tab${this.merchantTab === tab ? ' active' : ''}" data-merchant-tab="${tab}" aria-selected="${this.merchantTab === tab}">${tab === 'stock' ? LABELS.buy : LABELS.merchantRelicsTab}</button>`).join('')
    const purchase = this.q('merchantpurchase')
    purchase.classList.toggle('show', this.merchantTab === 'stock')
    const stock = this.q('merchantstock')
    stock.innerHTML = (merchant.stock || []).map((entry, index) => {
      const definition = getItemDefinition(entry.itemId)
      if (!definition) return ''
      return `<button class="merchant-stock-item" data-merchant-stock="${index}"><b>${escapeHtml(definition.name)}</b><small>${LABELS.buy} ${entry.price}</small></button>`
    }).join('')
    const selected = this.run.selectedItem
    const refreshPrice = merchant.restockPrice || 0
    this.q('merchanttrade').innerHTML = `<button data-action="merchant-sell"${selected ? '' : ' disabled'}>${LABELS.sellSelected}${selected ? ` ${merchantSellText(selected)}` : ''}</button>${refreshPrice > 0 ? `<button data-action="merchant-refresh"${this.run.player.gold < refreshPrice ? ' disabled' : ''}>${LABELS.refreshStock} ${refreshPrice}</button>` : ''}`
    const relics = this.q('merchantrelics')
    relics.classList.toggle('show', this.merchantTab === 'relics')
    if (!canRelics) {
      relics.innerHTML = ''
      return
    }
    const offer = merchant.relicOfferResolved ? [] : (merchant.relicChoices || []).map((id) => getRelicDefinition(id)).filter(Boolean)
    const offerPrice = merchant.relicOfferPrice || 0
    const offerHtml = offer.length ? `<section class="merchant-relic-section merchant-relic-offer"><div class="merchant-relic-section-head"><div class="merchant-relic-title">${LABELS.relicChoice}</div></div><div class="merchant-relic-grid">${offer.map((definition) => (
      `<button class="merchant-relic-item${this.run.player.gold < offerPrice ? ' disabled' : ''}" data-merchant-relic-choice="${definition.id}" aria-disabled="${this.run.player.gold < offerPrice}"><b>${escapeHtml(definition.name)}</b><small>${escapeHtml(definition.description)} \u00b7 ${LABELS.buy} ${offerPrice}</small></button>`
    )).join('')}</div></section>` : ''
    relics.innerHTML = offerHtml || `<div class="merchant-relic-empty">${LABELS.noRelicsAvailable}</div>`
  }

  _renderBackpack() {
    const backpack = this.q('backpack')
    backpack.style.setProperty('--bag-columns', INVENTORY_COLUMNS)
    backpack.style.setProperty('--bag-rows', INVENTORY_ROWS)
    const selectedItem = this.run.selectedItem
    const relicOverloaded = this.run.relicOverload() > 0
    const cells = Array.from({ length: INVENTORY_COLUMNS * INVENTORY_ROWS }, (_, index) => {
      const placement = this.run.backpack.placementForCellIndex(index)
      const action = this.run.previewInventoryCellAction(index)
      const column = index % INVENTORY_COLUMNS + 1
      const row = Math.floor(index / INVENTORY_COLUMNS) + 1
      const classes = ['bag-cell']
      if (action === 'move') classes.push('drop-valid')
      if (placement?.item?.uid === selectedItem?.uid) classes.push('selected-cell')
      const label = placement?.item?.name || LABELS.empty
      return `<button class="${classes.join(' ')}" data-bag-cell="${index}" aria-label="${escapeHtml(label)}" style="grid-column:${column};grid-row:${row}"></button>`
    }).join('')
    const items = this.run.backpack.placements.map((placement) => {
      const item = placement.item
      const shape = this.run.backpack.shapeFor(item, placement.rotation)
      const originIndex = this.run.backpack.originIndex(placement)
      const selected = this.run.selectedInventoryIndex === originIndex
      const itemClasses = ['bag-item', item.type]
      const spriteSources = itemSpriteSources(item)
      if (spriteSources) itemClasses.push('has-sprite')
      if (item.type === 'relic' && relicOverloaded) itemClasses.push('overloaded')
      if (item.type === 'weapon' && item.attribute) itemClasses.push(`attribute-${item.attribute}`)
      if (selected) itemClasses.push('selected')
      const detail = item.type === 'weapon'
        ? `${WEAPON_CLASS_LABELS[item.weaponClass] || LABELS.weaponClass} · ATK ${item.attack} · R ${this.run.weaponRange(item)} · ${LABELS.energy} ${this.run.weaponEnergyCost(item)}`
        : item.type === 'potion' ? `HP +${item.heal}`
          : item.type === 'armor' ? `${LABELS.armor} +${item.armor}`
            : item.type === 'energy' ? `${LABELS.energy} +${item.energy}`
            : item.type === 'buff' ? `ATK +${item.attackBonus}`
              : item.type === 'defense' ? '防具'
                : item.type === 'material' ? '材料'
                : item.type === 'cleanse' ? '净化'
                : item.type === 'teleport' ? '换位'
              : item.type === 'relic' ? LABELS.relics
              : ''
      const layout = bagShapeLayout(shape)
      const shapeCells = layout.cells.map(({ x, y, edges }) => {
        const cellIndex = (placement.y + y) * INVENTORY_COLUMNS + placement.x + x
        const edgeMarks = edges.map((visible, index) => visible ? `<i class="shape-edge edge-${['top', 'right', 'bottom', 'left'][index]}" aria-hidden="true"></i>` : '').join('')
        return `<span class="occupied" data-bag-item="${cellIndex}" style="grid-column:${x + 1};grid-row:${y + 1};border-width:${edges.map(edge => edge ? '1px' : '0').join(' ')}">${edgeMarks}</span>`
      }).join('')
      const labelStyle = run => `grid-column:${run.x + 1} / span ${run.width};grid-row:${run.y + 1}`
      const labels = layout.name ? `<b class="bag-name" style="${labelStyle(layout.name)}">${escapeHtml(item.name)}</b><small class="bag-detail" style="${labelStyle(layout.detail)}">${escapeHtml(detail)}</small>` : ''
      const oddRotation = placement.rotation % 2 === 1
      const spriteWidth = oddRotation ? `${shape.length / shape[0].length * 100}%` : '100%'
      const spriteHeight = oddRotation ? `${shape[0].length / shape.length * 100}%` : '100%'
      // Make the sprite itself a reliable hit target. Its data index always
      // points at the first occupied cell, so transparent corners on L/T
      // shaped items cannot select a neighboring item.
       const sprite = spriteSources ? `<img class="bag-sprite" data-bag-item="${originIndex}" data-sprite-medium="${spriteSources.medium}" src="${spriteSources.small}" alt="" aria-hidden="true" decoding="async" fetchpriority="low" style="width:${spriteWidth};height:${spriteHeight};transform:translate(-50%,-50%) rotate(${placement.rotation * 90}deg)">` : ''
      return `<div class="${itemClasses.join(' ')}" style="grid-column:${placement.x + 1} / span ${shape[0].length};grid-row:${placement.y + 1} / span ${shape.length}"><span class="bag-shape" style="grid-template-columns:repeat(${shape[0].length},1fr);grid-template-rows:repeat(${shape.length},1fr)">${sprite}${shapeCells}${labels}</span></div>`
    }).join('')
    backpack.innerHTML = `${cells}${items}`
    this._upgradeBagSprites()
    const rotate = this.root.querySelector('[data-action="rotate-bag"]')
    const placement = selectedItem ? this.run.backpack.placementOf(selectedItem.uid) : null
    const selectedShape = placement && selectedItem ? this.run.backpack.shapeFor(selectedItem, placement.rotation) : null
    const rotatable = !!selectedShape && (selectedShape.length > 1 || selectedShape[0].length > 1)
    rotate.hidden = false
    rotate.classList.toggle('is-hidden', !rotatable)
    rotate.setAttribute('aria-hidden', rotatable ? 'false' : 'true')
    rotate.tabIndex = rotatable ? 0 : -1
    rotate.disabled = !rotatable
  }

  _upgradeBagSprites() {
    this.root.querySelectorAll('.bag-sprite[data-sprite-medium]').forEach((sprite) => {
       this._queueSpriteUpgrade(sprite, sprite.dataset.spriteMedium, '', 80)
    })
  }

  _queueSpriteUpgrade(sprite, url, nextUrl, delay) {
    if (!url || !sprite.isConnected) return
    const timer = window.setTimeout(() => {
      this._spriteUpgradeTimers.delete(timer)
      if (!sprite.isConnected) return
      const preloader = document.createElement('img')
      preloader.decoding = 'async'
      const applyUpgrade = async (loaded) => {
        if (loaded) {
          try {
            await preloader.decode?.()
          } catch {
            // The load event still gives us a usable decoded image in older browsers.
          }
          if (!sprite.isConnected) return
          sprite.src = url
        }
        if (nextUrl && sprite.isConnected) this._queueSpriteUpgrade(sprite, nextUrl, '', 160)
      }
      preloader.addEventListener('load', () => applyUpgrade(true), { once: true })
      preloader.addEventListener('error', () => applyUpgrade(false), { once: true })
      preloader.src = url
    }, delay)
    this._spriteUpgradeTimers.add(timer)
  }

  _renderActions() {
    const selected = this.run.selectedItem
    const discard = this.root.querySelector('[data-action="discard"]')
    const use = this.root.querySelector('[data-action="use"]')
    const usableItem = !!selected && ['potion', 'armor', 'energy', 'buff', 'cleanse', 'teleport'].includes(selected.type)
    const actionsAvailable = this.run.phase === 'explore' && !this.run.gameOver
    const setActionState = (button, visible, enabled) => {
      button.hidden = false
      button.classList.toggle('is-hidden', !visible)
      button.setAttribute('aria-hidden', visible ? 'false' : 'true')
      button.tabIndex = visible ? 0 : -1
      button.disabled = !enabled
    }
    setActionState(discard, actionsAvailable && !!selected, !!selected)
    setActionState(use, actionsAvailable && usableItem, usableItem)
  }

  _renderDetailPanel() {
    const detail = this.run.detailPanel
    const panel = this.q('detailpanel')
    const open = !!detail
    panel.classList.toggle('show', open)
    panel.setAttribute('aria-hidden', open ? 'false' : 'true')
    if (!open) return
    this.q('detailicon').textContent = DETAIL_ICONS[detail.icon] || DETAIL_ICONS.item
    this.q('detailtitle').textContent = detail.title || ''
    const badges = [detail.type, ...(detail.badges || [])].filter(Boolean)
    this.q('detailbadges').innerHTML = badges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join('')
    this.q('detaillines').innerHTML = (detail.lines || []).map((line) => `<div>${escapeHtml(line)}</div>`).join('')
    const description = this.q('detaildescription')
    description.textContent = detail.description || ''
    description.hidden = !detail.description
  }

  _renderCraft() {
    const panel = this.q('craftpanel')
    const available = this.run._canOrganizeBackpack() && !this.run.itemTargeting
    if (!available) this.craftOpen = false
    panel.hidden = !this.craftOpen
    const openButton = this.root.querySelector('[data-action="craft-open"]')
    openButton.disabled = !available
    if (!this.craftOpen) return
    const recipes = this.run.availableRecipes()
    const itemButton = id => `<button class="craft-item" data-craft-item="${id}">${escapeHtml(getItemDefinition(id).name)}</button>`
    this.q('craftrows').innerHTML = recipes.length ? recipes.map(r => `<div class="craft-row">${itemButton(r.a)}<span>+</span>${itemButton(r.b)}<span>=</span>${itemButton(r.result)}<button data-craft-result="${r.result}" ${r.canFit ? '' : 'disabled'}>${r.canFit ? '合成' : '空间不足'}</button></div>`).join('') : '<p>背包内暂无可合成方案。</p>'
  }

  _detailActionFor(target) {
    const formula = target.closest('[data-craft-item]')
    if (formula) return () => this.run.showItemDetail(getItemDefinition(formula.dataset.craftItem))
    const relic = target.closest('[data-relic-detail]')
    if (relic) return () => this.run.showRelicDetail(relic.dataset.relicDetail)
    const bagItem = target.closest('[data-bag-item]')
    if (bagItem) {
      const item = this.run.backpack.placementForCellIndex(Number(bagItem.dataset.bagItem))?.item
      return item ? () => this.run.showItemDetail(item) : null
    }
    const bagCell = target.closest('[data-bag-cell]')
    if (bagCell) {
      const item = this.run.backpack.placementForCellIndex(Number(bagCell.dataset.bagCell))?.item
      return item ? () => this.run.showItemDetail(item) : null
    }
    const inventory = target.closest('[data-slot]')
    if (inventory) {
      const item = this.run.backpack.placementForCellIndex(Number(inventory.dataset.slot))?.item
      return item ? () => this.run.showItemDetail(item) : null
    }
    const merchantStock = target.closest('[data-merchant-stock]')
    if (merchantStock) {
      const entry = this.run.merchantEntity?.stock?.[Number(merchantStock.dataset.merchantStock)]
      const definition = getItemDefinition(entry?.itemId)
      if (definition) {
        const preview = { ...definition, uid: `merchant-preview-${definition.id}` }
        return () => this.run.showItemDetail(preview)
      }
    }
    const merchantRelicChoice = target.closest('[data-merchant-relic-choice]')
    if (merchantRelicChoice) return () => this.run.showRelicDetail(merchantRelicChoice.dataset.merchantRelicChoice)
    return null
  }

  _handlePointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return
    const openDetail = this._detailActionFor(event.target)
    if (!openDetail) return
    const hold = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      opened: false,
      timer: null,
    }
    hold.timer = window.setTimeout(() => {
      if (this.hold !== hold) return
      hold.opened = openDetail()
    }, 420)
    this.hold = hold
  }

  _handlePointerMove(event) {
    const hold = this.hold
    if (!hold || hold.pointerId !== event.pointerId || hold.opened) return
    if (Math.abs(event.clientX - hold.x) + Math.abs(event.clientY - hold.y) <= 8) return
    window.clearTimeout(hold.timer)
    this.hold = null
  }

  _handlePointerUp(event) {
    const hold = this.hold
    if (!hold || hold.pointerId !== event.pointerId) return
    window.clearTimeout(hold.timer)
    this.hold = null
    if (!hold.opened) return
    this.run.closeDetail()
    this.ignoreClicksUntil = Date.now() + 120
  }

  _handleClick(event) {
    if (Date.now() < (this.ignoreClicksUntil || 0)) return
    const craft = event.target.closest('[data-craft-result]')
    if (craft) { this.run.craft(craft.dataset.craftResult); this._renderCraft(); return }
    const merchantTab = event.target.closest('[data-merchant-tab]')
    if (merchantTab) {
      this.merchantTab = merchantTab.dataset.merchantTab
      this.render()
      return
    }
    const levelChoice = event.target.closest('[data-level-up-choice]')
    if (levelChoice) {
      this.run.chooseLevelUpOption(levelChoice.dataset.levelUpChoice)
      return
    }
    const roomReward = event.target.closest('[data-room-reward]')
    if (roomReward) {
      this.run.chooseRoomReward(Number(roomReward.dataset.roomReward))
      return
    }
    const relicChoice = event.target.closest('[data-relic-choice]')
    if (relicChoice) {
      this.run.chooseInitialRelic(relicChoice.dataset.relicChoice)
      return
    }
    const merchantStock = event.target.closest('[data-merchant-stock]')
    if (merchantStock) {
      this.run.buyMerchantItem(Number(merchantStock.dataset.merchantStock))
      return
    }
    const merchantRelicChoice = event.target.closest('[data-merchant-relic-choice]')
    if (merchantRelicChoice) {
      if (merchantRelicChoice.getAttribute('aria-disabled') === 'true') return
      this.run.chooseMerchantRelic(merchantRelicChoice.dataset.merchantRelicChoice)
      return
    }
    const bagItem = event.target.closest('[data-bag-item]')
    if (bagItem) {
      const index = Number(bagItem.dataset.bagItem)
      if (this.run.itemTargeting) {
        const item = this.run.backpack.placementForCellIndex(index)?.item
        if (item?.type === 'weapon') this.run.clearSelection()
        else this.run.clearSelection()
      } else {
        this.run.clickInventoryCell(index)
      }
      return
    }
    const bagCell = event.target.closest('[data-bag-cell]')
    if (bagCell) {
      const index = Number(bagCell.dataset.bagCell)
      if (this.run.itemTargeting) {
        const item = this.run.backpack.placementForCellIndex(index)?.item
        if (item?.type === 'weapon') this.run.clearSelection()
        else this.run.clearSelection()
      } else {
        this.run.clickInventoryCell(index)
      }
      return
    }
    const action = event.target.closest('[data-action]')?.dataset.action
    if (!action) return
    if (action === 'copy-log') {
      void this._copyLog()
      return
    }
    if (action === 'build-status') { this.q('buildstatuspanel').hidden = !this.q('buildstatuspanel').hidden; return }
    if (action === 'build-status-close') { this.q('buildstatuspanel').hidden = true; return }
    if (action === 'craft-open') { this.craftOpen = true; this._renderCraft(); return }
    if (action === 'craft-close') { this.craftOpen = false; this._renderCraft(); return }
    if (action === 'use') this.run.useSelected()
    if (action === 'discard') this.run.discardSelected()
    if (action === 'rotate-bag') this.run.rotateSelectedInventory()
    if (action === 'camera-pitch-minus') {
      this.scene?.adjustCameraPitch(-1)
      this._renderCameraSettings()
    }
    if (action === 'camera-pitch-plus') {
      this.scene?.adjustCameraPitch(1)
      this._renderCameraSettings()
    }
    if (action === 'restart') {
      this.run.clearSave()
      this.run.reset()
    }
    if (action === 'restart-settings') {
      if (!window.confirm(LABELS.restartConfirm)) return
      this.run.clearSave()
      this.run.reset()
      this.q('settings').classList.remove('show')
    }
    if (action === 'close-merchant') this.run.closeMerchant()
    if (action === 'merchant-sell') this.run.sellSelectedMerchantItem()
    if (action === 'merchant-refresh') this.run.refreshMerchantInventory()
    if (action === 'skip-room-reward') this.run.skipRoomReward()
    if (action === 'close-detail') this.run.closeDetail()
    if (action === 'log') this._toggleTopPanel('log')
    if (action === 'settings') this._toggleTopPanel('settings')
    if (action === 'character') this._toggleTopPanel('characterpanel')
    if (action === 'talents') this._toggleTopPanel('talentpanel')
    if (action === 'help') this._setHelpModal(true)
    if (action === 'close-help') this._setHelpModal(false)
  }

  async _copyLog() {
    const text = this.run.log.slice(0, 40).join('\n')
    if (!text) return
    let copied = false
    try {
      const clipboard = globalThis.navigator?.clipboard
      if (clipboard?.writeText) {
        await clipboard.writeText(text)
        copied = true
      }
    } catch {
      copied = false
    }
    if (!copied) {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      try { copied = document.execCommand('copy') } catch { copied = false }
      textarea.remove()
    }
    const button = this.q('logcopy')
    if (!button?.isConnected) return
    button.textContent = copied ? LABELS.copied : LABELS.copyFailed
    if (this.logCopyTimer) window.clearTimeout(this.logCopyTimer)
    this.logCopyTimer = window.setTimeout(() => {
      if (button.isConnected) button.textContent = LABELS.copyLog
    }, 1600)
  }

  _setHelpModal(show) {
    const modal = this.q('helpmodal')
    if (!modal) return
    if (show) {
      this.helpReturnFocus = document.activeElement?.focus ? document.activeElement : null
      for (const key of ['settings', 'log', 'characterpanel', 'talentpanel']) this.q(key).classList.remove('show')
      this.q('characterpanel').setAttribute('aria-hidden', 'true')
      this.q('talentpanel').setAttribute('aria-hidden', 'true')
    }
    modal.classList.toggle('show', show)
    modal.setAttribute('aria-hidden', show ? 'false' : 'true')
    if (show) {
      window.requestAnimationFrame(() => this.q('helpclose')?.focus())
      return
    }
    const focusTarget = this.helpReturnFocus
    this.helpReturnFocus = null
    if (focusTarget?.isConnected) focusTarget.focus()
  }

  _toggleTopPanel(panelKey) {
    const panel = this.q(panelKey)
    const open = !panel.classList.contains('show')
    for (const key of ['settings', 'log', 'characterpanel', 'talentpanel']) this.q(key).classList.remove('show')
    panel.classList.toggle('show', open)
    this.q('characterpanel').setAttribute('aria-hidden', panelKey === 'characterpanel' && open ? 'false' : 'true')
    this.q('talentpanel').setAttribute('aria-hidden', panelKey === 'talentpanel' && open ? 'false' : 'true')
  }

  dispose() {
    this.unsubscribe?.()
    this.detailUnsubscribe?.()
    for (const timer of this._spriteUpgradeTimers) window.clearTimeout(timer)
    this._spriteUpgradeTimers.clear()
    if (this.hold?.timer) window.clearTimeout(this.hold.timer)
    if (this.logCopyTimer) window.clearTimeout(this.logCopyTimer)
    this.root.removeEventListener('click', this._onClick)
    this.root.removeEventListener('pointerdown', this._onPointerDown)
    this.root.removeEventListener('pointermove', this._onPointerMove)
    this.root.removeEventListener('pointerup', this._onPointerUp)
    this.root.removeEventListener('pointercancel', this._onPointerUp)
    this.root.removeEventListener('contextmenu', this._onContextMenu)
    document.removeEventListener('keydown', this._onKeyDown)
  }
}
