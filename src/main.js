import './styles.css'
import { createApp } from 'vue'
import { finishStartup } from './ui/startup-status.js'

const pathname = window.location.pathname.replace(/\/$/, '') || '/'

async function mountPage() {
  if (pathname === '/wiki' || pathname.startsWith('/wiki/')) {
    const { WikiPage } = await import('./ui/wiki.js')
    new WikiPage()
    finishStartup()
    return
  }
  if (pathname === '/animeedit' || pathname === '/animepreview' || pathname === '/animedetail' || pathname.startsWith('/animedetail/')) {
    const page = pathname === '/animeedit' ? import('./ui/AnimeEditor.vue')
      : pathname === '/animepreview' ? import('./ui/AnimePreview.vue') : import('./ui/AnimeDetail.vue')
    const { default: Page } = await page
    const app = createApp(Page)
    app.mount('#hud')
    finishStartup()
    window.addEventListener('beforeunload', () => app.unmount(), { once: true })
    return
  }
  // Both real runs and the review fixture use the same finished art direction.
  document.body.classList.add('temple-game-page')
  const artTweak = pathname === '/arttweak'
  if (artTweak) {
    document.title = '\u7f8e\u672f\u8c03\u6574\u6b8b\u5c40'
    document.body.classList.add('art-tweak-page')
  }
  const model = artTweak ? import('./game/art-tweak.js') : import('./game/run.js')
  const [loadedModel, { default: VueHud }] = await Promise.all([model, import('./ui/VueHud.vue')])
  const run = artTweak ? loadedModel.createArtTweakRun() : new loadedModel.GameRun()
  const app = createApp(VueHud, { run })
  app.mount('#hud')
  // VueHud removes the HTML placeholder after its first paint, before 3D imports.
  window.addEventListener('beforeunload', () => app.unmount(), { once: true })
}

await mountPage()
