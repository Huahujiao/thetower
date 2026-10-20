import * as THREE from 'three'

// Separate open curls occupy different radii and heights. Each carries its
// silhouette around at its own speed; the fine detail follows the same curl.
function flowSheets({ seed, size, time, color, dissolve }, strands, detail = false) {
  const positions = [], uvs = [], seeds = [], paths = [], layers = [], bodies = [], indices = []
  const count = strands.length, segments = 64, crossSegments = detail ? 2 : 6
  for (let strand = 0; strand < count; strand++) {
    const start = positions.length / 3
    const curl = strands[strand]
    for (let step = 0; step <= segments; step++) {
      for (let side = 0; side <= crossSegments; side++) {
        positions.push(0, 0, 0)
        uvs.push(side / crossSegments, step / segments)
        seeds.push(seed * 1.71 + strand * 2.17)
        paths.push(curl.angle, curl.span, curl.radius, curl.speed)
        layers.push(curl.height)
        bodies.push(curl.width, curl.thickness)
      }
      if (step < segments) for (let side = 0; side < crossSegments; side++) {
        const b = start + step * (crossSegments + 1) + side
        const next = b + crossSegments + 1
        indices.push(b, b + 1, next, b + 1, next + 1, next)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  for (const [name, values, count] of [['position', positions, 3], ['uv', uvs, 2], ['flowSeed', seeds, 1], ['flowPath', paths, 4], ['flowHeight', layers, 1], ['flowBody', bodies, 2]]) {
    geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, count))
  }
  geometry.setIndex(indices)
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    uniforms: {
      plumeTime: time, plumeColor: { value: color }, plumeDissolve: dissolve,
      flowSize: { value: size }, flowDetail: { value: detail ? 1 : 0 },
    },
    vertexShader: `
      uniform float plumeTime,plumeDissolve,flowSize,flowDetail;
      attribute float flowSeed,flowHeight;
      attribute vec4 flowPath;
      attribute vec2 flowBody;
      varying vec2 streamUv,streamGround;
      varying float streamSeed,streamSpeed;
      vec3 centre(float u) {
        float t=plumeTime;
        // Rotation is independent from the wave travelling along the bank.
        float drift=t*flowPath.w;
        float motionRate=.85+flowPath.w*1.6+.10*sin(flowSeed);
        float travel=u-t*(.14+.025*sin(flowSeed))*motionRate;
        float arch=pow(max(0.0,sin(clamp(u,0.0,1.0)*3.14159265)),.55);
        float bend=sin(travel*7.0+flowSeed)*.16
                  +sin(u*13.0+t*.72*motionRate+flowSeed)*.055
                  +sin(u*23.0-t*.94*motionRate+flowSeed)*.022;
        float a=flowPath.x+drift+u*flowPath.y+bend;
        float crest=pow(.5+.5*sin(travel*9.5+flowSeed
                         +sin(u*4.0-t*.62*motionRate)*.75),1.7);
        float breathing=sin(t*.82*motionRate+flowSeed);
        // The contour contracts, spreads and rises even after cancelling its
        // angular rotation; crest positions migrate instead of staying fixed.
        float radius=flowPath.z-u*u*.09+arch*sin(travel*6.0+flowSeed)*.052;
        radius+=arch*breathing*.018;
        radius+=sin(u*11.0+t*.88*motionRate+flowSeed)*.016;
        radius+=arch*(sin(u*17.0-t*.76*motionRate+flowSeed)*.014+sin(u*31.0+t*.61)*.007);
        radius=max(.045,radius)-flowDetail*.012;
        vec2 xy=vec2(cos(a),sin(a))*radius;
        float swell=.84+.16*sin(t*.93*motionRate+flowSeed+u*2.1);
        float height=.026+flowHeight+arch*(.026+crest*.145)*swell;
        height+=arch*sin(u*5.5-t*1.08*motionRate+flowSeed)*.025;
        height-=flowDetail*.008;
        return vec3(xy,height)*flowSize;
      }
      void main() {
        streamUv=uv;streamSeed=flowSeed;streamSpeed=flowPath.w;
        float motionRate=.85+flowPath.w*1.6+.10*sin(flowSeed);
        vec3 point=centre(uv.y);
        vec3 tangent=normalize(centre(uv.y+.001)-centre(uv.y-.001));
        vec3 across=normalize(vec3(-tangent.y,tangent.x,
          .36+.58*sin(uv.y*7.5-plumeTime*.92*motionRate+flowSeed)
          +.16*sin(uv.y*17.0+plumeTime*.63*motionRate+flowSeed)));
        float width=mix(flowBody.x*1.12,.085,flowDetail)*(1.0+.34*sin(uv.y*9.0-plumeTime*1.2*motionRate+flowSeed))
                    *(.92+.08*sin(plumeTime*.85*motionRate+flowSeed));
        float taper=.15+.85*pow(max(0.0,sin(uv.y*3.14159265)),.65);
        point+=across*(uv.x-.5)*width*taper*flowSize;
        // A rounded, pleated cross-section gives each wide bank a thick belly.
        float crossPoint=uv.x*2.0-1.0;
        float belly=pow(max(0.0,1.0-crossPoint*crossPoint),.7);
        float fold=sin(uv.y*13.0+crossPoint*4.5-plumeTime*1.06*motionRate+flowSeed);
        point.z+=belly*(flowBody.y*.72+fold*.016)*taper*flowSize*mix(1.0,.4,flowDetail);
        float rolledLip=pow(max(0.0,1.0-abs(crossPoint-.55)*2.6),2.0);
        float lipCurl=.5+.5*sin(uv.y*15.0-plumeTime*1.18*motionRate+flowSeed);
        point.z+=rolledLip*lipCurl*.035*taper*flowSize*mix(1.0,.35,flowDetail);
        point.z=max(.012*flowSize,point.z);
        streamGround=point.xy/flowSize;
        point.z+=plumeDissolve*.12;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(point,1.0);
      }
    `,
    fragmentShader: `
      uniform float plumeTime,plumeDissolve,flowDetail;
      uniform vec3 plumeColor;
      varying vec2 streamUv,streamGround;
      varying float streamSeed,streamSpeed;
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
      vec2 flowCoordinate(float u,float across) {
        float flowTime=plumeTime*(.70+streamSpeed*1.8);
        float along=u*5.2-flowTime*.85+streamSeed*2.3;
        float transverse=(across-.5)*3.4+sin(u*4.0-flowTime*.65+streamSeed)*.17;
        return vec2(along,transverse);
      }
      void main() {
        float u=streamUv.y,across=streamUv.x;
        float flowTime=plumeTime*(.70+streamSpeed*1.8);
        vec2 drift=vec2(flowTime*.12,-flowTime*.085);
        vec2 q=flowCoordinate(u,across);
        vec2 warp=vec2(fbm(q*.8+drift),fbm(q*.8+vec2(7.1,3.4)-drift));
        vec2 flow=q+warp*1.7;
        // Local eddies fold neighbouring wisps together without turning the
        // whole bank into a continuous bright ring or a band of parallel waves.
        float eddyCentre=2.4+.65*sin(flowTime*.43+streamSeed);
        vec2 eddy=vec2(u*5.2-eddyCentre, (across-.5)*3.4);
        float curl=exp(-dot(eddy,eddy)*.85)*(1.15+.25*sin(flowTime*.72+streamSeed));
        flow+=vec2(-eddy.y,eddy.x)*curl;
        float cloud=fbm(flow*1.45-drift);
        float crease=noise(flow*3.8+vec2(3.7,8.2)-drift*.6);
        float fine=noise(flow*6.5+warp-drift*.7);
        float pores=noise(q*13.0+drift);
        float bank=smoothstep(-.22,.23,cloud);
        float centre=.5+warp.x*.22;
        float core=1.0-smoothstep(.08,.36,abs(across-centre));
        // Broad, feathered tufts carry the smoke; creases sit softly inside
        // them instead of drawing crisp luminous outlines around each bank.
        float edge=1.0-smoothstep(.12,.54,abs(across-.5)+warp.y*.10+crease*.05);
        edge*=1.0-smoothstep(.42,.50,abs(across-.5));
        float broken=smoothstep(-.34,.20,cloud+fine*.06+pores*.025);
        float ridge=1.0-smoothstep(.012,.095+fwidth(crease),abs(crease));
        float secondary=1.0-smoothstep(.012,.075+fwidth(crease),abs(crease+.13+fine*.05));
        float lip=.73+warp.x*.16+fine*.015;
        float rim=1.0-smoothstep(.030,.130+fwidth(across),abs(across-lip));
        float strands=smoothstep(-.18,.24,cloud+fine*.16);
        ridge*=strands;
        rim*=smoothstep(-.12,.15,crease+cloud*.6);
        float ends=smoothstep(0.0,.14,u)*(1.0-smoothstep(.72,1.0,u));
        float body=(.055+core*.135+bank*.21)*mix(.45,1.0,broken);
        float folds=ridge*.14+secondary*.055+rim*.12;
        float alpha=edge*ends*(body+folds)*(.76+bank*.24)*(1.0-plumeDissolve);
        alpha*=mix(1.0,.42,flowDetail)*(1.0-smoothstep(.44,.54,max(abs(streamGround.x),abs(streamGround.y))));
        // Low-contrast folds remain inside a visible, cottony cloud body.
        // Use normal alpha blending: the reference is smoke, not neon emission.
        float light=.42+bank*.28+ridge*.30+secondary*.10+rim*.26;
        vec3 colour=plumeColor*light;
        if(alpha<.004)discard;
        gl_FragColor=vec4(colour,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = detail ? 'seal-flow-filaments' : 'seal-energy-sheets'
  mesh.frustumCulled = false
  mesh.raycast = () => {}
  return mesh
}

export function createSealCurls(options) {
  const phase = options.seed * 1.71
  const variation = .5 + .5 * Math.sin(options.seed * 12.73 + .8)
  const outerCount = variation > .46 ? 4 : 3
  const innerCount = Math.sin(options.seed * 8.31 + 1.4) > 0 ? 2 : 1
  const speedScale = .94 + variation * .12
  // Keep broad banks staggered in radius and height, with open ends. The inner
  // banks have their own phase and motion, rather than filling a closed ring.
  const strands = Array.from({ length: outerCount }, (_, index) => ({
    angle: phase + [.1, 2.3, 4.65, 1.25][index] + .22 * Math.sin(phase + index * 2.3),
    span: [1.25, 1.50, 1.35, 1.05][index] + .14 * Math.sin(phase * .7 + index),
    radius: [.35, .32, .38, .29][index] + .015 * Math.sin(phase + index),
    speed: [.185, .212, .174, .199][index] * speedScale,
    height: [.03, .07, .045, .09][index],
    width: [.25, .28, .235, .26][index],
    thickness: [.042, .035, .05, .038][index],
  }))
  for (let index = 0; index < innerCount; index++) strands.push({
    angle: phase + 1.05 + index * 3.15 + .3 * Math.cos(phase * .8 + index),
    span: 1.65 + index * .2 + .15 * Math.sin(phase + index),
    radius: [.145, .205][index] + .012 * Math.sin(phase * 1.3 + index),
    speed: [.165, .193][index] * speedScale,
    height: [.015, .055][index],
    width: [.23, .21][index],
    thickness: [.032, .04][index],
  })
  // One extra bank bridges the inner and outer smoke at a distinct height.
  strands.push({
    angle: phase + 3.55 + .18 * Math.sin(phase * .8),
    span: 1.30 + .12 * Math.sin(phase + 2.1),
    radius: .245 + .012 * Math.cos(phase),
    speed: .181 * speedScale,
    height: .10,
    width: .245,
    thickness: .043,
  })
  const mesh = flowSheets(options, strands)
  const filaments = flowSheets(options, strands, true)
  mesh.add(filaments)
  mesh.userData.filaments = filaments
  return mesh
}
