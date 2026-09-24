import assert from 'node:assert/strict'
import { fixture, add, select, enemy, attack } from './item-test-helpers.mjs'
import { GameRun, SAVE_KEY } from '../src/game/run.js'
import { ALL_ITEM_DEFS, RECIPES, randomItem, makeItemById } from '../src/game/data/content.js'
import { createMerchantEntity, buildMerchantStock, refreshMerchantSlot } from '../src/game/data/merchants.js'
import { adjacentItems } from '../src/game/rules/items.js'
import { attackRangeCells, enemyThreatCells, weaponTargetCells } from '../src/game/rules/attack-range.js'
import { rangePulse } from '../src/render/attack-range-overlay.js'

assert.equal(ALL_ITEM_DEFS.length, 65)
assert.equal(makeItemById('short-sword'), null)
for (let i = 0; i < 100; i++) assert.notEqual(randomItem(1, () => i / 100).type, 'material')

// Backpack changes spend one turn; repositioning on the free-form staging canvas is free.
{
  const run = fixture()
  const a = add(run, 'r-three', 0, 0)
  const b = add(run, 'r-empty', 1, 0)
  const c = add(run, 'r-reverse', 2, 0)
  assert(run.commitInventoryDrop(a.uid, 8))
  assert.equal(run.globalTurn, 1)
  assert.equal(run.commitInventoryDrop(a.uid, 8), null)
  assert.equal(run.globalTurn, 1)
  const replaced = run.commitInventoryDrop(a.uid, 1)
  assert.deepEqual(replaced.conflicts.map((item) => item.uid), [b.uid])
  assert(run.inventoryStash.some((item) => item.uid === b.uid))
  assert.equal(run.globalTurn, 2)
  assert(run.moveInventoryToStash(c.uid))
  assert.equal(run.globalTurn, 3)
  assert(run.setStashedInventoryRotation(c.uid, 1))
  assert.equal(c.bagRotation, 1)
  assert.equal(run.globalTurn, 3)
  assert(run.discardInventoryItem(a.uid))
  assert.equal(run.globalTurn, 4)
  assert(run.discardInventoryItem(b.uid))
  assert.equal(run.globalTurn, 5)
}

// Range overlays follow the same mixed distance rule as combat and conceal unrevealed cells.
{
  const run = fixture()
  const room = run.currentRoom
  const origin = { c: 3, r: 3 }
  assert.equal(attackRangeCells(room, origin, 1).length, 8)
  assert.equal(attackRangeCells(room, origin, 2).length, 12)
  room.tile({ c: 3, r: 2 }).revealed = false
  assert.equal(attackRangeCells(room, origin, 1).length, 7)
  const near = enemy(run, { pos: { c: 4, r: 3 }, attack: 2, range: 1 })
  enemy(run, { pos: { c: 5, r: 3 }, attack: 2, range: 1 })
  assert.deepEqual(weaponTargetCells(room, origin, 1), [near.pos])
  assert.equal(weaponTargetCells(room, origin, 2).length, 2)
  assert.equal(enemyThreatCells(room, near, origin).length, 6)
  assert(enemyThreatCells(room, near, origin).some(({ c, r }) => c === origin.c && r === origin.r))
  near.downed = true
  assert.deepEqual(enemyThreatCells(room, near, origin), [])
}

assert.deepEqual(rangePulse(0), { scale: 1, opacity: 1 })
assert.deepEqual(rangePulse(1.2), { scale: 0.5, opacity: 0 })
assert.deepEqual(rangePulse(2), { scale: 1, opacity: 1 })
assert(rangePulse(1.6).scale > rangePulse(1.2).scale)

// Detail identity is compact: shape is visible in the backpack, so it is not
// repeated as text. Defense effect attributes remain internal and are not
// presented as a defense identity badge.
{
  const run = fixture()
  const weapon = add(run, 'rust-sword')
  const defense = add(run, 'wood-shield')
  assert(run.showItemDetail(weapon))
  assert.deepEqual(run.detailPanel.badges, ['\u707c\u70ed', '\u5251', '\u2605'])
  assert.deepEqual(run.detailPanel.lines.slice(0, 3), ['\u2694 3', '\u{1F3F9} 1', '\u{1F4AA} 3'])
  assert.equal(run.detailPanel.lines.some((line) => line.includes('\u5360\u683c')), false)
  assert(run.showItemDetail(defense))
  assert.deepEqual(run.detailPanel.badges, ['\u76fe\u724c', '\u2605'])
  assert.equal(run.detailPanel.lines.some((line) => line.includes('\u5360\u683c')), false)
}

// Consumables have an exact cost and never receive the exploration recovery.
for (const id of ['health-potion', 'iron-powder', 'energy-potion', 'cleanse', 'rage-wine']) {
  const run = fixture(), item = add(run, id)
  run.player.hp = 10; run.player.energy = 3
  run.player.poisonedTurns = id === 'cleanse' ? 2 : 0
  select(run, item)
  assert(run.useSelected())
  assert.equal(run.globalTurn, 1)
  assert.equal(run.player.energy, id === 'energy-potion' ? 6 : 3)
  assert.equal(run.backpack.length, 0)
  if (id === 'health-potion') assert.equal(run.player.hp, 15)
  if (id === 'iron-powder') assert.equal(run.player.armor, 5)
  if (id === 'rage-wine') assert.equal(run.player.hp, 8)
  if (id === 'cleanse') assert.equal(run.player.poisonedTurns, 0)
}
{
  const run = fixture(), item = add(run, 'teleport')
  select(run, item); run.player.energy = 4
  assert(run.useSelected()); assert.equal(run.globalTurn, 0)
  assert.equal(run.clickTile(7, 3), false)
  assert(run.clickTile(5, 3))
  assert.equal(run.globalTurn, 1); assert.equal(run.player.energy, 4)
  assert.equal(run.itemRules.state.travel, 0)
  assert.deepEqual(run.player.pos, { c: 5, r: 3 })
}
// Every armor item is passive.
for (const id of ALL_ITEM_DEFS.filter(i => i.type === 'defense').map(i => i.id)) {
  const run = fixture(), item = add(run, id); select(run, item)
  assert.equal(run.useSelected(), false); assert.equal(run.globalTurn, 0)
}
{
  const run = fixture(); add(run, 'wood-shield')
  const e = enemy(run, { attack: 5 })
  run._enemyAttack(e); assert.equal(run.player.hp, 15); assert.equal(run.player.armor, 0)
  run._enemyAttack(e); assert.equal(run.player.hp, 13); assert.equal(run.player.armor, 0)
  run._enemyAttack(e); assert.equal(run.player.hp, 8)
}
{
  const run = fixture(); add(run, 'thorn-shield')
  const e = enemy(run, { attack: 1 }); run.player.armor = 10
  run._enemyAttack(e); run._enemyAttack(e); run._enemyAttack(e)
  assert.equal(e.hp, 100)
  run.player.armor = 0; run._enemyAttack(e); assert.equal(e.hp, 98)
}
{
  const run = fixture(); add(run, 'light-armor')
  run.itemRules.enter(true); run.itemRules.enter(false)
  assert.equal(run.player.armor, 3)
}
{
  const run = fixture(); add(run, 'tide-cloak')
  for (let i = 0; i < 8; i++) run._walk([{ c: i % 2 ? 3 : 2, r: 3 }])
  assert.equal(run.player.armor, 0)
  run.itemRules.enter(false); run._walk([{ c: 2, r: 3 }, { c: 3, r: 3 }])
  assert.equal(run.player.armor, 0)
  const e = enemy(run, { attack: 3, range: 3 })
  run._enemyAttack(e); assert.equal(run.player.hp, 18)
  run._enemyAttack(e); assert.equal(run.player.hp, 16)
  run._enemyAttack(e); assert.equal(run.player.hp, 14)
}
{
  const run = fixture(); add(run, 'tide-shield'); add(run, 'red-armor')
  const w = add(run, 'tide-blade'), e = enemy(run)
  attack(run, w, e); attack(run, w, e); attack(run, w, e)
  assert.equal(run.player.armor, 2)
  run.player.hp=9;const r = add(run, 'rust-sword'); attack(run, r, e); attack(run, r, e)
  assert.equal(run.player.armor, 3)
}
{
  const run = fixture(); add(run, 'vine-armor'); run.currentRoom.tile({ c: 2, r: 2 }).revealed = false
  const e = enemy(run, { attack: 3 })
  run._enemyAttack(e); assert.equal(run.player.hp, 18)
  run._damagePlayer(2, { source: 'trap:poison-fog', ignoreArmor: true })
  assert.equal(run.player.hp, 16)
}
{
  const run = fixture(); add(run, 'red-shield')
  const e = enemy(run, { attack: 3 }); run.player.armor = 2
  run._enemyAttack(e)
  const w = add(run, 'rust-sword')
  assert.equal(run.itemRules.attackContext(w, e).flat, 2)
  attack(run, w, e)
  assert.equal(run.itemRules.attackContext(w, e).flat, 0)
}
// Non-rectangular occupied cells, duplicate materials, and live adjacency.
{
  const run = fixture(), w = add(run, 'silver-guard', 0, 0), armor = add(run, 'wood-shield', 1, 0)
  const e = enemy(run)
  assert.equal(run.itemRules.attackContext(w, e).flat, 1)
  assert(adjacentItems(run.backpack, w).includes(armor))
  run.backpack.move(armor.uid, 3, 0)
  assert.equal(run.itemRules.attackContext(w, e).flat, 0)
}
{
  const run = fixture(), w = add(run, 'mountain-maul', 0, 0), e = enemy(run)
  assert.equal(run.itemRules.attackContext(w, e).flat, 4)
  add(run, 'weight', 3, 1)
  assert.equal(run.itemRules.attackContext(w, e).flat, 2)
  const weight = run.backpack.items.find(i => i.id === 'weight')
  run.backpack.move(weight.uid, 4, 0)
  assert.equal(run.itemRules.attackContext(w, e).flat, 4)
}
{
  const run = fixture(), w = add(run, 'rock-maul', 0, 0), weight = add(run, 'weight', 2, 0)
  assert.equal(run.weaponEnergyCost(w), 6)
  assert(adjacentItems(run.backpack, w).includes(weight))
}
// All weapon-specific conditions, without implicit class effects.
for (const [id, setup, flat] of [
  ['root-axe', () => {}, 2],
  ['tide-blade', r => r.itemRules.move(), 2],
  ['thorn-spear', (r,e) => { e.movedLastPhase = true }, 2],
  ['bell-maul', () => {}, 3],
  ['wall-sword', r => { r.player.armor = 1 }, 2],
]) {
  const run = fixture(), w = add(run, id), e = enemy(run); setup(run,e)
  assert.equal(run.itemRules.attackContext(w,e).flat, flat, id)
}
{
  const run = fixture(), w = add(run, 'wood-bow', 0, 0); add(run, 'scope', 1, 0)
  run.player.pos = { c: 0, r: 3 }; const e = enemy(run, { pos: { c: 4, r: 3 } })
  assert.equal(run.weaponRange(w), 4)
  attack(run,w,e); assert.equal(e.hp,95); assert.equal(run.globalTurn,1)
}
{
  const run = fixture(), w = add(run, 'ash-bow')
  assert.equal(run.weaponRange(w, { c: 0, r: 3 }), 4)
  assert.equal(run.weaponRange(w, { c: 3, r: 3 }), 3)
}
{
  const run = fixture(), w = add(run, 'eagle-bow')
  run.player.pos = { c: 0, r: 3 }; const e = enemy(run, { pos: { c: 4, r: 3 } })
  attack(run,w,e); assert.equal(e.hp,92)
}
{
  const run = fixture(), w = add(run, 'rust-sword'), e = enemy(run, { attack: 10 })
  attack(run,w,e); run._enemyAttack(e); assert.equal(run.player.hp,13)
  run._enemyAttack(e); assert.equal(run.player.hp,3)
}
{
  const run = fixture(), w = add(run, 'root-axe'), e = enemy(run), splash = enemy(run,{pos:{c:4,r:4}})
  attack(run,w,e); assert.equal(splash.hp,100)
  assert.equal(run.player.parry,null)
}
{
  const run = fixture(), w = add(run, 'ember-axe'), e = enemy(run,{hp:1}), splash = enemy(run,{pos:{c:4,r:4},attribute:'wither'})
  attack(run,w,e); assert.equal(splash.hp,98)
}
for (const [id, attr, cost] of [['bone-knife',null,1],['erosion-knife','drown',0],['erosion-knife',null,1]]) {
  const run=fixture(),w=add(run,id),e=enemy(run,{hp:1,attribute:attr})
  attack(run,w,e); assert.equal(run.player.energy,10-cost)
}
{
  const run=fixture(),w=add(run,'return-axe'),e=enemy(run,{hp:1})
  attack(run,w,e); assert.equal(run.weaponEnergyCost(w),4)
  const next=add(run,'bone-knife'),target=enemy(run)
  assert.equal(run.weaponEnergyCost(next),1)
  attack(run,next,target);assert.equal(target.hp,96)
  assert.equal(run.weaponEnergyCost(next),2)
}
for(const id of ['ember-spear','soul-spear']) {
  const run=fixture(),w=add(run,id,0,0);add(run,'chain',1,0)
  run.player.pos={c:run.currentRoom.width-3,r:3}
  const e=enemy(run,{pos:{c:run.currentRoom.width-1,r:3}})
  attack(run,w,e)
  assert.equal(e.hp,id==='soul-spear'?90:95)
}
{
  const run=fixture(),w=add(run,'rock-maul'),e=enemy(run,{hp:4,traits:['shield']})
  attack(run,w,e);assert.equal(run.currentRoom.entity(e.id),null)
}
{
  const run=fixture(),w=add(run,'bone-knife',0,0);add(run,'venom-sac',1,0)
  const e=enemy(run);attack(run,w,e);assert.equal(e.hp,97)
  run._endTurn();assert.equal(e.hp,96)
  attack(run,w,e);assert.equal(e.hp,93)
}
// Rotation preview is free; placing the rotated item costs one enemy phase.
{
  const run=fixture(),w=add(run,'rust-sword'),e=enemy(run,{attack:2,actionDelay:0})
  run.player.energy=5;select(run,w)
  assert(run.moveInventory(w.uid,2));assert.equal(run.globalTurn,1);assert.equal(run.player.hp,18)
  assert.equal(run.player.energy,5)
  assert.equal(run.moveInventory(w.uid,2),false);assert.equal(run.globalTurn,1)
  const placement = run.backpack.placementOf(w.uid)
  const anchor = run.backpack.originIndex(placement)
  const rotation = (placement.rotation + 1) % 4
  assert.notEqual(run.previewInventoryDrop(w.uid, anchor, { rotation })?.status, 'blocked')
  assert.equal(run.globalTurn,1)
  assert.equal(run.backpack.placementOf(w.uid).rotation,placement.rotation)
  assert.equal(run.commitInventoryDrop(w.uid,32,{ rotation }),null)
  assert.equal(run.globalTurn,1)
  assert.equal(run.backpack.placementOf(w.uid).rotation,placement.rotation)
  assert(run.commitInventoryDrop(w.uid,anchor,{ rotation }));assert.equal(run.globalTurn,2);assert.equal(run.player.hp,16)
  assert.equal(run.commitInventoryDrop(w.uid,anchor,{ rotation }),null);assert.equal(run.globalTurn,2)
  assert.equal(run.moveInventory(w.uid,32),false);assert.equal(run.globalTurn,2)
  assert(e)
}
// Craft transaction success, no recipe chaining, full-bag rollback.
for(const recipe of RECIPES) {
  const run=fixture();const a=add(run,recipe.a);const b=add(run,recipe.b)
  assert.equal(run.availableRecipes().length,1)
  assert(run.craft(recipe.result));assert.equal(run.globalTurn,1)
  assert(!run.backpack.placementOf(a.uid));assert(!run.backpack.placementOf(b.uid))
  assert.equal(run.backpack.items[0].id,recipe.result)
  assert.equal(run.availableRecipes().length,0)
}
{
  const run=fixture();add(run,'rock-maul');add(run,'weight')
  for(let i=0;i<27;i++) add(run,'health-potion')
  const before=run.backpack.serialize()
  assert.equal(run.availableRecipes()[0].canFit,false)
  assert.equal(run.craft('mountain-maul'),false)
  assert.deepEqual(run.backpack.serialize(),before);assert.equal(run.globalTurn,0)
}
// Relics change build rules rather than tracking per-room allowances.
{
  const run=fixture();add(run,'r-three')
  const ws=['rust-sword','bone-knife','tide-blade'].map(id=>add(run,id))
  assert.equal(run.itemRules.attackContext(ws[0],enemy(run,{attribute:'wither'})).multiplier,2.2)
  assert.equal(run.itemRules.attackContext(ws[0],enemy(run,{pos:{c:5,r:3},attribute:'drown'})).multiplier,0.5)
}
{
  const run=fixture();add(run,'r-empty');add(run,'r-reverse');const w=add(run,'rust-sword'),e=enemy(run,{attribute:'drown'})
  assert.equal(run.weaponEnergyCost(w),2)
  assert.equal(run.itemRules.attackContext(w,e).countered,true)
}
{
  const run=fixture();add(run,'r-traveler');const w=add(run,'bone-knife'),e=enemy(run)
  run.player.energy=5;run._walk([{c:2,r:3}]);assert.equal(run.player.energy,6)
  assert.equal(run.weaponEnergyCost(w),1)
  attack(run,w,e);assert.equal(run.weaponEnergyCost(w),3)
}
{
  const run=fixture();add(run,'r-traveler');const w=add(run,'rock-maul'),e=enemy(run,{pos:{c:5,r:3}})
  run.player.energy=0;select(run,w)
  assert.equal(run._attack(e),false);assert.deepEqual(run.player.pos,{c:3,r:3});assert.equal(run.globalTurn,0)
}
{
  const run=fixture();add(run,'r-blood');const w=add(run,'bone-knife')
  run.player.hp=9;assert.equal(run.itemRules.attackContext(w,enemy(run)).flat,3)
  assert.equal(run._healPlayer(5),2)
}
{
  const run=fixture();add(run,'r-scales');const w=add(run,'bone-knife'),e=enemy(run)
  assert.equal(run.itemRules.attackContext(w,e).flat,4);assert.equal(run.weaponRange(w),2)
  add(run,'rust-sword');assert.equal(run.itemRules.attackContext(w,e).flat,0);assert.equal(run.weaponRange(w),1)
}
// Save state survives reload including zero energy and consumed room charges.
{
  const run=fixture(), weapon=add(run,'rust-sword'), target=enemy(run,{hp:30})
  select(run,weapon)
  assert(run._attack(target))
  assert.equal(run.globalTurn,0)
  const saved=JSON.stringify(run.serialize()),previous=globalThis.localStorage
  let stored=saved
  globalThis.localStorage={getItem:key=>key===SAVE_KEY?stored:null,setItem:(_key,value)=>{stored=value},removeItem(){}}
  try {
    const loaded=new GameRun()
    assert.equal(loaded.globalTurn,1)
    assert.equal(loaded.attackCount,1)
    assert.equal(loaded.serialize().pendingAttackTurn,false)
    assert.equal(JSON.parse(stored).pendingAttackTurn,false)
    assert.equal(loaded.currentRoom.entity(target.id).hp,target.hp)
  } finally { globalThis.localStorage=previous }
}
{
  const run=fixture();add(run,'wood-shield');run.player.energy=0
  const cloak=add(run,'tide-cloak');cloak.description='obsolete description'
  const merchant=createMerchantEntity('merchant',{c:1,r:1},{floor:1,random:()=>0.5})
  merchant.stock[3]={itemId:'rust-sword',price:9};run.currentRoom.addEntity(merchant)
  run.itemRules.state.enemyAttacks=7;run.itemRules.buff('test',{flat:2})
  run.itemRules.buff('r-three',{flat:2});run.itemRules.buff('r-scales',{flat:3})
  const saved=JSON.stringify(run.serialize()),previous=globalThis.localStorage
  globalThis.localStorage={getItem:key=>key===SAVE_KEY?saved:null,setItem(){},removeItem(){}}
  try {
    const loaded=new GameRun()
    assert.equal(loaded.player.energy,0)
    assert.equal(loaded.itemRules.state.enemyAttacks,7)
    assert.equal(loaded.itemRules.state.buffs.test.flat,2)
    assert.equal(loaded.itemRules.state.buffs['r-three'],undefined)
    assert.equal(loaded.itemRules.state.buffs['r-scales'],undefined)
    assert.equal(loaded.backpack.items.find(i=>i.id==='tide-cloak').description,makeItemById('tide-cloak').description)
    assert.equal(makeItemById(loaded.currentRoom.entity(merchant.id).stock[3].itemId).type,'material')
  } finally { globalThis.localStorage=previous }
}
// Craft choices and their details use the same data as the Vue panel.
{
  const run=fixture();add(run,'silver-guard');add(run,'shield-core')
  assert(run.availableRecipes().some((recipe) => recipe.result === 'wall-sword' && recipe.canFit))
  for(const id of ['silver-guard','shield-core','wall-sword']) {
    assert(run.showItemDetail(makeItemById(id)))
    assert.equal(run.detailPanel.title,makeItemById(id).name)
    assert(run.detailPanel.description)
  }
}
// Every catalog item is eligible by the final floor, including crafted gear and relics.
for (let i = 0; i < ALL_ITEM_DEFS.length; i++) {
  assert.equal(buildMerchantStock('merchant', 12, () => (i + 0.1) / ALL_ITEM_DEFS.length)[0].itemId, ALL_ITEM_DEFS[i].id)
}
{
  const run = fixture(), merchant = createMerchantEntity('merchant', { c: 2, r: 3 }, { floor: 1, random: () => 0.5 })
  run.currentRoom.addEntity(merchant);run.phase = 'merchant';run.merchant = { entityId: merchant.id };run.player.gold = 99
  merchant.stock[0] = { itemId: 'r-three', price: 9 }
  assert(run.buyMerchantItem(0));assert(run.hasActiveRelic('r-three'));assert.equal(run.player.gold, 90)
  merchant.stock[0] = { itemId: 'r-three', price: 9 }
  assert.equal(run.buyMerchantItem(0), false);assert.equal(run.player.gold, 90)
  const sword = add(run, 'rust-sword');select(run, sword)
  add(run, 'r-scales');select(run, sword);assert(run.sellSelectedMerchantItem())
  assert.equal(run.itemRules.state.buffs['r-scales'], undefined)
}
{
  const run=fixture(),e=enemy(run,{hp:1,noLoot:false,drop:{chance:1,itemId:'venom-sac'}})
  run._defeatEnemy(e)
  assert.equal(run.currentRoom.entityAt(e.pos).item.type,'material')
}
{
  const run=fixture();add(run,'silver-guard');add(run,'shield-core');const item=add(run,'teleport')
  select(run,item);assert(run.useSelected());assert.equal(run.craft('wall-sword'),false)
  run.clearSelection();assert(run.craft('wall-sword'))
}
// Material guarantee survives slot refresh; other slots retain the full catalog.
for(let i=0;i<100;i++) {
  const random=()=>i/100,m=createMerchantEntity('merchant',{c:0,r:0},{floor:1,random})
  assert.equal(makeItemById(m.stock[3].itemId).type,'material')
  refreshMerchantSlot(m,1,3,random)
  assert.equal(makeItemById(m.stock[3].itemId).type,'material')
  assert.equal(new Set(m.stock.map(s=>s.itemId)).size,4)
}
// A poison kill finishes this turn but cannot continue a queued walk past level-up.
{
  const run=fixture()
  enemy(run,{hp:1,itemPoisonTurns:2,noExperience:false,experience:run.player.experienceToNext})
  const result=run._walk([{c:2,r:3},{c:1,r:3}])
  assert.equal(result.stopped,true);assert.equal(run.phase,'level-up')
  assert.equal(run.globalTurn,1);assert.deepEqual(run.player.pos,{c:2,r:3})
}
// Generated tactical approach cells stay clear and survive serialization.
{
  const run=new GameRun({autoLoad:false,random:()=>0.99}),kinds=new Set()
  for(const room of run.dungeon.rooms.values()) {
    kinds.add(room.tacticalLayout)
    for(const cell of room.tacticalCells||[]) assert(room.isEmpty(cell))
    assert.deepEqual(room.serialize().tacticalCells,room.tacticalCells||[])
  }
  assert(kinds.has('firing'));assert(kinds.has('wall'))
}
// Safe movement neither advances combat counters nor accumulates protection.
{
  const run=fixture();add(run,'wood-shield');add(run,'tide-cloak');run.player.talents=['flow-walk','survival-energy']
  const e=enemy(run,{attack:1,range:1});run._enemyAttack(e)
  run.currentRoom.removeEntity(e.id)
  const hp=run.player.hp, armor=run.player.armor, count=run.itemRules.state.enemyAttacks
  for(let i=0;i<12;i++) run._walk([{c:i%2?3:2,r:3}])
  run.itemRules.enter(false)
  assert.equal(run.player.hp,hp);assert.equal(run.player.armor,armor)
  assert.equal(run.itemRules.state.enemyAttacks,count)
  run._enemyAttack(enemy(run,{attack:1,range:1}));assert.equal(run.player.armor,2)
  run.player.armor=10
  const target=[...run.currentRoom.entities.values()][0]
  run._enemyAttack(target);run._enemyAttack(target)
  assert.equal(run.player.armor,8)
}
// A zero-damage hit cannot replenish armor. Repeated hits cannot stack its floor.
{
  const run=fixture();add(run,'tide-shield');const w=add(run,'tide-blade'),e=enemy(run)
  w.attack=0;attack(run,w,e);assert.equal(run.player.armor,0)
  w.attack=3;attack(run,w,e);attack(run,w,e);assert.equal(run.player.armor,2)
}
// Relic inversion is applied before triad amplification and talent checks.
{
  const run=fixture();add(run,'r-three');add(run,'r-reverse')
  const w=add(run,'rust-sword');add(run,'bone-knife');add(run,'tide-blade')
  const e=enemy(run,{attribute:'drown'});run.player.talents=['harmony-counter']
  const context=run.itemRules.attackContext(w,e)
  assert.equal(context.multiplier,2.2);assert.equal(context.flat,1)
}
console.log('items-check passed: new inventory, combat, crafting, defenses, relics, save and UI contracts')
