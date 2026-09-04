export const TURN_KINDS = Object.freeze({
  ATTACK: 'attack',
  ACTION: 'action',
  MOVEMENT: 'movement',
})

// The ledger is deliberately monotonic: attack <= action <= global, and
// movement is the derived remainder global - action.
function counter(value) {
  return Math.max(0, Math.floor(Number(value) || 0))
}

export class TurnLedger {
  constructor({ attackCount = 0, actionCount = 0, globalTurn = 0 } = {}) {
    this.attackCount = counter(attackCount)
    this.actionCount = Math.max(this.attackCount, counter(actionCount))
    this.globalTurn = Math.max(this.actionCount, counter(globalTurn))
  }

  get movementCount() {
    return Math.max(0, this.globalTurn - this.actionCount)
  }

  advance(kind = TURN_KINDS.ACTION) {
    if (kind === TURN_KINDS.ATTACK) {
      this.attackCount += 1
      this.actionCount += 1
      this.globalTurn += 1
    } else if (kind === TURN_KINDS.ACTION) {
      this.actionCount += 1
      this.globalTurn += 1
    } else if (kind === TURN_KINDS.MOVEMENT) {
      this.globalTurn += 1
    } else {
      throw new Error(`Unknown turn kind: ${kind}`)
    }
    return this.snapshot()
  }

  setGlobalTurn(value) {
    this.globalTurn = Math.max(this.actionCount, counter(value))
    return this.snapshot()
  }

  snapshot() {
    return {
      attackCount: this.attackCount,
      actionCount: this.actionCount,
      movementCount: this.movementCount,
      globalTurn: this.globalTurn,
    }
  }

  serialize() {
    return this.snapshot()
  }
}
