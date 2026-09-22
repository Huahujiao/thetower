# 界面与交互

## 适配范围

游戏主界面面向竖屏手机，棋盘、顶部状态、操作栏和背包在一个视口内排布。`/wiki` 是独立的可垂直滚动图鉴页面。

## 主界面结构

1. **顶部状态栏**：显示楼层、等级和金币；右侧提供天赋图鉴、角色、帮助、设置和日志按钮。顶部不显示全局回合或体力数值。
2. **提示与经验区**：显示下一次攻击增益、中毒／燃烧状态和经验进度。
3. **三维棋盘**：显示正方形卡牌、角色、敌人、物品、陷阱、NPC、门和路径预览。
4. **下方面板**：背包为横向 4 行 × 8 列，圣遗物作为普通物品直接占用其中一格。

## 二维皮影动画工具

`/animeedit` 是独立的平面敌人动画编辑器，采用部件列表、SVG 舞台、时间轴和属性面板四区布局。左栏内置猩鬼、烬翅蛾、伏巢蜘蛛、重甲卫士、涡眼浮囊五套可继续编辑的敌人皮影示例，切换示例前会确认是否覆盖当前工程。骨架模式用于创建圆形、长方形、三角形、椭圆、胶囊形和菱形部件，绑定父骨骼并设置轴心、层级、颜色、透明度与独立贴图；动画模式用于编辑待机、攻击、受攻击、死亡和移动五种动作的位移、旋转、缩放与透明度关键帧。拖动部件会按当前模式修改静态骨架或写入当前时刻关键帧。`/animepreview` 使用同一工程进行只读播放，支持动作切换、倍速、重播与骨骼显示。两页都只渲染二维 SVG，不创建 Three.js 场景。

## 底部面板布局

底部操作栏按下方 9 列网格划分：

| 位置 | 占位 | 内容 |
| --- | ---: | --- |
| 第 1–1.5 格 | 1.5 格 | 丢弃按钮，按需显示；按钮本体靠左，容器始终保留。 |
| 第 1.5–2.5 格 | 1 格 | 护甲图标和护甲数值。 |
| 第 2.5–6.5 格 | 4 格 | 上方生命条，下方黄色体力条；两条之间保持 4px 间距。 |
| 第 6.5–8 格 | 1.5 格 | 使用按钮，按需显示；按钮本体靠右，容器始终保留。 |
| 第 8–9 格 | 1 格 | 与背包格同尺寸的正方形旋转按钮，选中可旋转物品时启用。 |

丢弃和使用按钮隐藏时仍保留各自 1.5 格的布局空间，因此生命、体力、护甲和旋转按钮不会随按钮显隐跳动。生命条和体力条总容器高度为 32px，两条实际高度各 14px，间距为 4px。体力条使用黄色，不再使用“气力”文字。

点击背包物品可选中它。选中非武器物品后使用按钮出现；选中任意物品后丢弃按钮出现。武器直接从背包选中，再点击棋盘敌人进行攻击；不再有左右手区域或“卸下”按钮。

散件的相邻效果生效时，只在散件与受益装备实际接触的格线处显示一条绿色短光带。短光带由后、中、前三张透明纹理叠加，使用不同的流动与局部明暗周期，横边和竖边保持同一长度与节奏；拖动物品期间隐藏，避免干扰落点判断。

## 三维棋盘

- 默认相机采用倾斜视角，支持单指或鼠标拖动平移以及有限范围缩放。
- 初始三维视角略微拉远；墙柱顶部收窄，减少视觉遮挡。
- 卡背使用灼热红、枯萎黄、沉溺蓝和中性灰白四种主题；不显示卡牌内容文字。
- 敌人立牌保留红色危险主体，属性通过细轮廓和头部圆环颜色区分；商人使用金色轮廓。
- 武器正面显示名称、类别、攻击、射程、属性和占格，不显示耐久。
- 角色和敌人脚下使用与空地一致的地面格；敌人生命条显示在立牌上方，行动延迟或普通攻击冷却显示在脚下。
- 第一次点击远处目标显示路径预览，再次点击同一目标才确认。门也使用相同的两步确认，点击门或门前预览标记均可确认；路径中的每一格都会按移动规则单独结算，确认进门后会等待门前移动及途中翻牌动画完成。
- 陷阱翻开后显示“已触发”，保留两个后续全局回合后移除，期间不会重复触发。

## 详情与弹窗

长按棋盘对象或背包物品打开详情面板，显示其名称、类别、属性、数值和效果。武器的攻击、射程、体力消耗为独立数值行，其他效果另起一行；未生效的相邻关系不显示。弹簧触发后，除触发武器外的每把可用武器详情都显示“下一击体力消耗-1”，背包物品本身不增加角标。图片框固定为宽 2 格、高最多 3 格，精灵图以 `contain` 等比缩放，并由硬性尺寸、最大尺寸与裁切共同限制，不会越过图框。角色面板显示等级、经验、生命上限和天赋数量；天赋面板显示 10 条主线的三层节点状态。帮助、角色、天赋、设置和日志都是独立面板，不向棋盘透传点击。圣遗物详情通过背包物品或掉落卡牌查看。

商人面板显示购买、出售和圣遗物购买服务。购买、出售、刷新货架及圣遗物购买均为即时操作，不推进回合；商人不再提供圣遗物配置。

## 日志与结算

## Mobile portrait input contract

## Inventory staging interaction

The staging label is centered and uses the same type scale as the discard label.

Backpack movement is touch-only. A 300 ms hold on an occupied item opens details; moving more than 18 px after the hold enters drag mode. Taps select an item for use or combat and never move it. The first occupied cell of the rotated shape remains the model anchor, while dropping snaps the floating footprint center to the nearest target footprint center with a half-cell tolerance. Green, yellow, and red previews mean accepted, replace-to-staging, and illegal respectively. The red discard zone occupies exactly 25 percent of the full viewport area above the backpack; the blue free-form staging canvas occupies the remaining 75 percent and meets the backpack without a gap. Staged items preserve the backpack's cell size and rotated proportions; automatic arrivals seek a non-overlapping position before using the least-overlapping available position. The detail panel is layered above both zones, so staged items can still be inspected. Staging remains visible until empty, and clearing it advances one organize turn. Each fresh second-finger touch rotates the dragged item clockwise by 90 degrees, so repeated taps rotate it repeatedly. Cancel, blur, visibility changes, and invalid release restore the original state.

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
