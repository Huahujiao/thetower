# 技术结构与验证

## 入口与路由

- `src/main.js` 是应用唯一入口。
- `/` 创建游戏运行、HUD 和 Three.js 场景。
- `/wiki` 创建独立图鉴页面，不初始化游戏场景。
- Vite 开发服务器首选 3000 端口；端口被占用时自动选择可用端口。

## 模块边界

```text
src/
├─ game/
│  ├─ core/       事件、坐标、三层回合计数与基础工具
│  ├─ data/       敌人、物品、商人、奖励、陷阱、圣遗物的静态定义
│  ├─ model/      地牢、房间、背包、圣遗物收藏状态
│  ├─ rules/      寻路、战斗修正、敌人、地形与圣遗物规则
│  └─ run.js      一局游戏的状态机、动作与持久化
├─ render/        Three.js 卡牌场景、相机与交互
├─ ui/            游戏 HUD 与 Wiki 页面
├─ styles.css     游戏页面样式
└─ wiki.css       图鉴页面样式
```

静态内容在 `src/game/data/catalog.json`、`talents.js`、`progression.js`、`relics.js`、`merchants.js` 与 `traps.js` 中维护。游戏运行时从这些定义生成敌人、武器、物品、商人、房间奖励、天赋、陷阱与圣遗物效果。文档中以 [敌人清单](./敌人.md)、[物品清单](./物品清单.md) 和 [圣遗物清单](./圣遗物清单.md) 分别镜像对象数据，避免在规则页重复维护具体对象。

## 存档

游戏在状态变化后自动持久化当前局面，包括地牢、已翻开卡牌、背包位置与旋转、装备、角色成长、圣遗物、商人货架、奖励袋、三层回合计数、中毒与燃烧状态、敌人自身行动计数、已触发陷阱的延迟移除状态和结算状态。已触发陷阱实体记录 `triggered`、`triggeredAtGlobalTurn` 与 `removeAfterGlobalTurn`，由全局回合推进统一清理。三层计数由 `src/game/core/turns.js` 的 `TurnLedger` 管理，存档同时保留兼容字段 `turn` 作为全局回合。存档格式由 `GameRun` 的版本号控制；新增计数字段采用可选读取，旧存档会保留原全局回合并从零开始累计新的行动／攻击计数。

当前存档版本为 18。读取到非当前版本或结构无效的存档时，立即删除该存档并创建新局；版本号为 18 但缺少 `turnCounters` 的旧存档会以原 `turn` 作为全局回合，并从零开始累计新的行动／攻击计数。以后大更新若改变存档结构，直接递增版本号即可。

## 验证要求

每次修改规则、界面或数据后运行：

```powershell
npm.cmd run lint
npm.cmd run check:rules
npm.cmd run check:traps
npm.cmd run check:items
npm.cmd run check:enemies
npm.cmd run build
```

- `lint` 检查 JavaScript 语法与代码规范。
- `check:rules` 覆盖背包、寻路、翻牌顺序、门、奖励、商人、陷阱、圣遗物与战斗等关键规则。
- `check:traps` 覆盖陷阱定义、武器腐蚀、武器损毁和毒雾全局回合结算。
- `check:items` 覆盖消耗品和磨刀石使用后的行动／全局回合推进。
- `check:enemies` 覆盖全部扩充敌人的静态数值、自然生成池、燃烧／疾行／牵引／召唤／死亡孳生特性和生成物限制。
- `build` 确认生产构建可完成。

视觉验收不作为日常自动检查的一部分；本项目的交付前基础验证以以上命令为准。
