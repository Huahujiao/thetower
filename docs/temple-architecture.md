# 山寺建筑材质与倒角（2026-10-16）

保留现有布局、门位和种植带，不靠提高贴图分辨率掩盖几何问题。本轮将环境石材构件改为双段窄圆角；保持原尺寸，平面不鼓起，棱角有连续高光。UV按米缩放，圆角同一个主面内固定投影方向，避免平滑法线在棱边切换UV轴造成拉花。

- 柱身分石层，底座、束腰、柱头接合；栏杆增加压顶下方的细收口。石材棱边仅有轻微矿物磨亮，没有描边。
- 原石材色图保留，新增两套512px线性法线与AO/粗糙度（R=AO、G=粗糙度、B=0）。材料共享纹理，环境统一释放资源。
- 平台侧墙仍为完整闭合实体，保留原有深度渐暗；转角上部改为叠砌角石。没有将侧墙改为透明。
- 三种石门洞保留；锁门改用旧朱漆双门扇、两面铜条、铆钉及门环。山寺锁门解锁时保留石门框，隐藏木门扇；原点击体积与锁图标保留。
- 山寺建筑启用投影与接收阴影，主光阴影范围扩至±8m，轻微法线偏移抑制自阴影痤疮。其他环境的主光设置保留。

## 三轮审视

1. 倒角、PBR石材、柱头与栏杆收口；检查全景、转角和残拱。
2. 锁门木纹、分板与铜件；复查门洞和外墙。
3. 补齐锁门背面五金，复查最终五个视角。已检查角度未见缺面或明显穿插；残拱缺冠为原本设计。

当前会话的电脑工具没有可用浏览器，打开内置浏览器也返回“Browser is not available: iab”。因此以下图片是读取生产网格、法线、UV与贴图的离线光照研究图，不是游戏截图。软件渲染采用近似光照、PCF与接触遮蔽，未包含游戏云雾、树旗和HUD，亮度及阴影不能代替WebGL和手机实机验收。

- [全景](../art/reviews/temple-architecture-final-overview.png)
- [正视](../art/reviews/temple-architecture-final-front.png)
- [柱与转角](../art/reviews/temple-architecture-final-corner.png)
- [残拱与台阶](../art/reviews/temple-architecture-final-doors.png)
- [双面锁门](../art/reviews/temple-architecture-final-gate.png)

在开发服务器打开 /tools/temple-architecture-review.html。该页使用真正Three.js与生产构件，可旋转缩放、切换主光、开关法线、检查线框并保存PNG；不读写游戏存档。常规 /arttweak 页面使用同一套环境资源。

## 复现与检查

- npm run check:temple-architecture：校验4张表面数据、倒角尺寸/法线/UV、材质共享、闭合地基、三种门洞、双面木门、四向锁门/解锁切换和点击体积。
- node scripts/export-temple-architecture-review.mjs
- python scripts/render-temple-architecture-review.py --out art/reviews/temple-architecture-final
- 独立审视入口生产构建、art-tweak-check、board-pointer-check和本轮JS定向静态检查均通过。

审视模型约8.9万三角形（六列五行、四门、完整地基），单块石材300三角形；没有细分平面铺设高密度网格。手机GPU性能尚未测量。

## 新木纹来源

使用内置image_gen生成；没有使用CLI/API fallback。生产文件为 src/assets/environment/temple-gate-lacquer-v1.jpg，保留原图 art/generated/temple-gate-lacquer-v1.png。scripts/prepare-temple-stone-art.py 输出1024px JPEG，原石材两张JPEG保持不变。

最终提示词：

```text
Use case: photorealistic-natural. Asset type: seamless square albedo texture for small antique Chinese temple double doors in a subdued East Asian supernatural game. Primary request: a single uninterrupted field of very old vertical-grain dark oxblood reddish brown timber with weathered worn lacquer, exposed dark warm wood in irregular small patches, restrained black grain and tiny fine age cracks. Orthographic flat material scan, exactly front-on, uniform diffuse unlit albedo, no highlights, no baked cast shadows, no directional lighting. The wood grain runs straight vertically. Texture fills the whole square edge to edge and tiles seamlessly in both directions. This is continuous wood surface for UV mapping, NOT a picture of a door and NOT assembled planks: absolutely no frames, panel borders, plank joints, handles, nails, fittings, carvings, symbols, writing, ground or background. Colour: very desaturated deep reddish brown lacquer and dark umber grain, no orange, subtle medium-scale cloudy wear readable on a small game asset, realistic and sober, no cartoon texture. 1024x1024 square.
```

## 树外侧斜光（2026-10-16）

- 山寺主光使用房间局部坐标(-7,8,-6)，以实际树的外侧定位，默认视角从画面左上斜照向右下。暖主光2.8，天空补光0.70，冷色弱补光0.25，拉开受光面和背光面。仅主光投影，阴影图2048px。
- 光源组保留在scene内，完整房间重建不会清掉它；镜头平移时同步房间组的平移，保持方向、目标及阴影相对建筑稳定。
- 山寺裸露地面、地板底衬、角色脚下及翻牌正面的地面改为受光Standard材质，并接收建筑阴影；移动离开角色原格时切换回受光地面，解决原格残留不受光材质的问题。角色、敌人、站立标记与物品贴片保持原表现，角色只用假接触阴影。
- 新检查：npm run check:temple-lighting，覆盖光源方向、投影光数量、平移、翻牌和移动材质切换、角色阴影策略与旧环境隔离。相关建筑、卡背和共享纹理检查、审视页生产构建及定向静态检查通过。
- [斜光正视研究图](../art/reviews/temple-left-sun-front.png)、[斜光转角研究图](../art/reviews/temple-left-sun-corner.png)。导出器将正式光照配置写进JSON，离线软件渲染读取该方向与强度；仍是近似光照研究图，非游戏截图。此轮没有烘焙新的几何AO，也未启用实时AO。
- 当前工具仍无可连接的浏览器。WebGL实际阴影边缘、高光、前景边界特殊绘制层以及手机端2048阴影图性能尚未实机验收。

## 全局暗部补光（2026-10-16）

- 根据用户要求新增全方向AmbientLight（颜色0xd8ded5、强度0.90），天空补光提高至0.85，地面半球色提高至0x667568；保留树外侧直射光和单盏投影光。目的为保留背光石材、压顶下沿和墙面的纹理，而不是取消阴影。
- 新增无方向全局补光的检查通过，原光向、平移、翻牌/移动、角色贴片阴影及旧环境隔离仍通过；定向静态检查与独立审视页构建通过。新增离线研究图见 art/reviews/temple-global-fill-front.png 和 temple-global-fill-corner.png。
- 这轮仍为灯光补光，尚未接入IBL。建议后续用每主题共用的静态PMREM环境图承担漫反射和材质反射，保留斜射主光承担方向与投影；几何AO仍独立烘焙。普通环境贴图本身不生成局部物体之间的阴影。浏览器实机验收限制沿用上文记录。

## 卡背、地板与逐格墙体 PBR / IBL 接口（2026-10-16）

- 五种卡背增加线性 ORM 数据（R=纹理缝隙遮蔽、G=粗糙度、B=金属度）。凹底较哑，凸起花纹以较低粗糙度和局部旧铜金属度表现；保留原来的8.5倍浮雕法线。自发光从0.12降至0.025，让真实光与环境反射决定表面明暗。
- 四种逐格地板分别增加浅法线及粗糙度变化；石材金属度为0。墙体使用原石材法线和新的0.50–0.90粗糙度变化，明亮磨损面较光滑、凹缝较粗糙。仍按每个墙格/构件单独生成网格，共享贴图与每米UV密度，没有合成整面墙，也没有全关卡贴图烘焙依赖。
- 贴图来自原图的确定性数据推导，非实测PBR扫描；AO仅为纹理局部缝隙，非烘焙几何AO，未引入实时AO。色图不变，数据图使用NoColorSpace。卡背快照仅保存类型标签，共享相应表面图；翻牌、移动、换房间不会提前释放共享数据。
- IBL选择 [Kloofendal Overcast (Pure Sky)](https://polyhaven.com/a/kloofendal_overcast_puresky)，Greg Zaal / Poly Haven，CC0。使用由1K源文件缩小的128×64真实HDR并通过PMREM预过滤一次，仅赋给scene.environment，保留原有山云背景。加载成功后关闭原Ambient/Hemisphere/弱方向补光，保留树外侧主直射光与单张阴影图。
- 前轮外网下载受阻，随后由用户手动提供1K HDR。现在游戏打包读取本地128×64 HDR，不再访问外部CDN；加载失败仍保留旧补光。原始1K源文件保存在art/source/environment，不进入发布包。
- 独立审视页现使用正式卡背/地板PBR材质，可拖动观察高光，调整IBL强度及水平朝向；加载状态明确显示实际IBL是否成功。无可用浏览器，因此本轮未宣称完成WebGL视觉或HDR朝向验收。
- 检查：npm run check:temple-pbr 覆盖13张数据贴图、五种卡背、四种地板、逐格墙共享、IBL补光替代/失败回退及异步资源释放；共享纹理和原光照/翻牌检查也需通过。

## HDR 体积优化与本地接入（2026-10-16）

- 用户提供的源文件为1024×512、1,174,053字节，完整归档到 art/source/environment/kloofendal_overcast_puresky_1k.hdr。生成器 scripts/prepare-temple-ibl.mjs 在线性辐射值下按球面像素面积平均，再写回RGBE/RLE；保留HDR亮度范围，未转为8位色图或做色调映射。
- 对比：256×128为91,689字节；128×64为24,629字节。正式选择128×64（减少97.90%），抽样10个法线方向、RGB三通道的Lambert环境照明相对源文件最大偏差0.160%。峰值亮度从约5.905变为5.356，反射中的细小亮区会更柔和；该数值检查不等于完整的镜面视觉比较。记录在 art/reviews/temple-ibl-manifest.json。
- 正式资源为 src/assets/environment/kloofendal-overcast-puresky-128.hdr，以Vite静态资源导入生成哈希URL。取消远程1K自动回退，避免移动端意外下载大文件。PMREM仍按场景创建一次、换房间复用；源图128宽对应32像素的立方体基准面。天空亮区水平旋转169度，与树外侧主光方向大致一致。
- npm run prepare:temple-ibl 复用归档源文件并重建小图；npm run check:temple-pbr 增加HDR重现校验。真实小图已通过HDRLoader解码、IBL控制器接入、失败回退与资源释放检查；原光照流程、定向静态检查通过。独立审视页生产构建确认仅打包一张24,629字节的HDR，未携带原1K文件。
- 当前浏览器和应用列表仍为空，未完成实际WebGL画面预览；不将解码/构建测试表述为视觉验收。

## Edge 控制台警告（2026-10-16）

- 游戏和审视页统一改用THREE.PCFShadowMap，替换已弃用的PCFSoftShadowMap。阴影图尺寸、主光方向和阴影光数量保持原配置。
- 用户提供的X4122精度日志与官方 [#32692](https://github.com/mrdoob/three.js/issues/32692) 数值一致，属于Windows ANGLE/HLSL编译PMREM GGX预过滤时的微小浮点差值提示。官方保留其计算；本轮没有屏蔽shader诊断或更改Three.js采样算法。

## 地面标高、侧墙重叠与近山层次修正（2026-10-16）

- 原完整格子地板底衬位于-0.146，而翻开后地板面位于0.06，导致卡牌周围出现低一截的地面。底衬改为固定0.058、表面0.06，仅保留2mm绘制间隔；角色脚下地面也统一到0.06。隐藏卡牌底部改为落在0.06上，翻牌起始高度与实体一致，结束时回到统一地面。底衬不跟随翻牌、悬浮或点击按压移动。
- 已确认新增深侧墙顶部-0.43与种植带外墙[-0.69,-0.21]的外表面共面重叠。深侧墙现从种植带外墙底部（动态传入outerWallBottom）往下接合，保留原底部范围，接缝由原腰线覆盖；不依赖polygon offset掩盖重叠。
- 近山层加入38%灰蓝空气透视色，降低对比度和饱和度。只调整该层RGB，山体轮廓继续保持不透明，远山不会透进近山；现有山层高度、视差和云动画保持原配置。
- 检查通过：隐藏卡牌落地/翻开格子等高、翻牌地面固定、角色地面等高；侧墙首行射线检查无重复深墙表面、上下墙边界接合及原底部范围；卡牌实体、卡背翻转、点击交互、美术预览配置、定向静态检查和审视页生产构建。当前会话仍未连接浏览器，近山最终观感和GPU画面需现场确认。

## 收敛灰白反射（2026-10-16）

- 用户提供实际手机画面后，授权先调整IBL与卡背反射。IBL强度由1.1降至0.6，主直射光保持原配置；审视页默认强度同步。
- 卡背粗糙度改为0.76-raised×0.22（最低0.50），原为0.76-raised×0.39（最低0.32）；五种卡背的花纹金属度上限分别从0.55/0.40/0.35/0.48/0.25降至0.28/0.20/0.18/0.24/0.12。保留色图、8.5倍浮雕法线和现有地板/墙体数据。
- 已核对本地Three.js WebGLRenderer：使用scene.environment时，scene.environmentIntensity会覆盖材质的envMapIntensity。因此移除卡背上无效的envMapIntensity参数，材质之间的反射差异由粗糙度和金属度控制，不加入额外shader补丁。
- 生成前后散列核对确认仅五张卡背表面图改变，四种地板的8张表面数据保持一致。13张生成数据校验、PBR接入/资源生命周期检查、定向静态检查和独立审视页生产构建通过。本轮没有新的浏览器实机验看结果。

## 深色石材与可见地面高光（2026-10-16）

- 用户提供参考图，希望呈现深色石材上的局部反射亮斑。检查确认之前地板使用Standard材质、粗糙度大多偏高且法线较浅；仅减小IBL无法形成所需的磨亮反射。
- 地板改用MeshPhysicalMaterial，metalness保持0，clearcoat为0.65。底层和表层共用各格的法线/粗糙度图，按G通道控制表层粗糙度，没有增加环境图或投影光源。四种地面重新推导多尺度浅法线，并以矿物纹理和固定种子的空间变化建立磨损区；粗糙度范围约0.18–0.96，10%分位约0.18、90%分位约0.84–0.88。仍是平面几何，无位移、不改变地板标高。
- 地板色乘数为0xa0b1ac，卡背为0xb9ad99，石墙基础色由0xe7e9df改为0xb7c2b1。压深前景漫反射，卡背关闭微量自发光，保持原有低饱和色相、浮雕强度及色图源文件。IBL仍为0.6，主光方向/强度保持原配置。
- 新增surface-color.js保存材质的基础色乘数，翻牌/可达状态刷新时叠加状态色，而不把本轮的深色基调覆盖为白色。未给角色/敌人贴片增加照明或真实投影。
- 验证通过：13张数据图校验（新增磨亮/粗糙区域分布约束），物理地面反射通道与共享贴图、颜色刷新不丢失基础色，翻牌/移动与平整地面、卡背实体及翻转、定向静态检查和审视页生产构建。另用实际地板法线/粗糙度估算默认40度视角下的GGX直射反射响应，确认反射随表面法线与观察方向变化；此估算不替代WebGL视觉验收。
- 工具再次返回apps/browsers均为空，尚无实际GPU画面和手机性能验收结果；不将材质配置检查或数值光照估算表述为参考图效果已复现。

## Playwright 实际截图校正（2026-10-16，替代上一轮反射层方案）

用户明确授权改用Playwright截图。使用本机已安装的Playwright和系统Edge，在独立无头浏览器中打开实际 http://127.0.0.1:3000/arttweak；移动视口460×1000，DPR=2。通过请求拦截仅暴露GameScene引用供检查，最终截图的灯光、材质均来自正式源代码，没有临时覆盖参数。另将镜头水平转动约14度确认高光移动；这不是离线渲染图，也不是原生手机GPU性能测试。

- 截图对比了关闭clearcoat、只保留直射、只保留IBL、收敛天空反射、不同法线/粗糙度、转动视角及Neutral色调映射。关闭clearcoat单独改善有限；主要问题是天空反射抬高中间调、直射角度不利于默认镜头高光，以及过强的法线与粗糙度斑块。
- 最终主光位置(-4,8,-7)，仍位于树外侧左方；颜色0xf4f5ef，强度2.8。IBL全局强度0.32，旋转149度。地面显式复用同一PMREM，强度为全局的0.22（当前0.0704），使暗部补光和地面泛白可以分别控制；没有新增HDR或反射渲染通道。
- 去掉clearcoat；地面保留Physical材质的非金属高光，specularIntensity=0.6，粗糙度图约0.36–0.72，法线缩放0.35。删除上一轮随机大斑块粗糙度，改为基于矿物纹理和裂缝的连续变化。卡背法线缩放由8.5降至1.3，底色乘数改为0xafb2a9，减少碎裂般的强阴影。地面色乘数0xc0d4db。
- 山寺场景启用NeutralToneMapping，exposure=1，压缩反射峰值并拉开暗部颜色；其他环境沿用原配置。UI仍为原CSS/插画，未重绘贴图或改动平整地面、墙体布局及玩法。
- 地面环境图绑定同时覆盖HDR异步加载前已存在的格子、换房间后新建的格子和销毁恢复；审视页强度/旋转滑杆同步地面显式环境图。相应检查通过，原翻牌、移动、颜色刷新、定向静态检查与独立审视页构建通过。
- 最终页面/控制台错误为0；仍有官方已知X4122精度警告，未屏蔽诊断。截图与实际配置记录：
  - [调整前全屏](../art/reviews/temple-lighting-before-mobile.png)
  - [调整后全屏](../art/reviews/temple-lighting-final-mobile.png)
  - [默认视角地面](../art/reviews/temple-lighting-final-floor.png)
  - [转动视角高光](../art/reviews/temple-lighting-final-turned.png)
  - [捕获状态](../art/reviews/temple-lighting-final-capture.json)

## 整体亮度微调（2026-10-16）

- 用户确认高光后要求场景再亮一点。山寺游戏场景与独立审视页的Neutral曝光从1提高到1.2，主光、IBL、材质粗糙度及反射参数保持不变。
- 使用Playwright重新捕获默认和转动视角并检查：卡背与栏杆亮度提高，地面仍保留随视角移动的高光。PBR检查、定向静态检查通过；页面错误为0，仍只有已知X4122精度警告。
- [默认视角](../art/reviews/temple-lighting-brighter-floor.png)、[转动视角](../art/reviews/temple-lighting-brighter-turned.png)、[完整布局](../art/reviews/temple-lighting-brighter-mobile.png)、[捕获状态](../art/reviews/temple-lighting-brighter-capture.json)。

## 卡背金属镶纹（2026-10-16）

- 按用户要求提高五种卡背的花纹金属度。利用现有浮雕高度生成平滑镶纹遮罩：raised在0.06–0.65间过渡，金属度最高0.96，纹路粗糙度约0.30（带原图细微磨损）；凹陷底板保持非金属和约0.78粗糙度。重新生成五张共享ORM数据图，地板数据不变。
- 卡背颜色乘数由0xafb2a9改为0xd6be8e，使原花纹反射呈现暖金色，保留各属性的底板颜色；原始色图、法线和场景光照参数不变，没有新增纹理或渲染通道。
- Playwright检查默认及水平转动约14度的实际游戏截图，金属亮边随视角变化。13张数据图校验、PBR接入和定向静态检查通过；页面错误为0，仍有已知X4122精度警告。
- [默认视角](../art/reviews/temple-card-gold-floor.png)、[转动视角](../art/reviews/temple-card-gold-turned.png)、[完整布局](../art/reviews/temple-card-gold-mobile.png)。

## 面向初始化视角的低分辨率材质（2026-10-16）

- 按用户要求以arttweak初始化镜头验收，记录为zoom=1、俯角40度、水平角0、房间偏移(-0.57,0,0.969)。Playwright使用460×1000 CSS像素、DPR=2，另外输出scale=css的1倍截图检查实际显示大小；默认画面未缩放或转动，转动截图仅补充检查反射。
- 新增scripts/prepare-board-runtime.py，保留原始色图和历史生成数据，派生src/assets/board-runtime下27张256×256资源。9张色图为WebP，9张法线与9张ORM为无损PNG，数据贴图按线性通道重采样，法线重新归一化。运行时Canvas也从512降到256，地面边框继续在512逻辑坐标绘制后等比缩放。材质、翻牌快照及每格地板继续共享资源。
- 色图保留55%的原始色度，过滤细碎颗粒，卡背纹路使用较低饱和的旧金色，材质色乘数0xdad1ba。纹路金属度仍最高0.96，主要纹路粗糙度约0.38，削弱针点式反光而保留金属明暗。
- 石板增加四组固定的主要裂缝及少量分支；裂缝同时进入颜色、法线、粗糙度和局部遮蔽数据。磨损改以大范围纹理控制，减少缩小后挤成噪点的细节。仍是平整网格，没有几何位移或全场实时AO。
- 此27张运行时资源从9,745,163字节降为1,457,552字节，减少85.04%；同为RGBA加完整mipmap时，这组Canvas纹理理论显存从约36MiB降至9MiB，不代表整场景显存或原生手机帧率测试。原始资源保留在仓库，但实际页面图片请求及独立预览生产包均只使用这组新棋盘资源。
- 生成：npm run prepare:board-textures；校验已接入npm run check:temple-pbr。通过生成数据/清单校验、共享纹理与异步释放检查、PBR与房间重建、翻牌生命周期、定向静态检查和预览页生产构建。实际页面错误为0，仍有已知X4122精度警告。
- 截图：[初始化视角](../art/reviews/temple-board-readable-default.png)、[1倍完整手机布局](../art/reviews/temple-board-readable-mobile.png)、[转动视角](../art/reviews/temple-board-readable-turned.png)。实际镜头、尺寸及27个图片请求记录在[捕获状态](../art/reviews/temple-board-readable-capture.json)，派生文件散列与体积记录在[资源清单](../art/reviews/board-runtime-manifest.json)。

## 取消卡背金属与黄金质感（2026-10-17）

- 按用户反馈取消上一轮高金属镶纹方案。卡背材质metalness固定为0，运行时和历史ORM生成器的金属通道均清零；去掉旧金色重染，保留原图55%色度和256×256资源。色乘数由暖色0xdad1ba改为中性0xb8bfba。
- 卡背粗糙度提高至约0.74–0.86，保留浮雕法线及轻微柔和高光。地板反射和场景灯光沿用此前配置。27张运行时贴图当前合计1,281,526字节。
- Playwright在arttweak默认40度俯角、zoom=1下检查，并补充转动视角：已无闪亮金边，花纹保留哑光浮雕明暗。页面错误为0，仍只有已知X4122精度警告。生成图校验、PBR接入与资源生命周期、定向静态检查通过。
- [默认视角](../art/reviews/temple-card-matte-default.png)、[完整手机布局](../art/reviews/temple-card-matte-mobile.png)、[转动视角](../art/reviews/temple-card-matte-turned.png)、[捕获状态](../art/reviews/temple-card-matte-capture.json)。

## 卡背偏暗原因与局部提亮（2026-10-17）

- 用户反馈多种卡背偏暗。用Playwright在同一初始化镜头分别比较原参数、只移除卡背颜色乘数、只提高全局IBL（0.32至0.6）的画面；原始底色较深，再叠加0xb8bfba压暗色，是卡背偏暗的主要可调整因素。该色在线性空间将RGB乘到约0.48–0.52。
- 卡背材质色乘数改为0xf0f0ed，减少重复压暗；保留低饱和原图、256像素资源、metalness=0及约0.74–0.86的粗糙度。没有重新添加自发光，场景光照和地板材质沿用现有参数。
- 使用正式源代码重新捕获初始化视角，卡背各属性底色和纹样更清晰。PBR颜色刷新/生命周期检查与定向静态检查通过，页面错误为0，仍只有已知X4122精度警告。
- [默认视角](../art/reviews/temple-card-readable-default.png)、[完整手机布局](../art/reviews/temple-card-readable-mobile.png)、[捕获参数](../art/reviews/temple-card-readable-capture.json)。

## 低饱和与亮度分开控制（2026-10-17）

- 用户明确低饱和指避免鲜艳正色，并非压低亮度。上一轮仅移除材质乘色，原图暗部仍过暗。本轮直接调整五种卡背派生色图的明度曲线：在保持55%原图色度的基础上，L映射为1.08×L^0.70，再按亮度比例缩放RGB。零值仍为零，不叠加统一灰色底；提高暗部和中间调，保留柔和属性色与凹凸对比。
- 粗糙度、法线、非金属设定、256像素尺寸及原图均保留；地面和场景光照沿用现有配置。新资源清单合计1,289,816字节。
- 使用Playwright检查arttweak初始化40度、zoom=1和手机1倍显示尺寸，并补充转动视角。灰蓝、暗红与土黄色底板更明亮可辨，花纹保留柔和明暗，没有恢复金属反射。生成数据校验、PBR接入检查通过，页面错误为0，仍只有已知X4122警告。
- [默认视角](../art/reviews/temple-card-light-palette-default.png)、[完整手机布局](../art/reviews/temple-card-light-palette-mobile.png)、[转动视角](../art/reviews/temple-card-light-palette-turned.png)、[捕获记录](../art/reviews/temple-card-light-palette-capture.json)。

## color-ref 参考驱动的纹理配色（2026-10-17）

- 已查看color-ref五张图片：Spirited Away Bath House.jpg、下载.jpg、下载 (1).jpg、下载 (2).jpg、下载 (3).jpg。取共同的色彩关系：明亮中间调、温润米灰/旧砖红、克制的青灰/灰蓝、有色暗部及较柔和的纹理内部反差。按“温暖冷淡”理解为温润、安静而非高饱和或压暗。没有复制其建筑构图，也没有使用参考图像素作为游戏贴图。
- 新增scripts/scene_color_palette.py集中定义各材质的暗部/中间调/亮部色阶。棋盘色图经prepare-board-runtime.py在离线生成阶段应用配色；保留各属性颜色识别，普通石色与栏杆第二轮向暖米灰收敛，蓝色和砖红保留冷暖对照。地板从黑青底色调整为较明亮的青灰石色，粗糙度和法线继续使用原几何纹理数据。
- 新增scripts/prepare-temple-palette.py，输出environment/palette-v1下石材、砖砌、木门、土壤四张256像素WebP和枫树/旗幡两张PNG。只改色，保留原始素材；两张透明道具保留原尺寸、逐像素alpha。游戏TempleEnvironment和独立建筑预览同步使用这些色图，逐格墙结构、UV、阴影及动画保持原配置。
- 本轮主光、IBL、曝光、材质乘色和显示色调映射参数均沿用之前设置。柔和感来自纹理固有色与对比度调整，没有加入后处理或新雾层。卡背仍为非金属哑光浮雕。
- 生成：npm run prepare:scene-colors；直接配色参数位于scene_color_palette.py。生成文件记录在board-runtime-manifest.json与temple-palette-manifest.json，后者检查接入check:temple-pbr。色图重建/散列、透明轮廓、逐格建筑和所有方向门、PBR颜色刷新/资源生命周期、定向静态检查与独立预览生产构建均通过。
- Playwright使用arttweak初始化镜头（40度、zoom=1）进行两轮截图审视；最终确认27个棋盘图片请求及6个改色环境图片请求。页面错误为0，仍有原先已知X4122精度警告。此为Edge手机视口模拟，未做原生手机GPU性能测量。
- [默认视角](../art/reviews/temple-reference-palette-default.png)、[完整手机布局](../art/reviews/temple-reference-palette-mobile.png)、[转动视角](../art/reviews/temple-reference-palette-turned.png)、[实际捕获参数与请求](../art/reviews/temple-reference-palette-capture.json)。

待后续：用户希望最终画面有氤氲朦胧感，本轮明确暂缓实现。后续单独讨论最终后处理的柔化、亮部扩散与远近空气感，避免重新变成全屏灰白蒙层，并保留文字和交互信息的清晰度。

## 纹理体积与首屏加载优化（2026-10-17）

- 用Playwright在全新Edge移动视口（460×1000、DPR=2）测量arttweak初始化页面的实际图片/HDR资源请求；提前将ResourceTiming缓冲区提高到10000，避免默认缓冲区截断导致漏计后加载的敌人部件。场景检查用route会关闭缓存，前后采用相同条件。统计为图片响应体，不包含脚本、字体和页面总耗时，也不是原生手机性能测试。
- 发现prepareEnemyPuppets原先遍历所有敌人，首屏加载416张原部件图，共54,411,319字节。现仅预备gnawer尺寸参照，其他部件由实际显示的敌人按需请求；代码模型、骨架与动画均不变，编辑器继续使用原图。
- 新增prepare-runtime-textures.py和gameplayEnemyTextureUrl：621张分割部件派生为最长边256的WebP，完整部件集从70,076,236降到10,042,418字节。原图保留，源UV/裁切比例保持，透明通道与同尺寸重采样结果一致，注册表带版本查询用于刷新缓存；未注册的图片仍走原有URL处理。
- 石材法线/ORM从512降到256，重采样后重新归一化法线。枫树1100×1024降到512×477、旗幡436×1024降到218×512，改用带透明度的WebP。山、峰、云最长边降到768，背包背景砖图降到256。树/旗幡使用本轮生成的配色图缩小，配色和光照参数保留。
- 物品两个显示档由最长边256/512改为128/256，重建146个物品共292张小图；备份原始素材保留。卡背、棋盘地板及其法线/ORM仍为256×256；HDR仍128×64、24,629字节。
- 同一首屏图片请求478次降至91次，接收数据64,467,453降至3,749,919字节（减少94.18%）。按唯一资源去重为63,896,460降至3,583,160字节。敌人初始部件从416降至29张、551,904字节；物品图从3,240,672降至877,346字节。这些是arttweak首屏数据，后续房间按需加载其资源。
- Playwright验证未显示的emberwing-moth起初没有请求，调用生产创建逻辑后新增16张小图，其30个可见部件全部有纹理、缺失数0；[按需加载记录](../art/reviews/enemy-demand-loading.json)。默认手机视角检查角色轮廓、卡背纹样、树和旗幡边缘；页面错误为0，仍只有已知X4122精度警告。
- 检查通过：621张部件和4张背景的散列/尺寸/alpha校验；树/旗幡重采样alpha一致；石材法线单位向量与数据图校验；所有敌人朝向/后仰/缩放/动画、场景光照与翻牌/移动、PBR与资源生命周期、定向静态检查、独立预览生产构建。
- 重建命令：npm run prepare:runtime-textures；资源检查：npm run check:runtime-textures。棋盘256资源仍由prepare:board-textures管理。
- [加载前后汇总](../art/reviews/texture-loading-audit.json)、[加载前记录](../art/reviews/texture-loading-before.json)、[加载后记录](../art/reviews/texture-loading-after.json)、[缩图后默认画面](../art/reviews/temple-texture-lite-default.png)、[完整手机布局](../art/reviews/temple-texture-lite-mobile.png)。

## Tailscale 渐进式启动（2026-10-17）

- 用户报告通过Tailscale访问arttweak时长时间只有黑底。检查发现index.html只有空HUD，main静态依赖Vue/styles，而VueHud又静态导入GameScene，使整个场景模块树下载完成之前没有任何可见界面。图片按需加载不能解决这一段模块等待。
- index.html加入内联关键样式、无外部图片的棋盘占位和状态文字；最小boot.js动态导入main，并在入口加载失败时保留可见错误与重载按钮。主入口异步路由初始化的错误也由boot统一接住。
- VueHud移除静态GameScene导入：先挂载HUD，在nextTick及两个animation frame后移除HTML占位并动态载入场景。场景未就绪时HUD使用inert阻止提前操作，加载/失败状态位于inert区域之外；卸载标记防止异步模块迟到后创建失效场景。
- 场景构建不等待图片或HDR：先显示基础棋盘，卡背和地板使用对应柔和底色，角色和贴图按原异步逻辑补齐。卡背/IBL等待只控制角落提示，不阻塞首次渲染或后续操作。失败时提供“重新加载”，没有伪造百分比进度。
- Vite开发/预览缓存策略扩展到带版本号的WebP，实测Cache-Control为public, max-age=31536000, immutable；生成注册表的版本变化会切换URL。避免每次通过远程连接重复下载未改变的敌人小图。
- Playwright明确阻塞main、scene和棋盘/敌人图片，验证顺序：HTML占位先于main、HUD先于scene、基础棋盘先于贴图、图片到达后补齐36格与3个敌人。另分别中断入口和scene请求，两个重载按钮均可见且可操作。普通游戏入口也通过，成功流程页面错误为0。此为本机人为延迟验证，未宣称测得用户实际Tailscale链路时延。
- 通过arttweak确定性/存档隔离/视角检查、共享贴图与释放检查、入口JS定向静态检查、VueHud SFC/script/template编译及渐进入口限定生产图构建。既有开发环境缺少eslint-plugin-vue与marked：常规lint仍受缺失插件影响；定向检查使用SFC编译器和JS ESLint，限定构建将marked外置，不算全量生产构建验收。
- 截图：[HTML即时占位](../art/reviews/progressive-01-html.png)、[HUD先显示](../art/reviews/progressive-02-hud.png)、[基础棋盘与占位色](../art/reviews/progressive-03-board.png)、[贴图补全](../art/reviews/progressive-04-ready.png)、[场景失败重试](../art/reviews/progressive-scene-retry.png)、[入口失败重试](../art/reviews/progressive-entry-retry.png)。[阶段验证记录](../art/reviews/progressive-startup-check.json)。
