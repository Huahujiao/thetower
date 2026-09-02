import catalog from '../game/data/catalog.json' with { type: 'json' }
import { attributeLabel } from '../game/data/attributes.js'
import { enemyActiveSkillLabel, enemyBehaviorLabel, enemyFeatureLabel } from '../game/data/enemy-features.js'
import { RELIC_DEFS } from '../game/data/relics.js'
import '../wiki.css'

const COPY = Object.freeze({
  title: '\u5730\u7262\u56fe\u9274',
  subtitle: '\u5730\u7262\u5185\u5bb9\u56fe\u9274',
  summary: '\u4e09\u5c5e\u6027\u3001\u89d2\u8272\u6210\u957f\u3001\u5723\u9057\u7269\u6784\u7b51\u4e0e\u5f62\u72b6\u80cc\u5305\u5171\u540c\u6784\u6210\u5730\u7262\u7684\u8def\u7ebf\u9009\u62e9\u3002',
  implemented: '\u5df2\u5b9e\u88c5',
  proposed: '\u5f85\u786e\u8ba4\uff0f\u672a\u5b9e\u88c5',
  back: '\u8fd4\u56de\u5730\u7262',
  enemies: '\u654c\u4eba',
  weapons: '\u6b66\u5668',
  relics: '\u5723\u9057\u7269',
  items: '\u7269\u54c1',
  enemy: '\u654c\u4eba',
  boss: '\u9996\u9886',
  weapon: '\u6b66\u5668',
  relic: '\u5723\u9057\u7269',
  potion: '\u751f\u547d\u836f\u6c34',
  armor: '\u62a4\u7532\u836f\u5242',
  buff: '\u589e\u76ca\u7269\u54c1',
  whetstone: '\u78e8\u5200\u77f3',
  attack: '\u653b\u51fb',
  health: '\u751f\u547d',
  range: '\u5c04\u7a0b',
  durability: '\u8010\u4e45',
  footprint: '\u5360\u683c',
  weaponClass: '\u7c7b\u522b',
  weaponEffect: '\u7279\u6548',
  attribute: '\u5c5e\u6027',
  floor: '\u6700\u65e9\u51fa\u73b0\u697c\u5c42',
  delay: '\u884c\u52a8\u5ef6\u8fdf',
  interval: '\u666e\u901a\u653b\u51fb\u51b7\u5374',
  normalAttackCooldown: '\u666e\u901a\u653b\u51fb\u51b7\u5374',
  activeSkillCooldown: '\u4e3b\u52a8\u6280\u80fd\u51b7\u5374',
  behavior: '\u884c\u4e3a',
  features: '\u7279\u6027',
  active: '\u4e3b\u52a8\u6280\u80fd',
  cooldown: '\u51b7\u5374',
  healing: '\u6062\u590d\u751f\u547d',
  armorValue: '\u589e\u52a0\u62a4\u7532',
  nextAttack: '\u4e0b\u6b21\u653b\u51fb',
  nextMeleeAttack: '\u4e0b\u6b21\u8fd1\u6218\u653b\u51fb',
  repair: '\u4fee\u590d\u8010\u4e45',
  loot: '\u6389\u843d',
  experience: '\u7ecf\u9a8c',
  relicChance: '\u5723\u9057\u7269\u6389\u843d',
  relicSources: '\u83b7\u53d6\u6765\u6e90',
  activeLimit: '\u540c\u65f6\u6fc0\u6d3b\u4e0a\u9650',
  autoActivate: '\u83b7\u5f97\u89c4\u5219',
  enemyDrop: '\u654c\u4eba\u6389\u843d',
  futureRule: '\u9884\u8ba1\u89c4\u5219',
  sword: '\u5251',
  axe: '\u65a7',
  dagger: '\u5315\u9996',
  polearm: '\u957f\u67c4',
  heavy: '\u91cd\u6b66\u5668',
  bow: '\u5f13',
  scorch: '\u707c\u70ed',
  wither: '\u67af\u840e',
  drown: '\u6c89\u6eba',
  stationary: '\u9a7b\u5b88',
  chaser: '\u8ffd\u730e',
  ambush: '\u4f0f\u51fb',
  summoner: '\u53ec\u5524',
  selfDestruct: '\u81ea\u7206',
  shield: '\u76fe\u5175',
  heavyArmor: '\u91cd\u7532',
  regen: '\u518d\u751f',
  split: '\u5206\u88c2',
  revive: '\u590d\u6d3b',
  spawn: '\u53ec\u5524\u7269',
  cell: '\u683c',
  turn: '\u56de\u5408',
})

const TABS = Object.freeze([
  { id: 'enemies', label: COPY.enemies },
  { id: 'weapons', label: COPY.weapons },
  { id: 'relics', label: COPY.relics },
  { id: 'items', label: COPY.items },
])

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]))
}

function label(value) {
  const aliases = { 'heavy-armor': 'heavyArmor', 'self-destruct': 'selfDestruct' }
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

const PROPOSALS = Object.freeze({
  enemies: [
    {
      tone: 'tone-enemy', tag: COPY.enemy, title: '\u8ffd\u730e\u8005', accent: '\u2020',
      description: '\u7ffb\u5f00\u540e\u4f1a\u6cbf\u6700\u77ed\u8def\u5f84\u671d\u73a9\u5bb6\u9760\u8fd1\uff0c\u76f4\u5230\u8fdb\u5165\u8fd1\u6218\u8303\u56f4\u3002',
      stats: [[COPY.health, '8'], [COPY.attack, '4'], [COPY.range, `1 ${COPY.cell}`], [COPY.delay, `1 ${COPY.turn}`], [COPY.interval, `1 ${COPY.turn}`], [COPY.futureRule, '\u707c\u70ed \u00b7 \u8ffd\u51fb']],
    },
    {
      tone: 'tone-enemy', tag: COPY.enemy, title: '\u89c2\u671b\u8005', accent: '\u25ce',
      description: '\u4e0d\u79fb\u52a8\uff0c\u4f46\u5728\u5c04\u7a0b\u5185\u4f1a\u538b\u7f29\u73a9\u5bb6\u7684\u8def\u7ebf\u9009\u62e9\u3002',
      stats: [[COPY.health, '7'], [COPY.attack, '3'], [COPY.range, `3 ${COPY.cell}`], [COPY.delay, `1 ${COPY.turn}`], [COPY.interval, `2 ${COPY.turn}`], [COPY.futureRule, '\u6e4d\u6d41 \u00b7 \u8fdc\u7a0b\u76d1\u89c6']],
    },
    {
      tone: 'tone-boss', tag: COPY.boss, title: '\u4e0d\u706d\u76d1\u89c6\u8005', accent: '\u2620',
      description: '\u5f3a\u5316\u9996\u9886\u5019\u9009\uff1a\u53ef\u5728\u9996\u6b21\u6b7b\u4ea1\u540e\u8fd4\u56de\u6218\u573a\u3002',
      stats: [[COPY.health, '30'], [COPY.attack, '9'], [COPY.range, `2 ${COPY.cell}`], [COPY.delay, `1 ${COPY.turn}`], [COPY.interval, `2 ${COPY.turn}`], [COPY.futureRule, '\u7ed3\u6676 \u00b7 \u9a7b\u5b88 \u00b7 \u590d\u6d3b']],
    },
  ],
  weapons: [],
  relics: [
    {
      tone: 'tone-relic', tag: COPY.relic, title: '\u56de\u58f0\u7f57\u76d8', accent: '\u2726',
      description: '\u6bcf\u4e2a\u623f\u95f4\u7684\u7b2c\u4e00\u6b21\u7ffb\u724c\u540e\uff0c\u6307\u51fa\u6700\u8fd1\u7684\u672a\u7ffb\u724c\u7269\u54c1\u65b9\u5411\u3002',
      stats: [[COPY.futureRule, '\u63d0\u4f9b\u65b9\u5411\u63d0\u793a\uff0c\u4e0d\u900f\u9732\u5177\u4f53\u7269\u54c1']],
    },
    {
      tone: 'tone-relic', tag: COPY.relic, title: '\u95e8\u94ed\u4f59\u6e29', accent: '\u2726',
      description: '\u7a7f\u8fc7\u623f\u95f4\u95e8\u540e\uff0c\u4f7f\u65b0\u623f\u95f4\u7684\u7b2c\u4e00\u4e2a\u654c\u4eba\u591a\u5ef6\u8fdf 1 \u56de\u5408\u3002',
      stats: [[COPY.futureRule, '\u65e0\u6cd5\u9632\u6b62\u6781\u901f\u654c\u4eba\u7ffb\u724c\u65f6\u7684\u7b2c\u4e00\u51fb']],
    },
    {
      tone: 'tone-relic', tag: COPY.relic, title: '\u90bb\u57df\u6362\u4f4d', accent: '\u2726',
      description: '\u4ea4\u6362\u89d2\u8272\u5468\u56f4 8 \u90bb\u57df\u5361\u724c\u4e0e\u968f\u673a\u5c0f\u533a\u57df\u3002',
      stats: [[COPY.futureRule, '\u5df2\u786e\u8ba4\u6548\u679c\uff0c\u6682\u7f13\u5b9e\u73b0\uff1b\u9700\u8981\u5b9a\u4e49\u6362\u724c\u4e0e\u5173\u952e\u5b9e\u4f53\u4fdd\u62a4\u89c4\u5219']],
    },
    {
      tone: 'tone-relic', tag: COPY.relic, title: '\u654c\u4f4d\u6362\u4f4d', accent: '\u2726',
      description: '\u653b\u51fb\u540e\u5c06\u654c\u4eba\u4ea4\u6362\u81f3\u968f\u673a\u4f4d\u7f6e\u3002',
      stats: [[COPY.futureRule, '\u5df2\u786e\u8ba4\u6548\u679c\uff0c\u6682\u7f13\u5b9e\u73b0\uff1b\u9700\u8981\u5b9a\u4e49\u76ee\u6807\u5361\u3001\u7ffb\u5f00\u72b6\u6001\u4e0e\u5b9e\u4f53\u4ea4\u6362\u8bed\u4e49']],
    },
  ],
  items: [
    {
      tone: 'tone-buff', tag: COPY.buff, title: '\u70df\u5e55\u74f6', accent: '\u2727',
      description: '\u5c0f\u578b\u4e00\u6b21\u6027\u9053\u5177\uff0c\u4e3a\u9003\u8dd1\u63d0\u4f9b\u4e00\u56de\u5408\u7f13\u51b2\u3002',
      stats: [[COPY.footprint, '1\u00d71 \u00b7 1\u683c'], [COPY.floor, '2'], [COPY.futureRule, '\u4f7f\u5df2\u7ffb\u5f00\u654c\u4eba\u672c\u56de\u5408\u4e0d\u884c\u52a8']],
    },
    {
      tone: 'tone-whetstone', tag: COPY.buff, title: '\u63a2\u8def\u7c89', accent: '\u25c6',
      description: '\u4e0d\u76f4\u63a5\u63ed\u793a\u5185\u5bb9\uff0c\u4f46\u5e2e\u52a9\u5728\u5371\u9669\u623f\u95f4\u4e2d\u4fdd\u7559\u9009\u8def\u4fe1\u606f\u3002',
      stats: [[COPY.footprint, '1\u00d71 \u00b7 1\u683c'], [COPY.floor, '2'], [COPY.futureRule, '\u9ad8\u4eae\u672c\u56de\u5408\u53ef\u7ffb\u5f00\u7684\u5168\u90e8\u724c']],
    },
  ],
})

function card({ tone, tag, title, description = '', stats = [], accent = '', status = 'implemented' }) {
  const proposed = status === 'proposed'
  return `<article class="wiki-card ${tone}${proposed ? ' is-proposed' : ''}">
    <div class="wiki-card-accent">${escapeHtml(accent)}</div>
    <div class="wiki-card-head"><span class="wiki-tag">${escapeHtml(tag)}</span><span class="wiki-status">${proposed ? COPY.proposed : COPY.implemented}</span></div>
    <h2>${escapeHtml(title)}</h2>
    ${description ? `<p>${escapeHtml(description)}</p>` : ''}
    <dl class="wiki-stats">${stats.join('')}</dl>
  </article>`
}

function proposalCards(group) {
  return PROPOSALS[group].map((proposal) => card({
    ...proposal,
    status: 'proposed',
    stats: proposal.stats.map(([labelText, value]) => stat(labelText, value)),
  })).join('')
}

function enemyCards() {
  const enemies = [...catalog.enemies, { ...catalog.boss, boss: true, minFloor: 5 }]
  const lootById = new Map((catalog.enemyLoot || []).map((item) => [item.id, item]))
  return enemies.map((enemy) => card({
    tone: enemy.boss ? 'tone-boss' : 'tone-enemy',
    tag: enemy.boss ? COPY.boss : enemy.spawnOnly ? COPY.spawn : COPY.enemy,
    title: enemy.name,
    accent: enemy.boss ? '\u2620' : '\u2020',
    stats: [
      stat(COPY.health, enemy.hp),
      stat(COPY.attack, enemy.attack),
      stat(COPY.range, `${enemy.range} ${COPY.cell}`),
      stat(COPY.delay, `${enemy.initialActionDelay} ${COPY.turn}`),
      stat(COPY.normalAttackCooldown, `${enemy.attackCooldownMax || 0} ${COPY.turn}`),
      enemy.activeSkill ? stat(COPY.active, enemyActiveSkillLabel(enemy.activeSkill)) : '',
      enemy.activeSkill ? stat(COPY.activeSkillCooldown, `${enemy.activeSkill.cooldown || 0} ${COPY.turn}`) : '',
      stat(COPY.attribute, attributeLabel(enemy.attribute)),
      stat(COPY.behavior, enemyBehaviorLabel(enemy.behavior)),
      enemyFeatureLabel(enemy) ? stat(COPY.features, enemyFeatureLabel(enemy)) : '',
      stat(COPY.floor, enemy.spawnOnly ? COPY.spawn : enemy.minFloor),
      !enemy.spawnOnly && !enemy.boss ? stat(COPY.experience, enemy.experience || 0) : '',
      enemy.drop ? stat(COPY.loot, `${Math.round(enemy.drop.chance * 100)}% \u00b7 ${lootById.get(enemy.drop.itemId)?.name || enemy.drop.itemId}`) : '',
      !enemy.spawnOnly && !enemy.boss && enemy.relicDropChance ? stat(COPY.relicChance, `${Math.round(enemy.relicDropChance * 100)}%`) : '',
    ],
  })).join('') + proposalCards('enemies')
}

function weaponCards() {
  const effects = {
    sword: '\u653b\u51fb\u540e\uff0c\u4e0b\u4e00\u6b21\u53d7\u5230\u7684\u8fd1\u6218\u4f24\u5bb3 -40%\uff1b\u6700\u540e\u4e00\u51fb\u6539\u4e3a -80%\u4fdd\u62a4\u3002',
    axe: '\u76ee\u6807\u76f8\u90bb\u654c\u4eba\u53d7 50% \u4f24\u5bb3\uff1b\u6700\u540e\u4e00\u51fb\u6539\u4e3a\u516b\u90bb\u57df 80% \u65cb\u65a9\u3002',
    dagger: '\u51fb\u6740\u76ee\u6807\u65f6\u4e0d\u6d88\u8017\u8010\u4e45\uff1b\u6700\u540e\u4e00\u51fb\u4f7f\u76ee\u6807\u5ef6\u8fdf 1 \u56de\u5408\u3002',
    polearm: '\u5c04\u7a0b 2\uff0c\u8ddd\u79bb 2 \u547d\u4e2d\u65f6\u51fb\u9000 1 \u683c\uff1b\u6700\u540e\u4e00\u51fb\u5c04\u7a0b 4\u3001\u51fb\u9000 2 \u683c\u3002',
    heavy: '\u653b\u51fb\u76fe\u724c\u6216\u91cd\u7532\u65f6\u65e0\u89c6\u9632\u5fa1\uff1b\u6700\u540e\u4e00\u51fb\u4f24\u5bb3 +50% \u5e76\u7834\u574f\u9632\u5fa1\u3002',
    bow: '\u57fa\u7840\u5c04\u7a0b 3\uff1b\u6700\u540e\u4e00\u51fb\u5c04\u7a0b 5\uff0c\u76f4\u7ebf\u6700\u591a\u547d\u4e2d 3 \u540d\u654c\u4eba\u3002',
  }
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
      stat(COPY.durability, weapon.durabilityRange ? weapon.durabilityRange.join('\u2013') : weapon.durability),
      stat(COPY.attribute, attributeLabel(weapon.attribute)),
      stat(COPY.footprint, shapeText(weapon.shape)),
      stat(COPY.weaponEffect, effects[weapon.weaponClass] || ''),
    ],
  })).join('') + proposalCards('weapons')
}

function relicCards() {
  const system = card({
    tone: 'tone-relic',
    tag: COPY.relic,
    title: '\u5723\u9057\u7269\u83b7\u53d6\u4e0e\u6fc0\u6d3b',
    description: '\u623f\u95f4\u5956\u52b1\u3001\u6536\u85cf\u5bb6\u4e0e\u602a\u7269\u6389\u843d\u5747\u53ef\u83b7\u5f97\u5723\u9057\u7269\u3002\u672a\u8fbe\u4e0a\u9650\u65f6\u65b0\u83b7\u5f97\u7684\u5723\u9057\u7269\u4f1a\u7acb\u5373\u6fc0\u6d3b\uff1b\u53ef\u5728\u5546\u4eba\u6216\u6536\u85cf\u5bb6\u5904\u8c03\u6574\u3002',
    accent: '\u2726',
    stats: [
      stat(COPY.relicSources, '\u623f\u95f4\u5956\u52b1 \u00b7 \u6536\u85cf\u5bb6 \u00b7 \u602a\u7269\u6389\u843d'),
      stat(COPY.activeLimit, '5'),
      stat(COPY.autoActivate, '\u672a\u6ee1 5 \u4ef6\u65f6\u7acb\u5373\u6fc0\u6d3b'),
    ],
  })
  return system + RELIC_DEFS.map((relic) => card({
    tone: 'tone-relic',
    tag: COPY.relic,
    title: relic.name,
    description: relic.description,
    accent: '\u2726',
    stats: relic.activeSkill
      ? [stat(COPY.active, relic.activeSkill.name), stat(COPY.cooldown, `${relic.activeSkill.cooldown} ${COPY.turn}`)]
      : [],
  })).join('') + proposalCards('relics')
}

function itemEffect(item) {
  if (item.type === 'potion') return stat(COPY.healing, `+${item.heal}`)
  if (item.type === 'armor') return stat(COPY.armorValue, `+${item.armor}`)
  if (item.type === 'buff') return stat(item.attackTarget === 'melee' ? COPY.nextMeleeAttack : COPY.nextAttack, `+${item.attackBonus}`)
  if (item.type === 'whetstone') return stat(COPY.repair, `+${item.repair}`)
  return ''
}

function itemCards() {
  const items = [...catalog.consumables, ...(catalog.enemyLoot || []).filter((item) => item.type !== 'weapon')]
  return items.map((item) => card({
    tone: `tone-${item.type}`,
    tag: label(item.type),
    title: item.name,
    accent: item.type === 'whetstone' ? '\u25c6' : item.type === 'buff' ? '\u2727' : '\u25cf',
    stats: [
      itemEffect(item),
      stat(COPY.attribute, attributeLabel(item.attribute)),
      stat(COPY.footprint, shapeText(item.shape)),
      stat(COPY.floor, item.dropOnly ? COPY.enemyDrop : item.minFloor || 1),
    ],
  })).join('') + proposalCards('items')
}

const BUILDERS = Object.freeze({ enemies: enemyCards, weapons: weaponCards, relics: relicCards, items: itemCards })

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
        <div><div class="wiki-kicker">${COPY.subtitle}</div><h1>${COPY.title}</h1><p class="wiki-summary">${COPY.summary}</p></div>
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
