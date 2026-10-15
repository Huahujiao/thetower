import * as THREE from 'three'
import { dressedStoneBox, foundationStoneMaterial } from './temple-stone-materials.js'

const NO_RAYCAST = () => {}
const FOG_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const FOG_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uSeed;
  uniform float uOpacity;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y);
  }
  float mist(vec2 p) {
    float value = 0.0, amplitude = 0.55;
    for (int i=0; i<4; i++) { value += noise(p) * amplitude; p = p * 2.03 + 7.1; amplitude *= 0.48; }
    return value;
  }
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float edge = 1.0 - smoothstep(0.55, 1.0, length(p * vec2(0.94,1.02)));
    vec2 drift = vec2(uTime * 0.012, uSeed + uTime * 0.005);
    float cloud = smoothstep(0.25,0.68,mist(vUv * 6.0 + drift));
    float alpha = edge * cloud * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

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
    const atDepth = y => top + (y - top) * depthScale
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
    add([halfX * 2 + .04, .09, spanZ + .04], [0, atDepth(-1.45), centreZ], trimMaterial, 'platform-stone-course')
    for (const signX of [-1, 1]) for (const signZ of [-1, 1]) {
      add([.46, height - .06, .46], [signX * (halfX - .12), top - (height - .06) / 2, (signZ < 0 ? minZ : maxZ) - signZ * .12], trimMaterial, 'platform-corner-buttress')
    }
    this.fogPlanes = []
    for (let i = 0; i < 3; i++) {
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(0x879b96) },
          uTime: { value: 0 }, uSeed: { value: i * 17.31 }, uOpacity: { value: .42 - i * .055 },
        },
        vertexShader: FOG_VERTEX, fragmentShader: FOG_FRAGMENT,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
      })
      const fog = new THREE.Mesh(new THREE.PlaneGeometry(halfX * (2.7 + i * .12) + 1.6, spanZ * (1.35 + i * .06) + 1.6), material)
      fog.rotation.x = -Math.PI / 2
      fog.position.set(0, atDepth(-1.50 - i * .43), centreZ)
      fog.name = 'platform-low-mist'
      fog.raycast = NO_RAYCAST
      this.group.add(fog)
      this.fogPlanes.push(fog)
    }
  }

  update(seconds, still) {
    for (let i = 0; i < this.fogPlanes.length; i++) {
      const fog = this.fogPlanes[i]
      fog.material.uniforms.uTime.value = still ? 0 : seconds
      fog.position.x = still ? 0 : Math.sin(seconds * .035 + i) * .13
    }
  }
}
