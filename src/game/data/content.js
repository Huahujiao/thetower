import { enemyDefinitionFor, getEnemyDefinition } from './enemies.js'
import catalog from './catalog.json' with { type: 'json' }

const WEAPONS = Object.freeze(catalog.weapons)
const CONSUMABLES = Object.freeze(catalog.consumables)
const ENEMY_LOOT = Object.freeze(catalog.enemyLoot || [])
const MERCHANT_WEAPONS = Object.freeze(catalog.merchantWeapons || [])
const BOSS = Object.freeze(catalog.boss)
const ALL_ITEM_DEFS = Object.freeze([...WEAPONS, ...CONSUMABLES, ...ENEMY_LOOT, ...MERCHANT_WEAPONS])
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

export function makeItem(definition, random = Math.random) {
  const item = { ...definition, shape: cloneShape(definition.shape), uid: nextEntityId('item') }
  if (item.type === 'weapon') {
    const [minimum, maximum] = definition.durabilityRange || [definition.durability, definition.durability]
    item.durability = Number.isInteger(minimum) && Number.isInteger(maximum)
      ? minimum + Math.floor(random() * (maximum - minimum + 1))
      : definition.durability || 1
    item.maxDurability = item.durability
  }
  return item
}

export function getItemDefinition(id) { return ITEM_BY_ID.get(id) || null }

export function makeItemById(id, random = Math.random) {
  const definition = getItemDefinition(id)
  return definition ? makeItem(definition, random) : null
}

export function randomItem(floor, random = Math.random) {
  const weaponPool = WEAPONS.filter((weapon) => floor <= 2 || weapon.id !== 'rust-sword')
  const consumablePool = CONSUMABLES.filter((item) => floor >= (item.minFloor || 1))
  if (random() < 0.42) return makeItem(weaponPool[Math.floor(random() * weaponPool.length)])
  return makeItem(consumablePool[Math.floor(random() * consumablePool.length)])
}

export function randomWeapon(floor, random = Math.random) {
  const weaponPool = WEAPONS.filter((weapon) => floor <= 2 || weapon.id !== 'rust-sword')
  return makeItem(weaponPool[Math.floor(random() * weaponPool.length)], random)
}

function createEnemy(definition, { position = null, boss = false } = {}) {
  if (!definition) return null
  return {
    id: nextEntityId(boss ? 'boss' : 'enemy'),
    kind: 'enemy',
    enemyId: definition.id,
    name: definition.name,
    attribute: definition.attribute,
    behavior: definition.behavior,
    traits: [...(definition.traits || [])],
    deathRule: definition.deathRule || null,
    splitMinionId: definition.splitMinionId || null,
    drop: definition.drop ? { ...definition.drop } : null,
    experience: Math.max(0, Number(definition.experience) || 0),
    relicDropChance: Math.max(0, Number(definition.relicDropChance) || 0),
    elite: definition.elite === true,
    regen: definition.regen || 0,
    explosionRadius: definition.explosionRadius || 0,
    deathExplosionDamage: definition.deathExplosionDamage || 0,
    noLoot: definition.noLoot === true,
    noExperience: definition.spawnOnly === true,
    boss,
    pos: position ? { ...position } : null,
    hp: definition.hp,
    maxHp: definition.hp,
    attack: definition.attack,
    range: definition.range,
    attackCooldownMax: Math.max(1, Number(definition.attackCooldownMax ?? definition.cooldownMax) || 0),
    initialActionDelay: definition.initialActionDelay,
    actionDelay: Math.max(0, Number(definition.initialActionDelay) || 0),
    attackCooldown: 0,
    hasActed: false,
    alertTriggered: false,
    revealOrder: null,
  }
}

export function createMonster(floor, index = 0) {
  return createEnemy(enemyDefinitionFor(floor, index))
}

export function createEnemyById(enemyId, position = null) {
  return createEnemy(getEnemyDefinition(enemyId), { position })
}

export function createMinion(enemyId, position) {
  const definition = getEnemyDefinition(enemyId)
  return definition?.spawnOnly ? createEnemyById(enemyId, position) : null
}

export function createBoss(position) {
  return createEnemy(BOSS, { position, boss: true })
}

export function createLootEntity(item, position) {
  return { id: nextEntityId(item.type), kind: 'item', pos: { ...position }, item }
}

export function createRelicEntity(relic, position) {
  const relicId = typeof relic === 'string' ? relic : relic?.id
  if (!relicId) return null
  return {
    id: nextEntityId('relic'),
    kind: 'relic',
    relicId,
    name: typeof relic === 'object' ? relic.name : null,
    pos: { ...position },
  }
}

export function createGoldEntity(amount, position) {
  return { id: nextEntityId('gold'), kind: 'gold', pos: { ...position }, amount }
}

export function createKeyEntity(edgeId, position) {
  return { id: nextEntityId('key'), kind: 'key', pos: { ...position }, edgeId }
}
