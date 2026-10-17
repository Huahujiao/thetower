"""Build compact, screen-readable board colour/normal/ORM maps from source art.

Source artwork is preserved. All published board maps share the same 256px UVs.
Run with --check to verify deterministic data and the encoded asset manifest.
"""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scene_color_palette import board_colour

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'src/assets'
OUTPUT = ASSETS / 'board-runtime'
MANIFEST = ROOT / 'art/reviews/board-runtime-manifest.json'
SIZE = 256
WORK_SIZE = 512
# The value layer carries no pattern detail, so it ships small and in variants
# the scene picks between per tile.
WEAR_SIZE = 96
CARD_WEAR_VARIANTS = 3
spec = importlib.util.spec_from_file_location('card_normals', ROOT / 'scripts/generate-card-back-normals.py')
card = importlib.util.module_from_spec(spec)
spec.loader.exec_module(card)

# A few readable fractures, rather than a field of subpixel scratches.
# Coordinates are normalized to a 256px slab and stay away from the frame.
CRACKS = {
    'a': [[(4, 8), (30, 32), (61, 48), (81, 70), (111, 83), (141, 104), (166, 111)],
          [(76, 65), (72, 88), (84, 119)]],
    'b': [[(251, 66), (223, 86), (208, 107), (175, 125), (153, 146), (116, 159)],
          [(209, 106), (215, 137), (201, 166)]],
    'c': [[(5, 184), (34, 172), (58, 148), (83, 138), (101, 112), (118, 103)],
          [(56, 149), (53, 121), (36, 99)]],
    'd': [[(246, 243), (218, 213), (205, 181), (176, 161), (166, 139), (137, 121)],
          [(203, 181), (177, 188), (151, 176)]],
}


def smooth(a, lo, hi):
    t = np.clip((a-lo)/(hi-lo), 0, 1)
    return t*t*(3-2*t)


def blur(a, radius):
    return np.asarray(Image.fromarray(np.uint8(np.clip(a, 0, 1)*255)).filter(
        ImageFilter.GaussianBlur(radius)), dtype=np.float32)/255


def pixels(image):
    return np.asarray(image, dtype=np.float32)/255


def desaturate(rgb, amount):
    luma = (rgb @ np.array([.2126, .7152, .0722]))[..., None]
    return luma+(rgb-luma)*amount


def resize_data(a, size = SIZE):
    # Resample linear channels independently; never apply an sRGB transfer to data.
    return np.stack([np.asarray(Image.fromarray(a[..., i].astype(np.float32)).resize(
        (size, size), Image.Resampling.LANCZOS)) for i in range(a.shape[-1])], axis=-1)


def encode(a):
    return np.uint8(np.clip(a, 0, 1)*255+.5)


def normal(height, strength):
    dy, dx = np.gradient(height)
    vectors = np.stack([-dx*strength, dy*strength, np.ones_like(dx)], axis=-1)
    vectors = resize_data(vectors)
    vectors /= np.linalg.norm(vectors, axis=-1, keepdims=True)
    vectors[[0, -1], :] = [0, 0, 1]
    vectors[:, [0, -1]] = [0, 0, 1]
    return encode(vectors*.5+.5)


def crack_masks(kind):
    """Primary fractures and hairline cracks, kept apart so they can differ.

    The primary run used to be drawn four pixels wide and cut a fifth of the
    slab's height, which read as a canyon, while the hairline scale had no
    presence at all. The hairlines are seeded so every variant stays stable.
    """
    primary = Image.new('L', (WORK_SIZE, WORK_SIZE))
    pen = ImageDraw.Draw(primary)
    for index, path in enumerate(CRACKS[kind]):
        pen.line([(x*2, y*2) for x, y in path], fill=255, width=2 if index == 0 else 1, joint='curve')
    main = pixels(primary.filter(ImageFilter.GaussianBlur(.7)))

    hair = Image.new('L', (WORK_SIZE, WORK_SIZE))
    pen = ImageDraw.Draw(hair)
    rng = np.random.default_rng(sum(ord(char) for char in kind)+91)
    for _ in range(24):
        x, y = rng.uniform(.10, .90, 2)*WORK_SIZE
        angle = rng.uniform(0, np.pi*2)
        run = [(x, y)]
        for _ in range(int(rng.integers(3, 7))):
            angle += rng.normal(0, .55)
            step = rng.uniform(.018, .05)*WORK_SIZE
            x = float(np.clip(x+np.cos(angle)*step, 2, WORK_SIZE-3))
            y = float(np.clip(y+np.sin(angle)*step, 2, WORK_SIZE-3))
            run.append((x, y))
        pen.line(run, fill=255, width=1, joint='curve')
    micro = pixels(hair.filter(ImageFilter.GaussianBlur(.4)))
    return main, micro


# Painted card backs: rim, hairline keyline, inset panel, painted motif.
# The board used to share the card's stone material, so a card was
# indistinguishable from the floor beneath it. These are five painted card
# surfaces - not five stone slabs.
# Order is (rim, ground, panel, motif, keyline).
# The element identity stays exactly as it always was - grey-white, red, yellow,
# blue, plus a dead grey for blocked - so the player can still read a back at a
# glance. Only the treatment changes: each colour is aged, knocked back toward
# the temple's muted palette and dropped roughly a quarter in value, so the
# board sits in shadow and the painted enemies standing on it stay the subject.
LACQUER = {
    # Neutral is the plain card, and it is strictly achromatic: every stop is a
    # #XXXXXX grey with R == G == B. Any warm cast here reads as a yellow card
    # and breaks the grey-white/red/yellow/blue identity the board depends on.
    # The rim is the outermost painted band. It used to sit well below the
    # ground, which against a dark board turned every attribute into the same
    # black frame. A rim a shade *above* the ground reads as a lit bevel and
    # keeps each element's own colour at the card's edge.
    'neutral': ('#787878', '#6a6a6a', '#777777', '#d4d4d4', '#5e5e5e'),
    # The three elements stay legible as red, yellow and blue, but the earlier
    # values were loud enough to read as game tokens rather than aged lacquer.
    'scorch': ('#75574e', '#634840', '#725850', '#cbbfaf', '#74544c'),
    'wither': ('#726553', '#5f584a', '#6f6859', '#d2cbb8', '#6b6149'),
    'drown': ('#4a5c65', '#3e4d55', '#4d5d66', '#bcc5c5', '#465b64'),
    'blocked': ('#555b5f', '#464a4d', '#545a5e', '#949a9c', '#4a4f52'),
}
# Normalised distance from the tile edge at which each painted layer starts.
RIM_EDGE, RIM_INNER, LINE_INNER, PANEL_INNER = .028, .040, .052, .064


def colour(value):
    # Accepts bare hex or #RRGGBB.
    value = value.lstrip('#')
    return np.array([int(value[i:i+2], 16)/255 for i in (0, 2, 4)], dtype=np.float32)


def field(values, radius):
    """Resample a coarse random field to tile size and blur it into brush drift."""
    coarse = np.asarray(Image.fromarray(np.uint8(np.clip(values, 0, 1)*255)).resize(
        (WORK_SIZE, WORK_SIZE), Image.Resampling.BICUBIC), dtype=np.float32)/255
    return blur(coarse, radius)


def edge_distance(kind):
    """Normalized distance to the nearest tile edge, nudged off dead-straight."""
    grid = np.mgrid[0:WORK_SIZE, 0:WORK_SIZE].astype(np.float32)/WORK_SIZE
    distance = np.minimum(np.minimum(grid[0], 1-grid[0]), np.minimum(grid[1], 1-grid[1]))
    seed = np.random.default_rng(sum(ord(char) for char in kind))
    drift = field(seed.random((5, 5), dtype=np.float32), 18)-field(seed.random((3, 3), dtype=np.float32), 70)
    return distance+drift*.014


def craze_mask(seed):
    """Craquelure: a dense network of hairline cracks in the lacquer.

    A plain field needs its own ageing. Broad stains and rim darkening only say
    "old card"; it is the fine crack network that makes an untouched panel look
    handled rather than freshly printed.
    """
    image = Image.new('L', (WORK_SIZE, WORK_SIZE))
    pen = ImageDraw.Draw(image)
    for _ in range(150):
        x, y = seed.uniform(0, 1, 2)*WORK_SIZE
        angle = seed.uniform(0, np.pi*2)
        run = [(x, y)]
        for _ in range(int(seed.integers(2, 5))):
            angle += seed.normal(0, .75)
            step = seed.uniform(.010, .030)*WORK_SIZE
            x = float(np.clip(x+np.cos(angle)*step, 1, WORK_SIZE-2))
            y = float(np.clip(y+np.sin(angle)*step, 1, WORK_SIZE-2))
            run.append((x, y))
        pen.line(run, fill=255, width=1, joint='curve')
    return pixels(image.filter(ImageFilter.GaussianBlur(.35)))


def organic_field(seed, octaves = 4, base = 3):
    """Summed value noise, normalised to 0..1.

    Low-resolution random fields upsampled bicubically come out as faceted
    polygons, and polygons are exactly what read as low-poly. Stacking
    octaves at rising resolution gives shapes with no straight edges.
    """
    total = np.zeros((WORK_SIZE, WORK_SIZE), dtype=np.float32)
    amplitude, weight = 1.0, 0.0
    for octave in range(octaves):
        cells = base * 2 ** octave
        total = total + amplitude * field(seed.random((cells, cells), dtype=np.float32), cells * .34)
        weight += amplitude
        amplitude *= .55
    total /= max(weight, 1e-6)
    return np.clip((total-total.min())/max(float(np.ptp(total)), 1e-6), 0, 1)


def lacquer_back(ornament, source_luma, kind):
    """Compose the painted card back from layered masks instead of a stone ramp."""
    rim, ground, panel, ink, keyline = (colour(value) for value in LACQUER[kind])
    distance = edge_distance(kind)
    rim_t = 1-smooth(distance, RIM_EDGE, RIM_INNER)
    line_t = smooth(distance, RIM_EDGE, RIM_INNER)-smooth(distance, LINE_INNER, PANEL_INNER)
    panel_t = smooth(distance, LINE_INNER, PANEL_INNER)

    # Brushwork, not a stencil: warp the source ornament and feather its edge.
    grid_y, grid_x = np.mgrid[0:WORK_SIZE, 0:WORK_SIZE]
    warp_x = (blur(source_luma, 9)-blur(source_luma, 45))*WORK_SIZE*.12
    warp_y = (blur(source_luma, 45)-blur(source_luma, 130))*WORK_SIZE*.09
    rows = np.clip((grid_y+warp_y).astype(int), 0, WORK_SIZE-1)
    cols = np.clip((grid_x+warp_x).astype(int), 0, WORK_SIZE-1)
    painted = ornament[rows, cols]
    # Keep the source's crisp brush edges; only feather enough to lose the
    # machine-stencil cutoff.
    ink_t = smooth(painted, .34, .50)*smooth(painted, .16, .34)
    ink_t = np.clip(ink_t+blur(ink_t, 6)*.08, 0, 1)
    # The source's own frame sits under the painted rim; keep the rim clean so
    # the card edge stays a solid dark line instead of a second ornament.
    ink_t = ink_t*(1-rim_t)*.84

    # Lacquer depth and grain.
    seed = np.random.default_rng(sum(ord(char) for char in kind)+17)
    grain = (blur(source_luma, .8)-blur(source_luma, 3.4))*.45
    worn = rim_t*.30+(1-panel_t)*.30
    scuff = np.clip((blur(source_luma, .6)-blur(source_luma, 2.2))*.8, -.05, .05)

    result = np.broadcast_to(ground, (WORK_SIZE, WORK_SIZE, 3)).copy()
    for mask, tint in ((rim_t, rim), (line_t, keyline), (panel_t, panel)):
        result = result*(1-mask[..., None])+tint*mask[..., None]
    result = result*(1-panel_t[..., None])+panel*panel_t[..., None]
    result = result*(1-ink_t[..., None])+ink*ink_t[..., None]

    # Ageing. Broad tone comes from the source artwork, exactly as the paving
    # does, so it inherits the stone's own structure instead of a synthetic
    # field. Everything added on top is a stroke or a tide mark, never a blob.
    local = blur(source_luma, 13)
    low, high = np.quantile(local, [.12, .88])
    wear = smooth(local, low, high)

    craze = craze_mask(np.random.default_rng(sum(ord(char) for char in kind)+53))

    result = result*(1-worn[..., None]*.26)
    result = result*(1-craze[..., None]*.27)
    # Only the pattern lives here. Broad tone, tide marks and stains are a
    # separate, lower-resolution layer so they can be varied per tile.
    return np.clip(result+scuff[..., None]+grain[..., None]*.12, 0, 1)


def card_wear(source_luma, kind, variant):
    """The card's value layer: broad tone plus tide marks, as a multiplier.

    Kept out of the artwork entirely and shipped at WEAR_SIZE, because none of
    this carries pattern detail - it is soft organic shading that the camera
    resolves long before the texture's own pixels do.
    """
    seed = np.random.default_rng(sum(ord(char) for char in kind)*31 + variant*7919)
    local = blur(source_luma, 13)
    low, high = np.quantile(local, [.12, .88])
    wear = smooth(local, low, high)

    tide = organic_field(seed, 4, 3)
    tide_line = smooth(tide, .50, .53)-smooth(tide, .60, .65)
    tide_pool = smooth(tide, .58, .68)
    runs = organic_field(seed, 4, 5)
    runs_line = smooth(runs, .52, .55)-smooth(runs, .63, .68)
    veins = 1-np.abs(organic_field(seed, 3, 9)*2-1)

    multiplier = np.clip(.80+wear*.30-tide_line*.21-tide_pool*.08-runs_line*.12+veins*.05, .58, 1.12)
    wear_rgb = np.repeat(resize_data(multiplier[..., None], WEAR_SIZE)[..., :1], 3, axis=-1)
    return np.uint8(np.clip(wear_rgb*255+.5, 0, 255))


def assets():
    for kind, (source, low, high) in card.BACKS.items():
        image = Image.open(ASSETS / source).convert('RGB').resize((WORK_SIZE, WORK_SIZE), Image.Resampling.LANCZOS)
        _, height = card.relief_normal(image, low, high)
        ornament = np.clip(height/.9, 0, 1)
        inlay = smooth(ornament, .06, .65)
        rgb = desaturate(pixels(image.filter(ImageFilter.GaussianBlur(.65))), .55)
        luma = rgb @ np.array([.2126, .7152, .0722])
        # Painted lacquer rather than a stone ramp: the card keeps the original
        # emblem, but sits in its own warm ground with a visible rim and keyline.
        rgb = lacquer_back(ornament, luma, kind)
        # Lacquer is matte with a whisper of relief, not carved mineral.
        rough = np.clip(.80-inlay*.05+(blur(luma, 2)-blur(luma, 8))*.08, .74, .88)
        ao = 1-np.clip((blur(height, 2)-height)*.22, 0, .07)
        # A painted surface still has tooth and brush unevenness. Most of the
        # relief has to sit in the low band: the fine tooth averages away when
        # a 256px card is minified on screen, which is why the backs read flat.
        tooth = (blur(luma, .8)-blur(luma, 3.0))*.45
        brush = (blur(luma, 6)-blur(luma, 46))*1.25
        card_height = ornament*.55+tooth+brush
        yield 'card-'+kind+'-color.webp', encode(resize_data(rgb)), source, SIZE
        yield 'card-'+kind+'-normal.png', normal(blur(card_height, 1.2), 11.0), source, SIZE
        yield 'card-'+kind+'-surface.png', encode(resize_data(np.stack([ao, rough, np.zeros_like(rough)], axis=-1))), source, SIZE
        for variant in range(CARD_WEAR_VARIANTS):
            yield 'card-'+kind+'-wear'+str(variant)+'.png', card_wear(luma, kind, variant), source, WEAR_SIZE
    for kind in ['a', 'b', 'c', 'd']:
        source = 'board-floor-temple-'+kind+'-v4.jpg'
        image = Image.open(ASSETS / source).convert('RGB').resize((WORK_SIZE, WORK_SIZE), Image.Resampling.LANCZOS)
        rgb = desaturate(pixels(image.filter(ImageFilter.GaussianBlur(.9))), .55)
        luma = rgb @ np.array([.2126, .7152, .0722])
        main, micro = crack_masks(kind)
        # Low-frequency wear survives the normal camera distance; grain stays quiet.
        local = blur(luma, 14)
        lo, hi = np.quantile(local, [.12, .88])
        wear = smooth(local, lo, hi)
        crack = np.clip(main+micro, 0, 1)
        # Hairlines are a pixel or two wide, so they need more contrast than the
        # primary run to read at all; the primary in turn keeps only a trace.
        rgb = rgb*(.88+wear[..., None]*.30)*(1-main[..., None]*.34)*(1-micro[..., None]*.66)
        # Three scales of relief: mineral tooth, slab unevenness and the cracks.
        tooth = (blur(luma, 1.1)-blur(luma, 3.6))*.30
        uneven = (blur(luma, 5)-blur(luma, 26))*.62
        height = tooth+uneven-main*.10-micro*.13
        # The board used to read as wet polished stone: two thirds of the floor sat
        # under roughness 0.5 while the cards above it were 0.8 matte. Shift the
        # whole distribution up so paving and card share one dry surface.
        rough = np.clip(.70-wear*.18+crack*.22, .50, .88)
        # Ambient occlusion concentrates in the hairlines, which are narrow
        # enough to actually darken rather than wash out.
        ao = 1-np.clip(main*.08+micro*.20, 0, .22)
        yield 'floor-'+kind+'-color.webp', encode(resize_data(board_colour(rgb, 'floor'))), source, SIZE
        yield 'floor-'+kind+'-normal.png', normal(height, 22), source, SIZE
        yield 'floor-'+kind+'-surface.png', encode(resize_data(np.stack([ao, rough, np.zeros_like(rough)], axis=-1))), source, SIZE


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    records = {}
    for name, data, source, size in assets():
        target = OUTPUT / name
        assert data.shape == (size, size, 3)
        if not args.check:
            image = Image.fromarray(data)
            if name.endswith('.webp'):
                image.save(target, quality=84, method=6)
            else:
                image.save(target, optimize=True)
        actual = Image.open(target)
        assert actual.size == (size, size) and actual.mode == 'RGB', name
        if not name.endswith('.webp'):
            assert np.array_equal(np.asarray(actual), data), 'Stale data: '+name
        records[name] = {
            'size': size, 'bytes': target.stat().st_size,
            'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
            'source': source, 'source_sha256': hashlib.sha256((ASSETS/source).read_bytes()).hexdigest(),
            'derived_sha256': hashlib.sha256(data.tobytes()).hexdigest(),
        }
    manifest = {'size': SIZE, 'files': records, 'totalBytes': sum(item['bytes'] for item in records.values())}
    if args.check:
        assert json.loads(MANIFEST.read_text(encoding='utf-8')) == manifest, 'Runtime manifest is stale; run prepare-board-runtime.py'
    else:
        MANIFEST.write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
    print(str(len(records))+' runtime board textures '+('verified' if args.check else 'prepared')+'; '+str(manifest['totalBytes'])+' bytes')


if __name__ == '__main__':
    main()
