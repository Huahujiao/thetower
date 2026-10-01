import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspace = fileURLToPath(new URL('../', import.meta.url))
const target = 'D:/new_test/flip'
const batch2 = process.argv.includes('--batch2')
const batch3 = process.argv.includes('--batch3')
const batch4 = process.argv.includes('--batch4')
const fourthIds = ['tidal-spore-sac', 'revenant-guard', 'bomb-wisp', 'cracked-hunter', 'broodling', 'leech-larva', 'tide-shadow']
const directory = batch4 ? 'art/generated/enemy-components-batch4-2026-10-01' : batch3 ? 'art/generated/enemy-components-batch3-2026-10-01' : batch2 ? 'art/generated/enemy-components-batch2-2026-10-01' : 'art/generated/enemy-components-2026-10-01'
const followup = process.argv.includes('--gnawer-elbow')
const resize = process.argv.includes('--enemy-size')
const baselines = JSON.parse(readFileSync(resolve(workspace, directory, resize ? 'enemy-size-sync-baselines.json' : followup ? 'gnawer-elbow-sync-baselines.json' : 'sync-baselines.json'), 'utf8'))
const textHash = path => createHash('sha256').update(readFileSync(path, 'utf8').replaceAll('\r\n', '\n')).digest('hex')
const bytesHash = path => createHash('sha256').update(readFileSync(path)).digest('hex')
function filesUnder(relative) {
  return readdirSync(resolve(workspace, relative), { withFileTypes: true }).flatMap(entry => {
    const path = `${relative}/${entry.name}`
    return entry.isDirectory() ? filesUnder(path) : [path]
  })
}
const files = batch4 ? [...Object.keys(baselines),
  'src/animation/shadow-enemy-components-batch4.js', 'scripts/import-enemy-components-batch4.py',
  ...fourthIds.flatMap(id => filesUnder(`public/assets/enemies/components-v1/${id}`)),
  ...filesUnder(directory),
] : batch3 ? [...Object.keys(baselines),
  'src/animation/shadow-enemy-components-batch3.js', 'scripts/import-enemy-components-batch3.py',
  ...['furnace-beetle', 'thorn-shell-flower', 'water-leech-swarm', 'whirlpool-eye-sac', 'cinder-curse-lamp-swarm', 'drown-shadow-hunter'].flatMap(id => filesUnder(`public/assets/enemies/components-v1/${id}`)),
  ...filesUnder(directory),
] : batch2 ? [...Object.keys(baselines),
  'src/animation/shadow-enemy-components-batch2.js', 'scripts/import-enemy-components-batch2.py',
  'scripts/record-enemy-component-batch2.mjs',
  ...['rot-walker', 'shellguard', 'wisp', 'moss-colossus', 'sentry-crossbow', 'ash-cannon-bug'].flatMap(id => filesUnder(`public/assets/enemies/components-v1/${id}`)),
  ...filesUnder(directory),
] : resize ? [...Object.keys(baselines),
  'tools/enemy-size-review.html', `${directory}/enemy-size-sync-baselines.json`, ...filesUnder(`${directory}/enemy-size-v12`),
] : followup ? [...Object.keys(baselines),
  `${directory}/gnawer-elbow-sync-baselines.json`, ...filesUnder(`${directory}/gnawer-elbow-v11`),
] : [...Object.keys(baselines),
  'src/animation/shadow-enemy-components.js', 'src/animation/enemy-component-assets.json',
  'scripts/build-enemy-component-review.py', 'tools/enemy-component-browser.mjs', 'tools/enemy-component-review.html',
  'tools/sync-enemy-components.mjs', 'docs/enemy-component-adaptation-v10.md',
  ...filesUnder('public/assets/enemies/components-v1'), ...filesUnder(directory),
]
for (const path of files) {
  const source = resolve(workspace, path), destination = resolve(target, path)
  if (!existsSync(destination)) continue
  if (baselines[path]) {
    if (![baselines[path], textHash(source)].includes(textHash(destination))) throw new Error(`Main file changed: ${path}`)
  } else if (bytesHash(source) !== bytesHash(destination)) throw new Error(`Conflicting new file: ${path}`)
}
if (!process.argv.includes('--apply')) {
  console.log(`Preflight passed: ${files.length} files; ${batch4 ? 'component batch 27-33, migration checks and review evidence' : batch3 ? 'component batch 18/19/20/21/24/26, migration checks and review evidence' : batch2 ? 'component batch 07/08/09/15/16/17, migration checks and review evidence' : resize ? 'enemy display size and width adjustments, migration checks and review evidence' : followup ? 'gnawer elbow repair, migration checks and review evidence' : '6 enemy templates, component PNGs, editor controls, checks and review evidence'}.`)
} else {
  for (const path of files) {
    const destination = resolve(target, path)
    mkdirSync(dirname(destination), { recursive: true })
    copyFileSync(resolve(workspace, path), destination)
  }
  for (const path of files) if (bytesHash(resolve(workspace, path)) !== bytesHash(resolve(target, path))) throw new Error(`Sync verification failed: ${path}`)
  console.log(`Synced and verified ${files.length} files in ${target}.`)
}
