import {
  createDefaultShadowProject, createShadowBone, createShadowJoint, createShadowPart,
  shadowTargetKey, upsertShadowKeyframe,
} from './shadow-rig.js'
import { applyEnemyVariant } from './shadow-enemy-variants.js'

// These rigs are authored in world coordinates: +Y is up and +Z faces the viewer.
// Every surface is a zero-thickness paper cutout; depth only places the hinges.
const DESIGNS = {
  'tide-shadow-cub': ['quadruped', '#344b58', '#73919a', '#a7c2bd', 'claw'],
  'nest-spider': ['arthropod', '#353b3b', '#777e71', '#b5ad88', 'fang'],
  'beetle-guard': ['arthropod', '#383d32', '#78816c', '#c1ad76', 'shield'],
  'rot-walker': ['humanoid', '#373c35', '#6b765f', '#bdab83', 'claw'],
  shellguard: ['humanoid', '#353b41', '#77838a', '#b8b4a1', 'shield'],
  wisp: ['floater', '#303b4c', '#789caa', '#bddde0', 'spear'],
  'patrol-hound': ['quadruped', '#3a3838', '#8e7b71', '#d3b299', 'fang'],
  'redneedle-salamander': ['quadruped', '#50332e', '#b66a47', '#e7ad76', 'needle'],
  'rot-sac-toad': ['toad', '#354237', '#718660', '#b8ba83', 'tongue'],
  'claw-beast': ['quadruped', '#293f4b', '#668597', '#a4c1c8', 'claw'],
  broodmother: ['arthropod', '#45343a', '#977078', '#d2b095', 'abdomen'],
  'moss-colossus': ['humanoid', '#344334', '#70815e', '#b4bc84', 'fist'],
  'sentry-crossbow': ['humanoid', '#393a40', '#797a7e', '#c7b28b', 'crossbow'],
  'ash-cannon-bug': ['arthropod', '#413733', '#8a7063', '#d9aa7d', 'cannon'],
  'furnace-beetle': ['arthropod', '#48332f', '#a45940', '#edaa72', 'core'],
  'thorn-shell-flower': ['plant', '#344137', '#69835a', '#c6ba88', 'thorn'],
  'water-leech-swarm': ['swarm', '#293e46', '#62818a', '#a1bdba', 'bite'],
  'whirlpool-eye-sac': ['floater', '#2c4250', '#688fa1', '#b2d1cf', 'eye'],
  'molten-core-beast': ['quadruped', '#483332', '#a46247', '#f1b679', 'core'],
  'redwheel-fire-crow': ['bird', '#42302e', '#ad6047', '#eab174', 'beak'],
  'cinder-curse-lamp-swarm': ['swarm', '#493635', '#ab7158', '#e8b47e', 'flame'],
  'tide-rite-matriarch': ['humanoid', '#30424a', '#71919a', '#c5d1bf', 'staff'],
  'drown-shadow-hunter': ['humanoid', '#293b45', '#5e7c8b', '#a9c0c4', 'claw'],
  'tidal-spore-sac': ['plant', '#314850', '#7699a0', '#b8caba', 'spore'],
  'revenant-guard': ['humanoid', '#3a3b3b', '#828179', '#c7baa0', 'blade'],
  'bomb-wisp': ['floater', '#463330', '#a4654f', '#efb277', 'core'],
  'cracked-hunter': ['humanoid', '#39373b', '#80767c', '#d0ad90', 'claw'],
  broodling: ['arthropod', '#46373b', '#8c6971', '#c6a28b', 'fang'],
  'leech-larva': ['swarm', '#303d42', '#64818a', '#a0bbb6', 'bite'],
  'tide-shadow': ['floater', '#273b49', '#5c8093', '#a6bdc6', 'claw'],
}

function j(p, id, name, x, y, z, parent) {
  p.joints.push(createShadowJoint({ id, name, x, y, z }))
  if (parent) p.bones.push(createShadowBone({ id: `b-${parent}-${id}`, name: `${parent} / ${id}`, fromJointId: parent, toJointId: id }))
}

function s(p, id, name, shape, targetId, width, height, fill, options = {}) {
  const { bone = false, stroke = '#202529', layer = 4, ...rest } = options
  p.parts.push(createShadowPart({
    id, name, shape, width, height, fill, stroke, layer, depth: 0, ...rest,
    attachment: { type: bone ? 'bone' : 'joint', targetId, t: .5, followRotation: true },
  }))
}

function link(p, id, name, from, to, thickness, fill, layer = 4) {
  const end = p.joints.find((entry) => entry.id === to)
  s(p, id, name, 'capsule', `b-${from}-${to}`, Math.hypot(end.x, end.y, end.z) + 12, thickness, fill, { bone: true, layer })
}

function keys(p, action, id, frames) {
  const duration = p.animations[action].duration
  for (const [fraction, values] of frames) {
    upsertShadowKeyframe(p, action, shadowTargetKey('joint', id), Math.round(duration * fraction), values)
  }
}

const loop = (p, action, id, middle) => keys(p, action, id, [[0, {}], [.5, middle], [1, {}]])
const strike = (p, id, windup, release) => keys(p, 'attack', id, [[0, {}], [.27, windup], [.64, release], [1, {}]])
const stagger = (p, id, impact) => keys(p, 'hit', id, [[0, {}], [.28, impact], [1, {}]])
const fall = (p, id, end) => keys(p, 'death', id, [[0, {}], [.38, { rotationZ: (end.rotationZ || 0) * .35, dy: (end.dy || 0) * .25 }], [1, end]])

function humanoid(p, c, organ) {
  j(p, 'root', '胸腔', 0, 0, 0)
  j(p, 'neck', '颈', 0, 61, 8, 'root')
  j(p, 'head', '头', 0, 38, 8, 'neck')
  j(p, 'jaw', '颌', 0, -23, 8, 'head')
  j(p, 'pelvis', '骨盆', 0, -60, -8, 'root')
  s(p, 'torso', '胸甲', 'ellipse', 'root', 94, 119, c.body, { layer: 6 })
  s(p, 'spine', '脊线', 'capsule', 'root', 13, 85, c.edge, { z: 3, layer: 7 })
  s(p, 'hips', '骨盆甲', 'ellipse', 'pelvis', 75, 40, c.body)
  s(p, 'skull', '头颅', 'ellipse', 'head', 68, 77, c.edge, { layer: 8 })
  s(p, 'face', '面罩', 'diamond', 'head', 43, 47, c.dark, { z: 2, layer: 9 })
  s(p, 'eyes', '眼光', 'capsule', 'head', 35, 9, c.glow, { y: 5, z: 4, layer: 10 })
  s(p, 'jaw-plate', '下颌', 'triangle', 'jaw', 47, 31, c.body, { rotationZ: 180, layer: 8 })
  for (const side of ['left', 'right']) {
    const v = side === 'left' ? -1 : 1
    const near = v > 0 ? 15 : -17
    j(p, `${side}-shoulder`, `${side} shoulder`, v * 47, 43, near, 'root')
    j(p, `${side}-elbow`, `${side} elbow`, v * 27, -54, 5, `${side}-shoulder`)
    j(p, `${side}-wrist`, `${side} wrist`, v * 18, -52, 7, `${side}-elbow`)
    j(p, `${side}-finger`, `${side} claw`, v * 13, -31, 5, `${side}-wrist`)
    j(p, `${side}-hip`, `${side} hip`, v * 27, -7, near, 'pelvis')
    j(p, `${side}-knee`, `${side} knee`, v * 7, -65, 5, `${side}-hip`)
    j(p, `${side}-ankle`, `${side} ankle`, v * 7, -65, 7, `${side}-knee`)
    link(p, `${side}-arm`, '上臂', `${side}-shoulder`, `${side}-elbow`, 25, c.body, v > 0 ? 8 : 2)
    link(p, `${side}-forearm`, '前臂', `${side}-elbow`, `${side}-wrist`, 20, c.edge, v > 0 ? 8 : 2)
    link(p, `${side}-claw`, '指爪', `${side}-wrist`, `${side}-finger`, 10, c.glow, v > 0 ? 9 : 3)
    link(p, `${side}-thigh`, '大腿', `${side}-hip`, `${side}-knee`, 32, c.body, v > 0 ? 6 : 2)
    link(p, `${side}-shin`, '小腿', `${side}-knee`, `${side}-ankle`, 24, c.edge, v > 0 ? 6 : 2)
    s(p, `${side}-foot`, '足', 'ellipse', `${side}-ankle`, 47, 22, c.dark, { x: v * 9, layer: 6 })
    s(p, `${side}-pauldron`, '肩甲', 'ellipse', `${side}-shoulder`, 42, 37, c.edge, { layer: v > 0 ? 9 : 3 })
    loop(p, 'idle', `${side}-elbow`, { rotationZ: v * 7 })
    keys(p, 'move', `${side}-hip`, [[0, {}], [.25, { rotationZ: v * 24 }], [.75, { rotationZ: -v * 24 }], [1, {}]])
    keys(p, 'move', `${side}-knee`, [[0, {}], [.25, { rotationZ: -v * 26 }], [.75, { rotationZ: v * 26 }], [1, {}]])
    keys(p, 'move', `${side}-shoulder`, [[0, {}], [.25, { rotationZ: -v * 16 }], [.75, { rotationZ: v * 16 }], [1, {}]])
    stagger(p, `${side}-shoulder`, { rotationZ: v * 27 })
    fall(p, `${side}-knee`, { rotationZ: v * 47 })
  }
  // The named organ is hinged at the hand or head so ranged and melee attacks read differently.
  if (['crossbow', 'staff', 'spear', 'blade'].includes(organ)) {
    j(p, 'weapon', '武器枢轴', 0, -17, 11, 'right-wrist')
    j(p, 'weapon-tip', '武器尖', 5, 78, 4, 'weapon')
    link(p, 'weapon-shaft', '武器', 'weapon', 'weapon-tip', organ === 'crossbow' ? 15 : 10, c.edge, 11)
    if (organ === 'crossbow') s(p, 'crossbow-limb', '弩臂', 'capsule', 'weapon', 77, 12, c.dark, { rotationZ: 8, layer: 12 })
    if (organ === 'staff') s(p, 'staff-head', '法杖端', 'diamond', 'weapon-tip', 30, 34, c.glow, { layer: 12 })
    strike(p, 'weapon', { rotationZ: 39, rotationY: -19 }, { rotationZ: -37, rotationY: 25, dz: 22 })
  } else if (organ === 'shield') {
    j(p, 'shield', '盾腕', 2, -8, 10, 'left-wrist')
    s(p, 'shield-face', '盾面', 'diamond', 'shield', 65, 87, c.edge, { z: 9, layer: 12, rotationY: -18 })
    strike(p, 'shield', { rotationY: -30 }, { rotationY: 32, dz: 26 })
  } else {
    strike(p, 'right-shoulder', { rotationZ: -28, rotationY: -18 }, { rotationZ: 45, rotationY: 25, dz: 20 })
    strike(p, 'right-elbow', { rotationZ: 34 }, { rotationZ: -29 })
  }
  loop(p, 'idle', 'head', { rotationZ: -5, rotationX: 5 })
  keys(p, 'move', 'root', [[0, {}], [.25, { dy: 9, dx: -6 }], [.5, { dx: -19 }], [.75, { dy: 8, dx: -9 }], [1, {}]])
  strike(p, 'root', { dx: 12, rotationZ: -8 }, { dx: -22, dz: 27, rotationZ: 12 })
  strike(p, 'head', { rotationZ: 8 }, { rotationZ: -13, rotationX: 10 })
  stagger(p, 'head', { rotationZ: -24, rotationX: 12 })
  fall(p, 'head', { rotationZ: 30, rotationX: 26 })
  fall(p, 'root', { dy: -139, rotationZ: 74, dz: -25 })
}

function quadruped(p, c, organ) {
  j(p, 'root', '胸腹', 0, 0, 0)
  j(p, 'neck', '颈', 0, 22, 58, 'root')
  j(p, 'head', '头', 0, 13, 39, 'neck')
  j(p, 'jaw', '下颌', 0, -23, 18, 'head')
  j(p, 'haunch', '臀', 0, -8, -58, 'root')
  j(p, 'tail-base', '尾根', 0, 10, -33, 'haunch')
  j(p, 'tail-tip', '尾尖', 0, -9, -52, 'tail-base')
  s(p, 'barrel', '躯干', 'ellipse', 'root', 107, 83, c.body, { rotationX: -24, layer: 5 })
  s(p, 'back', '背脊', 'ellipse', 'root', 75, 130, c.edge, { y: 20, rotationX: -66, layer: 6 })
  s(p, 'rump', '臀甲', 'ellipse', 'haunch', 78, 66, c.body)
  s(p, 'muzzle', '吻部', 'ellipse', 'head', 70, 61, c.edge, { layer: 9 })
  s(p, 'eye', '左眼', 'ellipse', 'head', 12, 15, c.glow, { x: -17, y: 8, z: 6, layer: 10 })
  s(p, 'other-eye', '右眼', 'ellipse', 'head', 12, 15, c.glow, { x: 17, y: 8, z: 6, layer: 10 })
  s(p, 'jaw-plate', '咬颌', 'triangle', 'jaw', 53, 25, c.dark, { rotationZ: 180, layer: 8 })
  link(p, 'tail', '尾', 'tail-base', 'tail-tip', 23, c.body, 3)
  for (const side of ['left', 'right']) {
    const v = side === 'left' ? -1 : 1
    for (const station of ['front', 'hind']) {
      const front = station === 'front'
      const parent = front ? 'root' : 'haunch'
      const prefix = `${side}-${station}`
      j(p, `${prefix}-hip`, '肢根', v * 34, -28, front ? 34 : 0, parent)
      j(p, `${prefix}-knee`, '膝', v * 8, -37, front ? 6 : -7, `${prefix}-hip`)
      j(p, `${prefix}-paw`, '爪', v * 5, -43, front ? 12 : -9, `${prefix}-knee`)
      link(p, `${prefix}-upper`, '上肢', `${prefix}-hip`, `${prefix}-knee`, 25, c.body, v > 0 ? 7 : 2)
      link(p, `${prefix}-lower`, '下肢', `${prefix}-knee`, `${prefix}-paw`, 19, c.edge, v > 0 ? 7 : 2)
      s(p, `${prefix}-foot`, '足爪', 'ellipse', `${prefix}-paw`, 36, 19, c.dark, { z: 6, layer: v > 0 ? 8 : 3 })
      const phase = (front ? 1 : -1) * v
      keys(p, 'move', `${prefix}-hip`, [[0, {}], [.25, { rotationX: phase * 22 }], [.75, { rotationX: -phase * 22 }], [1, {}]])
      keys(p, 'move', `${prefix}-knee`, [[0, {}], [.25, { rotationX: -phase * 18, dy: phase > 0 ? 7 : 0 }], [.75, { rotationX: phase * 18, dy: phase < 0 ? 7 : 0 }], [1, {}]])
      fall(p, `${prefix}-knee`, { rotationX: front ? 39 : -35, rotationZ: v * 18 })
    }
  }
  if (organ === 'needle' || organ === 'core') {
    for (let i = 0; i < 3; i += 1) s(p, `dorsal-${i}`, '背针', 'triangle', 'root', 25, 43 + i * 6, c.glow,
      { y: 40, z: -28 + i * 28, layer: 7 })
  }
  if (organ === 'core') s(p, 'core', '熔核', 'ellipse', 'root', 58, 43, c.glow, { z: 8, layer: 9 })
  loop(p, 'idle', 'neck', { rotationZ: 5, rotationX: 7 })
  loop(p, 'idle', 'tail-base', { rotationY: 12, rotationZ: -8 })
  keys(p, 'move', 'root', [[0, {}], [.25, { dz: 10, dy: 8 }], [.5, { dz: 24 }], [.75, { dz: 10, dy: 8 }], [1, {}]])
  strike(p, 'root', { dz: -14, rotationX: -7 }, { dz: 31, rotationX: 10 })
  strike(p, 'neck', { rotationZ: 15, rotationX: -12 }, { rotationZ: -23, rotationX: 20 })
  strike(p, 'jaw', { rotationX: -9 }, { rotationX: 24, dz: 11 })
  stagger(p, 'neck', { rotationZ: 26, rotationX: 13 })
  stagger(p, 'tail-base', { rotationZ: -27 })
  fall(p, 'root', { dy: -72, rotationZ: -26, dz: -21 })
  fall(p, 'neck', { rotationZ: -48 })
  fall(p, 'tail-base', { rotationZ: 30 })
}

function arthropod(p, c, organ) {
  j(p, 'root', '胸节', 0, 0, 0)
  j(p, 'head', '头节', 0, 6, 53, 'root')
  j(p, 'mandible', '颚', 0, -11, 22, 'head')
  j(p, 'abdomen', '腹节', 0, -3, -54, 'root')
  j(p, 'abdomen-tip', '腹端', 0, -5, -39, 'abdomen')
  s(p, 'thorax', '胸甲', 'ellipse', 'root', 86, 69, c.body, { rotationX: -51, layer: 6 })
  s(p, 'carapace', '背壳', 'ellipse', 'abdomen', 106, 89, c.edge, { rotationX: -54, layer: 5 })
  s(p, 'belly', '腹纹', 'diamond', 'abdomen', 50, 48, c.dark, { z: 5, rotationX: -54, layer: 7 })
  s(p, 'head-shell', '头壳', 'ellipse', 'head', 69, 53, c.body, { rotationX: -30, layer: 8 })
  s(p, 'eyes', '复眼', 'capsule', 'head', 47, 13, c.glow, { y: 9, z: 8, layer: 9 })
  s(p, 'fang', '颚钩', 'triangle', 'mandible', 35, 37, c.dark, { rotationZ: 180, layer: 10 })
  s(p, 'abdomen-end', '腹端', 'diamond', 'abdomen-tip', 43, 35, c.body, { rotationX: -48 })
  const legPairs = p.enemyId === 'nest-spider' ? 4 : 3
  for (const side of ['left', 'right']) {
    const v = side === 'left' ? -1 : 1
    for (let i = 0; i < legPairs; i += 1) {
      const id = `${side}-leg-${i}`
      j(p, `${id}-coxa`, '基节', v * 32, -7, 39 - i * 27, 'root')
      j(p, `${id}-knee`, '膝节', v * (36 + i * 3), -4, 16 - i * 10, `${id}-coxa`)
      j(p, `${id}-tip`, '足尖', v * 19, -51, 6 - i * 5, `${id}-knee`)
      link(p, `${id}-femur`, '股节', `${id}-coxa`, `${id}-knee`, 14, c.edge, v > 0 ? 8 : 2)
      link(p, `${id}-tibia`, '胫节', `${id}-knee`, `${id}-tip`, 9, c.body, v > 0 ? 8 : 2)
      const phase = (i % 2 ? -1 : 1) * v
      keys(p, 'move', `${id}-coxa`, [[0, {}], [.25, { rotationY: phase * 15, rotationX: phase * 10 }], [.75, { rotationY: -phase * 15, rotationX: -phase * 10 }], [1, {}]])
      keys(p, 'move', `${id}-knee`, [[0, {}], [.25, { rotationX: -phase * 13 }], [.75, { rotationX: phase * 13 }], [1, {}]])
      fall(p, `${id}-coxa`, { rotationZ: v * (i + 1) * 12 })
    }
  }
  if (organ === 'cannon') {
    j(p, 'barrel-base', '炮座', 0, 17, 6, 'abdomen')
    j(p, 'barrel-mouth', '炮口', 0, 22, 77, 'barrel-base')
    link(p, 'cannon-barrel', '炮管', 'barrel-base', 'barrel-mouth', 31, c.dark, 10)
    s(p, 'muzzle-ring', '炮口环', 'ellipse', 'barrel-mouth', 39, 24, c.glow, { layer: 11 })
    strike(p, 'barrel-base', { rotationX: -23 }, { rotationX: 24, dz: 18 })
  } else if (organ === 'shield') {
    s(p, 'shield-ridge', '盾脊', 'diamond', 'abdomen', 56, 84, c.dark, { z: 7, layer: 8 })
    strike(p, 'abdomen', { rotationX: 21 }, { rotationX: -24, dz: 19 })
  } else {
    strike(p, 'mandible', { rotationX: -15 }, { rotationX: 25, dz: 17 })
  }
  if (organ === 'core' || organ === 'abdomen') s(p, 'core', '腹核', 'ellipse', 'abdomen', 56, 54, c.glow, { z: 7, layer: 9 })
  loop(p, 'idle', 'abdomen', { rotationZ: 5, rotationX: 6 })
  loop(p, 'idle', 'mandible', { rotationZ: -6 })
  keys(p, 'move', 'root', [[0, {}], [.25, { dy: 6, dz: 12 }], [.5, { dz: 24 }], [.75, { dy: 6, dz: 12 }], [1, {}]])
  strike(p, 'root', { dy: -10, rotationX: -9 }, { dy: 13, dz: 23, rotationX: 17 })
  strike(p, 'head', { rotationX: -12 }, { rotationX: 21, dz: 13 })
  stagger(p, 'abdomen', { rotationZ: -20, rotationX: 13 })
  stagger(p, 'head', { rotationZ: 25 })
  fall(p, 'root', { dy: -93, rotationZ: 39, dz: -17 })
  fall(p, 'abdomen', { rotationZ: 28, rotationX: 34 })
}

function floater(p, c, organ) {
  j(p, 'root', '悬浮核心', 0, 0, 0)
  j(p, 'crown', '冠', 0, 62, 8, 'root')
  j(p, 'eye', '眼核', 0, 12, 17, 'root')
  j(p, 'keel', '下囊', 0, -65, -11, 'root')
  j(p, 'tail', '尾光', 0, -51, -3, 'keel')
  s(p, 'body', '浮囊', 'ellipse', 'root', 104, 110, c.body, { layer: 7 })
  s(p, 'mask', '面纹', 'diamond', 'root', 69, 72, c.dark, { z: 5, layer: 8 })
  s(p, 'eye-ring', '眼环', 'ellipse', 'eye', 55, 56, c.edge, { layer: 10 })
  s(p, 'eye-core', '眼核', 'ellipse', 'eye', 29, 32, c.glow, { z: 3, layer: 11 })
  s(p, 'crown-flame', '冠焰', 'triangle', 'crown', 58, 79, c.glow, { layer: 5 })
  s(p, 'lower-veil', '下摆', 'triangle', 'keel', 90, 87, c.dark, { rotationZ: 180, layer: 4 })
  s(p, 'tail-tip', '尾火', 'diamond', 'tail', 32, 46, c.glow, { layer: 4 })
  for (const side of ['left', 'right']) {
    const v = side === 'left' ? -1 : 1
    j(p, `${side}-fin`, '侧翼根', v * 40, 12, v * 22, 'root')
    j(p, `${side}-fin-tip`, '侧翼尖', v * 55, 27, 8, `${side}-fin`)
    j(p, `${side}-tendril`, '触须根', v * 27, -42, v * 15, 'root')
    j(p, `${side}-tendril-tip`, '触须尖', v * 25, -66, 8, `${side}-tendril`)
    s(p, `${side}-wing`, '侧翼', 'ellipse', `b-${side}-fin-${side}-fin-tip`, 89, 49, c.edge,
      { bone: true, rotationX: v * 23, layer: v > 0 ? 9 : 3 })
    link(p, `${side}-tentacle`, '触须', `${side}-tendril`, `${side}-tendril-tip`, 13, c.body, v > 0 ? 8 : 3)
    loop(p, 'idle', `${side}-fin`, { rotationY: v * 23, rotationZ: v * 11 })
    loop(p, 'idle', `${side}-tendril`, { rotationZ: v * 9 })
    keys(p, 'move', `${side}-fin`, [[0, {}], [.25, { rotationX: v * 27 }], [.75, { rotationX: -v * 18 }], [1, {}]])
    strike(p, `${side}-fin`, { rotationZ: -v * 28 }, { rotationZ: v * 31, dz: 16 })
    fall(p, `${side}-fin`, { rotationZ: v * 58, rotationX: v * 39 })
  }
  if (organ === 'spear' || organ === 'claw') {
    j(p, 'weapon', '投射端', 0, 18, 13, 'right-fin-tip')
    j(p, 'weapon-tip', '矛尖', 13, 62, 4, 'weapon')
    link(p, 'lance', '光矛', 'weapon', 'weapon-tip', 10, c.glow, 12)
    strike(p, 'weapon', { rotationZ: 33, dz: -15 }, { rotationZ: -34, dz: 32 })
  }
  loop(p, 'idle', 'root', { dy: 11, rotationZ: 3 })
  loop(p, 'idle', 'tail', { rotationZ: 12 })
  keys(p, 'move', 'root', [[0, {}], [.25, { dx: -10, dy: 17 }], [.5, { dx: -22 }], [.75, { dx: -12, dy: -8 }], [1, {}]])
  strike(p, 'root', { dy: 12, rotationX: -11 }, { dx: 18, dz: 36, rotationX: 20 })
  strike(p, 'eye', { dz: -8 }, { dz: 22, rotationY: 13 })
  stagger(p, 'eye', { rotationZ: -24, dz: -12 })
  stagger(p, 'keel', { rotationZ: 17 })
  fall(p, 'root', { dy: -132, rotationZ: 61, dz: -28 })
  fall(p, 'keel', { rotationZ: 35 })
}

function plant(p, c, organ) {
  j(p, 'root', '根盘', 0, 0, 0)
  j(p, 'lower', '下茎', 0, 53, -9, 'root')
  j(p, 'upper', '上茎', 0, 53, 15, 'lower')
  j(p, 'flower', '花盘', 0, 30, 18, 'upper')
  j(p, 'core', '花心', 0, 4, 11, 'flower')
  s(p, 'bulb', '根球', 'ellipse', 'root', 97, 68, c.body, { layer: 5 })
  link(p, 'stem-low', '下茎', 'root', 'lower', 35, c.body, 5)
  link(p, 'stem-high', '上茎', 'lower', 'upper', 27, c.edge, 5)
  s(p, 'flower-disc', '花盘', 'ellipse', 'flower', 86, 86, c.body, { layer: 8 })
  s(p, 'mouth', '花心', 'ellipse', 'core', 55, 55, c.dark, { layer: 10 })
  s(p, 'pupil', '孢眼', 'ellipse', 'core', 22, 24, c.glow, { z: 3, layer: 11 })
  for (const side of ['left', 'right']) {
    const v = side === 'left' ? -1 : 1
    j(p, `${side}-root`, '主根', v * 48, -26, v * 23, 'root')
    j(p, `${side}-root-tip`, '根尖', v * 48, -23, 5, `${side}-root`)
    j(p, `${side}-leaf`, '叶柄', v * 38, 12, v * 19, 'lower')
    j(p, `${side}-leaf-tip`, '叶尖', v * 49, 14, 5, `${side}-leaf`)
    j(p, `${side}-petal`, '花瓣根', v * 33, 0, v * 15, 'flower')
    j(p, `${side}-petal-tip`, '花瓣尖', v * 56, 25, 6, `${side}-petal`)
    j(p, `${side}-thorn`, '刺端', v * 32, 11, 5, `${side}-petal-tip`)
    link(p, `${side}-root-part`, '根', `${side}-root`, `${side}-root-tip`, 18, c.dark, 3)
    s(p, `${side}-leaf-part`, '侧叶', 'ellipse', `b-${side}-leaf-${side}-leaf-tip`, 88, 41, c.edge,
      { bone: true, rotationX: v * 22, layer: v > 0 ? 7 : 3 })
    s(p, `${side}-petal-part`, '花瓣', 'ellipse', `b-${side}-petal-${side}-petal-tip`, 89, 58, c.body,
      { bone: true, rotationX: v * 18, layer: v > 0 ? 9 : 4 })
    link(p, `${side}-thorn-part`, '刺', `${side}-petal-tip`, `${side}-thorn`, 10, c.glow, 10)
    loop(p, 'idle', `${side}-petal`, { rotationY: v * 13, rotationZ: v * 9 })
    keys(p, 'move', `${side}-root`, [[0, {}], [.25, { rotationZ: v * 16 }], [.75, { rotationZ: -v * 16 }], [1, {}]])
    strike(p, `${side}-petal`, { rotationZ: -v * 27 }, { rotationZ: v * 33, dz: 14 })
    strike(p, `${side}-thorn`, { rotationZ: -v * 12 }, { rotationZ: v * 28, dz: 21 })
    fall(p, `${side}-petal`, { rotationZ: v * 57 })
  }
  if (organ === 'spore') {
    for (let i = 0; i < 3; i += 1) s(p, `spore-${i}`, '孢囊', 'circle', 'flower', 21 + i * 7, 21 + i * 7, c.glow,
      { x: (i - 1) * 28, y: 27 + i * 9, z: 5, layer: 11 })
  }
  loop(p, 'idle', 'lower', { rotationZ: 6 })
  loop(p, 'idle', 'upper', { rotationZ: -11, rotationX: 7 })
  keys(p, 'move', 'root', [[0, {}], [.25, { dx: -6, dy: 4 }], [.5, { dx: -17 }], [.75, { dx: -9, dy: 4 }], [1, {}]])
  keys(p, 'move', 'upper', [[0, {}], [.25, { rotationZ: -15 }], [.75, { rotationZ: 17 }], [1, {}]])
  strike(p, 'root', { dx: 9 }, { dx: -17, dz: 15 })
  strike(p, 'upper', { rotationZ: -21 }, { rotationZ: 29, dz: 18 })
  stagger(p, 'upper', { rotationZ: -26, rotationX: 12 })
  stagger(p, 'flower', { rotationZ: -14 })
  fall(p, 'root', { dy: -34, rotationZ: 23 })
  fall(p, 'lower', { rotationZ: 47 })
  fall(p, 'upper', { rotationZ: 38, dy: -20 })
}

function bird(p, c) {
  j(p, 'root', '胸', 0, 0, 0)
  j(p, 'head', '头', 0, 64, 19, 'root')
  j(p, 'beak', '喙', 0, -13, 17, 'head')
  j(p, 'tail', '尾根', 0, -58, -20, 'root')
  j(p, 'tail-tip', '尾尖', 0, -68, -8, 'tail')
  s(p, 'breast', '胸羽', 'ellipse', 'root', 83, 107, c.body, { layer: 7 })
  s(p, 'breast-mark', '火轮', 'diamond', 'root', 42, 53, c.glow, { z: 5, layer: 8 })
  s(p, 'head-shell', '头羽', 'ellipse', 'head', 60, 57, c.dark, { layer: 9 })
  s(p, 'eyes', '目光', 'capsule', 'head', 37, 11, c.glow, { z: 5, layer: 10 })
  s(p, 'beak-part', '喙', 'triangle', 'beak', 29, 42, c.edge, { rotationZ: 180, layer: 11 })
  link(p, 'tail-fan', '尾羽', 'tail', 'tail-tip', 36, c.edge, 4)
  for (const side of ['left', 'right']) {
    const v = side === 'left' ? -1 : 1
    j(p, `${side}-wing`, '翅根', v * 39, 27, v * 19, 'root')
    j(p, `${side}-elbow`, '翅肘', v * 71, 17, 11, `${side}-wing`)
    j(p, `${side}-tip`, '翅尖', v * 73, -18, 8, `${side}-elbow`)
    j(p, `${side}-foot`, '足根', v * 23, -48, v * 9, 'root')
    j(p, `${side}-talon`, '趾', v * 12, -58, 8, `${side}-foot`)
    s(p, `${side}-inner-wing`, '内翼', 'ellipse', `b-${side}-wing-${side}-elbow`, 111, 63, c.body,
      { bone: true, rotationX: v * 20, layer: v > 0 ? 8 : 3 })
    s(p, `${side}-outer-wing`, '外翼', 'ellipse', `b-${side}-elbow-${side}-tip`, 115, 52, c.edge,
      { bone: true, rotationX: v * 27, layer: v > 0 ? 9 : 4 })
    link(p, `${side}-leg`, '足', `${side}-foot`, `${side}-talon`, 11, c.dark, 6)
    loop(p, 'idle', `${side}-wing`, { rotationZ: v * 21, rotationX: v * 16 })
    loop(p, 'idle', `${side}-elbow`, { rotationZ: v * 13 })
    keys(p, 'move', `${side}-wing`, [[0, {}], [.25, { rotationZ: v * 36, rotationX: v * 28 }], [.75, { rotationZ: -v * 30, rotationX: -v * 19 }], [1, {}]])
    keys(p, 'move', `${side}-elbow`, [[0, {}], [.25, { rotationZ: v * 23 }], [.75, { rotationZ: -v * 20 }], [1, {}]])
    strike(p, `${side}-wing`, { rotationZ: v * 42 }, { rotationZ: -v * 39, dz: 22 })
    stagger(p, `${side}-wing`, { rotationZ: -v * 48 })
    fall(p, `${side}-wing`, { rotationZ: v * 71, rotationX: v * 33 })
  }
  loop(p, 'idle', 'tail', { rotationZ: 8 })
  keys(p, 'move', 'root', [[0, {}], [.25, { dy: 15, dx: -8 }], [.5, { dx: -22 }], [.75, { dy: -7, dx: -11 }], [1, {}]])
  strike(p, 'root', { dy: 16, rotationX: -12 }, { dy: -14, dz: 35, rotationX: 21 })
  strike(p, 'beak', { rotationX: -13 }, { rotationX: 24, dz: 15 })
  stagger(p, 'head', { rotationZ: -23 })
  fall(p, 'root', { dy: -139, rotationZ: 65, dz: -25 })
  fall(p, 'tail', { rotationZ: 28 })
}

function toad(p, c) {
  quadruped(p, c, 'fang')
  const removed = new Set(['tail-base', 'tail-tip'])
  p.joints = p.joints.filter((entry) => !removed.has(entry.id))
  p.bones = p.bones.filter((entry) => !removed.has(entry.fromJointId) && !removed.has(entry.toJointId))
  p.parts = p.parts.filter((entry) => entry.id !== 'tail')
  for (const animation of Object.values(p.animations)) {
    for (const id of removed) delete animation.tracks[`joint:${id}`]
  }
  p.joints.find((entry) => entry.id === 'haunch').z = -39
  p.joints.find((entry) => entry.id === 'neck').z = 38
  const head = p.joints.find((entry) => entry.id === 'head')
  head.z = 29
  head.y = 12
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1
    for (const station of ['front', 'hind']) {
      const base = `${side}-${station}`
      p.joints.find((entry) => entry.id === `${base}-hip`).x = sign * 40
      p.joints.find((entry) => entry.id === `${base}-knee`).y = -26
      p.joints.find((entry) => entry.id === `${base}-paw`).y = -30
    }
  }
  p.parts.find((entry) => entry.id === 'barrel').width = 126
  p.parts.find((entry) => entry.id === 'barrel').height = 117
  p.parts.find((entry) => entry.id === 'muzzle').width = 67
  j(p, 'tongue', '舌根', 0, -11, 20, 'jaw')
  j(p, 'tongue-tip', '舌尖', 0, -7, 65, 'tongue')
  link(p, 'tongue-part', '弹舌', 'tongue', 'tongue-tip', 16, c.glow, 12)
  s(p, 'rot-sac', '腐囊', 'ellipse', 'root', 67, 53, c.dark, { y: 23, z: 12, layer: 10 })
  s(p, 'throat-sac', '鸣囊', 'ellipse', 'jaw', 49, 39, c.glow, { y: -11, z: 2, layer: 10 })
  loop(p, 'idle', 'jaw', { rotationX: 8, rotationZ: 4 })
  loop(p, 'idle', 'tongue', { rotationZ: -5 })
  strike(p, 'tongue', { rotationZ: 39, dz: -11 }, { rotationZ: -22, dz: 49 })
  stagger(p, 'tongue', { rotationZ: -30 })
}

function swarm(p, c, organ) {
  // One rig controls three visibly separate bodies, each with its own hinged head and tail.
  j(p, 'root', '群心', 0, 0, 0)
  for (let i = 0; i < 3; i += 1) {
    const x = (i - 1) * 75
    const z = (i - 1) * 25
    j(p, `body-${i}`, '个体', x, i === 1 ? 28 : -17, z, 'root')
    j(p, `head-${i}`, '头', 13, 32, 12, `body-${i}`)
    j(p, `mouth-${i}`, '口器', 0, 23, 8, `head-${i}`)
    j(p, `tail-${i}`, '尾', -11, -41, -7, `body-${i}`)
    j(p, `tail-tip-${i}`, '尾尖', -8, -44, -4, `tail-${i}`)
    s(p, `shell-${i}`, '个体甲', 'ellipse', `body-${i}`, 50, 73, c.body, { layer: i + 4 })
    s(p, `eye-${i}`, '眼', 'circle', `head-${i}`, 18, 18, c.glow, { z: 4, layer: i + 8 })
    s(p, `jaw-${i}`, '口器', 'triangle', `mouth-${i}`, 30, 30, c.dark, { layer: i + 9 })
    link(p, `tail-part-${i}`, '尾', `tail-${i}`, `tail-tip-${i}`, 15, c.edge, i + 3)
    s(p, `mark-${i}`, organ === 'flame' ? '灯焰' : '腹纹', 'diamond', `body-${i}`, 28, 35, c.glow,
      { z: 4, layer: i + 7 })
    loop(p, 'idle', `body-${i}`, { dy: 6 + i * 3, rotationY: i % 2 ? -9 : 9 })
    loop(p, 'idle', `tail-${i}`, { rotationZ: (i - 1) * 11 })
    keys(p, 'move', `body-${i}`, [[0, {}], [.25, { dx: i === 1 ? -7 : 8, dy: 10 }], [.75, { dx: i === 1 ? 7 : -8, dy: -6 }], [1, {}]])
    strike(p, `head-${i}`, { rotationZ: -17, dz: -12 }, { rotationZ: 20, dz: 24 + i * 8 })
    stagger(p, `body-${i}`, { rotationZ: (i - 1) * 17, dz: -15 })
    fall(p, `body-${i}`, { dy: -55 - i * 9, rotationZ: (i - 1) * 32 })
  }
  loop(p, 'idle', 'root', { dy: 7 })
  keys(p, 'move', 'root', [[0, {}], [.25, { dx: -8 }], [.5, { dx: -19 }], [.75, { dx: -10 }], [1, {}]])
  strike(p, 'root', { dx: -12 }, { dx: 20, dz: 20 })
  stagger(p, 'root', { dx: -19, dz: -21, rotationZ: 12 })
  fall(p, 'root', { dy: -76, rotationZ: 28 })
}

export function createRosterEnemyProject(definition, { withVariants = true } = {}) {
  const design = DESIGNS[definition?.id]
  if (!design) return null
  const [family, dark, body, edge, organ] = design
  const project = createDefaultShadowProject()
  project.name = `${definition.name} · 骨架预览`
  project.enemyId = definition.id
  project.stage.floorOffset = ['floater', 'bird', 'swarm'].includes(family) ? 46 : 10
  const colors = { dark, body, edge, glow: edge }
  const builders = { humanoid, quadruped, arthropod, floater, plant, bird, toad, swarm }
  builders[family](project, colors, organ)
  if (withVariants) applyEnemyVariant(project, colors)
  project.joints[0].rotationY = -30
  // Shared body motion is secondary to the organ and limb tracks above.
  if (!project.animations.idle.tracks['joint:root']) loop(project, 'idle', 'root', { dy: 5, rotationX: 3 })
  if (!project.animations.hit.tracks['joint:root']) stagger(project, 'root', { dx: -17, dz: -22, rotationZ: 13 })
  return project
}

export const ROSTER_ENEMY_ART = Object.freeze(Object.fromEntries(
  Object.entries(DESIGNS).map(([id, [family]]) => [id, { family }]),
))
