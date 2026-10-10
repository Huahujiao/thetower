<template>
  <main class="anime-page anime-gallery-page">
    <header class="anime-topbar anime-gallery-topbar">
      <a class="anime-back" href="/" :aria-label="COPY.back">←</a>
      <div><h1>{{ COPY.title }}</h1><p>{{ COPY.hint }}</p></div>
      <span class="anime-enemy-count">{{ projects.length }} {{ COPY.enemies }}</span>
    </header>
    <section class="anime-gallery-scroll" :aria-label="COPY.title">
      <div class="anime-enemy-grid">
        <a v-for="(project, index) in projects" :key="project.enemyId" class="anime-enemy-card" :href="enemyDetailHref(project.enemyId)">
          <div class="anime-enemy-portrait">
            <img v-if="thumbnails[project.enemyId]" :src="thumbnails[project.enemyId]" :alt="`${project.name}${COPY.front}`" decoding="async">
            <span v-else class="anime-thumbnail-placeholder">{{ failed[project.enemyId] ? COPY.failed : COPY.loading }}</span>
            <span class="anime-enemy-number">{{ String(index + 1).padStart(2, '0') }}</span>
          </div>
          <h2>{{ project.name }}</h2>
        </a>
      </div>
      <button v-if="Object.keys(failed).length" class="anime-gallery-retry" type="button" @click="generateThumbnails">{{ COPY.retry }}</button>
    </section>
  </main>
</template>

<script setup>
import { markRaw, onBeforeUnmount, onMounted, ref } from 'vue'
import { createEnemyPreviewModels, enemyDetailHref } from '../animation/shadow-preview-models.js'
import { createEnemyThumbnailRenderer } from '../render/enemy-thumbnails.js'
import '../anime.css'

const COPY = Object.freeze({
  title: '\u654c\u4eba\u9884\u89c8', back: '\u8fd4\u56de\u9996\u9875', enemies: '\u4e2a\u654c\u4eba',
  hint: '\u6b63\u9762\u7ad9\u59ff\u00b7\u70b9\u51fb\u67e5\u770b\u4e09\u7ef4\u3001\u52a8\u4f5c\u4e0e\u90e8\u4ef6',
  front: '\u6b63\u9762\u56fe', loading: '\u52a0\u8f7d\u4e2d', failed: '\u7f29\u7565\u56fe\u52a0\u8f7d\u5931\u8d25', retry: '\u91cd\u8bd5\u7f29\u7565\u56fe',
})
const projects = markRaw(createEnemyPreviewModels())
const thumbnails = ref({}), failed = ref({})
let thumbnailRenderer = null, cancelled = false, generating = false

async function generateThumbnails() {
  if (generating) return
  generating = true
  failed.value = {}
  try {
    thumbnailRenderer = createEnemyThumbnailRenderer()
    for (const project of projects) {
      if (cancelled) break
      if (thumbnails.value[project.enemyId]) continue
      try {
        const image = await thumbnailRenderer.render(project)
        if (!cancelled && image) thumbnails.value[project.enemyId] = image
      } catch {
        if (!cancelled) failed.value[project.enemyId] = true
      }
      await new Promise(resolve => window.requestAnimationFrame(resolve))
    }
  } catch {
    if (!cancelled) for (const project of projects) if (!thumbnails.value[project.enemyId]) failed.value[project.enemyId] = true
  } finally {
    thumbnailRenderer?.dispose()
    thumbnailRenderer = null
    generating = false
  }
}

onMounted(() => {
  document.documentElement.classList.add('anime-html')
  document.body.classList.add('anime-body', 'anime-review-body')
  document.title = COPY.title
  generateThumbnails()
})
onBeforeUnmount(() => {
  cancelled = true
  thumbnailRenderer?.dispose()
  document.documentElement.classList.remove('anime-html')
  document.body.classList.remove('anime-body', 'anime-review-body')
})
</script>
