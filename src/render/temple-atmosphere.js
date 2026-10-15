import * as THREE from 'three'
import cloudsUrl from '../assets/environment/temple-parallax-clouds-v1.webp'

const VERTEX = `
  uniform mat4 uWorldToPlatform;
  varying vec3 vLocalPosition;
  varying vec2 vUv;
  varying float vHeight;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vHeight = world.y;
    vLocalPosition = (uWorldToPlatform * world).xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`
const FRAGMENT = `
  uniform sampler2D uMap;
  uniform vec3 uWallBounds;
  varying vec3 vLocalPosition;
  uniform vec2 uDrift;
  uniform float uOpacity;
  uniform vec3 uTint;
  uniform float uTop;
  uniform float uMirror;
  uniform vec2 uOffset;
  varying vec2 vUv;
  varying float vHeight;
  void main() {
    vec2 uv = vec2(uMirror > 0.0 ? vUv.x : 1.0-vUv.x, mix(0.04, 0.85, vUv.y)) + uDrift + uOffset;
    vec4 cloud = texture2D(uMap, uv) * 0.4;
    cloud += texture2D(uMap, uv+vec2(0.025,0.032)) * 0.15;
    cloud += texture2D(uMap, uv+vec2(-0.025,0.032)) * 0.15;
    cloud += texture2D(uMap, uv+vec2(0.025,-0.032)) * 0.15;
    cloud += texture2D(uMap, uv-vec2(0.025,0.032)) * 0.15;
    vec2 edge = smoothstep(vec2(0.0),vec2(0.14,0.12),vUv)
      * (1.0-smoothstep(vec2(0.86,0.88),vec2(1.0),vUv));
    float depth = uTop - vHeight;
    float density = smoothstep(0.8,4.2,depth);
    float wallDistance = max(abs(vLocalPosition.x)-uWallBounds.x,
      max(uWallBounds.y-vLocalPosition.z,vLocalPosition.z-uWallBounds.z));
    float softContact = smoothstep(0.0,0.7,wallDistance);
    float alpha = cloud.a * edge.x * edge.y * density * uOpacity * softContact;
    float lightness = dot(cloud.rgb, vec3(0.2126,0.7152,0.0722));
    vec3 softWhite = mix(vec3(0.24,0.29,0.30),vec3(0.58,0.64,0.64),smoothstep(0.02,0.32,lightness));
    vec3 color = mix(vec3(0.075,0.105,0.112), softWhite * uTint, 1.0-smoothstep(3.0,11.5,depth));
    gl_FragColor = vec4(color,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

// Clouds occupy fixed positions around the platform. Camera-facing patches
// form a shallow volume; ordinary depth testing lets the board occlude them.
export class TempleAtmosphere {
  constructor(scene) {
    this.mesh = new THREE.Group()
    this.mesh.name = 'temple-world-mist'
    this.mesh.matrixAutoUpdate = false
    scene.add(this.mesh)
    this.texture = new THREE.TextureLoader().load(cloudsUrl)
    // Mirror the horizontal tile so both texture edges join without a seam.
    this.texture.wrapS = THREE.MirroredRepeatWrapping
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.anisotropy = 4
    this.geometry = new THREE.PlaneGeometry(1, 1)
    this.clouds = []
    this.worldToPlatform = new THREE.Matrix4()
    this.platformKey = ''
    this.rotation = new THREE.Quaternion()
    this.scale = new THREE.Vector3()
    this.position = new THREE.Vector3()
  }

  _populate(bounds) {
    for (const cloud of this.clouds) cloud.material.dispose()
    this.mesh.clear()
    this.clouds = []
    const { halfX, minZ, maxZ, top } = bounds
    const centreZ = (minZ + maxZ) / 2
    const span = Math.max(halfX * 2, maxZ - minZ)
    for (let layer = 0; layer < 3; layer++) {
      const radius = 1.0 + layer * .8
      const positions = [
        [0, minZ - radius], [halfX + radius, centreZ],
        [0, maxZ + radius], [-halfX - radius, centreZ],
      ]
      positions.forEach(([x, z], index) => {
        const material = new THREE.ShaderMaterial({
          uniforms: {
            uWorldToPlatform: { value: this.worldToPlatform },
            uWallBounds: { value: new THREE.Vector3(halfX,minZ,maxZ) },
            uMap: { value: this.texture }, uDrift: { value: new THREE.Vector2() },
            uOpacity: { value: layer === 0 ? .92 : .98 },
            uTint: { value: new THREE.Color(layer === 0 ? 0xf0f1eb : 0xd8e1df) },
            uTop: { value: top },
            uMirror: { value: index % 2 ? -1 : 1 },
            uOffset: { value: new THREE.Vector2(layer * .034, index * .012) },
          },
          vertexShader: VERTEX, fragmentShader: FRAGMENT,
          transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide,
        })
        const cloud = new THREE.Mesh(this.geometry, material)
        cloud.name = 'temple-mist-patch'
        cloud.position.set(x, top - 2.5 - layer * 2.35, z)
        cloud.scale.set(span + 7 + layer * 3, 6.0 + layer * 2.0, 1)
        cloud.userData.phase = index * 1.73 + layer * 2.41
        cloud.userData.flowSpeed = .045 + layer * .012
        cloud.raycast = () => {}
        this.mesh.add(cloud)
        this.clouds.push(cloud)
      })
    }
    this.mesh.userData.bounds = { ...bounds }
  }

  update(seconds, still, camera, platform) {
    if (!camera || !platform) return
    const bounds = platform.group.userData.bounds
    const key = [bounds.halfX,bounds.minZ,bounds.maxZ,bounds.top].join(':')
    if (key !== this.platformKey) {
      this._populate(bounds)
      this.platformKey = key
    }
    platform.group.updateWorldMatrix(true, false)
    this.worldToPlatform.copy(platform.group.matrixWorld).invert()
    this.mesh.matrix.copy(platform.group.matrixWorld)
    this.mesh.matrixWorldNeedsUpdate = true
    this.mesh.matrix.decompose(this.position, this.rotation, this.scale)
    this.rotation.invert().multiply(camera.quaternion)
    for (const cloud of this.clouds) {
      cloud.quaternion.copy(this.rotation)
      cloud.material.uniforms.uTop.value = bounds.top + this.position.y
      const phase = cloud.userData.phase
      // A mirrored tile repeats every two UV units. Scroll continuously
      // through that period; the fixed patch edges keep the wall covered.
      const direction = cloud.material.uniforms.uMirror.value
      cloud.material.uniforms.uDrift.value.set(
        still ? 0 : direction * ((seconds * cloud.userData.flowSpeed) % 2),
        still ? 0 : Math.sin(seconds * .25 + phase) * .025,
      )
    }
  }

  dispose() {
    this.mesh.removeFromParent()
    for (const cloud of this.clouds) cloud.material.dispose()
    this.geometry.dispose()
    this.texture.dispose()
  }
}
