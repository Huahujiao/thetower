import { EQUIPMENT_SLOTS, INVENTORY_COLUMNS, INVENTORY_ROWS } from '../game/run.js'
import { getItemDefinition } from '../game/data/content.js'
import { attributeLabel } from '../game/data/attributes.js'
import { getRelicDefinition } from '../game/data/relics.js'
import { merchantSellPrice } from '../game/data/merchants.js'
import { masteryPreservationChance } from '../game/data/progression.js'

const LABELS = Object.freeze({
  floor: '\u697c\u5c42',
  health: '\u751f\u547d',
  armor: '\u62a4\u7532',
  gold: '\u91d1\u5e01',
  turn: '\u56de\u5408',
  level: '\u7b49\u7ea7',
  experience: '\u7ecf\u9a8c',
  character: '\u89d2\u8272',
  characterGrowth: '\u89d2\u8272\u6210\u957f',
  maxHealth: '\u751f\u547d\u4e0a\u9650',
  strength: '\u529b\u91cf',
  mastery: '\u638c\u63a7',
  adaptation: '\u5c5e\u6027\u9002\u5e94',
  durabilityPreserve: '\u8010\u4e45\u4fdd\u7559',
  notAdapted: '\u672a\u9002\u5e94',
  help: '\u5e2e\u52a9',
  basicGameplay: '\u57fa\u672c\u73a9\u6cd5',
  close: '\u5173\u95ed',
  settings: '\u8bbe\u7f6e',
  log: '\u65e5\u5fd7',
  reveal: '\u8c03\u8bd5\uff1a\u663e\u793a\u724c\u5185\u5bb9',
  discard: '\u4e22\u5f03',
  unequip: '\u5378\u4e0b',
  rotate: '\u65cb\u8f6c',
  equip: '\u88c5\u5907',
  use: '\u4f7f\u7528',
  empty: '\u7a7a',
  equipment: '\u5f53\u524d\u88c5\u5907',
  leftHand: '\u5de6\u624b',
  rightHand: '\u53f3\u624b',
  durability: '\u8010\u4e45',
  nextAttack: '\u4e0b\u6b21\u653b\u51fb',
  nextMeleeAttack: '\u4e0b\u6b21\u8fd1\u6218\u653b\u51fb',
  relicBook: '\u6253\u5f00\u5723\u9057\u7269\u56fe\u9274',
  relics: '\u5723\u9057\u7269\u56fe\u9274',
  collected: '\u5df2\u6536\u96c6',
  active: '\u5df2\u6fc0\u6d3b',
  inactive: '\u672a\u6fc0\u6d3b',
  initialRelic: '\u9009\u62e9\u521d\u59cb\u5723\u9057\u7269',
  leaveMerchant: '\u79bb\u5f00',
  sold: '\u5df2\u552e\u7f44',
  buy: '\u8d2d\u4e70',
  relicManagement: '\u5723\u9057\u7269\u6fc0\u6d3b',
  merchantRelicsTab: '\u5723\u9057\u7269\u914d\u7f6e',
  relicLoadout: '\u914d\u7f6e\u8349\u6848',
  relicLoadoutHint: '\u70b9\u51fb\u8c03\u6574\u914d\u7f6e\uff0c\u70b9\u51fb\u786e\u8ba4\u540e\u624d\u751f\u6548',
  current: '\u5f53\u524d',
  pending: '\u5f85\u786e\u8ba4',
  relicChoice: '\u9009\u62e9\u4e00\u4ef6\u5723\u9057\u7269',
  roomReward: '\u65b0\u623f\u95f4\u5956\u52b1',
  growthChoice: '\u9009\u62e9\u6210\u957f',
  adaptationChoice: '\u9009\u62e9\u5c5e\u6027\u9002\u5e94',
  skipReward: '\u8df3\u8fc7',
  sellSelected: '\u51fa\u552e\u6240\u9009',
  refreshStock: '\u5237\u65b0\u8d27\u67b6',
  confirmRelics: '\u786e\u8ba4\u5723\u9057\u7269\u914d\u7f6e',
  relicsLocked: '\u5723\u9057\u7269\u914d\u7f6e\u5df2\u786e\u8ba4',
  twoHanded: '\u53cc\u624b',
  occupied: '\u5df2\u5360\u7528',
  activeSkill: '\u4e3b\u52a8\u6280\u80fd',
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
  buff: '\u2726',
  whetstone: '\u25c8',
  relic: '\u25c6',
  trap: '!',
  gold: '\u25cf',
  key: '\ud83d\udd11',
  merchant: '\u25c9',
  item: '\u25a0',
})

const HELP_SECTIONS = Object.freeze([
  { title: '\u76ee\u6807\u4e0e\u80dc\u5229', items: ['\u7a7f\u8fc7\u4e94\u5c42\u623f\u95f4\uff0c\u51fb\u8d25\u7b2c\u4e94\u5c42\u7684\u76d1\u89c6\u8005\u5373\u53ef\u83b7\u80dc\u3002', '\u6bcf\u4e2a\u65b0\u623f\u95f4\u9996\u6b21\u8fdb\u5165\u4f1a\u63d0\u4f9b\u8865\u7ed9\u6216\u5723\u9057\u7269\u5956\u52b1\uff1b\u901a\u8fc7\u95e8\u7ee7\u7eed\u524d\u8fdb\u3002'] },
  { title: '\u63a2\u7d22\u4e0e\u7ffb\u724c', items: ['\u5728\u5df2\u7ffb\u5f00\u7684\u724c\u4e2d\u53ef\u516b\u65b9\u5411\u79fb\u52a8\u3002\u70b9\u51fb\u89d2\u8272\u516b\u90bb\u57df\u76ee\u6807\u4f1a\u76f4\u63a5\u6267\u884c\uff1b\u8fdc\u5904\u76ee\u6807\u5148\u9884\u89c8\uff0c\u518d\u70b9\u51fb\u540c\u4e00\u683c\u786e\u8ba4\u3002', '\u7ffb\u672a\u77e5\u724c\u65f6\uff0c\u89d2\u8272\u4f1a\u5148\u8d70\u5230\u76ee\u6807\u516b\u90bb\u57df\u7684\u53ef\u8fbe\u7a7a\u683c\uff1b\u7ffb\u724c\u672c\u8eab\u4e0d\u8e0f\u5165\u8be5\u683c\u3002\u653b\u51fb\u3001\u7ffb\u724c\u548c\u4ea4\u4e92\u9884\u89c8\u4f1a\u663e\u793a\u5230\u8fbe\u4f4d\u7f6e\u4e0e\u76ee\u6807\u5f27\u7ebf\u3002'] },
  { title: '\u6218\u6597\u4e0e\u654c\u4eba', items: ['\u653b\u51fb\u76ee\u6807\u65f6\uff0c\u89d2\u8272\u4f1a\u79fb\u52a8\u81f3\u5f53\u524d\u6b66\u5668\u80fd\u547d\u4e2d\u7684\u4f4d\u7f6e\uff0c\u518d\u6309\u88c5\u5907\u987a\u5e8f\u653b\u51fb\u3002\u6b66\u5668\u8010\u4e45\u964d\u4e3a\u96f6\u4f1a\u635f\u6bc1\u3002', '\u654c\u4eba\u7ffb\u5f00\u540e\u6309\u884c\u52a8\u5ef6\u8fdf\u3001\u666e\u901a\u653b\u51fb\u51b7\u5374\u548c\u4e3b\u52a8\u6280\u80fd\u51b7\u5374\u884c\u52a8\u3002\u4e3b\u52a8\u6280\u80fd\u4f18\u5148\u4e8e\u666e\u901a\u653b\u51fb\uff1b\u8ffd\u730e\u654c\u4eba\u53ef\u79fb\u52a8\u540e\u653b\u51fb\u3002'] },
  { title: '\u88c5\u5907\u3001\u6210\u957f\u4e0e\u80cc\u5305', items: ['\u80cc\u5305\u4e3a\u4e94\u884c\u4e94\u5217\uff1b\u7269\u54c1\u6309\u5f62\u72b6\u5360\u683c\uff0c\u53ef\u65cb\u8f6c\u3002\u88c5\u5907\u6b66\u5668\u3001\u4f7f\u7528\u78e8\u5200\u77f3\u548c\u7269\u54c1\u4f1a\u5f71\u54cd\u63a5\u4e0b\u6765\u7684\u6218\u6597\u3002', '\u51fb\u6740\u81ea\u7136\u654c\u4eba\u83b7\u5f97\u7ecf\u9a8c\u3002\u53f3\u4e0a\u89d2\u8272\u6309\u94ae\u53ef\u67e5\u770b\u7b49\u7ea7\u3001\u5de6\u53f3\u624b\u529b\u91cf\u3001\u638c\u63a7\u4e0e\u5c5e\u6027\u9002\u5e94\u3002'] },
  { title: '\u5723\u9057\u7269\u4e0e\u4fe1\u606f', items: ['\u5f00\u5c40\u3001\u623f\u95f4\u5956\u52b1\u3001\u6536\u85cf\u5bb6\u548c\u602a\u7269\u6389\u843d\u90fd\u53ef\u80fd\u83b7\u5f97\u5723\u9057\u7269\uff1b\u540c\u65f6\u6700\u591a\u6fc0\u6d3b\u4e94\u4ef6\u3002', '\u957f\u6309\u68cb\u76d8\u5bf9\u8c61\u53ef\u67e5\u770b\u8be6\u60c5\uff1b\u7ecf\u9a8c\u884c\u53f3\u4fa7\u7684\u5723\u9057\u7269\u56fe\u6807\u53ef\u67e5\u770b\u5df2\u83b7\u5f97\u7684\u5723\u9057\u7269\uff1b\u53f3\u4e0a\u65e5\u5fd7\u53ef\u56de\u770b\u4e8b\u4ef6\u3002'] },
  { title: '\u5feb\u6377\u63d0\u793a', items: ['\u7ea2\u8272\u8def\u5f84\u8868\u793a\u4f1a\u7ecf\u8fc7\u5df2\u7ffb\u5f00\u654c\u4eba\u7684\u5a01\u80c1\u8303\u56f4\uff1b\u84dd\u8272\u8def\u5f84\u8868\u793a\u5f53\u524d\u5df2\u77e5\u5b89\u5168\u3002', '\u4e0d\u53ef\u7ffb\u724c\u6bd4\u53ef\u7ffb\u724c\u66f4\u6697\u3002\u534a\u900f\u660e\u5361\u724c\u53ea\u662f\u88ab\u7aa5\u89c6\uff0c\u5c1a\u672a\u7ffb\u5f00\u3002'] },
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
    this._build()
    this._onClick = (event) => this._handleClick(event)
    this._onPointerDown = (event) => this._handlePointerDown(event)
    this._onPointerMove = (event) => this._handlePointerMove(event)
    this._onPointerUp = (event) => this._handlePointerUp(event)
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
    document.addEventListener('keydown', this._onKeyDown)
    this.unsubscribe = this.run.on('change', () => this.render())
    this.detailUnsubscribe = this.run.on('detail', () => this.render())
    this.render()
  }

  _build() {
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-stats">
          <div class="stat floor"><span class="label">${LABELS.floor}</span><span class="value" data=floor></span></div>
          <div class="stat turn"><span class="label">${LABELS.turn}</span><span class="value" data=turn></span></div>
          <div class="stat level"><span class="label">${LABELS.level}</span><span class="value" data=level></span></div>
          <div class="stat gold"><span class="label">${LABELS.gold}</span><span class="value" data=gold></span></div>
        </div>
        <div class="hud-btns">
          <button class="hud-icon relic-book-top" data-action="relics" title="${LABELS.relicBook}" aria-label="${LABELS.relicBook}">\u25a6</button>
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
        <button class="settings-restart" data-action="restart-settings">${LABELS.restart}</button>
      </div>

      <section class="character-panel" data=characterpanel aria-hidden="true">
        <div class="character-panel-head"><span>${LABELS.characterGrowth}</span><strong data=characterlevel></strong></div>
        <div class="character-summary">
          <div class="character-stat"><span>${LABELS.experience}</span><strong data=characterexperience></strong></div>
          <div class="character-stat"><span>${LABELS.maxHealth}</span><strong data=characterhealth></strong></div>
        </div>
        <div class="character-expbar" aria-hidden="true"><span data=characterexperiencebar></span></div>
        <div class="character-hands" data=characterhands></div>
      </section>

      <div class="hud-log" data=log>
        <div class="log-head"><span class="log-title">${LABELS.log}</span></div>
        <div class="log-body" data=logbody></div>
      </div>

      <div class="relic-collection-modal" data=relicmodal aria-hidden="true">
        <div class="relic-modal-backdrop" data-action="close-relics"></div>
        <section class="relic-modal-panel" role="dialog" aria-modal="true" aria-label="${LABELS.relics}">
          <div class="relic-modal-head">
            <span>${LABELS.relics}</span><span class="relic-modal-count" data=reliccount></span>
            <button class="relic-modal-close" data-action="close-relics" aria-label="close">\u00d7</button>
          </div>
          <div class="relic-collection" data=reliccollection></div>
        </section>
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
        <div class="relic-choice-row" data=leveluprow></div>
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

      <div class="hud-active-skills relic-skills" data=relicskills></div>

      <div class="hud-bottom">
        <section class="backpack-panel">
          <div class="relic-slots" data=relicslots></div>
          <div class="backpack-grid" data=backpack></div>
        </section>
        <aside class="vital-strip" aria-label="${LABELS.health} ${LABELS.armor}">
          <button class="bag-rotate" data-action="rotate-bag" title="${LABELS.rotate}" aria-label="${LABELS.rotate}" hidden>\u21bb</button>
          <div class="vital-armor" title="${LABELS.armor}"><strong data=armorstrip></strong></div>
          <div class="vital-health" title="${LABELS.health}"><span class="vital-health-fill" data=healthfill></span><strong data=hpstrip></strong></div>
        </aside>
        <section class="loadout-panel">
          <div class="card-actions" data=actions>
            <button class="act-use" data-action="use">${LABELS.use}</button>
            <button class="act-unequip" data-action="unequip">${LABELS.unequip}</button>
          </div>
          <div class="equip-row">
            <button class="equip-slot" data-equip-slot="0"></button>
            <button class="equip-slot" data-equip-slot="1"></button>
          </div>
          <button class="act-drop loadout-discard" data-action="discard">${LABELS.discard}</button>
        </section>
      </div>

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

  render() {
    const { player } = this.run
    const room = this.run.currentRoom
    this.q('floor').textContent = room ? String(room.floor) : ''
    this.q('hpstrip').textContent = `${player.hp}/${player.maxHp}`
    this.q('armorstrip').textContent = String(player.armor)
    this.q('healthfill').style.height = `${Math.max(0, Math.min(100, player.hp / Math.max(1, player.maxHp) * 100))}%`
    this.q('gold').textContent = String(player.gold)
    this.q('turn').textContent = String(this.run.turn)
    this.q('level').textContent = String(player.level)
    this.q('experiencevalue').textContent = `${player.experience}/${player.experienceToNext}`
    const experienceProgress = player.experienceToNext > 0 ? Math.min(100, Math.max(0, player.experience / player.experienceToNext * 100)) : 0
    this.q('experiencefill').style.width = `${experienceProgress}%`
    this._renderCharacterPanel(player)
    const pendingBuffs = player.pendingAttackBuffs || []
    const isMeleeOnly = pendingBuffs.length > 0 && pendingBuffs.every((buff) => buff.target === 'melee')
    this.q('hint').textContent = player.pendingAttackBonus ? `${isMeleeOnly ? LABELS.nextMeleeAttack : LABELS.nextAttack} +${player.pendingAttackBonus}` : ''

    const equipSlots = this.root.querySelectorAll('[data-equip-slot]')
    for (let slot = 0; slot < EQUIPMENT_SLOTS; slot++) {
      const equipSlot = equipSlots[slot]
      if (!equipSlot) continue
      const weapon = player.equipment[slot]
      const growth = weapon ? this.run.weaponGrowth(weapon) : null
      const side = slot === 0 ? LABELS.leftHand : LABELS.rightHand
      const occupiedByTwoHanded = slot === 0 && weapon && player.equipment[1]?.uid === weapon.uid && weapon.grip === 'two'
      equipSlot.classList.toggle('filled', !!weapon && !occupiedByTwoHanded)
      equipSlot.classList.toggle('occupied', occupiedByTwoHanded)
      equipSlot.classList.toggle('armed', this.run.selectedEquipmentSlot === slot)
      equipSlot.classList.toggle('target', this.run.itemTargeting && !!weapon)
      equipSlot.disabled = occupiedByTwoHanded
      equipSlot.innerHTML = occupiedByTwoHanded
        ? `<div class="sub">${side} \u00b7 ${LABELS.occupied}</div>`
        : weapon
          ? `<div class="nm">${escapeHtml(weapon.name)}</div><div class="sub">${weapon.grip === 'two' ? LABELS.twoHanded : side} \u00b7 ATK ${weapon.attack}${growth?.strength ? `+${growth.strength}` : ''} \u00b7 R ${weapon.range}</div><div class="sub">${LABELS.durability} ${weapon.durability}${growth?.mastery ? ` \u00b7 M ${growth.mastery}` : ''}</div>`
        : `<div class="sub">${side} \u00b7 ${LABELS.empty}</div>`
    }

    this._renderRelics()
    this._renderInitialRelicChoice()
    this._renderRoomReward()
    this._renderLevelUp()
    this._renderMerchant()
    this._renderBackpack()
    this._renderActions()
    this._renderRelicSkills()
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

  _renderRelics() {
    const entries = this.run.relics.entries
    const slots = this.q('relicslots')
    slots.innerHTML = ''
    for (let index = 0; index < this.run.relics.maxActive; index++) {
      const entry = this.run.relics.active[index]
      const definition = entry ? getRelicDefinition(entry.id) : null
      const slot = document.createElement('div')
      slot.className = `relic-slot ${definition ? 'active' : 'empty'}`
      slot.title = definition ? `${definition.name}\uff1a${definition.description}` : LABELS.empty
      slot.textContent = definition ? definition.name.slice(0, 4) : '\u00b7'
      if (definition) slot.dataset.relicDetail = definition.id
      slots.appendChild(slot)
    }
    this.q('reliccount').textContent = `${LABELS.collected} ${entries.length}`
    const collection = this.q('reliccollection')
    collection.innerHTML = entries.map((entry) => {
      const definition = getRelicDefinition(entry.id)
      if (!definition) return ''
      const state = entry.active ? LABELS.active : LABELS.inactive
      return `<div class="relic-collection-item ${entry.active ? 'active' : 'inactive'}"><span class="relic-item-name">${escapeHtml(definition.name)}</span><small>${state}</small><span class="relic-item-desc">${escapeHtml(definition.description)}</span></div>`
    }).join('')
  }

  _renderCharacterPanel(player) {
    this.q('characterlevel').textContent = `Lv. ${player.level}`
    this.q('characterexperience').textContent = `${player.experience} / ${player.experienceToNext}`
    this.q('characterhealth').textContent = `${player.hp} / ${player.maxHp}`
    const progress = player.experienceToNext > 0 ? Math.min(100, Math.max(0, player.experience / player.experienceToNext * 100)) : 0
    this.q('characterexperiencebar').style.width = `${progress}%`
    this.q('characterhands').innerHTML = [0, 1].map((hand) => {
      const strength = Math.max(0, Number(player.strength?.[hand]) || 0)
      const mastery = Math.max(0, Number(player.mastery?.[hand]) || 0)
      const adaptation = player.adaptations?.[hand] ? attributeLabel(player.adaptations[hand]) : LABELS.notAdapted
      const preservation = Math.round(masteryPreservationChance(mastery) * 100)
      const handLabel = hand === 0 ? LABELS.leftHand : LABELS.rightHand
      return `<section class="character-hand"><div class="character-hand-title">${handLabel}</div><div class="character-row"><span>${LABELS.strength}</span><strong>+${strength}</strong></div><div class="character-row"><span>${LABELS.mastery}</span><strong>${mastery}</strong></div><div class="character-row sub"><span>${LABELS.durabilityPreserve}</span><strong>${preservation}%</strong></div><div class="character-adaptation"><span>${LABELS.adaptation}</span><strong>${escapeHtml(adaptation)}</strong></div></section>`
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
        return `<button class="relic-choice-card" data-room-reward="${index}"><span class="relic-name">${escapeHtml(definition.name)}</span><span class="relic-desc">${escapeHtml(definition.description)}</span></button>`
      }
      if (choice.kind === 'item') {
        const definition = getItemDefinition(choice.itemId)
        if (!definition) return ''
        const detail = definition.type === 'weapon'
          ? `ATK ${definition.attack} \u00b7 R ${definition.range} \u00b7 ${LABELS.durability} ${definition.durability}`
          : definition.type === 'potion' ? `HP +${definition.heal}`
            : definition.type === 'armor' ? `${LABELS.armor} +${definition.armor}`
              : definition.type === 'whetstone' ? `${LABELS.durability} +${definition.repair}`
                : `ATK +${definition.attackBonus}`
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
    const selectingAdaptation = this.run.levelUp.adaptationHand != null
    this.q('leveluptitle').textContent = selectingAdaptation ? LABELS.adaptationChoice : LABELS.growthChoice
    this.q('leveluprow').innerHTML = this.run.levelUpChoices().map((choice) => (
      `<button class="relic-choice-card" ${selectingAdaptation ? `data-adaptation-choice="${choice.id}"` : `data-level-up-choice="${choice.id}"`}><span class="relic-name">${escapeHtml(choice.name)}</span><span class="relic-desc">${escapeHtml(choice.description)}</span></button>`
    )).join('')
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
    const canRelics = services.includes('relic-management') || services.includes('relic-choice')
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
    const selected = this.run.selectedItem || this.run.selectedEquipment
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
    if (!this.run.canManageRelics()) {
      relics.innerHTML = `${offerHtml}<div class="merchant-relic-locked">${LABELS.relicsLocked}</div>`
      return
    }
    const draftIds = new Set(this.run.relicLoadoutDraftIds())
    relics.innerHTML = `${offerHtml}<section class="merchant-relic-section merchant-relic-loadout"><div class="merchant-relic-section-head"><div><div class="merchant-relic-title">${LABELS.relicLoadout}</div><small class="merchant-relic-hint">${LABELS.relicLoadoutHint}</small></div><strong class="merchant-relic-capacity">${draftIds.size}/${this.run.relics.maxActive}</strong></div><div class="merchant-relic-grid">${this.run.relics.entries.map((entry) => {
      const definition = getRelicDefinition(entry.id)
      if (!definition) return ''
      const draftActive = draftIds.has(entry.id)
      const changed = draftActive !== entry.active
      const state = draftActive ? LABELS.active : LABELS.inactive
      return `<button class="merchant-relic-item ${draftActive ? 'draft-active' : 'draft-inactive'}${changed ? ' pending' : ''}" data-merchant-relic="${entry.id}" aria-pressed="${draftActive}"><b>${escapeHtml(definition.name)}</b><small>${state} \u00b7 ${changed ? LABELS.pending : LABELS.current}</small></button>`
    }).join('')}</div><button class="merchant-relic-confirm" data-action="confirm-relic-loadout"><b>${LABELS.confirmRelics}</b><small>${LABELS.relicLoadoutHint}</small></button></section>`
  }

  _renderBackpack() {
    const backpack = this.q('backpack')
    backpack.style.setProperty('--bag-columns', INVENTORY_COLUMNS)
    backpack.style.setProperty('--bag-rows', INVENTORY_ROWS)
    const selectedItem = this.run.selectedItem
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
      const detail = item.type === 'weapon'
        ? `ATK ${item.attack} \u00b7 R ${item.range} \u00b7 ${LABELS.durability} ${item.durability}`
        : item.type === 'potion' ? `HP +${item.heal}`
          : item.type === 'armor' ? `${LABELS.armor} +${item.armor}`
            : item.type === 'buff' ? `ATK +${item.attackBonus}`
              : item.type === 'whetstone' ? `${LABELS.durability} +${item.repair}` : ''
      let firstFilled = true
      const shapeCells = shape.flat().map((filled, shapeIndex) => {
        if (!filled) return '<span class="void"></span>'
        const cellColumn = shapeIndex % shape[0].length
        const cellRow = Math.floor(shapeIndex / shape[0].length)
        const cellIndex = (placement.y + cellRow) * INVENTORY_COLUMNS + placement.x + cellColumn
        const name = firstFilled ? `<b>${escapeHtml(item.name)}</b>` : ''
        firstFilled = false
        return `<span class="occupied" data-bag-item="${cellIndex}">${name}</span>`
      }).join('')
      return `<div class="bag-item ${item.type}${selected ? ' selected' : ''}" style="grid-column:${placement.x + 1} / span ${shape[0].length};grid-row:${placement.y + 1} / span ${shape.length}"><span class="bag-shape" style="grid-template-columns:repeat(${shape[0].length},1fr);grid-template-rows:repeat(${shape.length},1fr)">${shapeCells}</span><span class="bag-details"><small>${detail}</small></span></div>`
    }).join('')
    backpack.innerHTML = `${cells}${items}`
    const rotate = this.root.querySelector('[data-action="rotate-bag"]')
    const placement = selectedItem ? this.run.backpack.placementOf(selectedItem.uid) : null
    const selectedShape = placement && selectedItem ? this.run.backpack.shapeFor(selectedItem, placement.rotation) : null
    const rotatable = !!selectedShape && (selectedShape.length > 1 || selectedShape[0].length > 1)
    rotate.hidden = !rotatable
    rotate.disabled = !rotatable
  }

  _renderActions() {
    const selected = this.run.selectedItem
    const actions = this.q('actions')
    const discard = this.root.querySelector('[data-action="discard"]')
    const use = this.root.querySelector('[data-action="use"]')
    const unequip = this.root.querySelector('[data-action="unequip"]')
    const selectedEquipment = this.run.selectedEquipment
    const usableItem = !!selected && selected.type !== 'weapon'
    actions.classList.toggle('show', this.run.phase === 'explore' && !this.run.gameOver)
    actions.classList.toggle('item-selected', usableItem)
    actions.classList.toggle('weapon-selected', !!selectedEquipment)
    discard.disabled = !selected && !selectedEquipment
    use.disabled = !usableItem
    unequip.disabled = !selectedEquipment
  }

  _renderRelicSkills() {
    const skills = this.q('relicskills')
    const definitions = this.run.activeRelicSkills()
    const visible = this.run.phase === 'explore' && !this.run.gameOver && definitions.length > 0
    skills.classList.toggle('show', visible)
    skills.innerHTML = definitions.map((skill) => (
      `<button data-relic-skill="${skill.relicId}"${skill.cooldownRemaining > 0 ? ' disabled' : ''}>${escapeHtml(skill.name)}${skill.cooldownRemaining > 0 ? ` ${skill.cooldownRemaining}` : ''}</button>`
    )).join('')
  }

  selectedIsWeapon() { return this.run.selectedItem?.type === 'weapon' }

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

  _detailActionFor(target) {
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
    const equipment = target.closest('[data-equip-slot]')
    if (equipment) {
      const item = this.run.player.equipment[Number(equipment.dataset.equipSlot)]
      return item ? () => this.run.showItemDetail(item) : null
    }
    const merchantStock = target.closest('[data-merchant-stock]')
    if (merchantStock) {
      const entry = this.run.merchantEntity?.stock?.[Number(merchantStock.dataset.merchantStock)]
      const definition = getItemDefinition(entry?.itemId)
      if (definition) {
        const preview = { ...definition, uid: `merchant-preview-${definition.id}`, durability: definition.durability ?? definition.durabilityRange?.[1] ?? 0 }
        return () => this.run.showItemDetail(preview)
      }
    }
    const merchantRelicChoice = target.closest('[data-merchant-relic-choice]')
    if (merchantRelicChoice) return () => this.run.showRelicDetail(merchantRelicChoice.dataset.merchantRelicChoice)
    const merchantRelic = target.closest('[data-merchant-relic]')
    if (merchantRelic) return () => this.run.showRelicDetail(merchantRelic.dataset.merchantRelic)
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
    const merchantTab = event.target.closest('[data-merchant-tab]')
    if (merchantTab) {
      this.merchantTab = merchantTab.dataset.merchantTab
      this.render()
      return
    }
    const relicSkill = event.target.closest('[data-relic-skill]')
    if (relicSkill) {
      this.run.useRelicSkill(relicSkill.dataset.relicSkill)
      return
    }
    const levelChoice = event.target.closest('[data-level-up-choice]')
    if (levelChoice) {
      this.run.chooseLevelUpOption(levelChoice.dataset.levelUpChoice)
      return
    }
    const adaptationChoice = event.target.closest('[data-adaptation-choice]')
    if (adaptationChoice) {
      this.run.chooseAdaptation(adaptationChoice.dataset.adaptationChoice)
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
    const merchantRelic = event.target.closest('[data-merchant-relic]')
    if (merchantRelic) {
      const id = merchantRelic.dataset.merchantRelic
      if (this.run.isRelicLoadoutDraftActive(id)) this.run.deactivateRelic(id)
      else this.run.activateRelic(id)
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
        if (item?.type === 'weapon') this.run.applySelectedItemToBackpackWeapon(index)
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
        if (item?.type === 'weapon') this.run.applySelectedItemToBackpackWeapon(index)
        else this.run.clearSelection()
      } else {
        this.run.clickInventoryCell(index)
      }
      return
    }
    const equipSlot = event.target.closest('[data-equip-slot]')
    if (equipSlot) {
      const targetSlot = Number(equipSlot.dataset.equipSlot)
      if (this.run.itemTargeting) this.run.applySelectedItemToEquipment(targetSlot)
      else if (this.selectedIsWeapon()) this.run.equipSelected(targetSlot)
      else this.run.selectEquipmentSlot(targetSlot)
      return
    }
    const action = event.target.closest('[data-action]')?.dataset.action
    if (!action) return
    if (action === 'use') this.run.useSelected()
    if (action === 'discard') this.run.discardSelected()
    if (action === 'unequip') this.run.unequipSelected()
    if (action === 'rotate-bag') this.run.rotateSelectedInventory()
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
    if (action === 'confirm-relic-loadout') this.run.confirmRelicLoadout()
    if (action === 'skip-room-reward') this.run.skipRoomReward()
    if (action === 'close-detail') this.run.closeDetail()
    if (action === 'log') this._toggleTopPanel('log')
    if (action === 'settings') this._toggleTopPanel('settings')
    if (action === 'character') this._toggleTopPanel('characterpanel')
    if (action === 'help') this._setHelpModal(true)
    if (action === 'close-help') this._setHelpModal(false)
    if (action === 'relics') this._setRelicModal(true)
    if (action === 'close-relics') this._setRelicModal(false)
  }

  _setRelicModal(show) {
    const modal = this.q('relicmodal')
    modal.classList.toggle('show', show)
    modal.setAttribute('aria-hidden', show ? 'false' : 'true')
  }

  _setHelpModal(show) {
    const modal = this.q('helpmodal')
    if (!modal) return
    if (show) {
      this.helpReturnFocus = document.activeElement?.focus ? document.activeElement : null
      this._setRelicModal(false)
      for (const key of ['settings', 'log', 'characterpanel']) this.q(key).classList.remove('show')
      this.q('characterpanel').setAttribute('aria-hidden', 'true')
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
    for (const key of ['settings', 'log', 'characterpanel']) this.q(key).classList.remove('show')
    panel.classList.toggle('show', open)
    this.q('characterpanel').setAttribute('aria-hidden', panelKey === 'characterpanel' && open ? 'false' : 'true')
  }

  dispose() {
    this.unsubscribe?.()
    this.detailUnsubscribe?.()
    if (this.hold?.timer) window.clearTimeout(this.hold.timer)
    this.root.removeEventListener('click', this._onClick)
    this.root.removeEventListener('pointerdown', this._onPointerDown)
    this.root.removeEventListener('pointermove', this._onPointerMove)
    this.root.removeEventListener('pointerup', this._onPointerUp)
    this.root.removeEventListener('pointercancel', this._onPointerUp)
    document.removeEventListener('keydown', this._onKeyDown)
  }
}
