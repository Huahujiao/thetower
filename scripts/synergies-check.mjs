import assert from 'node:assert/strict'
import { fixture, add, enemy, attack } from './item-test-helpers.mjs'
import { activeConduits, conduitCapacity, suggestedSynergyId } from '../src/game/rules/synergies.js'
import { buildRoomRewardChoices } from '../src/game/data/rewards.js'
import { GameRun, SAVE_KEY } from '../src/game/run.js'
import { itemSpriteSources } from '../src/ui/item-sprites.js'
import { getItemDefinition } from '../src/game/data/content.js'

// Each source works without a named set. Other owned items do not gate it.
{
  const run = fixture()
  const blade = add(run, 'coin-blade')
  const target = enemy(run)
  run.player.gold = 12
  assert.equal(run.itemRules.attackContext(blade, target).flat, 2)
  run.player.gold = 11
  assert.equal(run.itemRules.attackContext(blade, target).flat, 0)
  add(run, 'r-money-scale')
  assert.equal(run.itemRules.attackContext(blade, target).flat, 0)
  add(run, 'r-gold-hook')
  const before = run.player.gold
  target.hp = 1
  attack(run, blade, target)
  assert.equal(run.player.gold, before + 1)
  assert.equal(run.itemRules.room.goldHookKills, 1)
}

{
  const run = fixture()
  add(run, 'r-ledger')
  assert.equal(run.merchantPrice({ price: 9 }), 8)
  add(run, 'r-trade-voucher')
  assert.equal(run.merchantPrice({ price: 9 }), 7)
  assert.equal(run.merchantPrice({ price: 1 }), 1)
  assert(getItemDefinition('coin-blade').description.includes('至少12金币'))
  assert(getItemDefinition('r-money-scale').description.includes('额外获得1金币'))
}

{
  const run = fixture()
  const maul = add(run, 'bell-maul', 0, 0)
  const normalCost = run.itemRules.cost(maul)
  add(run, 'r-heavy-wrist', 6, 0)
  assert.equal(run.itemRules.cost(maul), normalCost - 1)
  add(run, 'r-step-boots', 7, 0)
  add(run, 'r-turn-shield', 7, 1)
  const target = enemy(run, { hp: 100 })
  run.itemRules.move()
  assert.equal(run.itemRules.attackContext(maul, target).flat, 4)
  attack(run, maul, target)
  assert.equal(run.player.armor, 2)
}

// Defense, wire, and recipient can be of any applicable item type.
{
  const run = fixture()
  const sword = add(run, 'rust-sword', 0, 0)
  const wire = add(run, 'conduit', 1, 0)
  const shield = add(run, 'wood-shield', 2, 0)
  assert.equal(activeConduits(run.backpack).length, 1)
  assert.equal(conduitCapacity(run.backpack, sword), 3)
  run.itemRules.armor(2)
  assert.equal(run.itemRules.attackContext(sword, enemy(run)).conduitSpend, 2)
  run.backpack.move(shield.uid, 5, 0)
  run.itemRules.action('organize')
  assert.equal(activeConduits(run.backpack).length, 0)
  assert.equal(run.itemRules.state.conduitCharge, 0)
  run.backpack.move(shield.uid, 2, 0)
  run.backpack.move(wire.uid, 4, 0)
  assert.equal(conduitCapacity(run.backpack, sword), 0)
}

// A material applies to a weapon class, not to a prescribed weapon ID.
{
  const run = fixture()
  const bow = add(run, 'wood-bow', 0, 0)
  const disc = add(run, 'range-disc', 1, 0)
  add(run, 'steady-clip', 1, 1)
  const far = enemy(run, { pos: { c: 0, r: 3 } })
  attack(run, bow, far)
  assert.equal(run.itemRules.state.sniperCharge, 2)
  const near = enemy(run)
  assert.equal(run.itemRules.attackContext(bow, near).flat, 3)
  run.backpack.move(disc.uid, 7, 3)
  run.itemRules.action('organize')
  assert.equal(run.itemRules.attackContext(bow, near).sniperSpend, 0)
}

{
  const run = fixture()
  const spear = add(run, 'ember-spear', 0, 0)
  add(run, 'bone-nail', 1, 0)
  assert(run.itemRules.adjacent(spear, 'bone-nail'))
  assert(run.itemRules.weaponLines(spear).some((line) => line.includes('裂骨钉')))
}

{
  const run = fixture()
  const dagger = add(run, 'bone-knife', 0, 0)
  add(run, 'toxin-vial', 1, 0)
  assert(!run.itemRules.weaponLines(dagger).some((line) => line.includes('附毒持续3')))
  add(run, 'venom-sac', 0, 1)
  attack(run, dagger, enemy(run, { hp: 100 }))
  assert.equal(run.currentRoom.entityAt({ c: 4, r: 3 }).itemPoisonTurns, 2)
}

// Poison from one weapon can charge a relic spent by a different weapon.
{
  const run = fixture()
  const dagger = add(run, 'bone-knife', 0, 0)
  add(run, 'venom-sac', 1, 0)
  const sword = add(run, 'rust-sword', 3, 0)
  add(run, 'r-poison-hourglass', 5, 0)
  const target = enemy(run)
  attack(run, dagger, target)
  assert.equal(target.itemPoisonTurns, 1)
  assert.equal(run.itemRules.state.poisonCharge, 1)
  assert.equal(run.itemRules.attackContext(sword, target).poisonSpend, 1)
  attack(run, sword, target)
  assert.equal(run.itemRules.state.poisonCharge, 1) // The remaining poison tick charges the next attack.
}

// The pointer reads attributes across arbitrary weapon types.
{
  const run = fixture()
  const scorch = add(run, 'rust-sword')
  const wither = add(run, 'bone-knife')
  const drown = add(run, 'wood-bow')
  add(run, 'r-phase-pointer')
  const target = enemy(run, { hp: 200 })
  attack(run, scorch, target)
  attack(run, wither, target)
  attack(run, drown, target)
  assert.equal(run.itemRules.state.buffs['r-phase-pointer'].flat, 3)
  assert.equal(run.itemRules.cost(scorch), scorch.energyCost - 1)
  attack(run, scorch, target)
  assert.equal(run.itemRules.state.buffs['r-phase-pointer'], undefined)
}

{
  const run = fixture()
  const sword = add(run, 'rust-sword')
  const dagger = add(run, 'bone-knife')
  add(run, 'r-relay-badge')
  const target = enemy(run, { hp: 200 })
  attack(run, sword, target)
  assert.equal(run.itemRules.attackContext(dagger, target).flat, 1)
}

// Suggestions use loose effect tags only and respect floor requirements.
{
  const run = fixture()
  add(run, 'wood-bow')
  const suggestion = suggestedSynergyId(run.backpack.items, 'item', () => 0)
  assert(['ash-bow', 'eagle-bow', 'scope', 'range-disc', 'steady-clip'].includes(suggestion))
  const reward = buildRoomRewardChoices(run.relics, { floor: 1, type: 'supply', random: () => 0, items: run.backpack.items })
  assert.notEqual(reward.choices[0].itemId, 'range-disc')
  assert.equal(suggestedSynergyId([], 'item', () => 0), null)
}

// A saved run keeps individual item state and all second-batch artwork resolves.
{
  const ids = ['range-disc', 'steady-clip', 'bone-nail', 'toxin-vial',
    'r-heavy-wrist', 'r-step-boots', 'r-turn-shield', 'r-poison-hourglass']
  for (const id of ids) assert(itemSpriteSources({ id })?.medium)
  const run = fixture()
  add(run, 'r-poison-hourglass')
  run.itemRules.state.poisonCharge = 2
  const saved = JSON.stringify(run.serialize())
  const previous = globalThis.localStorage
  globalThis.localStorage = { getItem: (key) => key === SAVE_KEY ? saved : null, setItem() {}, removeItem() {} }
  try {
    const loaded = new GameRun()
    assert.equal(loaded.itemRules.state.poisonCharge, 2)
  } finally { globalThis.localStorage = previous }
}

console.log('synergies-check passed: independent effects, spatial links, status flow, rewards and persistence')
