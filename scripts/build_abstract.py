#!/usr/bin/env python3
"""Five abstract panels, one per Karl Gerstner composition, in his grammar.

Read off the works themselves, the grammar is narrow and strict: flat colour
only — no shading, no gradient, no outline; a modular grid subdivided
systematically rather than composed by eye; nested concentric bands;
self-similarity, the motif recurring at a smaller scale inside itself; few hues
in even steps; and order by permutation, not by taste.

One panel per composition:

  1. Colour Sound      — nested square rings on a blue-grey ground, with an
                         arch carved out of the amber core.
  2. St. Jaques        — a lobed fan of nested bands on an orange field, on a
                         stem. The lobes come from modulating the radius by
                         angle, so the nesting stays exact.
  3. Colour Fractal    — true recursion: one disc holds four discs, each of
                         which holds four discs, each of which holds four
                         squares.
  4. Spannungsbild     — a violet field lit from four points on its edges,
                         inside a black surround, around a near-black square.
  5. Chromorphose      — stacked bars: black, a stepped grey ramp, cream, and a
                         red block banded across the join.

Palettes are taken from the works and matched to the nearest real colours in
the collection however few there are — the picture first, the census second.
Some of it is out of reach and comes out earthier: St. Jaques' orange has no
match within tolerance 16 in 14,542 dominant colours, where its dark frame has
166 and Chromorphose's cream has 240.

Writes data/abstract.json.

Usage:
    python3 scripts/build_abstract.py
    python3 scripts/build_abstract.py --preview
"""

import argparse
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from motion import open_colors, slot_cycle    # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "artworks.db"
OUT_PATH = ROOT / "data" / "abstract.json"

CYCLE_STEPS = 48
# The picture first: a step may be backed by very few works if that is all the
# collection honestly holds near it.
SLOT_MIN = 6
SLOT_MAX = 24


def grid(w, h, fill=0):
    return [[fill] * w for _ in range(h)]


# ------------------------------------------------------------------ 1. Colour Sound
# Nested square rings in a modular grid, with an arch cut out of the core —
# the same construction at two scales, which is the self-similarity.

COLOUR_SOUND_RAMP = [
    (185, 201, 222),   # 0 blue-grey ground
    (238, 240, 246),   # 1 near-white
    (207, 186, 216),   # 2 lilac
    (244, 169, 118),   # 3 salmon
    (219, 165, 83),    # 4 amber
]


def colour_sound():
    W = H = 29
    g = grid(W, H, 0)
    # A 9 x 9 module of 2-pixel cells on a 3-pixel pitch: the ground shows
    # through the one-pixel gutter, which is what reads as the translucent
    # grid. Filling the module solid loses the grid and leaves a plain square.
    module, cell, pitch, off = 9, 2, 3, 1
    ring_slot = {4: 2, 3: 1, 2: 3, 1: 4, 0: 4}
    mid = module // 2
    for my in range(module):
        for mx in range(module):
            r = max(abs(mx - mid), abs(my - mid))
            slot = ring_slot[r]
            # The arch: a notch driven up into the amber core from below, which
            # is what turns a set of rings into a figure.
            if my >= mid + 1 and mx == mid:
                slot = 1 if r >= 3 else 2
            for dy in range(cell):
                for dx in range(cell):
                    g[off + my * pitch + dy][off + mx * pitch + dx] = slot
    return g, COLOUR_SOUND_RAMP


# ------------------------------------------------------------------ 2. St. Jaques
ST_JAQUES_RAMP = [
    (255, 121, 1),     # 0 orange field
    (82, 47, 24),      # 1 dark frame
    (225, 168, 213),   # 2 pink-lilac
    (246, 144, 130),   # 3 salmon-pink
    (249, 176, 190),   # 4 pink
    (232, 214, 236),   # 5 pale lilac
]


def st_jaques():
    W, H = 30, 34
    g = grid(W, H, 0)
    for x in range(W):                      # the frame is part of the work
        g[0][x] = g[H - 1][x] = 1
    for y in range(H):
        g[y][0] = g[y][W - 1] = 1

    cx, cy, base = 14.5, 26.0, 15.0
    bands = [2, 4, 3, 4, 5]                 # core outward, an even alternation
    inside = set()
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            dx, dy = x - cx, y - cy
            if dy > 0.5:
                continue
            r = math.hypot(dx, dy * 1.05)
            theta = math.atan2(-dy, dx)
            # Lobes are the radius modulated by angle, so every band stays
            # exactly nested inside the one outside it.
            edge = base * (1.0 + 0.085 * math.cos(5 * theta))
            if r > edge:
                continue
            g[y][x] = bands[min(len(bands) - 1, int(r / edge * len(bands)))]
            inside.add((x, y))

    for y in range(int(cy) - 2, H - 2):     # the stem
        for x in (int(cx), int(cx) + 1):
            g[y][x] = 2
            inside.add((x, y))
    for y in range(H):                      # the bulb it ends in
        for x in range(W):
            if (x - cx) ** 2 + ((y - (cy + 3.5)) * 1.1) ** 2 <= 6.0:
                g[y][x] = 2
                inside.add((x, y))
    # The seam only exists where there is fan to split; drawn unconditionally it
    # shoots a spike out of the top of the composition.
    for y in range(1, int(cy) + 4):
        if (int(cx) + 1, y) in inside:
            g[y][int(cx) + 1] = 5
    return g, ST_JAQUES_RAMP


# ------------------------------------------------------------------ 3. Colour Fractal
COLOUR_FRACTAL_RAMP = [
    (166, 160, 186),   # 0 grey-lilac ground
    # The ramp is pulled wider than the work's own, because the collection does
    # not separate #d3a0d5 from #e692c8 — both resolve to the same real mauves
    # and the middle rank of discs disappears into the disc holding it.
    (216, 196, 226),   # 1 pale lilac disc
    (206, 122, 166),   # 2 rose disc
    (249, 134, 137),   # 3 coral disc
    (251, 124, 97),    # 4 orange square
]


def colour_fractal():
    W = H = 33
    g = grid(W, H, 0)

    def disc(cx, cy, r, slot):
        for y in range(H):
            for x in range(W):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    g[y][x] = slot

    disc(16, 17, 15.6, 1)   # 16.0 leaves a single orphan pixel at the crown
    # Each disc holds four discs; each of those holds four discs; each of those
    # holds four squares. The rule is written once and applied three times.
    for ox, oy in ((-7.5, -7.5), (7.5, -7.5), (-7.5, 7.5), (7.5, 7.5)):
        px, py = 16 + ox, 17 + oy
        disc(px, py, 5.8, 2)
        # Radii kept well inside their offsets. At r=2.6 on a 2.9 offset the four
        # discs touch and the cluster reads as one square, which destroys the
        # recursion the whole panel is about.
        for ix, iy in ((-3.2, -3.2), (3.2, -3.2), (-3.2, 3.2), (3.2, 3.2)):
            qx, qy = px + ix, py + iy
            disc(qx, qy, 1.8, 3)
            for sx, sy in ((-1, -1), (0, -1), (-1, 0), (0, 0)):
                x, y = int(qx) + sx, int(qy) + sy
                if 0 <= x < W and 0 <= y < H:
                    g[y][x] = 4
    return g, COLOUR_FRACTAL_RAMP


# ------------------------------------------------------------------ 4. Spannungsbild
SPANNUNGSBILD_RAMP = [
    (20, 20, 22),      # 0 black surround
    (9, 10, 85),       # 1 deep blue
    (46, 40, 104),     # 2 blue-violet
    (61, 51, 126),     # 3 violet
    (98, 57, 180),     # 4 bright violet
    (24, 21, 38),      # 5 the near-black square
]


def spannungsbild():
    W = H = 28
    g = grid(W, H, 0)
    lo, hi = 5, W - 5
    # Four point sources on the edges of the field. Distance to the nearest one
    # steps the violet: brightest at the pinch points, deepest between them.
    sources = [((lo + hi) / 2, lo), ((lo + hi) / 2, hi - 1), (lo, (lo + hi) / 2),
               (hi - 1, (lo + hi) / 2)]
    span = (hi - lo) / 2
    for y in range(lo, hi):
        for x in range(lo, hi):
            d = min(math.hypot(x - sx, y - sy) for sx, sy in sources)
            g[y][x] = [4, 3, 2, 1][min(3, int(d / span * 4))]
    for y in range(10, 18):                 # the square the tension is around
        for x in range(10, 18):
            g[y][x] = 5
    return g, SPANNUNGSBILD_RAMP


# ------------------------------------------------------------------ 5. Chromorphose
CHROMORPHOSE_RAMP = [
    (243, 243, 243),   # 0 white ground
    (28, 26, 24),      # 1 black bar
    (92, 90, 80),      # 2 grey
    (150, 146, 118),   # 3 olive-grey
    (231, 220, 176),   # 4 cream
    (146, 30, 20),     # 5 deep red
    (192, 48, 24),     # 6 red
    (224, 96, 24),     # 7 orange
]


def chromorphose():
    W, H = 26, 34
    g = grid(W, H, 0)
    for y in range(2, 30):                  # black bar
        for x in range(4, 11):
            g[y][x] = 1
    for y in range(2, 30):                  # a stepped ramp, not a gradient
        for i, x in enumerate(range(11, 15)):
            g[y][x] = [2, 3, 3, 4][i]
    for y in range(2, 27):                  # cream bar
        for x in range(15, 22):
            g[y][x] = 4
    for y in range(18, 31):                 # the red block, banded across
        for x in range(6, 21):
            g[y][x] = [5, 5, 6, 6, 7, 7, 6, 6, 5, 5, 6, 6, 7, 7, 6][x - 6]
    for y in range(26, 31):                 # the notch cut up out of it
        for x in range(11, 14):
            g[y][x] = 0
    return g, CHROMORPHOSE_RAMP


PANELS = [
    ("colour-sound", "Colour Sound", colour_sound),
    ("st-jaques", "St. Jaques", st_jaques),
    ("colour-fractal", "Colour Fractal", colour_fractal),
    ("spannungsbild", "Spannungsbild", spannungsbild),
    ("chromorphose", "Chromorphose", chromorphose),
]


# The panel builders, reachable by key, so the isometric build can lift the same
# compositions into the floor without duplicating a single construction.
PANELS_BY_KEY = [(key, (lambda m=make: m())) for key, _name, make in PANELS]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()

    if not DB_PATH.exists():
        sys.exit(f"{DB_PATH} not found.")
    colors = open_colors(DB_PATH)

    objects, built_cycles = [], []
    for key, name, make in PANELS:
        g, ramp = make()
        used = sorted({v for row in g for v in row})
        if used[-1] >= len(ramp):
            sys.exit(f"{key}: uses slot {used[-1]} but the ramp has {len(ramp)}")
        cycles, tols = [], []
        for target in ramp:
            cycle, tol = slot_cycle(colors, target, SLOT_MIN, SLOT_MAX,
                                    tol_start=12, tol_stop=90)
            cycles.append(cycle)
            tols.append(tol)
        works = len({c["id"] for cyc in cycles for c in cyc})
        print(f"  {name:16s} {len(g[0])}x{len(g)}, {len(ramp)} steps, "
              f"{[len(c) for c in cycles]} colours (tol {tols}) — {works} works")
        objects.append({"key": key, "name": name, "cols": len(g[0]), "rows": len(g),
                        "grid": g})
        built_cycles.append(cycles)

    if args.preview:
        from PIL import Image
        for obj, cycles in zip(objects, built_cycles):
            B = 14
            img = Image.new("RGB", (obj["cols"] * B, obj["rows"] * B))
            px = img.load()
            for y, row in enumerate(obj["grid"]):
                for x, slot in enumerate(row):
                    rgb = cycles[slot][0]["rgb"]
                    for dy in range(B):
                        for dx in range(B):
                            px[x * B + dx, y * B + dy] = rgb
            img.save(ROOT / f"preview_{obj['key']}.png")
        print("wrote previews")
        return

    artworks, artwork_index, palette, palette_index = [], {}, [], {}
    for obj, cycles in zip(objects, built_cycles):
        packed = []
        for cycle in cycles:
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
