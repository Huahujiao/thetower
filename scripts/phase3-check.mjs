import assert from 'node:assert/strict'
import { BAG_SHAPES, ITEMS, POTIONS, WEAPONS } from '../src/data/cards.js'
import { BAG_COLUMNS, BAG_ROWS, BackpackGrid, rotateShape } from '../src/game/model/backpack.js'
import { GameState } from '../src/game/state.js'

assert.deepEqual(rotateShape(BAG_SHAPES.LONG2, 1), [[1, 1]])
const bag = new BackpackGrid(4, 3)
const first = { uid: 'first', def: { shape: BAG_SHAPES.LONG3 } }
const second = { uid: 'second', def: { shape: BAG_SHAPES.LONG2 } }
assert.ok(bag.add(first))
assert.ok(bag.add(second))
assert.equal(bag.usedCells, 5)
assert.equal(bag.rotate(first), false) // second item blocks the horizontal footprint
bag.removeByUid(second.uid)
assert.equal(bag.rotate(first), true)
assert.equal(bag.placementOf(first).rotation, 1)
assert.equal(bag.move(first, 2, 1), false) // rotated 3×1 footprint would leave the grid
assert.equal(bag.canFit({ uid: 'third', def: { shape: BAG_SHAPES.LONG4 } }), true)

const state = new GameState()
assert.equal(state.inventory.columns, BAG_COLUMNS)
assert.equal(state.inventory.rows, BAG_ROWS)
const backpackWeapon = state._mkInst(WEAPONS.find((weapon) => weapon.id === 'w_rust_knife'))
assert.ok(state.addToHand(backpackWeapon))
const placement = state.backpackPlacement(backpackWeapon.uid)
assert.ok(placement)
assert.equal(state.rotateBackpack(backpackWeapon.uid), true)
assert.equal(state.inventory.placementOf(backpackWeapon.uid).rotation, 1)
assert.equal(state.moveBackpack(backpackWeapon.uid, 8, 0), true)

const itemState = new GameState()
const whetstone = itemState._mkInst(ITEMS.find((item) => item.id === 'i_whetstone'))
const healingPotion = itemState._mkInst(POTIONS.find((potion) => potion.id === 'p_hp'))
assert.ok(itemState.addToHand(whetstone))
assert.ok(itemState.addToHand(healingPotion))
itemState.selectBackpack(whetstone.uid)
assert.equal(itemState.itemTargeting, true)
itemState.selectBackpack(healingPotion.uid)
assert.equal(itemState.itemTargeting, false)
itemState.selectBackpack(whetstone.uid)
itemState.removeHandByUid(whetstone.uid)
assert.equal(itemState.itemTargeting, false)

console.log('phase3-check passed')
