<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import BackpackGrid from './BackpackGrid.vue'
import { buildWikiInventory, WIKI_ITEM_COLUMNS } from './wiki-items.js'
import { detailForItem } from '../game/data/item-details.js'
import { getItemDefinition, upgradeRecipesForItem } from '../game/data/content.js'
import { BALL_LABELS } from '../game/model/stamina-deck.js'
import { itemUnlockFloor } from './wiki-data.js'
import { itemSpriteSources } from './item-sprites.js'

const inventory = buildWikiInventory()
const selected = ref(null)
const viewport = ref(null)
let observer
const entries = computed(() => inventory.entries.map(entry => ({
  ...entry,
  itemClasses: [...entry.itemClasses, ...(entry.item.id === selected.value?.id ? ['selected'] : [])],
})))
const cells = computed(() => inventory.cells.map(cell => ({
  ...cell, selected: !!selected.value && inventory.itemByCell.get(cell.index)?.id === selected.value.id,
})))
const detail = computed(() => selected.value ? detailForItem(selected.value) : null)
const sources = computed(() => selected.value && itemSpriteSources(selected.value))
const sourceLine = computed(() => {
  const item = selected.value
  if (!item) return ''
  if (item.starterOnly) return '开局自带'
  if (item.generatedOnly) return '由物品效果生成'
  if (item.type === 'weapon' && item.tier > 1) return `合成或商店获得 · 第${itemUnlockFloor(item)}层解锁`
  return `第${itemUnlockFloor(item)}层解锁`
})
const recipes = computed(() => upgradeRecipesForItem(selected.value?.id).map(recipe => ({
  ...recipe, parts: [recipe.a, recipe.b, recipe.result].map(id => {
    const item = getItemDefinition(id)
    return { id, name: item.name, src: itemSpriteSources(item)?.small }
  }),
})))
function selectCell(index) {
  const item = inventory.itemByCell.get(index)
  if (item) selected.value = item
}
onMounted(() => {
  const resize = () => viewport.value?.style.setProperty('--wiki-cell', `${(viewport.value.clientWidth - 14) / 8}px`)
  observer = new window.ResizeObserver(resize)
  observer.observe(viewport.value)
  resize()
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="wiki-item-stage">
    <section v-if="detail" class="wiki-item-detail detail-panel" aria-label="物品详情" aria-live="polite">
      <div class="detail-card">
        <button class="wiki-detail-close" aria-label="关闭详情" @click="selected = null">×</button>
        <div class="detail-icon"><img v-if="sources" class="detail-sprite" :src="sources.medium" :alt="detail.title" draggable="false"></div>
        <div class="detail-content">
          <div class="detail-head">
            <h2 class="detail-title">{{ detail.title }}</h2>
            <div class="detail-badges"><span>{{ detail.type }}</span><span v-for="badge in detail.badges" :key="badge">{{ badge }}</span></div>
          </div>
          <div class="detail-stat-lines"><div v-for="line in detail.statLines" :key="line">{{ line }}</div></div>
          <div class="detail-effect-lines"><div v-for="line in detail.effectLines" :key="line">{{ line }}</div></div>
          <p class="detail-description">{{ detail.description }}</p>
          <p v-if="selected.type === 'weapon'" class="detail-description">消耗 {{ selected.energyCost }} 个{{ BALL_LABELS[selected.attribute] }}球；万能球可替代，不足时按支付比例降低伤害。</p>
          <p class="wiki-item-source">{{ sourceLine }} · 占 {{ selected.shape.flat().filter(Boolean).length }} 格</p>
        </div>
        <div v-if="recipes.length" class="wiki-item-recipes">
          <div v-for="recipe in recipes" :key="recipe.result + recipe.b" class="wiki-item-recipe">
            <template v-for="(part, i) in recipe.parts" :key="i">
              <span v-if="i" aria-hidden="true">{{ i === 1 ? '+' : '→' }}</span>
              <button :aria-label="part.name" :title="part.name" @click="selected = inventory.entries.find(entry => entry.item.id === part.id)?.item || selected">
                <img :src="part.src" :alt="part.name" draggable="false">
              </button>
            </template>
          </div>
        </div>
      </div>
    </section>
    <div ref="viewport" class="wiki-inventory-viewport" aria-label="物品清单背包，八列八行视窗" tabindex="0">
      <BackpackGrid :columns="WIKI_ITEM_COLUMNS" :rows="inventory.rows" :cells="cells" :items="entries" :links="[]" @cell-click="selectCell">
        <div v-for="header in inventory.headers" :key="header.id" class="wiki-inventory-category" :data-category="header.id" :style="{ gridRow: header.row + 1, gridColumn: '1 / -1' }">{{ header.name }}<span>{{ header.count }}</span></div>
      </BackpackGrid>
    </div>
  </div>
</template>
