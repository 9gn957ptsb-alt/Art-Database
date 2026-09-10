#!/usr/bin/env python3
"""Render the collection's colors as a looping pixel waterfall.

Every block is an unaltered hex from ``artwork_colors`` and maps back to the work
it came from, so the animation stays clickable in the artifact version and honest
about its source. The waterfall reads as water through *selection and motion* —
which real color sits where, and how fast each column falls — never by tinting.

How the loop closes. Colours are ordered into one cyclic journey: light neutrals
first (the white crest), darkening to grey, into blue, then around the hue wheel
by decreasing hue — blue, cyan, green, yellow, orange, red, magenta, violet — which
arrives back at the pale end it started from. That ribbon is RIBBON_ROWS x COLUMNS
cells, sized to hold essentially the whole database, and the window scrolls down it
and wraps. Each column falls at an integer multiple of the base speed, so after
FRAMES frames every column has travelled a whole number of ribbon lengths and the
loop is seamless.

Writes ``artifact/waterfall.gif`` and ``data/waterfall.json`` (the ribbon, palette
and artwork references the interactive page replays with the same maths).

Usage:
    python3 scripts/build_waterfall.py
    python3 scripts/build_waterfall.py --preview 6   # a few PNG frames, no GIF
"""

import argparse
import colorsys
import json
import random
import sqlite3
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "artworks.db"
GIF_PATH = ROOT / "artifact" / "waterfall.gif"
JSON_PATH = ROOT / "data" / "waterfall.json"

COLUMNS = 40
VISIBLE_ROWS = 52
FRAMES = 120
BASE_ADVANCE = 3                      # ribbon rows travelled per frame
RIBBON_ROWS = FRAMES * BASE_ADVANCE   # 360 rows x 40 cols = 14,400 cells
BLOCK = 8
FRAME_MS = 70

# Columns slip against each other so the sheet does not fall as one rigid block,
# but the slip is bounded: let columns drift freely and column 0 ends up in the
# whites while its neighbour is in the oranges, which reads as confetti rather
# than water. SLIP_RANGE rows is ~2% of the journey — visible motion, one colour
# family. FRAMES * any integer slip rate stays a multiple of SLIP_RANGE, so the
# loop still closes exactly.
SLIP_RATES = [0, 1, 2, 1, 0, 2, 1, 0, 1, 2]
SLIP_RANGE = 12
FOAM_COLUMN_CHANCE = 0.34
FOAM_RUN_CHANCE = 0.12        # chance a streak starts at a given cell
FOAM_RUN_ROWS = (3, 9)        # streaks, not speckle
SEED = 7


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
        out.append({
            "hex": hex_color, "h": h, "s": s, "l": l,
            "id": artwork_id, "title": title or "Untitled",
            "artist": artist or "Unknown artist",
        })
    return out


def journey(colors):
    """Order every colour into one cycle that opens on white and closes back to it."""
    neutrals = [c for c in colors if c["s"] < 0.12]
    chromatic = [c for c in colors if c["s"] >= 0.12]

    # Whitest first, darkening into the blues that follow.
    neutrals.sort(key=lambda c: -c["l"])

    # Decreasing hue from blue: blue -> cyan -> green -> yellow -> orange -> red
    # -> magenta -> violet -> back to blue, so the wrap is a hue step, not a jump.
    def key(c):
        return ((210 - c["h"]) % 360, c["l"])

    chromatic.sort(key=key)
    return neutrals + chromatic


def build_ribbon(ordered, rng):
    """Lay the journey into the ribbon row-major, then cut foam streaks into it."""
    cells = RIBBON_ROWS * COLUMNS
    if len(ordered) >= cells:
        # Even sampling keeps the whole journey represented rather than truncating
        # the tail (which would drop the violets entirely).
        step = len(ordered) / cells
        chosen = [ordered[int(i * step)] for i in range(cells)]
    else:
        chosen = [ordered[i % len(ordered)] for i in range(cells)]

    ribbon = [[chosen[r * COLUMNS + c] for c in range(COLUMNS)]
              for r in range(RIBBON_ROWS)]

    # Streaks are real colours swapped in, never paint over the top, and they run
    # vertically so they read as water rather than speckle. Baked into the ribbon,
    # so they fall with the sheet.
    #
    # Which pool a streak draws from depends on the water around it. Light foam is
    # invisible against the cream and ochre stretch — a third of this collection —
    # so where the surrounding rows are already light the streak takes the dark
    # pool instead, the shadow channel of a fall rather than its spray.
    light_pool = [c for c in ordered if c["l"] >= 0.80]
    dark_pool = [c for c in ordered if c["l"] <= 0.28]
    if not (light_pool and dark_pool):
        return ribbon

    row_light = [sum(cell["l"] for cell in row) / COLUMNS for row in ribbon]

    for c in range(COLUMNS):
        if rng.random() >= FOAM_COLUMN_CHANCE:
            continue
        r = 0
        while r < RIBBON_ROWS:
            if rng.random() < FOAM_RUN_CHANCE:
                pool = dark_pool if row_light[r] > 0.55 else light_pool
                for _ in range(rng.randint(*FOAM_RUN_ROWS)):
                    ribbon[r % RIBBON_ROWS][c] = pool[rng.randrange(len(pool))]
                    r += 1
            else:
                r += 1
    return ribbon


def column_motion(rng):
    speeds = [SLIP_RATES[c % len(SLIP_RATES)] for c in range(COLUMNS)]
    offsets = [rng.randrange(SLIP_RANGE) for _ in range(COLUMNS)]
    return speeds, offsets


def cell_at(ribbon, speeds, offsets, frame, col, row):
    """The whole sheet falls at BASE_ADVANCE; each column adds a bounded slip."""
    slip = (offsets[col] + speeds[col] * frame) % SLIP_RANGE
    r = (BASE_ADVANCE * frame + row + slip) % RIBBON_ROWS
    return ribbon[r][col]


def render_frame(ribbon, speeds, offsets, frame):
    img = Image.new("RGB", (COLUMNS, VISIBLE_ROWS))
    px = img.load()
    for row in range(VISIBLE_ROWS):
        for col in range(COLUMNS):
            hex_color = cell_at(ribbon, speeds, offsets, frame, col, row)["hex"]
            px[col, row] = (
                int(hex_color[1:3], 16), int(hex_color[3:5], 16), int(hex_color[5:7], 16)
            )
    return img.resize((COLUMNS * BLOCK, VISIBLE_ROWS * BLOCK), Image.NEAREST)


def write_json(ribbon, speeds, offsets):
    """Palette + artwork tables + index ribbon, so the page replays the same maths."""
    artworks, artwork_index = [], {}
    palette, palette_index = [], {}
    grid = []

    for row in ribbon:
        for cell in row:
            if cell["id"] not in artwork_index:
                artwork_index[cell["id"]] = len(artworks)
                artworks.append([cell["id"], cell["title"], cell["artist"]])
            key = (cell["hex"], cell["id"])
            if key not in palette_index:
                palette_index[key] = len(palette)
                palette.append([cell["hex"], artwork_index[cell["id"]]])
            grid.append(palette_index[key])

    JSON_PATH.write_text(json.dumps({
        "columns": COLUMNS, "visibleRows": VISIBLE_ROWS, "ribbonRows": RIBBON_ROWS,
        "frames": FRAMES, "baseAdvance": BASE_ADVANCE, "frameMs": FRAME_MS,
        "speeds": speeds, "offsets": offsets,
        "artworks": artworks, "palette": palette, "grid": grid,
    }, separators=(",", ":")))
    return len(artworks), len(palette)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", type=int, default=0, help="write N PNG frames and stop")
    args = parser.parse_args()

    if not DB_PATH.exists():
        sys.exit(f"{DB_PATH} not found. Run scripts/normalize_artsy_saves.py first.")

    rng = random.Random(SEED)
    conn = sqlite3.connect(DB_PATH)
    try:
        colors = load_colors(conn)
    finally:
        conn.close()

    ordered = journey(colors)
    ribbon = build_ribbon(ordered, rng)
    speeds, offsets = column_motion(rng)
    print(f"{len(colors)} colors -> ribbon {RIBBON_ROWS}x{COLUMNS} = {RIBBON_ROWS*COLUMNS} cells")

    if args.preview:
        for i in range(args.preview):
            frame = i * (FRAMES // args.preview)
            render_frame(ribbon, speeds, offsets, frame).save(
                ROOT / f"preview_{i:02d}.png")
        print(f"wrote {args.preview} preview frames")
        return

    frames = [render_frame(ribbon, speeds, offsets, f) for f in range(FRAMES)]
    GIF_PATH.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        GIF_PATH, save_all=True, append_images=frames[1:],
        duration=FRAME_MS, loop=0, optimize=True, disposal=2,
    )
    n_art, n_pal = write_json(ribbon, speeds, offsets)
    print(f"Wrote {GIF_PATH} ({GIF_PATH.stat().st_size/1_000_000:.2f} MB, {FRAMES} frames)")
    print(f"Wrote {JSON_PATH} ({n_pal} palette entries across {n_art} artworks)")


if __name__ == "__main__":
    main()
