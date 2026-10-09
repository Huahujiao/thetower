import { Color } from 'three'

// Closed skin panels retain their textured detail but fill transparent cutout
// margins with skin color, so source PNG contours cannot punch torso holes.
export function applyTextureBacking(material, color, texture = null) {
  if (!color) return
  material.onBeforeCompile = shader => {
    shader.uniforms.skinBackingColor = { value: new Color(color) }
    if (texture) shader.uniforms.skinBackingMap = { value: texture }
    shader.fragmentShader = `uniform vec3 skinBackingColor;\n${texture ? 'uniform sampler2D skinBackingMap;\n' : ''}${shader.fragmentShader}`
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 skinSample = texture2D(map, vMapUv);
          vec3 skinBacking = ${texture ? 'texture2D(skinBackingMap, fract(vMapUv * vec2(2.0, 1.0))).rgb' : 'skinBackingColor'};
          diffuseColor.rgb *= mix(skinBacking, skinSample.rgb, skinSample.a);
          diffuseColor.a = opacity;
        #endif
      `)
  }
  material.customProgramCacheKey = () => texture ? 'skin-panel-texture-backing' : 'skin-panel-backing'
}
