#!/usr/bin/env python3
"""Render the collection's colors as a looping, clickable pixel waterfall.

The approach is palette-constrained rendering: a waterfall is *designed* first —
a plunging sheet, rock banks, a crest, whitewater streaks, a churning plunge pool —
as a field of target lightness, and then every block is filled with the closest
real color from ``artwork_colors``. Colors and artworks may repeat, which is what
makes the match possible; nothing is ever tinted, so each block still maps back to
a work you can open.

Three pools feed the image, because a waterfall is not one material:
  * foam  — globally light colors. Real whitewater is white in any light, so foam
            ignores the hue phase entirely, which is what keeps the fall legible
            once the water has drifted into oranges and reds.
  * rock  — globally dark colors, static in screen space. The banks do not fall.
  * water — the current hue band, matched by lightness. This is the part that
            travels: the band walks the whole journey over one loop.

The journey is one cycle — light neutrals, darkening grey, blue, then around the
hue wheel by decreasing hue and back — so the fall opens white, runs blue, passes
through every color the collection holds and arrives back at the crest.

Everything time-varying is periodic over FRAMES, so the loop closes exactly.

Writes ``data/waterfall.json`` for ``artifact/waterfall.html``. Pass --gif to also
write the (non-interactive) ``artifact/waterfall.gif``.

Usage:
    python3 scripts/build_waterfall.py
    python3 scripts/build_waterfall.py --preview 8
    python3 scripts/build_waterfall.py --gif
"""

import argparse
import colorsys
import json
import math
import random
import sqlite3
import sys
from bisect import bisect_left
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "artworks.db"
GIF_PATH = ROOT / "artifact" / "waterfall.gif"
JSON_PATH = ROOT / "data" / "waterfall.json"

COLS = 40
ROWS = 60
FRAMES = 96
ADVANCE = 3                  # rows the sheet falls per frame
WORLD = FRAMES * ADVANCE     # 288 — the falling texture's vertical period
BLOCK = 8
FRAME_MS = 70

CREST_ROWS = 5               # water going over the lip
POOL_ROWS = 13               # churning plunge pool, static in screen space
MIST_ROWS = 9                # spray rising off the pool

FOAM_MIN_L = 0.72
ROCK_MAX_L = 0.25
BAND_FRACTION = 0.05         # share of the journey visible as "water" at any moment
MIN_BAND_SPAN = 0.46         # lightness range a band must cover before it is usable
SEED = 11


def hsl(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    return h * 360, s, l


def load_colors(conn):
    rows = conn.execute(
        """SELECT c.hex, c.r, c.g, c.b, c.artwork_id, a.title, a.artist_name
           FROM artwork_colors c JOIN artworks a ON a.id = c.artwork_id"""
    ).fetchall()
    out = []
    for hex_color, r, g, b, artwork_id, title, artist in rows:
        h, s, l = hsl(r, g, b)
        out.append({"hex": hex_color, "h": h, "s": s, "l": l, "id": artwork_id,
                    "title": title or "Untitled", "artist": artist or "Unknown artist"})
    return out


def journey(colors):
    """One cycle: white crest -> grey -> blue -> around the wheel -> back to pale."""
    neutrals = sorted((c for c in colors if c["s"] < 0.12), key=lambda c: -c["l"])
    chromatic = sorted((c for c in colors if c["s"] >= 0.12),
                       key=lambda c: (((210 - c["h"]) % 360), c["l"]))
    return neutrals + chromatic


class Pool:
    """A set of colors searchable by lightness."""

    def __init__(self, colors):
        self.items = sorted(colors, key=lambda c: c["l"])
        self.keys = [c["l"] for c in self.items]

    def __len__(self):
        return len(self.items)

    def nearest(self, target, rng, spread=3):
        """Closest match by lightness, chosen from a few candidates so that large
        flat areas get texture instead of the same hex repeated."""
        if not self.items:
            return None
        i = bisect_left(self.keys, target)
        lo = max(0, i - spread)
        hi = min(len(self.items), i + spread + 1)
        return self.items[rng.randrange(lo, hi)]


def periodic_smooth(rng, length, octaves=(24, 8, 3), weights=(0.55, 0.3, 0.15)):
    """Value noise that wraps exactly, so the fall has no seam."""
    out = [0.0] * length
    for step, weight in zip(octaves, weights):
        n = max(2, length // step)
        pts = [rng.random() for _ in range(n)]
        for i in range(length):
            t = i / length * n
            a = int(math.floor(t)) % n
            b = (a + 1) % n
            f = t - math.floor(t)
            f = f * f * (3 - 2 * f)                      # smoothstep
            out[i] += weight * (pts[a] * (1 - f) + pts[b] * f)
    lo, hi = min(out), max(out)
    return [(v - lo) / (hi - lo) if hi > lo else 0.5 for v in out]


def build_fields(rng):
    """Every field here is periodic, which is what makes the loop seamless."""
    # Whitewater streaks live in world space and scroll with the sheet.
    streaks = [periodic_smooth(rng, WORLD) for _ in range(COLS)]
    # Rock is screen space and static — banks do not fall.
    rock = [periodic_smooth(rng, ROWS, octaves=(11, 4), weights=(0.6, 0.4))
            for _ in range(COLS)]
    # The pool churns in place: periodic over frames, not over world rows.
    pool = [[periodic_smooth(rng, FRAMES, octaves=(13, 5), weights=(0.6, 0.4))
             for _ in range(POOL_ROWS)] for _ in range(COLS)]
    return streaks, rock, pool


def sheetness(nx, ny):
    """1 inside the falling sheet, 0 on the banks. The fall widens as it drops."""
    half = 0.30 + 0.13 * ny
    d = abs(nx - 0.5) / half
    return max(0.0, min(1.0, 1.45 - 1.45 * d))


def target_lightness(col, row, frame, streaks, rock, pool):
    nx = col / (COLS - 1)
    ny = row / (ROWS - 1)
    y_world = (row + frame * ADVANCE) % WORLD

    s = sheetness(nx, ny)
    water = 0.26 + 0.62 * streaks[col][y_world]

    # The lip: water thins and brightens as it goes over.
    if row < CREST_ROWS:
        water = min(1.0, water + 0.30 * (1 - row / CREST_ROWS))

    rock_l = 0.08 + 0.15 * rock[col][row]
    lightness = rock_l + (water - rock_l) * s

    # Spray drifting up off the pool lifts everything just above it.
    mist_top = ROWS - POOL_ROWS - MIST_ROWS
    if mist_top <= row < ROWS - POOL_ROWS:
        m = (row - mist_top) / MIST_ROWS
        lightness += 0.26 * m * m

    # The plunge pool: bright, high-contrast churn that owns the bottom band
    # regardless of what the sheet above it is doing.
    if row >= ROWS - POOL_ROWS:
        p = row - (ROWS - POOL_ROWS)
        churn = pool[col][p][frame]
        depth = p / max(1, POOL_ROWS - 1)
        pool_l = 0.30 + 0.62 * churn
        pool_l -= 0.22 * depth * (1 - churn)     # darkens into the pool's shadows
        blend = min(1.0, 0.45 + 0.55 * (p / max(1, POOL_ROWS - 1)) + 0.3)
        lightness = lightness * (1 - blend) + pool_l * blend

    return max(0.0, min(1.0, lightness))


def render(colors, rng):
    ordered = journey(colors)
    foam = Pool([c for c in ordered if c["l"] >= FOAM_MIN_L])
    rock_pool = Pool([c for c in ordered if c["l"] <= ROCK_MAX_L])
    print(f"pools — foam {len(foam)}, rock {len(rock_pool)}, journey {len(ordered)}")

    streaks, rock, pool = build_fields(rng)
    base_half = max(40, int(len(ordered) * BAND_FRACTION / 2))

    def water_band(centre):
        """Widen until the band can actually render a waterfall.

        The journey is sorted by hue then lightness, so a narrow window is narrow
        in both: ask it for a dark block and it returns another pale one, and the
        sheet washes out to a flat panel. Widening keeps the hue family while
        recovering the light-to-dark range the fall needs.
        """
        half = base_half
        while True:
            window = [ordered[(centre + k) % len(ordered)]
                      for k in range(-half, half)]
            ls = sorted(c["l"] for c in window)
            span = ls[int(len(ls) * 0.92)] - ls[int(len(ls) * 0.08)]
            if span >= MIN_BAND_SPAN or half >= len(ordered) // 2:
                return Pool(window), half
            half = int(half * 1.7) + 30

    widest = 0
    frames = []
    for f in range(FRAMES):
        # The water's hue band walks the whole journey over exactly one loop.
        centre = int((f / FRAMES) * len(ordered))
        water, half = water_band(centre)
        widest = max(widest, half)

        grid = []
        for row in range(ROWS):
            for col in range(COLS):
                t = target_lightness(col, row, f, streaks, rock, pool)
                nx = col / (COLS - 1)
                s = sheetness(nx, row / (ROWS - 1))
                in_pool = row >= ROWS - POOL_ROWS

                if t >= FOAM_MIN_L and len(foam):
                    cell = foam.nearest(t, rng)
                elif s <= 0.02 and not in_pool and len(rock_pool):
                    cell = rock_pool.nearest(t, rng)
                else:
                    cell = water.nearest(t, rng) or foam.nearest(t, rng)
                grid.append(cell)
        frames.append(grid)
    print(f"band half-width {base_half} -> up to {widest} to hold contrast")
    return frames


def write_json(frames):
    artworks, artwork_index = [], {}
    palette, palette_index = [], {}
    out_frames = []

    for grid in frames:
        row = []
        for cell in grid:
            if cell["id"] not in artwork_index:
                artwork_index[cell["id"]] = len(artworks)
                artworks.append([cell["id"], cell["title"], cell["artist"]])
            key = (cell["hex"], cell["id"])
            if key not in palette_index:
                palette_index[key] = len(palette)
                palette.append([cell["hex"], artwork_index[cell["id"]]])
            row.append(palette_index[key])
        out_frames.append(row)

    JSON_PATH.write_text(json.dumps({
        "columns": COLS, "rows": ROWS, "frames": FRAMES, "frameMs": FRAME_MS,
        "artworks": artworks, "palette": palette, "cells": out_frames,
    }, separators=(",", ":")))
    return len(artworks), len(palette)


def to_image(grid):
    img = Image.new("RGB", (COLS, ROWS))
    px = img.load()
    for i, cell in enumerate(grid):
        h = cell["hex"]
        px[i % COLS, i // COLS] = (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))
    return img.resize((COLS * BLOCK, ROWS * BLOCK), Image.NEAREST)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", type=int, default=0, help="write N PNG frames and stop")
    parser.add_argument("--gif", action="store_true", help="also write the non-interactive GIF")
    args = parser.parse_args()

    if not DB_PATH.exists():
        sys.exit(f"{DB_PATH} not found. Run scripts/normalize_artsy_saves.py first.")

    conn = sqlite3.connect(DB_PATH)
    try:
        colors = load_colors(conn)
    finally:
        conn.close()

    rng = random.Random(SEED)
    frames = render(colors, rng)
    print(f"{len(colors)} colors -> {FRAMES} frames of {COLS}x{ROWS}")

    if args.preview:
        for i in range(args.preview):
            to_image(frames[i * (FRAMES // args.preview)]).save(ROOT / f"preview_{i:02d}.png")
        print(f"wrote {args.preview} preview frames")
        return

    n_art, n_pal = write_json(frames)
    print(f"Wrote {JSON_PATH} ({JSON_PATH.stat().st_size/1_000_000:.2f} MB, "
          f"{n_pal} palette entries across {n_art} artworks)")

    if args.gif:
        images = [to_image(g) for g in frames]
        images[0].save(GIF_PATH, save_all=True, append_images=images[1:],
                       duration=FRAME_MS, loop=0, optimize=True, disposal=2)
        print(f"Wrote {GIF_PATH} ({GIF_PATH.stat().st_size/1_000_000:.2f} MB)")


if __name__ == "__main__":
    main()
