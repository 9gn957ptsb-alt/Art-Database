#!/usr/bin/env python3
"""Build themed pixel objects out of the collection's own colors.

The theme is chosen by the data, not by taste. This collection is 33.8% orange —
terracotta, ochre, sienna, umber — with deep reserves of bone and limestone
neutrals, so ANCIENT is what it can actually render. Christmas cannot be built
from it at all: holly green has 2 candidate colors in the whole database and pine
has 1, against 778 for limestone and 485 for black-figure black.

Each object is authored as a designed ramp of slots, and every slot is backed by
dozens of near-identical real colors. That gives flat sprite-art areas and hard
edges while keeping identity per block: a flat region is still dozens of separate
artworks, and it shimmers because each cell walks its slot's cycle at its own
phase. Neighbouring cells hold neighbouring phases, so the shimmer travels across
a surface like firelight rather than sparkling at random.

Writes ``data/theme_ancient.json`` for ``artifact/ancient.html``.

Usage:
    python3 scripts/build_theme.py
    python3 scripts/build_theme.py --preview
"""

import argparse
import base64
import io
import json
import math
import random
import sqlite3
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "artworks.db"
THUMBS_PATH = ROOT / "data" / "thumbs.json"
OUT_PATH = ROOT / "data" / "theme_ancient.json"

SLOT_MIN = 24          # widen a slot's tolerance until it has this many real colors
SLOT_MAX = 64          # cap the cycle so the payload stays small
CYCLE_FRAMES = 240     # how many steps the shimmer takes to come back round
THUMB_EDGE = 76
THUMB_QUALITY = 52
SEED = 23


# ---------------------------------------------------------------- palettes

AMPHORA_RAMP = [
    (214, 203, 182),   # 0 papyrus ground
    (28, 20, 17),      # 1 black-figure
    (58, 38, 29),      # 2 umber
    (112, 58, 38),     # 3 terracotta shadow
    (156, 82, 50),     # 4 terracotta mid
    (188, 108, 68),    # 5 terracotta light
    (212, 140, 96),    # 6 slip highlight
    (232, 206, 170),   # 7 bone
]

SCARAB_RAMP = [
    (48, 44, 40),      # 0 dark stone ground
    (26, 22, 14),      # 1 outline
    (72, 56, 26),      # 2 bronze
    (126, 98, 40),     # 3 gold shadow
    (176, 140, 60),    # 4 gold mid
    (212, 178, 92),    # 5 gold light
    (238, 214, 146),   # 6 gold highlight
    (38, 52, 92),      # 7 lapis
    (64, 86, 140),     # 8 lapis light
]

COLUMN_RAMP = [
    (38, 35, 32),      # 0 dark ground — the old one sat at the same value as the
                       #   stone itself, so the column had no silhouette at all
    (48, 45, 42),      # 1 crack
    (118, 112, 102),   # 2 stone shadow
    (158, 152, 140),   # 3 stone mid
    (192, 186, 174),   # 4 stone light
    (218, 213, 202),   # 5 stone highlight
    (66, 62, 56),      # 6 deep shadow
]


# ---------------------------------------------------------------- helpers

def lerp(a, b, t):
    return a + (b - a) * t


def profile(points, ny):
    """Piecewise-linear silhouette radius at height ny."""
    for i in range(len(points) - 1):
        y0, r0 = points[i]
        y1, r1 = points[i + 1]
        if y0 <= ny <= y1:
            t = 0 if y1 == y0 else (ny - y0) / (y1 - y0)
            return lerp(r0, r1, t)
    return points[-1][1]


def cylinder_shade(u):
    """Slot offset across a round surface lit from the upper left.

    u is -1 at the left edge, +1 at the right. The highlight sits well off centre:
    centre it and the quantisation step lands as a seam straight down the middle
    of every round form.
    """
    # A narrow falloff crushes the whole shadow side into one slot, so the form
    # splits into a light half and a dark half with a hard seam rather than turning.
    return math.exp(-((u + 0.50) ** 2) / 0.95)


# ---------------------------------------------------------------- objects

def amphora(W=30, H=42):
    """Greek storage jar: lip, neck, handles, belly, foot, black-figure band."""
    # Inset top and bottom: run to the frame edge and the lip and foot read as bars
    # sliced off by the crop rather than as parts of a vessel.
    pts = [(0.000, 0.00), (0.035, 0.00), (0.040, 0.30), (0.085, 0.32),
           (0.110, 0.16), (0.235, 0.140), (0.330, 0.40), (0.470, 0.47),
           (0.630, 0.43), (0.780, 0.25), (0.870, 0.115), (0.900, 0.20),
           (0.945, 0.28), (0.965, 0.28), (0.970, 0.00), (1.000, 0.00)]
    cx = (W - 1) / 2
    grid = [[0] * W for _ in range(H)]

    for y in range(H):
        ny = y / (H - 1)
        r = profile(pts, ny) * W
        for x in range(W):
            dx = x - cx
            if abs(dx) > r:
                continue
            u = dx / max(r, 0.6)
            lit = cylinder_shade(u)

            if ny <= 0.095:                     # lip
                slot = 7 if lit > 0.42 else 2
            elif ny <= 0.115:
                slot = 2
            elif ny >= 0.895:                   # foot
                slot = 7 if lit > 0.45 else 2
            elif ny >= 0.865:
                slot = 2
            else:
                slot = 3 + min(3, int(lit * 4.2))
                if abs(u) > 0.86:               # the turn of the form
                    slot = min(slot, 3)

            # Black-figure band around the belly: a meander, then a figure register.
            if 0.40 <= ny <= 0.545 and abs(u) < 0.93:
                band = (ny - 0.40) / 0.145
                col = int((x + 1) * 1.0) % 6
                if band < 0.18 or band > 0.86:
                    slot = 1
                elif 0.30 < band < 0.74:
                    slot = 1 if col in (0, 1, 2, 4) else 7
                else:
                    slot = 7 if col in (2, 3) else 1
            grid[y][x] = slot

    # Handles: shoulder up to neck, drawn as an arc on each side.
    for side in (-1, 1):
        for i in range(90):
            t = i / 89
            ny = lerp(0.345, 0.150, t)
            bulge = math.sin(math.pi * t) ** 0.75
            nx = cx + side * (0.155 + 0.30 * bulge) * W
            y = int(round(ny * (H - 1)))
            for ox in (-1, 0, 1):
                x = int(round(nx)) + ox
                if 0 <= x < W and 0 <= y < H:
                    inner = abs(ox) == (0 if side < 0 else 0)
                    grid[y][x] = 4 if inner else 3
    return grid, AMPHORA_RAMP, "Amphora"


def scarab(W=34, H=28):
    """Gold amulet with lapis inlay: head, pronotum, elytra, six legs."""
    cx, grid = (W - 1) / 2, [[0] * W for _ in range(H)]

    def put(x, y, slot):
        xi, yi = int(round(x)), int(round(y))
        if 0 <= xi < W and 0 <= yi < H:
            grid[yi][xi] = slot

    # Legs first, so the body draws over their roots.
    for side in (-1, 1):
        for ly, reach, drop in ((0.36, 0.46, -0.10), (0.55, 0.50, 0.10), (0.74, 0.44, 0.22)):
            for i in range(12):
                t = i / 11
                x = cx + side * lerp(0.20, reach, t) * W
                y = (ly + drop * t) * (H - 1)
                put(x, y, 2 if t < 0.6 else 1)

    for y in range(H):
        ny = y / (H - 1)
        for x in range(W):
            dx = (x - cx) / (W / 2)
            # head, pronotum, elytra stacked as three ellipses
            head = ((dx / 0.21) ** 2 + ((ny - 0.11) / 0.085) ** 2) <= 1
            pron = ((dx / 0.40) ** 2 + ((ny - 0.30) / 0.155) ** 2) <= 1
            elyt = ((dx / 0.47) ** 2 + ((ny - 0.68) / 0.33) ** 2) <= 1
            if not (head or pron or elyt):
                continue

            lit = cylinder_shade(dx / 0.42)
            slot = 3 + min(3, int(lit * 4.0))
            if head:
                slot = max(2, slot - 1)

            edge = (((dx / 0.48) ** 2 + ((ny - 0.68) / 0.34) ** 2) > 0.86) and elyt
            if edge or (pron and ((dx / 0.41) ** 2 + ((ny - 0.30) / 0.165) ** 2) > 0.84):
                slot = 1

            if elyt and abs(x - cx) < 0.8:          # the seam between wing cases
                slot = 1
            if elyt and 0.50 < ny < 0.565 and abs(dx) < 0.42:
                slot = 7 if abs(dx) > 0.19 else 8   # lapis inlay bands
            if elyt and 0.715 < ny < 0.775 and abs(dx) < 0.34:
                slot = 8 if abs(dx) > 0.16 else 7
            grid[y][x] = slot
    return grid, SCARAB_RAMP, "Scarab"


def column(W=26, H=46):
    """Weathered Doric column: abacus, echinus, fluted shaft with entasis, base.

    Drawn with hard-edged flutes rather than a smooth gradient. A soft cylinder
    shade at this resolution reads as a blurred stripe, not as carved stone.
    """
    cx, grid = (W - 1) / 2, [[0] * W for _ in range(H)]
    rng = random.Random(5)
    FLUTES = 5

    def radius(ny):
        if ny < 0.030:  return 0.00
        if ny < 0.065:  return 0.46           # abacus, the flat slab on top
        if ny < 0.105:  return 0.42           # echinus
        if ny < 0.145:  return lerp(0.40, 0.31, (ny - 0.105) / 0.04)
        if ny < 0.855:
            t = (ny - 0.145) / 0.71
            return 0.295 + 0.030 * math.sin(math.pi * t)   # entasis
        if ny < 0.900:  return lerp(0.31, 0.38, (ny - 0.855) / 0.045)
        if ny < 0.965:  return 0.45           # plinth
        return 0.00

    for y in range(H):
        ny = y / (H - 1)
        r = radius(ny)
        if r <= 0:
            continue
        for x in range(W):
            dx = (x - cx) / (W / 2)
            if abs(dx) > r:
                continue
            u = dx / r

            if ny < 0.145 or ny > 0.855:
                # Capital and base are flat mouldings, lit as slabs not cylinders.
                slot = 4 if u < 0.30 else 3
                if abs(u) > 0.90:
                    slot = 2
                if 0.060 <= ny < 0.075 or 0.895 <= ny < 0.908:
                    slot = 6                  # the shadow line under each moulding
            else:
                # Each flute is its own vertical facet: a hard step, then a fillet.
                pos = (u + 1) / 2 * FLUTES
                within = pos - math.floor(pos)
                facet = 1.0 - abs(within - 0.5) * 2.0        # 0 at the fillet, 1 mid-flute
                across = cylinder_shade(u)
                lit = 0.34 + 0.52 * across
                if facet < 0.22:
                    slot = 2 if across > 0.45 else 6         # the groove between flutes
                else:
                    slot = 3 + min(2, int(lit * 3.4))
                if abs(u) > 0.93:
                    slot = 6

            grid[y][x] = slot

    # Weathering: chip the abacus corners and run two cracks down the shaft, so it
    # reads as a ruin rather than a rendering.
    for y in range(H):
        for x in range(W):
            if grid[y][x] and y < 4 and (x < 2 or x > W - 3):
                grid[y][x] = 0
    for start_ny, length in ((0.28, 10), (0.60, 8)):
        x = int(cx + rng.choice((-4, 3)))
        y = int(start_ny * H)
        for i in range(length):
            if 0 <= y + i < H and 0 <= x < W and grid[y + i][x]:
                grid[y + i][x] = 1
            if i % 3 == 2:
                x += rng.choice((-1, 1))
    return grid, COLUMN_RAMP, "Column"


# ---------------------------------------------------------------- colour slots

def load_colors(conn):
    rows = conn.execute(
        """SELECT c.hex, c.r, c.g, c.b, c.artwork_id, a.title, a.artist_name
           FROM artwork_colors c JOIN artworks a ON a.id = c.artwork_id"""
    ).fetchall()
    return [{"hex": h, "rgb": (r, g, b), "id": i, "title": t or "Untitled",
             "artist": ar or "Unknown artist"} for h, r, g, b, i, t, ar in rows]


def slot_cycle(colors, target, rng):
    """Real colours near a ramp step, ordered so consecutive entries are close.

    Ordering matters as much as selection: walked in a random order the same set
    strobes, walked in a smooth one it breathes.
    """
    tol = 8
    near = []
    while tol <= 64:
        near = [c for c in colors
                if abs(c["rgb"][0] - target[0]) <= tol
                and abs(c["rgb"][1] - target[1]) <= tol
                and abs(c["rgb"][2] - target[2]) <= tol]
        if len(near) >= SLOT_MIN:
            break
        tol += 4
    if not near:
        near = sorted(colors, key=lambda c: sum((c["rgb"][i] - target[i]) ** 2
                                                for i in range(3)))[:SLOT_MIN]
    rng.shuffle(near)
    near = near[:SLOT_MAX]
    # Sort by distance from the ramp target, then mirror, so the cycle eases out
    # and back rather than jumping at the wrap.
    near.sort(key=lambda c: sum((c["rgb"][i] - target[i]) ** 2 for i in range(3)))
    return near[::2] + near[1::2][::-1], tol


def build_object(maker, colors, rng):
    grid, ramp, name = maker()
    H, W = len(grid), len(grid[0])
    cycles, tols = [], []
    for target in ramp:
        cycle, tol = slot_cycle(colors, target, rng)
        cycles.append(cycle)
        tols.append(tol)

    # Phase varies smoothly across the sprite, so shimmer travels as a wave.
    phases = [[int((x * 0.8 + y * 1.7 + 6 * math.sin(x * 0.35 + y * 0.2)) % CYCLE_FRAMES)
               for x in range(W)] for y in range(H)]
    print(f"  {name}: {W}x{H}, slots {[len(c) for c in cycles]} (tol {tols})")
    return {"name": name, "cols": W, "rows": H, "grid": grid,
            "phases": phases, "cycles": cycles}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", action="store_true", help="write PNGs and stop")
    args = parser.parse_args()

    if not DB_PATH.exists():
        sys.exit(f"{DB_PATH} not found.")
    conn = sqlite3.connect(DB_PATH)
    try:
        colors = load_colors(conn)
    finally:
        conn.close()

    rng = random.Random(SEED)
    print(f"{len(colors)} colors available")
    objects = [build_object(m, colors, rng) for m in (amphora, scarab, column)]

    if args.preview:
        for obj in objects:
            W, H, B = obj["cols"], obj["rows"], 12
            img = Image.new("RGB", (W, H))
            px = img.load()
            for y in range(H):
                for x in range(W):
                    c = obj["cycles"][obj["grid"][y][x]][0]
                    px[x, y] = c["rgb"]
            img.resize((W * B, H * B), Image.NEAREST).save(ROOT / f"preview_{obj['name'].lower()}.png")
        print("wrote previews")
        return

    # Flatten to palette + artwork tables shared across all three objects.
    artworks, artwork_index, palette, palette_index = [], {}, [], {}
    for obj in objects:
        packed = []
        for cycle in obj["cycles"]:
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
        obj["cycles"] = packed

    thumbs = {}
    if THUMBS_PATH.exists():
        source = json.loads(THUMBS_PATH.read_text())
        for entry in artworks:
            uri = source.get(entry[0])
            if not uri or "," not in uri:
                entry.append(None)
                continue
            try:
                raw = base64.b64decode(uri.split(",", 1)[1])
                img = Image.open(io.BytesIO(raw)).convert("RGB")
                img.thumbnail((THUMB_EDGE, THUMB_EDGE), Image.LANCZOS)
                buf = io.BytesIO()
                img.save(buf, format="WEBP", quality=THUMB_QUALITY, method=6)
                entry.append("data:image/webp;base64," +
                             base64.b64encode(buf.getvalue()).decode("ascii"))
                thumbs[entry[0]] = True
            except Exception:
                entry.append(None)

    OUT_PATH.write_text(json.dumps({
        "theme": "Ancient", "cycleFrames": CYCLE_FRAMES,
        "artworks": artworks, "palette": palette, "objects": objects,
    }, separators=(",", ":")))
    print(f"Wrote {OUT_PATH} ({OUT_PATH.stat().st_size/1_000_000:.2f} MB, "
          f"{len(palette)} colours across {len(artworks)} works, {len(thumbs)} previews)")


if __name__ == "__main__":
    main()
