<template>
  <svg
    ref="svgRef"
    class="shadow-stage"
    :class="{ interactive }"
    :viewBox="viewBox"
    role="img"
    :aria-label="project.name"
    @pointerdown.prevent="onCanvasPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @lostpointercapture="onPointerCancel"
  >
    <defs>
      <pattern id="shadow-grid" width="25" height="25" patternUnits="userSpaceOnUse">
        <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(152,177,199,.16)" stroke-width="1" />
      </pattern>
      <filter id="shadow-part-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="4" dy="7" stdDeviation="5" flood-color="#02060a" flood-opacity=".42" />
      </filter>
    </defs>

    <rect
      :x="viewCenterX - viewWidth / 2" :y="viewCenterY - viewHeight / 2"
      :width="viewWidth" :height="viewHeight"
      class="shadow-stage-paper"
    />
    <rect
      v-show="showGrid"
      class="shadow-grid-layer"
      :x="-stageWidth / 2" :y="-stageHeight / 2"
      :width="stageWidth" :height="stageHeight"
      fill="url(#shadow-grid)"
    />

    <g v-if="showBones" class="shadow-bones">
      <g
        v-for="entry in evaluation.bones" :key="entry.bone.id"
        :class="{ selected: selectedKind === 'bone' && selectedId === entry.bone.id, inert: !boneInteractive }"
        @pointerdown.stop.prevent="onTargetPointerDown('bone', entry.bone.id, $event)"
      >
        <line class="shadow-bone-line" :x1="entry.x1" :y1="entry.y1" :x2="entry.x2" :y2="entry.y2" />
        <line class="shadow-bone-hit" :x1="entry.x1" :y1="entry.y1" :x2="entry.x2" :y2="entry.y2" />
      </g>
    </g>

    <g v-if="showParts">
      <g
        v-for="entry in evaluation.parts" :key="entry.part.id"
        class="shadow-part"
        :class="{ selected: selectedKind === 'part' && selectedId === entry.part.id, inert: !partInteractive }"
        :transform="matrixToSvg(entry.matrix)"
        :style="{ opacity: entry.opacity }"
        @pointerdown.stop.prevent="onTargetPointerDown('part', entry.part.id, $event)"
      >
        <image
          v-if="entry.part.visual.type === 'texture' && entry.part.visual.texture"
          :href="entry.part.visual.texture"
          :x="bounds(entry.part).x" :y="bounds(entry.part).y"
          :width="entry.part.width" :height="entry.part.height"
          :preserveAspectRatio="entry.part.visual.textureFit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'"
          draggable="false"
        />
        <template v-else>
          <ellipse
            v-if="entry.part.shape === 'circle' || entry.part.shape === 'ellipse'"
            :cx="bounds(entry.part).cx" :cy="bounds(entry.part).cy"
            :rx="entry.part.width / 2" :ry="entry.part.height / 2"
            :fill="entry.part.fill" :stroke="entry.part.stroke"
          />
          <polygon
            v-else-if="entry.part.shape === 'triangle' || entry.part.shape === 'diamond'"
            :points="polygonPoints(entry.part)"
            :fill="entry.part.fill" :stroke="entry.part.stroke"
          />
          <rect
            v-else
            :x="bounds(entry.part).x" :y="bounds(entry.part).y"
            :width="entry.part.width" :height="entry.part.height"
            :rx="entry.part.shape === 'capsule' ? Math.min(entry.part.width, entry.part.height) / 2 : 3"
            :fill="entry.part.fill" :stroke="entry.part.stroke"
          />
        </template>
        <rect
          v-if="selectedKind === 'part' && selectedId === entry.part.id"
          class="shadow-selection-box"
          :x="bounds(entry.part).x - 5" :y="bounds(entry.part).y - 5"
          :width="entry.part.width + 10" :height="entry.part.height + 10"
        />
      </g>
    </g>

    <g v-if="showBones" class="shadow-joints">
      <g
        v-for="entry in evaluation.joints" :key="entry.joint.id"
        :class="{ selected: selectedKind === 'joint' && selectedId === entry.joint.id, inert: !jointInteractive }"
        :transform="matrixToSvg(entry.matrix)"
        @pointerdown.stop.prevent="onTargetPointerDown('joint', entry.joint.id, $event)"
      >
        <circle class="shadow-joint-hit" r="18" />
        <circle class="shadow-joint" r="7" />
        <circle v-if="selectedKind === 'joint' && selectedId === entry.joint.id" class="shadow-joint-selection" r="12" />
      </g>
    </g>
  </svg>
</template>

<script setup>
import { computed, ref } from 'vue'
import { evaluateShadowProject, matrixToSvg } from '../animation/shadow-rig.js'

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
const svgRef = ref(null)
const viewCenterX = ref(0)
const viewCenterY = ref(0)
const zoom = ref(1)
const activePointers = new Map()
let drag = null
let pinch = null
const stageWidth = computed(() => props.project.stage.width)
const stageHeight = computed(() => props.project.stage.height)
const viewWidth = computed(() => stageWidth.value / zoom.value)
const viewHeight = computed(() => stageHeight.value / zoom.value)
const viewBox = computed(() => {
  return `${viewCenterX.value - viewWidth.value / 2} ${viewCenterY.value - viewHeight.value / 2} ${viewWidth.value} ${viewHeight.value}`
})
const evaluation = computed(() => evaluateShadowProject(props.project, props.animationId, props.time))

function bounds(entry) {
  const x = -entry.width * entry.pivotX
  const y = -entry.height * entry.pivotY
  return { x, y, cx: x + entry.width / 2, cy: y + entry.height / 2 }
}

function polygonPoints(entry) {
  const box = bounds(entry)
  if (entry.shape === 'diamond') {
    return `${box.cx},${box.y} ${box.x + entry.width},${box.cy} ${box.cx},${box.y + entry.height} ${box.x},${box.cy}`
  }
  return `${box.cx},${box.y} ${box.x + entry.width},${box.y + entry.height} ${box.x},${box.y + entry.height}`
}

function worldUnitsPerPixel(rect) {
  return Math.max(stageWidth.value / zoom.value / Math.max(rect.width, 1), stageHeight.value / zoom.value / Math.max(rect.height, 1))
}

function worldPoint(clientX, clientY) {
  const rect = svgRef.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  const units = worldUnitsPerPixel(rect)
  return {
    x: viewCenterX.value + (clientX - rect.left - rect.width / 2) * units,
    y: viewCenterY.value + (clientY - rect.top - rect.height / 2) * units,
  }
}

function pinchSnapshot() {
  const [first, second] = activePointers.values()
  if (!first || !second) return null
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
    distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
  }
}

function beginPointer(event, target = null) {
  if (!props.interactive || activePointers.has(event.pointerId)) return false
  const first = activePointers.size === 0
  activePointers.set(event.pointerId, {
    x: event.clientX, y: event.clientY,
    startX: event.clientX, startY: event.clientY,
    moved: false, suppressTap: false, target,
  })
  svgRef.value?.setPointerCapture?.(event.pointerId)
  if (!first) {
    if (drag) {
      emit('drag-end', { kind: drag.kind, id: drag.id, cancelled: true })
      drag = null
    }
    for (const pointer of activePointers.values()) pointer.suppressTap = true
    pinch = pinchSnapshot()
  }
  return first
}

function selectTarget(kind, id) {
  if (kind === 'bone' && !props.boneInteractive) return
  emit('select', { kind, id })
}

function onCanvasPointerDown(event) {
  beginPointer(event, 'canvas')
}

function onTargetPointerDown(kind, id, event) {
  if (kind === 'joint' && !props.jointInteractive) return
  if (kind === 'part' && !props.partInteractive) return
  if (kind === 'bone' && !props.boneInteractive) return
  if (!beginPointer(event, kind)) return
  selectTarget(kind, id)
  if (kind !== 'bone') {
    const start = worldPoint(event.clientX, event.clientY)
    drag = { kind, id, pointerId: event.pointerId, start }
  }
}

function onPointerMove(event) {
  const pointer = activePointers.get(event.pointerId)
  if (!pointer) return
  const previousX = pointer.x
  const previousY = pointer.y
  pointer.x = event.clientX
  pointer.y = event.clientY
  if (Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) > 6) pointer.moved = true
  if (activePointers.size > 1) {
    const next = pinchSnapshot()
    if (pinch && next) {
      const anchor = worldPoint(pinch.x, pinch.y)
      zoom.value = Math.min(6, Math.max(0.4, zoom.value * next.distance / pinch.distance))
      const shifted = worldPoint(next.x, next.y)
      viewCenterX.value += anchor.x - shifted.x
      viewCenterY.value += anchor.y - shifted.y
    }
    pinch = next
  } else if (drag?.pointerId === event.pointerId) {
    emit('drag', {
      kind: drag.kind,
      id: drag.id,
      start: drag.start,
      previous: worldPoint(previousX, previousY),
      current: worldPoint(pointer.x, pointer.y),
    })
  } else {
    const units = worldUnitsPerPixel(svgRef.value.getBoundingClientRect())
    viewCenterX.value -= (pointer.x - previousX) * units
    viewCenterY.value -= (pointer.y - previousY) * units
  }
}

function finishPointer(event, cancelled = false) {
  const pointer = activePointers.get(event.pointerId)
  if (!pointer) return
  if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 6) pointer.moved = true
  if (!cancelled && activePointers.size === 1 && pointer.target === 'canvas' && !pointer.moved && !pointer.suppressTap) {
    emit('canvas-tap', worldPoint(event.clientX, event.clientY))
  }
  if (drag?.pointerId === event.pointerId) {
    emit('drag-end', { kind: drag.kind, id: drag.id, cancelled })
    drag = null
  }
  activePointers.delete(event.pointerId)
  if (svgRef.value?.hasPointerCapture?.(event.pointerId)) svgRef.value.releasePointerCapture(event.pointerId)
  pinch = activePointers.size > 1 ? pinchSnapshot() : null
  for (const remaining of activePointers.values()) {
    remaining.startX = remaining.x
    remaining.startY = remaining.y
    remaining.suppressTap = true
  }
}

function onPointerUp(event) {
  finishPointer(event)
}

function onPointerCancel(event) {
  finishPointer(event, true)
}
</script>
