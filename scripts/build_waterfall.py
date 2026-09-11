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
THUMBS_PATH = ROOT / "data" / "thumbs.json"

# Blue-and-white only for now: blues, cyans and teals plus every neutral, which is
# what a waterfall is actually made of. --palette full opens it to the whole wheel.
BLUE_HUES = (180, 250)
THUMB_EDGE = 80              # the pop-out preview is small; the page carries them all
THUMB_QUALITY = 52

# A designed ramp, the way a sprite artist picks a palette: eleven steps from an
# outline black through blue-greys to foam white. Every block on screen resolves to
# one of these eleven, which is what produces flat areas and hard edges instead of
# per-pixel noise. Identity is kept separate from appearance — each slot is backed by
# dozens of near-identical real colours, so a flat region is still dozens of
# different artworks.
RAMP = [
    (22, 27, 36), (44, 54, 70), (68, 84, 104), (96, 116, 140), (126, 148, 172),
    (156, 176, 196), (184, 201, 216), (206, 220, 232), (226, 236, 244),
    (240, 246, 250), (252, 253, 255),
]
SLOT_MIN_CANDIDATES = 40     # widen a slot's tolerance until it has this many works

# Sprite proportions: few, large cells. The blocks are both the picture and the
# interface, so they have to read as deliberate pixels and be easy to press.
COLS = 28
ROWS = 38
FRAMES = 96
ADVANCE = 1                  # one row per frame, like a piece falling on a grid
WORLD = FRAMES * ADVANCE     # 96 — the falling texture's vertical period
BLOCK = 12
# NES Tetris drops a piece one cell per ~800ms at level 0. A tad faster than that.
FRAME_MS = 620

# Proportions taken from reference photographs of real falls: a narrow lip, a
# body that flares as it drops, and a landing well above the frame's bottom edge
# so the spray has somewhere to go.
LIP_Y = 0.10                 # bottom of the lip band
FOOT_Y = 0.76                # where the fall lands
TOP_HALF = 0.19              # half-width at the lip
FOOT_HALF = 0.31             # half-width at the foot
STRANDS = 10                 # discrete filaments of water

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
        out.append({"hex": hex_color, "h": h, "s": s, "l": l, "rgb": (r, g, b),
                    "id": artwork_id, "title": title or "Untitled",
                    "artist": artist or "Unknown artist"})
    return out


def restrict(colors, palette):
    """Blue mode keeps blues, cyans, teals and all the neutrals."""
    if palette == "full":
        return colors
    lo, hi = BLUE_HUES
    return [c for c in colors if c["s"] < 0.12 or lo <= c["h"] <= hi]


def journey(colors):
    """One cycle: white crest -> grey -> blue -> around the wheel -> back to pale."""
    neutrals = sorted((c for c in colors if c["s"] < 0.12), key=lambda c: -c["l"])
    chromatic = sorted((c for c in colors if c["s"] >= 0.12),
                       key=lambda c: (((210 - c["h"]) % 360), c["l"]))
    return neutrals + chromatic


def build_slots(colors, rng):
    """Back each ramp step with real colours close enough to read as one flat tone."""
    slots = []
    for target in RAMP:
        tol = 8
        while True:
            near = [c for c in colors
                    if abs(c["rgb"][0] - target[0]) <= tol
                    and abs(c["rgb"][1] - target[1]) <= tol
                    and abs(c["rgb"][2] - target[2]) <= tol]
            if len(near) >= SLOT_MIN_CANDIDATES or tol >= 60:
                break
            tol += 4
        if not near:
            near = sorted(colors, key=lambda c: sum(
                (c["rgb"][i] - target[i]) ** 2 for i in range(3)))[:SLOT_MIN_CANDIDATES]
        slots.append(near)
    return slots


class Pool:
    """A set of colors searchable by lightness."""

    def __init__(self, colors):
        self.items = sorted(colors, key=lambda c: c["l"])
        self.keys = [c["l"] for c in self.items]

    def __len__(self):
        return len(self.items)

    def nearest(self, target, rng, spread=4, hue_ref=None):
        """Closest match by lightness, then by hue.

        Matching on lightness alone speckles: a wide band holds many hues at the
        same lightness, so neighbouring blocks land on unrelated colours and the
        mist turns to confetti. Preferring the band's hue keeps large soft areas
        reading as one atmosphere. Neutrals carry a discounted distance because
        grey haze belongs in any light.
        """
        if not self.items:
            return None
        i = bisect_left(self.keys, target)
        lo = max(0, i - spread)
        hi = min(len(self.items), i + spread + 1)
        candidates = self.items[lo:hi]
        if not candidates:
            return None
        if hue_ref is None:
            return candidates[rng.randrange(len(candidates))]

        def hue_distance(c):
            d = abs(c["h"] - hue_ref) % 360
            d = min(d, 360 - d)
            # The less saturated a colour is, the less its hue matters — a true
            # grey belongs in any light, but a warm grey still reads warm, and
            # enough of them turn a blue fall tan.
            weight = 1.0 if c["s"] >= 0.12 else max(0.12, c["s"] / 0.12)
            return d * weight

        candidates.sort(key=hue_distance)
        return candidates[rng.randrange(min(len(candidates), 3))]


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
    # Water does not fall as a flat sheet; it breaks into filaments that hold
    # together down the drop and spread apart as they go. Each strand keeps its
    # own lip position, drift, width and brightness, and its own scrolling
    # intensity — which is what reads as threads of water rather than noise.
    strands = []
    for i in range(STRANDS):
        t = (i + 0.5) / STRANDS
        strands.append({
            "x0": t + rng.uniform(-0.02, 0.02),          # position across the lip
            "drift": (t - 0.5) * rng.uniform(0.35, 0.95),  # diverges as it falls
            "width": rng.uniform(0.010, 0.030),
            "gain": rng.uniform(0.55, 1.0),
            "noise": periodic_smooth(rng, WORLD, octaves=(30, 11, 4),
                                     weights=(0.5, 0.32, 0.18)),
        })
    rock = [periodic_smooth(rng, ROWS, octaves=(11, 4), weights=(0.6, 0.4))
            for _ in range(COLS)]
    spray = [[periodic_smooth(rng, FRAMES, octaves=(13, 5), weights=(0.6, 0.4))
              for _ in range(ROWS)] for _ in range(COLS)]
    mist = [periodic_smooth(rng, FRAMES, octaves=(17, 6), weights=(0.6, 0.4))
            for _ in range(COLS)]
    return strands, rock, spray, mist


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a) if b != a else 0.0))
    return t * t * (3 - 2 * t)


def fall_half_width(ny):
    """Narrow at the lip, flaring toward the foot."""
    t = smoothstep(LIP_Y, FOOT_Y, ny)
    return TOP_HALF + (FOOT_HALF - TOP_HALF) * t


def sheetness(nx, ny):
    """1 inside the falling water, 0 outside it, with a soft edge."""
    half = fall_half_width(ny)
    d = abs(nx - 0.5) / half
    return max(0.0, min(1.0, (1.0 - d) / 0.32))


def target_lightness(col, row, frame, strands, rock, spray, mist):
    """Compose the fall, layer by layer, as a target lightness in [0, 1].

    Ordered the way the scene is built: ground, atmosphere, then water on top.
    """
    nx = col / (COLS - 1)
    ny = row / (ROWS - 1)
    y_world = (row + frame * ADVANCE) % WORLD

    # 1. Background. Dim enough that white water reads as bright against it, and
    #    it is here — not in the fall — that the collection's hue lives.
    lightness = 0.30 - 0.07 * ny + 0.04 * rock[col][row]

    # 2. Mist. A soft halo around the fall, thickening toward the foot where the
    #    spray hangs. Every reference has this; without it the fall is a decal.
    halo = math.exp(-((nx - 0.5) / 0.42) ** 2) * (0.18 + 0.82 * smoothstep(0.15, 0.9, ny))
    lightness += 0.34 * halo * (0.75 + 0.25 * mist[col][frame])

    # 3. Rock. Dark ledges flanking the lip and massing in the bottom corners,
    #    static in screen space — banks do not fall.
    ledge = 0.0
    if ny < LIP_Y * 2.4 and abs(nx - 0.5) > TOP_HALF * 1.25:
        # Fade the ledge out downward. A hard vertical cutoff here drew a seam
        # straight across the frame, which no amount of colour choice could hide.
        ledge = (smoothstep(TOP_HALF * 1.25, TOP_HALF * 1.9, abs(nx - 0.5))
                 * (1.0 - smoothstep(LIP_Y * 0.9, LIP_Y * 2.4, ny)))
    if ny > 0.84:
        ledge = max(ledge, smoothstep(0.30, 0.44, abs(nx - 0.5)) * smoothstep(0.84, 0.95, ny))
    if ledge > 0:
        rocky = 0.07 + 0.13 * rock[col][row]
        lightness = lightness * (1 - ledge) + rocky * ledge

    inside = sheetness(nx, ny)

    # 4. The lip. A bright horizontal band where the water goes over the edge,
    #    denser and flatter than the fall beneath it.
    if ny < LIP_Y and abs(nx - 0.5) < TOP_HALF * 1.12:
        lip = smoothstep(TOP_HALF * 1.12, TOP_HALF * 0.5, abs(nx - 0.5))
        lightness = max(lightness, (0.74 + 0.22 * strands[col % STRANDS]["noise"][y_world]) * lip)

    # 5. Filaments. Each strand is a thread whose brightness scrolls down its own
    #    length; they diverge as they drop, which is what separates falling water
    #    from a scrolling texture.
    if inside > 0 and ny > LIP_Y * 0.45:
        drop = smoothstep(LIP_Y, FOOT_Y, ny)
        water = 0.0
        for st in strands:
            xc = 0.5 + (st["x0"] - 0.5) * (2 * fall_half_width(ny)) + st["drift"] * drop * 0.12
            w = st["width"] * (1.0 + 1.4 * drop)
            d = abs(nx - xc) / w
            if d >= 1.6:
                continue
            profile = math.exp(-d * d * 1.1)
            flicker = st["noise"][(y_world + int(st["x0"] * 97)) % WORLD]
            water = max(water, st["gain"] * profile * (0.45 + 0.55 * flicker))
        # The body between filaments still carries water, just darker.
        body = 0.30 + 0.22 * strands[col % STRANDS]["noise"][y_world]
        wet = max(body, 0.34 + 0.62 * water)
        # Water thins and gives way to spray as it nears the landing.
        wet *= 1.0 - 0.25 * smoothstep(0.62, FOOT_Y, ny)
        lightness = lightness * (1 - inside) + max(lightness, wet) * inside

    # 6. The bloom at the foot. The brightest thing in the frame: where the fall
    #    lands it detonates into light and spreads sideways.
    bx = (nx - 0.5) / 0.46
    by = (ny - (FOOT_Y + 0.05)) / 0.15
    bloom = 1.0 - (bx * bx + by * by)
    if bloom > 0:
        churn = 0.72 + 0.28 * spray[col][row][frame]
        lightness = max(lightness, (0.55 + 0.42 * bloom ** 0.55) * churn)

    # 7. Spray sheeting outward along the base.
    if ny > FOOT_Y:
        run = smoothstep(FOOT_Y, 0.90, ny) * (1 - smoothstep(0.34, 0.5, abs(nx - 0.5)))
        lightness = max(lightness, (0.42 + 0.46 * spray[col][row][frame]) * run)

    return max(0.0, min(1.0, lightness))


def render(colors, rng, blue_mode=True):
    ordered = journey(colors)
    foam = Pool([c for c in ordered if c["l"] >= FOAM_MIN_L])
    rock_pool = Pool([c for c in ordered if c["l"] <= ROCK_MAX_L])
    print(f"pools — foam {len(foam)}, rock {len(rock_pool)}, journey {len(ordered)}")

    strands, rock, spray, mist = build_fields(rng)
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
    everything = Pool(ordered)
    frames = []
    for f in range(FRAMES):
        if blue_mode:
            # Every colour stays available for contrast, and the hue anchor simply
            # drifts through the blues. Walking a journey that is 83% neutral, as
            # the full-wheel mode does, drags the whole scene grey-tan instead.
            water = everything
            hue_ref = 215.0 + 30.0 * math.sin(2 * math.pi * f / FRAMES)
        else:
            # The water's hue band walks the whole journey over exactly one loop.
            centre = int((f / FRAMES) * len(ordered))
            water, half = water_band(centre)
            widest = max(widest, half)
            anchor = ordered[centre % len(ordered)]
            hue_ref = anchor["h"] if anchor["s"] >= 0.12 else None

        grid = []
        for row in range(ROWS):
            for col in range(COLS):
                t = target_lightness(col, row, f, strands, rock, spray, mist)
                # Foam is white in any light, so bright blocks ignore the hue
                # phase entirely; the darkest blocks are rock; everything between
                # is where the collection's colour actually shows.
                if t >= FOAM_MIN_L and len(foam):
                    cell = foam.nearest(t, rng)
                elif t <= ROCK_MAX_L and len(rock_pool):
                    cell = rock_pool.nearest(t, rng)
                else:
                    cell = (water.nearest(t, rng, hue_ref=hue_ref)
                            or foam.nearest(t, rng))
                grid.append(cell)
        frames.append(grid)
    if widest:
        print(f"band half-width {base_half} -> up to {widest} to hold contrast")
    return frames


def small_thumbs(ids):
    """Re-encode the page's thumbnails smaller — this page shows one at a time and
    carries every one of them, so the full-size set would be most of the payload."""
    if not THUMBS_PATH.exists():
        print("no data/thumbs.json; previews will fall back to the colour swatch")
        return {}
    import base64, io
    source = json.loads(THUMBS_PATH.read_text())
    out = {}
    for artwork_id in ids:
        uri = source.get(artwork_id)
        if not uri or "," not in uri:
            continue
        try:
            raw = base64.b64decode(uri.split(",", 1)[1])
            img = Image.open(io.BytesIO(raw)).convert("RGB")
            img.thumbnail((THUMB_EDGE, THUMB_EDGE), Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="WEBP", quality=THUMB_QUALITY, method=6)
            out[artwork_id] = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
        except Exception:
            continue
    return out


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

    thumbs = small_thumbs([a[0] for a in artworks])
    for entry in artworks:
        entry.append(thumbs.get(entry[0]))

    JSON_PATH.write_text(json.dumps({
        "columns": COLS, "rows": ROWS, "frames": FRAMES, "frameMs": FRAME_MS,
        "artworks": artworks, "palette": palette, "cells": out_frames,
    }, separators=(",", ":")))
    return len(artworks), len(palette), len(thumbs)


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
    parser.add_argument("--palette", choices=("blue", "full"), default="blue",
                        help="blue: blues, cyans, teals and neutrals (default)")
    args = parser.parse_args()

    if not DB_PATH.exists():
        sys.exit(f"{DB_PATH} not found. Run scripts/normalize_artsy_saves.py first.")

    conn = sqlite3.connect(DB_PATH)
    try:
        colors = load_colors(conn)
    finally:
        conn.close()

    rng = random.Random(SEED)
    pool = restrict(colors, args.palette)
    print(f"palette '{args.palette}': {len(pool)} of {len(colors)} colors")
    frames = render(pool, rng, blue_mode=args.palette == "blue")
    print(f"{FRAMES} frames of {COLS}x{ROWS}")

    if args.preview:
        for i in range(args.preview):
            to_image(frames[i * (FRAMES // args.preview)]).save(ROOT / f"preview_{i:02d}.png")
        print(f"wrote {args.preview} preview frames")
        return

    n_art, n_pal, n_thumb = write_json(frames)
    print(f"Wrote {JSON_PATH} ({JSON_PATH.stat().st_size/1_000_000:.2f} MB, "
          f"{n_pal} palette entries across {n_art} artworks, {n_thumb} previews)")

    if args.gif:
        images = [to_image(g) for g in frames]
        images[0].save(GIF_PATH, save_all=True, append_images=images[1:],
                       duration=FRAME_MS, loop=0, optimize=True, disposal=2)
        print(f"Wrote {GIF_PATH} ({GIF_PATH.stat().st_size/1_000_000:.2f} MB)")


if __name__ == "__main__":
    main()
