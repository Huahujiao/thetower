import assert from 'node:assert/strict'
import { fixture, enemy, round } from './item-test-helpers.mjs'
import { stepEnemy } from '../src/game/rules/enemies.js'
import { createEnemyById, synchronizeEnemyBalance } from '../src/game/data/content.js'
import { ENEMY_DEFS, CHAPTER_ENCOUNTERS, getEnemyDefinition } from '../src/game/data/enemies.js'
import catalog from '../src/game/data/catalog.json' with { type: 'json' }
import { enemyCardSubtitle, enemyOverheadHints } from '../src/game/data/enemy-features.js'

function scenario({ speed, range = 1, start = 0, player = 3, delay = 0 }) {
  const actor = { speed, range, pos: { c: start, r: 0 }, attack: 1, actionDelay: delay, attackCooldown: 9, statuses: {} }
  let attacks = 0, moves = 0
  const result = stepEnemy(actor, {
    player: { pos: { c: player, r: 0 } }, path: () => [{ c: actor.pos.c + 1, r: 0 }],
    room: { entityAt: () => null }, move: (_actor, point) => { actor.pos = point; moves++; return true }, attack: () => attacks++,
  })
  return { actor, attacks, moves, result }
}
assert.equal(scenario({ speed: 0 }).moves, 0)
assert.equal(scenario({ speed: 0, player: 1 }).attacks, 1)
assert.equal(scenario({ speed: 2, range: 2 }).moves, 1, 'stop immediately upon entering range')
assert.equal(scenario({ speed: 2, range: 2 }).attacks, 1)
assert.equal(scenario({ speed: 2 }).moves, 2)
assert.equal(scenario({ speed: 2 }).attacks, 1, 'full-speed movement can still attack')
assert.equal(scenario({ speed: 1 }).attacks, 0, 'cannot attack beyond range')
assert.equal(scenario({ speed: 2, player: 1 }).moves, 0, 'already in range stays still')
assert.equal(scenario({ speed: 2, delay: 1 }).moves, 0)
for (const definition of ENEMY_DEFS) {
  assert(Number.isInteger(definition.speed) && definition.speed >= 0)
  assert(!(definition.traits || []).includes('swift'))
  assert(!['stationary', 'chaser'].includes(definition.behavior))
  assert(!/驻守|追击|疾行/.test(enemyCardSubtitle(definition)))
  assert(!enemyOverheadHints(definition).some(h => /驻守|追击|疾行/.test(h.label)))
}
// Mid/late enemies can answer a one-cell push from distance two on an open lane.
const later = new Set(CHAPTER_ENCOUNTERS.slice(1).flatMap(pool => [...pool.standard, ...pool.challenge]))
for (const definition of [...later].map(getEnemyDefinition).concat(ENEMY_DEFS.filter(e => e.spawnOnly), catalog.boss)) {
  assert.equal(scenario({ speed: definition.speed, range: definition.range }).attacks, 1, definition.id)
  const saved = { ...createEnemyById(definition.id === 'overseer' ? 'gnawer' : definition.id), enemyId: definition.id, speed: 0, range: 1 }
  const hp = saved.hp
  synchronizeEnemyBalance(saved)
  assert.equal(saved.speed, definition.speed)
  assert.equal(saved.range, definition.range)
  assert.equal(saved.hp, hp, 'updating reach must not heal an existing enemy')
}
for (const id of ['gnawer', 'tide-shadow-cub', 'beetle-guard']) {
  const definition = getEnemyDefinition(id)
  assert.equal(scenario({ speed: definition.speed, range: definition.range }).attacks, 0, 'early enemies retain the knockback opening')
}
const legacy = createEnemyById('claw-beast'); legacy.speed = 0; legacy.behavior = 'chaser'; legacy.traits = ['swift']; legacy.attackCooldown = 3
synchronizeEnemyBalance(legacy)
assert.equal(legacy.speed, 2); assert.equal(legacy.behavior, undefined); assert(!legacy.traits.includes('swift')); assert.equal(legacy.attackCooldown, 0)
const run = fixture(), actor = enemy(run, { speed: 2, attack: 2, actionDelay: 0, pos: { c: 0, r: 3 } })
run.player.pos = { c: 3, r: 3 }
round(run)
assert.deepEqual(actor.pos, { c: 2, r: 3 }); assert.equal(run.player.hp, 18)
round(run); assert.deepEqual(actor.pos, { c: 2, r: 3 }); assert.equal(run.player.hp, 16)
console.log('Enemy speed checks passed: movement limit, early stop, move+attack, no normal cooldown and saved species stats.')
