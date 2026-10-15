import * as THREE from 'three'

export function metricStoneUV(geometry, metresPerRepeat = 1) {
  const position = geometry.attributes.position
  const normal = geometry.attributes.normal
  const uv = new Float32Array(position.count * 2)
  for (let i = 0; i < position.count; i++) {
    const nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i)), nz = Math.abs(normal.getZ(i))
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i)
    uv[i * 2] = (nx > ny && nx > nz ? z : x) / metresPerRepeat
    uv[i * 2 + 1] = (ny > nx && ny > nz ? z : y) / metresPerRepeat
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geometry
}

export function dressedStoneBox(size, bevel = .008, metresPerRepeat = 1) {
  const radius = Math.min(bevel, Math.min(...size) * .18)
  const [width, height, depth] = size.map(value => value - radius * 2)
  const shape = new THREE.Shape()
  shape.moveTo(-width / 2, -height / 2)
  shape.lineTo(width / 2, -height / 2)
  shape.lineTo(width / 2, height / 2)
  shape.lineTo(-width / 2, height / 2)
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: radius, bevelThickness: radius,
  })
  geometry.translate(0, 0, -depth / 2)
  return metricStoneUV(geometry, metresPerRepeat)
}

export function templeStoneMaterial(texture, tint = 0x89978e) {
  // The albedo carries the stone colour; geometry tint only varies worn courses.
  const color = new THREE.Color(0xdde2da).lerp(new THREE.Color(tint), .2)
  return new THREE.MeshStandardMaterial({
    color, map: texture, bumpMap: texture, bumpScale: .018,
    roughness: .93, metalness: .012, emissive: 0x24342f, emissiveIntensity: .04,
  })
}

export function foundationStoneMaterial(texture, tint = 0x7e9388, depthScale = 1) {
  const material = templeStoneMaterial(texture, tint)
  // Keep the closed foundation solid; only the separate mist is transparent.
  material.transparent = false
  material.depthWrite = true
  material.onBeforeCompile = shader => {
    shader.uniforms.uTempleDepthScale = { value: depthScale }
    shader.vertexShader = 'varying float vTempleHeight;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vTempleHeight = (modelMatrix * vec4(transformed, 1.0)).y;')
    shader.fragmentShader = 'uniform float uTempleDepthScale;\n varying float vTempleHeight;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n float stoneHeight = -0.43 + (vTempleHeight + 0.43) / uTempleDepthScale;\n diffuseColor.rgb *= mix(0.34, 1.0, smoothstep(-2.65, -0.85, stoneHeight));')
  }
  material.customProgramCacheKey = () => 'temple-foundation-solid-depth-v3'
  return material
}
