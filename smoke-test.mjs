// 黑塔 M2+M3 引擎冒烟测试 —— 纯逻辑（无 Three/DOM）在 Node 中跑通全系统
// 目的：vite build 无法捕获运行时错误，这里用真实 API 驱动来验证。
import { GameState } from './src/game/state.js'

// ---- localStorage 垫片（让存档/读档真实生效，便于测试序列化往返） ----
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

const T = { MONSTER: 'monster', WEAPON: 'weapon', POTION: 'potion', ITEM: 'item', BUFF: 'buff', GOLD: 'gold', KEY: 'key', EXIT: 'exit', ENTRY: 'entry' }

let exceptions = 0
function guard(label, fn) {
  try { return fn() }
  catch (e) { exceptions++; console.error(`❌ [${label}] 抛出异常:`, e && e.stack || e) }
}

function ensureArmed(s) {
  if (s.armedSlot !== null && s.equip[s.armedSlot] && s.equip[s.armedSlot].curDur > 0) return true
  const i = s.equip.findIndex((w) => w && w.curDur > 0)
  if (i >= 0) { if (s.armedSlot !== i) s.armWeapon(i); return true }
  const hi = s.hand.findIndex((h) => h && h.def && h.def.atk !== undefined)
  if (hi >= 0) { s.selectHand(hi); const tgt = s.equip.findIndex((w) => !w); s.switchToEquip(tgt >= 0 ? tgt : 0); return s.armedSlot !== null && s.equip[s.armedSlot] && s.equip[s.armedSlot].curDur > 0 }
  return false
}

function botStep(s) {
  if (s.gameOver) return 'over'
  const mons = s.monstersOnBoard()
  if (mons.length && ensureArmed(s)) {
    const bi = s.hand.findIndex((h) => h && h.def && h.def.effect)
    if (bi >= 0 && Math.random() < 0.25) s.useBuff(bi)
    if (s.armedSlot !== null && s.equip[s.armedSlot] && s.equip[s.armedSlot].curDur > 0) {
      s.attack(mons[Math.floor(Math.random() * mons.length)].uid); return 'attack'
    }
  }
  const ii = s.hand.findIndex((h) => h && h.def && (h.def.repair || h.def.buff))
  if (ii >= 0 && Math.random() < 0.15) {
    const tw = s.equip.find((w) => w && w.curDur < w.maxDur) || s.equip.find((w) => w)
    if (tw) { s.useItem(ii); if (s.itemTargetMode !== null) s.applyItemToWeapon(tw.uid); return 'item' }
  }
  const hi = s.hand.findIndex((h) => h && h.def && h.def.atk !== undefined)
  if (hi >= 0 && s.hand.length >= 7) { s.selectHand(hi); const tgt = s.equip.findIndex((w) => !w); s.switchToEquip(tgt >= 0 ? tgt : 0) }
  if (s.player.hp <= 8) {
    const pi = s.hand.findIndex((h) => h && h.def && h.def.healHp !== undefined)
    if (pi >= 0) { s.usePotion(pi); return 'potion' }
  }
  if (s.exitsActivated()) {
    const ex = s.board.find((c) => c.type === T.EXIT && c.flipped && !c.dead)
    if (ex) { s.enterExit(ex.uid); return 'exit' }
    if (s.shop && s.shop.open) {
      if (s.player.gold >= 5) s.shopSan()
      const w = s.equip.find((x) => x && x.curDur < x.maxDur)
      if (w && s.player.gold > 0) s.shopRepair(w.uid)
      s.enterNextFloor(); return 'nextfloor'
    }
  }
  const cand = s.board.filter((c) => !c.flipped && !c.dead && s.isAdjacentToFlipped(c))
  if (cand.length) {
    if (s.hand.length >= 10) { const di = s.hand.findIndex((h) => h && !h.def.atk); if (di >= 0) s.discard(di) }
    s.flip(cand[Math.floor(Math.random() * cand.length)].uid); return 'flip'
  }
  return 'stuck'
}

// 测试 1：自动机器人多局（翻牌/战斗/装备/Buff/道具/药水/出口/商店/换层/疯狂/污染 全覆盖）
console.log('\n=== 测试 1：自动机器人多局 ===')
const runs = 6
let wins = 0, deaths = 0, stuck = 0, maxFloor = 1
for (let run = 0; run < runs; run++) {
  guard(`run${run}`, () => {
    const s = new GameState()
    let steps = 0
    while (!s.gameOver && steps < 40000) { const r = botStep(s); steps++; if (r === 'stuck') break }
    if (s.win) wins++; else if (s.gameOver) deaths++; else stuck++
    maxFloor = Math.max(maxFloor, s.floor)
    console.log(`  局 ${run}: 结局=${s.win ? '通关🎉' : s.gameOver ? '死亡☠' : '卡住'} 到达层=${s.floor} 步数=${steps} HP=${s.player.hp} 理智=${s.player.san} 金币=${s.player.gold}`)
  })
}
console.log(`  → 通关 ${wins} / 死亡 ${deaths} / 卡住 ${stuck}；最高到达第 ${maxFloor} 层`)

// 测试 2：确定性逐层推进 1→7 + 击杀 Boss（胜利路径 + Boss 轮换 + 塔威计时 + 全 7 层串联）
console.log('\n=== 测试 2：确定性逐层推进 1→7 + 击杀 Boss ===')
guard('walk', () => {
  const s = new GameState()
  for (let f = 1; f <= 6; f++) {
    // 直接满足钥匙需求并激活出口（真实玩法中出口牌需先翻开）
    s.player.keys = s.player.keysNeeded
    const exit = s.board.find((c) => c.type === T.EXIT && !c.dead)
    if (!exit) throw new Error(`第 ${f} 层未生成出口牌（keysNeeded=${s.player.keysNeeded}）`)
    if (!s.exitsActivated()) throw new Error(`第 ${f} 层 exitsActivated 失败`)
    exit.flipped = true // 模拟玩家已翻开出口牌
    s.enterExit(exit.uid)
    if (!s.shop || !s.shop.open) throw new Error(`第 ${f} 层激活出口后未进入修整商店`)
    if (s.player.gold >= 5) s.shopSan()
    const w = s.equip.find((x) => x && x.curDur < x.maxDur)
    if (w && s.player.gold > 0) s.shopRepair(w.uid)
    const before = s.floor
    s.enterNextFloor()
    if (s.floor !== before + 1) throw new Error(`第 ${f} 层 enterNextFloor 未推进（${before}->${s.floor}）`)
    if (s.shop) throw new Error(`第 ${f + 1} 层进入后修整商店未关闭`)
    console.log(`  第 ${f} 层 → 第 ${s.floor} 层 OK（环境 ${s._mod.label || '无'}）`)
  }
  // 现在在第 7 层（Boss 层）
  if (!s.hasBoss()) throw new Error('第 7 层未生成 Boss')
  console.log(`  到达第 7 层，Boss 存在，shop=${JSON.stringify(s.shop)}`)
  if (s.shop) throw new Error('Boss 层不应残留修整商店（Boss 层无出口）')
  // 给一把强力武器并击杀 Boss
  s.equip[0] = { uid: 990001, def: { id: 't', name: '测试巨剑', type: '劈砍', atk: 50, tags: [] }, tags: [], curDur: 10, maxDur: 10, maintain: 0, pollutAtk: 0 }
  const boss = s.board.find((c) => c.type === T.MONSTER && c.def.tier === 'B')
  boss.flipped = true // 真实玩法中需先翻开 Boss 卡才能攻击
  boss.monsterHp = 6
  s.player.hp = 200; s.player.maxHp = 200
  let g = 0
  while (!s.gameOver && g < 50) { s.armWeapon(0); s.attack(boss.uid); g++ }
  if (!s.win) throw new Error(`击杀 Boss 后未判定胜利（win=${s.win}, gameOver=${s.gameOver}）`)
  console.log(`  → Boss 击杀，win=${s.win}，存档已清空=${store.get('heita_save_v1') === undefined}`)
})

// 测试 3：强制击杀 Boss 输入边界（怪物弱点轮换 / 塔威 / 狂暴）
console.log('\n=== 测试 3：Boss 机制边界 ===')
guard('boss', () => {
  const s = new GameState()
  s.floor = 7; s._pendingNextMod = null; s._startFloor()
  const boss = s.board.find((c) => c.type === T.MONSTER && c.def.tier === 'B')
  if (!boss) throw new Error('第 7 层未生成 Boss')
  boss.flipped = true // 真实玩法中需先翻开 Boss 卡才能攻击
  s.equip[0] = { uid: 990002, def: { id: 't2', name: '测试斧', type: '钝击', atk: 40, tags: [] }, tags: [], curDur: 20, maxDur: 20, maintain: 0, pollutAtk: 0 }
  s.armedSlot = 0; s.player.hp = 300; s.player.maxHp = 300
  const before = boss.monsterHp
  // 翻几张相邻牌推进回合，触发 Boss 轮换与塔威计时
  const adj = s.board.filter((c) => !c.flipped && !c.dead && s.isAdjacentToFlipped(c))
  for (const c of adj.slice(0, 5)) s.flip(c.uid)
  let g = 0
  while (!s.gameOver && g < 80) { s.armWeapon(0); s.attack(boss.uid); g++ }
  if (!s.win) throw new Error('Boss 机制边界测试未通关')
  console.log(`  → 通过 Boss 轮换/塔威/狂暴路径，win=${s.win}`)
})

// 测试 4：存读档往返
console.log('\n=== 测试 4：存档序列化往返 ===')
guard('save-load', () => {
  const a = new GameState()
  a.player.hp = 999; a.player.maxHp = 999 // 避免测试中死亡清档，确保存档可回读
  let steps = 0
  // 限定步数在安全区间：足够走完翻牌/战斗/装备/出口/商店若干次，但不会推进到 Boss 层致死清档
  while (!a.gameOver && steps < 30) { const r = botStep(a); steps++; if (r === 'stuck') break }
  if (a.gameOver) throw new Error('测试 4 在限定步数内竟已结束（harness 步数需调小）')
  if (!store.has('heita_save_v1')) throw new Error('测试 4 游玩后未写入存档（_save 未生效）')
  const boardLen = a.board.length, floor = a.floor, hp = a.player.hp, gold = a.player.gold, san = a.player.san
  const b = new GameState() // 自动从 localStorage 读档
  const ok = b._loaded === true && b.board.length === boardLen && b.floor === floor
  console.log(`  → 存档读回: floor ${floor}->${b.floor}, 棋盘 ${boardLen}->${b.board.length}, HP ${hp}->${b.player.hp}, 理智 ${san}->${b.player.san}, 金币 ${gold}->${b.player.gold}, _loaded=${b._loaded}`)
  if (!ok) throw new Error('存读档往返不一致')
  botStep(b)
  console.log('  → 读档后继续行动无异常 ✅')
})

// 测试 5：情绪系统（周期 roll + 理智比例影响偏向）
console.log('\n=== 测试 5：情绪系统 ===')
guard('emotion', () => {
  const s = new GameState()
  let steps = 0
  while (s.turn < 6 && steps < 1000) { const r = botStep(s); steps++; if (r === 'stuck' || s.gameOver) break }
  if (!s.emotionDef()) throw new Error('前 6 回合未 roll 出情绪状态')

  const tally = (san) => {
    let bad = 0, total = 0
    for (let i = 0; i < 600; i++) { s.player.san = san; s.player.maxSan = 30; s._rollEmotion(); if (s.emotionDef().tone === 'bad') bad++; total++ }
    return bad / total
  }
  const lowBad = tally(0)
  const highBad = tally(30)
  console.log(`  低理智(0)负面率=${(lowBad * 100).toFixed(0)}%  高理智(30)负面率=${(highBad * 100).toFixed(0)}%`)
  if (lowBad < 0.5) throw new Error('低理智未显著偏向负面情绪')
  if (highBad > 0.4) throw new Error('高理智负面率过高（应偏正面）')
})

console.log(`\n=== 结果：捕获异常 ${exceptions} 个 ===`)
if (exceptions > 0) process.exit(1)
console.log('✅ 所有引擎冒烟测试通过（无运行时异常）')
