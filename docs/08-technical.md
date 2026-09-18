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

`GameRun` 维护地牢、玩家生命／护甲／体力、4×8 背包、角色成长、圣遗物、商人、奖励、状态效果、敌人状态和日志。圣遗物以 `type: 'relic'` 的 1×1 背包物品保存；`RelicCollection` 是由背包物品同步出的效果索引。普通探索操作回复1体力；消耗品、整理与合成不自动回复。攻击推进攻击计数和全局回合，实际费用包含物品与天赋修正且最低1。接近路径中的每格移动也是独立的非攻击回合。

回合计数只有 `attackCount` 和 `globalTurn`；`turn` 是全局回合的兼容别名。背包整理与合成成功推进1回合；丢弃、奖励/升级选择与购买/出售不推进计数。运行时不存在左右手、装备栏、行动计数、武器耐久、磨刀石、最后一击、武器损毁或拦截机制。圣遗物无数量超载限制。`ItemRules` 统一处理新版武器、防具、材料、圣遗物与天赋的交叉效果。

## 存档

状态变化后自动保存到 `localStorage`。存档包括地牢、已翻开卡牌、背包位置与旋转、玩家成长和资源、背包中的圣遗物物品、商人货架、奖励袋、`attackCount`／`globalTurn`、中毒与燃烧、敌人自身行动计数、已触发陷阱的延迟移除状态、日志和结算状态。没有装备栏或武器耐久字段。

当前存档版本为 **24**。版本号不匹配、结构无效或玩家位置无效时会删除存档并创建新局；存档同时保留 `turn` 作为全局回合兼容字段。旧的独立圣遗物收藏存档不迁移。

## 验证要求

规则、数据或界面变更后运行：

## Renderer stability

The Three.js scene keeps tile meshes separate from room structure. Revealing a door now rebuilds only walls, doors, and explored-room outlines; card faces retain an explicit depth clearance above their bodies to prevent depth flicker. Unflippable cards share a dedicated charcoal-gray card-back texture, independent of hidden attributes.

The room structure key also tracks the wall nearest the player. Pillars are omitted from that one wall to preserve the board view, and a change of nearest wall rebuilds only the wall/door structure, never the card meshes.

## Enemy baseline

Runtime enemy health is `catalog.json` health multiplied by `ENEMY_HP_MULTIPLIER` (currently `2`). This applies to natural enemies, spawned minions, and the boss; `/wiki` uses the same multiplier. The `heavy-armor` trait reduces every received damage instance by 1 after any shield limit, including damage otherwise marked as ignoring defense. Save version 24 deliberately starts a fresh run so persisted enemies cannot retain the former health values.

## Inventory sprite workflow

Inventory artwork is produced per concrete item and its `shape`, not as a generic square class icon. The final PNG canvas uses 512 pixels per occupied grid cell and keeps every unoccupied area transparent; for example, the 1x2 `rust-sword` sprite is 512x1024. Source drafts with unsuitable proportions are retained under `src/assets/inventory/backup/`. Art direction is restrained Chinese cosmic horror: aged-paper grain and ink texture belong within the object while its background remains alpha-transparent. Avoid European-medieval construction, low-poly rendering, and saturated ukiyo-e palettes.

Readability at backpack scale takes precedence over prop detail: narrow vertical weapons need a broad primary silhouette and a chunky guard or grip rather than tassels, fine engraving, or large transparent side margins.

The current reviewed set is `weapon-rust-sword-v2.png` (1x2), `weapon-bone-knife-v1.png` (1x1), `weapon-ember-spear-v1.png` (1x3), `weapon-root-axe-v1.png` (2x2 L footprint), `weapon-mountain-maul-v1.png` (3x3 cross footprint), and `defense-wood-shield-v1.png` (1x2). Every file has been alpha-checked after its final crop; the L-shaped axe deliberately preserves its top-right grid cell as transparent, while the maul preserves all four corner cells. The HUD now maps these item ids to sprites inside the rotated shape container, hides fallback labels and cell fills for mapped sprites, and keeps distinct cool dark fills for unmapped item types and attributes.

The backpack surface uses a deep ink-black cool charcoal field (`#1b2426` to `#0b1012`) with blue-green seams and a restrained gray-green edge. It deliberately avoids yellow-brown and parchment tones so the sprite palette can use oxidized blue-green, restrained cinnabar, indigo, and bone-gray accents without blending into the background.

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
