# 敌人格子尺寸与骨架宽度（模板包 12）

格子中的所有敌人沿用各自原有的比例，再统一乘以 1.2。猩鬼和潮影幼兽的根关节静态 `scaleX` 乘以 1.15，在根节点展示旋转之前拉伸局部 X；整条骨架与关节绑定的贴图一起加宽，动作关键帧、部件尺寸和零厚度纸片保持原样。

版本 10、11 的存档原位升级，仅调整两种敌人的根关节横向比例；版本 10 同时补上已有肘部修正。保存与重新加载均保留横向比例，重复安装不会累加。手调内容、选中角色、其余敌人和旧版备份保留。

少数敌人的格子绘制位置作了平移，减少放大后的头部与尾部裁剪，未缩小比例。静止循环检查覆盖 33 种敌人、每种五个时间点；亡灵卫的边缘仍有约一像素接触边界。160 像素格子画布仍会裁剪越界动作，例如猩鬼死亡下落时的足部；没有改写动作来限制其轨迹。

- `size-all.png`：实际游戏 Canvas 渲染器、33 种敌人的格子预览，每格 160 像素，以 2 倍像素显示。
- `size-gnawer.png`、`size-tide-shadow-cub.png`：两种敌人五种动作、每种五个姿态的格子预览。
- `*-bounds.json`：在更大透明画布中测得的实际可见轮廓边界，包含越界信息。
- `editor-gnawer.png`、`editor-tide-shadow-cub.png`：实际 `/animeedit` WebGL 接触图，验证横向加宽后的连接。
- `editor-report.json`：50 个编辑器姿态、10 次动作播放记录。

动画检查、构建与改动文件的 ESLint 通过。全项目 ESLint 仍有 `island-slicer-web` 的 42 个既有错误。

复现：独立浏览器 9228、本工作树 Vite 5173，执行 `node tools/enemy-component-browser.mjs size-all`、`size-gnawer`、`size-tide-shadow-cub`、`editor-size`，再执行 `python scripts/build-enemy-component-review.py --enemy-size`。测试脚本会清空独立浏览器页面的动画缓存，不应对日常浏览器运行。
