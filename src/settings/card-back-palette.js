export const CARD_BACK_PALETTE_KEY = 'thetower_seal_mist_palette_v1'
export const CARD_BACK_COLOR_DEFAULTS = Object.freeze({ scorch: '#b4444b', wither: '#bca14a', drown: '#4777aa' })
export const CARD_BACK_COLOR_OPTIONS = Object.freeze([
  { kind: 'scorch', label: '红色封印' },
  { kind: 'wither', label: '黄色封印' },
  { kind: 'drown', label: '蓝色封印' },
])

export function normalizeCardBackColor(value) {
  if (typeof value !== 'string') return null
  const hex = value.trim().replace(/^#/, '')
  if (/^[0-9a-f]{6}$/i.test(hex)) return '#' + hex.toLowerCase()
  if (/^[0-9a-f]{3}$/i.test(hex)) return '#' + [...hex].map(char => char + char).join('').toLowerCase()
  return null
}

export function normalizeCardBackPalette(palette) {
  return Object.fromEntries(Object.entries(CARD_BACK_COLOR_DEFAULTS).map(([kind, fallback]) =>
    [kind, normalizeCardBackColor(palette?.[kind]) || fallback]))
}

export function loadCardBackPalette(storage) {
  try {
    storage ??= globalThis.localStorage
    return normalizeCardBackPalette(JSON.parse(storage?.getItem(CARD_BACK_PALETTE_KEY) || '{}'))
  } catch { return { ...CARD_BACK_COLOR_DEFAULTS } }
}

export function saveCardBackPalette(palette, storage) {
  try {
    storage ??= globalThis.localStorage
    if (!storage) return false
    const overrides = Object.fromEntries(Object.entries(normalizeCardBackPalette(palette))
      .filter(([kind, color]) => color !== CARD_BACK_COLOR_DEFAULTS[kind]))
    if (Object.keys(overrides).length) storage.setItem(CARD_BACK_PALETTE_KEY, JSON.stringify(overrides))
    else storage.removeItem(CARD_BACK_PALETTE_KEY)
    return true
  } catch { return false }
}

export function cardBackColorHsl(hex) {
  const value = normalizeCardBackColor(hex) || '#000000'
  const [r, g, b] = [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16) / 255)
  const high = Math.max(r, g, b), low = Math.min(r, g, b), delta = high - low
  const lightness = (high + low) / 2
  if (!delta) return [0, 0, lightness]
  const hue = high === r ? ((g - b) / delta + 6) % 6 : high === g ? (b - r) / delta + 2 : (r - g) / delta + 4
  return [hue / 6, delta / (1 - Math.abs(2 * lightness - 1)), lightness]
}
