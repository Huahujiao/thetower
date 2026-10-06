import assert from 'node:assert/strict'
import { fixture, add, enemy, setBalls, round } from './item-test-helpers.mjs'
import { PETS, PET_RELICS } from '../src/game/data/pets.js'
import { ALL_ITEM_DEFS, makeItemById } from '../src/game/data/content.js'
import { getStatus } from '../src/game/rules/statuses.js'
import { catalogContent } from '../src/ui/wiki-catalog.js'
import { StaminaDeck } from '../src/game/model/stamina-deck.js'

assert.equal(PETS.length, 8)
assert(!ALL_ITEM_DEFS.some(item => item.type === 'energy'))
assert.equal(makeItemById('r-vampire-fang'), null)
for (const definition of [...PETS, ...PET_RELICS]) assert(catalogContent(definition.type === 'pet' ? 'items' : 'relics').includes(definition.name))
for (const definition of PETS) {
  const run = fixture(), pet = add(run, definition.id), target = enemy(run)
  run._synchronizeBattle(); setBalls(run, pet.ballCost)
  const original = run.staminaDeck.hand.map(ball => ball.id)
  run.battle.stage = 'pets'; run.pets.act()
  assert.equal(target.hp, 100 - pet.attack)
  assert.equal(run.player.energy, 0)
  assert(original.every(id => run.staminaDeck.discardPile.some(ball => ball.id === id)))
  assert(StaminaDeck.valid(run.staminaDeck.serialize()))
  if (pet.id === 'venom-toad') assert(getStatus(target, 'enemy-poison'))
  if (pet.id === 'shadow-spider') assert.equal(target.actionDelay, 101)
}
// No target and insufficient budget leave the entire hand untouched.
{
  const run = fixture(), pet = add(run, 'mandrill-beast'), target = enemy(run)
  run._synchronizeBattle(); setBalls(run, pet.ballCost - 1)
  const hand = run.staminaDeck.serialize()
  run.battle.stage = 'pets'; run.pets.act()
  assert.equal(target.hp, 100); assert.deepEqual(run.staminaDeck.serialize(), hand)
  run.currentRoom.tile(target.pos).revealed = false
  setBalls(run, pet.ballCost); const before = run.staminaDeck.serialize()
  run.pets.act(); assert.deepEqual(run.staminaDeck.serialize(), before)
}
// Generic payment, shared budget, live charm adjacency, horn and prey priority.
{
  const run = fixture(), pet = add(run, 'iron-beetle', 0, 0); add(run, 'r-feeding-charm', 0, 1)
  assert.equal(run.pets.cost(pet), 1)
  run.backpack.move(run.backpack.items.find(item => item.id === 'r-feeding-charm').uid, 7, 3)
  assert.equal(run.pets.cost(pet), 2)
  const first = enemy(run), second = enemy(run, { pos: { c: 3, r: 4 } })
  add(run, 'r-hunting-horn'); run.pets.playerAttack(first)
  run.pets.state.prey.push(second.id); assert.equal(run.pets.target(pet), second)
  assert.equal(run.pets.range(pet, first), pet.range + 2)
}
{
  const run = fixture(); add(run, 'mountain-hound', 0, 0); add(run, 'mountain-hound', 2, 0); add(run, 'r-pack-hunt')
  const target = enemy(run); run._synchronizeBattle(); setBalls(run, 2)
  run.battle.stage = 'pets'; run.pets.act(); assert.equal(target.hp, 91); assert.equal(run.player.energy, 0)
}
{
  const run = fixture(); add(run, 'thunder-raven'); const first = enemy(run), second = enemy(run, { pos: { c: 5, r: 3 } })
  run._synchronizeBattle(); setBalls(run, 2); run.battle.stage = 'pets'; run.pets.act()
  assert.equal(first.hp, 97); assert.equal(second.hp, 99)
}
// Pet-only kills grant beast armor; full player rounds discard the residual hand.
{
  const run = fixture(); add(run, 'mountain-hound'); add(run, 'beast-armor')
  enemy(run, { hp: 1 }); round(run)
  assert.equal(run.player.armor, 2); assert.equal(run.battle.active, false); assert.equal(run.player.energy, 0)
  assert(StaminaDeck.valid(run.staminaDeck.serialize()))
}
console.log('pets-ball-check passed: eight pets, ball costs, no food, skips, marks, charm, shared budget, bounce and battle completion')
