export const SHADOW_PUPPET_STORAGE_KEY = 'thetower-shadow-puppet-project-v1'

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

export const SHADOW_PUPPET_PRESETS = Object.freeze([
  { id: 'gnawer', name: '\u7329\u9b3c', description: '\u7c97\u58ee\u4eba\u5f62\u3001\u72ec\u773c\u4e0e\u6447\u6446\u53cc\u81c2' },
  { id: 'emberwing-moth', name: '\u70ec\u7fc5\u86fe', description: '\u56db\u7247\u7070\u70ec\u7fc5\u819c\u4e0e\u7206\u71c3\u5c3e\u706b' },
  { id: 'nest-spider', name: '\u4f0f\u5de2\u8718\u86db', description: '\u516b\u8db3\u4f0f\u5730\u3001\u9f13\u80c0\u8179\u56ca\u4e0e\u7a81\u523a\u653b\u51fb' },
  { id: 'shellguard', name: '\u91cd\u7532\u536b\u58eb', description: '\u5206\u5c42\u7532\u7247\u3001\u957f\u76fe\u548c\u52a8\u4f5c\u6c89\u91cd\u7684\u5b88\u536b' },
  { id: 'whirlpool-eye-sac', name: '\u6da1\u773c\u6d6e\u56ca', description: '\u6f02\u6d6e\u773c\u56ca\u3001\u6c34\u73af\u548c\u7275\u5f15\u89e6\u624b' },
])

const DEFAULT_POSE = Object.freeze({
  dx: 0,
  dy: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
})

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function part({
  id,
  name,
  shape,
  parentId = null,
  x = 0,
  y = 0,
  width = 80,
  height = 80,
  rotation = 0,
  pivotX = 0.5,
  pivotY = 0.5,
  fill = '#231715',
  stroke = '#a94735',
  z = 0,
}) {
  return {
    id,
    name,
    shape,
    parentId,
    x,
    y,
    width,
    height,
    rotation,
    pivotX,
    pivotY,
    fill,
    stroke,
    opacity: 1,
    texture: null,
    textureFit: 'contain',
    z,
  }
}

function key(time, values = {}) {
  return { time, ...DEFAULT_POSE, ...values }
}

function animation(type, tracks = {}) {
  return {
    id: type.id,
    name: type.label,
    duration: type.duration,
    loop: type.loop,
    tracks,
  }
}

export function createDefaultShadowProject() {
  const types = Object.fromEntries(SHADOW_ANIMATION_TYPES.map((entry) => [entry.id, entry]))
  return {
    version: 1,
    presetId: 'gnawer',
    name: '\u7329\u9b3c\u00b7\u76ae\u5f71',
    stage: { width: 600, height: 600 },
    parts: [
      part({ id: 'body', name: '\u8eaf\u5e72', shape: 'triangle', width: 150, height: 205, fill: '#2a1816', stroke: '#b64c38', z: 3 }),
      part({ id: 'head', name: '\u5934\u90e8', shape: 'circle', parentId: 'body', y: -126, width: 104, height: 104, fill: '#31201b', stroke: '#c15b43', z: 8 }),
      part({ id: 'left-arm', name: '\u5de6\u81c2', shape: 'capsule', parentId: 'body', x: -62, y: -55, width: 30, height: 132, rotation: 18, pivotX: 0.5, pivotY: 0.08, fill: '#251713', stroke: '#9f3f32', z: 2 }),
      part({ id: 'right-arm', name: '\u53f3\u81c2', shape: 'capsule', parentId: 'body', x: 62, y: -55, width: 30, height: 132, rotation: -18, pivotX: 0.5, pivotY: 0.08, fill: '#251713', stroke: '#9f3f32', z: 4 }),
      part({ id: 'left-leg', name: '\u5de6\u817f', shape: 'rect', parentId: 'body', x: -38, y: 80, width: 42, height: 145, rotation: 4, pivotX: 0.5, pivotY: 0.08, fill: '#211412', stroke: '#8f392f', z: 1 }),
      part({ id: 'right-leg', name: '\u53f3\u817f', shape: 'rect', parentId: 'body', x: 38, y: 80, width: 42, height: 145, rotation: -4, pivotX: 0.5, pivotY: 0.08, fill: '#211412', stroke: '#8f392f', z: 1 }),
      part({ id: 'eye', name: '\u72ec\u773c', shape: 'ellipse', parentId: 'head', y: -2, width: 52, height: 20, fill: '#c03d2d', stroke: '#e9b36b', z: 10 }),
    ],
    animations: {
      idle: animation(types.idle, {
        body: [key(0, { dy: 0 }), key(700, { dy: -7, scaleY: 1.025 }), key(1400, { dy: 0 })],
        head: [key(0, { rotation: -2 }), key(700, { rotation: 3 }), key(1400, { rotation: -2 })],
        'left-arm': [key(0, { rotation: -3 }), key(700, { rotation: 4 }), key(1400, { rotation: -3 })],
        'right-arm': [key(0, { rotation: 3 }), key(700, { rotation: -4 }), key(1400, { rotation: 3 })],
      }),
      attack: animation(types.attack, {
        body: [key(0), key(180, { dy: -8, rotation: -5 }), key(330, { dx: 28, rotation: 8, scaleX: 1.08 }), key(500)],
        'left-arm': [key(0), key(180, { rotation: -78 }), key(330, { rotation: 35 }), key(500)],
        'right-arm': [key(0), key(180, { rotation: 82 }), key(330, { rotation: -42 }), key(500)],
      }),
      hit: animation(types.hit, {
        body: [key(0), key(90, { dx: -24, rotation: -11, scaleY: 0.94 }), key(220, { dx: 8, rotation: 5 }), key(380)],
        head: [key(0), key(90, { rotation: -18, scaleX: 1.08 }), key(380)],
      }),
      death: animation(types.death, {
        body: [key(0), key(360, { dy: 34, rotation: 38, scaleY: 0.92 }), key(800, { dx: 72, dy: 122, rotation: 88, scaleY: 0.78, opacity: 0.18 })],
        head: [key(0), key(420, { dx: 25, dy: 20, rotation: 44 }), key(800, { dx: 68, dy: 70, rotation: 120, opacity: 0.1 })],
        'left-arm': [key(0), key(800, { rotation: -65, opacity: 0.25 })],
        'right-arm': [key(0), key(800, { rotation: 70, opacity: 0.25 })],
      }),
      move: animation(types.move, {
        body: [key(0, { dy: 0 }), key(175, { dy: -8 }), key(350, { dy: 0 }), key(525, { dy: -8 }), key(700, { dy: 0 })],
        'left-leg': [key(0, { rotation: -18 }), key(350, { rotation: 18 }), key(700, { rotation: -18 })],
        'right-leg': [key(0, { rotation: 18 }), key(350, { rotation: -18 }), key(700, { rotation: 18 })],
        'left-arm': [key(0, { rotation: 14 }), key(350, { rotation: -14 }), key(700, { rotation: 14 })],
        'right-arm': [key(0, { rotation: -14 }), key(350, { rotation: 14 }), key(700, { rotation: -14 })],
      }),
    },
  }
}

function projectWithAnimations(name, parts, tracks) {
  const types = Object.fromEntries(SHADOW_ANIMATION_TYPES.map((entry) => [entry.id, entry]))
  return {
    version: 1,
    name,
    stage: { width: 600, height: 600 },
    parts,
    animations: Object.fromEntries(SHADOW_ANIMATION_TYPES.map((type) => [
      type.id,
      animation(types[type.id], tracks[type.id] || {}),
    ])),
  }
}

function createEmberwingMothProject() {
  const parts = [
    part({ id: 'body', name: '\u86fe\u8eab', shape: 'ellipse', width: 72, height: 178, fill: '#2b1714', stroke: '#d26042', z: 5 }),
    part({ id: 'head', name: '\u86fe\u9996', shape: 'circle', parentId: 'body', y: -102, width: 72, height: 72, fill: '#351a16', stroke: '#e0774d', z: 8 }),
    part({ id: 'eye', name: '\u70ec\u773c', shape: 'ellipse', parentId: 'head', y: -2, width: 42, height: 16, fill: '#e65b31', stroke: '#ffd08a', z: 10 }),
    part({ id: 'left-wing-upper', name: '\u5de6\u4e0a\u7fc5', shape: 'diamond', parentId: 'body', x: -22, y: -58, width: 138, height: 184, rotation: -18, pivotX: 1, pivotY: 0.25, fill: '#4b2922', stroke: '#d67b4f', z: 2 }),
    part({ id: 'right-wing-upper', name: '\u53f3\u4e0a\u7fc5', shape: 'diamond', parentId: 'body', x: 22, y: -58, width: 138, height: 184, rotation: 18, pivotX: 0, pivotY: 0.25, fill: '#4b2922', stroke: '#d67b4f', z: 2 }),
    part({ id: 'left-wing-lower', name: '\u5de6\u4e0b\u7fc5', shape: 'triangle', parentId: 'body', x: -25, y: 5, width: 112, height: 142, rotation: 20, pivotX: 1, pivotY: 0.1, fill: '#38201c', stroke: '#aa4938', z: 1 }),
    part({ id: 'right-wing-lower', name: '\u53f3\u4e0b\u7fc5', shape: 'triangle', parentId: 'body', x: 25, y: 5, width: 112, height: 142, rotation: -20, pivotX: 0, pivotY: 0.1, fill: '#38201c', stroke: '#aa4938', z: 1 }),
    part({ id: 'left-antenna', name: '\u5de6\u89e6\u987b', shape: 'capsule', parentId: 'head', x: -18, y: -30, width: 12, height: 78, rotation: -24, pivotX: 0.5, pivotY: 1, fill: '#261512', stroke: '#b34b36', z: 7 }),
    part({ id: 'right-antenna', name: '\u53f3\u89e6\u987b', shape: 'capsule', parentId: 'head', x: 18, y: -30, width: 12, height: 78, rotation: 24, pivotX: 0.5, pivotY: 1, fill: '#261512', stroke: '#b34b36', z: 7 }),
    part({ id: 'ember', name: '\u5c3e\u70ec', shape: 'circle', parentId: 'body', y: 82, width: 42, height: 42, fill: '#e94f2d', stroke: '#ffd279', z: 7 }),
  ]
  const wingIds = ['left-wing-upper', 'right-wing-upper', 'left-wing-lower', 'right-wing-lower']
  const idle = {
    body: [key(0, { dy: 0 }), key(700, { dy: -14 }), key(1400, { dy: 0 })],
    ember: [key(0, { scaleX: .8, scaleY: .8 }), key(700, { scaleX: 1.25, scaleY: 1.25 }), key(1400, { scaleX: .8, scaleY: .8 })],
  }
  const move = { body: [key(0), key(175, { dy: -18 }), key(350), key(525, { dy: -18 }), key(700)] }
  wingIds.forEach((id, index) => {
    const sign = id.startsWith('left') ? -1 : 1
    idle[id] = [key(0, { rotation: sign * 5 }), key(700, { rotation: sign * 15 }), key(1400, { rotation: sign * 5 })]
    move[id] = [key(0, { rotation: sign * 6, scaleX: .75 }), key(175, { rotation: -sign * 34, scaleX: 1.2 }), key(350, { rotation: sign * 6, scaleX: .75 }), key(525, { rotation: -sign * 34, scaleX: 1.2 }), key(700, { rotation: sign * 6, scaleX: .75 })]
    if (index > 1) move[id].forEach((entry) => { entry.rotation *= .7 })
  })
  return projectWithAnimations('\u70ec\u7fc5\u86fe\u00b7\u76ae\u5f71', parts, {
    idle,
    move,
    attack: {
      body: [key(0), key(160, { dy: -26, scaleY: .9 }), key(330, { dy: 8, scaleX: 1.22 }), key(500)],
      'left-wing-upper': [key(0), key(160, { rotation: 62 }), key(330, { rotation: -35 }), key(500)],
      'right-wing-upper': [key(0), key(160, { rotation: -62 }), key(330, { rotation: 35 }), key(500)],
      ember: [key(0), key(330, { scaleX: 1.8, scaleY: 1.8 }), key(500)],
    },
    hit: { body: [key(0), key(90, { dx: -28, rotation: -16, scaleX: .82 }), key(220, { dx: 12, rotation: 8 }), key(380)] },
    death: {
      body: [key(0), key(800, { dy: 135, rotation: 145, scaleX: .6, scaleY: .6, opacity: .12 })],
      'left-wing-upper': [key(0), key(800, { rotation: 120, opacity: .08 })],
      'right-wing-upper': [key(0), key(800, { rotation: -120, opacity: .08 })],
      ember: [key(0), key(380, { scaleX: 2.3, scaleY: 2.3 }), key(800, { scaleX: .1, scaleY: .1, opacity: 0 })],
    },
  })
}

function createNestSpiderProject() {
  const parts = [
    part({ id: 'abdomen', name: '\u8179\u56ca', shape: 'ellipse', y: 35, width: 175, height: 150, fill: '#252116', stroke: '#8b8a3d', z: 4 }),
    part({ id: 'thorax', name: '\u80f8\u7532', shape: 'circle', parentId: 'abdomen', y: -82, width: 108, height: 94, fill: '#302a18', stroke: '#a49c47', z: 6 }),
    part({ id: 'fang', name: '\u5de2\u7259', shape: 'triangle', parentId: 'thorax', y: -56, width: 76, height: 62, pivotY: 0.15, fill: '#1f1b13', stroke: '#c0af58', z: 8 }),
    part({ id: 'egg-mark', name: '\u8179\u7eb9', shape: 'diamond', parentId: 'abdomen', y: 8, width: 74, height: 74, fill: '#77752c', stroke: '#d0c76b', z: 7 }),
  ]
  const legIds = []
  for (const side of [-1, 1]) {
    for (let index = 0; index < 4; index += 1) {
      const id = `${side < 0 ? 'left' : 'right'}-leg-${index + 1}`
      legIds.push(id)
      parts.push(part({
        id,
        name: `${side < 0 ? '\u5de6' : '\u53f3'}\u8db3 ${index + 1}`,
        shape: 'capsule',
        parentId: 'thorax',
        x: side * (32 + index * 4),
        y: -20 + index * 22,
        width: 17,
        height: 135 - index * 8,
        rotation: side * (-70 + index * 19),
        pivotX: 0.5,
        pivotY: 0.06,
        fill: '#211d14',
        stroke: '#817f36',
        z: index < 2 ? 3 : 5,
      }))
    }
  }
  const idle = { abdomen: [key(0, { scaleX: 1 }), key(700, { scaleX: 1.06, scaleY: 1.04 }), key(1400, { scaleX: 1 })] }
  const move = { abdomen: [key(0, { dy: 0 }), key(175, { dy: -5 }), key(350), key(525, { dy: -5 }), key(700)] }
  legIds.forEach((id, index) => {
    const phase = index % 2 === 0 ? 1 : -1
    idle[id] = [key(0, { rotation: phase * 2 }), key(700, { rotation: -phase * 3 }), key(1400, { rotation: phase * 2 })]
    move[id] = [key(0, { rotation: phase * 18 }), key(350, { rotation: -phase * 18 }), key(700, { rotation: phase * 18 })]
  })
  return projectWithAnimations('\u4f0f\u5de2\u8718\u86db\u00b7\u76ae\u5f71', parts, {
    idle,
    move,
    attack: {
      abdomen: [key(0), key(180, { dy: 18, scaleY: .8 }), key(330, { dy: -42, scaleY: 1.15 }), key(500)],
      thorax: [key(0), key(180, { rotation: -7 }), key(330, { dy: -24, scaleX: 1.18 }), key(500)],
      fang: [key(0), key(330, { scaleX: 1.45, scaleY: 1.5 }), key(500)],
    },
    hit: { abdomen: [key(0), key(80, { scaleX: 1.2, scaleY: .65, dx: -18 }), key(210, { dx: 9 }), key(380)] },
    death: Object.fromEntries([
      ['abdomen', [key(0), key(800, { dy: 105, scaleX: 1.35, scaleY: .2, opacity: .2 })]],
      ...legIds.map((id, index) => [id, [key(0), key(800, { rotation: (index % 2 ? 1 : -1) * 95, opacity: .18 })]]),
    ]),
  })
}

function createShellguardProject() {
  const parts = [
    part({ id: 'body', name: '\u536b\u58eb\u8eaf\u5e72', shape: 'triangle', width: 168, height: 215, fill: '#292619', stroke: '#a89b4d', z: 4 }),
    part({ id: 'chest-plate', name: '\u91cd\u80f8\u7532', shape: 'diamond', parentId: 'body', y: -18, width: 142, height: 150, fill: '#4c4729', stroke: '#d0bc60', z: 7 }),
    part({ id: 'head', name: '\u9762\u7532', shape: 'circle', parentId: 'body', y: -126, width: 94, height: 94, fill: '#39351f', stroke: '#c8b45c', z: 8 }),
    part({ id: 'visor', name: '\u9762\u7532\u7f1d', shape: 'rect', parentId: 'head', y: -2, width: 66, height: 13, fill: '#12110d', stroke: '#746d38', z: 10 }),
    part({ id: 'left-arm', name: '\u6301\u76fe\u81c2', shape: 'capsule', parentId: 'body', x: -70, y: -48, width: 34, height: 132, rotation: 9, pivotX: .5, pivotY: .08, fill: '#2e2a1b', stroke: '#9a8d47', z: 3 }),
    part({ id: 'shield', name: '\u957f\u76fe', shape: 'ellipse', parentId: 'left-arm', y: 86, width: 92, height: 164, rotation: -8, pivotX: .5, pivotY: .5, fill: '#494326', stroke: '#d1bc5d', z: 9 }),
    part({ id: 'right-arm', name: '\u6267\u5203\u81c2', shape: 'capsule', parentId: 'body', x: 68, y: -50, width: 33, height: 126, rotation: -20, pivotX: .5, pivotY: .08, fill: '#2e2a1b', stroke: '#9a8d47', z: 5 }),
    part({ id: 'blade', name: '\u949d\u5203', shape: 'triangle', parentId: 'right-arm', y: 115, width: 50, height: 142, rotation: 180, pivotX: .5, pivotY: .12, fill: '#666044', stroke: '#d9c67a', z: 8 }),
    part({ id: 'left-leg', name: '\u5de6\u817f', shape: 'rect', parentId: 'body', x: -40, y: 84, width: 49, height: 142, pivotX: .5, pivotY: .08, fill: '#282518', stroke: '#877d42', z: 2 }),
    part({ id: 'right-leg', name: '\u53f3\u817f', shape: 'rect', parentId: 'body', x: 40, y: 84, width: 49, height: 142, pivotX: .5, pivotY: .08, fill: '#282518', stroke: '#877d42', z: 2 }),
  ]
  return projectWithAnimations('\u91cd\u7532\u536b\u58eb\u00b7\u76ae\u5f71', parts, {
    idle: {
      body: [key(0), key(700, { dy: -3, scaleY: 1.015 }), key(1400)],
      shield: [key(0, { rotation: -2 }), key(700, { rotation: 2 }), key(1400, { rotation: -2 })],
    },
    attack: {
      body: [key(0), key(170, { dx: -10, rotation: -5 }), key(340, { dx: 22, rotation: 9 }), key(500)],
      'right-arm': [key(0), key(170, { rotation: -108 }), key(340, { rotation: 72 }), key(500)],
      blade: [key(0), key(170, { rotation: -20 }), key(340, { rotation: 25 }), key(500)],
      'left-arm': [key(0), key(340, { rotation: -18 }), key(500)],
    },
    hit: {
      body: [key(0), key(90, { dx: -10, scaleX: .96 }), key(210, { dx: 4 }), key(380)],
      shield: [key(0), key(90, { scaleX: 1.12, scaleY: 1.04 }), key(380)],
    },
    death: {
      body: [key(0), key(430, { dy: 38, rotation: 24 }), key(800, { dx: 86, dy: 132, rotation: 86, opacity: .16 })],
      shield: [key(0), key(800, { dx: -58, dy: 70, rotation: -110, opacity: .22 })],
      blade: [key(0), key(800, { dx: 70, dy: 50, rotation: 160, opacity: .18 })],
    },
    move: {
      body: [key(0), key(175, { dy: -5 }), key(350), key(525, { dy: -5 }), key(700)],
      'left-leg': [key(0, { rotation: -8 }), key(350, { rotation: 8 }), key(700, { rotation: -8 })],
      'right-leg': [key(0, { rotation: 8 }), key(350, { rotation: -8 }), key(700, { rotation: 8 })],
      shield: [key(0, { rotation: -3 }), key(350, { rotation: 3 }), key(700, { rotation: -3 })],
    },
  })
}

function createWhirlpoolEyeSacProject() {
  const parts = [
    part({ id: 'sac', name: '\u6f02\u6d6e\u56ca', shape: 'circle', width: 210, height: 196, fill: '#18303a', stroke: '#4da0ad', z: 4 }),
    part({ id: 'outer-ring', name: '\u6da1\u6d41\u5916\u73af', shape: 'diamond', parentId: 'sac', width: 174, height: 174, rotation: 45, fill: '#234853', stroke: '#68bfca', z: 6 }),
    part({ id: 'eye', name: '\u6da1\u773c', shape: 'ellipse', parentId: 'sac', width: 120, height: 68, fill: '#c0c1a3', stroke: '#66cad1', z: 8 }),
    part({ id: 'iris', name: '\u6c34\u77b3', shape: 'circle', parentId: 'eye', width: 42, height: 42, fill: '#102d39', stroke: '#8ce2df', z: 10 }),
    part({ id: 'pupil', name: '\u9ed1\u77b3', shape: 'ellipse', parentId: 'iris', width: 13, height: 38, fill: '#05090c', stroke: '#51a9b6', z: 11 }),
  ]
  const tentacleIds = []
  for (let index = 0; index < 5; index += 1) {
    const id = `tentacle-${index + 1}`
    tentacleIds.push(id)
    parts.push(part({
      id,
      name: `\u89e6\u624b ${index + 1}`,
      shape: 'capsule',
      parentId: 'sac',
      x: (index - 2) * 34,
      y: 72 + Math.abs(index - 2) * 5,
      width: 19,
      height: 126 - Math.abs(index - 2) * 12,
      rotation: (index - 2) * -13,
      pivotX: .5,
      pivotY: .06,
      fill: '#17343e',
      stroke: '#438d9c',
      z: 2,
    }))
  }
  const idle = {
    sac: [key(0, { dy: 4 }), key(700, { dy: -14, scaleX: 1.04, scaleY: .98 }), key(1400, { dy: 4 })],
    'outer-ring': [key(0, { rotation: 0 }), key(1400, { rotation: 22 })],
    pupil: [key(0, { dx: -12 }), key(700, { dx: 12 }), key(1400, { dx: -12 })],
  }
  const move = { sac: [key(0), key(175, { dx: 12, dy: -12, rotation: 4 }), key(350), key(525, { dx: -12, dy: -12, rotation: -4 }), key(700)] }
  tentacleIds.forEach((id, index) => {
    idle[id] = [key(0, { rotation: index % 2 ? -5 : 5 }), key(700, { rotation: index % 2 ? 7 : -7 }), key(1400, { rotation: index % 2 ? -5 : 5 })]
    move[id] = [key(0, { rotation: index % 2 ? -12 : 12 }), key(350, { rotation: index % 2 ? 12 : -12 }), key(700, { rotation: index % 2 ? -12 : 12 })]
  })
  return projectWithAnimations('\u6da1\u773c\u6d6e\u56ca\u00b7\u76ae\u5f71', parts, {
    idle,
    move,
    attack: {
      sac: [key(0), key(160, { scaleX: .8, scaleY: 1.12 }), key(340, { scaleX: 1.22, scaleY: .88 }), key(500)],
      'outer-ring': [key(0), key(340, { rotation: 72, scaleX: 1.25, scaleY: 1.25 }), key(500)],
      eye: [key(0), key(340, { scaleX: 1.4, scaleY: .72 }), key(500)],
      pupil: [key(0), key(340, { scaleX: .45, scaleY: 1.45 }), key(500)],
      ...Object.fromEntries(tentacleIds.map((id, index) => [id, [key(0), key(340, { rotation: (index - 2) * 24, scaleY: 1.35 }), key(500)]])),
    },
    hit: { sac: [key(0), key(80, { dx: -30, scaleX: 1.14, scaleY: .78 }), key(210, { dx: 10 }), key(380)] },
    death: {
      sac: [key(0), key(420, { scaleX: 1.35, scaleY: 1.35 }), key(800, { dy: 90, scaleX: .18, scaleY: .18, opacity: .05 })],
      'outer-ring': [key(0), key(800, { rotation: 180, scaleX: 2, scaleY: 2, opacity: 0 })],
      eye: [key(0), key(800, { scaleX: .1, opacity: 0 })],
    },
  })
}

export function createShadowPreset(presetId) {
  let project
  if (presetId === 'emberwing-moth') project = createEmberwingMothProject()
  else if (presetId === 'nest-spider') project = createNestSpiderProject()
  else if (presetId === 'shellguard') project = createShellguardProject()
  else if (presetId === 'whirlpool-eye-sac') project = createWhirlpoolEyeSacProject()
  else project = createDefaultShadowProject()
  project.presetId = SHADOW_PUPPET_PRESETS.some((entry) => entry.id === presetId) ? presetId : 'gnawer'
  return project
}

function finite(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function normalizePart(source, index) {
  const shapes = new Set(SHADOW_SHAPES.map((entry) => entry.id))
  return {
    id: String(source?.id || `part-${index + 1}`),
    name: String(source?.name || `Part ${index + 1}`),
    shape: shapes.has(source?.shape) ? source.shape : 'rect',
    parentId: source?.parentId ? String(source.parentId) : null,
    x: finite(source?.x, 0),
    y: finite(source?.y, 0),
    width: Math.max(4, finite(source?.width, 80)),
    height: Math.max(4, finite(source?.height, 80)),
    rotation: finite(source?.rotation, 0),
    pivotX: Math.min(1, Math.max(0, finite(source?.pivotX, 0.5))),
    pivotY: Math.min(1, Math.max(0, finite(source?.pivotY, 0.5))),
    fill: String(source?.fill || '#231715'),
    stroke: String(source?.stroke || '#a94735'),
    opacity: Math.min(1, Math.max(0, finite(source?.opacity, 1))),
    texture: typeof source?.texture === 'string' ? source.texture : null,
    textureFit: source?.textureFit === 'cover' ? 'cover' : 'contain',
    z: finite(source?.z, index),
  }
}

export function normalizeShadowProject(source) {
  const fallback = createDefaultShadowProject()
  const parts = Array.isArray(source?.parts) && source.parts.length
    ? source.parts.map(normalizePart)
    : fallback.parts
  const partIds = new Set(parts.map((entry) => entry.id))
  for (const entry of parts) {
    if (!partIds.has(entry.parentId) || entry.parentId === entry.id) entry.parentId = null
  }
  const animations = {}
  for (const type of SHADOW_ANIMATION_TYPES) {
    const current = source?.animations?.[type.id]
    const tracks = {}
    for (const [partId, keys] of Object.entries(current?.tracks || {})) {
      if (!partIds.has(partId) || !Array.isArray(keys)) continue
      tracks[partId] = keys.map((entry) => ({
        time: Math.max(0, finite(entry.time, 0)),
        dx: finite(entry.dx, 0),
        dy: finite(entry.dy, 0),
        rotation: finite(entry.rotation, 0),
        scaleX: finite(entry.scaleX, 1),
        scaleY: finite(entry.scaleY, 1),
        opacity: Math.min(1, Math.max(0, finite(entry.opacity, 1))),
      })).sort((a, b) => a.time - b.time)
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
    version: 1,
    presetId: typeof source?.presetId === 'string' ? source.presetId : null,
    name: String(source?.name || fallback.name),
    stage: {
      width: Math.max(200, finite(source?.stage?.width, 600)),
      height: Math.max(200, finite(source?.stage?.height, 600)),
    },
    parts,
    animations,
  }
}

export function loadShadowProject() {
  try {
    const stored = window.localStorage.getItem(SHADOW_PUPPET_STORAGE_KEY)
    return stored ? normalizeShadowProject(JSON.parse(stored)) : createDefaultShadowProject()
  } catch {
    return createDefaultShadowProject()
  }
}

export function saveShadowProject(project) {
  window.localStorage.setItem(SHADOW_PUPPET_STORAGE_KEY, JSON.stringify(normalizeShadowProject(project)))
}

export function resetShadowProject() {
  const project = createDefaultShadowProject()
  saveShadowProject(project)
  return project
}

export function defaultShadowPose() {
  return clone(DEFAULT_POSE)
}

function interpolateValue(a, b, ratio, keyName) {
  return a[keyName] + (b[keyName] - a[keyName]) * ratio
}

export function sampleShadowTrack(animationEntry, partId, time) {
  const keys = animationEntry?.tracks?.[partId]
  if (!keys?.length) return defaultShadowPose()
  const duration = Math.max(1, animationEntry.duration)
  const current = animationEntry.loop ? ((time % duration) + duration) % duration : Math.min(duration, Math.max(0, time))
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
    rotation: interpolateValue(left, right, ratio, 'rotation'),
    scaleX: interpolateValue(left, right, ratio, 'scaleX'),
    scaleY: interpolateValue(left, right, ratio, 'scaleY'),
    opacity: interpolateValue(left, right, ratio, 'opacity'),
  }
}

export function upsertShadowKeyframe(project, animationId, partId, time, pose) {
  const animationEntry = project.animations[animationId]
  if (!animationEntry) return
  const roundedTime = Math.max(0, Math.min(animationEntry.duration, Math.round(Number(time) || 0)))
  const keys = animationEntry.tracks[partId] || (animationEntry.tracks[partId] = [])
  const next = { time: roundedTime, ...DEFAULT_POSE, ...pose }
  const existing = keys.findIndex((entry) => Math.abs(entry.time - roundedTime) <= 1)
  if (existing >= 0) keys.splice(existing, 1, next)
  else keys.push(next)
  keys.sort((a, b) => a.time - b.time)
}

export function removeShadowKeyframe(project, animationId, partId, time, tolerance = 8) {
  const keys = project.animations[animationId]?.tracks?.[partId]
  if (!keys) return false
  const index = keys.findIndex((entry) => Math.abs(entry.time - time) <= tolerance)
  if (index < 0) return false
  keys.splice(index, 1)
  return true
}

export function multiplyShadowMatrices(left, right) {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  }
}

function localMatrix(entry, pose) {
  const radians = (entry.rotation + pose.rotation) * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const scaleX = pose.scaleX
  const scaleY = pose.scaleY
  return {
    a: cos * scaleX,
    b: sin * scaleX,
    c: -sin * scaleY,
    d: cos * scaleY,
    e: entry.x + pose.dx,
    f: entry.y + pose.dy,
  }
}

export function evaluateShadowProject(project, animationId = null, time = 0) {
  const animationEntry = animationId ? project.animations[animationId] : null
  const byId = new Map(project.parts.map((entry) => [entry.id, entry]))
  const cache = new Map()
  const resolving = new Set()
  const resolve = (entry) => {
    if (cache.has(entry.id)) return cache.get(entry.id)
    if (resolving.has(entry.id)) return { a: 1, b: 0, c: 0, d: 1, e: entry.x, f: entry.y }
    resolving.add(entry.id)
    const pose = animationEntry ? sampleShadowTrack(animationEntry, entry.id, time) : defaultShadowPose()
    const local = localMatrix(entry, pose)
    const parent = entry.parentId ? byId.get(entry.parentId) : null
    const matrix = parent ? multiplyShadowMatrices(resolve(parent), local) : local
    resolving.delete(entry.id)
    cache.set(entry.id, matrix)
    return matrix
  }
  return project.parts.map((entry, index) => {
    const pose = animationEntry ? sampleShadowTrack(animationEntry, entry.id, time) : defaultShadowPose()
    return { part: entry, pose, matrix: resolve(entry), order: index }
  }).sort((a, b) => a.part.z - b.part.z || a.order - b.order)
}

export function inverseShadowVector(matrix, dx, dy) {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c
  if (Math.abs(determinant) < 0.000001) return { x: dx, y: dy }
  return {
    x: (matrix.d * dx - matrix.c * dy) / determinant,
    y: (-matrix.b * dx + matrix.a * dy) / determinant,
  }
}

export function matrixToSvg(matrix) {
  return `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`
}
