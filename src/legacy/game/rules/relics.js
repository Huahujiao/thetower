import { resolveNumber } from './modifiers.js'

function asList(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function hookConfig(hook) {
  if (typeof hook === 'function') return { effects: hook }
  if (hook && typeof hook.effects === 'function') return hook
  return null
}

/**
 * Adapter between run-scoped relic data and the generic trigger/modifier
 * systems. A relic definition may expose:
 *
 *   hooks: { 'turn:start': ({ state, relic }) => effects }
 *   modifiers: { 'damage:outgoing': ({ state, relic }) => modifier[] }
 *   actions: { 'relic:active-skill': ({ state, relic }) => effects }
 *
 * The engine owns ordering and lifecycle; individual ids never appear in
 * combat or turn-resolution branches.
 */
export class RelicEngine {
  constructor({ state = null, collection, triggerRegistry, definitions = [] } = {}) {
    this.state = state
    this.collection = collection
    this.triggerRegistry = triggerRegistry
    this.definitions = new Map(
      (Array.isArray(definitions) ? definitions : [])
        .filter((def) => def && def.id)
        .map((def) => [def.id, def]),
    )
    this.cleanups = []
    this.sync()
  }

  setDefinitions(definitions = []) {
    this.definitions = new Map(
      (Array.isArray(definitions) ? definitions : [])
        .filter((def) => def && def.id)
        .map((def) => [def.id, def]),
    )
    return this.sync()
  }

  _activeEntries() {
    if (!this.collection) return []
    return this.collection.active
      .map((id) => ({ id, def: this.definitions.get(id), order: this.collection.acquisitionOrder(id) }))
      .filter((entry) => entry.def)
      .sort((a, b) => a.order - b.order)
  }

  // Active skills are providers, not a second combat system. Relics expose
  // metadata plus an `actions['active-skill']` handler; the runtime only
  // chooses which provider is currently selected and resolves its effects.
  activeSkillEntries() {
    return this._activeEntries()
      .filter((entry) => entry.def.activeSkill)
      .map((entry) => {
        const skill = entry.def.activeSkill
        return {
          ...entry,
          skill: {
            ...skill,
            id: skill.id || `relic:${entry.id}`,
            name: skill.name || entry.def.name,
            icon: skill.icon || '✦',
            cooldown: Math.max(0, Math.floor(Number(skill.cooldown ?? 10) || 0)),
          },
        }
      })
  }

  _context(entry, context = {}) {
    return {
      ...context,
      state: context.state || this.state,
      relic: {
        id: entry.id,
        def: entry.def,
        order: entry.order,
        runtime: this.collection.getRuntime(entry.id),
      },
    }
  }

  sync() {
    for (const cleanup of this.cleanups.splice(0)) cleanup()
    if (!this.triggerRegistry) return this
    for (const entry of this._activeEntries()) {
      const hooks = entry.def.hooks || {}
      for (const [event, rawHooks] of Object.entries(hooks)) {
        asList(rawHooks).forEach((rawHook, hookIndex) => {
          const config = hookConfig(rawHook)
          if (!config) return
          const sourceOrder = entry.order * 100 + hookIndex
          this.cleanups.push(this.triggerRegistry.register({
            event,
            priority: config.priority || 0,
            sourceOrder,
            when: config.when ? (context) => config.when(this._context(entry, context)) : undefined,
            effects: (context) => config.effects(this._context(entry, context)),
          }))
        })
      }
    }
    return this
  }

  collectModifiers(channel, context = {}) {
    const modifiers = []
    for (const entry of this._activeEntries()) {
      const provider = entry.def.modifiers?.[channel]
      if (provider === undefined) continue
      const produced = typeof provider === 'function'
        ? provider(this._context(entry, context))
        : provider
      asList(produced).forEach((modifier, index) => {
        if (!modifier || modifier.value === undefined) return
        modifiers.push({
          ...modifier,
          order: modifier.order ?? entry.order * 100 + index,
          sourceOrder: modifier.sourceOrder ?? entry.order * 100 + index,
          source: modifier.source || `relic:${entry.id}`,
          relicId: entry.id,
        })
      })
    }
    return modifiers
  }

  modifyNumber(channel, baseValue, context = {}) {
    return resolveNumber(baseValue, this.collectModifiers(channel, context))
  }

  modifyNumberAcross(channels, baseValue, context = {}) {
    const names = [...new Set(Array.isArray(channels) ? channels : [channels])]
    return resolveNumber(
      baseValue,
      names.flatMap((channel) => this.collectModifiers(channel, context)),
    )
  }

  invoke(action, context = {}) {
    const effects = []
    for (const entry of this._activeEntries()) {
      const handler = entry.def.actions?.[action]
      if (typeof handler !== 'function') continue
      for (const effect of asList(handler(this._context(entry, context)))) {
        if (effect) effects.push(effect)
      }
    }
    return effects
  }

  invokeActiveSkill(skillId, context = {}) {
    const entry = this.activeSkillEntries().find((candidate) =>
      candidate.skill.id === skillId || candidate.id === skillId)
    if (!entry) return []
    const handler = entry.def.actions?.['active-skill']
    if (typeof handler !== 'function') return []
    const produced = handler(this._context(entry, { ...context, skill: entry.skill, skillId }))
    return asList(produced).filter(Boolean)
  }

  checkAction(action, context = {}) {
    for (const entry of this._activeEntries()) {
      const guard = entry.def.guards?.[action]
      if (typeof guard !== 'function') continue
      if (!guard(this._context(entry, context))) {
        return { allowed: false, relicId: entry.id, reason: 'relic-guard' }
      }
    }
    return { allowed: true }
  }

  activeDefinitions() { return this._activeEntries().map((entry) => entry.def) }
  collectionDefinitions() {
    return (this.collection?.collection || [])
      .map((id) => this.definitions.get(id))
      .filter(Boolean)
  }
}
