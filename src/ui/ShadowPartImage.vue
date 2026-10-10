<template>
  <div class="anime-part-image" role="img" :aria-label="part.name">
    <canvas v-show="loaded" ref="canvas" width="320" height="240"></canvas>
    <span v-if="!loaded">{{ error ? '\u8d34\u56fe\u52a0\u8f7d\u5931\u8d25' : '\u52a0\u8f7d\u4e2d' }}</span>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({ part: { type: Object, required: true } })
const canvas = ref(null), loaded = ref(false), error = ref(false)
let image = null
function draw() {
  if (!canvas.value) return
  if (image) { image.onload = null; image.onerror = null }
  loaded.value = false; error.value = false
  const texture = props.part.visual.texture
  if (!texture) { error.value = true; return }
  const frame = props.part.visual.textureFrame
  const crop = frame?.crop || { left: 0, top: 0, width: 1, height: 1 }
  image = new Image()
  image.onload = () => {
    const width = image.naturalWidth / (frame?.columns || 1), height = image.naturalHeight / (frame?.rows || 1)
    const sw = crop.width * width, sh = crop.height * height
    const context = canvas.value.getContext('2d')
    context.clearRect(0, 0, 320, 240)
    const scale = Math.min(296 / sw, 216 / sh)
    context.drawImage(image, ((frame?.column || 0) + crop.left) * width, ((frame?.row || 0) + crop.top) * height,
      sw, sh, (320 - sw * scale) / 2, (240 - sh * scale) / 2, sw * scale, sh * scale)
    loaded.value = true
  }
  image.onerror = () => { error.value = true }
  image.src = texture
}
watch(() => props.part, draw)
onMounted(draw)
onBeforeUnmount(() => { if (image) { image.onload = null; image.onerror = null } })
</script>
