import assets from './enemy-component-assets.json' with { type: 'json' }
import { createDefaultShadowProject } from './shadow-rig.js'

export const BATCH5_COMPONENT_ENEMY_IDS = Object.freeze([
  'patrol-hound', 'redneedle-salamander', 'rot-sac-toad', 'claw-beast',
  'broodmother', 'molten-core-beast', 'redwheel-fire-crow',
  'tide-rite-matriarch', 'overseer',
])

// V27: apply once to templates and existing component rigs.
export function adjustPatrolHoundRig(project) {
  if (project.enemyId !== 'patrol-hound') return
  const joints = new Map(project.joints.map(joint => [joint.id, joint]))
  const parts = new Map(project.parts.map(part => [part.id, part]))
  const haunch = joints.get('haunch')
  const neck = joints.get('neck')
  if (haunch) haunch.z -= 16
  if (neck) neck.z += 8
  const back = parts.get('back')
  if (back && haunch) {
    // The long Y axis runs toward the front along the root/haunch segment.
    back.rotationX = Math.atan2(-haunch.z, -haunch.y) * 180 / Math.PI
    back.height *= 1.18
    back.y = 24
    back.z = -26
  }
  for (const side of ['left', 'right']) for (const end of ['front', 'hind']) {
    const hip = joints.get(`${side}-${end}-hip`)
    const knee = joints.get(`${side}-${end}-knee`)
    const paw = joints.get(`${side}-${end}-paw`)
    const bend = end === 'front' ? 18 : -24
    if (hip) {
      hip.rotationX += bend
      if (end === 'front') hip.z += 6
    }
    if (knee) knee.rotationX -= bend * 2
    if (paw) paw.rotationX += bend
  }
  for (const [side, turn] of [['left', -5], ['right', 5]]) {
    const face = parts.get(`${side}-face`)
    if (face) {
      face.rotationY += turn
      face.z += 1.2
    }
  }
  const nose = parts.get('nose')
  if (nose) nose.z += 1.2
}

// V28: map the single spine texture along the neck, trunk and tail bones.
export function adjustSalamanderBody(project) {
  if (project.enemyId !== 'redneedle-salamander') return
  const chest = project.parts.find(part => part.id === 'chest')
  if (chest) Object.assign(chest, { rotationX: 90, y: -12, z: 0 })
  const back = project.parts.find(part => part.id === 'back')
  const joints = new Map(project.joints.map(joint => [joint.id, joint]))
  const segments = [
    { id: 'back', to: 'neck', turn: -90, pivot: 1 },
    { id: 'back-mid', to: 'haunch', turn: 90, pivot: 0 },
    { id: 'back-tail', to: 'tail', turn: 90, pivot: 0 },
  ].map(segment => ({ ...segment, joint: joints.get(segment.to), bone: project.bones.find(bone => bone.toJointId === segment.to) }))
  if (!back || segments.some(segment => !segment.joint || !segment.bone)) return
  const source = JSON.parse(JSON.stringify(back))
  const crop = source.visual.textureFrame.crop || { left: 0, top: 0, width: 1, height: 1 }
  const lengths = segments.map(({ joint }) => Math.hypot(joint.x, joint.y, joint.z))
  const total = lengths.reduce((sum, length) => sum + length, 0)
  let start = 0
  for (const [i, segment] of segments.entries()) {
    const fraction = lengths[i] / total
    const part = i === 0 ? back : JSON.parse(JSON.stringify(source))
    Object.assign(part, { id: segment.id, name: `${source.name} ${i + 1}`, x: 0, y: 0, z: 0,
      height: lengths[i], pivotY: segment.pivot, rotationX: 90, rotationY: 0, rotationZ: segment.turn,
      attachment: { type: 'bone', targetId: segment.bone.id, t: 0, followRotation: true },
    })
    part.visual.textureFrame.crop = { ...crop, top: crop.top + start * crop.height, height: fraction * crop.height }
    if (i > 0) {
      project.parts.push(part)
      for (const animation of Object.values(project.animations)) {
        if (animation.tracks['part:back']) animation.tracks[`part:${part.id}`] = JSON.parse(JSON.stringify(animation.tracks['part:back']))
      }
    }
    start += fraction
  }
}

// V33: the rib shell shares the spine's surface and its animated bone chain.
export function alignSalamanderChest(project) {
  if (project.enemyId !== 'redneedle-salamander') return
  const chest = project.parts.find(part => part.id === 'chest')
  const spine = ['back', 'back-mid'].map(id => project.parts.find(part => part.id === id))
  if (!chest || spine.some(part => !part)) return
  const source = JSON.parse(JSON.stringify(chest))
  const crop = source.visual.textureFrame.crop || { left: 0, top: 0, width: 1, height: 1 }
  const total = spine.reduce((sum, part) => sum + part.height, 0)
  let start = 0
  for (const [i, segment] of spine.entries()) {
    const id = i === 0 ? 'chest' : 'chest-rear'
    const part = i === 0 ? chest : JSON.parse(JSON.stringify(source))
    Object.assign(part, { id, name: `${source.name} ${i + 1}`, x: 0, y: .4, z: 0,
      height: segment.height, pivotY: segment.pivotY,
      rotationX: segment.rotationX, rotationY: segment.rotationY, rotationZ: segment.rotationZ,
      attachment: { ...segment.attachment },
    })
    const fraction = segment.height / total
    part.visual.textureFrame.crop = { ...crop, top: crop.top + start * crop.height, height: fraction * crop.height }
    if (i > 0) {
      project.parts.push(part)
      for (const animation of Object.values(project.animations)) {
        if (animation.tracks['part:chest']) animation.tracks[`part:${id}`] = JSON.parse(JSON.stringify(animation.tracks['part:chest']))
      }
    }
    start += fraction
  }
}

// V34: slope the back down toward the rump and lift the face/jaw together.
export function adjustRotSacToadPose(project) {
  if (project.enemyId !== 'rot-sac-toad') return
  const back = project.parts.find(part => part.id === 'back')
  const haunch = project.joints.find(joint => joint.id === 'haunch')
  if (back && haunch) back.rotationX = Math.atan2(-haunch.z, -haunch.y) * 180 / Math.PI
  const head = project.joints.find(joint => joint.id === 'head')
  if (head) head.rotationX -= 8
}

// A short set of independent textures carries the anatomy. Eyes already
// painted on a face are not overlaid with another set of eyes.
export function applyEnemyComponentBatch5(p, { joint, imagePart, pixelLink, keys, organMotion }) {
  if (!BATCH5_COMPONENT_ENEMY_IDS.includes(p.enemyId)) return false
  p.joints = []; p.bones = []; p.parts = []
  p.animations = createDefaultShadowProject().animations
  delete p.grounding
  const j = (id, name, parent, xyz, pose = {}) => {
    joint(p, id, name, parent, ...xyz)
    Object.assign(p.joints.find(v => v.id === id), pose)
  }
  const scale = (n, size) => size / Math.max(assets[p.enemyId].parts[n].width, assets[p.enemyId].parts[n].height)
  const art = (id, name, n, parent, size, pivot = [.5, .5], options = {}) =>
    imagePart(p, id, name, n, parent, scale(n, size), pivot, options)
  const motion = (id, sign = 1, amplitude = 5) => organMotion(p, id, sign, amplitude)
  const attack = (id, prepare, release) => keys(p, 'attack', id, [[0, {}], [.27, prepare], [.64, release], [1, {}]])
  const gait = (id, phase, angle = 18) => keys(p, 'move', id,
    [[0, {}], [.25, { rotationX: phase * angle }], [.75, { rotationX: -phase * angle }], [1, {}]])
  j('root', '主体', null, [0, 0, 0], { rotationY: -30 })

  const limb = (id, name, parent, xyz, numbers, lengths, phase, mirror = false) => {
    const [upper, lower, foot] = numbers, [upperSize, lowerSize, footSize] = lengths
    const turn = mirror ? 180 : 0
    j(`${id}-hip`, `${name}肢根`, parent, xyz)
    art(`${id}-upper`, `${name}上肢`, upper, `${id}-hip`, upperSize, [.5, .08], { rotationY: turn, layer: 5 })
    pixelLink(p, `${id}-knee`, `${name}膝`, `${id}-hip`, upper, scale(upper, upperSize), [.5, .08], [.5, .9])
    art(`${id}-lower`, `${name}下肢`, lower, `${id}-knee`, lowerSize, [.5, .08], { rotationY: turn, layer: 6, z: .3 })
    pixelLink(p, `${id}-paw`, `${name}踝`, `${id}-knee`, lower, scale(lower, lowerSize), [.5, .08], [.5, .91])
    art(`${id}-foot`, `${name}足爪`, foot, `${id}-paw`, footSize, [.5, .12], { rotationY: turn, layer: 7, z: .6 })
    gait(`${id}-hip`, phase); gait(`${id}-knee`, -phase, 22)
    keys(p, 'hit', `${id}-hip`, [[0, {}], [.3, { rotationX: phase * 7 }], [1, {}]])
    keys(p, 'death', `${id}-knee`, [[0, {}], [.4, { rotationX: phase * 8 }], [1, { rotationX: phase * 32 }]])
  }

  const frontFace = (size, jawSize, neckPosition = [0, 24, 44]) => {
    j('neck', '颈', 'root', neckPosition)
    j('head', '头', 'neck', [0, 18, 24])
    art('head-art', '面部', 1, 'head', size, [.5, .65], { layer: 10 })
    j('jaw', '下颌', 'head', [0, -size * .16, 2])
    art('jaw-art', '下颌', 2, 'jaw', jawSize, [.5, .15], { layer: 11, z: .4 })
    motion('neck', 1, 3); motion('head', -1, 3)
    attack('neck', { rotationX: -9 }, { rotationX: 13 })
    attack('jaw', { rotationX: 20 }, { rotationX: -3 })
  }

  const foldedFace = (size, jawSize) => {
    j('neck', '长吻颈', 'root', [0, 24, 38])
    j('head', '面部中折线', 'neck', [0, 21, 47])
    // Both sides meet at the nose ridge, extending backwards in Z. The
    // opposite face uses the back of the same double-sided plane: identical
    // texture, mirrored silhouette, and one shared animated head transform.
    for (const [side, turn] of [['left', -62], ['right', -118]]) {
      art(`${side}-face`, `${side === 'left' ? '左' : '右'}折面脸`, 1, 'head', size, [.97, .64], { rotationY: turn, layer: 10 })
    }
    j('jaw', '下颌后铰链', 'head', [0, -9, -jawSize * .84])
    for (const [side, turn] of [['left', -62], ['right', -118]]) {
      art(`${side}-jaw`, `${side === 'left' ? '左' : '右'}折面下颌`, 2, 'jaw', jawSize, [.97, .55],
        { z: jawSize * .84, rotationY: turn, layer: 11 })
    }
    motion('neck', 1, 3); motion('head', -1, 3)
    attack('neck', { rotationX: -7 }, { rotationX: 12 })
    attack('jaw', { rotationX: 24 }, { rotationX: -3 })
  }

  const quadruped = ({ body = 110, head = 88, lengths = [53, 49, 33], hind = true } = {}) => {
    art('chest', '胸腹', 3, 'root', body, [.5, .45], { layer: 6 })
    art('back', '背脊', 4, 'root', body * 1.1, [.5, .4], { rotationX: -72, y: 26, z: -15, layer: 5 })
    j('haunch', '后身', 'root', [0, -8, -54])
    art('rump', '后身甲', 5, 'haunch', body * .68, [.5, .45], { rotationX: -28, layer: 4 })
    if (p.enemyId === 'patrol-hound') foldedFace(head, head * .8)
    else frontFace(head, head * .64)
    for (const [side, sign, label] of [['left', -1, '左'], ['right', 1, '右']]) {
      limb(`${side}-front`, `${label}前`, 'root', [sign * body * .32, -23, 26], [6, 7, 8], lengths, sign, sign > 0)
      if (hind) limb(`${side}-hind`, `${label}后`, 'haunch', [sign * body * .28, -22, -7], [9, 10, p.enemyId === 'rot-sac-toad' ? 16 : 8],
        [lengths[0] * .96, lengths[1], lengths[2]], -sign, sign > 0)
    }
    if (p.enemyId !== 'rot-sac-toad') {
      j('tail', '尾根', 'haunch', [0, 12, -23], { rotationX: 50 })
      art('tail-art', '尾', p.enemyId === 'claw-beast' ? 12 : 11, 'tail', 80, [.5, .06], { layer: 3 })
      motion('tail', 1, 10)
    }
    motion('haunch', -1, 2)
  }

  if (p.enemyId === 'patrol-hound') {
    quadruped({ head: 92 })
    art('collar', '巡路颈环', 14, 'neck', 69, [.5, .4], { y: -7, z: -13, layer: 8 })
    art('nose', '鼻尖合缝', 15, 'head', 13, [.5, .5], { z: .8, layer: 12 })
    j('bell', '巡铃', 'jaw', [0, -13, 23])
    art('bell-art', '巡铃', 12, 'bell', 32, [.5, .05], { layer: 9 })
    motion('bell', -1, 9)
    for (const [side, sign, label] of [['left', -1, '左'], ['right', 1, '右']]) {
      j(`${side}-ear`, `${label}耳`, 'head', [sign * 24, 17, -63], { rotationZ: -sign * 15 })
      art(`${side}-ear-art`, `${label}耳`, 16, `${side}-ear`, 35, [.5, .93], { layer: 8 })
      j(`${side}-scent`, `${label}香烟须`, 'neck', [sign * 24, 0, 15], { rotationZ: sign * 35, rotationY: sign * 18 })
      art(`${side}-scent-art`, `${label}香烟须`, 13, `${side}-scent`, 59, [.5, .05], { layer: 8 })
      motion(`${side}-ear`, sign, 5); motion(`${side}-scent`, -sign, 9)
    }
  }

  if (p.enemyId === 'redneedle-salamander') {
    quadruped({ body: 101, head: 82, lengths: [27, 22, 27] })
    Object.assign(p.joints.find(j => j.id === 'neck'), { y: 12 })
    Object.assign(p.joints.find(j => j.id === 'head'), { y: 8 })
    for (let i = 0; i < 3; i++) {
      j(`needle-${i}`, `赤针${i + 1}根`, 'root', [0, 29, 19 - i * 34], { rotationX: -12 })
      art(`needle-${i}-art`, `赤针${i + 1}`, 13 + i, `needle-${i}`, 56 + i * 5, [.5, .92], { layer: 8 })
      motion(`needle-${i}`, i % 2 ? -1 : 1, 5)
      attack(`needle-${i}`, { rotationX: -20 }, { rotationX: 24 })
    }
  }

  if (p.enemyId === 'rot-sac-toad') {
    quadruped({ body: 132, head: 99, lengths: [30, 26, 35] })
    j('throat', '喉囊', 'neck', [0, -18, 0])
    art('throat-art', '喉囊', 14, 'throat', 49, [.5, .35], { layer: 9 })
    motion('throat', 1, 3)
    for (const [side, sign, label] of [['left', -1, '左'], ['right', 1, '右']]) {
      j(`${side}-sac`, `${label}腐囊`, 'neck', [sign * 44, 6, -15], { rotationZ: -sign * 12 })
      art(`${side}-sac-art`, `${label}腐囊`, 13, `${side}-sac`, 69, [.5, .1], { layer: 7, rotationY: sign > 0 ? 180 : 0 })
      motion(`${side}-sac`, sign, 5)
      attack(`${side}-sac`, { rotationZ: sign * 5 }, { rotationZ: -sign * 15, rotationY: sign * 12 })
    }
    j('tongue', '弹舌根', 'jaw', [0, -3, 5], { rotationX: -90 })
    art('tongue-art', '弹舌', 11, 'tongue', 115, [.5, .03], { layer: 12 })
    pixelLink(p, 'tongue-tip', '舌尖', 'tongue', 11, scale(11, 115), [.5, .03], [.5, .95])
    art('tongue-tip-art', '舌尖倒钩', 15, 'tongue-tip', 26, [.5, .05], { layer: 12 })
    // Fold the withdrawn tongue backwards, hiding it inside the mouth. The
    // attack arc goes above the ground instead of sweeping below the feet.
    for (const action of ['idle', 'move', 'hit', 'death']) keys(p, action, 'tongue', [[0, { rotationX: -180 }], [1, { rotationX: -180 }]])
    keys(p, 'attack', 'tongue', [[0, { rotationX: -180 }], [.27, { rotationX: -180 }], [.64, {}], [1, { rotationX: -180 }]])
    for (const id of ['tongue-art', 'tongue-tip-art']) {
      for (const action of ['idle', 'move', 'hit', 'death']) keys(p, action, id, [[0, { opacity: 0 }], [1, { opacity: 0 }]], 'part')
      keys(p, 'attack', id, [[0, { opacity: 0 }], [.27, { opacity: 0 }], [.46, { opacity: 1 }], [.76, { opacity: 1 }], [.92, { opacity: 0 }], [1, { opacity: 0 }]], 'part')
    }
  }

  if (p.enemyId === 'claw-beast') {
    quadruped({ body: 120, head: 91, lengths: [69, 61, 56], hind: false })
    for (const [side, sign, label] of [['left', -1, '左'], ['right', 1, '右']]) {
      j(`${side}-fin`, `${label}拖潮鳍`, 'haunch', [sign * 26, 7, -8], { rotationX: 65, rotationZ: -sign * 16 })
      art(`${side}-fin-art`, `${label}拖潮鳍`, 11, `${side}-fin`, 99, [.5, .06], { layer: 3, rotationY: sign > 0 ? 180 : 0 })
      motion(`${side}-fin`, sign, 8)
      j(`${side}-claw`, `${label}溺爪巨指`, `${side}-front-paw`, [sign * 16, 1, 3], { rotationZ: -sign * 28 })
      art(`${side}-claw-art`, `${label}溺爪巨指`, 9, `${side}-claw`, 42, [.5, .07], { layer: 8, rotationY: sign > 0 ? 180 : 0 })
      attack(`${side}-front-hip`, { rotationX: -sign * 12 }, { rotationX: sign * 22 })
      attack(`${side}-claw`, { rotationZ: sign * 13 }, { rotationZ: -sign * 22 })
    }
    j('keel', '腹下水鳍', 'haunch', [0, -12, -12], { rotationX: 70 })
    art('keel-art', '腹下水鳍', 10, 'keel', 80, [.5, .05], { layer: 3 })
    motion('keel', -1, 6)
  }

  if (p.enemyId === 'molten-core-beast') {
    quadruped({ body: 139, head: 96, lengths: [42, 37, 40] })
    for (const [side, sign, label] of [['left', -1, '左'], ['right', 1, '右']]) {
      j(`${side}-lung`, `${label}熔核肺囊`, 'root', [sign * 54, 39, -9], { rotationZ: -sign * 17 })
      art(`${side}-lung-art`, `${label}熔核肺囊`, sign < 0 ? 13 : 14, `${side}-lung`, 94, [.5, .07], { layer: 7 })
      motion(`${side}-lung`, sign, 6)
      attack(`${side}-lung`, { rotationY: -sign * 9 }, { rotationY: sign * 18, rotationZ: -sign * 12 })
      limb(`${side}-auxiliary`, `${label}副`, 'root', [sign * 33, -35, -16], [6, 7, 8], [29, 30, 29], -sign)
    }
    j('dorsal', '熔脊', 'root', [0, 35, -32])
    art('dorsal-art', '熔脊', 15, 'dorsal', 64, [.5, .92], { layer: 8 })
    motion('dorsal', 1, 5)
  }

  if (p.enemyId === 'broodmother') {
    art('abdomen', '裂腹育巢', 4, 'root', 175, [.5, .45], { layer: 5 })
    j('thorax', '小胸节', 'root', [0, 31, 11])
    art('thorax-art', '小胸节', 3, 'thorax', 58, [.5, .45], { layer: 7 })
    j('head', '虫首', 'thorax', [0, 30, 14])
    art('head-art', '虫首', 1, 'head', 66, [.5, .65], { layer: 9 })
    motion('head', -1, 5)
    j('larva', '腹内幼首', 'root', [0, -9, 3])
    art('larva-art', '腹内幼首', 7, 'larva', 57, [.5, .4], { layer: 8 })
    j('larva-mouth', '幼首噬口', 'larva', [0, -16, 1])
    art('larva-mouth-art', '幼首噬口', 8, 'larva-mouth', 29, [.5, .5], { layer: 9 })
    motion('larva', 1, 5); motion('larva-mouth', -1, 5)
    for (const [side, sign, label, door] of [['left', -1, '左', 5], ['right', 1, '右', 6]]) {
      j(`${side}-door`, `${label}育门铰链`, 'root', [sign * 37, 9, 6])
      art(`${side}-door-art`, `${label}裂腹育门`, door, `${side}-door`, 124, [sign < 0 ? .12 : .88, .4], { layer: 10 })
      keys(p, 'idle', `${side}-door`, [[0, {}], [.55, { rotationY: -sign * 8 }], [1, {}]])
      attack(`${side}-door`, { rotationY: sign * 7 }, { rotationY: -sign * 72 })
      keys(p, 'move', `${side}-door`, [[0, {}], [.5, { rotationY: -sign * 12 }], [1, {}]])
      keys(p, 'hit', `${side}-door`, [[0, {}], [.3, { rotationY: -sign * 27 }], [1, {}]])
      keys(p, 'death', `${side}-door`, [[0, {}], [1, { rotationY: -sign * 90 }]])
      j(`${side}-jaw`, `${label}颚`, 'head', [sign * 17, -9, 4], { rotationZ: -sign * 18 })
      art(`${side}-jaw-art`, `${label}锯颚`, 2, `${side}-jaw`, 36, [.5, .05], { layer: 10, rotationY: sign > 0 ? 180 : 0 })
      motion(`${side}-jaw`, sign, 9)
      for (let i = 0; i < 2; i++) limb(`${side}-leg-${i}`, `${label}后足${i + 1}`, 'root', [sign * (43 + i * 7), -42, -16 - i * 27],
        [9, 10, 11], [45, 43, 30], sign * (i ? -1 : 1), sign > 0)
      limb(`${side}-pillar`, `${label}育巢支柱`, 'root', [sign * 34, -46, 21], [12, 10, 11], [42, 42, 30], -sign, sign > 0)
      j(`${side}-egg`, `${label}卵柄`, 'root', [sign * 62, 5, -7], { rotationZ: -sign * 17 })
      art(`${side}-egg-stalk`, `${label}卵柄`, 14, `${side}-egg`, 40, [.5, .06], { layer: 3 })
      pixelLink(p, `${side}-egg-sac`, `${label}卵囊根`, `${side}-egg`, 14, scale(14, 40), [.5, .06], [.5, .9])
      art(`${side}-egg-art`, `${label}卵囊`, 13, `${side}-egg-sac`, 51, [.5, .05], { layer: 4 })
      motion(`${side}-egg`, sign, 8); motion(`${side}-egg-sac`, -sign, 5)
    }
    attack('larva', { rotationX: -10 }, { rotationX: 17 })
  }

  if (p.enemyId === 'redwheel-fire-crow') {
    art('breast', '胸羽', 3, 'root', 106, [.5, .35], { layer: 6 })
    art('back', '背羽', 4, 'root', 88, [.5, .3], { z: -2, layer: 4 })
    foldedFace(77, 59)
    for (const [side, sign, label] of [['left', -1, '左'], ['right', 1, '右']]) {
      j(`${side}-wing`, `${label}翼根`, 'root', [sign * 28, 28, sign * 9], { rotationZ: sign * 67 })
      art(`${side}-inner-wing`, `${label}内翼`, 5, `${side}-wing`, 68, [.5, .07], { layer: 4, rotationY: sign > 0 ? 180 : 0 })
      pixelLink(p, `${side}-wing-tip`, `${label}翼肘`, `${side}-wing`, 5, scale(5, 68), [.5, .07], [.5, .91])
      art(`${side}-outer-wing`, `${label}外翼`, 6, `${side}-wing-tip`, 83, [.5, .07], { layer: 5, rotationY: sign > 0 ? 180 : 0 })
      for (const [id, amp] of [[`${side}-wing`, 11], [`${side}-wing-tip`, 16]]) {
        motion(id, sign, amp)
        keys(p, 'idle', id, [[0, { rotationX: -amp }], [.5, { rotationX: amp }], [1, { rotationX: -amp }]])
        keys(p, 'move', id, [[0, { rotationX: -amp * 1.5 }], [.25, { rotationX: amp * 1.5 }], [.5, { rotationX: -amp * 1.5 }], [.75, { rotationX: amp * 1.5 }], [1, { rotationX: -amp * 1.5 }]])
      }
      j(`${side}-leg`, `${label}悬足`, 'root', [sign * 15, -41, 3])
      art(`${side}-leg-art`, `${label}鸟胫`, 7, `${side}-leg`, 42, [.5, .08], { layer: 6 })
      pixelLink(p, `${side}-paw`, `${label}鸟踝`, `${side}-leg`, 7, scale(7, 42), [.5, .08], [.5, .91])
      art(`${side}-foot`, `${label}鸟爪`, 8, `${side}-paw`, 26, [.5, .1], { layer: 7 })
      motion(`${side}-leg`, sign, 5)
    }
    j('wheel', '赤轮轴', 'root', [0, -29, -13])
    art('wheel-hub', '赤轮核', 9, 'wheel', 30, [.5, .5], { layer: 4 })
    for (let i = 0; i < 4; i++) {
      j(`wheel-spoke-${i}`, `轮羽${i + 1}根`, 'wheel', [0, 0, -.4], { rotationZ: 45 + i * 90 })
      art(`wheel-spoke-${i}-art`, `轮焰羽辐${i + 1}`, [10, 11, 12, 13][i], `wheel-spoke-${i}`, 61, [.5, .94], { layer: 3 })
    }
    keys(p, 'idle', 'wheel', [[0, {}], [1, { rotationZ: 360 }]])
    keys(p, 'move', 'wheel', [[0, {}], [1, { rotationZ: 360 }]])
    attack('wheel', { rotationZ: -25 }, { rotationZ: 130 })
    keys(p, 'hit', 'wheel', [[0, {}], [.3, { rotationZ: -18 }], [1, {}]])
    keys(p, 'death', 'wheel', [[0, {}], [1, { rotationZ: 57 }]])
  }

  if (p.enemyId === 'tide-rite-matriarch') {
    p.joints.find(j => j.id === 'root').scaleX = 1.25
    art('chest', '潮祀胸甲', 3, 'root', 103, [.5, .3], { layer: 7 })
    j('neck', '潮祀颈', 'root', [0, 34, 4])
    j('head', '潮祀面', 'neck', [0, 19, 3])
    art('face', '潮祀面', 1, 'head', 55, [.5, .78], { layer: 10 })
    j('jaw', '潮祀下颌', 'head', [0, -12, .4])
    art('jaw-art', '潮祀下颌', 2, 'jaw', 19, [.5, .15], { layer: 11 })
    art('crown', '召潮冠', 5, 'head', 92, [.5, .6], { y: 20, z: -2, layer: 8 })
    j('skirt', '悬裾根', 'root', [0, -56, -3])
    art('skirt-art', '潮祀悬裾', 4, 'skirt', 126, [.5, .03], { layer: 5 })
    motion('neck', 1, 3); motion('head', -1, 3); motion('skirt', 1, 5)
    const splitArm = (id, label, n, xyz, size, anchors, crops) => {
      j(id, `${label}肩`, 'root', xyz)
      let target = id
      for (let i = 0; i < anchors.length; i++) {
        if (i) {
          const next = `${id}-hinge-${i}`
          pixelLink(p, next, `${label}${i === 1 ? '肘' : '腕'}`, target, n, scale(n, size), anchors[i - 1], anchors[i])
          target = next
        }
        art(`${id}-part-${i}`, `${label}${['上臂', '前臂', '手'][i]}`, n, target, size, anchors[i], { crop: crops[i], layer: 6 + i })
        motion(target, id.startsWith('left') ? -1 : 1, i ? 6 : 4)
      }
      return target
    }
    for (const [side, sign, label, main, prayer, veil] of [['left', -1, '左', 7, 9, 11], ['right', 1, '右', 8, 10, 12]]) {
      const left = sign < 0
      const wrist = splitArm(`${side}-arm`, `${label}主`, main, [sign * 37, 22, sign * 11], 115,
        [[left ? .3 : .6, .10], [left ? .66 : .33, .38], [left ? .89 : .12, .60]],
        [[0, 0, 1, .47], [left ? .40 : 0, .31, .60, .36], [left ? .73 : 0, .53, .27, .27]])
      splitArm(`${side}-prayer`, `${label}副祈`, prayer, [sign * 25, -5, -13], 84,
        [[left ? .39 : .51, .07], [left ? .63 : .34, .42], [left ? .88 : .13, .66]],
        [[0, 0, 1, .5], [left ? .45 : 0, .34, .55, .40], [left ? .73 : 0, .59, .27, .27]])
      j(`${side}-veil`, `${label}潮翼`, 'root', [sign * 35, 9, -10], { rotationY: sign * 20, rotationZ: -sign * 8 })
      art(`${side}-veil-art`, `${label}祭服潮翼`, veil, `${side}-veil`, 145, [left ? .33 : .70, .13], { layer: 3 })
      motion(`${side}-veil`, sign, 7)
      attack(`${side}-arm`, { rotationZ: -sign * 15 }, { rotationZ: sign * 22, rotationX: 12 })
      if (side === 'right') {
        j('staff', '召潮杖', wrist, [0, -4, 3])
        art('staff-art', '召潮杖', 13, 'staff', 165, [.5, .53], { layer: 10, rotationZ: -6 })
        motion('staff', 1, 5)
        attack('staff', { rotationZ: -18 }, { rotationZ: 16, rotationY: 12 })
      }
    }
  }

  if (p.enemyId === 'overseer') {
    art('chest', '监视者胸甲', 3, 'root', 137, [.5, .45], { layer: 7 })
    art('spine', '监视者背脊', 4, 'root', 122, [.5, .35], { z: -4, layer: 3 })
    j('neck', '监视者颈', 'root', [0, 62, 5])
    art('collar', '监视者颈甲', 13, 'neck', 78, [.5, .35], { layer: 8 })
    j('head', '监视者首', 'neck', [0, 23, 4])
    art('head-art', '监视者面甲', 1, 'head', 100, [.5, .78], { layer: 10 })
    j('jaw', '监视者下颌', 'head', [0, -12, 2])
    art('jaw-art', '监视者下颌', 2, 'jaw', 58, [.5, .14], { layer: 11 })
    j('pelvis', '监视者骨盆', 'root', [0, -61, -4])
    art('pelvis-art', '监视者腰甲', 5, 'pelvis', 104, [.5, .13], { layer: 7 })
    for (const [side, sign, label] of [['left', -1, '左'], ['right', 1, '右']]) {
      j(`${side}-shoulder`, `${label}肩`, 'root', [sign * 54, 40, sign * 12])
      art(`${side}-pauldron`, `${label}肩甲`, 12, `${side}-shoulder`, 56, [.5, .15], { layer: 8, rotationY: sign > 0 ? 180 : 0 })
      art(`${side}-upper-arm`, `${label}上臂`, 6, `${side}-shoulder`, 67, [.5, .08], { layer: 5 })
      pixelLink(p, `${side}-elbow`, `${label}肘`, `${side}-shoulder`, 6, scale(6, 67), [.5, .08], [.5, .91])
      art(`${side}-forearm`, `${label}前臂`, 7, `${side}-elbow`, 65, [.5, .08], { layer: 6, z: .4 })
      pixelLink(p, `${side}-wrist`, `${label}腕`, `${side}-elbow`, 7, scale(7, 65), [.5, .08], [.5, .9])
      art(`${side}-fist`, `${label}拳`, 8, `${side}-wrist`, 48, [.5, .08], { layer: 8, z: .5 })
      limb(`${side}-leg`, `${label}腿`, 'pelvis', [sign * 26, -7, sign * 8], [9, 10, 11], [65, 62, 51], sign)
      motion(`${side}-shoulder`, sign, 4); motion(`${side}-elbow`, -sign, 5); motion(`${side}-wrist`, sign, 4)
      attack(`${side}-shoulder`, { rotationX: -32, rotationZ: -sign * 13 }, { rotationX: 38, rotationZ: sign * 19 })
      attack(`${side}-elbow`, { rotationX: -25 }, { rotationX: 19 })
    }
    j('banner', '背幡', 'root', [0, 50, -15])
    art('banner-art', '监视背幡', 14, 'banner', 120, [.5, .05], { layer: 2 })
    motion('banner', -1, 7); motion('head', 1, 3); motion('jaw', -1, 3)
  }

  const floating = ['redwheel-fire-crow', 'tide-rite-matriarch'].includes(p.enemyId)
  keys(p, 'idle', 'root', [[0, {}], [.5, { dy: floating ? 4 : 1.5, rotationX: 1.5 }], [1, {}]])
  keys(p, 'move', 'root', [[0, {}], [.25, { dy: floating ? 6 : 4, rotationZ: -2 }], [.5, {}], [.75, { dy: floating ? -2 : 4, rotationZ: 2 }], [1, {}]])
  attack('root', { rotationX: -5, dz: -6 }, { rotationX: 7, dz: p.enemyId === 'broodmother' ? 5 : 14 })
  keys(p, 'hit', 'root', [[0, {}], [.3, { rotationZ: 7, dx: 5, dz: -8 }], [1, {}]])
  keys(p, 'death', 'root', [[0, {}], [.4, { dy: -9, rotationZ: 9 }], [1, { dy: -29, rotationZ: floating ? 51 : 37, rotationX: 15 }]])
  return true
}
