import assert from 'node:assert/strict'
import { fixture, add, enemy, select, settleAnimations } from './item-test-helpers.mjs'
import { StaminaDeck } from '../src/game/model/stamina-deck.js'
import { FIRE_ENCHANTMENTS, rekindleChance } from '../src/game/data/spirit-fire.js'
import { GameRun } from '../src/game/run.js'

function battle({ cost = 1, attack = 10 } = {}) {
  const run = fixture(), weapon = add(run, 'rust-sword')
  Object.assign(weapon, { attack, energyCost: cost, attribute: 'scorch' })
  const target = enemy(run, { hp: 1000, pos: { c: 4, r: 3 } })
  run._synchronizeBattle()
  return { run, weapon, target }
}
function hand(run, specs) {
  const deck = run.staminaDeck
  deck.discardHand()
  const chosen = []
  for (const spec of specs) {
    const ball = deck.all.find(ball => !chosen.includes(ball) && (spec.id != null ? ball.id === spec.id : ball.attribute === (spec.attribute || 'scorch')))
    assert(ball, JSON.stringify(spec))
    if (Object.hasOwn(spec, 'enchantment')) ball.enchantment = spec.enchantment
    for (const key of ['drawPile', 'discardPile']) deck[key] = deck[key].filter(entry => entry !== ball)
    chosen.push(ball)
  }
  deck.hand = chosen
  return chosen
}
function strike(run, weapon, target) {
  select(run, weapon)
  const before = target.hp
  assert(run._attack(target))
  run.bus.emit('animate:attack-complete', { actor: 'player' })
  settleAnimations(run)
  return before - target.hp
}
function reload(run) {
  const previous = globalThis.localStorage
  globalThis.localStorage = { getItem: () => JSON.stringify(run.serialize()), setItem() {}, removeItem() { assert.fail('A spirit-fire save was rejected') } }
  try { const loaded = new GameRun({ random: () => .99 }); assert(loaded._loaded); return loaded } finally { globalThis.localStorage = previous }
}
const covered = new Set()
for (const [enchantment, cost, expected] of [['sharp', 1, 13], ['amplify', 1, 12], ['berserk', 1, 20]]) {
  const { run, weapon, target } = battle({ cost })
  const [ball] = hand(run, [{ enchantment }]); run.random = () => .9
  assert.equal(strike(run, weapon, target), expected, enchantment)
  assert(run.staminaDeck.all.includes(ball)); covered.add(enchantment)
}
{
  const { run, weapon, target } = battle({ cost: 3 })
  hand(run, [{ enchantment: 'sharp' }, { enchantment: 'amplify' }, { enchantment: 'berserk' }])
  run.random = () => .99
  assert.equal(strike(run, weapon, target), 31, 'Flat, additive damage multiplier, then final double, with final rounding')
}
{
  const { run, weapon, target } = battle()
  const [ball] = hand(run, [{ enchantment: 'berserk' }]); run.random = () => .249
  assert.equal(strike(run, weapon, target), 20)
  assert(!run.staminaDeck.all.some(entry => entry.id === ball.id))
  assert.equal(run.staminaDeck.all.length, 31); assert(StaminaDeck.valid(run.staminaDeck.serialize()))
  assert.equal(reload(run).staminaDeck.all.length, 31, 'Permanent destruction survives saving')
}
{
  const { run, weapon, target } = battle({ cost: 2 })
  hand(run, [{ enchantment: 'greed' }, { enchantment: 'bulwark' }])
  const before = { gold: run.player.gold, armor: run.player.armor }
  strike(run, weapon, target)
  assert.equal(run.player.gold, before.gold + 2); assert.equal(run.player.armor, before.armor + 2)
  covered.add('greed'); covered.add('bulwark')
}
{
  const { run, weapon, target } = battle({ cost: 2 })
  const balls = hand(run, [{ enchantment: 'temper' }, { enchantment: 'temper' }])
  assert.equal(strike(run, weapon, target), 12)
  assert.equal(weapon.attack, 12, 'Each paid temper flame reinforces the weapon')
  hand(run, balls); strike(run, weapon, target); assert.equal(weapon.attack, 14, 'Repeated attacks in one turn keep reinforcing')
  run.endPlayerTurn(); settleAnimations(run)
  hand(run, balls); strike(run, weapon, target); assert.equal(weapon.attack, 16)
  const saved = reload(run)
  const savedWeapon = saved.backpack.items.find(item => item.uid === weapon.uid)
  hand(saved, balls); strike(saved, savedWeapon, saved.currentRoom.entity(target.id))
  assert.equal(savedWeapon.attack, 18, 'Loading a save does not introduce a temper limit')
  run._damageEnemy(target, 5000); run._endTurn(); settleAnimations(run)
  const next = enemy(run, { hp: 1000 }); run._synchronizeBattle()
  hand(run, balls); strike(run, weapon, next); assert.equal(weapon.attack, 18, 'Every trigger also works in a new battle')
  covered.add('temper')
}
{
  const { run, weapon, target } = battle()
  const [ball] = hand(run, [{ enchantment: 'rekindle' }])
  for (let count = 0; count < 5; count++) {
    assert.equal(rekindleChance(ball), (50 - count * 10) / 100)
    run.random = () => 0
    assert.equal(strike(run, weapon, target), 10)
    assert(run.staminaDeck.hand.includes(ball)); assert.equal(ball.rekindleReturns, count + 1)
  }
  assert.equal(rekindleChance(ball), 0)
  strike(run, weapon, target); assert(!run.staminaDeck.hand.includes(ball))
  const loaded = reload(run)
  assert.equal(loaded.staminaDeck.all.find(entry => entry.id === ball.id).rekindleReturns, 5)
  assert.equal(rekindleChance(loaded.staminaDeck.all.find(entry => entry.id === ball.id)), 0, 'Loading within a turn must preserve probability decay')
  const others = run.staminaDeck.drawPile.filter(entry => entry.id !== ball.id).slice(0, 2)
  others.forEach(entry => Object.assign(entry, { enchantment: 'rekindle', rekindleReturns: 3 }))
  hand(run, [others[0]])
  assert(run.staminaDeck.hand.includes(others[0])); assert(run.staminaDeck.drawPile.includes(others[1])); assert(run.staminaDeck.discardPile.includes(ball))
  assert(run.endPlayerTurn()); settleAnimations(run)
  for (const entry of [ball, ...others]) assert.equal(rekindleChance(entry), .5, 'A new turn resets flames from all three piles')
  hand(run, [ball]); strike(run, weapon, target)
  assert.equal(rekindleChance(ball), .4, 'A fresh turn permits another return at 50%')
  assert(run.staminaDeck.hand.includes(ball))
  covered.add('rekindle')
}
{
  const { run, weapon, target } = battle({ cost: 2 })
  const balls = hand(run, [{ enchantment: 'leech' }, { enchantment: 'leech' }])
  run.player.hp = 10
  strike(run, weapon, target); assert.equal(run.player.hp, 12, 'Each consumed leech heals independently')
  hand(run, balls); strike(run, weapon, target); assert.equal(run.player.hp, 14, 'Repeated attacks in one turn keep healing')
  const saved = reload(run), savedWeapon = saved.backpack.items.find(item => item.uid === weapon.uid)
  hand(saved, balls); strike(saved, savedWeapon, saved.currentRoom.entity(target.id)); assert.equal(saved.player.hp, 16)
  run.endPlayerTurn(); settleAnimations(run)
  hand(run, balls); strike(run, weapon, target); assert.equal(run.player.hp, 16)
  covered.add('leech')
}
{
  const { run, weapon, target } = battle({ attack: 0 })
  const [ball] = hand(run, [{ enchantment: 'leech' }]); run.player.hp = 10
  strike(run, weapon, target); assert.equal(run.player.hp, 10, 'No life damage means no leech healing')
  weapon.attack = 10; hand(run, [ball]); strike(run, weapon, target); assert.equal(run.player.hp, 11)
}
{
  const { run, target } = battle()
  target.pos = { c: 4, r: 3 }
  const near = enemy(run, { pos: { c: 1, r: 2 }, hp: 50 })
  const diagonal = enemy(run, { pos: { c: 1, r: 4 }, hp: 50 })
  hand(run, [{ enchantment: 'flame-step' }])
  assert(run._walk([{ c: 2, r: 3 }]).stopped === false)
  assert.equal(near.hp, 48); assert.equal(diagonal.hp, 48); assert.equal(target.hp, 1000)
  hand(run, [{ enchantment: 'light-foot' }]); const armor = run.player.armor
  run._walk([{ c: 2, r: 2 }]); assert.equal(run.player.armor, armor + 2)
  covered.add('flame-step'); covered.add('light-foot')
}
{
  const { run } = battle()
  run.currentRoom.tile({ c: 2, r: 3 }).revealed = false
  hand(run, [{ enchantment: 'explore' }]); const gold = run.player.gold
  assert(run._flipAt({ c: 2, r: 3 })); assert.equal(run.player.gold, gold + 1)
  covered.add('explore')
}
for (const kind of ['reveal', 'pickup', 'other', 'move']) {
  const { run } = battle()
  const [ball] = hand(run, [{ enchantment: 'economy' }]); run.random = () => .299
  if (kind === 'reveal') { run.currentRoom.tile({ c: 2, r: 3 }).revealed = false; assert(run._flipAt({ c: 2, r: 3 })) }
  else if (kind === 'pickup') {
    run.currentRoom.addEntity({ id: 'test-gold', kind: 'gold', pos: { ...run.player.pos }, amount: 3 })
    assert(run._pickUp(run.currentRoom.entity('test-gold')))
  } else if (kind === 'move') run._walk([{ c: 2, r: 3 }])
  else assert(run._payAction(1))
  assert.equal(run.staminaDeck.hand.includes(ball), ['reveal', 'pickup'].includes(kind), kind)
}
covered.add('economy')
{
  const { run } = battle()
  const [retained] = hand(run, [{ enchantment: 'retain' }, { enchantment: 'guardian' }, { enchantment: null }])
  const armor = run.player.armor
  assert(run.endPlayerTurn()); assert.equal(run.player.armor, armor + 2)
  assert.deepEqual(run.staminaDeck.hand.map(ball => ball.id), [retained.id])
  settleAnimations(run)
  assert.equal(run.staminaDeck.hand.length, 8, 'Retention adds to the normal seven-flame draw')
  assert(run.staminaDeck.hand.includes(retained))
  assert(StaminaDeck.valid(run.staminaDeck.serialize()))
  covered.add('retain'); covered.add('guardian')
}
{
  const { run, weapon, target } = battle()
  const kept = hand(run, [{ enchantment: 'fuel' }, { enchantment: 'resonance' }, { enchantment: null }]).slice(0, 2)
  assert.equal(strike(run, weapon, target), 12, 'Unused fuel +1, matching resonance +0.1')
  hand(run, [...kept, { enchantment: null }])
  assert.equal(strike(run, weapon, target), 12, 'Unused attack bonuses repeat on every attack')
  hand(run, [{ enchantment: 'resonance', attribute: 'wild' }, { enchantment: null }])
  assert.equal(strike(run, weapon, target), 10, 'Wild and red are distinct colors for resonance')
  covered.add('fuel'); covered.add('resonance')
}
{
  const { run, weapon, target } = battle()
  const kept = hand(run, [{ enchantment: 'stance' }, { enchantment: 'stance' }, { enchantment: null }]).slice(0, 2)
  const armor = run.player.armor
  strike(run, weapon, target); assert.equal(run.player.armor, armor + 2)
  hand(run, [...kept, { enchantment: null }]); strike(run, weapon, target); assert.equal(run.player.armor, armor + 4, 'Each unused stance repeats within the same turn')
  const saved = reload(run), savedWeapon = saved.backpack.items.find(item => item.uid === weapon.uid)
  hand(saved, [...kept, { enchantment: null }]); strike(saved, savedWeapon, saved.currentRoom.entity(target.id))
  assert.equal(saved.player.armor, armor + 6, 'Loading does not introduce a stance cap')
  hand(run, kept); strike(run, weapon, target); assert.equal(run.player.armor, armor + 5, 'A consumed stance no longer contributes')
  hand(run, [kept[0]]); strike(run, weapon, target); assert.equal(run.player.armor, armor + 5)
  run.endPlayerTurn(); settleAnimations(run)
  hand(run, [...kept, { enchantment: null }]); strike(run, weapon, target); assert.equal(run.player.armor, armor + 7)
  covered.add('stance')
}
{
  const { run, weapon, target: anchor } = battle()
  const kept = hand(run, [{ enchantment: 'gather' }, { enchantment: 'gather' }, { enchantment: null }]).slice(0, 2)
  const gold = run.player.gold
  for (let n = 0; n < 2; n++) {
    const target = enemy(run, { hp: 1, pos: { c: 3, r: 4 } })
    hand(run, [...kept, { enchantment: null }]); strike(run, weapon, target)
    assert.equal(run.player.gold, gold + (n + 1) * 2, 'Each unused gather repeats on every kill')
  }
  const saved = reload(run), savedWeapon = saved.backpack.items.find(item => item.uid === weapon.uid)
  const savedTarget = enemy(saved, { hp: 1, pos: { c: 3, r: 4 } })
  hand(saved, [...kept, { enchantment: null }]); strike(saved, savedWeapon, savedTarget)
  assert.equal(saved.player.gold, gold + 6, 'Loading does not introduce a gather cap')
  hand(run, [...kept, { enchantment: null }]); strike(run, weapon, anchor)
  assert.equal(run.player.gold, gold + 4, 'A nonlethal attack grants no gather gold')
  const target = enemy(run, { hp: 1, pos: { c: 3, r: 4 } })
  hand(run, kept); strike(run, weapon, target); assert.equal(run.player.gold, gold + 5, 'Only the unconsumed gather grants gold')
  const lastTarget = enemy(run, { hp: 1, pos: { c: 3, r: 4 } })
  hand(run, [kept[0]]); strike(run, weapon, lastTarget); assert.equal(run.player.gold, gold + 5)
  covered.add('gather')
}
// Probability boundaries and non-attack pet payments must not trigger player attack effects.
{
  const { run, weapon, target } = battle()
  const [ball] = hand(run, [{ enchantment: 'berserk' }]); run.random = () => .25
  strike(run, weapon, target); assert(run.staminaDeck.all.includes(ball), '25% is an exclusive upper bound')
  const [economy] = hand(run, [{ enchantment: 'economy' }]); run.random = () => .30
  run._payAction(1, { kind: 'pickup' }); assert(!run.staminaDeck.hand.includes(economy))
}
{
  const { run } = battle()
  add(run, 'mountain-hound')
  hand(run, [{ enchantment: 'guardian' }]); const armor = run.player.armor
  run.endPlayerTurn(); assert.equal(run.player.armor, armor, 'A flame used by a pet is no longer unused at round end')
  settleAnimations(run)
  hand(run, [{ enchantment: 'greed' }]); const gold = run.player.gold
  run.endPlayerTurn(); assert.equal(run.player.gold, gold, 'Pet payments do not grant player attack enchantments')
}
{
  const { run, target } = battle()
  const [ball] = hand(run, [{ enchantment: 'retain' }])
  run._damageEnemy(target, 5000); run._endTurn(); settleAnimations(run)
  assert.equal(run.staminaDeck.hand.length, 0, 'Ending combat discards even retained flames')
  assert(run.staminaDeck.all.includes(ball))
}
assert.deepEqual([...covered].sort(), FIRE_ENCHANTMENTS.map(effect => effect.id).sort())
console.log('Spirit fire passed: all 18 enchantments, actual attacks/actions/rounds, stacking, per-turn probability reset/destruction, uncapped temper/leech, retained draws, uncapped unused passives and save restoration.')
