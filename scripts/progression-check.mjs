import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture, add, enemy, attack, select } from './item-test-helpers.mjs'
import { GameRun, ENERGY_MAX } from '../src/game/run.js'
import { LEVEL_UP_OPTIONS, buildLevelUpChoices } from '../src/game/data/progression.js'
import { RELIC_DEFS } from '../src/game/data/relics.js'
import { RECIPES, getItemDefinition, makeItemById } from '../src/game/data/content.js'

function offer(run, id, other = ['max-health', 'max-energy']) {
  run.player.experience = run.player.experienceToNext
  run.phase = 'level-up'
  run.levelUp = { choices: [id, ...other.filter(value => value !== id)].slice(0, 3) }
}
function restore(run, mutate = () => {}) {
  const data = run.serialize()
  mutate(data)
  const previous = globalThis.localStorage
  let payload = JSON.stringify(data), removed = false
  globalThis.localStorage = { getItem: () => payload, setItem: (_key, value) => { payload = value }, removeItem: () => { removed = true } }
  try {
    const loaded = new GameRun({ autoLoad: true, random: () => .99 })
    assert.equal(removed, false, 'save must remain valid')
    return loaded
  } finally { globalThis.localStorage = previous }
}

assert.equal(LEVEL_UP_OPTIONS.length, 6)
assert.equal(LEVEL_UP_OPTIONS[0].name, '\u56de\u590d5\u70b9\u751f\u547d')
assert.equal(LEVEL_UP_OPTIONS[5].name, '\u7269\u54c1\u538b\u7f29')
const seen = new Set()
for (let index = 0; index <= 100; index++) {
  const choices = buildLevelUpChoices({ random: () => index / 101 })
  assert.equal(choices.length, 3)
  assert.equal(new Set(choices).size, 3)
  choices.forEach(id => seen.add(id))
}
assert.equal(seen.size, 6, 'all six rewards participate in the pool')

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
  assert(loaded.chooseLevelUpOption(loaded.levelUp.choices.find(id => ['heal', 'max-health', 'max-energy'].includes(id))))
  assert.equal(loaded.player.level, 2)
  assert.equal(loaded.globalTurn, before.turn)
}

// A pending upgrade permits only inventory management after combat has settled.
{
  const run = fixture(), weapon = add(run, 'rust-sword')
  add(run, 'shield-core')
  offer(run, 'weapon-upgrade')
  run.combatResolving = true
  assert.equal(run.discardInventoryItem(weapon.uid), false)
  run.combatResolving = false; run.enemyDeathAnimationsPending = 1
  assert.equal(run.moveInventoryToStash(weapon.uid), false)
  run.enemyDeathAnimationsPending = 0
  select(run, weapon)
  assert.equal(run.useSelected(), false)
  assert.equal(run.clickTile(3, 2), false)
  assert.equal(run.craft('silver-guard'), false)
  assert(run.chooseLevelUpOption('weapon-upgrade'))
  assert(run.moveInventoryToStash(weapon.uid))
  assert.equal(run.levelUp.selectedOption, undefined, 'empty weapon selection returns to the main choices')
  assert(run.backpack.add(weapon))
  run.unstageInventoryItem(weapon.uid, { notify: false })
  for (const relic of RELIC_DEFS.filter(relic => !relic.disabled)) run.relics.acquire(relic.id)
  run.levelUp.choices = ['weapon-upgrade', 'relic', 'item-compression']
  assert(run.discardInventoryItem(weapon.uid))
  assert(run.levelUp.choices.some(id => run.canChooseLevelUpOption(id)), 'removing the sole upgrade target cannot deadlock')
  assert.equal(run.globalTurn, 0)
}

// Immediate rewards do not refill the stats whose caps they increase or spend turns.
{
  const run = fixture(), turn = run.globalTurn
  run.player.hp = 18
  offer(run, 'heal'); assert(run.chooseLevelUpOption('heal'))
  assert.equal(run.player.hp, 20); assert.equal(run.player.level, 2)
  run.player.hp = 8
  offer(run, 'heal'); assert(run.chooseLevelUpOption('heal')); assert.equal(run.player.hp, 13)
  offer(run, 'max-health'); assert(run.chooseLevelUpOption('max-health'))
  assert.equal(run.player.maxHp, 22); assert.equal(run.player.hp, 13)
  run.player.energy = 3
  offer(run, 'max-energy'); assert(run.chooseLevelUpOption('max-energy'))
  offer(run, 'max-energy'); assert(run.chooseLevelUpOption('max-energy'))
  assert.equal(run.player.baseMaxEnergy, ENERGY_MAX + 2)
  assert.equal(run.player.maxEnergy, ENERGY_MAX + 2); assert.equal(run.player.energy, 3)
  assert.equal(run.globalTurn, turn)
  const loaded = restore(run)
  assert.equal(loaded.player.maxEnergy, ENERGY_MAX + 2); assert.equal(loaded.player.energy, 3)
}

// Excess experience queues the next upgrade only after the current selection completes.
{
  const run = fixture()
  run.player.experience = 18
  assert(run._queueLevelUp())
  run.levelUp.choices = ['heal', 'max-health', 'max-energy']
  assert(run.chooseLevelUpOption('max-health'))
  assert.equal(run.player.level, 2); assert.equal(run.phase, 'level-up')
  assert.equal(run.player.experience, 10); assert.equal(run.levelUpChoices().length, 3)
  run.levelUp.choices = ['heal', 'max-health', 'max-energy']
  assert(run.chooseLevelUpOption('max-health'))
  assert.equal(run.player.level, 3); assert.equal(run.player.maxHp, 24)
  assert.equal(run.phase, 'explore'); assert.equal(run.player.experience, 0)
}

// Permanent capacity survives a totem reserving a point and later returning it.
{
  const run = fixture(), badge = add(run, 'r-totem-drum')
  offer(run, 'max-energy'); assert(run.chooseLevelUpOption('max-energy'))
  select(run, badge); assert(run.useSelected()); assert(run.clickTile(2, 3))
  assert.equal(run.player.maxEnergy, ENERGY_MAX)
  const loaded = restore(run), totem = loaded.totems.active('drum')
  assert(totem); assert.equal(loaded.player.baseMaxEnergy, ENERGY_MAX + 1)
  assert(loaded.totems.remove(totem)); assert.equal(loaded.player.maxEnergy, ENERGY_MAX + 1)
}

// Nested relic choices are unique, exclude ownership, persist, and cannot be rerolled by returning.
{
  const run = fixture(), owned = add(run, 'r-empty'), level = run.player.level
  offer(run, 'relic'); assert(run.chooseLevelUpOption('relic'))
  const choices = [...run.levelUp.relicChoices]
  assert.equal(choices.length, 3); assert.equal(new Set(choices).size, 3)
  assert(!choices.includes(owned.id)); assert.equal(run.player.level, level)
  assert.equal(run.chooseLevelUpOption('max-health'), false)
  assert.equal(run.chooseLevelUpRelic(owned.id), false)
  const loaded = restore(run)
  assert.equal(loaded.levelUp.selectedOption, 'relic'); assert.deepEqual(loaded.levelUp.relicChoices, choices)
  assert(loaded.backToLevelUpChoices()); assert(loaded.chooseLevelUpOption('relic'))
  assert.deepEqual(loaded.levelUp.relicChoices, choices)
  assert(loaded.chooseLevelUpRelic(choices[0])); assert(loaded.relics.has(choices[0]))
  assert.equal(loaded.player.level, level + 1)
  assert.equal(loaded.chooseLevelUpRelic(choices[0]), false)
}
{
  const run = fixture()
  while (run.backpack.add(makeItemById('money-pouch'))) { /* Fill every cell. */ }
  offer(run, 'relic'); assert(run.chooseLevelUpOption('relic'))
  const id = run.levelUp.relicChoices[0]
  assert(run.chooseLevelUpRelic(id)); assert(run.inventoryStash.some(item => item.id === id))
  assert(restore(run).relics.has(id))
}
{
  const run = fixture(), active = RELIC_DEFS.filter(relic => !relic.disabled)
  for (const relic of active.slice(0, -1)) run.relics.acquire(relic.id)
  offer(run, 'relic'); assert(run.chooseLevelUpOption('relic'))
  assert.deepEqual(run.levelUp.relicChoices, [active.at(-1).id])
  run.relics.acquire(active.at(-1).id); run.backToLevelUpChoices()
  assert.equal(run.canChooseLevelUpOption('relic'), false)
  assert.equal(run.chooseLevelUpOption('relic'), false)
  // This shuffle initially offers relic, weapon, and compression: ensure it cannot deadlock.
  run.levelUp = null; run.phase = 'explore'
  const sequence = [.4, .2, 0, .99, .99, 0]
  const preview = [...sequence]
  assert.deepEqual(buildLevelUpChoices({ random: () => preview.shift() }), ['relic', 'weapon-upgrade', 'item-compression'])
  run.random = () => sequence.shift() ?? 0
  assert(run._queueLevelUp()); assert.equal(run.levelUp.choices.length, 3)
  assert(run.levelUp.choices.some(id => run.canChooseLevelUpOption(id)))
}

// Reinforcement targets a UID, updates actual damage, and persists only on that instance.
{
  const run = fixture(), weapon = add(run, 'rust-sword'), other = add(run, 'rust-sword'), potion = add(run, 'health-potion')
  const base = weapon.attack
  offer(run, 'weapon-upgrade'); assert(run.chooseLevelUpOption('weapon-upgrade'))
  assert.equal(run.chooseLevelUpWeapon(potion.uid), false)
  assert.equal(run.chooseLevelUpWeapon('missing'), false)
  const pending = restore(run)
  assert.equal(pending.levelUp.selectedOption, 'weapon-upgrade')
  assert(pending.chooseLevelUpWeapon(weapon.uid))
  const enhanced = pending.backpack.items.find(item => item.uid === weapon.uid)
  assert.equal(enhanced.attack, base + 1)
  assert.equal(pending.backpack.items.find(item => item.uid === other.uid).attack, base)
  offer(pending, 'weapon-upgrade'); assert(pending.chooseLevelUpOption('weapon-upgrade'))
  assert(pending.chooseLevelUpWeapon(weapon.uid)); assert.equal(enhanced.attack, base + 2)
  assert.equal(getItemDefinition('rust-sword').attack, base); assert.equal(makeItemById('rust-sword').attack, base)
  const target = enemy(pending), hp = target.hp
  attack(pending, enhanced, target); assert.equal(hp - target.hp, base + 2)
  const loaded = restore(pending), saved = loaded.backpack.items.find(item => item.uid === weapon.uid)
  assert.equal(saved.attack, base + 2); assert.equal(saved.reinforcement, 2)
}
for (const recipe of RECIPES) {
  const run = fixture(), ingredient = add(run, recipe.a)
  ingredient.attack += 2; ingredient.reinforcement = 2
  add(run, recipe.b)
  assert(run.craft(recipe.id))
  const output = run.backpack.items.find(item => item.id === recipe.result)
  assert.equal(output.attack, getItemDefinition(recipe.result).attack, recipe.id)
  assert.equal(output.reinforcement, undefined, recipe.id)
}

// Compression is visible but cannot consume an upgrade or mutate an item.
{
  const run = fixture(), weapon = add(run, 'rust-sword')
  offer(run, 'item-compression')
  const before = JSON.stringify(weapon), level = run.player.level
  assert(run.levelUpChoices().some(choice => choice.id === 'item-compression'))
  assert.equal(run.chooseLevelUpOption('item-compression'), false)
  assert.equal(run.player.level, level); assert.equal(JSON.stringify(weapon), before)
  assert.equal(run.chooseLevelUpOption('not-offered'), false)
}

// Retired saves retain earned stats but remove talent ownership, effects, and pending choices.
{
  const run = fixture(), weapon = add(run, 'rust-sword')
  run.itemRules.buff('guard-reply', { flat: 1 })
  run.itemRules.buff('guard-last', { flat: 2 })
  run.itemRules.buff('flow-relay', { discount: 1 })
  run.itemRules.buff('harmony-resist', { flat: 2 })
  const affected = enemy(run)
  run.applyStatus(affected, 'attack-reduction', { amount: 1 })
  const loaded = restore(run, data => {
    delete data.player.baseMaxEnergy
    data.player.talents = ['flow-step', 'guard-hard', 'survival-heal', 'harmony-switch']
    data.player.talentRuntime = { bodyStrength: 2 }
    data.player.maxHp = 24
    data.player.experience = data.player.experienceToNext
    data.phase = 'level-up'; data.levelUp = { choices: ['flow-walk', 'guard-last', 'body-strength'] }
  })
  assert.equal(loaded.player.talents, undefined); assert.equal(loaded.player.talentRuntime, undefined)
  assert.equal(loaded.player.maxHp, 24); assert.equal(loaded.levelUpChoices().length, 3)
  assert.deepEqual(loaded.itemRules.state.buffs, {})
  assert.equal(loaded.getStatus(loaded.currentRoom.entity(affected.id), 'attack-reduction'), null)
  const actual = loaded.backpack.items.find(item => item.uid === weapon.uid)
  assert.equal(loaded.itemRules.attackContext(actual, loaded.currentRoom.entity(affected.id)).flat, 0)
}
const hud = readFileSync(new URL('../src/ui/VueHud.vue', import.meta.url), 'utf8')
assert(!hud.includes('talent'))
assert(hud.includes('data-level-up-relic')); assert(hud.includes('data-level-up-weapon'))
console.log('progression-check passed: six rewards, nested selections, instance upgrades, recipes, saves, totems and retired effects')
