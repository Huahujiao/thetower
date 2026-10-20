import assert from 'node:assert/strict'
import { Color } from 'three'
import { createSealCurls } from '../src/render/seal-curls.js'

// Evaluate the scalar expressions from the actual shaders. Removing the angular
// rotation must still leave changing radii/heights; texture advection is checked
// separately so a rotating mesh cannot make this regression pass.
const helpers = 'const {sin,cos,pow,max}=Math;const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));'
function body(shader, signature) {
  const start = shader.indexOf(signature)
  assert(start >= 0)
  const begin = shader.indexOf('{', start), end = shader.indexOf('\n      }', begin)
  assert(end > begin)
  return shader.slice(begin + 1, end).replace(/\/\/[^\n]*/g, '').replace(/\bfloat\b/g, 'let')
}
function centreSampler(shader) {
  const code = body(shader, 'vec3 centre(float u)')
    .replace('vec2 xy=vec2(cos(a),sin(a))*radius;', 'let xy=[cos(a)*radius,sin(a)*radius];')
    .replace('return vec3(xy,height)*flowSize;', 'return [xy[0]*flowSize,xy[1]*flowSize,height*flowSize];')
  return new Function('u', 'plumeTime', 'flowPath', 'flowSeed', 'flowHeight', 'flowDetail', 'flowSize', helpers + code)
}
function textureSampler(shader) {
  const code = body(shader, 'vec2 flowCoordinate(float u,float across)')
    .replace('return vec2(along,transverse);', 'return [along,transverse];')
  return new Function('u', 'across', 'plumeTime', 'streamSpeed', 'streamSeed', helpers + code)
}
const summaries = []
for (const seed of [0, .2, .7, 1, 2, 8, 19]) {
  const clock = { value: 2 }, dissolve = { value: 0 }
  const mesh = createSealCurls({ seed, size: 1.14, time: clock, color: new Color('#b4b7b7'), dissolve })
  const centre = centreSampler(mesh.material.vertexShader), flow = textureSampler(mesh.material.fragmentShader)
  assert(mesh.material.fragmentShader.includes('vec2 q=flowCoordinate(u,across);'))
  const paths = mesh.geometry.attributes.flowPath, seeds = mesh.geometry.attributes.flowSeed, heights = mesh.geometry.attributes.flowHeight
  const seen = new Set(), speeds = []
  for (let i = 0; i < paths.count; i++) {
    const phase = seeds.getX(i)
    if (seen.has(phase)) continue
    seen.add(phase)
    const path = { x: paths.getX(i), y: paths.getY(i), z: paths.getZ(i), w: paths.getW(i) }, height = heights.getX(i)
    speeds.push(path.w)
    let radialChange = 0, heightChange = 0, localMotion = 0, count = 0
    for (let u = .15; u < .9; u += .1) {
      const a = centre(u, 2, path, phase, height, 0, 1)
      const b = centre(u, 3, path, phase, height, 0, 1)
      assert.deepEqual(a, centre(u, 2, path, phase, height, 0, 1), 'A frozen clock produces a stable silhouette')
      const angle = -path.w, c = Math.cos(angle), s = Math.sin(angle)
      const unrotated = [b[0] * c - b[1] * s, b[0] * s + b[1] * c, b[2]]
      radialChange += Math.abs(Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]))
      heightChange += Math.abs(a[2] - b[2])
      localMotion += Math.hypot(...a.map((v, k) => v - unrotated[k]))
      count++
    }
    radialChange /= count; heightChange /= count; localMotion /= count
    assert(radialChange > .008, 'The curl expands/contracts independently of rotation')
    assert(heightChange > .012, 'Crests must rise/fall visibly within one second')
    assert(localMotion > .025, 'Cancelling the angular rotation still leaves shape motion')
    const q0 = flow(.5, .5, 2, path.w, phase), q1 = flow(.5, .5, 3, path.w, phase)
    assert(q0[0] - q1[0] > .75, 'Fine detail travels along the bank instead of staying glued to UVs')
    for (const t of [0, 2, 3, 11, 80]) for (const u of [-.001, 0, .5, 1, 1.001]) {
      const point = centre(u, t, path, phase, height, 0, 1)
      assert(point.every(Number.isFinite), 'Endpoint/tangent samples remain finite')
      assert(point[2] > 0, 'The animated centreline remains above the floor')
    }
    summaries.push({ radialChange, heightChange, localMotion })
  }
  assert(speeds.length >= 5 && speeds.length <= 7, 'Each seal adds one bank to the previous four-to-six curls')
  assert.equal(new Set(speeds).size, speeds.length, 'Individual curls keep different rotation speeds')
  assert.equal(mesh.material.uniforms.plumeTime, clock)
  assert.equal(mesh.userData.filaments.material.uniforms.plumeTime, clock)
  mesh.traverse(part => { part.geometry?.dispose(); part.material?.dispose() })
}
const min = key => Math.min(...summaries.map(row => row[key])).toFixed(4)
console.log('Seal motion passed across '+summaries.length+' curls: independent rotation, travelling height/radius waves, advected detail and stable frozen frames. Minimum one-second changes (tile units): radius '+min('radialChange')+', height '+min('heightChange')+', motion after cancelling rotation '+min('localMotion'))
