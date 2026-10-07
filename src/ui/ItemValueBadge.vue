<script setup>
import { computed } from 'vue'

const props = defineProps({ item: { type: Object, required: true }, gold: { type: Number, default: 0 } })
const goldText = computed(() => String(props.gold))
const goldDigits = computed(() => Math.min(6, goldText.value.length))
</script>

<template>
  <span v-if="item.id === 'money-pouch'" class="money-pouch-count" :data-digits="goldDigits" :aria-label="`${item.name}: ${gold}`" :title="`${item.name}: ${gold}`">{{ goldText }}</span>
  <span v-if="item.type === 'weapon' && item.tier" class="consumable-tier weapon-tier" :title="'\u6b66\u5668\u7b49\u7ea7'">{{ ['', 'I', 'II', 'III'][item.tier] }}</span>
  <span v-if="item.tier && !['weapon', 'defense', 'potion'].includes(item.type)" class="consumable-tier">{{ item.tier === 2 ? 'II' : 'I' }}</span>
</template>
