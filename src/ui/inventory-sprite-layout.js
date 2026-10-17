// The grid cell border is 1px and is painted inside the track (border-box), so
// the artwork viewport has to clear the border itself before the requested
// breathing room starts. Keep BAG_CELL_BORDER in sync with .bag-cell and
// .bag-shape .occupied in styles.css.
export const BAG_CELL_BORDER = 1

// Minimum gap between the visible cell border and the artwork on every side.
export const INVENTORY_SPRITE_INSET = 2

const INVENTORY_SPRITE_TOTAL_INSET = (BAG_CELL_BORDER + INVENTORY_SPRITE_INSET) * 2

// Container units use the actual box, including grid gaps, at quarter turns.
export function inventorySpriteStyle(rotation = 0) {
  const turns = ((Math.trunc(Number(rotation) || 0) % 4) + 4) % 4
  const inset = INVENTORY_SPRITE_TOTAL_INSET
  return {
    width: turns % 2 ? 'calc(100cqh - ' + inset + 'px)' : 'calc(100% - ' + inset + 'px)',
    height: turns % 2 ? 'calc(100cqw - ' + inset + 'px)' : 'calc(100% - ' + inset + 'px)',
    transform: 'translate(-50%, -50%) rotate(' + turns * 90 + 'deg)',
  }
}