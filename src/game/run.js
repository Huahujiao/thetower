import { DETAIL_LABELS, detailForItem } from './data/item-details.js'
import { StaminaDeck } from './model/stamina-deck.js'
import { createEmitter } from './core/emitter.js'
import { chebyshev, combatDistance, manhattan, neighbors8 } from './core/geometry.js'
import { TURN_KINDS, TurnLedger } from './core/turns.js'
import { commitInventoryDrop, moveInventoryToStash, discardInventoryItem } from './core/inventory-actions.js'
import { attributeLabel } from './data/attributes.js'
import { createLootEntity, createMinion, getItemDefinition, makeItemById, makeRelicItem, starterWeapon, synchronizeEnemyBalance, synchronizeEntityIds } from './data/content.js'
import { applyStatus, bindStatusAccessors, consumeStatus, getStatus, normalizeStatuses, POISON_TURNS, prepareStatusDamage, removeStatus, resolveStatusDamage, statusCounterText, statusSnapshot, tickStatusSnapshot } from './rules/statuses.js'
import { enemyFeatureDetailLabel } from './data/enemy-features.js'
import { getMerchantDefinition, merchantSellPrice, refreshMerchantSlot, refreshMerchantStock } from './data/merchants.js'
import { buildRelicChoices, getRelicDefinition, RELIC_DEFS } from './data/relics.js'
import { buildRoomRewardChoices } from './data/rewards.js'
import { LEVEL_UP_OPTIONS, PROGRESSION, buildLevelUpChoices, experienceToNextLevel, getLevelUpOption } from './data/progression.js'
import { getTrapDefinition } from './data/traps.js'
import { createChapterDungeon, Dungeon } from './model/dungeon.js'
import { BackpackGrid } from './model/backpack.js'
import { RelicCollection } from './model/relics.js'
import { resolveDamage } from './rules/modifiers.js'
import { ItemRules } from './rules/items.js'
import { ConsumableRules, consumableEnergyCost, isConsumable } from './rules/consumables.js'
import { TotemRules } from './rules/totems.js'
import { PetRules } from './rules/pets.js'
import { getTotemDefinition, isTotemBadge } from './data/totems.js'
import { TACTICAL_LAYOUT_LABELS } from './model/tactical-layouts.js'
import { RECIPES } from './data/content.js'
import { RelicEngine } from './rules/relics.js'
import { stepEnemy } from './rules/enemies.js'
import { findAttackPath, findDoorPath, findInteractionPath, findPath, findRevealPath } from './rules/pathfinding.js'
import { terrainDamageModifiers } from './rules/terrain.js'
import { suggestedSynergyId } from './rules/synergies.js'
import { isSummonedEnemy } from './data/enemies.js'
import { BASE_ACTION_ENERGY, BIG_ROUND_REVISION } from './data/big-round-migration.js'

// The design notation is rows × columns: four rows, eight columns.
export const INVENTORY_COLUMNS = 8
export const INVENTORY_ROWS = 4
export const INVENTORY_CAPACITY = INVENTORY_COLUMNS * INVENTORY_ROWS
export const RELIC_SOFT_LIMIT = Infinity
export const ENERGY_MAX = BASE_ACTION_ENERGY
export const TELEPORT_RANGE = 6
export const SAVE_KEY = 'grid_flip_adventure_v2'
// Pending attack turns must be recoverable in every accepted save.
export const SAVE_VERSION = 36

function clone(value) { return JSON.parse(JSON.stringify(value)) }

function compatibleSave(data) {
  const statusesValid = statuses => statuses && typeof statuses === 'object' && !Array.isArray(statuses) &&
    Object.entries(statuses).every(([id, status]) => status?.id === id && Number.isInteger(status.layers) && status.layers > 0 &&
      Number.isInteger(status.turns) && status.turns > 0 && typeof status.showLayers === 'boolean' && typeof status.showTurns === 'boolean')
  const itemValid = item => typeof item?.uid === 'string' && !!getItemDefinition(item.id) &&
    !getItemDefinition(item.id).disabled && item.type === getItemDefinition(item.id).type &&
    (item.type !== 'weapon' || item.tier === getItemDefinition(item.id).tier) &&
    (item.type !== 'potion' || (Number.isInteger(item.heal) && item.heal > 0 && item.heal <= getItemDefinition(item.id).heal))
  if (!data || data.version !== SAVE_VERSION || !data.dungeon || !data.player || !data.backpack ||
      !StaminaDeck.valid(data.staminaDeck) || !Array.isArray(data.battle?.knownEnemyIds) ||
      !statusesValid(data.player.statuses) || !Array.isArray(data.inventoryStash) ||
      !Array.isArray(data.backpack.placements) || !Array.isArray(data.dungeon.rooms) ||
      !Number.isInteger(data.turnCounters?.globalTurn) || data.turnCounters.globalTurn < 0 ||
      !Number.isInteger(data.turnCounters?.attackCount) || data.turnCounters.attackCount < 0) return false
  if (data.bigRoundRevision !== BIG_ROUND_REVISION || typeof data.battle?.active !== 'boolean' ||
      !Number.isInteger(data.battle.round) || data.battle.round < 0 ||
      !['explore', 'player', 'pets', 'enemy'].includes(data.battle.stage) ||
      (data.battle.active ? data.battle.stage === 'explore' || data.battle.round < 1 : data.battle.stage !== 'explore') ||
      typeof data.roundResolving !== 'boolean' || typeof data.pendingRoundEnd !== 'boolean' ||
      (data.battle.active && (data.battle.stage === 'pets' || data.battle.stage === 'enemy') && !data.roundResolving)) return false
  if (['poisonedTurns', 'poisonDamage', 'burningTurns', 'burningDamage', 'parry'].some(key => Object.hasOwn(data.player, key))) return false
  if (data.player.itemState && !statusesValid(data.player.itemState.buffs)) return false
  if (new Set(data.battle.knownEnemyIds).size !== data.battle.knownEnemyIds.length ||
      data.battle.knownEnemyIds.some(id => typeof id !== 'string')) return false
  const weaponState = data.player.itemState
  if (weaponState && (!weaponState.weaponUses || typeof weaponState.weaponUses !== 'object' || Array.isArray(weaponState.weaponUses) ||
      Object.values(weaponState.weaponUses).some(count => !Number.isInteger(count) || count < 0))) return false
  const petState = data.player.itemState?.pets
  if (petState && !['horn', 'prey', 'butcher'].every(key => Array.isArray(petState[key]) && petState[key].every(id => typeof id === 'string'))) return false
  const totems = data.dungeon.rooms.flatMap(room => (Array.isArray(room.entities) ? room.entities : [])
    .filter(entity => entity.kind === 'totem').map(entity => ({ room, entity })))
  if (new Set(totems.map(({ entity }) => entity.totemId)).size !== totems.length ||
      totems.some(({ room, entity }) => room.id !== data.player.roomId || !getTotemDefinition(entity.totemId) || getTotemDefinition(entity.totemId).disabled ||
        !Number.isInteger(entity.bornAt) || entity.lifetime !== 'battle' || Object.hasOwn(entity, 'expiresAt') ||
        !Number.isInteger(entity.nextPulse) || entity.nextPulse < entity.bornAt || !room.tiles?.[entity.pos?.r]?.[entity.pos?.c]?.revealed)) return false
  const totemState = data.player.itemState?.totems
  if (totems.length && !totemState) return false
  if (totemState && (!Number.isInteger(totemState.readyAt) || totemState.readyAt < 0 || !Number.isInteger(totemState.wardTurn))) return false
  const carried = [...data.backpack.placements.map(placement => placement.item), ...data.inventoryStash]
  if (!carried.every(itemValid) || new Set(carried.map(item => item.uid)).size !== carried.length) return false
  const grid = new BackpackGrid(data.backpack.columns, data.backpack.rows)
  if (grid.columns !== INVENTORY_COLUMNS || grid.rows !== INVENTORY_ROWS) return false
  for (const placement of data.backpack.placements) {
    if (!Number.isInteger(placement.rotation) || !grid.canPlace(placement.item, placement.x, placement.y, placement.rotation)) return false
    grid.placements.push(placement)
  }
  const relicValid = id => getRelicDefinition(id) && !getRelicDefinition(id).disabled
  if (!Array.isArray(data.initialRelicChoices) || !data.initialRelicChoices.every(relicValid)) return false
  return data.dungeon.rooms.every(room => Array.isArray(room.entities) && room.entities.every(entity =>
    (entity.kind !== 'enemy' || statusesValid(entity.statuses)) && (!entity.item || itemValid(entity.item)) &&
    (!entity.relicChoices || entity.relicChoices.every(relicValid)) &&
    (!entity.stock || entity.stock.every(stock => getItemDefinition(stock.itemId) && !getItemDefinition(stock.itemId).disabled))))
}

function shuffled(values, random) {
  const copy = [...values]
  for (let index = copy.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

function normalizedCounter(value) { return Math.max(0, Number(value) || 0) }

function damageReductionLog({ healthDamage = 0, absorbed = 0 } = {}) {
  const health = Math.max(0, Number(healthDamage) || 0)
  const armor = Math.max(0, Number(absorbed) || 0)
  if (health === 0) return `\u51cf${armor}\u7532`
  return armor > 0 ? `\u51cf${health}\u8840\uff0c\u51cf${armor}\u7532` : `\u51cf${health}\u8840`
}

function enemyStatusSnapshot(enemy) {
  return {
    ...clone(enemy),
    kind: 'enemy',
    id: enemy?.id,
    name: enemy?.name,
    hp: Math.max(0, Number(enemy?.hp) || 0),
    maxHp: Math.max(1, Number(enemy?.maxHp) || 1),
    boss: enemy?.boss === true,
    actionDelay: enemy?.actionDelay,
    initialActionDelay: enemy?.initialActionDelay,
    attackCooldown: enemy?.attackCooldown,
    attackCooldownMax: enemy?.attackCooldownMax,
  }
}

function playerDeathCause(context = {}) {
  const source = context.source || ''
  const enemyName = context.enemy?.name
  if (source === 'enemy:small-explosion') return enemyName ? `${enemyName}\u7684\u5c0f\u81ea\u7206` : '\u5c0f\u81ea\u7206'
  if (source === 'enemy:large-explosion') return enemyName ? `${enemyName}\u7684\u5927\u81ea\u7206` : '\u5927\u81ea\u7206'
  if (source === 'enemy:attack') return enemyName ? `${enemyName}\u7684\u653b\u51fb` : '\u654c\u4eba\u653b\u51fb'
  if (source === 'status:counter') return enemyName ? `${enemyName}\u7684\u53cd\u51fb` : '\u53cd\u51fb'
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

export class GameRun {
  constructor({ autoLoad = true, random = Math.random } = {}) {
    this.bus = createEmitter()
    this.on = this.bus.on
    this.off = this.bus.off
    this._itemRules = new ItemRules(this)
    this.consumables = new ConsumableRules(this)
    this.totems = new TotemRules(this)
    this.pets = new PetRules(this)
    this._turnInProgress = false
    this.battle = { active: false, stage: 'explore', round: 0 }
    this.roundResolving = false
    this.pendingRoundEnd = false
    this.turns = new TurnLedger()
    this._logRevealAnchor = null
    this.merchantEntering = false
    this.roomEntering = false
    this.combatResolving = false
    this.deathAnimationPending = false
    this.enemyDeathAnimationsPending = 0
    this.pendingAttackImpacts = null
    this.pendingAttackExplosions = null
    this.enemyAttackInterruptedRoute = false
    this.moveCompleteUnsubscribe = this.on('animate:move-complete', () => {
      if (!this.merchantEntering && !this.roomEntering) return
      this.merchantEntering = false
      this.roomEntering = false
      this._changed()
    })
    this.attackCompleteUnsubscribe = this.on('animate:attack-complete', ({ actor } = {}) => {
      if (actor === 'enemy' && this.deathAnimationPending) {
        this.deathAnimationPending = false
        this._changed()
      }
      if (actor !== 'player' || !this.combatResolving) return
      this.combatResolving = false
      this._endTurn({ turnKind: TURN_KINDS.ATTACK })
      this._changed()
    })
    this.impactCompleteUnsubscribe = this.on('animate:impact-complete', ({ target, defeated } = {}) => {
      if (defeated && target === 'player' && this.deathAnimationPending) this.deathAnimationPending = false
      if (defeated && target === 'enemy' && this.enemyDeathAnimationsPending > 0) this.enemyDeathAnimationsPending--
      this._changed()
    })
    this.explosionCompleteUnsubscribe = this.on('animate:explode-complete', ({ targetDefeated } = {}) => {
      if (this.enemyDeathAnimationsPending > 0) this.enemyDeathAnimationsPending--
      if (targetDefeated) this.deathAnimationPending = false
      this._changed()
    })
    this.roundCompleteUnsubscribe = this.on('animate:idle', () => {
      if (this.roundResolving && !this._turnInProgress) {
        this.roundResolving = false
        this._beginPlayerTurn()
        this._changed()
      }
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
    this._turnInProgress = false
    this.battle = { active: false, stage: 'explore', round: 0 }
    this.roundResolving = false
    this.pendingRoundEnd = false
    const generated = createChapterDungeon({ random: this.random })
    this.dungeon = generated.dungeon
    this.staminaDeck = new StaminaDeck(this.random)
    this.player = {
      hp: 20,
      maxHp: 20,
      armor: 0,
      gold: 0,
      roomId: generated.startRoomId,
      pos: { ...generated.start },
      level: PROGRESSION.startingLevel,
      experience: 0,
      experienceToNext: experienceToNextLevel(PROGRESSION.startingLevel),
      parry: null,
      poisonedTurns: 0,
      poisonDamage: 0,
      burningTurns: 0,
      burningDamage: 0,
      statuses: {},
      lastAttackPower: 0,
    }
    this._bindBallAccessors()
    bindStatusAccessors(this.player)
    this.backpack = new BackpackGrid(INVENTORY_COLUMNS, INVENTORY_ROWS)
    this.inventoryStash = []
    const starter = starterWeapon()
    if (!this.backpack.add(starter)) throw new Error('Unable to add starter weapon to backpack')
    this.backpack.add(makeItemById('money-pouch'))
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
    this.combatResolving = false
    this.deathAnimationPending = false
    this.enemyDeathAnimationsPending = 0
    this.pendingAttackImpacts = null
    this.pendingAttackExplosions = null
    this.enemyAttackInterruptedRoute = false
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
  isDoorRevealed(door) { return !!door && !this.doorEdge(door)?.sealed && (!this.isExitDoor(door) || door.discovered === true) }
  isDoorLocked(door) {
    const edge = this.doorEdge(door)
    if (!edge) return false
    if (edge.locked && !edge.unlocked) return true
    const source = this.dungeon.room(edge.fromRoomId)
    return source?.role === 'boss' && this.dungeon.room(edge.toRoomId)?.chapter > source.chapter
      && [...source.entities.values()].some((entity) => entity.kind === 'enemy' && entity.boss)
  }
  doorDestination(door) { return this.dungeon.room(this.dungeon.otherDoor(door)?.roomId) }
  activeRelics() { return this.relicEngine.activeDefinitions({ run: this }) }

  hasActiveRelic(id) { return this.activeRelics().some((relic) => relic.id === id) }

  relicCount() { return this.backpack?.items.filter((item) => item?.type === 'relic').length || 0 }
  relicOverload() { return Math.max(0, this.relicCount() - RELIC_SOFT_LIMIT) }
  canFitRelic(id) { return !!getRelicDefinition(id) && !getRelicDefinition(id).disabled && this.backpack.usedCells < this.backpack.capacity }

  get itemRules() { return this._itemRules }
  weaponRange(weapon, position) { return this.itemRules.range(weapon, position) }
  weaponEnergyCost(weapon) { return this.itemRules.cost(weapon) }
  energyAfterMovement(steps = 0) {
    if (!this.battle.active) return this.player.energy
    let energy = this.player.energy
    for (let index = 0; index < steps; index++) {
      // Distinguish an unreachable route from arriving with exactly zero energy.
      if (energy < 1) return -1
      const traveler = index === 0 && this.itemRules.has('r-traveler') && this.itemRules.state.lastAction === 'attack' ? 1 : 0
      energy = Math.min(this.player.maxEnergy, energy - 1 + traveler)
    }
    return energy
  }

  _activatedEnemies() {
    const room = this.currentRoom
    return room ? [...room.entities.values()].filter(entity => entity.kind === 'enemy' && room.isRevealed(entity.pos)) : []
  }

  _bindBallAccessors() {
    // Derived counts support routing; the deck is the only persisted resource.
    Object.defineProperties(this.player, {
      energy: { configurable: true, get: () => this.staminaDeck.hand.length },
      maxEnergy: { configurable: true, get: () => Math.max(this.staminaDeck.supply, this.staminaDeck.hand.length) },
    })
  }

  toggleStaminaBall(id) {
    if (!this._canAct() || !this.battle.active || this.battle.stage !== 'player') return false
    const changed = this.staminaDeck.toggle(id)
    if (changed) this._changed()
    return changed
  }

  weaponPayment(weapon) { return this.staminaDeck.plan(this.weaponEnergyCost(weapon), weapon.attribute) }

  _synchronizeBattle() {
    const active = this._activatedEnemies().length > 0 && !this.gameOver
    if (active && !this.battle.active) {
      this.battle = { active: true, stage: 'player', round: 1, knownEnemyIds: this._activatedEnemies().map(enemy => enemy.id) }
      this.itemRules.startPlayerTurn()
      this.staminaDeck.startTurn(this._activatedEnemies().length)
      this._log(`进入战斗，抽取${this.player.energy}个体力球。`)
      this.bus.emit('battle:started', { round: 1 })
    } else if (active && this.battle.active) {
      this.battle.knownEnemyIds ||= []
      for (const enemy of this._activatedEnemies()) {
        if (this.battle.knownEnemyIds.includes(enemy.id)) continue
        this.battle.knownEnemyIds.push(enemy.id)
        if (this.battle.stage === 'player') this.staminaDeck.supplement()
      }
    } else if (!active && this.battle.active) {
      this.battle.active = false
      this.battle.stage = 'explore'
      this.staminaDeck.discardHand()
      this.itemRules.endBattle()
      this.pendingRoundEnd = false
      this.pets.endTurn()
      this.totems.endBattle()
      if (!this.gameOver) this._log('已清除当前激活敌人，返回探索。')
      this.bus.emit('battle:ended', { round: this.battle.round })
    }
    return active
  }

  _beginPlayerTurn() {
    if (!this._synchronizeBattle()) return
    this.battle.stage = 'player'
    this.battle.round += 1
    this.itemRules.startPlayerTurn()
    this.staminaDeck.startTurn(this._activatedEnemies().length)
    this.itemRules.action('turn-start')
    this.pendingRoundEnd = false
    this.bus.emit('player-turn:started', { round: this.battle.round })
  }

  actionEnergyCost(amount = 1) { return this.battle.active ? Math.max(0, amount) : 0 }

  canPayAction(amount = 1) {
    return !this.battle.active || (this.battle.stage === 'player' && !this.roundResolving && this.player.energy >= amount)
  }

  _payAction(amount = 1) {
    return this.canPayAction(amount) && this._spendEnergy(this.actionEnergyCost(amount))
  }

  endPlayerTurn() {
    if (!this._canAct() || !this.battle.active || this.battle.stage !== 'player') return false
    this.itemTargeting = false
    this._resolveBattleRound()
    this._changed()
    return true
  }

  _recoverEnergy(amount = 0) {
    if (this.battle.active && this.battle.stage === 'player') this.staminaDeck.draw(Math.max(0, Math.floor(Number(amount) || 0)))
    return this.player.energy
  }

  _spendEnergy(amount = 0) { return !!this.staminaDeck.pay(amount) }

  getStatus(actor, id) { return getStatus(actor, id) }

  applyStatus(actor, id, options = {}, refreshOptions = {}) {
    return applyStatus(actor, id, prepareStatusDamage(options, { run: this, holder: actor, stage: 'gain' }), refreshOptions)
  }

  updateStatus(actor, id, changes = {}) {
    const status = getStatus(actor, id)
    if (!status) return null
    Object.assign(status, prepareStatusDamage(changes, { run: this, holder: actor, stage: 'gain' }))
    normalizeStatuses(actor)
    return getStatus(actor, id)
  }

  removeStatus(actor, id) { removeStatus(actor, id) }

  _statusClockSnapshot() {
    const actors = [this.player, ...this._activatedEnemies()]
    return [...actors.flatMap(statusSnapshot), ...statusSnapshot({ statuses: this.itemRules.state.buffs })]
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

  countFlippableCards(room = this.currentRoom) {
    if (!room) return 0
    const revealDistance = 1
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
    this._activateRevealedEnemy(room, enemy)
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

  get merchantEntity() { return this.merchant ? this.currentRoom?.entity(this.merchant.entityId) || null : null }
  get merchantDefinition() { return getMerchantDefinition(this.merchantEntity?.merchantId) }

  canSellAtMerchant() { return this.phase === 'merchant' && this.merchantDefinition?.services.includes('sell') }

  _drawRoomRewardType() {
    if (!this.roomRewardBag.length) this.roomRewardBag = shuffled(['supply', 'supply', 'supply', 'relic'], this.random)
    return this.roomRewardBag.shift() || 'supply'
  }

  _queueLevelUp() {
    if (this.levelUp || this.gameOver || this.player.experience < this.player.experienceToNext) return false
    const choices = buildLevelUpChoices({ random: this.random })
    // Missing targets must never leave an upgrade blocked.
    if (!choices.some(id => this.canChooseLevelUpOption(id))) {
      const available = LEVEL_UP_OPTIONS.filter(option => this.canChooseLevelUpOption(option.id))
      choices[0] = available[Math.floor(this.random() * available.length)].id
    }
    this.levelUp = { choices }
    this.phase = 'level-up'
    this._log(`\u5347\u81f3 ${this.player.level + 1} \u7ea7\uff0c\u8bf7\u9009\u62e9\u6210\u957f\u3002`)
    return true
  }

  _gainExperience(enemy) {
    const amount = Math.max(0, Number(enemy?.experience) || 0)
    if (!amount || enemy?.noExperience || isSummonedEnemy(enemy) || enemy?.finalBoss) return false
    this.player.experience += amount
    this._log(`\u83b7\u5f97 ${amount} \u7ecf\u9a8c\u3002`)
    return this._queueLevelUp()
  }

  chooseLevelUpOption(id) {
    if (this.phase !== 'level-up' || this.levelUp?.selectedOption || !this.levelUp?.choices.includes(id) || !this.canChooseLevelUpOption(id)) return false
    if (id === 'relic' || id === 'weapon-upgrade') {
      if (id === 'relic' && !this.levelUp.relicChoices) {
        this.levelUp.relicChoices = buildRelicChoices(this.relics, { random: this.random }).map(relic => relic.id)
      }
      this.levelUp.selectedOption = id
      this._changed()
      return true
    }
    return this._applyLevelUpOption(id)
  }

  canChooseLevelUpOption(id) {
    const option = getLevelUpOption(id)
    if (!option || option.disabled) return false
    if (id === 'weapon-upgrade') return this.backpack.items.some(item => item.type === 'weapon')
    if (id === 'relic') return RELIC_DEFS.some(relic => !relic.disabled && !this.relics.has(relic.id))
    return true
  }

  _activateRevealedEnemy(room, enemy) {
    if (room?.id !== this.currentRoom?.id || !enemy) return
    this._synchronizeBattle()
    if (enemy.behavior !== 'ambush' || enemy.ambushTriggered) return
    enemy.ambushTriggered = true
    if (combatDistance(this.player.pos, enemy.pos, enemy.range) > enemy.range) return
    this._log(`${enemy.name}立即发动伏击。`)
    const outcome = this._enemyAttack(enemy)
    if (!outcome.cancelled && this.currentRoom.entity(enemy.id)) {
      this._onEnemyAction(enemy)
      enemy.attackCooldown = 0
      enemy.actionDelay = 0
    }
  }

  backToLevelUpChoices() {
    if (this.phase !== 'level-up' || !this.levelUp?.selectedOption) return false
    delete this.levelUp.selectedOption
    this._changed()
    return true
  }

  chooseLevelUpRelic(id) {
    if (this.phase !== 'level-up' || this.levelUp?.selectedOption !== 'relic' || !this.levelUp.relicChoices?.includes(id)) return false
    if (!this.acquireRelic(id, { notify: false, allowStash: true })) return false
    this._finishLevelUp()
    return true
  }

  levelUpWeapons() { return this.backpack.items.filter(item => item.type === 'weapon') }

  chooseLevelUpWeapon(uid) {
    if (this.phase !== 'level-up' || this.levelUp?.selectedOption !== 'weapon-upgrade') return false
    const weapon = this.levelUpWeapons().find(item => item.uid === uid)
    if (!weapon) return false
    weapon.attack += 1
    weapon.reinforcement = (weapon.reinforcement || 0) + 1
    this._log(`${weapon.name}\u57fa\u7840\u653b\u51fb\u529b+1\u3002`)
    this._finishLevelUp()
    return true
  }

  _applyLevelUpOption(id) {
    if (id === 'heal') this._healPlayer(5, { source: 'level-up:heal' })
    else if (id === 'max-health') this.player.maxHp += 2
    else if (id === 'wild-ball') this.staminaDeck.add('wild')
    else return false
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
    this.pendingRoundEnd = false
    this._changed()
  }

  levelUpChoices() {
    return (this.levelUp?.choices || []).map((id) => getLevelUpOption(id)).filter(Boolean)
  }

  showItemDetail(item) {
    if (!item) return false
    const detail = detailForItem(item, this.player)
    if (item.type === 'weapon' && this.backpack.placementOf(item.uid)) {
      detail.statLines[0] = `\u2694 ${item.attack || 0}`
      detail.statLines[1] = `\u{1F3F9} ${this.weaponRange(item)}`
      detail.energyCost = this.weaponEnergyCost(item)
      detail.effectLines.push(...this.itemRules.weaponLines(item))
    }
    if (item.type === 'pet' && this.backpack.placementOf(item.uid)) {
      detail.statLines[1] = `\u5c04\u7a0b ${this.pets.range(item)}`
      detail.energyCost = this.pets.cost(item)
    }
    if (isConsumable(item) && this.backpack.placementOf(item.uid)) {
      if (this.consumables.boosted(item, true)) detail.effectLines.push('投掷器：主动使用额外消耗2体力，伤害效果×1.5')
      if (this.consumables.chainPlan(item).length) detail.effectLines.push('连饮环：按8邻域顺时针免费使用后续消耗品；整次连锁在战斗中消耗1体力')
    }
    detail.lines = [...detail.statLines, ...detail.effectLines]
    if (isTotemBadge(item)) {
      const active = this.totems.active(item.totemId)
      detail.lines.push('召唤范围4；战斗中消耗1个任意体力球；战斗结束消失；所有图腾徽章共享2个大回合冷却')
      detail.lines.push(active ? '图腾已存在，保留到本次或下一次战斗结束' :
        this.totems.cooldown ? `召唤冷却：剩余${this.totems.cooldown}回合` : '点击使用，再选择场地中的空格召唤')
    }
    return this._showDetail({ position: 'top', ...detail })
  }

  showRelicDetail(id) {
    const definition = getRelicDefinition(id)
    if (!definition) return false
    return this._showDetail({
      position: 'top',
      title: definition.name,
      type: DETAIL_LABELS.relic,
      icon: 'relic',
      itemId: definition.id,
      description: definition.description,
    })
  }

  showBoardDetail(position) {
    const room = this.currentRoom
    if (!room?.contains(position) || !room.isRevealed(position)) return false
    if (this.player.pos.c === position.c && this.player.pos.r === position.r) return false
    const entity = room.entityAt(position)
    if (!entity || entity.kind === 'stairs') return false
    if (entity.kind === 'item') return this._showDetail({ position: 'bottom', ...detailForItem(entity.item, this.player) })
    if (entity.kind === 'totem') return this._showDetail({ position: 'bottom', title: entity.name, type: '图腾', icon: 'relic',
      description: getTotemDefinition(entity.totemId)?.description || '', lines: [
        '保留到本次或下一次战斗结束', '受到一次攻击或离开房间即消失',
        ...(entity.totemId === 'soul' ? [`影响范围${1 + this.totems.badges.filter(item => item.totemId !== 'soul').length}`] : []),
      ] })
    if (entity.kind === 'enemy') {
      const features = enemyFeatureDetailLabel(entity)
      const lines = [
        `${DETAIL_LABELS.health} ${entity.hp}/${entity.maxHp}`,
        `${DETAIL_LABELS.speed} ${entity.speed || 0} 格／回合`,
        `${DETAIL_LABELS.normalAttack} ${this.itemRules.expansion.enemyAttackDamage(entity, entity.attack)} \u00b7 ${DETAIL_LABELS.range} ${entity.range || 1}`,
        `${DETAIL_LABELS.actionDelay} ${normalizedCounter(entity.actionDelay)}`,
        `${DETAIL_LABELS.normalAttackCooldown} 无，每个敌人阶段可攻击一次`,
      ]
      if (features) lines.push(`${DETAIL_LABELS.features} ${features}`)
      const poison = getStatus(entity, 'enemy-poison')
      if (getStatus(entity, 'rooted')) lines.push('缠绕：不能移动或攻击，持续1回合')
      if (poison && this.itemRules.has('r-bone-incense')) lines.push('蚀骨香：中毒时攻击力减半')
      if (poison) lines.push([`中毒：每个敌人阶段开始时失去${poison.damage}生命`, statusCounterText(poison)].filter(Boolean).join('\uff0c'))
      for (const id of ['counter', 'dodge']) {
        const status = getStatus(entity, id)
        if (status) {
          const damage = typeof status.damage === 'number' ? String(status.damage)
            : status.damage?.mode === 'incoming-attack' ? `${Math.round((status.damage.ratio ?? 1) * 100)}%\u672c\u6b21\u653b\u51fb\u4f24\u5bb3` : '\u89e6\u53d1\u65f6\u8ba1\u7b97'
          lines.push([status.name, id === 'counter' ? `\u53cd\u51fb\u4f24\u5bb3 ${damage}` : '\u89c4\u907f\u4e00\u6b21\u653b\u51fb', statusCounterText(status)].filter(Boolean).join('\uff1b'))
        }
      }
      if (entity.nextAttackReduction > 0) lines.push(`应变削弱：下一次普通攻击伤害-${entity.nextAttackReduction}`)
      if (entity.burningTurns > 0) lines.push(`\u653b\u51fb\u9644\u52a0\u71c3\u70e7 ${entity.burningTurns} \u4e2a\u5168\u5c40\u56de\u5408 \u00b7 \u6bcf\u56de\u5408 ${entity.burningDamage || 1} \u70b9`)
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
    this.detailPanel = {
      ...detail,
      badges: [...(detail.badges || [])],
      statLines: [...(detail.statLines || [])],
      effectLines: [...(detail.effectLines || [])],
      lines: [...(detail.lines || [])],
    }
    this.bus.emit('detail')
    return true
  }

  _emitRelicEvent(event, context = {}) {
    if (event === 'enemy:killed') this.pets.onKill(context.enemy, context.source)
    if (event === 'room:left') this.totems.leave(context.room)
    if (event === 'enemy:killed') this.totems.onKill(context.enemy)
    this.itemRules.expansion.onEvent(event, context)
    const actions = this.relicEngine.emit(event, { run: this, event, ...context })
    this.relicEventQueue.push(...actions.filter((action) => action && typeof action === 'object'))
    while (this.relicEventQueue.length) {
      const action = this.relicEventQueue.shift()
      if (action.type === 'heal') this._healPlayer(action.amount, { source: action.source || `relic:${event}` })
      if (action.type === 'armor') this.player.armor += Math.max(0, action.amount || 0)
      if (action.type === 'gold') this.player.gold += Math.max(0, Math.floor(action.amount || 0))
      if (action.type === 'energy') this._recoverEnergy(action.amount)
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

  acquireRelic(id, { notify = true, allowStash = false } = {}) {
    const definition = getRelicDefinition(id)
    if (!definition || definition.disabled) return this._reject('\u672a\u77e5\u5723\u9057\u7269\u3002')
    if (this.relics.has(id)) return this._reject('\u6b64\u5723\u9057\u7269\u5df2\u5728\u80cc\u5305\u4e2d\u3002')
    const item = makeRelicItem(definition)
    if (!item) return this._reject('\u65e0\u6cd5\u521b\u5efa\u5723\u9057\u7269\u3002')
    const placement = this.backpack.add(item)
    if (!placement) {
      if (!allowStash) return this._reject('\u80cc\u5305\u6ca1\u6709\u8db3\u591f\u7a7a\u95f4\u3002')
      this.inventoryStash.push(item)
    }
    const entry = this.relics.acquire(id, { uid: item.uid })
    if (!entry) {
      this.backpack.removeByUid(item.uid)
      this.inventoryStash = this.inventoryStash.filter((stashed) => stashed.uid !== item.uid)
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
    const revealDistance = 1
    return !!room && !room.isRevealed(position) && !!findRevealPath(room, this.player.pos, position, { distance: revealDistance })
  }

  previewTileAction(c, r) {
    if (!this._canAct()) return null
    const room = this.currentRoom
    const target = { c, r }
    if (!room?.contains(target)) return null
    if (this.itemTargeting) return null
    if (target.c === this.player.pos.c && target.r === this.player.pos.r && !room.entityAt(target)) return null
    if (!room.isRevealed(target)) {
      const revealDistance = 1
      const route = findRevealPath(room, this.player.pos, target, { distance: revealDistance })
      return route && (!this.battle.active || this.energyAfterMovement(route.path.length, route.path) >= 1) ? this._pathPreview('flip', target, route.path) : null
    }
    const entity = room.entityAt(target)
    if (!entity) {
      const path = findPath(room, this.player.pos, target)
      return path ? this._pathPreview('move', target, path) : null
    }
    if (entity.kind === 'enemy') {
      const selectedWeapon = this.selectedItem
      if (selectedWeapon?.type !== 'weapon') return null
      const route = this._weaponRoute(selectedWeapon, entity)
      if (!route || this.energyAfterMovement(route.path.length, route.path) < 1 || !this.weaponPayment(selectedWeapon)) return null
      return this._pathPreview('attack', target, route.path)
    }
    if (entity.kind === 'merchant') {
      const route = findInteractionPath(room, this.player.pos, entity)
      return route ? this._pathPreview('merchant', target, route.path) : null
    }
    if (entity.kind === 'trap' || entity.kind === 'totem') return null
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
    if (!this._canSelectInventory() || this.itemTargeting) return false
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
    const placement = this.backpack.placementOf(item.uid)
    const preview = this.previewInventoryDrop(item.uid, index, { rotation: placement.rotation })
    if (!preview || preview.status !== 'move' || (preview.x === placement.x && preview.y === placement.y)) return false
    const moved = this.backpack.move(item.uid, preview.x, preview.y, preview.rotation)
    if (!moved) return false
    this._endInventoryTurn()
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
    return this.previewInventoryDrop(selected.uid, index, { rotation: selectedPlacement.rotation })?.status === 'move' ? 'move' : 'blocked'
  }

  previewInventoryDrop(itemOrUid, index, { rotation = null } = {}) {
    if (!Number.isInteger(index)) return null
    const item = typeof itemOrUid === 'object' ? itemOrUid : this.backpack.placementOf(itemOrUid)?.item
    if (!item) return null
    const placement = this.backpack.placementOf(item.uid)
    const nextRotation = rotation == null ? placement?.rotation || 0 : ((rotation % 4) + 4) % 4
    if (index < 0 || index >= INVENTORY_CAPACITY) return { status: 'blocked', conflicts: [], item, index, rotation: nextRotation }
    const origin = this.backpack.originForAnchorCell(item, index, nextRotation)
    if (!origin) return { status: 'blocked', conflicts: [], item, index, rotation: nextRotation }
    const shape = this.backpack.shapeFor(item, nextRotation)
    const cells = this.backpack.cellsFor(item, origin.x, origin.y, nextRotation)
    const inBounds = origin.x >= 0 && origin.y >= 0 && origin.x + shape[0].length <= INVENTORY_COLUMNS && origin.y + shape.length <= INVENTORY_ROWS
    if (!inBounds) return { status: 'blocked', conflicts: [], item, index, x: origin.x, y: origin.y, rotation: nextRotation, cells }
    const conflicts = this.backpack.placements.filter((candidate) => candidate.item?.uid !== item.uid
      && this.backpack.cellsForPlacement(candidate).some((occupied) => cells.some((cell) => cell.x === occupied.x && cell.y === occupied.y)))
    return {
      status: conflicts.length ? 'replace' : 'move',
      conflicts,
      item,
      index,
      x: origin.x,
      y: origin.y,
      rotation: nextRotation,
      cells,
    }
  }

  _applyInventoryDrop(itemOrUid, index, { rotation = null, replace = false } = {}) {
    if (!this._canOrganizeBackpack()) return null
    const preview = this.previewInventoryDrop(itemOrUid, index, { rotation })
    if (!preview || preview.status === 'blocked' || (!replace && preview.conflicts.length)) return null
    const item = preview.item
    const conflicts = preview.conflicts.map((placement) => placement.item)
    const originalPlacements = this.backpack.placements.map((placement) => ({ ...placement }))
    for (const conflict of conflicts) this.backpack.removeByUid(conflict.uid)
    const placement = this.backpack.placementOf(item.uid)
    if (placement) {
      if (!this.backpack.move(item.uid, preview.x, preview.y, preview.rotation)) {
        this.backpack.placements = originalPlacements
        return null
      }
    } else {
      this.unstageInventoryItem(item, { notify: false })
      this.backpack.placements.push({ item, x: preview.x, y: preview.y, rotation: preview.rotation })
      item.bagRotation = preview.rotation
    }
    return { item, conflicts, preview }
  }

  commitInventoryDrop(itemOrUid, index, { rotation = null } = {}) {
    return commitInventoryDrop(this, itemOrUid, index, { rotation })
  }

  moveInventoryToStash(itemOrUid, { rotation = null } = {}) {
    return moveInventoryToStash(this, itemOrUid, { rotation })
  }

  setStashedInventoryRotation(itemOrUid, rotation) {
    if (!this._canOrganizeBackpack() || this.itemTargeting || !Number.isInteger(rotation)) return false
    const uid = typeof itemOrUid === 'object' ? itemOrUid?.uid : itemOrUid
    const item = this.inventoryStash.find((candidate) => candidate?.uid === uid)
    if (!item) return false
    const nextRotation = ((rotation % 4) + 4) % 4
    if (((Number(item.bagRotation) || 0) % 4 + 4) % 4 !== nextRotation) {
      item.bagRotation = nextRotation
      this._changed()
    }
    return true
  }

  _finishInventoryAction() {
    if (!this._canOrganizeBackpack()) return false
    this._endInventoryTurn()
    this.selectedInventoryIndex = null
    this.itemTargeting = false
    this._changed()
    return true
  }

  _endInventoryTurn() {
    if (!['level-up', 'reward', 'merchant'].includes(this.phase)) {
      this._payAction(1)
      return this._endTurn({ action: 'organize' })
    }
    if (this.phase !== 'level-up') return
    // Inventory management during a reward choice keeps the world paused.
    // Removing the last weapon must not strand its nested selection or leave
    // a choice set with unavailable targets.
    if (this.levelUp.selectedOption === 'weapon-upgrade' && !this.levelUpWeapons().length) delete this.levelUp.selectedOption
    if (!this.levelUp.choices.some(id => this.canChooseLevelUpOption(id))) this.levelUp.choices[0] = 'heal'
  }

  stageInventoryItem(item, { notify = true } = {}) {
    if (!item?.uid || this.inventoryStash.some((stashed) => stashed.uid === item.uid)) return false
    this.inventoryStash.push(item)
    if (notify) this._changed()
    return true
  }

  unstageInventoryItem(itemOrUid, { notify = true } = {}) {
    const uid = typeof itemOrUid === 'object' ? itemOrUid?.uid : itemOrUid
    const index = this.inventoryStash.findIndex((item) => item?.uid === uid)
    if (index < 0) return null
    const [item] = this.inventoryStash.splice(index, 1)
    if (notify) this._changed()
    return item
  }

  discardInventoryItem(itemOrUid, { notify = true } = {}) {
    return discardInventoryItem(this, itemOrUid, { notify })
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

  discardSelected() {
    const item = this.selectedItem
    if (!item || !this.discardInventoryItem(item, { notify: false })) return false
    this.selectedInventoryIndex = null
    this.itemTargeting = false
    this._changed()
    return true
  }

  availableRecipes() {
    return RECIPES.filter(recipe => this.backpack.items.some(i => i.id === recipe.a) && this.backpack.items.some(i => i.id === recipe.b))
      .map(recipe => ({ ...recipe, canFit: this._craftPreview(recipe)?.canFit === true }))
  }

  _craftPreview(recipe) {
    const a = this.backpack.items.find(i => i.id === recipe.a)
    const b = this.backpack.items.find(i => i.id === recipe.b)
    if (!a || !b || a.uid === b.uid) return null
    const preview = new BackpackGrid()
    preview.restore(this.backpack.serialize(item => ({ ...item })))
    preview.removeByUid(a.uid)
    preview.removeByUid(b.uid)
    const result = { ...getItemDefinition(recipe.result), uid: 'craft-preview' }
    return { a, b, result, canFit: preview.canFit(result) }
  }

  craft(recipeIdOrResult) {
    if (this.phase === 'level-up' || !this._canOrganizeBackpack() || this.itemTargeting) return false
    const candidates = RECIPES.filter(recipe => recipe.id === recipeIdOrResult || recipe.result === recipeIdOrResult)
    let recipe = null, preview = null
    for (const candidate of candidates) {
      const candidatePreview = this._craftPreview(candidate)
      if (!candidatePreview) continue
      recipe = candidate; preview = candidatePreview; break
    }
    if (!preview) return this._reject('材料不足。')
    if (!this._payAction(1)) return this._reject('体力不足。')
    this.backpack.removeByUid(preview.a.uid)
    this.backpack.removeByUid(preview.b.uid)
    const result = makeItemById(recipe.result)
    const placement = this.backpack.add(result)
    if (!placement) this.stageInventoryItem(result, { notify: false })
    this.selectedInventoryIndex = placement ? this.backpack.originIndex(placement) : null
    this._log(`合成：${preview.a.name} + ${preview.b.name} = ${result.name}。`)
    this._endTurn({ action: 'craft' })
    this._changed()
    return true
  }

  useSelected() {
    const item = this.selectedItem
    if (!item || !this._canAct()) return false
    if (isTotemBadge(item)) {
      if (!this.totems.available(item)) return this._reject('该图腾徽章当前不能召唤。')
      this.itemTargeting = true
      this._log('请选择距离4以内已翻开的空格召唤图腾。')
      this._changed()
      return true
    }
    if (!isConsumable(item)) return false
    if (item.type === 'throwable') {
      this.itemTargeting = true
      this._log(`\u9009\u62e9${item.range || 4}\u683c\u5185\u7684${item.effect === 'explosion' ? '\u5df2\u7ffb\u5f00\u683c\u5b50' : '\u654c\u4eba'}\u6295\u63b7${item.name}\u3002`)
      this._changed()
      return true
    }
    if (item.type === 'teleport') {
      this.itemTargeting = true
      this._log(`\u9009\u62e9\u8ddd\u79bb${TELEPORT_RANGE}\u4ee5\u5185\u7684\u5df2\u7ffb\u5f00\u7a7a\u683c\uff1b\u70b9\u51fb\u4f7f\u7528\u53ef\u7ee7\u7eed\u9009\u53d6\uff0c\u53d6\u6d88\u9009\u62e9\u53ef\u9000\u51fa\u3002`)
      this._changed()
      return true
    }
    return this._consumeItems(item)
  }

  _consumeItems(item, position = null) {
    if (!isConsumable(item) || !this.backpack.placementOf(item.uid)) return false
    if (this.consumables.target(item, position, true) === false) return this._reject('请选择有效目标。')
    const baseCost = consumableEnergyCost(item)
    const cost = baseCost + (this.consumables.boosted(item, true) ? 2 : 0)
    if (!this.canPayAction(cost) || !this._payAction(baseCost)) return this._reject('体力不足。')
    if (!this.consumables.useSequence(item, position)) return false
    this._endTurn({ action: item.type === 'teleport' ? 'teleport' : 'consume' })
    this._changed()
    return true
  }

  _throwConsumable(position) {
    return this._consumeItems(this.selectedItem, position)
  }

  _teleport(position) {
    return this._consumeItems(this.selectedItem, position)
  }

  clickTile(c, r) {
    if (!this._canAct()) return false
    const room = this.currentRoom
    const position = { c, r }
    if (!room?.contains(position)) return false
    if (this.itemTargeting && isTotemBadge(this.selectedItem)) return this.totems.summon(this.selectedItem, position)
    if (this.itemTargeting && this.selectedItem?.type === 'teleport') return this._teleport(position)
    if (this.itemTargeting && this.selectedItem?.type === 'throwable') return this._throwConsumable(position)
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
    if (entity.kind === 'trap' || entity.kind === 'totem') return false
    return this._pickUp(entity)
  }

  clickDoor(doorId) {
    if (this.itemTargeting) return false
    if (!this._canAct()) return false
    const door = this.dungeon.door(doorId)
    if (!door || door.roomId !== this.currentRoom?.id || !this.isDoorRevealed(door)) return false
    return this._useDoor(door)
  }

  _interactMerchant(merchant) {
    if (this.battle.active) return this._reject('请先解决当前已激活的敌人。')
    const route = findInteractionPath(this.currentRoom, this.player.pos, merchant)
    if (!route) return this._reject('\u65e0\u6cd5\u9760\u8fd1\u8fd9\u4f4d\u5546\u4eba\u3002')
    this.merchantEntering = route.path.length > 0
    const movement = this._walk(route.path)
    if (!movement.stopped) this._endTurn({ turnKind: TURN_KINDS.ACTION })
    if (movement.stopped || this.gameOver || this.phase !== 'explore') this.merchantEntering = false
    if (!movement.stopped && !this.gameOver && this.phase === 'explore') {
      this.merchant = { entityId: merchant.id }
      if (this.merchantDefinition?.services.includes('relic-choice') && !merchant.relicOfferResolved) {
        merchant.relicChoices = buildRelicChoices(this.relics, {
          random: this.random,
          preferredId: suggestedSynergyId(this.backpack.items, 'relic', this.random),
        }).map((relic) => relic.id)
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

  merchantPrice(stock) {
    const discount = Number(this.backpack.items.some((item) => item.id === 'r-trade-voucher'))
    return Math.max(1, (Number(stock?.price) || 0) - discount)
  }

  merchantRestockPrice(merchant = this.merchantEntity) {
    const base = Number(merchant?.restockPrice) || 0
    if (base <= 0) return 0
    return Math.max(1, base - (this.backpack.items.some((item) => item.id === 'r-ledger') ? 2 : 0))
  }

  buyMerchantItem(index) {
    const merchant = this.merchantEntity
    const stock = merchant?.stock?.[index]
    const definition = getItemDefinition(stock?.itemId)
    if (this.phase !== 'merchant' || !merchant || !stock || !definition || definition.disabled) return false
    const price = this.merchantPrice(stock)
    if (this.player.gold < price) return this._reject('\u91d1\u5e01\u4e0d\u8db3\u3002')
    const item = makeItemById(stock.itemId)
    if (!item) return false
    if (!this.backpack.canFit(item)) return this._reject('\u80cc\u5305\u6ca1\u6709\u8db3\u591f\u7a7a\u95f4\u3002')
    if (item.type === 'relic' && this.relics.has(item.relicId)) return this._reject('已经持有此圣遗物。')
    this.player.gold -= price
    if (item.type === 'relic') this.acquireRelic(item.relicId, { notify: false })
    else this._putInInventory(item)
    this._log(`\u8d2d\u4e70 ${item.name}\uff0c\u82b1\u8d39 ${price} \u91d1\u5e01\u3002`)
    refreshMerchantSlot(merchant, this.currentRoom.progressionFloor, index, this.random)
    this._changed()
    return true
  }

  refreshMerchantInventory() {
    const merchant = this.merchantEntity
    const price = this.merchantRestockPrice(merchant)
    if (this.phase !== 'merchant' || !merchant || price <= 0) return false
    if (this.player.gold < price) return this._reject('\u91d1\u5e01\u4e0d\u8db3\u3002')
    if (!refreshMerchantStock(merchant, this.currentRoom.progressionFloor, this.random)) return false
    this.player.gold -= price
    this._log(`\u82b1\u8d39 ${price} \u91d1\u5e01\u5237\u65b0\u4e86\u8d27\u67b6\u3002`)
    this._changed()
    return true
  }

  sellSelectedMerchantItem() {
    if (!this.canSellAtMerchant()) return false
    const item = this.selectedItem
    if (!item) return this._reject('\u8bf7\u5148\u9009\u4e2d\u8981\u51fa\u552e\u7684\u7269\u54c1\u3002')
    if (item.sellable === false || item.id === 'money-pouch') return false
    const price = merchantSellPrice(item)
    this.itemRules.discarded(item)
    this.backpack.removeByUid(item.uid)
    if (item.type === 'relic') this.relics.remove(item.uid) || this.relics.remove(item.relicId)
    this.itemRules.action('organize')
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
      const entry = this.acquireRelic(choice.relicId, { notify: false, allowStash: true })
      if (!entry) return false
    } else if (choice.kind === 'item') {
      if (getItemDefinition(choice.itemId)?.disabled) return false
      const item = makeItemById(choice.itemId)
      if (!item) return false
      if (!this._putInInventory(item)) this.stageInventoryItem(item, { notify: false })
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

  _flipAt(position) {
    const revealDistance = 1
    const route = findRevealPath(this.currentRoom, this.player.pos, position, { distance: revealDistance })
    if (!route) return this._reject('\u65e0\u6cd5\u8d70\u5230\u8fd9\u5f20\u724c\u7684\u9644\u8fd1\u3002')
    if (this.battle.active && this.energyAfterMovement(route.path.length, route.path) < 1) return this._reject('体力不足。')
    const start = { ...this.player.pos }
    const movement = this._walk(route.path)
    if (!movement.stopped) {
      if (!this._payAction(1)) return this._reject('体力不足。')
      if (this.player.pos.c !== start.c || this.player.pos.r !== start.r) this.bus.emit('change')
      this._revealTile(position, { logReveal: true })
    }
    if (!movement.stopped) this._endTurn({ turnKind: TURN_KINDS.ACTION })
    this._changed()
    return true
  }

  _revealTile(position, { cause = 'player', logReveal = false } = {}) {
    const room = this.currentRoom
    const wasFlippable = this.tileCanBeFlipped(position)
    if (!room?.reveal(position)) return false
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
      if (entity?.kind === 'enemy') {
        this._activateRevealedEnemy(room, entity)
        this._emitRelicEvent('enemy:revealed', { enemy: entity, room, cause })
        this._triggerEnemyAlert(room, entity)
      }
      if (entity?.kind === 'trap') return this._triggerTrap(entity, { cause })
      return true
    } finally {
      this._logRevealAnchor = previousRevealAnchor
    }
  }

  _triggerTrap(trap, { cause = 'player' } = {}) {
    const room = this.currentRoom
    const definition = getTrapDefinition(trap.trapId)
    if (!room || !definition || trap.triggered === true) return false
    if (!this.suppressedTrapIds) this.suppressedTrapIds = new Set()
    this.suppressedTrapIds.delete(trap.id)
    this._emitRelicEvent('trap:before-trigger', { trap, definition, cause })
    if (this.suppressedTrapIds.has(trap.id)) {
      room.removeEntity(trap.id)
      this.suppressedTrapIds.delete(trap.id)
      this._log(`${definition.name}\u88ab\u5b89\u5168\u62c6\u9664\u3002`)
      return true
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
      }
      this._animateEnemyRevealBatch(room, flips)
      this._log(`${definition.name}\u89e6\u53d1\uff0c\u7ffb\u5f00\u4e86 ${targets.length} \u4e2a\u9644\u8fd1\u654c\u4eba\u3002`)
    } else if (definition.effect === 'corrosion') {
      const energyLoss = Math.max(1, Math.floor(Number(definition.energyLoss) || 2))
      this.staminaDeck.pay(Math.min(this.player.energy, energyLoss))
      this._log(`${definition.name}\u89e6\u53d1\uff0c\u4f53\u529b -${energyLoss}\u3002`)
    } else if (definition.effect === 'poison') {
      const poisonDamage = Math.max(1, Math.floor(Number(definition.poisonDamage) || 1))
      this._applyPoison(definition.poisonTurns, poisonDamage)
      this._log(`${definition.name}\u89e6\u53d1\uff0c\u4e2d\u6bd2 ${this.player.poisonedTurns} \u4e2a\u5168\u5c40\u56de\u5408\uff0c\u6bcf\u56de\u5408\u53d7\u5230 ${this.player.poisonDamage} \u70b9\u65e0\u89c6\u62a4\u7532\u7684\u4f24\u5bb3\u3002`)
    }
    this._emitRelicEvent('trap:triggered', { trap, definition, cause })
    return true
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
    if (entity.kind === 'item' && entity.item?.type === 'relic' && !getRelicDefinition(entity.item.relicId)) return this._reject('\u65e0\u6cd5\u8bc6\u522b\u8fd9\u4ef6\u5723\u9057\u7269\u3002')
    const route = findPath(room, this.player.pos, entity.pos, { allowGoalOccupied: true })
    if (!route) return this._reject('\u76ee\u6807\u4e0d\u53ef\u8fbe\u3002')
    const pickupCost = route.length === 0 ? 1 : 0
    if (this.battle.active && this.energyAfterMovement(route.length, route) < pickupCost) return this._reject('体力不足。')
    this._walk(route)
    // Arrival and collection are one action. An ambush stops further movement,
    // but cannot undo a pickup after the player has reached this cell.
    const arrived = !this.gameOver && this.currentRoom === room
      && manhattan(this.player.pos, entity.pos) === 0 && !!room.entity(entity.id)
    if (arrived) {
      if (pickupCost && !this._payAction(pickupCost)) return this._reject('体力不足。')
      if (entity.kind === 'item') {
        if (entity.item?.type === 'relic') {
          const entry = this.acquireRelic(entity.item.relicId, { notify: false, allowStash: true })
          if (entry) {
            room.removeEntity(entity.id)
            const item = this.backpack.placementOf(entry.uid)?.item || this.inventoryStash.find((stashed) => stashed.uid === entry.uid)
            this._emitRelicEvent('item:collected', { item })
          } else this._log(`\u5723\u9057\u7269\u5df2\u88ab\u83b7\u5f97\uff0c\u65e0\u6cd5\u91cd\u590d\u6536\u96c6\u3002`)
        } else {
          room.removeEntity(entity.id)
          if (!this._putInInventory(entity.item)) this.stageInventoryItem(entity.item, { notify: false })
          this._log(`\u83b7\u5f97 ${entity.item.name}\u3002`)
          this._emitRelicEvent('item:collected', { item: entity.item })
        }
      } else if (entity.kind === 'gold') {
        room.removeEntity(entity.id)
        const amount = entity.amount + (this.backpack.items.some((item) => item.id === 'r-money-scale') ? 1 : 0)
        this.player.gold += amount
        this._log(`\u83b7\u5f97 ${amount} \u91d1\u5e01\u3002`)
        this._emitRelicEvent('gold:collected', { amount: entity.amount })
      } else if (entity.kind === 'key') {
        room.removeEntity(entity.id)
        const edge = this.dungeon.edge(entity.edgeId)
        edge.unlocked = true
        this._log('\u627e\u5230\u4e86\u5f00\u95e8\u673a\u5173\uff0c\u5bf9\u5e94\u95e8\u5df2\u6c38\u4e45\u6253\u5f00\u3002')
        this._emitRelicEvent('key:collected', { key: entity, edge })
      }
    }
    if (arrived) this._endTurn({ turnKind: TURN_KINDS.ACTION })
    this._changed()
    return true
  }

  _useDoor(door) {
    if (this.battle.active) return this._reject('请先解决当前已激活的敌人。')
    const edge = this.doorEdge(door)
    if (!edge || edge.sealed) return false
    if (this.isDoorLocked(door)) return this._reject('\u95e8\u88ab\u673a\u5173\u9501\u4f4f\u4e86\u3002')
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
    if (edge.branch && this.isExitDoor(door)) {
      for (const otherEdge of this.dungeon.edges.values()) {
        if (otherEdge.branch?.chapter === edge.branch.chapter && otherEdge.branch.option !== edge.branch.option) otherEdge.sealed = true
      }
    }
    this._emitRelicEvent('room:left', { room: this.currentRoom })
    const firstVisit = !targetRoom.visited
    targetRoom.reveal(targetDoor.arrival)
    targetRoom.visited = true
    this.player.roomId = targetRoom.id
    this.player.pos = { ...targetDoor.arrival }
    this._synchronizeBattle()
    if (targetRoom.tacticalLayout && targetRoom.tacticalLayout !== 'scattered') this._log(`房间布局：${TACTICAL_LAYOUT_LABELS[targetRoom.tacticalLayout]}。`)
    this._log(`\u8fdb\u5165 ${this.roomLabel(targetRoom)}\u3002`)
    this._endTurn({ turnKind: TURN_KINDS.ACTION })
    this._emitRelicEvent('room:entered', { room: targetRoom, firstVisit })
    this.itemRules.enter(firstVisit)
    if (firstVisit && !this.gameOver && targetRoom.role !== 'entry') {
      const reward = buildRoomRewardChoices(this.relics, {
        floor: targetRoom.progressionFloor,
        type: targetRoom.role === 'elite' ? 'relic' : targetRoom.role === 'supply' ? 'supply' : this._drawRoomRewardType(),
        random: this.random,
        items: this.backpack.items,
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
    const visualPosition = { ...enemy.pos }
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
        this.totems.onEnemyMoved(enemy)
        this.itemRules.expansion.spreadPoison(enemy)
        moved = true
        continue
      }
      if (occupant.kind === 'enemy') collision = 'enemy'
      else if (occupant.kind === 'door') collision = 'wall'
      break
    }
    if (collision) {
      if (collisionDamage > 0 && room.entity(enemy.id)) this._damageEnemy(enemy, collisionDamage, { source: 'weapon:collision', impactPosition: visualPosition })
      if (collisionDelay > 0 && room.entity(enemy.id)) enemy.actionDelay = normalizedCounter(enemy.actionDelay) + collisionDelay
    }
    return { moved, collision }
  }

  _weaponRoute(weapon, enemy) {
    return findAttackPath(this.currentRoom, this.player.pos, enemy, [{ ...weapon, rangeAt: position => this.weaponRange(weapon, position) }])
  }

  _attack(enemy) {
    this._synchronizeBattle()
    const weapon = this.selectedItem
    if (weapon?.type !== 'weapon') return this._reject('请先选择武器。')
    const route = this._weaponRoute(weapon, enemy)
    if (!route) return this._reject('没有可达的攻击位置。')
    if (this.energyAfterMovement(route.path.length, route.path) < 1 || !this.weaponPayment(weapon)) return this._reject('没有可支付的同色或万能球。')
    const movement = this._walk(route.path)
    if (movement.stopped || !this.currentRoom.entity(enemy.id)) { this._changed(); return true }
    const range = this.weaponRange(weapon)
    if (combatDistance(this.player.pos, enemy.pos, range) > range) return this._reject('敌人已经离开射程。')
    const context = this.itemRules.attackContext(weapon, enemy)
    const payment = this.staminaDeck.pay(this.weaponEnergyCost(weapon), weapon.attribute)
    if (!payment) return this._reject('没有可支付的同色或万能球。')
    this.itemRules.recordWeaponUse(weapon)
    this.itemRules.expansion.beforeAttack(weapon, context)
    this.pets.playerAttack(enemy)
    const fullDamage = resolveDamage(weapon.attack, [
      { stage: 'flat', value: context.flat },
      { stage: 'multiply', value: context.attackMultiplier },
      { stage: 'multiply', value: context.multiplier },
      ...terrainDamageModifiers(this.currentRoom, this.player.pos),
    ]).total + context.bonusDamage
    const damage = Math.max(0, Math.floor(fullDamage * payment.multiplier))
    const targetPosition = { ...enemy.pos }
    this.pendingAttackImpacts = []
    this.pendingAttackExplosions = []
    this.player.lastAttackPower = Math.max(0, ((Number(weapon.attack) || 0) + context.flat) * context.attackMultiplier * payment.multiplier)
    this.itemRules.consume(context)
    const logSequence = this._logSequence
    const hit = this._damageEnemy(enemy, damage, { ignoreDefense: context.ignoreDefense, weapon })
    const primaryTargetStatus = weapon.id === 'erosion-knife' && !hit.defeated
      ? { position: { ...enemy.pos }, enemy: enemyStatusSnapshot(enemy) } : null
    this.itemRules.afterAttack(weapon, enemy, hit, context)
    this._log(`${weapon.name} 对 ${enemy.name} 造成 ${hit.damage} 伤害。`, { insertAt: this._logSequence - logSequence })
    this._roomRuntime().firstAttackUsed = true
    this.combatResolving = true
    this.bus.emit('animate:attack', {
      roomId: this.currentRoom?.id,
      actor: 'player',
      position: { ...this.player.pos },
      targetPosition,
      evaded: !!hit.evaded,
      targetDefeated: hit.defeated && !hit.exploded && !hit.afterEffectDefeated,
      targetStatus: hit.afterEffectDefeated ? primaryTargetStatus : hit.defeated ? null : {
        position: { ...enemy.pos },
        enemy: enemyStatusSnapshot(enemy),
      },
    })
    const pendingImpacts = this.pendingAttackImpacts
    const pendingExplosions = this.pendingAttackExplosions
    this.pendingAttackImpacts = null
    this.pendingAttackExplosions = null
    for (const explosion of pendingExplosions) this.bus.emit('animate:explode', explosion)
    for (const impact of pendingImpacts) this.bus.emit('animate:impact', impact)
    // The renderer confirms the player pose before this turn advances. This
    // keeps enemy actions out of both the model and the animation queue until
    // the player hit (including a kill) is visibly settled.
    this._changed()
    return true
  }

  _walk(path) {
    const roomId = this.currentRoom?.id
    const startingPhase = this.phase
    const startingBattle = this.battle.active
    const startingRound = this.globalTurn
    for (let index = 0; index < path.length; index += 1) {
      const step = path[index]
      if (!this._payAction(1)) return { stopped: true }
      this.enemyAttackInterruptedRoute = false
      const previous = { ...this.player.pos }
      if (roomId) {
        this.bus.emit('animate:move', {
          roomId,
          from: previous,
          path: [{ ...step }],
        })
      }
      this.player.pos = { ...step }
      this.itemRules.move()
      this._discoverNearbyExitDoors()
      this._triggerAmbushes(step)
      this._endTurn({ turnKind: TURN_KINDS.MOVEMENT })
      if (this.gameOver) return { stopped: true }
      if (this.enemyAttackInterruptedRoute || (!startingBattle && this.battle.active) || this.globalTurn !== startingRound || this.roundResolving) return { stopped: true, interrupted: true }
      if (this.phase !== startingPhase) {
        this._log('行动已暂停，请先完成当前选择，再重新指定目的地。')
        return { stopped: true }
      }
    }
    return { stopped: false }
  }

  // Complete an operation; the player explicitly decides when to end the turn.
  _endTurn({ turnKind = TURN_KINDS.ACTION, action = turnKind } = {}) {
    this.itemRules.action(action)
    this.turns.advance(turnKind)
    this.bus.emit('player:action', { action, turnKind, round: this.battle.round, energy: this.player.energy })
    this._synchronizeBattle()
  }

  _resolveBattleRound() {
    if (!this.battle.active || this.roundResolving || this._turnInProgress) return false
    const isPeriodic = entry => ['player-poison', 'enemy-poison', 'burning'].includes(entry.id)
    const clock = this._statusClockSnapshot().filter(entry => !isPeriodic(entry))
    const periodicTicks = new Set()
    const counters = this.turns.advance(TURN_KINDS.ROUND)
    this._cleanupTriggeredTraps(counters.globalTurn)
    const turnContext = { turn: counters.globalTurn, turnKind: TURN_KINDS.ROUND, ...counters }
    this._turnInProgress = true
    this.roundResolving = true
    this.pendingRoundEnd = false
    try {
      this._emitTurnEvent('turn:advanced', turnContext)
      this._emitTurnEvent('turn:started', turnContext)
      this.battle.stage = 'pets'
      if (!this.gameOver) this.pets.act()
      this.staminaDeck.discardHand()
      this.battle.stage = 'enemy'
      if (!this._activatedEnemies().length || this.gameOver) return true
      clock.push(...this._statusClockSnapshot().filter(isPeriodic))
      const reviving = this._activatedEnemies().filter(enemy => enemy.downed)
      this._tickPlayerStatuses({ advanceClock: false, clock, periodicTicks })
      if (!this.gameOver) this._tickEnemyPoison(clock, periodicTicks)
      if (!this._activatedEnemies().length || this.gameOver) return true
      if (!this.gameOver) this.totems.startTurn()
      // Roots granted by a start-of-turn pull block this enemy phase, then
      // expire with this turn. Roots from an enemy's move begin next turn.
      for (const entity of this.currentRoom.entities.values()) {
        const status = getStatus(entity, 'rooted')
        if (status && !clock.some(entry => entry.status === status)) clock.push({ actor: entity, id: 'rooted', status })
      }
      if (this.gameOver) return true
      this._tickEnemyStates(reviving)
      if (this.gameOver) return true
      this.bus.emit('enemies:started', turnContext)
      const enemies = this._activeEnemies()
      for (const enemy of this.currentRoom.entities.values()) {
        if (enemy.kind === 'enemy') enemy.movedLastPhase = false
      }
      for (const enemy of enemies) {
        if (this.gameOver || enemy.totemActionTurn === counters.globalTurn || !this.currentRoom.entity(enemy.id)) continue
        this._applyEnemyTraits(enemy)
        if (!this.currentRoom.entity(enemy.id) || this.gameOver) continue
        const outcome = stepEnemy(enemy, {
          room: this.currentRoom,
          player: this.player,
          attack: (actor) => this._enemyAttack(actor),
          path: actor => this.totems.path(actor),
          attackObstacle: (actor, totem) => this.totems.attack(actor, totem),
          move: (actor, position) => {
            const moved = this._moveEnemy(actor, position)
            if (moved) actor.movedLastPhase = true
            return moved
          },
        })
        if (outcome.acted && this.currentRoom.entity(enemy.id) && !enemy.downed) this._onEnemyAction(enemy)
      }
      this.bus.emit('enemies:ended', turnContext)
    } finally {
      // Durations tick once after the pet/enemy stages, never after player actions.
      tickStatusSnapshot(clock.filter(entry => !isPeriodic(entry) || periodicTicks.has(entry.status)))
      this.pets.endTurn()
      this._turnInProgress = false
      this._synchronizeBattle()
      this._emitTurnEvent('turn:ended', turnContext)
    }
    return true
  }

  _enemyAttack(enemy, multiplier = 1, { animate = true, deferCounter = false } = {}) {
    if (getStatus(enemy, 'rooted')?.blocksAttack) return { healthDamage: 0, cancelled: true }
    if (!enemy || enemy.attack <= 0) return { healthDamage: 0 }
    const poison = getStatus(enemy, 'enemy-poison')
    this.enemyAttackInterruptedRoute = true
    enemy.hasActed = true
    const targetPosition = { ...this.player.pos }
    const reduction = getStatus(enemy, 'attack-reduction')
    const rawDamage = Math.max(0, this.itemRules.expansion.enemyAttackDamage(enemy, Math.max(1, Math.floor(enemy.attack * multiplier)), poison) - (reduction?.amount || 0))
    if (reduction) consumeStatus(enemy, 'attack-reduction', reduction)
    if (enemy.selfDestructOnAttack) {
      const blast = this._explodeEnemy(enemy, rawDamage, 'large')
      this._defeatEnemy(enemy, { source: 'enemy:self-explosion', suppressDeathExplosion: true })
      const explosion = {
        roomId: this.currentRoom?.id,
        enemyId: enemy.id,
        position: { ...enemy.pos },
        targetPosition: blast?.result?.evaded ? null : blast?.targetPosition || null,
        targetDefeated: !!blast && this.gameOver,
      }
      if (animate) this._queueExplosion(explosion)
      return { ...(blast?.result || { healthDamage: 0 }), explosion }
    }
    const result = this._damagePlayer(rawDamage, { source: 'enemy:attack', enemy, deferCounter: true })
    if (animate && this.gameOver) this.deathAnimationPending = true
    if (animate) {
      this.bus.emit('animate:attack', {
        roomId: this.currentRoom?.id,
        actor: 'enemy',
        enemyId: enemy.id,
        actorStatus: enemyStatusSnapshot(enemy),
        position: { ...enemy.pos },
        targetPosition,
        evaded: !!result.evaded,
        targetDefeated: this.gameOver,
      })
    }
    this._log(result.evaded ? `\u4f60\u95ea\u907f\u4e86${enemy.name}\u7684\u653b\u51fb\u3002` : `${enemy.name} \u653b\u51fb\u4f60\uff0c${damageReductionLog(result)}\u3002`)
    if (!this.currentRoom.entity(enemy.id) || enemy.downed) return result
    enemy.attackCooldown = 0
    if (result.evaded) return result
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
    if (deferCounter) result.counterPending = { holder: this.player, attacker: enemy }
    else this._resolveCounter(this.player, enemy, result)
    return result
  }

  _damagePlayer(rawDamage, context = {}) {
    const attackDamage = Math.max(0, Math.floor(rawDamage || 0))
    const isAttack = context.source === 'enemy:attack' || context.attack === true
    if (isAttack && this._tryDodge(this.player)) {
      return { attackDamage, rawDamage: 0, absorbed: 0, healthDamage: 0, evaded: true }
    }
    const isMelee = context.melee === true || context.enemy?.range === 1
    let damage = attackDamage
    damage = this.itemRules.beforeDamage(damage, context)
    const armorBefore = this.player.armor
    const parry = getStatus(this.player, 'parry')
    const canParry = context.source === 'enemy:attack' && parry && (isMelee || parry.ranged)
    if (canParry) {
      damage = Math.max(0, Math.floor(damage * Math.max(0, Number(parry.multiplier) || 0)))
      consumeStatus(this.player, 'parry', parry)
    }
    const absorbed = context.ignoreArmor ? 0 : Math.min(this.player.armor, damage)
    const healthDamage = damage - absorbed
    this.player.armor -= absorbed
    this.player.hp -= healthDamage
    this.itemRules.afterDamage(context, healthDamage, armorBefore)
    this._emitRelicEvent('player:damaged', { rawDamage: damage, absorbed, healthDamage, ...context })
    if (this.player.hp <= 0) {
      this.player.hp = 0
      this.gameOver = true
      this.phase = 'over'
      this._log(`\u4f60\u5012\u4e0b\u4e86\uff08\u539f\u56e0\uff1a${playerDeathCause(context)}\uff09\u3002`, { death: true })
    }
    const enemyExplosion = context.source === 'enemy:small-explosion' || context.source === 'enemy:large-explosion'
    if (damage > 0 && context.source !== 'enemy:attack' && !enemyExplosion) {
      this._queueImpact({ roomId: this.currentRoom?.id, target: 'player', position: { ...this.player.pos }, defeated: this.gameOver })
    }
    const result = { attackDamage, rawDamage: damage, absorbed, healthDamage }
    if (isAttack && !context.deferCounter) this._resolveCounter(this.player, context.enemy, result)
    return result
  }

  _tryDodge(actor) {
    const dodge = getStatus(actor, 'dodge')
    if (!dodge) return false
    consumeStatus(actor, 'dodge', dodge)
    this.bus.emit('status:evaded', { actor })
    return true
  }

  _resolveCounter(holder, attacker, result) {
    const status = getStatus(holder, 'counter')
    if (!status || result.evaded || this.gameOver || holder.hp <= 0 || holder.downed || !attacker || attacker.hp <= 0 || attacker.downed) return null
    if (attacker.kind === 'enemy' && !this.currentRoom.entity(attacker.id)) return null
    const context = { run: this, holder, attacker, enemy: attacker.kind === 'enemy' ? attacker : holder,
      stage: 'trigger', ...result, status }
    const damage = resolveStatusDamage(status, context)
    // Consume before callbacks so a new grant is not accidentally spent.
    consumeStatus(holder, 'counter', status)
    const hit = attacker.kind === 'enemy'
      ? this._damageEnemy(attacker, damage, { source: 'status:counter' })
      : this._damagePlayer(damage, { source: 'status:counter', enemy: holder })
    this._log(`${holder.kind === 'enemy' ? holder.name : '\u4f60'}\u53cd\u51fb${attacker.kind === 'enemy' ? attacker.name : '\u4f60'}\uff0c\u9020\u6210${hit.healthDamage || 0}\u4f24\u5bb3\u3002`)
    this.bus.emit('status:countered', { ...context, damage, hit })
    return hit
  }

  _queueImpact(impact) {
    if (impact.defeated && impact.target === 'player') this.deathAnimationPending = true
    if (impact.defeated && impact.target === 'enemy') this.enemyDeathAnimationsPending++
    if (this.pendingAttackImpacts) this.pendingAttackImpacts.push(impact)
    else this.bus.emit('animate:impact', impact)
  }

  _queueExplosion(explosion) {
    this.enemyDeathAnimationsPending++
    if (explosion.targetDefeated) this.deathAnimationPending = true
    if (this.pendingAttackExplosions) this.pendingAttackExplosions.push(explosion)
    else this.bus.emit('animate:explode', explosion)
  }

  _healPlayer(amount, context = {}) {
    if (this.hasActiveRelic('r-blood')) amount = Math.floor(amount / 2)
    const before = this.player.hp
    const restored = Math.floor(Math.max(0, Number(amount) || 0))
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + restored)
    const healed = this.player.hp - before
    if (healed > 0) this._emitRelicEvent('player:healed', { amount: healed, ...context })
    return healed
  }

  _damageEnemy(enemy, damage, { source = 'attack', ignoreDefense = false, impactPosition = enemy?.pos, weapon = null } = {}) {
    if (!enemy || !this.currentRoom?.entity(enemy.id)) return { damage: 0, healthDamage: 0, defeated: false, finishedDowned: false }
    const attack = source === 'attack' || source.startsWith('pet:')
    if (attack && !enemy.downed && this._tryDodge(enemy)) {
      return { damage: 0, healthDamage: 0, defeated: false, evaded: true }
    }
    if (weapon && source === 'attack') this.pets.playerHit(weapon, enemy)
    if (enemy.downed) {
      const exploded = enemy.deathExplosionDamage > 0
      this._defeatEnemy(enemy, { source })
      if (source !== 'attack' && !exploded) this._queueImpact({ roomId: this.currentRoom?.id, target: 'enemy', position: { ...impactPosition }, defeated: true })
      return { damage: 0, healthDamage: 0, defeated: true, finishedDowned: true, exploded }
    }
    const hpBefore = Math.max(0, Number(enemy.hp) || 0)
    let applied = Math.max(0, Math.floor(damage || 0))
    if (!ignoreDefense && enemy.traits?.includes('shield') && !enemy.shieldConsumed) {
      enemy.shieldConsumed = true
      applied = Math.min(applied, Math.floor(enemy.maxHp / 2))
    }
    if (!ignoreDefense && source !== 'item:poison' && enemy.traits?.includes('heavy-armor')) applied = Math.max(0, applied - 1)
    const healthDamage = Math.min(hpBefore, applied)
    enemy.hp -= applied
    if (enemy.hp > 0) {
      if (source !== 'attack' && applied > 0) this._queueImpact({ roomId: this.currentRoom?.id, target: 'enemy', position: { ...impactPosition }, defeated: false })
      if (attack) this._resolveCounter(enemy, this.player, { attackDamage: damage, rawDamage: applied, healthDamage })
      return { damage: healthDamage, rawDamage: applied, healthDamage, defeated: false, finishedDowned: false }
    }
    enemy.hp = 0
    if (enemy.deathRule === 'revive' && !enemy.reviveUsed) {
      enemy.reviveUsed = true
      enemy.downed = true
      enemy.reviveTurns = 2
      this._log(`${enemy.name}\u5047\u6b7b\u4e86\uff0c\u4e24\u56de\u5408\u540e\u5c06\u6ee1\u8840\u590d\u6d3b\u3002`)
      if (source !== 'attack') this._queueImpact({ roomId: this.currentRoom?.id, target: 'enemy', position: { ...impactPosition }, defeated: false })
      return { damage: healthDamage, rawDamage: applied, healthDamage, defeated: false, finishedDowned: false }
    }
    const exploded = enemy.deathExplosionDamage > 0
    this._defeatEnemy(enemy, { source })
    if (source !== 'attack' && !exploded) this._queueImpact({ roomId: this.currentRoom?.id, target: 'enemy', position: { ...impactPosition }, defeated: true })
    return { damage: healthDamage, rawDamage: applied, healthDamage, defeated: true, finishedDowned: false, exploded }
  }

  _defeatEnemy(enemy, { source = 'attack', suppressDeathExplosion = false, suppressLoot = false } = {}) {
    if (!enemy || !this.currentRoom?.entity(enemy.id)) return false
    if (enemy.deathExplosionDamage > 0 && !suppressDeathExplosion) {
      const blast = this._explodeEnemy(enemy, enemy.deathExplosionDamage, 'small')
      this._queueExplosion({
        roomId: this.currentRoom?.id,
        enemyId: enemy.id,
        position: { ...enemy.pos },
        targetPosition: blast?.targetPosition || null,
        targetDefeated: !!blast && this.gameOver,
      })
    }
    this.currentRoom.removeEntity(enemy.id)
    this._log(`${enemy.name} \u88ab\u51fb\u8d25\u3002`)
    this._emitRelicEvent('enemy:killed', { enemy, source })
    this._applyEnemyDeathStatus(enemy)
    if (enemy.traits?.includes('death-spawn')) this._spawnMinionsNear(enemy, enemy.deathSpawnMinionId, enemy.deathSpawnCount)
    if (this.remainingEnemies() === 0) this._emitRelicEvent('room:cleared', { room: this.currentRoom })
    this._gainExperience(enemy)
    const dropRule = enemy.drop
    const itemDropChance = !enemy.boss && !enemy.noLoot && !isSummonedEnemy(enemy) && !suppressLoot && dropRule
      ? Math.max(0, Number(dropRule.chance) || 0)
      : 0
    if (itemDropChance > 0 && this.random() < itemDropChance) {
      const itemIds = (Array.isArray(dropRule?.itemIds) ? dropRule.itemIds : [dropRule?.itemId]).filter(Boolean)
      const itemId = itemIds[Math.floor(this.random() * itemIds.length)]
      const drop = makeItemById(itemId, this.random)
      if (drop) {
        this.currentRoom.addEntity(createLootEntity(drop, enemy.pos))
        this._log(`${enemy.name} \u6389\u843d\u4e86 ${drop.name}\u3002`)
      }
    }
    if (enemy.finalBoss) {
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
    if (getStatus(enemy, 'rooted')) return false
    const room = this.currentRoom
    if (!room?.isRevealed(position) || !room.isEmpty(position)) return false
    const from = { ...enemy.pos }
    if (!room.moveEntity(enemy.id, position)) return false
    this.totems.onEnemyMoved(enemy)
    this.itemRules.expansion.spreadPoison(enemy)
    this.bus.emit('animate:enemy-move', {
      roomId: room.id,
      enemyId: enemy.id,
      from,
      to: { ...position },
    })
    return true
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
    this.applyStatus(this.player, 'burning', { turns: duration, damage: amount }, { refresh: true })
    return true
  }

  _applyPoison(turns = POISON_TURNS, damage = 2) {
    const duration = Math.max(1, Math.floor(Number(turns) || POISON_TURNS))
    const amount = Math.max(1, Math.floor(Number(damage) || 1))
    this.applyStatus(this.player, 'player-poison', { turns: duration, damage: amount }, { refresh: true })
    return true
  }

  _tickEnemyPoison(clock, periodicTicks = new Set()) {
    // Snapshot at enemy-phase start: poison spread during resolution waits
    // until next round, independent of enemy ordering, movement and attack count.
    for (const { actor: enemy, id, status } of clock) {
      if (this.gameOver) break
      if (id !== 'enemy-poison' || enemy.downed || !this.currentRoom.entity(enemy.id) || getStatus(enemy, id) !== status) continue
      periodicTicks.add(status)
      this._damageEnemy(enemy, resolveStatusDamage(status, { run: this, holder: enemy }), { source: 'item:poison', ignoreDefense: true })
      consumeStatus(enemy, id, status)
    }
  }

  _tickPlayerStatuses({ advanceClock = true, clock = statusSnapshot(this.player), periodicTicks = new Set() } = {}) {
    let ticked = false
    for (const id of ['player-poison', 'burning']) {
      const status = getStatus(this.player, id)
      if (!status || this.gameOver || !clock.some(entry => entry.actor === this.player && entry.status === status)) continue
      periodicTicks.add(status)
      consumeStatus(this.player, id, status)
      const result = this._damagePlayer(resolveStatusDamage(status, { run: this, holder: this.player }),
        { source: id === 'player-poison' ? 'trap:poison-fog' : 'enemy:burning', ignoreArmor: !!status.ignoreArmor })
      this._log(`${status.name}\u53d1\u4f5c\uff0c${damageReductionLog(result)}${status.ignoreArmor ? '\uff08\u65e0\u89c6\u62a4\u7532\uff09' : ''}\u3002`)
      ticked = true
    }
    if (advanceClock) tickStatusSnapshot(clock)
    return ticked
  }

  _tickEnemyStates(reviving = null) {
    const room = this.currentRoom
    if (!room) return
    for (const enemy of reviving || [...room.entities.values()].filter((entity) => entity.kind === 'enemy' && entity.downed && room.isRevealed(entity.pos))) {
      if (!room.entity(enemy.id) || !enemy.downed) continue
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
      const turns = Math.max(1, Math.floor(Number(enemy.deathStatusTurns) || POISON_TURNS))
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
    const targetPosition = { ...this.player.pos }
    const attack = size === 'large' && enemy.selfDestructOnAttack
    const result = this._damagePlayer(damage, { source: `enemy:${size}-explosion`, enemy, attack, deferCounter: attack })
    this._log(`${enemy.name}\u53d1\u751f\u4e86${size === 'large' ? '\u5927' : '\u5c0f'}\u81ea\u7206\uff0c${damageReductionLog(result)}\u3002`)
    return { targetPosition, result }
  }

  _triggerAmbushes(position) {
    const room = this.currentRoom
    if (!room) return false
    const playerNeighborhood = neighbors8(position, room.width, room.height)
    const ambushers = [...room.entities.values()]
      .filter((entity) => entity.kind === 'enemy' && entity.behavior === 'ambush' && !room.isRevealed(entity.pos))
      .filter((entity) => playerNeighborhood.some((candidate) => candidate.c === entity.pos.c && candidate.r === entity.pos.r))
    for (const enemy of ambushers) {
      this._log(`${enemy.name}\u4ece\u4f0f\u51fb\u4e2d\u73b0\u8eab\u3002`)
      this._revealEnemy(room, enemy, { cause: 'ambush' })
      if (this.gameOver) break
    }
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
    return this.phase === 'explore' && !this.gameOver && this.initialRelicChoices.length === 0 && !this.merchantEntering && !this.roomEntering && !this.combatResolving && !this.roundResolving && (!this.battle.active || this.battle.stage === 'player')
  }

  _canSelectInventory() {
    const phaseAllows = ['explore', 'merchant'].includes(this.phase)
      || (this.phase === 'level-up' && !!this.levelUp && !this.enemyDeathAnimationsPending)
    return !this.gameOver && this.initialRelicChoices.length === 0 && phaseAllows && !this.merchantEntering && !this.roomEntering && !this.combatResolving && !this.roundResolving && (!this.battle.active || this.battle.stage === 'player')
  }

  _canOrganizeBackpack() {
    return this._canSelectInventory() && (this.phase !== 'explore' || this.canPayAction(1))
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
      bigRoundRevision: BIG_ROUND_REVISION,
      staminaDeck: this.staminaDeck.serialize(),
      battle: { ...this.battle, knownEnemyIds: [...(this.battle.knownEnemyIds || [])] },
      roundResolving: this.roundResolving,
      pendingRoundEnd: this.pendingRoundEnd,
      dungeon: this.dungeon.serialize(),
      player: clone(this.player),
      backpack: this.backpack.serialize(clone),
      inventoryStash: this.inventoryStash.map(clone),
      initialRelicChoices: [...this.initialRelicChoices],
      turn: this.turn,
      turnCounters: this.turns.serialize(),
      phase: this.phase,
      gameOver: this.gameOver,
      win: this.win,
      selectedInventoryIndex: this.selectedInventoryIndex,
      itemTargeting: this.itemTargeting,
      pendingAttackTurn: this.combatResolving,
      merchant: this.merchant ? { ...this.merchant } : null,
      roomReward: this.roomReward ? clone(this.roomReward) : null,
      roomRewardBag: [...this.roomRewardBag],
      levelUp: this.levelUp ? clone(this.levelUp) : null,
      relicRuntime: clone(this.relicRuntime),
      log: [...this.log],
    }
  }

  _persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize())) } catch { /* Storage can be unavailable in private contexts. */ }
  }

  load() {
    const discard = () => {
      try { localStorage.removeItem(SAVE_KEY) } catch { /* Storage can be unavailable in private contexts. */ }
      return false
    }
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return false
      const data = JSON.parse(raw)
      if (!compatibleSave(data)) return discard()
      this.dungeon = Dungeon.hydrate(data.dungeon)
      this.player = data.player
      this.staminaDeck = new StaminaDeck(this.random, data.staminaDeck)
      this._bindBallAccessors()
      this.battle = data.battle && typeof data.battle.active === 'boolean' ? { ...data.battle } : { active: false, stage: 'explore', round: 0 }
      this.roundResolving = false
      this.pendingRoundEnd = false
      this.backpack = BackpackGrid.hydrate(data.backpack)
      this.inventoryStash = Array.isArray(data.inventoryStash) ? data.inventoryStash.filter((item) => item?.uid) : []
      const refreshItemCopy = item => {
        if (item?.id === 'teleport') item.name = getItemDefinition(item.id).name
        if (['r-traveler', 'r-step-boots', 'r-turn-shield', 'triad-tide', 'r-single-seal'].includes(item?.id)) item.description = getItemDefinition(item.id).description
      }
      for (const item of [...this.backpack.items, ...this.inventoryStash]) refreshItemCopy(item)
      synchronizeEntityIds([...this.backpack.items, ...this.inventoryStash].map(item => item.uid))
      for (const room of this.dungeon.rooms.values()) {
        for (const entity of room.entities.values()) {
          refreshItemCopy(entity.item)
          if (entity.kind === 'enemy') {
            synchronizeEnemyBalance(entity)
            bindStatusAccessors(entity)
          }
        }
      }
      this.player.level = Math.max(PROGRESSION.startingLevel, Number(this.player.level) || PROGRESSION.startingLevel)
      this.player.experience = Math.max(0, Number(this.player.experience) || 0)
      this.player.experienceToNext = Math.max(1, Number(this.player.experienceToNext) || experienceToNextLevel(this.player.level))
      if (Array.isArray(this.player.talents) && this.player.talents.includes('harmony-switch')) {
        for (const room of this.dungeon.rooms.values()) {
          for (const entity of room.entities.values()) {
            if (entity.kind === 'enemy') removeStatus(entity, 'attack-reduction')
          }
        }
      }
      delete this.player.talents
      delete this.player.talentRuntime
      bindStatusAccessors(this.player)
      normalizeStatuses({ statuses: this.itemRules.state.buffs })
      for (const id of ['flow-relay', 'guard-reply', 'guard-last', 'harmony-resist']) delete this.itemRules.state.buffs[id]
      delete this.itemRules.state.healthHits
      this.relics = RelicCollection.fromItems([...this.backpack.items, ...this.inventoryStash])
      this.relics.entries = this.relics.entries.filter((entry) => !!getRelicDefinition(entry.id)
        && (this.backpack.placementOf(entry.uid) || this.inventoryStash.some((item) => item.uid === entry.uid)))
      this.relicEngine = new RelicEngine(this.relics)
      this.initialRelicChoices = (Array.isArray(data.initialRelicChoices) ? data.initialRelicChoices : buildRelicChoices(this.relics, { random: this.random }).map((relic) => relic.id))
        .filter((id) => !!getRelicDefinition(id) && !this.relics.has(id))
      this.turns = new TurnLedger(data.turnCounters)
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
      this.combatResolving = false
      this.deathAnimationPending = false
      this.enemyDeathAnimationsPending = 0
      this.pendingAttackImpacts = null
      this.pendingAttackExplosions = null
      this.enemyAttackInterruptedRoute = false
      this.roomReward = data.roomReward?.roomId && Array.isArray(data.roomReward.choices) ? clone(data.roomReward) : null
      this.roomRewardBag = Array.isArray(data.roomRewardBag) && data.roomRewardBag.every((type) => type === 'supply' || type === 'relic')
        ? [...data.roomRewardBag]
        : shuffled(['supply', 'supply', 'supply', 'relic'], this.random)
      this.levelUp = Array.isArray(data.levelUp?.choices)
        ? {
            choices: data.levelUp.choices.filter((id) => !!getLevelUpOption(id)),
            ...(data.levelUp.selectedOption && data.levelUp.choices.includes(data.levelUp.selectedOption) && ['relic', 'weapon-upgrade'].includes(data.levelUp.selectedOption)
              ? { selectedOption: data.levelUp.selectedOption } : {}),
            ...(Array.isArray(data.levelUp.relicChoices) ? { relicChoices: [...new Set(data.levelUp.relicChoices)].filter(id => getRelicDefinition(id) && !getRelicDefinition(id).disabled && !this.relics.has(id)).slice(0, 3) } : {}),
          }
        : null
      if (this.levelUp && (this.levelUp.choices.length !== PROGRESSION.levelChoiceCount || new Set(this.levelUp.choices).size !== PROGRESSION.levelChoiceCount || !this.levelUp.choices.some(id => this.canChooseLevelUpOption(id)))) {
        this.levelUp = null
        this.phase = 'explore'
      }
      if (this.levelUp?.relicChoices && !this.levelUp.relicChoices.length) delete this.levelUp.relicChoices
      if (this.levelUp?.selectedOption === 'relic' && !this.levelUp.relicChoices?.length) delete this.levelUp.selectedOption
      if (this.levelUp?.selectedOption === 'weapon-upgrade' && !this.levelUpWeapons().length) delete this.levelUp.selectedOption
      this.relicEventQueue = []
      this.relicRuntime = data.relicRuntime && typeof data.relicRuntime === 'object' ? clone(data.relicRuntime) : {}
      this.detailPanel = null
      this.log = Array.isArray(data.log) ? data.log : []
      this._logSequence = this.log.length
      synchronizeEntityIds([...this.backpack.items, ...this.inventoryStash].map((item) => item?.uid))
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
      if (data.pendingAttackTurn === true) {
        this._endTurn({ turnKind: TURN_KINDS.ATTACK })
        this._persist()
      } else if (data.roundResolving === true) {
        this._beginPlayerTurn()
        this._persist()
      } else {
        this._synchronizeBattle()
      }
      return true
    } catch {
      return discard()
    }
  }

  clearSave() {
    try { localStorage.removeItem(SAVE_KEY) } catch { /* Storage can be unavailable in private contexts. */ }
  }
}
