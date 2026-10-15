"""Export the new rock-only parallax asset; retain all previous versions."""
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
image = Image.open(ROOT / 'art/generated/temple-parallax-peaks-v2.png').convert('RGBA')
image.thumbnail((1024,1536),Image.Resampling.LANCZOS)
image.save(ROOT / 'src/assets/environment/temple-parallax-peaks-v2.webp',quality=92,method=6,exact=True)
print(image.size, 'alpha', image.getchannel('A').getextrema())
