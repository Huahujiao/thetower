import assert from 'node:assert/strict'
import { fixture, add, enemy, attack, select, round } from './item-test-helpers.mjs'
import { GameRun, SAVE_VERSION } from '../src/game/run.js'
import { ALL_ITEM_DEFS, makeItemById, randomConsumableOfTier, randomNeutralItem } from '../src/game/data/content.js'
import { EXPANSION_RELICS, EXPANSION_DEFENSES, EXPANSION_WEAPONS } from '../src/game/data/expansion-items.js'
import { getStatus, consumeStatus } from '../src/game/rules/statuses.js'
import { emptyPerimeterCells } from '../src/game/rules/backpack-geometry.js'
import { buildMerchantStock } from '../src/game/data/merchants.js'
import { catalogContent } from '../src/ui/wiki-catalog.js'

const expansion = [...EXPANSION_RELICS, ...EXPANSION_DEFENSES, ...EXPANSION_WEAPONS]
assert.equal(expansion.length, 30)
assert.equal(new Set(ALL_ITEM_DEFS.map(item => item.id)).size, ALL_ITEM_DEFS.length)
for (const definition of expansion) {
  assert(makeItemById(definition.id))
  assert.equal(catalogContent(definition.type === 'weapon' ? 'weapons' : definition.type === 'defense' ? 'items' : 'relics').includes(definition.name), !definition.disabled)
}
for (let index = 0; index < 100; index++) {
  const random = () => index / 100
  assert.notEqual(randomConsumableOfTier(1, random).id, 'shield-bash')
  assert.equal(randomConsumableOfTier(2, random).tier, 2)
  assert.notEqual(randomNeutralItem(12, random).id, 'shield-bash')
  assert(buildMerchantStock('merchant', 12, random).every(slot => slot.itemId !== 'shield-bash'))
}

// Power multipliers use movement history and live adjacency, and disappear in stash.
{
  const run = fixture(), weapon = add(run, 'bone-knife', 2, 1), seal = add(run, 'r-step-edge', 3, 1)
  const target = enemy(run)
  attack(run, weapon, target); assert.equal(target.hp, 98)
  run.itemRules.move()
  attack(run, weapon, target); assert.equal(target.hp, 94); assert.equal(run.player.lastAttackPower, 4)
  attack(run, weapon, target); assert.equal(target.hp, 92)
  run.backpack.removeByUid(seal.uid); run.inventoryStash.push(seal)
  run.itemRules.move(); attack(run, weapon, target); assert.equal(target.hp, 90)
}
// Same/different instance discounts persist across nonattack operations, minimum one.
{
  const run = fixture(), a = add(run, 'bone-knife'), b = add(run, 'bone-knife')
  add(run, 'r-single-seal'); add(run, 'r-switch-ring')
  assert.equal(run.weaponEnergyCost(a), 2)
  attack(run, a, enemy(run))
  assert.equal(run.weaponEnergyCost(a), 1); assert.equal(run.weaponEnergyCost(b), 1)
  run.itemRules.action('consume'); assert.equal(run.weaponEnergyCost(a), 1)
  run.backpack.removeByUid(run.backpack.items.find(item => item.id === 'r-switch-ring').uid)
  assert.equal(run.weaponEnergyCost(b), 2)
}
// Paused neutralization and reversal do not alter the ordinary relationship.
{
  const run = fixture(), weapon = add(run, 'bone-knife', 2, 1)
  add(run, 'r-neutral-stone', 3, 1)
  const target = enemy(run, { attribute: 'scorch' })
  let context = run.itemRules.attackContext(weapon, target)
  assert.equal(context.multiplier, 1); assert.equal(context.resisted, true)
  target.attribute = 'drown'; assert.equal(run.itemRules.attackContext(weapon, target).multiplier, 1.2)
  add(run, 'r-reverse', 7, 3)
  context = run.itemRules.attackContext(weapon, target)
  assert.equal(context.multiplier, 1.2); assert.equal(context.resisted, false)
}
// Perimeter uses distinct occupied-cell neighbors, in bounds, including rotated irregular shapes.
{
  const run = fixture(), weapon = add(run, 'bone-knife', 0, 0)
  add(run, 'r-lone-edge', 7, 3)
  assert.equal(emptyPerimeterCells(run.backpack, weapon).length, 2)
  assert.equal(run.itemRules.attackContext(weapon, enemy(run)).flat, 2)
  add(run, 'food-3', 1, 0); assert.equal(emptyPerimeterCells(run.backpack, weapon).length, 1)
  weapon.shape = [[1, 0], [1, 1]]
  assert(run.backpack.move(weapon.uid, 3, 1, 1))
  const cells = emptyPerimeterCells(run.backpack, weapon)
  assert.equal(cells.length, 7); assert.equal(new Set(cells.map(cell => `${cell.x},${cell.y}`)).size, 7)
}
// Armor, gold and count bonuses are calculated before this attack's grants/spending.
{
  const run = fixture(), weapon = add(run, 'bone-knife', 2, 1)
  add(run, 'r-armor-command', 7, 0); add(run, 'r-iron-will', 7, 1); add(run, 'r-wealth-scale', 7, 2)
  add(run, 'phase-armor', 0, 0); add(run, 'bath-robe', 5, 0)
  run.player.armor = 8; run.player.gold = 14
  assert.equal(run.itemRules.attackContext(weapon, enemy(run)).flat, 6)
}
// Fuel requires weapon adjacency to both pouch and seal, spends once after valid attack only.
{
  const run = fixture(), weapon = add(run, 'bone-knife', 2, 1)
  add(run, 'r-gold-fuel', 3, 1); const pouch = add(run, 'money-pouch', 2, 0)
  run.player.gold = 1; const target = enemy(run)
  run._synchronizeBattle()
  select(run, weapon); run.player.energy = 0
  assert.equal(run._attack(target), false); assert.equal(run.player.gold, 1)
  attack(run, weapon, target); assert.equal(target.hp, 97); assert.equal(run.player.gold, 0)
  attack(run, weapon, target); assert.equal(target.hp, 95)
  run.player.gold = 1; run.backpack.removeByUid(pouch.uid); run.inventoryStash.push(pouch)
  attack(run, weapon, target); assert.equal(target.hp, 93); assert.equal(run.player.gold, 1)
}
// Miasma uses hidden finite counters; erosion purges without immediately reapplying.
{
  const run = fixture(), weapon = add(run, 'erosion-knife', 2, 0)
  add(run, 'r-miasma-sac', 3, 0); const target = enemy(run)
  attack(run, weapon, target)
  const poison = getStatus(target, 'enemy-poison')
  assert.equal(poison.layers, 100); assert.equal(poison.turns, 3)
  assert.equal(poison.showLayers, false); assert.equal(poison.showTurns, true)
  const before = target.hp
  attack(run, weapon, target)
  assert.equal(target.hp, before - weapon.attack - 3); assert.equal(getStatus(target, 'enemy-poison'), null)
}
// The last poison round still halves the attack; attacks never tick poison.
{
  const run = fixture(); add(run, 'r-bone-incense')
  const target = enemy(run, { attack: 7, actionDelay: 0 })
  run.player.armor = 0; run.player.hp = 40
  run.applyStatus(target, 'enemy-poison', { damage: 1, turns: 1 })
  round(run); assert.equal(run.player.hp, 37); assert.equal(target.attack, 7)
  run._enemyAttack(target); assert.equal(run.player.hp, 30)
}
// Movement, forced movement and lethal last-layer poison spread independent remaining counters.
for (const trigger of ['move', 'knockback', 'death', 'poison-death']) {
  const run = fixture(); add(run, 'r-plague-bell')
  const source = enemy(run, { hp: trigger === 'poison-death' ? 1 : 100, attack: 3 })
  const target = enemy(run, { pos: { c: 5, r: 4 } })
  const excluded = enemy(run, { pos: { c: 4, r: 4 } })
  run.applyStatus(excluded, 'enemy-poison', { layers: 8 })
  const distant = enemy(run, { pos: { c: 0, r: 0 } })
  run.currentRoom.tile(target.pos).revealed = false
  run.applyStatus(source, 'enemy-poison', { layers: trigger === 'poison-death' ? 1 : 4, turns: 17, damage: { mode: 'fixed', value: 1 } })
  if (trigger === 'move') assert(run._moveEnemy(source, { c: 5, r: 3 }))
  if (trigger === 'knockback') assert(run._knockbackEnemy(source).moved)
  if (trigger === 'death') run._damageEnemy(source, 100)
  if (trigger === 'poison-death') run._tickEnemyPoison(run._statusClockSnapshot())
  const spread = getStatus(target, 'enemy-poison')
  assert(spread, trigger); assert.equal(spread.turns, 17); assert.equal(spread.layers, trigger === 'poison-death' ? 1 : 4)
  assert.equal(getStatus(distant, 'enemy-poison'), null)
  assert.equal(getStatus(excluded, 'enemy-poison').layers, trigger === 'poison-death' ? 7 : 8)
  spread.damage.value = 9; assert.equal(source.statuses['enemy-poison']?.damage.value || 1, 1)
  consumeStatus(target, 'enemy-poison'); assert.equal(getStatus(source, 'enemy-poison')?.layers || 0, trigger === 'poison-death' ? 0 : 4)
}
// Seeker finds the nearest concealed enemy relative to its target, increments real flip count.
{
  const run = fixture(), weapon = add(run, 'demon-seeker'); add(run, 'r-pill-ticket')
  const target = enemy(run), nearest = enemy(run, { pos: { c: 5, r: 3 } }), far = enemy(run, { pos: { c: 0, r: 0 } })
  run.currentRoom.tile(nearest.pos).revealed = false; run.currentRoom.tile(far.pos).revealed = false
  attack(run, weapon, target)
  assert(run.currentRoom.isRevealed(nearest.pos)); assert(!run.currentRoom.isRevealed(far.pos))
  assert.equal(run.itemRules.expansion.state.cardsRevealed, 1)
}
// Plain phase armor only contributes through the separate adjacent armor relic.
{
  const run = fixture(), weapon = add(run, 'bone-knife', 2, 0)
  add(run, 'phase-armor', 3, 0); add(run, 'r-armor-ring', 7, 3)
  const target = enemy(run); run.player.armor = 0
  attack(run, weapon, target); assert.equal(run.player.armor, 1)
  attack(run, weapon, target); assert.equal(run.player.armor, 2)
  weapon.attribute = 'scorch'; attack(run, weapon, target); assert.equal(run.player.armor, 3)
}
// Renewal stacks with old armor-break/refund hooks, cooldown counts received attacks, excludes dodge.
{
  const run = fixture(); add(run, 'renewal-armor'); add(run, 'red-shield'); add(run, 'r-guard-return')
  const target = enemy(run, { attack: 3 })
  run.player.hp = 100; run.player.armor = 1
  run._damagePlayer(1, { source: 'enemy:attack', enemy: target })
  assert.equal(run.player.armor, 6); assert.equal(run.itemRules.state.buffs['red-shield'], undefined)
  run.applyStatus(run.player, 'dodge', { layers: 1 })
  run._damagePlayer(1, { source: 'enemy:attack', enemy: target })
  assert.equal(run.itemRules.expansion.state.attacksReceived, 1)
  for (let index = 0; index < 4; index++) {
    run.player.armor = 1; run._damagePlayer(1, { source: 'enemy:attack', enemy: target })
    assert.equal(run.player.armor, 1)
  }
  run.player.armor = 1; run._damagePlayer(1, { source: 'enemy:attack', enemy: target })
  assert.equal(run.player.armor, 6)
}
// Shield generation goes to inventory or stash; token snapshots armor at use, rounds spending upward.
{
  const run = fixture(), weapon = add(run, 'bone-knife', 2, 0)
  add(run, 'mountain-shield', 3, 0)
  attack(run, weapon, enemy(run))
  const token = run.backpack.items.find(item => item.id === 'shield-bash'); assert(token)
  const target = enemy(run, { pos: { c: 3, r: 4 } }); run.player.armor = 7
  select(run, token); assert(run.useSelected()); assert(run._throwConsumable(target.pos))
  assert.equal(target.hp, 93); assert.equal(run.player.armor, 3)
  assert.equal(run.backpack.placementOf(token.uid), null)
  while (run.backpack.usedCells < run.backpack.capacity) add(run, 'food-3')
  attack(run, weapon, target)
  assert(run.inventoryStash.some(item => item.id === 'shield-bash'))
}
// Maximum range includes mirror bonuses and distance rewards use actual attack position.
{
  const run = fixture(), weapon = add(run, 'bounty-bow', 2, 0)
  add(run, 'farwatch-armor', 3, 0); add(run, 'r-range-mirror', 1, 0); add(run, 'r-extreme-range', 7, 3)
  assert.equal(run.weaponRange(weapon), 4)
  run.player.pos = { c: 1, r: 3 }; run.player.gold = 0; run.player.armor = 0
  const target = enemy(run, { hp: 6, pos: { c: 5, r: 3 } })
  attack(run, weapon, target)
  assert.equal(run.player.gold, 1); assert.equal(run.player.armor, 4)
  const near = enemy(run, { pos: { c: 2, r: 3 } })
  assert.equal(run.itemRules.attackContext(weapon, near).bonusDamage, 0)
}
// Scout flips two distinct actual cards, including trap effects and pill-ticket counts.
{
  const run = fixture(), weapon = add(run, 'scouting-bow'); add(run, 'r-pill-ticket')
  run.player.pos = { c: 1, r: 3 }
  const target = enemy(run, { hp: 1, pos: { c: 4, r: 3 } })
  const positions = [{ c: 4, r: 4 }, { c: 5, r: 4 }]
  for (const pos of positions) run.currentRoom.tile(pos).revealed = false
  run.currentRoom.addEntity({ id: 'expansion-trap', kind: 'trap', trapId: 'explosion', pos: positions[0] })
  const before = run.player.hp
  attack(run, weapon, target)
  assert(positions.every(pos => run.currentRoom.isRevealed(pos)))
  assert.equal(run.itemRules.expansion.state.cardsRevealed, 2)
  assert(run.player.hp < before)
}
// Gold armor reacts to a picked-up pile, not kill rewards; coin armor handles every damage source.
{
  const run = fixture(); add(run, 'gold-pick-armor'); run.player.armor = 0
  run.currentRoom.addEntity({ id: 'expansion-gold', kind: 'gold', amount: 4, pos: { c: 4, r: 3 } })
  run._pickUp(run.currentRoom.entity('expansion-gold'))
  assert.equal(run.player.armor, 1)
}
{
  const run = fixture(), armor = add(run, 'coin-armor', 2, 0), pouch = add(run, 'money-pouch', 3, 0)
  run.player.gold = 2; run.player.hp = 30; run.player.armor = 0
  run._damagePlayer(3, { source: 'trap:explosion' }); assert.equal(run.player.hp, 29)
  run._damagePlayer(1, { source: 'trap:poison-fog', ignoreArmor: true }); assert.equal(run.player.hp, 29)
  assert.equal(run.player.gold, 0)
  run._damagePlayer(3, { source: 'enemy:attack' }); assert.equal(run.player.hp, 26)
  run.player.gold = 1; run.backpack.removeByUid(pouch.uid); run.inventoryStash.push(pouch)
  run._damagePlayer(3, { source: 'enemy:attack' }); assert.equal(run.player.hp, 23); assert.equal(run.player.gold, 1)
  assert(run.itemRules.has(armor.id))
}
// Furnace, bath, loot and flip rewards use exact counters; full-bag reward safely stages.
{
  const run = fixture(); add(run, 'r-furnace'); add(run, 'bath-robe'); add(run, 'r-pill-ticket'); add(run, 'r-loot-pouch')
  run.player.armor = 0
  for (let index = 0; index < 2; index++) { const food = add(run, 'food-3'); select(run, food); assert(run.useSelected()) }
  assert.equal(run.player.armor, 2)
  assert.equal(run.backpack.items.filter(item => item.tier === 2 && item.type === 'throwable').length, 1)
  for (let index = 0; index < 5; index++) {
    const pos = { c: index, r: 0 }; run.currentRoom.tile(pos).revealed = false; run._revealTile(pos)
  }
  const rewardId = randomConsumableOfTier(1, run.random).id
  assert.equal(run.backpack.items.filter(item => item.id === rewardId).length, 1)
  const target = enemy(run, { hp: 1 }); run._damageEnemy(target, 1)
  assert.equal(run.backpack.items.filter(item => item.id === rewardId).length, 2)
  while (run.backpack.usedCells < run.backpack.capacity) add(run, 'food-3')
  run._damageEnemy(enemy(run, { hp: 1 }), 1)
  assert(run.inventoryStash.some(item => item.tier === 1))
}
// Clockwise chains consume originals in order and exclude generated replacements from this turn.
{
  const run = fixture(); add(run, 'r-chain-drink', 2, 1); add(run, 'r-furnace', 7, 3); add(run, 'bath-robe', 5, 0)
  const first = add(run, 'food-3', 2, 0), second = add(run, 'food-5', 3, 0), third = add(run, 'food-7', 3, 1)
  assert.deepEqual(run.consumables.chainPlan(first).map(item => item.uid), [second.uid, third.uid])
  run.player.armor = 0; run.player.energy = 0
  select(run, first); assert(run.useSelected())
  assert.equal(run.globalTurn, 0); assert.equal(run.attackCount, 0)
  assert.equal(run.player.energy, 6); assert.equal(run.player.armor, 3)
  assert([first, second, third].every(item => !run.backpack.placementOf(item.uid)))
  assert.equal(run.backpack.items.filter(item => item.tier === 2).length, 1)
  assert.equal(run.itemRules.expansion.state.consumedTierOne, 3)
}
// Free target effects reuse valid target, cost no launcher energy, retain intrinsic item costs.
{
  const run = fixture(); add(run, 'r-chain-drink', 2, 1); add(run, 'r-launcher', 4, 0); add(run, 'bath-robe', 5, 0)
  const food = add(run, 'food-3', 2, 0), bomb = add(run, 'explosive', 3, 0)
  const target = enemy(run); run._synchronizeBattle(); run.player.energy = 1; run.player.armor = 0
  select(run, food); assert(run.useSelected())
  assert.equal(target.hp, 90); assert.equal(run.player.energy, 4); assert.equal(run.player.armor, 4)
  assert.equal(run.backpack.placementOf(bomb.uid), null); assert.equal(run.globalTurn, 0)
}
// No valid target leaves the next item intact; no recursion through missing target or player death.
{
  const run = fixture(); add(run, 'r-chain-drink', 2, 1)
  const food = add(run, 'food-3', 2, 0), poison = add(run, 'poison', 3, 0), later = add(run, 'food-5', 3, 1)
  select(run, food); assert(run.useSelected())
  assert(run.backpack.placementOf(poison.uid)); assert(run.backpack.placementOf(later.uid))
  assert.equal(run.globalTurn, 0)
}
// Launcher boosts every tier-II damage component; invalid/insufficient-energy use is atomic.
{
  const run = fixture(); add(run, 'r-chain-drink', 2, 1)
  const wine = add(run, 'rage-wine', 2, 0), food = add(run, 'food-3', 3, 0)
  run.player.hp = 2; run.player.energy = 0
  select(run, wine); assert(run.useSelected())
  assert(run.gameOver); assert(run.backpack.placementOf(food.uid)); assert.equal(run.player.energy, 0)
  assert.equal(run.globalTurn, 0)
}
{
  const run = fixture(); add(run, 'r-chain-drink', 2, 1)
  const food = add(run, 'food-3', 2, 0), teleport = add(run, 'teleport', 3, 0)
  select(run, food); assert(run.useSelected())
  assert.deepEqual(run.player.pos, { c: 3, r: 2 }); assert.equal(run.globalTurn, 0)
  assert.equal(run.backpack.placementOf(teleport.uid), null)
}
// Ambushes are real reveals and do not bypass the fifth-card reward counter.
{
  const run = fixture(); add(run, 'r-pill-ticket')
  run.itemRules.expansion.state.cardsRevealed = 4
  const hidden = enemy(run, { behavior: 'ambush' }); run.currentRoom.tile(hidden.pos).revealed = false
  run._triggerAmbushes(run.player.pos)
  assert.equal(run.itemRules.expansion.state.cardsRevealed, 5)
  assert(run.backpack.items.some(item => item.tier === 1))
  run._triggerAmbushes(run.player.pos); assert.equal(run.itemRules.expansion.state.cardsRevealed, 5)
}
// Launcher boosts every tier-II damage component; invalid/insufficient-energy use is atomic.
for (const id of ['poison', 'explosive', 'thunder-charm']) {
  const run = fixture(), item = add(run, id, 2, 0); add(run, 'r-launcher', 3, 0)
  const target = enemy(run), bounce = enemy(run, { pos: { c: 5, r: 3 } })
  run._synchronizeBattle()
  select(run, item); assert(run.useSelected()); run.player.energy = 1
  assert.equal(run._throwConsumable(target.pos), false)
  assert(run.backpack.placementOf(item.uid)); assert.equal(run.globalTurn, 0); assert.equal(run.player.energy, 1)
  run.player.energy = 3
  assert.equal(run._throwConsumable({ c: 0, r: 0 }), false)
  assert.equal(run.player.energy, 3)
  assert(run._throwConsumable(target.pos)); assert.equal(run.player.energy, 0); assert.equal(run.globalTurn, 0)
  if (id === 'poison') assert.equal(getStatus(target, 'enemy-poison').damage, Math.floor(item.poisonDamage * 1.5))
  if (id === 'explosive') { assert.equal(target.hp, 85); assert.equal(bounce.hp, 85) }
  if (id === 'thunder-charm') {
    assert.equal(target.hp, 100 - Math.floor(item.damage * 1.5)); assert.equal(bounce.hp, 100 - Math.floor(item.bounceDamage * 1.5))
  }
}
// Save roundtrip retains item counters, weapon identity and generated tokens. Previous schema restarts.
{
  const run = fixture(), weapon = add(run, 'bone-knife'); add(run, 'r-single-seal'); add(run, 'shield-bash')
  attack(run, weapon, enemy(run))
  Object.assign(run.itemRules.expansion.state, { attacksReceived: 12, lastArmorRenewal: 9, consumedTierOne: 3, cardsRevealed: 4 })
  const previous = globalThis.localStorage
  let payload = JSON.stringify(run.serialize()), deleted = 0
  globalThis.localStorage = { getItem: () => payload, setItem: (_key, value) => { payload = value }, removeItem: () => { deleted++; payload = null } }
  try {
    const loaded = new GameRun({ autoLoad: true })
    assert.equal(deleted, 0); assert.equal(loaded.weaponEnergyCost(loaded.backpack.items.find(item => item.uid === weapon.uid)), 1)
    assert.deepEqual(loaded.itemRules.expansion.state, run.itemRules.expansion.state)
    assert(loaded.backpack.items.some(item => item.id === 'shield-bash'))
    payload = JSON.stringify({ ...run.serialize(), version: SAVE_VERSION - 1 })
    const restarted = new GameRun({ autoLoad: true })
    assert.equal(deleted, 1); assert.equal(restarted.globalTurn, 0)
    assert(restarted.backpack.items.some(item => item.id === 'money-pouch'))
  } finally { globalThis.localStorage = previous }
}

console.log('expansion-check passed: 30 items, poison events, armor cycles, distance/gold rewards, consumable chains, targeting and saves')
