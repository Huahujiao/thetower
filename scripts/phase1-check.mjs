import assert from 'node:assert/strict'
import { GameState } from '../src/game/state.js'
import { WEAPONS } from '../src/data/cards.js'
import { ModifierPipeline, MODIFIER_OPERATIONS } from '../src/game/rules/modifiers.js'
import { EffectQueue, RESOLUTION_PHASES } from '../src/game/rules/resolution.js'
import { StatusStore } from '../src/game/rules/status.js'
import { TriggerRegistry } from '../src/game/rules/triggers.js'
import { COMMANDS, command } from '../src/game/core/commands.js'

const value = new ModifierPipeline(100)
  .add({ operation: MODIFIER_OPERATIONS.PERCENT_ADD, phase: 'damage', value: 0.05 })
  .add({ operation: MODIFIER_OPERATIONS.PERCENT_ADD, phase: 'damage', value: 0.05 })
  .resolve()
assert.ok(Math.abs(value - 110) < 1e-9)

const ordered = []
const queue = new EffectQueue()
queue.enqueue({ id: 'second', phase: RESOLUTION_PHASES.DAMAGE, sourceOrder: 1, apply: () => ordered.push('second') })
queue.enqueue({ id: 'first', phase: RESOLUTION_PHASES.DAMAGE, sourceOrder: 0, apply: () => ordered.push('first') })
queue.run()
assert.deepEqual(ordered, ['first', 'second'])

const registry = new TriggerRegistry()
registry.register({ event: 'test', effects: () => ({ id: 'first', apply: () => {} }) })
registry.register({ event: 'test', effects: () => ({ id: 'second', apply: () => {} }) })
assert.deepEqual(registry.collect('test').map((effect) => effect.id), ['first', 'second'])

const statuses = new StatusStore()
statuses.add({ id: 'bleed', amount: 1, turns: 2 })
statuses.add({ id: 'bleed', amount: 1, turns: 2 })
assert.equal(statuses.totalAmount('bleed'), 2)
statuses.tick()
assert.equal(statuses.all('bleed').length, 2)
statuses.tick()
assert.equal(statuses.all('bleed').length, 0)

const state = new GameState()
state.addToHand(state._mkInst(WEAPONS.find((weapon) => weapon.id === 'w_rust_cleaver')))
state.selectHand(0)
state.switchToEquip(0)
const monster = state.board.find((card) => card.type === 'monster')
monster.flipped = true
state.dispatch(command(COMMANDS.ARM_WEAPON, { slotIdx: 0 }))
const hpBefore = monster.monsterHp
state.dispatch(command(COMMANDS.ATTACK, { uid: monster.uid }))
const attackResolution = state.resolutionHistory.findLast((entry) => entry.name === 'attack')
assert.ok(attackResolution)
assert.deepEqual(attackResolution.trace.map((entry) => entry.id), [
  'attack:strike:0:damage',
  'attack:strike:0:durability',
  'attack:strike:0:log',
  'attack:retaliation',
  'attack:strike:0:secondary',
  'attack:death',
  'attack:consume-buff',
  'attack:finish',
  'attack:monster-threat',
])
assert.ok(monster.monsterHp < hpBefore)

const waitCommandState = new GameState()
assert.equal(waitCommandState.dispatch(command(COMMANDS.WAIT_TURN)).ok, true)
assert.equal(waitCommandState.turn, 1)

console.log('phase1-check passed')
