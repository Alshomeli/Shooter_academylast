#!/usr/bin/env python3
"""Build *review-only* optimized copies of the public homepage images.

Never overwrites originals or changes page references. Run from a Git checkout:
  python -m pip install Pillow
  python scripts/optimize_home_images.py

Outputs are generated under .image-optimization-review/, not public/.
"""
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / ".image-optimization-review"
SOURCES = [
    ("shooter-logo-transparent.png", 320, 92, True),
    ("festival-team.jpg", 960, 82, False),
    ("1000391344.jpg", 1280, 82, False),
]

def locate(name):
    matches = sorted((ROOT / "public").rglob(name))
    if len(matches) != 1:
        raise RuntimeError(f"Expected exactly one public asset named {name}; found {len(matches)}: {matches}")
    return matches[0]

def optimize(name, max_width, quality, transparent):
    src = locate(name)
    destination = OUT / src.relative_to(ROOT / "public").with_suffix(".webp")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as original:
        img = ImageOps.exif_transpose(original)
        img = img.convert("RGBA" if transparent else "RGB")
        if img.width > max_width:
            img.thumbnail((max_width, max(1, img.height)), Image.Resampling.LANCZOS)
        dimensions = img.size
        img.save(destination, "WEBP", quality=quality, method=6, exact=transparent)
    with Image.open(destination) as check:
        check.verify()
    with Image.open(destination) as check:
        if transparent and check.mode != "RGBA":
            raise RuntimeError(f"Transparency was not preserved: {name}")
    before, after = src.stat().st_size, destination.stat().st_size
    if after >= before:
        destination.unlink()
        raise RuntimeError(f"Optimized image was not smaller: {name} ({before} -> {after})")
    return {
        "source": str(src.relative_to(ROOT)),
        "output": str(destination.relative_to(ROOT)),
        "original_bytes": before,
        "optimized_bytes": after,
        "saving_percent": round((1 - after / before) * 100, 1),
        "output_dimensions": dimensions,
    }

def main():
    OUT.mkdir(exist_ok=True)
    report = []
    for args in SOURCES:
        result = optimize(*args)
        report.append(result)
        print(f"{result['source']}: {result['original_bytes']:,} -> {result['optimized_bytes']:,} bytes; saved {result['saving_percent']}%")
    (OUT / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

if __name__ == "__main__":
    main()
