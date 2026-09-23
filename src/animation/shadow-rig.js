import { Euler, Matrix4, Quaternion, Vector3 } from 'three'

export const SHADOW_PUPPET_STORAGE_KEY = 'thetower-shadow-puppet-project-v3'
export const SHADOW_PUPPET_ROSTER_STORAGE_KEY = 'thetower-shadow-puppet-roster-v3'
const LEGACY_PROJECT_STORAGE_KEY = 'thetower-shadow-puppet-project-v2'
const LEGACY_ROSTER_STORAGE_KEY = 'thetower-shadow-puppet-roster-v2'

export const SHADOW_ANIMATION_TYPES = Object.freeze([
  { id: 'idle', label: '\u5f85\u673a', duration: 1400, loop: true },
  { id: 'attack', label: '\u653b\u51fb', duration: 500, loop: false },
  { id: 'hit', label: '\u53d7\u653b\u51fb', duration: 380, loop: false },
  { id: 'death', label: '\u6b7b\u4ea1', duration: 800, loop: false },
  { id: 'move', label: '\u79fb\u52a8', duration: 700, loop: true },
])

export const SHADOW_SHAPES = Object.freeze([
  { id: 'circle', label: '\u5706\u5f62' },
  { id: 'rect', label: '\u957f\u65b9\u5f62' },
  { id: 'triangle', label: '\u4e09\u89d2\u5f62' },
  { id: 'ellipse', label: '\u692d\u5706' },
  { id: 'capsule', label: '\u80f6\u56ca\u5f62' },
  { id: 'diamond', label: '\u83f1\u5f62' },
])

const DEFAULT_POSE = Object.freeze({
  dx: 0,
  dy: 0,
  dz: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
  opacity: 1,
})

const LEGACY_PROJECT_NAME_SUFFIX = '\u00b7\u76ae\u5f71'
let idSequence = 0

function nextId(prefix) {
  idSequence += 1
  return `${prefix}-${Date.now().toString(36)}-${idSequence.toString(36)}`
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function finite(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function normalizeProjectName(value, fallback) {
  const name = String(value || fallback)
  return name.endsWith(LEGACY_PROJECT_NAME_SUFFIX)
    ? name.slice(0, -LEGACY_PROJECT_NAME_SUFFIX.length)
    : name
}

function normalizePose(source = {}) {
  return {
    dx: finite(source.dx, 0),
    dy: finite(source.dy, 0),
    dz: finite(source.dz, 0),
    rotationX: finite(source.rotationX, 0),
    rotationY: finite(source.rotationY, 0),
    rotationZ: finite(source.rotationZ ?? source.rotation, 0),
    scaleX: finite(source.scaleX, 1),
    scaleY: finite(source.scaleY, 1),
    scaleZ: finite(source.scaleZ, 1),
    opacity: clamp(finite(source.opacity, 1), 0, 1),
  }
}

function normalizeKeys(source) {
  if (!Array.isArray(source)) return []
  return source.map((entry) => ({
    time: Math.max(0, finite(entry?.time, 0)),
    ...normalizePose(entry),
  })).sort((a, b) => a.time - b.time)
}

export function defaultShadowPose() {
  return clone(DEFAULT_POSE)
}

export function shadowTargetKey(kind, id) {
  return `${kind}:${id}`
}

export function createShadowJoint({ id = nextId('joint'), name = '\u5173\u8282', x = 0, y = 0, z = 0, rotationX = 0, rotationY = 0, rotationZ = 0 } = {}) {
  return { id, name, x, y, z, rotationX, rotationY, rotationZ }
}

export function createShadowBone({ id = nextId('bone'), name = '\u9aa8\u9abc', fromJointId, toJointId } = {}) {
  return { id, name, fromJointId, toJointId }
}

export function createShadowPart({
  id = nextId('part'),
  name = '\u90e8\u4ef6',
  shape = 'rect',
  x = 0,
  y = 0,
  z = 0,
  width = 80,
  height = 80,
  rotationX = 0,
  rotationY = 0,
  rotationZ = 0,
  pivotX = 0.5,
  pivotY = 0.5,
  fill = '#253746',
  stroke = '#9fb8c9',
  layer = 0,
  attachment = null,
} = {}) {
  return {
    id,
    name,
    shape,
    x,
    y,
    z,
    width,
    height,
    rotationX,
    rotationY,
    rotationZ,
    pivotX,
    pivotY,
    fill,
    stroke,
    opacity: 1,
    layer,
    attachment: attachment || { type: 'free', targetId: null, t: 0.5, followRotation: true },
    visual: { type: 'shape', texture: null, textureFit: 'contain' },
  }
}

function normalizeJoint(source, index) {
  return createShadowJoint({
    id: String(source?.id || `joint-${index + 1}`),
    name: String(source?.name || `Joint ${index + 1}`),
    x: finite(source?.x, 0),
    y: finite(source?.y, 0),
    z: finite(source?.z, 0),
    rotationX: finite(source?.rotationX, 0),
    rotationY: finite(source?.rotationY, 0),
    rotationZ: finite(source?.rotationZ ?? source?.rotation, 0),
  })
}

function normalizeBone(source, index) {
  return createShadowBone({
    id: String(source?.id || `bone-${index + 1}`),
    name: String(source?.name || `Bone ${index + 1}`),
    fromJointId: String(source?.fromJointId || ''),
    toJointId: String(source?.toJointId || ''),
  })
}

function normalizeAttachment(source, jointIds, boneIds) {
  const type = source?.type === 'joint' || source?.type === 'bone' ? source.type : 'free'
  const targetId = typeof source?.targetId === 'string' ? source.targetId : null
  if (type === 'joint' && !jointIds.has(targetId)) return { type: 'free', targetId: null, t: 0.5, followRotation: true }
  if (type === 'bone' && !boneIds.has(targetId)) return { type: 'free', targetId: null, t: 0.5, followRotation: true }
  return {
    type,
    targetId: type === 'free' ? null : targetId,
    t: clamp(finite(source?.t, 0.5), 0, 1),
    followRotation: source?.followRotation !== false,
  }
}

function normalizePart(source, index, jointIds, boneIds, legacy2D = false) {
  const shapes = new Set(SHADOW_SHAPES.map((entry) => entry.id))
  const shape = shapes.has(source?.shape) ? source.shape : 'rect'
  const visual = source?.visual && typeof source.visual === 'object' ? source.visual : {}
  return {
    id: String(source?.id || `part-${index + 1}`),
    name: String(source?.name || `Part ${index + 1}`),
    shape,
    x: finite(source?.x, 0),
    y: finite(source?.y, 0),
    z: legacy2D ? 0 : finite(source?.z, 0),
    width: Math.max(4, finite(source?.width, 80)),
    height: Math.max(4, finite(source?.height, 80)),
    rotationX: finite(source?.rotationX, 0),
    rotationY: finite(source?.rotationY, 0),
    rotationZ: finite(source?.rotationZ ?? source?.rotation, 0),
    pivotX: clamp(finite(source?.pivotX, 0.5), 0, 1),
    pivotY: clamp(finite(source?.pivotY, 0.5), 0, 1),
    fill: String(source?.fill || '#253746'),
    stroke: String(source?.stroke || '#9fb8c9'),
    opacity: clamp(finite(source?.opacity, 1), 0, 1),
    layer: finite(legacy2D ? source?.z : source?.layer, index),
    attachment: normalizeAttachment(source?.attachment, jointIds, boneIds),
    visual: {
      type: visual.type === 'texture' ? 'texture' : 'shape',
      texture: typeof visual.texture === 'string' ? visual.texture : null,
      textureFit: visual.textureFit === 'cover' ? 'cover' : 'contain',
    },
  }
}

function normalizeAnimations(source, validTargetKeys) {
  const animations = {}
  for (const type of SHADOW_ANIMATION_TYPES) {
    const current = source?.[type.id]
    const tracks = {}
    for (const [targetKey, keys] of Object.entries(current?.tracks || {})) {
      if (!validTargetKeys.has(targetKey)) continue
      const normalized = normalizeKeys(keys)
      if (normalized.length) tracks[targetKey] = normalized
    }
    animations[type.id] = {
      id: type.id,
      name: String(current?.name || type.label),
      duration: Math.max(100, finite(current?.duration, type.duration)),
      loop: typeof current?.loop === 'boolean' ? current.loop : type.loop,
      tracks,
    }
  }
  return animations
}

function createBlankProject(name = '\u65b0\u89d2\u8272 1') {
  return {
    version: 3,
    name,
    stage: { width: 600, height: 600, depth: 600, floorOffset: 8 },
    joints: [],
    bones: [],
    parts: [],
    animations: normalizeAnimations({}, new Set()),
  }
}

function migrateLegacyProject(source) {
  if (!source || !Array.isArray(source.parts)) return createBlankProject()
  const legacy = source
  const joints = legacy.parts.map((entry, index) => createShadowJoint({
    id: `joint-${entry.id || index + 1}`,
    name: String(entry.name || `Joint ${index + 1}`),
    x: finite(entry.x, 0),
    y: finite(entry.y, 0),
    rotationZ: finite(entry.rotation, 0),
  }))
  const jointIdByPart = new Map(legacy.parts.map((entry, index) => [entry.id, joints[index].id]))
  const bones = legacy.parts.flatMap((entry, index) => {
    if (!entry.parentId || !jointIdByPart.has(entry.parentId)) return []
    return [createShadowBone({
      id: `bone-${entry.id || index + 1}`,
      name: String(entry.name || `Bone ${index + 1}`),
      fromJointId: jointIdByPart.get(entry.parentId),
      toJointId: joints[index].id,
    })]
  })
  const parts = legacy.parts.map((entry, index) => createShadowPart({
    id: String(entry.id || `part-${index + 1}`),
    name: String(entry.name || `Part ${index + 1}`),
    shape: entry.shape,
    width: finite(entry.width, 80),
    height: finite(entry.height, 80),
    pivotX: finite(entry.pivotX, 0.5),
    pivotY: finite(entry.pivotY, 0.5),
    fill: entry.fill,
    stroke: entry.stroke,
    layer: finite(entry.z, index),
    attachment: { type: 'joint', targetId: joints[index].id, t: 0.5, followRotation: true },
  }))
  parts.forEach((entry, index) => {
    entry.opacity = clamp(finite(legacy.parts[index]?.opacity, 1), 0, 1)
    entry.visual = {
      type: legacy.parts[index]?.texture ? 'texture' : 'shape',
      texture: typeof legacy.parts[index]?.texture === 'string' ? legacy.parts[index].texture : null,
      textureFit: legacy.parts[index]?.textureFit === 'cover' ? 'cover' : 'contain',
    }
  })
  const animations = {}
  for (const type of SHADOW_ANIMATION_TYPES) {
    const current = legacy.animations?.[type.id]
    const tracks = {}
    for (const entry of legacy.parts) {
      const oldKeys = normalizeKeys(current?.tracks?.[entry.id])
      if (!oldKeys.length) continue
      const jointId = jointIdByPart.get(entry.id)
      tracks[shadowTargetKey('joint', jointId)] = oldKeys
      if (oldKeys.some((keyframe) => keyframe.opacity !== 1)) {
        tracks[shadowTargetKey('part', entry.id)] = oldKeys.map((keyframe) => ({
          ...DEFAULT_POSE,
          time: keyframe.time,
          opacity: keyframe.opacity,
        }))
      }
    }
    animations[type.id] = {
      id: type.id,
      name: String(current?.name || type.label),
      duration: Math.max(100, finite(current?.duration, type.duration)),
      loop: typeof current?.loop === 'boolean' ? current.loop : type.loop,
      tracks,
    }
  }
  return {
    version: 3,
    name: normalizeProjectName(legacy.name, '\u65b0\u89d2\u8272'),
    stage: {
      width: Math.max(200, finite(legacy.stage?.width, 600)),
      height: Math.max(200, finite(legacy.stage?.height, 600)),
    },
    joints,
    bones,
    parts,
    animations,
  }
}

export function normalizeShadowProject(source) {
  if (!Array.isArray(source?.joints) || !Array.isArray(source?.bones)) {
    return normalizeShadowProject(migrateLegacyProject(source))
  }
  const legacy2D = source.version !== 3
  const joints = source.joints.map(normalizeJoint)
  const jointIds = new Set(joints.map((entry) => entry.id))
  const usedTargets = new Set()
  const bones = source.bones.map(normalizeBone).filter((entry) => {
    if (!jointIds.has(entry.fromJointId) || !jointIds.has(entry.toJointId) || entry.fromJointId === entry.toJointId) return false
    if (usedTargets.has(entry.toJointId)) return false
    usedTargets.add(entry.toJointId)
    return true
  })
  const boneIds = new Set(bones.map((entry) => entry.id))
  const parts = Array.isArray(source.parts) ? source.parts.map((entry, index) => normalizePart(entry, index, jointIds, boneIds, legacy2D)) : []
  const validTargetKeys = new Set([
    ...joints.map((entry) => shadowTargetKey('joint', entry.id)),
    ...parts.map((entry) => shadowTargetKey('part', entry.id)),
  ])
  return {
    version: 3,
    name: normalizeProjectName(source.name, '\u65b0\u89d2\u8272 1'),
    stage: {
      width: Math.max(200, finite(source.stage?.width, 600)),
      height: Math.max(200, finite(source.stage?.height, 600)),
      depth: Math.max(200, finite(source.stage?.depth, 600)),
      floorOffset: Math.max(0, finite(source.stage?.floorOffset, 8)),
    },
    joints,
    bones,
    parts,
    animations: normalizeAnimations(source.animations, validTargetKeys),
  }
}

export function createDefaultShadowProject() {
  return createBlankProject()
}

export function createShadowCharacter(project = createDefaultShadowProject()) {
  return { id: nextId('character'), project: normalizeShadowProject(project) }
}

export function normalizeShadowRoster(source) {
  const rawCharacters = Array.isArray(source?.characters) ? source.characters : []
  const usedIds = new Set()
  const characters = rawCharacters.map((entry) => {
    let id = typeof entry?.id === 'string' && entry.id ? entry.id : nextId('character')
    while (usedIds.has(id)) id = nextId('character')
    usedIds.add(id)
    return { id, project: normalizeShadowProject(entry?.project || entry) }
  })
  if (!characters.length) characters.push(createShadowCharacter())
  const requested = typeof source?.activeCharacterId === 'string' ? source.activeCharacterId : null
  const activeCharacterId = characters.some((entry) => entry.id === requested) ? requested : characters[0].id
  return { version: 3, examplePackVersion: Math.max(0, finite(source?.examplePackVersion, 0)), activeCharacterId, characters }
}

export function loadShadowProject() {
  try {
    const stored = window.localStorage.getItem(SHADOW_PUPPET_STORAGE_KEY)
      || window.localStorage.getItem(LEGACY_PROJECT_STORAGE_KEY)
    return stored ? normalizeShadowProject(JSON.parse(stored)) : createDefaultShadowProject()
  } catch {
    return createDefaultShadowProject()
  }
}

export function loadShadowRoster() {
  try {
    const stored = window.localStorage.getItem(SHADOW_PUPPET_ROSTER_STORAGE_KEY)
      || window.localStorage.getItem(LEGACY_ROSTER_STORAGE_KEY)
    if (stored) return normalizeShadowRoster(JSON.parse(stored))
  } catch {
    // Fall through to the single-project migration.
  }
  const character = createShadowCharacter()
  return { version: 3, activeCharacterId: character.id, characters: [character] }
}

export function saveShadowProject(project) {
  window.localStorage.setItem(SHADOW_PUPPET_STORAGE_KEY, JSON.stringify(normalizeShadowProject(project)))
}

export function saveShadowRoster(roster) {
  const normalized = normalizeShadowRoster(roster)
  window.localStorage.setItem(SHADOW_PUPPET_ROSTER_STORAGE_KEY, JSON.stringify(normalized))
  const active = normalized.characters.find((entry) => entry.id === normalized.activeCharacterId)
  if (active) saveShadowProject(active.project)
  return normalized
}

function interpolateValue(left, right, ratio, keyName) {
  return left[keyName] + (right[keyName] - left[keyName]) * ratio
}

export function sampleShadowTrack(animationEntry, targetKey, time) {
  const keys = animationEntry?.tracks?.[targetKey]
  if (!keys?.length) return defaultShadowPose()
  const duration = Math.max(1, animationEntry.duration)
  const current = animationEntry.loop ? ((time % duration) + duration) % duration : clamp(time, 0, duration)
  let left = keys[0]
  let right = keys[keys.length - 1]
  if (current <= left.time) return { ...DEFAULT_POSE, ...left }
  if (current >= right.time) {
    if (!animationEntry.loop || right.time >= duration || keys.length === 1) return { ...DEFAULT_POSE, ...right }
    left = right
    right = { ...keys[0], time: keys[0].time + duration }
  } else {
    for (let index = 1; index < keys.length; index += 1) {
      if (keys[index].time >= current) {
        left = keys[index - 1]
        right = keys[index]
        break
      }
    }
  }
  const adjustedTime = current < left.time ? current + duration : current
  const ratio = right.time === left.time ? 0 : (adjustedTime - left.time) / (right.time - left.time)
  return {
    dx: interpolateValue(left, right, ratio, 'dx'),
    dy: interpolateValue(left, right, ratio, 'dy'),
    dz: interpolateValue(left, right, ratio, 'dz'),
    rotationX: interpolateValue(left, right, ratio, 'rotationX'),
    rotationY: interpolateValue(left, right, ratio, 'rotationY'),
    rotationZ: interpolateValue(left, right, ratio, 'rotationZ'),
    scaleX: interpolateValue(left, right, ratio, 'scaleX'),
    scaleY: interpolateValue(left, right, ratio, 'scaleY'),
    scaleZ: interpolateValue(left, right, ratio, 'scaleZ'),
    opacity: interpolateValue(left, right, ratio, 'opacity'),
  }
}

export function upsertShadowKeyframe(project, animationId, targetKey, time, pose) {
  const animationEntry = project.animations[animationId]
  if (!animationEntry) return
  const roundedTime = clamp(Math.round(Number(time) || 0), 0, animationEntry.duration)
  const keys = animationEntry.tracks[targetKey] || (animationEntry.tracks[targetKey] = [])
  const next = { time: roundedTime, ...normalizePose(pose) }
  const existing = keys.findIndex((entry) => Math.abs(entry.time - roundedTime) <= 1)
  if (existing >= 0) keys.splice(existing, 1, next)
  else keys.push(next)
  keys.sort((a, b) => a.time - b.time)
}

export function removeShadowKeyframe(project, animationId, targetKey, time, tolerance = 8) {
  const keys = project.animations[animationId]?.tracks?.[targetKey]
  if (!keys) return false
  const index = keys.findIndex((entry) => Math.abs(entry.time - time) <= tolerance)
  if (index < 0) return false
  keys.splice(index, 1)
  return true
}

export function multiplyShadowMatrices(left, right) {
  return new Matrix4().multiplyMatrices(left, right)
}

export function shadowTransformMatrix({ x = 0, y = 0, z = 0, rotationX = 0, rotationY = 0, rotationZ = 0, scaleX = 1, scaleY = 1, scaleZ = 1 } = {}) {
  const radians = Math.PI / 180
  const rotation = new Quaternion().setFromEuler(new Euler(rotationX * radians, rotationY * radians, rotationZ * radians, 'XYZ'))
  return new Matrix4().compose(new Vector3(x, y, z), rotation, new Vector3(scaleX, scaleY, scaleZ))
}

export function shadowMatrixPosition(matrix) {
  const position = new Vector3().setFromMatrixPosition(matrix)
  return { x: position.x, y: position.y, z: position.z }
}

export function shadowMatrixEuler(matrix) {
  const rotation = new Quaternion()
  matrix.decompose(new Vector3(), rotation, new Vector3())
  const euler = new Euler().setFromQuaternion(rotation, 'XYZ')
  const degrees = 180 / Math.PI
  return { rotationX: euler.x * degrees, rotationY: euler.y * degrees, rotationZ: euler.z * degrees }
}

export function shadowBoneAttachmentMatrix(bone, t = 0.5, followRotation = true) {
  const ratio = clamp(finite(t, 0.5), 0, 1)
  const start = new Vector3(bone.x1, bone.y1, bone.z1)
  const end = new Vector3(bone.x2, bone.y2, bone.z2)
  const direction = end.clone().sub(start)
  const rotation = followRotation && direction.lengthSq() > 0.000001
    ? new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), direction.normalize())
    : new Quaternion()
  return new Matrix4().compose(start.lerp(end, ratio), rotation, new Vector3(1, 1, 1))
}

export function evaluateShadowProject(project, animationId = null, time = 0) {
  const animationEntry = animationId ? project.animations[animationId] : null
  const jointsById = new Map(project.joints.map((entry) => [entry.id, entry]))
  const incomingBone = new Map(project.bones.map((entry) => [entry.toJointId, entry]))
  const jointCache = new Map()
  const resolving = new Set()
  const resolveJoint = (joint) => {
    if (jointCache.has(joint.id)) return jointCache.get(joint.id)
    const pose = animationEntry ? sampleShadowTrack(animationEntry, shadowTargetKey('joint', joint.id), time) : defaultShadowPose()
    if (resolving.has(joint.id)) {
      const matrix = shadowTransformMatrix({ x: joint.x + pose.dx, y: joint.y + pose.dy, z: joint.z + pose.dz, rotationX: joint.rotationX + pose.rotationX, rotationY: joint.rotationY + pose.rotationY, rotationZ: joint.rotationZ + pose.rotationZ, scaleX: pose.scaleX, scaleY: pose.scaleY, scaleZ: pose.scaleZ })
      return { joint, pose, matrix, parentMatrix: new Matrix4() }
    }
    resolving.add(joint.id)
    const bone = incomingBone.get(joint.id)
    const parent = bone ? jointsById.get(bone.fromJointId) : null
    const parentEntry = parent ? resolveJoint(parent) : null
    const parentMatrix = parentEntry?.matrix || new Matrix4()
    const local = shadowTransformMatrix({ x: joint.x + pose.dx, y: joint.y + pose.dy, z: joint.z + pose.dz, rotationX: joint.rotationX + pose.rotationX, rotationY: joint.rotationY + pose.rotationY, rotationZ: joint.rotationZ + pose.rotationZ, scaleX: pose.scaleX, scaleY: pose.scaleY, scaleZ: pose.scaleZ })
    const matrix = parent ? multiplyShadowMatrices(parentMatrix, local) : local
    resolving.delete(joint.id)
    const result = { joint, pose, matrix, parentMatrix }
    jointCache.set(joint.id, result)
    return result
  }
  const joints = project.joints.map(resolveJoint)
  const evaluatedJoints = new Map(joints.map((entry) => [entry.joint.id, entry]))
  const bones = project.bones.flatMap((bone) => {
    const from = evaluatedJoints.get(bone.fromJointId)
    const to = evaluatedJoints.get(bone.toJointId)
    if (!from || !to) return []
    const start = shadowMatrixPosition(from.matrix)
    const end = shadowMatrixPosition(to.matrix)
    const dx = end.x - start.x
    const dy = end.y - start.y
    const dz = end.z - start.z
    return [{
      bone,
      from,
      to,
      x1: start.x,
      y1: start.y,
      z1: start.z,
      x2: end.x,
      y2: end.y,
      z2: end.z,
      length: Math.hypot(dx, dy, dz),
    }]
  })
  const evaluatedBones = new Map(bones.map((entry) => [entry.bone.id, entry]))
  const attachmentMatrix = (attachment) => {
    if (attachment.type === 'joint') return evaluatedJoints.get(attachment.targetId)?.matrix || new Matrix4()
    if (attachment.type === 'bone') {
      const bone = evaluatedBones.get(attachment.targetId)
      if (!bone) return new Matrix4()
      return shadowBoneAttachmentMatrix(bone, attachment.t, attachment.followRotation)
    }
    return new Matrix4()
  }
  const parts = project.parts.map((part, order) => {
    const pose = animationEntry ? sampleShadowTrack(animationEntry, shadowTargetKey('part', part.id), time) : defaultShadowPose()
    const baseMatrix = attachmentMatrix(part.attachment)
    const local = shadowTransformMatrix({ x: part.x + pose.dx, y: part.y + pose.dy, z: part.z + pose.dz, rotationX: part.rotationX + pose.rotationX, rotationY: part.rotationY + pose.rotationY, rotationZ: part.rotationZ + pose.rotationZ, scaleX: pose.scaleX, scaleY: pose.scaleY, scaleZ: pose.scaleZ })
    return {
      part,
      pose,
      baseMatrix,
      matrix: multiplyShadowMatrices(baseMatrix, local),
      opacity: part.opacity * pose.opacity,
      order,
    }
  }).sort((left, right) => left.part.layer - right.part.layer || left.order - right.order)
  return { joints, bones, parts, jointsById: evaluatedJoints, bonesById: evaluatedBones }
}

export function inverseShadowVector(matrix, dx, dy, dz = 0) {
  const inverse = matrix.clone().invert()
  const origin = new Vector3().applyMatrix4(inverse)
  const vector = new Vector3(dx, dy, dz).applyMatrix4(inverse).sub(origin)
  return { x: vector.x, y: vector.y, z: vector.z }
}

export function inverseShadowPoint(matrix, x, y, z = 0) {
  const point = new Vector3(x, y, z).applyMatrix4(matrix.clone().invert())
  return { x: point.x, y: point.y, z: point.z }
}

export function shadowMatrixRotation(matrix) {
  return shadowMatrixEuler(matrix).rotationZ
}

export function matrixToSvg(matrix) {
  const e = matrix.elements
  return `matrix(${e[0]} ${e[1]} ${e[4]} ${e[5]} ${e[12]} ${e[13]})`
}
