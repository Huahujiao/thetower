import { createDefaultShadowProject } from './shadow-rig.js'
import { buildMossColossus } from './shadow-moss-colossus.js'

export const BATCH2_COMPONENT_ENEMY_IDS = Object.freeze([
  'rot-walker', 'shellguard', 'wisp', 'moss-colossus', 'sentry-crossbow', 'ash-cannon-bug',
])

// Helpers retain the same PNG pixel scale, crop and parent-local hinge rules
// as the first batch. Rebuild only these six rigs around the actual anatomy.
export function applyEnemyComponentBatch2(p, { joint, imagePart, pixelLink, keys, organMotion }) {
  if (!BATCH2_COMPONENT_ENEMY_IDS.includes(p.enemyId)) return false
  p.joints = []; p.bones = []; p.parts = []
  p.animations = createDefaultShadowProject().animations
  joint(p, 'root', '主体', null, 0, 0, 0)
  p.joints[0].rotationY = -30
  const j = (id, name, parent, xyz) => joint(p, id, name, parent, ...xyz)
  const art = (id, name, n, target, scale, pivot, options) => imagePart(p, id, name, n, target, scale, pivot, options)
  const link = (id, name, parent, n, scale, from, to, z = 0) => pixelLink(p, id, name, parent, n, scale, from, to, z)
  const motion = (id, sign = 1, amplitude = 10) => organMotion(p, id, sign, amplitude)
  const gait = (id, sign, amplitude) => keys(p, 'move', id, [[0, {}], [.25, { rotationZ: sign * amplitude, rotationX: 6 }], [.75, { rotationZ: -sign * amplitude, rotationX: -6 }], [1, {}]])
  const head = (n, scale, origin, position, crop = [0, 0, 1, 1]) => {
    j('neck', '颈环', 'root', position)
    j('head', '头', 'neck', [0, 14, 7])
    art('head-art', '头部', n, 'head', scale, origin, { crop, layer: 10 })
    motion('neck', 1, 5); motion('head', -1, 6)
  }
  const dividedLimb = (prefix, name, n, parent, position, scale, points, crops, sign = 1) => {
    const side = prefix.startsWith('left') ? '左' : prefix.startsWith('right') ? '右' : ''
    const index = /leg-(\d+)$/.exec(prefix)
    name = `${side}${name}${index ? Number(index[1]) + 1 : ''}`
    const [a, b, c] = points
    j(`${prefix}-root`, `${name}根`, parent, position)
    art(`${prefix}-upper`, `${name}上段`, n, `${prefix}-root`, scale, a, { crop: crops[0], layer: sign < 0 ? 4 : 7 })
    link(`${prefix}-hinge`, `${name}中节`, `${prefix}-root`, n, scale, a, b, 2)
    art(`${prefix}-lower`, `${name}下段`, n, `${prefix}-hinge`, scale, b, { crop: crops[1], layer: sign < 0 ? 5 : 8 })
    if (c) {
      link(`${prefix}-tip`, `${name}末节`, `${prefix}-hinge`, n, scale, b, c, .3)
      art(`${prefix}-end`, `${name}末端`, n, `${prefix}-tip`, scale, c, { crop: crops[2], layer: sign < 0 ? 6 : 9 })
      motion(`${prefix}-tip`, -sign, 6)
    }
    motion(`${prefix}-root`, sign, 9); motion(`${prefix}-hinge`, -sign, 11)
    gait(`${prefix}-root`, sign, 14); gait(`${prefix}-hinge`, -sign, 17)
    return c ? `${prefix}-tip` : `${prefix}-hinge`
  }

  if (p.enemyId === 'rot-walker') {
    art('rib-cage', '肋笼与肋间口', 7, 'root', .2, [.5, .25], { crop: [0, 0, 1, .64], layer: 7 })
    link('spine', '腰脊', 'root', 7, .2, [.5, .25], [.5, .60])
    art('spine-art', '腰脊', 7, 'spine', .2, [.5, .60], { crop: [.29, .57, .42, .24], layer: 6 })
    link('pelvis', '骨盆', 'spine', 7, .2, [.5, .60], [.5, .84])
    art('pelvis-art', '腐骨盆', 7, 'pelvis', .2, [.5, .84], { crop: [0, .69, 1, .31], layer: 6 })
    head(1, .22, [.5, .72], [0, 43, 8])
    art('neck-bones', '颈椎搭接', 7, 'neck', .24, [.5, .07], { crop: [.4, 0, .2, .12], y: -10, layer: 6 })
    j('jaw', '腐颌', 'head', [0, -3, 1])
    art('jaw-art', '腐颌', 5, 'jaw', .23, [.5, .25], { layer: 11 })
    motion('jaw', 1, 6); motion('spine', -1, 3)
    keys(p, 'death', 'neck', [[0, {}], [.4, { rotationZ: 3 }], [1, { rotationZ: 8 }]])
    keys(p, 'death', 'head', [[0, {}], [.4, { rotationZ: -3 }], [1, { rotationZ: -6 }]])
    keys(p, 'death', 'jaw', [[0, {}], [.4, { rotationZ: 3 }], [1, { rotationZ: 6 }]])
    for (const [side, sign, upper, hand] of [['left', -1, 2, 9]]) {
      j(`${side}-shoulder`, `${side} 肩`, 'root', [sign * 38, 27, sign * 11])
      art(`${side}-arm`, '腐生上臂', upper, `${side}-shoulder`, .19, [.87, .14], { layer: 5 })
      link(`${side}-elbow`, '肘', `${side}-shoulder`, upper, .19, [.87, .14], [.28, .88], 3)
      art(`${side}-forearm`, '前臂', hand, `${side}-elbow`, .19, [.5, .08], { crop: [0, 0, 1, .67], layer: 6 })
      link(`${side}-wrist`, '腕', `${side}-elbow`, hand, .19, [.5, .08], [.5, .6], .3)
      art(`${side}-claw`, '腐爪', hand, `${side}-wrist`, .19, [.5, .6], { crop: [0, .53, 1, .47], layer: 7 })
      motion(`${side}-shoulder`, sign, 17); motion(`${side}-elbow`, -sign, 20); motion(`${side}-wrist`, sign, 8)
      gait(`${side}-shoulder`, -sign, 13)
    }
    dividedLimb('right-arm', '右腐生臂', 3, 'root', [38, 30, 11], .23,
      [[.17, .22], [.78, .44], [.78, .70]], [[0, 0, 1, .52], [.58, .37, .42, .40], [.57, .63, .43, .37]], 1)
    j('left-hip', '左髋', 'pelvis', [-18, -4, 7])
    art('left-thigh', '残腿大腿', 8, 'left-hip', .19, [.5, .07], { crop: [0, 0, 1, .94], layer: 5 })
    link('left-knee', '左膝', 'left-hip', 8, .19, [.5, .07], [.5, .89], 2)
    art('left-shin', '残腿胫骨', 12, 'left-knee', .18, [.5, .07], { crop: [0, 0, 1, .85], layer: 6 })
    link('left-ankle', '左踝', 'left-knee', 12, .18, [.5, .07], [.48, .77], .3)
    art('left-foot', '腐足', 12, 'left-ankle', .18, [.48, .77], { crop: [0, .70, 1, .30], layer: 7 })
    dividedLimb('rot-stilt', '腐生支脚', 10, 'pelvis', [19, -4, -7], .19,
      [[.5, .06], [.5, .52], [.5, .83]], [[0, 0, 1, .60], [0, .44, 1, .46], [0, .76, 1, .24]], 1)
    motion('left-hip', -1, 8); motion('left-knee', 1, 12); motion('left-ankle', -1, 7)
    gait('left-hip', -1, 17); gait('left-knee', 1, 21)
  }

  if (p.enemyId === 'shellguard') {
    art('breastplate', '重甲胸饰', 10, 'root', .30, [.5, .28], { layer: 7 })
    art('coffin-keel', '棺底脊', 4, 'root', .28, [.5, .24], { z: -12, layer: 2 })
    head(5, .27, [.5, .73], [0, 20, -2])
    for (const [side, sign, door, cap, claw, foot] of [['left', -1, 1, 7, 15, 17], ['right', 1, 2, 9, 16, 18]]) {
      j(`${side}-gate`, '棺门铰链', 'root', [sign * 33, 43, 5])
      art(`${side}-gate-art`, '棺门', door, `${side}-gate`, .24, [sign < 0 ? .85 : .15, .13], { layer: 8 })
      motion(`${side}-gate`, sign, 8)
      keys(p, 'attack', `${side}-gate`, [[0, {}], [.27, { rotationY: -sign * 28 }], [.64, { rotationY: sign * 39 }], [1, {}]])
      j(`${side}-shoulder`, '肩', 'root', [sign * 46, 33, sign * 10 - 4])
      art(`${side}-pauldron`, '棺甲肩', cap, `${side}-shoulder`, .22, [.5, .22], { layer: 6 })
      j(`${side}-wrist`, '棺爪腕', `${side}-shoulder`, [sign * 9, -49, 4])
      art(`${side}-claw`, '棺爪', claw, `${side}-wrist`, .22, [.5, .1], { layer: 7 })
      motion(`${side}-shoulder`, sign, 11); motion(`${side}-wrist`, -sign, 15)
      dividedLimb(`${side}-coffin-root`, '拖地棺根', foot, 'root', [sign * 21, -82, -6], .22,
        [[.5, .13], [.5, .55]], [[0, 0, 1, .63], [0, .48, 1, .52]], sign)
      j(`${side}-seal-spike`, '封棺钉', `${side}-gate`, [sign * 7, 25, 1])
      art(`${side}-seal-spike-art`, '封棺钉', sign < 0 ? 11 : 13, `${side}-seal-spike`, .15, [.5, .57], { layer: 9 })
      motion(`${side}-seal-spike`, sign, 4)
    }
  }

  if (p.enemyId === 'wisp') {
    p.stage.floorOffset = 40
    art('rib-body', '幽光肋甲', 13, 'root', .32, [.5, .24], { layer: 7 })
    head(2, .23, [.55, .60], [0, 26, 8])
    j('veil-root', '幽裾根', 'root', [0, -63, -7])
    art('veil-upper', '幽裾上段', 15, 'veil-root', .28, [.5, .13], { crop: [0, 0, 1, .66], layer: 4 })
    link('veil-tip', '幽裾末节', 'veil-root', 15, .28, [.5, .13], [.5, .58])
    art('veil-lower', '幽裾尾段', 15, 'veil-tip', .28, [.5, .58], { crop: [0, .51, 1, .49], layer: 5 })
    j('ghost-tail', '尾焰', 'veil-tip', [0, -20, 3])
    art('ghost-tail-art', '幽光尾焰', 14, 'ghost-tail', .17, [.5, .1], { layer: 6 })
    for (const [id, sign] of [['veil-root', 1], ['veil-tip', -1], ['ghost-tail', 1]]) motion(id, sign, 9)
    dividedLimb('left-arm', '左投矛臂', 16, 'root', [-34, 25, -10], .25,
      [[.27, .18], [.62, .56], [.84, .87]], [[0, 0, 1, .65], [.42, .43, .58, .50], [.63, .78, .37, .22]], -1)
    j('right-shoulder', '右肩', 'root', [33, 26, 12])
    art('right-pauldron', '右肩披片', 12, 'right-shoulder', .37, [.5, .18], { layer: 7 })
    j('right-wrist', '持矛腕', 'right-shoulder', [9, -43, 4])
    art('right-forearm', '持矛前臂', 18, 'right-wrist', .29, [.5, .08], { layer: 8 })
    motion('right-shoulder', 1, 19); motion('right-wrist', -1, 12)
    j('spear', '投矛枢轴', 'right-wrist', [0, -31, 6])
    art('spear-art', '幽光长矛', 3, 'spear', .21, [.62, .56], { layer: 10 })
    motion('spear', 1, 13)
    keys(p, 'attack', 'right-shoulder', [[0, {}], [.27, { rotationZ: -34, rotationY: -20 }], [.64, { rotationZ: 41, rotationY: 18 }], [1, {}]])
    keys(p, 'attack', 'spear', [[0, {}], [.27, { rotationZ: -29, rotationX: -17 }], [.64, { rotationZ: 42, rotationX: 23 }], [1, {}]])
    j('left-banner', '左飘带', 'root', [-28, 11, -9])
    art('left-banner-art', '左飘带', 8, 'left-banner', .18, [.35, .12], { layer: 3 })
    j('right-banner', '右飘带', 'root', [29, 13, -10])
    art('right-banner-art', '右飘带', 20, 'right-banner', .21, [.5, .08], { layer: 3 })
    motion('left-banner', -1, 11); motion('right-banner', 1, 13)
  }

  if (p.enemyId === 'moss-colossus') buildMossColossus(p, { joint, imagePart, pixelLink, organMotion })

  if (p.enemyId === 'sentry-crossbow') {
    art('torso', '骨弩胸甲', 1, 'root', .30, [.5, .32], { layer: 7 })
    art('spine', '弩机脊背', 5, 'root', .23, [.5, .35], { z: -10, layer: 3 })
    head(2, .25, [.5, .72], [0, 30, 10])
    j('pelvis', '三足弩座', 'root', [0, -65, -4])
    for (const [side, sign, n] of [['left', -1, 3], ['right', 1, 4]]) {
      const wrist = dividedLimb(`${side}-arm`, '弩机手臂', n, 'root', [sign * 40, 30, sign * 12], .20,
        [[.5, .12], [.46, .36], [.5, .70]], [[0, 0, 1, .43], [0, .30, 1, .47], [0, .64, 1, .36]], sign)
      keys(p, 'attack', `${side}-arm-root`, [[0, {}], [.27, { rotationZ: -sign * 12, rotationX: -13 }], [.64, { rotationZ: sign * 7, rotationX: 17 }], [1, {}]])
      if (sign > 0) j('weapon', '活弩枢轴', wrist, [-35, 13, 8])
    }
    art('bow-stock', '弩身', 8, 'weapon', .28, [.5, .32], { crop: [.36, .21, .28, .79], layer: 10 })
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      j(`${side}-bow`, '弩臂根', 'weapon', [0, 0, 1])
      art(`${side}-bow-art`, '活弩臂', 8, `${side}-bow`, .28, [.5, .32], { crop: [sign < 0 ? 0 : .46, 0, .54, .49], layer: 11 })
      motion(`${side}-bow`, sign, 4)
      keys(p, 'attack', `${side}-bow`, [[0, {}], [.27, { rotationY: -sign * 17 }], [.64, { rotationY: sign * 12 }], [1, {}]])
    }
    motion('weapon', -1, 7)
    for (const [side, sign, n] of [['left', -1, 15], ['right', 1, 16]]) {
      dividedLimb(`${side}-tripod`, '侧弩足', n, 'pelvis', [sign * 18, 0, 5], .26,
        [[sign < 0 ? .88 : .12, .13], [.5, .51]], [[0, 0, 1, .65], [0, .43, 1, .57]], sign)
    }
    j('rear-tripod', '后弩足', 'pelvis', [0, 0, -29])
    art('rear-tripod-art', '后弩足', 17, 'rear-tripod', .34, [.5, .13], { layer: 2 })
    motion('rear-tripod', 1, 8)
  }

  if (p.enemyId === 'ash-cannon-bug') {
    art('thorax', '炮虫胸壳', 2, 'root', .25, [.5, .5], { rotationX: -40, layer: 7 })
    j('abdomen', '后腹', 'root', [0, -2, -51])
    art('carapace', '腹部背甲', 1, 'abdomen', .26, [.5, .5], { rotationX: -50, layer: 6 })
    art('belly', '腹下骨甲', 3, 'abdomen', .22, [.5, .45], { y: -8, z: -.5, rotationX: -55, layer: 3 })
    j('head', '炮虫头', 'root', [0, 3, 46])
    p.joints.find(j => j.id === 'head').rotationX = -18
    art('head-art', '复眼与颚钩', 7, 'head', .20, [.5, .54], { crop: [0, .22, 1, .78], layer: 9 })
    motion('head', -1, 6); motion('abdomen', 1, 5)
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      link(`${side}-antenna`, '触角根', 'head', 7, .20, [.5, .54], [sign < 0 ? .35 : .65, .26], 1)
      art(`${side}-antenna-art`, '触角', 7, `${side}-antenna`, .20, [sign < 0 ? .35 : .65, .26], { crop: [sign < 0 ? 0 : .48, 0, .52, .32], layer: 10 })
      motion(`${side}-antenna`, sign, 9)
      for (let i = 0; i < 3; i++) {
        dividedLimb(`${side}-leg-${i}`, '炮虫足', 20 + i * 2 + (sign > 0 ? 1 : 0), 'root', [sign * 40, -18, 30 - i * 35], .24,
          [[.5, .12], [.55, .47], [.52, .77]], [[0, 0, 1, .55], [0, .40, 1, .44], [0, .70, 1, .30]], sign * (i % 2 ? -1 : 1))
      }
    }
    j('cannon', '炮管根', 'root', [-17, 30, -3])
    p.joints.find(j => j.id === 'cannon').rotationY = -35
    art('cannon-barrel', '灰烬炮管', 8, 'cannon', .25, [.15, .5], { crop: [0, 0, .83, 1], layer: 11 })
    link('cannon-muzzle', '炮口', 'cannon', 8, .25, [.15, .5], [.84, .5])
    art('cannon-muzzle-art', '炮口骨环', 9, 'cannon-muzzle', .24, [.5, .5], { rotationY: 90, layer: 12 })
    motion('cannon', 1, 5); motion('cannon-muzzle', -1, 3)
    keys(p, 'attack', 'cannon', [[0, {}], [.27, { rotationZ: 9 }], [.64, { rotationZ: -13, rotationY: 4 }], [1, {}]])
  }

  keys(p, 'idle', 'root', [[0, {}], [.55, { dy: 2, rotationX: 2 }], [1, {}]])
  keys(p, 'move', 'root', [[0, {}], [.25, { dy: 4, rotationZ: -2 }], [.5, {}], [.75, { dy: 4, rotationZ: 2 }], [1, {}]])
  keys(p, 'attack', 'root', [[0, {}], [.27, { rotationX: -6, dz: -5 }], [.64, { rotationX: 8, dz: 13 }], [1, {}]])
  keys(p, 'hit', 'root', [[0, {}], [.30, { rotationZ: 9, dx: 6, dz: -9 }], [1, {}]])
  keys(p, 'death', 'root', [[0, {}], [.4, { dy: -7, rotationZ: 12 }], [1, { dy: -20, rotationZ: 57, rotationX: 19 }]])
  return true
}
