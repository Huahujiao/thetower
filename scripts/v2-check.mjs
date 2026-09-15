import assert from 'node:assert/strict'
import { GameRun, SAVE_VERSION } from '../src/game/run.js'
import { createRelicEntity, getItemDefinition } from '../src/game/data/content.js'
import { ATTRIBUTE_ORDER, attributeModifier } from '../src/game/data/attributes.js'
import { FIXED_GROWTH, TALENT_DEFS, buildLevelUpChoices, experienceToNextLevel, talentGraphState } from '../src/game/data/progression.js'
import { RELIC_DEFS, getRelicDefinition } from '../src/game/data/relics.js'
import { buildMerchantStock, getMerchantDefinition } from '../src/game/data/merchants.js'
import catalog from '../src/game/data/catalog.json' with { type: 'json' }
import { computeAttackDamage } from '../src/game/rules/modifiers.js'

const removedRelics = ['r-harmonic-echo', 'r-apprentice-mark', 'r-last-stand', 'r-threshold-seal', 'r-no-mercy', 'r-blood-prism', 'r-armor-echo', 'r-inheritance-edge', 'r-breaker-spark']
const relicIds = new Set(RELIC_DEFS.map((definition) => definition.id))
assert.equal(RELIC_DEFS.length, 6, 'relic pool must contain 6 definitions')
const relicDrop = createRelicEntity(RELIC_DEFS[0], { c: 0, r: 0 })
assert.equal(relicDrop.kind, 'item')
assert.equal(relicDrop.item.type, 'relic')
assert.equal(relicDrop.item.shape.length, 1)
for (const id of removedRelics) assert.equal(getRelicDefinition(id), null, `${id} must be removed`)
for (const id of ['r-three', 'r-scales']) assert(relicIds.has(id), `${id} must be present`)

assert.equal(ATTRIBUTE_ORDER.join(','), 'scorch,wither,drown')
assert.equal(attributeModifier('scorch', 'wither').multiplier, 1.6)
assert.equal(attributeModifier('wither', 'scorch').multiplier, 0.65)
assert.equal(catalog.consumables.length, 6)
assert.equal(catalog.weapons.length, 18)
assert.equal(catalog.defenses.length, 8)
assert(catalog.enemyLoot.every(item => item.type === 'material'))
assert.equal(TALENT_DEFS.length, 20, 'talent graph must contain 20 nodes')
assert.equal(TALENT_DEFS.filter((node) => node.tier === 3).length, 4)
assert.equal(new Set(TALENT_DEFS.map((node) => node.id)).size, TALENT_DEFS.length)

const initialChoices = buildLevelUpChoices({ talents: [] }, { random: () => 0.25 })
assert.equal(initialChoices.length, 5)
assert.equal(initialChoices.at(-1), FIXED_GROWTH.id)
assert.equal(new Set(initialChoices).size, initialChoices.length)
assert.equal(experienceToNextLevel(1), 8)
assert.equal(experienceToNextLevel(2), 10)

const merchantStock = buildMerchantStock('merchant', 1, () => 0.25)
assert.equal(merchantStock.length, 4, 'merchant stock must stay at four items')
assert(merchantStock.every((entry) => getItemDefinition(entry.itemId)))
assert.equal(getMerchantDefinition('merchant').services.includes('relic-management'), false)
assert.equal(getMerchantDefinition('collector').services.includes('relic-management'), false)

const run = new GameRun({ autoLoad: false, random: () => 0.25 })
assert.equal(run.player.strength, undefined)
assert.equal(run.player.mastery, undefined)
assert.equal(run.player.adaptations, undefined)
assert.deepEqual(run.player.talents, [])
assert.equal(run.player.talentRuntime.bodyStrength, 0)
assert.equal(run.initialRelicChoices.length, 3)
assert(run.chooseInitialRelic(run.initialRelicChoices[0]))
assert.equal(run.relicCount(), 1)
assert.equal(run.backpack.items.filter((item) => item.type === 'relic').length, 1)
assert.equal(run.activeRelics().length, 1)
run.player.experience = run.player.experienceToNext
assert(run._queueLevelUp())
assert.equal(run.levelUpChoices().length, 5)
assert(run.chooseLevelUpOption(FIXED_GROWTH.id))
assert.equal(run.player.maxHp, 22)
assert.equal(run.player.talentRuntime.bodyStrength, 1)
assert.equal(run.phase, 'explore')

const graph = talentGraphState(run.player)
assert.equal(graph.filter((node) => node.state === 'unlockable').length, 8)

const damage = computeAttackDamage({
  weapon: { attack: 5, attribute: 'scorch', weaponClass: 'sword' },
  target: { attribute: 'wither' },
  pendingAttackBonus: 2,
})
assert.equal(damage.damage, 11)

const serialized = run.serialize()
assert.equal(serialized.version, SAVE_VERSION)
assert.equal(serialized.backpack.columns, 9)
assert.equal(serialized.backpack.rows, 5)
assert.equal(serialized.backpack.placements.filter(({ item }) => item.type === 'relic').length, 1)
assert.equal(serialized.player.strength, undefined)
assert.equal(serialized.player.mastery, undefined)
assert.equal(serialized.player.adaptations, undefined)

console.log('v2-check passed')
