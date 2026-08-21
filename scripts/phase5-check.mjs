import assert from 'node:assert/strict'
import { MODIFIER_OPERATIONS } from '../src/game/rules/modifiers.js'
import { EffectQueue, RESOLUTION_PHASES } from '../src/game/rules/resolution.js'
import { TriggerRegistry } from '../src/game/rules/triggers.js'
import { RelicState } from '../src/game/model/relics.js'
import { RelicEngine } from '../src/game/rules/relics.js'
import { RELIC_DEFS, buildRelicChoices } from '../src/data/relics.js'
import { GameState } from '../src/game/state.js'
import { buildRewardChoices, buildShopStock, MONSTERS, POTIONS, SUMMONS, WEAPONS, T, ENTRY_CARD } from '../src/data/cards.js'
import { computeDamage } from '../src/game/rules/combat.js'
import { bindLongPress } from '../src/ui/long-press.js'

const order = []
const defs = [
  {
    id: 'r_first', name: 'First',
    hooks: {
      test: ({ relic }) => {
        relic.runtime.count = (relic.runtime.count || 0) + 1
        return { id: 'first-hook', phase: RESOLUTION_PHASES.DAMAGE, apply: () => order.push('first') }
      },
    },
    modifiers: {
      damage: [{ operation: MODIFIER_OPERATIONS.PERCENT_ADD, phase: 'damage', value: 0.05 }],
    },
  },
  {
    id: 'r_second', name: 'Second',
    hooks: {
      test: () => ({ id: 'second-hook', phase: RESOLUTION_PHASES.DAMAGE, apply: () => order.push('second') }),
    },
    modifiers: {
      damage: [{ operation: MODIFIER_OPERATIONS.PERCENT_ADD, phase: 'damage', value: 0.05 }],
    },
  },
  { id: 'r_third', name: 'Third' },
]

const collection = new RelicState(defs, 2)
assert.deepEqual(collection.availableIds(), ['r_first', 'r_second', 'r_third'])
assert.equal(collection.acquire('r_first', { activate: true }).activated, true)
assert.equal(collection.acquire('r_second').activated, false)
assert.equal(collection.acquire('r_first').reason, 'already-collected')
assert.equal(collection.activate('r_second').ok, true)
assert.equal(collection.acquire('r_third', { activate: true }).activated, false)
assert.equal(collection.activeSize, 2)
assert.deepEqual(collection.collection, ['r_first', 'r_second', 'r_third'])

const triggers = new TriggerRegistry()
const engine = new RelicEngine({ collection, triggerRegistry: triggers, definitions: defs })
const effects = triggers.collect('test')
new EffectQueue().enqueueAll(effects).run()
assert.deepEqual(order, ['first', 'second'])
assert.equal(collection.getRuntime('r_first').count, 1)
assert.ok(Math.abs(engine.modifyNumber('damage', 100) - 110) < 1e-9)

const saved = collection.serialize()
const restored = new RelicState(defs, 2).restore(saved)
assert.deepEqual(restored.collection, ['r_first', 'r_second', 'r_third'])
assert.deepEqual(restored.active, ['r_first', 'r_second'])
assert.equal(restored.getRuntime('r_first').count, 1)
assert.equal(restored.activate('r_third').reason, 'active-full')
assert.equal(restored.setActive(['r_second', 'r_third']).ok, true)
assert.deepEqual(restored.active, ['r_second', 'r_third'])

assert.equal(RELIC_DEFS.length, 46)
assert.equal(new Set(RELIC_DEFS.map((def) => def.id)).size, 46)
assert.equal(buildRelicChoices({ count: 10, defs: RELIC_DEFS, collected: ['r_far_sight'] }).some((def) => def.id === 'r_far_sight'), false)
assert.equal(buildRewardChoices(1, { relicDefs: RELIC_DEFS, collected: [] }).some((reward) => reward.kind === 'relic'), true)
assert.equal(buildShopStock(3, { relicDefs: RELIC_DEFS, collected: [] }).filter((entry) => entry.type === 'relic').length, 1)
const initialState = new GameState()
const initialId = initialState.initialRelicChoices[0].id
assert.equal(initialState.chooseInitialRelic(initialId).activated, true)
assert.deepEqual(initialState.activeRelics, [initialId])
const activationState = new GameState()
assert.equal(activationState.acquireRelic('r_far_sight').activated, false)
assert.equal(activationState.activeRelics.length, 0)
assert.equal(activationState.activateRelic('r_far_sight').reason, 'shop-only')
activationState.rest = { step: 'shop' }
activationState.setPhase('rest')
assert.equal(activationState.activateRelic('r_far_sight').ok, true)
const uniquenessState = new GameState()
uniquenessState.rest = { stock: [{ type: 'relic', def: RELIC_DEFS.find((def) => def.id === 'r_far_sight'), sold: false }] }
assert.equal(uniquenessState.acquireRelic('r_far_sight').ok, true)
assert.equal(uniquenessState.rest.stock.length, 0)

function activeState(id) {
  const state = new GameState()
  assert.equal(state.relics.acquire(id, { activate: true }).ok, true)
  state.relicEngine.sync()
  return state
}

const rangeState = activeState('r_far_sight')
assert.equal(rangeState.flipRange(), 2)

const openingState = activeState('r_opening_pressure')
const openingTarget = openingState.board.find((card) => card.type === 'monster')
openingTarget.flipped = true
openingTarget.monsterHp = 100
const openingCount = openingState.flippableCards().length
assert.equal(openingState.modifyByRelics('attack:damage', 0, { card: openingTarget }), openingCount)

const exploredEmptyState = new GameState()
const exploredItem = exploredEmptyState._makeCard({ type: T.ITEM, def: { id: 'i_test', name: 'Test item', shape: { w: 1, h: 1 } } }, 1, 1, true)
const nextHidden = exploredEmptyState._makeCard({ type: T.MONSTER, def: MONSTERS[0] }, 2, 1, false)
exploredEmptyState.board = [exploredItem, nextHidden]
exploredItem.picked = true
assert.equal(exploredEmptyState.isConsumed(exploredItem), true)
assert.deepEqual(exploredEmptyState.flippableCards(), [nextHidden])

const ambushState = new GameState()
const ambushEntry = ambushState.board.find((card) => card.type === T.ENTRY)
const ambushMonster = ambushState._makeCard({ type: T.MONSTER, def: MONSTERS.find((monster) => monster.id === 'm_wraith') }, 2, 1, false)
ambushState.board = [ambushEntry, ambushMonster]
ambushState._revealCard(ambushMonster)
assert.equal(ambushState.player.hp, 18)
assert.equal(ambushState.player.san, 27)
assert.equal(ambushMonster.skillState.ms_ambush.lastTrigger, 'reveal')

const stoneSkinState = new GameState()
const stoneSkinMonster = stoneSkinState._makeCard({ type: T.MONSTER, def: MONSTERS.find((monster) => monster.id === 'm_stone') }, 1, 1, true)
stoneSkinMonster.monsterHp = 12
stoneSkinState.board = [stoneSkinMonster]
stoneSkinState._tickTurn()
assert.equal(stoneSkinState.dealMonsterDamage(stoneSkinMonster, 3, { channel: 'attack:damage', source: 'attack' }).dealt, 1)

const wailState = new GameState()
const wailMonster = wailState._makeCard({ type: T.MONSTER, def: MONSTERS.find((monster) => monster.id === 'm_banshee') }, 1, 1, true)
wailMonster.monsterHp = 14
wailState.board = [wailMonster]
wailState._monsterAttackAll()
assert.equal(wailState.player.san, 28)
assert.equal(wailMonster.skillState.ms_wail.lastTrigger, 'attack:after')

const skitterState = new GameState()
const skitterMonster = skitterState._makeCard({ type: T.MONSTER, def: MONSTERS.find((monster) => monster.id === 'm_beetle') }, 1, 1, true)
skitterMonster.monsterHp = 16
skitterState.board = [skitterMonster]
const skitterPosition = `${skitterMonster.c},${skitterMonster.r}`
skitterState.dealMonsterDamage(skitterMonster, 1, { channel: 'attack:damage', source: 'attack' })
assert.notEqual(`${skitterMonster.c},${skitterMonster.r}`, skitterPosition)

const splashEchoState = activeState('r_splash_echo')
const splashEchoTarget = splashEchoState._makeCard({ type: 'monster', def: MONSTERS[0] }, 0, 0, true)
const splashEchoVictim = splashEchoState._makeCard({ type: 'monster', def: MONSTERS[0] }, 2, 0, true)
splashEchoTarget.monsterHp = 100
splashEchoVictim.monsterHp = 100
splashEchoState.board = [splashEchoTarget, splashEchoVictim]
splashEchoState.equipment.items[0].curDur = 10
splashEchoState.attack(splashEchoTarget.uid)
assert.equal(splashEchoVictim.monsterHp, 97)

const splashRevealState = activeState('r_splash_echo')
const splashRevealTarget = splashRevealState._makeCard({ type: 'monster', def: MONSTERS[0] }, 0, 0, true)
const splashHiddenCard = splashRevealState._makeCard({ type: 'monster', def: MONSTERS[0] }, 1, 0, false)
splashRevealTarget.monsterHp = 100
splashHiddenCard.monsterHp = 100
splashRevealState.board = [splashRevealTarget, splashHiddenCard]
splashRevealState.attack(splashRevealTarget.uid)
assert.equal(splashHiddenCard.flipped, true)
assert.equal(splashRevealState.player.san, 28)

const goldState = activeState('r_blood_coin')
const goldTarget = goldState._makeCard({ type: 'monster', def: MONSTERS[0] }, 0, 0, true)
goldTarget.monsterHp = 100
goldState.board = [goldTarget]
for (let i = 0; i < 10; i++) goldState.attack(goldTarget.uid)
assert.equal(goldState.relics.getRuntime('r_blood_coin').attacks, 10)
assert.equal(goldTarget.dead, true)
assert.ok(goldState.player.gold > 0)

const armorCycleState = activeState('r_cycle_armor')
for (let i = 0; i < 5; i++) armorCycleState._tickTurn()
assert.equal(armorCycleState.player.armor, 5)

const bombState = activeState('r_bomb_expert')
bombState.player.hp = 10
bombState.player.san = 5
const bombCard = bombState._makeCard({ type: T.TRAP, def: { id: 't_test', name: '测试陷阱', trap: 'explosion', damage: 99, radius: 1 } }, 0, 0, false)
bombState.board = [bombCard]
bombState._revealCard(bombCard)
assert.equal(bombCard.triggered, true)
assert.equal(bombState.player.hp, 15)
assert.equal(bombState.player.san, 15)

// A targeted attack is a complete player turn: the target retaliates once,
// then every other revealed hostile monster attacks once. The target must not
// be counted a second time by the board-wide threat phase.
const multiMonsterState = new GameState()
const multiTarget = multiMonsterState._makeCard({ type: T.MONSTER, def: MONSTERS[0] }, 1, 1, true)
const multiOtherA = multiMonsterState._makeCard({ type: T.MONSTER, def: MONSTERS[0] }, 2, 1, true)
const multiOtherB = multiMonsterState._makeCard({ type: T.MONSTER, def: MONSTERS[0] }, 1, 2, true)
for (const card of [multiTarget, multiOtherA, multiOtherB]) card.monsterHp = 100
multiMonsterState.board = [multiTarget, multiOtherA, multiOtherB]
multiMonsterState.attack(multiTarget.uid)
assert.equal(multiMonsterState.player.hp, 17)
assert.equal(multiMonsterState.player.san, 28)

// Free actions (including backpack interaction and potion use) do not start
// a turn and therefore do not open an enemy threat phase.
const freeActionState = new GameState()
const freePotion = freeActionState._mkInst(POTIONS[0])
assert.ok(freeActionState.addToHand(freePotion))
const freeTurn = freeActionState.turn
assert.ok(freeActionState.moveBackpack(freePotion.uid, 1, 0))
freeActionState.rotateBackpack(freePotion.uid)
freeActionState.usePotion(0)
assert.equal(freeActionState.turn, freeTurn)

const chainState = activeState('r_chain_assault')
const chainWeapon = chainState.equipment.items[0]
chainWeapon.curDur = 10
const chainOrigin = chainState._makeCard({ type: 'monster', def: MONSTERS[0] }, 1, 1, true)
const chainRight = chainState._makeCard({ type: 'monster', def: MONSTERS[0] }, 2, 1, true)
const chainDown = chainState._makeCard({ type: 'monster', def: MONSTERS[0] }, 2, 2, true)
for (const card of [chainOrigin, chainRight, chainDown]) card.monsterHp = 1
chainState.board = [chainOrigin, chainRight, chainDown]
chainState.attack(chainOrigin.uid)
assert.equal(chainOrigin.dead, true)
assert.equal(chainRight.dead, true)
assert.equal(chainDown.dead, true)
assert.equal(chainWeapon.curDur, 9)

const doubleState = activeState('r_double_edge')
const doubleTarget = doubleState.board.find((card) => card.type === 'monster')
doubleTarget.flipped = true
doubleTarget.monsterHp = 100
assert.equal(doubleState.dealMonsterDamage(doubleTarget, 3, { channel: 'attack:damage', source: 'attack' }).dealt, 6)
assert.equal(doubleState.dealMonsterDamage(doubleTarget, 3, { channel: 'status:damage', source: 'dot' }).dealt, 3)
assert.equal(doubleState.receiveDamage(3, { source: 'retaliation', attacker: doubleTarget, minDamage: 1 }).healthDamage, 6)
assert.equal(doubleState.receiveDamage(3, { source: 'monster-attack', attacker: doubleTarget, minDamage: 1 }).healthDamage, 3)

const guardState = activeState('r_guardian_gaze')
for (const card of guardState.board.filter((entry) => entry.type === 'monster').slice(0, 2)) {
  card.flipped = true
  card.monsterHp = 10
}
assert.equal(guardState.receiveDamage(5).healthDamage, 3)
assert.equal(guardState.receiveDamage(1, { minDamage: 1 }).healthDamage, 1)

const brokenState = activeState('r_broken_fury')
const brokenWeapon = brokenState._mkInst(WEAPONS.find((weapon) => weapon.id === 'w_rust_knife'))
brokenWeapon.curDur = 0
assert.ok(brokenState.addToHand(brokenWeapon))
brokenState.resolveWeaponBroken(brokenWeapon, 'test')
assert.equal(brokenState.hand.some((item) => item.uid === brokenWeapon.uid), false)
const brokenRecipient = brokenState.equippedWeapons()[0]
assert.equal(brokenState.relics.getRuntime('r_broken_fury').attackBonus[brokenRecipient.uid], 3)
assert.equal(brokenState.modifyByRelics('weapon:power', brokenRecipient.def.atk, { weapon: brokenRecipient }), brokenRecipient.def.atk + 3)

const autoBreakState = activeState('r_broken_fury')
const autoBreakRecipient = autoBreakState._mkInst(WEAPONS.find((weapon) => weapon.id === 'w_rust_knife'))
autoBreakState.equipment.equip(autoBreakRecipient, 1)
const autoBreakWeapon = autoBreakState.equippedWeapons()[0]
autoBreakWeapon.curDur = 1
const autoBreakTarget = autoBreakState.board.find((card) => card.type === 'monster')
autoBreakTarget.flipped = true
autoBreakTarget.monsterHp = 100
autoBreakState.attack(autoBreakTarget.uid)
assert.equal(autoBreakState.findWeapon(autoBreakWeapon.uid), null)
assert.equal(autoBreakState.relics.getRuntime('r_broken_fury').attackBonus[autoBreakRecipient.uid], 3)

const bloodState = activeState('r_blood_memory')
const bloodTarget = bloodState.board.find((card) => card.type === 'monster')
bloodTarget.flipped = true
bloodTarget.monsterHp = 100
const bloodBefore = bloodTarget.monsterHp
bloodState.attack(bloodTarget.uid)
const firstBloodDamage = bloodBefore - bloodTarget.monsterHp
const bloodAfterFirst = bloodTarget.monsterHp
bloodState.attack(bloodTarget.uid)
assert.equal(bloodAfterFirst - bloodTarget.monsterHp, firstBloodDamage + 1)

const keyState = activeState('r_key_resonance')
keyState._runResolution('key:collected', [], { amount: 2, source: 'test' })
const keyTarget = keyState.board.find((card) => card.type === 'monster')
keyTarget.flipped = true
keyTarget.monsterHp = 100
assert.equal(keyState.dealMonsterDamage(keyTarget, 10).dealt, 16)
keyState._runResolution('floor:start', [], { floor: 2 })
assert.equal(keyState.relics.getRuntime('r_key_resonance').keysFound, 0)
assert.equal(keyState.dealMonsterDamage(keyTarget, 10).dealt, 10)
keyState.relics.deactivate('r_key_resonance')
keyState.relicEngine.sync()
keyState.floor = 3
keyState.relics.activate('r_key_resonance')
keyState.relicEngine.sync()
assert.equal(keyState.dealMonsterDamage(keyTarget, 10).dealt, 10)

const rewardState = activeState('r_four_choices')
assert.equal(rewardState.modifyByRelics('reward:choiceCount', 3), 4)

const bountyState = activeState('r_bounty_mark')
const bountyTarget = bountyState._makeCard({ type: 'monster', def: MONSTERS.find((monster) => monster.id === 'm_rot_rat') }, 0, 0, true)
bountyTarget.monsterHp = 0
const bountyBefore = bountyState.player.gold
bountyState._onMonsterKilled(bountyTarget, null)
assert.equal(bountyState.player.gold, bountyBefore + 2) // monster drop 1 + bounty 1

const healthState = activeState('r_last_stand')
const healthTarget = healthState.board.find((card) => card.type === 'monster')
healthTarget.flipped = true
healthTarget.monsterHp = 100
assert.equal(healthState.dealMonsterDamage(healthTarget, 10, { channel: 'attack:damage' }).dealt, 15)
healthState.player.hp = 10
assert.equal(healthState.dealMonsterDamage(healthTarget, 10, { channel: 'attack:damage' }).dealt, 10)

const heavyState = activeState('r_heavy_oath')
const heavyTarget = heavyState.board.find((card) => card.type === 'monster')
heavyTarget.flipped = true
heavyTarget.monsterHp = 100
heavyState.attack(heavyTarget.uid)
const turnAfterHeavyAttack = heavyState.turn
heavyState.attack(heavyTarget.uid)
assert.equal(heavyState.turn, turnAfterHeavyAttack)
assert.equal(heavyState.relics.getRuntime('r_heavy_oath').locked, true)

const reflectState = activeState('r_reflecting_thorns')
const reflectTarget = reflectState.board.find((card) => card.type === 'monster')
reflectTarget.flipped = true
reflectTarget.monsterHp = 10
reflectState.receiveDamage(10, { source: 'monster-attack', attacker: reflectTarget, minDamage: 1 })
assert.equal(reflectTarget.monsterHp, 7)

const bloodWellState = activeState('r_blood_well')
bloodWellState.player.hp = 10
const bloodWellTarget = bloodWellState.board.find((card) => card.type === 'monster')
bloodWellTarget.flipped = true
bloodWellTarget.monsterHp = 100
bloodWellState.dealMonsterDamage(bloodWellTarget, 10, { channel: 'attack:damage', source: 'attack' })
assert.equal(bloodWellState.player.hp, 13)

const bloodWellPotionState = activeState('r_blood_well')
bloodWellPotionState.player.hp = 16
bloodWellPotionState.healPlayer(4, { source: 'test:potion' })
const bloodWellEntry = bloodWellPotionState.board.find((card) => card.type === T.ENTRY)
const bloodWellPotion = bloodWellPotionState._makeCard({
  type: T.POTION,
  def: POTIONS.find((potion) => potion.id === 'p_bandage_armor'),
}, 2, 1, false)
bloodWellPotionState.board = [bloodWellEntry, bloodWellPotion]
bloodWellPotionState.flip(bloodWellPotion.uid)
assert.equal(bloodWellPotionState.gameOver, false)
assert.equal(bloodWellPotionState.player.hp, 20)
assert.equal(bloodWellPotionState.player.armor, 0)

const eveningState = activeState('r_evening_tide')
eveningState.player.hp = 10
eveningState._tickTurn()
assert.equal(eveningState.player.hp, 10)
eveningState._tickTurn()
assert.equal(eveningState.player.hp, 12)

const victoryState = activeState('r_victory_near')
const victoryTarget = victoryState.board.find((card) => card.type === 'monster')
const victoryExit = victoryState.board.find((card) => card.type === 'exit')
victoryTarget.flipped = true
victoryTarget.monsterHp = 100
victoryExit.flipped = true
victoryExit.c = victoryTarget.c + 1
victoryExit.r = victoryTarget.r
assert.equal(victoryState.dealMonsterDamage(victoryTarget, 10, { channel: 'attack:damage', source: 'attack' }).dealt, 15)

const berserkerState = activeState('r_berserker_heart')
const berserkerTarget = berserkerState.board.find((card) => card.type === 'monster')
berserkerTarget.flipped = true
berserkerTarget.monsterHp = 100
berserkerState.player.hp = 10
assert.equal(berserkerState.dealMonsterDamage(berserkerTarget, 10, { channel: 'attack:damage', source: 'attack' }).dealt, 12)

const sanityScavengeState = activeState('r_sanity_scavenge')
sanityScavengeState.player.san = 10
sanityScavengeState._runResolution('card:picked', [], { card: {}, item: {}, source: 'pickup' })
assert.equal(sanityScavengeState.player.san, 11)

const clearMindState = activeState('r_clear_mind')
const clearMindTarget = clearMindState.board.find((card) => card.type === 'monster')
clearMindTarget.flipped = true
clearMindTarget.monsterHp = 100
assert.equal(clearMindState.dealMonsterDamage(clearMindTarget, 10, { channel: 'attack:damage', source: 'attack' }).dealt, 13)

const unquietMindState = activeState('r_unquiet_mind')
const unquietMindTarget = unquietMindState.board.find((card) => card.type === 'monster')
unquietMindTarget.flipped = true
unquietMindTarget.monsterHp = 100
unquietMindState.player.san = 0
assert.equal(unquietMindState.dealMonsterDamage(unquietMindTarget, 10, { channel: 'attack:damage', source: 'attack' }).dealt, 13)

const healingEdgeState = activeState('r_healing_edge')
healingEdgeState.player.hp = 10
const healingWeapon = healingEdgeState.equippedWeapons()[0]
healingEdgeState.healPlayer(2, { source: 'test' })
assert.equal(healingEdgeState.relics.getRuntime('r_healing_edge').attackBonus[healingWeapon.uid], 1)
assert.equal(healingEdgeState.modifyByRelics('weapon:power', healingWeapon.def.atk, { weapon: healingWeapon }), healingWeapon.def.atk + 1)

const noMercyState = activeState('r_no_mercy')
const noMercyTarget = noMercyState.board.find((card) => card.type === 'monster')
noMercyTarget.flipped = true
noMercyTarget.monsterHp = Math.floor(noMercyTarget.def.hp / 2)
const noMercyRatio = 1 - noMercyTarget.monsterHp / noMercyTarget.def.hp
const noMercyExpected = Math.floor(10 * (1 + noMercyRatio * 0.5))
assert.equal(noMercyState.dealMonsterDamage(noMercyTarget, 10, { channel: 'attack:damage', source: 'attack' }).dealt, noMercyExpected)

const ironWallState = activeState('r_iron_wall')
ironWallState._tickTurn()
assert.equal(ironWallState.player.armor, 3)

const goldEdgeState = activeState('r_gold_edge')
goldEdgeState.player.gold = 25
const goldWeapon = goldEdgeState.equippedWeapons()[0]
assert.equal(goldEdgeState.modifyByRelics('weapon:power', goldWeapon.def.atk, { weapon: goldWeapon }), goldWeapon.def.atk + 2)

const backstabState = activeState('r_backstab_shadow')
const backstabTarget = backstabState.board.find((card) => card.type === 'monster')
backstabTarget.monsterHp = 100
backstabState._revealCard(backstabTarget)
const backstabHp = backstabState.player.hp
backstabState.attack(backstabTarget.uid)
assert.equal(backstabState.player.hp, backstabHp)
assert.equal(backstabState.hasCardStatus(backstabTarget, 'backstab'), false)

const warCryState = activeState('r_war_cry')
const warCryHidden = warCryState.board.find((card) => card.type === T.MONSTER)
assert.equal(warCryHidden.flipped, false)
const warCryAmbushes = warCryState.board.filter((card) =>
  card.type === T.MONSTER && !card.flipped && card.skills.includes('ms_ambush')).length
warCryState.player.san = 10
for (let i = 0; i < 10; i++) warCryState._runResolution('monster:killed', [], { card: warCryHidden, weapon: null })
assert.equal(warCryState.relics.getRuntime('r_war_cry').kills, 10)
assert.equal(warCryState.board.filter((card) => card.type === T.MONSTER && !card.flipped).length, 0)
assert.equal(warCryState.player.san, 10 - warCryAmbushes)

const peekState = activeState('r_peek_veil')
const peekSource = peekState._makeCard({ type: T.ENTRY, def: ENTRY_CARD }, 0, 0, false)
const peekTarget = peekState._makeCard({ type: T.MONSTER, def: MONSTERS[0] }, 1, 0, false)
peekState.board = [peekSource, peekTarget]
peekState._revealCard(peekSource)
assert.equal(peekTarget.flipped, false)
assert.equal(peekTarget.peeked, true)

const durabilityState = activeState('r_durability_fraud')
const durabilityWeapon = durabilityState.equippedWeapons()[0]
durabilityWeapon.curDur = 3
const durabilityTarget = durabilityState.board.find((card) => card.type === T.MONSTER)
durabilityTarget.flipped = true
durabilityTarget.monsterHp = 100
const fullDurabilityWeapon = { ...durabilityWeapon, curDur: durabilityWeapon.maxDur }
const fullDamage = computeDamage(fullDurabilityWeapon, durabilityTarget.def, null).dmg
durabilityState.attack(durabilityTarget.uid)
assert.equal(100 - durabilityTarget.monsterHp, fullDamage)
assert.equal(durabilityWeapon.curDur, 1)

const curseState = activeState('r_curse_brand')
const curseTarget = curseState.board.find((card) => card.type === T.MONSTER)
curseTarget.flipped = true
curseTarget.monsterHp = 100
curseState.attack(curseTarget.uid)
assert.equal(curseState.cardStatuses(curseTarget).all('curse').length, 1)
const curseBefore = curseTarget.monsterHp
curseState.attack(curseTarget.uid)
assert.equal(curseState.cardStatuses(curseTarget).all('curse').length, 1)
for (let i = 0; i < 4; i++) curseState._tickTurn()
assert.equal(curseBefore - curseTarget.monsterHp >= 20, true)

const banishState = activeState('r_void_banish')
const banishTarget = banishState.board.find((card) => card.type === T.MONSTER)
banishTarget.flipped = true
banishTarget.monsterHp = 100
const banishHp = banishState.player.hp
banishState.attack(banishTarget.uid)
assert.equal(banishState.hasCardStatus(banishTarget, 'banish'), true)
assert.equal(banishState.player.hp < banishHp, true)
const banishTurn = banishState.turn
banishState.attack(banishTarget.uid)
assert.equal(banishState.turn, banishTurn)
banishState._tickTurn()
assert.equal(banishState.hasCardStatus(banishTarget, 'banish'), false)

const bleedState = activeState('r_bleeding_mark')
const bleedTarget = bleedState.board.find((card) => card.type === 'monster')
bleedTarget.flipped = true
bleedTarget.monsterHp = 100
bleedState.attack(bleedTarget.uid)
assert.equal(bleedState.cardStatuses(bleedTarget).get('bleed').amount, 2)
assert.equal(bleedState.cardStatuses(bleedTarget).get('bleed').turns, 5)
const bleedBefore = bleedTarget.monsterHp
bleedState._tickTurn()
assert.equal(bleedBefore - bleedTarget.monsterHp, 2)

const quickChangeState = activeState('r_quick_change')
const quickWeapon = quickChangeState._mkInst(WEAPONS.find((weapon) => weapon.id === 'w_rust_knife'))
assert.ok(quickChangeState.addToHand(quickWeapon))
const quickIndex = quickChangeState.hand.findIndex((item) => item.uid === quickWeapon.uid)
quickChangeState.selectHand(quickIndex)
const quickTurn = quickChangeState.turn
quickChangeState.switchToEquip(1)
assert.equal(quickChangeState.turn, quickTurn)
assert.equal(quickChangeState.relics.getRuntime('r_quick_change').nextAttack, true)
assert.equal(quickChangeState.modifyByRelics('attack:damage', 10), 20)
const quickTarget = quickChangeState.board.find((card) => card.type === 'monster')
quickTarget.flipped = true
quickTarget.monsterHp = 100
quickChangeState.attack(quickTarget.uid)
assert.equal(quickChangeState.relics.getRuntime('r_quick_change').nextAttack, false)

const splashState = activeState('r_shatter_splash')
const splashTarget = splashState._makeCard({ type: 'monster', def: MONSTERS.find((monster) => monster.id === 'm_rot_flesh') }, 1, 1, true)
const splashNeighbor = splashState._makeCard({ type: 'monster', def: MONSTERS.find((monster) => monster.id === 'm_rot_flesh') }, 2, 1, true)
splashTarget.monsterHp = 100
splashNeighbor.monsterHp = 100
splashState.board = [splashTarget, splashNeighbor]
const splashWeapon = splashState.equippedWeapons()[0]
splashWeapon.curDur = 4
splashState.attack(splashTarget.uid)
assert.equal(splashNeighbor.monsterHp < 100, true)

const cycleState = activeState('r_weapon_cycle')
cycleState.turn = 2
const cycleHandBefore = cycleState.hand.length
cycleState._tickTurn()
assert.equal(cycleState.turn, 3)
assert.equal(cycleState.hand.length, cycleHandBefore + 1)

const blastState = activeState('r_death_blast')
const blastDead = blastState._makeCard({ type: 'monster', def: MONSTERS.find((monster) => monster.id === 'm_rot_rat') }, 1, 1, true)
const blastNeighbor = blastState._makeCard({ type: 'monster', def: MONSTERS.find((monster) => monster.id === 'm_rot_flesh') }, 2, 1, false)
blastDead.monsterHp = 0
blastNeighbor.monsterHp = blastNeighbor.def.hp
blastState.board = [blastDead, blastNeighbor]
blastState._onMonsterKilled(blastDead, null)
assert.equal(blastNeighbor.flipped, true)
assert.equal(blastNeighbor.monsterHp, blastNeighbor.def.hp - 2)

const sanityShieldState = activeState('r_sanity_shield')
sanityShieldState.player.san = 10
sanityShieldState.player.hp = 20
const sanityDamage = sanityShieldState.receiveDamage(6, { source: 'monster-attack', minDamage: 1 })
assert.equal(sanityDamage.sanityAbsorbed, 3)
assert.equal(sanityDamage.healthDamage, 3)
assert.equal(sanityShieldState.player.san, 7)
assert.equal(sanityShieldState.receiveDamage(1, { source: 'monster-attack', minDamage: 1 }).healthDamage, 1)

const atomicState = new GameState()
atomicState.player.san = 10
const atomicMonster = atomicState._makeCard({ type: T.MONSTER, def: MONSTERS[0] }, 0, 0, false)
atomicState.board = [atomicMonster]
assert.equal(atomicState.flipCard(atomicMonster), true)
assert.equal(atomicMonster.flipped, true)
assert.equal(atomicState.player.san, 10)
assert.equal(atomicState.spendSanity(1, { source: 'test' }), 1)
assert.equal(atomicState.player.san, 9)
assert.equal(atomicState.gainSanity(3, { source: 'test' }), 3)
assert.equal(atomicState.player.san, 12)
const composedState = new GameState()
composedState.player.san = 10
const composedMonster = composedState._makeCard({ type: T.MONSTER, def: MONSTERS[0] }, 0, 0, false)
composedState.board = [composedMonster]
composedState._revealCard(composedMonster)
assert.equal(composedMonster.flipped, true)
assert.equal(composedState.player.san, 8)

// Chessboard entity atoms: collision swaps, hidden cards can be revealed on
// impact, and consumed cards no longer block a square.
const movementState = new GameState()
const mover = movementState._makeCard({ type: T.MONSTER, def: MONSTERS[0] }, 1, 1, true)
const hiddenCollision = movementState._makeCard({ type: T.MONSTER, def: MONSTERS[1] }, 2, 1, false)
movementState.board = [mover, hiddenCollision]
const collisionResult = movementState.moveCard(mover, 2, 1, {
  collision: 'swap', revealCollision: true, revealCost: 0, cause: 'test:push',
})
assert.equal(collisionResult.moved, true)
assert.equal(mover.c, 2)
assert.equal(hiddenCollision.c, 1)
assert.equal(hiddenCollision.flipped, true)

const slimeCallState = activeState('r_slime_call')
slimeCallState.board = []
slimeCallState.turn = 9
slimeCallState._tickTurn()
assert.equal(slimeCallState.turn, 10)
assert.equal(slimeCallState.friendlySummonsOnBoard().length, 1)
assert.equal(slimeCallState.friendlySummonsOnBoard()[0].def.id, 's_slime')

const noSpaceSlimeState = activeState('r_slime_call')
noSpaceSlimeState.turn = 9
noSpaceSlimeState._tickTurn()
assert.equal(noSpaceSlimeState.friendlySummonsOnBoard().length, 0)

const priorityState = new GameState()
const priorityEnemy = priorityState._makeCard({ type: T.MONSTER, def: MONSTERS[0] }, 0, 0, true)
priorityState.board = []
const prioritySlime = priorityState.spawnCard({ type: T.MONSTER, def: SUMMONS[0] }, {
  position: { c: 1, r: 0 }, faction: 'ally', entityKind: 'summon', summoned: true,
})
priorityState.board = [priorityEnemy, prioritySlime]
const playerHpBeforeSummonHit = priorityState.player.hp
priorityState._monsterAttackAll()
assert.equal(priorityState.player.hp, playerHpBeforeSummonHit)
assert.equal(prioritySlime.monsterHp, prioritySlime.def.hp - priorityEnemy.def.atk)

const conversionState = activeState('r_slime_conversion')
const converted = conversionState._makeCard({ type: T.MONSTER, def: MONSTERS[0] }, 1, 1, true)
converted.monsterHp = 0
conversionState.board = [converted]
conversionState._onMonsterKilled(converted, null)
assert.equal(converted.dead, false)
assert.equal(converted.faction, 'ally')
assert.equal(converted.def.id, 's_slime')
assert.equal(converted.monsterHp, converted.def.hp)

const shiftState = activeState('r_random_shift')
const shifted = shiftState._makeCard({ type: T.MONSTER, def: MONSTERS[0] }, 0, 0, true)
shiftState.board = [shifted]
const oldShiftPosition = `${shifted.c},${shifted.r}`
assert.equal(shiftState.randomSwapCard(shifted, { cause: 'test:random-shift' }).moved, true)
assert.notEqual(`${shifted.c},${shifted.r}`, oldShiftPosition)

const skillState = activeState('r_calling_horn')
const skillEntry = skillState._makeCard({ type: T.ENTRY, def: ENTRY_CARD }, 1, 1, true)
const skillEnemy = skillState._makeCard({ type: T.MONSTER, def: MONSTERS[0] }, 0, 0, false)
const skillHiddenOccupant = skillState._makeCard({ type: T.ENTRY, def: ENTRY_CARD }, 1, 0, false)
skillState.board = [skillEntry, skillEnemy, skillHiddenOccupant]
assert.equal(skillState.activeSkill.id, 'skill:calling-horn')
assert.equal(skillState.castActiveSkill().ok, true)
assert.equal(skillEnemy.flipped, true)
assert.equal(skillHiddenOccupant.flipped, false)
assert.equal(skillState.turn, 1)
assert.equal(skillState.activeSkill.cooldownRemaining, 10)
assert.equal(skillState.castActiveSkill().reason, 'cooldown')
skillState._tickTurn()
assert.equal(skillState.activeSkill.cooldownRemaining, 9)

const multiSkillState = new GameState()
assert.equal(multiSkillState.relics.acquire('r_calling_horn', { activate: true }).ok, true)
assert.equal(multiSkillState.relics.acquire('r_stealth', { activate: true }).ok, true)
multiSkillState.relicEngine.sync()
multiSkillState._syncActiveSkillSelection()
const firstSkillId = multiSkillState.activeSkill.id
const secondSkillId = multiSkillState.activeSkills().find((skill) => skill.id !== firstSkillId).id
assert.equal(multiSkillState.selectActiveSkill(secondSkillId).ok, true)
assert.notEqual(multiSkillState.activeSkill.id, firstSkillId)
assert.equal(multiSkillState.turn, 1)

const stealthState = activeState('r_stealth')
const stealthHp = stealthState.player.hp
assert.equal(stealthState.castActiveSkill().ok, true)
assert.equal(stealthState.stealthed, true)
assert.equal(stealthState.player.hp, stealthHp)
assert.equal(stealthState.waitTurn().ok, true)
assert.equal(stealthState.turn, 2)
assert.equal(stealthState.stealthed, true)

// Waiting is a normal turn-consuming action: it advances turn-start effects
// and lets revealed enemies attack, unlike backpack/free actions.
const waitState = new GameState()
const waitMonster = waitState._makeCard({ type: T.MONSTER, def: MONSTERS[0] }, 1, 1, true)
waitMonster.monsterHp = 100
waitState.board = [waitMonster]
assert.equal(waitState.waitTurn().ok, true)
assert.equal(waitState.turn, 1)
assert.equal(waitState.player.hp, 19)
assert.equal(waitState.player.san, 29)

// Pointer long-press contract: a short press calls only onClick; holding past
// the threshold calls only onLongPress, and pointer movement cancels both.
globalThis.window = { setTimeout, clearTimeout }
const pressListeners = new Map()
const pressButton = {
  addEventListener(type, handler) { pressListeners.set(type, handler) },
  removeEventListener(type) { pressListeners.delete(type) },
  setPointerCapture() {},
}
let shortPresses = 0
let longPresses = 0
const releasePress = bindLongPress(pressButton, {
  duration: 8,
  onClick: () => shortPresses++,
  onLongPress: () => longPresses++,
})
const pointer = (type, id = 1, x = 0, y = 0) => pressListeners.get(type)?.({
  button: 0, pointerId: id, clientX: x, clientY: y, preventDefault() {},
})
pointer('pointerdown')
pointer('pointerup')
await new Promise((resolve) => setTimeout(resolve, 2))
assert.equal(shortPresses, 1)
assert.equal(longPresses, 0)
pointer('pointerdown', 2)
await new Promise((resolve) => setTimeout(resolve, 15))
pointer('pointerup', 2)
assert.equal(shortPresses, 1)
assert.equal(longPresses, 1)
pointer('pointerdown', 3)
pointer('pointermove', 3, 20, 0)
await new Promise((resolve) => setTimeout(resolve, 15))
pointer('pointerup', 3, 20, 0)
assert.equal(shortPresses, 1)
assert.equal(longPresses, 1)
releasePress()

console.log('phase5-check passed')
