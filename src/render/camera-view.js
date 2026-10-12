export const DEFAULT_CAMERA_ELEVATION = 50 * Math.PI / 180
const MAX_PAN_AZIMUTH = 15 * Math.PI / 180

// Fit a room and its standing figures in perspective, including the near
// corners whose apparent size grows as they approach the camera.
export function roomOverviewDistance({ halfWidth, halfDepth, height, elevation, verticalFov, aspect, targetY = -0.35 }) {
  const tanVertical = Math.tan(verticalFov / 2)
  const tanHorizontal = tanVertical * aspect
  const sine = Math.sin(elevation), cosine = Math.cos(elevation)
  let distance = 0
  for (const x of [-halfWidth, halfWidth]) {
    for (const y of [0, height]) {
      for (const z of [-halfDepth, halfDepth]) {
        const relativeY = y - targetY
        const towardCamera = relativeY * sine + z * cosine
        const viewY = relativeY * cosine - z * sine
        distance = Math.max(distance,
          Math.abs(x) / tanHorizontal + towardCamera,
          Math.abs(viewY) / tanVertical + towardCamera)
      }
    }
  }
  return distance * 1.08
}

// panX is the view center in room-local coordinates, not the orbiting eye.
export function panAzimuth(panX, halfWidth) {
  if (!(halfWidth > 0)) return 0
  const t = Math.min(1, Math.abs(panX) / halfWidth)
  return Math.sign(panX) * t * t * (3 - 2 * t) * MAX_PAN_AZIMUTH
}
