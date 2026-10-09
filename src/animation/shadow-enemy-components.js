import assets from './enemy-component-assets.json' with { type: 'json' }
import { arrangeMossArmsAndJaw } from './shadow-moss-colossus.js'
import { fitTransparentBeastPanels } from './shadow-beast-barrels.js'
export { fitTransparentBeastPanels } from './shadow-beast-barrels.js'
import { applyEnemyComponentBatch2 } from './shadow-enemy-components-batch2.js'
export { BATCH2_COMPONENT_ENEMY_IDS } from './shadow-enemy-components-batch2.js'
import { applyEnemyComponentBatch3 } from './shadow-enemy-components-batch3.js'
export { BATCH3_COMPONENT_ENEMY_IDS } from './shadow-enemy-components-batch3.js'
import { applyEnemyComponentBatch4 } from './shadow-enemy-components-batch4.js'
export { BATCH4_COMPONENT_ENEMY_IDS } from './shadow-enemy-components-batch4.js'
import { applyEnemyComponentBatch5, adjustPatrolHoundRig, adjustSalamanderBody, alignSalamanderChest, adjustRotSacToadPose, reconnectSalamanderRig, reconnectRotSacToadRig } from './shadow-enemy-components-batch5.js'
export { BATCH5_COMPONENT_ENEMY_IDS, adjustPatrolHoundRig, adjustSalamanderBody, alignSalamanderChest, adjustRotSacToadPose, reconnectSalamanderRig, reconnectRotSacToadRig } from './shadow-enemy-components-batch5.js'
import {
  createDefaultShadowProject, createShadowBone, createShadowJoint, createShadowPart,
  shadowTargetKey, upsertShadowKeyframe, shadowTransformMatrix,
} from './shadow-rig.js'

export const COMPONENT_ENEMY_IDS = Object.freeze(Object.keys(assets))

export function widenEnemyComponentRig(project) {
  if (!['gnawer', 'tide-shadow-cub'].includes(project.enemyId)) return
  if (!project.parts.some(p => p.visual?.texture?.startsWith(`/assets/enemies/components-v1/${project.enemyId}/`))) return
  const root = project.joints.find(j => j.id === 'root')
  // Scale the whole local-X chain before the root's display rotation. Every
  // hinge and texture receives the same transform, even in animated poses.
  if (root) root.scaleX = (root.scaleX ?? 1) * 1.15
}

// Shift the elbow chain, keeping the forearm and its cropped hand together.
// Used once by both fresh templates and the V10 -> V11 saved-rig migration.
export function offsetGnawerForearms(project) {
  if (project.enemyId !== 'gnawer') return
  for (const side of ['left', 'right']) {
    const elbow = project.joints.find(j => j.id === `${side}-elbow`)
    const forearm = project.parts.find(p => p.id === `${side}-forearm`)
    if (!elbow || forearm?.attachment.targetId !== elbow.id
      || !forearm.visual?.texture?.startsWith('/assets/enemies/components-v1/gnawer/')) continue
    elbow.y -= 3
    elbow.z += 3
  }
}

export function alignGnawerRestPose(project, previousArtPackVersion = null) {
  if (project.enemyId !== 'gnawer') return
  const joints = new Map(project.joints.map(joint => [joint.id, joint]))
  const root = joints.get('root')
  const migratingSavedRig = previousArtPackVersion !== null
  if (root) root.y += migratingSavedRig ? 6 : 12
  for (const id of ['left-shoulder', 'right-shoulder']) {
    const shoulder = joints.get(id)
    if (shoulder) shoulder.z = 14
  }
  for (const id of ['left-hip', 'right-hip']) {
    const hip = joints.get(id)
    if (hip) {
      if (!migratingSavedRig) hip.y -= 6
      hip.z = 6
    }
  }
  for (const side of ['left', 'right']) {
    const knee = joints.get(`${side}-knee`)
    const hock = joints.get(`${side}-hock`)
    if (knee) knee.y -= 6
    if (hock) hock.y += 6
    const thigh = project.parts.find(part => part.id === `${side}-thigh`)
    if (thigh) thigh.height += 6
  }
  for (const side of ['left', 'right']) for (const suffix of ['knee', 'hock', 'ankle']) {
    const joint = joints.get(`${side}-${suffix}`)
    if (joint) joint.z = .25
  }
  for (const side of ['left', 'right']) {
    const legTexture = side === 'left' ? '008' : '009'
    for (const partId of [`${side}-shin`, `${side}-foot`]) {
      const part = project.parts.find(entry => entry.id === partId)
      if (part?.visual?.texture?.endsWith('/part_012.png')) {
        const legacySize = assets.gnawer.parts[12]
        const legSize = assets.gnawer.parts[Number(legTexture)]
        part.width *= legSize.width / legacySize.width
        part.height *= legSize.height / legacySize.height
        part.visual = { ...part.visual, texture: part.visual.texture.replace('/part_012.png', `/part_${legTexture}.png`) }
      }
    }
  }
}

// Apply once to fresh templates and pre-V23 editor projects.
export function adjustEnemyComponentSpacing(project) {
  if (project.enemyId === 'gnawer') {
    const pelvis = project.parts.find(part => part.id === 'pelvis-shell')
    if (pelvis) pelvis.y += 4
  } else if (project.enemyId === 'rootrot-bud') {
    const bud = project.joints.find(joint => joint.id === 'bud')
    if (bud) {
      bud.y -= 8
      bud.z += 1.5
    }
    for (const side of ['left', 'right']) {
      const root = project.joints.find(joint => joint.id === `${side}-root`)
      if (root) root.z += 1.5
    }
  } else if (project.enemyId === 'tide-shadow-cub') {
    for (const side of ['left', 'right']) {
      const sign = side === 'left' ? -1 : 1
      const fin = project.joints.find(joint => joint.id === `${side}-fin-hinge`)
      const arm = project.joints.find(joint => joint.id === `${side}-arm-hinge`)
      if (fin) {
        fin.z = -17
        fin.x += sign * 6
      }
      if (arm) {
        arm.z = 11
        arm.rotationZ += sign * 12
      }
    }
  }
}

// V24: rotate connected arm chains so the artwork follows the bent bones.
export function adjustEnemyUpperBodyPose(project) {
  if (project.enemyId === 'gnawer') {
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      const shoulder = project.joints.find(joint => joint.id === `${side}-shoulder`)
      const elbow = project.joints.find(joint => joint.id === `${side}-elbow`)
      if (shoulder) shoulder.rotationZ += sign * 24
      if (elbow) elbow.rotationZ -= sign * 58
    }
  } else if (project.enemyId === 'tide-shadow-cub') {
    const head = project.joints.find(joint => joint.id === 'head')
    const eye = project.joints.find(joint => joint.id === 'eye-hinge')
    if (head) head.y -= 10
    if (eye) eye.z += 1.5
  }
}

// V25: in a frontal +Z-facing pose, the character's right is negative X.
export function adjustRotWalkerLimbs(project) {
  if (project.enemyId !== 'rot-walker') return
  const rightArm = project.joints.find(joint => joint.id === 'left-shoulder')
  const leftLeg = project.joints.find(joint => joint.id === 'rot-stilt-root')
  if (rightArm) rightArm.z = 11
  if (leftLeg) leftLeg.x += 8
}

// V32: expose the neck and place foot joints at their painted sockets.
export function adjustRotWalkerFeetAndNeck(project) {
  if (project.enemyId !== 'rot-walker') return
  const neck = project.joints.find(joint => joint.id === 'neck')
  const head = project.joints.find(joint => joint.id === 'head')
  if (neck) { neck.y += 8; neck.z -= 4 }
  if (head) { head.y += 8; head.z -= 5 }
  // Move each ankle to its painted socket and compensate the cropped foot
  // pivot, keeping the rest-pose artwork in exactly the same place.
  for (const [jointId, partId, anchor] of [['left-ankle', 'left-foot', [.70, .77]], ['rot-stilt-tip', 'rot-stilt-end', [.46, .86]]]) {
    const joint = project.joints.find(joint => joint.id === jointId)
    const part = project.parts.find(part => part.id === partId)
    if (!joint || !part) continue
    const crop = part.visual.textureFrame.crop
    const pivotX = (anchor[0] - crop.left) / crop.width
    const pivotY = (anchor[1] - crop.top) / crop.height
    const dx = (pivotX - part.pivotX) * part.width
    const dy = -(pivotY - part.pivotY) * part.height
    const m = shadowTransformMatrix(joint).multiply(shadowTransformMatrix(part)).elements
    joint.x += m[0] * dx + m[4] * dy
    joint.y += m[1] * dx + m[5] * dy
    joint.z += m[2] * dx + m[6] * dy
    Object.assign(part, { pivotX, pivotY })
  }
}

export function alignRotWalkerFootContacts(project) {
  if (project.enemyId !== 'rot-walker') return
  for (const [partId, toeX] of [['left-foot', .10], ['rot-stilt-end', .91]]) {
    const part = project.parts.find(part => part.id === partId)
    const contact = project.joints.find(joint => joint.id === `${partId}-ground-contact`)
    if (!part || !contact) continue
    const crop = part.visual.textureFrame.crop
    const x = ((toeX - crop.left) / crop.width - part.pivotX) * part.width
    const y = (part.pivotY - (.93 - crop.top) / crop.height) * part.height
    const m = shadowTransformMatrix(part).elements
    contact.x = m[0] * x + m[4] * y + m[12]
    contact.z = m[2] * x + m[6] * y + m[14]
  }
}

// V33: the character's left stilt leg belongs in front of the torso.
export function bringRotWalkerLeftLegForward(project) {
  if (project.enemyId !== 'rot-walker') return
  const leg = project.joints.find(joint => joint.id === 'rot-stilt-root')
  if (leg) leg.z = 7
}

// V36: move the character-left support leg farther away from the pelvis.
export function widenRotWalkerLeftLeg(project) {
  if (project.enemyId !== 'rot-walker') return
  const leg = project.joints.find(joint => joint.id === 'rot-stilt-root')
  if (leg) leg.x += 6
}

// V37: the character-left arm is the legacy right-arm chain at positive X.
export function tightenRotWalkerArms(project) {
  if (project.enemyId !== 'rot-walker') return
  const leftShoulder = project.joints.find(j => j.id === 'right-arm-root')
  if (leftShoulder) leftShoulder.x -= 10
  for (const id of ['left-shoulder', 'left-elbow', 'left-wrist', 'right-arm-root', 'right-arm-hinge', 'right-arm-tip']) {
    const joint = project.joints.find(j => j.id === id)
    if (joint) joint.z *= .5
  }
}

// V38 repairs mirrors already clamped to 0.01 by older save normalization.
export function restoreFourArmMirrors(project) {
  const ids = project.enemyId === 'moss-colossus' ? ['right-arm-shoulder', 'right-secondary-shoulder']
    : project.enemyId === 'revenant-guard' ? ['right-secondary-shoulder'] : []
  for (const id of ids) {
    const shoulder = project.joints.find(j => j.id === id)
    if (shoulder && shoulder.scaleX >= 0) shoulder.scaleX = -Math.max(1, shoulder.scaleX)
  }
  if (project.enemyId === 'moss-colossus') {
    for (const id of ['neck', 'head']) {
      const joint = project.joints.find(j => j.id === id)
      if (joint) { joint.x = 0; joint.rotationZ = 0 }
    }
    const head = project.parts.find(p => p.id === 'head-art')
    if (head) head.rotationZ = 0
  }
}

// Add the two unused claw assets as lower arms; keep saved main-arm edits.
export function addRevenantSecondaryArms(project) {
  if (project.enemyId !== 'revenant-guard') return
  for (const [side, sign, n] of [['left', 1, 18], ['right', -1, 23]]) {
    const id = `${side}-secondary`
    if (project.joints.some(j => j.id === `${id}-shoulder`)) continue
    joint(project, `${id}-shoulder`, `${sign > 0 ? '左' : '右'}副臂肩`, 'root', sign * 34, -49, 3)
    const shoulder = project.joints.find(j => j.id === `${id}-shoulder`)
    Object.assign(shoulder, { rotationZ: sign * 42, scaleX: sign })
    const anchors = n === 18 ? [[.35, .08], [.48, .44], [.57, .70]] : [[.62, .10], [.48, .42], [.39, .64]]
    let target = shoulder.id
    for (let i = 0; i < anchors.length; i++) {
      if (i) {
        const next = `${id}-${i === 1 ? 'elbow' : 'wrist'}`
        pixelLink(project, next, i === 1 ? '副臂肘' : '副臂腕', target, n, .23, anchors[i - 1], anchors[i], .25)
        target = next
      }
      imagePart(project, `${id}-${['upper', 'forearm', 'hand'][i]}`, ['副臂上段', '副臂前臂', '副臂骨爪'][i], n, target, .23, anchors[i],
        { crop: [[0, 0, 1, .51], [0, .37, 1, .39], [0, .60, 1, .40]][i], layer: 8 + i })
      organMotion(project, target, i % 2 ? -sign : sign, i ? 9 : 7)
    }
  }
}

export function exposeFourArmLayouts(project) {
  if (project.enemyId === 'revenant-guard') {
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      const shoulder = project.joints.find(j => j.id === `${side}-shoulder`)
      if (shoulder) { shoulder.z = 3; shoulder.rotationZ += sign * 20 }
      const leg = project.joints.find(j => j.id === `${side}-leg`)
      if (leg) leg.x += sign * 14
    }
  }
  if (project.enemyId === 'tide-rite-matriarch') {
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      const main = project.joints.find(j => j.id === `${side}-arm`)
      const secondary = project.joints.find(j => j.id === `${side}-prayer`)
      const veil = project.joints.find(j => j.id === `${side}-veil`)
      if (main) { main.z = 4; main.rotationZ += sign * 45 }
      if (secondary) { secondary.x += sign * 11; secondary.y -= 34; secondary.z = 5; secondary.rotationZ += sign * 6 }
      if (veil) { veil.x += sign * 44; veil.rotationZ += sign * 35 }
    }
  }
}

// V26: splay the armor at its own pivot, leaving room for the hanging arms.
export function adjustShellguardStance(project) {
  if (project.enemyId !== 'shellguard') return
  for (const [side, sign] of [['left', -1], ['right', 1]]) {
    const pauldron = project.parts.find(part => part.id === `${side}-pauldron`)
    const foot = project.joints.find(joint => joint.id === `${side}-coffin-root-root`)
    if (pauldron) pauldron.rotationZ += sign * 18
    if (foot) foot.x += sign * 12
  }
}

// V29: swing both leaf arms away from the face, keeping their sockets fixed.
export function adjustRootrotHands(project) {
  if (project.enemyId !== 'rootrot-bud') return
  for (const [side, sign] of [['left', -1], ['right', 1]]) {
    const hand = project.joints.find(joint => joint.id === `${side}-petal`)
    if (hand) hand.rotationZ -= sign * 12
  }
}

// V30: retain a small neck/head depth gap and move the face/eye chain together.
export function adjustTideCubHeadDepth(project) {
  if (project.enemyId !== 'tide-shadow-cub') return
  const head = project.joints.find(joint => joint.id === 'head')
  if (head) head.z -= 6
}

// V31: open the elytra outboard, with the raised outer tips toward the tail.
export function openBeetleElytra(project) {
  if (project.enemyId !== 'beetle-guard') return
  for (const [side, sign] of [['left', -1], ['right', 1]]) {
    const hinge = project.joints.find(joint => joint.id === `${side}-gate-hinge`)
    const tip = project.joints.find(joint => joint.id === `${side}-gate-tip`)
    const wing = project.parts.find(part => part.id === `${side}-gate-sheet`)
    if (!hinge || !tip || !wing) continue
    hinge.x = sign * 32
    Object.assign(wing, { rotationX: 100, rotationY: 0, rotationZ: sign * 20 })
    // Match the bone endpoint to the visible outer rear corner of the PNG.
    const x = ((sign < 0 ? .1 : .9) - wing.pivotX) * wing.width
    const y = (wing.pivotY - .92) * wing.height
    const m = shadowTransformMatrix(wing).elements
    tip.x = m[0] * x + m[4] * y + m[12]
    tip.y = m[1] * x + m[5] * y + m[13]
    tip.z = m[2] * x + m[6] * y + m[14]
  }
}

// V37: front is +Z. Tilt whole textured leg chains at their body sockets;
// matching X rotations keep each left/right pair facing the same direction.
export function splayCrawlerEndLegs(project) {
  const last = project.enemyId === 'nest-spider' ? 3 : project.enemyId === 'beetle-guard' ? 2 : null
  if (last === null) return
  const tilt = project.enemyId === 'nest-spider' ? 25 : 18
  for (const [index, direction] of [[0, 1], [last, -1]]) {
    for (const side of ['left', 'right']) {
      const coxa = project.joints.find(j => j.id === `${side}-leg-${index}-coxa`)
      if (coxa) coxa.rotationX = -direction * tilt
    }
  }
}

export function alignBeetleHornTip(project) {
  if (project.enemyId !== 'beetle-guard') return
  const tip = project.joints.find(j => j.id === 'battering-horn-tip')
  const horn = project.parts.find(p => p.id === 'battering-horn-sheet')
  if (!tip || horn?.attachment.type !== 'joint') return
  const bone = project.bones.find(b => b.toJointId === tip.id)
  if (bone) bone.fromJointId = horn.attachment.targetId
  // Opaque apex of part_005: center of pixels 106..108 on its top row.
  const crop = horn.visual.textureFrame.crop
  const x = ((107.5 / 216 - crop.left) / crop.width - horn.pivotX) * horn.width
  const y = (horn.pivotY + crop.top / crop.height) * horn.height
  const m = shadowTransformMatrix(horn).elements
  Object.assign(tip, { x: m[0] * x + m[4] * y + m[12], y: m[1] * x + m[5] * y + m[13], z: m[2] * x + m[6] * y + m[14] })
  // The old geometric tip had its own translation tracks although the PNG
  // turns with the hinge. Keep their positions together throughout animation.
  for (const animation of Object.values(project.animations)) {
    for (const frame of animation.tracks[`joint:${tip.id}`] || []) Object.assign(frame, { dx: 0, dy: 0, dz: 0 })
  }
}

export function alignEnemyFrontalSkeleton(project) {
  if (!['gnawer', 'rootrot-bud', 'beetle-guard', 'shellguard'].includes(project.enemyId)) return
  const joints = new Map(project.joints.map(joint => [joint.id, joint]))
  const mirror = (left, right, field) => {
    const value = ((left[field] ?? 0) - (right[field] ?? 0)) / 2
    left[field] = value
    right[field] = -value
  }
  const match = (left, right, field) => {
    const fallback = field === 'scaleX' ? 1 : 0
    left[field] = right[field] = ((left[field] ?? fallback) + (right[field] ?? fallback)) / 2
  }
  // Mirror full local transforms, so every descendant and bone direction
  // remains symmetric about the character's central sagittal plane.
  for (const left of project.joints.filter(j => j.id.startsWith('left-'))) {
    const right = joints.get(left.id.replace(/^left-/, 'right-'))
    if (!right) continue
    for (const field of ['x', 'rotationY', 'rotationZ']) mirror(left, right, field)
    for (const field of ['y', 'z', 'rotationX', 'scaleX']) match(left, right, field)
  }
  const parts = new Map(project.parts.map(part => [part.id, part]))
  for (const left of project.parts.filter(part => part.id.startsWith('left-'))) {
    const right = parts.get(left.id.replace(/^left-/, 'right-'))
    if (!right) continue
    for (const field of ['x', 'rotationY', 'rotationZ']) mirror(left, right, field)
    for (const field of ['y', 'z', 'rotationX', 'width', 'height', 'pivotY']) match(left, right, field)
    left.pivotX = ((left.pivotX ?? .5) + 1 - (right.pivotX ?? .5)) / 2
    right.pivotX = 1 - left.pivotX
  }
}

function rigImageSize(project, number) {
  const pairs = project.enemyId === 'gnawer' ? [[4, 5], [13, 14], [8, 9], [10, 11]]
    : project.enemyId === 'rootrot-bud' ? [[2, 3], [13, 14]]
      : project.enemyId === 'beetle-guard' ? [[1, 2], [15, 20], [16, 19], [17, 18]]
        : project.enemyId === 'shellguard' ? [[1, 2], [7, 9], [15, 16], [17, 18], [11, 13]] : []
  const pair = pairs.find(pair => pair.includes(number))
  const source = assets[project.enemyId].parts
  if (!pair) return source[number]
  return { width: (source[pair[0]].width + source[pair[1]].width) / 2,
    height: (source[pair[0]].height + source[pair[1]].height) / 2 }
}

function joint(p, id, name, parent, x, y, z = 0) {
  const existing = p.joints.find((j) => j.id === id)
  if (existing) {
    Object.assign(existing, { name, x, y, z })
    const bone = p.bones.find((b) => b.toJointId === id)
    if (bone && parent) bone.fromJointId = parent
  }
  else {
    p.joints.push(createShadowJoint({ id, name, x, y, z }))
    if (parent) p.bones.push(createShadowBone({ id: `component-${parent}-${id}`, name, fromJointId: parent, toJointId: id }))
  }
}

// Anchor and crop are normalized coordinates in the original split PNG.
// Keeping its pixel scale makes adjacent cropped segments meet at the hinge.
function imagePart(p, id, name, number, target, scale, anchor = [.5, .5], options = {}) {
  const { crop = [0, 0, 1, 1], ...transform } = options
  const gnawerLegArt = p.enemyId === 'gnawer'
    ? { 'left-shin': 8, 'left-foot': 8, 'right-shin': 9, 'right-foot': 9 }[id]
    : undefined
  const sourceNumber = gnawerLegArt ?? number
  const { width, height } = rigImageSize(p, sourceNumber)
  const [left, top, cw, ch] = crop
  const entry = createShadowPart({ id, name, shape: 'rect', depth: 0,
    width: width * cw * scale, height: height * ch * scale,
    pivotX: (anchor[0] - left) / cw, pivotY: (anchor[1] - top) / ch,
    fill: '#ffffff', stroke: '#22272b', layer: 5, ...transform,
    attachment: { type: 'joint', targetId: target, followRotation: true, t: .5 },
  })
  entry.visual = { type: 'texture', texture: `/assets/enemies/components-v1/${p.enemyId}/part_${String(sourceNumber).padStart(3, '0')}.png`,
    textureFit: 'contain', textureFrame: { columns: 1, rows: 1, column: 0, row: 0, crop: { left, top, width: cw, height: ch } } }
  p.parts.push(entry)
  return entry
}

function pixelLink(p, id, name, parent, number, scale, from, to, z = 0) {
  const a = rigImageSize(p, number)
  joint(p, id, name, parent, (to[0] - from[0]) * a.width * scale, -(to[1] - from[1]) * a.height * scale, z)
}

function keys(p, action, id, frames, kind = 'joint') {
  const duration = p.animations[action].duration
  for (const [fraction, pose] of frames) upsertShadowKeyframe(p, action, shadowTargetKey(kind, id), Math.round(duration * fraction), pose)
}

function organMotion(p, id, sign = 1, amplitude = 10) {
  keys(p, 'idle', id, [[0, {}], [.55, { rotationZ: sign * amplitude * .3, rotationY: sign * 4 }], [1, {}]])
  keys(p, 'move', id, [[0, {}], [.3, { rotationZ: sign * amplitude, rotationX: 8 }], [.8, { rotationZ: -sign * amplitude * .7, rotationX: -5 }], [1, {}]])
  keys(p, 'attack', id, [[0, {}], [.27, { rotationZ: -sign * amplitude, rotationY: -sign * 9 }], [.64, { rotationZ: sign * amplitude * 1.5, rotationY: sign * 12 }], [1, {}]])
  keys(p, 'hit', id, [[0, {}], [.3, { rotationZ: -sign * amplitude * 1.5, rotationX: 10 }], [1, {}]])
  keys(p, 'death', id, [[0, {}], [.4, { rotationZ: sign * amplitude }], [1, { rotationZ: sign * amplitude * 2, rotationX: -20 }]])
}

function gnawer(p) {
  p.parts = []
  joint(p, 'neck', '颈', 'root', 0, 57, 8)
  joint(p, 'head', '头颅', 'neck', 0, 33, 8)
  // The source already has eyes and a jaw. Split that jaw rather than adding a second face.
  imagePart(p, 'skull', '颅骨与鬃毛', 1, 'head', .29, [.5, .57], { crop: [0, 0, 1, .75], layer: 9 })
  pixelLink(p, 'jaw', '下颌', 'head', 1, .29, [.5, .57], [.5, .74])
  imagePart(p, 'jaw-shell', '下颌骨', 1, 'jaw', .29, [.5, .74], { crop: [.2, .72, .6, .28], layer: 10, z: .2 })
  imagePart(p, 'collar', '锁骨披肩', 3, 'root', .34, [.5, .65], { y: 46, z: 1, layer: 8 })
  imagePart(p, 'left-ribs', '左肋骨', 11, 'root', .25, [.5, .3], { x: -29, y: 24, layer: 6 })
  imagePart(p, 'right-ribs', '右肋骨', 10, 'root', .25, [.5, .3], { x: 29, y: 24, layer: 6 })
  imagePart(p, 'sternum', '胸骨饰甲', 12, 'root', .25, [.5, .3], { y: 24, z: .5, layer: 7 })
  joint(p, 'pelvis', '骨盆', 'root', 0, -42, -5)
  imagePart(p, 'pelvis-shell', '骨盆', 15, 'pelvis', .28, [.5, .2], { layer: 7 })
  imagePart(p, 'coat', '破衣下摆', 18, 'pelvis', .25, [.5, .06], { y: -20, z: -3, layer: 3 })
  for (const [side, sign, arm, forearm, leg] of [['left', -1, 4, 14, 8], ['right', 1, 5, 13, 9]]) {
    const label = sign < 0 ? '左' : '右'
    joint(p, `${side}-shoulder`, `${label}肩`, 'root', sign * 48, 38, sign * 13)
    imagePart(p, `${side}-upper-arm`, `${label}上臂`, arm, `${side}-shoulder`, .23, [.5, .15], { layer: 5 })
    pixelLink(p, `${side}-elbow`, `${label}肘`, `${side}-shoulder`, arm, .23, [.5, .15], [.5, .88])
    const wrist = [.5, .56]
    imagePart(p, `${side}-forearm`, `${label}前臂`, forearm, `${side}-elbow`, .23, [.5, .1], { crop: [0, 0, 1, .61], layer: 6 })
    pixelLink(p, `${side}-wrist`, `${label}腕`, `${side}-elbow`, forearm, .23, [.5, .1], wrist)
    imagePart(p, `${side}-palm`, `${label}手爪`, forearm, `${side}-wrist`, .23, wrist, { crop: [0, .53, 1, .47], layer: 7 })
    const hip = sign < 0 ? [.66, .05] : [.34, .05]
    const knee = sign < 0 ? [.69, .39] : [.31, .39]
    const hock = sign < 0 ? [.7, .59] : [.3, .59]
    const ankle = sign < 0 ? [.55, .82] : [.45, .82]
    joint(p, `${side}-hip`, `${label}髋`, 'pelvis', sign * 25, -6, sign * 10)
    imagePart(p, `${side}-thigh`, `${label}大腿`, leg, `${side}-hip`, .17, hip, { crop: [0, 0, 1, .42], layer: 4 })
    pixelLink(p, `${side}-knee`, `${label}膝`, `${side}-hip`, leg, .17, hip, knee)
    imagePart(p, `${side}-knee-guard`, `${label}膝甲与中节`, leg, `${side}-knee`, .17, knee, { crop: [0, .36, 1, .26], layer: 5 })
    // The AI produced an extra lower-leg segment; give it a real hock instead of stretching two bones.
    pixelLink(p, `${side}-hock`, `${label}跗节`, `${side}-knee`, leg, .17, knee, hock)
    const ankleBone = p.bones.find((b) => b.toJointId === `${side}-ankle`)
    ankleBone.fromJointId = `${side}-hock`
    pixelLink(p, `${side}-ankle`, `${label}踝`, `${side}-hock`, leg, .17, hock, ankle)
    imagePart(p, `${side}-shin`, `${label}胫骨`, leg, `${side}-hock`, .17, hock, { crop: [0, .56, 1, .29], layer: 6 })
    imagePart(p, `${side}-foot`, `${label}足爪`, leg, `${side}-ankle`, .17, ankle, { crop: [0, .79, 1, .21], layer: 7 })
    organMotion(p, `${side}-hock`, sign, 9)
  }
  offsetGnawerForearms(p)
}

function moth(p) {
  p.parts = []
  imagePart(p, 'thorax', '胸甲', 9, 'root', .23, [.5, .42], { layer: 8 })
  joint(p, 'head', '角首', 'root', 0, 55, 18)
  imagePart(p, 'head-shell', '角首外壳', 3, 'head', .2, [.5, .65], { layer: 10 })
  imagePart(p, 'left-eye', '左复眼', 4, 'head', .16, [.5, .5], { x: -20, y: -1, z: .5, layer: 11 })
  imagePart(p, 'right-eye', '右复眼', 5, 'head', .16, [.5, .5], { x: 20, y: -1, z: .5, layer: 11 })
  joint(p, 'abdomen', '腹节', 'root', 0, -38, -10)
  imagePart(p, 'abdomen-shell', '环节腹部', 8, 'abdomen', .23, [.5, .08], { layer: 6 })
  joint(p, 'tail', '尾甲', 'abdomen', 0, -61, -3)
  imagePart(p, 'tail-flame', '尾端甲', 11, 'tail', .18, [.5, .1], { layer: 7 })
  for (const [side, sign, wing, mandible] of [['left', -1, 1, 7], ['right', 1, 2, 6]]) {
    const label = sign < 0 ? '左' : '右'
    const root = sign < 0 ? [.9, .22] : [.1, .22]
    const hinge = sign < 0 ? [.55, .22] : [.45, .22]
    joint(p, `${side}-wing`, `${label}翅根`, 'root', sign * 30, 28, -15)
    imagePart(p, `${side}-inner-wing`, `${label}内翅硬甲`, wing, `${side}-wing`, .25, root,
      { crop: sign < 0 ? [.5, 0, .5, 1] : [0, 0, .5, 1], layer: 3 })
    pixelLink(p, `${side}-wing-elbow`, `${label}翅铰链`, `${side}-wing`, wing, .25, root, hinge)
    imagePart(p, `${side}-outer-wing`, `${label}外翅垂膜`, wing, `${side}-wing-elbow`, .25, hinge,
      { crop: sign < 0 ? [0, 0, .58, 1] : [.42, 0, .58, 1], layer: 4 })
    pixelLink(p, `${side}-wing-tip`, `${label}翅尖`, `${side}-wing-elbow`, wing, .25, hinge, [sign < 0 ? .1 : .9, .9])
    joint(p, `${side}-mandible-hinge`, `${label}颚根`, 'head', sign * 10, -22, 1)
    imagePart(p, `${side}-mandible`, `${label}颚钩`, mandible, `${side}-mandible-hinge`, .19, [.5, .1], { layer: 12 })
    organMotion(p, `${side}-mandible-hinge`, sign, 14)
    for (let i = 0; i < 3; i++) {
      const id = `${side}-leg-${i}`
      const number = sign < 0 ? [13, 15, 16][i] : [12, 14, 17][i]
      const a = sign < 0 ? [.73, .14] : [.27, .14]
      const b = sign < 0 ? [.3, .36] : [.7, .36]
      const c = sign < 0 ? [.53, .68] : [.47, .68]
      joint(p, id, `${label}足根 ${i + 1}`, 'root', sign * (24 + i * 8), -11 - i * 22, 4 + i * 5)
      imagePart(p, `${id}-part`, `${label}足股节 ${i + 1}`, number, id, .16, a, { crop: [0, 0, 1, .43], layer: 5 })
      pixelLink(p, `${id}-knee`, `${label}足膝 ${i + 1}`, id, number, .16, a, b)
      imagePart(p, `${id}-lower`, `${label}足胫节 ${i + 1}`, number, `${id}-knee`, .16, b, { crop: [0, .3, 1, .44], layer: 6 })
      joint(p, `${id}-tip`, `${label}足爪 ${i + 1}`, `${id}-knee`, 0, 0, 0)
      const bone = p.bones.find((entry) => entry.toJointId === `${id}-tip`)
      bone.fromJointId = `${id}-knee`
      pixelLink(p, `${id}-tip`, `${label}足爪 ${i + 1}`, `${id}-knee`, number, .16, b, c)
      imagePart(p, `${id}-claw`, `${label}爪尖 ${i + 1}`, number, `${id}-tip`, .16, c, { crop: [0, .62, 1, .38], layer: 7 })
      organMotion(p, `${id}-knee`, sign * (i % 2 ? -1 : 1), 8)
    }
  }
}

function bud(p) {
  // One eye-bud, one stem and one root bulb. The open crown, alternate
  // stump, small leaves and extra claws are alternatives, not overlays.
  p.joints = []; p.bones = []; p.parts = []
  p.animations = createDefaultShadowProject().animations
  joint(p, 'root', '\u6839\u7403', null, 0, 0)
  imagePart(p, 'bulb', '\u6839\u7403\u57fa\u5ea7', 12, 'root', .23, [.5, .14], { layer: 5 })
  joint(p, 'lower-stem', '\u4e3b\u830e\u6839\u90e8', 'root', 0, 10, -1)
  // Crop the hanging root fringe: it would cover the bulb and walking roots.
  imagePart(p, 'lower-stem-part', '\u4e3b\u830e', 8, 'lower-stem', .27, [.5, .64],
    { crop: [0, 0, 1, .68], layer: 6 })
  pixelLink(p, 'upper-stem', '\u4e3b\u830e\u9876\u90e8', 'lower-stem', 8, .27, [.5, .64], [.5, .07])
  joint(p, 'bud', '\u773c\u82bd', 'upper-stem', 0, 5, 1)
  imagePart(p, 'bud-shell', '\u95ed\u5408\u773c\u82bd', 6, 'bud', .25, [.5, .68], { layer: 10 })
  for (const [side, sign] of [['left', -1], ['right', 1]]) {
    const label = sign < 0 ? '左' : '右'
    const leaf = sign < 0 ? 2 : 3
    const base = sign < 0 ? [.92, .88] : [.08, .88]
    const hinge = sign < 0 ? [.6, .56] : [.4, .56]
    joint(p, `${side}-petal`, `${label}叶柄`, 'lower-stem', sign * 26, 30, 1)
    imagePart(p, `${side}-petal-part`, `${label}叶根`, leaf, `${side}-petal`, .24, base, { crop: [0, .5, 1, .5], layer: 7 })
    pixelLink(p, `${side}-petal-tip`, `${label}叶中脉`, `${side}-petal`, leaf, .24, base, hinge)
    imagePart(p, `${side}-petal-tip-part`, `${label}大叶尖`, leaf, `${side}-petal-tip`, .24, hinge, { crop: [0, 0, 1, .6], layer: 8 })
    // Part 14 spreads left; part 13 spreads right. Follow their real sockets
    // and branch points instead of making both root bones point straight down.
    const root = sign < 0 ? 14 : 13
    const socket = sign < 0 ? [.78, .12] : [.22, .12]
    const claw = sign < 0 ? [.24, .64] : [.76, .64]
    joint(p, `${side}-root`, `${label}行根`, 'root', sign * 34, -28, -1)
    imagePart(p, `${side}-root-part`, `${label}行根`, root, `${side}-root`, .19, socket, { crop: [0, 0, 1, .7], layer: 4 })
    pixelLink(p, `${side}-root-tip`, `${label}根爪`, `${side}-root`, root, .19, socket, claw, .25)
    imagePart(p, `${side}-root-tip-part`, `${label}根爪`, root, `${side}-root-tip`, .19, claw,
      { crop: [0, .55, 1, .45], layer: 6 })
    organMotion(p, `${side}-petal`, sign, 8)
    keys(p, 'move', `${side}-root`, [[0, {}], [.25, { rotationX: sign * 12 }], [.75, { rotationX: -sign * 12 }], [1, {}]])
    keys(p, 'move', `${side}-root-tip`, [[0, {}], [.25, { rotationX: -sign * 8 }], [.75, { rotationX: sign * 8 }], [1, {}]])
    keys(p, 'attack', `${side}-petal`, [[0, {}], [.27, { rotationZ: -sign * 10 }], [.64, { rotationZ: sign * 18 }], [1, {}]])
    keys(p, 'death', `${side}-petal`, [[0, {}], [.4, { rotationZ: sign * 18 }], [1, { rotationZ: sign * 55 }]])
  }
  keys(p, 'idle', 'root', [[0, {}], [.55, { dy: 1 }], [1, {}]])
  keys(p, 'idle', 'lower-stem', [[0, {}], [.55, { rotationX: 2 }], [1, {}]])
  keys(p, 'idle', 'bud', [[0, {}], [.55, { rotationX: -3 }], [1, {}]])
  keys(p, 'move', 'root', [[0, {}], [.25, { dy: 3 }], [.5, {}], [.75, { dy: 3 }], [1, {}]])
  keys(p, 'move', 'lower-stem', [[0, {}], [.25, { rotationX: -4 }], [.75, { rotationX: 4 }], [1, {}]])
  keys(p, 'attack', 'root', [[0, {}], [.27, { dz: -2 }], [.64, { dz: 4 }], [1, {}]])
  keys(p, 'attack', 'lower-stem', [[0, {}], [.27, { rotationX: -12 }], [.64, { rotationX: 17 }], [1, {}]])
  keys(p, 'attack', 'bud', [[0, {}], [.27, { rotationX: -7 }], [.64, { rotationX: 12 }], [1, {}]])
  keys(p, 'hit', 'root', [[0, {}], [.3, { dz: -8 }], [1, {}]])
  keys(p, 'hit', 'lower-stem', [[0, {}], [.3, { rotationX: -14 }], [1, {}]])
  keys(p, 'hit', 'bud', [[0, {}], [.3, { rotationX: -9 }], [1, {}]])
  keys(p, 'death', 'root', [[0, {}], [.4, { dy: -4 }], [1, { dy: -15 }]])
  keys(p, 'death', 'lower-stem', [[0, {}], [.4, { rotationX: 24 }], [1, { rotationX: 75 }]])
  keys(p, 'death', 'bud', [[0, {}], [.4, { rotationX: -6 }], [1, { rotationX: 18 }]])
}

function cub(p) {
  // This batch is a lantern apparition. Build suspended fins and cloth chains,
  // rather than attaching a cloak and spear to the old quadruped's paws.
  const blank = createDefaultShadowProject()
  p.joints = []; p.bones = []; p.parts = []; p.animations = blank.animations
  p.stage.floorOffset = 42
  joint(p, 'root', '悬浮灯核', null, 0, 0, 0)
  p.joints[0].rotationY = -30
  joint(p, 'neck', '面甲颈环', 'root', 0, 58, 10)
  joint(p, 'head', '潮骨面甲', 'neck', 0, 18, 8)
  imagePart(p, 'mask', '潮骨面甲', 5, 'head', .23, [.5, .55], { layer: 10 })
  imagePart(p, 'lantern', '胸腔灯笼', 6, 'root', .26, [.5, .3], { layer: 8 })
  joint(p, 'eye-hinge', '眼焰枢轴', 'head', 0, -4, 1)
  imagePart(p, 'eye', '潮眼', 12, 'eye-hinge', .17, [.5, .5], { layer: 11 })
  joint(p, 'cloak-hinge', '悬裾根', 'root', 0, -44, -9)
  joint(p, 'cloak-tip', '悬裾尾', 'cloak-hinge', 13, -47, -4)
  imagePart(p, 'cloak-upper', '悬裾上段', 14, 'cloak-hinge', .26, [.5, .1], { crop: [0, 0, 1, .55], layer: 6 })
  imagePart(p, 'cloak-lower', '悬裾下段', 14, 'cloak-tip', .26, [.63, .47], { crop: [0, .43, 1, .57], layer: 7 })
  joint(p, 'flame-hinge', '游焰根', 'cloak-tip', -7, -49, 6)
  joint(p, 'flame-tip', '游焰尾', 'flame-hinge', 0, -36, -7)
  imagePart(p, 'flame-tail', '游焰拖尾', 15, 'flame-hinge', .17, [.5, .13], { layer: 5 })
  for (const [side, sign, fin, cloth] of [['left', -1, 2, 9], ['right', 1, 3, 10]]) {
    const label = sign < 0 ? '左' : '右'
    const origin = sign < 0 ? [.83, .66] : [.17, .66]
    const hinge = sign < 0 ? [.58, .46] : [.42, .46]
    joint(p, `${side}-fin-hinge`, `${label}潮鳍根`, 'root', sign * 27, 25, sign * 17 - 8)
    imagePart(p, `${side}-fin-root`, `${label}潮鳍根片`, fin, `${side}-fin-hinge`, .23, origin, { crop: [0, .4, 1, .6], layer: 4 })
    pixelLink(p, `${side}-fin-tip`, `${label}潮鳍中节`, `${side}-fin-hinge`, fin, .23, origin, hinge)
    imagePart(p, `${side}-fin`, `${label}潮鳍外片`, fin, `${side}-fin-tip`, .23, hinge, { crop: [0, 0, 1, .53], layer: 5 })
    joint(p, `${side}-arm-hinge`, `${label}游裾环`, 'root', sign * 37, -4, sign * 11)
    const a = [.5, .05], b = [.5, .5]
    imagePart(p, `${side}-arm`, `${label}游裾上段`, cloth, `${side}-arm-hinge`, .17, a, { crop: [0, 0, 1, .57], layer: 7 })
    pixelLink(p, `${side}-arm-tip`, `${label}游裾末节`, `${side}-arm-hinge`, cloth, .17, a, b)
    imagePart(p, `${side}-arm-tail`, `${label}游裾尾段`, cloth, `${side}-arm-tip`, .17, b, { crop: [0, .44, 1, .56], layer: 8 })
    organMotion(p, `${side}-fin-hinge`, sign, 15)
    organMotion(p, `${side}-fin-tip`, -sign, 9)
    organMotion(p, `${side}-arm-hinge`, sign, 12)
    organMotion(p, `${side}-arm-tip`, -sign, 9)
  }
  for (const [id, sign, amplitude] of [['head', 1, 8], ['eye-hinge', -1, 4], ['cloak-hinge', 1, 9], ['cloak-tip', -1, 7], ['flame-hinge', 1, 11]]) organMotion(p, id, sign, amplitude)
  keys(p, 'idle', 'root', [[0, {}], [.5, { dy: 6, rotationX: 3 }], [1, {}]])
  keys(p, 'move', 'root', [[0, {}], [.25, { dy: 9, dz: 12 }], [.5, { dz: 24 }], [.75, { dy: -3, dz: 12 }], [1, {}]])
  keys(p, 'attack', 'root', [[0, {}], [.27, { dz: -14, rotationX: -12 }], [.64, { dz: 32, rotationX: 17 }], [1, {}]])
  keys(p, 'hit', 'root', [[0, {}], [.3, { dx: 18, dz: -18, rotationZ: 14 }], [1, {}]])
  keys(p, 'death', 'root', [[0, {}], [.4, { dy: -25, rotationX: 12 }], [1, { dy: -76, rotationZ: 55, rotationX: 25 }]])
}

function crawlers(p) {
  p.parts = []
  const spider = p.enemyId === 'nest-spider'
  imagePart(p, 'thorax', '胸甲', spider ? 5 : 3, 'root', spider ? .25 : .24, [.5, .5], { rotationX: -55, layer: 6 })
  imagePart(p, 'carapace', '腹部背壳', 4, 'abdomen', spider ? .22 : .25, [.5, .48], { rotationX: -55, layer: 5 })
  imagePart(p, 'head-shell', '头壳', spider ? 2 : 6, 'head', .25, [.5, .5], { rotationX: -30, layer: 8 })
  if (spider) {
    for (const [side, sign, number] of [['left', -1, 7], ['right', 1, 8]]) {
      joint(p, `${side}-fang-hinge`, `${sign < 0 ? '左' : '右'}毒颚根`, 'mandible', sign * 15, 0, 0)
      imagePart(p, `${side}-fang`, `${sign < 0 ? '左' : '右'}毒颚`, number, `${side}-fang-hinge`, .19, [.5, .1], { rotationX: -20, layer: 10 })
      organMotion(p, `${side}-fang-hinge`, sign, 14)
    }
  } else {
    // Eyes/mandibles are already in the head PNG. No duplicated facial overlays.
    imagePart(p, 'belly', '腹下护甲', 7, 'abdomen', .2, [.5, .5], { y: -7, rotationX: -55, layer: 4 })
    for (const [side, sign, n] of [['left', -1, 1], ['right', 1, 2]]) {
      joint(p, `${side}-gate-hinge`, `${sign < 0 ? '左' : '右'}盾门翅根`, 'abdomen', sign * 6, 17, 2)
      imagePart(p, `${side}-gate-sheet`, `${sign < 0 ? '左' : '右'}盾门鞘翅`, n, `${side}-gate-hinge`, .17,
        [sign < 0 ? .97 : .03, .2], { rotationX: -55, layer: 8 })
      // Gate motion pivots at the actual inner edge. The old tip translation pulled it off its hinge.
      organMotion(p, `${side}-gate-hinge`, sign, 12)
    }
    joint(p, 'battering-horn-hinge', '撞门角根', 'head', 0, 8, 8)
    imagePart(p, 'battering-horn-sheet', '撞门长角', 5, 'battering-horn-hinge', .18, [.5, .87], { rotationX: 35, layer: 10 })
    organMotion(p, 'battering-horn-hinge', 1, 10)
  }
  for (const [side, sign] of [['left', -1], ['right', 1]]) for (let i = 0; i < (spider ? 4 : 3); i++) {
    const id = `${side}-leg-${i}`
    const label = `${sign < 0 ? '左' : '右'}第${i + 1}足`
    if (spider) {
      // Three drawn pairs serve eight legs; the middle pair is reused at a different Z station.
      const number = sign > 0 ? [10, 12, 12, 15][i] : [11, 13, 13, 14][i]
      const proximal = sign > 0 ? [.12, .43] : [.88, .43]
      const knee = sign > 0 ? [.58, .28] : [.39, .28]
      const ankle = sign > 0 ? [.9, .57] : [.12, .57]
      const scale = .23
      pixelLink(p, `${id}-knee`, `${label}膝节`, `${id}-coxa`, number, scale, proximal, knee)
      pixelLink(p, `${id}-tip`, `${label}足尖`, `${id}-knee`, number, scale, knee, ankle)
      // The terminal claw is separately hinged at its visible disk.
      joint(p, `${id}-claw`, `${label}爪钩`, `${id}-tip`, 0, 0, 0)
      imagePart(p, `${id}-femur`, `${label}股节`, number, `${id}-coxa`, scale, proximal,
        { crop: sign > 0 ? [0, 0, .64, 1] : [.34, 0, .66, 1], layer: 4 })
      imagePart(p, `${id}-tibia`, `${label}胫节`, number, `${id}-knee`, scale, knee,
        { crop: sign > 0 ? [.57, 0, .36, 1] : [.08, 0, .34, 1], layer: 5 })
      imagePart(p, `${id}-claw-part`, `${label}爪钩`, number, `${id}-claw`, scale, ankle,
        { crop: sign > 0 ? [.85, .3, .15, .7] : [0, .3, .18, .7], layer: 6 })
      // Extend the leg plane down from a high knee. The texture and its hinge rotate together.
      p.joints.find((j) => j.id === `${id}-knee`).rotationZ = -sign * 80
      organMotion(p, `${id}-claw`, sign, 8)
    } else {
      const number = sign < 0 ? [15, 16, 17][i] : [20, 19, 18][i]
      const a = sign < 0 ? [.52, .1] : [.48, .1]
      const b = sign < 0 ? [.36, .49] : [.64, .49]
      const c = sign < 0 ? [.24, .72] : [.76, .72]
      const scale = .33
      pixelLink(p, `${id}-knee`, `${label}膝节`, `${id}-coxa`, number, scale, a, b)
      pixelLink(p, `${id}-tip`, `${label}踝节`, `${id}-knee`, number, scale, b, c)
      imagePart(p, `${id}-femur`, `${label}股甲`, number, `${id}-coxa`, scale, a, { crop: [0, 0, 1, .57], layer: 4 })
      imagePart(p, `${id}-tibia`, `${label}胫甲`, number, `${id}-knee`, scale, b, { crop: [0, .43, 1, .35], layer: 5 })
      imagePart(p, `${id}-claw`, `${label}爪足`, number, `${id}-tip`, scale, c, { crop: [0, .67, 1, .33], layer: 6 })
    }
  }
}

const adapters = { gnawer, 'emberwing-moth': moth, 'rootrot-bud': bud, 'tide-shadow-cub': cub, 'nest-spider': crawlers, 'beetle-guard': crawlers }

function removeUnusedBranches(project, roots) {
  const removed = new Set(roots)
  for (let pass = 0; pass < project.joints.length; pass++) {
    for (const bone of project.bones) if (removed.has(bone.fromJointId)) removed.add(bone.toJointId)
  }
  if (project.parts.some(part => removed.has(part.attachment.targetId))) throw new Error('Cannot remove a textured branch')
  project.joints = project.joints.filter(joint => !removed.has(joint.id))
  project.bones = project.bones.filter(bone => !removed.has(bone.fromJointId) && !removed.has(bone.toJointId))
  for (const animation of Object.values(project.animations)) for (const id of removed) delete animation.tracks[`joint:${id}`]
}

export function removeNestSpiderTail(project) {
  if (project.enemyId !== 'nest-spider') return
  const roots = ['abdomen-tip', 'spinneret-hinge', 'tail']
  const removed = new Set(roots)
  for (let pass = 0; pass < project.joints.length; pass++) {
    for (const bone of project.bones) if (removed.has(bone.fromJointId)) removed.add(bone.toJointId)
  }
  const bones = new Set(project.bones.filter(bone => removed.has(bone.fromJointId) || removed.has(bone.toJointId)).map(bone => bone.id))
  const removedParts = project.parts.filter(part => part.id.startsWith('spinneret')
    || removed.has(part.attachment.targetId) || bones.has(part.attachment.targetId))
  project.parts = project.parts.filter(part => !removedParts.includes(part))
  for (const animation of Object.values(project.animations)) for (const part of removedParts) delete animation.tracks[`part:${part.id}`]
  removeUnusedBranches(project, roots)
}

export function applyEnemyComponentArt(project) {
  applyEnemyComponentBatch2(project, { joint, imagePart, pixelLink, keys, organMotion })
  applyEnemyComponentBatch3(project, { joint, imagePart, pixelLink, keys, organMotion })
  applyEnemyComponentBatch4(project, { joint, imagePart, pixelLink, keys, organMotion })
  applyEnemyComponentBatch5(project, { joint, imagePart, pixelLink, keys, organMotion })
  if (adapters[project.enemyId]) {
    adapters[project.enemyId](project)
    const unused = {
      gnawer: ['left-claw-0', 'left-claw-1', 'left-claw-2', 'right-claw-0', 'right-claw-1', 'right-claw-2'],
      'emberwing-moth': ['left-antenna', 'right-antenna'],
      'rootrot-bud': ['mouth', 'left-upper-petal', 'right-upper-petal'],
      'nest-spider': ['egg-left-hinge', 'egg-right-hinge'],
    }
    removeUnusedBranches(project, unused[project.enemyId] || [])
    if (project.enemyId === 'rootrot-bud') for (const [side, sign, number] of [['left', -1, 2], ['right', 1, 3]]) {
      pixelLink(project, `${side}-leaf-end`, `${sign < 0 ? '左' : '右'}叶端`, `${side}-petal-tip`, number, .24,
        [sign < 0 ? .6 : .4, .56], [sign < 0 ? .12 : .88, .1])
    }
    // The geometric drafts used joint translations to exaggerate their strike.
    // Textured limbs keep fixed hinge offsets so their overlap survives every pose.
    for (const animation of Object.values(project.animations)) {
      for (const [target, frames] of Object.entries(animation.tracks)) {
        if (target === 'joint:root' || !target.startsWith('joint:')) continue
        for (const frame of frames) Object.assign(frame, { dx: 0, dy: 0, dz: 0 })
      }
    }
  }
  widenEnemyComponentRig(project)
  alignGnawerRestPose(project)
  alignEnemyFrontalSkeleton(project)
  adjustEnemyComponentSpacing(project)
  adjustEnemyUpperBodyPose(project)
  adjustRotWalkerLimbs(project)
  adjustShellguardStance(project)
  removeNestSpiderTail(project)
  adjustPatrolHoundRig(project)
  adjustSalamanderBody(project)
  adjustRootrotHands(project)
  adjustTideCubHeadDepth(project)
  openBeetleElytra(project)
  adjustRotWalkerFeetAndNeck(project)
  alignSalamanderChest(project)
  bringRotWalkerLeftLegForward(project)
  adjustRotSacToadPose(project)
  reconnectSalamanderRig(project)
  reconnectRotSacToadRig(project)
  widenRotWalkerLeftLeg(project)
  addRevenantSecondaryArms(project)
  exposeFourArmLayouts(project)
  splayCrawlerEndLegs(project)
  alignBeetleHornTip(project)
  tightenRotWalkerArms(project)
  restoreFourArmMirrors(project)
  arrangeMossArmsAndJaw(project)
  fitTransparentBeastPanels(project)
  return project
}

export function componentTexturePresets(enemyId) {
  return assets[enemyId] ? Object.keys(assets[enemyId].parts).map((number) => ({
    id: `${enemyId}-${number}`, name: `部件 ${number}`,
    url: `/assets/enemies/components-v1/${enemyId}/part_${String(number).padStart(3, '0')}.png`,
  })) : []
}
