import { attributeModifier } from '../data/attributes.js'
import { getItemDefinition, makeItemById, randomConsumableOfTier } from '../data/content.js'
import { adjacentItems, emptyPerimeterCells } from './backpack-geometry.js'
import { getStatus } from './statuses.js'
import { isSummonedEnemy } from '../data/enemies.js'
import { manhattan, neighbors8 } from '../core/geometry.js'

export class ExpansionRules {
  constructor(run) { this.run = run }
  get items() { return this.run.itemRules }
  get state() { return this.items.state.expansion ||= { attacksReceived: 0, consumedTierOne: 0, cardsRevealed: 0 } }
  has(id) { return this.items.has(id) }
  adjacent(weapon, id) { return !getItemDefinition(id)?.disabled && adjacentItems(this.run.backpack, weapon).some(item => item.id === id) }
  defensesNextTo(weapon) { return adjacentItems(this.run.backpack, weapon).filter(item => item.type === 'defense') }
  relation(weapon, relation) {
    return relation.resisted && this.adjacent(weapon, 'r-neutral-stone') ? attributeModifier(null, null) : relation
  }
  cost(weapon) {
    const last = this.items.state.lastWeapon
    return Number(!!last && last === weapon.uid && this.has('r-single-seal')) +
      Number(!!last && last !== weapon.uid && this.has('r-switch-ring'))
  }
  attackContext(weapon, { moved, distance, range }) {
    const { player, backpack } = this.run
    let flat = 0
    if (this.has('r-lone-edge')) flat += emptyPerimeterCells(backpack, weapon).length
    if (this.has('r-armor-command')) flat += backpack.items.filter(item => item.type === 'defense').length
    if (this.has('r-iron-will')) flat += Math.floor(player.armor / 3)
    if (this.has('r-wealth-scale')) flat += Math.floor(player.gold / 5)
    const fuel = player.gold >= 1 && this.adjacent(weapon, 'r-gold-fuel') && this.adjacent(weapon, 'money-pouch')
    const attackMultiplier = (moved && this.adjacent(weapon, 'r-step-edge') ? 2 : 1) * (fuel ? 1.5 : 1)
    return { flat, attackMultiplier, fuel, bonusDamage: this.has('r-extreme-range') && range > 1 && distance === range ? 2 : 0 }
  }
  beforeAttack(weapon, context) {
    if (context.fuel) this.run.player.gold--
    if (this.has('r-armor-ring')) this.items.armor(this.defensesNextTo(weapon).length)
    if (this.adjacent(weapon, 'mountain-shield')) this.give(makeItemById('shield-bash'))
  }
  afterAttack(weapon, enemy, hit, context) {
    const { run } = this
    if (!hit.evaded && !enemy.downed && run.currentRoom.entity(enemy.id) && !(weapon.id === 'erosion-knife' && context.poison) && this.adjacent(weapon, 'r-miasma-sac')) {
      run.applyStatus(enemy, 'enemy-poison', { damage: 1 }, { refresh: true })
    }
    if (weapon.id === 'demon-seeker') {
      const nearest = [...run.currentRoom.entities.values()]
        .filter(candidate => candidate.kind === 'enemy' && candidate.id !== enemy.id && !run.currentRoom.isRevealed(candidate.pos))
        .sort((a, b) => manhattan(a.pos, enemy.pos) - manhattan(b.pos, enemy.pos) || a.id.localeCompare(b.id))[0]
      if (nearest) run._revealEnemy(run.currentRoom, nearest, { cause: 'item:demon-seeker' })
    }
    if (hit.defeated) {
      if (weapon.id === 'bounty-bow' && context.distance >= 2 && !isSummonedEnemy(enemy)) run.player.gold++
      if (this.adjacent(weapon, 'farwatch-armor')) this.items.armor(context.distance, true, 'farwatch-armor')
      if (weapon.id === 'scouting-bow' && context.distance >= 3) {
        const positions = neighbors8(enemy.pos, run.currentRoom.width, run.currentRoom.height).filter(pos => !run.currentRoom.isRevealed(pos))
        for (let index = 0; index < 2 && positions.length && !run.gameOver; index++) {
          const selected = Math.min(positions.length - 1, Math.floor(run.random() * positions.length))
          run._revealTile(positions.splice(selected, 1)[0], { cause: 'item:scouting-bow' })
        }
      }
    }
  }
  enemyAttackDamage(enemy, damage, poison = getStatus(enemy, 'enemy-poison')) {
    return this.has('r-bone-incense') && poison ? Math.floor(damage / 2) : damage
  }
  spreadPoison(enemy, poison = getStatus(enemy, 'enemy-poison')) {
    if (!poison || !this.has('r-plague-bell')) return
    const room = this.run.currentRoom
    const candidates = [...room.entities.values()].filter(candidate => candidate.kind === 'enemy' && candidate.id !== enemy.id &&
      !candidate.downed && candidate.hp > 0 && !getStatus(candidate, 'enemy-poison') && manhattan(candidate.pos, enemy.pos) <= 3)
    const target = candidates[Math.min(candidates.length - 1, Math.floor(this.run.random() * candidates.length))]
    if (target) this.run.applyStatus(target, 'enemy-poison', globalThis.structuredClone(poison), { refresh: true })
  }
  beforeDamage(damage, context) {
    if (context.source === 'enemy:attack' || context.attack === true) this.state.attacksReceived++
    if (damage > 0 && this.run.player.gold >= 1 && this.run.backpack.items.some(item => item.id === 'coin-armor' && this.adjacent(item, 'money-pouch'))) {
      this.run.player.gold--
      return Math.max(0, damage - 2)
    }
    return damage
  }
  afterDamage(armorBefore, armorAfter) {
    if (this.run.player.hp <= 0 || armorBefore <= 0 || armorAfter !== 0 || !this.has('renewal-armor')) return
    if (this.state.lastArmorRenewal != null && this.state.attacksReceived - this.state.lastArmorRenewal < 5) return
    this.state.lastArmorRenewal = this.state.attacksReceived
    this.items.armor(5, true, 'renewal-armor')
  }
  give(item) {
    if (!item || this.run.gameOver) return
    if (!this.run._putInInventory(item)) this.run.stageInventoryItem(item, { notify: false })
    this.run._log(`\u83b7\u5f97 ${item.name}\u3002`)
  }
  onConsumableUsed(item) {
    if (this.has('bath-robe')) this.items.armor(item.tier === 2 ? 3 : 1, true, 'bath-robe')
    this.onConsumableConsumed(item)
  }
  onConsumableConsumed(item) {
    if (item.tier === 1 && this.has('r-furnace')) {
      this.state.consumedTierOne++
      if (this.state.consumedTierOne % 2 === 0) this.give(randomConsumableOfTier(2, this.run.random))
    }
  }
  onEvent(event, context) {
    if (event === 'card:revealed' && this.has('r-pill-ticket')) {
      this.state.cardsRevealed++
      if (this.state.cardsRevealed % 5 === 0) this.give(randomConsumableOfTier(1, this.run.random))
    }
    if (event === 'enemy:killed') {
      this.spreadPoison(context.enemy)
      if (!isSummonedEnemy(context.enemy) && this.has('r-loot-pouch')) this.give(randomConsumableOfTier(1, this.run.random))
    }
    if (event === 'gold:collected' && this.has('gold-pick-armor')) this.items.armor(1, true, 'gold-pick-armor')
  }
}
