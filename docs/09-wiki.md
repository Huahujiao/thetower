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

The wiki records that backpack sprites use alpha-transparent canvases sized by each item's occupied shape; gameplay balance values remain data-driven rather than painted into the artwork.

The reviewed sprite set currently includes a 1x2 rust sword, 1x1 bone knife, 1x3 ember spear, an L-footprint root axe, and a cross-footprint mountain maul. These are production assets only until the HUD sprite renderer is connected, so the wiki's balance cards remain driven by the item catalog.

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
