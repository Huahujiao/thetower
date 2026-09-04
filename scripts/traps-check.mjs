import assert from 'node:assert/strict'
import { GameRun } from '../src/game/run.js'
import { makeItemById } from '../src/game/data/content.js'
import { createTrapEntity, getTrapDefinition, randomTrapId } from '../src/game/data/traps.js'
import { TURN_KINDS } from '../src/game/core/turns.js'

assert.equal(getTrapDefinition('corrosion')?.effect, 'corrosion')
assert.equal(getTrapDefinition('poison-fog')?.effect, 'poison')
assert.equal(randomTrapId(() => 0.99), 'poison-fog')

const corrosionRun = new GameRun({ autoLoad: false, random: () => 0.25 })
const leftWeapon = corrosionRun.player.equipment[0]
leftWeapon.durability = 1
const rightWeapon = makeItemById('short-sword', () => 0.25)
rightWeapon.durability = 2
corrosionRun.player.equipment[1] = rightWeapon
corrosionRun.selectedEquipmentSlot = 0
const corrosionTrap = createTrapEntity('corrosion', corrosionRun.player.pos)
corrosionRun.currentRoom.addEntity(corrosionTrap)
corrosionRun._triggerTrap(corrosionTrap)
assert.equal(corrosionRun.player.equipment[0], null)
assert.equal(corrosionRun.player.equipment[1].uid, rightWeapon.uid)
assert.equal(corrosionRun.player.equipment[1].durability, 1)
assert.equal(corrosionRun.selectedEquipmentSlot, null)
assert.equal(corrosionTrap.triggered, true)
assert.equal(corrosionRun.currentRoom.entity(corrosionTrap.id), corrosionTrap)
corrosionRun._triggerTrap(corrosionTrap)
assert.equal(corrosionRun.player.equipment[1].durability, 1)
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
