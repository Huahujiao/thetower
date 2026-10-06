import assert from 'node:assert/strict'
import { StaminaDeck } from '../src/game/model/stamina-deck.js'
import { GameRun, SAVE_VERSION } from '../src/game/run.js'
import { ALL_ITEM_DEFS, makeItemById, randomNeutralItem, randomConsumableOfTier } from '../src/game/data/content.js'
import { attributeModifier, ATTRIBUTE_ORDER } from '../src/game/data/attributes.js'
import { fixture, add, select, enemy, settleAnimations } from './item-test-helpers.mjs'

function hand(run, attributes) {
  run.staminaDeck.discardHand()
  for (const attribute of attributes) {
    const index = run.staminaDeck.drawPile.findIndex(ball => ball.attribute === attribute)
    const pile = index >= 0 ? run.staminaDeck.drawPile : run.staminaDeck.discardPile
    const at = index >= 0 ? index : pile.findIndex(ball => ball.attribute === attribute)
    assert(at >= 0, attribute)
    run.staminaDeck.hand.push(...pile.splice(at, 1))
  }
}
function strike(run, weapon, target) {
  select(run, weapon)
  const before = target.hp
  assert(run._attack(target))
  run.bus.emit('animate:attack-complete', { actor: 'player' })
  settleAnimations(run)
  return before - target.hp
}
function restore(data, accepted = true) {
  let raw = JSON.stringify(data), discarded = false
  globalThis.localStorage = { getItem: () => raw, setItem: (_key, value) => { raw = value }, removeItem: () => { discarded = true } }
  try {
    const run = new GameRun({ random: () => 0.99 })
    assert.equal(run._loaded, accepted)
    assert.equal(discarded, !accepted)
    return run
  } finally { delete globalThis.localStorage }
}

// A physical deck: no held ball can be drawn twice, including across reshuffles.
{
  const deck = new StaminaDeck(() => 0.37)
  assert.deepEqual(deck.composition(), { scorch: 10, wither: 10, drown: 10, wild: 2 })
  assert.equal(deck.draw(31).length, 31)
  const held = deck.hand.map(ball => ball.id)
  const spent = deck.pay(5)
  assert.equal(deck.draw(10).length, 6)
  assert.equal(new Set(deck.hand.map(ball => ball.id)).size, 32)
  assert.equal(deck.draw(1).length, 0)
  assert.deepEqual(deck.all.map(ball => ball.id).sort((a, b) => a - b), Array.from({ length: 32 }, (_, i) => i))
  assert(held.length === 31 && spent.cost === 5)
  assert(StaminaDeck.valid(deck.serialize()))
  deck.add('wild'); assert.equal(deck.composition().wild, 3)
  assert(StaminaDeck.valid(deck.serialize()))
  assert.deepEqual(new StaminaDeck(() => 0, deck.serialize()).serialize(), deck.serialize())
}
// Matching, wildcard, deliberately selected off-color, insufficient and atomic refunds.
{
  const run = fixture()
  hand(run, ['scorch', 'scorch', 'wild', 'drown'])
  assert.equal(run.staminaDeck.plan(3, 'scorch').multiplier, 1)
  run.staminaDeck.toggle(run.staminaDeck.hand[3].id)
  const plan = run.staminaDeck.pay(3, 'scorch')
  assert.equal(plan.multiplier, 0.5)
  assert.equal(run.player.energy, 1)
  const snapshot = run.staminaDeck.serialize()
  assert.equal(run.staminaDeck.pay(2), null)
  assert.deepEqual(run.staminaDeck.serialize(), snapshot)
  run.staminaDeck.refund(plan.balls)
  assert.equal(run.player.energy, 4)
  assert(StaminaDeck.valid(run.staminaDeck.serialize()))
}
// First enemy 6; each newly revealed enemy +2 once; deaths change next turn only.
{
  const run = fixture(), first = enemy(run), extra = enemy(run, { pos: { c: 3, r: 4 } })
  run.currentRoom.tile(extra.pos).revealed = false
  run._synchronizeBattle(); assert.equal(run.player.energy, 6)
  assert(run.clickTile(extra.pos.c, extra.pos.r)); assert.equal(run.player.energy, 7)
  run._synchronizeBattle(); assert.equal(run.player.energy, 7)
  run.currentRoom.removeEntity(first.id); run._synchronizeBattle(); assert.equal(run.player.energy, 7)
  assert(run.endPlayerTurn()); assert.equal(run.player.energy, 0)
  settleAnimations(run); assert.equal(run.player.energy, 6)
  assert.equal(run.battle.round, 2)
  assert(run._spendEnergy(6)); assert.equal(run.roundResolving, false)
  assert.equal(run.battle.stage, 'player')
  run.currentRoom.removeEntity(extra.id); run._synchronizeBattle()
  assert.equal(run.battle.active, false); assert.equal(run.player.energy, 0)
  assert(run._payAction(1)); assert.equal(run.player.energy, 0)
}
// Instance repeat costs survive switching/organizing/load, reset only on next turn.
{
  const run = fixture(), a = add(run, 'rust-sword'), b = add(run, 'rust-sword'), target = enemy(run)
  run._synchronizeBattle(); a.energyCost = b.energyCost = 1
  hand(run, Array(8).fill(a.attribute))
  assert.equal(run.weaponEnergyCost(a), 1)
  strike(run, a, target); assert.equal(run.weaponEnergyCost(a), 2)
  strike(run, b, target); assert.equal(run.weaponEnergyCost(a), 2); assert.equal(run.weaponEnergyCost(b), 2)
  strike(run, a, target); assert.equal(run.weaponEnergyCost(a), 3)
  run.itemRules.action('organize'); assert.equal(run.weaponEnergyCost(a), 3)
  const loaded = restore(run.serialize())
  assert.deepEqual(loaded.staminaDeck.serialize(), run.staminaDeck.serialize())
  assert.equal(loaded.weaponEnergyCost(loaded.backpack.items.find(item => item.uid === a.uid)), 3)
  assert(run.endPlayerTurn()); settleAnimations(run); assert.equal(run.weaponEnergyCost(a), 1)
}
// Seal uses the previous big turn, never the immediately preceding attack.
{
  const run = fixture(), a = add(run, 'rust-sword'), b = add(run, 'rust-sword'), target = enemy(run)
  add(run, 'r-single-seal'); run._synchronizeBattle(); a.energyCost = b.energyCost = 1
  hand(run, Array(7).fill(a.attribute))
  strike(run, a, target); strike(run, b, target)
  assert.equal(run.weaponEnergyCost(a), 2) // no previous player-turn attack
  assert(run.endPlayerTurn()); settleAnimations(run)
  assert.equal(run.weaponEnergyCost(a), 3); assert.equal(run.weaponEnergyCost(b), 1)
  hand(run, Array(7).fill(a.attribute)); strike(run, b, target); strike(run, b, target)
  assert.equal(run.weaponEnergyCost(b), 1)
  assert(run.endPlayerTurn()); settleAnimations(run)
  assert(run.endPlayerTurn()); settleAnimations(run) // a whole turn without attacks
  assert.equal(run.weaponEnergyCost(a), 1)
}
// Off-color reduces the full main hit; counter relationships no longer exist.
{
  const run = fixture(), weapon = add(run, 'rust-sword'), target = enemy(run)
  run._synchronizeBattle(); weapon.energyCost = 1; weapon.attack = 8
  hand(run, [weapon.attribute]); assert.equal(strike(run, weapon, target), 8)
  hand(run, ['wild', 'wild']); assert.equal(strike(run, weapon, target), 8)
  const other = ATTRIBUTE_ORDER.find(attribute => attribute !== weapon.attribute)
  hand(run, [other, other, other]); assert.equal(strike(run, weapon, target), 4)
  for (const a of ATTRIBUTE_ORDER) for (const b of ATTRIBUTE_ORDER) assert.deepEqual(attributeModifier(a, b), { multiplier: 1, countered: false, resisted: false })
  hand(run, []); const uses = { ...run.itemRules.state.weaponUses }
  assert.equal(run._attack(target), false); assert.deepEqual(run.itemRules.state.weaponUses, uses)
}
// Pets share leftover balls, regardless of color and backpack adjacency; potion stays intact.
{
  const run = fixture(); add(run, 'mountain-hound'); add(run, 'mountain-hound'); const potion = add(run, 'health-potion')
  const target = enemy(run); run._synchronizeBattle(); hand(run, ['scorch'])
  let hits = 0; run.on('pet:attacked', () => hits++)
  assert(run.endPlayerTurn()); assert.equal(hits, 1); assert.equal(target.hp, 96)
  assert.equal(potion.heal, makeItemById('health-potion').heal)
  assert.equal(run.player.energy, 0); settleAnimations(run); assert.equal(run.player.energy, 6)
}
{
  const run = fixture(); add(run, 'carrion-rat'); enemy(run, { hp: 1 }); enemy(run, { pos: { c: 3, r: 4 } })
  run._synchronizeBattle(); hand(run, ['drown'])
  const id = run.staminaDeck.hand[0].id
  run.battle.stage = 'pets'; run.pets.act()
  assert.deepEqual(run.staminaDeck.hand.map(ball => ball.id), [id])
  assert(StaminaDeck.valid(run.staminaDeck.serialize()))
}
// No food can enter any active loot pool. New saves preserve ordering; old saves reset.
{
  const run = fixture(), badge = add(run, 'r-totem-drum')
  const before = run.staminaDeck.composition()
  run.phase = 'level-up'; run.player.experience = run.player.experienceToNext
  run.levelUp = { choices: ['wild-ball', 'heal', 'max-health'] }
  assert(run.chooseLevelUpOption('wild-ball'))
  assert.equal(run.staminaDeck.composition().wild, before.wild + 1)
  assert.equal(run.player.energy, 0)
  select(run, badge); assert(run.useSelected()); assert(run.clickTile(2, 3))
  assert.equal(run.staminaDeck.nextId, 33)
  assert.equal(run.player.energy, 0)
  const loaded = restore(run.serialize()); assert(loaded.totems.active('drum'))
  enemy(run); run._synchronizeBattle(); assert.equal(run.player.energy, 6)
  select(run, badge); assert.equal(run.useSelected(), false)
  assert.equal(run.player.energy, 6)
}
{
  const run = fixture(); enemy(run); enemy(run, { pos: { c: 3, r: 4 }, downed: true, reviveTurns: 2 })
  run._synchronizeBattle(); assert.equal(run.player.energy, 8)
  assert(run.endPlayerTurn()); settleAnimations(run); assert.equal(run.player.energy, 8)
  const loaded = restore(run.serialize()); assert.equal(loaded.player.energy, 8)
  loaded._synchronizeBattle(); assert.equal(loaded.player.energy, 8)
}
assert(!ALL_ITEM_DEFS.some(item => item.type === 'energy' || item.id === 'r-vampire-fang'))
for (let i = 0; i < 100; i++) {
  assert.notEqual(randomNeutralItem(1).type, 'energy')
  assert.notEqual(randomConsumableOfTier(1).type, 'energy')
}
{
  const run = fixture(), target = enemy(run); run._synchronizeBattle()
  run.toggleStaminaBall(run.staminaDeck.hand[0].id)
  assert.deepEqual(restore(run.serialize()).staminaDeck.serialize(), run.staminaDeck.serialize())
  const old = run.serialize(); old.version = SAVE_VERSION - 1
  const fresh = restore(old, false); assert.equal(fresh.staminaDeck.nextId, 32); assert.equal(fresh.battle.active, false)
  target.hp = 99
  run.endPlayerTurn(); const data = run.serialize()
  const loaded = restore(data); assert.equal(loaded.battle.round, 2); assert.equal(loaded.player.energy, 6)
  assert.equal(loaded.currentRoom.entity(target.id).hp, 99)
}
console.log('stamina-deck-check passed: deck conservation, supply, payment, repeat costs, seal, pets, fresh saves')
