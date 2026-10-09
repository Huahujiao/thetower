import { Vector3 } from 'three'
import { createShadowBone, createShadowJoint, createShadowPart, evaluateShadowProject } from './shadow-rig.js'
import { FLOATING_ENEMIES, FRONTAL_SYMMETRIC_ENEMIES, shadowContactVertices, shadowPartFloor } from './shadow-grounding.js'

const SPECIAL_SUPPORTS = {
  shellguard: ['left-coffin-root-lower', 'right-coffin-root-lower'],
  'sentry-crossbow': ['left-tripod-lower', 'right-tripod-lower', 'rear-tripod-art'],
  'thorn-shell-flower': ['left-root-segment-1', 'right-root-segment-1'],
  'tidal-spore-sac': ['left-root-art', 'right-root-art'],
  'water-leech-swarm': ['leech-0-body-upper', 'leech-1-body-upper', 'leech-2-body-upper'],
  'leech-larva': ['front-body'],
}

export function rebuildEnemyGrounding(project) {
  const contacts = new Set((project.grounding?.supports || []).map(support => support.contactId))
  for (const joint of project.joints) if (joint.id.endsWith('-ground-contact')) contacts.add(joint.id)
  project.joints = project.joints.filter(joint => !contacts.has(joint.id))
  project.bones = project.bones.filter(bone => !contacts.has(bone.fromJointId) && !contacts.has(bone.toJointId))
  for (const animation of Object.values(project.animations)) for (const id of contacts) delete animation.tracks[`joint:${id}`]
  delete project.grounding
  return installEnemyGrounding(project)
}

export function installEnemyGrounding(project) {
  if (!project?.enemyId) return project
  if (project.grounding) return project
  if (FLOATING_ENEMIES.has(project.enemyId)) {
    project.grounding = { floating: true, floorY: 0, supports: [] }
    return project
  }
  if (project.enemyId === 'broodmother') {
    for (const part of [...project.parts].filter(part => /tibia|birth-pillar-sheet/.test(part.id))) {
      const bone = project.bones.find(bone => bone.id === part.attachment.targetId)
      if (!bone || project.parts.some(p => p.id === `${part.id}-foot`)) continue
      project.parts.push(createShadowPart({ id: `${part.id}-foot`, name: `${part.name} · 足端`, shape: 'capsule', width: 14, height: 8, depth: 0,
        fill: part.fill, attachment: { type: 'joint', targetId: bone.toJointId } }))
    }
  }
  // The matriarch's original robe hid an absent lower skeleton. Add two feet
  // behind it rather than pinning the animated robe itself to the floor.
  if (project.enemyId === 'tide-rite-matriarch' && !project.joints.some(j => j.id === 'left-sole')) {
    const raw = evaluateShadowProject(project, null, 0, { raw: true })
    const bottom = Math.min(...raw.parts.map(shadowPartFloor))
    const pelvis = raw.jointsById.get('pelvis').matrix
    for (const [side, x] of [['left', -25], ['right', 25]]) {
      const local = new Vector3(x, bottom + 5, 12).applyMatrix4(pelvis.clone().invert())
      project.joints.push(createShadowJoint({ id: `${side}-sole`, name: `${side === 'left' ? '左' : '右'}足`, ...Object.fromEntries(['x', 'y', 'z'].map(k => [k, local[k]])) }))
      project.bones.push(createShadowBone({ id: `${side}-sole-bone`, fromJointId: 'pelvis', toJointId: `${side}-sole` }))
      project.parts.push(createShadowPart({ id: `${side}-foot`, name: `${side === 'left' ? '左' : '右'}足`, shape: 'capsule', width: 24, height: 10, depth: 0, fill: '#405759', attachment: { type: 'joint', targetId: `${side}-sole` } }))
    }
  }
  const explicit = SPECIAL_SUPPORTS[project.enemyId]
  let supportParts = project.parts.filter(part => explicit ? explicit.includes(part.id)
    : /foot|root-tip-part|stilt-end|leg-end|leg-\d-end|leg-\d-claw|leg-\d-claw-part|leg-\d-segment-2|leg-part-2|(?:front|rear)-part-2/.test(part.id))
  // Shape-only arthropods end at bone-bound tibiae, not separate foot meshes.
  if (project.enemyId === 'broodmother') supportParts = project.parts.filter(part => part.id.endsWith('-foot'))
  if (!supportParts.length && explicit) supportParts = project.parts.filter(part => /foot|root-tip|stilt-end/.test(part.id))
  if (!supportParts.length) {
    for (const joint of project.joints.filter(joint => /leg-\d-tip$|root-tip$/.test(joint.id))) {
      const part = createShadowPart({ id: `${joint.id}-foot`, name: `${joint.name} · 足端`, shape: 'capsule', width: 12, height: 6, depth: 0,
        fill: '#657069', attachment: { type: 'joint', targetId: joint.id } })
      project.parts.push(part); supportParts.push(part)
    }
  }
  if (!supportParts.length) {
    const raw = evaluateShadowProject(project, null, 0, { raw: true })
    const lowest = [...raw.parts].filter(p => p.part.attachment.type !== 'free').sort((a, b) => shadowPartFloor(a) - shadowPartFloor(b))[0]
    if (!lowest) return project
    supportParts = [lowest.part]
  }
  let raw = evaluateShadowProject(project, null, 0, { raw: true })
  const symmetric = FRONTAL_SYMMETRIC_ENEMIES.has(project.enemyId)
  if (symmetric) {
    // Independently drawn foot PNGs can have slightly different opaque edges.
    // Align the artwork to the floor without bending one side of the skeleton.
    for (const left of supportParts.filter(part => part.id.startsWith('left-'))) {
      const right = supportParts.find(part => part.id === left.id.replace(/^left-/, 'right-'))
      if (!right) continue
      const leftPose = raw.parts.find(entry => entry.part === left)
      const rightPose = raw.parts.find(entry => entry.part === right)
      const leftFloor = shadowPartFloor(leftPose), rightFloor = shadowPartFloor(rightPose)
      const floor = (leftFloor + rightFloor) / 2
      left.y += (floor - leftFloor) / leftPose.baseMatrix.elements[5]
      right.y += (floor - rightFloor) / rightPose.baseMatrix.elements[5]
    }
    raw = evaluateShadowProject(project, null, 0, { raw: true })
  }
  const floorY = Math.min(...supportParts.map(part => shadowPartFloor(raw.parts.find(entry => entry.part === part))))
  const supports = []
  for (const part of supportParts) {
    const entry = raw.parts.find(entry => entry.part === part)
    const bone = part.attachment.type === 'bone' ? project.bones.find(bone => bone.id === part.attachment.targetId) : null
    const jointId = bone?.toJointId || part.attachment.targetId
    const joint = raw.jointsById.get(jointId)
    if (!joint) continue
    const point = shadowContactVertices(part).map(p => p.clone().applyMatrix4(entry.matrix)).sort((a, b) => a.y - b.y)[0]
    const local = point.clone().applyMatrix4(joint.matrix.clone().invert())
    const contactId = `${part.id}-ground-contact`
    if (!project.joints.some(j => j.id === contactId)) project.joints.push(createShadowJoint({ id: contactId, name: `${part.name} · 着地点`, x: local.x, y: local.y, z: local.z }))
    if (!project.bones.some(b => b.id === `${contactId}-bone`)) project.bones.push(createShadowBone({ id: `${contactId}-bone`, fromJointId: jointId, toJointId: contactId }))
    supports.push({ jointId, contactId, partId: part.id })
  }
  if (symmetric) {
    for (const left of project.joints.filter(joint => joint.id.startsWith('left-') && joint.id.endsWith('-ground-contact'))) {
      const right = project.joints.find(joint => joint.id === left.id.replace(/^left-/, 'right-'))
      if (!right) continue
      const x = (left.x - right.x) / 2
      left.x = x; right.x = -x
      left.y = right.y = (left.y + right.y) / 2
      left.z = right.z = (left.z + right.z) / 2
    }
  }
  project.stage.floorOffset = 0
  project.grounding = { floating: false, floorY, supports }
  return project
}
