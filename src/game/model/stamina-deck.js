import { ATTRIBUTE_ORDER } from '../data/attributes.js'

export const BALL_ATTRIBUTES = Object.freeze([...ATTRIBUTE_ORDER, 'wild'])
export const BALL_LABELS = Object.freeze({ scorch: '红', wither: '黄', drown: '蓝', wild: '万' })

export class StaminaDeck {
  constructor(random = Math.random, saved = null) {
    this.random = random
    if (saved) Object.assign(this, JSON.parse(JSON.stringify(saved)))
    else {
      this.drawPile = []; this.hand = []; this.discardPile = []; this.selected = []; this.nextId = 0
      this.supply = 0
      for (const attribute of BALL_ATTRIBUTES) {
        for (let n = 0; n < (attribute === 'wild' ? 2 : 10); n++) this.add(attribute)
      }
      this.drawPile = this.discardPile.splice(0)
      this.shuffle(this.drawPile)
    }
  }
  static valid(state) {
    if (!state || !['drawPile', 'hand', 'discardPile', 'selected'].every(key => Array.isArray(state[key])) ||
        !Number.isInteger(state.nextId) || state.nextId < 32 || !Number.isInteger(state.supply) || state.supply < 0) return false
    const balls = [...state.drawPile, ...state.hand, ...state.discardPile]
    return balls.length === state.nextId && new Set(balls.map(ball => ball.id)).size === balls.length &&
      balls.every(ball => Number.isInteger(ball.id) && ball.id >= 0 && ball.id < state.nextId && BALL_ATTRIBUTES.includes(ball.attribute)) &&
      new Set(state.selected).size === state.selected.length && state.selected.every(id => state.hand.some(ball => ball.id === id))
  }
  get all() { return [...this.drawPile, ...this.hand, ...this.discardPile] }
  composition() { return Object.fromEntries(BALL_ATTRIBUTES.map(attribute => [attribute, this.all.filter(ball => ball.attribute === attribute).length])) }
  shuffle(pile) {
    for (let i = pile.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1))
      ;[pile[i], pile[j]] = [pile[j], pile[i]]
    }
  }
  add(attribute = 'wild') {
    if (!BALL_ATTRIBUTES.includes(attribute)) throw new Error('Invalid ball attribute')
    const ball = { id: this.nextId++, attribute }
    this.discardPile.push(ball)
    return ball
  }
  draw(amount) {
    const drawn = []
    for (let n = 0; n < amount; n++) {
      if (!this.drawPile.length) {
        if (!this.discardPile.length) break
        this.drawPile = this.discardPile.splice(0)
        this.shuffle(this.drawPile)
      }
      const ball = this.drawPile.pop()
      this.hand.push(ball); drawn.push(ball)
    }
    return drawn
  }
  startTurn(enemyCount, fatigueLayers = 0) {
    this.discardHand()
    this.supply = Math.max(0, 2 * enemyCount + 4 - fatigueLayers)
    return this.draw(this.supply)
  }
  supplement() { this.supply += 2; return this.draw(2) }
  discardHand() { this.discardPile.push(...this.hand.splice(0)); this.selected = [] }
  toggle(id) {
    if (!this.hand.some(ball => ball.id === id)) return false
    if (this.selected.includes(id)) this.selected = this.selected.filter(value => value !== id)
    else this.selected.push(id)
    return true
  }
  plan(amount, attribute = null, { selection = true } = {}) {
    const cost = Math.max(0, Math.floor(Number(amount) || 0))
    if (!attribute && cost > this.hand.length) return null
    const available = attribute ? this.hand.filter(ball => ball.attribute === attribute || ball.attribute === 'wild') : this.hand
    if (attribute && cost > 0 && !available.length) return null
    const counts = Object.fromEntries(BALL_ATTRIBUTES.map(key => [key, this.hand.filter(ball => ball.attribute === key).length]))
    const priority = ball => attribute ? (ball.attribute === attribute ? 0 : ball.attribute === 'wild' ? 1 : 2) :
      (ball.attribute === 'wild' ? 100 : -counts[ball.attribute])
    const chosen = selection ? this.selected.map(id => available.find(ball => ball.id === id)).filter(Boolean).slice(0, cost) : []
    const remaining = available.filter(ball => !chosen.includes(ball)).sort((a, b) => priority(a) - priority(b))
    const balls = [...chosen, ...remaining.slice(0, cost - chosen.length)]
    const multiplier = attribute && cost > 0 ? balls.length / cost : 1
    return { balls, cost, paid: balls.length, partial: multiplier < 1, multiplier }
  }
  pay(amount, attribute = null, options) {
    const plan = this.plan(amount, attribute, options)
    if (!plan) return null
    const ids = new Set(plan.balls.map(ball => ball.id))
    this.hand = this.hand.filter(ball => !ids.has(ball.id))
    this.discardPile.push(...plan.balls)
    this.selected = this.selected.filter(id => !ids.has(id))
    return plan
  }
  refund(balls) {
    const ids = new Set(balls.map(ball => ball.id))
    const refunded = this.discardPile.filter(ball => ids.has(ball.id))
    this.discardPile = this.discardPile.filter(ball => !ids.has(ball.id))
    this.hand.push(...refunded)
  }
  serialize() {
    const { drawPile, hand, discardPile, selected, nextId, supply } = this
    return JSON.parse(JSON.stringify({ drawPile, hand, discardPile, selected, nextId, supply }))
  }
}
