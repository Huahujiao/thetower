"""Export the generated stone originals; existing artwork remains unchanged."""
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
for name in ('temple-dressed-stone-v1', 'temple-foundation-masonry-v1'):
    source = ROOT / 'art/generated' / f'{name}.png'
    target = ROOT / 'src/assets/environment' / f'{name}.jpg'
    image = Image.open(source).convert('RGB')
    image = image.resize((1024, 1024), Image.Resampling.LANCZOS)
    image.save(target, quality=94, subsampling=0, optimize=True)
    print(target.relative_to(ROOT))
