import { createEnemyShadowProjects } from './shadow-enemies.js'
import { normalizeShadowProject } from './shadow-rig.js'

// Result inspection always uses current code models, including the boss.
export function createEnemyPreviewModels() {
  return createEnemyShadowProjects({ includeBoss: true }).map(normalizeShadowProject)
}

export function enemyDetailHref(enemyId) {
  return `/animedetail/${encodeURIComponent(enemyId)}`
}
