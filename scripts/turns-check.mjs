import assert from 'node:assert/strict'
import { GameRun } from '../src/game/run.js'
import { TURN_KINDS, TurnLedger } from '../src/game/core/turns.js'

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

const weapon = movementRun.backpackWeapons[0]
assert.equal(movementRun.weaponEnergyCost(weapon), 3)
movementRun.player.energy = 2
assert.equal(movementRun._spendEnergy(movementRun.weaponEnergyCost(weapon)), false)

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

console.log('turns-check passed')
