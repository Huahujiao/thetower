import { enemyTextureRevision } from '../animation/enemy-texture-styles.js'

// Bump this when the thumbnail renderer changes its framing or appearance.
const RENDER_REVISION = 'portrait-v1'
const DATABASE = 'thetower-enemy-thumbnails'
const STORE = 'styles'
const rememberedPortraits = import.meta.hot?.data.portraits || new Map()
if (import.meta.hot) import.meta.hot.data.portraits = rememberedPortraits

// Only the standing model affects a portrait. Animation edits, the global
// art-pack version, and unrelated enemies must not invalidate this image.
export function enemyThumbnailModelRevision(project) {
  const source = JSON.stringify([project.joints, project.bones, project.parts, project.grounding])
  let hash = 2166136261, second = 5381
  for (let i = 0; i < source.length; i++) {
    const code = source.charCodeAt(i)
    hash = Math.imul(hash ^ code, 16777619)
    second = Math.imul(second, 33) ^ code
  }
  return `${source.length}-${(hash >>> 0).toString(16)}-${(second >>> 0).toString(16)}`
}

// IndexedDB keeps rendered portraits across navigations without using the
// localStorage quota reserved for game saves and editor drafts.
export function createEnemyThumbnailCache(getStorage = () => globalThis.indexedDB, portraits = rememberedPortraits) {
  let database = null
  function open() {
    if (!database) database = new Promise(resolve => {
      try {
        const request = getStorage()?.open(DATABASE, 1)
        if (!request) { resolve(null); return }
        let settled = false
        const finish = db => { settled = true; resolve(db) }
        request.onupgradeneeded = () => request.result.createObjectStore(STORE)
        request.onsuccess = () => {
          if (settled) { request.result.close(); return }
          request.result.onversionchange = () => { request.result.close(); database = null }
          finish(request.result)
        }
        request.onerror = request.onblocked = () => finish(null)
      } catch { resolve(null) }
    })
    return database
  }
  async function access(mode, operation) {
    try {
      const db = await open()
      if (!db) return null
      return await new Promise(resolve => {
        const transaction = db.transaction(STORE, mode)
        const request = operation(transaction.objectStore(STORE))
        transaction.oncomplete = () => resolve(request.result ?? null)
        transaction.onerror = transaction.onabort = () => resolve(null)
      })
    } catch { return null }
  }
  const revision = style => `${RENDER_REVISION}:${enemyTextureRevision(style)}`
  function current(style, record) {
    return record?.revision === revision(style) ? record : { revision: revision(style), models: {}, images: {} }
  }
  function select(style, projects, record) {
    const valid = current(style, record)
    return Object.fromEntries(projects.flatMap(project => {
      const image = valid.images?.[project.enemyId]
      return valid.models?.[project.enemyId] === enemyThumbnailModelRevision(project)
        && typeof image === 'string' && image.startsWith('data:image/webp') ? [[project.enemyId, image]] : []
    }))
  }
  return {
    peek(style, projects) {
      return select(style, projects, portraits.get(style))
    },
    async load(style, projects) {
      const remembered = select(style, projects, portraits.get(style))
      if (projects.every(project => remembered[project.enemyId])) return remembered
      const stored = current(style, await access('readonly', store => store.get(style)))
      const latest = current(style, portraits.get(style))
      const record = { revision: revision(style), models: { ...stored.models, ...latest.models },
        images: { ...stored.images, ...latest.images } }
      portraits.set(style, record)
      return select(style, projects, record)
    },
    async save(style, projects, images) {
      const previous = current(style, portraits.get(style))
      const record = { revision: revision(style), models: { ...previous.models }, images: { ...previous.images } }
      for (const project of projects) {
        const image = images[project.enemyId]
        if (typeof image !== 'string' || !image.startsWith('data:image/webp')) continue
        record.models[project.enemyId] = enemyThumbnailModelRevision(project)
        record.images[project.enemyId] = image
      }
      // Update memory immediately for Vue remounts/HMR, even if disk storage
      // is unavailable. Saving each finished portrait retains partial work.
      portraits.set(style, record)
      await access('readwrite', store => store.put(record, style))
    },
    close() {
      database?.then(db => db?.close())
      database = null
    },
  }
}
