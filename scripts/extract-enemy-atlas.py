"""Extract isolated enemy sprites from the four generated transparent sheets.

Run with Pillow, NumPy and SciPy installed. The alpha components, rather than
rectangular grid cells, define the sprite boundaries. This prevents a limb or
head from a neighboring creature appearing in another enemy's texture.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
ATLAS_DIR = ROOT / "public" / "assets" / "enemies" / "atlases"
OUTPUT_DIR = ROOT / "public" / "assets" / "enemies" / "characters"
MANIFEST = ROOT / "src" / "animation" / "enemy-sprite-manifest.json"
MIN_ALPHA = 24
PADDING = 3

BATCHES = [
    ["gnawer", "emberwing-moth", "rootrot-bud", "tide-shadow-cub", "nest-spider", "beetle-guard", "rot-walker", "shellguard", "wisp"],
    ["patrol-hound", "redneedle-salamander", "rot-sac-toad", "claw-beast", "broodmother", "moss-colossus", "sentry-crossbow", "ash-cannon-bug", "furnace-beetle"],
    ["thorn-shell-flower", "water-leech-swarm", "whirlpool-eye-sac", "molten-core-beast", "redwheel-fire-crow", "cinder-curse-lamp-swarm", "tide-rite-matriarch", "drown-shadow-hunter", "tidal-spore-sac"],
    ["revenant-guard", "bomb-wisp", "cracked-hunter", "broodling", "leech-larva", "tide-shadow"],
]


def extract_batch(batch_number: int, enemy_ids: list[str]) -> dict[str, dict]:
    source = ATLAS_DIR / f"enemy-batch-{batch_number}.png"
    pixels = np.asarray(Image.open(source).convert("RGBA"))
    alpha = pixels[:, :, 3]
    labels, count = ndimage.label(alpha >= MIN_ALPHA, np.ones((3, 3), dtype=np.uint8))
    areas = np.bincount(labels.ravel())
    ranked = np.argsort(areas[1:])[::-1] + 1
    selected = ranked[: len(enemy_ids)]
    if count < len(enemy_ids) or np.min(areas[selected]) < 10_000:
        raise ValueError(f"{source}: expected {len(enemy_ids)} separate enemies")
    if len(ranked) > len(enemy_ids) and areas[ranked[len(enemy_ids)]] >= 10_000:
        raise ValueError(f"{source}: found an unexpected large sprite component")

    centers = ndimage.center_of_mass(alpha >= MIN_ALPHA, labels, selected)
    ordered = sorted(zip(selected, centers), key=lambda pair: pair[1][0])
    ordered = [pair for row in range(len(enemy_ids) // 3) for pair in sorted(ordered[row * 3:(row + 1) * 3], key=lambda pair: pair[1][1])]
    manifest = {}
    for enemy_id, (label, _) in zip(enemy_ids, ordered):
        mask = labels == label
        ys, xs = np.where(mask)
        left = max(0, int(xs.min()) - PADDING)
        top = max(0, int(ys.min()) - PADDING)
        right = min(alpha.shape[1], int(xs.max()) + PADDING + 1)
        bottom = min(alpha.shape[0], int(ys.max()) + PADDING + 1)
        region = pixels[top:bottom, left:right].copy()
        main = mask[top:bottom, left:right]
        edge = ndimage.binary_dilation(main, iterations=2) & (region[:, :, 3] < MIN_ALPHA)
        region[:, :, 3] = np.where(main | edge, region[:, :, 3], 0)
        destination = OUTPUT_DIR / f"{enemy_id}.png"
        Image.fromarray(region).save(destination, optimize=True)
        manifest[enemy_id] = {
            "url": f"/assets/enemies/characters/{enemy_id}.png",
            "width": right - left,
            "height": bottom - top,
            "batch": batch_number,
        }
        print(f"{enemy_id}: {right - left}x{bottom - top} ({int(areas[label])} opaque pixels)")
    return manifest


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for batch_number, enemy_ids in enumerate(BATCHES, start=1):
        manifest.update(extract_batch(batch_number, enemy_ids))
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
