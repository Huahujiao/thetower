import assert from 'node:assert/strict'
import { createChapterDungeon, Dungeon, validateDungeonLayout } from '../src/game/model/dungeon.js'
import { GameRun } from '../src/game/run.js'

function seeded(seed) {
  let state = seed >>> 0
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 0x100000000)
}

for (let seed = 1; seed <= 100; seed++) {
  const { dungeon } = createChapterDungeon({ random: seeded(seed) })
  assert.equal(validateDungeonLayout(dungeon), true)
  assert.equal(dungeon.rooms.size, 16)
  assert.equal(dungeon.edges.size, 19)
  assert.equal(new Set([...dungeon.rooms.values()].map((room) => room.floor)).size, 12)
  for (let chapter = 1; chapter <= 4; chapter++) {
    const rooms = [...dungeon.rooms.values()].filter((room) => room.chapter === chapter)
    assert.deepEqual(rooms.map((room) => room.role), ['entry', 'elite', 'supply', 'boss'])
    assert.deepEqual(rooms.map((room) => room.floor), [(chapter - 1) * 3 + 1, (chapter - 1) * 3 + 2, (chapter - 1) * 3 + 2, (chapter - 1) * 3 + 3])
    for (const option of ['elite', 'supply']) {
      const route = [rooms[0], rooms.find((room) => room.role === option), rooms[3]]
      for (let index = 0; index < route.length - 1; index++) {
        assert([...dungeon.edges.values()].some((edge) => edge.fromRoomId === route[index].id && edge.toRoomId === route[index + 1].id))
      }
    }
    const boss = [...rooms[3].entities.values()].find((entity) => entity.boss)
    assert(boss)
    assert.equal(!!boss.finalBoss, chapter === 4)
    const branch = rooms.find((room) => room.role === 'elite')
    const bossEdge = [...dungeon.edges.values()].find((edge) => edge.fromRoomId === branch.id && edge.toRoomId === rooms[3].id)
    assert.equal(bossEdge.locked, true)
    assert([...branch.entities.values()].some((entity) => entity.kind === 'key' && entity.edgeId === bossEdge.id))
  }
  for (const room of dungeon.rooms.values()) {
    const cards = room.width * room.height
    const entities = [...room.entities.values()]
    assert.equal(entities.filter((entity) => entity.kind === 'enemy').length, Math.round(cards * 0.25))
    assert.equal(entities.filter((entity) => entity.kind === 'item' && entity.item?.type === 'weapon').length, Math.round(cards * 0.25))
    assert(entities.length / cards >= 0.9, `${room.id} has too many empty cards`)
    assert(!entities.some((entity) => entity.kind === 'item' && entity.item?.type === 'defense'), `${room.id} generated a defense on the ground`)
  }
  const restored = Dungeon.hydrate(dungeon.serialize())
  assert.equal(validateDungeonLayout(restored), true)
  assert.equal(restored.rooms.size, dungeon.rooms.size)
}

for (const option of ['elite', 'supply']) {
  const run = new GameRun({ autoLoad: false, random: seeded(712) })
  const first = [...run.dungeon.edges.values()].find((edge) => edge.branch?.chapter === 1 && edge.branch.option === option && run.dungeon.room(edge.fromRoomId).role === 'entry')
  run.player.pos = { ...first.fromDoor.arrival }
  run.currentRoom.reveal(run.player.pos)
  assert.equal(run._useDoor(first.fromDoor), true)
  assert.equal(run.currentRoom.role, option)
  assert.equal(run.roomReward.type, option === 'elite' ? 'relic' : 'supply')
  assert.equal([...run.dungeon.edges.values()].filter((edge) => edge.branch?.chapter === 1 && edge.sealed).length, 2)
  const restored = Dungeon.hydrate(run.dungeon.serialize())
  assert.equal([...restored.edges.values()].filter((edge) => edge.branch?.chapter === 1 && edge.sealed).length, 2)
  const storage = new Map()
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  }
  run._persist()
  const loaded = new GameRun({ random: seeded(712) })
  assert.equal(loaded.player.roomId, run.player.roomId)
  assert.equal([...loaded.dungeon.edges.values()].filter((edge) => edge.branch?.chapter === 1 && edge.sealed).length, 2)
  assert.equal(run.skipRoomReward(), true)
  const next = [...run.dungeon.edges.values()].find((edge) => edge.fromRoomId === run.currentRoom.id && run.dungeon.room(edge.toRoomId)?.role === 'boss')
  assert.equal(run.isDoorLocked(next.fromDoor), true)
  next.unlocked = true // Simulate collecting the key in the selected branch.
  run.player.pos = { ...next.fromDoor.arrival }
  run.currentRoom.reveal(run.player.pos)
  assert.equal(run._useDoor(next.fromDoor), true)
  assert.equal(run.currentRoom.role, 'boss')
  assert.equal(run.skipRoomReward(), true)
  const chapterBoss = [...run.currentRoom.entities.values()].find((entity) => entity.boss)
  const exit = [...run.dungeon.edges.values()].find((edge) => edge.fromRoomId === run.currentRoom.id)
  assert.equal(run.isDoorLocked(exit.fromDoor), true)
  run._defeatEnemy(chapterBoss, { suppressLoot: true, suppressDeathExplosion: true })
  assert.equal(run.win, false)
  assert.equal(run.isDoorLocked(exit.fromDoor), false)
}

const fullRun = new GameRun({ autoLoad: false, random: seeded(456) })
const visited = new Set([fullRun.currentRoom.id])
function enter(role) {
  const edge = [...fullRun.dungeon.edges.values()].find((candidate) => candidate.fromRoomId === fullRun.currentRoom.id && fullRun.dungeon.room(candidate.toRoomId).role === role)
  assert(edge, `missing ${role} from ${fullRun.currentRoom.id}`)
  if (edge.locked) edge.unlocked = true // Simulate collecting the key in the preceding room.
  fullRun.player.pos = { ...edge.fromDoor.arrival }
  fullRun.currentRoom.reveal(fullRun.player.pos)
  assert.equal(fullRun._useDoor(edge.fromDoor), true)
  visited.add(fullRun.currentRoom.id)
  if (fullRun.phase === 'reward') fullRun.skipRoomReward()
}
for (const option of ['elite', 'supply', 'elite', 'supply']) {
  if (fullRun.currentRoom.chapter > 1 || visited.size > 1) enter('entry')
  enter(option)
  enter('boss')
  if (fullRun.currentRoom.chapter < 4) {
    const boss = [...fullRun.currentRoom.entities.values()].find((entity) => entity.boss)
    fullRun._defeatEnemy(boss, { suppressLoot: true, suppressDeathExplosion: true })
  }
}
assert.equal(visited.size, 12)
assert.equal(fullRun.currentRoom.floor, 12)

const finalRun = new GameRun({ autoLoad: false, random: seeded(99) })
finalRun.player.roomId = finalRun.dungeon.roomOrder.at(-1)
const finalBoss = [...finalRun.currentRoom.entities.values()].find((entity) => entity.finalBoss)
finalRun._defeatEnemy(finalBoss, { suppressLoot: true, suppressDeathExplosion: true })
assert.equal(finalRun.win, true)
console.log('dungeon-check passed: 100 seeds, both routes, 12-room run, save restoration, chapter gates, final win')
