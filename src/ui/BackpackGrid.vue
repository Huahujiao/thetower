<template>
  <div ref="grid" class="backpack-grid" data="backpack" :style="{ '--bag-columns': columns, '--bag-rows': rows }">
    <button
      v-for="cell in cells" :key="`cell-${cell.index}`" class="bag-cell"
      :class="{ 'drop-valid': cell.action === 'move', 'drop-replace': cell.action === 'replace', 'drop-blocked': cell.action === 'blocked', 'drop-conflict': cell.action === 'replace-conflict', 'selected-cell': cell.selected }"
      :data-bag-cell="cell.index" :aria-label="cell.label"
      :style="{ gridColumn: cell.index % columns + 1, gridRow: Math.floor(cell.index / columns) + 1 }"
      @click.stop="emit('cell-click', cell.index)"
    ></button>
    <div
      v-for="entry in items" :key="entry.item.uid" :class="entry.itemClasses"
      :data-bag-item="entry.originIndex" :style="entry.itemStyle"
      @touchstart.stop="emit('item-touchstart', entry.originIndex, $event)"
      @touchmove.stop="emit('item-touchmove', $event)"
      @touchend.stop="emit('item-touchend', $event)"
      @touchcancel.stop="emit('item-touchcancel', $event)"
      @contextmenu.prevent
    >
      <span class="bag-shape" :style="entry.shapeStyle">
        <InventorySprite
          v-if="entry.spriteSources" :sources="entry.spriteSources"
          :item-index="entry.originIndex" :style="entry.spriteStyle"
          @click.stop="emit('cell-click', entry.originIndex)" @contextmenu.prevent
        /><span
          v-for="cell in entry.cells" :key="cell.index" class="occupied"
          :data-bag-item="cell.index" :style="cell.style"
          @click.stop="emit('cell-click', cell.index)"
        ><i v-for="edge in cell.edgeNames" :key="edge" class="shape-edge" :class="`edge-${edge}`" aria-hidden="true"></i></span>
        <b v-if="entry.nameStyle" class="bag-name" :style="entry.nameStyle">{{ entry.item.name }}</b>
        <small v-if="entry.detailStyle" class="bag-detail" :style="entry.detailStyle">{{ entry.detail }}</small>
      </span>
    </div>
    <div v-if="links.length" class="bag-adjacency-links" aria-hidden="true">
      <i v-for="link in links" :key="link.key" class="bag-adjacency-flow" :class="link.orientation" :style="link.style">
        <span class="bag-adjacency-layer back"></span>
        <span class="bag-adjacency-layer mid"></span>
        <span class="bag-adjacency-layer front"></span>
      </i>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import InventorySprite from './InventorySprite.vue'

defineProps({
  columns: { type: Number, required: true },
  rows: { type: Number, required: true },
  cells: { type: Array, required: true },
  items: { type: Array, required: true },
  links: { type: Array, required: true },
})
const emit = defineEmits(['cell-click', 'item-touchstart', 'item-touchmove', 'item-touchend', 'item-touchcancel'])
const grid = ref(null)
defineExpose({ getBoundingClientRect: () => grid.value?.getBoundingClientRect() })
</script>
