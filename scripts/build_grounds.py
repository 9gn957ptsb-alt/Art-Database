#!/usr/bin/env python3
"""The ground under each building, for the DIRT view — free data, read once.

For every building in docs/v2/architecture.json, and every museum in
docs/v2/museums.json (scripts/build_museums.py), this writes
docs/v2/grounds/<slug>.json: a square of the Earth round its point, cut into
a grid, each cell saying what it is (land, water, road or building), how high
the ground is there and how tall anything standing on it is. land.js draws it
in DIRT — a clod of the soil, turning slowly — so nothing is fetched from a
paid map when someone looks at it.

Where it comes from, all open and free to use:
  * buildings, roads and water: Overture Maps (overturemaps.org), read
    anonymously from its public bucket on Amazon S3 — largely OpenStreetMap,
    © OpenStreetMap contributors, ODbL;
  * the ground's height: the Terrain Tiles on AWS (Mapzen's terrarium tiles),
    a public dataset of SRTM, GMTED and other open elevation sources.

The square is as exact as the building's point: a public building's own
grounds, or — for a private home, which is never pinned — its town. Run after
build_architecture.py; a place already written is skipped unless --force.

    python3 scripts/build_grounds.py [--force] [--only slug]
"""

import argparse
import io
import json
import math
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import pyarrow.dataset as ds
import pyarrow.fs as pafs
import shapely
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BUILDINGS = ROOT / "docs" / "v2" / "architecture.json"
MUSEUMS = ROOT / "docs" / "v2" / "museums.json"
OUT = ROOT / "docs" / "v2" / "grounds"

RELEASE = "2026-09-23.0"
BUCKET = "overturemaps-us-west-2/release/" + RELEASE
TERRAIN = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"

N = 80                        # cells a side
SIDE = {                      # metres a side, by how exactly the point is known
    "exact": 560, "street": 700, "district": 3600, "town": 2400, "region": 9000,
}
BIGGEST = 25000               # m²: larger than any one roof on these grounds
FLOOR = 3.2                   # metres a storey, where only storeys are given
ROAD_WIDTH = {                # metres, by Overture's road class
    "motorway": 22, "trunk": 18, "primary": 14, "secondary": 12, "tertiary": 10,
    "residential": 8, "living_street": 6, "unclassified": 7, "service": 5,
}

S3 = pafs.S3FileSystem(anonymous=True, region="us-west-2")


def local(lat, lon):
    """Degrees to metres east/north of (lat, lon), and back."""
    k = 111320.0
    c = math.cos(math.radians(lat))
    return (lambda x, y: ((x - lon) * k * c, (y - lat) * k),
            lambda e, n: (lon + e / (k * c), lat + n / k))


COLUMNS = {("base", "water"): ["subtype", "class"],
           ("transportation", "segment"): ["subtype", "class"],
           ("buildings", "building"): ["height", "num_floors"]}
FETCHED = {}                  # (theme, kind) -> rows, read once for many places


def prefetch(boxes):
    """Read each theme once for every square at the same time. Overture's
    files are sorted by place, so one pass over the planet's index serves a
    batch of places nearly as cheaply as one; each place then takes its own
    rows."""
    f = None
    for west, south, east, north in boxes:
        one = ((ds.field("bbox", "xmax") > west) & (ds.field("bbox", "xmin") < east) &
               (ds.field("bbox", "ymax") > south) & (ds.field("bbox", "ymin") < north))
        f = one if f is None else f | one
    for (theme, kind), columns in COLUMNS.items():
        d = ds.dataset(f"{BUCKET}/theme={theme}/type={kind}/", filesystem=S3, format="parquet")
        scan = d.scanner(columns=columns + ["geometry", "bbox"], filter=f,
                         batch_readahead=2, fragment_readahead=2)
        rows = []
        for batch in scan.to_batches():
            rows.extend(batch.to_pylist())
        FETCHED[(theme, kind)] = rows
        print(f"  read {theme}/{kind}: {len(rows)} for {len(boxes)} places", flush=True)


def overture(theme, kind, columns, box):
    west, south, east, north = box
    if (theme, kind) in FETCHED:
        return [r for r in FETCHED[(theme, kind)]
                if r["bbox"]["xmax"] > west and r["bbox"]["xmin"] < east
                and r["bbox"]["ymax"] > south and r["bbox"]["ymin"] < north]
    d = ds.dataset(f"{BUCKET}/theme={theme}/type={kind}/", filesystem=S3, format="parquet")
    f = ((ds.field("bbox", "xmax") > west) & (ds.field("bbox", "xmin") < east) &
         (ds.field("bbox", "ymax") > south) & (ds.field("bbox", "ymin") < north))
    # Read a few files at a time: the planet is large, and only what falls
    # in the square is kept.
    scan = d.scanner(columns=columns + ["geometry"], filter=f,
                     batch_readahead=2, fragment_readahead=2)
    rows = []
    for batch in scan.to_batches():
        rows.extend(batch.to_pylist())
    return rows


def terrain(box, cell, lat):
    """The height of the ground, sampled on the grid, from terrarium tiles."""
    west, south, east, north = box
    z = int(max(9, min(15, math.floor(math.log2(156543.0 * math.cos(math.radians(lat)) / cell)))))

    def tile_xy(lon_, lat_):
        n = 2 ** z
        x = (lon_ + 180.0) / 360.0 * n
        r = math.radians(lat_)
        y = (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n
        return x, y

    x0, y0 = tile_xy(west, north)
    x1, y1 = tile_xy(east, south)
    tiles = {}
    for tx in range(int(x0), int(x1) + 1):
        for ty in range(int(y0), int(y1) + 1):
            with urllib.request.urlopen(TERRAIN.format(z=z, x=tx, y=ty), timeout=60) as r:
                im = np.asarray(Image.open(io.BytesIO(r.read())).convert("RGB"), dtype=np.float64)
            tiles[(tx, ty)] = im[..., 0] * 256 + im[..., 1] + im[..., 2] / 256 - 32768

    def at(lon_, lat_):
        x, y = tile_xy(lon_, lat_)
        tx, ty = int(x), int(y)
        px = min(255, int((x - tx) * 256))
        py = min(255, int((y - ty) * 256))
        return tiles[(tx, ty)][py, px]
    return at


def square(b):
    """The square round a place, in degrees: west, south, east, north."""
    side = SIDE.get(b.get("precision"), SIDE["town"])
    to_m, to_deg = local(b["lat"], b["lon"])
    w, s = to_deg(-side / 2, -side / 2)
    e, n = to_deg(side / 2, side / 2)
    return (w, s, e, n)


def build(b):
    lat, lon = b["lat"], b["lon"]
    side = SIDE.get(b.get("precision"), SIDE["town"])
    cell = side / N
    to_m, to_deg = local(lat, lon)
    half = side / 2
    box = square(b)

    # Cell centres, row 0 at the north.
    xs = (np.arange(N) + 0.5) * cell - half
    ys = half - (np.arange(N) + 0.5) * cell
    gx, gy = np.meshgrid(xs, ys)

    def to_local(geom):
        return shapely.transform(geom, lambda c: np.column_stack(
            to_m(c[:, 0], c[:, 1])))

    kind = np.full((N, N), ".", dtype="<U1")
    tall = np.zeros((N, N))

    for row in overture("base", "water", ["subtype", "class"], box):
        g = to_local(shapely.from_wkb(row["geometry"]))
        if g.geom_type in ("LineString", "MultiLineString"):
            g = g.buffer(max(cell * 0.6, 6))
        if g.area:
            kind[shapely.contains_xy(g, gx, gy)] = "~"

    for row in overture("transportation", "segment", ["subtype", "class"], box):
        if row.get("subtype") != "road":
            continue
        width = ROAD_WIDTH.get(row.get("class") or "", 0)
        if not width:
            continue
        g = to_local(shapely.from_wkb(row["geometry"])).buffer(max(width / 2, cell * 0.45))
        inside = shapely.contains_xy(g, gx, gy) & (kind != "~")
        kind[inside] = "="

    count = 0
    for row in overture("buildings", "building", ["height", "num_floors"], box):
        g = to_local(shapely.from_wkb(row["geometry"]))
        # Some maps draw a whole resort or campus as one "building" round the
        # real ones; nothing that big is one roof — except the place's own
        # building, where the point is exact (the Met is 45,000 m²).
        if g.area > BIGGEST and not (b.get("precision") in ("exact", "street")
                                     and shapely.contains_xy(g, 0.0, 0.0)):
            continue
        inside = shapely.contains_xy(g, gx, gy)
        if not inside.any():
            # Smaller than a cell: it still stands in the cell its middle is in.
            c = g.centroid
            i = int((half - c.y) // cell)
            j = int((c.x + half) // cell)
            if not (0 <= i < N and 0 <= j < N):
                continue
            inside = np.zeros((N, N), bool)
            inside[i, j] = True
        h = row.get("height") or (row.get("num_floors") or 0) * FLOOR or 2 * FLOOR
        kind[inside] = "b"
        tall[inside] = np.maximum(tall[inside], h)
        count += 1

    at = terrain(box, cell, lat)
    ground = np.array([[at(*to_deg(gx[i, j], gy[i, j])) for j in range(N)] for i in range(N)])
    # The sea is where the ground is at or below it and nothing else is said.
    kind[(ground <= 0.3) & (kind == ".")] = "~"
    base = float(ground[kind != "~"].min()) if (kind != "~").any() else 0.0
    ground = np.clip(ground - base, 0, None)

    return {
        "slug": b["slug"],
        "side": side,
        "n": N,
        # Half-metres above the lowest land, row by row from the north.
        "ground": [int(round(v * 2)) for v in ground.ravel()],
        # "." land, "~" water, "=" road, "b" building.
        "kind": "".join(kind.ravel()),
        # Storeys standing on each cell, as one character each (0-9, then on).
        "tall": "".join(chr(48 + min(74, int(round(v / FLOOR)))) if v else "0"
                        for v in tall.ravel()),
        "buildings": count,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--only")
    args = parser.parse_args()

    places = json.loads(BUILDINGS.read_text(encoding="utf-8"))["buildings"]
    if MUSEUMS.exists():
        places += json.loads(MUSEUMS.read_text(encoding="utf-8"))["museums"]
    buildings = [b for b in places if isinstance(b.get("lat"), (int, float))]
    if args.only:
        buildings = [b for b in buildings if b["slug"] == args.only]
    OUT.mkdir(parents=True, exist_ok=True)
    todo = [b for b in buildings if args.force or not (OUT / (b["slug"] + ".json")).exists()]

    # Many at once (the museums, first time round): read the planet once for
    # a batch of them, a batch at a time so memory stays small.
    BATCH = 24
    batches = [todo[k:k + BATCH] for k in range(0, len(todo), BATCH)] if len(todo) > 3 else [todo]

    def one(b):
        try:
            g = build(b)
        except Exception as exc:             # one place failing leaves the rest
            return f"  ! {b['slug']}: {type(exc).__name__}: {exc}"
        (OUT / (b["slug"] + ".json")).write_text(json.dumps(g, separators=(",", ":")),
                                                 encoding="utf-8")
        kinds = {k: g["kind"].count(k) for k in ".~=b"}
        return f"  + {b['name']}: {g['buildings']} buildings, {kinds}"

    for batch in batches:
        FETCHED.clear()
        if len(batch) > 3:
            prefetch([square(b) for b in batch])
        with ThreadPoolExecutor(max_workers=1) as pool:
            for line in pool.map(one, batch):
                print(line, flush=True)
    print(f"{len(todo)} written, {len(buildings) - len(todo)} already there")
    sys.exit(0)


if __name__ == "__main__":
    main()
