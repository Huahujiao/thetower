import * as THREE from 'three'
import { SEAL_HAZE_DENSITY_GLSL } from './mist-density.js'

export const UNEXPLORED_MIST_DENSITY = 2.5

const MASK_DENSITY = 16
const FADE_SECONDS = .55

// The binary mask limits the effect to unknown cells; opacity is procedural.
export function explorationFogMask(width, height, hidden) {
  const pixelWidth = width * MASK_DENSITY, pixelHeight = height * MASK_DENSITY
  const data = new Uint8Array(pixelWidth * pixelHeight)
  for (let y = 0; y < pixelHeight; y++) for (let x = 0; x < pixelWidth; x++) {
    if (hidden[Math.floor(y / MASK_DENSITY) * width + Math.floor(x / MASK_DENSITY)]) data[y * pixelWidth + x] = 255
  }
  return { data, width: pixelWidth, height: pixelHeight }
}

function maskTexture(mask) {
  const texture = new THREE.DataTexture(mask.data, mask.width, mask.height, THREE.RedFormat)
  texture.minFilter = texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

const VERTEX = `
  varying vec2 boardPoint;
  uniform vec2 roomSize;
  uniform float tileSize, fogTime;
  // Shallow billows grow from the floor, rather than lifting a flat fog deck.
  // Heights are in tile units and stay below the coloured seal's main curls.
  float fogHeight(float x, float z, float time) {
    float t=time*.48;
    float bank=.5+.5*sin(x*4.6+t+sin(z*3.7-t*.61)*.9);
    float fold=.5+.5*sin(x*10.8-z*8.4-t*.83+sin(z*5.1+t)*.65);
    return .012+bank*bank*.090+fold*fold*.038;
  }
  void main() {
    boardPoint = position.xz * roomSize * tileSize;
    vec3 point=position;
    point.y+=fogHeight(boardPoint.x/tileSize,boardPoint.y/tileSize,fogTime)*tileSize;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(point, 1.0);
  }
`

const FRAGMENT = `
  ${SEAL_HAZE_DENSITY_GLSL}
  uniform sampler2D fogFrom, fogTo;
  uniform float fogBlend, fogTime, tileSize, fogDensity;
  uniform vec2 roomSize;
  uniform vec3 fogDark, fogLight;
  varying vec2 boardPoint;
  vec2 gradient(vec2 p) {
    vec2 q=fract(p*vec2(.3183099,.3678794)+vec2(.113,.137));
    q+=dot(q,q+vec2(19.19,73.73));
    return fract(vec2(q.x*q.y*95.4337,(q.x+q.y)*q.x*97.5971))*2.0-1.0;
  }
  float noise(vec2 p) {
    vec2 i=floor(p),f=fract(p),u=f*f*f*(f*(f*6.0-15.0)+10.0);
    return mix(mix(dot(gradient(i),f),dot(gradient(i+vec2(1,0)),f-vec2(1,0)),u.x),
               mix(dot(gradient(i+vec2(0,1)),f-vec2(0,1)),dot(gradient(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y);
  }
  float turbulence(vec2 p) {
    mat2 octave=mat2(1.62,1.18,-1.18,1.62);
    float value=noise(p)*.57;
    p=octave*p+vec2(5.2,1.3); value+=noise(p)*.28;
    return value+noise(octave*p-vec2(3.4,7.1))*.15;
  }
  float coverage(vec2 uv) {
    float target=texture2D(fogTo,uv).r;
    return max(target,mix(texture2D(fogFrom,uv).r,target,fogBlend));
  }
  float darkMistAlpha(float haze, float flecks, float tufts) {
    float transmission=(1.0-sealHazeAlpha(haze,flecks,0.0))
                      *(1.0-sealHazeAlpha(haze,flecks,1.0))
                      *(1.0-sealHazeAlpha(haze,flecks,2.0));
    return (1.0-pow(transmission,fogDensity))*tufts;
  }
  void main() {
    vec2 uv=boardPoint/(tileSize*roomSize)+.5;
    float cover=coverage(uv);
    if(cover<.002) discard;
    // Fine, folded tufts flow across adjacent low three-dimensional billows.
    float t=fogTime*.14;
    vec2 p=boardPoint/tileSize*2.1;
    vec2 drift=vec2(t,-t*.7);
    vec2 broad=vec2(turbulence(p*.65+drift),turbulence(p*.65+vec2(8.3,2.8)-drift));
    vec2 folded=vec2(turbulence(p*.95+broad*2.4+vec2(1.7,9.2)),
                     turbulence(p*.95+broad*2.4+vec2(6.1,3.4)+drift*.4));
    vec2 flow=p*2.6+broad*2.8+folded*1.9;
    float cloud=turbulence(flow);
    float haze=smoothstep(-.24,.28,cloud);
    float detail=noise(flow*3.1-drift*.6);
    float flecks=smoothstep(-.18,.28,detail);
    float strand=noise(flow*1.8+drift);
    float wisps=1.0-smoothstep(.035,.24+fwidth(strand),abs(strand));
    float tufts=smoothstep(-.22,.05,cloud+detail*.10);
    // Compare optical density against all three coloured haze layers, without
    // clamping a multiplied alpha to an opaque sheet. Gaps stay transparent.
    float alpha=darkMistAlpha(haze,flecks,tufts)*smoothstep(0.0,1.0,cover);
    vec2 stepUv=.09/roomSize;
    float inside=min(min(coverage(uv+vec2(stepUv.x,0)),coverage(uv-vec2(stepUv.x,0))),
                     min(coverage(uv+vec2(0,stepUv.y)),coverage(uv-vec2(0,stepUv.y))));
    alpha*=mix(.30,1.0,inside);
    // Almost all smoke stays black. Only rare, broken wisp tips catch grey.
    float pale=smoothstep(.90,.99,wisps)*smoothstep(.16,.32,detail);
    float light=.006+haze*.012+pale*.20;
    vec3 colour=mix(fogDark,fogLight,light);
    if(alpha<.003) discard;
    gl_FragColor=vec4(colour,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export class ExplorationFog {
  constructor(parent, { tileSize, surfaceY }) {
    this.parent = parent
    this.tileSize = tileSize
    this.surfaceY = surfaceY
    this.elapsed = 0
    this.blend = 1
    const shared = this.shared = {
      fogFrom: { value: null }, fogTo: { value: null }, fogBlend: { value: 1 },
      fogTime: { value: 0 }, fogDensity: { value: UNEXPLORED_MIST_DENSITY }, roomSize: { value: new THREE.Vector2(1, 1) }, tileSize: { value: tileSize },
      fogDark: { value: new THREE.Color('#040404') }, fogLight: { value: new THREE.Color('#969696') },
    }
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
      uniforms: shared,
      vertexShader: VERTEX, fragmentShader: FRAGMENT,
    })
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.material)
    this.mesh.name = 'exploration-fog'
    this.mesh.frustumCulled = false
    this.mesh.position.y = surfaceY
    this.mesh.renderOrder = 99
    this.mesh.raycast = () => {}
    parent.add(this.mesh)
  }

  sync(room, hidden) {
    const key = room.id + ':' + room.width + ':' + room.height + ':' + Array.from(hidden, Number).join('')
    if (key === this.key) return
    const mask = explorationFogMask(room.width, room.height, hidden)
    const sameRoom = this.roomId === room.id && this.width === room.width && this.height === room.height
    const from = sameRoom ? new Uint8Array(mask.data.length) : mask.data.slice()
    if (sameRoom) for (let i = 0; i < from.length; i++) {
      from[i] = Math.round(this.from.image.data[i] * (1 - this.blend) + this.to.image.data[i] * this.blend)
    }
    this.from?.dispose()
    this.to?.dispose()
    this.from = maskTexture({ ...mask, data: from })
    this.to = maskTexture(mask)
    this.material.uniforms.fogFrom.value = this.from
    this.material.uniforms.fogTo.value = this.to
    this.material.uniforms.roomSize.value.set(room.width, room.height)
    this.blend = sameRoom ? 0 : 1
    this.material.uniforms.fogBlend.value = this.blend
    if (this.width !== room.width || this.height !== room.height) {
      this.mesh.geometry.dispose()
      this.mesh.geometry = new THREE.PlaneGeometry(1, 1, Math.min(160, room.width * 12), Math.min(160, room.height * 12)).rotateX(-Math.PI / 2)
    }
    this.mesh.scale.set(room.width * this.tileSize, 1, room.height * this.tileSize)
    this.mesh.visible = hidden.some(Boolean) || from.some(Boolean)
    this.roomId = room.id
    this.width = room.width
    this.height = room.height
    this.key = key
  }

  update(delta) {
    this.elapsed += delta
    this.blend = Math.min(1, this.blend + delta / FADE_SECONDS)
    this.material.uniforms.fogTime.value = this.elapsed
    this.material.uniforms.fogBlend.value = this.blend
    if (this.blend === 1 && !this.to?.image.data.some(Boolean)) this.mesh.visible = false
  }

  dispose() {
    this.parent.remove(this.mesh)
    this.from?.dispose()
    this.to?.dispose()
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
