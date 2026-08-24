import { enemyDefinitionFor } from './enemies.js'
import catalog from './catalog.json' with { type: 'json' }

const WEAPONS = Object.freeze(catalog.weapons)
const CONSUMABLES = Object.freeze(catalog.consumables)
const BOSS = Object.freeze(catalog.boss)
const ALL_ITEM_DEFS = Object.freeze([...WEAPONS, ...CONSUMABLES])
const ITEM_BY_ID = new Map(ALL_ITEM_DEFS.map((definition) => [definition.id, definition]))

let serial = 0

function cloneShape(shape) { return Array.isArray(shape) ? shape.map((row) => Array.isArray(row) ? [...row] : []) : [[1]] }

export function nextEntityId(prefix = 'entity') {
  serial += 1
  return `${prefix}-${serial}`
}

export function resetEntityIds() { serial = 0 }

export function synchronizeEntityIds(identifiers) {
  let highest = serial
  for (const identifier of identifiers) {
    const match = typeof identifier === 'string' && identifier.match(/-(\d+)$/)
    if (match) highest = Math.max(highest, Number(match[1]))
  }
  serial = highest
}

export function starterWeapon() { return makeItem(WEAPONS[0]) }

export function makeItem(definition) {
  const item = { ...definition, shape: cloneShape(definition.shape), uid: nextEntityId('item') }
  if (item.type === 'weapon') item.durability = item.durability || definition.durability
  return item
}

export function getItemDefinition(id) { return ITEM_BY_ID.get(id) || null }

export function makeItemById(id) {
  const definition = getItemDefinition(id)
  return definition ? makeItem(definition) : null
}

export function makeTemporaryWeapon(floor, random = Math.random) {
  const candidates = WEAPONS.filter((weapon) => weapon.id !== 'rust-sword' || floor === 1)
  const definition = candidates[Math.floor(random() * candidates.length)] || WEAPONS[0]
  const item = makeItem(definition)
  item.name = `${item.name}\u00b7\u4e34\u65f6`
  item.attack += 2 + Math.floor(floor / 2)
  item.durability = 1
  item.temporary = true
  return item
}

export function randomItem(floor, random = Math.random) {
  const weaponPool = WEAPONS.filter((weapon) => floor <= 2 || weapon.id !== 'rust-sword')
  const consumablePool = CONSUMABLES.filter((item) => floor >= (item.minFloor || 1))
  if (random() < 0.42) return makeItem(weaponPool[Math.floor(random() * weaponPool.length)])
  return makeItem(consumablePool[Math.floor(random() * consumablePool.length)])
}

export function createMonster(floor, index = 0) {
  const definition = enemyDefinitionFor(floor, index)
  const level = floor - 1
  const hp = definition.hpBase + definition.hpPerFloor * level
  return {
    id: nextEntityId('enemy'),
    kind: 'enemy',
    enemyId: definition.id,
    name: definition.name,
    category: definition.category,
    behavior: definition.behavior,
    pos: null,
    hp,
    maxHp: hp,
    attack: definition.attackBase + definition.attackPerFloor * level,
    range: definition.range,
    cooldownMax: definition.cooldownMax,
    initialActionDelay: definition.initialActionDelay,
    cooldown: definition.initialActionDelay,
    revealOrder: null,
  }
}

export function createBoss(position) {
  return {
    id: nextEntityId('boss'),
    kind: 'enemy',
    boss: true,
    name: BOSS.name,
    category: BOSS.category,
    behavior: BOSS.behavior,
    pos: { ...position },
    hp: BOSS.hp,
    maxHp: BOSS.hp,
    attack: BOSS.attack,
    range: BOSS.range,
    cooldownMax: BOSS.cooldownMax,
    initialActionDelay: BOSS.initialActionDelay,
    cooldown: BOSS.initialActionDelay,
    revealOrder: null,
  }
}

export function createLootEntity(item, position) {
  return { id: nextEntityId(item.type), kind: 'item', pos: { ...position }, item }
}

export function createGoldEntity(amount, position) {
  return { id: nextEntityId('gold'), kind: 'gold', pos: { ...position }, amount }
}

export function createKeyEntity(edgeId, position) {
  return { id: nextEntityId('key'), kind: 'key', pos: { ...position }, edgeId }
}
