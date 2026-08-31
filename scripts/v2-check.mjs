import { EQUIPMENT_SLOTS, GameRun, INVENTORY_COLUMNS, INVENTORY_ROWS, SAVE_KEY } from '../src/game/run.js'
import { isAdjacent8, neighbors8, pos } from '../src/game/core/geometry.js'
import { Room } from '../src/game/model/room.js'
import { BackpackGrid } from '../src/game/model/backpack.js'
import { Dungeon, createLinearDungeon, validateDungeonLayout } from '../src/game/model/dungeon.js'
import { createEnemyById, createMonster, makeItemById, randomItem, resetEntityIds } from '../src/game/data/content.js'
import { ATTRIBUTE_ORDER, attributeLabel, attributeModifier, migrateAttributeId } from '../src/game/data/attributes.js'
import { enemyDefinitionFor } from '../src/game/data/enemies.js'
import catalog from '../src/game/data/catalog.json' with { type: 'json' }
import { RelicCollection } from '../src/game/model/relics.js'
import { buildRelicChoices, RELIC_DEFS } from '../src/game/data/relics.js'
import { attackAttributeModifier, computeAttackDamage } from '../src/game/rules/modifiers.js'
import { ENEMY_BEHAVIORS, stepEnemy } from '../src/game/rules/enemies.js'
import { findAttackPath, findPath, findRevealPath } from '../src/game/rules/pathfinding.js'
import { createTrapEntity } from '../src/game/data/traps.js'
import { enemyFeatureLabel } from '../src/game/data/enemy-features.js'
import { experienceToNextLevel, masteryPreservationChance } from '../src/game/data/progression.js'

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
assert(run.dungeon.rooms.size === 8, 'expected 8 configured rooms')
assert(Array.isArray(catalog.enemies) && Array.isArray(catalog.weapons) && Array.isArray(catalog.consumables), 'static game data must be stored in the catalog JSON')
const attributeContent = [...catalog.enemies, catalog.boss, ...catalog.weapons, ...catalog.consumables, ...catalog.enemyLoot]
assert(JSON.stringify(ATTRIBUTE_ORDER) === JSON.stringify(['scorch', 'wither', 'drown']), 'attribute roster must contain only scorch, wither, and drown')
assert(attributeLabel('scorch') === '\u707c\u70ed' && attributeLabel('wither') === '\u67af\u840e' && attributeLabel('drown') === '\u6c89\u6eba', 'attribute labels are invalid')
assert(migrateAttributeId('slime') === 'wither' && migrateAttributeId('crystal') === 'wither' && migrateAttributeId('tide') === 'drown', 'legacy attributes did not migrate to the new roster')
assert(attributeContent.every((entry) => ATTRIBUTE_ORDER.includes(entry.attribute)), 'every authored enemy, weapon, and item must have one valid attribute')
assert(attributeContent.every((entry) => !('category' in entry) && !('damageType' in entry)), 'legacy weapon types and enemy categories must not remain in authored content')
assert(catalog.enemies.find((enemy) => enemy.id === 'gnawer')?.initialActionDelay === 1, 'gnawer must have a one-turn initial action delay')
assert(catalog.enemies.find((enemy) => enemy.id === 'nest-spider')?.minFloor === 3, 'nest spider must first appear on floor three')
assert(catalog.enemies.every((enemy) => Number.isInteger(enemy.initialActionDelay) && enemy.initialActionDelay >= 0), 'every enemy must define its own initial action delay')
assert(catalog.enemies.every((enemy) => Number.isInteger(enemy.hp) && Number.isInteger(enemy.attack) && !('hpBase' in enemy) && !('attackBase' in enemy)), 'enemy attributes must be fixed static values rather than floor-scaled values')
assert(catalog.enemies.filter((enemy) => !enemy.spawnOnly).every((enemy) => Number.isInteger(enemy.experience) && enemy.experience > 0 && enemy.relicDropChance > 0), 'every natural enemy must author its experience and relic-drop probability')
const floorFourGnawer = createMonster(4, 0)
assert(floorFourGnawer?.enemyId === 'gnawer' && floorFourGnawer.hp === 4 && floorFourGnawer.attack === 4, 'a gnawer on a later floor must retain its fixed 4 HP and 4 attack')
for (let floor = 1; floor <= 4; floor += 1) {
  const available = catalog.enemies.filter((enemy) => !enemy.spawnOnly && enemy.minFloor <= floor)
  const generated = new Set(available.map((_, index) => enemyDefinitionFor(floor, index)?.id))
  assert(available.every((enemy) => generated.has(enemy.id)), `floor ${floor} did not retain every enemy unlocked on or before that floor`)
}
assert(INVENTORY_ROWS === 5 && INVENTORY_COLUMNS === 5 && run.backpack.capacity === 25 && run.backpack.length === 0, 'inventory must be a five-column by five-row shape grid')
assert(run.player.equipment.length === EQUIPMENT_SLOTS && run.player.equipment[0] && !run.player.equipment[1], 'new run must have left and right equipment slots')
assert(!('sanity' in run.player), 'sanity must not exist in V2 player state')
const floorLayouts = [[1, 1, 7], [2, 2, 8], [3, 2, 9], [4, 2, 9], [5, 1, 10]]
for (const [floor, expectedRoomCount, expectedSize] of floorLayouts) {
  const rooms = [...run.dungeon.rooms.values()].filter((room) => room.floor === floor)
  assert(rooms.length === expectedRoomCount, `floor ${floor} must have ${expectedRoomCount} rooms`)
  assert(rooms.every((room) => room.width === expectedSize && room.height === expectedSize), `floor ${floor} rooms must be ${expectedSize}x${expectedSize}`)
}
const floorThreeLayouts = run.dungeon.floorRooms(3).map((room) => run.dungeon.roomLayout(room.id))
assert(JSON.stringify(floorThreeLayouts) === JSON.stringify([{ c: 1, r: 0 }, { c: 0, r: 0 }]), 'floor three must use the planned two-room layout')
assert(validateDungeonLayout(run.dungeon), 'generated dungeon layout did not pass structural validation')
for (let seed = 1; seed <= 12; seed += 1) {
  let value = seed
  const random = () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
  const generated = createLinearDungeon({ random })
  assert(validateDungeonLayout(generated.dungeon), `seed ${seed} generated an invalid dungeon layout`)
}
const doorSides = [...run.dungeon.edges.values()].flatMap((edge) => [edge.fromDoor.side, edge.toDoor.side])
assert(doorSides.includes('top') && doorSides.includes('bottom'), 'room connections must use vertical doors as well as left and right doors')
for (const room of run.dungeon.rooms.values()) {
  const sides = run.dungeon.doorsForRoom(room.id).map((door) => door.side)
  assert(new Set(sides).size === sides.length, `room ${room.id} must not place its entry and exit on the same wall`)
}
const rehydratedDungeon = Dungeon.hydrate(run.dungeon.serialize())
assert(JSON.stringify(rehydratedDungeon.roomLayout(rehydratedDungeon.floorRooms(3)[0].id)) === JSON.stringify({ c: 1, r: 0 }), 'saved room layouts must preserve the floor topology')
const overlappingLayout = Dungeon.hydrate(run.dungeon.serialize())
const floorTwoRooms = overlappingLayout.floorRooms(2)
overlappingLayout.setRoomLayout(floorTwoRooms[1].id, overlappingLayout.roomLayout(floorTwoRooms[0].id))
let overlapRejected = false
try {
  validateDungeonLayout(overlappingLayout)
} catch {
  overlapRejected = true
}
assert(overlapRejected, 'layout validation accepted overlapping room coordinates')
const misdirectedDoorLayout = Dungeon.hydrate(run.dungeon.serialize())
misdirectedDoorLayout.edge('edge-2').fromDoor.side = 'top'
let doorDirectionRejected = false
try {
  validateDungeonLayout(misdirectedDoorLayout)
} catch {
  doorDirectionRejected = true
}
assert(doorDirectionRejected, 'layout validation accepted a door facing away from its neighboring room')
const openingRoomEnemies = [...run.currentRoom.entities.values()].filter((entity) => entity.kind === 'enemy')
const openingAlarmTraps = [...run.currentRoom.entities.values()].filter((entity) => entity.kind === 'trap' && entity.trapId === 'alarm')
assert(openingRoomEnemies.length === 12 && openingRoomEnemies.every((entity) => entity.behavior !== 'ambush'), 'the opening room must not contain ambush enemies')
assert(openingAlarmTraps.length === 1, 'the opening room must retain one alarm trap')
assert([...run.currentRoom.entities.values()].some((entity) => entity.kind === 'item' && entity.item.id === 'short-sword'), 'the opening room must guarantee an accessible weapon card')
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
assert(merchants.length === 3 && merchants.filter((merchant) => merchant.merchantId === 'merchant').length === 2 && merchants.filter((merchant) => merchant.merchantId === 'collector').length === 1, 'expected two merchants and one collector')
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
assert(run.detailPanel.lines.includes(`\u884c\u52a8\u5ef6\u8fdf ${detailEnemy.actionDelay}`), 'board enemy detail panel must show only the remaining action delay')
assert(!run.detailPanel.lines.some((line) => line.startsWith('\u884c\u52a8\u5ef6\u8fdf ') && line.includes('/')), 'board enemy detail panel must not show the initial action delay')
const detailFeatures = enemyFeatureLabel(detailEnemy)
assert(
  detailFeatures ? run.detailPanel.badges.includes(detailFeatures) : !run.detailPanel.badges.some((badge) => badge === detailFeatures),
  'board enemy detail panel did not represent the card features as a name-row badge',
)
assert(run.detailPanel.badges.includes(attributeLabel(detailEnemy.attribute)), 'board enemy detail panel did not represent the attribute as a name-row badge')
assert(!run.detailPanel.lines.some((line) => line.startsWith('\u5c5e\u6027 ')), 'board enemy detail panel must not duplicate the attribute as a label/value row')
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
assert(!fallbackRotationGrid.rotate(fallbackRotationItem.uid), 'rotation should remain in place when the rotated footprint is blocked')
const fallbackPlacement = fallbackRotationGrid.placementOf(fallbackRotationItem.uid)
assert(fallbackPlacement.rotation === 0 && fallbackPlacement.x === 0 && fallbackPlacement.y === 0, 'blocked rotation must not move the item')
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
const legacyBackpack = BackpackGrid.hydrate({ columns: 6, rows: 4, placements: [{ item: makeItemById('small-potion'), x: 5, y: 3, rotation: 0 }] })
assert(legacyBackpack.columns === 5 && legacyBackpack.rows === 5 && legacyBackpack.length === 1, 'a legacy six-by-four backpack save did not reflow into the five-by-five grid')

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

const clickInventoryRun = new GameRun({ autoLoad: false, random: () => 0.5 })
clickInventoryRun.chooseInitialRelic(clickInventoryRun.initialRelicChoices[0])
const clickMoveItem = makeItemById('short-sword')
const clickSelectItem = makeItemById('small-potion')
const clickMoveOrigin = addToBackpack(clickInventoryRun, clickMoveItem)
const clickSelectOrigin = addToBackpack(clickInventoryRun, clickSelectItem)
assert(clickInventoryRun.clickInventoryCell(clickMoveOrigin) && clickInventoryRun.selectedItem?.uid === clickMoveItem.uid, 'clicking a backpack item did not select it')
assert(clickInventoryRun.clickInventoryCell(clickSelectOrigin) && clickInventoryRun.selectedItem?.uid === clickSelectItem.uid, 'clicking another backpack item did not select the new item')
assert(clickInventoryRun.clickInventoryCell(clickSelectOrigin) && !clickInventoryRun.selectedItem, 'clicking the selected backpack item did not cancel selection')
assert(clickInventoryRun.clickInventoryCell(clickMoveOrigin), 'backpack item could not be selected for a direct move')
const clickMoveDestination = INVENTORY_COLUMNS * 2 + 3
const clickMoveRotation = clickInventoryRun.backpack.placementOf(clickMoveItem.uid).rotation
assert(clickInventoryRun.clickInventoryCell(clickMoveDestination), 'clicking an empty backpack cell did not move the selected item')
const clickMovePlacement = clickInventoryRun.backpack.placementOf(clickMoveItem.uid)
assert(clickInventoryRun.selectedItem?.uid === clickMoveItem.uid && clickInventoryRun.backpack.originIndex(clickMovePlacement) === clickMoveDestination && clickMovePlacement.rotation === clickMoveRotation, 'direct backpack move changed selection, origin, or rotation unexpectedly')

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
const orderedPreview = orderedFlipRun.previewTileAction(orderedTarget.c, orderedTarget.r)
assert(orderedPreview?.kind === 'flip' && orderedPreview.path.length === orderedRoute.length, 'remote flip did not expose its exact movement preview')
assert(orderedPreview.targeted && orderedPreview.arrival.c === orderedRoute.at(-1).c && orderedPreview.arrival.r === orderedRoute.at(-1).r, 'remote flip preview did not distinguish its arrival cell from its target cell')
assert(!orderedRoom.isRevealed(orderedTarget) && orderedFlipRun.turn === 0, 'path preview must not reveal a card or consume a turn')

const rangedPreviewRun = new GameRun({ autoLoad: false, random: () => 0.5 })
rangedPreviewRun.chooseInitialRelic(rangedPreviewRun.initialRelicChoices[0])
const rangedPreviewRoom = rangedPreviewRun.currentRoom
for (const entity of [...rangedPreviewRoom.entities.values()]) rangedPreviewRoom.removeEntity(entity.id)
for (let r = 0; r < rangedPreviewRoom.height; r += 1) {
  for (let c = 0; c < rangedPreviewRoom.width; c += 1) rangedPreviewRoom.reveal(pos(c, r))
}
rangedPreviewRun.player.pos = pos(0, 0)
rangedPreviewRun.player.equipment = [{ uid: 'preview-bow', type: 'weapon', range: 2, durability: 1 }, null]
const rangedPreviewEnemy = createEnemyById('gnawer', pos(4, 0))
rangedPreviewRoom.addEntity(rangedPreviewEnemy)
const rangedPreview = rangedPreviewRun.previewTileAction(rangedPreviewEnemy.pos.c, rangedPreviewEnemy.pos.r)
assert(rangedPreview?.kind === 'attack' && rangedPreview.targeted && rangedPreview.arrival.c === 2 && rangedPreview.arrival.r === 0, 'ranged attack preview did not stop at a legal firing position')

const orderedEvents = []
orderedFlipRun.on('change', () => orderedEvents.push('change'))
orderedFlipRun.on('animate:move', () => orderedEvents.push('move'))
orderedFlipRun.on('animate:flip', () => orderedEvents.push('flip'))
assert(orderedFlipRun.clickTile(orderedTarget.c, orderedTarget.r), 'remote flip was rejected')
assert(orderedEvents.indexOf('change') >= 0 && orderedEvents.indexOf('change') < orderedEvents.indexOf('flip'), 'remote flip animation must run after the player movement render')
assert(orderedEvents.indexOf('move') >= 0 && orderedEvents.indexOf('move') < orderedEvents.indexOf('flip'), 'remote flip must queue after the player movement animation')

const flipTarget = firstFlippable(run)
assert(flipTarget, 'the initial room has no legal flip')
assert(run.clickTile(flipTarget.c, flipTarget.r), 'legal flip was rejected')
assert(run.currentRoom.isRevealed(flipTarget), 'flipped tile did not reveal')
assert(run.turn === 1, 'flip must consume one turn')
assert(run.dungeon.doorsForRoom(run.currentRoom.id).every((door) => !run.currentRoom.isRevealed(door.arrival)), 'door arrival tiles must begin hidden')

const flipGraceRun = new GameRun({ autoLoad: false, random: () => 0.5 })
flipGraceRun.chooseInitialRelic(flipGraceRun.initialRelicChoices[0])
const flipGraceRoom = flipGraceRun.currentRoom
const flipGraceEnemy = [...flipGraceRoom.entities.values()].find((entity) => entity.kind === 'enemy' && entity.enemyId === 'gnawer')
const flipGraceApproach = adjacentEmpty(flipGraceRoom, flipGraceEnemy, { cardinalOnly: false })
assert(flipGraceApproach, 'test enemy has no adjacent flip position')
flipGraceRun.player.pos = { ...flipGraceApproach }
flipGraceRoom.reveal(flipGraceApproach)
flipGraceRun.player.hp = 4
assert(flipGraceEnemy.actionDelay === 1, 'gnawer instance did not receive its static initial action delay')
assert(flipGraceRun.clickTile(flipGraceEnemy.pos.c, flipGraceEnemy.pos.r), 'enemy flip was rejected')
assert(flipGraceRun.player.hp === 4 && flipGraceEnemy.actionDelay === 0, 'a newly flipped delayed enemy attacked immediately')

const doorRun = new GameRun({ autoLoad: false, random: () => 0.5 })
doorRun.chooseInitialRelic(doorRun.initialRelicChoices[0])
const beforeRoom = doorRun.currentRoom
const door = doorRun.dungeon.doorsForRoom(beforeRoom.id)[0]
assert(!doorRun.isDoorRevealed(door), 'an unexplored room exit must initially render as a wall')
assert(!doorRun.clickDoor(door.id), 'an unexplored room exit must not be interactable')
const sourceEnemy = [...beforeRoom.entities.values()].find((entity) => entity.kind === 'enemy')
const doorApproach = adjacentEmpty(beforeRoom, { pos: door.arrival }, { cardinalOnly: false })
assert(doorApproach, 'door has no adjacent approach tile')
beforeRoom.reveal(door.arrival)
beforeRoom.reveal(doorApproach)
beforeRoom.reveal(sourceEnemy.pos)
sourceEnemy.actionDelay = 1
doorRun.player.pos = { ...doorApproach }
assert(![...beforeRoom.entities.values()].some((entity) => entity.kind === 'door'), 'doors must not occupy card tiles')
assert(doorRun.clickTile(door.arrival.c, door.arrival.r), 'arrival tile move was rejected')
assert(doorRun.currentRoom.id === beforeRoom.id && doorRun.player.pos.c === door.arrival.c && doorRun.player.pos.r === door.arrival.r, 'clicking an arrival tile must move without entering the door')
assert(doorRun.isDoorRevealed(door), 'approaching an exit did not permanently reveal the door')
assert(doorRun.clickDoor(door.id), 'unlocked door was rejected')
assert(doorRun.currentRoom.id !== beforeRoom.id, 'door did not change rooms')
assert(sourceEnemy.actionDelay === 0, 'frozen source room advanced during door transfer')
assert(doorRun.turn === 2, 'arrival movement and door transfer must each advance the action clock')
const arrivalDoor = doorRun.dungeon.otherDoor(door)
assert(doorRun.currentRoom.isRevealed(arrivalDoor.arrival), 'arrival tile did not auto-reveal')
assert(doorRun.phase === 'reward' && doorRun.roomReward?.choices.length === 3, 'first arrival in a room did not open a room reward')
assert(doorRun.roomReward.type === 'supply' && doorRun.roomReward.choices.filter((choice) => choice.kind === 'item').length >= 2, 'supply reward did not create its authored three-way choice')
const roomItemRewardIndex = doorRun.roomReward.choices.findIndex((choice) => choice.kind === 'item')
assert(roomItemRewardIndex >= 0 && doorRun.chooseRoomReward(roomItemRewardIndex), 'room item reward could not be claimed')
assert(doorRun.phase === 'explore' && !doorRun.roomReward, 'claiming a room reward did not return to exploration')

const remoteDoorRun = new GameRun({ autoLoad: false, random: () => 0.5 })
remoteDoorRun.chooseInitialRelic(remoteDoorRun.initialRelicChoices[0])
const remoteDoorRoom = remoteDoorRun.currentRoom
const remoteDoor = remoteDoorRun.dungeon.doorsForRoom(remoteDoorRoom.id)[0]
remoteDoor.discovered = true
for (const entity of [...remoteDoorRoom.entities.values()]) remoteDoorRoom.removeEntity(entity.id)
for (let r = 0; r < remoteDoorRoom.height; r += 1) {
  for (let c = 0; c < remoteDoorRoom.width; c += 1) remoteDoorRoom.reveal({ c, r })
}
remoteDoorRun.player.pos = { c: 0, r: 0 }
assert(remoteDoorRun.previewDoorAction(remoteDoor.id)?.path.length > 0, 'remote door did not preview a route to its arrival tile')
assert(remoteDoorRun.clickDoor(remoteDoor.id), 'remote door click was rejected')
assert(remoteDoorRun.currentRoom.id !== remoteDoorRoom.id, 'clicking a remote door must walk to its arrival tile and enter')

const rewardBagRun = new GameRun({ autoLoad: false, random: () => 0.5 })
rewardBagRun.roomRewardBag = ['supply', 'supply', 'supply', 'relic']
assert(['supply', 'supply', 'supply', 'relic'].every((type) => rewardBagRun._drawRoomRewardType() === type), 'room reward bag must contain three supplies and one relic reward')

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
enemy.actionDelay = 0
enemy.attackCooldown = 0
const hpBefore = combatRun.player.hp
combatRun._endTurn()
assert(combatRun.player.hp < hpBefore, 'ready enemy did not act on the turn step')

const armorLogRun = new GameRun({ autoLoad: false, random: () => 0.5 })
armorLogRun.player.hp = 20
armorLogRun.player.armor = 3
armorLogRun._enemyAttack({ name: 'test enemy', attack: 2, attackCooldownMax: 0 })
assert(armorLogRun.log[0].endsWith('\u51cf2\u7532\u3002'), 'fully absorbed damage must report the armor reduction')
armorLogRun.player.armor = 3
armorLogRun._enemyAttack({ name: 'test enemy', attack: 5, attackCooldownMax: 0 })
assert(armorLogRun.log[0].endsWith('\u51cf2\u8840\uff0c\u51cf3\u7532\u3002'), 'partial armor absorption must report both health and armor reductions')

const merchantRun = new GameRun({ autoLoad: false, random: () => 0.5 })
merchantRun.chooseInitialRelic(merchantRun.initialRelicChoices[0])
openMerchant(merchantRun, 'merchant')
merchantRun.player.gold = 20
const merchantItemsBefore = merchantRun.backpack.items.length
const merchantStockDefs = merchantRun.merchantEntity.stock.map((entry) => catalog.enemyLoot.find((item) => item.id === entry.itemId))
assert(merchantStockDefs.length === 4 && merchantStockDefs.every((item) => item?.dropOnly === true), 'merchant stock must contain only drop-only advanced items')
assert(new Set(merchantRun.merchantEntity.stock.map((entry) => entry.itemId)).size === merchantRun.merchantEntity.stock.length, 'merchant stock should not repeat an item')
assert(merchantRun.merchantEntity.stock.every((entry) => Number.isFinite(entry.price) && entry.price > 0), 'merchant stock prices must remain valid for enemy loot')
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
const ownedRelic = RELIC_DEFS.find((definition) => !merchantRun.relics.has(definition.id))
assert(ownedRelic && merchantRun.acquireRelic(ownedRelic.id)?.active, 'new relics must activate while capacity remains')
assert(merchantRun.deactivateRelic(ownedRelic.id) && merchantRun.relics.isActive(ownedRelic.id) && !merchantRun.isRelicLoadoutDraftActive(ownedRelic.id), 'relic deactivation must only alter the unconfirmed draft')
assert(merchantRun.activateRelic(ownedRelic.id) && merchantRun.relics.isActive(ownedRelic.id) && merchantRun.isRelicLoadoutDraftActive(ownedRelic.id), 'relic activation must only alter the unconfirmed draft')
const stagedRelic = RELIC_DEFS.find((definition) => !merchantRun.relics.has(definition.id))
assert(stagedRelic && merchantRun.acquireRelic(stagedRelic.id, { activate: false }), 'could not prepare an inactive relic for the loadout draft')
assert(merchantRun.activateRelic(stagedRelic.id) && !merchantRun.relics.isActive(stagedRelic.id) && merchantRun.isRelicLoadoutDraftActive(stagedRelic.id), 'an unconfirmed relic activation changed active gameplay effects')
assert(merchantRun.confirmRelicLoadout() && merchantRun.relics.isActive(stagedRelic.id), 'confirming the relic loadout did not commit the draft')
merchantRun.closeMerchant()
openMerchant(merchantRun, 'collector')
merchantRun.player.gold = 20
assert(merchantRun.canManageRelics(), 'collector did not enable relic management')
assert(merchantRun.merchantEntity.relicChoices.length === 3, 'collector did not offer three relic choices')
const offeredRelic = merchantRun.merchantEntity.relicChoices[0]
assert(merchantRun.chooseMerchantRelic(offeredRelic), 'collector relic choice was rejected')
assert(merchantRun.relics.has(offeredRelic) && merchantRun.relics.isActive(offeredRelic), 'collector relic choice should auto-activate below capacity')
assert(merchantRun.confirmRelicLoadout(), 'collector relic configuration could not be confirmed')
assert(!merchantRun.canManageRelics() && merchantRun.canSellAtMerchant(), 'confirmation did not lock only relic management')

const dualWeaponRun = new GameRun({ autoLoad: false, random: () => 0.5 })
dualWeaponRun.chooseInitialRelic(dualWeaponRun.initialRelicChoices[0])
const secondWeaponIndex = addToBackpack(dualWeaponRun, { ...dualWeaponRun.player.equipment[0], uid: 'dual-weapon-test' })
dualWeaponRun.selectInventory(secondWeaponIndex)
assert(dualWeaponRun.equipSelected(1), 'second weapon could not be equipped to the right hand')
assert(dualWeaponRun.player.equipment[0] && dualWeaponRun.player.equipment[1], 'both equipment slots should hold weapons')
dualWeaponRun.selectEquipmentSlot(1)
assert(dualWeaponRun.discardSelected(), 'selected equipped weapon could not be discarded')
assert(!dualWeaponRun.player.equipment[1], 'discard did not clear the selected equipment slot')
const unequipRun = new GameRun({ autoLoad: false, random: () => 0.5 })
unequipRun.chooseInitialRelic(unequipRun.initialRelicChoices[0])
const equippedWeapon = unequipRun.player.equipment[0]
const unequipTurn = unequipRun.turn
unequipRun.selectEquipmentSlot(0)
assert(unequipRun.unequipSelected() && !unequipRun.player.equipment[0] && unequipRun.backpack.items.some((item) => item.uid === equippedWeapon.uid) && unequipRun.turn === unequipTurn + 1, 'unequipping must return the weapon to the backpack and consume a turn')
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
dualAttackRun.relics.acquire('r-tide-heart', { activate: true })
dualAttackRun.relics.acquire('r-weapon-foundry', { activate: true })
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
assert(dualAttackRun.relicRuntime['r-tide-heart']?.attacks === 1 && dualAttackRun.relicRuntime['r-weapon-foundry']?.attacks === 1, 'a dual-wield attack action must count once for attack-count relics')

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
const alarmFlipBatches = []
trapRun.on('animate:flip-batch', ({ flips }) => alarmFlipBatches.push(flips))
trapRun._triggerTrap(alarmTrap)
assert(trapRoom.isRevealed(hiddenEnemy.pos), 'alarm trap did not reveal nearby hidden enemies')
assert(alarmFlipBatches.length === 1 && alarmFlipBatches[0].some((flip) => flip.position.c === hiddenEnemy.pos.c && flip.position.r === hiddenEnemy.pos.r), 'alarm trap did not reveal enemies through one flip batch')

const eventRun = new GameRun({ autoLoad: false, random: () => 0.5 })
eventRun.initialRelicChoices = []
eventRun.relics.acquire('r-tide-heart', { activate: true })
eventRun.player.hp = 10
eventRun._emitRelicEvent('attack:started')
assert(eventRun.player.hp === 10 && eventRun.relicRuntime['r-tide-heart']?.attacks === 1, 'tide-heart did not count the first attack action')
eventRun._emitRelicEvent('attack:started')
assert(eventRun.player.hp === 12 && eventRun.relicRuntime['r-tide-heart']?.attacks === 0 && eventRun.relicEventQueue.length === 0, 'tide-heart did not resolve after two attack actions')

const foundryRun = new GameRun({ autoLoad: false, random: () => 0.5 })
foundryRun.initialRelicChoices = []
foundryRun.relics.acquire('r-weapon-foundry', { activate: true })
const foundryItems = foundryRun.backpack.length
foundryRun._emitRelicEvent('attack:started')
foundryRun._emitRelicEvent('attack:started')
assert(foundryRun.backpack.length === foundryItems && foundryRun.relicRuntime['r-weapon-foundry']?.attacks === 2, 'weapon-foundry resolved before three attack actions')
foundryRun._emitRelicEvent('attack:started')
assert(foundryRun.backpack.length === foundryItems + 1 && foundryRun.relicRuntime['r-weapon-foundry']?.attacks === 0, 'weapon-foundry did not resolve after three attack actions')

const delayRun = new GameRun({ autoLoad: false, random: () => 0.5 })
delayRun.initialRelicChoices = []
delayRun.relics.acquire('r-delay-spark', { activate: true })
const delayedEnemy = [...delayRun.currentRoom.entities.values()].find((entity) => entity.kind === 'enemy')
const delayBeforeReveal = delayedEnemy.actionDelay
delayRun._revealTile(delayedEnemy.pos)
assert(delayedEnemy.actionDelay === delayBeforeReveal + 1, 'enemy reveal delay relic did not extend the enemy action delay')

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
assert(isAdjacent8(diagonalStart, diagonalGoal) && isAdjacent8(diagonalStart, pos(1, 0)), 'adjacent card targets were not recognized')
assert(!isAdjacent8(diagonalStart, diagonalStart) && !isAdjacent8(diagonalStart, pos(2, 0)), 'only eight-neighbor card targets may skip confirmation')
assert(findAttackPath(pathRoom, diagonalStart, { pos: diagonalGoal }, [{ range: 1 }])?.path.length === 0, 'melee must attack a diagonal target without moving')

const scorchBackRoom = new Room({ id: 'attribute-back-test', floor: 1, width: 1, height: 1, random: () => 0 })
const drownBackRoom = new Room({ id: 'attribute-back-test-two', floor: 1, width: 1, height: 1, random: () => 0.999 })
assert(scorchBackRoom.tile(pos(0, 0)).backAttribute === 'scorch' && drownBackRoom.tile(pos(0, 0)).backAttribute === 'drown', 'neutral cards did not retain generated random attribute backs')

const revealPathRoom = new Room({ id: 'weighted-reveal-test', floor: 1, width: 3, height: 4 })
const revealStart = pos(1, 3)
const revealTarget = pos(1, 1)
for (const revealed of [revealStart, pos(0, 2), pos(1, 2), pos(2, 2)]) revealPathRoom.reveal(revealed)
const weightedRevealPath = findRevealPath(revealPathRoom, revealStart, revealTarget)
assert(weightedRevealPath?.path.length === 1 && weightedRevealPath.path[0].c === 1 && weightedRevealPath.path[0].r === 2, 'straight approach must beat a diagonal approach by movement cost')

assert(typeof ENEMY_BEHAVIORS.stationary === 'function', 'stationary enemy behavior is not registered')
const enemyBehaviorTest = {
  behavior: 'stationary', actionDelay: 1, attack: 3, range: 2, pos: pos(0, 0),
  attackCooldown: 0, attackCooldownMax: 2,
  activeSkill: { id: 'test-skill', cooldown: 3 }, activeSkillCooldown: 0,
}
let enemyBehaviorAttacks = 0
let enemyBehaviorSkills = 0
const enemyBehaviorContext = {
  player: { pos: pos(1, 1) },
  attack: () => { enemyBehaviorAttacks += 1 },
  activeSkill: () => { enemyBehaviorSkills += 1; return { acted: true, reason: 'active-skill' } },
}
assert(stepEnemy(enemyBehaviorTest, enemyBehaviorContext).reason === 'action-delay', 'enemy action delay did not block its first turn')
assert(enemyBehaviorTest.actionDelay === 0 && enemyBehaviorAttacks === 0 && enemyBehaviorSkills === 0, 'enemy action delay advanced incorrectly')
assert(stepEnemy(enemyBehaviorTest, enemyBehaviorContext).reason === 'active-skill', 'ready active skill did not take priority over normal attack')
assert(enemyBehaviorSkills === 1 && enemyBehaviorAttacks === 0 && enemyBehaviorTest.activeSkillCooldown === 2, 'active skill cooldown was not initialized independently')
assert(stepEnemy(enemyBehaviorTest, enemyBehaviorContext).reason === 'attack', 'normal attack did not act while the active skill was cooling down')
assert(enemyBehaviorAttacks === 1 && enemyBehaviorTest.attackCooldown === 1 && enemyBehaviorTest.activeSkillCooldown === 1, 'normal attack and active skill cooldowns did not tick independently')
const everyTurnEnemy = { behavior: 'stationary', actionDelay: 0, attack: 3, range: 1, pos: pos(0, 0), attackCooldown: 0, attackCooldownMax: 1 }
let everyTurnAttacks = 0
const everyTurnContext = { player: { pos: pos(1, 0) }, attack: () => { everyTurnAttacks += 1 } }
assert(stepEnemy(everyTurnEnemy, everyTurnContext).reason === 'attack' && everyTurnEnemy.attackCooldown === 0, 'cooldown 1 should leave no skipped enemy turns')
assert(stepEnemy(everyTurnEnemy, everyTurnContext).reason === 'attack' && everyTurnAttacks === 2, 'cooldown 1 enemy did not attack every turn')
const alternatingEnemy = { behavior: 'stationary', actionDelay: 0, attack: 3, range: 1, pos: pos(0, 0), attackCooldown: 0, attackCooldownMax: 2 }
let alternatingAttacks = 0
const alternatingContext = { player: { pos: pos(1, 0) }, attack: () => { alternatingAttacks += 1 } }
assert(stepEnemy(alternatingEnemy, alternatingContext).reason === 'attack' && alternatingEnemy.attackCooldown === 1, 'cooldown 2 did not initialize one skipped enemy turn')
assert(stepEnemy(alternatingEnemy, alternatingContext).reason === 'idle' && alternatingEnemy.attackCooldown === 0 && alternatingAttacks === 1, 'cooldown 2 did not skip exactly one enemy turn')
assert(stepEnemy(alternatingEnemy, alternatingContext).reason === 'attack' && alternatingAttacks === 2, 'cooldown 2 enemy did not resume after one skipped turn')
const everyTurnSkillEnemy = { behavior: 'stationary', actionDelay: 0, attack: 0, range: 0, pos: pos(0, 0), activeSkill: { id: 'test-skill', cooldown: 1 }, activeSkillCooldown: 0 }
let everyTurnSkills = 0
const everyTurnSkillContext = { player: { pos: pos(1, 0) }, activeSkill: () => { everyTurnSkills += 1; return { acted: true, reason: 'active-skill' } } }
assert(stepEnemy(everyTurnSkillEnemy, everyTurnSkillContext).reason === 'active-skill' && everyTurnSkillEnemy.activeSkillCooldown === 0, 'active skill cooldown 1 should leave no skipped enemy turns')
assert(stepEnemy(everyTurnSkillEnemy, everyTurnSkillContext).reason === 'active-skill' && everyTurnSkills === 2, 'active skill cooldown 1 did not act every turn')
const outOfRangeEnemy = { behavior: 'stationary', actionDelay: 0, attack: 3, range: 2, attackCooldown: 0, pos: pos(0, 0) }
assert(stepEnemy(outOfRangeEnemy, { player: { pos: pos(3, 0) }, attack: () => { enemyBehaviorAttacks += 1 } }).reason === 'idle', 'enemy range check is invalid')
assert(enemyBehaviorAttacks === 1, 'out-of-range enemy attacked')
assert(stepEnemy({ ...outOfRangeEnemy, behavior: 'future-behavior', attackCooldown: 0 }, { player: { pos: pos(1, 0) }, attack: () => { enemyBehaviorAttacks += 1 } }).reason === 'attack', 'unknown enemy behavior did not safely fall back')
assert(enemyBehaviorAttacks === 2, 'in-range enemy did not attack exactly once')
assert(typeof ENEMY_BEHAVIORS.chaser === 'function' && typeof ENEMY_BEHAVIORS.ambush === 'function' && !ENEMY_BEHAVIORS.patrol && !ENEMY_BEHAVIORS.summoner && !ENEMY_BEHAVIORS['self-destruct'], 'enemy movement behaviors were not normalized')

const behaviorRoom = new Room({ id: 'new-enemy-behavior-test', floor: 4, width: 6, height: 2 })
for (let r = 0; r < behaviorRoom.height; r++) for (let c = 0; c < behaviorRoom.width; c++) behaviorRoom.reveal(pos(c, r))
const chaser = createEnemyById('rot-walker', pos(5, 0))
behaviorRoom.addEntity(chaser)
chaser.actionDelay = 0
assert(stepEnemy(chaser, { room: behaviorRoom, player: { pos: pos(0, 0) }, move: (actor, position) => behaviorRoom.moveEntity(actor.id, position), attack: () => { throw new Error('chaser attacked while out of range') } }).reason === 'move' && chaser.pos.c === 4, 'chaser did not advance one cell toward the player')
const pursuingEnemy = createEnemyById('rot-walker', pos(2, 1))
pursuingEnemy.actionDelay = 0
behaviorRoom.addEntity(pursuingEnemy)
let pursuitAttacks = 0
const pursuitResult = stepEnemy(pursuingEnemy, {
  room: behaviorRoom,
  player: { pos: pos(0, 1) },
  move: (actor, position) => behaviorRoom.moveEntity(actor.id, position),
  attack: () => { pursuitAttacks += 1 },
})
assert(pursuitResult.reason === 'attack' && pursuitResult.moved && pursuingEnemy.pos.c === 1 && pursuitAttacks === 1, 'chaser did not move into range and attack in the same turn')

function clearedEnemyRun(random = () => 0.5) {
  const testRun = new GameRun({ autoLoad: false, random })
  testRun.initialRelicChoices = []
  const room = testRun.currentRoom
  for (const id of [...room.entities.keys()]) room.removeEntity(id)
  for (let r = 0; r < room.height; r++) for (let c = 0; c < room.width; c++) room.reveal(pos(c, r))
  testRun.player.pos = pos(0, 0)
  return { testRun, room }
}

const { testRun: progressionRun, room: progressionRoom } = clearedEnemyRun(() => 0.5)
progressionRun.player.experience = progressionRun.player.experienceToNext - 2
const progressionEnemy = createEnemyById('gnawer', pos(3, 0))
progressionRoom.addEntity(progressionEnemy)
assert(progressionRun._defeatEnemy(progressionEnemy) && progressionRun.phase === 'level-up' && progressionRun.levelUp?.choices.length === 3, 'natural enemy experience did not create a three-choice level-up')
const growthChoice = progressionRun.levelUp.choices[0]
assert(progressionRun.chooseLevelUpOption(growthChoice), 'level-up choice was rejected')
if (progressionRun.levelUp?.adaptationHand != null) assert(progressionRun.chooseAdaptation('scorch'), 'attribute adaptation follow-up was rejected')
assert(progressionRun.player.level === 2 && progressionRun.player.experience === 0 && progressionRun.player.experienceToNext === experienceToNextLevel(2), 'level-up did not advance the progression state')

const { testRun: bareHandRun, room: bareHandRoom } = clearedEnemyRun()
bareHandRun.player.equipment = [null, null]
const bareHandEnemy = createEnemyById('gnawer', pos(1, 0))
bareHandRoom.addEntity(bareHandEnemy)
const bareHandHp = bareHandEnemy.hp
assert(bareHandRun.clickTile(1, 0) && bareHandEnemy.hp === bareHandHp - 1, 'unarmed attack must deal exactly one damage')

const { testRun: masteryRun, room: masteryRoom } = clearedEnemyRun(() => 0.4)
masteryRun.player.mastery[0] = 10
masteryRun.player.strength[0] = 2
masteryRun.player.equipment[0].durability = 1
const masteryEnemy = createEnemyById('gnawer', pos(1, 0))
masteryEnemy.hp = 99
masteryEnemy.maxHp = 99
masteryRoom.addEntity(masteryEnemy)
const masteryHp = masteryEnemy.hp
assert(masteryRun.clickTile(1, 0) && masteryRun.player.equipment[0].durability === 1 && masteryEnemy.hp === masteryHp - 6, 'mastery did not preserve durability and cancel the last-durability penalty')

const authoredDrops = {
  gnawer: [0.25, 'rough-bone-club'], 'nest-spider': [0.35, 'venom-sac'], 'beetle-guard': [0.35, 'shell-fragment'], 'rot-walker': [0.2, 'rusty-dagger'],
  wisp: [0.6, 'spectral-short-spear'], shellguard: [0.6, 'notched-war-hammer'], 'patrol-hound': [0.25, 'beast-fang'], broodmother: [0.4, 'worm-glue'],
  'moss-colossus': [0.45, 'moss-ointment'], 'sentry-crossbow': [0.6, 'worn-shortbow'], 'revenant-guard': [0.5, 'tombguard-shortsword'],
  'bone-priest': [0.5, 'bone-grinding-powder'], 'cracked-hunter': [0.5, 'cracked-armor-hookblade'],
}
for (const [enemyId, [chance, itemId]] of Object.entries(authoredDrops)) {
  const drop = catalog.enemies.find((enemy) => enemy.id === enemyId)?.drop
  assert(drop?.itemId === itemId && drop.chance === chance, `${enemyId} drop is not the authored static rule`)
}
assert(!catalog.enemies.find((enemy) => enemy.id === 'bomb-wisp')?.drop && !catalog.boss.drop, 'enemies without authored drops must not use a generic drop table')
assert(catalog.enemyLoot.every((item) => item.dropOnly), 'enemy loot must not enter generic item generation')

const { testRun: guaranteedDropRun, room: guaranteedDropRoom } = clearedEnemyRun(() => 0)
const guaranteedDropEnemy = createEnemyById('gnawer', pos(3, 0))
guaranteedDropRoom.addEntity(guaranteedDropEnemy)
assert(guaranteedDropRun._defeatEnemy(guaranteedDropEnemy), 'authored enemy drop kill was rejected')
const guaranteedDrop = guaranteedDropRoom.entityAt(pos(3, 0))
assert(guaranteedDrop?.kind === 'item' && guaranteedDrop.item.id === 'rough-bone-club' && guaranteedDrop.item.durability === 1 && !guaranteedDrop.item.temporary, 'gnawer did not leave its authored rough bone club')
assert(guaranteedDropRun.relics.entries.length === 1, 'relic drops must resolve independently from normal enemy loot')

const { testRun: missedDropRun, room: missedDropRoom } = clearedEnemyRun(() => 0.999)
const missedDropEnemy = createEnemyById('gnawer', pos(3, 0))
missedDropRoom.addEntity(missedDropEnemy)
missedDropRun._defeatEnemy(missedDropEnemy)
assert(!missedDropRoom.entityAt(pos(3, 0)), 'enemy drop chance was ignored')

const lowHammer = makeItemById('notched-war-hammer', () => 0)
const highHammer = makeItemById('notched-war-hammer', () => 0.999)
assert(lowHammer?.durability === 1 && highHammer?.durability === 2, 'variable weapon durability did not stay within its authored range')

const { testRun: ambushRun, room: ambushRoom } = clearedEnemyRun()
const spider = createEnemyById('nest-spider', pos(2, 0))
const secondSpider = createEnemyById('nest-spider', pos(2, 1))
ambushRoom.addEntity(spider)
ambushRoom.addEntity(secondSpider)
ambushRoom.tile(spider.pos).revealed = false
ambushRoom.tile(secondSpider.pos).revealed = false
const ambushFlipBatches = []
ambushRun.on('animate:flip-batch', ({ flips }) => ambushFlipBatches.push(flips))
assert(!ambushRun._walk([pos(1, 0)]).stopped && ambushRoom.isRevealed(spider.pos) && ambushRoom.isRevealed(secondSpider.pos) && ambushRun.player.hp === 10 && spider.attackCooldown === 1 && secondSpider.attackCooldown === 1, 'ambush enemies did not reveal and attack immediately when the player entered nearby')
assert(ambushFlipBatches.length === 1 && ambushFlipBatches[0].length === 2, 'ambush enemies did not use one simultaneous flip batch')

const { testRun: alertRun, room: alertRoom } = clearedEnemyRun()
const alertSource = createEnemyById('gnawer', pos(2, 2))
const alertTarget = createEnemyById('rot-walker', pos(3, 2))
const chainedAlertTarget = createEnemyById('wisp', pos(5, 5))
alertRoom.addEntity(alertSource)
alertRoom.addEntity(alertTarget)
alertRoom.addEntity(chainedAlertTarget)
for (const enemy of [alertSource, alertTarget, chainedAlertTarget]) alertRoom.tile(enemy.pos).revealed = false
assert(alertRun._revealTile(alertSource.pos) && alertRoom.isRevealed(alertSource.pos) && alertRoom.isRevealed(alertTarget.pos), 'alert enemy did not reveal the nearest hidden enemy')
assert(alertSource.alertTriggered && !alertTarget.alertTriggered && !alertRoom.isRevealed(chainedAlertTarget.pos), 'alert reveal incorrectly chained through the awakened enemy')

const { testRun: distantAmbushRun, room: distantAmbushRoom } = clearedEnemyRun()
const distantSpider = createEnemyById('nest-spider', pos(3, 0))
distantSpider.range = 2
distantAmbushRoom.addEntity(distantSpider)
distantAmbushRoom.tile(distantSpider.pos).revealed = false
assert(!distantAmbushRun._walk([pos(1, 0)]).stopped && !distantAmbushRoom.isRevealed(distantSpider.pos), 'ambush must use the protagonist 8-neighborhood instead of enemy range')

const { testRun: shieldRun, room: shieldRoom } = clearedEnemyRun()
const shielded = createEnemyById('beetle-guard', pos(3, 0))
shieldRoom.addEntity(shielded)
assert(shieldRun._damageEnemy(shielded, 99).damage === 3 && shielded.hp === 3 && shielded.shieldConsumed, 'shield trait did not cap the first hit at half maximum health')
assert(shieldRun._damageEnemy(shielded, 99).defeated && !shieldRoom.entity(shielded.id), 'shield trait incorrectly prevented a later lethal hit')

const { testRun: splitRun, room: splitRoom } = clearedEnemyRun()
const splitter = createEnemyById('broodmother', pos(3, 0))
splitRoom.addEntity(splitter)
splitRun._enemyAttack(splitter)
const broodling = [...splitRoom.entities.values()].find((entity) => entity.enemyId === 'broodling')
assert(broodling?.noLoot && splitRun.player.hp === 15, 'split trait did not create a no-loot minion after the first attack')
splitRun.random = () => 0
splitRun._defeatEnemy(broodling)
assert(!splitRoom.entityAt(broodling.pos), 'summoned or split minions must not leave loot')

const { testRun: summonRun, room: summonRoom } = clearedEnemyRun()
const priest = createEnemyById('bone-priest', pos(3, 0))
summonRoom.addEntity(priest)
const enemyActionContext = (testRun, room) => ({
  room,
  player: testRun.player,
  attack: (actor) => testRun._enemyAttack(actor),
  move: (actor, position) => testRun._moveEnemy(actor, position),
  activeSkill: (actor, skill) => testRun._useEnemyActiveSkill(actor, skill),
})
assert(stepEnemy(priest, enemyActionContext(summonRun, summonRoom)).reason === 'action-delay', 'summoner active skill ignored its action delay')
assert(![...summonRoom.entities.values()].some((entity) => entity.enemyId === 'skeleton-minion'), 'summoner acted on its reveal turn')
assert(stepEnemy(priest, enemyActionContext(summonRun, summonRoom)).reason === 'summon', 'summoner did not use its active skill after the action delay')
assert([...summonRoom.entities.values()].some((entity) => entity.enemyId === 'skeleton-minion') && priest.activeSkillCooldown === 2, 'summoner active skill did not create its authored minion or enter cooldown')

const { testRun: reviveRun, room: reviveRoom } = clearedEnemyRun()
const revenant = createEnemyById('revenant-guard', pos(5, 0))
reviveRoom.addEntity(revenant)
assert(!reviveRun._damageEnemy(revenant, 99).defeated && revenant.downed && revenant.hp === 0, 'revive enemy did not enter its fake-death state')
reviveRun._endTurn()
reviveRun._endTurn()
assert(!revenant.downed && revenant.hp === revenant.maxHp, 'revive enemy did not return at full health after two turns')

const { testRun: detonationRun, room: detonationRoom } = clearedEnemyRun()
const bombWisp = createEnemyById('bomb-wisp', pos(2, 0))
detonationRoom.addEntity(bombWisp)
assert(stepEnemy(bombWisp, enemyActionContext(detonationRun, detonationRoom)).reason === 'action-delay', 'self-destruct enemy ignored its first delay turn')
assert(stepEnemy(bombWisp, enemyActionContext(detonationRun, detonationRoom)).reason === 'action-delay', 'self-destruct enemy ignored its second delay turn')
assert(stepEnemy(bombWisp, enemyActionContext(detonationRun, detonationRoom)).reason === 'action-delay', 'self-destruct enemy ignored its third delay turn')
assert(detonationRun.player.hp === 20 && detonationRoom.entity(bombWisp.id), 'self-destruct enemy acted before its configured delay elapsed')
assert(stepEnemy(bombWisp, enemyActionContext(detonationRun, detonationRoom)).reason === 'self-destruct' && detonationRun.player.hp === 8 && !detonationRoom.entity(bombWisp.id), 'self-destruct enemy did not use its active skill after its delay')

const { testRun: distantDetonationRun, room: distantDetonationRoom } = clearedEnemyRun()
const distantBombWisp = createEnemyById('bomb-wisp', pos(4, 0))
distantBombWisp.actionDelay = 0
distantDetonationRoom.addEntity(distantBombWisp)
assert(stepEnemy(distantBombWisp, enemyActionContext(distantDetonationRun, distantDetonationRoom)).reason === 'idle' && distantDetonationRun.player.hp === 20 && distantDetonationRoom.entity(distantBombWisp.id), 'self-destruct active skill detonated outside its explosion range')

const relicCapacity = new RelicCollection()
for (const definition of RELIC_DEFS.slice(0, 6)) relicCapacity.acquire(definition.id)
for (const definition of RELIC_DEFS.slice(0, 5)) assert(relicCapacity.activate(definition.id), 'relic activation before capacity was rejected')
assert(!relicCapacity.activate(RELIC_DEFS[5].id) && relicCapacity.active.length === 5, 'relic activation exceeded the five-slot limit')

const scorchWeapon = { name: 'test', attack: 5, attribute: 'scorch', durability: 3 }
const witherTarget = { attribute: 'wither' }
assert(attributeModifier('scorch', 'wither').countered && attributeModifier('wither', 'drown').countered && attributeModifier('drown', 'scorch').countered, 'attribute counter cycle is invalid')
assert(attributeModifier('scorch', 'wither', { adapted: true }).multiplier === 1.8 && attributeModifier('scorch', 'drown', { adapted: true }).multiplier === 0.8, 'attribute adaptation did not replace the normal multipliers')
assert(computeAttackDamage({ weapon: scorchWeapon, target: witherTarget }).damage === 8, 'attribute counter damage multiplier is invalid')
assert(computeAttackDamage({ weapon: { ...scorchWeapon, durability: 1 }, target: witherTarget }).damage === 4, 'last durability penalty is invalid')
assert(computeAttackDamage({ weapon: { ...scorchWeapon, durability: 1 }, target: witherTarget, strengthBonus: 2, ignoreLastDurability: true }).damage === 11, 'strength or preserved durability did not apply before attribute resolution')
assert(computeAttackDamage({ weapon: scorchWeapon, target: { attribute: 'drown' } }).damage === 3, 'attribute resistance multiplier is invalid')
assert(masteryPreservationChance(0) === 0 && masteryPreservationChance(10) === 0.5, 'weapon mastery probability does not follow its authored formula')

const relicRun = new GameRun({ autoLoad: false, random: () => 0.5 })
relicRun.initialRelicChoices = ['r-opportunity-strike']
assert(relicRun.chooseInitialRelic('r-opportunity-strike')?.active, 'initial relic acquisition did not activate')
assert(relicRun.acquireRelic('r-empty-core')?.active, 'later relic acquisition must auto-activate below capacity')
assert(relicRun.relics.deactivate('r-empty-core'), 'test setup could not isolate the cooldown relic')
const damagedWeapon = { ...scorchWeapon, durability: 3 }
const cooldownTarget = { ...witherTarget, id: 'cooldown-target', attackCooldown: 1, activeSkill: { id: 'test', cooldown: 3 }, activeSkillCooldown: 1 }
const type = attackAttributeModifier(damagedWeapon, cooldownTarget)
const relicModifiers = relicRun.relicEngine.damageModifiers({
  run: relicRun,
  weapon: damagedWeapon,
  target: cooldownTarget,
  player: relicRun.player,
  countered: type.countered,
  resisted: type.resisted,
})
assert(computeAttackDamage({ weapon: damagedWeapon, target: cooldownTarget, relicModifiers }).damage === 16, 'relic damage modifier is not applied')
assert(buildRelicChoices(relicRun.relics, { random: () => 0 }).every((relic) => relic.id !== 'r-opportunity-strike'), 'owned relic returned as a choice')

const relicDamageWeapon = { name: 'test', attack: 4, attribute: 'wither', durability: 2 }
const neutralRelicTarget = { attribute: 'wither', hp: 10, maxHp: 10 }
const berserkerRun = new GameRun({ autoLoad: false, random: () => 0.5 })
berserkerRun.initialRelicChoices = []
assert(berserkerRun.acquireRelic('r-berserker-oath')?.active, 'berserker relic could not activate')
berserkerRun.player.maxHp = 50
berserkerRun.player.hp = 45
assert(computeAttackDamage({ weapon: relicDamageWeapon, target: neutralRelicTarget, relicModifiers: berserkerRun.relicEngine.damageModifiers({ player: berserkerRun.player }) }).damage === 6, 'berserker relic did not gain 0.5 multiplier per five missing health')
berserkerRun.player.hp = 10
assert(computeAttackDamage({ weapon: relicDamageWeapon, target: neutralRelicTarget, relicModifiers: berserkerRun.relicEngine.damageModifiers({ player: berserkerRun.player }) }).damage === 20, 'berserker relic did not cap at five times damage')

const noMercyRun = new GameRun({ autoLoad: false, random: () => 0.5 })
noMercyRun.initialRelicChoices = []
assert(noMercyRun.acquireRelic('r-no-mercy')?.active, 'no-mercy relic could not activate')
const woundedRelicTarget = { ...neutralRelicTarget, hp: 5 }
assert(computeAttackDamage({ weapon: relicDamageWeapon, target: woundedRelicTarget, relicModifiers: noMercyRun.relicEngine.damageModifiers({ target: woundedRelicTarget }) }).damage === 6, 'no-mercy relic did not apply at half health')
const healthyRelicTarget = { ...neutralRelicTarget, hp: 6 }
assert(computeAttackDamage({ weapon: relicDamageWeapon, target: healthyRelicTarget, relicModifiers: noMercyRun.relicEngine.damageModifiers({ target: healthyRelicTarget }) }).damage === 4, 'no-mercy relic applied above half health')

const { testRun: unarmedBuffRun, room: unarmedBuffRoom } = clearedEnemyRun()
const unarmedBuffTarget = createEnemyById('gnawer', pos(1, 0))
unarmedBuffTarget.hp = unarmedBuffTarget.maxHp = 20
unarmedBuffRoom.addEntity(unarmedBuffTarget)
unarmedBuffRun.player.equipment = [null, null]
const unarmedCharmIndex = addToBackpack(unarmedBuffRun, makeItemById('battle-charm'))
assert(unarmedBuffRun.selectInventory(unarmedCharmIndex) && unarmedBuffRun.useSelected(), 'battle charm could not be used for the unarmed attack test')
assert(unarmedBuffRun.clickTile(unarmedBuffTarget.pos.c, unarmedBuffTarget.pos.r) && unarmedBuffTarget.hp === unarmedBuffTarget.maxHp - 5 && unarmedBuffRun.player.pendingAttackBuffs.length === 0, 'generic attack buff did not apply to and get consumed by an unarmed attack')

const { testRun: remoteFlipRun, room: remoteFlipRoom } = clearedEnemyRun()
const remoteTarget = pos(2, 0)
for (const hidden of [pos(1, 0), pos(1, 1), pos(2, 1), pos(3, 0), pos(3, 1), remoteTarget]) remoteFlipRoom.tile(hidden).revealed = false
assert(remoteFlipRun.acquireRelic('r-long-flip')?.active, 'remote-flip relic could not activate')
assert(remoteFlipRun.previewTileAction(remoteTarget.c, remoteTarget.r)?.kind === 'flip', 'two-cell remote flip did not produce a preview')
assert(remoteFlipRun.clickTile(remoteTarget.c, remoteTarget.r) && remoteFlipRoom.isRevealed(remoteTarget) && remoteFlipRun.player.pos.c === 0, 'two-cell remote flip did not reveal without movement')

const { testRun: ricochetRun, room: ricochetRoom } = clearedEnemyRun()
const ricochetPrimary = createEnemyById('gnawer', pos(1, 0))
const ricochetNear = createEnemyById('gnawer', pos(2, 0))
ricochetPrimary.hp = ricochetPrimary.maxHp = 99
ricochetNear.hp = ricochetNear.maxHp = 99
ricochetRoom.addEntity(ricochetPrimary)
ricochetRoom.addEntity(ricochetNear)
assert(ricochetRun.acquireRelic('r-backline-ricochet')?.active, 'ricochet relic could not activate')
ricochetRoom.tile(ricochetNear.pos).revealed = false
const nearBacklineHp = ricochetNear.hp
assert(ricochetRun.clickTile(ricochetPrimary.pos.c, ricochetPrimary.pos.r) && ricochetRoom.isRevealed(ricochetNear.pos) && ricochetNear.hp === nearBacklineHp, 'ricochet damaged a hidden card instead of revealing it first')
assert(ricochetRun.clickTile(ricochetPrimary.pos.c, ricochetPrimary.pos.r) && ricochetNear.hp < nearBacklineHp, 'ricochet did not damage the revealed enemy one card behind the target')

const { testRun: diagonalRicochetRun, room: diagonalRicochetRoom } = clearedEnemyRun()
const diagonalPrimary = createEnemyById('gnawer', pos(1, 1))
const diagonalBackline = createEnemyById('gnawer', pos(2, 2))
diagonalPrimary.hp = diagonalPrimary.maxHp = 99
diagonalBackline.hp = diagonalBackline.maxHp = 99
diagonalRicochetRoom.addEntity(diagonalPrimary)
diagonalRicochetRoom.addEntity(diagonalBackline)
assert(diagonalRicochetRun.acquireRelic('r-backline-ricochet')?.active, 'diagonal ricochet relic could not activate')
const diagonalBacklineHp = diagonalBackline.hp
assert(diagonalRicochetRun.clickTile(diagonalPrimary.pos.c, diagonalPrimary.pos.r) && diagonalBackline.hp < diagonalBacklineHp, 'ricochet did not follow the diagonal direction behind the target')

const { testRun: sideGlanceRun, room: sideGlanceRoom } = clearedEnemyRun(() => 0)
const glanceTarget = pos(1, 1)
const glanceNeighbor = pos(2, 1)
sideGlanceRoom.tile(glanceTarget).revealed = false
sideGlanceRoom.tile(glanceNeighbor).revealed = false
assert(sideGlanceRun.acquireRelic('r-side-glance')?.active, 'side-glance relic could not activate')
assert(sideGlanceRun.clickTile(glanceTarget.c, glanceTarget.r) && sideGlanceRoom.tile(glanceNeighbor).peeked, 'side glance did not mark one adjacent hidden card as peeked')

const { testRun: healerForgeRun } = clearedEnemyRun(() => 0)
const forgeWeapon = healerForgeRun.equippedWeapons[0]
healerForgeRun.player.hp = healerForgeRun.player.maxHp - 2
const forgeAttack = forgeWeapon.attack
assert(healerForgeRun.acquireRelic('r-healer-forge')?.active, 'healer-forge relic could not activate')
assert(healerForgeRun._healPlayer(1) === 1 && forgeWeapon.attack === forgeAttack + 1, 'healing did not improve a random equipped weapon')

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
  persistenceRun.player.level = 3
  persistenceRun.player.experience = 4
  persistenceRun.player.experienceToNext = experienceToNextLevel(3)
  persistenceRun.player.strength = [2, 1]
  persistenceRun.player.mastery = [3, 0]
  persistenceRun.player.adaptations = ['scorch', null]
  persistenceRun.roomRewardBag = ['relic', 'supply']
  const persistedTwoHanded = makeItemById('spear')
  persistenceRun.player.equipment = [persistedTwoHanded, persistedTwoHanded]
  const persistedEdge = [...persistenceRun.dungeon.edges.values()].find((edge) => edge.locked)
  persistedEdge.unlocked = true
  openMerchant(persistenceRun, 'merchant')
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
  assert(restoredRun.player.level === 3 && restoredRun.player.strength[0] === 2 && restoredRun.player.mastery[0] === 3 && restoredRun.player.adaptations[0] === 'scorch' && restoredRun.roomRewardBag.join(',') === 'relic,supply', 'progression or reward-bag state did not persist')
  assert(restoredRun.player.equipment[0] === restoredRun.player.equipment[1] && restoredRun.equippedWeapons.length === 1, 'two-handed equipment did not restore as one shared weapon')
  assert(restoredRun.phase === 'merchant' && restoredRun.merchantEntity?.merchantId === 'merchant', 'open merchant state did not restore')
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
