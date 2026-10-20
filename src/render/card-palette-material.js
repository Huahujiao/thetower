import { Vector3 } from 'three'
import { CARD_BACK_COLOR_DEFAULTS, cardBackColorHsl, normalizeCardBackPalette } from '../settings/card-back-palette.js'

const bindings = new WeakMap()

export function createCardPaletteUniforms(palette = CARD_BACK_COLOR_DEFAULTS) {
  const uniforms = Object.fromEntries(Object.keys(CARD_BACK_COLOR_DEFAULTS).map(kind => [kind, {
    active: { value: 0 }, target: { value: new Vector3() },
    reference: { value: new Vector3(...cardBackColorHsl(CARD_BACK_COLOR_DEFAULTS[kind])) },
  }]))
  updateCardPaletteUniforms(uniforms, palette)
  return uniforms
}

export function updateCardPaletteUniforms(uniforms, palette) {
  const colors = normalizeCardBackPalette(palette)
  for (const kind of Object.keys(CARD_BACK_COLOR_DEFAULTS)) {
    uniforms[kind].active.value = colors[kind] === CARD_BACK_COLOR_DEFAULTS[kind] ? 0 : 1
    uniforms[kind].target.value.set(...cardBackColorHsl(colors[kind]))
  }
}

export function refreshCardPaletteMaterial(material) {
  const binding = bindings.get(material)
  if (!binding) return
  binding.active.value = binding.source?.active.value || 0
  if (binding.source) {
    binding.target.value.copy(binding.source.target.value)
    binding.reference.value.copy(binding.source.reference.value)
  }
}

// Each material owns stable uniform objects, even when a body switches between
// blocked, revealed and attribute states. Input events only update their values.
export function applyCardPaletteMaterial(material, source = null) {
  let binding = bindings.get(material)
  if (!binding) {
    binding = { source, active: { value: 0 }, target: { value: new Vector3() }, reference: { value: new Vector3() } }
    bindings.set(material, binding)
    const previous = material.onBeforeCompile
    material.onBeforeCompile = shader => {
      previous?.(shader)
      Object.assign(shader.uniforms, { uCardPaletteActive: binding.active, uCardPaletteTarget: binding.target, uCardPaletteReference: binding.reference })
      shader.fragmentShader = `
        uniform float uCardPaletteActive;
        uniform vec3 uCardPaletteTarget, uCardPaletteReference;
        vec3 cardPaletteSrgb(vec3 c) {
          return mix(c*12.92, 1.055*pow(max(c,vec3(0.0)),vec3(1.0/2.4))-.055, step(vec3(.0031308),c));
        }
        vec3 cardPaletteLinear(vec3 c) {
          return mix(c/12.92, pow((c+.055)/1.055,vec3(2.4)), step(vec3(.04045),c));
        }
        vec3 cardPaletteHsl(vec3 c) {
          float hi=max(c.r,max(c.g,c.b)), lo=min(c.r,min(c.g,c.b));
          float d=hi-lo, l=(hi+lo)*.5, h=0.0, s=0.0;
          if(d>.00001) {
            s=d/max(.00001,1.0-abs(2.0*l-1.0));
            if(hi==c.r) h=mod((c.g-c.b)/d+6.0,6.0);
            else if(hi==c.g) h=(c.b-c.r)/d+2.0;
            else h=(c.r-c.g)/d+4.0;
            h/=6.0;
          }
          return vec3(h,s,l);
        }
        vec3 cardPaletteRgb(vec3 hsl) {
          vec3 wave=clamp(abs(mod(hsl.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0);
          float chroma=(1.0-abs(2.0*hsl.z-1.0))*hsl.y;
          return (wave-.5)*chroma+hsl.z;
        }
        ${shader.fragmentShader}
      `.replace('#include <alphamap_fragment>', `
        if(uCardPaletteActive>.5) {
          vec3 hsl=cardPaletteHsl(cardPaletteSrgb(clamp(diffuseColor.rgb,0.0,1.0)));
          float hueOffset=fract(hsl.x-uCardPaletteReference.x+.5)-.5;
          hsl.x=fract(uCardPaletteTarget.x+clamp(hueOffset,-.012,.012)+1.0);
          hsl.y=clamp(uCardPaletteTarget.y*clamp(hsl.y/max(uCardPaletteReference.y,.05),.86,1.10),0.0,1.0);
          hsl.z=clamp(uCardPaletteTarget.z*hsl.z/max(uCardPaletteReference.z,.04),0.0,1.0);
          diffuseColor.rgb=cardPaletteLinear(clamp(cardPaletteRgb(hsl),0.0,1.0));
        }
        #include <alphamap_fragment>
      `)
    }
    const previousKey = material.customProgramCacheKey
    material.customProgramCacheKey = function () { return previousKey.call(this) + '|card-palette-v1' }
    material.needsUpdate = true
  }
  binding.source = source
  refreshCardPaletteMaterial(material)
  return material
}
