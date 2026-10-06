import { getItemDefinition, RECIPES } from '../../game/data/content.js'
import { attributeLabel } from '../../game/data/attributes.js'
import { ACTIVE_ITEMS, REGULAR_ITEMS, SHOP_ITEMS, APPEARANCE_LABELS, shapeText, itemRows } from '../wiki-data.js'

const ofType = type => ACTIVE_ITEMS.filter(item => item.type === type)
const weapons = ofType('weapon')
const consumables = ACTIVE_ITEMS.filter(item => ['potion', 'armor', 'throwable', 'buff', 'teleport'].includes(item.type) && !item.generatedOnly)
const detailRows = items => itemRows(items, item => [item.name, shapeText(item), item.description])

export default `# 当前物品清单

表格直接读取运行时定义，只列启用物品。当前常规物品${REGULAR_ITEMS.length}种，另有${ACTIVE_ITEMS.filter(item => item.generatedOnly).length}种效果生成物；普通商店候选共${SHOP_ITEMS.length}种，实际货架还受进度门槛影响。钱袋仅开局提供；盾击符与2点肉块仅由物品效果生成。

物品按自身条件独立生效，没有固定套装激活名单。武器保留属性，属性用于体力球支付，不再参与克制；属性核心圣遗物已移出池，相关武器和防具保留本体并移除属性特效。暂停内容不混入现役清单。

## 武器（${weapons.length}）

外观只用于画面与合成路线，不作为配件或攻击费用的类型限制。

| 名称 | 等级 | 外观 | 属性 | 攻击 | 射程 | 体力 | 形状 | 效果 |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- |
${itemRows(weapons, item => [item.name, item.tier, APPEARANCE_LABELS[item.appearance] || '—', attributeLabel(item.attribute), item.attack, item.range, item.energyCost, shapeText(item), item.description])}

## 合成路线（${RECIPES.length}）

地面和补给武器只生成1级；2～3级由逐级合成或普通商店获得。同一成品可有不同入口，选择配方后只消耗对应两个实例。同种类沿路线升级，实例强化不继承。材料齐全即可合成，成品装不下进入暂存区；战斗中仍需1体力。

| 输入 | 材料 | 成品 |
| --- | --- | --- |
${itemRows(RECIPES, recipe => [getItemDefinition(recipe.a).name, getItemDefinition(recipe.b).name, getItemDefinition(recipe.result).name])}

寻妖刃的新局进度门槛对应实际第2层；旧地图按保存的进度判断。

## 被动防具（${ofType('defense').length}）

每件防具在首次进入新房间时提供其护甲值，同房间再访不重复提供；中途获得不补发，暂存区不生效。移除属性特效的防具仍提供基础护甲。

| 名称 | 入房护甲 | 形状 | 效果 |
| --- | ---: | --- | --- |
${itemRows(ofType('defense'), item => [item.name, item.armorValue, shapeText(item), item.description])}

## 常规消耗品（${consumables.length}）

玩家使用消耗整份；食物已全部移除。生命药只治疗，不清除负面状态。战斗中其他消耗品基础费用1，投掷器明确的额外费用另计，探索免费。1级翻出权重4，2级权重1。

| 名称 | 等级 | 基础数值 | 效果 |
| --- | ---: | --- | --- |
${itemRows(consumables, item => [item.name, item.tier, item.type === 'potion' ? `治疗${item.heal}` : item.type === 'armor' ? `护甲${item.armor}` : item.range ? `射程${item.range}` : '—', item.description])}

## 材料（${ofType('material').length}）

材料可合成，也按说明提供相邻效果。四向相邻按实际占用格判定，旋转后即时重算；合成消耗材料实例。

| 名称 | 形状 | 效果 |
| --- | --- | --- |
${detailRows(ofType('material'))}

## 圣遗物（${ofType('relic').length}，含图腾徽章）

背包中持有生效，暂存区不生效。同名唯一，无数量超载限制。

| 名称 | 形状 | 效果 |
| --- | --- | --- |
${detailRows(ofType('relic'))}

图腾徽章不消耗，选择后点击4格内已翻开的空格召唤。共享冷却2个大回合，持续到本次战斗结束；探索时放置的保留到下一次战斗结束。受击一次或离房也会消失，不改变供球数量。回气图腾暂时移除。

连饮环在使用前记录原有邻域，按顺时针免费使用后续消耗品，每件最多一次，新生成物不加入本次连锁。整次费用按主动使用的第一件计：基础1个任意球；免费触发不享受投掷器加成或支付其额外费用。无有效目标或玩家死亡时停止。

## 宠物（${ofType('pet').length}）

玩家结束回合后、敌人行动前，按背包从左到右、从上到下行动。射程从玩家位置计算，优先猎物，其次最近的已翻开存活敌人。无目标或主人剩余球不足时不行动、不扣球；暂存区不生效。

| 名称 | 攻击 | 射程 | 球消耗 | 形状 | 效果 |
| --- | ---: | ---: | ---: | --- | --- |
${itemRows(ofType('pet'), item => [item.name, item.attack, item.range, item.ballCost, shapeText(item), item.description])}

宠物消耗主人剩余体力球，颜色不限。相邻饲兽符使费用减少1球，最低1；食尸鼠自身击杀返还原球。血瓶不用于宠物供给，宠物支付不触发消耗品效果。

宠物不读取玩家武器加成和属性历史，但受敌人防御、闪避与反击影响。宠物击杀结算公共击杀事件，不触发玩家武器专属收益；召唤物没有经验、掉落或击杀物品及金币奖励。猎物、号角标记及群猎计数在敌人阶段后清除。

## 效果生成物

| 名称 | 形状 | 效果 |
| --- | --- | --- |
${detailRows(ACTIVE_ITEMS.filter(item => item.generatedOnly))}

盾击符在使用时读取当前护甲作为伤害，再消耗一半护甲（向上取整）。生成物和房间奖励装不下进入暂存区。

## 钱袋

| 名称 | 形状 | 效果 |
| --- | --- | --- |
${detailRows(ofType('money-pouch'))}

金币数字直接叠在钱袋图片上，没有椭圆背景。

完整费用见[回合、移动与战斗](/wiki/03-turn-and-combat)，整理见[背包、物品与合成](/wiki/04-inventory)，来源见[升级、奖励与商店](/wiki/06-progression)，协同见[物品协同方向](/wiki/build-archetypes)。
`
