import { getRelicDefinition } from '../data/relics.js'

export class RelicEngine {
  constructor(collection) {
    this.collection = collection
  }

  activeDefinitions({ run = null } = {}) {
    if (run?.relicOverload?.() > 0) return []
    return this.collection.active
      .map((entry) => getRelicDefinition(entry.id))
      .filter(Boolean)
  }

  damageModifiers(context) {
    return this.activeDefinitions(context).flatMap((definition) => definition.damageModifiers?.(context) || [])
  }

  emit(event, context) {
    return this.activeDefinitions(context).flatMap((definition) => definition.events?.[event]?.({ ...context, relic: definition }) || [])
  }
}
