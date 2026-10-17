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
    // Butt against the planting wall, rather than sharing its upper side faces.
    // Keep the original lower extent so the foreground mist coverage stays stable.
    const top = bounds.outerWallBottom
    const bottom = -.43 - 2.32 * depthScale
    const height = top - bottom
    this.group.userData.bounds = { halfX, minZ, maxZ, top, bottom: top - height }
    // The side walls are the same dressed stone as the rails and pillars. They used
    // to take the darker foundation masonry plus a darker tint, so the platform
    // read as a separate, murkier material from the structure standing on it.
    const wallMaterial = foundationStoneMaterial(stone, 0x8ea396, depthScale)
    const trimMaterial = foundationStoneMaterial(stone, 0x99a89a, depthScale)
    const add = (size, position, material, name, repeat = 1) => {
      const mesh = new THREE.Mesh(dressedStoneBox(size, .026, repeat), material)
      mesh.position.set(...position)
      mesh.name = name
      mesh.raycast = NO_RAYCAST
      mesh.receiveShadow = true
      this.group.add(mesh)
      return mesh
    }
    add([halfX * 2, height, spanZ], [0, top - height / 2, centreZ], wallMaterial, 'platform-foundation-wall', 2)
    add([halfX * 2 + .11, .13, spanZ + .11], [0, -.71, centreZ], trimMaterial, 'platform-upper-plinth')
    for (const signX of [-1, 1]) for (const signZ of [-1, 1]) {
      const x = signX * (halfX - .12), z = (signZ < 0 ? minZ : maxZ) - signZ * .12
      const courseHeight = .52
      for (let course = 0; course < 5; course++) {
        add([.46, courseHeight - .009, .46], [x, top - (course + .5) * courseHeight, z], trimMaterial, 'platform-corner-buttress')
      }
      const lowerHeight = height - courseHeight * 5
      add([.46, lowerHeight, .46], [x, top - courseHeight * 5 - lowerHeight / 2, z], trimMaterial, 'platform-corner-buttress-lower')
    }
  }
}
