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

## Enemy baseline

Runtime enemy health is `catalog.json` health multiplied by `ENEMY_HP_MULTIPLIER` (currently `2`). This applies to natural enemies, spawned minions, and the boss; `/wiki` uses the same multiplier. The `heavy-armor` trait reduces every received damage instance by 1 after any shield limit, including damage otherwise marked as ignoring defense. Save version 25 deliberately starts a fresh run so persisted room dimensions and enemy values cannot retain the former layout.

## Inventory sprite workflow

Inventory artwork is produced per concrete item and its `shape`, not as a generic square class icon. The final PNG canvas uses 512 pixels per occupied grid cell and keeps every unoccupied area transparent; for example, the 1x2 `rust-sword` sprite is 512x1024. Source drafts with unsuitable proportions are retained under `src/assets/inventory/backup/`. Art direction is restrained Chinese cosmic horror: aged-paper grain and ink texture belong within the object while its background remains alpha-transparent. Avoid European-medieval construction, low-poly rendering, and saturated ukiyo-e palettes.

Readability at backpack scale takes precedence over prop detail: narrow vertical weapons need a broad primary silhouette and a chunky guard or grip rather than tassels, fine engraving, or large transparent side margins.

The current reviewed set includes nineteen weapon/defense sprites (`weapon-rust-sword-v2.png`, `weapon-bone-knife-v1.png`, `weapon-ember-spear-v1.png`, `weapon-root-axe-v1.png`, `weapon-rock-maul-v1.png`, `weapon-bell-maul-v1.png`, `weapon-wall-sword-v1.png`, `weapon-return-axe-v1.png`, `weapon-mountain-maul-v1.png`, `weapon-silver-guard-v1.png`, `weapon-ember-axe-v1.png`, `weapon-tide-blade-v1.png`, `weapon-erosion-knife-v1.png`, `weapon-thorn-spear-v1.png`, `weapon-soul-spear-v1.png`, `weapon-wood-bow-v1.png`, `weapon-ash-bow-v1.png`, `weapon-eagle-bow-v1.png`, `defense-wood-shield-v1.png`) plus six single-cell item sprites (`item-health-potion-v1.png`, `item-iron-powder-v1.png`, `item-energy-potion-v1.png`, `item-cleanse-v1.png`, `item-rage-wine-v1.png`, `item-teleport-v1.png`). Every file has been alpha-checked after its final crop; irregular shapes preserve transparent cells, while full 2x2 bells and mauls preserve all four cells. The HUD maps all twenty-five reviewed ids inside the rotated shape container, hides fallback labels and cell fills for mapped sprites, and keeps distinct cool dark fills for unmapped item types and attributes. Sprite URLs use literal Vite-analyzable `new URL(..., import.meta.url)` expressions so production builds copy all three resolutions; sprite pixels are non-interactive so only occupied cells handle selection and long press for starter and non-rectangular weapons. `scripts/generate-sprite-resolutions.py` and `npm run sprites:variants` regenerate 256px/512px max-edge small and medium variants from the high-resolution sources.

The first relic sprite batch adds `relic-three-v1.png` (三相轮) and `relic-empty-v1.png` (空匣印). Both are 1x1 transparent inventory sprites and use the same staged small/medium/high loading path. The remaining four relic ids are reserved for the next image-generation batch.

The backpack surface uses a deep ink-black cool charcoal field (`#1b2426` to `#0b1012`) with blue-green seams and a restrained gray-green edge. It deliberately avoids yellow-brown and parchment tones so the sprite palette can use oxidized blue-green, restrained cinnabar, indigo, and bone-gray accents without blending into the background. Weapon attribute colors are carried by the occupied-shape outline even when a sprite is present: scorch uses muted cinnabar red, wither uses dried ochre, and drown uses oxidized teal. Sprite items also keep a faint matching attribute tint behind the transparent artwork, so the color cue remains visible without competing with the image; relics use a restrained translucent purple tint. This shape-aware outline remains correct for rotated L/T weapons without repainting the generated artwork. The HUD suppresses the browser context menu inside the backpack so long-press inspection of sprite weapons remains an in-game interaction. Detail open/close events update only the detail overlay; they do not call the full HUD render or replace backpack DOM nodes, preventing unrelated sprites from restarting their progressive image load and flashing.

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

The supported product target is a portrait mobile phone only. There is no desktop, keyboard, mouse, stylus, or landscape-layout compatibility requirement. HUD long press is implemented with Vue `touchstart`, `touchmove`, `touchend`, and `touchcancel` handlers on the rendered inventory occupied cell; the Three.js board detail hold uses the same 300 ms threshold. Pointer-event compatibility code must not be reintroduced for inventory gestures. Three.js remains responsible for the board renderer and its mobile touch camera interaction.

When the timer completes, the corresponding detail panel is populated and made visible through `detailPanelVisible`. Touch release closes the detail panel; movement or cancellation aborts the pending timer.

Both skins store their active gesture token in a `shallowRef` to preserve timer identity. Click actions are bound directly to their buttons/cards through `handleAction`; neither HUD root has click or long-press delegation.
