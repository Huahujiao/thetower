<template>
  <div ref="host" class="shadow-stage" :class="{ interactive }" :aria-label="project.name">
    <div class="shadow-view-controls" @pointerdown.stop>
      <button type="button" :class="{ active: orbitMode }" @click="orbitMode = !orbitMode">3D</button>
      <button type="button" @click="resetView">{{ '\u6b63\u9762' }}</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { BufferGeometry, Color, DoubleSide, EdgesGeometry, Line, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, OrthographicCamera, Raycaster, Scene, Shape, ShapeGeometry, SphereGeometry, TextureLoader, Vector2, Vector3, WebGLRenderer } from 'three'
import { evaluateShadowProject, shadowMatrixPosition } from '../animation/shadow-rig.js'

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
})
const emit = defineEmits(['select', 'drag', 'drag-end', 'canvas-tap'])
const host = ref(null)
const orbitMode = ref(false)
const evaluation = computed(() => evaluateShadowProject(props.project, props.animationId, props.time))
const scene = new Scene()
scene.background = new Color('#182431')
const camera = new OrthographicCamera()
camera.up.set(0, -1, 0)
const raycaster = new Raycaster()
raycaster.params.Line.threshold = 10
const textureLoader = new TextureLoader()
const textureCache = new Map()
const activePointers = new Map()
const objects = []
let renderer = null
let observer = null
let center = new Vector3()
let zoom = 1
let yaw = 0
let pitch = 0
let drag = null
let pinch = null

function resetView() {
  center = new Vector3()
  zoom = 1
  yaw = 0
  pitch = 0
  orbitMode.value = false
  updateCamera()
  render()
}

function updateCamera() {
  if (!host.value) return
  const width = Math.max(1, host.value.clientWidth)
  const height = Math.max(1, host.value.clientHeight)
  const span = Math.max(props.project.stage.width / width, props.project.stage.height / height) / zoom
  camera.left = -width * span / 2
  camera.right = width * span / 2
  camera.top = height * span / 2
  camera.bottom = -height * span / 2
  camera.position.set(center.x + Math.sin(yaw) * Math.cos(pitch) * 1000, center.y + Math.sin(pitch) * 1000, center.z - Math.cos(yaw) * Math.cos(pitch) * 1000)
  camera.lookAt(center)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
  renderer?.setSize(width, height, false)
}

function render() { renderer?.render(scene, camera) }

function shapeGeometry(part) {
  const width = part.width
  const height = part.height
  const left = -width * part.pivotX
  const top = -height * part.pivotY
  const shape = new Shape()
  if (part.shape === 'circle' || part.shape === 'ellipse' || part.shape === 'capsule') {
    const rx = width / 2
    const ry = height / 2
    const cx = left + rx
    const cy = top + ry
    shape.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false, 0)
  } else if (part.shape === 'triangle') {
    shape.moveTo(left + width / 2, top)
    shape.lineTo(left + width, top + height)
    shape.lineTo(left, top + height)
    shape.closePath()
  } else if (part.shape === 'diamond') {
    shape.moveTo(left + width / 2, top)
    shape.lineTo(left + width, top + height / 2)
    shape.lineTo(left + width / 2, top + height)
    shape.lineTo(left, top + height / 2)
    shape.closePath()
  } else {
    shape.moveTo(left, top)
    shape.lineTo(left + width, top)
    shape.lineTo(left + width, top + height)
    shape.lineTo(left, top + height)
    shape.closePath()
  }
  const geometry = new ShapeGeometry(shape)
  const positions = geometry.attributes.position
  const uv = geometry.attributes.uv
  for (let index = 0; index < uv.count; index += 1) {
    uv.setXY(index, (positions.getX(index) - left) / width, 1 - (positions.getY(index) - top) / height)
  }
  uv.needsUpdate = true
  return geometry
}

function addObject(object, kind = null, id = null) {
  object.userData = { kind, id }
  scene.add(object)
  objects.push(object)
}

function clearObjects() {
  for (const object of objects) {
    scene.remove(object)
    object.geometry?.dispose()
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose())
    else object.material?.dispose()
  }
  objects.length = 0
}

function line(start, end, color, kind = null, id = null, order = 0) {
  const geometry = new BufferGeometry().setFromPoints([start, end])
  const material = new LineBasicMaterial({ color, depthTest: false })
  const object = new Line(geometry, material)
  object.renderOrder = order
  addObject(object, kind, id)
}

function drawScene() {
  clearObjects()
  if (props.showGrid) {
    const halfWidth = props.project.stage.width / 2
    const halfHeight = props.project.stage.height / 2
    for (let x = -halfWidth; x <= halfWidth; x += 25) line(new Vector3(x, -halfHeight, 200), new Vector3(x, halfHeight, 200), '#324454')
    for (let y = -halfHeight; y <= halfHeight; y += 25) line(new Vector3(-halfWidth, y, 200), new Vector3(halfWidth, y, 200), '#324454')
  }
  if (props.showParts) for (const entry of evaluation.value.parts) {
    const part = entry.part
    const geometry = shapeGeometry(part)
    const material = new MeshBasicMaterial({ color: part.fill, side: DoubleSide, transparent: true, opacity: entry.opacity, depthWrite: false })
    if (part.visual.type === 'texture' && part.visual.texture) {
      if (!textureCache.has(part.visual.texture)) textureCache.set(part.visual.texture, textureLoader.load(part.visual.texture, render))
      material.map = textureCache.get(part.visual.texture)
      material.color.set('#ffffff')
    }
    const mesh = new Mesh(geometry, material)
    mesh.matrixAutoUpdate = false
    mesh.matrix.copy(entry.matrix)
    mesh.renderOrder = 10 + entry.order
    addObject(mesh, 'part', part.id)
    const outline = new LineSegments(new EdgesGeometry(geometry), new LineBasicMaterial({ color: props.selectedKind === 'part' && props.selectedId === part.id ? '#8fd1ff' : part.stroke, depthTest: false }))
    outline.matrixAutoUpdate = false
    outline.matrix.copy(entry.matrix)
    outline.renderOrder = 30 + entry.order
    addObject(outline)
  }
  if (props.showBones) {
    for (const entry of evaluation.value.bones) {
      line(new Vector3(entry.x1, entry.y1, entry.z1), new Vector3(entry.x2, entry.y2, entry.z2), props.selectedKind === 'bone' && props.selectedId === entry.bone.id ? '#8fd1ff' : '#bd5b50', 'bone', entry.bone.id, 80)
    }
    for (const entry of evaluation.value.joints) {
      const sphere = new Mesh(new SphereGeometry(props.selectedKind === 'joint' && props.selectedId === entry.joint.id ? 10 : 7, 12, 8), new MeshBasicMaterial({ color: props.selectedKind === 'joint' && props.selectedId === entry.joint.id ? '#8fd1ff' : '#e2b967', depthTest: false }))
      sphere.position.copy(new Vector3().setFromMatrixPosition(entry.matrix))
      sphere.renderOrder = 100
      addObject(sphere)
      const hit = new Mesh(new SphereGeometry(17, 8, 6), new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }))
      hit.position.copy(sphere.position)
      addObject(hit, 'joint', entry.joint.id)
    }
  }
  render()
}

function screenRay(x, y) {
  const rect = host.value.getBoundingClientRect()
  raycaster.setFromCamera(new Vector2((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1), camera)
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
  if (!props.interactive) return
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
    if (target.kind !== 'bone' && !orbitMode.value) drag = { ...target, pointerId: event.pointerId, z: target.kind === 'joint' ? shadowMatrixPosition(evaluation.value.jointsById.get(target.id).matrix).z : shadowMatrixPosition(evaluation.value.parts.find((entry) => entry.part.id === target.id).matrix).z }
  }
}

function pointerMove(event) {
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
  } else if (orbitMode.value) {
    yaw += (pointer.x - oldX) * .008
    pitch = Math.max(-1.3, Math.min(1.3, pitch + (pointer.y - oldY) * .008))
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
  const pointer = activePointers.get(event.pointerId)
  if (!pointer) return
  if (!cancelled && !orbitMode.value && activePointers.size === 1 && !pointer.target && !pointer.moved && !pointer.suppressTap) emit('canvas-tap', planePoint(event.clientX, event.clientY))
  if (drag?.pointerId === event.pointerId) {
    emit('drag-end', { kind: drag.kind, id: drag.id, cancelled })
    drag = null
  }
  activePointers.delete(event.pointerId)
  if (host.value?.hasPointerCapture(event.pointerId)) host.value.releasePointerCapture(event.pointerId)
  pinch = activePointers.size > 1 ? snapshot() : null
  for (const remaining of activePointers.values()) remaining.suppressTap = true
}

watch(() => [props.project, props.animationId, props.time, props.selectedKind, props.selectedId, props.showBones, props.showGrid, props.showParts], () => {
  updateCamera()
  drawScene()
}, { deep: true })

onMounted(() => {
  renderer = new WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  host.value.appendChild(renderer.domElement)
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
  observer?.disconnect()
  host.value?.removeEventListener('pointerdown', pointerDown)
  host.value?.removeEventListener('pointermove', pointerMove)
  host.value?.removeEventListener('pointerup', pointerEnd)
  host.value?.removeEventListener('pointercancel', onPointerCancel)
  clearObjects()
  for (const texture of textureCache.values()) texture.dispose()
  renderer?.dispose()
  renderer?.domElement.remove()
})
</script>
