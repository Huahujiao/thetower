import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { compileScript, parse } from '@vue/compiler-sfc'
import { createRenderer, h, nextTick, ref } from 'vue'
import { fixture, add, setBalls, enemy, settleAnimations } from './item-test-helpers.mjs'

// Compile the real client templates, then mount them with Vue's test host.
// Check real keyed grid-cell identity; payment events come from the real GameRun.
function moduleUrl(code) { return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64') }
async function compile(name, replacements = {}) {
  const filename = new URL('../src/ui/' + name + '.vue', import.meta.url)
  const { descriptor } = parse(await readFile(filename, 'utf8'), { filename: filename.pathname })
  let { content } = compileScript(descriptor, { id: name, inlineTemplate: true })
  content = content.replace(/from (['"])vue\1/g, 'from ' + JSON.stringify(import.meta.resolve('vue')))
  for (const [specifier, url] of Object.entries(replacements)) content = content.replace(JSON.stringify(specifier), JSON.stringify(url)).replace("'" + specifier + "'", JSON.stringify(url))
  content = content.replace(/from (['"])(\.[^'"]+\.js)\1/g, (_match, _quote, path) => 'from ' + JSON.stringify(new URL(path, filename).href))
  return moduleUrl(content)
}
const glyph = await compile('StaminaFlame')
const handModule = await compile('StaminaHand', {
  './StaminaFlame.vue': glyph,
  '../game/model/stamina-deck.js': new URL('../src/game/model/stamina-deck.js', import.meta.url).href,
})
const { default: StaminaHand } = await import(handModule)
const makeNode = type => ({
  type, children: [], props: {}, parent: null,
})
const renderer = createRenderer({
  createElement: makeNode,
  insertStaticContent(content, parent, anchor) {
    const node = Object.assign(makeNode('#static'), { text: content, parent })
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, node)
    return [node, node]
  },
  createText: text => Object.assign(makeNode('#text'), { text }),
  createComment: text => Object.assign(makeNode('#comment'), { text }),
  setText: (node, text) => { node.text = text },
  setElementText: (node, text) => { node.text = text; node.children = [] },
  patchProp: (node, key, _previous, value) => { node.props[key] = value },
  insert(node, parent, anchor = null) {
    if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1)
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, node)
    node.parent = parent
  },
  remove(node) { node.parent?.children.splice(node.parent.children.indexOf(node), 1); node.parent = null },
  parentNode: node => node.parent,
  nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1] || null,
})
const run = fixture()
const target = enemy(run)
run._synchronizeBattle()
const revision = ref(0), root = makeNode('root')
const off = run.on('change', () => { revision.value++ })
const previousWindow = globalThis.window
const previousDocument = globalThis.document
let reducedMotion = false
globalThis.window = { matchMedia: () => ({ matches: reducedMotion }), addEventListener() {}, removeEventListener() {} }
globalThis.document = { addEventListener() {}, removeEventListener() {} }
const app = renderer.createApp({
  setup: () => () => {
    revision.value
    return h(StaminaHand, { run, deck: run.staminaDeck, balls: run.staminaDeck.hand.slice(), selected: run.staminaDeck.selected.slice(), highlighted: run.staminaPaymentPreview()?.balls.map(ball => ball.id) || [], enabled: run._canAct() && run.selectedItem?.type !== 'weapon', active: run.battle.active, round: run.battle.round, onSelect: id => run.toggleStaminaBall(id) })
  },
})
function find(className, node = root) {
  return [...(String(node.props.class || '').split(' ').includes(className) ? [node] : []), ...node.children.flatMap(child => find(className, child))]
}
function assertDisplayOrder() {
  assert.deepEqual(find('stamina-ball').map(button => button.parent.props['data-stamina-id']), run.staminaDeck.hand.map(ball => ball.id), 'Displayed live flames must follow the exact hand order used for payment')
}
const update = async () => { run._changed(); await nextTick(); assertDisplayOrder() }
let mounted = false
try {
  app.mount(root)
  mounted = true
  await nextTick()
  assert.equal(find('stamina-ball').length, 6)
  assert.equal(find('selected').length, 1)
  assert(find('stamina-ball').at(-1).props['aria-pressed'])
  assert.equal(find('stamina-selection-arc').length, 1)
  // A weapon locks manual ball input and owns the exact automatic payment group.
  const originalDeck = run.staminaDeck.serialize()
  const weapon = add(run, 'rust-sword')
  weapon.energyCost = 2
  setBalls(run, 6, weapon.attribute)
  const otherIndex = run.staminaDeck.drawPile.findIndex(ball => ball.attribute !== weapon.attribute && ball.attribute !== 'wild')
  assert(otherIndex >= 0)
  const otherBall = run.staminaDeck.drawPile[otherIndex]
  run.staminaDeck.drawPile[otherIndex] = run.staminaDeck.hand[0]
  run.staminaDeck.hand[0] = otherBall
  await update()
  const manualOther = find('stamina-ball')[0]
  manualOther.props.onClick({ stopPropagation() {} })
  await nextTick()
  assert.deepEqual(run.staminaDeck.selected, [otherBall.id])
  assert(String(manualOther.props.class).split(' ').includes('manual-selected'))
  assert(run.selectInventory(run.backpack.originIndex(run.backpack.placementOf(weapon.uid))))
  await nextTick()
  const reserved = run.weaponPayment(weapon).balls.map(ball => ball.id)
  const moveId = run.staminaDeck.hand[3].id
  assert.deepEqual(run.staminaDeck.selected, [])
  assert.equal(find('manual-selected').length, 0)
  assert.equal(find('stamina-selection-arc').length, 2)
  assert(find('stamina-ball').every(button => button.props['aria-disabled']), 'Weapon selection must disable manual ball buttons')
  manualOther.props.onClick({ stopPropagation() {} })
  find('stamina-ball')[1].props.onClick({ stopPropagation() {} })
  await nextTick()
  assert.deepEqual(run.staminaDeck.selected, [], 'The model also refuses manual input while a weapon is selected')
  assert.deepEqual(run.weaponPayment(weapon).balls.map(ball => ball.id), reserved)
  assert(run.clickTile(3, 2))
  settleAnimations(run)
  await nextTick()
  assert(!run.staminaDeck.hand.some(ball => ball.id === moveId), 'Movement must use the rightmost unreserved ball')
  assert(run.staminaDeck.hand.some(ball => ball.id === otherBall.id), 'Selecting a weapon must cancel the former manual preference')
  const attackPayments = []
  const stopAttackPayments = run.on('stamina:spent', ({ balls }) => attackPayments.push(...balls))
  assert(run._attack(target))
  stopAttackPayments()
  assert.deepEqual(attackPayments.map(ball => ball.id), reserved)
  run.bus.emit('animate:attack-complete', { actor: 'player' })
  settleAnimations(run)
  run.staminaDeck.pay(1, weapon.attribute, { selection: false })
  await nextTick()
  assert.equal(run.selectedItem, null)
  assert(find('stamina-ball').every(button => !button.props['aria-disabled']), 'Losing the weapon payment must unlock manual ball selection')
  find('stamina-ball')[0].props.onClick({ stopPropagation() {} })
  await nextTick()
  assert.deepEqual(run.staminaDeck.selected, [otherBall.id])
  run.backpack.removeByUid(weapon.uid)
  run.selectedInventoryIndex = null
  run.player.pos = { c: 3, r: 3 }
  run.staminaDeck = run._createStaminaDeck(originalDeck)
  await update()
  // Exercise public board actions, including selection and the HUD event wiring.
  for (const action of ['move', 'flip']) {
    const button = find('stamina-ball').at(-1)
    const origin = button.parent
    const id = origin.props['data-stamina-id']
    button.props.onClick({ stopPropagation() {} })
    await nextTick()
    const payments = []
    const stop = run.on('stamina:spent', ({ balls }) => payments.push(...balls))
    if (action === 'move') assert(run.clickTile(3, 2))
    else {
      run.currentRoom.tile({ c: 2, r: 2 }).revealed = false
      assert(run.clickTile(2, 2))
    }
    stop()
    await nextTick()
    assert.deepEqual(payments.map(ball => ball.id), [id], action + ' must pay the selected rightmost ID')
    const effect = find('stamina-spend-effect').find(node => node.props['data-stamina-id'] === id)
    assert.equal(effect?.parent, origin, action + ' must extinguish that same rightmost flame')
    assert(!run.staminaDeck.hand.some(ball => ball.id === id))
    settleAnimations(run)
    run.staminaDeck.refund(payments)
    await update()
    assert.equal(find('stamina-spend-effect').length, 0)
  }
  for (const action of ['move', 'flip']) {
    assert.equal(run.staminaDeck.selected.length, 0)
    const rightmost = find('stamina-ball').at(-1).parent
    const id = run.staminaDeck.hand.at(-1).id
    assert.equal(rightmost.props['data-stamina-id'], id)
    const paid = []
    const stop = run.on('stamina:spent', ({ balls }) => paid.push(...balls))
    if (action === 'move') assert(run.clickTile(3, 3))
    else {
      run.currentRoom.tile({ c: 2, r: 3 }).revealed = false
      assert(run.clickTile(2, 3))
    }
    stop()
    await nextTick()
    assert.deepEqual(paid.map(ball => ball.id), [id], 'Unselected ' + action + ' must consume the rightmost flame')
    assert.equal(find('stamina-spend-effect')[0].parent, rightmost)
    assertDisplayOrder()
    settleAnimations(run)
    run.staminaDeck.refund(paid)
    await update()
  }
  // A paid left flame extinguishes in place; its right neighbour then slides left.
  const slidingSurvivor = find('stamina-ball')[1].parent
  assert.equal(slidingSurvivor.props.style['--slot-index'], 1)
  find('stamina-ball')[0].props.onClick({ stopPropagation() {} })
  await nextTick()
  run.staminaDeck.pay(1)
  await update()
  const pendingRightmost = find('stamina-ball').at(-1)
  assert.equal(run.staminaPaymentPreview().balls[0].id, pendingRightmost.parent.props['data-stamina-id'])
  assert(!pendingRightmost.props['aria-pressed'], 'A new automatic highlight must wait while the left gap is still extinguishing')
  const leftEffect = find('stamina-spend-effect')[0]
  leftEffect.props.onAnimationend({ target: leftEffect, currentTarget: leftEffect })
  await nextTick()
  assert.equal(find('stamina-slot')[0], slidingSurvivor, 'The same surviving flame must slide into the left gap')
  assert.equal(slidingSurvivor.props.style['--slot-index'], 0)
  assert.deepEqual(find('stamina-slot').map(slot => slot.props.style['--slot-shift-delay']), ['0ms', '100ms', '200ms', '300ms', '400ms'], 'Moving flames must start from left to right at 0.1-second intervals')
  await update()
  assert.equal(find('stamina-slot').at(-1).props.style['--slot-shift-delay'], '400ms', 'HUD updates must not cancel pending stagger delays')
  assert(!pendingRightmost.props['aria-pressed'], 'The rightmost ball must remain flat during its delayed refill')
  slidingSurvivor.props.onTransitionend({ target: slidingSurvivor, currentTarget: slidingSurvivor, propertyName: 'transform' })
  await nextTick()
  assert(!pendingRightmost.props['aria-pressed'], 'Another ball arriving must not release this highlight early')
  const rightmostSlot = pendingRightmost.parent
  rightmostSlot.props.onTransitionend({ target: rightmostSlot, currentTarget: rightmostSlot, propertyName: 'opacity' })
  await nextTick()
  assert(!pendingRightmost.props['aria-pressed'], 'Only the position transition may release the highlight')
  rightmostSlot.props.onTransitionend({ target: rightmostSlot, currentTarget: rightmostSlot, propertyName: 'transform' })
  await nextTick()
  assert(pendingRightmost.props['aria-pressed'], 'The new automatic lift and arc must appear after its refill ends')
  assert.equal(find('stamina-selection-arc', pendingRightmost).length, 1)
  // A newer manual choice wins even if old movement callbacks finish later.
  find('stamina-ball')[0].props.onClick({ stopPropagation() {} })
  await nextTick()
  const fallbackPayment = run.staminaDeck.pay(1)
  await update()
  const fallbackEffect = find('stamina-spend-effect')[0]
  fallbackEffect.props.onAnimationend({ target: fallbackEffect, currentTarget: fallbackEffect })
  await nextTick()
  const waitingDefault = find('stamina-ball').at(-1)
  assert(!waitingDefault.props['aria-pressed'])
  const manualWhileMoving = find('stamina-ball')[1]
  manualWhileMoving.props.onClick({ stopPropagation() {} })
  await nextTick()
  assert(manualWhileMoving.props['aria-pressed'], 'Manual selection must still respond immediately during refill')
  await new Promise(resolve => setTimeout(resolve, 600))
  await nextTick()
  assert(!waitingDefault.props['aria-pressed'], 'A stale move completion must not override the latest manual choice')
  manualWhileMoving.props.onClick({ stopPropagation() {} })
  await nextTick()
  assert(waitingDefault.props['aria-pressed'], 'Missing transitionend must be recovered after stagger and travel finish')
  run.staminaDeck.refund(fallbackPayment.balls)
  await update()
  const [supplement] = run.staminaDeck.draw(1)
  await update()
  const supplementOrigin = find('stamina-ball').at(-1).parent
  assert.equal(supplementOrigin.props['data-stamina-id'], supplement.id)
  const supplementPayment = run.staminaDeck.pay(1)
  await update()
  assert.equal(supplementPayment.balls[0].id, supplement.id)
  assert.equal(find('stamina-spend-effect')[0].parent, supplementOrigin)
  run.staminaDeck.refund(supplementPayment.balls)
  await update()
  run.staminaDeck.hand[3].mark = '封'
  await update()
  assert(find('spirit-fire-mark').some(group => group.children.some(node => node.text === '封')), 'Custom marks must appear on the fire')
  find('stamina-ball')[5].props.onClick({ stopPropagation() {} })
  await nextTick()
  find('stamina-ball')[3].props.onClick({ stopPropagation() {} })
  await nextTick()
  assert.equal(find('selected').length, 1)
  assert.equal(run.staminaDeck.selected.length, 1)
  assert.equal(find('stamina-spend-effect').length, 0, 'Selecting must not extinguish a flame')
  const selectedId = run.staminaDeck.selected[0]
  const originalSlots = find('stamina-slot').slice()
  const origins = new Map(originalSlots.map(slot => [slot.props['data-stamina-id'], slot]))
  const paid = run.staminaDeck.pay(2)
  assert(paid.balls.some(ball => ball.id === selectedId))
  await update()
  assert.equal(find('stamina-spend-effect').length, 2)
  assert(find('stamina-spend-effect').some(effect => find('spirit-fire-mark', effect).some(group => group.children.some(node => node.text === '封'))), 'Burning fire must keep its mark')
  assert.equal(find('stamina-ball').length, 4, 'Payment is immediate while its ghosts animate')
  assert.deepEqual(find('stamina-slot'), originalSlots, 'Payment must not shift any grid cell while extinguishing')
  for (const ball of paid.balls) {
    const effect = find('stamina-spend-effect').find(node => node.props['data-stamina-id'] === ball.id)
    assert.equal(effect.parent, origins.get(ball.id), 'Each consumed ID must extinguish inside its original cell')
  }
  for (const button of find('stamina-ball')) assert.equal(button.parent, origins.get(button.parent.props['data-stamina-id']))
  run.staminaDeck.refund(paid.balls)
  await update()
  assert.equal(find('stamina-spend-effect').length, 0, 'Refund must cancel the corresponding extinguish')
  assert.equal(find('stamina-ball').length, 6)
  const automaticOrigins = new Map(find('stamina-slot').map(slot => [slot.props['data-stamina-id'], slot]))
  const automatic = run.staminaDeck.pay(1, 'drown', { selection: false })
  await update()
  assert.notEqual(automaticOrigins.get(automatic.balls[0].id), find('stamina-slot')[0], 'Fixture must pay a matching flame away from the left edge')
  assert.equal(find('stamina-spend-effect')[0].parent, automaticOrigins.get(automatic.balls[0].id), 'Automatic attribute payment must extinguish the matching ID')
  const automaticEffect = find('stamina-spend-effect')[0]
  const beforeCompact = find('stamina-slot').slice()
  automaticEffect.props.onAnimationend({ target: automaticEffect, currentTarget: automaticEffect })
  await nextTick()
  let movingRank = 0
  find('stamina-slot').forEach((slot, index) => {
    const moved = beforeCompact.indexOf(slot) > index
    assert.equal(slot.props.style['--slot-shift-delay'], (moved ? movingRank++ * 100 : 0) + 'ms', 'Stationary flames must not count towards stagger delays')
  })
  run.staminaDeck.refund(automatic.balls)
  await update()
  run.staminaDeck.pay(0)
  assert.equal(run.staminaDeck.pay(99), null)
  await update()
  assert.equal(find('stamina-spend-effect').length, 0, 'Zero/failed payments must not animate')
  run.staminaDeck.pay(1)
  await update()
  run.staminaDeck.pay(2)
  await update()
  assert.equal(find('stamina-spend-effect').length, 3, 'Rapid payments must coexist')
  const beforeEarlyFinish = find('stamina-slot').slice()
  const earlyEffect = find('stamina-spend-effect')[0]
  earlyEffect.props.onAnimationend({ target: earlyEffect, currentTarget: earlyEffect })
  await nextTick()
  assert.equal(find('stamina-spend-effect').length, 2)
  assert.deepEqual(find('stamina-slot'), beforeEarlyFinish, 'An earlier completion must not shift other extinguishing flames')
  await new Promise(resolve => setTimeout(resolve, 1150))
  await nextTick()
  assert.equal(find('stamina-spend-effect').length, 0, 'Effects must clean up without animationend')
  assert.equal(find('stamina-slot').length, run.staminaDeck.hand.length, 'Completed payments must remove gaps')
  find('stamina-slot').forEach((slot, index) => assert.equal(slot.props.style['--slot-index'], index, 'Survivors must slide to consecutive left slots'))
  for (const button of find('stamina-ball')) assert.equal(button.parent, origins.get(button.parent.props['data-stamina-id']), 'Sliding must preserve the surviving keyed flame elements')
  const lastButton = find('stamina-ball').at(-1)
  const lastOrigin = lastButton.parent
  lastButton.props.onClick({ stopPropagation() {} })
  await nextTick()
  const lastPayment = run.staminaDeck.pay(1)
  await update()
  assert.equal(find('stamina-spend-effect')[0].parent, lastOrigin, 'The rightmost selected flame must extinguish at the right edge')
  assert.equal(lastOrigin.props['data-stamina-id'], lastPayment.balls[0].id)
  run.staminaDeck.discardHand()
  await update()
  assert.equal(find('stamina-spend-effect')[0].parent, lastOrigin, 'Turn discard must not shift a pending extinguish')
  const lastEffect = find('stamina-spend-effect')[0]
  lastEffect.props.onAnimationend({ target: lastEffect, currentTarget: lastEffect })
  await nextTick()
  await update()
  assert.equal(find('stamina-spend-effect').length, 0, 'End-turn discards must not extinguish')
  run.staminaDeck.draw(4)
  await update()
  reducedMotion = true
  find('stamina-ball')[0].props.onClick({ stopPropagation() {} })
  await nextTick()
  run.staminaDeck.pay(1)
  await update()
  assert.equal(find('stamina-spend-effect').length, 0, 'Respect reduced motion')
  assert(find('stamina-ball').at(-1).props['aria-pressed'], 'Reduced motion must assign the new automatic highlight immediately')
  reducedMotion = false
  run.staminaDeck.pay(1)
  await update()
  assert.equal(find('stamina-spend-effect').length, 1)
  run.battle.round += 1
  await update()
  assert.equal(find('stamina-spend-effect').length, 0, 'A new round clears the previous visual slots')
  assert.equal(find('stamina-slot').length, run.staminaDeck.hand.length)
  run.staminaDeck.pay(1)
  await update()
  assert.equal(find('stamina-spend-effect').length, 1)
  run.reset()
  await nextTick()
  assert.equal(find('stamina-spend-effect').length, 0, 'Restart must clear old effects')
  run.staminaDeck.draw(2)
  await update()
  assert.equal(run.player.energy, 0)
  assert.equal(find('stamina-ball').length, 0, 'Noncombat draws must not show balls')
  run.initialRelicChoices = []
  for (const entity of [...run.currentRoom.entities.values()]) run.currentRoom.removeEntity(entity.id)
  const nextEnemy = enemy(run)
  run.currentRoom.reveal(nextEnemy.pos)
  run._synchronizeBattle()
  await update()
  run.staminaDeck.pay(1)
  await update()
  assert.equal(find('stamina-spend-effect').length, 1, 'New deck must retain payment notifications')
  run.currentRoom.removeEntity(nextEnemy.id)
  run._synchronizeBattle()
  await update()
  assert.equal(find('stamina-slot').length, 0, 'Exiting combat must clear the hand immediately')
  assert.equal(find('stamina-spend-effect').length, 0, 'Exiting combat must cancel pending extinguishes')
  app.unmount()
  mounted = false
  run.staminaDeck.pay(1)
  assert.equal(root.children.length, 0)
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert(/\.stamina-slot \{[^}]*transition: transform \.2s ease-out var\(--slot-shift-delay, 0ms\)/.test(styles), 'Refill movement must finish in 0.2 seconds')
  const flicker = styles.match(/@keyframes spirit-fire-flicker[^\n]+/)[0]
  assert(!/skew|translateX/.test(flicker), 'Idle flames must move vertically')
  console.log('stamina-flame-check passed: selected payment origins, immediate spend, refunds, rapid extinguishes, cleanup, turn discard, reduced motion and restart')
} finally {
  if (mounted) app.unmount()
  off()
  if (previousDocument === undefined) delete globalThis.document
  else globalThis.document = previousDocument
  if (previousWindow === undefined) delete globalThis.window
  else globalThis.window = previousWindow
}
