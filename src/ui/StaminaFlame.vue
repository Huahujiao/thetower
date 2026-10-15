<script setup>
import { useId } from 'vue'

defineProps({
  attribute: { type: String, default: 'wild' },
  mark: { type: String, default: '' },
})
const id = useId()
const washId = id + '-fire-wash'
const brushId = id + '-fire-brush'
</script>

<template>
  <svg class="spirit-fire" :class="attribute" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient :id="washId" x1="17" y1="3" x2="15" y2="30" gradientUnits="userSpaceOnUse">
        <stop stop-color="var(--fire-light)" stop-opacity=".12" />
        <stop offset=".3" stop-color="var(--fire-color)" stop-opacity=".7" />
        <stop offset=".68" stop-color="var(--fire-color)" stop-opacity="1" />
        <stop offset="1" stop-color="var(--fire-color)" stop-opacity=".45" />
      </linearGradient>
      <filter :id="brushId" x="-25%" y="-15%" width="150%" height="135%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".36 .52" numOctaves="2" seed="7" result="grain" />
        <feDisplacementMap in="SourceGraphic" in2="grain" scale="1.3" xChannelSelector="R" yChannelSelector="G" result="uneven" />
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  .55 0 0 0 .65" result="dryBrush" />
        <feComposite in="uneven" in2="dryBrush" operator="in" />
      </filter>
    </defs>
    <path class="spirit-fire-glow" d="M15 28C7 28 5 23 9 17c4-5 3-9 7-13 0 6 6 10 6 15 3 5 0 10-7 9Z" fill="var(--fire-color)" opacity=".24" />
    <g class="spirit-fire-plume">
      <g :filter="'url(#' + brushId + ')'" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15.5 28.4C8.2 28.5 5.4 23.8 7.7 18.8 8.8 16.5 10.6 15.5 10.8 12.2c1.5 1 1.7 3.4 1.2 5.1C15.4 13.2 12.7 8 16.2 3.3c-.3 5.8 5.5 8.6 5.3 13-.1 2.2-1.5 3.3-1 5.1 1.6-.5 2.5-1.7 2.8-3.8 2.9 5.6-.1 11.2-7.8 10.8Z" :fill="'url(#' + washId + ')'" />
        <path d="M15.1 27.2c-4.3-3.2-.6-6.4 1.3-9.1 1.5-4.1-2.2-7.7-.1-13.5M20.2 26.4c4.2-5.3-2.7-7.5-.5-12.7" stroke="var(--fire-light)" stroke-width="1.6" opacity=".58" />
        <path d="M13.9 27c-2.6-2.2-.6-4.5.5-6.1 1.3-1.9 1.7-3.1.9-4.8M10.7 24.4c-1.2-2.2 1-4.2 1.4-6.2" stroke="var(--fire-shadow)" stroke-width=".9" opacity=".55" />
        <path d="M15.4 26.7c-1.5-1.7.1-3.5 1.1-4.8.9-1.2 1.1-2.4.8-3.6 2 2.4.2 3.8.7 5.2.6-.2 1.2-.9 1.4-1.6.6 2.2-1 4.7-4 4.8Z" fill="var(--fire-core)" opacity=".8" />
        <path d="M8.8 25.8c-2.4-2.8-.7-5.1.5-6.8M23.5 22.3c1.5-1.9.9-3.6.4-4.9" stroke="var(--fire-color)" stroke-width=".7" opacity=".45" />
      </g>
      <g class="spirit-fire-mark" fill="var(--fire-mark)">
        <slot name="mark">
          <text v-if="mark" x="16" y="22" text-anchor="middle" dominant-baseline="central" font-family="serif" font-size="10">{{ mark }}</text>
        </slot>
      </g>
    </g>
    <ellipse class="spirit-fire-ember" cx="16" cy="26.5" rx="2.7" ry="1.2" fill="var(--fire-core)" />
    <g class="spirit-fire-smoke" stroke="#bcc4ad" stroke-linecap="round" fill="none">
      <path d="M16 27c-2-2 2-4 1-6s-3-3-1-6" stroke-width="1.2" />
      <path d="M20 26c2-2-1-3 0-5" stroke-width=".7" opacity=".5" />
    </g>
  </svg>
</template>
