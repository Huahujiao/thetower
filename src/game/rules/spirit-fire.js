import { chebyshev } from '../core/geometry.js'
import { rekindleChance, spiritFireName } from '../data/spirit-fire.js'

export class SpiritFireRules {
  constructor(run) { this.run = run }
  startBattle() { this.startTurn() }
  startTurn() {
    for (const ball of this.run.staminaDeck.all) if (ball.enchantment === 'rekindle') delete ball.rekindleReturns
  }
  armor(amount) { this.run.player.armor += amount }
  consumedAction(balls, kind) {
    const { run } = this
    for (const ball of balls) {
      if (kind === 'move' && ball.enchantment === 'light-foot') this.armor(2)
      if (kind === 'move' && ball.enchantment === 'flame-step') {
        const targets = run._activeEnemies().filter(enemy => chebyshev(enemy.pos, run.player.pos) === 1)
        for (const enemy of targets) {
          if (run.gameOver) break
          run._damageEnemy(enemy, 2, { source: 'spirit-fire:flame-step' })
        }
      }
      if (kind === 'reveal' && ball.enchantment === 'explore') run.player.gold += 1
      if (['reveal', 'pickup'].includes(kind) && ball.enchantment === 'economy' && run.random() < .30) run.staminaDeck.refund([ball])
    }
  }
  attack(balls, weapon) {
    const { run } = this
    // Remaining flames provide their own passive attack bonuses.
    const unused = run.staminaDeck.hand.slice()
    const result = { flat: 0, multiplier: 0, factor: 1, leech: balls.filter(ball => ball.enchantment === 'leech').length, unused }
    const colors = new Set(balls.map(ball => ball.attribute))
    for (const ball of balls) {
      switch (ball.enchantment) {
        case 'sharp': result.flat += 3; break
        case 'amplify': result.multiplier += .2; break
        case 'berserk':
          result.factor *= 2
          if (run.random() < .25) {
            run.staminaDeck.remove(ball.id)
            run._log(spiritFireName(ball) + '的［狂暴］触发，永久销毁。')
          }
          break
        case 'greed': run.player.gold += 2; break
        case 'bulwark': this.armor(2); break
        case 'temper':
          weapon.attack += 1
          weapon.reinforcement = (weapon.reinforcement || 0) + 1
          run._log('［淬炼］：' + weapon.name + '永久+1攻击力。')
          break
        case 'rekindle':
          if (run.random() < rekindleChance(ball)) {
            ball.rekindleReturns = Math.min(5, (ball.rekindleReturns || 0) + 1)
            run.staminaDeck.refund([ball])
          }
          break
      }
    }
    for (const ball of unused) {
      if (ball.enchantment === 'fuel') result.flat += 1
      if (ball.enchantment === 'resonance' && colors.has(ball.attribute)) result.multiplier += .1
      if (ball.enchantment === 'stance') this.armor(1)
    }
    return result
  }
  afterAttack(context, hit) {
    const { run } = this
    if (run.gameOver) return
    if (hit.healthDamage > 0) for (let count = 0; count < context.leech; count++) {
      run._healPlayer(1, { source: 'spirit-fire:leech' })
    }
    if (hit.defeated) for (const ball of context.unused) {
      if (ball.enchantment !== 'gather') continue
      run.player.gold += 1
    }
  }
  endTurn() {
    for (const ball of this.run.staminaDeck.hand) if (ball.enchantment === 'guardian') this.armor(2)
  }
}
