<template>
  <svg
    ref="svgRef"
    class="shadow-stage"
    :class="{ interactive }"
    :viewBox="viewBox"
    role="img"
    :aria-label="project.name"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @pointerleave="onPointerLeave"
  >
    <defs>
      <pattern id="shadow-grid" width="25" height="25" patternUnits="userSpaceOnUse">
        <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(72,45,34,.12)" stroke-width="1" />
      </pattern>
      <filter id="shadow-paper-noise" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="7" result="noise" />
        <feColorMatrix in="noise" type="saturate" values="0" result="gray" />
        <feBlend in="SourceGraphic" in2="gray" mode="multiply" />
      </filter>
      <filter id="shadow-part-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="4" dy="7" stdDeviation="5" flood-color="#24150f" flood-opacity=".34" />
      </filter>
    </defs>

    <rect :x="-stageWidth / 2" :y="-stageHeight / 2" :width="stageWidth" :height="stageHeight" class="shadow-stage-paper" />
    <rect v-if="showGrid" :x="-stageWidth / 2" :y="-stageHeight / 2" :width="stageWidth" :height="stageHeight" fill="url(#shadow-grid)" />
    <g v-if="showBones" class="shadow-bones">
      <line
        v-for="bone in bones" :key="bone.id"
        :x1="bone.x1" :y1="bone.y1" :x2="bone.x2" :y2="bone.y2"
      />
    </g>

    <g
      v-for="entry in entries" :key="entry.part.id"
      class="shadow-part"
      :class="{ selected: entry.part.id === selectedPartId, textured: !!entry.part.texture }"
      :transform="matrixToSvg(entry.matrix)"
      :style="{ opacity: entry.part.opacity * entry.pose.opacity }"
      @pointerdown.stop.prevent="onPartPointerDown(entry.part.id, $event)"
    >
      <image
        v-if="entry.part.texture"
        :href="entry.part.texture"
        :x="bounds(entry.part).x" :y="bounds(entry.part).y"
        :width="entry.part.width" :height="entry.part.height"
        :preserveAspectRatio="entry.part.textureFit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'"
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
        v-if="entry.part.id === selectedPartId"
        class="shadow-selection-box"
        :x="bounds(entry.part).x - 5" :y="bounds(entry.part).y - 5"
        :width="entry.part.width + 10" :height="entry.part.height + 10"
      />
      <circle v-if="showBones" class="shadow-joint" r="7" />
    </g>
  </svg>
</template>

<script setup>
import { computed, ref } from 'vue'
import { evaluateShadowProject, matrixToSvg } from '../animation/shadow-puppet.js'

const props = defineProps({
  project: { type: Object, required: true },
  animationId: { type: String, default: null },
  time: { type: Number, default: 0 },
  selectedPartId: { type: String, default: null },
  showBones: { type: Boolean, default: true },
  showGrid: { type: Boolean, default: true },
  interactive: { type: Boolean, default: false },
})

const emit = defineEmits(['select', 'drag', 'drag-end'])
const svgRef = ref(null)
const drag = ref(null)
const stageWidth = computed(() => props.project.stage.width)
const stageHeight = computed(() => props.project.stage.height)
const viewBox = computed(() => `${-stageWidth.value / 2} ${-stageHeight.value / 2} ${stageWidth.value} ${stageHeight.value}`)
const entries = computed(() => evaluateShadowProject(props.project, props.animationId, props.time))
const entriesById = computed(() => new Map(entries.value.map((entry) => [entry.part.id, entry])))
const bones = computed(() => entries.value.flatMap((entry) => {
  const parent = entry.part.parentId ? entriesById.value.get(entry.part.parentId) : null
  if (!parent) return []
  return [{ id: entry.part.id, x1: parent.matrix.e, y1: parent.matrix.f, x2: entry.matrix.e, y2: entry.matrix.f }]
}))

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

function pointerPoint(event) {
  const svg = svgRef.value
  if (!svg) return { x: 0, y: 0 }
  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  const matrix = svg.getScreenCTM()?.inverse()
  return matrix ? point.matrixTransform(matrix) : { x: 0, y: 0 }
}

function onPartPointerDown(partId, event) {
  emit('select', partId)
  if (!props.interactive) return
  const start = pointerPoint(event)
  drag.value = { partId, pointerId: event.pointerId, start, previous: start }
  svgRef.value?.setPointerCapture?.(event.pointerId)
}

function onPointerMove(event) {
  if (!drag.value || drag.value.pointerId !== event.pointerId) return
  const current = pointerPoint(event)
  emit('drag', {
    partId: drag.value.partId,
    start: drag.value.start,
    previous: drag.value.previous,
    current,
  })
  drag.value.previous = current
}

function finishDrag(event, cancelled = false) {
  if (!drag.value || drag.value.pointerId !== event.pointerId) return
  const finished = drag.value
  drag.value = null
  svgRef.value?.releasePointerCapture?.(event.pointerId)
  emit('drag-end', { partId: finished.partId, cancelled })
}

function onPointerUp(event) {
  finishDrag(event)
}

function onPointerCancel(event) {
  finishDrag(event, true)
}

function onPointerLeave(event) {
  if (event.buttons === 0) finishDrag(event)
}
</script>
