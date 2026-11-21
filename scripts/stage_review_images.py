#!/usr/bin/env python3
"""Promote *reviewed* WebP files into the development branch only.

Called by a PR-scoped GitHub Actions job. Does not deploy or touch originals.
Fails closed if the homepage source no longer contains the expected elements.
"""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
review = ROOT / ".image-optimization-review"
public = ROOT / "public"

copies = [
    ("shooter-logo-transparent.webp", "shooter-logo-transparent.webp"),
    ("images/1000391344.webp", "images/1000391344.webp"),
    ("home/festival-team.webp", "home/festival-team.webp"),
]
for src, dest in copies:
    source = review / src
    target = public / dest
    if not source.is_file():
        raise SystemExit(f"Missing optimized input: {source}")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)

page = ROOT / "src/views/AcademyHome.tsx"
original = page.read_text(encoding="utf-8")
logo_old = '<img src="/shooter-logo-transparent.png" width="54" height="60" alt={tr("شعار أكاديمية شوتر")}/>'
logo_new = '<img src="/shooter-logo-transparent.webp" width="54" height="60" alt={tr("شعار أكاديمية شوتر")} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = "/shooter-logo-transparent.png"; }}/>'
banner_old = 'src="/images/1000391344.jpg" alt='
banner_new = 'src="/images/1000391344.webp" alt='

if original.count(logo_old) != 1 or original.count(banner_old) != 1:
    raise SystemExit("Homepage image markup changed: refusing to patch automatically")
updated = original.replace(logo_old, logo_new, 1).replace(banner_old, banner_new, 1)
page.write_text(updated, encoding="utf-8")
print("Prepared WebP assets and responsive homepage references on development branch.")
