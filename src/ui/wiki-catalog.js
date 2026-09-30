import catalog from '../game/data/catalog.json' with { type: 'json' }
import { ALL_ITEM_DEFS } from '../game/data/content.js'
import { attributeLabel } from '../game/data/attributes.js'
import { ENEMY_HP_MULTIPLIER } from '../game/data/enemies.js'
import { enemyBehaviorLabel, enemyFeatureLabel } from '../game/data/enemy-features.js'
import { RELIC_DEFS } from '../game/data/relics.js'
import { TALENT_DEFS } from '../game/data/progression.js'
import { TRAP_DEFS } from '../game/data/traps.js'
import { itemSpriteSources } from './item-sprites.js'

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
  energy: '\u4f53\u529b\u6d88\u8017',
  footprint: '\u5360\u683c',
  weaponEffect: '\u7279\u6548',
  energyLoss: '\u4f53\u529b\u635f\u5931',
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
  const names = { flow: '换势', guard: '守御', harmony: '调和', defense: '防具', material: '合成材料', cleanse: '净化散', teleport: '换位符' }
  if (names[value]) return names[value]
  const aliases = { 'heavy-armor': 'heavyArmor', energy: 'energyPotion' }
  return COPY[aliases[value] || value] || value || ''
}

function shapeCells(shape) { return (shape || [[1]]).flat().filter(Boolean).length }

function shapeText(shape) {
  const rows = shape?.length || 1
  const columns = shape?.[0]?.length || 1
  return `${rows}\u00d7${columns} \u00b7 ${shapeCells(shape)}${COPY.cell}`
}

function stat(labelText, value) {
  const wide = String(value).length > 24 ? ' wiki-stat-wide' : ''
  return `<div class="wiki-stat${wide}"><dt>${escapeHtml(labelText)}</dt><dd>${escapeHtml(value)}</dd></div>`
}

function card({ tone, tag, title, description = '', stats = [], accent = '', image = '' }) {
  const visibleStats = stats.filter(Boolean)
  const leadStats = visibleStats.slice(0, 4)
  const remainingStats = visibleStats.slice(4)
  return `<article class="wiki-card ${tone}">
    <div class="wiki-card-top">
      <div class="wiki-card-media">${image
        ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async">`
        : `<span class="wiki-media-placeholder" role="img" aria-label="${COPY.imagePending}"><span aria-hidden="true">${escapeHtml(accent || '\u25c7')}</span><small>${COPY.imagePending}</small></span>`}</div>
      <div class="wiki-card-intro">
        <div class="wiki-card-head"><span class="wiki-tag">${escapeHtml(tag)}</span><span class="wiki-status">${COPY.implemented}</span></div>
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
      stat(COPY.normalAttackCooldown, `${enemy.attackCooldownMax || 0} ${COPY.turn}`),
      stat(COPY.attribute, attributeLabel(enemy.attribute)),
      stat(COPY.behavior, enemyBehaviorLabel(enemy.behavior)),
      enemyFeatureLabel(enemy) ? stat(COPY.features, enemyFeatureLabel(enemy)) : '',
      enemy.regen > 0 ? stat(COPY.regen, enemy.regen) : '',
      enemy.deathExplosionDamage > 0 ? stat(COPY.deathExplosion, `\u534a\u5f84 ${enemy.explosionRadius || enemy.range || 1} \u00b7 ${enemy.deathExplosionDamage} ${COPY.damage}`) : '',
      enemy.splitMinionId ? stat(COPY.splitMinion, catalog.enemies.find((candidate) => candidate.id === enemy.splitMinionId)?.name || enemy.splitMinionId) : '',
      enemy.burningTurns > 0 ? stat(COPY.burning, `${enemy.burningTurns} ${COPY.globalTurns} \u00b7 ${enemy.burningDamage || 1} ${COPY.damage}`) : '',
      enemy.deathStatus ? stat(COPY.deathStatus, `${label(enemy.deathStatus)} ${enemy.deathStatusTurns || 0} ${COPY.globalTurns}`) : '',
      enemy.pullDistance > 0 ? stat(COPY.pull, `${enemy.pullDistance} ${COPY.cell}`) : '',
      enemy.summonMinionId ? stat(COPY.summon, `\u6bcf ${enemy.summonEvery || 0} \u6b21\u81ea\u8eab\u884c\u52a8 \u00b7 ${catalog.enemies.find((candidate) => candidate.id === enemy.summonMinionId)?.name || enemy.summonMinionId} \u00b7 \u4e0a\u9650 ${enemy.summonLimit || 0}`) : '',
      enemy.deathSpawnMinionId ? stat(COPY.deathSpawn, `${catalog.enemies.find((candidate) => candidate.id === enemy.deathSpawnMinionId)?.name || enemy.deathSpawnMinionId} \u00d7 ${enemy.deathSpawnCount || 0}`) : '',
      stat(COPY.floor, enemy.spawnOnly ? COPY.generated : enemy.minFloor),
      !enemy.spawnOnly && !enemy.boss ? stat(COPY.experience, enemy.experience || 0) : '',
      enemy.drop ? stat(COPY.loot, `${Math.round(enemy.drop.chance * 100)}% \u00b7 ${(Array.isArray(enemy.drop.itemIds) ? enemy.drop.itemIds : [enemy.drop.itemId]).map((itemId) => lootById.get(itemId)?.name || itemId).join(' / ')}`) : '',
      !enemy.spawnOnly && !enemy.boss && enemy.relicDropChance ? stat(COPY.relicChance, `${Math.round(enemy.relicDropChance * 100)}%`) : '',
    ],
  })).join('')
}

function weaponCards() {

  const weapons = ALL_ITEM_DEFS.filter(item => item.type === 'weapon' && !item.disabled)
  return weapons.map((weapon) => card({
    tone: 'tone-weapon',
    tag: COPY.weapon,
    title: weapon.name,
    image: itemSpriteSources(weapon)?.small,
    accent: '\u2694',
    stats: [
      stat(COPY.attack, weapon.attack),
      stat(COPY.range, `${weapon.range} ${COPY.cell}`),
      stat(COPY.energy, weapon.energyCost),
      stat('\u6b66\u5668\u7b49\u7ea7', `${weapon.tier}\u7ea7`),
      stat(COPY.attribute, attributeLabel(weapon.attribute)),
      stat(COPY.footprint, shapeText(weapon.shape)),
      stat(COPY.weaponEffect, weapon.description || ''),
    ],
  })).join('')
}

function relicCards() {
  const system = `<aside class="wiki-catalog-note"><strong>\u5723\u9057\u7269\u4e0e\u80cc\u5305</strong><p>\u80cc\u5305\u5185\u6301\u6709\u65f6\u751f\u6548\uff0c\u540c\u540d\u4e0d\u53e0\u52a0\uff1b\u65e0\u6570\u91cf\u8d85\u8f7d\u9650\u5236\u3002\u901a\u8fc7\u5f00\u5c40\u9009\u62e9\u3001\u623f\u95f4\u5956\u52b1\u548c\u5546\u5e97\u83b7\u5f97\u3002\u6563\u4ef6\u7684\u76f8\u90bb\u6548\u679c\u751f\u6548\u65f6\uff0c\u4f1a\u5728\u53cc\u65b9\u683c\u7ebf\u5904\u663e\u793a\u7eff\u8272\u6d41\u52a8\u77ed\u5149\u5e26\u3002</p></aside>`
  return system + RELIC_DEFS.filter(relic => !relic.disabled).map((relic) => card({
    tone: 'tone-relic',
    tag: COPY.relic,
    title: relic.name,
    image: itemSpriteSources(relic)?.small,
    description: relic.description,
    accent: '\u2726',
    stats: relic.totemId ? [stat('图腾召唤', '选择徽章→使用→4格内已翻开的空格'), stat('有效期', '10回合；占用1体力上限'), stat('共享冷却', '2个全局回合')] : [],
  })).join('')
}

function talentCards() {
  return TALENT_DEFS.map((talent) => card({
    tone: 'tone-relic',
    tag: `${label(talent.line)} · ${talent.slot}`,
    title: talent.name,
    description: talent.description,
    accent: '\u2736',
    stats: [
      stat('\u5c42\u7ea7', talent.tier),
      stat('\u524d\u7f6e', talent.prerequisites.length ? talent.prerequisites.join('、') : '\u65e0'),
    ],
  })).join('')
}

function itemEffect(item) {
  if (item.type === 'pet') return stat(COPY.attack, item.attack) + stat(COPY.range, item.range) + stat('\u98df\u7269\u6d88\u8017', item.foodCost)
  if (item.type === 'defense') return stat('\u62a4\u7532\u503c', `${item.armorValue} \u00b7 \u9996\u6b21\u8fdb\u5165\u65b0\u623f\u95f4\u65f6\u83b7\u5f97`)
  if (item.type === 'throwable') return stat('\u6295\u63b7\u8303\u56f4', `${item.range} ${COPY.cell}`)
  if (item.type === 'potion') return stat(COPY.healing, `+${item.heal}`)
  if (item.type === 'armor') return stat(COPY.armorValue, `+${item.armor}`)
  if (item.type === 'energy') return stat('\u6062\u590d\u4f53\u529b', `+${item.energy}`)
  if (item.type === 'buff') return stat(item.attackTarget === 'melee' ? COPY.nextMeleeAttack : COPY.nextAttack, `+${item.attackBonus}`)
  return ''
}

function itemCards() {
  const items = ALL_ITEM_DEFS.filter(item => !item.disabled && !['weapon', 'relic'].includes(item.type))
  return items.map((item) => card({
    tone: `tone-${item.type}`,
    tag: label(item.type),
    title: item.name,
    image: itemSpriteSources(item)?.small,
    description: item.description,
    accent: item.type === 'buff' ? '\u2727' : '\u25cf',
    stats: [
      itemEffect(item),
      item.tier ? stat('\u6d88\u8017\u54c1\u7b49\u7ea7', item.tier) : '',
      stat(COPY.footprint, shapeText(item.shape)),
      stat(COPY.floor, item.generatedOnly ? (item.id === 'meat-scrap' ? '\u5272\u8089\u5200\u751f\u6210' : '镇岳盾生成') : item.starterOnly ? '\u5f00\u5c40\u81ea\u5e26' : item.dropOnly ? COPY.enemyDrop : item.minFloor || 1),
      item.type === 'pet' ? stat(COPY.relicSources, '\u666e\u901a\u5546\u5e97\u3001\u8865\u7ed9\u5956\u52b1\uff1b\u6682\u5b58\u533a\u4e0d\u751f\u6548\u3002') : '',
      item.type === 'defense' ? stat(COPY.relicSources, '\u654c\u4eba\u6389\u843d\u3001\u5546\u5e97\u8d2d\u4e70\u3001\u623f\u95f4\u5956\u52b1\uff1b\u4e0d\u4f5c\u4e3a\u5730\u9762\u7269\u54c1\u751f\u6210\u3002') : '',
    ],
  })).join('')
}

function trapCards() {
  return TRAP_DEFS.map((trap) => {
    const stats = [stat(COPY.trigger, COPY.revealTrigger), stat(COPY.lifecycle, COPY.trapLifecycle)]
    if (trap.effect === 'explosion') stats.push(stat(COPY.range, '\u516b\u90bb\u57df'))
    if (trap.effect === 'alarm') stats.push(stat(COPY.range, '\u534a\u5f84 2'))
    if (trap.effect === 'corrosion') stats.push(stat(COPY.energyLoss, `-${trap.energyLoss || 0}`))
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

const BUILDERS = Object.freeze({ enemies: enemyCards, traps: trapCards, weapons: weaponCards, relics: relicCards, talents: talentCards, items: itemCards })


export function catalogContent(id) { return BUILDERS[id]?.() || null }
