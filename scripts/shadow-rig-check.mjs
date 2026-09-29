import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { createShadowExampleProjects, installInitialShadowExamples, repairInitialShadowExamples, texturePresetsForShadowProject } from '../src/animation/shadow-examples.js'
import { createEnemyShadowProjects, ENEMY_ART, ENEMY_ART_PACK_VERSION, installEnemyShadowProjects } from '../src/animation/shadow-enemies.js'
import { createRosterEnemyProject } from '../src/animation/shadow-enemy-roster.js'
import { VARIANT_ENEMY_IDS } from '../src/animation/shadow-enemy-variants.js'
import { ENEMY_DEFS } from '../src/game/data/enemies.js'
import { ShadowHistory } from '../src/animation/shadow-history.js'
import { shadowPartGeometry } from '../src/animation/shadow-geometry.js'
import { projectShadowFaces } from '../src/animation/shadow-projection.js'
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
assert.equal(legacy.version, 5)
assert.equal(legacy.parts[0].layer, 9)
assert.equal(legacy.parts[0].z, 0)
assert.equal(legacy.parts[0].rotationZ, -30)
assert.equal(legacy.joints[0].rotationZ, -25)
assert.equal(legacy.animations.idle.tracks['joint:root'][0].rotationZ, -15)
assert.equal(legacy.joints[0].y, -18)
assert.equal(legacy.animations.idle.tracks['joint:root'][0].dy, -3)

const older = normalizeShadowProject({ version: 1, name: 'Older', parts: [{ id: 'old', x: 4, y: 8, z: 6, width: 30, height: 40 }] })
assert.equal(older.version, 5)
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
assert.equal(migratedDepthProject.version, 5)
assert.equal(migratedDepthProject.joints[0].z, 20)
assert.equal(migratedDepthProject.joints[0].rotationY, 45)
assert.equal(migratedDepthProject.parts[0].z, 8)
assert.equal(migratedDepthProject.parts[0].rotationX, -20)
assert.equal(migratedDepthProject.animations.idle.tracks['joint:root'][0].dz, 7)
assert.deepEqual(normalizeShadowProject(migratedDepthProject), migratedDepthProject)
const migratedEvaluation = evaluateShadowProject(migratedDepthProject, 'idle', 500)
for (const kind of ['joints', 'parts']) {
  for (let index = 0; index < oldEvaluation[kind].length; index += 1) {
    const before = shadowMatrixPosition(oldEvaluation[kind][index].matrix)
    const after = shadowMatrixPosition(migratedEvaluation[kind][index].matrix)
    near(after.x, before.x)
    near(after.y, -before.y)
    near(after.z, -before.z)
  }
}

const oldYProject = createDefaultShadowProject()
oldYProject.version = 4
oldYProject.joints = [createShadowJoint({ id: 'root', x: 11, y: 23, z: 31, rotationX: 17, rotationY: 23, rotationZ: -19 }),
  createShadowJoint({ id: 'child', x: -41, y: 64, z: 27, rotationX: 14, rotationZ: 26 })]
oldYProject.bones = [createShadowBone({ id: 'link', fromJointId: 'root', toJointId: 'child' })]
oldYProject.parts = [createShadowPart({ id: 'joint-part', x: 5, y: -13, z: 9, rotationX: 16, rotationY: -12, rotationZ: 37, pivotX: .2, pivotY: .8, depth: 12,
  attachment: { type: 'joint', targetId: 'child', t: .5, followRotation: true } }),
createShadowPart({ id: 'bone-part', x: 7, y: -9, z: 11, rotationX: -13, rotationY: 26, rotationZ: 15,
  attachment: { type: 'bone', targetId: 'link', t: .3, followRotation: true } })]
upsertShadowKeyframe(oldYProject, 'attack', 'joint:child', 180, { dy: 17, dz: 6, rotationX: -9, rotationZ: 21 })
upsertShadowKeyframe(oldYProject, 'attack', 'part:bone-part', 180, { dy: -11, rotationX: 23, rotationZ: 19 })
const migratedY = normalizeShadowProject(oldYProject)
assert.equal(migratedY.parts[0].depth, 12)
assert.equal(migratedY.parts[0].pivotY, .8)
assert.deepEqual(normalizeShadowProject(migratedY), migratedY)
for (const time of [0, 180, 400]) {
  const before = evaluateShadowProject(oldYProject, 'attack', time)
  const after = evaluateShadowProject(migratedY, 'attack', time)
  const signs = [1, -1, 1, 1]
  for (const kind of ['joints', 'parts']) for (let index = 0; index < before[kind].length; index += 1) {
    const a = before[kind][index].matrix.elements, b = after[kind][index].matrix.elements
    for (let col = 0; col < 4; col += 1) for (let row = 0; row < 4; row += 1) near(b[col * 4 + row], a[col * 4 + row] * signs[col] * signs[row])
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
  assert.equal(example.joints[0].rotationY, -30)
  const rootForward = evaluateShadowProject(example).joints[0].matrix.elements
  assert.ok(rootForward[8] < 0 && rootForward[10] > 0, `${example.name}: forward must face viewer-left and camera`)
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
assert.equal(damaged.characters[0].project.joints[0].rotationY, -30)
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
assert.equal(alreadyRepaired.examplePackVersion, 9)
assert.equal(alreadyRepaired.characters[0].project.joints[0].rotationY, -30)
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

const enemyProjects = createEnemyShadowProjects()
assert.deepEqual(new Set(enemyProjects.map((project) => project.enemyId)), new Set(ENEMY_DEFS.map((enemy) => enemy.id)))
assert.deepEqual(new Set(enemyProjects.slice(3).map((project) => project.enemyId)), new Set(VARIANT_ENEMY_IDS))
const topologyKeys = enemyProjects.slice(3).map((project) => {
  const children = new Map(project.joints.map((joint) => [joint.id, []]))
  for (const bone of project.bones) children.get(bone.fromJointId).push(bone.toJointId)
  const topology = (id) => `(${children.get(id).map(topology).sort().join('')})`
  return topology('root')
})
assert.equal(new Set(topologyKeys).size, VARIANT_ENEMY_IDS.length, 'roster enemies should have distinct joint hierarchies')
assert.equal(enemyProjects.find((project) => project.enemyId === 'nest-spider').joints.filter((joint) => joint.id.endsWith('-coxa')).length, 8)
assert.equal(enemyProjects.find((project) => project.enemyId === 'gnawer').joints[0].name, '\u80f8\u690e')
assert.ok(enemyProjects.every((project) => project.name.endsWith('\u9aa8\u67b6\u9884\u89c8')))
for (const project of enemyProjects) {
  const art = ENEMY_ART[project.enemyId]
  assert.ok(art)
  assert.ok(project.joints.length >= (['gnawer', 'emberwing-moth', 'rootrot-bud'].includes(project.enemyId) ? 15 : 13), `${project.enemyId}: missing skeleton`)
  assert.ok(project.parts.length >= (['gnawer', 'emberwing-moth', 'rootrot-bud'].includes(project.enemyId) ? 18 : 11), `${project.enemyId}: missing articulated geometry`)
  const normalized = normalizeShadowProject(project)
  assert.equal(normalized.enemyId, project.enemyId)
  assert.equal(normalized.parts.length, project.parts.length)
  const rest = evaluateShadowProject(project)
  const forward = rest.jointsById.get('root').matrix.elements
  near(forward[8], -.5)
  near(forward[10], Math.sqrt(3) / 2)
  const heights = rest.joints.map((entry) => shadowMatrixPosition(entry.matrix).y)
  const depths = rest.joints.map((entry) => shadowMatrixPosition(entry.matrix).z)
  if (art.family === 'arthropod') {
    assert.ok(Math.min(...heights) < -50, `${project.enemyId}: crawler lacks ground-reaching feet`)
  } else {
    const upperLimit = ['quadruped', 'toad'].includes(art.family) ? 10 : 30
    assert.ok(Math.max(...heights) > upperLimit && Math.max(...heights) - Math.min(...heights) > 75,
      `${project.enemyId}: skeleton lacks vertical articulation`)
  }
  assert.ok(Math.max(...depths) - Math.min(...depths) > 75, `${project.enemyId}: flat skeleton`)
  if (['quadruped', 'toad', 'arthropod'].includes(art.family)) {
    const head = shadowMatrixPosition(rest.jointsById.get('head').matrix)
    const rear = shadowMatrixPosition(rest.jointsById.get(art.family === 'arthropod' ? 'abdomen' : 'haunch').matrix)
    assert.ok(head.x < rear.x - 25 && head.z > rear.z,
      `${project.enemyId}: head must point toward viewer-left after the -30 degree yaw`)
    if (art.family === 'arthropod') {
      assert.ok(Math.abs(head.y - rear.y) < 20, `${project.enemyId}: head and abdomen must lie horizontally`)
      assert.ok(project.parts.find((part) => part.id === 'carapace').rotationX < -40,
        `${project.enemyId}: carapace should lie over the legs`)
    }
  }
  const jointIds = new Set(project.joints.map((joint) => joint.id))
  const boneIds = new Set(project.bones.map((bone) => bone.id))
  for (const part of normalized.parts) {
    assert.equal(part.visual.type, 'shape', `${project.enemyId}: ${part.id} still has texture`)
    assert.equal(part.visual.texture, null)
    assert.equal(part.depth, 0, `${project.enemyId}: ${part.id} must remain a paper plane`)
    assert.ok((part.attachment.type === 'bone' ? boneIds : jointIds).has(part.attachment.targetId), `${project.enemyId}: missing target for ${part.id}`)
  }
  const volume = shadowPartGeometry(project.parts[0])
  volume.computeBoundingBox()
  assert.equal(volume.boundingBox.max.z - volume.boundingBox.min.z, 0)
  volume.dispose()
  const faces = projectShadowFaces(rest)
  assert.equal(faces.length, project.parts.length)
  assert.ok(faces.every((face) => face.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))))
  for (const action of ['idle', 'move', 'attack', 'hit', 'death']) {
    const animation = project.animations[action]
    assert.ok(animation.tracks['joint:root']?.length >= 3, `${project.enemyId}: ${action} root animation`)
    assert.ok(Object.keys(animation.tracks).filter((key) => key.startsWith('joint:') && key !== 'joint:root').length >= 2, `${project.enemyId}: ${action} has no joint articulation`)
    if (VARIANT_ENEMY_IDS.includes(project.enemyId)) {
      assert.ok(Object.keys(animation.tracks).some((key) => key.endsWith('-hinge')),
        `${project.enemyId}: ${action} lacks motion on its distinctive organ`)
    }
    for (const time of [0, animation.duration / 2, animation.duration]) {
      const evaluation = evaluateShadowProject(project, action, time)
      assert.equal(evaluation.parts.length, project.parts.length)
      for (const part of evaluation.parts) assert.ok(part.matrix.elements.every(Number.isFinite))
    }
  }
}
const enemyRoster = normalizeShadowRoster({ characters: [] })
assert.equal(installEnemyShadowProjects(enemyRoster), true)
assert.equal(enemyRoster.enemyArtPackVersion, ENEMY_ART_PACK_VERSION)
assert.equal(enemyRoster.characters.length, ENEMY_DEFS.length + 1)
enemyRoster.characters[1].project.parts[0].x += 13
const savedEnemyRoster = normalizeShadowRoster(enemyRoster)
assert.equal(savedEnemyRoster.characters[1].project.parts[0].x, enemyRoster.characters[1].project.parts[0].x)
assert.equal(installEnemyShadowProjects(savedEnemyRoster), false)
savedEnemyRoster.characters.splice(1, 1)
assert.equal(installEnemyShadowProjects(savedEnemyRoster), false)
assert.equal(savedEnemyRoster.characters.length, ENEMY_DEFS.length)

const paperRoster = normalizeShadowRoster({ characters: [{ id: 'edited-gnawer', project: enemyProjects[0] }],
  activeCharacterId: 'edited-gnawer', enemyArtPackVersion: 6 })
paperRoster.characters[0].project.parts[0].x += 27
assert.equal(installEnemyShadowProjects(paperRoster), true)
assert.equal(paperRoster.characters[0].project.parts[0].x, enemyProjects[0].parts[0].x + 27)
assert.equal(paperRoster.activeCharacterId, 'edited-gnawer')
assert.equal(paperRoster.characters.filter(({ project }) => project.enemyId).length, ENEMY_DEFS.length)

const genericSpider = createRosterEnemyProject(ENEMY_DEFS.find((definition) => definition.id === 'nest-spider'), { withVariants: false })
const pristineCrawler = normalizeShadowRoster({ characters: [{ id: 'pristine-spider', project: genericSpider }],
  activeCharacterId: 'pristine-spider', enemyArtPackVersion: 8 })
assert.equal(installEnemyShadowProjects(pristineCrawler), true)
assert.equal(pristineCrawler.characters.filter(({ project }) => !project.enemyId).length, 0)
assert.ok(pristineCrawler.characters[0].project.joints.some((joint) => joint.id === 'spinneret-hinge'))

const editedCrawler = normalizeShadowRoster({ characters: [{ id: 'edited-spider', project: genericSpider }],
  activeCharacterId: 'edited-spider', enemyArtPackVersion: 8 })
editedCrawler.characters[0].project.parts[0].width += 13
assert.equal(installEnemyShadowProjects(editedCrawler), true)
assert.equal(editedCrawler.characters[0].project.parts[0].width,
  enemyProjects.find((project) => project.enemyId === 'nest-spider').parts[0].width)
assert.ok(editedCrawler.characters.some(({ project }) => !project.enemyId
  && project.parts[0].width === genericSpider.parts[0].width + 13))
assert.equal(editedCrawler.activeCharacterId, 'edited-spider')

const standingSpider = normalizeShadowRoster({ characters: [{ id: 'standing-spider',
  project: genericSpider }],
activeCharacterId: 'standing-spider', enemyArtPackVersion: 7 })
standingSpider.characters[0].project.joints.find((joint) => joint.id === 'head').y = 57
standingSpider.characters[0].project.joints.find((joint) => joint.id === 'abdomen').y = -61
standingSpider.characters[0].project.parts[0].width += 19
assert.equal(installEnemyShadowProjects(standingSpider), true)
assert.equal(standingSpider.characters[0].project.joints.find((joint) => joint.id === 'head').y, 6)
assert.ok(standingSpider.characters.some(({ project }) => !project.enemyId
  && project.parts[0].width === genericSpider.parts[0].width + 19))
assert.equal(standingSpider.activeCharacterId, 'standing-spider')

const oldEnemy = JSON.parse(JSON.stringify(enemyProjects[0]))
oldEnemy.parts = [
  { ...createShadowPart({ id: 'head-art' }), visual: { type: 'texture', texture: '/assets/enemies/characters/gnawer.png', textureFit: 'cover' } },
  { ...createShadowPart({ id: 'body-art' }), visual: { type: 'texture', texture: '/assets/enemies/atlases/enemy-batch-1.png', textureFit: 'cover' } },
  { ...createShadowPart({ id: 'custom-charm' }), visual: { type: 'texture', texture: '/assets/enemies/my-charm.png', textureFit: 'contain' } },
]
const oldEnemyRoster = normalizeShadowRoster({ characters: [{ id: 'gnawer-old', project: oldEnemy }], enemyArtPackVersion: 2 })
assert.equal(installEnemyShadowProjects(oldEnemyRoster), true)
const restored = oldEnemyRoster.characters.find(({ project }) => project.enemyId === 'gnawer').project
assert.ok(restored.parts.some((part) => part.id === 'skull' && part.visual.type === 'shape'))
assert.ok(restored.parts.every((part) => part.visual.type === 'shape'))
assert.ok(!restored.parts.some((part) => part.id === 'head-art' || part.id === 'body-art'))
assert.equal(oldEnemyRoster.characters.filter(({ project }) => project.enemyId === 'gnawer').length, 1)
assert.equal(oldEnemyRoster.characters.filter(({ project }) => project.enemyId).length, ENEMY_DEFS.length)

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
