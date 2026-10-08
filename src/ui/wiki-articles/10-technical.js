export default `# 技术结构、存档与验证

## 入口和模块边界

\`src/main.js\` 按路由加载应用：\`/\` 创建 \`GameRun\`、Vue HUD 和 Three.js 场景；\`/wiki\` 为文档目录，\`/wiki/:id\` 为独立子页面；\`/animeedit\` 与 \`/animepreview\` 加载动画工具。Vite 负责开发与生产构建。

| 路径 | 职责 |
| --- | --- |
| \`src/game/core/\` | 事件、坐标、回合计数及背包操作提交 |
| \`src/game/data/\` | 敌人、物品、陷阱、圣遗物、升级奖励与商人静态定义 |
| \`src/game/model/\` | 地牢、房间、背包和圣遗物持有状态 |
| \`src/game/rules/\` | 寻路、射程、伤害、敌人、物品及圣遗物规则 |
| \`src/game/run.js\` | 一局游戏的状态、操作、动画结算屏障与持久化 |
| \`src/render/\` | Three.js 棋盘、相机、瞄准星与敌人骨骼渲染 |
| \`src/animation/\` | 敌人部件骨架、关键帧、贴图与地面接触 |
| \`src/ui/\` | Vue HUD、背包组件、详情与图鉴 |

规则数值以运行时为准。\`catalog.json\`、\`progression.js\`、\`relics.js\`、\`merchants.js\` 和 \`traps.js\` 是当前内容定义；敌人生命直接存储为实际数值，\`src/game/data/enemies.js\` 的 \`ENEMY_HP_MULTIPLIER\` 为 1，章节和房间只决定生成种类、数量与组合，不改变同种敌人的数值。

物品效果在\`items.js\`按各自条件结算，没有固定套装激活名单；\`backpack-geometry.js\`计算四向相邻，\`synergies.js\`处理邻接判断与奖励推荐，标签只影响候选排序。普通商人价格与刷新费用由\`GameRun.merchantPrice()\`和\`merchantRestockPrice()\`统一计算。待用效果保存在\`player.itemState\`。物品源图位于\`src/assets/inventory/backup/source/\`，small与medium由资源脚本导出。

## 模型、视图和动画

\`GameRun\` 是普通 JavaScript 状态模型，通过事件通知 Vue HUD 与 Three.js 场景。Vue 负责响应式面板、稳定键值的背包物品和详情；Three.js 负责棋盘网格、相机、世界对象及每帧持续渲染。容器变化由 \`ResizeObserver\` 和窗口 resize 处理。背包手势由 \`src/game/core/inventory-actions.js\` 提交：一次成功玩家操作在战斗中最多消耗1体力，探索免费，替换导致的自动暂存不另计；暂存画布内移动和旋转仅改显示与朝向。

移动、翻牌、攻击、爆炸与受击共用场景FIFO动画队列。攻击与受击同时播放，死亡或专属爆炸在受击后播放；升级和胜败面板等待动画结束。敌人关键帧由\`src/animation/\`与\`src/render/enemy-puppet.js\`读取，\`character-motion.js\`提供动作进度与整体位移。相机操作只改变场景变换，不重置骨骼；待机按渲染帧推进。瞄准覆盖层复用纹理与材质。

## 存档

状态变化后自动写入浏览器本地存储。当前存档版本36，不迁移旧存档。球池由 src/game/model/stamina-deck.js 管理，保存唯一球ID、抽球堆顺序、手中球、弃球堆、选择球及本回合供球数；球总数与ID必须一致。武器本回合实例使用记录保存在 player.itemState，用于执一印减费。未完成攻击读档只补记操作；已经结算的敌人阶段读档开始下一回合，不重复宠物、伤害或抽球。

## 状态接口

统一逻辑在 \`src/game/rules/statuses.js\`。角色状态保存在 \`actor.statuses\`，下一击增益保存在 \`player.itemState.buffs\`，两者使用相同计数结构和全局时钟。中毒、格挡等便捷访问器不参与序列化，不单独计时，也不读取或迁移旧存档字段。

- \`run.applyStatus(actor, id, options)\` 获取状态，\`options.layers\` 和 \`options.turns\` 可独立指定；省略时各为100，明确标注的状态默认值除外。
- \`run.updateStatus(actor, id, changes)\` 原位修改伤害或其他参数，保留未指定的层数和持续时间。\`run.removeStatus(actor, id)\` 移除状态。
- 固定反击：\`run.applyStatus(run.player, 'counter', { layers: 1, damage: 5 })\`。
- 获取时记录上一击攻击力：\`damage: { mode: 'last-player-attack', stage: 'gain', ratio: 1 }\`。上一击攻击力为基础攻击加固定加成后乘攻击力倍率，未乘地形倍率；获取后保存为数值。
- 每次受击时按比例：\`damage: { mode: 'incoming-attack', stage: 'trigger', ratio: 0.5 }\`。默认按攻击本身的伤害计算；\`basis: 'rawDamage'\` 使用减伤后、护甲前的伤害，\`basis: 'healthDamage'\` 使用实际损失生命。
- 自定义算法使用 \`registerStatusDamageResolver(name, callback)\` 注册，通过 \`damage.mode\` 引用；存档只保存算法名称和参数。触发阶段的上下文含玩家、持有者、攻击者和已结算的伤害结果。
- 闪避：\`run.applyStatus(run.player, 'dodge')\` 默认1层；可显式指定更多层。玩家毒使用 \`player-poison\`，敌人毒使用 \`enemy-poison\`，不能跨持有者类型混用。

## 物品事件与消耗品连锁

新增物品的独立逻辑集中在 \`src/game/rules/expansion.js\`，由攻击前后、受伤前后、敌人移动和公共事件入口触发。累计翻牌、1级消耗品使用、受击次数和续甲胄上次触发点保存在 \`player.itemState.expansion\`；武器实例和属性历史仍共用物品规则中的攻击记录。

武器等级、6种三级合成材料与22条当前配方集中在 \`src/game/data/weapon-progression.js\`。物品定义在装载时按武器ID写入1～3级，2级和3级标记为合成武器，因此普通地面和补给武器池只取1级。配方使用“输入武器+材料+成品”的唯一ID；多个入口产出同一武器时，界面和运行时按配方ID选择，旧的6条目录配方为空且不参与结算。合成先消耗材料，成品放不下时进入暂存区，不继承材料实例的强化。旧存档直接丢弃重开。

宠物定义位于 src/game/data/pets.js，费用使用 ballCost，支付主人剩余体力球。目标无效或球不足时不扣费；按背包顺序依次扣费，食尸鼠击杀按同一事务返还原球。宠物不改写玩家武器历史。食物和供食邻接逻辑已删除。

\`src/game/rules/consumables.js\` 统一处理主动与免费使用。先验证目标和体力，再从背包移除消耗品，执行效果及奖励回调，最后由主流程完成一次玩家操作，玩家手动结束才进入敌人阶段，球耗尽仍等待玩家主动结束回合。连饮环在开始时保存原有邻域物品，避免消耗品奖励重入连锁。盾击符不进入随机池，只由镇岳盾生成；盾击伤害和耗甲按使用时的护甲读取。疫行铃复制毒伤参数与剩余计数，目标状态独立计时。

## 美术资源

图腾定义在 \`src/game/data/totems.js\`，召唤、生命周期和效果集中在 \`src/game/rules/totems.js\`。实体记录召唤回合、战斗生命周期和下次招魂触发回合，战斗结束统一清理；共享冷却与护身图腾的受击回合记录位于 \`player.itemState.totems\`。敌人行为通过障碍检查和攻击图腾回调调用规则，招魂换位通过 \`Room.swapCards\` 同步实体位置和牌面状态。图腾不占用体力上限；不兼容存档直接删除重开。

图腾当前使用程序绘制的立牌占位图，显示各自符号、名称与“战斗结束消失”。召唤瞄准显示紫色有效空格，背包徽章根据场上实体和共享冷却显示灰色状态。

背包和地面物品共用与实际占格形状对应的透明精灵；运行时只加载小／中尺寸版本，原始高分辨率资源保留在 \`src/assets/inventory/backup/source/\`，由 \`scripts/generate-sprite-resolutions.py\` 导出。背包的相邻生效提示由真实占用格计算，Vue 只渲染其公共边短光带。地面武器的属性光芒、物品旋转、移动格下沉及固定房间边墙属于渲染反馈，不改变规则或寻路。

## 验证命令

按改动范围运行相应检查；规则、数据与动画同时修改时可运行全部命令。

\`\`\`powershell
npm.cmd run lint
npm.cmd run check:rules
npm.cmd run check:dungeon
npm.cmd run check:turns
npm.cmd run check:traps
npm.cmd run check:items
npm.cmd run check:statuses
npm.cmd run check:expansion
npm.cmd run check:totems
npm.cmd run check:synergies
npm.cmd run check:enemies
npm.cmd run check:progression
npm.cmd run check:combat-motion
npm.cmd run check:animation
npm.cmd run check:board-pointer
npm.cmd run check:wiki
npm.cmd run build
\`\`\`

根路由只验证游戏本体时，图鉴和动画编辑器的检查可按受影响模块选择。\`eslint.config.js\` 定义 JavaScript、Vue 和 Node 脚本的静态检查规则。
`
