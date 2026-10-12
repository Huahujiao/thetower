"""Verify source preservation, alpha integrity and generated style coverage."""

import hashlib
import json
from pathlib import Path
import runpy
import tempfile

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
pipeline = runpy.run_path(str(ROOT / "scripts/generate-enemy-texture-styles.py"))
presets = json.loads((ROOT / "scripts/enemy-texture-style-presets.json").read_text(encoding="utf-8"))["styles"]
with tempfile.TemporaryDirectory(prefix="flip-texture-style-") as folder:
    base = Path(folder)
    source = base / "source/test.png"
    source.parent.mkdir()
    sample = Image.new("RGBA", (5, 1))
    sample.putdata([(40, 120, 200, 0), (40, 120, 200, 128), (40, 120, 200, 255), (0, 0, 0, 255), (255, 255, 255, 255)])
    sample.save(source)
    original_bytes = source.read_bytes()
    pipeline["generate"](source.parent, base / "styles", base / "registry.json", presets)
    assert source.read_bytes() == original_bytes, "Generator overwrote source bytes"
    with Image.open(base / "styles" / presets[0]["id"] / "test.png") as styled:
        assert styled.size == sample.size
        assert ImageChops.difference(styled.getchannel("A"), sample.getchannel("A")).getbbox() is None
        rgb = styled.getpixel((2, 0))[:3]
        original_rgb = sample.getpixel((2, 0))[:3]
        original_chroma = max(original_rgb) - min(original_rgb)
        assert original_chroma * .35 < max(rgb) - min(rgb) < original_chroma * .8, "Pale preset must soften colors while retaining visible color rather than turning gray"
        brightness_change = sum((a - b) * weight for a, b, weight in zip(rgb, original_rgb, (.299, .587, .114)))
        assert abs(brightness_change) < 1.5, "Low saturation preset must retain original brightness without a white or black wash"
        for pixel in (3, 4):
            assert styled.getpixel((pixel, 0)) == sample.getpixel((pixel, 0)), "Low saturation must preserve neutral black and white"
    try:
        pipeline["generate"](source.parent, source.parent, base / "registry.json", presets)
        raise AssertionError("Generator accepted the original directory as output")
    except ValueError:
        pass

registry = json.loads((ROOT / "src/animation/enemy-texture-styles.generated.json").read_text(encoding="utf-8"))
digest = hashlib.sha256()
count = 0
for url in registry["sources"]:
    relative = url.removeprefix("/assets/enemies/")
    path = ROOT / "public/assets/enemies" / relative
    digest.update(relative.encode("utf-8"))
    digest.update(hashlib.sha256(path.read_bytes()).digest())
    with Image.open(path) as image:
        rgba = image.convert("RGBA")
        for style in registry["styles"]:
            target = ROOT / "public" / style["root"].lstrip("/") / relative
            with Image.open(target) as generated:
                assert generated.size == rgba.size, f"Size changed: {target}"
                assert ImageChops.difference(generated.getchannel("A"), rgba.getchannel("A")).getbbox() is None, f"Alpha changed: {target}"
            count += 1
assert digest.hexdigest() == registry["sourceDigest"], "Original texture bytes changed since generation; regenerate the styles"
print(f"Enemy texture styles: {count} outputs, original checksums, dimensions and alpha preservation passed.")
