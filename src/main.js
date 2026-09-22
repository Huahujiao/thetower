import './styles.css'
import { createApp } from 'vue'
import { GameRun } from './game/run.js'
import AnimeEditor from './ui/AnimeEditor.vue'
import AnimePreview from './ui/AnimePreview.vue'
import VueHud from './ui/VueHud.vue'
import { WikiPage } from './ui/wiki.js'

const pathname = window.location.pathname.replace(/\/$/, '') || '/'

if (pathname === '/wiki') {
  new WikiPage()
} else if (pathname === '/animeedit' || pathname === '/animepreview') {
  const Page = pathname === '/animeedit' ? AnimeEditor : AnimePreview
  const app = createApp(Page)
  app.mount('#hud')

  window.addEventListener('beforeunload', () => {
    app.unmount()
  }, { once: true })
} else {
  const run = new GameRun()
  const app = createApp(VueHud, { run })
  app.mount('#hud')

  window.addEventListener('beforeunload', () => {
    app.unmount()
  }, { once: true })
}
