export const TURN_KINDS = Object.freeze({
  ATTACK: 'attack',
  ACTION: 'action',
  MOVEMENT: 'movement',
  ROUND: 'round',
})

// Attacks count player strikes; the global clock counts completed battle rounds.
// Several attacks can happen within one round.
function counter(value) {
  return Math.max(0, Math.floor(Number(value) || 0))
}

export class TurnLedger {
  constructor({ attackCount = 0, globalTurn = 0 } = {}) {
    this.attackCount = counter(attackCount)
    this.globalTurn = counter(globalTurn)
  }

  advance(kind = TURN_KINDS.ACTION) {
    if (kind === TURN_KINDS.ATTACK) {
      this.attackCount += 1
    } else if (![TURN_KINDS.ACTION, TURN_KINDS.MOVEMENT, TURN_KINDS.ROUND].includes(kind)) {
      throw new Error(`Unknown turn kind: ${kind}`)
    }
    if (kind === TURN_KINDS.ROUND) {
      this.globalTurn += 1
    }
    return this.snapshot()
  }

  setGlobalTurn(value) {
    this.globalTurn = counter(value)
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
