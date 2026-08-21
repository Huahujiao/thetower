import assert from 'node:assert/strict'
import { ENTRY_CARD, MONSTERS, POTIONS, T, TRAP_RATE, TRAPS } from '../src/data/cards.js'
import { GameState } from '../src/game/state.js'

assert.equal(TRAP_RATE, 0.04)
assert.equal(TRAPS.length, 2)

const state = new GameState()
state.player.armor = 3
let taken = state.receiveDamage(5)
assert.deepEqual(taken, { incoming: 5, absorbed: 3, healthDamage: 2 })
assert.equal(state.player.armor, 0)
assert.equal(state.player.hp, 18)
state.player.armor = 4
taken = state.receiveDamage(3, { bypassArmor: true })
assert.deepEqual(taken, { incoming: 3, absorbed: 0, healthDamage: 3 })
assert.equal(state.player.armor, 4)

const armorPotion = state._mkInst(POTIONS.find((potion) => potion.id === 'p_armor'))
assert.ok(state.addToHand(armorPotion))
state.selectBackpack(armorPotion.uid)
state.usePotion(state.selectedHand)
assert.equal(state.player.armor, 9)

const explosionState = new GameState()
explosionState.player.armor = 1
const entry = explosionState._makeCard({ type: T.ENTRY, def: ENTRY_CARD }, 0, 0, true)
const explosion = explosionState._makeCard({ type: T.TRAP, def: TRAPS.find((trap) => trap.trap === 'explosion') }, 1, 0)
const nearbyMonster = explosionState._makeCard({ type: T.MONSTER, def: MONSTERS[0] }, 2, 1, true)
nearbyMonster.monsterHp = 4
explosionState.board = [entry, explosion, nearbyMonster]
explosionState._revealCard(explosion)
assert.equal(explosion.triggered, true)
assert.equal(explosionState.isConsumed(explosion), true)
assert.equal(explosionState.player.armor, 0)
assert.equal(explosionState.player.hp, 19)
assert.equal(nearbyMonster.monsterHp, 2)

const soundState = new GameState()
const soundEntry = soundState._makeCard({ type: T.ENTRY, def: ENTRY_CARD }, 0, 0, true)
const sound = soundState._makeCard({ type: T.TRAP, def: TRAPS.find((trap) => trap.trap === 'sound') }, 1, 0)
const soundMonster = soundState._makeCard({ type: T.MONSTER, def: MONSTERS[0] }, 2, 0)
const otherCard = soundState._makeCard({ type: T.ENTRY, def: ENTRY_CARD }, 2, 1)
soundState.player.san = 10
soundState.board = [soundEntry, sound, soundMonster, otherCard]
const reveal = soundState._revealCard(sound)
assert.equal(soundMonster.flipped, true)
assert.equal(otherCard.flipped, false)
assert.equal(soundState.player.san, 9)
assert.equal(reveal.noAttackUids.has(soundMonster.uid), true)
assert.equal(soundState.isConsumed(sound), true)

console.log('phase4-check passed')
