#!/usr/bin/env python3
"""The waterfall, rebuilt against the cerulean reference.

The earlier fall matched real colours per block, which meant thousands of works
on screen and a palette that drifted with them. This one inverts the priority,
as asked: the picture comes first. Nine slots are read straight off the
reference — #011432 through #0057b3 and #1da6f5 to white — and each slot is
backed by a short cycle of the closest real colours in the collection. Whole
regions hold one colour and change together, so it reads as flat pixel art
rather than as grit, and it costs a slot index per block instead of a palette
index: about 200 KB where the old fall was 2 MB.

If only a handful of works can stand in for a slot, that is the right trade. The
aesthetic is the object; the works are what it is made of, not what it is for.

Composition, read off the reference: a sheet whose right edge runs diagonally
from a high lip down to the foot, hard navy contour along that edge, filaments
running the length of the drop and diverging as they fall, a white detonation
where it lands, and a banded pool across the bottom. No sky — the object and its
contour are the whole of what exists and the whole of what is clickable.

Writes data/falls.json.

Usage:
    python3 scripts/build_falls.py
    python3 scripts/build_falls.py --preview 4
"""

import argparse
import json
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from motion import open_colors, periodic_smooth, slot_cycle, smoothstep  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "artworks.db"
OUT_PATH = ROOT / "data" / "falls.json"

COLS = 36
ROWS = 36
FRAMES = 72
ADVANCE = 1                  # one row per frame, like a piece falling on a grid
WORLD = FRAMES * ADVANCE
FRAME_MS = 620               # a tad faster than a Tetris piece at level 0
CYCLE_STEPS = 48
SEED = 7

# Quantised from the reference image. Nine steps and nothing between them.
RAMP = [
    (1, 20, 50),      # 0  contour / deep rock
    (1, 40, 95),      # 1  navy
    (0, 87, 179),     # 2  dark blue
    (9, 139, 227),    # 3  blue
    (29, 166, 245),   # 4  bright blue
    (85, 195, 250),   # 5  light blue
    (139, 220, 253),  # 6  pale blue
    (206, 239, 253),  # 7  near white
    (253, 254, 254),  # 8  white
]
# The picture first: a slot may be backed by very few works if that is what the
# collection honestly holds near it.
SLOT_MIN = 6
SLOT_MAX = 24

STRANDS = 13
LIP_Y = 0.055
FOOT_Y = 0.78
POOL_Y = 0.86


def edge(ny):
    """Right boundary of the sheet — the diagonal the whole image hangs on."""
    e = 0.34 + 0.42 * (ny ** 0.72)
    if ny > 0.72:
        e += (1.06 - e) * smoothstep(0.72, 0.96, ny)
    return min(1.06, e)


def in_water(nx, ny):
    if ny >= POOL_Y:
        return True
    return nx <= edge(ny)


def build_fields(rng):
    strands = []
    for i in range(STRANDS):
        t = (i + 0.5) / STRANDS
        strands.append({
            "u": t + rng.uniform(-0.022, 0.022),      # position across the sheet
            "w": rng.uniform(0.016, 0.042),
            "gain": rng.uniform(0.6, 1.0),
            "noise": periodic_smooth(rng, WORLD, octaves=(26, 9, 3),
                                     weights=(0.5, 0.32, 0.18)),
        })
    crest = periodic_smooth(rng, COLS, octaves=(6, 2), weights=(0.6, 0.4))
    pool = [periodic_smooth(rng, FRAMES, octaves=(11, 4), weights=(0.6, 0.4))
            for _ in range(ROWS)]
    spray = [[periodic_smooth(rng, FRAMES, octaves=(9, 3), weights=(0.62, 0.38))
              for _ in range(ROWS)] for _ in range(COLS)]
    return strands, crest, pool, spray


def slot_at(col, row, frame, fields):
    """Which of the nine steps this block is, or None for a hole.

    Composed the way the reference is built up: sheet, filaments, contour,
    bloom, pool — each stage overriding the last where it applies.
    """
    strands, crest, pool, spray = fields
    nx = col / (COLS - 1)
    ny = row / (ROWS - 1)
    if not in_water(nx, ny):
        return None
    y_world = (row + frame * ADVANCE) % WORLD

    # The pool: horizontal banding, flat and quiet, brightest under the landing.
    if ny >= POOL_Y:
        band = pool[row][frame]
        near = 1.0 - min(1.0, abs(nx - 0.66) / 0.55)
        v = 0.22 + 0.28 * band + 0.30 * near
        # Hard horizontal streaks, not a gradient — the pool in the reference is
        # drawn as lines, one row at a time.
        if (row + int(band * 3)) % 2 == 0:
            v += 0.14
        return quantise(v)

    e = edge(ny)
    u = nx / e if e > 0 else 0.0            # 0 at the left edge, 1 at the boundary

    # Filaments, diverging as they drop.
    drop = smoothstep(LIP_Y, FOOT_Y, ny)
    water = 0.0
    for st in strands:
        uc = st["u"] + (st["u"] - 0.5) * drop * 0.22
        w = st["w"] * (1.0 + 1.3 * drop)
        d = abs(u - uc) / w
        if d >= 1.7:
            continue
        flick = st["noise"][(y_world + int(st["u"] * 89)) % WORLD]
        # Weak flicker on purpose: strong per-row noise breaks a filament into
        # mottling, and the reference's threads run the whole drop unbroken.
        water = max(water, st["gain"] * math.exp(-d * d * 1.05) * (0.70 + 0.30 * flick))

    # The sheet is drawn BETWEEN two ramps rather than as one gradient the
    # filaments brighten: dark where there is no filament, bright where there is.
    # Brightening a mid-blue base only ever produced mid-blue — the reference's
    # whole character is white threads against deep navy.
    dark = 0.05 + 0.31 * (u ** 0.85)
    bright = 0.30 + 0.58 * (u ** 0.60)
    v = dark + (bright - dark) * (water ** 0.7)
    v += 0.07 * (strands[col % STRANDS]["noise"][y_world] - 0.5)

    # The rock the water falls past: the left bank all the way down, deepest at
    # the top. Subtracted rather than painted, so the filaments still cut across
    # it — a solid dark rectangle there reads as a hole punched in the picture.
    v -= (1 - smoothstep(0.0, 0.30, u)) * (0.55 + 0.45 * crest[col]) * (
        0.22 + 0.26 * (1 - smoothstep(0.0, 0.38, ny)))

    # White just inside the falling edge. The navy contour itself is traced from
    # the silhouette afterwards: testing a threshold per block leaves the line
    # broken into specks wherever the diagonal steps sideways.
    if u > 0.90:
        v = max(v, 0.86 + 0.14 * strands[col % STRANDS]["noise"][y_world])

    # Where it lands: the brightest thing in the frame.
    bx = (nx - 0.60) / 0.34
    by = (ny - FOOT_Y) / 0.16
    bloom = 1.0 - (bx * bx + by * by)
    if bloom > 0:
        v = max(v, (0.62 + 0.38 * bloom ** 0.5) * (0.78 + 0.22 * spray[col][row][frame]))

    return quantise(v)


def spray_specks(cells, fields, frame, table):
    """Foam thrown clear of the falling edge.

    Added after the contour is traced, not before: an isolated block touches only
    holes, so the outline pass would turn every speck into a navy dot.
    """
    for y in range(ROWS):
        ny = y / (ROWS - 1)
        if ny >= POOL_Y:
            continue
        e = edge(ny)
        for x in range(COLS):
            i = y * COLS + x
            if cells[i] is not None:
                continue
            gap = x / (COLS - 1) - e
            if gap <= 0 or gap > 0.16:
                continue
            r = table[(x * 31 + y * 17 + frame * 11) % len(table)]
            if r > 0.90 + 0.07 * (gap / 0.16):
                cells[i] = 8 if r > 0.965 else 7
    return cells


def outline(cells, slot=0):
    """Trace the silhouette: any filled block touching a hole becomes contour.

    One block, following the true edge. This is what turns the diagonal into a
    drawn line instead of the place where the picture happens to stop.
    """
    for y in range(ROWS):
        for x in range(COLS):
            i = y * COLS + x
            if cells[i] is None:
                continue
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                ny, nx = y + dy, x + dx
                if nx < 0 or nx >= COLS or ny < 0 or ny >= ROWS:
                    continue          # the frame edge is a cut, not a contour
                if cells[ny * COLS + nx] is None:
                    cells[i] = slot
                    break
    return cells


def quantise(v):
    return max(0, min(len(RAMP) - 1, int(round(v * (len(RAMP) - 1)))))


NOTE = ("A cerulean fall, 36 x 36 over 72 frames. Nine colours read straight off the "
        "reference and nothing between them, each backed by the handful of works in "
        "the collection that sit closest to it — the picture first, the census second. "
        "Stored as slot indices rather than palette indices, which is why it costs "
        "about a tenth of what the old fall did.")

BUILT = {
    "grid": "36 x 36 x 72 frames, 9 slots",
    "ramp": "quantised from the reference: #011432, #012860, #0057b3, #098be3, "
            "#1da6f5, #55c3fa, #8bdcfd, #ceeffd, #fdfefe",
    "backing": "filled in at build time",
    "lessons": [
        "Matching every block to its own nearest real colour puts thousands of works "
        "on screen and lets the palette drift with them. Nine fixed slots, cycled as "
        "whole regions, is what reads as pixel art — and it is also ten times smaller.",
        "The image hangs on one diagonal. White just inside the falling edge and a "
        "hard navy contour on it is what makes that edge read as drawn rather than "
        "as the place the picture stops.",
        "The pool is drawn as horizontal lines, not as a gradient. A soft pool under "
        "a hard-edged fall reads as a mistake.",
        "Superseded the colour-census fall: 2.06 MB of palette indices for 1,609 works, "
        "replaced by 9 slots and about 200 KB.",
    ],
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", type=int, default=0)
    args = parser.parse_args()

    if not DB_PATH.exists():
        sys.exit(f"{DB_PATH} not found.")
    colors = open_colors(DB_PATH)

    cycles, tols = [], []
    for target in RAMP:
        cycle, tol = slot_cycle(colors, target, SLOT_MIN, SLOT_MAX,
                                tol_start=12, tol_stop=90)
        cycles.append(cycle)
        tols.append(tol)
    print(f"  Waterfall: {COLS}x{ROWS}x{FRAMES}, {len(RAMP)} slots, "
          f"{[len(c) for c in cycles]} colours (tol {tols})")
    works = len({c['id'] for cyc in cycles for c in cyc})
    BUILT["backing"] = (f"{min(len(c) for c in cycles)}-{max(len(c) for c in cycles)} "
                        f"real colours per slot, {works} works in all")

    rng = random.Random(SEED)
    fields = build_fields(rng)
    table = [rng.random() for _ in range(1021)]
    frames = [spray_specks(
                  outline([slot_at(c, r, f, fields)
                           for r in range(ROWS) for c in range(COLS)]),
                  fields, f, table)
              for f in range(FRAMES)]

    if args.preview:
        from PIL import Image
        B = 12
        for i in range(args.preview):
            f = i * (FRAMES // args.preview)
            img = Image.new("RGB", (COLS * B, ROWS * B), (231, 228, 221))
            px = img.load()
            for idx, slot in enumerate(frames[f]):
                if slot is None:
                    continue
                rgb = RAMP[slot]
                x, y = idx % COLS, idx // COLS
                for dy in range(B):
                    for dx in range(B):
                        px[x * B + dx, y * B + dy] = rgb
            img.save(ROOT / f"preview_fall_{i:02d}.png")
        print(f"wrote {args.preview} preview frames")
        return

    artworks, artwork_index, palette, palette_index = [], {}, [], {}
    packed = []
    for cycle in cycles:
        ids = []
        for c in cycle:
            if c["id"] not in artwork_index:
                artwork_index[c["id"]] = len(artworks)
                artworks.append([c["id"], c["title"], c["artist"]])
            key = (c["hex"], c["id"])
            if key not in palette_index:
                palette_index[key] = len(palette)
                palette.append([c["hex"], artwork_index[c["id"]]])
            ids.append(palette_index[key])
        packed.append(ids)

    OUT_PATH.write_text(json.dumps({
        "cycleSteps": CYCLE_STEPS, "artworks": artworks, "palette": palette,
        "objects": [{
            "key": "waterfall", "name": "Waterfall", "kind": "field",
            "cols": COLS, "rows": ROWS, "frames": FRAMES, "frameMs": FRAME_MS,
            "cells": [[(-1 if s is None else s) for s in frame] for frame in frames],
            "cycles": packed, "note": NOTE, "built": BUILT,
        }],
    }, separators=(",", ":")))
    print(f"Wrote {OUT_PATH} ({OUT_PATH.stat().st_size/1000:.0f} KB, "
          f"{len(palette)} colours across {len(artworks)} works)")


if __name__ == "__main__":
    main()
