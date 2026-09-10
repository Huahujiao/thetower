import assert from 'node:assert/strict'
import { GameRun, RELIC_SOFT_LIMIT } from '../src/game/run.js'
import { TURN_KINDS, TurnLedger } from '../src/game/core/turns.js'
import { createEnemyById } from '../src/game/data/content.js'
import { RELIC_DEFS, buildRelicChoices } from '../src/game/data/relics.js'

const ledger = new TurnLedger()
assert.deepEqual(ledger.snapshot(), {
  attackCount: 0,
  globalTurn: 0,
})

ledger.advance(TURN_KINDS.MOVEMENT)
assert.deepEqual(ledger.snapshot(), {
  attackCount: 0,
  globalTurn: 1,
})

ledger.advance(TURN_KINDS.ACTION)
assert.deepEqual(ledger.snapshot(), {
  attackCount: 0,
  globalTurn: 2,
})

ledger.advance(TURN_KINDS.ATTACK)
assert.deepEqual(ledger.snapshot(), {
  attackCount: 1,
  globalTurn: 3,
})

assert.throws(() => ledger.advance('unknown'), /Unknown turn kind/)

const run = new GameRun({ autoLoad: false, random: () => 0.25 })
const advanced = []
run.on('turn:advanced', (context) => advanced.push(context))

run._endTurn({ skipEnemyPhase: true, turnKind: TURN_KINDS.MOVEMENT })
run._endTurn({ skipEnemyPhase: true, turnKind: TURN_KINDS.ACTION })
run._endTurn({ skipEnemyPhase: true, turnKind: TURN_KINDS.ATTACK })

assert.equal(run.attackCount, 1)
assert.equal(run.globalTurn, 3)
assert.equal(run.turn, run.globalTurn)
assert.deepEqual(advanced.map(({ turnKind, attackCount, globalTurn }) => ({
  turnKind, attackCount, globalTurn,
})), [
  { turnKind: TURN_KINDS.MOVEMENT, attackCount: 0, globalTurn: 1 },
  { turnKind: TURN_KINDS.ACTION, attackCount: 0, globalTurn: 2 },
  { turnKind: TURN_KINDS.ATTACK, attackCount: 1, globalTurn: 3 },
])

const serialized = run.serialize()
assert.deepEqual(serialized.turnCounters, {
  attackCount: 1,
  globalTurn: 3,
})
assert.equal(serialized.turn, 3)

const legacy = new GameRun({ autoLoad: false, random: () => 0.25 })
legacy.turn = 9
assert.equal(legacy.globalTurn, 9)

const movementRun = new GameRun({ autoLoad: false, random: () => 0.99 })
const path = [
  { c: movementRun.player.pos.c + 1, r: movementRun.player.pos.r },
  { c: movementRun.player.pos.c + 1, r: movementRun.player.pos.r + 1 },
]
const movementEvents = []
movementRun.on('turn:advanced', (context) => movementEvents.push(context))
movementRun.player.energy = 5
assert.equal(movementRun._walk(path).stopped, false)
assert.equal(movementRun.globalTurn, 2)
assert.equal(movementRun.player.energy, 7)
assert.deepEqual(movementEvents.map(({ turnKind, globalTurn }) => ({ turnKind, globalTurn })), [
  { turnKind: TURN_KINDS.MOVEMENT, globalTurn: 1 },
  { turnKind: TURN_KINDS.MOVEMENT, globalTurn: 2 },
])

const recoveryRun = new GameRun({ autoLoad: false, random: () => 0.99 })
recoveryRun.initialRelicChoices = []
recoveryRun.player.energy = 4
recoveryRun._endTurn({ skipEnemyPhase: true, turnKind: TURN_KINDS.ACTION })
assert.equal(recoveryRun.player.energy, 5)
recoveryRun._endTurn({ skipEnemyPhase: true, turnKind: TURN_KINDS.ATTACK })
assert.equal(recoveryRun.player.energy, 5)

const weapon = movementRun.backpackWeapons[0]
assert.equal(movementRun.weaponEnergyCost(weapon), 3)
movementRun.player.energy = 2
assert.equal(movementRun._spendEnergy(movementRun.weaponEnergyCost(weapon)), false)

const approachRun = new GameRun({ autoLoad: false, random: () => 0.99 })
approachRun.initialRelicChoices = []
const approachRoom = approachRun.currentRoom
for (const entity of [...approachRoom.entities.values()]) approachRoom.removeEntity(entity.id)
for (const row of approachRoom.tiles) for (const tile of row) tile.revealed = true
const approachEnemy = createEnemyById('gnawer', {
  c: approachRun.player.pos.c + 3,
  r: approachRun.player.pos.r,
})
approachEnemy.attack = 0
approachEnemy.actionDelay = 99
approachRoom.addEntity(approachEnemy)
const approachWeapon = approachRun.backpackWeapons[0]
approachRun.selectedInventoryIndex = approachRun.backpack.originIndex(approachRun.backpack.placementOf(approachWeapon.uid))
approachRun.player.energy = 1
assert.equal(approachRun.previewTileAction(approachEnemy.pos.c, approachEnemy.pos.r)?.kind, 'attack')
assert.equal(approachRun.clickTile(approachEnemy.pos.c, approachEnemy.pos.r), true)
assert.equal(approachRun.player.pos.c, approachEnemy.pos.c - 1)
assert.equal(approachRun.player.energy, 0)

const logRun = new GameRun({ autoLoad: false, random: () => 0.25 })
logRun._log('earlier event')
const attackLogStart = logRun._logSequence
logRun._log('secondary explosion')
logRun._log('enemy defeated')
logRun._log('experience gained')
logRun._log('primary attack', { insertAt: logRun._logSequence - attackLogStart })
assert.deepEqual(logRun.log.slice(0, 5).map((entry) => entry.split('] ')[1]), [
  'experience gained',
  'enemy defeated',
  'secondary explosion',
  'primary attack',
  'earlier event',
])

const overloadRun = new GameRun({ autoLoad: false, random: () => 0.25 })
const initialRelic = overloadRun.initialRelicChoices[0]
assert(overloadRun.chooseInitialRelic(initialRelic))
for (const relic of RELIC_DEFS.filter(({ id }) => id !== initialRelic).slice(0, RELIC_SOFT_LIMIT + 1)) {
  assert(overloadRun.acquireRelic(relic.id))
}
assert.equal(overloadRun.relicCount(), RELIC_SOFT_LIMIT + 2)
assert.equal(overloadRun.activeRelics().length, 0)
assert.equal(overloadRun.hasActiveRelic(initialRelic), false)
overloadRun.player.hp = 20
overloadRun.player.armor = 1
overloadRun._endTurn({ skipEnemyPhase: true, turnKind: TURN_KINDS.MOVEMENT })
assert.equal(overloadRun.player.armor, 1)
assert.equal(overloadRun.player.hp, 20)
const discardedRelic = overloadRun.backpack.items.find((item) => item.type === 'relic')
overloadRun.selectedInventoryIndex = overloadRun.backpack.originIndex(overloadRun.backpack.placementOf(discardedRelic.uid))
assert(overloadRun.discardSelected())
assert.equal(overloadRun.relics.has(discardedRelic.relicId), false)
assert(buildRelicChoices(overloadRun.relics, { count: RELIC_DEFS.length }).some(({ id }) => id === discardedRelic.relicId))
const secondDiscard = overloadRun.backpack.items.find((item) => item.type === 'relic')
overloadRun.selectedInventoryIndex = overloadRun.backpack.originIndex(overloadRun.backpack.placementOf(secondDiscard.uid))
assert(overloadRun.discardSelected())
assert.equal(overloadRun.relicCount(), RELIC_SOFT_LIMIT)
assert.equal(overloadRun.activeRelics().length, RELIC_SOFT_LIMIT)

console.log('turns-check passed')
