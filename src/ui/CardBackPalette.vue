<template>
  <fieldset class="settings-palette">
    <legend>封印迷雾配色</legend>
    <p class="settings-palette-note">点击色块选色 · 实时预览，自动保存</p>
    <div v-for="option in CARD_BACK_COLOR_OPTIONS" :key="option.kind" class="settings-palette-row">
      <label :for="'card-back-color-' + option.kind">{{ option.label }}</label>
      <button :id="'card-back-color-' + option.kind" type="button" class="settings-palette-trigger"
        :aria-label="option.label + '选择颜色'" aria-haspopup="dialog"
        :aria-expanded="pickerOpen && active === option.kind" :aria-controls="pickerOpen && active === option.kind ? 'card-back-color-popup' : undefined"
        @click="togglePicker(option.kind, $event.currentTarget)">
        <span :style="{ backgroundColor: palette[option.kind] }" /><span class="settings-palette-chevron">⌄</span>
      </button>
      <input type="text" class="settings-palette-hex" maxlength="7" spellcheck="false" autocomplete="off"
        :value="draft[option.kind]" :aria-label="option.label + '色值'"
        :aria-invalid="!normalizeCardBackColor(draft[option.kind])"
        @input="editHex(option.kind, $event.target.value)" @blur="finishHex(option.kind)" @keydown.enter="$event.target.blur()">
    </div>
    <button type="button" class="settings-palette-reset" :disabled="!changed" @click="$emit('change', { ...CARD_BACK_COLOR_DEFAULTS })">恢复默认配色</button>
    <p v-if="!saved" class="settings-palette-note" role="status">本次已应用，暂时无法保存到本机</p>
  </fieldset>
  <Teleport to="body">
    <div v-if="pickerOpen" id="card-back-color-popup" ref="popup" class="settings-palette-popover" role="dialog"
      :aria-label="activeLabel + '颜色选择器'" :style="popupStyle" @pointerdown.stop @click.stop>
      <div class="settings-palette-popover-title"><span>{{ activeLabel }}</span><button type="button" aria-label="关闭颜色选择器" @click="closePicker(true)">×</button></div>
    <div class="settings-palette-surface" tabindex="0" role="group"
      :aria-label="activeLabel + '调色盘，左右调整饱和度，上下调整明度'"
      :style="{ backgroundColor: 'hsl(' + hsv.h + ', 100%, 50%)' }"
      @pointerdown.stop.prevent="startPick" @pointermove.stop="movePick"
      @pointerup.stop="endPick" @pointercancel="endPick" @lostpointercapture="dragPointer = null"
      @keydown="keyPick">
      <span class="settings-palette-cursor" :style="{ left: hsv.s + '%', top: (100 - hsv.v) + '%', backgroundColor: activeColor }" />
    </div>
    <label class="settings-palette-hue-label" for="card-back-hue">色相</label>
    <input id="card-back-hue" class="settings-palette-hue" type="range" min="0" max="360" step="1"
      :value="hsv.h" :aria-label="activeLabel + '色相'" @input="setHue($event.target.value)">
    <div class="settings-palette-value">
      <span class="settings-palette-swatch" :style="{ backgroundColor: activeColor }" />
      <label for="card-back-popup-hex">{{ activeLabel }}</label>
      <input id="card-back-popup-hex" type="text" class="settings-palette-hex" maxlength="7" spellcheck="false" autocomplete="off"
        :value="draft[active]" :aria-label="activeLabel + '色值'"
        :aria-invalid="!normalizeCardBackColor(draft[active])"
        @input="editHex(active, $event.target.value)" @blur="finishHex(active)" @keydown.enter="$event.target.blur()">
    </div>

    </div>
  </Teleport>
</template>
<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { CARD_BACK_COLOR_DEFAULTS, CARD_BACK_COLOR_OPTIONS, normalizeCardBackColor } from '../settings/card-back-palette.js'
const props = defineProps({ palette: { type: Object, required: true }, saved: { type: Boolean, default: true } })
const emit = defineEmits(['change'])
const active = ref('scorch')
const pickerOpen = ref(false)
const popup = ref(null)
const popupStyle = ref({})
let trigger = null
async function togglePicker(kind, element) {
  if (pickerOpen.value && active.value === kind) { closePicker(); return }
  active.value = kind
  trigger = element
  pickerOpen.value = true
  await nextTick()
  if (!popup.value) return
  const rect = element.getBoundingClientRect(), box = popup.value.getBoundingClientRect()
  const left = Math.max(8, Math.min(window.innerWidth - box.width - 8, rect.right - box.width))
  const below = rect.bottom + 8
  const top = below + box.height <= window.innerHeight - 8 ? below : Math.max(8, rect.top - box.height - 8)
  popupStyle.value = { left: left + 'px', top: top + 'px' }
  popup.value.querySelector('.settings-palette-surface')?.focus({ preventScroll: true })
}
function closePicker(restoreFocus = false) {
  pickerOpen.value = false
  dragPointer.value = null
  if (restoreFocus) trigger?.focus({ preventScroll: true })
}
function outsidePick(event) {
  if (!event.target.closest?.('.settings-palette-trigger, .settings-palette-popover')) closePicker()
}
function escapePick(event) {
  if (pickerOpen.value && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePicker(true) }
}
function layoutChanged() { closePicker() }
onMounted(() => {
  document.addEventListener('pointerdown', outsidePick)
  document.addEventListener('keydown', escapePick, true)
  window.addEventListener('resize', layoutChanged)
  window.addEventListener('scroll', layoutChanged, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outsidePick)
  document.removeEventListener('keydown', escapePick, true)
  window.removeEventListener('resize', layoutChanged)
  window.removeEventListener('scroll', layoutChanged, true)
})
const activeLabel = computed(() => CARD_BACK_COLOR_OPTIONS.find(option => option.kind === active.value).label)
const activeColor = computed(() => props.palette[active.value])
const draft = reactive({ ...props.palette })
const hsv = reactive({ h: 0, s: 0, v: 0 })
const dragPointer = ref(null)
const changed = computed(() => CARD_BACK_COLOR_OPTIONS.some(({ kind }) => props.palette[kind] !== CARD_BACK_COLOR_DEFAULTS[kind]))
watch(() => props.palette, colors => Object.assign(draft, colors))
watch([active, activeColor], ([kind, color], previous) => {
  // Preserve the chosen hue/saturation at black or grey while dragging.
  if (previous?.[0] === kind && hsvHex() === color) return
  const [r, g, b] = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255)
  const high = Math.max(r, g, b), low = Math.min(r, g, b), delta = high - low
  if (delta) hsv.h = ((high === r ? (g - b) / delta : high === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60 + 360) % 360
  hsv.s = high ? delta / high * 100 : 0
  hsv.v = high * 100
}, { immediate: true })
function hsvHex() {
  const h = hsv.h / 60, s = hsv.s / 100, v = hsv.v / 100
  const channel = n => {
    const k = (n + h) % 6
    return Math.round(255 * v * (1 - s * Math.max(0, Math.min(k, 4 - k, 1)))).toString(16).padStart(2, '0')
  }
  return '#' + channel(5) + channel(3) + channel(1)
}
function pickColor(kind, value) {
  const color = normalizeCardBackColor(value)
  if (color) { draft[kind] = color; emit('change', { ...props.palette, [kind]: color }) }
}
function setHue(value) { hsv.h = Number(value); pickColor(active.value, hsvHex()) }
function pickPoint(event) {
  const rect = event.currentTarget.getBoundingClientRect()
  hsv.s = Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100))
  hsv.v = Math.max(0, Math.min(100, (1 - (event.clientY - rect.top) / rect.height) * 100))
  pickColor(active.value, hsvHex())
}
function startPick(event) {
  if (!event.isPrimary || event.button !== 0 || dragPointer.value !== null) return
  dragPointer.value = event.pointerId
  event.currentTarget.focus({ preventScroll: true })
  event.currentTarget.setPointerCapture(event.pointerId)
  pickPoint(event)
}
function movePick(event) { if (event.pointerId === dragPointer.value) pickPoint(event) }
function endPick(event) {
  if (event.pointerId !== dragPointer.value) return
  if (event.type === 'pointerup') pickPoint(event)
  dragPointer.value = null
  if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
}
function keyPick(event) {
  const step = event.shiftKey ? 10 : 1
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
  event.preventDefault(); event.stopPropagation()
  if (event.key === 'ArrowLeft') hsv.s = Math.max(0, hsv.s - step)
  if (event.key === 'ArrowRight') hsv.s = Math.min(100, hsv.s + step)
  if (event.key === 'ArrowUp') hsv.v = Math.min(100, hsv.v + step)
  if (event.key === 'ArrowDown') hsv.v = Math.max(0, hsv.v - step)
  pickColor(active.value, hsvHex())
}
function editHex(kind, value) {
  draft[kind] = value
  const color = normalizeCardBackColor(value)
  if (color && value.trim().replace(/^#/, '').length === 6) emit('change', { ...props.palette, [kind]: color })
}
function finishHex(kind) {
  const color = normalizeCardBackColor(draft[kind])
  if (color) { draft[kind] = color; emit('change', { ...props.palette, [kind]: color }) }
  else draft[kind] = props.palette[kind]
}
</script>
