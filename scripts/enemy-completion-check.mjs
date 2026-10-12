import assert from 'node:assert/strict'
/* global structuredClone */
import { existsSync } from 'node:fs'
import { Vector3 } from 'three'
import { createEnemyShadowProjects, installEnemyShadowProjects, ENEMY_ART_PACK_VERSION } from '../src/animation/shadow-enemies.js'
import { createDefaultShadowProject, evaluateShadowProject, normalizeShadowProject, shadowTransformMatrix } from '../src/animation/shadow-rig.js'
import { shadowPartFloor } from '../src/animation/shadow-grounding.js'
import { BATCH5_COMPONENT_ENEMY_IDS } from '../src/animation/shadow-enemy-components-batch5.js'
import componentAssets from '../src/animation/enemy-component-assets.json' with { type: 'json' }
import { rebuildEnemyGrounding } from '../src/animation/enemy-grounding.js'
import { shadowTextureGeometry } from '../src/animation/shadow-texture-geometry.js'
import { TIDE_ARM_SOCKETS, tideSheetAnchor } from '../src/animation/shadow-tide-matriarch.js'

const projects = createEnemyShadowProjects({ includeBoss: true })
function restoreV36WalkerArms(project) {
  project.joints.find(j => j.id === 'right-arm-root').x += 10
  for (const id of ['left-shoulder', 'left-elbow', 'left-wrist', 'right-arm-root', 'right-arm-hinge', 'right-arm-tip']) project.joints.find(j => j.id === id).z *= 2
}
function assertMossJaw(pose) {
  const head = pose.parts.find(p => p.part.id === 'head-art')
  const jaw = pose.parts.find(p => p.part.id === 'jaw-art')
  const point = (entry, u, v) => {
    const { part, matrix } = entry, crop = part.visual.textureFrame.crop
    return new Vector3(((u - crop.left) / crop.width - part.pivotX) * part.width,
      (part.pivotY - (v - crop.top) / crop.height) * part.height, 0).applyMatrix4(matrix)
  }
  assert(Math.abs(point(head, .5, .74).distanceTo(point(jaw, .5, .5)) - .3) < 1e-6,
    'moss lower teeth should hinge at the small head mouth throughout animation')
}
function assertMossFeet(pose) {
  for (const [side, uv] of [['left', [.85, .87]], ['right', [.15, .82]]]) {
    const { part, matrix } = pose.parts.find(p => p.part.id === `${side}-foot`)
    const crop = part.visual.textureFrame.crop
    const paintedToe = new Vector3(((uv[0] - crop.left) / crop.width - part.pivotX) * part.width,
      (part.pivotY - (uv[1] - crop.top) / crop.height) * part.height, 0).applyMatrix4(matrix)
    assert(paintedToe.distanceTo(new Vector3().setFromMatrixPosition(pose.jointsById.get(`${side}-foot-toe`).matrix)) < 1e-6,
      'moss foot bone must end at its own painted toe, including during animation')
  }
}
function textureSocket(entry, u, v) {
  const { part, matrix } = entry, crop = part.visual.textureFrame.crop
  return new Vector3(((u - crop.left) / crop.width - part.pivotX) * part.width,
    (part.pivotY - (v - crop.top) / crop.height) * part.height, 0).applyMatrix4(matrix)
}
function assertTidalSporeConnections(pose) {
  for (const [i, baseUv, bottom, top, grip] of [
    [0, [.25, .10], [.63, .966], [.15, .04], [.935, .357]],
    [1, [.438, .065], [.50, .975], [.18, .045], [.85, .37]],
    [2, [.66, .13], [.52, .955], [.24, .05], [.818, .25]],
  ]) {
    const base = pose.parts.find(e => e.part.id === `base-${i}-art`)
    const stem = pose.parts.find(e => e.part.id === `stem-${i}-art`)
    const fruit = pose.parts.find(e => e.part.id === `pod-${i}-art`)
    const start = new Vector3().setFromMatrixPosition(pose.jointsById.get(`stem-${i}`).matrix)
    const end = new Vector3().setFromMatrixPosition(pose.jointsById.get(`pod-${i}`).matrix)
    assert(Math.abs(textureSocket(base, ...baseUv).distanceTo(start) - .9) < 1e-6
      && textureSocket(stem, ...bottom).distanceTo(start) < 1e-6,
    `tidal-spore-sac ${i}: stem must join its own painted base neck`)
    assert(Math.abs(textureSocket(stem, ...top).distanceTo(end) - .65) < 1e-6
      && textureSocket(fruit, ...grip).distanceTo(end) < 1e-6,
    `tidal-spore-sac ${i}: hanging fruit must remain connected to its own stalk`)
  }
}
function assertHunterSockets(pose) {
  assert(pose.parts.find(entry => entry.part.id === 'left-claw').matrix.determinant() < 0
    && pose.parts.find(entry => entry.part.id === 'right-arm-segment-2').matrix.determinant() > 0
    && pose.parts.find(entry => entry.part.id === 'left-forearm').matrix.determinant() > 0
    && pose.parts.find(entry => entry.part.id === 'right-arm-segment-1').matrix.determinant() > 0
    && pose.parts.find(entry => entry.part.id === 'scythe-art').matrix.determinant() > 0,
  'hunter character-right hand (screen-left) should be mirrored; the other hand, forearms and weapon keep their authored facing')
  for (const [partId, uv, jointId, overlap] of [
    ['left-upper-arm', [.20, .67], 'left-elbow', .3],
    ['left-upper-arm', [.34, .08], 'left-shoulder', 0],
    ['left-forearm', [.23, .055], 'left-elbow', 0],
    ['left-forearm', [.635, .415], 'left-wrist', 0],
    ['left-claw', [.68, .46], 'left-wrist', 0],
    ['left-claw', [.66, .625], 'left-palm-grip', 0],
    ['right-arm-upper', [.29, .055], 'right-arm', 0],
    ['right-arm-upper', [.37, .29], 'right-arm-hinge-1', .3],
    ['right-arm-segment-1', [.40, .345], 'right-arm-hinge-1', 0],
    ['right-arm-segment-1', [.74, .675], 'right-arm-hinge-2', 0],
    ['right-arm-segment-2', [.74, .675], 'right-arm-hinge-2', 0],
    ['right-arm-segment-2', [.66, .795], 'right-palm-grip', 0],
    ['left-cape-upper', [.5, .5], 'left-cape-hinge-1', 0],
    ['left-cape-segment-1', [.5, .5], 'left-cape-hinge-1', 0],
    ['right-cape-upper', [.5, .5], 'right-cape-hinge-1', 0],
    ['right-cape-segment-1', [.5, .5], 'right-cape-hinge-1', 0],
    ['left-shin-art', [.50, .88], 'left-ankle', 0],
    ['right-shin-art', [.43, .90], 'right-ankle', 0],
    ['left-foot-art', [20 / 131, 133 / 138], 'left-foot-toe', 0],
    ['right-foot-art', [112 / 142, 123 / 136], 'right-foot-toe', 0],
  ]) {
    const part = pose.parts.find(part => part.part.id === partId)
    const joint = new Vector3().setFromMatrixPosition(pose.jointsById.get(jointId).matrix)
    assert(Math.abs(textureSocket(part, ...uv).distanceTo(joint) - overlap) < 1e-6,
      `hunter ${partId}: skeleton node must follow its own painted socket`)
  }
}
function assertCrackedHunterSockets(pose) {
  const sockets = [
    ['chest', [.5, .035], 'head', 1.25], ['head-chin-art', [.34, .60], 'head', 0],
    ['head-art', [.53, .50], 'jaw', .25], ['jaw-art', [.90, .68], 'jaw', 0],
    ['chest', [.5, .86], 'spine', .8], ['spine-art', [.5, .08], 'spine', 0],
    ['spine-art', [.5, .88], 'pelvis', 2.5], ['pelvis-art', [.5, .10], 'pelvis', 0],
    ['right-arm-part-0', [.60, .10], 'right-arm', 0],
    ['right-arm-part-0', [.50, .38], 'right-arm-hinge-1', .3],
    ['right-arm-part-1', [.50, .38], 'right-arm-hinge-1', 0],
    ['right-arm-part-1', [.50, .73], 'right-arm-hinge-2', .3],
    ['right-arm-part-2', [.50, .73], 'right-arm-hinge-2', 0],
    ['right-arm-part-2', [.56, .78], 'hook', .35], ['hook-art', [.445, .47], 'hook', 0],
    ['right-pauldron', [.18, .16], 'spectral-pauldron', 3],
    ['missing-arm-part-0', [.37, .06], 'missing-arm', 0],
    ['missing-arm-part-0', [.67, .44], 'missing-arm-hinge-1', .3],
    ['missing-arm-part-1', [.67, .44], 'missing-arm-hinge-1', 0],
    ['missing-arm-part-1', [.48, .91], 'missing-arm-tip', .3],
  ]
  for (const [side, sign] of [['left', -1], ['right', 1]]) {
    sockets.push(
      ['pelvis-art', [sign < 0 ? .23 : .77, .25], `${side}-hip`, 1.3],
      [`${side}-thigh-art`, [sign < 0 ? .48 : .50, .09], `${side}-hip`, 0],
      [`${side}-thigh-art`, [sign < 0 ? .48 : .50, sign < 0 ? .61 : .72], `${side}-knee`, .3],
      [`${side}-shin-art`, [.52, .20], `${side}-knee`, 0],
      [`${side}-shin-art`, [sign < 0 ? .48 : .52, sign < 0 ? .87 : .88], `${side}-ankle`, 0],
      [`${side}-foot-art`, [sign < 0 ? .66 : .27, .15], `${side}-ankle`, 0],
      [`${side}-foot-art`, sign < 0 ? [1 / 171, 118 / 145] : [206 / 208, 114 / 140], `${side}-foot-toe`, 0],
    )
  }
  for (const [id, uv, jointId, depth] of sockets) {
    const entry = pose.parts.find(e => e.part.id === id)
    const joint = new Vector3().setFromMatrixPosition(pose.jointsById.get(jointId).matrix)
    assert(Math.abs(textureSocket(entry, ...uv).distanceTo(joint) - depth) < 1e-6,
      `cracked-hunter ${id}: joint must stay at the painted socket with only the intentional depth gap`)
  }
}
function assertCrowFaceFold(pose) {
  for (const side of ['left', 'right']) {
    const face = pose.parts.find(part => part.part.id === `${side}-face`)
    for (const [u, v, id] of [[.66, .22, 'nose-bridge-root'], [.97, .52, 'nose-bridge-tip']]) {
      const hinge = new Vector3().setFromMatrixPosition(pose.jointsById.get(id).matrix)
      assert(textureSocket(face, u, v).distanceTo(hinge) < 1e-6,
        'crow faces must meet along both ends of the diagonal nose bridge throughout animation')
    }
  }
}
function assertTideMatriarchConnections(pose) {
  for (const { id, upper, lower, shoulder, elbow, lowerSocket } of TIDE_ARM_SOCKETS) {
    const top = pose.parts.find(entry => entry.part.id === `${id}-upper`)
    const forearm = pose.parts.find(entry => entry.part.id === `${id}-forearm`)
    const start = new Vector3().setFromMatrixPosition(pose.jointsById.get(id).matrix)
    const hinge = new Vector3().setFromMatrixPosition(pose.jointsById.get(`${id}-elbow`).matrix)
    assert(textureSocket(top, ...tideSheetAnchor(upper, shoulder)).distanceTo(start) < 1e-6,
      `${id}: upper arm must stay connected to its shoulder`)
    assert(textureSocket(top, ...tideSheetAnchor(upper, elbow)).distanceTo(hinge) < 1e-6
      && textureSocket(forearm, ...tideSheetAnchor(lower, lowerSocket)).distanceTo(hinge) < 1e-6,
    `${id}: both painted elbow balls must share one hinge after normalization and animation`)
  }
  const orb = pose.parts.find(entry => entry.part.id === 'focus-orb')
  const core = new Vector3().setFromMatrixPosition(pose.jointsById.get('focus-core').matrix)
  assert(Math.abs(textureSocket(orb, ...tideSheetAnchor(16, [1265, 585])).distanceTo(core) - .5) < 1e-6,
    'matriarch glowing orb must remain centered in the floating instrument')
}
function assertMossConnections(pose) {
  const spine = pose.parts.find(p => p.part.id === 'spine')
  for (const [v, id] of [[.12, 'exposed-spine'], [.86, 'waist-spine-bottom']]) {
    assert(textureSocket(spine, .5, v).distanceTo(new Vector3().setFromMatrixPosition(pose.jointsById.get(id).matrix)) < 1e-6, 'moss waist spine must connect both painted sockets')
  }
  for (const side of ['left', 'right']) {
    const elbow = new Vector3().setFromMatrixPosition(pose.jointsById.get(`${side}-arm-wrist`).matrix)
    const forearm = new Vector3().setFromMatrixPosition(pose.jointsById.get(`${side}-secondary-shoulder`).matrix)
    assert(Math.abs(elbow.distanceTo(forearm) - .8) < 1e-6, 'moss forearms stay joined to upper arms')
  }
  for (const [side, anchors] of [
    ['left', [[.23, .10], [.56, .42], [.46, .78]]],
    ['right', [[.77, .10], [.48, .42], [.50, .78]]],
  ]) {
    for (const [i, segment] of ['upper', 'lower'].entries()) {
      const leg = pose.parts.find(p => p.part.id === `${side}-leg-${segment}`)
      for (const [offset, suffix] of (i ? ['hinge', 'tip'] : ['root', 'hinge']).entries()) {
        const node = new Vector3().setFromMatrixPosition(pose.jointsById.get(`${side}-leg-${suffix}`).matrix)
        assert(textureSocket(leg, ...anchors[i + offset]).distanceTo(node) < 1e-6,
          `moss ${side} ${segment} artwork must connect to its ${suffix} node after mirroring`)
      }
    }
  }
}
function assertSentryHold(pose) {
  const carryingFrame = pose.jointsById.get('crossbow-hold').matrix.clone().invert()
  for (const [side, u, palm] of [['left', .08, .25], ['right', .92, .61]]) {
    const bow = pose.parts.find(p => p.part.id === `${side}-bow-art`)
    const hand = pose.parts.find(p => p.part.id === `${side}-arm-end`)
    const grip = textureSocket(bow, u, .32).applyMatrix4(carryingFrame)
    const palmPoint = textureSocket(hand, palm, .85).applyMatrix4(carryingFrame)
    assert(palmPoint.distanceTo(grip.add(new Vector3(0, 4, 0))) < 1e-6,
      'sentry finger roots must rest above the actual bow crossbar instead of gripping with the wrists')
    const forearm = pose.parts.find(p => p.part.id === `${side}-arm-lower`)
    assert(textureSocket(forearm, palm, .70).distanceTo(textureSocket(hand, palm, .70)) < 1e-6,
      'sentry bent forearms must stay connected to their claws')
  }
}
function assertAshConnections(pose) {
  for (const [partId, u, v, jointId] of [['cannon-barrel', .15, .5, 'cannon'], ['cannon-barrel', .84, .5, 'cannon-muzzle'],
    ['cannon-muzzle-art', .5, .5, 'cannon-muzzle'], ['belly', .5, .16, 'ash-tail-root'], ['belly', .5, .96, 'ash-tail-tip']]) {
    assert(textureSocket(pose.parts.find(p => p.part.id === partId), u, v).distanceTo(new Vector3().setFromMatrixPosition(pose.jointsById.get(jointId).matrix)) < 1e-6,
      'ash cannon and tail artwork must follow their skeletal sockets')
  }
}
function restoreV23Pose(project) {
  if (project.enemyId === 'rootrot-bud') for (const [side, sign] of [['left', -1], ['right', 1]]) project.joints.find(j => j.id === `${side}-petal`).rotationZ += sign * 12
  if (project.enemyId === 'gnawer') for (const [side, sign] of [['left', -1], ['right', 1]]) {
    project.joints.find(joint => joint.id === `${side}-shoulder`).rotationZ -= sign * 24
    project.joints.find(joint => joint.id === `${side}-elbow`).rotationZ += sign * 58
  }
  if (project.enemyId === 'tide-shadow-cub') {
    project.joints.find(joint => joint.id === 'head').y += 10
    project.joints.find(joint => joint.id === 'head').z += 6
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
function assertBeetleHorn(pose) {
  const { part, matrix } = pose.parts.find(p => p.part.id === 'battering-horn-sheet')
  const apex = new Vector3((107.5 / 216 - part.pivotX) * part.width, part.pivotY * part.height, 0).applyMatrix4(matrix)
  const tip = new Vector3().setFromMatrixPosition(pose.jointsById.get('battering-horn-tip').matrix)
  assert(apex.distanceTo(tip) < 1e-5, 'beetle horn node must follow its painted apex throughout animation')
}
function assertHoundPose(project) {
  const pose = evaluateShadowProject(project, null, 0, { raw: true })
  const position = id => pose.jointsById.get(id).matrix.elements.slice(12, 15)
  const vector = (from, to) => position(to).map((value, i) => value - position(from)[i])
  const cosine = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0) / (Math.hypot(...a) * Math.hypot(...b))
  for (const side of ['left', 'right']) for (const end of ['front', 'hind']) {
    const prefix = `${side}-${end}`
    assert(cosine(vector(`${prefix}-hip`, `${prefix}-knee`), vector(`${prefix}-knee`, `${prefix}-paw`)) < .95,
      `patrol-hound: ${prefix} should visibly bend at the knee`)
  }
  assert(position('neck')[2] - position('haunch')[2] > 100, 'patrol-hound torso should be longer front to back')
  const backAxis = pose.parts.find(p => p.part.id === 'back').matrix.elements.slice(4, 7)
  assert(Math.abs(cosine(backAxis, vector('root', 'haunch'))) > .9999, 'patrol-hound spine art should follow the torso bone')
}
function assertSalamanderSpine(pose) {
  for (const [id, top, bottom] of [['back', 'neck', 'root'], ['back-mid', 'root', 'haunch'], ['back-tail', 'haunch', 'tail']]) {
    const { part, matrix } = pose.parts.find(p => p.part.id === id)
    for (const [target, y] of [[top, part.pivotY * part.height], [bottom, (part.pivotY - 1) * part.height]]) {
      const point = [0, 1, 2].map(i => matrix.elements[12 + i] + matrix.elements[4 + i] * y)
      const joint = pose.jointsById.get(target).matrix.elements.slice(12, 15)
      assert(Math.hypot(...point.map((value, i) => value - joint[i])) < 1e-5, `redneedle-salamander/${id}: spine should join ${target}`)
    }
  }
}
function assertSalamanderChest(pose) {
  for (const [chestId, backId] of [['chest', 'back'], ['chest-rear', 'back-mid']]) {
    const chest = pose.parts.find(p => p.part.id === chestId)
    const back = pose.parts.find(p => p.part.id === backId)
    assert.equal(chest.part.attachment.targetId, back.part.attachment.targetId, 'salamander shell must follow the same torso bones as the spine')
    assert.equal(chest.part.height, back.part.height)
    assert.equal(chest.part.pivotY, back.part.pivotY)
    for (let i = 0; i < 12; i++) assert(Math.abs(chest.matrix.elements[i] - back.matrix.elements[i]) < 1e-5, 'salamander shell and spine must share a surface direction')
    const gap = Math.hypot(...[12, 13, 14].map(i => chest.matrix.elements[i] - back.matrix.elements[i]))
    assert(gap > 20 && gap < 40, 'salamander back and belly should bound a torso volume without intersecting')
  }
}
function assertSalamanderConnections(pose) {
  const position = id => new Vector3().setFromMatrixPosition(pose.jointsById.get(id).matrix)
  const socket = (id, x, y) => {
    const { part, matrix } = pose.parts.find(p => p.part.id === id)
    return new Vector3((x - part.pivotX) * part.width, (part.pivotY - y) * part.height, 0).applyMatrix4(matrix)
  }
  const across = new Vector3(1, 0, 0).transformDirection(pose.jointsById.get('root').matrix)
  for (const id of ['chest', 'chest-rear', 'back', 'back-mid']) {
    const axis = new Vector3(1, 0, 0).transformDirection(pose.parts.find(p => p.part.id === id).matrix)
    assert(Math.abs(axis.dot(across)) > .9999, 'salamander torso must not roll from side to side')
  }
  for (const side of ['left', 'right']) {
    const flank = pose.parts.find(p => p.part.id === `chest-${side}-flank`)
    const shoulder = position(`${side}-front-hip`).applyMatrix4(flank.matrix.clone().invert())
    assert(Math.abs(shoulder.z) < .01, 'salamander front arm must meet the torso side surface')
    assert(shoulder.x >= -flank.part.width && shoulder.x <= flank.part.width && shoulder.y >= 0 && shoulder.y <= flank.part.height)
    assert(socket(`${side}-front-upper`, .36, .89).distanceTo(position(`${side}-front-knee`)) < .1, 'salamander upper arm socket should meet the elbow')
    assert(socket(`${side}-front-lower`, .45, .90).distanceTo(position(`${side}-front-paw`)) < .1, 'salamander forearm socket should meet the wrist')
    assert(socket(`${side}-front-foot`, .5, .075).distanceTo(position(`${side}-front-paw`)) < .4, 'salamander front claw should meet its arm')
  }
  for (let i = 0; i < 3; i++) {
    const joint = pose.jointsById.get(`needle-${i}`).joint
    const end = pose.jointsById.get(joint.z >= 0 ? 'neck' : 'haunch').joint
    const surface = position('root').lerp(position(end.id), joint.z / end.z)
    assert(position(joint.id).distanceTo(surface) < .4, 'salamander dorsal needle root should meet its back')
  }
}
function assertToadPose(project) {
  for (const raw of [true, false]) {
    const pose = evaluateShadowProject(project, null, 0, { raw })
    const back = pose.parts.find(p => p.part.id === 'back').matrix.elements
    assert(back[5] > 0 && back[6] > 0, 'toad back should be higher at the front and lower at the rump')
    for (const id of ['head-art', 'jaw-art']) {
      const normal = pose.parts.find(p => p.part.id === id).matrix.elements.slice(8, 11)
      assert(normal[1] > 0 && normal[2] > 0, 'toad face and mouth should both look slightly upward')
    }
  }
}
function assertBeetleWings(pose) {
  for (const [side, sign] of [['left', -1], ['right', 1]]) {
    const { part, matrix } = pose.parts.find(p => p.part.id === `${side}-gate-sheet`)
    const tip = pose.jointsById.get(`${side}-gate-tip`).matrix.elements
    const x = ((sign < 0 ? .1 : .9) - part.pivotX) * part.width
    const y = (part.pivotY - .92) * part.height
    const corner = [0, 1, 2].map(i => matrix.elements[i] * x + matrix.elements[4 + i] * y + matrix.elements[12 + i])
    assert(Math.hypot(...corner.map((v, i) => v - tip[12 + i])) < 1e-5, 'beetle wing joint should follow its visible outer rear corner')
  }
}
let frames = 0, parts = 0
for (const source of projects) {
  const p = normalizeShadowProject(source)
  assert.equal(p.joints.find(j => j.id === 'root').rotationY, 0, `${p.enemyId}: angled default facing`)
  const standaloneSheets = {
    'rot-walker': [['left-thigh', 8, .19, [.5, .07]]],
    'cracked-hunter': [['spine-art', 3, .18, [.5, .08]], ['right-pauldron', 7, .20, [.18, .16]]],
    'bomb-wisp': [['shell-art', 5, .34, [.5, .26]], ['roof-art', 2, .35, [.5, .58]]],
  }[p.enemyId] || []
  for (const model of [source, p]) for (const [id, number, scale, anchor] of standaloneSheets) {
    const part = model.parts.find(part => part.id === id), image = componentAssets[p.enemyId].parts[number]
    assert.deepEqual(part.visual.textureFrame.crop, { left: 0, top: 0, width: 1, height: 1 },
      `${p.enemyId}/${id}: a standalone sheet must retain its bottom edge in both the part list and model`)
    assert(Math.abs(part.width - image.width * scale) < 1e-6 && Math.abs(part.height - image.height * scale) < 1e-6,
      `${p.enemyId}/${id}: uncropping must expand the bounds, not compress the complete image`)
    assert.equal(part.pivotX, anchor[0]); assert.equal(part.pivotY, anchor[1])
    const geometry = shadowTextureGeometry(part, { image })
    const uv = geometry.attributes.uv
    for (const axis of ['getX', 'getY']) {
      const values = Array.from({ length: uv.count }, (_, i) => uv[axis](i))
      assert(Math.abs(Math.min(...values)) < 1e-6 && Math.abs(Math.max(...values) - 1) < 1e-6,
        `${p.enemyId}/${id}: three-dimensional texture geometry must sample the complete image`)
    }
    geometry.dispose()
  }
  if (p.enemyId === 'cracked-hunter') for (const model of [source, p]) {
    const rest = evaluateShadowProject(model)
    assertCrackedHunterSockets(rest)
    assert(rest.jointsById.get('right-arm').matrix.elements[12] < 0
      && rest.jointsById.get('missing-arm').matrix.elements[12] > 0,
    'cracked-hunter character-right gripping arm must be on screen-left, spectral arm on screen-right')
    assert.equal(model.bones.find(b => b.toJointId === 'spectral-pauldron').fromJointId, 'missing-arm')
    assert(rest.parts.find(e => e.part.id === 'hook-art').matrix.elements[14]
      < rest.parts.find(e => e.part.id === 'right-arm-part-2').matrix.elements[14],
    'cracked-hunter gripping fingers must be in front of the handle')
    for (const [a, b] of ['plate', 'hip', 'knee', 'ankle', 'foot-toe'].map(id => [`left-${id}`, `right-${id}`])) {
      assert(Math.abs(rest.jointsById.get(a).matrix.elements[14] - rest.jointsById.get(b).matrix.elements[14]) < 1e-6,
        `cracked-hunter ${a}/${b}: paired rest joints must share the same depth`)
    }
    for (const id of ['plate-art', 'thigh-art', 'shin-art', 'foot-art']) {
      assert.equal(rest.parts.find(e => e.part.id === `left-${id}`).matrix.elements[14], rest.parts.find(e => e.part.id === `right-${id}`).matrix.elements[14])
    }
    const depth = id => rest.parts.find(e => e.part.id === id).matrix.elements[14]
    assert(depth('spine-art') < depth('chest') && depth('spine-art') < depth('pelvis-art'),
      'spine ends should tuck behind the connected chest and pelvis armor')
    assert(depth('chest') < depth('head-art'))
    assert(depth('chest') < depth('pelvis-art'))
    assert(depth('missing-arm-part-0') < depth('right-plate-art'), 'character-left upper arm must sit behind its active armor plate')
    for (const side of ['left', 'right']) {
      assert(depth(`${side}-thigh-art`) < depth('pelvis-art') && depth(`${side}-shin-art`) < depth('pelvis-art'),
        'both connected legs must sit behind the pelvis armor')
    }
    const grip = textureSocket(rest.parts.find(e => e.part.id === 'hook-art'), .445, .47)
    const blade = textureSocket(rest.parts.find(e => e.part.id === 'hook-art'), .98, .215)
    assert(blade.x > grip.x && blade.y < grip.y, 'held weapon blade should point down and right from the palm')
    const headParts = model.parts.filter(part => part.visual.texture.endsWith('/part_002.png'))
    assert.equal(headParts.length, 3)
    const crops = headParts.map(part => part.visual.textureFrame.crop)
    assert(Math.abs(crops.reduce((area, c) => area + c.width * c.height, 0) - 1) < 1e-6,
      'articulating the detached mandible must retain every region of the complete head sheet')
    for (let i = 0; i < crops.length; i++) for (let j = i + 1; j < crops.length; j++) {
      const a = crops[i], b = crops[j]
      assert(Math.min(a.left + a.width, b.left + b.width) <= Math.max(a.left, b.left)
        || Math.min(a.top + a.height, b.top + b.height) <= Math.max(a.top, b.top), 'head regions must not duplicate the jaw artwork')
    }
  }
  if (p.enemyId === 'overseer') for (const model of [source, p]) {
    const rest = evaluateShadowProject(model)
    const part = id => rest.parts.find(e => e.part.id === id)
    const depth = id => part(id).matrix.elements[14]
    assert.equal(model.bones.find(b => b.toJointId === 'spine-root').fromJointId, 'upper-body')
    assert.equal(model.bones.find(b => b.toJointId === 'pelvis').fromJointId, 'spine-root')
    const spineTop = textureSocket(part('spine'), .5, .07)
    const spineBottom = textureSocket(part('spine'), .5, .90)
    assert(spineTop.y > spineBottom.y && spineTop.y - spineBottom.y > 90,
      'overseer vertebrae must provide their own connected height above the waist')
    assert(Math.abs(textureSocket(part('chest'), .5, .70).distanceTo(spineTop) - .5) < 1e-6)
    assert(Math.abs(spineBottom.distanceTo(textureSocket(part('pelvis-art'), .5, .13)) - 1.1) < 1e-6)
    const bodyDepths = ['chest', 'collar', 'head-art', 'jaw-art'].map(depth)
    assert(Math.max(...bodyDepths) - Math.min(...bodyDepths) < 1.5 && depth('jaw-art') > depth('collar'),
      'overseer face and collar must stay close to the torso depth, with the jaw in front')
    assert.equal(model.bones.find(b => b.toJointId === 'banner').fromJointId, 'pelvis')
    assert(depth('banner-art') > depth('pelvis-art') && part('banner-art').matrix.elements[13] < part('pelvis-art').matrix.elements[13],
      'overseer former back banner must hang from the front of the waist')
    const waistSocket = textureSocket(part('pelvis-art'), .5, .53)
    const clothSocket = textureSocket(part('banner-art'), .5, .05)
    assert(Math.abs(waistSocket.distanceTo(clothSocket) - 3) < 1e-6,
      'overseer loincloth must meet its waist socket with only the intended depth gap')
    for (const id of ['pauldron', 'upper-arm', 'forearm', 'fist', 'leg-upper', 'leg-lower', 'leg-foot']) {
      assert(Math.abs(depth(`left-${id}`) - depth(`right-${id}`)) < 1e-6,
        `overseer ${id}: paired artwork must share its rest depth`)
    }
    for (const side of ['left', 'right']) {
      assert(depth(`${side}-leg-upper`) < depth('pelvis-art'), 'overseer thighs must sit behind the waist armor')
      for (const [id, jointId] of [['forearm', 'elbow'], ['fist', 'wrist'], ['leg-lower', 'leg-knee'], ['leg-foot', 'leg-paw']]) {
        assert(Math.abs(textureSocket(part(`${side}-${id}`), .5, id === 'leg-foot' ? .12 : .08)
          .distanceTo(new Vector3().setFromMatrixPosition(rest.jointsById.get(`${side}-${jointId}`).matrix))) < 1e-6,
        `overseer ${side}-${id}: artwork must follow the depth of its skeleton node`)
      }
    }
  }
  if (p.enemyId === 'tidal-spore-sac') for (const model of [source, p]) {
    assert.equal(model.parts.length, 9, 'tidal-spore-sac should have exactly three bases, three stalks and three fruits')
    for (const kind of ['base', 'stem', 'pod']) assert.equal(model.parts.filter(part => new RegExp(`^${kind}-[0-2]-art$`).test(part.id)).length, 3)
    assert.equal(model.grounding.supports.length, 3, 'all three spore bases should have planted contacts')
    const rest = evaluateShadowProject(model)
    assertTidalSporeConnections(rest)
    const depths = rest.parts.map(e => e.matrix.elements[14])
    for (let i = 0; i < depths.length; i++) for (let k = i + 1; k < depths.length; k++) {
      assert(Math.abs(depths[i] - depths[k]) >= .6, 'spore texture planes should have distinct rest depths with enough clearance')
    }
    assert(Math.max(...depths) - Math.min(...depths) < 6.5, 'spore depth staggering must preserve connected front and oblique silhouettes')
    for (let i = 0; i < 3; i++) {
      assert.equal(model.bones.find(b => b.toJointId === `stem-${i}`).fromJointId, `base-${i}`)
      assert.equal(model.bones.find(b => b.toJointId === `pod-${i}`).fromJointId, `stem-${i}`)
      assert(model.grounding.supports.some(s => s.partId === `base-${i}-art`))
      if (i) {
        const current = textureSocket(rest.parts.find(e => e.part.id === `pod-${i}-art`), .5, .45)
        const previous = textureSocket(rest.parts.find(e => e.part.id === `pod-${i - 1}-art`), .5, .45)
        assert(current.x - previous.x > 50, 'spore fruits should remain visibly separated in the front pose')
      }
    }
  }
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
  if (p.enemyId === 'drown-shadow-hunter') for (const model of [p, normalizeShadowProject(p)]) {
    const rest = evaluateShadowProject(model)
    assertHunterSockets(rest)
    const position = id => rest.jointsById.get(id).matrix.elements
    const leftHand = position('left-wrist'), rightHand = position('right-arm-hinge-2')
    assert(Math.abs(leftHand[14] - rightHand[14]) < 1e-6 && leftHand[14] > position('root')[14],
      'hunter hands must share the depth in front of the chest')
    assert(leftHand[12] < 0 && rightHand[12] > 0,
      'hunter wrists should sit on opposite sides')
    const leftGrip = position('left-palm-grip'), rightGrip = position('right-palm-grip')
    assert(Math.abs(leftGrip[13] - rightGrip[13]) < 1e-6 && Math.abs(leftGrip[14] - rightGrip[14]) < 1e-6,
      'hunter painted palms, rather than unequal hand wrist pivots, should share a horizontal grip')
    for (const [shoulderId, elbowId, wristId] of [
      ['left-shoulder', 'left-elbow', 'left-wrist'], ['right-arm', 'right-arm-hinge-1', 'right-arm-hinge-2'],
    ]) {
      const shoulder = position(shoulderId), elbow = position(elbowId), wrist = position(wristId)
      assert(Math.abs(shoulder[14] - position('root')[14]) < 1 && Math.abs(elbow[14] - shoulder[14]) < .5,
        'hunter upper arms should stay close to the shoulder and torso plane')
      assert(Math.abs(elbow[12] - shoulder[12]) < 4 && wrist[14] - elbow[14] > 15,
        'hunter forearms should bend forward instead of spreading both upper arms sideways')
    }
    assert(Math.abs(position('neck')[14] - position('root')[14]) < 1
      && Math.abs(position('head')[14] - position('neck')[14]) < 1e-6,
    'hunter head and neck should stay in the torso depth plane')
    const head = rest.parts.find(entry => entry.part.id === 'head-art')
    const neck = rest.parts.find(entry => entry.part.id === 'neck-art')
    const chest = rest.parts.find(entry => entry.part.id === 'rib-cage')
    assert(textureSocket(neck, .70, .965).distanceTo(textureSocket(chest, .5, .12)) < 1,
      'hunter painted neck base should meet the collar without a large gap or overlap')
    assert(Math.abs(textureSocket(neck, .70, .965).x - position('root')[12]) < 1e-6
      && Math.abs(position('neck')[12] - position('root')[12]) < 1e-6
      && position('head')[12] < position('neck')[12] - 8,
    'hunter should centre the painted neck socket while retaining the skull offset')
    for (const [id, u] of [['left-shoulder', .072], ['right-arm', .928]]) {
      assert(textureSocket(chest, u, .072).distanceTo(new Vector3().setFromMatrixPosition(rest.jointsById.get(id).matrix)) < 1,
        'hunter upper-arm cap should meet its painted chest shoulder socket')
    }
    assert(textureSocket(head, .5, .5).distanceTo(textureSocket(neck, .5, .5)) < 1e-6,
      'hunter head and neck crops should meet at one seam without duplicate artwork or a gap')
    assert(head.part.visual.textureFrame.crop.top + head.part.visual.textureFrame.crop.height
      === neck.part.visual.textureFrame.crop.top, 'hunter head and neck must not repeat the same cropped strip')
    assert(Math.abs(position('left-ankle')[14] - position('right-ankle')[14]) < 1e-6
      && position('left-ankle')[14] > position('pelvis')[14], 'hunter feet must share the front depth')
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      const ankle = position(`${side}-ankle`)
      for (const id of [`${side}-foot-toe`, `${side}-foot-art-ground-contact`]) {
        assert((position(id)[12] - ankle[12]) * sign > 10,
          'hunter toe and ground helper must point outward on their own side')
      }
    }
    const weapon = rest.parts.find(entry => entry.part.id === 'scythe-art')
    const top = textureSocket(weapon, .41, 0), bottom = textureSocket(weapon, .41, 1)
    assert(Math.abs(top.y - bottom.y) < 1e-6 && Math.abs(top.x - bottom.x) > 150,
      'hunter hook weapon should lie horizontally across the waist')
    for (const [id, uv] of [['left-claw', [.66, .625]], ['right-arm-segment-2', [.66, .795]]]) {
      const palm = textureSocket(rest.parts.find(entry => entry.part.id === id), ...uv)
      assert(palm.x > Math.min(top.x, bottom.x) && palm.x < Math.max(top.x, bottom.x)
        && Math.abs(palm.y - top.y) < 1e-6 && palm.z > top.z && palm.z - top.z < 1,
      'hunter weapon shaft must pass beneath both painted palms')
    }
    assert(model.bones.find(bone => bone.toJointId === 'scythe').fromJointId === 'right-palm-grip',
      'hunter weapon must attach to its painted palm grip instead of the wrist')
    assert(Math.abs(position('scythe')[13] + 66) < 1e-6,
      'hunter weapon should sit lower in the palms')
    assert(position('left-cape-hinge-1')[12] < -30 && position('right-cape-hinge-1')[12] > 30,
      'hunter cape tails must spread toward separate sides instead of overlapping at the center')
    for (const [side, u] of [['left', .86], ['right', .36]]) {
      const cape = rest.parts.find(entry => entry.part.id === `${side}-cape-segment-1`)
      const tip = textureSocket(cape, u, .96), shoulder = position(`${side}-cape`)
      assert(Math.abs(tip.z + 15.7) < 1e-6 && Math.abs(shoulder[14]) < 1 && tip.z < shoulder[14] - 10,
        'hunter cape roots should meet the shoulders while preserving the existing rear tail depth')
    }
  }
  if (['gnawer', 'rootrot-bud', 'beetle-guard', 'shellguard', 'ash-cannon-bug', 'furnace-beetle'].includes(p.enemyId)) assertFrontalSkeleton(p)
  if (['nest-spider', 'beetle-guard'].includes(p.enemyId)) {
    const last = p.enemyId === 'nest-spider' ? 3 : 2
    for (const raw of [true, false]) {
      const pose = evaluateShadowProject(p, null, 0, { raw })
      for (const side of ['left', 'right']) for (const [index, direction] of [[0, 1], [last, -1]]) {
        const socket = pose.jointsById.get(`${side}-leg-${index}-coxa`).matrix.elements
        const foot = pose.jointsById.get(`${side}-leg-${index}-tip`).matrix.elements
        assert((foot[14] - socket[14]) * direction > 10, `${p.enemyId}: end legs should lean toward the front and rear`)
      }
    }
  }
  if (p.enemyId === 'patrol-hound') assertHoundPose(p)
  if (p.enemyId === 'beetle-guard') {
    const rest = evaluateShadowProject(p, null, 0, { raw: true })
    assertBeetleWings(rest)
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      const hinge = rest.jointsById.get(`${side}-gate-hinge`).matrix.elements
      const tip = rest.jointsById.get(`${side}-gate-tip`).matrix.elements
      assert((tip[12] - hinge[12]) * sign > 50, 'beetle wings should spread visibly outboard')
      assert(tip[13] > hinge[13], 'beetle outer tips should rise slightly')
      assert(tip[14] < hinge[14], 'beetle outer tips should point toward the tail')
    }
  }
  if (p.enemyId === 'redneedle-salamander') {
    assertSalamanderSpine(evaluateShadowProject(p, null, 0, { raw: true }))
    assertSalamanderChest(evaluateShadowProject(p, null, 0, { raw: true }))
    assertSalamanderConnections(evaluateShadowProject(p, null, 0, { raw: true }))
    assert(evaluateShadowProject(p, null, 0, { raw: true }).parts.find(part => part.part.id === 'head-art').matrix.elements[9] > 0, 'salamander face should look slightly upward')
  }
  if (p.enemyId === 'rot-walker') {
    const rest = evaluateShadowProject(p, null, 0, { raw: true })
    const depth = id => rest.jointsById.get(id).matrix.elements[14]
    assert(depth('rot-stilt-root') > depth('pelvis'), 'walker character-left leg should be in front')
    assert.equal(depth('rot-stilt-root'), depth('left-hip'), 'walker legs should have the same root depth')
    assert(rest.jointsById.get('rot-stilt-root').matrix.elements[12] - rest.jointsById.get('pelvis').matrix.elements[12] >= 33,
      'walker character-left stilt leg should stand farther outward')
  }
  if (p.enemyId === 'moss-colossus') {
    const used = new Set(p.parts.map(part => Number(/part_(\d+)\.png$/.exec(part.visual.texture)?.[1])))
    assert.equal(used.size, 23, 'moss colossus should use all 23 anatomy assets')
    assert(p.parts.find(part => part.id === 'torso').visual.texture.endsWith('/part_001.png'), 'moss chest face must be the main torso')
    const mossRest = evaluateShadowProject(p, null, 0, { raw: true })
    assert(Math.abs(mossRest.jointsById.get('neck').matrix.elements[12] - textureSocket(mossRest.parts.find(p => p.part.id === 'torso'), .52, .07).x) < 1e-6,
      'moss neck should line up with the painted neck socket')
    assert(mossRest.jointsById.get('exposed-spine').matrix.elements[14] < mossRest.parts.find(p => p.part.id === 'torso').matrix.elements[14], 'moss spine should sit behind the chest')
    for (const id of ['right-arm-shoulder']) assert.equal(p.joints.find(j => j.id === id).scaleX, -1,
      'saved moss right arms should retain their full mirrored width')
    assert.equal(p.joints.find(j => j.id === 'right-secondary-shoulder').scaleX, 1, 'forearm inherits the upper-arm mirror')
    for (const side of ['left', 'right']) {
      const rest = evaluateShadowProject(p, null, 0, { raw: true })
      const primary = rest.jointsById.get(`${side}-arm-wrist`).matrix.elements
      const secondary = rest.jointsById.get(`${side}-secondary-wrist`).matrix.elements
      assert(primary[13] - secondary[13] > 35, 'moss forearms and hands should extend down from the upper-arm elbows')
      const small = p.parts.find(part => part.id === `${side}-arm-hand`)
      const large = p.parts.find(part => part.id === `${side}-secondary-hand`)
      assert(large.width * large.height > small.width * small.height, 'the full hand should remain larger than the upper-arm stump')
      const sign = side === 'left' ? 1 : -1
      assert.equal(p.parts.find(part => part.id === `${side}-pauldron`).rotationZ, 0)
      assert(p.parts.find(part => part.id === `${side}-pauldron`).visual.texture.endsWith(side === 'left' ? '/part_013.png' : '/part_012.png'), 'moss pauldrons should use the exchanged cutouts')
      assert.equal(p.bones.find(b => b.toJointId === `${side}-secondary-shoulder`).fromJointId, `${side}-arm-wrist`, 'moss forearm must join its upper arm, not form an independent limb')
      const plate = rest.jointsById.get(`${side}-stone-plate`).matrix.elements
      assert(plate[14] > secondary[14] && secondary[14] > rest.jointsById.get('root').matrix.elements[14], 'moss armor and arms need shallow distinct depth layers')
      const ankle = rest.jointsById.get(`${side}-leg-tip`).matrix.elements
      const toe = rest.jointsById.get(`${side}-foot-toe`).matrix.elements
      assert(sign * (toe[12] - ankle[12]) > 10, 'moss feet must point toward their own outer toe rather than the same side')
      const hip = rest.jointsById.get(`${side}-leg-root`).matrix.elements
      const knee = rest.jointsById.get(`${side}-leg-hinge`).matrix.elements
      assert(sign * hip[12] > 0 && sign * (knee[12] - hip[12]) > 0 && sign * (ankle[12] - knee[12]) > 0, 'moss knees and ankles should spread outward without X-shaped legs')
      assert(p.parts.find(part => part.id === `${side}-leg-upper`).visual.texture.endsWith(side === 'left' ? '/part_015.png' : '/part_014.png'), 'moss legs should use the exchanged cutouts')
    }
    for (const [id, animation] of Object.entries(p.animations)) for (let i = 0; i <= 10; i++) {
      const pose = evaluateShadowProject(normalizeShadowProject(p), id, animation.duration * i / 10)
      assertMossJaw(pose)
      assertMossFeet(pose)
      assertMossConnections(pose)
    }
  }
  if (p.enemyId === 'water-leech-swarm') {
    assert(p.grounding.floating, 'swimming leech members must retain their individual heights instead of being independently pushed onto the floor')
    const members = p.joints.filter(j => /^leech-\d+$/.test(j.id))
    assert(members.length >= 6, 'water leech swarm should contain multiple complete worms rather than three superimposed cutouts')
    const rest = evaluateShadowProject(p, null, 0, { raw: true })
    const positions = []
    for (const member of members) {
      const axis = rest.jointsById.get(member.id).matrix
      assert(new Vector3(-1, 0, 0).transformDirection(axis).x < -.9, 'water leech members must face negative X with only small individual angles')
      positions.push(new Vector3().setFromMatrixPosition(axis))
      for (const suffix of ['head-art', 'body-upper', 'body-segment-1', 'tail-art', 'fin-art', 'belly-art']) {
        assert(p.parts.some(part => part.id === `${member.id}-${suffix}`), 'each water leech must have its own complete anatomy')
      }
    }
    for (let i = 0; i < positions.length; i++) for (let k = i + 1; k < positions.length; k++) {
      assert(Math.hypot(positions[i].x - positions[k].x, positions[i].y - positions[k].y) > 50, 'water leech members must remain spread out in the frontal view')
    }
    assert.equal(new Set(p.parts.map(part => part.visual.texture)).size, 16, 'water leech swarm should use the fin, belly and wake cutouts as well as the heads and bodies')
  }
  if (p.enemyId === 'whirlpool-eye-sac') {
    assert(p.grounding.floating, 'vortex sac should float without floor constraints collapsing its radial layout')
    const rest = evaluateShadowProject(p, null, 0)
    for (const id of ['vortex-sac', 'eye-ring-art', 'eye-art', 'veil-art', 'pendant-art']) {
      assert(Math.abs(rest.parts.find(e => e.part.id === id).matrix.elements[12]) < 1e-6,
        'vortex sac main body and central ornaments must stay centered independently of its side tethers')
    }
    assert.equal(new Set(p.parts.map(part => part.visual.texture)).size, 13,
      'vortex sac should expose the original crest, crescent, pendant and all four fins, excluding the tiny slicer scrap')
    const body = rest.parts.find(e => e.part.id === 'vortex-sac')
    const eye = rest.parts.find(e => e.part.id === 'eye-art')
    assert(eye.matrix.elements[13] > body.matrix.elements[13] + body.part.height / 2,
      'eye crown should rise above the sac instead of hiding the vortex behind stacked circles')
    for (const id of ['right-fin-upper', 'left-fin-upper', 'right-lower-fin-upper', 'left-lower-fin-upper']) {
      const fin = rest.parts.find(e => e.part.id === id)
      assert(Math.abs(fin.matrix.elements[12]) > body.part.width * .38,
        'four fins should spread to the sides rather than disappear behind the central sac')
    }
    for (const [action, animation] of Object.entries(p.animations)) for (let i = 0; i <= 4; i++) {
      const pose = evaluateShadowProject(p, action, animation.duration * i / 4)
      const rootInverse = pose.jointsById.get('root').matrix.clone().invert()
      for (const suffix of ['', '-hinge-1', '-hinge-2']) {
        const left = new Vector3().setFromMatrixPosition(pose.jointsById.get(`left-tether${suffix}`).matrix).applyMatrix4(rootInverse)
        const right = new Vector3().setFromMatrixPosition(pose.jointsById.get(`right-tether${suffix}`).matrix).applyMatrix4(rootInverse)
        assert(Math.abs(left.x + right.x) < 1e-6 && Math.abs(left.y - right.y) < 1e-6 && Math.abs(left.z - right.z) < 1e-6,
          'paired vortex tethers and their bone hinges must mirror in XY and share depth throughout animation')
      }
      for (const suffix of ['upper', 'segment-1', 'segment-2']) {
        const left = textureSocket(pose.parts.find(e => e.part.id === `left-tether-${suffix}`), .5, .5).applyMatrix4(rootInverse)
        const right = textureSocket(pose.parts.find(e => e.part.id === `right-tether-${suffix}`), .5, .5).applyMatrix4(rootInverse)
        assert(Math.abs(left.x + right.x) < 1e-6 && Math.abs(left.y - right.y) < 1e-6 && Math.abs(left.z - right.z) < 1e-6,
          'tether textures must follow their mirrored skeletons rather than share the same facing')
      }
    }
  }
  if (p.enemyId === 'cinder-curse-lamp-swarm') {
    assert(p.grounding.floating, 'curse lanterns must float without floor constraints stretching their hanging streamers')
    const rest = evaluateShadowProject(p, null, 0)
    for (const [i, n, scale] of [[0, 1, .28], [1, 3, .36], [2, 4, .34]]) {
      const pieces = rest.parts.filter(e => e.part.id.startsWith(`lamp-${i}-`))
      const lampInverse = rest.jointsById.get(`lamp-${i}`).matrix.clone().invert()
      const source = componentAssets[p.enemyId].parts[n]
      const crops = pieces.map(e => e.part.visual.textureFrame.crop)
      assert.equal(pieces.length, 12, 'each complete lantern should retain its roof, cage, banners, bell chains and trailing flames as articulated regions')
      assert(Math.abs(crops.reduce((area, crop) => area + crop.width * crop.height, 0) - 1) < 1e-8,
        'lantern crops must retain the entire assembled reference rather than omit its bells or long banners')
      for (let a = 0; a < crops.length; a++) for (let b = a + 1; b < crops.length; b++) {
        const xOverlap = Math.min(crops[a].left + crops[a].width, crops[b].left + crops[b].width) - Math.max(crops[a].left, crops[b].left)
        const yOverlap = Math.min(crops[a].top + crops[a].height, crops[b].top + crops[b].height) - Math.max(crops[a].top, crops[b].top)
        assert(xOverlap <= 1e-8 || yOverlap <= 1e-8, 'lantern artwork must not duplicate opaque regions that hide each other')
      }
      for (const entry of pieces) {
        assert(entry.part.visual.texture.endsWith(`/part_${String(n).padStart(3, '0')}.png`),
          'the swarm should use the original main lantern and two distinct complete variants')
        const crop = entry.part.visual.textureFrame.crop
        for (const [u, v] of [[crop.left, crop.top], [crop.left + crop.width, crop.top + crop.height]]) {
          const point = textureSocket(entry, u, v).applyMatrix4(lampInverse)
          assert(Math.abs(point.x - (u - .5) * source.width * scale) < 1e-6 && Math.abs(point.y - (.35 - v) * source.height * scale) < 1e-6,
            'lantern skeleton anchors must reconstruct the original assembled silhouette without moving cut regions apart')
          assert(Math.abs(point.z) <= 1.3, 'lantern regions should use shallow depth separation')
        }
      }
    }
  }
  if (p.enemyId === 'thorn-shell-flower') {
    const rest = evaluateShadowProject(p, null, 0, { raw: true })
    const lower = rest.parts.find(e => e.part.id === 'lower-stem-art')
    const upper = rest.parts.find(e => e.part.id === 'upper-stem-art')
    const eye = rest.parts.find(e => e.part.id === 'eye-art')
    const lowerSocket = textureSocket(lower, .59, .51)
    const upperSocket = textureSocket(upper, .5, .48)
    const lowerTop = lowerSocket.y
    const upperBottom = upperSocket.y
    const lowerOverlap = lowerTop - (eye.matrix.elements[13] - eye.part.height / 2)
    const upperOverlap = eye.matrix.elements[13] + eye.part.height / 2 - upperBottom
    assert(lowerOverlap > 0 && lowerOverlap < 4 && upperOverlap > 0 && upperOverlap < 4,
      'flower stem rims must lightly grip the eye without gaps or burying it')
    assert(Math.abs(lowerSocket.x - eye.matrix.elements[12]) < 1e-6 && Math.abs(upperSocket.x - eye.matrix.elements[12]) < 1e-6,
      'flower painted stem sockets must align with the eye from both front and back')
    assert.equal(p.bones.find(b => b.toJointId === 'eye').fromJointId, 'stem-eye-core', 'flower eye must leave the mouth in the crown exposed')
    assert.equal(p.bones.find(b => b.toJointId === 'upper-stem').fromJointId, 'stem-eye-core', 'raised flower crown should follow the inserted stem socket')
  }
  if (p.enemyId === 'sentry-crossbow') {
    const rest = evaluateShadowProject(p, null, 0, { raw: true })
    assert.equal(p.joints.find(j => j.id === 'weapon').rotationX, 100, 'bow should be horizontal with a ten-degree downward pitch')
    for (const side of ['left', 'right']) {
      assert(rest.jointsById.get(`${side}-arm-tip`).matrix.elements[14] > rest.jointsById.get(`${side}-arm-root`).matrix.elements[14] + 50, 'sentry arms must extend forward')
      const shoulder = new Vector3().setFromMatrixPosition(rest.jointsById.get(`${side}-arm-root`).matrix)
      const elbow = new Vector3().setFromMatrixPosition(rest.jointsById.get(`${side}-arm-hinge`).matrix)
      const wrist = new Vector3().setFromMatrixPosition(rest.jointsById.get(`${side}-arm-tip`).matrix)
      assert(elbow.y < shoulder.y - 12, 'sentry upper arms should slope downward from the shoulders')
      assert(Math.abs(elbow.y - wrist.y) < 1e-6, 'sentry forearms should lie level instead of rising toward the bow')
      assert(elbow.clone().sub(shoulder).normalize().dot(wrist.clone().sub(elbow).normalize()) < .85, 'sentry arms should have a visible elbow bend')
    }
    const tailRoot = rest.jointsById.get('rear-tripod').matrix.elements
    const tailTip = rest.jointsById.get('sentry-tail-tip').matrix.elements
    assert(tailTip[14] < tailRoot[14] - 40 && tailTip[13] < tailRoot[13], 'sentry tail should extend diagonally backward and downward')
    assert(!p.grounding.supports.some(s => s.partId === 'rear-tripod-art'), 'sentry tail must not be planted like a third foot')
    for (const suffix of ['root', 'hinge']) for (const [index, sign] of [[12, -1], [13, 1], [14, 1]]) {
      assert(Math.abs(rest.jointsById.get(`left-tripod-${suffix}`).matrix.elements[index] - sign * rest.jointsById.get(`right-tripod-${suffix}`).matrix.elements[index]) < 1e-6, 'sentry foot joints should be symmetric')
    }
    for (const [id, animation] of Object.entries(p.animations)) for (let i = 0; i <= 10; i++) assertSentryHold(evaluateShadowProject(normalizeShadowProject(p), id, animation.duration * i / 10))
  }
  if (p.enemyId === 'ash-cannon-bug') {
    const rest = evaluateShadowProject(p, null, 0, { raw: true })
    for (const side of ['left', 'right']) {
      assert.equal(p.joints.find(j => j.id === `${side}-leg-0-root`).rotationX, -25)
      assert.equal(p.joints.find(j => j.id === `${side}-leg-2-root`).rotationX, 25)
    }
    assert(rest.jointsById.get('ash-tail-tip').matrix.elements[14] < rest.jointsById.get('ash-tail-root').matrix.elements[14] - 50, 'ash tail should extend behind the abdomen')
    const cannon = p.joints.find(j => j.id === 'cannon'), muzzle = p.joints.find(j => j.id === 'cannon-muzzle')
    assert.deepEqual([cannon.x, cannon.y, cannon.z], [-17, 30, -3], 'cannon base must remain fixed')
    const barrel = p.parts.find(part => part.id === 'cannon-barrel'), matrix = shadowTransformMatrix(cannon)
    const original = new Vector3((.84 - .15) * barrel.width / .83, 0, 0).applyMatrix4(matrix)
    const current = new Vector3(muzzle.x, muzzle.y, muzzle.z).applyMatrix4(matrix)
    assert(Math.abs(original.x - current.x) < 1e-6 && Math.abs(original.y - current.y) < 1e-6 && Math.abs(original.z - current.z - 16) < 1e-6, 'only the muzzle moves backward')
    for (const [id, animation] of Object.entries(p.animations)) for (let i = 0; i <= 10; i++) assertAshConnections(evaluateShadowProject(normalizeShadowProject(p), id, animation.duration * i / 10))
  }
  if (p.enemyId === 'revenant-guard') {
    for (const n of [18, 21, 22, 23]) assert(p.parts.some(part => part.visual.texture.endsWith(`/part_${String(n).padStart(3, '0')}.png`)),
      'revenant should retain all four claw-arm assets')
  }
  if (p.enemyId === 'tide-rite-matriarch') {
    const rest = evaluateShadowProject(p, null, 0)
    assert(p.grounding.floating && !p.joints.some(joint => /sole|leg|foot/.test(joint.id)),
      'matriarch should remain a floating robed creature without invented legs')
    assert.equal(p.parts.length, 18)
    for (let n = 1; n <= 18; n++) assert(p.parts.some(part => part.visual.texture.endsWith(`/part_${String(n).padStart(3, '0')}.png`)),
      'matriarch should use every new user-sliced cutout, including both instrument pendants and the orb')
    assert(!p.joints.some(joint => /staff|jaw|spine/.test(joint.id)), 'new matriarch must not retain old staff or invented anatomy')
    for (const side of ['left', 'right']) {
      const main = p.joints.find(j => j.id === `${side}-arm`)
      const secondary = p.joints.find(j => j.id === `${side}-prayer`)
      const veil = p.joints.find(j => j.id === `${side}-veil`)
      assert(main.y - secondary.y > 50, 'matriarch upper and lower arm pairs should remain visibly separated')
      for (const id of [`${side}-arm`, `${side}-prayer`]) {
        const rootFrame = rest.jointsById.get('root').matrix.clone().invert()
        const shoulder = new Vector3().setFromMatrixPosition(rest.jointsById.get(id).matrix).applyMatrix4(rootFrame)
        const elbow = new Vector3().setFromMatrixPosition(rest.jointsById.get(`${id}-elbow`).matrix).applyMatrix4(rootFrame)
        assert(elbow.z > shoulder.z + 3, 'all four matriarch arms should lean forward')
        assert(Math.abs(elbow.x) > Math.abs(shoulder.x) + 20, 'all four matriarch arms should spread outside the torso')
      }
      assert.equal(p.bones.find(bone => bone.toJointId === veil.id).fromJointId, 'skirt',
        'matriarch side robes must hang from the waist instead of the shoulders')
    }
    const prepare = evaluateShadowProject(p, 'attack', p.animations.attack.duration * .27)
    const release = evaluateShadowProject(p, 'attack', p.animations.attack.duration * .64)
    assert(release.parts.find(entry => entry.part.id === 'focus-orb').opacity > prepare.parts.find(entry => entry.part.id === 'focus-orb').opacity,
      'matriarch casting should brighten the instrument core')
  }
  if (p.enemyId === 'rot-sac-toad') {
    assert.equal(p.name, '\u8150\u56ca\u86e4\u87c6')
    assertToadPose(p)
  }
  if (p.enemyId === 'nest-spider') {
    assert(!p.parts.some(part => part.id.startsWith('spinneret')), 'nest-spider spinneret should be removed')
    assert(!p.joints.some(j => /spinneret|tail|abdomen-tip/.test(j.id)), 'nest-spider tail joints should be removed')
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
    if (part.attachment.type === 'bone') {
      assert.equal(part.attachment.type, 'bone')
      assert(p.bones.some(bone => bone.id === part.attachment.targetId))
    } else {
      assert.equal(part.attachment.type, 'joint', `${p.enemyId}: unattached paper part`)
      assert(joints.has(part.attachment.targetId))
    }
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
      if (p.enemyId === 'redneedle-salamander') {
        assertSalamanderSpine(pose)
        assertSalamanderChest(pose)
        assertSalamanderConnections(pose)
      }
      if (p.enemyId === 'beetle-guard') { assertBeetleWings(pose); assertBeetleHorn(pose) }
      if (p.enemyId === 'redwheel-fire-crow') assertCrowFaceFold(pose)
      if (p.enemyId === 'tide-rite-matriarch') assertTideMatriarchConnections(pose)
      if (p.enemyId === 'drown-shadow-hunter') assertHunterSockets(pose)
      if (p.enemyId === 'tidal-spore-sac') assertTidalSporeConnections(pose)
      if (p.enemyId === 'cracked-hunter') assertCrackedHunterSockets(pose)
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
for (const source of projects.filter(p => ['moss-colossus', 'revenant-guard'].includes(p.enemyId))) {
  const authored = evaluateShadowProject(source, null, 0, { raw: true })
  const saved = evaluateShadowProject(normalizeShadowProject(source), null, 0, { raw: true })
  for (const arm of authored.parts.filter(p => /^(left|right)-(?:arm|secondary)-/.test(p.part.id))) {
    const restored = saved.parts.find(p => p.part.id === arm.part.id)
    arm.matrix.elements.forEach((value, i) => assert(Math.abs(value - restored.matrix.elements[i]) < 1e-7,
      `${source.enemyId}/${arm.part.id}: saving must preserve arm position and width`))
  }
}
for (const id of ['patrol-hound', 'redwheel-fire-crow']) {
  const p = projects.find(p => p.enemyId === id)
  const pose = evaluateShadowProject(p, null, 0)
  for (const suffix of ['face', 'jaw']) {
    const a = p.parts.find(p => p.id === `left-${suffix}`), b = p.parts.find(p => p.id === `right-${suffix}`)
    assert.equal(a.visual.texture, b.visual.texture, `${id}: mismatched mirrored profiles`)
    assert.equal(a.attachment.targetId, b.attachment.targetId, `${id}: split fold hinge`)
    assert.equal(a.width, b.width); assert.equal(a.height, b.height)
    assert.equal(a.x, b.x); assert.equal(a.y, b.y); assert.equal(a.z, b.z)
    const hingeX = pose.jointsById.get(a.attachment.targetId).matrix.elements[12]
    for (const [u, v] of [[.25, .2], [.5, .5], [.85, .8]]) {
      const left = textureSocket(pose.parts.find(part => part.part.id === a.id), u, v)
      const right = textureSocket(pose.parts.find(part => part.part.id === b.id), u, v)
      assert(Math.abs(left.x + right.x - 2 * hingeX) < 1e-8)
      assert(Math.abs(left.y - right.y) < 1e-8); assert(Math.abs(left.z - right.z) < 1e-8)
    }
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
restoreV36WalkerArms(walker)
walker.joints.find(j => j.id === 'neck').y -= 8
walker.joints.find(j => j.id === 'neck').z += 4
walker.joints.find(j => j.id === 'head').y -= 8
walker.joints.find(j => j.id === 'head').z += 5
walker.joints.find(j => j.id === 'left-shoulder').z = -11
walker.joints.find(j => j.id === 'rot-stilt-root').x -= 14
walker.joints.find(j => j.id === 'rot-stilt-root').z = -7
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
restoreV36WalkerArms(retainedWalker)
retainedWalker.joints.find(j => j.id === 'rot-stilt-root').x -= 6
retainedWalker.joints.find(j => j.id === 'neck').y -= 8
retainedWalker.joints.find(j => j.id === 'neck').z += 4
retainedWalker.joints.find(j => j.id === 'head').y -= 8
retainedWalker.joints.find(j => j.id === 'head').z += 5
retainedWalker.joints.find(j => j.id === 'rot-stilt-root').z = -7
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

// V26 -> V27 removes spider tail branches and their tracks, and preserves
// custom hound art/motion and its jaw while updating the connected limbs.
const hound = structuredClone(projects.find(p => p.enemyId === 'patrol-hound'))
hound.joints.find(j => j.id === 'haunch').z += 16
hound.joints.find(j => j.id === 'neck').z -= 8
Object.assign(hound.parts.find(p => p.id === 'back'), { rotationX: -72, y: 26, z: -15 })
hound.parts.find(p => p.id === 'back').height /= 1.18
for (const side of ['left', 'right']) for (const end of ['front', 'hind']) {
  const bend = end === 'front' ? 18 : -24
  const hip = hound.joints.find(j => j.id === `${side}-${end}-hip`)
  hip.rotationX -= bend
  if (end === 'front') hip.z -= 6
  hound.joints.find(j => j.id === `${side}-${end}-knee`).rotationX += bend * 2
  hound.joints.find(j => j.id === `${side}-${end}-paw`).rotationX -= bend
}
for (const [side, turn] of [['left', -5], ['right', 5]]) {
  const face = hound.parts.find(p => p.id === `${side}-face`)
  face.rotationY -= turn; face.z -= 1.2
}
hound.parts.find(p => p.id === 'nose').z -= 1.2
rebuildEnemyGrounding(hound)
hound.parts[0].fill = '#987654'
const savedHoundJaw = structuredClone({ joint: hound.joints.find(j => j.id === 'jaw'), parts: hound.parts.filter(p => p.id.endsWith('-jaw')) })
const savedHoundMotion = JSON.stringify(hound.animations)
const spider = structuredClone(projects.find(p => p.enemyId === 'nest-spider'))
for (const [id, parent] of [['abdomen-tip', 'abdomen'], ['spinneret-hinge', 'abdomen-tip'], ['spinneret-tip', 'spinneret-hinge']]) {
  spider.joints.push({ ...structuredClone(spider.joints[0]), id, name: id })
  spider.bones.push({ ...structuredClone(spider.bones[0]), id: `old-${id}`, fromJointId: parent, toJointId: id })
  spider.animations.idle.tracks[`joint:${id}`] = structuredClone(Object.values(spider.animations.idle.tracks)[0])
}
spider.parts.push({ ...structuredClone(spider.parts[0]), id: 'spinneret-sheet', attachment: { type: 'joint', targetId: 'spinneret-hinge' } })
spider.parts.push({ ...structuredClone(spider.parts[0]), id: 'custom-tail-piece', attachment: { type: 'bone', targetId: 'old-spinneret-tip' } })
spider.animations.idle.tracks['part:spinneret-sheet'] = structuredClone(Object.values(spider.animations.idle.tracks)[0])
spider.parts[0].fill = '#112233'
const retainedShellguard = structuredClone(projects.find(p => p.enemyId === 'shellguard'))
const expectedRetainedShellguard = structuredClone(retainedShellguard)
const houndRoster = { enemyArtPackVersion: 26, activeCharacterId: 'hound', characters: [
  { id: 'hound', project: hound }, { id: 'spider', project: spider }, { id: 'shellguard', project: retainedShellguard },
] }
assert(installEnemyShadowProjects(houndRoster))
assertHoundPose(hound)
assert.equal(hound.parts[0].fill, '#987654')
assert.equal(JSON.stringify(hound.animations), savedHoundMotion)
assert.deepEqual({ joint: hound.joints.find(j => j.id === 'jaw'), parts: hound.parts.filter(p => p.id.endsWith('-jaw')) }, savedHoundJaw)
assert(!spider.joints.some(j => /spinneret|tail|abdomen-tip/.test(j.id)))
assert(!spider.parts.some(p => /spinneret|custom-tail-piece/.test(p.id)))
assert(!Object.keys(spider.animations.idle.tracks).some(key => /spinneret|tail|abdomen-tip/.test(key)))
assert.equal(spider.parts[0].fill, '#112233')
assert.deepEqual(retainedShellguard, expectedRetainedShellguard, 'V27 must not replay shellguard stance changes')
assert.equal(houndRoster.activeCharacterId, 'hound')
const updatedHoundRoster = structuredClone(houndRoster)
assert.equal(installEnemyShadowProjects(houndRoster), false)
assert.deepEqual(houndRoster, updatedHoundRoster)

// V36 -> V37 updates the articulated end legs and the painted horn endpoint
// while retaining custom art, animation, unrelated limbs and active selection.
const crawlerCharacters = projects.filter(p => ['nest-spider', 'beetle-guard'].includes(p.enemyId)).map(project => ({ id: project.enemyId, project: structuredClone(project) }))
for (const { project } of crawlerCharacters) {
  const last = project.enemyId === 'nest-spider' ? 3 : 2
  for (const side of ['left', 'right']) for (const index of [0, last]) project.joints.find(j => j.id === `${side}-leg-${index}-coxa`).rotationX = 0
  rebuildEnemyGrounding(project)
  project.parts[0].fill = '#778899'
}
const oldBeetle = crawlerCharacters.find(c => c.id === 'beetle-guard').project
const horn = oldBeetle.parts.find(p => p.id === 'battering-horn-sheet')
horn.width += 5
const customHorn = structuredClone(horn)
Object.assign(oldBeetle.joints.find(j => j.id === 'battering-horn-tip'), { x: 0, y: 17, z: 46 })
const customLegMotion = JSON.stringify(oldBeetle.animations.move.tracks['joint:left-leg-0-coxa'])
const middleLeg = structuredClone(oldBeetle.joints.find(j => j.id === 'left-leg-1-coxa'))
const crawlerRoster = { enemyArtPackVersion: 36, activeCharacterId: 'beetle-guard', characters: crawlerCharacters }
assert(installEnemyShadowProjects(crawlerRoster))
assert.equal(crawlerRoster.characters.length, 2)
assert.equal(crawlerRoster.activeCharacterId, 'beetle-guard')
assert.deepEqual(horn, customHorn, 'horn artwork stays in place while its skeleton node moves')
assertBeetleHorn(evaluateShadowProject(oldBeetle, null, 0))
assert.deepEqual(oldBeetle.joints.find(j => j.id === middleLeg.id), middleLeg)
assert.equal(JSON.stringify(oldBeetle.animations.move.tracks['joint:left-leg-0-coxa']), customLegMotion)
assert(crawlerCharacters.every(c => c.project.parts[0].fill === '#778899'))
const upgradedCrawlers = structuredClone(crawlerRoster)
assert.equal(installEnemyShadowProjects(crawlerRoster), false)
assert.deepEqual(crawlerRoster, upgradedCrawlers)

// Repair flattened V37 mirrors and restore anatomy/alpha on V38 solid barrels.
const repairedCharacters = projects.filter(p => ['revenant-guard', 'redneedle-salamander', 'rot-sac-toad'].includes(p.enemyId)).map(project => ({ id: project.enemyId, project: normalizeShadowProject(project) }))
for (const { project } of repairedCharacters) {
  if (project.enemyId === 'revenant-guard') project.joints.find(j => j.id === 'right-secondary-shoulder').scaleX = .01
  for (const part of project.parts.filter(p => ['back', 'back-mid', 'chest', 'chest-rear', 'rump', 'torso-front-cap'].includes(p.id) || p.id.endsWith('-flank'))) {
    if (!['redneedle-salamander', 'rot-sac-toad'].includes(project.enemyId)) continue
    part.visual.backingColor = '#50603a'
    part.visual.skinTexture = `/assets/enemies/skins-v1/${project.enemyId}.png`
    part.visual.textureFit = 'contain'
    if (part.id.endsWith('-flank')) {
      part.visual.texture = part.visual.skinTexture
      part.visual.textureFrame.crop = { left: 0, top: 0, width: 1, height: 1 }
    }
  }
}
const solidBeastRoster = { enemyArtPackVersion: 38, activeCharacterId: 'rot-sac-toad', characters: structuredClone(repairedCharacters.filter(c => ['redneedle-salamander', 'rot-sac-toad'].includes(c.project.enemyId))) }
const repairRoster = { enemyArtPackVersion: 37, activeCharacterId: 'revenant-guard', characters: repairedCharacters }
assert(installEnemyShadowProjects(repairRoster))
for (const { project } of repairRoster.characters) {
  if (project.enemyId === 'revenant-guard') assert.equal(normalizeShadowProject(project).joints.find(j => j.id === 'right-secondary-shoulder').scaleX, -1)
  if (['redneedle-salamander', 'rot-sac-toad'].includes(project.enemyId)) {
    for (const part of project.parts.filter(p => p.id.endsWith('-flank'))) {
      const center = project.parts.find(p => p.id === part.id.replace(/-(left|right)-flank$/, ''))
      assert(!part.visual.backingColor && !part.visual.skinTexture, 'beast side panels must preserve transparent anatomy edges')
      assert.equal(part.visual.texture, center.visual.texture, 'restore anatomy texture lost in V38 saves')
      assert.equal(part.visual.textureFit, 'stretch')
      assert.equal(part.visual.textureFrame.crop.top, center.visual.textureFrame.crop.top)
      assert.equal(part.visual.textureFrame.crop.height, center.visual.textureFrame.crop.height)
      assert.equal(part.visual.textureFrame.crop.width, center.visual.textureFrame.crop.width * .72, 'use wider inner bands instead of mostly empty outer quarters')
    }
    assert(project.parts.every(p => !p.visual.backingColor && !p.visual.skinTexture), 'no solid underlay on the back, belly or end panels')
  }
}
const repairedSnapshot = structuredClone(repairRoster)
assert.equal(installEnemyShadowProjects(repairRoster), false)
assert.deepEqual(repairRoster, repairedSnapshot)
assert(installEnemyShadowProjects(solidBeastRoster))
assert.equal(solidBeastRoster.activeCharacterId, 'rot-sac-toad')
for (const { project } of solidBeastRoster.characters) {
  const template = normalizeShadowProject(projects.find(p => p.enemyId === project.enemyId))
  for (const part of normalizeShadowProject(project).parts) {
    if (part.id.endsWith('-flank')) assert.deepEqual(part.visual, template.parts.find(p => p.id === part.id).visual)
    assert(!part.visual.backingColor && !part.visual.skinTexture)
  }
}
const transparentSnapshot = structuredClone(solidBeastRoster)
assert.equal(installEnemyShadowProjects(solidBeastRoster), false)
assert.deepEqual(solidBeastRoster, transparentSnapshot, 'saved transparent crops must not shrink again on reload')

// Draft retention is checked by shadow-editor-cache-check: new code revisions
// rebuild the roster. A legacy installer must also leave the new rig intact.
const rebuiltMossRoster = { enemyArtPackVersion: 35, activeCharacterId: 'moss', characters: [{ id: 'moss', project: normalizeShadowProject(projects.find(p => p.enemyId === 'moss-colossus')) }] }
assert(installEnemyShadowProjects(rebuiltMossRoster))
assert.equal(rebuiltMossRoster.characters[0].project.joints.find(j => j.id === 'neck').x, projects.find(p => p.enemyId === 'moss-colossus').joints.find(j => j.id === 'neck').x)
assert.equal(rebuiltMossRoster.characters[0].project.joints.find(j => j.id === 'right-secondary-shoulder').scaleX, 1)

const savedSalamander = structuredClone(projects.find(p => p.enemyId === 'redneedle-salamander'))
savedSalamander.parts = savedSalamander.parts.filter(p => !['back-mid', 'back-tail', 'chest-rear', 'torso-front-cap'].includes(p.id) && !p.id.endsWith('-flank'))
for (const part of savedSalamander.parts) delete part.attachment.orientationJointId
savedSalamander.joints.find(j => j.id === 'head').rotationX += 8
savedSalamander.joints.find(j => j.id === 'head').y = 8
savedSalamander.joints.find(j => j.id === 'neck').y = 12
for (const [side, sign] of [['left', -1], ['right', 1]]) {
  Object.assign(savedSalamander.joints.find(j => j.id === `${side}-front-hip`), { x: sign * 101 * .32, y: -23, z: 26 })
  Object.assign(savedSalamander.joints.find(j => j.id === `${side}-front-knee`), { x: 0, y: -27 * .82 })
  Object.assign(savedSalamander.joints.find(j => j.id === `${side}-front-paw`), { x: 0, y: -22 * .83 })
  Object.assign(savedSalamander.parts.find(p => p.id === `${side}-front-upper`), { height: 27, pivotX: .5, pivotY: .08, rotationZ: 0,
    attachment: { type: 'joint', targetId: `${side}-front-hip`, t: .5, followRotation: true } })
  Object.assign(savedSalamander.parts.find(p => p.id === `${side}-front-lower`), { height: 22, pivotX: .5, pivotY: .08, z: .3, rotationZ: 0,
    attachment: { type: 'joint', targetId: `${side}-front-knee`, t: .5, followRotation: true } })
  Object.assign(savedSalamander.parts.find(p => p.id === `${side}-front-foot`), { pivotX: .5, pivotY: .12, z: .6 })
}
for (let i = 0; i < 3; i++) {
  savedSalamander.joints.find(j => j.id === `needle-${i}`).y = 29
  savedSalamander.parts.find(p => p.id === `needle-${i}-art`).pivotY = .92
}
const oldSpine = savedSalamander.parts.find(p => p.id === 'back')
Object.assign(oldSpine, { name: oldSpine.name.replace(/ 1$/, ''), height: 111.1, pivotY: .4, rotationX: -72, rotationZ: 0, y: 26, z: -15,
  attachment: { type: 'joint', targetId: 'root', followRotation: true, t: .5 } })
oldSpine.visual.textureFrame.crop = { left: 0, top: 0, width: 1, height: 1 }
const oldChest = savedSalamander.parts.find(p => p.id === 'chest')
oldChest.width *= 2
Object.assign(oldChest, { rotationX: 0, rotationZ: 0, y: 0, height: 101, pivotY: .45,
  attachment: { type: 'joint', targetId: 'root', followRotation: true, t: .5 } })
oldChest.visual.textureFrame.crop = { left: 0, top: 0, width: 1, height: 1 }
oldSpine.fill = '#abcdef'
savedSalamander.animations.idle.tracks['part:back'] = structuredClone(Object.values(savedSalamander.animations.idle.tracks)[0])
const preservedSalamanderMotion = structuredClone(savedSalamander.animations)
const retainedHound = structuredClone(projects.find(p => p.enemyId === 'patrol-hound'))
const expectedRetainedHound = structuredClone(retainedHound)
const salamanderRoster = { enemyArtPackVersion: 27, activeCharacterId: 'salamander', characters: [
  { id: 'salamander', project: savedSalamander }, { id: 'hound', project: retainedHound },
] }
assert(installEnemyShadowProjects(salamanderRoster))
assertSalamanderSpine(evaluateShadowProject(savedSalamander, null, 0, { raw: true }))
for (const id of ['back', 'back-mid', 'back-tail']) assert.equal(savedSalamander.parts.find(p => p.id === id).fill, '#abcdef')
for (const [action, animation] of Object.entries(preservedSalamanderMotion)) {
  for (const [target, track] of Object.entries(animation.tracks)) assert.deepEqual(savedSalamander.animations[action].tracks[target], track)
}
assert.deepEqual(savedSalamander.animations.idle.tracks['part:back-mid'], preservedSalamanderMotion.idle.tracks['part:back'])
assert.deepEqual(savedSalamander.animations.idle.tracks['part:back-tail'], preservedSalamanderMotion.idle.tracks['part:back'])
assert.deepEqual(retainedHound, expectedRetainedHound, 'V28 must not repeat hound length or pose changes')
assert.equal(salamanderRoster.activeCharacterId, 'salamander')
const updatedSalamanderRoster = structuredClone(salamanderRoster)
assert.equal(installEnemyShadowProjects(salamanderRoster), false)
assert.deepEqual(salamanderRoster, updatedSalamanderRoster)

const oldBeetleWings = structuredClone(projects.find(p => p.enemyId === 'beetle-guard'))
oldBeetleWings.parts[0].fill = '#abcdef'
const expectedBeetleWings = structuredClone(oldBeetleWings)
for (const [side, sign] of [['left', -1], ['right', 1]]) {
  oldBeetleWings.joints.find(j => j.id === `${side}-gate-hinge`).x = sign * 6
  Object.assign(oldBeetleWings.joints.find(j => j.id === `${side}-gate-tip`), { x: sign * 39, y: 8, z: -38 })
  Object.assign(oldBeetleWings.parts.find(p => p.id === `${side}-gate-sheet`), { rotationX: -55, rotationZ: 0 })
}
const elytraRoster = { enemyArtPackVersion: 30, activeCharacterId: 'beetle', characters: [{ id: 'beetle', project: oldBeetleWings }] }
assert(installEnemyShadowProjects(elytraRoster))
assert.equal(elytraRoster.activeCharacterId, 'beetle')
assert.deepEqual(oldBeetleWings, expectedBeetleWings, 'elytra update should preserve custom art, animation and other bones')
assert.equal(installEnemyShadowProjects(elytraRoster), false)
assert.deepEqual(oldBeetleWings, expectedBeetleWings, 'elytra placement must not accumulate on reload')
const savedToad = structuredClone(projects.find(p => p.enemyId === 'rot-sac-toad'))
savedToad.parts[0].fill = '#abcdef'
const expectedToad = structuredClone(savedToad)
for (const part of expectedToad.parts.filter(p => p.id.startsWith('chest'))) part.fill = '#abcdef'
savedToad.parts = savedToad.parts.filter(p => !['back-mid', 'chest-rear', 'torso-front-cap'].includes(p.id) && !p.id.endsWith('-flank'))
const oldToadBack = savedToad.parts.find(p => p.id === 'back')
Object.assign(oldToadBack, { width: 145.2, height: 145.2 * 236 / 277, pivotX: .5, pivotY: .4, x: 0, y: 26, z: -15, rotationX: -72, rotationZ: 0,
  attachment: { type: 'joint', targetId: 'root', t: .5, followRotation: true } })
oldToadBack.visual.textureFrame.crop = { left: 0, top: 0, width: 1, height: 1 }
const oldToadChest = savedToad.parts.find(p => p.id === 'chest')
Object.assign(oldToadChest, { width: 132, height: 132 * 313 / 324, pivotX: .5, pivotY: .45, x: 0, y: 0, z: 0, rotationX: 0, rotationZ: 0,
  attachment: { type: 'joint', targetId: 'root', t: .5, followRotation: true } })
oldToadChest.visual.textureFrame.crop = { left: 0, top: 0, width: 1, height: 1 }
Object.assign(savedToad.parts.find(p => p.id === 'rump'), { width: 89.76, height: 89.76 * 198 / 240, pivotX: .5, pivotY: .45, x: 0, y: 0, z: 0, rotationX: -28,
  attachment: { type: 'joint', targetId: 'haunch', t: .5, followRotation: true } })
savedToad.joints.find(j => j.id === 'neck').y = 24
savedToad.joints.find(j => j.id === 'head').y = 18
for (const [side, sign] of [['left', -1], ['right', 1]]) {
  Object.assign(savedToad.joints.find(j => j.id === `${side}-front-hip`), { x: sign * 132 * .32, y: -23, z: 26 })
  Object.assign(savedToad.joints.find(j => j.id === `${side}-front-knee`), { x: 0, y: -30 * .82, z: 0 })
  Object.assign(savedToad.joints.find(j => j.id === `${side}-front-paw`), { x: 0, y: -26 * .83, z: 0 })
  Object.assign(savedToad.parts.find(p => p.id === `${side}-front-upper`), { height: 30, pivotX: .5, pivotY: .08, rotationZ: 0,
    attachment: { type: 'joint', targetId: `${side}-front-hip`, t: .5, followRotation: true } })
  Object.assign(savedToad.parts.find(p => p.id === `${side}-front-lower`), { height: 26, pivotX: .5, pivotY: .08, z: .3, rotationZ: 0,
    attachment: { type: 'joint', targetId: `${side}-front-knee`, t: .5, followRotation: true } })
  Object.assign(savedToad.parts.find(p => p.id === `${side}-front-foot`), { pivotX: .5, pivotY: .12, z: .6 })
}
savedToad.name = '\u8150\u56ca\u87c7'
savedToad.parts.find(p => p.id === 'back').rotationX = -72
savedToad.joints.find(j => j.id === 'head').rotationX += 8
const toadRoster = { enemyArtPackVersion: 33, activeCharacterId: 'toad', characters: [{ id: 'toad', project: savedToad }] }
assert(installEnemyShadowProjects(toadRoster))
assertToadPose(savedToad)
const roundedProject = project => JSON.parse(JSON.stringify(project, (key, value) => typeof value === 'number' ? Math.round(value * 1e6) / 1e6 : value))
assert.deepEqual(roundedProject(savedToad), roundedProject(expectedToad), 'toad update should retain custom artwork, mouth animation and other joints')
assert.equal(toadRoster.activeCharacterId, 'toad')
assert.equal(installEnemyShadowProjects(toadRoster), false)
assert.deepEqual(roundedProject(savedToad), roundedProject(expectedToad), 'toad pose must not accumulate on reload')
savedToad.name = 'Custom toad'
assert.equal(installEnemyShadowProjects(toadRoster), false)
assert.equal(savedToad.name, 'Custom toad', 'custom toad names must remain intact')
console.log(`Enemy completion: ${projects.length} fully textured rigs, ${parts} parts, ${frames} animation frames; folded faces and editor refresh passed.`)
