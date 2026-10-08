"""Extract the final enemy sheets by alpha islands, preserving painted pixels."""
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BATCH = ROOT / 'art/generated/enemy-completion-2026-10-08'
ASSETS = ROOT / 'src/animation/enemy-component-assets.json'
IDS = ['patrol-hound', 'redneedle-salamander', 'rot-sac-toad', 'claw-beast',
       'broodmother', 'molten-core-beast', 'redwheel-fire-crow', 'overseer']


def save_part(enemy_id, number, pixels, mask, metadata):
    ys, xs = np.nonzero(mask)
    if not len(xs):
        raise ValueError(f'{enemy_id} {number}: empty component')
    left, right = max(0, xs.min()-2), min(pixels.shape[1], xs.max()+3)
    top, bottom = max(0, ys.min()-2), min(pixels.shape[0], ys.max()+3)
    image = pixels[top:bottom, left:right].copy()
    # Retain antialiased edges without including neighboring components.
    expanded = cv2.dilate(mask.astype('uint8'), np.ones((3, 3), 'uint8'))
    image[:, :, 3] = np.where(expanded[top:bottom, left:right], image[:, :, 3], 0)
    destination = ROOT / f'public/assets/enemies/components-v1/{enemy_id}/part_{number:03}.png'
    destination.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(image).save(destination, optimize=True)
    metadata['parts'][str(number)] = dict(width=int(right-left), height=int(bottom-top),
                                         sha256=hashlib.sha256(destination.read_bytes()).hexdigest())


def main():
    assets = json.loads(ASSETS.read_text(encoding='utf-8'))
    for enemy_id in IDS + ['tide-rite-matriarch']:
        source = BATCH / f'sheets/{enemy_id}.png'
        pixels = np.array(Image.open(source).convert('RGBA'))
        _, labels, stats, centers = cv2.connectedComponentsWithStats((pixels[:, :, 3] > 20).astype('uint8'), 8)
        metadata = dict(source=str(source.relative_to(ROOT)).replace('\\', '/'), parts={})
        if enemy_id in IDS:
            islands = [i for i in range(1, len(stats)) if stats[i, cv2.CC_STAT_AREA] > 500]
            if len(islands) != 16:
                raise ValueError(f'{enemy_id}: expected 16 islands, got {len(islands)}')
            slots = {}
            for i in islands:
                col = min(3, int(centers[i, 0] * 4 / pixels.shape[1]))
                row = min(3, int(centers[i, 1] * 4 / pixels.shape[0]))
                number = row * 4 + col + 1
                if number in slots:
                    raise ValueError(f'{enemy_id}: two parts in cell {number}')
                slots[number] = i
            for number, i in sorted(slots.items()):
                save_part(enemy_id, number, pixels, labels == i, metadata)
        else:
            # Reuse the original matriarch sheet. The chest touches its skirt;
            # separate at the belt. Other parts are complete alpha islands.
            regions = [
                (1, (713, 185), None), (2, (713, 261), None),
                (3, (692, 618), (550, 285, 820, 572)),
                (4, (692, 618), (550, 566, 820, 1024)),
                (5, (488, 166), None), (6, (864, 210), None),
                (7, (159, 238), None), (8, (1110, 220), None),
                (9, (435, 481), None), (10, (925, 482), None),
                (11, (241, 708), None), (12, (1193, 717), None),
                (13, (1435, 420), None), (14, (542, 809), None),
                (15, (843, 809), None),
            ]
            for number, center, region in regions:
                i = min((i for i in range(1, len(stats)) if stats[i, cv2.CC_STAT_AREA] > 500),
                        key=lambda i: np.linalg.norm(centers[i] - center))
                mask = labels == i
                if region:
                    left, top, right, bottom = region
                    clip = np.zeros_like(mask); clip[top:bottom, left:right] = True
                    mask &= clip
                save_part(enemy_id, number, pixels, mask, metadata)
        assets[enemy_id] = metadata
        print(f'{enemy_id}: {len(metadata["parts"])} parts')
    ASSETS.write_text(json.dumps(assets, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


if __name__ == '__main__':
    main()
