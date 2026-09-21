# 图鉴页面

## 入口与用途

图鉴路由为 `/wiki`，用于浏览当前运行时的敌人、陷阱、武器、圣遗物、天赋和物品。标签页使用 URL 哈希保存当前分类：

`/wiki` 是独立的规则与内容参考页面，不是游戏内的圣遗物持有栏；主游戏界面已移除单独的圣遗物图鉴入口，持有的圣遗物直接显示在 4×8 背包中。

- `/wiki#enemies`
- `/wiki#traps`
- `/wiki#weapons`
- `/wiki#relics`
- `/wiki#talents`
- `/wiki#items`

## 数据来源

Enemy health shown by `/wiki` uses the same `ENEMY_HP_MULTIPLIER` as runtime spawning, so balance multipliers remain visible in the reference cards.

The wiki records that backpack sprites use alpha-transparent canvases sized by each item's occupied shape. The backpack surface is a cool ink-black charcoal gradient rather than the earlier yellow-brown paper field. Room card grids use the reduced per-floor dimensions (6x6, 7x7, 8x8, 8x8, 9x9), and gameplay balance values remain data-driven rather than painted into the artwork.

The reviewed sprite set currently includes nineteen weapon/defense sprites plus six single-cell item sprites and six single-cell relic sprites. The HUD uses these sprites without labels or procedural cell fills when their item ids are present; weapon attributes remain readable through the occupied-shape outline: muted red for scorch, dried ochre for wither, and oxidized teal for drown. Other items retain distinct cool dark fills by type, while relic cells use a faint purple tint. Each mapped sprite loads a small preview first and upgrades only to the medium runtime file after decoding; original high-resolution sources stay in the inventory backup folder. Detail open/close events update only the overlay and preserve existing backpack nodes, so long-pressing one item does not flash other equipment. Browser context menus are disabled within the backpack so long-press inspection does not leave the game UI.

Defense cards in `/wiki` identify their exclusive acquisition channels: enemy drops, ordinary merchant stock, and supply-room rewards. Defenses are excluded from every fixed or random room-floor loot placement; enemy cards show a material/defense pair when their unchanged drop chance chooses uniformly between those alternatives.

The wiki now reflects complete sprite coverage: 18 weapons, 8 defenses, 6 consumables, 6 materials, and 6 relics. Each mapped item uses a transparent footprint-aware source with only small and medium runtime variants; vertical and irregular defenses keep their occupied-shape proportions.

The relic sprite set now covers all six relic ids: Three-Phase Wheel (`r-three`), Empty Casket Seal (`r-empty`), Reverse Stone (`r-reverse`), Traveler Bone Domino (`r-traveler`), Blood Pact Bronze Mirror (`r-blood`), and Broken-Blade Scales (`r-scales`). Every relic occupies one backpack cell and uses a transparent staged sprite. Relic cells use a faint translucent purple backing behind their sprites, while weapon cells retain a low-opacity tint matching scorch, wither, or drown in addition to the colored outline. When a mapped weapon or item is revealed on the Three.js board, the same transparent sprite is fitted to 0.7 of the tile size, centered close to the ground over the shared empty-ground texture, lowered by the calculated 45-degree pitch lift, and slowly heading-rotated with an independent reveal-based start and speed.

The game HUD is mounted with Vue 3 while Three.js remains the board renderer. Vue owns the reactive panels, keyed backpack placements, detail overlay, and staged sprite component; `GameScene` still owns the canvas, camera, card meshes, walls, and animation loop. This boundary keeps UI updates from replacing the Three canvas or unrelated inventory images.

Wall pillar tops use a smaller capital-and-cap profile, and the initial room framing starts slightly farther away for a less crowded view.

Enemy cards show a doubled-size, lightly outlined name label above the health bar. It shares the health bar's status-group orientation and uses a matching wide texture, so its text remains readable rather than being vertically compressed; it is visual-only and does not intercept board touches.

The health bar is raised slightly toward the name label while the label keeps its existing height, reducing the gap without crowding the enemy head.

Overlapping board visuals follow grid rows rather than camera depth: the more southern row is rendered on top of northern rows, with card, status, and item-sprite sublayers kept in order within each row.

The project lint policy is defined in `eslint.config.js` and runs with `npm.cmd run lint`. It checks Vue templates and all JavaScript/Node tooling, including the smoke test and log server. Undefined names, duplicate keys or attributes, empty exception handlers, and unused variables fail the command; intentionally unused bindings use an underscore prefix. The current lint baseline is clean.

| 标签页 | 数据来源 |
| --- | --- |
| 敌人 | `src/game/data/catalog.json` 的 `enemies` 与 `boss` |
| 陷阱 | `src/game/data/traps.js` 的 `TRAP_DEFS` |
| 武器 | `catalog.json` 的 `weapons`、武器类 `enemyLoot` 与 `merchantWeapons` |
| 圣遗物 | `src/game/data/relics.js` 的 `RELIC_DEFS`，当前 30 件 |
| 天赋 | `src/game/data/progression.js` 的 `TALENT_DEFS`，当前 50 个节点 |
| 物品 | `catalog.json` 的 `consumables` 与非武器 `enemyLoot` |

图鉴卡片直接读取这些静态定义，不再混入未实装提案卡。武器图鉴额外展示按类别计算的体力消耗：匕首 2、剑 3、斧／长柄／弓 4、重武器 5；不展示已删除的耐久、最后一击或武器损毁信息。陷阱图鉴显示腐蚀陷阱的体力扣除和毒雾的全局回合效果。

天赋卡片使用中文分支标签和节点位置，不直接展示内部 line ID。游戏内长按详情和图鉴使用同一套对象名称与效果描述；任何提案或历史设计应放在 `docs` 的历史文档中，不进入图鉴运行时数据。

## Vue HUD interaction notes

## Inventory staging notes

The production and white-line skins share the same 300 ms hold, 18 px movement tolerance, shape-anchor placement, green/yellow/red drop preview, free-form staging canvas, discard zone, and multi-touch clockwise rotation. A floating item snaps by its visual footprint center to the nearest backpack footprint center, allowing a half-cell alignment tolerance rather than anchoring the touch to the item's upper-left cell. The staging layer ends at the real top edge of the 8x4 backpack: its discard row fills the upper 25 percent and its stash row fills the remaining 75 percent of that whole available region. Staged items retain the exact backpack-cell scale and rotation proportion; automatic arrivals search for a zero-overlap occupied-cell position, falling back to the least-overlap candidate only when needed. The detail panel is deliberately stacked above those two zones for inspection during cleanup. Staged items are serialized with the run, remain visible while the canvas is non-empty, and are resolved before scene interaction resumes. The `/wiki` reference should describe these controls as touch-only and should not document the removed discard or rotate toolbar buttons.

The game HUD is mounted by Vue 3 while the board remains Three.js. Because `GameRun` is intentionally a plain event-driven model, all mutable HUD projections subscribe through the shared revision tick. This keeps initial relic selection, room rewards, level-up choices, merchant stock, backpack movement, action visibility, and status panels synchronized after each model change.

Long-press detail uses a separate detail update and preserves keyed inventory sprite nodes. The complete backpack grid suppresses the browser context menu, so inspecting a textured item does not open native browser actions or flash unrelated equipment.

Backpack interaction is bound directly to each cell and sprite hit target, so selecting, moving, rotating, and clearing items remains available after Vue updates. Restart clears the saved run and transient panels together. The active-effect panel is labeled as build status, while the talent graph keeps its own title.

The three opening relic choices are handled directly by their Vue buttons, so the first selection is not lost to HUD event delegation or overlay propagation.

Model changes now reach the Vue HUD independently of Three.js: the HUD revision listener is registered first, each revision receives a fresh forwarding view of the plain model, and event listeners are exception-isolated. Picking up an item or selecting an opening relic therefore updates the backpack and overlays immediately, even if a board rebuild reports an error; a page refresh is no longer needed to reveal the saved state.

The item detail overlay remains mounted and Vue `detailPanelVisible` controls its `v-show` visibility; a `detail` event only replaces the panel contents.

The gesture resolver is attached directly to each Vue-rendered detail target: inventory occupied cells, craft ingredients, merchant stock, and merchant relic offers. Touch drift beyond 18 pixels cancels the 300 ms long-press timer. Irregular inventory void cells and sprite images are excluded from touch hit testing. Its active gesture token is stored in a `shallowRef`, preserving raw-object identity for the timer's stale-hold check. The HUD root keeps no delegated long-press listener.

The inventory uses item-level touch handlers instead of a document-level pointer fallback.

Long-pressing a backpack item shows its detail panel while the hold is active; releasing the touch closes the panel and prevents the follow-up click from selecting or moving the item. The item container owns the touch lifecycle. The backpack layer is explicitly above the Three.js canvas and participates in hit testing through every container level.

## White-line debug route

Open `/whiteline` to run the same game rules and interactions with a diagnostic presentation skin. The layout remains the production layout: the top HUD, Three.js board, camera gestures, doors, card flips, bottom toolbar, and 8 x 4 backpack are unchanged. The route uses black-and-white wireframes and English text labels only; it does not display sprite images, board art, decorative icons, or emoji. `GameRun` remains the single source of truth, so actions and save behavior are identical between `/` and `/`. The debug skin also binds click and long-press handlers directly to concrete controls instead of using a root event delegate. Door confirmation retains the path-preview interaction and accepts the door or its arrival marker; door entry waits for movement and queued ambush reveals to finish without leaving the transition state stuck.

The supported interaction target is portrait mobile touch only. Inventory long press is bound directly to each occupied Vue-rendered cell with `touchstart`, `touchmove`, `touchend`, and `touchcancel`; the Three.js board detail hold uses the same 300 ms threshold. Desktop mouse, keyboard, stylus, and landscape layouts are outside the product contract.

After 300 ms, the corresponding detail panel is populated and shown through `detailPanelVisible`; releasing the touch closes it, while movement or cancellation aborts the pending timer.

## Scene status tray

The main HUD no longer has a separate build-status text row. The experience strip sits directly below the top HUD, and the released space belongs to the Three.js board. Active statuses render inside the board's lower-left edge, flowing from left to right, as compact first-character cells with a badge for remaining turns, an active counter, or a relic threshold. Holding a cell uses the existing 300 ms detail gesture and releasing closes the detail overlay. The wiki header records this interaction alongside the current content reference.

Current tray categories are poison, burning, and active temporary attack/weapon buffs such as rage wine. Relic counters, persistent equipment/talent conditions, defensive counters, and weapon adjacency or empty-space construction checks remain in the relevant details and are intentionally excluded from the compact tray.

## Teleport talisman

The wiki item definition for the teleport talisman now states its Manhattan-distance-6 revealed-empty-cell target rule. The game maps it to a transparent paper-talisman sprite with an ink teleport seal and cyan portal marks; the previous pendant sprite is retained as an unused V1 asset for a future item.

## Fixed south wall

Room boundary walls do not respond to the player's nearby position. The south wall remains visible as the player enters or leaves its adjacent tiles; only the fixed interior-pillar omission is used to preserve sightlines, while both corner pillars stay in place.

## Movement footprints

All crossed movement tiles now depress on arrival. A footprint remains pressed through the following movement turn before lifting, and the final landing tile lifts when a later action advances the global turn. The camera-facing south boundary has a fixed layer above the southernmost tile row, so a pressed tile never jumps in front of the wall merely because its surface moved downward. This is visual feedback only and does not change movement range, route cost, or combat rules.

The backpack has no outer frame; only its cells and item outlines remain visible. Weapon tiers use Roman numerals in the detail panel only (I for ordinary weapons, II for crafted weapons). The detail panel uses its icon slot for the matching item sprite when one exists, and ordinary items do not show weapon attribute badges. Relic selection is a borderless, full-screen dimmed overlay whose cards read from top to bottom as name, image, and compact description; the lower description area is top-left aligned.

## Combat animation

Player and enemy attacks use a short 0.5-second presentation animation. The player raises both arms and briefly narrows the stance; an enemy lifts its round head and sways its triangular body twice. Attack events share the Three.js FIFO queue with movement and card flips, so attacks in one turn play one after another instead of simultaneously. After a player animation finishes, the struck enemy's saved post-hit health status is applied before any queued enemy attack begins. The animation is visual-only and does not change damage, turn order, or enemy rules. The temporary pose texture is redrawn from a reset canvas transform, preserving the normal character size throughout the animation instead of accumulating scale and showing only a cropped corner.
