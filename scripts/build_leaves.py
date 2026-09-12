#!/usr/bin/env python3
"""Falling leaves — the second member of the descent family, after the waterfall.

Same event, different payload. Water falls as a continuous sheet, so it is drawn
as a field and stored as one grid per frame. Leaves fall as discrete bodies, so
they are stored as a PROGRAM: a handful of leaf sprites, a static bough, and one
short track per leaf. The renderer replays it.

That is the whole point of grouping objects by motion. Stored the waterfall's
way — 28 x 38 palette indices for each of 120 frames — this animation would be
about 2 MB. Stored as its family's program it is roughly 20 KB, and every future
descent object costs only its own tracks.

Everything is periodic by construction so the loop closes exactly: each leaf
falls a whole number of times over the loop, sways a whole number of cycles, and
yaws through a whole number of turns.

Palette: autumn, because that is what this collection is made of — 33.8% of its
dominant colours are earth tones. Rust, amber and gold are the deepest seams it
has, so leaves can be rendered with more honest colour than almost anything else.

Writes data/leaves.json.

Usage:
    python3 scripts/build_leaves.py
    python3 scripts/build_leaves.py --preview 6
"""

import argparse
import json
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from motion import open_colors, slot_cycle    # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "artworks.db"
OUT_PATH = ROOT / "data" / "leaves.json"

COLS = 28
ROWS = 38                # the descent family's shared stage, same as the waterfall
FRAMES = 120
FRAME_MS = 300           # leaves are slower than water but yaw as they go
MARGIN = 8               # leaves enter from above the frame
WRAP = ROWS + MARGIN
CYCLE_STEPS = 48
SEED = 23

# Hue-shifted the same way the sprites are: the shadow of a red leaf leans
# toward its own deep crimson, the highlight toward gold.
RAMP = [
    (46, 32, 30),    # 0  bark shadow
    (92, 60, 44),    # 1  bark
    (120, 46, 38),   # 2  deep red
    (168, 80, 44),   # 3  rust
    (208, 132, 56),  # 4  amber
    (240, 192, 112), # 5  gold
    (112, 108, 56),  # 6  olive
    (150, 144, 74),  # 7  olive light
]

# (shadow, mid, light) into the ramp. One leaf holds one tint for the whole loop —
# a leaf that changes colour mid-fall reads as a glitch, not as a leaf.
TINTS = [(2, 3, 4), (3, 4, 5), (2, 4, 5), (6, 7, 5)]

# Leaf sprites, as relative slots: 0 shadow, 1 mid, 2 light, -1 hole. A leaf
# turning in the air presents its face, then its three-quarter, then its edge,
# then the other three-quarter — so four shapes are a full yaw.
SHAPES = [
    # face on
    [[-1, 1, 1, -1],
     [ 0, 1, 2,  2],
     [-1, 0, 1, -1]],
    # three-quarter
    [[-1, 1, 2],
     [ 0, 1, 2],
     [-1, 0, -1]],
    # edge on: two pixels deep, never one — a one-pixel leaf reads as dust
    [[0, 1],
     [0, 2]],
    # the other three-quarter
    [[ 2, 1, -1],
     [ 2, 1,  0],
     [-1, 0, -1]],
]

LEAVES = 34
FALL_STEPS = (40, 60, 120)   # frames to cross the stage; each divides FRAMES
SWAY_CYCLES = (1, 2, 3)
YAW_TURNS = (1, 2)


def build_bough():
    """A limb sloping down across the top, with two twigs and a few leaves left.

    Drawn as a slope rather than a bar: a horizontal limb with vertical stubs
    reads as a table, which is exactly what the first attempt looked like. Part
    of the object, not a background — it is what the falling leaves fell off,
    and it is clickable like everything else.
    """
    cells = {}
    # Tapering to nothing before the right edge, so it reads as a branch coming
    # in from off-frame rather than as a beam spanning the whole picture.
    for x in range(COLS):
        top = 0.10 * x
        thick = 3.4 - 0.105 * x
        if thick < 0.3:
            break
        for y in range(int(top), int(top + max(thick, 0.9)) + 1):
            if y >= ROWS:
                continue
            # Underside in shadow, top edge catching light.
            cells[(x, y)] = 0 if y >= int(top + thick) else 1

    # Twigs angle away from the limb. Two pixels wide, so they read as wood
    # rather than as scratches.
    twigs = []
    for x0, drop, lean in ((7, 6, 0.5), (19, 5, -0.4)):
        y0 = int(0.10 * x0 + 3)
        for i in range(drop):
            x = int(round(x0 + lean * i))
            y = y0 + i
            if 0 <= x < COLS - 1 and y < ROWS:
                cells[(x, y)] = 0
                cells[(x + 1, y)] = 1
        twigs.append((int(round(x0 + lean * (drop - 1))), y0 + drop - 1))

    # A few leaves still hanging, so the fall has a visible source.
    for i, (tx, ty) in enumerate(twigs):
        stamp(cells, SHAPES[(i + 1) % len(SHAPES)], tx - 1, ty, TINTS[i % len(TINTS)])
    return cells


def stamp(cells, shape, x, y, tint):
    for dy, row in enumerate(shape):
        for dx, rel in enumerate(row):
            if rel < 0:
                continue
            cx, cy = x + dx, y + dy
            if 0 <= cx < COLS and 0 <= cy < ROWS:
                cells[(cx, cy)] = tint[rel]


def build_leaves(rng):
    tracks = []
    # One leaf per column band, jittered inside it. Pure random x piles them on
    # one side and leaves the other empty, which reads as a spill, not a fall.
    band = (COLS - 4.0) / LEAVES
    order = list(range(LEAVES))
    rng.shuffle(order)
    for i in range(LEAVES):
        steps = FALL_STEPS[rng.randrange(len(FALL_STEPS))]
        tracks.append({
            "x": round(0.5 + order[i] * band + rng.uniform(0, band), 2),
            "y0": rng.randrange(WRAP),          # phase down the wrap
            "vy": round(WRAP / steps, 4),       # whole falls per loop, so it wraps clean
            "amp": round(rng.uniform(0.7, 2.2), 2),
            "cyc": SWAY_CYCLES[rng.randrange(len(SWAY_CYCLES))],
            "ph": round(rng.random(), 3),
            "yaw": YAW_TURNS[rng.randrange(len(YAW_TURNS))],
            "yph": rng.randrange(len(SHAPES)),
            "tint": rng.randrange(len(TINTS)),
        })
    # Far leaves drawn first, near leaves last, so overlaps read as depth.
    tracks.sort(key=lambda t: t["vy"])
    return tracks


def frame_cells(bough, tracks, f):
    """One frame, exactly as the renderer will compute it."""
    cells = dict(bough)
    for t in tracks:
        y = (t["y0"] + t["vy"] * f) % WRAP - MARGIN
        x = t["x"] + t["amp"] * math.sin(2 * math.pi * (t["cyc"] * f / FRAMES + t["ph"]))
        shape = SHAPES[int(t["yaw"] * f * len(SHAPES) / FRAMES + t["yph"]) % len(SHAPES)]
        stamp(cells, shape, int(round(x)), int(math.floor(y)), TINTS[t["tint"]])
    return cells


NOTE = ("Leaves off a bough, 28 x 38 — the waterfall's stage, because they are the "
        "same motion. The difference is what falls: water is a sheet, so it is stored "
        "as pictures; leaves are bodies, so this is stored as thirty-four tracks and "
        "four sprites and rebuilt on the fly. Autumn because the collection is 33.8% "
        "earth tones — rust and amber are the deepest colour it has.")

BUILT = {
    "grid": "28 x 38 x 120 frames, replayed from 34 tracks",
    "ramp": "8 steps: 2 bark, deep red, rust, amber, gold, 2 olive",
    "backing": "filled in at build time",
    "lessons": [
        "Kin objects should share stored FORM, not just build code. As frames this "
        "would be ~2 MB; as its family's program it is ~20 KB, and the next falling "
        "thing costs only its tracks.",
        "A leaf holds one tint for the whole fall. Letting the colour drift mid-air, "
        "the way the waterfall's hue band drifts, reads as a glitch rather than as "
        "a leaf — the sheet can drift because it is one continuous body.",
        "Every period has to divide the loop: whole falls, whole sway cycles, whole "
        "yaws. One leaf out of phase and the seam is the only thing you can see.",
        "Edge-on, a leaf is still two pixels deep. At one pixel it reads as dust.",
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
        cycle, tol = slot_cycle(colors, target)
        cycles.append(cycle)
        tols.append(tol)
    print(f"  Falling Leaves: {COLS}x{ROWS}x{FRAMES}, {len(RAMP)} steps, "
          f"{[len(c) for c in cycles]} colours (tol {tols})")
    BUILT["backing"] = (f"{min(len(c) for c in cycles)}-{max(len(c) for c in cycles)} "
                        "real colours per step")

    rng = random.Random(SEED)
    bough = build_bough()
    tracks = build_leaves(rng)

    if args.preview:
        from PIL import Image
        B = 12
        for i in range(args.preview):
            f = i * (FRAMES // args.preview)
            img = Image.new("RGB", (COLS * B, ROWS * B), (231, 228, 221))
            px = img.load()
            for (x, y), slot in frame_cells(bough, tracks, f).items():
                rgb = cycles[slot][0]["rgb"]
                for dy in range(B):
                    for dx in range(B):
                        px[x * B + dx, y * B + dy] = rgb
            img.save(ROOT / f"preview_leaves_{i:02d}.png")
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
            "key": "leaves", "name": "Falling Leaves", "kind": "descent",
            "cols": COLS, "rows": ROWS, "frames": FRAMES, "frameMs": FRAME_MS,
            "wrap": WRAP, "margin": MARGIN,
            "shapes": SHAPES, "tints": TINTS,
            "static": [[x, y, s] for (x, y), s in sorted(bough.items())],
            "tracks": tracks, "cycles": packed,
            "note": NOTE, "built": BUILT,
        }],
    }, separators=(",", ":")))
    print(f"Wrote {OUT_PATH} ({OUT_PATH.stat().st_size/1000:.0f} KB, "
          f"{len(palette)} colours across {len(artworks)} works)")


if __name__ == "__main__":
    main()
