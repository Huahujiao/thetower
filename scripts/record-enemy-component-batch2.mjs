import { createHash } from 'node:crypto'
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createEnemyShadowProjects, ENEMY_ART_PACK_VERSION } from '../src/animation/shadow-enemies.js'
import { BATCH2_COMPONENT_ENEMY_IDS } from '../src/animation/shadow-enemy-components-batch2.js'
import { BATCH3_COMPONENT_ENEMY_IDS } from '../src/animation/shadow-enemy-components-batch3.js'
import { BATCH4_COMPONENT_ENEMY_IDS } from '../src/animation/shadow-enemy-components-batch4.js'
import assets from '../src/animation/enemy-component-assets.json' with { type: 'json' }

const batch3 = process.argv.includes('--batch3')
const batch4 = process.argv.includes('--batch4')
const directory = `art/generated/enemy-components-batch${batch4 ? 4 : batch3 ? 3 : 2}-2026-10-01`
const ids = batch4 ? BATCH4_COMPONENT_ENEMY_IDS : batch3 ? BATCH3_COMPONENT_ENEMY_IDS : BATCH2_COMPONENT_ENEMY_IDS
const enemies = createEnemyShadowProjects().filter(p => ids.includes(p.enemyId)).map(p => {
  const used = [...new Set(p.parts.map(part => Number(part.visual.texture.match(/part_(\d+)\.png$/)[1])))].sort((a, b) => a - b)
  for (const [number, metadata] of Object.entries(assets[p.enemyId].parts)) {
    const bytes = readFileSync(`public/assets/enemies/components-v1/${p.enemyId}/part_${number.padStart(3, '0')}.png`)
    if (createHash('sha256').update(bytes).digest('hex') !== metadata.sha256) throw new Error(`PNG bytes changed: ${p.enemyId}/${number}`)
  }
  const preview = resolve('D:/new_test/flip/island-slicer-web/output', assets[p.enemyId].sourceFolder, 'preview_indexed.png')
  copyFileSync(preview, `${directory}/reference-${p.enemyId}.png`)
  return { id: p.enemyId, name: p.name, sourceFolder: assets[p.enemyId].sourceFolder,
    reference: 'preview_indexed.png', referenceSha256: createHash('sha256').update(readFileSync(preview)).digest('hex'),
    used, unused: Object.keys(assets[p.enemyId].parts).map(Number).filter(n => !used.includes(n)),
    joints: p.joints, bones: p.bones, parts: p.parts,
    animations: Object.fromEntries(Object.entries(p.animations).map(([id, a]) => [id, { duration: a.duration, loop: a.loop, targets: Object.keys(a.tracks) }])),
  }
})
writeFileSync(`${directory}/manifest.json`, JSON.stringify({ packVersion: ENEMY_ART_PACK_VERSION, date: '2026-10-01',
  method: 'existing split PNGs, anatomical pivots/crops, indexed preview references, no new image generation', enemies }, null, 2) + '\n', 'utf8')
console.log(`Recorded ${enemies.length} adapted enemies; all source PNG hashes match.`)
