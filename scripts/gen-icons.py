#!/usr/bin/env python3
"""
Generates every image asset Expo needs, from one definition of the mark.

    python3 scripts/gen-icons.py

The mark is NVP's identity: four slots, two solved. Purple for the game itself,
amber for a digit found but misplaced, green for one in the right slot — the
same colour meanings the game uses everywhere else.

Each output has different rules, which is why they can't just be one file
resized:

  icon.png            1024, full bleed. Stores and launchers mask this
                      themselves, so it must have no transparency and no
                      rounding of its own.
  adaptive-icon.png   1024, transparent, artwork confined to the centre 66%.
                      Android masks adaptive icons to a circle, squircle or
                      teardrop depending on the launcher; anything outside that
                      safe zone gets cropped on some devices.
  monochrome-icon.png 1024, white on transparent, same safe zone. Android 13+
                      themed icons tint this to the user's wallpaper palette,
                      so it has to read as a silhouette with no colour.
  splash.png          1024, transparent. Shown small (imageWidth 160) over the
                      background colour set in app.json.
  favicon.png         48, for web exports.
"""

import os

from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "assets")

BG = (14, 14, 17, 255)          # --bg
PURPLE = (178, 75, 255, 255)
AMBER = (245, 196, 81, 255)
GREEN = (61, 224, 138, 255)
OUTLINE = (74, 74, 88, 255)
WHITE = (255, 255, 255, 255)

# Drawn oversized then downsampled — PIL has no anti-aliasing on shapes, so
# supersampling is what keeps the rounded corners clean.
SCALE = 4


def draw_mark(size, span, mono=False, background=None):
    """
    The 2x2 mark, centred, with the grid spanning `span` fraction of `size`.
    """
    big = size * SCALE
    image = Image.new("RGBA", (big, big), background or (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    total = big * span
    gap = total * 0.085
    cell = (total - gap) / 2
    radius = cell * 0.24
    left = (big - total) / 2
    top = (big - total) / 2

    def tile(col, row, fill, outline=None):
        x = left + col * (cell + gap)
        y = top + row * (cell + gap)
        draw.rounded_rectangle(
            [x, y, x + cell, y + cell],
            radius=radius,
            fill=fill,
            outline=outline,
            width=int(cell * 0.09) if outline else 0,
        )

    if mono:
        # Themed icons are a single colour, so the empty slot has to stay an
        # outline or the mark collapses into a solid block.
        tile(0, 0, WHITE)
        tile(1, 0, None, WHITE)
        tile(0, 1, WHITE)
        tile(1, 1, WHITE)
    else:
        tile(0, 0, PURPLE)
        tile(1, 0, None, OUTLINE)
        tile(0, 1, AMBER)
        tile(1, 1, GREEN)

    return image.resize((size, size), Image.LANCZOS)


os.makedirs(OUT, exist_ok=True)


def save(image, name):
    path = os.path.join(OUT, name)
    image.save(path)
    print(f"  {name:24} {image.size[0]}x{image.size[1]}  {os.path.getsize(path) // 1024}kB")


# Full bleed: the launcher applies its own mask, so fill the canvas.
save(draw_mark(1024, span=0.62, background=BG), "icon.png")

# Adaptive foreground: transparent, inside the 66% safe zone with margin to
# spare, since the background colour comes from app.json.
save(draw_mark(1024, span=0.44), "adaptive-icon.png")

# Themed icon for Android 13+.
save(draw_mark(1024, span=0.44, mono=True), "monochrome-icon.png")

# Splash artwork, drawn on transparency and shown small over the brand colour.
save(draw_mark(1024, span=0.78), "splash.png")

# Web export.
save(draw_mark(48, span=0.66, background=BG), "favicon.png")

print("\nassets written to assets/")
