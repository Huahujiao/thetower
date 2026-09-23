export class ShadowHistory {
  constructor(initialState, limit = 80, normalize = (state) => state) {
    this.normalize = normalize
    this.current = JSON.stringify(normalize(initialState))
    this.stack = []
    this.groupDepth = 0
    this.limit = limit
  }

  get canUndo() { return this.stack.length > 0 }

  record(state) {
    if (this.groupDepth) return false
    const next = JSON.stringify(this.normalize(state))
    if (next === this.current) return false
    this.stack.push(this.current)
    if (this.stack.length > this.limit) this.stack.shift()
    this.current = next
    return true
  }

  begin(state) {
    if (!this.groupDepth) this.record(state)
    this.groupDepth += 1
  }

  end(state) {
    if (this.groupDepth) this.groupDepth -= 1
    if (!this.groupDepth) this.record(state)
  }

  undo(state) {
    this.groupDepth = 0
    this.record(state)
    const previous = this.stack.pop()
    if (!previous) return null
    this.current = previous
    return JSON.parse(previous)
  }
}
