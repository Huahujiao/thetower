import { combatDistance, chebyshev, manhattan, neighbors8, samePos } from '../core/geometry.js'
import { nextEntityId } from '../data/content.js'
import { isTotemBadge, TOTEM_COOLDOWN, TOTEM_DURATION, TOTEM_SUMMON_RANGE } from '../data/totems.js'
import { consumeStatus, getStatus, resolveStatusDamage } from './statuses.js'
import { findPath } from './pathfinding.js'

export class TotemRules {
  constructor(run) { this.run = run }
  get state() { return this.run.itemRules.state.totems ||= { readyAt: 0, wardTurn: -1 } }
  get entities() { return [...this.run.currentRoom.entities.values()].filter(entity => entity.kind === 'totem') }
  get badges() { return this.run.backpack.items.filter(isTotemBadge) }
  get cooldown() { return Math.max(0, this.state.readyAt - this.run.globalTurn) }
  active(totemId) { return this.entities.find(entity => entity.totemId === totemId) || null }
  nearby(totemId, position, radius) {
    const totem = this.active(totemId)
    return !!totem && manhattan(totem.pos, position) <= radius
  }
  available(item) {
    return isTotemBadge(item) && !!this.run.backpack.placementOf(item.uid) && !this.active(item.totemId) &&
      this.cooldown === 0 && this.run.player.maxEnergy > 0
  }
  targets(item) {
    if (!this.available(item)) return []
    const room = this.run.currentRoom, result = []
    for (let r = 0; r < room.height; r++) for (let c = 0; c < room.width; c++) {
      const position = { c, r }
      if (room.isRevealed(position) && room.isEmpty(position) && !samePos(position, this.run.player.pos) &&
          manhattan(position, this.run.player.pos) <= TOTEM_SUMMON_RANGE) result.push(position)
    }
    return result
  }
  summon(item, position) {
    const { run } = this
    if (!this.available(item)) return run._reject('该图腾已存在、召唤尚未冷却或体力上限不足。')
    if (!this.targets(item).some(target => samePos(target, position))) return run._reject('请选择距离4以内已翻开的空格，不能选择角色所在格。')
    if (!run._payAction(1)) return run._reject('体力不足。')
    const bornAt = run.globalTurn
    const totem = { id: nextEntityId('totem'), kind: 'totem', totemId: item.totemId, name: item.name,
      pos: { ...position }, bornAt, expiresAt: bornAt + TOTEM_DURATION, nextPulse: bornAt + 2 }
    run.currentRoom.addEntity(totem)
    run.player.maxEnergy--
    run.player.energy = Math.min(run.player.energy, run.player.maxEnergy)
    this.state.readyAt = bornAt + TOTEM_COOLDOWN
    run.selectedInventoryIndex = null; run.itemTargeting = false
    this.poisonNearby()
    run._log(`召唤${item.name}，暂时占用1点体力上限。`)
    run._endTurn({ recoverEnergy: false, action: 'summon' })
    run._changed()
    return true
  }
  remove(totem, reason = '消失', room = this.run.currentRoom) {
    if (!room.removeEntity(totem.id)) return false
    this.run.player.maxEnergy++
    this.run._log(`${totem.name}${reason}，返还1点体力上限。`)
    return true
  }
  leave(room) {
    for (const totem of [...room.entities.values()].filter(entity => entity.kind === 'totem')) this.remove(totem, '随离开房间消失', room)
  }
  attackBonus(position = this.run.player.pos) { return this.nearby('drum', position, 2) ? this.badges.length * 2 : 0 }
  movementBonus(position = this.run.player.pos, turn = this.run.globalTurn) {
    const totem = this.active('breath')
    return Number(!!totem && turn < totem.expiresAt && manhattan(position, totem.pos) <= 2)
  }
  beforeDamage(damage, context) {
    if (!(context.source === 'enemy:attack' || context.attack === true) || !this.nearby('ward', this.run.player.pos, 2)) return damage
    const turn = this.run._turnInProgress ? this.run.globalTurn : this.run.globalTurn + 1
    if (this.state.wardTurn === turn) return damage
    this.state.wardTurn = turn
    return Math.max(0, damage - 2)
  }
  onEnemyMoved(enemy) {
    if (!enemy || enemy.downed || !this.run.currentRoom.entity(enemy.id)) return
    const bind = this.active('bind')
    if (bind && manhattan(bind.pos, enemy.pos) === 1) this.run.applyStatus(enemy, 'rooted', { turns: 1 })
    this.poisonNearby(enemy)
  }
  poisonNearby(only = null) {
    const gas = this.active('gas')
    if (!gas) return
    const enemies = only ? [only] : [...this.run.currentRoom.entities.values()].filter(entity => entity.kind === 'enemy')
    for (const enemy of enemies) if (!enemy.downed && enemy.hp > 0 && manhattan(gas.pos, enemy.pos) <= 2 && !getStatus(enemy, 'enemy-poison')) {
      this.run.applyStatus(enemy, 'enemy-poison')
    }
  }
  onKill(enemy) {
    if (!this.nearby('spirit', enemy.pos, 3) || this.run.gameOver) return
    const room = this.run.currentRoom
    const choices = neighbors8(enemy.pos, room.width, room.height).filter(position => !room.isRevealed(position))
    const position = choices[Math.min(choices.length - 1, Math.floor(this.run.random() * choices.length))]
    if (position) this.run._revealTile(position, { cause: 'totem:spirit' })
  }
  startTurn() {
    for (const totem of this.entities) {
      if (totem.totemId !== 'soul' || this.run.globalTurn < totem.nextPulse || this.run.gameOver) continue
      totem.nextPulse = this.run.globalTurn + 2
      this.pull(totem)
    }
    this.poisonNearby()
  }
  endTurn() {
    for (const totem of this.entities) if (this.run.globalTurn >= totem.expiresAt) this.remove(totem, '到期消失')
  }
  // Ordinary chasers may break a totem on the shortest walkable route. Other
  // cards remain obstacles, and a cheaper unobstructed route takes precedence.
  path(enemy) {
    const room = this.run.currentRoom
    if (!(enemy.attack > 0) || !this.entities.length) return findPath(room, enemy.pos, this.run.player.pos)
    const passable = { width: room.width, height: room.height, isRevealed: position => room.isRevealed(position),
      isEmpty: position => room.isEmpty(position) || room.entityAt(position)?.kind === 'totem' }
    return findPath(passable, enemy.pos, this.run.player.pos)
  }
  obstacle(enemy) {
    const room = this.run.currentRoom
    const next = this.path(enemy)?.[0]
    return next && room.entityAt(next)?.kind === 'totem' ? room.entityAt(next) : null
  }
  attack(enemy, totem, { occupy = false } = {}) {
    const { run } = this, room = run.currentRoom
    if (!room.entity(totem.id) || !room.entity(enemy.id) || enemy.downed || getStatus(enemy, 'rooted')?.blocksAttack) return false
    const poison = getStatus(enemy, 'enemy-poison')
    if (poison) {
      run._damageEnemy(enemy, resolveStatusDamage(poison, { run, holder: enemy }), { source: 'item:poison', ignoreDefense: true })
      consumeStatus(enemy, 'enemy-poison', poison)
      if (!room.entity(enemy.id) || enemy.downed || run.gameOver) return false
    }
    const position = { ...totem.pos }
    if (!room.isRevealed(enemy.pos)) run._revealEnemy(room, enemy, { cause: 'totem:attack', triggerAlert: false })
    this.remove(totem, '被攻击摧毁')
    enemy.hasActed = true
    enemy.totemActionTurn = run.globalTurn
    enemy.attackCooldown = 0
    const reduction = getStatus(enemy, 'attack-reduction')
    const damage = Math.max(0, run.itemRules.expansion.enemyAttackDamage(enemy, Math.max(1, enemy.attack || 1), poison) - (reduction?.amount || 0))
    if (reduction) consumeStatus(enemy, 'attack-reduction', reduction)
    if (enemy.selfDestructOnAttack) {
      const blast = run._explodeEnemy(enemy, damage, 'large')
      run._defeatEnemy(enemy, { source: 'enemy:self-explosion', suppressDeathExplosion: true })
      run._queueExplosion({ roomId: room.id, enemyId: enemy.id, position: { ...enemy.pos },
        targetPosition: blast?.result?.evaded ? null : blast?.targetPosition || null, targetDefeated: !!blast && run.gameOver })
      return true
    }
    run.bus.emit('animate:attack', { roomId: room.id, actor: 'enemy', enemyId: enemy.id, actorStatus: { ...enemy, pos: { ...enemy.pos } }, position: { ...enemy.pos },
      targetPosition: position, evaded: false, targetDefeated: false })
    const from = { ...enemy.pos }
    if (occupy && room.moveEntity(enemy.id, position)) {
      // Movement callbacks are independent of the attacked totem's lifetime.
      this.onEnemyMoved(enemy); run.itemRules.expansion.spreadPoison(enemy)
      run.bus.emit('animate:enemy-move', { roomId: room.id, enemyId: enemy.id, from, to: { ...position } })
    }
    return true
  }
  pull(totem) {
    const { run } = this, room = run.currentRoom
    const radius = 1 + this.badges.filter(item => item.totemId !== 'soul').length
    const enemies = [...room.entities.values()].filter(enemy => enemy.kind === 'enemy' && !enemy.downed && enemy.hp > 0 &&
      combatDistance(enemy.pos, totem.pos, radius) <= radius).sort((a, b) => combatDistance(a.pos, totem.pos, radius) - combatDistance(b.pos, totem.pos, radius) ||
      manhattan(a.pos, totem.pos) - manhattan(b.pos, totem.pos) || a.id.localeCompare(b.id))
    const processed = new Set()
    for (const enemy of enemies) {
      if (!room.entity(totem.id) || run.gameOver) break
      if (processed.has(enemy.id) || !room.entity(enemy.id) || enemy.downed) continue
      processed.add(enemy.id)
      if (chebyshev(enemy.pos, totem.pos) === 1) {
        if (getStatus(enemy, 'rooted')?.blocksAttack) continue
        if (this.attack(enemy, totem, { occupy: true })) { run._onEnemyAction(enemy); break }
        continue
      }
      const next = neighbors8(enemy.pos, room.width, room.height).filter(position => !samePos(position, run.player.pos) &&
        !['door', 'totem'].includes(room.entityAt(position)?.kind) && chebyshev(position, totem.pos) < chebyshev(enemy.pos, totem.pos))
        .sort((a, b) => manhattan(a, totem.pos) - manhattan(b, totem.pos) || a.r - b.r || a.c - b.c)[0]
      if (!next) continue
      const displaced = room.entityAt(next)
      room.swapCards(enemy.pos, next)
      this.onEnemyMoved(enemy); run.itemRules.expansion.spreadPoison(enemy)
      if (displaced?.kind === 'enemy') {
        processed.add(displaced.id)
        this.onEnemyMoved(displaced); run.itemRules.expansion.spreadPoison(displaced)
      }
    }
  }
}
