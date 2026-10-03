import catalog from './catalog.json' with { type: 'json' }

// Keep runtime enemies and the wiki in sync when tuning the encounter baseline.
export const ENEMY_HP_MULTIPLIER = 1
export const ENEMY_DEFS = Object.freeze(catalog.enemies)
const BY_ID = new Map(ENEMY_DEFS.map((definition) => [definition.id, definition]))

// These lists change which species appear, never their combat stats.
export const CHAPTER_ENCOUNTERS = Object.freeze([
  {
    standard: ['tide-shadow-cub', 'gnawer', 'emberwing-moth'],
    challenge: ['rootrot-bud', 'beetle-guard'],
    counts: { entry: 8, supply: 8, elite: 9, boss: 7 },
  },
  {
    standard: ['rootrot-bud', 'beetle-guard', 'rot-walker', 'patrol-hound', 'claw-beast', 'nest-spider', 'wisp'],
    challenge: ['shellguard', 'redneedle-salamander', 'rot-sac-toad'],
    counts: { entry: 11, supply: 10, elite: 12, boss: 9 },
  },
  {
    standard: ['patrol-hound', 'claw-beast', 'nest-spider', 'wisp', 'furnace-beetle', 'water-leech-swarm', 'whirlpool-eye-sac'],
    challenge: ['broodmother', 'moss-colossus', 'sentry-crossbow', 'ash-cannon-bug', 'thorn-shell-flower'],
    counts: { entry: 14, supply: 13, elite: 16, boss: 12 },
  },
  {
    standard: ['furnace-beetle', 'water-leech-swarm', 'whirlpool-eye-sac', 'tidal-spore-sac', 'cinder-curse-lamp-swarm'],
    challenge: ['molten-core-beast', 'redwheel-fire-crow', 'tide-rite-matriarch', 'drown-shadow-hunter', 'revenant-guard', 'bomb-wisp', 'cracked-hunter'],
    counts: { entry: 18, supply: 16, elite: 20, boss: 15 },
  },
])

export function chapterEncounter(chapter) {
  return CHAPTER_ENCOUNTERS[Math.max(0, Math.min(3, chapter - 1))]
}

export function enemyCountForRoom(room) {
  return chapterEncounter(room.encounterChapter ?? room.chapter).counts[room.role]
}

function shuffled(values, random) {
  const copy = [...values]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function buildEnemyEncounter(chapter, role, count, random = Math.random) {
  const pool = chapterEncounter(chapter)
  const challengeCount = role === 'boss' || (chapter === 1 && role === 'entry')
    ? 0 : role === 'elite' ? (chapter === 1 ? 2 : 3) : 1
  const result = shuffled(pool.challenge, random).slice(0, Math.min(count, challengeCount))
  const ambushLimit = chapter <= 2 ? 1 : 2
  const alertLimit = chapter === 1 ? 2 : chapter === 2 ? 3 : 4
  let bag = []
  while (result.length < count) {
    const eligible = pool.standard.filter((id) => {
      const enemy = BY_ID.get(id)
      if (enemy.behavior === 'ambush' && result.filter((other) => BY_ID.get(other).behavior === 'ambush').length >= ambushLimit) return false
      if (enemy.traits?.includes('alert') && result.filter((other) => BY_ID.get(other).traits?.includes('alert')).length >= alertLimit) return false
      return true
    })
    bag = bag.filter((id) => eligible.includes(id))
    if (!bag.length) bag = shuffled(eligible, random)
    if (!bag.length) throw new Error(`No eligible enemies for chapter ${chapter}, role ${role}`)
    result.push(bag.pop())
  }
  return shuffled(result, random)
}

export function enemyDefinitionFor(chapter, index) {
  const available = chapterEncounter(chapter).standard.map((id) => BY_ID.get(id))
  return available[index % available.length]
}

export function getEnemyDefinition(id) { return BY_ID.get(id) || null }
