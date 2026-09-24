import { ENEMY_HP_MULTIPLIER, enemyDefinitionFor, getEnemyDefinition } from './enemies.js'
import catalog from './catalog.json' with { type: 'json' }
import { getRelicDefinition, RELIC_DEFS } from './relics.js'

const WEAPON_ENERGY_COSTS = Object.freeze({ dagger: 2, sword: 3, axe: 4, polearm: 4, bow: 4, heavy: 5 })
function weaponDefinition(source) {
  return Object.freeze({ ...source, energyCost: WEAPON_ENERGY_COSTS[source.weaponClass] || 3 })
}
const WEAPONS = Object.freeze(catalog.weapons.map(weaponDefinition))
const CONSUMABLES = Object.freeze(catalog.consumables)
const ENEMY_LOOT = Object.freeze(catalog.enemyLoot || [])
const MERCHANT_WEAPONS = Object.freeze(catalog.merchantWeapons || [])
const BOSS = Object.freeze(catalog.boss)
export const DEFENSES = Object.freeze(catalog.defenses)
export const RECIPES = Object.freeze(catalog.recipes)

export function upgradeRecipesForItem(itemOrId) {
  const id = typeof itemOrId === 'object' ? itemOrId?.id : itemOrId
  return id ? RECIPES.filter((recipe) => recipe.a === id) : []
}
export const ALL_ITEM_DEFS = Object.freeze([...WEAPONS, ...CONSUMABLES, ...DEFENSES, ...ENEMY_LOOT, ...MERCHANT_WEAPONS, ...RELIC_DEFS.map(r => ({ ...r, type: 'relic', relicId: r.id, shape: [[1]], rotatable: false }))])
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

export function makeItem(definition, _random = Math.random) {
  const item = { ...definition, shape: cloneShape(definition.shape), uid: nextEntityId('item') }
  if (item.type === 'weapon') {
    item.energyCost = WEAPON_ENERGY_COSTS[item.weaponClass] || 3
    item.tier = weaponTier(item)
  }
  return item
}

// Base weapons are tier I; crafted definitions are tier II. Keep the value on
// the runtime item so saved runs and UI projections can render the same tier.
export function weaponTier(item) {
  if (item?.type !== 'weapon') return 0
  const fallback = item.crafted ? 2 : 1
  return Math.max(1, Math.min(3, Number(item.tier) || fallback))
}

export function weaponTierRoman(item) {
  return ['', 'I', 'II', 'III'][weaponTier(item)] || 'I'
}

export function getItemDefinition(id) { return ITEM_BY_ID.get(id) || null }

export function makeItemById(id, random = Math.random) {
  const definition = getItemDefinition(id)
  if (definition?.type === 'relic') return makeRelicItem(id)
  return definition ? makeItem(definition, random) : null
}

export function makeRelicItem(relicOrId) {
  const relicId = typeof relicOrId === 'string' ? relicOrId : relicOrId?.id
  const definition = getRelicDefinition(relicId)
  if (!definition) return null
  return {
    type: 'relic',
    relicId: definition.id,
    id: definition.id,
    attribute: definition.attribute,
    name: definition.name,
    description: definition.description,
    shape: [[1]],
    rotatable: false,
    uid: nextEntityId('relic-item'),
  }
}

function weightedPick(values, random) {
  if (!values.length) return null
  const total = values.reduce((sum, value) => sum + Math.max(1, Number(value.supplyWeight) || 1), 0)
  let cursor = Math.max(0, Number(random()) || 0) * total
  for (const value of values) {
    cursor -= Math.max(1, Number(value.supplyWeight) || 1)
    if (cursor < 0) return value
  }
  return values.at(-1)
}

export function randomConsumableDefinition(floor, random = Math.random) {
  const pool = CONSUMABLES.filter((item) => floor >= (item.minFloor || 1))
  return weightedPick(pool, random)
}

export function randomItem(floor, random = Math.random) {
  const weaponPool = WEAPONS.filter((weapon) => !weapon.crafted && floor >= (weapon.minFloor || 1))
  const defensePool = DEFENSES.filter((defense) => floor >= (defense.minFloor || 1))
  const roll = random()
  if (roll < 0.58 && weaponPool.length) return makeItem(weaponPool[Math.floor(random() * weaponPool.length)])
  if (roll < 0.83 && defensePool.length) return makeItem(defensePool[Math.floor(random() * defensePool.length)])
  return makeItem(randomConsumableDefinition(floor, random))
}

export function randomWeapon(floor, random = Math.random) {
  const weaponPool = WEAPONS.filter((weapon) => !weapon.crafted && floor >= (weapon.minFloor || 1))
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
    burningTurns: definition.burningTurns || 0,
    burningDamage: definition.burningDamage || 0,
    deathStatus: definition.deathStatus || null,
    deathStatusTurns: definition.deathStatusTurns || 0,
    deathStatusDamage: definition.deathStatusDamage || 0,
    pullDistance: definition.pullDistance || 0,
    summonEvery: definition.summonEvery || 0,
    summonMinionId: definition.summonMinionId || null,
    summonLimit: definition.summonLimit || 0,
    deathSpawnMinionId: definition.deathSpawnMinionId || null,
    deathSpawnCount: definition.deathSpawnCount || 0,
    explosionRadius: definition.explosionRadius || 0,
    deathExplosionDamage: definition.deathExplosionDamage || 0,
    selfDestructOnAttack: definition.selfDestructOnAttack === true,
    noLoot: definition.noLoot === true,
    noExperience: definition.spawnOnly === true,
    boss,
    pos: position ? { ...position } : null,
    hp: definition.hp * ENEMY_HP_MULTIPLIER,
    maxHp: definition.hp * ENEMY_HP_MULTIPLIER,
    attack: definition.attack,
    range: definition.range,
    attackCooldownMax: Math.max(1, Number(definition.attackCooldownMax ?? definition.cooldownMax) || 0),
    initialActionDelay: definition.initialActionDelay,
    actionDelay: Math.max(0, Number(definition.initialActionDelay) || 0),
    attackCooldown: 0,
    ownActionCount: 0,
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
  const item = makeRelicItem(relicId)
  return item ? createLootEntity(item, position) : null
}

export function createGoldEntity(amount, position) {
  return { id: nextEntityId('gold'), kind: 'gold', pos: { ...position }, amount }
}

export function createKeyEntity(edgeId, position) {
  return { id: nextEntityId('key'), kind: 'key', pos: { ...position }, edgeId }
}
