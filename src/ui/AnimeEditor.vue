<template>
  <main class="anime-page anime-editor-page" @focusin="beginInputHistory" @focusout="endInputHistory">
    <header class="anime-topbar anime-editor-topbar">
      <a class="anime-back" href="/" :aria-label="COPY.back">←</a>
      <div class="anime-character-controls">
        <select class="anime-character-select" :value="activeCharacterId" :aria-label="COPY.character" @change="activateCharacter($event.target.value)">
          <option v-for="character in roster.characters" :key="character.id" :value="character.id">{{ character.project.name }}</option>
        </select>
        <button class="anime-icon-button" type="button" :aria-label="COPY.characterName" :title="COPY.characterName" @click="renameCharacter">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l11-11-4-4L4 16v4Zm9-13 4 4" /></svg>
        </button>
        <button class="anime-icon-button" type="button" :aria-label="COPY.add" :title="COPY.add" @click="addBlankCharacter">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M4 12h16" /></svg>
        </button>
        <button class="anime-icon-button" type="button" :aria-label="COPY.duplicate" :title="COPY.duplicate" @click="duplicateCharacter">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="1" /><path d="M16 8V4H4v12h4" /></svg>
        </button>
        <button class="anime-icon-button" type="button" :aria-label="COPY.deleteCharacter" :title="COPY.deleteCharacter" @click="deleteCharacter">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v6m4-6v6" /></svg>
        </button>
      </div>
      <button class="anime-icon-button" type="button" :disabled="!undoCount" :aria-label="COPY.undo" :title="COPY.undo" @click="undoEdit">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6 4 11l5 5M4 11h11a5 5 0 0 1 0 10" /></svg>
      </button>
    </header>

    <nav class="anime-editor-menu" :aria-label="COPY.editorMode">
      <button type="button" :class="{ active: editorMode === 'skeleton' }" @click="setEditorMode('skeleton')">{{ COPY.skeleton }}</button>
      <button type="button" :class="{ active: editorMode === 'parts' }" @click="setEditorMode('parts')">{{ COPY.parts }}</button>
      <button type="button" :class="{ active: editorMode === 'animation' }" @click="setEditorMode('animation')">{{ COPY.animation }}</button>
    </nav>

    <section class="rig-editor-workspace">
      <div class="anime-stage-wrap">
        <div v-if="!stage3D" class="rig-stage-options">
          <label><input v-model="showBones" type="checkbox">{{ COPY.bones }}</label>
          <label><input v-model="showMesh" type="checkbox">{{ COPY.grid }}</label>
        </div>
        <ShadowPuppetStage
          :project="project"
          :animation-id="editorMode === 'animation' ? animationId : null"
          :time="time"
          :selected-kind="selectedKind"
          :selected-id="selectedId"
          :show-bones="showBones"
          :show-grid="showMesh"
          :show-parts="showMesh"
          :hidden-part-ids="hiddenPartIds"
          :joint-interactive="editorMode !== 'parts'"
          :bone-interactive="editorMode === 'skeleton'"
          :part-interactive="editorMode !== 'skeleton'"
          interactive
          @select="onStageSelect"
          @canvas-tap="onCanvasTap"
          @drag="onStageDrag"
          @drag-end="endStageDrag"
          @view-mode-change="stage3D = $event"
        />
      </div>

      <section v-if="editorMode === 'skeleton'" class="rig-context-panel skeleton-context-panel">
        <div class="rig-tool-row">
          <button type="button" :class="{ active: skeletonTool === 'select' }" @click="setSkeletonTool('select')">{{ COPY.select }}</button>
          <button type="button" :class="{ active: skeletonTool === 'add-joint' }" @click="setSkeletonTool('add-joint')">{{ COPY.addJoint }}</button>
          <button type="button" :class="{ active: skeletonTool === 'connect' }" @click="setSkeletonTool('connect')">{{ COPY.connect }}</button>
          <button type="button" :disabled="selectedKind !== 'joint' && selectedKind !== 'bone'" @click="deleteSelectedSkeleton">{{ COPY.deleteSelected }}</button>
        </div>
        <div v-if="skeletonStatus" class="rig-context-status">{{ skeletonStatus }}</div>
        <div v-if="selectedJoint" class="rig-field-strip rig-joint-field-strip">
          <label class="rig-joint-name"><span>{{ COPY.name }}</span><input :value="selectedJoint.name" @input="selectedJoint.name = $event.target.value"></label>
          <label><span>X</span><input :value="round(selectedJoint.x)" type="number" @input="setRestNumber(selectedJoint, 'x', $event.target.value)"></label>
          <label><span>Y</span><input :value="round(selectedJoint.y)" type="number" @input="setRestNumber(selectedJoint, 'y', $event.target.value)"></label>
          <label><span>Z</span><input :value="round(selectedJoint.z)" type="number" @input="setRestNumber(selectedJoint, 'z', $event.target.value)"></label>
          <label v-for="axis in ['X', 'Y', 'Z']" :key="axis"><span>R{{ axis }}</span><input :value="round(selectedJoint[`rotation${axis}`])" type="number" @input="setRestNumber(selectedJoint, `rotation${axis}`, $event.target.value)"></label>
        </div>
        <div v-else-if="selectedBone" class="rig-field-strip rig-bone-field-strip">
          <label class="field-grow"><span>{{ COPY.name }}</span><input :value="selectedBone.name" @input="selectedBone.name = $event.target.value"></label>
          <span class="rig-bone-connection">{{ jointName(selectedBone.fromJointId) }} → {{ jointName(selectedBone.toJointId) }}</span>
        </div>
      </section>

      <section v-else-if="editorMode === 'parts'" class="rig-context-panel parts-context-panel">
        <div class="rig-shape-row">
          <button
            v-for="shape in SHADOW_SHAPES" :key="shape.id" type="button"
            :class="{ active: pendingShape === shape.id }"
            @click="pendingShape = pendingShape === shape.id ? null : shape.id"
          >
            {{ shape.label }}
          </button>
        </div>
        <div class="rig-part-select-row">
          <select :value="selectedKind === 'part' ? selectedId : ''" @change="selectPart($event.target.value)">
            <option value="">{{ COPY.selectPart }}</option>
            <option v-for="part in orderedParts" :key="part.id" :value="part.id">{{ part.name }}</option>
          </select>
          <button class="anime-icon-button" type="button" :disabled="!selectedPart" :aria-label="COPY.partName" :title="COPY.partName" @click="renameSelectedPart">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l11-11-4-4L4 16v4Zm9-13 4 4" /></svg>
          </button>
          <button class="anime-icon-button" type="button" :disabled="!selectedPart" :aria-label="COPY.duplicate" :title="COPY.duplicate" @click="duplicateSelectedPart">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="1" /><path d="M16 8V4H4v12h4" /></svg>
          </button>
          <button class="anime-icon-button" :class="{ active: selectedPartHidden }" type="button" :disabled="!selectedPart" :aria-label="selectedPartHidden ? COPY.showPart : COPY.hidePart" :title="selectedPartHidden ? COPY.showPart : COPY.hidePart" @click="toggleSelectedPartHidden">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c2.5-4 5.8-6 10-6s7.5 2 10 6c-2.5 4-5.8 6-10 6s-7.5-2-10-6Z" /><circle cx="12" cy="12" r="3" /><path v-if="selectedPartHidden" d="M3 21 21 3" /></svg>
          </button>
          <button class="anime-icon-button" type="button" :disabled="!selectedPart" :aria-label="COPY.deleteSelected" :title="COPY.deleteSelected" @click="deleteSelectedPart">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v6m4-6v6" /></svg>
          </button>
        </div>
        <div v-if="selectedPart" class="rig-part-fields">
          <div class="rig-axis-tabs"><button v-for="mode in ['size', 'position', 'rotation']" :key="mode" type="button" :class="{ active: partFieldMode === mode }" @click="partFieldMode = mode">{{ COPY[mode] }}</button></div>
          <div class="rig-part-field-row">
            <label><span>{{ COPY.bind }}</span><select :value="selectedPart.attachment.type" @change="setAttachmentType($event.target.value)"><option value="free">{{ COPY.free }}</option><option value="joint">{{ COPY.joint }}</option><option value="bone">{{ COPY.bone }}</option></select></label>
            <label v-if="selectedPart.attachment.type !== 'free'"><span>{{ COPY.target }}</span><select :value="selectedPart.attachment.targetId || ''" @change="setAttachmentTarget($event.target.value)"><option v-for="target in attachmentTargets" :key="target.id" :value="target.id">{{ target.name }}</option></select></label>
            <label v-if="selectedPart.attachment.type === 'bone'"><span>{{ COPY.position }}</span><input :value="selectedPart.attachment.t" type="range" min="0" max="1" step=".01" @input="selectedPart.attachment.t = Number($event.target.value)"></label>
          </div>
          <div v-if="partFieldMode === 'size'" class="rig-part-field-row">
            <label><span>{{ COPY.width }}</span><input :value="round(selectedPart.width)" type="number" min="4" @input="setRestNumber(selectedPart, 'width', $event.target.value, 4)"></label>
            <label><span>{{ COPY.height }}</span><input :value="round(selectedPart.height)" type="number" min="4" @input="setRestNumber(selectedPart, 'height', $event.target.value, 4)"></label>
            <label><span>{{ COPY.layer }}</span><input :value="selectedPart.layer" type="number" @input="setRestNumber(selectedPart, 'layer', $event.target.value)"></label>
          </div>
          <div v-else class="rig-part-field-row">
            <label v-for="axis in ['X', 'Y', 'Z']" :key="axis"><span>{{ axis }}</span><input :value="round(selectedPart[partFieldMode === 'position' ? axis.toLowerCase() : `rotation${axis}`])" type="number" @input="setRestNumber(selectedPart, partFieldMode === 'position' ? axis.toLowerCase() : `rotation${axis}`, $event.target.value)"></label>
          </div>
          <div class="rig-part-field-row">
            <label><span>{{ COPY.fill }}</span><input v-model="selectedPart.fill" type="color"></label>
            <label><span>{{ COPY.stroke }}</span><input v-model="selectedPart.stroke" type="color"></label>
          </div>
        </div>
      </section>

      <section v-else class="rig-context-panel animation-context-panel">
        <div class="anime-animation-tabs">
          <button
            v-for="type in SHADOW_ANIMATION_TYPES" :key="type.id" type="button"
            :class="{ active: animationId === type.id }"
            @click="selectAnimation(type.id)"
          >
            {{ type.label }}
          </button>
          <button class="anime-reset-button" type="button" @click="resetCurrentAnimation">{{ COPY.resetAnimation }}</button>
        </div>
        <div class="anime-playback-row">
          <button type="button" @click="togglePlayback">{{ playing ? COPY.pause : COPY.play }}</button>
          <button type="button" @click="time = 0">{{ COPY.rewind }}</button>
          <span>{{ Math.round(time) }} / {{ currentAnimation.duration }} ms</span>
          <label>{{ COPY.duration }}<input :value="currentAnimation.duration" type="number" min="100" step="10" @change="setDuration($event.target.value)"></label>
          <label><input v-model="currentAnimation.loop" type="checkbox">{{ COPY.loop }}</label>
        </div>
        <div class="anime-scrubber">
          <div class="anime-scrubber-track" :style="{ '--scrubber-progress': `${time / currentAnimation.duration * 100}%` }">
            <input v-model.number="time" type="range" min="0" :max="currentAnimation.duration" step="1">
            <div class="anime-key-markers">
              <button
                v-for="keyTime in frameKeyTimes" :key="keyTime" type="button"
                :style="{ left: `${keyTime / currentAnimation.duration * 100}%` }"
                @click="time = keyTime"
              ></button>
            </div>
          </div>
          <button type="button" :disabled="!animationTargetKeys.length" @click="recordCurrentKey">{{ COPY.recordKey }}</button>
          <button type="button" :disabled="!hasCurrentKey" @click="deleteCurrentKey">{{ COPY.deleteKey }}</button>
        </div>
        <div class="rig-axis-tabs"><button v-for="mode in ['position', 'rotation', 'scale']" :key="mode" type="button" :class="{ active: poseFieldMode === mode }" @click="poseFieldMode = mode">{{ COPY[mode] }}</button></div>
        <div class="rig-animation-fields" role="group" :aria-label="selectedAnimationLabel">
          <template v-if="selectedTargetKey">
            <label v-for="axis in ['X', 'Y', 'Z']" :key="axis"><span>{{ axis }}</span><input :value="round(selectedPose[poseField(axis)])" type="number" :step="poseFieldMode === 'scale' ? .05 : 1" @input="setPoseNumber(poseField(axis), $event.target.value, poseFieldMode === 'scale' ? .05 : null)"></label>
            <label><span>{{ COPY.opacity }}</span><input :value="round(selectedPose.opacity)" type="number" min="0" max="1" step=".05" @input="setPoseNumber('opacity', $event.target.value, 0, 1)"></label>
          </template>
        </div>
      </section>
    </section>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Matrix4 } from 'three'
import { installInitialShadowExamples, repairInitialShadowExamples } from '../animation/shadow-examples.js'
import { ShadowHistory } from '../animation/shadow-history.js'
import {
  SHADOW_ANIMATION_TYPES,
  SHADOW_SHAPES,
  createDefaultShadowProject,
  createShadowBone,
  createShadowCharacter,
  createShadowJoint,
  createShadowPart,
  defaultShadowPose,
  evaluateShadowProject,
  inverseShadowVector,
  loadShadowRoster,
  normalizeShadowProject,
  normalizeShadowRoster,
  sampleShadowTrack,
  saveShadowRoster,
  shadowBoneAttachmentMatrix,
  shadowMatrixEuler,
  shadowMatrixPosition,
  shadowTargetKey,
  upsertShadowKeyframe,
} from '../animation/shadow-rig.js'
import ShadowPuppetStage from './ShadowPuppetStage.vue'
import '../anime.css'

const COPY = Object.freeze({
  undo: '\u64a4\u56de', hidePart: '\u6682\u65f6\u9690\u85cf\u90e8\u4ef6', showPart: '\u663e\u793a\u90e8\u4ef6',
  partName: '\u90e8\u4ef6\u540d\u79f0',
  size: '\u5c3a\u5bf8', scale: '\u7f29\u653e',
  resetAnimation: '\u91cd\u7f6e',
  resetAnimationConfirm: '\u6e05\u7a7a\u5f53\u524d\u52a8\u4f5c\u7684\u6240\u6709\u5173\u952e\u5e27\uff0c\u6062\u590d\u9aa8\u67b6\u548c\u90e8\u4ef6\u7684\u521d\u59cb\u59ff\u6001\uff1f',
  back: '\u8fd4\u56de\u6e38\u620f', character: '\u89d2\u8272', characterName: '\u89d2\u8272\u540d\u79f0', add: '\u65b0\u5efa', duplicate: '\u590d\u5236', deleteCharacter: '\u5220\u9664', editorMode: '\u7f16\u8f91\u6a21\u5f0f', skeleton: '\u9aa8\u67b6', parts: '\u90e8\u4ef6', animation: '\u52a8\u4f5c', bones: '\u9aa8\u67b6', grid: '\u7f51\u683c', select: '\u9009\u62e9', addJoint: '\u6dfb\u52a0\u5173\u8282', connect: '\u8fde\u63a5', deleteSelected: '\u5220\u9664', name: '\u540d\u79f0', rotation: '\u65cb\u8f6c', tapToAddJoint: '\u70b9\u51fb\u753b\u5e03\u521b\u5efa\u72ec\u7acb\u5173\u8282', connectFirst: '\u8bf7\u5148\u70b9\u51fb\u8d77\u70b9\u5173\u8282', connectSecond: '\u8bf7\u70b9\u51fb\u7ec8\u70b9\u5173\u8282', invalidConnection: '\u65e0\u6cd5\u521b\u5efa\u5faa\u73af\u9aa8\u67b6', selectPart: '\u9009\u62e9\u90e8\u4ef6', bind: '\u7ed1\u5b9a', free: '\u81ea\u7531', joint: '\u5173\u8282', bone: '\u9aa8\u9abc\u7ebf', target: '\u76ee\u6807', position: '\u4f4d\u7f6e', width: '\u5bbd', height: '\u9ad8', layer: '\u5c42\u7ea7', fill: '\u586b\u8272', stroke: '\u8f6e\u5ed3', play: '\u64ad\u653e', pause: '\u6682\u505c', rewind: '\u5f52\u96f6', duration: '\u65f6\u957f', loop: '\u5faa\u73af', opacity: '\u900f\u660e\u5ea6', recordKey: '\u8bb0\u5f55\u5e27', deleteKey: '\u5220\u9664\u5e27', selectAnimationTarget: '\u8bf7\u5728\u753b\u5e03\u4e0a\u9009\u62e9\u5173\u8282\u6216\u90e8\u4ef6', newCharacter: '\u65b0\u89d2\u8272', duplicateSuffix: '\u526f\u672c', deleteCharacterConfirm: '\u5220\u9664\u5f53\u524d\u89d2\u8272\u53ca\u5176\u5168\u90e8\u52a8\u4f5c\uff1f',
})

const initialRoster = loadShadowRoster()
const examplesInstalled = installInitialShadowExamples(initialRoster)
const examplesRepaired = repairInitialShadowExamples(initialRoster)
if (examplesInstalled || examplesRepaired) {
  try { saveShadowRoster(initialRoster) } catch { /* Keep the examples usable when storage is unavailable. */ }
}
const roster = ref(initialRoster)
const history = new ShadowHistory(initialRoster, 80, normalizeShadowRoster)
const undoCount = ref(0)
const activeCharacterId = ref(roster.value.activeCharacterId)
const project = computed({
  get: () => roster.value.characters.find((entry) => entry.id === activeCharacterId.value)?.project || roster.value.characters[0].project,
  set: (value) => {
    const character = roster.value.characters.find((entry) => entry.id === activeCharacterId.value)
    if (character) character.project = value
  },
})
const editorMode = ref('skeleton')
const skeletonTool = ref('select')
const selectedKind = ref(null)
const selectedId = ref(null)
const connectFromId = ref(null)
const notice = ref('')
const pendingShape = ref(null)
const partFieldMode = ref('size')
const poseFieldMode = ref('position')
const showBones = ref(true)
const showMesh = ref(true)
const stage3D = ref(false)
const hiddenParts = ref({})
const hiddenPartIds = computed(() => Object.entries(hiddenParts.value[activeCharacterId.value] || {}).filter(([, hidden]) => hidden).map(([id]) => id))
const animationId = ref('idle')
const time = ref(0)
const playing = ref(false)
let saveTimer = null
let animationFrame = 0
let lastFrameTime = 0
let localIdSequence = 0
let stageDragGrouped = false

const currentAnimation = computed(() => project.value.animations[animationId.value])
const selectedJoint = computed(() => selectedKind.value === 'joint' ? project.value.joints.find((entry) => entry.id === selectedId.value) || null : null)
const selectedBone = computed(() => selectedKind.value === 'bone' ? project.value.bones.find((entry) => entry.id === selectedId.value) || null : null)
const selectedPart = computed(() => selectedKind.value === 'part' ? project.value.parts.find((entry) => entry.id === selectedId.value) || null : null)
const selectedPartHidden = computed(() => Boolean(selectedPart.value && hiddenParts.value[activeCharacterId.value]?.[selectedPart.value.id]))
const orderedParts = computed(() => [...project.value.parts].sort((left, right) => right.layer - left.layer || left.name.localeCompare(right.name)))

function poseField(axis) {
  return poseFieldMode.value === 'position' ? `d${axis.toLowerCase()}` : `${poseFieldMode.value}${axis}`
}
const attachmentTargets = computed(() => selectedPart.value?.attachment.type === 'joint'
  ? project.value.joints
  : project.value.bones)
const selectedTargetKey = computed(() => {
  if (selectedKind.value !== 'joint' && selectedKind.value !== 'part') return null
  return shadowTargetKey(selectedKind.value, selectedId.value)
})
const selectedPose = computed(() => selectedTargetKey.value
  ? sampleShadowTrack(currentAnimation.value, selectedTargetKey.value, time.value)
  : defaultShadowPose())
const animationTargetKeys = computed(() => [
  ...project.value.joints.map((entry) => shadowTargetKey('joint', entry.id)),
  ...project.value.parts.map((entry) => shadowTargetKey('part', entry.id)),
])
const frameKeyTimes = computed(() => [...new Set(Object.values(currentAnimation.value.tracks)
  .flatMap((keys) => keys.map((entry) => entry.time)))].sort((left, right) => left - right))
const hasCurrentKey = computed(() => frameKeyTimes.value.some((keyTime) => Math.abs(keyTime - time.value) <= 8))
const selectedAnimationLabel = computed(() => {
  if (selectedJoint.value) return selectedJoint.value.name
  if (selectedPart.value) return selectedPart.value.name
  return COPY.selectAnimationTarget
})
const skeletonStatus = computed(() => {
  if (notice.value) return notice.value
  if (skeletonTool.value === 'add-joint') return COPY.tapToAddJoint
  if (skeletonTool.value === 'connect') return connectFromId.value ? COPY.connectSecond : COPY.connectFirst
  return ''
})

watch(roster, () => {
  history.record(roster.value)
  undoCount.value = history.stack.length || (history.groupDepth ? 1 : 0)
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      saveShadowRoster(roster.value)
    } catch { /* Keep editing in memory if localStorage is unavailable or full. */ }
  }, 140)
}, { deep: true })

function beginInputHistory(event) {
  if (event.target.matches('input, select')) history.begin(roster.value)
}

function endInputHistory(event) {
  if (!event.target.matches('input, select')) return
  history.end(roster.value)
  undoCount.value = history.stack.length
}

function endStageDrag() {
  if (!stageDragGrouped) return
  stageDragGrouped = false
  history.end(roster.value)
  undoCount.value = history.stack.length
}

function endActiveHistoryGroups() {
  endStageDrag()
  while (history.groupDepth) history.end(roster.value)
  undoCount.value = history.stack.length
}

function undoEdit() {
  endStageDrag()
  const previous = history.undo(roster.value)
  if (!previous) return
  roster.value = normalizeShadowRoster(previous)
  activeCharacterId.value = roster.value.activeCharacterId
  playing.value = false
  resetSelection()
  undoCount.value = history.stack.length
  clearTimeout(saveTimer)
  try { saveShadowRoster(roster.value) } catch { /* Undo still works in memory. */ }
}

function toggleSelectedPartHidden() {
  if (!selectedPart.value) return
  const characterId = activeCharacterId.value
  hiddenParts.value = {
    ...hiddenParts.value,
    [characterId]: { ...hiddenParts.value[characterId], [selectedPart.value.id]: !selectedPartHidden.value },
  }
}

watch(() => currentAnimation.value.duration, (duration) => {
  if (time.value > duration) time.value = duration
})

function round(value) {
  return Math.round(Number(value) * 100) / 100
}

function nextLocalId(prefix) {
  localIdSequence += 1
  return `${prefix}-${Date.now().toString(36)}-${localIdSequence.toString(36)}`
}

function setEditorMode(mode) {
  editorMode.value = mode
  playing.value = false
  connectFromId.value = null
  notice.value = ''
  pendingShape.value = null
  if (mode === 'skeleton') showBones.value = true
}

function resetSelection() {
  selectedKind.value = null
  selectedId.value = null
  connectFromId.value = null
}

function resetEditorState() {
  resetSelection()
  editorMode.value = 'skeleton'
  skeletonTool.value = 'select'
  animationId.value = 'idle'
  time.value = 0
  playing.value = false
}

function persistRoster() {
  roster.value.activeCharacterId = activeCharacterId.value
  saveShadowRoster(roster.value)
}

function activateCharacter(characterId) {
  if (!roster.value.characters.some((entry) => entry.id === characterId)) return
  activeCharacterId.value = characterId
  roster.value.activeCharacterId = characterId
  resetEditorState()
  persistRoster()
}

function addCharacterProject(nextProject) {
  const character = createShadowCharacter(nextProject)
  roster.value.characters.push(character)
  activateCharacter(character.id)
}

function addBlankCharacter() {
  const nextProject = createDefaultShadowProject()
  nextProject.name = `${COPY.newCharacter} ${roster.value.characters.length + 1}`
  addCharacterProject(nextProject)
}

function renameCharacter() {
  const nextName = window.prompt(COPY.characterName, project.value.name)
  if (nextName?.trim()) project.value.name = nextName.trim()
}

function duplicateCharacter() {
  const nextProject = normalizeShadowProject(project.value)
  nextProject.name = `${project.value.name} ${COPY.duplicateSuffix}`
  addCharacterProject(nextProject)
}

function deleteCharacter() {
  if (!window.confirm(COPY.deleteCharacterConfirm)) return
  const index = roster.value.characters.findIndex((entry) => entry.id === activeCharacterId.value)
  if (index < 0) return
  roster.value.characters.splice(index, 1)
  if (!roster.value.characters.length) {
    const blank = createShadowCharacter(createDefaultShadowProject())
    blank.project.name = `${COPY.newCharacter} 1`
    roster.value.characters.push(blank)
  }
  activateCharacter(roster.value.characters[Math.min(index, roster.value.characters.length - 1)].id)
}

function setSkeletonTool(tool) {
  skeletonTool.value = tool
  connectFromId.value = null
  notice.value = ''
}

function onCanvasTap(point) {
  if (editorMode.value === 'skeleton' && skeletonTool.value === 'add-joint') {
    const joint = createShadowJoint({ id: nextLocalId('joint'), name: `${COPY.joint} ${project.value.joints.length + 1}`, x: point.x, y: point.y })
    project.value.joints.push(joint)
    selectedKind.value = 'joint'
    selectedId.value = joint.id
    return
  }
  if (editorMode.value === 'parts' && pendingShape.value) {
    const definition = SHADOW_SHAPES.find((entry) => entry.id === pendingShape.value)
    const part = createShadowPart({
      id: nextLocalId('part'),
      name: `${definition?.label || COPY.parts} ${project.value.parts.length + 1}`,
      shape: pendingShape.value,
      x: point.x,
      y: point.y,
      layer: Math.max(0, ...project.value.parts.map((entry) => entry.layer + 1)),
    })
    project.value.parts.push(part)
    selectedKind.value = 'part'
    selectedId.value = part.id
    pendingShape.value = null
  }
}

function onStageSelect({ kind, id }) {
  notice.value = ''
  if (editorMode.value === 'skeleton' && skeletonTool.value === 'connect' && kind === 'joint') {
    if (!connectFromId.value) {
      connectFromId.value = id
      selectedKind.value = 'joint'
      selectedId.value = id
    } else {
      connectJoints(connectFromId.value, id)
    }
    return
  }
  selectedKind.value = kind
  selectedId.value = id
}

function createsCycle(fromJointId, toJointId) {
  const incoming = new Map(project.value.bones.map((entry) => [entry.toJointId, entry.fromJointId]))
  let current = fromJointId
  const visited = new Set()
  while (current && !visited.has(current)) {
    if (current === toJointId) return true
    visited.add(current)
    current = incoming.get(current)
  }
  return false
}

function setRestFromMatrix(target, matrix) {
  const position = shadowMatrixPosition(matrix)
  const rotation = shadowMatrixEuler(matrix)
  Object.assign(target, position, rotation)
}

function makePartFree(part, evaluatedPart) {
  if (!evaluatedPart) return
  part.attachment = { type: 'free', targetId: null, t: 0.5, followRotation: true }
  setRestFromMatrix(part, evaluatedPart.matrix)
}

function connectJoints(fromJointId, toJointId) {
  connectFromId.value = null
  if (fromJointId === toJointId || createsCycle(fromJointId, toJointId)) {
    notice.value = COPY.invalidConnection
    return
  }
  const before = evaluateShadowProject(project.value)
  const childEntry = before.jointsById.get(toJointId)
  const parentEntry = before.jointsById.get(fromJointId)
  const child = project.value.joints.find((entry) => entry.id === toJointId)
  if (!childEntry || !parentEntry || !child) return
  const oldIncoming = project.value.bones.find((entry) => entry.toJointId === toJointId)
  if (oldIncoming) {
    for (const part of project.value.parts) {
      if (part.attachment.type === 'bone' && part.attachment.targetId === oldIncoming.id) {
        makePartFree(part, before.parts.find((entry) => entry.part.id === part.id))
      }
    }
    project.value.bones = project.value.bones.filter((entry) => entry.id !== oldIncoming.id)
  }
  setRestFromMatrix(child, parentEntry.matrix.clone().invert().multiply(childEntry.matrix))
  const bone = createShadowBone({
    id: nextLocalId('bone'),
    name: `${COPY.bone} ${project.value.bones.length + 1}`,
    fromJointId,
    toJointId,
  })
  project.value.bones.push(bone)
  selectedKind.value = 'bone'
  selectedId.value = bone.id
  skeletonTool.value = 'select'
}

function deleteTracks(targetKey) {
  for (const animation of Object.values(project.value.animations)) delete animation.tracks[targetKey]
}

function deleteSelectedSkeleton() {
  const before = evaluateShadowProject(project.value)
  if (selectedBone.value) {
    const bone = selectedBone.value
    const child = project.value.joints.find((entry) => entry.id === bone.toJointId)
    const childWorld = before.jointsById.get(bone.toJointId)
    if (child && childWorld) {
      setRestFromMatrix(child, childWorld.matrix)
    }
    for (const part of project.value.parts) {
      if (part.attachment.type === 'bone' && part.attachment.targetId === bone.id) {
        makePartFree(part, before.parts.find((entry) => entry.part.id === part.id))
      }
    }
    project.value.bones = project.value.bones.filter((entry) => entry.id !== bone.id)
  } else if (selectedJoint.value) {
    const joint = selectedJoint.value
    const removedBones = project.value.bones.filter((entry) => entry.fromJointId === joint.id || entry.toJointId === joint.id)
    const removedBoneIds = new Set(removedBones.map((entry) => entry.id))
    for (const bone of removedBones.filter((entry) => entry.fromJointId === joint.id)) {
      const child = project.value.joints.find((entry) => entry.id === bone.toJointId)
      const childWorld = before.jointsById.get(bone.toJointId)
      if (child && childWorld) {
        setRestFromMatrix(child, childWorld.matrix)
      }
    }
    for (const part of project.value.parts) {
      const attachedToJoint = part.attachment.type === 'joint' && part.attachment.targetId === joint.id
      const attachedToBone = part.attachment.type === 'bone' && removedBoneIds.has(part.attachment.targetId)
      if (attachedToJoint || attachedToBone) makePartFree(part, before.parts.find((entry) => entry.part.id === part.id))
    }
    project.value.bones = project.value.bones.filter((entry) => !removedBoneIds.has(entry.id))
    project.value.joints = project.value.joints.filter((entry) => entry.id !== joint.id)
    deleteTracks(shadowTargetKey('joint', joint.id))
  }
  resetSelection()
}

function selectPart(partId) {
  if (!partId) return
  selectedKind.value = 'part'
  selectedId.value = partId
}

function renameSelectedPart() {
  if (!selectedPart.value) return
  const nextName = window.prompt(COPY.partName, selectedPart.value.name)
  if (nextName?.trim()) selectedPart.value.name = nextName.trim()
}

function duplicateSelectedPart() {
  if (!selectedPart.value) return
  const copy = JSON.parse(JSON.stringify(selectedPart.value))
  copy.id = nextLocalId('part')
  copy.name = `${copy.name} ${COPY.duplicateSuffix}`
  copy.x += 18
  copy.y += 18
  copy.layer += 1
  project.value.parts.push(copy)
  selectedId.value = copy.id
}

function deleteSelectedPart() {
  if (!selectedPart.value) return
  const partId = selectedPart.value.id
  project.value.parts = project.value.parts.filter((entry) => entry.id !== partId)
  deleteTracks(shadowTargetKey('part', partId))
  resetSelection()
}

function attachmentBaseMatrix(type, targetId, t = 0.5, followRotation = true) {
  const rest = evaluateShadowProject(project.value)
  if (type === 'joint') return rest.jointsById.get(targetId)?.matrix || new Matrix4()
  if (type === 'bone') {
    const bone = rest.bonesById.get(targetId)
    if (bone) return shadowBoneAttachmentMatrix(bone, t, followRotation)
  }
  return new Matrix4()
}

function rebindSelectedPart(type, targetId) {
  if (!selectedPart.value) return
  const evaluated = evaluateShadowProject(project.value).parts.find((entry) => entry.part.id === selectedPart.value.id)
  if (!evaluated) return
  const t = selectedPart.value.attachment.t ?? 0.5
  const followRotation = selectedPart.value.attachment.followRotation !== false
  const base = attachmentBaseMatrix(type, targetId, t, followRotation)
  setRestFromMatrix(selectedPart.value, base.clone().invert().multiply(evaluated.matrix))
  selectedPart.value.attachment = { type, targetId: type === 'free' ? null : targetId, t, followRotation }
}

function setAttachmentType(type) {
  if (!selectedPart.value) return
  const targets = type === 'joint' ? project.value.joints : project.value.bones
  rebindSelectedPart(type, type === 'free' ? null : targets[0]?.id || null)
  if (type !== 'free' && !targets.length) rebindSelectedPart('free', null)
}

function setAttachmentTarget(targetId) {
  if (selectedPart.value) rebindSelectedPart(selectedPart.value.attachment.type, targetId)
}

function setRestNumber(target, field, value, minimum = null) {
  let next = Number(value)
  if (!Number.isFinite(next)) return
  if (minimum !== null) next = Math.max(minimum, next)
  target[field] = next
}

function jointName(jointId) {
  return project.value.joints.find((entry) => entry.id === jointId)?.name || jointId
}

function onStageDrag({ kind, id, previous, current }) {
  if (!stageDragGrouped) {
    history.begin(roster.value)
    stageDragGrouped = true
  }
  selectedKind.value = kind
  selectedId.value = id
  const dx = current.x - previous.x
  const dy = current.y - previous.y
  const dz = current.z - previous.z
  const currentEvaluation = evaluateShadowProject(project.value, editorMode.value === 'animation' ? animationId.value : null, time.value)
  if (editorMode.value === 'animation') {
    const targetKey = shadowTargetKey(kind, id)
    const entry = kind === 'joint'
      ? currentEvaluation.jointsById.get(id)
      : currentEvaluation.parts.find((candidate) => candidate.part.id === id)
    if (!entry) return
    const localDelta = inverseShadowVector(kind === 'joint' ? entry.parentMatrix : entry.baseMatrix, dx, dy, dz)
    const pose = sampleShadowTrack(currentAnimation.value, targetKey, time.value)
    pose.dx += localDelta.x
    pose.dy += localDelta.y
    pose.dz += localDelta.z
    upsertShadowKeyframe(project.value, animationId.value, targetKey, time.value, pose)
    return
  }
  if (kind === 'joint') {
    const joint = project.value.joints.find((entry) => entry.id === id)
    const evaluated = currentEvaluation.jointsById.get(id)
    if (!joint || !evaluated) return
    const localDelta = inverseShadowVector(evaluated.parentMatrix, dx, dy, dz)
    joint.x += localDelta.x
    joint.y += localDelta.y
    joint.z += localDelta.z
  } else if (kind === 'part') {
    const part = project.value.parts.find((entry) => entry.id === id)
    const evaluated = currentEvaluation.parts.find((entry) => entry.part.id === id)
    if (!part || !evaluated) return
    const localDelta = inverseShadowVector(evaluated.baseMatrix, dx, dy, dz)
    part.x += localDelta.x
    part.y += localDelta.y
    part.z += localDelta.z
  }
}

function selectAnimation(id) {
  animationId.value = id
  time.value = 0
  playing.value = false
}

function resetCurrentAnimation() {
  const animation = currentAnimation.value
  const hasKeys = Object.values(animation.tracks).some((keys) => keys.length > 0)
  if (hasKeys && !window.confirm(COPY.resetAnimationConfirm)) return
  playing.value = false
  time.value = 0
  animation.tracks = {}
}

function recordCurrentKey() {
  playing.value = false
  const frameTime = Math.round(time.value)
  for (const targetKey of animationTargetKeys.value) {
    const pose = sampleShadowTrack(currentAnimation.value, targetKey, frameTime)
    upsertShadowKeyframe(project.value, animationId.value, targetKey, frameTime, pose)
  }
}

function deleteCurrentKey() {
  playing.value = false
  const tracks = currentAnimation.value.tracks
  for (const [targetKey, keys] of Object.entries(tracks)) {
    const remaining = keys.filter((entry) => Math.abs(entry.time - time.value) > 8)
    if (remaining.length === keys.length) continue
    if (remaining.length) tracks[targetKey] = remaining
    else delete tracks[targetKey]
  }
}

function setPoseNumber(field, value, minimum = null, maximum = null) {
  if (!selectedTargetKey.value) return
  let next = Number(value)
  if (!Number.isFinite(next)) return
  if (minimum !== null) next = Math.max(minimum, next)
  if (maximum !== null) next = Math.min(maximum, next)
  upsertShadowKeyframe(project.value, animationId.value, selectedTargetKey.value, time.value, { ...selectedPose.value, [field]: next })
}

function setDuration(value) {
  const duration = Math.max(100, Number(value) || 100)
  currentAnimation.value.duration = duration
  for (const keys of Object.values(currentAnimation.value.tracks)) {
    for (const keyframe of keys) keyframe.time = Math.min(duration, keyframe.time)
    keys.sort((left, right) => left.time - right.time)
  }
  time.value = Math.min(time.value, duration)
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

onMounted(() => {
  document.documentElement.classList.add('anime-html')
  document.body.classList.add('anime-body')
  window.addEventListener('blur', endActiveHistoryGroups)
  lastFrameTime = window.performance.now()
  animationFrame = window.requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  endActiveHistoryGroups()
  window.removeEventListener('blur', endActiveHistoryGroups)
  document.documentElement.classList.remove('anime-html')
  document.body.classList.remove('anime-body')
  window.cancelAnimationFrame(animationFrame)
  clearTimeout(saveTimer)
  try { persistRoster() } catch { /* Keep the in-memory editor usable if storage is full. */ }
})
</script>
