import { Vector3 } from 'three'
import { createShadowBone, createShadowJoint, evaluateShadowProject, shadowTransformMatrix } from './shadow-rig.js'

function fitPart(project, part, target, from, to) {
  const crop = part.visual.textureFrame.crop
  const dx = (to[0] - from[0]) * part.width / crop.width
  const dy = -(to[1] - from[1]) * part.height / crop.height
  Object.assign(part, { x: 0, y: 0, z: 0,
    pivotX: (from[0] - crop.left) / crop.width, pivotY: (from[1] - crop.top) / crop.height,
    rotationX: 0, rotationY: 0, rotationZ: Math.atan2(-dy, dx) * 180 / Math.PI,
    attachment: { type: 'bone', targetId: project.bones.find(b => b.toJointId === target).id,
      t: 0, followRotation: true, orientationJointId: 'crossbow-arm-plane', bindLength: Math.hypot(dx, dy) } })
  part.visual.textureFit = 'stretch'
}

// A single carrying pose holds both grips, so animation cannot separate the
// hands from the bow. +Z is forward; the muzzle pitches ten degrees downward.
export function raiseSentryCrossbow(project) {
  if (project.enemyId !== 'sentry-crossbow' || project.joints.some(j => j.id === 'crossbow-hold')) return
  const joints = new Map(project.joints.map(j => [j.id, j]))
  project.joints.push(createShadowJoint({ id: 'sentry-upper-body', name: '\u4e0a\u534a\u8eab', y: 44 }))
  for (const bone of project.bones) if (bone.fromJointId === 'root' && bone.toJointId !== 'pelvis') bone.fromJointId = 'sentry-upper-body'
  project.bones.push(createShadowBone({ id: 'sentry-upper-body-bone', fromJointId: 'root', toJointId: 'sentry-upper-body' }))
  const torso = project.parts.find(p => p.id === 'torso')
  torso.attachment.targetId = 'sentry-upper-body'
  joints.get('neck').z = 2
  joints.get('head').z = 1
  // This cutout is a tail, not a third planted foot. Keep its root at the
  // pelvis and swing its downward image axis toward character-back (-Z).
  Object.assign(joints.get('rear-tripod'), { name: '\u5c3e\u6839', z: -1, rotationX: 60 })
  const tail = project.parts.find(p => p.id === 'rear-tripod-art')
  tail.name = '\u540e\u659c\u9aa8\u5c3e'
  project.joints.push(createShadowJoint({ id: 'sentry-tail-tip', name: '\u9aa8\u5c3e\u5c16', y: (tail.pivotY - .98) * tail.height }))
  project.bones.push(createShadowBone({ id: 'sentry-tail-bone', fromJointId: 'rear-tripod', toJointId: 'sentry-tail-tip' }))

  // Expose the painted vertebrae between the raised chest and the foot roots.
  const spine = project.parts.find(p => p.id === 'spine')
  const spineTop = (torso.pivotY - .90) * torso.height
  const spineLength = 44 + spineTop - joints.get('pelvis').y
  project.joints.push(createShadowJoint({ id: 'sentry-waist-spine', name: '\u8170\u810a\u4e0a\u7aef', y: spineTop, z: -1 }))
  project.joints.push(createShadowJoint({ id: 'sentry-waist-spine-bottom', name: '\u8170\u810a\u4e0b\u7aef', y: -spineLength, z: -3 }))
  project.bones.push(createShadowBone({ id: 'sentry-waist-spine-top-bone', fromJointId: 'sentry-upper-body', toJointId: 'sentry-waist-spine' }))
  project.bones.push(createShadowBone({ id: 'sentry-waist-spine-bone', fromJointId: 'sentry-waist-spine', toJointId: 'sentry-waist-spine-bottom' }))
  const spineScale = spineLength / (.86 * spine.height)
  spine.width *= spineScale; spine.height *= spineScale
  fitPart(project, spine, 'sentry-waist-spine-bottom', [.5, .08], [.5, .94])
  delete spine.attachment.orientationJointId

  project.joints.push(createShadowJoint({ id: 'crossbow-hold', name: '\u53cc\u624b\u6301\u5f29' }))
  project.bones.push(createShadowBone({ id: 'crossbow-hold-bone', fromJointId: 'sentry-upper-body', toJointId: 'crossbow-hold' }))
  // Use world X as the strip's transverse direction so the carrying arms lie
  // across the ground plane instead of presenting vertical cutout faces.
  project.joints.push(createShadowJoint({ id: 'crossbow-arm-plane', name: '\u5e73\u4e3e\u624b\u81c2\u65b9\u5411', rotationZ: -90 }))
  project.bones.push(createShadowBone({ id: 'crossbow-arm-plane-bone', fromJointId: 'crossbow-hold', toJointId: 'crossbow-arm-plane' }))
  const weapon = joints.get('weapon')
  Object.assign(weapon, { x: 0, rotationX: 100, rotationY: 0, rotationZ: 0 })
  project.bones.find(b => b.toJointId === 'weapon').fromJointId = 'crossbow-hold'
  const fullWidth = project.parts.find(p => p.id === 'bow-stock').width / .28
  const fullHeight = project.parts.find(p => p.id === 'bow-stock').height / .79
  const shoulderHeight = 30, upperArmDrop = 40, palmClearance = 4
  const clawRotation = { rotationX: -75, rotationY: 0, rotationZ: 0 }
  const referenceClaw = project.parts.find(p => p.id === 'left-arm-end')
  const palmDrop = new Vector3(0, -.10 * referenceClaw.height / referenceClaw.visual.textureFrame.crop.height, 0)
    .applyMatrix4(shadowTransformMatrix(clawRotation)).y
  const gripDrop = new Vector3(0, (.32 - .21) * fullHeight, 0)
    .applyMatrix4(shadowTransformMatrix({ rotationX: weapon.rotationX })).y
  // Retain the accepted arm reach and level wrists. Position the weapon from
  // the finished hands afterwards, so moving it cannot pull the arms along.
  const armPlacementMatrix = shadowTransformMatrix({ ...weapon, z: 104,
    y: shoulderHeight - upperArmDrop - palmClearance + palmDrop - gripDrop })
  const palmContacts = []
  for (const [side, sign, anchors] of [
    ['left', -1, [[.70, .18], [.23, .36], [.25, .70]]],
    ['right', 1, [[.30, .18], [.66, .36], [.61, .70]]],
  ]) {
    const shoulder = joints.get(`${side}-arm-root`), elbow = joints.get(`${side}-arm-hinge`), hand = joints.get(`${side}-arm-tip`)
    const grip = new Vector3(sign * .42 * fullWidth, (.32 - .21) * fullHeight, 0).applyMatrix4(armPlacementMatrix)
    Object.assign(shoulder, { x: sign * 40, y: shoulderHeight, z: 8, rotationX: 0, rotationY: 0, rotationZ: 0 })
    project.bones.find(b => b.toJointId === shoulder.id).fromJointId = 'crossbow-hold'
    // About thirty degrees from character-down, with a slight outward bend.
    Object.assign(elbow, { x: sign * 12, y: -upperArmDrop, z: 20, rotationX: 0, rotationY: 0, rotationZ: 0 })
    // The wrist sits above and behind the palm. Pitch the claw downward onto
    // the bow independently of the level forearm, retaining a seam.
    const claw = project.parts.find(p => p.id === `${side}-arm-end`)
    const clawCrop = claw.visual.textureFrame.crop
    const wristToPalm = new Vector3(0, -.10 * claw.height / clawCrop.height, 0)
      .applyMatrix4(shadowTransformMatrix(clawRotation))
    const wrist = grip.clone().add(new Vector3(0, palmClearance, 0)).sub(wristToPalm)
    // UV .85 lies at the palm/finger roots, beyond the wrist cuff. The bow's
    // actual transverse grip is at UV .32, rather than its forward edge .21.
    palmContacts.push(wrist.clone().add(new Vector3(0, -.15 * claw.height / clawCrop.height, 0)
      .applyMatrix4(shadowTransformMatrix(clawRotation))))
    Object.assign(hand, { x: wrist.x - shoulder.x - elbow.x, y: wrist.y - shoulder.y - elbow.y, z: wrist.z - shoulder.z - elbow.z,
      rotationX: 0, rotationY: 0, rotationZ: 0 })
    fitPart(project, project.parts.find(p => p.id === `${side}-arm-upper`), elbow.id, anchors[0], anchors[1])
    fitPart(project, project.parts.find(p => p.id === `${side}-arm-lower`), hand.id, anchors[1], anchors[2])
    Object.assign(claw, { x: 0, y: 0, z: 0, ...clawRotation,
      pivotX: (anchors[2][0] - clawCrop.left) / clawCrop.width,
      pivotY: (anchors[2][1] - clawCrop.top) / clawCrop.height,
      attachment: { type: 'joint', targetId: hand.id, followRotation: true } })
    claw.visual.textureFit = 'stretch'
    joints.get(`${side}-bow`).z = 0
  }
  const gripCenter = palmContacts[0].clone().add(palmContacts[1]).multiplyScalar(.5)
  Object.assign(weapon, { y: gripCenter.y - palmClearance, z: gripCenter.z })
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
