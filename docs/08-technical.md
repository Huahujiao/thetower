# 技术结构与验证

## 入口与路由

- `src/main.js` 是应用入口。
- `/` 创建 `GameRun`、HUD 和 Three.js 场景。
- `/wiki` 创建独立图鉴页面，不初始化游戏场景。
- `/animeedit` 挂载二维皮影骨架与关键帧编辑器；`/animepreview` 挂载共享工程的只读播放器。两个工具页都不创建 `GameRun` 或 Three.js 场景。
- Vite 用于开发和生产构建。

## 模块边界

```text
src/
├─ game/
│  ├─ core/       事件、坐标、几何与两层回合计数
│  ├─ data/       敌人、物品、商人、奖励、陷阱、天赋和圣遗物定义
│  ├─ model/      地牢、房间、4×8 背包、圣遗物持有索引
│  ├─ rules/      寻路、攻击范围、伤害、敌人、地形与圣遗物规则
│  └─ run.js      一局游戏的状态机、动作和持久化
├─ render/        Three.js 卡牌场景、攻击范围覆盖层、相机与交互
├─ ui/            Vue HUD、背包网格与 Wiki 页面
├─ styles.css     游戏页面样式
└─ wiki.css       图鉴页面样式
```

静态内容的主要来源是 `src/game/data/catalog.json`、`talents.js`、`progression.js`、`relics.js`、`merchants.js` 和 `traps.js`。`src/ui/wiki.js` 直接读取这些定义；对象数量和数值应以运行时数据为准。

## 当前运行状态

Room card grids are now one row and one column smaller per floor: 6x6, 7x7, 8x8, 8x8, and 9x9. The 4x8 backpack remains unchanged.

`GameRun` 维护地牢、玩家生命／护甲／体力、4×8 背包、角色成长、圣遗物、商人、奖励、状态效果、敌人状态和日志。圣遗物以 `type: 'relic'` 的 1×1 背包物品保存；`RelicCollection` 是由背包物品同步出的效果索引。普通探索操作回复1体力；消耗品、整理与合成不自动回复。攻击推进攻击计数和全局回合，实际费用包含物品与天赋修正且最低1。接近路径中的每格移动也是独立的非攻击回合。

背包散件光带由 `ItemRules.activeAdjacencyLinks()` 提供真实相邻关系，Vue 只为每条边界渲染一个稳定容器及三个固定纹理层，不重建物品节点。`scripts/process-lightband-assets.py` 从 `ref/lightband.html` 提取三张 base64 原图，将原图保存到 `src/assets/ui/backup/source/`，再按 alpha 内容裁掉上下空白并缩放为 256px 宽的运行时 PNG；游戏仅加载 `src/assets/ui/lightband-*.png`。横向和纵向复用相同纹理，纵向仅旋转容器。容器额外使用左右端点渐隐遮罩，使光带在共享边界两端自然消失，不产生硬切边。

装备详情的前向合成路线继续读取 `upgradeRecipesForItem()`，每个素材图标使用固定方形容器与 `object-fit: contain`，不附加边框、底色或可交互层；加号和箭头由 CSS 线段绘制，避免字体字形、emoji 和基线差异导致裁切或闪动。

回合计数只有 `attackCount` 和 `globalTurn`；`turn` 是全局回合的兼容别名。每次成功将物品放入背包、移入暂存区或丢弃物品，以及合成，均推进1回合；拖拽时旋转只是预览，成功放下时才结算一次。替换造成的自动暂存不另计回合，暂存区自由画布内移动或旋转不计回合。奖励/升级选择与购买/出售不推进计数。运行时不存在左右手、装备栏、行动计数、武器耐久、磨刀石、最后一击、武器损毁或拦截机制。圣遗物无数量超载限制。`ItemRules` 统一处理新版武器、防具、材料、圣遗物与天赋的交叉效果。

## 存档

状态变化后自动保存到 `localStorage`。存档包括地牢、已翻开卡牌、背包位置与旋转、玩家成长和资源、背包中的圣遗物物品、商人货架、奖励袋、`attackCount`／`globalTurn`、中毒与燃烧、敌人自身行动计数、已触发陷阱的延迟移除状态、日志和结算状态。玩家攻击动画期间保存待结算回合标记；读档会完成该回合和敌人阶段。没有装备栏或武器耐久字段。

当前存档版本为 **26**。版本号不匹配、结构无效或玩家位置无效时会删除存档并创建新局；存档同时保留 `turn` 作为全局回合兼容字段。旧的独立圣遗物收藏存档不迁移。

## 验证要求

规则、数据或界面变更后运行：

## Renderer stability

The Three.js scene continues rendering on every animation frame, including while the board is otherwise idle, so future world animations can run without changing the render loop. Container size changes are handled by `ResizeObserver` and the window resize event instead of measuring layout every frame. `AttackRangeOverlay` owns two blurred aiming-reticle canvas textures, one shared plane geometry, and one material per mode independently of room meshes; it follows the board's pan position on each frame. Holding a backpack weapon displays a soft blue circle and four short aiming ticks only below revealed enemies within its range from the player's current position. Holding a revealed enemy displays the same shape in red on empty revealed cells within its attack range, including the player's cell. Both use the combat distance rule. A smooth two-second pulse shrinks and fades the reticles to half size over 1.2 seconds, then grows and fades them in over 0.8 seconds; textures are not redrawn per frame. `game/core/inventory-actions.js` commits backpack gestures and their single turn cost.

The Three.js scene keeps tile meshes separate from room structure. Revealing a door now rebuilds only walls, doors, and explored-room outlines; card faces retain explicit depth clearance, polygon offset, and non-writing face depth to prevent camera-angle flicker. Unflippable cards share a dedicated charcoal-gray card-back texture, independent of hidden attributes. Door confirmation retains the path-preview interaction and accepts either the door mesh or its arrival marker. Movement completion is emitted only after the movement and any queued ambush flip animations are both idle, so entering through a door cannot leave `roomEntering` stuck.

Pillars are fixed by room geometry: the world-space south wall (`bottom` in the renderer's wall-side naming) has no pillars along its middle, while its two endpoints remain eligible (when not occupied by a door); the other walls use normal spacing. Pillars are no longer dynamically hidden based on camera or player position.

Wall pillar capitals and caps use a reduced top profile so their heads do not dominate the wall silhouette. The initial Three.js framing is slightly farther out while preserving the existing camera controls and room-centered composition.

Enemy standing-card overlays now render the enemy name as a doubled-size small label directly above the health bar. The label is a non-raycast child of the same status group and shares the health bar's orientation. Its wide, short canvas texture matches the label geometry, preventing the text from being vertically compressed into a line, and its restrained one-pixel outline preserves readability without a heavy edge; it does not alter board hit testing or movement interactions.

The health-bar and name-label vertical anchors are independent: the health bar sits slightly higher above the enemy head while the name stays in place, tightening their visual spacing without moving the label.

The enemy status group also owns a third non-raycast canvas plane above the name. `enemyOverheadHints()` derives compact symbols from behavior, traits, death rules, death explosions, and death statuses at the data layer; the renderer appends the same `🏹` glyph used by item details plus the current range. Its 21 px logical font is slightly enlarged without changing the plane bounds or vertical anchor. The hint plane shares the standing card orientation, row render order, and depth-independent material used by the name and health bar. Enemy detail formatting reads the same `ENEMY_OVERHEAD_HINTS` definitions, prefixing behavior and feature labels only when a mapped icon exists, so the legend and scene overlay cannot drift apart.

Grid visual layers use a row-based render order: larger row indices are farther south and render later, so southern cards, status overlays, and item sprites cover northern ones. A small per-tile layer offset preserves the intended order between the card, status UI, and sprite within one row; standing overlays disable depth testing so this rule remains stable during camera rotation.

## Enemy baseline

Runtime enemy health is `catalog.json` health multiplied by `ENEMY_HP_MULTIPLIER` (currently `2`). This applies to natural enemies, spawned minions, and the boss; `/wiki` uses the same multiplier. The `heavy-armor` trait reduces every received damage instance by 1 after any shield limit, including damage otherwise marked as ignoring defense. Save version 26 starts a fresh run so persisted player attacks always have a recoverable pending-turn marker.

## Inventory sprite workflow

Inventory artwork is produced per concrete item and its `shape`, not as a generic square class icon. The final PNG canvas uses 512 pixels per occupied grid cell and keeps every unoccupied area transparent; for example, the 1x2 `rust-sword` sprite is 512x1024. Source drafts with unsuitable proportions are retained under `src/assets/inventory/backup/`. Art direction is restrained Chinese cosmic horror: aged-paper grain and ink texture belong within the object while its background remains alpha-transparent. Avoid European-medieval construction, low-poly rendering, and saturated ukiyo-e palettes.

Readability at backpack scale takes precedence over prop detail: narrow vertical weapons need a broad primary silhouette and a chunky guard or grip rather than tassels, fine engraving, or large transparent side margins.

The current reviewed set includes nineteen weapon/defense sprites (`weapon-rust-sword-v2.png`, `weapon-bone-knife-v1.png`, `weapon-ember-spear-v1.png`, `weapon-root-axe-v1.png`, `weapon-rock-maul-v1.png`, `weapon-bell-maul-v1.png`, `weapon-wall-sword-v1.png`, `weapon-return-axe-v1.png`, `weapon-mountain-maul-v1.png`, `weapon-silver-guard-v1.png`, `weapon-ember-axe-v1.png`, `weapon-tide-blade-v1.png`, `weapon-erosion-knife-v1.png`, `weapon-thorn-spear-v1.png`, `weapon-soul-spear-v1.png`, `weapon-wood-bow-v1.png`, `weapon-ash-bow-v1.png`, `weapon-eagle-bow-v1.png`, `defense-wood-shield-v1.png`) plus six single-cell item sprites (`item-health-potion-v1.png`, `item-iron-powder-v1.png`, `item-energy-potion-v1.png`, `item-cleanse-v1.png`, `item-rage-wine-v1.png`, `item-teleport-v1.png`). Every file has been alpha-checked after its final crop; irregular shapes preserve transparent cells, while full 2x2 bells and mauls preserve all four cells. The HUD maps all thirty-one reviewed ids, including the six relic sprites, inside the rotated shape container, hides fallback labels and cell fills for mapped sprites, and keeps distinct cool dark fills for unmapped item types and attributes. Sprite URLs use literal Vite-analyzable `new URL(..., import.meta.url)` expressions so production builds copy only the small and medium runtime files; original high-resolution sources are kept under `src/assets/inventory/backup/source/`. Sprite pixels are non-interactive so only occupied cells handle selection and long press for starter and non-rectangular weapons. `scripts/generate-sprite-resolutions.py` and `npm run sprites:variants` regenerate 256px/512px max-edge small and medium variants from the archived sources.

Thin vertical sprites can use the generator's targeted `--trim-transparent --alpha-threshold` path to remove faint stray-alpha margins while retaining the raw input in `backup/source/uncropped/`. The thorn spear uses threshold `8`, so its 1x4 art fills the allocated footprint instead of reading as a thin line.

The relic sprite set now covers all six 1x1 relic ids: `relic-three-v1.png`, `relic-empty-v1.png`, `relic-reverse-v1.png`, `relic-traveler-v1.png`, `relic-blood-v1.png`, and `relic-scales-v1.png`. Each source is an alpha-transparent inventory sprite and uses the staged small/medium loading path. The four externally supplied relic sources were normalized to RGBA PNG, archived under `src/assets/inventory/backup/source/`, and resized from 1254px square to 512px medium and 256px small variants without changing their transparent background.

The backpack surface uses a deep ink-black cool charcoal field (`#1b2426` to `#0b1012`) with blue-green seams and a restrained gray-green edge. It deliberately avoids yellow-brown and parchment tones so the sprite palette can use oxidized blue-green, restrained cinnabar, indigo, and bone-gray accents without blending into the background. Weapon attribute colors are carried by the occupied-shape outline even when a sprite is present: scorch uses muted cinnabar red, wither uses dried ochre, and drown uses oxidized teal. Sprite items also keep a faint matching attribute tint behind the transparent artwork, so the color cue remains visible without competing with the image; relics use a restrained translucent purple tint. The same mapped item sprites are used on revealed Three.js floor cards: the text canvas is replaced by the transparent image after it loads, fitted to 0.7 of the tile size and centered close to the ground. The underlying card face uses the shared empty-ground texture. Revealed floor weapons add a per-entity polar `ShaderMaterial` plane between that floor and sprite, using the shared attribute definition color and additive alpha; stable item/position seeds vary the opacity/scale breathing phase and the irregular starburst edge phase. The plane is non-raycast, does not replace either texture, and is disposed with the ground entity. The sprite center is calculated from the empty-ground surface plus half its height, then lowered by `height / 2 * (1 - cos(45 degrees))`, compensating for the lift caused by the 45-degree pitch so its lower edge remains grounded. The image is pitched 45 degrees around its horizontal midline and rotates around the tile center on the heading axis at 1.5 times the prior angular speed. Each sprite has its own angular speed and starts its spin at that tile's reveal completion, so item rotations do not lock to a shared animation clock. This shape-aware outline remains correct for rotated L/T weapons without repainting the generated artwork. The HUD suppresses the browser context menu inside the backpack so long-press inspection of sprite weapons remains an in-game interaction. Detail open/close events update only the detail overlay; they do not call the full HUD render or replace backpack DOM nodes, preventing unrelated sprites from restarting their progressive image load and flashing.

While a bag gesture is active, every new secondary-finger `touchstart` rotates the held item another 90 degrees clockwise. The corresponding `touchend` is observed in the capture phase before component-level stopped touch handlers, clearing that secondary identifier so repeated taps remain distinct rotations in both skins.

Defense items are excluded from both the fixed and random room-floor loot pools. They remain available from ordinary merchant stock and supply-room rewards; selected natural enemies resolve their existing material-drop chance into one material or one matching defense, never two entities on the same death tile. `drop.itemIds` represents that uniform choice and keeps the original drop chance unchanged.

The runtime sprite map now covers every catalog item: 18 weapons, 8 defenses, 6 consumables, 6 materials, and 6 relics. The newly added defense and material sources are archived as high-resolution PNGs under `src/assets/inventory/backup/source/`; only their generated `-small` and `-medium` variants are shipped and loaded progressively. Their source canvases follow the actual footprint, including 1x3 vertical shields/armor, 1x2 materials, and 2x2 or L-shaped defenses.

Ground gold remains a room entity rather than an inventory item. Its exact floor amount (currently 3 through 7) resolves through the separate `goldSpriteSources(amount)` map to `gold-pile-<amount>-v1-small.png` and `-medium.png`. Revealed piles use the same floor-texture base, 0.7-tile pitched sprite treatment, and independent reveal-based spin as other mapped ground objects. The five high-resolution sources are archived in `src/assets/inventory/backup/source/`; no original gold PNG is referenced at runtime.

The floor-weapon glow plane spans 0.9 tile widths and has a peak opacity of `0.28`. Its fragment shader combines an exponential center gradient with three procedural ray layers: 9 slow rays, 13 reverse-rotating rays, and 17 quicker inner rays. `glowTime` advances every frame, while the stable per-entity phase keeps separate weapons from sharing the same silhouette. Each layer uses a high-power angular cosine and an independently tapered radial reach, producing thin drifting star rays rather than a filled multi-point polygon. A separate seeded sine varies opacity from 45% to 100% of the reduced peak; the former whole-plane scale pulse is removed.

## UI framework boundary

The runtime HUD is mounted by Vue 3 (`src/ui/VueHud.vue`) with keyed reactive inventory placements, a `BackpackGrid.vue` component, and `InventorySprite.vue` for staged image loading. The game model remains the source of truth and emits `change`/`detail` events; Vue invalidates the relevant view without rebuilding unrelated DOM nodes. The default `GameScene` renderer receives the same `#app` container. The root route loads its game modules independently of the wiki and animation tool routes.

## ESLint

The repository uses ESLint flat configuration in `eslint.config.js`. `npm.cmd run lint` checks JavaScript, Vue single-file components, current Node checks, and the log server. Browser and Node globals are scoped separately, and unused variables are errors; intentionally unused bindings must use an underscore prefix. Formatting-only Vue rules that conflict with the existing compact templates are disabled, while structural, undefined-variable, duplicate-key, and duplicate-attribute checks remain enabled. The lint command completes with zero errors and zero warnings.

```powershell
npm.cmd run lint
npm.cmd run check:rules
npm.cmd run check:turns
npm.cmd run check:traps
npm.cmd run check:items
npm.cmd run check:enemies
npm.cmd run check:talents
npm.cmd run build
```

- `check:rules` 覆盖背包、寻路、翻牌、门、奖励、商人、圣遗物和战斗。
- `check:turns` 覆盖两层回合计数、逐格移动和武器体力费用。
- `check:traps` 覆盖四种陷阱、体力扣除、毒雾和到期清理。
- `check:items` 覆盖新版物品、背包操作计费、攻击范围计算、合成、行为序列与攻击中途读档结算。
- `check:enemies` 覆盖敌人数据、生成池及敌人特性。
- `check:talents` 覆盖 20个通用天赋节点、前置关系及其效果。
- `build` 确认生产构建可完成。

## Vue state invalidation

`GameRun` remains an event-driven plain JavaScript model. Vue computed views must therefore depend on the shared `revision` tick exposed by `state`; they must not cache direct reads of mutable run fields. The HUD increments that tick for every `change` event, while detail overlays use a separate `detail` tick. This keeps rewards, level-up choices, merchants, backpack placements, action buttons, and status text current without replacing the Three.js canvas or unrelated sprite nodes.

Level-up talent options render a dedicated `talent-choice-head` flex row so the name and route badge share one line with opposite alignment. The fixed-growth separator keeps only its divider and the `level-up-fixed-choice` button; the redundant label node was removed. `FIXED_GROWTH.name` and every player-facing label use `强健体魄` consistently.

The detail overlay is always mounted, while Vue `detailPanelVisible` controls its `v-show` visibility. Detail events only replace its contents, so the panel does not need to be recreated when an item is inspected.

`upgradeRecipesForItem()` is the shared forward-route query and selects every `RECIPES` entry whose `a` id matches the inspected equipment. `VueHud.vue` projects each route into three existing small sprite URLs and renders it below the detail card's main two-column grid; the route container spans both columns. Each frameless icon owns an explicit square width, height, min/max size, paint-containment boundary, and clipped overflow. Its image is absolutely inset into that box with `object-fit: contain`, zero intrinsic minimum size, and matching max dimensions, so an asset cannot enlarge or escape the visual slot. Icons remain pointer-transparent, have empty alternative text, and carry no detail data attributes or touch handlers. Multiple matching recipes render as separate keyed rows.

Long-press hit testing is attached directly to every Vue-rendered detail target: inventory occupied cells, craft ingredients, merchant stock, and merchant relic offers. Touch movement beyond 18 pixels cancels the 300 ms timer. Irregular inventory items receive touch events only through their occupied cells; void cells and the transparent sprite image do not participate in hit testing. The active gesture token uses `shallowRef` so the timer compares the raw hold object by identity; a deep Vue ref would proxy it and incorrectly mark every timer as stale. The HUD root does not install delegated click or long-press listeners.

The inventory no longer installs a document-level pointer fallback. Each item owns its touch lifecycle, while the normal tap click remains responsible for selection and movement.

The UI also mirrors the model action gates: discard/use are explore-only, rotation and crafting follow backpack-organization rules, and the browser context menu is suppressed across the complete backpack surface for long-press inspection.

The Vue HUD now binds backpack cell and occupied-shape clicks directly with propagation guards; sprite pixels are non-interactive so transparent areas cannot swallow inventory selection or long-press gestures. Restart actions call a single reset routine that clears the save and closes transient Vue panels. The build-status panel title is sourced from `LABELS.buildStatus`, not the talent graph label.

Initial relic choice buttons invoke `chooseInitialRelic` directly from the Vue button and stop propagation. This keeps the opening choice responsive even when HUD layers use pointer-event isolation.

## Event-to-Vue synchronization

The model emits one shared `change` event after every persistent gameplay mutation. The HUD subscribes before the Three.js scene is constructed and advances a dedicated Vue revision tick. The `state` computed returns a fresh forwarding view for each tick (with methods/getters bound to the real `GameRun`), avoiding Vue 3 computed-stability issues when the underlying model keeps the same object identity. The event emitter snapshots listeners and isolates exceptions, so a failed scene rebuild is logged without blocking inventory, reward, relic-choice, merchant, or restart updates. This is required because the model can already be persisted even when a renderer update fails.

Long-press detail is visible while the hold is active and closes on touch release; release also suppresses the following synthetic click. The item container receives `touchstart`, `touchmove`, `touchend`, and `touchcancel` directly, and the detail visibility is controlled by `detailPanelVisible`. Inventory sprite images are non-draggable so browser image dragging cannot cancel the gesture. The HUD bottom band, backpack panel, wrapper, and grid explicitly participate in hit testing; the grid is above the Three.js canvas with its own stacking level.

## Shadow-puppet animation tools

`src/animation/shadow-rig.js` owns the version-2 serializable rig. Its three structural collections are deliberately separate: `joints` contains independent transform points, `bones` contains directed `fromJointId -> toJointId` links, and `parts` contains rendered geometry. A joint may remain disconnected; each child joint has at most one incoming bone. A part attachment is `free`, `joint`, or `bone`; bone attachments store the normalized line position `t` and whether the part follows bone rotation. Forward-kinematic world matrices are evaluated from the joint graph, while bound parts receive a separate attachment matrix. Reparenting or deleting a bone converts affected rest transforms so visible world positions are preserved.

Animation tracks address `joint:<id>` or `part:<id>` targets and store position offsets, rotation, scale, and opacity. The fixed animation slots remain `idle`, `attack`, `hit`, `death`, and `move`, with editable duration and loop mode. `ShadowPuppetStage.vue` is the shared SVG renderer: guide grid, bones, parts, and joints are separate layers, and joints render last. The editor's Grid checkbox passes the same visibility state to `showGrid` and `showParts`; disabling it therefore leaves only joints and bone links, while the preview keeps parts visible independently. `/animeedit` keeps the stage mounted while switching its lower context tools among Skeleton, Parts, and Animation; `/animepreview` reads and plays the active project without editing controls. Neither route initializes or modifies Three.js.

The version-2 roster uses fresh `project-v2` and `roster-v2` local-storage keys so the removed sample roster cannot repopulate the editor. First load creates one empty character; there are no built-in examples or example controls. Add, rename, duplicate, delete, and switch operations preserve characters independently, and deleting the final entry creates a blank replacement. The character dropdown and four icon actions share the top row with Back and Preview; Rename uses a prompt and Delete requires confirmation. Edits are debounced and saved automatically, with no manual save, import, or export controls. The active project is mirrored to the v2 project key for `/animepreview` and cross-tab updates. The normalizer can still convert an explicitly supplied version-1 project, but old sample storage is not loaded automatically. It also removes the obsolete generated `·皮影` suffix.

Parts currently expose geometry only. Their persisted `visual` object already reserves `type: 'shape' | 'texture'`, `texture`, and `textureFit`, but `/animeedit` intentionally has no texture-mode controls yet.

On portrait phones the editor temporarily marks the root element with `anime-html` so the game shell's fixed, clipped root layout cannot hide tool content. The title block is omitted. Header and mode menu use 8% and 6% of dynamic viewport height; the workspace fills the remaining height. The root page never scrolls. The workspace is a vertical flex container: the SVG stage is always present as `flex: 1 1 0` with `min-height: 0`. All three context panels have the same fixed `171px` height and flex basis, derived from the fully populated Parts panel: a 28px shape row, 5px gap, 29px selector row, 5px gap, three 27px field rows with two 4px gaps, 14px vertical padding, and a 1px bottom border. The mobile 6px padding leaves 2px spare. Switching tabs or selecting a part cannot move the stage/panel boundary. Any content exceeding the fixed height can scroll inside its panel. The Parts selector puts prompt-based Rename, Duplicate, and Delete icon buttons in that order; the latter two retain accessible labels. Its fields occupy three compact rows (attachment/target/optional bone position labeled Position; width/height/rotation; layer/fill/stroke). Every Parts label is a fixed 20px wide and sits inline before its control, aligning the controls across rows. The stage uses a flat blue-gray fill. Its optional grid is a dedicated `v-show` layer. Joint circles render in a final SVG group after every part, so part ordering and the grid cannot occlude them.

In Skeleton Select mode, `skeletonStatus` is empty and the status node is not rendered; Add Joint, Connect, and error notices still render normally. A selected joint uses a dedicated three-column property grid: its name spans the first row, and X, Y, and rotation fill the second row, with an 8px top margin and 10px row gap. The more relaxed layout still fits the shared 171px panel, even when an Add Joint or Connect status is visible. When a bone is selected, both its name field and directed joint relationship span the full four-column property grid. The relationship occupies a separate line with `white-space: nowrap` and ellipsis only for names longer than the available panel width.

The Animation playback row uses five CSS grid columns: 38px Play, 38px Rewind, 86px time readout, `minmax(0, 1fr)` Duration, and 38px Loop. The fixed items stay on one line; only the Duration column absorbs width changes, and its number input flexes within that column. The scrubber has a flexible track plus 44px Record Frame and Delete Frame buttons on its right. Record samples every joint and part track at the current time and upserts a key for each, regardless of selection; Delete removes keys at that time (within the existing 8ms selection tolerance) across all tracks. Playback stops before either edit. Scrubber markers are the sorted union of all active-animation key times; bones have no independent track and follow their joints. The six transform fields are a three-column, two-row grid with inline 39px labels and flexible inputs. The formerly separate selected-target caption is removed from the visual layout; the canvas still highlights the target and the field group retains its accessible name. Tabs (29px), playback (27px plus 6px gap), scrubber (27px plus 5px gap), and two 27px field rows (4px gap, 2px top margin) total 154px before panel padding/border, fitting within 171px without internal scrolling. A Reset button at the end of the animation-type row clears only the active animation's `tracks`, stops playback, and sets the timeline to zero. It confirms before deleting nonempty tracks; duration, loop mode, rest rig, and other animations are untouched. Empty tracks simply reset playback/time without a confirmation.

The animation scrubber removes native range margins/borders and defines a 16px thumb for WebKit and Firefox. The visible progress track and frame markers share the same travel interval, inset 8px from each end of the input (half the thumb size), with progress color and marker positions calculated from `time / duration`. The range's native track is transparent; the shared inset track is rendered behind it. This aligns marker centers and progress color with the thumb center at matching timestamps, including the endpoints.

The editor stage keeps view center and zoom as transient component state. Its reactive SVG viewBox supports single pointer panning over blank canvas and two pointer pinch scaling from 0.4 to 6 times the base view. Pinch updates the center to keep the same world point under the moving midpoint. Target drags continue editing joint or part coordinates; a second pointer cancels that drag and starts a pinch. A blank canvas tap is emitted on pointer release only if travel stayed within six screen pixels and no pinch occurred. The background hit area follows the viewBox, so panning still works after the original stage bounds move off screen. Camera gestures do not change the saved rig.

## Device and input contract

## Inventory drag state machine

The fixed south-boundary front layer uses the transparent pass with depth testing and writing disabled, then renders after temporary flip planes. This makes the wall mask those planes even on their first flip frame. An enemy flip creates only its transparent figure face over a temporary copy of that grid cell's floor texture: it has neither a card-back plane nor a textured card body.

## Sequential combat motion

`_pickUp` and `_attack` call `_walk` with `deferFinalTurn`. They keep only the final arrival together with collection or the player's hit; every earlier path cell still closes a normal movement turn and can be interrupted. Pickup removes or acquires the target before its one action turn advances, while an attack resolves the player hit before its attack turn advances.

For an attack reached by movement, the deferred final step retains its normal one-point energy recovery immediately before weapon cost is paid. A stationary attack has no final step and receives no recovery, so reaching an attack position spends one less net energy than using the same weapon in place.

The south-boundary foreground layer is deliberately rendered in the transparent pass after temporary flip planes, with depth testing disabled, so it masks those planes from the first flip frame. Enemy flip construction omits both the flip-back plane and card-body mesh, and temporarily mounts the normal floor face below the figure. The surviving figure canvas has transparent pixels around the enemy and cannot show wood grain or the scene background.

`GameRun._walk` clears any remaining route after the first enemy attack during a long movement. Enemy movement emits `animate:enemy-move` after the model move, and `GameScene` temporarily interpolates the standing source face before refreshing origin and destination. The shared FIFO queue starts the following attack only when that movement action completes, so chase movement and attack presentation cannot overlap. Reveal batches are expanded into one flip action per card in the same queue instead of being animated concurrently.

`VueHud.vue` binds touch handlers to occupied inventory cells and staged items through `BackpackGrid.vue`. The session keeps source (`backpack` or `stash`), anchor, rotation, active touch id, drag threshold, and preview target. The floating item is centered below the active touch; `inventoryDropAnchorAtCenter` snaps that footprint center to the closest backpack placement center, producing a half-cell drop tolerance while preserving the model's first-occupied-cell anchor. `GameRun.previewInventoryDrop` is the pure placement check. `commitInventoryDrop` performs a move or replacement, stages displaced items, and advances exactly one turn. `moveInventoryToStash` and `discardInventoryItem` also advance one turn for each successful player gesture. Repositioning an item within the free-form staging canvas changes only its UI position; rotation there updates its saved orientation through `setStashedInventoryRotation`, with no turn cost. Staged views use measured backpack cell dimensions, and `automaticStashPosition` scores occupied-cell overlap across candidate canvas positions to prefer an in-bounds zero-overlap location. The staging layer derives its lower inset from the actual toolbar and 8x4 backpack geometry, so its 25/75 discard/stash rows fill every pixel above the backpack. Detail panels use a higher stacking layer than staging and drag previews. Window blur, visibility changes, and `touchcancel` clear the session without mutating the model. No mouse, pointer, keyboard, stylus, or landscape compatibility layer is part of this path. See [04-inventory-interaction.md](./04-inventory-interaction.md) for the player-facing rules.

The supported product target is a portrait mobile phone only. There is no desktop, keyboard, mouse, stylus, or landscape-layout compatibility requirement. HUD long press is implemented with Vue `touchstart`, `touchmove`, `touchend`, and `touchcancel` handlers on the rendered inventory occupied cell; the Three.js board detail hold uses the same 300 ms threshold. Pointer-event compatibility code must not be reintroduced for inventory gestures. Three.js remains responsible for the board renderer and its mobile touch camera interaction.

When the timer completes, the corresponding detail panel is populated and made visible through `detailPanelVisible`. Touch release closes the detail panel; movement or cancellation aborts the pending timer.

## Inventory and choice presentation

The backpack grid no longer paints an outer border or shell shadow; individual cells remain the visual grid. Weapon instances carry a runtime tier: normal weapons are tier I and crafted weapons are tier II, rendered as one or two stars in the detail header. Detail data carries the item id so the reserved icon area can display the mapped medium sprite; the text fallback remains for unmapped entities. Item attributes are exposed as detail badges only for weapons, while ordinary items have no attribute badge.

Weapon/defense detail presentation is data-driven: weapon badges are attribute, `weaponClass`, and star tier, while defenses use the explicit catalog `defenseClass` (`shield` or `armor`) and star tier with no attribute badge. Defense attribute metadata remains available to gameplay effects but is intentionally not a player-facing defense attribute. Detail payloads separate `statLines` from `effectLines`: the three weapon stat chips are `⚔` attack, `🏹` range, and `💪` energy cost, while conditional effects begin on their own row and inactive adjacency conditions are omitted. `lines` remains a flattened compatibility projection for the legacy HUD and checks. After a spring kill, `matchingBuffs` adds the exact line `下一击体力消耗-1` to every eligible weapon detail except the source weapon; no inventory badge or other visual marker is added. Detail artwork uses a 2-cell-wide, at-most-3-cell-high `border-box` frame with explicit maximum dimensions and clipping; the image itself has `object-fit: contain` and matching maximum dimensions, so a 1×4 spear is proportionally bounded instead of stretching or painting beyond the frame. Detail payloads no longer calculate or expose occupied-cell count.

Initial and room relic choices use a full-screen dimmer with borderless card options. Each card is ordered name, sprite when available, then a smaller description. The description occupies the lower card area but begins at its top-left corner for easier scanning. Level-up choices keep their existing presentation and are not covered by the relic-choice skin rules.

Both skins store their active gesture token in a `shallowRef` to preserve timer identity. Click actions are bound directly to their buttons/cards through `handleAction`; neither HUD root has click or long-press delegation.

## Scene status tray

`VueHud.vue` derives `statusEntries` from the event-invalidated `GameRun` view. Poison and burning contribute explicit remaining-turn entries. Other entries come only from active non-relic `player.itemState.buffs`, covering temporary consumable, combat, and talent effects such as rage wine; relic counters, persistent equipment/talent conditions, defensive counters, and spatial build checks do not enter the tray. `status-icons.js` maps poison, burning, rage wine, generic attack gain, and energy discount to alpha-transparent 256 px small assets; mixed attack/discount buffs prioritize the attack icon while the badge and long-press detail preserve the actual effect. The matching 512 px variants remain available and high-resolution sources stay under `src/assets/status/backup/source/`, but the 28 px tray loads only the small files. A tray entry owns its touch lifecycle and starts the shared 300 ms hold timer; it uses the existing `GameRun` detail event and `detailPanelVisible`, then closes on release. The tray is a canvas-container overlay anchored to the lower-left of the Three.js scene, flowing from left to right and therefore aligning with the actual scene bounds rather than an estimated HUD height.

## Backpack effect feedback

`ItemRules` owns both effect-readiness projections. `adjacencyEffectApplies()` is the shared accessory-target predicate used by the actual combat/armor checks and by `activeAdjacencyLinks()`, so the HUD cannot light an adjacency that gameplay would reject. `adjacentItems()` and every link are calculated from `BackpackGrid.cellsForPlacement()` rather than rectangular bounds, preserving correct L/T-shape behavior. The Vue layer only selects one real shared edge per active source-target pair and converts its midpoint to grid percentages.

The backpack renders those links in one pointer-transparent absolute overlay. Each stable keyed link is a short horizontal or vertical CSS band with two alpha-gradient animation layers at different periods. Links disappear while a drag session is active and reappear from the new model placement afterward; item components and progressive sprite nodes are not replaced. `prefers-reduced-motion` keeps the green connection visible but stops its movement.

`ItemRules.relicEffectActive()` is the single readiness query for backpack relics. It evaluates three attributes for `r-three`, at least eight empty cells for `r-empty`, a preceding movement for the beneficial `r-traveler` discount, no more than half health for `r-blood`, and exactly one weapon for `r-scales`; triggerless or unknown relic definitions default to active. Any existing relic-overload gate takes precedence. Vue adds only `relic-active` or `relic-inactive` classes to the existing keyed item node, with the inactive class applying grayscale, lower brightness, and lower opacity.

## Teleport talisman

`TELEPORT_RANGE` is 6 and is shared by target validation and player-facing selection/rejection messages. The catalog description is synchronized with that value. The active `teleport` sprite mapping points to `item-teleport-talisman-v2-small.png` and `item-teleport-talisman-v2-medium.png`, generated from the alpha-transparent paper-talisman source in `src/assets/inventory/backup/source/`. The former pendant files remain intact as the V1 source and runtime variants for later reuse.

## Fixed room boundary behavior

`GameScene` no longer contains a nearest-player-wall-side helper or any player-position-based boundary hiding. Boundary walls are rebuilt only when revealed doors change, and every non-door wall segment remains fixed throughout player movement. The south side omits only its interior pillars by the permanent boundary-pillar rule; its corner pillars and every wall segment remain present.

## Movement footprints

The scene keeps a one-entry footprint press set separate from hover lift. Each queued one-cell `animate:move` landing adds a downward card/body offset; the next landing releases the prior tile, so every crossed path tile visibly depresses for one following movement turn. The final footprint is released by the next change that advances `globalTurn`, while room changes clear all footprint state. The south boundary receives a fixed front render layer above the nearest tile row, with depth testing disabled only for that camera-facing boundary; a footprint's temporary Y offset therefore cannot change its wall occlusion. This remains renderer-only and does not alter pathfinding or turn resolution.

## Attack animation queue

Combat emits `animate:attack` events from `GameRun` after a player hit is resolved and when an enemy attack begins. Each event carries the room id, actor (`player` or `enemy`), and grid position. Ambush attacks are emitted after their reveal batch so a hidden enemy is never animated before its card flip.

`GameScene` places movement, flip, and attack events in one FIFO animation queue. Attack routes emit one move event per cell, so an enemy action that becomes valid at an intermediate landing is queued between that landing and the following player step. Only one attack animation can be active at a time, and the queue remains a rebuild barrier until the animation completes. The temporary attack duration is 0.5 seconds. The player pose raises both arms and briefly brings the feet together; the enemy pose lifts the circular head and sways the triangular body twice before settling. `GameRun` holds a player attack turn at a combat-resolution barrier: after the player animation, the current room is refreshed to show the complete player-hit result (health, death, displacement, and related effects), then `animate:attack-complete` advances the turn and begins the enemy phase. The renderer restores the original texture and transform after each action, so combat state and hit resolution remain unchanged. Attack pose canvases are redrawn from an identity 2D transform on every frame; the temporary redraw scale is applied exactly once, preventing the character texture from growing and being cropped to one corner.
