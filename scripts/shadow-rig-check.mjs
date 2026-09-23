import assert from 'node:assert/strict'
import {
  createDefaultShadowProject,
  createShadowBone,
  createShadowJoint,
  createShadowPart,
  evaluateShadowProject,
  normalizeShadowProject,
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

console.log('Shadow rig 3D checks passed')
