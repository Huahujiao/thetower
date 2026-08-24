import { createEmitter } from './core/emitter.js'
import { combatDistance, neighbors8 } from './core/geometry.js'
import { createLootEntity, getItemDefinition, makeItemById, makeTemporaryWeapon, starterWeapon, synchronizeEntityIds } from './data/content.js'
import { getMerchantDefinition, merchantSellPrice, refreshMerchantSlot, refreshMerchantStock } from './data/merchants.js'
import { buildRelicChoices, getRelicDefinition } from './data/relics.js'
import { buildRoomRewardChoices } from './data/rewards.js'
import { getTrapDefinition } from './data/traps.js'
import { createLinearDungeon, Dungeon } from './model/dungeon.js'
import { BackpackGrid } from './model/backpack.js'
import { RelicCollection } from './model/relics.js'
import { attackTypeModifier, computeAttackDamage } from './rules/modifiers.js'
import { RelicEngine } from './rules/relics.js'
import { stepEnemy } from './rules/enemies.js'
import { findAttackPath, findDoorPath, findPath, findRevealPath } from './rules/pathfinding.js'
import { terrainDamageModifiers } from './rules/terrain.js'

// The design notation is rows × columns: four rows, six columns.
export const INVENTORY_COLUMNS = 6
export const INVENTORY_ROWS = 4
export const INVENTORY_CAPACITY = INVENTORY_COLUMNS * INVENTORY_ROWS
export const EQUIPMENT_SLOTS = 2
export const SAVE_KEY = 'grid_flip_adventure_v2'
export const SAVE_VERSION = 6

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
      pendingAttackBonus: 0,
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
    this.relicEventQueue = []
    this.relicRuntime = {}
    this.stealthTurns = 0
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
  get merchantEntity() { return this.merchant ? this.currentRoom?.entity(this.merchant.entityId) || null : null }
  get merchantDefinition() { return getMerchantDefinition(this.merchantEntity?.merchantId) }
  canManageRelics() { return this.phase === 'merchant' && this.merchantDefinition?.services.includes('relic-management') }

  canSellAtMerchant() { return this.phase === 'merchant' && this.merchantDefinition?.services.includes('sell') }

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
      if (action.type === 'heal') this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.max(0, action.amount || 0))
      if (action.type === 'armor') this.player.armor += Math.max(0, action.amount || 0)
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

  acquireRelic(id, { activate = false } = {}) {
    const definition = getRelicDefinition(id)
    if (!definition) return this._reject('\u672a\u77e5\u5723\u9057\u7269\u3002')
    const entry = this.relics.acquire(id, { activate })
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

  tileCanBeFlipped(position) {
    const room = this.currentRoom
    return !!room && !room.isRevealed(position) && !!findRevealPath(room, this.player.pos, position)
  }

  selectInventory(index) {
    if (!Number.isInteger(index) || index < 0 || index >= INVENTORY_CAPACITY) return false
    const placement = this.backpack.placementForCellIndex(index)
    this.selectedInventoryIndex = this.backpack.originIndex(placement)
    this.selectedEquipmentSlot = null
    this.itemTargeting = false
    this._changed()
    return true
  }

  moveSelectedInventory(index) {
    const item = this.selectedItem
    if (!Number.isInteger(index) || index < 0 || index >= INVENTORY_CAPACITY || !item) return false
    const moved = this.backpack.move(item.uid, index % INVENTORY_COLUMNS, Math.floor(index / INVENTORY_COLUMNS))
    if (!moved) return false
    this.selectedInventoryIndex = this.backpack.originIndex(this.backpack.placementOf(item.uid))
    this._changed()
    return true
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
    const item = this.selectedItem
    const weapon = this.player.equipment[slot]
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
      const before = this.player.hp
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + item.heal)
      this.backpack.removeByUid(item.uid)
      this.selectedInventoryIndex = null
      this.itemTargeting = false
      this._log(`\u4f7f\u7528 ${item.name}\uff0c\u6062\u590d ${this.player.hp - before} HP\u3002`)
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
      this.player.pendingAttackBonus += item.attackBonus
      this.backpack.removeByUid(item.uid)
      this.selectedInventoryIndex = null
      this.itemTargeting = false
      this._log(`\u4f7f\u7528 ${item.name}\uff0c\u4e0b\u6b21\u653b\u51fb +${item.attackBonus}\u3002`)
      this._changed()
      return true
    }
    if (item.type === 'whetstone') {
      if (this.equippedWeapons.length === 0) return this._reject('\u6ca1\u6709\u5df2\u88c5\u5907\u6b66\u5668\u3002')
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
    if (entity.kind === 'door') return this._useDoor(entity)
    if (entity.kind === 'merchant') return this._interactMerchant(entity)
    return this._pickUp(entity)
  }

  _interactMerchant(merchant) {
    const route = findDoorPath(this.currentRoom, this.player.pos, merchant)
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
    const entry = this.acquireRelic(id)
    if (!entry) return false
    merchant.relicOfferResolved = true
    merchant.relicChoices = []
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
    if (!route) return this._reject('\u65e0\u6cd5\u8d70\u5230\u8fd9\u5f20\u724c\u7684\u65c1\u8fb9\u3002')
    const movement = this._walk(route.path)
    let flipOutcome = { skipEnemyIds: new Set() }
    if (!movement.stopped) {
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
    const entity = room.entityAt(position)
    if (entity?.kind === 'trap') return this._triggerTrap(entity, { cause })
    return { skipEnemyIds: new Set() }
  }

  _triggerTrap(trap, { cause = 'player' } = {}) {
    const room = this.currentRoom
    const definition = getTrapDefinition(trap.trapId)
    const skipEnemyIds = new Set()
    if (!room || !definition) return { skipEnemyIds }
    this._emitRelicEvent('trap:before-trigger', { trap, definition, cause })
    room.removeEntity(trap.id)
    if (definition.effect === 'explosion') {
      const result = this._damagePlayer(definition.damage, { source: 'trap:explosion' })
      this._log(`${definition.name}\u89e6\u53d1\uff0c\u4f60\u53d7\u5230 ${result.healthDamage} \u70b9\u4f24\u5bb3\u3002`)
      const victims = [...room.entities.values()]
        .filter((entity) => entity.kind === 'enemy' && room.isRevealed(entity.pos))
        .filter((entity) => combatDistance(trap.pos, entity.pos, definition.radius) <= definition.radius)
      for (const enemy of victims) {
        enemy.hp -= definition.damage
        this._log(`${enemy.name}\u53d7\u5230\u7206\u70b8\u4f24\u5bb3 ${definition.damage}\u3002`)
        if (enemy.hp <= 0) this._defeatEnemy(enemy, { source: 'trap:explosion' })
      }
    } else if (definition.effect === 'alarm') {
      const targets = [...room.entities.values()]
        .filter((entity) => entity.kind === 'enemy' && !room.isRevealed(entity.pos))
        .filter((entity) => combatDistance(trap.pos, entity.pos, definition.radius) <= definition.radius)
      for (const enemy of targets) {
        room.reveal(enemy.pos)
        enemy.cooldown = Math.max(enemy.cooldown, 1)
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
    const movement = this._walk(route.path)
    if (movement.stopped) {
      this._endTurn({ interceptorId: movement.interceptorId })
      this._changed()
      return true
    }
    const targetDoor = this.dungeon.otherDoor(door)
    const targetRoom = this.dungeon.room(edge.fromDoorId === door.id ? edge.toRoomId : edge.fromRoomId)
    const firstVisit = !targetRoom.visited
    targetRoom.reveal(targetDoor.arrival)
    targetRoom.visited = true
    this.player.roomId = targetRoom.id
    this.player.pos = { ...targetDoor.arrival }
    this._log(`\u8fdb\u5165 ${this.roomLabel(targetRoom)}\u3002`)
    this._endTurn({ skipEnemyPhase: true })
    this._emitRelicEvent('room:entered', { room: targetRoom, firstVisit })
    if (firstVisit && !this.gameOver) {
      this.roomReward = {
        roomId: targetRoom.id,
        choices: buildRoomRewardChoices(this.relics, { floor: targetRoom.floor, random: this.random }),
      }
      this.phase = 'reward'
      this._log('\u9996\u6b21\u8fdb\u5165\u65b0\u623f\u95f4\uff0c\u8bf7\u9009\u62e9\u4e00\u9879\u5956\u52b1\u3002')
    }
    this._changed()
    return true
  }

  _attack(enemy) {
    const weapons = this.equippedWeapons.filter((weapon) => weapon.durability > 0)
    if (weapons.length === 0) return this._reject('\u9700\u8981\u4e00\u628a\u53ef\u7528\u6b66\u5668\u3002')
    const route = findAttackPath(this.currentRoom, this.player.pos, enemy, weapons)
    if (!route) return this._reject('\u6ca1\u6709\u53ef\u8fbe\u7684\u653b\u51fb\u4f4d\u7f6e\u3002')
    const movement = this._walk(route.path)
    if (!movement.stopped) {
      for (const weapon of weapons) {
        if (enemy.hp <= 0) break
        if (!weapon || weapon.durability <= 0 || combatDistance(this.player.pos, enemy.pos, weapon.range) > weapon.range) continue
        const type = attackTypeModifier(weapon, enemy)
        const relicModifiers = this.relicEngine.damageModifiers({
          weapon,
          target: enemy,
          player: this.player,
          room: this.currentRoom,
          countered: type.countered,
          resisted: type.resisted,
        })
        const outcome = computeAttackDamage({
          weapon,
          target: enemy,
          pendingAttackBonus: this.player.pendingAttackBonus,
          relicModifiers,
          terrainModifiers: terrainDamageModifiers(this.currentRoom, this.player.pos),
        })
        const damage = outcome.damage
        this.player.pendingAttackBonus = 0
        enemy.hp -= damage
        weapon.durability -= 1
        const relation = outcome.countered ? '\u514b\u5236\u00b7' : outcome.resisted ? '\u53d7\u5236\u00b7' : ''
        this._log(`${relation}${weapon.name} \u5bf9 ${enemy.name} \u9020\u6210 ${damage} \u4f24\u5bb3\u3002`)
        if (weapon.durability <= 0) {
          this._log(`${weapon.name} \u635f\u6bc1\u4e86\u3002`)
          this.player.equipment = this.player.equipment.map((equipped) => equipped?.uid === weapon.uid ? null : equipped)
          this._emitRelicEvent('weapon:broken', { weapon })
        }
      }
      if (enemy.hp <= 0) {
        this._defeatEnemy(enemy)
      }
    }
    if (!this.gameOver) this._endTurn({ interceptorId: movement.interceptorId })
    this._changed()
    return true
  }

  _walk(path) {
    const finalPosition = path[path.length - 1] || this.player.pos
    let interceptorId = null
    for (const step of path) {
      const previous = { ...this.player.pos }
      this.player.pos = { ...step }
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
    if (skipEnemyPhase || this.gameOver) return
    const enemies = this._activeEnemies()
    if (interceptorId) {
      const interceptor = enemies.find((enemy) => enemy.id === interceptorId)
      if (interceptor) this._enemyAttack(interceptor, 0.5)
    }
    for (const enemy of enemies) {
      if (this.gameOver || enemy.id === interceptorId || skipEnemyIds.has(enemy.id) || !this.currentRoom.entity(enemy.id)) continue
      stepEnemy(enemy, { player: this.player, attack: (actor) => this._enemyAttack(actor) })
    }
  }

  _enemyAttack(enemy, multiplier = 1) {
    const rawDamage = Math.max(1, Math.floor(enemy.attack * multiplier))
    const result = this._damagePlayer(rawDamage, { source: 'enemy:attack', enemy })
    enemy.cooldown = enemy.cooldownMax
    this._log(`${enemy.name} \u653b\u51fb\u4f60\uff0c\u9020\u6210 ${result.healthDamage} \u4f24\u5bb3\u3002`)
  }

  _damagePlayer(rawDamage, context = {}) {
    const damage = Math.max(0, rawDamage || 0)
    const absorbed = Math.min(this.player.armor, damage)
    const healthDamage = damage - absorbed
    this.player.armor -= absorbed
    this.player.hp -= healthDamage
    this._emitRelicEvent('player:damaged', { rawDamage: damage, absorbed, healthDamage, ...context })
    if (this.player.hp <= 0) {
      this.player.hp = 0
      this.gameOver = true
      this.phase = 'over'
      this._log('\u4f60\u5012\u4e0b\u4e86\u3002')
    }
    return { rawDamage: damage, absorbed, healthDamage }
  }

  _defeatEnemy(enemy, { source = 'attack' } = {}) {
    if (!enemy || !this.currentRoom?.entity(enemy.id)) return false
    this.currentRoom.removeEntity(enemy.id)
    this._log(`${enemy.name} \u88ab\u51fb\u8d25\u3002`)
    this._emitRelicEvent('enemy:killed', { enemy, source })
    if (!enemy.boss && this.random() < 0.3) {
      const drop = makeTemporaryWeapon(this.currentRoom.floor, this.random)
      this.currentRoom.addEntity(createLootEntity(drop, enemy.pos))
      this._log(`${enemy.name} \u6389\u843d\u4e86 ${drop.name}\u3002`)
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
      .filter((entity) => entity.kind === 'enemy' && room.isRevealed(entity.pos))
      .sort((a, b) => (a.revealOrder || Infinity) - (b.revealOrder || Infinity))
  }

  _putInInventory(item) { return !!this.backpack.add(item) }

  _entityName(entity) {
    if (entity.kind === 'door') return '\u95e8'
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
      if (!data || data.version !== SAVE_VERSION || !data.dungeon || !data.player || !data.backpack) return false
      this.dungeon = Dungeon.hydrate(data.dungeon)
      this.player = data.player
      this.backpack = BackpackGrid.hydrate(data.backpack)
      this.player.equipment = Array.isArray(this.player.equipment) ? this.player.equipment.slice(0, EQUIPMENT_SLOTS) : [this.player.equipment || null]
      while (this.player.equipment.length < EQUIPMENT_SLOTS) this.player.equipment.push(null)
      this.relics = RelicCollection.hydrate(data.relics)
      this.relics.entries = this.relics.entries.filter((entry) => !!getRelicDefinition(entry.id))
      this.relicEngine = new RelicEngine(this.relics)
      this.initialRelicChoices = (Array.isArray(data.initialRelicChoices) ? data.initialRelicChoices : buildRelicChoices(this.relics, { random: this.random }).map((relic) => relic.id))
        .filter((id) => !!getRelicDefinition(id) && !this.relics.has(id))
      this.turn = Number.isInteger(data.turn) && data.turn >= 0 ? data.turn : 0
      this.phase = ['explore', 'merchant', 'reward', 'over'].includes(data.phase) ? data.phase : 'explore'
      this.gameOver = !!data.gameOver
      this.win = !!data.win
      this.selectedInventoryIndex = Number.isInteger(data.selectedInventoryIndex) && this.backpack.placementForCellIndex(data.selectedInventoryIndex)
        ? this.backpack.originIndex(this.backpack.placementForCellIndex(data.selectedInventoryIndex))
        : null
      this.selectedEquipmentSlot = Number.isInteger(data.selectedEquipmentSlot) ? data.selectedEquipmentSlot : null
      this.itemTargeting = !!data.itemTargeting
      this.merchant = data.merchant && typeof data.merchant.entityId === 'string' ? { entityId: data.merchant.entityId } : null
      this.roomReward = data.roomReward?.roomId && Array.isArray(data.roomReward.choices) ? clone(data.roomReward) : null
      this.relicEventQueue = []
      this.relicRuntime = data.relicRuntime && typeof data.relicRuntime === 'object' ? clone(data.relicRuntime) : {}
      this.stealthTurns = Math.max(0, Number(data.stealthTurns) || 0)
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
      if (this.initialRelicChoices.length > 0) this.phase = 'explore'
      return true
    } catch {
      return false
    }
  }

  clearSave() {
    try { localStorage.removeItem(SAVE_KEY) } catch {}
  }
}
