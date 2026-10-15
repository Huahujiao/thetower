"""Export four generated metre-scale dark slate slabs; retain every source/version."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
for letter in 'abcd':
    source = ROOT / 'art/generated' / f'temple-floor-{letter}-v4.png'
    tile = Image.open(source).convert('RGB').resize((512, 512), Image.Resampling.LANCZOS)
    tile.save(ROOT / 'src/assets' / f'board-floor-temple-{letter}-v4.jpg', quality=94)
print('Four dark weathered slabs exported; originals and earlier versions retained.')
