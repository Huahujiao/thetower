import assert from 'node:assert/strict'
/* global structuredClone */
import { existsSync } from 'node:fs'
import { createEnemyShadowProjects, installEnemyShadowProjects, ENEMY_ART_PACK_VERSION } from '../src/animation/shadow-enemies.js'
import { createDefaultShadowProject, evaluateShadowProject, normalizeShadowProject } from '../src/animation/shadow-rig.js'
import { shadowPartFloor } from '../src/animation/shadow-grounding.js'
import { BATCH5_COMPONENT_ENEMY_IDS } from '../src/animation/shadow-enemy-components-batch5.js'
import componentAssets from '../src/animation/enemy-component-assets.json' with { type: 'json' }

const projects = createEnemyShadowProjects({ includeBoss: true })
function restoreV23Pose(project) {
  if (project.enemyId === 'gnawer') for (const [side, sign] of [['left', -1], ['right', 1]]) {
    project.joints.find(joint => joint.id === `${side}-shoulder`).rotationZ -= sign * 24
    project.joints.find(joint => joint.id === `${side}-elbow`).rotationZ += sign * 58
  }
  if (project.enemyId === 'tide-shadow-cub') {
    project.joints.find(joint => joint.id === 'head').y += 10
    project.joints.find(joint => joint.id === 'eye-hinge').z -= 1.5
  }
}
function restoreV22Spacing(project) {
  restoreV23Pose(project)
  if (project.enemyId === 'gnawer') project.parts.find(part => part.id === 'pelvis-shell').y -= 4
  if (project.enemyId === 'rootrot-bud') {
    const bud = project.joints.find(joint => joint.id === 'bud')
    bud.y += 8; bud.z -= 1.5
    for (const side of ['left', 'right']) project.joints.find(joint => joint.id === `${side}-root`).z -= 1.5
  }
  if (project.enemyId === 'tide-shadow-cub') for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1
    const fin = project.joints.find(joint => joint.id === `${side}-fin-hinge`)
    const arm = project.joints.find(joint => joint.id === `${side}-arm-hinge`)
    fin.x -= sign * 6; fin.z = sign * 17 - 8
    arm.rotationZ -= sign * 12; arm.z = sign * 11
  }
}
function assertFrontalSkeleton(project) {
  const incoming = new Map(project.bones.map(bone => [bone.toJointId, bone.fromJointId]))
  const signs = [-1, 1, 1, 1]
  for (const raw of [true, false]) {
    const pose = evaluateShadowProject(project, null, 0, { raw })
    for (const left of pose.joints.filter(entry => entry.joint.id.startsWith('left-'))) {
      const rightId = left.joint.id.replace(/^left-/, 'right-')
      const right = pose.jointsById.get(rightId)
      assert(right, `${project.enemyId}/${left.joint.id}: missing paired joint`)
      assert.equal(incoming.get(rightId), incoming.get(left.joint.id)?.replace(/^left-/, 'right-'), `${project.enemyId}: asymmetric parent chain`)
      left.matrix.elements.forEach((value, i) => {
        const reflected = value * signs[i % 4] * signs[Math.floor(i / 4)]
        assert(Math.abs(reflected - right.matrix.elements[i]) < 1e-7,
          `${project.enemyId}/${left.joint.id}: asymmetric ${raw ? 'authored' : 'grounded'} joint transform at ${i}`)
      })
    }
  }
}
let frames = 0, parts = 0
for (const source of projects) {
  const p = normalizeShadowProject(source)
  assert.equal(p.joints.find(j => j.id === 'root').rotationY, 0, `${p.enemyId}: angled default facing`)
  if (p.enemyId === 'gnawer') {
    const rest = evaluateShadowProject(p)
    const position = id => rest.jointsById.get(id).matrix.elements
    assert.equal(position('root')[13], 12, 'gnawer upper body should be raised')
    assert.equal(position('pelvis')[13], -30, 'gnawer pelvis should follow the raised body')
    assert.equal(position('left-hip')[13], -42, 'gnawer hips should rise with the pelvis')
    for (const id of ['shoulder', 'elbow', 'wrist']) {
      assert.equal(position(`left-${id}`)[14], position(`right-${id}`)[14], `gnawer hands: mismatched ${id} depth`)
    }
    assert.equal(position('left-hip')[14], position('right-hip')[14], 'gnawer hips: mismatched depth')
    assert(p.parts.find(part => part.id === 'left-foot').visual.texture.endsWith('/part_008.png'))
    assert(p.parts.find(part => part.id === 'right-foot').visual.texture.endsWith('/part_009.png'))
    assert(p.parts.find(part => part.id === 'left-thigh').height > 6)
    assert(p.parts.find(part => part.id === 'right-thigh').height > 6)
    for (const side of ['left', 'right']) {
      const outward = side === 'left' ? -1 : 1
      assert((position(`${side}-elbow`)[12] - position(`${side}-shoulder`)[12]) * outward > 0, 'gnawer elbows should bend outward')
      assert((position(`${side}-elbow`)[12] - position(`${side}-wrist`)[12]) * outward > 0, 'gnawer forearms should fold inward')
      assert((position(`${side}-ankle`)[12] - position(`${side}-hock`)[12]) * outward > 0, 'gnawer feet should spread outward')
    }
  }
  if (p.enemyId === 'rootrot-bud') {
    const rest = evaluateShadowProject(p)
    const position = id => rest.jointsById.get(id).matrix.elements
    assert.equal(p.parts.length, 11, 'rootrot-bud should have one head, one stem, one bulb and two leaf/root pairs')
    assert(!p.parts.some(part => /crown|thorn|spur|upper-stem-part|leaf-part/.test(part.id)), 'rootrot-bud: redundant overlapping organs')
    for (const side of ['left', 'right']) {
      const outward = side === 'left' ? -1 : 1
      assert((position(`${side}-root-tip`)[12] - position(`${side}-root`)[12]) * outward > 0, 'rootrot-bud roots should spread outward')
    }
  }
  if (['gnawer', 'rootrot-bud', 'beetle-guard', 'shellguard'].includes(p.enemyId)) assertFrontalSkeleton(p)
  assert(!p.name.endsWith('\u9aa8\u67b6\u9884\u89c8'), `${p.enemyId}: preview suffix in name`)
  const joints = new Set(p.joints.map(j => j.id))
  assert.equal(joints.size, p.joints.length, `${p.enemyId}: duplicate joints`)
  assert.equal(new Set(p.parts.map(s => s.id)).size, p.parts.length, `${p.enemyId}: duplicate parts`)
  for (const bone of p.bones) {
    assert(joints.has(bone.fromJointId) && joints.has(bone.toJointId), `${p.enemyId}: disconnected bone`)
  }
  for (const part of p.parts) {
    parts++
    assert(part.name && part.visual.type === 'texture', `${p.enemyId}/${part.id}: missing named texture`)
    assert(existsSync(new URL(`../public${part.visual.texture}`, import.meta.url)), `${p.enemyId}: missing image`)
    assert.equal(part.depth, 0)
    assert.equal(part.attachment.type, 'joint', `${p.enemyId}: unattached paper part`)
    assert(joints.has(part.attachment.targetId))
  }
  if (!p.grounding.floating) {
    assert(p.grounding.supports.length, `${p.enemyId}: missing feet`)
    assert(p.grounding.supports.every(s => joints.has(s.contactId)))
  }
  const idle = evaluateShadowProject(p, 'idle', 0)
  for (const action of ['idle', 'move', 'attack', 'hit', 'death']) {
    const animation = p.animations[action]
    assert(Object.keys(animation.tracks).length >= 3, `${p.enemyId}/${action}: incomplete animation`)
    for (const target of Object.keys(animation.tracks)) {
      if (target.startsWith('joint:')) assert(joints.has(target.slice(6)), `${p.enemyId}: orphan animation ${target}`)
    }
    if (animation.loop) {
      const first = evaluateShadowProject(p, action, 0), last = evaluateShadowProject(p, action, animation.duration)
      first.parts.forEach((part, i) => part.matrix.elements.forEach((v, k) => assert(Math.abs(v - last.parts[i].matrix.elements[k]) < 1e-5, `${p.enemyId}/${action}: discontinuous animation loop`)))
    }
    for (let i = 0; i <= 32; i++) {
      const pose = evaluateShadowProject(p, action, animation.duration * i / 32)
      frames++
      for (const part of pose.parts) {
        assert(part.matrix.elements.every(Number.isFinite))
        if (!p.grounding.floating) assert(shadowPartFloor(part) >= p.grounding.floorY - 1e-5, `${p.enemyId}/${action}/${i}: floor penetration`)
      }
      if (action === 'idle' && !p.grounding.floating) for (const support of p.grounding.supports) {
        const foot = pose.parts.find(s => s.part.id === support.partId)
        const bind = idle.parts.find(s => s.part.id === support.partId)
        foot.matrix.elements.forEach((v, k) => assert(Math.abs(v - bind.matrix.elements[k]) < 1e-5, `${p.enemyId}: sliding idle foot`))
      }
    }
  }
}
for (const id of ['patrol-hound', 'redwheel-fire-crow']) {
  const p = projects.find(p => p.enemyId === id)
  for (const suffix of ['face', 'jaw']) {
    const a = p.parts.find(p => p.id === `left-${suffix}`), b = p.parts.find(p => p.id === `right-${suffix}`)
    assert.equal(a.visual.texture, b.visual.texture, `${id}: mismatched mirrored profiles`)
    assert.equal(a.attachment.targetId, b.attachment.targetId, `${id}: split fold hinge`)
    assert.equal(a.width, b.width); assert.equal(a.height, b.height)
    assert.equal(a.x, b.x); assert.equal(a.y, b.y); assert.equal(a.z, b.z)
    assert(Math.abs(Math.cos(a.rotationY * Math.PI / 180) + Math.cos(b.rotationY * Math.PI / 180)) < 1e-8)
    assert(Math.abs(Math.sin(a.rotationY * Math.PI / 180) - Math.sin(b.rotationY * Math.PI / 180)) < 1e-8)
  }
}
// The live editor cache must receive all nine templates, including the boss,
// while an unrelated customized character remains untouched.
const custom = structuredClone(projects.find(p => p.enemyId === 'gnawer'))
restoreV22Spacing(custom)
custom.parts[0].fill = '#abcdef'
const roster = { enemyArtPackVersion: 16, activeCharacterId: 'custom', characters: [{ id: 'custom', project: custom }] }
assert(installEnemyShadowProjects(roster))
assert.equal(roster.enemyArtPackVersion, ENEMY_ART_PACK_VERSION)
assert.equal(roster.characters.length, 1 + BATCH5_COMPONENT_ENEMY_IDS.length)
assert.equal(roster.activeCharacterId, 'custom'); assert.equal(roster.characters[0].project.parts[0].fill, '#abcdef')
assert.equal(installEnemyShadowProjects(roster), false)

// Upgrade the current editor cache in place, preserving custom art and motion.
const saved = normalizeShadowProject(projects.find(p => p.enemyId === 'gnawer'))
restoreV22Spacing(saved)
saved.name = 'Custom gnawer \u00b7 \u9aa8\u67b6\u9884\u89c8'
saved.joints.find(j => j.id === 'root').rotationY = -30
saved.joints.find(j => j.id === 'root').y -= 6
for (const id of ['left-knee', 'right-knee']) saved.joints.find(j => j.id === id).y += 6
for (const id of ['left-hock', 'right-hock']) saved.joints.find(j => j.id === id).y -= 6
for (const id of ['left-thigh', 'right-thigh']) saved.parts.find(p => p.id === id).height -= 6
saved.joints.find(j => j.id === 'left-shoulder').z = -13
saved.joints.find(j => j.id === 'right-shoulder').z = 13
saved.joints.find(j => j.id === 'left-hip').z = -10
saved.joints.find(j => j.id === 'right-hip').z = 10
for (const id of ['right-knee', 'right-hock', 'right-ankle']) saved.joints.find(j => j.id === id).z -= .75
for (const id of ['left-shin', 'left-foot', 'right-shin', 'right-foot']) {
  const part = saved.parts.find(p => p.id === id)
  const legSize = componentAssets.gnawer.parts[id.startsWith('left-') ? 8 : 9]
  const legacySize = componentAssets.gnawer.parts[12]
  part.width *= legacySize.width / legSize.width
  part.height *= legacySize.height / legSize.height
  part.visual.texture = part.visual.texture.replace(/part_00[89]\.png$/, 'part_012.png')
}
saved.parts[0].fill = '#123456'
const savedAnimations = JSON.stringify(saved.animations)
const currentRoster = { enemyArtPackVersion: 19, activeCharacterId: 'saved', characters: [{ id: 'saved', project: saved }] }
assert(installEnemyShadowProjects(currentRoster))
assert.equal(currentRoster.enemyArtPackVersion, ENEMY_ART_PACK_VERSION)
assert.equal(currentRoster.characters.length, 1)
assert.equal(currentRoster.activeCharacterId, 'saved')
assert.equal(saved.name, 'Custom gnawer')
assert.equal(saved.joints.find(j => j.id === 'root').rotationY, 0)
assert.equal(saved.joints.find(j => j.id === 'root').y, 12)
assert.equal(saved.joints.find(j => j.id === 'pelvis').y, -42)
assert.equal(saved.joints.find(j => j.id === 'right-hip').y, -12)
assert.equal(saved.joints.find(j => j.id === 'right-shoulder').z, 14)
assert.equal(saved.parts[0].fill, '#123456')
assertFrontalSkeleton(saved)
assert.equal(JSON.stringify(saved.animations), savedAnimations)
saved.joints.find(j => j.id === 'root').rotationY = 18
assert.equal(installEnemyShadowProjects(currentRoster), false)

// V21 already has the raised torso. Correct every paired joint and rebuild
// its old opaque-edge contacts without lifting the upper body a second time.
const priorFrontal = structuredClone(projects.find(p => p.enemyId === 'gnawer'))
restoreV22Spacing(priorFrontal)
priorFrontal.joints.find(j => j.id === 'right-knee').y += 1
priorFrontal.joints.find(j => j.id === 'right-knee').z += .75
priorFrontal.joints.find(j => j.id === 'right-wrist').y -= 2
priorFrontal.joints.find(j => j.id === 'right-foot-ground-contact').x += 9
const frontalRoster = { enemyArtPackVersion: 21, activeCharacterId: 'frontal', characters: [{ id: 'frontal', project: priorFrontal }] }
assert(installEnemyShadowProjects(frontalRoster))
assert.equal(priorFrontal.joints.find(j => j.id === 'root').y, 12)
assert.equal(priorFrontal.grounding.supports.length, 2)
assertFrontalSkeleton(priorFrontal)
assert.equal(installEnemyShadowProjects(frontalRoster), false)

const savedBud = structuredClone(projects.find(p => p.enemyId === 'rootrot-bud'))
savedBud.joints.find(j => j.id === 'left-root').z = -32
savedBud.joints.find(j => j.id === 'right-root').z = 32
savedBud.parts.find(p => p.id === 'left-petal-part').rotationX = -24
savedBud.parts.find(p => p.id === 'right-petal-part').rotationX = 24
const budRoster = { enemyArtPackVersion: 20, activeCharacterId: 'bud', characters: [{ id: 'bud', project: savedBud }] }
assert(installEnemyShadowProjects(budRoster))
assert.equal(budRoster.activeCharacterId, 'bud')
assertFrontalSkeleton(budRoster.characters[0].project)
assert.equal(budRoster.characters[0].project.parts.length, 11)
assert(!budRoster.characters.some(c => !c.project.enemyId), 'obsolete bud backups should be removed during this upgrade')
assert.equal(installEnemyShadowProjects(budRoster), false)
assert.equal(saved.joints.find(j => j.id === 'root').rotationY, 18)

// V22 cache upgrades keep custom textures, motion, grounding and unrelated
// rigs intact, and must not replay the V22 bud replacement or torso lift.
const spacingCharacters = projects.filter(p => ['gnawer', 'rootrot-bud', 'tide-shadow-cub', 'nest-spider'].includes(p.enemyId))
  .map(p => ({ id: p.enemyId, project: structuredClone(p) }))
for (const { project } of spacingCharacters) project.parts[0].fill = '#abcdef'
const expectedSpacing = structuredClone(spacingCharacters)
for (const { project } of spacingCharacters) restoreV22Spacing(project)
const spacingRoster = { enemyArtPackVersion: 22, activeCharacterId: 'rootrot-bud', characters: spacingCharacters }
assert(installEnemyShadowProjects(spacingRoster))
assert.deepEqual(spacingRoster.characters, expectedSpacing, 'upgrades should adjust pose and spacing without replacing customized rigs')
assert.equal(spacingRoster.activeCharacterId, 'rootrot-bud')
assert.equal(installEnemyShadowProjects(spacingRoster), false)
assert.deepEqual(spacingRoster.characters, expectedSpacing, 'spacing must not accumulate on reload')

// V23 updates only the arm pose and head/eye placement, without repeating
// earlier hip lifts, wing widening or spacing changes.
const poseCharacters = structuredClone(expectedSpacing)
for (const { project } of poseCharacters) restoreV23Pose(project)
const poseRoster = { enemyArtPackVersion: 23, activeCharacterId: 'tide-shadow-cub', characters: poseCharacters }
assert(installEnemyShadowProjects(poseRoster))
assert.deepEqual(poseRoster.characters, expectedSpacing, 'V24 should preserve custom rigs and prior spacing')
assert.equal(poseRoster.activeCharacterId, 'tide-shadow-cub')
assert.equal(installEnemyShadowProjects(poseRoster), false)
assert.deepEqual(poseRoster.characters, expectedSpacing, 'upper body pose must not accumulate on reload')

// V24 -> V25 fixes the beetle's authored and grounded mirror symmetry,
// moves the walker in character-relative directions and removes old entries.
const beetle = structuredClone(projects.find(p => p.enemyId === 'beetle-guard'))
beetle.joints.find(j => j.id === 'right-leg-1-knee').y += 2
beetle.joints.find(j => j.id === 'right-leg-1-knee').z += 4
beetle.parts.find(p => p.id === 'right-gate-sheet').width += 3
beetle.joints.find(j => j.id === 'right-leg-0-claw-ground-contact').x += 5
beetle.parts[0].fill = '#123456'
const beetleMotion = JSON.stringify(beetle.animations)
const walker = structuredClone(projects.find(p => p.enemyId === 'rot-walker'))
const expectedWalker = structuredClone(walker)
walker.joints.find(j => j.id === 'left-shoulder').z = -11
walker.joints.find(j => j.id === 'rot-stilt-root').x -= 8
const keptGnawer = structuredClone(projects.find(p => p.enemyId === 'gnawer'))
const expectedGnawer = structuredClone(keptGnawer)
const laterNewCharacter = createDefaultShadowProject()
laterNewCharacter.name = '\u65b0\u89d2\u8272 2'
const cleanupRoster = { enemyArtPackVersion: 24, activeCharacterId: 'backup', characters: [
  { id: 'blank', project: createDefaultShadowProject() },
  { id: 'beetle', project: beetle }, { id: 'walker', project: walker },
  { id: 'gnawer', project: keptGnawer }, { id: 'later-new', project: laterNewCharacter },
  { id: 'backup', project: { ...structuredClone(beetle), enemyId: null, name: 'Beetle \u00b7 \u65e7\u7248\u5907\u4efd' } },
  { id: 'backup2', project: { ...structuredClone(walker), enemyId: null, name: 'Walker \u00b7 \u65e7\u7248\u5907\u4efd' } },
] }
assert(installEnemyShadowProjects(cleanupRoster))
assert.equal(cleanupRoster.enemyArtPackVersion, ENEMY_ART_PACK_VERSION)
assert.deepEqual(cleanupRoster.characters.map(c => c.id), ['beetle', 'walker', 'gnawer', 'later-new'])
assert.equal(cleanupRoster.activeCharacterId, 'beetle')
assertFrontalSkeleton(beetle)
assert.equal(beetle.grounding.supports.length, 6)
assert.equal(beetle.parts[0].fill, '#123456')
assert.equal(JSON.stringify(beetle.animations), beetleMotion)
assert.deepEqual(walker, expectedWalker)
assert.deepEqual(keptGnawer, expectedGnawer, 'V25 must not replay previous arm or hip changes')
const cleaned = structuredClone(cleanupRoster)
assert.equal(installEnemyShadowProjects(cleanupRoster), false)
assert.deepEqual(cleanupRoster, cleaned, 'V25 upgrade must be idempotent')

// V25 -> V26 mirrors the shellguard's complete rig, splays only the armor
// and widens the grounded stance without replaying previous upgrades.
const shellguard = structuredClone(projects.find(p => p.enemyId === 'shellguard'))
for (const [side, sign] of [['left', -1], ['right', 1]]) {
  shellguard.parts.find(p => p.id === `${side}-pauldron`).rotationZ -= sign * 18
  shellguard.joints.find(j => j.id === `${side}-coffin-root-root`).x -= sign * 12
}
shellguard.joints.find(j => j.id === 'left-shoulder').z = -14
shellguard.joints.find(j => j.id === 'right-shoulder').z = 6
shellguard.joints.find(j => j.id === 'right-wrist').y += 2
shellguard.parts.find(p => p.id === 'right-gate-art').width += 3
shellguard.parts[0].fill = '#456789'
const shellguardMotion = JSON.stringify(shellguard.animations)
const retainedWalker = structuredClone(expectedWalker)
const retainedBackup = { ...structuredClone(expectedWalker), enemyId: null, name: 'Later backup \u00b7 \u65e7\u7248\u5907\u4efd' }
const shellguardRoster = { enemyArtPackVersion: 25, activeCharacterId: 'shellguard', characters: [
  { id: 'later-blank', project: createDefaultShadowProject() },
  { id: 'shellguard', project: shellguard }, { id: 'walker', project: retainedWalker },
  { id: 'later-backup', project: retainedBackup },
] }
assert(installEnemyShadowProjects(shellguardRoster))
assert.equal(shellguardRoster.enemyArtPackVersion, ENEMY_ART_PACK_VERSION)
assert.equal(shellguardRoster.activeCharacterId, 'shellguard')
assertFrontalSkeleton(shellguard)
assert.equal(shellguard.grounding.supports.length, 2)
assert.equal(shellguard.parts[0].fill, '#456789')
assert.equal(JSON.stringify(shellguard.animations), shellguardMotion)
for (const [side, sign] of [['left', -1], ['right', 1]]) {
  assert.equal(shellguard.joints.find(j => j.id === `${side}-coffin-root-root`).x, sign * 33)
  assert.equal(shellguard.parts.find(p => p.id === `${side}-pauldron`).rotationZ, sign * 18)
  assert(shellguard.joints.find(j => j.id === `${side}-shoulder`).rotationZ === 0, 'splaying armor must not turn the arm chain')
}
assert.deepEqual(retainedWalker, expectedWalker, 'V26 must not widen the walker again')
assert.equal(shellguardRoster.characters.length, 4, 'V26 must not repeat the one-time list cleanup')
const upgradedShellguard = structuredClone(shellguardRoster)
assert.equal(installEnemyShadowProjects(shellguardRoster), false)
assert.deepEqual(shellguardRoster, upgradedShellguard, 'shellguard stance must not accumulate on reload')
console.log(`Enemy completion: ${projects.length} fully textured rigs, ${parts} parts, ${frames} animation frames; folded faces and editor refresh passed.`)
