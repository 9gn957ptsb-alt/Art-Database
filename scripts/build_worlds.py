"""Build the worlds' boards: what each world looks like and how it is divided.

Every world is written the same way, on the Artist Website's half-degree grid
(720 by 360 cells, column 0 at 180 W, row 0 at 90 N):

  docs/worlds/<world>/dots.png   the look: colour = the dot's colour,
                                 alpha = its size (0, 85, 170, 255 -> 0..3)
  docs/worlds/<world>/land.png        which territory each cell belongs to:
                                 id + 1 in red + 256 * green, 0 for none
  docs/worlds/<world>/territories.json  names, centres, yields and borders

Earth's look is the Artist Website's own (docs/v2/earth-dirt/earth-dirt-MM.png,
read by the page where it is), its
territories the countries of Natural Earth (1:110m, public domain). Mars is
dressed from the Viking MDIM 2.1 colour mosaic (NASA/USGS, public domain),
each dot moved to the nearest colour the paintings put on Earth, and divided
into its named regions around their real coordinates.

Last of all, every territory is linked to the territories of the other world
that lie under the same ground: the worlds have no boundary between them.

    python3 scripts/build_worlds.py
"""

import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw

W, H = 720, 360
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "scripts", "worlds_src")
OUT = os.path.join(ROOT, "docs", "worlds")
EARTH_DOTS = os.path.join(ROOT, "docs", "v2", "earth-dirt", "earth-dirt-%02d.png")


def xy(lon, lat):
    return ((lon + 180.0) * 2.0, (90.0 - lat) * 2.0)


def cell_latlon():
    lat = 90.0 - (np.arange(H) + 0.5) / 2.0
    lon = -180.0 + (np.arange(W) + 0.5) / 2.0
    return np.meshgrid(lon, lat)


def write_ids(world, ids):
    """ids: int array, -1 for none."""
    v = (ids + 1).astype(np.int32)
    img = np.zeros((H, W, 4), np.uint8)
    img[..., 0] = v % 256
    img[..., 1] = v // 256
    img[..., 3] = 255
    Image.fromarray(img, "RGBA").save(os.path.join(OUT, world, "land.png"), optimize=True)


def borders(ids, n):
    """Pairs of territories whose cells touch (the grid wraps east to west)."""
    pairs = set()
    for a, b in ((ids, np.roll(ids, 1, axis=1)), (ids[1:], ids[:-1])):
        m = (a >= 0) & (b >= 0) & (a != b)
        for p, q in zip(a[m].tolist(), b[m].tolist()):
            pairs.add((min(p, q), max(p, q)))
    out = [set() for _ in range(n)]
    for p, q in pairs:
        out[p].add(q)
        out[q].add(p)
    return out


def arc(lat1, lon1, lat2, lon2):
    p1, p2, dl = math.radians(lat1), math.radians(lat2), math.radians(lon2 - lon1)
    c = math.sin(p1) * math.sin(p2) + math.cos(p1) * math.cos(p2) * math.cos(dl)
    return math.degrees(math.acos(max(-1.0, min(1.0, c))))


def sea_lanes(terrs, near, k=2, reach=25.0):
    """Islands and coasts across water: each territory is joined to its
    nearest neighbours by centre if the land does not already join them."""
    for i, t in enumerate(terrs):
        d = sorted(
            (arc(t["lat"], t["lon"], u["lat"], u["lon"]), j)
            for j, u in enumerate(terrs) if j != i
        )
        added = 0
        for dist, j in d:
            if added >= k or (dist > reach and near[i]):
                break
            if j not in near[i]:
                near[i].add(j)
                near[j].add(i)
            added += 1


def centre_of(ids, i, fallback):
    ys, xs = np.nonzero(ids == i)
    if not len(xs):
        return fallback
    # A circular mean of longitude, so a territory across 180 is centred on it.
    lon = -180.0 + (xs + 0.5) / 2.0
    lat = 90.0 - (ys + 0.5) / 2.0
    a = np.radians(lon)
    w = np.cos(np.radians(lat))
    mlon = math.degrees(math.atan2((np.sin(a) * w).sum(), (np.cos(a) * w).sum()))
    return (float(lat.mean()), mlon)


# ---- Earth ------------------------------------------------------------------

def build_earth():
    geo = json.load(open(os.path.join(SRC, "ne110.geojson")))
    feats = sorted(geo["features"], key=lambda f: f["properties"]["NAME"])
    canvas = Image.new("I", (W, H), 0)
    draw = ImageDraw.Draw(canvas)
    for i, f in enumerate(feats):
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        for poly in polys:
            ring = [xy(lon, lat) for lon, lat in poly[0]]
            draw.polygon(ring, fill=i + 1)
            for hole in poly[1:]:
                draw.polygon([xy(lon, lat) for lon, lat in hole], fill=0)
    ids = np.array(canvas, np.int64) - 1

    # A territory too small to own a cell is given the cell under its label.
    for i, f in enumerate(feats):
        if not (ids == i).any():
            p = f["properties"]
            x, y = xy(p["LABEL_X"], p["LABEL_Y"])
            ids[min(H - 1, int(y)), min(W - 1, int(x))] = i

    terrs = []
    for i, f in enumerate(feats):
        p = f["properties"]
        lat, lon = centre_of(ids, i, (p["LABEL_Y"], p["LABEL_X"]))
        pop = max(1, p.get("POP_EST") or 1)
        cells = int((ids == i).sum())
        # Yield: people and ground both count, on a scale of 1 to 10.
        y = 1 + round(min(6, max(0, math.log10(pop) - 4.5) * 1.6) + min(3, math.log10(cells + 1)))
        terrs.append({
            "id": i,
            "name": p["NAME"],
            "code": p.get("ADM0_A3") or p.get("ISO_A3"),
            "lat": round(p["LABEL_Y"], 2),
            "lon": round(p["LABEL_X"], 2),
            "cells": cells,
            "yield": int(min(10, y)),
            "region": p.get("CONTINENT"),
        })
    near = borders(ids, len(terrs))
    sea_lanes(terrs, near)
    for t, n in zip(terrs, near):
        t["near"] = sorted(n)
    write_ids("earth", ids)
    return ids, terrs


# ---- Mars -------------------------------------------------------------------

# Named regions at their planetocentric coordinates (degrees, east positive),
# from the IAU Gazetteer of Planetary Nomenclature.
MARS_REGIONS = [
    ("Olympus Mons", 18.65, -133.8), ("Tharsis Montes", 1.0, -112.0),
    ("Alba Mons", 40.5, -110.0), ("Valles Marineris", -13.9, -59.2),
    ("Lunae Planum", 10.0, -65.7), ("Chryse Planitia", 28.4, -40.0),
    ("Acidalia Planitia", 46.7, -22.0), ("Tempe Terra", 39.7, -71.5),
    ("Arabia Terra", 23.0, 5.0), ("Meridiani Planum", 0.2, -2.5),
    ("Margaritifer Terra", -4.4, -25.0), ("Argyre Planitia", -49.7, -43.4),
    ("Noachis Terra", -45.0, -5.0), ("Hellas Planitia", -42.4, 70.5),
    ("Terra Sabaea", 2.0, 42.0), ("Syrtis Major", 8.4, 69.5),
    ("Isidis Planitia", 12.9, 87.0), ("Tyrrhena Terra", -15.0, 90.0),
    ("Hesperia Planum", -21.4, 109.9), ("Utopia Planitia", 46.7, 117.5),
    ("Elysium Mons", 25.0, 147.0), ("Aeolis (Gale)", -5.4, 137.8),
    ("Terra Cimmeria", -32.7, 145.0), ("Promethei Terra", -64.4, 97.0),
    ("Terra Sirenum", -39.7, -150.0), ("Solis Planum", -26.4, -89.7),
    ("Aonia Terra", -60.0, -97.0), ("Amazonis Planitia", 24.8, -164.0),
    ("Arcadia Planitia", 47.2, -176.5), ("Vastitas Borealis", 70.0, 0.0),
    ("Planum Boreum", 88.0, 15.0), ("Planum Australe", -84.0, 160.0),
]


def painting_palette(keep=512):
    """The colours the paintings put on Earth's globe most often, over the year."""
    counts = {}
    for m in range(1, 13):
        a = np.array(Image.open(EARTH_DOTS % m).convert("RGBA"))
        c = a[a[..., 3] > 0][:, :3]
        u, n = np.unique(c, axis=0, return_counts=True)
        for col, k in zip(map(tuple, u.tolist()), n.tolist()):
            counts[col] = counts.get(col, 0) + k
    top = sorted(counts, key=lambda c: -counts[c])[:keep]
    return np.array(top, np.float32)


def value_noise(seed, scale):
    rng = np.random.default_rng(seed)
    g = rng.random((H // scale + 2, W // scale + 2)).astype(np.float32)
    img = Image.fromarray((g * 255).astype(np.uint8)).resize((W + 2 * scale, H + 2 * scale), Image.BICUBIC)
    return np.array(img, np.float32)[scale:scale + H, scale:scale + W] / 255.0


def build_mars():
    src = Image.open(os.path.join(SRC, "mars_viking_mdim21.jpg")).convert("RGB")
    rgb = np.array(src.resize((W, H), Image.LANCZOS), np.float32)

    # The mosaic is a narrow band of rusts; spread it over the paintings'
    # range first (its light and dark, and its colour away from grey), so the
    # nearest paintings tell the bright dust from the dark basalt.
    grey = rgb.mean(-1, keepdims=True)
    lo, hi = np.percentile(grey, [2, 98])
    g2 = (grey - lo) / (hi - lo) * 200 + 30
    rgb = np.clip(g2 + (rgb - grey) * 2.4, 0, 255)

    # Each dot in the nearest of the paintings' colours (in a rough Lab).
    pal = painting_palette(2048)

    def lab(c):
        c = c / 255.0
        return np.stack([c @ [0.3, 0.59, 0.11],
                         c[..., 0] - c[..., 1],
                         (c[..., 0] + c[..., 1]) / 2 - c[..., 2]], -1) * [1.0, 1.4, 1.4]

    flat = lab(rgb.reshape(-1, 3))
    pl = lab(pal)
    best = np.empty(len(flat), np.int64)
    for s in range(0, len(flat), 8192):
        d = ((flat[s:s + 8192, None, :] - pl[None]) ** 2).sum(-1)
        best[s:s + 8192] = d.argmin(1)
    col = pal[best].reshape(H, W, 3).astype(np.uint8)

    # The weave: Earth's globe leaves about two cells in five empty, in drifts.
    lum = (rgb @ [0.3, 0.59, 0.11]) / 255.0
    n = 0.55 * value_noise(7, 6) + 0.3 * value_noise(11, 2) + 0.15 * np.random.default_rng(3).random((H, W))
    v = 0.8 * n + 0.2 * lum
    q = np.quantile(v, [0.38, 0.62, 0.86])
    size = np.digitize(v, q).astype(np.uint8)        # 0..3
    out = np.dstack([col, (size * 85).astype(np.uint8)])
    Image.fromarray(out, "RGBA").save(os.path.join(OUT, "mars", "dots.png"), optimize=True)

    # Regions: every cell belongs to the nearest named place.
    lon, lat = cell_latlon()
    la, lo = np.radians(lat), np.radians(lon)
    best_d = np.full((H, W), -2.0)
    ids = np.zeros((H, W), np.int64)
    for i, (_, rl, rn) in enumerate(MARS_REGIONS):
        c = np.sin(la) * math.sin(math.radians(rl)) + np.cos(la) * math.cos(math.radians(rl)) * np.cos(lo - math.radians(rn))
        m = c > best_d
        best_d[m] = c[m]
        ids[m] = i
    terrs = []
    for i, (name, rl, rn) in enumerate(MARS_REGIONS):
        cells = int((ids == i).sum())
        terrs.append({
            "id": i, "name": name, "lat": rl, "lon": rn, "cells": cells,
            # No one lives there yet: Mars yields its ground and nothing else.
            "yield": int(1 + min(4, round(math.log10(cells + 1) * 1.1))),
        })
    near = borders(ids, len(terrs))
    for t, nb in zip(terrs, near):
        t["near"] = sorted(nb)
    write_ids("mars", ids)
    return ids, terrs


def crossings(ids_a, ids_b, terrs_a, terrs_b, key):
    """Each territory of one world joins the territories of the other that lie
    under its ground (the most-shared first, at most three)."""
    for i, t in enumerate(terrs_a):
        under = ids_b[ids_a == i]
        under = under[under >= 0]
        if not len(under):
            # Too small to hold a cell: the ground under its centre.
            x, y = xy(t["lon"], t["lat"])
            under = np.array([ids_b[min(H - 1, int(y)), min(W - 1, int(x))]])
        vals, counts = np.unique(under, return_counts=True)
        t[key] = [int(v) for v in vals[np.argsort(-counts)][:3] if v >= 0]


def main():
    e_ids, e = build_earth()
    m_ids, m = build_mars()
    crossings(e_ids, m_ids, e, m, "mars")
    crossings(m_ids, e_ids, m, e, "earth")
    # A crossing goes both ways.
    for t in e:
        for j in t["mars"]:
            if t["id"] not in m[j]["earth"]:
                m[j]["earth"].append(t["id"])
    for t in m:
        for j in t["earth"]:
            if t["id"] not in e[j]["mars"]:
                e[j]["mars"].append(t["id"])
    for world, terrs in (("earth", e), ("mars", m)):
        with open(os.path.join(OUT, world, "territories.json"), "w") as f:
            json.dump({"world": world, "territories": terrs}, f, separators=(",", ":"))
        print(world, len(terrs), "territories")


if __name__ == "__main__":
    main()
