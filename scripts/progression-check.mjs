import assert from 'node:assert/strict'
import { fixture, add, enemy, attack, setBalls } from './item-test-helpers.mjs'
import { GameRun } from '../src/game/run.js'
import { LEVEL_UP_OPTIONS, buildLevelUpChoices } from '../src/game/data/progression.js'
import { FIRE_ENCHANTMENTS } from '../src/game/data/spirit-fire.js'
import { StaminaDeck } from '../src/game/model/stamina-deck.js'
import { makeItemById } from '../src/game/data/content.js'

function offer(run, id) {
  run.player.experience = run.player.experienceToNext
  run.phase = 'level-up'
  run.levelUp = { choices: [id, ...LEVEL_UP_OPTIONS.map(option => option.id).filter(value => value !== id)].slice(0, 4) }
}
function restore(run) {
  const previous = globalThis.localStorage
  globalThis.localStorage = { getItem: () => JSON.stringify(run.serialize()), setItem() {}, removeItem() { assert.fail('Save rejected') } }
  try { const loaded = new GameRun({ random: () => .99 }); assert(loaded._loaded); return loaded } finally { globalThis.localStorage = previous }
}
assert.equal(LEVEL_UP_OPTIONS.length, 27)
for (const option of LEVEL_UP_OPTIONS) assert(!/随机展示|可跳过|替换已有附魔|每颗灵火每次|每回合最多触发/.test(option.description), option.id)
assert.equal(LEVEL_UP_OPTIONS.filter(option => option.kind === 'add').length, 4)
assert.equal(LEVEL_UP_OPTIONS.filter(option => option.kind === 'convert').length, 4)
assert.equal(LEVEL_UP_OPTIONS.filter(option => option.kind === 'remove').length, 1)
assert.equal(LEVEL_UP_OPTIONS.filter(option => option.kind === 'enchant').length, 18)
const seen = new Set()
for (let n = 0; n < 200; n++) {
  let seed = n + 1
  const choices = buildLevelUpChoices({ random: () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32) })
  assert.equal(choices.length, 4); assert.equal(new Set(choices).size, 4)
  choices.forEach(id => seen.add(id))
}
assert.equal(seen.size, 27)
for (const option of LEVEL_UP_OPTIONS) {
  const run = fixture(), before = { level: run.player.level, hp: run.player.hp, maxHp: run.player.maxHp, turn: run.globalTurn, count: run.staminaDeck.all.length }
  offer(run, option.id)
  const originalOrder = run.staminaDeck.serialize()
  assert(run.chooseLevelUpOption(option.id))
  if (option.kind === 'add') {
    assert.equal(run.staminaDeck.all.length, before.count + 1)
    assert.equal(run.staminaDeck.discardPile.at(-1).attribute, option.attribute)
  } else {
    assert.deepEqual(run.staminaDeck.serialize(), originalOrder, 'Sampling cannot change deck order or draw flames')
    const targets = run.levelUpSpiritFires(), ids = targets.map(ball => ball.id)
    assert.equal(ids.length, 5); assert.equal(new Set(ids).size, 5)
    assert(run.backToLevelUpChoices()); assert(run.chooseLevelUpOption(option.id))
    assert.deepEqual(run.levelUpSpiritFires().map(ball => ball.id), ids, 'Back/reselect cannot reroll five targets')
    const loaded = restore(run)
    assert.deepEqual(loaded.levelUpSpiritFires().map(ball => ball.id), ids, 'Reload keeps the offered sample')
    assert.equal(loaded.chooseLevelUpSpiritFire(-1), false)
    const chosen = loaded.levelUpSpiritFires()[0]
    if (option.kind === 'convert') chosen.enchantment = 'rekindle', chosen.rekindleReturns = 2
    assert(loaded.chooseLevelUpSpiritFire(chosen.id))
    if (option.kind === 'remove') assert(!loaded.staminaDeck.all.some(ball => ball.id === chosen.id))
    if (option.kind === 'convert') { assert.equal(chosen.attribute, option.attribute); assert.equal(chosen.enchantment, 'rekindle'); assert.equal(chosen.rekindleReturns, 2) }
    if (option.kind === 'enchant') assert.equal(chosen.enchantment, option.enchantment)
    assert(StaminaDeck.valid(loaded.staminaDeck.serialize()))
    assert.equal(loaded.player.level, before.level + 1)
    assert.equal(loaded.chooseLevelUpSpiritFire(chosen.id), false)
    assert.equal(loaded.globalTurn, before.turn)
    continue
  }
  assert.equal(run.player.level, before.level + 1); assert.equal(run.player.hp, before.hp); assert.equal(run.player.maxHp, before.maxHp); assert.equal(run.globalTurn, before.turn)
}
// Replacement keeps the physical flame identity/color and removes old effect state.
{
  const run = fixture(); offer(run, 'enchant-sharp'); run.chooseLevelUpOption('enchant-sharp')
  const ball = run.levelUpSpiritFires()[0], attribute = ball.attribute
  Object.assign(ball, { enchantment: 'rekindle', rekindleReturns: 4 })
  assert(run.chooseLevelUpSpiritFire(ball.id))
  assert.equal(ball.enchantment, 'sharp'); assert.equal(ball.rekindleReturns, undefined); assert.equal(ball.attribute, attribute)
  assert(run.showSpiritFireDetail(ball.id)); assert(run.detailPanel.description.includes('攻击力+3'))
}
for (const location of ['hand', 'drawPile', 'discardPile']) {
  const run = fixture(), deck = run.staminaDeck, ball = deck.all[0]
  for (const key of ['hand', 'drawPile', 'discardPile']) deck[key] = deck[key].filter(entry => entry.id !== ball.id)
  deck[location].push(ball); if (location === 'hand') deck.selected = [ball.id]
  const nextId = deck.nextId; assert(deck.remove(ball.id)); assert.equal(deck.selected.length, 0)
  assert.equal(deck.add('wild').id, nextId, 'A destroyed flame ID is never reused')
  assert(StaminaDeck.valid(deck.serialize()))
  assert(StaminaDeck.valid(restore(run).staminaDeck.serialize()))
}
{
  const run = fixture(); offer(run, 'enchant-leech'); run.chooseLevelUpOption('enchant-leech')
  const before = run.staminaDeck.serialize()
  assert(run.skipLevelUpSpiritFire()); assert.deepEqual(run.staminaDeck.serialize(), before)
  assert.equal(run.player.level, 2); assert.equal(run.skipLevelUpSpiritFire(), false)
  for (const ball of run.staminaDeck.all) run.staminaDeck.remove(ball.id)
  offer(run, 'purify'); assert(run.chooseLevelUpOption('purify')); assert.deepEqual(run.levelUpSpiritFires(), [])
  assert(run.skipLevelUpSpiritFire()); assert.equal(run.player.level, 3)
  assert(StaminaDeck.valid(run.staminaDeck.serialize()))
}
{
  const run = fixture()
  run.player.experience = run.player.experienceToNext + 10
  assert(run._queueLevelUp()); assert.equal(run.levelUp.choices.length, 4)
  const first = run.levelUp.choices[0]; assert(run.chooseLevelUpOption(first))
  if (run.levelUp?.selectedOption) run.skipLevelUpSpiritFire()
  assert.equal(run.player.level, 2); assert.equal(run.phase, 'level-up')
  assert.equal(run.levelUp.choices.length, 4)
  const option = run.levelUp.choices[0]; assert(run.chooseLevelUpOption(option))
  if (run.levelUp?.selectedOption) run.skipLevelUpSpiritFire()
  assert.equal(run.player.level, 3); assert.equal(run.phase, 'explore')
}
assert.equal(FIRE_ENCHANTMENTS.length, 18)
// Room rewards overflow without spending turns or granting the choice twice.
for (const full of [false, true]) {
  for (const choice of [{ kind: 'item', itemId: 'rust-sword' }, { kind: 'relic', relicId: 'r-loot-pouch' }]) {
    const run = fixture()
    if (full) while (run.backpack.add(makeItemById('health-potion'))) { /* Fill every cell. */ }
    const before = { turn: run.globalTurn, hp: run.player.hp, energy: run.player.energy }
    run.phase = 'reward'
    run.roomReward = { roomId: run.currentRoom.id, choices: [choice] }
    assert(run.chooseRoomReward(0))
    const id = choice.itemId || choice.relicId
    assert.equal(run.backpack.items.some(item => item.id === id), !full)
    assert.equal(run.inventoryStash.filter(item => item.id === id).length, full ? 1 : 0)
    if (choice.kind === 'relic') assert(run.relics.has(id))
    assert.equal(run.phase, 'explore')
    assert.equal(run.roomReward, null)
    assert.deepEqual({ turn: run.globalTurn, hp: run.player.hp, energy: run.player.energy }, before)
    assert.equal(run.chooseRoomReward(0), false)
    const loaded = restore(run)
    assert.equal(loaded.inventoryStash.filter(item => item.id === id).length, full ? 1 : 0)
    if (choice.kind === 'relic') assert(loaded.relics.has(id))
  }
}

// Loot-pouch overflow and a kill-triggered upgrade must not lock inventory management.
{
  const run = fixture(), weapon = add(run, 'rust-sword')
  add(run, 'r-loot-pouch')
  const pouch = add(run, 'money-pouch')
  while (run.backpack.add(makeItemById('health-potion'))) { /* Fill every cell. */ }
  run.player.experience = run.player.experienceToNext - 1
  const target = enemy(run, { hp: 1, noExperience: false, experience: 1 })
  run._synchronizeBattle()
  setBalls(run, 6, weapon.attribute)
  attack(run, weapon, target)
  assert.equal(run.phase, 'level-up')
  assert.equal(run.inventoryStash.length, 1, 'loot-pouch reward overflows into staging')
  const reward = run.inventoryStash[0], choices = JSON.stringify(run.levelUp)
  const before = { turn: run.globalTurn, hp: run.player.hp, energy: run.player.energy, experience: run.player.experience }
  const assertPaused = () => {
    assert.deepEqual({ turn: run.globalTurn, hp: run.player.hp, energy: run.player.energy, experience: run.player.experience }, before)
    assert.equal(run.phase, 'level-up')
    assert.equal(JSON.stringify(run.levelUp), choices, 'organizing preserves the offered rewards')
  }
  const potion = run.backpack.items.find(item => item.id === 'health-potion')
  const freedCell = run.backpack.originIndex(run.backpack.placementOf(potion.uid))
  assert.equal(run.discardInventoryItem(pouch.uid), false, 'money pouch stays protected')
  assert(run.discardInventoryItem(potion.uid), 'backpack discard works while an upgrade is pending')
  assert(run.commitInventoryDrop(reward, freedCell), 'overflow reward can enter the freed slot')
  assert.equal(run.inventoryStash.length, 0)
  assertPaused()
  assert(run.moveInventoryToStash(reward.uid))
  assert(run.setStashedInventoryRotation(reward.uid, 1))
  assert(run.discardInventoryItem(reward.uid), 'staged discard works while an upgrade is pending')
  assertPaused()
  const loaded = restore(run)
  assert.deepEqual(loaded.levelUp, run.levelUp)
  assert.equal(loaded.inventoryStash.length, 0)
  assert(loaded.chooseLevelUpOption(loaded.levelUp.choices[0]))
  if (loaded.levelUp?.selectedOption) assert(loaded.skipLevelUpSpiritFire())
  assert.equal(loaded.player.level, 2)
  assert.equal(loaded.globalTurn, before.turn)
}


console.log('Progression passed: 27 unique rewards/four offers, four fire gains, fixed five-target samples, all conversions/enchantments, deletion/replacement/skips, repeated levels, save/restore and room reward overflow.');
