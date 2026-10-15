# 卡背花纹浮雕法线（2026-10-15）

五种当前使用的卡背分别有独立的 512×512 RGB OpenGL 切线空间法线贴图，与运行时颜色画布使用相同 UV。颜色原图不作修改。

| 卡背 | 颜色贴图 | 法线贴图 |
| --- | --- | --- |
| 中性 | board-card-back-temple-v2.jpg | board-card-back-neutral-normal-v1.png |
| 红色 | board-card-back-scorch-temple-v2.jpg | board-card-back-scorch-normal-v1.png |
| 黄色 | board-card-back-wither-temple-v2.jpg | board-card-back-wither-normal-v1.png |
| 蓝色 | board-card-back-drown-temple-v2.jpg | board-card-back-drown-normal-v1.png |
| 不可翻开 | board-card-back-blocked-v1.jpg | board-card-back-blocked-normal-v1.png |

上述运行时贴图均在 src/assets/。旧的未使用 v1 彩色卡背不纳入本轮。

## 生成与材质

运行 python scripts/generate-card-back-normals.py 可重建法线和 art/reviews/card-back-relief-v1.png 光照研究图。使用原图的平滑亮度分离纹样与底色，纹样成为较高的浅浮雕，细小磨损保留低幅起伏；中值滤波抑制 JPEG 杂点与细裂纹，边缘法线回到平面。每种卡背单独设定纹样阈值，避免暗色卡背把整片底纹误当浮雕。该过程是确定性的材质数据转换，不重绘原花纹。

当前卡背材质为 MeshStandardMaterial，normalScale 为 (8.5, 8.5)，按用户要求直接放大至上一版的10倍，用于明显观察浮雕，roughness 为 0.82，metalness 为 0.08；少量颜色自发光填充保持暗漆花纹可读。已揭示的地面和透明人物画布沿用 MeshBasicMaterial。法线仅改变受光凹凸，不改变卡片轮廓或碰撞。

颜色纹理使用 sRGB，法线使用 NoColorSpace。每种法线共享一份，并按实际颜色纹理的 cardBackKind 匹配，包含不可翻开状态及排队翻牌的纹理快照。翻牌和材质刷新不释放共享法线，由 BoardTextures 统一释放。

## 查看与验证

开发服务中访问 /tools/card-back-relief-review.html，对比原平面、受光无浮雕、受光浮雕三种效果；可以切换主光方向、调整法线强度。默认相机俯仰40度，主光与游戏一致。

运行 npm run check:card-relief 检查贴图源摘要、法线单位长度与 OpenGL 方向、资源缓存与释放，以及真实场景方法中的卡背/揭示/翻牌材质切换。

art/reviews/card-back-relief-v1.png 为软件光照研究图，不是游戏截图。当前环境的 Chrome GPU 子进程启动失败，未完成浏览器实机视觉验收。颜色和强度最终以游戏刷新后的实际光照为准。
