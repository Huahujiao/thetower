// Status counters are independent. Omitted counters are finite but hidden.
export const DEFAULT_STATUS_LAYERS = 100
export const DEFAULT_STATUS_TURNS = 100
export const POISON_TURNS = 3
export const STATUS_DEFS = Object.freeze({
  fatigue: { name: '疲劳', owner: 'player', trigger: 'turn-supply', layers: 1 },
  'player-poison': { name: '\u4e2d\u6bd2', owner: 'player', trigger: 'turn', turns: POISON_TURNS, damage: 2, ignoreArmor: true },
  'enemy-poison': { name: '\u4e2d\u6bd2', owner: 'enemy', trigger: 'turn', turns: POISON_TURNS, damage: 1 },
  burning: { name: '\u71c3\u70e7', owner: 'player', trigger: 'turn', damage: 1 },
  dodge: { name: '\u95ea\u907f', trigger: 'before-hit', layers: 1 },
  rooted: { name: '缠绕', owner: 'enemy', trigger: 'before-action', turns: 1, blocksAttack: true },
  prey: { name: '\u730e\u7269', owner: 'enemy', trigger: 'pet-target', turns: 1 },
  counter: { name: '\u53cd\u51fb', trigger: 'after-hit', damage: 1 },
  parry: { name: '\u683c\u6321', owner: 'player', trigger: 'before-hit', layers: 1 },
  'attack-reduction': { name: '\u653b\u51fb\u524a\u5f31', owner: 'enemy', trigger: 'before-attack', layers: 1 },
})

function count(value, fallback) {
  return value == null || !Number.isFinite(Number(value)) ? fallback : Math.max(0, Math.floor(Number(value)))
}

export function normalizeStatus(id, options = {}) {
  const definition = STATUS_DEFS[id] || {}
  const merged = { ...definition, ...options, id }
  return {
    ...merged,
    layers: count(merged.layers, DEFAULT_STATUS_LAYERS),
    turns: count(merged.turns, DEFAULT_STATUS_TURNS),
    showLayers: options.showLayers ?? (options.layers != null || definition.layers != null),
    showTurns: options.showTurns ?? (options.turns != null || definition.turns != null),
  }
}

export function normalizeStatuses(actor) {
  actor.statuses ||= {}
  if (typeof actor.statuses !== 'object' || Array.isArray(actor.statuses)) actor.statuses = {}
  for (const [id, value] of Object.entries(actor.statuses)) {
    if (!value || typeof value !== 'object') { delete actor.statuses[id]; continue }
    const normalized = normalizeStatus(id, value)
    if (normalized.layers <= 0 || normalized.turns <= 0) delete actor.statuses[id]
    else Object.assign(value, normalized)
  }
  return actor.statuses
}

export function getStatus(actor, id) {
  const status = actor?.statuses?.[id]
  return status?.layers > 0 && status?.turns > 0 ? status : null
}

export function applyStatus(actor, id, options = {}, { refresh = false } = {}) {
  const definition = STATUS_DEFS[id]
  const isPlayer = actor?.kind !== 'enemy'
  if (!actor || (definition?.owner === 'player' && !isPlayer) || (definition?.owner === 'enemy' && isPlayer)) return null
  actor.statuses ||= {}
  const previous = getStatus(actor, id)
  const status = normalizeStatus(id, options)
  if (refresh && previous) {
    status.layers = Math.max(previous.layers, status.layers)
    status.turns = Math.max(previous.turns, status.turns)
    if (typeof previous.damage === 'number' && typeof status.damage === 'number') status.damage = Math.max(previous.damage, status.damage)
  }
  if (status.layers <= 0 || status.turns <= 0) { delete actor.statuses[id]; return null }
  actor.statuses[id] = status
  return status
}

export function removeStatus(actor, id) { if (actor?.statuses) delete actor.statuses[id] }

export function consumeStatus(actor, id, expected = getStatus(actor, id)) {
  // Callbacks may replace a status with a freshly granted one; never consume that grant.
  if (!expected || actor?.statuses?.[id] !== expected) return false
  expected.layers = Math.max(0, expected.layers - 1)
  if (expected.layers === 0 || expected.turns <= 0) removeStatus(actor, id)
  return true
}

export function statusSnapshot(actor) {
  return Object.entries(normalizeStatuses(actor)).map(([id, status]) => ({ actor, id, status }))
}

export function tickStatusSnapshot(snapshot) {
  for (const { actor, id, status } of snapshot) {
    if (actor.statuses?.[id] !== status) continue
    status.turns = Math.max(0, status.turns - 1)
    if (status.turns === 0 || status.layers <= 0) removeStatus(actor, id)
  }
}

// Damage descriptions survive JSON saves; custom calculations use registered names.
const damageResolvers = new Map([
  ['fixed', (_context, spec) => spec.value || 0],
  ['last-player-attack', ({ run }, spec) => (run.player.lastAttackPower || 0) * (spec.ratio ?? 1)],
  ['incoming-attack', (context, spec) => (context[spec.basis || 'attackDamage'] || 0) * (spec.ratio ?? 1)],
])

export function registerStatusDamageResolver(id, resolver) {
  if (typeof id !== 'string' || !id || typeof resolver !== 'function') throw new TypeError('Invalid status damage resolver')
  damageResolvers.set(id, resolver)
}

export function resolveStatusDamage(status, context) {
  const spec = typeof status.damage === 'number' ? { mode: 'fixed', value: status.damage } : status.damage || { mode: 'fixed', value: 0 }
  const resolver = damageResolvers.get(spec.mode || 'fixed')
  if (!resolver) throw new Error(`Unknown status damage resolver: ${spec.mode}`)
  const result = Number(resolver(context, spec)) + (Number(spec.flat) || 0)
  return Number.isFinite(result) ? Math.max(0, spec.rounding === 'ceil' ? Math.ceil(result) : Math.floor(result)) : 0
}

export function prepareStatusDamage(options, context) {
  if (!options.damage || typeof options.damage !== 'object') return options
  if (!damageResolvers.has(options.damage.mode || 'fixed')) throw new Error(`Unknown status damage resolver: ${options.damage.mode}`)
  const stage = options.damage.stage || (options.damage.mode === 'last-player-attack' ? 'gain' : 'trigger')
  return stage === 'gain' ? { ...options, damage: resolveStatusDamage(options, context) } : options
}

export function statusCounterText(status) {
  return [status?.showLayers ? `\u5269\u4f59${status.layers}\u5c42` : '', status?.showTurns ? `\u5269\u4f59${status.turns}\u56de\u5408` : ''].filter(Boolean).join('\uff0c')
}

// Convenience fields are non-serialized views of the canonical status map.
// Binding only restores accessors; it never migrates old serialized counters.
export function bindStatusAccessors(actor) {
  if (!actor) return actor
  normalizeStatuses(actor)
  const enemy = actor.kind === 'enemy'
  const counters = enemy
    ? [['itemPoisonTurns', 'enemy-poison', 'turns'], ['itemPoisonDamage', 'enemy-poison', 'damage'], ['nextAttackReduction', 'attack-reduction', 'amount']]
    : [['poisonedTurns', 'player-poison', 'turns'], ['poisonDamage', 'player-poison', 'damage'], ['burningTurns', 'burning', 'turns'], ['burningDamage', 'burning', 'damage']]
  for (const [field, id, key] of counters) {
    const descriptor = Object.getOwnPropertyDescriptor(actor, field)
    if (descriptor?.get) continue
    Object.defineProperty(actor, field, { configurable: true, enumerable: false,
      get() { return getStatus(this, id)?.[key] || 0 },
      set(value) {
        const previous = getStatus(this, id)
        if (!(value > 0)) { if (key !== 'damage') removeStatus(this, id); return }
        if (previous) previous[key] = value
        else applyStatus(this, id, { [key]: value })
      },
    })
  }
  if (!enemy) {
    const descriptor = Object.getOwnPropertyDescriptor(actor, 'parry')
    if (!descriptor?.get) {
      Object.defineProperty(actor, 'parry', { configurable: true, enumerable: false,
        get() { return getStatus(this, 'parry') },
        set(value) { if (value) applyStatus(this, 'parry', value); else removeStatus(this, 'parry') },
      })
    }
  }
  return actor
}
