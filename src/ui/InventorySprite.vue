<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  sources: { type: Object, required: true },
  itemIndex: { type: Number, required: true },
  alt: { type: String, default: '' },
  style: { type: Object, default: undefined },
})

const src = ref(props.sources.small)
const timers = new Set()

function clearTimers() {
  for (const timer of timers) window.clearTimeout(timer)
  timers.clear()
}

function queueUpgrade(url, nextUrl, delay) {
  if (!url) return
  const timer = window.setTimeout(() => {
    timers.delete(timer)
    const preloader = document.createElement('img')
    preloader.decoding = 'async'
    const finish = async (loaded) => {
      if (loaded) {
        try {
          await preloader.decode?.()
        } catch {
          // The load event is still usable on browsers without decode support.
        }
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
  <img
    class="bag-sprite"
    :data-bag-item="itemIndex"
    :src="src"
    :alt="alt"
    aria-hidden="true"
    draggable="false"
    decoding="async"
    fetchpriority="low"
    :style="style"
  />
</template>
