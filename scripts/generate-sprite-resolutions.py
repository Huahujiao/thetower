"""Generate small and medium transparent inventory sprite variants.

Production source PNGs live in ``inventory/backup/source`` so the runtime
directory contains only the two shipped resolutions. The HUD loads ``-small``
first, then ``-medium``. Requires Pillow: ``python -m pip install pillow``.
"""

from pathlib import Path
import argparse
import shutil

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


def trim_transparent_edges(image: Image.Image, alpha_threshold: int) -> Image.Image:
    alpha = image.getchannel("A")
    bounds = alpha.point(lambda value: 255 if value >= alpha_threshold else 0).getbbox()
    return image.crop(bounds) if bounds else image.copy()


def generate(root: Path, names: set[str], trim_transparent: bool, backup_original: bool, alpha_threshold: int, from_uncropped: bool, source_root: Path | None = None, variants: tuple[tuple[str, int], ...] = VARIANTS) -> int:
    source_roots = [source_root] if source_root else [root / "backup" / "source", root]
    sources = sorted(
        path
        for source_root in source_roots
        for path in source_root.glob("*-v*.png")
        if "-small" not in path.stem and "-medium" not in path.stem
        if not names or path.stem in names
    )
    if not sources:
        raise SystemExit(f"No high-resolution sprites found in {root}")

    generated = 0
    for source in sources:
        uncropped = source.parent / "uncropped" / source.name
        input_source = uncropped if from_uncropped and uncropped.exists() else source
        with Image.open(input_source) as opened:
            image = opened.convert("RGBA")
            if trim_transparent:
                if backup_original:
                    original = source.parent / "uncropped" / source.name
                    original.parent.mkdir(parents=True, exist_ok=True)
                    if not original.exists(): shutil.copy2(source, original)
                image = trim_transparent_edges(image, alpha_threshold)
                image.save(source, format="PNG", optimize=True)
            for suffix, max_edge in variants:
                target = root / f"{source.stem}-{suffix}.png"
                resized = resize_to_max(image, max_edge)
                resized.save(target, format="PNG", optimize=True)
                generated += 1
                print(f"{target.name}: {image.size[0]}x{image.size[1]} -> {resized.size[0]}x{resized.size[1]}")
    return generated


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT, help="inventory sprite directory")
    parser.add_argument("--source-root", type=Path, help="optional source directory outside the runtime output tree")
    parser.add_argument("--small-edge", type=int, default=256, help="maximum edge of the small variant")
    parser.add_argument("--small-only", action="store_true", help="generate only the small variant")
    parser.add_argument("--only", action="append", default=[], help="source sprite stem to process; repeatable")
    parser.add_argument("--trim-transparent", action="store_true", help="crop fully transparent outer edges before making variants")
    parser.add_argument("--backup-original", action="store_true", help="copy an uncropped source into backup/source/uncropped first")
    parser.add_argument("--alpha-threshold", type=int, default=1, help="alpha value treated as visible while trimming (1-255)")
    parser.add_argument("--from-uncropped", action="store_true", help="rebuild a cropped source from backup/source/uncropped when available")
    args = parser.parse_args()
    variants = (("small", max(16, args.small_edge)),) if args.small_only else (("small", max(16, args.small_edge)), VARIANTS[1])
    count = generate(args.root, set(args.only), args.trim_transparent, args.backup_original, max(1, min(255, args.alpha_threshold)), args.from_uncropped, args.source_root, variants)
    print(f"Generated {count} sprite variants in {args.root}")


if __name__ == "__main__":
    main()
