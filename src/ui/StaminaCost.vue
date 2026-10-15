<script setup>
import StaminaFlame from './StaminaFlame.vue'

defineProps({
  cost: { type: [Number, String], required: true },
  attribute: { type: String, default: 'wild' },
})
</script>

<template>
  <span class="stamina-cost"><StaminaFlame class="stamina-ball-icon" :attribute="attribute" /><span>{{ cost }}</span></span>
</template>
