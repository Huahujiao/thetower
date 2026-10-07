export const WIKI_SECTIONS = Object.freeze([
  { id: 'rules', title: '玩法与规则' },
  { id: 'catalog', title: '内容清单' },
  { id: 'reference', title: '内容设计' },
  { id: 'development', title: '开发与工具' },
  { id: 'planning', title: '待办与候选' },
])

export const CATALOG_PAGES = Object.freeze([
  { id: 'enemies', title: '敌人清单', section: 'catalog' },
  { id: 'traps', title: '陷阱清单', section: 'catalog' },
  { id: 'growth', title: '\u5347\u7ea7\u5956\u52b1\u6e05\u5355', section: 'catalog' },
  { id: 'items', title: '物品清单', section: 'catalog' },
])

export const ARTICLE_PAGES = Object.freeze([
  { id: '01-overview', title: '一局游戏', section: 'rules', load: () => import('./wiki-articles/01-overview.js') },
  { id: '02-dungeon', title: '地牢、卡牌与门', section: 'rules', load: () => import('./wiki-articles/02-dungeon.js') },
  { id: '03-turn-and-combat', title: '回合、移动与战斗', section: 'rules', load: () => import('./wiki-articles/03-turn-and-combat.js') },
  { id: '04-inventory', title: '背包、物品与合成', section: 'rules', load: () => import('./wiki-articles/04-inventory.js') },
  { id: '06-progression', title: '升级、奖励与商店', section: 'rules', load: () => import('./wiki-articles/06-progression.js') },
  { id: '08-interface', title: '游戏界面与交互', section: 'rules', load: () => import('./wiki-articles/08-interface.js') },
  { id: '07-enemies', title: '敌人、行为与陷阱', section: 'reference', load: () => import('./wiki-articles/07-enemies.js') },
  { id: '09-tools', title: '图鉴与动画编辑工具', section: 'development', load: () => import('./wiki-articles/09-tools.js') },
  { id: '10-technical', title: '技术结构、存档与验证', section: 'development', load: () => import('./wiki-articles/10-technical.js') },
  { id: 'enemy-texture-batch', title: '敌人骨架与贴图', section: 'development', load: () => import('./wiki-articles/enemy-texture-batch.js') },
  { id: 'project-readme', title: '项目入口', section: 'development', load: () => import('./wiki-articles/project-readme.js') },
  { id: 'art-asset-list', title: '当前美术素材状态', section: 'development', load: () => import('./wiki-articles/art-asset-list.js') },
  { id: 'art-prompts', title: '美术生成提示词', section: 'development', load: () => import('./wiki-articles/art-prompts.js') },
  { id: 'roadmap', title: '后续候选方向', section: 'planning', load: () => import('./wiki-articles/roadmap.js') },
  { id: 'development-plan', title: '当前漏洞与待做项', section: 'planning', load: () => import('./wiki-articles/development-plan.js') },
])

export const WIKI_PAGES = Object.freeze([...CATALOG_PAGES, ...ARTICLE_PAGES])
export const WIKI_PAGE_BY_ID = new Map(WIKI_PAGES.map((page) => [page.id, page]))
