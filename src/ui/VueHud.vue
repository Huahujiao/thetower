<template>
  <div
    class="vue-hud-root"
  >
    <div class="hud-top">
      <div class="hud-stats">
        <div class="stat floor">
          <span class="label">{{ LABELS.floor }}</span><span class="value">{{
            state.currentRoom?.floor || '' }}</span>
        </div>
        <div class="stat level">
          <span class="label">{{ LABELS.level }}</span><span class="value">{{ state.player.level
          }}</span>
        </div>
      </div>
      <div class="hud-btns">
        <button
          type="button" class="hud-icon" data-action="craft-open" :disabled="!craftAvailable"
          :title="LABELS.craft" :aria-label="LABELS.craft" @click="handleAction('craft-open')"
        >
          <svg
            viewBox="0 0 24 24" width="18" height="18" fill="none"
            stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
          >
            <path d="m14 3 7 7-4 4-7-7zM12 12 3 21M4 3v6M1 6h6" />
          </svg>
        </button><button
          class="hud-icon" data-action="character"
          :title="LABELS.character" :aria-label="LABELS.character" @click="handleAction('character')"
        >
          ♙
        </button><button
          class="hud-icon" data-action="help"
          :title="LABELS.help" :aria-label="LABELS.help" @click="handleAction('help')"
        >
          ?
        </button><button
          class="hud-icon" data-action="settings"
          :title="LABELS.settings" :aria-label="LABELS.settings" @click="handleAction('settings')"
        >
          ⚙
        </button><button
          class="hud-icon" data-action="log"
          :title="LABELS.log" :aria-label="LABELS.log" @click="handleAction('log')"
        >
          ▤
        </button>
      </div>
    </div>
    <div class="experience-bar-row" :aria-label="LABELS.experience">
      <div class="experience-bar">
        <span
          class="experience-fill"
          :style="{ width: `${experienceProgress}%` }"
        ></span><span class="experience-value">{{ state.player.experience
        }}/{{ state.player.experienceToNext }}</span>
      </div>
    </div>
    <div id="app" ref="sceneContainer" :class="{ 'scene-battle-active': state.battle.active }" aria-label="game board">
      <section v-if="statusEntries.length" class="scene-status-tray" :aria-label="LABELS.status">
        <button
          v-for="entry in statusEntries" :key="entry.id" type="button"
          class="scene-status-icon" :class="entry.tone" :aria-label="entry.name"
          @touchstart.stop.prevent="onStatusTouchStart(entry, $event)"
          @touchmove.stop="onTouchMove"
          @touchend.stop="onTouchEnd"
          @touchcancel.stop="onTouchCancel"
          @contextmenu.prevent
        >
          <img
            v-if="entry.icon" :src="entry.icon" alt="" aria-hidden="true"
            draggable="false" decoding="async"
          ><span v-else>{{ entry.glyph }}</span><b v-if="entry.badge">{{ entry.badge }}</b>
        </button>
      </section>
    </div>
    <section
      v-if="inventoryStagingVisible" class="inventory-staging" :class="{ dragging: !!bagGesture?.dragging }"
      aria-label="inventory staging area"
    >
      <div
        ref="discardZone" class="inventory-discard-zone" :class="{ active: bagGesture?.dragging }"
        @touchmove.stop.prevent="onStageTouchMove" @touchend.stop.prevent="onStageTouchEnd" @contextmenu.prevent
      >
        {{ LABELS.discardZone }}
      </div>
      <div
        ref="stashZone" class="inventory-stash-zone" :class="{ active: bagGesture?.dragging }"
        @touchmove.stop.prevent="onStageTouchMove" @touchend.stop.prevent="onStageTouchEnd" @contextmenu.prevent
      >
        <span class="inventory-zone-label">{{ LABELS.stashZone }}</span>
        <div
          v-for="entry in stashItems" :key="entry.item.uid" class="stash-item"
          :class="entry.itemClasses" :style="entry.itemStyle"
          @touchstart.stop.prevent="onStashTouchStart(entry.item, $event)"
          @touchmove.stop.prevent="onStashTouchMove($event)"
          @touchend.stop.prevent="onStashTouchEnd($event)"
          @touchcancel.stop.prevent="onStashTouchCancel($event)" @contextmenu.prevent
        >
          <span class="bag-shape" :style="entry.shapeStyle">
            <ItemValueBadge :item="{ ...entry.item }" :shape="entry.shape" :gold="state.player.gold" />
            <InventorySprite
              v-if="entry.spriteSources" :sources="entry.spriteSources" :item-index="-1"
              :style="entry.spriteStyle" @contextmenu.prevent
            /><span
              v-for="cell in entry.cells" :key="cell.index" class="occupied" :style="cell.style"
            ></span>
            <b v-if="!entry.spriteSources && entry.item.id !== 'money-pouch'" class="bag-name staging-name">{{ entry.item.name }}</b>
          </span>
        </div>
      </div>
      <div
        v-if="draggedItemView" class="inventory-drag-preview" :class="draggedItemView.itemClasses"
        :style="draggedItemView.previewStyle"
      >
        <span class="bag-shape" :style="draggedItemView.shapeStyle">
          <ItemValueBadge :item="{ ...draggedItemView.item }" :shape="draggedItemView.shape" :gold="state.player.gold" />
          <InventorySprite
            v-if="draggedItemView.spriteSources" :sources="draggedItemView.spriteSources" :item-index="-1"
            :style="draggedItemView.spriteStyle" @contextmenu.prevent
          /><span
            v-for="cell in draggedItemView.cells" :key="cell.index" class="occupied" :style="cell.style"
          ></span>
          <b v-if="!draggedItemView.spriteSources && draggedItemView.item.id !== 'money-pouch'" class="bag-name staging-name">{{ draggedItemView.item.name }}</b>
        </span>
      </div>
    </section>
    <section v-show="detailPanelVisible" class="detail-panel">
      <div class="detail-card" :class="{ 'has-detail-sprite': detailSpriteSources }" data-action="close-detail" @click="handleAction('close-detail')">
        <div class="detail-icon" aria-hidden="true">
          <img
            v-if="detailSpriteSources" class="detail-sprite" :src="detailSpriteSources.medium"
            :alt="detailPanel?.title || ''" draggable="false" decoding="async"
          ><span v-else>{{ detailPanel ? detailIcon : 'DETAIL' }}</span>
        </div>
        <div class="detail-content">
          <div class="detail-head">
            <div class="detail-title">{{ detailPanel?.title || 'DETAIL PANEL' }}</div>
            <span v-if="detailPanel?.armorValue != null" class="detail-armor">护甲 {{ detailPanel.armorValue }}</span>
            <div class="detail-badges">
              <span v-for="badge in (detailPanel?.badges || [])" :key="badge">{{ badge
              }}</span>
            </div>
          </div>
          <div v-if="detailPanel?.statLines?.length || detailPanel?.energyCost != null" class="detail-stat-lines">
            <div v-for="(line, index) in detailPanel.statLines" :key="`stat-${index}-${line}`">{{ line }}</div>
            <StaminaCost v-if="detailPanel.energyCost != null" :cost="detailPanel.energyCost" :attribute="detailPanel.energyAttribute" />
          </div>
          <div v-if="detailPanel?.effectLines?.length || (!detailPanel?.statLines?.length && detailPanel?.lines?.length) || !detailPanel" class="detail-effect-lines">
            <div v-for="(line, index) in (detailPanel?.effectLines?.length ? detailPanel.effectLines : (!detailPanel?.statLines?.length ? (detailPanel?.lines || []) : []))" :key="`effect-${index}-${line}`">{{ line }}</div>
            <div v-if="!detailPanel">LONG-PRESS AN ITEM TO INSPECT</div>
          </div>
          <div v-if="detailPanel?.description" class="detail-description">{{ detailPanel.description }}</div>
        </div>
        <div v-if="detailUpgradeRoutes.length" class="detail-upgrade-routes" aria-hidden="true">
          <div v-for="route in detailUpgradeRoutes" :key="route.key" class="detail-upgrade-route">
            <span class="detail-upgrade-icon"><img v-if="route.a.src" :src="route.a.src" alt="" draggable="false"></span>
            <span class="detail-upgrade-plus" aria-hidden="true"></span>
            <span class="detail-upgrade-icon"><img v-if="route.b.src" :src="route.b.src" alt="" draggable="false"></span>
            <span class="detail-upgrade-arrow" aria-hidden="true"></span>
            <span class="detail-upgrade-icon result"><img v-if="route.result.src" :src="route.result.src" alt="" draggable="false"></span>
          </div>
        </div>
      </div>
    </section>

    <div class="hud-settings" :class="{ show: topPanel === 'settings' }">
      <label class="settings-row"><input
        v-model="reveal" type="checkbox" @change="updateReveal"
      > {{ LABELS.reveal }}</label>
      <div class="settings-camera" :aria-label="LABELS.camera">
        <div class="settings-camera-row">
          <span>{{ LABELS.cameraAzimuth }}</span><strong>{{ cameraAngles ? `自动（-15° ~
          15°）` : '' }}</strong>
        </div>
        <div class="settings-camera-row">
          <span>{{ LABELS.cameraPitch }} <strong>{{ cameraAngles ?
            `${cameraAngles.pitch}°` : '' }}</strong></span>
          <div class="settings-camera-controls">
            <button
              type="button" class="settings-camera-button"
              data-action="camera-pitch-minus" @click="handleAction('camera-pitch-minus')"
            >
              −
            </button><button
              type="button" class="settings-camera-button"
              data-action="camera-pitch-plus" @click="handleAction('camera-pitch-plus')"
            >
              +
            </button>
          </div>
        </div>
      </div><button class="settings-restart" data-action="restart-settings" @click.stop="restartFromSettings">
        {{
          LABELS.restart }}
      </button>
    </div>

    <section
      class="character-panel" :class="{ show: topPanel === 'characterpanel' }"
      :aria-hidden="topPanel === 'characterpanel' ? 'false' : 'true'"
    >
      <div class="character-panel-head">
        <span>{{ LABELS.characterGrowth }}</span><strong>Lv. {{ state.player.level
        }}</strong>
      </div>
      <div class="character-summary">
        <div class="character-stat">
          <span>{{ LABELS.experience }}</span><strong>{{ state.player.experience }} / {{
            state.player.experienceToNext }}</strong>
        </div>
        <div class="character-stat">
          <span>{{ LABELS.maxHealth }}</span><strong>{{ state.player.hp }} / {{
            state.player.maxHp }}</strong>
        </div>
        <div class="character-stat">
          <span>球池</span><strong>{{ ballComposition }}</strong>
        </div>
        <div class="character-stat">
          <span>抽球堆 / 弃球堆</span><strong>{{ state.staminaDeck.drawPile.length }} / {{ state.staminaDeck.discardPile.length }}</strong>
        </div>
      </div>
      <div class="character-expbar"><span :style="{ width: `${characterExperienceProgress}%` }"></span></div>
    </section>

    <div class="hud-log" :class="{ show: topPanel === 'log' }">
      <div class="log-head">
        <span class="log-title">{{ LABELS.log }}</span><button
          class="log-copy"
          data-action="copy-log" type="button" @click="handleAction('copy-log')"
        >
          {{ copyLabel }}
        </button>
      </div>
      <div class="log-body">
        <div v-for="(line, index) in state.log.slice(0, 40)" :key="`${index}-${line}`" class="line">{{ line }}</div>
      </div>
    </div>
    <div class="help-modal" :class="{ show: helpOpen }" :aria-hidden="helpOpen ? 'false' : 'true'">
      <div class="help-modal-backdrop" data-action="close-help" @click="handleAction('close-help')"></div>
      <section class="help-modal-panel" role="dialog" aria-modal="true">
        <header class="help-modal-head">
          <div>
            <span class="help-modal-kicker">{{ LABELS.help }}</span>
            <h2>{{ LABELS.basicGameplay }}</h2>
          </div><button class="help-modal-close" data-action="close-help" :aria-label="LABELS.close" @click="handleAction('close-help')">×</button>
        </header>
        <div class="help-modal-body">
          <section v-for="section in HELP_SECTIONS" :key="section.title" class="help-section">
            <h3>{{ section.title }}</h3>
            <ul>
              <li v-for="item in section.items" :key="item">{{ item }}</li>
            </ul>
          </section>
        </div>
      </section>
    </div>

    <div class="relic-choice" :class="{ show: initialRelicOpen }">
      <div class="relic-choice-title">{{ LABELS.initialRelic }}</div>
      <div class="relic-choice-row">
        <button
          v-for="relic in initialRelics" :key="relic.id" class="relic-choice-card"
          :data-relic-choice="relic.id" @click.stop="selectInitialRelic(relic.id)"
        >
          <span class="relic-name">{{ relic.name }}</span>
          <img
            v-if="itemSpriteSources({ id: relic.id })" class="relic-choice-sprite"
            :src="itemSpriteSources({ id: relic.id }).medium" :alt="relic.name" draggable="false" decoding="async"
          ><span class="relic-desc">{{ relic.description }}</span>
        </button>
      </div>
    </div>
    <div class="relic-choice room-reward" :class="{ show: roomRewardOpen }">
      <div class="relic-choice-title">{{ LABELS.roomReward }}</div>
      <div class="relic-choice-row">
        <button
          v-for="(choice, index) in (state.roomReward?.choices || [])" :key="index"
          class="relic-choice-card" :data-room-reward="index" :disabled="roomRewardDisabled(choice)" @click="handleAction('room-reward', index)"
        >
          <span class="relic-name">{{ roomRewardTitle(choice) }}</span>
          <img
            v-if="roomRewardSpriteSources(choice)" class="relic-choice-sprite"
            :src="roomRewardSpriteSources(choice).medium" :alt="roomRewardTitle(choice)" draggable="false" decoding="async"
          ><span class="relic-desc">{{ roomRewardDescription(choice) }}</span>
        </button>
      </div><button
        class="reward-skip"
        data-action="skip-room-reward" @click="handleAction('skip-room-reward')"
      >
        {{ LABELS.skipReward }}
      </button>
    </div>
    <div class="relic-choice level-up" :class="{ show: levelUpOpen }">
      <div class="relic-choice-title">{{ levelUpTitle }}</div>
      <div v-if="!state.levelUp?.selectedOption" class="relic-choice-row">
        <button
          v-for="choice in levelUpChoices" :key="choice.id"
          class="relic-choice-card" :data-level-up-choice="choice.id" :disabled="!levelUpOptionAvailable(choice.id)" @click="handleAction('level-up-choice', choice.id)"
        >
          <span class="relic-name">{{ choice.name }}</span><span class="relic-desc">{{ choice.description }}</span>
          <small v-if="!choice.disabled && !levelUpOptionAvailable(choice.id)">{{ LABELS.noUpgradeTarget }}</small>
        </button>
      </div>
      <div v-else-if="state.levelUp.selectedOption === 'relic'" class="relic-choice-row">
        <button
          v-for="relic in levelUpRelics" :key="relic.id" class="relic-choice-card"
          :data-level-up-relic="relic.id" @click="run.chooseLevelUpRelic(relic.id)"
        >
          <span class="relic-name">{{ relic.name }}</span>
          <img v-if="itemSpriteSources(relic)" class="relic-choice-sprite" :src="itemSpriteSources(relic).medium" :alt="relic.name" draggable="false">
          <span class="relic-desc">{{ relic.description }}</span>
        </button>
      </div>
      <div v-else-if="state.levelUp.selectedOption === 'weapon-upgrade'" class="relic-choice-row level-up-weapons">
        <button v-for="weapon in levelUpWeapons" :key="weapon.uid" class="relic-choice-card" :data-level-up-weapon="weapon.uid" @click="run.chooseLevelUpWeapon(weapon.uid)">
          <span class="relic-name">{{ weapon.name }}</span>
          <img v-if="itemSpriteSources(weapon)" class="relic-choice-sprite" :src="itemSpriteSources(weapon).medium" :alt="weapon.name" draggable="false">
          <span class="relic-desc">{{ LABELS.baseAttack }} {{ weapon.attack }} → {{ weapon.attack + 1 }}</span>
          <small>{{ LABELS.bagPosition }} {{ weapon.slot }}</small>
        </button>
      </div>
      <button v-if="state.levelUp?.selectedOption" class="level-up-back" @click="run.backToLevelUpChoices()">{{ LABELS.backToGrowth }}</button>
    </div>

    <div class="hud-rest" :class="{ show: merchantOpen }">
      <section class="merchant-panel">
        <div class="merchant-head">
          <span class="merchant-title">{{ merchant?.name }}</span>
          <div class="merchant-tabs">
            <button
              v-for="tab in merchantTabs" :key="tab" type="button" class="merchant-tab"
              :class="{ active: merchantTab === tab }" :data-merchant-tab="tab" :aria-selected="merchantTab === tab" @click="handleAction('merchant-tab', tab)"
            >
              {{
                tab === 'stock' ? LABELS.buy : LABELS.merchantRelicsTab }}
            </button>
          </div><button
            data-action="close-merchant" @click="handleAction('close-merchant')"
          >
            {{ LABELS.leaveMerchant }}
          </button>
        </div>
        <div class="merchant-tab-page merchant-purchase-page" :class="{ show: merchantTab === 'stock' }">
          <div class="merchant-stock">
            <button
              v-for="(entry, index) in (merchant?.stock || [])"
              :key="`${entry.itemId}-${index}`" class="merchant-stock-item" :data-merchant-stock="index"
              @click="handleAction('merchant-stock', index)"
              @touchstart.stop="onDetailTouchStart($event)"
              @touchmove.stop="onTouchMove" @touchend.stop="onTouchEnd" @touchcancel.stop="onTouchCancel"
              @contextmenu.prevent
            >
              <b>{{
                getItemDefinition(entry.itemId)?.name }}</b><small>{{ LABELS.buy }} {{ run.merchantPrice(entry) }}</small>
            </button>
          </div>
          <div class="merchant-trade">
            <button data-action="merchant-sell" :disabled="!selectedItem || selectedItem.sellable === false" @click="handleAction('merchant-sell')">
              {{
                LABELS.sellSelected }}{{ selectedItem ? ` ${merchantSellPrice(selectedItem)}` : '' }}
            </button><button
              v-if="merchant?.restockPrice > 0" data-action="merchant-refresh"
              :disabled="state.player.gold < run.merchantRestockPrice(merchant)" @click="handleAction('merchant-refresh')"
            >
              {{ LABELS.refreshStock }} {{ run.merchantRestockPrice(merchant)
              }}
            </button>
          </div>
        </div>
        <div class="merchant-relics" :class="{ show: merchantTab === 'relics' }">
          <section v-if="merchantOffers.length" class="merchant-relic-section merchant-relic-offer">
            <div class="merchant-relic-title">{{ LABELS.relicChoice }}</div>
            <div class="merchant-relic-grid">
              <button
                v-for="relic in merchantOffers" :key="relic.id"
                class="merchant-relic-item" :class="{ disabled: state.player.gold < (merchant?.relicOfferPrice || 0) }"
                :data-merchant-relic-choice="relic.id"
                :aria-disabled="state.player.gold < (merchant?.relicOfferPrice || 0)"
                @click="handleAction('merchant-relic', relic.id)"
                @touchstart.stop="onDetailTouchStart($event)"
                @touchmove.stop="onTouchMove" @touchend.stop="onTouchEnd" @touchcancel.stop="onTouchCancel"
                @contextmenu.prevent
              >
                <b>{{ relic.name }}</b><small>{{
                  relic.description }} · {{ LABELS.buy }} {{ merchant.relicOfferPrice }}</small>
              </button>
            </div>
          </section>
          <div v-else class="merchant-relic-empty">{{ LABELS.noRelicsAvailable }}</div>
        </div>
      </section>
    </div>

    <div class="hud-bottom">
      <div class="backpack-toolbar" :aria-label="`${LABELS.health} ${LABELS.armor} ${LABELS.energy}`">
        <div class="vital-armor" :title="LABELS.armor"><strong>{{ state.player.armor }}</strong></div>
        <div class="vital-bars">
          <div class="vital-health" :title="LABELS.health">
            <span
              class="vital-health-fill"
              :style="{ width: `${Math.max(0, Math.min(100, state.player.hp / Math.max(1, state.player.maxHp) * 100))}%` }"
            ></span><strong>{{
              state.player.hp }}/{{ state.player.maxHp }}</strong>
          </div>
          <div class="stamina-hand" :style="{ '--ball-slots': Math.max(10, state.staminaDeck.hand.length) }">
            <button
              v-for="ball in state.staminaDeck.hand" :key="ball.id" class="stamina-ball"
              :class="[ball.attribute, { selected: state.staminaDeck.selected.includes(ball.id) }]"
              :aria-label="`${BALL_LABELS[ball.attribute]}球${state.staminaDeck.selected.includes(ball.id) ? '，已选中优先支付' : '，点击优先支付'}`"
              :aria-pressed="state.staminaDeck.selected.includes(ball.id)" :disabled="!actionsAvailable"
              @click.stop="state.toggleStaminaBall(ball.id)"
            ></button>
            <span v-if="state.battle.active && !state.staminaDeck.hand.length" class="stamina-empty">球已用完</span>
          </div>
        </div>
        <div class="backpack-action-slot act-use-slot">
          <button
            v-if="selectedUsable" class="backpack-action act-use" data-action="use"
            :disabled="!selectedUseAvailable"
            @click="handleAction('use')"
          >
            {{ LABELS.use }}
          </button>
          <button
            v-else-if="state.battle.active" class="backpack-action act-end-turn" data-action="end-turn"
            :disabled="!actionsAvailable || state.roundResolving" @click="handleAction('end-turn')"
          >
            结束回合
          </button>
        </div>
        <div v-if="state.battle.active && selectedItem?.type === 'weapon'" class="stamina-payment" :class="{ unavailable: !weaponBallPreview }">
          <span>原地攻击</span>
          <StaminaCost :cost="state.weaponEnergyCost(selectedItem)" :attribute="selectedItem.attribute" />
          <span v-if="!weaponBallPreview">体力球不足</span>
        </div>
      </div>
      <section class="backpack-panel">
        <div class="backpack-grid-wrap">
          <BackpackGrid
            ref="backpackGrid" :columns="INVENTORY_COLUMNS" :rows="INVENTORY_ROWS"
            :gold="state.player.gold"
            :cells="backpackCells" :items="backpackItems" :links="backpackAdjacencyLinks"
            @cell-click="onBagCellClick" @item-touchstart="onBagTouchStart"
            @item-touchmove="onBagTouchMove" @item-touchend="onBagTouchEnd"
            @item-touchcancel="onBagTouchCancel"
          />
        </div>
      </section>
    </div>
    <section class="craft-panel" :hidden="!craftOpen">
      <div class="craft-dialog">
        <header>
          <h2>{{ LABELS.craft }}</h2><button data-action="craft-close" @click="handleAction('craft-close')">{{ LABELS.close }}</button>
        </header>
        <p>合成消耗原料，战斗中消耗 1 个体力球；探索中免费。成品放不下时进入暂存区。长按配方中的物品查看详情。</p>
        <div>
          <div v-for="recipe in craftRows" :key="recipe.id" class="craft-row">
            <button
              class="craft-item"
              :data-craft-item="recipe.a"
              @touchstart.stop="onDetailTouchStart($event)"
              @touchmove.stop="onTouchMove" @touchend.stop="onTouchEnd" @touchcancel.stop="onTouchCancel"
              @contextmenu.prevent
            >
              {{ getItemDefinition(recipe.a)?.name }}
            </button><span>+</span><button
              class="craft-item" :data-craft-item="recipe.b"
              @touchstart.stop="onDetailTouchStart($event)"
              @touchmove.stop="onTouchMove" @touchend.stop="onTouchEnd" @touchcancel.stop="onTouchCancel"
              @contextmenu.prevent
            >
              {{ getItemDefinition(recipe.b)?.name
              }}
            </button><span>=</span><button :data-craft-result="recipe.id" @click="handleAction('craft-result', recipe.id)">
              合成
            </button>
          </div>
          <p v-if="!craftRows.length">背包内暂无可合成方案。</p>
        </div>
      </div>
    </section>
    <div class="hud-over" :class="{ show: state.gameOver && !state.combatResolving && !state.deathAnimationPending && !state.enemyDeathAnimationsPending, win: state.win, lose: !state.win }">
      <h1>{{ state.win ? LABELS.win : LABELS.lose }}</h1>
      <p>{{ state.win ? LABELS.winMessage : LABELS.loseMessage }}</p><button
        data-action="restart"
        @click.stop="handleAction('restart')"
      >
        {{ LABELS.restart }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { BALL_LABELS } from '../game/model/stamina-deck.js'
import StaminaCost from './StaminaCost.vue'
import { merchantSellPrice } from '../game/data/merchants.js'
import { getItemDefinition, upgradeRecipesForItem } from '../game/data/content.js'
import { getRelicDefinition } from '../game/data/relics.js'
import { isTotemBadge } from '../game/data/totems.js'
import { consumableEnergyCost } from '../game/rules/consumables.js'
import { INVENTORY_COLUMNS, INVENTORY_ROWS } from '../game/run.js'
import { GameScene } from '../render/scene.js'
import { DETAIL_HOLD_MS } from '../interaction-timing.js'
import { bagShapeLayout } from './bag-shape.js'
import { automaticStashPosition, inventoryDropAnchorAtCenter, inventoryItemLayout, stashPositionAtPoint as stashPositionForPoint } from './inventory-layout.js'
import { itemSpriteSources } from './item-sprites.js'
import { playerStatusEntries } from './status-presentation.js'
import InventorySprite from './InventorySprite.vue'
import ItemValueBadge from './ItemValueBadge.vue'
import BackpackGrid from './BackpackGrid.vue'

const props = defineProps({ run: { type: Object, required: true } })
const run = props.run

const LABELS = Object.freeze({
  floor: '\u697c\u5c42', health: '\u751f\u547d', armor: '\u62a4\u7532', energy: '\u4f53\u529b', gold: '\u91d1\u5e01',
  turn: '\u5168\u5c40\u56de\u5408', poison: '\u4e2d\u6bd2', burning: '\u71c3\u70e7', level: '\u7b49\u7ea7', experience: '\u7ecf\u9a8c',
  character: '\u89d2\u8272', characterGrowth: '\u89d2\u8272\u6210\u957f', maxHealth: '\u751f\u547d\u4e0a\u9650', maxEnergy: '\u4f53\u529b\u4e0a\u9650',
  help: '\u5e2e\u52a9', basicGameplay: '\u57fa\u672c\u73a9\u6cd5',
  chooseWeaponUpgrade: '\u9009\u62e9\u8981\u5f3a\u5316\u7684\u6b66\u5668', baseAttack: '\u57fa\u7840\u653b\u51fb\u529b', bagPosition: '\u80cc\u5305\u683c\u4f4d',
  backToGrowth: '\u8fd4\u56de\u5347\u7ea7\u9009\u9879', noUpgradeTarget: '\u6682\u65e0\u53ef\u9009\u76ee\u6807',
  close: '\u5173\u95ed', craft: '\u5408\u6210', status: '\u72b6\u6001', settings: '\u8bbe\u7f6e', camera: '\u89c6\u89d2', cameraAzimuth: '\u65cb\u8f6c\u89d2\u5ea6',
  cameraPitch: '\u4fef\u4ef0\u89d2\u5ea6', cameraPitchDecrease: '\u51cf\u5c0f\u4fef\u4ef0\u89d2\u5ea6', cameraPitchIncrease: '\u589e\u52a0\u4fef\u4ef0\u89d2\u5ea6',
  log: '\u65e5\u5fd7', copyLog: '\u590d\u5236\u65e5\u5fd7', copied: '\u5df2\u590d\u5236', copyFailed: '\u590d\u5236\u5931\u8d25',
  reveal: '\u8c03\u8bd5\uff1a\u663e\u793a\u724c\u5185\u5bb9', discard: '\u4e22\u5f03', discardZone: '\u4e22\u5f03', stashZone: '\u6682\u5b58', rotate: '\u65cb\u8f6c', use: '\u4f7f\u7528',
  empty: '\u7a7a', relics: '\u5723\u9057\u7269', relicOverload: '\u5723\u9057\u7269\u8d85\u8f7d', initialRelic: '\u9009\u62e9\u521d\u59cb\u5723\u9057\u7269',
  leaveMerchant: '\u79bb\u5f00', sold: '\u5df2\u552e\u7f44', buy: '\u8d2d\u4e70', merchantRelicsTab: '\u5723\u9057\u7269',
  noRelicsAvailable: '\u6682\u65e0\u53ef\u83b7\u5f97\u7684\u5723\u9057\u7269', relicChoice: '\u9009\u62e9\u4e00\u4ef6\u5723\u9057\u7269',
  roomReward: '\u65b0\u623f\u95f4\u5956\u52b1', growthChoice: '\u9009\u62e9\u5347\u7ea7\u5956\u52b1', skipReward: '\u8df3\u8fc7',
  sellSelected: '\u51fa\u552e\u6240\u9009', refreshStock: '\u5237\u65b0\u8d27\u67b6', restart: '\u91cd\u65b0\u5f00\u59cb',
  restartConfirm: '\u786e\u5b9a\u8981\u91cd\u65b0\u5f00\u59cb\u5417\uff1f\u5f53\u524d\u8fdb\u5ea6\u5c06\u88ab\u6e05\u9664\u3002',
  win: '\u9003\u51fa\u5730\u7262', lose: '\u4f60\u5df2\u9668\u843d', winMessage: '\u4f60\u51fb\u8d25\u4e86\u76d1\u89c6\u8005\u3002', loseMessage: '\u751f\u547d\u5f52\u96f6\u3002\u53ef\u4ee5\u91cd\u65b0\u5f00\u59cb\u6311\u6218\u3002',
})
const DETAIL_ICONS = Object.freeze({ enemy: '\u2694', weapon: '\u2694', potion: '\u271a', armor: '\u26e8', energy: '\u26a1', buff: '\u2726', relic: '\u25c6', trap: '!', gold: '\u25cf', key: '\ud83d\udd11', merchant: '\u25c9', item: '\u25a0' })
const EDGE_NAMES = ['top', 'right', 'bottom', 'left']
const HELP_SECTIONS = Object.freeze([
  { title: '行动与体力球', items: ['探索操作免费。球池初始红、黄、蓝各10球及2万能球；每个玩家回合抽2×激活敌人数+4球，新揭示敌人立即补2球。', '球不放回抽取，抽空后洗回弃球堆；剩余球先供宠物使用再弃掉。手动结束回合后执行宠物和敌人阶段。', '战斗中移动、翻牌、原地拾取、使用消耗品、整理和合成各耗1个任意球。点击球可指定优先支付；武器必须用同色和万能球付足费用，球不足时不能攻击。重复使用不额外加费；执一印使本回合再次使用同一实例减1球，不累加、最低1球。'] },
  { title: '\u80cc\u5305\u4e0e\u5408\u6210', items: ['\u80cc\u5305\u662f 8 \u5217 4 \u884c\uff0c\u7269\u54c1\u6309\u5f62\u72b6\u5360\u683c\u3002', '\u70b9\u6309\u7269\u54c1\u53ef\u9009\u4e2d\uff1b\u957f\u6309 150ms \u540e\u62d6\u52a8\u79fb\u52a8\uff0c\u4e0d\u518d\u7528\u70b9\u51fb\u7a7a\u683c\u79fb\u7269\u54c1\u3002', '拖动时可移入暂存区或红色丢弃区；探索免费，战斗中成功操作耗1体力。升级选择期间整理免费。', '\u5408\u6210\u9762\u677f\u53ea\u663e\u793a\u5f53\u524d\u80cc\u5305\u53ef\u5408\u6210\u7684\u914d\u65b9\u3002'] },
  { title: '\u5347\u7ea7\u4e0e\u5723\u9057\u7269', items: ['\u5347\u7ea7\u65f6\u4ece5\u79cd\u5956\u52b1\u4e2d\u968f\u673a\u63d0\u4f9b3\u9879\uff0c\u9009\u62e91\u9879\u3002', '\u6b66\u5668\u5f3a\u5316\u4ec5\u5f71\u54cd\u6240\u9009\u6b66\u5668\uff0c\u5408\u6210\u540e\u4e0d\u7ee7\u627f\u3002', '\u5723\u9057\u7269\u653e\u5728\u80cc\u5305\u4e2d\u5373\u53ef\u751f\u6548\uff0c\u79bb\u5f00\u623f\u95f4\u4e0d\u4f1a\u91cd\u7f6e\u3002'] },
  { title: '\u6218\u6597\u4e0e\u63a2\u7d22', items: ['\u9009\u62e9\u6b66\u5668\u540e\u70b9\u51fb\u654c\u4eba\u53d1\u8d77\u653b\u51fb\uff0c\u8fdc\u5904\u76ee\u6807\u4f1a\u5148\u9884\u89c8\u8def\u5f84\u3002', '\u957f\u6309\u68cb\u76d8\u6216\u80cc\u5305\u7269\u54c1\u67e5\u770b\u8be6\u60c5\uff0c\u8fde\u7eed\u79fb\u52a8\u89c6\u89d2\u53ef\u4f7f\u7528\u62d6\u62fd\u548c\u6eda\u8f6e\u7f29\u653e\u3002'] },
])

const revision = ref(0)
const detailRevision = ref(0)
const uiRevision = ref(0)
const sceneContainer = ref(null)
const scene = shallowRef(null)
const topPanel = ref(null)
const craftOpen = ref(false)
const helpOpen = ref(false)
const merchantTab = ref('stock')
const copyLabel = ref(LABELS.copyLog)
const reveal = ref(typeof localStorage !== 'undefined' && localStorage.getItem('v2_opt_reveal') === '1')
// Keep the gesture token as a raw object. A deep ref would proxy nextHold,
// making the timer identity check incorrectly report every hold as stale.
const hold = shallowRef(null)
const BAG_DRAG_TOLERANCE = 18
const bagGesture = ref(null)
const stashPositions = reactive({})
const backpackGrid = ref(null)
const discardZone = ref(null)
const stashZone = ref(null)
let bagGestureSequence = 0
const detailPanelVisible = ref(false)
let ignoreClicksUntil = 0
const subscriptions = []

function createRunView() {
  // GameRun intentionally stays a plain mutable model.  Returning the same
  // object from a computed would let Vue 3's computed-stability optimization
  // treat a revision-only update as unchanged.  Give every revision a fresh
  // forwarding view while binding methods/getters back to the real model, so
  // UI reads invalidate reliably without making gameplay state reactive.
  return new Proxy(run, {
    get(target, property) {
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

const state = computed(() => {
  revision.value
  return createRunView()
})
const detailPanel = computed(() => {
  detailRevision.value
  return run.detailPanel
})
const cameraAngles = computed(() => {
  uiRevision.value
  return scene.value?.cameraAngles?.() || null
})
const selectedItem = computed(() => state.value.selectedItem)
const ballComposition = computed(() => Object.entries(state.value.staminaDeck.composition()).map(([attribute, count]) => `${BALL_LABELS[attribute]}${count}`).join(' · '))
const weaponBallPreview = computed(() => selectedItem.value?.type === 'weapon' ? state.value.weaponPayment(selectedItem.value) : null)
const actionsAvailable = computed(() => {
  state.value
  return run._canAct()
})
const craftAvailable = computed(() => {
  state.value
  return run._canOrganizeBackpack() && run.phase !== 'level-up' && !run.itemTargeting
})
const selectedUsable = computed(() => {
  const item = selectedItem.value
  return !!item && (isTotemBadge(item) || ['potion', 'armor', 'buff', 'teleport', 'throwable'].includes(item.type))
})
const selectedUseAvailable = computed(() => {
  state.value
  const item = selectedItem.value
  return actionsAvailable.value && selectedUsable.value && run.canPayAction(consumableEnergyCost(item) + (run.consumables.boosted(item, true) ? 2 : 0)) && (!isTotemBadge(item) || run.totems.available(item))
})
const statusEntries = computed(() => {
  state.value
  return playerStatusEntries(run)
})
const experienceProgress = computed(() => {
  const player = state.value.player
  return player.experienceToNext > 0 ? Math.min(100, Math.max(0, player.experience / player.experienceToNext * 100)) : 0
})
const characterExperienceProgress = experienceProgress
const inventoryStagingVisible = computed(() => state.value.inventoryStash.length > 0 || !!bagGesture.value?.dragging)
const dragPreview = computed(() => {
  const gesture = bagGesture.value
  if (!gesture?.dragging || !Number.isInteger(gesture.targetIndex)) return null
  const preview = run.previewInventoryDrop(gesture.item, gesture.targetIndex, { rotation: gesture.rotation })
  const validPreviewIndex = Number.isInteger(preview?.index) && preview.index >= 0 && preview.index < INVENTORY_COLUMNS * INVENTORY_ROWS
  return preview?.status === 'blocked' && !validPreviewIndex
    ? { ...preview, index: gesture.lastValidTargetIndex }
    : preview
})
const backpackCells = computed(() => {
  const current = state.value
  const preview = dragPreview.value
  const candidateCells = new Set((preview?.cells || []).map((cell) => cell.y * INVENTORY_COLUMNS + cell.x))
  const conflictCells = new Set((preview?.conflicts || []).flatMap((conflict) => current.backpack.cellsForPlacement(conflict).map((cell) => cell.y * INVENTORY_COLUMNS + cell.x)))
  return Array.from({ length: INVENTORY_COLUMNS * INVENTORY_ROWS }, (_, index) => {
  const placement = current.backpack.placementForCellIndex(index)
  const action = preview?.index === index
    ? preview.status
    : candidateCells.has(index)
      ? preview?.status
      : conflictCells.has(index)
        ? 'replace-conflict'
        : null
  return {
    index,
    placement,
    action,
    selected: placement?.item?.uid === selectedItem.value?.uid,
    label: placement?.item?.name || LABELS.empty,
  }
  })
})
const backpackItems = computed(() => {
  const current = state.value
  const itemRules = run.itemRules
  return current.backpack.placements.map((placement) => {
    const item = placement.item
    const shape = current.backpack.shapeFor(item, placement.rotation)
    const layout = bagShapeLayout(shape)
    const originIndex = current.backpack.originIndex(placement)
    const cells = layout.cells.map(({ x, y, edges }) => ({
      x,
      y,
      index: (placement.y + y) * INVENTORY_COLUMNS + placement.x + x,
      edgeNames: edges.map((visible, index) => visible ? EDGE_NAMES[index] : null).filter(Boolean),
      style: { gridColumn: x + 1, gridRow: y + 1, borderWidth: edges.map((edge) => edge ? '1px' : '0').join(' ') },
    }))
    const oddRotation = placement.rotation % 2 === 1
    const isDragging = bagGesture.value?.dragging && bagGesture.value.item?.uid === item.uid
    const isConflict = dragPreview.value?.conflicts?.some((conflict) => conflict.item?.uid === item.uid)
    const relicStateClass = item.type === 'relic'
      ? (itemRules.relicEffectActive(item.id || item.relicId) ? 'relic-active' : 'relic-inactive')
      : null
    return {
      item,
      shape,
      cells,
      detail: itemDetail(item),
      originIndex,
      selected: current.selectedInventoryIndex === originIndex,
      spriteSources: itemSpriteSources(item),
      itemClasses: ['bag-item', item.type, ...(itemSpriteSources(item) ? ['has-sprite'] : []), ...(item.attribute ? [`attribute-${item.attribute}`] : []), ...(relicStateClass ? [relicStateClass] : []), ...(item.type === 'relic' && run.relicOverload() > 0 ? ['overloaded'] : []), ...(current.selectedInventoryIndex === originIndex ? ['selected'] : []), ...(isDragging ? ['drag-source'] : []), ...(isConflict ? ['drop-conflict'] : [])],
      itemStyle: { gridColumn: `${placement.x + 1} / span ${shape[0].length}`, gridRow: `${placement.y + 1} / span ${shape.length}` },
      shapeStyle: { gridTemplateColumns: `repeat(${shape[0].length}, 1fr)`, gridTemplateRows: `repeat(${shape.length}, 1fr)` },
      nameStyle: layout.name ? { gridColumn: `${layout.name.x + 1} / span ${layout.name.width}`, gridRow: layout.name.y + 1 } : undefined,
      detailStyle: layout.detail ? { gridColumn: `${layout.detail.x + 1} / span ${layout.detail.width}`, gridRow: layout.detail.y + 1 } : undefined,
      spriteStyle: { width: oddRotation ? `${shape.length / shape[0].length * 100}%` : '100%', height: oddRotation ? `${shape[0].length / shape.length * 100}%` : '100%', transform: `translate(-50%, -50%) rotate(${placement.rotation * 90}deg)` },
    }
  })
})
function adjacencyBoundary(backpack, source, target) {
  const sourcePlacement = backpack.placementOf(source.uid)
  const targetPlacement = backpack.placementOf(target.uid)
  if (!sourcePlacement || !targetPlacement) return null
  const sourceCells = backpack.cellsForPlacement(sourcePlacement)
  const targetCells = backpack.cellsForPlacement(targetPlacement)
  const contacts = []
  for (const sourceCell of sourceCells) {
    for (const targetCell of targetCells) {
      if (Math.abs(sourceCell.x - targetCell.x) + Math.abs(sourceCell.y - targetCell.y) !== 1) continue
      contacts.push({
        orientation: sourceCell.x !== targetCell.x ? 'horizontal' : 'vertical',
        x: (sourceCell.x + targetCell.x + 1) / 2,
        y: (sourceCell.y + targetCell.y + 1) / 2,
      })
    }
  }
  if (!contacts.length) return null
  return contacts[Math.floor((contacts.length - 1) / 2)]
}
const backpackAdjacencyLinks = computed(() => {
  const current = state.value
  if (bagGesture.value?.dragging) return []
  return run.itemRules.activeAdjacencyLinks().map(({ source, target }) => {
    const boundary = adjacencyBoundary(current.backpack, source, target)
    if (!boundary) return null
    return {
      key: `${source.uid}:${target.uid}`,
      orientation: boundary.orientation,
      style: {
        '--link-x': `${boundary.x / INVENTORY_COLUMNS * 100}%`,
        '--link-y': `${boundary.y / INVENTORY_ROWS * 100}%`,
      },
    }
  }).filter(Boolean)
})
const stashItems = computed(() => state.value.inventoryStash.map((item, index) => {
  const rotation = Number(item.bagRotation) || 0
  const shape = run.backpack.shapeFor(item, rotation)
  const layout = bagShapeLayout(shape)
  const position = ensureAutoStashPosition(item, rotation, index)
  const dimensions = inventoryItemLayout(run.backpack, item, rotation, backpackGrid.value?.getBoundingClientRect?.(), INVENTORY_COLUMNS, INVENTORY_ROWS)
  return {
    item,
    shape,
    cells: layout.cells.map(({ x, y, edges }) => ({ x, y, index: `${item.uid}-${x}-${y}`, style: { gridColumn: x + 1, gridRow: y + 1, borderWidth: edges.map((edge) => edge ? '1px' : '0').join(' ') } })),
    shapeStyle: { gridTemplateColumns: `repeat(${shape[0].length}, 1fr)`, gridTemplateRows: `repeat(${shape.length}, 1fr)` },
    spriteSources: itemSpriteSources(item),
    spriteStyle: { width: rotation % 2 ? `${shape.length / shape[0].length * 100}%` : '100%', height: rotation % 2 ? `${shape[0].length / shape.length * 100}%` : '100%', transform: `translate(-50%, -50%) rotate(${rotation * 90}deg)` },
    itemClasses: ['bag-item', 'stash-item-visual', item.type, ...(itemSpriteSources(item) ? ['has-sprite'] : []), ...(item.attribute ? [`attribute-${item.attribute}`] : [])],
    itemStyle: { left: `${position.x}%`, top: `${position.y}%`, width: `${dimensions.pixelWidth}px`, height: `${dimensions.pixelHeight}px` },
  }
}))
const draggedItemView = computed(() => {
  const gesture = bagGesture.value
  if (!gesture?.dragging) return null
  const item = gesture.item
  const shape = run.backpack.shapeFor(item, gesture.rotation)
  const layout = bagShapeLayout(shape)
  const rect = backpackGrid.value?.getBoundingClientRect?.()
  const cellWidth = rect ? rect.width / INVENTORY_COLUMNS : 36
  const cellHeight = rect ? rect.height / INVENTORY_ROWS : 36
  return {
    item,
    shape,
    cells: layout.cells.map(({ x, y, edges }) => ({ x, y, index: `${item.uid}-${x}-${y}`, style: { gridColumn: x + 1, gridRow: y + 1, borderWidth: edges.map((edge) => edge ? '1px' : '0').join(' ') } })),
    shapeStyle: { gridTemplateColumns: `repeat(${shape[0].length}, 1fr)`, gridTemplateRows: `repeat(${shape.length}, 1fr)` },
    spriteSources: itemSpriteSources(item),
    spriteStyle: { width: gesture.rotation % 2 ? `${shape.length / shape[0].length * 100}%` : '100%', height: gesture.rotation % 2 ? `${shape[0].length / shape.length * 100}%` : '100%', transform: `translate(-50%, -50%) rotate(${gesture.rotation * 90}deg)` },
    itemClasses: ['bag-item', 'drag-floating', item.type, ...(itemSpriteSources(item) ? ['has-sprite'] : []), ...(item.attribute ? [`attribute-${item.attribute}`] : [])],
    previewStyle: {
      left: `${gesture.pointerX}px`, top: `${gesture.pointerY}px`, width: `${cellWidth * shape[0].length}px`, height: `${cellHeight * shape.length}px`,
    },
  }
})
const initialRelics = computed(() => {
  const current = state.value
  return current.initialRelicChoices.map((id) => getRelicDefinition(id)).filter(Boolean)
})
const initialRelicOpen = computed(() => {
  const current = state.value
  return initialRelics.value.length > 0 && current.relics.entries.length === 0
})
const roomRewardOpen = computed(() => {
  const current = state.value
  return current.phase === 'reward' && !!current.roomReward && !current.roomEntering
})
const levelUpOpen = computed(() => {
  const current = state.value
  return current.phase === 'level-up' && !!current.levelUp && !current.combatResolving && !current.roundResolving && !current.enemyDeathAnimationsPending && !inventoryStagingVisible.value
})
const levelUpChoices = computed(() => {
  state.value
  return run.levelUpChoices()
})
const levelUpRelics = computed(() => (state.value.levelUp?.relicChoices || []).map(getRelicDefinition).filter(Boolean))
const levelUpWeapons = computed(() => {
  state.value
  return run.levelUpWeapons().map(weapon => ({ ...weapon, slot: run.backpack.originIndex(run.backpack.placementOf(weapon.uid)) + 1 }))
})
const levelUpTitle = computed(() => state.value.levelUp?.selectedOption === 'relic' ? LABELS.relicChoice
  : state.value.levelUp?.selectedOption === 'weapon-upgrade' ? LABELS.chooseWeaponUpgrade : LABELS.growthChoice)
function levelUpOptionAvailable(id) { state.value; return run.canChooseLevelUpOption(id) }
const merchant = computed(() => state.value.merchantEntity)
const merchantOpen = computed(() => {
  const current = state.value
  return current.phase === 'merchant' && !!merchant.value && !current.merchantEntering
})
const merchantServices = computed(() => merchant.value?.services || state.value.merchantDefinition?.services || [])
const merchantTabs = computed(() => [merchantServices.value.includes('stock') ? 'stock' : null, merchantServices.value.includes('relic-choice') ? 'relics' : null].filter(Boolean))
const merchantOffers = computed(() => (merchant.value?.relicOfferResolved ? [] : (merchant.value?.relicChoices || []).map((id) => getRelicDefinition(id)).filter(Boolean)))
const craftRows = computed(() => {
  state.value
  return run.availableRecipes()
})
const detailIcon = computed(() => DETAIL_ICONS[detailPanel.value?.icon] || DETAIL_ICONS.item)
const detailSpriteSources = computed(() => {
  const itemId = detailPanel.value?.itemId
  return itemId ? itemSpriteSources({ id: itemId }) : null
})
const detailUpgradeRoutes = computed(() => upgradeRecipesForItem(detailPanel.value?.itemId).map((recipe) => ({
  key: `${recipe.a}:${recipe.b}:${recipe.result}`,
  a: { id: recipe.a, src: itemSpriteSources({ id: recipe.a })?.small || null },
  b: { id: recipe.b, src: itemSpriteSources({ id: recipe.b })?.small || null },
  result: { id: recipe.result, src: itemSpriteSources({ id: recipe.result })?.small || null },
})))

watch(merchantTabs, (tabs) => {
  if (!tabs.includes(merchantTab.value)) merchantTab.value = tabs[0] || 'stock'
}, { immediate: true })
watch(craftAvailable, (available) => {
  if (!available) craftOpen.value = false
}, { immediate: true })

function itemDetail(item) {
  if (item.type === 'pet') return `ATK ${item.attack} \u00b7 R ${run.pets.range(item)} \u00b7 \u98df ${run.pets.cost(item)}`
  if (item.type === 'weapon') return `ATK ${item.attack} · R ${run.weaponRange(item)} · ${LABELS.energy} ${run.weaponEnergyCost(item)}`
  if (item.type === 'potion') return `HP +${item.heal}`
  if (item.type === 'armor') return `${LABELS.armor} +${item.armor}`
  if (item.type === 'buff') return `ATK +${item.attackBonus}`
  if (item.type === 'defense') return `${LABELS.armor} ${item.armorValue || 1}`
  if (item.type === 'money-pouch') return ''
  return item.description || ''
}

function rewardDetail(definition) {
  return itemDetail(definition)
}

function toggleTopPanel(panel) { topPanel.value = topPanel.value === panel ? null : panel }
function selectInitialRelic(id) { run.chooseInitialRelic(id) }
function chooseRoomReward(index) { run.chooseRoomReward(index) }
function chooseLevelUp(id) { run.chooseLevelUpOption(id) }
function chooseMerchantRelic(id) { run.chooseMerchantRelic(id) }
function selectMerchantTab(tab) { merchantTab.value = tab }
function onBagCellClick(index) {
  if (Date.now() < ignoreClicksUntil) return
  if (run.itemTargeting) return run.clearSelection()
  const placement = run.backpack.placementForCellIndex(index)
  if (placement) run.selectInventory(index)
}
function restartGame() {
  closeDetailPanel()
  run.clearSave()
  run.reset()
  topPanel.value = null
  helpOpen.value = false
  craftOpen.value = false
  merchantTab.value = 'stock'
}
function restartFromSettings() {
  if (window.confirm(LABELS.restartConfirm)) restartGame()
}
function roomRewardDisabled(choice) {
  if (choice.kind === 'relic') return !getRelicDefinition(choice.relicId) || getRelicDefinition(choice.relicId).disabled || run.relics.has(choice.relicId)
  if (choice.kind === 'item') return !getItemDefinition(choice.itemId) || getItemDefinition(choice.itemId).disabled
  return false
}
function roomRewardTitle(choice) {
  if (choice.kind === 'relic') return getRelicDefinition(choice.relicId)?.name || ''
  if (choice.kind === 'item') return getItemDefinition(choice.itemId)?.name || ''
  return `${LABELS.gold} +${choice.amount}`
}
function roomRewardDescription(choice) {
  if (choice.kind === 'relic') return getRelicDefinition(choice.relicId)?.description || ''
  if (choice.kind === 'item') { const definition = getItemDefinition(choice.itemId); return definition ? rewardDetail(definition) : '' }
  return ''
}
function roomRewardSpriteSources(choice) {
  if (choice.kind === 'relic') return itemSpriteSources({ id: choice.relicId })
  if (choice.kind === 'item') return itemSpriteSources({ id: choice.itemId })
  return null
}

function closestInteractive(target, selector, event = null) {
  const candidates = []
  if (event?.composedPath) {
    for (const candidate of event.composedPath()) candidates.push(candidate)
  }
  if (target instanceof Element) candidates.push(target)
  if (event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY) && document.elementsFromPoint) {
    for (const candidate of document.elementsFromPoint(event.clientX, event.clientY)) candidates.push(candidate)
  }
  for (const candidate of candidates) {
    const match = candidate?.closest?.(selector)
    if (match) return match
  }
  return null
}

function setDetailPanelVisible(opened) {
  detailPanelVisible.value = Boolean(opened && run.detailPanel)
  return opened
}
function openItemDetail(item) { return setDetailPanelVisible(run.showItemDetail(item)) }
function openRelicDetail(id) { return setDetailPanelVisible(run.showRelicDetail(id)) }
function openStatusDetail(entry) {
  return setDetailPanelVisible(run._showDetail({
    position: 'top', title: entry.name, type: LABELS.status, icon: 'item',
    lines: entry.badge ? [entry.badge] : [], description: entry.description,
  }))
}
function closeDetailPanel() {
  const closed = run.closeDetail()
  detailPanelVisible.value = false
  return closed
}

function detailActionFor(target, event = null) {
  const formula = closestInteractive(target, '[data-craft-item]', event)
  if (formula) return () => openItemDetail(getItemDefinition(formula.dataset.craftItem))
  const relic = closestInteractive(target, '[data-relic-detail]', event)
  if (relic) return () => openRelicDetail(relic.dataset.relicDetail)
  const bagItem = closestInteractive(target, '[data-bag-item]', event)
  if (bagItem) { const item = run.backpack.placementForCellIndex(Number(bagItem.dataset.bagItem))?.item; return item ? () => openItemDetail(item) : null }
  const bagCell = closestInteractive(target, '[data-bag-cell]', event)
  if (bagCell) { const item = run.backpack.placementForCellIndex(Number(bagCell.dataset.bagCell))?.item; return item ? () => openItemDetail(item) : null }
  const inventory = closestInteractive(target, '[data-slot]', event)
  if (inventory) { const item = run.backpack.placementForCellIndex(Number(inventory.dataset.slot))?.item; return item ? () => openItemDetail(item) : null }
  const stock = closestInteractive(target, '[data-merchant-stock]', event)
  if (stock) { const entry = merchant.value?.stock?.[Number(stock.dataset.merchantStock)]; const definition = getItemDefinition(entry?.itemId); return definition ? () => openItemDetail({ ...definition, uid: `merchant-preview-${definition.id}` }) : null }
  const merchantRelic = closestInteractive(target, '[data-merchant-relic-choice]', event)
  if (merchantRelic) return () => openRelicDetail(merchantRelic.dataset.merchantRelicChoice)
  return null
}

function touchPoint(event, identifier = null) {
  const points = [...(event.touches || []), ...(event.changedTouches || [])]
  return points.find((point) => identifier == null || point.identifier === identifier) || null
}
function changedTouch(event, identifier) {
  return [...(event.changedTouches || [])].find((point) => point.identifier === identifier) || null
}
function cancelLongPress() {
  if (hold.value?.timer) window.clearTimeout(hold.value.timer)
  hold.value = null
}
function startLongPress(openDetail, event) {
  if (!openDetail) return
  const point = touchPoint(event)
  if (!point || event.touches?.length > 1) return
  if (hold.value?.identifier === point.identifier) return
  cancelLongPress()
  const nextHold = { identifier: point.identifier, x: point.clientX, y: point.clientY, index: null, opened: false, timer: null }
  nextHold.timer = window.setTimeout(() => {
    if (hold.value !== nextHold) return
    nextHold.opened = Boolean(openDetail())
  }, DETAIL_HOLD_MS)
  hold.value = nextHold
}
function refreshBagGesture(session) { bagGesture.value = { ...session } }
function pointInZone(zone, x, y) {
  const rect = zone.value?.getBoundingClientRect?.()
  return !!rect && x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom
}
function stashPositionAtPoint(x, y, item, rotation) {
  const rect = stashZone.value?.getBoundingClientRect?.()
  return stashPositionForPoint({
    item,
    rotation,
    clientX: x,
    clientY: y,
    stashRect: rect,
    gridRect: backpackGrid.value?.getBoundingClientRect?.(),
    backpack: run.backpack,
    columns: INVENTORY_COLUMNS,
    rows: INVENTORY_ROWS,
  })
}
function ensureAutoStashPosition(item, rotation, index) {
  const current = stashPositions[item.uid]
  if (current && !current.pendingAuto) return current
  const position = automaticStashPosition({
    item,
    rotation,
    stashItems: state.value.inventoryStash,
    positions: stashPositions,
    stashRect: stashZone.value?.getBoundingClientRect?.(),
    gridRect: backpackGrid.value?.getBoundingClientRect?.(),
    backpack: run.backpack,
    columns: INVENTORY_COLUMNS,
    rows: INVENTORY_ROWS,
  })
  if (position) {
    const resolved = { ...position, pendingAuto: false }
    stashPositions[item.uid] = resolved
    return resolved
  }
  const fallback = current || { x: 18 + (index % 3) * 27, y: 24 + Math.floor(index / 3) * 24, pendingAuto: true }
  stashPositions[item.uid] = fallback
  return fallback
}
function dragTargetIndexAtPoint(session, x, y) {
  return inventoryDropAnchorAtCenter({
    backpack: run.backpack,
    item: session.item,
    rotation: session.rotation,
    gridRect: backpackGrid.value?.getBoundingClientRect?.(),
    clientX: x,
    clientY: y,
    columns: INVENTORY_COLUMNS,
    rows: INVENTORY_ROWS,
  })
}
function clearBagGesture({ closeDetail = true } = {}) {
  const session = bagGesture.value
  if (session?.timer) window.clearTimeout(session.timer)
  bagGesture.value = null
  scene.value?.clearWeaponRange()
  if (closeDetail && session?.detailOpened) closeDetailPanel()
}
function beginBagDrag(session, point = null) {
  if (session.dragging) return
  if (session.timer) window.clearTimeout(session.timer)
  scene.value?.clearWeaponRange()
  closeDetailPanel()
  session.dragging = true
  session.pointerX = point?.clientX ?? session.pointerX
  session.pointerY = point?.clientY ?? session.pointerY
  session.targetIndex = dragTargetIndexAtPoint(session, session.pointerX, session.pointerY) ?? session.originIndex
  session.lastValidTargetIndex = session.targetIndex
  refreshBagGesture(session)
}
function rotationTargetIndex(session, nextRotation) {
  if (!Number.isInteger(session.targetIndex)) return session.targetIndex
  const currentShape = run.backpack.shapeFor(session.item, session.rotation)
  const nextShape = run.backpack.shapeFor(session.item, nextRotation)
  const currentOrigin = run.backpack.originForAnchorCell(session.item, session.targetIndex, session.rotation)
  if (!currentOrigin) return session.targetIndex
  const centerX = currentOrigin.x + (currentShape[0].length - 1) / 2
  const centerY = currentOrigin.y + (currentShape.length - 1) / 2
  const nextOrigin = {
    x: Math.round(centerX - (nextShape[0].length - 1) / 2),
    y: Math.round(centerY - (nextShape.length - 1) / 2),
  }
  const anchor = run.backpack.anchorFor(session.item, nextRotation)
  return (nextOrigin.y + anchor.y) * INVENTORY_COLUMNS + nextOrigin.x + anchor.x
}
function rotateBagGesture() {
  const session = bagGesture.value
  if (!session || session.item?.rotatable === false || (!session.detailOpened && !session.dragging)) return
  if (!session.dragging) beginBagDrag(session)
  const nextRotation = (session.rotation + 1) % 4
  session.targetIndex = rotationTargetIndex(session, nextRotation)
  session.rotation = nextRotation
  refreshBagGesture(session)
}
function onBagTouchStart(index, event) {
  if (run.itemTargeting) return
  const active = bagGesture.value
  if (active && event.touches?.length > 1) {
    event.preventDefault()
    const secondary = [...event.touches].find((touch) => touch.identifier !== active.identifier)
    if (!secondary || active.rotationTouch === secondary.identifier) return
    active.rotationTouch = secondary.identifier
    rotateBagGesture()
    return
  }
  const item = run.backpack.placementForCellIndex(index)?.item
  if (!item) return
  event.stopPropagation()
  event.preventDefault()
  const point = touchPoint(event)
  if (!point) return
  clearBagGesture({ closeDetail: false })
  const placement = run.backpack.placementOf(item.uid)
  const session = {
    token: ++bagGestureSequence,
    identifier: point.identifier,
    item,
    source: 'backpack',
    originIndex: run.backpack.originIndex(placement),
    rotation: placement?.rotation || 0,
    pointerX: point.clientX,
    pointerY: point.clientY,
    startX: point.clientX,
    startY: point.clientY,
    targetIndex: null,
    moved: false,
    detailOpened: false,
    dragging: false,
    timer: null,
  }
  session.timer = window.setTimeout(() => {
    if (bagGesture.value?.token !== session.token) return
    session.detailOpened = Boolean(openItemDetail(item))
    if (session.detailOpened && item.type === 'weapon') scene.value?.showWeaponRange(item.uid)
    refreshBagGesture(session)
  }, DETAIL_HOLD_MS)
  bagGesture.value = session
}
function onStashTouchStart(item, event) {
  if (run.itemTargeting) return
  const active = bagGesture.value
  if (active && event.touches?.length > 1) {
    event.preventDefault()
    const secondary = [...event.touches].find((touch) => touch.identifier !== active.identifier)
    if (!secondary || active.rotationTouch === secondary.identifier) return
    active.rotationTouch = secondary.identifier
    rotateBagGesture()
    return
  }
  event.stopPropagation()
  event.preventDefault()
  const point = touchPoint(event)
  if (!point) return
  clearBagGesture({ closeDetail: false })
  const session = {
    token: ++bagGestureSequence,
    identifier: point.identifier,
    item,
    source: 'stash',
    originIndex: null,
    rotation: Number(item.bagRotation) || 0,
    pointerX: point.clientX,
    pointerY: point.clientY,
    startX: point.clientX,
    startY: point.clientY,
    targetIndex: null,
    moved: false,
    detailOpened: false,
    dragging: false,
    timer: null,
  }
  session.timer = window.setTimeout(() => {
    if (bagGesture.value?.token !== session.token) return
    session.detailOpened = Boolean(openItemDetail(item))
    refreshBagGesture(session)
  }, DETAIL_HOLD_MS)
  bagGesture.value = session
}
function updateBagGesturePoint(point) {
  const session = bagGesture.value
  if (!session || !point || point.identifier !== session.identifier) return
  session.pointerX = point.clientX
  session.pointerY = point.clientY
  session.targetIndex = dragTargetIndexAtPoint(session, point.clientX, point.clientY)
  if (Number.isInteger(session.targetIndex)) session.lastValidTargetIndex = session.targetIndex
  refreshBagGesture(session)
}
function onBagTouchMove(event) {
  const session = bagGesture.value
  const point = touchPoint(event, session?.identifier)
  if (!session || !point) return
  const distance = Math.hypot(point.clientX - session.startX, point.clientY - session.startY)
  if (!session.dragging) {
    if (distance <= BAG_DRAG_TOLERANCE) return
    session.moved = true
    if (!session.detailOpened) {
      clearBagGesture({ closeDetail: false })
      return
    }
    beginBagDrag(session, point)
  }
  event.preventDefault()
  updateBagGesturePoint(point)
}
function commitBagGesture() {
  const session = bagGesture.value
  if (!session?.dragging) return false
  const { item } = session
  const x = session.pointerX
  const y = session.pointerY
  if (pointInZone(discardZone, x, y)) {
    const changed = run.discardInventoryItem(item.uid)
    clearBagGesture()
    return changed
  }
  if (pointInZone(stashZone, x, y)) {
    if (session.source === 'backpack') {
      if (!run.moveInventoryToStash(item.uid, { rotation: session.rotation })) {
        clearBagGesture()
        return false
      }
      stashPositions[item.uid] = stashPositionAtPoint(x, y, item, session.rotation)
    } else {
      if (!run.setStashedInventoryRotation(item.uid, session.rotation)) {
        clearBagGesture()
        return false
      }
      stashPositions[item.uid] = stashPositionAtPoint(x, y, item, session.rotation)
    }
    clearBagGesture()
    return true
  }
  const targetIndex = session.targetIndex
  const preview = targetIndex == null ? null : run.previewInventoryDrop(item, targetIndex, { rotation: session.rotation })
  if (!preview || preview.status === 'blocked') {
    clearBagGesture()
    return false
  }
  const result = run.commitInventoryDrop(item, targetIndex, { rotation: session.rotation })
  if (!result) {
    clearBagGesture()
    return false
  }
  for (const conflict of result.conflicts) {
    stashPositions[conflict.uid] = { pendingAuto: true }
  }
  clearBagGesture()
  return true
}
function onBagTouchEnd(event) {
  const session = bagGesture.value
  if (!session || !changedTouch(event, session.identifier)) return
  if (session.timer) window.clearTimeout(session.timer)
  if (session.dragging) {
    ignoreClicksUntil = Date.now() + 250
    commitBagGesture()
    return
  }
  if (session.detailOpened) {
    closeDetailPanel()
    ignoreClicksUntil = Date.now() + 250
  }
  else if (!session.moved && session.source === 'backpack') {
    onBagCellClick(session.originIndex)
    ignoreClicksUntil = Date.now() + 250
  }
  clearBagGesture({ closeDetail: false })
}
function onBagTouchCancel() { clearBagGesture() }
function onInteractionInterrupt() { onBagTouchCancel(); cancelLongPress() }
function onStashTouchMove(event) { onBagTouchMove(event) }
function onStashTouchEnd(event) { onBagTouchEnd(event) }
function onStashTouchCancel() { onBagTouchCancel() }
function onStageTouchMove(event) { onBagTouchMove(event) }
function onStageTouchEnd(event) { onBagTouchEnd(event) }
function onWindowTouchStart(event) {
  const session = bagGesture.value
  if (!session || (!session.detailOpened && !session.dragging) || event.touches?.length < 2) return
  const secondary = [...event.touches].find((touch) => touch.identifier !== session.identifier)
  if (!secondary || session.rotationTouch === secondary.identifier) return
  event.preventDefault()
  session.rotationTouch = secondary.identifier
  rotateBagGesture()
}
function onWindowTouchMove(event) {
  const session = bagGesture.value
  if (!session?.dragging) return
  const point = touchPoint(event, session.identifier)
  if (!point) return
  event.preventDefault()
  updateBagGesturePoint(point)
}
function onWindowTouchEnd(event) {
  const session = bagGesture.value
  if (!session) return
  if (session.rotationTouch != null && ![...(event.touches || [])].some((touch) => touch.identifier === session.rotationTouch)) session.rotationTouch = null
  if (changedTouch(event, session.identifier)) onBagTouchEnd(event)
}
function onWindowTouchCancel() { onBagTouchCancel() }
function onStatusTouchStart(entry, event) {
  startLongPress(() => openStatusDetail(entry), event)
}
function onDetailTouchStart(event) {
  const openDetail = detailActionFor(event.currentTarget, event)
  startLongPress(openDetail, event)
}
function onTouchMove(event) {
  const current = hold.value
  const point = touchPoint(event, current?.identifier)
  if (!current || !point || current.opened) return
  if (Math.abs(point.clientX - current.x) + Math.abs(point.clientY - current.y) <= 18) return
  cancelLongPress()
}
function onTouchEnd(event) {
  const current = hold.value
  if (!current || !changedTouch(event, current.identifier)) return
  if (current.timer) window.clearTimeout(current.timer)
  hold.value = null
  if (!current.opened) {
    if (current.index != null) onBagCellClick(current.index)
    return
  }
  closeDetailPanel()
  ignoreClicksUntil = Date.now() + 250
}
function onTouchCancel(event) {
  const current = hold.value
  if (!current || !changedTouch(event, current.identifier)) return
  cancelLongPress()
}
function handleAction(action, value = null) {
  if (Date.now() < ignoreClicksUntil) return
  if (action === 'craft-result') { run.craft(value); return }
  if (action === 'merchant-tab') { selectMerchantTab(value); return }
  if (action === 'level-up-choice') { chooseLevelUp(value); return }
  if (action === 'room-reward') { chooseRoomReward(Number(value)); return }
  if (action === 'merchant-stock') { run.buyMerchantItem(Number(value)); return }
  if (action === 'merchant-relic') {
    if (state.value.player.gold < (merchant.value?.relicOfferPrice || 0)) return
    chooseMerchantRelic(value)
    return
  }
  if (action === 'copy-log') { void copyLog(); return }
  if (action === 'craft-open') { if (craftAvailable.value) craftOpen.value = true; return }
  if (action === 'craft-close') { craftOpen.value = false; return }
  if (action === 'use') run.useSelected()
  if (action === 'end-turn') run.endPlayerTurn()
  if (action === 'camera-pitch-minus') { scene.value?.adjustCameraPitch(-1); uiRevision.value++ }
  if (action === 'camera-pitch-plus') { scene.value?.adjustCameraPitch(1); uiRevision.value++ }
  if (action === 'restart') restartGame()
  if (action === 'restart-settings') restartFromSettings()
  if (action === 'close-merchant') run.closeMerchant()
  if (action === 'merchant-sell') run.sellSelectedMerchantItem()
  if (action === 'merchant-refresh') run.refreshMerchantInventory()
  if (action === 'skip-room-reward') run.skipRoomReward()
  if (action === 'close-detail') closeDetailPanel()
  if (action === 'log') toggleTopPanel('log')
  if (action === 'settings') toggleTopPanel('settings')
  if (action === 'character') toggleTopPanel('characterpanel')
  if (action === 'help') { topPanel.value = null; helpOpen.value = true }
  if (action === 'close-help') helpOpen.value = false
}

async function copyLog() {
  const text = run.log.slice(0, 40).join('\n')
  if (!text) return
  let copied = false
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); copied = true } } catch { copied = false }
  if (!copied) {
    const textarea = document.createElement('textarea')
    textarea.value = text; textarea.setAttribute('readonly', ''); textarea.style.position = 'fixed'; textarea.style.opacity = '0'
    document.body.appendChild(textarea); textarea.select()
    try { copied = document.execCommand('copy') } catch { copied = false }
    textarea.remove()
  }
  copyLabel.value = copied ? LABELS.copied : LABELS.copyFailed
  window.setTimeout(() => { copyLabel.value = LABELS.copyLog }, 1600)
}
function updateReveal() {
  run.setDebugReveal(reveal.value)
  if (typeof localStorage !== 'undefined') localStorage.setItem('v2_opt_reveal', reveal.value ? '1' : '0')
}

onMounted(() => {
  // Subscribe Vue before constructing Three.js.  GameScene performs an
  // initial rebuild in its constructor and also subscribes to the same model;
  // keeping the HUD subscription first guarantees that a scene-side failure
  // cannot delay the reactive update (the emitter also isolates listeners).
  subscriptions.push(run.on('change', () => { revision.value++ }))
  subscriptions.push(run.on('detail', () => {
    detailRevision.value++
    detailPanelVisible.value = Boolean(run.detailPanel)
  }))
  scene.value = new GameScene(run, sceneContainer.value)
  run.setDebugReveal(reveal.value)
  window.addEventListener('touchstart', onWindowTouchStart, { passive: false, capture: true })
  window.addEventListener('touchmove', onWindowTouchMove, { passive: false })
  window.addEventListener('touchend', onWindowTouchEnd, { passive: false, capture: true })
  window.addEventListener('touchcancel', onWindowTouchCancel, { passive: false, capture: true })
  window.addEventListener('blur', onInteractionInterrupt)
  document.addEventListener('visibilitychange', onInteractionInterrupt)
})
onBeforeUnmount(() => {
  window.removeEventListener('touchstart', onWindowTouchStart, true)
  window.removeEventListener('touchmove', onWindowTouchMove)
  window.removeEventListener('touchend', onWindowTouchEnd, true)
  window.removeEventListener('touchcancel', onWindowTouchCancel, true)
  window.removeEventListener('blur', onInteractionInterrupt)
  document.removeEventListener('visibilitychange', onInteractionInterrupt)
  for (const unsubscribe of subscriptions) unsubscribe?.()
  cancelLongPress()
  clearBagGesture()
  scene.value?.dispose()
})
</script>
