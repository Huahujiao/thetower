"""Export new independent parallax layers, preserving source alpha and all old art."""
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
for name in ('peaks', 'clouds'):
    stem = f'temple-parallax-{name}-v1'
    source = ROOT / 'art/generated' / f'{stem}.png'
    target = ROOT / 'src/assets/environment' / f'{stem}.webp'
    image = Image.open(source).convert('RGBA')
    image.thumbnail((1024, 1536) if name == 'peaks' else (1536, 1024), Image.Resampling.LANCZOS)
    image.save(target, quality=92, method=6, exact=True)
    print(stem, image.size, 'alpha', image.getchannel('A').getextrema())
