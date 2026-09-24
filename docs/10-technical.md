# 技术结构、存档与验证

## 入口和模块边界

`src/main.js` 按路由加载应用：`/` 创建 `GameRun`、Vue HUD 和 Three.js 场景；`/wiki`、`/animeedit` 与 `/animepreview` 分别加载独立工具页面。Vite 负责开发与生产构建。

| 路径 | 职责 |
| --- | --- |
| `src/game/core/` | 事件、坐标、回合计数及背包操作提交 |
| `src/game/data/` | 敌人、物品、陷阱、圣遗物、天赋、奖励与商人静态定义 |
| `src/game/model/` | 地牢、房间、背包和圣遗物持有状态 |
| `src/game/rules/` | 寻路、射程、伤害、敌人、物品及圣遗物规则 |
| `src/game/run.js` | 一局游戏的状态、操作、动画结算屏障与持久化 |
| `src/render/` | Three.js 棋盘、相机、瞄准星和临时角色动作 |
| `src/ui/` | Vue HUD、背包组件、详情与图鉴 |

规则数值以运行时为准。`catalog.json`、`progression.js`、`relics.js`、`merchants.js` 和 `traps.js` 是当前内容定义；`src/game/data/enemies.js` 的 `ENEMY_HP_MULTIPLIER`（当前 2）参与生成生命与图鉴展示。

物品效果在 `items.js` 按各自条件结算，没有固定套装激活名单；`backpack-geometry.js` 计算四向相邻，`synergies.js` 提供导流线和分叉接头的独立邻接判断，以及奖励标签推荐。标签只影响候选排序。毒蚀蓄势在敌人中毒伤害结算后累计。普通商人货品价格与刷新费用分别由 `GameRun.merchantPrice()` 和 `GameRun.merchantRestockPrice()` 计算，付款与界面展示共用这两个方法。待用效果进度写入 `player.itemState`，房间内次数限制写入该房间的物品运行状态。第二批新增物品的 PNG 源图保存在 `src/assets/inventory/backup/source/`，small 与 medium 版本由资源生成脚本导出。

## 模型、视图和动画

`GameRun` 是普通 JavaScript 状态模型，通过事件通知 Vue HUD 与 Three.js 场景。Vue 负责响应式面板、稳定键值的背包物品和详情；Three.js 负责棋盘网格、相机、世界对象及每帧持续渲染。容器变化由 `ResizeObserver` 和窗口 resize 处理。背包手势由 `src/game/core/inventory-actions.js` 提交：一次成功玩家操作最多推进一个全局回合，替换导致的自动暂存不另计；暂存画布内移动和旋转仅改显示与朝向。

移动、翻牌、攻击、爆炸与独立受击事件共用场景 FIFO 动画队列。攻击方和目标受击同时播放；普通死亡在受击后播放，死亡爆炸则在受击后播放专属自爆动作。主动自爆直接使用自爆动作。玩家攻击的回合和敌人阶段在动画结算屏障之后继续，升级、胜利或失败面板等待死亡或爆炸动作结束。当前符号动作曲线位于 `src/render/character-motion.js`，之后可替换视觉资产而不改结算规则。瞄准星覆盖层复用纹理、几何和材质，仅更新实例与呼吸状态。

## 存档

游戏状态变化后自动写入 `localStorage`。存档包含地牢与翻牌、章节房间角色、分支封闭状态、玩家资源和成长、背包位置与旋转、暂存物品、圣遗物、商人货架、奖励、回合计数、状态效果、敌人状态、陷阱延迟移除、日志和结算状态。攻击动画期间还保存待结算回合标记；读档会完成该回合。当前版本为 **27**，版本不匹配或结构无效时创建新局；`turn` 仅作为 `globalTurn` 的兼容字段。读取旧存档时会清除旧版换相指针的三段印记和待用增益，并更新物品描述。工具路由的角色库使用独立的浏览器存储，不属于游戏局存档。

## 美术资源

背包和地面物品共用与实际占格形状对应的透明精灵；运行时只加载小／中尺寸版本，原始高分辨率资源保留在 `src/assets/inventory/backup/source/`，由 `scripts/generate-sprite-resolutions.py` 导出。背包的相邻生效提示由真实占用格计算，Vue 只渲染其公共边短光带。地面武器的属性光芒、物品旋转、移动格下沉及固定房间边墙属于渲染反馈，不改变规则或寻路。

## 验证命令

按改动范围运行相应检查；规则、数据与动画同时修改时可运行全部命令。

```powershell
npm.cmd run lint
npm.cmd run check:rules
npm.cmd run check:dungeon
npm.cmd run check:turns
npm.cmd run check:traps
npm.cmd run check:items
npm.cmd run check:synergies
npm.cmd run check:enemies
npm.cmd run check:talents
npm.cmd run check:combat-motion
npm.cmd run check:animation
npm.cmd run build
```

根路由只验证游戏本体时，图鉴和动画编辑器的检查可按受影响模块选择。`eslint.config.js` 定义 JavaScript、Vue 和 Node 脚本的静态检查规则。
