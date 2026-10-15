import * as THREE from 'three'
import { dressedStoneBox, metricStoneUV, templeStoneMaterial } from './temple-stone-materials.js'

const STONE = 0x3b4545
const STONE_DARK = 0x273333
const STONE_CAP = 0x58645e
const STONE_EDGE = 0x69736b
const CINNABAR = 0x6b292a
const CINNABAR_DARK = 0x3c171c
const BRONZE = 0x795936

export function evenPillarOffsets(length, forbiddenOffsets = []) {
  const last = Math.max(0, Math.floor(length) - 1)
  if (last === 0) return [0]
  const forbidden = new Set(forbiddenOffsets.filter(offset => offset > 0 && offset < last).map(Number))
  const intervalCount = Math.max(1, Math.ceil(last / 3))
  const offsets = new Set([0, last])
  const available = Array.from({ length: Math.max(0, last - 1) }, (_, index) => index + 1)
    .filter(offset => !forbidden.has(offset))
  for (let index = 1; index < intervalCount; index += 1) {
    const ideal = index * last / intervalCount
    const candidate = available
      .filter(offset => !offsets.has(offset))
      .sort((left, right) => Math.abs(left - ideal) - Math.abs(right - ideal))[0]
    if (candidate !== undefined) offsets.add(candidate)
  }
  return [...offsets].sort((left, right) => left - right)
}

export function boundaryPillarPoint(room, side, offset, tileSize, inset) {
  const horizontal = side === 'top' || side === 'bottom'
  const length = horizontal ? room.width : room.height
  const last = Math.max(1, length - 1)
  const t = length > 1 ? Math.max(0, Math.min(1, offset / last)) : 0.5
  const halfWidth = room.width * tileSize / 2 + inset
  const halfDepth = room.height * tileSize / 2 + inset
  if (horizontal) {
    return {
      x: -halfWidth + t * halfWidth * 2,
      z: side === 'top' ? -halfDepth : halfDepth,
    }
  }
  return {
    x: side === 'left' ? -halfWidth : halfWidth,
    z: -halfDepth + t * halfDepth * 2,
  }
}

function material(color, { roughness = 0.86, metalness = 0.04 } = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true })
}

function block(size, y, color, { roughness, metalness } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color, { roughness, metalness }))
  mesh.position.y = y
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export function createLowPolyWall({ horizontal, length, thickness, height }) {
  const group = new THREE.Group()
  const bodySize = horizontal ? [length, height * 0.82, thickness] : [thickness, height * 0.82, length]
  const capSize = horizontal ? [length * 1.04, 0.075, thickness * 1.3] : [thickness * 1.3, 0.075, length * 1.04]
  const baseSize = horizontal ? [length * 0.96, 0.08, thickness * 1.12] : [thickness * 1.12, 0.08, length * 0.96]
  group.add(block(baseSize, 0.04, STONE_DARK), block(bodySize, height * 0.41, STONE), block(capSize, height * 0.82 + 0.037, STONE_CAP))

  // Two shallow cap seams make the primitive read as assembled masonry.
  const seamSize = horizontal ? [0.028, 0.09, thickness * 1.34] : [thickness * 1.34, 0.09, 0.028]
  for (const offset of [-length * 0.28, length * 0.28]) {
    const seam = block(seamSize, height * 0.82 + 0.08, STONE_EDGE)
    if (horizontal) seam.position.x = offset
    else seam.position.z = offset
    group.add(seam)
  }
  return group
}

export function createLowPolyPillar({ height = 1.02 } = {}) {
  const group = new THREE.Group()
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.34, 0.1, 6), material(STONE_CAP))
  base.position.y = 0.05
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.25, 0.12, 6), material(STONE_EDGE))
  foot.position.y = 0.15
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.17, height, 6), material(CINNABAR, { roughness: 0.68 }))
  shaft.position.y = 0.21 + height / 2
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.045, 6), material(CINNABAR_DARK, { roughness: 0.74 }))
  collar.position.y = 0.39
  const capital = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.16, 0.12, 6), material(CINNABAR_DARK, { roughness: 0.72 }))
  capital.position.y = 0.21 + height + 0.06
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.22, 0.09, 6), material(STONE_CAP))
  cap.position.y = 0.21 + height + 0.165
  group.add(base, foot, shaft, collar, capital, cap)
  group.traverse(child => { if (!child.isMesh) return; child.castShadow = true; child.receiveShadow = true })
  return group
}

export function createDoorFrame({ horizontal, width, depth, height }) {
  const group = new THREE.Group()
  const postSize = horizontal ? [0.09, height + 0.14, depth * 1.26] : [depth * 1.26, height + 0.14, 0.09]
  const lintelSize = horizontal ? [width + 0.18, 0.1, depth * 1.3] : [depth * 1.3, 0.1, width + 0.18]
  for (const side of [-1, 1]) {
    const post = block(postSize, (height + 0.14) / 2, CINNABAR_DARK, { roughness: 0.7 })
    if (horizontal) post.position.x = side * (width / 2 + 0.045)
    else post.position.z = side * (width / 2 + 0.045)
    group.add(post)
  }
  group.add(block(lintelSize, height + 0.14, CINNABAR_DARK, { roughness: 0.7 }))
  const bandSize = horizontal ? [width * 0.82, 0.035, depth * 1.34] : [depth * 1.34, 0.035, width * 0.82]
  group.add(block(bandSize, height * 0.56, BRONZE, { roughness: 0.48, metalness: 0.35 }))
  return group
}

export function stoneDoorVariant(doorId) {
  // Art variation is stable across refreshes and never consumes gameplay RNG.
  let hash = 2166136261
  for (const char of String(doorId)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return ['arch', 'broken', 'pillars'][(hash >>> 0) % 3]
}

export function createStoneDoorFrame({ horizontal, width, depth, height, variant = 'arch', texture = null }) {
  const group = new THREE.Group()
  group.name = 'stone-door-' + variant
  group.userData.variant = variant
  const postWidth = .16
  const stoneDepth = depth * 1.3
  const springY = height + .10
  const colors = [0x59635e, 0x4b5752, 0x65716a]
  const materials = colors.map(color => texture ? templeStoneMaterial(texture, color) : new THREE.MeshStandardMaterial({
    color, map: texture, bumpMap: texture, bumpScale: .014, roughness: .94, metalness: .015,
  }))
  const add = (geometry, position, index = 0) => {
    if (texture) metricStoneUV(geometry)
    const mesh = new THREE.Mesh(geometry, materials[index % materials.length])
    mesh.position.set(...position)
    mesh.castShadow = mesh.receiveShadow = true
    group.add(mesh)
    return mesh
  }
  const box = (...size) => texture ? dressedStoneBox(size) : new THREE.BoxGeometry(...size)
  for (const sign of [-1, 1]) {
    const x = sign * (width / 2 + postWidth / 2)
    add(box(postWidth + .065, .10, stoneDepth * 1.25), [x, .05, 0], 1)
    const courses = 4
    const courseHeight = (springY - .10) / courses
    for (let i = 0; i < courses; i++) {
      add(box(postWidth, courseHeight - .008, stoneDepth), [x, .10 + (i + .5) * courseHeight, 0], i + (sign > 0 ? 1 : 0))
    }
    if (variant === 'pillars') add(box(postWidth + .035, .065, stoneDepth * 1.14), [x, springY + .025, 0], 2)
  }
  if (variant !== 'pillars') {
    const innerRadius = width / 2
    const outerRadius = innerRadius + postWidth
    const count = 9
    for (let i = 0; i < count; i++) {
      // The broken doorway keeps unequal arch stubs and an open, missing crown.
      if (variant === 'broken' && i >= 2 && i <= 5) continue
      const from = i * Math.PI / count + .008
      const to = (i + 1) * Math.PI / count - .008
      const shape = new THREE.Shape()
      const steps = 4
      for (let j = 0; j <= steps; j++) {
        const angle = from + (to - from) * j / steps
        const x = Math.cos(angle) * outerRadius, y = springY + Math.sin(angle) * outerRadius
        if (j === 0) shape.moveTo(x, y)
        else shape.lineTo(x, y)
      }
      for (let j = steps; j >= 0; j--) {
        const angle = from + (to - from) * j / steps
        shape.lineTo(Math.cos(angle) * innerRadius, springY + Math.sin(angle) * innerRadius)
      }
      shape.closePath()
      const stone = add(new THREE.ExtrudeGeometry(shape, {
        depth: stoneDepth, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .005, bevelThickness: .006,
      }), [0, 0, -stoneDepth / 2], i)
      stone.name = 'door-arch-stone-' + i
      if (variant === 'broken' && (i === 1 || i === 6)) stone.rotation.z = i === 1 ? -.025 : .018
    }
  }
  if (!horizontal) group.rotation.y = Math.PI / 2
  return group
}
