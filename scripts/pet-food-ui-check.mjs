import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createRenderer, h, nextTick, ref } from 'vue'
import { fixture, add, enemy, round } from './item-test-helpers.mjs'

// Mount the real Vue components and update them in place. SSR remounting hides
// stale child props when the plain game model mutates a food instance in place.
async function componentUrl(name) {
  const source = await readFile(new URL(`../src/ui/${name}.vue`, import.meta.url), 'utf8')
  const { descriptor } = parse(source)
  let code = compileScript(descriptor, { id: name, inlineTemplate: true }).content
  code = code.replace(/from ['"]vue['"]/g, `from '${import.meta.resolve('vue')}'`)
  for (const match of [...code.matchAll(/from ['"]\.\/([^'"]+)\.vue['"]/g)]) {
    code = code.replace(match[0], `from '${await componentUrl(match[1])}'`)
  }
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
}
const { default: Backpack } = await import(await componentUrl('BackpackGrid'))
const node = (type, text = '') => ({ type, text, children: [], parent: null, props: {} })
const renderer = createRenderer({
  createElement: type => node(type), createText: text => node('text', text), createComment: text => node('comment', text),
  setText: (target, text) => { target.text = text },
  setElementText: (target, text) => { target.text = text; target.children = [] },
  parentNode: target => target.parent,
  nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] || null,
  patchProp: (target, key, _old, value) => { target.props[key] = value },
  insert(target, parent, anchor = null) {
    if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1)
    target.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, target)
  },
  remove(target) { target.parent.children.splice(target.parent.children.indexOf(target), 1) },
})
const flatten = target => [target, ...target.children.flatMap(flatten)]
for (const foodId of ['food-3', 'health-potion']) {
  const run = fixture(); add(run, 'mountain-hound', 0, 0)
  const food = add(run, foodId, 0, 1)
  if (foodId === 'health-potion') add(run, 'r-vampire-fang', 4, 0)
  const field = food.type === 'energy' ? 'energy' : 'heal'
  food[field] = 3
  enemy(run)
  const revision = ref(0), root = node('root')
  const app = renderer.createApp({ render() {
    revision.value
    return h(Backpack, { columns: 8, rows: 4, cells: [], links: [], gold: 0,
      items: run.backpack.items.filter(item => item.uid === food.uid).map(item => ({ item, cells: [], originIndex: 8 })) })
  } })
  app.mount(root)
  const badges = () => flatten(root).filter(n => String(n.props.class).includes('food-value')).map(n => n.text)
  assert.deepEqual(badges(), ['3'])
  for (const remaining of [2, 1, 0]) {
    round(run)
    assert.equal(food[field], remaining)
    revision.value++
    await nextTick()
    assert.deepEqual(badges(), remaining ? [String(remaining)] : [], `${foodId}: displayed points must follow consumption without remounting`)
  }
  app.unmount()
}
console.log('pet-food-ui-check passed: mounted backpack updates food and potion points after every pet phase')
