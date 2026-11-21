#!/usr/bin/env python3
"""Generate reviewable WebP copies of Shooter Academy's static images.

Run locally: python -m pip install Pillow
             python scripts/optimize_home_images.py
Original assets are never overwritten. Deployment code is NOT modified.
"""
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    ("public/shooter-logo-transparent.png", 320, 92, True),
    ("public/festival-team.jpg", 960, 82, False),
    ("public/images/1000391344.jpg", 1280, 82, False),
]

def optimize(relative_path: str, maximum_width: int, quality: int, transparent: bool) -> None:
    source = ROOT / relative_path
    if not source.is_file():
        print(f"SKIP: {relative_path} is not available")
        return

    target = source.with_suffix(".webp")
    with Image.open(source) as raw:
        image = ImageOps.exif_transpose(raw)
        image = image.convert("RGBA" if transparent else "RGB")
        if image.width > maximum_width:
            target_height = max(1, round(image.height * maximum_width / image.width))
            image = image.resize((maximum_width, target_height), Image.Resampling.LANCZOS)
        image.save(target, "WEBP", quality=quality, method=6, exact=transparent)
    with Image.open(target) as check:
        check.verify()
    old = source.stat().st_size
    new = target.stat().st_size
    print(f"{relative_path}: {old:,} -> {new:,} bytes ({(1-new/old)*100:.1f}% savings); output {target.relative_to(ROOT)}")
    if new >= old:
        print("WARNING: WebP is not smaller; keep original until reviewed")

if __name__ == "__main__":
    for args in SOURCES:
        optimize(*args)
