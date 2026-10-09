import assert from 'node:assert/strict'
import { ENEMY_ART_PACK_VERSION } from '../src/animation/shadow-enemies.js'
import { loadCurrentShadowRoster, loadCurrentShadowProject, SHADOW_TEMPLATE_REVISION_KEY, SHADOW_TEMPLATE_REVISION } from '../src/animation/shadow-editor-cache.js'
import { saveShadowRoster, SHADOW_PUPPET_ROSTER_STORAGE_KEY, SHADOW_PUPPET_STORAGE_KEY } from '../src/animation/shadow-rig.js'

const previousWindow = globalThis.window
const entries = new Map([
  ['thetower-save', 'game-save'], ['unrelated-setting', 'setting'],
  [SHADOW_PUPPET_ROSTER_STORAGE_KEY, JSON.stringify({ enemyArtPackVersion: 41, characters: [{ id: 'obsolete', project: { name: 'Old draft' } }] })],
  [SHADOW_PUPPET_STORAGE_KEY, 'old-project'],
  ['thetower-shadow-puppet-roster-v2', 'old-roster'],
  ['thetower-shadow-puppet-project-v2', 'old-project'],
])
globalThis.window = { localStorage: {
  getItem: key => entries.get(key) ?? null,
  setItem: (key, value) => entries.set(key, value),
  removeItem: key => entries.delete(key),
} }
try {
  const fresh = loadCurrentShadowRoster()
  assert.equal(fresh.enemyArtPackVersion, ENEMY_ART_PACK_VERSION)
  assert(!fresh.characters.some(c => c.id === 'obsolete' || !c.project.enemyId && /^New character|\u65b0\u89d2\u8272|Old draft/.test(c.project.name)))
  assert(fresh.characters.some(c => c.project.enemyId === 'moss-colossus'))
  assert.equal(entries.get(SHADOW_TEMPLATE_REVISION_KEY), SHADOW_TEMPLATE_REVISION)
  assert(!entries.has('thetower-shadow-puppet-roster-v2'))
  assert(!entries.has('thetower-shadow-puppet-project-v2'))
  assert.equal(entries.get('thetower-save'), 'game-save')
  assert.equal(entries.get('unrelated-setting'), 'setting')

  const moss = fresh.characters.find(c => c.project.enemyId === 'moss-colossus')
  const codeNeckX = moss.project.joints.find(j => j.id === 'neck').x
  fresh.activeCharacterId = moss.id
  moss.project.joints.find(j => j.id === 'neck').x = 999
  saveShadowRoster(fresh)
  assert.equal(loadCurrentShadowRoster().activeCharacterId, moss.id)
  assert.equal(loadCurrentShadowProject().joints.find(j => j.id === 'neck').x, 999, 'same-version manual drafts still work in the preview')

  entries.set(SHADOW_TEMPLATE_REVISION_KEY, 'previous-code-revision')
  const upgraded = loadCurrentShadowRoster()
  assert.equal(upgraded.characters.find(c => c.project.enemyId === 'moss-colossus').project.joints.find(j => j.id === 'neck').x, codeNeckX, 'code updates discard local model overrides')
  assert(!upgraded.characters.some(c => /\u65e7\u7248\u5907\u4efd/.test(c.project.name)))

  entries.set(SHADOW_PUPPET_ROSTER_STORAGE_KEY, '{broken json')
  entries.set('thetower-shadow-puppet-roster-v2', 'obsolete')
  assert.equal(loadCurrentShadowRoster().enemyArtPackVersion, ENEMY_ART_PACK_VERSION)
  assert(!entries.has('thetower-shadow-puppet-roster-v2'), 'malformed caches are removed rather than migrated')
  globalThis.window.localStorage.removeItem = () => { throw new Error('blocked') }
  globalThis.window.localStorage.getItem = () => { throw new Error('blocked') }
  globalThis.window.localStorage.setItem = () => { throw new Error('full') }
  assert.equal(loadCurrentShadowRoster().enemyArtPackVersion, ENEMY_ART_PACK_VERSION, 'code templates work when storage is blocked or full')
} finally {
  if (previousWindow === undefined) delete globalThis.window
  else globalThis.window = previousWindow
}
console.log('Animation cache: initial reset, code updates, same-version drafts, isolated keys and unavailable storage passed.')
