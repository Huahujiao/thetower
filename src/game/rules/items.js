import { attributeModifier } from '../data/attributes.js'
import { getItemDefinition } from '../data/content.js'
import { combatDistance, neighbors8, chebyshev } from '../core/geometry.js'
import { adjacentItems } from './backpack-geometry.js'
import { activeConduits, conduitCapacity, forkBridgeActive } from './synergies.js'
import { applyStatus, consumeStatus, getStatus, removeStatus, resolveStatusDamage, statusCounterText } from './statuses.js'
import { ExpansionRules } from './expansion.js'
import { isConsumable } from './consumables.js'

export { adjacentItems }

const ADJACENCY_EFFECT_TARGETS = Object.freeze({
  scope: (item) => item.type === 'weapon',
  weight: (item) => item.type === 'weapon',
  chain: (item) => item.type === 'weapon',
  'venom-sac': (item) => item.type === 'weapon',
  spring: (item) => item.type === 'weapon',
  'shield-core': (item) => item.type === 'defense',
  conduit: (item) => item.type === 'weapon' || item.type === 'defense',
  'fork-connector': (item) => item.type === 'weapon' || item.type === 'defense',
  'range-disc': (item) => item.type === 'weapon',
  'steady-clip': (item) => item.type === 'weapon',
  'bone-nail': (item) => item.type === 'weapon',
  'r-relay-badge': (item) => item.type === 'weapon',
  'r-step-edge': item => item.type === 'weapon',
  'r-neutral-stone': item => item.type === 'weapon',
  'r-miasma-sac': item => item.type === 'weapon',
  'r-range-mirror': item => item.type === 'weapon',
  'r-gold-fuel': item => item.type === 'weapon' || item.id === 'money-pouch',
  'mountain-shield': item => item.type === 'weapon',
  'farwatch-armor': item => item.type === 'weapon',
  'coin-armor': item => item.id === 'money-pouch',
  'r-chain-drink': item => isConsumable(item),
  'r-launcher': item => isConsumable(item) && item.tier === 2,
  'r-feeding-charm': item => item.type === 'pet',
})

export function adjacencyEffectApplies(source, target, effectiveRange = target?.range || 1) {
  return !getItemDefinition(source?.id)?.disabled && !!ADJACENCY_EFFECT_TARGETS[source?.id]?.(target) &&
    (!['range-disc', 'steady-clip'].includes(source.id) || effectiveRange >= 2)
}

export function activeAdjacencyLinks(backpack, rangeFor = item => item.range || 1) {
  return backpack.items.flatMap((source) => {
    if (!ADJACENCY_EFFECT_TARGETS[source.id]) return []
    const neighbors = adjacentItems(backpack, source)
    if (source.id === 'conduit' && !neighbors.some((item) => item.type === 'defense')) return []
    if (source.id === 'fork-connector' &&
        (!neighbors.some((item) => item.type === 'defense') || !neighbors.some((item) => item.type === 'weapon'))) return []
    return neighbors
      .filter((target) => adjacencyEffectApplies(source, target, rangeFor(target)))
      .map((target) => ({ source, target }))
  })
}

export class ItemRules {
  constructor(run) { this.run = run; this.expansion = new ExpansionRules(run) }
  get state() {
    const state = this.run.player.itemState ||= { buffs: {}, lastAction: null, steps: 0, travel: 0 }
    state.buffs ||= {}
    return state
  }
  get room() { return this.run._roomRuntime().items ||= {} }
  has(id) { return !getItemDefinition(id)?.disabled && this.run.backpack.items.some(i => (i.id || i.relicId) === id) }
  adjacent(item, id) {
    const range = ['range-disc', 'steady-clip'].includes(id) ? this.range(item) : item.range || 1
    return adjacentItems(this.run.backpack, item)
      .some(source => source.id === id && adjacencyEffectApplies(source, item, range))
  }
  activeAdjacencyLinks() { return activeAdjacencyLinks(this.run.backpack, item => this.range(item)) }
  relicEffectActive(id) {
    if (!this.has(id) || this.run.relicOverload() > 0) return false
    const badge = this.run.backpack.items.find(item => item.id === id && item.totemId)
    if (badge) return this.run.totems.available(badge)
    const weapons = this.run.backpack.items.filter(item => item.type === 'weapon')
    if (id === 'r-three') return new Set(weapons.map(item => item.attribute).filter(Boolean)).size === 3
    if (id === 'r-empty') return this.run.backpack.capacity - this.run.backpack.usedCells >= 8
    if (['r-traveler', 'r-step-boots', 'r-turn-shield'].includes(id)) return this.state.lastAction === 'attack'
    if (id === 'r-blood') return this.run.player.hp <= this.run.player.maxHp / 2
    if (id === 'r-scales') return weapons.length === 1
    return true
  }
  buff(key, value) { return applyStatus({ statuses: this.state.buffs }, key, { layers: 1, trigger: 'attack', ...value }) }
  armor(amount, _defense = false, sourceId = null) {
    if (amount <= 0 || this.run.gameOver) return
    if (sourceId) {
      const defenseItem = this.run.backpack.items.find(i => i.uid === sourceId || i.id === sourceId)
      if (defenseItem && this.adjacent(defenseItem, 'shield-core')) amount += 1
    }
    this.run.player.armor += amount
    if (activeConduits(this.run.backpack).length) this.state.conduitCharge = Math.min(3, (this.state.conduitCharge || 0) + Math.min(2, amount))
  }
  armorFloor(target, _defense = false, sourceId = null) {
    if (sourceId) {
      const defenseItem = this.run.backpack.items.find(i => i.id === sourceId)
      if (defenseItem && this.adjacent(defenseItem, 'shield-core')) target += 1
    }
    const gain = Math.max(0, target - this.run.player.armor)
    if (gain > 0) this.armor(gain, false)
  }
  enter(firstVisit) {
    this.state.lastAction = 'enter'
    this.state.steps = 0
    this.state.travel = 0
    if (!firstVisit) return
    for (const item of this.run.backpack.items.filter(item => item.type === 'defense')) {
      this.armor(item.armorValue || 1, true, item.uid)
    }
  }
  action(kind) {
    this.state.lastAction = kind
    if (kind !== 'movement') this.state.steps = 0
    if (kind === 'attack') this.state.travel = 0
    if (kind === 'organize' || kind === 'craft') {
      if (!activeConduits(this.run.backpack).length) this.state.conduitCharge = 0
      if (!this.has('r-phase-pointer')) delete this.state.buffs['r-phase-pointer']
      if (!this.has('r-relay-badge')) delete this.state.buffs['r-relay-badge']
      if (!this.run.backpack.items.some((item) => item.id === 'range-disc')) this.state.sniperCharge = 0
    }
  }
  move({ movementTurn = true } = {}) {
    // Grant before ambushes; these reactions last until the enemy stage ends.
    if (movementTurn && this.state.lastAction === 'attack') {
      if (this.has('r-step-boots')) this.run.applyStatus(this.run.player, 'dodge', { layers: 1, turns: 1, source: 'r-step-boots' })
      if (this.has('r-turn-shield')) this.run.applyStatus(this.run.player, 'counter', {
        layers: 1, turns: 1, source: 'r-turn-shield',
        damage: { mode: 'last-player-attack', stage: 'gain', ratio: 0.5, rounding: 'ceil' },
      })
      if (this.run.battle.active && this.has('r-traveler')) this.run._recoverEnergy(1)
    }
    this.state.steps = (this.state.steps || 0) + 1
    if (this.run.battle.active) this.run._recoverEnergy(this.run.totems.movementBonus())
    this.state.travel = (this.state.travel || 0) + 1
    this.state.lastAction = 'movement'
  }
  range(weapon, position = this.run.player.pos) {
    let range = weapon.range || 1
    if (this.adjacent(weapon, 'scope')) range++
    if (this.adjacent(weapon, 'r-range-mirror')) range++
    if (this.has('r-scales') && this.run.backpack.items.filter(i => i.type === 'weapon').length === 1) range++
    const room = this.run.currentRoom
    if (weapon.id === 'ash-bow' && (position.c === 0 || position.r === 0 || position.c === room.width - 1 || position.r === room.height - 1)) range++
    return range
  }
  matchingBuffs(weapon) {
    return Object.entries(this.state.buffs).filter(([key, b]) =>
      (!key.startsWith('r-') || this.has(key)) && (key !== 'spring' || this.has(key)) &&
      (!b.other || b.other !== weapon.uid) && (!b.attribute || b.attribute === weapon.attribute) &&
      (!b.otherAttribute || b.otherAttribute !== weapon.attribute) &&
      (key !== 'r-relay-badge' || this.adjacent(weapon, key)))
  }
  cost(weapon) {
    const baseCost = Math.max(1, Math.floor(Number(weapon.energyCost) || 3))
    let cost = baseCost
    if (this.adjacent(weapon, 'weight')) cost++
    for (const [,b] of this.matchingBuffs(weapon)) cost -= b.discount || 0
    if (this.has('r-empty') && this.run.backpack.capacity - this.run.backpack.usedCells >= 8) cost--
    if (baseCost >= 5 && this.has('r-heavy-wrist') && adjacentItems(this.run.backpack, weapon).length === 0) cost--
    cost -= this.expansion.cost(weapon)
    return Math.max(1, cost)
  }
  attackContext(weapon, enemy) {
    const { run } = this
    let relation = attributeModifier(weapon.attribute, enemy.attribute)
    if (this.has('r-reverse')) relation = attributeModifier(enemy.attribute, weapon.attribute)
    relation = this.expansion.relation(weapon, relation)
    const range = this.range(weapon)
    const distance = combatDistance(run.player.pos, enemy.pos, range)
    const moved = this.state.lastAction === 'movement'
    let flat = run.totems.attackBonus()
    if (weapon.id === 'silver-guard' && adjacentItems(run.backpack, weapon).some(i => i.type === 'defense')) flat++
    if (weapon.id === 'root-axe' && enemy.hp === enemy.maxHp) flat += 1
    if (weapon.id === 'tide-blade' && moved) flat += 1
    if (weapon.id === 'thorn-spear' && enemy.movedLastPhase) flat += 2
    if (weapon.id === 'wood-bow' && distance === range) flat += 1
    if (weapon.id === 'eagle-bow' && distance === range) flat += 2
    if (weapon.id === 'bell-maul' && this.state.lastAction !== 'attack') flat += 2
    if (weapon.id === 'wall-sword' && run.player.armor > 0) flat += 2
    if (weapon.id === 'mountain-maul' && adjacentItems(run.backpack, weapon).length === 0) flat += 3
    if (weapon.id === 'triad-wither' && enemy.itemPoisonTurns > 0) flat += 2
    if (this.adjacent(weapon, 'weight')) flat += 2
    if (forkBridgeActive(run.backpack, weapon)) flat++
    const conduitSpend = Math.min(conduitCapacity(run.backpack, weapon), this.state.conduitCharge || 0)
    flat += conduitSpend
    if (weapon.id === 'coin-blade' && run.player.gold >= 12) flat += 2
    const sniperSpend = this.adjacent(weapon, 'range-disc') ? this.state.sniperCharge || 0 : 0
    flat += sniperSpend
    if (distance <= 2 && this.adjacent(weapon, 'steady-clip')) flat++
    const weapons = run.backpack.items.filter(i => i.type === 'weapon')
    const extra = this.expansion.attackContext(weapon, { moved, distance, range })
    flat += extra.flat
    const attackMultiplier = (this.has('r-scales') && weapons.length === 1 ? 2 : 1) * extra.attackMultiplier
    if (this.has('r-blood') && run.player.hp <= run.player.maxHp / 2) flat += 3
    const buffs = this.matchingBuffs(weapon)
    flat += buffs.reduce((n,[,b]) => n + (b.flat || 0), 0)
    const triad = this.has('r-three') && new Set(weapons.map(i => i.attribute).filter(Boolean)).size === 3
    const multiplier = (triad && relation.countered ? 2.2 : relation.multiplier) *
      buffs.reduce((value, [, buff]) => value * (buff.multiplier || 1), 1)
    const poison = getStatus(enemy, 'enemy-poison')
    return { ...relation, flat, multiplier, attackMultiplier, buffs, distance, range, conduitSpend, sniperSpend, moved, poison,
      fuel: extra.fuel, bonusDamage: extra.bonusDamage,
      armorBefore: run.player.armor, ignoreDefense: weapon.id === 'rock-maul' }
  }
  consume(context) {
    // Consume before hit callbacks so freshly generated bonuses survive for the next attack.
    for (const [key, status] of context.buffs) consumeStatus({ statuses: this.state.buffs }, key, status)
    if (context.conduitSpend) this.state.conduitCharge = Math.max(0, (this.state.conduitCharge || 0) - context.conduitSpend)
    if (context.sniperSpend) this.state.sniperCharge = 0
    this.room.attacked = true
  }
  afterAttack(weapon, enemy, hit, context) {
    const { run } = this
    if (run.gameOver) return
    const purgePoison = weapon.id === 'erosion-knife' && context.poison && !hit.evaded
    if (purgePoison) {
      for (let index = 0; index < 3 && !enemy.downed && run.currentRoom.entity(enemy.id) && !run.gameOver; index++) {
        const poisonHit = run._damageEnemy(enemy, resolveStatusDamage(context.poison, { run, holder: enemy }), { source: 'item:poison', ignoreDefense: true })
        if (poisonHit.defeated) Object.assign(hit, { defeated: true, exploded: poisonHit.exploded, afterEffectDefeated: true })
      }
      removeStatus(enemy, 'enemy-poison')
    }
    if (weapon.id === 'rust-sword') run.applyStatus(run.player, 'parry', { multiplier: 0.7 })
    if (weapon.id === 'wall-sword') run.player.armor = Math.max(0, run.player.armor - 2)
    if (this.has('r-guard-return') && context.armorBefore > run.player.armor) this.armor(1)
    if (!purgePoison && !hit.evaded && !enemy.downed && run.currentRoom.entity(enemy.id) && this.adjacent(weapon, 'venom-sac')) {
      run.applyStatus(enemy, 'enemy-poison', { layers: 5, damage: 1 }, { refresh: true })
    }
    if (hit.damage > 0 && weapon.id === 'triad-tide' && context.distance === this.range(weapon)) run._recoverEnergy(1)
    if (hit.damage > 0 && this.adjacent(weapon, 'range-disc') && context.distance === this.range(weapon)) {
      this.state.sniperCharge = 2
    }
    const chained = this.adjacent(weapon, 'chain')
    const nailed = this.adjacent(weapon, 'bone-nail')
    const knockback = ['ember-spear', 'soul-spear'].includes(weapon.id) || chained || nailed
    if (!hit.evaded && context.distance === 2 && knockback && run.currentRoom.entity(enemy.id) && !enemy.downed) {
      run._knockbackEnemy(enemy, 1, {
        collisionDamage: (weapon.id === 'soul-spear' ? 3 : 0) + (chained ? 2 : 0) + (nailed ? 2 : 0),
        collisionDelay: nailed ? 1 : 0,
      })
    }
    if (hit.defeated) {
      if (weapon.id === 'bone-knife') run._recoverEnergy(1)
      if (weapon.id === 'return-axe') this.buff('return-axe', { other: weapon.uid, flat: 2, discount: 1 })
      if (weapon.id === 'gold-hook') run.player.gold++
      if (this.adjacent(weapon, 'spring')) this.buff('spring', { other: weapon.uid, discount: 1 })
      if (weapon.id === 'ember-axe') {
        const targets = run._activeEnemies().filter(e => chebyshev(e.pos, enemy.pos) === 1)
        for (const target of targets) {
          if (run.gameOver) break
          run._damageEnemy(target, 2, { source: 'item:explosion' })
        }
      }
    }
    if (run.gameOver) return
    if (this.adjacent(weapon, 'r-relay-badge')) this.buff('r-relay-badge', { other: weapon.uid, multiplier: 1.7 })
    if (hit.damage > 0 && this.has('r-phase-pointer') && this.state.lastAttribute &&
        this.state.lastAttribute !== weapon.attribute) this.buff('r-phase-pointer', { flat: 1, discount: 1 })
    this.expansion.afterAttack(weapon, enemy, hit, context)
    this.state.lastWeapon = weapon.uid
    this.state.lastAttribute = weapon.attribute
  }
  beforeDamage(damage, context) {
    damage = this.run.totems.beforeDamage(damage, context)
    damage = this.expansion.beforeDamage(damage, context)
    if (context.source !== 'enemy:attack') return damage
    if (this.has('wood-shield')) {
      this.state.enemyAttacks = (this.state.enemyAttacks || 0) + 1
      if (this.state.enemyAttacks % 2 === 0) this.armorFloor(3, true, 'wood-shield')
    }
    if (context.enemy?.range > 1 && this.has('tide-cloak')) damage--
    if (this.has('vine-armor') && neighbors8(this.run.player.pos, this.run.currentRoom.width, this.run.currentRoom.height).some(p => !this.run.currentRoom.isRevealed(p))) damage--
    return Math.max(0, damage)
  }
  afterDamage(context, healthDamage, armorBefore) {
    const { run } = this
    const armorAfter = run.player.armor
    if (run.gameOver || run.player.hp <= 0 || context.source !== 'enemy:attack') {
      this.expansion.afterDamage(armorBefore, armorAfter)
      return
    }
    if (this.has('r-guard-return') && armorBefore > armorAfter) this.armor(1)
    if (healthDamage > 0 && context.enemy?.range === 1 && this.has('thorn-shield')) run._damageEnemy(context.enemy, 2, { source: 'item:thorns' })
    this.expansion.afterDamage(armorBefore, armorAfter)
  }
  discarded() {}

  sourceName(id) { return getItemDefinition(id)?.name || id }

  pendingLines(weapon = null) {
    const buffs = weapon ? this.matchingBuffs(weapon) : Object.entries(this.state.buffs).filter(([key]) =>
      (!key.startsWith('r-') || this.has(key)) && (key !== 'spring' || this.has(key)))
    return buffs.map(([key, buff]) => {
      const effects = []
      if (buff.flat) effects.push(`伤害+${buff.flat}`)
      if (buff.multiplier) effects.push(`\u4f24\u5bb3\u00d7${buff.multiplier}`)
      if (buff.discount) effects.push(`体力消耗-${buff.discount}`)
      return `${this.sourceName(key)}：下一击${effects.join('、')}\uff1b${statusCounterText(buff)}`
    })
  }

  weaponLines(weapon) {
    const adjacent = adjacentItems(this.run.backpack, weapon)
    const lines = []
    if (weapon.id === 'silver-guard' && adjacent.some(i => i.type === 'defense')) lines.push('防具邻接：攻击+1')
    if (weapon.id === 'mountain-maul' && adjacent.length === 0) lines.push('四向留白：攻击+3')
    if (conduitCapacity(this.run.backpack, weapon)) lines.push(`导流线：可用蓄势 ${this.state.conduitCharge || 0}/3`)
    if (forkBridgeActive(this.run.backpack, weapon)) lines.push('分叉接头：攻击+1')
    if (weapon.id === 'coin-blade') lines.push(`金币 ${this.run.player.gold}/12${this.run.player.gold >= 12 ? '，攻击+2' : ''}`)
    if (weapon.id === 'triad-tide') lines.push('最大射程命中：返还1体力')
    if (this.adjacent(weapon, 'range-disc')) lines.push(`\u6d4b\u8ddd\u76d8\uff1a\u4e0b\u6b21\u653b\u51fb\u84c4\u52bf ${this.state.sniperCharge || 0}/2`)
    if (this.adjacent(weapon, 'bone-nail')) lines.push('裂骨钉：碰撞伤害+2，延迟行动1次')
    const extra = this.expansion.attackContext(weapon, { moved: this.state.lastAction === 'movement', distance: 0, range: this.range(weapon) })
    if (extra.flat) lines.push(`圣遗物当前攻击加成：+${extra.flat}`)
    if (extra.attackMultiplier !== 1) lines.push(`圣遗物当前攻击力倍率：×${extra.attackMultiplier}`)
    if (extra.fuel) lines.push('燃金扣：本次攻击消耗1金币')
    if (this.run.totems.attackBonus()) lines.push(`战鼓图腾：攻击力+${this.run.totems.attackBonus()}`)
    if (this.expansion.cost(weapon)) lines.push('武器使用记录：本次体力消耗-1')
    for (const [id, valid, effect] of [
      ['scope', true, '射程+1'],
      ['r-range-mirror', true, '射程+1'],
      ['r-step-edge', true, '移动后立即攻击时，攻击力×2'],
      ['r-neutral-stone', true, '被克制时按中性计算'],
      ['r-miasma-sac', true, '攻击使敌人中毒'],
      ['mountain-shield', true, '攻击时生成盾击符'],
      ['farwatch-armor', true, '击杀时获得攻击距离等量护甲'],
      ['weight', true, '攻击+2，体力消耗+1'],
      ['chain', true, '距离2命中击退1格，碰撞伤害+2'],
      ['venom-sac', true, '\u4f7f\u654c\u4eba\u4e2d\u6bd2\uff0c5\u5c42'],
      ['spring', true, '击杀后，下一击更换武器体力消耗-1'],
      ['steady-clip', this.range(weapon) >= 2, '距离不超过2时攻击+1'],
      ['r-relay-badge', true, '\u653b\u51fb\u540e\uff0c\u4e0b\u6b21\u4f7f\u7528\u76f8\u90bb\u7684\u53e6\u4e00\u628a\u6b66\u5668\u4f24\u5bb3\u00d71.7'],
    ]) {
      if (valid && this.has(id) && adjacent.some(i => i.id === id)) lines.push(`${this.sourceName(id)}：${effect}`)
    }
    return [...lines, ...this.pendingLines(weapon)]
  }

  statusLines() {
    const lines = this.pendingLines()
    if (activeConduits(this.run.backpack).length) lines.push(`导流线：蓄势 ${this.state.conduitCharge || 0}/3`)
    if (this.has('r-phase-pointer')) lines.push('换相指针：换属性命中后，下次攻击伤害+1、体力消耗-1')
    if (this.run.backpack.items.some((item) => item.id === 'range-disc')) lines.push(`测距盘：蓄势 ${this.state.sniperCharge || 0}/2`)
    if (getStatus(this.run.player, 'parry')) lines.push('锈蚀短剑：下一次近战普通攻击减伤30%')
    if (this.has('wood-shield')) lines.push(`木盾：下次是第${(this.state.enemyAttacks || 0) % 2 === 0 ? 1 : 2}次受击（第2次触发）`)
    if (this.has('r-empty')) lines.push(`空匣印：空格${this.run.backpack.capacity - this.run.backpack.usedCells}/8${this.run.backpack.capacity - this.run.backpack.usedCells >= 8 ? '，武器体力消耗-1' : ''}`)
    if (this.has('r-three')) lines.push(`三相轮：武器属性${new Set(this.run.backpack.items.filter(i => i.type === 'weapon').map(i => i.attribute).filter(Boolean)).size}/3`)
    for (const id of ['r-traveler', 'r-step-boots', 'r-turn-shield']) {
      if (this.has(id) && this.state.lastAction === 'attack') lines.push(`${this.sourceName(id)}\uff1a\u4e0b\u4e00\u4e2a\u4e3b\u52a8\u79fb\u52a8\u56de\u5408\u89e6\u53d1`)
    }
    if (this.has('r-reverse')) lines.push('逆克石：武器克制关系已反转')
    if (this.has('r-blood')) lines.push(`血契铜镜：治疗减半；低血增伤${this.run.player.hp <= this.run.player.maxHp / 2 ? '已生效（+3）' : '未生效'}`)
    if (this.has('r-scales')) lines.push(`断刃秤：武器${this.run.backpack.items.filter(i => i.type === 'weapon').length}/1`)
    for (const weapon of this.run.backpack.items.filter(i => i.type === 'weapon')) {
      const spatial = this.weaponLines(weapon)
      if (spatial.length) lines.push(`${weapon.name} — ${spatial.join('；')}`)
    }
    return lines
  }
}
