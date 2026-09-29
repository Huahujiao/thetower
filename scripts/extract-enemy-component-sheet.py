"""Extract individually painted components by alpha connectivity.

The source is a sheet of independent parts, not a character portrait. A
connected component may cross a grid boundary; its pixels stay together.
"""

from pathlib import Path
import sys

import cv2
import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "src/assets/enemies/backup/sheets"
OUTPUT = ROOT / "public/assets/enemies/parts"
ROLES = {
    "gnawer": (
        "head", "torso", "eye",
        "upper-arm", "forearm", "hand",
        "thigh", "shin", "foot",
    ),
    "emberwing-moth": (
        "head", "thorax", "eye",
        "abdomen", "wing", "antenna",
        "wing-eye", "tail-glow", "leg",
    ),
    "rootrot-bud": (
        "bud", "bulb", "eye",
        "stem", "petal", "thorn",
        "root", "root-tip", "leaf",
    ),
}


def extract(enemy_id):
    source = SHEETS / f"{enemy_id}-components-v1.png"
    pixels = np.array(Image.open(source).convert("RGBA"))
    alpha = pixels[:, :, 3]
    count, labels, stats, centers = cv2.connectedComponentsWithStats((alpha > 12).astype("uint8"), 8)
    substantial = [index for index in range(1, count) if stats[index, cv2.CC_STAT_AREA] > 500]
    if len(substantial) != 9:
        raise ValueError(f"Expected 9 isolated components in {source}, got {len(substantial)}")
    ordered = sorted(substantial, key=lambda index: (round(centers[index, 1] / (pixels.shape[0] / 3)), centers[index, 0]))
    # Verify exactly one painted component has its center in each grid location.
    cells = {}
    for index in ordered:
        col = min(2, int(centers[index, 0] * 3 / pixels.shape[1]))
        row = min(2, int(centers[index, 1] * 3 / pixels.shape[0]))
        if (row, col) in cells:
            raise ValueError(f"Two components occupy cell {(row, col)}")
        cells[row, col] = index
    if len(cells) != 9:
        raise ValueError(f"Incomplete 3x3 component sheet: {cells.keys()}")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for row in range(3):
        for col in range(3):
            index = cells[row, col]
            x, y, width, height, _ = stats[index]
            # Expand the connected mask two pixels to retain antialiasing.
            region = pixels[y:y + height, x:x + width].copy()
            mask = (labels[y:y + height, x:x + width] == index).astype("uint8")
            mask = cv2.dilate(mask, np.ones((3, 3), "uint8"), iterations=1)
            region[:, :, 3] = np.where(mask > 0, region[:, :, 3], 0)
            role = ROLES[enemy_id][row * 3 + col]
            Image.fromarray(region).save(OUTPUT / f"{enemy_id}-{role}.png", optimize=True)
    print(f"Extracted 9 isolated anatomical textures for {enemy_id}")


if __name__ == "__main__":
    extract(sys.argv[1])
