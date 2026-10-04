import { ACTIVE_ITEMS } from '../wiki-data.js'
import { itemSpriteSources } from '../item-sprites.js'
import { createEnemyShadowProjects } from '../../animation/shadow-enemies.js'

const missingItems = ACTIVE_ITEMS.filter(item => !itemSpriteSources(item)?.small || !itemSpriteSources(item)?.medium)
const projects = createEnemyShadowProjects({ includeBoss: true })
const geometryOnly = projects.filter(project => !project.parts.some(part => part.visual.type === 'texture'))

export default `# 当前美术素材状态

本页按现役物品与默认敌人骨架检查素材覆盖。

## 背包物品

启用物品${ACTIVE_ITEMS.length}种（含效果生成物），均与游戏共享small／medium精灵。8种宠物已经补齐，钱袋数字由界面直接叠加，拾金钩按纵向占格绘制。

缺少尺寸映射的物品：${missingItems.length ? missingItems.map(item => item.name).join('、') : '无'}。文件是否实际存在由Wiki检查验证。

## 敌人

默认敌人骨架${projects.length}套，部件可混用贴图与简单几何，不要求每张切片都接入。完全使用几何的敌人：${geometryOnly.map(project => project.name.replace(' · 骨架预览', '')).join('、') || '无'}。

非漂浮敌人具有地面支撑节点，待机与全部动作遵守地面约束；尺寸以猩鬼为基准保持对角线一致。部件连接优先参考素材根目录的preview_indexed.png，同时结合独立切片判断，无法适配时重新生成。

## 场景与界面

四种深青灰石板与暗灰统一卡背已接入。属性牌背资源仍保留，但隐藏牌不透露内容属性。墙、门、玩家、商人、陷阱和图腾仍含程序绘制外观；场景补图按当前要求暂缓。

后续先处理明显穿模、锚点、轮廓与手机可读性问题，再考虑整套做旧和场景美术。不要把已完成的物品补图再次列为待做。

素材流程见[敌人骨架与贴图](/wiki/enemy-texture-batch)，当前场景提示词见[美术生成提示词](/wiki/art-prompts)。
`
