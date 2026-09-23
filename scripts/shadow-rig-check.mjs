import assert from 'node:assert/strict'
import { createShadowExampleProjects, installInitialShadowExamples } from '../src/animation/shadow-examples.js'
import {
  createDefaultShadowProject,
  createShadowBone,
  createShadowJoint,
  createShadowPart,
  evaluateShadowProject,
  normalizeShadowProject,
  normalizeShadowRoster,
  sampleShadowTrack,
  shadowMatrixPosition,
  shadowTargetKey,
  upsertShadowKeyframe,
} from '../src/animation/shadow-rig.js'

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 0.0001, `${actual} != ${expected}`)
}

const legacy = normalizeShadowProject({
  version: 2,
  name: 'Legacy',
  stage: { width: 600, height: 600 },
  joints: [{ id: 'root', x: 12, y: 18, rotation: 25 }],
  bones: [],
  parts: [{ id: 'plate', x: 4, y: 5, z: 9, rotation: 30 }],
  animations: { idle: { duration: 1000, tracks: { 'joint:root': [{ time: 0, dx: 2, dy: 3, rotation: 15 }] } } },
})
assert.equal(legacy.version, 3)
assert.equal(legacy.parts[0].layer, 9)
assert.equal(legacy.parts[0].z, 0)
assert.equal(legacy.parts[0].rotationZ, 30)
assert.equal(legacy.joints[0].rotationZ, 25)
assert.equal(legacy.animations.idle.tracks['joint:root'][0].rotationZ, 15)

const older = normalizeShadowProject({ version: 1, name: 'Older', parts: [{ id: 'old', x: 4, y: 8, z: 6, width: 30, height: 40 }] })
assert.equal(older.version, 3)
assert.equal(older.parts[0].layer, 6)
assert.equal(older.parts[0].z, 0)

const rig = createDefaultShadowProject()
rig.joints.push(createShadowJoint({ id: 'root', x: 10, y: 20, z: 30, rotationY: 90 }))
rig.joints.push(createShadowJoint({ id: 'child', x: 100 }))
rig.bones.push(createShadowBone({ id: 'link', fromJointId: 'root', toJointId: 'child' }))
rig.parts.push(createShadowPart({ id: 'blade', x: 10, attachment: { type: 'joint', targetId: 'child', t: 0.5, followRotation: true } }))
const evaluated = evaluateShadowProject(rig)
const child = shadowMatrixPosition(evaluated.jointsById.get('child').matrix)
near(child.x, 10)
near(child.y, 20)
near(child.z, -70)
const part = shadowMatrixPosition(evaluated.parts[0].matrix)
near(part.x, 10)
near(part.z, -80)

const key = shadowTargetKey('joint', 'child')
upsertShadowKeyframe(rig, 'idle', key, 0, { dz: 0, rotationX: 0 })
upsertShadowKeyframe(rig, 'idle', key, 700, { dz: 40, rotationX: 80 })
const halfway = sampleShadowTrack(rig.animations.idle, key, 350)
near(halfway.dz, 20)
near(halfway.rotationX, 40)
near(shadowMatrixPosition(evaluateShadowProject(rig, 'idle', 350).jointsById.get('child').matrix).x, 30)

const examples = createShadowExampleProjects()
assert.deepEqual(examples.map((project) => project.name), ['\u788e\u94c3\u884c\u50e7', '\u6f6e\u773c\u86db\u6bcd', '\u7f1d\u8179\u706f\u86fe'])
for (const example of examples) {
  assert.equal(example.joints[0].rotationY, 45)
  assert.ok(example.joints.some((entry) => entry.z !== 0))
  assert.ok(example.parts.some((entry) => entry.z !== 0))
  const jointIds = new Set(example.joints.map((entry) => entry.id))
  const boneIds = new Set(example.bones.map((entry) => entry.id))
  for (const bone of example.bones) {
    assert.ok(jointIds.has(bone.fromJointId) && jointIds.has(bone.toJointId))
  }
  for (const entry of example.parts) {
    assert.ok((entry.attachment.type === 'joint' ? jointIds : boneIds).has(entry.attachment.targetId))
  }
  for (const action of ['idle', 'attack', 'hit', 'death', 'move']) {
    const animation = example.animations[action]
    assert.ok(Object.keys(animation.tracks).length >= 3, `${example.name}: ${action}`)
    assert.ok(Object.values(animation.tracks).flat().some((frame) => frame.dz !== 0 || frame.rotationX !== 0 || frame.rotationY !== 0), `${example.name}: ${action} has no depth animation`)
    for (const fraction of [0, .5, 1]) {
      const evaluation = evaluateShadowProject(example, action, animation.duration * fraction)
      assert.equal(evaluation.joints.length, example.joints.length)
      assert.equal(evaluation.parts.length, example.parts.length)
      for (const entry of evaluation.parts) assert.ok(entry.matrix.elements.every(Number.isFinite))
    }
  }
}

const roster = normalizeShadowRoster({ characters: [{ id: 'personal', project: createDefaultShadowProject() }], activeCharacterId: 'personal' })
assert.equal(installInitialShadowExamples(roster), true)
assert.equal(roster.characters.length, 4)
assert.notEqual(roster.activeCharacterId, 'personal')
const persistedRoster = normalizeShadowRoster(roster)
assert.equal(installInitialShadowExamples(persistedRoster), false)
assert.equal(persistedRoster.characters.length, 4)
persistedRoster.characters.splice(1, 1)
assert.equal(installInitialShadowExamples(persistedRoster), false)
assert.equal(persistedRoster.characters.length, 3)
const personal = normalizeShadowRoster({ characters: [{ id: 'personal', project: rig }], activeCharacterId: 'personal' })
assert.equal(installInitialShadowExamples(personal), true)
assert.equal(personal.activeCharacterId, 'personal')
assert.equal(personal.characters[0].project.joints.length, rig.joints.length)

console.log('Shadow rig 3D checks passed')
