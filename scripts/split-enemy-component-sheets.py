"""Cut the three shadow-puppet component sheets into small runtime sprites.

The original generated sheets remain in src/assets/enemies/backup/sheets.
Run from the repository root: python scripts/split-enemy-component-sheets.py
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "src/assets/enemies/backup/sheets"
OUTPUT = ROOT / "public/assets/enemies"
MAX_EDGE = 128

# name: (sheet, column, row, columns, rows, part width, part height)
PARTS = {
    "bell-pilgrim-mouth-v1": ("bell-pilgrim-components-v1.png", 0, 0, 3, 2, 36, 33),
    "bell-pilgrim-eye-v1": ("bell-pilgrim-components-v1.png", 1, 0, 3, 2, 22, 22),
    "bell-pilgrim-arm-v1": ("bell-pilgrim-components-v1.png", 2, 0, 3, 2, 82, 18),
    "bell-pilgrim-claw-v1": ("bell-pilgrim-components-v1.png", 0, 1, 3, 2, 42, 61),
    "tide-spider-body-v1": ("tide-spider-components-v1.png", 0, 0, 3, 1, 118, 88),
    "tide-spider-abdomen-mark-v1": ("tide-spider-components-v1.png", 1, 0, 3, 1, 53, 58),
    "tide-spider-eye-v1": ("tide-spider-components-v1.png", 2, 0, 3, 1, 18, 18),
    "lantern-moth-eye-v1": ("lantern-moth-components-v1.png", 0, 0, 2, 2, 31, 39),
    "lantern-moth-wing-eye-v1": ("lantern-moth-components-v1.png", 1, 0, 2, 2, 39, 39),
    "lantern-moth-tail-glow-v1": ("lantern-moth-components-v1.png", 0, 1, 2, 2, 40, 57),
    "lantern-moth-antenna-v1": ("lantern-moth-components-v1.png", 1, 1, 2, 2, 34, 8),
}


def trim(image: Image.Image) -> Image.Image:
    visible = image.getchannel("A").point(lambda alpha: 255 if alpha >= 8 else 0)
    bounds = visible.getbbox()
    if not bounds:
        raise ValueError("Sprite cell contains no visible pixels")
    return image.crop(bounds)


def save_small(name: str, image: Image.Image, width: int, height: int) -> None:
    image = trim(image)
    scale = MAX_EDGE / max(width, height)
    target = (max(1, round(width * scale)), max(1, round(height * scale)))
    image = image.resize(target, Image.Resampling.LANCZOS)
    destination = OUTPUT / f"{name}-small.png"
    image.save(destination, optimize=True)
    print(f"{destination.name}: {target[0]}x{target[1]}")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    opened = {}
    for name, (sheet_name, col, row, cols, rows, width, height) in PARTS.items():
        if sheet_name not in opened:
            opened[sheet_name] = Image.open(SHEETS / sheet_name).convert("RGBA")
        sheet = opened[sheet_name]
        cell_width, cell_height = sheet.width // cols, sheet.height // rows
        cell = sheet.crop((col * cell_width, row * cell_height,
                           (col + 1) * cell_width, (row + 1) * cell_height))
        save_small(name, cell, width, height)

    # The generated bell cell contains the whole bell. Keep only its dark
    # lower opening, which is a separate puppet overlay in the rig.
    bell = opened["bell-pilgrim-components-v1.png"]
    save_small("bell-pilgrim-bell-mouth-v1", bell.crop((535, 727, 780, 974)), 35, 20)

    # This leg was generated vertically to avoid the model mistaking it for
    # another arm. Rotate the knee to the left and the foot to the right.
    with Image.open(SHEETS / "bell-pilgrim-leg-v1.png") as source:
        leg = source.convert("RGBA").transpose(Image.Transpose.ROTATE_90)
    save_small("bell-pilgrim-leg-v1", leg, 120, 24)


if __name__ == "__main__":
    main()
