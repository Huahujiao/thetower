import assert from 'node:assert/strict'
/* global structuredClone */
import { existsSync } from 'node:fs'
import { createEnemyShadowProjects, installEnemyShadowProjects, ENEMY_ART_PACK_VERSION } from '../src/animation/shadow-enemies.js'
import { evaluateShadowProject, normalizeShadowProject } from '../src/animation/shadow-rig.js'
import { shadowPartFloor } from '../src/animation/shadow-grounding.js'
import { BATCH5_COMPONENT_ENEMY_IDS } from '../src/animation/shadow-enemy-components-batch5.js'
import componentAssets from '../src/animation/enemy-component-assets.json' with { type: 'json' }

const projects = createEnemyShadowProjects({ includeBoss: true })
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
    for (const [id, multiplier] of [['knee', 1], ['hock', 2], ['ankle', 3]]) {
      const depthDelta = position(`right-${id}`)[14] - position(`left-${id}`)[14]
      assert(Math.abs(depthDelta - .75 * multiplier) < .1,
        `gnawer legs: expected a slight ${id} depth offset, found ${depthDelta}`)
    }
  }
  if (p.enemyId === 'rootrot-bud') {
    const rest = evaluateShadowProject(p)
    const position = id => rest.jointsById.get(id).matrix.elements
    for (const suffix of ['root', 'root-tip', 'petal', 'petal-tip', 'thorn', 'leaf']) {
      const left = position(`left-${suffix}`), right = position(`right-${suffix}`)
      assert(Math.abs(left[12] + right[12]) < 1, `rootrot-bud/${suffix}: joints should mirror across X`)
      assert(Math.abs(left[13] - right[13]) < 1, `rootrot-bud/${suffix}: joint heights should match`)
      assert(Math.abs(left[14] - right[14]) < 1e-5, `rootrot-bud/${suffix}: joint depths should match`)
    }
    for (const suffix of ['petal-part', 'upper-petal-part']) {
      const left = p.parts.find(part => part.id === `left-${suffix}`)
      const right = p.parts.find(part => part.id === `right-${suffix}`)
      if (left && right) assert.equal(left.rotationX, right.rotationX, `rootrot-bud/${suffix}: paired tilt should match`)
    }
  }
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
custom.parts[0].fill = '#abcdef'
const roster = { enemyArtPackVersion: 16, activeCharacterId: 'custom', characters: [{ id: 'custom', project: custom }] }
assert(installEnemyShadowProjects(roster))
assert.equal(roster.enemyArtPackVersion, ENEMY_ART_PACK_VERSION)
assert.equal(roster.characters.length, 1 + BATCH5_COMPONENT_ENEMY_IDS.length)
assert.equal(roster.activeCharacterId, 'custom'); assert.equal(roster.characters[0].project.parts[0].fill, '#abcdef')
assert.equal(installEnemyShadowProjects(roster), false)

// Upgrade the current editor cache in place, preserving custom art and motion.
const saved = normalizeShadowProject(projects.find(p => p.enemyId === 'gnawer'))
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
const expectedParts = structuredClone(saved.parts)
for (const id of ['left-thigh', 'right-thigh']) expectedParts.find(p => p.id === id).height += 6
for (const [id, texture] of [['left-shin', '008'], ['left-foot', '008'], ['right-shin', '009'], ['right-foot', '009']]) {
  const part = expectedParts.find(p => p.id === id)
  const legacySize = componentAssets.gnawer.parts[12]
  const legSize = componentAssets.gnawer.parts[Number(texture)]
  part.width *= legSize.width / legacySize.width
  part.height *= legSize.height / legacySize.height
  part.visual.texture = part.visual.texture.replace('part_012.png', `part_${texture}.png`)
}
const expectedPartsJson = JSON.stringify(expectedParts), savedAnimations = JSON.stringify(saved.animations)
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
assert.equal(JSON.stringify(saved.parts), expectedPartsJson)
assert.equal(JSON.stringify(saved.animations), savedAnimations)
saved.joints.find(j => j.id === 'root').rotationY = 18
assert.equal(installEnemyShadowProjects(currentRoster), false)

const savedBud = structuredClone(projects.find(p => p.enemyId === 'rootrot-bud'))
savedBud.joints.find(j => j.id === 'left-root').z = -32
savedBud.joints.find(j => j.id === 'right-root').z = 32
savedBud.parts.find(p => p.id === 'left-petal-part').rotationX = -24
savedBud.parts.find(p => p.id === 'right-petal-part').rotationX = 24
const budRoster = { enemyArtPackVersion: 20, activeCharacterId: 'bud', characters: [{ id: 'bud', project: savedBud }] }
assert(installEnemyShadowProjects(budRoster))
assert.equal(savedBud.joints.find(j => j.id === 'left-root').z, savedBud.joints.find(j => j.id === 'right-root').z)
assert.equal(savedBud.parts.find(p => p.id === 'left-petal-part').rotationX, savedBud.parts.find(p => p.id === 'right-petal-part').rotationX)
assert.equal(saved.joints.find(j => j.id === 'root').rotationY, 18)
console.log(`Enemy completion: ${projects.length} fully textured rigs, ${parts} parts, ${frames} animation frames; folded faces and editor refresh passed.`)
