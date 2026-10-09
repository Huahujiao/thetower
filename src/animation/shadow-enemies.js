import { ENEMY_DEFS } from '../game/data/enemies.js'
import catalog from '../game/data/catalog.json' with { type: 'json' }
import { installEnemyGrounding, rebuildEnemyGrounding } from './enemy-grounding.js'
import { createRosterEnemyProject, ROSTER_ENEMY_ART } from './shadow-enemy-roster.js'
import { adjustEnemyComponentSpacing, alignGnawerRestPose, alignEnemyFrontalSkeleton, applyEnemyComponentArt, COMPONENT_ENEMY_IDS, BATCH2_COMPONENT_ENEMY_IDS, BATCH3_COMPONENT_ENEMY_IDS, BATCH4_COMPONENT_ENEMY_IDS, BATCH5_COMPONENT_ENEMY_IDS, componentTexturePresets, offsetGnawerForearms, widenEnemyComponentRig } from './shadow-enemy-components.js'
import {
  createDefaultShadowProject,
  createShadowBone,
  createShadowCharacter,
  createShadowJoint,
  createShadowPart,
  normalizeShadowProject,
  reflectShadowProjectY,
  shadowTargetKey,
  upsertShadowKeyframe,
} from './shadow-rig.js'

export const ENEMY_ART_PACK_VERSION = 23
export const ENEMY_ART = Object.freeze({
  gnawer: { family: 'humanoid' },
  'emberwing-moth': { family: 'winged' },
  'rootrot-bud': { family: 'rooted' },
  ...ROSTER_ENEMY_ART,
  'tide-shadow-cub': { family: 'floater' },
})

const PALETTE = {
  gnawer: { dark: '#282a31', body: '#504b4b', bone: '#b4a994', edge: '#d5c5a9', glow: '#ea8062' },
  'emberwing-moth': { dark: '#302b34', body: '#665658', bone: '#b69c84', edge: '#dbb88e', glow: '#f59b5d' },
  'rootrot-bud': { dark: '#25332e', body: '#51674d', bone: '#9baa80', edge: '#c5d19c', glow: '#cadf76' },
}

// Unedited V7 paper rigs from before the orientation correction.
const MISORIENTED_V7_RIGS = Object.freeze({
  'tide-shadow-cub': 'c9ccdbf1',
  'nest-spider': '3ce25935',
  'beetle-guard': 'd5e33c83',
  'patrol-hound': 'de53e0e1',
  'redneedle-salamander': '33234444',
  'rot-sac-toad': '870f0b8f',
  'claw-beast': '118d95a3',
  broodmother: 'b8ff05fa',
  'ash-cannon-bug': 'fd6697e',
  'furnace-beetle': '93ba8503',
  'molten-core-beast': 'd47ca94b',
  broodling: '239051f1',
})

function rigFingerprint(project) {
  const source = JSON.stringify([project.joints, project.bones, project.parts, project.animations])
  let hash = 2166136261
  for (let i = 0; i < source.length; i += 1) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619)
  return (hash >>> 0).toString(16)
}

function joint(project, id, name, x, y, z = 0, parentId = null) {
  project.joints.push(createShadowJoint({ id, name, x, y, z }))
  if (parentId) project.bones.push(createShadowBone({
    id: `bone-${parentId}-${id}`, name: `${parentId} → ${id}`, fromJointId: parentId, toJointId: id,
  }))
}

function part(project, id, name, shape, targetId, width, height, fill, options = {}) {
  const {
    x = 0, y = 0, z = 0, layer = 2, bone = false, rotationZ = 0,
    pivotX = .5, pivotY = .5, stroke = '#171d22',
  } = options
  project.parts.push(createShadowPart({
    id, name, shape, x, y, z, width, height, fill, stroke, layer,
    rotationZ, pivotX, pivotY,
    attachment: { type: bone ? 'bone' : 'joint', targetId, t: .5, followRotation: true },
  }))
}

function bonePart(project, id, name, from, to, thickness, fill, layer, extension = 8) {
  const child = project.joints.find((entry) => entry.id === to)
  const width = Math.hypot(child.x, child.y, child.z) + extension
  part(project, id, name, 'capsule', `bone-${from}-${to}`, width, thickness, fill, { bone: true, layer })
}

function pose(project, action, id, frames, kind = 'joint') {
  const duration = project.animations[action].duration
  for (const [position, values] of frames) {
    upsertShadowKeyframe(project, action, shadowTargetKey(kind, id), Math.round(duration * position), values)
  }
}

function cycle(project, action, id, middle, end = {}) {
  pose(project, action, id, [[0, {}], [.5, middle], [1, end]])
}

function gnawer(project) {
  const c = PALETTE.gnawer
  project.stage.floorOffset = 12
  joint(project, 'root', '胸椎', 0, 0)
  joint(project, 'neck', '颈', 0, -59, 4, 'root')
  joint(project, 'head', '头颅', 0, -37, 6, 'neck')
  joint(project, 'jaw', '下颌', 0, 32, 8, 'head')
  joint(project, 'pelvis', '骨盆', 0, 57, -2, 'root')
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? 'left' : 'right'
    const name = sign < 0 ? '左' : '右'
    joint(project, `${side}-shoulder`, `${name}肩`, sign * 44, -45, sign * 6, 'root')
    joint(project, `${side}-elbow`, `${name}肘`, sign * 18, 64, 4, `${side}-shoulder`)
    joint(project, `${side}-wrist`, `${name}腕`, sign * 13, 55, 7, `${side}-elbow`)
    joint(project, `${side}-hip`, `${name}髋`, sign * 27, 5, 3, 'pelvis')
    joint(project, `${side}-knee`, `${name}膝`, sign * 5, 67, 4, `${side}-hip`)
    joint(project, `${side}-ankle`, `${name}踝`, sign * 5, 65, 7, `${side}-knee`)
    for (let finger = 0; finger < 3; finger += 1) {
      joint(project, `${side}-claw-${finger}`, `${name}爪 ${finger + 1}`, sign * (finger - 1) * 13, 31 + (finger % 2) * 9, 3, `${side}-wrist`)
    }
  }
  part(project, 'coat', '破衣下摆', 'triangle', 'root', 122, 145, c.dark, { y: 39, layer: 1, stroke: c.body })
  part(project, 'ribcage', '肋骨胸腔', 'capsule', 'root', 88, 114, c.body, { y: -8, layer: 4, stroke: c.bone })
  for (let rib = 0; rib < 4; rib += 1) {
    part(project, `rib-${rib}`, `肋骨 ${rib + 1}`, 'capsule', 'root', 69 - rib * 5, 8, c.bone,
      { y: -39 + rib * 19, z: 10, layer: 5, stroke: c.edge })
  }
  part(project, 'sternum', '胸骨', 'capsule', 'root', 12, 85, c.bone, { y: -8, z: 12, layer: 6, stroke: c.edge })
  part(project, 'pelvis-shell', '骨盆', 'ellipse', 'pelvis', 77, 35, c.bone, { layer: 4, stroke: c.edge })
  part(project, 'skull', '颅骨', 'ellipse', 'head', 76, 83, c.bone, { layer: 9, stroke: c.edge })
  part(project, 'brow', '眉骨', 'capsule', 'head', 65, 13, c.dark, { y: -12, z: 12, layer: 10 })
  part(project, 'left-eye', '左眼', 'ellipse', 'head', 15, 17, c.glow, { x: -18, y: -5, z: 17, layer: 11 })
  part(project, 'right-eye', '右眼', 'ellipse', 'head', 11, 15, c.dark, { x: 18, y: -5, z: 17, layer: 11 })
  part(project, 'jaw-shell', '下颌骨', 'triangle', 'jaw', 52, 32, c.bone, { y: 7, rotationZ: 180, layer: 10, stroke: c.edge })
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? 'left' : 'right'
    const name = sign < 0 ? '左' : '右'
    const layer = sign < 0 ? 2 : 7
    bonePart(project, `${side}-upper-arm`, `${name}上臂`, `${side}-shoulder`, `${side}-elbow`, 26, c.bone, layer)
    bonePart(project, `${side}-forearm`, `${name}前臂`, `${side}-elbow`, `${side}-wrist`, 19, c.bone, layer + 1)
    part(project, `${side}-shoulder-guard`, `${name}肩甲`, 'ellipse', `${side}-shoulder`, 39, 32, c.body,
      { layer: layer + 2, stroke: c.edge })
    part(project, `${side}-palm`, `${name}掌骨`, 'ellipse', `${side}-wrist`, 31, 32, c.bone,
      { y: 9, layer: layer + 2, stroke: c.edge })
    for (let finger = 0; finger < 3; finger += 1) {
      bonePart(project, `${side}-talon-${finger}`, `${name}爪尖 ${finger + 1}`,
        `${side}-wrist`, `${side}-claw-${finger}`, 8, c.edge, layer + 3, 4)
    }
    bonePart(project, `${side}-thigh`, `${name}股骨`, `${side}-hip`, `${side}-knee`, 32, c.body, layer)
    bonePart(project, `${side}-shin`, `${name}胫骨`, `${side}-knee`, `${side}-ankle`, 23, c.bone, layer + 1)
    part(project, `${side}-foot`, `${name}足`, 'ellipse', `${side}-ankle`, 50, 26, c.dark,
      { x: sign * 10, y: 9, layer: layer + 2, stroke: c.edge })
  }
  cycle(project, 'idle', 'root', { dy: -4, rotationZ: 2 })
  cycle(project, 'idle', 'head', { rotationZ: -6, rotationX: 5 })
  cycle(project, 'idle', 'jaw', { rotationZ: 4 })
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1
    cycle(project, 'idle', `${side}-wrist`, { rotationZ: sign * 9 })
    for (let finger = 0; finger < 3; finger += 1) cycle(project, 'idle', `${side}-claw-${finger}`, { rotationZ: sign * (7 + finger * 3) })
  }
  pose(project, 'move', 'root', [[0, {}], [.25, { dx: -12, dy: -10, rotationZ: -5 }], [.5, { dx: -23 }], [.75, { dx: -11, dy: -9, rotationZ: 5 }], [1, {}]])
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1
    pose(project, 'move', `${side}-hip`, [[0, {}], [.25, { rotationZ: sign * 25 }], [.75, { rotationZ: -sign * 25 }], [1, {}]])
    pose(project, 'move', `${side}-knee`, [[0, {}], [.25, { rotationZ: -sign * 24, dy: sign < 0 ? -15 : 5 }], [.75, { rotationZ: sign * 24, dy: sign > 0 ? -15 : 5 }], [1, {}]])
    pose(project, 'move', `${side}-shoulder`, [[0, {}], [.25, { rotationZ: -sign * 16 }], [.75, { rotationZ: sign * 16 }], [1, {}]])
  }
  pose(project, 'attack', 'root', [[0, {}], [.28, { dx: 12, rotationZ: -10 }], [.68, { dx: -29, dz: 30, rotationZ: 11 }], [1, {}]])
  pose(project, 'attack', 'right-shoulder', [[0, {}], [.28, { rotationZ: 31 }], [.68, { rotationZ: -35, dz: 18 }], [1, {}]])
  pose(project, 'attack', 'right-elbow', [[0, {}], [.28, { rotationZ: 35 }], [.68, { rotationZ: -27 }], [1, {}]])
  pose(project, 'attack', 'right-wrist', [[0, {}], [.5, { rotationZ: 22 }], [.68, { rotationZ: -18 }], [1, {}]])
  pose(project, 'attack', 'left-shoulder', [[0, {}], [.68, { rotationZ: 20 }], [1, {}]])
  pose(project, 'attack', 'jaw', [[0, {}], [.28, { rotationZ: -12 }], [.68, { rotationZ: 23, dy: 11 }], [1, {}]])
  pose(project, 'attack', 'left-knee', [[0, {}], [.68, { rotationZ: -24, dx: -14 }], [1, {}]])
  pose(project, 'hit', 'root', [[0, {}], [.3, { dx: 22, dz: -27, rotationZ: 18 }], [1, {}]])
  pose(project, 'hit', 'head', [[0, {}], [.3, { rotationZ: -26, rotationX: 14 }], [1, {}]])
  pose(project, 'hit', 'left-shoulder', [[0, {}], [.3, { rotationZ: -33 }], [1, {}]])
  pose(project, 'hit', 'right-shoulder', [[0, {}], [.3, { rotationZ: 33 }], [1, {}]])
  pose(project, 'death', 'root', [[0, {}], [.35, { dy: 39, rotationZ: -18 }], [1, { dy: 135, rotationZ: 78, dz: -25 }]])
  pose(project, 'death', 'head', [[0, {}], [.45, { rotationZ: -31 }], [1, { rotationZ: 39, rotationX: 35 }]])
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1
    pose(project, 'death', `${side}-knee`, [[0, {}], [.45, { rotationZ: sign * 40 }], [1, { rotationZ: sign * 73 }]])
    pose(project, 'death', `${side}-shoulder`, [[0, {}], [1, { rotationZ: sign * 61 }]])
  }
}

function emberwingMoth(project) {
  const c = PALETTE['emberwing-moth']
  project.stage.floorOffset = 47
  joint(project, 'root', '胸节', 0, 0)
  joint(project, 'head', '灯首', 0, -62, 12, 'root')
  joint(project, 'abdomen', '腹节', 0, 53, -8, 'root')
  joint(project, 'tail', '尾焰', 0, 56, -6, 'abdomen')
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? 'left' : 'right'
    const name = sign < 0 ? '左' : '右'
    joint(project, `${side}-wing`, `${name}翅根`, sign * 40, -36, sign * 4, 'root')
    joint(project, `${side}-wing-elbow`, `${name}翅节`, sign * 75, -15, sign * 2, `${side}-wing`)
    joint(project, `${side}-wing-tip`, `${name}翅尖`, sign * 77, -27, sign * 3, `${side}-wing-elbow`)
    joint(project, `${side}-antenna`, `${name}触角根`, sign * 19, -25, 3, 'head')
    joint(project, `${side}-antenna-tip`, `${name}触角尖`, sign * 28, -24, 2, `${side}-antenna`)
    for (let index = 0; index < 2; index += 1) {
      const leg = `${side}-leg-${index}`
      joint(project, leg, `${name}足 ${index + 1}`, sign * (20 + index * 15), 34 + index * 13, sign * 5, 'root')
      joint(project, `${leg}-tip`, `${name}足尖 ${index + 1}`, sign * 15, 61, 6, leg)
    }
  }
  part(project, 'thorax', '胸甲', 'capsule', 'root', 79, 105, c.body, { layer: 6, stroke: c.edge })
  part(project, 'thorax-seam', '胸甲缝', 'diamond', 'root', 25, 68, c.dark, { z: 10, layer: 7, stroke: c.glow })
  part(project, 'abdomen-shell', '环节腹部', 'ellipse', 'abdomen', 64, 91, c.dark, { layer: 5, stroke: c.edge })
  for (let band = 0; band < 3; band += 1) {
    part(project, `abdomen-band-${band}`, `腹部环纹 ${band + 1}`, 'capsule', 'abdomen', 52 - band * 7, 7, c.body,
      { y: -24 + band * 21, z: 10, layer: 6, stroke: c.glow })
  }
  part(project, 'head-shell', '灯首外壳', 'ellipse', 'head', 65, 64, c.body, { layer: 9, stroke: c.edge })
  part(project, 'left-eye', '左复眼', 'ellipse', 'head', 19, 24, c.glow, { x: -17, z: 12, layer: 10 })
  part(project, 'right-eye', '右复眼', 'ellipse', 'head', 19, 24, c.glow, { x: 17, z: 12, layer: 10 })
  part(project, 'beak', '口器', 'triangle', 'head', 18, 31, c.bone, { y: 25, rotationZ: 180, layer: 11 })
  part(project, 'tail-flame', '尾部余烬', 'diamond', 'tail', 40, 60, c.glow, { y: 21, layer: 7, stroke: c.edge })
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? 'left' : 'right'
    const name = sign < 0 ? '左' : '右'
    const layer = sign < 0 ? 2 : 4
    part(project, `${side}-inner-wing`, `${name}内翅膜`, 'ellipse', `bone-${side}-wing-${side}-wing-elbow`, 102, 77, c.body,
      { bone: true, layer, stroke: c.edge })
    part(project, `${side}-outer-wing`, `${name}外翅膜`, 'ellipse', `bone-${side}-wing-elbow-${side}-wing-tip`, 108, 66, c.dark,
      { bone: true, layer: layer + 1, stroke: c.edge })
    bonePart(project, `${side}-wing-vein`, `${name}翅脉`, `${side}-wing`, `${side}-wing-elbow`, 7, c.bone, layer + 2, 5)
    bonePart(project, `${side}-outer-vein`, `${name}外翅脉`, `${side}-wing-elbow`, `${side}-wing-tip`, 6, c.bone, layer + 2, 5)
    part(project, `${side}-wing-eye`, `${name}翅眼`, 'ellipse', `${side}-wing-elbow`, 28, 28, c.glow,
      { y: 8, z: 7, layer: layer + 3, stroke: c.dark })
    bonePart(project, `${side}-antenna-part`, `${name}触角`, `${side}-antenna`, `${side}-antenna-tip`, 7, c.bone, 11, 4)
    for (let index = 0; index < 2; index += 1) {
      bonePart(project, `${side}-leg-${index}-part`, `${name}足 ${index + 1}`, `${side}-leg-${index}`, `${side}-leg-${index}-tip`, 8, c.bone, 4, 4)
    }
  }
  cycle(project, 'idle', 'root', { dy: -12, rotationZ: 3 })
  cycle(project, 'idle', 'abdomen', { rotationZ: -6, dy: 4 })
  cycle(project, 'idle', 'tail', { rotationZ: 9 })
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1
    cycle(project, 'idle', `${side}-wing`, { rotationZ: sign * 23, rotationX: sign * 13 })
    cycle(project, 'idle', `${side}-wing-elbow`, { rotationZ: sign * 15 })
    cycle(project, 'idle', `${side}-antenna`, { rotationZ: sign * 6 })
  }
  pose(project, 'move', 'root', [[0, {}], [.25, { dx: -8, dy: -18, rotationZ: -6 }], [.5, { dx: -21 }], [.75, { dx: -13, dy: 8, rotationZ: 6 }], [1, {}]])
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1
    pose(project, 'move', `${side}-wing`, [[0, {}], [.25, { rotationZ: sign * 36, rotationX: sign * 25 }], [.75, { rotationZ: -sign * 29, rotationX: -sign * 18 }], [1, {}]])
    pose(project, 'move', `${side}-wing-elbow`, [[0, {}], [.25, { rotationZ: sign * 26 }], [.75, { rotationZ: -sign * 18 }], [1, {}]])
  }
  pose(project, 'attack', 'root', [[0, {}], [.3, { dy: -22, rotationX: -12 }], [.69, { dx: -23, dy: 17, dz: 42, rotationX: 19 }], [1, {}]])
  pose(project, 'attack', 'head', [[0, {}], [.3, { rotationX: -12 }], [.69, { rotationX: 29, dy: 11 }], [1, {}]])
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1
    pose(project, 'attack', `${side}-wing`, [[0, {}], [.3, { rotationZ: sign * 42 }], [.69, { rotationZ: -sign * 34, dz: 27 }], [1, {}]])
    pose(project, 'attack', `${side}-wing-elbow`, [[0, {}], [.3, { rotationZ: sign * 27 }], [.69, { rotationZ: -sign * 38 }], [1, {}]])
  }
  pose(project, 'hit', 'root', [[0, {}], [.31, { dx: 24, dz: -31, rotationZ: 17 }], [1, {}]])
  pose(project, 'hit', 'left-wing', [[0, {}], [.31, { rotationZ: -47 }], [1, {}]])
  pose(project, 'hit', 'right-wing', [[0, {}], [.31, { rotationZ: 47 }], [1, {}]])
  pose(project, 'death', 'root', [[0, {}], [.35, { dy: 21, rotationZ: -16 }], [1, { dy: 139, rotationZ: 71, dz: -32 }]])
  pose(project, 'death', 'left-wing', [[0, {}], [1, { rotationZ: 73, rotationX: 41 }]])
  pose(project, 'death', 'right-wing', [[0, {}], [1, { rotationZ: -73, rotationX: -41 }]])
  pose(project, 'death', 'tail', [[0, {}], [1, { rotationZ: 29 }]])
}

function rootrotBud(project) {
  const c = PALETTE['rootrot-bud']
  project.stage.floorOffset = 6
  joint(project, 'root', '根球', 0, 0)
  joint(project, 'lower-stem', '下茎', 0, -54, 2, 'root')
  joint(project, 'upper-stem', '上茎', 0, -54, 2, 'lower-stem')
  joint(project, 'bud', '花芽', 0, -30, 8, 'upper-stem')
  joint(project, 'mouth', '花心', 0, 8, 13, 'bud')
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? 'left' : 'right'
    const name = sign < 0 ? '左' : '右'
    joint(project, `${side}-root`, `${name}主根`, sign * 49, 34, -3, 'root')
    joint(project, `${side}-root-tip`, `${name}根尖`, sign * 54, 31, 4, `${side}-root`)
    joint(project, `${side}-petal`, `${name}花瓣铰链`, sign * 31, -3, sign * 3, 'bud')
    joint(project, `${side}-petal-tip`, `${name}花瓣尖`, sign * 55, -20, 4, `${side}-petal`)
    joint(project, `${side}-thorn`, `${name}刺瓣`, sign * 43, -14, 5, `${side}-petal-tip`)
    joint(project, `${side}-leaf`, `${name}侧叶`, sign * 39, -16, sign * 2, 'lower-stem')
    joint(project, `${side}-upper-petal`, `${name}上花萼`, sign * 26, -31, sign * 3, 'bud')
    joint(project, `${side}-upper-petal-tip`, `${name}上花萼尖`, sign * 40, -36, 4, `${side}-upper-petal`)
  }
  part(project, 'bulb', '根球外壳', 'ellipse', 'root', 94, 79, c.body, { y: 20, layer: 4, stroke: c.edge })
  part(project, 'bulb-mark', '根球裂纹', 'diamond', 'root', 39, 48, c.dark, { y: 14, z: 12, layer: 5, stroke: c.glow })
  bonePart(project, 'lower-stem-part', '下茎护皮', 'root', 'lower-stem', 37, c.body, 5, 14)
  bonePart(project, 'upper-stem-part', '上茎护皮', 'lower-stem', 'upper-stem', 29, c.bone, 5, 12)
  part(project, 'bud-shell', '花芽外瓣', 'ellipse', 'bud', 100, 93, c.body, { layer: 9, stroke: c.edge })
  part(project, 'bud-core', '暗色花心', 'ellipse', 'mouth', 53, 59, c.dark, { z: 11, layer: 10, stroke: c.glow })
  part(project, 'bud-eye', '芽眼', 'ellipse', 'mouth', 23, 35, c.glow, { z: 17, layer: 11, stroke: c.edge })
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? 'left' : 'right'
    const name = sign < 0 ? '左' : '右'
    const layer = sign < 0 ? 6 : 8
    bonePart(project, `${side}-root-part`, `${name}主根`, 'root', `${side}-root`, 24, c.body, 2, 14)
    bonePart(project, `${side}-root-tip-part`, `${name}根尖`, `${side}-root`, `${side}-root-tip`, 15, c.bone, 3, 9)
    part(project, `${side}-petal-part`, `${name}宽瓣`, 'diamond', `bone-${side}-petal-${side}-petal-tip`, 82, 53, c.body,
      { bone: true, layer, stroke: c.edge })
    part(project, `${side}-petal-vein`, `${name}叶脉`, 'capsule', `bone-${side}-petal-${side}-petal-tip`, 66, 6, c.bone,
      { bone: true, layer: layer + 1, stroke: c.edge })
    bonePart(project, `${side}-thorn-part`, `${name}刺瓣`, `${side}-petal-tip`, `${side}-thorn`, 12, c.glow, layer + 1, 10)
    part(project, `${side}-leaf-part`, `${name}侧叶`, 'diamond', `bone-lower-stem-${side}-leaf`, 48, 27, c.body,
      { bone: true, layer: 6, stroke: c.edge })
    part(project, `${side}-upper-petal-part`, `${name}上花萼`, 'diamond', `bone-${side}-upper-petal-${side}-upper-petal-tip`, 65, 36, c.bone,
      { bone: true, layer: 7, stroke: c.edge })
  }
  cycle(project, 'idle', 'root', { dy: -2 })
  cycle(project, 'idle', 'lower-stem', { rotationZ: 3 })
  cycle(project, 'idle', 'upper-stem', { rotationZ: -6 })
  cycle(project, 'idle', 'mouth', { dy: 3 })
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1
    cycle(project, 'idle', `${side}-petal`, { rotationZ: sign * 12 })
    cycle(project, 'idle', `${side}-petal-tip`, { rotationZ: sign * 7 })
    cycle(project, 'idle', `${side}-upper-petal`, { rotationZ: -sign * 8 })
  }
  pose(project, 'move', 'root', [[0, {}], [.25, { dx: -6, dy: -5 }], [.5, { dx: -18 }], [.75, { dx: -12, dy: -5 }], [1, {}]])
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1
    pose(project, 'move', `${side}-root`, [[0, {}], [.25, { rotationZ: sign * 16 }], [.75, { rotationZ: -sign * 18 }], [1, {}]])
    pose(project, 'move', `${side}-root-tip`, [[0, {}], [.25, { rotationZ: -sign * 20 }], [.75, { rotationZ: sign * 20 }], [1, {}]])
  }
  pose(project, 'attack', 'root', [[0, {}], [.28, { dx: 4 }], [.69, { dx: -10, dz: 17 }], [1, {}]])
  pose(project, 'attack', 'lower-stem', [[0, {}], [.28, { rotationZ: -17 }], [.69, { rotationZ: 21, dy: -9 }], [1, {}]])
  pose(project, 'attack', 'upper-stem', [[0, {}], [.28, { rotationZ: -16 }], [.69, { rotationZ: 26, dz: 18 }], [1, {}]])
  pose(project, 'attack', 'mouth', [[0, {}], [.28, { dy: -8 }], [.69, { dy: 12, dz: 17 }], [1, {}]])
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1
    pose(project, 'attack', `${side}-petal`, [[0, {}], [.28, { rotationZ: -sign * 24 }], [.69, { rotationZ: sign * 34 }], [1, {}]])
    pose(project, 'attack', `${side}-thorn`, [[0, {}], [.28, { rotationZ: -sign * 14 }], [.69, { rotationZ: sign * 34, dz: 18 }], [1, {}]])
    pose(project, 'attack', `${side}-upper-petal`, [[0, {}], [.28, { rotationZ: sign * 17 }], [.69, { rotationZ: -sign * 36 }], [1, {}]])
  }
  pose(project, 'hit', 'root', [[0, {}], [.3, { dx: 15, dz: -20 }], [1, {}]])
  pose(project, 'hit', 'upper-stem', [[0, {}], [.3, { rotationZ: -27, dy: 13 }], [1, {}]])
  pose(project, 'hit', 'bud', [[0, {}], [.3, { rotationZ: -17 }], [1, {}]])
  pose(project, 'death', 'root', [[0, {}], [.4, { dy: 13 }], [1, { dy: 51, rotationZ: 25 }]])
  pose(project, 'death', 'lower-stem', [[0, {}], [1, { rotationZ: 58 }]])
  pose(project, 'death', 'upper-stem', [[0, {}], [1, { rotationZ: 39, dy: 25 }]])
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1
    pose(project, 'death', `${side}-petal`, [[0, {}], [1, { rotationZ: sign * 54 }]])
    pose(project, 'death', `${side}-upper-petal`, [[0, {}], [1, { rotationZ: sign * 69 }]])
    pose(project, 'death', `${side}-root`, [[0, {}], [1, { rotationZ: -sign * 25 }]])
  }
}

const BUILD = { gnawer, 'emberwing-moth': emberwingMoth, 'rootrot-bud': rootrotBud }

function sculptDepth(project) {
  const joints = new Map(project.joints.map((entry) => [entry.id, entry]))
  const parts = new Map(project.parts.map((entry) => [entry.id, entry]))
  const jointDepth = (id, z) => { if (joints.has(id)) joints.get(id).z = z }
  const surface = (id, z) => {
    const entry = parts.get(id)
    if (!entry) return
    entry.depth = 0
    if (z !== undefined) entry.z = z
  }
  joints.get('root').rotationY = -30
  for (const entry of project.parts) entry.depth = 0
  if (project.enemyId === 'gnawer') {
    jointDepth('neck', 12)
    jointDepth('head', 19)
    jointDepth('jaw', 21)
    jointDepth('pelvis', -8)
    surface('coat', -29)
    surface('sternum', 1)
    surface('brow', 1)
    surface('left-eye', 1)
    surface('right-eye', 1)
    for (let rib = 0; rib < 4; rib += 1) surface(`rib-${rib}`, 1)
    for (const side of ['left', 'right']) {
      const near = side === 'right'
      jointDepth(`${side}-shoulder`, near ? 17 : -15)
      jointDepth(`${side}-elbow`, near ? 19 : -12)
      jointDepth(`${side}-wrist`, 20)
      jointDepth(`${side}-hip`, near ? 12 : -12)
      jointDepth(`${side}-knee`, near ? 14 : -9)
      jointDepth(`${side}-ankle`, 20)
      surface(`${side}-shoulder-guard`, 5)
      surface(`${side}-foot`, 16)
    }
  } else if (project.enemyId === 'emberwing-moth') {
    jointDepth('head', 25)
    jointDepth('abdomen', -21)
    jointDepth('tail', -25)
    surface('thorax-seam', 1)
    surface('left-eye', 1)
    surface('right-eye', 1)
    surface('beak', 1)
    for (let band = 0; band < 3; band += 1) surface(`abdomen-band-${band}`, 1)
    for (const side of ['left', 'right']) {
      const sign = side === 'left' ? -1 : 1
      jointDepth(`${side}-wing`, -22)
      jointDepth(`${side}-wing-elbow`, sign * 20)
      jointDepth(`${side}-wing-tip`, sign * 24)
      jointDepth(`${side}-antenna`, 12)
      jointDepth(`${side}-antenna-tip`, 15)
      parts.get(`${side}-inner-wing`).rotationX = sign * 16
      parts.get(`${side}-outer-wing`).rotationX = sign * 23
      surface(`${side}-wing-vein`, 8)
      surface(`${side}-outer-vein`, 7)
      surface(`${side}-wing-eye`, 14)
      for (let index = 0; index < 2; index += 1) {
        jointDepth(`${side}-leg-${index}`, 12 + index * 18)
        jointDepth(`${side}-leg-${index}-tip`, 17)
      }
    }
  } else {
    jointDepth('lower-stem', -9)
    jointDepth('upper-stem', 16)
    jointDepth('bud', 26)
    jointDepth('mouth', 2)
    surface('bulb-mark', 1)
    surface('bud-core', 0)
    surface('bud-eye', 1)
    for (const side of ['left', 'right']) {
      const sign = side === 'left' ? -1 : 1
      jointDepth(`${side}-root`, sign * 32)
      jointDepth(`${side}-root-tip`, sign * 17)
      jointDepth(`${side}-petal`, sign * 19)
      jointDepth(`${side}-petal-tip`, 14)
      jointDepth(`${side}-thorn`, 18)
      jointDepth(`${side}-upper-petal`, -21)
      jointDepth(`${side}-upper-petal-tip`, -16)
      jointDepth(`${side}-leaf`, sign * 24)
      parts.get(`${side}-petal-part`).rotationX = sign * 24
      surface(`${side}-petal-vein`, 10)
      parts.get(`${side}-upper-petal-part`).rotationX = -sign * 21
    }
  }
  // Bone-bound geometry must span the new 3D segment, including its depth.
  for (const entry of project.parts) {
    if (entry.attachment.type !== 'bone' || entry.shape !== 'capsule') continue
    const bone = project.bones.find((bone) => bone.id === entry.attachment.targetId)
    const child = joints.get(bone.toJointId)
    entry.width = Math.max(entry.width, Math.hypot(child.x, child.y, child.z) + 8)
  }
}

export function createEnemyShadowProject(definition, { withComponentArt = true } = {}) {
  const build = BUILD[definition?.id]
  const project = build ? createDefaultShadowProject() : createRosterEnemyProject(definition)
  if (!project) return null
  if (build) {
    project.name = definition.name
    project.enemyId = definition.id
    build(project)
    // Import the original screen-space draft once into the V5 world convention.
    reflectShadowProjectY(project)
    sculptDepth(project)
  }
  if (!withComponentArt) return project
  applyEnemyComponentArt(project)
  faceEnemyForward(project)
  return installEnemyGrounding(project)
}

function faceEnemyForward(project) {
  if (!project.enemyId) return
  const root = project.joints.find((joint) => joint.id === 'root')
  if (root) root.rotationY = 0
}

export function createEnemyShadowProjects({ includeBoss = false } = {}) {
  return (includeBoss ? [...ENEMY_DEFS, catalog.boss] : ENEMY_DEFS).map(createEnemyShadowProject).filter(Boolean)
}

function replaceComponentTemplate(roster, character, template, previousFingerprints = []) {
  const definition = ENEMY_DEFS.find(({ id }) => id === template.enemyId) || (template.enemyId === catalog.boss.id ? catalog.boss : null)
  const previous = normalizeShadowProject(createEnemyShadowProject(definition, { withComponentArt: false }))
  const generic = ROSTER_ENEMY_ART[template.enemyId]
    ? normalizeShadowProject(createRosterEnemyProject(definition, { withVariants: false })) : previous
  const fingerprint = rigFingerprint(character.project)
  const pristine = character.project.name === previous.name
    && [previous.stage, template.stage].some(stage => JSON.stringify(character.project.stage) === JSON.stringify(stage))
    && [rigFingerprint(previous), rigFingerprint(generic), rigFingerprint(normalizeShadowProject(template)), ...previousFingerprints].includes(fingerprint)
  if (!pristine) roster.characters.push(createShadowCharacter({
    ...character.project, name: `${character.project.name} · 旧版备份`, enemyId: null,
  }))
  character.project = template
}

export function installEnemyShadowProjects(roster) {
  let namesUpdated = false
  for (const { project } of roster.characters) {
    if (!project.enemyId) continue
    const name = project.name.replace(/ \u00b7 \u9aa8\u67b6\u9884\u89c8$/u, '')
    if (name === project.name) continue
    project.name = name
    namesUpdated = true
  }
  if (roster.enemyArtPackVersion < ENEMY_ART_PACK_VERSION) {
    for (const character of [...roster.characters]) {
      const { project } = character
      if (roster.enemyArtPackVersion < 20) alignGnawerRestPose(project, roster.enemyArtPackVersion)
      if (project.enemyId === 'rootrot-bud' && roster.enemyArtPackVersion >= 10 && roster.enemyArtPackVersion < 22) {
        const template = createEnemyShadowProject(ENEMY_DEFS.find(d => d.id === 'rootrot-bud'))
        // Fingerprint of the pristine V21 bud; edited rigs retain a backup.
        replaceComponentTemplate(roster, character, template, ['6a1ef459'])
      } else {
        if (project.enemyId === 'gnawer' && roster.enemyArtPackVersion < 22) {
          alignEnemyFrontalSkeleton(project)
          rebuildEnemyGrounding(project)
        }
        adjustEnemyComponentSpacing(project)
      }
    }
  }
  if (roster.enemyArtPackVersion >= ENEMY_ART_PACK_VERSION) return namesUpdated
  // V10/V11 already have component art. Apply small rig adjustments in place
  // so saved custom poses, textures, selection and other enemies remain intact.
  if (roster.enemyArtPackVersion >= 10) {
    for (const { project } of roster.characters) {
      if (roster.enemyArtPackVersion === 10) offsetGnawerForearms(project)
      if (roster.enemyArtPackVersion < 12) widenEnemyComponentRig(project)
    }
    const newIds = [...(roster.enemyArtPackVersion < 13 ? BATCH2_COMPONENT_ENEMY_IDS : []), ...(roster.enemyArtPackVersion < 14 ? BATCH3_COMPONENT_ENEMY_IDS : []), ...(roster.enemyArtPackVersion < 15 ? BATCH4_COMPONENT_ENEMY_IDS : []), ...(roster.enemyArtPackVersion < 17 ? BATCH5_COMPONENT_ENEMY_IDS : [])]
    for (const enemyId of newIds) {
      const template = createEnemyShadowProject(ENEMY_DEFS.find(d => d.id === enemyId) || (enemyId === catalog.boss.id ? catalog.boss : null))
      const character = roster.characters.find(({ project }) => project.enemyId === enemyId)
      if (character) replaceComponentTemplate(roster, character, template)
      else roster.characters.push(createShadowCharacter(template))
    }
    for (const { project } of roster.characters) {
      faceEnemyForward(project)
      installEnemyGrounding(project)
    }
    roster.enemyArtPackVersion = ENEMY_ART_PACK_VERSION
    return true
  }
  let reviewCharacterId = null
  for (const template of createEnemyShadowProjects({ includeBoss: true })) {
    const character = roster.characters.find(({ project }) => project.enemyId === template.enemyId)
    // Pre-paper projects contain rejected atlas cutouts. V7/V8 roster rigs
    // share generic anatomy; archive edited versions before replacing them.
    if (character && COMPONENT_ENEMY_IDS.includes(template.enemyId)) {
      replaceComponentTemplate(roster, character, template)
    }
    else if (character && roster.enemyArtPackVersion >= 7 && roster.enemyArtPackVersion < 9
      && ROSTER_ENEMY_ART[template.enemyId]) {
      const fingerprint = rigFingerprint(character.project)
      const original = createRosterEnemyProject(ENEMY_DEFS.find(({ id }) => id === template.enemyId), { withVariants: false })
      const originalFingerprint = rigFingerprint(normalizeShadowProject(original))
      const pristine = character.project.name === template.name
        && JSON.stringify(character.project.stage) === JSON.stringify(template.stage)
        && (originalFingerprint === fingerprint
          || (roster.enemyArtPackVersion === 7 && MISORIENTED_V7_RIGS[template.enemyId] === fingerprint))
      if (!pristine) roster.characters.push(createShadowCharacter({
        ...character.project, name: `${character.project.name} · 旧版备份`, enemyId: null,
      }))
      character.project = template
    } else if (!character) roster.characters.push(createShadowCharacter(template))
    if (template.enemyId === 'gnawer') {
      reviewCharacterId = (character || roster.characters.at(-1)).id
    }
  }
  if (!roster.activeCharacterId || !roster.characters.some(({ id }) => id === roster.activeCharacterId)) {
    roster.activeCharacterId = reviewCharacterId
  }
  for (const { project } of roster.characters) {
    faceEnemyForward(project)
    installEnemyGrounding(project)
  }
  roster.enemyArtPackVersion = ENEMY_ART_PACK_VERSION
  return true
}

export function enemyTexturePresets(enemyId) { return componentTexturePresets(enemyId) }
