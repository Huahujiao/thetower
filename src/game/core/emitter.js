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
    // Event listeners belong to separate runtime layers (Vue HUD, Three.js,
    // animations, and gameplay effects).  A renderer failure must not prevent
    // the HUD listener from advancing its reactive revision, otherwise the
    // model is saved correctly but the screen only catches up after reload.
    for (const listener of [...(listeners.get(event) || [])]) {
      try {
        listener(payload)
      } catch (error) {
        console.error(`[event:${event}] listener failed`, error)
      }
    }
  }

  return { on, off, emit }
}
