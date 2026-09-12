#!/usr/bin/env python3
"""Every object rebuilt as an isometric voxel model.

The flat objects were grids of cells. Isometric makes that impossible — a thing
seen from a corner has three visible faces — so each one becomes a voxel model
and `scripts/iso.py` projects it. Nothing here is drawn by hand in isometric:
the existing silhouettes are lifted into three dimensions and the projection
does the rest, which is the point. A drawn isometric sprite has to be redrawn
for every facing; a model is turned for free.

How each family converts:

  vessels   Solids of revolution. The amphora and the column already *are*
            profiles — a half-width per row — so `revolve` lifts them at no
            cost. The scarab is bilaterally symmetric rather than round, so it
            is extruded under a domed height profile instead.
  panels    The five Gerstner works are flat by definition, so they are laid
            into the ground as mosaic floors. That is not a demotion: they were
            always modular grids, and a modular grid set into a floor is what
            the grammar is for. Standing them upright would foreshorten the
            composition into illegibility.
  descent   Water and leaves gain a third axis. The fall becomes a sheet with
            depth; the leaves become bodies at real (x, y, z).
  bounce    A ball, which the motion axis declared and left empty.

Output is REGION grids. Every contiguous patch of one ramp step is found by
connected-component labelling and given its own artwork, permanently.

That is a change of unit. Colour used to be carried per ramp step, so every
patch at the same step anywhere in the picture was the same work, and the whole
picture only ever held as many works as the ramp had steps — eleven. A patch is
the thing the eye actually reads as a shape, so a patch is what should carry an
identity: the waterfall now holds hundreds of works instead of eleven, and
pressing one reaches the work behind that shape rather than behind that tone.

Each region draws from the colours nearest its own step, so the picture looks
the same — with a little more variation between neighbouring patches, which is
what real pigment does anyway. The link is fixed: one region, one work, no
cycling. Colour no longer drifts over time, because a link that moves is not a
link.

Every object is stored at all FOUR facings — the four corners an isometric view
can be taken from — because a quarter turn is a permutation of x and y and costs
nothing to compute. Views and frames are separate axes: `cells[view][frame]`. A
still object has one frame per view; a moving one has its whole animation at
each. That is four times the grids for a moving object, and it is what lets the
viewer walk around the thing instead of being stuck at the corner it was drawn
from.

Writes data/iso.json.

Usage:
    python3 scripts/build_iso.py
    python3 scripts/build_iso.py --preview
"""

import argparse
import json
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import iso                                              # noqa: E402
from motion import open_colors, slot_cycle              # noqa: E402
from build_sprites import (AMPHORA_SPANS, COLUMN_SPANS, AMPHORA_W,  # noqa: E402
                           build_grid, RAMPS)
import build_abstract as abstract                       # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "artworks.db"
OUT_PATH = ROOT / "data" / "iso.json"

iso.SCALE = 2.0            # projected length of one voxel edge, in pixels
CYCLE_STEPS = 48
SLOT_MIN, SLOT_MAX = 6, 24
SEED = 19

# Every ramp is [4 ground steps] + [7 body steps]. The ground's material sits at
# index 1 so that a flat top face — which shades +2 — still lands inside its own
# four steps; a body material at 8 has the full +/-2 of normal shading to spend
# without running off either end.
GROUND_MATERIAL = 1
BODY_MATERIAL = 8
GROUND = [(34, 31, 28), (66, 61, 56), (102, 96, 88), (140, 133, 122)]


def ramp(body):
    """Ground steps, then a body ramp of seven."""
    return GROUND + body


def profile_from_spans(spans, width, scale=1.0, layers=2):
    """A silhouette's half-width per row becomes a radius per height.

    `layers` repeats each row, because the flat sprites were drawn at a
    resolution where one row of pixels stood for a band of the real object; at
    one voxel per row the solid comes out squat.
    """
    out = []
    for i, (first, last) in enumerate(reversed(spans)):
        radius = (last - first + 1) / 2.0 * scale
        for k in range(layers):
            out.append((i * layers + k, radius))
    return out


def extrude(spans, width, depth_profile, material=BODY_MATERIAL, scale=2):
    """A bilaterally symmetric silhouette given depth — for the scarab, which is
    a body with a back, not a thing turned on a lathe.

    Scaled up in plan before doming. At one voxel per pixel of the original
    sprite the silhouette is only nineteen across, and a dome that tall over a
    footprint that small swallows the outline completely: it came out as a
    featureless lump. Widening the plan and flattening the dome keeps the
    beetle readable from above, which is how an amulet is meant to be seen.
    """
    out = {}
    rows = len(spans)
    for i, (first, last) in enumerate(reversed(spans)):
        for x in range(first, last + 1):
            across = abs(x - width / 2.0) / (width / 2.0)
            along = abs(i - rows / 2.0) / (rows / 2.0)
            dome = depth_profile * math.sqrt(max(0.0, 1.0 - across ** 2 * 0.75 - along ** 2 * 0.55))
            for sx in range(scale):
                for sy in range(scale):
                    px = (x - width // 2) * scale + sx
                    py = (i - rows // 2) * scale + sy
                    for z in range(max(1, int(round(dome)))):
                        out[(px, py, z)] = (material, False)
    return out


# ----------------------------------------------------------------- objects

VESSELS = {
    "amphora": (AMPHORA_SPANS, AMPHORA_W, 1.9,
                [(44, 28, 34), (96, 52, 46), (150, 80, 52), (196, 118, 70),
                 (228, 166, 110), (244, 214, 172), (252, 242, 216)]),
    "column":  (COLUMN_SPANS, 17, 2.1,
                [(46, 42, 52), (88, 84, 92), (128, 124, 128), (166, 162, 162),
                 (198, 194, 190), (224, 220, 214), (242, 239, 232)]),
}

SCARAB_RAMP = [(40, 30, 44), (96, 70, 40), (150, 112, 52), (194, 152, 74),
               (230, 196, 130), (246, 226, 180), (252, 244, 220)]

BALL_RAMP = [(16, 30, 64), (30, 60, 118), (52, 98, 176), (84, 140, 216),
             (128, 180, 238), (186, 218, 248), (232, 244, 254)]

LEAF_RAMP = [(56, 32, 26), (104, 50, 34), (156, 82, 40), (196, 124, 56),
             (226, 170, 96), (242, 210, 152), (250, 236, 204)]

WATER_RAMP = [(10, 26, 58), (24, 58, 118), (44, 96, 176), (78, 140, 216),
              (126, 182, 238), (188, 220, 248), (236, 248, 254)]


def vessel(key):
    spans, width, scale, body = VESSELS[key]
    prof = profile_from_spans(spans, width, scale)
    return iso.revolve(prof, material=BODY_MATERIAL), iso.revolve_normals(prof), ramp(body)


def scarab():
    """Built from the flat sprite's own slot grid, not just its outline.

    The silhouette alone extrudes into a featureless pebble. All of what makes
    it a scarab — the seam between the wing cases, the legs, the lapis inlay —
    lives in the sprite's interior slots, so those are carried up into the
    model and each cell keeps its own material under the dome. The shape is
    three-dimensional; the drawing on it is the one that already worked.
    """
    grid = build_grid("scarab")
    h, w = len(grid), len(grid[0])
    steps = len(RAMPS["scarab"])
    vox = {}
    for y, row in enumerate(grid):
        for x, slot in enumerate(row):
            if slot < 0:
                continue
            across = abs(x - w / 2.0) / (w / 2.0)
            along = abs(y - h / 2.0) / (h / 2.0)
            dome = 5.0 * math.sqrt(max(0.0, 1.0 - across ** 2 * 0.8 - along ** 2 * 0.6))
            # Subtract the flat-face shading so a top face lands back on the
            # sprite's own step, exactly as the mosaics do.
            material = len(GROUND) + slot - iso.SHADE_RANGE
            for sx in range(2):
                for sy in range(2):
                    px, py = (x - w // 2) * 2 + sx, (y - h // 2) * 2 + sy
                    for z in range(max(1, int(round(dome)))):
                        vox[(px, py, z)] = (material, False)
    return vox, None, ramp(list(RAMPS["scarab"])[:steps])


def panel(key):
    """A Gerstner composition set into the floor, one voxel thick.

    The panel's own slots are laid straight into the ground band, so the
    composition keeps its exact steps rather than being re-lit; a flat mosaic
    lit by a normal is just the mosaic, dimmed.
    """
    build = dict(abstract.PANELS_BY_KEY)[key]
    grid, prim = build()
    steps = sorted({v for row in grid for v in row})
    h, w = len(grid), len(grid[0])
    vox, norm = {}, {}
    for y, row in enumerate(grid):
        for x, slot in enumerate(row):
            key3 = (x - w // 2, y - h // 2, 0)
            # Every tile is flat, so every tile shades by exactly the same
            # +2. Subtracting it here means the lit result lands back on the
            # composition's own step: the mosaic keeps its exact colours
            # instead of being uniformly brightened off the end of its ramp.
            vox[key3] = (len(GROUND) + steps.index(slot) - iso.SHADE_RANGE, False)
            norm[key3] = (0.0, 0.0, 1.0)
    return vox, norm, GROUND + [tuple(c) for c in prim]


def with_ground(vox, norm, half, shadow=None):
    """Set the model on its ruled platform and take its shadow."""
    plane = iso.ground_plane(half, material=GROUND_MATERIAL, grid_every=4)
    if shadow:
        plane = iso.cast_shadow(plane, shadow[0], shadow[1], darken=1)
    merged = {**plane, **vox}
    normals = dict(norm or {})
    for k in plane:
        normals[k] = (0.0, 0.0, 1.0)
    return merged, normals


def plan_half(vox, margin=3):
    reach = max(max(abs(k[0]), abs(k[1])) for k in vox) if vox else 4
    return int(reach) + margin


# ----------------------------------------------------------------- animation

def ball_frames(n=12):
    out, radius = [], 7.0
    for f in range(n):
        t = f / n
        height = abs(math.sin(math.pi * t)) * 22
        impact = max(0.0, 1.0 - abs(t) * 7) + max(0.0, 1.0 - abs(t - 1.0) * 7)
        rise = 1.0 + 0.20 * (1 - abs(math.cos(math.pi * t)))
        rz = radius * max(1.0 - 0.38 * impact, 0.45) * rise
        rxy = radius * (1.0 + 0.26 * impact) / rise ** 0.35
        centre = (0, 0, int(round(height + rz)))
        vox = iso.ellipsoid(rxy, rxy, rz, material=BODY_MATERIAL, centre=centre)
        norm = iso.ellipsoid_normals(rxy, rxy, rz, centre=centre)
        out.append(with_ground(vox, norm, 11, shadow=(rxy * 0.85, height)))
    return out, ramp(BALL_RAMP)


LEAF = [(0, 0, 0), (1, 0, 0), (0, 1, 0), (1, 1, 0), (2, 1, 0), (-1, 0, 0)]


def leaf_frames(n=12, count=26, rng=None):
    rng = rng or random.Random(SEED)
    tracks = []
    for _ in range(count):
        tracks.append({
            "x": rng.uniform(-9, 9), "y": rng.uniform(-9, 9),
            "z0": rng.uniform(0, 30), "fall": rng.choice((30.0, 15.0)),
            "amp": rng.uniform(0.8, 2.4), "cyc": rng.choice((1, 2)),
            "ph": rng.random(), "turn": rng.randrange(4),
        })
    out = []
    for f in range(n):
        t = f / n
        vox = {}
        for tr in tracks:
            z = (tr["z0"] - tr["fall"] * t) % 30
            sway = tr["amp"] * math.sin(2 * math.pi * (tr["cyc"] * t + tr["ph"]))
            ox, oy = int(round(tr["x"] + sway)), int(round(tr["y"] + sway * 0.6))
            spin = (tr["turn"] + int(t * 4)) % 4
            for (lx, ly, lz) in LEAF:
                for _ in range(spin):
                    lx, ly = -ly, lx
                vox[(ox + lx, oy + ly, int(z) + lz)] = (BODY_MATERIAL, False)
        out.append(with_ground(vox, None, 12))
    return out, ramp(LEAF_RAMP)


def fall_frames(n=12, height=30, half=11):
    """The waterfall given a third axis.

    Shaped by height rather than extruded as a rectangle: a narrow lip, a sheet
    that flares as it drops and thickens front to back, and a pool spreading
    across the ground where it lands. Extruding the flat silhouette straight
    back produced a blue wall — a fall is a body that changes with its own
    height, and in three dimensions that has to be built in, not inherited.

    Water is continuous, so unlike the leaves it stays a field: the banding
    scrolls down the sheet instead of anything discrete moving.
    """
    out = []
    for f in range(n):
        vox = {}
        for z in range(height):
            t = 1.0 - z / (height - 1.0)              # 0 at the lip, 1 at the foot
            across = 3.0 + 5.0 * t ** 1.4             # the sheet flaring as it falls
            deep = 1.5 + 2.5 * t                      # and thickening
            band = (z + f * 3) % 5
            for x in range(-int(across), int(across) + 1):
                for y in range(-int(deep), int(deep) + 1):
                    if (x / across) ** 2 + (y / deep) ** 2 > 1.0:
                        continue
                    edge = abs(x) / across
                    slot = BODY_MATERIAL - (1 if band < 2 else 0) - (1 if edge > 0.75 else 0)
                    vox[(x, y, z + 3)] = (slot, band == 0 and edge < 0.4)
        # The pool: where it lands it spreads, and the spread is the only part
        # that reads as impact rather than as a column standing on the floor.
        for z in range(4):
            r = 9.0 - z * 1.2 + math.sin(f / n * 2 * math.pi) * 0.6
            for x in range(-int(r), int(r) + 1):
                for y in range(-int(r), int(r) + 1):
                    if x * x + y * y > r * r:
                        continue
                    ring = abs(math.hypot(x, y) - r + 1.5) < 1.2
                    # BODY_MATERIAL is already the top of its ramp once the
                    # +2 of flat-face shading is added, so foam brightens by
                    # sitting the pool lower rather than by pushing the ring
                    # higher and off the end.
                    vox[(x, y, z)] = (BODY_MATERIAL - (0 if ring else 2), ring)
        out.append(with_ground(vox, None, half))
    return out, ramp(WATER_RAMP)


STILL = [
    ("amphora", "Amphora", lambda: vessel("amphora")),
    ("column", "Column", lambda: vessel("column")),
    ("scarab", "Scarab", scarab),
    ("colour-sound", "Colour Sound", lambda: panel("colour-sound")),
    ("st-jaques", "St. Jaques", lambda: panel("st-jaques")),
    ("colour-fractal", "Colour Fractal", lambda: panel("colour-fractal")),
    ("spannungsbild", "Spannungsbild", lambda: panel("spannungsbild")),
    ("chromorphose", "Chromorphose", lambda: panel("chromorphose")),
]
MOVING = [
    ("bounce", "Bounce", ball_frames, 320),
    ("leaves", "Falling Leaves", leaf_frames, 300),
    ("waterfall", "Waterfall", fall_frames, 420),
]


def four_views(frames):
    """The same animation seen from each of the four isometric corners.

    Rotating the finished model — ground plane, shadow and all — rather than the
    object alone. The plane is a square, so turning it changes nothing about its
    outline, but the shadow beneath the object and the ruling of the tiles turn
    with it, which is what a viewer walking round would actually see.
    """
    return [[iso.rotate(m, turn, n) for m, n in frames] for turn in range(4)]


def build_all():
    objects = []
    for key, name, make in STILL:
        vox, norm, r = make()
        objects.append((key, name, four_views([with_ground(vox, norm, plan_half(vox))]),
                        r, 900))
    for key, name, make, ms in MOVING:
        frames, r = make()
        objects.append((key, name, four_views(frames), r, ms))
    return objects


def regions_of(grid, cols, rows):
    """Label contiguous patches of equal ramp step — flood fill, 4-connected.

    Four-connected rather than eight: patches that meet only at a corner are two
    shapes to the eye, not one, and giving them one artwork between them would
    link across a join nobody reads as joined.
    """
    label = [-1] * (cols * rows)
    out = []
    for start in range(cols * rows):
        if grid[start] < 0 or label[start] >= 0:
            continue
        slot = grid[start]
        idx = len(out)
        stack, size = [start], 0
        label[start] = idx
        while stack:
            i = stack.pop()
            size += 1
            x, y = i % cols, i // cols
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if nx < 0 or ny < 0 or nx >= cols or ny >= rows:
                    continue
                j = ny * cols + nx
                if label[j] < 0 and grid[j] == slot:
                    label[j] = idx
                    stack.append(j)
        out.append((slot, size))
    return label, out


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()
    if not DB_PATH.exists():
        sys.exit(f"{DB_PATH} not found.")

    built = build_all()
    colors = open_colors(DB_PATH)
    payload, artworks, art_index, palette, pal_index = [], [], {}, [], {}

    for key, name, views, r, frame_ms in built:
        # One canvas for every view, so the object does not jump size as it turns.
        cols, rows, ox, oy = iso.frame_box(
            [m for frames in views for m, _ in frames], pad=2)
        grids_by_view = [[iso.render(m, cols, rows, ox, oy, known_normals=n)
                          for m, n in frames] for frames in views]
        grids = [g for view in grids_by_view for g in view]
        used = sorted({s for g in grids for s in g if s >= 0})
        if used and (used[0] < 0 or used[-1] >= len(r)):
            sys.exit(f"{key}: uses slots {used[0]}..{used[-1]} but the ramp has {len(r)}")
        # A deep pool of candidates per step, so adjacent patches of the same
        # step land on different works instead of repeating every few regions.
        pools = [slot_cycle(colors, target, SLOT_MIN, 160,
                            tol_start=12, tol_stop=96)[0] for target in r]

        region_colour, taken = [], [0] * len(r)
        labelled_views = []
        for view in grids_by_view:
            labelled = []
            for g in view:
                label, found = regions_of(g, cols, rows)
                base = len(region_colour)
                for slot, _size in found:
                    pool = pools[slot]
                    c = pool[taken[slot] % len(pool)]
                    taken[slot] += 1
                    if c["id"] not in art_index:
                        art_index[c["id"]] = len(artworks)
                        artworks.append([c["id"], c["title"], c["artist"]])
                    k2 = (c["hex"], c["id"])
                    if k2 not in pal_index:
                        pal_index[k2] = len(palette)
                        palette.append([c["hex"], art_index[c["id"]]])
                    region_colour.append(pal_index[k2])
                labelled.append([(base + v if v >= 0 else -1) for v in label])
            labelled_views.append(labelled)

        print(f"  {name:16s} {cols:3d}x{rows:3d}  4 views x{len(grids_by_view[0]):2d} "
              f"frames, {len(r):2d} steps, {len(region_colour):5d} regions")
        payload.append({"key": key, "name": name, "kind": "field",
                        "cols": cols, "rows": rows, "views": 4,
                        "frames": len(grids_by_view[0]),
                        "frameMs": frame_ms, "cells": labelled_views,
                        "regions": region_colour})

    if args.preview:
        from PIL import Image
        pal = [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h, _ in palette]
        for obj in payload:
            B, C, R = 3, obj["cols"], obj["rows"]
            flat = [g for view in obj["cells"] for g in view]
            img = Image.new("RGB", (len(flat) * C * B, R * B), (231, 228, 221))
            px = img.load()
            for i, g in enumerate(flat):
                gx = i * C * B
                for idx, s in enumerate(g):
                    if s < 0:
                        continue
                    c = pal[obj["regions"][s]]
                    x, y = idx % C, idx // C
                    for dy in range(B):
                        for dx in range(B):
                            px[gx + x * B + dx, y * B + dy] = c
            img.save(ROOT / f"preview_iso_{obj['key']}.png")
        print("wrote previews")
        return

    OUT_PATH.write_text(json.dumps(
        {"cycleSteps": CYCLE_STEPS, "artworks": artworks,
         "palette": palette, "objects": payload}, separators=(",", ":")))
    print(f"Wrote {OUT_PATH} ({OUT_PATH.stat().st_size/1_000_000:.2f} MB, "
          f"{len(palette)} colours across {len(artworks)} works)")


if __name__ == "__main__":
    main()
