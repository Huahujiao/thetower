// HUD 覆盖层 —— 资源条 / 装备栏 / 手牌 / 日志 / 层间修整 / 横幅 / 目标选择
import './hud.css'
import { rewardText, buffText, itemText } from '../data/cards.js'
import { HAND_LIMIT } from '../game/state.js'

export class HUD {
  constructor(state) {
    this.state = state
    this.root = document.getElementById('hud')
    this._bannerTimer = null
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

      <!-- 牌局场景（flex 中间区域） -->
      <div id="app"></div>

      <!-- 手牌/装备选中操作：场景左下丢弃、右下使用（武器无"使用"） -->
      <div class="card-actions" data=cardactions>
        <button class="act-drop" data=actdrop>丢弃</button>
        <button class="act-use" data=actusebtn>使用</button>
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
          <span class="label">装备栏</span>
          <div class="equip-slot" data=equip0></div>
          <div class="equip-slot" data=equip1></div>
          <div class="equip-slot" data=equip2></div>
        </div>
        <div class="hand-row">
          <div data=hand style="display:flex;gap:8px;"></div>
          <span class="hand-count" data=handcount></span>
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
            <button data=repairbtn title="点击后选择装备栏或手牌中的武器">修理</button>
            <button data=sellbtn title="点击后选择装备栏或手牌中的一张牌">出售</button>
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

    for (let i = 0; i < 3; i++) {
      this.q(`equip${i}`).addEventListener('click', () => this._onEquipClick(i))
    }
    this.q('overbtn').addEventListener('click', () => this._restart())
    this.q('logbtn').addEventListener('click', () => this.q('log').classList.toggle('show'))
    this.q('settingsbtn').addEventListener('click', () => this.q('settings').classList.toggle('show'))
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
    this.q('actusebtn').addEventListener('click', () => this._useSelected())
    this.q('logsend').addEventListener('click', () => this._sendLog())
  }

  // 丢弃当前选中的手牌/装备栏武器
  _dropSelected() {
    const s = this.state
    if (s.gameOver) return
    // 修理/出售目标选择模式下点击走 restPickTarget，此处不处理
    if (s.phase === 'rest' && s.rest && s.rest.mode) return
    if (s.selectedHand !== null) s.discard(s.selectedHand)
    else if (s.armedSlot !== null) s.discardEquip(s.armedSlot)
  }

  // 使用当前选中的手牌（药水/道具/buff；武器无"使用"按钮）
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
    if (s.itemTargetMode !== null) {
      const w = s.equip[i]
      if (w) s.applyItemToWeapon(w.uid)
      return
    }
    if (s.selectedHand !== null) s.switchToEquip(i)
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

  _render() {
    const s = this.state
    this.q('floor').textContent = s.floor + (s.hasBoss() ? '·B' : '')
    this.q('hp').textContent = `${s.player.hp}/${s.player.maxHp}`
    this.q('san').textContent = `${s.player.san}/${s.player.maxSan}`
    this.q('gold').textContent = s.player.gold
    this.q('key').textContent = `${s.player.keys}/${s.player.keysNeeded}`
    this.q('turn').textContent = s.turn

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
    for (let i = 0; i < 3; i++) {
      const slot = this.q(`equip${i}`)
      const w = s.equip[i]
      slot.classList.toggle('filled', !!w)
      slot.classList.toggle('armed', s.armedSlot === i)
      // 绿色高亮目标：道具目标选择模式（装备栏武器可作为道具目标）/ 手牌武器待装入（选中武器时槽位提示）
      slot.classList.toggle('target', (s.itemTargetMode !== null && !!w) || (s.selectedHand !== null && s.hand[s.selectedHand]?.def.atk))
      if (w) {
        const durPct = (w.curDur / w.maxDur) * 100
        const durColor = w.curDur <= 0 ? '#f66' : w.curDur < 4 ? '#fc6' : '#6f6'
        slot.innerHTML = `
          <div class="nm">${w.def.name}</div>
          <div class="sub">${w.def.type} 攻${w.def.atk}${w.pollutAtk ? '(污)' : ''}</div>
          <div class="dur"><i style="width:${durPct}%;background:${durColor}"></i></div>
          <div class="sub">耐久 ${w.curDur}/${w.maxDur}${w.curDur <= 0 ? ' 破损' : ''}${w.maintain > 0 ? ` 保养${w.maintain}` : ''}</div>`
      } else {
        slot.innerHTML = `<div class="sub" style="opacity:0.4">空槽 ${i + 1}</div>`
      }
    }

    // 手牌（空时占位保持布局；右上角显示 X/8 计数）
    const handEl = this.q('hand')
    handEl.innerHTML = ''
    const hc = this.q('handcount')
    hc.textContent = `${s.hand.length}/${HAND_LIMIT}`
    hc.classList.toggle('full', s.hand.length >= HAND_LIMIT)
    if (!s.hand.length) {
      const empty = document.createElement('div')
      empty.className = 'hand-empty'
      empty.textContent = '手牌为空'
      handEl.appendChild(empty)
    }
    const restMode = s.phase === 'rest' && s.rest && s.rest.mode
    const itemTargeting = s.itemTargetMode !== null   // 道具目标选择模式：武器绿色高亮，点击即用
    s.hand.forEach((item, idx) => {
      const div = document.createElement('div')
      const kind = item.def.atk !== undefined ? 'weapon' : (item.def.repair !== undefined || item.def.buff) ? 'item' : (item.def.effect ? 'buff' : 'potion')
      div.className = `hand-card ${kind}`
      if (s.selectedHand === idx) div.classList.add('selected')
      if (itemTargeting && kind === 'weapon') div.classList.add('target')
      let inner = `<div class="nm">${item.def.name}</div>`
      if (kind === 'weapon') {
        const w = item
        const durPct = (w.curDur / w.maxDur) * 100
        inner += `<div class="sub">${w.def.type} 攻${w.def.atk}${w.pollutAtk ? '(污)' : ''} 耐${w.curDur}/${w.maxDur}</div>`
        if (w.tags && w.tags.length) inner += `<div class="tags">${w.tags.join(' ')}</div>`
        inner += `<div class="dur"><i style="width:${durPct}%"></i></div>`
      } else if (kind === 'potion') {
        const heal = item.def.healHp ? `+${item.def.healHp}HP` : `+${item.def.healSan}SAN`
        inner += `<div class="sub">${heal}</div>`
      } else if (kind === 'item') {
        inner += `<div class="sub">${itemText(item.def)}</div>`
      } else if (kind === 'buff') {
        inner += `<div class="sub">${buffText(item.def)}</div>`
      }
      div.innerHTML = inner
      div.addEventListener('click', () => {
        if (restMode) { s.restPickTarget(item.uid); return }
        // 道具目标选择模式：点击武器直接使用道具（无文字列表）
        if (itemTargeting && kind === 'weapon') { s.applyItemToWeapon(item.uid); return }
        // 点击手牌 = 原地放大查看（不执行操作），操作走场景左下丢弃 / 右下使用；武器点装备栏即可装备/替换
        s.selectHand(idx)
      })
      handEl.appendChild(div)
    })

    // 选中操作浮层：仅牌局阶段（explore）显示——手牌选中 → 左下丢弃 + 右下使用（武器只有丢弃）；装备栏武装选中 → 左下丢弃
    // rest 阶段不显示（层间面板铺满场景区，操作走修理/出售/商店）
    const acts = this.q('cardactions')
    const useBtn = this.q('actusebtn')
    if (s.phase !== 'explore') {
      acts.classList.remove('show')
    } else if (s.selectedHand !== null && s.hand[s.selectedHand]) {
      const selItem = s.hand[s.selectedHand]
      const isWeapon = selItem.def.atk !== undefined
      acts.classList.add('show')
      useBtn.style.display = isWeapon ? 'none' : ''
    } else if (s.armedSlot !== null && s.equip[s.armedSlot]) {
      acts.classList.add('show')
      useBtn.style.display = 'none'
    } else {
      acts.classList.remove('show')
    }

    // 层间修整（三选一奖励 → 商店 → 进入下一层；占满场景区）
    const rest = this.q('rest')
    if (s.phase === 'rest' && s.rest) {
      rest.classList.add('show')
      const r = s.rest
      const rewardArea = this.q('restreward')
      const shopArea = this.q('restshop')
      const nextBtn = this.q('nextbtn')
      if (r.step === 'reward') {
        // 三选一奖励：纯卡牌；选完立即转场；可跳过
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
          ? (r.mode === 'repair' ? '点击装备栏或手牌中的武器' : '点击装备栏或手牌中的一张牌')
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
