import './styles.css'
import { createApp } from 'vue'
import { GameRun } from './game/run.js'
import VueHud from './ui/VueHud.vue'
import WhiteLineHud from './ui/WhiteLineHud.vue'
import { WikiPage } from './ui/wiki.js'

if (window.location.pathname === '/wiki') {
  new WikiPage()
} else {
  const run = new GameRun()
  const Hud = window.location.pathname === '/whiteline' ? WhiteLineHud : VueHud
  const app = createApp(Hud, { run })
  app.mount('#hud')

  window.addEventListener('beforeunload', () => {
    app.unmount()
  }, { once: true })
}
