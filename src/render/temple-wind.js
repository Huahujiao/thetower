import * as THREE from 'three'

const clamp = value => Math.max(0, Math.min(1, value))
const smooth = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t) }
const fraction = value => { const seed = Math.sin(value) * 43758.5453; return seed - Math.floor(seed) }
const NO_RAYCAST = () => {}
const TRUNK = [[0, .32], [.25, .37], [.43, .30], [.63, .43], [.86, .36], [1, .34]]
const CANOPY = [[.25,.80], [.36,.92], [.42,.83], [.60,.79], [.74,.75], [.60,.58], [.25,.56], [.20,.64]]

function trunkAt(v) {
  for (let i = 1; i < TRUNK.length; i++) {
    if (v > TRUNK[i][0]) continue
    const [a, b] = [TRUNK[i - 1], TRUNK[i]]
    return a[1] + (b[1] - a[1]) * clamp((v - a[0]) / (b[0] - a[0]))
  }
  return TRUNK.at(-1)[1]
}

// The original texture stays intact. Dense geometry gives branches and cloth
// separate motion weights while the painted trunk, pole and crossbar stay fixed.
export function createTempleWindRig(mesh, kind) {
  const positions = mesh.geometry.attributes.position
  positions.setUsage(THREE.DynamicDrawUsage)
  const uv = mesh.geometry.attributes.uv
  const weights = new Float32Array(uv.count)
  const phases = new Float32Array(uv.count)
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i)
    if (kind === 'tree') {
      weights[i] = smooth(.40, .68, v) * smooth(.065, .17, Math.abs(u - trunkAt(v)))
      phases[i] = u * 5.6 + v * 2.4
    } else {
      const cloth = smooth(.28, .36, u)
      const leftTail = 1 - smooth(.16, .20, u)
      weights[i] = smooth(.85, .16, v) * Math.max(cloth, leftTail * .65)
      phases[i] = (1 - v) * 8 + u * 3
    }
  }
  mesh.geometry.computeBoundingSphere()
  mesh.geometry.boundingSphere.radius += .2
  return { mesh, kind, weights, phases, base: positions.array.slice(), still: false }
}

export function updateTempleWindRig(rig, seconds, still) {
  if (still && rig.still) return
  rig.still = still
  const positions = rig.mesh.geometry.attributes.position
  const base = rig.base
  for (let i = 0; i < positions.count; i++) {
    const weight = still ? 0 : rig.weights[i], phase = rig.phases[i]
    let dx = 0, dy = 0, dz = 0
    if (weight) {
      if (rig.kind === 'tree') {
        dx = weight * (Math.sin(seconds * .55 + phase) * .045 + Math.sin(seconds * 1.65 + phase * 2) * .005)
        dy = weight * Math.sin(seconds * .67 + phase) * .012
        dz = weight * Math.sin(seconds * .61 + phase * 1.2) * .026
      } else {
        const wave = Math.sin(seconds * .85 - phase)
        dx = weight * (wave * .047 + Math.sin(seconds * 1.5 - phase * 1.3) * .01)
        dy = weight * Math.sin(seconds * 1.1 - phase) * .012
        dz = weight * (wave * .09 + Math.sin(seconds * 1.4 - phase * 1.4) * .022)
      }
    }
    positions.setXYZ(i, base[i * 3] + dx, base[i * 3 + 1] + dy, base[i * 3 + 2] + dz)
  }
  positions.needsUpdate = true
}

export class TempleFallingLeaves {
  constructor(group, geometry, tree, groundY) {
    this.tree = tree
    this.groundY = groundY
    this.leaves = []
    const colors = [0x8d4930, 0x76372a, 0x9b5838, 0x70432b]
    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        color: colors[i % colors.length], side: THREE.DoubleSide, transparent: true, depthWrite: false,
      }))
      mesh.name = 'temple-falling-leaf'
      mesh.raycast = NO_RAYCAST
      mesh.visible = false
      group.add(mesh)
      this.leaves.push({ mesh, duration: 8 + fraction(i * 17.1 + 3) * 6, offset: fraction(i * 31.7 + 9) * 14, seed: i })
    }
  }

  update(seconds, still) {
    const { width, height } = this.tree.geometry.parameters
    for (const leaf of this.leaves) {
      const clock = seconds + leaf.offset
      const cycle = Math.floor(clock / leaf.duration)
      const age = (clock / leaf.duration) - cycle
      const seed = leaf.seed * 79.3 + cycle * 13.7
      const patch = CANOPY[Math.floor(fraction(seed + 5) * CANOPY.length)]
      const u = patch[0] + (fraction(seed + 23) - .5) * .025
      const v = patch[1] + (fraction(seed + 31) - .5) * .025
      const x = this.tree.position.x + (u - .5) * width
      const startY = this.tree.position.y + (v - .5) * height
      // Reach the soil at 90% of the cycle, then disappear; no ground deposits.
      const fall = Math.min(1, age / .9)
      const fade = smooth(0, .045, age) * (1 - smooth(.80, .90, age))
      leaf.mesh.visible = !still && fade > .01 && age < .9
      leaf.mesh.material.opacity = fade * .85
      leaf.mesh.position.set(
        x + Math.sin(age * 8 + seed) * .09 + fall * .17,
        startY + (this.groundY - startY) * fall,
        this.tree.position.z + Math.sin(age * 6 + seed * .7) * .08 + fall * .05,
      )
      leaf.mesh.rotation.set(age * 3.2 + seed, age * 2.3 + seed * .4, Math.sin(age * 7 + seed) * .8)
      leaf.mesh.scale.setScalar(.06 + fraction(seed + 19) * .045)
    }
  }
}
