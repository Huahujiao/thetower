<template>
  <main class="anime-page anime-detail-page">
    <header class="anime-topbar anime-detail-topbar">
      <a class="anime-back" href="/animepreview" :aria-label="COPY.back">←</a>
      <h1>{{ project?.name || COPY.missing }}</h1>
      <nav v-if="project" class="anime-detail-neighbors" :aria-label="COPY.switchEnemy">
        <a v-if="previous" :href="enemyDetailHref(previous.enemyId)" :aria-label="`${COPY.previous}${previous.name}`" :title="previous.name">‹</a>
        <span>{{ index + 1 }} / {{ projects.length }}</span>
        <a v-if="next" :href="enemyDetailHref(next.enemyId)" :aria-label="`${COPY.next}${next.name}`" :title="next.name">›</a>
      </nav>
    </header>
    <template v-if="project">
      <section class="anime-detail-stage" :aria-label="COPY.view">
        <div class="rig-stage-options" @pointerdown.stop>
          <label><input v-model="showBones" type="checkbox">{{ COPY.bones }}</label>
          <label><input v-model="showParts" type="checkbox">{{ COPY.textures }}</label>
        </div>
        <ShadowPuppetStage
          :project="project" default-orbit-mode :animation-id="animationId" :time="time"
          :show-bones="showBones" :show-parts="showParts" :show-grid="false"
          :joint-interactive="false" :bone-interactive="false" :part-interactive="false" interactive
        />
      </section>
      <section class="anime-detail-panel">
        <div class="anime-detail-tabs" role="tablist" :aria-label="COPY.tools">
          <button id="animation-tab" type="button" role="tab" :aria-selected="tab === 'animation'" aria-controls="animation-panel" :class="{ active: tab === 'animation' }" @click="switchTab('animation')">{{ COPY.actions }}</button>
          <button id="parts-tab" type="button" role="tab" :aria-selected="tab === 'parts'" aria-controls="parts-panel" :class="{ active: tab === 'parts' }" @click="switchTab('parts')">{{ COPY.parts }} <span>{{ project.parts.length }}</span></button>
        </div>
        <div v-if="tab === 'animation'" id="animation-panel" class="anime-detail-playback" role="tabpanel" aria-labelledby="animation-tab">
          <div class="anime-detail-actions">
            <button type="button" :class="{ active: !animationId }" @click="standPose">{{ COPY.stand }}</button>
            <button v-for="type in actions" :key="type.id" type="button" :class="{ active: animationId === type.id }" @click="playAnimation(type.id)">{{ type.label }}</button>
          </div>
          <label class="anime-detail-timeline"><span>{{ COPY.progress }}</span><input :value="time" :disabled="!animationId" type="range" min="0" :max="animation.duration" step="1" @input="seek($event.target.value)"><output>{{ (time / 1000).toFixed(2) }} / {{ (animation.duration / 1000).toFixed(2) }} s</output></label>
          <div class="anime-detail-transport">
            <button type="button" @click="togglePlayback">{{ playing ? COPY.pause : COPY.play }}</button>
            <button type="button" @click="playAnimation(animationId || 'idle')">{{ COPY.restart }}</button>
            <label>{{ COPY.speed }}<select v-model.number="speed"><option :value="0.25">0.25×</option><option :value="0.5">0.5×</option><option :value="1">1×</option><option :value="1.5">1.5×</option><option :value="2">2×</option></select></label>
            <label><input v-model="loop" type="checkbox">{{ COPY.loop }}</label>
          </div>
          <p>{{ COPY.viewHint }}</p>
        </div>
        <div v-else id="parts-panel" class="anime-detail-parts-scroll" role="tabpanel" aria-labelledby="parts-tab">
          <div class="anime-detail-parts-grid">
            <button v-for="(part, partIndex) in project.parts" :key="part.id" class="anime-detail-part-card" type="button" @click="openPart(part)">
              <ShadowPartImage :part="part" />
              <span class="anime-part-name"><small>{{ String(partIndex + 1).padStart(2, '0') }}</small>{{ part.name }}</span>
            </button>
          </div>
        </div>
      </section>
      <dialog ref="partDialog" class="anime-part-dialog" :aria-label="selectedPart?.name" @click="closePartOnBackdrop" @close="selectedPart = null">
        <template v-if="selectedPart">
          <header><h2>{{ selectedPart.name }}</h2><button type="button" :aria-label="COPY.close" @click="partDialog.close()">×</button></header>
          <ShadowPartImage :part="selectedPart" />
          <a :href="selectedPart.visual.texture" target="_blank" rel="noopener">{{ COPY.source }}</a>
        </template>
      </dialog>
    </template>
    <div v-else class="anime-detail-missing"><p>{{ COPY.missingHint }}</p><a class="anime-button" href="/animepreview">{{ COPY.back }}</a></div>
  </main>
</template>

<script setup>
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { SHADOW_ANIMATION_TYPES } from '../animation/shadow-rig.js'
import { createEnemyPreviewModels, enemyDetailHref } from '../animation/shadow-preview-models.js'
import ShadowPuppetStage from './ShadowPuppetStage.vue'
import ShadowPartImage from './ShadowPartImage.vue'
import '../anime.css'

const COPY = Object.freeze({
  back: '\u8fd4\u56de\u654c\u4eba\u5217\u8868', missing: '\u672a\u627e\u5230\u654c\u4eba', missingHint: '\u8fd9\u4e2a\u654c\u4eba\u4e0d\u5728\u5f53\u524d\u5217\u8868\u4e2d\u3002',
  switchEnemy: '\u5207\u6362\u654c\u4eba', previous: '\u4e0a\u4e00\u4e2a\uff1a', next: '\u4e0b\u4e00\u4e2a\uff1a',
  view: '\u4e09\u7ef4\u89c6\u56fe', bones: '\u9aa8\u67b6', textures: '\u8d34\u56fe', tools: '\u67e5\u770b\u529f\u80fd',
  actions: '\u52a8\u4f5c\u64ad\u653e', parts: '\u90e8\u4ef6\u5217\u8868', stand: '\u7ad9\u59ff', progress: '\u8fdb\u5ea6',
  play: '\u64ad\u653e', pause: '\u6682\u505c', restart: '\u91cd\u64ad', speed: '\u901f\u5ea6', loop: '\u5faa\u73af',
  viewHint: '\u62d6\u52a8\u65cb\u8f6c\uff0c\u6eda\u8f6e\u6216\u53cc\u6307\u7f29\u653e\uff1b\u70b9\u51fb\u300c\u6b63\u9762\u300d\u8fd4\u56de\u6b63\u9762\u89c6\u56fe\u3002',
  close: '\u5173\u95ed', source: '\u67e5\u770b\u539f\u59cb\u8d34\u56fe',
})
const projects = markRaw(createEnemyPreviewModels())
const pathId = window.location.pathname.replace(/\/$/, '').split('/')[2]
const enemyId = pathId || new window.URLSearchParams(window.location.search).get('enemy') || projects[0]?.enemyId
const index = projects.findIndex(p => p.enemyId === enemyId)
const project = projects[index]
const previous = projects[index - 1], next = projects[index + 1]
const actions = SHADOW_ANIMATION_TYPES.filter(type => project?.animations[type.id])
const tab = ref('animation'), animationId = ref(null), time = ref(0)
const speed = ref(1), playing = ref(false), loop = ref(true)
const showBones = ref(false), showParts = ref(true)
const selectedPart = ref(null), partDialog = ref(null)
const animation = computed(() => project?.animations[animationId.value || 'idle'] || { duration: 1 })
let frameId = 0, previousTimestamp = 0

function playAnimation(id) {
  animationId.value = id; time.value = 0; playing.value = true
  previousTimestamp = window.performance.now()
}
function standPose() { animationId.value = null; time.value = 0; playing.value = false }
function switchTab(value) { tab.value = value; if (value === 'parts') standPose() }
function seek(value) { time.value = Number(value); playing.value = false }
function togglePlayback() {
  if (!animationId.value) { playAnimation('idle'); return }
  if (!playing.value && time.value >= animation.value.duration) time.value = 0
  playing.value = !playing.value
  previousTimestamp = window.performance.now()
}
function tick(timestamp) {
  if (playing.value) {
    const next = time.value + Math.min(64, timestamp - previousTimestamp) * speed.value
    if (next >= animation.value.duration) {
      if (loop.value) time.value = next % animation.value.duration
      else { time.value = animation.value.duration; playing.value = false }
    } else time.value = next
  }
  previousTimestamp = timestamp
  frameId = window.requestAnimationFrame(tick)
}
async function openPart(part) { selectedPart.value = part; await nextTick(); partDialog.value.showModal() }
function closePartOnBackdrop(event) { if (event.target === partDialog.value) partDialog.value.close() }
onMounted(() => {
  document.documentElement.classList.add('anime-html')
  document.body.classList.add('anime-body', 'anime-review-body')
  document.title = `${project?.name || COPY.missing} · ${COPY.view}`
  previousTimestamp = window.performance.now()
  if (project) frameId = window.requestAnimationFrame(tick)
})
onBeforeUnmount(() => {
  window.cancelAnimationFrame(frameId)
  document.documentElement.classList.remove('anime-html')
  document.body.classList.remove('anime-body', 'anime-review-body')
})
</script>
