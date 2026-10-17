"""Bake reference-led colour into scenery albedos, preserving source art and alpha."""
from pathlib import Path
import argparse
import hashlib
import json
import numpy as np
from PIL import Image, ImageFilter
from scene_color_palette import architecture_colour, prop_colour

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'src/assets'
OUTPUT = ASSETS / 'environment/palette-v1'
MANIFEST = ROOT / 'art/reviews/temple-palette-manifest.json'
FILES = {
    'stone.webp': ('environment/temple-dressed-stone-v1.jpg', 'stone'),
    'masonry.webp': ('environment/temple-foundation-masonry-v1.jpg', 'masonry'),
    'wood.webp': ('environment/temple-gate-lacquer-v1.jpg', 'wood'),
    'soil.webp': ('board-floor-plain-v1.jpg', 'soil'),
    'maple.webp': ('environment/temple-maple-v1.png', None),
    'banner.webp': ('environment/temple-banner-v1.png', None),
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    records = {}
    for name, (source, kind) in FILES.items():
        original = Image.open(ASSETS/source)
        image = original.convert('RGB')
        if kind:
            image = image.resize((256, 256), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(.3))
        values = np.asarray(image, dtype=np.float32)/255
        graded = architecture_colour(values, kind) if kind else prop_colour(values)
        data = np.uint8(np.clip(graded, 0, 1)*255+.5)
        if not kind:
            data = np.dstack([data, np.asarray(original.getchannel('A'))])
        if not kind:
            # A 512px tree and 218x512 banner cover their normal mobile footprint.
            prepared = Image.fromarray(data)
            prepared.thumbnail((512, 512), Image.Resampling.LANCZOS)
            data = np.asarray(prepared)
        target = OUTPUT/name
        if not args.check:
            out = Image.fromarray(data)
            if kind:
                out.save(target, quality=86, method=6)
            else:
                out.save(target, quality=86, method=6, exact=True)
        actual = Image.open(target)
        assert actual.size == (data.shape[1], data.shape[0])
        if not kind:
            assert np.array_equal(np.asarray(actual.getchannel('A')), data[:, :, 3]), 'Resampled alpha changed: '+name
        records[name] = {'source': source, 'size': list(actual.size),
                         'bytes': target.stat().st_size,
                         'sourceSha256': hashlib.sha256((ASSETS/source).read_bytes()).hexdigest(),
                         'derivedSha256': hashlib.sha256(data.tobytes()).hexdigest(),
                         'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}
    manifest = {'files': records}
    if args.check:
        assert json.loads(MANIFEST.read_text(encoding='utf-8')) == manifest, 'Palette is stale; regenerate scenery colours'
    else:
        MANIFEST.write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
    print('Scenery palette '+('verified' if args.check else 'prepared')+': 4 surfaces, 2 props; source art and resampled alpha preserved.')


if __name__ == '__main__':
    main()
