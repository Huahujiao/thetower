import { EQUIPMENT_SLOTS, GameRun, INVENTORY_COLUMNS, INVENTORY_ROWS, SAVE_KEY } from '../src/game/run.js'
import { neighbors8, pos } from '../src/game/core/geometry.js'
import { Room } from '../src/game/model/room.js'
import { BackpackGrid } from '../src/game/model/backpack.js'
import { makeItemById, randomItem, resetEntityIds } from '../src/game/data/content.js'
import catalog from '../src/game/data/catalog.json' with { type: 'json' }
import { RelicCollection } from '../src/game/model/relics.js'
import { buildRelicChoices, RELIC_DEFS } from '../src/game/data/relics.js'
import { attackTypeModifier, computeAttackDamage } from '../src/game/rules/modifiers.js'
import { ENEMY_BEHAVIORS, stepEnemy } from '../src/game/rules/enemies.js'
import { findAttackPath, findPath, findRevealPath } from '../src/game/rules/pathfinding.js'
import { createTrapEntity } from '../src/game/data/traps.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function addToBackpack(run, item) {
  const placement = run.backpack.add(item)
  assert(placement, `could not add ${item?.id || item?.name || 'item'} to test backpack`)
  return run.backpack.originIndex(placement)
}

function firstFlippable(run) {
  const room = run.currentRoom
  for (let r = 0; r < room.height; r++) {
    for (let c = 0; c < room.width; c++) {
      if (run.tileCanBeFlipped({ c, r })) return { c, r }
    }
  }
  return null
}

function adjacentEmpty(room, entity, { cardinalOnly = true } = {}) {
  const candidates = neighbors8(entity.pos, room.width, room.height)
    .filter((candidate) => !cardinalOnly || Math.abs(candidate.c - entity.pos.c) + Math.abs(candidate.r - entity.pos.r) === 1)
  const empty = candidates.find((candidate) => room.isEmpty(candidate))
  if (empty) return empty
  const removable = candidates.find((candidate) => {
    const occupant = room.entityAt(candidate)
    return occupant && occupant.kind !== 'door'
  })
  if (!removable) return null
  room.removeEntity(room.entityAt(removable).id)
  return removable
}

function openMerchant(run, merchantId) {
  const room = [...run.dungeon.rooms.values()].find((candidate) => [...candidate.entities.values()].some((entity) => entity.kind === 'merchant' && entity.merchantId === merchantId))
  const merchant = [...room.entities.values()].find((entity) => entity.kind === 'merchant' && entity.merchantId === merchantId)
  const approach = adjacentEmpty(room, merchant, { cardinalOnly: false })
  assert(approach, `merchant ${merchantId} has no adjacent test cell`)
  run.player.roomId = room.id
  run.player.pos = { ...approach }
  room.reveal(approach)
  room.reveal(merchant.pos)
  assert(run.clickTile(merchant.pos.c, merchant.pos.r), `merchant ${merchantId} was rejected`)
  assert(run.phase === 'merchant' && run.merchantEntity?.id === merchant.id, `merchant ${merchantId} did not open`)
  return merchant
}

const run = new GameRun({ autoLoad: false, random: () => 0.5 })
assert(run.dungeon.rooms.size === 12, 'expected 12 configured rooms')
assert(Array.isArray(catalog.enemies) && Array.isArray(catalog.weapons) && Array.isArray(catalog.consumables), 'static game data must be stored in the catalog JSON')
assert(catalog.enemies.find((enemy) => enemy.id === 'gnawer')?.initialActionDelay === 1, 'gnawer must have a one-turn initial action delay')
assert(catalog.enemies.every((enemy) => Number.isInteger(enemy.initialActionDelay) && enemy.initialActionDelay >= 0), 'every enemy must define its own initial action delay')
assert(INVENTORY_ROWS === 4 && INVENTORY_COLUMNS === 6 && run.backpack.capacity === 24 && run.backpack.length === 0, 'inventory must be a six-column by four-row shape grid')
assert(run.player.equipment.length === EQUIPMENT_SLOTS && run.player.equipment[0] && !run.player.equipment[1], 'new run must have left and right equipment slots')
assert(!('sanity' in run.player), 'sanity must not exist in V2 player state')
assert(run.currentRoom.width === 8 && run.currentRoom.height === 8, 'first room must be 8x8')
for (const room of [...run.dungeon.rooms.values()].slice(1)) {
  assert(room.height === 8 && room.width >= 8 && room.width <= 12, 'later room dimensions are invalid')
}
for (const room of run.dungeon.rooms.values()) {
  assert(room.entities.size >= Math.ceil(room.width * room.height * 0.8), 'room occupancy must keep empty cards at or below twenty percent')
}
const generatedItemTypes = new Set([...run.dungeon.rooms.values()]
  .flatMap((room) => [...room.entities.values()])
  .filter((entity) => entity.kind === 'item')
  .map((entity) => entity.item.type))
for (const type of ['weapon', 'potion', 'armor', 'buff', 'whetstone']) {
  assert(generatedItemTypes.has(type), `missing required generated card type: ${type}`)
}
assert([...run.dungeon.edges.values()].filter((edge) => edge.locked).length === 2, 'expected configured locked doors')
const merchants = [...run.dungeon.rooms.values()].flatMap((room) => [...room.entities.values()].filter((entity) => entity.kind === 'merchant'))
assert(merchants.length === 3 && new Set(merchants.map((merchant) => merchant.merchantId)).size === 3, 'expected three distinct room merchants')
for (const edge of run.dungeon.edges.values()) {
  if (!edge.locked) continue
  const source = run.dungeon.room(edge.fromRoomId)
  assert([...source.entities.values()].some((entity) => entity.kind === 'key' && entity.edgeId === edge.id), 'locked door has no source-room key')
}
assert(run.initialRelicChoices.length === 3, 'new run must offer three initial relic choices')
assert(run.chooseInitialRelic(run.initialRelicChoices[0])?.active, 'initial relic choice must activate immediately')
const detailItem = makeItemById('spear')
assert(run.showItemDetail(detailItem) && run.detailPanel?.position === 'top' && run.detailPanel.lines.length >= 3, 'inventory item detail panel was not generated')
assert(run.closeDetail() && !run.detailPanel, 'detail panel did not close')
const detailEnemy = [...run.currentRoom.entities.values()].find((entity) => entity.kind === 'enemy')
run.currentRoom.reveal(detailEnemy.pos)
assert(run.showBoardDetail(detailEnemy.pos) && run.detailPanel?.position === 'bottom', 'board enemy detail panel was not generated')
assert(run.closeDetail(), 'board detail panel did not close')
assert(!run.showBoardDetail(run.player.pos), 'the player must not expose a detail panel')

const shapeGrid = new BackpackGrid()
const shortSword = makeItemById('short-sword')
const spear = makeItemById('spear')
const executioner = makeItemById('executioner')
const potion = makeItemById('small-potion')
const armorPotion = makeItemById('armor-potion')
const largePotion = makeItemById('large-potion')
const largeArmorPotion = makeItemById('large-armor-potion')
const largeWhetstone = makeItemById('large-whetstone')
assert(shortSword.shape.flat().filter(Boolean).length === 2 && spear.shape.flat().filter(Boolean).length === 3 && executioner.shape.flat().filter(Boolean).length === 4, 'weapons must retain two-, three-, and four-cell footprints')
assert(potion.shape.flat().filter(Boolean).length === 1 && armorPotion.shape.flat().filter(Boolean).length === 1, 'small potions must retain one-cell footprints')
assert(largePotion.heal === 12 && largeArmorPotion.armor === 10 && largePotion.shape.flat().filter(Boolean).length === 2 && largeArmorPotion.shape.flat().filter(Boolean).length === 2, 'large potions must be stronger and occupy two cells')
assert(largeWhetstone.repair === 3 && largeWhetstone.shape.flat().filter(Boolean).length === 1, 'large whetstone must use the large repair value without changing its footprint')
assert(randomItem(1, () => 0.99).id === 'whetstone', 'large consumables must not appear before floor 3')
assert(randomItem(3, () => 0.99).id === 'large-whetstone', 'large consumables must join the floor 3+ loot pool')
const spearPlacement = shapeGrid.add(spear)
assert(spearPlacement && shapeGrid.usedCells === 3, 'shape backpack did not occupy the weapon footprint')
assert(shapeGrid.rotate(spear.uid) && shapeGrid.shapeFor(spear, shapeGrid.placementOf(spear.uid).rotation)[0].length === 3, 'shape backpack did not rotate the selected weapon')
const fallbackRotationGrid = new BackpackGrid(3, 2)
const fallbackRotationItem = { uid: 'rotation-fallback', shape: [[1, 1]] }
fallbackRotationGrid.placements.push(
  { item: fallbackRotationItem, x: 0, y: 0, rotation: 0 },
  { item: { uid: 'rotation-block-a', shape: [[1]] }, x: 0, y: 1, rotation: 0 },
  { item: { uid: 'rotation-block-b', shape: [[1]] }, x: 1, y: 1, rotation: 0 },
)
assert(fallbackRotationGrid.rotate(fallbackRotationItem.uid), 'rotation should search for an alternative backpack position')
const fallbackPlacement = fallbackRotationGrid.placementOf(fallbackRotationItem.uid)
assert(fallbackPlacement.rotation === 1 && fallbackPlacement.x === 2 && fallbackPlacement.y === 0, 'rotation did not relocate when the original position was blocked')
const preferredMoveGrid = new BackpackGrid(3, 2)
const preferredMoveItem = { uid: 'preferred-move', shape: [[1], [1]] }
preferredMoveGrid.placements.push({ item: preferredMoveItem, x: 0, y: 0, rotation: 0 })
assert(preferredMoveGrid.movePreferred(preferredMoveItem.uid, 1, 0), 'backpack move was rejected')
assert(preferredMoveGrid.placementOf(preferredMoveItem.uid).rotation === 0, 'backpack move must prefer the vertical placement')
const horizontalFallbackGrid = new BackpackGrid(3, 2)
const horizontalFallbackItem = { uid: 'horizontal-fallback', shape: [[1], [1]] }
horizontalFallbackGrid.placements.push(
  { item: horizontalFallbackItem, x: 0, y: 0, rotation: 0 },
  { item: { uid: 'horizontal-block', shape: [[1]] }, x: 1, y: 1, rotation: 0 },
)
assert(horizontalFallbackGrid.movePreferred(horizontalFallbackItem.uid, 1, 0), 'horizontal fallback move was rejected')
assert(horizontalFallbackGrid.placementOf(horizontalFallbackItem.uid).rotation === 1, 'backpack move did not fall back to horizontal placement')
const serializedShapeGrid = shapeGrid.serialize((item) => ({ ...item }))
const restoredShapeGrid = BackpackGrid.hydrate(serializedShapeGrid)
assert(restoredShapeGrid.usedCells === 3 && restoredShapeGrid.placementOf(spear.uid)?.rotation === 1, 'shape backpack placement or rotation did not persist')

const organizeRun = new GameRun({ autoLoad: false, random: () => 0.5 })
organizeRun.chooseInitialRelic(organizeRun.initialRelicChoices[0])
const organizeIndex = addToBackpack(organizeRun, makeItemById('spear'))
organizeRun.selectInventory(organizeIndex)
const organizeTurn = organizeRun.turn
assert(organizeRun.rotateSelectedInventory() && organizeRun.turn === organizeTurn, 'rotating a backpack item must not consume a turn')
assert(organizeRun.moveSelectedInventory(INVENTORY_COLUMNS) && organizeRun.turn === organizeTurn, 'moving a backpack item must not consume a turn')
assert(organizeRun.selectInventory(organizeRun.selectedInventoryIndex) && !organizeRun.selectedItem, 'selecting an already selected backpack item must cancel selection')
assert(organizeRun.selectInventory(INVENTORY_COLUMNS) && organizeRun.selectedItem, 'backpack item could not be selected after cancellation')
assert(organizeRun.clearSelection() && !organizeRun.selectedItem, 'backpack selection could not be cleared')

const orderedFlipRun = new GameRun({ autoLoad: false, random: () => 0.5 })
orderedFlipRun.chooseInitialRelic(orderedFlipRun.initialRelicChoices[0])
const orderedRoom = orderedFlipRun.currentRoom
const orderedStart = { ...orderedFlipRun.player.pos }
const orderedDirection = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dc, dr]) => orderedRoom.contains({ c: orderedStart.c + dc * 3, r: orderedStart.r + dr * 3 }))
assert(orderedDirection, 'could not create a remote flip route')
const [orderedDc, orderedDr] = orderedDirection
const orderedRoute = [1, 2].map((step) => ({ c: orderedStart.c + orderedDc * step, r: orderedStart.r + orderedDr * step }))
const orderedTarget = { c: orderedStart.c + orderedDc * 3, r: orderedStart.r + orderedDr * 3 }
for (const position of [...orderedRoute, orderedTarget]) {
  const entity = orderedRoom.entityAt(position)
  if (entity) orderedRoom.removeEntity(entity.id)
}
for (const position of orderedRoute) orderedRoom.reveal(position)
const orderedEvents = []
orderedFlipRun.on('change', () => orderedEvents.push('change'))
orderedFlipRun.on('animate:flip', () => orderedEvents.push('flip'))
assert(orderedFlipRun.clickTile(orderedTarget.c, orderedTarget.r), 'remote flip was rejected')
assert(orderedEvents.indexOf('change') >= 0 && orderedEvents.indexOf('change') < orderedEvents.indexOf('flip'), 'remote flip animation must run after the player movement render')

const flipTarget = firstFlippable(run)
assert(flipTarget, 'the initial room has no legal flip')
assert(run.clickTile(flipTarget.c, flipTarget.r), 'legal flip was rejected')
assert(run.currentRoom.isRevealed(flipTarget), 'flipped tile did not reveal')
assert(run.turn === 1, 'flip must consume one turn')
assert([...run.currentRoom.entities.values()].filter((entity) => entity.kind === 'door').every((door) => !run.currentRoom.isRevealed(door.pos)), 'doors must begin hidden')

const flipGraceRun = new GameRun({ autoLoad: false, random: () => 0.5 })
flipGraceRun.chooseInitialRelic(flipGraceRun.initialRelicChoices[0])
const flipGraceRoom = flipGraceRun.currentRoom
const flipGraceEnemy = [...flipGraceRoom.entities.values()].find((entity) => entity.kind === 'enemy' && entity.enemyId === 'gnawer')
const flipGraceApproach = adjacentEmpty(flipGraceRoom, flipGraceEnemy, { cardinalOnly: false })
assert(flipGraceApproach, 'test enemy has no adjacent flip position')
flipGraceRun.player.pos = { ...flipGraceApproach }
flipGraceRoom.reveal(flipGraceApproach)
flipGraceRun.player.hp = 4
assert(flipGraceEnemy.cooldown === 1, 'gnawer instance did not receive its static initial action delay')
assert(flipGraceRun.clickTile(flipGraceEnemy.pos.c, flipGraceEnemy.pos.r), 'enemy flip was rejected')
assert(flipGraceRun.player.hp === 4 && flipGraceEnemy.cooldown === 0, 'a newly flipped delayed enemy attacked immediately')

const doorRun = new GameRun({ autoLoad: false, random: () => 0.5 })
doorRun.chooseInitialRelic(doorRun.initialRelicChoices[0])
const beforeRoom = doorRun.currentRoom
const door = [...beforeRoom.entities.values()].find((entity) => entity.kind === 'door')
const sourceEnemy = [...beforeRoom.entities.values()].find((entity) => entity.kind === 'enemy')
beforeRoom.reveal(door.pos)
beforeRoom.reveal(door.arrival)
beforeRoom.reveal(sourceEnemy.pos)
sourceEnemy.cooldown = 0
doorRun.player.pos = { ...door.arrival }
assert(doorRun.clickTile(door.pos.c, door.pos.r), 'unlocked door was rejected')
assert(doorRun.currentRoom.id !== beforeRoom.id, 'door did not change rooms')
assert(sourceEnemy.cooldown === 0, 'frozen source room advanced during door transfer')
assert(doorRun.turn === 1, 'door transfer must advance the action clock')
const arrivalDoor = doorRun.dungeon.otherDoor(door)
assert(doorRun.currentRoom.isRevealed(arrivalDoor.arrival), 'arrival tile did not auto-reveal')
assert(doorRun.currentRoom.isRevealed(arrivalDoor.pos), 'the entered door must reveal in the destination room')
assert(doorRun.phase === 'reward' && doorRun.roomReward?.choices.length === 3, 'first arrival in a room did not open a room reward')
const roomItemRewardIndex = doorRun.roomReward.choices.findIndex((choice) => choice.kind === 'item')
assert(roomItemRewardIndex >= 0 && doorRun.chooseRoomReward(roomItemRewardIndex), 'room item reward could not be claimed')
assert(doorRun.phase === 'explore' && !doorRun.roomReward, 'claiming a room reward did not return to exploration')

const keyRun = new GameRun({ autoLoad: false, random: () => 0.5 })
keyRun.chooseInitialRelic(keyRun.initialRelicChoices[0])
const lockedEdge = [...keyRun.dungeon.edges.values()].find((edge) => edge.locked)
const lockedRoom = keyRun.dungeon.room(lockedEdge.fromRoomId)
const key = [...lockedRoom.entities.values()].find((entity) => entity.kind === 'key' && entity.edgeId === lockedEdge.id)
keyRun.player.roomId = lockedRoom.id
keyRun.player.pos = { ...key.pos }
lockedRoom.reveal(key.pos)
assert(keyRun.clickTile(key.pos.c, key.pos.r), 'key pickup was rejected')
assert(lockedEdge.unlocked, 'key pickup did not unlock its bound edge')

const combatRun = new GameRun({ autoLoad: false, random: () => 0.5 })
combatRun.chooseInitialRelic(combatRun.initialRelicChoices[0])
const combatRoom = combatRun.currentRoom
const enemy = [...combatRoom.entities.values()].find((entity) => entity.kind === 'enemy')
const approach = adjacentEmpty(combatRoom, enemy, { cardinalOnly: true })
assert(approach, 'enemy has no adjacent empty test cell')
combatRoom.reveal(enemy.pos)
combatRoom.reveal(approach)
combatRun.player.pos = { ...approach }
enemy.cooldown = 0
const hpBefore = combatRun.player.hp
combatRun.wait()
assert(combatRun.player.hp < hpBefore, 'ready enemy did not act on the turn step')

const merchantRun = new GameRun({ autoLoad: false, random: () => 0.5 })
merchantRun.chooseInitialRelic(merchantRun.initialRelicChoices[0])
openMerchant(merchantRun, 'peddler')
merchantRun.player.gold = 20
const merchantItemsBefore = merchantRun.backpack.items.length
assert(merchantRun.buyMerchantItem(0), 'merchant item purchase was rejected')
assert(merchantRun.merchantEntity.stock[0]?.itemId && !merchantRun.merchantEntity.stock[0].sold, 'merchant purchase did not refresh its stock slot')
assert(merchantRun.backpack.items.length === merchantItemsBefore + 1, 'merchant purchase did not enter the backpack')
const purchasedItem = merchantRun.backpack.items.at(-1)
const purchasedPlacement = merchantRun.backpack.placementOf(purchasedItem.uid)
merchantRun.selectInventory(merchantRun.backpack.originIndex(purchasedPlacement))
const goldBeforeSale = merchantRun.player.gold
assert(merchantRun.sellSelectedMerchantItem() && merchantRun.player.gold > goldBeforeSale, 'merchant could not buy the selected inventory item')
const refreshPrice = merchantRun.merchantEntity.restockPrice
merchantRun.player.gold = Math.max(merchantRun.player.gold, refreshPrice)
assert(merchantRun.refreshMerchantInventory(), 'merchant could not refresh all stock for gold')
const inactiveRelic = RELIC_DEFS.find((definition) => !merchantRun.relics.has(definition.id))
assert(inactiveRelic && merchantRun.acquireRelic(inactiveRelic.id), 'could not acquire an inactive relic for merchant test')
assert(merchantRun.activateRelic(inactiveRelic.id), 'merchant did not enable relic activation')
assert(merchantRun.deactivateRelic(inactiveRelic.id), 'merchant did not enable relic deactivation')
merchantRun.closeMerchant()
openMerchant(merchantRun, 'curator')
assert(merchantRun.canManageRelics(), 'curator did not enable relic management')
assert(merchantRun.merchantEntity.relicChoices.length === 3, 'curator did not offer three relic choices')
const offeredRelic = merchantRun.merchantEntity.relicChoices[0]
assert(merchantRun.chooseMerchantRelic(offeredRelic), 'curator relic choice was rejected')
assert(merchantRun.relics.has(offeredRelic) && !merchantRun.relics.isActive(offeredRelic), 'curator relic choice should enter inactive collection')
assert(merchantRun.activateRelic(inactiveRelic.id), 'curator could not activate owned relic')
assert(merchantRun.relics.isActive(inactiveRelic.id), 'curator activation did not persist')
assert(merchantRun.deactivateRelic(inactiveRelic.id), 'curator could not deactivate active relic')

const dropRun = new GameRun({ autoLoad: false, random: () => 0 })
dropRun.chooseInitialRelic(dropRun.initialRelicChoices[0])
const dropRoom = dropRun.currentRoom
const dropEnemy = [...dropRoom.entities.values()].find((entity) => entity.kind === 'enemy')
const dropApproach = adjacentEmpty(dropRoom, dropEnemy)
dropRoom.reveal(dropEnemy.pos)
dropRoom.reveal(dropApproach)
dropRun.player.pos = { ...dropApproach }
assert(dropRun.clickTile(dropEnemy.pos.c, dropEnemy.pos.r), 'enemy kill for temporary weapon drop was rejected')
const temporaryDrop = dropRoom.entityAt(dropEnemy.pos)
assert(temporaryDrop?.kind === 'item' && temporaryDrop.item.temporary && temporaryDrop.item.durability === 1, 'enemy did not leave a one-durability temporary weapon')

const dualWeaponRun = new GameRun({ autoLoad: false, random: () => 0.5 })
dualWeaponRun.chooseInitialRelic(dualWeaponRun.initialRelicChoices[0])
const secondWeaponIndex = addToBackpack(dualWeaponRun, { ...dualWeaponRun.player.equipment[0], uid: 'dual-weapon-test' })
dualWeaponRun.selectInventory(secondWeaponIndex)
assert(dualWeaponRun.equipSelected(1), 'second weapon could not be equipped to the right hand')
assert(dualWeaponRun.player.equipment[0] && dualWeaponRun.player.equipment[1], 'both equipment slots should hold weapons')
dualWeaponRun.selectEquipmentSlot(1)
assert(dualWeaponRun.discardSelected(), 'selected equipped weapon could not be discarded')
assert(!dualWeaponRun.player.equipment[1], 'discard did not clear the selected equipment slot')
const whetstoneIndex = addToBackpack(dualWeaponRun, makeItemById('whetstone'))
dualWeaponRun.selectInventory(whetstoneIndex)
assert(dualWeaponRun.useSelected() && dualWeaponRun.itemTargeting, 'whetstone did not enter equipment target mode')
const repairedDurability = dualWeaponRun.player.equipment[0].durability
assert(dualWeaponRun.applySelectedItemToEquipment(0), 'whetstone could not target the left-hand weapon')
assert(dualWeaponRun.player.equipment[0].durability === repairedDurability + 2, 'whetstone did not repair its selected hand')

const backpackRepairRun = new GameRun({ autoLoad: false, random: () => 0.5 })
backpackRepairRun.chooseInitialRelic(backpackRepairRun.initialRelicChoices[0])
const backpackWeapon = makeItemById('short-sword')
backpackWeapon.durability = 1
const backpackWeaponIndex = addToBackpack(backpackRepairRun, backpackWeapon)
const backpackStoneIndex = addToBackpack(backpackRepairRun, makeItemById('whetstone'))
backpackRepairRun.selectInventory(backpackStoneIndex)
const backpackRepairTurn = backpackRepairRun.turn
assert(backpackRepairRun.useSelected() && backpackRepairRun.itemTargeting, 'whetstone did not enter weapon target mode')
assert(backpackRepairRun.applySelectedItemToBackpackWeapon(backpackWeaponIndex), 'whetstone could not target a backpack weapon')
assert(backpackWeapon.durability === 3 && backpackRepairRun.turn === backpackRepairTurn + 1, 'backpack weapon was not repaired with the normal whetstone turn cost')

const dualAttackRun = new GameRun({ autoLoad: false, random: () => 0.5 })
dualAttackRun.chooseInitialRelic(dualAttackRun.initialRelicChoices[0])
dualAttackRun.player.equipment[1] = { ...dualAttackRun.player.equipment[0], uid: 'dual-attack-test', durability: 3 }
const dualRoom = dualAttackRun.currentRoom
const dualEnemy = [...dualRoom.entities.values()].find((entity) => entity.kind === 'enemy')
const dualApproach = adjacentEmpty(dualRoom, dualEnemy)
dualRoom.reveal(dualEnemy.pos)
dualRoom.reveal(dualApproach)
dualEnemy.hp = 99
dualAttackRun.player.pos = { ...dualApproach }
const leftDurability = dualAttackRun.player.equipment[0].durability
const rightDurability = dualAttackRun.player.equipment[1].durability
assert(dualAttackRun.clickTile(dualEnemy.pos.c, dualEnemy.pos.r), 'dual weapon attack was rejected')
assert(dualAttackRun.player.equipment[0].durability === leftDurability - 1, 'left-hand weapon did not attack')
assert(dualAttackRun.player.equipment[1].durability === rightDurability - 1, 'right-hand weapon did not attack')

const twoHandRun = new GameRun({ autoLoad: false, random: () => 0.5 })
twoHandRun.chooseInitialRelic(twoHandRun.initialRelicChoices[0])
const twoHandIndex = addToBackpack(twoHandRun, makeItemById('spear'))
twoHandRun.selectInventory(twoHandIndex)
assert(twoHandRun.equipSelected(1), 'two-handed weapon could not be equipped')
assert(twoHandRun.player.equipment[0] === twoHandRun.player.equipment[1] && twoHandRun.equippedWeapons.length === 1, 'two-handed weapon did not occupy both hands as one weapon')
twoHandRun.selectEquipmentSlot(1)
assert(twoHandRun.discardSelected() && !twoHandRun.player.equipment[0] && !twoHandRun.player.equipment[1], 'discarding a two-handed weapon did not free both hands')

const trapRun = new GameRun({ autoLoad: false, random: () => 0.5 })
trapRun.chooseInitialRelic(trapRun.initialRelicChoices[0])
const trapRoom = trapRun.currentRoom
const trapPosition = firstFlippable(trapRun)
const replacedTrapCard = trapRoom.entityAt(trapPosition)
if (replacedTrapCard) trapRoom.removeEntity(replacedTrapCard.id)
const explosionTrap = createTrapEntity('explosion', trapPosition)
trapRoom.addEntity(explosionTrap)
trapRun.player.hp = 20
assert(trapRun.clickTile(trapPosition.c, trapPosition.r), 'explosion trap could not be flipped')
assert(!trapRoom.entity(explosionTrap.id) && trapRun.player.hp <= 18, 'explosion trap did not resolve and remove itself')
const hiddenEnemy = [...trapRoom.entities.values()].find((entity) => entity.kind === 'enemy' && !trapRoom.isRevealed(entity.pos))
const alarmPosition = neighbors8(hiddenEnemy.pos, trapRoom.width, trapRoom.height).find((candidate) => {
  const entity = trapRoom.entityAt(candidate)
  return !entity || entity.kind !== 'door'
})
if (trapRoom.entityAt(alarmPosition)) trapRoom.removeEntity(trapRoom.entityAt(alarmPosition).id)
const alarmTrap = createTrapEntity('alarm', alarmPosition)
trapRoom.addEntity(alarmTrap)
trapRoom.reveal(alarmPosition)
trapRun._triggerTrap(alarmTrap)
assert(trapRoom.isRevealed(hiddenEnemy.pos), 'alarm trap did not reveal nearby hidden enemies')

const eventRun = new GameRun({ autoLoad: false, random: () => 0.5 })
eventRun.initialRelicChoices = []
eventRun.relics.acquire('r-coin-salve', { activate: true })
eventRun.player.hp = 10
eventRun._emitRelicEvent('gold:collected', { amount: 3 })
assert(eventRun.player.hp === 11 && eventRun.relicEventQueue.length === 0, 'relic event queue did not execute the gold pickup event')

const shadowRun = new GameRun({ autoLoad: false, random: () => 0.5 })
shadowRun.initialRelicChoices = []
shadowRun.relics.acquire('r-shadow-hide', { activate: true })
assert(shadowRun.useRelicSkill('r-shadow-hide') && shadowRun.stealthTurns === 2 && shadowRun.relicRuntime['r-shadow-hide']?.cooldown === 5, 'shadow active skill did not enter its cooldown and stealth state')
const commandRun = new GameRun({ autoLoad: false, random: () => 0.5 })
commandRun.initialRelicChoices = []
commandRun.relics.acquire('r-command-shout', { activate: true })
assert(commandRun.useRelicSkill('r-command-shout'), 'command active skill was rejected')
assert([...commandRun.currentRoom.entities.values()].filter((entity) => entity.kind === 'enemy').every((enemy) => commandRun.currentRoom.isRevealed(enemy.pos)), 'command active skill did not reveal every enemy in the room')

const actionCostRun = new GameRun({ autoLoad: false, random: () => 0.5 })
actionCostRun.chooseInitialRelic(actionCostRun.initialRelicChoices[0])
const smallPotionIndex = addToBackpack(actionCostRun, makeItemById('small-potion'))
const charmIndex = addToBackpack(actionCostRun, makeItemById('battle-charm'))
const shortSwordIndex = addToBackpack(actionCostRun, makeItemById('short-sword'))
const actionWhetstoneIndex = addToBackpack(actionCostRun, makeItemById('whetstone'))
const armorPotionIndex = addToBackpack(actionCostRun, makeItemById('armor-potion'))
const actionTurn = actionCostRun.turn
actionCostRun.selectInventory(smallPotionIndex)
assert(actionCostRun.useSelected() && actionCostRun.turn === actionTurn, 'potion must not consume a turn')
actionCostRun.selectInventory(charmIndex)
assert(actionCostRun.useSelected() && actionCostRun.turn === actionTurn, 'buff must not consume a turn')
actionCostRun.selectInventory(armorPotionIndex)
const armorBeforePotion = actionCostRun.player.armor
assert(actionCostRun.useSelected() && actionCostRun.player.armor === armorBeforePotion + 5 && actionCostRun.turn === actionTurn, 'armor potion must grant armor without consuming a turn')
actionCostRun.selectInventory(shortSwordIndex)
assert(actionCostRun.equipSelected(1) && actionCostRun.turn === actionTurn + 1, 'equipping must consume a turn')
actionCostRun.selectEquipmentSlot(1)
assert(actionCostRun.discardSelected() && actionCostRun.turn === actionTurn + 1, 'discarding equipment must not consume a turn')
actionCostRun.selectInventory(actionWhetstoneIndex)
assert(actionCostRun.useSelected() && actionCostRun.turn === actionTurn + 1, 'selecting a whetstone target must not consume a turn')
assert(actionCostRun.applySelectedItemToEquipment(0) && actionCostRun.turn === actionTurn + 2, 'using a whetstone must consume a turn')

const pathRoom = new Room({ id: 'path-test', floor: 1, width: 3, height: 3 })
const diagonalStart = pos(0, 0)
const diagonalGoal = pos(1, 1)
pathRoom.reveal(diagonalStart)
pathRoom.reveal(diagonalGoal)
assert(findPath(pathRoom, diagonalStart, diagonalGoal)?.length === 1, 'eight-direction pathfinding is not active')
assert(findAttackPath(pathRoom, diagonalStart, { pos: diagonalGoal }, [{ range: 1 }])?.path.length === 0, 'melee must attack a diagonal target without moving')

const revealPathRoom = new Room({ id: 'weighted-reveal-test', floor: 1, width: 3, height: 4 })
const revealStart = pos(1, 3)
const revealTarget = pos(1, 1)
for (const revealed of [revealStart, pos(0, 2), pos(1, 2), pos(2, 2)]) revealPathRoom.reveal(revealed)
const weightedRevealPath = findRevealPath(revealPathRoom, revealStart, revealTarget)
assert(weightedRevealPath?.path.length === 1 && weightedRevealPath.path[0].c === 1 && weightedRevealPath.path[0].r === 2, 'straight approach must beat a diagonal approach by movement cost')

assert(typeof ENEMY_BEHAVIORS.stationary === 'function', 'stationary enemy behavior is not registered')
const enemyBehaviorTest = { behavior: 'stationary', cooldown: 1, range: 2, pos: pos(0, 0) }
let enemyBehaviorAttacks = 0
assert(stepEnemy(enemyBehaviorTest, { player: { pos: pos(1, 1) }, attack: () => { enemyBehaviorAttacks += 1 } }).reason === 'cooldown', 'enemy cooldown did not take priority')
assert(enemyBehaviorTest.cooldown === 0 && enemyBehaviorAttacks === 0, 'enemy cooldown advanced incorrectly')
assert(stepEnemy(enemyBehaviorTest, { player: { pos: pos(3, 0) }, attack: () => { enemyBehaviorAttacks += 1 } }).reason === 'out-of-range', 'enemy range check is invalid')
assert(enemyBehaviorAttacks === 0, 'out-of-range enemy attacked')
assert(stepEnemy({ ...enemyBehaviorTest, behavior: 'future-behavior' }, { player: { pos: pos(1, 0) }, attack: () => { enemyBehaviorAttacks += 1 } }).reason === 'attack', 'unknown enemy behavior did not safely fall back')
assert(enemyBehaviorAttacks === 1, 'in-range enemy did not attack exactly once')

const relicCapacity = new RelicCollection()
for (const definition of RELIC_DEFS.slice(0, 6)) relicCapacity.acquire(definition.id)
for (const definition of RELIC_DEFS.slice(0, 5)) assert(relicCapacity.activate(definition.id), 'relic activation before capacity was rejected')
assert(!relicCapacity.activate(RELIC_DEFS[5].id) && relicCapacity.active.length === 5, 'relic activation exceeded the five-slot limit')

const slashWeapon = { name: 'test', attack: 5, damageType: 'slash', durability: 3 }
const bloodTarget = { category: 'blood' }
assert(computeAttackDamage({ weapon: slashWeapon, target: bloodTarget }).damage === 8, 'counter damage multiplier is invalid')
assert(computeAttackDamage({ weapon: { ...slashWeapon, durability: 1 }, target: bloodTarget }).damage === 4, 'last durability penalty is invalid')
assert(computeAttackDamage({ weapon: slashWeapon, target: { category: 'shell' } }).damage === 3, 'resisted damage multiplier is invalid')

const relicRun = new GameRun({ autoLoad: false, random: () => 0.5 })
relicRun.initialRelicChoices = ['r-last-edge']
assert(relicRun.chooseInitialRelic('r-last-edge')?.active, 'initial relic acquisition did not activate')
assert(!relicRun.acquireRelic('r-hunter-mark')?.active, 'later relic acquisition must remain inactive')
const damagedWeapon = { ...slashWeapon, durability: 1 }
const type = attackTypeModifier(damagedWeapon, bloodTarget)
const relicModifiers = relicRun.relicEngine.damageModifiers({
  weapon: damagedWeapon,
  target: bloodTarget,
  player: relicRun.player,
  countered: type.countered,
  resisted: type.resisted,
})
assert(computeAttackDamage({ weapon: damagedWeapon, target: bloodTarget, relicModifiers }).damage === 6, 'relic damage modifier is not applied')
assert(buildRelicChoices(relicRun.relics, { random: () => 0 }).every((relic) => relic.id !== 'r-last-edge'), 'owned relic returned as a choice')

const previousLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const saveStorage = new Map()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key) => saveStorage.get(key) || null,
    setItem: (key, value) => saveStorage.set(key, value),
    removeItem: (key) => saveStorage.delete(key),
  },
})
try {
  const persistenceRun = new GameRun({ autoLoad: false, random: () => 0.5 })
  persistenceRun.chooseInitialRelic(persistenceRun.initialRelicChoices[0])
  const persistedEdge = [...persistenceRun.dungeon.edges.values()].find((edge) => edge.locked)
  persistedEdge.unlocked = true
  openMerchant(persistenceRun, 'smith')
  persistenceRun.player.gold = 20
  assert(persistenceRun.buyMerchantItem(0), 'could not prepare merchant persistence state')
  const persistedGold = persistenceRun.player.gold
  const savedIdentifiers = new Set([
    ...[...persistenceRun.dungeon.rooms.values()].flatMap((room) => [...room.entities.values()].flatMap((entity) => [entity.id, entity.item?.uid])),
    ...persistenceRun.backpack.items.map((item) => item?.uid),
    ...persistenceRun.player.equipment.map((item) => item?.uid),
  ])
  resetEntityIds()
  const restoredRun = new GameRun({ autoLoad: true, random: () => 0.5 })
  assert(restoredRun.player.gold === persistedGold && restoredRun.dungeon.edge(persistedEdge.id).unlocked, 'player or locked-door state did not persist')
  assert(restoredRun.phase === 'merchant' && restoredRun.merchantEntity?.merchantId === 'smith', 'open merchant state did not restore')
  assert(restoredRun.merchantEntity.stock[0]?.itemId && !restoredRun.merchantEntity.stock[0].sold, 'merchant stock refresh did not persist')
  const generatedAfterLoad = makeItemById('small-potion')
  assert(!savedIdentifiers.has(generatedAfterLoad.uid), 'loaded save reused an existing item identifier')
  const invalidMerchantSave = restoredRun.serialize()
  invalidMerchantSave.phase = 'merchant'
  invalidMerchantSave.merchant = { entityId: 'missing-merchant' }
  saveStorage.set(SAVE_KEY, JSON.stringify(invalidMerchantSave))
  const recoveredRun = new GameRun({ autoLoad: true, random: () => 0.5 })
  assert(recoveredRun.phase === 'explore' && !recoveredRun.merchant, 'invalid merchant save was not recovered to exploration')
} finally {
  if (previousLocalStorage) Object.defineProperty(globalThis, 'localStorage', previousLocalStorage)
  else delete globalThis.localStorage
}

console.log('v2-check passed')
