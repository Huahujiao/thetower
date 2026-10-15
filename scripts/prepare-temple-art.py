"""Slice new generated environment sheets without overwriting source art."""
import sys
from pathlib import Path
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'art/generated'
ASSETS = ROOT / 'src/assets'
ENV = ASSETS / 'environment'
ENV.mkdir(parents=True, exist_ok=True)

atlas = Image.open(RAW / 'temple-floor-atlas-v3.png').convert('RGB')
w, h = atlas.size
for i, letter in enumerate('abcd'):
    box = (i % 2 * w // 2, i // 2 * h // 2, (i % 2 + 1) * w // 2, (i // 2 + 1) * h // 2)
    tile = atlas.crop(box).resize((512, 512), Image.Resampling.LANCZOS)
    tile = ImageEnhance.Color(tile).enhance(0.90)
    tile = ImageEnhance.Brightness(tile).enhance(0.88)
    tile.save(ASSETS / ('board-floor-temple-' + letter + '-v3.jpg'), quality=94)

if '--floor-only' not in sys.argv:
    Image.open(RAW / 'temple-mountains-v1.png').convert('RGB').save(ENV / 'temple-mountains-v1.jpg', quality=90)
    props = Image.open(RAW / 'temple-props-sheet-v1.png').convert('RGBA')
    for name, box in [('temple-maple-v1', (0, 0, 1100, 1024)), ('temple-banner-v1', (1100, 0, 1536, 1024))]:
        props.crop(box).save(ENV / (name + '.png'))
print('Temple environment derivatives prepared; original generated sheets retained.')
