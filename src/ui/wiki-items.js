import { ACTIVE_ITEMS } from './wiki-data.js'
import { bagShapeLayout } from './bag-shape.js'
import { itemSpriteSources } from './item-sprites.js'
import { rotateShape } from '../game/model/backpack.js'

export const WIKI_ITEM_COLUMNS = 8
export const WIKI_ITEM_VISIBLE_ROWS = 8
const WEAPON_COLOR_ORDER = ['scorch', 'wither', 'drown']
export const WIKI_RELIC_GROUPS = Object.freeze([
  ['r-scales', 'r-single-seal', 'r-relay-badge', 'r-switch-ring'],
  ['r-empty', 'r-lone-edge', 'r-heavy-wrist'],
  ['r-traveler', 'r-step-edge', 'r-step-boots', 'r-turn-shield'],
  ['r-extreme-range', 'r-range-mirror'],
  ['r-armor-command', 'r-iron-will', 'r-armor-ring', 'r-guard-return'],
  ['r-blood'],
  ['r-miasma-sac', 'r-bone-incense', 'r-plague-bell'],
  ['r-money-scale', 'r-wealth-scale', 'r-gold-fuel', 'r-trade-voucher', 'r-ledger'],
  ['r-pill-ticket', 'r-loot-pouch', 'r-furnace', 'r-chain-drink', 'r-launcher'],
  ['r-totem-drum', 'r-totem-ward', 'r-totem-spirit', 'r-totem-bind', 'r-totem-gas', 'r-totem-soul'],
  ['r-far-whistle', 'r-hunting-horn', 'r-pack-hunt', 'r-feeding-charm'],
])
const RELIC_ORDER = new Map(WIKI_RELIC_GROUPS.flat().map((id, index) => [id, index]))
export const WIKI_ITEM_CATEGORIES = Object.freeze([
  { id: 'consumables', name: '消耗品', types: ['potion', 'armor', 'buff', 'throwable', 'teleport'] },
  { id: 'weapons', name: '武器', types: ['weapon'] },
  { id: 'defenses', name: '防具', types: ['defense'] },
  { id: 'relics', name: '圣遗物', types: ['relic'] },
  { id: 'materials', name: '材料', types: ['material'] },
  { id: 'pets', name: '宠物', types: ['pet'] },
])

function placementFor(item, startRow, endRow, occupied, minimumIndex) {
  const signatures = new Set()
  const variants = (item.rotatable === false ? [0] : [0, 1, 2, 3]).flatMap(rotation => {
    const shape = rotateShape(item.shape || [[1]], rotation)
    const signature = shape.map(line => line.join('')).join('/')
    if (signatures.has(signature) || shape[0].length > WIKI_ITEM_COLUMNS) return []
    signatures.add(signature)
    return [{ rotation, shape, layout: bagShapeLayout(shape) }]
  })
  let best = null
  for (const variant of variants) {
    const width = variant.shape[0].length, height = variant.shape.length
    for (let y = startRow; y <= endRow; y++) {
      const bottom = Math.max(endRow, y + height)
      if (best && bottom > best.bottom) continue
      for (let x = 0; x <= WIKI_ITEM_COLUMNS - width; x++) {
        const anchor = variant.layout.cells[0]
        if ((y + anchor.y) * WIKI_ITEM_COLUMNS + x + anchor.x < minimumIndex) continue
        if (variant.layout.cells.some(cell => occupied.has((y + cell.y) * WIKI_ITEM_COLUMNS + x + cell.x))) continue
        if (!best || bottom < best.bottom || (bottom === best.bottom && (y < best.y || (y === best.y && x < best.x)))) {
          best = { ...variant, x, y, width, height, bottom }
        }
      }
    }
  }
  if (!best) throw new Error(`Item cannot fit in Wiki: ${item.id}`)
  return best
}

function itemOrder(a, b) {
  if (a.type === 'weapon') {
    const rank = item => WEAPON_COLOR_ORDER.includes(item.attribute) ? WEAPON_COLOR_ORDER.indexOf(item.attribute) : 3
    const colorOrder = rank(a) - rank(b)
    if (colorOrder) return colorOrder
  }
  if (a.type === 'defense') {
    const area = item => item.shape.flat().filter(Boolean).length
    const bounds = item => item.shape.length * Math.max(...item.shape.map(row => row.length))
    const sizeOrder = area(b) - area(a) || bounds(b) - bounds(a)
    if (sizeOrder) return sizeOrder
  }
  if (a.type === 'relic') return (RELIC_ORDER.get(a.id) ?? Infinity) - (RELIC_ORDER.get(b.id) ?? Infinity)
  return (a.tier || 1) - (b.tier || 1)
}

// Fill occupied-cell gaps within each category; prefer rotations that use fewer
// rows, then the uppermost/leftmost position. Category boundaries stay intact.
export function buildWikiInventory(definitions = ACTIVE_ITEMS) {
  const entries = [], headers = []
  const occupied = new Set()
  let row = 0
  for (const category of WIKI_ITEM_CATEGORIES) {
    const items = definitions.filter(item => category.types.includes(item.type))
    if (!items.length) continue
    headers.push({ ...category, row: row++, count: items.length })
    const startRow = row
    for (const type of category.types) {
      let minimumIndex = startRow * WIKI_ITEM_COLUMNS
      let color = null, colorEnd = minimumIndex
      const typed = items.filter(item => item.type === type)
        .sort(itemOrder)
      for (const definition of typed) {
        const item = { ...definition, uid: `wiki-${definition.id}` }
        if (type === 'weapon' && color !== item.attribute) {
          minimumIndex = colorEnd
          color = item.attribute
        }
        const { shape, rotation, layout, x, y, width, height, bottom } = placementFor(item, startRow, row, occupied, minimumIndex)
        const anchor = layout.cells[0]
        const originIndex = (y + anchor.y) * WIKI_ITEM_COLUMNS + x + anchor.x
        colorEnd = Math.max(colorEnd, originIndex + 1)
        const oddRotation = rotation % 2 === 1
        entries.push({
          item, originIndex, shape, rotation, category: category.id,
          spriteSources: itemSpriteSources(item),
          itemClasses: ['bag-item', item.type, ...(itemSpriteSources(item) ? ['has-sprite'] : []), ...(item.attribute ? [`attribute-${item.attribute}`] : [])],
          itemStyle: { gridColumn: `${x + 1} / span ${width}`, gridRow: `${y + 1} / span ${height}` },
          shapeStyle: { gridTemplateColumns: `repeat(${width}, 1fr)`, gridTemplateRows: `repeat(${height}, 1fr)` },
          spriteStyle: {
            width: oddRotation ? `${height / width * 100}%` : '100%',
            height: oddRotation ? `${width / height * 100}%` : '100%',
            transform: `translate(-50%, -50%) rotate(${rotation * 90}deg)`,
          },
          nameStyle: layout.name ? { gridColumn: `${layout.name.x + 1} / span ${layout.name.width}`, gridRow: layout.name.y + 1 } : undefined,
          cells: layout.cells.map(cell => ({
            index: (y + cell.y) * WIKI_ITEM_COLUMNS + x + cell.x,
            edgeNames: cell.edges.map((visible, i) => visible ? ['top', 'right', 'bottom', 'left'][i] : null).filter(Boolean),
            style: { gridColumn: cell.x + 1, gridRow: cell.y + 1, borderWidth: cell.edges.map(edge => edge ? '1px' : '0').join(' ') },
          })),
        })
        for (const cell of layout.cells) occupied.add((y + cell.y) * WIKI_ITEM_COLUMNS + x + cell.x)
        row = bottom
      }
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
