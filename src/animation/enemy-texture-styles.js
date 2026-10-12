import registry from './enemy-texture-styles.generated.json' with { type: 'json' }

export const ENEMY_TEXTURE_STYLES = Object.freeze([
  { id: 'original', label: '\u539f\u56fe' }, ...registry.styles,
])
const sources = new Set(registry.sources)
const styles = new Map(ENEMY_TEXTURE_STYLES.map(style => [style.id, style]))

export function normalizeEnemyTextureStyle(id) {
  return styles.has(id) ? id : 'original'
}

export function enemyTextureRevision(styleId = 'original') {
  // Poses and skeleton revisions do not change the PNG bytes.
  return `textures-${styles.get(styleId)?.revision || registry.sourceDigest.slice(0, 12)}`
}

// Resolve only at display time: code models and original artwork stay intact.
export function enemyTextureUrl(url, styleId = 'original') {
  const style = styles.get(styleId)
  if (!url || !sources.has(url)) return url
  const path = style?.root ? `${style.root}${url.slice('/assets/enemies/'.length)}` : url
  return `${path}?v=${enemyTextureRevision(styleId)}`
}
