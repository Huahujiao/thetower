# 图鉴页面

## 入口与用途

图鉴路由为 `/wiki`，用于浏览当前运行时代的敌人、武器、圣遗物、天赋和物品。标签页使用 URL 哈希保存当前分类：

- `/wiki#enemies`
- `/wiki#weapons`
- `/wiki#relics`
- `/wiki#talents`
- `/wiki#items`

## 数据来源

| 标签页 | 数据来源 |
| --- | --- |
| 敌人 | `src/game/data/catalog.json` 的 enemies 与 boss |
| 武器 | `catalog.json` 的 weapons、enemyLoot 武器与 merchantWeapons |
| 圣遗物 | `src/game/data/relics.js`，当前 35 件 |
| 天赋 | `src/game/data/talents.js`，当前 50 个节点 |
| 物品 | `catalog.json` 的 consumables 与非武器 enemyLoot |

图鉴卡片直接读取这些静态定义；当前未实装内容不再以提案卡混入运行时代对象清单。游戏内长按详情与图鉴使用同一套对象名称和效果描述。
