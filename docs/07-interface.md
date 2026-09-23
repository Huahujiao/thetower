# 界面与交互

## 适配范围

游戏主界面面向竖屏手机，棋盘、顶部状态、操作栏和背包在一个视口内排布。`/wiki` 是独立的可垂直滚动图鉴页面。

## 主界面结构

1. **顶部状态栏**：显示楼层、等级和金币；右侧提供天赋图鉴、角色、帮助、设置和日志按钮。顶部不显示全局回合或体力数值。
2. **提示与经验区**：显示下一次攻击增益、中毒／燃烧状态和经验进度。
3. **三维棋盘**：显示正方形卡牌、角色、敌人、物品、陷阱、NPC、门和路径预览。
4. **下方面板**：背包为横向 4 行 × 8 列，圣遗物作为普通物品直接占用其中一格。

## 三维骨架动画工具

`/animeedit` 是独立的三维敌人骨架动画编辑器。角色库通过下拉框切换角色，并可新增、重命名、复制和删除；删除最后一个角色后会立即补充一个空白角色。每个角色的关节、骨骼线、几何部件及五套动作都自动保存到 `localStorage`，页面不提供手动保存、导入或导出。初次打开会加入碎铃行僧、潮眼蛛母、缝腹灯蛾三个可编辑示例，分别是直立、多足、飞行怪物；同时保留空白角色供从零创作。已有角色不会被覆盖，示例只安装一次，删除后不会重新出现。每个示例都有待机、攻击、受攻击、死亡、移动五套动作，并统一面朝左前方 45°；骨骼和动作都包含 Z 轴前后变化。角色名称只使用本名，不附加“皮影”后缀。旧版二维角色自动迁移到 Z=0 平面，保留原有关键帧。

标准制作顺序是：在“骨架”模式点击画布创建关节点，编辑 XYZ 位置与三个轴的旋转；切换“连接”后依次点击起点和终点关节创建有方向的骨骼线，关节也可以保持不连接；在“部件”模式创建几何部件，设置 XYZ 空间位置／旋转，再将其设为自由、绑定关节或绑定骨骼线；最后在“动作”模式选择待机、攻击、受攻击、死亡或移动，在时间轴位置拖动关节／部件或输入 XYZ 位移、旋转、缩放值来记录关键帧。画布默认正面，单指拖动空白处平移、双指缩放；点击 3D 后单指旋转视角，点击“正面”复位。预览页也可以调整视角，但不修改角色。骨骼、关节和显示部件是独立的数据层，部件不会兼任关节。当前部件仍为可在三维空间定向的平面几何形状；贴图模式暂未开放。两页共用 Three.js 舞台，游戏中的 Three.js 场景不受影响。

编辑页顶部不显示页面标题。返回、角色下拉框、改名、新建、复制、删除、预览全部位于同一行；四项角色操作使用图标，改名弹出输入对话框，删除前需要确认。手机竖屏下，顶部栏、模式菜单和工作区分别占视口高度的 8%、6% 和剩余高度；页面本身禁止滚动。画布在“骨架／部件／动作”三种模式中始终保留，只切换下方的上下文工具。工作区使用纵向 flex；底部工具区按部件页选中部件时的五行内容计算，高度固定为 171px，骨架、部件、动作三个模式共用，画布占据剩余高度，切换模式或选中对象不会改变分界线。这个高度包含形状行 28px、部件选择行 29px、三行字段各 27px，以及行距、内边距和边框。部件工具区中，改名、复制和删除都使用图标，改名图标位于复制、删除之前，点击后弹出输入框；绑定／目标／可选的“位置”为一行，宽／高／旋转为一行，层级／填色／描边为一行。所有标签固定宽度 20px，与控件同行并对齐。画布空白处单指拖动可平移，双指捏合可缩放；直接拖动关节或部件仍会修改其位置，轻点空白处仍可按当前工具创建对象。视图平移与缩放只影响编辑显示，不修改角色数据。画布使用深蓝灰背景；取消勾选“网格”会同时隐藏几何部件和背景辅助格，只留下关节点与骨骼连线。关节点最后绘制并始终位于骨骼线、辅助格和部件之前。

骨架页在“选择”工具下不显示“点击关节或骨骼进行编辑名称”的提示，也不保留空白提示行；创建关节、连接和错误状态仍显示各自提示。选中关节点时，名称占第一行完整宽度，X、Y、旋转在第二行分为三列，两行之间留出间距，不必挤在一行。选中骨骼线时，连接关系占据名称输入框下方的完整一行，不换行；极长名称会在面板边缘省略，避免挤压布局。

动作页的播放控制行按“播放、归零、时间读数、时长、循环”排列。播放、归零、时间读数和循环占固定宽度且不换行；时长输入框独占剩余宽度，随手机宽度伸缩，不再挤压其他按钮。进度条右侧是“记录帧”和“删除帧”：它们作用于当前时间点的全部关节和部件，不依赖当前选中对象；进度条标记汇总整个动作的所有关键帧时间。骨骼线由关节姿态推导，不单独记录。六个变换字段采用三列、两行布局，每个字段的标签与输入框同行，标签固定宽度；不再为选中对象名称单独占一行，选中对象仍在画布中高亮并作为表单的无障碍名称。这样动作工具区共五行，完整放进固定的 171px 面板，不需要内部滚动。动作选择行末尾有“重置”按钮：若当前动作已有关键帧，确认后只清空该动作的关节和部件轨道，停止播放并将时间归零，回到骨架与部件的初始姿态；其他动作、基础摆放、时长和循环设置保持不变。

动作进度条的滑块固定为 16px，轨道输入框不再使用浏览器默认外边距；可见轨道和下方帧标记的左右端都内缩 8px，与滑块中心从最小值到最大值的实际行程一致。因此滑块、轨道着色端点和帧标记在相同时间点水平对齐。

## 底部面板布局

底部操作栏从左到右显示护甲、生命／体力条和按需出现的“使用”按钮；丢弃与旋转通过背包拖动手势完成。生命条和体力条之间保持 4px 间距，体力条使用黄色。

点击背包物品可选中它。选中可使用物品后出现“使用”按钮。武器直接从背包选中，再点击棋盘敌人进行攻击；不设装备栏。

散件的相邻效果生效时，只在散件与受益装备实际接触的格线处显示一条绿色短光带。短光带由后、中、前三张透明纹理叠加，使用不同的流动与局部明暗周期，横边和竖边保持同一长度与节奏；拖动物品期间隐藏，避免干扰落点判断。

## 三维棋盘

- 默认相机采用倾斜视角，支持单指或鼠标拖动平移以及有限范围缩放。
- 初始三维视角略微拉远；墙柱顶部收窄，减少视觉遮挡。
- 卡背使用灼热红、枯萎黄、沉溺蓝和中性灰白四种主题；不显示卡牌内容文字。
- 敌人立牌保留红色危险主体，属性通过细轮廓和头部圆环颜色区分；商人使用金色轮廓。
- 武器正面显示名称、类别、攻击、射程、属性和占格，不显示耐久。
- 角色和敌人脚下使用与空地一致的地面格；敌人生命条显示在立牌上方，行动延迟或普通攻击冷却显示在脚下。
- 第一次点击远处目标显示路径预览，再次点击同一目标才确认。门也使用相同的两步确认，点击门或门前预览标记均可确认；路径中的每一格都会按移动规则单独结算，确认进门后会等待门前移动及途中翻牌动画完成。
- 长按背包中的武器时，仅在当前位置射程内的已翻开敌人脚下显示淡蓝色模糊瞄准星，由圆圈和四条短线组成；空格不显示。长按已翻开的敌人时，在它射程内的已翻开空格及玩家所在格显示同形状的红色模糊瞄准星。两种特效从略小于格子的尺寸开始，较慢地缩至约一半并淡出，再较快地放大淡入到初始状态，连续循环。射程 1 按八邻域、射程 2 以上按曼哈顿距离，不检查遮挡。
- 陷阱翻开后显示“已触发”，保留两个后续全局回合后移除，期间不会重复触发。

## 详情与弹窗

长按棋盘对象或背包物品打开详情面板，显示其名称、类别、属性、数值和效果。所有长按详情共用黑色半透明背景，可透出部分三维场景；文字和数值标签保持浅色以保证可读。武器的攻击、射程、体力消耗为独立数值行，其他效果另起一行；未生效的相邻关系不显示。弹簧触发后，除触发武器外的每把可用武器详情都显示“下一击体力消耗-1”，背包物品本身不增加角标。图片框固定为宽 2 格、高最多 3 格，精灵图以 `contain` 等比缩放，并由硬性尺寸、最大尺寸与裁切共同限制，不会越过图框。角色面板显示等级、经验、生命上限和天赋数量；天赋面板显示四条路线的节点状态。帮助、角色、天赋、设置和日志都是独立面板，不向棋盘透传点击。圣遗物详情通过背包物品或掉落卡牌查看。

商人面板显示购买、出售和圣遗物购买服务。购买、出售、刷新货架及圣遗物购买均为即时操作，不推进回合；商人不再提供圣遗物配置。

## 日志与结算

## Mobile portrait input contract

## Inventory staging interaction

The staging label is centered and uses the same type scale as the discard label.

Backpack movement is touch-only. A 300 ms hold on an occupied item opens details; moving more than 18 px after the hold enters drag mode. Taps select an item for use or combat and never move it. The first occupied cell of the rotated shape remains the model anchor, while dropping snaps the floating footprint center to the nearest target footprint center with a half-cell tolerance. Green, yellow, and red previews mean accepted, replace-to-staging, and illegal respectively. The red discard zone occupies exactly 25 percent of the full viewport area above the backpack; the blue free-form staging canvas occupies the remaining 75 percent and meets the backpack without a gap. Staged items preserve the backpack's cell size and rotated proportions; automatic arrivals seek a non-overlapping position before using the least-overlapping available position. The detail panel is layered above both zones, so staged items can still be inspected. Rotation during a drag is a free preview. Each successful drop into the backpack, move into staging, or discard advances one turn; a rotated drop costs one turn in total, and automatically displaced items enter staging without an additional turn. Movement and rotation inside the free-form staging canvas cost no turn. Emptying staging has no separate charge. Each fresh second-finger touch rotates the dragged item clockwise by 90 degrees, so repeated taps rotate it repeatedly. Cancel, blur, visibility changes, and invalid release restore the original state.

The product target is a portrait mobile phone with touch input only. Desktop, keyboard, mouse, stylus, and landscape layouts are outside the supported contract. Inventory long press uses the occupied-cell Vue touch handlers and a 300 ms threshold; do not add desktop pointer compatibility code to the inventory interaction path. For irregular L/T shapes, void cells and the sprite image are excluded from touch hit testing.

Level-up talent cards keep the talent name and its route/type on one header row: the name is left-aligned and the type badge is right-aligned. The fixed option below the divider is named Strong Physique (`强健体魄`) and no longer has a redundant four-character category label above its card.

## Scene status tray

Each revealed enemy has a compact mechanics row above its name. Non-stationary behavior and combat-relevant traits use slightly enlarged symbols, while the final `🏹 number` token always shows the enemy's current attack range. Stationary behavior is omitted to keep the row readable on a portrait phone. Enemy details repeat each available symbol immediately before its matching behavior or feature name, providing an in-game legend for the overhead row.

The former text-only build-status row has been removed. The experience strip now follows the top HUD directly, giving the Three.js board the released vertical space. Active statuses appear in a compact tray anchored inside the board's lower-left edge and flow from left to right. Poison, burning, rage wine, generic attack-up, and energy-discount states use dedicated transparent pictograms, with a corner badge for remaining global turns or the effect value. Holding an entry for 300 ms opens the normal detail overlay; releasing closes it.

The tray includes only temporary effects: poison, burning, and active next-attack or next-weapon buffs such as the rage-wine effect. Relic counters, persistent equipment/talent conditions, defensive counters, and per-weapon adjacency/empty-space build checks remain in their corresponding details instead of occupying tray slots.

Persistent build effects are readable directly in the backpack. Every accessory-to-beneficiary pair whose four-way adjacency effect currently applies is joined across one shared cell boundary by a very short green energy band. The band uses two transparent, differently timed flowing layers; one pair produces one band even when large shapes share several edges, and unrelated adjacent items produce none. These bands do not intercept touches and are hidden during an active drag so stale placement feedback never follows the lifted item.

Relic sprites communicate readiness only through brightness. Three-Phase Wheel, Empty Casket Seal, Traveler Bone Domino, Blood Pact Bronze Mirror, and Broken-Blade Scales are dimmed while their current condition is unmet and return to normal brightness as soon as it is met. Relics without a trigger condition, such as Reverse Stone, remain bright. No badge or replacement DOM node is added, so the inventory image remains stable when state changes.

The teleport talisman reaches a revealed empty cell within Manhattan distance 6. Its mapped inventory sprite is a paper talisman with an ink spatial seal and cyan portal motif; the former pendant artwork remains archived for a later item.

Room walls are fixed boundary geometry. Leaving a tile beside the south wall must not hide or replace that wall; the only south-side visibility exception is the permanent omission of interior pillars, while both corner pillars remain.

Every tile crossed during a movement path visibly depresses when the character lands on it. The preceding footprint starts to rise only after the following movement turn lands, and the final footprint rises when a later global-turn-advancing action occurs. A pressed tile keeps its fixed row-based visual ordering; the camera-facing south wall remains above the nearest row rather than being covered by a temporary downward offset.

The backpack surface has no overall border. Weapon and defense tiers use one to three stars in the detail header, with crafted weapons displayed as two stars. Details show the item sprite in the reserved icon slot when mapped, while ordinary items have no attribute badge. Relic selection uses a full-screen dimmer and borderless cards ordered name, image, and compact description; the description area starts at the top-left of its lower card section.

An equipment detail with one or more forward crafting upgrades shows a compact route block below the normal detail content. Each recipe occupies its own row in the form square contain-fitted icon + square contain-fitted icon ➡ square contain-fitted result icon. The icons have no frame, border, background, names, attribute colors, detail gestures, or interactive targets, so the result's attribute is not disclosed before crafting. The plus and arrow are drawn as stable CSS marks rather than text glyphs. Routes are derived from recipe data and naturally expand to multiple rows when one equipment id gains several recipes.

Every revealed, uncollected floor weapon places a compact translucent attribute glow on its tile: red for scorch, yellow for wither, and blue for drown. The plane spans 0.9 tile widths and no longer forms one filled polygon or scales as a whole. A soft center brightness gradient is overlaid with three sets of narrow star rays using different point counts, angular speeds, phases, and one reverse direction. The layers visibly drift through one another while a separate opacity pulse provides breathing, avoiding both a static puddle and a cartoon starfish silhouette. The glow remains above the floor and below the sprite; the item itself heading-rotates at 1.5 times its original speed.

Weapon and defense detail headers place compact badges directly after the name. Weapons read attribute, weapon class, then one to three star tier marks; defenses omit the attribute badge and read their explicit shield/armor class, then tier stars. Weapon stat chips use sword, bow, and flexed-arm icons for attack, range, and energy cost respectively. Backpack footprint count is not shown in any item detail because the visible occupied shape already communicates it.

右上角日志按钮打开日志面板。日志按最新事件在前显示；当玩家受到致命伤害时，“你倒下了（原因：……）”会被置于顶部，后续同一过程的事件排在其后。日志面板提供“复制日志”按钮，将当前显示的日志复制到系统剪贴板，不再提供发送或分享日志功能。胜败提示使用局部浮层，不遮挡日志按钮。
## Combat animation rendering note

The craft control remains logically disabled while a flip or attack queue is active, but its visual treatment remains stable so the top HUD does not visibly dim or flicker. The lower backpack toolbar has no placeholder slots for removed discard and rotate controls: armor is flush left, health and energy bars fill the center, and Use is flush right.

Only the last step of an action route is atomic with that action. Moving onto loot and collecting it is one atomic turn, and entering a weapon's final attack position and hitting are one atomic turn. Earlier steps on a long route remain ordinary movement turns and can be interrupted by an enemy.

Long-distance movement stops at the first enemy attack, so the selected target is not attacked after an interruption. A chasing enemy completes its smooth move before its attack animation. Movement, flips, player attacks, and enemy attacks are FIFO actions and never overlap.

Attack presentation stays within the original character/card plane size. Each frame redraws its temporary pose from an identity canvas transform, so the 0.5-second animation cannot accumulate bitmap scaling or crop the character to a corner. An attack route is presented as individual one-cell moves: if a long-range enemy gains range at an intermediate landing, the player visibly stops there for that enemy action before the route continues. A player hit, including death or displacement, is refreshed on the board before the attack turn advances; only then can the enemy phase and its next pose begin.
