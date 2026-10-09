import { Vector3 } from 'three'
import { createShadowBone, createShadowJoint, shadowTransformMatrix } from './shadow-rig.js'

export function refineAshCannonAnatomy(project) {
  if (project.enemyId !== 'ash-cannon-bug' || project.joints.some(j => j.id === 'ash-tail-root')) return
  for (const side of ['left', 'right']) {
    project.joints.find(j => j.id === `${side}-leg-0-root`).rotationX = -25
    project.joints.find(j => j.id === `${side}-leg-2-root`).rotationX = 25
  }
  const back = project.parts.find(p => p.id === 'carapace'), tail = project.parts.find(p => p.id === 'belly')
  const attachment = new Vector3((.5 - back.pivotX) * back.width, (back.pivotY - .20) * back.height, 0)
    .applyMatrix4(shadowTransformMatrix(back))
  project.joints.push(createShadowJoint({ id: 'ash-tail-root', name: '\u5c3e\u6839', x: attachment.x, y: attachment.y, z: attachment.z }))
  project.bones.push(createShadowBone({ id: 'ash-tail-root-bone', fromJointId: 'abdomen', toJointId: 'ash-tail-root' }))
  Object.assign(tail, { name: '\u5c3e\u90e8\u9aa8\u7532', x: 0, y: 0, z: 0, pivotX: .5, pivotY: .16,
    rotationX: 80, rotationY: 0, rotationZ: 0, layer: 6,
    attachment: { type: 'joint', targetId: 'ash-tail-root', t: .5, followRotation: true } })
  const tip = new Vector3(0, (.16 - .96) * tail.height, 0).applyMatrix4(shadowTransformMatrix(tail))
  project.joints.push(createShadowJoint({ id: 'ash-tail-tip', name: '\u5c3e\u5c16', x: tip.x, y: tip.y, z: tip.z }))
  project.bones.push(createShadowBone({ id: 'ash-tail-tip-bone', fromJointId: 'ash-tail-root', toJointId: 'ash-tail-tip' }))

  // Keep the rear painted socket fixed and pull only the muzzle backward.
  const cannon = project.joints.find(j => j.id === 'cannon'), muzzle = project.joints.find(j => j.id === 'cannon-muzzle')
  const base = shadowTransformMatrix(cannon)
  const end = new Vector3(muzzle.x, muzzle.y, muzzle.z).applyMatrix4(base)
  end.z -= 16
  end.applyMatrix4(base.clone().invert())
  Object.assign(muzzle, { x: end.x, y: end.y, z: end.z })
  const bone = project.bones.find(b => b.toJointId === muzzle.id)
  const barrel = project.parts.find(p => p.id === 'cannon-barrel')
  barrel.attachment = { type: 'bone', targetId: bone.id, t: 0, followRotation: true, orientationJointId: 'root', bindLength: (.84 - .15) * barrel.width / .83 }
  barrel.visual.textureFit = 'stretch'
  const cap = project.parts.find(p => p.id === 'cannon-muzzle-art')
  cap.attachment = { type: 'bone', targetId: bone.id, t: 1, followRotation: true, orientationJointId: 'root' }
}
