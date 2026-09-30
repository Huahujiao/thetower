import assert from 'node:assert/strict'
import { fixture, add, enemy, attack, select } from './item-test-helpers.mjs'
import { ALL_ITEM_DEFS, getItemDefinition, makeItem } from '../src/game/data/content.js'
import { catalogContent } from '../src/ui/wiki-catalog.js'

const appearances = ['sword', 'dagger', 'axe', 'bow']
const attributes = ['scorch', 'wither', 'drown']
for (const weapon of ALL_ITEM_DEFS.filter(item => item.type === 'weapon')) {
  assert(appearances.includes(weapon.appearance))
  assert(attributes.includes(weapon.attribute))
  assert(Number.isInteger(weapon.energyCost) && weapon.energyCost >= 1)
}

// Appearance never controls authored costs, scope range or weight bonuses.
for (const appearance of appearances) {
  const run = fixture(), weapon = add(run, 'gold-hook', 0, 0)
  weapon.appearance = appearance
  weapon.energyCost = 7
  assert.equal(makeItem({ ...getItemDefinition('gold-hook'), appearance, energyCost: 7 }).energyCost, 7)
  add(run, 'scope', 1, 0); add(run, 'weight', 0, 2)
  assert.equal(run.weaponRange(weapon), 2)
  assert.equal(run.weaponEnergyCost(weapon), 8)
  assert.equal(run.itemRules.attackContext(weapon, enemy(run)).flat, 2)
  assert(run.itemRules.activeAdjacencyLinks().some(link => link.source.id === 'scope' && link.target === weapon))
  assert(run.showItemDetail(weapon))
  assert.deepEqual(run.detailPanel.badges, ['\u707c\u70ed', '\u2605'])
}

// Wrist checks the independent base cost and live four-way geometry, with a
// shared minimum of one even when other discounts are present.
{
  const run = fixture(), weapon = add(run, 'bone-knife', 0, 0)
  add(run, 'r-heavy-wrist', 7, 3)
  weapon.energyCost = 4
  assert.equal(run.weaponEnergyCost(weapon), 4)
  weapon.energyCost = 5
  assert.equal(run.weaponEnergyCost(weapon), 4)
  weapon.energyCost = 8
  assert.equal(run.weaponEnergyCost(weapon), 7)
  const scope = add(run, 'scope', 1, 0)
  assert.equal(run.weaponEnergyCost(weapon), 8)
  run.backpack.move(scope.uid, 5, 0)
  run.itemRules.buff('test', { discount: 20 })
  assert.equal(run.weaponEnergyCost(weapon), 1)
}

// Scope can activate disc and clip on a formerly range-one weapon. Combat,
// explanatory text and adjacency ribbons all use the same effective range.
{
  const run = fixture(), weapon = add(run, 'bone-knife', 2, 1)
  const disc = add(run, 'range-disc', 2, 0), clip = add(run, 'steady-clip', 3, 1)
  const target = enemy(run, { pos: { c: 5, r: 3 } })
  assert.equal(run.itemRules.adjacent(weapon, 'range-disc'), false)
  assert.equal(run.itemRules.adjacent(weapon, 'steady-clip'), false)
  assert(!run.itemRules.activeAdjacencyLinks().some(link => link.target === weapon && [disc.uid, clip.uid].includes(link.source.uid)))
  const scope = add(run, 'scope', 1, 1)
  assert.equal(run.weaponRange(weapon), 2)
  assert.equal(run.itemRules.adjacent(weapon, 'range-disc'), true)
  assert.equal(run.itemRules.adjacent(weapon, 'steady-clip'), true)
  assert(run.itemRules.weaponLines(weapon).some(line => line.includes('\u6d4b\u8ddd\u76d8')))
  assert.equal(run.itemRules.activeAdjacencyLinks().filter(link => link.target === weapon && [disc.uid, clip.uid].includes(link.source.uid)).length, 2)
  attack(run, weapon, target)
  assert.equal(target.hp, 97); assert.equal(run.itemRules.state.sniperCharge, 2)
  const near = enemy(run)
  attack(run, weapon, near)
  assert.equal(near.hp, 95); assert.equal(run.itemRules.state.sniperCharge, 0)
  run.backpack.removeByUid(scope.uid)
  assert.equal(run.weaponRange(weapon), 1)
  assert.equal(run.itemRules.attackContext(weapon, near).flat, 0)
  assert(!run.itemRules.activeAdjacencyLinks().some(link => link.target === weapon && [disc.uid, clip.uid].includes(link.source.uid)))
}
{
  const run = fixture(), weapon = add(run, 'gold-hook', 0, 0)
  add(run, 'range-disc', 1, 0); add(run, 'steady-clip', 1, 1); add(run, 'r-scales', 7, 3)
  assert.equal(run.weaponRange(weapon), 2)
  assert.equal(run.itemRules.adjacent(weapon, 'range-disc'), true)
  add(run, 'bone-knife', 5, 0)
  assert.equal(run.weaponRange(weapon), 1)
  assert.equal(run.itemRules.adjacent(weapon, 'range-disc'), false)
}
{
  const run = fixture(), weapon = add(run, 'bone-knife', 0, 0)
  weapon.range = 2; weapon.attack = 1
  add(run, 'range-disc', 1, 0)
  const target = enemy(run, { pos: { c: 5, r: 3 }, traits: ['heavy-armor'] })
  attack(run, weapon, target)
  assert.equal(run.itemRules.state.sniperCharge || 0, 0)
  target.traits = []
  run.applyStatus(target, 'dodge')
  attack(run, weapon, target)
  assert.equal(run.itemRules.state.sniperCharge || 0, 0)
}

// Any visual appearance can knock back. Collisions hurt only the pushed enemy;
// the nail adds delay only on collision, and dodge prevents both effects.
for (const appearance of appearances) {
  for (const attachment of ['chain', 'bone-nail']) {
    const run = fixture(), weapon = add(run, 'gold-hook', 0, 0)
    weapon.appearance = appearance; weapon.range = 2
    add(run, attachment, 1, 0)
    run.player.pos = { c: run.currentRoom.width - 3, r: 3 }
    const target = enemy(run, { pos: { c: run.currentRoom.width - 1, r: 3 } })
    select(run, weapon)
    assert(run._attack(target))
    assert.equal(target.hp, 95)
    assert.equal(target.actionDelay, attachment === 'bone-nail' ? 101 : 100)
  }
}
for (const evaded of [false, true]) {
  const run = fixture(), weapon = add(run, 'gold-hook', 0, 0)
  weapon.range = 2
  add(run, 'bone-nail', 1, 0)
  run.player.pos = { c: 1, r: 3 }
  const target = enemy(run, { pos: { c: 3, r: 3 } })
  if (evaded) run.applyStatus(target, 'dodge')
  select(run, weapon)
  assert(run._attack(target))
  assert.deepEqual(target.pos, { c: evaded ? 3 : 4, r: 3 })
  assert.equal(target.actionDelay, 100)
}

assert(!catalogContent('weapons').includes('<dt>\u7c7b\u522b</dt>'))
assert(getItemDefinition('scope').description.includes('\u76f8\u90bb\u6b66\u5668'))
assert(getItemDefinition('r-heavy-wrist').description.includes('\u57fa\u7840\u4f53\u529b\u6d88\u8017\u22655'))
console.log('weapon-rules-check passed: independent costs, appearances, universal attachments, effective range, knockback and details')
