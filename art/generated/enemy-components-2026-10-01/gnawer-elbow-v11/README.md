# 猩鬼肘部修正（模板包 11）

左右肘关节在父关节局部空间下移 3（Y −3）、前移 3（Z +3）。前臂和腕部手爪沿同一关节链整体移动，腕部连接与纹理裁剪保持原样，肘部保留搭接并避免静止姿态共面。

模板包 10 的已保存项目原位更新，仅调整使用猩鬼拆分贴图的肘关节。保留角色选择、手调坐标、部件与动作，其余敌人和旧版备份保持原样；模板包 11 再次加载不会叠加偏移。更早版本按既有流程安装当前模板。

- `editor-gnawer.png`：实际 `/animeedit` WebGL 五种动作，每种五个关键姿态。
- `editor-report.json`：25 个截图和五次动作播放记录。
- `game-gnawer.png`：实际游戏 Canvas 渲染器五种动作预览。

动画检查、构建、本次改动文件 ESLint 通过。全项目 ESLint 仍有 `island-slicer-web` 原有 42 个错误。页面截图未见肘部脱开；真实 Z 偏移消除了静止姿态的共面条件。

复现：独立测试浏览器调试端口 9228、本工作树 Vite 5173，运行 `node tools/enemy-component-browser.mjs editor-gnawer` 和 `python scripts/build-enemy-component-review.py --gnawer-elbow`。脚本会清空独立测试页面的动画缓存，不应对日常浏览器执行。
