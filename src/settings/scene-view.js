// Shared production artwork. The review fixture only overrides its shot position.
// Keep this data-only so the game/HUD can choose the backdrop before importing 3D.
export const GAME_SCENE_VIEW = Object.freeze({
  environment: 'mountain-temple',
  fitRoom: true,
  zoom: 1,
  cameraElevation: 40 * Math.PI / 180,
  framing: Object.freeze({ halfWidth: 2.35, halfDepth: 1.35, height: 1.6 }),
})
