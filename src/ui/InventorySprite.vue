<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  sources: { type: Object, required: true },
  // Only backpack and staging sprites take part in cell hit testing; the detail
  // panel and wiki pass nothing so no stray [data-bag-item] target appears.
  itemIndex: { type: Number, default: null },
  spriteClass: { type: String, default: 'bag-sprite' },
  alt: { type: String, default: '' },
  style: { type: Object, default: undefined },
})

const src = ref(props.sources.small)
const timers = new Set()
const frame = computed(() => props.sources.bounds?.[src.value === props.sources.medium ? 'medium' : 'small'])
const viewBox = computed(() => frame.value ? frame.value.slice(2).join(' ') : undefined)
let generation = 0

function clearTimers() {
  generation++
  for (const timer of timers) window.clearTimeout(timer)
  timers.clear()
}

function queueUpgrade(url, nextUrl, delay) {
  if (!url) return
  const currentGeneration = generation
  const timer = window.setTimeout(() => {
    timers.delete(timer)
    const preloader = document.createElement('img')
    preloader.decoding = 'async'
    const finish = async (loaded) => {
      if (currentGeneration !== generation) return
      if (loaded) {
        try {
          await preloader.decode?.()
        } catch {
          // The load event is still usable on browsers without decode support.
        }
        if (currentGeneration !== generation) return
        src.value = url
      }
      if (nextUrl) queueUpgrade(nextUrl, '', 160)
    }
    preloader.addEventListener('load', () => finish(true), { once: true })
    preloader.addEventListener('error', () => finish(false), { once: true })
    preloader.src = url
  }, delay)
  timers.add(timer)
}

function startUpgrade() {
  clearTimers()
  src.value = props.sources.small
  queueUpgrade(props.sources.medium, '', 80)
}

onMounted(startUpgrade)
watch(() => props.sources.medium, startUpgrade)
onBeforeUnmount(clearTimers)
</script>

<template>
  <svg
    :class="spriteClass"
    :data-bag-item="itemIndex ?? undefined"
    :viewBox="viewBox"
    :aria-label="alt"
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
    draggable="false"
    :style="style"
  >
    <image :href="src" :width="frame?.[0] || '100%'" :height="frame?.[1] || '100%'" preserveAspectRatio="xMidYMid meet" />
  </svg>
</template>
