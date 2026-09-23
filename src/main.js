import './styles.css'
import { createApp } from 'vue'

const pathname = window.location.pathname.replace(/\/$/, '') || '/'

if (pathname === '/wiki') {
  import('./ui/wiki.js').then(({ WikiPage }) => new WikiPage())
} else if (pathname === '/animeedit' || pathname === '/animepreview') {
  const page = pathname === '/animeedit' ? import('./ui/AnimeEditor.vue') : import('./ui/AnimePreview.vue')
  page.then(({ default: Page }) => {
    const app = createApp(Page)
    app.mount('#hud')
    window.addEventListener('beforeunload', () => app.unmount(), { once: true })
  })
} else {
  Promise.all([import('./game/run.js'), import('./ui/VueHud.vue')]).then(([{ GameRun }, { default: VueHud }]) => {
    const run = new GameRun()
    const app = createApp(VueHud, { run })
    app.mount('#hud')
    window.addEventListener('beforeunload', () => app.unmount(), { once: true })
  })
}
