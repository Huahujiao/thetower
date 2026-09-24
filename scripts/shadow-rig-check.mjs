import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { createShadowExampleProjects, installInitialShadowExamples, repairInitialShadowExamples, texturePresetsForShadowProject } from '../src/animation/shadow-examples.js'
import { ShadowHistory } from '../src/animation/shadow-history.js'
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
assert.equal(legacy.version, 4)
assert.equal(legacy.parts[0].layer, 9)
assert.equal(legacy.parts[0].z, 0)
assert.equal(legacy.parts[0].rotationZ, 30)
assert.equal(legacy.joints[0].rotationZ, 25)
assert.equal(legacy.animations.idle.tracks['joint:root'][0].rotationZ, 15)

const older = normalizeShadowProject({ version: 1, name: 'Older', parts: [{ id: 'old', x: 4, y: 8, z: 6, width: 30, height: 40 }] })
assert.equal(older.version, 4)
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

const oldDepthProject = createDefaultShadowProject()
oldDepthProject.version = 3
oldDepthProject.joints.push(createShadowJoint({ id: 'root', z: -20, rotationX: 12, rotationY: -45 }))
oldDepthProject.joints.push(createShadowJoint({ id: 'child', x: 30, z: -15 }))
oldDepthProject.bones.push(createShadowBone({ id: 'link', fromJointId: 'root', toJointId: 'child' }))
oldDepthProject.parts.push(createShadowPart({ id: 'face', z: -8, rotationX: -20, rotationY: 15, attachment: { type: 'joint', targetId: 'child', t: 0.5, followRotation: true } }))
upsertShadowKeyframe(oldDepthProject, 'idle', shadowTargetKey('joint', 'root'), 500, { dz: -7, rotationX: 9, rotationY: -11 })
const oldEvaluation = evaluateShadowProject(oldDepthProject, 'idle', 500)
const migratedDepthProject = normalizeShadowProject(oldDepthProject)
assert.equal(migratedDepthProject.version, 4)
assert.equal(migratedDepthProject.joints[0].z, 20)
assert.equal(migratedDepthProject.joints[0].rotationY, 45)
assert.equal(migratedDepthProject.parts[0].z, 8)
assert.equal(migratedDepthProject.parts[0].rotationX, 20)
assert.equal(migratedDepthProject.animations.idle.tracks['joint:root'][0].dz, 7)
assert.deepEqual(normalizeShadowProject(migratedDepthProject), migratedDepthProject)
const migratedEvaluation = evaluateShadowProject(migratedDepthProject, 'idle', 500)
for (const kind of ['joints', 'parts']) {
  for (let index = 0; index < oldEvaluation[kind].length; index += 1) {
    const before = shadowMatrixPosition(oldEvaluation[kind][index].matrix)
    const after = shadowMatrixPosition(migratedEvaluation[kind][index].matrix)
    near(after.x, before.x)
    near(after.y, before.y)
    near(after.z, -before.z)
  }
}

const examples = createShadowExampleProjects()
assert.deepEqual(examples.map((project) => project.name), ['\u788e\u94c3\u884c\u50e7', '\u6f6e\u773c\u86db\u6bcd', '\u7f1d\u8179\u706f\u86fe'])
assert.deepEqual(examples.map((project) => project.parts.length), [12, 19, 11])
assert.deepEqual(examples.map((project) => texturePresetsForShadowProject(project).length), [10, 7, 9])
for (const [index, prefix] of ['bell-pilgrim-', 'tide-spider-', 'lantern-moth-'].entries()) {
  assert.ok(texturePresetsForShadowProject(examples[index]).every((preset) => preset.url.startsWith(`/assets/enemies/${prefix}`)))
}
assert.equal(texturePresetsForShadowProject(createDefaultShadowProject()).length, 26)
for (const example of examples) {
  assert.equal(example.joints[0].rotationY, 30)
  const rootForward = evaluateShadowProject(example).joints[0].matrix.elements
  assert.ok(rootForward[8] > 0 && rootForward[10] > 0, `${example.name}: forward must face character-right and camera`)
  assert.ok(example.joints.some((entry) => entry.z !== 0))
  assert.ok(example.parts.some((entry) => entry.z !== 0))
  const jointIds = new Set(example.joints.map((entry) => entry.id))
  const boneIds = new Set(example.bones.map((entry) => entry.id))
  for (const bone of example.bones) {
    assert.ok(jointIds.has(bone.fromJointId) && jointIds.has(bone.toJointId))
  }
  for (const entry of example.parts) {
    assert.ok((entry.attachment.type === 'joint' ? jointIds : boneIds).has(entry.attachment.targetId))
    assert.equal(entry.visual.type, 'texture', `${example.name}/${entry.id} is missing a texture`)
    assert.ok(entry.visual.texture.startsWith('/assets/enemies/'), `${example.name}/${entry.id} has an invalid texture URL`)
    assert.ok(existsSync(new URL(`../public${entry.visual.texture}`, import.meta.url)), `${example.name}/${entry.id} texture file is missing`)
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

const damaged = normalizeShadowRoster({
  characters: [{ id: 'sample', project: examples[0] }], activeCharacterId: 'sample', examplePackVersion: 1,
})
damaged.characters[0].project.parts.find((entry) => entry.id === 'robe').fill = '#123456'
damaged.characters[0].project.parts = damaged.characters[0].project.parts.filter((entry) => entry.id !== 'bell')
damaged.characters[0].project.joints[0].rotationY = -45
assert.equal(repairInitialShadowExamples(damaged), true)
assert.equal(damaged.characters[0].project.parts.find((entry) => entry.id === 'robe').fill, '#123456')
assert.ok(damaged.characters[0].project.parts.some((entry) => entry.id === 'bell'))
assert.equal(damaged.characters[0].project.joints[0].rotationY, 30)
assert.equal(examples[2].stage.floorOffset, 44)
damaged.characters[0].project.parts = damaged.characters[0].project.parts.filter((entry) => entry.id !== 'bell')
assert.equal(repairInitialShadowExamples(damaged), false)
assert.ok(!damaged.characters[0].project.parts.some((entry) => entry.id === 'bell'))

const alreadyRepaired = normalizeShadowRoster({
  characters: [
    { id: 'default-angle', project: examples[0] },
    { id: 'custom-angle', project: examples[1] },
  ],
  activeCharacterId: 'default-angle',
  examplePackVersion: 2,
})
alreadyRepaired.characters[0].project.joints[0].rotationY = 45
alreadyRepaired.characters[0].project.parts = alreadyRepaired.characters[0].project.parts.filter((entry) => entry.id !== 'bell')
alreadyRepaired.characters[0].project.parts.find((entry) => entry.id === 'robe').visual = { type: 'shape', texture: null, textureFit: 'contain' }
alreadyRepaired.characters[1].project.parts.find((entry) => entry.id === 'abdomen-shell').visual = { type: 'texture', texture: '/assets/enemies/custom.png', textureFit: 'cover' }
alreadyRepaired.characters[1].project.joints[0].rotationY = 18
assert.equal(repairInitialShadowExamples(alreadyRepaired), true)
assert.equal(alreadyRepaired.examplePackVersion, 8)
assert.equal(alreadyRepaired.characters[0].project.joints[0].rotationY, 30)
assert.ok(!alreadyRepaired.characters[0].project.parts.some((entry) => entry.id === 'bell'))
assert.equal(alreadyRepaired.characters[0].project.parts.find((entry) => entry.id === 'robe').visual.type, 'texture')
assert.equal(alreadyRepaired.characters[1].project.parts.find((entry) => entry.id === 'abdomen-shell').visual.texture, '/assets/enemies/custom.png')
assert.equal(alreadyRepaired.characters[1].project.joints[0].rotationY, 18)
assert.equal(repairInitialShadowExamples(alreadyRepaired), false)

const wingMigration = normalizeShadowRoster({
  characters: [{ id: 'moth', project: examples[2] }], activeCharacterId: 'moth', examplePackVersion: 4,
})
const mothParts = wingMigration.characters[0].project.parts
mothParts.find((entry) => entry.id === 'left-wing-membrane').visual.texture = '/assets/enemies/lantern-moth-wing-v1-medium.png'
mothParts.find((entry) => entry.id === 'right-wing-membrane').visual.texture = '/assets/enemies/custom-right-wing.png'
mothParts.find((entry) => entry.id === 'head-lamp').visual = { type: 'shape', texture: null, textureFit: 'contain' }
assert.equal(repairInitialShadowExamples(wingMigration), true)
assert.equal(mothParts.find((entry) => entry.id === 'left-wing-membrane').visual.texture, '/assets/enemies/lantern-moth-left-wing-v2-medium.png')
assert.equal(mothParts.find((entry) => entry.id === 'right-wing-membrane').visual.texture, '/assets/enemies/custom-right-wing.png')
assert.equal(mothParts.find((entry) => entry.id === 'head-lamp').visual.texture, '/assets/enemies/lantern-moth-head-v1-medium.png')

const smallPartMigration = normalizeShadowRoster({
  characters: [{ id: 'spider', project: examples[1] }], activeCharacterId: 'spider', examplePackVersion: 5,
})
const spiderParts = smallPartMigration.characters[0].project.parts
spiderParts.find((entry) => entry.id === 'left-0-upper').visual = { type: 'shape', texture: null, textureFit: 'contain' }
spiderParts.find((entry) => entry.id === 'left-0-lower').visual = { type: 'texture', texture: '/assets/enemies/my-leg.png', textureFit: 'contain' }
assert.equal(repairInitialShadowExamples(smallPartMigration), true)
assert.equal(spiderParts.find((entry) => entry.id === 'left-0-upper').visual.texture, '/assets/enemies/tide-spider-upper-leg-v1-small.png')
assert.equal(spiderParts.find((entry) => entry.id === 'left-0-lower').visual.texture, '/assets/enemies/my-leg.png')
assert.equal(examples[0].parts.find((entry) => entry.id === 'ribcage').visual.texture, '/assets/enemies/bell-pilgrim-ribcage-v1-small.png')
assert.equal(examples[2].parts.find((entry) => entry.id === 'thorax').visual.texture, '/assets/enemies/lantern-moth-thorax-v1-small.png')

const finalTextureMigration = normalizeShadowRoster({
  characters: [{ id: 'pilgrim', project: examples[0] }], activeCharacterId: 'pilgrim', examplePackVersion: 6,
})
const pilgrimParts = finalTextureMigration.characters[0].project.parts
pilgrimParts.find((entry) => entry.id === 'mouth').visual = { type: 'shape', texture: null, textureFit: 'contain' }
pilgrimParts.find((entry) => entry.id === 'eye').visual = { type: 'texture', texture: '/assets/enemies/custom-eye.png', textureFit: 'cover' }
assert.equal(repairInitialShadowExamples(finalTextureMigration), true)
assert.equal(pilgrimParts.find((entry) => entry.id === 'mouth').visual.texture, '/assets/enemies/bell-pilgrim-mouth-v2-small.png')
assert.equal(pilgrimParts.find((entry) => entry.id === 'eye').visual.texture, '/assets/enemies/custom-eye.png')

const mouthMigration = normalizeShadowRoster({
  characters: [{ id: 'pilgrim', project: examples[0] }], activeCharacterId: 'pilgrim', examplePackVersion: 7,
})
const mouthPart = mouthMigration.characters[0].project.parts.find((entry) => entry.id === 'mouth')
mouthPart.visual.texture = '/assets/enemies/bell-pilgrim-mouth-v1-small.png'
assert.equal(repairInitialShadowExamples(mouthMigration), true)
assert.equal(mouthPart.visual.texture, '/assets/enemies/bell-pilgrim-mouth-v2-small.png')
assert.equal(repairInitialShadowExamples(mouthMigration), false)

const editState = { parts: [{ id: 'p', x: 0 }], name: 'first' }
const history = new ShadowHistory(editState)
history.begin(editState)
editState.parts[0].x = 10
history.record(editState)
editState.parts[0].x = 20
history.end(editState)
assert.equal(history.stack.length, 1)
assert.equal(history.undo(editState).parts[0].x, 0)
editState.name = 'second'
history.record(editState)
assert.equal(history.undo(editState).name, 'first')
const rosterHistory = new ShadowHistory(damaged, 80, normalizeShadowRoster)
damaged.characters[0].project.name = 'changed'
rosterHistory.record(damaged)
const undoneRoster = normalizeShadowRoster(rosterHistory.undo(damaged))
rosterHistory.record(undoneRoster)
assert.equal(rosterHistory.stack.length, 0)

console.log('Shadow rig 3D checks passed')
