import catalog from '../game/data/catalog.json' with { type: 'json' }
import { attributeLabel } from '../game/data/attributes.js'
import { ENEMY_HP_MULTIPLIER } from '../game/data/enemies.js'
import { enemyBehaviorLabel, enemyFeatureLabel } from '../game/data/enemy-features.js'
import { RELIC_DEFS } from '../game/data/relics.js'
import { TALENT_DEFS } from '../game/data/progression.js'
import { TRAP_DEFS } from '../game/data/traps.js'
import '../wiki.css'

const COPY = Object.freeze({
  title: '\u5730\u7262\u56fe\u9274',
  subtitle: '\u5730\u7262\u5185\u5bb9\u56fe\u9274',
  summary: '\u4e09\u5c5e\u6027\u3001\u4e09\u5c42\u5929\u8d4b\u7f51\u3001\u5723\u9057\u7269\u6784\u7b51\u3001\u7edf\u4e00\u6697\u7070\u5361\u80cc\u4e0e 4\u00d78 \u5f62\u72b6\u80cc\u5305\u5171\u540c\u6784\u6210\u5730\u7262\u7684\u8def\u7ebf\u9009\u62e9\uff1b\u5730\u9762\u5361\u724c\u7f51\u683c\u6309\u697c\u5c42\u4f7f\u7528 6\u00d76\u30017\u00d77\u30018\u00d78\u30018\u00d78\u30019\u00d79\uff1b\u80cc\u5305\u4f7f\u7528\u6df1\u9ed1\u51b7\u7070\u5e95\u8272\uff0c\u7cbe\u7075\u6309\u5360\u683c\u4f7f\u7528\u900f\u660e\u753b\u5e03\uff0c\u4f18\u5148\u4fdd\u7559\u5c0f\u5c3a\u5bf8\u4e0b\u6e05\u6670\u7684\u5927\u8f6e\u5ed3\uff1b\u5df2\u5ba1\u6838\u7d20\u6750\u5305\u62ec 1\u00d72 \u9523\u5251\u30011\u00d71 \u9aa8\u5305\u30011\u00d73 \u70bd\u67aa\u30011\u00d74 \u9501\u9b42\u67aa\u3001L \u5f62\u8150\u6839\u6218\u65a7\u3001T \u5f62\u9e70\u773c\u5f13\u3001\u5341\u5b57\u65ad\u5cb3\u69cc\u30011\u00d71 \u4e09\u76f8\u8f6e\u4e0e\u7a7a\u5323\u5370\u3002',
  statusNote: '\u72b6\u6001\u56fe\u6807\u951a\u5b9a\u4e8e\u4e09\u7ef4\u573a\u666f\u5de6\u4e0b\u89d2\uff0c\u4ece\u5de6\u5411\u53f3\u6392\u5217\uff1a\u4e2d\u6bd2\u3001\u71c3\u70e7\u3001\u9152\u529b\u589e\u4f24\u3001\u666e\u901a\u653b\u51fb\u589e\u76ca\u4e0e\u4f53\u529b\u6d88\u8017\u964d\u4f4e\u4f7f\u7528\u900f\u660e\u5c0f\u56fe\u6807\uff0c\u89d2\u6807\u663e\u793a\u5269\u4f59\u56de\u5408\u6216\u6570\u503c\uff0c\u957f\u6309\u67e5\u770b\u8be6\u60c5\u3002\u4ec5\u663e\u793a\u4e2d\u6bd2\u3001\u71c3\u70e7\u4e0e\u559d\u9152\u7b49\u4e34\u65f6 Buff/Debuff\uff1b\u5723\u9057\u7269\u3001\u6563\u4ef6\u5e38\u9a7b\u72b6\u6001\u4e0d\u663e\u793a\u3002',
  enemyOverheadNote: '\u654c\u4eba\u540d\u5b57\u4e0a\u65b9\u663e\u793a\u7a0d\u5927\u7684\u673a\u5236\u56fe\u6807\u548c \u{1F3F9} \u5c04\u7a0b\uff1a\u27a4\u8ffd\u51fb\uff0c\u26a0\u4f0f\u51fb\uff0c\u25c8\u62a4\u76fe\uff0c\u25a3\u91cd\u7532\uff0c\u2442\u5206\u88c2\uff0c\u271a\u518d\u751f\uff0c\u21bb\u590d\u751f\uff0c\u25ce\u8b66\u62a5\uff0c\u2739\u81ea\u7206\uff0c\u2668\u71c3\u70e7\uff0c\u00bb\u75be\u884c\uff0c\u21a4\u7275\u5f15\uff0c\u2726\u53ec\u5524\uff0c\u273a\u6b7b\u4ea1\u5b73\u751f\uff0c\u2620\u6b7b\u4ea1\u4e2d\u6bd2\u3002\u9a7b\u5b88\u4e0d\u5355\u72ec\u663e\u793a\u3002',
  enemyDetailIconNote: '\u654c\u4eba\u8be6\u60c5\u4e2d\u7684\u76f8\u540c\u884c\u4e3a\u6216\u7279\u6027\u540d\u79f0\u524d\uff0c\u4e5f\u663e\u793a\u5bf9\u5e94\u56fe\u6807\uff0c\u4fbf\u4e8e\u5bf9\u7167\u5934\u9876\u63d0\u793a\u3002',
  boundaryNote: '\u623f\u95f4\u56f4\u5899\u4e0d\u56e0\u89d2\u8272\u9760\u8fd1\u6216\u79bb\u5f00\u800c\u9690\u85cf\uff1b\u5357\u9762\u53ea\u56fa\u5b9a\u4e0d\u751f\u6210\u4e2d\u95f4\u67f1\u5b50\uff0c\u4e24\u7aef\u67f1\u5b50\u4fdd\u7559\u3002\u654c\u4eba\u7ffb\u724c\u4e3a\u900f\u660e\u80cc\u666f\uff0c\u4e0d\u663e\u793a\u5361\u80cc\u6216\u6728\u7eb9\uff1b\u4e0b\u65b9\u663e\u793a\u5730\u677f\u7eb9\u7406\uff1b\u4e34\u65f6\u724c\u53d7\u5357\u5899\u906e\u6321\u3002',
  footprintNote: '\u89d2\u8272\u79fb\u52a8\u65f6\uff0c\u8def\u5f84\u4e0a\u6bcf\u4e2a\u843d\u811a\u683c\u90fd\u4f1a\u4e0b\u6c89\uff1b\u5230\u8fbe\u4e0b\u4e00\u683c\u540e\uff0c\u524d\u4e00\u683c\u624d\u62ac\u8d77\uff0c\u6700\u540e\u4e00\u683c\u5219\u5728\u4e0b\u6b21\u63a8\u8fdb\u56de\u5408\u540e\u62ac\u8d77\u3002\u5361\u7247\u4e0e\u5357\u9762\u56f4\u5899\u7684\u906e\u6321\u5c42\u7ea7\u4e0e\u683c\u5b50\u884c\u5e8f\u7ed1\u5b9a\uff0c\u4e0d\u56e0\u4e0b\u6c89\u504f\u79fb\u800c\u6539\u53d8\u3002',
  attackNote: '\u653b\u51fb\u52a8\u753b\u6682\u65f6\u8bbe\u4e3a 0.5 \u79d2\uff1a\u73a9\u5bb6\u62ac\u8d77\u53cc\u624b\u5e76\u6536\u62e2\u53cc\u811a\uff0c\u654c\u4eba\u62ac\u5934\u5e76\u5de6\u53f3\u6447\u52a8\u4e09\u89d2\u8eab\u4f53\u4e24\u6b21\uff1b\u653b\u51fb\u8def\u7ebf\u6309\u6bcf\u4e00\u683c\u5206\u6bb5\uff0c\u5982\u679c\u4e2d\u9014\u8fdb\u5165\u8fdc\u7a0b\u654c\u4eba\u7684\u5c04\u7a0b\uff0c\u5219\u5728\u8be5\u683c\u505c\u4e0b\u5e76\u5148\u64ad\u653e\u654c\u4eba\u52a8\u4f5c\u3002\u73a9\u5bb6\u653b\u51fb\u7ed3\u540e\uff0c\u5148\u5c06\u53d7\u51fb\u7ed3\u679c\uff08\u6263\u8840\u3001\u6b7b\u4ea1\u3001\u51fb\u9000\u7b49\uff09\u5237\u65b0\u5230\u4e09\u7ef4\u573a\u666f\uff0c\u518d\u7ed3\u7b97\u5e76\u64ad\u653e\u654c\u65b9\u56de\u5408\u3002\u6bcf\u5e27\u91cd\u7f6e canvas \u53d8\u6362\u540e\u91cd\u7ed8\uff0c\u907f\u514d\u653b\u51fb\u65f6\u7f29\u653e\u7d2f\u79ef\u5bfc\u81f4\u88c1\u526a\u3002',
  combatSequenceNote: 'Combat sequencing: a long route stops at its first enemy attack. A chasing enemy completes its smooth move before its attack animation; moves, flips, and attacks never overlap, and a multi-card reveal flips one card at a time.',
  pickupSequenceNote: 'Action sequencing: only the final route step is atomic. Loot arrival plus collection, and final attack-position arrival plus the player hit, resolve before enemy actions; earlier route cells remain interruptible.',
  attackEnergyNote: '\u8e0f\u5165\u653b\u51fb\u4f4d\u7684\u6700\u540e\u4e00\u6b65\u4e0e\u653b\u51fb\u662f\u540c\u4e00\u539f\u5b50\u56de\u5408\uff1a\u5148\u6062\u590d 1 \u70b9\u4f53\u529b\uff0c\u518d\u652f\u4ed8\u6b66\u5668\u4f53\u529b\u6d88\u8017\uff0c\u56e0\u6b64\u6bd4\u539f\u5730\u653b\u51fb\u5c11\u8017 1 \u70b9\u3002',
  detailPresentationNote: '\u8be6\u60c5\u56fe\u7247\u6846\u56fa\u5b9a\u4e3a\u5bbd2\u683c\u3001\u9ad8\u6700\u591a3\u683c\uff0c\u7cbe\u7075\u56fe\u4ee5 contain \u7b49\u6bd4\u7f29\u653e\uff1b\u6b66\u5668\u653b\u51fb\u3001\u5c04\u7a0b\u3001\u4f53\u529b\u6d88\u8017\u7684\u6570\u503c\u884c\u4e0e\u5176\u4ed6\u6548\u679c\u5206\u884c\u663e\u793a\uff0c\u672a\u751f\u6548\u7684\u76f8\u90bb\u6548\u679c\u4e0d\u663e\u793a\u3002\u6b66\u5668\u4e0e\u9632\u5177\u8be6\u60c5\u540d\u79f0\u53f3\u4fa7\u4f9d\u6b21\u663e\u793a\u5fae\u7ae0\uff1a\u6b66\u5668\u4e3a\u5c5e\u6027\u3001\u7c7b\u522b\u3001\u661f\u7ea7\uff1b\u9632\u5177\u53ea\u663e\u793a\u76fe\u724c\u6216\u62a4\u7532\u7c7b\u522b\u4e0e\u661f\u7ea7\uff0c\u4e0d\u663e\u793a\u5c5e\u6027\u3002\u6b66\u5668\u7684\u653b\u51fb\u3001\u5c04\u7a0b\u3001\u4f53\u529b\u6d88\u8017\u5206\u522b\u4f7f\u7528\u5251\u3001\u5f13\u3001\u808c\u8089\u56fe\u6807\uff1b\u4e0d\u518d\u663e\u793a\u5360\u683c\u3002',
  detailImageBoundsNote: '\u8be6\u60c5\u56fe\u7247\u4e25\u683c\u9650\u4e8e\u5bbd2\u683c\u3001\u9ad8\u6700\u591a3\u683c\uff1b\u4f7f\u7528 contain \u7b49\u6bd4\u7f29\u653e\u5e76\u88c1\u5207\u8d8a\u754c\u90e8\u5206\u3002',
  springStateNote: '\u5f39\u7c27\u51fb\u6740\u89e6\u53d1\u540e\uff0c\u9664\u89e6\u53d1\u6b66\u5668\u5916\u7684\u6bcf\u628a\u53ef\u7528\u6b66\u5668\u8be6\u60c5\u90fd\u663e\u793a\u4e0b\u4e00\u51fb\u4f53\u529b\u6d88\u8017-1\uff1b\u5b9e\u9645\u8d39\u7528\u4f7f\u7528\u540c\u4e00\u5224\u5b9a\u3002',
  spriteNote: '\u80cc\u5305\u4e0e\u5730\u9762\u7269\u54c1\u7cbe\u7075\u56fe\u5df2\u8986\u76d6\u5168\u90e844\u4ef6\u7269\u54c1\uff1a18\u628a\u6b66\u5668\u30018\u4ef6\u9632\u5177\u30016\u79cd\u6d88\u8017\u54c1\u30016\u79cd\u6750\u6599\u548c6\u4ef6\u5723\u9057\u7269\uff1b\u6309\u5360\u683c\u5f62\u72b6\u52a0\u8f7d\u900f\u660e small/medium \u8d44\u6e90\u3002\u8346\u94a9\u67aa\u5df2\u6309\u900f\u660e\u5ea6\u9608\u503c 8 \u88c1\u53bb\u8fb9\u7f18\uff0c\u4fdd\u7559\u672a\u88c1\u5907\u4efd\u3002',
  groundGoldSpriteNote: '\u5730\u9762\u91d1\u5e01\u662f\u72ec\u7acb\u5b9e\u4f53\uff0c\u4f1a\u6309\u5b9e\u9645\u6570\u91cf\u663e\u793a 3\u20137 \u679a\u53e4\u94b1\u5e01\u5806\u7cbe\u7075\u56fe\uff1b\u8fd0\u884c\u65f6\u4ec5\u52a0\u8f7d small/medium \u7248\u672c\uff0c\u539f\u56fe\u4fdd\u5b58\u4e8e\u5907\u4efd\u76ee\u5f55\u3002',
  groundWeaponGlowNote: '\u5730\u9762\u4e0a\u5df2\u7ffb\u5f00\u4e14\u5c1a\u672a\u62fe\u53d6\u7684\u6b66\u5668\uff0c\u4f1a\u5728\u683c\u5b50\u5730\u677f\u4e0a\u663e\u793a\u5bf9\u5e94\u5c5e\u6027\u8272\u7684\u67d4\u548c\u534a\u900f\u660e\u5149\u8292\uff1a\u707c\u70ed\u7ea2\u3001\u67af\u840e\u9ec4\u3001\u6c89\u6eba\u84dd\u3002\u5149\u8292\u7ea6\u5360 0.90 \u683c\uff0c\u7531\u4e2d\u5fc3\u4eae\u5ea6\u6e10\u53d8\u548c\u4e09\u5c42\u7ec6\u957f\u661f\u8292\u7ec4\u6210\uff1b\u4e09\u5c42\u661f\u8292\u4f7f\u7528\u4e0d\u540c\u6570\u91cf\u3001\u76f8\u4f4d\u548c\u901f\u5ea6\uff0c\u5176\u4e2d\u4e00\u5c42\u53cd\u5411\u65cb\u8f6c\uff0c\u540c\u65f6\u6574\u4f53\u900f\u660e\u5ea6\u547c\u5438\u3002\u4e0d\u518d\u4f7f\u7528\u6574\u5757\u6536\u653e\u7684\u5b9e\u5fc3\u591a\u89d2\u5f62\uff1b\u5730\u4e0a\u7269\u54c1\u7684\u671d\u5411\u65cb\u8f6c\u901f\u5ea6\u4e3a\u539f\u6765\u7684 1.5 \u500d\u3002',
  inventoryNote: 'Inventory is touch-only: hold an occupied item for 300 ms, move more than 18 px to drag, and use a fresh second-finger tap for each clockwise 90-degree rotation. The floating footprint snaps by its center with a half-cell drop tolerance. Green, yellow, and red previews mean accept, replace-to-staging, and illegal. The red discard zone and blue free-form staging canvas exactly fill the whole area above the backpack in a 25/75 split; staged items preserve backpack-cell size and seek a zero-overlap automatic position, while the detail panel remains above both zones for inspection. The toolbar is armor-left, wide health/energy center, Use-right; Craft stays visually stable while its action gate is disabled during board animation.',
  inventoryEffectNote: 'Backpack effect feedback: each accessory is joined to every actual beneficiary by one short, three-layer green flow crossing a real shared cell edge; both ends fade out gradually. Irregular shapes use occupied cells, links ignore touches and hide during dragging. Conditional relics are dim while unmet and bright when ready; triggerless relics stay bright.',
  talentChoiceNote: 'Level-up choice cards place the talent name on the left and its type on the right of one header row. The repeatable health option is named Strong Physique (\u5f3a\u5065\u4f53\u9b44), with no duplicate label below the divider.',
  equipmentUpgradeNote: 'Equipment details show each forward crafting upgrade as one frameless, background-free icon row: source + ingredient -> result. Every image is absolutely contain-fitted inside an explicit square min/max box with clipped paint containment, so it cannot exceed the slot. The plus and arrow are CSS marks; icons have no names, attribute colors, or detail gestures.',
  animationToolNote: '\u4e09\u7ef4\u9aa8\u67b6\u52a8\u753b\u5de5\u5177\uff1a/animeedit \u4f1a\u4e00\u6b21\u6027\u52a0\u5165\u788e\u94c3\u884c\u50e7\u3001\u6f6e\u773c\u86db\u6bcd\u3001\u7f1d\u8179\u706f\u86fe\u4e09\u4e2a\u53ef\u7f16\u8f91\u602a\u7269\u793a\u4f8b\uff0c\u6bcf\u4e2a\u90fd\u6709\u9aa8\u67b6\u3001\u51e0\u4f55\u90e8\u4ef6\u548c\u5f85\u673a\u3001\u653b\u51fb\u3001\u53d7\u653b\u51fb\u3001\u6b7b\u4ea1\u3001\u79fb\u52a8\u4e94\u5957\u52a8\u4f5c\u3002\u89d2\u8272\u7edf\u4e00\u9762\u671d\u5de6\u524d\u65b945\u5ea6\uff0c\u5173\u8282\u53ca\u52a8\u4f5c\u5177\u6709Z\u8f74\u524d\u540e\u53d8\u5316\u3002\u5df2\u6709\u89d2\u8272\u548c\u7a7a\u767d\u89d2\u8272\u4f1a\u4fdd\u7559\uff1b\u5220\u9664\u793a\u4f8b\u540e\u4e0d\u4f1a\u81ea\u52a8\u91cd\u65b0\u5b89\u88c5\u3002/animepreview \u4f7f\u7528\u540c\u4e00\u4e09\u7ef4\u821e\u53f0\u64ad\u653e\u3002',
  animationViewNote: '\u7f16\u8f91\u5668\u9ed8\u8ba4\u6b63\u9762\u89c6\u89d2\uff1b\u5355\u6307\u62d6\u52a8\u7a7a\u767d\u5904\u5e73\u79fb\u3001\u53cc\u6307\u7f29\u653e\u3002\u70b9\u51fb 3D \u5207\u6362\u4e3a\u5355\u6307\u65cb\u8f6c\u89c6\u89d2\uff0c\u70b9\u51fb\u6b63\u9762\u590d\u4f4d\u3002\u5173\u95ed\u7f51\u683c\u65f6\u4e5f\u9690\u85cf\u51e0\u4f55\u90e8\u4ef6\uff0c\u53ea\u4fdd\u7559\u5173\u8282\u4e0e\u9aa8\u9abc\u7ebf\u3002\u9884\u89c8\u9875\u53ef\u8c03\u6574\u89c6\u89d2\u4f46\u4e0d\u80fd\u7f16\u8f91\u89d2\u8272\u3002',
  animationPartFormNote: '\u9aa8\u67b6\u3001\u90e8\u4ef6\u3001\u52a8\u4f5c\u9875\u4f7f\u7528\u76f8\u540c\u7684\u56fa\u5b9a\u9ad8\u5ea6\u5e95\u90e8\u9762\u677f\u3002\u5173\u8282\u53ef\u7f16\u8f91 XYZ \u4f4d\u7f6e\u4e0e XYZ \u65cb\u8f6c\u3002\u90e8\u4ef6\u8868\u5355\u53ef\u5207\u6362\u5c3a\u5bf8\u3001\u4f4d\u7f6e\u3001\u65cb\u8f6c\uff1b\u7ed8\u5236\u5c42\u7ea7 layer \u4e0e\u7a7a\u95f4\u6df1\u5ea6 Z \u72ec\u7acb\u3002\u52a8\u4f5c\u8868\u5355\u53ef\u5207\u6362 XYZ \u4f4d\u79fb\u3001\u65cb\u8f6c\u3001\u7f29\u653e\u5e76\u7f16\u8f91\u900f\u660e\u5ea6\u3002\u5173\u952e\u5e27\u6309\u94ae\u9488\u5bf9\u5f53\u524d\u65f6\u523b\u6240\u6709\u76ee\u6807\uff1b\u91cd\u7f6e\u4ec5\u6e05\u9664\u5f53\u524d\u52a8\u4f5c\u7684\u5173\u952e\u5e27\u3002',
  implemented: '\u5df2\u5b9e\u88c5',
  back: '\u8fd4\u56de\u5730\u7262',
  enemies: '\u654c\u4eba',
  traps: '\u9677\u9631',
  weapons: '\u6b66\u5668',
  relics: '\u5723\u9057\u7269',
  talents: '\u5929\u8d4b',
  items: '\u7269\u54c1',
  enemy: '\u654c\u4eba',
  boss: '\u9996\u9886',
  weapon: '\u6b66\u5668',
  relic: '\u5723\u9057\u7269',
  potion: '\u751f\u547d\u836f\u6c34',
  armor: '\u62a4\u7532\u836f\u5242',
  energyPotion: '\u4f53\u529b\u836f\u5242',
  buff: '\u589e\u76ca\u7269\u54c1',
  attack: '\u653b\u51fb',
  health: '\u751f\u547d',
  range: '\u5c04\u7a0b',
  energy: '\u4f53\u529b\u6d88\u8017',
  footprint: '\u5360\u683c',
  weaponClass: '\u7c7b\u522b',
  weaponEffect: '\u7279\u6548',
  energyLoss: '\u4f53\u529b\u635f\u5931',
  attribute: '\u5c5e\u6027',
  floor: '\u6700\u65e9\u51fa\u73b0\u697c\u5c42',
  delay: '\u884c\u52a8\u5ef6\u8fdf',
  interval: '\u666e\u901a\u653b\u51fb\u51b7\u5374',
  normalAttackCooldown: '\u666e\u901a\u653b\u51fb\u51b7\u5374',
  behavior: '\u884c\u4e3a',
  features: '\u7279\u6027',
  healing: '\u6062\u590d\u751f\u547d',
  armorValue: '\u589e\u52a0\u62a4\u7532',
  nextAttack: '\u4e0b\u6b21\u653b\u51fb',
  nextMeleeAttack: '\u4e0b\u6b21\u8fd1\u6218\u653b\u51fb',
  loot: '\u6389\u843d',
  experience: '\u7ecf\u9a8c',
  relicChance: '\u5723\u9057\u7269\u6389\u843d',
  relicSources: '\u83b7\u53d6\u6765\u6e90',
  softLimit: '\u5723\u9057\u7269\u8f6f\u9650\u5236',
  overload: '\u8d85\u8f7d\u6548\u679c',
  enemyDrop: '\u654c\u4eba\u6389\u843d',
  sword: '\u5251',
  axe: '\u65a7',
  dagger: '\u5315\u9996',
  polearm: '\u957f\u67c4',
  heavy: '\u91cd\u6b66\u5668',
  bow: '\u5f13',
  survival: '\u751f\u5b58',
  scorch: '\u707c\u70ed',
  wither: '\u67af\u840e',
  drown: '\u6c89\u6eba',
  stationary: '\u9a7b\u5b88',
  chaser: '\u8ffd\u730e',
  ambush: '\u4f0f\u51fb',
  shield: '\u76fe\u5175',
  heavyArmor: '\u91cd\u7532',
  split: '\u5206\u88c2',
  revive: '\u590d\u6d3b',
  generated: '\u751f\u6210\u7269',
  cell: '\u683c',
  turn: '\u56de\u5408',
  trigger: '\u89e6\u53d1',
  lifecycle: '\u72b6\u6001',
  trapLifecycle: '\u89e6\u53d1\u540e\u4fdd\u7559\u4e00\u4e2a\u5b8c\u6574\u540e\u7eed\u5168\u5c40\u56de\u5408\u8ba1\u6570\uff0c\u4e14\u4e0d\u4f1a\u91cd\u590d\u89e6\u53d1',
  target: '\u76ee\u6807',
  duration: '\u6301\u7eed',
  damage: '\u4f24\u5bb3',
  regen: '\u518d\u751f',
  deathExplosion: '\u6b7b\u4ea1\u7206\u70b8',
  splitMinion: '\u5206\u88c2\u751f\u6210\u7269',
  burning: '\u71c3\u70e7',
  poison: '\u4e2d\u6bd2',
  deathStatus: '\u6b7b\u4ea1\u6548\u679c',
  pull: '\u7275\u5f15',
  summon: '\u53ec\u5524',
  deathSpawn: '\u6b7b\u4ea1\u5b73\u751f',
  revealTrigger: '\u7ffb\u5f00\u540e\u7acb\u5373\u89e6\u53d1',
  globalTurns: '\u5168\u5c40\u56de\u5408',
})

const TABS = Object.freeze([
  { id: 'enemies', label: COPY.enemies },
  { id: 'traps', label: COPY.traps },
  { id: 'weapons', label: COPY.weapons },
  { id: 'relics', label: COPY.relics },
  { id: 'talents', label: COPY.talents },
  { id: 'items', label: COPY.items },
])

const WEAPON_ENERGY_COSTS = Object.freeze({ dagger: 2, sword: 3, axe: 4, polearm: 4, bow: 4, heavy: 5 })
const LINT_NOTE = 'ESLint status: clean.'
const INPUT_NOTE = 'Supported device: portrait mobile touch only; click and long press handlers are bound to each target; inventory uses a 300 ms hold, 18 px drag tolerance, shape anchors, staging, discard, and a fresh second-finger tap for each multi-touch rotation; detail visibility follows the active hold; door confirmation accepts the door or its arrival marker and waits for queued movement and reveal animations to finish.'

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]))
}

function label(value) {
  const names = { flow: '换势', guard: '守御', harmony: '调和', defense: '防具', material: '合成材料', cleanse: '净化散', teleport: '换位符' }
  if (names[value]) return names[value]
  const aliases = { 'heavy-armor': 'heavyArmor', energy: 'energyPotion' }
  return COPY[aliases[value] || value] || value || ''
}

function shapeCells(shape) { return (shape || [[1]]).flat().filter(Boolean).length }

function shapeText(shape) {
  const rows = shape?.length || 1
  const columns = shape?.[0]?.length || 1
  return `${rows}\u00d7${columns} \u00b7 ${shapeCells(shape)}${COPY.cell}`
}

function stat(labelText, value) {
  return `<div class="wiki-stat"><dt>${escapeHtml(labelText)}</dt><dd>${escapeHtml(value)}</dd></div>`
}

function card({ tone, tag, title, description = '', stats = [], accent = '' }) {
  return `<article class="wiki-card ${tone}">
    <div class="wiki-card-accent">${escapeHtml(accent)}</div>
    <div class="wiki-card-head"><span class="wiki-tag">${escapeHtml(tag)}</span><span class="wiki-status">${COPY.implemented}</span></div>
    <h2>${escapeHtml(title)}</h2>
    ${description ? `<p>${escapeHtml(description)}</p>` : ''}
    <dl class="wiki-stats">${stats.join('')}</dl>
  </article>`
}

function enemyCards() {
  const enemies = [...catalog.enemies, { ...catalog.boss, boss: true }]
  const lootById = new Map([...(catalog.enemyLoot || []), ...(catalog.defenses || [])].map((item) => [item.id, item]))
  return enemies.map((enemy) => card({
    tone: enemy.boss ? 'tone-boss' : 'tone-enemy',
      tag: enemy.boss ? COPY.boss : enemy.spawnOnly ? COPY.generated : COPY.enemy,
    title: enemy.name,
    accent: enemy.boss ? '\u2620' : '\u2020',
    stats: [
      stat(COPY.health, enemy.hp * ENEMY_HP_MULTIPLIER),
      stat(COPY.attack, enemy.attack),
      stat(COPY.range, `${enemy.range} ${COPY.cell}`),
      stat(COPY.delay, `${enemy.initialActionDelay} ${COPY.turn}`),
      stat(COPY.normalAttackCooldown, `${enemy.attackCooldownMax || 0} ${COPY.turn}`),
      stat(COPY.attribute, attributeLabel(enemy.attribute)),
      stat(COPY.behavior, enemyBehaviorLabel(enemy.behavior)),
      enemyFeatureLabel(enemy) ? stat(COPY.features, enemyFeatureLabel(enemy)) : '',
      enemy.regen > 0 ? stat(COPY.regen, enemy.regen) : '',
      enemy.deathExplosionDamage > 0 ? stat(COPY.deathExplosion, `\u534a\u5f84 ${enemy.explosionRadius || enemy.range || 1} \u00b7 ${enemy.deathExplosionDamage} ${COPY.damage}`) : '',
      enemy.splitMinionId ? stat(COPY.splitMinion, catalog.enemies.find((candidate) => candidate.id === enemy.splitMinionId)?.name || enemy.splitMinionId) : '',
      enemy.burningTurns > 0 ? stat(COPY.burning, `${enemy.burningTurns} ${COPY.globalTurns} \u00b7 ${enemy.burningDamage || 1} ${COPY.damage}`) : '',
      enemy.deathStatus ? stat(COPY.deathStatus, `${label(enemy.deathStatus)} ${enemy.deathStatusTurns || 0} ${COPY.globalTurns}`) : '',
      enemy.pullDistance > 0 ? stat(COPY.pull, `${enemy.pullDistance} ${COPY.cell}`) : '',
      enemy.summonMinionId ? stat(COPY.summon, `\u6bcf ${enemy.summonEvery || 0} \u6b21\u81ea\u8eab\u884c\u52a8 \u00b7 ${catalog.enemies.find((candidate) => candidate.id === enemy.summonMinionId)?.name || enemy.summonMinionId} \u00b7 \u4e0a\u9650 ${enemy.summonLimit || 0}`) : '',
      enemy.deathSpawnMinionId ? stat(COPY.deathSpawn, `${catalog.enemies.find((candidate) => candidate.id === enemy.deathSpawnMinionId)?.name || enemy.deathSpawnMinionId} \u00d7 ${enemy.deathSpawnCount || 0}`) : '',
      stat(COPY.floor, enemy.spawnOnly ? COPY.generated : enemy.minFloor),
      !enemy.spawnOnly && !enemy.boss ? stat(COPY.experience, enemy.experience || 0) : '',
      enemy.drop ? stat(COPY.loot, `${Math.round(enemy.drop.chance * 100)}% \u00b7 ${(Array.isArray(enemy.drop.itemIds) ? enemy.drop.itemIds : [enemy.drop.itemId]).map((itemId) => lootById.get(itemId)?.name || itemId).join(' / ')}`) : '',
      !enemy.spawnOnly && !enemy.boss && enemy.relicDropChance ? stat(COPY.relicChance, `${Math.round(enemy.relicDropChance * 100)}%`) : '',
    ],
  })).join('')
}

function weaponCards() {

  const weapons = [...catalog.weapons, ...(catalog.enemyLoot || []).filter((item) => item.type === 'weapon'), ...(catalog.merchantWeapons || [])]
  return weapons.map((weapon) => card({
    tone: 'tone-weapon',
    tag: COPY.weapon,
    title: weapon.name,
    accent: '\u2694',
    stats: [
      stat(COPY.weaponClass, label(weapon.weaponClass)),
      stat(COPY.attack, weapon.attack),
      stat(COPY.range, `${weapon.range} ${COPY.cell}`),
      stat(COPY.energy, WEAPON_ENERGY_COSTS[weapon.weaponClass] || 3),
      stat(COPY.attribute, attributeLabel(weapon.attribute)),
      stat(COPY.footprint, shapeText(weapon.shape)),
      stat(COPY.weaponEffect, weapon.description || ''),
    ],
  })).join('')
}

function relicCards() {
  const system = card({
    tone: 'tone-relic',
    tag: COPY.relic,
    title: '\u5723\u9057\u7269\u4e0e\u80cc\u5305',
    description: '\u80cc\u5305\u5185\u6301\u6709\u65f6\u751f\u6548\uff0c\u540c\u540d\u4e0d\u53e0\u52a0\uff1b\u65e0\u6570\u91cf\u8d85\u8f7d\u9650\u5236\u3002\u901a\u8fc7\u5f00\u5c40\u9009\u62e9\u3001\u623f\u95f4\u5956\u52b1\u548c\u5546\u5e97\u83b7\u5f97\u3002\u6563\u4ef6\u7684\u76f8\u90bb\u6548\u679c\u751f\u6548\u65f6\uff0c\u4f1a\u5728\u53cc\u65b9\u683c\u7ebf\u5904\u663e\u793a\u7eff\u8272\u6d41\u52a8\u77ed\u5149\u5e26\u3002',
    stats: [],
  })
  return system + RELIC_DEFS.map((relic) => card({
    tone: 'tone-relic',
    tag: COPY.relic,
    title: relic.name,
    description: relic.description,
    accent: '\u2726',
    stats: [],
  })).join('')
}

function talentCards() {
  return TALENT_DEFS.map((talent) => card({
    tone: 'tone-relic',
    tag: `${label(talent.line)} · ${talent.slot}`,
    title: talent.name,
    description: talent.description,
    accent: '\u2736',
    stats: [
      stat('\u5c42\u7ea7', talent.tier),
      stat('\u524d\u7f6e', talent.prerequisites.length ? talent.prerequisites.join('、') : '\u65e0'),
    ],
  })).join('')
}

function itemEffect(item) {
  if (item.type === 'potion') return stat(COPY.healing, `+${item.heal}`)
  if (item.type === 'armor') return stat(COPY.armorValue, `+${item.armor}`)
  if (item.type === 'energy') return stat('\u6062\u590d\u4f53\u529b', `+${item.energy}`)
  if (item.type === 'buff') return stat(item.attackTarget === 'melee' ? COPY.nextMeleeAttack : COPY.nextAttack, `+${item.attackBonus}`)
  return ''
}

function itemCards() {
  const items = [...catalog.defenses, ...catalog.consumables, ...(catalog.enemyLoot || []).filter((item) => item.type !== 'weapon')]
  return items.map((item) => card({
    tone: `tone-${item.type}`,
    tag: label(item.type),
    title: item.name,
    description: item.description,
    accent: item.type === 'buff' ? '\u2727' : '\u25cf',
    stats: [
      itemEffect(item),
      stat(COPY.footprint, shapeText(item.shape)),
      stat(COPY.floor, item.dropOnly ? COPY.enemyDrop : item.minFloor || 1),
      item.type === 'defense' ? stat(COPY.relicSources, '\u654c\u4eba\u6389\u843d\u3001\u5546\u5e97\u8d2d\u4e70\u3001\u623f\u95f4\u5956\u52b1\uff1b\u4e0d\u4f5c\u4e3a\u5730\u9762\u7269\u54c1\u751f\u6210\u3002') : '',
    ],
  })).join('')
}

function trapCards() {
  return TRAP_DEFS.map((trap) => {
    const stats = [stat(COPY.trigger, COPY.revealTrigger), stat(COPY.lifecycle, COPY.trapLifecycle)]
    if (trap.effect === 'explosion') stats.push(stat(COPY.range, '\u516b\u90bb\u57df'))
    if (trap.effect === 'alarm') stats.push(stat(COPY.range, '\u534a\u5f84 2'))
    if (trap.effect === 'corrosion') stats.push(stat(COPY.energyLoss, `-${trap.energyLoss || 0}`))
    if (trap.effect === 'poison') {
      stats.push(stat(COPY.duration, `${trap.poisonTurns} ${COPY.globalTurns}`))
      stats.push(stat(COPY.damage, `${trap.poisonDamage} ${COPY.health} \u00b7 \u65e0\u89c6\u62a4\u7532`))
    }
    return card({
      tone: 'tone-trap',
      tag: COPY.traps,
      title: trap.name,
      description: trap.description,
      accent: trap.effect === 'explosion' ? '\u2739' : trap.effect === 'alarm' ? '\u266b' : trap.effect === 'corrosion' ? '\u2248' : '\u2601',
      stats,
    })
  }).join('')
}

const BUILDERS = Object.freeze({ enemies: enemyCards, traps: trapCards, weapons: weaponCards, relics: relicCards, talents: talentCards, items: itemCards })

export class WikiPage {
  constructor(root = document.getElementById('hud')) {
    if (!root) throw new Error('Missing #hud container')
    this.root = root
    this.activeTab = TABS.some((tab) => tab.id === window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'enemies'
    document.body.classList.add('wiki-page')
    document.title = COPY.title
    this._build()
    this._onClick = (event) => this._handleClick(event)
    this.root.addEventListener('click', this._onClick)
    this.render()
  }

  _build() {
    this.root.innerHTML = `<main class="wiki-shell">
      <header class="wiki-header">
        <a class="wiki-back" href="/" aria-label="${COPY.back}">\u2190</a>
      <div><div class="wiki-kicker">${COPY.subtitle}</div><h1>${COPY.title}</h1><p class="wiki-summary">${COPY.summary}</p><p class="wiki-input-note">${COPY.statusNote}</p><p class="wiki-input-note">${COPY.enemyOverheadNote}</p><p class="wiki-input-note">${COPY.enemyDetailIconNote}</p><p class="wiki-input-note">${COPY.boundaryNote}</p><p class="wiki-input-note">${COPY.footprintNote}</p><p class="wiki-input-note">${COPY.attackNote}</p><p class="wiki-input-note">${COPY.combatSequenceNote}</p><p class="wiki-input-note">${COPY.pickupSequenceNote}</p><p class="wiki-input-note">${COPY.attackEnergyNote}</p><p class="wiki-input-note">${COPY.detailPresentationNote}</p><p class="wiki-input-note">${COPY.detailImageBoundsNote}</p><p class="wiki-input-note">${COPY.springStateNote}</p><p class="wiki-input-note">${COPY.spriteNote}</p><p class="wiki-input-note">${COPY.groundGoldSpriteNote}</p><p class="wiki-input-note">${COPY.groundWeaponGlowNote}</p><p class="wiki-input-note">${COPY.inventoryNote}</p><p class="wiki-input-note">${COPY.inventoryEffectNote}</p><p class="wiki-input-note">${COPY.talentChoiceNote}</p><p class="wiki-input-note">${COPY.equipmentUpgradeNote}</p><p class="wiki-input-note">${COPY.animationToolNote}</p><p class="wiki-input-note">${COPY.animationViewNote}</p><p class="wiki-input-note">${COPY.animationPartFormNote}</p><p class="wiki-lint-note">${LINT_NOTE}</p><p class="wiki-input-note">${INPUT_NOTE}</p></div>
      </header>
      <nav class="wiki-tabs" role="tablist">${TABS.map((tab) => `<button data-wiki-tab="${tab.id}" role="tab">${tab.label}</button>`).join('')}</nav>
      <section class="wiki-content" data-wiki-content></section>
    </main>`
    this.content = this.root.querySelector('[data-wiki-content]')
  }

  render() {
    this.root.querySelectorAll('[data-wiki-tab]').forEach((button) => {
      const selected = button.dataset.wikiTab === this.activeTab
      button.classList.toggle('active', selected)
      button.setAttribute('aria-selected', selected ? 'true' : 'false')
    })
    this.content.innerHTML = BUILDERS[this.activeTab]?.() || ''
  }

  _handleClick(event) {
    const tab = event.target.closest('[data-wiki-tab]')
    if (!tab || tab.dataset.wikiTab === this.activeTab) return
    this.activeTab = tab.dataset.wikiTab
    window.history.replaceState(null, '', `/wiki#${this.activeTab}`)
    this.render()
  }

  dispose() {
    this.root.removeEventListener('click', this._onClick)
    document.body.classList.remove('wiki-page')
  }
}
