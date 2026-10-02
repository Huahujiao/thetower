import assert from 'node:assert/strict'
import { fixture, add, enemy, attack } from './item-test-helpers.mjs'
import { activeConduits, conduitCapacity, forkBridgeActive, suggestedSynergyId } from '../src/game/rules/synergies.js'
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
  const hook = add(run, 'gold-hook')
  const before = run.player.gold
  target.hp = 1
  attack(run, hook, target)
  assert.equal(run.player.gold, before + 1)
  assert.equal(getItemDefinition('r-gold-hook'), null)
}

{
  const run = fixture()
  add(run, 'r-ledger')
  assert.equal(run.merchantPrice({ price: 9 }), 9)
  assert.equal(run.merchantRestockPrice({ restockPrice: 6 }), 4)
  add(run, 'r-trade-voucher')
  assert.equal(run.merchantPrice({ price: 9 }), 8)
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
  assert.equal(run.itemRules.attackContext(maul, target).flat, 2)
  attack(run, maul, target)
  assert.equal(run.player.armor, 0)
  run.itemRules.move()
  assert.equal(run.getStatus(run.player, 'dodge').layers, 1)
  assert.equal(run.getStatus(run.player, 'counter').damage, 5)
  run._enemyAttack(enemy(run, { attack: 1, pos: { c: 2, r: 3 } }))
  assert.equal(run.player.hp, 20)
  assert.equal(run.getStatus(run.player, 'counter').layers, 1)
}

{
  const run = fixture()
  add(run, 'r-turn-shield')
  run.itemRules.move()
  assert.equal(run.getStatus(run.player, 'counter'), null)
  run.itemRules.action('attack')
  run.itemRules.move()
  run._endTurn({ skipEnemyPhase: true, action: 'movement' })
  assert.equal(run.getStatus(run.player, 'counter'), null)
  assert.equal(run.player.armor, 0)
}

{
  const run = fixture()
  const sword = add(run, 'rust-sword', 0, 0)
  const fork = add(run, 'fork-connector', 1, 0)
  const shield = add(run, 'wood-shield', 2, 0)
  assert(forkBridgeActive(run.backpack, sword))
  assert.equal(run.itemRules.attackContext(sword, enemy(run)).flat, 1)
  run.backpack.move(shield.uid, 5, 0)
  assert.equal(forkBridgeActive(run.backpack, sword), false)
  assert.equal(run.itemRules.attackContext(sword, run.currentRoom.entityAt({ c: 4, r: 3 })).flat, 0)
  assert(run.backpack.placementOf(fork.uid))
}

{
  const run = fixture()
  add(run, 'conduit', 0, 0)
  add(run, 'wood-shield', 1, 0)
  add(run, 'r-guard-return')
  run.player.armor = 2
  run._damagePlayer(2, { source: 'enemy:attack', enemy: { range: 1 } })
  assert.equal(run.player.armor, 1)
  assert.equal(run.itemRules.state.conduitCharge, 1)
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
  add(run, 'venom-sac', 0, 1)
  attack(run, dagger, enemy(run, { hp: 100 }))
  assert.equal(run.currentRoom.entityAt({ c: 4, r: 3 }).itemPoisonTurns, 5)
}

// Poison from one weapon can be detonated and removed by another weapon.
{
  const run = fixture()
  const dagger = add(run, 'bone-knife', 0, 0)
  add(run, 'venom-sac', 1, 0)
  const sword = add(run, 'erosion-knife', 3, 0)
  const target = enemy(run)
  attack(run, dagger, target)
  assert.equal(target.itemPoisonTurns, 5)
  target.attack = 1
  run._enemyAttack(target)
  assert.equal(target.itemPoisonTurns, 4)
  const hp = target.hp
  attack(run, sword, target)
  assert.equal(target.hp, hp - 8)
  assert.equal(run.getStatus(target, 'enemy-poison'), null)
}

// Two arbitrary attributes enable switching; the named elemental weapons each work alone.
{
  const run = fixture()
  const scorch = add(run, 'rust-sword')
  const wither = add(run, 'bone-knife')
  add(run, 'r-phase-pointer')
  const target = enemy(run, { hp: 200 })
  attack(run, scorch, target)
  assert.equal(run.itemRules.state.buffs['r-phase-pointer'], undefined)
  attack(run, wither, target)
  assert.equal(run.itemRules.state.buffs['r-phase-pointer'].flat, 1)
  assert.equal(run.itemRules.cost(scorch), scorch.energyCost - 1)
  attack(run, scorch, target)
  assert.equal(run.itemRules.state.buffs['r-phase-pointer'].flat, 1)
  attack(run, scorch, target)
  assert.equal(run.itemRules.state.buffs['r-phase-pointer'], undefined)
}

{
  const run = fixture()
  const wither = add(run, 'bone-knife')
  const ember = add(run, 'triad-ember')
  const target = enemy(run, { hp: 200 })
  attack(run, wither, target)
  assert.equal(run.itemRules.attackContext(ember, target).flat, 1)
  const dagger = add(run, 'triad-wither')
  target.itemPoisonTurns = 2
  assert.equal(run.itemRules.attackContext(dagger, target).flat, 2)
}

{
  const run = fixture()
  const bow = add(run, 'triad-tide')
  const target = enemy(run, { hp: 200, pos: { c: 0, r: 3 } })
  attack(run, bow, target)
  assert.equal(run.player.energy, 8)
}

{
  const run = fixture()
  const sword = add(run, 'rust-sword', 0, 0)
  const dagger = add(run, 'bone-knife', 2, 0)
  add(run, 'r-relay-badge', 1, 0)
  const target = enemy(run, { hp: 200 })
  attack(run, sword, target)
  assert.equal(run.itemRules.attackContext(dagger, target).multiplier, 1.7)
}

// Suggestions use loose effect tags only and respect floor requirements.
{
  const run = fixture()
  add(run, 'wood-bow')
  const suggestion = suggestedSynergyId(run.backpack.items, 'item', () => 0)
  assert(getItemDefinition(suggestion)?.range >= 2 || ['scope', 'range-disc', 'steady-clip'].includes(suggestion))
  const reward = buildRoomRewardChoices(run.relics, { floor: 1, type: 'supply', random: () => 0, items: run.backpack.items })
  assert.notEqual(reward.choices[0].itemId, 'range-disc')
  assert.equal(suggestedSynergyId([], 'item', () => 0), null)
}

{
  const run = fixture()
  add(run, 'rust-sword')
  add(run, 'r-phase-pointer')
  const only = (...ids) => (id) => ids.includes(id)
  assert.equal(suggestedSynergyId(run.backpack.items, 'item', () => 0,
    only('ember-spear', 'bone-knife')), 'bone-knife')
  add(run, 'bone-knife')
  assert.equal(suggestedSynergyId(run.backpack.items, 'item', () => 0,
    only('ember-spear', 'wood-bow')), 'wood-bow')
}

// A saved run keeps individual item state and all second-batch artwork resolves.
{
  const ids = ['range-disc', 'steady-clip', 'bone-nail', 'toxin-vial',
    'r-heavy-wrist', 'r-step-boots', 'r-turn-shield', 'r-poison-hourglass']
  for (const id of ids) assert(itemSpriteSources({ id })?.medium)
  const run = fixture()
  add(run, 'r-step-boots')
  run.itemRules.state.lastAction = 'attack'
  const saved = JSON.stringify(run.serialize())
  const previous = globalThis.localStorage
  globalThis.localStorage = { getItem: (key) => key === SAVE_KEY ? saved : null, setItem() {}, removeItem() {} }
  try {
    const loaded = new GameRun()
    assert.equal(loaded.itemRules.state.lastAction, 'attack')
  } finally { globalThis.localStorage = previous }
}

{
  const run = fixture()
  const data = run.serialize()
  data.player.itemState = { buffs: {} }
  data.version--
  let removed = false
  const previous = globalThis.localStorage
  globalThis.localStorage = { getItem: (key) => key === SAVE_KEY ? JSON.stringify(data) : null, setItem() {}, removeItem() { removed = true } }
  try {
    const loaded = new GameRun()
    assert.equal(loaded._loaded, false)
    assert.equal(removed, true)
  } finally { globalThis.localStorage = previous }
}

console.log('synergies-check passed: independent effects, spatial links, status flow, rewards and persistence')
