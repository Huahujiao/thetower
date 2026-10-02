export const WEAPON_TIERS = Object.freeze({
  1: Object.freeze([
    'rust-sword', 'triad-ember', 'root-axe', 'bone-knife', 'tide-blade', 'demon-seeker',
    'ember-spear', 'gold-hook', 'wood-bow', 'ash-bow', 'triad-tide', 'rock-maul',
  ]),
  2: Object.freeze([
    'silver-guard', 'coin-blade', 'ember-axe', 'triad-wither', 'butcher-knife',
    'thorn-spear', 'eagle-bow', 'bounty-bow', 'scouting-bow', 'bell-maul',
  ]),
  3: Object.freeze([
    'wall-sword', 'return-axe', 'erosion-knife', 'soul-spear', 'hunter-shortbow', 'mountain-maul',
  ]),
})

const TIER_BY_ID = new Map(Object.entries(WEAPON_TIERS)
  .flatMap(([tier, ids]) => ids.map(id => [id, Number(tier)])))

export function weaponTierForId(id) { return TIER_BY_ID.get(id) || 0 }

export const ADVANCED_CRAFT_MATERIALS = Object.freeze([
  {
    id: 'wall-core', name: '\u57ce\u58c1\u6838\u5fc3', type: 'material', attribute: null, shape: [[1]],
    description: '\u7528\u4e8e\u5c06\u6c89\u94f6\u5b88\u5251\u5408\u6210\u4e3a\u57ce\u58c1\u5251\u3002',
  },
  {
    id: 'return-axle', name: '\u56de\u65cb\u8f74', type: 'material', attribute: null, shape: [[1]],
    description: '\u7528\u4e8e\u5c06\u7126\u75d5\u624b\u65a7\u5408\u6210\u4e3a\u56de\u65cb\u65a7\u3002',
  },
  {
    id: 'corrosive-heart-core', name: '\u8680\u6bd2\u5fc3\u6838', type: 'material', attribute: 'wither', shape: [[1]],
    description: '\u7528\u4e8e\u5c06\u8150\u73af\u5315\u5408\u6210\u4e3a\u8680\u9aa8\u5203\u3002',
  },
  {
    id: 'soul-chain', name: '\u9501\u9b42\u94fe', type: 'material', attribute: null, shape: [[1]],
    description: '\u7528\u4e8e\u5c06\u8346\u94a9\u67aa\u5408\u6210\u4e3a\u9501\u9b42\u67aa\u3002',
  },
  {
    id: 'beast-hunting-horn', name: '\u730e\u517d\u53f7\u89d2', type: 'material', attribute: null, shape: [[1]],
    description: '\u7528\u4e8e\u5c06\u9e70\u773c\u5f13\u3001\u60ac\u8d4f\u5f13\u6216\u7aa5\u9635\u5f13\u5408\u6210\u4e3a\u730e\u624b\u77ed\u5f13\u3002',
  },
  {
    id: 'mountain-break-stone', name: '\u65ad\u5cb3\u77f3', type: 'material', attribute: 'wither', shape: [[1]],
    description: '\u7528\u4e8e\u5c06\u6c89\u94c1\u949f\u9524\u5408\u6210\u4e3a\u65ad\u5cb3\u69cc\u3002',
  },
].map(item => Object.freeze({ ...item, rotatable: false })))

const RECIPE_TUPLES = Object.freeze([
  ['rust-sword', 'shield-core', 'silver-guard'],
  ['triad-ember', 'conduit', 'coin-blade'],
  ['root-axe', 'spring', 'ember-axe'],
  ['bone-knife', 'venom-sac', 'triad-wither'],
  ['tide-blade', 'bone-nail', 'butcher-knife'],
  ['ember-spear', 'chain', 'thorn-spear'],
  ['wood-bow', 'scope', 'eagle-bow'],
  ['ash-bow', 'range-disc', 'bounty-bow'],
  ['triad-tide', 'steady-clip', 'scouting-bow'],
  ['rock-maul', 'weight', 'bell-maul'],
  ['demon-seeker', 'conduit', 'coin-blade'],
  ['gold-hook', 'conduit', 'coin-blade'],
  ['silver-guard', 'wall-core', 'wall-sword'],
  ['coin-blade', 'wall-core', 'wall-sword'],
  ['ember-axe', 'return-axle', 'return-axe'],
  ['triad-wither', 'corrosive-heart-core', 'erosion-knife'],
  ['butcher-knife', 'corrosive-heart-core', 'erosion-knife'],
  ['thorn-spear', 'soul-chain', 'soul-spear'],
  ['eagle-bow', 'beast-hunting-horn', 'hunter-shortbow'],
  ['bounty-bow', 'beast-hunting-horn', 'hunter-shortbow'],
  ['scouting-bow', 'beast-hunting-horn', 'hunter-shortbow'],
  ['bell-maul', 'mountain-break-stone', 'mountain-maul'],
])

export const WEAPON_RECIPES = Object.freeze(RECIPE_TUPLES.map(([a, b, result]) => Object.freeze({
  id: `${a}+${b}->${result}`, a, b, result,
})))
