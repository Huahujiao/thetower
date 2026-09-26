export const WIKI_SECTIONS = Object.freeze([
  { id: 'rules', title: '玩法与规则', description: '一局流程、房间、回合、背包与成长。' },
  { id: 'catalog', title: '内容清单', description: '由当前游戏数据直接生成。' },
  { id: 'reference', title: '内容设计', description: '物品与敌人的详细说明，以及构筑思路。' },
  { id: 'development', title: '开发与工具', description: '代码结构、工具和资源制作记录。' },
  { id: 'planning', title: '规划备忘', description: '设计方向与待验证目标，具体实现以游戏为准。' },
])

export const CATALOG_PAGES = Object.freeze([
  { id: 'enemies', title: '敌人清单', summary: '行为、特性、射程与掉落', section: 'catalog' },
  { id: 'traps', title: '陷阱清单', summary: '触发与持续效果', section: 'catalog' },
  { id: 'weapons', title: '武器清单', summary: '属性、攻击、射程与占格', section: 'catalog' },
  { id: 'relics', title: '圣遗物清单', summary: '被动效果与获取来源', section: 'catalog' },
  { id: 'talents', title: '天赋清单', summary: '三条路线与前置条件', section: 'catalog' },
  { id: 'items', title: '防具、消耗品与材料', summary: '效果、占格与来源', section: 'catalog' },
])

export const ARTICLE_PAGES = Object.freeze([
  { id: '01-overview', title: '一局游戏', summary: '目标、初始状态与核心循环', section: 'rules', load: () => import('./wiki-articles/01-overview.js') },
  { id: '02-dungeon', title: '地牢、卡牌与门', summary: '房间拓扑、翻牌与钥匙机关', section: 'rules', load: () => import('./wiki-articles/02-dungeon.js') },
  { id: '03-turn-and-combat', title: '回合、移动与战斗', summary: '行动顺序、体力与属性克制', section: 'rules', load: () => import('./wiki-articles/03-turn-and-combat.js') },
  { id: '04-inventory', title: '背包、物品与合成', summary: '占格、整理费用与合成规则', section: 'rules', load: () => import('./wiki-articles/04-inventory.js') },
  { id: '06-progression', title: '升级、奖励与商店', summary: '天赋、房间奖励与获取渠道', section: 'rules', load: () => import('./wiki-articles/06-progression.js') },
  { id: '08-interface', title: '游戏界面与交互', summary: '触屏操作与视觉反馈', section: 'rules', load: () => import('./wiki-articles/08-interface.js') },
  { id: '05-items', title: '当前物品清单', summary: '物品效果与协同示例', section: 'reference', load: () => import('./wiki-articles/05-items.js') },
  { id: '07-enemies', title: '敌人、行为与陷阱', summary: '敌人数据、行动规则与陷阱', section: 'reference', load: () => import('./wiki-articles/07-enemies.js') },
  { id: 'build-archetypes', title: '物品协同方向', summary: '已实现的十个方向与后续候选', section: 'reference', load: () => import('./wiki-articles/build-archetypes.js') },
  { id: '09-tools', title: '图鉴与动画编辑工具', summary: '独立工具路由与数据来源', section: 'development', load: () => import('./wiki-articles/09-tools.js') },
  { id: '10-technical', title: '技术结构、存档与验证', summary: '模块边界、资源与检查命令', section: 'development', load: () => import('./wiki-articles/10-technical.js') },
  { id: 'enemy-texture-batch', title: '敌人骨架贴图记录', summary: '示例敌人的贴图与迁移方式', section: 'development', load: () => import('./wiki-articles/enemy-texture-batch.js') },
  { id: 'project-readme', title: '项目入口', summary: '项目路由与本地启动', section: 'development', load: () => import('./wiki-articles/project-readme.js') },
  { id: 'art-asset-list', title: '美术素材规划记录', summary: '早期素材清单与视觉方向', section: 'planning', load: () => import('./wiki-articles/art-asset-list.js') },
  { id: 'art-prompts', title: '美术生成提示词记录', summary: '地板与卡背的生成提示词', section: 'planning', load: () => import('./wiki-articles/art-prompts.js') },
  { id: 'roadmap', title: '原始路线图', summary: '机制、美术与剧情想法', section: 'planning', load: () => import('./wiki-articles/roadmap.js') },
  { id: 'development-plan', title: '后续开发建议', summary: '完整一局后的实施顺序与验证重点', section: 'planning', load: () => import('./wiki-articles/development-plan.js') },
])

export const WIKI_PAGES = Object.freeze([...CATALOG_PAGES, ...ARTICLE_PAGES])
export const WIKI_PAGE_BY_ID = new Map(WIKI_PAGES.map((page) => [page.id, page]))
