import { Vector3 } from 'three'
import { evaluateShadowProject } from './shadow-rig.js'

const CRAWLERS = new Set(['ash-cannon-bug', 'furnace-beetle'])

function paintedPoint(entry, [u, v]) {
  const { part, matrix } = entry, crop = part.visual.textureFrame.crop
  return new Vector3(((u - crop.left) / crop.width - part.pivotX) * part.width,
    (part.pivotY - (v - crop.top) / crop.height) * part.height, 0).applyMatrix4(matrix)
}

function legPoints(project, side, index) {
  if (project.enemyId === 'furnace-beetle') return [
    [`${side}-leg-${index}`, `${side}-leg-${index}-upper`, [side === 'left' ? .78 : .22, .18]],
    [`${side}-leg-${index}-hinge-1`, `${side}-leg-${index}-upper`, [.5, .58]],
    [`${side}-leg-${index}-hinge-2`, `${side}-leg-${index}-segment-1`, [.5, .79]],
  ]
  // The rear cutouts face the opposite way to the first two pairs.
  const outward = (side === 'left') !== (index === 2)
  return [
    [`${side}-leg-${index}-root`, `${side}-leg-${index}-upper`, [outward ? .64 : .36, .16]],
    [`${side}-leg-${index}-hinge`, `${side}-leg-${index}-upper`, [outward ? .28 : .72, .43]],
    [`${side}-leg-${index}-tip`, `${side}-leg-${index}-lower`, [outward ? .43 : .57, .76]],
  ]
}

// Place paired nodes on painted sockets, averaging the small differences
// between independently drawn PNGs. Preserve every cutout's resting matrix.
export function alignCrawlerSkeleton(project) {
  if (!CRAWLERS.has(project.enemyId)) return
  const before = evaluateShadowProject(project, null, 0, { raw: true })
  const root = before.jointsById.get('root').matrix, inverse = root.clone().invert()
  const points = new Map()
  for (let index = 0; index < (project.enemyId === 'ash-cannon-bug' ? 3 : 2); index++) {
    const left = legPoints(project, 'left', index), right = legPoints(project, 'right', index)
    for (let i = 0; i < left.length; i++) {
      const a = paintedPoint(before.parts.find(p => p.part.id === left[i][1]), left[i][2]).applyMatrix4(inverse)
      const b = paintedPoint(before.parts.find(p => p.part.id === right[i][1]), right[i][2]).applyMatrix4(inverse)
      const x = (a.x - b.x) / 2, y = (a.y + b.y) / 2, z = (a.z + b.z) / 2
      points.set(left[i][0], new Vector3(x, y, z).applyMatrix4(root))
      points.set(right[i][0], new Vector3(-x, y, z).applyMatrix4(root))
    }
  }
  for (const joint of project.joints.filter(j => points.has(j.id))) {
    const parent = project.bones.find(b => b.toJointId === joint.id).fromJointId
    const pose = evaluateShadowProject(project, null, 0, { raw: true })
    const local = points.get(joint.id).clone().applyMatrix4(pose.jointsById.get(parent).matrix.clone().invert())
    Object.assign(joint, { x: local.x, y: local.y, z: local.z })
  }
  const after = evaluateShadowProject(project, null, 0, { raw: true })
  for (const old of before.parts.filter(p => points.has(p.part.attachment.targetId))) {
    const entry = after.parts.find(p => p.part.id === old.part.id)
    const local = entry.baseMatrix.clone().invert().multiply(old.matrix)
    Object.assign(entry.part, { x: local.elements[12], y: local.elements[13], z: local.elements[14] })
  }
}

export function alignCrawlerFootContacts(project) {
  if (!CRAWLERS.has(project.enemyId)) return
  const pose = evaluateShadowProject(project, null, 0, { raw: true })
  const root = pose.jointsById.get('root').matrix, inverse = root.clone().invert()
  const furnace = project.enemyId === 'furnace-beetle'
  for (let index = 0; index < (furnace ? 2 : 3); index++) {
    const pairs = ['left', 'right'].map(side => {
      const id = `${side}-leg-${index}-${furnace ? 'segment-2' : 'end'}`
      const foot = pose.parts.find(p => p.part.id === id)
      const u = furnace ? (side === 'left' ? .10 : .90) : (side === 'left' ? .35 : .65)
      return { contact: project.joints.find(j => j.id === `${id}-ground-contact`),
        point: paintedPoint(foot, [u, furnace ? .93 : .96]).applyMatrix4(inverse) }
    })
    const x = (pairs[0].point.x - pairs[1].point.x) / 2, z = (pairs[0].point.z + pairs[1].point.z) / 2
    for (const [i, { contact }] of pairs.entries()) {
      if (!contact) continue
      const parent = project.bones.find(b => b.toJointId === contact.id).fromJointId
      const point = new Vector3(i ? -x : x, 0, z).applyMatrix4(root)
      point.y = project.grounding.floorY
      point.applyMatrix4(pose.jointsById.get(parent).matrix.clone().invert())
      Object.assign(contact, { x: point.x, y: point.y, z: point.z })
    }
  }
}
