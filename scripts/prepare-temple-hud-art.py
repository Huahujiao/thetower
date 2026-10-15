"""Export a small transparent HUD badge while preserving its generated source."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
source = Image.open(ROOT / 'art/generated/hud-armor-shield-v1.png').convert('RGBA')
source.resize((256, 256), Image.Resampling.LANCZOS).save(ROOT / 'src/assets/ui/armor-shield-temple-v1.png', optimize=True)
print('Transparent armor badge exported; source retained.')
