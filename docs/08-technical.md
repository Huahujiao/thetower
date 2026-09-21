# 技术结构与验证

## 入口与路由

- `src/main.js` 是应用入口。
- `/` 创建 `GameRun`、HUD 和 Three.js 场景。
- `/wiki` 创建独立图鉴页面，不初始化游戏场景。
- Vite 用于开发和生产构建。

## 模块边界

```text
src/
├─ game/
│  ├─ core/       事件、坐标、几何与两层回合计数
│  ├─ data/       敌人、物品、商人、奖励、陷阱、天赋和圣遗物定义
│  ├─ model/      地牢、房间、4×8 背包、圣遗物持有索引
│  ├─ rules/      寻路、伤害、敌人、地形与圣遗物规则
│  └─ run.js      一局游戏的状态机、动作和持久化
├─ render/        Three.js 卡牌场景、相机与交互
├─ ui/            游戏 HUD 与 Wiki 页面
├─ styles.css     游戏页面样式
└─ wiki.css       图鉴页面样式
```

静态内容的主要来源是 `src/game/data/catalog.json`、`talents.js`、`progression.js`、`relics.js`、`merchants.js` 和 `traps.js`。`src/ui/wiki.js` 直接读取这些定义；对象数量和数值应以运行时数据为准。

## 当前运行状态

Room card grids are now one row and one column smaller per floor: 6x6, 7x7, 8x8, 8x8, and 9x9. The 4x8 backpack remains unchanged.

`GameRun` 维护地牢、玩家生命／护甲／体力、4×8 背包、角色成长、圣遗物、商人、奖励、状态效果、敌人状态和日志。圣遗物以 `type: 'relic'` 的 1×1 背包物品保存；`RelicCollection` 是由背包物品同步出的效果索引。普通探索操作回复1体力；消耗品、整理与合成不自动回复。攻击推进攻击计数和全局回合，实际费用包含物品与天赋修正且最低1。接近路径中的每格移动也是独立的非攻击回合。

回合计数只有 `attackCount` 和 `globalTurn`；`turn` 是全局回合的兼容别名。背包整理与合成成功推进1回合；丢弃、奖励/升级选择与购买/出售不推进计数。运行时不存在左右手、装备栏、行动计数、武器耐久、磨刀石、最后一击、武器损毁或拦截机制。圣遗物无数量超载限制。`ItemRules` 统一处理新版武器、防具、材料、圣遗物与天赋的交叉效果。

## 存档

状态变化后自动保存到 `localStorage`。存档包括地牢、已翻开卡牌、背包位置与旋转、玩家成长和资源、背包中的圣遗物物品、商人货架、奖励袋、`attackCount`／`globalTurn`、中毒与燃烧、敌人自身行动计数、已触发陷阱的延迟移除状态、日志和结算状态。没有装备栏或武器耐久字段。

当前存档版本为 **25**。版本号不匹配、结构无效或玩家位置无效时会删除存档并创建新局；存档同时保留 `turn` 作为全局回合兼容字段。旧的独立圣遗物收藏存档不迁移。

## 验证要求

规则、数据或界面变更后运行：

## Renderer stability

The Three.js scene keeps tile meshes separate from room structure. Revealing a door now rebuilds only walls, doors, and explored-room outlines; card faces retain explicit depth clearance, polygon offset, and non-writing face depth to prevent camera-angle flicker. Unflippable cards share a dedicated charcoal-gray card-back texture, independent of hidden attributes. Door confirmation retains the path-preview interaction and accepts either the door mesh or its arrival marker. Movement completion is emitted only after the movement and any queued ambush flip animations are both idle, so entering through a door cannot leave `roomEntering` stuck.

Pillars are fixed by room geometry: the world-space south wall (`bottom` in the renderer's wall-side naming) has no pillars along its middle, while its two endpoints remain eligible (when not occupied by a door); the other walls use normal spacing. Pillars are no longer dynamically hidden based on camera or player position.

Wall pillar capitals and caps use a reduced top profile so their heads do not dominate the wall silhouette. The initial Three.js framing is slightly farther out while preserving the existing camera controls and room-centered composition.

Enemy standing-card overlays now render the enemy name as a doubled-size small label directly above the health bar. The label is a non-raycast child of the same status group and shares the health bar's orientation. Its wide, short canvas texture matches the label geometry, preventing the text from being vertically compressed into a line, and its restrained one-pixel outline preserves readability without a heavy edge; it does not alter board hit testing or movement interactions.

The health-bar and name-label vertical anchors are independent: the health bar sits slightly higher above the enemy head while the name stays in place, tightening their visual spacing without moving the label.

Grid visual layers use a row-based render order: larger row indices are farther south and render later, so southern cards, status overlays, and item sprites cover northern ones. A small per-tile layer offset preserves the intended order between the card, status UI, and sprite within one row; standing overlays disable depth testing so this rule remains stable during camera rotation.

## Enemy baseline

Runtime enemy health is `catalog.json` health multiplied by `ENEMY_HP_MULTIPLIER` (currently `2`). This applies to natural enemies, spawned minions, and the boss; `/wiki` uses the same multiplier. The `heavy-armor` trait reduces every received damage instance by 1 after any shield limit, including damage otherwise marked as ignoring defense. Save version 25 deliberately starts a fresh run so persisted room dimensions and enemy values cannot retain the former layout.

## Inventory sprite workflow

Inventory artwork is produced per concrete item and its `shape`, not as a generic square class icon. The final PNG canvas uses 512 pixels per occupied grid cell and keeps every unoccupied area transparent; for example, the 1x2 `rust-sword` sprite is 512x1024. Source drafts with unsuitable proportions are retained under `src/assets/inventory/backup/`. Art direction is restrained Chinese cosmic horror: aged-paper grain and ink texture belong within the object while its background remains alpha-transparent. Avoid European-medieval construction, low-poly rendering, and saturated ukiyo-e palettes.

Readability at backpack scale takes precedence over prop detail: narrow vertical weapons need a broad primary silhouette and a chunky guard or grip rather than tassels, fine engraving, or large transparent side margins.

The current reviewed set includes nineteen weapon/defense sprites (`weapon-rust-sword-v2.png`, `weapon-bone-knife-v1.png`, `weapon-ember-spear-v1.png`, `weapon-root-axe-v1.png`, `weapon-rock-maul-v1.png`, `weapon-bell-maul-v1.png`, `weapon-wall-sword-v1.png`, `weapon-return-axe-v1.png`, `weapon-mountain-maul-v1.png`, `weapon-silver-guard-v1.png`, `weapon-ember-axe-v1.png`, `weapon-tide-blade-v1.png`, `weapon-erosion-knife-v1.png`, `weapon-thorn-spear-v1.png`, `weapon-soul-spear-v1.png`, `weapon-wood-bow-v1.png`, `weapon-ash-bow-v1.png`, `weapon-eagle-bow-v1.png`, `defense-wood-shield-v1.png`) plus six single-cell item sprites (`item-health-potion-v1.png`, `item-iron-powder-v1.png`, `item-energy-potion-v1.png`, `item-cleanse-v1.png`, `item-rage-wine-v1.png`, `item-teleport-v1.png`). Every file has been alpha-checked after its final crop; irregular shapes preserve transparent cells, while full 2x2 bells and mauls preserve all four cells. The HUD maps all thirty-one reviewed ids, including the six relic sprites, inside the rotated shape container, hides fallback labels and cell fills for mapped sprites, and keeps distinct cool dark fills for unmapped item types and attributes. Sprite URLs use literal Vite-analyzable `new URL(..., import.meta.url)` expressions so production builds copy only the small and medium runtime files; original high-resolution sources are kept under `src/assets/inventory/backup/source/`. Sprite pixels are non-interactive so only occupied cells handle selection and long press for starter and non-rectangular weapons. `scripts/generate-sprite-resolutions.py` and `npm run sprites:variants` regenerate 256px/512px max-edge small and medium variants from the archived sources.

The relic sprite set now covers all six 1x1 relic ids: `relic-three-v1.png`, `relic-empty-v1.png`, `relic-reverse-v1.png`, `relic-traveler-v1.png`, `relic-blood-v1.png`, and `relic-scales-v1.png`. Each source is an alpha-transparent inventory sprite and uses the staged small/medium loading path. The four externally supplied relic sources were normalized to RGBA PNG, archived under `src/assets/inventory/backup/source/`, and resized from 1254px square to 512px medium and 256px small variants without changing their transparent background.

The backpack surface uses a deep ink-black cool charcoal field (`#1b2426` to `#0b1012`) with blue-green seams and a restrained gray-green edge. It deliberately avoids yellow-brown and parchment tones so the sprite palette can use oxidized blue-green, restrained cinnabar, indigo, and bone-gray accents without blending into the background. Weapon attribute colors are carried by the occupied-shape outline even when a sprite is present: scorch uses muted cinnabar red, wither uses dried ochre, and drown uses oxidized teal. Sprite items also keep a faint matching attribute tint behind the transparent artwork, so the color cue remains visible without competing with the image; relics use a restrained translucent purple tint. The same mapped item sprites are used on revealed Three.js floor cards: the text canvas is replaced by the transparent image after it loads, fitted to 0.7 of the tile size and centered close to the ground. The underlying card face uses the shared empty-ground texture. The sprite center is calculated from the empty-ground surface plus half its height, then lowered by `height / 2 * (1 - cos(45 degrees))`, compensating for the lift caused by the 45-degree pitch so its lower edge remains grounded. The image is pitched 45 degrees around its horizontal midline and slowly rotates around the tile center on the heading axis. Each sprite has its own angular speed and starts its spin at that tile's reveal completion, so item rotations do not lock to a shared animation clock. This shape-aware outline remains correct for rotated L/T weapons without repainting the generated artwork. The HUD suppresses the browser context menu inside the backpack so long-press inspection of sprite weapons remains an in-game interaction. Detail open/close events update only the detail overlay; they do not call the full HUD render or replace backpack DOM nodes, preventing unrelated sprites from restarting their progressive image load and flashing.

Defense items are excluded from both the fixed and random room-floor loot pools. They remain available from ordinary merchant stock and supply-room rewards; selected natural enemies resolve their existing material-drop chance into one material or one matching defense, never two entities on the same death tile. `drop.itemIds` represents that uniform choice and keeps the original drop chance unchanged.

The runtime sprite map now covers every catalog item: 18 weapons, 8 defenses, 6 consumables, 6 materials, and 6 relics. The newly added defense and material sources are archived as high-resolution PNGs under `src/assets/inventory/backup/source/`; only their generated `-small` and `-medium` variants are shipped and loaded progressively. Their source canvases follow the actual footprint, including 1x3 vertical shields/armor, 1x2 materials, and 2x2 or L-shaped defenses.

## UI framework boundary

The runtime HUD is now mounted by Vue 3 (`src/ui/VueHud.vue`) with keyed reactive inventory placements and a small `InventorySprite.vue` component for staged image loading. The game model remains the source of truth and emits `change`/`detail` events; Vue invalidates the relevant view without rebuilding unrelated DOM nodes. The default `GameScene` renderer receives the same `#app` container; its optional `whiteline` skin swaps only Three.js materials and labels while preserving the scene interaction contract. The old `src/ui/hud.js` file is retained only as a compatibility surface for existing logic checks while the runtime entry point uses Vue.

## ESLint

The repository uses ESLint flat configuration in `eslint.config.js`. `npm.cmd run lint` checks JavaScript, Vue single-file components, Node scripts, the smoke test, and the log server. Browser and Node globals are scoped separately, and unused variables are errors; intentionally unused bindings must use an underscore prefix. Formatting-only Vue rules that conflict with the existing compact templates are disabled, while structural, undefined-variable, duplicate-key, and duplicate-attribute checks remain enabled. The lint command completes with zero errors and zero warnings.

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
- `check:items` 覆盖新版武器、防具、材料、圣遗物、消耗品、合成事务、行为序列、存档与面板交互契约。
- `check:enemies` 覆盖敌人数据、生成池及敌人特性。
- `check:talents` 覆盖 20个通用天赋节点、前置关系及其效果。
- `build` 确认生产构建可完成。

## Vue state invalidation

`GameRun` remains an event-driven plain JavaScript model. Vue computed views must therefore depend on the shared `revision` tick exposed by `state`; they must not cache direct reads of mutable run fields. The HUD increments that tick for every `change` event, while detail overlays use a separate `detail` tick. This keeps rewards, level-up choices, merchants, backpack placements, action buttons, and status text current without replacing the Three.js canvas or unrelated sprite nodes.

The detail overlay is always mounted, while Vue `detailPanelVisible` controls its `v-show` visibility. Detail events only replace its contents, so the panel does not need to be recreated when an item is inspected.

Long-press hit testing is attached directly to every Vue-rendered detail target: inventory occupied cells, craft ingredients, merchant stock, and merchant relic offers. Touch movement beyond 18 pixels cancels the 300 ms timer. Irregular inventory items receive touch events only through their occupied cells; void cells and the transparent sprite image do not participate in hit testing. The active gesture token uses `shallowRef` so the timer compares the raw hold object by identity; a deep Vue ref would proxy it and incorrectly mark every timer as stale. The HUD root does not install delegated click or long-press listeners.

The inventory no longer installs a document-level pointer fallback. Each item owns its touch lifecycle, while the normal tap click remains responsible for selection and movement.

The UI also mirrors the model action gates: discard/use are explore-only, rotation and crafting follow backpack-organization rules, and the browser context menu is suppressed across the complete backpack surface for long-press inspection.

The Vue HUD now binds backpack cell and occupied-shape clicks directly with propagation guards; sprite pixels are non-interactive so transparent areas cannot swallow inventory selection or long-press gestures. Restart actions call a single reset routine that clears the save and closes transient Vue panels. The build-status panel title is sourced from `LABELS.buildStatus`, not the talent graph label.

Initial relic choice buttons invoke `chooseInitialRelic` directly from the Vue button and stop propagation. This keeps the opening choice responsive even when HUD layers use pointer-event isolation.

## Event-to-Vue synchronization

The model emits one shared `change` event after every persistent gameplay mutation. The HUD subscribes before the Three.js scene is constructed and advances a dedicated Vue revision tick. The `state` computed returns a fresh forwarding view for each tick (with methods/getters bound to the real `GameRun`), avoiding Vue 3 computed-stability issues when the underlying model keeps the same object identity. The event emitter snapshots listeners and isolates exceptions, so a failed scene rebuild is logged without blocking inventory, reward, relic-choice, merchant, or restart updates. This is required because the model can already be persisted even when a renderer update fails.

Long-press detail is visible while the hold is active and closes on touch release; release also suppresses the following synthetic click. The item container receives `touchstart`, `touchmove`, `touchend`, and `touchcancel` directly, and the detail visibility is controlled by `detailPanelVisible`. Inventory sprite images are non-draggable so browser image dragging cannot cancel the gesture. The HUD bottom band, backpack panel, wrapper, and grid explicitly participate in hit testing; the grid is above the Three.js canvas with its own stacking level.

## White-line debug skin

`/whiteline` mounts `WhiteLineHud.vue` with the same `GameRun` instance, event subscriptions, action methods, Three.js canvas container, camera interaction, board geometry, backpack dimensions, and modal flow as `/`. It is a presentation skin only. `GameScene` accepts `{ skin: 'whiteline' }`; this mode keeps Three.js raycasting, movement previews, flips, doors, walls, and animations, but replaces board textures and structural materials with monochrome wireframes and English canvas labels. It does not instantiate `BoardTextures` and does not load board images. Both Vue skins bind click and long-press handlers on the concrete target elements; neither HUD root delegates them. The normal `/` skin is unchanged.

## Device and input contract

## Inventory drag state machine

`VueHud.vue` and `WhiteLineHud.vue` bind touch handlers directly to occupied inventory cells and staged items. The session keeps source (`backpack` or `stash`), anchor, rotation, active touch id, drag threshold, and preview target. The floating item is centered below the active touch; `inventoryDropAnchorAtCenter` snaps that footprint center to the closest backpack placement center, producing a half-cell drop tolerance while preserving the model's first-occupied-cell anchor. `GameRun.previewInventoryDrop` is the pure placement check; `applyInventoryDrop` performs the atomic move and returns conflicts. Conflicting placements are staged before the single `inventoryChanged` notification. Staged views use measured backpack cell dimensions, and `automaticStashPosition` scores occupied-cell overlap across candidate canvas positions to prefer an in-bounds zero-overlap location. The staging layer derives its lower inset from the actual toolbar and 8x4 backpack geometry, so its 25/75 discard/stash rows fill every pixel above the backpack. Detail panels use a higher stacking layer than staging and drag previews. A staging session advances `organize` only when the staging list becomes empty. Window blur, visibility changes, and `touchcancel` clear the session without mutating the model. No mouse, pointer, keyboard, stylus, or landscape compatibility layer is part of this path. See [04-inventory-interaction.md](./04-inventory-interaction.md) for the player-facing rules.

The supported product target is a portrait mobile phone only. There is no desktop, keyboard, mouse, stylus, or landscape-layout compatibility requirement. HUD long press is implemented with Vue `touchstart`, `touchmove`, `touchend`, and `touchcancel` handlers on the rendered inventory occupied cell; the Three.js board detail hold uses the same 300 ms threshold. Pointer-event compatibility code must not be reintroduced for inventory gestures. Three.js remains responsible for the board renderer and its mobile touch camera interaction.

When the timer completes, the corresponding detail panel is populated and made visible through `detailPanelVisible`. Touch release closes the detail panel; movement or cancellation aborts the pending timer.

## Inventory and choice presentation

The backpack grid no longer paints an outer border or shell shadow; individual cells remain the visual grid. Weapon instances carry a runtime tier: normal weapons are tier I and crafted weapons are tier II, rendered with Roman numerals in the detail panel only. Detail data carries the item id so the reserved icon area can display the mapped medium sprite; the text fallback remains for unmapped entities. Item attributes are exposed as detail badges only for weapons, while ordinary items have no attribute badge.

Initial and room relic choices use a full-screen dimmer with borderless card options. Each card is ordered name, sprite when available, then a smaller description. The description occupies the lower card area but begins at its top-left corner for easier scanning. Level-up choices keep their existing presentation and are not covered by the relic-choice skin rules.

Both skins store their active gesture token in a `shallowRef` to preserve timer identity. Click actions are bound directly to their buttons/cards through `handleAction`; neither HUD root has click or long-press delegation.

## Scene status tray

`VueHud.vue` derives `statusEntries` from the event-invalidated `GameRun` view. Poison and burning contribute explicit remaining-turn entries. Other entries come only from active non-relic `player.itemState.buffs`, covering temporary consumable, combat, and talent effects such as rage wine; relic counters, persistent equipment/talent conditions, defensive counters, and spatial build checks do not enter the tray. A tray entry owns its touch lifecycle and starts the shared 300 ms hold timer; it uses the existing `GameRun` detail event and `detailPanelVisible`, then closes on release. The tray is a canvas-container overlay anchored to the lower-left of the Three.js scene, flowing from left to right and therefore aligning with the actual scene bounds rather than an estimated HUD height.

The white-line skin derives the same entry count and gesture behavior, but renders English letter cells and generic English status detail copy. This preserves the `/whiteline` presentation-only contract without loading visual icon assets.

## Teleport talisman

`TELEPORT_RANGE` is 6 and is shared by target validation and player-facing selection/rejection messages. The catalog description is synchronized with that value. The active `teleport` sprite mapping points to `item-teleport-talisman-v2-small.png` and `item-teleport-talisman-v2-medium.png`, generated from the alpha-transparent paper-talisman source in `src/assets/inventory/backup/source/`. The former pendant files remain intact as the V1 source and runtime variants for later reuse.

## Fixed room boundary behavior

`GameScene` no longer contains a nearest-player-wall-side helper or any player-position-based boundary hiding. Boundary walls are rebuilt only when revealed doors change, and every non-door wall segment remains fixed throughout player movement. The south side omits only its interior pillars by the permanent boundary-pillar rule; its corner pillars and every wall segment remain present.

## Movement footprints

The scene keeps a one-entry footprint press set separate from hover lift. Each queued one-cell `animate:move` landing adds a downward card/body offset; the next landing releases the prior tile, so every crossed path tile visibly depresses for one following movement turn. The final footprint is released by the next change that advances `globalTurn`, while room changes clear all footprint state. The south boundary receives a fixed front render layer above the nearest tile row, with depth testing disabled only for that camera-facing boundary; a footprint's temporary Y offset therefore cannot change its wall occlusion. This remains renderer-only and does not alter pathfinding or turn resolution.

## Attack animation queue

Combat emits `animate:attack` events from `GameRun` after a player hit is resolved and when an enemy attack begins. Each event carries the room id, actor (`player` or `enemy`), and grid position. Ambush attacks are emitted after their reveal batch so a hidden enemy is never animated before its card flip.

`GameScene` places movement, flip, and attack events in one FIFO animation queue. Attack routes emit one move event per cell, so an enemy action that becomes valid at an intermediate landing is queued between that landing and the following player step. Only one attack animation can be active at a time, and the queue remains a rebuild barrier until the animation completes. The temporary attack duration is 0.5 seconds. The player pose raises both arms and briefly brings the feet together; the enemy pose lifts the circular head and sways the triangular body twice before settling. `GameRun` holds a player attack turn at a combat-resolution barrier: after the player animation, the current room is refreshed to show the complete player-hit result (health, death, displacement, and related effects), then `animate:attack-complete` advances the turn and begins the enemy phase. The renderer restores the original texture and transform after each action, so combat state and hit resolution remain unchanged. Attack pose canvases are redrawn from an identity 2D transform on every frame; the temporary redraw scale is applied exactly once, preventing the character texture from growing and being cropped to one corner.
