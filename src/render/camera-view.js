export const DEFAULT_CAMERA_ELEVATION = 50 * Math.PI / 180
const MAX_PAN_AZIMUTH = 15 * Math.PI / 180

// panX is the view center in room-local coordinates, not the orbiting eye.
export function panAzimuth(panX, halfWidth) {
  if (!(halfWidth > 0)) return 0
  const t = Math.min(1, Math.abs(panX) / halfWidth)
  return Math.sign(panX) * t * t * (3 - 2 * t) * MAX_PAN_AZIMUTH
}
