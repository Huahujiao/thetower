import { createEmitter } from './core/emitter.js'
import { combatDistance, manhattan, neighbors8 } from './core/geometry.js'
import { ATTRIBUTE_ORDER, attributeLabel } from './data/attributes.js'
import { createGoldEntity, createLootEntity, createMinion, getItemDefinition, makeItemById, randomWeapon, starterWeapon, synchronizeEntityIds } from './data/content.js'
import { enemyActiveSkillLabel, enemyBehaviorLabel, enemyFeatureLabel } from './data/enemy-features.js'
import { getMerchantDefinition, merchantSellPrice, refreshMerchantSlot, refreshMerchantStock } from './data/merchants.js'
import { buildRelicChoices, getRelicDefinition } from './data/relics.js'
import { buildRoomRewardChoices } from './data/rewards.js'
import { PROGRESSION, adaptationChoices, buildLevelUpChoices, experienceToNextLevel, getLevelUpOption, masteryPreservationChance } from './data/progression.js'
import { getTrapDefinition } from './data/traps.js'
import { createLinearDungeon, Dungeon } from './model/dungeon.js'
import { BackpackGrid } from './model/backpack.js'
import { RelicCollection } from './model/relics.js'
import { attackAttributeModifier, computeAttackDamage } from './rules/modifiers.js'
import { RelicEngine } from './rules/relics.js'
import { stepEnemy } from './rules/enemies.js'
import { findAttackPath, findDoorPath, findInteractionPath, findPath, findRevealPath } from './rules/pathfinding.js'
import { terrainDamageModifiers } from './rules/terrain.js'

// The design notation is rows × columns: four rows, six columns.
export const INVENTORY_COLUMNS = 6
export const INVENTORY_ROWS = 4
export const INVENTORY_CAPACITY = INVENTORY_COLUMNS * INVENTORY_ROWS
export const EQUIPMENT_SLOTS = 2
export const SAVE_KEY = 'grid_flip_adventure_v2'
export const SAVE_VERSION = 11

function clone(value) { return JSON.parse(JSON.stringify(value)) }

function isTwoHanded(weapon) { return weapon?.grip === 'two' }

function uniqueWeapons(weapons) {
  const known = new Set()
  return weapons.filter((weapon) => {
    if (!weapon) return false
    const key = weapon.uid || weapon
    if (known.has(key)) return false
    known.add(key)
    return true
  })
}

function weaponHands(player, weapon) {
  if (!player || !weapon) return []
  const hands = []
  for (let index = 0; index < EQUIPMENT_SLOTS; index++) {
    if (player.equipment[index]?.uid === weapon.uid) hands.push(index)
  }
  return hands
}

function weaponStrength(player, weapon) {
  return weaponHands(player, weapon).reduce((total, hand) => total + Math.max(0, Number(player.strength?.[hand]) || 0), 0)
}

function weaponMastery(player, weapon) {
  return weaponHands(player, weapon).reduce((total, hand) => total + Math.max(0, Number(player.mastery?.[hand]) || 0), 0)
}

function weaponIsAdapted(player, weapon) {
  return weaponHands(player, weapon).some((hand) => player.adaptations?.[hand] === weapon.attribute)
}

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
  whetstone: '\u78e8\u5200\u77f3',
  relic: '\u5723\u9057\u7269',
  enemy: '\u654c\u4eba',
  trap: '\u9677\u9631',
  resource: '\u8d44\u6e90',
  key: '\u5f00\u95e8\u673a\u5173',
  merchant: '\u5546\u4eba',
  attack: '\u653b\u51fb',
  range: '\u5c04\u7a0b',
  durability: '\u8010\u4e45',
  grip: '\u63e1\u6301',
  twoHanded: '\u53cc\u624b',
  oneHanded: '\u5355\u624b',
  health: '\u751f\u547d',
  armorValue: '\u62a4\u7532',
  nextAttack: '\u4e0b\u6b21\u653b\u51fb',
  repair: '\u4fee\u590d\u8010\u4e45',
  attribute: '\u5c5e\u6027',
  active: '\u5df2\u6fc0\u6d3b',
  inactive: '\u672a\u6fc0\u6d3b',
  actionDelay: '\u884c\u52a8\u5ef6\u8fdf',
  cooldown: '\u51b7\u5374',
  normalAttack: '\u666e\u901a\u653b\u51fb',
  normalAttackCooldown: '\u666e\u653b\u51b7\u5374',
  activeSkill: '\u4e3b\u52a8\u6280\u80fd',
  behavior: '\u884c\u4e3a',
  strength: '\u529b\u91cf',
  mastery: '\u638c\u63a7',
  adaptation: '\u5c5e\u6027\u9002\u5e94',
  features: '\u7279\u6027',
  manhattan: '\u66fc\u54c8\u987f\u8ddd\u79bb',
  explosion: '\u89e6\u53d1\u540e\u5bf9\u516b\u90bb\u57df\u9020\u6210\u4f24\u5bb3\u3002',
  alarm: '\u89e6\u53d1\u540e\u7ffb\u5f00\u9644\u8fd1\u7684\u724c\u3002',
  keyHint: '\u62fe\u53d6\u540e\u4f1a\u6c38\u4e45\u5f00\u542f\u5bf9\u5e94\u7684\u623f\u95f4\u95e8\u3002',
})

function normalizedCounter(value) { return Math.max(0, Number(value) || 0) }

function legacyActiveSkill(enemy) {
  if (enemy?.activeSkill?.id) return { ...enemy.activeSkill }
  if (enemy?.summon?.minionId) return { id: 'summon', minionId: enemy.summon.minionId, cooldown: normalizedCounter(enemy.summon.interval) || 3 }
  if (enemy?.behavior === 'self-destruct') return { id: 'self-destruct', cooldown: 3 }
  return null
}

function normalizeEnemyActionState(enemy, { revealed = false } = {}) {
  if (enemy?.kind !== 'enemy') return
  const legacyCooldown = normalizedCounter(enemy.cooldown)
  const hasActionDelay = Number.isFinite(enemy.actionDelay)
  const hasAttackCooldown = Number.isFinite(enemy.attackCooldown)
  const hasActiveSkillCooldown = Number.isFinite(enemy.activeSkillCooldown)
  const activeSkill = legacyActiveSkill(enemy)
  enemy.activeSkill = activeSkill
  enemy.behavior = ['summoner', 'self-destruct'].includes(enemy.behavior)
    ? 'stationary'
    : enemy.behavior === 'patrol' ? 'chaser' : enemy.behavior || 'stationary'
  enemy.traits = (enemy.traits || []).filter((trait) => trait !== 'summoner')
  enemy.initialActionDelay = normalizedCounter(enemy.initialActionDelay)
  enemy.actionDelay = hasActionDelay ? normalizedCounter(enemy.actionDelay) : revealed ? 0 : enemy.initialActionDelay
  enemy.attackCooldownMax = normalizedCounter(enemy.attackCooldownMax ?? enemy.cooldownMax)
  enemy.attackCooldown = hasAttackCooldown ? normalizedCounter(enemy.attackCooldown) : revealed ? legacyCooldown : 0
  enemy.activeSkillCooldown = hasActiveSkillCooldown ? normalizedCounter(enemy.activeSkillCooldown) : revealed ? legacyCooldown : 0
  enemy.hasActed = enemy.hasActed === true
  delete enemy.cooldown
  delete enemy.cooldownMax
  delete enemy.summon
  delete enemy.patrolPath
  delete enemy.patrolIndex
}

const MERCHANT_SERVICE_LABELS = Object.freeze({
  stock: '\u8d2d\u4e70\u5546\u54c1',
  sell: '\u51fa\u552e\u7269\u54c1',
  'relic-management': '\u6fc0\u6d3b\u5723\u9057\u7269',
  'relic-choice': '\u83b7\u53d6\u5723\u9057\u7269',
})

function detailForItem(item) {
  const type = DETAIL_LABELS[item?.type] || '\u7269\u54c1'
  const lines = []
  if (item?.attribute) lines.push(`${DETAIL_LABELS.attribute} ${attributeLabel(item.attribute)}`)
  if (item?.type === 'weapon') {
    lines.push(`${DETAIL_LABELS.attack} ${item.attack || 0}`)
    lines.push(`${DETAIL_LABELS.range} ${item.range || 1}\uff08${DETAIL_LABELS.manhattan}\uff09`)
    lines.push(`${DETAIL_LABELS.durability} ${item.durability || 0}`)
    lines.push(`${DETAIL_LABELS.grip}\uff1a${isTwoHanded(item) ? DETAIL_LABELS.twoHanded : DETAIL_LABELS.oneHanded}`)
  } else if (item?.type === 'potion') {
    lines.push(`${DETAIL_LABELS.health} +${item.heal || 0}`)
  } else if (item?.type === 'armor') {
    lines.push(`${DETAIL_LABELS.armorValue} +${item.armor || 0}`)
  } else if (item?.type === 'buff') {
    const target = item.attackTarget === 'melee' ? '\u4e0b\u6b21\u8fd1\u6218\u653b\u51fb' : DETAIL_LABELS.nextAttack
    lines.push(`${target} +${item.attackBonus || 0}`)
  } else if (item?.type === 'whetstone') {
    lines.push(`${DETAIL_LABELS.repair} +${item.repair || 0}`)
  }
  return { title: item?.name || type, type, lines }
}

export class GameRun {
  constructor({ autoLoad = true, random = Math.random } = {}) {
    this.bus = createEmitter()
    this.on = this.bus.on
    this.off = this.bus.off
    this.random = random
    this._loaded = autoLoad && this.load()
    if (!this._loaded) this.reset({ emit: false })
  }

  get currentRoom() { return this.dungeon?.room(this.player?.roomId) || null }
  get equippedWeapons() { return uniqueWeapons(this.player?.equipment || []) }
  get equippedWeapon() { return this.equippedWeapons[0] || null }
  get selectedItem() {
    return Number.isInteger(this.selectedInventoryIndex)
      ? this.backpack.placementForCellIndex(this.selectedInventoryIndex)?.item || null
      : null
  }
  get selectedEquipment() { return Number.isInteger(this.selectedEquipmentSlot) ? this.player.equipment[this.selectedEquipmentSlot] || null : null }

  reset({ emit = true } = {}) {
    const generated = createLinearDungeon({ random: this.random })
    this.dungeon = generated.dungeon
    this.player = {
      hp: 20,
      maxHp: 20,
      armor: 0,
      gold: 0,
      roomId: generated.startRoomId,
      pos: { ...generated.start },
      equipment: [starterWeapon(), null],
      level: PROGRESSION.startingLevel,
      experience: 0,
      experienceToNext: experienceToNextLevel(PROGRESSION.startingLevel),
      strength: [0, 0],
      mastery: [0, 0],
      adaptations: [null, null],
      pendingAttackBonus: 0,
      pendingAttackBuffs: [],
    }
    this.backpack = new BackpackGrid(INVENTORY_COLUMNS, INVENTORY_ROWS)
    this.relics = new RelicCollection()
    this.relicEngine = new RelicEngine(this.relics)
    this.initialRelicChoices = buildRelicChoices(this.relics, { random: this.random }).map((relic) => relic.id)
    this.turn = 0
    this.phase = 'explore'
    this.gameOver = false
    this.win = false
    this.selectedInventoryIndex = null
    this.selectedEquipmentSlot = null
    this.itemTargeting = false
    this.merchant = null
    this.roomReward = null
    this.roomRewardBag = shuffled(['supply', 'supply', 'supply', 'relic'], this.random)
    this.levelUp = null
    this.relicEventQueue = []
    this.relicRuntime = {}
    this.stealthTurns = 0
    this.detailPanel = null
    this.log = []
    this._log('\u8fdb\u5165\u7b2c 1 \u5c42\u7684\u7b2c 1 \u4e2a\u623f\u95f4\u3002')
    this._log(`\u521d\u59cb\u88c5\u5907\uff1a${this.player.equipment[0].name}\u3002`)
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
  isDoorLocked(door) { return !!this.doorEdge(door)?.locked && !this.doorEdge(door)?.unlocked }
  activeRelics() { return this.relicEngine.activeDefinitions() }

  hasActiveRelic(id) { return this.relics.isActive(id) }

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
    let count = 0
    for (let r = 0; r < room.height; r++) {
      for (let c = 0; c < room.width; c++) {
        const position = { c, r }
        if (!room.isRevealed(position) && (findRevealPath(room, this.player.pos, position)
          || (this.hasActiveRelic('r-long-flip') && manhattan(this.player.pos, position) <= 2))) count += 1
      }
    }
    return count
  }

  _revealEnemy(room, enemy, { cause = 'system' } = {}) {
    if (!room || !enemy || room.isRevealed(enemy.pos)) return false
    room.reveal(enemy.pos)
    if (room.id === this.currentRoom?.id) this.bus.emit('animate:flip', { roomId: room.id, position: { ...enemy.pos } })
    this._emitRelicEvent('card:revealed', { room, position: enemy.pos, cause })
    this._emitRelicEvent('enemy:revealed', { enemy, room, cause })
    return true
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
    const destination = {
      c: enemy.pos.c + directionC * 2,
      r: enemy.pos.r + directionR * 2,
    }
    if (!room.contains(destination)) return false
    const wasHidden = !room.isRevealed(destination)
    if (wasHidden) this._revealTile(destination, { cause: 'relic:backline-ricochet' })
    const target = room.entityAt(destination)
    if (target?.kind === 'enemy') this._damageEnemy(target, damage, { source: 'relic:backline-ricochet' })
    return wasHidden || target?.kind === 'enemy'
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
  canManageRelics() {
    return this.phase === 'merchant'
      && this.merchantDefinition?.services.includes('relic-management')
      && !this.merchantEntity?.relicManagementConfirmed
  }

  canSellAtMerchant() { return this.phase === 'merchant' && this.merchantDefinition?.services.includes('sell') }

  _drawRoomRewardType() {
    if (!this.roomRewardBag.length) this.roomRewardBag = shuffled(['supply', 'supply', 'supply', 'relic'], this.random)
    return this.roomRewardBag.shift() || 'supply'
  }

  _queueLevelUp() {
    if (this.levelUp || this.gameOver || this.player.experience < this.player.experienceToNext) return false
    const choices = buildLevelUpChoices(this.player, { random: this.random })
    if (!choices.length) return false
    this.levelUp = { choices, adaptationHand: null }
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
    if (this.phase !== 'level-up' || this.levelUp?.adaptationHand != null || !this.levelUp.choices.includes(id)) return false
    const option = getLevelUpOption(id)
    if (!option) return false
    if (id === 'left-adaptation' || id === 'right-adaptation') {
      this.levelUp.adaptationHand = id.startsWith('left') ? 0 : 1
      this._changed()
      return true
    }
    this._applyLevelUpOption(id)
    return true
  }

  chooseAdaptation(attribute) {
    const hand = this.levelUp?.adaptationHand
    if (this.phase !== 'level-up' || !Number.isInteger(hand) || !ATTRIBUTE_ORDER.includes(attribute) || this.player.adaptations[hand]) return false
    this.player.adaptations[hand] = attribute
    this._log(`\u83b7\u5f97${hand === 0 ? '\u5de6\u624b' : '\u53f3\u624b'}${attributeLabel(attribute)}\u9002\u5e94\u3002`)
    this._finishLevelUp()
    return true
  }

  _applyLevelUpOption(id) {
    if (id === 'vitality') {
      this.player.maxHp += 2
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2)
    } else if (id === 'left-strength' || id === 'right-strength') {
      const hand = id.startsWith('left') ? 0 : 1
      this.player.strength[hand] += 1
    } else if (id === 'left-mastery' || id === 'right-mastery') {
      const hand = id.startsWith('left') ? 0 : 1
      this.player.mastery[hand] += 1
    } else if (id === 'emergency-supply') {
      this.player.gold += PROGRESSION.emergencySupply.gold
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + PROGRESSION.emergencySupply.heal)
    } else {
      return false
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
    if (this.levelUp?.adaptationHand != null) return adaptationChoices()
    return (this.levelUp?.choices || []).map((id) => getLevelUpOption(id)).filter(Boolean)
  }

  showItemDetail(item) {
    if (!item) return false
    const detail = detailForItem(item)
    if (item.type === 'weapon') {
      const hands = weaponHands(this.player, item)
      if (hands.length) {
        const adaptations = hands.map((hand) => this.player.adaptations[hand]).filter(Boolean).map(attributeLabel)
        detail.lines.push(`${DETAIL_LABELS.strength} +${weaponStrength(this.player, item)}`)
        detail.lines.push(`${DETAIL_LABELS.mastery} ${weaponMastery(this.player, item)}`)
        if (adaptations.length) detail.lines.push(`${DETAIL_LABELS.adaptation} ${adaptations.join('/')}`)
      }
    }
    return this._showDetail({ position: 'top', ...detail })
  }

  weaponGrowth(weapon) {
    return {
      strength: weaponStrength(this.player, weapon),
      mastery: weaponMastery(this.player, weapon),
      adaptations: weaponHands(this.player, weapon).map((hand) => this.player.adaptations[hand]).filter(Boolean),
    }
  }

  showRelicDetail(id) {
    const definition = getRelicDefinition(id)
    if (!definition) return false
    const entry = this.relics.entries.find((candidate) => candidate.id === id)
    const lines = [definition.description, entry?.active ? DETAIL_LABELS.active : DETAIL_LABELS.inactive]
    if (definition.activeSkill) {
      const cooldown = this.relicRuntime[id]?.cooldown || 0
      lines.push(`${definition.activeSkill.name} \u00b7 ${DETAIL_LABELS.cooldown} ${cooldown}/${definition.activeSkill.cooldown}`)
    }
    return this._showDetail({ position: 'top', title: definition.name, type: DETAIL_LABELS.relic, lines })
  }

  showBoardDetail(position) {
    const room = this.currentRoom
    if (!room?.contains(position) || !room.isRevealed(position)) return false
    if (this.player.pos.c === position.c && this.player.pos.r === position.r) return false
    const entity = room.entityAt(position)
    if (!entity || entity.kind === 'stairs') return false
    if (entity.kind === 'item') return this._showDetail({ position: 'bottom', ...detailForItem(entity.item) })
    if (entity.kind === 'enemy') {
      const features = enemyFeatureLabel(entity)
      const activeSkill = enemyActiveSkillLabel(entity.activeSkill)
      const lines = [
        `${DETAIL_LABELS.attribute} ${attributeLabel(entity.attribute)}`,
        `${DETAIL_LABELS.health} ${entity.hp}/${entity.maxHp}`,
        `${DETAIL_LABELS.behavior} ${enemyBehaviorLabel(entity.behavior)}`,
        `${DETAIL_LABELS.normalAttack} ${entity.attack} \u00b7 ${DETAIL_LABELS.range} ${entity.range || 1}\uff08${DETAIL_LABELS.manhattan}\uff09`,
        `${DETAIL_LABELS.actionDelay} ${normalizedCounter(entity.actionDelay)}/${normalizedCounter(entity.initialActionDelay)}`,
        `${DETAIL_LABELS.normalAttackCooldown} ${normalizedCounter(entity.attackCooldown)}/${normalizedCounter(entity.attackCooldownMax)}`,
      ]
      if (activeSkill) lines.push(`${DETAIL_LABELS.activeSkill} ${activeSkill} \u00b7 ${DETAIL_LABELS.cooldown} ${normalizedCounter(entity.activeSkillCooldown)}/${normalizedCounter(entity.activeSkill?.cooldown)}`)
      if (features) lines.push(`${DETAIL_LABELS.features} ${features}`)
      return this._showDetail({
        position: 'bottom',
        title: entity.name,
        type: DETAIL_LABELS.enemy,
        lines,
      })
    }
    if (entity.kind === 'trap') {
      const trap = getTrapDefinition(entity.trapId)
      if (!trap) return false
      const effect = trap.effect === 'explosion'
        ? `${DETAIL_LABELS.explosion} ${DETAIL_LABELS.attack} ${trap.damage || 0}`
        : DETAIL_LABELS.alarm
      return this._showDetail({ position: 'bottom', title: trap.name, type: DETAIL_LABELS.trap, lines: [effect] })
    }
    if (entity.kind === 'gold') {
      return this._showDetail({ position: 'bottom', title: '\u91d1\u5e01', type: DETAIL_LABELS.resource, lines: [`+${entity.amount || 0} \u91d1\u5e01`] })
    }
    if (entity.kind === 'key') {
      return this._showDetail({ position: 'bottom', title: DETAIL_LABELS.key, type: DETAIL_LABELS.resource, lines: [DETAIL_LABELS.keyHint] })
    }
    if (entity.kind === 'merchant') {
      const services = (entity.services || []).map((service) => MERCHANT_SERVICE_LABELS[service]).filter(Boolean)
      return this._showDetail({ position: 'bottom', title: entity.name, type: DETAIL_LABELS.merchant, lines: services })
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
    this.detailPanel = { ...detail, lines: [...(detail.lines || [])] }
    this.bus.emit('detail')
    return true
  }

  activeRelicSkills() {
    return this.activeRelics()
      .filter((definition) => definition.activeSkill)
      .map((definition) => ({ relicId: definition.id, ...definition.activeSkill, cooldownRemaining: this.relicRuntime[definition.id]?.cooldown || 0 }))
  }

  _emitRelicEvent(event, context = {}) {
    const actions = this.relicEngine.emit(event, { run: this, event, ...context })
    this.relicEventQueue.push(...actions.filter((action) => action && typeof action === 'object'))
    while (this.relicEventQueue.length) {
      const action = this.relicEventQueue.shift()
      if (action.type === 'heal') this._healPlayer(action.amount, { source: action.source || `relic:${event}` })
      if (action.type === 'armor') this.player.armor += Math.max(0, action.amount || 0)
      if (action.type === 'gold') this.player.gold += Math.max(0, Math.floor(action.amount || 0))
      if (action.type === 'repair' && action.weapon?.type === 'weapon') action.weapon.durability += Math.max(0, Math.floor(action.amount || 0))
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

  _tickRelicSkillCooldowns() {
    for (const runtime of Object.values(this.relicRuntime)) {
      if (runtime?.cooldown > 0) runtime.cooldown -= 1
    }
  }

  useRelicSkill(relicId) {
    if (!this._canAct()) return false
    const definition = this.activeRelics().find((relic) => relic.id === relicId)
    const skill = definition?.activeSkill
    if (!skill || (this.relicRuntime[relicId]?.cooldown || 0) > 0) return false
    const outcome = this._resolveActiveSkill(skill)
    if (!outcome) return false
    this.relicRuntime[relicId] = { cooldown: skill.cooldown + 1 }
    this._emitRelicEvent('skill:used', { relicId, skillId: skill.id })
    this._log(`\u53d1\u52a8\u4e3b\u52a8\u6280\u80fd\uff1a${skill.name}\u3002`)
    this._endTurn({ skipEnemyIds: outcome.skipEnemyIds })
    this._changed()
    return true
  }

  _resolveActiveSkill(skill) {
    const room = this.currentRoom
    if (!room) return null
    if (skill.id === 'command-shout') {
      const skipEnemyIds = new Set()
      const enemies = [...room.entities.values()].filter((entity) => entity.kind === 'enemy')
      for (const enemy of enemies) {
        if (!room.isRevealed(enemy.pos)) {
          room.reveal(enemy.pos)
          this.bus.emit('animate:flip', { roomId: room.id, position: { ...enemy.pos } })
          skipEnemyIds.add(enemy.id)
        }
      }
      const entry = room.entry || this.player.pos
      const destinations = neighbors8(entry, room.width, room.height)
        .filter((position) => room.isEmpty(position) && (position.c !== this.player.pos.c || position.r !== this.player.pos.r))
      let moved = 0
      for (const enemy of enemies) {
        const destination = destinations.shift()
        if (!destination) break
        if (room.moveEntity(enemy.id, destination)) {
          room.reveal(destination)
          moved += 1
        }
      }
      this._log(`\u53f7\u4ee4\u4e4b\u58f0\uff1a\u7ffb\u5f00 ${enemies.length} \u4e2a\u654c\u4eba\uff0c\u62c9\u8fd1 ${moved} \u4e2a\u3002`)
      return { skipEnemyIds }
    }
    if (skill.id === 'shadow-hide') {
      this.stealthTurns = 3
      return { skipEnemyIds: new Set() }
    }
    return null
  }

  setDebugReveal(reveal) {
    this.debugReveal = reveal === true
    this.bus.emit('change')
  }

  acquireRelic(id, { activate = null } = {}) {
    const definition = getRelicDefinition(id)
    if (!definition) return this._reject('\u672a\u77e5\u5723\u9057\u7269\u3002')
    const shouldActivate = activate == null ? this.relics.active.length < this.relics.maxActive : activate
    const entry = this.relics.acquire(id, { activate: shouldActivate })
    if (!entry) return this._reject('\u6b64\u5723\u9057\u7269\u5df2\u62e5\u6709\u3002')
    this._log(`\u83b7\u5f97\u5723\u9057\u7269\uff1a${definition.name}${entry.active ? '' : '\uff08\u672a\u6fc0\u6d3b\uff09'}\u3002`)
    this._changed()
    return entry
  }

  chooseInitialRelic(id) {
    if (this.relics.entries.length > 0 || !this.initialRelicChoices.includes(id)) return false
    const entry = this.acquireRelic(id, { activate: true })
    if (entry) {
      this.initialRelicChoices = []
      this._changed()
    }
    return entry
  }

  activateRelic(id) {
    if (!this.canManageRelics()) return false
    const changed = this.relics.activate(id)
    if (changed) this._changed()
    return changed
  }

  deactivateRelic(id) {
    if (!this.canManageRelics()) return false
    const changed = this.relics.deactivate(id)
    if (changed) this._changed()
    return changed
  }

  confirmRelicLoadout() {
    const merchant = this.merchantEntity
    if (!this.canManageRelics() || !merchant) return false
    merchant.relicManagementConfirmed = true
    this._log(`${merchant.name}\u7684\u5723\u9057\u7269\u914d\u7f6e\u5df2\u786e\u8ba4\u3002`)
    this._changed()
    return true
  }

  tileCanBeFlipped(position) {
    const room = this.currentRoom
    return !!room && !room.isRevealed(position) && (!!findRevealPath(room, this.player.pos, position)
      || (this.hasActiveRelic('r-long-flip') && manhattan(this.player.pos, position) <= 2))
  }

  previewTileAction(c, r) {
    if (!this._canAct()) return null
    const room = this.currentRoom
    const target = { c, r }
    if (!room?.contains(target)) return null
    if (!room.isRevealed(target)) {
      const route = findRevealPath(room, this.player.pos, target)
      if (route) return this._pathPreview('flip', target, route.path)
      return this.hasActiveRelic('r-long-flip') && manhattan(this.player.pos, target) <= 2
        ? this._pathPreview('flip', target, [])
        : null
    }
    const entity = room.entityAt(target)
    if (!entity) {
      const path = findPath(room, this.player.pos, target)
      return path ? this._pathPreview('move', target, path) : null
    }
    if (entity.kind === 'enemy') {
      const weapons = this.equippedWeapons.filter((weapon) => weapon.durability > 0)
      const route = findAttackPath(room, this.player.pos, entity, weapons.length ? weapons : [{ range: 1 }])
      return route ? this._pathPreview('attack', target, route.path) : null
    }
    if (entity.kind === 'merchant') {
      const route = findInteractionPath(room, this.player.pos, entity)
      return route ? this._pathPreview('merchant', target, route.path) : null
    }
    if (entity.kind === 'item' && !this.backpack.canFit(entity.item)) return null
    const path = findPath(room, this.player.pos, target, { allowGoalOccupied: true })
    return path ? this._pathPreview('pickup', target, path) : null
  }

  previewDoorAction(doorId) {
    if (!this._canAct()) return null
    const room = this.currentRoom
    const door = this.dungeon.door(doorId)
    if (!room || !door || door.roomId !== room.id || this.isDoorLocked(door)) return null
    const path = findDoorPath(room, this.player.pos, door)
    if (!path) return null
    return { ...this._pathPreview('door', door.arrival, path), targeted: true, doorId: door.id }
  }

  _pathPreview(kind, target, path) {
    const dangerSteps = path.filter((step) => this._activeEnemies()
      .some((enemy) => combatDistance(step, enemy.pos, enemy.range) <= enemy.range))
    return {
      kind,
      target: { ...target },
      path: path.map((step) => ({ ...step })),
      arrival: { ...(path.at(-1) || this.player.pos) },
      targeted: ['attack', 'flip', 'merchant'].includes(kind),
      danger: dangerSteps.length > 0,
      dangerSteps: dangerSteps.map((step) => ({ ...step })),
    }
  }

  selectInventory(index) {
    if (!Number.isInteger(index) || index < 0 || index >= INVENTORY_CAPACITY) return false
    const placement = this.backpack.placementForCellIndex(index)
    if (!placement) return this.clearSelection()
    const origin = this.backpack.originIndex(placement)
    if (this.selectedInventoryIndex === origin && !this.itemTargeting) return this.clearSelection()
    this.selectedInventoryIndex = origin
    this.selectedEquipmentSlot = null
    this.itemTargeting = false
    this._changed()
    return true
  }

  clearSelection() {
    if (this.selectedInventoryIndex == null && this.selectedEquipmentSlot == null && !this.itemTargeting) return false
    this.selectedInventoryIndex = null
    this.selectedEquipmentSlot = null
    this.itemTargeting = false
    this._changed()
    return true
  }

  moveInventory(itemUid, index) {
    if (!Number.isInteger(index) || index < 0 || index >= INVENTORY_CAPACITY) return false
    const item = this.backpack.placementOf(itemUid)?.item
    if (!item) return false
    const moved = this.backpack.movePreferred(item.uid, index % INVENTORY_COLUMNS, Math.floor(index / INVENTORY_COLUMNS))
    if (!moved) return false
    this.selectedInventoryIndex = this.backpack.originIndex(this.backpack.placementOf(item.uid))
    this.selectedEquipmentSlot = null
    this.itemTargeting = false
    this._changed()
    return true
  }

  moveSelectedInventory(index) {
    const item = this.selectedItem
    return item ? this.moveInventory(item.uid, index) : false
  }

  rotateSelectedInventory() {
    const item = this.selectedItem
    if (!item || !this.backpack.rotate(item.uid)) return false
    this.selectedInventoryIndex = this.backpack.originIndex(this.backpack.placementOf(item.uid))
    this._changed()
    return true
  }

  selectEquipmentSlot(slot) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= EQUIPMENT_SLOTS) return false
    if (slot === 0 && isTwoHanded(this.player.equipment[1])) return false
    this.selectedEquipmentSlot = this.player.equipment[slot] && this.selectedEquipmentSlot !== slot ? slot : null
    this.selectedInventoryIndex = null
    this._changed()
    return true
  }

  applySelectedItemToEquipment(slot) {
    if (!this._canAct() || !this.itemTargeting || !Number.isInteger(slot) || slot < 0 || slot >= EQUIPMENT_SLOTS) return false
    const weapon = this.player.equipment[slot]
    return this._applySelectedWhetstone(weapon)
  }

  applySelectedItemToBackpackWeapon(index) {
    if (!this._canAct() || !this.itemTargeting || !Number.isInteger(index) || index < 0 || index >= INVENTORY_CAPACITY) return false
    const weapon = this.backpack.placementForCellIndex(index)?.item
    if (weapon?.type !== 'weapon') return false
    return this._applySelectedWhetstone(weapon)
  }

  _applySelectedWhetstone(weapon) {
    const item = this.selectedItem
    if (!item || item.type !== 'whetstone' || !weapon) return false
    weapon.durability += item.repair
    this.backpack.removeByUid(item.uid)
    this.selectedInventoryIndex = null
    this.itemTargeting = false
    this._log(`\u4f7f\u7528 ${item.name}\uff0c${weapon.name} \u8010\u4e45 +${item.repair}\u3002`)
    this._endTurn()
    this._changed()
    return true
  }

  wait() {
    if (!this._canAct()) return false
    this._log('\u4f60\u9009\u62e9\u7b49\u5f85\u3002')
    this._endTurn()
    this._changed()
    return true
  }

  equipSelected(slot = null) {
    if (!this._canAct()) return false
    const item = this.selectedItem
    if (!item || item.type !== 'weapon') return this._reject('\u8bf7\u5148\u9009\u4e2d\u4e00\u628a\u6b66\u5668\u3002')
    const emptySlot = this.player.equipment.findIndex((weapon) => !weapon)
    const targetSlot = Number.isInteger(slot) && slot >= 0 && slot < EQUIPMENT_SLOTS
      ? slot
      : Number.isInteger(this.selectedEquipmentSlot) ? this.selectedEquipmentSlot : emptySlot >= 0 ? emptySlot : 0
    const nextEquipment = [...this.player.equipment]
    if (isTwoHanded(item)) {
      nextEquipment[0] = item
      nextEquipment[1] = item
    } else {
      if (isTwoHanded(nextEquipment[targetSlot])) {
        nextEquipment[0] = null
        nextEquipment[1] = null
      }
      nextEquipment[targetSlot] = item
    }
    const displaced = uniqueWeapons(this.player.equipment).filter((weapon) => !nextEquipment.includes(weapon))
    const preview = BackpackGrid.hydrate(this.backpack.serialize(clone))
    preview.removeByUid(item.uid)
    for (const weapon of displaced) {
      if (!preview.add(weapon)) return this._reject('\u80cc\u5305\u6ca1\u6709\u8db3\u591f\u7a7a\u95f4\u6362\u4e0b\u6b64\u6b66\u5668\u3002')
    }
    this.backpack.removeByUid(item.uid)
    for (const weapon of displaced) this.backpack.add(weapon)
    this.player.equipment = nextEquipment
    this.selectedInventoryIndex = null
    this.selectedEquipmentSlot = null
    this._log(`\u88c5\u5907 ${item.name}\u3002`)
    this._endTurn()
    this._changed()
    return true
  }

  discardSelected() {
    const item = this.selectedItem
    if (item) {
      this.backpack.removeByUid(item.uid)
      this._log(`\u4e22\u5f03 ${item.name}\u3002`)
      this.selectedInventoryIndex = null
    } else {
      const weapon = this.selectedEquipment
      if (!weapon) return false
      this.player.equipment = this.player.equipment.map((equipped) => equipped?.uid === weapon.uid ? null : equipped)
      this._log(`\u4e22\u5f03 ${weapon.name}\u3002`)
      this.selectedEquipmentSlot = null
    }
    this.itemTargeting = false
    this._changed()
    return true
  }

  useSelected() {
    const item = this.selectedItem
    if (!item || !this._canAct()) return false
    if (item.type === 'potion') {
      const healed = this._healPlayer(item.heal, { source: 'item:potion', item })
      this.backpack.removeByUid(item.uid)
      this.selectedInventoryIndex = null
      this.itemTargeting = false
      this._log(`\u4f7f\u7528 ${item.name}\uff0c\u6062\u590d ${healed} HP\u3002`)
      this._changed()
      return true
    }
    if (item.type === 'armor') {
      this.player.armor += item.armor
      this.backpack.removeByUid(item.uid)
      this.selectedInventoryIndex = null
      this.itemTargeting = false
      this._log(`\u4f7f\u7528 ${item.name}\uff0c\u62a4\u7532 +${item.armor}\u3002`)
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
      this._changed()
      return true
    }
    if (item.type === 'whetstone') {
      const hasTarget = this.equippedWeapons.some((weapon) => weapon.type === 'weapon')
        || this.backpack.items.some((candidate) => candidate.type === 'weapon')
      if (!hasTarget) return this._reject('\u6ca1\u6709\u53ef\u4fee\u590d\u7684\u6b66\u5668\u3002')
      this.itemTargeting = true
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
    if (!room.isRevealed(position)) return this._flipAt(position)
    const entity = room.entityAt(position)
    if (!entity) return this._moveTo(position)
    if (entity.kind === 'enemy') return this._attack(entity)
    if (entity.kind === 'merchant') return this._interactMerchant(entity)
    return this._pickUp(entity)
  }

  clickDoor(doorId) {
    if (!this._canAct()) return false
    const door = this.dungeon.door(doorId)
    if (!door || door.roomId !== this.currentRoom?.id) return false
    return this._useDoor(door)
  }

  _interactMerchant(merchant) {
    const route = findInteractionPath(this.currentRoom, this.player.pos, merchant)
    if (!route) return this._reject('\u65e0\u6cd5\u9760\u8fd1\u8fd9\u4f4d\u5546\u4eba\u3002')
    const movement = this._walk(route.path)
    this._endTurn({ interceptorId: movement.interceptorId })
    if (!movement.stopped && !this.gameOver) {
      this.merchant = { entityId: merchant.id }
      if (this.merchantDefinition?.services.includes('relic-choice') && !merchant.relicOfferResolved) {
        merchant.relicChoices = buildRelicChoices(this.relics, { random: this.random }).map((relic) => relic.id)
      }
      this.phase = 'merchant'
      this.selectedInventoryIndex = null
      this.selectedEquipmentSlot = null
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
    const item = this.selectedItem || this.selectedEquipment
    if (!item) return this._reject('\u8bf7\u5148\u9009\u4e2d\u8981\u51fa\u552e\u7684\u7269\u54c1\u3002')
    const price = merchantSellPrice(item)
    if (this.selectedItem) {
      this.backpack.removeByUid(item.uid)
      this.selectedInventoryIndex = null
    } else {
      this.player.equipment = this.player.equipment.map((equipped) => equipped?.uid === item.uid ? null : equipped)
      this.selectedEquipmentSlot = null
    }
    this.itemTargeting = false
    this.player.gold += price
    this._log(`\u51fa\u552e ${item.name}\uff0c\u83b7\u5f97 ${price} \u91d1\u5e01\u3002`)
    this._changed()
    return true
  }

  chooseMerchantRelic(id) {
    const merchant = this.merchantEntity
    if (!this.canManageRelics() || !merchant || merchant.relicOfferResolved || !merchant.relicChoices?.includes(id)) return false
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

  _flipAt(position) {
    const route = findRevealPath(this.currentRoom, this.player.pos, position)
    const remoteFlip = this.hasActiveRelic('r-long-flip') && manhattan(this.player.pos, position) <= 2
    if (!route && !remoteFlip) return this._reject('\u65e0\u6cd5\u8d70\u5230\u8fd9\u5f20\u724c\u7684\u65c1\u8fb9\u3002')
    const start = { ...this.player.pos }
    const movement = this._walk(route?.path || [])
    let flipOutcome = { skipEnemyIds: new Set() }
    if (!movement.stopped) {
      if (this.player.pos.c !== start.c || this.player.pos.r !== start.r) this.bus.emit('change')
      flipOutcome = this._revealTile(position)
      const entity = this.currentRoom.entityAt(position)
      this._log(entity ? `\u7ffb\u5f00\uff1a${entity.name || this._entityName(entity)}\u3002` : '\u7ffb\u5f00\u4e86\u4e00\u4e2a\u7a7a\u683c\u3002')
    }
    this._endTurn({ interceptorId: movement.interceptorId, skipEnemyIds: flipOutcome.skipEnemyIds })
    this._changed()
    return true
  }

  _revealTile(position, { cause = 'player' } = {}) {
    const room = this.currentRoom
    if (!room?.reveal(position)) return { skipEnemyIds: new Set() }
    this.bus.emit('animate:flip', { roomId: room.id, position: { ...position } })
    this._emitRelicEvent('card:revealed', { room, position, cause })
    const entity = room.entityAt(position)
    if (entity?.kind === 'enemy') this._emitRelicEvent('enemy:revealed', { enemy: entity, room, cause })
    if (entity?.kind === 'trap') return this._triggerTrap(entity, { cause })
    return { skipEnemyIds: new Set() }
  }

  _triggerTrap(trap, { cause = 'player' } = {}) {
    const room = this.currentRoom
    const definition = getTrapDefinition(trap.trapId)
    const skipEnemyIds = new Set()
    if (!room || !definition) return { skipEnemyIds }
    if (!this.suppressedTrapIds) this.suppressedTrapIds = new Set()
    this.suppressedTrapIds.delete(trap.id)
    this._emitRelicEvent('trap:before-trigger', { trap, definition, cause })
    room.removeEntity(trap.id)
    if (this.suppressedTrapIds.has(trap.id)) {
      this.suppressedTrapIds.delete(trap.id)
      this._log(`${definition.name}\u88ab\u5b89\u5168\u62c6\u9664\u3002`)
      return { skipEnemyIds }
    }
    if (definition.effect === 'explosion') {
      const result = this._damagePlayer(definition.damage, { source: 'trap:explosion' })
      this._log(`${definition.name}\u89e6\u53d1\uff0c\u4f60\u53d7\u5230 ${result.healthDamage} \u70b9\u4f24\u5bb3\u3002`)
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
      for (const enemy of targets) {
        room.reveal(enemy.pos)
        enemy.actionDelay = Math.max(normalizedCounter(enemy.actionDelay), 1)
        skipEnemyIds.add(enemy.id)
        this.bus.emit('animate:flip', { roomId: room.id, position: { ...enemy.pos } })
      }
      this._log(`${definition.name}\u89e6\u53d1\uff0c\u7ffb\u5f00\u4e86 ${targets.length} \u4e2a\u9644\u8fd1\u654c\u4eba\u3002`)
    }
    this._emitRelicEvent('trap:triggered', { trap, definition, cause })
    return { skipEnemyIds }
  }

  _revealRandomHidden(cause) {
    const room = this.currentRoom
    if (!room) return false
    const candidates = []
    for (let r = 0; r < room.height; r++) {
      for (let c = 0; c < room.width; c++) {
        const position = { c, r }
        if (!room.isRevealed(position)) candidates.push(position)
      }
    }
    const position = candidates[Math.floor(this.random() * candidates.length)]
    if (!position) return false
    this._revealTile(position, { cause })
    this._log(`\u85cf\u533f\u4e4b\u5f71\u7ffb\u5f00\u4e86\u4e00\u5f20\u724c\u3002`)
    return true
  }

  _moveTo(position) {
    const route = findPath(this.currentRoom, this.player.pos, position)
    if (!route) return this._reject('\u76ee\u6807\u4e0d\u53ef\u8fbe\u3002')
    const movement = this._walk(route)
    this._endTurn({ interceptorId: movement.interceptorId })
    this._changed()
    return true
  }

  _pickUp(entity) {
    const room = this.currentRoom
    if (entity.kind === 'item' && !this.backpack.canFit(entity.item)) return this._reject('\u80cc\u5305\u6ca1\u6709\u8db3\u591f\u7a7a\u95f4\uff0c\u65e0\u6cd5\u5f00\u59cb\u79fb\u52a8\u3002')
    const route = findPath(room, this.player.pos, entity.pos, { allowGoalOccupied: true })
    if (!route) return this._reject('\u76ee\u6807\u4e0d\u53ef\u8fbe\u3002')
    const movement = this._walk(route)
    if (!movement.stopped) {
      room.removeEntity(entity.id)
      if (entity.kind === 'item') {
        this._putInInventory(entity.item)
        this._log(`\u83b7\u5f97 ${entity.item.name}\u3002`)
        this._emitRelicEvent('item:collected', { item: entity.item })
      } else if (entity.kind === 'gold') {
        this.player.gold += entity.amount
        this._log(`\u83b7\u5f97 ${entity.amount} \u91d1\u5e01\u3002`)
        this._emitRelicEvent('gold:collected', { amount: entity.amount })
      } else if (entity.kind === 'key') {
        const edge = this.dungeon.edge(entity.edgeId)
        edge.unlocked = true
        this._log('\u627e\u5230\u4e86\u5f00\u95e8\u673a\u5173\uff0c\u5bf9\u5e94\u95e8\u5df2\u6c38\u4e45\u6253\u5f00\u3002')
        this._emitRelicEvent('key:collected', { key: entity, edge })
      }
    }
    this._endTurn({ interceptorId: movement.interceptorId })
    this._changed()
    return true
  }

  _useDoor(door) {
    const edge = this.doorEdge(door)
    if (!edge?.unlocked) return this._reject('\u95e8\u88ab\u673a\u5173\u9501\u4f4f\u4e86\u3002')
    const route = findDoorPath(this.currentRoom, this.player.pos, door)
    if (!route) return this._reject('\u65e0\u6cd5\u9760\u8fd1\u8fd9\u6247\u95e8\u3002')
    const movement = this._walk(route)
    if (movement.stopped) {
      this._endTurn({ interceptorId: movement.interceptorId })
      this._changed()
      return true
    }
    const targetDoor = this.dungeon.otherDoor(door)
    const targetRoom = this.dungeon.room(targetDoor?.roomId)
    if (!targetDoor || !targetRoom) return this._reject('\u95e8\u7684\u8fde\u63a5\u635f\u574f\u3002')
    this._emitRelicEvent('room:left', { room: this.currentRoom })
    const firstVisit = !targetRoom.visited
    targetRoom.reveal(targetDoor.arrival)
    targetRoom.visited = true
    this.player.roomId = targetRoom.id
    this.player.pos = { ...targetDoor.arrival }
    this._log(`\u8fdb\u5165 ${this.roomLabel(targetRoom)}\u3002`)
    this._endTurn({ skipEnemyPhase: true })
    this._emitRelicEvent('room:entered', { room: targetRoom, firstVisit })
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

  _attack(enemy) {
    const weapons = this.equippedWeapons.filter((weapon) => weapon.durability > 0)
    const attackers = weapons.length
      ? weapons.map((weapon) => ({ weapon, unarmed: false }))
      : [{ weapon: { name: '\u5f92\u624b', range: 1 }, unarmed: true }]
    const route = findAttackPath(this.currentRoom, this.player.pos, enemy, attackers.map((attacker) => attacker.weapon))
    if (!route) return this._reject('\u6ca1\u6709\u53ef\u8fbe\u7684\u653b\u51fb\u4f4d\u7f6e\u3002')
    const movement = this._walk(route.path)
    const roomState = this._roomRuntime()
    const firstAttackInRoom = !roomState.firstAttackUsed
    const vanguardStrike = this.hasActiveRelic('r-vanguard-strike') && firstAttackInRoom
    if (!movement.stopped) {
      for (const { weapon, unarmed } of attackers) {
        if (!this.currentRoom?.entity(enemy.id)) break
        if (combatDistance(this.player.pos, enemy.pos, weapon.range) > weapon.range) continue
        if (unarmed) {
          if (this._tryTenthAttackTransmutation(enemy)) break
          const bonus = vanguardStrike && !enemy.hasActed ? 2 : 0
          const hit = this._damageEnemy(enemy, 1 + bonus)
          this._emitRelicEvent('attack:hit', { enemy, weapon: null, damage: hit.damage, countered: false, defeated: hit.defeated })
          this._log(`${weapon.name}\u5bf9 ${enemy.name}${hit.finishedDowned ? '\u7ec8\u7ed3\u4e86' : '\u9020\u6210'} ${hit.damage} \u4f24\u5bb3\u3002`)
          if (hit.defeated) break
          continue
        }
        if (weapon.durability <= 0) continue
        if (this._tryTenthAttackTransmutation(enemy)) break
        const mastery = weaponMastery(this.player, weapon)
        const durabilityPreserved = this.random() < masteryPreservationChance(mastery)
        const type = attackAttributeModifier(weapon, enemy, { adapted: weaponIsAdapted(this.player, weapon) })
        const relicModifiers = this.relicEngine.damageModifiers({
          run: this,
          weapon,
          target: enemy,
          player: this.player,
          room: this.currentRoom,
          firstAttackInRoom,
          countered: type.countered,
          resisted: type.resisted,
        })
        const matchingBuffs = (this.player.pendingAttackBuffs || [])
          .filter((buff) => buff.target !== 'melee' || weapon.range === 1)
        const outcome = computeAttackDamage({
          weapon,
          target: enemy,
          strengthBonus: weaponStrength(this.player, weapon),
          pendingAttackBonus: matchingBuffs.reduce((total, buff) => total + buff.amount, 0),
          ignoreLastDurability: durabilityPreserved,
          relicModifiers,
          terrainModifiers: terrainDamageModifiers(this.currentRoom, this.player.pos),
        })
        const hit = this._damageEnemy(enemy, outcome.damage)
        this._emitRelicEvent('attack:hit', { enemy, weapon, damage: hit.damage, countered: outcome.countered, defeated: hit.defeated })
        if (matchingBuffs.length > 0) {
          this.player.pendingAttackBuffs = this.player.pendingAttackBuffs.filter((buff) => !matchingBuffs.includes(buff))
          this.player.pendingAttackBonus = this.player.pendingAttackBuffs.reduce((total, buff) => total + buff.amount, 0)
        }
        if (!durabilityPreserved && !vanguardStrike) weapon.durability -= 1
        if (hit.defeated) this._emitRelicEvent('attack:enemy-defeated', { enemy, weapon, countered: outcome.countered, hand: weaponHands(this.player, weapon)[0] })
        const relation = outcome.countered ? '\u514b\u5236\u00b7' : outcome.resisted ? '\u53d7\u5236\u00b7' : ''
        const action = hit.finishedDowned ? '\u7ec8\u7ed3\u4e86' : '\u9020\u6210'
        this._log(`${relation}${weapon.name} \u5bf9 ${enemy.name}${action} ${hit.damage} \u4f24\u5bb3\u3002`)
        if (durabilityPreserved) this._log(`${weapon.name}\u7684\u638c\u63a7\u4fdd\u7559\u4e86\u8010\u4e45\u3002`)
        if (weapon.durability <= 0) {
          this._log(`${weapon.name} \u635f\u6bc1\u4e86\u3002`)
          this.player.equipment = this.player.equipment.map((equipped) => equipped?.uid === weapon.uid ? null : equipped)
          this._emitRelicEvent('weapon:broken', { weapon, target: enemy })
        }
        if (hit.defeated) break
      }
    }
    roomState.firstAttackUsed = true
    if (!this.gameOver) this._endTurn({ interceptorId: movement.interceptorId })
    this._changed()
    return true
  }

  _walk(path) {
    const roomId = this.currentRoom?.id
    const finalPosition = path[path.length - 1] || this.player.pos
    let interceptorId = null
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
      this._triggerAmbushes(step)
      if (this.gameOver) return { interceptorId, stopped: true }
      const interceptor = this._findInterceptor(previous, step, finalPosition)
      if (!interceptor) continue
      interceptorId = interceptor.id
      if (this.random() < 0.3) {
        this._log(`${interceptor.name} \u62e6\u4e0b\u4e86\u4f60\u3002`)
        return { interceptorId, stopped: true }
      }
    }
    return { interceptorId, stopped: false }
  }

  _findInterceptor(previous, step, finalPosition) {
    const candidates = this._activeEnemies()
      .filter((enemy) => enemy.attack > 0 && normalizedCounter(enemy.actionDelay) === 0 && normalizedCounter(enemy.attackCooldown) === 0)
      .filter((enemy) => combatDistance(previous, enemy.pos, enemy.range) > enemy.range)
      .filter((enemy) => combatDistance(step, enemy.pos, enemy.range) <= enemy.range)
      .filter((enemy) => combatDistance(finalPosition, enemy.pos, enemy.range) > enemy.range)
    return candidates[0] || null
  }

  _endTurn({ interceptorId = null, skipEnemyPhase = false, skipEnemyIds = new Set() } = {}) {
    this.turn += 1
    this._tickRelicSkillCooldowns()
    this._emitRelicEvent('turn:started', { turn: this.turn })
    if (this.stealthTurns > 0) {
      this.stealthTurns -= 1
      this._revealRandomHidden('\u85cf\u533f')
      skipEnemyPhase = true
      this._log(`\u85cf\u533f\u751f\u6548\uff0c\u654c\u4eba\u672c\u56de\u5408\u4e0d\u884c\u52a8\uff08\u5269\u4f59 ${this.stealthTurns} \u56de\u5408\uff09\u3002`)
    }
    if (skipEnemyPhase || this.gameOver) {
      this._emitRelicEvent('turn:ended', { turn: this.turn })
      return
    }
    this._tickEnemyStates()
    if (this.gameOver) return
    const enemies = this._activeEnemies()
    if (interceptorId) {
      const interceptor = enemies.find((enemy) => enemy.id === interceptorId)
      if (interceptor) this._enemyAttack(interceptor, 0.5)
    }
    for (const enemy of enemies) {
      if (this.gameOver || enemy.id === interceptorId || skipEnemyIds.has(enemy.id) || !this.currentRoom.entity(enemy.id)) continue
      this._applyEnemyTraits(enemy)
      if (!this.currentRoom.entity(enemy.id) || this.gameOver) continue
      stepEnemy(enemy, {
        room: this.currentRoom,
        player: this.player,
        attack: (actor) => this._enemyAttack(actor),
        move: (actor, position) => this._moveEnemy(actor, position),
        activeSkill: (actor, skill) => this._useEnemyActiveSkill(actor, skill),
      })
    }
    this._emitRelicEvent('turn:ended', { turn: this.turn })
  }

  _enemyAttack(enemy, multiplier = 1) {
    if (!enemy || enemy.attack <= 0) return { healthDamage: 0 }
    enemy.hasActed = true
    const finalMultiplier = multiplier * (this.hasActiveRelic('r-final-duel') && this.remainingEnemies() === 1 ? 1.3 : 1)
    const rawDamage = Math.max(1, Math.floor(enemy.attack * finalMultiplier))
    const result = this._damagePlayer(rawDamage, { source: 'enemy:attack', enemy })
    enemy.attackCooldown = normalizedCounter(enemy.attackCooldownMax)
    this._log(`${enemy.name} \u653b\u51fb\u4f60\uff0c\u9020\u6210 ${result.healthDamage} \u4f24\u5bb3\u3002`)
    if (enemy.traits?.includes('split') && !enemy.splitTriggered) {
      enemy.splitTriggered = true
      this._spawnMinion(enemy, enemy.splitMinionId)
    }
  }

  _damagePlayer(rawDamage, context = {}) {
    const multiplier = this.hasActiveRelic('r-double-edged-fate') ? 2 : 1
    const damage = Math.max(0, Math.floor((rawDamage || 0) * multiplier))
    const absorbed = Math.min(this.player.armor, damage)
    const healthDamage = damage - absorbed
    const fatal = this.player.hp - healthDamage <= 0
    this.player.armor -= absorbed
    if (fatal && this.hasActiveRelic('r-last-stand') && !this._relicRoomRuntime('r-last-stand').used) {
      this._relicRoomRuntime('r-last-stand').used = true
      this.player.hp = 1
      this.player.armor += 5
      this._log('\u7edd\u5883\u4fdd\u9669\uff1a\u4fdd\u7559 1 \u70b9\u751f\u547d\uff0c\u62a4\u7532 +5\u3002')
    } else {
      this.player.hp -= healthDamage
    }
    this._emitRelicEvent('player:damaged', { rawDamage: damage, absorbed, healthDamage, ...context })
    if (this.player.hp <= 0) {
      this.player.hp = 0
      this.gameOver = true
      this.phase = 'over'
      this._log('\u4f60\u5012\u4e0b\u4e86\u3002')
    }
    return { rawDamage: damage, absorbed, healthDamage }
  }

  _healPlayer(amount, context = {}) {
    const before = this.player.hp
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.max(0, Number(amount) || 0))
    const healed = this.player.hp - before
    if (healed > 0) this._emitRelicEvent('player:healed', { amount: healed, ...context })
    return healed
  }

  _damageEnemy(enemy, damage, { source = 'attack' } = {}) {
    if (!enemy || !this.currentRoom?.entity(enemy.id)) return { damage: 0, defeated: false, finishedDowned: false }
    if (enemy.downed) {
      this._defeatEnemy(enemy, { source })
      return { damage: 0, defeated: true, finishedDowned: true }
    }
    let applied = Math.max(0, Math.floor(damage || 0))
    if (enemy.traits?.includes('shield') && !enemy.shieldConsumed) {
      enemy.shieldConsumed = true
      applied = Math.min(applied, Math.floor(enemy.maxHp / 2))
    }
    enemy.hp -= applied
    if (enemy.hp > 0) return { damage: applied, defeated: false, finishedDowned: false }
    enemy.hp = 0
    if (enemy.deathRule === 'revive' && !enemy.reviveUsed) {
      enemy.reviveUsed = true
      enemy.downed = true
      enemy.reviveTurns = 2
      this._log(`${enemy.name}\u5047\u6b7b\u4e86\uff0c\u4e24\u56de\u5408\u540e\u5c06\u6ee1\u8840\u590d\u6d3b\u3002`)
      return { damage: applied, defeated: false, finishedDowned: false }
    }
    this._defeatEnemy(enemy, { source })
    return { damage: applied, defeated: true, finishedDowned: false }
  }

  _defeatEnemy(enemy, { source = 'attack', suppressDeathExplosion = false, suppressLoot = false } = {}) {
    if (!enemy || !this.currentRoom?.entity(enemy.id)) return false
    if (enemy.activeSkill?.id === 'self-destruct' && !suppressDeathExplosion) {
      this._explodeEnemy(enemy, enemy.earlyExplosionDamage || Math.ceil(enemy.attack / 2), 'small')
    }
    this.currentRoom.removeEntity(enemy.id)
    this._log(`${enemy.name} \u88ab\u51fb\u8d25\u3002`)
    this._emitRelicEvent('enemy:killed', { enemy, source })
    if (this.remainingEnemies() === 0) this._emitRelicEvent('room:cleared', { room: this.currentRoom })
    this._gainExperience(enemy)
    const dropRule = enemy.drop
    if (!enemy.boss && !enemy.noLoot && !suppressLoot && dropRule && this.random() < dropRule.chance) {
      const drop = makeItemById(dropRule.itemId, this.random)
      if (drop) {
        this.currentRoom.addEntity(createLootEntity(drop, enemy.pos))
        this._log(`${enemy.name} \u6389\u843d\u4e86 ${drop.name}\u3002`)
      }
    }
    if (!enemy.boss && !enemy.noExperience && this.random() < enemy.relicDropChance) {
      const relic = buildRelicChoices(this.relics, { count: 1, random: this.random })[0]
      if (relic && this.acquireRelic(relic.id)) this._log(`${enemy.name} \u6389\u843d\u4e86\u5723\u9057\u7269\uff1a${relic.name}\u3002`)
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
      enemy.activeSkillCooldown = 0
      this._log(`${enemy.name}\u6ee1\u8840\u590d\u6d3b\u4e86\u3002`)
    }
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

  _spawnMinion(source, minionId) {
    const room = this.currentRoom
    const position = this._nearestEmptyPosition(source?.pos)
    const minion = position ? createMinion(minionId, position) : null
    if (!room || !minion) return false
    room.addEntity(minion)
    room.reveal(position)
    this.bus.emit('animate:flip', { roomId: room.id, position: { ...position } })
    this._log(`${source.name}\u53ec\u5524\u4e86 ${minion.name}\u3002`)
    return true
  }

  _useEnemyActiveSkill(enemy, skill = enemy?.activeSkill) {
    if (!enemy || !skill) return { acted: false, reason: 'no-active-skill' }
    if (skill.id === 'summon') {
      const acted = this._spawnMinion(enemy, skill.minionId)
      if (acted) this._emitRelicEvent('enemy:active-skill', { enemy, skill })
      return { acted, reason: 'summon' }
    }
    if (skill.id === 'self-destruct') {
      const radius = enemy.explosionRadius || enemy.range || 1
      if (combatDistance(enemy.pos, this.player.pos, radius) > radius) return { acted: false, reason: 'out-of-range' }
      if (!this._explodeEnemy(enemy, enemy.attack, 'large')) return { acted: false, reason: 'out-of-range' }
      this._defeatEnemy(enemy, { source: 'self-destruct', suppressDeathExplosion: true, suppressLoot: true })
      this._emitRelicEvent('enemy:active-skill', { enemy, skill })
      return { acted: true, reason: 'self-destruct' }
    }
    return { acted: false, reason: 'unknown-active-skill' }
  }

  _explodeEnemy(enemy, damage, size) {
    const radius = enemy.explosionRadius || enemy.range || 1
    if (combatDistance(enemy.pos, this.player.pos, radius) > radius) return false
    const result = this._damagePlayer(damage, { source: `enemy:${size}-explosion`, enemy })
    this._log(`${enemy.name}\u53d1\u751f\u4e86${size === 'large' ? '\u5927' : '\u5c0f'}\u81ea\u7206\uff0c\u9020\u6210 ${result.healthDamage} \u4f24\u5bb3\u3002`)
    return true
  }

  _triggerAmbushes(position) {
    const room = this.currentRoom
    if (!room) return false
    const ambushers = [...room.entities.values()]
      .filter((entity) => entity.kind === 'enemy' && entity.behavior === 'ambush' && !room.isRevealed(entity.pos))
      .filter((entity) => combatDistance(entity.pos, position, entity.range) <= entity.range)
    for (const enemy of ambushers) {
      room.reveal(enemy.pos)
      this.bus.emit('animate:flip', { roomId: room.id, position: { ...enemy.pos } })
      this._log(`${enemy.name}\u4ece\u4f0f\u51fb\u4e2d\u73b0\u8eab\u3002`)
      if (normalizedCounter(enemy.actionDelay) === 0 && normalizedCounter(enemy.attackCooldown) === 0) {
        this._enemyAttack(enemy)
        enemy.attackCooldown = normalizedCounter(enemy.attackCooldownMax)
      }
      if (this.gameOver) break
    }
    return ambushers.length > 0
  }

  _putInInventory(item) { return !!this.backpack.add(item) }

  _entityName(entity) {
    if (entity.kind === 'gold') return '\u91d1\u5e01'
    if (entity.kind === 'key') return '\u5f00\u95e8\u673a\u5173'
    if (entity.kind === 'trap') return '\u9677\u9631'
    return '\u7269\u54c1'
  }

  _canAct() { return this.phase === 'explore' && !this.gameOver && this.initialRelicChoices.length === 0 }

  _reject(message) {
    this._log(message)
    this._changed()
    return false
  }

  _log(message) {
    this.log.unshift(`[${this.turn}] ${message}`)
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
      relics: this.relics.serialize(),
      initialRelicChoices: [...this.initialRelicChoices],
      turn: this.turn,
      phase: this.phase,
      gameOver: this.gameOver,
      win: this.win,
      selectedInventoryIndex: this.selectedInventoryIndex,
      selectedEquipmentSlot: this.selectedEquipmentSlot,
      itemTargeting: this.itemTargeting,
      merchant: this.merchant ? { ...this.merchant } : null,
      roomReward: this.roomReward ? clone(this.roomReward) : null,
      roomRewardBag: [...this.roomRewardBag],
      levelUp: this.levelUp ? clone(this.levelUp) : null,
      relicRuntime: clone(this.relicRuntime),
      stealthTurns: this.stealthTurns,
      log: [...this.log],
    }
  }

  _persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize())) } catch {}
  }

  load() {
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')
      if (!data || ![9, 10, SAVE_VERSION].includes(data.version) || !data.dungeon || !data.player || !data.backpack) return false
      this.dungeon = Dungeon.hydrate(data.dungeon)
      for (const room of this.dungeon.rooms.values()) {
        for (const entity of room.entities.values()) normalizeEnemyActionState(entity, { revealed: room.isRevealed(entity.pos) })
      }
      this.player = data.player
      this.backpack = BackpackGrid.hydrate(data.backpack)
      this.player.equipment = Array.isArray(this.player.equipment) ? this.player.equipment.slice(0, EQUIPMENT_SLOTS) : [this.player.equipment || null]
      while (this.player.equipment.length < EQUIPMENT_SLOTS) this.player.equipment.push(null)
      this.player.level = Math.max(PROGRESSION.startingLevel, Number(this.player.level) || PROGRESSION.startingLevel)
      this.player.experience = Math.max(0, Number(this.player.experience) || 0)
      this.player.experienceToNext = Math.max(1, Number(this.player.experienceToNext) || experienceToNextLevel(this.player.level))
      this.player.strength = Array.from({ length: EQUIPMENT_SLOTS }, (_, index) => Math.max(0, Number(this.player.strength?.[index]) || 0))
      this.player.mastery = Array.from({ length: EQUIPMENT_SLOTS }, (_, index) => Math.max(0, Number(this.player.mastery?.[index]) || 0))
      this.player.adaptations = Array.from({ length: EQUIPMENT_SLOTS }, (_, index) => ATTRIBUTE_ORDER.includes(this.player.adaptations?.[index]) ? this.player.adaptations[index] : null)
      this.player.pendingAttackBuffs = Array.isArray(this.player.pendingAttackBuffs)
        ? this.player.pendingAttackBuffs.filter((buff) => Number.isFinite(buff?.amount) && (buff.target === 'melee' || buff.target === 'any'))
        : []
      this.player.pendingAttackBonus = this.player.pendingAttackBuffs.reduce((total, buff) => total + buff.amount, 0)
      this.relics = RelicCollection.hydrate(data.relics)
      this.relics.entries = this.relics.entries.filter((entry) => !!getRelicDefinition(entry.id))
      this.relicEngine = new RelicEngine(this.relics)
      this.initialRelicChoices = (Array.isArray(data.initialRelicChoices) ? data.initialRelicChoices : buildRelicChoices(this.relics, { random: this.random }).map((relic) => relic.id))
        .filter((id) => !!getRelicDefinition(id) && !this.relics.has(id))
      this.turn = Number.isInteger(data.turn) && data.turn >= 0 ? data.turn : 0
      this.phase = ['explore', 'merchant', 'reward', 'level-up', 'over'].includes(data.phase) ? data.phase : 'explore'
      this.gameOver = !!data.gameOver
      this.win = !!data.win
      this.selectedInventoryIndex = Number.isInteger(data.selectedInventoryIndex) && this.backpack.placementForCellIndex(data.selectedInventoryIndex)
        ? this.backpack.originIndex(this.backpack.placementForCellIndex(data.selectedInventoryIndex))
        : null
      this.selectedEquipmentSlot = Number.isInteger(data.selectedEquipmentSlot) ? data.selectedEquipmentSlot : null
      this.itemTargeting = !!data.itemTargeting
      this.merchant = data.merchant && typeof data.merchant.entityId === 'string' ? { entityId: data.merchant.entityId } : null
      this.roomReward = data.roomReward?.roomId && Array.isArray(data.roomReward.choices) ? clone(data.roomReward) : null
      this.roomRewardBag = Array.isArray(data.roomRewardBag) && data.roomRewardBag.every((type) => type === 'supply' || type === 'relic')
        ? [...data.roomRewardBag]
        : shuffled(['supply', 'supply', 'supply', 'relic'], this.random)
      this.levelUp = Array.isArray(data.levelUp?.choices)
        ? {
            choices: data.levelUp.choices.filter((id) => !!getLevelUpOption(id)),
            adaptationHand: [0, 1].includes(data.levelUp.adaptationHand) ? data.levelUp.adaptationHand : null,
          }
        : null
      this.relicEventQueue = []
      this.relicRuntime = data.relicRuntime && typeof data.relicRuntime === 'object' ? clone(data.relicRuntime) : {}
      this.stealthTurns = Math.max(0, Number(data.stealthTurns) || 0)
      this.detailPanel = null
      this.log = Array.isArray(data.log) ? data.log : []
      synchronizeEntityIds([...this.backpack.items, ...this.player.equipment].map((item) => item?.uid))
      if (!this.currentRoom?.contains(this.player.pos) || !this.currentRoom.isRevealed(this.player.pos)) return false
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
      return false
    }
  }

  clearSave() {
    try { localStorage.removeItem(SAVE_KEY) } catch {}
  }
}
