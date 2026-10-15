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
    python3 scripts/build_grounds.py --heights [--only city-<key>]    # heights past 74 storeys; landmarks'; parts
    python3 scripts/build_grounds.py --bridges [--only city-<key>]    # road bridges over a city's water

A city's skyline keeps two more things the first cuts did not (14-15 Oct 2026, docs/v2/grounds/REFINE.md):
its building parts — Overture's `building_part`s, OpenStreetMap's building:part: a building mapped in tiers,
legs and spires is drawn as them (each cell the tallest part over it), not as a slab of its whole footprint
at its top height (the Empire State Building was 37 cells at 138 storeys, the Eiffel Tower 27 at 103) — and
its roads on the surface only: a stretch Overture flags `is_tunnel` is not drawn (Madrid Río's M-30,
Boston's Greenway, Stockholm's motorway tunnels, the quais of Paris were roads over parks). `--heights` brings
the parts to the grounds cut before; the tunnels come with a new cut.
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
from shapely.ops import substring

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
# The most storeys a cell says (832 m: the Burj Khalifa). It stopped at 74 (237 m) until 14 Oct 2026, when
# every tower above that — the Empire State Building, the Willis Tower, the Eiffel Tower, the CN Tower — was
# found standing at the same height; `--heights` reads those cells again for the grounds cut before.
MAX_STOREYS = 260
ROAD_WIDTH = {                # metres, by Overture's road class
    "motorway": 22, "trunk": 18, "primary": 14, "secondary": 12, "tertiary": 10,
    "residential": 8, "living_street": 6, "unclassified": 7, "service": 5,
}
RAIL_WIDTH = {"standard_gauge": 8, "light_rail": 6, "narrow_gauge": 6}   # a railway bridge's deck, metres
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
           ("transportation", "segment"): ["subtype", "class", "road_flags", "rail_flags"],
           ("buildings", "building"): ["id", "height", "num_floors"]}
GREEN_COLUMNS = {("base", "land_use"): ["subtype", "class"],     # read for the cities' skylines only
                 ("base", "land"): ["subtype", "class"],
                 ("buildings", "building_part"): ["building_id", "height", "min_height", "num_floors",
                                                  "is_underground"]}


def only(theme, kind):
    """What of a theme is wanted at all (the green's classes), as a filter, or None for everything."""
    if (theme, kind) == ("base", "land_use"):
        return ds.field("class").isin(sorted(GREEN_USE))
    if (theme, kind) == ("base", "land"):
        return ds.field("subtype").isin(sorted(GREEN_LAND))
    return None
FETCHED = {}                  # (theme, kind) -> rows, read once for many places


def prefetch(boxes, green=False, themes=None):
    """Read each theme once for every square at the same time. Overture's
    files are sorted by place, so one pass over the planet's index serves a
    batch of places nearly as cheaply as one; each place then takes its own
    rows. `green`: the batch has a city's skyline, which keeps its green and
    its building parts. `themes`: {(theme, type): columns} to read instead
    (the buildings and their parts alone, for `--heights`)."""
    f = None
    for west, south, east, north in boxes:
        one = ((ds.field("bbox", "xmax") > west) & (ds.field("bbox", "xmin") < east) &
               (ds.field("bbox", "ymax") > south) & (ds.field("bbox", "ymin") < north))
        f = one if f is None else f | one
    themes = themes or {**COLUMNS, **(GREEN_COLUMNS if green else {})}
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


def storeys_of(tall):
    """Storeys standing on each cell, as one character each (48 + the count, up to MAX_STOREYS)."""
    return "".join(chr(48 + min(MAX_STOREYS, int(round(v / FLOOR)))) if v else "0" for v in tall.ravel())


def dry_basins(rows, box, to_local, half):
    """The indexes of the water polygons that are dry land: a flood-control basin mapped as a reservoir
    (Dallas's Trinity River Floodway, 1.9 km² of its square, was drawn as a lake, the river's channel
    in the middle of it). A reservoir of half a square kilometre or more in the square is dry where
    Overture's land cover (ESA WorldCover's, which has no water in it) covers four fifths of it."""
    try:
        square_ = shapely.box(-half, -half, half, half)
        big = {}
        for k, row in enumerate(rows):
            if row.get("subtype") == "reservoir":
                g = shapely.make_valid(to_local(shapely.from_wkb(row["geometry"]))).intersection(square_)
                if g.area >= 5e5:
                    big[k] = g
        if not big:
            return set()
        cover = shapely.union_all([shapely.make_valid(to_local(shapely.from_wkb(r["geometry"])))
                                   for r in overture("base", "land_cover", ["subtype"], box)])
        dry = {k for k, g in big.items() if g.intersection(cover).area >= 0.8 * g.area}
    except Exception as exc:             # land cover out of reach: the water as it is
        print(f"  · dry basins not looked for: {type(exc).__name__}: {str(exc)[:80]}", flush=True)
        return set()
    for k in dry:
        print(f"  · a reservoir of {big[k].area / 1e6:.1f} km² in the square is dry land by its land cover", flush=True)
    return dry


def eubucco_storeys(b, box, kind, tall, gx, gy, to_local):
    """Where Overture gives a building no height (its cell stands at the default two storeys) and EUBUCCO
    gives it its register's — Spain's Catastro floors, France's BD TOPO (eubucco_heights.py) — the cell
    takes it, if that is a storey higher or more. Changes `tall`; returns the cells raised (0 where no register
    covers the place), or None where its file did not answer. Only a place in Spain or France (its slug ends
    -es or -fr): EUBUCCO's boxes take in Basel and Bern too, where its heights are a model's, not a register's
    (Basel: r = 0.37 with Overture's, 32% within 3 m; Brussels's the same)."""
    try:
        import eubucco_heights
        if not (b.get("slug") or "").endswith(("-es", "-fr")) or not eubucco_heights.covers(b["lat"], b["lon"]):
            return 0
        west, south, east, north = box
        got = eubucco_heights.polygons((south, west, north, east))
        if not got:
            return 0
        shapes = [to_local(shape) for _, shape in got]
        heights = np.array([h for h, _ in got])
        q = np.flatnonzero(kind.reshape(-1) == "b")
        pts = shapely.points(gx.reshape(-1)[q], gy.reshape(-1)[q])
        pi, gi = shapely.STRtree(shapes).query(pts, predicate="within")
        best = np.zeros(len(q))
        np.maximum.at(best, pi, heights[gi])
        flat = tall.reshape(-1)
        rise = (flat[q] <= 2 * FLOOR + 1e-6) & (best >= 3 * FLOOR)
        flat[q[rise]] = best[rise]
        raised = int(rise.sum())
    except Exception as exc:             # EUBUCCO out of reach: the heights Overture has
        print(f"  · EUBUCCO's heights not used: {type(exc).__name__}: {str(exc)[:80]}", flush=True)
        return None
    print(f"  · EUBUCCO's register: {raised} building cells that stood at two storeys rise to their buildings' heights",
          flush=True)
    return raised


def landmark_rises(b, box, geoms, to_m):
    """{index of a building: [(x, y, metres)]}: the heights Wikidata gives landmarks (wikidata_heights.py),
    each given to the building its point stands in — the largest where several do — else the nearest within
    10 m of at least 150 m². Overture's heights are mostly missing, and a landmark's own is often a podium's
    or a machine's: the Willis Tower stood at 31 m. Nothing is given where Wikidata does not answer."""
    try:
        import wikidata_heights
        west, south, east, north = box
        marks = wikidata_heights.landmarks(b["slug"], (south, west, north, east))
        if not marks or not geoms:
            return {}
        x, y = to_m(np.array([m[1] for m in marks]), np.array([m[0] for m in marks]))
        pts = shapely.points(x, y)
        tree = shapely.STRtree(geoms)
        got = {}
        for pi, gi in zip(*tree.query(pts, predicate="within")):
            if pi not in got or geoms[gi].area > geoms[got[pi]].area:
                got[pi] = gi
        miss = [i for i in range(len(marks)) if i not in got]
        if miss:
            for pi, gi in zip(*tree.query_nearest(pts[miss], max_distance=10, all_matches=False)):
                if geoms[gi].area >= 150:
                    got[miss[pi]] = gi
    except Exception as exc:             # Wikidata, or the geometry, out of reach: the heights Overture has
        print(f"  · Wikidata's heights not used: {type(exc).__name__}: {str(exc)[:80]}", flush=True)
        return None
    out = {}
    for pi, gi in got.items():
        out.setdefault(int(gi), []).append((float(x[pi]), float(y[pi]), marks[pi][2]))
    print(f"  · {len(got)} of {len(marks)} landmarks with a height stand in a building", flush=True)
    return out


def bridge_mask(segments, cell, least, to_local, within, N):
    """The cells under the decks of road bridges, as a mask. A road is not drawn over water, so a river
    ran unbroken from bank to bank (the Seine, the Thames, the Han, the Rhine under the Hohenzollern
    Bridge); Overture flags a bridge on its segment (`road_flags`: `is_bridge`, the whole segment, or the
    stretch of it between two fractions of its length; a railway's in `rail_flags`). Only what a skyline
    keeps — roads and main-line railways, not a footbridge or a path, as their streets are left out."""
    mask = np.zeros((N, N), bool)
    for row in segments:
        if row.get("subtype") == "rail":
            width, flags = RAIL_WIDTH.get(row.get("class") or "", 0), row.get("rail_flags")
        elif row.get("subtype") == "road":
            width, flags = ROAD_WIDTH.get(row.get("class") or "", 0), row.get("road_flags")
        else:
            continue
        if not width or width < least:
            continue
        for flag in flags or []:
            if "is_bridge" not in (flag.get("values") or []):
                continue
            g = to_local(shapely.from_wkb(row["geometry"]))
            span = flag.get("between")
            if span and g.geom_type == "LineString" and g.length and (span[0] > 0 or span[1] < 1):
                g = substring(g, span[0], span[1], normalized=True)
            if g.is_empty:
                continue
            mask |= within(g.buffer(width / 2 + cell * 0.12))
    return mask


def surface(g, flags):
    """A road segment's geometry without its tunnelled stretches: a road under a park, a river or a
    street (Madrid Río's M-30, Boston's Greenway, the quais of Paris) is not on the ground, so no cell of
    the surface is a road there. Overture flags a tunnel on the segment (`road_flags`: `is_tunnel`, the
    whole segment, or the stretch of it between two fractions of its length). None where all of it is."""
    spans = []
    for flag in flags or []:
        if "is_tunnel" not in (flag.get("values") or []):
            continue
        span = flag.get("between")
        if not span:
            return None
        spans.append((max(0.0, float(span[0])), min(1.0, float(span[1]))))
    if not spans or g.geom_type != "LineString" or not g.length:
        return g
    keep, at = [], 0.0
    for a, z in sorted(spans):
        if a > at:
            keep.append((at, a))
        at = max(at, z)
    if at < 1:
        keep.append((at, 1.0))
    pieces = [substring(g, a, z, normalized=True) for a, z in keep if z - a > 1e-6]
    pieces = [p for p in pieces if p.geom_type == "LineString" and p.length > 0]
    return shapely.MultiLineString(pieces) if pieces else None


def building_parts(box, to_local):
    """{id of a building: [(geometry, top, bottom)]}: Overture's `building_part`s (OpenStreetMap's
    building:part — the tiers, towers, legs and spires of a building mapped in parts), each with the metres
    of its top and where it starts (`min_height`: an arch's top starts above the street). Below ground,
    without a height, or as big as a campus, a part says nothing a skyline can draw."""
    out = {}
    for row in overture("buildings", "building_part", ["building_id", "height", "min_height", "num_floors",
                                                       "is_underground"], box):
        top = row.get("height") or (row.get("num_floors") or 0) * FLOOR
        if row.get("is_underground") or not top or not row.get("building_id"):
            continue
        g = to_local(shapely.from_wkb(row["geometry"]))
        if g.is_empty or not g.area or g.area > BIGGEST:
            continue
        out.setdefault(row["building_id"], []).append((g, float(top), float(row.get("min_height") or 0)))
    return out


def build(b, only=None):
    """A place's ground. `only` reads part of it for a repair: "tall" the buildings and their heights
    (`--heights`), "bridges" the cells under road bridges (`--bridges`)."""
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

    waters = [] if only else overture("base", "water", ["subtype", "class"], box)
    dry = dry_basins(waters, box, to_local, half) if city else set()
    for k, row in enumerate(waters):
        if k in dry:
            continue
        g = to_local(shapely.from_wkb(row["geometry"]))
        if g.geom_type in ("LineString", "MultiLineString"):
            g = g.buffer(max(cell * 0.6, 6))
        if g.area:
            kind[within(g)] = "~"

    # A city's green, under its streets and buildings: parks, gardens, lawns, pitches, cemeteries, woods.
    if city and not only:
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
    segments = [] if only == "tall" else overture("transportation", "segment",
                                                  ["subtype", "class", "road_flags", "rail_flags"], box)
    if only == "bridges":        # the cells under road bridges alone (`--bridges`)
        return {"deck": bridge_mask(segments, cell, least, to_local, within, N)}
    for row in segments:
        if row.get("subtype") != "road":
            continue
        width = ROAD_WIDTH.get(row.get("class") or "", 0)
        if not width:
            continue
        if city and width < least:
            continue
        reach = width / 2 + cell * 0.12 if city else max(width / 2, cell * 0.45)
        g = to_local(shapely.from_wkb(row["geometry"]))
        if city:                           # a tunnel is under the ground, not on it
            g = surface(g, row.get("road_flags"))
            if g is None:
                continue
        g = g.buffer(reach)
        inside = within(g) & (kind != "~")
        kind[inside] = "="
    # A bridge crosses the water the road is not drawn over.
    if city and segments:
        kind[bridge_mask(segments, cell, least, to_local, within, N)] = "="

    count = 0
    rows = overture("buildings", "building", ["id", "height", "num_floors"], box)
    geoms = [to_local(shapely.from_wkb(row["geometry"])) for row in rows]
    rises = landmark_rises(b, box, geoms, to_m) if city else {}
    landmarks = rises is not None         # Wikidata answered (None: it did not, and the ground does not say so)
    rises = rises or {}
    parts = building_parts(box, to_local) if city else {}     # a city's tiers, towers and spires
    parted = np.zeros((N, N), bool)       # the cells whose height a building's parts gave
    spire = max(1.5 * cell, 22.0)         # metres round a landmark's point that rise to its height
    for k, (row, g) in enumerate(zip(rows, geoms)):
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
        own = row.get("height") or (row.get("num_floors") or 0) * FLOOR
        h = own or 2 * FLOOR
        mine = parts.get(row.get("id"))
        best, top_part, kept = None, 0, []
        if mine:
            # A building mapped in parts (the Empire State Building's eleven tiers, the Eiffel Tower's legs,
            # platforms and mast): each cell takes the tallest part over it, not the whole footprint the
            # building's top height. A part off the ground adds height to the building's cells, never new
            # ones. Where no part reaches, the building's own height stands — unless that height is the
            # whole building's top (mapped on the outline for renderers that draw no parts): then the
            # lowest part on the ground, its podium. Where the parts stop short of the building's own
            # height (a spire or a roof they leave out), their tallest stands at it.
            best = np.zeros((N, N))
            ground = []                       # the tops of the parts on the ground that reach a cell (`kept`: of all)
            for pg, top, low in mine:
                pin = within(pg)
                if low:
                    pin &= inside
                if not pin.any() and pg.area >= 0.04 * cell * cell:
                    # A tower, a mast or a spire between two cell middles stands in the building's cell
                    # nearest it, within a cell (a thinner part says nothing a cell of this size can hold).
                    c = pg.centroid
                    i0, j0 = int((half - c.y) // cell), int((c.x + half) // cell)
                    near = None
                    for i in range(max(0, i0 - 1), min(N, i0 + 2)):
                        for j in range(max(0, j0 - 1), min(N, j0 + 2)):
                            if inside[i, j] or (not low and best[i, j] > 0):
                                d = (gx[i, j] - c.x) ** 2 + (gy[i, j] - c.y) ** 2
                                if d <= cell * cell and (near is None or d < near[0]):
                                    near = (d, i, j)
                    if near:
                        pin = np.zeros((N, N), bool)
                        pin[near[1], near[2]] = True
                if pin.any():
                    best[pin] = np.maximum(best[pin], top)
                    kept.append(top)
                    if not low:
                        ground.append(top)
            top_part = max(kept, default=0)
            base = min(ground) if own and abs(own - top_part) <= 1.0 and ground else h
            covered = best > 0
            inside = inside | covered
            heights = np.where(covered, best, base)
            if kept and own > top_part + 3:   # the parts leave out the building's top (the Campanile's pyramid and
                heights[best == top_part] = own     # angel): its tallest part stands at the building's height
            kind[inside] = "b"
            tall[inside] = np.maximum(tall[inside], heights[inside])
            parted |= covered | (inside & (best == 0))
            h = max(h, top_part)
        else:
            kind[inside] = "b"
            tall[inside] = np.maximum(tall[inside], h)
        # A landmark's height (Wikidata), where the building's own is missing or a good deal lower: the
        # cells round its point rise to it (a tower, a spire, a dome stand at a building's middle) — and
        # all of a low, wide one's (a ring like the Colosseum, a hall, a stadium: under 60 m, over 10,000 m²).
        for x, y, top in rises.get(k, ()):
            if top >= 1.5 * h and top - h >= 12:
                near = inside if (top < 60 and g.area >= 10000) else \
                    inside & ((gx - x) ** 2 + (gy - y) ** 2 <= spire ** 2)
                tall[near] = np.maximum(tall[near], top)
            elif kept and top > top_part + 3:
                # The parts stop short of the landmark's height (a mast, a spire: Torrespaña's parts reach
                # 173 m and its mast 231): their tallest cells at its point stand at it.
                peak = inside & (best == top_part) & ((gx - x) ** 2 + (gy - y) ** 2 <= spire ** 2)
                tall[peak] = np.maximum(tall[peak], top)
        count += 1

    heights_from = ["Wikidata (CC0)"] if city and landmarks and rises else []
    eub = eubucco_storeys(b, box, kind, tall, gx, gy, to_local) if city else 0
    if eub:
        heights_from.append("EUBUCCO (ODbL)")
    heights_read = landmarks and eub is not None      # both answered: the ground says its heights are read
    if only == "tall":           # the buildings and their heights alone (`--heights`)
        return {"kind": "".join(kind.ravel()), "tall": storeys_of(tall), "landmarks": heights_read,
                "heightsFrom": heights_from, "parted": np.flatnonzero(parted.ravel()).tolist()}

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
        "tall": storeys_of(tall),
        "buildings": count,
        # Which of Overture's releases it was read from, and when.
        "release": RELEASE,
        "read": datetime.date.today().isoformat(),
        # A city's roads over water (its bridges) are drawn, and its landmarks stand at Wikidata's heights
        # (`--bridges` and `--heights` do it for the grounds cut before).
        **({"bridges": datetime.date.today().isoformat(), "parts": datetime.date.today().isoformat(),
            "tunnels": datetime.date.today().isoformat()} if city else {}),
        **({"heights": datetime.date.today().isoformat(), "heightsFrom": heights_from} if city and heights_read else {}),
    }


def repair_heights(places):
    """`--heights`: read again the heights of a city's buildings by the rules now in force, from the release
    its ground was read from. A cell may say more than 74 storeys (237 m: the Empire State Building, the
    Willis Tower and the Eiffel Tower had all stood at one height), and a landmark takes the height Wikidata
    gives it where Overture's is missing or lower (the Willis Tower stood at 31 m, the Tour du Midi at 19).
    Each building cell takes the taller of its height and the new one; nothing else in the ground changes —
    its years, streets, water, green. A building mapped in parts (`building_part`: the Empire State
    Building's tiers, the Eiffel Tower's legs and mast) has each of its cells take the height of the tallest
    part over it, up or down, as a new cut does (`parts`): a slab at the building's top height is no longer
    its silhouette. A ground cut or repaired so says it (`heights`, `parts`, the day) and is left alone; one
    whose grid is no longer the place's is left for a new cut. The grounds are read a few at a time: one
    pass over Overture's index serves a batch of cities."""
    todo = {}
    for b in places:
        path = OUT / (b["slug"] + ".json")
        if b.get("precision") != "city" or not path.exists():
            continue                   # a museum's plot draws no tower past a fifth of its width anyway
        old = json.loads(path.read_text(encoding="utf-8"))
        if old.get("heights") and old.get("parts"):
            continue
        if old["n"] != (b.get("n") or GRID) or old["side"] != side_of(b):
            print(f"  · {b['slug']}: its grid is not the place's now: cut it again instead", flush=True)
            continue
        todo.setdefault(old.get("release") or RELEASE, []).append((b, old, path))
    themes = {("buildings", "building"): COLUMNS[("buildings", "building")],
              ("buildings", "building_part"): GREEN_COLUMNS[("buildings", "building_part")]}
    BATCH = 6
    for rel, group in todo.items():
        for k in range(0, len(group), BATCH):
            chunk = group[k:k + BATCH]
            FETCHED.clear()
            try:
                use_release(rel)
                prefetch([square(b) for b, _, _ in chunk], themes=themes)
            except Exception as exc:         # a release the bucket no longer keeps: each place asks for itself
                print(f"  · Overture {rel}: {type(exc).__name__}: {str(exc)[:80]}", flush=True)
                FETCHED.clear()
            for b, old, path in chunk:
                repair_one_heights(b, old, path, rel)
            FETCHED.clear()


def repair_one_heights(b, old, path, rel):
    new = None
    for release in dict.fromkeys([rel, "latest"]):
        try:
            use_release(release)
            new = build(b, only="tall")
            break
        except Exception as exc:             # a release the bucket no longer keeps: the newest instead
            print(f"  · {b['slug']}: Overture {release}: {type(exc).__name__}: {str(exc)[:80]}", flush=True)
            FETCHED.clear()
    if new is None:
        return
    parted = set(new["parted"])
    tall, raised, parted_now = list(old["tall"]), 0, 0
    for q, c in enumerate(tall):
        if old["kind"][q] == "b" and new["kind"][q] == "b":
            t = new["tall"][q]
            if q in parted:              # a building mapped in parts: its parts' heights, up or down
                if t != c:
                    tall[q] = t
                    parted_now += 1
            elif t > c:
                tall[q] = t
                raised += 1
    old["tall"] = "".join(tall)
    old["parts"] = datetime.date.today().isoformat()
    if new["landmarks"]:                 # Wikidata and EUBUCCO answered: not asked again (else the next run tries)
        old["heights"] = datetime.date.today().isoformat()
        old["heightsFrom"] = new["heightsFrom"]
    path.write_text(json.dumps(old, separators=(",", ":")), encoding="utf-8")
    top = max(ord(c) - 48 for c in tall)
    print(f"  + {b['name']}: {raised} building cells rise (past 74 storeys, or to a landmark's height), "
          f"{parted_now} take the heights of their buildings' parts, the tallest now {top} storeys ({top * FLOOR:.0f} m)"
          + ("" if new["landmarks"] else "; Wikidata or EUBUCCO did not answer: left for the next run"), flush=True)


def repair_bridges(places):
    """`--bridges`: a city's ground cut before road bridges were drawn shows each river unbroken from bank
    to bank. Its road segments are read again, from the release the ground was read from, and the water
    cells under a bridge deck become road; nothing else in the ground changes. A ground cut with bridges
    says so (`bridges`, the day) and is left alone."""
    for b in places:
        path = OUT / (b["slug"] + ".json")
        if b.get("precision") != "city" or not path.exists():
            continue
        old = json.loads(path.read_text(encoding="utf-8"))
        if old.get("bridges"):
            continue
        if old["n"] != (b.get("n") or GRID) or old["side"] != side_of(b):
            print(f"  · {b['slug']}: its grid is not the place's now: cut it again instead", flush=True)
            continue
        new = None
        for release in dict.fromkeys([old.get("release") or RELEASE, "latest"]):
            try:
                use_release(release)
                new = build(b, only="bridges")
                break
            except Exception as exc:         # a release the bucket no longer keeps: the newest instead
                print(f"  · {b['slug']}: Overture {release}: {type(exc).__name__}: {str(exc)[:80]}", flush=True)
        if new is None:
            continue
        kind = list(old["kind"])
        decks = [q for q in np.flatnonzero(new["deck"].ravel()) if kind[q] == "~"]
        for q in decks:
            kind[q] = "="
        old["kind"] = "".join(kind)
        old["bridges"] = datetime.date.today().isoformat()
        path.write_text(json.dumps(old, separators=(",", ":")), encoding="utf-8")
        print(f"  + {b['name']}: {len(decks)} water cells under bridges are road now", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--only", help="one place's slug, or several, comma-separated")
    parser.add_argument("--release", default=None,
                        help="an Overture release (2026-09-23.1), or 'latest' for the newest on the bucket")
    parser.add_argument("--heights", action="store_true",
                        help="read again the heights of the cities' buildings by the rules now in force (past "
                             "74 storeys, landmarks at Wikidata's heights, buildings mapped in parts at their "
                             "parts' heights), leaving all else as it is (with --only: one place)")
    parser.add_argument("--bridges", action="store_true",
                        help="draw the road bridges over water in the cities' grounds cut without them, "
                             "leaving all else as it is (with --only: one place)")
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
        wanted = set(args.only.split(","))
        buildings = [b for b in buildings if b["slug"] in wanted]
    OUT.mkdir(parents=True, exist_ok=True)
    if args.heights or args.bridges:
        if args.heights:
            repair_heights(buildings)
        if args.bridges:
            repair_bridges(buildings)
        sys.exit(0)
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
