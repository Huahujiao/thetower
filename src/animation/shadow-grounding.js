import { Matrix4, Quaternion, Vector3 } from 'three'
import { shadowPartGeometry } from './shadow-geometry.js'
import textureHulls from './enemy-contact-hulls.json' with { type: 'json' }

const vertices = new WeakMap()
const rests = new WeakMap()
export const FLOATING_ENEMIES = new Set(['emberwing-moth', 'tide-shadow-cub', 'wisp', 'whirlpool-eye-sac', 'redwheel-fire-crow', 'cinder-curse-lamp-swarm', 'bomb-wisp', 'tide-shadow'])

export function shadowContactVertices(part) {
  const stamp = JSON.stringify([part.shape, part.width, part.height, part.depth, part.pivotX, part.pivotY, part.visual])
  const cached = vertices.get(part)
  if (cached?.stamp === stamp) return cached.points
  let points
  if (part.visual.type === 'texture') {
    const hull = textureHulls[`${part.visual.texture}|${JSON.stringify(part.visual.textureFrame || {})}`]
      || [[0, 0], [1, 0], [1, 1], [0, 1]]
    points = hull.map(([x, y]) => new Vector3((x - part.pivotX) * part.width, (part.pivotY - y) * part.height, 0))
  } else {
    const geometry = shadowPartGeometry(part), positions = geometry.getAttribute('position')
    points = Array.from({ length: positions.count }, (_, i) => new Vector3().fromBufferAttribute(positions, i))
    geometry.dispose()
  }
  vertices.set(part, { stamp, points })
  return points
}

export function shadowPartFloor(entry) {
  return Math.min(...shadowContactVertices(entry.part).map(point => point.clone().applyMatrix4(entry.matrix).y))
}

// Move a branch in world space, keeping all descendant attachments connected.
function transformBranch(joints, incoming, id, delta) {
  const descendants = new Set([id])
  let changed = true
  while (changed) {
    changed = false
    for (const [child, parent] of incoming) if (descendants.has(parent) && !descendants.has(child)) {
      descendants.add(child); changed = true
    }
  }
  for (const entry of joints) if (descendants.has(entry.joint.id)) entry.matrix.premultiply(delta)
}

function plantJoint(joints, incoming, id, target, shared) {
  const byId = new Map(joints.map(entry => [entry.joint.id, entry]))
  const end = byId.get(id)
  if (!end) return
  // Two-bone CCD allows the torso/hip to sway while the foot remains planted.
  const chain = []
  let parent = incoming.get(id)
  while (parent && !shared.has(parent) && !['root', 'pelvis', 'haunch', 'lower-stem'].includes(parent) && chain.length < 2) {
    chain.push(parent); parent = incoming.get(parent)
  }
  const desired = new Vector3().setFromMatrixPosition(target)
  for (let pass = 0; pass < 16; pass++) {
    for (const pivotId of chain) {
      const pivot = new Vector3().setFromMatrixPosition(byId.get(pivotId).matrix)
      const current = new Vector3().setFromMatrixPosition(end.matrix).sub(pivot)
      const goal = desired.clone().sub(pivot)
      if (current.lengthSq() < 1e-8 || goal.lengthSq() < 1e-8) continue
      const rotation = new Matrix4().makeRotationFromQuaternion(new Quaternion().setFromUnitVectors(current.normalize(), goal.normalize()))
      const delta = new Matrix4().makeTranslation(...pivot.toArray()).multiply(rotation).multiply(new Matrix4().makeTranslation(...pivot.clone().negate().toArray()))
      transformBranch(joints, incoming, pivotId, delta)
    }
    if (new Vector3().setFromMatrixPosition(end.matrix).distanceToSquared(desired) < .001) break
  }
  transformBranch(joints, incoming, id, target.clone().multiply(end.matrix.clone().invert()))
}

export function constrainShadowJoints(project, joints, animationId, rawEvaluate) {
  const grounding = project.grounding
  if (!grounding || grounding.floating) return
  const stamp = JSON.stringify([project.joints, project.bones, project.parts.map(p => [p.id, p.x, p.y, p.z, p.width, p.height, p.pivotX, p.pivotY, p.rotationX, p.rotationY, p.rotationZ, p.attachment, p.visual])])
  let cached = rests.get(project)
  if (cached?.stamp !== stamp) {
    cached = { stamp, rest: rawEvaluate() }
    rests.set(project, cached)
  }
  const rest = cached.rest
  const incoming = new Map(project.bones.map(bone => [bone.toJointId, bone.fromJointId]))
  const ancestorCounts = new Map()
  for (const support of grounding.supports) {
    let parent = incoming.get(support.jointId)
    while (parent) { ancestorCounts.set(parent, (ancestorCounts.get(parent) || 0) + 1); parent = incoming.get(parent) }
  }
  const shared = new Set([...ancestorCounts].filter(([, count]) => count > 1).map(([id]) => id))
  for (const support of grounding.supports) {
    const bind = rest.jointsById.get(support.jointId)
    const foot = rest.parts.find(entry => entry.part.id === support.partId)
    const current = joints.find(entry => entry.joint.id === support.jointId)
    if (!bind || !foot || !current) continue
    const target = animationId === 'idle' || !animationId ? bind.matrix.clone() : current.matrix.clone()
    const footRelative = bind.matrix.clone().invert().multiply(foot.matrix)
    const floor = shadowPartFloor({ part: foot.part, matrix: target.clone().multiply(footRelative) })
    const correction = grounding.floorY - floor
    if (animationId === 'idle' || !animationId || correction > 0) {
      target.elements[13] += correction
      plantJoint(joints, incoming, support.jointId, target, shared)
    }
  }
  // Keep editor parent transforms consistent with the constrained world pose.
  const byId = new Map(joints.map(entry => [entry.joint.id, entry]))
  for (const entry of joints) entry.parentMatrix = byId.get(incoming.get(entry.joint.id))?.matrix || new Matrix4()
}

export function constrainShadowParts(project, parts, joints, bones, animationId) {
  if (!project.grounding || project.grounding.floating) return
  const floorY = project.grounding.floorY
  if (animationId && animationId !== 'idle') {
    // Move the complete pose above the floor, preserving attached seams even
    // when a collapsing body becomes the lowest part during death.
    const lift = Math.max(0, floorY - Math.min(...parts.map(shadowPartFloor)))
    if (lift > 0) {
      for (const entry of [...joints, ...parts]) entry.matrix.elements[13] += lift
      for (const bone of bones) { bone.y1 += lift; bone.y2 += lift }
    }
  } else {
    for (const entry of parts) {
      const minY = shadowPartFloor(entry)
      if (minY < floorY) entry.matrix.elements[13] += floorY - minY
    }
  }
  for (const support of project.grounding.supports) {
    const foot = parts.find(p => p.part.id === support.partId)
    const contact = joints.find(j => j.joint.id === support.contactId)
    if (!foot || !contact) continue
    const point = shadowContactVertices(foot.part).map(p => p.clone().applyMatrix4(foot.matrix)).sort((a, b) => a.y - b.y)[0]
    contact.matrix.setPosition(point)
    const bone = bones.find(b => b.bone.toJointId === support.contactId)
    if (bone) { bone.x2 = point.x; bone.y2 = point.y; bone.z2 = point.z; bone.length = Math.hypot(bone.x2 - bone.x1, bone.y2 - bone.y1, bone.z2 - bone.z1) }
  }
}
