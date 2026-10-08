#!/usr/bin/env python3
"""The ground under each building, for the DIRT view — free data, read once.

For every building in docs/v2/architecture.json, every museum in
docs/v2/museums.json (scripts/build_museums.py), every place of a notable
life in docs/v2/lifeplaces.json (scripts/build_life_places.py), and every
city's skyline in docs/v2/cityplaces.json (scripts/build_city_places.py: its
own side and cell count, 3-8 km and ~40 m a cell), this writes
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

A city's skyline also keeps its green — parks, gardens, lawns, cemeteries,
woods (Overture's land use and land, "g") — and its grid is cut as fine as
the cities' pass has raised it (docs/v2/grounds/REFINE.md). Every ground says
which Overture release it was read from and when ("release", "read");
--release latest reads the newest release on the bucket.

    python3 scripts/build_grounds.py [--force] [--only slug] [--release latest|2026-09-23.1]
"""

import argparse
import datetime
import io
import json
import math
import sys
import time
import urllib.error
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
LIFEPLACES = ROOT / "docs" / "v2" / "lifeplaces.json"     # the notable lives' places (build_life_places.py)
CITYPLACES = ROOT / "docs" / "v2" / "cityplaces.json"     # the cities' skylines (build_city_places.py)
OUT = ROOT / "docs" / "v2" / "grounds"

RELEASE = "2026-09-23.0"
BUCKET = "overturemaps-us-west-2/release/" + RELEASE
TERRAIN = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"

GRID = 80                     # cells a side (a city's skyline gives its own n)
SIDE = {                      # metres a side, by how exactly the point is known
    "exact": 560, "street": 700, "district": 3600, "town": 2400, "region": 9000,
}
BIGGEST = 25000               # m²: larger than any one roof on these grounds
FLOOR = 3.2                   # metres a storey, where only storeys are given
ROAD_WIDTH = {                # metres, by Overture's road class
    "motorway": 22, "trunk": 18, "primary": 14, "secondary": 12, "tertiary": 10,
    "residential": 8, "living_street": 6, "unclassified": 7, "service": 5,
}
# A city's green (its skyline only): Overture's land use by class, and its land by subtype.
GREEN_USE = {"park", "dog_park", "village_green", "garden", "flowerbed", "allotments", "grass",
             "pitch", "playground", "recreation_ground", "cemetery", "grave_yard", "golf_course",
             "green", "fairway", "rough", "driving_range", "meadow", "nature_reserve", "orchard",
             "vineyard", "plant_nursery", "greenfield", "farmland", "grassland", "heath"}
GREEN_LAND = {"forest", "grass", "shrub", "wetland"}

S3 = pafs.S3FileSystem(anonymous=True, region="us-west-2")


def latest_release():
    """The newest release on Overture's public bucket (a release is a date, then a patch: 2026-09-23.1)."""
    infos = S3.get_file_info(pafs.FileSelector("overturemaps-us-west-2/release/", recursive=False))
    names = [i.base_name for i in infos if i.base_name[:2] == "20"]
    return max(names, key=lambda r: tuple(int(x) for x in r.replace("-", ".").split(".")))


def use_release(release):
    global RELEASE, BUCKET
    RELEASE = latest_release() if release == "latest" else release
    BUCKET = "overturemaps-us-west-2/release/" + RELEASE
    return RELEASE


def local(lat, lon):
    """Degrees to metres east/north of (lat, lon), and back."""
    k = 111320.0
    c = math.cos(math.radians(lat))
    return (lambda x, y: ((x - lon) * k * c, (y - lat) * k),
            lambda e, n: (lon + e / (k * c), lat + n / k))


COLUMNS = {("base", "water"): ["subtype", "class"],
           ("transportation", "segment"): ["subtype", "class"],
           ("buildings", "building"): ["height", "num_floors"]}
GREEN_COLUMNS = {("base", "land_use"): ["subtype", "class"],     # read for the cities' skylines only
                 ("base", "land"): ["subtype", "class"]}


def only(theme, kind):
    """What of a theme is wanted at all (the green's classes), as a filter, or None for everything."""
    if (theme, kind) == ("base", "land_use"):
        return ds.field("class").isin(sorted(GREEN_USE))
    if (theme, kind) == ("base", "land"):
        return ds.field("subtype").isin(sorted(GREEN_LAND))
    return None
FETCHED = {}                  # (theme, kind) -> rows, read once for many places


def prefetch(boxes, green=False):
    """Read each theme once for every square at the same time. Overture's
    files are sorted by place, so one pass over the planet's index serves a
    batch of places nearly as cheaply as one; each place then takes its own
    rows. `green`: the batch has a city's skyline, which keeps its green."""
    f = None
    for west, south, east, north in boxes:
        one = ((ds.field("bbox", "xmax") > west) & (ds.field("bbox", "xmin") < east) &
               (ds.field("bbox", "ymax") > south) & (ds.field("bbox", "ymin") < north))
        f = one if f is None else f | one
    themes = {**COLUMNS, **(GREEN_COLUMNS if green else {})}
    for (theme, kind), columns in themes.items():
        d = ds.dataset(f"{BUCKET}/theme={theme}/type={kind}/", filesystem=S3, format="parquet")
        want = only(theme, kind)
        scan = d.scanner(columns=columns + ["geometry", "bbox"], filter=f if want is None else f & want,
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
    if only(theme, kind) is not None:
        f = f & only(theme, kind)
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

    def fetch(url):
        # The bucket now and then answers a tile it has with 404 or a dropped line: asked again, it comes.
        for wait in (2, 4, 8, 16, 0):
            try:
                with urllib.request.urlopen(url, timeout=60) as r:
                    return r.read()
            except (urllib.error.URLError, OSError):
                if not wait:
                    raise
                time.sleep(wait)

    for tx in range(int(x0), int(x1) + 1):
        for ty in range(int(y0), int(y1) + 1):
            im = np.asarray(Image.open(io.BytesIO(fetch(TERRAIN.format(z=z, x=tx, y=ty)))).convert("RGB"),
                            dtype=np.float64)
            tiles[(tx, ty)] = im[..., 0] * 256 + im[..., 1] + im[..., 2] / 256 - 32768

    def at(lon_, lat_):
        x, y = tile_xy(lon_, lat_)
        tx, ty = int(x), int(y)
        px = min(255, int((x - tx) * 256))
        py = min(255, int((y - ty) * 256))
        return tiles[(tx, ty)][py, px]
    return at


def side_of(b):
    """Metres a side: a city's skyline gives its own (build_city_places.py), else by precision."""
    return b.get("side") or SIDE.get(b.get("precision"), SIDE["town"])


def square(b):
    """The square round a place, in degrees: west, south, east, north."""
    side = side_of(b)
    to_m, to_deg = local(b["lat"], b["lon"])
    w, s = to_deg(-side / 2, -side / 2)
    e, n = to_deg(side / 2, side / 2)
    return (w, s, e, n)


def build(b):
    lat, lon = b["lat"], b["lon"]
    side = side_of(b)
    N = b.get("n") or GRID       # a city's skyline is finer than 80 a side
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

    def within(geom):
        """The cells whose middles the geometry holds, as a mask over the whole grid. Only the cells
        under its bounds are tested (the same answer as testing every cell, which a fine city's grid
        of 300,000 cells and 50,000 buildings could not afford)."""
        mask = np.zeros((N, N), bool)
        x0, y0, x1, y1 = geom.bounds
        j0, j1 = max(0, int((x0 + half) // cell)), min(N - 1, int((x1 + half) // cell))
        i0, i1 = max(0, int((half - y1) // cell)), min(N - 1, int((half - y0) // cell))
        if i0 <= i1 and j0 <= j1:
            mask[i0:i1 + 1, j0:j1 + 1] = shapely.contains_xy(geom, gx[i0:i1 + 1, j0:j1 + 1],
                                                             gy[i0:i1 + 1, j0:j1 + 1])
        return mask

    kind = np.full((N, N), ".", dtype="<U1")
    tall = np.zeros((N, N))
    city = b.get("precision") == "city"

    for row in overture("base", "water", ["subtype", "class"], box):
        g = to_local(shapely.from_wkb(row["geometry"]))
        if g.geom_type in ("LineString", "MultiLineString"):
            g = g.buffer(max(cell * 0.6, 6))
        if g.area:
            kind[within(g)] = "~"

    # A city's green, under its streets and buildings: parks, gardens, lawns, pitches, cemeteries, woods.
    if city:
        for theme, kind_ in (("base", "land_use"), ("base", "land")):
            for row in overture(theme, kind_, ["subtype", "class"], box):
                if theme == "base" and kind_ == "land_use" and row.get("class") not in GREEN_USE:
                    continue
                if kind_ == "land" and row.get("subtype") not in GREEN_LAND:
                    continue
                g = to_local(shapely.from_wkb(row["geometry"]))
                if g.area:
                    kind[within(g) & (kind == ".")] = "g"

    # A city's skyline keeps its streets, not every lane and drive: under 8 m wide they are left out
    # where a cell is ~40 m, and kept from 6 m where the grid has been cut finer than 22 m.
    least = 8 if cell > 22 else 6
    for row in overture("transportation", "segment", ["subtype", "class"], box):
        if row.get("subtype") != "road":
            continue
        width = ROAD_WIDTH.get(row.get("class") or "", 0)
        if not width:
            continue
        if city and width < least:
            continue
        reach = width / 2 + cell * 0.12 if city else max(width / 2, cell * 0.45)
        g = to_local(shapely.from_wkb(row["geometry"])).buffer(reach)
        inside = within(g) & (kind != "~")
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
        inside = within(g)
        if not inside.any():
            # A city's skyline (~40 m a cell) keeps a house that misses every cell's middle only
            # if it is a good part of a cell: else the whole town would be roofs.
            if b.get("precision") == "city" and g.area < 0.3 * cell * cell:
                continue
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
    # A tile's broken pixel reads as a pit hundreds of metres deep (New York's at zoom 12: -823 m),
    # which lifted all the land of a finer city far above its water: a cell more than 60 m off the
    # middle of its eight neighbours takes that middle.
    pad = np.pad(ground, 1, mode="edge")
    mid = np.median(np.stack([pad[1 + di:N + 1 + di, 1 + dj:N + 1 + dj]
                              for di in (-1, 0, 1) for dj in (-1, 0, 1)]), axis=0)
    odd = np.abs(ground - mid) > 60
    ground[odd] = mid[odd]
    # The sea is where the ground is at or below it and nothing else is said.
    kind[(ground <= 0.3) & (kind == ".")] = "~"
    base = float(ground[kind != "~"].min()) if (kind != "~").any() else 0.0
    if city and (kind != "~").any():
        # A city's piers and wharves stand over the riverbed (Manhattan's over -15 m and lower): its land
        # is measured from its lowest hundredth, so a pier does not lift the whole city off its water.
        base = float(np.percentile(ground[kind != "~"], 1))
    ground = np.clip(ground - base, 0, None)

    return {
        "slug": b["slug"],
        "side": side,
        "n": N,
        # Half-metres above the lowest land, row by row from the north.
        "ground": [int(round(v * 2)) for v in ground.ravel()],
        # "." land, "~" water, "=" road, "b" building; a city's skyline also "g", its green.
        "kind": "".join(kind.ravel()),
        # Storeys standing on each cell, as one character each (0-9, then on).
        "tall": "".join(chr(48 + min(74, int(round(v / FLOOR)))) if v else "0"
                        for v in tall.ravel()),
        "buildings": count,
        # Which of Overture's releases it was read from, and when.
        "release": RELEASE,
        "read": datetime.date.today().isoformat(),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--only")
    parser.add_argument("--release", default=None,
                        help="an Overture release (2026-09-23.1), or 'latest' for the newest on the bucket")
    args = parser.parse_args()
    if args.release:
        print(f"Overture release {use_release(args.release)}", flush=True)

    places = json.loads(BUILDINGS.read_text(encoding="utf-8"))["buildings"]
    if MUSEUMS.exists():
        places += json.loads(MUSEUMS.read_text(encoding="utf-8"))["museums"]
    if LIFEPLACES.exists():
        places += json.loads(LIFEPLACES.read_text(encoding="utf-8"))["places"]
    if CITYPLACES.exists():
        places += json.loads(CITYPLACES.read_text(encoding="utf-8"))["places"]
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
        kinds = {k: g["kind"].count(k) for k in ".~=bg" if k in g["kind"]}
        return f"  + {b['name']}: {g['buildings']} buildings, {kinds}"

    for batch in batches:
        FETCHED.clear()
        if len(batch) > 3:
            prefetch([square(b) for b in batch], green=any(b.get("precision") == "city" for b in batch))
        with ThreadPoolExecutor(max_workers=1) as pool:
            for line in pool.map(one, batch):
                print(line, flush=True)
    print(f"{len(todo)} written, {len(buildings) - len(todo)} already there")
    sys.exit(0)


if __name__ == "__main__":
    main()
