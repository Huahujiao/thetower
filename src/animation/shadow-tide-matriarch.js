import assets from './enemy-component-assets.json' with { type: 'json' }

// V83: socket coordinates refer to the user's new sheet, including slicer padding.
// Every cutout retains its pixels and aspect ratio; each arm has its own elbow.
export const TIDE_ARM_SOCKETS = Object.freeze([
  { id: 'left-arm', upper: 6, lower: 4, shoulder: [391, 161], elbow: [287, 208], lowerSocket: [249, 210], socket: [-29, 44, 4] },
  { id: 'right-arm', upper: 5, lower: 3, shoulder: [774, 161], elbow: [876, 208], lowerSocket: [917, 210], socket: [29, 44, 4] },
  { id: 'left-prayer', upper: 9, lower: 12, shoulder: [434, 345], elbow: [344, 421], lowerSocket: [301, 393], socket: [-24, -10, 6] },
  { id: 'right-prayer', upper: 10, lower: 11, shoulder: [747, 345], elbow: [838, 421], lowerSocket: [872, 393], socket: [24, -10, 6] },
])

export function tideSheetAnchor(number, point) {
  const { width, height, exportBounds } = assets['tide-rite-matriarch'].parts[number]
  return [(point[0] - exportBounds.x) / width, (point[1] - exportBounds.y) / height]
}

export function buildTideMatriarch(p, { j, art, pixelLink, motion, attack, keys }) {
  const pixels = .32
  const image = (id, name, number, parent, point, options = {}, pixelScale = pixels) => {
    const { width, height } = assets[p.enemyId].parts[number]
    art(id, name, number, parent, Math.max(width, height) * pixelScale, tideSheetAnchor(number, point), options)
  }
  // The neck ball sits inside the head's bottom edge; the belt overlaps the chest.
  j('neck', '\u6f6e\u7940\u9888', 'root', [0, 60, 0])
  j('head', '\u6f6e\u7940\u9996\u51a0', 'neck', [0, -10, .8])
  image('head-art', '\u6f6e\u7940\u9762\u4e0e\u80cc\u5195', 1, 'head', [593, 276], { layer: 10 })
  image('chest', '\u6f6e\u7940\u80f8\u7532', 7, 'neck', [593, 276], { z: .3, layer: 7 })
  j('skirt', '\u60ac\u88fe\u8170\u7532', 'neck', [0, -(506 - 276) * pixels + 15, -.5])
  image('skirt-art', '\u6f6e\u7940\u8170\u7532\u4e0e\u957f\u88fe', 15, 'skirt', [591, 506], { layer: 6 })
  motion('head', -1, 2); motion('skirt', 1, 3)

  for (const { id, upper, lower, shoulder, elbow, lowerSocket, socket } of TIDE_ARM_SOCKETS) {
    const sign = id.startsWith('left') ? -1 : 1
    const label = `${sign < 0 ? '\u5de6' : '\u53f3'}${id.endsWith('arm') ? '\u4e0a\u4e3b\u81c2' : '\u4e0b\u7948\u7940\u81c2'}`
    j(id, `${label}\u80a9`, 'root', socket, { rotationX: -15, rotationZ: id.endsWith('prayer') ? sign * 18 : 0 })
    image(`${id}-upper`, `${label}\u4e0a\u81c2\u4e0e\u8896\u5e03`, upper, id, shoulder, { layer: 8 })
    pixelLink(p, `${id}-elbow`, `${label}\u8098`, id, upper, pixels,
      tideSheetAnchor(upper, shoulder), tideSheetAnchor(upper, elbow))
    // Raised main palms and lowered prayer palms form two distinct silhouettes.
    Object.assign(p.joints.find(joint => joint.id === `${id}-elbow`), { rotationX: id.endsWith('arm') ? 30 : -6 })
    image(`${id}-forearm`, `${label}\u524d\u81c2\u624b\u4e0e\u62ab\u5e1b`, lower, `${id}-elbow`, lowerSocket, { layer: 9 })
    motion(id, sign, 4); motion(`${id}-elbow`, -sign, 6)
    attack(id, { rotationZ: -sign * 9, rotationX: -8 }, { rotationZ: sign * 13, rotationX: -16 })
    attack(`${id}-elbow`, { rotationZ: sign * 12 }, { rotationZ: -sign * 18, rotationX: 12 })
  }

  for (const [side, sign, number, point] of [
    ['left', -1, 17, [381, 577]], ['right', 1, 18, [808, 577]],
  ]) {
    j(`${side}-veil`, `${sign < 0 ? '\u5de6' : '\u53f3'}\u8170\u4fa7\u6f6e\u7ffc`, 'skirt', [sign * 22, -5, -3],
      { rotationY: sign * 35, rotationZ: -sign * 5 })
    image(`${side}-veil-art`, '\u6f6e\u7ffc\u957f\u62ab\u5e1b', number, `${side}-veil`, point, { layer: 3 }, .29)
    motion(`${side}-veil`, sign, 5)
  }

  // Assemble the floating instrument using the separate reference's proportions.
  // Hover beside the head, with independent casting motion and swinging pendants.
  const instrumentScale = .23
  j('ritual-focus', '\u53ec\u6f6e\u6cd5\u5668', 'root', [108, 142, 8])
  image('focus-ring', '\u53ec\u6f6e\u5916\u73af', 2, 'ritual-focus', [1266, 188], { layer: 10 }, instrumentScale)
  j('focus-core', '\u6708\u73af\u6f6e\u6838', 'ritual-focus', [0, -(397 - 188) * instrumentScale, .5])
  image('focus-crescent', '\u6cd5\u5668\u6708\u73af', 8, 'focus-core', [1266, 397], { layer: 11 }, instrumentScale)
  image('focus-orb', '\u6f6e\u6838\u5149\u7403', 16, 'focus-core', [1265, 585], { z: .5, layer: 12 }, .18)
  for (const [side, sign, number, point] of [
    ['left', -1, 13, [1138, 431]], ['right', 1, 14, [1392, 431]],
  ]) {
    j(`${side}-focus-pendant`, '\u6cd5\u5668\u7389\u5760', 'ritual-focus', [sign * 127 * instrumentScale, -(355 - 188) * instrumentScale, 0])
    image(`${side}-focus-pendant-art`, '\u6cd5\u5668\u7389\u5760\u4e0e\u6d41\u82cf', number, `${side}-focus-pendant`, point, { layer: 10 }, instrumentScale)
    motion(`${side}-focus-pendant`, sign, 9)
  }
  motion('ritual-focus', 1, 3); motion('focus-core', -1, 2)
  attack('ritual-focus', { dy: -5, rotationZ: -10 }, { dy: 10, dz: 14, rotationZ: 12 })
  keys(p, 'attack', 'focus-orb', [[0, { opacity: .45 }], [.27, { opacity: .7 }], [.64, { opacity: 1, scaleX: 1.22, scaleY: 1.22 }], [1, { opacity: .45 }]], 'part')
  for (const action of ['idle', 'move', 'hit', 'death']) keys(p, action, 'focus-orb', [[0, { opacity: .45 }], [1, { opacity: .45 }]], 'part')
}
