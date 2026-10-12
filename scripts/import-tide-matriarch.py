"""Import the 18 user-sliced matriarch parts without changing their pixels."""
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
folder, = (ROOT / 'island-slicer-web/output').glob('25*')
manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf-8'))
assert len(manifest['parts']) == 18
destination = ROOT / 'public/assets/enemies/components-v1/tide-rite-matriarch'
destination.mkdir(parents=True, exist_ok=True)
parts = {}
for entry in manifest['parts']:
    source = folder / entry['file']
    target = destination / source.name
    with Image.open(source) as image:
        width, height = image.size
    shutil.copyfile(source, target)
    parts[str(entry['id'])] = dict(width=width, height=height,
        sha256=hashlib.sha256(source.read_bytes()).hexdigest(), exportBounds=entry['exportBounds'])
path = ROOT / 'src/animation/enemy-component-assets.json'
assets = json.loads(path.read_text(encoding='utf-8'))
assets['tide-rite-matriarch'] = dict(sourceFolder=folder.name, parts=parts)
path.write_text(json.dumps(assets, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('tide-rite-matriarch: imported 18 unchanged PNGs')
