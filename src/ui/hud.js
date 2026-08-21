// HUD 覆盖层 —— 资源条 / 装备栏 / 行囊 / 日志 / 层间修整 / 横幅 / 目标选择
import './hud.css'
import { rewardText, buffText, itemText } from '../data/cards.js'
import { relicText } from '../data/relics.js'
import { BAG_COLUMNS, BAG_ROWS } from '../game/state.js'
import { weaponPower } from '../game/rules/combat.js'
import { bindLongPress } from './long-press.js'

export class HUD {
  constructor(state) {
    this.state = state
    this.root = document.getElementById('hud')
    this._bannerTimer = null
    this._skillPickerOpen = false
    this._skillDetailSkill = null
    this._skillIconPressCleanups = []
    this._build()
    state.on('change', () => this._render())
    state.on('floor:start', (e) => this._showBanner(e))
    // 阶段切换淡场
    this._veil = document.createElement('div')
    this._veil.className = 'hud-veil'
    document.body.appendChild(this._veil)
    state.on('phase:change', () => {
      this._veil.classList.remove('flash')
      void this._veil.offsetWidth
      this._veil.classList.add('flash')
    })
    this._render()
  }

  _build() {
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-stats">
          <div class="stat floor"><span class="label">楼层</span><span class="value" data=floor>1</span></div>
          <div class="stat hp"><span class="label">生命</span><span class="value" data=hp>20/20</span></div>
          <div class="stat armor"><span class="label">护甲</span><span class="value" data=armor>0</span></div>
          <div class="stat san"><span class="label">理智</span><span class="value" data=san>30/30</span></div>
          <div class="stat gold"><span class="label">金币</span><span class="value" data=gold>0</span></div>
          <div class="stat key"><span class="label">钥匙</span><span class="value" data=key>0/3</span></div>
          <div class="stat turn"><span class="label">回合</span><span class="value" data=turn>0</span></div>
        </div>
        <div class="hud-btns">
          <button class="hud-icon" data=settingsbtn title="设置">⚙</button>
          <button class="hud-icon" data=logbtn title="日志">📜</button>
        </div>
      </div>

      <!-- 情绪栏：同一行内 情绪文本(居中) + 右侧 下次攻击/buff 提示 -->
      <div class="hud-emotion" data=emotionrow>
        <span class="emotion-text" data=emotion></span>
        <span class="emotion-buff" data=buffchip></span>
      </div>

      <div class="relic-collection-modal" data=relicmodal aria-hidden="true">
        <div class="relic-modal-backdrop" data=relicbackdrop></div>
        <section class="relic-modal-panel" role="dialog" aria-modal="true" aria-label="圣遗物图鉴">
          <div class="relic-modal-head">
            <span>圣遗物图鉴</span>
            <span class="relic-modal-count" data=relicmodalcount></span>
            <button class="relic-modal-close" data=relicclose aria-label="关闭圣遗物图鉴">×</button>
          </div>
          <div class="relic-collection" data=reliccollection></div>
          <div class="relic-modal-hint" data=relicmodalhint></div>
        </section>
      </div>

      <div class="relic-choice" data=initialrelics>
        <div class="relic-choice-title">选择初始圣遗物</div>
        <div class="relic-choice-row" data=initialrelicrow></div>
      </div>

      <!-- 牌局场景（flex 中间区域） -->
      <div id="app"></div>

      <!-- 场景操作：四个动作固定等分排列；主动技能短按施放/长按打开列表 -->
      <div class="card-actions" data=cardactions>
        <button class="act-drop" data=actdrop>丢弃</button>
        <button class="act-wait" data=actwait title="等待一回合" aria-label="等待一回合">⌛</button>
        <button class="act-skill" data=actskill aria-label="主动技能">✦</button>
        <button class="act-use" data=actusebtn>使用</button>
      </div>

      <div class="skill-picker" data=skillpicker aria-hidden="true">
        <div class="skill-picker-backdrop" data=skillpickerbackdrop></div>
        <section class="skill-picker-panel" role="dialog" aria-modal="true" aria-label="主动技能选择">
          <div class="skill-picker-head">
            <span>主动技能</span>
            <button class="skill-picker-close" data=skillpickerclose aria-label="关闭技能选择">×</button>
          </div>
          <div class="skill-picker-list" data=skillpickerlist></div>
          <div class="skill-picker-hint">点击图标选择，长按图标查看说明</div>
        </section>
      </div>

      <div class="skill-detail" data=skilldetail aria-hidden="true">
        <div class="skill-detail-backdrop" data=skilldetailbackdrop></div>
        <section class="skill-detail-panel" role="dialog" aria-modal="true" aria-label="主动技能说明">
          <div class="skill-detail-head">
            <span class="skill-detail-icon" data=skilldetailicon>✦</span>
            <span class="skill-detail-name" data=skilldetailname></span>
            <button class="skill-detail-close" data=skilldetailclose aria-label="关闭技能说明">×</button>
          </div>
          <div class="skill-detail-meta" data=skilldetailmeta></div>
          <p class="skill-detail-desc" data=skilldetaildesc></p>
        </section>
      </div>

      <div class="hud-banner" data=banner></div>
      <div class="hud-madness" data=madness>⚠ 理智耗尽！本回合行动随机化</div>

      <div class="hud-settings" data=settings>
        <label class="settings-row"><input type="checkbox" data=revealtoggle> 调试：显示牌内容</label>
      </div>

      <div class="hud-log" data=log>
        <div class="log-head">
          <span class="log-title">日志</span>
          <button class="log-send" data=logsend>发送日志</button>
        </div>
        <div class="log-body" data=logbody></div>
        <div class="log-status" data=logstatus></div>
      </div>

      <div class="hud-bottom">
        <div class="equip-row">
          <div class="equip-slot" data=equip0></div>
          <div class="equip-slot" data=equip1></div>
        </div>
        <div class="backpack-panel">
          <div class="backpack-head">
            <div class="hud-relics" data=relics>
              <button class="relic-book" data=relicbook title="打开圣遗物图鉴" aria-label="打开圣遗物图鉴">▦</button>
              <div class="relic-slots" data=relicslots></div>
            </div>
            <button class="bag-rotate" data=bagrotatebtn title="旋转选中的物品" aria-label="旋转选中的物品">↻</button>
          </div>
          <div class="backpack-grid" data=backpack></div>
        </div>
      </div>

      <!-- 层间修整（占满场景区：无边框、无背景，直接复用牌局背景；不滚动） -->
      <div class="hud-rest" data=rest>
        <div class="rest-reward" data=restreward>
          <div class="rest-title" data=rewardtitle></div>
          <div class="rest-reward-row" data=rewardrow></div>
        </div>
        <div class="rest-shop" data=restshop>
          <div class="rest-title" data=shoptitle></div>
          <div class="rest-grid" data=shopgrid></div>
          <div class="rest-ops">
            <button data=repairbtn title="点击后选择装备栏或行囊中的武器">修理</button>
            <button data=sellbtn title="点击后选择装备栏或行囊中的一张牌">出售</button>
            <span class="rest-hint" data=resthint></span>
            <span class="rest-gold">金币 <b data=restgold>0</b></span>
          </div>
          <div class="rest-confirm" data=confirm>
            <span class="confirm-text" data=confirmtext></span>
            <span class="confirm-btns">
              <button class="ghost" data=cancelbtn>取消</button>
              <button class="primary" data=okbtn>确认</button>
            </span>
          </div>
        </div>
        <div class="rest-next">
          <button class="primary" data=nextbtn>进入下一层 ▶</button>
        </div>
      </div>

      <div class="hud-over" data=over>
        <h1 data=overtitle></h1>
        <p data=overmsg style="opacity:0.7;max-width:420px;text-align:center;"></p>
        <button data=overbtn>重新开始</button>
      </div>
    `
    this.q = (k) => this.root.querySelector(`[data="${k}"]`)

    for (let i = 0; i < 2; i++) {
      this.q(`equip${i}`).addEventListener('click', () => this._onEquipClick(i))
    }
    this.q('overbtn').addEventListener('click', () => this._restart())
    this.q('logbtn').addEventListener('click', () => this.q('log').classList.toggle('show'))
    this.q('settingsbtn').addEventListener('click', () => this.q('settings').classList.toggle('show'))
    this.q('relicbook').addEventListener('click', () => {
      const modal = this.q('relicmodal')
      const show = !modal.classList.contains('show')
      modal.classList.toggle('show', show)
      modal.setAttribute('aria-hidden', show ? 'false' : 'true')
    })
    this.q('relicclose').addEventListener('click', () => this._closeRelicCollection())
    this.q('relicbackdrop').addEventListener('click', () => this._closeRelicCollection())
    const revealToggle = this.q('revealtoggle')
    revealToggle.checked = (typeof localStorage !== 'undefined' && localStorage.getItem('heita_opt_reveal')) === '1'
    revealToggle.addEventListener('change', (e) => {
      if (typeof localStorage !== 'undefined') localStorage.setItem('heita_opt_reveal', e.target.checked ? '1' : '0')
      window.dispatchEvent(new CustomEvent('settings:reveal', { detail: { reveal: e.target.checked } }))
    })
    this.q('repairbtn').addEventListener('click', () => this.state.setRestMode('repair'))
    this.q('sellbtn').addEventListener('click', () => this.state.setRestMode('sell'))
    this.q('okbtn').addEventListener('click', () => this.state.confirmPending())
    this.q('cancelbtn').addEventListener('click', () => this.state.cancelPending())
    // 下一层按钮在奖励阶段显示为"跳过"，商店阶段为"进入下一层"
    this.q('nextbtn').addEventListener('click', () => {
      if (this.state.restStep() === 'reward') this.state.skipReward()
      else this.state.enterNextFloor()
    })
    this.q('actdrop').addEventListener('click', () => this._dropSelected())
    this.q('actwait').addEventListener('click', () => this.state.waitTurn())
    this.q('actusebtn').addEventListener('click', () => this._useSelected())
    this._skillPressCleanup = bindLongPress(this.q('actskill'), {
      onClick: () => this.state.castActiveSkill(),
      onLongPress: () => this._openSkillPicker(),
    })
    this.q('skillpickerclose').addEventListener('click', () => this._closeSkillPicker())
    this.q('skillpickerbackdrop').addEventListener('click', () => this._closeSkillPicker())
    this.q('skilldetailclose').addEventListener('click', () => this._closeSkillDetail())
    this.q('skilldetailbackdrop').addEventListener('click', () => this._closeSkillDetail())
    this.q('bagrotatebtn').addEventListener('click', () => {
      if (this.state.selectedBackpackUid) this.state.rotateBackpack(this.state.selectedBackpackUid)
    })
    this.q('logsend').addEventListener('click', () => this._sendLog())
  }

  _closeRelicCollection() {
    const modal = this.q('relicmodal')
    modal.classList.remove('show')
    modal.setAttribute('aria-hidden', 'true')
  }

  _clearSkillIconPresses() {
    for (const cleanup of this._skillIconPressCleanups.splice(0)) cleanup()
  }

  _closeSkillPicker() {
    this._clearSkillIconPresses()
    this._skillPickerOpen = false
    const picker = this.q('skillpicker')
    picker.classList.remove('show')
    picker.setAttribute('aria-hidden', 'true')
  }

  _openSkillPicker() {
    if (this.state.gameOver || this.state.phase !== 'explore') return
    this._skillPickerOpen = true
    const picker = this.q('skillpicker')
    picker.classList.add('show')
    picker.setAttribute('aria-hidden', 'false')
    this._renderSkillPicker()
  }

  _selectSkillFromPicker(skillId) {
    const result = this.state.selectActiveSkill(skillId)
    if (result.ok) this._closeSkillPicker()
  }

  _openSkillDetail(skill) {
    if (!skill) return
    this._skillDetailSkill = skill
    this.q('skilldetailicon').textContent = skill.icon || '✦'
    this.q('skilldetailname').textContent = skill.name || '主动技能'
    const maxCooldown = Math.max(0, Math.floor(Number(skill.cooldown ?? 10) || 0))
    const remaining = Math.max(0, Math.floor(Number(skill.cooldownRemaining) || 0))
    this.q('skilldetailmeta').textContent = '冷却 ' + maxCooldown + ' 回合 · 剩余 ' + remaining + ' 回合'
    this.q('skilldetaildesc').textContent = skill.description || '暂无说明。'
    const detail = this.q('skilldetail')
    detail.classList.add('show')
    detail.setAttribute('aria-hidden', 'false')
  }

  _closeSkillDetail() {
    this._skillDetailSkill = null
    const detail = this.q('skilldetail')
    detail.classList.remove('show')
    detail.setAttribute('aria-hidden', 'true')
  }

  _renderSkillPicker() {
    if (!this._skillPickerOpen) return
    this._clearSkillIconPresses()
    const list = this.q('skillpickerlist')
    list.innerHTML = ''
    const selectedId = this.state.activeSkillId
    for (const skill of this.state.activeSkills()) {
      const button = document.createElement('button')
      button.className = 'skill-picker-item'
      button.classList.toggle('selected', skill.id === selectedId)
      button.type = 'button'
      button.title = skill.name || '主动技能'
      button.setAttribute('aria-label', skill.name || '主动技能')
      const remaining = Math.max(0, Math.floor(Number(skill.cooldownRemaining) || 0))
      button.innerHTML = '<span class="skill-picker-icon">' + (skill.icon || '✦') + '</span>'
        + (remaining > 0 ? '<span class="skill-picker-cooldown">' + remaining + '</span>' : '')
      const cleanup = bindLongPress(button, {
        onClick: () => this._selectSkillFromPicker(skill.id),
        onLongPress: () => this._openSkillDetail(skill),
      })
      this._skillIconPressCleanups.push(cleanup)
      list.appendChild(button)
    }
  }

  // 丢弃当前选中的行囊/装备栏武器
  _dropSelected() {
    const s = this.state
    if (s.gameOver) return
    // 修理/出售目标选择模式下点击走 restPickTarget，此处不处理
    if (s.phase === 'rest' && s.rest && s.rest.mode) return
    if (s.selectedHand !== null) s.discard(s.selectedHand)
    else if (s.armedSlot !== null) s.discardEquip(s.armedSlot)
  }

  // 使用当前选中的行囊物品（药水/道具/buff；武器无"使用"按钮）
  _useSelected() {
    const s = this.state
    if (s.gameOver) return
    if (s.phase === 'rest' && s.rest && s.rest.mode) return
    const idx = s.selectedHand
    if (idx === null) return
    const item = s.hand[idx]
    if (!item) return
    const kind = item.def.atk !== undefined ? 'weapon' : (item.def.repair !== undefined || item.def.buff) ? 'item' : (item.def.effect ? 'buff' : 'potion')
    if (kind === 'potion') s.usePotion(idx)
    else if (kind === 'item') s.useItem(idx)
    else if (kind === 'buff') s.useBuff(idx)
  }

  _onEquipClick(i) {
    const s = this.state
    if (s.gameOver) return
    // 层间修整：修理/出售模式下，点击装备栏 = 选择目标牌
    if (s.phase === 'rest' && s.rest && s.rest.mode) {
      const w = s.equip[i]
      if (w) s.restPickTarget(w.uid)
      return
    }
    // 道具目标选择模式：点击装备栏武器 = 直接使用道具（绿色高亮目标）
    if (s.itemTargeting) {
      const w = s.equip[i]
      if (w) s.applyItemToWeapon(w.uid)
      return
    }
    if (s.selectedHand !== null) s.switchToEquip(i)
    // 装备栏点击只用于选择/丢弃武器，不再决定下一次攻击使用哪把武器。
    else s.armWeapon(i)
  }

  _restart() {
    this.state.reset()
    this.state.clearSave()
    window.dispatchEvent(new CustomEvent('game:restart'))
  }

  // 发送日志到本机日志接收服务（地址按当前页面 host 拼，兼容 Tailscale 设备访问）
  async _sendLog() {
    const s = this.state
    const btn = this.q('logsend')
    const status = this.q('logstatus')
    if (btn.disabled) return
    btn.disabled = true
    const prev = status.textContent
    status.textContent = '发送中…'
    try {
      const payload = {
        sentAt: new Date().toISOString(),
        url: location.href,
        floor: s.floor,
        turn: s.turn,
        player: {
          hp: s.player.hp, maxHp: s.player.maxHp,
          armor: s.player.armor,
          san: s.player.san, maxSan: s.player.maxSan,
          gold: s.player.gold, keys: s.player.keys,
        },
        log: s.log,
      }
      // 日志服务固定端口；用当前页面协议+host，适配 localhost / 局域网 / Tailscale IP
      const LOG_PORT = 7700
      const url = `${location.protocol}//${location.hostname}:${LOG_PORT}/log`
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!resp.ok) throw new Error('HTTP ' + resp.status)
      const data = await resp.json()
      status.textContent = `已发送 ${s.log.length} 条（${new Date().toLocaleTimeString()}）`
    } catch (e) {
      status.textContent = '发送失败：' + e.message + '（服务是否已启动？）'
    } finally {
      btn.disabled = false
      setTimeout(() => { if (status.textContent.startsWith('已发送')) status.textContent = '' }, 4000)
    }
  }

  // 商店货架：8 格（4 列 × 2 行），点击格 → 请求购买（进入确认流）
  _renderShopGrid(r) {
    const grid = this.q('shopgrid')
    grid.innerHTML = ''
    r.stock.forEach((entry, i) => {
      const cell = document.createElement('button')
      cell.className = `shop-cell ${entry.type}`
      if (entry.sold) {
        cell.classList.add('sold')
        cell.innerHTML = `<span class="nm">${entry.def.name}</span><span class="price">已售</span>`
      } else {
        cell.innerHTML = `<span class="nm">${entry.def.name}</span><span class="price">${entry.price} 金</span>`
        cell.addEventListener('click', () => this.state.requestBuy(i))
      }
      grid.appendChild(cell)
    })
  }

  _showBanner(e) {
    const el = this.q('banner')
    const mod = e.mod || {}
    let txt = `第 ${e.floor} 层`
    if (mod.envName) txt += ` · ${mod.envName}`
    if (e.cfg && e.cfg.boss) txt += ' · BOSS 战'
    if (e.cfg && e.cfg.elite) txt += ' · 含精英'
    el.textContent = txt
    el.classList.add('show')
    if (this._bannerTimer) clearTimeout(this._bannerTimer)
    this._bannerTimer = setTimeout(() => el.classList.remove('show'), 3200)
  }

  _renderRelics() {
    const s = this.state
    const panel = this.q('relics')
    const slots = this.q('relicslots')
    const collection = this.q('reliccollection')
    const definitions = s.relicDefinitions()
    const active = new Set(s.activeRelics)
    const hasRelics = definitions.length > 0
    // Keep the row reserved even before the first relic is chosen; only the
    // icon contents change, so the board and backpack never shift vertically.
    panel.classList.add('show')
    if (!hasRelics) this._closeRelicCollection()
    const book = this.q('relicbook')
    book.title = `打开圣遗物图鉴（已收集 ${s.relicCollection.length} 个）`
    book.setAttribute('aria-label', book.title)
    this.q('relicmodalcount').textContent = `${s.relicCollection.length} 个`
    slots.innerHTML = ''
    for (let index = 0; index < s.relicActiveLimit; index++) {
      const id = s.activeRelics[index]
      const def = id ? definitions.find((entry) => entry.id === id) : null
      const slot = document.createElement('div')
      slot.className = `relic-slot ${def ? 'active' : 'empty'}`
      if (def) {
        const text = relicText(def)
        slot.title = `${text.name}：${text.desc}`
        slot.setAttribute('aria-label', `${text.name}（已激活）`)
        slot.innerHTML = `<span class="relic-glyph">${text.name.slice(0, 1)}</span>`
      } else {
        slot.title = '空的激活栏位'
        slot.setAttribute('aria-label', '空的激活栏位')
        slot.innerHTML = '<span class="relic-glyph">·</span>'
      }
      slots.appendChild(slot)
    }
    collection.innerHTML = ''
    const canChange = s.phase === 'rest' && s.rest?.step === 'shop'
    this.q('relicmodalhint').textContent = canChange ? '商店中可点击圣遗物调整激活状态。' : '只能在商店中调整激活状态。'
    for (const def of definitions) {
      const text = relicText(def)
      const item = document.createElement('button')
      item.className = `relic-collection-item ${active.has(def.id) ? 'active' : 'inactive'}${canChange ? ' changeable' : ' locked'}`
      item.title = text.desc
      item.innerHTML = `<span class="relic-item-name">${text.name}</span><small>${active.has(def.id) ? '已激活' : '未激活'}</small><span class="relic-item-desc">${text.desc}</span>`
      if (canChange) {
        item.addEventListener('click', () => {
          if (active.has(def.id)) s.deactivateRelic(def.id)
          else s.activateRelic(def.id)
        })
      }
      collection.appendChild(item)
    }

    const choicePanel = this.q('initialrelics')
    const choiceRow = this.q('initialrelicrow')
    const choices = s.initialRelicChoices || []
    choicePanel.classList.toggle('show', choices.length > 0 && s.relicCollection.length === 0)
    choiceRow.innerHTML = ''
    for (const def of choices) {
      const text = relicText(def)
      const card = document.createElement('button')
      card.className = 'relic-choice-card'
      card.innerHTML = `<span class="relic-name">${text.name}</span><span class="relic-desc">${text.desc}</span>`
      card.addEventListener('click', () => s.chooseInitialRelic(def.id))
      choiceRow.appendChild(card)
    }
  }

  _render() {
    const s = this.state
    this.q('floor').textContent = s.floor + (s.hasBoss() ? '·B' : '')
    this.q('hp').textContent = `${s.player.hp}/${s.player.maxHp}`
    this.q('armor').textContent = s.player.armor
    this.q('san').textContent = `${s.player.san}/${s.player.maxSan}`
    this.q('gold').textContent = s.player.gold
    this.q('key').textContent = `${s.player.keys}/${s.player.keysNeeded}`
    this.q('turn').textContent = s.turn
    this._renderRelics()

    // 疯狂横幅
    this.q('madness').classList.toggle('show', s.madness)

    // 情绪状态（栏位始终占位，有情绪时才显示内容；buff 提示同栏右侧）
    const em = s.emotionDef()
    const emRow = this.q('emotionrow')
    const emEl = this.q('emotion')
    if (em) { emEl.textContent = `${em.name} · ${em.desc}`; emRow.className = `hud-emotion show ${em.tone}` }
    else { emEl.textContent = ''; emRow.className = 'hud-emotion' }

    // 待生效 buff / 荆棘守护提示（与情绪同栏右侧）
    const chip = this.q('buffchip')
    if (s.pendingBuffName) { chip.textContent = `下次攻击：${s.pendingBuffName}`; chip.classList.add('show') }
    else if (s.thorns > 0) { chip.textContent = `荆棘守护：下次受击 -${s.thorns}`; chip.classList.add('show') }
    else chip.classList.remove('show')

    // 装备栏
    for (let i = 0; i < 2; i++) {
      const slot = this.q(`equip${i}`)
      const w = s.equip[i]
      const unavailable = s.equipment.isUnavailable(i)
      const side = i === 0 ? '左手' : '右手'
      slot.classList.toggle('filled', !!w)
      slot.classList.toggle('unavailable', unavailable)
      slot.classList.toggle('armed', s.armedSlot === i && !unavailable)
      // 绿色高亮目标：道具目标选择模式（装备栏武器可作为道具目标）/ 行囊武器待装入（选中武器时槽位提示）
      slot.classList.toggle('target', (s.itemTargeting && !!w) || (s.selectedHand !== null && s.hand[s.selectedHand]?.def.atk && !unavailable))
      if (w) {
        const durPct = (w.curDur / w.maxDur) * 100
        const durColor = w.curDur <= 0 ? '#f66' : w.curDur < 4 ? '#fc6' : '#6f6'
        const effectiveAttack = Math.floor(s.modifyByRelics('weapon:power', weaponPower(w), { weapon: w }))
        slot.innerHTML = `
          <div class="nm">${w.def.name}</div>
          <div class="sub">${side} · ${w.def.grip === 'two' ? '双手' : '单手'} · ${w.def.type} 攻${effectiveAttack}${w.pollutAtk ? '(污)' : ''}</div>
          <div class="dur"><i style="width:${durPct}%;background:${durColor}"></i></div>
          <div class="sub">耐久 ${w.curDur}/${w.maxDur}${w.curDur <= 0 ? ' 破损' : ''}${w.maintain > 0 ? ` 保养${w.maintain}` : ''}</div>`
      } else if (unavailable) {
        slot.innerHTML = `<div class="sub">${side} · 不可用</div><div class="sub">双手武器占用</div>`
      } else {
        slot.innerHTML = `<div class="sub" style="opacity:0.4">${side} · 空</div>`
      }
    }

    // 行囊：固定 10×5 网格；点击空格可移动当前选中的物品
    const bagEl = this.q('backpack')
    bagEl.innerHTML = ''
    const rotateBtn = this.q('bagrotatebtn')
    const hasSelectedBackpack = !!s.selectedBackpackUid
    rotateBtn.classList.toggle('show', hasSelectedBackpack)
    rotateBtn.disabled = !hasSelectedBackpack
    for (let y = 0; y < BAG_ROWS; y++) for (let x = 0; x < BAG_COLUMNS; x++) {
      const cell = document.createElement('div')
      cell.className = 'bag-cell'
      cell.style.gridColumn = `${x + 1}`
      cell.style.gridRow = `${y + 1}`
      cell.addEventListener('click', () => s.moveSelectedBackpack(x, y))
      bagEl.appendChild(cell)
    }
    const restMode = s.phase === 'rest' && s.rest && s.rest.mode
    const itemTargeting = s.itemTargeting   // 仅武器道具进入目标选择模式
    s.inventory.placements.forEach((placement, idx) => {
      const item = placement.item
      const div = document.createElement('div')
      const kind = item.def.atk !== undefined ? 'weapon' : (item.def.repair !== undefined || item.def.buff) ? 'item' : (item.def.effect ? 'buff' : 'potion')
      const shape = s.inventory.shapeFor(item, placement.rotation)
      div.className = `bag-item ${kind}`
      if (s.selectedBackpackUid === item.uid) div.classList.add('selected')
      if (itemTargeting && kind === 'weapon') div.classList.add('target')
      div.style.gridColumn = `${placement.x + 1} / span ${shape[0].length}`
      div.style.gridRow = `${placement.y + 1} / span ${shape.length}`
      const shapeEl = document.createElement('div')
      shapeEl.className = 'bag-shape'
      shapeEl.style.gridTemplateColumns = `repeat(${shape[0].length}, 1fr)`
      shapeEl.style.gridTemplateRows = `repeat(${shape.length}, 1fr)`
      let firstFilled = true
      for (const row of shape) for (const filled of row) {
        const shapeCell = document.createElement('span')
        shapeCell.className = filled ? 'occupied' : 'void'
        if (filled && firstFilled) {
          shapeCell.innerHTML = `<b>${item.def.name}</b>`
          firstFilled = false
        }
        shapeEl.appendChild(shapeCell)
      }
      div.appendChild(shapeEl)
      let inner = ''
      if (kind === 'weapon') {
        const w = item
        const durPct = (w.curDur / w.maxDur) * 100
        const effectiveAttack = Math.floor(s.modifyByRelics('weapon:power', weaponPower(w), { weapon: w }))
        inner += `<div class="bag-meta">${w.def.grip === 'two' ? '双手' : '单手'} · ${w.def.type} 攻${effectiveAttack}${w.pollutAtk ? '(污)' : ''}</div>`
        inner += `<div class="bag-meta">耐久 ${w.curDur}/${w.maxDur}</div><div class="bag-dur"><i style="width:${durPct}%"></i></div>`
      } else if (kind === 'potion') {
        const effects = []
        if (item.def.healHp) effects.push(`+${item.def.healHp}HP`)
        if (item.def.healSan) effects.push(`+${item.def.healSan}SAN`)
        if (item.def.armor) effects.push(`+${item.def.armor}护甲`)
        inner += `<div class="bag-meta">${effects.join(' ') || '消耗品'}</div>`
      } else if (kind === 'item') {
        inner += `<div class="bag-meta">${itemText(item.def)}</div>`
      } else if (kind === 'buff') {
        inner += `<div class="bag-meta">${buffText(item.def)}</div>`
      }
      const details = document.createElement('div')
      details.className = 'bag-details'
      details.innerHTML = inner
      div.appendChild(details)
      div.addEventListener('click', () => {
        if (restMode) { s.restPickTarget(item.uid); return }
        // 道具目标选择模式：点击武器直接使用道具（无文字列表）
        if (itemTargeting && kind === 'weapon') { s.applyItemToWeapon(item.uid); return }
        // 点击行囊物品 = 选中查看；操作走场景左下丢弃 / 右下使用；武器点装备栏即可装备/替换
        s.selectBackpack(item.uid)
      })
      bagEl.appendChild(div)
    })

    // 场景操作行：四个按钮固定等分；不适用的按钮只隐藏内容，保留格位
    // 以避免选择/取消选择时其他按钮发生位移。rest 阶段整行隐藏。
    const acts = this.q('cardactions')
    const skillBtn = this.q('actskill')
    const waitBtn = this.q('actwait')
    const useBtn = this.q('actusebtn')
    const dropBtn = this.q('actdrop')
    const activeSkill = s.activeSkill
    const canShowSkill = s.phase === 'explore' && !!activeSkill
    skillBtn.style.visibility = canShowSkill ? 'visible' : 'hidden'
    skillBtn.disabled = !canShowSkill
    if (activeSkill) {
      const cooldown = Math.max(0, Math.floor(Number(activeSkill.cooldownRemaining) || 0))
      skillBtn.textContent = (activeSkill.icon || '✦') + ' ' + activeSkill.name + (cooldown > 0 ? ' · ' + cooldown : '')
      skillBtn.title = (activeSkill.description || activeSkill.name) + '；短按施放，长按打开技能列表'
      skillBtn.setAttribute('aria-label', activeSkill.name + '：短按施放，长按打开技能列表')
    } else {
      skillBtn.textContent = '✦'
      skillBtn.title = '主动技能'
    }
    waitBtn.style.visibility = s.phase === 'explore' ? 'visible' : 'hidden'
    waitBtn.disabled = s.phase !== 'explore'
    let canDrop = false
    let canUse = false
    if (s.phase === 'explore' && s.selectedHand !== null && s.hand[s.selectedHand]) {
      const selItem = s.hand[s.selectedHand]
      const isWeapon = selItem.def.atk !== undefined
      canDrop = true
      canUse = !isWeapon
    } else if (s.armedSlot !== null && s.equip[s.armedSlot]) {
      canDrop = s.phase === 'explore'
    }
    dropBtn.style.visibility = canDrop ? 'visible' : 'hidden'
    dropBtn.disabled = !canDrop
    useBtn.style.visibility = canUse ? 'visible' : 'hidden'
    useBtn.disabled = !canUse
    acts.classList.toggle('show', s.phase === 'explore')
    if (s.phase !== 'explore' && this._skillPickerOpen) this._closeSkillPicker()

    // 层间修整（三选一奖励 → 商店 → 进入下一层；占满场景区）
    const rest = this.q('rest')
    if (s.phase === 'rest' && s.rest) {
      rest.classList.add('show')
      const r = s.rest
      const rewardArea = this.q('restreward')
      const shopArea = this.q('restshop')
      const nextBtn = this.q('nextbtn')
      if (r.step === 'reward') {
        // 层间奖励：卡牌或圣遗物；选完立即转场；可跳过
        rewardArea.style.display = 'flex'
        shopArea.style.display = 'none'
        this.q('rewardtitle').textContent = `第 ${s.floor} 层 · 层间修整${r.envName ? ` · ${r.envName}` : ''}`
        const row = this.q('rewardrow')
        row.innerHTML = ''
        r.rewards.forEach((rw, idx) => {
          const t = rewardText(rw)
          const card = document.createElement('button')
          card.className = `reward-card ${rw.kind}`
          const usable = s.canChooseReward(rw)
          card.classList.toggle('disabled', !usable)
          card.innerHTML = `<span class="tag">${t.tag}</span><span class="nm">${t.name}</span><span class="desc">${t.desc}</span>`
          if (usable) card.addEventListener('click', () => s.chooseReward(idx))
          row.appendChild(card)
        })
        nextBtn.textContent = '跳过奖励'
        nextBtn.disabled = false
      } else if (r.step === 'shop') {
        // 商店：8 格货架 + 修理/出售（仅商店有）+ 确认栏
        rewardArea.style.display = 'none'
        shopArea.style.display = 'flex'
        this.q('shoptitle').textContent = `第 ${s.floor} 层 · 商店${r.envName ? ` · ${r.envName}` : ''}`
        this._renderShopGrid(r)
        this.q('restgold').textContent = s.player.gold
        this.q('repairbtn').classList.toggle('active', r.mode === 'repair')
        this.q('sellbtn').classList.toggle('active', r.mode === 'sell')
        this.q('resthint').textContent = r.mode
          ? (r.mode === 'repair' ? '点击装备栏或行囊中的武器' : '点击装备栏或行囊中的一张牌')
          : ''
        // 确认栏：文字居左，确认按钮居右
        const confirmEl = this.q('confirm')
        if (r.pending) {
          confirmEl.classList.add('show')
          this.q('confirmtext').textContent = r.pending.text
        } else {
          confirmEl.classList.remove('show')
        }
        nextBtn.textContent = '进入下一层 ▶'
        nextBtn.disabled = false
      } else {
        // 兼容兜底（正常流程选完/跳过奖励后立即转场，不会停留在此）
        rewardArea.style.display = 'none'
        shopArea.style.display = 'none'
        nextBtn.textContent = '进入下一层 ▶'
        nextBtn.disabled = false
      }
    } else {
      rest.classList.remove('show')
    }

    // 日志（面板内 body 滚动）
    const logBody = this.q('logbody')
    logBody.innerHTML = s.log.slice(-40).map(l => `<div class="line">${l}</div>`).join('')
    logBody.scrollTop = logBody.scrollHeight

    // 结算
    const over = this.q('over')
    if (s.gameOver) {
      over.classList.add('show')
      over.classList.toggle('win', s.win)
      over.classList.toggle('lose', !s.win)
      this.q('overtitle').textContent = s.win ? '逃出黑塔！' : '你已陨落'
      this.q('overmsg').textContent = s.win
        ? '你击败了黑塔之主，穿过了全部 7 层。'
        : '生命归零。可重新开始挑战。'
    } else {
      over.classList.remove('show')
    }
  }
}
