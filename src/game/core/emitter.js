export function createEmitter() {
  const listeners = new Map()

  function on(event, listener) {
    if (!listeners.has(event)) listeners.set(event, new Set())
    listeners.get(event).add(listener)
    return () => off(event, listener)
  }

  function off(event, listener) {
    listeners.get(event)?.delete(listener)
  }

  function emit(event, payload = undefined) {
    for (const listener of listeners.get(event) || []) listener(payload)
  }

  return { on, off, emit }
}
