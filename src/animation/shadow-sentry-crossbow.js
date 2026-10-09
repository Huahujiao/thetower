import { Vector3 } from 'three'
import { createShadowBone, createShadowJoint, evaluateShadowProject, shadowTransformMatrix } from './shadow-rig.js'

function fitPart(project, part, target, from, to, end = false) {
  const crop = part.visual.textureFrame.crop
  const dx = (to[0] - from[0]) * part.width / crop.width
  const dy = -(to[1] - from[1]) * part.height / crop.height
  const pivot = end ? to : from
  Object.assign(part, { x: 0, y: 0, z: 0,
    pivotX: (pivot[0] - crop.left) / crop.width, pivotY: (pivot[1] - crop.top) / crop.height,
    rotationX: 0, rotationY: 0, rotationZ: Math.atan2(-dy, dx) * 180 / Math.PI,
    attachment: { type: 'bone', targetId: project.bones.find(b => b.toJointId === target).id,
      t: end ? 1 : 0, followRotation: true, orientationJointId: 'root', bindLength: Math.hypot(dx, dy) } })
  part.visual.textureFit = 'stretch'
}

// A single carrying pose holds both grips, so animation cannot separate the
// hands from the bow. +Z is forward; the muzzle pitches ten degrees downward.
export function raiseSentryCrossbow(project) {
  if (project.enemyId !== 'sentry-crossbow' || project.joints.some(j => j.id === 'crossbow-hold')) return
  const joints = new Map(project.joints.map(j => [j.id, j]))
  project.joints.push(createShadowJoint({ id: 'crossbow-hold', name: '\u53cc\u624b\u6301\u5f29' }))
  project.bones.push(createShadowBone({ id: 'crossbow-hold-bone', fromJointId: 'root', toJointId: 'crossbow-hold' }))
  const weapon = joints.get('weapon')
  Object.assign(weapon, { x: 0, y: 14, z: 72, rotationX: 100, rotationY: 0, rotationZ: 0 })
  project.bones.find(b => b.toJointId === 'weapon').fromJointId = 'crossbow-hold'
  const fullWidth = project.parts.find(p => p.id === 'bow-stock').width / .28
  const fullHeight = project.parts.find(p => p.id === 'bow-stock').height / .79
  const weaponMatrix = shadowTransformMatrix(weapon)
  for (const [side, sign, anchors] of [
    ['left', -1, [[.70, .18], [.23, .36], [.25, .80]]],
    ['right', 1, [[.30, .18], [.66, .36], [.61, .80]]],
  ]) {
    const shoulder = joints.get(`${side}-arm-root`), elbow = joints.get(`${side}-arm-hinge`), hand = joints.get(`${side}-arm-tip`)
    const grip = new Vector3(sign * .42 * fullWidth, (.32 - .21) * fullHeight, 0).applyMatrix4(weaponMatrix)
    Object.assign(shoulder, { x: sign * 40, y: 30, z: 8, rotationX: 0, rotationY: 0, rotationZ: 0 })
    project.bones.find(b => b.toJointId === shoulder.id).fromJointId = 'crossbow-hold'
    Object.assign(elbow, { x: sign * 7, y: -8, z: 27, rotationX: 0, rotationY: 0, rotationZ: 0 })
    Object.assign(hand, { x: grip.x - shoulder.x - elbow.x, y: grip.y - shoulder.y - elbow.y, z: grip.z - shoulder.z - elbow.z,
      rotationX: 0, rotationY: 0, rotationZ: 0 })
    fitPart(project, project.parts.find(p => p.id === `${side}-arm-upper`), elbow.id, anchors[0], anchors[1])
    fitPart(project, project.parts.find(p => p.id === `${side}-arm-lower`), hand.id, anchors[1], anchors[2])
    fitPart(project, project.parts.find(p => p.id === `${side}-arm-end`), hand.id, anchors[1], anchors[2], true)
    joints.get(`${side}-bow`).z = 0
  }
  for (const animation of Object.values(project.animations)) {
    if (animation.tracks['joint:weapon']) animation.tracks['joint:crossbow-hold'] = animation.tracks['joint:weapon']
    for (const id of ['weapon', 'left-bow', 'right-bow', ...['left', 'right'].flatMap(side => ['root', 'hinge', 'tip'].map(suffix => `${side}-arm-${suffix}`))]) delete animation.tracks[`joint:${id}`]
  }
  const width = project.parts.filter(p => /^(left|right)-tripod-upper$/.test(p.id)).reduce((sum, p) => sum + p.width, 0) / 2
  for (const [side, sign] of [['left', -1], ['right', 1]]) {
    for (const suffix of ['upper', 'lower']) project.parts.find(p => p.id === `${side}-tripod-${suffix}`).width = width
    Object.assign(joints.get(`${side}-tripod-root`), { x: sign * 18, y: 0, z: 5 })
    const lower = project.parts.find(p => p.id === `${side}-tripod-lower`)
    Object.assign(joints.get(`${side}-tripod-hinge`), { x: sign * .38 * width, y: -.38 * lower.height / .57, z: 2 })
  }
}

export function alignSentryFootContacts(project) {
  if (project.enemyId !== 'sentry-crossbow') return
  const rest = evaluateShadowProject(project, null, 0, { raw: true })
  for (const [side, u] of [['left', .12], ['right', .88]]) {
    const contact = project.joints.find(j => j.id === `${side}-tripod-lower-ground-contact`)
    if (!contact) continue
    const foot = rest.parts.find(p => p.part.id === `${side}-tripod-lower`)
    const point = new Vector3((u - foot.part.pivotX) * foot.part.width, 0, 0).applyMatrix4(foot.matrix)
      .applyMatrix4(rest.jointsById.get(`${side}-tripod-hinge`).matrix.clone().invert())
    contact.x = point.x; contact.z = point.z
  }
}
