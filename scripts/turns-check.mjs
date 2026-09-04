import assert from 'node:assert/strict'
import { GameRun } from '../src/game/run.js'
import { TURN_KINDS, TurnLedger } from '../src/game/core/turns.js'

const ledger = new TurnLedger()
assert.deepEqual(ledger.snapshot(), {
  attackCount: 0,
  actionCount: 0,
  movementCount: 0,
  globalTurn: 0,
})

ledger.advance(TURN_KINDS.MOVEMENT)
assert.deepEqual(ledger.snapshot(), {
  attackCount: 0,
  actionCount: 0,
  movementCount: 1,
  globalTurn: 1,
})

ledger.advance(TURN_KINDS.ACTION)
assert.deepEqual(ledger.snapshot(), {
  attackCount: 0,
  actionCount: 1,
  movementCount: 1,
  globalTurn: 2,
})

ledger.advance(TURN_KINDS.ATTACK)
assert.deepEqual(ledger.snapshot(), {
  attackCount: 1,
  actionCount: 2,
  movementCount: 1,
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
assert.equal(run.actionCount, 2)
assert.equal(run.movementCount, 1)
assert.equal(run.globalTurn, 3)
assert.equal(run.turn, run.globalTurn)
assert.deepEqual(advanced.map(({ turnKind, attackCount, actionCount, movementCount, globalTurn }) => ({
  turnKind, attackCount, actionCount, movementCount, globalTurn,
})), [
  { turnKind: TURN_KINDS.MOVEMENT, attackCount: 0, actionCount: 0, movementCount: 1, globalTurn: 1 },
  { turnKind: TURN_KINDS.ACTION, attackCount: 0, actionCount: 1, movementCount: 1, globalTurn: 2 },
  { turnKind: TURN_KINDS.ATTACK, attackCount: 1, actionCount: 2, movementCount: 1, globalTurn: 3 },
])

const serialized = run.serialize()
assert.deepEqual(serialized.turnCounters, {
  attackCount: 1,
  actionCount: 2,
  movementCount: 1,
  globalTurn: 3,
})
assert.equal(serialized.turn, 3)

const legacy = new GameRun({ autoLoad: false, random: () => 0.25 })
legacy.turn = 9
assert.equal(legacy.globalTurn, 9)
assert.equal(legacy.actionCount, 0)
assert.equal(legacy.movementCount, 9)

console.log('turns-check passed')
