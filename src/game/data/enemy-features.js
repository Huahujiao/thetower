export const ENEMY_BEHAVIOR_LABELS = Object.freeze({
  stationary: '\u9a7b\u5b88',
  ambush: '\u4f0f\u51fb',
  chaser: '\u8ffd\u51fb',
})

export const ENEMY_TRAIT_LABELS = Object.freeze({
  shield: '\u62a4\u76fe',
  'heavy-armor': '\u91cd\u7532\uff08\u6bcf\u6b21\u53d7\u4f24 -1\uff09',
  split: '\u5206\u88c2',
  regen: '\u518d\u751f',
  revive: '\u590d\u751f',
  alert: '\u8b66\u62a5',
  burning: '\u71c3\u70e7',
  swift: '\u75be\u884c',
  pull: '\u7275\u5f15',
  summon: '\u53ec\u5524',
  'death-spawn': '\u6b7b\u4ea1\u5b73\u751f',
})

export const ENEMY_STATUS_LABELS = Object.freeze({
  marked: '\u6807\u8bb0',
})

const DEATH_EXPLOSION_LABEL = '\u6b7b\u4ea1\u7206\u70b8'
const DEATH_STATUS_LABELS = Object.freeze({ poison: '\u6b7b\u4ea1\u4e2d\u6bd2' })

export function enemyBehaviorLabel(behavior) { return ENEMY_BEHAVIOR_LABELS[behavior] || behavior || '' }

export function enemyFeatureLabel(entity) {
  return [
    entity?.boss ? '\u9996\u9886' : '',
    ...(entity?.traits || []).map((trait) => ENEMY_TRAIT_LABELS[trait] || trait),
    entity?.deathRule ? ENEMY_TRAIT_LABELS[entity.deathRule] || entity.deathRule : '',
    entity?.deathExplosionDamage > 0 ? DEATH_EXPLOSION_LABEL : '',
    entity?.deathStatus ? DEATH_STATUS_LABELS[entity.deathStatus] || entity.deathStatus : '',
    entity?.marked ? ENEMY_STATUS_LABELS.marked : '',
  ].filter(Boolean).join('\u00b7')
}

export function enemyCardSubtitle(entity) {
  return [enemyBehaviorLabel(entity?.behavior), enemyFeatureLabel(entity)].filter(Boolean).join('\u00b7')
}
