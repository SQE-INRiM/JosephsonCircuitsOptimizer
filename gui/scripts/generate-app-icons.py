#!/usr/bin/env python3
"""Generate native JCO app icons from the checked-in vector master.

Optional maintainer tooling (not part of the app runtime):
    python -m pip install Pillow CairoSVG
    python gui/scripts/generate-app-icons.py
"""
from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image

root = Path(__file__).resolve().parents[1] / "build"
source = root / "icon.svg"
master = Image.open(
    BytesIO(cairosvg.svg2png(url=str(source), output_width=1024, output_height=1024))
).convert("RGBA")

# Keep a high-resolution PNG for native Linux window icons.
master.save(root / "icon.png", format="PNG", optimize=True)
# Pillow embeds resized PNG frames, preserving smooth antialiasing at every size.
master.save(
    root / "icon.ico",
    format="ICO",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
print("Generated build/icon.ico and build/icon.png from build/icon.svg")
