import { writeFileSync, mkdirSync } from 'node:fs'
/* global fetch, WebSocket, setTimeout */

const tabs = await (await fetch('http://127.0.0.1:9228/json/list')).json()
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl)
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }))
let id = 0
const pending = new Map()
ws.addEventListener('message', ({data}) => {
  const message = JSON.parse(data)
  if (!message.id) return
  const entry = pending.get(message.id)
  if (!entry) return
  pending.delete(message.id)
  if (message.error) entry.reject(new Error(JSON.stringify(message.error)))
  else entry.resolve(message.result)
})
const call = (method, params = {}) => new Promise((resolve,reject) => {
  pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))
})
await call('Page.enable');await call('Runtime.enable')
await call('Page.addScriptToEvaluateOnNewDocument', { source: "if(location.host === '127.0.0.1:5173'){localStorage.removeItem('thetower-shadow-puppet-roster-v3');localStorage.removeItem('thetower-shadow-puppet-project-v3')}" })
const enemy = process.argv[2] || 'all'
const orbitReview = enemy.startsWith('orbit-batch')
const editor = enemy.startsWith('editor') || orbitReview
const sizeReview = enemy.startsWith('size-')
const batchIds = ['rot-walker','shellguard','wisp','moss-colossus','sentry-crossbow','ash-cannon-bug']
const thirdIds = ['furnace-beetle','thorn-shell-flower','water-leech-swarm','whirlpool-eye-sac','cinder-curse-lamp-swarm','drown-shadow-hunter']
const fourthIds = ['tidal-spore-sac','revenant-guard','bomb-wisp','cracked-hunter','broodling','leech-larva','tide-shadow']
const singleThirdEditor = thirdIds.includes(enemy.replace(/^editor-/, ''))
const singleFourthEditor = fourthIds.includes(enemy.replace(/^editor-/, ''))
const batch4 = enemy.endsWith('-batch4') || fourthIds.includes(enemy.replace(/^(?:size|editor)-/, ''))
const batch3 = enemy.endsWith('-batch3') || thirdIds.includes(enemy.replace(/^(?:size|editor)-/, ''))
const batch2 = enemy === 'editor-batch2' || enemy === 'orbit-batch2' || batchIds.includes(enemy.replace(/^size-/, '')) || enemy === 'batch2'
const batchOutput = batch4 ? 'art/generated/enemy-components-batch4-2026-10-01/review' : batch3 ? 'art/generated/enemy-components-batch3-2026-10-01/review' : batch2 ? 'art/generated/enemy-components-batch2-2026-10-01/review' : null
await call('Emulation.setDeviceMetricsOverride',{width:editor ? 840 : 1640,height:editor ? 850 : 1800,deviceScaleFactor:1,mobile:false})
const route = editor ? '/animeedit' : sizeReview ? `/tools/enemy-size-review.html${enemy === 'size-all' ? '' : `?enemy=${enemy.slice(5)}`}` : `/tools/enemy-component-review.html?enemy=${enemy}`
await call('Page.navigate',{url:`http://127.0.0.1:5173${route}`})
for (let tries=0;tries<100;tries++) {
  const r = await call('Runtime.evaluate',{expression:editor ? "Boolean(document.querySelector('.anime-character-select'))" : 'window.reviewReady',returnByValue:true})
  if (r.result.value) break
  if (tries===99) throw new Error('Review page failed to load')
  await new Promise(resolve=>setTimeout(resolve,100))
}
await new Promise(resolve=>setTimeout(resolve,500))
mkdirSync('art/generated/enemy-components-2026-10-01/review',{recursive:true})
if (enemy === 'editor-all' || enemy === 'editor-gnawer' || enemy === 'editor-size' || enemy === 'editor-batch2' || enemy === 'editor-batch3' || enemy === 'editor-batch4' || singleThirdEditor || singleFourthEditor || orbitReview) {
  const evaluate = async expression => {
    const r = await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
    return r.result.value
  }
  await evaluate("document.querySelectorAll('.anime-editor-menu button')[3].click()")
  await evaluate("document.querySelector('.rig-stage-options input').checked && document.querySelector('.rig-stage-options input').click()")
  const ids = singleThirdEditor || singleFourthEditor ? [enemy.slice(7)] : batch4 ? fourthIds : batch3 ? thirdIds : batch2 ? batchIds : enemy === 'editor-size' ? ['gnawer','tide-shadow-cub'] : enemy === 'editor-gnawer' ? ['gnawer'] : ['gnawer','emberwing-moth','rootrot-bud','tide-shadow-cub','nest-spider','beetle-guard']
  const output = batchOutput || (enemy === 'editor-size' ? 'art/generated/enemy-components-2026-10-01/enemy-size-v12' : enemy === 'editor-gnawer' ? 'art/generated/enemy-components-2026-10-01/gnawer-elbow-v11' : 'art/generated/enemy-components-2026-10-01/review')
  mkdirSync(output,{recursive:true})
  const actions = ['idle','move','attack','hit','death'], report = []
  for (const id of ids) {
    await evaluate(`(()=>{const roster=JSON.parse(localStorage.getItem('thetower-shadow-puppet-roster-v3'));const c=roster.characters.find(c=>c.project.enemyId===${JSON.stringify(id)});const select=document.querySelector('.anime-character-select');select.value=c.id;select.dispatchEvent(new Event('change',{bubbles:true}));return c.project.parts.length})()`)
    await evaluate("document.querySelectorAll('.anime-editor-menu button')[3].click()")
    await evaluate("document.querySelector('.rig-stage-options input').checked && document.querySelector('.rig-stage-options input').click()")
    await new Promise(resolve=>setTimeout(resolve,250))
    if (orbitReview) {
      await evaluate("(()=>{const b=document.querySelectorAll('.shadow-view-controls button')[0];if(!b.classList.contains('active')) b.click()})()")
      await new Promise(resolve=>setTimeout(resolve,200))
      if (!await evaluate("document.querySelectorAll('.shadow-view-controls button')[0].classList.contains('active')")) throw new Error('Orbit review is not in 3D mode')
      const rect = await evaluate("(()=>{const r=document.querySelector('.shadow-stage').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()")
      for (let view = 0; view < 3; view++) {
        if (view) {
          await call('Input.dispatchMouseEvent',{type:'mousePressed',x:rect.x,y:rect.y,button:'left',clickCount:1})
          for (let step=1;step<=8;step++) await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:rect.x+step*15,y:rect.y+step*3,button:'left',buttons:1})
          await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:rect.x+120,y:rect.y+24,button:'left',clickCount:1})
          await new Promise(resolve=>setTimeout(resolve,250))
        }
        const shot=await call('Page.captureScreenshot',{format:'png',clip:{x:Math.round(rect.x-220),y:Math.round(rect.y-220),width:440,height:440,scale:1}})
        const path=`${output}/orbit-${id}-${view}.png`
        writeFileSync(path,Buffer.from(shot.data,'base64'));report.push({id,view,path})
      }
      continue
    }
    for (const action of actions) {
      await evaluate(`(async()=>{const {SHADOW_ANIMATION_TYPES}=await import('/src/animation/shadow-rig.js');document.querySelectorAll('.anime-animation-tabs button')[SHADOW_ANIMATION_TYPES.findIndex(a=>a.id===${JSON.stringify(action)})].click()})()`)
      await new Promise(resolve=>setTimeout(resolve,100))
      await evaluate("document.querySelector('.anime-playback-row button').click()")
      await new Promise(resolve=>setTimeout(resolve,120))
      const played = await evaluate("document.querySelector('.anime-playback-row span').textContent")
      await evaluate("document.querySelector('.anime-playback-row button').click()")
      if (played.startsWith('0 /')) throw new Error(`${id}/${action} did not play`)
      for (const fraction of [0,.27,.64,.85,1]) {
        await evaluate(`(()=>{const s=document.querySelector('.anime-scrubber input');s.value=Number(s.max)*${fraction};s.dispatchEvent(new Event('input',{bubbles:true}))})()`)
        await new Promise(resolve=>setTimeout(resolve,65))
        const bounds = await evaluate(`(()=>{const r=document.querySelector('.shadow-stage').getBoundingClientRect();const size=${batchOutput ? 440 : 360};return {x:Math.round(r.x+r.width/2-size/2),y:Math.round(r.y+r.height/2-size/2),width:size,height:size,scale:1}})()`)
        const shot = await call('Page.captureScreenshot',{format:'png',clip:bounds})
        const path=`${output}/editor-${id}-${action}-${fraction}.png`
        writeFileSync(path,Buffer.from(shot.data,'base64'))
        report.push({id,action,fraction,played,path})
      }
    }
  }
  writeFileSync(`${output}/${orbitReview ? 'orbit' : singleThirdEditor || singleFourthEditor ? enemy : 'editor'}-report.json`,JSON.stringify(report,null,2)+'\n')
  console.log(orbitReview ? `Verified ${report.length} actual 3D editor views.` : `Verified ${report.length} actual editor poses and ${ids.length * actions.length} playback actions.`)
  ws.close()
  process.exit(0)
}
const screenshot = await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})
const output = batchOutput || (sizeReview ? 'art/generated/enemy-components-2026-10-01/enemy-size-v12' : 'art/generated/enemy-components-2026-10-01/review')
mkdirSync(output,{recursive:true})
const path = `${output}/${enemy}.png`
writeFileSync(path,Buffer.from(screenshot.data,'base64'))
if (sizeReview) {
  const report = await call('Runtime.evaluate',{expression:'window.sizeReport',returnByValue:true})
  writeFileSync(`${output}/${enemy}-bounds.json`,JSON.stringify(report.result.value,null,2)+'\n')
  console.log(JSON.stringify(report.result.value.filter(r => r.left < 0 || r.right > 159 || r.top < 0 || r.bottom > 159)))
}
console.log(path)
ws.close()
