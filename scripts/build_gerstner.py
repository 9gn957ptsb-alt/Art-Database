#!/usr/bin/env python3
"""An abstract panel in Karl Gerstner's grammar, coloured from the collection.

Read off five of his works (Colour sound, extra version 1977; Color Sound St.
Jaques Nr. 7 1974; Color Fractal 4/3 1993; Spannungsbild 1960-63; Chromorphose
3.01 1973), the grammar is narrow and strict:

  * flat colour only — no shading, no gradient, no outline;
  * a modular grid, subdivided systematically rather than composed by eye;
  * nested, concentric bands;
  * few hues, in even steps;
  * self-similarity: the motif recurs at a smaller scale inside itself;
  * order by permutation, not by taste.

The construction here is 27 x 27: a 3 x 3 module of 9 x 9 tiles, each tile a set
of five nested concentric squares. Tile rotations are laid out +3 across each row
and +1 down each column, so every tile is a different chord of the same nine
colours and no neighbour repeats one. Within a tile the rings step by two, which
walks the whole ramp in even intervals.

Palette, chosen by what the collection can honestly back rather than by which
Gerstner is most famous. His saturated works are out of reach: St. Jaques'
orange-red (#fd3502) has three near matches in 14,542 dominant colours, and the
Color Fractal magenta has twenty-four. "Colour sound, extra version" —
terracotta, pale lilac, blue-grey — is the one whose whole ramp this collection
holds, every step of it backed by dozens of real works.

Writes data/gerstner.json.

Usage:
    python3 scripts/build_gerstner.py
    python3 scripts/build_gerstner.py --preview
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from motion import open_colors, slot_cycle    # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "artworks.db"
OUT_PATH = ROOT / "data" / "gerstner.json"

TILE = 9                 # one module
MODULES = 3              # 3 x 3 of them
SIZE = TILE * MODULES    # 27
CYCLE_STEPS = 48

# The three anchors of "Colour sound, extra version", evenly interpolated into
# nine steps: terracotta -> pale lilac -> blue-grey. Even steps are the point;
# an eyeballed ramp is not this grammar.
ANCHORS = [(200, 106, 88), (217, 218, 231), (120, 148, 185)]


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def build_ramp(steps_per_leg=4):
    ramp = [lerp(ANCHORS[0], ANCHORS[1], i / steps_per_leg)
            for i in range(steps_per_leg + 1)]
    ramp += [lerp(ANCHORS[1], ANCHORS[2], i / steps_per_leg)
             for i in range(1, steps_per_leg + 1)]
    return ramp


RAMP = build_ramp()
N = len(RAMP)            # 9


def build_grid():
    """Nested squares inside a modular grid, by permutation.

    No holes: the panel is the object, entire. A painting has no ground to sit
    on and nothing to cut around, so every cell is paint and every cell is
    clickable.
    """
    grid = [[0] * SIZE for _ in range(SIZE)]
    c = TILE // 2
    for ty in range(MODULES):
        for tx in range(MODULES):
            rotation = (tx * 3 + ty) % N         # +3 across, +1 down
            for y in range(TILE):
                for x in range(TILE):
                    ring = max(abs(x - c), abs(y - c))   # concentric squares
                    grid[ty * TILE + y][tx * TILE + x] = (rotation + 2 * ring) % N
    return grid


NOTE = ("A panel in Karl Gerstner's grammar: 27 x 27, a 3 x 3 module of nine-square "
        "tiles, each tile five nested squares. Flat colour only — no shading, no "
        "outline, nothing eyeballed. The nine steps run evenly from terracotta "
        "through pale lilac to blue-grey, the palette of his Colour sound, extra "
        "version (1977), picked because it is the one Gerstner palette this "
        "collection can actually back: his St. Jaques orange-red has three near "
        "matches in 14,542 colours, this terracotta has eighty.")

BUILT = {
    "grid": "27 x 27 — 3 x 3 modules of 9 x 9, five nested rings each",
    "ramp": "9 even steps, terracotta -> pale lilac -> blue-grey",
    "backing": "23-955 real colours per step at tolerance 20",
    "lessons": [
        "The palette has to be chosen by what the collection holds, not by which "
        "work is best known. Gerstner's saturated pieces are unrenderable here — "
        "1.2% of these colours are violet or magenta, 33.8% are earth.",
        "This grammar forbids the shading the sprites depend on, so contrast has "
        "to come from the ramp step alone. Rings step by two, not one: adjacent "
        "steps read as one colour at this size.",
        "Rotation laid out +3 across and +1 down gives every tile a different "
        "chord and no repeated neighbour, without anything being placed by eye.",
    ],
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()

    if not DB_PATH.exists():
        sys.exit(f"{DB_PATH} not found.")
    colors = open_colors(DB_PATH)

    grid = build_grid()
    cycles, tols = [], []
    for target in RAMP:
        cycle, tol = slot_cycle(colors, target)
        cycles.append(cycle)
        tols.append(tol)
    print(f"  Colour Sound: {SIZE}x{SIZE}, {N} steps, "
          f"{[len(c) for c in cycles]} colours (tol {tols})")

    if args.preview:
        from PIL import Image
        B = 16
        img = Image.new("RGB", (SIZE * B, SIZE * B))
        px = img.load()
        for y, row in enumerate(grid):
            for x, slot in enumerate(row):
                rgb = cycles[slot][0]["rgb"]
                for dy in range(B):
                    for dx in range(B):
                        px[x * B + dx, y * B + dy] = rgb
        img.save(ROOT / "preview_colour_sound.png")
        print("wrote preview_colour_sound.png")
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
        "objects": [{"key": "colour-sound", "name": "Colour Sound",
                     "cols": SIZE, "rows": SIZE, "grid": grid,
                     "cycles": packed, "note": NOTE, "built": BUILT}],
    }, separators=(",", ":")))
    print(f"Wrote {OUT_PATH} ({OUT_PATH.stat().st_size/1000:.0f} KB, "
          f"{len(palette)} colours across {len(artworks)} works)")


if __name__ == "__main__":
    main()
