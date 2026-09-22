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

export const ENEMY_OVERHEAD_HINTS = Object.freeze({
  'behavior:ambush': Object.freeze({ icon: '\u26a0', label: ENEMY_BEHAVIOR_LABELS.ambush }),
  'behavior:chaser': Object.freeze({ icon: '\u27a4', label: ENEMY_BEHAVIOR_LABELS.chaser }),
  shield: Object.freeze({ icon: '\u25c8', label: ENEMY_TRAIT_LABELS.shield }),
  'heavy-armor': Object.freeze({ icon: '\u25a3', label: ENEMY_TRAIT_LABELS['heavy-armor'] }),
  split: Object.freeze({ icon: '\u2442', label: ENEMY_TRAIT_LABELS.split }),
  regen: Object.freeze({ icon: '\u271a', label: ENEMY_TRAIT_LABELS.regen }),
  revive: Object.freeze({ icon: '\u21bb', label: ENEMY_TRAIT_LABELS.revive }),
  alert: Object.freeze({ icon: '\u25ce', label: ENEMY_TRAIT_LABELS.alert }),
  burning: Object.freeze({ icon: '\u2668', label: ENEMY_TRAIT_LABELS.burning }),
  swift: Object.freeze({ icon: '\u00bb', label: ENEMY_TRAIT_LABELS.swift }),
  pull: Object.freeze({ icon: '\u21a4', label: ENEMY_TRAIT_LABELS.pull }),
  summon: Object.freeze({ icon: '\u2726', label: ENEMY_TRAIT_LABELS.summon }),
  'death-spawn': Object.freeze({ icon: '\u273a', label: ENEMY_TRAIT_LABELS['death-spawn'] }),
  'death-explosion': Object.freeze({ icon: '\u2739', label: '\u6b7b\u4ea1\u7206\u70b8' }),
  'death-poison': Object.freeze({ icon: '\u2620', label: '\u6b7b\u4ea1\u4e2d\u6bd2' }),
})

const DEATH_EXPLOSION_LABEL = '\u6b7b\u4ea1\u7206\u70b8'
const DEATH_STATUS_LABELS = Object.freeze({ poison: '\u6b7b\u4ea1\u4e2d\u6bd2' })

export function enemyBehaviorLabel(behavior) { return ENEMY_BEHAVIOR_LABELS[behavior] || behavior || '' }

function hintedLabel(key, label) {
  const hint = ENEMY_OVERHEAD_HINTS[key]
  return hint ? `${hint.icon} ${label}` : label
}

function enemyFeatureEntries(entity) {
  return [
    entity?.boss ? { key: 'boss', label: '\u9996\u9886' } : null,
    ...(entity?.traits || []).map((trait) => ({ key: trait, label: ENEMY_TRAIT_LABELS[trait] || trait })),
    entity?.deathRule ? { key: entity.deathRule, label: ENEMY_TRAIT_LABELS[entity.deathRule] || entity.deathRule } : null,
    entity?.deathExplosionDamage > 0 ? { key: 'death-explosion', label: DEATH_EXPLOSION_LABEL } : null,
    entity?.deathStatus ? { key: `death-${entity.deathStatus}`, label: DEATH_STATUS_LABELS[entity.deathStatus] || entity.deathStatus } : null,
    entity?.marked ? { key: 'marked', label: ENEMY_STATUS_LABELS.marked } : null,
  ].filter(Boolean)
}

export function enemyBehaviorDetailLabel(behavior) {
  return hintedLabel(`behavior:${behavior}`, enemyBehaviorLabel(behavior))
}

export function enemyFeatureLabel(entity) {
  return enemyFeatureEntries(entity).map((entry) => entry.label).join('\u00b7')
}

export function enemyFeatureDetailLabel(entity) {
  return enemyFeatureEntries(entity).map((entry) => hintedLabel(entry.key, entry.label)).join('\u00b7')
}

export function enemyOverheadHints(entity) {
  const keys = [
    entity?.behavior && entity.behavior !== 'stationary' ? `behavior:${entity.behavior}` : '',
    ...(entity?.traits || []),
    entity?.deathRule || '',
    entity?.deathExplosionDamage > 0 ? 'death-explosion' : '',
    entity?.deathStatus ? `death-${entity.deathStatus}` : '',
  ].filter(Boolean)
  return [...new Set(keys)].map((key) => ENEMY_OVERHEAD_HINTS[key]).filter(Boolean)
}

export function enemyCardSubtitle(entity) {
  return [enemyBehaviorLabel(entity?.behavior), enemyFeatureLabel(entity)].filter(Boolean).join('\u00b7')
}
