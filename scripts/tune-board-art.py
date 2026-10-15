"""Reproducible, non-destructive grade of the existing board artwork."""
from pathlib import Path
from shutil import copy2
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'src/assets'
BACKUP = ROOT / 'art/backup/board-before-temple-grade'
BACKUP.mkdir(parents=True, exist_ok=True)

# Keep the original illustration and its emblem. Only grade and light its relief.
GRADES = {'scorch': (0.46, 0.95), 'wither': (0.50, 0.94), 'drown': (0.42, 1.00), 'neutral': (0.62, 1.20)}
for attribute, (saturation, brightness) in GRADES.items():
    name = 'board-card-back' + ('' if attribute == 'neutral' else '-' + attribute) + '-v1.jpg'
    source = ASSETS / name
    if not (BACKUP / name).exists():
        copy2(source, BACKUP / name)
    image = Image.open(source).convert('RGB')
    image = ImageEnhance.Color(image).enhance(saturation)
    image = ImageEnhance.Brightness(image).enhance(brightness)
    rgb = np.asarray(image).astype(np.float32)
    # A narrow opposing highlight/shadow gives the already-painted carving depth.
    height = np.asarray(image.convert('L').filter(ImageFilter.GaussianBlur(0.65))).astype(np.float32)
    relief = np.zeros_like(height)
    relief[1:, 1:] = (height[1:, 1:] - height[:-1, :-1]) * 0.48
    rgb = np.clip(rgb + relief[:, :, None], 0, 255).astype(np.uint8)
    target = name.replace('-v1.jpg', '-temple-v2.jpg')
    Image.fromarray(rgb).save(ASSETS / target, quality=95)
    print(target)
