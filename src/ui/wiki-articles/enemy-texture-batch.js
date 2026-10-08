import { ENEMY_ART_PACK_VERSION, createEnemyShadowProjects } from '../../animation/shadow-enemies.js'

const projects = createEnemyShadowProjects({ includeBoss: true })

export default `# 敌人骨架与贴图

当前运行时使用${projects.length}套敌人骨架，全部已接入部件贴图和待机、移动、攻击、受击、死亡动作。敌人资源包版本${ENEMY_ART_PACK_VERSION}。

## 数据与资源

- 定义与默认骨架：src/animation/shadow-enemies.js、shadow-enemy-roster.js。
- 分批部件适配：shadow-enemy-components.js及batch2／batch3／batch4／batch5模块。
- 运行时部件贴图：public/assets/enemies/components-v1/；清单与接触轮廓：enemy-component-assets.json、enemy-contact-hulls.json。
- 原始切片：island-slicer-web/output/。各文件夹编号不要求连续，根目录preview_indexed.png可辅助判断连接关系。
- 最后一批补图与提示词：art/generated/enemy-completion-2026-10-08/，其中潮祀母体复用已有原图。
- 游戏和/animeedit共享角色数据；自定义编辑保存在浏览器本地。升级默认模板时保留自定义旧角色备份。

## 适配原则

按轮廓与连接关系选择少量必要部件，可改骨架、关节深度和动画，不要求用完全部切片。上臂、前臂等重叠面要错开深度避免z-fighting；透明边距不能参与视觉尺寸基准。

以猩鬼的可见轮廓对角线归一化大小，保留各自宽瘦比例。非漂浮敌人配置地面支撑与接触节点，待机固定脚底、身体晃动；移动、攻击、受击和死亡不得向下穿地。漂浮敌人明确标记，不套用脚底约束。

巡路犬的长吻与赤轮火鸦的长喙使用镜像侧脸，两张零厚度纸片沿鼻尖或喙尖折线拼成折面，下颌共用后侧铰链。短吻、宽脸兽型保留正脸。潮祀母体按无腿悬裾结构列为漂浮类。

翻出直接用立体敌人从背面向前翻转，旧红色圆加三角占位已删除。动画按渲染帧推进，平移与缩放相机不重置骨骼姿态。朝向按玩家与敌人的列关系决定，同列保留此前方向。

## 验证

- npm.cmd run check:animation：骨架、纹理路径、地面接触及所有动作采样。
- npm.cmd run check:combat-motion：动作结算、相机操作不干扰动画、朝向与实例隔离。
- tools/enemy-component-review.html、tools/enemy-size-review.html：人工检查连接、宽瘦与大小。
- tools/enemy-completion-review.html：实际游戏Three.js敌人的多角度与动作检查。

自动采样不能代替手机实机检查。切片缺少必要连接、透视不一致或透明轮廓无法贴地时，应重新生成素材。
`
