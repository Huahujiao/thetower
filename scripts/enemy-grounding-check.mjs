import assert from 'node:assert/strict'
import { createEnemyShadowProjects, installEnemyShadowProjects } from '../src/animation/shadow-enemies.js'
import { evaluateShadowProject, normalizeShadowProject } from '../src/animation/shadow-rig.js'
import { shadowPartFloor } from '../src/animation/shadow-grounding.js'
import { createEnemyById, synchronizeEnemyBalance } from '../src/game/data/content.js'
import { ENEMY_DEFS } from '../src/game/data/enemies.js'

let frames = 0, supports = 0
for (const source of createEnemyShadowProjects({ includeBoss: true })) {
  const project = normalizeShadowProject(source)
  assert.deepEqual(project.grounding, source.grounding, 'floor constraints survive saves')
  if (project.grounding.floating) continue
  const { floorY } = project.grounding
  assert(project.grounding.supports.length > 0, project.enemyId)
  supports += project.grounding.supports.length
  const rest = evaluateShadowProject(project, 'idle', 0)
  for (const [action, animation] of Object.entries(project.animations)) {
    for (let frame = 0; frame <= 40; frame++) {
      const pose = evaluateShadowProject(project, action, frame * animation.duration / 40)
      frames++
      for (const part of pose.parts) assert(shadowPartFloor(part) >= floorY - 1e-5, `${project.enemyId} ${action} ${frame} ${part.part.id}: floor penetration`)
      for (const support of project.grounding.supports) {
        assert(pose.jointsById.has(support.contactId), `${project.enemyId}: missing foot joint`)
        const floor = shadowPartFloor(pose.parts.find(p => p.part.id === support.partId))
        assert(Math.abs(pose.jointsById.get(support.contactId).matrix.elements[13] - floor) < 1e-5, `${project.enemyId}: contact node must follow the actual opaque foot edge`)
        if (action !== 'idle') continue
        const foot = pose.parts.find(p => p.part.id === support.partId)
        const bind = rest.parts.find(p => p.part.id === support.partId)
        foot.matrix.elements.forEach((value, i) => assert(Math.abs(value - bind.matrix.elements[i]) < 1e-5, `${project.enemyId} ${frame}: sliding foot ${support.partId}`))
        assert(Math.abs(shadowPartFloor(foot) - floorY) < 1e-5, `${project.enemyId}: hovering foot ${support.partId}`)
      }
    }
  }
}
// Pack 15 migration preserves authored textures/poses, adding only contacts.
const customized = createEnemyShadowProjects().find(p => p.enemyId === 'cracked-hunter')
delete customized.grounding
customized.parts[0].fill = '#abcdef'
const roster = { enemyArtPackVersion: 15, characters: [{ id: 'custom', project: customized }], activeCharacterId: 'custom' }
assert(installEnemyShadowProjects(roster))
assert.equal(roster.characters.length, 1)
assert.equal(roster.characters[0].project.parts[0].fill, '#abcdef')
assert(roster.characters[0].project.grounding.supports.length)
assert.equal(installEnemyShadowProjects(roster), false)

const delayed = new Set(['ash-cannon-bug', 'molten-core-beast', 'bomb-wisp'])
for (const definition of ENEMY_DEFS) assert.equal(definition.initialActionDelay > 0, delayed.has(definition.id), definition.id)
const legacy = createEnemyById('gnawer')
delete legacy.actionDelayRevision
legacy.initialActionDelay = 1; legacy.actionDelay = 3; legacy.attackCooldown = 2
synchronizeEnemyBalance(legacy)
assert.equal(legacy.actionDelay, 2, 'extra control delay survives migration')
assert.equal(legacy.attackCooldown, 0, 'ordinary attack cooldown is removed from saved enemies')
synchronizeEnemyBalance(legacy)
assert.equal(legacy.actionDelay, 2, 'migration is idempotent')
console.log(`Enemy grounding: ${frames} sampled frames, ${supports} planted supports; delays and saved rigs passed.`)
