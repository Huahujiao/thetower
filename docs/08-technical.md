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
│  ├─ model/      地牢、房间、5×8 背包、圣遗物收藏状态
│  ├─ rules/      寻路、伤害、敌人、地形与圣遗物规则
│  └─ run.js      一局游戏的状态机、动作和持久化
├─ render/        Three.js 卡牌场景、相机与交互
├─ ui/            游戏 HUD 与 Wiki 页面
├─ styles.css     游戏页面样式
└─ wiki.css       图鉴页面样式
```

静态内容的主要来源是 `src/game/data/catalog.json`、`talents.js`、`progression.js`、`relics.js`、`merchants.js` 和 `traps.js`。`src/ui/wiki.js` 直接读取这些定义；对象数量和数值应以运行时数据为准。

## 当前运行状态

`GameRun` 维护地牢、玩家生命／护甲／体力、5×8 背包、角色成长、圣遗物、商人、奖励、状态效果、敌人状态和日志。玩家每移动一格推进 1 个全局回合并回复 1 点体力；攻击推进攻击计数和全局回合并消耗 2–5 点体力；使用物品推进全局回合并回复 1 点体力。

回合计数只有 `attackCount` 和 `globalTurn`；`turn` 是全局回合的兼容别名。背包整理、丢弃、奖励选择、升级选择和商人面板操作不推进计数。运行时不存在左右手、装备栏、行动计数、武器耐久、磨刀石、最后一击、武器损毁或拦截机制。

## 存档

状态变化后自动保存到 `localStorage`。存档包括地牢、已翻开卡牌、背包位置与旋转、玩家成长和资源、圣遗物、商人货架、奖励袋、`attackCount`／`globalTurn`、中毒与燃烧、敌人自身行动计数、已触发陷阱的延迟移除状态、日志和结算状态。没有装备栏或武器耐久字段。

当前存档版本为 **20**。版本号不匹配、结构无效或玩家位置无效时会删除存档并创建新局；存档同时保留 `turn` 作为全局回合兼容字段。

## 验证要求

规则、数据或界面变更后运行：

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
- `check:items` 覆盖消耗品使用后的体力与全局回合推进。
- `check:enemies` 覆盖敌人数据、生成池及敌人特性。
- `check:talents` 覆盖 50 个天赋节点及其体力相关效果。
- `build` 确认生产构建可完成。
