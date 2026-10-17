import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

const surfaces = new WeakMap()
export function registerTempleStoneSurface(albedo, normal, surface) {
  surfaces.set(albedo, { normal, surface })
}

export function metricStoneUV(geometry, metresPerRepeat = 1) {
  const position = geometry.attributes.position
  const normal = geometry.attributes.normal
  const uv = new Float32Array(position.count * 2)
  for (let i = 0; i < position.count; i++) {
    // Rounded boxes retain their six face groups. Choose one projection per
    // whole face, so smooth bevel normals cannot switch UV axes mid-triangle.
    const face = geometry.type === 'RoundedBoxGeometry' ? Math.floor(i / (position.count / 6)) : -1
    const nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i)), nz = Math.abs(normal.getZ(i))
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i)
    const axis = face >= 0 ? Math.floor(face / 2) : nx > ny && nx > nz ? 0 : ny > nz ? 1 : 2
    uv[i * 2] = (axis === 0 ? z : x) / metresPerRepeat
    uv[i * 2 + 1] = (axis === 1 ? z : y) / metresPerRepeat
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geometry
}

export function dressedStoneBox(size, bevel = .016, metresPerRepeat = 1) {
  const radius = Math.min(bevel, Math.min(...size) * .22)
  const geometry = new RoundedBoxGeometry(...size, 2, radius)
  metricStoneUV(geometry, metresPerRepeat)
  const normal = geometry.attributes.normal
  const position = geometry.attributes.position
  const colors = new Float32Array(position.count * 3)
  for (let i = 0; i < position.count; i++) {
    const edge = Math.min(1, (1 - Math.max(Math.abs(normal.getX(i)), Math.abs(normal.getY(i)), Math.abs(normal.getZ(i)))) / .29)
    // A restrained mineral rub on exposed bevels, rather than painted outlines.
    const wear = .88 + edge * .12
    colors.set([wear, wear * .995, wear * .98], i * 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.userData.stoneBevel = radius
  return geometry
}

export function templeStoneMaterial(texture, tint = 0x89978e) {
  const { normal = null, surface = null } = surfaces.get(texture) || {}
  const color = new THREE.Color(0xb7c2b1).lerp(new THREE.Color(tint), .18)
  return new THREE.MeshStandardMaterial({
    color, map: texture, normalMap: normal, normalScale: new THREE.Vector2(1, 1),
    roughnessMap: surface, aoMap: surface, aoMapIntensity: .75,
    roughness: 1, metalness: 0, vertexColors: true,
  })
}

export function foundationStoneMaterial(texture, tint = 0x7e9388, depthScale = 1) {
  const material = templeStoneMaterial(texture, tint)
  // Keep the closed foundation solid; only the separate mist is transparent.
  material.transparent = false
  material.depthWrite = true
  // Depth falloff for the platform skirt. At 0.34 the lower wall sank to a third of
  // its albedo and read as a black void rather than as stone in shadow, which
  // also made it look like a different material from the rails above it.
  material.onBeforeCompile = shader => {
    shader.uniforms.uTempleDepthScale = { value: depthScale }
    shader.vertexShader = 'varying float vTempleHeight;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vTempleHeight = (modelMatrix * vec4(transformed, 1.0)).y;')
    shader.fragmentShader = 'uniform float uTempleDepthScale;\n varying float vTempleHeight;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n float stoneHeight = -0.43 + (vTempleHeight + 0.43) / uTempleDepthScale;\n diffuseColor.rgb *= mix(0.58, 1.0, smoothstep(-2.65, -0.85, stoneHeight));')
  }
  material.customProgramCacheKey = () => 'temple-foundation-solid-depth-v4'
  return material
}
