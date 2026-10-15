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
function rejectStrike(run, weapon, target) {
  select(run, weapon)
  const deck = run.staminaDeck.serialize(), hp = target.hp
  const uses = { ...run.itemRules.state.weaponUses }, power = run.player.lastAttackPower
  let attacks = 0
  const off = run.on('animate:attack', () => attacks++)
  assert.equal(run._attack(target), false)
  off()
  assert.deepEqual(run.staminaDeck.serialize(), deck)
  assert.deepEqual(run.itemRules.state.weaponUses, uses)
  assert.equal(run.player.lastAttackPower, power)
  assert.equal(target.hp, hp)
  assert.equal(attacks, 0)
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
// Automatic payments consume eligible flames strictly from right to left.
{
  const run = fixture()
  enemy(run); run._synchronizeBattle()
  hand(run, ['scorch', 'scorch', 'scorch', 'drown', 'wild'])
  const deck = run.staminaDeck, ids = deck.hand.map(ball => ball.id)
  const before = deck.serialize()
  assert.deepEqual(deck.plan(2).balls.map(ball => ball.id), [ids[4], ids[3]], 'Neither color counts nor wildcard preservation may override position')
  assert.deepEqual(deck.serialize(), before, 'A payment preview must not reorder the hand')
  deck.toggle(ids[0])
  assert.deepEqual(deck.plan(2).balls.map(ball => ball.id), [ids[0], ids[4]], 'Manual selection keeps priority')
  assert.deepEqual(deck.plan(2, null, { selection: false }).balls.map(ball => ball.id), [ids[4], ids[3]])
  deck.toggle(ids[0])
  assert.deepEqual(deck.plan(3, 'scorch').balls.map(ball => ball.id), [ids[4], ids[2], ids[1]], 'Attribute payments skip ineligible flames while scanning from the right')
  const events = []
  const off = run.on('stamina:spent', ({ balls }) => events.push(balls.map(ball => ball.id)))
  assert.deepEqual(deck.pay(2).balls.map(ball => ball.id), [ids[4], ids[3]])
  assert.deepEqual(events, [[ids[4], ids[3]]])
  assert.deepEqual(deck.hand.map(ball => ball.id), ids.slice(0, 3))
  off()
}
// Insufficient matching payments are atomic; selected off-color balls cannot fill a gap.
{
  const run = fixture()
  enemy(run); run._synchronizeBattle()
  hand(run, ['scorch', 'scorch', 'drown', 'drown'])
  assert.equal(run.staminaDeck.plan(3, 'scorch'), null)
  run.staminaDeck.toggle(run.staminaDeck.hand[2].id)
  const before = run.staminaDeck.serialize()
  assert.equal(run.staminaDeck.pay(3, 'scorch'), null)
  assert.deepEqual(run.staminaDeck.serialize(), before)
  const plan = run.staminaDeck.pay(2, 'scorch')
  assert.equal(plan.paid, 2)
  assert.deepEqual(run.staminaDeck.hand.map(ball => ball.attribute), ['drown', 'drown'])
  const snapshot = run.staminaDeck.serialize()
  assert.equal(run.staminaDeck.pay(3), null)
  assert.equal(run.staminaDeck.pay(3, 'scorch'), null)
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
// Outside combat, no held balls or weapon selection may survive state synchronization.
{
  const run = fixture(), weapon = add(run, 'rust-sword')
  weapon.energyCost = 2
  const index = run.backpack.originIndex(run.backpack.placementOf(weapon.uid))
  hand(run, [weapon.attribute, weapon.attribute])
  run.staminaDeck.toggle(run.staminaDeck.hand[0].id)
  assert.equal(run.selectInventory(index), false, 'Even a stale affordable hand cannot allow weapon selection outside combat')
  select(run, weapon)
  run._synchronizeBattle()
  assert.equal(run.player.energy, 0)
  assert.deepEqual(run.staminaDeck.selected, [])
  assert.equal(run.selectedItem, null)
  run.staminaDeck.draw(2)
  run._changed()
  assert.equal(run.player.energy, 0, 'Noncombat state updates must clear residual draws')
  run.staminaDeck.refund([run.staminaDeck.discardPile.at(-1)])
  assert.equal(run.player.energy, 0, 'A delayed refund must not leave balls outside combat')
  const target = enemy(run)
  run._synchronizeBattle()
  assert.equal(run.player.energy, 6)
  hand(run, Array(4).fill(weapon.attribute))
  assert(run.selectInventory(index))
  run.currentRoom.removeEntity(target.id)
  run._synchronizeBattle()
  assert.equal(run.battle.active, false)
  assert.equal(run.player.energy, 0)
  assert.equal(run.selectedItem, null, 'Ending combat must immediately clear the weapon highlight')
  assert.equal(run.selectInventory(index), false)
  assert(StaminaDeck.valid(run.staminaDeck.serialize()), 'Clearing the hand must preserve the physical deck')
  enemy(run)
  run._synchronizeBattle()
  assert.equal(run.player.energy, 6, 'The next combat must still draw normally')
}
// Repeated attacks never increase the weapon cost.
{
  const run = fixture(), a = add(run, 'rust-sword'), b = add(run, 'rust-sword'), target = enemy(run)
  run._synchronizeBattle(); a.energyCost = b.energyCost = 1
  hand(run, Array(8).fill(a.attribute))
  assert.equal(run.weaponEnergyCost(a), 1)
  strike(run, a, target); assert.equal(run.weaponEnergyCost(a), 1)
  strike(run, b, target); assert.equal(run.weaponEnergyCost(a), 1); assert.equal(run.weaponEnergyCost(b), 1)
  strike(run, a, target); assert.equal(run.weaponEnergyCost(a), 1)
  run.itemRules.action('organize'); assert.equal(run.weaponEnergyCost(a), 1)
  const loaded = restore(run.serialize())
  assert.deepEqual(loaded.staminaDeck.serialize(), run.staminaDeck.serialize())
  assert.equal(loaded.weaponEnergyCost(loaded.backpack.items.find(item => item.uid === a.uid)), 1)
  assert(run.endPlayerTurn()); settleAnimations(run); assert.equal(run.weaponEnergyCost(a), 1)
}
// Seal discounts each used instance by exactly one, survives switches, and resets next turn.
{
  const run = fixture(), a = add(run, 'rust-sword'), b = add(run, 'rust-sword'), target = enemy(run)
  const seal = add(run, 'r-single-seal'); run._synchronizeBattle(); a.energyCost = b.energyCost = 3
  hand(run, Array(10).fill(a.attribute))
  assert.equal(run.weaponEnergyCost(a), 3)
  strike(run, a, target); assert.equal(run.weaponEnergyCost(a), 2); assert.equal(run.weaponEnergyCost(b), 3)
  strike(run, b, target); assert.equal(run.weaponEnergyCost(a), 2); assert.equal(run.weaponEnergyCost(b), 2)
  strike(run, a, target); assert.equal(run.weaponEnergyCost(a), 2)
  run.itemRules.action('organize'); assert.equal(run.weaponEnergyCost(a), 2)
  const loaded = restore(run.serialize())
  assert.equal(loaded.weaponEnergyCost(loaded.backpack.items.find(item => item.uid === a.uid)), 2)
  run.backpack.removeByUid(seal.uid); assert.equal(run.weaponEnergyCost(a), 3)
  assert(run.backpack.add(seal)); a.energyCost = 1; assert.equal(run.weaponEnergyCost(a), 1)
  a.energyCost = 3
  assert(run.endPlayerTurn()); settleAnimations(run)
  assert.equal(run.weaponEnergyCost(a), 3); assert.equal(run.weaponEnergyCost(b), 3)
}
// Attacks require the full matching/wildcard cost; rejected attacks spend nothing and have no effects.
{
  const run = fixture(), weapon = add(run, 'rust-sword'), target = enemy(run)
  run._synchronizeBattle(); weapon.energyCost = 3; weapon.attack = 9
  hand(run, [weapon.attribute, weapon.attribute]); rejectStrike(run, weapon, target)
  hand(run, [weapon.attribute, weapon.attribute, 'wild']); assert.equal(strike(run, weapon, target), 9)
  const other = ATTRIBUTE_ORDER.find(attribute => attribute !== weapon.attribute)
  hand(run, [weapon.attribute, other, other]); rejectStrike(run, weapon, target)
  hand(run, [weapon.attribute, weapon.attribute, other, other, other]); rejectStrike(run, weapon, target)
  run.itemRules.startPlayerTurn()
  hand(run, [weapon.attribute, weapon.attribute, 'wild', other]); assert.equal(strike(run, weapon, target), 9)
  assert.deepEqual(run.staminaDeck.hand.map(ball => ball.attribute), [other])
  for (const a of ATTRIBUTE_ORDER) for (const b of ATTRIBUTE_ORDER) assert.deepEqual(attributeModifier(a, b), { multiplier: 1, countered: false, resisted: false })
  hand(run, []); rejectStrike(run, weapon, target)
}
// Auto-approach requires enough total balls for both movement and the full attack.
{
  const run = fixture(), weapon = add(run, 'rust-sword'), target = enemy(run, { pos: { c: 5, r: 3 } })
  run._synchronizeBattle(); weapon.energyCost = 3; weapon.attack = 9; weapon.range = 1
  const position = { ...run.player.pos }
  hand(run, Array(3).fill(weapon.attribute)); rejectStrike(run, weapon, target)
  assert.deepEqual(run.player.pos, position)
  hand(run, Array(4).fill(weapon.attribute)); assert.equal(strike(run, weapon, target), 9)
  assert.equal(run.player.energy, 0)
  assert.notDeepEqual(run.player.pos, position)
}
// Weapon highlights reserve the exact affordable payment while moving from right to left.
{
  const run = fixture(), weapon = add(run, 'rust-sword'), target = enemy(run, { pos: { c: 5, r: 3 } })
  run._synchronizeBattle()
  weapon.energyCost = 2; weapon.range = 1
  const other = ATTRIBUTE_ORDER.find(attribute => attribute !== weapon.attribute)
  run.player.pos = { c: 2, r: 3 }
  hand(run, [other, other, weapon.attribute, 'wild'])
  const ids = run.staminaDeck.hand.map(ball => ball.id)
  assert.deepEqual(run.staminaPaymentPreview().balls.map(ball => ball.id), [ids[3]])
  select(run, weapon)
  assert.deepEqual(run.staminaPaymentPreview().balls.map(ball => ball.id), [ids[3], ids[2]])
  const payments = []
  run.on('stamina:spent', ({ balls }) => payments.push(balls.map(ball => ball.id)))
  assert.equal(strike(run, weapon, target), weapon.attack)
  assert.deepEqual(payments, [[ids[1]], [ids[0]], [ids[3], ids[2]]], 'Approach must spend other flames before the exact highlighted attack payment')
  hand(run, [other, other, weapon.attribute])
  assert.equal(run.selectedItem, null, 'An exhausted weapon must be deselected')
  assert.equal(run.staminaPaymentPreview().balls[0].id, run.staminaDeck.hand.at(-1).id)
  rejectStrike(run, weapon, target)
}
// Independent movement protects the automatic weapon payment.
{
  const run = fixture(), weapon = add(run, 'rust-sword')
  enemy(run); run._synchronizeBattle(); weapon.energyCost = 2
  const other = ATTRIBUTE_ORDER.find(attribute => attribute !== weapon.attribute)
  hand(run, [other, other, weapon.attribute, weapon.attribute])
  select(run, weapon)
  const highlighted = run.staminaPaymentPreview().balls.map(ball => ball.id)
  assert.equal(run.toggleStaminaBall(highlighted[0]), false)
  assert(run.clickTile(3, 2)); settleAnimations(run)
  assert.deepEqual(run.staminaPaymentPreview().balls.map(ball => ball.id), highlighted)
  assert(run.staminaDeck.hand.some(ball => ball.attribute === other))
  const before = run.staminaDeck.serialize()
  assert.equal(run.staminaDeck.plan(2, null, { exclude: highlighted }), null)
  assert.deepEqual(run.staminaDeck.serialize(), before)
}
// The public selection API enforces affordability, one manual ball and weapon locks.
{
  const run = fixture(), weapon = add(run, 'rust-sword'), target = enemy(run)
  run._synchronizeBattle(); weapon.energyCost = 2
  const other = ATTRIBUTE_ORDER.find(attribute => attribute !== weapon.attribute)
  const index = () => run.backpack.originIndex(run.backpack.placementOf(weapon.uid))
  hand(run, [other, weapon.attribute])
  const manualId = run.staminaDeck.hand[0].id
  assert(run.toggleStaminaBall(manualId))
  const before = run.staminaDeck.serialize()
  let changes = 0
  const off = run.on('change', () => changes++)
  assert.equal(run.selectInventory(index()), false)
  assert.equal(run.selectedItem, null)
  assert.deepEqual(run.staminaDeck.serialize(), before)
  assert.equal(changes, 0, 'An unaffordable weapon click must have no effect')
  off()
  hand(run, [weapon.attribute, weapon.attribute, weapon.attribute, other, 'wild'])
  const ids = run.staminaDeck.hand.map(ball => ball.id)
  assert(run.toggleStaminaBall(ids[0]))
  assert(run.toggleStaminaBall(ids[1]))
  assert.deepEqual(run.staminaDeck.selected, [ids[1]], 'Manual selection must switch rather than accumulate')
  assert(run.toggleStaminaBall(ids[1]))
  assert.deepEqual(run.staminaDeck.selected, [])
  assert(run.toggleStaminaBall(ids[0]))
  assert(run.selectInventory(index()))
  assert.deepEqual(run.staminaDeck.selected, [], 'Selecting a weapon clears the manual ball')
  const expensive = add(run, 'rust-sword')
  expensive.energyCost = 6
  assert.equal(run.selectInventory(run.backpack.originIndex(run.backpack.placementOf(expensive.uid))), false)
  assert.equal(run.selectedItem, weapon, 'An unaffordable switch must preserve the current weapon')
  assert.deepEqual(run.weaponPayment(weapon).balls.map(ball => ball.id), [ids[4], ids[2]])
  assert.equal(run.toggleStaminaBall(ids[0]), false)
  assert.equal(run.toggleStaminaBall(ids[3]), false)
  const payments = []
  run.on('stamina:spent', ({ balls }) => payments.push(balls.map(ball => ball.id)))
  strike(run, weapon, target)
  assert.deepEqual(payments[0], [ids[4], ids[2]], 'Attack order is fixed right-to-left even with surplus matching balls')
  assert.equal(run.selectedItem, weapon, 'An affordable weapon remains selected')
  strike(run, weapon, target)
  assert.equal(run.selectedItem, null, 'An unaffordable weapon is deselected immediately after payment')
  assert.deepEqual(run.staminaDeck.selected, [])
}
// Forced losses and cost changes invalidate selection; refunds do not reselect weapons.
{
  const run = fixture(), weapon = add(run, 'rust-sword')
  enemy(run); run._synchronizeBattle(); weapon.energyCost = 2
  const index = run.backpack.originIndex(run.backpack.placementOf(weapon.uid))
  hand(run, [weapon.attribute, 'wild'])
  assert(run.selectInventory(index))
  const payment = run.staminaDeck.pay(1, weapon.attribute, { selection: false })
  assert.equal(run.selectedItem, null)
  run.staminaDeck.refund(payment.balls)
  assert.equal(run.selectedItem, null)
  assert(run.selectInventory(index))
  run.applyStatus(run.player, 'fatigue', { layers: 1 })
  assert.equal(run.selectedItem, null)
  hand(run, [weapon.attribute, weapon.attribute])
  assert(run.selectInventory(index))
  weapon.energyCost = 3
  run._changed()
  assert.equal(run.selectedItem, null)
}
// Movement, flipping and on-the-spot pickup share the exact untyped payment rule.
for (const action of ['move', 'flip', 'pickup']) for (const armed of [false, true]) {
  const run = fixture(), weapon = add(run, 'rust-sword')
  enemy(run); run._synchronizeBattle(); weapon.energyCost = 2
  const other = ATTRIBUTE_ORDER.find(attribute => attribute !== weapon.attribute)
  hand(run, [other, weapon.attribute, other, weapon.attribute, 'wild'])
  const ids = run.staminaDeck.hand.map(ball => ball.id)
  if (armed) assert(run.selectInventory(run.backpack.originIndex(run.backpack.placementOf(weapon.uid))))
  else assert(run.toggleStaminaBall(ids[0]))
  const payments = []
  run.on('stamina:spent', ({ balls }) => payments.push(...balls.map(ball => ball.id)))
  if (action === 'move') assert(run.clickTile(3, 2))
  else if (action === 'flip') {
    run.currentRoom.tile({ c: 2, r: 3 }).revealed = false
    assert(run.clickTile(2, 3))
  } else {
    run.currentRoom.addEntity({ id: 'selection-gold', kind: 'gold', pos: { ...run.player.pos }, amount: 1 })
    assert(run.clickTile(3, 3))
    assert.equal(run.currentRoom.entity('selection-gold'), null)
  }
  assert.deepEqual(payments, [armed ? ids[2] : ids[0]], action + ' must skip weapon balls or use the single manual ball')
  assert.deepEqual(run.staminaDeck.selected, [])
  if (armed) assert.deepEqual(run.weaponPayment(weapon).balls.map(ball => ball.id), [ids[4], ids[3]])
  else {
    assert(run._payAction(1))
    assert.equal(payments.at(-1), ids[4], 'Once the manual ball is spent, payment returns to the right edge')
  }
}
// Reserved balls are never a fallback for an untyped action.
{
  const run = fixture(), weapon = add(run, 'rust-sword')
  enemy(run); run._synchronizeBattle(); weapon.energyCost = 2
  hand(run, [weapon.attribute, 'wild'])
  const index = run.backpack.originIndex(run.backpack.placementOf(weapon.uid))
  assert(run.selectInventory(index))
  const before = run.staminaDeck.serialize(), position = { ...run.player.pos }
  assert.equal(run.canPayAction(1), false)
  assert.equal(run._payAction(1), false)
  run.clickTile(3, 2)
  assert.deepEqual(run.player.pos, position)
  assert.deepEqual(run.staminaDeck.serialize(), before)
  assert.equal(run.selectedItem, weapon)
  assert(run.selectInventory(index))
  assert.equal(run.selectedItem, null)
  assert(run.clickTile(3, 2))
  assert.notDeepEqual(run.player.pos, position)
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
