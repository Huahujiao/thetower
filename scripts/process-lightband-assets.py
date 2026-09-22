from __future__ import annotations

import base64
import io
import re
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_HTML = ROOT / "ref" / "lightband.html"
RUNTIME_DIR = ROOT / "src" / "assets" / "ui"
BACKUP_DIR = RUNTIME_DIR / "backup" / "source"
NAMES = ("lightband-back", "lightband-mid", "lightband-front")
RUNTIME_WIDTH = 256
ALPHA_CROP_THRESHOLD = 4
SOURCE_PADDING = 8


def alpha_content_box(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value >= ALPHA_CROP_THRESHOLD else 0)
    box = mask.getbbox()
    if box is None:
        return (0, 0, image.width, image.height)
    return (
        0,
        max(0, box[1] - SOURCE_PADDING),
        image.width,
        min(image.height, box[3] + SOURCE_PADDING),
    )


def main() -> None:
    html = SOURCE_HTML.read_text(encoding="utf-8")
    payloads = re.findall(r"data:image/[^;]*;base64,([A-Za-z0-9+/=]+)", html)
    if len(payloads) != len(NAMES):
        raise RuntimeError(f"Expected {len(NAMES)} embedded images, found {len(payloads)}")

    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    for name, payload in zip(NAMES, payloads, strict=True):
        source_bytes = base64.b64decode(payload)
        source = Image.open(io.BytesIO(source_bytes)).convert("RGBA")
        source_path = BACKUP_DIR / f"{name}-source.png"
        source.save(source_path, format="PNG", optimize=True, compress_level=9)

        cropped = source.crop(alpha_content_box(source))
        runtime_height = max(1, round(cropped.height * RUNTIME_WIDTH / cropped.width))
        runtime = cropped.resize((RUNTIME_WIDTH, runtime_height), Image.Resampling.LANCZOS)
        runtime_path = RUNTIME_DIR / f"{name}.png"
        runtime.save(runtime_path, format="PNG", optimize=True, compress_level=9)
        print(f"{name}: {source.size} -> {cropped.size} -> {runtime.size}; {runtime_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
