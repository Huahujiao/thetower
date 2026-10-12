import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

function enemyAssetCache() {
  const configure = server => {
    server.middlewares.use((req, res, next) => {
      const url = new globalThis.URL(req.url, 'http://localhost')
      if (url.pathname.startsWith('/assets/enemies/') && ((url.pathname.endsWith('.png') && url.searchParams.has('v'))
        || /^\/assets\/enemies\/thumbnails\/[a-z-]+\/[a-z0-9-]+-[a-f0-9]{20}\.webp$/.test(url.pathname))) {
        const writeHead = res.writeHead
        res.writeHead = function (statusCode, ...args) {
          if (statusCode === 200 || statusCode === 304) {
            const policy = 'public, max-age=31536000, immutable'
            const headerIndex = typeof args[0] === 'string' ? 1 : 0
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
  return { name: 'enemy-asset-cache', configureServer: configure, configurePreviewServer: configure }
}

export default defineConfig({
  plugins: [vue(), enemyAssetCache()],
  server: {
    host: true,
    port: 3000,
    strictPort: false,
  },
})
