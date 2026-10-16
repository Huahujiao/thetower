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
