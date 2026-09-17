import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as THREE from 'three'
import { DEFAULT_CAMERA_ELEVATION, panAzimuth } from '../src/render/camera-view.js'

const close = (actual, expected) => assert(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`)
const max = Math.PI / 12
close(DEFAULT_CAMERA_ELEVATION, 50 * Math.PI / 180)
for (const halfWidth of [2, 5, 10]) {
  close(panAzimuth(0, halfWidth), 0)
  for (const sign of [-1, 1]) {
    close(panAzimuth(sign * halfWidth, halfWidth), sign * max)
    close(panAzimuth(sign * halfWidth * 3, halfWidth), sign * max)
    close(panAzimuth(sign * halfWidth / 2, halfWidth), sign * max / 2)
  }
  let previous = -max
  for (let x = -halfWidth * 2; x <= halfWidth * 2; x += halfWidth / 100) {
    const angle = panAzimuth(x, halfWidth)
    assert(angle >= previous - 1e-12 && angle <= max)
    close(angle, -panAzimuth(-x, halfWidth))
    previous = angle
  }
}

// Import scene logic without a browser or asset loader; do not construct WebGL.
const sceneUrl = new URL('../src/render/scene.js', import.meta.url)
const source = (await readFile(sceneUrl, 'utf8'))
  .replace("import { BoardTextures } from './board-textures.js'", 'class BoardTextures {}')
  .replace(/from '([^']+)'/g, (_, path) => `from '${path.startsWith('.') ? new URL(path, sceneUrl).href : import.meta.resolve(path)}'`)
const { GameScene } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const scene = Object.create(GameScene.prototype)
Object.assign(scene, {
  run: { currentRoom: { width: 9, height: 5 } },
  roomGroup: new THREE.Group(), camera: new THREE.PerspectiveCamera(45, 1, 0.1, 80),
  baseCameraDistance: 12, zoom: 1, cameraElevation: DEFAULT_CAMERA_ELEVATION,
  tileMeshes: [Object.assign(new THREE.Object3D(), { userData: { standing: true } })],
})
for (const x of [-20, -5.142, 0, 5.142, 20]) {
  scene.roomGroup.position.x = -x
  scene._updateCamera()
  close(scene.cameraAzimuth, panAzimuth(x, 5.142))
  close(scene.tileMeshes[0].rotation.y, scene.cameraAzimuth)
  const direction = scene.camera.getWorldDirection(new THREE.Vector3())
  close(Math.asin(-direction.y), DEFAULT_CAMERA_ELEVATION)
  const angle = scene.cameraAzimuth
  scene.zoom = 2
  scene.roomGroup.position.z = 8
  scene._updateCamera()
  close(scene.cameraAzimuth, angle)
}
scene._clampPan(scene.run.currentRoom)
close(scene.cameraAzimuth, max)
scene.run.currentRoom = { width: 20, height: 5 }
scene._updateCamera()
assert(scene.cameraAzimuth < max, 'Room changes must update the rotation boundary')
console.log('camera-view-check passed: 50-degree pitch, smooth bounded yaw, room/zoom/pan updates, facing tokens')
