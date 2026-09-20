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

The reviewed sprite set currently includes nineteen weapon/defense sprites plus six single-cell item sprites: rust sword, bone knife, ember spear, root axe, rock maul, bell maul, wall sword, return axe, mountain maul, silver guard, ember axe, tide blade, erosion knife, thorn spear, soul spear, wood bow, ash bow, eagle bow, wooden ward shield, health potion, iron powder, energy potion, cleanse, rage wine, and teleport. The HUD uses these sprites without labels or procedural cell fills when their item ids are present; weapon attributes remain readable through the occupied-shape outline: muted red for scorch, dried ochre for wither, and oxidized teal for drown. Other items retain distinct cool dark fills by type, while the wiki's balance cards remain driven by the item catalog. Each mapped sprite loads a small preview first and upgrades to medium and high resolution after decoding, so opening or moving the backpack does not immediately fetch the largest PNG. Detail open/close events update only the overlay and preserve existing backpack nodes, so long-pressing one item does not flash other equipment. Browser context menus are disabled within the backpack so long-press inspection does not leave the game UI.

The first relic sprite batch adds Three-Phase Wheel (`r-three`) and Empty Casket Seal (`r-empty`). Both occupy one backpack cell and use transparent staged sprites; the remaining relics are queued for the next generation batch. Relic cells use a faint translucent purple backing behind their sprites, while weapon cells retain a low-opacity tint matching scorch, wither, or drown in addition to the colored outline.

The game HUD is mounted with Vue 3 while Three.js remains the board renderer. Vue owns the reactive panels, keyed backpack placements, detail overlay, and staged sprite component; `GameScene` still owns the canvas, camera, card meshes, walls, and animation loop. This boundary keeps UI updates from replacing the Three canvas or unrelated inventory images.

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
