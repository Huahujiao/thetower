import { mkdirSync, writeFileSync } from 'node:fs'
import { BATCH5_COMPONENT_ENEMY_IDS } from '../src/animation/shadow-enemy-components-batch5.js'
/* global fetch, WebSocket */

// Run only against the isolated headless test browser, never a user's tab.
const target = (await (await fetch('http://127.0.0.1:9228/json/list')).json()).find(t => t.type === 'page')
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }))
let serial = 0
const pending = new Map()
ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data), request = pending.get(message.id)
  if (!request) return
  pending.delete(message.id)
  if (message.error) request.reject(new Error(JSON.stringify(message.error)))
  else request.resolve(message.result)
})
const call = (method, params = {}) => new Promise((resolve, reject) => {
  pending.set(++serial, { resolve, reject }); ws.send(JSON.stringify({ id: serial, method, params }))
})
const evaluate = async expression => {
  const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
  return r.result.value
}
const output = 'art/generated/enemy-completion-2026-10-08/review'
mkdirSync(output, { recursive: true })
const report = []
await call('Page.enable'); await call('Runtime.enable')
for (const id of ['batch5', 'all', ...BATCH5_COMPONENT_ENEMY_IDS]) {
  await call('Emulation.setDeviceMetricsOverride', { width: id === 'batch5' || id === 'all' ? 900 : 1500, height: 1700, deviceScaleFactor: 1, mobile: false })
  await call('Page.navigate', { url: `http://127.0.0.1:5173/tools/enemy-completion-review.html${id === 'batch5' ? '' : `?enemy=${id}`}` })
  for (let i = 0; i < 100; i++) {
    if (await evaluate('Boolean(window.reviewReady)')) break
    if (i === 99) throw new Error(`${id}: preview did not become ready`)
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  const poses = await evaluate('window.reviewReport')
  if (!poses.length || poses.some(p => !p.textured || !p.visible || !p.diagonal)) throw new Error(`${id}: missing rendered textures`)
  const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  writeFileSync(`${output}/${id}.png`, Buffer.from(shot.data, 'base64'))
  report.push(...poses)
}
writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2)+'\n')
// Check actual editor selection, cache installation and playback as well.
await call('Emulation.setDeviceMetricsOverride', { width: 1000, height: 950, deviceScaleFactor: 1, mobile: false })
await call('Page.navigate', { url: 'http://127.0.0.1:5173/animeedit' })
for (let i = 0; i < 100; i++) {
  if (await evaluate("Boolean(document.querySelector('.anime-character-select'))")) break
  if (i === 99) throw new Error('Editor did not become ready')
  await new Promise(resolve => setTimeout(resolve, 100))
}
const editorReport = []
for (const enemyId of BATCH5_COMPONENT_ENEMY_IDS) {
  const partCount = await evaluate(`(()=>{const roster=JSON.parse(localStorage.getItem('thetower-shadow-puppet-roster-v3'));const c=roster.characters.find(c=>c.project.enemyId===${JSON.stringify(enemyId)});if(!c)throw new Error('Missing editor template');const s=document.querySelector('.anime-character-select');s.value=c.id;s.dispatchEvent(new Event('change',{bubbles:true}));return c.project.parts.length})()`)
  await new Promise(resolve => setTimeout(resolve, 180))
  await evaluate("document.querySelectorAll('.anime-editor-menu button')[3].click()")
  await new Promise(resolve => setTimeout(resolve, 80))
  for (const action of ['idle', 'move', 'attack', 'hit', 'death']) {
    await evaluate(`(async()=>{const {SHADOW_ANIMATION_TYPES}=await import('/src/animation/shadow-rig.js');document.querySelectorAll('.anime-animation-tabs button')[SHADOW_ANIMATION_TYPES.findIndex(a=>a.id===${JSON.stringify(action)})].click()})()`)
    await evaluate("document.querySelector('.anime-playback-row button').click()")
    await new Promise(resolve => setTimeout(resolve, 170))
    const played = await evaluate("document.querySelector('.anime-playback-row span').textContent")
    await evaluate("document.querySelector('.anime-playback-row button').click()")
    if (played.startsWith('0 /')) throw new Error(`${enemyId}/${action}: editor playback stalled`)
    editorReport.push({ enemyId, action, partCount, played })
  }
}
writeFileSync(`${output}/editor-report.json`, JSON.stringify(editorReport, null, 2)+'\n')
console.log(`Rendered ${report.length} real Three.js poses with all textures loaded; ${editorReport.length} editor playback actions passed.`)
ws.close()
