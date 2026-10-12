"""Generate separate enemy texture styles; never overwrite original artwork.

Requires Pillow. Run: python scripts/generate-enemy-texture-styles.py
Add named presets in enemy-texture-style-presets.json for further experiments.
The generated registry automatically supplies the preview style dropdown.
"""

import argparse
import hashlib
import json
import re
from pathlib import Path

from PIL import Image, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]
PIPELINE_VERSION = 1


def transform(image: Image.Image, preset: dict) -> Image.Image:
    """Adjust RGB only, retaining every original alpha value and pixel position."""
    rgba = image.convert("RGBA")
    rgb = ImageEnhance.Color(rgba.convert("RGB")).enhance(preset["saturation"])
    gamma = preset["gamma"]
    if gamma != 1:
        rgb = rgb.point([round(255 * (value / 255) ** gamma) for value in range(256)] * 3)
    if preset["white_mix"]:
        rgb = Image.blend(rgb, Image.new("RGB", rgb.size, tuple(preset["white_color"])), preset["white_mix"])
    rgb.putalpha(rgba.getchannel("A"))
    return rgb


def validate_presets(presets: list[dict]) -> None:
    seen = set()
    for preset in presets:
        style_id = preset["id"]
        if not re.fullmatch(r"[a-z][a-z0-9-]*", style_id) or style_id == "original" or style_id in seen:
            raise ValueError(f"Invalid or duplicate style id: {style_id}")
        seen.add(style_id)
        if not 0 <= preset["saturation"] <= 1 or not 0 < preset["gamma"] <= 3 or not 0 <= preset["white_mix"] <= 1:
            raise ValueError(f"Invalid color parameters: {style_id}")
        if len(preset["white_color"]) != 3 or any(not isinstance(v, int) or not 0 <= v <= 255 for v in preset["white_color"]):
            raise ValueError(f"Invalid white color: {style_id}")


def generate(source_root: Path, output_root: Path, manifest: Path, presets: list[dict]) -> dict:
    source_root, output_root = source_root.resolve(), output_root.resolve()
    if source_root == output_root or output_root in source_root.parents:
        raise ValueError("Output must be a separate directory, never the source or its ancestor")
    validate_presets(presets)
    # Exclude all generated styles, even if the output is nested under sources.
    sources = sorted(p for p in source_root.rglob("*.png")
                     if not p.is_relative_to(source_root / "styles") and not p.is_relative_to(output_root))
    if not sources:
        raise ValueError(f"No original PNG textures found in {source_root}")
    if manifest.resolve() in {path.resolve() for path in sources}:
        raise ValueError("Registry must not overwrite an original texture")
    digest = hashlib.sha256()
    for path in sources:
        digest.update(path.relative_to(source_root).as_posix().encode("utf-8"))
        digest.update(hashlib.sha256(path.read_bytes()).digest())
    source_digest = digest.hexdigest()
    registry = {"pipelineVersion": PIPELINE_VERSION, "sourceDigest": source_digest,
                "sources": ["/assets/enemies/" + p.relative_to(source_root).as_posix() for p in sources], "styles": []}
    for preset in presets:
        style_id = preset["id"]
        revision = hashlib.sha256((source_digest + str(PIPELINE_VERSION) + json.dumps(preset, sort_keys=True)).encode("utf-8")).hexdigest()[:12]
        for path in sources:
            target = output_root / style_id / path.relative_to(source_root)
            if target.resolve() == path.resolve():
                raise ValueError("Refusing to overwrite an original texture")
            target.parent.mkdir(parents=True, exist_ok=True)
            with Image.open(path) as image:
                transform(image, preset).save(target, format="PNG", compress_level=6)
        registry["styles"].append({"id": style_id, "label": preset["label"], "revision": revision,
                                   "root": f"/assets/enemies/styles/{style_id}/"})
        print(f"{style_id}: generated {len(sources)} textures in {output_root / style_id}", flush=True)
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(json.dumps(registry, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
    print(f"Registry: {manifest}", flush=True)
    return registry


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=ROOT / "scripts/enemy-texture-style-presets.json")
    parser.add_argument("--source-root", type=Path, default=ROOT / "public/assets/enemies")
    parser.add_argument("--output-root", type=Path, default=ROOT / "public/assets/enemies/styles")
    parser.add_argument("--manifest", type=Path, default=ROOT / "src/animation/enemy-texture-styles.generated.json")
    args = parser.parse_args()
    presets = json.loads(args.config.read_text(encoding="utf-8"))["styles"]
    generate(args.source_root, args.output_root, args.manifest, presets)


if __name__ == "__main__":
    main()
