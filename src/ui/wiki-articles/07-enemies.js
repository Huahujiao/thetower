import catalog from '../../game/data/catalog.json' with { type: 'json' }
import { ENEMY_HP_MULTIPLIER, CHAPTER_ENCOUNTERS } from '../../game/data/enemies.js'
import { getItemDefinition } from '../../game/data/content.js'
import { attributeLabel } from '../../game/data/attributes.js'
import { enemyFeatureLabel } from '../../game/data/enemy-features.js'
import { TRAP_DEFS } from '../../game/data/traps.js'
import { enemyDistribution, itemRows } from '../wiki-data.js'

const dropText = enemy => enemy.drop ? `${Math.round(enemy.drop.chance * 100)}% ${(enemy.drop.itemIds || [enemy.drop.itemId]).map(id => getItemDefinition(id)?.name || id).join('／')}` : '无'
const enemyRows = enemies => itemRows(enemies, enemy => [enemy.name, enemyDistribution(enemy), attributeLabel(enemy.attribute), enemy.hp * ENEMY_HP_MULTIPLIER, enemy.attack, enemy.range, enemy.speed, enemy.initialActionDelay, enemyFeatureLabel(enemy) || '—', dropText(enemy)])

export default `# 敌人、行为与陷阱

表格直接读取当前定义与生成池。同一种敌人的生命、攻击、射程、速度与特性固定，难度只通过种类、数量及组合变化。

## 分布

新局两章六层，保留四档生成池：1档第1层，2档第2～3层，3档第4层，4档第5～6层。第一档入口只用常规池，其他入口和补给房加入1名挑战敌人，精英房加入3名，首领房杂兵只用常规池。第一档精英配置为2名挑战敌人，供旧地图使用。前两档最多1名伏击敌人，后两档最多2名；警报敌人上限分别为2、3、4、4。

| 档位 | 常规池 | 挑战池 |
| --- | --- | --- |
${itemRows(CHAPTER_ENCOUNTERS, pool => [CHAPTER_ENCOUNTERS.indexOf(pool) + 1, pool.standard.map(id => catalog.enemies.find(enemy => enemy.id === id).name).join('、'), pool.challenge.map(id => catalog.enemies.find(enemy => enemy.id === id).name).join('、')])}

第一章首领苔藓巨像，第二章最终首领监视者。旧存档保留地图，分布按保存的房间档位读取。

## 自然敌人与首领

延迟指首次行动预警；普通攻击无冷却，射程内每个敌人阶段可攻击一次。主动技能独立计时。掉落有两个候选时按一次概率二选一；首领实例不提供普通物品掉落。

| 敌人 | 分布 | 属性 | 生命 | 攻击 | 射程 | 速度 | 初始延迟 | 特性 | 普通掉落 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
${enemyRows([...catalog.enemies.filter(enemy => !enemy.spawnOnly), { ...catalog.boss, boss: true }])}

## 生成物

不自然生成，不给经验或普通物品掉落；击杀仍触发公共击杀事件，资源循环风险见[当前待办](/wiki/development-plan)。

| 敌人 | 分布 | 属性 | 生命 | 攻击 | 射程 | 速度 | 初始延迟 | 特性 | 普通掉落 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
${enemyRows(catalog.enemies.filter(enemy => enemy.spawnOnly))}

## 行动与特性

玩家手动结束回合后先进行宠物阶段，再按翻开顺序进行敌人阶段。敌人处理行动延迟、复活与再生后，在速度限制内接近玩家，到达射程立即停止并攻击。速度0不移动，速度2最多走两格；不会为了用完速度多走。

- **伏击**：翻出瞬间尝试一次射程内攻击，随后加入正常流程。普通敌人翻出后等待敌人阶段。
- **警报**：揭示时唤醒最近一名隐藏敌人，不递归触发警报。
- **护盾／重甲**：护盾将首次受伤限制为最大生命的一半，重甲在护盾后令每次伤害减少1。
- **再生**：自身结算前回复定义值。**分裂**在首次普通攻击后产生幼体；**召唤**按实际行动次数触发，受存活幼体上限限制；**死亡孳生**在最终死亡后生成幼体。
- **复活**：首次归零后占格假死，补刀最终击杀，否则两回合后满血复活；假死维持战斗。
- **燃烧**：从命中后的下个大回合开始扣血，可由护甲吸收。**死亡中毒**在玩家处于八邻域时施加无视护甲的毒。**牵引**在命中后尝试拉近玩家。
- **死亡爆炸／主动自爆**：最终死亡爆炸使用专属动作；自爆灯灵发动攻击时以爆炸范围结算并消失，不再二次爆炸。

敌人朝向依玩家所在列决定：左侧−30°、右侧+30°，同列保留朝向，新敌人同列默认左。非漂浮敌人具有地面支撑节点，待机脚固定、身体晃动，动作不向下穿地。翻出时直接以立体模型从后向前翻出，不再使用红色占位图形。

## 陷阱

翻开立即结算，不重复触发。在当前大回合计数+2时清理：完整保留下一次敌人阶段，第二次阶段开始前移除；探索不推进计时。

| 陷阱 | 效果 |
| --- | --- |
${itemRows(TRAP_DEFS, trap => [trap.name, trap.description])}

声响陷阱翻出的敌人至少延迟一次正常敌人阶段。状态和属性规则见[回合、移动与战斗](/wiki/03-turn-and-combat)。
`
