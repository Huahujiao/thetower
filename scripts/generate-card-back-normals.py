"""Derive UV-aligned OpenGL normal data from the five current card-back patterns.

This is a deterministic material-data conversion, not a repaint of the artwork.
Bright ornament becomes raised relief; surface grain remains much shallower.
Run: python scripts/generate-card-back-normals.py
"""
from pathlib import Path
import argparse
import hashlib
import json
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'src/assets'
REVIEW = ROOT / 'art/reviews'
SIZE = 512  # Matches BoardTextures' colour canvas and UV alignment.
# Smooth luminance thresholds distinguish raised ornament from the darker ground.
BACKS = {
    'neutral': ('board-card-back-temple-v2.jpg', .27, .43),
    'scorch': ('board-card-back-scorch-temple-v2.jpg', .30, .49),
    'wither': ('board-card-back-wither-temple-v2.jpg', .34, .55),
    'drown': ('board-card-back-drown-temple-v2.jpg', .27, .47),
    'blocked': ('board-card-back-blocked-v1.jpg', .20, .31),
}


def blur(values, radius):
    return np.asarray(Image.fromarray(np.uint8(np.clip(values, 0, 1) * 255)).filter(
        ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255


def relief_normal(image, low, high):
    rgb = np.asarray(image, dtype=np.float32) / 255
    luminance = rgb @ np.array([.2126, .7152, .0722], dtype=np.float32)
    # Median filtering removes JPEG grit and isolated bright cracks before tracing.
    clean = np.asarray(Image.fromarray(np.uint8(luminance * 255)).filter(
        ImageFilter.MedianFilter(3)), dtype=np.float32) / 255
    t = np.clip((blur(clean, .8) - low) / (high - low), 0, 1)
    ornament = blur(t * t * (3 - 2 * t), 1.2)
    grain = (blur(luminance, .6) - blur(luminance, 3.0)) * .12
    height = ornament * .9 + grain
    return encode_normal(height), height


def encode_normal(height):
    dy, dx = np.gradient(height)
    # OpenGL tangent space: +U right, +V up, but image rows increase downwards.
    normal = np.stack([-dx * 8.5, dy * 8.5, np.ones_like(height)], axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    normal[[0, -1], :, :] = [0, 0, 1]
    normal[:, [0, -1], :] = [0, 0, 1]
    return np.rint((normal * .5 + .5) * 255).astype(np.uint8)


def lit_preview(image, encoded, light, relief=True):
    # A software lighting study, not a screenshot of the game renderer.
    rgb = np.asarray(image, dtype=np.float32) / 255
    linear = np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4)
    n = encoded.astype(np.float32) / 255 * 2 - 1
    n[:, :, :2] *= 8.5
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    if not relief:
        n[:] = [0, 0, 1]
    light = np.array(light, dtype=np.float32)
    light /= np.linalg.norm(light)
    diffuse = np.maximum(n @ light, 0)
    shade = .44 + .85 * diffuse
    linear = np.clip(linear * shade[:, :, None], 0, 1)
    display = np.where(linear <= .0031308, linear * 12.92, 1.055 * linear ** (1 / 2.4) - .055)
    return Image.fromarray(np.rint(np.clip(display, 0, 1) * 255).astype(np.uint8))


def main():
    REVIEW.mkdir(parents=True, exist_ok=True)
    size, gap, header = 256, 12, 32
    sheet = Image.new('RGB', (size * 4 + gap * 5, (size + header + gap) * len(BACKS) + gap), '#171b20')
    draw = ImageDraw.Draw(sheet)
    manifest = {}
    for row, (kind, (filename, low, high)) in enumerate(BACKS.items()):
        source = ASSETS / filename
        image = Image.open(source).convert('RGB').resize((SIZE, SIZE), Image.Resampling.LANCZOS)
        encoded, height = relief_normal(image, low, high)
        name = 'board-card-back-' + kind + '-normal-v1.png'
        Image.fromarray(encoded).save(ASSETS / name, optimize=True)
        manifest[kind] = {'source': filename, 'normal': name, 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'size': SIZE}
        previews = [image, Image.fromarray(encoded), lit_preview(image, encoded, [-.65, .45, .75]), lit_preview(image, encoded, [.65, -.45, .75])]
        labels = ['albedo', 'OpenGL normal', 'relief / upper left light', 'relief / lower right light']
        for col, (preview, label) in enumerate(zip(previews, labels)):
            x, y = gap + col * (size + gap), gap + row * (size + header + gap)
            draw.text((x, y + 5), kind + ': ' + label, fill='#e6dcc5')
            sheet.paste(preview.resize((size, size), Image.Resampling.LANCZOS), (x, y + header))
        print(name)
    (REVIEW / 'card-back-normal-manifest-v1.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    sheet.save(REVIEW / 'card-back-relief-v1.png')



def check_assets():
    manifest = json.loads((REVIEW / 'card-back-normal-manifest-v1.json').read_text(encoding='utf-8'))
    hashes = set()
    for kind, (filename, _, _) in BACKS.items():
        entry = manifest[kind]
        assert entry['source'] == filename
        assert entry['source_sha256'] == hashlib.sha256((ASSETS / filename).read_bytes()).hexdigest(), 'Regenerate normal after changing ' + filename
        path = ASSETS / entry['normal']
        image = Image.open(path)
        assert image.mode == 'RGB' and image.size == (SIZE, SIZE)
        assert 'icc_profile' not in image.info and 'gamma' not in image.info
        pixels = np.asarray(image, dtype=np.float32)
        vectors = pixels / 255 * 2 - 1
        assert np.max(np.abs(np.linalg.norm(vectors, axis=-1) - 1)) < .008
        assert vectors[:, :, 2].min() > 0
        assert np.std(pixels[:, :, :2]) > 10, 'Normal map must contain actual relief'
        assert np.all(pixels[0] == [128, 128, 255]), 'Outer border must remain flat'
        hashes.add(hashlib.sha256(path.read_bytes()).hexdigest())
    assert len(hashes) == len(BACKS), 'Patterns must not share a generic normal map'
    y, x = np.mgrid[0:7, 0:7].astype(np.float32)
    ramp = encode_normal(.07 * x + .05 * y)[3, 3]
    assert ramp[0] < 128 and ramp[1] > 128 and ramp[2] > 128, 'OpenGL UV axes must not invert the raised relief'
    print('Card-back normals: five matched RGB maps, unit vectors, UV handedness, source hashes and flat borders passed.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Validate generated material data without changing assets')
    args = parser.parse_args()
    if args.check:
        check_assets()
    else:
        main()
