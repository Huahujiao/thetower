import assert from 'node:assert/strict'
import { GameRun } from '../src/game/run.js'
import { createTrapEntity, getTrapDefinition, randomTrapId } from '../src/game/data/traps.js'
import { TURN_KINDS } from '../src/game/core/turns.js'
import { findRevealPath } from '../src/game/rules/pathfinding.js'

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

const corrosionRun = new GameRun({ autoLoad: false, random: () => 0.25 })
corrosionRun.player.energy = 6
const corrosionTrap = createTrapEntity('corrosion', corrosionRun.player.pos)
corrosionRun.currentRoom.addEntity(corrosionTrap)
corrosionRun._triggerTrap(corrosionTrap)
assert.equal(corrosionRun.player.energy, 4)
assert.equal(corrosionTrap.triggered, true)
assert.equal(corrosionRun.currentRoom.entity(corrosionTrap.id), corrosionTrap)
corrosionRun._triggerTrap(corrosionTrap)
assert.equal(corrosionRun.player.energy, 4)
corrosionRun._endTurn({ skipEnemyPhase: true, turnKind: TURN_KINDS.MOVEMENT })
assert.equal(corrosionRun.currentRoom.entity(corrosionTrap.id), corrosionTrap)
corrosionRun._endTurn({ skipEnemyPhase: true, turnKind: TURN_KINDS.MOVEMENT })
assert.equal(corrosionRun.currentRoom.entity(corrosionTrap.id), null)

const poisonRun = new GameRun({ autoLoad: false, random: () => 0.25 })
poisonRun.player.hp = 10
poisonRun.player.armor = 5
const poisonTrap = createTrapEntity('poison-fog', poisonRun.player.pos)
poisonRun.currentRoom.addEntity(poisonTrap)
poisonRun._triggerTrap(poisonTrap)
assert.equal(poisonRun.player.hp, 10)
assert.equal(poisonRun.player.armor, 5)
assert.equal(poisonRun.player.poisonedTurns, 3)
assert.equal(poisonTrap.triggered, true)
assert.equal(poisonRun.currentRoom.entity(poisonTrap.id), poisonTrap)

poisonRun._endTurn({ skipEnemyPhase: true, turnKind: TURN_KINDS.MOVEMENT })
assert.equal(poisonRun.player.hp, 8)
assert.equal(poisonRun.player.armor, 5)
assert.equal(poisonRun.player.poisonedTurns, 2)
assert.equal(poisonRun.currentRoom.entity(poisonTrap.id), poisonTrap)
poisonRun._endTurn({ skipEnemyPhase: true, turnKind: TURN_KINDS.MOVEMENT })
assert.equal(poisonRun.currentRoom.entity(poisonTrap.id), null)
poisonRun._endTurn({ skipEnemyPhase: true, turnKind: TURN_KINDS.MOVEMENT })
assert.equal(poisonRun.player.hp, 4)
assert.equal(poisonRun.player.armor, 5)
assert.equal(poisonRun.player.poisonedTurns, 0)
poisonRun._endTurn({ skipEnemyPhase: true, turnKind: TURN_KINDS.MOVEMENT })
assert.equal(poisonRun.player.hp, 4)

console.log('traps-check passed')
