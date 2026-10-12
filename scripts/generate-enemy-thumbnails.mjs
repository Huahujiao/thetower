import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { createServer } from 'vite'
import { createEnemyPreviewModels } from '../src/animation/shadow-preview-models.js'
import { enemyThumbnailModelRevision } from '../src/render/enemy-thumbnail-cache.js'
import { ENEMY_TEXTURE_STYLES, enemyTextureUrl } from '../src/animation/enemy-texture-styles.js'
import { ENEMY_THUMBNAIL_WIDTH as width, ENEMY_THUMBNAIL_HEIGHT as height } from '../src/render/enemy-thumbnail-settings.js'

const root = resolve(import.meta.dirname, '..')
const manifestPath = join(root, 'src/render/enemy-thumbnails.generated.json')
const previous = JSON.parse(await readFile(manifestPath, 'utf8'))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const rendererFiles = ['render/enemy-thumbnails.js', 'render/enemy-thumbnail-settings.js', 'render/texture-backing.js',
  'animation/shadow-rig.js', 'animation/shadow-grounding.js', 'animation/shadow-geometry.js', 'animation/shadow-texture-geometry.js']
const rendererRevision = hash(Buffer.concat(await Promise.all(rendererFiles.map(file => readFile(join(root, 'src', file))))))
const textureHashes = new Map()
const models = createEnemyPreviewModels()
const manifest = { width, height, styles: ENEMY_TEXTURE_STYLES.map(style => style.id), enemies: [] }
const pending = []
for (const model of models) {
  const entry = { enemyId: model.enemyId, name: model.name, images: {} }
  manifest.enemies.push(entry)
  for (const style of ENEMY_TEXTURE_STYLES) {
    const textures = [...new Set(model.parts.flatMap(part => [part.visual.texture, part.visual.skinTexture].filter(Boolean)))]
      .map(url => enemyTextureUrl(url, style.id).split('?')[0]).sort()
    const resources = []
    for (const url of textures) {
      if (!textureHashes.has(url)) textureHashes.set(url, hash(await readFile(join(root, 'public', url))))
      resources.push([url, textureHashes.get(url)])
    }
    const revision = hash(JSON.stringify([rendererRevision, enemyThumbnailModelRevision(model), resources])).slice(0, 20)
    const url = `/assets/enemies/thumbnails/${style.id}/${model.enemyId}-${revision}.webp`
    entry.images[style.id] = { url, revision }
    if (!existsSync(join(root, 'public', url))) pending.push({ enemyId: model.enemyId, style: style.id, url })
  }
}

// Use the real browser/WebGL renderer, so baked portraits match the preview.
// Unchanged files need no browser and keep stable URLs across builds/devices.
let browser, server, socket, profile
try {
  if (pending.length) {
    const executable = [process.env.ENEMY_THUMBNAIL_BROWSER,
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(path => path && existsSync(path))
    if (!executable) throw new Error('Set ENEMY_THUMBNAIL_BROWSER to a Chrome/Chromium executable to generate changed portraits.')
    server = await createServer({ root, configFile: false, appType: 'custom', server: { host: '127.0.0.1', port: 0 } })
    server.middlewares.use('/__enemy-thumbnails', (_req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>')
    })
    await server.listen()
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`
    profile = await mkdtemp(join(tmpdir(), 'flip-enemy-thumbnails-'))
    browser = spawn(executable, ['--headless=new', '--no-first-run', '--no-default-browser-check',
      '--disable-background-networking', '--no-sandbox', '--disable-gpu-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--remote-allow-origins=*', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
    let browserDiagnostics = ''
    browser.stderr.on('data', bytes => { browserDiagnostics = `${browserDiagnostics}${bytes}`.slice(-4000) })
    let launchError
    browser.on('error', error => { launchError = error })
    const portFile = join(profile, 'DevToolsActivePort')
    for (let i = 0; !existsSync(portFile); i++) {
      if (launchError) throw launchError
      if (i >= 200 || browser.exitCode !== null) throw new Error(`Headless browser did not start. ${browserDiagnostics}`)
      await delay(100)
    }
    const debugPort = (await readFile(portFile, 'utf8')).split('\n')[0]
    let targets
    for (let i = 0; !targets; i++) {
      try { targets = await (await globalThis.fetch(`http://127.0.0.1:${debugPort}/json/list`)).json() }
      catch (error) { if (i > 20) throw error; await delay(100) }
    }
    socket = new globalThis.WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
    await new Promise((accept, reject) => {
      socket.addEventListener('open', accept, { once: true })
      socket.addEventListener('error', event => reject(new Error(`CDP connection failed: ${event.message}`, { cause: event.error })), { once: true })
    })
    let serial = 0
    const requests = new Map()
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data)
      if (!message.id) return
      const request = requests.get(message.id)
      if (!request) return
      clearTimeout(request.timer)
      requests.delete(message.id)
      if (message.error) request.reject(new Error(message.error.message))
      else request.accept(message.result)
    })
    const command = (method, params = {}) => new Promise((accept, reject) => {
      const id = ++serial
      const timer = setTimeout(() => { requests.delete(id); reject(new Error(`Browser timeout: ${method}`)) }, 60000)
      requests.set(id, { accept, reject, timer })
      socket.send(JSON.stringify({ id, method, params }))
    })
    const evaluate = async expression => {
      const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
      return result.result.value
    }
    await command('Page.navigate', { url: `${origin}/__enemy-thumbnails` })
    for (let i = 0; await evaluate('location.pathname') !== '/__enemy-thumbnails'; i++) {
      if (i > 100) throw new Error('Thumbnail renderer page did not load.')
      await delay(100)
    }
    await evaluate(`(async () => {
      const { createEnemyPreviewModels } = await import('/src/animation/shadow-preview-models.js');
      const { createEnemyThumbnailRenderer } = await import('/src/render/enemy-thumbnails.js');
      globalThis.portraitModels = createEnemyPreviewModels();
      globalThis.portraitRenderer = createEnemyThumbnailRenderer();
    })()`)
    for (const job of pending) {
      const data = await evaluate(`globalThis.portraitRenderer.render(globalThis.portraitModels.find(p => p.enemyId === ${JSON.stringify(job.enemyId)}), ${JSON.stringify(job.style)})`)
      if (!data?.startsWith('data:image/webp;base64,')) throw new Error(`Invalid portrait: ${job.enemyId}/${job.style}`)
      const path = join(root, 'public', job.url)
      await mkdir(resolve(path, '..'), { recursive: true })
      await writeFile(path, Buffer.from(data.split(',')[1], 'base64'))
      console.log(`Rendered ${job.style}/${job.enemyId}`)
    }
    await evaluate('globalThis.portraitRenderer.dispose()')
  }
  let total = 0
  for (const style of manifest.styles) {
    let bytes = 0
    for (const entry of manifest.enemies) bytes += (await readFile(join(root, 'public', entry.images[style].url))).length
    if (bytes > 10 * 1000 * 1000) throw new Error(`Thumbnail set exceeds 10 MB: ${style}`)
    total += bytes
    console.log(`${style}: ${manifest.enemies.length} portraits, ${(bytes / 1000000).toFixed(3)} MB`)
  }
  const json = `${JSON.stringify(manifest, null, 2)}\n`
  if (await readFile(manifestPath, 'utf8') !== json) await writeFile(manifestPath, json, 'utf8')
  const active = new Set(manifest.enemies.flatMap(entry => Object.values(entry.images).map(image => image.url)))
  for (const entry of previous.enemies) for (const image of Object.values(entry.images)) {
    if (!active.has(image.url) && /^\/assets\/enemies\/thumbnails\/[a-z-]+\/[a-z0-9-]+\.webp$/.test(image.url)) {
      await rm(join(root, 'public', image.url), { force: true })
    }
  }
  console.log(`Generated ${pending.length}, reused ${models.length * manifest.styles.length - pending.length}; all styles ${(total / 1000000).toFixed(3)} MB.`)
} finally {
  socket?.close()
  if (browser && browser.exitCode === null) {
    const stopped = new Promise(accept => browser.once('exit', accept))
    browser.kill()
    await stopped
  }
  await server?.close()
  if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
