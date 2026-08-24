// Small synchronous emitter used by the UI and the rules layer.
export function makeEmitter() {
  const listeners = new Map()
  return {
    on(event, callback) {
      const list = listeners.get(event) || []
      list.push(callback)
      listeners.set(event, list)
      return () => this.off(event, callback)
    },
    off(event, callback) {
      const list = listeners.get(event)
      if (!list) return
      listeners.set(event, list.filter((item) => item !== callback))
    },
    emit(event, payload) {
      const list = listeners.get(event)
      if (!list) return
      for (const callback of list.slice()) callback(payload)
    },
    clear() {
      listeners.clear()
    },
  }
}
