import { createEmitter } from './core/emitter.js'
import { chebyshev, combatDistance, manhattan, neighbors8 } from './core/geometry.js'
import { TURN_KINDS, TurnLedger } from './core/turns.js'
import { attributeLabel } from './data/attributes.js'
import { createGoldEntity, createLootEntity, createMinion, createRelicEntity, getItemDefinition, makeItemById, makeRelicItem, randomWeapon, starterWeapon, synchronizeEntityIds } from './data/content.js'
import { enemyBehaviorLabel, enemyFeatureLabel } from './data/enemy-features.js'
import { getMerchantDefinition, merchantSellPrice, refreshMerchantSlot, refreshMerchantStock } from './data/merchants.js'
import { buildRelicChoices, getRelicDefinition } from './data/relics.js'
import { buildRoomRewardChoices } from './data/rewards.js'
import { FIXED_GROWTH, PROGRESSION, buildLevelUpChoices, experienceToNextLevel, getLevelUpOption, hasTalent, talentGraphState, unlockableTalents } from './data/progression.js'
import { getTrapDefinition } from './data/traps.js'
import { createLinearDungeon, Dungeon } from './model/dungeon.js'
import { BackpackGrid } from './model/backpack.js'
import { RelicCollection } from './model/relics.js'
import { attackAttributeModifier, computeAttackDamage } from './rules/modifiers.js'
import { RelicEngine } from './rules/relics.js'
import { stepEnemy } from './rules/enemies.js'
import { findAttackPath, findDoorPath, findInteractionPath, findPath, findRevealPath } from './rules/pathfinding.js'
import { terrainDamageModifiers } from './rules/terrain.js'

// The design notation is rows × columns: five rows, nine columns.
export const INVENTORY_COLUMNS = 9
export const INVENTORY_ROWS = 5
export const INVENTORY_CAPACITY = INVENTORY_COLUMNS * INVENTORY_ROWS
export const RELIC_SOFT_LIMIT = 5
export const ENERGY_MAX = 10
export const SAVE_KEY = 'grid_flip_adventure_v2'
// This release stores relics as one-cell backpack items. Old saves are intentionally discarded.
export const SAVE_VERSION = 21

function clone(value) { return JSON.parse(JSON.stringify(value)) }

function shuffled(values, random) {
  const copy = [...values]
  for (let index = copy.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

const DETAIL_LABELS = Object.freeze({
  weapon: '\u6b66\u5668',
  potion: '\u836f\u5242',
  armor: '\u62a4\u7532',
  buff: '\u589e\u76ca',
  relic: '\u5723\u9057\u7269',
  enemy: '\u654c\u4eba',
  trap: '\u9677\u9631',
  resource: '\u8d44\u6e90',
  key: '\u5f00\u95e8\u673a\u5173',
  merchant: '\u5546\u4eba',
  attack: '\u653b\u51fb',
  range: '\u5c04\u7a0b',
  weaponClass: '\u7c7b\u522b',
  health: '\u751f\u547d',
  energy: '\u4f53\u529b',
  armorValue: '\u62a4\u7532',
  nextAttack: '\u4e0b\u6b21\u653b\u51fb',
  attribute: '\u5c5e\u6027',
  actionDelay: '\u884c\u52a8\u5ef6\u8fdf',
  cooldown: '\u51b7\u5374',
  normalAttack: '\u666e\u901a\u653b\u51fb',
  normalAttackCooldown: '\u666e\u653b\u51b7\u5374',
  behavior: '\u884c\u4e3a',
  features: '\u7279\u6027',
  explosion: '\u89e6\u53d1\u540e\u5bf9\u516b\u90bb\u57df\u9020\u6210\u4f24\u5bb3\u3002',
  alarm: '\u89e6\u53d1\u540e\u7ffb\u5f00\u9644\u8fd1\u7684\u724c\u3002',
  keyHint: '\u62fe\u53d6\u540e\u4f1a\u6c38\u4e45\u5f00\u542f\u5bf9\u5e94\u7684\u623f\u95f4\u95e8\u3002',
})

const WEAPON_CLASS_LABELS = Object.freeze({
  sword: '\u5251', axe: '\u65a7', dagger: '\u5315\u9996', polearm: '\u957f\u67c4', heavy: '\u91cd\u6b66\u5668', bow: '\u5f13',
})

function weaponClassLabel(value) { return WEAPON_CLASS_LABELS[value] || value || '\u6b66\u5668' }

function weaponAttackRange(weapon, player = null) {
  const base = Math.max(1, Number(weapon?.range) || 1)
  return base + (weapon?.weaponClass === 'bow' && hasTalent(player, 'bow-range') ? 1 : 0)
}

function weaponEnergyCost(weapon) {
  const fallback = { dagger: 2, sword: 3, axe: 4, polearm: 4, bow: 4, heavy: 5 }[weapon?.weaponClass] || 3
  return Math.max(2, Math.min(5, Math.floor(Number(weapon?.energyCost) || fallback)))
}

function energyAfterMovement(player, steps = 0) {
  const current = Math.max(0, Number(player?.energy) || 0)
  const maximum = Math.max(current, Number(player?.maxEnergy) || current)
  const movement = Math.max(0, Math.floor(Number(steps) || 0))
  return Math.min(maximum, current + movement)
}

function normalizedCounter(value) { return Math.max(0, Number(value) || 0) }

function cooldownWaitTurns(interval) { return Math.max(0, normalizedCounter(interval) - 1) }

function normalizedCooldownInterval(value) { return Math.max(1, normalizedCounter(value)) }

function cooldownStatus(remaining, interval) {
  const current = normalizedCounter(remaining)
  const label = `${normalizedCooldownInterval(interval)}\u56de\u5408`
  return current > 0 ? `${label} \u00b7 \u5269\u4f59 ${current} \u56de\u5408` : `${label} \u00b7 \u5c31\u7eea`
}

function damageReductionLog({ healthDamage = 0, absorbed = 0 } = {}) {
  const health = Math.max(0, Number(healthDamage) || 0)
  const armor = Math.max(0, Number(absorbed) || 0)
  if (health === 0) return `\u51cf${armor}\u7532`
  return armor > 0 ? `\u51cf${health}\u8840\uff0c\u51cf${armor}\u7532` : `\u51cf${health}\u8840`
}

function playerDeathCause(context = {}) {
  const source = context.source || ''
  const enemyName = context.enemy?.name
  if (source === 'enemy:small-explosion') return enemyName ? `${enemyName}\u7684\u5c0f\u81ea\u7206` : '\u5c0f\u81ea\u7206'
  if (source === 'enemy:large-explosion') return enemyName ? `${enemyName}\u7684\u5927\u81ea\u7206` : '\u5927\u81ea\u7206'
  if (source === 'enemy:attack') return enemyName ? `${enemyName}\u7684\u653b\u51fb` : '\u654c\u4eba\u653b\u51fb'
  if (source === 'trap:explosion') return '\u9677\u9631\u7206\u70b8'
  if (source === 'trap:poison-fog') return '\u6bd2\u96fe'
  if (source === 'enemy:burning') return enemyName ? `${enemyName}\u7684\u71c3\u70e7` : '\u71c3\u70e7'
  return '\u672a\u77e5\u4f24\u5bb3'
}

const MERCHANT_SERVICE_LABELS = Object.freeze({
  stock: '\u8d2d\u4e70\u5546\u54c1',
  sell: '\u51fa\u552e\u7269\u54c1',
  'relic-choice': '\u83b7\u53d6\u5723\u9057\u7269',
})

function detailForItem(item, player = null) {
  const type = DETAIL_LABELS[item?.type] || '\u7269\u54c1'
  const lines = []
  const badges = item?.type === 'weapon' && item.attribute ? [attributeLabel(item.attribute)] : []
  if (item?.type === 'weapon') {
    lines.push(`${DETAIL_LABELS.attack} ${item.attack || 0}`)
    lines.push(`${DETAIL_LABELS.range} ${weaponAttackRange(item, player)}`)
    lines.push(`\u4f53\u529b\u6d88\u8017 ${weaponEnergyCost(item)}`)
    lines.push(`${DETAIL_LABELS.weaponClass}\uff1a${weaponClassLabel(item.weaponClass)}`)
  } else if (item?.type === 'potion') {
    lines.push(`${DETAIL_LABELS.health} +${item.heal || 0}`)
  } else if (item?.type === 'armor') {
    lines.push(`${DETAIL_LABELS.armorValue} +${item.armor || 0}`)
  } else if (item?.type === 'energy') {
    lines.push(`${DETAIL_LABELS.energy} +${item.energy || 0}`)
  } else if (item?.type === 'buff') {
    const target = item.attackTarget === 'melee' ? '\u4e0b\u6b21\u8fd1\u6218\u653b\u51fb' : DETAIL_LABELS.nextAttack
    lines.push(`${target} +${item.attackBonus || 0}`)
  }
  const description = item?.type === 'relic' ? item.description || '' : ''
  return { title: item?.name || type, type, icon: item?.type || 'item', badges, lines, description }
}

export class GameRun {
  constructor({ autoLoad = true, random = Math.random } = {}) {
    this.bus = createEmitter()
    this.on = this.bus.on
    this.off = this.bus.off
    this.turns = new TurnLedger()
    this._logRevealAnchor = null
    this.merchantEntering = false
    this.roomEntering = false
    this.moveCompleteUnsubscribe = this.on('animate:move-complete', () => {
      if (!this.merchantEntering && !this.roomEntering) return
      this.merchantEntering = false
      this.roomEntering = false
      this._changed()
    })
    this.random = random
    this._loaded = autoLoad && this.load()
    if (!this._loaded) this.reset({ emit: false })
  }

  get currentRoom() { return this.dungeon?.room(this.player?.roomId) || null }
  get attackCount() { return this.turns.attackCount }
  get globalTurn() { return this.turns.globalTurn }
  get turn() { return this.globalTurn }
  set turn(value) { this.turns.setGlobalTurn(value) }
  get backpackWeapons() { return this.backpack?.items.filter((item) => item?.type === 'weapon') || [] }
  get selectedItem() {
    return Number.isInteger(this.selectedInventoryIndex)
      ? this.backpack.placementForCellIndex(this.selectedInventoryIndex)?.item || null
      : null
  }

  reset({ emit = true } = {}) {
    const generated = createLinearDungeon({ random: this.random })
    this.dungeon = generated.dungeon
    this.player = {
      hp: 20,
      maxHp: 20,
      armor: 0,
      energy: ENERGY_MAX,
      maxEnergy: ENERGY_MAX,
      gold: 0,
      roomId: generated.startRoomId,
      pos: { ...generated.start },
      level: PROGRESSION.startingLevel,
      experience: 0,
      experienceToNext: experienceToNextLevel(PROGRESSION.startingLevel),
      talents: [],
      talentRuntime: { pending: [], bowFirst: {}, drownDelay: {}, roomLastStandUsed: false, bodyStrength: 0 },
      pendingAttackBonus: 0,
      pendingAttackBuffs: [],
      parry: null,
      poisonedTurns: 0,
      poisonDamage: 0,
      burningTurns: 0,
      burningDamage: 0,
    }
    this.backpack = new BackpackGrid(INVENTORY_COLUMNS, INVENTORY_ROWS)
    const starter = starterWeapon()
    if (!this.backpack.add(starter)) throw new Error('Unable to add starter weapon to backpack')
    this.relics = new RelicCollection()
    this.relicEngine = new RelicEngine(this.relics)
    this.initialRelicChoices = buildRelicChoices(this.relics, { random: this.random }).map((relic) => relic.id)
    this.turns = new TurnLedger()
    this.phase = 'explore'
    this.gameOver = false
    this.win = false
    this.selectedInventoryIndex = null
    this.itemTargeting = false
    this.merchant = null
    this.merchantEntering = false
    this.roomEntering = false
    this.roomReward = null
    this.roomRewardBag = shuffled(['supply', 'supply', 'supply', 'relic'], this.random)
    this.levelUp = null
    this.relicEventQueue = []
    this.relicRuntime = {}
    this.detailPanel = null
    this.deathLogEntry = null
    this._logRevealAnchor = null
    this._logSequence = 0
    this.log = []
    this._log('\u8fdb\u5165\u7b2c 1 \u5c42\u7684\u7b2c 1 \u4e2a\u623f\u95f4\u3002')
    this._log(`\u521d\u59cb\u7269\u54c1\uff1a${starter.name}\u3002`)
    this._persist()
    if (emit) this.bus.emit('change')
  }

  roomLabel(room = this.currentRoom) {
    if (!room) return ''
    const index = this.dungeon.roomOrder.indexOf(room.id) + 1
    return `F${room.floor} / R${index}`
  }

  entityAt(position) { return this.currentRoom?.entityAt(position) || null }
  doorEdge(door) { return door ? this.dungeon.edgeForDoor(door.id) : null }
  isExitDoor(door) { return !!door && this.doorEdge(door)?.fromDoor.id === door.id }
  isDoorRevealed(door) { return !!door && (!this.isExitDoor(door) || door.discovered === true) }
  isDoorLocked(door) { return !!this.doorEdge(door)?.locked && !this.doorEdge(door)?.unlocked }
  activeRelics() { return this.relicEngine.activeDefinitions({ run: this }) }

  hasActiveRelic(id) { return this.activeRelics().some((relic) => relic.id === id) }

  relicCount() { return this.backpack?.items.filter((item) => item?.type === 'relic').length || 0 }
  relicOverload() { return Math.max(0, this.relicCount() - RELIC_SOFT_LIMIT) }
  canFitRelic(id) { return !!getRelicDefinition(id) && this.backpack.usedCells < this.backpack.capacity }

  weaponRange(weapon) { return weaponAttackRange(weapon, this.player) }
  weaponEnergyCost(weapon) { return weaponEnergyCost(weapon) }

  _recoverEnergy(amount = 0) {
    const recovery = Math.max(0, Math.floor(Number(amount) || 0))
    this.player.energy = Math.min(this.player.maxEnergy, Math.max(0, Number(this.player.energy) || 0) + recovery)
    return this.player.energy
  }

  _spendEnergy(amount = 0) {
    const cost = Math.max(0, Math.floor(Number(amount) || 0))
    if ((Number(this.player.energy) || 0) < cost) return false
    this.player.energy -= cost
    return true
  }

  hasTalent(id) { return hasTalent(this.player, id) }

  _talentRuntime() {
    if (!this.player.talentRuntime || typeof this.player.talentRuntime !== 'object') this.player.talentRuntime = {}
    const state = this.player.talentRuntime
    if (!Array.isArray(state.pending)) state.pending = []
    if (!state.bowFirst || typeof state.bowFirst !== 'object') state.bowFirst = {}
    if (!state.drownDelay || typeof state.drownDelay !== 'object') state.drownDelay = {}
    state.bodyStrength = Math.max(0, Math.floor(Number(state.bodyStrength) || 0))
    return state
  }

  _queueTalentBuff(buff) {
    if (!buff || !Number.isFinite(buff.amount) || buff.amount === 0) return false
    this._talentRuntime().pending.push({ ...buff, amount: Math.floor(buff.amount) })
    return true
  }

  _queueTalentFlag(flag) {
    if (!flag || typeof flag !== 'object') return false
    this._talentRuntime().pending.push({ ...flag })
    return true
  }

  _consumeTalentBuffs(weapon, enemy) {
    const state = this._talentRuntime()
    const matching = state.pending.filter((buff) => {
      if (!Number.isFinite(buff.amount)) return false
      if (buff.weaponClass && buff.weaponClass !== weapon?.weaponClass) return false
      if (buff.attribute && buff.attribute !== weapon?.attribute) return false
      if (buff.targetId && buff.targetId !== enemy?.id) return false
      return true
    })
    state.pending = state.pending.filter((buff) => !matching.includes(buff))
    return matching
  }

  remainingEnemies(room = this.currentRoom) {
    return room ? [...room.entities.values()].filter((entity) => entity.kind === 'enemy').length : 0
  }

  _roomRuntime(room = this.currentRoom) {
    const key = room?.id
    if (!key) return {}
    if (!this.relicRuntime.__rooms || typeof this.relicRuntime.__rooms !== 'object') this.relicRuntime.__rooms = {}
    if (!this.relicRuntime.__rooms[key] || typeof this.relicRuntime.__rooms[key] !== 'object') this.relicRuntime.__rooms[key] = {}
    return this.relicRuntime.__rooms[key]
  }

  _relicRoomRuntime(id, room = this.currentRoom) {
    const key = room?.id
    if (!key) return {}
    if (!this.relicRuntime[id] || typeof this.relicRuntime[id] !== 'object') this.relicRuntime[id] = {}
    if (!this.relicRuntime[id].rooms || typeof this.relicRuntime[id].rooms !== 'object') this.relicRuntime[id].rooms = {}
    if (!this.relicRuntime[id].rooms[key] || typeof this.relicRuntime[id].rooms[key] !== 'object') this.relicRuntime[id].rooms[key] = {}
    return this.relicRuntime[id].rooms[key]
  }

  countFlippableCards(room = this.currentRoom) {
    if (!room) return 0
    const revealDistance = this.hasActiveRelic('r-long-flip') ? 2 : 1
    let count = 0
    for (let r = 0; r < room.height; r++) {
      for (let c = 0; c < room.width; c++) {
        const position = { c, r }
        if (!room.isRevealed(position) && findRevealPath(room, this.player.pos, position, { distance: revealDistance })) count += 1
      }
    }
    return count
  }

  _revealEnemy(room, enemy, { cause = 'system', animate = true, triggerAlert = true } = {}) {
    if (!room || !enemy || room.isRevealed(enemy.pos)) return false
    const wasFlippable = room.id === this.currentRoom?.id && this.tileCanBeFlipped(enemy.pos)
    room.reveal(enemy.pos)
    if (animate && room.id === this.currentRoom?.id) {
      this.bus.emit('animate:flip', { roomId: room.id, position: { ...enemy.pos }, backUnflippable: !wasFlippable })
    }
    this._emitRelicEvent('card:revealed', { room, position: enemy.pos, cause })
    this._emitRelicEvent('enemy:revealed', { enemy, room, cause })
    if (triggerAlert) this._triggerEnemyAlert(room, enemy)
    return true
  }

  _triggerEnemyAlert(room, enemy) {
    if (!room || enemy?.kind !== 'enemy' || !enemy.traits?.includes('alert') || enemy.alertTriggered) return null
    enemy.alertTriggered = true
    const target = [...room.entities.values()]
      .filter((entity) => entity.kind === 'enemy' && entity.id !== enemy.id && !entity.downed && !room.isRevealed(entity.pos))
      .sort((left, right) => (
        manhattan(enemy.pos, left.pos) - manhattan(enemy.pos, right.pos)
        || left.pos.r - right.pos.r
        || left.pos.c - right.pos.c
        || String(left.id).localeCompare(String(right.id))
      ))[0]
    if (!target) return null
    this._log(`${enemy.name}\u53d1\u51fa\u8b66\u62a5\uff0c\u5524\u9192\u4e86 ${target.name}\u3002`)
    this._revealEnemy(room, target, { cause: 'enemy:alert', triggerAlert: false })
    return target
  }

  _animateEnemyRevealBatch(room, flips) {
    if (!room || !Array.isArray(flips) || flips.length === 0) return
    this.bus.emit('animate:flip-batch', {
      roomId: room.id,
      flips: flips.map((flip) => ({ position: { ...flip.position }, backUnflippable: !!flip.backUnflippable })),
    })
  }

  _addRandomWeaponToBackpack() {
    const weapon = randomWeapon(this.currentRoom?.floor || 1, this.random)
    if (!weapon || !this.backpack.canFit(weapon)) return false
    this._putInInventory(weapon)
    this._log(`\u88c5\u5907\u81ea\u52a8\u5165\u5305\uff1a${weapon.name}\u3002`)
    return true
  }

  _splashEnemies(center, damage, { source = 'relic:splash' } = {}) {
    const room = this.currentRoom
    if (!room || !center) return 0
    let hits = 0
    for (const position of neighbors8(center, room.width, room.height)) {
      const enemy = room.entityAt(position)
      if (enemy?.kind !== 'enemy' || !room.isRevealed(position)) continue
      this._damageEnemy(enemy, damage, { source })
      hits += 1
    }
    return hits
  }

  _deathExplosion(center, damage = 2) {
    const room = this.currentRoom
    if (!room || !center) return 0
    let hits = 0
    for (const position of neighbors8(center, room.width, room.height)) {
      if (!room.isRevealed(position)) this._revealTile(position, { cause: 'relic:death-explosion' })
      const enemy = room.entityAt(position)
      if (enemy?.kind !== 'enemy') continue
      this._damageEnemy(enemy, damage, { source: 'relic:death-explosion' })
      hits += 1
    }
    return hits
  }

  _ricochetBehind(enemy, damage) {
    const room = this.currentRoom
    if (!room || !enemy?.pos || damage <= 0) return false
    const directionC = Math.sign(enemy.pos.c - this.player.pos.c)
    const directionR = Math.sign(enemy.pos.r - this.player.pos.r)
    if (directionC === 0 && directionR === 0) return false
    let affected = false
    for (const distance of [1]) {
      const destination = {
        c: enemy.pos.c + directionC * distance,
        r: enemy.pos.r + directionR * distance,
      }
      if (!room.contains(destination)) continue
      const wasHidden = !room.isRevealed(destination)
      if (wasHidden) this._revealTile(destination, { cause: 'relic:backline-ricochet' })
      const target = room.entityAt(destination)
      if (!wasHidden && target?.kind === 'enemy') this._damageEnemy(target, damage, { source: 'relic:backline-ricochet' })
      if (wasHidden || target?.kind === 'enemy') affected = true
    }
    return affected
  }

  _tryTenthAttackTransmutation(enemy) {
    if (!this.hasActiveRelic('r-tenth-alchemy') || !enemy || !this.currentRoom?.entity(enemy.id)) return false
    if (!this.relicRuntime['r-tenth-alchemy'] || typeof this.relicRuntime['r-tenth-alchemy'] !== 'object') this.relicRuntime['r-tenth-alchemy'] = {}
    const state = this.relicRuntime['r-tenth-alchemy']
    state.attacks = (Math.max(0, Number(state.attacks) || 0) % 10) + 1
    if (state.attacks !== 10) return false
    state.attacks = 0
    const gold = Math.max(0, Math.floor(enemy.hp || 0))
    this.currentRoom.removeEntity(enemy.id)
    if (gold > 0) this.currentRoom.addEntity(createGoldEntity(gold, enemy.pos))
    this._log(`${enemy.name}\u88ab\u70bc\u6210\u4e86 ${gold} \u91d1\u5e01\u3002`)
    return true
  }
  get merchantEntity() { return this.merchant ? this.currentRoom?.entity(this.merchant.entityId) || null : null }
  get merchantDefinition() { return getMerchantDefinition(this.merchantEntity?.merchantId) }

  canSellAtMerchant() { return this.phase === 'merchant' && this.merchantDefinition?.services.includes('sell') }

  _drawRoomRewardType() {
    if (!this.roomRewardBag.length) this.roomRewardBag = shuffled(['supply', 'supply', 'supply', 'relic'], this.random)
    return this.roomRewardBag.shift() || 'supply'
  }

  _queueLevelUp() {
    if (this.levelUp || this.gameOver || this.player.experience < this.player.experienceToNext) return false
    const choices = buildLevelUpChoices(this.player, { count: PROGRESSION.levelChoiceCount, random: this.random })
    this.levelUp = { choices }
    this.phase = 'level-up'
    this._log(`\u5347\u81f3 ${this.player.level + 1} \u7ea7\uff0c\u8bf7\u9009\u62e9\u6210\u957f\u3002`)
    return true
  }

  _gainExperience(enemy) {
    const amount = Math.max(0, Number(enemy?.experience) || 0)
    if (!amount || enemy?.noExperience || enemy?.boss) return false
    this.player.experience += amount
    this._log(`\u83b7\u5f97 ${amount} \u7ecf\u9a8c\u3002`)
    return this._queueLevelUp()
  }

  chooseLevelUpOption(id) {
    if (this.phase !== 'level-up' || !this.levelUp?.choices.includes(id)) return false
    const option = getLevelUpOption(id)
    if (!option) return false
    this._applyLevelUpOption(id)
    return true
  }

  _applyLevelUpOption(id) {
    if (id === FIXED_GROWTH.id) {
      this.player.maxHp += 2
      this._talentRuntime().bodyStrength += 1
    } else {
      const definition = getLevelUpOption(id)
      if (!definition || definition.fixed || this.player.talents.includes(id)) return false
      this.player.talents.push(id)
      const effects = definition.effects || {}
      if (effects.maxHp) this.player.maxHp += Math.floor(effects.maxHp)
      if (effects.heal) this._healPlayer(effects.heal, { source: 'talent:survival-vigor' })
    }
    const option = getLevelUpOption(id)
    if (option) this._log(`\u6210\u957f\u9009\u62e9\uff1a${option.name}\u3002`)
    this._finishLevelUp()
    return true
  }

  _finishLevelUp() {
    this.player.experience = Math.max(0, this.player.experience - this.player.experienceToNext)
    this.player.level += 1
    this.player.experienceToNext = experienceToNextLevel(this.player.level)
    this.levelUp = null
    this.phase = 'explore'
    this._queueLevelUp()
    this._changed()
  }

  levelUpChoices() {
    return (this.levelUp?.choices || []).map((id) => getLevelUpOption(id)).filter(Boolean)
  }

  talentGraph() { return talentGraphState(this.player) }

  unlockableTalents() { return unlockableTalents(this.player) }

  showItemDetail(item) {
    if (!item) return false
    const detail = detailForItem(item, this.player)
    if (item.type === 'weapon') {
      const growth = this.weaponGrowth(item)
      if (growth.talents) detail.lines.push(`\u5929\u8d4b ${growth.talents}`)
    }
    return this._showDetail({ position: 'top', ...detail })
  }

  weaponGrowth(weapon) {
    return { talents: this.player.talents.filter((id) => getLevelUpOption(id)?.line === weapon?.weaponClass).length }
  }

  showRelicDetail(id) {
    const definition = getRelicDefinition(id)
    if (!definition) return false
    return this._showDetail({
      position: 'top',
      title: definition.name,
      type: DETAIL_LABELS.relic,
      icon: 'relic',
      description: definition.description,
      lines: ['\u5360\u7528\u80cc\u5305 1 \u683c\uff0c\u6301\u6709\u65f6\u751f\u6548\u3002'],
    })
  }

  showBoardDetail(position) {
    const room = this.currentRoom
    if (!room?.contains(position) || !room.isRevealed(position)) return false
    if (this.player.pos.c === position.c && this.player.pos.r === position.r) return false
    const entity = room.entityAt(position)
    if (!entity || entity.kind === 'stairs') return false
    if (entity.kind === 'item') return this._showDetail({ position: 'bottom', ...detailForItem(entity.item, this.player) })
    if (entity.kind === 'enemy') {
      const features = enemyFeatureLabel(entity)
      const lines = [
        `${DETAIL_LABELS.health} ${entity.hp}/${entity.maxHp}`,
        `${DETAIL_LABELS.behavior} ${enemyBehaviorLabel(entity.behavior)}`,
        `${DETAIL_LABELS.normalAttack} ${entity.attack} \u00b7 ${DETAIL_LABELS.range} ${entity.range || 1}`,
        `${DETAIL_LABELS.actionDelay} ${normalizedCounter(entity.actionDelay)}`,
        `${DETAIL_LABELS.normalAttackCooldown} ${cooldownStatus(entity.attackCooldown, entity.attackCooldownMax)}`,
      ]
      if (features) lines.push(`${DETAIL_LABELS.features} ${features}`)
      if (entity.burningTurns > 0) lines.push(`\u71c3\u70e7 ${entity.burningTurns} \u4e2a\u5168\u5c40\u56de\u5408 \u00b7 \u6bcf\u56de\u5408 ${entity.burningDamage || 1} \u70b9`)
      if (entity.deathStatus) lines.push(`\u6b7b\u4ea1\u6548\u679c ${entity.deathStatus} ${entity.deathStatusTurns || 0} \u4e2a\u5168\u5c40\u56de\u5408`)
      if (entity.pullDistance > 0) lines.push(`\u7275\u5f15 ${entity.pullDistance} \u683c`)
      if (entity.summonMinionId) lines.push(`\u6bcf ${entity.summonEvery || 0} \u6b21\u81ea\u8eab\u884c\u52a8\u53ec\u5524 ${entity.summonMinionId}\uff0c\u4e0a\u9650 ${entity.summonLimit || 0}`)
      if (entity.deathSpawnMinionId) lines.push(`\u6b7b\u4ea1时生成 ${entity.deathSpawnMinionId} \u00d7 ${entity.deathSpawnCount || 0}`)
      return this._showDetail({
        position: 'bottom',
        title: entity.name,
        type: DETAIL_LABELS.enemy,
        icon: 'enemy',
        badges: [attributeLabel(entity.attribute), features].filter(Boolean),
        lines,
      })
    }
    if (entity.kind === 'trap') {
      const trap = getTrapDefinition(entity.trapId)
      if (!trap) return false
      const effect = trap.description || (trap.effect === 'explosion'
        ? `${DETAIL_LABELS.explosion} ${DETAIL_LABELS.attack} ${trap.damage || 0}`
        : DETAIL_LABELS.alarm)
      const status = entity.triggered ? '\u5df2\u89e6\u53d1\uff0c\u5c06\u5728\u518d\u8fc7\u4e00\u4e2a\u5168\u5c40\u56de\u5408\u8ba1\u6570\u540e\u6d88\u5931\u3002' : ''
      return this._showDetail({ position: 'bottom', title: trap.name, type: DETAIL_LABELS.trap, icon: 'trap', description: [effect, status].filter(Boolean).join(' ') })
    }
    if (entity.kind === 'gold') {
      return this._showDetail({ position: 'bottom', title: '\u91d1\u5e01', type: DETAIL_LABELS.resource, icon: 'gold', lines: [`+${entity.amount || 0} \u91d1\u5e01`] })
    }
    if (entity.kind === 'key') {
      return this._showDetail({ position: 'bottom', title: DETAIL_LABELS.key, type: DETAIL_LABELS.resource, icon: 'key', description: DETAIL_LABELS.keyHint })
    }
    if (entity.kind === 'merchant') {
      const services = (entity.services || []).map((service) => MERCHANT_SERVICE_LABELS[service]).filter(Boolean)
      return this._showDetail({ position: 'bottom', title: entity.name, type: DETAIL_LABELS.merchant, icon: 'merchant', lines: services })
    }
    return false
  }

  closeDetail() {
    if (!this.detailPanel) return false
    this.detailPanel = null
    this.bus.emit('detail')
    return true
  }

  _showDetail(detail) {
    this.detailPanel = { ...detail, badges: [...(detail.badges || [])], lines: [...(detail.lines || [])] }
    this.bus.emit('detail')
    return true
  }

  _emitRelicEvent(event, context = {}) {
    const actions = this.relicEngine.emit(event, { run: this, event, ...context })
    this.relicEventQueue.push(...actions.filter((action) => action && typeof action === 'object'))
    while (this.relicEventQueue.length) {
      const action = this.relicEventQueue.shift()
      if (action.type === 'heal') this._healPlayer(action.amount, { source: action.source || `relic:${event}` })
      if (action.type === 'armor') this.player.armor += Math.max(0, action.amount || 0)
      if (action.type === 'gold') this.player.gold += Math.max(0, Math.floor(action.amount || 0))
      if (action.type === 'energy') this._recoverEnergy(action.amount)
      if (action.type === 'relic:war-spirit:lose') {
        const state = this._relicRoomRuntime('r-war-spirit')
        state.stacks = Math.max(0, (Number(state.stacks) || 0) - 1)
      }
      if (action.type === 'relic:war-spirit:clear') {
        const state = this._relicRoomRuntime('r-war-spirit')
        state.stacks = 0
      }
      if (action.log) this._log(action.log)
    }
  }

  _emitTurnEvent(event, context) {
    this._emitRelicEvent(event, context)
    this.bus.emit(event, context)
  }

  setDebugReveal(reveal) {
    this.debugReveal = reveal === true
    this.bus.emit('change')
  }

  acquireRelic(id, { notify = true } = {}) {
    const definition = getRelicDefinition(id)
    if (!definition) return this._reject('\u672a\u77e5\u5723\u9057\u7269\u3002')
    if (this.relics.has(id)) return this._reject('\u6b64\u5723\u9057\u7269\u5df2\u5728\u80cc\u5305\u4e2d\u3002')
    const item = makeRelicItem(definition)
    if (!item || !this.backpack.add(item)) return this._reject('\u80cc\u5305\u6ca1\u6709\u8db3\u591f\u7a7a\u95f4\u3002')
    const entry = this.relics.acquire(id, { uid: item.uid })
    if (!entry) {
      this.backpack.removeByUid(item.uid)
      return this._reject('\u6b64\u5723\u9057\u7269\u5df2\u5728\u80cc\u5305\u4e2d\u3002')
    }
    this._log(`\u83b7\u5f97 ${definition.name}\u3002`)
    if (notify) this._changed()
    return entry
  }

  chooseInitialRelic(id) {
    if (this.relics.entries.length > 0 || !this.initialRelicChoices.includes(id)) return false
    const entry = this.acquireRelic(id)
    if (entry) {
      this.initialRelicChoices = []
      this._changed()
    }
    return entry
  }

  tileCanBeFlipped(position) {
    const room = this.currentRoom
    const revealDistance = this.hasActiveRelic('r-long-flip') ? 2 : 1
    return !!room && !room.isRevealed(position) && !!findRevealPath(room, this.player.pos, position, { distance: revealDistance })
  }

  previewTileAction(c, r) {
    if (!this._canAct()) return null
    const room = this.currentRoom
    const target = { c, r }
    if (!room?.contains(target)) return null
    if (target.c === this.player.pos.c && target.r === this.player.pos.r && !room.entityAt(target)) return null
    if (!room.isRevealed(target)) {
      const revealDistance = this.hasActiveRelic('r-long-flip') ? 2 : 1
      const route = findRevealPath(room, this.player.pos, target, { distance: revealDistance })
      return route ? this._pathPreview('flip', target, route.path) : null
    }
    const entity = room.entityAt(target)
    if (!entity) {
      const path = findPath(room, this.player.pos, target)
      return path ? this._pathPreview('move', target, path) : null
    }
    if (entity.kind === 'enemy') {
      const selectedWeapon = this.selectedItem
      if (selectedWeapon?.type !== 'weapon') return null
      const route = findAttackPath(room, this.player.pos, entity, [{ ...selectedWeapon, range: weaponAttackRange(selectedWeapon, this.player) }])
      if (!route || energyAfterMovement(this.player, route.path.length) < weaponEnergyCost(selectedWeapon)) return null
      return this._pathPreview('attack', target, route.path)
    }
    if (entity.kind === 'merchant') {
      const route = findInteractionPath(room, this.player.pos, entity)
      return route ? this._pathPreview('merchant', target, route.path) : null
    }
    if (entity.kind === 'trap') return null
    if (entity.kind === 'item' && !this.backpack.canFit(entity.item)) return null
    const path = findPath(room, this.player.pos, target, { allowGoalOccupied: true })
    return path ? this._pathPreview('pickup', target, path) : null
  }

  previewDoorAction(doorId) {
    if (!this._canAct()) return null
    const room = this.currentRoom
    const door = this.dungeon.door(doorId)
    if (!room || !door || door.roomId !== room.id || !this.isDoorRevealed(door) || this.isDoorLocked(door)) return null
    const path = findDoorPath(room, this.player.pos, door)
    if (!path) return null
    return { ...this._pathPreview('door', door.arrival, path), targeted: true, doorId: door.id }
  }

  _pathPreview(kind, target, path) {
    return {
      kind,
      target: { ...target },
      path: path.map((step) => ({ ...step })),
      arrival: { ...(path.at(-1) || this.player.pos) },
      targeted: ['attack', 'flip', 'merchant'].includes(kind),
    }
  }

  selectInventory(index) {
    if (!this._canOrganizeBackpack() || this.itemTargeting) return false
    if (!Number.isInteger(index) || index < 0 || index >= INVENTORY_CAPACITY) return false
    const placement = this.backpack.placementForCellIndex(index)
    if (!placement) return this.clearSelection()
    const origin = this.backpack.originIndex(placement)
    if (this.selectedInventoryIndex === origin && !this.itemTargeting) return this.clearSelection()
    this.selectedInventoryIndex = origin
    this.itemTargeting = false
    this._changed()
    return true
  }

  clearSelection() {
    if (this.selectedInventoryIndex == null && !this.itemTargeting) return false
    this.selectedInventoryIndex = null
    this.itemTargeting = false
    this._changed()
    return true
  }

  moveInventory(itemUid, index) {
    if (!this._canOrganizeBackpack() || this.itemTargeting) return false
    if (!Number.isInteger(index) || index < 0 || index >= INVENTORY_CAPACITY) return false
    const item = this.backpack.placementOf(itemUid)?.item
    if (!item) return false
    const moved = this.backpack.move(item.uid, index % INVENTORY_COLUMNS, Math.floor(index / INVENTORY_COLUMNS))
    if (!moved) return false
    this.selectedInventoryIndex = this.backpack.originIndex(this.backpack.placementOf(item.uid))
    this.itemTargeting = false
    this._changed()
    return true
  }

  moveSelectedInventory(index) {
    const item = this.selectedItem
    return item ? this.moveInventory(item.uid, index) : false
  }

  previewInventoryCellAction(index) {
    if (!this._canOrganizeBackpack() || this.itemTargeting || !Number.isInteger(index) || index < 0 || index >= INVENTORY_CAPACITY) return null
    const selected = this.selectedItem
    if (!selected) return null
    const selectedPlacement = this.backpack.placementOf(selected.uid)
    const targetPlacement = this.backpack.placementForCellIndex(index)
    if (!selectedPlacement) return null
    if (targetPlacement) return targetPlacement.item.uid === selected.uid ? 'cancel' : 'select'
    return this.backpack.canPlace(selected, index % INVENTORY_COLUMNS, Math.floor(index / INVENTORY_COLUMNS), selectedPlacement.rotation, selected.uid)
      ? 'move'
      : 'blocked'
  }

  clickInventoryCell(index) {
    if (!this._canOrganizeBackpack() || this.itemTargeting || !Number.isInteger(index) || index < 0 || index >= INVENTORY_CAPACITY) return false
    const selected = this.selectedItem
    const targetPlacement = this.backpack.placementForCellIndex(index)
    if (!selected) return targetPlacement ? this.selectInventory(index) : false
    if (!targetPlacement) return this.moveInventory(selected.uid, index)
    if (targetPlacement.item.uid === selected.uid) return this.clearSelection()
    return this.selectInventory(index)
  }

  rotateSelectedInventory() {
    const item = this.selectedItem
    if (!this._canOrganizeBackpack() || this.itemTargeting || !item || !this.backpack.rotate(item.uid)) return false
    this.selectedInventoryIndex = this.backpack.originIndex(this.backpack.placementOf(item.uid))
    this._changed()
    return true
  }

  discardSelected() {
    if (this.merchantEntering || this.roomEntering) return false
    const item = this.selectedItem
    if (item) {
      this.backpack.removeByUid(item.uid)
      if (item.type === 'relic') this.relics.remove(item.uid) || this.relics.remove(item.relicId)
      this._log(`\u4e22\u5f03 ${item.name}\u3002`)
      if (item.type === 'weapon' && this.hasActiveRelic('r-scrap-charm')) {
        const state = this._relicRoomRuntime('r-scrap-charm')
        if (!state.triggered) {
          state.triggered = true
          this.player.armor += 5
          this._log('\u5e9f\u94c1\u62a4\u7b26\uff1a\u62a4\u7532 +5\u3002')
        }
      }
      this.selectedInventoryIndex = null
    } else return false
    this.itemTargeting = false
    this._changed()
    return true
  }

  useSelected() {
    const item = this.selectedItem
    if (!item || !this._canAct()) return false
    if (item.type === 'energy') {
      const before = this.player.energy
      this._recoverEnergy(Number(item.energy) || 0)
      const itemRecovered = this.player.energy - before
      const roundRecovered = Math.max(0, Math.min(1, this.player.maxEnergy - this.player.energy))
      const recovered = itemRecovered + roundRecovered
      this.backpack.removeByUid(item.uid)
      this.selectedInventoryIndex = null
      this.itemTargeting = false
      this._log(`\u4f7f\u7528 ${item.name}\uff0c\u6062\u590d ${recovered} \u70b9\u4f53\u529b\u3002`)
      this._endTurn({ turnKind: TURN_KINDS.ACTION })
      this._changed()
      return true
    }
    if (item.type === 'potion') {
      const healed = this._healPlayer(item.heal, { source: 'item:potion', item })
      this.backpack.removeByUid(item.uid)
      this.selectedInventoryIndex = null
      this.itemTargeting = false
      this._log(`\u4f7f\u7528 ${item.name}\uff0c\u6062\u590d ${healed} HP\u3002`)
      this._endTurn({ turnKind: TURN_KINDS.ACTION })
      this._changed()
      return true
    }
    if (item.type === 'armor') {
      this.player.armor += item.armor
      this.backpack.removeByUid(item.uid)
      this.selectedInventoryIndex = null
      this.itemTargeting = false
      this._log(`\u4f7f\u7528 ${item.name}\uff0c\u62a4\u7532 +${item.armor}\u3002`)
      this._endTurn({ turnKind: TURN_KINDS.ACTION })
      this._changed()
      return true
    }
    if (item.type === 'buff') {
      this.player.pendingAttackBuffs.push({ amount: item.attackBonus, target: item.attackTarget || 'any' })
      this.player.pendingAttackBonus = this.player.pendingAttackBuffs.reduce((total, buff) => total + buff.amount, 0)
      this.backpack.removeByUid(item.uid)
      this.selectedInventoryIndex = null
      this.itemTargeting = false
      const target = item.attackTarget === 'melee' ? '\u4e0b\u6b21\u8fd1\u6218\u653b\u51fb' : '\u4e0b\u6b21\u653b\u51fb'
      this._log(`\u4f7f\u7528 ${item.name}\uff0c${target} +${item.attackBonus}\u3002`)
      this._endTurn({ turnKind: TURN_KINDS.ACTION })
      this._changed()
      return true
    }
    return false
  }

  clickTile(c, r) {
    if (!this._canAct()) return false
    const room = this.currentRoom
    const position = { c, r }
    if (!room?.contains(position)) return false
    if (position.c === this.player.pos.c && position.r === this.player.pos.r && !room.entityAt(position)) return false
    if (!room.isRevealed(position)) return this._flipAt(position)
    const entity = room.entityAt(position)
    if (!entity) return this._moveTo(position)
    if (entity.kind === 'enemy') {
      if (!this.selectedItem || this.selectedItem.type !== 'weapon') {
        return this._reject('\u8bf7\u5148\u4ece\u80cc\u5305\u9009\u4e2d\u4e00\u628a\u6b66\u5668\u3002')
      }
      return this._attack(entity)
    }
    if (entity.kind === 'merchant') return this._interactMerchant(entity)
    if (entity.kind === 'trap') return false
    return this._pickUp(entity)
  }

  clickDoor(doorId) {
    if (!this._canAct()) return false
    const door = this.dungeon.door(doorId)
    if (!door || door.roomId !== this.currentRoom?.id || !this.isDoorRevealed(door)) return false
    return this._useDoor(door)
  }

  _interactMerchant(merchant) {
    const route = findInteractionPath(this.currentRoom, this.player.pos, merchant)
    if (!route) return this._reject('\u65e0\u6cd5\u9760\u8fd1\u8fd9\u4f4d\u5546\u4eba\u3002')
    this.merchantEntering = route.path.length > 0
    const movement = this._walk(route.path)
    if (!movement.stopped) this._endTurn({ turnKind: TURN_KINDS.ACTION })
    if (movement.stopped || this.gameOver) this.merchantEntering = false
    if (!movement.stopped && !this.gameOver) {
      this.merchant = { entityId: merchant.id }
      if (this.merchantDefinition?.services.includes('relic-choice') && !merchant.relicOfferResolved) {
        merchant.relicChoices = buildRelicChoices(this.relics, { random: this.random }).map((relic) => relic.id)
      }
      this.phase = 'merchant'
      this.selectedInventoryIndex = null
      this.itemTargeting = false
      this._log(`\u4e0e ${merchant.name} \u4ea4\u8c08\u3002`)
    }
    this._changed()
    return true
  }

  closeMerchant() {
    if (this.phase !== 'merchant') return false
    this.phase = 'explore'
    this.merchant = null
    this._changed()
    return true
  }

  buyMerchantItem(index) {
    const merchant = this.merchantEntity
    const stock = merchant?.stock?.[index]
    const definition = getItemDefinition(stock?.itemId)
    if (this.phase !== 'merchant' || !merchant || !stock || !definition) return false
    if (this.player.gold < stock.price) return this._reject('\u91d1\u5e01\u4e0d\u8db3\u3002')
    const item = makeItemById(stock.itemId)
    if (!item) return false
    if (!this.backpack.canFit(item)) return this._reject('\u80cc\u5305\u6ca1\u6709\u8db3\u591f\u7a7a\u95f4\u3002')
    this.player.gold -= stock.price
    this._putInInventory(item)
    this._log(`\u8d2d\u4e70 ${item.name}\uff0c\u82b1\u8d39 ${stock.price} \u91d1\u5e01\u3002`)
    refreshMerchantSlot(merchant, this.currentRoom.floor, index, this.random)
    this._changed()
    return true
  }

  refreshMerchantInventory() {
    const merchant = this.merchantEntity
    const price = merchant?.restockPrice || 0
    if (this.phase !== 'merchant' || !merchant || price <= 0) return false
    if (this.player.gold < price) return this._reject('\u91d1\u5e01\u4e0d\u8db3\u3002')
    if (!refreshMerchantStock(merchant, this.currentRoom.floor, this.random)) return false
    this.player.gold -= price
    this._log(`\u82b1\u8d39 ${price} \u91d1\u5e01\u5237\u65b0\u4e86\u8d27\u67b6\u3002`)
    this._changed()
    return true
  }

  sellSelectedMerchantItem() {
    if (!this.canSellAtMerchant()) return false
    const item = this.selectedItem
    if (!item) return this._reject('\u8bf7\u5148\u9009\u4e2d\u8981\u51fa\u552e\u7684\u7269\u54c1\u3002')
    const price = merchantSellPrice(item)
    this.backpack.removeByUid(item.uid)
    if (item.type === 'relic') this.relics.remove(item.uid) || this.relics.remove(item.relicId)
    this.selectedInventoryIndex = null
    this.itemTargeting = false
    this.player.gold += price
    this._log(`\u51fa\u552e ${item.name}\uff0c\u83b7\u5f97 ${price} \u91d1\u5e01\u3002`)
    this._changed()
    return true
  }

  chooseMerchantRelic(id) {
    const merchant = this.merchantEntity
    if (this.phase !== 'merchant' || !this.merchantDefinition?.services.includes('relic-choice') || !merchant || merchant.relicOfferResolved || !merchant.relicChoices?.includes(id)) return false
    const price = Math.max(0, merchant.relicOfferPrice || 0)
    if (this.player.gold < price) return this._reject('\u91d1\u5e01\u4e0d\u8db3\u3002')
    const entry = this.acquireRelic(id)
    if (!entry) return false
    this.player.gold -= price
    merchant.relicOfferResolved = true
    merchant.relicChoices = []
    this._log(`\u8d2d\u4e70 ${getRelicDefinition(id)?.name || '\u5723\u9057\u7269'}\uff0c\u82b1\u8d39 ${price} \u91d1\u5e01\u3002`)
    this._changed()
    return entry
  }

  chooseRoomReward(index) {
    const choice = this.roomReward?.choices?.[index]
    if (this.phase !== 'reward' || !choice) return false
    if (choice.kind === 'relic') {
      const entry = this.acquireRelic(choice.relicId)
      if (!entry) return false
    } else if (choice.kind === 'item') {
      const item = makeItemById(choice.itemId)
      if (!item || !this.backpack.canFit(item)) return this._reject('\u80cc\u5305\u6ca1\u6709\u8db3\u591f\u7a7a\u95f4\u9886\u53d6\u8fd9\u4ef6\u5956\u52b1\u3002')
      this._putInInventory(item)
      this._log(`\u65b0\u623f\u95f4\u5956\u52b1\uff1a\u83b7\u5f97 ${item.name}\u3002`)
    } else if (choice.kind === 'gold') {
      this.player.gold += choice.amount
      this._log(`\u65b0\u623f\u95f4\u5956\u52b1\uff1a\u83b7\u5f97 ${choice.amount} \u91d1\u5e01\u3002`)
    }
    this.roomReward = null
    this.phase = 'explore'
    this._changed()
    return true
  }

  skipRoomReward() {
    if (this.phase !== 'reward' || !this.roomReward) return false
    this.roomReward = null
    this.phase = 'explore'
    this._log('\u8df3\u8fc7\u4e86\u65b0\u623f\u95f4\u5956\u52b1\u3002')
    this._changed()
    return true
  }

  _tryGrayDivination(room = this.currentRoom) {
    if (!this.hasActiveRelic('r-gray-divination') || !room) return false
    const state = this.relicRuntime['r-gray-divination'] || (this.relicRuntime['r-gray-divination'] = {})
    if (Math.max(0, Number(state.count) || 0) < 4) return false
    const candidates = [...room.entities.values()].filter((entity) => {
      if (!entity?.pos || room.isRevealed(entity.pos) || room.tile(entity.pos)?.peeked) return false
      return (entity.kind === 'enemy' && entity.attribute) || (entity.kind === 'item' && entity.item?.type === 'weapon' && entity.item.attribute)
    })
    if (!candidates.length) return false
    const target = candidates[Math.floor(this.random() * candidates.length)]
    const tile = room.tile(target.pos)
    if (!tile) return false
    tile.peeked = true
    state.count = 0
    this._log('\u7070\u7b7e\u535c\u7b6e\uff1a\u7aa5\u89c1\u4e86\u4e00\u5f20\u5c5e\u6027\u5361\u724c\u3002')
    return true
  }

  _recordNeutralFlip(room, position, cause) {
    if (cause === 'player' && this.hasActiveRelic('r-gray-divination')) {
      const entity = room?.entityAt(position)
      const colored = (entity?.kind === 'enemy' && entity.attribute) || (entity?.kind === 'item' && entity.item?.type === 'weapon' && entity.item.attribute)
      if (!colored) {
        const state = this.relicRuntime['r-gray-divination'] || (this.relicRuntime['r-gray-divination'] = {})
        state.count = Math.min(4, Math.max(0, Number(state.count) || 0) + 1)
      }
    }
    return this._tryGrayDivination(room)
  }

  _flipAt(position) {
    const revealDistance = this.hasActiveRelic('r-long-flip') ? 2 : 1
    const route = findRevealPath(this.currentRoom, this.player.pos, position, { distance: revealDistance })
    if (!route) return this._reject('\u65e0\u6cd5\u8d70\u5230\u8fd9\u5f20\u724c\u7684\u9644\u8fd1\u3002')
    const start = { ...this.player.pos }
    const movement = this._walk(route.path)
    let flipOutcome = { skipEnemyIds: new Set() }
    if (!movement.stopped) {
      if (this.player.pos.c !== start.c || this.player.pos.r !== start.r) this.bus.emit('change')
      flipOutcome = this._revealTile(position, { logReveal: true })
    }
    if (!movement.stopped) this._endTurn({
      skipEnemyIds: flipOutcome.skipEnemyIds,
      turnKind: TURN_KINDS.ACTION,
    })
    this._changed()
    return true
  }

  _revealTile(position, { cause = 'player', logReveal = false } = {}) {
    const room = this.currentRoom
    const wasFlippable = this.tileCanBeFlipped(position)
    if (!room?.reveal(position)) return { skipEnemyIds: new Set() }
    const entity = room.entityAt(position)
    const previousRevealAnchor = this._logRevealAnchor
    if (logReveal) {
      const message = entity
        ? `\u7ffb\u5f00\uff1a${entity.name || this._entityName(entity)}\u3002`
        : '\u7ffb\u5f00\u4e86\u4e00\u4e2a\u7a7a\u683c\u3002'
      this._log(message)
      this._logRevealAnchor = `[${this.turn}] ${message}`
    }
    this.bus.emit('animate:flip', { roomId: room.id, position: { ...position }, backUnflippable: !wasFlippable })
    try {
      this._emitRelicEvent('card:revealed', { room, position, cause })
      this._recordNeutralFlip(room, position, cause)
      if (entity?.kind === 'enemy') {
        this._emitRelicEvent('enemy:revealed', { enemy: entity, room, cause })
        this._triggerEnemyAlert(room, entity)
      }
      if (entity?.kind === 'trap') return this._triggerTrap(entity, { cause })
      return { skipEnemyIds: new Set() }
    } finally {
      this._logRevealAnchor = previousRevealAnchor
    }
  }

  _triggerTrap(trap, { cause = 'player' } = {}) {
    const room = this.currentRoom
    const definition = getTrapDefinition(trap.trapId)
    const skipEnemyIds = new Set()
    if (!room || !definition) return { skipEnemyIds }
    if (trap.triggered === true) return { skipEnemyIds }
    if (!this.suppressedTrapIds) this.suppressedTrapIds = new Set()
    this.suppressedTrapIds.delete(trap.id)
    this._emitRelicEvent('trap:before-trigger', { trap, definition, cause })
    if (this.suppressedTrapIds.has(trap.id)) {
      room.removeEntity(trap.id)
      this.suppressedTrapIds.delete(trap.id)
      this._log(`${definition.name}\u88ab\u5b89\u5168\u62c6\u9664\u3002`)
      return { skipEnemyIds }
    }
    trap.triggered = true
    trap.triggeredAtGlobalTurn = this.globalTurn
    trap.removeAfterGlobalTurn = this.globalTurn + 2
    if (definition.effect === 'explosion') {
      const result = this._damagePlayer(definition.damage, { source: 'trap:explosion' })
      this._log(`${definition.name}\u89e6\u53d1\uff0c${damageReductionLog(result)}\u3002`)
      const victims = [...room.entities.values()]
        .filter((entity) => entity.kind === 'enemy' && room.isRevealed(entity.pos))
        .filter((entity) => combatDistance(trap.pos, entity.pos, definition.radius) <= definition.radius)
      for (const enemy of victims) {
        const hit = this._damageEnemy(enemy, definition.damage, { source: 'trap:explosion' })
        this._log(`${enemy.name}\u53d7\u5230\u7206\u70b8\u4f24\u5bb3 ${hit.damage}\u3002`)
      }
    } else if (definition.effect === 'alarm') {
      const targets = [...room.entities.values()]
        .filter((entity) => entity.kind === 'enemy' && !room.isRevealed(entity.pos))
        .filter((entity) => combatDistance(trap.pos, entity.pos, definition.radius) <= definition.radius)
      const flips = []
      for (const enemy of targets) {
        const wasFlippable = this.tileCanBeFlipped(enemy.pos)
        this._revealEnemy(room, enemy, { cause: 'trap:alarm', animate: false })
        flips.push({ position: enemy.pos, backUnflippable: !wasFlippable })
        enemy.actionDelay = Math.max(normalizedCounter(enemy.actionDelay), 1)
        skipEnemyIds.add(enemy.id)
      }
      this._animateEnemyRevealBatch(room, flips)
      this._log(`${definition.name}\u89e6\u53d1\uff0c\u7ffb\u5f00\u4e86 ${targets.length} \u4e2a\u9644\u8fd1\u654c\u4eba\u3002`)
    } else if (definition.effect === 'corrosion') {
      const energyLoss = Math.max(1, Math.floor(Number(definition.energyLoss) || 2))
      this.player.energy = Math.max(0, this.player.energy - energyLoss)
      this._log(`${definition.name}\u89e6\u53d1\uff0c\u4f53\u529b -${energyLoss}\u3002`)
    } else if (definition.effect === 'poison') {
      const poisonTurns = Math.max(1, Math.floor(Number(definition.poisonTurns) || 1))
      const poisonDamage = Math.max(1, Math.floor(Number(definition.poisonDamage) || 1))
      const currentTurns = normalizedCounter(this.player.poisonedTurns)
      const currentDamage = Math.max(0, Math.floor(Number(this.player.poisonDamage) || 0))
      this.player.poisonedTurns = Math.max(currentTurns, poisonTurns)
      this.player.poisonDamage = Math.max(currentDamage, poisonDamage)
      this._log(`${definition.name}\u89e6\u53d1\uff0c\u4e2d\u6bd2 ${this.player.poisonedTurns} \u4e2a\u5168\u5c40\u56de\u5408\uff0c\u6bcf\u56de\u5408\u53d7\u5230 ${this.player.poisonDamage} \u70b9\u65e0\u89c6\u62a4\u7532\u7684\u4f24\u5bb3\u3002`)
    }
    this._emitRelicEvent('trap:triggered', { trap, definition, cause })
    return { skipEnemyIds }
  }

  _moveTo(position) {
    const route = findPath(this.currentRoom, this.player.pos, position)
    if (!route) return this._reject('\u76ee\u6807\u4e0d\u53ef\u8fbe\u3002')
    this._walk(route)
    this._changed()
    return true
  }

  _pickUp(entity) {
    const room = this.currentRoom
    if (entity.kind === 'item' && !this.backpack.canFit(entity.item)) return this._reject('\u80cc\u5305\u6ca1\u6709\u8db3\u591f\u7a7a\u95f4\uff0c\u65e0\u6cd5\u5f00\u59cb\u79fb\u52a8\u3002')
    if (entity.kind === 'item' && entity.item?.type === 'relic' && !getRelicDefinition(entity.item.relicId)) return this._reject('\u65e0\u6cd5\u8bc6\u522b\u8fd9\u4ef6\u5723\u9057\u7269\u3002')
    const route = findPath(room, this.player.pos, entity.pos, { allowGoalOccupied: true })
    if (!route) return this._reject('\u76ee\u6807\u4e0d\u53ef\u8fbe\u3002')
    const movement = this._walk(route)
    if (!movement.stopped) {
      if (entity.kind === 'item') {
        if (entity.item?.type === 'relic') {
          const entry = this.acquireRelic(entity.item.relicId, { notify: false })
          if (entry) {
            room.removeEntity(entity.id)
            const item = this.backpack.placementOf(entry.uid)?.item
            this._emitRelicEvent('item:collected', { item })
          } else this._log(`\u5723\u9057\u7269\u5df2\u88ab\u83b7\u5f97\uff0c\u65e0\u6cd5\u91cd\u590d\u6536\u96c6\u3002`)
        } else {
          room.removeEntity(entity.id)
          this._putInInventory(entity.item)
          this._log(`\u83b7\u5f97 ${entity.item.name}\u3002`)
          this._emitRelicEvent('item:collected', { item: entity.item })
        }
      } else if (entity.kind === 'gold') {
        room.removeEntity(entity.id)
        this.player.gold += entity.amount
        this._log(`\u83b7\u5f97 ${entity.amount} \u91d1\u5e01\u3002`)
        this._emitRelicEvent('gold:collected', { amount: entity.amount })
      } else if (entity.kind === 'key') {
        room.removeEntity(entity.id)
        const edge = this.dungeon.edge(entity.edgeId)
        edge.unlocked = true
        this._log('\u627e\u5230\u4e86\u5f00\u95e8\u673a\u5173\uff0c\u5bf9\u5e94\u95e8\u5df2\u6c38\u4e45\u6253\u5f00\u3002')
        this._emitRelicEvent('key:collected', { key: entity, edge })
      }
    }
    if (!movement.stopped) this._endTurn({ turnKind: TURN_KINDS.ACTION })
    this._changed()
    return true
  }

  _useDoor(door) {
    const edge = this.doorEdge(door)
    if (!edge?.unlocked) return this._reject('\u95e8\u88ab\u673a\u5173\u9501\u4f4f\u4e86\u3002')
    const route = findDoorPath(this.currentRoom, this.player.pos, door)
    if (!route) return this._reject('\u65e0\u6cd5\u9760\u8fd1\u8fd9\u6247\u95e8\u3002')
    this.roomEntering = route.length > 0
    const movement = this._walk(route)
    if (movement.stopped) {
      this.roomEntering = false
      this._changed()
      return true
    }
    const targetDoor = this.dungeon.otherDoor(door)
    const targetRoom = this.dungeon.room(targetDoor?.roomId)
    if (!targetDoor || !targetRoom) this.roomEntering = false
    if (!targetDoor || !targetRoom) return this._reject('\u95e8\u7684\u8fde\u63a5\u635f\u574f\u3002')
    this._emitRelicEvent('room:left', { room: this.currentRoom })
    const firstVisit = !targetRoom.visited
    targetRoom.reveal(targetDoor.arrival)
    targetRoom.visited = true
    this.player.roomId = targetRoom.id
    this.player.pos = { ...targetDoor.arrival }
    this._log(`\u8fdb\u5165 ${this.roomLabel(targetRoom)}\u3002`)
    this._endTurn({ skipEnemyPhase: true, turnKind: TURN_KINDS.ACTION })
    this._emitRelicEvent('room:entered', { room: targetRoom, firstVisit })
    const talentState = this._talentRuntime()
    talentState.roomLastStandUsed = false
    if (this.hasTalent('survival-shell')) this.player.armor += 3
    if (firstVisit && !this.gameOver) {
      const reward = buildRoomRewardChoices(this.relics, {
        floor: targetRoom.floor,
        type: this._drawRoomRewardType(),
        random: this.random,
      })
      this.roomReward = {
        roomId: targetRoom.id,
        type: reward.type,
        choices: reward.choices,
      }
      this.phase = 'reward'
      this._log('\u9996\u6b21\u8fdb\u5165\u65b0\u623f\u95f4\uff0c\u8bf7\u9009\u62e9\u4e00\u9879\u5956\u52b1\u3002')
    }
    this._changed()
    return true
  }

  _knockbackEnemy(enemy, distance = 1, { collisionDamage = 0, collisionDelay = 0 } = {}) {
    const room = this.currentRoom
    if (!room || !enemy?.pos) return false
    const dc = Math.sign(enemy.pos.c - this.player.pos.c)
    const dr = Math.sign(enemy.pos.r - this.player.pos.r)
    if (dc === 0 && dr === 0) return false
    let moved = false
    let collision = null
    for (let step = 0; step < Math.max(0, distance); step += 1) {
      const destination = { c: enemy.pos.c + dc, r: enemy.pos.r + dr }
      if (!room.contains(destination)) {
        collision = 'wall'
        break
      }
      if (!room.isRevealed(destination)) break
      const occupant = room.entityAt(destination)
      if (!occupant) {
        room.moveEntity(enemy.id, destination)
        moved = true
        continue
      }
      if (occupant.kind === 'enemy') collision = 'enemy'
      else if (occupant.kind === 'door') collision = 'wall'
      break
    }
    if (collision) {
      if (collisionDamage > 0 && room.entity(enemy.id)) this._damageEnemy(enemy, collisionDamage, { source: 'weapon:polearm-collision' })
      if (collisionDelay > 0 && room.entity(enemy.id)) enemy.actionDelay = normalizedCounter(enemy.actionDelay) + collisionDelay
    }
    return { moved, collision }
  }

  _adjacentEnemy(enemy) {
    return this._nearbyEnemies(enemy?.pos, 1, 1)[0] || null
  }

  _nearbyEnemies(center, maxDistance = 2, count = 1, excludeIds = new Set()) {
    const room = this.currentRoom
    if (!room || !center) return []
    const candidates = [...room.entities.values()]
      .filter((entity) => entity.kind === 'enemy' && !entity.downed && room.isRevealed(entity.pos) && !excludeIds.has(entity.id))
      .map((entity) => ({ entity, distance: combatDistance(center, entity.pos) }))
      .filter((entry) => entry.distance <= maxDistance)
    candidates.sort((left, right) => left.distance - right.distance)
    const selected = []
    while (selected.length < count && candidates.length) {
      const distance = candidates[0].distance
      const tied = candidates.filter((entry) => entry.distance === distance)
      const choice = tied[Math.floor(this.random() * tied.length)]
      selected.push(choice.entity)
      candidates.splice(candidates.indexOf(choice), 1)
    }
    return selected
  }

  _addCorrosion(enemy, stacks = 1) {
    if (!enemy || stacks <= 0) return false
    enemy.corrosion = Math.max(0, Number(enemy.corrosion) || 0) + Math.floor(stacks)
    return true
  }

  _spreadCorrosion(center, count = 1) {
    const targets = this._nearbyEnemies(center, 2, count)
    for (const target of targets) this._addCorrosion(target, 1)
    return targets
  }

  _talentAttackContext(weapon, enemy, distance) {
    const flat = []
    const state = this._talentRuntime()
    const add = (amount, source) => { if (amount) flat.push({ amount, source }) }
    const hp = Math.max(0, Number(enemy?.hp) || 0)
    const maxHp = Math.max(1, Number(enemy?.maxHp) || hp || 1)
    if (weapon.weaponClass === 'heavy') {
      if (this.hasTalent('heavy-pressure') && hp > maxHp * 0.5) add(2, 'talent:heavy-pressure')
      if (this.hasTalent('heavy-crush') && hp >= maxHp) add(2, 'talent:heavy-crush')
    }
    if (weapon.weaponClass === 'polearm' && distance === 2 && this.hasTalent('polearm-distance')) add(1, 'talent:polearm-distance')
    if (weapon.weaponClass === 'dagger' && hp * 100 < maxHp * 30 && this.hasTalent('dagger-deadline')) add(2, 'talent:dagger-deadline')
    if (weapon.attribute === 'drown' && this.hasTalent('drown-pressure')) add(1, 'talent:drown-pressure')
    if (weapon.attribute === 'scorch' && this.hasTalent('scorch-char')) state.scorchCounterBonus = 0.1
    if (weapon.weaponClass === 'bow') {
      const key = enemy?.id || enemy?.enemyId || 'unknown'
      if (!state.bowFirst[key]) {
        state.bowFirst[key] = true
        if (this.hasTalent('bow-first')) add(2, 'talent:bow-first')
        if (distance >= 3 && this.hasTalent('bow-snipe')) add(2, 'talent:bow-snipe')
      }
      if (distance === weaponAttackRange(weapon, this.player) && this.hasTalent('bow-hunt')) add(2, 'talent:bow-hunt')
    }
    const pendingTalent = this._consumeTalentBuffs(weapon, enemy)
    for (const buff of pendingTalent) add(buff.amount, buff.source || 'talent:pending')
    const itemBuffs = (this.player.pendingAttackBuffs || []).filter((buff) => buff.target !== 'melee' || weapon.range === 1)
    return {
      flat: flat.reduce((total, entry) => total + entry.amount, 0) + itemBuffs.reduce((total, buff) => total + (Number(buff.amount) || 0), 0),
      itemBuffs,
      pendingTalent,
      counterBonus: weapon.attribute === 'scorch' && this.hasTalent('scorch-char') ? 0.1 : 0,
    }
  }

  _recordAxeMultiAttack(multiTarget, weapon) {
    if (!multiTarget || weapon?.weaponClass !== 'axe') return
    if (this.hasTalent('axe-leverage') && this.random() < 0.5) this._recoverEnergy(1)
    if (this.hasTalent('axe-formation')) this._queueTalentBuff({ amount: 2, weaponClass: 'axe', source: 'talent:axe-formation' })
  }

  _applyTalentPrimaryOutcome({ enemy, weapon, distance, outcome, hit }) {
    const state = this._talentRuntime()
    const primaryKilled = !!hit?.defeated
    const maxHp = Math.max(1, Number(enemy?.maxHp) || 1)
    const actualHealthDamage = Math.max(0, Number(hit?.healthDamage ?? hit?.damage) || 0)
    if (weapon.weaponClass === 'heavy') {
      if (this.hasTalent('heavy-aftershock') && actualHealthDamage >= maxHp * 0.4) this.player.armor += 2
      if (this.hasTalent('heavy-shake') && actualHealthDamage >= maxHp * 0.5 && this.random() < 0.5) this._recoverEnergy(1)
      if (this.hasTalent('heavy-unstoppable') && actualHealthDamage >= maxHp * 0.5) this._queueTalentBuff({ amount: 3, weaponClass: 'heavy', source: 'talent:heavy-unstoppable' })
    }
    if (state.daggerTwin) {
      if (primaryKilled && this.hasTalent('dagger-twin')) this._queueTalentBuff({ amount: 2, weaponClass: 'dagger', source: 'talent:dagger-twin' })
      state.daggerTwin = null
    }
    if (weapon.weaponClass === 'dagger' && primaryKilled) {
      if (this.hasTalent('dagger-harvest')) this._queueTalentBuff({ amount: 2, weaponClass: 'dagger', source: 'talent:dagger-harvest' })
      if (this.hasTalent('dagger-pass')) this._queueTalentBuff({ amount: 2, source: 'talent:dagger-pass' })
      if (this.hasTalent('dagger-edge')) this._recoverEnergy(1)
      if (this.hasTalent('dagger-twin')) state.daggerTwin = true
    }
    if (weapon.weaponClass === 'bow' && distance === weaponAttackRange(weapon, this.player) && this.hasTalent('bow-ammo') && this.random() < 0.5) this._recoverEnergy(1)
    if (outcome.countered && weapon.attribute === 'scorch') {
      if (primaryKilled && this.hasTalent('scorch-ignite')) {
        const targets = this._nearbyEnemies(enemy.pos, 2, 1 + (this.hasTalent('scorch-spread') ? 1 : 0), new Set([enemy.id]))
        const damage = 2 + (this.hasTalent('scorch-wildfire') ? 1 : 0)
        for (const target of targets) {
          const secondary = this._damageEnemy(target, damage, { source: 'talent:scorch-explosion' })
          this._emitRelicEvent('damage:secondary', { enemy: target, weapon, source: 'talent:scorch-explosion', damage: secondary.damage, defeated: secondary.defeated })
        }
      }
      if (primaryKilled && this.hasTalent('scorch-ember')) this._queueTalentBuff({ amount: 2 + (this.hasTalent('scorch-wildfire') ? 1 : 0), attribute: 'scorch', source: 'talent:scorch-ember' })
    }
    if (outcome.countered && weapon.attribute === 'wither') {
      if (this.hasTalent('wither-corrosion') && this.currentRoom?.entity(enemy.id)) this._addCorrosion(enemy, 1)
      if (primaryKilled && this.hasTalent('wither-remains')) this._spreadCorrosion(enemy.pos, 1 + (this.hasTalent('wither-decay') ? 1 : 0))
    }
    if (outcome.countered && weapon.attribute === 'drown') {
      if (primaryKilled && this.hasTalent('drown-tide')) this.player.armor += 2
      if (!primaryKilled && this.hasTalent('drown-depth')) this._queueTalentBuff({ amount: 3, targetId: enemy.id, source: 'talent:drown-depth' })
      if (!primaryKilled && this.hasTalent('drown-trap') && !state.drownDelay[enemy.id]) {
        state.drownDelay[enemy.id] = true
        enemy.actionDelay = Math.max(0, Number(enemy.actionDelay) || 0) + 1
      }
      if (primaryKilled && this.hasTalent('drown-surge')) this._queueTalentBuff({ amount: 2, attribute: 'drown', source: 'talent:drown-surge' })
    }
  }

  _attack(enemy) {
    const weapon = this.selectedItem
    if (weapon?.type !== 'weapon') return this._reject('\u8bf7\u5148\u4ece\u80cc\u5305\u9009\u4e2d\u4e00\u628a\u6b66\u5668\u3002')
    const energyCost = weaponEnergyCost(weapon)
    const attackRange = weaponAttackRange(weapon, this.player)
    const route = findAttackPath(this.currentRoom, this.player.pos, enemy, [{ ...weapon, range: attackRange }])
    if (!route) return this._reject('\u6ca1\u6709\u53ef\u8fbe\u7684\u653b\u51fb\u4f4d\u7f6e\u3002')
    if (energyAfterMovement(this.player, route.path.length) < energyCost) return this._reject('\u4f53\u529b\u4e0d\u8db3\u3002')
    const movement = this._walk(route.path)
    if (movement.stopped || !this.currentRoom?.entity(enemy.id)) {
      this._changed()
      return true
    }
    const attackers = [{ weapon }]
    this._emitRelicEvent('attack:started', { enemy, attackers, weapon })
    const roomState = this._roomRuntime()
    const firstAttackInRoom = !roomState.firstAttackUsed
    if (combatDistance(this.player.pos, enemy.pos, attackRange) <= attackRange) {
      if (!this._tryTenthAttackTransmutation(enemy)) {
        const distance = combatDistance(this.player.pos, enemy.pos)
        const talentContext = this._talentAttackContext(weapon, enemy, distance)
        const type = attackAttributeModifier(weapon, enemy, { counterBonus: talentContext.counterBonus })
        const relicModifiers = this.relicEngine.damageModifiers({ run: this, weapon, target: enemy, player: this.player, room: this.currentRoom, firstAttackInRoom, countered: type.countered, resisted: type.resisted })
        if (!this._spendEnergy(weaponEnergyCost(weapon))) return this._reject('\u4f53\u529b\u4e0d\u8db3\u3002')
        const outcome = computeAttackDamage({
          weapon,
          target: enemy,
          pendingAttackBonus: talentContext.flat,
          relicModifiers,
          terrainModifiers: terrainDamageModifiers(this.currentRoom, this.player.pos),
          counterBonus: talentContext.counterBonus,
        })
        const attackLogSequence = this._logSequence
        const hit = this._damageEnemy(enemy, outcome.damage, { ignoreDefense: weapon.weaponClass === 'heavy' })
        this._emitRelicEvent('attack:primary-hit', { enemy, weapon, damage: hit.damage, healthDamage: hit.healthDamage, countered: outcome.countered, defeated: hit.defeated })
        this._emitRelicEvent('attack:hit', { enemy, weapon, damage: hit.damage, countered: outcome.countered, defeated: hit.defeated })
        if (talentContext.itemBuffs.length > 0) {
          this.player.pendingAttackBuffs = this.player.pendingAttackBuffs.filter((buff) => !talentContext.itemBuffs.includes(buff))
          this.player.pendingAttackBonus = this.player.pendingAttackBuffs.reduce((total, buff) => total + buff.amount, 0)
        }
        if (hit.defeated) this._emitRelicEvent('attack:primary-kill', { enemy, weapon, damage: hit.damage, healthDamage: hit.healthDamage, countered: outcome.countered })
        this._applyTalentPrimaryOutcome({ enemy, weapon, distance, outcome, hit })
        if (weapon.weaponClass === 'sword') {
          this.player.parry = { multiplier: Math.max(0, 0.6 - (this.hasTalent('sword-steady') ? 0.1 : 0)), ranged: this.hasTalent('sword-guard') }
        } else if (weapon.weaponClass === 'axe') {
          const splashMultiplier = 0.5 + (this.hasTalent('axe-wide') ? 0.15 : 0) + (this.hasTalent('axe-bloodstorm') ? 0.15 : 0)
          const targetCount = 1 + (this.hasTalent('axe-sweep') ? 1 : 0) + (this.hasTalent('axe-bloodstorm') ? 1 : 0)
          const splashDamage = Math.floor(hit.damage * splashMultiplier)
          const targets = splashDamage > 0 ? this._nearbyEnemies(enemy.pos, 2, targetCount, new Set([enemy.id])) : []
          let actualTargets = 0
          for (const target of targets) {
            const splashHit = this._damageEnemy(target, splashDamage, { source: 'weapon:axe' })
            if (splashHit.damage > 0) actualTargets += 1
            this._emitRelicEvent('damage:secondary', { enemy: target, source: 'weapon:axe', weapon, damage: splashHit.damage, defeated: splashHit.defeated })
          }
          this._recordAxeMultiAttack(hit.damage > 0 && actualTargets > 0, weapon)
        } else if (weapon.weaponClass === 'polearm') {
          const knockbackDistance = 1 + (this.hasTalent('polearm-push') ? 1 : 0)
          if (distance === 2) {
            const knockback = this._knockbackEnemy(enemy, knockbackDistance, {
              collisionDamage: (this.hasTalent('polearm-impact') ? 3 : 0) + (this.hasTalent('polearm-anti-cavalry') ? 2 : 0),
              collisionDelay: this.hasTalent('polearm-anti-cavalry') ? 1 : 0,
            })
            if (knockback?.moved && this.hasTalent('polearm-step') && this.random() < 0.5) this._recoverEnergy(1)
            if (knockback?.collision) this._emitRelicEvent('damage:secondary', { enemy, source: 'weapon:polearm-collision', weapon, damage: 0, collision: knockback.collision })
          }
        }
        if (hit.defeated) this._emitRelicEvent('attack:enemy-defeated', { enemy, weapon, countered: outcome.countered })
        const relation = outcome.countered ? '\u514b\u5236\u00b7' : outcome.resisted ? '\u53d7\u5236\u00b7' : ''
        const attackLogIndex = Math.max(0, this._logSequence - attackLogSequence)
        this._log(`${relation}${weapon.name} \u5bf9 ${enemy.name}${hit.finishedDowned ? '\u7ec8\u7ed3\u4e86' : '\u9020\u6210'} ${hit.damage} \u4f24\u5bb3\u3002`, { insertAt: attackLogIndex })
      }
    }
    roomState.firstAttackUsed = true
    this._emitRelicEvent('attack:resolved', { enemy, weapon })
    this._endTurn({ turnKind: TURN_KINDS.ATTACK })
    this._changed()
    return true
  }

  _walk(path) {
    const roomId = this.currentRoom?.id
    for (const step of path) {
      const previous = { ...this.player.pos }
      if (roomId) {
        this.bus.emit('animate:move', {
          roomId,
          from: previous,
          path: [{ ...step }],
        })
      }
      this.player.pos = { ...step }
      this._discoverNearbyExitDoors()
      this._triggerAmbushes(step)
      if (this.gameOver) {
        this._endTurn({ turnKind: TURN_KINDS.MOVEMENT })
        return { stopped: true }
      }
      this._endTurn({ turnKind: TURN_KINDS.MOVEMENT })
      if (this.gameOver) return { stopped: true }
    }
    return { stopped: false }
  }

  _endTurn({ skipEnemyPhase = false, skipEnemyIds = new Set(), turnKind = TURN_KINDS.ACTION } = {}) {
    const counters = this.turns.advance(turnKind)
    this._cleanupTriggeredTraps(counters.globalTurn)
    const turnContext = { turn: counters.globalTurn, turnKind, ...counters }
    this._emitTurnEvent('turn:advanced', turnContext)
    this._emitTurnEvent('turn:started', turnContext)
    if (turnKind !== TURN_KINDS.ATTACK) this._recoverEnergy(1)
    this._tickPlayerStatuses()
    if (skipEnemyPhase || this.gameOver) {
      this._emitTurnEvent('turn:ended', turnContext)
      return
    }
    this._tickEnemyStates()
    if (this.gameOver) return
    const enemies = this._activeEnemies()
    for (const enemy of enemies) {
      if (this.gameOver || skipEnemyIds.has(enemy.id) || !this.currentRoom.entity(enemy.id)) continue
      this._applyEnemyTraits(enemy)
      if (!this.currentRoom.entity(enemy.id) || this.gameOver) continue
      const outcome = stepEnemy(enemy, {
        room: this.currentRoom,
        player: this.player,
        attack: (actor) => this._enemyAttack(actor),
        move: (actor, position) => this._moveEnemy(actor, position),
      })
      if (outcome.acted) this._onEnemyAction(enemy)
    }
    this._emitTurnEvent('turn:ended', turnContext)
  }

  _enemyAttack(enemy, multiplier = 1) {
    if (!enemy || enemy.attack <= 0) return { healthDamage: 0 }
    enemy.hasActed = true
    const finalMultiplier = multiplier * (this.hasActiveRelic('r-final-duel') && this.remainingEnemies() === 1 ? 1.3 : 1)
    const rawDamage = Math.max(1, Math.floor(enemy.attack * finalMultiplier))
    const result = this._damagePlayer(rawDamage, { source: 'enemy:attack', enemy })
    enemy.attackCooldown = cooldownWaitTurns(enemy.attackCooldownMax)
    this._log(`${enemy.name} \u653b\u51fb\u4f60\uff0c${damageReductionLog(result)}\u3002`)
    if (!this.gameOver && enemy.traits?.includes('burning')) {
      const turns = Math.max(1, Math.floor(Number(enemy.burningTurns) || 2))
      const damage = Math.max(1, Math.floor(Number(enemy.burningDamage) || 1))
      this._applyBurning(turns, damage)
      this._log(`${enemy.name}\u4f7f\u4f60\u71c3\u70e7 ${turns} \u4e2a\u5168\u5c40\u56de\u5408\uff0c\u6bcf\u56de\u5408 ${damage} \u70b9\u4f24\u5bb3\u3002`)
    }
    if (!this.gameOver && enemy.traits?.includes('pull')) {
      const distance = Math.max(1, Math.floor(Number(enemy.pullDistance) || 1))
      if (this._pullPlayer(enemy, distance)) this._log(`${enemy.name}\u5c06\u4f60\u7275\u5f15\u4e86 ${distance} \u683c\u3002`)
    }
    if (enemy.traits?.includes('split') && !enemy.splitTriggered) {
      enemy.splitTriggered = true
      this._spawnSplitMinion(enemy, enemy.splitMinionId)
    }
    return result
  }

  _damagePlayer(rawDamage, context = {}) {
    const baseMultiplier = this.hasActiveRelic('r-double-edged-fate') ? 2 : 1
    const isMelee = context.melee === true || context.enemy?.range === 1
    let damage = Math.max(0, Math.floor((rawDamage || 0) * baseMultiplier))
    const parry = this.player.parry
    const canParry = parry && (isMelee || parry.ranged)
    if (canParry) {
      damage = Math.max(0, Math.floor(damage * Math.max(0, Number(parry.multiplier) || 0)))
      this.player.parry = null
      if (rawDamage > 0) this._onParrySuccess()
    }
    if (!context.ignoreArmor && this.hasTalent('survival-hardening') && this.player.armor > 0) damage = Math.max(0, damage - 1)
    const absorbed = context.ignoreArmor ? 0 : Math.min(this.player.armor, damage)
    const healthDamage = damage - absorbed
    const fatal = this.player.hp - healthDamage <= 0
    this.player.armor -= absorbed
    const talentState = this._talentRuntime()
    if (fatal && this.hasTalent('survival-instinct') && !talentState.roomLastStandUsed) {
      talentState.roomLastStandUsed = true
      this.player.hp = 1
      this.player.armor += 5
      this._log('\u5b58\u7eed\u672c\u80fd\uff1a\u4fdd\u7559 1 \u70b9\u751f\u547d\uff0c\u62a4\u7532 +5\u3002')
    } else {
      this.player.hp -= healthDamage
    }
    this._emitRelicEvent('player:damaged', { rawDamage: damage, absorbed, healthDamage, ...context })
    if (this.player.hp <= 0) {
      this.player.hp = 0
      this.gameOver = true
      this.phase = 'over'
      this._log(`\u4f60\u5012\u4e0b\u4e86\uff08\u539f\u56e0\uff1a${playerDeathCause(context)}\uff09\u3002`, { death: true })
    }
    return { rawDamage: damage, absorbed, healthDamage }
  }

  _healPlayer(amount, context = {}) {
    const before = this.player.hp
    const multiplier = this.hasTalent('survival-recovery') ? 1.25 : 1
    const restored = Math.floor(Math.max(0, Number(amount) || 0) * multiplier)
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + restored)
    const healed = this.player.hp - before
    if (healed > 0) this._emitRelicEvent('player:healed', { amount: healed, ...context })
    return healed
  }

  _onParrySuccess() {
    if (this.hasTalent('sword-counter')) this._queueTalentBuff({ amount: 2, weaponClass: 'sword', source: 'talent:sword-counter' })
    if (this.hasTalent('sword-unity')) this._queueTalentBuff({ amount: 2, weaponClass: 'sword', source: 'talent:sword-unity' })
    if (this.hasTalent('sword-rebound')) this._recoverEnergy(1)
  }

  _damageEnemy(enemy, damage, { source = 'attack', ignoreDefense = false } = {}) {
    if (!enemy || !this.currentRoom?.entity(enemy.id)) return { damage: 0, healthDamage: 0, defeated: false, finishedDowned: false }
    if (enemy.downed) {
      this._defeatEnemy(enemy, { source })
      return { damage: 0, healthDamage: 0, defeated: true, finishedDowned: true }
    }
    const hpBefore = Math.max(0, Number(enemy.hp) || 0)
    let applied = Math.max(0, Math.floor(damage || 0))
    const corrosionStacks = Math.max(0, Number(enemy.corrosion) || 0)
    if (corrosionStacks > 0) {
      const perStack = 1 + (this.hasTalent('wither-deep') ? 1 : 0) + (this.hasTalent('wither-decay') ? 1 : 0)
      applied += corrosionStacks * perStack
    }
    if (!ignoreDefense && enemy.traits?.includes('shield') && !enemy.shieldConsumed) {
      enemy.shieldConsumed = true
      applied = Math.min(applied, Math.floor(enemy.maxHp / 2))
    }
    const healthDamage = Math.min(hpBefore, applied)
    enemy.hp -= applied
    if (enemy.hp > 0) return { damage: healthDamage, rawDamage: applied, healthDamage, defeated: false, finishedDowned: false }
    enemy.hp = 0
    if (enemy.deathRule === 'revive' && !enemy.reviveUsed) {
      enemy.reviveUsed = true
      enemy.downed = true
      enemy.reviveTurns = 2
      this._log(`${enemy.name}\u5047\u6b7b\u4e86\uff0c\u4e24\u56de\u5408\u540e\u5c06\u6ee1\u8840\u590d\u6d3b\u3002`)
      return { damage: healthDamage, rawDamage: applied, healthDamage, defeated: false, finishedDowned: false }
    }
    this._defeatEnemy(enemy, { source })
    return { damage: healthDamage, rawDamage: applied, healthDamage, defeated: true, finishedDowned: false }
  }

  _defeatEnemy(enemy, { source = 'attack', suppressDeathExplosion = false, suppressLoot = false } = {}) {
    if (!enemy || !this.currentRoom?.entity(enemy.id)) return false
    if (enemy.deathExplosionDamage > 0 && !suppressDeathExplosion) {
      this._explodeEnemy(enemy, enemy.deathExplosionDamage, 'small')
    }
    this.currentRoom.removeEntity(enemy.id)
    this._log(`${enemy.name} \u88ab\u51fb\u8d25\u3002`)
    this._emitRelicEvent('enemy:killed', { enemy, source })
    this._applyEnemyDeathStatus(enemy)
    if (enemy.traits?.includes('death-spawn')) this._spawnMinionsNear(enemy, enemy.deathSpawnMinionId, enemy.deathSpawnCount)
    if (this.hasTalent('wither-spread') && (Number(enemy.corrosion) || 0) > 0) {
      const targets = this._spreadCorrosion(enemy.pos, 1 + (this.hasTalent('wither-decay') ? 1 : 0))
      if (targets.length) this._log(`\u8150\u8680\u6269\u6563\u5230 ${targets.length} \u540d\u654c\u4eba\u3002`)
    }
    if (this.remainingEnemies() === 0) this._emitRelicEvent('room:cleared', { room: this.currentRoom })
    this._gainExperience(enemy)
    const dropRule = enemy.drop
    const itemDropChance = !enemy.boss && !enemy.noLoot && !suppressLoot && dropRule
      ? Math.max(0, Number(dropRule.chance) || 0)
      : 0
    const relicDropChance = !enemy.boss && !enemy.noExperience && !suppressLoot
      ? Math.max(0, Number(enemy.relicDropChance) || 0)
      : 0
    const totalDropChance = Math.min(1, itemDropChance + relicDropChance)
    const lootRoll = totalDropChance > 0 ? this.random() : 1
    if (lootRoll < relicDropChance) {
      const relic = buildRelicChoices(this.relics, { count: 1, random: this.random })[0]
      const drop = relic && createRelicEntity(relic, enemy.pos)
      if (drop) {
        this.currentRoom.addEntity(drop)
        this._log(`${enemy.name} \u6389\u843d\u4e86\u5723\u9057\u7269\uff1a${relic.name}\u3002`)
      }
    } else if (lootRoll < totalDropChance) {
      const drop = makeItemById(dropRule?.itemId, this.random)
      if (drop) {
        this.currentRoom.addEntity(createLootEntity(drop, enemy.pos))
        this._log(`${enemy.name} \u6389\u843d\u4e86 ${drop.name}\u3002`)
      }
    }
    if (enemy.boss) {
      this.win = true
      this.gameOver = true
      this.phase = 'over'
      this._log('\u76d1\u89c6\u8005\u5012\u4e0b\uff0c\u4f60\u9003\u51fa\u4e86\u8fd9\u5ea7\u5730\u7262\u3002')
    }
    return true
  }

  _activeEnemies() {
    const room = this.currentRoom
    if (!room) return []
    return [...room.entities.values()]
      .filter((entity) => entity.kind === 'enemy' && !entity.downed && room.isRevealed(entity.pos))
      .sort((a, b) => (a.revealOrder || Infinity) - (b.revealOrder || Infinity))
  }

  _moveEnemy(enemy, position) {
    const room = this.currentRoom
    if (!room?.isRevealed(position) || !room.isEmpty(position)) return false
    return room.moveEntity(enemy.id, position)
  }

  _applyEnemyTraits(enemy) {
    if (enemy.traits?.includes('regen') && enemy.hp > 0 && enemy.hp < enemy.maxHp) {
      const amount = Math.max(1, enemy.regen || 1)
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + amount)
      this._log(`${enemy.name}\u518d\u751f\u4e86 ${amount} \u70b9\u751f\u547d\u3002`)
    }
  }

  _onEnemyAction(enemy) {
    if (!enemy || this.gameOver || !this.currentRoom?.entity(enemy.id)) return false
    enemy.ownActionCount = normalizedCounter(enemy.ownActionCount) + 1
    if (!enemy.traits?.includes('summon')) return true
    const every = Math.max(1, Math.floor(Number(enemy.summonEvery) || 0))
    const minionId = enemy.summonMinionId
    const limit = Math.max(1, Math.floor(Number(enemy.summonLimit) || 0))
    if (!every || !minionId || !limit || enemy.ownActionCount % every !== 0) return true
    const activeCount = [...this.currentRoom.entities.values()]
      .filter((entity) => entity.kind === 'enemy' && entity.enemyId === minionId).length
    if (activeCount >= limit) {
      this._log(`${enemy.name}\u5df2\u8fbe\u53ec\u5524\u4e0a\u9650\uff0c\u672c\u6b21\u53ec\u5524\u5931\u8d25\u3002`)
      return true
    }
    this._spawnMinionsNear(enemy, minionId, 1)
    return true
  }

  _applyBurning(turns, damage = 1) {
    const duration = Math.max(1, Math.floor(Number(turns) || 1))
    const amount = Math.max(1, Math.floor(Number(damage) || 1))
    const currentTurns = normalizedCounter(this.player.burningTurns)
    const currentDamage = Math.max(0, Math.floor(Number(this.player.burningDamage) || 0))
    this.player.burningTurns = Math.max(currentTurns, duration)
    this.player.burningDamage = Math.max(currentDamage, amount)
    return true
  }

  _applyPoison(turns, damage = 2) {
    const duration = Math.max(1, Math.floor(Number(turns) || 1))
    const amount = Math.max(1, Math.floor(Number(damage) || 1))
    const currentTurns = normalizedCounter(this.player.poisonedTurns)
    const currentDamage = Math.max(0, Math.floor(Number(this.player.poisonDamage) || 0))
    this.player.poisonedTurns = Math.max(currentTurns, duration)
    this.player.poisonDamage = Math.max(currentDamage, amount)
    return true
  }

  _tickPlayerStatuses() {
    let ticked = false
    const poisonTurns = normalizedCounter(this.player?.poisonedTurns)
    if (poisonTurns > 0 && !this.gameOver) {
      const damage = Math.max(1, Math.floor(Number(this.player.poisonDamage) || 2))
      this.player.poisonedTurns = Math.max(0, poisonTurns - 1)
      if (this.player.poisonedTurns === 0) this.player.poisonDamage = 0
      const result = this._damagePlayer(damage, { source: 'trap:poison-fog', ignoreArmor: true })
      this._log(`\u4e2d\u6bd2\u53d1\u4f5c\uff0c${damageReductionLog(result)}\uff08\u65e0\u89c6\u62a4\u7532\uff09\u3002`)
      ticked = true
    }
    const burningTurns = normalizedCounter(this.player?.burningTurns)
    if (burningTurns > 0 && !this.gameOver) {
      const damage = Math.max(1, Math.floor(Number(this.player.burningDamage) || 1))
      this.player.burningTurns = Math.max(0, burningTurns - 1)
      if (this.player.burningTurns === 0) this.player.burningDamage = 0
      const result = this._damagePlayer(damage, { source: 'enemy:burning' })
      this._log(`\u71c3\u70e7\u53d1\u4f5c\uff0c${damageReductionLog(result)}\u3002`)
      ticked = true
    }
    return ticked
  }

  _tickEnemyStates() {
    const room = this.currentRoom
    if (!room) return
    for (const enemy of [...room.entities.values()].filter((entity) => entity.kind === 'enemy' && entity.downed)) {
      enemy.reviveTurns = Math.max(0, (enemy.reviveTurns || 0) - 1)
      if (enemy.reviveTurns > 0) continue
      enemy.downed = false
      enemy.hp = enemy.maxHp
      enemy.actionDelay = normalizedCounter(enemy.initialActionDelay)
      enemy.attackCooldown = 0
      this._log(`${enemy.name}\u6ee1\u8840\u590d\u6d3b\u4e86\u3002`)
    }
  }

  _cleanupTriggeredTraps(globalTurn) {
    let removed = false
    for (const room of this.dungeon?.rooms.values() || []) {
      for (const entity of [...room.entities.values()]) {
        if (entity.kind !== 'trap' || entity.triggered !== true) continue
        const removeAfter = Number(entity.removeAfterGlobalTurn)
        if (!Number.isFinite(removeAfter) || removeAfter > globalTurn) continue
        room.removeEntity(entity.id)
        removed = true
      }
    }
    return removed
  }

  _nearestEmptyPosition(origin) {
    const room = this.currentRoom
    if (!room || !origin) return null
    const candidates = []
    for (let r = 0; r < room.height; r++) {
      for (let c = 0; c < room.width; c++) {
        const position = { c, r }
        if (position.c === this.player.pos.c && position.r === this.player.pos.r) continue
        if (!room.isRevealed(position) || !room.isEmpty(position)) continue
        candidates.push(position)
      }
    }
    candidates.sort((left, right) => {
      const leftDistance = Math.abs(left.c - origin.c) + Math.abs(left.r - origin.r)
      const rightDistance = Math.abs(right.c - origin.c) + Math.abs(right.r - origin.r)
      return leftDistance - rightDistance || left.r - right.r || left.c - right.c
    })
    return candidates[0] || null
  }

  _pullPlayer(enemy, distance = 1) {
    const room = this.currentRoom
    if (!room || !enemy?.pos || !this.player?.pos || this.gameOver) return false
    const amount = Math.max(1, Math.floor(Number(distance) || 1))
    const destination = {
      c: this.player.pos.c + Math.sign(enemy.pos.c - this.player.pos.c) * amount,
      r: this.player.pos.r + Math.sign(enemy.pos.r - this.player.pos.r) * amount,
    }
    if ((destination.c === this.player.pos.c && destination.r === this.player.pos.r)
      || !room.isRevealed(destination) || !room.isEmpty(destination)) return false
    this.player.pos = destination
    return true
  }

  _applyEnemyDeathStatus(enemy) {
    const room = this.currentRoom
    const status = enemy?.deathStatus
    if (!room || !status || !this.player?.pos || this.gameOver) return false
    const adjacent = neighbors8(enemy.pos, room.width, room.height)
      .some((position) => position.c === this.player.pos.c && position.r === this.player.pos.r)
    if (!adjacent) return false
    if (status === 'poison') {
      const turns = Math.max(1, Math.floor(Number(enemy.deathStatusTurns) || 1))
      const damage = Math.max(1, Math.floor(Number(enemy.deathStatusDamage) || 2))
      this._applyPoison(turns, damage)
      this._log(`${enemy.name}死亡，毒液使你中毒 ${turns} 个全局回合。`)
      return true
    }
    return false
  }

  _spawnMinionsNear(source, minionId, count = 1) {
    const room = this.currentRoom
    const amount = Math.max(0, Math.floor(Number(count) || 0))
    if (!room || !source?.pos || !minionId || amount <= 0) return 0
    const positions = neighbors8(source.pos, room.width, room.height)
      .filter((position) => position.c !== this.player.pos.c || position.r !== this.player.pos.r)
      .filter((position) => room.isRevealed(position) && room.isEmpty(position))
    let spawned = 0
    for (const position of positions) {
      if (spawned >= amount) break
      const minion = createMinion(minionId, position)
      if (!minion) continue
      room.addEntity(minion)
      spawned += 1
      this._log(`${source.name}生成了${minion.name}。`)
    }
    if (spawned < amount) this._log(`${source.name}的生成物空间不足，剩余生成失败。`)
    return spawned
  }

  _spawnSplitMinion(source, minionId) {
    const room = this.currentRoom
    const position = this._nearestEmptyPosition(source?.pos)
    const minion = position ? createMinion(minionId, position) : null
    if (!room || !minion) return false
    room.addEntity(minion)
    this._log(`${source.name}\u5206\u88c2\u51fa\u4e86 ${minion.name}\u3002`)
    return true
  }

  _explodeEnemy(enemy, damage, size) {
    const radius = enemy.explosionRadius || enemy.range || 1
    if (combatDistance(enemy.pos, this.player.pos, radius) > radius) return false
    const result = this._damagePlayer(damage, { source: `enemy:${size}-explosion`, enemy })
    this._log(`${enemy.name}\u53d1\u751f\u4e86${size === 'large' ? '\u5927' : '\u5c0f'}\u81ea\u7206\uff0c${damageReductionLog(result)}\u3002`)
    return true
  }

  _triggerAmbushes(position) {
    const room = this.currentRoom
    if (!room) return false
    const playerNeighborhood = neighbors8(position, room.width, room.height)
    const ambushers = [...room.entities.values()]
      .filter((entity) => entity.kind === 'enemy' && entity.behavior === 'ambush' && !room.isRevealed(entity.pos))
      .filter((entity) => playerNeighborhood.some((candidate) => candidate.c === entity.pos.c && candidate.r === entity.pos.r))
    const flips = []
    for (const enemy of ambushers) {
      const wasFlippable = this.tileCanBeFlipped(enemy.pos)
      room.reveal(enemy.pos)
      flips.push({ position: enemy.pos, backUnflippable: !wasFlippable })
      this._log(`${enemy.name}\u4ece\u4f0f\u51fb\u4e2d\u73b0\u8eab\u3002`)
      if (normalizedCounter(enemy.actionDelay) === 0 && normalizedCounter(enemy.attackCooldown) === 0) {
        this._enemyAttack(enemy)
        this._onEnemyAction(enemy)
        enemy.attackCooldown = cooldownWaitTurns(enemy.attackCooldownMax)
      }
      if (this.gameOver) break
    }
    this._animateEnemyRevealBatch(room, flips)
    return ambushers.length > 0
  }

  _discoverNearbyExitDoors() {
    const room = this.currentRoom
    if (!room) return false
    let discovered = false
    for (const door of this.dungeon.doorsForRoom(room.id)) {
      if (!this.isExitDoor(door) || door.discovered || chebyshev(this.player.pos, door.arrival) > 1) continue
      door.discovered = true
      discovered = true
    }
    return discovered
  }

  _putInInventory(item) { return !!this.backpack.add(item) }

  _entityName(entity) {
    if (entity.kind === 'gold') return '\u91d1\u5e01'
    if (entity.kind === 'key') return '\u5f00\u95e8\u673a\u5173'
    if (entity.kind === 'trap') return '\u9677\u9631'
    return '\u7269\u54c1'
  }

  _canAct() {
    return this.phase === 'explore' && !this.gameOver && this.initialRelicChoices.length === 0 && !this.merchantEntering && !this.roomEntering
  }

  _canOrganizeBackpack() {
    return !this.gameOver && this.initialRelicChoices.length === 0 && ['explore', 'merchant'].includes(this.phase) && !this.merchantEntering && !this.roomEntering
  }

  _reject(message) {
    this._log(message)
    this._changed()
    return false
  }

  _log(message, { death = false, insertAt = null } = {}) {
    const entry = `[${this.turn}] ${message}`
    this._logSequence = (this._logSequence || 0) + 1
    if (death) {
      this.deathLogEntry = entry
      this.log.unshift(entry)
    } else if (Number.isInteger(insertAt)) {
      const index = Math.max(0, Math.min(insertAt, this.log.length))
      this.log.splice(index, 0, entry)
    } else if (this._logRevealAnchor) {
      const anchorIndex = this.log.indexOf(this._logRevealAnchor)
      if (anchorIndex >= 0) this.log.splice(anchorIndex + 1, 0, entry)
      else if (this.deathLogEntry) this.log.splice(1, 0, entry)
      else this.log.unshift(entry)
    } else if (this.deathLogEntry) {
      this.log.splice(1, 0, entry)
    } else {
      this.log.unshift(entry)
    }
    if (this.log.length > 40) this.log.length = 40
  }

  _changed() {
    this._persist()
    this.bus.emit('change')
  }

  serialize() {
    return {
      version: SAVE_VERSION,
      dungeon: this.dungeon.serialize(),
      player: clone(this.player),
      backpack: this.backpack.serialize(clone),
      initialRelicChoices: [...this.initialRelicChoices],
      turn: this.turn,
      turnCounters: this.turns.serialize(),
      phase: this.phase,
      gameOver: this.gameOver,
      win: this.win,
      selectedInventoryIndex: this.selectedInventoryIndex,
      itemTargeting: this.itemTargeting,
      merchant: this.merchant ? { ...this.merchant } : null,
      roomReward: this.roomReward ? clone(this.roomReward) : null,
      roomRewardBag: [...this.roomRewardBag],
      levelUp: this.levelUp ? clone(this.levelUp) : null,
      relicRuntime: clone(this.relicRuntime),
      log: [...this.log],
    }
  }

  _persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize())) } catch {}
  }

  load() {
    const discard = () => {
      try { localStorage.removeItem(SAVE_KEY) } catch {}
      return false
    }
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return false
      const data = JSON.parse(raw)
      if (!data || data.version !== SAVE_VERSION || !data.dungeon || !data.player || !data.backpack) return discard()
      this.dungeon = Dungeon.hydrate(data.dungeon)
      this.player = data.player
      this.backpack = BackpackGrid.hydrate(data.backpack)
      this.player.maxEnergy = ENERGY_MAX
      this.player.energy = Math.max(0, Math.min(this.player.maxEnergy, Math.floor(Number(this.player.energy) || this.player.maxEnergy)))
      this.player.level = Math.max(PROGRESSION.startingLevel, Number(this.player.level) || PROGRESSION.startingLevel)
      this.player.experience = Math.max(0, Number(this.player.experience) || 0)
      this.player.experienceToNext = Math.max(1, Number(this.player.experienceToNext) || experienceToNextLevel(this.player.level))
      this.player.talents = [...new Set(Array.isArray(this.player.talents) ? this.player.talents.filter((id) => !!getLevelUpOption(id) && id !== FIXED_GROWTH.id) : [])]
      this.player.talentRuntime = this.player.talentRuntime && typeof this.player.talentRuntime === 'object' ? this.player.talentRuntime : {}
      this._talentRuntime()
      this.player.parry = this.player.parry && Number.isFinite(this.player.parry.multiplier)
        ? { multiplier: Math.max(0, Math.min(1, this.player.parry.multiplier)), ranged: !!this.player.parry.ranged } : null
      this.player.pendingAttackBuffs = Array.isArray(this.player.pendingAttackBuffs)
        ? this.player.pendingAttackBuffs.filter((buff) => Number.isFinite(buff?.amount) && (buff.target === 'melee' || buff.target === 'any'))
        : []
      this.player.pendingAttackBonus = this.player.pendingAttackBuffs.reduce((total, buff) => total + buff.amount, 0)
      this.player.poisonedTurns = normalizedCounter(this.player.poisonedTurns)
      this.player.poisonDamage = this.player.poisonedTurns > 0
        ? Math.max(1, Math.floor(Number(this.player.poisonDamage) || 2))
        : 0
      this.player.burningTurns = normalizedCounter(this.player.burningTurns)
      this.player.burningDamage = this.player.burningTurns > 0
        ? Math.max(1, Math.floor(Number(this.player.burningDamage) || 1))
        : 0
      this.relics = RelicCollection.fromItems(this.backpack.items)
      this.relics.entries = this.relics.entries.filter((entry) => !!getRelicDefinition(entry.id) && this.backpack.placementOf(entry.uid))
      this.relicEngine = new RelicEngine(this.relics)
      this.initialRelicChoices = (Array.isArray(data.initialRelicChoices) ? data.initialRelicChoices : buildRelicChoices(this.relics, { random: this.random }).map((relic) => relic.id))
        .filter((id) => !!getRelicDefinition(id) && !this.relics.has(id))
      const legacyTurn = Number.isInteger(data.turn) && data.turn >= 0 ? data.turn : 0
      const savedTurnCounters = data.turnCounters && typeof data.turnCounters === 'object' ? data.turnCounters : {}
      this.turns = new TurnLedger({
        attackCount: savedTurnCounters.attackCount ?? data.attackCount ?? 0,
        globalTurn: savedTurnCounters.globalTurn ?? data.globalTurn ?? legacyTurn,
      })
      this.phase = ['explore', 'merchant', 'reward', 'level-up', 'over'].includes(data.phase) ? data.phase : 'explore'
      this.gameOver = !!data.gameOver
      this.win = !!data.win
      this.selectedInventoryIndex = Number.isInteger(data.selectedInventoryIndex) && this.backpack.placementForCellIndex(data.selectedInventoryIndex)
        ? this.backpack.originIndex(this.backpack.placementForCellIndex(data.selectedInventoryIndex))
        : null
      this.itemTargeting = !!data.itemTargeting
      this.merchant = data.merchant && typeof data.merchant.entityId === 'string' ? { entityId: data.merchant.entityId } : null
      this.merchantEntering = false
      this.roomEntering = false
      this.roomReward = data.roomReward?.roomId && Array.isArray(data.roomReward.choices) ? clone(data.roomReward) : null
      this.roomRewardBag = Array.isArray(data.roomRewardBag) && data.roomRewardBag.every((type) => type === 'supply' || type === 'relic')
        ? [...data.roomRewardBag]
        : shuffled(['supply', 'supply', 'supply', 'relic'], this.random)
      this.levelUp = Array.isArray(data.levelUp?.choices)
        ? {
            choices: data.levelUp.choices.filter((id) => !!getLevelUpOption(id)),
          }
        : null
      this.relicEventQueue = []
      this.relicRuntime = data.relicRuntime && typeof data.relicRuntime === 'object' ? clone(data.relicRuntime) : {}
      this.detailPanel = null
      this.log = Array.isArray(data.log) ? data.log : []
      this._logSequence = this.log.length
      synchronizeEntityIds(this.backpack.items.map((item) => item?.uid))
      if (!this.currentRoom?.contains(this.player.pos) || !this.currentRoom.isRevealed(this.player.pos)) return discard()
      if (this.gameOver || this.win) {
        this.gameOver = true
        this.phase = 'over'
        this.merchant = null
      } else if (this.phase === 'merchant' && !this.merchantEntity) {
        this.phase = 'explore'
        this.merchant = null
      } else if (this.phase !== 'merchant') {
        this.merchant = null
      }
      if (this.phase === 'reward' && (!this.roomReward || this.roomReward.roomId !== this.currentRoom?.id)) this.phase = 'explore'
      if (this.phase !== 'reward') this.roomReward = null
      if (this.phase === 'level-up' && !this.levelUp?.choices.length) this.phase = 'explore'
      if (this.phase !== 'level-up') this.levelUp = null
      if (this.initialRelicChoices.length > 0) {
        this.phase = 'explore'
        this.levelUp = null
      } else if (this.phase === 'explore') this._queueLevelUp()
      return true
    } catch {
      return discard()
    }
  }

  clearSave() {
    try { localStorage.removeItem(SAVE_KEY) } catch {}
  }
}
