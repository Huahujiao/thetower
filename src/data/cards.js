// 卡牌数据层 —— 数值来源：docs/ 怪物.md 武器.md 药水.md 道具.md 功能牌.md buff.md 统计.md
// M2/M3：新增 Buff 卡、每层牌堆生成器、环境与路线修饰。

// ---------- 怪物 ----------
// category: blood(腐化血肉) / shell(岩石甲壳) / spirit(灵体)
// tier: 1/2/3 常规层级，E 精英，B Boss
export const MONSTERS = [
  // 腐化血肉系（弱点：劈砍）
  { id: 'm_rot_rat',   name: '腐烂鼠尸',   tier: 1, category: 'blood',  weak: '劈砍', hp: 4,  atk: 1, drop: { gold: [1, 1] }, note: '最弱怪物' },
  { id: 'm_rot_flesh', name: '腐化血肉',   tier: 2, category: 'blood',  weak: '劈砍', hp: 8,  atk: 2, drop: { gold: [1, 2] } },
  { id: 'm_ripper',    name: '撕裂者',     tier: 3, category: 'blood',  weak: '劈砍', hp: 12, atk: 3, drop: { gold: [2, 3] } },
  { id: 'm_beast',     name: '血肉巨兽',   tier: 3, category: 'blood',  weak: '劈砍', hp: 18, atk: 4, drop: { gold: [3, 4] } },
  // 岩石甲壳系（弱点：穿刺）
  { id: 'm_stone_crab',name: '石壳蟹',     tier: 1, category: 'shell',  weak: '穿刺', hp: 6,  atk: 1, drop: { gold: [1, 1] } },
  { id: 'm_stone',     name: '岩石甲壳',   tier: 2, category: 'shell',  weak: '穿刺', hp: 12, atk: 3, drop: { gold: [2, 3] } },
  { id: 'm_beetle',    name: '裂地甲虫',   tier: 3, category: 'shell',  weak: '穿刺', hp: 16, atk: 4, drop: { gold: [3, 3] } },
  { id: 'm_basalt',    name: '玄武守卫',   tier: 3, category: 'shell',  weak: '穿刺', hp: 22, atk: 5, drop: { gold: [4, 4] } },
  // 灵体系（弱点：钝击 或 元素）
  { id: 'm_wraith',    name: '游魂',       tier: 1, category: 'spirit', weak: '钝击', hp: 3,  atk: 2, drop: { potion: 0.2 } },
  { id: 'm_ice',       name: '冰封怨灵',   tier: 2, category: 'spirit', weak: '元素', hp: 6,  atk: 2, drop: { gold: [1, 2], potion: 0.5 } },
  { id: 'm_ancient',   name: '古老者残影', tier: 3, category: 'spirit', weak: '钝击', hp: 10, atk: 4, drop: { key: 0.3 } },
  { id: 'm_banshee',   name: '哀嚎女妖',   tier: 3, category: 'spirit', weak: '钝击', hp: 14, atk: 4, drop: { gold: [3, 3], potion: 0.3 } },
  // 精英
  { id: 'm_abyss',     name: '深渊爬行者', tier: 'E', category: 'blood',  weak: '劈砍', hp: 24, atk: 5, drop: { gold: [5, 5], rareWeapon: 0.15 } },
  { id: 'm_tower',     name: '塔灵',       tier: 'E', category: 'shell',  weak: '穿刺', hp: 26, atk: 6, drop: { gold: [5, 5], key: 0.3 } },
  // Boss
  { id: 'm_boss',      name: '黑塔之主',   tier: 'B', category: 'spirit', weak: '随机', hp: 50, atk: 6, drop: { win: true }, note: '狂暴/塔威' },
]

// ---------- 武器 ----------
export const WEAPONS = [
  // 普通（8）
  { id: 'w_rust_cleaver', name: '锈蚀柴刀', type: '劈砍', atk: 3, dur: 10, rarity: '普通', tags: [] },
  { id: 'w_old_axe',      name: '古老石斧', type: '劈砍', atk: 4, dur: 10, rarity: '普通', tags: [] },
  { id: 'w_bone_awl',     name: '骨锥',     type: '穿刺', atk: 2, dur: 12, rarity: '普通', tags: [] },
  { id: 'w_rust_knife',   name: '锈蚀短刀', type: '穿刺', atk: 3, dur: 10, rarity: '普通', tags: [] },
  { id: 'w_cracked_club', name: '开裂木棒', type: '钝击', atk: 2, dur: 12, rarity: '普通', tags: [] },
  { id: 'w_iron_hammer',  name: '铁头锤',   type: '钝击', atk: 4, dur: 10, rarity: '普通', tags: [] },
  { id: 'w_torch',        name: '残火火把', type: '元素', atk: 2, dur: 8,  rarity: '普通', tags: [] },
  { id: 'w_ice_shard',    name: '冻结碎片', type: '元素', atk: 3, dur: 8,  rarity: '普通', tags: [] },
  // 精良（6）
  { id: 'w_hunter_blade', name: '猎人弯刀', type: '劈砍', atk: 5, dur: 10, rarity: '精良', tags: ['屠魔'] },
  { id: 'w_steel_sword',  name: '精钢长剑', type: '穿刺', atk: 5, dur: 10, rarity: '精良', tags: ['锋锐'] },
  { id: 'w_ritual_hammer',name: '仪式锤',   type: '钝击', atk: 5, dur: 10, rarity: '精良', tags: ['锋锐+1'] },
  { id: 'w_ember',        name: '星火余烬', type: '元素', atk: 3, dur: 10, rarity: '精良', tags: ['火焰溅射'] },
  { id: 'w_shadow_blade', name: '影袭短刃', type: '穿刺', atk: 4, dur: 10, rarity: '精良', tags: ['致命'] },
  { id: 'w_ice_staff',    name: '寒冰法杖', type: '元素', atk: 4, dur: 10, rarity: '精良', tags: ['驱灵'] },
  // 稀有（6）
  { id: 'w_greatsword',   name: '双手巨剑', type: '劈砍', atk: 7, dur: 10, rarity: '稀有', tags: ['锋锐', '吸血'] },
  { id: 'w_siege_spear',  name: '破城长枪', type: '穿刺', atk: 7, dur: 10, rarity: '稀有', tags: ['破甲'] },
  { id: 'w_warhammer',    name: '战锤',     type: '钝击', atk: 7, dur: 10, rarity: '稀有', tags: ['驱灵', '噬魂'] },
  { id: 'w_dragon_dagger',name: '龙牙匕首', type: '穿刺', atk: 6, dur: 10, rarity: '稀有', tags: ['致命', '锋锐'] },
  { id: 'w_thunder_core', name: '雷暴之核', type: '元素', atk: 6, dur: 8,  rarity: '稀有', tags: ['连锁闪电'] },
  { id: 'w_flame_staff',  name: '烈焰之杖', type: '元素', atk: 6, dur: 10, rarity: '稀有', tags: ['火焰溅射', '元素亲和'] },
  // 传说（4）
  { id: 'w_kingslayer',   name: '弑君巨刃', type: '劈砍', atk: 9, dur: 10, rarity: '传说', tags: ['锋锐', '致命', '吸血'] },
  { id: 'w_thousand_sting',name:'千刺',     type: '穿刺', atk: 8, dur: 10, rarity: '传说', tags: ['致命', '连锁闪电', '噬魂'] },
  { id: 'w_judge_hammer', name: '审判之锤', type: '钝击', atk: 8, dur: 12, rarity: '传说', tags: ['破甲', '驱灵', '噬魂'] },
  { id: 'w_tower_flame',  name: '塔顶之焰', type: '元素', atk: 8, dur: 10, rarity: '传说', tags: ['元素亲和', '火焰溅射', '贪婪'] },
]

// ---------- 药水 ----------
export const POTIONS = [
  { id: 'p_herb',    name: '止血草膏',   rarity: '普通', healHp: 4,  healSan: 0, floorMin: 1 },
  { id: 'p_small_hp',name: '小生命药水', rarity: '普通', healHp: 6,  healSan: 0, floorMin: 1 },
  { id: 'p_hp',      name: '生命药水',   rarity: '精良', healHp: 10, healSan: 0, floorMin: 3 },
  { id: 'p_strong_hp',name:'强效生命药剂',rarity: '稀有', healHp: 15, healSan: 0, floorMin: 5 },
  { id: 'p_calm',    name: '安神茶',     rarity: '普通', healHp: 0,  healSan: 6, floorMin: 1 },
  { id: 'p_san',     name: '理智药剂',   rarity: '普通', healHp: 0,  healSan: 9, floorMin: 1 },
  { id: 'p_san_g',   name: '理智药水',   rarity: '精良', healHp: 0,  healSan: 12, floorMin: 2 },
  { id: 'p_echo',    name: '回响药剂',   rarity: '稀有', healHp: 0,  healSan: 20, floorMin: 4 },
]

// ---------- 道具 ----------
export const ITEMS = [
  { id: 'i_whetstone',  name: '磨刀石',     rarity: '普通', repair: 5,  costTurn: true,  fixBroken: false, floorMin: 1 },
  { id: 'i_whet_great', name: '精制磨刀石', rarity: '精良', repair: 10, costTurn: true,  fixBroken: true,  floorMin: 3 },
  { id: 'i_oil',        name: '保养油',     rarity: '普通', costTurn: false, buff: 'maintain3', floorMin: 2 },
  { id: 'i_spare_blade',name: '备用刀刃',   rarity: '精良', costTurn: false, fixBroken: true, repair: 5, floorMin: 4 },
]

// ---------- 统一价格表（层间商店 / 出售折价共用） ----------
export const POTION_PRICE = {
  p_herb: 3, p_small_hp: 4, p_hp: 7, p_strong_hp: 11,
  p_calm: 4, p_san: 6, p_san_g: 8, p_echo: 14,
}
export const ITEM_PRICE = { i_whetstone: 3, i_whet_great: 6, i_oil: 4, i_spare_blade: 6 }
export const BUFF_PRICE = {
  b_power: 3, b_vamp: 3, b_sunder: 3, b_slow: 2, b_purify: 2,
  b_calme: 4, b_oil: 3, b_crit: 5, b_sac: 4, b_thorn: 5,
}
const RARITY_PRICE_BONUS = { 普通: 0, 精良: 1, 稀有: 3, 传说: 6 }
export function weaponPrice(def) {
  return Math.max(3, def.atk * 2 + (RARITY_PRICE_BONUS[def.rarity] || 0))
}
// 任意牌定义的参考售价（买入价）
export function priceOf(def) {
  if (!def) return 1
  if (def.atk !== undefined) return weaponPrice(def)
  if (def.healHp !== undefined || def.healSan !== undefined) return POTION_PRICE[def.id] || 4
  if (def.repair !== undefined || def.buff) return ITEM_PRICE[def.id] || 4
  if (def.effect) return BUFF_PRICE[def.id] || 3
  return 1
}

// ---------- 一次性 Buff 牌 ----------
// effect 字段含义（与 core 文档 9 节一致）：
//   atk       下一次攻击 +N 攻击力
//   lifesteal 造成伤害的 N 比例转为生命
//   ignoreCounter 无视克制关系，按 ×1.5 结算
//   bonus     附加 N 点固定伤害
//   forceCrit 必定暴击（×1.5）
//   slowTarget 使目标攻击 -N，持续 1 回合
//   purify    移除目标增益（当前版本怪物无增益，占位）
//   noDurLoss 本次攻击不消耗耐久
// 即时效果（使用时立即结算）：sanNow +N 理智，hpCost N 生命
export const BUFFS = [
  { id: 'b_power',  name: '力量增幅', rarity: '普通', effect: { atk: 3 } },
  { id: 'b_vamp',   name: '吸血符文', rarity: '普通', effect: { lifesteal: 0.5 } },
  { id: 'b_sunder', name: '破甲打击', rarity: '普通', effect: { ignoreCounter: true, bonus: 2 } },
  { id: 'b_slow',   name: '减速',     rarity: '普通', effect: { slowTarget: 1 } },
  { id: 'b_purify', name: '净化',     rarity: '普通', effect: { purify: true } },
  { id: 'b_calme',  name: '清醒',     rarity: '精良', effect: { sanNow: 6, atk: 1 } },
  { id: 'b_oil',    name: '磨刀油',   rarity: '普通', effect: { noDurLoss: true } },
  { id: 'b_crit',   name: '暴击符文', rarity: '精良', effect: { forceCrit: true } },
  { id: 'b_sac',    name: '献祭',     rarity: '精良', effect: { hpCost: 2, atk: 5 } },
  { id: 'b_thorn',  name: '荆棘守护', rarity: '稀有', effect: { thorns: 2 } },
]

// ---------- 功能牌 ----------
export const GOLD_CARDS = [
  { id: 'g_copper', name: '散落铜币',   rarity: '普通', gold: 1, weight: 50 },
  { id: 'g_pile',   name: '古币堆',     rarity: '普通', gold: 2, weight: 35 },
  { id: 'g_treasure',name:'遗失的宝藏', rarity: '精良', gold: 3, weight: 15 },
]
export const KEY_CARD   = { id: 'key', name: '钥匙碎片' }
export const EXIT_CARDS = [
  { id: 'exit_normal', name: '普通出口',   route: null },
  { id: 'exit_battle', name: '战斗之路出口', route: 'battle' },
  { id: 'exit_rot',    name: '腐化之路出口', route: 'rot' },
  { id: 'exit_balance',name: '均衡之路出口', route: 'balance' },
]
export const ENTRY_CARD = { id: 'entry', name: '入口牌' }

// ---------- 牌类型枚举 ----------
export const T = {
  MONSTER: 'monster', WEAPON: 'weapon', POTION: 'potion', ITEM: 'item',
  GOLD: 'gold', KEY: 'key', EXIT: 'exit', ENTRY: 'entry', BUFF: 'buff',
}

// ---------- 全量查表（存读档用） ----------
const ALL = { monster: MONSTERS, weapon: WEAPONS, potion: POTIONS, item: ITEMS,
  buff: BUFFS, gold: GOLD_CARDS, key: [KEY_CARD], exit: EXIT_CARDS, entry: [ENTRY_CARD] }
export const DEFS_BY_ID = {}
for (const type in ALL) for (const def of ALL[type]) DEFS_BY_ID[def.id] = { type, def }
export function getDef(type, id) { return DEFS_BY_ID[id]?.def || null }

// ============ 楼层配置 ============
// 统计.md 配比表（怪物含精英/boss 已并入数值）
export const FLOORS = [
  { grid: 4, monsters: 4,  weapons: 3, potions: 2, golds: 1, items: 1, buffs: 0, keys: 3, exits: 1, elite: false, boss: false },
  { grid: 5, monsters: 6,  weapons: 4, potions: 3, golds: 3, items: 1, buffs: 2, keys: 3, exits: 1, elite: false, boss: false },
  { grid: 5, monsters: 6,  weapons: 4, potions: 3, golds: 3, items: 1, buffs: 2, keys: 3, exits: 3, elite: false, boss: false },
  { grid: 6, monsters: 9,  weapons: 5, potions: 4, golds: 4, items: 2, buffs: 2, keys: 3, exits: 1, elite: false, boss: false },
  { grid: 6, monsters: 9,  weapons: 5, potions: 4, golds: 4, items: 2, buffs: 2, keys: 3, exits: 1, elite: false, boss: false },
  { grid: 6, monsters: 10, weapons: 5, potions: 4, golds: 4, items: 2, buffs: 3, keys: 3, exits: 3, elite: true,  boss: false },
  { grid: 5, monsters: 1,  weapons: 3, potions: 3, golds: 2, items: 2, buffs: 3, keys: 0, exits: 0, elite: false, boss: true },
]

// 环境特效（非断层层进入下一层时随机附带）
export const ENVIRONMENTS = [
  { id: 'corrupt', name: '腐化气息', desc: '污染牌比例 +15%，污染奖励翻倍',
    mod: { pollutionBonus: 0.15, rewardMult: 2 } },
  { id: 'frost',   name: '冰封',     desc: '翻出怪物额外消耗 1 理智，武器牌概率提升',
    mod: { sanCostBonus: 1, weaponProbBonus: 0.10 } },
  { id: 'echo',    name: '古老回响', desc: '钥匙碎片掉落率 +20%，怪物攻击 -1',
    mod: { keyDropBonus: 0.20, monAtkMalus: 1 } },
  { id: 'whisper', name: '疯狂低语', desc: '翻出怪物额外消耗 1 理智，武器/buff 概率提升',
    mod: { sanCostBonus: 1, weaponProbBonus: 0.10 } },
]

// 路线修饰（第 3/6 层三出口）
export const ROUTES = {
  battle:  { name: '战斗之路', mod: { monBonus: 0.20, goldMult: 2 },
    desc: '下一层怪物 +20%，金币掉落 ×2' },
  rot:     { name: '腐化之路', mod: { pollutionBonus: 0.30, weaponRareMult: 1.5 },
    desc: '下一层污染 +30%，稀有武器概率 ×1.5' },
  balance: { name: '均衡之路', mod: { keyBonus: 1 },
    desc: '下一层标准牌堆，钥匙碎片 +1' },
}

// 武器稀有度抽取权重（按层区间）
const W_TIERS = {
  A: { 普通: 70, 精良: 27, 稀有: 3,  传说: 0 },
  B: { 普通: 40, 精良: 40, 稀有: 18, 传说: 2 },
  C: { 普通: 20, 精良: 35, 稀有: 35, 传说: 10 },
  Z: { 普通: 0,  精良: 40, 稀有: 45, 传说: 15 },
}
function weaponTier(floor) {
  if (floor <= 2) return 'A'
  if (floor <= 4) return 'B'
  if (floor <= 6) return 'C'
  return 'Z'
}
// 怪物分层池
const MON_T1 = ['m_rot_rat', 'm_stone_crab', 'm_wraith']
const MON_T2 = ['m_rot_flesh', 'm_stone', 'm_ice']
const MON_T3 = ['m_ripper', 'm_beast', 'm_beetle', 'm_basalt', 'm_ancient', 'm_banshee']
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function pickWeighted(map) {
  const entries = Object.entries(map).filter(([, w]) => w > 0)
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let r = Math.random() * total
  for (const [k, w] of entries) { if ((r -= w) <= 0) return k }
  return entries[0][0]
}
function shuffled(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// 生成下一层牌堆原始描述（不含网格坐标），mod 为上一层出口/环境带来的修饰
export function buildFloorDeck(floor, mod = {}) {
  const cfg = FLOORS[floor - 1]
  const m = {
    pollutionBonus: 0, monBonus: 0, goldMult: 1, weaponRareMult: 1,
    weaponProbBonus: 0, keyBonus: 0, sanCostBonus: 0, monAtkMalus: 0,
    keyDropBonus: 0, rewardMult: 1, label: '', ...mod,
  }
  // 固定牌
  const deck = [{ type: T.ENTRY, def: ENTRY_CARD, pollut: false }]
  for (let i = 0; i < cfg.keys + (m.keyBonus || 0); i++) deck.push({ type: T.KEY, def: KEY_CARD, pollut: false })

  // 出口：断层层三路线；普通层 1 张；Boss 层 0 张（击杀 Boss 即通关）
  if (cfg.exits >= 3) {
    for (const rid of ['exit_battle', 'exit_rot', 'exit_balance']) deck.push({ type: T.EXIT, def: EXIT_CARDS.find(e => e.id === rid), pollut: false })
  } else if (cfg.exits === 1) {
    deck.push({ type: T.EXIT, def: EXIT_CARDS.find(e => e.id === 'exit_normal'), pollut: false })
  }

  // 各类型目标数量
  let req = {
    monster: cfg.monsters, weapon: cfg.weapons, potion: cfg.potions,
    gold: cfg.golds, item: cfg.items, buff: cfg.buffs,
  }
  // 战斗之路：怪物比例 +20%
  if (m.monBonus) req.monster = Math.round(req.monster * (1 + m.monBonus))
  // 冰封/疯狂低语：武器概率提升 → 把部分金币转为武器
  if (m.weaponProbBonus) {
    const shift = Math.round(req.gold * m.weaponProbBonus)
    req.gold -= shift; req.weapon += shift
  }

  // 计算剩余格子（网格 - 固定牌），按 req 比例填充并保证不溢出
  const totalCells = cfg.grid * cfg.grid
  const fixed = deck.length
  let remaining = totalCells - fixed
  let sum = req.monster + req.weapon + req.potion + req.gold + req.item + req.buff
  if (sum > remaining) {
    const k = remaining / sum
    for (const key in req) req[key] = Math.floor(req[key] * k)
  }
  sum = req.monster + req.weapon + req.potion + req.gold + req.item + req.buff
  // 余数补到怪物（主要威胁）
  req.monster += (remaining - sum)

  // 怪物池
  let monIds = []
  if (cfg.boss) monIds = ['m_boss']
  else {
    let pool = floor <= 1 ? MON_T1 : floor <= 2 ? [...MON_T1, ...MON_T2] : floor <= 4 ? [...MON_T2, ...MON_T3] : MON_T3
    for (let i = 0; i < req.monster; i++) monIds.push(pick(pool))
    if (cfg.elite) { // 把其中一只替换为精英
      const ei = Math.floor(Math.random() * monIds.length)
      monIds[ei] = pick(['m_abyss', 'm_tower'])
    }
  }
  for (const id of monIds) deck.push({ type: T.MONSTER, def: MONSTERS.find(x => x.id === id), pollut: false })

  // 武器（稀有度权重）
  const wt = W_TIERS[weaponTier(floor)]
  const rareMul = m.weaponRareMult || 1
  const wMap = {}
  for (const [rar, w] of Object.entries(wt)) wMap[rar] = Math.round(w * (rar === '稀有' || rar === '传说' ? rareMul : 1))
  const byRar = { 普通: [], 精良: [], 稀有: [], 传说: [] }
  for (const w of WEAPONS) byRar[w.rarity].push(w)
  for (let i = 0; i < req.weapon; i++) {
    const rar = pickWeighted(wMap)
    const cand = byRar[rar].length ? byRar[rar] : WEAPONS
    deck.push({ type: T.WEAPON, def: pick(cand), pollut: false })
  }

  // 药水（按 floorMin 筛选）
  const potPool = POTIONS.filter(p => floor >= (p.floorMin || 1))
  for (let i = 0; i < req.potion; i++) deck.push({ type: T.POTION, def: pick(potPool), pollut: false })

  // 金币（按功能牌.md 权重 50/35/15 抽取 1/2/3 金）
  const goldTotal = GOLD_CARDS.reduce((s, g) => s + (g.weight || 1), 0)
  for (let i = 0; i < req.gold; i++) {
    let r = Math.random() * goldTotal
    let gdef = GOLD_CARDS[0]
    for (const g of GOLD_CARDS) { if ((r -= (g.weight || 1)) <= 0) { gdef = g; break } }
    deck.push({ type: T.GOLD, def: gdef, pollut: false })
  }

  // 道具（按 floorMin 筛选）
  const itemPool = ITEMS.filter(it => floor >= (it.floorMin || 1))
  for (let i = 0; i < req.item; i++) deck.push({ type: T.ITEM, def: pick(itemPool), pollut: false })

  // Buff（按层池）
  const buffPool = buffPoolForFloor(floor)
  for (let i = 0; i < req.buff; i++) deck.push({ type: T.BUFF, def: pick(buffPool), pollut: false })

  // 污染标记（20%~30% + 修饰），排除 key/exit/entry
  const pollRate = Math.min(0.6, 0.20 + Math.random() * 0.10 + (m.pollutionBonus || 0))
  const pollCandidates = deck.filter(c => c.type !== T.KEY && c.type !== T.EXIT && c.type !== T.ENTRY)
  for (const c of shuffled(pollCandidates)) {
    if (Math.random() < pollRate) c.pollut = true
  }

  return { deck, mod: m }
}

function buffPoolForFloor(floor) {
  if (floor <= 2) return ['b_power', 'b_vamp', 'b_oil'].map(id => BUFFS.find(b => b.id === id))
  if (floor <= 4) return ['b_power', 'b_vamp', 'b_oil', 'b_calme', 'b_crit', 'b_sunder', 'b_slow', 'b_purify'].map(id => BUFFS.find(b => b.id === id))
  if (floor <= 6) return BUFFS.slice()
  return ['b_calme', 'b_crit', 'b_thorn', 'b_sac'].map(id => BUFFS.find(b => b.id === id))
}

// M1 兼容：层 1 牌堆（保持原配比）
export function buildFloor1Deck() {
  const { deck } = buildFloorDeck(1)
  return deck
}

// ============ 层间修整：商店库存 与 三选一奖励 ============

// 每 SHOP_EVERY 层出现一次商店（离开第 3 / 6 层时）
export const SHOP_EVERY = 3
// 商店固定必备的「小号回理智药」（安神茶 +6 理智）
export const SHOP_SAN_POTION_ID = 'p_calm'
// 商店货架格数（HUD 按 4 列 × 2 行渲染）
export const SHOP_SLOTS = 8

// 按当前层的稀有度权重抽一把武器
export function pickWeaponByFloor(floor, rareMul = 1) {
  const wt = W_TIERS[weaponTier(floor)]
  const wMap = {}
  for (const [rar, w] of Object.entries(wt)) {
    wMap[rar] = Math.round(w * (rar === '稀有' || rar === '传说' ? rareMul : 1))
  }
  const byRar = { 普通: [], 精良: [], 稀有: [], 传说: [] }
  for (const w of WEAPONS) byRar[w.rarity].push(w)
  const rar = pickWeighted(wMap)
  const cand = byRar[rar].length ? byRar[rar] : WEAPONS
  return pick(cand)
}

// 生成 8 格商店库存：固定 1 张小号回理智药 + 2 把武器 + 5 件随机消耗品
// （消耗品池含全部理智药水，故其余格子也可能再刷出回理智的药）
export function buildShopStock(floor) {
  const stock = []
  const sanDef = POTIONS.find(p => p.id === SHOP_SAN_POTION_ID)
  stock.push({ type: T.POTION, def: sanDef, price: priceOf(sanDef), sold: false })
  for (let i = 0; i < 2; i++) {
    const def = pickWeaponByFloor(floor)
    stock.push({ type: T.WEAPON, def, price: priceOf(def), sold: false })
  }
  const pool = []
  POTIONS.filter(p => floor >= (p.floorMin || 1)).forEach(def => pool.push({ type: T.POTION, def }))
  ITEMS.filter(it => floor >= (it.floorMin || 1)).forEach(def => pool.push({ type: T.ITEM, def }))
  buffPoolForFloor(floor).forEach(def => pool.push({ type: T.BUFF, def }))
  const bag = shuffled(pool)
  while (stock.length < SHOP_SLOTS) {
    const e = bag.length ? bag.pop() : pool[Math.floor(Math.random() * pool.length)]
    stock.push({ type: e.type, def: e.def, price: priceOf(e.def), sold: false })
  }
  return shuffled(stock)
}

// 三选一奖励：仅卡牌奖励（武器/药水/道具/buff），从 4 种中取 3 种互不相同的
const REWARD_KINDS = ['weapon', 'potion', 'item', 'buff']
export function buildRewardChoices(floor) {
  return shuffled(REWARD_KINDS).slice(0, 3).map(kind => makeReward(kind, floor))
}
function makeReward(kind, floor) {
  switch (kind) {
    case 'weapon': return { kind, amount: 0, def: pickWeaponByFloor(floor) }
    case 'potion': return { kind, amount: 0, def: pick(POTIONS.filter(p => floor >= (p.floorMin || 1))) }
    case 'item':   return { kind, amount: 0, def: pick(ITEMS.filter(it => floor >= (it.floorMin || 1))) }
    case 'buff':   return { kind, amount: 0, def: pick(buffPoolForFloor(floor)) }
    default:       return { kind: 'weapon', amount: 0, def: pickWeaponByFloor(floor) }
  }
}
// 奖励展示文案（HUD 与日志共用，避免两处各写一份）
export function rewardText(rw) {
  if (!rw) return { name: '', desc: '', tag: '' }
  const d = rw.def
  switch (rw.kind) {
    case 'weapon': return { name: d.name, desc: `${d.type} 攻${d.atk} 耐${d.dur}`, tag: d.rarity }
    case 'potion': return { name: d.name, desc: d.healHp ? `生命 +${d.healHp}` : `理智 +${d.healSan}`, tag: '药水' }
    case 'item':   return { name: d.name, desc: itemText(d) || '道具', tag: '道具' }
    case 'buff':   return { name: d.name, desc: buffText(d) || '下次攻击生效', tag: 'Buff' }
    default:       return { name: '奖励', desc: '', tag: '' }
  }
}
// 奖励是否占用一张手牌（手牌已满时按类型直接使用/装备或禁选）
export function rewardTakesHandSlot(rw) {
  return rw && (rw.kind === 'weapon' || rw.kind === 'potion' || rw.kind === 'item' || rw.kind === 'buff')
}

// ---------- 效果描述（HUD 手牌/奖励共用，避免牌面只有类型名看不清效果） ----------
// buff 牌（一次性，绑定下次攻击）效果文案
export function buffText(def) {
  if (!def || !def.effect) return ''
  const e = def.effect
  const parts = []
  if (e.atk) parts.push(`攻击+${e.atk}`)
  if (e.lifesteal) parts.push(`吸血${Math.round(e.lifesteal * 100)}%`)
  if (e.ignoreCounter) parts.push('无视克制')
  if (e.bonus) parts.push(`额外+${e.bonus}伤害`)
  if (e.slowTarget) parts.push('目标减速')
  if (e.purify) parts.push('净化目标')
  if (e.sanNow) parts.push(`理智+${e.sanNow}`)
  if (e.noDurLoss) parts.push('攻击不耗耐久')
  if (e.forceCrit) parts.push('必定暴击')
  if (e.hpCost) parts.push(`失去${e.hpCost}生命`)
  if (e.thorns) parts.push(`受怪击-${e.thorns}`)
  return parts.join(' ')
}
// 道具（磨刀石/保养油/备用刀刃）效果文案
export function itemText(def) {
  if (!def) return ''
  if (def.buff === 'maintain3') return '3 次攻击免耐久'
  if (def.repair !== undefined) return `修理 +${def.repair} 耐久${def.fixBroken ? '（可修破损）' : ''}`
  return ''
}
