import './styles.css'
import { createApp } from 'vue'

const pathname = window.location.pathname.replace(/\/$/, '') || '/'

if (pathname === '/wiki' || pathname.startsWith('/wiki/')) {
  import('./ui/wiki.js').then(({ WikiPage }) => new WikiPage())
} else if (pathname === '/animeedit' || pathname === '/animepreview' || pathname === '/animedetail' || pathname.startsWith('/animedetail/')) {
  const page = pathname === '/animeedit' ? import('./ui/AnimeEditor.vue')
    : pathname === '/animepreview' ? import('./ui/AnimePreview.vue') : import('./ui/AnimeDetail.vue')
  page.then(({ default: Page }) => {
    const app = createApp(Page)
    app.mount('#hud')
    window.addEventListener('beforeunload', () => app.unmount(), { once: true })
  })
} else {
  const artTweak = pathname === '/arttweak'
  if (artTweak) {
    document.title = '\u7f8e\u672f\u8c03\u6574\u6b8b\u5c40'
    document.body.classList.add('art-tweak-page')
  }
  const model = artTweak ? import('./game/art-tweak.js') : import('./game/run.js')
  Promise.all([model, import('./ui/VueHud.vue')]).then(([model, { default: VueHud }]) => {
    const run = artTweak ? model.createArtTweakRun() : new model.GameRun()
    const app = createApp(VueHud, { run })
    app.mount('#hud')
    window.addEventListener('beforeunload', () => app.unmount(), { once: true })
  })
}
