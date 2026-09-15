import assert from 'node:assert/strict'
import { fixture, add, enemy, attack } from './item-test-helpers.mjs'
import { TALENT_DEFS, buildLevelUpChoices, unlockableTalents } from '../src/game/data/talents.js'

assert.equal(TALENT_DEFS.length,20)
assert.equal(new Set(TALENT_DEFS.map(t=>t.line)).size,4)
for(const talent of TALENT_DEFS) {
  assert(talent.prerequisites.every(id=>TALENT_DEFS.some(t=>t.id===id)))
  assert(unlockableTalents({talents:talent.prerequisites}).some(t=>t.id===talent.id))
  if(talent.tier>1) assert(!unlockableTalents({talents:[]}).some(t=>t.id===talent.id))
}
assert.equal(buildLevelUpChoices({talents:[]}).length,5)
{
  const run=fixture();run.player.talents=['flow-step','flow-switch','flow-master']
  const a=add(run,'rust-sword'),b=add(run,'bone-knife'),e=enemy(run)
  attack(run,a,e);run._walk([{c:3,r:2}])
  assert.equal(run.itemRules.attackContext(b,e).flat,3)
}
{
  const run=fixture();run.player.talents=['flow-walk','flow-relay']
  for(let i=0;i<8;i++)run._walk([{c:i%2?3:2,r:3}])
  assert.equal(run.player.armor,0)
  const a=add(run,'rust-sword'),b=add(run,'root-axe')
  attack(run,a,enemy(run,{hp:1}))
  assert.equal(run.weaponEnergyCost(a),3);assert.equal(run.weaponEnergyCost(b),3)
}
{
  const run=fixture();run.player.talents=['guard-shell','guard-gain','guard-reply']
  add(run,'light-armor');run.itemRules.enter(true);assert.equal(run.player.armor,6)
  const w=add(run,'rust-sword'),e=enemy(run)
  assert.equal(run.itemRules.attackContext(w,e).flat,1)
  attack(run,w,e);assert.equal(run.itemRules.attackContext(w,e).flat,0)
  run.itemRules.armor(1,true);run.itemRules.armor(1,true);run.itemRules.armor(1,true)
  assert.equal(run.player.armor,9)
}
{
  const run=fixture();run.player.talents=['guard-hard','guard-last'];run.player.armor=2
  const e=enemy(run,{attack:4})
  run._enemyAttack(e);assert.equal(run.player.hp,19);assert.equal(run.player.armor,0)
  run._enemyAttack(e);assert.equal(run.player.hp,15);assert.equal(run.player.armor,0)
  assert.equal(run.itemRules.attackContext(add(run,'rust-sword'),e).flat,2)
}
{
  const run=fixture();run.player.talents=['harmony-counter','harmony-switch']
  const a=add(run,'rust-sword'),b=add(run,'bone-knife'),e=enemy(run,{attribute:'drown'})
  attack(run,a,e)
  assert.equal(run.itemRules.attackContext(b,e).flat,1)
  attack(run,b,e);assert.equal(e.nextAttackReduction,1)
  e.attack=3;e.range=2
  const hp=run.player.hp
  run._enemyAttack(e);assert.equal(run.player.hp,hp-2)
  run._enemyAttack(e);assert.equal(run.player.hp,hp-5)
  attack(run,a,e);attack(run,b,e);assert.equal(e.nextAttackReduction,1)
}
{
  const run=fixture();run.player.talents=['harmony-kill']
  const w=add(run,'rust-sword')
  attack(run,w,enemy(run,{hp:1,attribute:'wither'}));assert.equal(run.player.energy,8)
  attack(run,w,enemy(run,{hp:1,attribute:'wither'}));assert.equal(run.player.energy,8)
}
{
  const run=fixture();run.player.talents=['harmony-resist','harmony-three']
  const a=add(run,'rust-sword'),b=add(run,'bone-knife'),c=add(run,'tide-blade'),e=enemy(run,{attribute:'drown'})
  attack(run,a,e);assert.equal(run.itemRules.attackContext(a,e).flat,0)
  assert.equal(run.itemRules.attackContext(b,e).flat,2)
  e.attack=3;e.range=2;const hp=run.player.hp;run._enemyAttack(e);assert.equal(run.player.hp,hp-2)
}
{
  const run=fixture()
  assert(run._applyLevelUpOption('survival-vigor'));assert.equal(run.player.maxHp,23);assert.equal(run.player.hp,23)
  run.player.talents.push('survival-low','survival-heal','survival-energy')
  run.player.hp=10;const w=add(run,'rust-sword'),e=enemy(run,{attack:1})
  assert.equal(run.itemRules.attackContext(w,e).flat,1)
  run.player.energy=3
  run._enemyAttack(e);run._enemyAttack(e);run._enemyAttack(e)
  assert.equal(run.player.energy,4)
  const potion=add(run,'health-potion')
  run.selectedInventoryIndex=run.backpack.originIndex(run.backpack.placementOf(potion.uid))
  assert(run.useSelected());assert.equal(run.player.hp,14)
  run._damagePlayer(100,{source:'test'});assert.equal(run.gameOver,true)
}
{
  const run=fixture();run.player.talents=['survival-last'];run.player.hp=4
  const potion=add(run,'health-potion');run.selectedInventoryIndex=run.backpack.originIndex(run.backpack.placementOf(potion.uid))
  assert(run.useSelected());assert.equal(run.player.hp,14)
}
{
  const run=fixture();run.player.talents=['flow-walk','flow-switch']
  const a=add(run,'rust-sword'),b=add(run,'wood-bow'),e=enemy(run)
  for(let i=0;i<4;i++) {
    run._walk([{c:3,r:i%2?3:2}]);attack(run,a,e)
    assert.equal(run.player.armor,1)
  }
  run.player.pos={c:2,r:3}
  assert.equal(run.itemRules.attackContext(b,e).flat,2)
  run.player.pos={c:3,r:3}
  assert.equal(run.itemRules.attackContext(b,e).flat,0)
}
console.log('talents-check passed: four routes, prerequisites and all twenty nodes')
