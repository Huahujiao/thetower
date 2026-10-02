import { getStatus } from '../rules/statuses.js'

export const ENEMY_TRAIT_LABELS = Object.freeze({
  ambush: '\u4f0f\u51fb',
  shield: '\u62a4\u76fe',
  'heavy-armor': '\u91cd\u7532\uff08\u6bcf\u6b21\u53d7\u4f24 -1\uff09',
  split: '\u5206\u88c2',
  regen: '\u518d\u751f',
  revive: '\u590d\u751f',
  alert: '\u8b66\u62a5',
  burning: '\u71c3\u70e7',
  pull: '\u7275\u5f15',
  summon: '\u53ec\u5524',
  'death-spawn': '\u6b7b\u4ea1\u5b73\u751f',
})

export const ENEMY_STATUS_LABELS = Object.freeze({
  marked: '\u6807\u8bb0',
  poisoned: '\u4e2d\u6bd2',
  counter: '\u53cd\u51fb',
  dodge: '\u95ea\u907f',
})

export const ENEMY_OVERHEAD_HINTS = Object.freeze({
  ambush: Object.freeze({ icon: '\u26a0', label: ENEMY_TRAIT_LABELS.ambush }),
  shield: Object.freeze({ icon: '\u25c8', label: ENEMY_TRAIT_LABELS.shield }),
  'heavy-armor': Object.freeze({ icon: '\u25a3', label: ENEMY_TRAIT_LABELS['heavy-armor'] }),
  split: Object.freeze({ icon: '\u2442', label: ENEMY_TRAIT_LABELS.split }),
  regen: Object.freeze({ icon: '\u271a', label: ENEMY_TRAIT_LABELS.regen }),
  revive: Object.freeze({ icon: '\u21bb', label: ENEMY_TRAIT_LABELS.revive }),
  alert: Object.freeze({ icon: '\u25ce', label: ENEMY_TRAIT_LABELS.alert }),
  burning: Object.freeze({ icon: '\u2668', label: ENEMY_TRAIT_LABELS.burning }),
  pull: Object.freeze({ icon: '\u21a4', label: ENEMY_TRAIT_LABELS.pull }),
  summon: Object.freeze({ icon: '\u2726', label: ENEMY_TRAIT_LABELS.summon }),
  'death-spawn': Object.freeze({ icon: '\u273a', label: ENEMY_TRAIT_LABELS['death-spawn'] }),
  'death-explosion': Object.freeze({ icon: '\u2739', label: '\u6b7b\u4ea1\u7206\u70b8' }),
  'death-poison': Object.freeze({ icon: '\u2620', label: '\u6b7b\u4ea1\u4e2d\u6bd2' }),
  poisoned: Object.freeze({ icon: '\u2620', label: ENEMY_STATUS_LABELS.poisoned }),
  counter: Object.freeze({ icon: '\u21a9', label: ENEMY_STATUS_LABELS.counter }),
  dodge: Object.freeze({ icon: '\u2933', label: ENEMY_STATUS_LABELS.dodge }),
})

const DEATH_EXPLOSION_LABEL = '\u6b7b\u4ea1\u7206\u70b8'
const DEATH_STATUS_LABELS = Object.freeze({ poison: '\u6b7b\u4ea1\u4e2d\u6bd2' })

function hintedLabel(key, label) {
  const hint = ENEMY_OVERHEAD_HINTS[key]
  return hint ? `${hint.icon} ${label}` : label
}

function enemyFeatureEntries(entity) {
  return [
    entity?.boss ? { key: 'boss', label: '\u9996\u9886' } : null,
    entity?.behavior === 'ambush' ? { key: 'ambush', label: ENEMY_TRAIT_LABELS.ambush } : null,
    ...(entity?.traits || []).map((trait) => ({ key: trait, label: ENEMY_TRAIT_LABELS[trait] || trait })),
    entity?.deathRule ? { key: entity.deathRule, label: ENEMY_TRAIT_LABELS[entity.deathRule] || entity.deathRule } : null,
    entity?.deathExplosionDamage > 0 ? { key: 'death-explosion', label: DEATH_EXPLOSION_LABEL } : null,
    entity?.deathStatus ? { key: `death-${entity.deathStatus}`, label: DEATH_STATUS_LABELS[entity.deathStatus] || entity.deathStatus } : null,
    entity?.marked ? { key: 'marked', label: ENEMY_STATUS_LABELS.marked } : null,
    getStatus(entity, 'enemy-poison') ? { key: 'poisoned', label: ENEMY_STATUS_LABELS.poisoned } : null,
    ...['counter', 'dodge'].filter(id => getStatus(entity, id)).map(id => ({ key: id, label: ENEMY_STATUS_LABELS[id] })),
  ].filter(Boolean)
}

export function enemyFeatureLabel(entity) {
  return enemyFeatureEntries(entity).map((entry) => entry.label).join('\u00b7')
}

export function enemyFeatureDetailLabel(entity) {
  return enemyFeatureEntries(entity).map((entry) => hintedLabel(entry.key, entry.label)).join('\u00b7')
}

export function enemyOverheadHints(entity) {
  const keys = [
    entity?.behavior === 'ambush' ? 'ambush' : '',
    ...(entity?.traits || []),
    entity?.deathRule || '',
    entity?.deathExplosionDamage > 0 ? 'death-explosion' : '',
    entity?.deathStatus ? `death-${entity.deathStatus}` : '',
    getStatus(entity, 'enemy-poison') ? 'poisoned' : '',
    ...['counter', 'dodge'].filter(id => getStatus(entity, id)),
  ].filter(Boolean)
  return [...new Set(keys)].map((key) => ENEMY_OVERHEAD_HINTS[key]).filter(Boolean)
}

export function enemyCardSubtitle(entity) {
  return [`速度 ${entity?.speed || 0}`, enemyFeatureLabel(entity)].filter(Boolean).join('\u00b7')
}
