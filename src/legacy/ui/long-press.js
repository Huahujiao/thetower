// Pointer-based long-press helper shared by mobile and desktop controls.
// There is no native HTML "long press" event; pointer events give us one
// implementation for touch, pen and mouse without duplicating touch logic.
export const LONG_PRESS_MS = 520

export function bindLongPress(element, {
  onClick = null,
  onLongPress = null,
  duration = LONG_PRESS_MS,
  moveTolerance = 12,
} = {}) {
  if (!element) return () => {}
  let timer = null
  let pointerId = null
  let startX = 0
  let startY = 0
  let longFired = false

  const clear = () => {
    if (timer !== null) window.clearTimeout(timer)
    timer = null
    pointerId = null
  }
  const cancel = () => {
    clear()
    longFired = false
  }
  const onPointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return
    cancel()
    pointerId = event.pointerId
    startX = event.clientX
    startY = event.clientY
    longFired = false
    element.setPointerCapture?.(event.pointerId)
    event.preventDefault()
    timer = window.setTimeout(() => {
      timer = null
      longFired = true
      onLongPress?.(event)
    }, duration)
  }
  const onPointerMove = (event) => {
    if (pointerId !== event.pointerId) return
    const dx = event.clientX - startX
    const dy = event.clientY - startY
    if (Math.hypot(dx, dy) > moveTolerance) cancel()
  }
  const onPointerUp = (event) => {
    if (pointerId !== event.pointerId) return
    const shouldClick = !longFired && timer !== null
    clear()
    if (shouldClick) onClick?.(event)
    longFired = false
  }
  const onPointerCancel = (event) => {
    if (pointerId === event.pointerId) cancel()
  }
  const onContextMenu = (event) => event.preventDefault()
  const onKeyDown = (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
      event.preventDefault()
      onClick?.(event)
    }
  }

  element.addEventListener('pointerdown', onPointerDown)
  element.addEventListener('pointermove', onPointerMove)
  element.addEventListener('pointerup', onPointerUp)
  element.addEventListener('pointercancel', onPointerCancel)
  element.addEventListener('contextmenu', onContextMenu)
  element.addEventListener('keydown', onKeyDown)

  return () => {
    cancel()
    element.removeEventListener('pointerdown', onPointerDown)
    element.removeEventListener('pointermove', onPointerMove)
    element.removeEventListener('pointerup', onPointerUp)
    element.removeEventListener('pointercancel', onPointerCancel)
    element.removeEventListener('contextmenu', onContextMenu)
    element.removeEventListener('keydown', onKeyDown)
  }
}
