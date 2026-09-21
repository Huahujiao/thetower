"""Generate small and medium transparent inventory sprite variants.

Production source PNGs live in ``inventory/backup/source`` so the runtime
directory contains only the two shipped resolutions. The HUD loads ``-small``
first, then ``-medium``. Requires Pillow: ``python -m pip install pillow``.
"""

from pathlib import Path
import argparse

from PIL import Image


DEFAULT_ROOT = Path(__file__).resolve().parents[1] / "src" / "assets" / "inventory"
VARIANTS = (("small", 256), ("medium", 512))


def resize_to_max(image: Image.Image, max_edge: int) -> Image.Image:
    width, height = image.size
    scale = min(1.0, max_edge / max(width, height))
    size = (max(1, round(width * scale)), max(1, round(height * scale)))
    if size == image.size:
        return image.copy()
    return image.resize(size, Image.Resampling.LANCZOS)


def generate(root: Path) -> int:
    source_roots = [root / "backup" / "source", root]
    sources = sorted(
        path
        for source_root in source_roots
        for path in source_root.glob("*-v*.png")
        if "-small" not in path.stem and "-medium" not in path.stem
    )
    if not sources:
        raise SystemExit(f"No high-resolution sprites found in {root}")

    generated = 0
    for source in sources:
        with Image.open(source) as opened:
            image = opened.convert("RGBA")
            for suffix, max_edge in VARIANTS:
                target = root / f"{source.stem}-{suffix}.png"
                resized = resize_to_max(image, max_edge)
                resized.save(target, format="PNG", optimize=True)
                generated += 1
                print(f"{target.name}: {image.size[0]}x{image.size[1]} -> {resized.size[0]}x{resized.size[1]}")
    return generated


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT, help="inventory sprite directory")
    args = parser.parse_args()
    count = generate(args.root)
    print(f"Generated {count} sprite variants in {args.root}")


if __name__ == "__main__":
    main()
