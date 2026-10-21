import * as THREE from 'three'
import { templeStoneMaterial } from './temple-stone-materials.js'

// Shallow incisions reuse the stone PBR maps and the existing mesh draw call.
// Local metre coordinates keep the pattern stable when a rail is turned.
const carvingGLSL = /* glsl */`
varying vec3 vCarvePosition;
varying vec3 vCarveNormal;
uniform vec3 uCarveSize;
uniform float uCarvePost;
uniform float uCarveAlongZ;
float carveSegment(vec2 p, vec2 a, vec2 b) {
  vec2 delta = b - a;
  return length(p - a - delta * clamp(dot(p - a, delta) / dot(delta, delta), 0.0, 1.0));
}
float carveMeander(vec2 p) {
  p.x = fract(p.x + 0.5) - 0.5;
  float d = carveSegment(p, vec2(-0.48, -0.22), vec2(-0.32, -0.22));
  d = min(d, carveSegment(p, vec2(-0.32, -0.22), vec2(-0.32, 0.22)));
  d = min(d, carveSegment(p, vec2(-0.32, 0.22), vec2(0.32, 0.22)));
  d = min(d, carveSegment(p, vec2(0.32, 0.22), vec2(0.32, -0.12)));
  d = min(d, carveSegment(p, vec2(0.32, -0.12), vec2(-0.08, -0.12)));
  d = min(d, carveSegment(p, vec2(-0.08, -0.12), vec2(-0.08, 0.06)));
  return min(d, carveSegment(p, vec2(-0.08, 0.06), vec2(0.12, 0.06)));
}
float carvePalmette(vec2 p) {
  vec2 a = abs(p);
  float d = carveSegment(a, vec2(0.0, 0.40), vec2(0.36, 0.0));
  d = min(d, carveSegment(p, vec2(0.0, -0.27), vec2(0.0, 0.24)));
  d = min(d, carveSegment(vec2(a.x, p.y), vec2(0.0, -0.16), vec2(0.19, 0.02)));
  return min(d, carveSegment(vec2(a.x, p.y), vec2(0.0, 0.01), vec2(0.16, 0.17)));
}
float templeCarving() {
  vec3 n = abs(normalize(vCarveNormal));
  vec2 p;
  float mask;
  float d;
  if (uCarvePost > 0.5) {
    bool front = n.z > n.x;
    float across = front ? vCarvePosition.x : vCarvePosition.z;
    float width = front ? uCarveSize.x : uCarveSize.z;
    p = vec2(across / (width * 0.78), vCarvePosition.y / min(uCarveSize.y * 0.82, 0.40));
    d = carvePalmette(p);
    mask = smoothstep(0.88, 0.98, max(n.x, n.z));
  } else {
    float along = mix(vCarvePosition.x, vCarvePosition.z, uCarveAlongZ);
    float across = mix(vCarvePosition.z, vCarvePosition.x, uCarveAlongZ);
    float span = mix(uCarveSize.x, uCarveSize.z, uCarveAlongZ);
    float depth = mix(uCarveSize.z, uCarveSize.x, uCarveAlongZ);
    bool top = n.y > 0.9;
    p = vec2(along / 0.28, top ? across / (depth * 0.90) : vCarvePosition.y / (uCarveSize.y * 0.94));
    d = carveMeander(p);
    float sideNormal = mix(n.z, n.x, uCarveAlongZ);
    mask = smoothstep(0.88, 0.98, max(n.y, sideNormal));
    mask *= 1.0 - smoothstep(span * 0.5 - 0.065, span * 0.5 - 0.025, abs(along));
  }
  // A softened cut, with a little mineral wear instead of a painted black line.
  float width = 0.023 + 0.003 * sin(vCarvePosition.x * 83.0 + vCarvePosition.y * 61.0 + vCarvePosition.z * 71.0);
  float aa = max(fwidth(d) * 0.8, 0.005);
  return (1.0 - smoothstep(width - aa, width + aa, d)) * mask;
}
`

export function carvedStoneMaterial(texture, tint, { size, kind = 'rail', horizontal = true }) {
  const material = templeStoneMaterial(texture, tint)
  const uniforms = {
    uCarveSize: { value: new THREE.Vector3(...size) },
    uCarvePost: { value: kind === 'post' ? 1 : 0 },
    uCarveAlongZ: { value: horizontal ? 0 : 1 },
  }
  material.userData.stoneCarving = { kind, depth: 0.0022 }
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = 'varying vec3 vCarvePosition;\nvarying vec3 vCarveNormal;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvCarvePosition = position;\nvCarveNormal = normal;')
    shader.fragmentShader = carvingGLSL + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\nfloat carvedCut = templeCarving();\nfloat carvedHeight = -0.0022 * carvedCut;\ndiffuseColor.rgb *= 1.0 - carvedCut * 0.24;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      vec3 carveDx = dFdx(-vViewPosition);
      vec3 carveDy = dFdy(-vViewPosition);
      vec3 carveR1 = cross(carveDy, normal);
      vec3 carveR2 = cross(normal, carveDx);
      float carveDet = dot(carveDx, carveR1);
      vec3 carveGradient = sign(carveDet) * (dFdx(carvedHeight) * carveR1 + dFdy(carvedHeight) * carveR2);
      normal = normalize(max(abs(carveDet), 1e-8) * normal - carveGradient);
    `)
  }
  material.customProgramCacheKey = () => 'temple-carved-stone-v1'
  return material
}
