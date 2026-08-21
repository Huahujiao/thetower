// 游戏状态与行动逻辑 —— M2 + M3 全系统
import {
  buildFloorDeck, FLOORS, ENVIRONMENTS, ROUTES, T, BUFFS, GRIP,
  MONSTERS, SUMMONS, WEAPONS, POTIONS, ITEMS, DEFS_BY_ID, getDef,
  buildShopStock, buildRewardChoices,
  priceOf, SHOP_EVERY,
} from '../data/cards.js'
import { RELIC_DEFS, RELIC_MAX_ACTIVE, buildRelicChoices, getRelicDef } from '../data/relics.js'
import { makeEmitter } from './core/emitter.js'
import { COMMANDS } from './core/commands.js'
import { random, randomInt } from './core/rng.js'
import { WeaponLoadout } from './model/loadout.js'
import { BAG_COLUMNS, BAG_ROWS, BackpackGrid } from './model/backpack.js'
import { catOf, computeDamage, weaponPower } from './rules/combat.js'
import { isAdjacent8 } from './rules/queries.js'
import { EffectQueue, RESOLUTION_PHASES } from './rules/resolution.js'
import { StatusStore } from './rules/status.js'
import { TriggerRegistry } from './rules/triggers.js'
import { RelicEngine } from './rules/relics.js'
import { MonsterSkillEngine } from './rules/monster-skills.js'
import { RelicState } from './model/relics.js'

// 行囊尺寸（核心机制.md §13.1）
export { BAG_COLUMNS, BAG_ROWS }
// 保留旧导出名，避免外部模块在迁移期间崩溃；行囊不再按牌数限制。
export const HAND_LIMIT = BAG_COLUMNS * BAG_ROWS
// 每层结束（进入层间修整）固定恢复的理智（核心机制.md §11）
export const FLOOR_SAN_RECOVER = 6
// 可拾取（会占用行囊）的牌型
const LOOT_TYPES = [T.WEAPON, T.POTION, T.ITEM, T.BUFF]

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
  let r = random() * total
  for (const id of EMOTION_IDS) { r -= (weights[id] || 0); if (r <= 0) return id }
  return 'calm'
}

let UID = 0

const SAVE_KEY = 'heita_save_v1'
// 存档版本号：任何破坏性数值/机制改动后 bump 此值，旧档自动作废（初期开发不保留旧档）
// v8：护甲状态与陷阱牌加入；v15：原子翻牌/理智流程与战吼、放逐时序调整；
// v16：棋盘实体（阵营、召唤物、移动状态）加入；v17：主动技能槽与藏匿状态加入
const SAVE_VERSION = 17
export const STARTER_WEAPON_ID = 'w_rust_cleaver'

export class GameState {
  constructor() {
    this.bus = makeEmitter()
    this.on = this.bus.on.bind(this.bus)
    this.off = this.bus.off.bind(this.bus)
    this.ruleBus = makeEmitter()
    this.onRule = this.ruleBus.on.bind(this.ruleBus)
    this.offRule = this.ruleBus.off.bind(this.ruleBus)
    this.reset()
    this._loaded = this.load()
  }

  reset() {
    this.floor = 1
    this.turn = 0
    this.gameOver = false
    this.win = false
    this.player = { hp: 20, maxHp: 20, armor: 0, san: 30, maxSan: 30, gold: 0, keys: 0, keysNeeded: 3 }
    // The inventory is a 10×5 shape-aware backpack; equipment remains a two-hand loadout.
    this.inventory = new BackpackGrid(BAG_COLUMNS, BAG_ROWS)
    this.equipment = new WeaponLoadout(2)
    const starter = WEAPONS.find((weapon) => weapon.id === STARTER_WEAPON_ID)
    if (starter) this.equipment.equip(this._mkInst(starter), 0)
    this.armedSlot = null
    this.selectedHand = null
    this.selectedBackpackUid = null
    this.log = []
    this.pendingBuff = null       // 待生效的下次攻击 buff
    this.pendingBuffName = null   // 待生效 buff 名称（HUD 显示用）
    this.thorns = 0              // 荆棘守护：下一次怪物攻击减伤
    this.buffUsedThisTurn = false
    this.itemTargetMode = null    // 正在选择目标的道具在行囊物品数组中的索引
    this._mod = { label: '' }     // 当前层修饰（环境/路线）
    this._pendingNextMod = null   // 下一层修饰（出口/环境决定）
    this._sanCostExtra = 0
    this.emotion = null
    this._bossTowerCount = 0
    this._stealthTurns = 0
    this.activeSkillId = null
    this.resolutionTrace = []
    this.resolutionHistory = []
    this.triggers = new TriggerRegistry()
    this.relics = new RelicState(RELIC_DEFS, RELIC_MAX_ACTIVE)
    this.relicEngine = new RelicEngine({
      state: this,
      collection: this.relics,
      triggerRegistry: this.triggers,
      definitions: RELIC_DEFS,
    })
    this.monsterSkills = new MonsterSkillEngine(this)
    this._syncActiveSkillSelection()
    this.initialRelicChoices = this.relicChoices(3)
    this.rest = null              // 层间修整状态（三选一奖励 / 商店 / 确认流）
    this._phase = 'explore'
    this._buildBoard(1)
    this.log.push('进入黑塔第 1 层。翻开相邻的牌开始探索。')
    if (starter) this.log.push(`初始装备：${starter.name}（左手）。`)
    this._loaded = false
    this.bus.emit('change')
  }

  get hand() { return this.inventory.items }
  set hand(items) { this.inventory.replace(items) }
  get equip() { return this.equipment.slots }
  set equip(slots) { this.equipment.replaceFromSlots(slots) }

  get activeItemTarget() {
    const index = this.itemTargetMode
    if (!Number.isInteger(index)) return null
    const item = this.hand[index]
    if (!item?.def || (item.def.repair === undefined && !item.def.buff)) return null
    return item
  }

  get itemTargeting() { return !!this.activeItemTarget }

  addToHand(item) { return this.inventory.add(item) }
  spawnRandomWeapon({ source = 'effect' } = {}) {
    const def = WEAPONS[randomInt(WEAPONS.length)]
    const weapon = this._mkInst(def)
    if (!this.addToHand(weapon)) {
      this.log.push('生成武器失败：行囊没有空间。')
      return null
    }
    this.log.push(`${source === 'relic:weapon-cycle' ? '武器轮换' : '生成武器'}：获得 ${def.name}。`)
    this._runResolution('weapon:spawned', [], { weapon, source })
    return weapon
  }
  removeHandAt(index) {
    const removed = this.inventory.removeAt(index)
    if (removed) this.itemTargetMode = null
    return removed
  }
  removeHandByUid(uid) {
    const removed = this.inventory.removeByUid(uid)
    if (removed) this.itemTargetMode = null
    return removed
  }
  canStore(item) { return !!item && this.inventory.canFit(item) }
  backpackPlacement(uid) { return this.inventory.placementOf(uid) }
  moveBackpack(uid, x, y, rotation = null) {
    const moved = this.inventory.move(uid, x, y, rotation)
    if (moved) { this.bus.emit('change'); this._save() }
    return moved
  }
  rotateBackpack(uid) {
    const rotated = this.inventory.rotate(uid)
    if (rotated) { this.bus.emit('change'); this._save() }
    return rotated
  }
  moveSelectedBackpack(x, y) {
    if (!this.selectedBackpackUid) return false
    return this.moveBackpack(this.selectedBackpackUid, x, y)
  }
  selectBackpack(uid) {
    const index = this.hand.findIndex((item) => item?.uid === uid)
    if (index >= 0) this.selectHand(index)
  }

  dispatch(command) {
    if (!command || !command.type) throw new TypeError('A gameplay command requires a type')
    switch (command.type) {
      case COMMANDS.FLIP: return this.flip(command.uid)
      case COMMANDS.PICK_UP: return this.pickUp(command.uid)
      case COMMANDS.ATTACK: return this.attack(command.uid)
      case COMMANDS.ARM_WEAPON: return this.armWeapon(command.slotIdx)
      case COMMANDS.SELECT_HAND: return this.selectHand(command.index)
      case COMMANDS.MOVE_BACKPACK: return this.moveBackpack(command.uid, command.x, command.y, command.rotation)
      case COMMANDS.ROTATE_BACKPACK: return this.rotateBackpack(command.uid)
      case COMMANDS.SWITCH_TO_EQUIP: return this.switchToEquip(command.slotIdx)
      case COMMANDS.USE_POTION: return this.usePotion(command.index)
      case COMMANDS.USE_BUFF: return this.useBuff(command.index)
      case COMMANDS.USE_ITEM: return this.useItem(command.index)
      case COMMANDS.APPLY_ITEM: return this.applyItemToWeapon(command.instUid)
      case COMMANDS.DISCARD: return this.discard(command.index)
      case COMMANDS.DISCARD_EQUIP: return this.discardEquip(command.slotIdx)
      case COMMANDS.WAIT_TURN: return this.waitTurn()
      case COMMANDS.ENTER_EXIT: return this.enterExit(command.uid)
      case COMMANDS.CHOOSE_REWARD: return this.chooseReward(command.index)
      case COMMANDS.SKIP_REWARD: return this.skipReward()
      case COMMANDS.SET_REST_MODE: return this.setRestMode(command.mode)
      case COMMANDS.REQUEST_BUY: return this.requestBuy(command.slotIdx)
      case COMMANDS.CONFIRM_PENDING: return this.confirmPending()
      case COMMANDS.CANCEL_PENDING: return this.cancelPending()
      case COMMANDS.ENTER_NEXT_FLOOR: return this.enterNextFloor()
      case COMMANDS.CHOOSE_INITIAL_RELIC: return this.chooseInitialRelic(command.id)
      case COMMANDS.ACTIVATE_RELIC: return this.activateRelic(command.id)
      case COMMANDS.DEACTIVATE_RELIC: return this.deactivateRelic(command.id)
      case COMMANDS.CAST_ACTIVE_SKILL: return this.castActiveSkill()
      case COMMANDS.SELECT_ACTIVE_SKILL: return this.selectActiveSkill(command.skillId)
      case COMMANDS.SWITCH_ACTIVE_SKILL: return this.switchActiveSkill(command.skillId)
      default: throw new Error(`Unknown gameplay command: ${command.type}`)
    }
  }

  registerTrigger(trigger) { return this.triggers.register(trigger) }

  // ---------- Run-scoped relic API ----------
  get relicCollection() { return this.relics.collection }
  get activeRelics() { return this.relics.active }
  get relicActiveLimit() { return this.relics.maxActive }
  get relicAvailableCount() { return this.relics.availableIds().length }
  relicDefinitions() { return this.relicEngine.collectionDefinitions() }
  activeRelicDefinitions() { return this.relicEngine.activeDefinitions() }
  relicChoices(count = 3) {
    return buildRelicChoices({ count, collected: this.relicCollection, defs: RELIC_DEFS })
  }

  acquireRelic(id, { activate = false, source = 'unknown' } = {}) {
    const result = this.relics.acquire(id, { activate })
    if (!result.ok) return result
    this.relicEngine.sync()
    this._syncActiveSkillSelection()
    if (this.rest?.stock) {
      this.rest.stock = this.rest.stock.filter((entry) => entry.type !== 'relic' || entry.def.id !== id || entry.sold)
    }
    this.log.push(`获得圣遗物：${this.relics.getDef(id)?.name || id}${source ? `（${source}）` : ''}`)
    this._runResolution('relic:acquired', [], { relicId: id, source, activated: result.activated })
    if (result.activated) this._runResolution('relic:activated', [], { relicId: id, source })
    this.ruleBus.emit('relic:acquired', { id, source, activated: result.activated })
    this.bus.emit('change')
    this._save()
    return result
  }

  chooseInitialRelic(id) {
    if (this.floor !== 1 || this.turn !== 0 || this.relics.size > 0) {
      return { ok: false, reason: 'initial-choice-closed' }
    }
    if (!this.initialRelicChoices.some((def) => def.id === id)) {
      return { ok: false, reason: 'not-an-initial-choice' }
    }
    const result = this.acquireRelic(id, { activate: true, source: '开局选择' })
    if (result.ok) this.initialRelicChoices = []
    return result
  }

  _canChangeRelics() {
    return this.phase === 'rest' && this.rest?.step === 'shop'
  }

  activateRelic(id) {
    if (!this._canChangeRelics()) return { ok: false, reason: 'shop-only' }
    const result = this.relics.activate(id)
    if (!result.ok || !result.changed) return result
    this.relicEngine.sync()
    this._syncActiveSkillSelection()
    this.log.push(`激活圣遗物：${this.relics.getDef(id)?.name || id}`)
    this._runResolution('relic:activated', [], { relicId: id })
    this.bus.emit('change')
    this._save()
    return result
  }

  deactivateRelic(id) {
    if (!this._canChangeRelics()) return { ok: false, reason: 'shop-only' }
    const result = this.relics.deactivate(id)
    if (!result.changed) return result
    this.relicEngine.sync()
    this._syncActiveSkillSelection()
    this.log.push(`停用圣遗物：${this.relics.getDef(id)?.name || id}`)
    this._runResolution('relic:deactivated', [], { relicId: id })
    this.bus.emit('change')
    this._save()
    return result
  }

  setActiveRelics(ids) {
    if (!this._canChangeRelics()) return { ok: false, reason: 'shop-only' }
    const result = this.relics.setActive(ids)
    if (!result.ok) return result
    this.relicEngine.sync()
    this._syncActiveSkillSelection()
    this.bus.emit('change')
    this._save()
    return result
  }

  relicModifiers(channel, context = {}) {
    return this.relicEngine.collectModifiers(channel, { ...context, state: this })
  }

  modifyByRelics(channel, value, context = {}) {
    return this.relicEngine.modifyNumber(channel, value, { ...context, state: this })
  }

  modifyByRelicsAcross(channels, value, context = {}) {
    return this.relicEngine.modifyNumberAcross(channels, value, { ...context, state: this })
  }

  computeAttackDamage(weapon, card, buff, context = {}) {
    const powerModifiers = this.relicModifiers('weapon:power', { ...context, card, weapon, buff })
    const durabilityFactorModifiers = this.relicModifiers('weapon:durabilityFactor', { ...context, card, weapon, buff })
    return computeDamage(weapon, card.def, buff, { powerModifiers, durabilityFactorModifiers })
  }

  checkRelicAction(action, context = {}) {
    return this.relicEngine.checkAction(action, { ...context, state: this })
  }

  invokeRelicAction(action, context = {}) {
    return this.relicEngine.invoke(action, { ...context, state: this })
  }

  activeSkillEntries() {
    const relicEntries = this.relicEngine.activeSkillEntries()
      .map((entry) => ({ ...entry, providerType: 'relic', providerId: entry.id }))
    const externalEntries = []
    const candidates = [
      ...this.equipment.items.map((item, index) => ({ item, providerType: 'equipment', providerId: item?.uid, order: 10000 + index })),
      ...this.hand.map((item, index) => ({ item, providerType: 'backpack', providerId: item?.uid, order: 11000 + index })),
    ]
    for (const candidate of candidates) {
      const def = candidate.item?.def
      const rawSkill = def?.activeSkill
      if (!candidate.providerId || !rawSkill) continue
      const skill = {
        ...rawSkill,
        id: rawSkill.id || `skill:${candidate.providerType}:${candidate.providerId}`,
        name: rawSkill.name || def.name,
        icon: rawSkill.icon || '✦',
        cooldown: Math.max(0, Math.floor(Number(rawSkill.cooldown ?? 10) || 0)),
      }
      const handler = def.actions?.['active-skill'] || rawSkill.action
      if (typeof handler !== 'function') continue
      externalEntries.push({
        id: candidate.providerId,
        order: candidate.order,
        providerType: candidate.providerType,
        providerId: candidate.providerId,
        item: candidate.item,
        def,
        skill,
        invoke: (context = {}) => {
          const produced = handler({
            ...context, state: this, skill, provider: candidate.item,
          })
          return Array.isArray(produced) ? produced.filter(Boolean) : produced ? [produced] : []
        },
      })
    }
    return [...relicEntries, ...externalEntries].sort((a, b) => a.order - b.order)
  }
  activeSkills() {
    return this.activeSkillEntries().map((entry) => {
      const runtime = this._activeSkillRuntime(entry)
      return {
        ...entry.skill, providerId: entry.providerId, providerType: entry.providerType,
        cooldownRemaining: Math.max(0, Math.floor(Number(runtime?.cooldown) || 0)),
      }
    })
  }
  _activeSkillRuntime(entry) {
    if (!entry) return null
    if (entry.providerType === 'relic') return this.relics.getRuntime(entry.id)
    if (!entry.item) return null
    if (!entry.item.activeSkillRuntime || typeof entry.item.activeSkillRuntime !== 'object') {
      entry.item.activeSkillRuntime = {}
    }
    return entry.item.activeSkillRuntime
  }
  _tickActiveSkillCooldowns() {
    for (const entry of this.activeSkillEntries()) {
      const runtime = this._activeSkillRuntime(entry)
      if (runtime && runtime.cooldown > 0) runtime.cooldown = Math.max(0, Math.floor(Number(runtime.cooldown) - 1))
    }
  }
  get activeSkill() {
    const entry = this.activeSkillEntries().find((candidate) => candidate.skill.id === this.activeSkillId)
      || this.activeSkillEntries()[0]
    if (!entry) return null
    const runtime = this._activeSkillRuntime(entry)
    return {
      ...entry.skill, providerId: entry.providerId,
      providerType: entry.providerType, relicId: entry.providerType === 'relic' ? entry.id : null,
      cooldownRemaining: Math.max(0, Math.floor(Number(runtime?.cooldown) || 0)),
    }
  }
  _syncActiveSkillSelection() {
    const entries = this.activeSkillEntries()
    if (!entries.length) { this.activeSkillId = null; return }
    if (!entries.some((entry) => entry.skill.id === this.activeSkillId)) this.activeSkillId = entries[0].skill.id
  }
  _activeSkillEntry() {
    return this.activeSkillEntries().find((entry) => entry.skill.id === this.activeSkillId)
      || this.activeSkillEntries()[0]
  }
  setStealthTurns(turns) {
    this._stealthTurns = Math.max(0, Math.floor(Number(turns) || 0))
    return this._stealthTurns
  }
  get stealthed() { return this._stealthTurns > 0 }
  selectActiveSkill(skillId) {
    if (this.gameOver || this.phase !== 'explore') return { ok: false, reason: 'phase' }
    const entries = this.activeSkillEntries()
    const next = entries.find((entry) => entry.skill.id === skillId || entry.id === skillId)
    if (!next) {
      this.log.push(entries.length ? '没有找到这个主动技能。' : '当前没有可用的主动技能。')
      this.bus.emit('change')
      return { ok: false, reason: entries.length ? 'unknown' : 'none' }
    }
    if (next.skill.id === this.activeSkillId) return { ok: true, skillId: next.skill.id, changed: false }
    this._tickTurn()
    this.activeSkillId = next.skill.id
    this.log.push(`切换主动技能：${next.skill.name}（消耗 1 回合）。`)
    this._monsterAttackAll()
    if (this._checkDead()) return { ok: false, reason: 'dead' }
    this.bus.emit('change')
    this._save()
    return { ok: true, skillId: next.skill.id, changed: true }
  }
  // Compatibility boundary for older callers. New UI always supplies the
  // chosen skill id from the selection list; there is no acquisition-order cycle.
  switchActiveSkill(skillId) {
    if (!skillId) return { ok: false, reason: 'selection-required' }
    return this.selectActiveSkill(skillId)
  }
  castActiveSkill() {
    if (this.gameOver || this.phase !== 'explore') return { ok: false, reason: 'phase' }
    const entry = this._activeSkillEntry()
    if (!entry) {
      this.log.push('当前没有可用的主动技能。')
      this.bus.emit('change')
      return { ok: false, reason: 'none' }
    }
    this.activeSkillId = entry.skill.id
    const runtime = this._activeSkillRuntime(entry)
    const cooldownRemaining = Math.max(0, Math.floor(Number(runtime?.cooldown) || 0))
    if (cooldownRemaining > 0) {
      this.log.push(entry.skill.name + ' 还在冷却中（剩余 ' + cooldownRemaining + ' 回合）。')
      this.bus.emit('change')
      return { ok: false, reason: 'cooldown', cooldownRemaining }
    }
    const guard = this.checkRelicAction('active-skill', { skillId: entry.skill.id, skill: entry.skill })
    if (!guard.allowed) {
      this.log.push('当前状态无法施放主动技能。')
      this.bus.emit('change')
      return { ok: false, reason: 'guarded' }
    }
    const skillContext = { state: this, skillId: entry.skill.id, skill: entry.skill }
    const effects = entry.providerType === 'relic'
      ? this.relicEngine.invokeActiveSkill(entry.skill.id, skillContext)
      : entry.invoke(skillContext)
    if (!effects.length) {
      this.log.push(`${entry.skill.name} 当前没有可执行效果。`)
      this.bus.emit('change')
      return { ok: false, reason: 'no-effect' }
    }
    const consumesTurn = entry.skill.consumesTurn !== false
    const context = { skillId: entry.skill.id, skill: entry.skill, noAttackUids: new Set() }
    if (consumesTurn) this._tickTurn()
    this._runResolution('active-skill', effects, context)
    if (runtime) runtime.cooldown = Math.max(0, Math.floor(Number(entry.skill.cooldown ?? 10) || 0))
    this.log.push(`施放主动技能：${entry.skill.name}。`)
    if (this._checkDead()) return { ok: false, reason: 'dead' }
    if (consumesTurn && entry.skill.retaliates !== false) this._monsterAttackAll(context.noAttackUids)
    if (this._checkDead()) return { ok: false, reason: 'dead' }
    this.bus.emit('change')
    this._save()
    return { ok: true, skillId: entry.skill.id }
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
      const j = randomInt(i + 1)
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

  // 统一的物品实例工厂：所有实例都带 uid，便于行囊/层间修理/出售按 uid 定位
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

  _makeCard(raw, c, r, flipped = false, options = {}) {
    const isMonster = raw.type === T.MONSTER
    const card = {
      uid: ++UID, type: raw.type, def: raw.def, c, r, flipped, pollut: !!raw.pollut,
      dead: false, monsterHp: null, inst: null, picked: false, taken: false, triggered: false,
      _slowTurns: 0, _burnTurns: 0, statuses: new StatusStore(), peeked: false,
      skills: Array.isArray(options.skills ?? raw.skills ?? raw.def?.skills)
        ? [...(options.skills ?? raw.skills ?? raw.def.skills)] : [],
      skillState: {},
      // Every board occupant is still a card. These fields only describe how
      // the card participates in chessboard movement and combat targeting.
      faction: options.faction || raw.faction || (isMonster ? 'enemy' : 'neutral'),
      entityKind: options.entityKind || raw.entityKind || (isMonster ? 'monster' : 'card'),
      summoned: !!(options.summoned || raw.summoned),
      ai: options.ai || raw.ai || null,
      summonTurns: options.summonTurns ?? raw.summonTurns ?? null,
      maxMonsterHp: null,
    }
    if (isMonster) {
      card.monsterHp = options.hp ?? raw.def.hp
      card.maxMonsterHp = options.maxHp ?? raw.def.hp
      if (raw.def.tier === 'B') { // Boss：弱点每回合轮换
        card.bossWeakType = ['劈砍', '穿刺', '钝击', '元素'][randomInt(4)]
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
    if (card.type === T.TRAP) return !!card.triggered
    if (LOOT_TYPES.includes(card.type)) return !!card.picked
    return false
  }
  // 场上尚未拾取的战利品牌
  isLoot(card) {
    return !!card && card.flipped && !card.picked && LOOT_TYPES.includes(card.type)
  }
  handFull(item = null) { return item ? !this.canStore(item) : this.inventory.isFull }

  // ---------- 查询 ----------
  getCard(uid) { return this.board.find(b => b.uid === uid) }
  allMonstersOnBoard() { return this.board.filter(b => b.type === T.MONSTER && b.flipped && b.monsterHp > 0) }
  monstersOnBoard() {
    return this.allMonstersOnBoard().filter((card) => card.faction !== 'ally')
  }
  friendlySummonsOnBoard() {
    return this.allMonstersOnBoard().filter((card) => card.faction === 'ally')
  }
  isHostileMonster(card) {
    return !!card && card.type === T.MONSTER && card.faction !== 'ally'
  }
  cardStatuses(card) {
    if (!card) return null
    if (!(card.statuses instanceof StatusStore)) {
      card.statuses = new StatusStore(Array.isArray(card.statuses) ? card.statuses : [])
    }
    return card.statuses
  }
  hasCardStatus(card, id) { return !!this.cardStatuses(card)?.has(id) }
  addCardStatus(card, status) { return this.cardStatuses(card)?.add(status) || null }
  removeCardStatus(card, uidOrId) { return !!this.cardStatuses(card)?.remove(uidOrId) }
  isMonsterCombatDisabled(card) {
    return this.isHostileMonster(card) && this.hasCardStatus(card, 'banish')
  }
  flipRange() { return Math.max(1, Math.floor(this.modifyByRelics('flip:range', 1))) }
  isAdjacentToFlipped(card, range = 1) {
    // Exploration is based on revealed positions, not on currently occupied
    // cards. A picked-up item, defeated monster, or triggered trap leaves an
    // explored empty square that must continue to connect the frontier.
    return this.board.some(b => b.flipped && b !== card && this._withinCardRange(b, card, range))
  }
  // Cards the player can legally reveal this turn: hidden, unconsumed cards
  // within the current reveal range of a revealed board card.
  flippableCards(range = this.flipRange()) {
    return this.board.filter((card) =>
      !card.flipped && !this.isConsumed(card) && this.isAdjacentToFlipped(card, range))
  }
  exitsActivated() { return this.player.keys >= this.player.keysNeeded }
  hasBoss() { return this.board.some(b => this.isHostileMonster(b) && b.def.tier === 'B') }

  // ---------- 棋盘实体原子动作 ----------
  // The board remains a single list of cards. A consumed card is an empty
  // square from the movement system's point of view, even if its record is
  // retained temporarily for logs/replay.
  boardGridSize() { return FLOORS[this.floor - 1]?.grid || 4 }
  isInsideBoard(c, r) {
    const grid = this.boardGridSize()
    return Number.isInteger(c) && Number.isInteger(r) && c >= 0 && r >= 0 && c < grid && r < grid
  }
  getBoardCardAt(c, r, { includeConsumed = false } = {}) {
    const card = this.board.find((item) => item.c === c && item.r === r)
    if (!card || (this.isConsumed(card) && !includeConsumed)) return null
    return card
  }
  isCellOccupied(c, r) { return !!this.getBoardCardAt(c, r) }
  findEmptyBoardCell({ randomize = true, excludeUids = [] } = {}) {
    const excluded = new Set(excludeUids)
    const occupied = new Set(this.board
      .filter((card) => !this.isConsumed(card) && !excluded.has(card.uid))
      .map((card) => `${card.c},${card.r}`))
    const cells = []
    for (let r = 0; r < this.boardGridSize(); r++) {
      for (let c = 0; c < this.boardGridSize(); c++) {
        if (!occupied.has(`${c},${r}`)) cells.push({ c, r })
      }
    }
    if (!cells.length) return null
    return cells[randomize ? randomInt(cells.length) : 0]
  }
  removeCard(card, { source = 'effect' } = {}) {
    if (!card) return false
    const index = this.board.findIndex((item) => item.uid === card.uid)
    if (index < 0) return false
    this.board.splice(index, 1)
    this._runResolution('card:removed', [], { card, source })
    return true
  }
  swapCardPositions(a, b, { revealB = false, revealCost = 0, cause = 'movement' } = {}) {
    if (!a || !b || a.uid === b.uid) return { moved: false, reason: 'invalid' }
    const from = { c: a.c, r: a.r }
    const to = { c: b.c, r: b.r }
    ;[a.c, b.c] = [b.c, a.c]
    ;[a.r, b.r] = [b.r, a.r]
    let revealed = null
    if (revealB && !b.flipped) revealed = this._revealCard(b, { sanCost: revealCost, cause })
    return { moved: true, swapped: true, from, to, collision: b, revealed }
  }
  moveCard(card, c, r, {
    collision = 'reject', revealCollision = false, revealCost = 0, cause = 'movement',
  } = {}) {
    if (!card || !this.board.includes(card) || this.isConsumed(card)) return { moved: false, reason: 'invalid' }
    if (!this.isInsideBoard(c, r)) return { moved: false, reason: 'outside' }
    if (card.c === c && card.r === r) return { moved: false, reason: 'same' }
    const rawOccupied = this.getBoardCardAt(c, r, { includeConsumed: true })
    const occupied = rawOccupied && !this.isConsumed(rawOccupied) ? rawOccupied : null
    if (occupied) {
      if (collision !== 'swap') return { moved: false, reason: 'occupied', collision: occupied }
      return this.swapCardPositions(card, occupied, {
        revealB: revealCollision, revealCost, cause,
      })
    }
    if (rawOccupied) this.removeCard(rawOccupied, { source: `${cause}:clear-consumed` })
    const from = { c: card.c, r: card.r }
    card.c = c
    card.r = r
    return { moved: true, swapped: false, from, to: { c, r } }
  }
  pushCard(card, { direction = null, distance = 1, revealCollision = true, revealCost = 0, cause = 'push' } = {}) {
    const dirs = [
      [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0],
      [-1, 1], [0, 1], [1, 1],
    ]
    const [dc, dr] = direction || dirs[randomInt(dirs.length)]
    const steps = Math.max(1, Math.floor(Number(distance) || 1))
    return this.moveCard(card, card.c + dc * steps, card.r + dr * steps, {
      collision: 'swap', revealCollision, revealCost, cause,
    })
  }
  randomSwapCard(card, { cause = 'movement' } = {}) {
    if (!card || !this.board.includes(card) || this.isConsumed(card)) return { moved: false, reason: 'invalid' }
    const cells = []
    for (let r = 0; r < this.boardGridSize(); r++) {
      for (let c = 0; c < this.boardGridSize(); c++) {
        if (c !== card.c || r !== card.r) cells.push({ c, r })
      }
    }
    if (!cells.length) return { moved: false, reason: 'no-cell' }
    const target = cells[randomInt(cells.length)]
    return this.moveCard(card, target.c, target.r, { collision: 'swap', cause })
  }
  moveMonsterToRandomNeighbor(card, { source = 'monster-skill' } = {}) {
    if (!card || !this.isHostileMonster(card) || card.monsterHp <= 0) return { moved: false, reason: 'invalid' }
    const cells = []
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dc && !dr) continue
        const c = card.c + dc
        const r = card.r + dr
        if (!this.isInsideBoard(c, r) || this.isCellOccupied(c, r)) continue
        cells.push({ c, r })
      }
    }
    if (!cells.length) return { moved: false, reason: 'no-cell' }
    const target = cells[randomInt(cells.length)]
    const result = this.moveCard(card, target.c, target.r, { collision: 'reject', cause: source })
    if (result.moved) this.log.push(card.def.name + ' \u79fb\u52a8\u5230\u4e86\u76f8\u90bb\u683c\u3002')
    return result
  }
  spawnCard(raw, {
    position = null, faction = 'neutral', entityKind = 'card', summoned = false,
    flipped = true, hp = null, maxHp = null, ai = null, summonTurns = null, source = 'effect',
  } = {}) {
    const cell = position || this.findEmptyBoardCell()
    if (!cell || !this.isInsideBoard(cell.c, cell.r) || this.isCellOccupied(cell.c, cell.r)) return null
    const consumedAtCell = this.getBoardCardAt(cell.c, cell.r, { includeConsumed: true })
    if (consumedAtCell) this.removeCard(consumedAtCell, { source: `${source}:clear-consumed` })
    const card = this._makeCard(raw, cell.c, cell.r, flipped, {
      faction, entityKind, summoned, hp, maxHp, ai, summonTurns,
    })
    this.board.push(card)
    this._runResolution('card:spawned', [], { card, source })
    return card
  }
  spawnSlime({ source = 'effect' } = {}) {
    const def = SUMMONS.find((item) => item.id === 's_slime') || SUMMONS[0]
    if (!def) return null
    const card = this.spawnCard({ type: T.MONSTER, def }, {
      faction: 'ally', entityKind: 'summon', summoned: true, flipped: true, ai: 'none', source,
    })
    if (card) this.log.push(`召唤了${card.def.name}。`)
    else this.log.push('没有空的棋盘格，召唤失败。')
    return card
  }
  transformIntoSlime(card, { source = 'effect' } = {}) {
    const def = SUMMONS.find((item) => item.id === 's_slime') || SUMMONS[0]
    if (!def || !card || !this.isHostileMonster(card) || card.def.tier === 'B') return null
    card.def = def
    card.faction = 'ally'
    card.entityKind = 'summon'
    card.summoned = true
    card.ai = 'none'
    card.dead = false
    card.flipped = true
    card.pollut = false
    card.skills = Array.isArray(def.skills) ? [...def.skills] : []
    card.skillState = {}
    card.monsterHp = def.hp
    card.maxMonsterHp = def.hp
    card._slowTurns = 0
    card._burnTurns = 0
    card.statuses = new StatusStore()
    this._runResolution('card:transformed', [], { card, source })
    this.log.push(`${card.def.name} 加入了你的阵营。`)
    return card
  }
  dealCardDamage(card, amount, { source = 'effect', channel = 'damage:ally', attacker = null, minDamage = 0, ...context } = {}) {
    if (!card || card.type !== T.MONSTER || card.monsterHp <= 0) return { incoming: 0, dealt: 0 }
    const incoming = Math.max(0, Math.floor(Number(amount) || 0))
    const dealt = Math.max(
      Math.max(0, Math.floor(Number(minDamage) || 0)),
      Math.floor(this.modifyByRelicsAcross([channel], incoming, { ...context, source, attacker, target: card })),
    )
    card.monsterHp = Math.max(0, card.monsterHp - dealt)
    this._runResolution('damage:dealt', [], { amount: dealt, incoming, source, channel, target: card, attacker, ...context })
    return { incoming, dealt }
  }
  destroyCard(card, { source = 'effect', attacker = null } = {}) {
    if (!card || card.type !== T.MONSTER || card.monsterHp <= 0) return false
    card.monsterHp = 0
    card.dead = true
    this._runResolution('card:destroyed', [], { card, source, attacker })
    this.log.push(`${card.def.name} 被消灭。`)
    return true
  }
  selectCombatTarget(attacker) {
    const allies = this.friendlySummonsOnBoard()
    if (!allies.length) return null
    return allies.slice().sort((a, b) => {
      const da = Math.max(Math.abs(a.c - attacker.c), Math.abs(a.r - attacker.r))
      const db = Math.max(Math.abs(b.c - attacker.c), Math.abs(b.r - attacker.r))
      return da - db || a.uid - b.uid
    })[0]
  }

  findWeapon(instUid) {
    for (const e of this.equipment.items) if (e && e.uid === instUid) return e
    for (const h of this.hand) if (h && h.uid === instUid) return h
    return null
  }

  // Resolve a weapon whose durability has reached zero through the generic
  // resolution bus. Relics and future systems can subscribe without adding
  // weapon-specific branches to combat code.
  resolveWeaponBroken(weapon, source = 'system') {
    if (!weapon || weapon.curDur > 0) return false
    this._runResolution('weapon:broken', [], { weapon, source })
    return true
  }

  consumeWeaponDurability(weapon, {
    card = null, buff = null, strike = null, consume = true, source = 'attack',
  } = {}) {
    if (!weapon || !consume || (buff && buff.noDurLoss)) return { cost: 0, broken: false }
    if (weapon.maintain > 0) {
      weapon.maintain--
      return { cost: 0, broken: false, maintained: true }
    }
    const cost = Math.max(0, Math.floor(this.modifyByRelics(
      'weapon:durabilityCost', 1, { weapon, card, buff, strike },
    )))
    weapon.curDur = Math.max(0, weapon.curDur - cost)
    const broken = weapon.curDur <= 0
    if (broken) this.resolveWeaponBroken(weapon, source)
    return { cost, broken }
  }

  discardBrokenWeapon(weapon) {
    if (!weapon) return false
    const removedEquip = this.equipment.removeByUid(weapon.uid)
    const removedHand = removedEquip ? null : this.inventory.removeByUid(weapon.uid)
    const removed = removedEquip || removedHand
    if (!removed) return false
    this.armedSlot = null
    this.selectedHand = null
    this.selectedBackpackUid = null
    this.itemTargetMode = null
    this.log.push(`自动丢弃破损武器：${removed.def.name}。`)
    return true
  }

  equippedWeapons() { return this.equipment.items }
  attackWeapons() {
    const seen = new Set()
    return this.equip.filter((weapon) => {
      if (!weapon || weapon.curDur <= 0 || seen.has(weapon.uid)) return false
      seen.add(weapon.uid)
      return true
    })
  }
  canAttack() { return this.attackWeapons().length > 0 }

  // 怪物对玩家的实际攻击力（含污染/狂暴/Boss/减速/疯狂/环境）
  monsterAttackValue(card) {
    let atk = card.def.atk
    if (card.pollut) atk = Math.floor(atk * 1.5)
    if (card.def.tier === 'B' && card.monsterHp < 20) atk += 2   // 狂暴
    if (this._mod && this._mod.monAtkMalus) atk = Math.max(0, atk - this._mod.monAtkMalus)
    if (card._slowTurns > 0) atk = Math.max(0, atk - 1)
    const attackBonus = this.cardStatuses(card).all().reduce((sum, status) =>
      sum + Math.max(0, Number(status.data?.attackBonus) || 0), 0)
    atk += attackBonus
    const em = this.emotionDef()
    if (em) atk = Math.floor(atk * em.defMul)
    return Math.max(0, atk)
  }

  monsterSkillAttack(card, { multiplier = 1, sanity = 1, source = 'monster-skill' } = {}) {
    if (!this.isHostileMonster(card) || !card.flipped || card.monsterHp <= 0) {
      return { attacked: false, reason: 'invalid' }
    }
    const damage = Math.max(1, Math.floor(this.monsterAttackValue(card) * (Number(multiplier) || 1)))
    const taken = this.receiveDamage(damage, {
      source, channel: 'damage:monster', attacker: card, minDamage: 1,
    })
    const sanLoss = this.spendSanity(sanity, { source })
    this.log.push(card.def.name + ' \u653b\u51fb\u4f60\uff0c-' + taken.healthDamage +
      ' \u751f\u547d\uff08\u62a4\u7532\u5438\u6536 ' + taken.absorbed + '\uff09\u3002')
    if (sanLoss) this.log.push(card.def.name + ' \u4f7f\u4f60\u5931\u53bb ' + sanLoss + ' \u70b9\u7406\u667a\u3002')
    return { attacked: true, damage, taken, sanLoss }
  }

  resolveMonsterRetaliation(card, weapons, {
    source = 'retaliation', minDamage = 1,
  } = {}) {
    const backstab = this.hasCardStatus(card, 'backstab')
    const banished = this.isMonsterCombatDisabled(card)
    if (backstab) this.removeCardStatus(card, 'backstab')
    if (backstab || banished) {
      this.log.push(card.def.name + ' 未能反击。')
      return { skipped: true, reason: backstab ? 'backstab' : 'banished' }
    }
    let counter = this.monsterAttackValue(card)
    if (this.thorns) {
      counter = Math.max(0, counter - this.thorns)
      this.thorns = 0
    }
    const taken = this.receiveDamage(counter, {
      source, attacker: card, minDamage,
    })
    const durability = (weapons || []).map((weapon) =>
      weapon.def.name + ' ' + weapon.curDur + '/' + weapon.maxDur).join('、')
    this.log.push(card.def.name + ' 反击 ' + counter + '（护甲吸收 ' + taken.absorbed + '）。' + durability)
    this.monsterSkills.trigger(card, 'attack:after', {
      damage: taken.healthDamage, target: 'player', source,
    })
    return { skipped: false, counter, taken }
  }

  _runResolution(name, effects, context = {}) {
    const queue = new EffectQueue()
    const resolutionContext = { state: this, name, ...context }
    queue.enqueueAll(effects)
    queue.enqueueAll(this.triggers.collect(name, resolutionContext))
    const trace = queue.run(resolutionContext)
    this.resolutionTrace = trace
    this.resolutionHistory.push({ name, trace })
    if (this.resolutionHistory.length > 30) this.resolutionHistory.shift()
    this.ruleBus.emit('resolution:complete', { name, trace })
    return trace
  }

  addArmor(amount) {
    const gain = Math.max(0, Math.floor(Number(amount) || 0))
    if (gain <= 0) return 0
    this.player.armor = Math.max(0, Number(this.player.armor) || 0) + gain
    return gain
  }

  gainSanity(amount, { source = 'effect' } = {}) {
    const gain = Math.max(0, Math.floor(Number(amount) || 0))
    if (gain <= 0 || this.player.san >= this.player.maxSan) return 0
    const restored = Math.min(gain, this.player.maxSan - this.player.san)
    if (restored <= 0) return 0
    this.player.san += restored
    return restored
  }

  spendSanity(amount, { source = 'effect' } = {}) {
    const cost = Math.max(0, Math.floor(Number(amount) || 0))
    if (cost <= 0 || this.player.san <= 0) return 0
    const spent = Math.min(cost, this.player.san)
    this.player.san -= spent
    return spent
  }

  healPlayer(amount, { source = 'effect', ...context } = {}) {
    const gain = Math.max(0, Math.floor(Number(amount) || 0))
    if (gain <= 0 || this.player.hp >= this.player.maxHp) return 0
    const healed = Math.min(gain, this.player.maxHp - this.player.hp)
    if (healed <= 0) return 0
    this.player.hp += healed
    this._runResolution('player:healed', [], { amount: healed, source, ...context })
    return healed
  }

  receiveDamage(amount, {
    bypassArmor = false, source = 'monster-attack', channel = null, attacker = null, minDamage = 0, ...context
  } = {}) {
    const baseIncoming = Math.max(0, Math.floor(Number(amount) || 0))
    const damageChannel = channel || (source === 'retaliation'
      ? 'damage:retaliation'
      : source === 'monster-attack'
        ? 'damage:monster'
        : null)
    const channels = ['damage:incoming']
    if (damageChannel) channels.push(damageChannel)
    const incoming = Math.max(
      Math.max(0, Math.floor(Number(minDamage) || 0)),
      Math.floor(this.modifyByRelicsAcross(channels, baseIncoming, {
        bypassArmor, source, channel, attacker, ...context,
      })),
    )
    const damageContext = {
      amount: incoming,
      source,
      attacker,
      bypassArmor,
      minDamage, channel,
      ...context,
    }
    damageContext.mutable = damageContext
    this._runResolution('damage:before', [], damageContext)
    const mitigatedIncoming = Math.max(
      Math.max(0, Math.floor(Number(minDamage) || 0)),
      Math.floor(Number(damageContext.amount) || 0),
    )
    const sanityAbsorbed = Math.max(0, incoming - mitigatedIncoming)
    const currentArmor = Math.max(0, Number(this.player.armor) || 0)
    const absorbed = bypassArmor ? 0 : Math.min(currentArmor, mitigatedIncoming)
    const healthDamage = mitigatedIncoming - absorbed
    this.player.armor = currentArmor - absorbed
    this.player.hp = Math.max(0, this.player.hp - healthDamage)
    this._runResolution('damage:received', [], {
      amount: mitigatedIncoming, absorbed, healthDamage, sanityAbsorbed, source, channel, attacker, bypassArmor, ...context,
    })
    const result = { incoming: mitigatedIncoming, absorbed, healthDamage }
    if (sanityAbsorbed > 0) result.sanityAbsorbed = sanityAbsorbed
    return result
  }

  dealMonsterDamage(card, amount, { channel = 'damage:outgoing', source = 'effect', ...context } = {}) {
    if (!this.isHostileMonster(card) || card.monsterHp <= 0) return { incoming: 0, dealt: 0 }
    const incoming = Math.max(0, Math.floor(Number(amount) || 0))
    const modified = Math.max(0, Math.floor(this.modifyByRelicsAcross(
      ['damage:outgoing', channel],
      incoming,
      { ...context, source, target: card },
    )))
    const damageReduction = this.cardStatuses(card).all().reduce((sum, status) =>
      sum + Math.max(0, Number(status.data?.damageReduction) || 0), 0)
    const dealt = Math.max(0, modified - damageReduction)
    card.monsterHp -= dealt
    this._runResolution('damage:dealt', [], {
      amount: dealt, incoming, modified, damageReduction, source, channel, target: card, ...context,
    })
    if (dealt > 0 && card.monsterHp > 0) {
      this.monsterSkills.trigger(card, 'damaged', { amount: dealt, incoming, source, channel, ...context })
    }
    return { incoming, dealt }
  }

  // Direct damage deliberately bypasses modifiers, triggers and kill rewards.
  // It is reserved for effects such as reflection that must not chain into
  // other relics or secondary damage systems.
  dealDirectMonsterDamage(card, amount) {
    if (!this.isHostileMonster(card) || card.monsterHp <= 0) return 0
    const dealt = Math.max(0, Math.floor(Number(amount) || 0))
    if (dealt <= 0) return 0
    card.monsterHp = Math.max(0, card.monsterHp - dealt)
    return dealt
  }

  // Atomic finisher for effects that turn a living enemy into a reward. The
  // normal kill pipeline still runs, so drops, relic hooks and boss handling
  // remain identical to an ordinary kill.
  convertMonsterToGold(card, { weapon = null, source = 'effect', noAttackUids = null } = {}) {
    if (!this.isHostileMonster(card) || card.monsterHp <= 0) return 0
    const gold = Math.max(0, Math.floor(Number(card.monsterHp) || 0))
    card.monsterHp = 0
    if (gold > 0) {
      this.player.gold += gold
      this.log.push(`${card.def.name} 化为金币：+${gold}。`)
    }
    this._onMonsterKilled(card, weapon, { noAttackUids })
    this._runResolution('monster:converted-gold', [], { card, gold, weapon, source })
    return gold
  }

  dealAreaMonsterDamage(center, amount, {
    radius = 1,
    channel = 'area:damage',
    source = 'area',
    excludeUid = center?.uid,
  } = {}) {
    const targets = this.board.filter((card) =>
      this.isHostileMonster(card) && card.flipped && card.monsterHp > 0 &&
      card.uid !== excludeUid && this._withinCardRange(center, card, radius))
    return targets.map((card) => ({
      card,
      ...this.dealMonsterDamage(card, amount, { channel, source, center }),
    }))
  }

  randomHostileMonsterInRange(center, radius = 2, excludeUids = []) {
    const excluded = new Set(excludeUids)
    const targets = this.board.filter((card) =>
      this.isHostileMonster(card) && card.flipped && card.monsterHp > 0 &&
      !excluded.has(card.uid) && this._withinCardRange(center, card, radius))
    return targets.length ? targets[randomInt(targets.length)] : null
  }

  randomHiddenCardInRange(center, radius = 2) {
    const targets = this.board.filter((card) =>
      card.uid !== center?.uid && !card.flipped && !this.isConsumed(card) &&
      this._withinCardRange(center, card, radius))
    return targets.length ? targets[randomInt(targets.length)] : null
  }

  // Composite used by attack splash relics: prefer one revealed enemy, or
  // reveal one hidden card in range when no enemy is available.
  resolveRandomAttackSplash(center, amount, {
    radius = 2,
    weapon = null,
    source = 'attack:splash',
    cause = 'attack:splash',
    noAttackUids = null,
  } = {}) {
    const target = this.randomHostileMonsterInRange(center, radius, [center?.uid])
    if (target) {
      const damage = this.dealMonsterDamage(target, amount, {
        channel: 'secondary:damage', source, center, weapon,
      })
      if (target.monsterHp <= 0 && !target.dead) this._onMonsterKilled(target, weapon, { noAttackUids })
      return { type: 'damage', card: target, ...damage }
    }
    const hidden = this.randomHiddenCardInRange(center, radius)
    if (!hidden) return { type: 'none', card: null, noAttackUids: new Set() }
    const reveal = this._revealCard(hidden, { sanCost: null, cause })
    return { type: 'reveal', card: hidden, ...reveal }
  }

  // ---------- 回合推进（Boss 轮换 / 塔威） ----------
  _tickTurn(card) {
    this._runResolution('turn:start', [
      { id: 'turn:advance', phase: RESOLUTION_PHASES.TURN_START, apply: () => { this.turn++ } },
      { id: 'turn:active-skill-cooldowns', phase: RESOLUTION_PHASES.TURN_START, apply: () => { this._tickActiveSkillCooldowns() } },
      { id: 'turn:monster-skill-cooldowns', phase: RESOLUTION_PHASES.TURN_START, apply: () => { this.monsterSkills.tickCooldowns() } },
      { id: 'turn:monster-skills', phase: RESOLUTION_PHASES.TURN_START, apply: () => { this.monsterSkills.triggerBoard('turn:start', { turn: this.turn }) } },
      { id: 'turn:emotion', phase: RESOLUTION_PHASES.TURN_START, apply: () => {
        if (this.turn % 5 === 0 && !this.gameOver) this._rollEmotion()
      } },
      { id: 'turn:reset-buff-limit', phase: RESOLUTION_PHASES.TURN_START, apply: () => { this.buffUsedThisTurn = false } },
      { id: 'turn:rotate-boss', phase: RESOLUTION_PHASES.TURN_START, apply: () => { this._rotateBoss() } },
      { id: 'turn:tower-counter', phase: RESOLUTION_PHASES.TURN_START, apply: () => { this._bossTowerCount++ } },
      { id: 'turn:tower', phase: RESOLUTION_PHASES.TURN_START, apply: () => {
        if (this._bossTowerCount % 3 === 0 && this.hasBoss()) {
          this.receiveDamage(1, { bypassArmor: true, source: 'tower' })
          this.log.push('黑塔之主发动「塔威」，你受到 1 点无视防御的伤害。')
        }
      } },
      { id: 'turn:slow-expire', phase: RESOLUTION_PHASES.TURN_STATUS, apply: () => {
        if (card && card._slowTurns > 0) card._slowTurns--
      } },
      { id: 'turn:burn', phase: RESOLUTION_PHASES.TURN_STATUS, apply: () => { this._processBurns() } },
      { id: 'turn:statuses', phase: RESOLUTION_PHASES.TURN_STATUS, apply: () => { this._processStatuses() } },
    ], { card })
  }
  // 火焰灼烧结算：每回合对处于燃烧状态的怪物造成 1 点伤害（武器.md「火焰溅射」词条）
  _processBurns() {
    for (const card of this.board) {
      if (this.isHostileMonster(card) && card._burnTurns > 0 && card.monsterHp > 0) {
        const burn = this.dealMonsterDamage(card, 1, { channel: 'status:damage', source: 'dot' })
        card._burnTurns -= 1
        this.log.push(`${card.def.name} 被火焰灼烧，受到 ${burn.dealt} 点伤害${card._burnTurns > 0 ? '' : '（熄灭）'}。`)
        if (card.monsterHp <= 0) this._onMonsterKilled(card, null)
      }
    }
  }
  _processStatuses() {
    for (const card of this.board) {
      if (!this.isHostileMonster(card) || card.monsterHp <= 0) continue
      const statuses = this.cardStatuses(card)
      for (const status of statuses.all()) {
        if (status.id === 'bleed' && status.turns !== null && status.turns > 0) {
          const damage = this.dealMonsterDamage(card, status.amount || 2, {
            channel: 'status:damage', source: 'bleed', card, status,
          })
          this.log.push(`${card.def.name} 受到流血伤害 ${damage.dealt}。`)
          if (card.monsterHp <= 0 && !card.dead) this._onMonsterKilled(card, null)
          continue
        }
        if (status.id !== 'curse' || status.turns === null || status.turns > 1) continue
        const damage = this.dealMonsterDamage(card, status.amount || 20, {
          channel: 'status:damage', source: 'curse', card, status,
        })
        this.log.push(`${card.def.name} 的诅咒爆发，受到 ${damage.dealt} 点伤害。`)
        statuses.remove(status.uid)
        if (card.monsterHp <= 0 && !card.dead) this._onMonsterKilled(card, null)
      }
      statuses.tick()
    }
  }

  // ---------- 行动：等待一回合 ----------
  // Waiting is a real player action, not a UI-only shortcut. It advances the
  // same turn-start and enemy-threat phases as any other turn-consuming
  // action, while leaving board cards, equipment, pending buffs and inventory
  // selections untouched.
  waitTurn() {
    if (this.gameOver) return { ok: false, reason: 'game-over' }
    if (this.phase !== 'explore') return { ok: false, reason: 'phase' }
    if (this.madness) return this._madnessAct()

    this._tickTurn()
    if (this._checkDead()) return { ok: false, reason: 'dead' }
    this.log.push('等待一回合。')
    this._monsterAttackAll()
    if (this._checkDead()) return { ok: false, reason: 'dead' }
    this.bus.emit('change')
    this._save()
    return { ok: true }
  }

  _adjacent(a, b) { return isAdjacent8(a, b) }
  // 连锁闪电：对目标相邻的随机一只存活怪物造成 2 点闪电伤害（武器.md「连锁闪电」词条）
  _chainLightning(card, w, { noAttackUids = null } = {}) {
    const adj = this.board.filter(b =>
      this.isHostileMonster(b) && b.flipped && b.monsterHp > 0 &&
      b.uid !== card.uid && this._adjacent(b, card))
    if (!adj.length) return
    const t = adj[randomInt(adj.length)]
    const lightning = this.dealMonsterDamage(t, 2, { channel: 'secondary:damage', source: 'chain-lightning' })
    this.log.push(`连锁闪电跳跃至 ${t.def.name}，造成 ${lightning.dealt} 点闪电伤害。`)
    if (t.monsterHp <= 0) this._onMonsterKilled(t, w, { noAttackUids })
  }
  _rollEmotion() {
    const id = rollEmotionId(this.player.san, this.player.maxSan)
    this.emotion = id
    const e = EMOTIONS[id]
    this.log.push(`情绪涌动：你陷入「${e.name}」——${e.desc}。`)
  }
  _rotateBoss() {
    for (const c of this.board) {
      if (this.isHostileMonster(c) && c.def.tier === 'B') {
        c.bossWeakType = ['劈砍', '穿刺', '钝击', '元素'][randomInt(4)]
        c.def = { ...c.def, category: catOf(c.bossWeakType) }
      }
    }
  }

  // ---------- 行动：翻牌 ----------
  _withinCardRange(a, b, radius) {
    return Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r)) <= radius
  }

  _revealCard(card, { sanCost = null, cause = 'action' } = {}) {
    if (!card || card.flipped) return { noAttackUids: new Set() }
    if (!this.flipCard(card, { cause })) return { noAttackUids: new Set() }
    const cost = sanCost == null ? (card.type === T.MONSTER ? 2 + this._sanCostExtra : 0) : sanCost
    const spent = this.spendSanity(cost, { source: 'card:reveal' })
    if (spent) {
      this.log.push(`直面${card.def.name}，理智 -${spent}。`)
    }
    const result = this._resolveFlip(card, { cause }) || {}
    this._runResolution('card:revealed', [], { card, cause })
    const noAttackUids = new Set(result.noAttackUids || [])
    if (card.type === T.MONSTER) {
      noAttackUids.add(card.uid)
      this.monsterSkills.trigger(card, 'reveal', { cause, noAttackUids })
    }
    return { noAttackUids }
  }

  // Atomic board action: flip a card only. Costs, effects and retaliation are
  // deliberately handled by the caller so traps and relics can compose them.
  flipCard(card, { cause = 'action' } = {}) {
    if (!card || card.flipped) return false
    card.flipped = true
    this.bus.emit('animate:flip', card.uid)
    return true
  }

  revealAllMonsters({ cause = 'effect', sanCost = null } = {}) {
    const noAttackUids = new Set()
    const hidden = this.board.filter((card) => this.isHostileMonster(card) && !card.flipped && card.monsterHp > 0)
    for (const card of hidden) {
      const reveal = this._revealCard(card, { cause, sanCost })
      for (const uid of reveal.noAttackUids) noAttackUids.add(uid)
    }
    return noAttackUids
  }

  // Pull revealed enemies into the eight cells around the entry. Occupants in
  // those cells are swapped without being revealed, so this is still a pure
  // board movement operation rather than a second teleport/entity system.
  pullMonstersNearEntry({ radius = 1, sanCost = 0, cause = 'effect' } = {}) {
    const noAttackUids = this.revealAllMonsters({ cause, sanCost })
    const entry = this.board.find((card) => card.type === T.ENTRY && !this.isConsumed(card))
    if (!entry) return { moved: 0, noAttackUids }
    const cells = []
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (dc === 0 && dr === 0 || !this.isInsideBoard(entry.c + dc, entry.r + dr)) continue
        cells.push({ c: entry.c + dc, r: entry.r + dr })
      }
    }
    const enemies = this.monstersOnBoard().slice()
    let moved = 0
    for (const enemy of enemies) {
      const target = cells.find((cell) => {
        if (enemy.c === cell.c && enemy.r === cell.r) return false
        const occupant = this.getBoardCardAt(cell.c, cell.r)
        return !occupant || occupant.uid === enemy.uid || !this.isHostileMonster(occupant)
      })
      if (!target) continue
      const result = this.moveCard(enemy, target.c, target.r, {
        collision: 'swap', revealCollision: false, cause,
      })
      if (result.moved) moved++
    }
    return { moved, noAttackUids }
  }

  peekRandomNeighbor(card) {
    if (!card) return null
    const candidates = this.board.filter((other) =>
      other.uid !== card.uid && !other.flipped && !this.isConsumed(other) && this._withinCardRange(card, other, 1))
    if (!candidates.length) return null
    const target = candidates[randomInt(candidates.length)]
    target.peeked = true
    return target
  }

  revealCardsInRadius(center, { radius = 1, sanCost = 0, cause = 'area:reveal' } = {}) {
    const noAttackUids = new Set()
    const targets = this.board.filter((card) =>
      card.uid !== center?.uid && !card.flipped && this._withinCardRange(center, card, radius))
    for (const card of targets) {
      const reveal = this._revealCard(card, { sanCost, cause })
      for (const uid of reveal.noAttackUids) noAttackUids.add(uid)
    }
    return noAttackUids
  }
  revealRandomCard({ sanCost = 0, cause = 'effect' } = {}) {
    const candidates = this.board.filter((card) => !card.flipped && !this.isConsumed(card))
    if (!candidates.length) return { card: null, noAttackUids: new Set() }
    const card = candidates[randomInt(candidates.length)]
    return { card, ...this._revealCard(card, { sanCost, cause }) }
  }

  flip(uid, internal = false) {
    if (this.gameOver) return
    if (this.phase === 'rest') return   // 修整阶段不翻牌，仅允许调整装备/行囊
    if (this.madness && !internal) return this._madnessAct()
    const card = this.getCard(uid)
    if (!card || card.flipped) return
    if (!this.flippableCards().includes(card)) { this.log.push(`只能翻开距离已翻开牌 ${this.flipRange()} 格以内的牌。`); this.bus.emit('change'); return }

    this._tickTurn(card)
    const reveal = this._revealCard(card)
    if (this.gameOver) return
    if (this._checkDead()) return
    this._monsterAttackAll(reveal.noAttackUids)
    this._checkDead()
    this.bus.emit('change')
    this._save()
  }

  _resolveFlip(card, context = {}) {
    switch (card.type) {
      case T.MONSTER:
        this.log.push(`翻出怪物：${card.def.name}（${card.monsterHp}/${card.def.hp} 血，攻 ${card.def.atk}）。它本回合不攻击。`)
        if (card.pollut) this.log.push('（污染）该怪物攻击 +50%、掉落翻倍。')
        if (card.def.tier === 'B') this.log.push('⚠ 这是黑塔之主！弱点每回合轮换。')
        break
      // 战利品牌：翻开后留在场上，需再点击一次才拾取（不消耗回合），以配合行囊形状容量
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
      case T.TRAP: {
        const mutable = { cancelled: false }
        this._runResolution('trap:before-trigger', [], { card, cause: context.cause, mutable })
        card.triggered = true
        if (mutable.cancelled) return { noAttackUids: new Set() }
        const noAttackUids = new Set()
        if (card.def.trap === 'explosion') {
          const damage = card.def.damage || 2
          const taken = this.receiveDamage(damage, { source: 'trap:explosion' })
          this.log.push(`爆炸陷阱触发：你受到 ${taken.healthDamage} 点伤害，护甲吸收 ${taken.absorbed}。`)
          const victims = this.board.filter((other) =>
            this.isHostileMonster(other) && other.flipped && other.monsterHp > 0 && this._withinCardRange(card, other, card.def.radius || 1) && other.uid !== card.uid)
          for (const victim of victims) {
            const blast = this.dealMonsterDamage(victim, damage, { channel: 'trap:damage', source: 'trap:explosion' })
            this.log.push(`${victim.def.name} 受到爆炸伤害 ${blast.dealt}。`)
            if (victim.monsterHp <= 0 && !victim.dead) this._onMonsterKilled(victim, null)
          }
        } else if (card.def.trap === 'sound') {
          const radius = card.def.radius || 2
          const targets = this.board.filter((other) =>
            this.isHostileMonster(other) && !other.flipped && this._withinCardRange(card, other, radius))
          for (const target of targets) {
            const reveal = this._revealCard(target, { sanCost: 1, cause: 'trap:sound' })
            for (const uid of reveal.noAttackUids) noAttackUids.add(uid)
          }
          this.log.push(`声响陷阱触发：翻开 ${targets.length} 个范围内的敌人。`)
        }
        return { noAttackUids }
      }
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
        this._runResolution('key:collected', [], { amount: 1, source: 'card', card })
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
    if (!this.canStore(card.inst)) {
      this.log.push(`行囊没有足够的连续空间放下 ${card.inst.def.name}，物品会留在原地。`)
      this.bus.emit('change')
      return
    }
    this.addToHand(card.inst)
    // 污染战利品的负面在拾取时结算（药水减半 / buff 与道具额外失 1 理智）
    if (card.pollut) {
      if (card.type === T.POTION) { card.inst.pollutHeal = true; this.log.push('（污染药水）治疗效果减半。') }
      if (card.type === T.ITEM) { card.inst.pollutItem = true }
      if (card.type === T.BUFF) { card.inst.pollutBuff = true }
    }
    card.picked = true
    this.log.push(`拾取 ${card.inst.def.name}（行囊 ${this.inventory.usedCells}/${this.inventory.capacity} 格，不消耗回合）。`)
    this._runResolution('card:picked', [], { card, item: card.inst, source: 'pickup' })
    this.bus.emit('change')
    this._save()
  }

  // ---------- 失控状态：理智耗尽时，本回合行动随机化（一过性，结束后恢复控制）----------
  _madnessAct() {
    const flippable = this.flippableCards()
    const mons = this.monstersOnBoard()
    const recover = () => { this.player.san = Math.max(this.player.san, 3) }
    if ((flippable.length && random() < 0.6) || !mons.length) {
      if (flippable.length) { this.flip(flippable[randomInt(flippable.length)].uid, true); recover(); return }
      this.log.push('（失控）无牌可翻，你原地颤抖。'); recover(); this.bus.emit('change'); return
    }
    // 随机攻击
    const wIdx = this.equip.findIndex(w => w && w.curDur > 0)
    if (wIdx >= 0) {
      this.armedSlot = wIdx
      this.attack(mons[randomInt(mons.length)].uid, true)
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

  // ---------- 装备栏选择（仅用于丢弃等管理操作，不决定攻击武器） ----------
  armWeapon(slotIdx) {
    if (this.gameOver) return
    if (this.equipment.isUnavailable(slotIdx)) {
      this.log.push('左手当前不可用：双手武器固定持于右手。')
      this.bus.emit('change')
      return
    }
    if (!this.equip[slotIdx]) { this.log.push('该装备栏为空。'); this.bus.emit('change'); return }
    this.armedSlot = this.armedSlot === slotIdx ? null : slotIdx
    this.selectedHand = null
    this.selectedBackpackUid = null
    if (this.armedSlot !== null) {
      const w = this.equip[this.armedSlot]
      if (w.curDur <= 0) this.log.push(`${w.def.name} 已破损，无法攻击，但仍可丢弃或修理。`)
      else this.log.push(`已选择 ${w.def.name}，可点击丢弃。攻击时会自动使用所有可用的手中武器。`)
    }
    this.bus.emit('change')
  }

  // Compatibility entry point for older callers. All attacks use the unified
  // multi-weapon resolver; selecting an equipment slot is never required.
  _legacyAttack(uid, internal = false) {
    return this.attack(uid, internal)
  }

  // One attack action resolves every usable weapon in acquisition/loadout
  // order. A two-handed weapon occupies both hands but is shown only in the
  // right HUD slot, remains one item, and therefore produces one strike. If the first strike kills the target,
  // later strikes are skipped; the action still consumes the turn.
  attack(uid, internal = false, options = {}) {
    if (this.gameOver) return
    if (this.madness && !internal) return this._madnessAct()
    const chainAttack = options.chain === true
    const consumeDurability = options.consumeDurability !== false
    const card = this.getCard(uid)
    if (!this.isHostileMonster(card) || !card.flipped || card.monsterHp <= 0) {
      this.log.push('请点击一个存活的怪物。')
      this.bus.emit('change')
      return
    }
    if (this.isMonsterCombatDisabled(card)) {
      this.log.push(`${card.def.name} 正处于放逐状态，无法被攻击。`)
      this.bus.emit('change')
      return
    }
    const relicGuard = chainAttack
      ? { allowed: true }
      : this.checkRelicAction('attack', { card })
    if (!relicGuard.allowed) {
      this.log.push('当前圣遗物效果禁止本次攻击。')
      this.bus.emit('change')
      return
    }
    const weapons = this.attackWeapons()
    if (!weapons.length) {
      this.log.push('没有可用的武器，无法攻击。')
      this.armedSlot = null
      this.bus.emit('change')
      return
    }

    if (!chainAttack && options.consumeTurn !== false) this._tickTurn(card)
    const buff = chainAttack ? null : this.pendingBuff
    const strikes = weapons.map((weapon) => ({ weapon, dmg: 0, crit: false, skipped: false }))
    // Reveals caused by secondary effects belong to this action but do not
    // get an immediate attack. Effects can add their revealed monster uids to
    // this action-local set (the same contract used by flip/active-skill).
    const noAttackUids = options.noAttackUids instanceof Set ? options.noAttackUids : new Set()
    let killWeapon = null
    const effects = []

    strikes.forEach((strike, index) => {
      const { weapon } = strike
      effects.push({
        id: `attack:strike:${index}:damage`, phase: RESOLUTION_PHASES.DAMAGE, sourceOrder: index,
        apply: () => {
          if (card.monsterHp <= 0) { strike.skipped = true; return }
          const em = this.emotionDef()
          const result = this.computeAttackDamage(weapon, card, buff, { strike })
          strike.dmg = result.dmg
          strike.crit = result.crit
          if (em) {
            if (em.miss && random() < em.miss) { this.log.push(`（${em.name}）攻击落空！`); strike.dmg = 0 }
            else strike.dmg = Math.floor(strike.dmg * em.atkMul)
          }
          strike.dmg = this.dealMonsterDamage(card, strike.dmg, {
            channel: 'attack:damage', source: 'attack', card, weapon, buff, strike,
          }).dealt
          if (buff && buff.lifesteal) {
            const heal = Math.floor(strike.dmg * buff.lifesteal)
            this.healPlayer(heal, { source: 'attack:lifesteal', card, weapon, strike })
            if (heal) this.log.push(`吸血 +${heal} 生命。`)
          }
          if (weapon.tags.includes('火焰溅射') && card.monsterHp > 0) {
            card._burnTurns = 2
            this.log.push(`${card.def.name} 被点燃，接下来 2 回合每回合受到 1 点火焰伤害。`)
          }
          if (buff && buff.slowTarget) card._slowTurns = 1
          if (card.monsterHp <= 0) killWeapon = weapon
        },
      })
      effects.push({
        id: `attack:strike:${index}:durability`, phase: RESOLUTION_PHASES.DURABILITY, sourceOrder: index,
        apply: () => {
          if (strike.skipped) return
          this.consumeWeaponDurability(weapon, {
            card, buff, strike, consume: consumeDurability, source: 'attack',
          })
        },
      })
      effects.push({
        id: `attack:strike:${index}:log`, phase: RESOLUTION_PHASES.DURABILITY, sourceOrder: weapons.length + index,
        apply: () => {
          if (!strike.skipped) this.log.push(`${weapon.def.name} → ${card.def.name}，造成 ${strike.dmg}${strike.crit ? '(暴击!)' : ''} 伤害。`)
        },
      })
      effects.push({
        id: `attack:strike:${index}:secondary`, phase: RESOLUTION_PHASES.SECONDARY, sourceOrder: index,
        apply: () => {
          if (!strike.skipped && weapon.tags.includes('连锁闪电')) this._chainLightning(card, weapon, { noAttackUids })
        },
      })
    })
    effects.push({
      id: 'attack:retaliation', phase: RESOLUTION_PHASES.RETALIATION, sourceOrder: weapons.length,
      apply: () => {
        this.resolveMonsterRetaliation(card, weapons)
      },
    })
    effects.push({
      id: 'attack:consume-buff', phase: RESOLUTION_PHASES.AFTER_ACTION, sourceOrder: 0,
      apply: () => {
        if (buff) {
          this.pendingBuff = null
          this.pendingBuffName = null
        }
      },
    })
    effects.push({
      id: 'attack:death', phase: RESOLUTION_PHASES.DEATH, sourceOrder: 0,
      apply: () => {
        if (card.monsterHp <= 0 && !card.dead) this._onMonsterKilled(card, killWeapon, { noAttackUids })
      },
    })
    effects.push({
      id: 'attack:finish', phase: RESOLUTION_PHASES.AFTER_ACTION, sourceOrder: 10,
      apply: () => { this.armedSlot = null },
    })
    // An attack is one complete player turn. The selected target has already
    // retaliated in RETALIATION; at TURN_END every other revealed, living
    // hostile monster gets its normal attack once. Chain follow-up attacks are
    // part of the same turn, so they only resolve their own target retaliation
    // and leave the full-board threat phase to the outer attack.
    effects.push({
      id: 'attack:monster-threat', phase: RESOLUTION_PHASES.TURN_END, sourceOrder: 0,
      apply: () => {
        if (chainAttack || this.gameOver || this.player.hp <= 0) return
        this._monsterAttackAll(new Set([card.uid, ...noAttackUids]))
      },
    })
    this._runResolution('attack', effects, {
      card, weapons, buff, strikes, chain: chainAttack, consumeDurability, noAttackUids,
    })
    if (this._checkDead()) return
    this.bus.emit('change')
    this._save()
  }

  findNextAdjacentEnemy(card, visited = []) {
    if (!card) return null
    const excluded = new Set(visited)
    const offsets = [
      [0, -1], [1, 0], [0, 1], [-1, 0],
      [1, -1], [1, 1], [-1, 1], [-1, -1],
    ]
    for (const [dc, dr] of offsets) {
      const target = this.getBoardCardAt(card.c + dc, card.r + dr)
      if (!target || excluded.has(target.uid) || !this.isHostileMonster(target) ||
          target.monsterHp <= 0 || this.isMonsterCombatDisabled(target)) continue
      return target
    }
    return null
  }

  chainAdjacentAttacks(origin, { source = 'effect', noAttackUids = null } = {}) {
    if (!origin) return 0
    if (!origin.dead && origin.monsterHp > 0) return 0
    const visited = new Set([origin.uid])
    let current = origin
    let count = 0
    while (count < this.board.length) {
      const target = this.findNextAdjacentEnemy(current, visited)
      if (!target) break
      visited.add(target.uid)
      this.attack(target.uid, true, {
        chain: true,
        consumeTurn: false,
        consumeDurability: false,
        noAttackUids,
      })
      count++
      if (!target.dead && target.monsterHp > 0) break
      current = target
      if (this.gameOver) break
    }
    if (count > 0) this.log.push(source + '：连续攻击 ' + count + ' 个相邻敌人。')
    return count
  }

  _onMonsterKilled(card, w, { noAttackUids = null } = {}) {
    if (!this.isHostileMonster(card) || card.dead) return
    const isBoss = card.def.tier === 'B'
    this.log.push(`${card.def.name} 被击败！`)
    if (w && w.tags.includes('吸血')) {
      const healed = this.healPlayer(2, { source: 'weapon:lifesteal', card, weapon: w })
      if (healed) this.log.push(`吸血 +${healed} 生命。`)
    }
    if (w && w.tags.includes('噬魂')) { this.player.san = Math.min(this.player.maxSan, this.player.san + 3); this.log.push('噬魂 +3 理智。') }
    const d = card.def.drop || {}
    // 金币（污染×2、战斗之路×goldMult）
    let goldDrop = 0
    if (d.gold) goldDrop = d.gold[0] + randomInt(d.gold[1] - d.gold[0] + 1)
    if (card.pollut) goldDrop *= 2
    if (this._mod.goldMult) goldDrop = Math.floor(goldDrop * this._mod.goldMult)
    if (w && w.tags.includes('贪婪')) goldDrop += 2
    goldDrop = Math.floor(goldDrop * this.emotionDropMul())
    if (goldDrop) { this.player.gold += goldDrop; this.log.push(`掉落 ${goldDrop} 金币。`) }
    // 钥匙（古老回响提升概率；悲观情绪降低掉落）
    const keyChance = (d.key || 0) * (1 + (this._mod.keyDropBonus || 0)) * this.emotionDropMul()
    if (keyChance && random() < keyChance) {
      this.player.keys++
      this.log.push(`掉落钥匙碎片！(${this.player.keys}/${this.player.keysNeeded})`)
      this._runResolution('key:collected', [], { amount: 1, source: 'monster', card })
    }
    // 药水
    if (d.potion && random() < d.potion) {
      const p = POTIONS[randomInt(POTIONS.length)]
      const inst = this._mkInst(p)
      if (this.addToHand(inst)) this.log.push(`掉落药水：${p.name}。`)
      else this.log.push('行囊放不下，药水掉落丢失。')
    }
    // 稀有武器（精英）
    if (d.rareWeapon && random() < d.rareWeapon) {
      const rw = WEAPONS.filter(x => x.rarity === '稀有' || x.rarity === '传说')
      const wdef = rw[randomInt(rw.length)]
      const inst = this._mkInst(wdef)
      if (this.addToHand(inst)) this.log.push(`掉落武器：${wdef.name}！`)
      else this.log.push('行囊放不下，武器掉落丢失。')
    }
    // 道具（三阶及以上怪物 15% 掉落随机道具，docs/道具.md）
    const tier = String(card.def.tier)
    if ((tier === '3' || tier === 'E') && random() < 0.15) {
      const itDef = ITEMS[randomInt(ITEMS.length)]
      const inst = this._mkInst(itDef)
      if (this.addToHand(inst)) this.log.push(`掉落道具：${itDef.name}。`)
      else this.log.push('行囊放不下，道具掉落丢失。')
    }
    if (isBoss) { this.win = true; this.gameOver = true; this.log.push('黑塔之主倒下，你逃离了黑塔！🎉'); this.clearSave() }
    card.dead = true
    this._runResolution('monster:killed', [], { card, weapon: w, noAttackUids })
  }

  // ---------- 行动：切武器（消耗回合）----------
  selectHand(idx) {
    if (this.gameOver) return
    this.selectedHand = this.selectedHand === idx ? null : idx
    this.selectedBackpackUid = this.selectedHand === null ? null : this.hand[this.selectedHand]?.uid || null
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
    if (this.selectedHand === null) { this.log.push('先在行囊中选择一把武器。'); this.bus.emit('change'); return }
    const handItem = this.hand[this.selectedHand]
    if (!handItem || !handItem.def.atk) { this.log.push('只能把武器放入装备栏。'); this.bus.emit('change'); return }
    const result = this.equipment.equip(handItem, slotIdx)
    if (!result.ok) { this.log.push('该武器无法装备到这只手。'); this.bus.emit('change'); return }
    this.removeHandAt(this.selectedHand)
    for (const old of result.removed) {
      if (old && old.uid !== handItem.uid) this.addToHand(old)
    }
    this.selectedHand = null
    this.selectedBackpackUid = null
    this.armedSlot = null
    this._runResolution('weapon:switched', [], { weapon: handItem, slotIdx, removed: result.removed })
    // 层间修整阶段自由调整装备/手牌，不消耗回合（核心机制.md §12）
    if (this.phase === 'rest') {
      this.log.push(`层间调整：${handItem.def.name} 装入${handItem.def.grip === GRIP.TWO ? '双手' : '一只手'}（不消耗回合）。`)
      this.bus.emit('change')
      this._save()
      return
    }
    const switchCostTurn = Math.max(0, Math.floor(this.modifyByRelics(
      'weapon:switchCostTurn', 1, { weapon: handItem, slotIdx, removed: result.removed },
    )))
    if (switchCostTurn > 0) this._tickTurn()
    this.log.push(`切换武器：${handItem.def.name} 装入${handItem.def.grip === GRIP.TWO ? '双手' : '一只手'}。`)
    if (switchCostTurn > 0) this._monsterAttackAll()
    if (switchCostTurn > 0 && this._checkDead()) return
    this.bus.emit('change')
    this._save()
  }

  // ---------- 行动：药水（不消耗回合）----------
  usePotion(idx) {
    if (this.gameOver) return
    const p = this.hand[idx]
    if (!p || (p.def.healHp === undefined && p.def.healSan === undefined && p.def.armor === undefined)) { this.log.push('请选择一张药水牌。'); this.bus.emit('change'); return }
    let hp = p.def.healHp || 0, san = p.def.healSan || 0
    const armor = p.def.armor || 0
    if (p.pollutHeal) { hp = Math.floor(hp / 2); san = Math.floor(san / 2) } // 污染药水减半
    if (hp) { this.player.hp = Math.min(this.player.maxHp, this.player.hp + hp); this.log.push(`使用 ${p.def.name}，+${hp} 生命。`) }
    if (san) { this.player.san = Math.min(this.player.maxSan, this.player.san + san); this.log.push(`使用 ${p.def.name}，+${san} 理智。`) }
    if (armor) { this.addArmor(armor); this.log.push(`使用 ${p.def.name}，+${armor} 护甲。`) }
    this.removeHandAt(idx)
    this.selectedHand = null
    this.selectedBackpackUid = null
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
    this.removeHandAt(idx)
    this.selectedHand = null
    this.selectedBackpackUid = null
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
      if (this.selectedHand === idx) { this.selectedHand = null; this.selectedBackpackUid = null }
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
    const it = this.activeItemTarget
    if (!it) { this.itemTargetMode = null; this.bus.emit('change'); return }
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
    this.removeHandAt(idx)
    this.itemTargetMode = null
    if (this.selectedHand === idx) { this.selectedHand = null; this.selectedBackpackUid = null }
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
    this.removeHandAt(idx)
    if (this.selectedHand === idx) { this.selectedHand = null; this.selectedBackpackUid = null }
    this.log.push(`丢弃 ${item.def.name}。`)
    if (item.def.atk !== undefined) this._runResolution('weapon:discarded', [], { weapon: item, source: 'backpack' })
    this.bus.emit('change')
    this._save()
  }

  // ---------- 行动：丢弃装备栏武器 ----------
  discardEquip(slotIdx) {
    if (this.gameOver) return
    const w = this.equip[slotIdx]
    if (!w) return
    this.equipment.removeAt(slotIdx)
    this.armedSlot = null
    this.log.push(`丢弃 ${w.def.name}。`)
    this._runResolution('weapon:discarded', [], { weapon: w, source: 'equipment' })
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
    else { const e = ENVIRONMENTS[randomInt(ENVIRONMENTS.length)]; mod = { ...e.mod }; label = e.name }
    this._pendingNextMod = { ...mod, label }
    // 商店每 SHOP_EVERY 层出现一次（离开第 3 / 6 层时），其余层只有三选一奖励
    const hasShop = this.floor % SHOP_EVERY === 0
    this.rest = {
      step: 'reward',                                  // reward → shop（有商店）/ done
      rewards: buildRewardChoices(this.floor, {
        count: Math.max(1, Math.floor(this.modifyByRelics('reward:choiceCount', 3, { floor: this.floor }))),
        relicDefs: RELIC_DEFS,
        collected: this.relicCollection,
      }),
      hasShop,
      stock: hasShop ? buildShopStock(this.floor, { relicDefs: RELIC_DEFS, collected: this.relicCollection }) : null,
      mode: null,                                      // 'repair' | 'sell' | null
      pending: null,                                    // 待确认操作
      envName: label,
      routeName: card.def.route ? ROUTES[card.def.route].name : null,
    }
    this.armedSlot = null
    this.selectedHand = null
    this.selectedBackpackUid = null
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
      this.log.push(`行囊没有足够空间，${rw.def.name} 无法领取，请换一项或跳过。`)
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
  // 该奖励当前是否可选择：行囊有适合形状的空位即可领取；放不下时——
  // 药水直接使用、buff 直接绑定下次攻击、武器直接装入可容纳其握持类型的双手装备栏、道具需选目标武器禁选
  canChooseReward(rw) {
    if (!rw) return false
    if (rw.kind === 'relic') return !this.relics.has(rw.def.id)
    if (this.canStore(rw.def)) return true
    if (rw.kind === 'weapon') return this.equipment.firstAvailableHand(rw.def) >= 0
    if (rw.kind === 'item') return false
    return true
  }
  _grantReward(rw) {
    if (rw.kind === 'relic') {
      this.acquireRelic(rw.def.id, { source: '层间奖励' })
      return
    }
    if (this.canStore(rw.def)) {
      this.addToHand(this._mkInst(rw.def))
      this.log.push(`层间奖励：获得 ${rw.def.name}（行囊 ${this.inventory.usedCells}/${this.inventory.capacity} 格）。`)
      return
    }
    // 行囊放不下：直接使用 / 装备
    if (rw.kind === 'weapon') {
      const slot = this.equipment.firstAvailableHand(rw.def)
      const inst = this._mkInst(rw.def)
      this.equipment.equip(inst, slot)
      this.log.push(`层间奖励：行囊放不下，${rw.def.name} 直接装备（${rw.def.grip === GRIP.TWO ? '双手' : `第${slot + 1}只手`}）。`)
    } else if (rw.kind === 'potion') {
      const def = rw.def
      const hp = def.healHp || 0, san = def.healSan || 0, armor = def.armor || 0
      if (hp) { this.player.hp = Math.min(this.player.maxHp, this.player.hp + hp); this.log.push(`层间奖励：行囊放不下，直接使用 ${def.name}，+${hp} 生命。`) }
      if (san) { this.player.san = Math.min(this.player.maxSan, this.player.san + san); this.log.push(`层间奖励：行囊放不下，直接使用 ${def.name}，+${san} 理智。`) }
      if (armor) { this.addArmor(armor); this.log.push(`层间奖励：行囊放不下，直接使用 ${def.name}，+${armor} 护甲。`) }
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
      this.log.push(`层间奖励：行囊放不下，${rw.def.name} 直接绑定下次攻击。`)
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
    this.selectedBackpackUid = null
    this.armedSlot = null
    if (r.mode) this.log.push(r.mode === 'repair' ? '选择要修理的武器（点击装备栏或行囊中的武器）。' : '选择要出售的牌（点击装备栏或行囊）。')
    this.bus.emit('change')
  }
  // 出售价：买入价的 5 折（核心机制.md §12）
  sellPrice(inst) {
    if (!inst || !inst.def) return 0
    return Math.max(1, Math.floor(priceOf(inst.def) * 0.5))
  }
  findInst(instUid) {
    for (const e of this.equipment.items) if (e && e.uid === instUid) return e
    for (const h of this.hand) if (h && h.uid === instUid) return h
    return null
  }
  // 点击装备栏/行囊里的牌 → 生成待确认操作
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
    if (entry.type !== 'relic' && !this.canStore(entry.def)) { this.log.push('行囊没有足够空间，无法购买。'); this.bus.emit('change'); return }
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
      if (entry.type !== 'relic' && !this.canStore(entry.def)) { this.log.push('行囊没有足够空间，无法购买。'); this.bus.emit('change'); return }
      this.player.gold -= entry.price
      entry.sold = true
      if (entry.type === 'relic') {
        this.acquireRelic(entry.def.id, { source: '商店购买' })
      } else {
        this.addToHand(this._mkInst(entry.def))
        this.log.push(`购买 ${entry.def.name}（花费 ${entry.price} 金）。`)
      }
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
    const inst = this.equipment.findByUid(instUid)
    if (inst) {
      const price = this.sellPrice(inst)
      this.equipment.removeByUid(instUid)
      this.armedSlot = null
      this.player.gold += price
      this.log.push(`出售 ${inst.def.name}，获得 ${price} 金。`)
      return
    }
    const idx = this.hand.findIndex(h => h && h.uid === instUid)
    if (idx < 0) return
    const handInst = this.hand[idx]
    const price = this.sellPrice(handInst)
    this.removeHandAt(idx)
    if (this.selectedHand === idx) { this.selectedHand = null; this.selectedBackpackUid = null }
    this.player.gold += price
    this.log.push(`出售 ${handInst.def.name}，获得 ${price} 金。`)
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
    this.selectedBackpackUid = null
    this.buffUsedThisTurn = false
    // 层开始：全员武器 +1 耐久（破损→1）；理智恢复改在层结束（进入层间修整时）结算
    for (const w of [...this.equipment.items, ...this.hand]) {
      if (w && w.curDur !== undefined) { if (w.curDur <= 0) w.curDur = 1; else w.curDur = Math.min(w.maxDur, w.curDur + 1) }
    }
    this.player.keys = 0
    this.player.keysNeeded = cfg.keys
    this._buildBoard(this.floor)
    this.log.push(`进入第 ${this.floor} 层。${this._mod.label ? '环境：' + this._mod.label + '。' : ''}需收集 ${this.player.keysNeeded} 个钥匙碎片。武器耐久 +1。`)
    this._runResolution('floor:start', [], { floor: this.floor, mod: this._mod, cfg })
    this.bus.emit('floor:start', { floor: this.floor, mod: this._mod, cfg })
    this.bus.emit('change')
    this._save()
  }

  // ---------- 怪物威胁 ----------
  _monsterAttackAll(excludeUid = null) {
    if (this._stealthTurns > 0) {
      this.log.push(`藏匿生效：敌人本回合无法攻击（剩余 ${this._stealthTurns - 1} 回合）。`)
      this._stealthTurns--
      return
    }
    const excluded = excludeUid instanceof Set ? excludeUid : new Set(excludeUid == null ? [] : [excludeUid])
    const mons = this.monstersOnBoard().filter(m => !excluded.has(m.uid))
    this._runResolution('monster:retaliation', mons.map((m) => ({
      id: `monster:attack:${m.uid}`,
      phase: RESOLUTION_PHASES.RETALIATION,
      apply: () => {
        // A previous monster attack or a triggered effect may have removed a
        // monster before its queued slot is reached. A dead/removed monster
        // must not get a late attack in the same threat phase, and a lethal
        // attack ends the phase immediately.
        if (this.gameOver || this.player.hp <= 0 || !this.isHostileMonster(m) || m.monsterHp <= 0 || this.isMonsterCombatDisabled(m)) return
        const target = this.selectCombatTarget(m)
        let dmg = this.monsterAttackValue(m)
        if (this.thorns) { dmg = Math.max(0, dmg - this.thorns); this.thorns = 0 }
        if (target) {
          const taken = this.dealCardDamage(target, dmg, {
            source: 'monster-attack', channel: 'damage:ally', attacker: m, minDamage: 1,
          })
          if (target.monsterHp <= 0 && !target.dead) this.destroyCard(target, { source: 'monster-attack', attacker: m })
          this.log.push(`${m.def.name} 攻击${target.def.name}，造成 ${taken.dealt} 点伤害。`)
          return
        }
        const taken = this.receiveDamage(dmg, { source: 'monster-attack', attacker: m, minDamage: 1 })
        const sanLoss = this.spendSanity(1, { source: 'monster-attack' })
        if (sanLoss) this.log.push(`${m.def.name} 攻击你，-${taken.healthDamage} 生命（护甲吸收 ${taken.absorbed}），-${sanLoss} 理智。`)
        else this.log.push(`${m.def.name} 攻击你，-${taken.healthDamage} 生命（护甲吸收 ${taken.absorbed}）。`)
        this.monsterSkills.trigger(m, 'attack:after', {
          damage: taken.healthDamage, target: 'player', source: 'monster-attack',
        })
      },
    })))
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
      activeSkillRuntime: inst.activeSkillRuntime ? { ...inst.activeSkillRuntime } : null,
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
      activeSkillRuntime: o.activeSkillRuntime ? { ...o.activeSkillRuntime } : null,
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
      rewards: o.rewards ? o.rewards.map(rw => ({ kind: rw.kind, amount: rw.amount, def: rw.defId ? (rw.kind === 'relic' ? getRelicDef(rw.defId) : (DEFS_BY_ID[rw.defId]?.def || null)) : null })).filter(rw => rw.def) : null,
      stock: o.stock ? o.stock.map(e => {
        const def = e.type === 'relic' ? getRelicDef(e.defId) : DEFS_BY_ID[e.defId]?.def
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
        backpack: this.inventory.serialize((item) => this._serInst(item)),
        equip: this.equipment.serialize((e) => this._serInst(e)),
        armedSlot: this.armedSlot, selectedHand: this.selectedHand, activeSkillId: this.activeSkillId,
        stealthTurns: this._stealthTurns,
        pendingBuff: this.pendingBuff, pendingBuffName: this.pendingBuffName, thorns: this.thorns,
        emotion: this.emotion,
        mod: this._mod, pendingNextMod: this._pendingNextMod,
        rest: this._serRest(),
        relics: this.relics.serialize(),
        initialRelicChoices: this.initialRelicChoices.map((def) => def.id),
        board: this.board.map(c => ({
          uid: c.uid, type: c.type, c: c.c, r: c.r, flipped: c.flipped, pollut: c.pollut,
          dead: c.dead, monsterHp: c.monsterHp, bossWeakType: c.bossWeakType, _slowTurns: c._slowTurns,
          triggered: !!c.triggered, picked: !!c.picked, taken: !!c.taken,
          statuses: this.cardStatuses(c)?.serialize() || [], peeked: !!c.peeked,
          skillState: c.skillState ? { ...c.skillState } : {},
          faction: c.faction, entityKind: c.entityKind, summoned: !!c.summoned, ai: c.ai,
          summonTurns: c.summonTurns, maxMonsterHp: c.maxMonsterHp,
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
      this.player = { armor: 0, ...d.player }
      if (d.backpack) this.inventory.restore(d.backpack, (item) => this._deserInst(item))
      else this.inventory.replace((d.hand || []).map((item) => this._deserInst(item)).filter(Boolean))
      if (d.equip && !Array.isArray(d.equip)) this.equipment.restore(d.equip, (e) => this._deserInst(e))
      else this.equip = (d.equip || []).map(e => this._deserInst(e))
      this.armedSlot = d.armedSlot; this.selectedHand = d.selectedHand
      this.activeSkillId = d.activeSkillId || null; this._stealthTurns = Math.max(0, Number(d.stealthTurns) || 0)
      this.pendingBuff = d.pendingBuff; this.pendingBuffName = d.pendingBuffName || null; this.thorns = d.thorns || 0
      this.emotion = d.emotion || null
      this._mod = d.mod || { label: '' }; this._pendingNextMod = d.pendingNextMod || null
      this._sanCostExtra = this._mod.sanCostBonus || 0
      this.rest = this._deserRest(d.rest)
      this.relics.restore(d.relics || {})
      this.relicEngine.sync()
      this._syncActiveSkillSelection()
      this.initialRelicChoices = (d.initialRelicChoices || [])
        .map((id) => RELIC_DEFS.find((def) => def.id === id))
        .filter(Boolean)
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
          triggered: !!sc.triggered, picked: !!sc.picked, taken: !!sc.taken, _burnTurns: 0,
          statuses: new StatusStore(sc.statuses || []), peeked: !!sc.peeked,
          skills: Array.isArray(def.skills) ? [...def.skills] : [], skillState: sc.skillState || {},
          faction: sc.faction || (sc.type === T.MONSTER ? 'enemy' : 'neutral'),
          entityKind: sc.entityKind || (sc.type === T.MONSTER ? 'monster' : 'card'),
          summoned: !!sc.summoned, ai: sc.ai || null, summonTurns: sc.summonTurns ?? null,
          maxMonsterHp: sc.maxMonsterHp ?? (sc.type === T.MONSTER ? def.hp : null),
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
