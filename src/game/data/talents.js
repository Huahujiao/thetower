const talent = (id, line, tier, slot, name, description, prerequisites = [], effects = {}) => Object.freeze({
  id,
  line,
  tier,
  slot,
  name,
  description,
  prerequisites: Object.freeze([...prerequisites]),
  effects: Object.freeze({ ...effects }),
})

export const FIXED_GROWTH = Object.freeze({
  id: 'body-strength',
  name: '强化体格',
  description: '最大生命 +2。可无限次选择。',
  fixed: true,
})

export const TALENT_DEFS = Object.freeze([
  talent('sword-steady', 'sword', 1, '1A', '稳架', '剑的近战减伤 +10 个百分点。', [], { parryMelee: 0.1 }),
  talent('sword-counter', 'sword', 1, '1B', '反击', '剑成功减伤后，下一剑 +2 伤害。', [], { parryNextDamage: 2 }),
  talent('sword-guard', 'sword', 2, '2A', '护势', '剑的减伤也可以作用于远程攻击。', ['sword-steady'], { parryRanged: true }),
  talent('sword-rebound', 'sword', 2, '2B', '回锋', '剑成功减伤后，下一剑不耗耐久。', ['sword-counter'], { parryNextFree: true }),
  talent('sword-unity', 'sword', 3, '3', '攻守一体', '剑成功减伤后，下一剑再 +2 伤害。', ['sword-guard', 'sword-rebound'], { parryNextDamage: 2 }),

  talent('axe-wide', 'axe', 1, '1A', '阔刃', '斧的溅射伤害 +15 个百分点。', [], { axeSplash: 0.15 }),
  talent('axe-leverage', 'axe', 1, '1B', '借势', '一次攻击打到至少 2 名敌人时，50% 概率不耗耐久。', [], { axeMultiFree: 0.5 }),
  talent('axe-sweep', 'axe', 2, '2A', '横扫', '斧额外溅射 1 名敌人。', ['axe-wide'], { axeExtraTargets: 1 }),
  talent('axe-formation', 'axe', 2, '2B', '开阵', '一次攻击打到至少 2 名敌人后，下一斧 +2 伤害。', ['axe-leverage'], { axeNextDamage: 2 }),
  talent('axe-bloodstorm', 'axe', 3, '3', '血肉风暴', '溅射伤害再 +15 个百分点，并额外溅射 1 名敌人。', ['axe-sweep', 'axe-formation'], { axeSplash: 0.15, axeExtraTargets: 1 }),

  talent('dagger-harvest', 'dagger', 1, '1A', '收割', '匕首击杀后，下一次匕首攻击 +2 伤害。', [], { daggerNextSelf: 2 }),
  talent('dagger-pass', 'dagger', 1, '1B', '递刀', '匕首击杀后，另一只手下一次攻击 +2 伤害。', [], { daggerNextOther: 2 }),
  talent('dagger-deadline', 'dagger', 2, '2A', '死线', '攻击生命低于 30% 的敌人时 +2 伤害。', ['dagger-harvest'], { daggerLowHealth: 2 }),
  talent('dagger-edge', 'dagger', 2, '2B', '借锋', '匕首击杀后，另一只手下一次攻击不耗耐久。', ['dagger-pass'], { daggerNextOtherFree: true }),
  talent('dagger-twin', 'dagger', 3, '3', '双刃轮舞', '匕首击杀后，若另一只手下一次攻击也完成击杀，则下一次匕首攻击额外 +2 伤害。', ['dagger-deadline', 'dagger-edge'], { daggerTwin: 2 }),

  talent('polearm-push', 'polearm', 1, '1A', '强推', '长柄击退距离 +1 格。', [], { polearmKnockback: 1 }),
  talent('polearm-distance', 'polearm', 1, '1B', '稳距', '距离 2 格攻击时 +1 伤害。', [], { polearmDistanceDamage: 1 }),
  talent('polearm-impact', 'polearm', 2, '2A', '撞击', '撞到真正的墙或敌人时造成 3 点额外伤害。', ['polearm-push'], { polearmCollisionDamage: 3 }),
  talent('polearm-step', 'polearm', 2, '2B', '借步', '成功推动敌人时，50% 概率不耗耐久。', ['polearm-distance'], { polearmPushFree: 0.5 }),
  talent('polearm-anti-cavalry', 'polearm', 3, '3', '拒马', '碰撞伤害 +2，发生碰撞时目标行动延迟 +1。', ['polearm-impact', 'polearm-step'], { polearmCollisionDamage: 2, polearmCollisionDelay: 1 }),

  talent('heavy-pressure', 'heavy', 1, '1A', '重压', '攻击生命高于 50% 的敌人时 +2 伤害。', [], { heavyAboveHalf: 2 }),
  talent('heavy-aftershock', 'heavy', 1, '1B', '余威', '一击造成至少目标最大生命 40% 的伤害时，获得 2 护甲。', [], { heavyThreshold: 0.4, heavyArmor: 2 }),
  talent('heavy-crush', 'heavy', 2, '2A', '压垮', '攻击满血敌人时再 +2 伤害。', ['heavy-pressure'], { heavyFullHealth: 2 }),
  talent('heavy-shake', 'heavy', 2, '2B', '震手', '一击造成至少目标最大生命 50% 的伤害时，50% 概率不耗耐久。', ['heavy-aftershock'], { heavyFreeThreshold: 0.5, heavyFree: 0.5 }),
  talent('heavy-unstoppable', 'heavy', 3, '3', '势不可挡', '一击造成至少目标最大生命 50% 的伤害后，下一次重武器攻击 +3 伤害。', ['heavy-crush', 'heavy-shake'], { heavyThreshold: 0.5, heavyNextDamage: 3 }),

  talent('bow-range', 'bow', 1, '1A', '远射', '弓的普通射程 +1 格。', [], { bowRange: 1 }),
  talent('bow-first', 'bow', 1, '1B', '先制', '每名敌人第一次受到弓攻击时 +2 伤害。', [], { bowFirst: 2 }),
  talent('bow-ammo', 'bow', 2, '2A', '惜箭', '在当前最大射程攻击时，50% 概率不耗耐久。', ['bow-range'], { bowMaxFree: 0.5 }),
  talent('bow-snipe', 'bow', 2, '2B', '狙击', '距离至少 3 格第一次攻击每名敌人时再 +2 伤害。', ['bow-first'], { bowFirstLong: 2 }),
  talent('bow-hunt', 'bow', 3, '3', '猎杀领域', '在当前最大射程攻击时 +2 伤害。', ['bow-ammo', 'bow-snipe'], { bowMaxDamage: 2 }),

  talent('scorch-char', 'scorch', 1, '1A', '炽化', '灼热的克制伤害倍率 +0.1。', [], { scorchCounterMultiplier: 0.1 }),
  talent('scorch-ignite', 'scorch', 1, '1B', '爆燃', '灼热克制击杀时，距离不超过 2 格的最近 1 名敌人受到 2 点伤害。', [], { scorchExplosion: 2, scorchExplosionTargets: 1 }),
  talent('scorch-ember', 'scorch', 2, '2A', '余烬', '灼热克制击杀后，下一次灼热攻击 +2 伤害。', ['scorch-char'], { scorchNextDamage: 2 }),
  talent('scorch-spread', 'scorch', 2, '2B', '蔓燃', '爆燃额外伤害距离不超过 2 格的最近 1 名敌人。', ['scorch-ignite'], { scorchExplosionTargets: 1 }),
  talent('scorch-wildfire', 'scorch', 3, '3', '燎原', '爆燃伤害 +1，余烬提供的下一击伤害再 +1。', ['scorch-ember', 'scorch-spread'], { scorchExplosion: 1, scorchNextDamage: 1 }),

  talent('wither-corrosion', 'wither', 1, '1A', '腐蚀', '枯萎克制命中后，使目标进入腐蚀：每层受到伤害 +1，持续至该敌人死亡；腐蚀可叠加。', [], { witherCorrosion: 1 }),
  talent('wither-remains', 'wither', 1, '1B', '残秽', '枯萎克制击杀时，距离不超过 2 格的最近 1 名敌人获得 1 层腐蚀。', [], { witherSpread: 1, witherSpreadTargets: 1 }),
  talent('wither-deep', 'wither', 2, '2A', '深腐', '腐蚀造成的额外承伤再 +1。', ['wither-corrosion'], { witherCorrosionBonus: 1 }),
  talent('wither-spread', 'wither', 2, '2B', '蔓蚀', '带腐蚀的敌人死亡时，距离不超过 2 格的最近 1 名敌人获得 1 层腐蚀。', ['wither-remains'], { witherDeathSpread: 1, witherSpreadTargets: 1 }),
  talent('wither-decay', 'wither', 3, '3', '万物凋零', '腐蚀额外承伤再 +1；每次传播腐蚀时额外影响 1 名敌人。', ['wither-deep', 'wither-spread'], { witherCorrosionBonus: 1, witherSpreadTargets: 1 }),

  talent('drown-pressure', 'drown', 1, '1A', '水压', '沉溺克制攻击 +1 伤害。', [], { drownCounterDamage: 1 }),
  talent('drown-tide', 'drown', 1, '1B', '回潮', '沉溺克制击杀后获得 2 护甲。', [], { drownCounterArmor: 2 }),
  talent('drown-depth', 'drown', 2, '2A', '深压', '沉溺克制未击杀时，下一次攻击该敌人 +3 伤害。', ['drown-pressure'], { drownTargetDamage: 3 }),
  talent('drown-surge', 'drown', 2, '2B', '潮生', '回潮触发后，下一次沉溺攻击 +2 伤害。', ['drown-tide'], { drownNextDamage: 2 }),
  talent('drown-trap', 'drown', 3, '3', '深陷', '沉溺克制未击杀时，使目标行动延迟 +1；每名敌人最多触发一次。', ['drown-depth', 'drown-surge'], { drownDelay: 1 }),

  talent('survival-vigor', 'survival', 1, '1A', '强健', '最大生命 +3，并恢复 3 生命。', [], { maxHp: 3, heal: 3 }),
  talent('survival-shell', 'survival', 1, '1B', '甲壳', '进入新房间时获得 3 护甲。', [], { roomArmor: 3 }),
  talent('survival-recovery', 'survival', 2, '2A', '恢复力', '所有生命恢复量 +25%。', ['survival-vigor'], { healingMultiplier: 1.25 }),
  talent('survival-hardening', 'survival', 2, '2B', '硬化', '有护甲时，受到的伤害在护甲结算前 -1。', ['survival-shell'], { armorDamageReduction: 1 }),
  talent('survival-instinct', 'survival', 3, '3', '存续本能', '在每个房间中只可生效一次，受到致命伤害时，保留 1 生命并获得 5 护甲。', ['survival-recovery', 'survival-hardening'], { roomLastStand: true }),
])

const TALENT_BY_ID = new Map(TALENT_DEFS.map((definition) => [definition.id, definition]))

export function getTalentDefinition(id) { return TALENT_BY_ID.get(id) || null }

export function ownedTalentIds(player) {
  return new Set(Array.isArray(player?.talents) ? player.talents.filter((id) => TALENT_BY_ID.has(id)) : [])
}

export function hasTalent(player, id) { return ownedTalentIds(player).has(id) }

export function unlockableTalents(player) {
  const owned = ownedTalentIds(player)
  return TALENT_DEFS.filter((definition) => !owned.has(definition.id) && definition.prerequisites.every((id) => owned.has(id)))
}

export function buildLevelUpChoices(player, { count = 4, random = Math.random } = {}) {
  const pool = unlockableTalents(player).slice()
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]]
  }
  return [...pool.slice(0, Math.max(0, count)).map((definition) => definition.id), FIXED_GROWTH.id]
}

export function talentGraphState(player) {
  const owned = ownedTalentIds(player)
  return TALENT_DEFS.map((definition) => ({
    ...definition,
    state: owned.has(definition.id) ? 'owned' : definition.prerequisites.every((id) => owned.has(id)) ? 'unlockable' : 'locked',
  }))
}
