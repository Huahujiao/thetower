import { createDefaultShadowProject } from './shadow-rig.js'

export const BATCH3_COMPONENT_ENEMY_IDS = Object.freeze([
  'furnace-beetle', 'thorn-shell-flower', 'water-leech-swarm',
  'whirlpool-eye-sac', 'cinder-curse-lamp-swarm', 'drown-shadow-hunter',
])

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
    art('root-ball', '棘壳根球', 13, 'root', .26, [.5, .44], { layer: 5 })
    j('lower-stem', '下棘茎', 'root', [0, 7, -2])
    art('lower-stem-art', '下棘茎', 6, 'lower-stem', .22, [.5, .94], { crop: [0, .51, 1, .49], layer: 6 })
    link('upper-stem', '上棘茎', 'lower-stem', 6, .22, [.5, .94], [.5, .54])
    art('upper-stem-art', '上棘茎', 6, 'upper-stem', .22, [.5, .46], { crop: [0, 0, 1, .48], layer: 7 })
    link('crown', '花冠根', 'upper-stem', 6, .22, [.5, .46], [.5, .08])
    art('crown-art', '棘壳花冠与口环', 3, 'crown', .29, [.5, .78], { layer: 8 })
    j('eye', '花眼', 'crown', [0, 18, 2.4])
    art('eye-art', '花眼', 5, 'eye', .27, [.5, .5], { layer: 11 })
    for (const [id, sign, amp] of [['lower-stem', 1, 3], ['upper-stem', -1, 5], ['crown', 1, 7], ['eye', -1, 3]]) motion(id, sign, amp)
    for (const [side, sign, shell, branch, leaf, root] of [['left', -1, 1, 8, 9, 11], ['right', 1, 2, 7, 10, 12]]) {
      const label = sign < 0 ? '左' : '右'
      // Spread paired chains in XY; their shared Z keeps the frontal pose balanced.
      j(`${side}-shell`, `${label}棘壳瓣`, 'crown', [sign * 48, 32, -1], { rotationZ: -sign * 12 })
      art(`${side}-shell-art`, `${label}棘壳瓣`, shell, `${side}-shell`, .18, [sign < 0 ? .70 : .3, .55], { layer: 10 })
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
    // Each worm's local +X points toward world -Z, with its head at +Z.
    for (const [i, head, body, tail, fin, scale, xyz] of [
      [0, 4, 3, 2, 1, .22, [-35, 28, 30]],
      [1, 9, 8, 7, 6, .20, [30, 6, -30]],
      [2, 13, 14, 12, 11, .18, [0, -35, -50]],
    ]) {
      const id = `leech-${i}`, label = `尸蛭${i + 1}`, sign = i % 2 ? -1 : 1
      j(id, `${label}游动轴`, 'root', xyz, { rotationY: 65, rotationZ: (i - 1) * 7 })
      split(`${id}-body`, `${label}环节腹`, body, id, [0, 0, 0], scale,
        [[.07, .45], [.53, .48]], [[0, 0, .60, 1], [.48, 0, .52, 1]], sign)
      link(`${id}-tail`, `${label}尾根`, `${id}-body-hinge-1`, body, scale, [.53, .48], [.87, .5])
      art(`${id}-tail-art`, `${label}尾鳍`, tail, `${id}-tail`, scale * .85, [.11, .43], { layer: 6 })
      motion(`${id}-tail`, -sign, 12)
      j(`${id}-head`, `${label}头环`, id, [0, 0, .8])
      art(`${id}-head-art`, `${label}眼颅与上颚`, head, `${id}-head`, scale, [.86, .48], { crop: [0, 0, 1, .73], layer: 9 })
      link(`${id}-jaw`, `${label}吸附下颚`, `${id}-head`, head, scale, [.86, .48], [.50, .64])
      art(`${id}-jaw-art`, `${label}吸附下颚`, head, `${id}-jaw`, scale, [.50, .64], { crop: [0, .60, 1, .40], layer: 10 })
      j(`${id}-fin`, `${label}背鳍根`, `${id}-body-hinge-1`, [3, 11, -.7])
      art(`${id}-fin-art`, `${label}背鳍`, fin, `${id}-fin`, scale * .75, [.20, .85], { layer: 3 })
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
    art('vortex-sac', '涡流浮囊', 3, 'root', .26, [.5, .48], { z: -6, layer: 4 })
    j('crown', '潮焰骨冠', 'root', [0, 14, 0])
    art('crown-art', '潮焰骨冠下环', 1, 'crown', .26, [.5, .58], { crop: [0, .36, 1, .64], layer: 7 })
    link('crown-tip', '潮焰冠尖', 'crown', 1, .26, [.5, .58], [.5, .28])
    art('crown-tip-art', '潮焰冠尖', 1, 'crown-tip', .26, [.5, .28], { crop: [0, 0, 1, .44], layer: 8 })
    motion('crown-tip', -1, 7)
    j('eye-ring', '眼眶骨环', 'crown', [0, 0, .6])
    art('eye-ring-art', '眼眶骨环', 4, 'eye-ring', .21, [.5, .5], { layer: 8 })
    j('eye', '涡眼', 'eye-ring', [0, 0, .3])
    art('eye-art', '涡眼', 5, 'eye', .25, [.5, .5], { layer: 9 })
    j('veil', '浮囊垂膜', 'root', [0, -56, -2])
    art('veil-art', '浮囊垂膜', 8, 'veil', .23, [.5, .08], { layer: 5 })
    motion('crown', 1, 5); motion('eye-ring', -1, 3); motion('eye', 1, 4); motion('veil', -1, 9)
    for (const [side, sign, fin] of [['left', -1, 10], ['right', 1, 11]]) {
      const label = sign < 0 ? '左' : '右'
      split(`${side}-fin`, `${label}潮流鳍`, fin, 'root', [sign * 45, -11, -3], .17,
        [[.5, .2], [.5, .62]], [[0, 0, 1, .7], [0, .54, 1, .46]], sign,
        { rotationY: sign * 18 })
      attack(`${side}-fin`, { rotationZ: sign * 8, rotationY: sign * 11 }, { rotationZ: -sign * 17, rotationY: -sign * 20 })
    }
    split('tether', '潮丝触须', 6, 'root', [-51, -15, 2], .18,
      [[.93, .54], [.48, .40], [.10, .46]],
      [[.43, 0, .57, 1], [.06, 0, .48, 1], [0, 0, .16, 1]], -1,
      { rotationZ: 16 })
    attack('tether', { rotationZ: -27, rotationY: 12 }, { rotationZ: 24, rotationY: -20 })
    attack('eye', { rotationY: -10 }, { rotationY: 17 })
  }

  if (p.enemyId === 'cinder-curse-lamp-swarm') {
    for (const [i, factor, xyz] of [[0, 1, [0, 25, 14]], [1, .7, [-105, -9, -15]], [2, .65, [100, 39, -24]]]) {
      const id = `lamp-${i}`, label = `咒灯${i + 1}`, sign = i % 2 ? -1 : 1
      j(id, `${label}悬挂轴`, 'root', xyz, { rotationZ: (i - 1) * 5 })
      art(`${id}-roof`, `${label}灯檐`, 7, id, .40 * factor, [.5, .75], { layer: 7 })
      j(`${id}-cage`, `${label}灯笼`, id, [0, -25 * factor, 2])
      j(`${id}-core`, `${label}灯芯`, `${id}-cage`, [0, 0, .5])
      art(`${id}-core-art`, `${label}焰眼灯芯`, 13, `${id}-core`, .48 * factor, [.5, .5], { layer: 9 })
      for (const [side, s, cloth] of [['left', -1, 17], ['right', 1, 18]]) {
        const sideLabel = s < 0 ? '左' : '右'
        j(`${id}-${side}-bar`, `${label}${sideLabel}笼栏`, `${id}-cage`, [s * 17 * factor, 23 * factor, 1])
        art(`${id}-${side}-bar-art`, `${label}${sideLabel}笼栏`, 14, `${id}-${side}-bar`, .43 * factor, [.5, .04], { rotationY: s < 0 ? 180 : 0, layer: 10 })
        motion(`${id}-${side}-bar`, s, 3)
        attack(`${id}-${side}-bar`, { rotationY: s * 6 }, { rotationY: -s * 24 })
        const anchor = [s < 0 ? .91 : .10, .03], hinge = [s < 0 ? .4 : .6, s < 0 ? .50 : .30]
        split(`${id}-${side}-cloth`, `${label}${sideLabel}咒幡`, cloth, id, [s * 23 * factor, -3 * factor, -1], .34 * factor,
          [anchor, hinge], [[0, 0, 1, s < 0 ? .57 : .37], [0, s < 0 ? .47 : .29, 1, s < 0 ? .53 : .71]], s)
      }
      j(`${id}-tassel`, `${label}垂铃`, `${id}-cage`, [0, -23 * factor, .6])
      art(`${id}-tassel-art`, `${label}垂铃咒穗`, 23, `${id}-tassel`, .4 * factor, [.5, .03], { layer: 8 })
      j(`${id}-flame`, `${label}逸焰`, `${id}-core`, [6 * factor, 10 * factor, -1])
      art(`${id}-flame-art`, `${label}逸焰`, 26, `${id}-flame`, .25 * factor, [.5, .8], { layer: 6 })
      motion(id, sign, 6); motion(`${id}-cage`, -sign, 7); motion(`${id}-core`, sign, 5)
      motion(`${id}-tassel`, -sign, 14); motion(`${id}-flame`, sign, 12)
      attack(id, { rotationZ: -sign * 12, rotationX: -9 }, { rotationZ: sign * 16, rotationX: 10 })
      attack(`${id}-flame`, { rotationZ: -sign * 19 }, { rotationZ: sign * 25, rotationY: sign * 14 })
      keys(p, 'death', id, [[0, {}], [.4, { rotationZ: sign * 12 }], [1, { rotationZ: sign * 34, rotationX: 18 }]])
    }
  }

  if (p.enemyId === 'drown-shadow-hunter') {
    art('rib-cage', '猎手胸肋与腰脊', 11, 'root', .30, [.5, .18], { layer: 7 })
    j('neck', '猎手颈椎', 'root', [0, 12, 4])
    art('neck-art', '猎手颈椎', 1, 'neck', .25, [.5, .93], { crop: [.23, .48, .54, .52], layer: 7 })
    link('head', '猎手头', 'neck', 1, .25, [.5, .93], [.5, .44], 3)
    art('head-art', '猎手颅骨与湿发', 1, 'head', .25, [.5, .44], { crop: [0, 0, 1, .58], layer: 10 })
    j('jaw', '猎手下颌', 'head', [0, -5, 1])
    art('jaw-art', '猎手下颌', 7, 'jaw', .23, [.5, .13], { layer: 11 })
    j('pelvis', '猎手骨盆', 'root', [0, -72, -4])
    art('pelvis-art', '猎手骨盆', 20, 'pelvis', .26, [.5, .16], { layer: 6 })
    motion('neck', 1, 3); motion('head', -1, 5); motion('jaw', 1, 4); motion('pelvis', -1, 4)
    j('left-shoulder', '左肩', 'root', [-31, 9, -10])
    art('left-upper-arm', '左上臂', 10, 'left-shoulder', .27, [.5, .08], { layer: 5 })
    link('left-elbow', '左肘', 'left-shoulder', 10, .27, [.5, .08], [.5, .92])
    art('left-forearm', '左前臂', 12, 'left-elbow', .23, [.26, .07], { crop: [0, 0, 1, .48], layer: 6 })
    link('left-wrist', '左腕', 'left-elbow', 12, .23, [.26, .07], [.57, .45])
    art('left-claw', '左手爪', 12, 'left-wrist', .23, [.57, .45], { crop: [0, .37, 1, .63], layer: 7 })
    const hand = split('right-arm', '右持镰臂', 8, 'root', [31, 9, 12], .20,
      [[.38, .05], [.41, .30], [.51, .75]], [[0, 0, 1, .35], [0, .28, 1, .52], [0, .70, 1, .30]], 1)
    for (const [id, sign, amp] of [['left-shoulder', -1, 13], ['left-elbow', 1, 16], ['left-wrist', -1, 10]]) {
      motion(id, sign, amp); gait(id, sign, amp)
    }
    j('scythe', '钩镰枢轴', hand, [0, -12, 5], { rotationZ: -8 })
    art('scythe-art', '溺影钩镰', 2, 'scythe', .18, [.55, .48], { layer: 11 })
    motion('scythe', -1, 7)
    attack('right-arm', { rotationZ: -24, rotationY: -18 }, { rotationZ: 32, rotationY: 27 })
    attack('right-arm-hinge-1', { rotationZ: -19 }, { rotationZ: 25 })
    attack('scythe', { rotationZ: -27, rotationY: -17 }, { rotationZ: 38, rotationY: 21 })
    for (const [side, sign, thigh, shin, foot, cape] of [['left', -1, 14, 19, 23, 3], ['right', 1, 13, 18, 22, 4]]) {
      const label = sign < 0 ? '左' : '右'
      const thighTop = [sign < 0 ? .63 : .35, .10], thighBottom = [sign < 0 ? .22 : .80, .91]
      const shinTop = [sign < 0 ? .47 : .50, .07], shinBottom = [sign < 0 ? .72 : .43, .90]
      j(`${side}-hip`, `${label}髋`, 'pelvis', [sign * 18, -15, sign * 6])
      art(`${side}-thigh-art`, `${label}大腿`, thigh, `${side}-hip`, .25, thighTop, { layer: 5 })
      link(`${side}-knee`, `${label}膝`, `${side}-hip`, thigh, .25, thighTop, thighBottom)
      art(`${side}-shin-art`, `${label}胫骨`, shin, `${side}-knee`, .26, shinTop, { layer: 6 })
      link(`${side}-ankle`, `${label}踝`, `${side}-knee`, shin, .26, shinTop, shinBottom)
      art(`${side}-foot-art`, `${label}足爪`, foot, `${side}-ankle`, .24, [sign < 0 ? .66 : .23, .10], { layer: 7 })
      motion(`${side}-hip`, sign, 6); motion(`${side}-knee`, -sign, 9); motion(`${side}-ankle`, sign, 5)
      gait(`${side}-hip`, sign, 14); gait(`${side}-knee`, -sign, 18)
      split(`${side}-cape`, `${label}湿影披缕`, cape, 'root', [sign * 28, 18, -12], .25,
        [[sign < 0 ? .1 : .8, .05], [.5, .5]], [[0, 0, 1, .58], [0, .45, 1, .55]], -sign)
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
