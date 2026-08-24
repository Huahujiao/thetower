import { EQUIPMENT_SLOTS, INVENTORY_COLUMNS, INVENTORY_ROWS } from '../game/run.js'
import { getItemDefinition } from '../game/data/content.js'
import { getRelicDefinition } from '../game/data/relics.js'
import { merchantSellPrice } from '../game/data/merchants.js'

const LABELS = Object.freeze({
  floor: '\u697c\u5c42',
  health: '\u751f\u547d',
  armor: '\u62a4\u7532',
  gold: '\u91d1\u5e01',
  turn: '\u56de\u5408',
  settings: '\u8bbe\u7f6e',
  log: '\u65e5\u5fd7',
  reveal: '\u8c03\u8bd5\uff1a\u663e\u793a\u724c\u5185\u5bb9',
  discard: '\u4e22\u5f03',
  rotate: '\u65cb\u8f6c',
  wait: '\u7b49\u5f85',
  equip: '\u88c5\u5907',
  use: '\u4f7f\u7528',
  empty: '\u7a7a',
  equipment: '\u5f53\u524d\u88c5\u5907',
  leftHand: '\u5de6\u624b',
  rightHand: '\u53f3\u624b',
  durability: '\u8010\u4e45',
  nextAttack: '\u4e0b\u6b21\u653b\u51fb',
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
  relicChoice: '\u9009\u62e9\u4e00\u4ef6\u5723\u9057\u7269',
  roomReward: '\u65b0\u623f\u95f4\u5956\u52b1',
  skipReward: '\u8df3\u8fc7',
  sellSelected: '\u51fa\u552e\u6240\u9009',
  refreshStock: '\u5237\u65b0\u8d27\u67b6',
  twoHanded: '\u53cc\u624b',
  occupied: '\u5df2\u5360\u7528',
  activeSkill: '\u4e3b\u52a8\u6280\u80fd',
  restart: '\u91cd\u65b0\u5f00\u59cb',
  win: '\u9003\u51fa\u5730\u7262',
  lose: '\u4f60\u5df2\u9668\u843d',
  winMessage: '\u4f60\u51fb\u8d25\u4e86\u76d1\u89c6\u8005\u3002',
  loseMessage: '\u751f\u547d\u5f52\u96f6\u3002\u53ef\u4ee5\u91cd\u65b0\u5f00\u59cb\u6311\u6218\u3002',
})

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]))
}

function merchantSellText(item) { return `+${merchantSellPrice(item)}` }

export class HUD {
  constructor(run) {
    this.run = run
    this.root = document.getElementById('hud')
    if (!this.root) throw new Error('Missing #hud container')
    this._build()
    this._onClick = (event) => this._handleClick(event)
    this.root.addEventListener('click', this._onClick)
    this.unsubscribe = this.run.on('change', () => this.render())
    this.render()
  }

  _build() {
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-stats">
          <div class="stat floor"><span class="label">${LABELS.floor}</span><span class="value" data=floor></span></div>
          <div class="stat hp"><span class="label">${LABELS.health}</span><span class="value" data=hp></span></div>
          <div class="stat armor"><span class="label">${LABELS.armor}</span><span class="value" data=armor></span></div>
          <div class="stat gold"><span class="label">${LABELS.gold}</span><span class="value" data=gold></span></div>
          <div class="stat turn"><span class="label">${LABELS.turn}</span><span class="value" data=turn></span></div>
        </div>
        <div class="hud-btns">
          <button class="hud-icon" data-action="settings" title="${LABELS.settings}" aria-label="${LABELS.settings}">\u2699</button>
          <button class="hud-icon" data-action="log" title="${LABELS.log}" aria-label="${LABELS.log}">\ud83d\udcdc</button>
        </div>
      </div>

      <div class="hud-emotion" data=hintrow><span class="emotion-text" data=hint></span></div>

      <div id="app" aria-label="game board"></div>

      <div class="card-actions" data=actions>
        <button class="act-drop" data-action="discard">${LABELS.discard}</button>
        <button class="act-wait" data-action="wait" title="${LABELS.wait}" aria-label="${LABELS.wait}">\u231b</button>
        <button class="act-skill" data-action="equip">${LABELS.equip}</button>
        <button class="act-use" data-action="use">${LABELS.use}</button>
      </div>
      <div class="relic-skills" data=relicskills></div>

      <div class="hud-settings" data=settings>
        <label class="settings-row"><input type="checkbox" data=revealtoggle> ${LABELS.reveal}</label>
      </div>

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

      <div class="relic-choice" data=initialrelics>
        <div class="relic-choice-title">${LABELS.initialRelic}</div>
        <div class="relic-choice-row" data=initialrelicrow></div>
      </div>

      <div class="relic-choice room-reward" data=roomreward>
        <div class="relic-choice-title">${LABELS.roomReward}</div>
        <div class="relic-choice-row" data=roomrewardrow></div>
        <button class="reward-skip" data-action="skip-room-reward">${LABELS.skipReward}</button>
      </div>

      <div class="hud-rest" data=merchantpanel>
        <section class="merchant-panel">
          <div class="merchant-head"><span data=merchanttitle></span><button data-action="close-merchant">${LABELS.leaveMerchant}</button></div>
          <div class="merchant-stock" data=merchantstock></div>
          <div class="merchant-trade" data=merchanttrade></div>
          <div class="merchant-relics" data=merchantrelics></div>
        </section>
      </div>

      <div class="hud-bottom">
        <div class="equip-row">
          <button class="equip-slot" data-equip-slot="0"></button>
          <button class="equip-slot" data-equip-slot="1"></button>
        </div>
        <div class="backpack-panel">
          <div class="backpack-head">
            <div class="hud-relics">
              <button class="relic-book" data-action="relics" title="${LABELS.relicBook}" aria-label="${LABELS.relicBook}">\u25a6</button>
              <div class="relic-slots" data=relicslots></div>
            </div>
            <button class="bag-rotate" data-action="rotate-bag" title="${LABELS.rotate}" aria-label="${LABELS.rotate}">\u21bb</button>
          </div>
          <div class="backpack-grid" data=backpack></div>
        </div>
      </div>

      <div class="hud-over" data=over>
        <h1 data=overtitle></h1><p data=overmessage></p>
        <button data-action="restart">${LABELS.restart}</button>
      </div>`
    this.q = (key) => this.root.querySelector(`[data="${key}"]`)
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
    this.q('hp').textContent = `${player.hp}/${player.maxHp}`
    this.q('armor').textContent = String(player.armor)
    this.q('gold').textContent = String(player.gold)
    this.q('turn').textContent = String(this.run.turn)
    this.q('hint').textContent = player.pendingAttackBonus ? `${LABELS.nextAttack} +${player.pendingAttackBonus}` : ''

    const equipSlots = this.root.querySelectorAll('[data-equip-slot]')
    for (let slot = 0; slot < EQUIPMENT_SLOTS; slot++) {
      const equipSlot = equipSlots[slot]
      if (!equipSlot) continue
      const weapon = player.equipment[slot]
      const side = slot === 0 ? LABELS.leftHand : LABELS.rightHand
      const occupiedByTwoHanded = slot === 0 && weapon && player.equipment[1] === weapon && weapon.grip === 'two'
      equipSlot.classList.toggle('filled', !!weapon && !occupiedByTwoHanded)
      equipSlot.classList.toggle('occupied', occupiedByTwoHanded)
      equipSlot.classList.toggle('armed', this.run.selectedEquipmentSlot === slot)
      equipSlot.classList.toggle('target', this.run.itemTargeting && !!weapon)
      equipSlot.disabled = occupiedByTwoHanded
      equipSlot.innerHTML = occupiedByTwoHanded
        ? `<div class="sub">${side} \u00b7 ${LABELS.occupied}</div>`
        : weapon
          ? `<div class="nm">${escapeHtml(weapon.name)}</div><div class="sub">${weapon.grip === 'two' ? LABELS.twoHanded : side} \u00b7 ATK ${weapon.attack} \u00b7 R ${weapon.range}</div><div class="sub">${LABELS.durability} ${weapon.durability}</div>`
        : `<div class="sub">${side} \u00b7 ${LABELS.empty}</div>`
    }

    this._renderRelics()
    this._renderInitialRelicChoice()
    this._renderRoomReward()
    this._renderMerchant()
    this._renderBackpack()
    this._renderActions()
    this._renderRelicSkills()
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
      slot.textContent = definition ? definition.name.slice(0, 1) : '\u00b7'
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
    const open = this.run.phase === 'reward' && !!reward
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

  _renderMerchant() {
    const panel = this.q('merchantpanel')
    const merchant = this.run.merchantEntity
    const open = this.run.phase === 'merchant' && !!merchant
    panel.classList.toggle('show', open)
    if (!open) return
    this.q('merchanttitle').textContent = merchant.name
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
    if (!this.run.canManageRelics()) {
      relics.innerHTML = ''
      return
    }
    const offer = merchant.relicOfferResolved ? [] : (merchant.relicChoices || []).map((id) => getRelicDefinition(id)).filter(Boolean)
    const offerHtml = offer.length ? `<div class="merchant-relic-title">${LABELS.relicChoice}</div>${offer.map((definition) => (
      `<button class="merchant-relic-item" data-merchant-relic-choice="${definition.id}"><b>${escapeHtml(definition.name)}</b><small>${escapeHtml(definition.description)}</small></button>`
    )).join('')}` : ''
    relics.innerHTML = `${offerHtml}<div class="merchant-relic-title">${LABELS.relicManagement}</div>${this.run.relics.entries.map((entry) => {
      const definition = getRelicDefinition(entry.id)
      if (!definition) return ''
      const state = entry.active ? LABELS.active : LABELS.inactive
      return `<button class="merchant-relic-item ${entry.active ? 'active' : 'inactive'}" data-merchant-relic="${entry.id}"><b>${escapeHtml(definition.name)}</b><small>${state}</small></button>`
    }).join('')}`
  }

  _renderBackpack() {
    const backpack = this.q('backpack')
    backpack.style.setProperty('--bag-columns', INVENTORY_COLUMNS)
    backpack.style.setProperty('--bag-rows', INVENTORY_ROWS)
    const cells = Array.from({ length: INVENTORY_COLUMNS * INVENTORY_ROWS }, (_, index) => (
      `<button class="bag-cell" data-bag-cell="${index}" aria-label="${LABELS.empty}"></button>`
    )).join('')
    const items = this.run.backpack.placements.map((placement) => {
      const item = placement.item
      const shape = this.run.backpack.shapeFor(item, placement.rotation)
      const selected = this.run.selectedInventoryIndex === this.run.backpack.originIndex(placement)
      const detail = item.type === 'weapon'
        ? `ATK ${item.attack} \u00b7 R ${item.range} \u00b7 ${LABELS.durability} ${item.durability}`
        : item.type === 'potion' ? `HP +${item.heal}`
          : item.type === 'armor' ? `${LABELS.armor} +${item.armor}`
            : item.type === 'buff' ? `ATK +${item.attackBonus}`
              : item.type === 'whetstone' ? `${LABELS.durability} +${item.repair}` : ''
      const index = this.run.backpack.originIndex(placement)
      let firstFilled = true
      const shapeCells = shape.flat().map((filled) => {
        if (!filled) return '<span class="void"></span>'
        const name = firstFilled ? `<b>${escapeHtml(item.name)}</b>` : ''
        firstFilled = false
        return `<span class="occupied">${name}</span>`
      }).join('')
      return `<button class="bag-item ${item.type}${selected ? ' selected' : ''}" data-slot="${index}" style="grid-column:${placement.x + 1} / span ${shape[0].length};grid-row:${placement.y + 1} / span ${shape.length}"><span class="bag-shape" style="grid-template-columns:repeat(${shape[0].length},1fr);grid-template-rows:repeat(${shape.length},1fr)">${shapeCells}</span><span class="bag-details"><small>${detail}</small></span></button>`
    }).join('')
    backpack.innerHTML = `${cells}${items}`
  }

  _renderActions() {
    const selected = this.run.selectedItem
    const actions = this.q('actions')
    const discard = this.root.querySelector('[data-action="discard"]')
    const equip = this.root.querySelector('[data-action="equip"]')
    const use = this.root.querySelector('[data-action="use"]')
    actions.classList.toggle('show', this.run.phase === 'explore' && !this.run.gameOver)
    discard.disabled = !selected && !this.run.selectedEquipment
    equip.disabled = !this.selectedIsWeapon()
    use.disabled = !selected || selected.type === 'weapon'
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

  _handleClick(event) {
    const relicSkill = event.target.closest('[data-relic-skill]')
    if (relicSkill) {
      this.run.useRelicSkill(relicSkill.dataset.relicSkill)
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
      if (this.run.relics.isActive(id)) this.run.deactivateRelic(id)
      else this.run.activateRelic(id)
      return
    }
    const merchantRelicChoice = event.target.closest('[data-merchant-relic-choice]')
    if (merchantRelicChoice) {
      this.run.chooseMerchantRelic(merchantRelicChoice.dataset.merchantRelicChoice)
      return
    }
    const bagCell = event.target.closest('[data-bag-cell]')
    if (bagCell) {
      this.run.moveSelectedInventory(Number(bagCell.dataset.bagCell))
      return
    }
    const slot = event.target.closest('[data-slot]')
    if (slot) {
      this.run.selectInventory(Number(slot.dataset.slot))
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
    if (action === 'wait') this.run.wait()
    if (action === 'equip') this.run.equipSelected()
    if (action === 'use') this.run.useSelected()
    if (action === 'discard') this.run.discardSelected()
    if (action === 'rotate-bag') this.run.rotateSelectedInventory()
    if (action === 'restart') {
      this.run.clearSave()
      this.run.reset()
    }
    if (action === 'close-merchant') this.run.closeMerchant()
    if (action === 'merchant-sell') this.run.sellSelectedMerchantItem()
    if (action === 'merchant-refresh') this.run.refreshMerchantInventory()
    if (action === 'skip-room-reward') this.run.skipRoomReward()
    if (action === 'log') this.q('log').classList.toggle('show')
    if (action === 'settings') this.q('settings').classList.toggle('show')
    if (action === 'relics') this._setRelicModal(true)
    if (action === 'close-relics') this._setRelicModal(false)
  }

  _setRelicModal(show) {
    const modal = this.q('relicmodal')
    modal.classList.toggle('show', show)
    modal.setAttribute('aria-hidden', show ? 'false' : 'true')
  }

  dispose() {
    this.unsubscribe?.()
    this.root.removeEventListener('click', this._onClick)
  }
}
