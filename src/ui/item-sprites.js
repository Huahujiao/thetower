/* global URL */
// Keep every URL literal so Vite fingerprints and copies both runtime sizes.
// The HUD starts with the small image, then upgrades to medium after decoding.
const ITEM_SPRITE_SOURCES = Object.freeze({
  'butcher-knife': {
    small: new URL('../assets/inventory/weapon-butcher-knife-v2-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-butcher-knife-v2-medium.png', import.meta.url).href,
  },
  'hunter-shortbow': {
    small: new URL('../assets/inventory/weapon-hunter-shortbow-v2-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-hunter-shortbow-v2-medium.png', import.meta.url).href,
  },
  'scouting-bow': {
    small: new URL('../assets/inventory/weapon-scouting-bow-v2-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-scouting-bow-v2-medium.png', import.meta.url).href,
  },
  'bounty-bow': {
    small: new URL('../assets/inventory/weapon-bounty-bow-v2-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-bounty-bow-v2-medium.png', import.meta.url).href,
  },
  'demon-seeker': {
    small: new URL('../assets/inventory/weapon-demon-seeker-v2-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-demon-seeker-v2-medium.png', import.meta.url).href,
  },
  'r-vampire-fang': {
    small: new URL('../assets/inventory/relic-vampire-fang-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-vampire-fang-v1-medium.png', import.meta.url).href,
  },
  'r-feeding-charm': {
    small: new URL('../assets/inventory/relic-feeding-charm-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-feeding-charm-v1-medium.png', import.meta.url).href,
  },
  'r-pack-hunt': {
    small: new URL('../assets/inventory/relic-pack-hunt-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-pack-hunt-v1-medium.png', import.meta.url).href,
  },
  'r-hunting-horn': {
    small: new URL('../assets/inventory/relic-hunting-horn-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-hunting-horn-v1-medium.png', import.meta.url).href,
  },
  'r-far-whistle': {
    small: new URL('../assets/inventory/relic-far-whistle-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-far-whistle-v1-medium.png', import.meta.url).href,
  },
  'r-totem-soul': {
    small: new URL('../assets/inventory/relic-totem-soul-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-totem-soul-v1-medium.png', import.meta.url).href,
  },
  'r-totem-gas': {
    small: new URL('../assets/inventory/relic-totem-gas-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-totem-gas-v1-medium.png', import.meta.url).href,
  },
  'r-totem-bind': {
    small: new URL('../assets/inventory/relic-totem-bind-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-totem-bind-v1-medium.png', import.meta.url).href,
  },
  'r-totem-spirit': {
    small: new URL('../assets/inventory/relic-totem-spirit-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-totem-spirit-v1-medium.png', import.meta.url).href,
  },
  'r-totem-breath': {
    small: new URL('../assets/inventory/relic-totem-breath-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-totem-breath-v1-medium.png', import.meta.url).href,
  },
  'r-totem-ward': {
    small: new URL('../assets/inventory/relic-totem-ward-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-totem-ward-v1-medium.png', import.meta.url).href,
  },
  'r-totem-drum': {
    small: new URL('../assets/inventory/relic-totem-drum-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-totem-drum-v1-medium.png', import.meta.url).href,
  },
  'r-launcher': {
    small: new URL('../assets/inventory/relic-launcher-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-launcher-v1-medium.png', import.meta.url).href,
  },
  'r-chain-drink': {
    small: new URL('../assets/inventory/relic-chain-drink-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-chain-drink-v1-medium.png', import.meta.url).href,
  },
  'r-loot-pouch': {
    small: new URL('../assets/inventory/relic-loot-pouch-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-loot-pouch-v1-medium.png', import.meta.url).href,
  },
  'r-pill-ticket': {
    small: new URL('../assets/inventory/relic-pill-ticket-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-pill-ticket-v1-medium.png', import.meta.url).href,
  },
  'r-furnace': {
    small: new URL('../assets/inventory/relic-furnace-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-furnace-v1-medium.png', import.meta.url).href,
  },
  'r-gold-fuel': {
    small: new URL('../assets/inventory/relic-gold-fuel-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-gold-fuel-v1-medium.png', import.meta.url).href,
  },
  'r-wealth-scale': {
    small: new URL('../assets/inventory/relic-wealth-scale-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-wealth-scale-v1-medium.png', import.meta.url).href,
  },
  'r-range-mirror': {
    small: new URL('../assets/inventory/relic-range-mirror-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-range-mirror-v1-medium.png', import.meta.url).href,
  },
  'r-extreme-range': {
    small: new URL('../assets/inventory/relic-extreme-range-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-extreme-range-v1-medium.png', import.meta.url).href,
  },
  'rust-sword': {
    small: new URL('../assets/inventory/weapon-rust-sword-v2-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-rust-sword-v2-medium.png', import.meta.url).href,
  },
  'bone-knife': {
    small: new URL('../assets/inventory/weapon-bone-knife-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-bone-knife-v1-medium.png', import.meta.url).href,
  },
  'ember-spear': {
    small: new URL('../assets/inventory/weapon-ember-spear-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-ember-spear-v1-medium.png', import.meta.url).href,
  },
  'root-axe': {
    small: new URL('../assets/inventory/weapon-root-axe-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-root-axe-v1-medium.png', import.meta.url).href,
  },
  'rock-maul': {
    small: new URL('../assets/inventory/weapon-rock-maul-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-rock-maul-v1-medium.png', import.meta.url).href,
  },
  'bell-maul': {
    small: new URL('../assets/inventory/weapon-bell-maul-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-bell-maul-v1-medium.png', import.meta.url).href,
  },
  'wall-sword': {
    small: new URL('../assets/inventory/weapon-wall-sword-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-wall-sword-v1-medium.png', import.meta.url).href,
  },
  'return-axe': {
    small: new URL('../assets/inventory/weapon-return-axe-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-return-axe-v1-medium.png', import.meta.url).href,
  },
  'mountain-maul': {
    small: new URL('../assets/inventory/weapon-mountain-maul-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-mountain-maul-v1-medium.png', import.meta.url).href,
  },
  'silver-guard': {
    small: new URL('../assets/inventory/weapon-silver-guard-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-silver-guard-v1-medium.png', import.meta.url).href,
  },
  'ember-axe': {
    small: new URL('../assets/inventory/weapon-ember-axe-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-ember-axe-v1-medium.png', import.meta.url).href,
  },
  'tide-blade': {
    small: new URL('../assets/inventory/weapon-tide-blade-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-tide-blade-v1-medium.png', import.meta.url).href,
  },
  'erosion-knife': {
    small: new URL('../assets/inventory/weapon-erosion-knife-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-erosion-knife-v1-medium.png', import.meta.url).href,
  },
  'thorn-spear': {
    small: new URL('../assets/inventory/weapon-thorn-spear-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-thorn-spear-v1-medium.png', import.meta.url).href,
  },
  'soul-spear': {
    small: new URL('../assets/inventory/weapon-soul-spear-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-soul-spear-v1-medium.png', import.meta.url).href,
  },
  'wood-bow': {
    small: new URL('../assets/inventory/weapon-wood-bow-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-wood-bow-v1-medium.png', import.meta.url).href,
  },
  'ash-bow': {
    small: new URL('../assets/inventory/weapon-ash-bow-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-ash-bow-v1-medium.png', import.meta.url).href,
  },
  'eagle-bow': {
    small: new URL('../assets/inventory/weapon-eagle-bow-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-eagle-bow-v1-medium.png', import.meta.url).href,
  },
  'triad-ember': {
    small: new URL('../assets/inventory/weapon-triad-ember-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-triad-ember-v1-medium.png', import.meta.url).href,
  },
  'triad-wither': {
    small: new URL('../assets/inventory/weapon-triad-wither-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-triad-wither-v1-medium.png', import.meta.url).href,
  },
  'triad-tide': {
    small: new URL('../assets/inventory/weapon-triad-tide-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-triad-tide-v1-medium.png', import.meta.url).href,
  },
  'coin-blade': {
    small: new URL('../assets/inventory/weapon-coin-blade-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-coin-blade-v1-medium.png', import.meta.url).href,
  },
  'r-three': {
    small: new URL('../assets/inventory/relic-three-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-three-v1-medium.png', import.meta.url).href,
  },
  'r-empty': {
    small: new URL('../assets/inventory/relic-empty-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-empty-v1-medium.png', import.meta.url).href,
  },
  'r-reverse': {
    small: new URL('../assets/inventory/relic-reverse-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-reverse-v1-medium.png', import.meta.url).href,
  },
  'r-traveler': {
    small: new URL('../assets/inventory/relic-traveler-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-traveler-v1-medium.png', import.meta.url).href,
  },
  'r-blood': {
    small: new URL('../assets/inventory/relic-blood-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-blood-v1-medium.png', import.meta.url).href,
  },
  'r-scales': {
    small: new URL('../assets/inventory/relic-scales-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-scales-v1-medium.png', import.meta.url).href,
  },
  'r-heavy-wrist': {
    small: new URL('../assets/inventory/relic-heavy-wrist-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-heavy-wrist-v1-medium.png', import.meta.url).href,
  },
  'r-step-boots': {
    small: new URL('../assets/inventory/relic-step-boots-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-step-boots-v1-medium.png', import.meta.url).href,
  },
  'r-turn-shield': {
    small: new URL('../assets/inventory/relic-turn-shield-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-turn-shield-v1-medium.png', import.meta.url).href,
  },
  'r-relay-badge': {
    small: new URL('../assets/inventory/relic-relay-badge-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-relay-badge-v1-medium.png', import.meta.url).href,
  },
  'r-guard-return': {
    small: new URL('../assets/inventory/relic-guard-return-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-guard-return-v1-medium.png', import.meta.url).href,
  },
  'r-phase-pointer': {
    small: new URL('../assets/inventory/relic-phase-pointer-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-phase-pointer-v1-medium.png', import.meta.url).href,
  },
  'r-money-scale': {
    small: new URL('../assets/inventory/relic-money-scale-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-money-scale-v1-medium.png', import.meta.url).href,
  },
  'r-trade-voucher': {
    small: new URL('../assets/inventory/relic-trade-voucher-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-trade-voucher-v1-medium.png', import.meta.url).href,
  },
  'gold-hook': {
    small: new URL('../assets/inventory/relic-gold-hook-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-gold-hook-v1-medium.png', import.meta.url).href,
  },
  'r-ledger': {
    small: new URL('../assets/inventory/relic-ledger-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-ledger-v1-medium.png', import.meta.url).href,
  },
  'r-poison-hourglass': {
    small: new URL('../assets/inventory/relic-poison-hourglass-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-poison-hourglass-v1-medium.png', import.meta.url).href,
  },
  'r-step-edge': {
    small: new URL('../assets/inventory/relic-step-edge-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-step-edge-v1-medium.png', import.meta.url).href,
  },
  'r-single-seal': {
    small: new URL('../assets/inventory/relic-single-seal-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-single-seal-v1-medium.png', import.meta.url).href,
  },
  'r-neutral-stone': {
    small: new URL('../assets/inventory/relic-neutral-stone-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-neutral-stone-v1-medium.png', import.meta.url).href,
  },
  'r-lone-edge': {
    small: new URL('../assets/inventory/relic-lone-edge-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-lone-edge-v1-medium.png', import.meta.url).href,
  },
  'r-armor-command': {
    small: new URL('../assets/inventory/relic-armor-command-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-armor-command-v1-medium.png', import.meta.url).href,
  },
  'r-miasma-sac': {
    small: new URL('../assets/inventory/relic-miasma-sac-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-miasma-sac-v1-medium.png', import.meta.url).href,
  },
  'r-bone-incense': {
    small: new URL('../assets/inventory/relic-bone-incense-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-bone-incense-v1-medium.png', import.meta.url).href,
  },
  'r-plague-bell': {
    small: new URL('../assets/inventory/relic-plague-bell-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-plague-bell-v1-medium.png', import.meta.url).href,
  },
  'r-switch-ring': {
    small: new URL('../assets/inventory/relic-switch-ring-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-switch-ring-v1-medium.png', import.meta.url).href,
  },
  'r-iron-will': {
    small: new URL('../assets/inventory/relic-iron-will-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-iron-will-v1-medium.png', import.meta.url).href,
  },
  'r-armor-ring': {
    small: new URL('../assets/inventory/relic-armor-ring-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-armor-ring-v1-medium.png', import.meta.url).href,
  },
  'wood-shield': {
    small: new URL('../assets/inventory/defense-wood-shield-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-wood-shield-v1-medium.png', import.meta.url).href,
  },
  'thorn-shield': {
    small: new URL('../assets/inventory/defense-thorn-shield-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-thorn-shield-v1-medium.png', import.meta.url).href,
  },
  'tide-shield': {
    small: new URL('../assets/inventory/defense-tide-shield-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-tide-shield-v1-medium.png', import.meta.url).href,
  },
  'red-shield': {
    small: new URL('../assets/inventory/defense-red-shield-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-red-shield-v1-medium.png', import.meta.url).href,
  },
  'light-armor': {
    small: new URL('../assets/inventory/defense-light-armor-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-light-armor-v1-medium.png', import.meta.url).href,
  },
  'red-armor': {
    small: new URL('../assets/inventory/defense-red-armor-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-red-armor-v1-medium.png', import.meta.url).href,
  },
  'vine-armor': {
    small: new URL('../assets/inventory/defense-vine-armor-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-vine-armor-v1-medium.png', import.meta.url).href,
  },
  'tide-cloak': {
    small: new URL('../assets/inventory/defense-tide-cloak-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-tide-cloak-v1-medium.png', import.meta.url).href,
  },
  'phase-armor': {
    small: new URL('../assets/inventory/defense-phase-armor-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-phase-armor-v1-medium.png', import.meta.url).href,
  },
  'renewal-armor': {
    small: new URL('../assets/inventory/defense-renewal-armor-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-renewal-armor-v1-medium.png', import.meta.url).href,
  },
  'mountain-shield': {
    small: new URL('../assets/inventory/defense-mountain-shield-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-mountain-shield-v1-medium.png', import.meta.url).href,
  },
  'farwatch-armor': {
    small: new URL('../assets/inventory/defense-farwatch-armor-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-farwatch-armor-v1-medium.png', import.meta.url).href,
  },
  'gold-pick-armor': {
    small: new URL('../assets/inventory/defense-gold-pick-armor-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-gold-pick-armor-v1-medium.png', import.meta.url).href,
  },
  'coin-armor': {
    small: new URL('../assets/inventory/defense-coin-armor-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-coin-armor-v1-medium.png', import.meta.url).href,
  },
  'bath-robe': {
    small: new URL('../assets/inventory/defense-bath-robe-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-bath-robe-v1-medium.png', import.meta.url).href,
  },
  'beast-armor': {
    small: new URL('../assets/inventory/defense-beast-armor-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-beast-armor-v1-medium.png', import.meta.url).href,
  },
  'shield-core': {
    small: new URL('../assets/inventory/material-shield-core-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-shield-core-v1-medium.png', import.meta.url).href,
  },
  spring: {
    small: new URL('../assets/inventory/material-spring-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-spring-v1-medium.png', import.meta.url).href,
  },
  'venom-sac': {
    small: new URL('../assets/inventory/material-venom-sac-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-venom-sac-v1-medium.png', import.meta.url).href,
  },
  chain: {
    small: new URL('../assets/inventory/material-chain-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-chain-v1-medium.png', import.meta.url).href,
  },
  scope: {
    small: new URL('../assets/inventory/material-scope-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-scope-v1-medium.png', import.meta.url).href,
  },
  weight: {
    small: new URL('../assets/inventory/material-weight-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-weight-v1-medium.png', import.meta.url).href,
  },
  'range-disc': {
    small: new URL('../assets/inventory/material-range-disc-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-range-disc-v1-medium.png', import.meta.url).href,
  },
  'steady-clip': {
    small: new URL('../assets/inventory/material-steady-clip-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-steady-clip-v1-medium.png', import.meta.url).href,
  },
  'bone-nail': {
    small: new URL('../assets/inventory/material-bone-nail-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-bone-nail-v1-medium.png', import.meta.url).href,
  },
  'toxin-vial': {
    small: new URL('../assets/inventory/material-toxin-vial-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-toxin-vial-v1-medium.png', import.meta.url).href,
  },
  conduit: {
    small: new URL('../assets/inventory/material-conduit-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-conduit-v1-medium.png', import.meta.url).href,
  },
  'fork-connector': {
    small: new URL('../assets/inventory/material-fork-connector-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-fork-connector-v1-medium.png', import.meta.url).href,
  },
  'wall-core': {
    small: new URL('../assets/inventory/material-wall-core-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-wall-core-v1-medium.png', import.meta.url).href,
  },
  'return-axle': {
    small: new URL('../assets/inventory/material-return-axle-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-return-axle-v1-medium.png', import.meta.url).href,
  },
  'corrosive-heart-core': {
    small: new URL('../assets/inventory/material-corrosive-heart-core-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-corrosive-heart-core-v1-medium.png', import.meta.url).href,
  },
  'soul-chain': {
    small: new URL('../assets/inventory/material-soul-chain-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-soul-chain-v1-medium.png', import.meta.url).href,
  },
  'beast-hunting-horn': {
    small: new URL('../assets/inventory/material-beast-hunting-horn-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-beast-hunting-horn-v1-medium.png', import.meta.url).href,
  },
  'mountain-break-stone': {
    small: new URL('../assets/inventory/material-mountain-break-stone-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-mountain-break-stone-v1-medium.png', import.meta.url).href,
  },
  'health-potion': {
    small: new URL('../assets/inventory/item-health-potion-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-health-potion-v1-medium.png', import.meta.url).href,
  },
  'iron-powder': {
    small: new URL('../assets/inventory/item-iron-powder-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-iron-powder-v1-medium.png', import.meta.url).href,
  },
  cleanse: {
    small: new URL('../assets/inventory/item-cleanse-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-cleanse-v1-medium.png', import.meta.url).href,
  },
  'rage-wine': {
    small: new URL('../assets/inventory/item-rage-wine-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-rage-wine-v1-medium.png', import.meta.url).href,
  },
  teleport: {
    small: new URL('../assets/inventory/item-teleport-talisman-v2-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-teleport-talisman-v2-medium.png', import.meta.url).href,
  },
  'food-3': {
    small: new URL('../assets/inventory/item-food-3-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-food-3-v1-medium.png', import.meta.url).href,
  },
  'food-5': {
    small: new URL('../assets/inventory/item-food-5-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-food-5-v1-medium.png', import.meta.url).href,
  },
  'food-7': {
    small: new URL('../assets/inventory/item-food-7-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-food-7-v1-medium.png', import.meta.url).href,
  },
  'food-9': {
    small: new URL('../assets/inventory/item-food-9-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-food-9-v1-medium.png', import.meta.url).href,
  },
  poison: {
    small: new URL('../assets/inventory/item-poison-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-poison-v1-medium.png', import.meta.url).href,
  },
  explosive: {
    small: new URL('../assets/inventory/item-explosive-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-explosive-v1-medium.png', import.meta.url).href,
  },
  'thunder-charm': {
    small: new URL('../assets/inventory/item-thunder-charm-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-thunder-charm-v1-medium.png', import.meta.url).href,
  },
  'shield-bash': {
    small: new URL('../assets/inventory/item-shield-bash-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-shield-bash-v1-medium.png', import.meta.url).href,
  },
  'meat-scrap': {
    small: new URL('../assets/inventory/item-meat-scrap-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-meat-scrap-v1-medium.png', import.meta.url).href,
  },
  'money-pouch': {
    small: new URL('../assets/inventory/item-money-pouch-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-money-pouch-v1-medium.png', import.meta.url).href,
  },
})

// Gold is a room-floor entity rather than an inventory item.  Keep its
// quantity-specific artwork in its own map so it cannot be confused with an
// item id or accidentally enter the backpack sprite contract.
const GOLD_SPRITE_SOURCES = Object.freeze({
  3: {
    small: new URL('../assets/inventory/gold-pile-3-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/gold-pile-3-v1-medium.png', import.meta.url).href,
  },
  4: {
    small: new URL('../assets/inventory/gold-pile-4-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/gold-pile-4-v1-medium.png', import.meta.url).href,
  },
  5: {
    small: new URL('../assets/inventory/gold-pile-5-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/gold-pile-5-v1-medium.png', import.meta.url).href,
  },
  6: {
    small: new URL('../assets/inventory/gold-pile-6-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/gold-pile-6-v1-medium.png', import.meta.url).href,
  },
  7: {
    small: new URL('../assets/inventory/gold-pile-7-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/gold-pile-7-v1-medium.png', import.meta.url).href,
  },
})

export function itemSpriteSources(item) {
  return item?.id ? ITEM_SPRITE_SOURCES[item.id] || null : null
}

export function goldSpriteSources(amount) {
  return GOLD_SPRITE_SOURCES[amount] || null
}

export function itemSpriteUrl(item) {
  return itemSpriteSources(item)?.medium || ''
}
