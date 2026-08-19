// 游戏状态与行动逻辑 —— M2 + M3 全系统
import {
  buildFloorDeck, FLOORS, ENVIRONMENTS, ROUTES, T, BUFFS,
  MONSTERS, WEAPONS, POTIONS, ITEMS, DEFS_BY_ID, getDef,
  buildShopStock, buildRewardChoices,
  priceOf, SHOP_EVERY,
} from '../data/cards.js'

// 手牌上限（核心机制.md §13.1）
export const HAND_LIMIT = 8
// 每层结束（进入层间修整）固定恢复的理智（核心机制.md §11）
export const FLOOR_SAN_RECOVER = 6
// 可拾取（会占用手牌）的牌型
const LOOT_TYPES = [T.WEAPON, T.POTION, T.ITEM, T.BUFF]

// ---------- 战斗公式 ----------
function weaponPower(w) {
  let p = w.def.atk + (w.pollutAtk || 0)
  if (w.tags.includes('锋锐')) p += 2
  if (w.tags.includes('锋锐+1')) p += 1
  return p
}
function durFactor(cur) {
  if (cur <= 0) return 0
  if (cur >= 7) return 1
  if (cur >= 4) return 0.8
  return 0.6
}
const COUNTER = { '劈砍': 'blood', '穿刺': 'shell', '钝击': 'spirit', '元素': 'spirit' }
const WEAKTO  = { '劈砍': 'shell', '穿刺': 'spirit', '钝击': 'blood', '元素': 'shell' }
function catOf(wType) { return COUNTER[wType] }
function counterMult(wType, mon) {
  if (COUNTER[wType] === mon.category) return 1.3
  if (WEAKTO[wType] === mon.category) return 0.7
  return 1.0
}
function computeDamage(w, def, buff) {
  let mult = counterMult(w.def.type, def)
  if (buff && buff.ignoreCounter) mult = 1.3
  if (w.tags.includes('元素亲和') && w.def.type === '元素' && def.category === 'spirit') mult = 2.0
  const power = weaponPower(w) + (buff ? (buff.atk || 0) : 0)
  const atk = Math.floor(power * durFactor(w.curDur))
  let dmg = Math.floor(atk * mult)
  if (buff && buff.bonus) dmg += buff.bonus
  if (w.tags.includes('屠魔') && def.category === 'blood') dmg += Math.floor(dmg * 0.3)
  if (w.tags.includes('破甲') && def.category === 'shell') dmg += Math.floor(dmg * 0.3)
  if (w.tags.includes('驱灵') && def.category === 'spirit') dmg += Math.floor(dmg * 0.3)
  let crit = false
  if ((w.tags.includes('致命') && Math.random() < 0.15) || (buff && buff.forceCrit)) { crit = true; dmg = Math.floor(dmg * 1.5) }
  return { dmg: Math.max(1, dmg), crit }
}

// ---------- 情绪系统（理智 → 周期情绪 roll）----------
// 每 5 回合根据当前理智比例 roll 一种情绪，持续至下次 roll。
// 理智越低，越容易 roll 到负面情绪，把"理智"变成必须主动管理的资源。
const EMOTIONS = {
  calm:   { name: '镇定', tone: 'good',  atkMul: 1.15, defMul: 0.85, dropMul: 1.0, miss: 0,   desc: '攻击+15% 受伤-15%' },
  brave:  { name: '勇敢', tone: 'good',  atkMul: 1.25, defMul: 1.10, dropMul: 1.0, miss: 0,   desc: '攻击+25% 受伤+10%' },
  frenzy: { name: '狂乱', tone: 'mixed', atkMul: 1.40, defMul: 1.40, dropMul: 1.0, miss: 0,   desc: '攻击+40% 受伤+40%（双刃）' },
  fear:   { name: '恐惧', tone: 'bad',   atkMul: 1.00, defMul: 1.35, dropMul: 1.0, miss: 0.2, desc: '受伤+35% 攻击20%落空' },
  gloom:  { name: '悲观', tone: 'bad',   atkMul: 0.80, defMul: 1.00, dropMul: 0.7, miss: 0,   desc: '攻击-20% 掉落-30%' },
}
const EMOTION_IDS = Object.keys(EMOTIONS)
function rollEmotionId(san, maxSan) {
  const ratio = maxSan > 0 ? san / maxSan : 0
  let weights
  if (ratio >= 0.6)      weights = { calm: 4, brave: 3, frenzy: 1, fear: 1, gloom: 1 }
  else if (ratio >= 0.2) weights = { calm: 2, brave: 2, frenzy: 2, fear: 2, gloom: 2 }
  else                   weights = { calm: 1, brave: 1, frenzy: 2, fear: 4, gloom: 4 }
  const total = EMOTION_IDS.reduce((s, id) => s + (weights[id] || 0), 0)
  let r = Math.random() * total
  for (const id of EMOTION_IDS) { r -= (weights[id] || 0); if (r <= 0) return id }
  return 'calm'
}

// ---------- 简易事件 ----------
function makeEmitter() {
  const map = {}
  return {
    on(ev, cb) { (map[ev] ||= []).push(cb) },
    off(ev, cb) { if (map[ev]) map[ev] = map[ev].filter(f => f !== cb) },
    emit(ev, payload) { (map[ev] || []).forEach(cb => cb(payload)) },
  }
}
let UID = 0

const SAVE_KEY = 'heita_save_v1'
// 存档版本号：任何破坏性数值/机制改动后 bump 此值，旧档自动作废（初期开发不保留旧档）
// v4：三选一奖励纯卡牌+可跳过、手牌满奖励直接使用/装备、手牌点击放大+浮层操作按钮、装备栏可丢弃、修理出售仅商店
const SAVE_VERSION = 4

export class GameState {
  constructor() {
    this.bus = makeEmitter()
    this.on = this.bus.on.bind(this.bus)
    this.off = this.bus.off.bind(this.bus)
    this.reset()
    this._loaded = this.load()
  }

  reset() {
    this.floor = 1
    this.turn = 0
    this.gameOver = false
    this.win = false
    this.player = { hp: 20, maxHp: 20, san: 30, maxSan: 30, gold: 0, keys: 0, keysNeeded: 3 }
    this.hand = []
    this.equip = [null, null, null]
    this.armedSlot = null
    this.selectedHand = null
    this.log = []
    this.pendingBuff = null       // 待生效的下次攻击 buff
    this.pendingBuffName = null   // 待生效 buff 名称（HUD 显示用）
    this.thorns = 0              // 荆棘守护：下一次怪物攻击减伤
    this.buffUsedThisTurn = false
    this.itemTargetMode = null    // 正在选择目标的道具在手牌中的索引
    this._mod = { label: '' }     // 当前层修饰（环境/路线）
    this._pendingNextMod = null   // 下一层修饰（出口/环境决定）
    this._sanCostExtra = 0
    this.emotion = null
    this._bossTowerCount = 0
    this.rest = null              // 层间修整状态（三选一奖励 / 商店 / 确认流）
    this._phase = 'explore'
    this._buildBoard(1)
    this.log.push('进入黑塔第 1 层。翻开相邻的牌开始探索。')
    this._loaded = false
    this.bus.emit('change')
  }

  get madness() { return !this.gameOver && this.player.san <= 0 }

  // 阶段状态机：over 由 gameOver 派生；其余为 explore / rest / event
  get phase() { return this.gameOver ? 'over' : this._phase }
  setPhase(p) {
    if (this.gameOver) return
    if (this._phase === p) return
    this._phase = p
    this.bus.emit('phase:change', { phase: p })
    this.bus.emit('change')
  }

  // 情绪查询（供 HUD / 战斗公式读取）
  emotionDef() { return this.emotion ? EMOTIONS[this.emotion] : null }
  emotionAtkMul() { const e = EMOTIONS[this.emotion]; return e ? e.atkMul : 1 }
  emotionDefMul() { const e = EMOTIONS[this.emotion]; return e ? e.defMul : 1 }
  emotionDropMul() { const e = EMOTIONS[this.emotion]; return e ? e.dropMul : 1 }
  emotionMissChance() { const e = EMOTIONS[this.emotion]; return e ? e.miss : 0 }

  // ---------- 棋盘生成 ----------
  _buildBoard(floor) {
    const { deck } = buildFloorDeck(floor, this._mod)
    // 洗牌
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[deck[i], deck[j]] = [deck[j], deck[i]]
    }
    const cfg = FLOORS[floor - 1]
    const GRID = cfg.grid
    const cells = []
    for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) cells.push({ c, r })
    // 入口固定放中心并翻开
    const entryIdx = deck.findIndex(d => d.type === T.ENTRY)
    const entryCard = deck.splice(entryIdx, 1)[0]
    const center = { c: Math.floor((GRID - 1) / 2), r: Math.floor((GRID - 1) / 2) }
    const entryCell = cells.find(p => p.c === center.c && p.r === center.r)
    cells.splice(cells.indexOf(entryCell), 1)
    this.board = []
    for (const raw of deck) {
      const cell = cells.shift()
      this.board.push(this._makeCard(raw, cell.c, cell.r))
    }
    this.board.push(this._makeCard(entryCard, center.c, center.r, true))
  }

  // 统一的手牌实例工厂：所有实例都带 uid，便于层间修理/出售按 uid 定位
  _mkInst(def) {
    const inst = { uid: ++UID, def }
    if (def.atk !== undefined) {
      inst.tags = [...(def.tags || [])]
      inst.curDur = def.dur
      inst.maxDur = def.dur
      inst.maintain = 0
      inst.pollutAtk = 0
    }
    return inst
  }

  _makeCard(raw, c, r, flipped = false) {
    const card = {
      uid: ++UID, type: raw.type, def: raw.def, c, r, flipped, pollut: !!raw.pollut,
      dead: false, monsterHp: null, inst: null, picked: false, taken: false,
      _slowTurns: 0, _burnTurns: 0,
    }
    if (raw.type === T.MONSTER) {
      card.monsterHp = raw.def.hp
      if (raw.def.tier === 'B') { // Boss：弱点每回合轮换
        card.bossWeakType = ['劈砍', '穿刺', '钝击', '元素'][Math.floor(Math.random() * 4)]
        card.def = { ...raw.def, category: catOf(card.bossWeakType) }
      }
    }
    if (LOOT_TYPES.includes(raw.type)) card.inst = this._mkInst(raw.def)
    // 污染纹路在牌背可见；污染数值在翻开时结算
    return card
  }

  // 已生效/已消耗的牌（3D 场景直接隐藏，让牌局更清晰）
  isConsumed(card) {
    if (!card || !card.flipped) return false
    if (card.type === T.MONSTER) return !!card.dead || card.monsterHp <= 0
    if (card.type === T.GOLD || card.type === T.KEY) return !!card.taken
    if (LOOT_TYPES.includes(card.type)) return !!card.picked
    return false
  }
  // 场上尚未拾取的战利品牌
  isLoot(card) {
    return !!card && card.flipped && !card.picked && LOOT_TYPES.includes(card.type)
  }
  handFull() { return this.hand.length >= HAND_LIMIT }

  // ---------- 查询 ----------
  getCard(uid) { return this.board.find(b => b.uid === uid) }
  monstersOnBoard() { return this.board.filter(b => b.type === T.MONSTER && b.flipped && b.monsterHp > 0) }
  isAdjacentToFlipped(card) {
    return this.board.some(b => b.flipped && Math.abs(b.c - card.c) <= 1 && Math.abs(b.r - card.r) <= 1 && b.uid !== card.uid)
  }
  exitsActivated() { return this.player.keys >= this.player.keysNeeded }
  hasBoss() { return this.board.some(b => b.type === T.MONSTER && b.def.tier === 'B') }

  findWeapon(instUid) {
    for (const e of this.equip) if (e && e.uid === instUid) return e
    for (const h of this.hand) if (h && h.uid === instUid) return h
    return null
  }

  // 怪物对玩家的实际攻击力（含污染/狂暴/Boss/减速/疯狂/环境）
  monsterAttackValue(card) {
    let atk = card.def.atk
    if (card.pollut) atk = Math.floor(atk * 1.5)
    if (card.def.tier === 'B' && card.monsterHp < 20) atk += 2   // 狂暴
    if (this._mod && this._mod.monAtkMalus) atk = Math.max(0, atk - this._mod.monAtkMalus)
    if (card._slowTurns > 0) atk = Math.max(0, atk - 1)
    const em = this.emotionDef()
    if (em) atk = Math.floor(atk * em.defMul)
    return Math.max(0, atk)
  }

  // ---------- 回合推进（Boss 轮换 / 塔威） ----------
  _tickTurn(card) {
    this.turn++
    if (this.turn % 5 === 0 && !this.gameOver) this._rollEmotion()
    this.buffUsedThisTurn = false
    this._rotateBoss()
    this._bossTowerCount++
    if (this._bossTowerCount % 3 === 0 && this.hasBoss()) {
      this.player.hp -= 1
      this.log.push('黑塔之主发动「塔威」，你受到 1 点无视防御的伤害。')
    }
    if (card && card._slowTurns > 0) card._slowTurns--
    this._processBurns()
  }
  // 火焰灼烧结算：每回合对处于燃烧状态的怪物造成 1 点伤害（武器.md「火焰溅射」词条）
  _processBurns() {
    for (const card of this.board) {
      if (card.type === T.MONSTER && card._burnTurns > 0 && card.monsterHp > 0) {
        card.monsterHp -= 1
        card._burnTurns -= 1
        this.log.push(`${card.def.name} 被火焰灼烧，受到 1 点伤害${card._burnTurns > 0 ? '' : '（熄灭）'}。`)
        if (card.monsterHp <= 0) this._onMonsterKilled(card, null)
      }
    }
  }
  _adjacent(a, b) {
    return Math.abs(a.c - b.c) <= 1 && Math.abs(a.r - b.r) <= 1
  }
  // 连锁闪电：对目标相邻的随机一只存活怪物造成 2 点闪电伤害（武器.md「连锁闪电」词条）
  _chainLightning(card, w) {
    const adj = this.board.filter(b =>
      b.type === T.MONSTER && b.flipped && b.monsterHp > 0 &&
      b.uid !== card.uid && this._adjacent(b, card))
    if (!adj.length) return
    const t = adj[Math.floor(Math.random() * adj.length)]
    t.monsterHp -= 2
    this.log.push(`连锁闪电跳跃至 ${t.def.name}，造成 2 点闪电伤害。`)
    if (t.monsterHp <= 0) this._onMonsterKilled(t, w)
  }
  _rollEmotion() {
    const id = rollEmotionId(this.player.san, this.player.maxSan)
    this.emotion = id
    const e = EMOTIONS[id]
    this.log.push(`情绪涌动：你陷入「${e.name}」——${e.desc}。`)
  }
  _rotateBoss() {
    for (const c of this.board) {
      if (c.type === T.MONSTER && c.def.tier === 'B') {
        c.bossWeakType = ['劈砍', '穿刺', '钝击', '元素'][Math.floor(Math.random() * 4)]
        c.def = { ...c.def, category: catOf(c.bossWeakType) }
      }
    }
  }

  // ---------- 行动：翻牌 ----------
  flip(uid, internal = false) {
    if (this.gameOver) return
    if (this.phase === 'rest') return   // 修整阶段不翻牌，仅允许调整装备/手牌
    if (this.madness && !internal) return this._madnessAct()
    const card = this.getCard(uid)
    if (!card || card.flipped) return
    if (!this.isAdjacentToFlipped(card)) { this.log.push('只能翻开与已翻开牌相邻的牌。'); this.bus.emit('change'); return }

    card.flipped = true
    this._tickTurn(card)
    // 理智消耗（内容驱动：探索免费，翻出怪物才扣；环境可加重）
    const sanCost = card.type === T.MONSTER ? 2 + this._sanCostExtra : 0
    if (sanCost && this.player.san > 0) { this.player.san = Math.max(0, this.player.san - sanCost); this.log.push(`直面${card.def.name}，理智 -${sanCost}。`) }
    this.bus.emit('animate:flip', uid)
    this._resolveFlip(card)
    if (this.gameOver) return
    this._monsterAttackAll(card.uid)
    this._checkDead()
    this.bus.emit('change')
    this._save()
  }

  _resolveFlip(card) {
    switch (card.type) {
      case T.MONSTER:
        this.log.push(`翻出怪物：${card.def.name}（${card.monsterHp}/${card.def.hp} 血，攻 ${card.def.atk}）。它本回合不攻击。`)
        if (card.pollut) this.log.push('（污染）该怪物攻击 +50%、掉落翻倍。')
        if (card.def.tier === 'B') this.log.push('⚠ 这是黑塔之主！弱点每回合轮换。')
        break
      // 战利品牌：翻开后留在场上，需再点击一次才拾取（不消耗回合），以配合手牌上限
      case T.WEAPON: {
        if (card.pollut) {
          card.inst.pollutAtk = 2
          card.inst.maxDur = Math.max(1, card.inst.maxDur - 2)
          card.inst.curDur = Math.min(card.inst.curDur, card.inst.maxDur)
          this.log.push(`（污染武器）攻击 +2，最大耐久 -2。`)
        }
        this.log.push(`发现武器：${card.inst.def.name}（${card.inst.def.type}，攻 ${weaponPower(card.inst)}，耐久 ${card.inst.curDur}/${card.inst.maxDur}）。点击卡牌拾取。`)
        break
      }
      case T.POTION:
        this.log.push(`发现药水：${card.inst.def.name}。点击卡牌拾取。`)
        break
      case T.ITEM:
        this.log.push(`发现道具：${card.inst.def.name}。点击卡牌拾取。`)
        break
      case T.BUFF:
        this.log.push(`发现 buff：${card.inst.def.name}。点击卡牌拾取。`)
        break
      case T.GOLD:
        this.player.gold += card.def.gold
        card.taken = true
        this.log.push(`捡起 ${card.def.name}，+${card.def.gold} 金币。`)
        if (card.pollut) { this.player.san = Math.max(0, this.player.san - 1); this.log.push('（污染金币）失去 1 点理智。') }
        break
      case T.KEY:
        this.player.keys++
        card.taken = true
        this.log.push(`钥匙碎片！(${this.player.keys}/${this.player.keysNeeded})`)
        if (this.exitsActivated()) this.log.push('钥匙碎片集齐，出口已激活！点击出口牌进入修整阶段。')
        break
      case T.EXIT:
        this.log.push(`翻出出口牌。${this.exitsActivated() ? '已激活，可点击进入下一层。' : '钥匙碎片不足，尚未激活。'}`)
        break
      case T.ENTRY:
        break
    }
  }

  // ---------- 行动：拾取场上战利品（不消耗回合，不触发怪物攻击）----------
  pickUp(uid) {
    if (this.gameOver) return
    if (this.phase === 'rest') return
    const card = this.getCard(uid)
    if (!this.isLoot(card)) return
    if (this.handFull()) {
      this.log.push(`手牌已满（${this.hand.length}/${HAND_LIMIT}），先使用或弃掉一张，物品会留在原地。`)
      this.bus.emit('change')
      return
    }
    // 污染战利品的负面在拾取时结算（药水减半 / buff 与道具额外失 1 理智）
    if (card.pollut) {
      if (card.type === T.POTION) { card.inst.pollutHeal = true; this.log.push('（污染药水）治疗效果减半。') }
      if (card.type === T.ITEM) { card.inst.pollutItem = true }
      if (card.type === T.BUFF) { card.inst.pollutBuff = true }
    }
    this.hand.push(card.inst)
    card.picked = true
    this.log.push(`拾取 ${card.inst.def.name}（${this.hand.length}/${HAND_LIMIT}，不消耗回合）。`)
    this.bus.emit('change')
    this._save()
  }

  // ---------- 失控状态：理智耗尽时，本回合行动随机化（一过性，结束后恢复控制）----------
  _madnessAct() {
    const flippable = this.board.filter(c => !c.flipped && this.isAdjacentToFlipped(c))
    const mons = this.monstersOnBoard()
    const recover = () => { this.player.san = Math.max(this.player.san, 3) }
    if ((flippable.length && Math.random() < 0.6) || !mons.length) {
      if (flippable.length) { this.flip(flippable[Math.floor(Math.random() * flippable.length)].uid, true); recover(); return }
      this.log.push('（失控）无牌可翻，你原地颤抖。'); recover(); this.bus.emit('change'); return
    }
    // 随机攻击
    const wIdx = this.equip.findIndex(w => w && w.curDur > 0)
    if (wIdx >= 0) {
      this.armedSlot = wIdx
      this.attack(mons[Math.floor(Math.random() * mons.length)].uid, true)
    } else {
      this.log.push('（失控）你挥舞空拳，什么也没做。')
      this._tickTurn()
      this._monsterAttackAll()
      this._checkDead()
      this.bus.emit('change')
      this._save()
    }
    recover()
  }

  // ---------- 行动：攻击 ----------
  armWeapon(slotIdx) {
    if (this.gameOver) return
    if (!this.equip[slotIdx]) { this.log.push('该装备栏为空。'); this.bus.emit('change'); return }
    this.armedSlot = this.armedSlot === slotIdx ? null : slotIdx
    this.selectedHand = null
    if (this.armedSlot !== null) {
      const w = this.equip[this.armedSlot]
      if (w.curDur <= 0) { this.log.push(`${w.def.name} 已破损，无法攻击。`); this.armedSlot = null }
      else this.log.push(`已装备 ${w.def.name}，点击场上怪物攻击。`)
    }
    this.bus.emit('change')
  }

  attack(uid, internal = false) {
    if (this.gameOver) return
    if (this.madness && !internal) return this._madnessAct()
    if (this.armedSlot === null) { this.log.push('先在装备栏选择一把武器。'); this.bus.emit('change'); return }
    const card = this.getCard(uid)
    if (!card || !card.flipped || card.type !== T.MONSTER || card.monsterHp <= 0) {
      this.log.push('请点击一个存活的怪物。'); this.bus.emit('change'); return
    }
    const w = this.equip[this.armedSlot]
    if (!w || w.curDur <= 0) { this.log.push('武器破损，无法攻击。'); this.armedSlot = null; this.bus.emit('change'); return }

    this._tickTurn(card)
    const buff = this.pendingBuff
    const em = this.emotionDef()
    let { dmg, crit } = computeDamage(w, card.def, buff)
    if (em) {
      if (em.miss && Math.random() < em.miss) { this.log.push(`（${em.name}）攻击落空！`); dmg = 0 }
      else dmg = Math.floor(dmg * em.atkMul)
    }
    card.monsterHp -= dmg
    // 吸血符文
    if (buff && buff.lifesteal) {
      const h = Math.floor(dmg * buff.lifesteal)
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + h)
      this.log.push(`吸血 +${h} 生命。`)
    }
    // 火焰溅射：点燃目标（2 回合，每回合 1 伤害）
    if (w.tags.includes('火焰溅射') && card.monsterHp > 0) {
      card._burnTurns = 2
      this.log.push(`${card.def.name} 被点燃，接下来 2 回合每回合受到 1 点火焰伤害。`)
    }
    // 减速：目标攻击 -1 持续 1 回合
    if (buff && buff.slowTarget) card._slowTurns = 1
    // 武器耐久
    if (buff && buff.noDurLoss) { /* 磨刀油：不消耗 */ }
    else if (w.maintain > 0) { w.maintain--; }
    else w.curDur = Math.max(0, w.curDur - 1)
    // 清除待生效 buff
    this.pendingBuff = null
    this.pendingBuffName = null

    this.log.push(
      `${w.def.name} → ${card.def.name}，造成 ${dmg}${crit ? '(暴击!)' : ''} 伤害；`
    )
    // 仅该怪物反击（其他怪物不额外攻击）
    let counter = this.monsterAttackValue(card)
    if (this.thorns) { counter = Math.max(0, counter - this.thorns); this.thorns = 0 }
    this.player.hp -= counter
    this.log.push(`${card.def.name} 反击 ${counter}。武器耐久 ${w.curDur}/${w.maxDur}${w.maintain > 0 ? `（保养剩${w.maintain}）` : ''}。`)

    // 连锁闪电：对目标相邻的随机一只怪物造成 2 点闪电伤害（不触发反击）
    if (w.tags.includes('连锁闪电')) this._chainLightning(card, w)

    this.armedSlot = null
    if (card.monsterHp <= 0) this._onMonsterKilled(card, w)
    if (this._checkDead()) return
    this.bus.emit('change')
    this._save()
  }

  _onMonsterKilled(card, w) {
    const isBoss = card.def.tier === 'B'
    this.log.push(`${card.def.name} 被击败！`)
    if (w && w.tags.includes('吸血')) { this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2); this.log.push('吸血 +2 生命。') }
    if (w && w.tags.includes('噬魂')) { this.player.san = Math.min(this.player.maxSan, this.player.san + 3); this.log.push('噬魂 +3 理智。') }
    const d = card.def.drop || {}
    // 金币（污染×2、战斗之路×goldMult）
    let goldDrop = 0
    if (d.gold) goldDrop = d.gold[0] + Math.floor(Math.random() * (d.gold[1] - d.gold[0] + 1))
    if (card.pollut) goldDrop *= 2
    if (this._mod.goldMult) goldDrop = Math.floor(goldDrop * this._mod.goldMult)
    if (w && w.tags.includes('贪婪')) goldDrop += 2
    goldDrop = Math.floor(goldDrop * this.emotionDropMul())
    if (goldDrop) { this.player.gold += goldDrop; this.log.push(`掉落 ${goldDrop} 金币。`) }
    // 钥匙（古老回响提升概率；悲观情绪降低掉落）
    const keyChance = (d.key || 0) * (1 + (this._mod.keyDropBonus || 0)) * this.emotionDropMul()
    if (keyChance && Math.random() < keyChance) { this.player.keys++; this.log.push(`掉落钥匙碎片！(${this.player.keys}/${this.player.keysNeeded})`) }
    // 药水
    if (d.potion && Math.random() < d.potion) {
      const p = POTIONS[Math.floor(Math.random() * POTIONS.length)]
      if (!this.handFull()) { this.hand.push(this._mkInst(p)); this.log.push(`掉落药水：${p.name}。`) }
      else this.log.push('手牌已满，药水掉落丢失。')
    }
    // 稀有武器（精英）
    if (d.rareWeapon && Math.random() < d.rareWeapon) {
      const rw = WEAPONS.filter(x => x.rarity === '稀有' || x.rarity === '传说')
      const wdef = rw[Math.floor(Math.random() * rw.length)]
      if (!this.handFull()) { this.hand.push(this._mkInst(wdef)); this.log.push(`掉落武器：${wdef.name}！`) }
      else this.log.push('手牌已满，武器掉落丢失。')
    }
    // 道具（三阶及以上怪物 15% 掉落随机道具，docs/道具.md）
    const tier = String(card.def.tier)
    if ((tier === '3' || tier === 'E') && Math.random() < 0.15) {
      const itDef = ITEMS[Math.floor(Math.random() * ITEMS.length)]
      if (!this.handFull()) { this.hand.push(this._mkInst(itDef)); this.log.push(`掉落道具：${itDef.name}。`) }
      else this.log.push('手牌已满，道具掉落丢失。')
    }
    if (isBoss) { this.win = true; this.gameOver = true; this.log.push('黑塔之主倒下，你逃离了黑塔！🎉'); this.clearSave() }
    card.dead = true
  }

  // ---------- 行动：切武器（消耗回合）----------
  selectHand(idx) {
    if (this.gameOver) return
    this.selectedHand = this.selectedHand === idx ? null : idx
    this.armedSlot = null
    // 选中需要选择目标的道具（磨刀石/保养油/备用刀刃）→ 直接进入目标选择模式，备选武器绿色高亮，点击即用
    const item = this.selectedHand !== null ? this.hand[this.selectedHand] : null
    if (item && item.def && (item.def.repair !== undefined || item.def.buff)) {
      if (this.itemTargetMode !== this.selectedHand) {
        this.itemTargetMode = this.selectedHand
        this.log.push(`${item.def.name}：点击绿色高亮的武器使用。`)
      }
    } else {
      this.itemTargetMode = null
    }
    this.bus.emit('change')
  }

  switchToEquip(slotIdx) {
    if (this.gameOver) return
    if (this.madness) return this._madnessAct()
    if (this.selectedHand === null) { this.log.push('先在手牌中选择一把武器。'); this.bus.emit('change'); return }
    const handItem = this.hand[this.selectedHand]
    if (!handItem || !handItem.def.atk) { this.log.push('只能把武器放入装备栏。'); this.bus.emit('change'); return }
    const old = this.equip[slotIdx]
    this.equip[slotIdx] = handItem
    this.hand.splice(this.selectedHand, 1)
    if (old) this.hand.push(old)
    this.selectedHand = null
    this.armedSlot = null
    // 层间修整阶段自由调整装备/手牌，不消耗回合（核心机制.md §12）
    if (this.phase === 'rest') {
      this.log.push(`层间调整：${handItem.def.name} 装入装备栏（不消耗回合）。`)
      this.bus.emit('change')
      this._save()
      return
    }
    this._tickTurn()
    this.log.push(`切换武器：${handItem.def.name} 装入装备栏。`)
    this._monsterAttackAll()
    if (this._checkDead()) return
    this.bus.emit('change')
    this._save()
  }

  // ---------- 行动：药水（不消耗回合）----------
  usePotion(idx) {
    if (this.gameOver) return
    const p = this.hand[idx]
    if (!p || p.def.healHp === undefined) { this.log.push('请选择一张药水牌。'); this.bus.emit('change'); return }
    let hp = p.def.healHp || 0, san = p.def.healSan || 0
    if (p.pollutHeal) { hp = Math.floor(hp / 2); san = Math.floor(san / 2) } // 污染药水减半
    if (hp) { this.player.hp = Math.min(this.player.maxHp, this.player.hp + hp); this.log.push(`使用 ${p.def.name}，+${hp} 生命。`) }
    if (san) { this.player.san = Math.min(this.player.maxSan, this.player.san + san); this.log.push(`使用 ${p.def.name}，+${san} 理智。`) }
    this.hand.splice(idx, 1)
    this.selectedHand = null
    this.bus.emit('change')
    this._save()
  }

  // ---------- 行动：一次性 Buff（不消耗回合，每回合限 1 张）----------
  useBuff(idx) {
    if (this.gameOver) return
    const b = this.hand[idx]
    if (!b || !b.def.effect) { this.log.push('请选择一张 buff 牌。'); this.bus.emit('change'); return }
    if (this.buffUsedThisTurn) { this.log.push('每回合限用 1 张 buff 牌。'); this.bus.emit('change'); return }
    const e = b.def.effect
    if (e.sanNow) { this.player.san = Math.min(this.player.maxSan, this.player.san + e.sanNow); this.log.push(`${b.def.name}：理智 +${e.sanNow}。`) }
    if (e.hpCost) { this.player.hp -= e.hpCost; this.log.push(`${b.def.name}：失去 ${e.hpCost} 生命。`) }
    if (e.thorns) { this.thorns = (this.thorns || 0) + e.thorns; this.log.push(`${b.def.name}：下次受怪攻击 -${e.thorns}。`) }
    if (b.pollutBuff) { this.player.san = Math.max(0, this.player.san - 1); this.log.push('（污染 buff）额外失去 1 点理智。') }
    this.pendingBuff = {
      atk: e.atk || 0, lifesteal: e.lifesteal || 0, ignoreCounter: !!e.ignoreCounter,
      bonus: e.bonus || 0, forceCrit: !!e.forceCrit, noDurLoss: !!e.noDurLoss,
      slowTarget: e.slowTarget || 0, purify: !!e.purify,
    }
    this.pendingBuffName = b.def.name
    this.hand.splice(idx, 1)
    this.selectedHand = null
    this.buffUsedThisTurn = true
    this.log.push(`${b.def.name} 已就绪，下次攻击生效。`)
    if (this._checkDead()) return
    this.bus.emit('change')
    this._save()
  }

  // ---------- 行动：道具（磨刀石/保养油/备用刀刃）----------
  // 进入/退出目标选择模式：备选武器绿色高亮，点击武器即直接使用（无文字列表）
  useItem(idx) {
    if (this.gameOver) return
    const it = this.hand[idx]
    if (!it || !it.def.repair && !it.def.buff) { this.log.push('请选择一件道具。'); this.bus.emit('change'); return }
    if (it.def.costTurn && this.madness) return this._madnessAct()
    if (this.itemTargetMode === idx) {
      this.itemTargetMode = null
      if (this.selectedHand === idx) this.selectedHand = null
      this.log.push(`已取消使用 ${it.def.name}。`)
    } else {
      this.itemTargetMode = idx
      this.log.push(`${it.def.name}：点击绿色高亮的武器使用。`)
    }
    this.bus.emit('change')
  }

  applyItemToWeapon(instUid) {
    const idx = this.itemTargetMode
    if (idx == null) return
    const it = this.hand[idx]
    if (!it) { this.itemTargetMode = null; return }
    const w = this.findWeapon(instUid)
    if (!w) return
    if (it.def.buff === 'maintain3') {
      w.maintain = 3
      this.log.push(`保养油：接下来 3 次攻击不消耗 ${w.def.name} 的耐久。`)
    } else {
      if (w.curDur <= 0 && !it.def.fixBroken) { this.log.push(`${it.def.name} 无法修复破损武器，请改用精制磨刀石/备用刀刃。`); this.itemTargetMode = null; this.bus.emit('change'); return }
      const before = w.curDur
      w.curDur = Math.min(w.maxDur, w.curDur + it.def.repair)
      this.log.push(`${it.def.name} 修理 ${w.def.name}：耐久 ${before}→${w.curDur}。`)
    }
    if (it.pollutItem) { this.player.san = Math.max(0, this.player.san - 1); this.log.push('（污染道具）额外失去 1 点理智。') }
    this.hand.splice(idx, 1)
    this.itemTargetMode = null
    if (this.selectedHand === idx) this.selectedHand = null
    if (it.def.costTurn) {
      this._tickTurn()
      this._monsterAttackAll()
      if (this._checkDead()) return
    }
    this.bus.emit('change')
    this._save()
  }

  // ---------- 行动：弃牌 ----------
  discard(idx) {
    if (this.gameOver) return
    const item = this.hand[idx]
    if (!item) return
    this.hand.splice(idx, 1)
    if (this.selectedHand === idx) this.selectedHand = null
    this.log.push(`丢弃 ${item.def.name}。`)
    this.bus.emit('change')
    this._save()
  }

  // ---------- 行动：丢弃装备栏武器 ----------
  discardEquip(slotIdx) {
    if (this.gameOver) return
    const w = this.equip[slotIdx]
    if (!w) return
    this.equip[slotIdx] = null
    if (this.armedSlot === slotIdx) this.armedSlot = null
    this.log.push(`丢弃 ${w.def.name}。`)
    this.bus.emit('change')
    this._save()
  }

  // ---------- 行动：进入出口 → 层间修整（三选一奖励 → 商店 → 下一层）----------
  enterExit(uid) {
    if (this.gameOver) return
    const card = this.getCard(uid)
    if (!card || card.type !== T.EXIT || !card.flipped) { this.log.push('请点击一个已翻开的出口牌。'); this.bus.emit('change'); return }
    if (!this.exitsActivated()) { this.log.push(`钥匙碎片不足 (${this.player.keys}/${this.player.keysNeeded})。`); this.bus.emit('change'); return }
    let label = '', mod = {}
    if (card.def.route) { mod = { ...ROUTES[card.def.route].mod }; label = ROUTES[card.def.route].name }
    else { const e = ENVIRONMENTS[Math.floor(Math.random() * ENVIRONMENTS.length)]; mod = { ...e.mod }; label = e.name }
    this._pendingNextMod = { ...mod, label }
    // 商店每 SHOP_EVERY 层出现一次（离开第 3 / 6 层时），其余层只有三选一奖励
    const hasShop = this.floor % SHOP_EVERY === 0
    this.rest = {
      step: 'reward',                                  // reward → shop（有商店）/ done
      rewards: buildRewardChoices(this.floor),
      hasShop,
      stock: hasShop ? buildShopStock(this.floor) : null,
      mode: null,                                      // 'repair' | 'sell' | null
      pending: null,                                    // 待确认操作
      envName: label,
      routeName: card.def.route ? ROUTES[card.def.route].name : null,
    }
    this.armedSlot = null
    this.selectedHand = null
    this.itemTargetMode = null
    this.log.push(`激活出口「${card.def.name}」：${label}。进入层间修整，请选择一项奖励。`)
    // 层间修整入场（进入奖励界面时）：固定 +6 理智（核心机制.md §11）
    const sanBefore = this.player.san
    this.player.san = Math.min(this.player.maxSan, this.player.san + FLOOR_SAN_RECOVER)
    const sanGain = this.player.san - sanBefore
    this.log.push(`层间恢复：理智 +${sanGain}（固定 ${FLOOR_SAN_RECOVER}，上限 ${this.player.maxSan}）。`)
    this.setPhase('rest')
    this._save()
  }

  restStep() { return this.rest ? this.rest.step : null }

  // ---------- 层间：三选一奖励（纯卡牌；选完立即转场） ----------
  chooseReward(idx) {
    const r = this.rest
    if (!r || r.step !== 'reward') return
    const rw = r.rewards[idx]
    if (!rw) return
    if (!this.canChooseReward(rw)) {
      this.log.push(`手牌已满（${this.hand.length}/${HAND_LIMIT}），该奖励无法直接使用/装备，请换一项或跳过。`)
      this.bus.emit('change'); return
    }
    this._grantReward(rw)
    r.rewards = null
    this._advanceRest()
  }
  // 跳过奖励：不领取，直接进入下一场景（商店或下一层）
  skipReward() {
    const r = this.rest
    if (!r || r.step !== 'reward') return
    this.log.push('跳过层间奖励。')
    r.rewards = null
    this._advanceRest()
  }
  // 领奖/跳过后立即转场：有商店进商店，否则直接进入下一层
  _advanceRest() {
    const r = this.rest
    if (!r) return
    if (r.hasShop) {
      r.step = 'shop'
      this.bus.emit('change')
      this._save()
    } else {
      r.step = 'done'   // 先标记 done 放行 enterNextFloor，随后 rest 即被清空
      this.enterNextFloor()
    }
  }
  // 该奖励当前是否可选择：手牌未满皆可选；手牌已满时——
  // 药水直接使用、buff 直接绑定下次攻击、武器直接装空装备槽（装备栏满则禁选）、道具需选目标武器禁选
  canChooseReward(rw) {
    if (!rw) return false
    if (!this.handFull()) return true
    if (rw.kind === 'weapon') return this.equip.some(e => !e)
    if (rw.kind === 'item') return false
    return true
  }
  _grantReward(rw) {
    if (!this.handFull()) {
      this.hand.push(this._mkInst(rw.def))
      this.log.push(`层间奖励：获得 ${rw.def.name}（${this.hand.length}/${HAND_LIMIT}）。`)
      return
    }
    // 手牌已满：直接使用 / 装备
    if (rw.kind === 'weapon') {
      const slot = this.equip.findIndex(e => !e)
      this.equip[slot] = this._mkInst(rw.def)
      this.log.push(`层间奖励：手牌已满，${rw.def.name} 直接装入装备栏（槽 ${slot + 1}）。`)
    } else if (rw.kind === 'potion') {
      const def = rw.def
      const hp = def.healHp || 0, san = def.healSan || 0
      if (hp) { this.player.hp = Math.min(this.player.maxHp, this.player.hp + hp); this.log.push(`层间奖励：手牌已满，直接使用 ${def.name}，+${hp} 生命。`) }
      if (san) { this.player.san = Math.min(this.player.maxSan, this.player.san + san); this.log.push(`层间奖励：手牌已满，直接使用 ${def.name}，+${san} 理智。`) }
    } else if (rw.kind === 'buff') {
      const e = rw.def.effect
      if (e.sanNow) { this.player.san = Math.min(this.player.maxSan, this.player.san + e.sanNow); this.log.push(`${rw.def.name}：理智 +${e.sanNow}。`) }
      if (e.hpCost) { this.player.hp -= e.hpCost; this.log.push(`${rw.def.name}：失去 ${e.hpCost} 生命。`) }
      this.pendingBuff = {
        atk: e.atk || 0, lifesteal: e.lifesteal || 0, ignoreCounter: !!e.ignoreCounter,
        bonus: e.bonus || 0, forceCrit: !!e.forceCrit, noDurLoss: !!e.noDurLoss,
        slowTarget: e.slowTarget || 0, purify: !!e.purify,
      }
      this.pendingBuffName = rw.def.name
      this.log.push(`层间奖励：手牌已满，${rw.def.name} 直接绑定下次攻击。`)
    }
    if (this._checkDead()) return
  }

  // ---------- 层间商店：修理 / 出售 目标选择模式 ----------
  setRestMode(mode) {
    const r = this.rest
    if (!r || r.step !== 'shop') return
    r.mode = r.mode === mode ? null : mode
    r.pending = null
    this.selectedHand = null
    this.armedSlot = null
    if (r.mode) this.log.push(r.mode === 'repair' ? '选择要修理的武器（点击装备栏或手牌中的武器）。' : '选择要出售的牌（点击装备栏或手牌）。')
    this.bus.emit('change')
  }
  // 出售价：买入价的 5 折（核心机制.md §12）
  sellPrice(inst) {
    if (!inst || !inst.def) return 0
    return Math.max(1, Math.floor(priceOf(inst.def) * 0.5))
  }
  findInst(instUid) {
    for (const e of this.equip) if (e && e.uid === instUid) return e
    for (const h of this.hand) if (h && h.uid === instUid) return h
    return null
  }
  // 点击装备栏/手牌里的牌 → 生成待确认操作
  restPickTarget(instUid) {
    const r = this.rest
    if (!r || r.step !== 'shop' || !r.mode) return
    const inst = this.findInst(instUid)
    if (!inst) return
    if (r.mode === 'repair') {
      if (inst.def.atk === undefined) { this.log.push('只有武器可以修理。'); this.bus.emit('change'); return }
      const need = inst.maxDur - inst.curDur
      if (need <= 0) { this.log.push(`${inst.def.name} 耐久已满。`); this.bus.emit('change'); return }
      const cost = Math.min(need, this.player.gold)
      if (cost <= 0) { this.log.push('金币不足，无法修理（1 金币 / 1 耐久）。'); this.bus.emit('change'); return }
      r.pending = {
        action: 'repair', instUid, cost,
        text: `确定花 ${cost} 金修理「${inst.def.name}」？耐久 ${inst.curDur} → ${inst.curDur + cost}`,
      }
    } else {
      const price = this.sellPrice(inst)
      r.pending = {
        action: 'sell', instUid, price,
        text: `确定出售「${inst.def.name}」，获得 ${price} 金？`,
      }
    }
    this.bus.emit('change')
  }
  // 点击商店货架 → 生成待确认购买
  requestBuy(slotIdx) {
    const r = this.rest
    if (!r || r.step !== 'shop' || !r.stock) return
    const entry = r.stock[slotIdx]
    if (!entry || entry.sold) return
    if (this.player.gold < entry.price) { this.log.push(`金币不足（需 ${entry.price} 金）。`); this.bus.emit('change'); return }
    if (this.handFull()) { this.log.push(`手牌已满（${this.hand.length}/${HAND_LIMIT}），无法购买。`); this.bus.emit('change'); return }
    r.mode = null
    r.pending = {
      action: 'buy', slot: slotIdx, price: entry.price,
      text: `确定购买「${entry.def.name}」（${entry.price} 金）？`,
    }
    this.bus.emit('change')
  }
  cancelPending() {
    if (!this.rest) return
    this.rest.pending = null
    this.bus.emit('change')
  }
  confirmPending() {
    const r = this.rest
    if (!r || !r.pending) return
    const p = r.pending
    r.pending = null
    if (p.action === 'buy') {
      const entry = r.stock[p.slot]
      if (!entry || entry.sold) { this.bus.emit('change'); return }
      if (this.player.gold < entry.price) { this.log.push('金币不足。'); this.bus.emit('change'); return }
      if (this.handFull()) { this.log.push('手牌已满，无法购买。'); this.bus.emit('change'); return }
      this.player.gold -= entry.price
      entry.sold = true
      this.hand.push(this._mkInst(entry.def))
      this.log.push(`购买 ${entry.def.name}（花费 ${entry.price} 金）。`)
    } else if (p.action === 'repair') {
      const w = this.findInst(p.instUid)
      if (!w || w.def.atk === undefined) { this.bus.emit('change'); return }
      const cost = Math.min(w.maxDur - w.curDur, this.player.gold, p.cost)
      if (cost <= 0) { this.bus.emit('change'); return }
      w.curDur += cost
      this.player.gold -= cost
      this.log.push(`修理 ${w.def.name}：+${cost} 耐久（花费 ${cost} 金）。`)
      r.mode = null
    } else if (p.action === 'sell') {
      this._doSell(p.instUid)
      r.mode = null
    }
    this.bus.emit('change')
    this._save()
  }
  _doSell(instUid) {
    const slot = this.equip.findIndex(e => e && e.uid === instUid)
    if (slot >= 0) {
      const inst = this.equip[slot]
      const price = this.sellPrice(inst)
      this.equip[slot] = null
      if (this.armedSlot === slot) this.armedSlot = null
      this.player.gold += price
      this.log.push(`出售 ${inst.def.name}，获得 ${price} 金。`)
      return
    }
    const idx = this.hand.findIndex(h => h && h.uid === instUid)
    if (idx < 0) return
    const inst = this.hand[idx]
    const price = this.sellPrice(inst)
    this.hand.splice(idx, 1)
    if (this.selectedHand === idx) this.selectedHand = null
    this.player.gold += price
    this.log.push(`出售 ${inst.def.name}，获得 ${price} 金。`)
  }

  enterNextFloor() {
    const r = this.rest
    if (!r || r.step === 'reward') return   // 必须先领奖励
    // 已是最后一层（Boss 层）时不可再前进，避免越界
    if (this.floor >= FLOORS.length) { this.win = true; this.gameOver = true; this.clearSave(); this.bus.emit('change'); return }
    this.rest = null
    this.floor++
    this._startFloor()
    this.setPhase('explore')
  }

  _startFloor() {
    const cfg = FLOORS[this.floor - 1]
    // 防御：越界（例如异常进入 Boss 层之后）直接判通关，避免 FLOORS[floor-1] 越界崩溃
    if (!cfg) { this.win = true; this.gameOver = true; this.clearSave(); this.bus.emit('change'); return }
    // 进入新层时强制清掉上一层可能残留的修整状态（Boss 层无出口，不应继承）
    this.rest = null
    this._mod = this._pendingNextMod || { label: '' }
    this._pendingNextMod = null
    this._sanCostExtra = this._mod.sanCostBonus || 0
    this.pendingBuff = null
    this.thorns = 0
    this.itemTargetMode = null
    this.armedSlot = null
    this.selectedHand = null
    this.buffUsedThisTurn = false
    // 层开始：全员武器 +1 耐久（破损→1）；理智恢复改在层结束（进入层间修整时）结算
    for (const w of [...this.equip, ...this.hand]) {
      if (w && w.curDur !== undefined) { if (w.curDur <= 0) w.curDur = 1; else w.curDur = Math.min(w.maxDur, w.curDur + 1) }
    }
    this.player.keys = 0
    this.player.keysNeeded = cfg.keys
    this._buildBoard(this.floor)
    this.log.push(`进入第 ${this.floor} 层。${this._mod.label ? '环境：' + this._mod.label + '。' : ''}需收集 ${this.player.keysNeeded} 个钥匙碎片。武器耐久 +1。`)
    this.bus.emit('floor:start', { floor: this.floor, mod: this._mod, cfg })
    this.bus.emit('change')
    this._save()
  }

  // ---------- 怪物威胁 ----------
  _monsterAttackAll(excludeUid = null) {
    const mons = this.monstersOnBoard().filter(m => m.uid !== excludeUid)
    for (const m of mons) {
      let dmg = this.monsterAttackValue(m)
      if (this.thorns) { dmg = Math.max(0, dmg - this.thorns); this.thorns = 0 }
      this.player.hp -= dmg
      if (this.player.san > 0) { this.player.san = Math.max(0, this.player.san - 1); this.log.push(`${m.def.name} 攻击你，-${dmg} 生命，-1 理智。`) }
      else this.log.push(`${m.def.name} 攻击你，-${dmg} 生命。`)
    }
  }

  // ---------- 死亡检查 ----------
  _checkDead() {
    if (this.player.hp <= 0) {
      this.player.hp = 0
      this.gameOver = true
      this.log.push('你倒下了。黑塔吞噬了你……')
      this.clearSave()
      this.bus.emit('change')
      return true
    }
    return false
  }

  // ---------- 存读档 ----------
  _serInst(inst) {
    if (!inst) return null
    return {
      defId: inst.def.id, tags: inst.tags || [], curDur: inst.curDur, maxDur: inst.maxDur,
      maintain: inst.maintain || 0, uid: inst.uid, pollutAtk: inst.pollutAtk || 0,
      pollutHeal: !!inst.pollutHeal, pollutItem: !!inst.pollutItem, pollutBuff: !!inst.pollutBuff,
    }
  }
  _deserInst(o) {
    if (!o) return null
    const def = DEFS_BY_ID[o.defId]?.def
    if (!def) return null
    return {
      def, tags: o.tags || [], curDur: o.curDur, maxDur: o.maxDur,
      maintain: o.maintain || 0, uid: o.uid, pollutAtk: o.pollutAtk || 0,
      pollutHeal: !!o.pollutHeal, pollutItem: !!o.pollutItem, pollutBuff: !!o.pollutBuff,
    }
  }
  // 层间修整状态的序列化（奖励/货架只存 defId，读档时按表重建）
  _serRest() {
    const r = this.rest
    if (!r) return null
    return {
      step: r.step, hasShop: r.hasShop, envName: r.envName, routeName: r.routeName,
      rewards: r.rewards ? r.rewards.map(rw => ({ kind: rw.kind, amount: rw.amount, defId: rw.def ? rw.def.id : null })) : null,
      stock: r.stock ? r.stock.map(e => ({ defId: e.def.id, type: e.type, price: e.price, sold: !!e.sold })) : null,
    }
  }
  _deserRest(o) {
    if (!o) return null
    return {
      step: o.step || 'reward', hasShop: !!o.hasShop, envName: o.envName || '', routeName: o.routeName || null,
      mode: null, pending: null,
      rewards: o.rewards ? o.rewards.map(rw => ({ kind: rw.kind, amount: rw.amount, def: rw.defId ? (DEFS_BY_ID[rw.defId]?.def || null) : null })) : null,
      stock: o.stock ? o.stock.map(e => {
        const def = DEFS_BY_ID[e.defId]?.def
        return def ? { type: e.type, def, price: e.price, sold: !!e.sold } : null
      }).filter(Boolean) : null,
    }
  }
  _save() {
    if (this.gameOver) return
    try {
      const data = {
        v: SAVE_VERSION, floor: this.floor, turn: this.turn, gameOver: this.gameOver, win: this.win,
        player: this.player,
        hand: this.hand.map(h => this._serInst(h)),
        equip: this.equip.map(e => this._serInst(e)),
        armedSlot: this.armedSlot, selectedHand: this.selectedHand,
        pendingBuff: this.pendingBuff, pendingBuffName: this.pendingBuffName, thorns: this.thorns,
        emotion: this.emotion,
        mod: this._mod, pendingNextMod: this._pendingNextMod,
        rest: this._serRest(),
        board: this.board.map(c => ({
          uid: c.uid, type: c.type, c: c.c, r: c.r, flipped: c.flipped, pollut: c.pollut,
          dead: c.dead, monsterHp: c.monsterHp, bossWeakType: c.bossWeakType, _slowTurns: c._slowTurns,
          picked: !!c.picked, taken: !!c.taken,
          defId: c.def.id, inst: this._serInst(c.inst),
        })),
        log: this.log.slice(-60),
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    } catch (e) { /* 忽略存储错误 */ }
  }
  load() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SAVE_KEY) : null
      if (!raw) return false
      const d = JSON.parse(raw)
      if (!d || !d.board) return false
      // 版本不符：旧档作废，清档后开新局（初期开发不保留旧档）
      if (d.v !== SAVE_VERSION) { this.clearSave(); return false }
      this.floor = d.floor; this.turn = d.turn; this.gameOver = d.gameOver; this.win = d.win
      this.player = d.player
      this.hand = (d.hand || []).map(h => this._deserInst(h)).filter(Boolean)
      this.equip = (d.equip || [null, null, null]).map(e => this._deserInst(e))
      this.armedSlot = d.armedSlot; this.selectedHand = d.selectedHand
      this.pendingBuff = d.pendingBuff; this.pendingBuffName = d.pendingBuffName || null; this.thorns = d.thorns || 0
      this.emotion = d.emotion || null
      this._mod = d.mod || { label: '' }; this._pendingNextMod = d.pendingNextMod || null
      this._sanCostExtra = this._mod.sanCostBonus || 0
      this.rest = this._deserRest(d.rest)
      this._phase = this.rest ? 'rest' : 'explore'
      this.itemTargetMode = null
      this.buffUsedThisTurn = false
      this._bossTowerCount = 0
      this.board = []
      let maxUid = 0
      for (const sc of d.board) {
        const def = getDef(sc.type, sc.defId)
        if (!def) continue
        const card = {
          uid: sc.uid, type: sc.type, def, c: sc.c, r: sc.r, flipped: sc.flipped, pollut: sc.pollut,
          dead: sc.dead, monsterHp: sc.monsterHp, bossWeakType: sc.bossWeakType, _slowTurns: sc._slowTurns || 0,
          picked: !!sc.picked, taken: !!sc.taken, _burnTurns: 0,
          inst: this._deserInst(sc.inst),
        }
        if (sc.type === T.MONSTER) card.monsterHp = sc.monsterHp
        if (sc.uid > maxUid) maxUid = sc.uid
        this.board.push(card)
      }
      UID = maxUid + 1
      this.log = d.log || ['（读取存档）']
      return true
    } catch (e) { return false }
  }
  clearSave() { try { localStorage.removeItem(SAVE_KEY) } catch (e) {} }
}
