# 属性机制简化与暂存清单

日期：2026-10-02。

普通武器保留属性。灼热 → 枯萎 → 沉溺 → 灼热的循环不变，克制攻击倍率改为 1.2，被克制、同属性与中性关系均为 1。沿用原有伤害取整规则。

## 暂时移出游戏的圣遗物

定义、特效实现和图片保留，通过 `disabled: true` 停止开局、升级、房间奖励、商店和协同推荐获取。修改设计后可重新启用。

| 名称 | ID | 暂停前效果 | 定义位置 | 实现位置 |
| --- | --- | --- | --- | --- |
| 三相轮 | `r-three` | 同时持有三种属性武器时，克制倍率变为 2.2；本轮已经取消被克制惩罚，仍为 1（更早的设计是 0.5）。 | `src/game/data/relics.js` | `src/game/rules/items.js`：`relicEffectActive`、`attackContext` |
| 逆克石 | `r-reverse` | 所有武器的属性克制关系反转。 | `src/game/data/relics.js` | `src/game/rules/items.js`：`attackContext` |
| 换相指针 | `r-phase-pointer` | 与上次攻击不同属性的武器有效命中后，下次攻击伤害 +1、体力消耗 -1，不叠加。 | `src/game/data/relics.js` | `src/game/rules/items.js`：`afterAttack`、`matchingBuffs`、`cost` |
| 平相石 | `r-neutral-stone` | 相邻武器被克制时按中性关系计算；新规则下已无减伤可抵消。 | `src/game/data/expansion-items.js` | `src/game/rules/expansion.js`：`relation` |

## 保留本体、暂停特效的武器和防具

攻击、体力消耗、射程、基础护甲、属性、形状、图片、获取来源和合成路线均保留。当前说明统一为“无额外特效”。防具仍在首次进入新房间时提供基础护甲。

| 名称 | ID | 暂停的原效果 | 保留的基础数值 | 恢复时需要修改的位置 |
| --- | --- | --- | --- | --- |
| 烬钥剑 | `triad-ember` | 若上一把攻击武器属性不同，本次攻击伤害 +1。 | 1级，攻击 3、体力 3、射程 1，2格，灼热；仍可与导流线合成铸币剑。 | `catalog.json`；`items.js`：`attackContext`、`weaponLines`；`synergies.js` 的属性推荐标签 |
| 潮镜盾 | `tide-shield` | 沉溺武器有效命中后将护甲补足至 2。 | 基础护甲 1，3格，沉溺。 | `catalog.json`；`items.js`：`afterAttack` |
| 赤鳞盾 | `red-shield` | 护甲被敌人打空后，下次灼热武器攻击 +2，不叠加。 | 基础护甲 1，3格，灼热。 | `catalog.json`；`items.js`：`afterDamage` |
| 赤鳞甲 | `red-armor` | 生命不高于 50% 时，灼热武器有效命中后将护甲补足至 3。 | 基础护甲 1，3格，灼热。 | `catalog.json`；`items.js`：`afterAttack` |
| 换相甲 | `phase-armor` | 本次攻击武器属性与上次不同时获得 1 护甲。 | 基础护甲 1，2格，中性。 | `expansion-items.js`；`expansion.js`：`beforeAttack`；`synergies.js` 的属性推荐标签 |

上述数据文件位于 `src/game/data/`，规则文件位于 `src/game/rules/`。图片及其映射位于 `src/assets/inventory/` 和 `src/ui/item-sprites.js`，此次不删除。

腐环匕、潮尺弓等武器虽然使用三相系列 ID，但现有效果依赖中毒或射程，不依赖属性，保留特效。血契铜镜等仅带属性标签、效果不依赖属性的物品也保留。

## 存档兼容与恢复事项

- 保持存档版本不变。`src/game/data/attribute-item-retirement.js` 在加载时迁移，已完成早期平衡迁移的存档也会处理。
- 暂停圣遗物从旧背包、暂存区、地面和商店中移除；开局、升级和收藏家候选补充有效圣遗物，房间奖励中的暂停圣遗物改为该层常规金币奖励。
- 五件白板物品刷新说明，保留 UID、强化值、攻击与基础数据、摆放位置及旋转；移除赤鳞盾和换相指针留下的待用增益，不重开游戏。
- 恢复圣遗物时移除定义中的 `disabled`，同步从迁移清单移出 ID；恢复白板特效时重新设计上述规则、说明与协同标签，同步从白板迁移清单移出 ID。
- 恢复后更新 Wiki 和相应回归检查。不要重新引入被克制的伤害惩罚，除非另行修改整体设计。
