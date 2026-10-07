<script setup>
import { computed } from 'vue'

const props = defineProps({
  item: { type: Object, required: true },
  shape: { type: Array, default: null },
  gold: { type: Number, default: 0 },
})
const goldText = computed(() => String(props.gold))
const goldDigits = computed(() => Math.min(6, goldText.value.length))
const tierStyle = computed(() => {
  const shape = props.shape || props.item.shape || [[1]]
  const y = Math.max(0, shape.findIndex(row => row.some(Boolean)))
  const x = Math.max(0, shape[y].findIndex(Boolean))
  return { gridColumn: `${x + 1} / span 1`, gridRow: `${y + 1} / span 1` }
})
</script>

<template>
  <span v-if="item.id === 'money-pouch'" class="money-pouch-count" :data-digits="goldDigits" :aria-label="`${item.name}: ${gold}`" :title="`${item.name}: ${gold}`">{{ goldText }}</span>
  <span v-if="item.type === 'weapon' && item.tier" class="consumable-tier weapon-tier" :style="tierStyle" :title="'\u6b66\u5668\u7b49\u7ea7'">{{ ['', 'I', 'II', 'III'][item.tier] }}</span>
  <span v-if="item.tier && !['weapon', 'defense', 'potion'].includes(item.type)" class="consumable-tier" :style="tierStyle">{{ item.tier === 2 ? 'II' : 'I' }}</span>
</template>
