import assert from 'node:assert/strict'
import { GameRun } from '../src/game/run.js'
import { makeItemById, createEnemyById } from '../src/game/data/content.js'
import { BackpackGrid } from '../src/game/model/backpack.js'
import { RelicCollection } from '../src/game/model/relics.js'
import { RelicEngine } from '../src/game/rules/relics.js'

export function fixture() {
  const run = new GameRun({ autoLoad: false, random: () => 0.99 })
  run.initialRelicChoices = []
  run.backpack = new BackpackGrid()
  run.relics = new RelicCollection()
  run.relicEngine = new RelicEngine(run.relics)
  const room = run.currentRoom
  for (const entity of [...room.entities.values()]) room.removeEntity(entity.id)
  for (const row of room.tiles) for (const tile of row) { tile.revealed = true; tile.terrain = 'plain' }
  run.player.pos = { c: 3, r: 3 }
  return run
}
export function add(run, id, x = null, y = null) {
  const item = makeItemById(id)
  assert(item, id)
  assert(run.backpack.add(item), id)
  if (x !== null) assert(run.backpack.move(item.uid, x, y), id)
  if (item.type === 'relic') run.relics.acquire(item.relicId, { uid: item.uid })
  return item
}
export function select(run, item) { run.selectedInventoryIndex = run.backpack.originIndex(run.backpack.placementOf(item.uid)) }
export function enemy(run, { hp = 100, pos = { c: 4, r: 3 }, attribute = null, attack = 0, ...props } = {}) {
  const e = createEnemyById('gnawer', pos)
  Object.assign(e, { hp, maxHp: hp, attribute, attack, traits: [], actionDelay: 100, noLoot: true, noExperience: true, ...props })
  run.currentRoom.addEntity(e)
  return e
}
export function attack(run, weapon, target) { select(run, weapon); run.player.energy = 10; assert(run._attack(target)) }
