import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { runInNewContext } from 'node:vm'
import { createServer } from 'vite'

const workspace = resolve('.')
const temporaryRoot = resolve(workspace, 'tmp')
await mkdir(temporaryRoot, { recursive: true })
const fixture = await mkdtemp(resolve(temporaryRoot, 'dev-session-check-'))
const servers = []
// Execute the HTTP-served Vite client with browser events and observable IO.
// Only its environment import/module syntax is adapted for the isolated VM.
function evaluateClient(source, url) {
  const document = new EventTarget(), window = new EventTarget()
  const styles = []
  document.visibilityState = 'visible'
  document.querySelector = () => null
  document.querySelectorAll = () => []
  document.head = {
    appendChild: node => { styles.push(node); node.parentNode = document.head },
    removeChild: node => styles.splice(styles.indexOf(node), 1),
  }
  document.createElement = () => ({ setAttribute() {} })
  const effects = { sockets: 0, reloads: 0, timers: 0, styles }
  const context = {
    URL, document, window, EventTarget,
    console: { debug() {}, info() {}, log() {}, warn() {}, error() {} },
    location: { reload() { effects.reloads++ } },
    WebSocket: class extends EventTarget {
      constructor() { super(); effects.sockets++ }
    },
    setTimeout() { effects.timers++; return 1 },
    setInterval() { effects.timers++; return 1 },
    clearTimeout() {}, clearInterval() {},
  }
  const code = source.replace(/^import [^\n]+;$/gm, '')
    .replaceAll('import.meta.url', JSON.stringify(url))
    .replace(/^export \{([^}]+)\};$/m, 'globalThis.clientExports = {$1};')
  runInNewContext(code, context, { timeout: 2000 })
  return { effects, document, window, helpers: context.clientExports }
}
try {
  await writeFile(resolve(fixture, 'index.html'), '<!doctype html><script type="module" src="/Fixture.vue"></script>')
  await writeFile(resolve(fixture, 'Fixture.vue'), '<template><div class="sample">scene</div></template><style scoped>.sample{color:red}</style>')
  for (const mode of ['development', 'hmr']) {
    const server = await createServer({
      configFile: resolve(workspace, 'vite.config.js'), root: fixture, mode,
      cacheDir: resolve(fixture, 'cache-' + mode), logLevel: 'silent',
      optimizeDeps: { entries: [], include: [], noDiscovery: true },
      server: { host: '127.0.0.1', port: 0 },
    })
    servers.push(server)
    await server.listen()
    const base = 'http://127.0.0.1:' + server.httpServer.address().port
    const request = async path => {
      const response = await fetch(base + path, { signal: AbortSignal.timeout(8000) })
      assert.equal(response.status, 200, path)
      return response.text()
    }
    await request('/')
    const client = await request('/@vite/client')
    const component = await request('/Fixture.vue')
    const cssPath = component.match(/"([^"\n]+type=style[^"\n]+)"/)[1]
    const css = await request(cssPath)
    assert.match(css, /updateStyle/, 'Development styles still use the real Vite helper')
    const runtime = evaluateClient(client, base + '/@vite/client')
    if (mode === 'hmr') {
      assert.equal(server.config.server.hmr !== false, true)
      assert.equal(runtime.effects.sockets, 1, 'Opt-in hot mode still connects')
      assert.match(component, /import\.meta\.hot/)
    } else {
      assert.equal(server.config.server.hmr, false)
      assert.equal(server.config.server.ws, false)
      assert.doesNotMatch(component, /import\.meta\.hot/)
      runtime.helpers.updateStyle('fixture', '.sample{color:red}')
      assert.equal(runtime.effects.styles.length, 1)
      runtime.helpers.removeStyle('fixture')
      assert.equal(runtime.effects.styles.length, 0)
      const initialTimers = runtime.effects.timers // CSS insertion can schedule a cleanup.
      for (let i = 0; i < 5; i++) {
        runtime.document.visibilityState = 'hidden'
        runtime.document.dispatchEvent(new Event('visibilitychange'))
        runtime.window.dispatchEvent(new Event('pagehide'))
        runtime.document.visibilityState = 'visible'
        runtime.document.dispatchEvent(new Event('visibilitychange'))
        runtime.window.dispatchEvent(new Event('pageshow'))
      }
      await Promise.resolve()
      assert.equal(runtime.effects.sockets, 0, 'No reconnect/ping socket can trigger a reload')
      assert.equal(runtime.effects.reloads, 0)
      assert.equal(runtime.effects.timers, initialTimers, 'No restart polling is scheduled')
    }
    await server.close()
    servers.pop()
  }
  console.log('Dev session passed: quiet client survives hide/show with no socket, polling or reload; Vue/CSS helpers and opt-in HMR work.')
} finally {
  await Promise.all(servers.map(server => server.close()))
  assert(fixture.startsWith(temporaryRoot + sep))
  await rm(fixture, { recursive: true, force: true })
}
