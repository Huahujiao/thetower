import * as THREE from 'three'

// Each small billboard draws an invented, soft-edged sigil from random curves.
// No font, character lookup, image download or per-frame canvas work is used.
export function createSealRunes({ seed, size, time, color, tint, dissolve }) {
  const positions = [], uvs = [], indices = [], slots = []
  for (let slot = 0; slot < 6; slot++) {
    const start = positions.length / 3
    positions.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
    uvs.push(0, 0, 1, 0, 0, 1, 1, 1)
    slots.push(slot, slot, slot, slot)
    indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('runeSlot', new THREE.Float32BufferAttribute(slots, 1))
  geometry.setIndex(indices)
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    uniforms: {
      runeTime: time, runeDissolve: dissolve, runeColor: { value: color }, runeTint: tint,
      runeSeed: { value: seed }, runeSize: { value: size },
    },
    vertexShader: `
      uniform float runeTime, runeDissolve, runeSeed, runeSize;
      attribute float runeSlot;
      varying vec2 sigilUv;
      varying float sigilSeed, sigilLife;
      float runeHash(float n) { return fract(sin(n*127.1+311.7)*43758.5453); }
      float runeClock(float time, float seed, float slot) {
        float speed=.115+.055*runeHash(seed+slot*3.17);
        return time*speed+runeHash(seed*1.3+slot*2.91);
      }
      float runeHeight(float phase) { return .018+phase*.36; }
      float runePattern(float seed, float slot, float cycle) { return seed*7.13+slot*13.71+cycle*37.19; }
      float runeVisibility(float phase) { return smoothstep(.04,.23,phase)*(1.0-smoothstep(.65,.98,phase)); }
      void main() {
        float clock=runeClock(runeTime,runeSeed,runeSlot);
        float phase=fract(clock), cycle=floor(clock);
        sigilSeed=runePattern(runeSeed,runeSlot,cycle);
        sigilUv=uv;
        sigilLife=runeVisibility(phase);
        float x=(runeHash(sigilSeed+1.7)-.5)*.72;
        float y=(runeHash(sigilSeed+4.3)-.5)*.72;
        x+=sin(phase*4.1+sigilSeed)*.025;
        y+=cos(phase*3.4+sigilSeed)*.020;
        vec3 point=vec3(x,y,runeHeight(phase)+runeDissolve*.06)*runeSize;
        vec4 viewPoint=modelViewMatrix*vec4(point,1.0);
        float angle=(runeHash(sigilSeed+8.3)-.5)*1.8+sin(phase*3.1+sigilSeed)*.12;
        mat2 turn=mat2(cos(angle),sin(angle),-sin(angle),cos(angle));
        float width=(.075+.04*runeHash(sigilSeed+5.8))*(.85+.15*sin(phase*3.14159265));
        viewPoint.xy+=turn*(uv-.5)*vec2(width,width*1.18)*runeSize;
        gl_Position=projectionMatrix*viewPoint;
      }
    `,
    fragmentShader: `
      uniform vec3 runeColor, runeTint;
      uniform float runeDissolve;
      varying vec2 sigilUv;
      varying float sigilSeed, sigilLife;
      float runeHash(float n) { return fract(sin(n*127.1+311.7)*43758.5453); }
      vec2 knot(float seed) {
        float angle=runeHash(seed)*6.2831853;
        float radius=.10+.26*runeHash(seed+3.7);
        return vec2(cos(angle),sin(angle))*radius;
      }
      float segmentDistance(vec2 p, vec2 a, vec2 b) {
        vec2 line=b-a;
        float along=clamp(dot(p-a,line)/max(.0001,dot(line,line)),0.0,1.0);
        return length(p-a-line*along);
      }
      void main() {
        vec2 p=sigilUv-.5;
        // Two to four broken curves form a new illegible mark every cycle.
        float strokes=2.0+floor(runeHash(sigilSeed+7.2)*3.0);
        float distanceToInk=1.0;
        for(int stroke=0;stroke<4;stroke++) {
          if(float(stroke)>=strokes) continue;
          float key=sigilSeed+float(stroke)*17.3;
          vec2 a=knot(key+1.2), b=knot(key+5.6), control=knot(key+9.1);
          for(int part=0;part<3;part++) {
            float t0=float(part)/3.0, t1=float(part+1)/3.0;
            vec2 begin=mix(mix(a,control,t0),mix(control,b,t0),t0);
            vec2 end=mix(mix(a,control,t1),mix(control,b,t1),t1);
            distanceToInk=min(distanceToInk,segmentDistance(p,begin,end));
          }
        }
        float blur=.018+fwidth(distanceToInk)*1.1;
        float ink=1.0-smoothstep(.010,.028+blur,distanceToInk);
        float haze=exp(-distanceToInk*distanceToInk/.004)*.18;
        float alpha=(ink*.48+haze)*sigilLife*(1.0-runeDissolve);
        alpha*=1.0-smoothstep(.36,.49,max(abs(p.x),abs(p.y)));
        if(alpha<.004) discard;
        // Every auxiliary tone derives from the current main colour, including
        // the pale core and dim feathering. Palette changes need no rebuild.
        float luminance=dot(runeColor,vec3(.2126,.7152,.0722));
        vec3 pale=mix(runeColor,vec3(luminance),.16)*1.35;
        vec3 colour=mix(runeColor*.45,pale,ink)*runeTint;
        gl_FragColor=vec4(colour,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'seal-rising-runes'
  mesh.frustumCulled = false
  mesh.raycast = () => {}
  return mesh
}
