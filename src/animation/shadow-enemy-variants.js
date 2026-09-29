import { createShadowBone, createShadowJoint, createShadowPart, shadowTargetKey, upsertShadowKeyframe } from './shadow-rig.js'

// Each entry below changes the load-bearing anatomy and its motion, not only color.
// Shared helpers keep the paper-joint format consistent; every enemy assembles
// a different set of hinged organs around its original support skeleton.
function joint(p, id, name, parent, [x, y, z]) {
  p.joints.push(createShadowJoint({ id, name, x, y, z }))
  p.bones.push(createShadowBone({ id: `v-${parent}-${id}`, name: `${parent} / ${id}`, fromJointId: parent, toJointId: id }))
}

function part(p, id, name, shape, targetId, width, height, fill, options = {}) {
  const { bone = false, layer = 9, stroke = '#1c2326', ...rest } = options
  p.parts.push(createShadowPart({
    id, name, shape, width, height, fill, stroke, layer, depth: 0, ...rest,
    attachment: { type: bone ? 'bone' : 'joint', targetId, t: .5, followRotation: true },
  }))
}

function track(p, action, id, frames) {
  const duration = p.animations[action].duration
  for (const [fraction, values] of frames) {
    upsertShadowKeyframe(p, action, shadowTargetKey('joint', id), Math.round(duration * fraction), values)
  }
}

function organ(p, c, id, name, parent, base, end, options = {}) {
  const { shape = 'ellipse', breadth = 32, fill = 'edge', layer = 9,
    tilt = 0, wave = 9, sweep = 19, thrust = 22, tipShape = null, tipSize = 21 } = options
  const hinge = `${id}-hinge`, tip = `${id}-tip`
  joint(p, hinge, `${name}根`, parent, base)
  joint(p, tip, `${name}端`, hinge, end)
  part(p, `${id}-sheet`, name, shape, `v-${hinge}-${tip}`,
    Math.hypot(...end) + 14, breadth, c[fill], { bone: true, layer, rotationX: tilt })
  if (tipShape) part(p, `${id}-terminal`, `${name}端`, tipShape, tip, tipSize, tipSize, c.edge, { layer: layer + 1, z: 3 })
  track(p, 'idle', hinge, [[0, {}], [.5, { rotationY: wave, rotationZ: wave * .38 }], [1, {}]])
  track(p, 'idle', tip, [[0, {}], [.6, { rotationX: wave * .65 }], [1, {}]])
  track(p, 'move', hinge, [[0, {}], [.25, { rotationX: sweep }], [.75, { rotationX: -sweep }], [1, {}]])
  track(p, 'move', tip, [[0, {}], [.35, { rotationY: wave }], [.85, { rotationY: -wave }], [1, {}]])
  track(p, 'attack', hinge, [[0, {}], [.27, { rotationX: -sweep, rotationY: -wave }], [.64, { rotationX: sweep, rotationY: wave, dz: thrust }], [1, {}]])
  track(p, 'attack', tip, [[0, {}], [.34, { rotationZ: -wave }], [.72, { rotationZ: wave * 1.8, dz: thrust * .35 }], [1, {}]])
  track(p, 'hit', hinge, [[0, {}], [.28, { rotationZ: -sweep, dz: -12 }], [1, {}]])
  track(p, 'death', hinge, [[0, {}], [.4, { rotationZ: sweep * .7 }], [1, { rotationZ: sweep * 2, rotationX: -27 }]])
  return tip
}

function setJoint(p, id, values) { Object.assign(p.joints.find((entry) => entry.id === id), values) }
function setPart(p, id, values) { Object.assign(p.parts.find((entry) => entry.id === id), values) }

function removeBranch(p, jointIds, partIds) {
  const removed = new Set(jointIds)
  const surfaces = new Set(partIds)
  p.joints = p.joints.filter((entry) => !removed.has(entry.id))
  p.bones = p.bones.filter((entry) => !removed.has(entry.fromJointId) && !removed.has(entry.toJointId))
  p.parts = p.parts.filter((entry) => !surfaces.has(entry.id))
  for (const animation of Object.values(p.animations)) {
    for (const id of removed) delete animation.tracks[`joint:${id}`]
  }
}

function tideShadowCub(p, c) {
  removeBranch(p,
    ['right-hind-hip', 'right-hind-knee', 'right-hind-paw'],
    ['right-hind-upper', 'right-hind-lower', 'right-hind-foot'])
  setPart(p, 'barrel', { width: 77, height: 72 })
  setJoint(p, 'head', { y: 11, z: 27 })
  organ(p, c, 'gill-left', '左潮鳃', 'neck', [-25, 4, 12], [-47, 35, 20],
    { shape: 'triangle', breadth: 54, tilt: 28, wave: -12, fill: 'body' })
  organ(p, c, 'gill-right', '右潮鳃', 'neck', [25, 4, 12], [47, 35, 20],
    { shape: 'triangle', breadth: 54, tilt: -28, wave: 12, fill: 'body' })
  organ(p, c, 'third-stilt', '幼潮尾足', 'haunch', [21, -14, -17], [26, -86, 12],
    { shape: 'capsule', breadth: 21, wave: 13, sweep: 26, fill: 'dark' })
  organ(p, c, 'split-tail', '分潮尾', 'tail-tip', [-8, 2, -8], [-33, 19, -18], { breadth: 17, wave: -18, sweep: 24 })
}

function nestSpider(p, c) {
  setPart(p, 'carapace', { width: 88, height: 78 })
  setJoint(p, 'abdomen', { z: -69 })
  const spinneret = organ(p, c, 'spinneret', '吐丝器', 'abdomen-tip', [0, -7, -7], [0, -15, -37],
    { shape: 'capsule', breadth: 17, wave: 7, sweep: 30, thrust: 36 })
  organ(p, c, 'egg-left', '左卵囊', spinneret, [-20, -8, -13], [-29, -14, -21],
    { breadth: 28, fill: 'body', wave: -14, sweep: -16, tipShape: 'ellipse', tipSize: 25 })
  organ(p, c, 'egg-right', '右卵囊', spinneret, [20, -8, -13], [29, -14, -21],
    { breadth: 28, fill: 'body', wave: 14, sweep: 16, tipShape: 'ellipse', tipSize: 25 })
}

function beetleGuard(p, c) {
  setPart(p, 'carapace', { width: 105, height: 70 })
  for (const sign of [-1, 1]) {
    organ(p, c, sign < 0 ? 'left-gate' : 'right-gate', '盾门鞘翅', 'abdomen', [sign * 28, 22, -2], [sign * 39, 8, -38],
      { shape: 'diamond', breadth: 56, tilt: sign * 21, wave: sign * 9, sweep: sign * 33, fill: 'body' })
  }
  organ(p, c, 'battering-horn', '撞门角', 'head', [0, 15, 15], [0, 17, 46],
    { shape: 'triangle', breadth: 32, sweep: 29, thrust: 35 })
}

function rotWalker(p, c) {
  removeBranch(p, ['right-hip', 'right-knee', 'right-ankle'], ['right-thigh', 'right-shin', 'right-foot'])
  setJoint(p, 'right-elbow', { x: 37, y: -65 })
  setJoint(p, 'neck', { x: -15, y: 37, z: 18 })
  setJoint(p, 'head', { x: 31, y: 16, z: 17 })
  setPart(p, 'torso', { shape: 'diamond', width: 84, height: 113 })
  setPart(p, 'skull', { shape: 'diamond', width: 53, height: 54 })
  organ(p, c, 'rib-mouth', '肋间口', 'root', [0, 3, 12], [0, 4, 33],
    { shape: 'diamond', breadth: 48, fill: 'dark', sweep: 24, thrust: 25 })
  organ(p, c, 'spine-arm', '背生残臂', 'root', [-15, 33, -20], [-43, 26, -4],
    { shape: 'capsule', breadth: 18, wave: -17, sweep: -35, thrust: 30, tipShape: 'triangle' })
  organ(p, c, 'rot-stilt', '腐生支脚', 'pelvis', [28, -16, -9], [37, -88, 13],
    { shape: 'capsule', breadth: 21, wave: 9, sweep: 31, thrust: 17, fill: 'dark', tipShape: 'diamond' })
}

function shellguard(p, c) {
  removeBranch(p,
    ['left-hip', 'left-knee', 'left-ankle', 'right-hip', 'right-knee', 'right-ankle'],
    ['left-thigh', 'left-shin', 'left-foot', 'right-thigh', 'right-shin', 'right-foot'])
  setJoint(p, 'head', { y: 22, z: -4 })
  setPart(p, 'torso', { shape: 'rect', width: 119, height: 177, fill: c.dark })
  setPart(p, 'hips', { shape: 'triangle', width: 88, height: 65, rotationZ: 180 })
  organ(p, c, 'coffin-keel', '棺底脊', 'pelvis', [0, -15, -9], [0, -115, -11],
    { shape: 'triangle', breadth: 53, fill: 'dark', wave: 4, sweep: 24 })
  for (const sign of [-1, 1]) {
    organ(p, c, sign < 0 ? 'left-coffin-root' : 'right-coffin-root', '拖地棺根', 'pelvis',
      [sign * 31, -19, -14], [sign * 42, -82, 17],
      { shape: 'capsule', breadth: 16, wave: sign * 12, sweep: sign * 29 })
  }
  organ(p, c, 'gate-left', '左棺门', 'left-shoulder', [-21, 4, 17], [-10, -84, 19],
    { shape: 'rect', breadth: 62, fill: 'edge', wave: -8, sweep: -24, thrust: 15 })
  organ(p, c, 'gate-right', '右棺门', 'right-shoulder', [21, 4, 17], [10, -84, 19],
    { shape: 'rect', breadth: 62, fill: 'edge', wave: 8, sweep: 24, thrust: 15 })
  organ(p, c, 'seal-spike', '封棺钉', 'head', [0, 18, 13], [0, 52, 9],
    { shape: 'triangle', breadth: 24, fill: 'dark', sweep: 16 })
}

function wisp(p, c) {
  setPart(p, 'body', { width: 76, height: 82 })
  setPart(p, 'lower-veil', { width: 60, height: 107 })
  setPart(p, 'crown-flame', { height: 101, width: 43 })
  organ(p, c, 'spear-shadow', '副矛影', 'left-fin-tip', [-12, 1, 10], [-4, 88, 7],
    { shape: 'capsule', breadth: 11, wave: -15, sweep: -32, thrust: 39, tipShape: 'diamond' })
  organ(p, c, 'lantern-rib', '浮灯骨', 'crown', [0, 18, -8], [0, 42, -13],
    { shape: 'diamond', breadth: 35, fill: 'dark', sweep: 27 })
}

function patrolHound(p, c) {
  setJoint(p, 'neck', { y: 11, z: 66 })
  setPart(p, 'muzzle', { width: 83, height: 43 })
  organ(p, c, 'bell-jaw', '巡铃下颌', 'jaw', [0, -17, 12], [0, -23, 19],
    { shape: 'diamond', breadth: 35, wave: 13, sweep: 24, tipShape: 'circle', tipSize: 21 })
  organ(p, c, 'scent-left', '左香烟须', 'head', [-25, 4, 15], [-31, 26, 29],
    { shape: 'capsule', breadth: 10, wave: -23, sweep: 17 })
  organ(p, c, 'scent-right', '右香烟须', 'head', [25, 4, 15], [31, 26, 29],
    { shape: 'capsule', breadth: 10, wave: 23, sweep: -17 })
}

function redneedleSalamander(p, c) {
  setPart(p, 'barrel', { width: 72, height: 58 })
  setJoint(p, 'haunch', { z: -74 })
  for (let index = 0; index < 3; index += 1) {
    organ(p, c, `needle-${index}`, '活赤针', 'root', [0, 29, 38 - index * 37], [0, 37 + index * 7, 13],
      { shape: 'triangle', breadth: 18, sweep: (index % 2 ? -1 : 1) * 26, thrust: 24 + index * 8 })
  }
  organ(p, c, 'tail-fork', '火蜥叉尾', 'tail-tip', [13, 0, -9], [28, -6, -36],
    { shape: 'triangle', breadth: 20, wave: 20, sweep: -32 })
}

function rotSacToad(p, c) {
  setPart(p, 'barrel', { width: 133, height: 117 })
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? 'left' : 'right'
    organ(p, c, `${side}-throat`, '侧鸣囊', 'jaw', [sign * 24, -12, 8], [sign * 26, -11, 13],
      { shape: 'ellipse', breadth: 39, wave: sign * 16, sweep: sign * 28, fill: 'edge', tipShape: 'circle', tipSize: 31 })
  }
  organ(p, c, 'tongue-barb', '舌尖倒钩', 'tongue-tip', [0, -2, 7], [0, 6, 28],
    { shape: 'triangle', breadth: 19, sweep: 42, thrust: 47 })
}

function clawBeast(p, c) {
  removeBranch(p,
    ['left-hind-hip', 'left-hind-knee', 'left-hind-paw',
      'right-hind-hip', 'right-hind-knee', 'right-hind-paw'],
    ['left-hind-upper', 'left-hind-lower', 'left-hind-foot',
      'right-hind-upper', 'right-hind-lower', 'right-hind-foot'])
  setJoint(p, 'neck', { y: 4, z: 73 })
  setPart(p, 'barrel', { shape: 'diamond', width: 103, height: 107 })
  setPart(p, 'rump', { width: 61, height: 49 })
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1
    organ(p, c, `${side}-drown-claw`, '溺爪巨指', `${side}-front-paw`, [sign * 8, -2, 10], [sign * 26, -8, 29],
      { shape: 'triangle', breadth: 32, wave: sign * 16, sweep: sign * 39, thrust: 38 })
  }
  organ(p, c, 'water-keel', '腹下水鳍', 'root', [0, -36, 0], [0, -34, -43],
    { shape: 'ellipse', breadth: 65, tilt: -44, wave: 14, sweep: 31, fill: 'dark' })
  for (const sign of [-1, 1]) {
    organ(p, c, sign < 0 ? 'left-trailing-fin' : 'right-trailing-fin', '拖潮鳍', 'haunch',
      [sign * 20, -14, -18], [sign * 48, -52, -22],
      { shape: 'triangle', breadth: 33, tilt: sign * 32, wave: sign * 17,
        sweep: sign * 32, fill: 'dark' })
  }
}

function broodmother(p, c) {
  removeBranch(p,
    ['left-leg-0-coxa', 'left-leg-0-knee', 'left-leg-0-tip', 'right-leg-0-coxa', 'right-leg-0-knee', 'right-leg-0-tip'],
    ['left-leg-0-femur', 'left-leg-0-tibia', 'right-leg-0-femur', 'right-leg-0-tibia'])
  setJoint(p, 'abdomen', { y: 17, z: -77 })
  setPart(p, 'carapace', { shape: 'diamond', width: 177, height: 172 })
  setPart(p, 'belly', { width: 102, height: 116, fill: c.dark })
  setPart(p, 'thorax', { width: 66, height: 52 })
  for (const sign of [-1, 1]) {
    organ(p, c, sign < 0 ? 'left-birth-pillar' : 'right-birth-pillar', '育巢支柱', 'abdomen',
      [sign * 54, -15, 3], [sign * 32, -79, 16],
      { shape: 'capsule', breadth: 29, wave: sign * 9, sweep: sign * 26, fill: 'dark' })
  }
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1
    organ(p, c, `${side}-womb-door`, '裂腹育门', 'abdomen', [sign * 30, -14, 5], [sign * 36, -19, 18],
      { shape: 'ellipse', breadth: 48, wave: sign * 11, sweep: sign * 35, thrust: 25, fill: 'dark' })
  }
  const larva = organ(p, c, 'larva-head', '腹内幼首', 'abdomen', [0, -13, 13], [0, -22, 36],
    { shape: 'diamond', breadth: 30, sweep: 44, thrust: 46, tipShape: 'ellipse', tipSize: 28 })
  organ(p, c, 'larva-bite', '胎中噬口', larva, [0, -8, 9], [0, -17, 19],
    { shape: 'triangle', breadth: 17, sweep: 38, thrust: 32 })
  for (const sign of [-1, 1]) {
    organ(p, c, sign < 0 ? 'left-egg' : 'right-egg', '背负卵囊', 'abdomen', [sign * 39, 22, 25], [sign * 42, 21, 18],
      { shape: 'ellipse', breadth: 28, wave: sign * 14, sweep: sign * 22, fill: 'body', tipShape: 'circle', tipSize: 30 })
  }
}

function mossColossus(p, c) {
  setJoint(p, 'left-shoulder', { x: -63, y: 48 })
  setJoint(p, 'left-elbow', { x: -34, y: -63 })
  setJoint(p, 'neck', { x: 10, y: 18, z: 17 })
  setJoint(p, 'head', { x: 17, y: 4, z: 19 })
  setPart(p, 'torso', { width: 126, height: 139 })
  setPart(p, 'skull', { width: 58, height: 53 })
  setPart(p, 'left-arm', { height: 41 })
  setPart(p, 'right-foot', { width: 67, height: 34 })
  organ(p, c, 'shoulder-tree', '肩上寄树', 'left-shoulder', [-13, 17, -8], [-31, 65, -6],
    { shape: 'capsule', breadth: 17, sweep: 23, fill: 'dark', tipShape: 'ellipse', tipSize: 38 })
  organ(p, c, 'root-hand', '垂根巨掌', 'right-wrist', [7, -14, 3], [13, -53, 22],
    { shape: 'ellipse', breadth: 35, sweep: 37, thrust: 36 })
}

function sentryCrossbow(p, c) {
  removeBranch(p,
    ['left-hip', 'left-knee', 'left-ankle', 'right-hip', 'right-knee', 'right-ankle'],
    ['left-thigh', 'left-shin', 'left-foot', 'right-thigh', 'right-shin', 'right-foot'])
  setPart(p, 'torso', { shape: 'triangle', width: 86, height: 113 })
  setPart(p, 'hips', { shape: 'diamond', width: 62, height: 72 })
  setJoint(p, 'head', { y: 25, z: 14 })
  setPart(p, 'skull', { width: 51, height: 56 })
  organ(p, c, 'tripod-spine', '弩台主脊', 'pelvis', [0, -17, 1], [0, -112, 0],
    { shape: 'capsule', breadth: 25, fill: 'dark', wave: 5, sweep: 18 })
  for (const sign of [-1, 1]) {
    organ(p, c, sign < 0 ? 'left-tripod' : 'right-tripod', '弩台斜撑', 'pelvis',
      [sign * 15, -14, -12], [sign * 68, -102, 22],
      { shape: 'capsule', breadth: 16, wave: sign * 9, sweep: sign * 27 })
  }
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1
    organ(p, c, `${side}-bow-limb`, '活弩弓臂', 'weapon', [sign * 17, 35, 8], [sign * 51, 9, 11],
      { shape: 'capsule', breadth: 11, wave: sign * 8, sweep: sign * 32, thrust: 20 })
  }
  organ(p, c, 'watch-eye', '弩上监目', 'weapon-tip', [0, 8, 8], [0, 20, 17],
    { shape: 'diamond', breadth: 22, sweep: 19, tipShape: 'circle', tipSize: 23 })
}

function ashCannonBug(p, c) {
  setPart(p, 'carapace', { width: 91, height: 74 })
  setPart(p, 'muzzle-ring', { width: 66, height: 49 })
  setPart(p, 'head-shell', { width: 52, height: 43 })
  setJoint(p, 'barrel-mouth', { z: 130, y: 5 })
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1
    organ(p, c, `${side}-ash-bellows`, '灰囊风箱', 'abdomen', [sign * 36, 2, -10], [sign * 37, 12, 18],
      { shape: 'ellipse', breadth: 42, wave: sign * 15, sweep: sign * 27, thrust: 33, fill: 'dark' })
  }
  organ(p, c, 'muzzle-petal', '炮口裂瓣', 'barrel-mouth', [0, 5, 8], [0, 26, 14],
    { shape: 'triangle', breadth: 29, sweep: 42, thrust: 37 })
  organ(p, c, 'ash-probe', '测灰触针', 'head', [-19, 10, 12], [-21, 34, 29],
    { shape: 'capsule', breadth: 10, wave: -19, sweep: 24, thrust: 29 })
}

function furnaceBeetle(p, c) {
  removeBranch(p,
    ['left-leg-0-coxa', 'left-leg-0-knee', 'left-leg-0-tip', 'right-leg-0-coxa', 'right-leg-0-knee', 'right-leg-0-tip'],
    ['left-leg-0-femur', 'left-leg-0-tibia', 'right-leg-0-femur', 'right-leg-0-tibia'])
  setJoint(p, 'abdomen', { y: 18, z: -72 })
  setPart(p, 'carapace', { shape: 'diamond', width: 139, height: 132, fill: c.dark })
  setPart(p, 'head-shell', { width: 48, height: 39 })
  organ(p, c, 'furnace-pedestal', '行炉底座', 'abdomen', [0, -22, -3], [0, -84, 21],
    { shape: 'triangle', breadth: 54, fill: 'dark', wave: 6, sweep: 26 })
  for (const sign of [-1, 1]) {
    organ(p, c, sign < 0 ? 'left-furnace-door' : 'right-furnace-door', '炉门鞘翅', 'abdomen', [sign * 29, 14, -4], [sign * 38, 12, -31],
      { shape: 'diamond', breadth: 55, tilt: sign * 18, wave: sign * 11, sweep: sign * 42, fill: 'body' })
  }
  organ(p, c, 'heat-chimney', '活炉烟囱', 'abdomen', [0, 21, -23], [0, 47, -12],
    { shape: 'capsule', breadth: 17, sweep: 35, thrust: 43, tipShape: 'triangle', tipSize: 31 })
}

function thornShellFlower(p, c) {
  setPart(p, 'flower-disc', { width: 67, height: 75 })
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1
    organ(p, c, `${side}-iron-calyx`, '铁壳花萼', 'flower', [sign * 26, -20, -11], [sign * 42, -13, 12],
      { shape: 'diamond', breadth: 47, tilt: sign * 24, wave: sign * 8, sweep: sign * 39, fill: 'dark' })
  }
  organ(p, c, 'stinger-crown', '刺冠喉', 'core', [0, 10, 13], [0, 41, 18],
    { shape: 'triangle', breadth: 26, sweep: 43, thrust: 51 })
}

function waterLeechSwarm(p, c) {
  for (let i = 0; i < 3; i += 1) {
    setJoint(p, `body-${i}`, { x: (i - 1) * 48, y: i === 1 ? 14 : -4, z: (i - 1) * 32 })
    setJoint(p, `head-${i}`, { y: 19, z: 27 })
    setPart(p, `shell-${i}`, { shape: 'capsule', width: 34, height: 105, rotationX: -39, rotationZ: (i - 1) * 17 })
    organ(p, c, `leech-fin-${i}`, '尸蛭背鳍', `body-${i}`, [0, 26, -12], [0, 35, -11],
      { shape: 'ellipse', breadth: 27, tilt: -34, wave: (i - 1) * 15, sweep: 22 + i * 5, fill: 'dark' })
  }
  organ(p, c, 'current-bridge', '群潮联膜', 'body-1', [0, -31, -7], [0, -55, -32],
    { shape: 'ellipse', breadth: 17, wave: -13, sweep: 28, thrust: 31 })
}

function whirlpoolEyeSac(p, c) {
  removeBranch(p,
    ['left-fin', 'left-fin-tip', 'right-fin', 'right-fin-tip', 'left-tendril', 'left-tendril-tip', 'right-tendril', 'right-tendril-tip'],
    ['left-wing', 'right-wing', 'left-tentacle', 'right-tentacle'])
  setPart(p, 'body', { shape: 'circle', width: 117, height: 117 })
  setPart(p, 'eye-ring', { width: 73, height: 73 })
  setPart(p, 'lower-veil', { width: 50, height: 55 })
  for (let i = 0; i < 4; i += 1) {
    const angle = Math.PI * 2 * i / 4
    const x = Math.round(Math.cos(angle) * 40), y = Math.round(Math.sin(angle) * 38)
    organ(p, c, `vortex-${i}`, '回潮旋叶', 'root', [x, y, i % 2 ? -15 : 17],
      [Math.round(Math.cos(angle) * 44), Math.round(Math.sin(angle) * 43), 16],
      { shape: 'ellipse', breadth: 29, tilt: i * 24, wave: i % 2 ? -17 : 17, sweep: 29 + i * 4 })
  }
  const pupil = organ(p, c, 'pupil-tether', '瞳心牵索', 'eye', [0, 0, 13], [0, -11, 35],
    { shape: 'capsule', breadth: 12, sweep: 46, thrust: 53, tipShape: 'circle', tipSize: 24 })
  organ(p, c, 'iris-hook', '涡瞳倒钩', pupil, [0, 6, 8], [0, 19, 15],
    { shape: 'triangle', breadth: 19, wave: -21, sweep: 38, thrust: 29 })
}

function moltenCoreBeast(p, c) {
  setPart(p, 'barrel', { width: 122, height: 101, fill: c.dark })
  setPart(p, 'core', { width: 72, height: 66 })
  for (const sign of [-1, 1]) {
    organ(p, c, sign < 0 ? 'left-lava-lung' : 'right-lava-lung', '熔核肺囊', 'root', [sign * 28, 27, -9], [sign * 21, 32, 16],
      { shape: 'ellipse', breadth: 43, wave: sign * 10, sweep: sign * 28, thrust: 27, fill: 'body', tipShape: 'circle', tipSize: 28 })
  }
  organ(p, c, 'slag-jaw', '熔渣下颌', 'jaw', [0, -12, 13], [0, -25, 30],
    { shape: 'diamond', breadth: 39, sweep: 33, thrust: 42 })
  for (const sign of [-1, 1]) {
    organ(p, c, sign < 0 ? 'left-magma-leg' : 'right-magma-leg', '熔核副足', 'root', [sign * 42, -22, -16],
      [sign * 39, -72, 10], { shape: 'capsule', breadth: 28, wave: sign * 11, sweep: sign * 31, thrust: 25 })
  }
}

function redwheelFireCrow(p, c) {
  setPart(p, 'breast', { width: 73, height: 96 })
  const wheel = organ(p, c, 'fire-wheel-hub', '赤轮轴', 'tail', [0, -12, -13], [0, -37, -19],
    { shape: 'diamond', breadth: 33, sweep: 34, thrust: 38, tipShape: 'circle', tipSize: 34 })
  for (let i = 0; i < 4; i += 1) {
    const sign = i % 2 ? -1 : 1
    organ(p, c, `wheel-spoke-${i}`, '轮焰羽辐', wheel,
      [sign * (i < 2 ? 16 : 6), i < 2 ? 7 : -14, 3],
      [sign * (i < 2 ? 37 : 19), i < 2 ? 19 : -35, 12],
      { shape: 'triangle', breadth: 20, wave: sign * 18, sweep: sign * (22 + i * 5), thrust: 28 })
  }
}

function cinderCurseLampSwarm(p, c) {
  for (let i = 0; i < 3; i += 1) {
    setPart(p, `shell-${i}`, { shape: 'diamond', width: 48, height: 67 })
    setPart(p, `jaw-${i}`, { shape: 'diamond', width: 18, height: 21 })
    setJoint(p, `head-${i}`, { y: 20, z: 14 })
    organ(p, c, `handle-${i}`, '悬灯提梁', `head-${i}`, [0, 19, -3], [0, 35, -7],
      { shape: 'capsule', breadth: 11, wave: (i - 1) * 14, sweep: 19, fill: 'dark', tipShape: 'diamond', tipSize: 22 })
    organ(p, c, `shutter-${i}`, '咒灯活门', `body-${i}`, [i % 2 ? 19 : -19, 3, 11], [i % 2 ? 13 : -13, -24, 5],
      { shape: 'diamond', breadth: 25, wave: (i % 2 ? 1 : -1) * 15, sweep: 31, thrust: 27 })
  }
}

function tideRiteMatriarch(p, c) {
  removeBranch(p,
    ['left-hip', 'left-knee', 'left-ankle', 'right-hip', 'right-knee', 'right-ankle'],
    ['left-thigh', 'left-shin', 'left-foot', 'right-thigh', 'right-shin', 'right-foot'])
  setPart(p, 'torso', { shape: 'diamond', width: 106, height: 143 })
  setPart(p, 'hips', { width: 113, height: 56 })
  setPart(p, 'skull', { shape: 'triangle', width: 63, height: 66 })
  part(p, 'ritual-skirt', '潮祀悬裾', 'triangle', 'pelvis', 141, 149, c.dark, { rotationZ: 180, y: -46, layer: 2 })
  setJoint(p, 'head', { y: 29, z: 20 })
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1
    organ(p, c, `${side}-prayer-arm`, '潮祀副臂', 'root', [sign * 27, 7, -20], [sign * 48, -27, 18],
      { shape: 'capsule', breadth: 16, wave: sign * 18, sweep: sign * 42, thrust: 37, tipShape: 'diamond' })
    organ(p, c, `${side}-veil`, '祭服潮翼', 'pelvis', [sign * 25, -14, -8], [sign * 53, -47, -12],
      { shape: 'ellipse', breadth: 41, tilt: sign * 29, wave: sign * 12, sweep: sign * 24, fill: 'dark' })
  }
  organ(p, c, 'ritual-crown', '召潮冠', 'head', [0, 28, -5], [0, 48, 4],
    { shape: 'triangle', breadth: 39, sweep: 26, thrust: 45 })
}

function drownShadowHunter(p, c) {
  setJoint(p, 'neck', { y: 75, z: 19 })
  setJoint(p, 'right-elbow', { x: 39, y: -72, z: 11 })
  setPart(p, 'torso', { width: 67, height: 135 })
  organ(p, c, 'drown-veil', '溺影后披', 'pelvis', [0, -15, -24], [0, -67, -34],
    { shape: 'ellipse', breadth: 61, tilt: -27, wave: -17, sweep: 34, fill: 'dark' })
  organ(p, c, 'hook-finger', '牵潮长钩', 'right-finger', [8, -7, 9], [26, -44, 32],
    { shape: 'triangle', breadth: 22, wave: 22, sweep: 44, thrust: 52 })
}

function tidalSporeSac(p, c) {
  setPart(p, 'flower-disc', { width: 75, height: 64 })
  setPart(p, 'bulb', { width: 107, height: 93 })
  for (let i = 0; i < 3; i += 1) {
    const x = (i - 1) * 28
    organ(p, c, `spore-stalk-${i}`, '群潮孢茎', 'flower', [x, 23, i % 2 ? 17 : -11], [x * .45, 42 + i * 8, 13],
      { shape: 'capsule', breadth: 15, wave: (i - 1) * 16, sweep: 25 + i * 5, thrust: 31 + i * 7,
        tipShape: 'circle', tipSize: 26 + i * 4 })
  }
  organ(p, c, 'burst-root', '爆孢根', 'root', [0, -27, 15], [0, -39, 26],
    { shape: 'triangle', breadth: 29, sweep: 38, thrust: 36 })
}

function revenantGuard(p, c) {
  removeBranch(p,
    ['left-hip', 'left-knee', 'left-ankle'],
    ['left-thigh', 'left-shin', 'left-foot'])
  setPart(p, 'torso', { shape: 'rect', width: 103, height: 151, fill: c.dark })
  setPart(p, 'skull', { width: 58, height: 74 })
  setPart(p, 'hips', { shape: 'diamond', width: 91, height: 68 })
  for (const sign of [-1, 1]) {
    organ(p, c, sign < 0 ? 'left-grave-root' : 'right-grave-root', '墓碑行根', 'pelvis',
      [sign * 25, -17, -9], [sign * 55, -94, 19],
      { shape: 'capsule', breadth: 19, wave: sign * 15, sweep: sign * 33, fill: 'dark' })
  }
  organ(p, c, 'tomb-back', '背负墓碑', 'root', [0, 13, -24], [0, 78, -4],
    { shape: 'rect', breadth: 54, fill: 'edge', wave: 5, sweep: 17, thrust: 13 })
  organ(p, c, 'sleeve-blade', '袖中骨刃', 'left-wrist', [-8, -12, 5], [-13, -56, 17],
    { shape: 'triangle', breadth: 24, wave: -12, sweep: -39, thrust: 32 })
  organ(p, c, 'helmet-flag', '魂幡', 'head', [0, 23, -9], [0, 52, -4],
    { shape: 'ellipse', breadth: 29, tilt: -24, wave: 17, sweep: 29, fill: 'body' })
}

function bombWisp(p, c) {
  removeBranch(p, ['left-fin', 'left-fin-tip', 'right-fin', 'right-fin-tip'], ['left-wing', 'right-wing'])
  setPart(p, 'body', { width: 121, height: 115 })
  setPart(p, 'eye-ring', { width: 39, height: 42 })
  setPart(p, 'lower-veil', { width: 44, height: 47 })
  for (let i = 0; i < 4; i += 1) {
    const x = (i % 2 ? -1 : 1) * (i < 2 ? 37 : 23)
    const y = i < 2 ? 25 : -34
    organ(p, c, `fuse-${i}`, '倒数灯芯', 'root', [x, y, i < 2 ? -9 : 12], [x * .45, y * .7, 13],
      { shape: 'triangle', breadth: 18, wave: (i % 2 ? -1 : 1) * 17, sweep: 27 + i * 4, thrust: 46 })
  }
  organ(p, c, 'detonation-core', '自爆核', 'eye', [0, 0, 9], [0, 0, 23],
    { shape: 'diamond', breadth: 39, sweep: 36, thrust: 55, tipShape: 'circle', tipSize: 29 })
}

function crackedHunter(p, c) {
  removeBranch(p, ['left-shoulder', 'left-elbow', 'left-wrist', 'left-finger'],
    ['left-arm', 'left-forearm', 'left-claw', 'left-pauldron'])
  setJoint(p, 'neck', { x: -23, y: 43, z: 12 })
  setJoint(p, 'head', { x: -11, y: 26, z: 13 })
  setPart(p, 'torso', { shape: 'diamond', width: 88, height: 113 })
  setPart(p, 'skull', { shape: 'triangle', width: 65, height: 75 })
  for (const sign of [-1, 1]) {
    organ(p, c, sign < 0 ? 'left-crack' : 'right-crack', '裂甲活片', 'root', [sign * 24, 25, 9], [sign * 32, -21, 19],
      { shape: 'diamond', breadth: 34, tilt: sign * 19, wave: sign * 10, sweep: sign * 35, fill: 'edge' })
  }
  organ(p, c, 'hunting-hook', '追猎钩', 'right-wrist', [8, -12, 10], [23, -44, 28],
    { shape: 'triangle', breadth: 28, wave: 17, sweep: 46, thrust: 47 })
  organ(p, c, 'missing-arm', '裂缝代臂', 'root', [-49, 32, -11], [-62, -43, 32],
    { shape: 'ellipse', breadth: 21, tilt: -33, wave: -19, sweep: -44, thrust: 38, fill: 'dark', tipShape: 'triangle' })
}

function broodling(p, c) {
  const removed = ['left-leg-2', 'right-leg-2']
  removeBranch(p, removed.flatMap((id) => [`${id}-coxa`, `${id}-knee`, `${id}-tip`]),
    removed.flatMap((id) => [`${id}-femur`, `${id}-tibia`]))
  setPart(p, 'carapace', { width: 70, height: 106 })
  setJoint(p, 'abdomen', { z: -68 })
  organ(p, c, 'larval-ring', '幼体腹环', 'abdomen', [0, 2, -17], [0, -5, -34],
    { shape: 'ellipse', breadth: 43, wave: 8, sweep: 31, tipShape: 'ellipse', tipSize: 29 })
  organ(p, c, 'hatch-fang', '初生裂颚', 'mandible', [0, -9, 9], [0, -17, 28],
    { shape: 'triangle', breadth: 21, sweep: 42, thrust: 35 })
}

function leechLarva(p, c) {
  const removed = [1, 2]
  removeBranch(p, removed.flatMap((i) => [`body-${i}`, `head-${i}`, `mouth-${i}`, `tail-${i}`, `tail-tip-${i}`]),
    removed.flatMap((i) => [`shell-${i}`, `eye-${i}`, `jaw-${i}`, `tail-part-${i}`, `mark-${i}`]))
  setJoint(p, 'body-0', { x: 0, y: 5, z: 0 })
  setPart(p, 'shell-0', { width: 53, height: 102 })
  let parent = 'tail-tip-0'
  for (let i = 0; i < 3; i += 1) {
    parent = organ(p, c, `larva-segment-${i}`, '尸蛭环节', parent, [0, -6, -4], [0, -28, -8],
      { shape: 'ellipse', breadth: 30 - i * 3, wave: i % 2 ? -13 : 13, sweep: 20 + i * 6 })
  }
  organ(p, c, 'sucker-left', '左吸盘口', 'mouth-0', [-11, 4, 7], [-14, 10, 16],
    { shape: 'diamond', breadth: 20, sweep: -38, tipShape: 'circle', tipSize: 18 })
  organ(p, c, 'sucker-right', '右吸盘口', 'mouth-0', [11, 4, 7], [14, 10, 16],
    { shape: 'diamond', breadth: 20, sweep: 38, tipShape: 'circle', tipSize: 18 })
  track(p, 'death', 'root', [[0, {}], [.38, { dy: -27, rotationZ: 27 }],
    [1, { dy: -92, rotationZ: 83, rotationX: 21 }]])
  track(p, 'death', 'body-0', [[0, {}], [.46, { rotationZ: -24 }],
    [1, { rotationZ: -46, rotationX: 19 }]])
}

function tideShadow(p, c) {
  removeBranch(p, ['weapon', 'weapon-tip'], ['lance'])
  setPart(p, 'body', { shape: 'diamond', width: 81, height: 121 })
  setPart(p, 'lower-veil', { width: 112, height: 95, rotationX: -31 })
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1
    organ(p, c, `${side}-shadow-hand`, '潮影裂掌', `${side}-fin-tip`, [sign * 11, 4, 8], [sign * 32, -29, 25],
      { shape: 'triangle', breadth: 34, wave: sign * 21, sweep: sign * 37, thrust: 42 })
  }
  organ(p, c, 'hollow-face', '空面孔', 'eye', [0, 6, 11], [0, 17, 26],
    { shape: 'diamond', breadth: 35, fill: 'dark', sweep: 29, thrust: 34 })
  organ(p, c, 'deep-veil', '潮底长裾', 'keel', [0, -26, -16], [0, -66, -31],
    { shape: 'ellipse', breadth: 48, tilt: -34, wave: 18, sweep: 29, fill: 'dark' })
}

const VARIANTS = Object.freeze({
  'tide-shadow-cub': tideShadowCub, 'nest-spider': nestSpider, 'beetle-guard': beetleGuard,
  'rot-walker': rotWalker, shellguard, wisp, 'patrol-hound': patrolHound,
  'redneedle-salamander': redneedleSalamander, 'rot-sac-toad': rotSacToad,
  'claw-beast': clawBeast, broodmother, 'moss-colossus': mossColossus,
  'sentry-crossbow': sentryCrossbow, 'ash-cannon-bug': ashCannonBug,
  'furnace-beetle': furnaceBeetle, 'thorn-shell-flower': thornShellFlower,
  'water-leech-swarm': waterLeechSwarm, 'whirlpool-eye-sac': whirlpoolEyeSac,
  'molten-core-beast': moltenCoreBeast, 'redwheel-fire-crow': redwheelFireCrow,
  'cinder-curse-lamp-swarm': cinderCurseLampSwarm, 'tide-rite-matriarch': tideRiteMatriarch,
  'drown-shadow-hunter': drownShadowHunter, 'tidal-spore-sac': tidalSporeSac,
  'revenant-guard': revenantGuard, 'bomb-wisp': bombWisp,
  'cracked-hunter': crackedHunter, broodling, 'leech-larva': leechLarva,
  'tide-shadow': tideShadow,
})

export function applyEnemyVariant(project, colors) {
  VARIANTS[project.enemyId]?.(project, colors)
}

export const VARIANT_ENEMY_IDS = Object.freeze(Object.keys(VARIANTS))
