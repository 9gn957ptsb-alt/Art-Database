#!/usr/bin/env python3
"""Hand-authored pixel sprites coloured from the collection.

Rewritten against pixel-art fundamentals after the procedural objects came out
gritty. Three things were wrong, and all three are structural:

1. PER-CELL SHIMMER DESTROYED FLATNESS. Every cell picked its own near-identical
   colour, so a region that should read as one flat shape was really hundreds of
   slightly different colours — grit by construction. Cycling now happens at the
   SLOT level: a whole region holds one colour and the whole region changes
   together, which is how sprite art animated water and fire for decades.
2. RAMPS WERE PURE VALUE. Hue shifting — shadows drifting cooler, highlights
   warmer — is most of what separates living pixel art from flat clip art. Every
   ramp here shifts hue as it shifts value.
3. SHAPES WERE PROCEDURAL. Maths produces gradients and orphan pixels; pixel art
   wants deliberate clusters where every pixel belongs to a shape. The sprites are
   authored by hand, at a size small enough that every pixel is a decision.

No backgrounds: '.' is transparent, so only the object and its contour exist and
only they are clickable.

Writes data/sprites.json.

Usage:
    python3 scripts/build_sprites.py
    python3 scripts/build_sprites.py --preview
"""

import argparse
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
# Shared with every other object: one way of matching a ramp step against the
# collection, so objects in different families still speak the same colour.
from motion import open_colors, slot_cycle  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "artworks.db"
OUT_PATH = ROOT / "data" / "sprites.json"

SLOT_MIN = 20
SLOT_MAX = 48
CYCLE_STEPS = 48
SEED = 41

# ---------------------------------------------------------------- sprites
# Silhouettes are authored as explicit spans — one (first, last) column pair per
# row — and filled with a small band rule. Hand-typed ASCII drifts out of
# alignment; spans cannot, and they keep every edge a deliberate decision.
#
# Bands run outline, shadow, mid, light, highlight across a row, with the
# highlight held left of centre so one light direction governs every object.

def bands(span):
    """Interior shading across one row, lit from the upper left.

    Interior only — the contour is derived from the silhouette afterwards.
    Computing an outline per row instead stacks a dark band down every diagonal
    edge and buries the object in its own border.
    """
    first, last = span
    n = last - first + 1
    out = {}
    for i in range(n):
        u = i / max(1, n - 1)
        if n <= 3:
            slot = 3
        elif u < 0.16:
            slot = 2
        elif u < 0.40:
            slot = 4          # highlight, held left of centre
        elif u < 0.64:
            slot = 3
        elif u < 0.84:
            slot = 2
        else:
            slot = 1          # the form turning away
        out[first + i] = slot
    return out


def outline(grid, slot=0):
    """Trace the silhouette: any filled cell touching a hole becomes contour.

    One pixel, following the true edge, which is what reads as a drawn object
    rather than as a shape sitting on a dark slab.
    """
    H, W = len(grid), len(grid[0])
    edge = []
    for y in range(H):
        for x in range(W):
            if grid[y][x] < 0:
                continue
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                ny, nx = y + dy, x + dx
                if ny < 0 or nx < 0 or ny >= H or nx >= W or grid[ny][nx] < 0:
                    edge.append((y, x))
                    break
    for y, x in edge:
        grid[y][x] = slot
    return grid


AMPHORA_W = 21
AMPHORA_SPANS = [
    (6, 14), (6, 14),                               # lip
    (8, 12), (8, 12), (8, 12),                      # neck
    (7, 13), (6, 14), (5, 15), (5, 15),             # shoulder
    (4, 16), (4, 16), (4, 16), (4, 16), (4, 16),    # belly
    (5, 15), (5, 15), (6, 14), (7, 13),             # taper
    (8, 12), (8, 12), (8, 12),                      # stem
    (7, 13), (6, 14),                               # foot
]
# Two pixels thick throughout: a one-pixel handle reads as a stray line.
AMPHORA_HANDLES = [(5, 5), (5, 6), (6, 4), (6, 5), (7, 3), (7, 4), (8, 3), (8, 4),
                   (9, 3), (9, 4),
                   (5, 14), (5, 15), (6, 15), (6, 16), (7, 16), (7, 17),
                   (8, 16), (8, 17), (9, 16), (9, 17)]

SCARAB_W = 19
# A beetle is widest high, at the pronotum, and tapers to a point at the tail.
# Widest in the middle reads as a lozenge, which is what the first attempt was.
SCARAB_SPANS = [
    (7, 11), (7, 11),                               # head
    (5, 13), (3, 15), (3, 15),                      # pronotum, the widest point
    (2, 16), (2, 16), (2, 16),                      # elytra shoulders
    (3, 15), (3, 15), (3, 15), (3, 15),
    (4, 14), (4, 14), (4, 14),
    (5, 13), (5, 13), (6, 12), (7, 11), (8, 10),    # tapering to the tail
]
# Each leg runs unbroken from the body outward and is two rows deep. Detached
# dashes and one-pixel limbs read as specks, not as legs.
SCARAB_LEGS = [(5, 0), (5, 1), (6, 0), (6, 1),
               (9, 1), (9, 2), (10, 1), (10, 2),
               (13, 2), (13, 3), (14, 2), (14, 3),
               (5, 17), (5, 18), (6, 17), (6, 18),
               (9, 16), (9, 17), (10, 16), (10, 17),
               (13, 15), (13, 16), (14, 15), (14, 16)]

COLUMN_W = 17
COLUMN_SPANS = ([(2, 14)] * 4 + [(3, 13)] * 18 + [(2, 14)] * 4)

# ---------------------------------------------------------------- ramps
# Hue-shifted: shadows drift cool, highlights drift warm. That drift, not the
# change in value, is what makes a ramp read as light on a form.

RAMPS = {
    # 1 outline (cool, near purple)  2 shadow  3 mid  4 light  5 highlight (warm)
    # 6 bone   7 black-figure
    "amphora": [(46, 30, 40), (108, 52, 52), (158, 84, 54), (198, 122, 72),
                (234, 174, 110), (238, 224, 190), (32, 26, 32)],
    # 1 outline  2 bronze shadow  3 gold mid  4 gold light  5 gold highlight
    # 6 lapis mid  7 lapis light
    "scarab":  [(38, 28, 44), (110, 78, 40), (168, 128, 56), (208, 170, 84),
                (242, 214, 140), (44, 56, 104), (78, 104, 158)],
    # 1 outline  2 deep shadow  3 flute shadow  4 stone mid  5 stone light
    "column":  [(44, 40, 52), (96, 92, 104), (140, 136, 140), (186, 182, 176),
                (226, 222, 210)],
}

def build_grid(key):
    """Silhouette, then interior shading, then authored detail, then contour."""
    if key == "amphora":
        W, spans = AMPHORA_W, AMPHORA_SPANS
    elif key == "scarab":
        W, spans = SCARAB_W, SCARAB_SPANS
    else:
        W, spans = COLUMN_W, COLUMN_SPANS

    H = len(spans)
    grid = [[-1] * W for _ in range(H)]
    for y, span in enumerate(spans):
        for x, slot in bands(span).items():
            grid[y][x] = slot

    if key == "amphora":
        for y, x in AMPHORA_HANDLES:
            grid[y][x] = 3
        for y in (0, 1, 21, 22):                 # lip and foot in bone
            for x in range(W):
                if grid[y][x] >= 0:
                    grid[y][x] = 5
        for y in (11, 12):                       # the black-figure band
            for x in range(W):
                if grid[y][x] >= 0:
                    grid[y][x] = 6
        for x in range(6, 15, 3):                # a meander picked out in bone
            grid[11][x] = 5
            grid[12][min(W - 1, x + 1)] = 5

    if key == "scarab":
        for y, x in SCARAB_LEGS:
            grid[y][x] = 1
        for y in range(5, 18):                   # the seam between wing cases
            if grid[y][9] >= 0:
                grid[y][9] = 1
        for y in (7, 8, 11, 12):                 # lapis inlay bands
            for x in range(4, 15):
                if grid[y][x] >= 0 and x != 9:
                    grid[y][x] = 5 if 6 <= x <= 12 else 6

    if key == "column":
        # Flutes as hard steps, two pixels of stone between each groove.
        flute = [3, 4, 2, 3, 4, 2, 3, 4, 2, 3, 4]
        for y in range(4, 22):
            for x in range(3, 14):
                if grid[y][x] >= 0:
                    grid[y][x] = flute[x - 3]
        for y in (2, 23):                        # the shadow under each moulding
            for x in range(W):
                if grid[y][x] >= 0:
                    grid[y][x] = 1

    return outline(grid)


SPRITES = [("amphora", "Amphora"), ("scarab", "Scarab"), ("column", "Column")]

NOTES = {
    "amphora": "A storage jar in terracotta and black-figure, 21 x 26. The ramp shifts "
               "hue as well as value — the shadow leans purple, the highlight leans warm "
               "ochre — which is what stops a curved body reading as flat clip art.",
    "scarab": "A gold amulet with lapis inlay, 19 x 22. Gold is the collection's ochres. "
              "Blue is 8% of these colours, so it is spent on the inlay rather than a field.",
    "column": "A fluted Doric shaft, 17 x 26. Limestone is the collection's deepest seam, "
              "so the flutes can be cut as hard two-pixel steps rather than a gradient.",
}


def check(rows, name):
    width = len(rows[0])
    for i, row in enumerate(rows):
        if len(row) != width:
            sys.exit(f"{name}: row {i} is {len(row)} wide, expected {width}\n  {row!r}")
    return width


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()

    if not DB_PATH.exists():
        sys.exit(f"{DB_PATH} not found.")
    colors = open_colors(DB_PATH)

    objects = []
    for key, name in SPRITES:
        ramp = RAMPS[key]
        grid = build_grid(key)
        width = len(grid[0])
        used = sorted({v for row in grid for v in row if v >= 0})
        if used and used[-1] >= len(ramp):
            sys.exit(f"{key}: sprite uses slot {used[-1] + 1} but the ramp has {len(ramp)}")

        cycles, tols = [], []
        for target in ramp:
            cycle, tol = slot_cycle(colors, target, SLOT_MIN, SLOT_MAX)
            cycles.append(cycle)
            tols.append(tol)
        print(f"  {name}: {width}x{len(grid)}, {len(ramp)} slots, "
              f"{[len(c) for c in cycles]} colours (tol {tols})")
        objects.append({"key": key, "name": name, "cols": width, "rows": len(grid),
                        "grid": grid, "cycles": cycles, "note": NOTES[key]})

    if args.preview:
        for obj in objects:
            B = 14
            img = Image.new("RGB", (obj["cols"] * B, obj["rows"] * B), (231, 228, 221))
            px = img.load()
            for y, row in enumerate(obj["grid"]):
                for x, slot in enumerate(row):
                    if slot < 0:
                        continue
                    rgb = obj["cycles"][slot][0]["rgb"]
                    for dy in range(B):
                        for dx in range(B):
                            px[x * B + dx, y * B + dy] = rgb
            img.save(ROOT / f"preview_{obj['key']}.png")
        print("wrote previews")
        return

    artworks, artwork_index, palette, palette_index = [], {}, [], {}
    for obj in objects:
        packed = []
        for cycle in obj["cycles"]:
            ids = []
            for c in cycle:
                if c["id"] not in artwork_index:
                    artwork_index[c["id"]] = len(artworks)
                    artworks.append([c["id"], c["title"], c["artist"]])
                key2 = (c["hex"], c["id"])
                if key2 not in palette_index:
                    palette_index[key2] = len(palette)
                    palette.append([c["hex"], artwork_index[c["id"]]])
                ids.append(palette_index[key2])
            packed.append(ids)
        obj["cycles"] = packed

    OUT_PATH.write_text(json.dumps({
        "cycleSteps": CYCLE_STEPS, "artworks": artworks,
        "palette": palette, "objects": objects,
    }, separators=(",", ":")))
    print(f"Wrote {OUT_PATH} ({OUT_PATH.stat().st_size/1000:.0f} KB, "
          f"{len(palette)} colours across {len(artworks)} works)")


if __name__ == "__main__":
    main()
