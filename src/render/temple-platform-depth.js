import * as THREE from 'three'
import { dressedStoneBox, foundationStoneMaterial } from './temple-stone-materials.js'

const NO_RAYCAST = () => {}
export class TemplePlatformDepth {
  constructor(parent, bounds, stone, masonry) {
    this.group = new THREE.Group()
    this.group.name = 'temple-platform-depth'
    parent.add(this.group)
    const halfX = bounds.outerX + .16
    const minZ = bounds.outerBackZ - .16, maxZ = bounds.outerFrontZ + .16
    const spanZ = maxZ - minZ, centreZ = (minZ + maxZ) / 2
    const depthScale = 4.5
    const top = -.43
    const height = 2.32 * depthScale
    this.group.userData.bounds = { halfX, minZ, maxZ, top, bottom: top - height }
    const wallMaterial = foundationStoneMaterial(masonry, 0x71877b, depthScale)
    const trimMaterial = foundationStoneMaterial(stone, 0x8c9e91, depthScale)
    const add = (size, position, material, name, repeat = 1) => {
      const mesh = new THREE.Mesh(dressedStoneBox(size, .014, repeat), material)
      mesh.position.set(...position)
      mesh.name = name
      mesh.raycast = NO_RAYCAST
      this.group.add(mesh)
      return mesh
    }
    add([halfX * 2, height, spanZ], [0, top - height / 2, centreZ], wallMaterial, 'platform-foundation-wall', 2)
    add([halfX * 2 + .11, .13, spanZ + .11], [0, -.71, centreZ], trimMaterial, 'platform-upper-plinth')
    for (const signX of [-1, 1]) for (const signZ of [-1, 1]) {
      add([.46, height - .06, .46], [signX * (halfX - .12), top - (height - .06) / 2, (signZ < 0 ? minZ : maxZ) - signZ * .12], trimMaterial, 'platform-corner-buttress')
    }
  }
}
