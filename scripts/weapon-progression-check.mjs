import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import catalog from '../src/game/data/catalog.json' with { type: 'json' }
import { GameRun, SAVE_VERSION } from '../src/game/run.js'
import { ALL_ITEM_DEFS, RECIPES, getItemDefinition, makeItemById, randomWeapon, weaponTierRoman } from '../src/game/data/content.js'
import { ADVANCED_CRAFT_MATERIALS, WEAPON_TIERS } from '../src/game/data/weapon-progression.js'
import { fixture, add } from './item-test-helpers.mjs'
import { catalogContent } from '../src/ui/wiki-catalog.js'
import { buildSupplyRewardChoices } from '../src/game/data/rewards.js'

const expectedTiers = {
  1: ['rust-sword', 'triad-ember', 'root-axe', 'bone-knife', 'tide-blade', 'demon-seeker', 'ember-spear', 'gold-hook', 'wood-bow', 'ash-bow', 'triad-tide', 'rock-maul'],
  2: ['silver-guard', 'coin-blade', 'ember-axe', 'triad-wither', 'butcher-knife', 'thorn-spear', 'eagle-bow', 'bounty-bow', 'scouting-bow', 'bell-maul'],
  3: ['wall-sword', 'return-axe', 'erosion-knife', 'soul-spear', 'hunter-shortbow', 'mountain-maul'],
}
assert.deepEqual(WEAPON_TIERS, expectedTiers)
assert.deepEqual(Object.values(WEAPON_TIERS).map(ids => ids.length), [12, 10, 6])
const weapons = ALL_ITEM_DEFS.filter(item => item.type === 'weapon')
assert.equal(weapons.length, 28)
assert.deepEqual(new Set(weapons.map(item => item.id)), new Set(Object.values(expectedTiers).flat()))
for (const weapon of weapons) {
  const expectedTier = Number(Object.entries(expectedTiers).find(([, ids]) => ids.includes(weapon.id))[0])
  assert.equal(weapon.tier, expectedTier, weapon.id)
  assert.equal(weapon.crafted, expectedTier > 1, weapon.id)
  const item = makeItemById(weapon.id)
  assert.equal(item.tier, expectedTier, weapon.id)
  assert.equal(weaponTierRoman(item), ['', 'I', 'II', 'III'][expectedTier], weapon.id)
}
for (let index = 0; index < 100; index++) assert.equal(randomWeapon(12, () => index / 100).tier, 1)
for (const ownedId of ['rust-sword', 'wall-core', 'beast-hunting-horn']) for (let index = 0; index < 100; index++) {
  const choice = buildSupplyRewardChoices({ floor: 12, items: [makeItemById(ownedId)], random: () => index / 100 })[0]
  const definition = getItemDefinition(choice.itemId)
  if (definition?.type === 'weapon') assert.equal(definition.tier, 1)
}

const expectedRecipes = [
  ['rust-sword', 'shield-core', 'silver-guard'], ['triad-ember', 'conduit', 'coin-blade'],
  ['root-axe', 'spring', 'ember-axe'], ['bone-knife', 'venom-sac', 'triad-wither'],
  ['tide-blade', 'bone-nail', 'butcher-knife'], ['ember-spear', 'chain', 'thorn-spear'],
  ['wood-bow', 'scope', 'eagle-bow'], ['ash-bow', 'range-disc', 'bounty-bow'],
  ['triad-tide', 'steady-clip', 'scouting-bow'], ['rock-maul', 'weight', 'bell-maul'],
  ['demon-seeker', 'conduit', 'coin-blade'], ['gold-hook', 'conduit', 'coin-blade'],
  ['silver-guard', 'wall-core', 'wall-sword'], ['coin-blade', 'wall-core', 'wall-sword'],
  ['ember-axe', 'return-axle', 'return-axe'],
  ['triad-wither', 'corrosive-heart-core', 'erosion-knife'], ['butcher-knife', 'corrosive-heart-core', 'erosion-knife'],
  ['thorn-spear', 'soul-chain', 'soul-spear'],
  ['eagle-bow', 'beast-hunting-horn', 'hunter-shortbow'], ['bounty-bow', 'beast-hunting-horn', 'hunter-shortbow'],
  ['scouting-bow', 'beast-hunting-horn', 'hunter-shortbow'], ['bell-maul', 'mountain-break-stone', 'mountain-maul'],
]
// Kind is a route constraint only; spears/mauls share visual renderers with
// swords/axes, so appearance alone cannot catch every invalid upgrade.
const routeKinds = [
  ['rust-sword', 'silver-guard', 'triad-ember', 'coin-blade', 'gold-hook', 'demon-seeker', 'wall-sword'],
  ['bone-knife', 'triad-wither', 'tide-blade', 'butcher-knife', 'erosion-knife'],
  ['root-axe', 'ember-axe', 'return-axe'],
  ['ember-spear', 'thorn-spear', 'soul-spear'],
  ['wood-bow', 'ash-bow', 'eagle-bow', 'triad-tide', 'bounty-bow', 'scouting-bow', 'hunter-shortbow'],
  ['rock-maul', 'bell-maul', 'mountain-maul'],
]
assert.deepEqual(new Set(routeKinds.flat()), new Set(weapons.map(weapon => weapon.id)))
assert.deepEqual(RECIPES.map(({ a, b, result }) => [a, b, result]), expectedRecipes)
assert.equal(RECIPES.length, 22)
assert.equal(new Set(RECIPES.map(recipe => recipe.id)).size, RECIPES.length)
assert.deepEqual(catalog.recipes, [], 'obsolete catalog recipes must remain disabled')
for (const recipe of RECIPES) {
  const input = getItemDefinition(recipe.a), output = getItemDefinition(recipe.result)
  assert.equal(output.appearance, input.appearance, `${recipe.id}: retain appearance`)
  assert.equal(routeKinds.findIndex(ids => ids.includes(output.id)), routeKinds.findIndex(ids => ids.includes(input.id)), `${recipe.id}: retain weapon kind`)
  assert(output.attack > input.attack, `${recipe.id}: damage improves`)
  assert(output.attack / output.energyCost > input.attack / input.energyCost, `${recipe.id}: stamina efficiency improves`)
  assert.equal(getItemDefinition(recipe.a).tier + 1, getItemDefinition(recipe.result).tier, recipe.id)
  assert.equal(getItemDefinition(recipe.b).type, 'material', recipe.id)
  const run = fixture(); add(run, recipe.a); add(run, recipe.b)
  assert(run.availableRecipes().some(candidate => candidate.id === recipe.id && candidate.canFit), recipe.id)
  assert(run.craft(recipe.id), recipe.id)
  assert(run.backpack.items.some(item => item.id === recipe.result), recipe.id)
}
for (const [a, b, result] of [
  ['demon-seeker', 'conduit', 'coin-blade'],
  ['gold-hook', 'conduit', 'coin-blade'],
  ['bounty-bow', 'beast-hunting-horn', 'hunter-shortbow'],
]) {
  const run = fixture(); add(run, a); add(run, b)
  assert(run.craft(result), `${a} alternative route`)
  assert(run.backpack.items.some(item => item.id === result))
}
assert.deepEqual([...new Set(RECIPES.filter(recipe => recipe.result === 'hunter-shortbow').map(recipe => recipe.a))],
  ['eagle-bow', 'bounty-bow', 'scouting-bow'])

assert.equal(ADVANCED_CRAFT_MATERIALS.length, 6)
assert.deepEqual(ADVANCED_CRAFT_MATERIALS.map(material => material.name),
  ['\u57ce\u58c1\u6838\u5fc3', '\u56de\u65cb\u8f74', '\u8680\u6bd2\u5fc3\u6838', '\u9501\u9b42\u94fe', '\u730e\u517d\u53f7\u89d2', '\u65ad\u5cb3\u77f3'])
for (const material of ADVANCED_CRAFT_MATERIALS) {
  assert.equal(getItemDefinition(material.id).type, 'material')
  assert.deepEqual(getItemDefinition(material.id).shape, [[1]])
  assert(catalogContent('items').includes(material.name))
}

const hud = await readFile(new URL('../src/ui/VueHud.vue', import.meta.url), 'utf8')
const badge = await readFile(new URL('../src/ui/ItemValueBadge.vue', import.meta.url), 'utf8')
assert(hud.includes(':key="recipe.id"'))
assert(hud.includes("handleAction('craft-result', recipe.id)"))
assert(badge.includes("['', 'I', 'II', 'III'][item.tier]"))

// Tier fields are part of the save contract. Old or mismatched saves restart.
{
  const run = fixture(); const weapon = add(run, 'hunter-shortbow')
  const original = run.serialize(), previous = globalThis.localStorage
  let payload = JSON.stringify(original), removed = 0
  globalThis.localStorage = { getItem: () => payload, setItem: (_key, value) => { payload = value }, removeItem: () => { removed++; payload = null } }
  try {
    const loaded = new GameRun({ autoLoad: true })
    assert.equal(removed, 0); assert.equal(loaded.backpack.items.find(item => item.uid === weapon.uid).tier, 3)
    for (const mutate of [data => { data.version = SAVE_VERSION - 1 },
      data => { data.backpack.placements.find(entry => entry.item.uid === weapon.uid).item.tier = 2 }]) {
      const bad = globalThis.structuredClone(original); mutate(bad); payload = JSON.stringify(bad)
      const fresh = new GameRun({ autoLoad: true }); assert.equal(fresh.globalTurn, 0)
    }
    assert.equal(removed, 2)
  } finally { globalThis.localStorage = previous }
}

console.log('weapon-progression-check passed: 12/10/6 tiers, 22 same-kind efficient recipes, alternate routes, advanced materials, UI and saves')
