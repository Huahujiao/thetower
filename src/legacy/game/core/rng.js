// Randomness is deliberately not persisted in phase one.
// Keeping every draw behind this module makes future seeded RNG replacement local.
export function random() {
  return Math.random()
}

export function randomInt(maxExclusive) {
  if (maxExclusive <= 0) return 0
  return Math.floor(random() * maxExclusive)
}

export function pick(items) {
  if (!items || items.length === 0) return undefined
  return items[randomInt(items.length)]
}

export function weightedPick(weightMap) {
  const entries = Object.entries(weightMap).filter(([, weight]) => weight > 0)
  if (!entries.length) return undefined
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = random() * total
  for (const [key, weight] of entries) {
    roll -= weight
    if (roll <= 0) return key
  }
  return entries[entries.length - 1][0]
}

export function shuffle(items) {
  const result = items.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
