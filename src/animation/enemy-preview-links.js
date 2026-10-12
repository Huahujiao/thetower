export function enemyDetailHref(enemyId, textureStyle = 'original') {
  return `/animedetail/${encodeURIComponent(enemyId)}${textureStyle === 'original' ? '' : `?style=${encodeURIComponent(textureStyle)}`}`
}

export function enemyGalleryHref(textureStyle = 'original') {
  return `/animepreview${textureStyle === 'original' ? '' : `?style=${encodeURIComponent(textureStyle)}`}`
}
