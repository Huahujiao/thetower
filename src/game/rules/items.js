import { attributeModifier } from '../data/attributes.js'
import { getItemDefinition } from '../data/content.js'
import { getTalentDefinition } from '../data/talents.js'
import { combatDistance, neighbors8, chebyshev } from '../core/geometry.js'

// All spatial conditions are evaluated from occupied cells, never bounding boxes.
export function adjacentItems(backpack, item) {
  const placement = backpack.placementOf(item.uid)
  if (!placement) return []
  const own = backpack.cellsForPlacement(placement)
  return backpack.items.filter(other => other.uid !== item.uid && backpack.cellsForPlacement(backpack.placementOf(other.uid))
    .some(b => own.some(a => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1)))
}

export class ItemRules {
  constructor(run) { this.run = run }
  get state() { return this.run.player.itemState ||= { buffs: {}, lastAction: null, steps: 0, travel: 0 } }
  get room() { return this.run._roomRuntime().items ||= {} }
  has(id) { return this.run.backpack.items.some(i => (i.id || i.relicId) === id) }
  talent(id) { return this.run.hasTalent(id) }
  adjacent(item, id) { return adjacentItems(this.run.backpack, item).some(i => i.id === id) }
  buff(key, value) { this.state.buffs[key] = value }
  armor(amount, defense = false, sourceId = null) {
    if (amount <= 0 || this.run.gameOver) return
    if (sourceId) {
      const defenseItem = this.run.backpack.items.find(i => i.id === sourceId)
      if (defenseItem && this.adjacent(defenseItem, 'shield-core')) amount += 1
    }
    if (defense && this.talent('guard-gain') && this.run.player.armor === 0) amount += 1
    if (defense && this.talent('guard-reply')) this.buff('guard-reply', { flat: 1 })
    this.run.player.armor += amount
  }
  armorFloor(target, defense = false, sourceId = null) {
    if (sourceId) {
      const defenseItem = this.run.backpack.items.find(i => i.id === sourceId)
      if (defenseItem && this.adjacent(defenseItem, 'shield-core')) target += 1
    }
    if (defense && this.talent('guard-gain')) target += 1
    const gain = Math.max(0, target - this.run.player.armor)
    if (gain > 0) this.armor(gain, false)
    if (gain > 0 && defense && this.talent('guard-reply')) this.buff('guard-reply', { flat: 1 })
  }
  enter(firstVisit) {
    this.state.lastAction = 'enter'
    this.state.steps = 0
    this.state.travel = 0
    if (!firstVisit) return
    if (this.has('light-armor')) this.armor(3, true, 'light-armor')
    if (this.talent('guard-shell')) this.armor(2)
  }
  action(kind) {
    this.state.lastAction = kind
    if (kind !== 'movement') this.state.steps = 0
    if (kind === 'attack') this.state.travel = 0
  }
  move() {
    this.state.steps = (this.state.steps || 0) + 1
    this.state.travel = (this.state.travel || 0) + 1
    this.state.lastAction = 'movement'
  }
  range(weapon, position = this.run.player.pos) {
    let range = weapon.range || 1
    if (weapon.weaponClass === 'bow' && this.adjacent(weapon, 'scope')) range++
    if (this.has('r-scales') && this.run.backpack.items.filter(i => i.type === 'weapon').length === 1) range++
    const room = this.run.currentRoom
    if (weapon.id === 'ash-bow' && (position.c === 0 || position.r === 0 || position.c === room.width - 1 || position.r === room.height - 1)) range++
    return range
  }
  matchingBuffs(weapon) {
    return Object.entries(this.state.buffs).filter(([key, b]) =>
      (!key.startsWith('r-') || this.has(key)) && (key !== 'spring' || this.has(key)) &&
      (!b.other || b.other !== weapon.uid) && (!b.attribute || b.attribute === weapon.attribute) &&
      (!b.otherAttribute || b.otherAttribute !== weapon.attribute))
  }
  cost(weapon, extraSteps = 0) {
    let cost = weapon.energyCost
    if (weapon.weaponClass === 'heavy' && this.adjacent(weapon, 'weight')) cost++
    for (const [,b] of this.matchingBuffs(weapon)) cost -= b.discount || 0
    if (this.has('r-empty') && this.run.backpack.capacity - this.run.backpack.usedCells >= 8) cost--
    if (this.has('r-traveler')) {
      if (this.state.lastAction === 'movement' || extraSteps > 0) cost -= 2
      else if (this.state.lastAction === 'attack') cost++
    }
    return Math.max(1, cost)
  }
  attackContext(weapon, enemy) {
    const { run } = this
    let relation = attributeModifier(weapon.attribute, enemy.attribute)
    if (this.has('r-reverse')) relation = attributeModifier(enemy.attribute, weapon.attribute)
    const range = this.range(weapon)
    const distance = combatDistance(run.player.pos, enemy.pos, range)
    const moved = this.state.lastAction === 'movement'
    const switched = !!this.state.lastWeapon && this.state.lastWeapon !== weapon.uid
    let flat = 0
    if (weapon.id === 'silver-guard' && adjacentItems(run.backpack, weapon).some(i => i.type === 'defense')) flat++
    if (weapon.id === 'root-axe' && enemy.hp === enemy.maxHp) flat += 2
    if (weapon.id === 'tide-blade' && moved) flat += 2
    if (weapon.id === 'thorn-spear' && enemy.movedLastPhase) flat += 2
    if (weapon.id === 'wood-bow' && distance === range) flat += 2
    if (weapon.id === 'eagle-bow' && distance === range) flat += 3
    if (weapon.id === 'bell-maul' && this.state.lastAction !== 'attack') flat += 3
    if (weapon.id === 'wall-sword' && run.player.armor > 0) flat += 2
    if (weapon.id === 'mountain-maul' && adjacentItems(run.backpack, weapon).length === 0) flat += 4
    if (weapon.weaponClass === 'heavy' && this.adjacent(weapon, 'weight')) flat += 2
    const weapons = run.backpack.items.filter(i => i.type === 'weapon')
    if (this.has('r-scales') && weapons.length === 1) flat += 4
    if (this.has('r-blood') && run.player.hp <= run.player.maxHp / 2) flat += 3
    if (this.talent('flow-step') && moved) flat++
    if (this.talent('flow-switch') && switched && distance >= 2) flat += 2
    if (this.talent('flow-master') && moved && switched) flat += 2
    if (this.talent('harmony-counter') && relation.countered) flat++
    if (this.talent('survival-low') && run.player.hp <= run.player.maxHp / 2) flat++
    const buffs = this.matchingBuffs(weapon)
    flat += buffs.reduce((n,[,b]) => n + (b.flat || 0), 0)
    const triad = this.has('r-three') && new Set(weapons.map(i => i.attribute).filter(Boolean)).size === 3
    const multiplier = triad && relation.countered ? 2.2 : triad && relation.resisted ? 0.5 : relation.multiplier
    return { ...relation, flat, multiplier, buffs, distance, ignoreDefense: weapon.id === 'rock-maul' }
  }
  consume(context) {
    // Consume before hit callbacks so freshly generated bonuses survive for the next attack.
    for (const [key] of context.buffs) delete this.state.buffs[key]
    this.room.attacked = true
  }
  afterAttack(weapon, enemy, hit, context) {
    const { run } = this
    if (run.gameOver) return
    if (weapon.id === 'rust-sword') run.player.parry = { multiplier: 0.7 }
    if (weapon.id === 'wall-sword') run.player.armor = Math.max(0, run.player.armor - 2)
    if (hit.damage > 0 && this.state.lastAction === 'movement' && this.talent('flow-walk')) this.armorFloor(1)
    if (hit.damage > 0 && !enemy.downed && run.currentRoom.entity(enemy.id) && this.talent('harmony-switch') &&
        this.state.lastAttribute && this.state.lastAttribute !== weapon.attribute) {
      enemy.nextAttackReduction = 1
    }
    if (hit.damage > 0 && !enemy.downed && run.currentRoom.entity(enemy.id) && this.adjacent(weapon, 'venom-sac')) {
      enemy.itemPoisonTurns = 2
    }
    if (context.distance === 2 && ['ember-spear', 'soul-spear'].includes(weapon.id) && run.currentRoom.entity(enemy.id) && !enemy.downed) {
      run._knockbackEnemy(enemy, 1, { collisionDamage: (weapon.id === 'soul-spear' ? 3 : 0) + (this.adjacent(weapon, 'chain') ? 2 : 0) })
    }
    if (hit.defeated) {
      if (weapon.id === 'bone-knife') run._recoverEnergy(1)
      if (weapon.id === 'erosion-knife') run._recoverEnergy(context.countered ? 2 : 1)
      if (weapon.id === 'return-axe') this.buff('return-axe', { other: weapon.uid, flat: 2, discount: 1 })
      if (this.adjacent(weapon, 'spring')) this.buff('spring', { other: weapon.uid, discount: 1 })
      if (this.talent('flow-relay')) this.buff('flow-relay', { other: weapon.uid, discount: 1 })
      if (this.talent('harmony-kill') && context.countered) run._recoverEnergy(1)
      if (weapon.id === 'ember-axe') {
        const targets = run._activeEnemies().filter(e => chebyshev(e.pos, enemy.pos) === 1)
        for (const target of targets) {
          if (run.gameOver) break
          run._damageEnemy(target, 2, { source: 'item:explosion' })
        }
      }
    }
    if (run.gameOver) return
    if (hit.damage > 0 && this.has('tide-shield') && weapon.attribute === 'drown') this.armorFloor(2, true, 'tide-shield')
    if (hit.damage > 0 && this.has('red-armor') && weapon.attribute === 'scorch' && run.player.hp <= run.player.maxHp / 2) this.armorFloor(3, true, 'red-armor')
    if (this.talent('harmony-resist') && context.resisted) this.buff('harmony-resist', { flat: 2, otherAttribute: weapon.attribute })
    this.state.lastWeapon = weapon.uid
    this.state.lastAttribute = weapon.attribute
  }
  beforeDamage(damage, context) {
    if (context.source !== 'enemy:attack') return damage
    if (this.has('wood-shield')) {
      this.state.enemyAttacks = (this.state.enemyAttacks || 0) + 1
      if (this.state.enemyAttacks % 2 === 0) this.armorFloor(3, true, 'wood-shield')
    }
    if (context.enemy?.range > 1 && this.has('tide-cloak')) damage--
    if (this.talent('guard-hard') && this.run.player.armor > 0) damage--
    const attributes = new Set(this.run.backpack.items.filter(i => i.type === 'weapon').map(i => i.attribute).filter(Boolean))
    if (this.talent('harmony-three') && attributes.size === 3 && context.enemy?.attribute) damage--
    if (this.has('vine-armor') && neighbors8(this.run.player.pos, this.run.currentRoom.width, this.run.currentRoom.height).some(p => !this.run.currentRoom.isRevealed(p))) damage--
    return Math.max(0, damage)
  }
  afterDamage(context, healthDamage, armorBefore) {
    const { run } = this
    if (run.gameOver || run.player.hp <= 0 || context.source !== 'enemy:attack') return
    if (armorBefore > 0 && run.player.armor === 0) {
      if (this.has('red-shield')) this.buff('red-shield', { attribute: 'scorch', flat: 2 })
      if (this.talent('guard-last')) this.buff('guard-last', { flat: 2 })
    }
    if (healthDamage > 0 && run.player.hp <= run.player.maxHp / 2 && this.talent('survival-energy')) {
      this.state.healthHits = (this.state.healthHits || 0) + 1
      if (this.state.healthHits % 2 === 0) run._recoverEnergy(1)
    }
    if (healthDamage > 0 && context.enemy?.range === 1 && this.has('thorn-shield')) run._damageEnemy(context.enemy, 2, { source: 'item:thorns' })
  }
  discarded() {}

  sourceName(id) { return getItemDefinition(id)?.name || getTalentDefinition(id)?.name || id }

  pendingLines(weapon = null) {
    const buffs = weapon ? this.matchingBuffs(weapon) : Object.entries(this.state.buffs).filter(([key]) =>
      (!key.startsWith('r-') || this.has(key)) && (key !== 'spring' || this.has(key)))
    return buffs.map(([key, buff]) => {
      const conditions = []
      if (buff.other) conditions.push('换用其他武器')
      if (buff.attribute) conditions.push(({ scorch: '灼热', wither: '枯萎', drown: '沉溺' })[buff.attribute] + '武器')
      if (buff.otherAttribute) conditions.push('换用不同属性')
      return `${this.sourceName(key)}：下一击${buff.flat ? `伤害+${buff.flat}` : ''}${buff.discount ? ` 体力-${buff.discount}` : ''}${conditions.length ? `（${conditions.join('、')}）` : ''}`
    })
  }

  weaponLines(weapon) {
    const adjacent = adjacentItems(this.run.backpack, weapon)
    const lines = []
    if (weapon.id === 'silver-guard') lines.push(`防具邻接：${adjacent.some(i => i.type === 'defense') ? '已生效，攻击+1' : '未生效'}`)
    if (weapon.id === 'mountain-maul') lines.push(`四向留白：${adjacent.length === 0 ? '已生效，攻击+4' : '未生效'}`)
    for (const [id, valid, effect] of [
      ['scope', weapon.weaponClass === 'bow', '射程+1'],
      ['weight', weapon.weaponClass === 'heavy', '攻击+2，体力+1'],
      ['chain', ['ember-spear', 'soul-spear'].includes(weapon.id), '碰撞伤害+2'],
      ['venom-sac', true, '命中附毒并刷新至2回合'],
      ['spring', true, '击杀后为其他武器蓄势'],
    ]) {
      if (valid && this.has(id)) lines.push(`${this.sourceName(id)}：${adjacent.some(i => i.id === id) ? effect : '未相邻，不生效'}`)
    }
    return [...lines, ...this.pendingLines(weapon)]
  }

  statusLines() {
    const lines = this.pendingLines()
    if (this.run.player.parry) lines.push('锈蚀短剑：下一次近战普通攻击减伤30%')
    if (this.has('wood-shield')) lines.push(`木盾：下次是第${(this.state.enemyAttacks || 0) % 2 === 0 ? 1 : 2}次受击（第2次触发）`)
    if (this.talent('survival-energy')) lines.push(`续命：受生命伤害计数${(this.state.healthHits || 0) % 2}/2`)
    if (this.has('r-empty')) lines.push(`空匣印：空格${this.run.backpack.capacity - this.run.backpack.usedCells}/8${this.run.backpack.capacity - this.run.backpack.usedCells >= 8 ? '，武器体力-1' : ''}`)
    if (this.has('r-three')) lines.push(`三相轮：武器属性${new Set(this.run.backpack.items.filter(i => i.type === 'weapon').map(i => i.attribute).filter(Boolean)).size}/3`)
    if (this.has('r-traveler')) lines.push(`旅者骨牌：${this.state.lastAction === 'movement' ? '下一击体力-2' : this.state.lastAction === 'attack' ? '连续攻击体力+1' : '普通攻击费用'}`)
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
