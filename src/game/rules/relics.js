import { getRelicDefinition } from '../data/relics.js'

export class RelicEngine {
  constructor(collection) {
    this.collection = collection
  }

  activeDefinitions() {
    return this.collection.active
      .map((entry) => getRelicDefinition(entry.id))
      .filter(Boolean)
  }

  damageModifiers(context) {
    return this.activeDefinitions().flatMap((definition) => definition.damageModifiers?.(context) || [])
  }

  emit(event, context) {
    return this.activeDefinitions().flatMap((definition) => definition.events?.[event]?.({ ...context, relic: definition }) || [])
  }
}
