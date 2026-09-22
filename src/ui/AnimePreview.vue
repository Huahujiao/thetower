<template>
  <main class="anime-page anime-preview-page">
    <header class="anime-topbar anime-preview-topbar">
      <div>
        <a class="anime-back" href="/animeedit" :aria-label="COPY.back">←</a>
        <div><span class="anime-kicker">SHADOW PUPPET PLAYER</span><h1>{{ project.name }}</h1></div>
      </div>
      <div class="anime-top-actions">
        <label><input v-model="showBones" type="checkbox"> {{ COPY.showBones }}</label>
        <label>{{ COPY.speed }} <select v-model.number="speed"><option :value="0.5">0.5×</option><option :value="1">1×</option><option :value="1.5">1.5×</option><option :value="2">2×</option></select></label>
        <a class="anime-button primary" href="/animeedit">{{ COPY.edit }}</a>
      </div>
    </header>

    <section class="anime-preview-content">
      <div class="anime-preview-stage">
        <ShadowPuppetStage
          :project="project" :animation-id="animationId" :time="time"
          :show-bones="showBones" :show-grid="false"
        />
      </div>
      <div class="anime-preview-controls">
        <div class="anime-animation-tabs">
          <button
            v-for="type in SHADOW_ANIMATION_TYPES" :key="type.id" type="button"
            :class="{ active: animationId === type.id }" @click="playAnimation(type.id)"
          >
            {{ type.label }}
          </button>
        </div>
        <div class="anime-preview-progress"><span :style="{ width: `${progress}%` }"></span></div>
        <div class="anime-playback-row">
          <button type="button" class="anime-play-button" @click="togglePlayback">{{ playing ? COPY.pause : COPY.play }}</button>
          <button type="button" @click="restart">{{ COPY.restart }}</button>
          <span>{{ Math.round(time) }} / {{ animation.duration }} ms</span>
        </div>
        <p>{{ COPY.previewHint }}</p>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { SHADOW_ANIMATION_TYPES, SHADOW_PUPPET_STORAGE_KEY, loadShadowProject } from '../animation/shadow-puppet.js'
import ShadowPuppetStage from './ShadowPuppetStage.vue'
import '../anime.css'

const COPY = Object.freeze({
  back: '\u8fd4\u56de\u7f16\u8f91\u5668', showBones: '\u663e\u793a\u9aa8\u9abc', speed: '\u901f\u5ea6', edit: '\u7f16\u8f91', play: '\u64ad\u653e', pause: '\u6682\u505c', restart: '\u91cd\u64ad',
  previewHint: '\u9884\u89c8\u9875\u53ea\u8d1f\u8d23\u64ad\u653e\u3002\u90e8\u4ef6\u3001\u8d34\u56fe\u3001\u9aa8\u9abc\u548c\u5173\u952e\u5e27\u5747\u6765\u81ea\u7f16\u8f91\u5668\u4fdd\u5b58\u7684\u540c\u4e00\u4efd\u5de5\u7a0b\u3002',
})

const project = ref(loadShadowProject())
const animationId = ref('idle')
const time = ref(0)
const speed = ref(1)
const playing = ref(true)
const showBones = ref(false)
let frameId = 0
let previousTimestamp = 0

const animation = computed(() => project.value.animations[animationId.value])
const progress = computed(() => animation.value.duration ? time.value / animation.value.duration * 100 : 0)

function playAnimation(id) {
  animationId.value = id
  time.value = 0
  playing.value = true
  previousTimestamp = window.performance.now()
}

function restart() {
  time.value = 0
  playing.value = true
  previousTimestamp = window.performance.now()
}

function togglePlayback() {
  if (!playing.value && time.value >= animation.value.duration) time.value = 0
  playing.value = !playing.value
  previousTimestamp = window.performance.now()
}

function tick(timestamp) {
  if (playing.value) {
    const delta = Math.min(64, timestamp - previousTimestamp) * speed.value
    const next = time.value + delta
    if (next >= animation.value.duration) {
      if (animation.value.loop) time.value = next % animation.value.duration
      else {
        time.value = animation.value.duration
        playing.value = false
      }
    } else time.value = next
  }
  previousTimestamp = timestamp
  frameId = window.requestAnimationFrame(tick)
}

function onStorage(event) {
  if (event.key !== SHADOW_PUPPET_STORAGE_KEY) return
  project.value = loadShadowProject()
  time.value = Math.min(time.value, animation.value.duration)
}

onMounted(() => {
  document.body.classList.add('anime-body')
  window.addEventListener('storage', onStorage)
  previousTimestamp = window.performance.now()
  frameId = window.requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  document.body.classList.remove('anime-body')
  window.removeEventListener('storage', onStorage)
  window.cancelAnimationFrame(frameId)
})
</script>
