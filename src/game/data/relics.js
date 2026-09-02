import { DAMAGE_STAGES, damageModifier } from '../rules/modifiers.js'
import { manhattan, neighbors8 } from '../core/geometry.js'

function fullHealthMultiplier(player) {
  if (!player?.maxHp || player.hp < player.maxHp / 2) return 1
  const missingTenths = Math.floor(Math.max(0, player.maxHp - player.hp) / (player.maxHp / 10))
  return Math.max(1, 1.5 - missingTenths * 0.1)
}

function berserkerMultiplier(player) {
  if (!player?.maxHp) return 1
  const missingHealth = Math.max(0, Number(player.maxHp) - (Number(player.hp) || 0))
  return Math.min(5, 1 + Math.floor(missingHealth / 5) * 0.5)
}

function relicState(run, id) {
  if (!run.relicRuntime[id] || typeof run.relicRuntime[id] !== 'object') run.relicRuntime[id] = {}
  return run.relicRuntime[id]
}

function reachedAttackCount(run, id, threshold) {
  if (!run) return false
  const state = relicState(run, id)
  state.attacks = (Math.max(0, Number(state.attacks) || 0) % threshold) + 1
  if (state.attacks < threshold) return false
  state.attacks = 0
  return true
}

export const RELIC_DEFS = Object.freeze([
  {
    id: 'r-packed-core',
    name: '\u6ee1\u8f7d\u6838\u5fc3',
    description: '\u80cc\u5305\u5360\u6ee1\u65f6\uff0c\u653b\u51fb\u4f24\u5bb3\u00d71.5\u3002',
    damageModifiers: ({ run }) => run?.backpack.usedCells === run?.backpack.capacity
      ? [damageModifier(DAMAGE_STAGES.MULTIPLY, 1.5, 'relic:packed-core')]
      : [],
  },
  {
    id: 'r-empty-core',
    name: '\u7a7a\u56ca\u72c2\u60f3',
    description: '\u80cc\u5305\u4e3a\u7a7a\u65f6\uff0c\u653b\u51fb\u4f24\u5bb3\u00d73\u3002',
    damageModifiers: ({ run }) => run?.backpack.usedCells === 0
      ? [damageModifier(DAMAGE_STAGES.MULTIPLY, 3, 'relic:empty-core')]
      : [],
  },
  {
    id: 'r-backline-ricochet',
    name: '\u5f39\u9053\u6298\u5c04',
    description: '\u6bcf\u6b21\u653b\u51fb\u540e\uff0c\u5bf9\u76ee\u6807\u8eab\u540e\u7b2c\u4e00\u683c\u9020\u6210\u540c\u7b49\u4f24\u5bb3\uff0c\u82e5\u8be5\u683c\u672a\u7ffb\u5f00\u5219\u540c\u65f6\u7ffb\u5f00\u3002',
    events: {
      'attack:hit': ({ run, enemy, damage }) => run?._ricochetBehind(enemy, damage)
        ? [{ log: '\u5f39\u9053\u6298\u5c04\uff1a\u653b\u51fb\u4e86\u76ee\u6807\u8eab\u540e\u7684\u5361\u724c\u3002' }]
        : [],
    },
  },
  {
    id: 'r-long-flip',
    name: '\u8fdc\u89c1\u6307\u595d',
    description: '\u53ef\u4ee5\u7ffb\u5f00\u4e0e\u89d2\u8272\u76f4\u7ebf\u8ddd\u79bb\u4e0d\u8d85\u8fc7 2 \u683c\u7684\u5361\u724c\u3002',
  },
  {
    id: 'r-unseen-force',
    name: '\u672a\u89c1\u4e4b\u529b',
    description: '\u6bcf\u6709 1 \u5f20\u5f53\u524d\u53ef\u7ffb\u5f00\u7684\u5361\u724c\uff0c\u653b\u51fb +1\u3002',
    damageModifiers: ({ run }) => {
      const bonus = run?.countFlippableCards?.() || 0
      return bonus ? [damageModifier(DAMAGE_STAGES.FLAT, bonus, 'relic:unseen-force')] : []
    },
  },
  {
    id: 'r-side-glance',
    name: '\u4fa7\u76ee\u5fae\u5149',
    description: '\u6bcf\u6b21\u7ffb\u5f00\u5361\u724c\u65f6\uff0c\u968f\u673a\u7a83\u89c6\u5176 8 \u90bb\u57df\u4e2d 1 \u5f20\u672a\u7ffb\u724c\uff08\u534a\u900f\u660e\u663e\u793a\uff09\u3002',
    events: {
      'card:revealed': ({ run, room, position }) => {
        if (!run || !room || !position) return []
        const candidates = neighbors8(position, room.width, room.height)
          .filter((candidate) => !room.isRevealed(candidate))
        if (!candidates.length) return []
        const target = candidates[Math.floor(run.random() * candidates.length)]
        room.tile(target).peeked = true
        return [{ log: '\u4fa7\u76ee\u5fae\u5149\uff1a\u7a83\u89c6\u4e86\u4e00\u5f20\u90bb\u8fd1\u5361\u724c\u3002' }]
      },
    },
  },
  {
    id: 'r-delay-spark',
    name: '\u8fdf\u6ede\u706b\u79cd',
    description: '\u7ffb\u5f00\u654c\u4eba\u724c\u65f6\uff0c\u5176\u884c\u52a8\u5ef6\u8fdf +1\u3002',
    events: {
      'enemy:revealed': ({ enemy }) => {
        if (enemy) enemy.actionDelay = Math.max(0, Number(enemy.actionDelay) || 0) + 1
        return []
      },
    },
  },
  {
    id: 'r-double-edged-fate',
    name: '\u53cc\u5203\u547d\u8fd0',
    description: '\u9020\u6210\u7684\u4f24\u5bb3\u4e0e\u53d7\u5230\u7684\u4f24\u5bb3\u90fd\u00d72\u3002',
    damageModifiers: () => [damageModifier(DAMAGE_STAGES.MULTIPLY, 2, 'relic:double-edged-fate')],
  },
  {
    id: 'r-repeat-strike',
    name: '\u8fde\u65a9\u523b\u75d5',
    description: '\u5bf9\u540c\u4e00\u654c\u4eba\u7684\u8fde\u7eed\u653b\u51fb\uff0c\u6bcf\u6b21\u4f24\u5bb3\u9012\u589e 1 \u70b9\u3002',
    damageModifiers: ({ run, target }) => {
      const state = run?.relicRuntime?.['r-repeat-strike']
      const bonus = state?.targetId === target?.id ? Math.max(0, Number(state.hits) || 0) : 0
      return bonus ? [damageModifier(DAMAGE_STAGES.FLAT, bonus, 'relic:repeat-strike')] : []
    },
    events: {
      'attack:hit': ({ run, enemy, damage }) => {
        if (!run || !enemy || damage <= 0) return []
        const state = relicState(run, 'r-repeat-strike')
        state.hits = state.targetId === enemy.id ? (Number(state.hits) || 0) + 1 : 1
        state.targetId = enemy.id
        return []
      },
    },
  },
  {
    id: 'r-blood-prism',
    name: '\u996e\u8840\u68f1\u955c',
    description: '\u6bcf\u6b21\u653b\u51fb\u540e\uff0c\u56de\u590d\u9020\u6210\u4f24\u5bb3\u7684 30%\uff08\u5411\u4e0b\u53d6\u6574\uff09\u3002',
    events: {
      'attack:hit': ({ damage }) => {
        const amount = Math.floor(Math.max(0, damage || 0) * 0.3)
        return amount ? [{ type: 'heal', amount, log: '\u996e\u8840\u68f1\u955c\uff1a\u56de\u590d ' + amount + ' \u70b9\u751f\u547d\u3002' }] : []
      },
    },
  },
  {
    id: 'r-tide-heart',
    name: '\u6f6e\u6c50\u5fc3\u810f',
    description: '\u6bcf\u53d1\u8d77 2 \u6b21\u653b\u51fb\uff0c\u6062\u590d 2 \u70b9\u751f\u547d\u3002',
    events: {
      'attack:started': ({ run }) => reachedAttackCount(run, 'r-tide-heart', 2)
        ? [{ type: 'heal', amount: 2, log: '\u6f6e\u6c50\u5fc3\u810f\uff1a\u56de\u590d 2 \u70b9\u751f\u547d\u3002' }]
        : [],
    },
  },
  {
    id: 'r-bounty-tax',
    name: '\u730e\u91d1\u7a0e',
    description: '\u6bcf\u51fb\u8d25 1 \u540d\u654c\u4eba\uff0c\u83b7\u5f97 1 \u91d1\u5e01\u3002',
    events: {
      'enemy:killed': () => [{ type: 'gold', amount: 1, log: '\u730e\u91d1\u7a0e\uff1a\u83b7\u5f97 1 \u91d1\u5e01\u3002' }],
    },
  },
  {
    id: 'r-healer-forge',
    name: '\u7597\u6108\u70bc\u51b6',
    description: '\u6bcf\u6b21\u56de\u590d\u751f\u547d\u65f6\uff0c\u968f\u673a\u4f7f 1 \u628a\u5df2\u88c5\u5907\u6b66\u5668\u653b\u51fb +1\u3002',
    events: {
      'player:healed': ({ run }) => {
        const weapons = run?.equippedWeapons || []
        if (!weapons.length) return []
        const weapon = weapons[Math.floor(run.random() * weapons.length)]
        weapon.attack = Math.max(0, Number(weapon.attack) || 0) + 1
        return [{ log: `\u7597\u6108\u70bc\u51b6\uff1a${weapon.name}\u653b\u51fb +1\u3002` }]
      },
    },
  },
  {
    id: 'r-perfect-edge',
    name: '\u65e0\u4f24\u950b\u8292',
    description: '\u6ee1\u8840\u65f6\u4f24\u5bb3\u00d71.5\uff1b\u6bcf\u635f\u5931 10% \u751f\u547d\u51cf 0.1 \u500d\uff0c\u534a\u8840\u53ca\u4ee5\u4e0b\u65e0\u52a0\u6210\u3002',
    damageModifiers: ({ player }) => {
      const multiplier = fullHealthMultiplier(player)
      return multiplier > 1 ? [damageModifier(DAMAGE_STAGES.MULTIPLY, multiplier, 'relic:perfect-edge')] : []
    },
  },
  {
    id: 'r-berserker-oath',
    name: '\u72c2\u6218\u58eb\u4e4b\u8a93',
    description: '\u6bcf\u635f\u5931 5 \u70b9\u751f\u547d\uff0c\u653b\u51fb\u4f24\u5bb3\u500d\u7387 +0.5\uff0c\u6700\u9ad8\u4e3a \u00d75\u3002',
    damageModifiers: ({ player }) => [damageModifier(DAMAGE_STAGES.MULTIPLY, berserkerMultiplier(player), 'relic:berserker-oath')],
  },
  {
    id: 'r-armor-echo',
    name: '\u7532\u80c4\u56de\u54cd',
    description: '\u6bcf\u6b21\u653b\u51fb\u540e\u83b7\u5f97 3 \u70b9\u62a4\u7532\u3002',
    events: {
      'attack:hit': () => [{ type: 'armor', amount: 3, log: '\u7532\u80c4\u56de\u54cd\uff1a\u62a4\u7532 +3\u3002' }],
    },
  },
  {
    id: 'r-coinweight',
    name: '\u94b1\u5e01\u538b\u8231',
    description: '\u6bcf\u6301\u6709 10 \u91d1\u5e01\uff0c\u653b\u51fb +1\u3002',
    damageModifiers: ({ player }) => {
      const bonus = Math.floor(Math.max(0, Number(player?.gold) || 0) / 10)
      return bonus ? [damageModifier(DAMAGE_STAGES.FLAT, bonus, 'relic:coinweight')] : []
    },
  },
  {
    id: 'r-arsenal-gallery',
    name: '\u519b\u68b0\u9648\u5217',
    description: '\u80cc\u5305\u4e2d\u6709 7 \u628a\u53ca\u4ee5\u4e0a\u6b66\u5668\u65f6\uff0c\u4f24\u5bb3\u00d71.7\u3002',
    damageModifiers: ({ run }) => (run?.backpack.items.filter((item) => item.type === 'weapon').length || 0) >= 7
      ? [damageModifier(DAMAGE_STAGES.MULTIPLY, 1.7, 'relic:arsenal-gallery')]
      : [],
  },
  {
    id: 'r-opportunity-strike',
    name: '\u653b\u5176\u4e0d\u5907',
    description: '\u5f53\u654c\u4eba\u7684\u666e\u653b\u4e0e\u4e3b\u52a8\u6280\u80fd\u90fd\u5904\u4e8e\u51b7\u5374\u4e2d\u65f6\uff0c\u5bf9\u5176\u4f24\u5bb3 +5\u3002',
    damageModifiers: ({ target }) => target?.activeSkill && target.attackCooldown > 0 && target.activeSkillCooldown > 0
      ? [damageModifier(DAMAGE_STAGES.FLAT, 5, 'relic:opportunity-strike')]
      : [],
  },
  {
    id: 'r-counter-ember',
    name: '\u53cd\u5236\u4f59\u70ec',
    description: '\u623f\u95f4\u5185\u4efb\u4f55\u654c\u4eba\u65bd\u653e\u4e3b\u52a8\u6280\u80fd\u65f6\uff0c\u83b7\u5f97 3 \u70b9\u62a4\u7532\u3002',
    events: {
      'enemy:active-skill': () => [{ type: 'armor', amount: 3, log: '\u53cd\u5236\u4f59\u70ec\uff1a\u62a4\u7532 +3\u3002' }],
    },
  },
  {
    id: 'r-timely-disposal',
    name: '\u53ca\u65f6\u5904\u7406',
    description: '\u51fb\u6740\u201c\u4e3b\u52a8\u6280\u80fd\u53ef\u7acb\u5373\u65bd\u653e\u201d\u7684\u654c\u4eba\u65f6\uff0c\u56de\u590d 1 \u70b9\u751f\u547d\u5e76\u83b7\u5f97 1 \u91d1\u5e01\u3002',
    events: {
      'enemy:killed': ({ enemy }) => enemy?.activeSkill && (Number(enemy.activeSkillCooldown) || 0) === 0
        ? [
            { type: 'heal', amount: 1, log: '\u53ca\u65f6\u5904\u7406\uff1a\u56de\u590d 1 \u70b9\u751f\u547d\u3002' },
            { type: 'gold', amount: 1, log: '\u53ca\u65f6\u5904\u7406\uff1a\u83b7\u5f97 1 \u91d1\u5e01\u3002' },
          ]
        : [],
    },
  },
  {
    id: 'r-harmonic-echo',
    name: '\u540c\u8c03\u4f59\u54cd',
    description: '\u4ee5\u5c5e\u6027\u514b\u5236\u51fb\u6740\u654c\u4eba\u65f6\uff0c\u5f53\u524d\u6b66\u5668\u6062\u590d 1 \u70b9\u8010\u4e45\u3002',
    events: {
      'attack:enemy-defeated': ({ weapon, countered, finalStrike }) => countered && !finalStrike && weapon?.type === 'weapon'
        ? [{ type: 'repair', weapon, amount: 1, log: '\u540c\u8c03\u4f59\u54cd\uff1a\u6b66\u5668\u8010\u4e45 +1\u3002' }]
        : [],
    },
  },
  {
    id: 'r-apprentice-mark',
    name: '\u5b66\u5f92\u523b\u5370',
    description: '\u6bcf\u5c42\u9996\u6b21\u4ee5\u6b66\u5668\u51fb\u6740\u4e00\u79cd\u654c\u4eba\u65f6\uff0c\u51fb\u6740\u624b\u7684\u638c\u63a7 +1\u3002',
    events: {
      'attack:enemy-defeated': ({ run, enemy, hand }) => {
        if (!run || !enemy?.enemyId || !Number.isInteger(hand)) return []
        const state = relicState(run, 'r-apprentice-mark')
        const key = `${run.currentRoom?.floor || 0}:${enemy.enemyId}`
        if (state[key]) return []
        state[key] = true
        run.player.mastery[hand] = Math.max(0, Number(run.player.mastery[hand]) || 0) + 1
        return [{ log: '\u5b66\u5f92\u523b\u5370\uff1a\u638c\u63a7 +1\u3002' }]
      },
    },
  },
  {
    id: 'r-last-stand',
    name: '\u7edd\u5883\u4fdd\u9669',
    description: '\u6bcf\u4e2a\u623f\u95f4 1 \u6b21\uff0c\u53d7\u5230\u81f4\u547d\u4f24\u5bb3\u65f6\u4fdd\u7559 1 \u70b9\u751f\u547d\uff0c\u5e76\u83b7\u5f97 5 \u70b9\u62a4\u7532\u3002',
  },
  {
    id: 'r-clearing-protocol',
    name: '\u6e05\u9053\u534f\u8bae',
    description: '\u51fb\u8d25\u654c\u4eba\u65f6\uff0c\u82e5\u623f\u95f4\u6ca1\u6709\u5176\u4ed6\u5df2\u7ffb\u5f00\u7684\u654c\u4eba\uff0c\u968f\u673a\u7ffb\u5f00 1 \u5f20\u672a\u7ffb\u724c\u3002',
    events: {
      'enemy:killed': ({ run }) => {
        const room = run?.currentRoom
        const hasOtherRevealedEnemy = room && [...room.entities.values()]
          .some((entity) => entity.kind === 'enemy' && room.isRevealed(entity.pos))
        if (!room || hasOtherRevealedEnemy || !run._revealRandomHidden('relic:clearing-protocol')) return []
        return [{ log: '\u6e05\u9053\u534f\u8bae\uff1a\u968f\u673a\u7ffb\u5f00 1 \u5f20\u672a\u7ffb\u724c\u3002' }]
      },
    },
  },
  {
    id: 'r-threshold-seal',
    name: '\u95e8\u69db\u5c01\u5370',
    description: '\u6bcf\u4e2a\u623f\u95f4\u9996\u6b21\u7ffb\u5f00\u654c\u4eba\u65f6\uff0c\u5176\u884c\u52a8\u5ef6\u8fdf +1\uff1b\u5176\u4e3b\u52a8\u6280\u80fd\u51b7\u5374\u6c38\u4e45 +1\u3002',
    events: {
      'enemy:revealed': ({ run, enemy, room }) => {
        if (!run || !enemy) return []
        const state = run._relicRoomRuntime('r-threshold-seal', room)
        if (state.triggered) return []
        state.triggered = true
        enemy.actionDelay = Math.max(0, Number(enemy.actionDelay) || 0) + 1
        if (enemy.activeSkill) enemy.activeSkill.cooldown = Math.max(0, Number(enemy.activeSkill.cooldown) || 0) + 1
        return [{ log: '\u95e8\u69db\u5c01\u5370\uff1a\u9996\u540d\u654c\u4eba\u7684\u884c\u52a8\u88ab\u63a8\u8fdf\u3002' }]
      },
    },
  },
  {
    id: 'r-vanguard-strike',
    name: '\u5148\u950b\u4e00\u51fb',
    description: '\u6bcf\u4e2a\u623f\u95f4\u7684\u7b2c\u4e00\u6b21\u653b\u51fb\u4e0d\u6d88\u8017\u6b66\u5668\u8010\u4e45\uff1b\u5bf9\u5c1a\u672a\u884c\u52a8\u8fc7\u7684\u654c\u4eba\u4f24\u5bb3 +2\u3002',
    damageModifiers: ({ firstAttackInRoom, target }) => firstAttackInRoom && !target?.hasActed
      ? [damageModifier(DAMAGE_STAGES.FLAT, 2, 'relic:vanguard-strike')]
      : [],
  },
  {
    id: 'r-vanguard-bounty',
    name: '\u5148\u950b\u8d4f\u91d1',
    description: '\u6bcf\u4e2a\u623f\u95f4\u9996\u6740\u65f6\uff0c\u83b7\u5f97 2 \u91d1\u5e01\u5e76\u4fee\u590d\u5f53\u524d\u6b66\u5668 1 \u70b9\u8010\u4e45\u3002',
    events: {
      'attack:enemy-defeated': ({ run, weapon, finalStrike }) => {
        if (!run || !weapon) return []
        const state = run._relicRoomRuntime('r-vanguard-bounty')
        if (state.claimed) return []
        state.claimed = true
        return [
          { type: 'gold', amount: 2, log: '\u5148\u950b\u8d4f\u91d1\uff1a\u83b7\u5f97 2 \u91d1\u5e01\u3002' },
          ...(!finalStrike ? [{ type: 'repair', weapon, amount: 1, log: '\u5148\u950b\u8d4f\u91d1\uff1a\u6b66\u5668\u8010\u4e45 +1\u3002' }] : []),
        ]
      },
    },
  },
  {
    id: 'r-war-spirit',
    name: '\u8fde\u51fb\u6218\u610f',
    description: '\u672c\u623f\u95f4\u6bcf\u51fb\u8d25 1 \u540d\u654c\u4eba\u83b7\u5f97 1 \u5c42\u6218\u610f\uff08\u6700\u591a 3 \u5c42\uff09\uff1b\u6bcf\u5c42\u653b\u51fb +2\u3002\u62fe\u53d6\u7269\u54c1\u3001\u91d1\u5e01\u6216\u94a5\u5319\u65f6\u5931\u53bb 1 \u5c42\uff1b\u79bb\u5f00\u623f\u95f4\u6e05\u7a7a\u3002',
    damageModifiers: ({ run }) => {
      const state = run?._relicRoomRuntime('r-war-spirit')
      const bonus = Math.max(0, Number(state?.stacks) || 0) * 2
      return bonus ? [damageModifier(DAMAGE_STAGES.FLAT, bonus, 'relic:war-spirit')] : []
    },
    events: {
      'enemy:killed': ({ run }) => {
        if (!run) return []
        const state = run._relicRoomRuntime('r-war-spirit')
        state.stacks = Math.min(3, Math.max(0, Number(state.stacks) || 0) + 1)
        return [{ log: `\u8fde\u51fb\u6218\u610f\uff1a\u5f53\u524d ${state.stacks} \u5c42\u3002` }]
      },
      'item:collected': ({ run }) => run ? [{ type: 'relic:war-spirit:lose', run }] : [],
      'gold:collected': ({ run }) => run ? [{ type: 'relic:war-spirit:lose', run }] : [],
      'key:collected': ({ run }) => run ? [{ type: 'relic:war-spirit:lose', run }] : [],
      'room:left': ({ run }) => run ? [{ type: 'relic:war-spirit:clear', run }] : [],
    },
  },
  {
    id: 'r-residual-lens',
    name: '\u6b8b\u5c40\u900f\u955c',
    description: '\u623f\u95f4\u4ec5\u5269\u6700\u540e 1 \u540d\u654c\u4eba\u65f6\uff0c\u7ffb\u5f00\u5e76\u6807\u8bb0\u5b83\uff1b\u5176\u4e3b\u52a8\u6280\u80fd\u5f53\u524d\u51b7\u5374 +1\u3002',
    events: {
      'enemy:killed': ({ run }) => {
        if (!run || run.remainingEnemies() !== 1) return []
        const state = run._relicRoomRuntime('r-residual-lens')
        if (state.triggered) return []
        const lastEnemy = [...run.currentRoom.entities.values()].find((entity) => entity.kind === 'enemy')
        if (!lastEnemy) return []
        state.triggered = true
        lastEnemy.marked = true
        if (!run.currentRoom.isRevealed(lastEnemy.pos)) run._revealTile(lastEnemy.pos, { cause: 'relic:residual-lens' })
        if (lastEnemy.activeSkill) lastEnemy.activeSkillCooldown = Math.max(0, Number(lastEnemy.activeSkillCooldown) || 0) + 1
        return [{ log: '\u6b8b\u5c40\u900f\u955c\uff1a\u5df2\u6807\u8bb0\u6700\u540e\u7684\u654c\u4eba\u3002' }]
      },
    },
  },
  {
    id: 'r-final-duel',
    name: '\u672b\u6218\u8a93\u7ea6',
    description: '\u623f\u95f4\u6700\u540e 1 \u540d\u654c\u4eba\u53d7\u5230\u7684\u4f24\u5bb3 +30%\uff0c\u4f46\u5176\u5bf9\u73a9\u5bb6\u9020\u6210\u7684\u4f24\u5bb3\u4e5f +30%\u3002',
    damageModifiers: ({ run }) => run?.remainingEnemies() === 1
      ? [damageModifier(DAMAGE_STAGES.MULTIPLY, 1.3, 'relic:final-duel')]
      : [],
  },
  {
    id: 'r-requiem-anvil',
    name: '\u5b89\u9b42\u94c1\u7827',
    description: '\u623f\u95f4\u6e05\u573a\u65f6\uff0c\u4fee\u590d\u88c5\u5907\u4e2d\u8010\u4e45\u6700\u4f4e\u7684\u6b66\u5668 2 \u70b9\u3002',
    events: {
      'room:cleared': ({ run }) => {
        const weapon = [...(run?.equippedWeapons || [])].sort((left, right) => left.durability - right.durability)[0]
        return weapon ? [{ type: 'repair', weapon, amount: 2, log: '\u5b89\u9b42\u94c1\u7827\uff1a\u6b66\u5668\u8010\u4e45 +2\u3002' }] : []
      },
    },
  },
  {
    id: 'r-retaliatory-salve',
    name: '\u56de\u54cd\u8f6f\u818f',
    description: '\u6bcf\u56de\u5408\u5185\uff0c\u6bcf\u53d7\u5230 1 \u6b21\u4f24\u5bb3\uff0c\u56de\u5408\u7ed3\u675f\u524d\u56de\u590d 1 \u70b9\u751f\u547d\u3002',
    events: {
      'player:damaged': ({ run, rawDamage }) => {
        if (!run || rawDamage <= 0) return []
        const state = relicState(run, 'r-retaliatory-salve')
        state.hits = Math.max(0, Number(state.hits) || 0) + 1
        return []
      },
      'turn:ended': ({ run }) => {
        if (!run) return []
        const state = relicState(run, 'r-retaliatory-salve')
        const amount = Math.max(0, Number(state.hits) || 0)
        state.hits = 0
        return amount ? [{ type: 'heal', amount, log: `\u56de\u54cd\u8f6f\u818f\uff1a\u56de\u590d ${amount} \u70b9\u751f\u547d\u3002` }] : []
      },
    },
  },
  {
    id: 'r-floor-roar',
    name: '\u5c42\u5883\u6012\u543c',
    description: '\u8de8\u5c42\u7d2f\u8ba1\u6bcf\u51fb\u8d25 10 \u540d\u654c\u4eba\uff0c\u7ffb\u5f00\u5f53\u524d\u697c\u5c42\u7684\u6240\u6709\u654c\u4eba\u3002',
    events: {
      'enemy:killed': ({ run }) => {
        if (!run) return []
        const state = relicState(run, 'r-floor-roar')
        state.kills = (Math.max(0, Number(state.kills) || 0) % 10) + 1
        if (state.kills !== 10) return []
        state.kills = 0
        const floor = run.currentRoom?.floor
        let revealed = 0
        for (const room of run.dungeon.rooms.values()) {
          if (room.floor !== floor) continue
          for (const enemy of room.entities.values()) {
            if (enemy.kind === 'enemy' && run._revealEnemy(room, enemy, { cause: 'relic:floor-roar' })) revealed += 1
          }
        }
        return [{ log: `\u5c42\u5883\u6012\u543c\uff1a\u7ffb\u5f00 ${revealed} \u540d\u654c\u4eba\u3002` }]
      },
    },
  },
  {
    id: 'r-inheritance-edge',
    name: '\u65ad\u5203\u7ee7\u627f',
    description: '\u6bcf\u635f\u6bc1 1 \u628a\u6b66\u5668\uff0c\u4f7f\u53e6\u4e00\u628a\u5df2\u88c5\u5907\u6b66\u5668\u653b\u51fb +2\u3002',
    events: {
      'weapon:broken': ({ run }) => {
        const weapon = run?.equippedWeapons[0]
        if (!weapon) return []
        weapon.attack = Math.max(0, Number(weapon.attack) || 0) + 2
        return [{ log: `\u65ad\u5203\u7ee7\u627f\uff1a${weapon.name}\u653b\u51fb +2\u3002` }]
      },
    },
  },
  {
    id: 'r-tenth-alchemy',
    name: '\u70bc\u91d1\u8109\u640f',
    description: '\u8de8\u5c42\u8ba1\u6570\uff0c\u6bcf\u7b2c 10 \u6b21\u653b\u51fb\u76f4\u63a5\u5c06\u76ee\u6807\u53d8\u4e3a\u5176\u5f53\u524d\u751f\u547d\u7b49\u989d\u7684\u91d1\u5e01\u3002',
  },
  {
    id: 'r-victory-near',
    name: '\u80dc\u5229\u5728\u671b',
    description: '\u5df2\u53d1\u73b0\u51fa\u53e3\u65f6\uff0c\u654c\u4eba\u8ddd\u51fa\u53e3 1/2/3/4/5 \u683c\u5206\u522b\u53d7\u5230 +5/+4/+3/+2/+1 \u4f24\u5bb3\u3002',
    damageModifiers: ({ run, room, target }) => {
      const exits = run?.dungeon.doorsForRoom(room?.id).filter((door) => run.isExitDoor(door) && run.isDoorRevealed(door)) || []
      const distance = exits.length ? Math.min(...exits.map((door) => manhattan(target.pos, door.arrival))) : Infinity
      const bonus = distance >= 1 && distance <= 5 ? 6 - distance : 0
      return bonus ? [damageModifier(DAMAGE_STAGES.FLAT, bonus, 'relic:victory-near')] : []
    },
  },
  {
    id: 'r-breaker-spark',
    name: '\u7834\u788e\u706b\u82b1',
    description: '\u6b66\u5668\u635f\u6bc1\u65f6\uff0c\u5bf9\u5f53\u524d\u76ee\u6807\u4f18\u5148\uff0c\u5426\u5219\u5bf9\u968f\u673a\u654c\u4eba\u9020\u6210 3 \u70b9\u4f24\u5bb3\u3002',
    events: {
      'weapon:broken': ({ run, target }) => {
        if (!run?.currentRoom) return []
        const candidate = run.currentRoom.entity(target?.id)
          || [...run.currentRoom.entities.values()].filter((entity) => entity.kind === 'enemy')[Math.floor(run.random() * run.remainingEnemies())]
        if (!candidate) return []
        run._damageEnemy(candidate, 3, { source: 'relic:breaker-spark' })
        return [{ log: `\u7834\u788e\u706b\u82b1\uff1a\u5bf9${candidate.name}\u9020\u6210 3 \u70b9\u4f24\u5bb3\u3002` }]
      },
    },
  },
  {
    id: 'r-bomb-expert',
    name: '\u62c6\u5f39\u4e13\u5bb6',
    description: '\u7ffb\u5f00\u9677\u9631\u724c\u65f6\uff0c\u65e0\u89c6\u5176\u6548\u679c\uff0c\u5e76\u56de\u590d 5 \u70b9\u62a4\u7532\u4e0e 5 \u70b9\u751f\u547d\u3002',
    events: {
      'trap:before-trigger': ({ run, trap }) => {
        if (!run || !trap) return []
        if (!run.suppressedTrapIds) run.suppressedTrapIds = new Set()
        run.suppressedTrapIds.add(trap.id)
        return [
          { type: 'armor', amount: 5, log: '\u62c6\u5f39\u4e13\u5bb6\uff1a\u62a4\u7532 +5\u3002' },
          { type: 'heal', amount: 5, log: '\u62c6\u5f39\u4e13\u5bb6\uff1a\u56de\u590d 5 \u70b9\u751f\u547d\u3002' },
        ]
      },
    },
  },
  {
    id: 'r-no-mercy',
    name: '\u7edd\u4e0d\u624b\u8f6f',
    description: '\u654c\u4eba\u751f\u547d\u4e0d\u9ad8\u4e8e\u4e00\u534a\u65f6\uff0c\u5bf9\u5176\u653b\u51fb\u4f24\u5bb3\u00d71.5\u3002',
    damageModifiers: ({ target }) => target?.maxHp > 0 && target.hp * 2 <= target.maxHp
      ? [damageModifier(DAMAGE_STAGES.MULTIPLY, 1.5, 'relic:no-mercy')]
      : [],
  },
  {
    id: 'r-weapon-foundry',
    name: '\u6d41\u52a8\u5175\u5e93',
    description: '\u6bcf\u53d1\u8d77 3 \u6b21\u653b\u51fb\uff0c\u5c06 1 \u628a\u968f\u673a\u6b66\u5668\u653e\u5165\u80cc\u5305\uff08\u65e0\u7a7a\u4f4d\u65f6\u8df3\u8fc7\uff09\u3002',
    events: {
      'attack:started': ({ run }) => reachedAttackCount(run, 'r-weapon-foundry', 3) && run?._addRandomWeaponToBackpack()
        ? [{ log: '\u6d41\u52a8\u5175\u5e93\uff1a\u968f\u673a\u6b66\u5668\u5df2\u5165\u5305\u3002' }]
        : [],
    },
  },
  {
    id: 'r-death-burst',
    name: '\u6b7b\u4ea1\u7206\u88c2',
    description: '\u654c\u4eba\u6b7b\u4ea1\u65f6\uff0c\u5bf9\u5176 8 \u90bb\u57df\u654c\u4eba\u9020\u6210 2 \u70b9\u4f24\u5bb3\uff0c\u5e76\u7ffb\u5f00\u5176\u4e2d\u7684\u672a\u7ffb\u724c\u3002',
    events: {
      'enemy:killed': ({ run, enemy }) => {
        const hits = run?._deathExplosion(enemy?.pos, 2) || 0
        return hits ? [{ log: `\u6b7b\u4ea1\u7206\u88c2\uff1a\u6ce2\u53ca ${hits} \u540d\u90bb\u8fd1\u654c\u4eba\u3002` }] : []
      },
    },
  },
  {
    id: 'r-key-echo',
    name: '\u94a5\u5319\u56de\u54cd',
    description: '\u62fe\u53d6\u94a5\u5319\u65f6\uff0c\u63ed\u793a\u5bf9\u5e94\u95e8\u5468\u56f4\u7684 8 \u90bb\u57df\u5361\u724c\u3002',
    events: {
      'key:collected': ({ run, edge }) => {
        const room = run?.currentRoom
        const door = run?.dungeon.doorsForRoom(room?.id).find((candidate) => candidate.edgeId === edge?.id)
        if (!run || !room || !door) return []
        let revealed = 0
        for (const position of neighbors8(door.arrival, room.width, room.height)) {
          if (room.isRevealed(position)) continue
          run._revealTile(position, { cause: 'relic:key-echo' })
          revealed += 1
        }
        return revealed ? [{ log: `\u94a5\u5319\u56de\u54cd\uff1a\u63ed\u793a\u4e86\u95e8\u5468\u8fb9\u7684 ${revealed} \u5f20\u5361\u724c\u3002` }] : []
      },
    },
  },
])

const BY_ID = new Map(RELIC_DEFS.map((definition) => [definition.id, definition]))

export function getRelicDefinition(id) { return BY_ID.get(id) || null }

export function buildRelicChoices(collection, { count = 3, random = Math.random } = {}) {
  const candidates = RELIC_DEFS.filter((definition) => !collection?.has(definition.id))
  const shuffled = [...candidates]
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled.slice(0, count)
}
