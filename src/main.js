// 《黑塔》M2 + M3 —— 主入口：串联数据 / 状态 / 3D 场景 / HUD / 自动存档
import './styles.css'
import { GameState } from './game/state.js'
import { GameScene } from './render/scene.js'
import { HUD } from './ui/hud.js'

const state = new GameState()
// HUD 模板内生成 #app（牌局场景容器），先建 HUD 再获取场景容器
new HUD(state)
const app = document.getElementById('app')

let scene = new GameScene(state, app)

// 棋盘整体重建（读档 / 换层 / 重开）时同步重建 3D 场景
function rebuildScene() {
  scene.dispose()
  scene = new GameScene(state, app)
}
window.addEventListener('game:restart', rebuildScene)
state.on('floor:start', rebuildScene)

// 若读取到存档，棋盘已被替换为存档内容，需重建 3D 场景并刷新 HUD
if (state._loaded) {
  state.bus.emit('change')
  window.dispatchEvent(new CustomEvent('game:restart'))
}
