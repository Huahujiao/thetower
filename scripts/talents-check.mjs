import assert from 'node:assert/strict'
import { GameRun } from '../src/game/run.js'
import { getTalentDefinition } from '../src/game/data/progression.js'

const energyTalents = [
  ['sword-rebound', 'parryEnergyRecovery', 1],
  ['axe-leverage', 'axeMultiEnergy', 0.5],
  ['dagger-edge', 'daggerEnergyRecovery', 1],
  ['polearm-step', 'polearmPushEnergy', 0.5],
  ['heavy-shake', 'heavyEnergyRecovery', 1],
  ['bow-ammo', 'bowMaxEnergy', 0.5],
]

for (const [id, effect, value] of energyTalents) {
  const definition = getTalentDefinition(id)
  assert.equal(definition.effects[effect], value, `${id} must expose an energy effect`)
  assert(!/durability|repair|\u8010\u4e45|\u4fee\u7406|\u4e0d\u8017|\u53e6\u4e00\u53ea\u624b/.test(definition.description), `${id} contains a removed mechanic`)
}

function runWithTalent(id) {
  const run = new GameRun({ autoLoad: false, random: () => 0.25 })
  run.player.talents = [id]
  run.player.energy = 5
  return run
}

const sword = runWithTalent('sword-rebound')
sword._onParrySuccess()
assert.equal(sword.player.energy, 6)

const axe = runWithTalent('axe-leverage')
axe._recordAxeMultiAttack(true, { weaponClass: 'axe' })
assert.equal(axe.player.energy, 6)

const dagger = runWithTalent('dagger-edge')
dagger._applyTalentPrimaryOutcome({
  enemy: { maxHp: 10, hp: 0 },
  weapon: { weaponClass: 'dagger' },
  distance: 1,
  outcome: { countered: false },
  hit: { defeated: true, healthDamage: 10 },
})
assert.equal(dagger.player.energy, 6)

const heavy = runWithTalent('heavy-shake')
heavy._applyTalentPrimaryOutcome({
  enemy: { maxHp: 10, hp: 5 },
  weapon: { weaponClass: 'heavy' },
  distance: 1,
  outcome: { countered: false },
  hit: { defeated: false, healthDamage: 5 },
})
assert.equal(heavy.player.energy, 6)

const bow = runWithTalent('bow-ammo')
bow._applyTalentPrimaryOutcome({
  enemy: { maxHp: 10, hp: 5 },
  weapon: { weaponClass: 'bow', range: 3 },
  distance: 3,
  outcome: { countered: false },
  hit: { defeated: false, healthDamage: 1 },
})
assert.equal(bow.player.energy, 6)

console.log('talents-check passed')
