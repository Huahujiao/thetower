import catalog from '../game/data/catalog.json' with { type: 'json' }
import { attributeLabel } from '../game/data/attributes.js'
import { ENEMY_HP_MULTIPLIER } from '../game/data/enemies.js'
import { enemyFeatureLabel } from '../game/data/enemy-features.js'
import { LEVEL_UP_OPTIONS } from '../game/data/progression.js'
import { TRAP_DEFS } from '../game/data/traps.js'
import { enemyDistribution } from './wiki-data.js'

const COPY = Object.freeze({
  implemented: '\u5df2\u5b9e\u88c5',
  imagePending: '\u5f85\u8865\u56fe',
  traps: '\u9677\u9631',
  enemy: '\u654c\u4eba',
  boss: '\u9996\u9886',
  weapon: '\u6b66\u5668',
  pet: '\u5ba0\u7269',
  relic: '\u5723\u9057\u7269',
  potion: '\u751f\u547d\u836f\u6c34',
  armor: '\u62a4\u7532\u836f\u5242',
  energyPotion: '\u98df\u7269',
  throwable: '\u6295\u63b7\u6d88\u8017\u54c1',
  'money-pouch': '\u94b1\u888b',
  buff: '\u589e\u76ca\u7269\u54c1',
  attack: '\u653b\u51fb',
  health: '\u751f\u547d',
  range: '\u5c04\u7a0b',
  energy: '体力球消耗',
  footprint: '\u5360\u683c',
  weaponEffect: '\u7279\u6548',
  fatigue: '疲劳',
  attribute: '\u5c5e\u6027',
  floor: '\u6700\u65e9\u51fa\u73b0\u697c\u5c42',
  delay: '\u884c\u52a8\u5ef6\u8fdf',
  normalAttackCooldown: '\u666e\u901a\u653b\u51fb\u51b7\u5374',
  behavior: '\u884c\u4e3a',
  features: '\u7279\u6027',
  healing: '\u6062\u590d\u751f\u547d',
  armorValue: '\u589e\u52a0\u62a4\u7532',
  nextAttack: '\u4e0b\u6b21\u653b\u51fb',
  nextMeleeAttack: '\u4e0b\u6b21\u8fd1\u6218\u653b\u51fb',
  loot: '\u6389\u843d',
  experience: '\u7ecf\u9a8c',
  relicChance: '\u5723\u9057\u7269\u6389\u843d',
  relicSources: '\u83b7\u53d6\u6765\u6e90',
  enemyDrop: '\u654c\u4eba\u6389\u843d',
  generated: '\u751f\u6210\u7269',
  cell: '\u683c',
  turn: '\u56de\u5408',
  trigger: '\u89e6\u53d1',
  lifecycle: '\u72b6\u6001',
  trapLifecycle: '\u89e6\u53d1\u540e\u4fdd\u7559\u4e00\u4e2a\u5b8c\u6574\u540e\u7eed\u5168\u5c40\u56de\u5408\u8ba1\u6570\uff0c\u4e14\u4e0d\u4f1a\u91cd\u590d\u89e6\u53d1',
  duration: '\u6301\u7eed',
  damage: '\u4f24\u5bb3',
  regen: '\u518d\u751f',
  deathExplosion: '\u6b7b\u4ea1\u7206\u70b8',
  splitMinion: '\u5206\u88c2\u751f\u6210\u7269',
  burning: '\u71c3\u70e7',
  deathStatus: '\u6b7b\u4ea1\u6548\u679c',
  pull: '\u7275\u5f15',
  summon: '\u53ec\u5524',
  deathSpawn: '\u6b7b\u4ea1\u5b73\u751f',
  revealTrigger: '\u7ffb\u5f00\u540e\u7acb\u5373\u89e6\u53d1',
  globalTurns: '\u5168\u5c40\u56de\u5408',
})

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]))
}

function label(value) {
  const names = { flow: '换势', guard: '守御', harmony: '调和', defense: '防具', material: '合成材料', teleport: '飞身符' }
  if (names[value]) return names[value]
  const aliases = { 'heavy-armor': 'heavyArmor', energy: 'energyPotion' }
  return COPY[aliases[value] || value] || value || ''
}

function stat(labelText, value) {
  const wide = String(value).length > 24 ? ' wiki-stat-wide' : ''
  return `<div class="wiki-stat${wide}"><dt>${escapeHtml(labelText)}</dt><dd>${escapeHtml(value)}</dd></div>`
}

function card({ tone, tag, title, description = '', stats = [], accent = '', image = '', status = COPY.implemented }) {
  const visibleStats = stats.filter(Boolean)
  const leadStats = visibleStats.slice(0, 4)
  const remainingStats = visibleStats.slice(4)
  return `<article class="wiki-card ${tone}">
    <div class="wiki-card-top">
      <div class="wiki-card-media">${image
        ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async">`
        : `<span class="wiki-media-placeholder" role="img" aria-label="${COPY.imagePending}"><span aria-hidden="true">${escapeHtml(accent || '\u25c7')}</span><small>${COPY.imagePending}</small></span>`}</div>
      <div class="wiki-card-intro">
        <div class="wiki-card-head"><span class="wiki-tag">${escapeHtml(tag)}</span><span class="wiki-status">${escapeHtml(status)}</span></div>
        <h2>${escapeHtml(title)}</h2>
        ${description ? `<p>${escapeHtml(description)}</p>` : ''}
        ${leadStats.length ? `<dl class="wiki-stats wiki-stats-lead">${leadStats.join('')}</dl>` : ''}
      </div>
    </div>
    ${remainingStats.length ? `<dl class="wiki-stats wiki-stats-rest">${remainingStats.join('')}</dl>` : ''}
  </article>`
}

function enemyCards() {
  const enemies = [...catalog.enemies, { ...catalog.boss, boss: true }]
  const lootById = new Map([...(catalog.enemyLoot || []), ...(catalog.defenses || [])].map((item) => [item.id, item]))
  return enemies.map((enemy) => card({
    tone: enemy.boss ? 'tone-boss' : 'tone-enemy',
      tag: enemy.boss ? COPY.boss : enemy.spawnOnly ? COPY.generated : COPY.enemy,
    title: enemy.name,
    accent: enemy.boss ? '\u2620' : '\u2020',
    stats: [
      stat(COPY.health, enemy.hp * ENEMY_HP_MULTIPLIER),
      stat(COPY.attack, enemy.attack),
      stat(COPY.range, `${enemy.range} ${COPY.cell}`),
      stat(COPY.delay, `${enemy.initialActionDelay} ${COPY.turn}`),
      stat(COPY.normalAttackCooldown, '无，每个敌人阶段可攻击一次'),
      stat(COPY.attribute, attributeLabel(enemy.attribute)),
      stat('速度', `${enemy.speed || 0} 格／回合`),
      enemyFeatureLabel(enemy) ? stat(COPY.features, enemyFeatureLabel(enemy)) : '',
      enemy.regen > 0 ? stat(COPY.regen, enemy.regen) : '',
      enemy.deathExplosionDamage > 0 ? stat(COPY.deathExplosion, `\u534a\u5f84 ${enemy.explosionRadius || enemy.range || 1} \u00b7 ${enemy.deathExplosionDamage} ${COPY.damage}`) : '',
      enemy.splitMinionId ? stat(COPY.splitMinion, catalog.enemies.find((candidate) => candidate.id === enemy.splitMinionId)?.name || enemy.splitMinionId) : '',
      enemy.burningTurns > 0 ? stat(COPY.burning, `${enemy.burningTurns} ${COPY.globalTurns} \u00b7 ${enemy.burningDamage || 1} ${COPY.damage}`) : '',
      enemy.deathStatus ? stat(COPY.deathStatus, `${label(enemy.deathStatus)} ${enemy.deathStatusTurns || 0} ${COPY.globalTurns}`) : '',
      enemy.pullDistance > 0 ? stat(COPY.pull, `${enemy.pullDistance} ${COPY.cell}`) : '',
      enemy.summonMinionId ? stat(COPY.summon, `\u6bcf ${enemy.summonEvery || 0} \u6b21\u81ea\u8eab\u884c\u52a8 \u00b7 ${catalog.enemies.find((candidate) => candidate.id === enemy.summonMinionId)?.name || enemy.summonMinionId} \u00b7 \u4e0a\u9650 ${enemy.summonLimit || 0}`) : '',
      enemy.deathSpawnMinionId ? stat(COPY.deathSpawn, `${catalog.enemies.find((candidate) => candidate.id === enemy.deathSpawnMinionId)?.name || enemy.deathSpawnMinionId} \u00d7 ${enemy.deathSpawnCount || 0}`) : '',
      stat('生成分布', enemyDistribution(enemy)),
      !enemy.spawnOnly && !enemy.boss ? stat(COPY.experience, enemy.experience || 0) : '',
      enemy.drop ? stat(COPY.loot, `${Math.round(enemy.drop.chance * 100)}% \u00b7 ${(Array.isArray(enemy.drop.itemIds) ? enemy.drop.itemIds : [enemy.drop.itemId]).map((itemId) => lootById.get(itemId)?.name || itemId).join(' / ')}`) : '',
      !enemy.spawnOnly && !enemy.boss && enemy.relicDropChance ? stat(COPY.relicChance, `${Math.round(enemy.relicDropChance * 100)}%`) : '',
    ],
  })).join('')
}

function growthCards() {
  return LEVEL_UP_OPTIONS.map((option) => card({
    tone: 'tone-relic',
    tag: '\u5347\u7ea7\u5956\u52b1',
    title: option.name,
    description: option.description,
    status: option.disabled ? '暂未开放' : COPY.implemented,
    accent: '\u2736',
    stats: [],
  })).join('')
}

function trapCards() {
  return TRAP_DEFS.map((trap) => {
    const stats = [stat(COPY.trigger, COPY.revealTrigger), stat(COPY.lifecycle, COPY.trapLifecycle)]
    if (trap.effect === 'explosion') stats.push(stat(COPY.range, '\u516b\u90bb\u57df'))
    if (trap.effect === 'alarm') stats.push(stat(COPY.range, '\u534a\u5f84 2'))
    if (trap.effect === 'corrosion') stats.push(stat(COPY.fatigue, `${trap.fatigueLayers}层`))
    if (trap.effect === 'poison') {
      stats.push(stat(COPY.duration, `${trap.poisonTurns} ${COPY.globalTurns}`))
      stats.push(stat(COPY.damage, `${trap.poisonDamage} ${COPY.health} \u00b7 \u65e0\u89c6\u62a4\u7532`))
    }
    return card({
      tone: 'tone-trap',
      tag: COPY.traps,
      title: trap.name,
      description: trap.description,
      accent: trap.effect === 'explosion' ? '\u2739' : trap.effect === 'alarm' ? '\u266b' : trap.effect === 'corrosion' ? '\u2248' : '\u2601',
      stats,
    })
  }).join('')
}

const BUILDERS = Object.freeze({ enemies: enemyCards, traps: trapCards, growth: growthCards })


export function catalogContent(id) { return BUILDERS[id]?.() || null }
