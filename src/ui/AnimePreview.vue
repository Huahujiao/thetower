<template>
  <main class="anime-page anime-gallery-page">
    <header class="anime-topbar anime-gallery-topbar">
      <a class="anime-back" href="/" :aria-label="COPY.back">←</a>
      <div><h1>{{ COPY.title }}</h1><p>{{ COPY.hint }}</p></div>
      <div class="anime-gallery-controls">
        <span class="anime-enemy-count">{{ projects.length }} {{ COPY.enemies }}</span>
        <label class="anime-gallery-style">{{ COPY.style }}<select v-model="textureStyle" :aria-label="COPY.textureStyle" @change="changeTextureStyle"><option v-for="style in ENEMY_TEXTURE_STYLES" :key="style.id" :value="style.id">{{ style.label }}</option></select></label>
      </div>
    </header>
    <section class="anime-gallery-scroll" :aria-label="COPY.title">
      <div class="anime-enemy-grid">
        <a v-for="(project, index) in projects" :key="project.enemyId" class="anime-enemy-card" :href="enemyDetailHref(project.enemyId, textureStyle)">
          <div class="anime-enemy-portrait">
            <img v-if="!failed[project.enemyId]" :src="project.images[textureStyle].url" :alt="`${project.name}${COPY.front}`" :width="portraits.width" :height="portraits.height" :loading="index < 6 ? 'eager' : 'lazy'" decoding="async" @error="failed[project.enemyId] = true">
            <span v-else class="anime-thumbnail-placeholder">{{ COPY.failed }}</span>
            <span class="anime-enemy-number">{{ String(index + 1).padStart(2, '0') }}</span>
          </div>
          <h2>{{ project.name }}</h2>
        </a>
      </div>
      <button v-if="Object.keys(failed).length" class="anime-gallery-retry" type="button" @click="failed = {}">{{ COPY.retry }}</button>
    </section>
  </main>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { enemyDetailHref } from '../animation/enemy-preview-links.js'
import { ENEMY_TEXTURE_STYLES, normalizeEnemyTextureStyle } from '../animation/enemy-texture-styles.js'
import portraits from '../render/enemy-thumbnails.generated.json'
import '../anime.css'

const COPY = Object.freeze({
  title: '\u654c\u4eba\u9884\u89c8', back: '\u8fd4\u56de\u9996\u9875', enemies: '\u4e2a\u654c\u4eba',
  hint: '\u6b63\u9762\u7ad9\u59ff\u00b7\u70b9\u51fb\u67e5\u770b\u4e09\u7ef4\u3001\u52a8\u4f5c\u4e0e\u90e8\u4ef6',
  front: '\u6b63\u9762\u56fe', loading: '\u52a0\u8f7d\u4e2d', failed: '\u7f29\u7565\u56fe\u52a0\u8f7d\u5931\u8d25', retry: '\u91cd\u8bd5\u7f29\u7565\u56fe',
  style: '\u98ce\u683c', textureStyle: '\u8d34\u56fe\u98ce\u683c',
})
const projects = portraits.enemies
const textureStyle = ref(normalizeEnemyTextureStyle(new window.URLSearchParams(window.location.search).get('style')))
const failed = ref({})

function changeTextureStyle() {
  const url = new window.URL(window.location.href)
  if (textureStyle.value === 'original') url.searchParams.delete('style')
  else url.searchParams.set('style', textureStyle.value)
  window.history.replaceState(null, '', url)
  failed.value = {}
}

onMounted(() => {
  document.documentElement.classList.add('anime-html')
  document.body.classList.add('anime-body', 'anime-review-body')
  document.title = COPY.title
})
onBeforeUnmount(() => {
  document.documentElement.classList.remove('anime-html')
  document.body.classList.remove('anime-body', 'anime-review-body')
})
</script>
