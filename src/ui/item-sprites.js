/* global URL */
import SPRITE_BOUNDS from './inventory-sprite-bounds.generated.json' with { type: 'json' }
// Keep every URL literal so Vite fingerprints and copies both runtime sizes.
// The HUD starts with the small image, then upgrades to medium after decoding.
const ITEM_SPRITE_SOURCES = Object.freeze({
  'mountain-hound': {
    bounds: SPRITE_BOUNDS['pet-mountain-hound-v1'],
    small: new URL('../assets/inventory/pet-mountain-hound-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/pet-mountain-hound-v1-medium.png', import.meta.url).href,
  },
  'venom-toad': {
    bounds: SPRITE_BOUNDS['pet-venom-toad-v1'],
    small: new URL('../assets/inventory/pet-venom-toad-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/pet-venom-toad-v1-medium.png', import.meta.url).href,
  },
  'thunder-raven': {
    bounds: SPRITE_BOUNDS['pet-thunder-raven-v1'],
    small: new URL('../assets/inventory/pet-thunder-raven-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/pet-thunder-raven-v1-medium.png', import.meta.url).href,
  },
  'iron-beetle': {
    bounds: SPRITE_BOUNDS['pet-iron-beetle-v1'],
    small: new URL('../assets/inventory/pet-iron-beetle-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/pet-iron-beetle-v1-medium.png', import.meta.url).href,
  },
  'shadow-spider': {
    bounds: SPRITE_BOUNDS['pet-shadow-spider-v1'],
    small: new URL('../assets/inventory/pet-shadow-spider-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/pet-shadow-spider-v1-medium.png', import.meta.url).href,
  },
  'carrion-rat': {
    bounds: SPRITE_BOUNDS['pet-carrion-rat-v1'],
    small: new URL('../assets/inventory/pet-carrion-rat-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/pet-carrion-rat-v1-medium.png', import.meta.url).href,
  },
  'spirit-raven': {
    bounds: SPRITE_BOUNDS['pet-spirit-raven-v1'],
    small: new URL('../assets/inventory/pet-spirit-raven-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/pet-spirit-raven-v1-medium.png', import.meta.url).href,
  },
  'mandrill-beast': {
    bounds: SPRITE_BOUNDS['pet-mandrill-beast-v1'],
    small: new URL('../assets/inventory/pet-mandrill-beast-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/pet-mandrill-beast-v1-medium.png', import.meta.url).href,
  },
  'butcher-knife': {
    bounds: SPRITE_BOUNDS['weapon-butcher-knife-v2'],
    small: new URL('../assets/inventory/weapon-butcher-knife-v2-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-butcher-knife-v2-medium.png', import.meta.url).href,
  },
  'hunter-shortbow': {
    bounds: SPRITE_BOUNDS['weapon-hunter-shortbow-v2'],
    small: new URL('../assets/inventory/weapon-hunter-shortbow-v2-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-hunter-shortbow-v2-medium.png', import.meta.url).href,
  },
  'scouting-bow': {
    bounds: SPRITE_BOUNDS['weapon-scouting-bow-v2'],
    small: new URL('../assets/inventory/weapon-scouting-bow-v2-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-scouting-bow-v2-medium.png', import.meta.url).href,
  },
  'bounty-bow': {
    bounds: SPRITE_BOUNDS['weapon-bounty-bow-v2'],
    small: new URL('../assets/inventory/weapon-bounty-bow-v2-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-bounty-bow-v2-medium.png', import.meta.url).href,
  },
  'demon-seeker': {
    bounds: SPRITE_BOUNDS['weapon-demon-seeker-v2'],
    small: new URL('../assets/inventory/weapon-demon-seeker-v2-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-demon-seeker-v2-medium.png', import.meta.url).href,
  },
  'r-vampire-fang': {
    bounds: SPRITE_BOUNDS['relic-vampire-fang-v1'],
    small: new URL('../assets/inventory/relic-vampire-fang-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-vampire-fang-v1-medium.png', import.meta.url).href,
  },
  'r-feeding-charm': {
    bounds: SPRITE_BOUNDS['relic-feeding-charm-v1'],
    small: new URL('../assets/inventory/relic-feeding-charm-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-feeding-charm-v1-medium.png', import.meta.url).href,
  },
  'r-pack-hunt': {
    bounds: SPRITE_BOUNDS['relic-pack-hunt-v1'],
    small: new URL('../assets/inventory/relic-pack-hunt-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-pack-hunt-v1-medium.png', import.meta.url).href,
  },
  'r-hunting-horn': {
    bounds: SPRITE_BOUNDS['relic-hunting-horn-v1'],
    small: new URL('../assets/inventory/relic-hunting-horn-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-hunting-horn-v1-medium.png', import.meta.url).href,
  },
  'r-far-whistle': {
    bounds: SPRITE_BOUNDS['relic-far-whistle-v1'],
    small: new URL('../assets/inventory/relic-far-whistle-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-far-whistle-v1-medium.png', import.meta.url).href,
  },
  'r-totem-soul': {
    bounds: SPRITE_BOUNDS['relic-totem-soul-v1'],
    small: new URL('../assets/inventory/relic-totem-soul-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-totem-soul-v1-medium.png', import.meta.url).href,
  },
  'r-totem-gas': {
    bounds: SPRITE_BOUNDS['relic-totem-gas-v1'],
    small: new URL('../assets/inventory/relic-totem-gas-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-totem-gas-v1-medium.png', import.meta.url).href,
  },
  'r-totem-bind': {
    bounds: SPRITE_BOUNDS['relic-totem-bind-v1'],
    small: new URL('../assets/inventory/relic-totem-bind-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-totem-bind-v1-medium.png', import.meta.url).href,
  },
  'r-totem-spirit': {
    bounds: SPRITE_BOUNDS['relic-totem-spirit-v1'],
    small: new URL('../assets/inventory/relic-totem-spirit-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-totem-spirit-v1-medium.png', import.meta.url).href,
  },
  'r-totem-breath': {
    bounds: SPRITE_BOUNDS['relic-totem-breath-v1'],
    small: new URL('../assets/inventory/relic-totem-breath-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-totem-breath-v1-medium.png', import.meta.url).href,
  },
  'r-totem-ward': {
    bounds: SPRITE_BOUNDS['relic-totem-ward-v1'],
    small: new URL('../assets/inventory/relic-totem-ward-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-totem-ward-v1-medium.png', import.meta.url).href,
  },
  'r-totem-drum': {
    bounds: SPRITE_BOUNDS['relic-totem-drum-v1'],
    small: new URL('../assets/inventory/relic-totem-drum-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-totem-drum-v1-medium.png', import.meta.url).href,
  },
  'r-launcher': {
    bounds: SPRITE_BOUNDS['relic-launcher-v1'],
    small: new URL('../assets/inventory/relic-launcher-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-launcher-v1-medium.png', import.meta.url).href,
  },
  'r-chain-drink': {
    bounds: SPRITE_BOUNDS['relic-chain-drink-v1'],
    small: new URL('../assets/inventory/relic-chain-drink-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-chain-drink-v1-medium.png', import.meta.url).href,
  },
  'r-loot-pouch': {
    bounds: SPRITE_BOUNDS['relic-loot-pouch-v1'],
    small: new URL('../assets/inventory/relic-loot-pouch-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-loot-pouch-v1-medium.png', import.meta.url).href,
  },
  'r-pill-ticket': {
    bounds: SPRITE_BOUNDS['relic-pill-ticket-v1'],
    small: new URL('../assets/inventory/relic-pill-ticket-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-pill-ticket-v1-medium.png', import.meta.url).href,
  },
  'r-furnace': {
    bounds: SPRITE_BOUNDS['relic-furnace-v1'],
    small: new URL('../assets/inventory/relic-furnace-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-furnace-v1-medium.png', import.meta.url).href,
  },
  'r-gold-fuel': {
    bounds: SPRITE_BOUNDS['relic-gold-fuel-v1'],
    small: new URL('../assets/inventory/relic-gold-fuel-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-gold-fuel-v1-medium.png', import.meta.url).href,
  },
  'r-wealth-scale': {
    bounds: SPRITE_BOUNDS['relic-wealth-scale-v1'],
    small: new URL('../assets/inventory/relic-wealth-scale-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-wealth-scale-v1-medium.png', import.meta.url).href,
  },
  'r-range-mirror': {
    bounds: SPRITE_BOUNDS['relic-range-mirror-v1'],
    small: new URL('../assets/inventory/relic-range-mirror-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-range-mirror-v1-medium.png', import.meta.url).href,
  },
  'r-extreme-range': {
    bounds: SPRITE_BOUNDS['relic-extreme-range-v1'],
    small: new URL('../assets/inventory/relic-extreme-range-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-extreme-range-v1-medium.png', import.meta.url).href,
  },
  'rust-sword': {
    bounds: SPRITE_BOUNDS['weapon-rust-sword-v2'],
    small: new URL('../assets/inventory/weapon-rust-sword-v2-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-rust-sword-v2-medium.png', import.meta.url).href,
  },
  'bone-knife': {
    bounds: SPRITE_BOUNDS['weapon-bone-knife-v1'],
    small: new URL('../assets/inventory/weapon-bone-knife-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-bone-knife-v1-medium.png', import.meta.url).href,
  },
  'ember-spear': {
    bounds: SPRITE_BOUNDS['weapon-ember-spear-v1'],
    small: new URL('../assets/inventory/weapon-ember-spear-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-ember-spear-v1-medium.png', import.meta.url).href,
  },
  'root-axe': {
    bounds: SPRITE_BOUNDS['weapon-root-axe-v1'],
    small: new URL('../assets/inventory/weapon-root-axe-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-root-axe-v1-medium.png', import.meta.url).href,
  },
  'rock-maul': {
    bounds: SPRITE_BOUNDS['weapon-rock-maul-v1'],
    small: new URL('../assets/inventory/weapon-rock-maul-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-rock-maul-v1-medium.png', import.meta.url).href,
  },
  'bell-maul': {
    bounds: SPRITE_BOUNDS['weapon-bell-maul-v1'],
    small: new URL('../assets/inventory/weapon-bell-maul-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-bell-maul-v1-medium.png', import.meta.url).href,
  },
  'wall-sword': {
    bounds: SPRITE_BOUNDS['weapon-wall-sword-v1'],
    small: new URL('../assets/inventory/weapon-wall-sword-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-wall-sword-v1-medium.png', import.meta.url).href,
  },
  'return-axe': {
    bounds: SPRITE_BOUNDS['weapon-return-axe-v1'],
    small: new URL('../assets/inventory/weapon-return-axe-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-return-axe-v1-medium.png', import.meta.url).href,
  },
  'mountain-maul': {
    bounds: SPRITE_BOUNDS['weapon-mountain-maul-v1'],
    small: new URL('../assets/inventory/weapon-mountain-maul-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-mountain-maul-v1-medium.png', import.meta.url).href,
  },
  'silver-guard': {
    bounds: SPRITE_BOUNDS['weapon-silver-guard-v1'],
    small: new URL('../assets/inventory/weapon-silver-guard-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-silver-guard-v1-medium.png', import.meta.url).href,
  },
  'ember-axe': {
    bounds: SPRITE_BOUNDS['weapon-ember-axe-v1'],
    small: new URL('../assets/inventory/weapon-ember-axe-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-ember-axe-v1-medium.png', import.meta.url).href,
  },
  'tide-blade': {
    bounds: SPRITE_BOUNDS['weapon-tide-blade-v1'],
    small: new URL('../assets/inventory/weapon-tide-blade-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-tide-blade-v1-medium.png', import.meta.url).href,
  },
  'erosion-knife': {
    bounds: SPRITE_BOUNDS['weapon-erosion-knife-v1'],
    small: new URL('../assets/inventory/weapon-erosion-knife-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-erosion-knife-v1-medium.png', import.meta.url).href,
  },
  'thorn-spear': {
    bounds: SPRITE_BOUNDS['weapon-thorn-spear-v1'],
    small: new URL('../assets/inventory/weapon-thorn-spear-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-thorn-spear-v1-medium.png', import.meta.url).href,
  },
  'soul-spear': {
    bounds: SPRITE_BOUNDS['weapon-soul-spear-v1'],
    small: new URL('../assets/inventory/weapon-soul-spear-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-soul-spear-v1-medium.png', import.meta.url).href,
  },
  'wood-bow': {
    bounds: SPRITE_BOUNDS['weapon-wood-bow-v1'],
    small: new URL('../assets/inventory/weapon-wood-bow-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-wood-bow-v1-medium.png', import.meta.url).href,
  },
  'ash-bow': {
    bounds: SPRITE_BOUNDS['weapon-ash-bow-v1'],
    small: new URL('../assets/inventory/weapon-ash-bow-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-ash-bow-v1-medium.png', import.meta.url).href,
  },
  'eagle-bow': {
    bounds: SPRITE_BOUNDS['weapon-eagle-bow-v1'],
    small: new URL('../assets/inventory/weapon-eagle-bow-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-eagle-bow-v1-medium.png', import.meta.url).href,
  },
  'triad-ember': {
    bounds: SPRITE_BOUNDS['weapon-triad-ember-v1'],
    small: new URL('../assets/inventory/weapon-triad-ember-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-triad-ember-v1-medium.png', import.meta.url).href,
  },
  'triad-wither': {
    bounds: SPRITE_BOUNDS['weapon-triad-wither-v1'],
    small: new URL('../assets/inventory/weapon-triad-wither-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-triad-wither-v1-medium.png', import.meta.url).href,
  },
  'triad-tide': {
    bounds: SPRITE_BOUNDS['weapon-triad-tide-v1'],
    small: new URL('../assets/inventory/weapon-triad-tide-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-triad-tide-v1-medium.png', import.meta.url).href,
  },
  'coin-blade': {
    bounds: SPRITE_BOUNDS['weapon-coin-blade-v1'],
    small: new URL('../assets/inventory/weapon-coin-blade-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-coin-blade-v1-medium.png', import.meta.url).href,
  },
  'r-three': {
    bounds: SPRITE_BOUNDS['relic-three-v1'],
    small: new URL('../assets/inventory/relic-three-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-three-v1-medium.png', import.meta.url).href,
  },
  'r-empty': {
    bounds: SPRITE_BOUNDS['relic-empty-v1'],
    small: new URL('../assets/inventory/relic-empty-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-empty-v1-medium.png', import.meta.url).href,
  },
  'r-reverse': {
    bounds: SPRITE_BOUNDS['relic-reverse-v1'],
    small: new URL('../assets/inventory/relic-reverse-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-reverse-v1-medium.png', import.meta.url).href,
  },
  'r-traveler': {
    bounds: SPRITE_BOUNDS['relic-traveler-v1'],
    small: new URL('../assets/inventory/relic-traveler-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-traveler-v1-medium.png', import.meta.url).href,
  },
  'r-blood': {
    bounds: SPRITE_BOUNDS['relic-blood-v1'],
    small: new URL('../assets/inventory/relic-blood-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-blood-v1-medium.png', import.meta.url).href,
  },
  'r-scales': {
    bounds: SPRITE_BOUNDS['relic-scales-v1'],
    small: new URL('../assets/inventory/relic-scales-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-scales-v1-medium.png', import.meta.url).href,
  },
  'r-heavy-wrist': {
    bounds: SPRITE_BOUNDS['relic-heavy-wrist-v1'],
    small: new URL('../assets/inventory/relic-heavy-wrist-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-heavy-wrist-v1-medium.png', import.meta.url).href,
  },
  'r-step-boots': {
    bounds: SPRITE_BOUNDS['relic-step-boots-v1'],
    small: new URL('../assets/inventory/relic-step-boots-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-step-boots-v1-medium.png', import.meta.url).href,
  },
  'r-turn-shield': {
    bounds: SPRITE_BOUNDS['relic-turn-shield-v1'],
    small: new URL('../assets/inventory/relic-turn-shield-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-turn-shield-v1-medium.png', import.meta.url).href,
  },
  'r-relay-badge': {
    bounds: SPRITE_BOUNDS['relic-relay-badge-v1'],
    small: new URL('../assets/inventory/relic-relay-badge-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-relay-badge-v1-medium.png', import.meta.url).href,
  },
  'r-guard-return': {
    bounds: SPRITE_BOUNDS['relic-guard-return-v1'],
    small: new URL('../assets/inventory/relic-guard-return-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-guard-return-v1-medium.png', import.meta.url).href,
  },
  'r-phase-pointer': {
    bounds: SPRITE_BOUNDS['relic-phase-pointer-v1'],
    small: new URL('../assets/inventory/relic-phase-pointer-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-phase-pointer-v1-medium.png', import.meta.url).href,
  },
  'r-money-scale': {
    bounds: SPRITE_BOUNDS['relic-money-scale-v1'],
    small: new URL('../assets/inventory/relic-money-scale-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-money-scale-v1-medium.png', import.meta.url).href,
  },
  'r-trade-voucher': {
    bounds: SPRITE_BOUNDS['relic-trade-voucher-v1'],
    small: new URL('../assets/inventory/relic-trade-voucher-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-trade-voucher-v1-medium.png', import.meta.url).href,
  },
  'gold-hook': {
    bounds: SPRITE_BOUNDS['weapon-gold-hook-v2'],
    small: new URL('../assets/inventory/weapon-gold-hook-v2-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/weapon-gold-hook-v2-medium.png', import.meta.url).href,
  },
  'r-ledger': {
    bounds: SPRITE_BOUNDS['relic-ledger-v1'],
    small: new URL('../assets/inventory/relic-ledger-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-ledger-v1-medium.png', import.meta.url).href,
  },
  'r-poison-hourglass': {
    bounds: SPRITE_BOUNDS['relic-poison-hourglass-v1'],
    small: new URL('../assets/inventory/relic-poison-hourglass-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-poison-hourglass-v1-medium.png', import.meta.url).href,
  },
  'r-step-edge': {
    bounds: SPRITE_BOUNDS['relic-step-edge-v1'],
    small: new URL('../assets/inventory/relic-step-edge-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-step-edge-v1-medium.png', import.meta.url).href,
  },
  'r-single-seal': {
    bounds: SPRITE_BOUNDS['relic-single-seal-v1'],
    small: new URL('../assets/inventory/relic-single-seal-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-single-seal-v1-medium.png', import.meta.url).href,
  },
  'r-neutral-stone': {
    bounds: SPRITE_BOUNDS['relic-neutral-stone-v1'],
    small: new URL('../assets/inventory/relic-neutral-stone-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-neutral-stone-v1-medium.png', import.meta.url).href,
  },
  'r-lone-edge': {
    bounds: SPRITE_BOUNDS['relic-lone-edge-v1'],
    small: new URL('../assets/inventory/relic-lone-edge-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-lone-edge-v1-medium.png', import.meta.url).href,
  },
  'r-armor-command': {
    bounds: SPRITE_BOUNDS['relic-armor-command-v1'],
    small: new URL('../assets/inventory/relic-armor-command-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-armor-command-v1-medium.png', import.meta.url).href,
  },
  'r-miasma-sac': {
    bounds: SPRITE_BOUNDS['relic-miasma-sac-v1'],
    small: new URL('../assets/inventory/relic-miasma-sac-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-miasma-sac-v1-medium.png', import.meta.url).href,
  },
  'r-bone-incense': {
    bounds: SPRITE_BOUNDS['relic-bone-incense-v1'],
    small: new URL('../assets/inventory/relic-bone-incense-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-bone-incense-v1-medium.png', import.meta.url).href,
  },
  'r-plague-bell': {
    bounds: SPRITE_BOUNDS['relic-plague-bell-v1'],
    small: new URL('../assets/inventory/relic-plague-bell-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-plague-bell-v1-medium.png', import.meta.url).href,
  },
  'r-switch-ring': {
    bounds: SPRITE_BOUNDS['relic-switch-ring-v1'],
    small: new URL('../assets/inventory/relic-switch-ring-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-switch-ring-v1-medium.png', import.meta.url).href,
  },
  'r-iron-will': {
    bounds: SPRITE_BOUNDS['relic-iron-will-v1'],
    small: new URL('../assets/inventory/relic-iron-will-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-iron-will-v1-medium.png', import.meta.url).href,
  },
  'r-armor-ring': {
    bounds: SPRITE_BOUNDS['relic-armor-ring-v1'],
    small: new URL('../assets/inventory/relic-armor-ring-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/relic-armor-ring-v1-medium.png', import.meta.url).href,
  },
  'wood-shield': {
    bounds: SPRITE_BOUNDS['defense-wood-shield-v1'],
    small: new URL('../assets/inventory/defense-wood-shield-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-wood-shield-v1-medium.png', import.meta.url).href,
  },
  'thorn-shield': {
    bounds: SPRITE_BOUNDS['defense-thorn-shield-v1'],
    small: new URL('../assets/inventory/defense-thorn-shield-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-thorn-shield-v1-medium.png', import.meta.url).href,
  },
  'tide-shield': {
    bounds: SPRITE_BOUNDS['defense-tide-shield-v1'],
    small: new URL('../assets/inventory/defense-tide-shield-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-tide-shield-v1-medium.png', import.meta.url).href,
  },
  'red-shield': {
    bounds: SPRITE_BOUNDS['defense-red-shield-v1'],
    small: new URL('../assets/inventory/defense-red-shield-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-red-shield-v1-medium.png', import.meta.url).href,
  },
  'light-armor': {
    bounds: SPRITE_BOUNDS['defense-light-armor-v1'],
    small: new URL('../assets/inventory/defense-light-armor-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-light-armor-v1-medium.png', import.meta.url).href,
  },
  'red-armor': {
    bounds: SPRITE_BOUNDS['defense-red-armor-v1'],
    small: new URL('../assets/inventory/defense-red-armor-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-red-armor-v1-medium.png', import.meta.url).href,
  },
  'vine-armor': {
    bounds: SPRITE_BOUNDS['defense-vine-armor-v1'],
    small: new URL('../assets/inventory/defense-vine-armor-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-vine-armor-v1-medium.png', import.meta.url).href,
  },
  'tide-cloak': {
    bounds: SPRITE_BOUNDS['defense-tide-cloak-v1'],
    small: new URL('../assets/inventory/defense-tide-cloak-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-tide-cloak-v1-medium.png', import.meta.url).href,
  },
  'phase-armor': {
    bounds: SPRITE_BOUNDS['defense-phase-armor-v1'],
    small: new URL('../assets/inventory/defense-phase-armor-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-phase-armor-v1-medium.png', import.meta.url).href,
  },
  'renewal-armor': {
    bounds: SPRITE_BOUNDS['defense-renewal-armor-v1'],
    small: new URL('../assets/inventory/defense-renewal-armor-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-renewal-armor-v1-medium.png', import.meta.url).href,
  },
  'mountain-shield': {
    bounds: SPRITE_BOUNDS['defense-mountain-shield-v1'],
    small: new URL('../assets/inventory/defense-mountain-shield-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-mountain-shield-v1-medium.png', import.meta.url).href,
  },
  'farwatch-armor': {
    bounds: SPRITE_BOUNDS['defense-farwatch-armor-v1'],
    small: new URL('../assets/inventory/defense-farwatch-armor-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-farwatch-armor-v1-medium.png', import.meta.url).href,
  },
  'gold-pick-armor': {
    bounds: SPRITE_BOUNDS['defense-gold-pick-armor-v1'],
    small: new URL('../assets/inventory/defense-gold-pick-armor-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-gold-pick-armor-v1-medium.png', import.meta.url).href,
  },
  'coin-armor': {
    bounds: SPRITE_BOUNDS['defense-coin-armor-v1'],
    small: new URL('../assets/inventory/defense-coin-armor-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-coin-armor-v1-medium.png', import.meta.url).href,
  },
  'bath-robe': {
    bounds: SPRITE_BOUNDS['defense-bath-robe-v1'],
    small: new URL('../assets/inventory/defense-bath-robe-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-bath-robe-v1-medium.png', import.meta.url).href,
  },
  'beast-armor': {
    bounds: SPRITE_BOUNDS['defense-beast-armor-v1'],
    small: new URL('../assets/inventory/defense-beast-armor-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/defense-beast-armor-v1-medium.png', import.meta.url).href,
  },
  'shield-core': {
    bounds: SPRITE_BOUNDS['material-shield-core-v1'],
    small: new URL('../assets/inventory/material-shield-core-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-shield-core-v1-medium.png', import.meta.url).href,
  },
  spring: {
    bounds: SPRITE_BOUNDS['material-spring-v1'],
    small: new URL('../assets/inventory/material-spring-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-spring-v1-medium.png', import.meta.url).href,
  },
  'venom-sac': {
    bounds: SPRITE_BOUNDS['material-venom-sac-v1'],
    small: new URL('../assets/inventory/material-venom-sac-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-venom-sac-v1-medium.png', import.meta.url).href,
  },
  chain: {
    bounds: SPRITE_BOUNDS['material-chain-v1'],
    small: new URL('../assets/inventory/material-chain-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-chain-v1-medium.png', import.meta.url).href,
  },
  scope: {
    bounds: SPRITE_BOUNDS['material-scope-v1'],
    small: new URL('../assets/inventory/material-scope-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-scope-v1-medium.png', import.meta.url).href,
  },
  weight: {
    bounds: SPRITE_BOUNDS['material-weight-v1'],
    small: new URL('../assets/inventory/material-weight-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-weight-v1-medium.png', import.meta.url).href,
  },
  'range-disc': {
    bounds: SPRITE_BOUNDS['material-range-disc-v1'],
    small: new URL('../assets/inventory/material-range-disc-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-range-disc-v1-medium.png', import.meta.url).href,
  },
  'steady-clip': {
    bounds: SPRITE_BOUNDS['material-steady-clip-v1'],
    small: new URL('../assets/inventory/material-steady-clip-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-steady-clip-v1-medium.png', import.meta.url).href,
  },
  'bone-nail': {
    bounds: SPRITE_BOUNDS['material-bone-nail-v1'],
    small: new URL('../assets/inventory/material-bone-nail-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-bone-nail-v1-medium.png', import.meta.url).href,
  },
  'toxin-vial': {
    bounds: SPRITE_BOUNDS['material-toxin-vial-v1'],
    small: new URL('../assets/inventory/material-toxin-vial-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-toxin-vial-v1-medium.png', import.meta.url).href,
  },
  conduit: {
    bounds: SPRITE_BOUNDS['material-conduit-v1'],
    small: new URL('../assets/inventory/material-conduit-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-conduit-v1-medium.png', import.meta.url).href,
  },
  'fork-connector': {
    bounds: SPRITE_BOUNDS['material-fork-connector-v1'],
    small: new URL('../assets/inventory/material-fork-connector-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-fork-connector-v1-medium.png', import.meta.url).href,
  },
  'wall-core': {
    bounds: SPRITE_BOUNDS['material-wall-core-v1'],
    small: new URL('../assets/inventory/material-wall-core-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-wall-core-v1-medium.png', import.meta.url).href,
  },
  'return-axle': {
    bounds: SPRITE_BOUNDS['material-return-axle-v1'],
    small: new URL('../assets/inventory/material-return-axle-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-return-axle-v1-medium.png', import.meta.url).href,
  },
  'corrosive-heart-core': {
    bounds: SPRITE_BOUNDS['material-corrosive-heart-core-v1'],
    small: new URL('../assets/inventory/material-corrosive-heart-core-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-corrosive-heart-core-v1-medium.png', import.meta.url).href,
  },
  'soul-chain': {
    bounds: SPRITE_BOUNDS['material-soul-chain-v1'],
    small: new URL('../assets/inventory/material-soul-chain-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-soul-chain-v1-medium.png', import.meta.url).href,
  },
  'beast-hunting-horn': {
    bounds: SPRITE_BOUNDS['material-beast-hunting-horn-v1'],
    small: new URL('../assets/inventory/material-beast-hunting-horn-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-beast-hunting-horn-v1-medium.png', import.meta.url).href,
  },
  'mountain-break-stone': {
    bounds: SPRITE_BOUNDS['material-mountain-break-stone-v1'],
    small: new URL('../assets/inventory/material-mountain-break-stone-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/material-mountain-break-stone-v1-medium.png', import.meta.url).href,
  },
  'health-potion': {
    bounds: SPRITE_BOUNDS['item-health-potion-v1'],
    small: new URL('../assets/inventory/item-health-potion-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-health-potion-v1-medium.png', import.meta.url).href,
  },
  'iron-powder': {
    bounds: SPRITE_BOUNDS['item-iron-powder-v1'],
    small: new URL('../assets/inventory/item-iron-powder-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-iron-powder-v1-medium.png', import.meta.url).href,
  },
  'rage-wine': {
    bounds: SPRITE_BOUNDS['item-rage-wine-v1'],
    small: new URL('../assets/inventory/item-rage-wine-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-rage-wine-v1-medium.png', import.meta.url).href,
  },
  teleport: {
    bounds: SPRITE_BOUNDS['item-teleport-talisman-v2'],
    small: new URL('../assets/inventory/item-teleport-talisman-v2-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-teleport-talisman-v2-medium.png', import.meta.url).href,
  },
  'food-3': {
    bounds: SPRITE_BOUNDS['item-food-3-v1'],
    small: new URL('../assets/inventory/item-food-3-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-food-3-v1-medium.png', import.meta.url).href,
  },
  'food-5': {
    bounds: SPRITE_BOUNDS['item-food-5-v1'],
    small: new URL('../assets/inventory/item-food-5-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-food-5-v1-medium.png', import.meta.url).href,
  },
  'food-7': {
    bounds: SPRITE_BOUNDS['item-food-7-v1'],
    small: new URL('../assets/inventory/item-food-7-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-food-7-v1-medium.png', import.meta.url).href,
  },
  'food-9': {
    bounds: SPRITE_BOUNDS['item-food-9-v1'],
    small: new URL('../assets/inventory/item-food-9-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-food-9-v1-medium.png', import.meta.url).href,
  },
  poison: {
    bounds: SPRITE_BOUNDS['item-poison-v1'],
    small: new URL('../assets/inventory/item-poison-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-poison-v1-medium.png', import.meta.url).href,
  },
  explosive: {
    bounds: SPRITE_BOUNDS['item-explosive-v1'],
    small: new URL('../assets/inventory/item-explosive-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-explosive-v1-medium.png', import.meta.url).href,
  },
  'thunder-charm': {
    bounds: SPRITE_BOUNDS['item-thunder-charm-v1'],
    small: new URL('../assets/inventory/item-thunder-charm-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-thunder-charm-v1-medium.png', import.meta.url).href,
  },
  'shield-bash': {
    bounds: SPRITE_BOUNDS['item-shield-bash-v1'],
    small: new URL('../assets/inventory/item-shield-bash-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-shield-bash-v1-medium.png', import.meta.url).href,
  },
  'meat-scrap': {
    bounds: SPRITE_BOUNDS['item-meat-scrap-v1'],
    small: new URL('../assets/inventory/item-meat-scrap-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-meat-scrap-v1-medium.png', import.meta.url).href,
  },
  'money-pouch': {
    bounds: SPRITE_BOUNDS['item-money-pouch-v1'],
    small: new URL('../assets/inventory/item-money-pouch-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/item-money-pouch-v1-medium.png', import.meta.url).href,
  },
})

// Gold is a room-floor entity rather than an inventory item.  Keep its
// quantity-specific artwork in its own map so it cannot be confused with an
// item id or accidentally enter the backpack sprite contract.
const GOLD_SPRITE_SOURCES = Object.freeze({
  3: {
    bounds: SPRITE_BOUNDS['gold-pile-3-v1'],
    small: new URL('../assets/inventory/gold-pile-3-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/gold-pile-3-v1-medium.png', import.meta.url).href,
  },
  4: {
    bounds: SPRITE_BOUNDS['gold-pile-4-v1'],
    small: new URL('../assets/inventory/gold-pile-4-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/gold-pile-4-v1-medium.png', import.meta.url).href,
  },
  5: {
    bounds: SPRITE_BOUNDS['gold-pile-5-v1'],
    small: new URL('../assets/inventory/gold-pile-5-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/gold-pile-5-v1-medium.png', import.meta.url).href,
  },
  6: {
    bounds: SPRITE_BOUNDS['gold-pile-6-v1'],
    small: new URL('../assets/inventory/gold-pile-6-v1-small.png', import.meta.url).href,
    medium: new URL('../assets/inventory/gold-pile-6-v1-medium.png', import.meta.url).href,
  },
  7: {
    bounds: SPRITE_BOUNDS['gold-pile-7-v1'],
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
