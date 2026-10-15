# arttweak 山寺美术调整（2026-10-14）

参考：`.cc-uploads/file_00000000a8f882098e61159914f623c0.png`。保留已有角色、道具和卡背纹样；没有修改敌人骨架、动画模板或游戏规则。

## 素材与范围

- 三色及无属性卡背：`src/assets/board-card-back*-temple-v2.jpg`。原图未覆盖；另有备份 `art/backup/board-before-temple-grade/`。
- 写实石板：`src/assets/board-floor-temple-{a,b,c,d}-v3.jpg`，来自重新生成的整块一米石板图集。卡背和地板通过共用 BoardTextures 接入游戏。
- 背景：`src/assets/environment/temple-mountains-v1.jpg`。
- 透明道具：`src/assets/environment/temple-maple-v1.png`、`temple-banner-v1.png`。裁切时保留透明通道。
- 三张原始生成图：`art/generated/temple-mountains-v1.png`、`temple-floor-atlas-v2.png`、`temple-props-sheet-v1.png`。
- 山寺环境、灰石栏杆、树、旗帜、落叶、主角脚下纹框及参考图 HUD 仅在 arttweak 的 `sceneView.environment === 'mountain-temple'` 中启用。贴片阴影也用于普通游戏场景。
- 背景随指针和棋盘移动做小幅平滑视差，旗帜轻微摆动；系统启用减少动态效果时停止这些环境运动。装饰物不参与棋盘点击判定。

## 复现

`python scripts/tune-board-art.py` 从 v1 原图生成降饱和度、调整曝光及浮雕明暗后的 v2 卡背，自动补齐原图备份。

`python scripts/prepare-temple-art.py` 从保留的生成原图裁切四张石板、两张道具并导出背景 JPEG，不修改原始生成图。

## 生成方式与完整提示词

使用内置 imagegen，未使用 CLI/API fallback。初轮只生成缺少的环境、地板和道具；后续用户明确要求重新生成地板，当前地板已使用末尾记录的 v3 图集。

### 背景（transparent_background=false）

```text
Use case: stylized-concept. Asset type: NEW background environment painting for a Three.js Chinese dark fantasy board game. Create only a landscape backdrop, no UI, no cards, no characters, no foreground playing floor. Wide landscape 1536x1024. An ancient mountain temple high above a sea of grey mist, layered dramatic Chinese karst peaks, distant tiny pagoda roofs, restrained autumn crimson maple branches along upper left and far left edge, empty softly lit mist across center and right. Match a richly textured realistic painterly game environment: weathered surfaces, cold blue grey charcoal and dusty earth palette, very muted rust red leaves, soft overcast daylight, atmospheric depth. Horizon in upper middle. Lower half mostly distant mountains and fog, no large foreground architecture or platform. Keep center clear and low contrast so game characters placed over it remain the focus. No text, no border, no watermark. This is a missing scene asset, do not recreate existing characters or card art.
```

### 石板图集（transparent_background=false）

```text
Use case: stylized-concept. Asset type: NEW game floor texture atlas, 1024x1024 square. Four equal 512x512 square floor tiles in a precise 2x2 grid, no labels or gutters. Orthographic straight overhead view of old Chinese mountain temple dark grey blue slate flagstones. Each quadrant represents one LARGE tile slab, worn beveled square border with subtle cracked dark grout perimeter. Inside each quadrant: 3 to 5 irregular broad polygonal natural slate stones joined by thin dark cracks. Four subtle variants of the same material. Hand painted realistic 3D game texture with small pores, scratches, fine chipping and layered stone grain, soft top-left illumination, muted charcoal grey and blue green stone. Similar to ancient stone terrace flooring in a dark fantasy RPG. No pixel art, no coarse pixel blocks, no perspective, no objects, no leaves, no emblems, no cards, no text. Keep texture restrained and dark so characters remain the focus. Tiles fill the entire square with no empty space.
```

### 枫树与旗帜（transparent_background=true）

```text
Use case: stylized-concept. Asset type: new transparent game environment prop sheet, two isolated sprites separated by generous transparent space, 1536x1024 landscape. LEFT HALF: weathered twisted dark brown Chinese maple trunk at left, sparse muted rusty red autumn leaves and thin branching canopy reaching rightward; whole elegant tree visible, roots at bottom. RIGHT HALF: one tall ancient Chinese temple banner on a weathered bronze vertical pole with small finial and horizontal crossbar, hanging dark wine red tattered cloth, faded antique gold circular dragon-like seal on the cloth, subtle textile folds, pointed ragged bottom. Both seen from near frontal 3/4 elevated game camera, richly textured realistic hand painted dark fantasy environment matching grey mountain temple stone terrace. Soft overcast lighting, restrained saturation, no luminous bright colors. Keep tree and flag completely separated, each inside its own half, no overlap. Genuine transparent background, no ground, no shadows outside props, no UI, no labels, no text, no characters, no white rectangle.
```

## 截图与验证

- 实际页面迭代：`screenshots/arttweak-before.png`、`arttweak-round-1.png`、`arttweak-round-2.png`、`arttweak-round-3.png`。
- 最终实际页面：`screenshots/arttweak-final.png`（470×836 CSS 像素，2倍截图）；另有 `arttweak-mobile.png`（390×844）和 `arttweak-desktop.png`（1440×900）。
- 已通过：残局核心、棋盘指针、体力球 HUD、改动 JS 文件静态检查、美术页独立生产构建；实际浏览器已确认系统减少动态效果下背景和旗帜静止、视差变化、点击隐藏牌、重开恢复、存档隔离、三种尺寸背包完整显示、无页面脚本错误。
- 本地依赖限制：网络限制下使用本机已有离线依赖，Three.js 为项目要求的 0.185.1；Vite 为 8.3.4。未修改 package.json 或 lockfile。完整生产构建在 wiki 页的 `marked` 导入处失败，本机缺少此包；没有将它伪造或设为外部依赖。美术页独立构建不包含 wiki，已通过。
- 未验证：手机实机的 GPU 性能、其他楼层主题与新灰石地板的视觉搭配。这里只记录，未扩展改动历史内容。

## 历史调整：地板尺度与牌下承托（纹理方案已由 v3 替代）

- 在所有牌格下增加固定的全尺寸地板，边缘略微交叠以封住像素级缝隙。该层不参与点击，悬停抬牌和翻牌时保持可见，不随牌一起消失。
- 地面按每格约一米的视觉尺度呈现：每格完整铺一张石板，保留连续外框。只对内部颗粒加密取样、用邻近石材的明度收窄粗裂纹；不再四分拼贴或裁去外框。原图片未修改或重新生成。
- 最新截图：`screenshots/arttweak-single-slab-final.png`；牌下承托的悬停检查截图：`screenshots/arttweak-floor-backing-hover.png`。`arttweak-floor-scale-final.png` 保留为已纠正四分拼贴的历史对照。
- 已通过：实际浏览器逐格地板覆盖检查、抬牌时底层高度固定、翻牌后地板保留、页面无脚本错误，以及残局、棋盘指针、美术页独立生产构建和改动文件静态检查。

## 历史地板：imagegen 重新生成的一米石板 v3（由 v4 替代）

- 使用内置 imagegen 重新生成地板图集：`art/generated/temple-floor-atlas-v3.png`。每个象限是一张完整石板变体，运行时每格只使用一个完整象限，不在单格内拼贴。
- 接入素材：`src/assets/board-floor-temple-a-v3.jpg`、`board-floor-temple-b-v3.jpg`、`board-floor-temple-c-v3.jpg`、`board-floor-temple-d-v3.jpg`。
- 原 v2 地板仍保留；另外备份在 `art/backup/board-before-fine-slab-v3/`。
- 已移除之前的四分拼贴、缩裂纹和颗粒再取样算法。运行时直接绘制新纹理，纹理尺度由新图片本身保证。
- 复现切图及调色：`python scripts/prepare-temple-art.py --floor-only`。从新原图导出四个 512×512 JPEG 变体，饱和度 0.90、亮度 0.88，不覆盖旧版本或重新导出背景和树旗。
- 最新实际页面：`screenshots/arttweak-fine-slab-v3-final.png`；悬停检查：`screenshots/arttweak-fine-slab-v3-hover.png`。新纹理加载无脚本错误，固定底层逐格覆盖、悬停高度固定、翻牌保留地板检查通过；残局、改动文件静态检查、美术页独立生产构建通过。

### v3 完整提示词（transparent_background=false）

```text
Use case: stylized-concept. Asset type: production floor texture atlas for a Chinese dark fantasy game, 2048x2048 square, four equal variants in an exact 2x2 grid. PRIMARY REQUEST: Each quadrant is ONE COMPLETE MONOLITHIC square stone floor slab, exactly 1 metre by 1 metre in physical scale, seen perfectly straight down orthographically. Each quadrant will be cropped and displayed as one complete game floor tile. The slab face is an uninterrupted single stone surface; DO NOT build the quadrant out of smaller stones or multiple inset pieces. MATERIAL: dressed dark blue-grey slate, slightly greenish charcoal, naturally worn satin-matte stone, very fine dense mineral grain, microscopic pores smaller than 1 mm, tiny subdued scratches 1-3 cm long, faint diffuse weathering. Keep the centre visually quiet and flat enough for game characters. CRACK SCALE IS CRITICAL: Only one or two very sparse, short hairline fissures close to a corner, about 10-20 cm long and only 1-2 mm wide. Cracks must be far finer and much less contrasty than slab joints. Most of each square is solid stone. No central fracture, no cracks spanning the slab, no branching canyon cracks, no split stones. EDGES: all four outer edges of each square must be clearly continuous, with a very narrow worn bevel about 6 mm wide and a subtle dark joint about 6 mm wide. Slight chips at a few corners, tiny and restrained. The square edges reach the exact borders of each quadrant, no margins or gutters. This is a one metre slab, not a close-up of a small broken rock. STYLE: richly textured realistic hand-painted 3D game material, softly lit with diffuse overcast light from upper left, restrained cool dark grey palette and low surface contrast. All four variants same scale, same brightness, same palette, same fine grain; vary only gentle weathering and occasional tiny corner hairline. Full square texture, no perspective, no text, no symbols, no ornate border, no circular emblem, no leaves, no props, no large rocky chunks, no cobblestones, no mosaic, no checkerboard subdivision inside a quadrant, no dramatic crevices, no glossy reflections, no pixel art.
```

## 二维 HUD 对齐与紧凑尺寸

- 解决体力球与背包重叠、窄屏球体互相挤压、文字被进度条裁切的问题。顶部操作改用统一 SVG，图标居中；菜单与物品详情互斥，长标题、标签和说明允许换行，面板从经验条下方展开。详情面板恢复指针响应，点击关闭正常。
- 按紧凑布局压矮美术页栏位：470px 页面宽度下，顶部约 42px、操作栏 40px，原为约 60px 和 54px；经验条 12px、血条 16px。顶部图标正方形，楼层与等级均为标签、数值左右排列，字号缩小。护甲和右侧按钮高度约 31px。
- 最新实际页面：screenshots/arttweak-ui-compact-470.png；窄屏：screenshots/arttweak-ui-compact-320.png。另有 short、360、390、desktop 六种尺寸的截图。
- 已通过 320×480、320×568、360×640、390×844、470×836、1440×900 浏览器检查：图标居中且正方形，文字不裁切，球体不重叠，背包完整，菜单不遮盖顶部或操作栏。菜单与详情互斥、使用按钮、三位数护甲及点击关闭详情检查通过，无页面脚本错误。体力球 HUD 核心检查、美术页独立生产构建和 git diff --check 通过。

## 顶部栏浮于场景之上

- 美术页的三维场景容器与画布从页面顶端铺到背包区上沿，顶部栏和经验条使用独立叠层。底部背包仍停靠页面底部，弹出菜单继续从经验条下方展开。
- 顶部栏移除单独的远山贴图，改为青黑色半透明渐变：上缘 rgba(7,27,29,.64)、下缘 rgba(8,25,28,.46)。透出的远山、树枝和石栏来自同一个场景及已有视差背景；经验条两端也使用半透明青黑底。
- 最新截图：screenshots/arttweak-overlay-header-470.png、screenshots/arttweak-overlay-header-320.png。六种尺寸已确认画布从页面顶部开始、与背包上沿无缝衔接、顶部命中不会穿透点击棋盘，菜单、文本和背包布局检查通过，无页面脚本错误。

## 青黑做旧石板 v4 生成提示词

使用内置 imagegen；旧 v2 作为色调和材质参考，明确排除其过大的裂纹。

```text
Use case: stylized-concept. Asset type: new production game floor texture, 1024x1024 square. Input image is ONLY a color/material style reference from an earlier floor; do not copy its oversized cracks or broken-stone layout. Primary request: ONE complete monolithic 1 metre x 1 metre square ancient temple slate floor slab, perfectly overhead orthographic, filling the image to all four exact edges, for a game cell. COLOR IS CRITICAL: very dark desaturated cyan-black / green-black slate, dominant color approximately #263533, shadows #152321, sparse muted lighter grain #43504c; no white or silver chalk, no bright grey dust, no strong lighting gradient. Clearly dark teal-charcoal, not pale grey. Fine dense mineral grain and small pits under 1 mm, subdued scratches a few cm long. Weathered realistic hand-painted dark fantasy game material, diffuse soft flat overcast illumination, matte and dry. Show visible thin dark irregular cracks with very subdued dark teal lip, 3-5mm wide, clearly readable at 512px yet never deep canyons. Continuous narrow worn bevel around the outer four edges (about 6mm) and dark grout along exact outside boundary; slab remains one square, not subdivided into smaller paving stones. No thick frame, no ornate borders, no symbols, no leaves, no props, no text, no watermark, no perspective, no pixel art. All variants should match the same dark cyan-black hue, same physical scale, and same small grain.
```

### A

```text
Variant A: gently weathered slab, rubbed centre slightly smoother but still dark; a fine irregular diagonal fissure from upper-left corner to about halfway across, with two very short hairline offshoots. Small corner chips. Keep most surface continuous.
```

### B

```text
Variant B: more aged slab, uneven dark moisture patina and tiny pits; a thin wavering crack crossing from middle of left edge toward lower-right corner, with one short offshoot. Hairline detail, no large chunks or grooves.
```

### C

```text
Variant C: heavily weathered edge, subtle green-black oxidized grime concentrated along two borders, still no bright moss; one narrow irregular forked crack entering from upper-right edge and fading in lower-middle. Fine scratches and slightly chipped lower edge.
```

### D

```text
Variant D: old abrasion marks and muted dark mottled mineral patina; two thin independent fissures near opposite corners, one about 45cm and one 25cm long, with a faint bridging hairline. Centre worn smooth enough for game character.
```

## 当前地板：青黑裂纹石板 v4

- 使用内置 imagegen 分别生成四张完整的一米石板，包含斜裂纹、横穿细裂纹、分叉裂纹、双角裂纹以及不同程度的污渍、磨损和边缘风化。每格只绘制一张完整图片，避免单格内四分拼贴。
- 原图：art/generated/temple-floor-a-v4.png、temple-floor-b-v4.png、temple-floor-c-v4.png、temple-floor-d-v4.png。运行素材：src/assets/board-floor-temple-{a,b,c,d}-v4.jpg。512px JPEG 导出使用 scripts/prepare-aged-temple-floor.py，仅缩放、编码，不额外提亮。四张完整提示词见上节。
- 旧 v3 纹理保留，并另存 art/backup/board-before-aged-slab-v4/。v2 与 v3 的原始生成图、其他已有美术均未覆盖。
- 新纹理平均 RGB 约 (37,44,42)，旧 v3 约 (67,71,72)，恢复偏青绿的暗石色，避免浅灰石面抢主体。按坐标哈希等概率选择四种纹理，不使用玩法随机数，翻牌、移动、重开期间同格保持一致。
- 最新实际页面：screenshots/arttweak-aged-slab-v4-final.png；手机：screenshots/arttweak-aged-slab-v4-mobile.png；抬牌承托：screenshots/arttweak-aged-slab-v4-hover.png。已检查四种资源全部加载、棋盘混排、牌下全格地板覆盖、抬牌底层高度固定、翻牌后地板保留，无页面脚本错误；纹理缓存与释放检查、残局核心、美术页独立生产构建均通过。

## 栏杆外四周下沉种植带

- 在美术页露台四周增加连续的下沉土带，四角相接；约 0.9 场景单位宽，土面高度 -0.38，位于棋盘及栏杆基座下方。内侧露出台阶立面，外侧以低石砌挡墙和压顶封边，后侧保留支撑石柱的石质基座。
- 复用已有颗粒纹理，暗褐土层按长度铺设材质，配少量低矮枯草、碎石和落叶；碎石、落叶使用实例绘制，草叶合并为一个网格。没有重新生成或覆盖已有图片。
- 原有枫树移到左后方的种植带，根部沉入土面，透过栏杆可见局部树根，树干和枝叶从外侧向上伸出。树与土带仅作为景物，不参与射线点选，不改变棋盘范围和玩法状态。
- 默认视图：screenshots/arttweak-planting-ring-final.png；手机：screenshots/arttweak-planting-ring-mobile.png；全景结构检查：screenshots/arttweak-planting-ring-overview.png（仅在检查时临时缩远，不改变页面默认镜头）。
- 已验证四边与四角土层连续、土面低于棋盘、树位于后侧种植带、新景物无点选命中；原有抬牌和翻牌承托正常，无页面脚本错误。棋盘指针核心检查、改动文件 ESLint、美术页独立生产构建通过。

## 更细的经验条、血条与护甲盾徽

- 美术页经验条由 12px 收为 6px，隐藏可见数字，角色菜单仍可查看具体经验；进度条保留可访问的当前值和上限。两端饰件同步缩小。
- 血条由 16px 收为 11px（约缩小三分之一），保留实时血量；数字独立叠放，避免细条裁切，体力球和背包间距保持正常。
- 使用内置 imagegen 生成透明盾徽，青黑钢面、旧铜边框、浅浮雕及铆钉，中央留空以显示实时护甲。原图保存在 art/generated/hud-armor-shield-v1.png，运行素材为 src/assets/ui/armor-shield-temple-v1.png（256×256，保留透明通道）。没有覆盖已有图片。导出脚本：scripts/prepare-temple-hud-art.py。
- 最新截图：screenshots/arttweak-fine-bars-armor-470.png、screenshots/arttweak-fine-bars-armor-320.png。六种尺寸检查通过：进度条高度正确、经验数字隐藏、血量不裁切、背包和菜单无重叠、护甲图标加载成功；320px 下三位数护甲仍在盾面中央范围内。体力球 HUD 核心检查、美术页独立生产构建和 git diff --check 通过。

### 护甲盾徽完整提示词（transparent_background=true）

```text
Use case: stylized-concept. Asset type: NEW small game HUD armor shield badge, transparent PNG, square canvas. Primary request: one elegant compact ancient Chinese dark-fantasy shield emblem, straight frontal view, perfectly centred and symmetric. Broad gently arched shoulders, tapered lower sides and pointed rounded base, width about 85% of height. A forged dark cyan-black / charcoal steel face with a thin weathered antique bronze rim, subdued bevel highlights and a restrained embossed cloud-scroll detail only on the rim. Four small rivets at shoulders and lower sides. Centre must remain a large quiet dark unadorned surface, occupying at least 55% of shield width, for overlaying a dynamic cream-colored number later. At 30px display size the silhouette and bevel must still read clearly; favour simple large forms over intricate decoration. Palette: oxidized bronze, muted champagne metal, dark teal black; no bright gold, no silver-white glare, no gem, no glow. Hand-painted realistic 3D game icon with subtle wear and scratches, soft upper-left light, no perspective or tilt. Shield fills about 90% of canvas height, generous transparent margin around all edges. Genuine transparent background, isolated badge, no text, no digits, no letters, no watermark, no extra objects, no background scene. Do not generate a mockup or any other UI.
```

## 四周内栏杆与棋盘的窄边

- 移除顶部栏杆额外的 0.65 后移，不再单独保留过宽的顶部石台。四边统一按 TEMPLE_BOUNDARY_INSET = 0.34 定位内栏杆和石柱。
- 0.53 宽柱脚与棋盘边缘净距为 0.075；栏杆基座与棋盘净距约 0.214。石边向外承托整个柱脚，种植带内沿同步统一，外侧下沉土层和枫树保留。
- 横向、纵向栏杆长度同步伸到四角柱心，转角保持连续；仅美术页山寺环境使用该间距，普通房间边界规则保持原有逻辑。
- 最新截图：screenshots/arttweak-inner-rail-gap-final.png、screenshots/arttweak-inner-rail-gap-mobile.png；四周全景：screenshots/arttweak-inner-rail-gap-overview.png。已验证七个柱脚均不侵入棋盘且完整受石边承托、四边间距一致、土带四角闭合、树位于外侧土层、抬牌和翻牌正常，无页面脚本错误。棋盘指针核心检查、美术页独立生产构建、改动 JS 的 ESLint 和 git diff --check 通过。

## 外围下沉石台四角收口

- 挡墙、压顶及内侧台阶立面统一由矩形内边界构建四段：前后段覆盖转角，左右段准确顶到其内侧端面，四角不再出现独立延长量导致的错台和凸头。
- 外墙厚度 0.16，压顶四边统一外挑 0.025，内側立面外边与石台边缘齐平。土层、树、卡牌间距保持原布局。
- 直接读取生成网格的几何边界，确认三圈石构件四角、标高及压顶外挑一致；改动文件 ESLint、美术页独立生产构建和 git diff --check 通过。
- 用户于 2026-10-15 要求减少逐轮截图：本轮不截图，后续完成几个相关调整后再统一截图检查。最新已有截图尚未包含本轮角部修正。

## 局部树旗风摆与树下飘叶

- 保留已有透明枫树和旗帜图片，使用细分网格和局部权重驱动动画：树根、主干固定，外侧枝叶按位置使用不同相位轻摆；旗杆、横梁固定，旗布与边缘垂条产生沿高度传播的慢波浪。树和旗帜的整体位置、旋转均不随风改变。实现：src/render/temple-wind.js。
- 删除棋盘上随机散布的静态落叶和种植带四周均匀散叶，改为 48 片仅集中在树下后侧土带的落叶。
- 12 片循环飘叶从树冠叶簇附近出发，缓慢下降、漂移和翻转，接近土面时淡出，触地消失后重新循环；不会新增地面堆积，也不会不断创建新网格。
- 系统减少动态效果时，树旗恢复静止贴片，飘叶隐藏。景物继续不参与射线点选，部件资源随结构组销毁，共享图片仍由环境对象管理。
- 已通过数值及实际浏览器检查：树根和旗杆固定顶点不变、枝叶和旗布顶点随时间改变、整体变换保持不变；静态叶均在树附近土带内，飘叶在触地后消失且数量不增长，减少动态效果恢复静止，无页面脚本错误。改动 JS 的 ESLint、美术页独立生产构建及 git diff --check 通过。手机实机的动态性能仍未验证。
- 按用户要求，局部风摆、静态落叶、飘叶及此前四角修正完成后统一截图：screenshots/arttweak-tree-banner-wind-final.png、screenshots/arttweak-tree-banner-wind-overview.png。全景已检查外围石台四角接齐，棋盘及其他种植带区域无静态落叶。

## 树旁棋盘上的少量落叶

- 按用户补充要求，在棋盘左上方靠树的几格边缘增加 8 片小落叶，靠树一侧较密、向内渐稀，避开角色中心；其余棋盘区域保持清爽。树下土带仍保留原来的 48 片静态落叶。
- 棋盘落叶随所在卡面或地板的姿态更新，抬牌和翻牌不会导致叶片悬空；装饰不参与点选。飘叶触地消失的逻辑保持不变。
- 数值检查确认仅分布于近树角落、随抬牌移动、翻开后的地板高度同步；原有风摆与飘叶检查、改动 JS 的 ESLint、美术页独立生产构建、git diff --check 通过。本轮不截图，留待后续集中检查。

## 未上锁的石质入口

- 未上锁的门隐藏原门板，显示青灰石材入口；三种造型为完整拱门、拱顶残缺、仅两侧石柱。门 ID 哈希稳定选择造型，不消耗玩法随机数，刷新与锁定状态切换不重新抽选。
- 石柱由石块分段搭建，拱门使用带细小倒角的楔形拱石；山寺环境复用已有石材纹理。已上锁时恢复原门板、门框与锁图标，解锁后自动切换到石质入口。
- 保留原来的透明门点击区域，未上锁时不写深度、不投下门板阴影，原寻路及通行规则保持不变。
- 几何及状态检查覆盖三种造型、横纵两种朝向、四向透明点击、上锁/解锁切换及稳定造型；改动 JS 的 ESLint、美术页独立生产构建和 git diff --check 通过。本轮不截图，后续集中检查造型与近树棋盘落叶。

## 门外下沉石台的石路

- 每个已显示门洞都增加与门洞中心线对齐的石路，穿过种植带接到外侧石台边缘。石路使用三段宽石板逐级下降，衔接露台与低处土带。
- 外侧挡墙和压顶在通道位置同步留出开口；石环仍使用统一边界分段，其他转角保持原收口。草丛、碎石和树下静态落叶避让通道，路径作为景物不参与点选。
- 已验证四向入口对齐、三段路面下降、通道到达石台外沿、墙与压顶出口畅通、草叶不占路面；改动 JS 的 ESLint、美术页独立生产构建和 git diff --check 通过。
- 近树棋盘落叶、石质门框和门外石路完成后统一检查实际页面：screenshots/arttweak-stone-door-paths-final.png、screenshots/arttweak-stone-door-paths-overview.png。美术页两扇未锁门分别显示双石柱和完整拱门，均有对应石路，8 片近树棋盘落叶正常，无页面脚本错误。

## 试排：按格子的四角大柱、小中栏杆柱和双柱门洞

- 山寺美术页按房间格子尺寸生成围栏，四角仅保留 4 根大柱；每面墙在每格正对位置设置小柱、中柱交替，紧邻角柱的首尾柱位强制为小柱。中柱采用更高的收腰方锥柱身与分层柱帽，体量介于小柱与角柱之间。
- 栏杆横梁在明确柱位之间连接，不再在每个墙段里附带随机感的双小柱，也不再向墙中间额外插入大柱。
- 门洞按相邻两格柱位成对分组，替换一对栏杆柱；门两侧柱心精确落在被替换柱位上，中间不铺横梁。石门、带锁门的宽度与点击区域同步适配，门外石路与出口跟随新门位。
- 布局实现：src/render/temple-boundary-layout.js。当前版本先在美术页试排，普通环境及门的逻辑 offset/arrival 数据仍保持原有规则。
- 已检查 3×3、4×7、5×8、6×6、9×4、12×11 的奇偶及长方形格数，确认大柱数量、角柱邻接小柱、交替规则、双柱替换与门柱位置。实际美术页有 4 根角柱、20 根普通栏杆柱、两扇石门及对应石路，无页面脚本错误；改动 JS 的 ESLint、美术页独立构建和 git diff --check 通过。
- 试排截图：screenshots/arttweak-grid-rail-overview.png、screenshots/arttweak-grid-rail-final.png。

## 柱型交替与角落禁门修订

- 取消角柱邻位强制小柱的例外，中小栏杆柱按格位自然交替，偶数格墙面末端允许中柱邻接角柱。
- 门仍只替换相邻两个格心柱位；生成横梁时明确禁止在角柱与首尾格心柱之间开门，半格角位始终保留栏杆。
- 六组奇偶、长方形尺寸及门偏移边界检查通过，确认自然交替、门只占两个格心柱位、两端角部栏杆保留。ESLint、美术页独立构建及 git diff --check 通过。本轮不截图，上节截图尚未包含此次柱型修订。

## 所有地板统一内边框花纹

- 将原主角格的细金色内边框和四角卷纹合入 BoardTextures 的地板绘制流程，四种做旧石板共用同一套花纹及原有内缩比例。未翻开牌下的承托地板、普通地板及角色脚下地板均使用带花纹的地板纹理。
- 移除原先仅主角格使用的单独边框平面和纹理，避免主角格叠两层。原有地板图片未覆盖或重新生成；卡背图案保持原样。
- 纹理异步刷新、缓存与释放检查、改动 JS 的 ESLint、美术页独立生产构建及 git diff --check 通过。本轮不截图，后续集中检查。


## 平台厚度、云雾与建筑石材（2026-10-15）

- 在四周下沉石台下沿接入连续平台基座，顶部 -0.43、底部 -2.75，按外侧种植带边界自动适配房间尺寸；厚台沿、块石墙身、中段石腰线和四角略凸的扶壁形成承重层次。原有门外石路保持连通。
- 下段逐渐压暗并淡出，三层低处青灰薄雾缓慢漂移、柔化底部轮廓；雾层位于棋盘下方，不盖住卡牌，系统减少动态效果时静止。侧壁和雾不参与射线点选，资源随结构组释放。没有添加全局灯光方案，后续统一处理照明。
- 新生成两张独立低饱和青黑石材：栏杆、柱子和未锁石门使用细颗粒修整石材；基座使用四层条石砌纹（每次平铺覆盖约 2×2 米）。按实际几何尺寸设置 UV，长横梁、细柱和拱石不会各自拉满一张纹理；石块增加毫米级倒角和轻微凹凸。
- 原有图片未覆盖或重新生成；旧石材仍保留，土带继续使用旧纹理，避免换材质改变土壤观感。生成原图：art/generated/temple-dressed-stone-v1.png、art/generated/temple-foundation-masonry-v1.png。运行素材：src/assets/environment/temple-dressed-stone-v1.jpg、src/assets/environment/temple-foundation-masonry-v1.jpg（1024×1024）。导出脚本：scripts/prepare-temple-stone-art.py。
- 实现：src/render/temple-platform-depth.js、src/render/temple-stone-materials.js；接入 temple-environment.js 和 wall-kit.js。普通环境的无贴图石门仍使用原材质。
- 合并截图：screenshots/arttweak-platform-stone-overview.png（临时缩远展示侧壁）、screenshots/arttweak-platform-stone-final.png（默认镜头）。同时复核此前的自然中小柱交替、全地板内边框、门洞及石路。浏览器无脚本及着色器错误，4 个角部扶壁、3 层雾和减少动态效果检查通过；改动 JS 的 ESLint、美术页独立生产构建通过。

### 修整石材完整提示词

```text
Use case: stylized-concept. Asset type: NEW seamless PBR-style albedo texture for ancient Chinese temple stone railings, pillars and stone door arches; square 1024x1024. A close orthographic flat scan of dressed dark cyan-grey / green-black basalt-grey slate, one continuous material surface with NO tile border and NO masonry joints. Medium-dark teal-charcoal stone, dominant albedo approximately #52635d with sparse darker mineral patches #354641 and subdued worn mineral specks #718078. This will be lit by real game lights; use flat diffuse even lighting, no directional highlights, no baked shadow, no bright white areas. Fine dense stone grain (1mm or less at a 1 metre physical scale), restrained shallow tool marks and erosion, a few tiny 2-4cm scratches, subtle dark pores and occasional short hairline fissures. Used for narrow carved posts and rails at small screen sizes, so keep detail fine and non-busy. Aged matte stone, realistic hand-painted dark fantasy game material, restrained low saturation. Perfectly seamless/tileable all edges. No whole slabs, no chunks, no cracks wider than 2mm, no carved motifs, no lettering, no objects, no moss clumps, no black vignette, no frame, no perspective, no watermark.
```

### 基座砌石完整提示词

```text
Use case: stylized-concept. Asset type: NEW seamless square foundation-wall albedo texture, 1024x1024, ancient mountain-temple platform masonry. Orthographic straight-on flat material scan, physically covers 2 metres wide by 2 metres tall. Four horizontal courses of long large dressed dark teal-charcoal stone blocks, each course about 0.5m high, staggered narrow joints; mostly long 0.8-1.2m blocks. Stone joints narrow and subdued, 5-8mm dark recessed grout; not gigantic gaps. Muted cyan-black / green-grey stone, dominant approximately #344b46 to #53665e, darker narrow mortar #23322f. Fine dense mineral grain and shallow weathering, small worn chips at some edges, restrained occasional thin fractures, softened dressed edges. Keep the blocks heavy and monolithic, not rubble. Flat even diffuse albedo lighting suitable for later 3D lighting, no directional shadows or bright white highlights. Realistic hand-painted dark fantasy game texture, fine detail at metre scale, subdued contrast. Perfectly seamless/tileable top-bottom and left-right, joints continue naturally. No wall borders or scene context, no columns, no carved symbols, no ornaments, no text, no watermark, no perspective, no bright moss, no vignette.
```

## 侧壁向下延长至 4.5 倍

- 墙顶维持 -0.43，墙身由 2.32 延长至 10.44，墙底调整为 -10.87；四角支撑同步延长，厚台沿仍保留原高度和尺寸。
- 渐暗、底部淡出及三层薄雾按相同深度比例下移，中段腰线随墙身下移。纹理继续按米铺设，石块不随墙身拉长。
- 本轮为低影响参数调整，不额外截图。
