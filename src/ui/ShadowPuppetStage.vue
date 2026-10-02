<template>
  <div ref="host" class="shadow-stage" :class="{ interactive }" :aria-label="project.name">
    <div class="shadow-view-controls" @pointerdown.stop>
      <button type="button" :class="{ active: orbitMode }" @click="toggle3D">3D</button>
      <button type="button" @click="resetView">{{ '\u6b63\u9762' }}</button>
    </div>
    <svg class="shadow-axis-indicator" viewBox="0 0 92 92" aria-hidden="true">
      <circle cx="43" cy="45" r="2" fill="#dce8f1" />
      <g v-for="axis in axisMarker" :key="axis.label" :stroke="axis.color" :fill="axis.color">
        <template v-if="axis.endOn">
          <circle cx="43" cy="45" r="5" fill="none" stroke-width="1.5" />
          <circle v-if="axis.towardViewer" cx="43" cy="45" r="1.7" />
          <path v-else d="M40 42 L46 48 M46 42 L40 48" fill="none" stroke-width="1.4" />
        </template>
        <template v-else>
          <line x1="43" y1="45" :x2="axis.x" :y2="axis.y" stroke-width="2" stroke-linecap="round" />
          <polygon :points="axis.arrow" />
        </template>
        <text :x="axis.labelX" :y="axis.labelY" text-anchor="middle" dominant-baseline="middle" stroke="none">{{ axis.label }}</text>
      </g>
    </svg>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { BufferGeometry, Color, DirectionalLight, DoubleSide, EdgesGeometry, Group, HemisphereLight, Line, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshLambertMaterial, OrthographicCamera, PerspectiveCamera, PlaneGeometry, Raycaster, Scene, Shape, ShapeGeometry, SphereGeometry, SRGBColorSpace, TextureLoader, TOUCH, Vector2, Vector3, WebGLRenderer } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { evaluateShadowProject, shadowMatrixPosition } from '../animation/shadow-rig.js'
import { shadowPartGeometry } from '../animation/shadow-geometry.js'
import { FLOOR_URLS, floorTextureIndex } from '../render/board-textures.js'
import { DEFAULT_CAMERA_ELEVATION } from '../render/camera-view.js'

const props = defineProps({
  project: { type: Object, required: true },
  animationId: { type: String, default: null },
  time: { type: Number, default: 0 },
  selectedKind: { type: String, default: null },
  selectedId: { type: String, default: null },
  showBones: { type: Boolean, default: true },
  showGrid: { type: Boolean, default: true },
  showParts: { type: Boolean, default: true },
  interactive: { type: Boolean, default: false },
  jointInteractive: { type: Boolean, default: true },
  boneInteractive: { type: Boolean, default: true },
  partInteractive: { type: Boolean, default: true },
  hiddenPartIds: { type: Array, default: () => [] },
})
const emit = defineEmits(['select', 'drag', 'drag-end', 'canvas-tap', 'view-mode-change'])
const host = ref(null)
const orbitMode = ref(false)
const axisMarker = ref([])
const evaluation = computed(() => evaluateShadowProject(props.project, props.animationId, props.time))
const scene = new Scene()
scene.background = new Color('#182431')
const frontCamera = new OrthographicCamera()
const previewCamera = new PerspectiveCamera(45, 1, 1, 5000)
frontCamera.up.set(0, 1, 0)
previewCamera.up.set(0, 1, 0)
scene.add(new HemisphereLight('#e8f2ff', '#46515d', 1.2))
const keyLight = new DirectionalLight('#ffe5c4', 1.2)
keyLight.position.set(-200, 350, 500)
scene.add(keyLight)
const raycaster = new Raycaster()
raycaster.params.Line.threshold = 10
const textureLoader = new TextureLoader()
const textureCache = new Map()
const geometryCache = new Map()

function cachedPartGeometry(part) {
  const key = JSON.stringify([part.shape, part.width, part.height, part.depth, part.pivotX, part.pivotY])
  if (!geometryCache.has(key)) geometryCache.set(key, shadowPartGeometry(part))
  return geometryCache.get(key)
}
const floorGroup = new Group()
floorGroup.visible = false
scene.add(floorGroup)
const figureGroup = new Group()
scene.add(figureGroup)
const activePointers = new Map()
const objects = []
const AXES = [
  { label: '+X', color: '#e98b85', vector: new Vector3(1, 0, 0) },
  { label: '+Y', color: '#8cce9d', vector: new Vector3(0, 1, 0) },
  { label: '+Z', color: '#86b8ed', vector: new Vector3(0, 0, 1) },
]
let renderer = null
let orbitControls = null
let observer = null
let center = new Vector3()
let zoom = 1
let drag = null
let pinch = null
let framedProject = null
let lastAxisSignature = ''

function clearPointerGesture() {
  if (drag) emit('drag-end', { kind: drag.kind, id: drag.id, cancelled: true })
  drag = null
  pinch = null
  for (const pointerId of activePointers.keys()) {
    if (host.value?.hasPointerCapture(pointerId)) host.value.releasePointerCapture(pointerId)
  }
  activePointers.clear()
}

function resetView() {
  clearPointerGesture()
  center = new Vector3()
  zoom = 1
  orbitMode.value = false
  if (orbitControls) orbitControls.enabled = false
  floorGroup.visible = false
  figureGroup.position.set(0, 0, 0)
  figureGroup.scale.setScalar(1)
  emit('view-mode-change', false)
  updateCamera()
  drawScene()
}

function ensureFloor() {
  if (floorGroup.children.length) return
  const floorTextures = FLOOR_URLS.map((url) => {
    const texture = textureLoader.load(url, render)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 4
    return texture
  })
  for (let row = -2; row <= 2; row += 1) {
    for (let column = -2; column <= 2; column += 1) {
      const tile = new Mesh(
        new PlaneGeometry(150, 150),
        new MeshBasicMaterial({ map: floorTextures[floorTextureIndex({ c: column + 2, r: row + 2 })], side: DoubleSide }),
      )
      tile.rotation.x = -Math.PI / 2
      tile.position.set(column * 150, 0, row * 150)
      tile.renderOrder = -10
      floorGroup.add(tile)
    }
  }
}

function toggle3D() {
  if (orbitMode.value) {
    resetView()
    return
  }
  clearPointerGesture()
  ensureFloor()
  orbitMode.value = true
  floorGroup.visible = true
  framePreview()
  orbitControls.enabled = true
  emit('view-mode-change', true)
  updateCamera()
  drawScene()
}

function fitFigureToTile() {
  const rest = evaluateShadowProject(props.project)
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  const include = (point) => {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
    minZ = Math.min(minZ, point.z)
    maxZ = Math.max(maxZ, point.z)
  }
  for (const entry of rest.joints) include(shadowMatrixPosition(entry.matrix))
  for (const entry of rest.parts) {
    const part = entry.part
    const left = -part.width * part.pivotX
    const top = part.height * part.pivotY
    for (const x of [left, left + part.width]) {
      for (const y of [top, top - part.height]) {
        for (const z of [-(part.depth || 0) / 2, (part.depth || 0) / 2]) include(new Vector3(x, y, z).applyMatrix4(entry.matrix))
      }
    }
  }
  if (!Number.isFinite(minX)) {
    minX = maxX = minY = maxY = minZ = maxZ = 0
  }
  const scale = Math.min(1, 120 / Math.max(1, maxX - minX, maxZ - minZ))
  figureGroup.scale.setScalar(scale)
  figureGroup.position.set(-(minX + maxX) * scale / 2, 0, -(minZ + maxZ) * scale / 2)
  floorGroup.position.y = props.project.grounding && !props.project.grounding.floating
    ? props.project.grounding.floorY * scale : minY * scale - (props.project.stage.floorOffset ?? 8) * scale
  return { height: (maxY - minY) * scale }
}

function framePreview() {
  const { height } = fitFigureToTile()
  const targetY = floorGroup.position.y + height * .48
  const distance = 450
  orbitControls.target.set(0, targetY, 0)
  previewCamera.position.set(0, targetY + distance * Math.sin(DEFAULT_CAMERA_ELEVATION), distance * Math.cos(DEFAULT_CAMERA_ELEVATION))
  orbitControls.update()
  framedProject = props.project
}

function updateCamera() {
  if (!host.value) return
  const width = Math.max(1, host.value.clientWidth)
  const height = Math.max(1, host.value.clientHeight)
  const span = Math.max(props.project.stage.width / width, props.project.stage.height / height) / zoom
  frontCamera.left = -width * span / 2
  frontCamera.right = width * span / 2
  frontCamera.top = height * span / 2
  frontCamera.bottom = -height * span / 2
  frontCamera.position.set(center.x, center.y, center.z + 1000)
  frontCamera.lookAt(center)
  frontCamera.updateProjectionMatrix()
  frontCamera.updateMatrixWorld()
  previewCamera.aspect = width / height
  previewCamera.updateProjectionMatrix()
  renderer?.setSize(width, height, false)
  updateAxisMarker()
}

function render() { renderer?.render(scene, orbitMode.value ? previewCamera : frontCamera) }

function updateAxisMarker() {
  const camera = orbitMode.value ? previewCamera : frontCamera
  camera.updateMatrixWorld()
  const { x, y, z, w } = camera.quaternion
  const signature = `${orbitMode.value}:${x}:${y}:${z}:${w}`
  if (signature === lastAxisSignature) return
  lastAxisSignature = signature
  const inverse = camera.quaternion.clone().invert()
  axisMarker.value = AXES.slice(0, orbitMode.value ? 3 : 2).map(({ label, color, vector }) => {
    const direction = vector.clone().applyQuaternion(inverse)
    const screenLength = Math.hypot(direction.x, direction.y)
    if (screenLength < .18) {
      return { label, color, endOn: true, towardViewer: direction.z > 0, labelX: 61, labelY: 34 }
    }
    const distance = Math.max(18, screenLength * 30)
    const dx = direction.x / screenLength
    const dy = -direction.y / screenLength
    const x = 43 + dx * distance
    const y = 45 + dy * distance
    const baseX = x - dx * 6
    const baseY = y - dy * 6
    const arrow = `${x},${y} ${baseX - dy * 3},${baseY + dx * 3} ${baseX + dy * 3},${baseY - dx * 3}`
    return {
      label, color, endOn: false, x, y, arrow,
      labelX: Math.max(12, Math.min(80, x + dx * 10)),
      labelY: Math.max(10, Math.min(82, y + dy * 10)),
    }
  })
}

function onOrbitChange() {
  updateAxisMarker()
  render()
}

function textureGeometry(part, texture) {
  const image = texture?.image
  const frame = part.visual.textureFrame
  const crop = frame?.crop || { left: 0, top: 0, width: 1, height: 1 }
  const imageWidth = (image?.naturalWidth || image?.width || part.width) / (frame?.columns || 1) * crop.width
  const imageHeight = (image?.naturalHeight || image?.height || part.height) / (frame?.rows || 1) * crop.height
  const imageRatio = imageWidth / imageHeight
  const boxRatio = part.width / part.height
  const contain = part.visual.textureFit !== 'cover'
  const width = contain && imageRatio < boxRatio ? part.height * imageRatio : part.width
  const height = contain && imageRatio > boxRatio ? part.width / imageRatio : part.height
  const left = -part.width * part.pivotX + (part.width - width) / 2
  const top = part.height * part.pivotY - (part.height - height) / 2
  const shape = new Shape()
  shape.moveTo(left, top)
  shape.lineTo(left + width, top)
  shape.lineTo(left + width, top - height)
  shape.lineTo(left, top - height)
  shape.closePath()
  const geometry = new ShapeGeometry(shape)
  const uv = geometry.attributes.uv
  const positions = geometry.attributes.position
  const cropX = !contain && imageRatio > boxRatio ? (1 - boxRatio / imageRatio) / 2 : 0
  const cropY = !contain && imageRatio < boxRatio ? (1 - imageRatio / boxRatio) / 2 : 0
  for (let index = 0; index < uv.count; index += 1) {
    const u = (positions.getX(index) - left) / width
    const v = 1 + (positions.getY(index) - top) / height
    const frameU = cropX + u * (1 - 2 * cropX)
    const frameV = cropY + v * (1 - 2 * cropY)
    uv.setXY(index, frame ? (frame.column + crop.left + frameU * crop.width) / frame.columns : frameU,
      frame ? 1 - (frame.row + crop.top + (1 - frameV) * crop.height) / frame.rows : frameV)
  }
  return geometry
}

function addObject(object, kind = null, id = null) {
  object.userData = { kind, id }
  figureGroup.add(object)
  objects.push(object)
}

function clearObjects() {
  for (const object of objects) {
    figureGroup.remove(object)
    if (!object.userData.sharedGeometry) object.geometry?.dispose()
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose())
    else object.material?.dispose()
  }
  objects.length = 0
}

function line(start, end, color, kind = null, id = null, order = 0) {
  const geometry = new BufferGeometry().setFromPoints([start, end])
  const material = new LineBasicMaterial({ color, depthTest: false, depthWrite: false })
  const object = new Line(geometry, material)
  object.renderOrder = order
  addObject(object, kind, id)
}

function drawScene() {
  clearObjects()
  if (orbitMode.value) fitFigureToTile()
  if (props.showGrid && !orbitMode.value) {
    const halfWidth = props.project.stage.width / 2
    const halfHeight = props.project.stage.height / 2
    for (let x = -halfWidth; x <= halfWidth; x += 25) line(new Vector3(x, -halfHeight, 200), new Vector3(x, halfHeight, 200), '#324454')
    for (let y = -halfHeight; y <= halfHeight; y += 25) line(new Vector3(-halfWidth, y, 200), new Vector3(halfWidth, y, 200), '#324454')
  }
  if (props.showParts) for (const entry of evaluation.value.parts) {
    const part = entry.part
    if (props.hiddenPartIds.includes(part.id)) continue
    const textured = part.visual.type === 'texture' && Boolean(part.visual.texture)
    if (textured && !textureCache.has(part.visual.texture)) {
      const texture = textureLoader.load(part.visual.texture, drawScene)
      texture.colorSpace = SRGBColorSpace
      textureCache.set(part.visual.texture, texture)
    }
    const geometry = textured ? textureGeometry(part, textureCache.get(part.visual.texture)) : cachedPartGeometry(part)
    const Material = textured ? MeshBasicMaterial : MeshLambertMaterial
    const material = new Material({ color: part.fill, side: DoubleSide, transparent: true, opacity: entry.opacity, depthWrite: true })
    if (textured) {
      material.map = textureCache.get(part.visual.texture)
      material.color.set('#ffffff')
      material.alphaTest = 0.02
    }
    const mesh = new Mesh(geometry, material)
    mesh.matrixAutoUpdate = false
    mesh.matrix.copy(entry.matrix)
    mesh.renderOrder = orbitMode.value ? 1 : 10 + entry.order
    addObject(mesh, 'part', part.id)
    mesh.userData.sharedGeometry = !textured
    if (!orbitMode.value && (!textured || (props.selectedKind === 'part' && props.selectedId === part.id))) {
    const outline = new LineSegments(new EdgesGeometry(geometry), new LineBasicMaterial({ color: props.selectedKind === 'part' && props.selectedId === part.id ? '#8fd1ff' : part.stroke, depthTest: false }))
    outline.matrixAutoUpdate = false
    outline.matrix.copy(entry.matrix)
    outline.renderOrder = 30 + entry.order
    outline.visible = !orbitMode.value
    addObject(outline)
    }
  }
  if (props.showBones) {
    for (const entry of evaluation.value.bones) {
      line(new Vector3(entry.x1, entry.y1, entry.z1), new Vector3(entry.x2, entry.y2, entry.z2), props.selectedKind === 'bone' && props.selectedId === entry.bone.id ? '#8fd1ff' : '#bd5b50', 'bone', entry.bone.id, 80)
    }
    for (const entry of evaluation.value.joints) {
      const sphere = new Mesh(new SphereGeometry(props.selectedKind === 'joint' && props.selectedId === entry.joint.id ? 10 : 7, 12, 8), new MeshBasicMaterial({ color: props.selectedKind === 'joint' && props.selectedId === entry.joint.id ? '#8fd1ff' : '#e2b967', depthTest: false, depthWrite: false }))
      sphere.position.copy(new Vector3().setFromMatrixPosition(entry.matrix))
      sphere.renderOrder = 100
      addObject(sphere)
      if (!orbitMode.value) {
        const hit = new Mesh(new SphereGeometry(17, 8, 6), new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }))
        hit.position.copy(sphere.position)
        addObject(hit, 'joint', entry.joint.id)
      }
    }
  }
  render()
}

function screenRay(x, y) {
  const rect = host.value.getBoundingClientRect()
  raycaster.setFromCamera(new Vector2((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1), frontCamera)
  return raycaster.ray
}

function planePoint(x, y, z = 0) {
  const ray = screenRay(x, y)
  const distance = (z - ray.origin.z) / ray.direction.z
  return ray.at(Number.isFinite(distance) ? distance : 0, new Vector3())
}

function hitTest(x, y) {
  screenRay(x, y)
  const hits = raycaster.intersectObjects(objects.filter((object) => object.userData.kind && (object.userData.kind !== 'joint' || props.jointInteractive) && (object.userData.kind !== 'bone' || props.boneInteractive) && (object.userData.kind !== 'part' || props.partInteractive)), false)
  const joint = hits.find((hit) => hit.object.userData.kind === 'joint')
  const hit = joint || hits[0]
  return hit?.object.userData || null
}

function snapshot() {
  const [a, b] = activePointers.values()
  return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) } : null
}

function pointerDown(event) {
  if (!props.interactive || orbitMode.value) return
  event.preventDefault()
  const target = hitTest(event.clientX, event.clientY)
  const pointer = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, suppressTap: false, target }
  activePointers.set(event.pointerId, pointer)
  host.value.setPointerCapture(event.pointerId)
  if (activePointers.size > 1) {
    if (drag) emit('drag-end', { ...drag, cancelled: true })
    drag = null
    for (const entry of activePointers.values()) entry.suppressTap = true
    pinch = snapshot()
  } else if (target) {
    emit('select', target)
    if (target.kind !== 'bone') drag = { ...target, pointerId: event.pointerId, z: target.kind === 'joint' ? shadowMatrixPosition(evaluation.value.jointsById.get(target.id).matrix).z : shadowMatrixPosition(evaluation.value.parts.find((entry) => entry.part.id === target.id).matrix).z }
  }
}

function pointerMove(event) {
  if (orbitMode.value) return
  const pointer = activePointers.get(event.pointerId)
  if (!pointer) return
  const oldX = pointer.x
  const oldY = pointer.y
  pointer.x = event.clientX
  pointer.y = event.clientY
  if (Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) > 6) pointer.moved = true
  if (activePointers.size > 1) {
    const next = snapshot()
    if (pinch && next) zoom = Math.min(8, Math.max(.3, zoom * next.distance / pinch.distance))
    pinch = next
    updateCamera()
  } else if (drag?.pointerId === event.pointerId) {
    emit('drag', { kind: drag.kind, id: drag.id, previous: planePoint(oldX, oldY, drag.z), current: planePoint(pointer.x, pointer.y, drag.z) })
  } else {
    center.add(planePoint(oldX, oldY).sub(planePoint(pointer.x, pointer.y)))
    updateCamera()
  }
  render()
}

function pointerEnd(event, cancelled = false) {
  if (orbitMode.value) return
  const pointer = activePointers.get(event.pointerId)
  if (!pointer) return
  if (!cancelled && activePointers.size === 1 && !pointer.target && !pointer.moved && !pointer.suppressTap) emit('canvas-tap', planePoint(event.clientX, event.clientY))
  if (drag?.pointerId === event.pointerId) {
    emit('drag-end', { kind: drag.kind, id: drag.id, cancelled })
    drag = null
  }
  activePointers.delete(event.pointerId)
  if (host.value?.hasPointerCapture(event.pointerId)) host.value.releasePointerCapture(event.pointerId)
  pinch = activePointers.size > 1 ? snapshot() : null
  for (const remaining of activePointers.values()) remaining.suppressTap = true
}

watch(() => [props.project, props.animationId, props.time, props.selectedKind, props.selectedId, props.showBones, props.showGrid, props.showParts, props.hiddenPartIds], () => {
  if (orbitMode.value && framedProject !== props.project) framePreview()
  updateCamera()
  drawScene()
}, { deep: true })

onMounted(() => {
  renderer = new WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  host.value.appendChild(renderer.domElement)
  orbitControls = new OrbitControls(previewCamera, renderer.domElement)
  orbitControls.enabled = false
  orbitControls.enablePan = false
  orbitControls.minDistance = 220
  orbitControls.maxDistance = 1300
  orbitControls.minPolarAngle = .1
  orbitControls.maxPolarAngle = Math.PI / 2 - .05
  orbitControls.touches.ONE = TOUCH.ROTATE
  orbitControls.touches.TWO = TOUCH.DOLLY_ROTATE
  orbitControls.addEventListener('change', onOrbitChange)
  host.value.addEventListener('pointerdown', pointerDown)
  host.value.addEventListener('pointermove', pointerMove)
  host.value.addEventListener('pointerup', pointerEnd)
  host.value.addEventListener('pointercancel', onPointerCancel)
  observer = new window.ResizeObserver(() => { updateCamera(); render() })
  observer.observe(host.value)
  updateCamera()
  drawScene()
})

function onPointerCancel(event) { pointerEnd(event, true) }

onBeforeUnmount(() => {
  orbitControls?.removeEventListener('change', onOrbitChange)
  orbitControls?.dispose()
  observer?.disconnect()
  host.value?.removeEventListener('pointerdown', pointerDown)
  host.value?.removeEventListener('pointermove', pointerMove)
  host.value?.removeEventListener('pointerup', pointerEnd)
  host.value?.removeEventListener('pointercancel', onPointerCancel)
  clearObjects()
  for (const geometry of geometryCache.values()) geometry.dispose()
  geometryCache.clear()
  for (const tile of floorGroup.children) {
    tile.geometry.dispose()
    tile.material.dispose()
  }
  for (const texture of new Set(floorGroup.children.map((tile) => tile.material.map))) texture.dispose()
  for (const texture of textureCache.values()) texture.dispose()
  renderer?.dispose()
  renderer?.domElement.remove()
})
</script>
