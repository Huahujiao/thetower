<script setup>
defineProps({
  cost: { type: [Number, String], required: true },
  attribute: { type: String, default: 'wild' },
})
</script>

<template>
  <span class="stamina-cost"><i class="stamina-ball-icon" :class="attribute" aria-hidden="true"></i><span>{{ cost }}</span></span>
</template>
