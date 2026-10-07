import { ACTIVE_ITEMS } from './wiki-data.js'
import { bagShapeLayout } from './bag-shape.js'
import { itemSpriteSources } from './item-sprites.js'

export const WIKI_ITEM_COLUMNS = 8
export const WIKI_ITEM_VISIBLE_ROWS = 8
export const WIKI_ITEM_CATEGORIES = Object.freeze([
  { id: 'consumables', name: '消耗品', types: ['potion', 'armor', 'buff', 'throwable', 'teleport'] },
  { id: 'weapons', name: '武器', types: ['weapon'] },
  { id: 'defenses', name: '防具', types: ['defense'] },
  { id: 'relics', name: '圣遗物', types: ['relic'] },
  { id: 'materials', name: '材料', types: ['material'] },
  { id: 'pets', name: '宠物', types: ['pet'] },
  { id: 'pouch', name: '钱袋', types: ['money-pouch'] },
])

// Shelf packing keeps the catalog's order and never interleaves categories.
// Reserve the full bounding box so irregular shapes remain easy to inspect.
export function buildWikiInventory(definitions = ACTIVE_ITEMS) {
  const entries = [], headers = []
  let row = 0
  for (const category of WIKI_ITEM_CATEGORIES) {
    const items = definitions.filter(item => category.types.includes(item.type))
    if (!items.length) continue
    headers.push({ ...category, row: row++, count: items.length })
    for (const type of category.types) {
      let x = 0, shelfHeight = 0
      const typed = items.filter(item => item.type === type)
        .sort((a, b) => (a.tier || 1) - (b.tier || 1))
      for (const definition of typed) {
        const item = { ...definition, uid: `wiki-${definition.id}` }
        const shape = item.shape || [[1]]
        const width = Math.max(...shape.map(line => line.length)), height = shape.length
        if (width > WIKI_ITEM_COLUMNS) throw new Error(`Item too wide for Wiki: ${item.id}`)
        if (x + width > WIKI_ITEM_COLUMNS) { row += shelfHeight; x = 0; shelfHeight = 0 }
        const layout = bagShapeLayout(shape)
        const originIndex = row * WIKI_ITEM_COLUMNS + x
        entries.push({
          item, originIndex, category: category.id,
          spriteSources: itemSpriteSources(item),
          itemClasses: ['bag-item', item.type, ...(itemSpriteSources(item) ? ['has-sprite'] : []), ...(item.attribute ? [`attribute-${item.attribute}`] : [])],
          itemStyle: { gridColumn: `${x + 1} / span ${width}`, gridRow: `${row + 1} / span ${height}` },
          shapeStyle: { gridTemplateColumns: `repeat(${width}, 1fr)`, gridTemplateRows: `repeat(${height}, 1fr)` },
          spriteStyle: { transform: 'translate(-50%, -50%)' },
          nameStyle: layout.name ? { gridColumn: `${layout.name.x + 1} / span ${layout.name.width}`, gridRow: layout.name.y + 1 } : undefined,
          cells: layout.cells.map(cell => ({
            index: (row + cell.y) * WIKI_ITEM_COLUMNS + x + cell.x,
            edgeNames: cell.edges.map((visible, i) => visible ? ['top', 'right', 'bottom', 'left'][i] : null).filter(Boolean),
            style: { gridColumn: cell.x + 1, gridRow: cell.y + 1, borderWidth: cell.edges.map(edge => edge ? '1px' : '0').join(' ') },
          })),
        })
        x += width
        shelfHeight = Math.max(shelfHeight, height)
      }
      row += shelfHeight
    }
  }
  const rows = Math.max(WIKI_ITEM_VISIBLE_ROWS, row)
  const itemByCell = new Map(entries.flatMap(entry => entry.cells.map(cell => [cell.index, entry.item])))
  const headerRows = new Set(headers.map(header => header.row))
  const cells = Array.from({ length: rows * WIKI_ITEM_COLUMNS }, (_, index) => ({
    index, label: itemByCell.get(index)?.name || '空格',
  })).filter(cell => !headerRows.has(Math.floor(cell.index / WIKI_ITEM_COLUMNS)))
  return { entries, headers, rows, cells, itemByCell }
}
