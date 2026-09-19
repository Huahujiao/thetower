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

The reviewed sprite set currently includes sixteen weapon/defense sprites plus six single-cell item sprites: rust sword, bone knife, ember spear, root axe, rock maul, bell maul, wall sword, return axe, mountain maul, silver guard, ember axe, tide blade, thorn spear, wood bow, ash bow, wooden ward shield, health potion, iron powder, energy potion, cleanse, rage wine, and teleport. The HUD uses these sprites without labels or procedural cell fills when their item ids are present; weapon attributes remain readable through the occupied-shape outline: muted red for scorch, dried ochre for wither, and oxidized teal for drown. Other items retain distinct cool dark fills by type, while the wiki's balance cards remain driven by the item catalog. Each mapped sprite loads a small preview first and upgrades to medium and high resolution after decoding, so opening or moving the backpack does not immediately fetch the largest PNG. Detail open/close events update only the overlay and preserve existing backpack nodes, so long-pressing one item does not flash other equipment. Browser context menus are disabled within the backpack so long-press inspection does not leave the game UI.

The game HUD is mounted with Vue 3 while Three.js remains the board renderer. Vue owns the reactive panels, keyed backpack placements, detail overlay, and staged sprite component; `GameScene` still owns the canvas, camera, card meshes, walls, and animation loop. This boundary keeps UI updates from replacing the Three canvas or unrelated inventory images.

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
