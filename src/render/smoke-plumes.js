import * as THREE from 'three'

// Several curved, camera-facing smoke ribbons share one draw call. Their
// centre lines rise in world space; opacity and fine wisps remain procedural.
export function createSmokePlumes({ anchors, time, color, up, across, depth, dissolve = { value: 0 }, mask = null, strength = .7 }) {
  const positions = [], uvs = [], seeds = [], widths = [], heights = [], indices = []
  const steps = 24
  anchors.forEach((anchor, plume) => {
    const start = positions.length / 3
    for (let row = 0; row <= steps; row++) for (let side = 0; side < 2; side++) {
      positions.push(...anchor.position)
      uvs.push(side, row / steps)
      seeds.push(anchor.seed ?? plume * 2.17)
      widths.push(anchor.width ?? .22)
      heights.push(anchor.height ?? .8)
    }
    for (let row = 0; row < steps; row++) {
      const a = start + row * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('plumeSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('plumeWidth', new THREE.Float32BufferAttribute(widths, 1))
  geometry.setAttribute('plumeHeight', new THREE.Float32BufferAttribute(heights, 1))
  geometry.setIndex(indices)
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    uniforms: {
      plumeTime: time, plumeColor: { value: color }, plumeDissolve: dissolve,
      plumeUp: { value: up }, plumeAcross: { value: across }, plumeDepth: { value: depth },
      plumeStrength: { value: strength }, plumeMasked: { value: mask ? 1 : 0 },
      plumeFrom: mask?.fogFrom || { value: null }, plumeTo: mask?.fogTo || { value: null },
      plumeBlend: mask?.fogBlend || { value: 1 },
    },
    vertexShader: `
      uniform float plumeTime, plumeDissolve;
      uniform vec3 plumeUp, plumeAcross, plumeDepth;
      attribute float plumeSeed, plumeWidth, plumeHeight;
      varying vec2 smokeUv, maskUv;
      varying float smokeSeed;
      void main() {
        smokeUv=uv; smokeSeed=plumeSeed;
        float t=plumeTime*.36, h=uv.y;
        float phase=h*6.5-t+plumeSeed;
        float sway=(sin(phase)-sin(plumeSeed-t))*.23*sqrt(h);
        float curl=(cos(phase*.83)-cos((plumeSeed-t)*.83))*.15*sqrt(h);
        vec3 point=position+plumeAcross*sway+plumeDepth*curl;
        maskUv=point.xz+.5;
        point+=plumeUp*(pow(h,1.35)*plumeHeight*(.92+.08*sin(t*.7+plumeSeed))+plumeDissolve*.16);
        vec4 viewPoint=modelViewMatrix*vec4(point,1.0);
        float taper=(.36+.64*sin(3.141593*pow(h,.65)))*(1.0-h*.45);
        viewPoint.x+=(uv.x-.5)*plumeWidth*taper*(1.0+plumeDissolve*.8);
        gl_Position=projectionMatrix*viewPoint;
      }
    `,
    fragmentShader: `
      uniform float plumeTime, plumeStrength, plumeDissolve, plumeMasked, plumeBlend;
      uniform vec3 plumeColor;
      uniform sampler2D plumeFrom, plumeTo;
      varying vec2 smokeUv, maskUv;
      varying float smokeSeed;
      float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p) {
        vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
      }
      void main() {
        float cover=1.0;
        if(plumeMasked>.5) {
          if(any(lessThan(maskUv,vec2(0)))||any(greaterThan(maskUv,vec2(1)))) discard;
          float target=texture2D(plumeTo,maskUv).r;
          cover=max(target,mix(texture2D(plumeFrom,maskUv).r,target,plumeBlend));
          if(cover<.002) discard;
        }
        float h=smokeUv.y, x=smokeUv.x-.5, t=plumeTime*.26;
        vec2 p=vec2(x*5.0+smokeSeed,h*5.5-t);
        float n=noise(p)*.65+noise(p*2.1+vec2(4.2,-t*.4))*.35;
        float bend=(noise(vec2(h*5.0-t,smokeSeed))-.5)*.24;
        float core=exp(-pow((x-bend)*3.8,2.0));
        float fibre=exp(-pow((x-bend-.12*sin(h*15.0-t+smokeSeed))*11.0,2.0));
        float body=core*smoothstep(.14,.70,n);
        float ends=smoothstep(0.0,.13,h)*(1.0-smoothstep(.65,1.0,h));
        float density=body*.82+fibre*.38*n;
        float alpha=density*ends*plumeStrength*cover*(1.0-plumeDissolve);
        if(alpha<.004) discard;
        vec3 soot=mix(plumeColor*.25,vec3(.09,.082,.067),.25);
        vec3 colour=mix(soot,plumeColor*1.18,clamp(.35+core*.50+fibre*.18,0.0,1.0));
        gl_FragColor=vec4(colour,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'rising-smoke-plumes'
  mesh.frustumCulled = false
  mesh.raycast = () => {}
  return mesh
}
