import { createDefaultShadowProject, evaluateShadowProject } from './shadow-rig.js'
import { shadowPartFloor } from './shadow-grounding.js'

export const BATCH4_COMPONENT_ENEMY_IDS = Object.freeze([
  'tidal-spore-sac', 'revenant-guard', 'bomb-wisp', 'cracked-hunter',
  'broodling', 'leech-larva', 'tide-shadow',
])

// Prefer a small set of structural textures. Alternate faces, debris and
// duplicate ornaments in the larger source sheets are intentionally unused.
export function applyEnemyComponentBatch4(p, { joint, imagePart, pixelLink, keys, organMotion }) {
  if (!BATCH4_COMPONENT_ENEMY_IDS.includes(p.enemyId)) return false
  p.joints = []; p.bones = []; p.parts = []
  p.animations = createDefaultShadowProject().animations
  const j = (id, name, parent, xyz, pose = {}) => {
    joint(p, id, name, parent, ...xyz)
    Object.assign(p.joints.find(v => v.id === id), pose)
  }
  const art = (id, name, n, target, scale, pivot, options) => imagePart(p, id, name, n, target, scale, pivot, options)
  const link = (id, name, parent, n, scale, from, to, z = .3) => pixelLink(p, id, name, parent, n, scale, from, to, z)
  const motion = (id, sign = 1, amplitude = 7) => organMotion(p, id, sign, amplitude)
  const attack = (id, prepare, strike) => keys(p, 'attack', id, [[0, {}], [.27, prepare], [.64, strike], [1, {}]])
  const gait = (id, sign, amplitude = 12) => keys(p, 'move', id, [[0, {}], [.25, { rotationZ: sign * amplitude, rotationX: 5 }], [.75, { rotationZ: -sign * amplitude, rotationX: -5 }], [1, {}]])
  const split = (id, name, n, parent, position, scale, anchors, crops, sign = 1, pose = {}) => {
    j(id, `${name}根`, parent, position, pose)
    let target = id
    for (let i = 0; i < anchors.length; i++) {
      if (i) {
        const next = `${id}-hinge-${i}`
        link(next, `${name}${i === 1 ? '中节' : '末节'}`, target, n, scale, anchors[i - 1], anchors[i])
        target = next
      }
      art(`${id}-part-${i}`, `${name}${['上段', '下段', '末端'][i]}`, n, target, scale, anchors[i], { crop: crops[i], layer: i + (sign < 0 ? 4 : 7) })
      motion(target, sign * (i % 2 ? -1 : 1), i ? 8 : 6)
    }
    return target
  }
  j('root', '主体', null, [0, 0, 0], { rotationY: -30 })

  if (p.enemyId === 'tidal-spore-sac') {
    // Keep a small overlap at cropped base edges so depth staggering cannot
    // expose a gap in the shared root artwork when viewed from either side.
    const clusters = [
      { crop: [0, 0, .37, 1], socket: [.25, .10], depth: -2.4, stem: 1, scale: .23,
        bottom: [.63, .966], top: [.15, .04], pod: 2, podScale: .21, grip: [.935, .357], fruitX: -60 },
      { crop: [.33, 0, .26, 1], socket: [.438, .065], depth: 2.4, stem: 4, scale: .28,
        bottom: [.50, .975], top: [.18, .045], pod: 3, podScale: .22, grip: [.85, .37], fruitX: 0 },
      { crop: [.55, 0, .45, 1], socket: [.66, .13], depth: 0, stem: 6, scale: .44,
        bottom: [.52, .955], top: [.24, .05], pod: 5, podScale: .27, grip: [.818, .25], fruitX: 60 },
    ]
    for (const [i, cluster] of clusters.entries()) {
      const { crop, socket, depth, stem, scale, bottom, top, pod, podScale, grip, fruitX } = cluster
      const baseId = `base-${i}`, stemId = `stem-${i}`, podId = `pod-${i}`, sign = i === 1 ? -1 : 1
      j(baseId, `\u5b62\u56ca\u5e95\u5ea7${i + 1}`, 'root', [0, 0, depth])
      const base = art(`${baseId}-art`, `\u5b62\u56ca\u5e95\u5ea7${i + 1}`, 16, baseId, .28, socket, { crop, layer: 5 })
      const baseJoint = p.joints.find(v => v.id === baseId)
      baseJoint.x = (socket[0] - .5) * base.width / crop[2]
      baseJoint.y = (.20 - socket[1]) * base.height
      // Small depth steps avoid coplanar seams while keeping the sockets joined.
      j(stemId, `\u5b62\u830e${i + 1}`, baseId, [0, 0, .9])
      art(`${stemId}-art`, `\u5b62\u830e${i + 1}`, stem, stemId, scale, bottom, { layer: 6 })
      link(podId, `\u679c\u5b9e${i + 1}\u8fde\u63a5\u70b9`, stemId, stem, scale, bottom, top, .65)
      const fruit = art(`${podId}-art`, `\u5b62\u56ca\u679c\u5b9e${i + 1}`, pod, podId, podScale, grip, { layer: 8 })
      const tip = p.joints.find(v => v.id === podId), stemJoint = p.joints.find(v => v.id === stemId)
      // Aim at separated fruit centres without stretching the drawn stalks.
      const targetX = fruitX + (grip[0] - .5) * fruit.width - baseJoint.x
      const length = Math.hypot(tip.x, tip.y)
      const turn = Math.atan2(Math.sqrt(length ** 2 - targetX ** 2), targetX) - Math.atan2(tip.y, tip.x)
      stemJoint.rotationZ = turn * 180 / Math.PI
      // Counter the stalk's turn so each hanging fruit remains upright.
      tip.rotationZ = -stemJoint.rotationZ
      motion(stemId, sign, 5); motion(podId, -sign, 5)
      attack(stemId, { rotationX: -sign * 5, rotationZ: sign * 5 }, { rotationX: sign * 9, rotationZ: -sign * 7 })
      attack(podId, { rotationZ: -sign * 8 }, { rotationZ: sign * 12, rotationY: sign * 7 })
    }
  }

  if (p.enemyId === 'revenant-guard') {
    art('chest', '还魂胸甲与魂火', 11, 'root', .28, [.5, .24], { layer: 7 })
    j('neck', '还魂颈环', 'root', [0, 20, 6])
    art('neck-art', '还魂颈骨', 13, 'neck', .40, [.5, .06], { layer: 8 })
    j('head', '还魂头', 'neck', [0, 10, 2])
    art('head-art', '还魂冠盔与颅骨', 1, 'head', .28, [.5, .84], { crop: [0, 0, 1, .89], layer: 10 })
    link('jaw', '还魂下颌', 'head', 1, .28, [.5, .84], [.5, .87])
    art('jaw-art', '还魂下颌与魂焰', 1, 'jaw', .28, [.5, .87], { crop: [.30, .81, .40, .19], layer: 11 })
    motion('neck', 1, 3); motion('head', -1, 4); motion('jaw', 1, 3)
    j('pelvis', '束甲骨盆', 'root', [0, -66, -5])
    art('skirt', '束甲魂裾', 24, 'pelvis', .22, [.5, .08], { layer: 6 })
    motion('pelvis', -1, 4)
    for (const [side, sign, upper, forearm, leg] of [['left', -1, 14, 21, 26], ['right', 1, 15, 22, 25]]) {
      const label = sign < 0 ? '左' : '右', a = [sign < 0 ? .72 : .20, .08], b = [sign < 0 ? .48 : .57, sign < 0 ? .88 : .64]
      j(`${side}-shoulder`, `${label}肩`, 'root', [sign * 36, 10, sign * 12])
      art(`${side}-upper-arm`, `${label}上臂`, upper, `${side}-shoulder`, .22, a, { layer: 5 })
      link(`${side}-elbow`, `${label}肘`, `${side}-shoulder`, upper, .22, a, b)
      const c = [sign < 0 ? .63 : .27, .09], d = [sign < 0 ? .36 : .61, .62]
      art(`${side}-forearm`, `${label}前臂`, forearm, `${side}-elbow`, .22, c, { crop: [0, 0, 1, .69], layer: 6 })
      link(`${side}-wrist`, `${label}腕`, `${side}-elbow`, forearm, .22, c, d)
      art(`${side}-hand`, `${label}骨爪`, forearm, `${side}-wrist`, .22, d, { crop: [0, .56, 1, .44], layer: 8 })
      motion(`${side}-shoulder`, sign, 12); motion(`${side}-elbow`, -sign, 15); motion(`${side}-wrist`, sign, 9)
      gait(`${side}-shoulder`, -sign, 10)
      const top = [sign < 0 ? .76 : .18, .05], knee = [sign < 0 ? .58 : .47, .44], ankle = [sign < 0 ? .62 : .57, .82]
      const left = sign < 0 ? .43 : 0, width = sign < 0 ? .57 : 1
      split(`${side}-leg`, `${label}甲足`, leg, 'pelvis', [sign * 21, -10, sign * 8], .20,
        [top, knee, ankle], [[left, 0, width, .52], [left, .39, width, .49], [left, .75, width, .25]], sign)
      gait(`${side}-leg`, sign, 13); gait(`${side}-leg-hinge-1`, -sign, 17)
    }
    // A single small bell focus uses the clear standalone gem-and-bells asset.
    j('soul-focus', '还魂铃印', 'left-wrist', [0, -12, 3])
    art('soul-focus-art', '还魂铃印', 28, 'soul-focus', .20, [.5, .14], { layer: 9 })
    motion('soul-focus', -1, 8)
    attack('left-shoulder', { rotationZ: 19, rotationX: -9 }, { rotationZ: -23, rotationX: 12 })
    attack('soul-focus', { rotationY: -13 }, { rotationY: 17, rotationZ: -14 })
  }

  if (p.enemyId === 'bomb-wisp') {
    j('shell', '自爆灯壳', 'root', [0, 0, -1])
    art('shell-art', '焦裂灯壳', 5, 'shell', .34, [.5, .26], { layer: 6 })
    j('core', '自爆灯芯', 'shell', [0, 0, 1])
    art('core-art', '焰眼灯芯', 15, 'core', .43, [.5, .5], { layer: 9 })
    j('roof', '自爆灯檐', 'shell', [0, 39, -2])
    art('roof-art', '自爆灯檐', 2, 'roof', .35, [.5, .58], { layer: 7 })
    j('tassel', '自爆咒穗', 'shell', [0, -36, 0])
    art('tassel-art', '自爆咒穗', 44, 'tassel', .36, [.5, .02], { layer: 7 })
    motion('shell', 1, 3); motion('core', -1, 5); motion('roof', -1, 4); motion('tassel', 1, 12)
    for (const [side, sign, arm] of [['left', -1, 20], ['right', 1, 18]]) {
      const label = sign < 0 ? '左' : '右'
      split(`${side}-arm`, `${label}灯爪臂`, arm, 'shell', [sign * 35, 17, sign * 10], .18,
        [[sign < 0 ? .5 : .30, .05], [.5, .38], [.5, .71]], [[0, 0, 1, .45], [0, .32, 1, .44], [0, .65, 1, .35]], sign)
      attack(`${side}-arm`, { rotationZ: -sign * 12, rotationY: -sign * 9 }, { rotationZ: sign * 21, rotationY: sign * 14 })
      j(`${side}-fuse`, `${label}倒数灯芯`, 'core', [sign * 20, 19, -.4], { rotationZ: -sign * 17 })
      art(`${side}-fuse-art`, `${label}倒数灯芯`, 10, `${side}-fuse`, .19, [.5, .92], { layer: 8 })
      motion(`${side}-fuse`, sign, 11)
      attack(`${side}-fuse`, { rotationZ: -sign * 16 }, { rotationZ: sign * 30, rotationY: sign * 11 })
    }
    attack('core', { rotationY: -10 }, { rotationY: 13, rotationZ: 9 })
  }

  if (p.enemyId === 'cracked-hunter') {
    // Retain complete sheets, and only partition the detached mandible below.
    art('chest', '裂甲胸壳', 1, 'root', .25, [.5, .25], { layer: 7 })
    link('head', '裂甲头', 'root', 1, .25, [.5, .25], [.5, .035], 1.25)
    // The lower-right mandible is detached in the source sheet. Preserve all
    // pixels across three regions and reattach it at the painted mouth hinge.
    art('head-art', '裂甲头与角冠', 2, 'head', .24, [.34, .55], { crop: [0, 0, 1, .55], y: (.60 - .55) * 330 * .24, layer: 9 })
    art('head-chin-art', '\u88c2\u7532\u5934\u4e0b\u6bb5', 2, 'head', .24, [.34, .60], { crop: [0, .55, .56, .45], layer: 9 })
    link('jaw', '\u88c2\u7532\u4e0b\u988c', 'head', 2, .24, [.34, .60], [.53, .50], .25)
    art('jaw-art', '\u88c2\u7532\u4e0b\u988c', 2, 'jaw', .24, [.90, .68], { crop: [.56, .55, .44, .45], layer: 10 })
    motion('head', -1, 6)
    // Reuse the complete vertebrae sheet between chest and pelvis. Tuck both
    // ends behind the armor while adding a visible, connected waist segment.
    link('spine', '\u88c2\u7532\u810a\u67f1\u4e0a\u7aef', 'root', 1, .25, [.5, .25], [.5, .86], -.8)
    art('spine-art', '\u88c2\u7532\u810a\u67f1', 3, 'spine', .18, [.5, .08], { layer: 6 })
    link('pelvis', '裂甲骨盆', 'spine', 3, .18, [.5, .08], [.5, .88], 2.5)
    art('pelvis-art', '裂甲髋裙', 13, 'pelvis', .22, [.5, .10], { layer: 6 })
    motion('spine', 1, 4)
    motion('pelvis', -1, 4)
    // Character-right is screen-left: the solid gripping arm belongs there.
    const wrist = split('right-arm', '右追猎臂', 12, 'root', [-34, 11, 3], .19,
      [[.60, .10], [.50, .38], [.50, .73]], [[0, 0, 1, .45], [0, .33, 1, .47], [0, .69, 1, .31]], 1, { rotationZ: -5 })
    // Open the forearm slightly so the held hook clears the upper-arm armor.
    p.joints.find(v => v.id === 'right-arm-hinge-1').rotationZ = -15
    // Character-left upper arm sits behind the active armor plate. Move its
    // connected branch together, while retaining the shoulder cap in front.
    const spectralElbow = split('missing-arm', '裂缝代臂', 11, 'root', [34, 11, .5], .16,
      [[.37, .06], [.67, .44]], [[0, 0, 1, .55], [0, .41, 1, .59]], -1, { rotationZ: 6 })
    // The reference puts the shoulder cap on the spectral side. Counter its
    // static arm turn while retaining the arm's animated shoulder movement.
    j('spectral-pauldron', '\u88c2\u7f1d\u80a9\u7532\u63a5\u70b9', 'missing-arm', [0, 0, 0], { rotationZ: -6 })
    art('right-pauldron', '右追猎肩甲', 7, 'spectral-pauldron', .20, [.18, .16], { z: 3, layer: 8 })
    link('missing-arm-tip', '\u88c2\u7f1d\u4ee3\u81c2\u672b\u7aef', spectralElbow, 11, .16, [.67, .44], [.48, .91], .3)
    // Join the wrapped shaft to the opaque palm, behind the gripping fingers.
    link('hook', '追猎钩', wrist, 12, .19, [.50, .73], [.56, .78], -.35)
    // Reverse the weapon around the same palm socket: blade down and right.
    p.joints.find(v => v.id === 'hook').rotationZ = 250
    art('hook-art', '追猎钩', 9, 'hook', .19, [.445, .47], { layer: 10 })
    motion('hook', -1, 8)
    attack('right-arm', { rotationZ: -25, rotationY: -16 }, { rotationZ: 26, rotationY: 21 })
    attack('hook', { rotationZ: -20 }, { rotationZ: 34, rotationY: 17 })
    attack('missing-arm', { rotationZ: 15 }, { rotationZ: -24, rotationY: -13 })
    for (const [side, sign, thigh, shin, foot, plate] of [['left', -1, 16, 17, 19, 4], ['right', 1, 15, 18, 20, 5]]) {
      const label = sign < 0 ? '左' : '右'
      j(`${side}-plate`, `${label}裂甲活片`, 'root', [sign * 26, 7, 2])
      art(`${side}-plate-art`, `${label}裂甲活片`, plate, `${side}-plate`, .16, [.5, .2], { layer: 8 })
      motion(`${side}-plate`, sign, 6)
      link(`${side}-hip`, `${label}髋`, 'pelvis', 13, .22, [.5, .10], [sign < 0 ? .23 : .77, .25], -1.3)
      const a = [sign < 0 ? .48 : .50, .09], b = [sign < 0 ? .48 : .50, sign < 0 ? .61 : .72]
      const thighScale = sign < 0 ? .25 : .27
      const shinTop = [.52, .20]
      const shinBottom = [sign < 0 ? .48 : .52, sign < 0 ? .87 : .88]
      const footSocket = [sign < 0 ? .66 : .27, .15]
      art(`${side}-thigh-art`, `${label}大腿甲`, thigh, `${side}-hip`, thighScale, a, { layer: 5 })
      link(`${side}-knee`, `${label}膝`, `${side}-hip`, thigh, thighScale, a, b)
      art(`${side}-shin-art`, `${label}胫甲`, shin, `${side}-knee`, .25, shinTop, { layer: 6 })
      link(`${side}-ankle`, `${label}踝`, `${side}-knee`, shin, .25, shinTop, shinBottom)
      art(`${side}-foot-art`, `${label}足爪`, foot, `${side}-ankle`, .23, footSocket, { layer: 7 })
      const toe = sign < 0 ? [1 / 171, 118 / 145] : [206 / 208, 114 / 140]
      link(`${side}-foot-toe`, `${label}\u811a\u5c16`, `${side}-ankle`, foot, .23, footSocket, toe, 0)
      motion(`${side}-hip`, sign, 6); motion(`${side}-knee`, -sign, 9); motion(`${side}-ankle`, sign, 4)
      gait(`${side}-hip`, sign, 14); gait(`${side}-knee`, -sign, 18)
    }
    // Match independently drawn sole heights before grounding. Otherwise the
    // floor constraint would pull one ankle away from its painted shin cuff.
    const rest = evaluateShadowProject(p, null, 0, { raw: true })
    const soleGap = shadowPartFloor(rest.parts.find(e => e.part.id === 'right-foot-art'))
      - shadowPartFloor(rest.parts.find(e => e.part.id === 'left-foot-art'))
    const rightThigh = p.parts.find(part => part.id === 'right-thigh-art')
    const thighRatio = (rightThigh.height + soleGap / (.72 - .09)) / rightThigh.height
    rightThigh.width *= thighRatio; rightThigh.height *= thighRatio
    p.joints.find(v => v.id === 'right-knee').y -= soleGap
    // Follow the actual knee-to-ankle bone after the feet are planted, so the
    // grounding constraint cannot separate the shin artwork from the ankle.
    for (const side of ['left', 'right']) {
      const shin = p.parts.find(part => part.id === `${side}-shin-art`)
      const dx = ((side === 'left' ? .48 : .52) - .52) * shin.width
      const dy = -((side === 'left' ? .87 : .88) - .20) * shin.height
      shin.rotationZ = -Math.atan2(dy, dx) * 180 / Math.PI
      shin.attachment = { type: 'bone', targetId: p.bones.find(b => b.toJointId === `${side}-ankle`).id,
        t: 0, followRotation: true, bindLength: Math.hypot(dx, dy) }
      shin.visual.textureFit = 'stretch'
    }
    keys(p, 'death', 'spine', [[0, {}], [.4, { rotationZ: 3 }], [1, { rotationZ: 8 }]])
  }

  if (p.enemyId === 'broodling') {
    art('thorax', '幼体胸皮', 4, 'root', .23, [.5, .5], { rotationX: -40, layer: 6 })
    j('abdomen', '幼体后腹', 'root', [0, -4, -35], { rotationY: 90 })
    art('abdomen-art', '幼体软腹', 1, 'abdomen', .17, [.23, .46], { layer: 4 })
    art('carapace', '幼体背膜', 2, 'abdomen', .22, [.5, .35], { rotationX: -55, layer: 5 })
    j('head', '幼体头', 'root', [0, 3, 49], { rotationX: -14 })
    art('head-art', '幼体头壳', 8, 'head', .27, [.5, .50], { layer: 9 })
    motion('head', -1, 5); motion('abdomen', 1, 5)
    for (const [side, sign, jaw, front, rear] of [['left', -1, 6, 13, 16], ['right', 1, 5, 14, 15]]) {
      const label = sign < 0 ? '左' : '右'
      j(`${side}-jaw`, `${label}颚根`, 'head', [sign * 15, -12, 2])
      art(`${side}-jaw-art`, `${label}锯颚`, jaw, `${side}-jaw`, .19, [sign < 0 ? .75 : .25, .08], { layer: 10 })
      motion(`${side}-jaw`, sign, 8)
      attack(`${side}-jaw`, { rotationY: -sign * 10 }, { rotationY: sign * 17, rotationZ: -sign * 12 })
      split(`${side}-front`, `${label}前足`, front, 'root', [sign * 30, -23, 22], .21,
        [[sign < 0 ? .90 : .10, .40], [sign < 0 ? .35 : .65, .20], [sign < 0 ? .12 : .88, .84]],
        [sign < 0 ? [.25, 0, .75, .60] : [0, 0, .75, .60], sign < 0 ? [0, 0, .43, .87] : [.57, 0, .43, .87], sign < 0 ? [0, .75, .25, .25] : [.75, .75, .25, .25]], sign)
      split(`${side}-rear`, `${label}后足`, rear, 'root', [sign * 33, -23, -28], .19,
        [[sign < 0 ? .87 : .13, .13], [.5, .35], [sign < 0 ? .12 : .88, .83]],
        [[0, 0, 1, .45], [0, .30, 1, .58], [0, .77, 1, .23]], -sign)
      gait(`${side}-front`, sign, 12); gait(`${side}-rear`, -sign, 12)
      gait(`${side}-front-hinge-1`, -sign, 16); gait(`${side}-rear-hinge-1`, sign, 16)
    }
  }

  if (p.enemyId === 'leech-larva') {
    j('body', '幼蛭环节轴', 'root', [0, -2, 0], { rotationY: 65 })
    art('front-body', '幼蛭前腹节', 2, 'body', .22, [.10, .55], { layer: 5 })
    link('middle-body', '幼蛭中腹节', 'body', 2, .22, [.10, .55], [.88, .55])
    art('middle-body-art', '幼蛭中腹节', 3, 'middle-body', .20, [.13, .55], { layer: 4 })
    link('rear-body', '幼蛭后腹节', 'middle-body', 3, .20, [.13, .55], [.85, .55])
    art('rear-body-art', '幼蛭后腹节', 4, 'rear-body', .19, [.13, .55], { layer: 3 })
    link('tail', '幼蛭尾根', 'rear-body', 4, .19, [.13, .55], [.85, .55])
    art('tail-base', '幼蛭尾钩下段', 5, 'tail', .20, [.16, .72], { crop: [0, .28, 1, .72], layer: 4 })
    link('tail-tip', '幼蛭尾钩尖', 'tail', 5, .20, [.16, .72], [.62, .34])
    art('tail-tip-art', '幼蛭尾钩尖', 5, 'tail-tip', .20, [.62, .34], { crop: [.45, 0, .55, .40], layer: 5 })
    j('head', '幼蛭头', 'root', [0, 27, 35], { rotationX: -15 })
    art('hood', '幼蛭头罩与上口', 1, 'head', .20, [.5, .58], { crop: [0, 0, 1, .73], layer: 8 })
    link('mouth', '幼蛭吸附口', 'head', 1, .20, [.5, .58], [.5, .70])
    art('mouth-art', '幼蛭吸附口下缘', 1, 'mouth', .20, [.5, .70], { crop: [.10, .63, .80, .37], layer: 9 })
    j('eye', '幼蛭额眼', 'head', [0, 30, .6])
    art('eye-art', '幼蛭额眼', 9, 'eye', .21, [.5, .5], { layer: 10 })
    for (const [side, sign, feeler] of [['left', -1, 6], ['right', 1, 7]]) {
      const label = sign < 0 ? '左' : '右'
      split(`${side}-sucker`, `${label}吸盘触管`, feeler, 'root', [sign * 34, 10, 29], .15,
        [[sign < 0 ? .70 : .30, .08], [sign < 0 ? .60 : .40, .67]], [[0, 0, 1, .72], [0, .60, 1, .40]], sign)
      attack(`${side}-sucker`, { rotationZ: sign * 12 }, { rotationZ: -sign * 20, rotationY: -sign * 13 })
    }
    for (const [id, sign, amp] of [['body', 1, 5], ['middle-body', -1, 7], ['rear-body', 1, 9], ['tail', -1, 10], ['tail-tip', 1, 7], ['head', -1, 5], ['mouth', 1, 5], ['eye', -1, 3]]) motion(id, sign, amp)
    attack('mouth', { rotationX: -8 }, { rotationX: 14, rotationZ: 3 })
    attack('head', { rotationX: -7 }, { rotationX: 9 })
  }

  if (p.enemyId === 'tide-shadow') {
    art('chest-frame', '潮影空胸骨框', 4, 'root', .28, [.5, .30], { layer: 7 })
    j('crown', '潮影冠焰', 'root', [0, 31, -1])
    art('crown-art', '潮影冠焰', 1, 'crown', .27, [.5, .80], { layer: 8 })
    j('eye-ring', '潮影眼环', 'root', [0, -7, .6])
    art('eye-ring-art', '潮影眼环', 5, 'eye-ring', .30, [.5, .5], { layer: 8 })
    j('eye', '潮影魂眼', 'eye-ring', [0, 0, .3])
    art('eye-art', '潮影魂眼', 9, 'eye', .32, [.5, .5], { layer: 9 })
    motion('crown', 1, 5); motion('eye-ring', -1, 3); motion('eye', 1, 4)
    for (const [side, sign, arm] of [['left', -1, 2], ['right', 1, 3]]) {
      const label = sign < 0 ? '左' : '右', left = sign < 0 ? 0 : .64
      j(`${side}-shoulder`, `${label}肩`, 'root', [sign * 35, 16, sign * 11])
      const a = [sign < 0 ? .22 : .78, .12], b = [sign < 0 ? .17 : .83, .36], c = [sign < 0 ? .18 : .82, .48]
      art(`${side}-upper-arm`, `${label}上臂与肩缕`, arm, `${side}-shoulder`, .17, a, { crop: [left, 0, .36, .39], layer: 5 })
      link(`${side}-elbow`, `${label}肘`, `${side}-shoulder`, arm, .17, a, b)
      art(`${side}-forearm`, `${label}前臂`, arm, `${side}-elbow`, .17, b, { crop: [sign < 0 ? .06 : .68, .33, .26, .21], layer: 6 })
      link(`${side}-wrist`, `${label}腕`, `${side}-elbow`, arm, .17, b, c)
      // These claws are separate islands in the same PNG: bind them at the
      // wrist instead of retaining their unrelated atlas position.
      art(`${side}-claw`, `${label}潮影手爪`, arm, `${side}-wrist`, .17, [sign < 0 ? .10 : .90, .55], { crop: [sign < 0 ? 0 : .70, .525, .30, .22], layer: 9 })
      motion(`${side}-shoulder`, sign, 12); motion(`${side}-elbow`, -sign, 14); motion(`${side}-wrist`, sign, 9)
      attack(`${side}-shoulder`, { rotationZ: -sign * 13, rotationY: -sign * 8 }, { rotationZ: sign * 19, rotationY: sign * 11 })
    }
    j('veil', '潮影悬裾', 'root', [0, -45, -5])
    art('veil-center', '潮影悬裾中缕', 16, 'veil', .22, [.5, .05], { crop: [.42, 0, .16, 1], layer: 6 })
    motion('veil', -1, 5)
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      const label = sign < 0 ? '左' : '右'
      j(`${side}-veil`, `${label}悬裾铰链`, 'veil', [0, 0, .3])
      art(`${side}-veil-art`, `${label}悬裾`, 16, `${side}-veil`, .22, [.5, .05], { crop: [sign < 0 ? 0 : .56, 0, .44, 1], layer: 7 })
      motion(`${side}-veil`, sign, 9)
    }
    split('tail', '潮影垂缕', 25, 'veil', [0, -20, -3], .22,
      [[.5, .05], [.5, .53]], [[0, 0, 1, .61], [0, .46, 1, .54]], 1)
  }

  const floating = ['bomb-wisp', 'tide-shadow'].includes(p.enemyId)
  const rooted = p.enemyId === 'tidal-spore-sac'
  keys(p, 'idle', 'root', [[0, {}], [.55, { dy: floating ? 3 : 1, rotationX: 2 }], [1, {}]])
  keys(p, 'move', 'root', [[0, {}], [.25, { dy: floating ? 4 : 2, rotationZ: -2 }], [.5, {}], [.75, { dy: floating ? -2 : 2, rotationZ: 2 }], [1, {}]])
  keys(p, 'attack', 'root', [[0, {}], [.27, { rotationX: -5, dz: -4 }], [.64, { rotationX: 7, dz: rooted ? 4 : 10 }], [1, {}]])
  keys(p, 'hit', 'root', [[0, {}], [.3, { rotationZ: 7, dx: 4, dz: -7 }], [1, {}]])
  keys(p, 'death', 'root', [[0, {}], [.4, { dy: -6, rotationZ: 10 }], [1, { dy: floating ? -16 : -13, rotationZ: rooted ? 32 : 46, rotationX: 13 }]])
  return true
}
