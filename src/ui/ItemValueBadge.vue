<script setup>
import { computed } from 'vue'

const props = defineProps({ item: { type: Object, required: true }, gold: { type: Number, default: 0 } })
const goldText = computed(() => String(props.gold))
const goldDigits = computed(() => Math.min(6, goldText.value.length))
</script>

<template>
  <span v-if="item.id === 'money-pouch'" class="money-pouch-count" :data-digits="goldDigits" :aria-label="`${item.name}: ${gold}`" :title="`${item.name}: ${gold}`">{{ goldText }}</span>
  <span v-else-if="item.type === 'defense'" class="item-value-badge defense-value" :title="'\u62a4\u7532\u503c'">{{ item.armorValue || 1 }}</span>
  <span v-else-if="item.type === 'potion'" class="item-value-badge food-value" :title="'\u5269\u4f59\u6cbb\u7597\u70b9\u6570'">{{ item.heal }}</span>
  <span v-if="item.type === 'weapon' && item.tier" class="consumable-tier weapon-tier" :title="'\u6b66\u5668\u7b49\u7ea7'">{{ ['', 'I', 'II', 'III'][item.tier] }}</span>
  <span v-if="item.tier && !['weapon', 'defense'].includes(item.type)" class="consumable-tier">{{ item.tier === 2 ? 'II' : 'I' }}</span>
</template>
