import { BackpackGrid } from './model/backpack.js'
import { GameRun } from './run.js'
import { createEnemyById, createGoldEntity, createLootEntity, makeItemById } from './data/content.js'
import { experienceToNextLevel } from './data/progression.js'

export const ART_TWEAK_VIEW = Object.freeze({
  fitRoom: true, zoom: 1, cameraElevation: 52 * Math.PI / 180, cameraAzimuth: 0,
  focus: Object.freeze({ c: 2.8, r: 1.65 }),
  // Closer framing keeps the upper right wall in view and crops its near end.
  framing: Object.freeze({ halfWidth: 2.35, halfDepth: 1.35, height: 1.6 }),
  showUnreachableCardAttributes: true,
})

const SCENE_SEED = 0x415254
const BACKPACK_ITEM_IDS = Object.freeze([
  'rust-sword',
  'root-axe',
  'wood-shield',
  'light-armor',
  'health-potion',
  'poison',
  'rage-wine',
  'money-pouch',
])

const REVEALED_ENEMIES = Object.freeze([
  { enemyId: 'gnawer', pos: { c: 1, r: 1 }, damage: 3 },
  { enemyId: 'rootrot-bud', pos: { c: 3, r: 1 }, damage: 7 },
  { enemyId: 'tide-shadow-cub', pos: { c: 4, r: 2 }, damage: 2 },
])

const HIDDEN_ATTRIBUTE_CARDS = Object.freeze([
  { itemId: 'ember-axe', pos: { c: 0, r: 2 } },
  { itemId: 'bone-knife', pos: { c: 2, r: 0 } },
  { itemId: 'tide-blade', pos: { c: 5, r: 3 } },
])

function seededRandom(seed = SCENE_SEED) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function resetRoom(room) {
  room.entities.clear()
  room.revealCounter = 0
  room.visited = true
  room.entry = { c: 2, r: 2 }
  for (const row of room.tiles) {
    for (const tile of row) Object.assign(tile, { revealed: false, peeked: false, entityId: null, terrain: 'plain' })
  }
}

function addBackpackItems(run) {
  run.backpack = new BackpackGrid()
  for (const itemId of BACKPACK_ITEM_IDS) {
    const item = makeItemById(itemId)
    if (!item || !run.backpack.add(item)) throw new Error(`Unable to place art tweak item: ${itemId}`)
  }
}

function addSceneEntities(room) {
  const enemies = REVEALED_ENEMIES.map(({ enemyId, pos, damage }) => {
    const enemy = createEnemyById(enemyId, pos)
    if (!enemy) throw new Error(`Missing art tweak enemy: ${enemyId}`)
    enemy.hp = Math.max(1, enemy.maxHp - damage)
    room.addEntity(enemy)
    room.reveal(pos)
    return enemy
  })

  for (const { itemId, pos } of HIDDEN_ATTRIBUTE_CARDS) {
    const item = makeItemById(itemId)
    if (!item) throw new Error(`Missing art tweak card item: ${itemId}`)
    room.addEntity(createLootEntity(item, pos))
  }

  room.addEntity(createGoldEntity(7, { c: 0, r: 1 }))
  room.reveal({ c: 0, r: 1 })
  room.addEntity(createLootEntity(makeItemById('health-potion'), { c: 5, r: 1 }))
  room.reveal({ c: 5, r: 1 })
  // White backs contain ordinary loot, just as they do in a live room.
  for (let r = 0; r < room.height; r++) {
    for (let c = 0; c < room.width; c++) {
      const pos = { c, r }
      if (room.isRevealed(pos) || !room.isEmpty(pos)) continue
      if (r > room.entry.r && (c + r) % 6 !== 0) {
        room.addEntity(createLootEntity(makeItemById(['ember-axe', 'bone-knife', 'tide-blade'][c % 3]), pos))
        continue
      }
      room.addEntity((c + r) % 3 === 0
        ? createGoldEntity(3 + (c + r) % 5, pos)
        : createLootEntity(makeItemById(['health-potion', 'iron-powder', 'poison', 'rage-wine'][(c + r) % 4]), pos))
    }
  }
  return enemies
}

function configureArtTweakState(run) {
  const room = run.currentRoom
  if (!room) throw new Error('Art tweak room was not created')
  resetRoom(room)

  run.player.pos = { c: 2, r: 2 }
  run.player.hp = 17
  run.player.maxHp = 24
  run.player.armor = 6
  run.player.gold = 27
  run.player.level = 4
  run.player.experience = 8
  run.player.experienceToNext = experienceToNextLevel(run.player.level)
  room.reveal(run.player.pos)
  // Connected explored ground makes the authored card backs reachable under
  // normal reveal rules, and gives the player routes to all three enemies.
  for (const pos of [
    { c: 1, r: 2 },
    { c: 2, r: 2 }, { c: 2, r: 1 }, { c: 3, r: 2 },
    { c: 4, r: 1 },
  ]) room.reveal(pos)

  const enemies = addSceneEntities(room)
  addBackpackItems(run)
  run.inventoryStash = []
  run.initialRelicChoices = []
  run.roomReward = null
  run.levelUp = null
  run.merchant = null
  run.selectedInventoryIndex = null
  run.itemTargeting = false
  run.phase = 'explore'
  run.gameOver = false
  run.win = false
  run.log = []
  run._logSequence = 0
  run._log('\u7f8e\u672f\u8c03\u6574\u6b8b\u5c40\uff1a\u4e09\u540d\u654c\u4eba\u5df2\u6fc0\u6d3b\uff0c\u573a\u4e0a\u4fdd\u7559\u4e09\u79cd\u5c5e\u6027\u724c\u4e0e\u65e0\u5c5e\u6027\u767d\u724c\u3002')
  run._synchronizeBattle()
  run.battle.round = 4
  run.battle.knownEnemyIds = enemies.map(enemy => enemy.id)
}

class ArtTweakRun extends GameRun {
  constructor() {
    super({ autoLoad: false, persistence: false, random: seededRandom() })
    this.sceneView = ART_TWEAK_VIEW
  }

  reset({ emit = true } = {}) {
    this.random = seededRandom()
    super.reset({ emit: false })
    configureArtTweakState(this)
    if (emit) this.bus.emit('change')
  }
}

export function createArtTweakRun() {
  return new ArtTweakRun()
}
