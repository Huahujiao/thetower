// Relic definitions are intentionally kept separate from the runtime.
// Add content here as data; the game state does not branch on individual relic ids.
import { randomInt } from '../game/core/rng.js'

export const RELIC_MAX_ACTIVE = 5

const ADD = 'add'
const PERCENT_ADD = 'percentAdd'
const MULTIPLY = 'multiply'

const BEFORE_ACTION = 10
const AFTER_ACTION = 60
const SECONDARY = 45
const DEATH = 50
const TURN_START = 70

function sanityRatio(state) {
  return Math.min(1, Math.max(0, state.player.san / Math.max(1, state.player.maxSan)))
}

function missingHealthRatio(state) {
  return Math.min(1, Math.max(0, (state.player.maxHp - state.player.hp) / Math.max(1, state.player.maxHp)))
}

function exitDistanceBonus(state, card) {
  if (!card) return 0
  const exits = state.board.filter((entry) => entry.type === 'exit' && entry.flipped)
  if (!exits.length) return 0
  const distance = Math.min(...exits.map((exit) => Math.max(Math.abs(exit.c - card.c), Math.abs(exit.r - card.r))))
  return distance >= 1 && distance <= 5 ? 6 - distance : 0
}

function reflectionEffect({ state, amount, source, attacker }) {
  return {
    id: `relic:reflection:${attacker?.uid || 'none'}`,
    phase: AFTER_ACTION,
    apply: () => {
      if (!attacker || (!['monster-attack', 'retaliation'].includes(source) && !source?.startsWith('monster-skill:'))) return
      const reflected = Math.floor(Math.max(0, amount) * 0.3)
      const dealt = state.dealDirectMonsterDamage(attacker, reflected)
      if (dealt) state.log.push(`反伤：${attacker.def.name} 受到 ${dealt} 点伤害。`)
    },
  }
}

function weaponHealEffect({ state, relic, amount }) {
  return {
    id: `relic:weapon-heal:${amount}`,
    phase: AFTER_ACTION,
    apply: () => {
      const weapons = state.equippedWeapons().filter((weapon) => weapon && weapon.curDur > 0)
      if (!weapons.length) return
      const weapon = weapons[randomInt(weapons.length)]
      relic.runtime.attackBonus ||= {}
      relic.runtime.attackBonus[weapon.uid] = (relic.runtime.attackBonus[weapon.uid] || 0) + 1
      state.log.push(`滋养之刃：${weapon.def.name} 攻击力 +1。`)
    },
  }
}

function brokenWeaponEffect({ state, relic, weapon, source = 'system' }) {
  return {
    id: `relic:broken-fury:resolve:${weapon?.uid || 'unknown'}`,
    phase: AFTER_ACTION,
    apply: () => {
      if (!weapon || weapon.curDur > 0) return
      if (!state.discardBrokenWeapon(weapon)) return

      // Prefer weapons currently held in the equipment slots. If none are
      // available, fall back to usable weapons in the backpack.
      const equipped = state.equippedWeapons()
        .filter((candidate) => candidate && candidate.uid !== weapon.uid && candidate.curDur > 0)
      const backpack = state.hand
        .filter((candidate) => candidate?.def?.atk !== undefined && candidate.uid !== weapon.uid && candidate.curDur > 0)
      const candidates = equipped.length ? equipped : backpack
      const target = candidates.length ? candidates[randomInt(candidates.length)] : null
      if (!target) {
        state.log.push('破刃余烬：没有其他可用武器，未获得攻击力加成。')
        return
      }
      relic.runtime.attackBonus ||= {}
      relic.runtime.attackBonus[target.uid] = (relic.runtime.attackBonus[target.uid] || 0) + 3
      state.log.push(`破刃余烬：${target.def.name} 攻击力 +3。`)
    },
    source,
  }
}

// The first content batch deliberately lives in data definitions. The core
// engine only knows how to dispatch hooks and modifiers; it never branches on
// these ids.
export const RELIC_DEFS = Object.freeze([
  {
    id: 'r_opening_pressure',
    name: '开路先机',
    desc: '当前回合每有一张可以翻开的未翻牌，攻击伤害 +1。',
    rarity: '精良',
    relic: true,
    price: 18,
    modifiers: {
      'attack:damage': ({ state }) => ({
        operation: ADD,
        value: state.flippableCards().length,
      }),
    },
  },
  {
    id: 'r_far_sight',
    name: '远视之眼',
    desc: '可翻开距离 2 以内的牌。',
    rarity: '普通',
    relic: true,
    price: 12,
    modifiers: { 'flip:range': [{ operation: ADD, value: 1 }] },
  },
  {
    id: 'r_double_edge',
    name: '双刃契约',
    desc: '你主动攻击以及该次反击的伤害均翻倍；敌人主动攻击不受影响。',
    rarity: '稀有',
    relic: true,
    price: 20,
    modifiers: {
      'attack:damage': [{ operation: MULTIPLY, value: 2 }],
      'damage:retaliation': [{ operation: MULTIPLY, value: 2 }],
    },
  },
  {
    id: 'r_guardian_gaze',
    name: '守望之眼',
    desc: '场上每有一个已翻开的存活敌人，你受到的伤害 -1。',
    rarity: '精良',
    relic: true,
    price: 18,
    modifiers: {
      'damage:incoming': ({ state, source }) => ({
        operation: ADD,
          value: ['monster-attack', 'retaliation'].includes(source) || source?.startsWith('monster-skill:')
            ? -state.monstersOnBoard().length
            : 0,
      }),
    },
  },
  {
    id: 'r_blood_memory',
    name: '血之记忆',
    desc: '对同一个敌人的后续攻击，每次额外造成 1 点伤害。',
    rarity: '精良',
    relic: true,
    price: 18,
    modifiers: {
      'attack:damage': ({ relic, card }) => ({
        operation: ADD,
        value: card ? (relic.runtime.hits?.[card.uid] || 0) : 0,
      }),
    },
    hooks: {
      attack: ({ relic, card }) => ({
        id: 'relic:blood-memory:record',
        phase: AFTER_ACTION,
        apply: () => {
          if (!card) return
          relic.runtime.hits ||= {}
          relic.runtime.hits[card.uid] = (relic.runtime.hits[card.uid] || 0) + 1
        },
      }),
    },
  },
  {
    id: 'r_broken_fury',
    name: '破刃余烬',
    desc: '耐久度为 0 的武器会自动丢弃，并随机使另一把可用武器攻击力 +3，优先手中的武器。',
    rarity: '精良',
    relic: true,
    price: 16,
    modifiers: {
      'weapon:power': ({ relic, weapon }) => ({
        operation: ADD,
        value: weapon ? (relic.runtime.attackBonus?.[weapon.uid] || 0) : 0,
      }),
    },
    hooks: {
      'weapon:broken': (context) => brokenWeaponEffect(context),
      'relic:activated': ({ state }) => ({
        id: 'relic:broken-fury:resolve-existing',
        phase: AFTER_ACTION,
        apply: () => {
          for (const weapon of [...state.equippedWeapons(), ...state.hand]) {
            if (weapon?.def?.atk !== undefined && weapon.curDur <= 0) {
              state.resolveWeaponBroken(weapon, 'relic:activated')
            }
          }
        },
      }),
    },
  },
  {
    id: 'r_key_resonance',
    name: '钥匙共鸣',
    desc: '本层每找到一个钥匙碎片，造成的伤害倍率 +0.3；进入下一层时重置。',
    rarity: '精良',
    relic: true,
    price: 20,
    modifiers: {
      'damage:outgoing': ({ state, relic }) => ({
        operation: PERCENT_ADD,
        phase: 'damage',
        value: relic.runtime.floor === state.floor ? (relic.runtime.keysFound || 0) * 0.3 : 0,
      }),
    },
    hooks: {
      'key:collected': ({ state, relic, amount = 1 }) => ({
        id: 'relic:key-resonance:count',
        phase: AFTER_ACTION,
        apply: () => {
          if (relic.runtime.floor !== state.floor) {
            relic.runtime.floor = state.floor
            relic.runtime.keysFound = 0
          }
          relic.runtime.keysFound = (relic.runtime.keysFound || 0) + amount
        },
      }),
      'floor:start': ({ state, relic }) => ({
        id: 'relic:key-resonance:reset',
        phase: AFTER_ACTION,
        apply: () => {
          relic.runtime.floor = state.floor
          relic.runtime.keysFound = 0
        },
      }),
    },
  },
  {
    id: 'r_bounty_mark',
    name: '猎杀印记',
    desc: '每击杀一个敌人，获得 1 金币。',
    rarity: '普通',
    relic: true,
    price: 14,
    hooks: {
      'monster:killed': ({ state }) => ({
        id: 'relic:bounty-mark:gold',
        phase: AFTER_ACTION,
        apply: () => {
          state.player.gold += 1
          state.log.push('猎杀印记：获得 1 金币。')
        },
      }),
    },
  },
  {
    id: 'r_blood_coin',
    name: '血债铸币',
    desc: '每第 10 次攻击，将仍存活的目标变为等同其当前生命的金币；按正常击杀处理，计数跨层累计。',
    rarity: '稀有',
    relic: true,
    price: 24,
    hooks: {
      attack: ({ state, relic, card, strikes, weapons }) => ({
        id: `relic:blood-coin:${card?.uid || 'none'}`,
        phase: DEATH,
        apply: () => {
          relic.runtime.attacks = (relic.runtime.attacks || 0) + 1
          if (relic.runtime.attacks % 10 !== 0 || !card || card.monsterHp <= 0) return
          const weapon = strikes?.find((strike) => !strike.skipped && strike.dmg > 0)?.weapon || weapons?.[0] || null
          state.convertMonsterToGold(card, { weapon, source: 'relic:blood-coin' })
        },
      }),
    },
  },
  {
    id: 'r_four_choices',
    name: '丰饶刻印',
    desc: '每层奖励选项数量 +1。',
    rarity: '精良',
    relic: true,
    price: 22,
    modifiers: { 'reward:choiceCount': [{ operation: ADD, value: 1 }] },
  },
  {
    id: 'r_cycle_armor',
    name: '循环壁垒',
    desc: '每 5 回合获得 5 点护甲。',
    rarity: '稀有',
    relic: true,
    price: 22,
    hooks: {
      'turn:start': ({ state }) => ({
        id: 'relic:cycle-armor:gain',
        phase: TURN_START,
        apply: () => {
          if (state.turn <= 0 || state.turn % 5 !== 0) return
          const gained = state.addArmor(5)
          if (gained) state.log.push('循环壁垒：护甲 +' + gained + '。')
        },
      }),
    },
  },
  {
    id: 'r_last_stand',
    name: '以逸待劳',
    desc: '满血时攻击倍率为 1.5；每损失完整 10% 生命，倍率降低 0.1。',
    rarity: '稀有',
    relic: true,
    price: 24,
    modifiers: {
      'attack:damage': ({ state }) => ({
        operation: PERCENT_ADD,
        phase: 'damage',
        value: Math.max(0, 1.5 - 0.1 * Math.floor(((state.player.maxHp - state.player.hp) / Math.max(1, state.player.maxHp)) * 10 + 1e-9)) - 1,
      }),
    },
  },
  {
    id: 'r_heavy_oath',
    name: '重击誓约',
    desc: '攻击伤害翻倍，但攻击后下一回合不能攻击。',
    rarity: '稀有',
    relic: true,
    price: 24,
    modifiers: { 'attack:damage': [{ operation: MULTIPLY, value: 2 }] },
    guards: {
      attack: ({ relic }) => relic.runtime.locked !== true,
    },
    hooks: {
      attack: ({ relic }) => ({
        id: 'relic:heavy-oath:lock',
        phase: AFTER_ACTION,
        apply: () => { relic.runtime.locked = true },
      }),
      'turn:start': ({ relic }) => ({
        id: 'relic:heavy-oath:unlock',
        phase: TURN_START,
        apply: () => { relic.runtime.locked = false },
      }),
    },
  },
  {
    id: 'r_reflecting_thorns',
    name: '荆棘回响',
    desc: '受到敌人攻击时反弹 30% 伤害；主动攻击时不触发。',
    rarity: '精良',
    relic: true,
    price: 18,
    hooks: {
      'damage:received': (context) => reflectionEffect(context),
    },
  },
  {
    id: 'r_blood_well',
    name: '鲜血回响',
    desc: '主动攻击造成伤害时，回复造成伤害 30% 的生命。',
    rarity: '精良',
    relic: true,
    price: 20,
    hooks: {
      'damage:dealt': ({ state, amount, source }) => {
        if (source !== 'attack' || amount <= 0) return null
        return {
          id: 'relic:blood-well:heal',
          phase: AFTER_ACTION,
          apply: () => {
            const healed = state.healPlayer(Math.floor(amount * 0.3), { source: 'relic:blood-well' })
            if (healed) state.log.push(`鲜血回响：回复 ${healed} 生命。`)
          },
        }
      },
    },
  },
  {
    id: 'r_evening_tide',
    name: '潮汐刻度',
    desc: '每 2 回合回复 2 点生命。',
    rarity: '普通',
    relic: true,
    price: 14,
    hooks: {
      'turn:start': ({ state }) => ({
        id: 'relic:evening-tide:heal',
        phase: TURN_START,
        apply: () => {
          if (state.turn > 0 && state.turn % 2 === 0) {
            const healed = state.healPlayer(2, { source: 'relic:evening-tide' })
            if (healed) state.log.push(`潮汐刻度：回复 ${healed} 生命。`)
          }
        },
      }),
    },
  },
  {
    id: 'r_victory_near',
    name: '胜利在望',
    desc: '出口已翻开时，敌人距离出口 1~5 格分别额外受到 5~1 点伤害。',
    rarity: '精良',
    relic: true,
    price: 20,
    modifiers: {
      'attack:damage': ({ state, card, target }) => ({
        operation: ADD,
        value: exitDistanceBonus(state, card || target),
      }),
    },
  },
  {
    id: 'r_berserker_heart',
    name: '狂战之心',
    desc: '生命越低，伤害越高；生命完全损失时最多获得 50% 增伤。',
    rarity: '稀有',
    relic: true,
    price: 22,
    modifiers: {
      'attack:damage': ({ state }) => ({
        operation: PERCENT_ADD,
        phase: 'damage',
        value: missingHealthRatio(state) * 0.5,
      }),
    },
  },
  {
    id: 'r_sanity_scavenge',
    name: '拾荒者之心',
    desc: '捡起一件物品时回复 1 点理智。',
    rarity: '普通',
    relic: true,
    price: 14,
    hooks: {
      'card:picked': ({ state }) => ({
        id: 'relic:sanity-scavenge:recover',
        phase: AFTER_ACTION,
        apply: () => {
          const restored = state.gainSanity(1, { source: 'relic:sanity-scavenge' })
          if (restored) state.log.push(`拾荒者之心：理智 +${restored}。`)
        },
      }),
    },
  },
  {
    id: 'r_clear_mind',
    name: '清明之眼',
    desc: '理智越高，伤害越高；满理智时伤害 +30%。',
    rarity: '精良',
    relic: true,
    price: 18,
    modifiers: {
      'attack:damage': ({ state }) => ({
        operation: PERCENT_ADD,
        phase: 'damage',
        value: sanityRatio(state) * 0.3,
      }),
    },
  },
  {
    id: 'r_unquiet_mind',
    name: '逆理之心',
    desc: '理智越低，伤害越高；理智为 0 时伤害 +30%。',
    rarity: '精良',
    relic: true,
    price: 18,
    modifiers: {
      'attack:damage': ({ state }) => ({
        operation: PERCENT_ADD,
        phase: 'damage',
        value: (1 - sanityRatio(state)) * 0.3,
      }),
    },
  },
  {
    id: 'r_healing_edge',
    name: '滋养之刃',
    desc: '每次回复生命时，使手中随机一把可用武器攻击力 +1。',
    rarity: '精良',
    relic: true,
    price: 20,
    modifiers: {
      'weapon:power': ({ relic, weapon }) => ({
        operation: ADD,
        value: weapon ? (relic.runtime.attackBonus?.[weapon.uid] || 0) : 0,
      }),
    },
    hooks: {
      'player:healed': (context) => context.amount > 0 ? weaponHealEffect(context) : null,
    },
  },
  {
    id: 'r_bomb_expert',
    name: '拆弹专家',
    desc: '翻开陷阱时无视其效果，并恢复最多 10 点理智和 5 点生命。',
    rarity: '精良',
    relic: true,
    price: 20,
    hooks: {
      'trap:before-trigger': ({ state, card, mutable }) => ({
        id: `relic:bomb-expert:${card?.uid || 'none'}`,
        phase: BEFORE_ACTION,
        apply: () => {
          if (!card || card.type !== 'trap' || !mutable) return
          mutable.cancelled = true
          const sanity = state.gainSanity(10, { source: 'relic:bomb-expert' })
          const health = state.healPlayer(5, { source: 'relic:bomb-expert' })
          state.log.push('拆弹专家：陷阱被解除，理智 +' + sanity + '，生命 +' + health + '。')
        },
      }),
    },
  },
  {
    id: 'r_no_mercy',
    name: '绝不手软',
    desc: '敌人生命越低，攻击它造成的伤害越高；目标空血时最多获得 50% 增伤。',
    rarity: '稀有',
    relic: true,
    price: 22,
    modifiers: {
      'attack:damage': ({ card, target }) => {
        const enemy = card || target
        const ratio = enemy?.def?.hp ? Math.max(0, Math.min(1, 1 - enemy.monsterHp / enemy.def.hp)) : 0
        return { operation: PERCENT_ADD, phase: 'damage', value: ratio * 0.5 }
      },
    },
  },
  {
    id: 'r_iron_wall',
    name: '铁壁刻印',
    desc: '每回合获得 3 点护甲。',
    rarity: '普通',
    relic: true,
    price: 16,
    hooks: {
      'turn:start': ({ state }) => ({
        id: 'relic:iron-wall:armor',
        phase: TURN_START,
        apply: () => {
          state.addArmor(3)
          state.log.push('铁壁刻印：护甲 +3。')
        },
      }),
    },
  },
  {
    id: 'r_gold_edge',
    name: '黄金锋芒',
    desc: '每持有 10 金币，使武器攻击力 +1。',
    rarity: '精良',
    relic: true,
    price: 20,
    modifiers: {
      'weapon:power': ({ state }) => ({
        operation: ADD,
        value: Math.floor(Math.max(0, state.player.gold) / 10),
      }),
    },
  },
  {
    id: 'r_backstab_shadow',
    name: '背袭之影',
    desc: '翻开敌人牌后，对其进行的第一次攻击不会受到反击。',
    rarity: '精良',
    relic: true,
    price: 20,
    hooks: {
      'card:revealed': ({ state, card }) => {
        if (card?.type !== 'monster') return null
        return {
          id: `relic:backstab-shadow:mark:${card.uid}`,
          phase: AFTER_ACTION,
          apply: () => {
            state.addCardStatus(card, { id: 'backstab', group: 'backstab', turns: null })
          },
        }
      },
    },
  },
  {
    id: 'r_peek_veil',
    name: '窥见薄纱',
    desc: '翻开一张牌时，可以查看其旁边随机一张未翻开的牌。',
    rarity: '普通',
    relic: true,
    price: 16,
    hooks: {
      'card:revealed': ({ state, card }) => ({
        id: `relic:peek-veil:peek:${card?.uid || 'none'}`,
        phase: AFTER_ACTION,
        apply: () => {
          const target = state.peekRandomNeighbor(card)
          if (target) state.log.push(`窥见薄纱：查看了旁边的 ${target.def.name}。`)
        },
      }),
    },
  },
  {
    id: 'r_war_cry',
    name: '战吼',
    desc: '累计击杀 10 个敌人时，翻开本层所有敌人；击杀计数跨层累计。',
    rarity: '稀有',
    relic: true,
    price: 24,
    hooks: {
      'monster:killed': ({ state, relic, noAttackUids }) => ({
        id: 'relic:war-cry:count',
        phase: AFTER_ACTION,
        apply: () => {
          relic.runtime.kills = (relic.runtime.kills || 0) + 1
          if (relic.runtime.kills % 10 !== 0) return
          state.log.push('战吼：翻开本层所有敌人！')
           const result = state.revealAllMonsters({ cause: 'relic:war-cry', sanCost: 0 })
           for (const uid of result) noAttackUids?.add(uid)
        },
      }),
    },
  },
  {
    id: 'r_splash_echo',
    name: '回响溅射',
    desc: '攻击时，对距离 2 以内随机一名已翻开的敌人造成一次溅射伤害；若范围内没有敌人，则翻开范围内一张牌。翻出敌人时按正常规则扣理智。',
    rarity: '精良',
    relic: true,
    price: 20,
    hooks: {
      attack: ({ state, card, strikes, noAttackUids }) => ({
        id: `relic:splash-echo:${card?.uid || 'none'}`,
        phase: SECONDARY,
        apply: () => {
          const strike = strikes?.find((entry) => !entry.skipped && entry.dmg > 0)
          if (!card || !strike) return
          const result = state.resolveRandomAttackSplash(card, strike.dmg, {
            radius: 2,
            weapon: strike.weapon,
            source: 'relic:splash-echo',
            cause: 'relic:splash-echo',
            noAttackUids,
          })
          for (const uid of result.noAttackUids || []) noAttackUids?.add(uid)
          if (result.type === 'damage') {
            state.log.push('回响溅射：' + result.card.def.name + ' 受到 ' + result.dealt + ' 点伤害。')
          } else if (result.type === 'reveal') {
            state.log.push('回响溅射：范围内翻开 ' + result.card.def.name + '。')
          }
        },
      }),
    },
  },
  {
    id: 'r_durability_fraud',
    name: '耐久欺诈',
    desc: '武器耐久度消耗翻倍，但耐久度降低不会降低攻击力。',
    rarity: '精良',
    relic: true,
    price: 20,
    modifiers: {
      'weapon:durabilityFactor': ({ weapon }) => weapon?.curDur > 0
        ? { operation: 'set', value: 1 }
        : null,
      'weapon:durabilityCost': [{ operation: ADD, value: 1 }],
    },
  },
  {
    id: 'r_curse_brand',
    name: '诅咒烙印',
    desc: '攻击时施加诅咒；5 回合后敌人受到 20 点伤害，同一敌人不可重复获得。',
    rarity: '精良',
    relic: true,
    price: 20,
    hooks: {
      attack: ({ state, card }) => ({
        id: `relic:curse-brand:apply:${card?.uid || 'none'}`,
        phase: SECONDARY,
        apply: () => {
          if (!card || card.monsterHp <= 0 || state.hasCardStatus(card, 'curse')) return
          state.addCardStatus(card, {
            id: 'curse', group: 'curse', amount: 20, turns: 5, stackRule: 'replace',
          })
          state.log.push(`${card.def.name} 被施加诅咒。`)
        },
      }),
    },
  },
  {
    id: 'r_void_banish',
    name: '虚空放逐',
    desc: '攻击后将敌人放逐 1 回合；放逐期间无法攻击或被攻击。',
    rarity: '精良',
    relic: true,
    price: 20,
    hooks: {
      attack: ({ state, card }) => ({
        id: `relic:void-banish:apply:${card?.uid || 'none'}`,
        phase: AFTER_ACTION,
        apply: () => {
          if (!card || card.monsterHp <= 0) return
          state.addCardStatus(card, { id: 'banish', group: 'banish', turns: 1, stackRule: 'replace' })
          state.log.push(`${card.def.name} 被放逐 1 回合。`)
        },
      }),
    },
  },
  {
    id: 'r_bleeding_mark',
    name: '流血印记',
    desc: '攻击使敌人流血 5 回合，每回合受到 2 点伤害；重复施加时刷新，不叠加。',
    rarity: '精良',
    relic: true,
    price: 20,
    hooks: {
      attack: ({ state, card }) => ({
        id: `relic:bleeding-mark:apply:${card?.uid || 'none'}`,
        phase: SECONDARY,
        apply: () => {
          if (!card || card.monsterHp <= 0) return
          state.addCardStatus(card, {
            id: 'bleed', group: 'bleed', amount: 2, turns: 5, stackRule: 'replace',
          })
          state.log.push(`${card.def.name} 被施加流血。`)
        },
      }),
    },
  },
  {
    id: 'r_quick_change',
    name: '迅捷换手',
    desc: '切换武器不消耗回合；切换后的下一次攻击伤害翻倍。',
    rarity: '稀有',
    relic: true,
    price: 22,
    modifiers: {
      'weapon:switchCostTurn': [{ operation: 'set', value: 0 }],
      'attack:damage': ({ relic }) => relic.runtime.nextAttack
        ? { operation: MULTIPLY, value: 2 }
        : null,
    },
    hooks: {
      'weapon:switched': ({ relic }) => ({
        id: 'relic:quick-change:arm',
        phase: AFTER_ACTION,
        apply: () => { relic.runtime.nextAttack = true },
      }),
      attack: ({ relic }) => ({
        id: 'relic:quick-change:consume',
        phase: AFTER_ACTION,
        apply: () => { relic.runtime.nextAttack = false },
      }),
    },
  },
  {
    id: 'r_shatter_splash',
    name: '破损溅射',
    desc: '耐久度低于最大值一半的武器攻击时，对目标周围一圈的其他敌人造成等额溅射伤害。',
    rarity: '精良',
    relic: true,
    price: 20,
    hooks: {
      attack: ({ state, card, strikes, noAttackUids }) => ({
        id: `relic:shatter-splash:${card?.uid || 'none'}`,
        phase: SECONDARY,
        apply: () => {
          if (!card || !Array.isArray(strikes)) return
          for (const strike of strikes) {
            const weapon = strike.weapon
            if (strike.skipped || strike.dmg <= 0 || !weapon || weapon.curDur >= weapon.maxDur / 2) continue
            const splashes = state.dealAreaMonsterDamage(card, strike.dmg, {
              radius: 1,
              channel: 'secondary:damage',
              source: 'relic:shatter-splash', noAttackUids,
            })
            for (const splash of splashes) {
              state.log.push(`${splash.card.def.name} 受到溅射伤害 ${splash.dealt}。`)
              if (splash.card.monsterHp <= 0 && !splash.card.dead) {
                state._onMonsterKilled(splash.card, weapon, { noAttackUids })
              }
            }
          }
        },
      }),
    },
  },
  {
    id: 'r_weapon_cycle',
    name: '武器轮换',
    desc: '每 3 回合随机生成一把武器，并尝试放入行囊。',
    rarity: '精良',
    relic: true,
    price: 18,
    hooks: {
      'turn:start': ({ state }) => ({
        id: 'relic:weapon-cycle:spawn',
        phase: TURN_START,
        apply: () => {
          if (state.turn <= 0 || state.turn % 3 !== 0) return
          state.spawnRandomWeapon({ source: 'relic:weapon-cycle' })
        },
      }),
    },
  },
  {
    id: 'r_death_blast',
    name: '死亡爆裂',
    desc: '敌人死亡时爆炸，翻开周围一圈的牌，并对周围敌人造成 2 点伤害。',
    rarity: '稀有',
    relic: true,
    price: 22,
    hooks: {
      'monster:killed': ({ state, card }) => ({
        id: `relic:death-blast:${card?.uid || 'none'}`,
        phase: AFTER_ACTION,
        apply: () => {
          if (!card) return
          state.revealCardsInRadius(card, {
            radius: 1,
            sanCost: 0,
            cause: 'relic:death-blast',
          })
          const blasts = state.dealAreaMonsterDamage(card, 2, {
            radius: 1,
            channel: 'secondary:damage',
            source: 'relic:death-blast',
          })
          for (const blast of blasts) {
            state.log.push(`${blast.card.def.name} 受到死亡爆裂伤害 ${blast.dealt}。`)
            if (blast.card.monsterHp <= 0 && !blast.card.dead) state._onMonsterKilled(blast.card, null)
          }
        },
      }),
    },
  },
  {
    id: 'r_sanity_shield',
    name: '理智护盾',
    desc: '理智可以抵挡伤害，1 点理智抵挡 1 点伤害；每次最多抵挡该次伤害的一半。',
    rarity: '稀有',
    relic: true,
    price: 22,
    hooks: {
      'damage:before': ({ state, amount }) => {
        const limit = Math.floor(Math.max(0, amount) / 2)
        if (limit <= 0 || state.player.san <= 0) return null
        return {
          id: 'relic:sanity-shield:absorb',
          phase: 10,
          apply: (context) => {
            const spent = state.spendSanity(Math.min(limit, state.player.san), {
              source: 'relic:sanity-shield',
            })
            const mutable = context.mutable || context
            mutable.amount = Math.max(0, mutable.amount - spent)
            mutable.sanityAbsorbed = (mutable.sanityAbsorbed || 0) + spent
          },
        }
      },
    },
  },
  {
    id: 'r_knockback',
    name: '冲撞余势',
    desc: '攻击后将目标敌人向随机方向推动一格；若撞到牌，翻开它并与目标交换位置。',
    rarity: '精良',
    relic: true,
    price: 20,
    hooks: {
      attack: ({ state, card }) => ({
        id: `relic:knockback:${card?.uid || 'none'}`,
        phase: SECONDARY,
        apply: () => {
          if (!card || card.monsterHp <= 0) return
          const result = state.pushCard(card, {
            cause: 'relic:knockback', revealCollision: true, revealCost: 0,
          })
          if (result.moved) state.log.push(`${card.def.name} 被冲撞余势推动了。`)
        },
      }),
    },
  },
  {
    id: 'r_slime_call',
    name: '黏液召唤',
    desc: '每 10 回合召唤一个史莱姆；没有空棋盘格时召唤失败。',
    rarity: '稀有',
    relic: true,
    price: 24,
    hooks: {
      'turn:start': ({ state }) => ({
        id: 'relic:slime-call',
        phase: TURN_START,
        apply: () => {
          if (state.turn > 0 && state.turn % 10 === 0) state.spawnSlime({ source: 'relic:slime-call' })
        },
      }),
    },
  },
  {
    id: 'r_slime_conversion',
    name: '死者新生',
    desc: '敌人死亡后变为你的史莱姆。',
    rarity: '稀有',
    relic: true,
    price: 24,
    hooks: {
      'monster:killed': ({ state, card }) => ({
        id: `relic:slime-conversion:${card?.uid || 'none'}`,
        phase: AFTER_ACTION,
        apply: () => {
          if (card) state.transformIntoSlime(card, { source: 'relic:slime-conversion' })
        },
      }),
    },
  },
  {
    id: 'r_random_shift',
    name: '混沌换位',
    desc: '攻击后将目标敌人与随机棋盘格交换位置。',
    rarity: '精良',
    relic: true,
    price: 20,
    hooks: {
      attack: ({ state, card }) => ({
        id: `relic:random-shift:${card?.uid || 'none'}`,
        phase: AFTER_ACTION,
        apply: () => {
          if (!card || card.monsterHp <= 0) return
          if (state.randomSwapCard(card, { cause: 'relic:random-shift' }).moved) {
            state.log.push(`${card.def.name} 与随机棋盘位置交换。`)
          }
        },
      }),
    },
  },
  {
    id: 'r_chain_assault',
    name: '连斩回响',
    desc: '攻击后按上、右、下、左、上右、下右、下左、上左的顺序寻找相邻敌人；击杀后继续攻击，后续攻击不消耗武器耐久。',
    rarity: '稀有',
    relic: true,
    price: 26,
    hooks: {
      attack: ({ state, card, chain, noAttackUids }) => {
        if (chain) return null
        return {
          id: `relic:chain-assault:${card?.uid || 'none'}`,
          phase: AFTER_ACTION,
          apply: () => {
            state.chainAdjacentAttacks(card, { source: '连斩回响', noAttackUids })
          },
        }
      },
    },
  },
  {
    id: 'r_calling_horn',
    name: '号令之声',
    desc: '主动技能：翻开本层所有敌人，并将它们拉到入口附近；只与附近牌交换位置，不翻开被交换的牌。',
    rarity: '稀有',
    relic: true,
    price: 26,
    activeSkill: {
      id: 'skill:calling-horn', name: '号令', icon: '⚑',
      description: '翻开所有敌人并拉到入口附近。', consumesTurn: true, retaliates: true, cooldown: 10,
    },
    actions: {
      'active-skill': ({ state }) => ({
        id: 'skill:calling-horn:resolve',
        phase: AFTER_ACTION,
        apply: (context) => {
          const result = state.pullMonstersNearEntry({
            radius: 1, sanCost: 0, cause: 'skill:calling-horn',
          })
          context.noAttackUids = result.noAttackUids
          if (result.moved) state.log.push(`号令：${result.moved} 个敌人被拉到入口附近。`)
        },
      }),
    },
  },
])

export const RELICS_BY_ID = Object.freeze(
  Object.fromEntries(RELIC_DEFS.map((def) => [def.id, def])),
)

export function getRelicDef(id) {
  return RELICS_BY_ID[id] || null
}

export function relicText(def) {
  if (!def) return { name: '', desc: '', rarity: '' }
  return {
    name: def.name || def.id,
    desc: def.desc || '',
    rarity: def.rarity || '',
  }
}

// Offers only exclude relics already collected in this run. Unselected or
// unpurchased offers remain available for later encounters.
export function buildRelicChoices({ count = 3, collected = [], defs = RELIC_DEFS } = {}) {
  const excluded = new Set(collected)
  const pool = defs.filter((def) => def && def.id && !excluded.has(def.id)).slice()
  const choices = []
  while (pool.length && choices.length < count) {
    choices.push(pool.splice(randomInt(pool.length), 1)[0])
  }
  return choices
}
