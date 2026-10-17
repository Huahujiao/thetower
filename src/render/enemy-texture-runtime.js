import registry from './enemy-texture-runtime.generated.json' with { type: 'json' }
import { enemyTextureUrl } from '../animation/enemy-texture-styles.js'

// Gameplay uses small parts. The editor/style picker continues to use source art.
export function gameplayEnemyTextureUrl(url) {
  const runtime = registry.urls[url]
  return runtime ? runtime + '?v=' + registry.revision : enemyTextureUrl(url)
}
