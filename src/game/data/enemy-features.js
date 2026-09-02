export const ENEMY_BEHAVIOR_LABELS = Object.freeze({
  stationary: '\u9a7b\u5b88',
  ambush: '\u4f0f\u51fb',
  chaser: '\u8ffd\u51fb',
})

export const ENEMY_TRAIT_LABELS = Object.freeze({
  shield: '\u62a4\u76fe',
  'heavy-armor': '\u91cd\u7532',
  split: '\u5206\u88c2',
  regen: '\u518d\u751f',
  revive: '\u590d\u751f',
  alert: '\u8b66\u62a5',
})

export const ENEMY_STATUS_LABELS = Object.freeze({
  marked: '\u6807\u8bb0',
})

const DEATH_EXPLOSION_LABEL = '\u6b7b\u4ea1\u7206\u70b8'

export function enemyBehaviorLabel(behavior) { return ENEMY_BEHAVIOR_LABELS[behavior] || behavior || '' }

export function enemyFeatureLabel(entity) {
  return [
    entity?.boss ? '\u9996\u9886' : '',
    ...(entity?.traits || []).map((trait) => ENEMY_TRAIT_LABELS[trait] || trait),
    entity?.deathRule ? ENEMY_TRAIT_LABELS[entity.deathRule] || entity.deathRule : '',
    entity?.deathExplosionDamage > 0 ? DEATH_EXPLOSION_LABEL : '',
    entity?.marked ? ENEMY_STATUS_LABELS.marked : '',
  ].filter(Boolean).join('\u00b7')
}

export function enemyCardSubtitle(entity) {
  return [enemyBehaviorLabel(entity?.behavior), enemyFeatureLabel(entity)].filter(Boolean).join('\u00b7')
}
