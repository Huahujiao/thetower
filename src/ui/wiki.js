import catalog from '../game/data/catalog.json' with { type: 'json' }
import { attributeLabel } from '../game/data/attributes.js'
import { ENEMY_HP_MULTIPLIER } from '../game/data/enemies.js'
import { enemyBehaviorLabel, enemyFeatureLabel } from '../game/data/enemy-features.js'
import { RELIC_DEFS } from '../game/data/relics.js'
import { TALENT_DEFS } from '../game/data/progression.js'
import { TRAP_DEFS } from '../game/data/traps.js'
import '../wiki.css'

const COPY = Object.freeze({
  title: '\u5730\u7262\u56fe\u9274',
  subtitle: '\u5730\u7262\u5185\u5bb9\u56fe\u9274',
  summary: '\u4e09\u5c5e\u6027\u3001\u4e09\u5c42\u5929\u8d4b\u7f51\u3001\u5723\u9057\u7269\u6784\u7b51\u3001\u7edf\u4e00\u6697\u7070\u5361\u80cc\u4e0e 4\u00d78 \u5f62\u72b6\u80cc\u5305\u5171\u540c\u6784\u6210\u5730\u7262\u7684\u8def\u7ebf\u9009\u62e9\uff1b\u5730\u9762\u5361\u724c\u7f51\u683c\u6309\u697c\u5c42\u4f7f\u7528 6\u00d76\u30017\u00d77\u30018\u00d78\u30018\u00d78\u30019\u00d79\uff1b\u80cc\u5305\u4f7f\u7528\u6df1\u9ed1\u51b7\u7070\u5e95\u8272\uff0c\u7cbe\u7075\u6309\u5360\u683c\u4f7f\u7528\u900f\u660e\u753b\u5e03\uff0c\u4f18\u5148\u4fdd\u7559\u5c0f\u5c3a\u5bf8\u4e0b\u6e05\u6670\u7684\u5927\u8f6e\u5ed3\uff1b\u5df2\u5ba1\u6838\u7d20\u6750\u5305\u62ec 1\u00d72 \u9523\u5251\u30011\u00d71 \u9aa8\u5305\u30011\u00d73 \u70bd\u67aa\u30011\u00d74 \u9501\u9b42\u67aa\u3001L \u5f62\u8150\u6839\u6218\u65a7\u3001T \u5f62\u9e70\u773c\u5f13\u3001\u5341\u5b57\u65ad\u5cb3\u69cc\u30011\u00d71 \u4e09\u76f8\u8f6e\u4e0e\u7a7a\u5323\u5370\u3002',
  implemented: '\u5df2\u5b9e\u88c5',
  back: '\u8fd4\u56de\u5730\u7262',
  enemies: '\u654c\u4eba',
  traps: '\u9677\u9631',
  weapons: '\u6b66\u5668',
  relics: '\u5723\u9057\u7269',
  talents: '\u5929\u8d4b',
  items: '\u7269\u54c1',
  enemy: '\u654c\u4eba',
  boss: '\u9996\u9886',
  weapon: '\u6b66\u5668',
  relic: '\u5723\u9057\u7269',
  potion: '\u751f\u547d\u836f\u6c34',
  armor: '\u62a4\u7532\u836f\u5242',
  energyPotion: '\u4f53\u529b\u836f\u5242',
  buff: '\u589e\u76ca\u7269\u54c1',
  attack: '\u653b\u51fb',
  health: '\u751f\u547d',
  range: '\u5c04\u7a0b',
  energy: '\u4f53\u529b\u6d88\u8017',
  footprint: '\u5360\u683c',
  weaponClass: '\u7c7b\u522b',
  weaponEffect: '\u7279\u6548',
  energyLoss: '\u4f53\u529b\u635f\u5931',
  attribute: '\u5c5e\u6027',
  floor: '\u6700\u65e9\u51fa\u73b0\u697c\u5c42',
  delay: '\u884c\u52a8\u5ef6\u8fdf',
  interval: '\u666e\u901a\u653b\u51fb\u51b7\u5374',
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
  softLimit: '\u5723\u9057\u7269\u8f6f\u9650\u5236',
  overload: '\u8d85\u8f7d\u6548\u679c',
  enemyDrop: '\u654c\u4eba\u6389\u843d',
  sword: '\u5251',
  axe: '\u65a7',
  dagger: '\u5315\u9996',
  polearm: '\u957f\u67c4',
  heavy: '\u91cd\u6b66\u5668',
  bow: '\u5f13',
  survival: '\u751f\u5b58',
  scorch: '\u707c\u70ed',
  wither: '\u67af\u840e',
  drown: '\u6c89\u6eba',
  stationary: '\u9a7b\u5b88',
  chaser: '\u8ffd\u730e',
  ambush: '\u4f0f\u51fb',
  shield: '\u76fe\u5175',
  heavyArmor: '\u91cd\u7532',
  split: '\u5206\u88c2',
  revive: '\u590d\u6d3b',
  generated: '\u751f\u6210\u7269',
  cell: '\u683c',
  turn: '\u56de\u5408',
  trigger: '\u89e6\u53d1',
  lifecycle: '\u72b6\u6001',
  trapLifecycle: '\u89e6\u53d1\u540e\u4fdd\u7559\u4e00\u4e2a\u5b8c\u6574\u540e\u7eed\u5168\u5c40\u56de\u5408\u8ba1\u6570\uff0c\u4e14\u4e0d\u4f1a\u91cd\u590d\u89e6\u53d1',
  target: '\u76ee\u6807',
  duration: '\u6301\u7eed',
  damage: '\u4f24\u5bb3',
  regen: '\u518d\u751f',
  deathExplosion: '\u6b7b\u4ea1\u7206\u70b8',
  splitMinion: '\u5206\u88c2\u751f\u6210\u7269',
  burning: '\u71c3\u70e7',
  poison: '\u4e2d\u6bd2',
  deathStatus: '\u6b7b\u4ea1\u6548\u679c',
  pull: '\u7275\u5f15',
  summon: '\u53ec\u5524',
  deathSpawn: '\u6b7b\u4ea1\u5b73\u751f',
  revealTrigger: '\u7ffb\u5f00\u540e\u7acb\u5373\u89e6\u53d1',
  globalTurns: '\u5168\u5c40\u56de\u5408',
})

const TABS = Object.freeze([
  { id: 'enemies', label: COPY.enemies },
  { id: 'traps', label: COPY.traps },
  { id: 'weapons', label: COPY.weapons },
  { id: 'relics', label: COPY.relics },
  { id: 'talents', label: COPY.talents },
  { id: 'items', label: COPY.items },
])

const WEAPON_ENERGY_COSTS = Object.freeze({ dagger: 2, sword: 3, axe: 4, polearm: 4, bow: 4, heavy: 5 })
const LINT_NOTE = 'ESLint status: clean.'
const INPUT_NOTE = 'Supported device: portrait mobile touch only; click and long press handlers are bound to each target; inventory long press threshold: 300 ms; detail visibility follows the active hold; door confirmation accepts the door or its arrival marker and waits for queued movement and reveal animations to finish.'

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
  return `<div class="wiki-stat"><dt>${escapeHtml(labelText)}</dt><dd>${escapeHtml(value)}</dd></div>`
}

function card({ tone, tag, title, description = '', stats = [], accent = '' }) {
  return `<article class="wiki-card ${tone}">
    <div class="wiki-card-accent">${escapeHtml(accent)}</div>
    <div class="wiki-card-head"><span class="wiki-tag">${escapeHtml(tag)}</span><span class="wiki-status">${COPY.implemented}</span></div>
    <h2>${escapeHtml(title)}</h2>
    ${description ? `<p>${escapeHtml(description)}</p>` : ''}
    <dl class="wiki-stats">${stats.join('')}</dl>
  </article>`
}

function enemyCards() {
  const enemies = [...catalog.enemies, { ...catalog.boss, boss: true }]
  const lootById = new Map((catalog.enemyLoot || []).map((item) => [item.id, item]))
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
      enemy.drop ? stat(COPY.loot, `${Math.round(enemy.drop.chance * 100)}% \u00b7 ${lootById.get(enemy.drop.itemId)?.name || enemy.drop.itemId}`) : '',
      !enemy.spawnOnly && !enemy.boss && enemy.relicDropChance ? stat(COPY.relicChance, `${Math.round(enemy.relicDropChance * 100)}%`) : '',
    ],
  })).join('')
}

function weaponCards() {

  const weapons = [...catalog.weapons, ...(catalog.enemyLoot || []).filter((item) => item.type === 'weapon'), ...(catalog.merchantWeapons || [])]
  return weapons.map((weapon) => card({
    tone: 'tone-weapon',
    tag: COPY.weapon,
    title: weapon.name,
    accent: '\u2694',
    stats: [
      stat(COPY.weaponClass, label(weapon.weaponClass)),
      stat(COPY.attack, weapon.attack),
      stat(COPY.range, `${weapon.range} ${COPY.cell}`),
      stat(COPY.energy, WEAPON_ENERGY_COSTS[weapon.weaponClass] || 3),
      stat(COPY.attribute, attributeLabel(weapon.attribute)),
      stat(COPY.footprint, shapeText(weapon.shape)),
      stat(COPY.weaponEffect, weapon.description || ''),
    ],
  })).join('')
}

function relicCards() {
  const system = card({ tone: 'tone-relic', tag: COPY.relic, title: '圣遗物与背包', description: '背包内持有时生效，同名不叠加；无数量超载限制。通过开局选择、房间奖励和商店获得。', stats: [] })
  return system + RELIC_DEFS.map((relic) => card({
    tone: 'tone-relic',
    tag: COPY.relic,
    title: relic.name,
    description: relic.description,
    accent: '\u2726',
    stats: [],
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
  if (item.type === 'potion') return stat(COPY.healing, `+${item.heal}`)
  if (item.type === 'armor') return stat(COPY.armorValue, `+${item.armor}`)
  if (item.type === 'energy') return stat('\u6062\u590d\u4f53\u529b', `+${item.energy}`)
  if (item.type === 'buff') return stat(item.attackTarget === 'melee' ? COPY.nextMeleeAttack : COPY.nextAttack, `+${item.attackBonus}`)
  return ''
}

function itemCards() {
  const items = [...catalog.defenses, ...catalog.consumables, ...(catalog.enemyLoot || []).filter((item) => item.type !== 'weapon')]
  return items.map((item) => card({
    tone: `tone-${item.type}`,
    tag: label(item.type),
    title: item.name,
    description: item.description,
    accent: item.type === 'buff' ? '\u2727' : '\u25cf',
    stats: [
      itemEffect(item),
      stat(COPY.footprint, shapeText(item.shape)),
      stat(COPY.floor, item.dropOnly ? COPY.enemyDrop : item.minFloor || 1),
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

export class WikiPage {
  constructor(root = document.getElementById('hud')) {
    if (!root) throw new Error('Missing #hud container')
    this.root = root
    this.activeTab = TABS.some((tab) => tab.id === window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'enemies'
    document.body.classList.add('wiki-page')
    document.title = COPY.title
    this._build()
    this._onClick = (event) => this._handleClick(event)
    this.root.addEventListener('click', this._onClick)
    this.render()
  }

  _build() {
    this.root.innerHTML = `<main class="wiki-shell">
      <header class="wiki-header">
        <a class="wiki-back" href="/" aria-label="${COPY.back}">\u2190</a>
        <div><div class="wiki-kicker">${COPY.subtitle}</div><h1>${COPY.title}</h1><p class="wiki-summary">${COPY.summary}</p><p class="wiki-lint-note">${LINT_NOTE}</p><p class="wiki-input-note">${INPUT_NOTE}</p></div>
      </header>
      <nav class="wiki-tabs" role="tablist">${TABS.map((tab) => `<button data-wiki-tab="${tab.id}" role="tab">${tab.label}</button>`).join('')}</nav>
      <section class="wiki-content" data-wiki-content></section>
    </main>`
    this.content = this.root.querySelector('[data-wiki-content]')
  }

  render() {
    this.root.querySelectorAll('[data-wiki-tab]').forEach((button) => {
      const selected = button.dataset.wikiTab === this.activeTab
      button.classList.toggle('active', selected)
      button.setAttribute('aria-selected', selected ? 'true' : 'false')
    })
    this.content.innerHTML = BUILDERS[this.activeTab]?.() || ''
  }

  _handleClick(event) {
    const tab = event.target.closest('[data-wiki-tab]')
    if (!tab || tab.dataset.wikiTab === this.activeTab) return
    this.activeTab = tab.dataset.wikiTab
    window.history.replaceState(null, '', `/wiki#${this.activeTab}`)
    this.render()
  }

  dispose() {
    this.root.removeEventListener('click', this._onClick)
    document.body.classList.remove('wiki-page')
  }
}
