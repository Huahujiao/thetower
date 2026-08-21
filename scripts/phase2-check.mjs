import assert from 'node:assert/strict'
import { GameState } from '../src/game/state.js'
import { WEAPONS, GRIP } from '../src/data/cards.js'
import { WeaponLoadout } from '../src/game/model/loadout.js'

const oneHand = WEAPONS.find((weapon) => weapon.id === 'w_rust_cleaver')
const secondOneHand = WEAPONS.find((weapon) => weapon.id === 'w_rust_knife')
const twoHand = WEAPONS.find((weapon) => weapon.id === 'w_greatsword')
assert.equal(oneHand.grip, GRIP.ONE)
assert.equal(twoHand.grip, GRIP.TWO)

const loadout = new WeaponLoadout(2)
const greatsword = { def: twoHand, uid: 'two-hand-test', curDur: twoHand.dur, maxDur: twoHand.dur, tags: twoHand.tags.slice() }
assert.equal(loadout.equip(greatsword, 0).ok, true)
assert.equal(loadout.items.length, 1)
assert.equal(loadout.slots[0], null)
assert.equal(loadout.slots[1], greatsword)
assert.equal(loadout.isUnavailable(0), true)
assert.equal(loadout.isUnavailable(1), false)
assert.equal(loadout.firstAvailableHand({ def: oneHand }), -1)

const state = new GameState()
assert.equal(state.hand.length, 0)
assert.equal(state.equip[0].def.id, 'w_rust_cleaver')
assert.equal(state.equip[1], null)
const left = state._mkInst(oneHand)
const right = state._mkInst(secondOneHand)
state.equipment.equip(left, 0)
state.equipment.equip(right, 1)
assert.equal(state.equipment.items.length, 2)
assert.equal(state.equip[0], left)
assert.equal(state.equip[1], right)

const monster = state.board.find((card) => card.type === 'monster')
monster.flipped = true
monster.monsterHp = 40
const leftDur = left.curDur
const rightDur = right.curDur
state.attack(monster.uid)
const attackResolution = state.resolutionHistory.findLast((entry) => entry.name === 'attack')
assert.equal(attackResolution.trace.filter((entry) => entry.id.endsWith(':damage')).length, 2)
assert.equal(attackResolution.trace.filter((entry) => entry.id === 'attack:retaliation').length, 1)
assert.equal(left.curDur, leftDur - 1)
assert.equal(right.curDur, rightDur - 1)
assert.ok(monster.monsterHp < 40)

const brokenState = new GameState()
const brokenWeapon = brokenState._mkInst(oneHand)
brokenWeapon.curDur = 0
brokenState.equipment.equip(brokenWeapon, 1)
brokenState.armWeapon(1)
assert.equal(brokenState.armedSlot, 1)
brokenState.discardEquip(1)
assert.equal(brokenState.equip[1], null)

console.log('phase2-check passed')
