<template>
  <main class="anime-page anime-editor-page">
    <header class="anime-topbar">
      <div>
        <a class="anime-back" href="/" :aria-label="COPY.back">←</a>
        <div>
          <span class="anime-kicker">SHADOW PUPPET LAB</span>
          <h1>{{ COPY.editorTitle }}</h1>
        </div>
      </div>
      <div class="anime-top-actions">
        <span class="anime-save-state" :class="saveState">{{ saveLabel }}</span>
        <label class="anime-button file-button">{{ COPY.importProject }}<input type="file" accept="application/json,.json" @change="importProject"></label>
        <button type="button" class="anime-button" @click="exportProject">{{ COPY.exportProject }}</button>
        <a class="anime-button primary" href="/animepreview">{{ COPY.openPreview }}</a>
      </div>
    </header>

    <section class="anime-editor-grid">
      <aside class="anime-panel anime-library-panel">
        <div class="anime-panel-title"><span>{{ COPY.parts }}</span><button type="button" class="danger-text" @click="resetProject">{{ COPY.reset }}</button></div>
        <section class="anime-preset-library">
          <div class="anime-library-label">{{ COPY.enemyPresets }}</div>
          <button
            v-for="preset in SHADOW_PUPPET_PRESETS"
            :key="preset.id"
            type="button"
            :class="{ active: project.presetId === preset.id }"
            @click="loadPreset(preset)"
          >
            <strong>{{ preset.name }}</strong>
            <small>{{ preset.description }}</small>
          </button>
        </section>
        <div class="anime-shape-library">
          <button v-for="shape in SHADOW_SHAPES" :key="shape.id" type="button" @click="addPart(shape.id)">
            <span class="shape-swatch" :class="`shape-${shape.id}`"></span>{{ shape.label }}
          </button>
        </div>
        <div class="anime-layer-list">
          <button
            v-for="entry in orderedParts" :key="entry.id" type="button"
            :class="{ selected: entry.id === selectedPartId }"
            @click="selectedPartId = entry.id"
          >
            <span class="layer-indent" :style="{ width: `${partDepth(entry.id) * 12}px` }"></span>
            <i :class="`shape-${entry.shape}`"></i><span>{{ entry.name }}</span><small>{{ entry.parentId ? COPY.child : COPY.root }}</small>
          </button>
        </div>
        <div class="anime-layer-actions">
          <button type="button" :disabled="!selectedPart" @click="duplicateSelected">{{ COPY.duplicate }}</button>
          <button type="button" :disabled="!selectedPart || project.parts.length <= 1" @click="deleteSelected">{{ COPY.deletePart }}</button>
        </div>
      </aside>

      <section class="anime-workspace">
        <div class="anime-modebar">
          <div class="segmented-control">
            <button type="button" :class="{ active: mode === 'rig' }" @click="setMode('rig')">{{ COPY.rigMode }}</button>
            <button type="button" :class="{ active: mode === 'animate' }" @click="setMode('animate')">{{ COPY.animateMode }}</button>
          </div>
          <label><input v-model="showBones" type="checkbox"> {{ COPY.showBones }}</label>
          <label><input v-model="showGrid" type="checkbox"> {{ COPY.showGrid }}</label>
          <span class="anime-mode-hint">{{ mode === 'rig' ? COPY.rigHint : COPY.animateHint }}</span>
        </div>

        <div class="anime-stage-wrap">
          <ShadowPuppetStage
            :project="project"
            :animation-id="mode === 'animate' ? animationId : null"
            :time="time"
            :selected-part-id="selectedPartId"
            :show-bones="showBones"
            :show-grid="showGrid"
            interactive
            @select="selectedPartId = $event"
            @drag="onStageDrag"
          />
        </div>

        <section class="anime-timeline">
          <div class="anime-animation-tabs">
            <button
              v-for="type in SHADOW_ANIMATION_TYPES" :key="type.id" type="button"
              :class="{ active: animationId === type.id }"
              @click="selectAnimation(type.id)"
            >
              {{ type.label }}
            </button>
          </div>
          <div class="anime-playback-row">
            <button type="button" class="anime-play-button" @click="togglePlayback">{{ playing ? COPY.pause : COPY.play }}</button>
            <button type="button" @click="time = 0">{{ COPY.rewind }}</button>
            <span>{{ Math.round(time) }} / {{ currentAnimation.duration }} ms</span>
            <label>{{ COPY.duration }} <input :value="currentAnimation.duration" type="number" min="100" step="10" @change="setDuration($event.target.value)"></label>
            <label><input v-model="currentAnimation.loop" type="checkbox"> {{ COPY.loop }}</label>
          </div>
          <div class="anime-scrubber">
            <input v-model.number="time" type="range" min="0" :max="currentAnimation.duration" step="1">
            <div class="anime-key-markers">
              <button
                v-for="keyframe in selectedKeys" :key="keyframe.time" type="button"
                :style="{ left: `${keyframe.time / currentAnimation.duration * 100}%` }"
                :title="`${keyframe.time} ms`"
                @click="time = keyframe.time"
              ></button>
            </div>
          </div>
          <div class="anime-key-actions">
            <span>{{ selectedPart ? `${selectedPart.name} · ${selectedKeys.length} ${COPY.keys}` : COPY.selectPart }}</span>
            <button type="button" :disabled="!selectedPart" @click="recordCurrentKey">{{ COPY.recordKey }}</button>
            <button type="button" :disabled="!hasCurrentKey" @click="deleteCurrentKey">{{ COPY.deleteKey }}</button>
          </div>
        </section>
      </section>

      <aside class="anime-panel anime-inspector">
        <div class="anime-panel-title"><span>{{ mode === 'rig' ? COPY.rigInspector : COPY.poseInspector }}</span></div>
        <template v-if="selectedPart">
          <template v-if="mode === 'rig'">
            <label class="field-wide"><span>{{ COPY.name }}</span><input :value="selectedPart.name" @input="setPartText('name', $event.target.value)"></label>
            <div class="field-grid">
              <label><span>{{ COPY.shape }}</span><select :value="selectedPart.shape" @change="setPartText('shape', $event.target.value)"><option v-for="shape in SHADOW_SHAPES" :key="shape.id" :value="shape.id">{{ shape.label }}</option></select></label>
              <label><span>{{ COPY.parentBone }}</span><select :value="selectedPart.parentId || ''" @change="setParent($event.target.value)"><option value="">{{ COPY.noParent }}</option><option v-for="entry in parentOptions" :key="entry.id" :value="entry.id">{{ entry.name }}</option></select></label>
              <label><span>X</span><input :value="round(selectedPart.x)" type="number" @input="setPartNumber('x', $event.target.value)"></label>
              <label><span>Y</span><input :value="round(selectedPart.y)" type="number" @input="setPartNumber('y', $event.target.value)"></label>
              <label><span>{{ COPY.width }}</span><input :value="round(selectedPart.width)" type="number" min="4" @input="setPartNumber('width', $event.target.value, 4)"></label>
              <label><span>{{ COPY.height }}</span><input :value="round(selectedPart.height)" type="number" min="4" @input="setPartNumber('height', $event.target.value, 4)"></label>
              <label><span>{{ COPY.rotation }}</span><input :value="round(selectedPart.rotation)" type="number" @input="setPartNumber('rotation', $event.target.value)"></label>
              <label><span>{{ COPY.layer }}</span><input :value="selectedPart.z" type="number" @input="setPartNumber('z', $event.target.value)"></label>
              <label><span>{{ COPY.pivotX }}</span><input :value="selectedPart.pivotX" type="number" min="0" max="1" step=".05" @input="setPartNumber('pivotX', $event.target.value, 0, 1)"></label>
              <label><span>{{ COPY.pivotY }}</span><input :value="selectedPart.pivotY" type="number" min="0" max="1" step=".05" @input="setPartNumber('pivotY', $event.target.value, 0, 1)"></label>
              <label><span>{{ COPY.fill }}</span><input :value="selectedPart.fill" type="color" @input="setPartText('fill', $event.target.value)"></label>
              <label><span>{{ COPY.stroke }}</span><input :value="selectedPart.stroke" type="color" @input="setPartText('stroke', $event.target.value)"></label>
              <label class="field-wide"><span>{{ COPY.opacity }}</span><input :value="selectedPart.opacity" type="range" min="0" max="1" step=".01" @input="setPartNumber('opacity', $event.target.value, 0, 1)"></label>
            </div>
            <section class="anime-texture-panel">
              <div><strong>{{ COPY.partTexture }}</strong><small>{{ selectedPart.texture ? COPY.textureReady : COPY.primitiveFallback }}</small></div>
              <label class="anime-button file-button">{{ COPY.chooseTexture }}<input type="file" accept="image/png,image/jpeg,image/webp" @change="setPartTexture"></label>
              <button v-if="selectedPart.texture" type="button" @click="removePartTexture">{{ COPY.removeTexture }}</button>
              <label v-if="selectedPart.texture"><span>{{ COPY.textureFit }}</span><select v-model="selectedPart.textureFit"><option value="contain">contain</option><option value="cover">cover</option></select></label>
            </section>
          </template>

          <template v-else>
            <div class="anime-pose-summary"><strong>{{ selectedPart.name }}</strong><span>{{ COPY.relativePose }}</span></div>
            <div class="field-grid">
              <label><span>ΔX</span><input :value="round(selectedPose.dx)" type="number" @input="setPoseNumber('dx', $event.target.value)"></label>
              <label><span>ΔY</span><input :value="round(selectedPose.dy)" type="number" @input="setPoseNumber('dy', $event.target.value)"></label>
              <label class="field-wide"><span>{{ COPY.rotation }}</span><input :value="round(selectedPose.rotation)" type="range" min="-180" max="180" step="1" @input="setPoseNumber('rotation', $event.target.value)"><output>{{ round(selectedPose.rotation) }}°</output></label>
              <label><span>Scale X</span><input :value="selectedPose.scaleX.toFixed(2)" type="number" min=".05" max="4" step=".05" @input="setPoseNumber('scaleX', $event.target.value, .05, 4)"></label>
              <label><span>Scale Y</span><input :value="selectedPose.scaleY.toFixed(2)" type="number" min=".05" max="4" step=".05" @input="setPoseNumber('scaleY', $event.target.value, .05, 4)"></label>
              <label class="field-wide"><span>{{ COPY.opacity }}</span><input :value="selectedPose.opacity" type="range" min="0" max="1" step=".01" @input="setPoseNumber('opacity', $event.target.value, 0, 1)"><output>{{ selectedPose.opacity.toFixed(2) }}</output></label>
            </div>
            <p class="anime-inspector-note">{{ COPY.poseHint }}</p>
            <button type="button" class="anime-button wide" @click="resetCurrentPose">{{ COPY.resetPose }}</button>
          </template>
        </template>
        <p v-else class="anime-empty-note">{{ COPY.selectPart }}</p>
      </aside>
    </section>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  SHADOW_ANIMATION_TYPES,
  SHADOW_PUPPET_PRESETS,
  SHADOW_SHAPES,
  createShadowPreset,
  defaultShadowPose,
  evaluateShadowProject,
  inverseShadowVector,
  loadShadowProject,
  normalizeShadowProject,
  removeShadowKeyframe,
  resetShadowProject,
  sampleShadowTrack,
  saveShadowProject,
  upsertShadowKeyframe,
} from '../animation/shadow-puppet.js'
import ShadowPuppetStage from './ShadowPuppetStage.vue'
import '../anime.css'

const COPY = Object.freeze({
  back: '\u8fd4\u56de\u6e38\u620f', editorTitle: '\u654c\u4eba\u76ae\u5f71\u52a8\u753b\u7f16\u8f91\u5668', importProject: '\u5bfc\u5165', exportProject: '\u5bfc\u51fa', openPreview: '\u6253\u5f00\u9884\u89c8',
  parts: '\u90e8\u4ef6\u4e0e\u9aa8\u9abc', reset: '\u91cd\u7f6e\u793a\u4f8b', duplicate: '\u590d\u5236', deletePart: '\u5220\u9664', root: '\u6839\u90e8\u4ef6', child: '\u5df2\u7ed1\u5b9a',
  enemyPresets: '\u654c\u4eba\u793a\u4f8b', presetConfirm: '\u52a0\u8f7d\u201c{name}\u201d\u4f1a\u8986\u76d6\u5f53\u524d\u76ae\u5f71\u548c\u5168\u90e8\u52a8\u753b\uff0c\u662f\u5426\u7ee7\u7eed\uff1f',
  rigMode: '\u9aa8\u67b6\u6a21\u5f0f', animateMode: '\u52a8\u753b\u6a21\u5f0f', showBones: '\u663e\u793a\u9aa8\u9abc', showGrid: '\u663e\u793a\u7f51\u683c',
  rigHint: '\u62d6\u52a8\u90e8\u4ef6\u5e03\u7f6e\u9759\u6001\u9aa8\u67b6', animateHint: '\u62d6\u52a8\u90e8\u4ef6\u4f1a\u5728\u5f53\u524d\u65f6\u523b\u81ea\u52a8\u8bb0\u5f55\u5173\u952e\u5e27',
  play: '\u64ad\u653e', pause: '\u6682\u505c', rewind: '\u56de\u5230\u8d77\u70b9', duration: '\u65f6\u957f', loop: '\u5faa\u73af', keys: '\u4e2a\u5173\u952e\u5e27', selectPart: '\u8bf7\u9009\u62e9\u4e00\u4e2a\u90e8\u4ef6', recordKey: '\u8bb0\u5f55\u5173\u952e\u5e27', deleteKey: '\u5220\u9664\u5f53\u524d\u5e27',
  rigInspector: '\u90e8\u4ef6\u5c5e\u6027', poseInspector: '\u5173\u952e\u5e27\u59ff\u6001', name: '\u540d\u79f0', shape: '\u5f62\u72b6', parentBone: '\u7236\u9aa8\u9abc', noParent: '\u65e0\uff08\u6839\u90e8\u4ef6\uff09', width: '\u5bbd\u5ea6', height: '\u9ad8\u5ea6', rotation: '\u65cb\u8f6c', layer: '\u5c42\u7ea7', pivotX: '\u8f74\u5fc3 X', pivotY: '\u8f74\u5fc3 Y', fill: '\u586b\u8272', stroke: '\u8f6e\u5ed3', opacity: '\u900f\u660e\u5ea6',
  partTexture: '\u90e8\u4ef6\u8d34\u56fe', textureReady: '\u5df2\u4f7f\u7528\u72ec\u7acb\u8d34\u56fe', primitiveFallback: '\u5f53\u524d\u4f7f\u7528\u51e0\u4f55\u5f62\u72b6', chooseTexture: '\u9009\u62e9\u56fe\u7247', removeTexture: '\u6062\u590d\u51e0\u4f55\u5f62\u72b6', textureFit: '\u8d34\u56fe\u9002\u914d',
  relativePose: '\u76f8\u5bf9\u9759\u6001\u9aa8\u67b6\u7684\u53d8\u6362', poseHint: '\u8c03\u6574\u6570\u503c\u6216\u5728\u753b\u5e03\u4e0a\u62d6\u52a8\u65f6\uff0c\u5f53\u524d\u65f6\u523b\u4f1a\u81ea\u52a8\u5199\u5165\u5173\u952e\u5e27\u3002', resetPose: '\u5f53\u524d\u59ff\u6001\u5f52\u96f6',
  saved: '\u5df2\u4fdd\u5b58', saving: '\u4fdd\u5b58\u4e2d', saveError: '\u4fdd\u5b58\u5931\u8d25', resetConfirm: '\u91cd\u7f6e\u4f1a\u8986\u76d6\u5f53\u524d\u76ae\u5f71\u548c\u5168\u90e8\u52a8\u753b\uff0c\u662f\u5426\u7ee7\u7eed\uff1f', importError: '\u65e0\u6cd5\u8bfb\u53d6\u8fd9\u4e2a\u52a8\u753b\u5de5\u7a0b\u6587\u4ef6\u3002',
})

const project = ref(loadShadowProject())
const selectedPartId = ref(project.value.parts[0]?.id || null)
const mode = ref('rig')
const animationId = ref('idle')
const time = ref(0)
const playing = ref(false)
const showBones = ref(true)
const showGrid = ref(true)
const saveState = ref('saved')
let saveTimer = null
let animationFrame = 0
let lastFrameTime = 0

const selectedPart = computed(() => project.value.parts.find((entry) => entry.id === selectedPartId.value) || null)
const currentAnimation = computed(() => project.value.animations[animationId.value])
const orderedParts = computed(() => [...project.value.parts].sort((a, b) => b.z - a.z || a.name.localeCompare(b.name)))
const selectedPose = computed(() => selectedPart.value
  ? sampleShadowTrack(currentAnimation.value, selectedPart.value.id, time.value)
  : defaultShadowPose())
const selectedKeys = computed(() => selectedPart.value ? (currentAnimation.value.tracks[selectedPart.value.id] || []) : [])
const hasCurrentKey = computed(() => selectedKeys.value.some((entry) => Math.abs(entry.time - time.value) <= 8))
const parentOptions = computed(() => {
  if (!selectedPart.value) return []
  const blocked = new Set([selectedPart.value.id])
  let changed = true
  while (changed) {
    changed = false
    for (const entry of project.value.parts) {
      if (entry.parentId && blocked.has(entry.parentId) && !blocked.has(entry.id)) {
        blocked.add(entry.id)
        changed = true
      }
    }
  }
  return project.value.parts.filter((entry) => !blocked.has(entry.id))
})
const saveLabel = computed(() => ({ saved: COPY.saved, saving: COPY.saving, error: COPY.saveError }[saveState.value]))

watch(project, () => {
  saveState.value = 'saving'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      saveShadowProject(project.value)
      saveState.value = 'saved'
    } catch {
      saveState.value = 'error'
    }
  }, 140)
}, { deep: true })

watch(() => currentAnimation.value.duration, (duration) => {
  if (time.value > duration) time.value = duration
})

function round(value) {
  return Math.round(Number(value) * 100) / 100
}

function setMode(nextMode) {
  mode.value = nextMode
  playing.value = false
}

function uniquePartId(prefix) {
  let index = 1
  let candidate = `${prefix}-${index}`
  const ids = new Set(project.value.parts.map((entry) => entry.id))
  while (ids.has(candidate)) candidate = `${prefix}-${index += 1}`
  return candidate
}

function addPart(shape) {
  const definition = SHADOW_SHAPES.find((entry) => entry.id === shape)
  const id = uniquePartId(shape)
  const parent = selectedPart.value
  project.value.parts.push({
    id,
    name: `${definition?.label || shape} ${project.value.parts.length + 1}`,
    shape,
    parentId: parent?.id || null,
    x: parent ? 0 : 0,
    y: parent ? 0 : 0,
    width: shape === 'rect' || shape === 'capsule' ? 48 : 76,
    height: shape === 'rect' || shape === 'capsule' ? 110 : 76,
    rotation: 0,
    pivotX: 0.5,
    pivotY: shape === 'rect' || shape === 'capsule' ? 0.08 : 0.5,
    fill: '#241614',
    stroke: '#a94735',
    opacity: 1,
    texture: null,
    textureFit: 'contain',
    z: Math.max(...project.value.parts.map((entry) => entry.z), 0) + 1,
  })
  selectedPartId.value = id
}

function duplicateSelected() {
  if (!selectedPart.value) return
  const copy = JSON.parse(JSON.stringify(selectedPart.value))
  copy.id = uniquePartId(selectedPart.value.shape)
  copy.name = `${selectedPart.value.name} Copy`
  copy.x += 18
  copy.y += 18
  copy.z += 1
  project.value.parts.push(copy)
  for (const entry of Object.values(project.value.animations)) {
    if (entry.tracks[selectedPart.value.id]) entry.tracks[copy.id] = JSON.parse(JSON.stringify(entry.tracks[selectedPart.value.id]))
  }
  selectedPartId.value = copy.id
}

function deleteSelected() {
  if (!selectedPart.value || project.value.parts.length <= 1) return
  const deletedId = selectedPart.value.id
  const world = new Map(evaluateShadowProject(project.value).map((entry) => [entry.part.id, entry.matrix]))
  for (const entry of project.value.parts) {
    if (entry.parentId !== deletedId) continue
    const matrix = world.get(entry.id)
    entry.parentId = null
    entry.x = matrix?.e || entry.x
    entry.y = matrix?.f || entry.y
  }
  project.value.parts = project.value.parts.filter((entry) => entry.id !== deletedId)
  for (const entry of Object.values(project.value.animations)) delete entry.tracks[deletedId]
  selectedPartId.value = project.value.parts[0]?.id || null
}

function partDepth(partId) {
  const byId = new Map(project.value.parts.map((entry) => [entry.id, entry]))
  let depth = 0
  let current = byId.get(partId)
  const visited = new Set()
  while (current?.parentId && !visited.has(current.parentId)) {
    visited.add(current.parentId)
    depth += 1
    current = byId.get(current.parentId)
  }
  return depth
}

function setPartText(field, value) {
  if (selectedPart.value) selectedPart.value[field] = value
}

function setPartNumber(field, value, minimum = null, maximum = null) {
  if (!selectedPart.value) return
  let next = Number(value)
  if (!Number.isFinite(next)) return
  if (minimum !== null) next = Math.max(minimum, next)
  if (maximum !== null) next = Math.min(maximum, next)
  selectedPart.value[field] = next
}

function setParent(parentId) {
  if (selectedPart.value) selectedPart.value.parentId = parentId || null
}

function selectAnimation(id) {
  animationId.value = id
  time.value = 0
  playing.value = false
  mode.value = 'animate'
}

function setDuration(value) {
  const duration = Math.max(100, Number(value) || 100)
  currentAnimation.value.duration = duration
  for (const keys of Object.values(currentAnimation.value.tracks)) {
    for (const entry of keys) entry.time = Math.min(duration, entry.time)
    keys.sort((a, b) => a.time - b.time)
  }
}

function recordCurrentKey() {
  if (!selectedPart.value) return
  upsertShadowKeyframe(project.value, animationId.value, selectedPart.value.id, time.value, selectedPose.value)
}

function deleteCurrentKey() {
  if (!selectedPart.value) return
  removeShadowKeyframe(project.value, animationId.value, selectedPart.value.id, time.value)
}

function setPoseNumber(field, value, minimum = null, maximum = null) {
  if (!selectedPart.value) return
  let next = Number(value)
  if (!Number.isFinite(next)) return
  if (minimum !== null) next = Math.max(minimum, next)
  if (maximum !== null) next = Math.min(maximum, next)
  const pose = { ...selectedPose.value, [field]: next }
  upsertShadowKeyframe(project.value, animationId.value, selectedPart.value.id, time.value, pose)
}

function resetCurrentPose() {
  if (!selectedPart.value) return
  upsertShadowKeyframe(project.value, animationId.value, selectedPart.value.id, time.value, defaultShadowPose())
}

function onStageDrag({ partId, previous, current }) {
  selectedPartId.value = partId
  const entry = project.value.parts.find((candidate) => candidate.id === partId)
  if (!entry) return
  const evaluation = evaluateShadowProject(project.value, mode.value === 'animate' ? animationId.value : null, time.value)
  const byId = new Map(evaluation.map((candidate) => [candidate.part.id, candidate]))
  const parentMatrix = entry.parentId ? byId.get(entry.parentId)?.matrix : { a: 1, b: 0, c: 0, d: 1 }
  const localDelta = inverseShadowVector(parentMatrix, current.x - previous.x, current.y - previous.y)
  if (mode.value === 'rig') {
    entry.x += localDelta.x
    entry.y += localDelta.y
  } else {
    const pose = sampleShadowTrack(currentAnimation.value, partId, time.value)
    pose.dx += localDelta.x
    pose.dy += localDelta.y
    upsertShadowKeyframe(project.value, animationId.value, partId, time.value, pose)
  }
}

function togglePlayback() {
  if (!playing.value && time.value >= currentAnimation.value.duration) time.value = 0
  playing.value = !playing.value
  lastFrameTime = window.performance.now()
}

function frame(timestamp) {
  if (playing.value) {
    const delta = Math.min(64, timestamp - lastFrameTime)
    const duration = currentAnimation.value.duration
    const next = time.value + delta
    if (next >= duration) {
      if (currentAnimation.value.loop) time.value = next % duration
      else {
        time.value = duration
        playing.value = false
      }
    } else time.value = next
  }
  lastFrameTime = timestamp
  animationFrame = window.requestAnimationFrame(frame)
}

function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new window.FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', reject)
    reader.readAsDataURL(file)
  })
}

async function setPartTexture(event) {
  const file = event.target.files?.[0]
  if (!file || !selectedPart.value) return
  selectedPart.value.texture = await fileAsDataUrl(file)
  event.target.value = ''
}

function removePartTexture() {
  if (selectedPart.value) selectedPart.value.texture = null
}

function exportProject() {
  const anchor = document.createElement('a')
  anchor.href = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(project.value, null, 2))}`
  anchor.download = `${project.value.name || 'shadow-puppet'}.json`
  anchor.click()
}

async function importProject(event) {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    project.value = normalizeShadowProject(JSON.parse(await file.text()))
    selectedPartId.value = project.value.parts[0]?.id || null
    time.value = 0
  } catch {
    window.alert(COPY.importError)
  }
  event.target.value = ''
}

function resetProject() {
  if (!window.confirm(COPY.resetConfirm)) return
  project.value = resetShadowProject()
  selectedPartId.value = project.value.parts[0]?.id || null
  animationId.value = 'idle'
  time.value = 0
  playing.value = false
}

function loadPreset(preset) {
  const message = COPY.presetConfirm.replace('{name}', preset.name)
  if (!window.confirm(message)) return
  project.value = createShadowPreset(preset.id)
  selectedPartId.value = project.value.parts[0]?.id || null
  mode.value = 'rig'
  animationId.value = 'idle'
  time.value = 0
  playing.value = false
}

onMounted(() => {
  document.documentElement.classList.add('anime-html')
  document.body.classList.add('anime-body')
  lastFrameTime = window.performance.now()
  animationFrame = window.requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  document.documentElement.classList.remove('anime-html')
  document.body.classList.remove('anime-body')
  window.cancelAnimationFrame(animationFrame)
  clearTimeout(saveTimer)
  try { saveShadowProject(project.value) } catch { /* Keep the in-memory editor usable if storage is full. */ }
})
</script>
