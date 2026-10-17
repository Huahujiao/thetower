"""Measure visible sprite bounds for consistent backpack padding; never edit PNGs."""
from pathlib import Path
import argparse
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT/'src/assets/inventory'
OUTPUT = ROOT/'src/ui/inventory-sprite-bounds.generated.json'
ALPHA_THRESHOLD = 8


def prepare(check=False):
    entries = {}
    for suffix in ['small', 'medium']:
        for path in sorted(ASSETS.glob('*-'+suffix+'.png')):
            with Image.open(path) as image:
                box = image.getchannel('A').point(lambda a: 255 if a >= ALPHA_THRESHOLD else 0).getbbox()
                left, top, right, bottom = box or (0, 0, *image.size)
                key = path.stem.removesuffix('-'+suffix)
                entries.setdefault(key, {})[suffix] = [image.width, image.height, left, top, right-left, bottom-top]
    if check:
        assert json.loads(OUTPUT.read_text(encoding='utf-8')) == entries, 'Sprite bounds are stale; regenerate after resizing art'
    else:
        OUTPUT.write_text(json.dumps(entries, separators=(',', ':'))+'\n', encoding='utf-8')
    print('Visible bounds '+('verified' if check else 'prepared')+' for '+str(len(entries))+' inventory sprites; alpha >= '+str(ALPHA_THRESHOLD))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    prepare(parser.parse_args().check)
