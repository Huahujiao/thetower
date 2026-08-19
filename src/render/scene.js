// Three.js 3D 场景 —— 卡牌网格、翻牌动画、点击交互
import * as THREE from 'three'
import { T } from '../data/cards.js'

// 牌面比例不再沿用扑克牌（1:1.4），压短为 1.5 : 1.7，信息仍完整显示
const CARD_W = 1.5
const CARD_H = 1.7
const TEX_W = 150           // 纹理逻辑宽（实际像素 ×TEX_S）
const TEX_H = 170           // 纹理逻辑高，与 CARD_W/CARD_H 同比
const TEX_S = 2             // 超采样倍率，保证小字清晰
const GAP_X = 1.65  // 列距（1.5 + 0.15 缝隙）
const GAP_Z = 1.85  // 行距（1.7 + 0.15 缝隙）
const GRID = 4
const GRID_MAX = 6  // 最大棋盘边长（用于拖动边界与桌面尺寸）

// 牌面配色
const TYPE_COLOR = {
  monster: '#5b1a1a', weapon: '#1a2b4a', potion: '#1a3b2a',
  gold: '#4a3a0a', key: '#3a1a4a', exit: '#4a2a0a', entry: '#2a2a2a',
  item: '#2a3b4a',
}
// 牌背类型提示文案（调试"显示牌内容"开关启用时才绘制）
const TYPE_LABEL = {
  monster: '怪物', weapon: '武器', potion: '药水', item: '道具',
  gold: '金币', key: '钥匙', exit: '出口', entry: '入口',
}

export class GameScene {
  constructor(state, container) {
    this.state = state
    this.container = container
    this.cards3d = new Map()   // uid -> { group, frontMesh, backMesh, tex, flipTarget, lift }
    this.animating = []        // 翻牌动画队列
    this.hoveredUid = null
    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()
    this.boardGroup = new THREE.Group()
    this.cardsGroup = new THREE.Group()
    this.boardGroup.add(this.cardsGroup)
    this.scene = null
    this.reveal = (typeof localStorage !== 'undefined' && localStorage.getItem('heita_opt_reveal')) === '1'
    this._drag = null      // 拖动状态
    this._lastDragMoved = false
    this._initThree()
    this._buildBoard()
    this._bindEvents()
    this._applyFloorVisual(this.state.floor || 1)
    this._applyPhase(this.state.phase)
    this._loop = this._loop.bind(this)
    this._loop()
  }

  _initThree() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x14141f)
    this.scene.fog = new THREE.Fog(0x14141f, 14, 28)

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100)
    this._updateCamera()

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(w, h)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.container.appendChild(this.renderer.domElement)

    // 灯光（保留基准强度，供阶段明暗切换）
    const amb = new THREE.AmbientLight(0xffffff, 0.55)
    this.scene.add(amb); this._amb = amb; this._ambBase = 0.55
    const dir = new THREE.DirectionalLight(0xfff0e0, 1.1)
    dir.position.set(6, 12, 6)
    dir.castShadow = true
    dir.shadow.mapSize.set(1024, 1024)
    Object.assign(dir.shadow.camera, { near: 1, far: 40, left: -8, right: 8, top: 8, bottom: -8 })
    this.scene.add(dir); this._dir = dir; this._dirBase = 1.1
    const pt = new THREE.PointLight(0x6c5ce7, 0.8, 20)
    pt.position.set(-4, 5, -3)
    this.scene.add(pt); this._pt = pt; this._ptBase = 0.8

    // 地面：仅网格线（无圆形桌面，避免圆形"光圈"观感）
    const grid = new THREE.GridHelper(20, 20, 0x3a3a5a, 0x2a2a44)
    grid.position.y = -0.04
    grid.material.opacity = 0.35
    grid.material.transparent = true
    this.boardGroup.add(grid)

    this.scene.add(this.boardGroup)

    window.addEventListener('resize', () => this._onResize())
  }

  _gridPos(c, r) {
    return { x: (c - (GRID - 1) / 2) * GAP_X, z: (r - (GRID - 1) / 2) * GAP_Z }
  }

  _buildBoard() {
    for (const card of this.state.board) {
      const { x, z } = this._gridPos(card.c, card.r)
      const group = new THREE.Group()
      group.position.set(x, 0, z)
      group.rotation.x = card.flipped ? 0 : Math.PI
      // 正面
      const frontTex = this._makeFrontTexture(card)
      const frontMat = new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.7 })
      const frontMesh = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), frontMat)
      frontMesh.rotation.x = -Math.PI / 2
      frontMesh.position.y = 0.02
      frontMesh.receiveShadow = true
      // 背面（带浅显类型提示）
      const backTex = this._makeBackTexture(card)
      const backMat = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.7 })
      const backMesh = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), backMat)
      backMesh.rotation.x = Math.PI / 2
      backMesh.position.y = -0.02
      backMesh.userData.uid = card.uid
      frontMesh.userData.uid = card.uid
      group.add(frontMesh)
      group.add(backMesh)
      group.userData.uid = card.uid
      this.cardsGroup.add(group)
      this.cards3d.set(card.uid, {
        group, frontMesh, backMesh, frontTex, backTex,
        flipCurrent: card.flipped ? 0 : Math.PI,
        liftCurrent: 0, hidden: false, glow: false,
      })
      // 读档场景：已生效的牌一开始就不显示
      this._updateVisibility(card)
    }
  }

  // ---------- 牌面绘制 ----------
  // 把 #rrggbb + alpha 转 rgba
  _hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16)
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
  }

  // 建立与 TEX_W×TEX_H 对应的画布上下文（统一超采样）
  _newCanvasCtx() {
    const c = document.createElement('canvas')
    c.width = TEX_W * TEX_S; c.height = TEX_H * TEX_S
    const ctx = c.getContext('2d')
    ctx.scale(TEX_S, TEX_S)
    return { c, ctx }
  }

  // 卡背：深色底 + 简单菱形纹样；调试"显示牌内容"开启时叠加类型提示（顶部色条 + 底部类型名）
  _makeBackTexture(card) {
    const { c, ctx } = this._newCanvasCtx()
    const base = TYPE_COLOR[card.type] || '#333'
    const g = ctx.createLinearGradient(0, 0, 0, TEX_H)
    g.addColorStop(0, '#2a2a4e'); g.addColorStop(1, '#15152a')
    ctx.fillStyle = g; ctx.fillRect(0, 0, TEX_W, TEX_H)
    // 边框
    ctx.strokeStyle = '#4a4a7a'; ctx.lineWidth = 6
    ctx.strokeRect(6, 6, 138, 158)
    // 中央菱形纹样（双层），中心 (75, 85)
    ctx.strokeStyle = 'rgba(130,130,190,0.35)'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(75, 28); ctx.lineTo(112, 85); ctx.lineTo(75, 142); ctx.lineTo(38, 85); ctx.closePath(); ctx.stroke()
    ctx.strokeStyle = 'rgba(130,130,190,0.20)'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(75, 48); ctx.lineTo(97, 85); ctx.lineTo(75, 122); ctx.lineTo(53, 85); ctx.closePath(); ctx.stroke()
    // 四角装饰点
    ctx.fillStyle = 'rgba(150,150,210,0.30)'
    ;[[22, 22], [128, 22], [22, 148], [128, 148]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill()
    })
    // 污染纹路（可见但克制）：紫色裂纹 + 角标
    if (card.pollut) {
      ctx.strokeStyle = 'rgba(190,90,210,0.55)'; ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(18, 18); ctx.lineTo(44, 46); ctx.lineTo(30, 74); ctx.lineTo(58, 100); ctx.lineTo(40, 132)
      ctx.stroke()
      ctx.fillStyle = 'rgba(210,130,230,0.65)'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left'
      ctx.fillText('☣', 8, 20)
      ctx.textAlign = 'center'
    }
    // 调试开关：浅显类型提示
    if (this.reveal) {
      ctx.fillStyle = this._hexA(base, 0.6)
      ctx.fillRect(0, 0, TEX_W, 9)
      ctx.font = 'bold 22px sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.textAlign = 'center'
      ctx.fillText(TYPE_LABEL[card.type] || '', 75, 146)
    }
    const tex = new THREE.CanvasTexture(c)
    tex.anisotropy = 4
    return tex
  }

  // 单独重绘一张牌的卡背（设置开关切换后调用）
  _updateBackTexture(card) {
    const c3 = this.cards3d.get(card.uid)
    if (!c3) return
    c3.backTex.dispose()
    c3.backTex = this._makeBackTexture(card)
    c3.backMesh.material.map = c3.backTex
    c3.backMesh.material.needsUpdate = true
  }

  _makeFrontTexture(card) {
    const { c, ctx } = this._newCanvasCtx()
    const bg = TYPE_COLOR[card.type] || '#333'
    const g = ctx.createLinearGradient(0, 0, 0, TEX_H)
    g.addColorStop(0, bg); g.addColorStop(1, '#0a0a12')
    ctx.fillStyle = g; ctx.fillRect(0, 0, TEX_W, TEX_H)
    ctx.strokeStyle = '#888'; ctx.lineWidth = 3
    ctx.strokeRect(4, 4, 142, 162)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#fff'
    const def = card.def
    switch (card.type) {
      case T.MONSTER: {
        const dead = card.dead || card.monsterHp <= 0
        const isBoss = def.tier === 'B'
        if (isBoss) { ctx.fillStyle = 'rgba(120,10,20,0.5)'; ctx.fillRect(0, 0, TEX_W, TEX_H) }
        ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = isBoss ? '#fbb' : '#fff'; ctx.fillText(def.name, 75, 26)
        ctx.font = '12px sans-serif'; ctx.fillStyle = '#ffa'
        ctx.fillText(isBoss ? `弱点:${card.bossWeakType || '随机'}` : `弱点: ${def.weak}`, 75, 46)
        ctx.font = 'bold 30px sans-serif'; ctx.fillStyle = dead ? '#666' : (isBoss ? '#f66' : '#f55')
        ctx.fillText(dead ? '✕' : `${card.monsterHp}`, 75, 88)
        ctx.font = '12px sans-serif'; ctx.fillStyle = '#fcc'
        let atkLine = `血 ${dead ? 0 : card.monsterHp}/${def.hp}  攻 ${def.atk}`
        if (card.pollut) atkLine += ' ☣'
        ctx.fillText(atkLine, 75, 112)
        if (isBoss) { ctx.fillStyle = '#fbb'; ctx.font = 'bold 12px sans-serif'; ctx.fillText('★ BOSS ★', 75, 134) }
        if (dead) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, TEX_W, TEX_H) }
        break
      }
      case T.WEAPON: {
        const inst = card.inst || {}
        const effAtk = def.atk + (inst.pollutAtk || 0)
        ctx.font = 'bold 15px sans-serif'; ctx.fillText(def.name, 75, 24)
        ctx.font = '12px sans-serif'; ctx.fillStyle = '#aef'
        ctx.fillText(def.type, 75, 42)
        ctx.font = 'bold 26px sans-serif'; ctx.fillStyle = '#9cf'
        ctx.fillText(`${effAtk}`, 75, 74)
        ctx.font = '11px sans-serif'; ctx.fillStyle = '#cce'
        ctx.fillText(`攻 ${effAtk}${inst.pollutAtk ? '(污)' : ''}  耐 ${inst.curDur ?? def.dur}/${inst.maxDur ?? def.dur}`, 75, 96)
        ctx.fillStyle = '#fc6'; ctx.font = '11px sans-serif'
        if (def.tags && def.tags.length) {
          def.tags.slice(0, 3).forEach((t, i) => ctx.fillText(t, 75, 114 + i * 13))
        } else { ctx.fillText('—', 75, 116) }
        break
      }
      case T.POTION: {
        ctx.font = 'bold 15px sans-serif'; ctx.fillText(def.name, 75, 30)
        ctx.font = 'bold 24px sans-serif'; ctx.fillStyle = '#6f6'
        const txt = def.healHp ? `+${def.healHp}HP` : `+${def.healSan}SAN`
        ctx.fillText(txt, 75, 78)
        ctx.font = '11px sans-serif'; ctx.fillStyle = '#9fc'
        ctx.fillText(def.healHp ? '恢复生命' : '恢复理智', 75, 102)
        break
      }
      case T.ITEM: {
        ctx.font = 'bold 14px sans-serif'; ctx.fillText(def.name, 75, 26)
        ctx.font = '11px sans-serif'; ctx.fillStyle = '#9cf'
        if (def.repair !== undefined) {
          ctx.fillText(`修理 +${def.repair} 耐久`, 75, 56)
          ctx.fillText(def.costTurn ? '消耗回合' : '不耗回合', 75, 76)
          if (def.fixBroken) ctx.fillText('可修破损武器', 75, 96)
        } else if (def.buff === 'maintain3') {
          ctx.fillText('3 次攻击', 75, 56)
          ctx.fillText('不耗耐久', 75, 76)
        }
        ctx.fillStyle = '#fc6'; ctx.fillText('道具', 75, 122)
        break
      }
      case T.BUFF: {
        ctx.font = 'bold 14px sans-serif'; ctx.fillText(def.name, 75, 30)
        ctx.font = '11px sans-serif'; ctx.fillStyle = '#9fc'
        ctx.fillText('下次攻击生效', 75, 62)
        ctx.fillStyle = '#fc6'; ctx.fillText('Buff', 75, 122)
        break
      }
      case T.GOLD:
        ctx.font = 'bold 30px sans-serif'; ctx.fillStyle = '#fd5'
        ctx.fillText(`+${def.gold}`, 75, 84)
        ctx.font = '12px sans-serif'; ctx.fillStyle = '#fc9'
        ctx.fillText('金币', 75, 112)
        break
      case T.KEY:
        ctx.font = 'bold 38px sans-serif'; ctx.fillText('🔑', 75, 84)
        ctx.font = '13px sans-serif'; ctx.fillStyle = '#daf'
        ctx.fillText('钥匙碎片', 75, 118)
        break
      case T.EXIT: {
        const active = this.state.exitsActivated()
        if (active) { ctx.fillStyle = 'rgba(40,220,140,0.18)'; ctx.fillRect(0, 0, TEX_W, TEX_H) }
        ctx.font = 'bold 18px sans-serif'
        ctx.fillStyle = active ? '#7fffb0' : '#888'
        ctx.fillText('出口', 75, 74)
        ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = active ? '#bfffd8' : '#666'
        ctx.fillText(active ? '已激活' : '未激活', 75, 100)
        if (active) {
          ctx.font = '11px sans-serif'; ctx.fillStyle = '#8effc8'
          ctx.fillText('点击进入 ▶', 75, 124)
          // 激活描边，配合场景脉冲发光
          ctx.strokeStyle = '#5fffa8'; ctx.lineWidth = 5
          ctx.strokeRect(5, 5, 140, 160)
        }
        break
      }
      case T.ENTRY:
        ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#aaa'
        ctx.fillText('入口', 75, 90)
        break
    }
    // 未拾取的战利品：底部「点击拾取」提示条
    if (this.state.isLoot && this.state.isLoot(card)) {
      ctx.fillStyle = 'rgba(255,213,107,0.85)'
      ctx.fillRect(4, 148, 142, 18)
      ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#241d05'
      ctx.textAlign = 'center'
      ctx.fillText('点击拾取', 75, 161)
    }
    const tex = new THREE.CanvasTexture(c)
    tex.anisotropy = 4
    return tex
  }

  refreshCard(card) {
    if (this._disposed) return
    const c3 = this.cards3d.get(card.uid)
    if (!c3) return
    c3.frontTex.dispose()
    c3.frontTex = this._makeFrontTexture(card)
    c3.frontMesh.material.map = c3.frontTex
    c3.frontMesh.material.needsUpdate = true
  }

  // 已生效的牌（怪物已击败 / 物品已拾取 / 金币钥匙已收）直接从场上隐藏，牌局更清晰
  _updateVisibility(card) {
    const c3 = this.cards3d.get(card.uid)
    if (!c3) return false
    const hidden = this.state.isConsumed(card)
    if (c3.hidden !== hidden) {
      c3.hidden = hidden
      c3.group.visible = !hidden
    }
    return hidden
  }

  refreshAll() {
    if (this._disposed) return
    for (const card of this.state.board) {
      const hidden = this._updateVisibility(card)
      if (!hidden) this.refreshCard(card)
    }
  }

  // ---------- 翻牌动画 ----------
  animateFlip(uid) {
    if (this._disposed) return
    const c3 = this.cards3d.get(uid)
    if (!c3) return
    const card = this.state.getCard(uid)
    const target = card.flipped ? 0 : Math.PI
    this.animating.push({ c3, from: c3.flipCurrent, to: target, t: 0, duration: 0.45 })
  }

  // ---------- 交互 ----------
  _bindEvents() {
    const dom = this.renderer.domElement
    this._onPointerDown = (e) => {
      this._drag = { sx: this.boardGroup.position.x, sz: this.boardGroup.position.z, px: e.clientX, py: e.clientY, moved: false }
    }
    this._onPointerMove = (e) => {
      const rect = dom.getBoundingClientRect()
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      // 拖动平移牌桌
      if (this._drag) {
        const dx = e.clientX - this._drag.px
        const dy = e.clientY - this._drag.py
        if (Math.abs(dx) + Math.abs(dy) > 8) this._drag.moved = true
        if (this._drag.moved) {
          // 屏幕像素 → 世界坐标（按相机高度估算比例）
          const h = this.container.clientHeight
          const vFov = this.camera.fov * Math.PI / 180
          const dist = this.camera.position.length()
          const scale = (2 * Math.tan(vFov / 2) * dist) / h
          const limX = ((GRID_MAX - 1) / 2) * GAP_X + 1.6
          const limZ = ((GRID_MAX - 1) / 2) * GAP_Z + 1.6
          const nx = Math.max(-limX, Math.min(limX, this._drag.sx + dx * scale))
          const nz = Math.max(-limZ, Math.min(limZ, this._drag.sz + dy * scale))
          this.boardGroup.position.set(nx, 0, nz)
        }
      } else {
        this._updateHover()
      }
    }
    this._onPointerUp = () => {
      if (this._drag) { this._lastDragMoved = this._drag.moved; this._drag = null }
    }
    this._onClick = (e) => {
      if (this._lastDragMoved) { this._lastDragMoved = false; return }
      const rect = dom.getBoundingClientRect()
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      this._handleClick()
    }
    dom.addEventListener('pointerdown', this._onPointerDown)
    dom.addEventListener('pointermove', this._onPointerMove)
    dom.addEventListener('pointerup', this._onPointerUp)
    dom.addEventListener('click', this._onClick)

    // 状态事件（持有引用，dispose 时移除，避免每层/重开泄漏监听器）
    this._onFlip = (uid) => this.animateFlip(uid)
    this._onChange = () => this.refreshAll()
    this._onFloor = (e) => this._applyFloorVisual(e.floor)
    this.state.on('animate:flip', this._onFlip)
    this.state.on('change', this._onChange)
    this.state.on('floor:start', this._onFloor)
    this._onPhase = (e) => this._applyPhase(e.phase)
    this.state.on('phase:change', this._onPhase)

    // 设置开关：显示牌内容 → 重绘所有卡背
    this._onReveal = (e) => {
      this.reveal = !!(e && e.detail && e.detail.reveal)
      for (const card of this.state.board) this._updateBackTexture(card)
    }
    window.addEventListener('settings:reveal', this._onReveal)
  }

  // 每层环境视觉：越深越暗红，Boss 层暗红
  _applyFloorVisual(floor) {
    if (this._disposed) return
    const palette = [
      null,
      0x14141f, 0x161320, 0x1a1322, 0x1d1426, 0x221428, 0x26122a, 0x2a0f1a,
    ]
    const col = (palette[floor] !== undefined ? palette[floor] : 0x14141f)
    this.scene.background = new THREE.Color(col)
    if (this.scene.fog) this.scene.fog.color = new THREE.Color(col)
    // 点光随层数偏红
    const tint = floor >= 7 ? 0xff5555 : floor >= 4 ? 0xb070c0 : 0x6c5ce7
    if (this._pt) this._pt.color = new THREE.Color(tint)
  }

  // 阶段明暗：休整时隐藏牌阵、压暗灯光，只留网格背景
  _applyPhase(phase) {
    if (this._disposed) return
    const rest = phase === 'rest'
    if (this.cardsGroup) this.cardsGroup.visible = !rest
    const k = rest ? 0.5 : 1
    if (this._amb) this._amb.intensity = this._ambBase * k
    if (this._dir) this._dir.intensity = this._dirBase * k
    if (this._pt) this._pt.intensity = this._ptBase * k
  }

  _pickCard() {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const meshes = []
    for (const c3 of this.cards3d.values()) {
      const card = this.state.getCard(c3.group.userData.uid)
      if (!card) continue
      if (this.state.isConsumed(card)) continue   // 已隐藏的牌不参与拾取
      meshes.push(card.flipped ? c3.frontMesh : c3.backMesh)
    }
    const hits = this.raycaster.intersectObjects(meshes, false)
    if (hits.length) return hits[0].object.userData.uid
    return null
  }

  _updateHover() {
    const uid = this._pickCard()
    if (uid !== this.hoveredUid) {
      this.hoveredUid = uid
    }
  }

  _handleClick() {
    if (this.state.phase === 'rest') return   // 修整阶段场上无牌可点
    const uid = this._pickCard()
    if (uid == null) return
    const card = this.state.getCard(uid)
    if (!card) return
    if (!card.flipped) {
      this.state.flip(uid)
    } else if (this.state.isLoot(card)) {
      this.state.pickUp(uid)                  // 再点一次才拾取，不消耗回合
    } else if (card.type === T.MONSTER && card.monsterHp > 0) {
      if (this.state.armedSlot !== null) this.state.attack(uid)
      else this.state.log.push('先在装备栏选一把武器再攻击怪物。'), this.state.bus.emit('change')
    } else if (card.type === T.EXIT) {
      this.state.enterExit(uid)
    }
  }

  _onResize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.camera.aspect = w / h
    this._updateCamera()
    this.renderer.setSize(w, h)
  }

  // 统一取景（仅竖屏设计）：fov 45（畸变小）+ 更俯视 66° + 距离 8.8（贴近牌阵，边缘靠拖动平移看全）
  _updateCamera() {
    if (this.camera.clearViewOffset) this.camera.clearViewOffset()
    this.camera.fov = 45
    this.camera.position.set(0, 8, 3.6)
    this.camera.lookAt(0, 0, 0)
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    this._disposed = true
    for (const c3 of this.cards3d.values()) {
      if (c3.frontTex) c3.frontTex.dispose()
      if (c3.backTex) c3.backTex.dispose()
      if (c3.frontMesh.material) c3.frontMesh.material.dispose()
      if (c3.backMesh.material) c3.backMesh.material.dispose()
    }
    const dom = this.renderer.domElement
    dom.removeEventListener('pointerdown', this._onPointerDown)
    dom.removeEventListener('pointermove', this._onPointerMove)
    dom.removeEventListener('pointerup', this._onPointerUp)
    dom.removeEventListener('click', this._onClick)
    this.state.off('animate:flip', this._onFlip)
    this.state.off('change', this._onChange)
    this.state.off('floor:start', this._onFloor)
    this.state.off('phase:change', this._onPhase)
    window.removeEventListener('settings:reveal', this._onReveal)
    this.renderer.dispose()
    if (dom.parentNode) dom.parentNode.removeChild(dom)
  }

  _loop() {
    if (this._disposed) return
    requestAnimationFrame(this._loop)
    const dt = 1 / 60
    // 翻牌动画
    for (let i = this.animating.length - 1; i >= 0; i--) {
      const a = this.animating[i]
      a.t += dt / a.duration
      const k = a.t >= 1 ? 1 : 1 - Math.pow(1 - a.t, 3)
      a.c3.flipCurrent = a.from + (a.to - a.from) * k
      a.c3.group.rotation.x = a.c3.flipCurrent
      // 翻牌时轻微抬升
      a.c3.group.position.y = Math.sin(k * Math.PI) * 0.6
      if (a.t >= 1) { a.c3.group.position.y = 0; this.animating.splice(i, 1) }
    }
    // hover 抬升（仅未翻开且可翻的牌）+ 出口激活脉冲高亮 + 战利品微微上浮
    const now = performance.now() / 1000
    const pulse = 0.5 + 0.5 * Math.sin(now * 3.2)
    const exitReady = this.state.exitsActivated() && this.state.phase === 'explore'
    for (const card of this.state.board) {
      const c3 = this.cards3d.get(card.uid)
      if (!c3 || c3.hidden) continue
      let target = 0
      if (!card.flipped && card.uid === this.hoveredUid && this.state.isAdjacentToFlipped(card) && !this.state.gameOver) {
        target = 0.4
      }
      // 出口牌：钥匙集齐后脉冲发光并抬起，一眼可见
      const mat = c3.frontMesh.material
      if (card.type === T.EXIT && card.flipped && exitReady) {
        mat.emissive.setHex(0x2fd98a)
        mat.emissiveIntensity = 0.25 + 0.55 * pulse
        c3.glow = true
        target = Math.max(target, 0.16 + 0.10 * pulse)
      } else if (this.state.isLoot(card)) {
        // 待拾取战利品：淡淡的暖色呼吸，提示可点
        mat.emissive.setHex(0xffd56b)
        mat.emissiveIntensity = 0.06 + 0.10 * pulse
        c3.glow = true
      } else if (c3.glow) {
        mat.emissive.setHex(0x000000)
        mat.emissiveIntensity = 0
        c3.glow = false
      }
      c3.liftCurrent += (target - c3.liftCurrent) * 0.2
      if (this.animating.findIndex(x => x.c3 === c3) === -1) {
        c3.group.position.y = c3.liftCurrent
      }
    }
    this.renderer.render(this.scene, this.camera)
  }
}
