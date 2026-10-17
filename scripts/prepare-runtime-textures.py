"""Small display textures for scenery and gameplay enemy parts; preserve originals."""
from pathlib import Path
import argparse
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT/'src/assets'
SCENERY = {
    'mountains.webp': ('environment/temple-mountains-v1.jpg', 768),
    'peaks.webp': ('environment/temple-parallax-peaks-v2.webp', 768),
    'clouds.webp': ('environment/temple-parallax-clouds-v1.webp', 768),
    'brick.webp': ('board-floor-brick-v1.jpg', 256),
}
REGISTRY = ROOT/'src/render/enemy-texture-runtime.generated.json'
MANIFEST = ROOT/'art/reviews/runtime-texture-manifest.json'


def prepare(source, target, edge, check):
    with Image.open(source) as original:
        image = original.convert('RGBA' if 'A' in original.getbands() else 'RGB')
        size = list(image.size)
        image.thumbnail((edge, edge), Image.Resampling.LANCZOS)
        if not check:
            target.parent.mkdir(parents=True, exist_ok=True)
            image.save(target, quality=85, method=3, exact=True)
        with Image.open(target) as actual:
            assert actual.size == image.size, 'Wrong runtime size: '+str(target)
            if image.mode == 'RGBA':
                assert actual.getchannel('A').tobytes() == image.getchannel('A').tobytes(), 'Alpha mismatch: '+str(target)
        return {'sourceSize': size, 'size': list(image.size), 'sourceBytes': source.stat().st_size,
                'bytes': target.stat().st_size, 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    scenery = {}
    for name, (source, edge) in SCENERY.items():
        scenery[name] = prepare(ASSETS/source, ASSETS/'environment/runtime-lite'/name, edge, args.check)
    source_registry = json.loads((ROOT/'src/animation/enemy-texture-styles.generated.json').read_text())
    urls, enemies = {}, {}
    for url in source_registry['sources']:
        # Gameplay puppets use segmented parts; full art sheets stay in the editor.
        if '/components-v1/' not in url:
            continue
        relative = Path(url.removeprefix('/assets/enemies/')).with_suffix('.webp')
        output = '/assets/enemies/runtime-lite/'+relative.as_posix()
        enemies[url] = prepare(ROOT/'public'/url.lstrip('/'), ROOT/'public'/output.lstrip('/'), 256, args.check)
        urls[url] = output
    revision = hashlib.sha256(json.dumps(enemies, sort_keys=True).encode()).hexdigest()[:12]
    registry = {'maxEdge': 256, 'revision': revision, 'urls': urls}
    manifest = {'scenery': scenery, 'enemies': enemies}
    if args.check:
        assert json.loads(REGISTRY.read_text()) == registry, 'Enemy runtime registry is stale'
        assert json.loads(MANIFEST.read_text()) == manifest, 'Runtime manifest is stale'
    else:
        REGISTRY.write_text(json.dumps(registry, indent=2)+'\n', encoding='utf-8')
        MANIFEST.write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
    old = sum(item['sourceBytes'] for item in enemies.values())
    new = sum(item['bytes'] for item in enemies.values())
    print('Runtime textures '+('verified' if args.check else 'prepared')+': '+str(len(enemies))+' enemy parts '+str(old)+' -> '+str(new)+' bytes; 4 scenery textures.')


if __name__ == '__main__':
    main()
