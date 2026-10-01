"""Import explicitly numbered fourth batch, preserving original PNG bytes."""
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
MAIN = Path('D:/new_test/flip')
SOURCE = MAIN / 'island-slicer-web/output'
EVIDENCE = ROOT / 'art/generated/enemy-components-batch4-2026-10-01'
BATCH = {'27': 'tidal-spore-sac', '28': 'revenant-guard', '29': 'bomb-wisp', '30': 'cracked-hunter', '31': 'broodling', '32': 'leech-larva', '33': 'tide-shadow'}
EVIDENCE.mkdir(parents=True, exist_ok=True)
baseline_path = EVIDENCE / 'sync-baselines.json'
if not baseline_path.exists():
    paths = ['src/animation/enemy-component-assets.json', 'src/animation/shadow-enemy-components.js',
             'src/animation/shadow-enemies.js', 'scripts/shadow-rig-check.mjs',
             'tools/enemy-component-browser.mjs', 'scripts/build-enemy-component-review.py',
             'tools/sync-enemy-components.mjs', 'scripts/record-enemy-component-batch2.mjs',
             'src/render/enemy-puppet.js']
    baselines = {}
    for path in paths:
        old = (MAIN / path).read_text(encoding='utf-8')
        if old != (ROOT / path).read_text(encoding='utf-8'):
            raise ValueError(f'Main/worktree differ before import: {path}')
        baselines[path] = hashlib.sha256(old.encode('utf-8')).hexdigest()
    baseline_path.write_text(json.dumps(baselines, indent=2) + '\n', encoding='utf-8')
metadata_path = ROOT / 'src/animation/enemy-component-assets.json'
metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
for number, enemy in BATCH.items():
    folders = list(SOURCE.glob(number + '*'))
    if len(folders) != 1:
        raise ValueError(f'Expected one input folder for {number}: {folders}')
    folder = folders[0]
    images = sorted((folder / 'parts').glob('part_*.png'))
    if not images or not (folder / 'preview_indexed.png').exists():
        raise ValueError(f'Missing split PNGs or indexed preview in {folder}')
    destination = ROOT / 'public/assets/enemies/components-v1' / enemy
    destination.mkdir(parents=True, exist_ok=True)
    parts = {}
    board = Image.new('RGB', (1250, ((len(images) + 4) // 5) * 285 + 35), '#263746')
    draw = ImageDraw.Draw(board)
    draw.text((12, 10), f'{number} / {enemy} / original split components', fill='white')
    for index, path in enumerate(images):
        shutil.copyfile(path, destination / path.name)
        part_number = int(path.stem.split('_')[1])
        image = Image.open(path).convert('RGBA')
        parts[str(part_number)] = {'width': image.width, 'height': image.height,
                                  'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
        image.thumbnail((235, 245))
        x, y = index % 5 * 250, index // 5 * 285 + 35
        board.paste(image, (x + (250-image.width)//2, y), image)
        draw.text((x+8, y+251), f'{path.stem} / {parts[str(part_number)]["width"]}x{parts[str(part_number)]["height"]}', fill='white')
    board.save(EVIDENCE / f'input-{enemy}.png')
    shutil.copyfile(folder / 'preview_indexed.png', EVIDENCE / f'reference-{enemy}.png')
    metadata[enemy] = {'sourceFolder': folder.name, 'parts': parts}
    print(f'{number}: {enemy}, {len(parts)} components')
metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
