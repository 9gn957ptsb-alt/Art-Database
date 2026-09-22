#!/usr/bin/env python3
"""The ground and the sea the globe is woven from: DIRT, and DIRT's sea.

The land wears DIRT — the collection soil made in its own session (branch
claude/digital-dirt-layers-paiial, dirt/collection_soil.py): a chocolate
tile in which every clod is one saved painting, in one of its three
dominant colours, woven in the globe's own dot hand after Dorothy
Napangardi. This takes that tile as it is.

The sea is the same thing made again for water: the same clods, the same
weave, the same one-painting-per-clod rule, but each clod wears the blue
out of a saved painting rather than the brown, and its glints are that
painting's palest cool colour. The functions below that do the weaving are
DIRT's own, copied rather than rewritten so the two are one hand.

What the browser gets is only the cells: a 256 × 256 picture per tile, one
pixel per cell, its colour the dot's colour and its alpha the dot's size
(nought where the weave leaves a gap). No titles, no artists, no list of
which painting went where — the saved list is private and this repository
is public, so only colours leave the machine. That is the same line the
tokens in land.json already keep to.

    python3 scripts/build_dirt.py [--land data/dirt/collection-soil-dots.png]

The land tile is DIRT's dots layer, dirt/out/collection-soil-dots.png on the
DIRT branch; fetch it into data/dirt/ first:

    git show origin/claude/digital-dirt-layers-paiial:dirt/out/collection-soil-dots.png \\
        > data/dirt/collection-soil-dots.png

Writes docs/v2/dirt-land.png and docs/v2/dirt-sea.png.
"""

import argparse
import colorsys
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "artsy_saves_raw.json"
OUT = ROOT / "docs" / "v2"

N = 256          # cells per side, as in DIRT
CELL = 3         # pixels per cell in DIRT's own tile


# ---- DIRT's weaving, verbatim in substance ------------------------------------------------------

def field(rng, lo, hi):
    """Tileable band-limited noise in [0, 1]: white noise filtered to wavelengths lo..hi cells."""
    f = np.sqrt(np.fft.fftfreq(N)[:, None] ** 2 + np.fft.fftfreq(N)[None, :] ** 2)
    band = np.exp(-((f * lo) ** 2)) - np.exp(-((f * hi) ** 2))
    out = np.real(np.fft.ifft2(np.fft.fft2(rng.standard_normal((N, N))) * band))
    return (out - out.min()) / (np.ptp(out) or 1)


def wrap(d):
    return (d + N / 2) % N - N / 2


def hls(hexs):
    r, g, b = (int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    return h * 360, l, s


def clods(rng, k):
    """A warped, weighted, periodic Voronoi: labels and edge distance."""
    pts = rng.uniform(0, N, (k, 2))
    weight = rng.gamma(2.0, 2.2, k)
    yy, xx = np.mgrid[0:N, 0:N].astype(float)
    wx = (field(rng, 6, 60) - 0.5) * 14
    wy = (field(rng, 6, 60) - 0.5) * 14
    X, Y = xx + wx, yy + wy
    dx = wrap(X[..., None] - pts[:, 0])
    dy = wrap(Y[..., None] - pts[:, 1])
    d = np.sqrt(dx * dx + dy * dy) - weight
    order = np.argpartition(d, 1, axis=-1)
    lab = order[..., 0]
    d1 = np.take_along_axis(d, order[..., :1], -1)[..., 0]
    d2 = np.take_along_axis(d, order[..., 1:2], -1)[..., 0]
    return lab, (d2 - d1) / 2


def relief(edge):
    e = np.minimum(edge, 5)
    gx = (np.roll(e, -1, 1) - np.roll(e, 1, 1)) / 2
    gy = (np.roll(e, -1, 0) - np.roll(e, 1, 0)) / 2
    lit = -(gx * -0.6 + gy * -0.8)
    return np.select([lit > 0.25, lit < -0.25], [1.14, 0.8], 1.0)


def weave(rng, edge):
    yy, xx = np.mgrid[0:N, 0:N].astype(float)
    a = np.cos(2 * np.pi * (yy / 2.6 + (field(rng, 8, 90) - 0.5) * 5))
    b = np.cos(2 * np.pi * (xx / 3.1 + (field(rng, 8, 90) - 0.5) * 5))
    density = field(rng, 4, 40)
    blocks = field(rng, 3, 24) < 0.22
    on_a = a > -0.1 - density * 0.9
    on_b = b > 0.4 - density * 0.9
    size = np.where(on_a | on_b, 2, 0)
    size = np.where(on_a & on_b & (density > 0.55), 3, size)
    size = np.where((size == 2) & (density < 0.3), 1, size)
    size[blocks & (density < 0.6)] = 0
    size[edge < 0.9] = 0
    return size


# ---- the sea ------------------------------------------------------------------------------------

def is_water(hexs):
    h, l, s = hls(hexs)
    return 185 <= h <= 235 and 0.15 <= s <= 0.7 and 0.12 <= l <= 0.55


def is_cool_pale(hexs):
    h, l, s = hls(hexs)
    return l >= 0.62 and (s < 0.15 or 170 <= h <= 250)


def sea(seed, k):
    raw = json.loads(RAW.read_text())
    pool = []
    for rec in raw:
        if rec.get("category") != "Painting":
            continue
        colours = [c.lower() for c in rec.get("dominant_colors") or []]
        blue = [c for c in colours if is_water(c)]
        if blue:
            pale = [c for c in colours if is_cool_pale(c)]
            pool.append(dict(id=rec.get("id"), hex=min(blue, key=lambda c: abs(hls(c)[0] - 210)),
                             glint=max(pale, key=lambda c: hls(c)[1]) if pale else None))
    k = min(k, len(pool))

    rng = np.random.default_rng(seed)
    lab, edge = clods(rng, k)
    depth = field(rng, 20, 160)
    target = np.array([depth[lab == i].mean() if (lab == i).any() else 0.5 for i in range(k)])
    target = 0.16 + 0.34 * (np.argsort(np.argsort(target)) / max(1, k - 1))

    rng.shuffle(pool)
    used, assign = set(), {}
    for i in np.argsort(-np.bincount(lab.ravel(), minlength=k)):
        cands = [p for p in pool if p["id"] not in used]
        best = min(cands[:400], key=lambda p: abs(hls(p["hex"])[1] - target[i]) + rng.uniform(0, 0.03))
        used.add(best["id"])
        assign[i] = best

    size = weave(rng, edge)
    shade = relief(edge)
    glint = (rng.random((N, N)) < 0.035) & (size > 0)

    rgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)
    base = np.stack([rgb(assign[i]["hex"]) for i in range(k)])
    glints = np.stack([rgb(assign[i]["glint"] or assign[i]["hex"]) for i in range(k)])
    has = np.array([assign[i]["glint"] is not None for i in range(k)])

    col = base[lab] * shade[..., None]
    g = glint & has[lab]
    col[g] = glints[lab][g]
    return np.clip(col, 0, 255).astype(np.uint8), size, len(used)


# ---- one pixel a cell ---------------------------------------------------------------------------

def cells(col, size):
    out = np.zeros((N, N, 4), np.uint8)
    out[..., :3] = col
    out[..., 3] = (size * 85).astype(np.uint8)          # 0, 85, 170, 255 for sizes 0-3
    out[size == 0, :3] = 0
    return out


def land(path):
    """DIRT's own tile, read back into cells: colour at each cell's corner, size from its dot."""
    tile = np.asarray(Image.open(path).convert("RGBA"))
    col = tile[0::CELL, 0::CELL, :3]
    on = tile[..., 3] > 0
    size = on[0::CELL, 0::CELL].astype(int)
    size += on[1::CELL, 1::CELL].astype(int)
    size += on[2::CELL, 2::CELL].astype(int)
    return col, size


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--land", default=str(ROOT / "data" / "dirt" / "collection-soil-dots.png"))
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--clods", type=int, default=160)
    args = ap.parse_args()

    col, size = land(args.land)
    Image.fromarray(cells(col, size), "RGBA").save(OUT / "dirt-land.png", optimize=True)
    print("land: DIRT's tile, %d%% of cells carry a dot" % round(100 * (size > 0).mean()))

    col, size, used = sea(args.seed, args.clods)
    Image.fromarray(cells(col, size), "RGBA").save(OUT / "dirt-sea.png", optimize=True)
    print("sea: %d clods from %d paintings, %d%% of cells carry a dot"
          % (args.clods, used, round(100 * (size > 0).mean())))


if __name__ == "__main__":
    main()
