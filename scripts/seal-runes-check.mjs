import assert from 'node:assert/strict'
import { Color } from 'three'
import { createSealRunes } from '../src/render/seal-runes.js'

const time = { value: 0 }, dissolve = { value: 0 }, color = new Color('#b4444b'), tint = { value: new Color('#ffffff') }
const mesh = createSealRunes({ seed: .7, size: 1.14, time, dissolve, color, tint })
try {
  assert.equal(mesh.material.uniforms.runeTime, time)
  assert.equal(mesh.material.uniforms.runeDissolve, dissolve)
  assert.equal(mesh.material.uniforms.runeColor.value, color)
  assert.equal(mesh.material.uniforms.runeTint, tint)
  assert.equal(mesh.geometry.attributes.position.count, 24)
  assert.equal(mesh.geometry.index.count, 36)
  assert.equal(new Set(mesh.geometry.attributes.runeSlot.array).size, 6)
  assert(Math.max(...mesh.geometry.index.array) < 24)
  const picks = []
  mesh.raycast(null, picks)
  assert.equal(picks.length, 0, 'Floating symbols never intercept board clicks')
  const shader = mesh.material.vertexShader
  const helpers = 'const sin=Math.sin;const fract=v=>v-Math.floor(v);const smoothstep=(a,b,v)=>{const t=Math.min(1,Math.max(0,(v-a)/(b-a)));return t*t*(3-2*t)};'
  function sampler(name, args, dependencies = '') {
    const start = shader.indexOf('float ' + name + '('), begin = shader.indexOf('{', start), end = shader.indexOf('}', begin)
    assert(start >= 0 && end > begin)
    const body = shader.slice(begin + 1, end).replace(/\bfloat\b/g, 'let')
    return new Function(...args, helpers + dependencies + body)
  }
  const hash = sampler('runeHash', ['n'])
  const clock = sampler('runeClock', ['time', 'seed', 'slot', 'runeHash'])
  const height = sampler('runeHeight', ['phase'])
  const pattern = sampler('runePattern', ['seed', 'slot', 'cycle'])
  const visibility = sampler('runeVisibility', ['phase'])
  assert.equal(visibility(0), 0)
  assert.equal(visibility(1), 0, 'A new random symbol appears while the old one is transparent')
  assert(visibility(.5) > .99)
  assert(visibility(.1) < visibility(.2))
  assert(visibility(.9) < visibility(.7))
  for (const seed of [0, .7, 1.6, 3.2, 8]) {
    const speeds = [], patterns = new Set()
    for (let slot = 0; slot < 6; slot++) {
      const speed = clock(1, seed, slot, hash) - clock(0, seed, slot, hash)
      assert(speed >= .115 && speed <= .17)
      speeds.push(speed)
      assert(height(.2 + speed) > height(.2), 'Each symbol actually rises in 3D over time')
      assert.equal(clock(3, seed, slot, hash), clock(3, seed, slot, hash), 'Frozen time is stable')
      for (let cycle = 0; cycle < 3; cycle++) patterns.add(pattern(seed, slot, cycle))
    }
    assert.equal(new Set(speeds).size, 6, 'Rising speeds are staggered')
    assert.equal(patterns.size, 18, 'Slots and successive lifetimes receive different curve patterns')
  }
  time.value = 2
  color.set('#18c040')
  assert.equal(mesh.material.uniforms.runeColor.value.getHexString(), '18c040', 'Changing the main colour updates existing symbols')
  assert.equal(mesh.material.uniforms.runeTime.value, 2, 'Recolouring preserves the rising timeline')
  dissolve.value = .5
  assert.equal(mesh.material.uniforms.runeDissolve.value, .5)
  console.log('Seal runes passed: six non-pickable billboards, rising height, staggered speeds, fade/reseed cycles, stable frozen time and shared live colour/dissolve.')
} finally {
  mesh.geometry.dispose()
  mesh.material.dispose()
}
