import * as THREE from 'three'
import { createTempleWindRig, updateTempleWindRig, TempleFallingLeaves } from './temple-wind.js'
import { TempleParallaxBackdrop } from './temple-parallax-backdrop.js'
import stoneUrl from '../assets/environment/temple-dressed-stone-v1.jpg'
import masonryUrl from '../assets/environment/temple-foundation-masonry-v1.jpg'
import soilStoneUrl from '../assets/board-floor-plain-v1.jpg'
import { dressedStoneBox, metricStoneUV, templeStoneMaterial } from './temple-stone-materials.js'
import { TemplePlatformDepth } from './temple-platform-depth.js'
import { TempleAtmosphere } from './temple-atmosphere.js'
import mapleUrl from '../assets/environment/temple-maple-v1.png'
import bannerUrl from '../assets/environment/temple-banner-v1.png'

// Clear the widest pillar foot by 7.5cm on every side of the board.
export const TEMPLE_BOUNDARY_INSET = .34
const TEMPLE_APRON_WIDTH = TEMPLE_BOUNDARY_INSET + .265 + .045

const NO_RAYCAST = () => {}
const fraction = value => { const seed = Math.sin(value) * 43758.5453; return seed - Math.floor(seed) }

// Scenery owns only presentation resources; it never changes the room or save.
export class TempleEnvironment {
  constructor(container, scene) {
    this.container = container
    this.atmosphere = new TempleAtmosphere(scene)
    this.parallax = new TempleParallaxBackdrop(container)
    this.backdrop = this.parallax.element
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const loadStone = url => {
      const texture = new THREE.TextureLoader().load(url)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.userData.boardShared = true
      texture.anisotropy = 4
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      return texture
    }
    this.stone = loadStone(stoneUrl)
    this.masonry = loadStone(masonryUrl)
    this.soilStone = loadStone(soilStoneUrl)
    this.props = new Map([mapleUrl, bannerUrl].map(url => {
      const texture = new THREE.TextureLoader().load(url)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.userData.boardShared = true
      return [url, texture]
    }))
  }

  block(group, size, position, color = 0x777b72) {
    const mesh = new THREE.Mesh(dressedStoneBox(size), templeStoneMaterial(this.stone, color))
    mesh.position.set(...position)
    mesh.castShadow = mesh.receiveShadow = false
    mesh.raycast = NO_RAYCAST
    group.add(mesh)
    return mesh
  }

  wall({ horizontal, length, thickness, height }) {
    const group = new THREE.Group()
    const dims = (span, h, depth) => horizontal ? [span, h, depth] : [depth, h, span]
    this.block(group, dims(length, .16, thickness * 1.8), [0, .08, 0], 0x62695f)
    this.block(group, dims(length, .12, thickness * 1.45), [0, height * .76, 0], 0x93968a)
    return group
  }

  railingPost(kind, height) {
    const group = new THREE.Group()
    group.name = 'temple-rail-post'
    group.userData.kind = kind
    if (kind === 'small') {
      this.block(group, [.095, height, .25], [0, height / 2, 0], 0x858b7f)
      this.block(group, [.14, .055, .29], [0, height, 0], 0xaba99a)
    } else {
      this.block(group, [.25, .075, .29], [0, .0375, 0], 0x747e73)
      const shaft = new THREE.Mesh(metricStoneUV(new THREE.CylinderGeometry(.085, .115, height, 4)), templeStoneMaterial(this.stone, 0x899387))
      shaft.position.y = height / 2 + .065
      shaft.rotation.y = Math.PI / 4
      shaft.raycast = NO_RAYCAST
      group.add(shaft)
      this.block(group, [.25, .075, .29], [0, height + .065, 0], 0x9ca594)
      this.block(group, [.14, .055, .18], [0, height + .13, 0], 0x798779)
    }
    return group
  }

  pillar({ height }) {
    const group = new THREE.Group()
    this.block(group, [.53, .12, .53], [0, .06, 0], 0x727a70)
    this.block(group, [.38, height * .70, .38], [0, .12 + height * .35, 0], 0x8b8b7e)
    this.block(group, [.44, .13, .44], [0, height * .77, 0], 0x777b70)
    this.block(group, [.51, .10, .51], [0, height * .86, 0], 0x545f5d)
    this.block(group, [.40, .095, .40], [0, height * .95, 0], 0x5c6662)
    this.block(group, [.27, .055, .27], [0, height * 1.02, 0], 0x8a8e80)
    return group
  }

  stoneRing(group, bounds, { thickness, height, y, color, name, openings = [] }) {
    const { minX, maxX, minZ, maxZ } = bounds
    const ring = new THREE.Group()
    ring.name = name
    const centreX = (minX + maxX) / 2
    const centreZ = (minZ + maxZ) / 2
    // Horizontal runs own the corners; vertical runs butt against their inner faces.
    // All four beams use the same height and one shared inner rectangle.
    const beams = [
      { side: 'back', size: [maxX - minX + thickness * 2, height, thickness], position: [centreX, y, minZ - thickness / 2] },
      { side: 'front', size: [maxX - minX + thickness * 2, height, thickness], position: [centreX, y, maxZ + thickness / 2] },
      { side: 'left', size: [thickness, height, maxZ - minZ], position: [minX - thickness / 2, y, centreZ] },
      { side: 'right', size: [thickness, height, maxZ - minZ], position: [maxX + thickness / 2, y, centreZ] },
    ]
    for (const beam of beams) {
      const axis = beam.side === 'back' || beam.side === 'front' ? 0 : 2
      const min = beam.position[axis] - beam.size[axis] / 2
      const max = beam.position[axis] + beam.size[axis] / 2
      const cuts = openings.filter(opening => opening.side === beam.side)
        .map(opening => [Math.max(min, opening.centre - opening.width / 2), Math.min(max, opening.centre + opening.width / 2)])
        .filter(([from, to]) => to > from).sort((a, b) => a[0] - b[0])
      const segments = []
      let cursor = min
      for (const [from, to] of cuts) {
        if (from > cursor) segments.push([cursor, from])
        cursor = Math.max(cursor, to)
      }
      if (cursor < max) segments.push([cursor, max])
      segments.forEach(([from, to], index) => {
        const size = [...beam.size], position = [...beam.position]
        size[axis] = to - from
        position[axis] = (from + to) / 2
        const mesh = this.block(ring, size, position, color)
        mesh.name = name + '-' + beam.side + (index ? '-' + index : '')
      })
    }
    group.add(ring)
    return ring
  }

  plantingBelt(group, room, tileSize, doors = []) {
    const halfX = room.width * tileSize / 2
    const halfZ = room.height * tileSize / 2
    const width = .9
    const soilY = -.38
    // A uniform narrow inner gap leaves enough support under the whole pillar foot.
    const innerX = halfX + TEMPLE_APRON_WIDTH
    const backZ = -halfZ - TEMPLE_APRON_WIDTH
    const frontZ = halfZ + TEMPLE_APRON_WIDTH
    const outerX = innerX + width
    const outerBackZ = backZ - width
    const outerFrontZ = frontZ + width
    const belt = new THREE.Group()
    belt.name = 'temple-planting-belt'
    belt.userData.planting = { innerX, backZ, frontZ, outerX, outerBackZ, outerFrontZ, soilY, width }
    group.add(belt)
    const paths = doors.map(door => {
      const horizontal = door.side === 'top' || door.side === 'bottom'
      const sign = door.side === 'top' || door.side === 'left' ? -1 : 1
      const inner = horizontal ? (sign < 0 ? -backZ : frontZ) : innerX
      const outer = horizontal ? (sign < 0 ? -outerBackZ : outerFrontZ) : outerX
      return {
        ...door, horizontal, sign, inner, outer, width: door.width || tileSize * .76,
        centre: horizontal ? door.x : door.z,
        ringSide: door.side === 'top' ? 'back' : door.side === 'bottom' ? 'front' : door.side,
      }
    })
    const isOnPath = (point, padding = .09) => paths.some(path => {
      const across = path.horizontal ? point.x : point.z
      const along = (path.horizontal ? point.z : point.x) * path.sign
      return Math.abs(across - path.centre) < path.width / 2 + padding && along > path.inner - .04 - padding && along < path.outer + .22 + padding
    })
    const openings = paths.map(path => ({ side: path.ringSide, centre: path.centre, width: path.width + .05 }))
    const depth = frontZ - backZ
    const strips = [
      { side: 'back', size: [outerX * 2, width], x: 0, z: backZ - width / 2 },
      { side: 'front', size: [outerX * 2, width], x: 0, z: frontZ + width / 2 },
      { side: 'left', size: [width, depth], x: -innerX - width / 2, z: (backZ + frontZ) / 2 },
      { side: 'right', size: [width, depth], x: innerX + width / 2, z: (backZ + frontZ) / 2 },
    ]
    const soilMaterial = new THREE.MeshStandardMaterial({
      map: this.soilStone, color: 0x463c2d, roughness: 1, metalness: 0,
      bumpMap: this.soilStone, bumpScale: .035,
    })
    for (const strip of strips) {
      const geometry = new THREE.PlaneGeometry(...strip.size)
      // Metre-scale UVs keep soil grain consistent along long and short sides.
      const uv = geometry.attributes.uv
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * strip.size[0], uv.getY(i) * strip.size[1])
      const soil = new THREE.Mesh(geometry, soilMaterial)
      soil.name = 'planting-soil-' + strip.side
      soil.rotation.x = -Math.PI / 2
      soil.position.set(strip.x, soilY, strip.z)
      soil.raycast = NO_RAYCAST
      belt.add(soil)
    }
    const apronStrips = [
      { side: 'back', size: [innerX * 2, .10, TEMPLE_APRON_WIDTH], position: [0, -.015, -halfZ - TEMPLE_APRON_WIDTH / 2] },
      { side: 'front', size: [innerX * 2, .10, TEMPLE_APRON_WIDTH], position: [0, -.015, halfZ + TEMPLE_APRON_WIDTH / 2] },
      { side: 'left', size: [TEMPLE_APRON_WIDTH, .10, halfZ * 2], position: [-halfX - TEMPLE_APRON_WIDTH / 2, -.015, 0] },
      { side: 'right', size: [TEMPLE_APRON_WIDTH, .10, halfZ * 2], position: [halfX + TEMPLE_APRON_WIDTH / 2, -.015, 0] },
    ]
    for (const strip of apronStrips) {
      const apron = this.block(belt, strip.size, strip.position, 0x818679)
      apron.name = 'temple-apron-' + strip.side
    }
    // Inner risers end flush with the apron, without projecting into the soil.
    this.stoneRing(belt, { minX: -innerX + .15, maxX: innerX - .15, minZ: backZ + .15, maxZ: frontZ - .15 }, {
      thickness: .15, height: .48, y: -.24, color: 0x4d5951, name: 'planting-inner-riser',
    })
    const outerBounds = { minX: -outerX, maxX: outerX, minZ: outerBackZ, maxZ: outerFrontZ }
    this.stoneRing(belt, outerBounds, {
      thickness: .16, height: .48, y: -.45, color: 0x545d50, name: 'planting-outer-wall', openings,
    })
    // Equal 2.5cm overhang around every edge, including all four corners.
    const overhang = .025
    this.stoneRing(belt, {
      minX: outerBounds.minX + overhang, maxX: outerBounds.maxX - overhang,
      minZ: outerBounds.minZ + overhang, maxZ: outerBounds.maxZ - overhang,
    }, { thickness: .16 + overhang * 2, height: .08, y: -.18, color: 0x727868, name: 'planting-outer-cap', openings })
    for (const path of paths) {
      const road = new THREE.Group()
      road.name = 'temple-door-stone-path'
      road.userData.doorId = path.id
      road.userData.side = path.side
      road.userData.centre = path.centre
      road.userData.width = path.width
      const start = path.inner - .015
      const end = path.outer + .22
      const lengths = [.27, .27, end - start - .54]
      let cursor = start
      lengths.forEach((length, index) => {
        const top = .035 - (index + 1) * .115
        const height = top - (soilY - .08)
        const along = path.sign * (cursor + length / 2)
        const size = path.horizontal ? [path.width, height, length - .008] : [length - .008, height, path.width]
        const position = path.horizontal ? [path.centre, top - height / 2, along] : [along, top - height / 2, path.centre]
        const slab = this.block(road, size, position, 0x718079)
        slab.name = 'door-path-slab-' + index
        slab.userData.surfaceY = top
        cursor += length
      })
      belt.add(road)
    }
    const point = i => {
      let t = fraction(i * 127.1 + 57.3)
      const across = .18 + fraction(i * 311.7 + 23.1) * (width - .36)
      const side = i % 4
      for (let attempt = 0; attempt < 16; attempt++) {
        const candidate = side < 2
          ? { x: (t - .5) * outerX * 2, z: side === 0 ? backZ - across : frontZ + across }
          : { x: side === 2 ? -innerX - across : innerX + across, z: backZ + t * depth }
        if (!isOnPath(candidate)) return candidate
        t = (t + .173) % 1
      }
      return { x: -outerX + .15, z: outerBackZ + .15 }
    }
    const vertices = []
    for (let i = 0; i < 64; i++) {
      const p = point(i)
      for (let blade = 0; blade < 5; blade++) {
        const angle = i * 2.399 + blade * 1.257
        const height = .07 + fraction(i * 41.3 + blade * 17.1) * .13
        const dx = Math.cos(angle), dz = Math.sin(angle)
        const x = p.x + dx * .02, z = p.z + dz * .02
        vertices.push(x - dz * .009, soilY, z + dx * .009, x + dz * .009, soilY, z - dx * .009, x + dx * .07, soilY + height, z + dz * .07)
      }
    }
    const grassGeometry = new THREE.BufferGeometry()
    grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    grassGeometry.computeVertexNormals()
    const grass = new THREE.Mesh(grassGeometry, new THREE.MeshBasicMaterial({ color: 0x4c5038, side: THREE.DoubleSide }))
    grass.name = 'planting-low-grass'
    grass.raycast = NO_RAYCAST
    belt.add(grass)
    const stones = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.05, 0), new THREE.MeshStandardMaterial({ color: 0x626359, roughness: 1 }), 72)
    const transform = new THREE.Object3D()
    for (let i = 0; i < stones.count; i++) {
      const p = point(i + 101)
      const size = .5 + fraction(i * 19.7) * .8
      transform.position.set(p.x, soilY + .016, p.z)
      transform.rotation.set(i * .7, i * 2.399, i * .3)
      transform.scale.set(size, size * .45, size * .8)
      transform.updateMatrix()
      stones.setMatrixAt(i, transform.matrix)
    }
    stones.name = 'planting-pebbles'
    stones.raycast = NO_RAYCAST
    belt.add(stones)
    return { belt, soilY, backZ, frontZ, outerX, point, isOnPath }
  }

  decorate(group, room, tileSize, tileMeshes = [], doors = []) {
    const halfX = room.width * tileSize / 2
    const halfZ = room.height * tileSize / 2
    this.banners = []
    this.windRigs = []
    this.boardLeafAnchors = []
    this.boardLeaves = null
    const planting = this.plantingBelt(group, room, tileSize, doors)
    this.platformDepth = new TemplePlatformDepth(group, planting.belt.userData.planting, this.stone, this.masonry)
    const prop = (url, width, height, x, z, baseY = 0) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height, url === mapleUrl ? 40 : 32, url === mapleUrl ? 40 : 56), new THREE.MeshBasicMaterial({map:this.props.get(url), transparent:true, depthWrite:false, alphaTest:.12, color:0xbebdb4, side:THREE.DoubleSide}))
      mesh.position.set(x,baseY+height/2,z)
      mesh.raycast = NO_RAYCAST
      group.add(mesh)
      return mesh
    }
    const tree = prop(mapleUrl, 4.0, 3.1, -halfX + 1.65, planting.backZ - .46, planting.soilY - .1)
    tree.name = 'temple-maple-in-planting'
    tree.userData.rootLevel = planting.soilY
    this.windRigs.push(createTempleWindRig(tree, 'tree'))
    const banner = prop(bannerUrl,1.02,2.2,halfX+.33,-halfZ+1.0)
    banner.name = 'temple-wind-banner'
    this.banners.push(banner)
    this.windRigs.push(createTempleWindRig(banner, 'banner'))
    // Resting leaves collect beneath this tree, on the rear soil strip only.
    const shape = new THREE.Shape()
    shape.moveTo(0, .5)
    for (const [x, y] of [[.11,.22],[.35,.3],[.23,.08],[.48,-.02],[.19,-.14],[.22,-.33],[.05,-.23],[0,-.48],[-.05,-.23],[-.22,-.33],[-.19,-.14],[-.48,-.02],[-.23,.08],[-.35,.3],[-.11,.22]]) shape.lineTo(x,y)
    shape.closePath()
    const geometry = new THREE.ShapeGeometry(shape)
    const colors = [0x74372b, 0x8c4533, 0x663d2e, 0x9a5237]
    const plantedLeaves = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), 48)
    const rootX = tree.position.x - .72
    const leafTransform = new THREE.Object3D()
    for (let i = 0; i < plantedLeaves.count; i++) {
      let x, z
      for (let attempt = 0; attempt < 16; attempt++) {
        const seed = i + attempt * 71
        x = rootX + (fraction(seed * 127.1 + 9) + fraction(seed * 73.7 + 19) - 1) * 1.65
        z = planting.backZ - .12 - fraction(seed * 311.7 + 23) * .64
        if (!planting.isOnPath({ x, z })) break
      }
      leafTransform.position.set(x, planting.soilY + .008, z)
      leafTransform.rotation.set(-Math.PI / 2, 0, i * 2.399)
      leafTransform.scale.setScalar(.065 + fraction(i * 29.1) * .055)
      leafTransform.updateMatrix()
      plantedLeaves.setMatrixAt(i, leafTransform.matrix)
      plantedLeaves.setColorAt(i, new THREE.Color(colors[i % colors.length]))
    }
    plantedLeaves.name = 'planting-fallen-leaves'
    plantedLeaves.userData.treeRootX = rootX
    plantedLeaves.raycast = NO_RAYCAST
    planting.belt.add(plantedLeaves)
    // A sparse spill reaches only the board's tree-facing corner.
    // Attach each instance to its current card/floor pose so hover and flips
    // cannot leave the leaves floating above a newly revealed tile.
    const boardSpill = [
      [0, 0, -.25, .28], [0, 0, .37, .13],
      [1, 0, -.42, .30], [1, 0, -.17, .42], [1, 0, .29, .31],
      [2, 0, -.42, .39], [0, 1, -.43, .37], [1, 1, -.40, .42],
    ]
    this.boardLeafAnchors = boardSpill.map(([c, r, x, y], index) => ({
      face: tileMeshes.find(face => face.userData.position.c === c && face.userData.position.r === r),
      x, y, rotation: index * 2.399, size: .065 + fraction(index * 19.1 + 3) * .025,
    })).filter(anchor => anchor.face)
    if (this.boardLeafAnchors.length) {
      this.boardLeaves = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), this.boardLeafAnchors.length)
      this.boardLeaves.name = 'temple-board-leaves-near-tree'
      this.boardLeaves.raycast = NO_RAYCAST
      this.boardLeaves.frustumCulled = false
      this.boardLeafTransform = new THREE.Object3D()
      this.boardLeafAnchors.forEach((anchor, i) => this.boardLeaves.setColorAt(i, new THREE.Color(colors[i % colors.length])))
      group.add(this.boardLeaves)
      this._updateBoardLeaves()
    }
    this.fallingLeaves = new TempleFallingLeaves(group, geometry, tree, planting.soilY + .008)
  }

  _updateBoardLeaves() {
    if (!this.boardLeaves) return
    this.boardLeafAnchors.forEach((anchor, index) => {
      const surface = anchor.face.userData.groundFace || anchor.face
      surface.updateMatrix()
      this.boardLeafTransform.position.set(anchor.x, anchor.y, .008)
      this.boardLeafTransform.rotation.set(0, 0, anchor.rotation)
      this.boardLeafTransform.scale.setScalar(anchor.size)
      this.boardLeafTransform.updateMatrix()
      this.boardLeafTransform.matrix.premultiply(surface.matrix)
      this.boardLeaves.setMatrixAt(index, this.boardLeafTransform.matrix)
    })
    this.boardLeaves.instanceMatrix.needsUpdate = true
  }

  update(time, board, delta, camera) {
    const still = this.reducedMotion.matches
    this._updateBoardLeaves()
    for (const rig of this.windRigs || []) updateTempleWindRig(rig, time * .001, still)
    this.fallingLeaves?.update(time * .001, still)
    this.atmosphere.update(time * .001, still, camera, this.platformDepth)
    this.parallax.update(time * .001, still, camera, this.platformDepth)
  }

  dispose() {
    this.parallax.dispose()
    this.atmosphere.dispose()
    this.windRigs = []
    this.fallingLeaves = null
    this.boardLeaves = null
    this.boardLeafAnchors = []
    this.platformDepth = null
    this.stone.dispose()
    this.masonry.dispose()
    this.soilStone.dispose()
    for (const texture of this.props.values()) texture.dispose()
  }
}

export function createContactShadowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(64,64,0,64,64,62)
  gradient.addColorStop(0,'rgba(9,12,13,.65)')
  gradient.addColorStop(.35,'rgba(9,12,13,.38)')
  gradient.addColorStop(.75,'rgba(9,12,13,.12)')
  gradient.addColorStop(1,'rgba(9,12,13,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0,0,128,128)
  const texture = new THREE.CanvasTexture(canvas)
  texture.userData.boardShared = true
  return texture
}
