import assert from 'node:assert/strict'
import catalog from '../src/game/data/catalog.json' with { type: 'json' }
import { createBoss, createEnemyById, createMinion, synchronizeEnemyBalance } from '../src/game/data/content.js'
import { ENEMY_DEFS, ENEMY_HP_MULTIPLIER, getEnemyDefinition } from '../src/game/data/enemies.js'
import { GameRun } from '../src/game/run.js'
import { stepEnemy } from '../src/game/rules/enemies.js'

assert.equal(ENEMY_HP_MULTIPLIER, 1)

const expected = {
  'emberwing-moth': { minFloor: 1, behavior: 'ambush', attribute: 'scorch', deathExplosionDamage: 2 },
  'rootrot-bud': { minFloor: 1, speed: 0, attribute: 'wither', hp: 20, range: 1, traits: [] },
  'nest-spider': { minFloor: 2, behavior: 'ambush', hp: 9, attack: 4 },
  'tide-shadow-cub': { minFloor: 1, speed: 1, attribute: 'drown' },
  'ash-cannon-bug': { minFloor: 3, speed: 0, attribute: 'scorch', range: 4 },
  'furnace-beetle': { minFloor: 3, speed: 1, attribute: 'scorch', deathExplosionDamage: 3 },
  'thorn-shell-flower': { minFloor: 3, speed: 0, attribute: 'wither', shield: true, regen: 1 },
  'water-leech-swarm': { minFloor: 3, speed: 1, attribute: 'drown', splitMinionId: 'leech-larva' },
  'molten-core-beast': { minFloor: 4, speed: 0, attribute: 'scorch', deathExplosionDamage: 5 },
  'redneedle-salamander': { minFloor: 2, speed: 1, attribute: 'scorch', traits: ['burning'], burningTurns: 2, burningDamage: 1 },
  'rot-sac-toad': { minFloor: 2, speed: 1, attribute: 'wither', deathStatus: 'poison', deathStatusTurns: 3, deathStatusDamage: 2 },
  'claw-beast': { minFloor: 2, speed: 2, attribute: 'drown', traits: [] },
  'whirlpool-eye-sac': { minFloor: 3, speed: 1, attribute: 'drown', traits: ['pull'], pullDistance: 1 },
  'redwheel-fire-crow': { minFloor: 4, speed: 1, attribute: 'scorch', traits: ['burning'], burningTurns: 2 },
  'cinder-curse-lamp-swarm': { minFloor: 4, behavior: 'ambush', attribute: 'scorch', traits: ['burning'], burningTurns: 2 },
  'tide-rite-matriarch': { minFloor: 4, speed: 0, attribute: 'drown', traits: ['summon'], summonEvery: 3, summonMinionId: 'tide-shadow', summonLimit: 2 },
  'drown-shadow-hunter': { minFloor: 4, speed: 2, attribute: 'drown', traits: ['pull'], pullDistance: 1 },
  'tidal-spore-sac': { minFloor: 4, speed: 0, attribute: 'drown', traits: ['death-spawn'], deathSpawnMinionId: 'tide-shadow', deathSpawnCount: 2 },
}

for (const [id, values] of Object.entries(expected)) {
  const definition = getEnemyDefinition(id)
  assert(definition, `${id} must be defined`)
  for (const [key, value] of Object.entries(values)) {
    if (key === 'traits') {
      for (const trait of value) assert(definition.traits?.includes(trait), `${id} must have ${trait}`)
    } else if (key === 'shield') assert(definition.traits?.includes('shield'), `${id} must have shield`)
    else assert.equal(definition[key], value, `${id}.${key}`)
  }
  assert.equal(definition.spawnOnly, undefined, `${id} must enter the natural spawn pool`)
  const entity = createEnemyById(id, { c: 1, r: 1 })
  assert.equal(entity.enemyId, id)
  assert.deepEqual(entity.pos, { c: 1, r: 1 })
  assert.equal(entity.hp, definition.hp * ENEMY_HP_MULTIPLIER)
  assert.equal(entity.maxHp, definition.hp * ENEMY_HP_MULTIPLIER)
}

const leechLarva = getEnemyDefinition('leech-larva')
assert.equal(leechLarva.spawnOnly, true)
assert.equal(leechLarva.noLoot, true)
assert.equal(createMinion('leech-larva', { c: 1, r: 1 }).noExperience, true)
const tideShadow = getEnemyDefinition('tide-shadow')
assert.equal(tideShadow.spawnOnly, true)
assert.equal(tideShadow.noLoot, true)
assert.equal(createMinion('tide-shadow', { c: 1, r: 1 }).noExperience, true)
assert.equal(createMinion('emberwing-moth', { c: 1, r: 1 }), null)
for (const definition of ENEMY_DEFS) {
  const entity = createEnemyById(definition.id, { c: 1, r: 1 })
  assert.equal(entity.hp, definition.hp * ENEMY_HP_MULTIPLIER)
  assert.equal(entity.maxHp, definition.hp * ENEMY_HP_MULTIPLIER)
}
const boss = createBoss({ c: 1, r: 1 })
assert.equal(boss.hp, catalog.boss.hp * ENEMY_HP_MULTIPLIER)
assert.equal(boss.maxHp, catalog.boss.hp * ENEMY_HP_MULTIPLIER)
assert.equal(ENEMY_DEFS.filter((definition) => !definition.spawnOnly).length, 30)

const availableCounts = [1, 2, 3, 4, 5].map((floor) => ENEMY_DEFS.filter((definition) => !definition.spawnOnly && definition.minFloor <= floor).length)
assert.deepEqual(availableCounts, [5, 13, 21, 30, 30])

function blankRoom(run) {
  const room = run.currentRoom
  for (const entity of [...room.entities.values()]) room.removeEntity(entity.id)
  for (let r = 0; r < room.height; r++) {
    for (let c = 0; c < room.width; c++) room.reveal({ c, r })
  }
  return room
}

const armorRun = new GameRun({ autoLoad: false, random: () => 0.25 })
const armorRoom = blankRoom(armorRun)
const shellguard = createEnemyById('shellguard', { c: 1, r: 1 })
armorRoom.addEntity(shellguard)
const hpBeforeArmorHit = shellguard.hp
assert.equal(armorRun._damageEnemy(shellguard, 5).damage, 4)
assert.equal(shellguard.hp, hpBeforeArmorHit - 4)
assert.equal(armorRun._damageEnemy(shellguard, 1, { ignoreDefense: true }).damage, 1)
assert.equal(shellguard.hp, hpBeforeArmorHit - 5)

const burningRun = new GameRun({ autoLoad: false, random: () => 0.25 })
const burningRoom = blankRoom(burningRun)
burningRun.player.pos = { c: 3, r: 3 }
burningRun.player.hp = 10
burningRun.player.armor = 3
const salamander = createEnemyById('redneedle-salamander', { c: 1, r: 1 })
burningRoom.addEntity(salamander)
burningRun._enemyAttack(salamander)
assert.equal(burningRun.player.hp, 8)
assert.equal(burningRun.player.armor, 0)
assert.equal(burningRun.player.burningTurns, 2)
burningRun._tickPlayerStatuses()
assert.equal(burningRun.player.hp, 7)
assert.equal(burningRun.player.burningTurns, 1)

const poisonRun = new GameRun({ autoLoad: false, random: () => 0.25 })
const poisonRoom = blankRoom(poisonRun)
poisonRun.player.pos = { c: 3, r: 3 }
poisonRun.player.hp = 10
poisonRun.player.armor = 5
const toad = createEnemyById('rot-sac-toad', { c: 2, r: 2 })
poisonRoom.addEntity(toad)
poisonRun._defeatEnemy(toad, { suppressLoot: true })
assert.equal(poisonRun.player.poisonedTurns, 3)
poisonRun._tickPlayerStatuses()
assert.equal(poisonRun.player.hp, 8)
assert.equal(poisonRun.player.armor, 5)

const swiftRun = new GameRun({ autoLoad: false, random: () => 0.25 })
const swiftRoom = blankRoom(swiftRun)
swiftRun.player.pos = { c: 5, r: 3 }
const swiftBeast = createEnemyById('claw-beast', { c: 1, r: 3 })
swiftBeast.actionDelay = 0
swiftRoom.addEntity(swiftBeast)
let swiftAttacked = false
const swiftOutcome = stepEnemy(swiftBeast, {
  room: swiftRoom,
  player: swiftRun.player,
  attack: () => { swiftAttacked = true },
  move: (enemy, position) => swiftRoom.moveEntity(enemy.id, position),
})
assert.equal(swiftOutcome.acted, true)
assert.equal(swiftOutcome.skipAttack, false)
assert.equal(swiftBeast.pos.c, 3)
assert.equal(swiftAttacked, false)

const pullRun = new GameRun({ autoLoad: false, random: () => 0.25 })
const pullRoom = blankRoom(pullRun)
pullRun.player.pos = { c: 4, r: 3 }
const whirlpool = createEnemyById('whirlpool-eye-sac', { c: 1, r: 3 })
pullRoom.addEntity(whirlpool)
pullRun._enemyAttack(whirlpool)
assert.equal(pullRun.player.pos.c, 3)

const summonRun = new GameRun({ autoLoad: false, random: () => 0.25 })
const summonRoom = blankRoom(summonRun)
summonRun.player.pos = { c: 5, r: 5 }
const matriarch = createEnemyById('tide-rite-matriarch', { c: 1, r: 1 })
summonRoom.addEntity(matriarch)
summonRun._onEnemyAction(matriarch)
summonRun._onEnemyAction(matriarch)
assert.equal(summonRoom.entities.size, 1)
summonRun._onEnemyAction(matriarch)
assert.equal(matriarch.ownActionCount, 3)
assert.equal([...summonRoom.entities.values()].filter((entity) => entity.enemyId === 'tide-shadow').length, 1)
for (let count = 0; count < 3; count++) summonRun._onEnemyAction(matriarch)
assert.equal([...summonRoom.entities.values()].filter((entity) => entity.enemyId === 'tide-shadow').length, 2)

const spawnRun = new GameRun({ autoLoad: false, random: () => 0.25 })
const spawnRoom = blankRoom(spawnRun)
spawnRun.player.pos = { c: 5, r: 5 }
const spore = createEnemyById('tidal-spore-sac', { c: 2, r: 2 })
spawnRoom.addEntity(spore)
spawnRun._defeatEnemy(spore, { suppressLoot: true })
assert.equal([...spawnRoom.entities.values()].filter((entity) => entity.enemyId === 'tide-shadow').length, 2)

const legacyBud = createEnemyById('rootrot-bud')
Object.assign(legacyBud, { hp: 14, maxHp: 28, hpMultiplier: 4, range: 2, regen: 1, traits: ['regen'], attackCooldown: 1 })
synchronizeEnemyBalance(legacyBud)
assert.equal(legacyBud.hp, 10)
assert.equal(legacyBud.maxHp, 20)
assert.equal(legacyBud.range, 1)
assert.equal(legacyBud.regen, 0)
assert.deepEqual(legacyBud.traits, [])
assert.equal(legacyBud.attackCooldown, 0)
synchronizeEnemyBalance(legacyBud)
assert.equal(legacyBud.hp, 10, 'save migration must not repeat damage scaling')

const storage = new Map()
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
}
const legacyRun = new GameRun({ autoLoad: false, random: () => 0.25 })
const legacyRoom = blankRoom(legacyRun)
const savedBud = createEnemyById('rootrot-bud', { c: 1, r: 1 })
Object.assign(savedBud, { hp: 14, maxHp: 28, hpMultiplier: 4, range: 2, regen: 1, traits: ['regen'] })
legacyRoom.addEntity(savedBud)
const playerHealth = legacyRun.player.hp
const weaponUid = legacyRun.backpack.items.find((item) => item.type === 'weapon').uid
legacyRun._persist()
const loaded = new GameRun({ random: () => 0.25 })
assert.equal(loaded.currentRoom.entity(savedBud.id).hp, 10)
assert.equal(loaded.currentRoom.entity(savedBud.id).maxHp, 20)
assert.equal(loaded.currentRoom.entity(savedBud.id).regen, 0)
assert.equal(loaded.player.hp, playerHealth)
assert(loaded.backpack.items.some((item) => item.uid === weaponUid))

console.log('enemies-check passed')
