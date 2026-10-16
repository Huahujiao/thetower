"""Derive linear surface data from the existing temple stone albedos.
No repainting: colour assets remain unchanged. Normal convention is OpenGL.
"""
from pathlib import Path
import argparse
import hashlib
import json
import numpy as np
from PIL import Image, ImageFilter
ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'src/assets/environment'
SURFACES = ('temple-dressed-stone-v1', 'temple-foundation-masonry-v1')

def blur(a, radius):
    return np.asarray(Image.fromarray(np.uint8(np.clip(a, 0, 1) * 255)).filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255

def smooth(a, lo, hi):
    t = np.clip((a - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)

def derive(name):
    rgb = np.asarray(Image.open(ASSETS / (name + '.jpg')).convert('RGB').resize((512,512), Image.Resampling.LANCZOS), dtype=np.float32) / 255
    luma = rgb @ np.array([.2126, .7152, .0722])
    relief = blur(luma, 1.1) - blur(luma, 8)
    masonry = 'masonry' in name
    # Coarse stone joints are deeper than the mineral grain, without making
    # every colour vein a deep crack or changing the original stone drawing.
    joints = smooth(blur(luma, .8), .14, .28) if masonry else 0
    height = relief * .7 + (joints * .30 if masonry else 0)
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * .5
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * .5
    strength = 15 if masonry else 8
    slope = np.maximum(1, np.hypot(dx, dy) * strength / 1.2)
    normal = np.stack([-dx * strength / slope, dy * strength / slope, np.ones_like(dx)], axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    normal = np.uint8(np.clip((normal * .5 + .5) * 255 + .5, 0, 255))
    cavity = 1 - smooth(blur(luma, .9), .13, .27)
    ao = 1 - cavity * (.30 if masonry else .13)
    wear = smooth(blur(luma, 2), .20, .57)
    roughness = np.clip(.78 - wear * .24 + cavity * .10 + relief * .25, .50, .90)
    packed = np.uint8(np.stack([ao, roughness, np.zeros_like(ao)], axis=-1) * 255 + .5)
    return normal, packed

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    manifest = {}
    for name in SURFACES:
        normal, packed = derive(name)
        for suffix, pixels in (('normal', normal), ('surface', packed)):
            target = ASSETS / (name + '-' + suffix + '.png')
            if args.check:
                actual = Image.open(target)
                assert actual.mode == 'RGB' and actual.size == (512,512), target
                assert np.array_equal(np.asarray(actual), pixels), 'Stale map: ' + str(target)
            else:
                Image.fromarray(pixels).save(target, optimize=True)
        decoded = normal.astype(np.float32) / 255 * 2 - 1
        assert np.max(np.abs(np.linalg.norm(decoded, axis=-1) - 1)) < .008
        assert decoded[:,:,2].min() > .5
        assert np.std(normal[:,:,:2]) > 3
        manifest[name] = {'sourceSha256': hashlib.sha256((ASSETS / (name + '.jpg')).read_bytes()).hexdigest(), 'size':512, 'normal':'OpenGL, linear', 'surface':'R=ambient occlusion, G=roughness, B=0'}
    if not args.check:
        (ROOT / 'art/reviews/temple-stone-surface-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf8')
    print('Temple stone surface maps: both albedos, normals, packed AO/roughness verified.' if args.check else 'Generated 4 temple stone surface maps.')
if __name__ == '__main__':
    main()
