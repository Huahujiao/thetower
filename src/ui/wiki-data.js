import { ALL_ITEM_DEFS } from '../game/data/content.js'
import { CHAPTER_ENCOUNTERS } from '../game/data/enemies.js'
import { DUNGEON_CONFIG } from '../game/model/dungeon.js'

export const ACTIVE_ITEMS = ALL_ITEM_DEFS.filter(item => !item.disabled)
export const SHOP_ITEMS = ACTIVE_ITEMS.filter(item => !item.generatedOnly && !item.starterOnly)
export const REGULAR_ITEMS = ACTIVE_ITEMS.filter(item => !item.generatedOnly)
export const APPEARANCE_LABELS = Object.freeze({ sword: '剑', dagger: '匕首', axe: '斧', bow: '弓', spear: '枪', maul: '锤' })

export function shapeText(item) {
  return `${item.shape.map(row => row.map(cell => cell ? '■' : '·').join('')).join('/')}（${item.shape.flat().filter(Boolean).length}格）`
}

export function markdownCell(value) {
  return String(value ?? '—').replaceAll('|', '｜').replaceAll('\n', '<br>')
}

export function itemRows(items, values) {
  return items.map(item => `| ${values(item).map(markdownCell).join(' | ')} |`).join('\n')
}

export function itemUnlockFloor(item) {
  return Math.ceil(((item.minFloor || 1) - 1) / DUNGEON_CONFIG.progressionRate) + 1
}

export function enemyDistribution(enemy) {
  if (enemy.spawnOnly) return '生成物'
  if (enemy.id === 'overseer') return '第6层最终首领'
  const entries = CHAPTER_ENCOUNTERS.flatMap((pool, index) => [
    pool.standard.includes(enemy.id) ? `${index + 1}档常规` : '',
    pool.challenge.includes(enemy.id) ? `${index + 1}档挑战` : '',
  ]).filter(Boolean)
  if (enemy.id === 'moss-colossus') entries.push('第3层首领')
  return entries.join('、') || '不自然生成'
}
