import './styles.css'
import { GameRun } from './game/run.js'
import { GameScene } from './render/scene.js'
import { HUD } from './ui/hud.js'

const run = new GameRun()
const hud = new HUD(run)
const scene = new GameScene(run, hud.sceneContainer)

window.addEventListener('beforeunload', () => {
  scene.dispose()
  hud.dispose()
}, { once: true })
