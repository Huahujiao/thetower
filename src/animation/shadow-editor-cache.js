import { ENEMY_ART_PACK_VERSION, installEnemyShadowProjects } from './shadow-enemies.js'
import { SHADOW_EXAMPLE_REPAIR_VERSION, installInitialShadowExamples, repairInitialShadowExamples } from './shadow-examples.js'
import { loadShadowRoster, normalizeShadowRoster, saveShadowRoster, SHADOW_PUPPET_ROSTER_STORAGE_KEY, SHADOW_PUPPET_STORAGE_KEY } from './shadow-rig.js'

export const SHADOW_TEMPLATE_REVISION_KEY = 'thetower-shadow-template-revision'
export const SHADOW_TEMPLATE_REVISION = `code-v1:enemies-${ENEMY_ART_PACK_VERSION}:examples-${SHADOW_EXAMPLE_REPAIR_VERSION}`
const CACHE_KEYS = [SHADOW_PUPPET_ROSTER_STORAGE_KEY, SHADOW_PUPPET_STORAGE_KEY,
  'thetower-shadow-puppet-roster-v2', 'thetower-shadow-puppet-project-v2']

// Only animation drafts belong to this cache. Game saves/settings are separate.
export function resetStaleShadowCache() {
  try {
    const storage = window.localStorage
    let roster = null
    try { roster = JSON.parse(storage.getItem(SHADOW_PUPPET_ROSTER_STORAGE_KEY) || 'null') } catch { /* Remove corrupt drafts too. */ }
    if (storage.getItem(SHADOW_TEMPLATE_REVISION_KEY) === SHADOW_TEMPLATE_REVISION
      && roster?.enemyArtPackVersion === ENEMY_ART_PACK_VERSION) return false
    for (const key of CACHE_KEYS) storage.removeItem(key)
    storage.removeItem(SHADOW_TEMPLATE_REVISION_KEY)
  } catch { /* An inaccessible or malformed cache must not override code models. */ }
  return true
}

export function loadCurrentShadowRoster() {
  const reset = resetStaleShadowCache()
  const roster = normalizeShadowRoster(reset ? null : loadShadowRoster())
  const examplesInstalled = installInitialShadowExamples(roster)
  const examplesRepaired = repairInitialShadowExamples(roster)
  const enemiesInstalled = installEnemyShadowProjects(roster)
  if (reset || examplesInstalled || examplesRepaired || enemiesInstalled) {
    try {
      saveShadowRoster(roster)
      window.localStorage.setItem(SHADOW_TEMPLATE_REVISION_KEY, SHADOW_TEMPLATE_REVISION)
    } catch { /* Fresh code models also work with storage disabled or full. */ }
  }
  return roster
}

export function loadCurrentShadowProject() {
  const roster = loadCurrentShadowRoster()
  return roster.characters.find(c => c.id === roster.activeCharacterId).project
}
