import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { fixture, add, select, enemy, round, settleAnimations } from './item-test-helpers.mjs'
import { GameRun } from '../src/game/run.js'
import { ALL_ITEM_DEFS, createEnemyById, makeItemById, randomNeutralItem } from '../src/game/data/content.js'
import { consumableTargetCells } from '../src/game/rules/attack-range.js'
import { createMerchantEntity } from '../src/game/data/merchants.js'
import { enemyOverheadHints } from '../src/game/data/enemy-features.js'

// The starter sword can defeat the early plant while recovering energy,
// without a relic, another weapon, or a permanently regenerating stalemate.
{
  const run = fixture()
  const weapon = add(run, 'rust-sword')
  select(run, weapon)
  const bud = createEnemyById('rootrot-bud', { c: 4, r: 3 })
  bud.noLoot = true
  bud.noExperience = true
  run.currentRoom.addEntity(bud)
  let attacks = 0
  while (run.currentRoom.entity(bud.id) && !run.gameOver && run.globalTurn < 30) {
    if (run.player.energy >= weapon.energyCost) {
      assert(run._attack(bud))
      run.bus.emit('animate:attack-complete', { actor: 'player' }); settleAnimations(run)
      attacks++
    } else round(run)
  }
  assert.equal(run.gameOver, false)
  assert.equal(run.currentRoom.entity(bud.id), null)
  assert.equal(attacks, 7)
  assert(run.player.hp >= 8, 'weaker counter bonus still leaves a useful health reserve')
}

{
  const run = new GameRun({ autoLoad: false })
  run.initialRelicChoices = []
  for (const entity of [...run.currentRoom.entities.values()]) run.currentRoom.removeEntity(entity.id)
  for (const row of run.currentRoom.tiles) for (const tile of row) { tile.revealed = true; tile.terrain = 'plain' }
  const pouch = run.backpack.items.find(item => item.id === 'money-pouch')
  assert(pouch)
  assert.deepEqual(pouch.shape, [[1]])
  run.player.gold = 37
  assert(run.commitInventoryDrop(pouch, 31))
  assert(run.moveInventoryToStash(pouch.uid))
  const turn = run.globalTurn
  assert.equal(run.discardInventoryItem(pouch.uid), false)
  assert.equal(run.globalTurn, turn)
  assert.equal(run.player.gold, 37)
  assert(run.commitInventoryDrop(pouch, 31))
  assert.equal(run.discardInventoryItem(pouch.uid), false)
  const merchant = createMerchantEntity('merchant', { c: 0, r: 0 })
  run.currentRoom.addEntity(merchant)
  run.phase = 'merchant'; run.merchant = { entityId: merchant.id }
  select(run, pouch)
  assert.equal(run.sellSelectedMerchantItem(), false)
  assert(run.backpack.placementOf(pouch.uid))
}

// Every equipped defense contributes once; stashed gear and revisits contribute nothing.
for (const definition of ALL_ITEM_DEFS.filter(item => item.type === 'defense')) {
  const run = fixture(), armor = add(run, definition.id)
  assert.equal(armor.armorValue, 1)
  run.itemRules.enter(true)
  assert.equal(run.player.armor, 1)
  run.itemRules.enter(false)
  assert.equal(run.player.armor, 1)
  assert(run.moveInventoryToStash(armor.uid))
  run.itemRules.enter(true)
  assert.equal(run.player.armor, 1)
}
{
  const run = fixture()
  add(run, 'light-armor'); add(run, 'wood-shield')
  run.itemRules.enter(true)
  assert.equal(run.player.armor, 2)
}

for (const points of [3, 5, 7, 9]) {
  const run = fixture(), food = add(run, `food-${points}`)
  assert.equal(food.name, { 3: '\u7cbd\u5b50', 5: '\u70e4\u996d\u56e2', 7: '\u85af\u9999\u996d\u5305', 9: '\u8089\u5e72\u996d\u997c' }[points])
  assert.equal(food.tier, 1)
  run.player.energy = 1
  select(run, food); assert(run.useSelected())
  assert.equal(run.player.energy, Math.min(6, 1 + points))
  assert.equal(run.globalTurn, 0)
  assert.equal(run.backpack.placementOf(food.uid), null)
  assert.equal(run.useSelected(), false)
}
assert.equal(makeItemById('energy-potion'), null)
let tier1 = 0, tier2 = 0
for (let i = 0; i < 350; i++) {
  const item = randomNeutralItem(1, () => (i + 0.5) / 350)
  if (item.tier === 1) tier1++
  else if (item.tier === 2) tier2++
  else assert.fail('Every consumable has a tier')
}
assert.equal(tier1, 320); assert.equal(tier2, 30)

function aim(run, item) {
  select(run, item)
  const turn = run.globalTurn
  assert(run.useSelected())
  assert.equal(run.itemTargeting, true)
  assert.equal(run.globalTurn, turn)
}
{
  const run = fixture(), poison = add(run, 'poison')
  const target = enemy(run, { pos: { c: 3, r: 5 }, attack: 2, actionDelay: 0, attackCooldown: 2, range: 1 })
  aim(run, poison)
  assert.equal(run.clickTile(0, 0), false)
  assert.equal(run.clickTile(3, 4), false) // Poison requires an enemy.
  assert(run.backpack.placementOf(poison.uid))
  assert.equal(run.globalTurn, 0)
  assert(run.clickTile(3, 5))
  assert.equal(run.globalTurn, 0)
  assert.equal(run.attackCount, 0)
  assert.equal(target.hp, 100) // Out of range: no poison tick on idle.
  assert.equal(target.itemPoisonTurns, 100)
  assert(enemyOverheadHints(target).some(hint => hint.label === '\u4e2d\u6bd2'))
  round(run); round(run); assert.equal(target.hp, 100)
  run.player.pos = { c: 3, r: 4 }
  round(run); assert.equal(target.hp, 95)
  assert.equal(target.itemPoisonTurns, 99)
  round(run); round(run); round(run)
  assert.equal(target.hp, 80)
  assert.equal(target.itemPoisonTurns, 96)
  assert(enemyOverheadHints(target).some(hint => hint.label === '\u4e2d\u6bd2'))
}
{
  const run = fixture(), poison = add(run, 'poison')
  const target = enemy(run, { hp: 5, attack: 3, actionDelay: 0, traits: ['heavy-armor'] })
  aim(run, poison)
  assert(run.clickTile(4, 3))
  assert.equal(run.currentRoom.entity(target.id), target)
  round(run)
  assert.equal(run.currentRoom.entity(target.id), null)
  assert.equal(run.player.hp, 20) // Lethal poison prevents the pending attack.
}
{
  const run = fixture(), bomb = add(run, 'explosive')
  const adjacent = enemy(run, { pos: { c: 4, r: 4 } })
  const hidden = enemy(run, { pos: { c: 5, r: 5 } })
  const outside = enemy(run, { pos: { c: 2, r: 5 } })
  const corpse = enemy(run, { hp: 0, downed: true, reviveTurns: 2, pos: { c: 5, r: 4 } })
  run.currentRoom.tile(hidden.pos).revealed = false
  aim(run, bomb)
  assert(consumableTargetCells(run.currentRoom, run.player.pos, bomb).some(p => p.c === 3 && p.r === 3))
  assert(consumableTargetCells(run.currentRoom, run.player.pos, bomb).some(p => p.c === 1 && p.r === 5))
  assert(run.clickTile(4, 5)) // Empty cell with enemies in its eight-cell neighborhood.
  assert.equal(adjacent.hp, 90); assert.equal(hidden.hp, 90); assert.equal(outside.hp, 100)
  assert.equal(run.currentRoom.entity(corpse.id), null)
  assert(run.currentRoom.isRevealed(hidden.pos))
  assert.equal(run.player.energy, 6)
  assert.equal(run.globalTurn, 0)
}
{
  const run = fixture(), thunder = add(run, 'thunder-charm')
  const primary = enemy(run, { hp: 16, pos: { c: 3, r: 5 } })
  const nearest = enemy(run, { pos: { c: 4, r: 5 } })
  const farther = enemy(run, { pos: { c: 2, r: 3 } })
  aim(run, thunder); assert(run.clickTile(3, 5))
  assert.equal(run.currentRoom.entity(primary.id), null)
  assert.equal(nearest.hp, 95); assert.equal(farther.hp, 100)
  assert.equal(run.globalTurn, 0)
}

// Compatible saves preserve placement and values without migrating anything.
{
  const run = fixture(), food = add(run, 'food-3'), armor = add(run, 'light-armor')
  add(run, 'money-pouch')
  run.player.gold = 21
  const target = enemy(run, { hp: 8 })
  target.hp = 4
  const oldStorage = globalThis.localStorage
  let payload = JSON.stringify(run.serialize())
  globalThis.localStorage = { getItem: () => payload, setItem: (_key, value) => { payload = value }, removeItem: () => {} }
  try {
    const loaded = new GameRun({ autoLoad: true })
    assert.equal(loaded.player.gold, 21)
    assert.equal(loaded.backpack.items.filter(item => item.id === 'money-pouch').length, 1)
    assert.equal(loaded.backpack.placementOf(food.uid).item.id, 'food-3')
    assert.equal(loaded.backpack.placementOf(armor.uid).item.armorValue, 1)
    assert.equal(loaded.currentRoom.entity(target.id).hp, 4)
    assert.equal(loaded.currentRoom.entity(target.id).maxHp, 8)
    const pouch = loaded.backpack.items.find(item => item.id === 'money-pouch')
    assert(loaded.moveInventoryToStash(pouch.uid))
    loaded._changed()
    const reloaded = new GameRun({ autoLoad: true })
    assert.equal(reloaded.inventoryStash.filter(item => item.id === 'money-pouch').length, 1)
    assert.equal(reloaded.backpack.items.filter(item => item.id === 'money-pouch').length, 0)
    assert.equal(reloaded.currentRoom.entity(target.id).hp, 4)
    assert.equal(reloaded.discardInventoryItem(pouch.uid), false)
    assert.equal(new Set([...reloaded.backpack.items, ...reloaded.inventoryStash].map(item => item.uid)).size,
      reloaded.backpack.length + reloaded.inventoryStash.length)
  } finally { globalThis.localStorage = oldStorage }
}

// A full backpack preserves its stashed pouch without injecting any items.
{
  const run = fixture()
  for (let i = 0; i < run.backpack.capacity; i++) add(run, 'food-3')
  run.inventoryStash.push(makeItemById('money-pouch'))
  const payload = JSON.stringify(run.serialize())
  const previous = globalThis.localStorage
  globalThis.localStorage = { getItem: () => payload, setItem: () => {}, removeItem: () => {} }
  try {
    const loaded = new GameRun({ autoLoad: true })
    assert.equal(loaded.backpack.length, 32)
    assert.equal(loaded.inventoryStash.length, 1)
    assert.equal(loaded.inventoryStash[0].id, 'money-pouch')
  } finally { globalThis.localStorage = previous }
}
// Render the actual Vue badges to verify decoded Chinese and live numeric values.
{
  const source = await readFile(new URL('../src/ui/ItemValueBadge.vue', import.meta.url), 'utf8')
  const { descriptor } = parse(source)
  const compiled = compileScript(descriptor, { id: 'basic-rules-qa', inlineTemplate: true }).content
    .replaceAll('from "vue"', `from ${JSON.stringify(import.meta.resolve('vue'))}`)
    .replaceAll("from 'vue'", `from ${JSON.stringify(import.meta.resolve('vue'))}`)
  const { default: Badge } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
  const render = (id, gold = 0) => renderToString(createSSRApp(Badge, { item: makeItemById(id), gold }))
  const pouchHtml = await render('money-pouch', 123)
  assert(pouchHtml.includes('\u94b1\u888b: 123'))
  assert(pouchHtml.includes('>123</span>'))
  const armorHtml = await render('wood-shield')
  assert(armorHtml.includes('\u62a4\u7532\u503c'))
  assert(armorHtml.includes('>1</span>'))
  assert((await render('food-9')).includes('>9</span>'))
  assert((await render('poison')).includes('>II</span>'))
  assert((await render('health-potion')).includes('>I</span>'))
}
console.log('basic-rules-check passed: health, pouch, room armor, food, rarity, targeting, poison, area damage, bounce, saves and Vue badges')
