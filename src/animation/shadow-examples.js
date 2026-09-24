import {
  createDefaultShadowProject,
  createShadowBone,
  createShadowCharacter,
  createShadowJoint,
  createShadowPart,
  reflectShadowProjectZ,
  shadowTargetKey,
  upsertShadowKeyframe,
} from './shadow-rig.js'

export const SHADOW_EXAMPLE_PACK_VERSION = 1
export const SHADOW_EXAMPLE_REPAIR_VERSION = 8

export const SHADOW_TEXTURE_PRESETS = Object.freeze([
  { id: 'robe', label: '\u50e7\u888d', url: '/assets/enemies/bell-pilgrim-robe-v1-medium.png' },
  { id: 'skull', label: '\u94c3\u5934', url: '/assets/enemies/bell-pilgrim-skull-v1-medium.png' },
  { id: 'abdomen', label: '\u86db\u8179', url: '/assets/enemies/tide-spider-abdomen-v1-medium.png' },
  { id: 'spider-head', label: '\u86db\u5934', url: '/assets/enemies/tide-spider-head-v1-medium.png' },
  { id: 'left-wing', label: '\u5de6\u7fc5', url: '/assets/enemies/lantern-moth-left-wing-v2-medium.png' },
  { id: 'right-wing', label: '\u53f3\u7fc5', url: '/assets/enemies/lantern-moth-right-wing-v2-medium.png' },
  { id: 'moth-head', label: '\u706f\u5934', url: '/assets/enemies/lantern-moth-head-v1-medium.png' },
  { id: 'ribcage', label: '\u80f8\u9aa8', url: '/assets/enemies/bell-pilgrim-ribcage-v1-small.png' },
  { id: 'handbell', label: '\u624b\u94c3', url: '/assets/enemies/bell-pilgrim-handbell-v1-small.png' },
  { id: 'upper-leg', label: '\u4e0a\u817f', url: '/assets/enemies/tide-spider-upper-leg-v1-small.png' },
  { id: 'lower-leg', label: '\u9488\u80eb', url: '/assets/enemies/tide-spider-lower-leg-v1-small.png' },
  { id: 'thorax', label: '\u80f8\u8282', url: '/assets/enemies/lantern-moth-thorax-v1-small.png' },
  { id: 'moth-abdomen', label: '\u86fe\u8179', url: '/assets/enemies/lantern-moth-abdomen-v1-small.png' },
  { id: 'pilgrim-mouth', label: '\u884c\u50e7\u88c2\u53e3', url: '/assets/enemies/bell-pilgrim-mouth-v2-small.png' },
  { id: 'pilgrim-eye', label: '\u884c\u50e7\u72ec\u773c', url: '/assets/enemies/bell-pilgrim-eye-v1-small.png' },
  { id: 'pilgrim-arm', label: '\u884c\u50e7\u624b\u81c2', url: '/assets/enemies/bell-pilgrim-arm-v1-small.png' },
  { id: 'pilgrim-claw', label: '\u884c\u50e7\u722a', url: '/assets/enemies/bell-pilgrim-claw-v1-small.png' },
  { id: 'bell-mouth', label: '\u94c3\u9ed1\u8154', url: '/assets/enemies/bell-pilgrim-bell-mouth-v1-small.png' },
  { id: 'pilgrim-leg', label: '\u884c\u50e7\u817f', url: '/assets/enemies/bell-pilgrim-leg-v1-small.png' },
  { id: 'spider-body', label: '\u86db\u8eab\u7532', url: '/assets/enemies/tide-spider-body-v1-small.png' },
  { id: 'spider-mark', label: '\u86db\u8179\u773c\u7eb9', url: '/assets/enemies/tide-spider-abdomen-mark-v1-small.png' },
  { id: 'spider-eye', label: '\u86db\u773c', url: '/assets/enemies/tide-spider-eye-v1-small.png' },
  { id: 'moth-eye', label: '\u706f\u86fe\u706f\u82af', url: '/assets/enemies/lantern-moth-eye-v1-small.png' },
  { id: 'moth-wing-eye', label: '\u706f\u86fe\u7fc5\u773c', url: '/assets/enemies/lantern-moth-wing-eye-v1-small.png' },
  { id: 'moth-tail-glow', label: '\u706f\u86fe\u5c3e\u706b', url: '/assets/enemies/lantern-moth-tail-glow-v1-small.png' },
  { id: 'moth-antenna', label: '\u706f\u86fe\u89e6\u987b', url: '/assets/enemies/lantern-moth-antenna-v1-small.png' },
])

const PRESET_URLS = Object.fromEntries(SHADOW_TEXTURE_PRESETS.map(({ id, url }) => [id, url]))
const LEGACY_WING_URL = '/assets/enemies/lantern-moth-wing-v1-medium.png'
const LEGACY_PILGRIM_MOUTH_URL = '/assets/enemies/bell-pilgrim-mouth-v1-small.png'
const SPIDER_LEG_PART = /^(left|right)-[0-2]-(upper|lower)$/
const EXAMPLE_TEXTURES = Object.freeze({
  robe: PRESET_URLS.robe,
  skull: PRESET_URLS.skull,
  'abdomen-shell': PRESET_URLS.abdomen,
  'head-shell': PRESET_URLS['spider-head'],
  'left-wing-membrane': PRESET_URLS['left-wing'],
  'right-wing-membrane': PRESET_URLS['right-wing'],
  'head-lamp': PRESET_URLS['moth-head'],
  ribcage: PRESET_URLS.ribcage,
  bell: PRESET_URLS.handbell,
  thorax: PRESET_URLS.thorax,
  abdomen: PRESET_URLS['moth-abdomen'],
  mouth: PRESET_URLS['pilgrim-mouth'],
  eye: PRESET_URLS['pilgrim-eye'],
  'left-arm': PRESET_URLS['pilgrim-arm'],
  'right-arm': PRESET_URLS['pilgrim-arm'],
  'left-claw': PRESET_URLS['pilgrim-claw'],
  'bell-mouth': PRESET_URLS['bell-mouth'],
  'left-leg': PRESET_URLS['pilgrim-leg'],
  'right-leg': PRESET_URLS['pilgrim-leg'],
  body: PRESET_URLS['spider-body'],
  'abdomen-mark': PRESET_URLS['spider-mark'],
  'moth-eye': PRESET_URLS['moth-eye'],
  'left-wing-eye': PRESET_URLS['moth-wing-eye'],
  'right-wing-eye': PRESET_URLS['moth-wing-eye'],
  'tail-glow': PRESET_URLS['moth-tail-glow'],
  'left-antenna': PRESET_URLS['moth-antenna'],
  'right-antenna': PRESET_URLS['moth-antenna'],
})

function exampleTextureForPart(id) {
  const spiderLeg = SPIDER_LEG_PART.exec(id)
  if (spiderLeg) return PRESET_URLS[`${spiderLeg[2]}-leg`]
  if (/^eye-[0-2]$/.test(id)) return PRESET_URLS['spider-eye']
  return EXAMPLE_TEXTURES[id] || null
}

function newProject(name) {
  const project = createDefaultShadowProject()
  project.name = name
  return project
}

function joint(project, id, name, x, y, z, parentId = null, rotationY = 0) {
  project.joints.push(createShadowJoint({ id, name, x, y, z, rotationY }))
  if (parentId) project.bones.push(createShadowBone({ id: `bone-${parentId}-${id}`, fromJointId: parentId, toJointId: id }))
}

function part(project, id, name, shape, targetId, width, height, fill, options = {}) {
  const { x = 0, y = 0, z = 0, rotationX = 0, rotationY = 0, rotationZ = 0, layer = 0, bone = false, textureId = id } = options
  const entry = createShadowPart({
    id, name, shape, x, y, z, width, height, fill, stroke: '#a7a9a0',
    rotationX, rotationY, rotationZ, layer,
    attachment: { type: bone ? 'bone' : 'joint', targetId, t: 0.5, followRotation: true },
  })
  const texture = exampleTextureForPart(textureId)
  if (texture) entry.visual = { type: 'texture', texture, textureFit: SPIDER_LEG_PART.test(id) ? 'cover' : 'contain' }
  project.parts.push(entry)
}

function keys(project, action, targetId, frames, kind = 'joint') {
  const duration = project.animations[action].duration
  const target = shadowTargetKey(kind, targetId)
  for (const [fraction, pose] of frames) {
    upsertShadowKeyframe(project, action, target, Math.round(duration * fraction), pose)
  }
}

function bellPilgrim() {
  const project = newProject('\u788e\u94c3\u884c\u50e7')
  joint(project, 'root', '\u810a\u67f1', 0, 0, 0, null, -30)
  joint(project, 'head', '\u949f\u5934', -8, -91, -28, 'root')
  joint(project, 'jaw', '\u88c2\u989a', -10, 39, -23, 'head')
  joint(project, 'left-shoulder', '\u5de6\u80a9', -47, -43, -14, 'root')
  joint(project, 'left-elbow', '\u5de6\u8098', -18, 70, -26, 'left-shoulder')
  joint(project, 'left-hand', '\u5de6\u722a', -17, 54, -24, 'left-elbow')
  joint(project, 'right-shoulder', '\u53f3\u80a9', 47, -38, 20, 'root')
  joint(project, 'right-elbow', '\u53f3\u8098', 30, 66, 16, 'right-shoulder')
  joint(project, 'right-hand', '\u94c3\u67c4', -6, 54, -24, 'right-elbow')
  joint(project, 'left-hip', '\u5de6\u9acb', -25, 62, -10, 'root')
  joint(project, 'left-foot', '\u5de6\u8db3', -17, 118, -36, 'left-hip')
  joint(project, 'right-hip', '\u53f3\u9acb', 26, 61, 15, 'root')
  joint(project, 'right-foot', '\u53f3\u8db3', 20, 114, 26, 'right-hip')

  part(project, 'robe', '\u65ad\u5e03\u50e7\u888d', 'triangle', 'root', 145, 185, '#273944', { y: 28, z: 14, layer: 1 })
  part(project, 'ribcage', '\u9aa8\u8d28\u80f8\u8154', 'capsule', 'root', 87, 124, '#76817c', { y: -23, z: -10, layer: 2 })
  part(project, 'skull', '\u94c3\u578b\u5934\u9885', 'ellipse', 'head', 76, 91, '#798479', { layer: 4 })
  part(project, 'mouth', '\u88c2\u53e3', 'triangle', 'jaw', 36, 33, '#241c24', { z: -14, rotationZ: 180, layer: 5 })
  part(project, 'eye', '\u72ec\u773c', 'circle', 'head', 22, 22, '#c9a559', { x: -17, y: -12, z: -19, layer: 6 })
  part(project, 'left-arm', '\u7ec6\u957f\u5de6\u81c2', 'capsule', 'bone-left-shoulder-left-elbow', 82, 18, '#90978c', { bone: true, layer: 3 })
  part(project, 'left-claw', '\u5de6\u722a', 'triangle', 'left-hand', 42, 61, '#9a9d90', { y: 16, z: -8, layer: 4 })
  part(project, 'right-arm', '\u63d0\u94c3\u624b\u81c2', 'capsule', 'bone-right-shoulder-right-elbow', 76, 19, '#8b9186', { bone: true, layer: 3 })
  part(project, 'bell', '\u7a7a\u5fc3\u94dc\u94c3', 'ellipse', 'right-hand', 56, 67, '#a5864f', { y: 24, z: -14, layer: 7 })
  part(project, 'bell-mouth', '\u94c3\u9ed1\u8154', 'ellipse', 'right-hand', 35, 20, '#302729', { y: 45, z: -19, layer: 8 })
  part(project, 'left-leg', '\u5de6\u817f', 'capsule', 'bone-left-hip-left-foot', 120, 24, '#4c5a5d', { bone: true, layer: 2 })
  part(project, 'right-leg', '\u53f3\u817f', 'capsule', 'bone-right-hip-right-foot', 118, 24, '#4c5a5d', { bone: true, layer: 2 })

  keys(project, 'idle', 'root', [[0, {}], [.5, { dy: -5, dz: -7, rotationY: 5 }], [1, {}]])
  keys(project, 'idle', 'head', [[0, {}], [.5, { rotationX: 8, rotationZ: -5 }], [1, {}]])
  keys(project, 'idle', 'right-elbow', [[0, {}], [.5, { rotationX: -13, rotationZ: 9 }], [1, {}]])
  keys(project, 'idle', 'right-hand', [[0, {}], [.5, { rotationZ: -13, dz: -9 }], [1, {}]])

  keys(project, 'attack', 'root', [[0, {}], [.36, { dx: -14, dz: 22, rotationY: -12 }], [.72, { dx: -38, dz: -65, rotationY: 14 }], [1, { dx: -16, dz: -20 }]])
  keys(project, 'attack', 'right-shoulder', [[0, {}], [.36, { rotationZ: -42, rotationX: 24 }], [.72, { rotationZ: 56, rotationX: -48 }], [1, {}]])
  keys(project, 'attack', 'right-elbow', [[0, {}], [.36, { rotationZ: -24 }], [.72, { rotationZ: 38, dz: -24 }], [1, {}]])
  keys(project, 'attack', 'head', [[0, {}], [.72, { rotationX: -17, dz: -18 }], [1, {}]])

  keys(project, 'hit', 'root', [[0, {}], [.32, { dx: 22, dz: 32, rotationZ: 13, rotationY: -15 }], [1, {}]])
  keys(project, 'hit', 'head', [[0, {}], [.32, { rotationX: 24, rotationZ: 17 }], [1, {}]])
  keys(project, 'hit', 'right-hand', [[0, {}], [.4, { rotationZ: 28 }], [1, {}]])

  keys(project, 'death', 'root', [[0, {}], [.35, { rotationZ: -18, dy: 15, dz: 20 }], [1, { rotationZ: 78, dy: 123, dz: 35, dx: 48 }]])
  keys(project, 'death', 'head', [[0, {}], [1, { rotationX: -55, rotationY: 30 }]])
  keys(project, 'death', 'right-hand', [[0, {}], [1, { rotationZ: 83, dz: -42 }]])

  keys(project, 'move', 'root', [[0, {}], [.25, { dx: -10, dy: -8, dz: -18 }], [.5, { dx: -20, dz: -35 }], [.75, { dx: -10, dy: -8, dz: -18 }], [1, {}]])
  keys(project, 'move', 'left-hip', [[0, {}], [.25, { rotationZ: 19, dz: -22 }], [.75, { rotationZ: -12, dz: 12 }], [1, {}]])
  keys(project, 'move', 'right-hip', [[0, {}], [.25, { rotationZ: -12, dz: 12 }], [.75, { rotationZ: 19, dz: -22 }], [1, {}]])
  keys(project, 'move', 'right-hand', [[0, {}], [.5, { rotationZ: -15 }], [1, {}]])
  return project
}

function tideSpider() {
  const project = newProject('\u6f6e\u773c\u86db\u6bcd')
  joint(project, 'root', '\u8179\u90e8', 0, 7, 0, null, -30)
  joint(project, 'head', '\u591a\u773c\u989d', -13, -31, -72, 'root')
  joint(project, 'abdomen', '\u540e\u8179', 18, 9, 85, 'root')
  part(project, 'body', '\u7532\u58f3', 'ellipse', 'root', 118, 88, '#334e58', { z: -5, layer: 2 })
  part(project, 'head-shell', '\u5934\u7532', 'ellipse', 'head', 89, 66, '#51717a', { z: -12, layer: 5 })
  part(project, 'abdomen-shell', '\u7f1d\u5408\u8179', 'ellipse', 'abdomen', 115, 100, '#2b3d50', { layer: 1 })
  part(project, 'abdomen-mark', '\u80ce\u773c', 'diamond', 'abdomen', 53, 58, '#879b91', { z: -14, layer: 3 })
  for (let eye = 0; eye < 3; eye += 1) {
    part(project, `eye-${eye}`, '\u6f6e\u773c', 'circle', 'head', 14 + eye * 3, 14 + eye * 3, '#c5a777', { x: -29 + eye * 26, y: -8 + (eye % 2) * 12, z: -23, layer: 7 })
  }
  for (const side of [-1, 1]) {
    for (let index = 0; index < 3; index += 1) {
      const sideName = side < 0 ? 'left' : 'right'
      const id = `${sideName}-${index}`
      const depth = (index - 1) * 66
      joint(project, `${id}-base`, '\u8db3\u6839', side * 48, -16 + index * 18, depth, 'root')
      joint(project, `${id}-knee`, '\u8db3\u819d', side * (55 + index * 8), -49 + index * 5, side * 5 - 11, `${id}-base`)
      joint(project, `${id}-tip`, '\u9488\u8db3', side * (26 + index * 4), 107 + index * 7, -13 - index * 9, `${id}-knee`)
      part(project, `${id}-upper`, '\u8db3\u7532', 'capsule', `bone-${id}-base-${id}-knee`, 79 + index * 10, 15, '#728b88', { bone: true, layer: 3 + index })
      part(project, `${id}-lower`, '\u9488\u80eb', 'capsule', `bone-${id}-knee-${id}-tip`, 112 + index * 8, 11, '#9aa69b', { bone: true, layer: 4 + index })
    }
  }

  keys(project, 'idle', 'root', [[0, {}], [.5, { dy: -6, dz: -9, rotationY: -5 }], [1, {}]])
  keys(project, 'idle', 'abdomen', [[0, {}], [.5, { scaleX: 1.08, scaleY: 1.07, dz: 11, rotationX: 6 }], [1, {}]])
  keys(project, 'idle', 'left-0-knee', [[0, {}], [.5, { rotationX: 11, dz: -13 }], [1, {}]])
  keys(project, 'idle', 'right-1-knee', [[0, {}], [.5, { rotationX: -9, dz: 12 }], [1, {}]])

  keys(project, 'attack', 'root', [[0, {}], [.25, { dy: 14, dz: 20 }], [.68, { dx: -31, dy: -10, dz: -88, rotationY: 14 }], [1, { dx: -12, dz: -31 }]])
  keys(project, 'attack', 'head', [[0, {}], [.68, { rotationX: -26, dz: -27 }], [1, {}]])
  keys(project, 'attack', 'left-0-knee', [[0, {}], [.32, { rotationX: 35, rotationZ: -18 }], [.68, { rotationX: -45, dz: -48, rotationZ: 16 }], [1, {}]])
  keys(project, 'attack', 'right-0-knee', [[0, {}], [.32, { rotationX: 35, rotationZ: 18 }], [.68, { rotationX: -45, dz: -48, rotationZ: -16 }], [1, {}]])

  keys(project, 'hit', 'root', [[0, {}], [.32, { dx: 17, dz: 41, rotationX: 14, rotationY: -12 }], [1, {}]])
  keys(project, 'hit', 'abdomen', [[0, {}], [.3, { rotationZ: 17, dz: 24 }], [1, {}]])
  keys(project, 'hit', 'head', [[0, {}], [.32, { rotationZ: -19 }], [1, {}]])

  keys(project, 'death', 'root', [[0, {}], [.38, { dy: 17, rotationX: -21 }], [1, { dy: 101, dz: 44, rotationX: -67, rotationZ: 25 }]])
  keys(project, 'death', 'abdomen', [[0, {}], [1, { rotationX: 42, dz: 33, scaleY: .7 }]])
  for (const side of ['left', 'right']) {
    for (let index = 0; index < 3; index += 1) {
      keys(project, 'death', `${side}-${index}-knee`, [[0, {}], [1, { rotationZ: side === 'left' ? 42 : -42, rotationX: index % 2 ? 31 : -31 }]])
      keys(project, 'move', `${side}-${index}-knee`, [[0, {}], [.25, { rotationX: (index + (side === 'left' ? 0 : 1)) % 2 ? 20 : -20, dz: -12 }], [.75, { rotationX: (index + (side === 'left' ? 0 : 1)) % 2 ? -20 : 20, dz: 12 }], [1, {}]])
    }
  }
  keys(project, 'move', 'root', [[0, {}], [.25, { dx: -10, dz: -18, dy: -5 }], [.5, { dx: -20, dz: -36 }], [.75, { dx: -10, dz: -18, dy: -5 }], [1, {}]])
  keys(project, 'move', 'abdomen', [[0, {}], [.5, { rotationY: 10, dz: 16 }], [1, {}]])
  return project
}

function lanternMoth() {
  const project = newProject('\u7f1d\u8179\u706f\u86fe')
  project.stage.floorOffset = 44
  joint(project, 'root', '\u80f8\u8282', 0, 0, 0, null, -30)
  joint(project, 'head', '\u706f\u5934', -8, -69, -42, 'root')
  joint(project, 'left-wing', '\u5de6\u7fc5\u67a2', -41, -38, -13, 'root')
  joint(project, 'right-wing', '\u53f3\u7fc5\u67a2', 42, -36, 17, 'root')
  joint(project, 'tail', '\u8179\u8282', 5, 61, 37, 'root')
  joint(project, 'tail-tip', '\u5c3e\u706f', 4, 60, 30, 'tail')
  joint(project, 'left-feeler', '\u5de6\u89e6\u987b', -22, -23, -18, 'head')
  joint(project, 'right-feeler', '\u53f3\u89e6\u987b', 19, -24, -13, 'head')
  part(project, 'thorax', '\u7f1d\u5408\u80f8', 'capsule', 'root', 71, 116, '#5f565e', { layer: 4 })
  part(project, 'head-lamp', '\u706f\u7b3c\u5934', 'ellipse', 'head', 72, 64, '#bd9c67', { z: -12, layer: 7 })
  part(project, 'eye', '\u706f\u82af', 'diamond', 'head', 31, 39, '#f1c883', { x: -13, z: -19, layer: 8, textureId: 'moth-eye' })
  part(project, 'left-wing-membrane', '\u5de6\u88c2\u7fc5', 'triangle', 'left-wing', 135, 126, '#647e78', { x: -61, y: -24, z: 5, rotationZ: -28, rotationY: -12, layer: 2 })
  part(project, 'right-wing-membrane', '\u53f3\u88c2\u7fc5', 'triangle', 'right-wing', 138, 128, '#7b817b', { x: 62, y: -22, z: 14, rotationZ: 29, rotationY: 18, layer: 3 })
  part(project, 'left-wing-eye', '\u5de6\u7fc5\u773c', 'circle', 'left-wing', 39, 39, '#a88a6e', { x: -75, y: -28, z: -5, layer: 5 })
  part(project, 'right-wing-eye', '\u53f3\u7fc5\u773c', 'circle', 'right-wing', 38, 38, '#b69b74', { x: 75, y: -29, z: 2, layer: 6 })
  part(project, 'abdomen', '\u957f\u8179', 'ellipse', 'tail', 52, 98, '#454955', { y: 16, layer: 3 })
  part(project, 'tail-glow', '\u5c3e\u706b', 'diamond', 'tail-tip', 40, 57, '#d1a76d', { z: -13, layer: 7 })
  part(project, 'left-antenna', '\u5de6\u89e6\u987b', 'capsule', 'bone-head-left-feeler', 34, 8, '#c0aa8b', { bone: true, layer: 8 })
  part(project, 'right-antenna', '\u53f3\u89e6\u987b', 'capsule', 'bone-head-right-feeler', 34, 8, '#c0aa8b', { bone: true, layer: 8 })

  keys(project, 'idle', 'root', [[0, {}], [.5, { dy: -13, dz: -14, rotationY: -5 }], [1, {}]])
  keys(project, 'idle', 'left-wing', [[0, { rotationX: -17, rotationY: -14 }], [.5, { rotationX: 33, rotationY: 29, rotationZ: -11 }], [1, { rotationX: -17, rotationY: -14 }]])
  keys(project, 'idle', 'right-wing', [[0, { rotationX: 17, rotationY: 14 }], [.5, { rotationX: -33, rotationY: -29, rotationZ: 11 }], [1, { rotationX: 17, rotationY: 14 }]])
  keys(project, 'idle', 'tail', [[0, {}], [.5, { rotationX: 12, dz: 11 }], [1, {}]])

  keys(project, 'attack', 'root', [[0, {}], [.28, { dy: -48, dz: 27, rotationX: -13 }], [.75, { dx: -44, dy: 24, dz: -102, rotationX: 29, rotationY: 17 }], [1, { dx: -13, dz: -28 }]])
  keys(project, 'attack', 'left-wing', [[0, {}], [.28, { rotationY: 68, rotationX: -35 }], [.75, { rotationY: -52, rotationZ: 35 }], [1, {}]])
  keys(project, 'attack', 'right-wing', [[0, {}], [.28, { rotationY: -68, rotationX: 35 }], [.75, { rotationY: 52, rotationZ: -35 }], [1, {}]])
  keys(project, 'attack', 'head', [[0, {}], [.75, { dz: -30, rotationX: 25 }], [1, {}]])

  keys(project, 'hit', 'root', [[0, {}], [.35, { dx: 25, dz: 35, rotationZ: 22, rotationX: -14 }], [1, {}]])
  keys(project, 'hit', 'left-wing', [[0, {}], [.35, { rotationZ: 48, rotationY: 38 }], [1, {}]])
  keys(project, 'hit', 'right-wing', [[0, {}], [.35, { rotationZ: -36, rotationY: -34 }], [1, {}]])

  keys(project, 'death', 'root', [[0, {}], [.3, { dy: -33, rotationZ: -15 }], [1, { dy: 172, dz: 50, rotationZ: 115, rotationX: 48 }]])
  keys(project, 'death', 'left-wing', [[0, {}], [1, { rotationX: 74, rotationZ: 62 }]])
  keys(project, 'death', 'right-wing', [[0, {}], [1, { rotationX: -74, rotationZ: -62 }]])
  keys(project, 'death', 'tail-tip', [[0, {}], [1, { scaleX: .25, scaleY: .25, opacity: .2 }]])

  keys(project, 'move', 'root', [[0, {}], [.25, { dx: -12, dy: -14, dz: -18 }], [.5, { dx: -24, dz: -42, rotationY: 7 }], [.75, { dx: -12, dy: -13, dz: -20 }], [1, {}]])
  keys(project, 'move', 'left-wing', [[0, { rotationY: -19 }], [.25, { rotationY: 55, rotationX: 24 }], [.5, { rotationY: -19 }], [.75, { rotationY: 55, rotationX: 24 }], [1, { rotationY: -19 }]])
  keys(project, 'move', 'right-wing', [[0, { rotationY: 19 }], [.25, { rotationY: -55, rotationX: -24 }], [.5, { rotationY: 19 }], [.75, { rotationY: -55, rotationX: -24 }], [1, { rotationY: 19 }]])
  keys(project, 'move', 'tail', [[0, {}], [.5, { rotationZ: 12, dz: 18 }], [1, {}]])
  return project
}

export function createShadowExampleProjects() {
  return [bellPilgrim(), tideSpider(), lanternMoth()].map(reflectShadowProjectZ)
}

export function installInitialShadowExamples(roster) {
  if (roster.examplePackVersion >= SHADOW_EXAMPLE_PACK_VERSION) return false
  const wasEmpty = roster.characters.every(({ project }) => !project.joints.length && !project.parts.length && !Object.values(project.animations).some(({ tracks }) => Object.keys(tracks).length))
  const examples = createShadowExampleProjects().map((project) => createShadowCharacter(project))
  roster.characters.push(...examples)
  if (wasEmpty) roster.activeCharacterId = examples[0].id
  roster.examplePackVersion = SHADOW_EXAMPLE_PACK_VERSION
  return true
}

function exampleIndex(project) {
  if (!project.joints.some((entry) => entry.id === 'root')) return -1
  if (project.joints.some((entry) => entry.id === 'jaw' && entry.name === '\u88c2\u989a')) return 0
  if (project.joints.some((entry) => entry.id === 'left-2-knee')) return 1
  if (project.joints.some((entry) => entry.id === 'tail-tip' && entry.name === '\u5c3e\u706f')) return 2
  return -1
}

export function texturePresetsForShadowProject(project) {
  const prefix = ['bell-pilgrim-', 'tide-spider-', 'lantern-moth-'][exampleIndex(project)]
  if (!prefix) return SHADOW_TEXTURE_PRESETS
  return SHADOW_TEXTURE_PRESETS.filter((preset) => preset.url.startsWith(`/assets/enemies/${prefix}`))
}

function matchingExample(project, templates) {
  return templates[exampleIndex(project)] || null
}

export function repairInitialShadowExamples(roster) {
  if (roster.examplePackVersion < SHADOW_EXAMPLE_PACK_VERSION || roster.examplePackVersion >= SHADOW_EXAMPLE_REPAIR_VERSION) return false
  const templates = createShadowExampleProjects()
  const restoreMissingParts = roster.examplePackVersion < 2
  for (const { project } of roster.characters) {
    const template = matchingExample(project, templates)
    if (!template) continue
    if (restoreMissingParts) {
      const existing = new Set(project.parts.map((entry) => entry.id))
      const jointIds = new Set(project.joints.map((entry) => entry.id))
      const boneIds = new Set(project.bones.map((entry) => entry.id))
      for (const entry of template.parts) {
        if (existing.has(entry.id)) continue
        const targets = entry.attachment.type === 'bone' ? boneIds : jointIds
        if (targets.has(entry.attachment.targetId)) project.parts.push(JSON.parse(JSON.stringify(entry)))
      }
      if (template.stage.floorOffset !== 8 && project.stage.floorOffset === 8) project.stage.floorOffset = template.stage.floorOffset
    }
    const root = project.joints.find((entry) => entry.id === 'root')
    if (root && (root.rotationY === 45 || (restoreMissingParts && root.rotationY === -45))) root.rotationY = 30
    for (const entry of project.parts) {
      const source = template.parts.find((part) => part.id === entry.id)
      if (source?.visual.type === 'texture' && entry.visual.type === 'shape' && !entry.visual.texture && entry.shape === source.shape && entry.fill === source.fill && entry.stroke === source.stroke) {
        entry.visual = { ...source.visual }
      } else if (source?.visual.type === 'texture' && entry.visual.texture === LEGACY_WING_URL && (entry.id === 'left-wing-membrane' || entry.id === 'right-wing-membrane')) {
        entry.visual = { ...entry.visual, texture: source.visual.texture }
      } else if (source?.visual.type === 'texture' && entry.id === 'mouth' && entry.visual.texture === LEGACY_PILGRIM_MOUTH_URL) {
        entry.visual = { ...entry.visual, texture: source.visual.texture }
      }
    }
  }
  roster.examplePackVersion = SHADOW_EXAMPLE_REPAIR_VERSION
  return true
}
