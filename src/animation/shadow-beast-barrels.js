import { Vector3 } from 'three'
import { evaluateShadowProject } from './shadow-rig.js'

const clone = value => JSON.parse(JSON.stringify(value))

// Six longitudinal panels enclose the torso; the same root frame keeps their
// cross-section level instead of inheriting the bone solver's shortest roll.
export function buildBeastBarrel(project) {
  const toad = project.enemyId === 'rot-sac-toad'
  if (!toad && project.enemyId !== 'redneedle-salamander') return
  const chest = project.parts.find(part => part.id === 'chest')
  const back = project.parts.find(part => part.id === 'back')
  if (!chest || !back) return
  const radius = chest.width / 2, depth = toad ? 70 : 30, top = toad ? 26 : 0
  const fold = Math.atan2(depth / 2, radius / 2) * 180 / Math.PI
  const slopeWidth = Math.hypot(radius / 2, depth / 2)
  const joints = new Map(project.joints.map(joint => [joint.id, joint]))
  const neck = joints.get('neck'), haunch = joints.get('haunch'), head = joints.get('head')
  const neckY = neck.y
  neck.y = haunch.y * neck.z / haunch.z
  head.y += neckY - neck.y
  const sections = [['neck', '', -1], ['haunch', '-mid', 1]]
  const total = sections.reduce((sum, [id]) => { const j = joints.get(id); return sum + Math.hypot(j.x, j.y, j.z) }, 0)
  const chestSource = clone(chest), backSource = clone(back)
  let start = 0
  for (const [endId, suffix, turn] of sections) {
    const joint = joints.get(endId)
    const length = Math.hypot(joint.x, joint.y, joint.z)
    const fraction = length / total
    const attachment = { type: 'bone', targetId: project.bones.find(bone => bone.toJointId === endId).id, t: 0, followRotation: true, orientationJointId: 'root' }
    const backId = `back${suffix}`, chestId = suffix ? 'chest-rear' : 'chest'
    for (const [id, source, level] of [[backId, backSource, top], [chestId, chestSource, top - depth]]) {
      let center = project.parts.find(part => part.id === id)
      if (!center) { center = clone(source); center.id = id; project.parts.push(center) }
      const original = clone(center)
      if (toad) {
        const crop = source.visual.textureFrame.crop
        original.visual.textureFrame.crop = { ...crop, top: crop.top + start * crop.height, height: fraction * crop.height }
      }
      const crop = original.visual.textureFrame.crop
      Object.assign(center, { width: radius, height: length, pivotX: .5, pivotY: turn < 0 ? 1 : 0,
        x: 0, y: level, z: 0, rotationX: 90, rotationY: 0, rotationZ: turn * 90, attachment: { ...attachment } })
      center.visual.textureFrame.crop = { ...crop, left: crop.left + crop.width * .25, width: crop.width * .5 }
      center.visual.textureFit = 'stretch'
      center.visual.backingColor = toad ? '#50603a' : '#4d3c2d'
      center.visual.skinTexture = `/assets/enemies/skins-v1/${project.enemyId}.png`
      for (const [side, sign] of [['left', -1], ['right', 1]]) {
        const flank = clone(original)
        Object.assign(flank, { id: `${id}-${side}-flank`, name: `${original.name} ${side}`, width: slopeWidth,
          height: length, pivotX: sign < 0 ? 1 : 0, pivotY: center.pivotY,
          x: 0, y: level, z: turn * sign * radius / 2,
          rotationX: 90 + (level === top ? 1 : -1) * turn * sign * fold, rotationY: 0, rotationZ: turn * 90,
          attachment: { ...attachment } })
        flank.visual.textureFrame.crop = { ...crop, left: crop.left + (sign < 0 ? 0 : .75) * crop.width, width: crop.width * .25 }
        flank.visual.textureFit = 'stretch'
        flank.visual.backingColor = center.visual.backingColor
        flank.visual.skinTexture = center.visual.skinTexture
        project.parts.push(flank)
        for (const animation of Object.values(project.animations)) {
          if (animation.tracks[`part:${id}`]) animation.tracks[`part:${flank.id}`] = clone(animation.tracks[`part:${id}`])
        }
      }
    }
    start += fraction
  }
  const tail = project.parts.find(part => part.id === 'back-tail')
  if (tail) tail.attachment.orientationJointId = 'root'
  const rump = project.parts.find(part => part.id === 'rump')
  const pitch = Math.atan2(-haunch.y, -haunch.z)
  const center = top - depth / 2
  if (rump) for (const [endId, id] of [['haunch', 'rump'], ['neck', 'torso-front-cap']]) {
    const cap = id === 'rump' ? rump : clone(rump)
    const joint = joints.get(endId)
    Object.assign(cap, { id, shape: 'hexagon', width: radius * 2, height: depth, pivotX: .5, pivotY: .5,
      x: joint.x, y: joint.y + center * Math.cos(pitch), z: joint.z - center * Math.sin(pitch), rotationX: -pitch * 180 / Math.PI, rotationY: 0, rotationZ: 0,
      attachment: { type: 'joint', targetId: 'root', t: .5, followRotation: true } })
    cap.visual.textureFit = 'stretch'
    cap.visual.backingColor = toad ? '#50603a' : '#4d3c2d'
    cap.visual.skinTexture = `/assets/enemies/skins-v1/${project.enemyId}.png`
    if (id !== 'rump') project.parts.push(cap)
  }
}

function fitLimbPart(project, part, toId, from, to, mirrored) {
  const dx = (to[0] - from[0]) * part.width, dy = -(to[1] - from[1]) * part.height
  Object.assign(part, { x: 0, y: 0, z: 0, pivotX: from[0], pivotY: from[1], rotationX: 0,
    rotationY: mirrored ? 180 : 0, rotationZ: Math.atan2(-dy, dx) * 180 / Math.PI + (mirrored ? 180 : 0),
    attachment: { type: 'bone', targetId: project.bones.find(bone => bone.toJointId === toId).id,
      t: 0, followRotation: true, bindLength: Math.hypot(dx, dy) } })
  part.visual.textureFit = 'stretch'
}

// Move the shoulder onto a side panel while preserving the planted wrist and
// foot positions. Bone fitting then keeps painted sockets joined during IK.
export function reconnectBeastFrontLimbs(project) {
  const toad = project.enemyId === 'rot-sac-toad'
  const joints = new Map(project.joints.map(joint => [joint.id, joint]))
  const rest = evaluateShadowProject(project, null, 0, { raw: true })
  const rootInverse = rest.jointsById.get('root').matrix.clone().invert()
  const anchors = toad ? [[.73, .11], [.51, .90], [.51, .08], [.5, .92], [.5, .065]]
    : [[.42, .11], [.36, .89], [.44, .105], [.45, .90], [.5, .075]]
  for (const [side, sign] of [['left', -1], ['right', 1]]) {
    const hip = joints.get(`${side}-front-hip`), knee = joints.get(`${side}-front-knee`), paw = joints.get(`${side}-front-paw`)
    const upper = project.parts.find(part => part.id === `${side}-front-upper`)
    const lower = project.parts.find(part => part.id === `${side}-front-lower`)
    const foot = project.parts.find(part => part.id === `${side}-front-foot`)
    const flank = rest.parts.find(entry => entry.part.id === `chest-${side}-flank`)
    if (!hip || !knee || !paw || !upper || !lower || !foot || !flank) continue
    const elbowY = hip.y + knee.y, wristY = hip.y + knee.y + paw.y
    const wristX = hip.x + knee.x + paw.x, wristZ = hip.z + knee.z + paw.z
    const fraction = hip.z / joints.get('neck').z
    // Keep the toad's shoulder width; the low, narrow salamander uses the
    // outer flank. Both sockets sit on an actual surface, not an empty gap.
    const cosine = Math.cos((flank.part.rotationX - 90) * Math.PI / 180)
    const spread = toad ? (Math.abs(hip.x) - flank.part.width * cosine) / cosine : flank.part.width * .8
    const socket = new Vector3(sign * Math.max(0, Math.min(flank.part.width, spread)), flank.part.height * fraction, 0).applyMatrix4(flank.matrix).applyMatrix4(rootInverse)
    Object.assign(hip, { x: socket.x, y: socket.y, z: socket.z })
    const [upperTop, upperBottom, lowerTop, lowerBottom, clawTop] = anchors
    upper.height = Math.max(4, (hip.y - elbowY) / (upperBottom[1] - upperTop[1]))
    knee.x = -sign * (upperBottom[0] - upperTop[0]) * upper.width
    knee.y = -(upperBottom[1] - upperTop[1]) * upper.height
    lower.height = Math.max(4, (hip.y + knee.y - wristY) / (lowerBottom[1] - lowerTop[1]))
    paw.x = -sign * (lowerBottom[0] - lowerTop[0]) * lower.width
    paw.y = -(lowerBottom[1] - lowerTop[1]) * lower.height
    fitLimbPart(project, upper, knee.id, upperTop, upperBottom, sign > 0)
    fitLimbPart(project, lower, paw.id, lowerTop, lowerBottom, sign > 0)
    if (toad) {
      // A ground-planted claw keeps its artwork fixed while its wrist is
      // moved to the painted socket; compensate the foot pivot in tandem.
      const dx = (clawTop[0] - foot.pivotX) * foot.width
      const dy = -(clawTop[1] - foot.pivotY) * foot.height
      paw.x = wristX - hip.x - knee.x + (sign > 0 ? -dx : dx)
      paw.y = wristY - hip.y - knee.y + dy
      paw.z = wristZ - hip.z - knee.z
    }
    foot.pivotX = clawTop[0]; foot.pivotY = clawTop[1]
    if (!toad) foot.z = .3
  }
}
