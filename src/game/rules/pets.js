import { combatDistance, manhattan, neighbors8 } from '../core/geometry.js'
import { makeItemById } from '../data/content.js'
import { isSummonedEnemy } from '../data/enemies.js'
import { adjacentItems } from './backpack-geometry.js'
import { removeStatus } from './statuses.js'

// Player-hit marks survive the attack animation and save/load. They expire only
// after the matching global turn's enemy phase. Pet actions never alter weapon history.
export class PetRules {
  constructor(run) { this.run = run; this.activeAttack = null }
  get state() { return this.run.itemRules.state.pets ||= { horn: [], prey: [], butcher: [] } }
  has(id) { return this.run.itemRules.has(id) }
  ordered(items) {
    const bag = this.run.backpack
    return [...items].sort((a, b) => bag.originIndex(bag.placementOf(a.uid)) - bag.originIndex(bag.placementOf(b.uid)))
  }
  get pets() { return this.ordered(this.run.backpack.items.filter(item => item.type === 'pet')) }
  cost(pet) {
    return Math.max(1, pet.foodCost - Number(adjacentItems(this.run.backpack, pet).some(item => item.id === 'r-feeding-charm')))
  }
  range(pet, enemy = null) {
    return pet.range + Number(this.has('r-far-whistle')) +
      (enemy && this.has('r-hunting-horn') && this.state.horn.includes(enemy.id) ? 2 : 0)
  }
  foods(pet) {
    return this.ordered(adjacentItems(this.run.backpack, pet).filter(item => item.type === 'energy' ||
      (this.has('r-vampire-fang') && item.type === 'potion')))
  }
  points(item) { return item.type === 'energy' ? item.energy : item.heal }
  feedingPlan(pet) {
    const foods = this.foods(pet), ordinary = foods.filter(item => item.type === 'energy'), cost = this.cost(pet)
    const budget = values => values.reduce((sum, item) => sum + this.points(item), 0)
    const spend = (values, remaining, plan = []) => {
      for (const item of values) {
        const reserved = plan.find(entry => entry.item === item)?.amount || 0
        const amount = Math.min(remaining, this.points(item) - reserved)
        if (amount > 0) {
          const entry = plan.find(entry => entry.item === item)
          if (entry) entry.amount += amount
          else plan.push({ item, amount })
          remaining -= amount
        }
      }
      return plan
    }
    if (budget(ordinary) >= cost) return spend(ordinary, cost)
    const bottle = foods.find(item => item.type === 'potion' && this.points(item) > 0)
    const bloodCost = Math.max(1, cost - 1)
    if (!bottle || budget(foods) < bloodCost) return null
    // At least one bottle point must actually be spent to earn the discount.
    const plan = [{ item: bottle, amount: 1 }]
    let remaining = bloodCost - 1
    spend(ordinary, remaining, plan)
    remaining = bloodCost - plan.reduce((sum, entry) => sum + entry.amount, 0)
    return spend(foods.filter(item => item.type === 'potion'), remaining, plan)
  }
  enemies() {
    const room = this.run.currentRoom
    return [...room.entities.values()].filter(enemy => enemy.kind === 'enemy' && !enemy.downed && enemy.hp > 0 && room.isRevealed(enemy.pos))
  }
  target(pet) {
    const origin = this.run.player.pos
    return this.enemies().filter(enemy => combatDistance(origin, enemy.pos, this.range(pet, enemy)) <= this.range(pet, enemy))
      .sort((a, b) => Number(this.state.prey.includes(b.id)) - Number(this.state.prey.includes(a.id)) ||
        combatDistance(origin, a.pos, this.range(pet, a)) - combatDistance(origin, b.pos, this.range(pet, b)) ||
        a.pos.r - b.pos.r || a.pos.c - b.pos.c || a.id.localeCompare(b.id))[0] || null
  }
  playerAttack(enemy) {
    if (this.has('r-hunting-horn') && !this.state.horn.includes(enemy.id)) this.state.horn.push(enemy.id)
  }
  playerHit(weapon, enemy) {
    const key = weapon.id === 'hunter-shortbow' ? 'prey' : weapon.id === 'butcher-knife' ? 'butcher' : null
    if (key && !this.state[key].includes(enemy.id)) this.state[key].push(enemy.id)
    if (key === 'prey') this.run.applyStatus(enemy, 'prey')
  }
  reserve(plan) {
    const bag = this.run.backpack
    return plan.map(({ item, amount }) => {
      const entry = { item, amount, before: this.points(item), placement: { ...bag.placementOf(item.uid) } }
      item[item.type === 'energy' ? 'energy' : 'heal'] -= amount
      if (this.points(item) === 0) bag.removeByUid(item.uid)
      return entry
    })
  }
  refund(transaction) {
    if (transaction.refunded) return
    transaction.refunded = true
    for (const { item, before, placement } of transaction.foods) {
      item[item.type === 'energy' ? 'energy' : 'heal'] = before
      if (this.run.backpack.placementOf(item.uid)) continue
      if (this.run.backpack.canPlace(item, placement.x, placement.y, placement.rotation)) this.run.backpack.placements.push(placement)
      else this.run.itemRules.expansion.give(item)
    }
  }
  act() {
    const { run } = this, attacked = new Map()
    run.bus.emit('pets:started', { turn: run.globalTurn })
    for (const pet of this.pets) {
      if (run.gameOver) break
      if (!run.backpack.placementOf(pet.uid)) continue
      const target = this.target(pet), plan = this.feedingPlan(pet)
      if (!target || !plan) continue
      const prior = attacked.get(target.id) || new Set()
      const damage = pet.attack + (this.state.prey.includes(target.id) ? 2 : 0) + (this.has('r-pack-hunt') ? prior.size : 0)
      const transaction = { pet, targetId: target.id, foods: this.reserve(plan), refunded: false }
      this.activeAttack = transaction
      try {
        const position = { ...target.pos }
        const hit = run._damageEnemy(target, damage, { source: `pet:${pet.uid}`, ignoreDefense: pet.id === 'iron-beetle' })
        prior.add(pet.uid); attacked.set(target.id, prior)
        if (run.currentRoom.entity(target.id) && !target.downed && !hit.evaded) {
          if (pet.id === 'venom-toad') run.applyStatus(target, 'enemy-poison', { damage: 1 }, { refresh: true })
          if (pet.id === 'shadow-spider') target.actionDelay = Math.max(0, target.actionDelay || 0) + 1
        }
        if (!run.gameOver && pet.id === 'thunder-raven') {
          const bounce = this.enemies().filter(enemy => enemy.id !== target.id)
            .sort((a, b) => manhattan(a.pos, position) - manhattan(b.pos, position) || a.pos.r - b.pos.r || a.pos.c - b.pos.c)[0]
          if (bounce) run._damageEnemy(bounce, 1, { source: `pet:${pet.uid}` })
        }
        run._log(`${pet.name} \u5bf9 ${target.name} \u9020\u6210 ${hit.damage} \u4f24\u5bb3\u3002`)
        run.bus.emit('pet:attacked', { pet, enemy: target, hit, foodSpent: transaction.refunded ? 0 : plan.reduce((sum, entry) => sum + entry.amount, 0) })
      } finally {
        this.activeAttack = null
        if (!transaction.refunded) for (const { item } of transaction.foods) {
          if (this.points(item) === 0) run.itemRules.expansion.onConsumableConsumed(item)
        }
      }
    }
    run.bus.emit('pets:ended', { turn: run.globalTurn })
  }
  revealNear(enemy, cause) {
    const positions = neighbors8(enemy.pos, this.run.currentRoom.width, this.run.currentRoom.height)
      .filter(pos => !this.run.currentRoom.isRevealed(pos))
    if (positions.length) this.run._revealTile(positions[Math.min(positions.length - 1, Math.floor(this.run.random() * positions.length))], { cause })
  }
  onKill(enemy, source) {
    const transaction = this.activeAttack
    if (transaction && source === `pet:${transaction.pet.uid}`) {
      if (transaction.pet.id === 'carrion-rat' && enemy.id === transaction.targetId) this.refund(transaction)
      if (this.has('beast-armor')) this.run.itemRules.armor(2, true, 'beast-armor')
      if (transaction.pet.id === 'spirit-raven') this.revealNear(enemy, 'pet:spirit-raven')
    }
    if (this.state.butcher.includes(enemy.id) && !isSummonedEnemy(enemy)) {
      this.state.butcher = this.state.butcher.filter(id => id !== enemy.id)
      this.run.itemRules.expansion.give(makeItemById('meat-scrap'))
    }
  }
  endTurn() {
    for (const id of this.state.prey) removeStatus(this.run.currentRoom.entity(id), 'prey')
    this.run.itemRules.state.pets = { horn: [], prey: [], butcher: [] }
  }
}
