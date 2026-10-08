import assert from 'node:assert/strict'
import { GameRun } from '../src/game/run.js'
import { createTrapEntity, getTrapDefinition, randomTrapId } from '../src/game/data/traps.js'
import { fixture, enemy, round, setBalls } from './item-test-helpers.mjs'
import { findRevealPath } from '../src/game/rules/pathfinding.js'
import { getStatus } from '../src/game/rules/statuses.js'
import { StaminaDeck } from '../src/game/model/stamina-deck.js'
import { playerStatusEntries } from '../src/ui/status-presentation.js'

assert.equal(getTrapDefinition('corrosion')?.effect, 'corrosion')
assert.equal(getTrapDefinition('poison-fog')?.effect, 'poison')
assert.equal(randomTrapId(() => 0.99), 'poison-fog')

const revealRun = new GameRun({ autoLoad: false, random: () => 0.25 })
revealRun.initialRelicChoices = []
const revealRoom = revealRun.currentRoom
let revealPosition = null
for (let r = 0; r < revealRoom.height && !revealPosition; r++) {
  for (let c = 0; c < revealRoom.width && !revealPosition; c++) {
    const position = { c, r }
    if (!revealRoom.isRevealed(position) && !revealRoom.entityAt(position) && findRevealPath(revealRoom, revealRun.player.pos, position)) revealPosition = position
  }
}
assert.ok(revealPosition)
const revealTrap = createTrapEntity('corrosion', revealPosition)
revealRoom.addEntity(revealTrap)
const writeOrder = []
const originalLog = revealRun._log.bind(revealRun)
revealRun._log = (message, options) => {
  writeOrder.push(message)
  return originalLog(message, options)
}
revealRun._flipAt(revealPosition)
const revealWriteIndex = writeOrder.findIndex((message) => message.includes('\u7ffb\u5f00\uff1a'))
const triggerWriteIndex = writeOrder.findIndex((message) => message.includes('\u89e6\u53d1'))
assert.ok(revealWriteIndex >= 0 && triggerWriteIndex >= 0 && revealWriteIndex < triggerWriteIndex)
const revealLogIndex = revealRun.log.findIndex((line) => line.includes('\u7ffb\u5f00\uff1a'))
const triggerLogIndex = revealRun.log.findIndex((line) => line.includes('\u89e6\u53d1'))
assert.ok(revealLogIndex >= 0 && triggerLogIndex >= 0 && revealLogIndex < triggerLogIndex)

const corrosionRun = fixture()
setBalls(corrosionRun, 6)
const corrosionTrap = createTrapEntity('corrosion', corrosionRun.player.pos)
corrosionRun.currentRoom.addEntity(corrosionTrap)
corrosionRun._triggerTrap(corrosionTrap)
assert.equal(corrosionRun.player.energy, 6)
assert.equal(getStatus(corrosionRun.player, 'fatigue').layers, 1)
assert.equal(playerStatusEntries(corrosionRun).find(entry => entry.id === 'fatigue').badge, '1')
assert.equal(corrosionTrap.triggered, true)
assert.equal(corrosionRun.currentRoom.entity(corrosionTrap.id), corrosionTrap)
corrosionRun._triggerTrap(corrosionTrap)
assert.equal(corrosionRun.player.energy, 6)
assert.equal(getStatus(corrosionRun.player, 'fatigue').layers, 1)
corrosionRun._endTurn()
assert.equal(corrosionRun.globalTurn, 0)
assert.equal(getStatus(corrosionRun.player, 'fatigue').layers, 1)
enemy(corrosionRun); corrosionRun._synchronizeBattle()
assert.equal(corrosionRun.player.energy, 5)
assert.equal(getStatus(corrosionRun.player, 'fatigue'), null)
round(corrosionRun)
assert.equal(corrosionRun.player.energy, 6)
assert.equal(corrosionRun.currentRoom.entity(corrosionTrap.id), corrosionTrap)
round(corrosionRun)
assert.equal(corrosionRun.currentRoom.entity(corrosionTrap.id), null)

// Exploration fatigue stacks, survives a save, and only reduces the first supply.
{
  const run = fixture()
  for (const pos of [run.player.pos, { c: 3, r: 4 }]) {
    const trap = createTrapEntity('corrosion', pos)
    run.currentRoom.addEntity(trap)
    run._triggerTrap(trap)
  }
  assert.equal(run.player.energy, 0)
  assert.equal(getStatus(run.player, 'fatigue').layers, 2)
  assert.equal(playerStatusEntries(run).find(entry => entry.id === 'fatigue').badge, '2')
  const payload = JSON.stringify(run.serialize()), previous = globalThis.localStorage
  globalThis.localStorage = { getItem: () => payload, setItem() {}, removeItem() {} }
  try {
    const loaded = new GameRun()
    assert.equal(loaded._loaded, true)
    assert.equal(getStatus(loaded.player, 'fatigue').layers, 2)
    enemy(loaded); loaded._synchronizeBattle()
    assert.equal(loaded.player.energy, 4)
    assert.equal(getStatus(loaded.player, 'fatigue'), null)
    round(loaded)
    assert.equal(loaded.player.energy, 6)
    assert(StaminaDeck.valid(loaded.staminaDeck.serialize()))
  } finally { globalThis.localStorage = previous }
}

// Combat trap costs one reveal ball plus one fatigue ball, with no status-bar flash.
{
  const run = fixture(); enemy(run); run._synchronizeBattle()
  const trap = createTrapEntity('corrosion', { c: 3, r: 4 })
  run.currentRoom.addEntity(trap)
  run.currentRoom.tile(trap.pos).revealed = false
  run.staminaDeck.toggle(run.staminaDeck.hand[0].id)
  const displayed = []
  run.on('change', () => displayed.push(playerStatusEntries(run).some(entry => entry.id === 'fatigue')))
  assert(run.clickTile(trap.pos.c, trap.pos.r))
  assert.equal(run.player.energy, 4)
  assert.equal(getStatus(run.player, 'fatigue'), null)
  assert(displayed.length > 0 && displayed.every(value => !value))
  assert(StaminaDeck.valid(run.staminaDeck.serialize()))
  round(run)
  assert.equal(run.player.energy, 6)
  setBalls(run, 2)
  for (const ball of run.staminaDeck.hand) run.staminaDeck.toggle(ball.id)
  run.applyStatus(run.player, 'fatigue', { layers: 5 })
  assert.equal(run.player.energy, 0)
  assert.deepEqual(run.staminaDeck.selected, [])
  run.applyStatus(run.player, 'fatigue')
  assert.equal(getStatus(run.player, 'fatigue'), null)
  assert(!playerStatusEntries(run).some(entry => entry.id === 'fatigue'))
  round(run)
  assert.equal(run.player.energy, 6)
  assert(StaminaDeck.valid(run.staminaDeck.serialize()))
}

// Fatigue exceeding supply yields zero balls without destroying any deck contents.
{
  const run = fixture()
  run.applyStatus(run.player, 'fatigue', { layers: 8 })
  enemy(run); run._synchronizeBattle()
  assert.equal(run.player.energy, 0)
  assert.equal(getStatus(run.player, 'fatigue'), null)
  assert(StaminaDeck.valid(run.staminaDeck.serialize()))
  round(run)
  assert.equal(run.player.energy, 6)
}

const poisonRun = fixture()
poisonRun.player.hp = 30
poisonRun.player.armor = 5
const poisonTrap = createTrapEntity('poison-fog', poisonRun.player.pos)
poisonRun.currentRoom.addEntity(poisonTrap)
poisonRun._triggerTrap(poisonTrap)
assert.equal(poisonRun.player.hp, 30)
assert.equal(poisonRun.player.armor, 5)
assert.equal(poisonRun.player.poisonedTurns, 3)
assert.equal(poisonTrap.triggered, true)
assert.equal(poisonRun.currentRoom.entity(poisonTrap.id), poisonTrap)

poisonRun._endTurn(); assert.equal(poisonRun.player.hp, 30)
enemy(poisonRun); round(poisonRun)
assert.equal(poisonRun.player.hp, 28)
assert.equal(poisonRun.player.armor, 5)
assert.equal(poisonRun.player.poisonedTurns, 2)
assert.equal(poisonRun.currentRoom.entity(poisonTrap.id), poisonTrap)
round(poisonRun)
assert.equal(poisonRun.currentRoom.entity(poisonTrap.id), null)
round(poisonRun)
assert.equal(poisonRun.player.hp, 24)
assert.equal(poisonRun.player.armor, 5)
assert.equal(poisonRun.player.poisonedTurns, 0)
round(poisonRun)
assert.equal(poisonRun.player.hp, 24)
for (let i = 0; i < 6; i++) round(poisonRun)
assert.equal(poisonRun.player.hp, 24)
assert.equal(poisonRun.player.poisonedTurns, 0)
round(poisonRun)
assert.equal(poisonRun.player.hp, 24)

console.log('traps-check passed')
