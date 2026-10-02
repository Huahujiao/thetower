import assert from 'node:assert/strict'
import { fixture, add, enemy, attack, select, round } from './item-test-helpers.mjs'
import { GameRun, SAVE_VERSION } from '../src/game/run.js'
import { makeItemById, nextEntityId } from '../src/game/data/content.js'
import { TOTEM_BADGES, isTotemBadge } from '../src/game/data/totems.js'
import { getStatus } from '../src/game/rules/statuses.js'
import { stepEnemy } from '../src/game/rules/enemies.js'
import { playerStatusEntries } from '../src/ui/status-presentation.js'
import { totemFaceData, drawTotemToken } from '../src/render/totem-token.js'
import { buildRelicChoices } from '../src/game/data/relics.js'
import { catalogContent } from '../src/ui/wiki-catalog.js'
import { readFile } from 'node:fs/promises'

function place(run, type, pos = { c: 2, r: 3 }) {
  const totem = { id: nextEntityId('totem'), kind: 'totem', totemId: type, name: TOTEM_BADGES.find(item => item.totemId === type).name,
    pos: { ...pos }, bornAt: run.globalTurn, expiresAt: run.globalTurn + 10, nextPulse: run.globalTurn + 2 }
  run.currentRoom.addEntity(totem); run.player.maxEnergy--; run.player.energy = Math.min(run.player.energy, run.player.maxEnergy)
  return totem
}
function summon(run, badge, pos = { c: 2, r: 3 }) {
  select(run, badge); assert(run.useSelected()); assert(run.itemTargeting)
  assert(run.clickTile(pos.c, pos.r)); return run.totems.active(badge.totemId)
}

assert.equal(TOTEM_BADGES.length, 7)
for (const badge of TOTEM_BADGES) {
  const item = makeItemById(badge.id)
  assert(isTotemBadge(item)); assert.equal(item.type, 'relic'); assert.equal(item.totemId, badge.totemId)
  assert.deepEqual(item.shape, [[1]])
  assert(catalogContent('relics').includes(badge.name))
  assert(buildRelicChoices(null, { count: 100 }).some(choice => choice.id === badge.id))
}

// Selection/aiming is free. Invalid targets do not change capacity, cooldown or ownership.
{
  const run = fixture(), badge = add(run, 'r-totem-drum')
  select(run, badge); assert(run.useSelected()); assert.equal(run.globalTurn, 0)
  for (const pos of [{ c: 3, r: 3 }, { c: 0, r: 0 }, { c: 20, r: 20 }]) assert.equal(run.clickTile(pos.c, pos.r), false)
  const target = enemy(run)
  assert.equal(run.clickTile(target.pos.c, target.pos.r), false)
  run.currentRoom.tile({ c: 2, r: 3 }).revealed = false
  assert.equal(run.clickTile(2, 3), false)
  assert.equal(run.player.maxEnergy, 6); assert.equal(run.totems.cooldown, 0); assert.equal(run.globalTurn, 0)
  run.currentRoom.tile({ c: 2, r: 3 }).revealed = true
  assert(run.clickTile(2, 3)); assert.equal(run.globalTurn, 0)
  assert(run.backpack.placementOf(badge.uid)); assert.equal(run.player.maxEnergy, 5); assert.equal(run.player.energy, 5)
  assert.equal(run.itemTargeting, false); assert.equal(run.selectedItem, null)
  assert.equal(run.previewTileAction(2, 3), null); assert.equal(run.clickTile(2, 3), false)
  assert(run.showBoardDetail({ c: 2, r: 3 })); assert(run.detailPanel.description.includes('攻击力+2'))
}
// One instance per kind and a global shared cooldown. The badge remains grey while its entity lives.
{
  const run = fixture(), first = add(run, 'r-totem-drum'), second = add(run, 'r-totem-gas')
  enemy(run); const totem = summon(run, first)
  assert.equal(run.totems.cooldown, 2); assert.equal(run.totems.available(second), false)
  assert.equal(run.itemRules.relicEffectActive(first.id), false)
  assert(playerStatusEntries(run).some(status => status.id === 'totem-cooldown' && status.badge === '2'))
  round(run); assert.equal(run.totems.cooldown, 1)
  round(run); assert.equal(run.totems.cooldown, 0)
  assert.equal(run.totems.available(first), false); assert.equal(run.totems.available(second), true)
  summon(run, second, { c: 3, r: 2 }); assert.equal(run.player.maxEnergy, 4)
  run.player.energy = 2
  assert(run.totems.remove(totem)); assert.equal(run.player.maxEnergy, 5); assert.equal(run.player.energy, 2)
  assert.equal(run.totems.remove(totem), false); assert.equal(run.player.maxEnergy, 5)
}
// Ten full subsequent global turns, including inventory/action turns, expire the entity exactly once.
{
  const run = fixture(), badge = add(run, 'r-totem-ward'); enemy(run); const totem = summon(run, badge)
  run.player.energy = 1
  for (let index = 0; index < 9; index++) round(run)
  assert(run.currentRoom.entity(totem.id)); assert.equal(totem.expiresAt - run.globalTurn, 1)
  round(run)
  assert.equal(run.currentRoom.entity(totem.id), null); assert.equal(run.player.maxEnergy, 6); assert.equal(run.player.energy, 6)
  assert(run.totems.available(badge))
}
// Leaving clears every old-room entity and only refunds capacity; stashing a badge does not dispel it.
{
  const run = fixture(), badge = add(run, 'r-totem-drum')
  const first = summon(run, badge), second = place(run, 'gas', { c: 3, r: 2 })
  run.backpack.removeByUid(badge.uid); run.inventoryStash.push(badge)
  assert(run.currentRoom.entity(first.id)); run.player.energy = 2
  run._emitRelicEvent('room:left', { room: run.currentRoom })
  assert.equal(run.currentRoom.entity(first.id), null); assert.equal(run.currentRoom.entity(second.id), null)
  assert.equal(run.player.maxEnergy, 6); assert.equal(run.player.energy, 2)
}
// Drum counts backpack badges, includes itself, ignores stash and ordinary relics, and uses live distance.
{
  const run = fixture(), weapon = add(run, 'bone-knife'), badge = add(run, 'r-totem-drum'), gas = add(run, 'r-totem-gas')
  add(run, 'r-loot-pouch'); const totem = place(run, 'drum')
  assert.equal(run.totems.attackBonus(), 4)
  const target = enemy(run); attack(run, weapon, target); assert.equal(target.hp, 94); assert.equal(run.player.lastAttackPower, 6)
  run.backpack.removeByUid(gas.uid); run.inventoryStash.push(gas); assert.equal(run.totems.attackBonus(), 2)
  run.player.pos = { c: 5, r: 3 }; assert.equal(run.totems.attackBonus(), 0)
  run.player.pos = { c: 4, r: 3 }; assert.equal(run.totems.attackBonus(), 2)
  run.totems.remove(totem); assert.equal(run.totems.attackBonus(), 0); assert(isTotemBadge(badge))
}
// Ward is first non-dodged attack of a global turn, does not protect traps, and resets next turn.
{
  const run = fixture(); place(run, 'ward')
  const attacker = enemy(run, { attack: 5, actionDelay: 0 }), second = enemy(run, { attack: 5, actionDelay: 0, pos: { c: 3, r: 4 } })
  run.player.hp = 100; run.player.armor = 0
  round(run); assert.equal(run.player.hp, 92)
  round(run); assert.equal(run.player.hp, 84)
  run.applyStatus(run.player, 'dodge', { layers: 1 })
  round(run); assert.equal(run.player.hp, 81)
  run._damagePlayer(3, { source: 'trap:explosion' }); assert.equal(run.player.hp, 78)
  assert.equal(attacker.attack, 5); assert.equal(second.attack, 5)
  run.player.pos = { c: 5, r: 3 }; run._damagePlayer(5, { source: 'enemy:attack' }); assert.equal(run.player.hp, 73)
}
// Breath adds recovery on movement, including the final step of a paired attack; forecast agrees.
{
  const run = fixture(), weapon = add(run, 'bone-knife'); place(run, 'breath', { c: 2, r: 2 })
  run.player.energy = 2; run._walk([{ c: 3, r: 2 }]); assert.equal(run.player.energy, 2)
  run.player.pos = { c: 3, r: 3 }
  const target = enemy(run, { pos: { c: 5, r: 3 } })
  run._synchronizeBattle(); run.player.energy = 2
  weapon.energyCost = 2; select(run, weapon)
  const route = run._weaponRoute(weapon, target)
  // Outside the aura, a movement costs one. Inside it, the explicit bonus refunds one.
  assert.equal(run.energyAfterMovement(route.path.length, route.path), 1)
  run.currentRoom.moveEntity(run.totems.active('breath').id, { c: 4, r: 2 })
  assert.equal(run.energyAfterMovement(route.path.length, route.path), 2)
  assert(run._attack(target)); run.bus.emit('animate:attack-complete', { actor: 'player' })
  assert.equal(run.player.energy, 0); assert.equal(target.hp, 98)
}
// Spirit flips one actual neighboring card and honors hidden trap effects and flip rewards.
{
  const run = fixture(); place(run, 'spirit'); add(run, 'r-pill-ticket')
  run.itemRules.expansion.state.cardsRevealed = 4
  const victim = enemy(run, { hp: 1 })
  const hidden = { c: 4, r: 4 }; run.currentRoom.tile(hidden).revealed = false
  run.currentRoom.addEntity({ id: nextEntityId('trap'), kind: 'trap', trapId: 'explosion', pos: hidden })
  const health = run.player.hp; run._damageEnemy(victim, 1)
  assert(run.currentRoom.isRevealed(hidden)); assert.equal(run.itemRules.expansion.state.cardsRevealed, 5)
  assert.equal(run.player.hp, health - 2); assert(run.backpack.items.some(item => item.tier === 1))
}
// Bind interrupts swift movement and suppresses both ordinary and totem attacks for one turn.
{
  const run = fixture(); place(run, 'bind', { c: 3, r: 2 })
  const target = enemy(run, { pos: { c: 4, r: 1 }, attack: 4, behavior: 'chaser', actionDelay: 0, traits: ['swift'] })
  run.player.pos = { c: 1, r: 1 }
  round(run)
  const rooted = getStatus(target, 'rooted'); assert(rooted); assert.equal(rooted.turns, 1); assert.equal(rooted.layers, 100)
  const position = { ...target.pos }, hp = run.player.hp
  assert.equal(run._enemyAttack(target).cancelled, true)
  assert.equal(run.totems.attack(target, run.totems.active('bind')), false)
  round(run); assert.deepEqual(target.pos, position); assert.equal(run.player.hp, hp)
  assert.equal(getStatus(target, 'rooted'), null)
  round(run); assert.notDeepEqual(target.pos, position)
}
// Gas affects hidden enemies immediately, does not replace stronger poison, and applies on arrivals.
{
  const run = fixture(), badge = add(run, 'r-totem-gas')
  const hidden = enemy(run, { pos: { c: 1, r: 3 } }), already = enemy(run, { pos: { c: 2, r: 2 } })
  run.currentRoom.tile(hidden.pos).revealed = false
  const old = run.applyStatus(already, 'enemy-poison', { layers: 5, turns: 12, damage: 7 })
  summon(run, badge)
  assert(getStatus(hidden, 'enemy-poison')); assert.equal(getStatus(hidden, 'enemy-poison').showTurns, false)
  assert.equal(getStatus(already, 'enemy-poison'), old); assert.equal(old.damage, 7)
  const newcomer = enemy(run, { pos: { c: 4, r: 2 } }); assert(run._moveEnemy(newcomer, { c: 3, r: 2 }))
  assert(getStatus(newcomer, 'enemy-poison'))
}
// Chasers break only the next totem on a shortest path, use cooldown, and do not attack player too.
{
  const run = fixture(); run.player.pos = { c: 0, r: 0 }
  const totem = place(run, 'ward', { c: 1, r: 0 })
  for (const row of run.currentRoom.tiles) for (const tile of row) tile.revealed = false
  for (const pos of [{ c: 0, r: 0 }, { c: 1, r: 0 }, { c: 2, r: 0 }]) run.currentRoom.tile(pos).revealed = true
  const attacker = enemy(run, { pos: { c: 2, r: 0 }, attack: 3, range: 1, behavior: 'chaser', actionDelay: 0, attackCooldownMax: 3 })
  run.player.energy = 2; const hp = run.player.hp
  round(run)
  assert.equal(run.currentRoom.entity(totem.id), null); assert.equal(run.player.maxEnergy, 6); assert.equal(run.player.energy, 6)
  assert.equal(run.player.hp, hp); assert.equal(attacker.attackCooldown, 2); assert.equal(attacker.ownActionCount, 1)
  assert.deepEqual(attacker.pos, { c: 2, r: 0 })
}
// A normal enemy can take a shorter free route, and rooted enemies cannot hit a blocker.
{
  const run = fixture(); run.player.pos = { c: 0, r: 0 }
  const totem = place(run, 'ward', { c: 1, r: 0 })
  for (const row of run.currentRoom.tiles) for (const tile of row) tile.revealed = false
  for (let c = 0; c <= 3; c++) run.currentRoom.tile({ c, r: 0 }).revealed = true
  const attacker = enemy(run, { pos: { c: 3, r: 0 }, attack: 3, behavior: 'chaser', actionDelay: 0 })
  round(run)
  assert.deepEqual(attacker.pos, { c: 2, r: 0 }); assert(run.currentRoom.entity(totem.id))
  round(run)
  assert.equal(run.currentRoom.entity(totem.id), null); assert.deepEqual(attacker.pos, { c: 2, r: 0 })
}
// A normal enemy can take a shorter free route, and rooted enemies cannot hit a blocker.
{
  const run = fixture(); run.player.pos = { c: 0, r: 0 }
  const totem = place(run, 'drum', { c: 2, r: 0 }), attacker = enemy(run, { pos: { c: 2, r: 1 }, attack: 3, behavior: 'chaser', actionDelay: 0 })
  assert.equal(run.totems.obstacle(attacker), null)
  run.applyStatus(attacker, 'rooted', { turns: 1 })
  const outcome = stepEnemy(attacker, { room: run.currentRoom, player: run.player, attack: () => assert.fail('rooted attack') })
  assert.equal(outcome.reason, 'rooted'); assert(run.currentRoom.entity(totem.id))
}
// Soul pulses every two turns. Pulls card content, reveal state and terrain together, without triggering traps.
{
  const run = fixture(); run.player.pos = { c: 0, r: 0 }
  add(run, 'r-totem-drum'); add(run, 'r-totem-gas')
  const totem = place(run, 'soul', { c: 2, r: 3 })
  const target = enemy(run, { pos: { c: 5, r: 3 } })
  const trap = { id: nextEntityId('trap'), kind: 'trap', trapId: 'explosion', pos: { c: 4, r: 3 } }
  run.currentRoom.addEntity(trap); run.currentRoom.tile(trap.pos).revealed = false; run.currentRoom.tile(trap.pos).terrain = 'mud'
  const hp = run.player.hp
  round(run); assert.deepEqual(target.pos, { c: 5, r: 3 })
  round(run); assert.deepEqual(target.pos, { c: 4, r: 3 })
  assert.deepEqual(trap.pos, { c: 5, r: 3 }); assert.equal(trap.triggered, undefined); assert.equal(run.player.hp, hp)
  assert(run.currentRoom.isRevealed(target.pos)); assert(!run.currentRoom.isRevealed(trap.pos)); assert.equal(run.currentRoom.tile(trap.pos).terrain, 'mud')
  round(run); assert.deepEqual(target.pos, { c: 4, r: 3 })
  round(run); assert.deepEqual(target.pos, { c: 3, r: 3 }); assert(run.currentRoom.entity(totem.id))
  round(run); round(run)
  assert.equal(run.currentRoom.entity(totem.id), null); assert.deepEqual(target.pos, { c: 2, r: 3 }); assert.equal(run.player.maxEnergy, 6)
  assert.equal(target.ownActionCount, 1)
}
// Near-to-far order vacates cells for the next enemy, each enemy moves at most once per pulse.
{
  const run = fixture(); run.player.pos = { c: 0, r: 0 }
  for (const id of ['r-totem-drum', 'r-totem-gas', 'r-totem-ward']) add(run, id)
  const totem = place(run, 'soul', { c: 2, r: 3 })
  const near = enemy(run, { pos: { c: 4, r: 3 } }), far = enemy(run, { pos: { c: 5, r: 3 } })
  run.totems.pull(totem)
  assert.deepEqual(near.pos, { c: 3, r: 3 }); assert.deepEqual(far.pos, { c: 4, r: 3 })
  assert(run.currentRoom.entity(totem.id))
}
// Soul initial range includes eight neighbors; hidden enemies attack/reveal, rooted ones cannot attack.
{
  const run = fixture(); run.player.pos = { c: 0, r: 0 }
  const totem = place(run, 'soul', { c: 3, r: 3 }), target = enemy(run, { pos: { c: 4, r: 4 }, attack: 3 })
  run.currentRoom.tile(target.pos).revealed = false
  run.applyStatus(target, 'rooted', { turns: 1 }); run.totems.pull(totem); assert(run.currentRoom.entity(totem.id))
  run.removeStatus(target, 'rooted'); run.player.energy = 1
  run.totems.pull(totem); assert.equal(run.currentRoom.entity(totem.id), null)
  assert.deepEqual(target.pos, { c: 3, r: 3 }); assert(run.currentRoom.isRevealed(target.pos))
  assert.equal(run.player.maxEnergy, 6); assert.equal(run.player.energy, 5)
}
// Poison on an attack against a totem is still triggered first; a lethal last layer cancels the hit.
{
  const run = fixture(); const totem = place(run, 'ward'), target = enemy(run, { hp: 1, attack: 5 })
  run.applyStatus(target, 'enemy-poison', { layers: 1, damage: 1 })
  assert.equal(run.totems.attack(target, totem), false); assert(run.currentRoom.entity(totem.id)); assert.equal(run.player.maxEnergy, 5)
}
// Saved entities, shared cooldown, reduced capacity and root state survive; malformed/old saves restart.
{
  const run = fixture(); run.player.pos = { c: 0, r: 0 }
  const totem = place(run, 'drum', { c: 3, r: 3 }), bomber = enemy(run, { attack: 5, selfDestructOnAttack: true })
  let explosions = 0; run.on('animate:explode', () => explosions++)
  run.applyStatus(bomber, 'attack-reduction', { amount: 1 })
  assert(run.totems.attack(bomber, totem))
  assert.equal(run.currentRoom.entity(bomber.id), null); assert.equal(run.currentRoom.entity(totem.id), null)
  assert.equal(explosions, 1); assert.equal(run.player.maxEnergy, 6)
}
// A root created by a soul pull blocks the upcoming enemy phase and expires with that turn.
{
  const run = fixture(); run.player.pos = { c: 0, r: 0 }
  add(run, 'r-totem-drum'); add(run, 'r-totem-gas')
  place(run, 'soul', { c: 2, r: 3 }); place(run, 'bind', { c: 3, r: 2 })
  const target = enemy(run, { pos: { c: 4, r: 3 }, attack: 3, actionDelay: 0, behavior: 'chaser' })
  round(run)
  round(run)
  assert.deepEqual(target.pos, { c: 3, r: 3 }); assert.equal(getStatus(target, 'rooted'), null)
}
// Saved entities, shared cooldown, reduced capacity and root state survive; malformed/old saves restart.
{
  const run = fixture(), badge = add(run, 'r-totem-gas'), totem = summon(run, badge)
  const target = enemy(run); run._synchronizeBattle(); run.applyStatus(target, 'rooted', { turns: 1 }); run.player.energy = 3
  const original = run.serialize(), previous = globalThis.localStorage
  let payload = JSON.stringify(original), deleted = 0
  globalThis.localStorage = { getItem: () => payload, setItem: (_key, value) => { payload = value }, removeItem: () => { deleted++; payload = null } }
  try {
    const loaded = new GameRun({ autoLoad: true })
    assert.equal(deleted, 0); assert.equal(loaded.player.maxEnergy, 5); assert.equal(loaded.player.energy, 3)
    assert.equal(loaded.totems.cooldown, 2); assert(getStatus(loaded.currentRoom.entity(target.id), 'rooted'))
    loaded.totems.remove(loaded.currentRoom.entity(totem.id)); assert.equal(loaded.player.maxEnergy, 6); assert.equal(loaded.player.energy, 3)
    for (const mutation of [data => { data.version = SAVE_VERSION - 1 }, data => { data.player.maxEnergy = 10 },
      data => { data.player.itemState.totems.readyAt = 'bad' }]) {
      const corrupted = JSON.parse(JSON.stringify(original)); mutation(corrupted); payload = JSON.stringify(corrupted)
      const fresh = new GameRun({ autoLoad: true }); assert.equal(fresh.player.maxEnergy, 6); assert.equal(fresh.totems.entities.length, 0)
    }
    assert.equal(deleted, 3)
  } finally { globalThis.localStorage = previous }
}
// Placeholder rendering shows decoded glyphs, labels and remaining duration. UI accepts relic summoning.
{
  const card = totemFaceData({ totemId: 'drum', name: '战鼓图腾', expiresAt: 10 }, 3)
  assert.equal(card.remaining, 7); assert.equal(card.glyph, '鼓')
  const labels = [], context = new Proxy({ fillText: text => labels.push(text) }, { get: (target, key) => target[key] || (() => {}) })
  drawTotemToken(context, card); assert(labels.includes('战鼓图腾')); assert(labels.includes('7回合'))
  const hud = await readFile(new URL('../src/ui/VueHud.vue', import.meta.url), 'utf8')
  assert(hud.includes(':disabled="!selectedUseAvailable"')); assert(hud.includes('isTotemBadge(item)'))
}

console.log('totems-check passed: seven badges, summoning, shared cooldown, capacity, lifetimes, auras, stun, obstacles, soul swaps and saves')
