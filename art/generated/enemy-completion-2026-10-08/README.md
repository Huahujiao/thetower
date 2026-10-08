# 敌人贴图补齐 · 模板包17

2026-10-08补齐最后9种敌人。当前34种敌人（含召唤物、监视者）均有部件贴图、命名骨架和待机／移动／攻击／受击／死亡动作。

## 素材与提示词

本轮使用内置 `image_gen` 生成8张透明部件图，原图保存在 `sheets/`；每张最终使用的提示词在同名 `.txt` 文件中。潮祀母体复用 `art/enemies/25潮祀母体.png`，没有重新生图。运行时切片保存到 `public/assets/enemies/components-v1/<enemyId>/`。

| 敌人 | ID | 头部与主要动作 |
| --- | --- | --- |
| 巡路犬 | `patrol-hound` | 同一侧脸镜像拼成两面长吻，下颌共用后侧铰链；巡铃、耳与香烟须独立摆动。 |
| 赤针火蜥 | `redneedle-salamander` | 钝吻正脸，压低颈部与腿长；三枚赤针分别竖起，叉尾摆动。 |
| 腐囊蟇 | `rot-sac-toad` | 宽正脸与独立颌；侧腐囊、喉囊活动，舌与倒钩只在攻击时露出。 |
| 溺爪兽 | `claw-beast` | 短吻正脸，只有两条大前肢；巨指、腹鳍、后侧拖潮鳍活动。 |
| 裂腹虫母 | `broodmother` | 巨腹育巢、左右腹门开合，腹内幼首与噬口活动；四条后足和两条支柱落地，卵囊单独摇摆。 |
| 熔核囊兽 | `molten-core-beast` | 宽正脸与熔渣颌；双肺囊、熔脊活动，四条主足与两条副足落地。 |
| 赤轮火鸦 | `redwheel-fire-crow` | 长喙采用镜像折面；内外翼独立拍动，四片尾轮羽辐整圈循环，悬足摆动。 |
| 潮祀母体 | `tide-rite-matriarch` | 保留原图面部、主臂、副祈臂、法杖、潮翼与悬裾；按无腿结构归为漂浮类。 |
| 监视者 | `overseer` | 正面祭祀面甲与独立颌，分节双臂重击，背幡摆动，双腿独立落地。 |

不使用重复面部、额外眼睛或多余装饰，不要求用完图集。所有活动表面仍为零厚度纸片。大小继续以猩鬼可见轮廓的对角线归一化，保留各自宽瘦比例。

## 验证与复现

- `manifest.json`：全34种敌人的命名部件、纹理路径、绑定节点和地面支撑；生成来源、提示词文件与验证数量。
- `review/batch5.png`：本轮9种敌人的三角度实际Three.js画面。
- `review/all.png`：全部34种敌人的三角度画面。
- `review/<enemyId>.png`：每种新敌人的五种动作与五个时间点。
- `review/report.json`：354个Three.js姿态，全部纹理已载入。
- `review/editor-report.json`：实际 `/animeedit` 的45次动作播放。

运行 `npm.cmd run check:animation` 检查全部敌人的绑定、纹理、循环接缝和贴地约束。静态检查、相机动画检查和构建通过。旧检查脚本的过时断言见 `docs/mechanic-conflicts.md`。

重新切片：`python scripts/import-enemy-completion.py`。变更纹理裁剪后重新烘焙：`python scripts/collect-enemy-contact-hulls.py`。实际渲染检查需本地Vite 5173端口与独立无界面浏览器9228端口，然后执行 `node scripts/review-enemy-completion.mjs`；不要使用日常浏览器。
