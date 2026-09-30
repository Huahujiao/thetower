<script setup>
defineProps({ item: { type: Object, required: true }, gold: { type: Number, default: 0 } })
</script>

<template>
  <span v-if="item.id === 'money-pouch'" class="money-pouch-circle" :aria-label="`${item.name}: ${gold}`">{{ gold }}</span>
  <span v-else-if="item.type === 'defense'" class="item-value-badge defense-value" :title="'\u62a4\u7532\u503c'">{{ item.armorValue || 1 }}</span>
  <span v-else-if="item.type === 'energy'" class="item-value-badge food-value" :title="'\u5269\u4f59\u98df\u7269\u70b9\u6570'">{{ item.energy }}</span>
  <span v-else-if="item.type === 'potion'" class="item-value-badge food-value" :title="'\u5269\u4f59\u6cbb\u7597\u70b9\u6570'">{{ item.heal }}</span>
  <span v-if="item.tier && !['weapon', 'defense'].includes(item.type)" class="consumable-tier">{{ item.tier === 2 ? 'II' : 'I' }}</span>
</template>
