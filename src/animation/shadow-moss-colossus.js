// Build around the cut anatomy: a chest face, four unlike arms and a parasitic
// tree. Rear anatomy is offset sideways so it remains visible from the front.
export function buildMossColossus(p, { joint, imagePart, pixelLink, organMotion }) {
  const j = (id, name, parent, xyz, pose = {}) => {
    joint(p, id, name, parent, ...xyz)
    Object.assign(p.joints.find(v => v.id === id), pose)
  }
  const art = (id, name, n, target, scale, pivot, options = {}) => imagePart(p, id, name, n, target, scale, pivot, options)
  const link = (id, name, parent, n, scale, from, to) => pixelLink(p, id, name, parent, n, scale, from, to, .25)
  const motion = (id, sign, amount = 6) => organMotion(p, id, sign, amount)

  art('torso', '胸中石面与苔石胸腔', 1, 'root', .34, [.5, .42], { layer: 7 })
  j('exposed-spine', '侧露根脊', 'root', [-61, 27, -2], { rotationZ: -12 })
  art('spine', '侧露苔骨脊', 3, 'exposed-spine', .22, [.5, .20], { layer: 3 })
  motion('exposed-spine', -1, 3)
  j('neck', '石颈', 'root', [0, 57, 1])
  j('head', '石面', 'neck', [0, 5, .5])
  art('head-art', '石面', 4, 'head', .23, [.5, .80], { layer: 10 })
  j('jaw', '独立石颌', 'head', [0, -6, .5])
  art('jaw-art', '独立齿列石颌', 6, 'jaw', .23, [.5, .14], { layer: 11 })
  motion('neck', 1, 3); motion('head', -1, 4); motion('jaw', 1, 5)
  j('pelvis', '苔石髋壳', 'root', [0, -77, -.5])
  art('pelvis-art', '苔石髋壳', 5, 'pelvis', .28, [.5, .10], { layer: 6 })

  const arm = (id, name, n, sign, xyz, scale, anchors, crops, angle) => {
    j(`${id}-shoulder`, `${name}肩`, 'root', xyz, { rotationZ: sign * angle, scaleX: sign })
    let target = `${id}-shoulder`
    for (let i = 0; i < anchors.length; i++) {
      if (i) {
        const next = `${id}-${i === 1 ? 'elbow' : 'wrist'}`
        link(next, `${name}${i === 1 ? '肘' : '腕'}`, target, n, scale, anchors[i - 1], anchors[i])
        target = next
      }
      art(`${id}-${['upper', 'forearm', 'hand'][i]}`, `${name}${['上臂', '前臂', '手'][i]}`, n, target, scale, anchors[i], { crop: crops[i], layer: 8 + i })
      motion(target, i % 2 ? -sign : sign, i ? 8 : 10)
    }
    return target
  }
  const stump = arm('left-arm', '左上石臂', 7, 1, [57, 27, 2], .28,
    [[.51, .10], [.52, .49], [.64, .87]], [[0, 0, 1, .56], [0, .43, 1, .50], [0, .83, 1, .17]], 27)
  art('left-root-hand', '左上分根手', 22, stump, .23, [.48, .10], { layer: 11, z: .3 })
  arm('right-arm', '右上石爪臂', 9, -1, [-57, 27, 2], .30,
    [[.28, .13], [.54, .50], [.65, .80]], [[0, 0, 1, .57], [0, .44, 1, .42], [0, .74, 1, .26]], 27)
  arm('left-secondary', '左下石爪臂', 8, 1, [55, -42, 3], .27,
    [[.47, .10], [.45, .48], [.58, .70]], [[0, 0, 1, .55], [0, .42, 1, .36], [0, .64, 1, .36]], 32)
  const rootHand = arm('right-secondary', '右下垂根臂', 10, -1, [-55, -42, 3], .27,
    [[.29, .10], [.52, .45], [.53, .63]], [[0, 0, 1, .52], [0, .39, 1, .31], [0, .57, 1, .43]], 32)
  j('hand-root-fork', '手背分根', rootHand, [12, -12, -.3], { rotationZ: 32 })
  art('hand-root-fork-art', '外露手背分根', 23, 'hand-root-fork', .20, [.34, .12], { layer: 9 })
  motion('hand-root-fork', -1)
  for (const [side, sign, n] of [['left', 1, 12], ['right', -1, 13]]) {
    // Plates share the torso sockets, rather than swinging over all four arms.
    j(`${side}-stone-plate`, '上肩苔石甲', 'root', [sign * 55, 38, 3], { rotationZ: sign * 14 })
    art(`${side}-pauldron`, '上肩苔石甲', n, `${side}-stone-plate`, .25, [.5, .30], { layer: 10 })
  }
  for (const [side, sign, leg, foot, scale] of [['left', 1, 14, 20, .24], ['right', -1, 15, 21, .26]]) {
    const anchors = [[.5, .10], [.49, .42], [.52, .78]]
    j(`${side}-leg-root`, '苔石髋节', 'pelvis', [sign * 26, -58, 1])
    art(`${side}-leg-upper`, '苔石腿上段', leg, `${side}-leg-root`, scale, anchors[0], { crop: [0, 0, 1, .49], layer: 5 })
    link(`${side}-leg-hinge`, '苔石膝', `${side}-leg-root`, leg, scale, anchors[0], anchors[1])
    art(`${side}-leg-lower`, '苔石腿下段', leg, `${side}-leg-hinge`, scale, anchors[1], { crop: [0, .36, 1, .46], layer: 6 })
    link(`${side}-leg-tip`, '苔石踝', `${side}-leg-hinge`, leg, scale, anchors[1], anchors[2])
    art(`${side}-foot`, foot === 20 ? '磨损石盘足' : '苔石趾足', foot, `${side}-leg-tip`, foot === 20 ? .22 : .27, [.5, .10], { layer: 8, z: .3 })
    for (const [suffix, amount] of [['root', 7], ['hinge', 9], ['tip', 4]]) motion(`${side}-leg-${suffix}`, sign, amount)
  }
  j('shoulder-tree', '肩上寄树干', 'right-stone-plate', [-5, 5, -1])
  art('shoulder-tree-art', '肩上寄树干', 2, 'shoulder-tree', .23, [.62, .85], { crop: [0, .30, 1, .70], layer: 4 })
  link('tree-canopy', '寄树冠分叉', 'shoulder-tree', 2, .23, [.62, .85], [.52, .34])
  art('tree-canopy-art', '展开寄树冠', 11, 'tree-canopy', .27, [.55, .88], { layer: 5 })
  motion('shoulder-tree', -1, 3); motion('tree-canopy', 1, 4)
  for (const [i, n, x, y] of [[0, 16, -44, -13], [1, 17, -12, -57], [2, 18, 13, -56], [3, 19, 46, -10]]) {
    j(`root-tassel-${i}`, `外露垂根${i + 1}`, 'pelvis', [x, y, 3.5])
    art(`root-tassel-${i}-art`, `外露垂根${i + 1}`, n, `root-tassel-${i}`, .22, [.5, .08], { layer: 9 })
    motion(`root-tassel-${i}`, x > 0 ? 1 : -1, 7)
  }
}
