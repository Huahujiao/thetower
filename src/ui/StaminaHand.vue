<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { BALL_LABELS } from '../game/model/stamina-deck.js'
import StaminaFlame from './StaminaFlame.vue'

const props = defineProps({
  run: { type: Object, required: true },
  deck: { type: Object, required: true },
  balls: { type: Array, required: true },
  selected: { type: Array, required: true },
  highlighted: { type: Array, default: null },
  enabled: { type: Boolean, default: true },
  active: { type: Boolean, default: false },
  round: { type: Number, default: 0 },
})
defineEmits(['select'])
const timers = new Map()
const shiftTimers = new Map()
const subscriptions = []
let sequence = 0
const makeSlot = ball => ({ key: ++sequence, ball, spent: false, empty: false, selected: false, shiftDelay: 0, moving: false })
const slots = ref(props.active ? props.balls.map(makeSlot) : [])
const visibleSlots = computed(() => props.active && (props.balls.length || slots.value.some(slot => slot.spent)) ? slots.value : [])

const automaticIds = computed(() => props.active
  ? (props.highlighted ?? (props.selected.length ? [] : props.balls.slice(-1).map(ball => ball.id)))
  : [])
const displayedAutomaticIds = ref([])
const highlightedIds = computed(() => [...new Set([...displayedAutomaticIds.value, ...props.selected])])

watch([
  automaticIds,
  () => props.balls,
  () => slots.value.map(slot => [slot.key, slot.ball.id, slot.spent, slot.empty, slot.moving]),
], () => {
  const previous = new Set(displayedAutomaticIds.value)
  displayedAutomaticIds.value = automaticIds.value.filter(id => {
    const index = slots.value.findIndex(slot => !slot.spent && !slot.empty && slot.ball.id === id)
    if (index < 0) return false
    // Keep an existing highlight, but a new one waits for its ball to arrive.
    // Compare model order too: a spent neighbour may still be awaiting compaction.
    return previous.has(id) || (!slots.value[index].moving && index === props.balls.findIndex(ball => ball.id === id))
  })
}, { immediate: true })

function finishShift(key, event = null) {
  if (event && event.propertyName !== 'transform') return
  clearTimeout(shiftTimers.get(key)?.timer)
  shiftTimers.delete(key)
  const slot = slots.value.find(entry => entry.key === key)
  if (slot) slot.moving = false
}
function trackShift(slot) {
  clearTimeout(shiftTimers.get(slot.key)?.timer)
  shiftTimers.delete(slot.key)
  slot.moving = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!slot.moving) return
  const entry = {}
  shiftTimers.set(slot.key, entry)
  nextTick(() => {
    if (shiftTimers.get(slot.key) !== entry) return
    // Fallback for a missing transitionend: stagger + 200ms travel + cleanup margin.
    entry.timer = setTimeout(() => finishShift(slot.key), slot.shiftDelay + 250)
  })
}

function compact() {
  // Finish all pending extinguishes in place before sliding survivors left.
  if (slots.value.some(slot => slot.spent) || !slots.value.some(slot => slot.empty)) return
  let moving = 0
  const survivors = []
  slots.value.forEach((slot, previousIndex) => {
    if (slot.empty) return
    // Only flames that actually move join the left-to-right stagger.
    const moved = previousIndex > survivors.length
    slot.shiftDelay = moved ? moving++ * 100 : 0
    if (moved) trackShift(slot)
    survivors.push(slot)
  })
  slots.value = survivors
}
function finish(key) {
  clearTimeout(timers.get(key))
  timers.delete(key)
  const slot = slots.value.find(entry => entry.key === key)
  if (slot) { slot.spent = false; slot.empty = true }
  compact()
}
function clearTimers() {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
  for (const entry of shiftTimers.values()) clearTimeout(entry.timer)
  shiftTimers.clear()
}
function synchronize(balls) {
  const live = new Map(balls.map(ball => [ball.id, ball]))
  for (const slot of [...slots.value].sort((a, b) => Number(a.empty) - Number(b.empty))) {
    if (slot.spent) continue
    const ball = live.get(slot.ball.id)
    slot.empty = !ball
    if (ball) { slot.ball = ball; live.delete(ball.id) }
  }
  for (const ball of live.values()) {
    const vacant = slots.value.find(slot => slot.empty && !slot.spent)
    if (vacant) Object.assign(vacant, makeSlot(ball))
    else slots.value.push(makeSlot(ball))
  }
  // Refunds append to the hand and draws may refill a visual gap. Keep the
  // left-to-right live order identical to the model used for right-to-left payment.
  const order = new Map(balls.map((ball, index) => [ball.id, index]))
  const orderedLive = slots.value.filter(slot => !slot.spent && !slot.empty)
    .sort((a, b) => order.get(a.ball.id) - order.get(b.ball.id))
  let index = 0
  slots.value = slots.value.map(slot => {
    const next = slot.spent || slot.empty ? slot : orderedLive[index++]
    // Refund/draw reordering is separate from gap filling.
    if (next !== slot) { next.shiftDelay = 0; trackShift(next) }
    return next
  })
  compact()
}
function spend({ balls }) {
  if (!props.active) return
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  for (const ball of balls) {
    const slot = slots.value.find(entry => !entry.spent && !entry.empty && entry.ball.id === ball.id)
    if (!slot) continue
    if (still) { slot.empty = true; continue }
    slot.ball = { ...ball }
    slot.selected = highlightedIds.value.includes(ball.id)
    slot.spent = true
    // The spent ID remains in its own grid cell. No screen/local coordinate conversion.
    timers.set(slot.key, setTimeout(() => finish(slot.key), 550))
  }
  compact()
}
function refund({ balls }) {
  for (const ball of balls) {
    const slot = slots.value.find(entry => entry.spent && entry.ball.id === ball.id)
    if (!slot) continue
    clearTimeout(timers.get(slot.key))
    timers.delete(slot.key)
    slot.ball = ball
    slot.spent = false
    slot.empty = false
  }
  compact()
}
watch([() => props.deck, () => props.balls, () => props.round, () => props.active], ([deck, balls, round, active], [previousDeck, , previousRound, previousActive]) => {
  if (deck !== previousDeck || round !== previousRound || active !== previousActive) {
    clearTimers()
    slots.value = active ? balls.map(makeSlot) : []
  } else synchronize(balls)
})
onMounted(() => {
  subscriptions.push(props.run.on('stamina:spent', spend))
  subscriptions.push(props.run.on('stamina:refunded', refund))
})
onBeforeUnmount(() => {
  for (const unsubscribe of subscriptions) unsubscribe()
  clearTimers()
})
</script>

<template>
  <div class="stamina-hand" :style="{ '--ball-slots': Math.max(10, slots.length) }" aria-label="体力灵火">
    <span
      v-for="(slot, index) in visibleSlots" :key="slot.key" class="stamina-slot" :data-stamina-id="slot.ball.id"
      :style="{ '--slot-index': index, '--slot-shift-delay': slot.shiftDelay + 'ms', '--fire-delay': (-slot.key * .17) + 's' }" :aria-hidden="slot.spent || slot.empty ? 'true' : undefined"
      @transitionend.self="finishShift(slot.key, $event)"
    >
      <button
        v-if="!slot.spent && !slot.empty" type="button" class="stamina-ball"
        :class="[slot.ball.attribute, { selected: highlightedIds.includes(slot.ball.id), 'manual-selected': selected.includes(slot.ball.id) }]"
        :aria-label="BALL_LABELS[slot.ball.attribute] + '灵火' + (selected.includes(slot.ball.id) ? '，已手动选中，点击取消' : highlightedIds.includes(slot.ball.id) ? '，自动支付预览，点击优先支付' : '，点击优先支付')"
        :aria-pressed="highlightedIds.includes(slot.ball.id)" :disabled="!enabled"
        @click.stop="$emit('select', slot.ball.id)"
      >
        <StaminaFlame :attribute="slot.ball.attribute" :mark="slot.ball.mark || ''" />
        <svg v-if="highlightedIds.includes(slot.ball.id)" class="stamina-selection-arc" viewBox="0 0 32 10" aria-hidden="true">
          <path d="M7 2Q16 10 25 2" />
        </svg>
      </button>
      <span
        v-if="slot.spent" class="stamina-spend-effect" :class="{ selected: slot.selected }"
        :data-stamina-id="slot.ball.id" aria-hidden="true" @animationend.self="finish(slot.key)"
      ><StaminaFlame :attribute="slot.ball.attribute" :mark="slot.ball.mark || ''" /></span>
    </span>
    <span v-if="active && !balls.length && !slots.some(slot => slot.spent)" class="stamina-empty">灵火已用完</span>
  </div>
</template>
