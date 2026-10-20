import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

function runtimeAssetCache() {
  const configure = (server, built = false) => {
    server.middlewares.use((req, res, next) => {
      const url = new globalThis.URL(req.url, 'http://localhost')
      const versionedEnemy = url.pathname.startsWith('/assets/enemies/') && ((/\.(?:png|webp)$/.test(url.pathname) && url.searchParams.has('v'))
        || /^\/assets\/enemies\/thumbnails\/[a-z-]+\/[a-z0-9-]+-[a-f0-9]{20}\.webp$/.test(url.pathname))
      // Source URLs must revalidate so art edits remain visible in development.
      const builtAsset = built && /^\/assets\/[^/]+-[\w-]{8}\.(?:js|css|png|jpe?g|webp|svg|hdr|woff2?)$/.test(url.pathname)
      const moduleRequest = ['import', 'raw', 'url'].some(key => url.searchParams.has(key))
      if ((versionedEnemy || builtAsset) && !moduleRequest) {
        const writeHead = res.writeHead
        res.writeHead = function (statusCode, ...args) {
          const headerIndex = typeof args[0] === 'string' ? 1 : 0
          const headers = args[headerIndex]
          const type = headers?.['Content-Type'] || headers?.['content-type'] || this.getHeader('Content-Type')
          // SPA fallbacks can return HTML with status 200 at a missing asset URL.
          if ((statusCode === 200 || statusCode === 304) && !String(type).includes('text/html')) {
            const policy = 'public, max-age=31536000, immutable'
            // sirv passes its headers directly to writeHead, which would
            // otherwise override a policy set with res.setHeader alone.
            if (args[headerIndex]) args[headerIndex] = { ...args[headerIndex], 'Cache-Control': policy }
            this.setHeader('Cache-Control', policy)
          }
          return writeHead.call(this, statusCode, ...args)
        }
      }
      next()
    })
  }
  return {
    name: 'runtime-asset-cache',
    configureServer: server => configure(server),
    configurePreviewServer: server => configure(server, true),
  }
}

// Vite 8 still serves its client (also used for CSS helpers) when hmr/ws are
// false. Stop its connection side effect too: otherwise a backgrounded phone
// can enter the disconnect -> successful ping -> location.reload path.
function quietDevClient() {
  const connection = 'transport.connect(createHMRHandler(handleMessage));'
  return {
    name: 'quiet-dev-client',
    apply: 'serve',
    enforce: 'post',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').split('?')[0].endsWith('/vite/dist/client/client.mjs')) return
      if (code.split(connection).length !== 2) {
        this.error('Vite client changed: review quiet-dev-client before serving the mobile session.')
      }
      return { code: code.replace(connection, '// Development connection disabled for stable mobile sessions.'), map: null }
    },
  }
}

export default defineConfig(({ mode }) => {
  const hot = mode === 'hmr'
  return {
    plugins: [vue(), runtimeAssetCache(), !hot && quietDevClient()],
    preview: { host: true, port: 4173, strictPort: true },
    server: {
      host: true,
      port: 3000,
      strictPort: false,
      hmr: hot,
      ws: hot ? {} : false,
      forwardConsole: hot,
    },
  }
})
