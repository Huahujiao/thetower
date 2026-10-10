import { Vector3 } from 'three'
import { createShadowBone, createShadowJoint, evaluateShadowProject, shadowTransformMatrix } from './shadow-rig.js'
import { shadowPartFloor } from './shadow-grounding.js'

const clone = value => JSON.parse(JSON.stringify(value))

function fitBoneTexture(project, part, toId, from, to, mirrored = false) {
  const crop = part.visual.textureFrame.crop
  const dx = (to[0] - from[0]) * part.width / crop.width
  const dy = -(to[1] - from[1]) * part.height / crop.height
  Object.assign(part, { x: 0, y: 0, z: 0,
    pivotX: (from[0] - crop.left) / crop.width, pivotY: (from[1] - crop.top) / crop.height,
    // XYZ Euler rotation applies the Z turn before the Y mirror. Reflect the
    // whole fitted angle so the painted segment still points along the bone.
    rotationX: 0, rotationY: mirrored ? 180 : 0, rotationZ: Math.atan2(mirrored ? dy : -dy, mirrored ? -dx : dx) * 180 / Math.PI,
    attachment: { type: 'bone', targetId: project.bones.find(b => b.toJointId === toId).id,
      t: 0, followRotation: true, orientationJointId: 'root', bindLength: Math.hypot(dx, dy) } })
  part.visual.textureFit = 'stretch'
}

// V43: the apparently separate lower limbs are upper arms. Join each pair,
// expose the waist spine, and place the opposite leg cutouts on their sides.
export function connectMossAnatomy(project) {
  if (project.enemyId !== 'moss-colossus' || project.joints.some(j => j.id === 'upper-body')) return
  const before = evaluateShadowProject(project, null, 0, { raw: true })
  const floor = Math.min(...before.parts.filter(p => p.part.id.endsWith('-foot')).map(shadowPartFloor))
  project.joints.push(createShadowJoint({ id: 'upper-body', name: '\u4e0a\u534a\u8eab', y: 44 }))
  for (const bone of project.bones) if (bone.fromJointId === 'root' && !['pelvis', 'exposed-spine'].includes(bone.toJointId)) bone.fromJointId = 'upper-body'
  project.bones.push(createShadowBone({ id: 'upper-body-bone', fromJointId: 'root', toJointId: 'upper-body' }))
  project.parts.find(p => p.id === 'torso').attachment.targetId = 'upper-body'
  const torso = project.parts.find(p => p.id === 'torso')
  // Center the separate face on the neck socket painted into the chest.
  project.joints.find(j => j.id === 'neck').x = (.52 - torso.pivotX) * torso.width
  for (const [side, sign] of [['left', 1], ['right', -1]]) {
    // The exchanged cutouts receive left clockwise / right counterclockwise
    // quarter-turns from their previous +90 / -90 carrying orientations.
    project.parts.find(p => p.id === `${side}-pauldron`).rotationZ = 0
    const upper = project.joints.find(j => j.id === `${side}-arm-shoulder`)
    Object.assign(upper, { x: sign * 57, y: 27, z: 6, rotationZ: sign * 27 })
    const forearm = project.joints.find(j => j.id === `${side}-secondary-shoulder`)
    Object.assign(forearm, { x: 0, y: 0, z: .8, rotationZ: -15, scaleX: 1 })
    project.bones.find(b => b.toJointId === forearm.id).fromJointId = `${side}-arm-wrist`
    upper.name = `${side === 'left' ? '\u5de6' : '\u53f3'}\u4e0a\u81c2\u80a9`
    project.joints.find(j => j.id === `${side}-arm-wrist`).name = '\u4e0a\u81c2\u8098'
    forearm.name = '\u5c0f\u81c2\u8fde\u63a5'
    for (const part of project.parts.filter(p => p.id.startsWith(`${side}-arm-`))) part.name = '\u4e0a\u81c2\u82d4\u77f3\u90e8\u4ef6'
    for (const part of project.parts.filter(p => p.id.startsWith(`${side}-secondary-`))) part.name = '\u5c0f\u81c2\u4e0e\u624b\u90e8\u90e8\u4ef6'
  }
  project.parts.find(p => p.id === 'left-root-hand').name = '\u4e0a\u81c2\u8098\u90e8\u5206\u6839'

  // Bind the painted spine endpoints to the raised chest and the pelvic rim.
  let pose = evaluateShadowProject(project, null, 0, { raw: true })
  const top = texturePoint(pose.parts.find(p => p.part.id === 'torso'), .5, .92)
  const bottom = texturePoint(pose.parts.find(p => p.part.id === 'pelvis-art'), .5, .10)
  const parent = pose.jointsById.get('upper-body').matrix
  const localTop = top.clone().applyMatrix4(parent.clone().invert())
  const spinal = project.joints.find(j => j.id === 'exposed-spine')
  spinal.name = '\u80f8\u9acb\u810a\u9aa8'
  Object.assign(spinal, { x: localTop.x, y: localTop.y, z: -2, rotationX: 0, rotationY: 0, rotationZ: 0 })
  project.bones.find(b => b.toJointId === spinal.id).fromJointId = 'upper-body'
  const length = top.y - bottom.y
  project.joints.push(createShadowJoint({ id: 'waist-spine-bottom', name: '\u810a\u9aa8\u9acb\u90e8\u63a5\u70b9', y: -length }))
  project.bones.push(createShadowBone({ id: 'waist-spine-bone', fromJointId: spinal.id, toJointId: 'waist-spine-bottom' }))
  const spine = project.parts.find(p => p.id === 'spine'), ratio = length / .74 / spine.height
  spine.name = '\u80f8\u9acb\u8fde\u63a5\u810a\u9aa8'
  spine.width *= ratio; spine.height *= ratio
  fitBoneTexture(project, spine, 'waist-spine-bottom', [.5, .12], [.5, .86])
  delete spine.attachment.orientationJointId
  for (const animation of Object.values(project.animations)) delete animation.tracks['joint:exposed-spine']

  const saved = Object.fromEntries(project.parts.filter(p => /^(left|right)-(leg-upper|leg-lower|foot)$/.test(p.id)).map(p => [p.id, clone(p)]))
  for (const [side, other, sign, anchors] of [
    ['left', 'right', 1, [[.23, .10], [.56, .42], [.46, .78]]],
    ['right', 'left', -1, [[.77, .10], [.48, .42], [.50, .78]]],
  ]) {
    for (const suffix of ['leg-upper', 'leg-lower', 'foot']) {
      const part = project.parts.find(p => p.id === `${side}-${suffix}`), source = saved[`${other}-${suffix}`]
      for (const field of ['width', 'height', 'visual', 'shape', 'fill']) part[field] = clone(source[field])
    }
    Object.assign(project.joints.find(j => j.id === `${side}-leg-root`), { x: sign * 34, y: -58, z: 1 })
    Object.assign(project.joints.find(j => j.id === `${side}-leg-hinge`), { x: sign * 6, y: -35, z: .25 })
    Object.assign(project.joints.find(j => j.id === `${side}-leg-tip`), { x: sign * 4, y: -39, z: .25 })
    fitBoneTexture(project, project.parts.find(p => p.id === `${side}-leg-upper`), `${side}-leg-hinge`, anchors[0], anchors[1], side === 'right')
    fitBoneTexture(project, project.parts.find(p => p.id === `${side}-leg-lower`), `${side}-leg-tip`, anchors[1], anchors[2], side === 'right')
    Object.assign(project.parts.find(p => p.id === `${side}-foot`), { x: 0, y: 0, z: .3, pivotX: .5, pivotY: .1 })
  }
  pose = evaluateShadowProject(project, null, 0, { raw: true })
  for (const [side, uv] of [['left', [.85, .87]], ['right', [.15, .82]]]) {
    const entry = pose.parts.find(p => p.part.id === `${side}-foot`)
    entry.part.y += (floor - shadowPartFloor(entry)) / entry.baseMatrix.elements[5]
    entry.matrix = entry.baseMatrix.clone().multiply(shadowTransformMatrix(entry.part))
    const point = texturePoint(entry, ...uv).applyMatrix4(pose.jointsById.get(`${side}-leg-tip`).matrix.clone().invert())
    Object.assign(project.joints.find(j => j.id === `${side}-foot-toe`), { x: point.x, y: point.y, z: point.z })
  }
}

function texturePoint(entry, u, v) {
  const { part, matrix } = entry, crop = part.visual.textureFrame.crop
  return new Vector3(((u - crop.left) / crop.width - part.pivotX) * part.width,
    (part.pivotY - (v - crop.top) / crop.height) * part.height, 0).applyMatrix4(matrix)
}

// V41: retain planted feet while raising the anatomy and use each cutout's
// own hip, knee, ankle and toe positions rather than one shared pixel path.
export function refineMossDepthAndFeet(project) {
  if (project.enemyId !== 'moss-colossus' || project.joints.some(j => j.id === 'left-foot-toe')) return
  const before = evaluateShadowProject(project, null, 0, { raw: true })
  project.joints.find(j => j.id === 'root').y += 8
  project.joints.find(j => j.id === 'neck').x += 12
  for (const [side, sign] of [['left', 1], ['right', -1]]) {
    project.joints.find(j => j.id === `${side}-stone-plate`).z += 6
    project.parts.find(p => p.id === `${side}-pauldron`).rotationZ += sign * 80
    for (const group of ['arm', 'secondary']) project.joints.find(j => j.id === `${side}-${group}-shoulder`).z += 4
  }
  const raised = evaluateShadowProject(project, null, 0, { raw: true })
  for (const [side, anchors, toe] of [
    ['left', [[.77, .10], [.48, .42], [.50, .78]], [.85, .82]],
    ['right', [[.23, .10], [.56, .42], [.46, .78]], [.20, .87]],
  ]) {
    const upper = raised.parts.find(p => p.part.id === `${side}-leg-upper`)
    const lower = raised.parts.find(p => p.part.id === `${side}-leg-lower`)
    const oldFoot = before.parts.find(p => p.part.id === `${side}-foot`)
    const points = anchors.map((anchor, i) => texturePoint(i === 2 ? lower : upper, ...anchor))
    let parent = raised.jointsById.get('pelvis').matrix
    for (const [i, suffix] of ['root', 'hinge', 'tip'].entries()) {
      const joint = project.joints.find(j => j.id === `${side}-leg-${suffix}`)
      const point = points[i]
      const local = point.applyMatrix4(parent.clone().invert())
      Object.assign(joint, { x: local.x, y: local.y, z: local.z })
      parent = parent.clone().multiply(shadowTransformMatrix(joint))
      if (i < 2) {
        const part = i ? lower.part : upper.part, crop = part.visual.textureFrame.crop
        part.pivotX = (anchors[i][0] - crop.left) / crop.width
        part.pivotY = (anchors[i][1] - crop.top) / crop.height
      }
    }
    // Counter the root lift and revised ankle anchor in the foot's local
    // frame. Its texture and toe keep their original world-space placement.
    const foot = oldFoot.part
    const localFoot = parent.clone().invert().multiply(oldFoot.matrix)
    Object.assign(foot, { x: localFoot.elements[12], y: localFoot.elements[13], z: localFoot.elements[14] })
    const toePoint = texturePoint(oldFoot, ...toe).applyMatrix4(parent.clone().invert())
    const toeId = `${side}-foot-toe`
    project.joints.push(createShadowJoint({ id: toeId, name: '\u82d4\u77f3\u8db3\u5c16', x: toePoint.x, y: toePoint.y, z: toePoint.z }))
    project.bones.push(createShadowBone({ id: `${toeId}-bone`, fromJointId: `${side}-leg-tip`, toJointId: toeId }))
  }
}

export function alignMossFootContacts(project) {
  if (project.enemyId !== 'moss-colossus') return
  for (const side of ['left', 'right']) {
    const contact = project.joints.find(j => j.id === `${side}-foot-ground-contact`)
    const toe = project.joints.find(j => j.id === `${side}-foot-toe`)
    if (contact && toe) { contact.x = toe.x; contact.z = toe.z }
  }
}

// Legacy "secondary" chains carry the larger hands. Move the complete chains
// and their extra roots, preserving the painted elbow/wrist connections.
export function arrangeMossArmsAndJaw(project) {
  if (project.enemyId !== 'moss-colossus' || project.joints.some(j => j.id === 'upper-body')) return
  for (const side of ['left', 'right']) {
    const small = project.joints.find(j => j.id === `${side}-arm-shoulder`)
    const large = project.joints.find(j => j.id === `${side}-secondary-shoulder`)
    if (!small || !large || small.y <= large.y) continue
    for (const field of ['x', 'y', 'z', 'rotationZ']) [small[field], large[field]] = [large[field], small[field]]
    const rename = (id, name) => id.startsWith(`${side}-arm-`) || id === `${side}-root-hand`
      ? name.replace('上', '下') : id.startsWith(`${side}-secondary-`) ? name.replace('下', '上') : name
    for (const joint of project.joints) joint.name = rename(joint.id, joint.name)
    for (const part of project.parts) part.name = rename(part.id, part.name)
    for (const bone of project.bones) bone.name = rename(bone.toJointId, bone.name)
  }
  const head = project.parts.find(p => p.id === 'head-art')
  const jaw = project.joints.find(j => j.id === 'jaw')
  const art = project.parts.find(p => p.id === 'jaw-art')
  if (!head || !jaw || !art) return
  // Align the tooth row of part_006 with the mouth of part_004. The hinge now
  // sits at the mouth instead of placing the whole jaw beneath the chin.
  const crop = head.visual.textureFrame.crop
  const x = ((.5 - crop.left) / crop.width - head.pivotX) * head.width
  const y = (head.pivotY - (.74 - crop.top) / crop.height) * head.height
  const m = shadowTransformMatrix(head).elements
  Object.assign(jaw, { x: m[0] * x + m[4] * y + m[12], y: m[1] * x + m[5] * y + m[13], z: m[2] * x + m[6] * y + m[14] + .3 })
  const jawCrop = art.visual.textureFrame.crop
  art.pivotX = (.5 - jawCrop.left) / jawCrop.width
  art.pivotY = (.5 - jawCrop.top) / jawCrop.height
}

// Lay out the cut anatomy before connecting the paired arm segments and waist.
export function buildMossColossus(p, { joint, imagePart, pixelLink, organMotion }) {
  const j = (id, name, parent, xyz, pose = {}) => {
    joint(p, id, name, parent, ...xyz)
    Object.assign(p.joints.find(v => v.id === id), pose)
  }
  const art = (id, name, n, target, scale, pivot, options = {}) => imagePart(p, id, name, n, target, scale, pivot, options)
  const link = (id, name, parent, n, scale, from, to) => pixelLink(p, id, name, parent, n, scale, from, to, .25)
  const motion = (id, sign, amount = 6) => organMotion(p, id, sign, amount)

  art('torso', '胸中石面与苔石胸腔', 1, 'root', .34, [.5, .42], { layer: 7 })
  j('exposed-spine', '侧露根脊', 'root', [-61, 27, -2], { rotationZ: -12 })
  art('spine', '侧露苔骨脊', 3, 'exposed-spine', .22, [.5, .20], { layer: 3 })
  motion('exposed-spine', -1, 3)
  j('neck', '石颈', 'root', [0, 57, 1])
  j('head', '石面', 'neck', [0, 5, .5])
  art('head-art', '石面', 4, 'head', .23, [.5, .80], { layer: 10 })
  j('jaw', '独立石颌', 'head', [0, -6, .5])
  art('jaw-art', '独立齿列石颌', 6, 'jaw', .23, [.5, .14], { layer: 11 })
  motion('neck', 1, 3); motion('head', -1, 4); motion('jaw', 1, 5)
  j('pelvis', '苔石髋壳', 'root', [0, -77, -.5])
  art('pelvis-art', '苔石髋壳', 5, 'pelvis', .28, [.5, .10], { layer: 6 })

  const arm = (id, name, n, sign, xyz, scale, anchors, crops, angle) => {
    j(`${id}-shoulder`, `${name}肩`, 'root', xyz, { rotationZ: sign * angle, scaleX: sign })
    let target = `${id}-shoulder`
    for (let i = 0; i < anchors.length; i++) {
      if (i) {
        const next = `${id}-${i === 1 ? 'elbow' : 'wrist'}`
        link(next, `${name}${i === 1 ? '肘' : '腕'}`, target, n, scale, anchors[i - 1], anchors[i])
        target = next
      }
      art(`${id}-${['upper', 'forearm', 'hand'][i]}`, `${name}${['上臂', '前臂', '手'][i]}`, n, target, scale, anchors[i], { crop: crops[i], layer: 8 + i })
      motion(target, i % 2 ? -sign : sign, i ? 8 : 10)
    }
    return target
  }
  const stump = arm('left-arm', '左上石臂', 7, 1, [57, 27, 2], .28,
    [[.51, .10], [.52, .49], [.64, .87]], [[0, 0, 1, .56], [0, .43, 1, .50], [0, .83, 1, .17]], 27)
  art('left-root-hand', '左上分根手', 22, stump, .23, [.48, .10], { layer: 11, z: .3 })
  arm('right-arm', '右上石爪臂', 9, -1, [-57, 27, 2], .30,
    [[.28, .13], [.54, .50], [.65, .80]], [[0, 0, 1, .57], [0, .44, 1, .42], [0, .74, 1, .26]], 27)
  arm('left-secondary', '左下石爪臂', 8, 1, [55, -42, 3], .27,
    [[.47, .10], [.45, .48], [.58, .70]], [[0, 0, 1, .55], [0, .42, 1, .36], [0, .64, 1, .36]], 32)
  const rootHand = arm('right-secondary', '右下垂根臂', 10, -1, [-55, -42, 3], .27,
    [[.29, .10], [.52, .45], [.53, .63]], [[0, 0, 1, .52], [0, .39, 1, .31], [0, .57, 1, .43]], 32)
  j('hand-root-fork', '手背分根', rootHand, [12, -12, -.3], { rotationZ: 32 })
  art('hand-root-fork-art', '外露手背分根', 23, 'hand-root-fork', .20, [.34, .12], { layer: 9 })
  motion('hand-root-fork', -1)
  for (const [side, sign, n] of [['left', 1, 13], ['right', -1, 12]]) {
    // Plates share the torso sockets, rather than swinging over all four arms.
    j(`${side}-stone-plate`, '上肩苔石甲', 'root', [sign * 55, 38, 3], { rotationZ: sign * 14 })
    art(`${side}-pauldron`, '上肩苔石甲', n, `${side}-stone-plate`, .25, [.5, .30], { layer: 10 })
  }
  for (const [side, sign, leg, foot, scale] of [['left', 1, 14, 20, .24], ['right', -1, 15, 21, .26]]) {
    const anchors = [[.5, .10], [.49, .42], [.52, .78]]
    j(`${side}-leg-root`, '苔石髋节', 'pelvis', [sign * 26, -58, 1])
    art(`${side}-leg-upper`, '苔石腿上段', leg, `${side}-leg-root`, scale, anchors[0], { crop: [0, 0, 1, .49], layer: 5 })
    link(`${side}-leg-hinge`, '苔石膝', `${side}-leg-root`, leg, scale, anchors[0], anchors[1])
    art(`${side}-leg-lower`, '苔石腿下段', leg, `${side}-leg-hinge`, scale, anchors[1], { crop: [0, .36, 1, .46], layer: 6 })
    link(`${side}-leg-tip`, '苔石踝', `${side}-leg-hinge`, leg, scale, anchors[1], anchors[2])
    art(`${side}-foot`, foot === 20 ? '磨损石盘足' : '苔石趾足', foot, `${side}-leg-tip`, foot === 20 ? .22 : .27, [.5, .10], { layer: 8, z: .3 })
    for (const [suffix, amount] of [['root', 7], ['hinge', 9], ['tip', 4]]) motion(`${side}-leg-${suffix}`, sign, amount)
  }
  j('shoulder-tree', '肩上寄树干', 'right-stone-plate', [-5, 5, -1])
  art('shoulder-tree-art', '肩上寄树干', 2, 'shoulder-tree', .23, [.62, .85], { crop: [0, .30, 1, .70], layer: 4 })
  link('tree-canopy', '寄树冠分叉', 'shoulder-tree', 2, .23, [.62, .85], [.52, .34])
  art('tree-canopy-art', '展开寄树冠', 11, 'tree-canopy', .27, [.55, .88], { layer: 5 })
  motion('shoulder-tree', -1, 3); motion('tree-canopy', 1, 4)
  for (const [i, n, x, y] of [[0, 16, -44, -13], [1, 17, -12, -57], [2, 18, 13, -56], [3, 19, 46, -10]]) {
    j(`root-tassel-${i}`, `外露垂根${i + 1}`, 'pelvis', [x, y, 3.5])
    art(`root-tassel-${i}-art`, `外露垂根${i + 1}`, n, `root-tassel-${i}`, .22, [.5, .08], { layer: 9 })
    motion(`root-tassel-${i}`, x > 0 ? 1 : -1, 7)
  }
}
