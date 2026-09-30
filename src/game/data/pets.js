export const PETS = Object.freeze([
  ['mountain-hound', '\u5de1\u5c71\u72ac', 4, 2, 1, '\u65e0\u7279\u6b8a\u6548\u679c\u3002'],
  ['venom-toad', '\u6bd2\u56ca\u87fe', 2, 2, 1, '\u547d\u4e2d\u4f7f\u654c\u4eba\u4e2d\u6bd2\u3002'],
  ['thunder-raven', '\u96f7\u7fbd\u9e26', 3, 3, 2, '\u653b\u51fb\u540e\u5bf9\u8ddd\u79bb\u76ee\u6807\u6700\u8fd1\u7684\u53e6\u4e00\u654c\u4eba\u9020\u62101\u70b9\u4f24\u5bb3\u3002'],
  ['iron-beetle', '\u94c1\u7532\u866b', 5, 1, 2, '\u653b\u51fb\u65e0\u89c6\u654c\u4eba\u7684\u62a4\u76fe\u548c\u91cd\u7532\u3002'],
  ['shadow-spider', '\u7f1a\u5f71\u86db', 2, 2, 2, '\u547d\u4e2d\u540e\u4f7f\u76ee\u6807\u4e0b\u4e00\u6b21\u884c\u52a8\u5ef6\u8fdf1\u56de\u5408\u3002'],
  ['carrion-rat', '\u98df\u5c38\u9f20', 3, 1, 1, '\u81ea\u8eab\u51fb\u6740\u654c\u4eba\u540e\uff0c\u8fd4\u8fd8\u672c\u6b21\u653b\u51fb\u7684\u98df\u7269\u6d88\u8017\u3002'],
  ['spirit-raven', '\u63a2\u7075\u9e26', 2, 3, 1, '\u51fb\u6740\u654c\u4eba\u540e\u7ffb\u5f00\u5176\u9644\u8fd11\u5f20\u672a\u7ffb\u5f00\u7684\u724c\u3002'],
  ['mandrill-beast', '\u5c71\u9b48\u517d', 8, 1, 3, '\u65e0\u7279\u6b8a\u6548\u679c\u3002'],
].map(([id, name, attack, range, foodCost, description]) => Object.freeze({
  id, name, attack, range, foodCost, description, type: 'pet', shape: [[1, 1]], rotatable: true, minFloor: 1,
})))

export const PET_RELICS = Object.freeze([
  { id: 'r-far-whistle', name: '\u8fdc\u54e8\u94c3', description: '\u6240\u6709\u5ba0\u7269\u5c04\u7a0b+1\u3002' },
  { id: 'r-hunting-horn', name: '\u730e\u573a\u53f7\u89d2', description: '\u73a9\u5bb6\u653b\u51fb\u654c\u4eba\u540e\uff0c\u672c\u56de\u5408\u6240\u6709\u5ba0\u7269\u653b\u51fb\u8be5\u654c\u4eba\u65f6\u5c04\u7a0b+2\u3002' },
  { id: 'r-pack-hunt', name: '\u7fa4\u730e\u5fbd\u7ae0', description: '\u540c\u56de\u5408\u6bcf\u6709\u4e00\u53ea\u4e0d\u540c\u5ba0\u7269\u653b\u51fb\u8fc7\u540c\u4e00\u654c\u4eba\uff0c\u540e\u7eed\u5ba0\u7269\u5bf9\u5176\u4f24\u5bb3+1\u3002' },
  { id: 'r-feeding-charm', name: '\u9972\u517d\u7b26', description: '\u76f8\u90bb\u5ba0\u7269\u98df\u7269\u6d88\u8017-1\uff0c\u6700\u4f4e\u4e3a1\u3002' },
  { id: 'r-vampire-fang', name: '\u5438\u8840\u9b3c\u7259', description: '\u5ba0\u7269\u53ef\u5c06\u8840\u74f6\u7684\u5269\u4f59\u6cbb\u7597\u70b9\u6570\u89c6\u4e3a\u98df\u7269\uff1b\u672c\u6b21\u6d88\u8017\u5305\u542b\u8840\u74f6\u65f6\u6d88\u8017-1\uff0c\u6700\u4f4e\u4e3a1\uff0c\u666e\u901a\u98df\u7269\u4e0d\u51cf\u8017\u3002' },
].map(item => Object.freeze({ ...item, attribute: null })))

export const PET_WEAPONS = Object.freeze([
  { id: 'hunter-shortbow', name: '\u730e\u624b\u77ed\u5f13', attack: 4, range: 3, energyCost: 3, appearance: 'bow', shape: [[1, 1]],
    description: '\u547d\u4e2d\u540e\u76ee\u6807\u672c\u56de\u5408\u88ab\u6807\u8bb0\u4e3a\u730e\u7269\uff1b\u5ba0\u7269\u4f18\u5148\u653b\u51fb\u730e\u7269\uff0c\u4e14\u5bf9\u5176\u4f24\u5bb3+2\u3002' },
  { id: 'butcher-knife', name: '\u5272\u8089\u5200', attack: 5, range: 1, energyCost: 3, appearance: 'dagger', shape: [[1, 1]],
    description: '\u653b\u51fb\u547d\u4e2d\u7684\u654c\u4eba\u672c\u56de\u5408\u6b7b\u4ea1\u65f6\uff0c\u83b7\u5f971\u4efd2\u70b9\u98df\u7269\u3002' },
].map(item => Object.freeze({ ...item, type: 'weapon', attribute: null, rotatable: true, minFloor: 1 })))

export const PET_DEFENSES = Object.freeze([
  { id: 'beast-armor', type: 'defense', name: '\u62a4\u517d\u7532', defenseClass: 'armor', armorValue: 1, shape: [[1, 1], [1, 1]], tier: 1,
    description: '\u5ba0\u7269\u51fb\u6740\u654c\u4eba\u65f6\uff0c\u73a9\u5bb6\u83b7\u5f972\u70b9\u62a4\u7532\u3002' },
])

export const BUTCHER_FOOD = Object.freeze({ id: 'meat-scrap', type: 'energy', name: '\u8089\u5757', energy: 2, tier: 1,
  shape: [[1]], generatedOnly: true, description: '\u5269\u4f592\u70b9\u98df\u7269\uff0c\u53ef\u4f9b\u5ba0\u7269\u6d88\u8017\uff1b\u76f4\u63a5\u4f7f\u7528\u4e00\u6b21\u6027\u6062\u590d\u5269\u4f59\u70b9\u6570\u7684\u4f53\u529b\u3002' })
