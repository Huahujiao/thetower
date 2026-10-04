import { ENEMY_ART_PACK_VERSION, createEnemyShadowProjects } from '../../animation/shadow-enemies.js'

const projects = createEnemyShadowProjects({ includeBoss: true })

export default `# 敌人骨架与贴图

当前运行时使用${projects.length}套敌人骨架，敌人资源包版本${ENEMY_ART_PACK_VERSION}。本页记录当前部件制作与验证流程。

## 数据与资源

- 定义与默认骨架：src/animation/shadow-enemies.js、shadow-enemy-roster.js。
- 分批部件适配：shadow-enemy-components.js及batch2／batch3／batch4模块。
- 运行时部件贴图：public/assets/enemies/components-v1/；清单与接触轮廓：enemy-component-assets.json、enemy-contact-hulls.json。
- 原始切片：island-slicer-web/output/。各文件夹编号不要求连续，根目录preview_indexed.png可辅助判断连接关系。
- 游戏和/animeedit共享角色数据；自定义编辑保存在浏览器本地。升级默认模板时保留自定义旧角色备份。

## 适配原则

按轮廓与连接关系选择少量必要部件，可改骨架、关节深度和动画，不要求用完全部切片。上臂、前臂等重叠面要错开深度避免z-fighting；透明边距不能参与视觉尺寸基准。

以猩鬼的可见轮廓对角线归一化大小，保留各自宽瘦比例。非漂浮敌人配置地面支撑与接触节点，待机固定脚底、身体晃动；移动、攻击、受击和死亡不得向下穿地。漂浮敌人明确标记，不套用脚底约束。

翻出直接用立体敌人从背面向前翻转，旧红色圆加三角占位已删除。动画按渲染帧推进，平移与缩放相机不重置骨骼姿态。朝向按玩家与敌人的列关系决定，同列保留此前方向。

## 验证

- npm.cmd run check:animation：骨架、纹理路径、地面接触及所有动作采样。
- npm.cmd run check:combat-motion：动作结算、相机操作不干扰动画、朝向与实例隔离。
- tools/enemy-component-review.html、tools/enemy-size-review.html：人工检查连接、宽瘦与大小。

自动采样不能代替手机实机检查。切片缺少必要连接、透视不一致或透明轮廓无法贴地时，应重新生成素材。
`
