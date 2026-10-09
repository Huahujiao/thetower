import assert from 'node:assert/strict'
/* global structuredClone */
import { existsSync } from 'node:fs'
import { createShadowExampleProjects, installInitialShadowExamples, repairInitialShadowExamples, texturePresetsForShadowProject } from '../src/animation/shadow-examples.js'
import { createEnemyShadowProject, createEnemyShadowProjects, ENEMY_ART, ENEMY_ART_PACK_VERSION, installEnemyShadowProjects } from '../src/animation/shadow-enemies.js'
import { COMPONENT_ENEMY_IDS, BATCH2_COMPONENT_ENEMY_IDS, BATCH3_COMPONENT_ENEMY_IDS, BATCH4_COMPONENT_ENEMY_IDS } from '../src/animation/shadow-enemy-components.js'
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
  assert.equal(example.joints[0].rotationY, 0)
  const rootForward = evaluateShadowProject(example).joints[0].matrix.elements
  assert.ok(Math.abs(rootForward[8]) < 1e-8 && rootForward[10] > 0, `${example.name}: forward must face the camera`)
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
assert.equal(damaged.characters[0].project.joints[0].rotationY, 0)
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
assert.equal(alreadyRepaired.examplePackVersion, 10)
assert.equal(alreadyRepaired.characters[0].project.joints[0].rotationY, 0)
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
assert.ok(enemyProjects.every((project) => !project.name.endsWith('\u9aa8\u67b6\u9884\u89c8')))
assert.ok(enemyProjects.every((project) => project.joints.find((joint) => joint.id === 'root').rotationY === 0))
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
  near(forward[8], 0)
  near(forward[10], 1)
  const heights = rest.joints.map((entry) => shadowMatrixPosition(entry.matrix).y)
  // Measure the same oblique silhouette after removing the default root yaw.
  const depths = rest.joints.map((entry) => {
    const { x, z } = shadowMatrixPosition(entry.matrix)
    return x / 2 + z * Math.sqrt(3) / 2
  })
  if (art.family === 'arthropod') {
    assert.ok(Math.min(...heights) < -50, `${project.enemyId}: crawler lacks ground-reaching feet`)
  } else {
    const crawling = art.family === 'swarm' && !project.grounding.floating
    const upperLimit = ['quadruped', 'toad'].includes(art.family) || crawling ? 10 : 30
    assert.ok(Math.max(...heights) >= upperLimit && Math.max(...heights) - Math.min(...heights) > (crawling ? 25 : 75),
      `${project.enemyId}: skeleton lacks vertical articulation`)
  }
  // Compact component rigs no longer include the draft's unused finger/antenna branches.
  assert.ok(Math.max(...depths) - Math.min(...depths) > (COMPONENT_ENEMY_IDS.includes(project.enemyId) ? 45 : 75), `${project.enemyId}: flat skeleton`)
  if (['quadruped', 'toad', 'arthropod'].includes(art.family)) {
    const head = shadowMatrixPosition(rest.jointsById.get('head').matrix)
    const rear = shadowMatrixPosition(rest.jointsById.get(art.family === 'arthropod' ? 'abdomen' : 'haunch').matrix)
    assert.ok(head.z > rear.z,
      `${project.enemyId}: head must point forward along +Z`)
    if (art.family === 'arthropod') {
      assert.ok(Math.abs(head.y - rear.y) < 20, `${project.enemyId}: head and abdomen must lie horizontally`)
      const carapace = rest.parts.find(({ part }) => part.id === 'carapace').matrix.elements
      // Tilting the parent hinge also tilts its attached shell and ornaments.
      assert.ok(carapace[9] / Math.hypot(carapace[8], carapace[9], carapace[10]) > Math.sin(40 * Math.PI / 180),
        `${project.enemyId}: carapace should lie over the legs`)
    }
  }
  const jointIds = new Set(project.joints.map((joint) => joint.id))
  const boneIds = new Set(project.bones.map((bone) => bone.id))
  for (const part of normalized.parts) {
    if (COMPONENT_ENEMY_IDS.includes(project.enemyId)) {
      assert.equal(part.visual.type, 'texture', `${project.enemyId}: ${part.id} missing component art`)
      assert.ok(existsSync(new URL(`../public${part.visual.texture}`, import.meta.url)))
      const crop = part.visual.textureFrame.crop
      assert.ok(crop.left >= 0 && crop.top >= 0 && crop.left + crop.width <= 1.000001 && crop.top + crop.height <= 1.000001)
    } else {
      assert.equal(part.visual.type, 'shape')
      assert.equal(part.visual.texture, null)
    }
    assert.equal(part.depth, 0, `${project.enemyId}: ${part.id} must remain a paper plane`)
    assert.ok((part.attachment.type === 'bone' ? boneIds : jointIds).has(part.attachment.targetId), `${project.enemyId}: missing target for ${part.id}`)
  }
  const volume = shadowPartGeometry(project.parts[0])
  volume.computeBoundingBox()
  assert.equal(volume.boundingBox.max.z - volume.boundingBox.min.z, 0)
  volume.dispose()
  const faces = projectShadowFaces(rest)
  assert.equal(faces.length, project.parts.filter(part => part.visual.type === 'shape').length)
  assert.ok(faces.every((face) => face.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))))
  for (const action of ['idle', 'move', 'attack', 'hit', 'death']) {
    const animation = project.animations[action]
    assert.ok(animation.tracks['joint:root']?.length >= 3, `${project.enemyId}: ${action} root animation`)
    assert.ok(Object.keys(animation.tracks).filter((key) => key.startsWith('joint:') && key !== 'joint:root').length >= 2, `${project.enemyId}: ${action} has no joint articulation`)
    if (VARIANT_ENEMY_IDS.includes(project.enemyId)) {
      const componentOrgans = {
        'furnace-beetle': ['left-shutter', 'right-shutter'],
        'thorn-shell-flower': ['left-shell', 'right-shell'],
        'water-leech-swarm': ['leech-0-jaw', 'leech-1-jaw', 'leech-2-jaw'],
        'whirlpool-eye-sac': ['eye', 'tether'],
        'cinder-curse-lamp-swarm': ['lamp-0-core', 'lamp-1-core', 'lamp-2-core'],
        'drown-shadow-hunter': ['scythe', 'right-arm'],
        'tidal-spore-sac': ['pod-0', 'pod-1', 'pod-2'],
        'revenant-guard': ['soul-focus', 'left-wrist'],
        'bomb-wisp': ['core', 'left-fuse', 'right-fuse'],
        'cracked-hunter': ['hook', 'missing-arm'],
        broodling: ['left-jaw', 'right-jaw'],
        'leech-larva': ['mouth', 'left-sucker', 'right-sucker'],
        'tide-shadow': ['eye', 'left-wrist', 'right-wrist'],
      }[project.enemyId]
      assert.ok(componentOrgans
        ? componentOrgans.every(id => animation.tracks[`joint:${id}`]?.some(frame => frame.rotationX || frame.rotationY || frame.rotationZ))
        : Object.keys(animation.tracks).some((key) => key.endsWith('-hinge')),
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

const paperGnawer = createEnemyShadowProject(ENEMY_DEFS[0], { withComponentArt: false })
const paperRoster = normalizeShadowRoster({ characters: [{ id: 'edited-gnawer', project: paperGnawer }],
  activeCharacterId: 'edited-gnawer', enemyArtPackVersion: 6 })
paperRoster.characters[0].project.parts[0].x += 27
assert.equal(installEnemyShadowProjects(paperRoster), true)
assert.equal(paperRoster.characters[0].project.parts[0].x, enemyProjects[0].parts[0].x)
assert.ok(paperRoster.characters.some(({ project }) => !project.enemyId && project.parts[0].x === paperGnawer.parts[0].x + 27))
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
assert.ok(restored.parts.some((part) => part.id === 'skull' && part.visual.type === 'texture'))
assert.ok(restored.parts.every((part) => part.visual.type === 'texture'))
assert.ok(!restored.parts.some((part) => part.id === 'head-art' || part.id === 'body-art'))
assert.equal(oldEnemyRoster.characters.filter(({ project }) => project.enemyId === 'gnawer').length, 1)
assert.equal(oldEnemyRoster.characters.filter(({ project }) => project.enemyId).length, ENEMY_DEFS.length)

// V9 edits are archived, association/selection survive, and a second load is a no-op.
const componentMigration = normalizeShadowRoster({ enemyArtPackVersion: 9, activeCharacterId: 'custom-six', characters: [{ id: 'custom-six',
  project: createEnemyShadowProject(ENEMY_DEFS[0], { withComponentArt: false }) }] })
componentMigration.characters[0].project.parts[0].visual = { type: 'texture', texture: '/personal.png', textureFit: 'cover' }
const originalCustom = JSON.stringify(componentMigration.characters[0].project)
assert.equal(installEnemyShadowProjects(componentMigration), true)
assert.equal(componentMigration.activeCharacterId, 'custom-six')
const archive = componentMigration.characters.find(({ project }) => !project.enemyId && project.parts[0].visual.texture === '/personal.png')
assert.ok(archive)
const beforeArchive = JSON.parse(originalCustom)
assert.equal(JSON.stringify({ ...archive.project, name: beforeArchive.name, enemyId: beforeArchive.enemyId }), JSON.stringify(normalizeShadowProject(beforeArchive)))
const afterFirstLoad = JSON.stringify(componentMigration)
assert.equal(installEnemyShadowProjects(componentMigration), false)
assert.equal(JSON.stringify(componentMigration), afterFirstLoad)

// A saved V10 rig gets the elbow-chain offset and width update with custom edits.
// Persistence must not apply it twice or replace other species / backups.
const oldGnawer = JSON.parse(JSON.stringify(enemyProjects.find(p => p.enemyId === 'gnawer')))
oldGnawer.joints.find(j => j.id === 'root').scaleX = 1
for (const side of ['left', 'right']) {
  const elbow = oldGnawer.joints.find(j => j.id === `${side}-elbow`)
  elbow.y += 3
  elbow.z -= 3
}
oldGnawer.joints.find(j => j.id === 'left-elbow').y -= 1.5
oldGnawer.parts.find(p => p.id === 'right-palm').x += 2
oldGnawer.name = 'custom gnawer'
oldGnawer.animations.attack.tracks['joint:right-elbow'][1].rotationZ += 7
const elbowRoster = normalizeShadowRoster({ enemyArtPackVersion: 10, activeCharacterId: 'elbow-edit', characters: [
  { id: 'elbow-edit', project: oldGnawer },
  { id: 'other-edit', project: enemyProjects.find(p => p.enemyId === 'nest-spider') },
  { id: 'old-backup', project: { ...oldGnawer, enemyId: null } },
] })
const expectedElbowRoster = JSON.parse(JSON.stringify(elbowRoster))
expectedElbowRoster.enemyArtPackVersion = ENEMY_ART_PACK_VERSION
expectedElbowRoster.characters[0].project.joints.find(j => j.id === 'root').scaleX = 1.15
for (const side of ['left', 'right']) {
  const elbow = expectedElbowRoster.characters[0].project.joints.find(j => j.id === `${side}-elbow`)
  elbow.y -= 3
  elbow.z += 3
}
assert.equal(installEnemyShadowProjects(elbowRoster), true)
expectedElbowRoster.characters.push(...elbowRoster.characters.slice(3))
assert.deepEqual(elbowRoster, expectedElbowRoster)
const reloadedElbowRoster = normalizeShadowRoster(elbowRoster)
const savedElbowSnapshot = JSON.stringify(reloadedElbowRoster)
assert.equal(installEnemyShadowProjects(reloadedElbowRoster), false)
assert.equal(JSON.stringify(reloadedElbowRoster), savedElbowSnapshot)
// Geometry-only personal replacements are not mistaken for component art.
const personalElbowRoster = normalizeShadowRoster({ enemyArtPackVersion: 10, characters: [
  { id: 'geometric', project: createEnemyShadowProject(ENEMY_DEFS[0], { withComponentArt: false }) },
] })
const personalElbowSnapshot = JSON.stringify(personalElbowRoster.characters)
assert.equal(installEnemyShadowProjects(personalElbowRoster), true)
const personalBefore = JSON.parse(personalElbowSnapshot)[0].project
const personalAfter = personalElbowRoster.characters[0].project
assert.deepEqual(personalAfter.parts, personalBefore.parts)
assert.deepEqual(personalAfter.animations, personalBefore.animations)
assert.equal(JSON.stringify(personalAfter.joints.slice(0, personalBefore.joints.length)), JSON.stringify(personalBefore.joints))
assert.ok(personalAfter.grounding.supports.length)

// V11 -> V12 widens just the two narrow rigs. Custom proportions, poses,
// associations and detached backups survive, and persisted loads are a no-op.
const widthRoster = normalizeShadowRoster({ enemyArtPackVersion: 11, activeCharacterId: 'wide-cub', characters: [
  { id: 'wide-gnawer', project: enemyProjects.find(p => p.enemyId === 'gnawer') },
  { id: 'wide-cub', project: enemyProjects.find(p => p.enemyId === 'tide-shadow-cub') },
  { id: 'unchanged', project: enemyProjects.find(p => p.enemyId === 'emberwing-moth') },
  { id: 'detached', project: { ...enemyProjects[0], enemyId: null } },
] })
for (const { project } of widthRoster.characters.slice(0, 2)) project.joints.find(j => j.id === 'root').scaleX = 1.07
widthRoster.characters[1].project.parts[0].y += 5
const expectedWidthRoster = structuredClone(widthRoster)
expectedWidthRoster.enemyArtPackVersion = ENEMY_ART_PACK_VERSION
for (const { project } of expectedWidthRoster.characters.slice(0, 2)) project.joints.find(j => j.id === 'root').scaleX *= 1.15
assert.equal(installEnemyShadowProjects(widthRoster), true)
expectedWidthRoster.characters.push(...widthRoster.characters.slice(4))
assert.deepEqual(widthRoster, expectedWidthRoster)
const persistedWidthRoster = normalizeShadowRoster(JSON.parse(JSON.stringify(widthRoster)))
assert.equal(JSON.stringify(persistedWidthRoster), JSON.stringify(widthRoster))
assert.equal(installEnemyShadowProjects(persistedWidthRoster), false)
assert.equal(JSON.stringify(persistedWidthRoster), JSON.stringify(expectedWidthRoster))

// V12 installs the following two non-contiguous batches. The original six
// component rigs and all other species stay byte-for-byte intact. Edited geometry is
// retained as a detached backup, with selection and enemy association stable.
const postV12Ids = [...BATCH2_COMPONENT_ENEMY_IDS, ...BATCH3_COMPONENT_ENEMY_IDS, ...BATCH4_COMPONENT_ENEMY_IDS]
const batchRoster = normalizeShadowRoster({ enemyArtPackVersion: 12, activeCharacterId: 'batch-rot-walker',
  characters: enemyProjects.map(project => ({ id: `batch-${project.enemyId}`, project: postV12Ids.includes(project.enemyId)
    ? createEnemyShadowProject(ENEMY_DEFS.find(d => d.id === project.enemyId), { withComponentArt: false }) : project })) })
const oldBatchProjects = new Map(batchRoster.characters.map(c => [c.project.enemyId, JSON.stringify(c.project)]))
const customWalker = batchRoster.characters.find(c => c.project.enemyId === 'rot-walker')
customWalker.project.parts[0].width += 13
const customWalkerSnapshot = normalizeShadowProject({ ...customWalker.project, name: `${customWalker.project.name} · 旧版备份`, enemyId: null })
assert.equal(installEnemyShadowProjects(batchRoster), true)
assert.equal(batchRoster.activeCharacterId, 'batch-rot-walker')
assert.equal(batchRoster.characters.length, ENEMY_DEFS.length + 1)
assert.deepEqual(batchRoster.characters.find(c => !c.project.enemyId).project, customWalkerSnapshot)
for (const { project } of batchRoster.characters) {
  if (!project.enemyId) continue
  if (!postV12Ids.includes(project.enemyId)) assert.equal(JSON.stringify(project), oldBatchProjects.get(project.enemyId))
  else assert.ok(project.parts.every(p => p.visual.texture?.startsWith(`/assets/enemies/components-v1/${project.enemyId}/`)))
}
const reloadedBatch = normalizeShadowRoster(JSON.parse(JSON.stringify(batchRoster)))
const installedBatchSnapshot = JSON.stringify(reloadedBatch)
assert.equal(installEnemyShadowProjects(reloadedBatch), false)
assert.equal(JSON.stringify(reloadedBatch), installedBatchSnapshot)

// V13 -> V14 replaces only this batch, preserving the other 27 projects,
// including edits to the twelve existing component rigs and their poses.
const postV13Ids = [...BATCH3_COMPONENT_ENEMY_IDS, ...BATCH4_COMPONENT_ENEMY_IDS]
const thirdBatchRoster = normalizeShadowRoster({ enemyArtPackVersion: 13, activeCharacterId: 'third-drown-shadow-hunter',
  characters: enemyProjects.map(project => ({ id: `third-${project.enemyId}`, project: postV13Ids.includes(project.enemyId)
    ? createEnemyShadowProject(ENEMY_DEFS.find(d => d.id === project.enemyId), { withComponentArt: false }) : project })) })
thirdBatchRoster.characters.find(c => c.project.enemyId === 'wisp').project.parts[0].x += 9
const oldThirdProjects = new Map(thirdBatchRoster.characters.map(c => [c.project.enemyId, JSON.stringify(c.project)]))
const customHunter = thirdBatchRoster.characters.find(c => c.project.enemyId === 'drown-shadow-hunter')
customHunter.project.parts[0].width += 11
const customHunterSnapshot = normalizeShadowProject({ ...customHunter.project, name: `${customHunter.project.name} · 旧版备份`, enemyId: null })
assert.equal(installEnemyShadowProjects(thirdBatchRoster), true)
assert.equal(thirdBatchRoster.activeCharacterId, 'third-drown-shadow-hunter')
assert.equal(thirdBatchRoster.enemyArtPackVersion, ENEMY_ART_PACK_VERSION)
assert.equal(thirdBatchRoster.characters.length, ENEMY_DEFS.length + 1)
assert.deepEqual(thirdBatchRoster.characters.find(c => !c.project.enemyId).project, customHunterSnapshot)
for (const { project } of thirdBatchRoster.characters) {
  if (!project.enemyId) continue
  if (!postV13Ids.includes(project.enemyId)) assert.equal(JSON.stringify(project), oldThirdProjects.get(project.enemyId))
  else assert.ok(project.parts.every(p => p.visual.texture?.startsWith(`/assets/enemies/components-v1/${project.enemyId}/`)))
}
const persistedThird = normalizeShadowRoster(JSON.parse(JSON.stringify(thirdBatchRoster)))
const thirdSnapshot = JSON.stringify(persistedThird)
assert.equal(installEnemyShadowProjects(persistedThird), false)
assert.equal(JSON.stringify(persistedThird), thirdSnapshot)

// V14 replaces only the seven new component rigs. Earlier component art,
// personal edits and the selected ID survive; persisted loads are a no-op.
const fourthRoster = normalizeShadowRoster({ enemyArtPackVersion: 14, activeCharacterId: 'fourth-bomb-wisp',
  characters: enemyProjects.map(project => ({ id: `fourth-${project.enemyId}`, project: BATCH4_COMPONENT_ENEMY_IDS.includes(project.enemyId)
    ? createEnemyShadowProject(ENEMY_DEFS.find(d => d.id === project.enemyId), { withComponentArt: false }) : project })) })
fourthRoster.characters.find(c => c.project.enemyId === 'cinder-curse-lamp-swarm').project.parts[0].x += 7
const originalFourth = new Map(fourthRoster.characters.map(c => [c.project.enemyId, JSON.stringify(c.project)]))
const customBomb = fourthRoster.characters.find(c => c.project.enemyId === 'bomb-wisp')
customBomb.project.parts[0].width += 9
const customBombBackup = normalizeShadowProject({ ...customBomb.project, name: `${customBomb.project.name} · 旧版备份`, enemyId: null })
assert.equal(installEnemyShadowProjects(fourthRoster), true)
assert.equal(fourthRoster.activeCharacterId, 'fourth-bomb-wisp')
assert.equal(fourthRoster.enemyArtPackVersion, ENEMY_ART_PACK_VERSION)
assert.equal(fourthRoster.characters.length, ENEMY_DEFS.length + 1)
assert.deepEqual(fourthRoster.characters.find(c => !c.project.enemyId).project, customBombBackup)
for (const { project } of fourthRoster.characters) {
  if (!project.enemyId) continue
  if (!BATCH4_COMPONENT_ENEMY_IDS.includes(project.enemyId)) assert.equal(JSON.stringify(project), originalFourth.get(project.enemyId))
  else assert.ok(project.parts.every(part => part.visual.texture?.startsWith(`/assets/enemies/components-v1/${project.enemyId}/`)))
}
const persistedFourth = normalizeShadowRoster(JSON.parse(JSON.stringify(fourthRoster)))
const fourthSnapshot = JSON.stringify(persistedFourth)
assert.equal(installEnemyShadowProjects(persistedFourth), false)
assert.equal(JSON.stringify(persistedFourth), fourthSnapshot)

// Every part and hinge keeps its exact transform relative to the root in
// rest and all five actions, so stretching cannot separate textured seams.
for (const id of ['gnawer', 'tide-shadow-cub']) {
  const wide = normalizeShadowProject(enemyProjects.find(p => p.enemyId === id))
  const narrow = JSON.parse(JSON.stringify(wide))
  narrow.joints.find(j => j.id === 'root').scaleX /= 1.15
  for (const action of [null, 'idle', 'move', 'attack', 'hit', 'death']) {
    for (const fraction of [0, .27, .64, .85, 1]) {
      const time = (wide.animations[action]?.duration || 0) * fraction
      const a = evaluateShadowProject(wide, action, time, { raw: true }), b = evaluateShadowProject(narrow, action, time, { raw: true })
      const aRoot = a.jointsById.get('root').matrix, bRoot = b.jointsById.get('root').matrix
      const stretch = aRoot.clone().multiply(bRoot.clone().invert())
      for (const type of ['joints', 'parts']) for (let i = 0; i < a[type].length; i++) {
        const expected = stretch.clone().multiply(b[type][i].matrix)
        a[type][i].matrix.elements.forEach((value, axis) => near(value, expected.elements[axis]))
      }
    }
  }
}
for (const id of COMPONENT_ENEMY_IDS) {
  const project = enemyProjects.find(p => p.enemyId === id)
  for (const action of ['idle', 'move', 'attack', 'hit', 'death']) {
    const animation = project.animations[action]
    for (const [target, frames] of Object.entries(animation.tracks)) if (target.startsWith('joint:') && target !== 'joint:root') {
      assert.ok(frames.every(f => f.dx === 0 && f.dy === 0 && f.dz === 0), `${id}/${action}/${target}: textured hinge drift`)
    }
    const first = evaluateShadowProject(project, action, 0)
    const last = evaluateShadowProject(project, action, animation.duration)
    const beyond = evaluateShadowProject(project, action, animation.duration + 1000)
    for (let i = 0; i < first.parts.length; i++) {
      if (animation.loop) first.parts[i].matrix.elements.forEach((value, axis) => near(value, last.parts[i].matrix.elements[axis]))
      if (action === 'death') last.parts[i].matrix.elements.forEach((value, axis) => near(value, beyond.parts[i].matrix.elements[axis]))
    }
  }
}

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
