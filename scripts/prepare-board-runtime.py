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
CARD_PATTERN_VARIANTS = 4
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
# The four attribute backs should read as cool, low-saturation lacquer rather
# than coloured game tokens. Desaturate them, but keep the surface light: the
# temple is hazy and the board needs to sit in that haze, not sink into it.
# Keeping the ratio between the five stops means the card still reads as one
# lacquer surface. The blocked back is excluded because it already marks
# unreachable ground and must stay visibly inert, not merely less coloured.
BACK_TONE_SATURATION = .86
BACK_TONE_EXPOSURE = 1.00
BACK_TONE_KINDS = frozenset(('neutral', 'scorch', 'wither', 'drown'))
LUMA_WEIGHTS = np.array([.2126, .7152, .0722], dtype=np.float32)
LACQUER = {
    # Neutral is the plain card, and it is strictly achromatic: every stop is a
    # #XXXXXX grey with R == G == B. Any warm cast here reads as a yellow card
    # and breaks the grey-white/red/yellow/blue identity the board depends on.
    # The rim is the outermost painted band. It used to sit well below the
    # ground, which against a dark board turned every attribute into the same
    # black frame. A rim a shade *above* the ground reads as a lit bevel and
    # keeps each element's own colour at the card's edge.
    # The fourth stop is the pattern. It spent a while at both ends of the range -
    # first near-white, then the darkest value of the family - and a bright or
    # near-black motif both read as a line laid on top of the card rather than
    # as the card's own surface. It now sits one gentle step above the ground,
    # reusing the ground value this palette used before the motif was dropped:
    # the relief and the lighting carry the pattern, the paint only tints it.
    # Ground and panel now follow the motif down in short steps (0.95x and 0.90x of
    # it, keyline 0.86x), so the field is only a little darker than the pattern
    # and the card reads as one lacquer surface instead of a pale line on a dark
    # ground. Darkening the field further only widens a gap that already exists.
    # The rim stays where it is: it is the lit bevel at the card edge.
    'neutral': ('#787878', '#5f5f5f', '#656565', '#6a6a6a', '#5b5b5b'),
    # The three elements stay legible as red, yellow and blue, but the earlier
    # values were loud enough to read as game tokens rather than aged lacquer.
    'scorch': ('#793b3b', '#592626', '#602a2a', '#672f2f', '#542323'),
    'wither': ('#847a24', '#625a19', '#68601c', '#6e6520', '#5c5417'),
    'drown': ('#36567b', '#253d5b', '#284263', '#2d486a', '#223854'),
    'blocked': ('#3e4446', '#292e30', '#2f3436', '#343a3b', '#252a2c'),
}
# Linear RGB multipliers: shift hue/chroma within an attribute family.
# These are paint pigments, not light/dark exposure stages.
CARD_PIGMENTS = {
    'neutral': ((.94, .95, .97), (.97, .95, .92), (.94, .94, .94)),
    'scorch': ((1.00, .76, .76), (1.00, .80, .77), (.98, .78, .78)),
    'wither': ((1.00, 1.00, .72), (1.00, .97, .70), (.98, 1.00, .76)),
    'drown': ((.70, .86, 1.00), (.74, .89, 1.00), (.72, .85, .98)),
}

# Normalised distance from the tile edge at which each painted layer starts.
RIM_EDGE, RIM_INNER, LINE_INNER, PANEL_INNER = .028, .040, .052, .064


def colour(value):
    # Accepts bare hex or #RRGGBB.
    value = value.lstrip('#')
    return np.array([int(value[i:i+2], 16)/255 for i in (0, 2, 4)], dtype=np.float32)


def surface_tone(value, kind):
    """Cool the four attribute backs and lift their exposure without changing hue."""
    rgb = colour(value)
    if kind not in BACK_TONE_KINDS:
        return rgb
    luma = float(rgb @ LUMA_WEIGHTS)
    rgb = luma+(rgb-luma)*BACK_TONE_SATURATION
    return np.clip(rgb*BACK_TONE_EXPOSURE, 0, 1)


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


def lacquer_back(ornament, source_luma, kind, variant=0):
    """Compose the painted card back from layered masks instead of a stone ramp."""
    rim, ground, panel, ink, keyline = (surface_tone(value, kind) for value in LACQUER[kind])
    if variant:
        ink = np.clip(ink*1.1, 0, 1)
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

    # Rough surface colour and grain.
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


def water_stains(seed, levels=(.72, .89, 1.03, 1.15)):
    """Four soft mineral/water tide levels, with substantial area at every value."""
    water = organic_field(seed, 4, 3)
    cuts = np.quantile(water, [.25, .50, .75])
    result = np.full_like(water, levels[0])
    for index, cut in enumerate(cuts):
        result += (levels[index+1]-levels[index])*smooth(water, cut-.015, cut+.015)
    # A narrow tide line gives a water mark a rim instead of a lighting gradient.
    rim = smooth(water, cuts[0]-.023, cuts[0]-.010)-smooth(water, cuts[0]-.008, cuts[0]+.005)
    return result-rim*.025


def card_wear(source_luma, kind, variant):
    """Restrained pigment differences over four water-stained value levels."""
    seed = np.random.default_rng(sum(ord(char) for char in kind)*31 + variant*7919)
    local = blur(source_luma, 13)
    low, high = np.quantile(local, [.12, .88])
    wear = smooth(local, low, high)
    tide = organic_field(seed, 4, 3)
    tide_line = smooth(tide, .50, .53)-smooth(tide, .60, .65)
    runs = organic_field(seed, 4, 5)
    runs_line = smooth(runs, .52, .55)-smooth(runs, .63, .68)
    veins = 1-np.abs(organic_field(seed, 3, 9)*2-1)
    multiplier = .84*water_stains(seed)
    multiplier -= tide_line*.014+runs_line*.01
    multiplier += veins*.008
    multiplier = np.clip(multiplier, .56, .98)
    # Blocked cards keep one pigment/seed at runtime, but still carry water marks.
    pigment = np.ones(3, dtype=np.float32) if kind == 'blocked' else np.array(CARD_PIGMENTS[kind][variant], dtype=np.float32)
    value = resize_data(multiplier[..., None], WEAR_SIZE)[..., :1]
    return np.uint8(np.clip(value*pigment*255+.5, 0, 255))



def card_pattern(ornament, variant):
    """Keep the central seal and outer frame; vary the surrounding painted scrollwork."""
    if variant == 0:
        return ornament
    yy, xx = np.mgrid[0:WORK_SIZE, 0:WORK_SIZE].astype(np.float32)/WORK_SIZE-.5
    radius = np.hypot(xx, yy)
    # The source seal and the common edge ornament stay untouched.
    field_mask = smooth(radius, .255, .29)*(1-smooth(np.maximum(abs(xx), abs(yy)), .39, .425))
    ink = Image.new('L', (WORK_SIZE, WORK_SIZE))
    pen = ImageDraw.Draw(ink)
    def line(points, width=5):
        pen.line([(int((x+.5)*WORK_SIZE), int((y+.5)*WORK_SIZE)) for x,y in points], fill=255, width=width, joint='curve')
    angles = np.linspace(0, np.pi*2, 385)
    if variant == 1:
        # A softly scalloped cloud wreath around the original seal.
        for offset in [0, .014]:
            r = .335+offset+.028*np.cos(angles*8)
            line(list(zip(r*np.cos(angles),r*np.sin(angles))))
    elif variant == 2:
        # An open diamond cartouche, with four small side flourishes.
        for extent in [.41,.435]:
            line([(0,-extent),(extent,0),(0,extent),(-extent,0),(0,-extent)])
        for angle in [0,np.pi/2,np.pi,np.pi*1.5]:
            t=np.linspace(-1,1,75)
            x=.34+.018*np.cos(t*np.pi); y=t*.075
            line(list(zip(x*np.cos(angle)-y*np.sin(angle),x*np.sin(angle)+y*np.cos(angle))))
    else:
        # Paired vine curls at the corners leave a quieter field beside the seal.
        for angle in [np.pi/4,np.pi*3/4,np.pi*5/4,np.pi*7/4]:
            for direction in [-1,1]:
                t=np.linspace(0,np.pi*2.4,140)
                spread=.045*(1-t/(np.pi*2.8))
                x=.395+spread*np.cos(t); y=direction*(.025+spread*np.sin(t))
                line(list(zip(x*np.cos(angle)-y*np.sin(angle),x*np.sin(angle)+y*np.cos(angle))))
    pattern = pixels(ink.filter(ImageFilter.GaussianBlur(.65)))
    return np.clip(ornament*(1-field_mask*.9)+pattern*field_mask,0,1)


def assets():
    for kind, (source, low, high) in card.BACKS.items():
        image = Image.open(ASSETS / source).convert('RGB').resize((WORK_SIZE, WORK_SIZE), Image.Resampling.LANCZOS)
        _, height = card.relief_normal(image, low, high)
        ornament = np.clip(height/.9, 0, 1)
        inlay = smooth(ornament, .06, .65)
        rgb = desaturate(pixels(image.filter(ImageFilter.GaussianBlur(.65))), .55)
        luma = rgb @ np.array([.2126, .7152, .0722])
        for pattern_variant in range(1 if kind == 'blocked' else CARD_PATTERN_VARIANTS):
            pattern = card_pattern(ornament, pattern_variant)
            inlay = smooth(pattern, .06, .65)
            suffix = '' if pattern_variant == 0 else '-variant'+str(pattern_variant)
            # Preserve the attribute paint, ornament and frame beneath the polish.
            rgb = lacquer_back(pattern, luma, kind, pattern_variant)
            # Restore the original matte relief, with mineral tooth and brush
            # unevenness across the ornament and the surrounding stone field.
            rough = np.clip(.80-inlay*.05+(blur(luma, 2)-blur(luma, 8))*.08, .74, .88)
            relief = height if pattern_variant == 0 else pattern*.9
            ao = 1-np.clip((blur(relief, 2)-relief)*.22, 0, .07)
            tooth = (blur(luma, .8)-blur(luma, 3.0))*.45
            brush = (blur(luma, 6)-blur(luma, 46))*1.25
            card_height = pattern*.55+tooth+brush
            yield 'card-'+kind+suffix+'-color.webp', encode(resize_data(rgb)), source, SIZE
            yield 'card-'+kind+suffix+'-normal.png', normal(blur(card_height, 1.2), 11.0), source, SIZE
            yield 'card-'+kind+suffix+'-surface.png', encode(resize_data(np.stack([ao, rough, np.zeros_like(rough)], axis=-1))), source, SIZE
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
        # Keep the pale stain bands below a chalky white haze.
        water = water_stains(np.random.default_rng(ord(kind)*8191+43), (.76, .91, 1.00, 1.08))
        stone_colour = board_colour(rgb, 'floor')*water[..., None]
        # Compress only the upper stain values, preserving the charcoal shadows.
        pale = smooth(stone_colour @ np.array([.2126, .7152, .0722]), .18, .29)
        stone_colour *= (1-pale*.18)[..., None]
        yield 'floor-'+kind+'-color.webp', encode(resize_data(stone_colour)), source, SIZE
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
    # Keep pigment shifts subtle while preserving four water-stain value bands.
    for kind in BACK_TONE_KINDS:
        chroma = []
        for variant in range(CARD_WEAR_VARIANTS):
            paint = pixels(Image.open(OUTPUT / f'card-{kind}-wear{variant}.png'))
            channels = paint.mean(axis=(0, 1))
            chroma.append(channels/channels.max())
            value = paint[..., 0]/CARD_PIGMENTS[kind][variant][0]
            bands, _ = np.histogram(value, bins=[0, .675, .805, .915, 1.2])
            assert np.all(bands > value.size*.08), f'Missing water-stain value level: {kind}/{variant}'
        distances = [float(np.linalg.norm(chroma[a]-chroma[b])) for a,b in ((0,1),(1,2),(0,2))]
        assert min(distances) > .018 and max(distances) < .18, f'Pigment differences outside restrained range: {kind}'
    manifest = {'size': SIZE, 'files': records, 'totalBytes': sum(item['bytes'] for item in records.values())}
    if args.check:
        assert json.loads(MANIFEST.read_text(encoding='utf-8')) == manifest, 'Runtime manifest is stale; run prepare-board-runtime.py'
    else:
        MANIFEST.write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
    print(str(len(records))+' runtime board textures '+('verified' if args.check else 'prepared')+'; '+str(manifest['totalBytes'])+' bytes')


if __name__ == '__main__':
    main()
