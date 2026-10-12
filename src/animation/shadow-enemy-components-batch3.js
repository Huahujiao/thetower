import { createDefaultShadowProject, shadowMatrixEuler, shadowTransformMatrix } from './shadow-rig.js'

export const BATCH3_COMPONENT_ENEMY_IDS = Object.freeze([
  'furnace-beetle', 'thorn-shell-flower', 'water-leech-swarm',
  'whirlpool-eye-sac', 'cinder-curse-lamp-swarm', 'drown-shadow-hunter',
])

// Ground contacts are support helpers; the separate toe nodes mark the
// actual painted claw tips. Do not let the lowest inner toe turn both feet
// toward the same side when displaying the skeleton.
export function alignHunterFootContacts(project) {
  if (project.enemyId !== 'drown-shadow-hunter') return
  for (const side of ['left', 'right']) {
    const toe = project.joints.find(joint => joint.id === `${side}-foot-toe`)
    const contact = project.joints.find(joint => joint.id === `${side}-foot-art-ground-contact`)
    if (toe && contact) { contact.x = toe.x; contact.z = toe.z }
  }
}

// Pixel anchors follow the anatomical sockets in each indexed preview.
// Cropped segments overlap at real hinges; all artwork remains flat.
export function applyEnemyComponentBatch3(p, { joint, imagePart, pixelLink, keys, organMotion }) {
  if (!BATCH3_COMPONENT_ENEMY_IDS.includes(p.enemyId)) return false
  p.joints = []; p.bones = []; p.parts = []
  p.animations = createDefaultShadowProject().animations
  const j = (id, name, parent, xyz, pose = {}) => {
    joint(p, id, name, parent, ...xyz)
    Object.assign(p.joints.find(v => v.id === id), pose)
  }
  const art = (id, name, n, target, scale, pivot, options) => imagePart(p, id, name, n, target, scale, pivot, options)
  const link = (id, name, parent, n, scale, from, to, z = .3) => pixelLink(p, id, name, parent, n, scale, from, to, z)
  const motion = (id, sign = 1, amplitude = 8) => organMotion(p, id, sign, amplitude)
  const attack = (id, prepare, strike) => keys(p, 'attack', id, [[0, {}], [.27, prepare], [.64, strike], [1, {}]])
  const gait = (id, sign, amplitude = 12) => keys(p, 'move', id, [[0, {}], [.25, { rotationZ: sign * amplitude, rotationX: 5 }], [.75, { rotationZ: -sign * amplitude, rotationX: -5 }], [1, {}]])
  const split = (id, name, n, parent, position, scale, anchors, crops, sign = 1, pose = {}) => {
    j(id, `${name}根`, parent, position, pose)
    art(`${id}-upper`, `${name}上段`, n, id, scale, anchors[0], { crop: crops[0], layer: sign < 0 ? 4 : 7 })
    motion(id, sign, 7)
    let target = id
    for (let i = 1; i < anchors.length; i++) {
      const next = `${id}-hinge-${i}`
      link(next, `${name}${i === 1 ? '中节' : '末节'}`, target, n, scale, anchors[i - 1], anchors[i])
      art(`${id}-segment-${i}`, `${name}${i === 1 ? '下段' : '末端'}`, n, next, scale, anchors[i], { crop: crops[i], layer: i + (sign < 0 ? 4 : 7) })
      motion(next, sign * (i % 2 ? -1 : 1), 8)
      target = next
    }
    return target
  }
  j('root', '主体', null, [0, 0, 0], { rotationY: -30 })

  if (p.enemyId === 'furnace-beetle') {
    j('furnace', '炉膛背甲', 'root', [0, 12, -10], { rotationX: -50 })
    art('carapace', '炉膛与燃烧格栅', 1, 'furnace', .28, [.5, .5], { layer: 7 })
    motion('furnace', 1, 3)
    j('abdomen', '炉底后腹', 'root', [0, -27, -42])
    art('belly-art', '炉底骨环', 14, 'abdomen', .23, [.5, .18], { rotationX: -55, layer: 4 })
    motion('abdomen', -1, 4)
    j('head', '炉虫头', 'root', [0, -23, 57], { rotationX: -15 })
    art('head-art', '炉虫熔眼头甲', 11, 'head', .28, [.5, .35], { layer: 10 })
    motion('head', -1, 6)
    for (const [side, sign, shutter, pipe, leg] of [['left', -1, 2, 5, 12], ['right', 1, 3, 6, 13]]) {
      const label = sign < 0 ? '左' : '右'
      j(`${side}-shutter`, `${label}炉门铰链`, 'furnace', [sign * 39, 22, 2])
      art(`${side}-shutter-art`, `${label}炉门`, shutter, `${side}-shutter`, .17, [sign < 0 ? .87 : .13, .2], { layer: 8 })
      motion(`${side}-shutter`, sign, 4)
      attack(`${side}-shutter`, { rotationY: sign * 15 }, { rotationY: -sign * 48, rotationZ: -sign * 7 })
      j(`${side}-chimney`, `${label}烟道`, 'furnace', [sign * 30, 38, -30])
      art(`${side}-chimney-art`, `${label}烟道与巡铃`, pipe, `${side}-chimney`, .22, [.62, .9], { layer: 3 })
      motion(`${side}-chimney`, -sign, 6)
      for (let i = 0; i < 2; i++) {
        const id = `${side}-leg-${i}`, n = leg
        split(id, `${label}炉足${i + 1}`, n, 'root', [sign * 39, -28, 23 - i * 57], .18,
          [[sign < 0 ? .78 : .22, .18], [.5, .54], [.5, .83]],
          [[0, 0, 1, .63], [0, .47, 1, .43], [0, .76, 1, .24]], sign * (i ? -1 : 1))
        gait(id, sign * (i ? -1 : 1), 11)
        gait(`${id}-hinge-1`, -sign * (i ? -1 : 1), 16)
      }
      j(`${side}-bell`, `${label}炉铃链`, 'furnace', [sign * 51, 6, 3])
      art(`${side}-bell-art`, `${label}炉铃`, 7, `${side}-bell`, .18, [.5, .04], { layer: 9 })
      motion(`${side}-bell`, sign, 13)
    }
    attack('furnace', { rotationX: -8 }, { rotationX: 11 })
  }

  if (p.enemyId === 'thorn-shell-flower') {
    const stemStretch = 1.35
    art('root-ball', '棘壳根球', 13, 'root', .26, [.5, .44], { layer: 5 })
    j('lower-stem', '下棘茎', 'root', [0, 19, -2])
    // The lower segment's painted socket is right of the PNG midpoint.
    // Center that socket on the eye and upper stem instead of the image box.
    const lowerStem = art('lower-stem-art', '下棘茎', 6, 'lower-stem', .22, [.59, .94], { crop: [0, .51, 1, .49], layer: 6 })
    lowerStem.height *= stemStretch
    lowerStem.visual.textureFit = 'stretch'
    // Insert the eye between the painted stem rims. The upper stem follows
    // its socket, while the eye can move independently inside that space.
    j('stem-eye-core', '\u830e\u95f4\u773c\u5ea7', 'lower-stem', [0, 0, 0])
    j('eye', '花眼', 'stem-eye-core', [0, 0, 2.4])
    const eye = art('eye-art', '花眼', 5, 'eye', .27, [.5, .5], { layer: 11 })
    // Let both rims grip the eye with a shallow overlap, leaving no air gap.
    const eyeClearance = -3
    p.joints.find(v => v.id === 'stem-eye-core').y = lowerStem.pivotY * lowerStem.height + eye.height / 2 + eyeClearance
    j('upper-stem', '上棘茎', 'stem-eye-core', [0, eye.height / 2 + eyeClearance, .3])
    const upperStem = art('upper-stem-art', '上棘茎', 6, 'upper-stem', .22, [.5, .46], { crop: [0, 0, 1, .48], layer: 7 })
    upperStem.height *= stemStretch
    upperStem.visual.textureFit = 'stretch'
    p.joints.find(v => v.id === 'upper-stem').y -= (upperStem.pivotY - 1) * upperStem.height
    link('crown', '花冠根', 'upper-stem', 6, .22, [.5, .46], [.5, .08])
    p.joints.find(v => v.id === 'crown').y *= stemStretch
    art('crown-art', '棘壳花冠与口环', 3, 'crown', .29, [.5, .78], { layer: 8 })
    for (const [id, sign, amp] of [['lower-stem', 1, 3], ['upper-stem', -1, 5], ['crown', 1, 7], ['eye', -1, 3]]) motion(id, sign, amp)
    for (const [side, sign, shell, branch, leaf, root] of [['left', -1, 1, 8, 9, 11], ['right', 1, 2, 7, 10, 12]]) {
      const label = sign < 0 ? '左' : '右'
      // Spread paired chains in XY; their shared Z keeps the frontal pose balanced.
      j(`${side}-shell`, `${label}棘壳瓣`, 'crown', [sign * 58, 32, -1], { rotationZ: -sign * 12 })
      const petal = art(`${side}-shell-art`, `${label}棘壳瓣`, shell, `${side}-shell`, .18, [sign < 0 ? .70 : .3, .55], { layer: 10 })
      const hinge = p.joints.find(v => v.id === `${side}-shell`)
      const pivot = [sign < 0 ? .60 : .38, .51]
      const dx = (pivot[0] - petal.pivotX) * petal.width
      const dy = (petal.pivotY - pivot[1]) * petal.height
      const angle = hinge.rotationZ * Math.PI / 180
      // Re-anchor at the painted hinge without moving it, then fold the
      // outer/top edges outward and backward around that fixed root.
      hinge.x += Math.cos(angle) * dx - Math.sin(angle) * dy
      hinge.y += Math.sin(angle) * dx + Math.cos(angle) * dy
      Object.assign(petal, { pivotX: pivot[0], pivotY: pivot[1] })
      Object.assign(hinge, { rotationX: -10, rotationY: sign * 24, rotationZ: -sign * 18 })
      motion(`${side}-shell`, sign, 6)
      attack(`${side}-shell`, { rotationY: sign * 14 }, { rotationY: -sign * 42, rotationZ: -sign * 10 })
      split(`${side}-thorn`, `${label}刺枝`, branch, 'upper-stem', [sign * 22, 16, 2.7], .15,
        [[sign < 0 ? .9 : .1, .37], [.5, .45]],
        [sign < 0 ? [.40, 0, .60, 1] : [0, 0, .6, 1], sign < 0 ? [0, 0, .55, 1] : [.45, 0, .55, 1]], sign, { rotationZ: sign * 10 })
      attack(`${side}-thorn`, { rotationZ: sign * 14 }, { rotationZ: -sign * 27, rotationY: sign * 15 })
      j(`${side}-leaf`, `${label}垂叶`, 'lower-stem', [sign * 34, 23, -2], { rotationZ: sign * 14 })
      art(`${side}-leaf-art`, `${label}苔垂叶`, leaf, `${side}-leaf`, .14, [sign < 0 ? .83 : .17, .17], { layer: 3 })
      motion(`${side}-leaf`, -sign, 9)
      split(`${side}-root`, `${label}行根`, root, 'root', [sign * 42, -8, .8], .15,
        [[.5, .12], [.52, .53]], [[0, 0, 1, .63], [0, .45, 1, .55]], sign, { rotationZ: sign * 16 })
      gait(`${side}-root`, sign, 7)
    }
    attack('upper-stem', { rotationX: -11 }, { rotationX: 14 })
  }

  if (p.enemyId === 'water-leech-swarm') {
    // The three anatomical sets can each supply multiple complete worms.
    // Their headward local -X stays near world -X; stagger XYZ and angles so
    // the frontal review shows a swarm rather than superimposed members.
    const anatomy = [[4, 3, 2, 1, 5, .60], [9, 8, 7, 6, 10, .66], [13, 14, 12, 11, 15, .66]]
    for (const [i, variant, scale, xyz, yaw, roll] of [
      [0, 0, .20, [-72, 58, 8], -8, -9],
      [1, 1, .18, [38, 86, -10], 10, 5],
      [2, 2, .21, [-38, 0, 26], 4, 10],
      [3, 0, .16, [74, 35, 38], -12, -7],
      [4, 1, .185, [-58, -68, 18], 14, 4],
      [5, 2, .16, [57, -53, -12], -5, -12],
    ]) {
      const [head, body, tail, fin, belly, tailSocketY] = anatomy[variant]
      const id = `leech-${i}`, label = `尸蛭${i + 1}`, sign = i % 2 ? -1 : 1
      j(id, `${label}游动轴`, 'root', xyz, { rotationY: yaw, rotationZ: roll })
      split(`${id}-body`, `${label}环节腹`, body, id, [0, 0, 0], scale,
        [[.07, .45], [.53, .48]], [[0, 0, .60, 1], [.48, 0, .52, 1]], sign)
      link(`${id}-tail`, `${label}尾根`, `${id}-body-hinge-1`, body, scale, [.53, .48], [.87, .5])
      art(`${id}-tail-art`, `${label}尾鳍`, tail, `${id}-tail`, scale * .85, [.11, tailSocketY], { layer: 6 })
      motion(`${id}-tail`, -sign, 12)
      j(`${id}-head`, `${label}头环`, id, [0, 0, .8])
      art(`${id}-head-art`, `${label}眼颅与上颚`, head, `${id}-head`, scale, [.86, .48], { crop: [0, 0, 1, .73], layer: 9 })
      link(`${id}-jaw`, `${label}吸附下颚`, `${id}-head`, head, scale, [.86, .48], [.50, .64])
      art(`${id}-jaw-art`, `${label}吸附下颚`, head, `${id}-jaw`, scale, [.50, .64], { crop: [0, .60, 1, .40], layer: 10 })
      j(`${id}-fin`, `${label}背鳍根`, `${id}-body-hinge-1`, [3, 11, -.7])
      art(`${id}-fin-art`, `${label}背鳍`, fin, `${id}-fin`, scale * .75, [.20, .85], { layer: 3 })
      const bodyArt = p.parts.find(part => part.id === `${id}-body-upper`)
      j(`${id}-belly`, `${label}\u8179\u7532`, `${id}-body-hinge-1`, [-2, -bodyArt.height * .35, 1])
      art(`${id}-belly-art`, `${label}\u8179\u4e0b\u9aa8\u7532`, belly, `${id}-belly`, scale * .75, [.5, .5], { layer: 7 })
      if (i % 2 === 0) {
        j(`${id}-wake`, `${label}\u6e38\u52a8\u98d8\u5e26`, `${id}-tail`, [12, -8, -.5])
        art(`${id}-wake-art`, `${label}\u5c3e\u540e\u98d8\u5e26`, 16, `${id}-wake`, .055, [.06, .5], { layer: 2 })
        motion(`${id}-wake`, -sign, 11)
      }
      motion(`${id}-head`, sign, 5); motion(`${id}-jaw`, -sign, 4); motion(`${id}-fin`, sign, 8)
      motion(id, sign, 7)
      keys(p, 'move', id, [[0, {}], [.25, { rotationY: sign * 12 }], [.75, { rotationY: -sign * 12 }], [1, {}]])
      keys(p, 'move', `${id}-body-hinge-1`, [[0, {}], [.35, { rotationY: -sign * 17 }], [.8, { rotationY: sign * 12 }], [1, {}]])
      attack(id, { rotationY: -sign * 17, rotationZ: 5 }, { rotationY: sign * 21, rotationZ: -9 })
      attack(`${id}-jaw`, { rotationZ: 11 }, { rotationZ: -7 })
      keys(p, 'death', id, [[0, {}], [.4, { rotationZ: sign * 9 }], [1, { rotationZ: sign * 28, rotationY: sign * 15 }]])
    }
  }

  if (p.enemyId === 'whirlpool-eye-sac') {
    // Radial floating silhouette: expose the sac below the eye crown rather
    // than stacking every circular cutout over the same point.
    art('vortex-sac', '涡流浮囊', 3, 'root', .26, [.5, .5], { z: -1.5, layer: 4 })
    j('crown', '潮焰骨冠', 'root', [0, 86, 1])
    art('crown-art', '潮焰骨冠下环', 1, 'crown', .23, [.51, .55], { crop: [0, .36, 1, .64], layer: 7 })
    link('crown-tip', '潮焰冠尖', 'crown', 1, .23, [.51, .55], [.51, .28], 0)
    art('crown-tip-art', '潮焰冠尖', 1, 'crown-tip', .23, [.51, .28], { crop: [0, 0, 1, .44], layer: 8 })
    motion('crown-tip', -1, 7)
    j('crest', '\u6f6e\u7130\u9876\u9970', 'crown-tip', [0, 25, -3])
    art('crest-art', '\u6f6e\u7130\u9876\u9970', 2, 'crest', .16, [.5, .88], { layer: 3 })
    motion('crest', 1, 5)
    j('eye-ring', '眼眶骨环', 'crown', [0, 0, 1])
    art('eye-ring-art', '眼眶骨环', 4, 'eye-ring', .18, [.5, .5], { layer: 8 })
    j('eye', '涡眼', 'eye-ring', [0, 0, .6])
    art('eye-art', '涡眼', 5, 'eye', .16, [.5, .5], { layer: 9 })
    j('veil', '浮囊垂膜', 'root', [0, -64, .5])
    art('veil-art', '浮囊垂膜', 8, 'veil', .23, [.5, .08], { layer: 5 })
    j('pendant', '\u6d6e\u56ca\u5782\u9525', 'veil', [0, -45, .7])
    art('pendant-art', '\u6d6e\u56ca\u5782\u9525', 9, 'pendant', .17, [.5, .08], { layer: 6 })
    motion('pendant', 1, 6)
    motion('crown', 1, 5); motion('eye-ring', -1, 3); motion('eye', 1, 4); motion('veil', -1, 9)
    // Character-left is +X. Mirror the complete tether hierarchy so its
    // joints, cropped segments and animation hinges follow the same curve.
    for (const [side, sign] of [['left', 1], ['right', -1]]) {
      const label = sign > 0 ? '左' : '右'
      j(`${side}-crescent`, `${label}\u6f6e\u6708\u9970`, 'crown', [sign * 58, 11, -2], { rotationZ: sign * 18, scaleX: sign })
      art(`${side}-crescent-art`, `${label}\u6f6e\u6708\u9970`, 7, `${side}-crescent`, .18, [.5, .5], { layer: 5 })
      motion(`${side}-crescent`, sign, 5)
      split(`${side}-tether`, `${label}潮丝触须`, 6, 'root', [sign * 64, 4, 2], .22,
        [[.93, .54], [.48, .40], [.10, .46]],
        [[.43, 0, .57, 1], [.06, 0, .48, 1], [0, 0, .16, 1]], -1,
        { rotationZ: -sign * 12, scaleX: -sign })
      // Root rotations mirror before scale; descendant tracks mirror with
      // their parent's negative X scale and therefore share local keyframes.
      motion(`${side}-tether`, sign, 7)
      attack(`${side}-tether`, { rotationZ: sign * 20, rotationY: -sign * 8 }, { rotationZ: -sign * 22, rotationY: sign * 12 })
    }
    for (const [id, sign, fin, xyz, anchor, angle] of [
      ['right-fin', -1, 10, [-63, 26, -.5], [.8, .28], -22],
      ['left-fin', 1, 11, [63, 26, -.5], [.2, .25], 22],
      ['right-lower-fin', -1, 12, [-55, -40, 1], [.88, .12], -20],
      ['left-lower-fin', 1, 13, [55, -40, 1], [.12, .12], 20],
    ]) {
      const label = sign > 0 ? '左' : '右'
      split(id, `${label}${id.includes('lower') ? '下' : '上'}潮流鳍`, fin, 'root', xyz, .18,
        [anchor, [.5, .62]], [[0, 0, 1, .7], [0, .54, 1, .46]], sign,
        { rotationZ: angle, rotationY: sign * 8 })
      attack(id, { rotationZ: sign * 8, rotationY: sign * 7 }, { rotationZ: -sign * 13, rotationY: -sign * 12 })
    }
    attack('eye', { rotationY: -10 }, { rotationY: 17 })
  }

  if (p.enemyId === 'cinder-curse-lamp-swarm') {
    // The source sheet includes assembled lanterns. Partition those original
    // transparent silhouettes instead of replacing their ornate cages with
    // a bare eye and two bars. Every source pixel belongs to exactly one crop.
    for (const [i, source, scale, xyz] of [
      [0, 1, .28, [0, 20, 18]],
      [1, 3, .36, [-136, 43, -12]],
      [2, 4, .34, [134, 67, -20]],
    ]) {
      const id = `lamp-${i}`, label = `咒灯${i + 1}`, sign = i % 2 ? -1 : 1
      const origin = [.5, .35]
      j(id, `${label}悬挂轴`, 'root', xyz)
      const anchors = new Map([[id, { uv: origin, z: 0 }]])
      const piece = (suffix, name, parentSuffix, uv, crop, z, amplitude = 0) => {
        const target = `${id}-${suffix}`, parent = parentSuffix ? `${id}-${parentSuffix}` : id
        const from = anchors.get(parent)
        link(target, `${label}${name}`, parent, source, scale, from.uv, uv, z - from.z)
        anchors.set(target, { uv, z })
        art(`${target}-art`, `${label}${name}`, source, target, scale, uv, { crop, layer: 6 })
        if (amplitude) {
          // Shallow sway keeps the adjoining painted rims together; the long
          // streamers can bend more freely below their real hanging points.
          keys(p, 'idle', target, [[0, {}], [.55, { rotationZ: sign * amplitude * .25 }], [1, {}]])
          keys(p, 'move', target, [[0, {}], [.3, { rotationZ: sign * amplitude }], [.8, { rotationZ: -sign * amplitude * .7 }], [1, {}]])
          attack(target, { rotationZ: -sign * amplitude }, { rotationZ: sign * amplitude * 1.3 })
          keys(p, 'hit', target, [[0, {}], [.3, { rotationZ: -sign * amplitude }], [1, {}]])
          keys(p, 'death', target, [[0, {}], [.4, { rotationZ: sign * amplitude }], [1, { rotationZ: sign * amplitude * 2 }]])
        }
      }
      const [l, r, top, coreTop, coreBottom, waist, tail, sideHinge, sideTail] = i === 0
        ? [.31, .69, .205, .27, .445, .53, .67, .46, .70]
        : [.32, .68, .21, .26, .50, .60, .78, .50, .74]
      piece('roof', '\u591a\u5c42\u706f\u6a90\u4e0e\u5854\u9876', '', [.5, top], [0, 0, 1, top], 0)
      piece('cage-top', '\u7b3c\u9876\u6881\u67b6', '', [.5, coreTop], [l, top, r - l, coreTop - top], .7)
      piece('core', '\u7130\u773c\u4e0e\u73af\u5f62\u7b3c\u67b6', '', origin, [l, coreTop, r - l, coreBottom - coreTop], 1.2)
      piece('cage-base', '\u7b3c\u5e95\u4e0e\u5185\u4fa7\u77ed\u5e61', '', [.5, coreBottom], [l, coreBottom, r - l, waist - coreBottom], .8)
      piece('tassel', '\u4e2d\u592e\u540a\u9525\u4e0e\u957f\u5e61\u6839', 'cage-base', [.5, waist], [l, waist, r - l, tail - waist], .3, .15)
      piece('flame-tail', '\u4e2d\u592e\u957f\u5e61\u4e0e\u7114\u5c3e', 'tassel', [.5, tail], [l, tail, r - l, 1 - tail], .1, .3)
      for (const [side, s, x, w] of [['right', -1, 0, l], ['left', 1, r, 1 - r]]) {
        const sideLabel = s > 0 ? '左' : '右', hingeX = s < 0 ? l : r
        const streamX = s < 0 ? l * .7 : r + (1 - r) * .3
        piece(`${side}-mantle`, `${sideLabel}\u5916\u4fa7\u5492\u5e61\u4e0e\u80a9\u67b6`, 'roof', [hingeX, top], [x, top, w, sideHinge - top], -.7)
        piece(`${side}-chains`, `${sideLabel}\u5782\u94c3\u94fe\u4e0e\u98d8\u5e26`, `${side}-mantle`, [streamX, sideHinge], [x, sideHinge, w, sideTail - sideHinge], .2, .25)
        piece(`${side}-streamer`, `${sideLabel}\u957f\u5c3e\u5e61\u4e0e\u672b\u7aef\u94c3`, `${side}-chains`, [streamX, sideTail], [x, sideTail, w, 1 - sideTail], .5, .35)
      }
      motion(id, sign, 4)
      attack(id, { rotationZ: -sign * 7, rotationX: -6 }, { rotationZ: sign * 10, rotationX: 7 })
      keys(p, 'death', id, [[0, {}], [.4, { rotationZ: sign * 12 }], [1, { rotationZ: sign * 34, rotationX: 18 }]])
    }
  }

  if (p.enemyId === 'drown-shadow-hunter') {
    const fitLimb = (partId, endId, from, to, orientationJointId = null) => {
      const part = p.parts.find(part => part.id === partId), crop = part.visual.textureFrame.crop
      const dx = (to[0] - from[0]) * part.width / crop.width
      const dy = -(to[1] - from[1]) * part.height / crop.height
      Object.assign(part, { rotationZ: Math.atan2(-dy, dx) * 180 / Math.PI,
        attachment: { type: 'bone', targetId: p.bones.find(bone => bone.toJointId === endId).id,
          t: 0, followRotation: true, bindLength: Math.hypot(dx, dy),
          ...(orientationJointId ? { orientationJointId } : {}) } })
      part.visual.textureFit = 'stretch'
    }
    art('rib-cage', '猎手胸肋与腰脊', 11, 'root', .30, [.5, .18], { layer: 7 })
    j('neck', '猎手颈椎', 'root', [0, 8, .5])
    // Centre the painted neck socket, keeping the skull's authored offset.
    art('neck-art', '猎手颈椎', 1, 'neck', .25, [.70, .93], { crop: [.23, .50, .54, .50], layer: 7 })
    link('head', '猎手头', 'neck', 1, .25, [.70, .93], [.5, .44], 0)
    art('head-art', '猎手颅骨与湿发', 1, 'head', .25, [.5, .44], { crop: [0, 0, 1, .50], layer: 10 })
    j('jaw', '猎手下颌', 'head', [0, -5, .4])
    art('jaw-art', '猎手下颌', 7, 'jaw', .23, [.5, .13], { layer: 11 })
    j('pelvis', '猎手骨盆', 'root', [0, -72, -4])
    art('pelvis-art', '猎手骨盆', 20, 'pelvis', .26, [.5, .16], { layer: 6 })
    motion('neck', 1, 3); motion('head', -1, 5); motion('jaw', 1, 4); motion('pelvis', -1, 4)
    // Attach each upper arm at its painted shoulder cap. The two sockets at
    // the right elbow are separate in the source PNG and must be joined,
    // rather than treating the transparent space between them as a hinge.
    j('left-shoulder', '左肩', 'root', [-28, 10, .8])
    art('left-upper-arm', '左上臂', 10, 'left-shoulder', .27, [.34, .08], { layer: 8 })
    link('left-elbow', '左肘', 'left-shoulder', 10, .27, [.34, .08], [.20, .67])
    art('left-forearm', '左前臂', 12, 'left-elbow', .23, [.23, .055], { crop: [0, 0, 1, .435], layer: 9 })
    link('left-wrist', '左腕', 'left-elbow', 12, .23, [.23, .055], [.635, .415], 0)
    // These chain IDs use frontal screen sides: the character's right hand
    // is the left chain. Mirror that hand around its painted wrist socket.
    j('left-hand-mirror', '\u624b\u638c\u955c\u50cf', 'left-wrist', [0, 0, 0], { scaleX: -1 })
    // The painted forearm cuff and palm root use different pixel sockets.
    // Joining them after the reflection brings the arm left to the hand.
    art('left-claw', '左手爪', 12, 'left-hand-mirror', .23, [.68, .46], { crop: [0, .445, 1, .555], layer: 12 })
    j('right-arm', '右持镰臂根', 'root', [28, 10, .8])
    art('right-arm-upper', '右上臂', 8, 'right-arm', .20, [.29, .055], { crop: [0, 0, 1, .315], layer: 8 })
    link('right-arm-hinge-1', '右肘', 'right-arm', 8, .20, [.29, .055], [.37, .29])
    art('right-arm-segment-1', '右前臂', 8, 'right-arm-hinge-1', .20, [.40, .345], { crop: [0, .31, 1, .385], layer: 9 })
    link('right-arm-hinge-2', '右腕', 'right-arm-hinge-1', 8, .20, [.40, .345], [.74, .675], 0)
    art('right-arm-segment-2', '右手爪', 8, 'right-arm-hinge-2', .20, [.74, .675], { crop: [0, .655, 1, .345], layer: 12 })
    link('left-palm-grip', '左掌握点', 'left-wrist', 12, .23, [.68, .46], [.66, .625], 0)
    link('right-palm-grip', '右掌握点', 'right-arm-hinge-2', 8, .20, [.74, .675], [.66, .795], 0)
    p.joints.find(v => v.id === 'left-palm-grip').x *= -1
    for (const [side, sign, shoulderId, elbowId, wristId, forearmId, from, to] of [
      ['left', -1, 'left-shoulder', 'left-elbow', 'left-wrist', 'left-forearm', [.23, .055], [.635, .415]],
      ['right', 1, 'right-arm', 'right-arm-hinge-1', 'right-arm-hinge-2', 'right-arm-segment-1', [.40, .345], [.74, .675]],
    ]) {
      const shoulder = p.joints.find(v => v.id === shoulderId)
      const elbow = p.joints.find(v => v.id === elbowId)
      const wrist = p.joints.find(v => v.id === wristId)
      const grip = p.joints.find(v => v.id === `${side}-palm-grip`)
      const degrees = 180 / Math.PI, upperLength = Math.hypot(elbow.x, elbow.y)
      const upperTurn = Math.atan2(-Math.sqrt(upperLength ** 2 - 9), sign * 3)
        - Math.atan2(elbow.y, elbow.x)
      shoulder.rotationZ = upperTurn * degrees
      const shoulderFrame = shadowTransformMatrix({ rotationZ: shoulder.rotationZ })
      const e = shoulderFrame.elements
      const elbowX = shoulder.x + e[0] * elbow.x + e[4] * elbow.y
      const elbowY = shoulder.y + e[1] * elbow.x + e[5] * elbow.y
      // Keep painted palm centres level, accounting for different hand sizes.
      const dx = sign * 18 - grip.x - elbowX, dy = -66 - grip.y - elbowY
      const dz = 22 - shoulder.z - elbow.z, projected = Math.hypot(dy, dz)
      const lowerFrame = shadowTransformMatrix({ rotationX: -Math.atan2(dz, -dy) * degrees,
        rotationZ: (Math.atan2(-projected, dx) - Math.atan2(wrist.y, wrist.x)) * degrees })
      Object.assign(elbow, shadowMatrixEuler(shoulderFrame.clone().invert().multiply(lowerFrame)))
      const ratio = Math.hypot(dx, dy, dz) / Math.hypot(wrist.x, wrist.y)
      wrist.x *= ratio; wrist.y *= ratio
      Object.assign(wrist, shadowMatrixEuler(lowerFrame.clone().invert()))
      fitLimb(forearmId, wristId, from, to, elbowId)
      for (const [id, amp] of [[shoulderId, 13], [elbowId, 16], [wristId, 10]]) {
        motion(id, sign, amp); gait(id, sign, amp)
      }
    }
    // The grip belongs to the painted palm, not the wrist pivot. Keep the
    // shaft just behind the palms so the fingers visibly overlap it.
    j('scythe', '钩镰枢轴', 'right-palm-grip', [-18, 0, -.6], { rotationZ: -90 })
    art('scythe-art', '溺影钩镰', 2, 'scythe', .18, [.41, .48], { layer: 11 })
    motion('scythe', -1, 7)
    attack('right-arm', { rotationZ: -24, rotationY: -18 }, { rotationZ: 32, rotationY: 27 })
    attack('right-arm-hinge-1', { rotationZ: -19 }, { rotationZ: 25 })
    attack('scythe', { rotationZ: -27, rotationY: -17 }, { rotationZ: 38, rotationY: 21 })
    for (const [side, sign, thigh, shin, foot, cape] of [['left', -1, 14, 19, 23, 3], ['right', 1, 13, 18, 22, 4]]) {
      const label = sign < 0 ? '左' : '右'
      const thighTop = [sign < 0 ? .63 : .35, .10], thighBottom = [sign < 0 ? .22 : .80, .91]
      const shinTop = [sign < 0 ? .47 : .50, .07], shinBottom = sign < 0 ? [.50, .88] : [.43, .90]
      j(`${side}-hip`, `${label}髋`, 'pelvis', [sign * 18, -15, 6])
      art(`${side}-thigh-art`, `${label}大腿`, thigh, `${side}-hip`, .25, thighTop, { layer: 5 })
      link(`${side}-knee`, `${label}膝`, `${side}-hip`, thigh, .25, thighTop, thighBottom)
      art(`${side}-shin-art`, `${label}胫骨`, shin, `${side}-knee`, .26, shinTop, { layer: 6 })
      link(`${side}-ankle`, `${label}踝`, `${side}-knee`, shin, .26, shinTop, shinBottom)
      // Grounding may adjust the knee-to-ankle segment. Bind both ends of the
      // artwork to that bone so the painted ankle never drifts off its node.
      fitLimb(`${side}-shin-art`, `${side}-ankle`, shinTop, shinBottom)
      art(`${side}-foot-art`, `${label}足爪`, foot, `${side}-ankle`, .24, [sign < 0 ? .66 : .23, .10], { layer: 7 })
      // Each cutout has its own painted outer claw tip, not a shared pixel
      // path or the automatically chosen lowest (possibly inner) toe.
      const toe = sign < 0 ? [20 / 131, 133 / 138] : [112 / 142, 123 / 136]
      link(`${side}-foot-toe`, `${label}\u8db3\u5c16`, `${side}-ankle`, foot, .24,
        [sign < 0 ? .66 : .23, .10], toe, 0)
      motion(`${side}-hip`, sign, 6); motion(`${side}-knee`, -sign, 9); motion(`${side}-ankle`, sign, 5)
      gait(`${side}-hip`, sign, 14); gait(`${side}-knee`, -sign, 18)
      split(`${side}-cape`, `${label}湿影披缕`, cape, 'root', [sign * 30, 14, -.7], .25,
        [[sign < 0 ? .1 : .8, .05], [.5, .5]], [[0, 0, 1, .58], [0, .45, 1, .55]], -sign,
        { rotationZ: sign < 0 ? -40 : 30 })
      // Tilt around the shoulder attachment, preserving the old tail-tip Z.
      // Both crops share a plane at the hinge instead of making a depth step.
      const capeRoot = p.joints.find(v => v.id === `${side}-cape`)
      const upper = p.parts.find(v => v.id === `${side}-cape-upper`)
      const u = sign < 0 ? .86 : .36, v = .96, crop = upper.visual.textureFrame.crop
      const tipX = (u - (sign < 0 ? .1 : .8)) * upper.width / crop.width
      const tipY = -(v - .05) * upper.height / crop.height
      const roll = capeRoot.rotationZ * Math.PI / 180
      const rolledY = Math.sin(roll) * tipX + Math.cos(roll) * tipY
      capeRoot.rotationX = Math.asin((-15.7 - capeRoot.z) / rolledY) * 180 / Math.PI
      p.joints.find(v => v.id === `${side}-cape-hinge-1`).z = 0
    }
    keys(p, 'death', 'neck', [[0, {}], [.4, { rotationZ: 4 }], [1, { rotationZ: 10 }]])
    keys(p, 'death', 'head', [[0, {}], [.4, { rotationZ: -3 }], [1, { rotationZ: -8 }]])
  }

  const floating = ['water-leech-swarm', 'whirlpool-eye-sac', 'cinder-curse-lamp-swarm'].includes(p.enemyId)
  const rooted = p.enemyId === 'thorn-shell-flower'
  keys(p, 'idle', 'root', [[0, {}], [.55, { dy: floating ? 3 : 1, rotationX: 2 }], [1, {}]])
  keys(p, 'move', 'root', [[0, {}], [.25, { dy: floating ? 4 : 2, rotationZ: -2 }], [.5, {}], [.75, { dy: floating ? -2 : 2, rotationZ: 2 }], [1, {}]])
  keys(p, 'attack', 'root', [[0, {}], [.27, { rotationX: -5, dz: -4 }], [.64, { rotationX: 7, dz: rooted ? 4 : 10 }], [1, {}]])
  keys(p, 'hit', 'root', [[0, {}], [.3, { rotationZ: 7, dx: 4, dz: -7 }], [1, {}]])
  keys(p, 'death', 'root', [[0, {}], [.4, { dy: -6, rotationZ: 10 }], [1, { dy: floating ? -16 : -13, rotationZ: rooted ? 35 : 48, rotationX: 13 }]])
  return true
}
