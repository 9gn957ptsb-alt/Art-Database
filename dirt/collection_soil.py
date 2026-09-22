#!/usr/bin/env python3
"""Collection soil: a chocolate-brown dirt woven out of the saved paintings' own colours.

Every clod in the texture is one painting. Its colour is one of that painting's three dominant
colours (the breakdown in `artwork_colors`), chosen from the chocolate range, and no painting is
used twice. The gaps between the dots — "the blacks" — are one near-black swatch, also taken from
a painting, and kept as their own layer so something else (words, later) can occupy them. The pale
glints in a clod are the lightest warm colour of that same painting.

The surface is woven like the globe on the artist website, after Dorothy Napangardi: square dots
about a pixel or two across on a 3px grid, laid in two crossing families of warped strands that
gather and part, with runs dropped out to leave dark blocks and cracks opening along the clod
edges. Nothing is a filled shape; everything is dots and the spaces the dots leave.

Two outputs from the same clods:

  A  colour   each clod wears its painting's swatch            → dirt/out/collection-soil.png
  B  cutout   each clod is a pixelated window into the painting → dirt/private/ (never committed)

B is kept out of git because it reproduces fragments of other artists' images, and the site's
standing rule is that Artsy works appear only as their three-colour token. A's manifest records
which painting every clod came from.

    python3 dirt/collection_soil.py --db path/to/artworks.db [--seed 7] [--clods 220]
"""

import argparse
import base64
import colorsys
import io
import json
import sqlite3
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
N = 256          # cells per side
CELL = 3         # pixels per cell — a dot and the gap after it
T = N * CELL     # tile size in pixels


# ---- periodic fields ----------------------------------------------------------------------------

def field(rng, lo, hi):
    """Tileable band-limited noise in [0, 1]: white noise filtered to wavelengths lo..hi cells."""
    f = np.sqrt(np.fft.fftfreq(N)[:, None] ** 2 + np.fft.fftfreq(N)[None, :] ** 2)
    band = np.exp(-((f * lo) ** 2)) - np.exp(-((f * hi) ** 2))
    out = np.real(np.fft.ifft2(np.fft.fft2(rng.standard_normal((N, N))) * band))
    return (out - out.min()) / (np.ptp(out) or 1)


def wrap(d):
    return (d + N / 2) % N - N / 2


# ---- the paintings ------------------------------------------------------------------------------

def hls(hexs):
    r, g, b = (int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    return h * 360, l, s


def load_paintings(db):
    con = sqlite3.connect(db)
    rows = con.execute(
        "select a.id, a.title, a.artist_name, a.date, a.image_url, a.artsy_url, c.position, c.hex "
        "from artworks a join artwork_colors c on c.artwork_id = a.id "
        "where a.category = 'Painting' and a.image_url is not null order by a.id, c.position"
    ).fetchall()
    works = {}
    for wid, title, artist, date, img, url, pos, hexs in rows:
        w = works.setdefault(wid, dict(id=wid, title=title, artist=artist, date=date,
                                       image=img, url=url, colors=[]))
        w["colors"].append(hexs.lower())
    return list(works.values())


def is_chocolate(hexs, lmin=0.12, lmax=0.5):
    h, l, s = hls(hexs)
    return 16 <= h <= 36 and 0.2 <= s <= 0.62 and lmin <= l <= lmax


def is_warm_pale(hexs):
    h, l, s = hls(hexs)
    return l >= 0.62 and (s < 0.15 or 15 <= h <= 60)


# ---- the clods ----------------------------------------------------------------------------------

def clods(rng, k):
    """A warped, weighted, periodic Voronoi. Returns labels, edge distance and local offsets."""
    pts = rng.uniform(0, N, (k, 2))
    weight = rng.gamma(2.0, 2.2, k)                 # a few big clods among many small ones
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
    ox = wrap(xx - pts[lab, 0])                     # unwarped offset from the clod's own centre
    oy = wrap(yy - pts[lab, 1])
    return lab, (d2 - d1) / 2, ox, oy


def relief(edge):
    """Three-step shading from the edge-distance slope, lit from the upper left."""
    e = np.minimum(edge, 5)
    gx = (np.roll(e, -1, 1) - np.roll(e, 1, 1)) / 2
    gy = (np.roll(e, -1, 0) - np.roll(e, 1, 0)) / 2
    lit = -(gx * -0.6 + gy * -0.8)                  # toward the light is positive
    return np.select([lit > 0.25, lit < -0.25], [1.14, 0.8], 1.0)


# ---- the weave ----------------------------------------------------------------------------------

def weave(rng, edge):
    """Per cell: dot size in pixels (0 = gap, where the blacks show)."""
    yy, xx = np.mgrid[0:N, 0:N].astype(float)
    # Two families of strands, each warped so they gather and part.
    a = np.cos(2 * np.pi * (yy / 2.6 + (field(rng, 8, 90) - 0.5) * 5))
    b = np.cos(2 * np.pi * (xx / 3.1 + (field(rng, 8, 90) - 0.5) * 5))
    density = field(rng, 4, 40)
    blocks = field(rng, 3, 24) < 0.22               # runs dropped out: the dark blocks
    on_a = a > -0.1 - density * 0.9
    on_b = b > 0.4 - density * 0.9
    size = np.where(on_a | on_b, 2, 0)
    size = np.where(on_a & on_b & (density > 0.55), 3, size)     # crowded strands swell
    size = np.where((size == 2) & (density < 0.3), 1, size)      # thin ones shrink
    size[blocks & (density < 0.6)] = 0
    size[edge < 0.9] = 0                                         # cracks between clods
    return size


def paint(size, colors):
    """Lay each cell's dot (top-left aligned in its cell) over a transparent tile."""
    img = np.zeros((T, T, 4), np.uint8)
    for s in (1, 2, 3):
        ys, xs = np.nonzero(size == s)
        for dy in range(s):
            for dx in range(s):
                img[ys * CELL + dy, xs * CELL + dx, :3] = colors[ys, xs]
                img[ys * CELL + dy, xs * CELL + dx, 3] = 255
    return img


# ---- cutouts ------------------------------------------------------------------------------------

def fetch(url, cache):
    cache.mkdir(parents=True, exist_ok=True)
    path = cache / (url.split("/")[-2] + ".jpg")
    if not path.exists():
        path.write_bytes(urllib.request.urlopen(url, timeout=60).read())
    return np.asarray(Image.open(path).convert("RGB"), dtype=float)


def densest(img, hexs, win):
    """Pixel centre of the win×win window where the painting is closest to `hexs`."""
    target = np.array([int(hexs[i:i + 2], 16) for i in (1, 3, 5)], float)
    close = np.exp(-np.sum((img - target) ** 2, -1) / (2 * 28.0 ** 2))
    c = np.cumsum(np.cumsum(np.pad(close, ((1, 0), (1, 0))), 0), 1)
    h, w = close.shape
    win = int(max(3, min(win, h - 1, w - 1)))
    s = c[win:, win:] - c[:-win, win:] - c[win:, :-win] + c[:-win, :-win]
    y, x = np.unravel_index(np.argmax(s), s.shape)
    return y + win / 2, x + win / 2


# ---- main ---------------------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--clods", type=int, default=220)
    ap.add_argument("--out", default=str(HERE / "out"))
    ap.add_argument("--private", default=str(HERE / "private"))
    ap.add_argument("--no-cutouts", action="store_true")
    args = ap.parse_args()
    rng = np.random.default_rng(args.seed)

    works = load_paintings(args.db)
    pool = []                                       # one chocolate swatch per painting
    for w in works:
        choc = [c for c in w["colors"] if is_chocolate(c)]
        if choc:
            pale = [c for c in w["colors"] if is_warm_pale(c)]
            pool.append(dict(work=w, hex=min(choc, key=lambda c: abs(hls(c)[0] - 25)),
                             glint=max(pale, key=lambda c: hls(c)[1]) if pale else None))
    grounds = [(w, c) for w in works for c in w["colors"] if is_chocolate(c, 0.04, 0.13)]
    ground_work, ground_hex = min(grounds, key=lambda wc: hls(wc[1])[1] + abs(hls(wc[1])[0] - 22) / 400)

    lab, edge, ox, oy = clods(rng, args.clods)
    k = args.clods
    soil = field(rng, 20, 160)                      # where the ground is darker or lighter
    target = np.array([soil[lab == i].mean() if (lab == i).any() else 0.5 for i in range(k)])
    target = 0.16 + 0.32 * (np.argsort(np.argsort(target)) / max(1, k - 1))   # spread over L

    rng.shuffle(pool)
    used, assign = set(), []
    for i in np.argsort(-np.bincount(lab.ravel(), minlength=k)):          # biggest clods pick first
        cands = [p for p in pool if p["work"]["id"] not in used]
        best = min(cands[:400], key=lambda p: abs(hls(p["hex"])[1] - target[i]) + rng.uniform(0, 0.03))
        used.add(best["work"]["id"])
        assign.append((i, best))
    assign = dict(assign)

    size = weave(rng, edge)
    shade = relief(edge)
    glint = (rng.random((N, N)) < 0.035) & (size > 0)

    rgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)
    base = np.stack([rgb(assign[i]["hex"]) for i in range(k)])
    glints = np.stack([rgb(assign[i]["glint"] or assign[i]["hex"]) for i in range(k)])
    has_glint = np.array([assign[i]["glint"] is not None for i in range(k)])

    col = base[lab] * shade[..., None]
    g = glint & has_glint[lab]
    col[g] = glints[lab][g]
    colour = paint(size, np.clip(col, 0, 255).astype(np.uint8))

    # The blacks: every pixel no dot covers. Kept as its own layer and flattened under A.
    blacks = np.zeros((T, T, 4), np.uint8)
    blacks[..., :3] = rgb(ground_hex)
    blacks[..., 3] = 255 - colour[..., 3]
    flat = colour.copy()
    flat[colour[..., 3] == 0] = blacks[colour[..., 3] == 0]

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    Image.fromarray(flat, "RGBA").save(out / "collection-soil.png", optimize=True)
    Image.fromarray(colour, "RGBA").save(out / "collection-soil-dots.png", optimize=True)
    Image.fromarray(blacks, "RGBA").save(out / "collection-soil-blacks.png", optimize=True)

    ref = lambda w: dict(id=w["id"], title=w["title"], artist=w["artist"], date=w["date"], url=w["url"])
    manifest = dict(
        note="Collection soil: every clod is one saved painting, in one of its three dominant colours.",
        seed=args.seed, tile=T, cell=CELL, grid=N,
        ground=dict(hex=ground_hex, work=ref(ground_work)),
        clods=[dict(clod=i, hex=assign[i]["hex"], glint=assign[i]["glint"], work=ref(assign[i]["work"]),
                    cells=int((lab == i).sum())) for i in range(k)],
        labels=base64.b64encode(lab.astype(np.uint8).tobytes()).decode(),
    )
    (out / "collection-soil.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False))
    print(f"A  {out / 'collection-soil.png'}  {k} clods from {len(used)} paintings, ground {ground_hex}")

    if args.no_cutouts:
        return
    # B: the same clods and the same weave, each clod a window into its own painting, centred
    # where that painting is densest in the swatch it gave A.
    priv = Path(args.private)
    col_b = np.zeros((N, N, 3))
    for i in range(k):
        cells = lab == i
        if not cells.any():
            continue
        p = assign[i]
        img = fetch(p["work"]["image"].replace("large.jpg", "medium.jpg"), priv / "cache")
        h, w = img.shape[:2]
        span = max(np.ptp(ox[cells]), np.ptp(oy[cells]), 4) + 1
        px = max(1.0, 0.35 * min(h, w) / span)                        # painting px per cell
        cy, cx = densest(img, p["hex"], span * px)
        ys = np.clip((cy + oy[cells] * px).astype(int), 0, h - 1)
        xs = np.clip((cx + ox[cells] * px).astype(int), 0, w - 1)
        r = max(0, int(px // 2))
        acc = np.zeros((cells.sum(), 3))
        for dy in (-r, 0, r):                                          # a small box average per dot
            for dx in (-r, 0, r):
                acc += img[np.clip(ys + dy, 0, h - 1), np.clip(xs + dx, 0, w - 1)]
        col_b[cells] = acc / 9
        manifest["clods"][i]["crop"] = dict(cx=round(float(cx) / w, 3), cy=round(float(cy) / h, 3),
                                            scale=round(px / w, 4))
    col_b *= shade[..., None]
    cut = paint(size, np.clip(col_b, 0, 255).astype(np.uint8))
    flat_b = cut.copy()
    flat_b[cut[..., 3] == 0] = blacks[cut[..., 3] == 0]
    priv.mkdir(parents=True, exist_ok=True)
    Image.fromarray(flat_b, "RGBA").save(priv / "collection-soil-cutouts.png", optimize=True)
    (priv / "collection-soil-cutouts.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False))
    print(f"B  {priv / 'collection-soil-cutouts.png'}")


if __name__ == "__main__":
    main()
