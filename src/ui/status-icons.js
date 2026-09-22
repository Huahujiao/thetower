/* global URL */
const STATUS_ICONS = Object.freeze({
  poison: new URL('../assets/status/status-poison-v1-small.png', import.meta.url).href,
  burning: new URL('../assets/status/status-burning-v1-small.png', import.meta.url).href,
  'rage-wine': new URL('../assets/status/status-rage-wine-v1-small.png', import.meta.url).href,
  'attack-up': new URL('../assets/status/status-attack-up-v1-small.png', import.meta.url).href,
  'energy-discount': new URL('../assets/status/status-energy-discount-v1-small.png', import.meta.url).href,
})

export function statusIconSource(id, buff = null) {
  if (STATUS_ICONS[id]) return STATUS_ICONS[id]
  if (buff?.flat) return STATUS_ICONS['attack-up']
  if (buff?.discount) return STATUS_ICONS['energy-discount']
  return null
}
