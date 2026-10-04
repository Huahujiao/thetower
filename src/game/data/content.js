import { ENEMY_HP_MULTIPLIER, enemyDefinitionFor, getEnemyDefinition } from './enemies.js'
import catalog from './catalog.json' with { type: 'json' }
import { getRelicDefinition, RELIC_DEFS } from './relics.js'
import { bindStatusAccessors } from '../rules/statuses.js'
import { EXPANSION_WEAPONS, EXPANSION_DEFENSES, GENERATED_CONSUMABLES } from './expansion-items.js'
import { PETS, PET_WEAPONS, PET_DEFENSES, BUTCHER_FOOD } from './pets.js'
import { ADVANCED_CRAFT_MATERIALS, WEAPON_RECIPES, weaponTierForId } from './weapon-progression.js'

function weaponDefinition(source) {
  const tier = weaponTierForId(source.id) || Math.max(1, Math.min(3, Number(source.tier) || (source.crafted ? 2 : 1)))
  return Object.freeze({ ...source, tier, crafted: tier > 1, energyCost: Math.max(1, Math.floor(Number(source.energyCost) || 3)) })
}
const WEAPONS = Object.freeze([...catalog.weapons, ...(catalog.merchantWeapons || []), ...EXPANSION_WEAPONS, ...PET_WEAPONS].map(weaponDefinition))
const CONSUMABLES = Object.freeze([...catalog.consumables, ...GENERATED_CONSUMABLES, BUTCHER_FOOD].map(item => Object.freeze({ tier: 1, supplyWeight: 4, ...item,
  ...(item.type === 'energy' ? { description: '\u5ba0\u7269\u53ef\u6309\u70b9\u6570\u90e8\u5206\u6d88\u8017\uff1b\u76f4\u63a5\u4f7f\u7528\u6d88\u8017\u6574\u4efd\uff0c\u6062\u590d\u5269\u4f59\u70b9\u6570\u7684\u4f53\u529b\u3002' } : {}),
})))
const ENEMY_LOOT = Object.freeze([...(catalog.enemyLoot || []), ...ADVANCED_CRAFT_MATERIALS])
const BOSS = Object.freeze(catalog.boss)
export const DEFENSES = Object.freeze([...catalog.defenses, ...EXPANSION_DEFENSES, ...PET_DEFENSES].map(item => Object.freeze({ ...item, armorValue: item.armorValue || 1 })))
export const MONEY_POUCH = Object.freeze({
  id: 'money-pouch', type: 'money-pouch', name: '\u94b1\u888b', shape: [[1]], rotatable: false,
  discardable: false, sellable: false, starterOnly: true,
  description: '\u663e\u793a\u5f53\u524d\u91d1\u5e01\u6570\u91cf\u3002\u53ef\u79fb\u52a8\u3001\u6682\u5b58\uff0c\u4e0d\u53ef\u4e22\u5f03\u6216\u51fa\u552e\u3002',
})
export const RECIPES = WEAPON_RECIPES

export function upgradeRecipesForItem(itemOrId) {
  const id = typeof itemOrId === 'object' ? itemOrId?.id : itemOrId
  return id ? RECIPES.filter((recipe) => recipe.a === id) : []
}
export const ALL_ITEM_DEFS = Object.freeze([...WEAPONS, ...CONSUMABLES, ...DEFENSES, ...PETS, ...ENEMY_LOOT, MONEY_POUCH, ...RELIC_DEFS.map(r => ({ ...r, type: 'relic', relicId: r.id, shape: [[1]], rotatable: false }))])
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
    item.tier = weaponTier(item)
  }
  return item
}

// Every weapon has an explicit tier. Keep it on runtime items so saves, combat
// details, the backpack, shops and the Wiki all project the same value.
export function weaponTier(item) {
  if (item?.type !== 'weapon') return 0
  const fallback = weaponTierForId(item.id) || (item.crafted ? 2 : 1)
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
    totemId: definition.totemId,
    summonRange: definition.summonRange,
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
  const pool = CONSUMABLES.filter((item) => !item.generatedOnly && !item.disabled && floor >= (item.minFloor || 1))
  return weightedPick(pool, random)
}

export function randomNeutralItem(floor, random = Math.random) {
  return makeItem(randomConsumableDefinition(floor, random))
}

export function randomConsumableOfTier(tier, random = Math.random) {
  const pool = CONSUMABLES.filter(item => !item.generatedOnly && !item.disabled && item.tier === tier)
  return pool.length ? makeItem(pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]) : null
}

export function randomWeapon(floor, random = Math.random) {
  const weaponPool = WEAPONS.filter((weapon) => weapon.tier === 1 && floor >= (weapon.minFloor || 1))
  return makeItem(weaponPool[Math.floor(random() * weaponPool.length)], random)
}

function createEnemy(definition, { position = null, boss = false } = {}) {
  if (!definition) return null
  return bindStatusAccessors({
    id: nextEntityId(boss ? 'boss' : 'enemy'),
    kind: 'enemy',
    enemyId: definition.id,
    name: definition.name,
    attribute: definition.attribute,
    speed: Math.max(0, Math.floor(Number(definition.speed) || 0)),
    ...(definition.behavior === 'ambush' ? { behavior: 'ambush' } : {}),
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
    hpMultiplier: ENEMY_HP_MULTIPLIER,
    attack: definition.attack,
    range: definition.range,
    attackCooldownMax: 0,
    initialActionDelay: definition.initialActionDelay,
    actionDelayRevision: 1,
    actionDelay: Math.max(0, Number(definition.initialActionDelay) || 0),
    attackCooldown: 0,
    ownActionCount: 0,
    hasActed: false,
    alertTriggered: false,
    revealOrder: null,
    statuses: {},
  })
}

export function createMonster(floor, index = 0) {
  return createEnemy(enemyDefinitionFor(floor, index))
}

// Update old saves once, preserving damage already dealt and combat state.
export function synchronizeEnemyBalance(enemy) {
  const definition = enemy.enemyId === BOSS.id ? BOSS : getEnemyDefinition(enemy.enemyId)
  if (!definition) return
  enemy.speed = Math.max(0, Math.floor(Number(definition.speed) || 0))
  enemy.range = definition.range
  if (definition.behavior === 'ambush') enemy.behavior = 'ambush'
  else delete enemy.behavior
  enemy.traits = (enemy.traits || []).filter(trait => trait !== 'swift')
  enemy.attackCooldownMax = 0
  enemy.attackCooldown = 0
  if (enemy.actionDelayRevision !== 1) {
    const previousDelay = Math.max(0, Number(enemy.initialActionDelay) || 0)
    const delay = Math.max(0, Number(definition.initialActionDelay) || 0)
    enemy.actionDelay = Math.max(0, (Number(enemy.actionDelay) || 0) - (enemy.hasActed ? 0 : previousDelay)) + (enemy.hasActed ? 0 : delay)
    enemy.initialActionDelay = delay
    enemy.actionDelayRevision = 1
  }
  if (enemy.hpMultiplier === ENEMY_HP_MULTIPLIER) return
  const fraction = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp))
  enemy.maxHp = definition.hp * ENEMY_HP_MULTIPLIER
  enemy.hp = Math.ceil(enemy.maxHp * fraction)
  enemy.hpMultiplier = ENEMY_HP_MULTIPLIER
  enemy.attack = definition.attack
  enemy.range = definition.range
  enemy.traits = [...(definition.traits || [])]
  enemy.regen = definition.regen || 0
  enemy.deathStatusTurns = definition.deathStatusTurns || 0
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
