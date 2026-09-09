export const TURN_KINDS = Object.freeze({
  ATTACK: 'attack',
  ACTION: 'action',
  MOVEMENT: 'movement',
})

// The ledger is deliberately monotonic: attack <= global. Every completed
// player operation advances the global turn; movement operations are emitted
// once per traversed cell by GameRun._walk().
function counter(value) {
  return Math.max(0, Math.floor(Number(value) || 0))
}

export class TurnLedger {
  constructor({ attackCount = 0, globalTurn = 0 } = {}) {
    this.attackCount = counter(attackCount)
    this.globalTurn = Math.max(this.attackCount, counter(globalTurn))
  }

  advance(kind = TURN_KINDS.ACTION) {
    if (kind === TURN_KINDS.ATTACK) {
      this.attackCount += 1
    } else if (kind !== TURN_KINDS.ACTION && kind !== TURN_KINDS.MOVEMENT) {
      throw new Error(`Unknown turn kind: ${kind}`)
    }
    if (kind === TURN_KINDS.ATTACK || kind === TURN_KINDS.ACTION || kind === TURN_KINDS.MOVEMENT) {
      this.globalTurn += 1
    }
    return this.snapshot()
  }

  setGlobalTurn(value) {
    this.globalTurn = Math.max(this.attackCount, counter(value))
    return this.snapshot()
  }

  snapshot() {
    return {
      attackCount: this.attackCount,
      globalTurn: this.globalTurn,
    }
  }

  serialize() {
    return this.snapshot()
  }
}
