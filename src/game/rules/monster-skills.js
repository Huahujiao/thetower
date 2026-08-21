import { getMonsterSkillDef } from '../../data/monster-skills.js'

const TRIGGER_PHASES = Object.freeze({
  reveal: 45,
  'turn:start': 70,
  'attack:after': 45,
  damaged: 45,
})

function asList(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

export class MonsterSkillEngine {
  constructor(state) {
    this.state = state
  }

  skillsFor(card) {
    if (!card || !Array.isArray(card.skills)) return []
    return card.skills.map(getMonsterSkillDef).filter(Boolean)
  }

  _runtime(card, skill) {
    if (!card.skillState || typeof card.skillState !== 'object') card.skillState = {}
    if (!card.skillState[skill.id] || typeof card.skillState[skill.id] !== 'object') {
      card.skillState[skill.id] = { cooldown: 0 }
    }
    return card.skillState[skill.id]
  }

  _ready(card, skill) {
    return Math.max(0, Math.floor(Number(this._runtime(card, skill).cooldown) || 0)) <= 0
  }

  tickCooldowns() {
    for (const card of this.state.board) {
      for (const skill of this.skillsFor(card)) {
        const runtime = this._runtime(card, skill)
        runtime.cooldown = Math.max(0, Math.floor(Number(runtime.cooldown) || 0) - 1)
      }
    }
  }

  collect(card, trigger, context = {}) {
    return this.skillsFor(card)
      .filter((skill) => skill.trigger === trigger)
      .map((skill, index) => ({
        id: `monster-skill:${card.uid}:${skill.id}:${trigger}`,
        phase: skill.phase ?? TRIGGER_PHASES[trigger] ?? 45,
        sourceOrder: index,
        apply: () => this._apply(card, skill, trigger, context),
      }))
  }

  trigger(card, trigger, context = {}) {
    const effects = this.collect(card, trigger, context)
    if (!effects.length) return []
    return this.state._runResolution(`monster:skill:${trigger}`, effects, {
      ...context, card, trigger,
    })
  }

  triggerBoard(trigger, context = {}) {
    const cards = this.state.board.filter((card) =>
      this.state.isHostileMonster(card) && card.flipped && card.monsterHp > 0)
    for (const card of cards) this.trigger(card, trigger, context)
  }

  _apply(card, skill, trigger, context = {}) {
    if (!this._ready(card, skill)) return false
    const runtime = this._runtime(card, skill)
    this.state.log.push(card.def.name + ' \u53d1\u52a8\u300c' + skill.name + '\u300d\u3002')
    for (const effect of asList(skill.effects)) this._applyEffect(card, skill, effect, context)
    runtime.cooldown = Math.max(0, Math.floor(Number(skill.cooldown) || 0))
    runtime.lastTrigger = trigger
    return true
  }

  _applyEffect(card, skill, effect, context = {}) {
    if (!effect || !effect.type) return
    if (effect.type === 'attack') {
      this.state.monsterSkillAttack(card, {
        multiplier: effect.multiplier,
        sanity: effect.sanity,
        source: `monster-skill:${skill.id}`,
      })
      return
    }
    if (effect.type === 'status') {
      this.state.addCardStatus(card, effect.status)
      return
    }
    if (effect.type === 'sanity') {
      const spent = this.state.spendSanity(effect.amount, { source: `monster-skill:${skill.id}` })
      if (spent) this.state.log.push(card.def.name + ' \u4f7f\u73a9\u5bb6\u5931\u53bb ' + spent + ' \u70b9\u7406\u667a\u3002')
      return
    }
    if (effect.type === 'move') {
      this.state.moveMonsterToRandomNeighbor(card, { source: `monster-skill:${skill.id}` })
    }
  }
}

