import './styles.css'
import { GameRun } from './game/run.js'
import { GameScene } from './render/scene.js'
import { HUD } from './ui/hud.js'
import { WikiPage } from './ui/wiki.js'

if (window.location.pathname === '/wiki') {
  new WikiPage()
} else {
  const run = new GameRun()
  const hud = new HUD(run)
  const scene = new GameScene(run, hud.sceneContainer)

  window.addEventListener('beforeunload', () => {
    scene.dispose()
    hud.dispose()
  }, { once: true })
}
