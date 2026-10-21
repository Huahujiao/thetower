import * as THREE from 'three'
import { getTrapDefinition, TRAP_EFFECT_SECONDS } from '../game/data/traps.js'

const NO_RAYCAST = () => {}
const smooth = (a, b, value) => { const t = Math.max(0, Math.min(1, (value - a) / (b - a))); return t * t * (3 - 2 * t) }
const hash = n => { const v = Math.sin(n * 127.1 + 19.7) * 43758.5453; return v - Math.floor(v) }

export function createTrapDevice(kind, tileSize = 1) {
  const group = new THREE.Group()
  group.name = 'trap-device-' + kind
  const iron = new THREE.MeshStandardMaterial({ color: kind === 'gas' ? 0x34443b : 0x3b3530, roughness: .88, metalness: .3, transparent: true })
  const brass = new THREE.MeshStandardMaterial({ color: 0x8d7854, roughness: .72, metalness: .6, transparent: true })
  const dark = new THREE.MeshStandardMaterial({ color: 0x171b18, roughness: 1, transparent: true })
  const glow = new THREE.MeshBasicMaterial({ color: kind === 'gas' ? 0x93bc55 : 0xf4ae61, transparent: true, toneMapped: false })
  const box = (owner, size, pos, material, name) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size.map(v => v * tileSize)), material)
    mesh.position.set(...pos.map(v => v * tileSize)); mesh.name = name
    owner.add(mesh); return mesh
  }
  box(group, [.46, .05, .40], [0, .025, 0], brass, 'trap-foot')
  box(group, [.40, .21, .34], [0, .15, 0], iron, 'trap-box')
  for (const x of [-.15, .15]) box(group, [.035, .23, .36], [x, .15, 0], brass, 'trap-metal-band')
  box(group, [.07, .08, .035], [0, .20, .186], brass, 'trap-latch')
  const lid = new THREE.Group(); lid.position.set(0, .27 * tileSize, -.18 * tileSize); group.add(lid)
  box(lid, [.44, .04, .38], [0, 0, .18], iron, 'trap-lid')
  if (kind === 'gas') {
    for (let n = 0; n < 5; n++) box(lid, [.25, .008, .014], [0, .025, .055 + n * .055], dark, 'gas-vent')
    for (const x of [-.22, .22]) {
      const valve = new THREE.Mesh(new THREE.CylinderGeometry(.035 * tileSize, .035 * tileSize, .11 * tileSize, 8), brass)
      valve.position.set(x * tileSize, .17 * tileSize, 0); valve.rotation.z = Math.PI / 2; group.add(valve)
    }
    box(group, [.15, .09, .012], [0, .14, .18], glow, 'poison-window')
  } else {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(.04, .02, .18), new THREE.Vector3(.09, .08, .20), new THREE.Vector3(.17, .10, .23)].map(v => v.multiplyScalar(tileSize)))
    const fuse = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, .009 * tileSize, 5, false), brass)
    lid.add(fuse)
    const ember = new THREE.Mesh(new THREE.SphereGeometry(.024 * tileSize, 8, 6), glow)
    ember.position.copy(curve.getPoint(1)); lid.add(ember)
  }
  group.userData.lid = lid
  group.traverse(child => { if (!child.isMesh) return; child.raycast = NO_RAYCAST; child.castShadow = false })
  return group
}

const noiseGLSL = /* glsl */`
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise21(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1,0)), f.x), mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), f.x), f.y);
}
float billows(vec2 p) { return noise21(p) * .57 + noise21(p * 2.07 + 17.0) * .28 + noise21(p * 4.13 - 9.0) * .15; }
`
const cloudVertex = /* glsl */`
uniform float uTime;
attribute vec3 aCenter;
attribute vec2 aSize;
attribute float aSeed;
varying vec2 vUv;
varying vec3 vLocal;
varying float vSeed;
void main() {
  vUv = uv; vSeed = aSeed;
  float age = max(0.0, uTime - .15 - aSeed * .18);
  float spread = 1.0 - exp(-age * 4.5);
  vec3 centre = vec3(aCenter.x * spread, aCenter.y + age * .15, aCenter.z * spread);
  centre.xz += vec2(sin(age * 2.3 + aSeed * 11.0), cos(age * 1.9 + aSeed * 7.0)) * age * .045;
  vec3 right = vec3(modelViewMatrix[0][0], modelViewMatrix[1][0], modelViewMatrix[2][0]);
  vec3 up = vec3(modelViewMatrix[0][1], modelViewMatrix[1][1], modelViewMatrix[2][1]);
  vLocal = centre + right * position.x * aSize.x + up * position.y * aSize.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(vLocal, 1.0);
}
`
const cloudFragment = /* glsl */`
uniform float uTime;
uniform float uGas;
uniform vec4 uBounds;
varying vec2 vUv;
varying vec3 vLocal;
varying float vSeed;
` + noiseGLSL + /* glsl */`
void main() {
  float edge = min(min(vLocal.x - uBounds.x, uBounds.y - vLocal.x), min(vLocal.z - uBounds.z, uBounds.w - vLocal.z));
  if (edge <= 0.0) discard;
  vec2 p = vUv * 2.0 - 1.0;
  float n = billows(p * 3.1 + vec2(vSeed * 29.0, -uTime * .65));
  float shape = exp(-dot(p, p) * 2.5) * smoothstep(.10, .63, n);
  float birth = smoothstep(.08 + vSeed * .18, .45 + vSeed * .18, uTime);
  float fade = 1.0 - smoothstep(mix(1.35, 2.0, uGas), 3.0, uTime);
  float fire = (1.0 - smoothstep(.25, .85, uTime)) * (1.0 - length(p) * .55);
  vec3 soot = mix(vec3(.12,.105,.08), vec3(.42,.36,.25), n);
  vec3 blast = mix(soot, vec3(1.0,.43,.09), fire);
  vec3 gas = mix(vec3(.12,.23,.12), vec3(.54,.66,.24), n);
  float alpha = shape * birth * fade * mix(.48, .46, uGas) * smoothstep(0.0, .06, edge);
  gl_FragColor = vec4(mix(blast, gas, uGas), alpha);
}
`
const floorVertex = /* glsl */`
varying vec3 vLocal;
void main() { vLocal = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const floorFragment = /* glsl */`
uniform float uTime;
uniform float uGas;
uniform float uTile;
uniform vec4 uBounds;
varying vec3 vLocal;
` + noiseGLSL + /* glsl */`
void main() {
  float edge = min(min(vLocal.x - uBounds.x, uBounds.y - vLocal.x), min(vLocal.z - uBounds.z, uBounds.w - vLocal.z));
  float d = max(abs(vLocal.x), abs(vLocal.z)) / uTile;
  float front = (1.0 - exp(-max(0.0, uTime - .12) * 7.0)) * 1.58;
  float wave = exp(-pow((d - front) / .10, 2.0)) * (1.0 - smoothstep(.45, 1.2, uTime));
  float n = billows(vLocal.xz / uTile * 3.7 + vec2(uTime * .25, -uTime * .22));
  float spread = 1.0 - smoothstep(front - .16, front + .12, d);
  float fade = 1.0 - smoothstep(1.9, 3.0, uTime);
  float haze = spread * smoothstep(.18, .65, n) * mix(.14, .36, uGas);
  float alpha = (haze + wave * mix(.55, .08, uGas)) * smoothstep(0.0, uTile * .07, edge) * fade;
  vec3 color = mix(mix(vec3(.32,.18,.07), vec3(1.0,.59,.15), wave), vec3(.35,.49,.16), uGas);
  gl_FragColor = vec4(color, alpha);
}
`
function cloudGeometry(cells, origin, tileSize) {
  const positions = [], uv = [], centres = [], sizes = [], seeds = [], indices = []
  for (const [index, cell] of cells.entries()) for (let layer = 0; layer < 3; layer++) {
    const seed = hash(index * 11 + layer * 31)
    const base = positions.length / 3
    for (const [x, y] of [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]]) {
      positions.push(x,y,0); uv.push(x+.5,y+.5)
      centres.push((cell.c-origin.c) * tileSize, (.18+layer*.16) * tileSize, (cell.r-origin.r) * tileSize)
      sizes.push(tileSize * (1.15 + seed * .25), tileSize * (.70 + layer*.14))
      seeds.push(seed)
    }
    indices.push(base,base+1,base+2,base,base+2,base+3)
  }
  const geometry = new THREE.BufferGeometry()
  for (const [key, data, count] of [['position',positions,3],['uv',uv,2],['aCenter',centres,3],['aSize',sizes,2],['aSeed',seeds,1]]) geometry.setAttribute(key,new THREE.Float32BufferAttribute(data,count))
  geometry.setIndex(indices)
  return geometry
}
function sparkMesh(tileSize, uniforms) {
  const velocity = [], seeds = []
  for (let i=0;i<40;i++) {
    const angle = hash(i+10)*Math.PI*2, speed = (.6+hash(i+80)*1.5)*tileSize
    velocity.push(Math.cos(angle)*speed, (.5+hash(i+50)*1.1)*tileSize, Math.sin(angle)*speed); seeds.push(hash(i+1))
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(120),3))
  geometry.setAttribute('aVelocity',new THREE.Float32BufferAttribute(velocity,3))
  geometry.setAttribute('aSeed',new THREE.Float32BufferAttribute(seeds,1))
  return new THREE.Points(geometry,new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,depthTest:false,toneMapped:false,
    vertexShader:/* glsl */`
      uniform float uTime; attribute vec3 aVelocity; attribute float aSeed; varying float vSeed; varying vec3 vLocal;
      void main() {
        float t=max(0.0,uTime-.15); vSeed=aSeed;
        vLocal=aVelocity*t+vec3(0,.23-t*t*1.2,0); vLocal.y=max(.03,vLocal.y);
        vec4 mv=modelViewMatrix*vec4(vLocal,1.0); gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp((2.0+aSeed*2.0)*150.0/max(1.0,-mv.z),1.0,14.0);
      }`,
    fragmentShader:/* glsl */`
      uniform float uTime; uniform vec4 uBounds; varying float vSeed; varying vec3 vLocal;
      void main() {
        if(vLocal.x<uBounds.x||vLocal.x>uBounds.y||vLocal.z<uBounds.z||vLocal.z>uBounds.w)discard;
        float point=1.0-smoothstep(.08,.5,length(gl_PointCoord-.5));
        float fade=smoothstep(.12,.20,uTime)*(1.0-smoothstep(.7+vSeed*.5,1.8,uTime));
        gl_FragColor=vec4(1.0,.35+vSeed*.4,.09,point*fade);
      }`,
  }))
}
function disposeEffect(group) {
  group.removeFromParent()
  const geometries = new Set(), materials = new Set()
  group.traverse(object => { if(object.geometry)geometries.add(object.geometry); if(object.material)materials.add(object.material) })
  for(const geometry of geometries)geometry.dispose()
  for(const material of materials)material.dispose()
}

export class TrapEffects {
  constructor(parent, { tileSize = 1.14, surfaceY = .13, clock = () => globalThis.performance.now()/1000 } = {}) {
    this.tileSize=tileSize; this.surfaceY=surfaceY; this.clock=clock; this.entries=new Map()
    this.group=new THREE.Group(); this.group.name='trap-effects'; parent.add(this.group)
  }
  start({ roomId, entityId, trapId, position, cells }, room, renderOrder = 1000) {
    const kind=getTrapDefinition(trapId)?.animation
    if(!kind||room.id!==roomId||!cells?.length)return false
    const key=roomId+':'+entityId
    if(this.entries.has(key))return false
    const tile=this.tileSize
    const bounds=new THREE.Vector4(
      (Math.min(...cells.map(cell=>cell.c))-position.c-.5)*tile,
      (Math.max(...cells.map(cell=>cell.c))-position.c+.5)*tile,
      (Math.min(...cells.map(cell=>cell.r))-position.r-.5)*tile,
      (Math.max(...cells.map(cell=>cell.r))-position.r+.5)*tile)
    const group=new THREE.Group(); group.name='trap-effect-'+kind
    group.position.set((position.c-(room.width-1)/2)*tile,this.surfaceY,(position.r-(room.height-1)/2)*tile)
    group.userData.cells=cells.map(cell=>({...cell})); this.group.add(group)
    const device=createTrapDevice(kind,tile); group.add(device)
    const uniforms={uTime:{value:0},uGas:{value:kind==='gas'?1:0},uBounds:{value:bounds},uTile:{value:tile}}
    const cloud=new THREE.Mesh(cloudGeometry(cells,position,tile),new THREE.ShaderMaterial({uniforms,vertexShader:cloudVertex,fragmentShader:cloudFragment,transparent:true,depthWrite:false,depthTest:false,toneMapped:false}))
    cloud.name='trap-clouds'; group.add(cloud)
    const floorGeometry=new THREE.PlaneGeometry(bounds.y-bounds.x,bounds.w-bounds.z)
    floorGeometry.rotateX(-Math.PI/2); floorGeometry.translate((bounds.x+bounds.y)/2,.008,(bounds.z+bounds.w)/2)
    const floor=new THREE.Mesh(floorGeometry,new THREE.ShaderMaterial({uniforms,vertexShader:floorVertex,fragmentShader:floorFragment,transparent:true,depthWrite:false,depthTest:false,toneMapped:false}))
    floor.name='trap-area'; group.add(floor)
    if(kind==='blast')group.add(sparkMesh(tile,uniforms))
    group.traverse(object=>{object.raycast=NO_RAYCAST;object.frustumCulled=false;object.renderOrder=renderOrder})
    floor.renderOrder=renderOrder; device.traverse(object=>{object.renderOrder=renderOrder+1}); cloud.renderOrder=renderOrder+2
    this.entries.set(key,{group,device,kind,uniforms,started:this.clock(),duration:TRAP_EFFECT_SECONDS})
    return true
  }
  update(now=this.clock()) {
    for(const [key,entry] of this.entries) {
      const age=Math.max(0,now-entry.started)
      if(age>=entry.duration) { disposeEffect(entry.group); this.entries.delete(key); continue }
      entry.uniforms.uTime.value=age
      const open=smooth(.08,.48,age), fade=1-smooth(2.05,3,age)
      entry.device.userData.lid.rotation.x=-open*(entry.kind==='gas'?1.1:1.9)
      entry.device.userData.lid.position.y=this.tileSize*(.27+(entry.kind==='blast'?Math.sin(Math.min(1,age)*Math.PI)*.20:0))
      entry.device.rotation.z=Math.sin(age*65)*.018*(1-smooth(0,.35,age))
      entry.device.scale.y=1-smooth(2.2,3,age)*.7
      entry.device.traverse(object=>{if(object.material)object.material.opacity=fade})
    }
  }
  dispose() {
    for(const entry of this.entries.values())disposeEffect(entry.group)
    this.entries.clear(); this.group.removeFromParent()
  }
}
