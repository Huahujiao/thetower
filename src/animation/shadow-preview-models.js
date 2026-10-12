import { createEnemyShadowProjects } from './shadow-enemies.js'
import { normalizeShadowProject } from './shadow-rig.js'
export { enemyDetailHref, enemyGalleryHref } from './enemy-preview-links.js'

// Result inspection always uses current code models, including the boss.
export function createEnemyPreviewModels() {
  return createEnemyShadowProjects({ includeBoss: true }).map(normalizeShadowProject)
}
