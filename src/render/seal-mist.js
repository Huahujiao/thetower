import * as THREE from 'three'
import { createSealCurls } from './seal-curls.js'
import { createSealRunes } from './seal-runes.js'
import { SEAL_HAZE_DENSITY_GLSL } from './mist-density.js'
import { loadCardBackPalette, normalizeCardBackPalette } from '../settings/card-back-palette.js'

// Abstract geometric sigils only: never draw text into the ornament masks.
function sealTexture(index) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, 256, 256)
  ctx.translate(128, 128)
  ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 2.1
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // Offset arcs, orbital dots and an open diamond are deliberately non-alphabetic.
  ctx.rotate(index * Math.PI / 7)
  for (let arm = 0; arm < 3; arm++) {
    ctx.save(); ctx.rotate(arm * Math.PI * 2 / 3)
    ctx.beginPath(); ctx.ellipse(4, 0, 17, 10, .55, -.7, 2.3); ctx.stroke()
    ctx.beginPath(); ctx.arc(22, -4, 1.7, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }
  ctx.beginPath(); ctx.moveTo(-4, -8); ctx.lineTo(5, -1); ctx.lineTo(-2, 7); ctx.stroke()
  for (const [x, y, angle] of [[-87, -60, -.35], [86, 51, .26]]) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle + index * .08)
    ctx.globalAlpha = .65; ctx.lineWidth = 1
    ctx.beginPath(); ctx.ellipse(0, 0, 5, 10, 0, -.9, 4.2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(-3, -4); ctx.lineTo(3, 0); ctx.lineTo(-3, 4); ctx.stroke()
    ctx.beginPath(); ctx.arc(0, -8, 1.2, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.userData.boardShared = true
  return texture
}

export class SealMist {
  constructor(palette = loadCardBackPalette()) {
    this.time = { value: 0 }
    this.seals = Array.from({ length: 4 }, (_, index) => sealTexture(index))
    this.colors = { neutral: new THREE.Color('#b4b7b7'), blocked: new THREE.Color('#77756c') }
    this.materials = new Set()
    this.setPalette(palette)
  }

  setPalette(palette) {
    for (const [kind, hex] of Object.entries(normalizeCardBackPalette(palette))) {
      this.colors[kind] ||= new THREE.Color()
      this.colors[kind].set(hex)
    }
  }

  material(texture, seed = 0, relief = null) {
    const kind = texture?.userData.cardBackKind || 'neutral'
    const tint = new THREE.Color(0xffffff)
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      uniforms: {
        mistTime: this.time, mistColor: { value: this.colors[kind] || this.colors.neutral },
        mistTint: { value: tint }, mistSeed: { value: seed },
        mistArt: { value: texture }, mistRelief: { value: relief }, mistHasRelief: { value: relief ? 1 : 0 },
        mistArtGain: { value: ({ neutral: 1.45, wither: 1.25, drown: 1.2 })[kind] || 1 },
        mistReference: { value: new THREE.Color(({ neutral: '#656565', scorch: '#602a2a', wither: '#68601c', drown: '#284263', blocked: '#303436' })[kind]) },
        mistSeal: { value: this.seals[(texture?.userData.cardBackVariant || 0) % 4] },
        mistDissolve: { value: 0 }, mistHover: { value: 0 }, mistLayer: { value: 0 },
      },
      vertexShader: `
        varying vec2 mistUv;
        uniform float mistLayer, mistTime, mistSeed;
        void main() {
          mistUv = uv;
          vec3 point = position;
          point.z+=mistLayer*(.016+.014*sin(uv.x*7.0+mistTime*.7+mistSeed)*cos(uv.y*6.0-mistTime*.54));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(point, 1.0);
        }
      `,
      fragmentShader: `
        ${SEAL_HAZE_DENSITY_GLSL}
        uniform float mistTime, mistSeed, mistDissolve, mistHover, mistLayer;
        uniform vec3 mistColor, mistTint;
        uniform sampler2D mistSeal, mistArt, mistRelief;
        uniform vec3 mistReference;
        uniform float mistHasRelief, mistArtGain;
        varying vec2 mistUv;
        vec2 gradient(vec2 p) {
          p = fract(p*vec2(.3183099, .3678794)+vec2(.113,.137));
          p += dot(p,p+vec2(19.19,73.73));
          return fract(vec2(p.x*p.y*95.4337,(p.x+p.y)*p.x*97.5971))*2.0-1.0;
        }
        float noise(vec2 p) {
          vec2 i=floor(p), f=fract(p), u=f*f*(3.0-2.0*f);
          return mix(mix(dot(gradient(i),f),dot(gradient(i+vec2(1,0)),f-vec2(1,0)),u.x),
                     mix(dot(gradient(i+vec2(0,1)),f-vec2(0,1)),dot(gradient(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y);
        }
        float fbm(vec2 p) {
          mat2 turn=mat2(1.62,1.18,-1.18,1.62);
          float f=noise(p)*.57;
          p=turn*p+vec2(8.3,2.8); f+=noise(p)*.28;
          return f+noise(turn*p-vec2(3.4,7.1))*.15;
        }
        void main() {
          vec2 uv=mistUv, p=(uv-.5)*1.7;
          float t=mistTime*.27*(1.0-mistLayer*.11);
          p*=1.0-mistLayer*.10;
          vec2 offset=vec2(mistSeed*7.1,mistSeed*3.7);
          p+=offset;
          // Layered, directionless tufts fill the spaces between the open curls.
          vec2 drift=vec2(t*.55,-t*.37);
          vec2 warp=vec2(fbm(p*1.6+drift),fbm(p*1.6+vec2(8.3,2.8)-drift));
          vec2 flow=p+warp*.95;
          float cloud=fbm(flow*2.2+drift);
          float haze=smoothstep(-.24,.28,cloud);
          float flecks=smoothstep(-.18,.28,fbm(flow*4.7-drift*.6));
          vec2 d=abs(uv-.5)*2.0;
          float edge=max(d.x,d.y);
          float boundary=(1.0-smoothstep(.52,1.02,edge+cloud*.20))*(1.0-smoothstep(.90,1.0,edge));
          
          float erosion=smoothstep(-.20,.22,noise(p*2.3+warp*.3+drift));
          float seal=texture2D(mistSeal,uv+warp*.012).a*(1.0-step(.5,mistLayer));
          seal*=mix(.5,1.0,erosion)*(1.0-smoothstep(.12,.4,cloud));
          float radius=length((uv-.5)*2.0);
          float clearing=smoothstep(mistDissolve*1.8-.15,mistDissolve*1.8+.14,radius+cloud*.16);
          if(mistDissolve<=.001) clearing=1.0;
          vec2 artUv=clamp(uv+warp*.014,vec2(.002),vec2(.998));
          vec3 art=texture2D(mistArt,artUv).rgb;
          float artValue=clamp(dot(art,vec3(.2126,.7152,.0722))/max(.02,dot(mistReference,vec3(.2126,.7152,.0722))),.2,2.1);
          float etch=0.0;
          if(mistHasRelief>.5) etch=smoothstep(.045,.24,length(texture2D(mistRelief,artUv,1.5).rg*2.0-1.0));
          vec3 pigment=mistColor;
          // The reference keeps thin ornament traces readable through the haze.
          // Give those traces local opacity instead of darkening the whole tile.
          float tracery=smoothstep(1.02,1.72,artValue)*mix(.45,1.0,erosion)+etch*.25;
          float veilAlpha=sealHazeAlpha(haze,flecks,0.0);
          float traceAlpha=tracery*.18+seal*.055;
          vec3 hazeColour=pigment*(.33+haze*.20);
          vec3 traceColour=pigment*(.57+artValue*.17+seal*.32)*mistArtGain;
          vec3 colour=(hazeColour*veilAlpha+traceColour*traceAlpha)/max(.001,veilAlpha+traceAlpha);
          float alpha=boundary*(veilAlpha+traceAlpha)*clearing*(1.0-mistDissolve);
          if(mistLayer>.5) {
            // The middle layer carries soft body; the higher veil thins out.
            float upper=step(1.5,mistLayer);
            float stream=sealHazeAlpha(haze,flecks,mistLayer);
            alpha=boundary*stream*clearing*(1.0-mistDissolve);
            colour=pigment*mix(.38+haze*.32,.43+haze*.32,upper);
          } else {
            colour+=pigment*haze*.045;
          }
          colour+=pigment*mistHover*.035;
          if(alpha<.005) discard;
          gl_FragColor=vec4(colour*mistTint,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    })
    material.map = texture
    material.color = tint
    material.userData.sealMist = true
    this.materials.add(material)
    material.addEventListener('dispose', () => this.materials.delete(material))
    return material
  }

  veil(material, size) {
    const cloud = this.material(material.map, material.uniforms.mistSeed.value + .73, material.uniforms.mistRelief.value)
    cloud.uniforms.mistLayer.value = 1
    cloud.uniforms.mistDissolve = material.uniforms.mistDissolve
    cloud.uniforms.mistHover = material.uniforms.mistHover
    const veil = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.08, size * 1.08, 32, 32), cloud)
    veil.name = 'seal-mist-wisps'
    veil.position.z = .025
    veil.raycast = () => {}
    const highCloud = this.material(material.map, material.uniforms.mistSeed.value + 1.61, material.uniforms.mistRelief.value)
    highCloud.uniforms.mistLayer.value = 2
    highCloud.uniforms.mistDissolve = material.uniforms.mistDissolve
    highCloud.uniforms.mistHover = material.uniforms.mistHover
    // Reuse the middle veil's mesh data; only height, scale and noise differ.
    const upperMist = new THREE.Mesh(veil.geometry, highCloud)
    upperMist.name = 'seal-mist-upper-veil'
    upperMist.position.z = .055
    upperMist.scale.set(1.04, 1.04, 1)
    upperMist.raycast = () => {}
    veil.userData.upperMist = upperMist
    veil.add(upperMist)
    const seed = material.uniforms.mistSeed.value
    const runes = createSealRunes({ seed, size, time: this.time, color: material.uniforms.mistColor.value,
      tint: material.uniforms.mistTint, dissolve: material.uniforms.mistDissolve })
    this.materials.add(runes.material)
    runes.material.addEventListener('dispose', () => this.materials.delete(runes.material))
    veil.userData.runes = runes
    veil.add(runes)
    const plumes = createSealCurls({ seed, size, time: this.time, color: material.uniforms.mistColor.value, dissolve: material.uniforms.mistDissolve })
    plumes.traverse(object => {
      if (!object.material) return
      this.materials.add(object.material)
      object.material.addEventListener('dispose', () => this.materials.delete(object.material))
    })
    veil.userData.plumes = plumes
    veil.add(plumes)
    return veil
  }

  update(delta) { this.time.value += delta }

  dispose() {
    for (const material of this.materials) material.dispose()
    for (const texture of this.seals) texture.dispose()
  }
}
