#!/usr/bin/env python3
"""The squares of the cities' skylines, as grounds can be read for them.

The artist, 7 Oct 2026, of Houston on the Museums layer: "when I click on a
city I want to see the city skyline like it shows in the timelapse of the
urban development in the architecture section. Distinguish the art buildings
from the rest and label them so i can click on them". A city opened on the
Museums layer is drawn as its ground (skyline.js), a clod in DIRT as the
museums' and buildings' area views are, its buildings rising with their
years on the city's dial. This lists the square each city is cut from, for
build_grounds.py and build_built_years.py (as lifeplaces.json does for the
lives' places).

The square frames the city's museums and most of its galleries with a known
point (museums.json, cities.json venues): the centre is where an 8 km square
takes in the most of them (a museum counts as twelve galleries), the side what
they span there, with a margin, between 3 and 8 km; a museum outside it (the
Getty from downtown Los Angeles) is not on the skyline, and the column still
has it. The grid is first about 40 m a cell, 96 to 144 cells a side, so a file
stays near 150-250 KB; the cities' pass (docs/v2/grounds/REFINE.md,
scripts/refine_cities.py) cuts a city finer a grain at a time — 28, 20, then
14 m a cell, never more than 576 cells a side — and keeps each city's grain in
docs/v2/grounds/ledger.json, which this reads.

Public files only, no network, the same bytes every run. Writes
docs/v2/cityplaces.json:

    {note, places: [{slug: "city-<town key>", key, name, lat, lon, precision: "city",
                     side, n, museums: [slugs in the square]}]}

Only the cities whose ground has been read are drawn as a skyline; the rest
open as the map they were. The cities are those with museums (but not a town
that is only its museum, which opens straight into it), then the cities of
galleries busy enough to be named on the globe (eight works or more), in
cities.json's order; `--top N` lists the first N. The daily buildings pass
raises N (models/REFINE.md, "The skylines").

    python3 scripts/build_city_places.py [--top 13]
"""

import argparse
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CITIES = ROOT / "docs" / "v2" / "cities.json"
MUSEUMS = ROOT / "docs" / "v2" / "museums.json"
OUT = ROOT / "docs" / "v2" / "cityplaces.json"

MAX_SIDE = 8000       # metres: the most a skyline square spans
MIN_SIDE = 3000
MARGIN = 500          # metres beyond the outermost place, each side
MUSEUM_WEIGHT = 12
CELL = 40             # metres a cell, roughly
BUSY = 8              # a city of galleries this busy (works that have been there) is read too, as the globe names it
N_MIN, N_MAX = 96, 144
LEDGER = ROOT / "docs" / "v2" / "grounds" / "ledger.json"   # the cities' pass: each city's grain
GRAINS = [None, 28, 20, 14]   # metres a cell by the pass's tier; tier 0 is the first cut (~40 m, 96-144 cells)
N_FINE = 576                  # the most cells a side a city is cut at, however small its cells


def cells_for(side, tier=0):
    """Cells a side for a square of `side` metres at a tier of the cities' pass."""
    first = max(N_MIN, min(N_MAX, int(round(side / CELL / 8)) * 8))
    if not tier:
        return first
    return max(first, min(N_FINE, int(round(side / GRAINS[min(tier, len(GRAINS) - 1)] / 8)) * 8))


def tiers():
    """Each city's tier, as the cities' pass has raised it (0 where it has not)."""
    if not LEDGER.exists():
        return {}
    return {k: v.get("tier", 0) for k, v in json.loads(LEDGER.read_text(encoding="utf-8")).get("cities", {}).items()}


def to_m(lat0, lon0, lat, lon):
    return ((lon - lon0) * 111320 * math.cos(math.radians(lat0)), (lat - lat0) * 111320)


def square_for(points, middle=None):
    """points: [(lat, lon, weight, slug or None)]. The centre and side of the square. `middle` is the
    city's own point (cities.json: its middle, often its towers): where the square framing its art
    leaves it out but could take it in within the 8 km, it is taken in (Houston's downtown, beside
    the Menil and the Contemporary Arts Museum)."""
    best = None
    for la, lo, _, _ in points:
        inside = [p for p in points
                  if all(abs(v) <= MAX_SIDE / 2 - MARGIN for v in to_m(la, lo, p[0], p[1]))]
        w = sum(p[2] for p in inside)
        if best is None or w > best[0]:
            best = (w, inside)
    inside = best[1]
    if middle:
        lat0 = (min(p[0] for p in inside) + max(p[0] for p in inside)) / 2
        lon0 = (min(p[1] for p in inside) + max(p[1] for p in inside)) / 2
        ex0 = max(max(abs(v) for v in to_m(lat0, lon0, p[0], p[1])) for p in inside)
        half0 = max(MIN_SIDE, min(MAX_SIDE, 2 * (ex0 + MARGIN))) / 2
        if any(abs(v) > half0 - 300 for v in to_m(lat0, lon0, middle[0], middle[1])):
            both = inside + [(middle[0], middle[1], 0, None)]
            la_ = [p[0] for p in both]
            lo_ = [p[1] for p in both]
            c = ((min(la_) + max(la_)) / 2, (min(lo_) + max(lo_)) / 2)
            if max(max(abs(v) for v in to_m(c[0], c[1], p[0], p[1])) for p in both) <= MAX_SIDE / 2 - MARGIN:
                inside = both
    las = [p[0] for p in inside]
    los = [p[1] for p in inside]
    lat = (min(las) + max(las)) / 2
    lon = (min(los) + max(los)) / 2
    ex = max(max(abs(v) for v in to_m(lat, lon, p[0], p[1])) for p in inside)
    side = max(MIN_SIDE, min(MAX_SIDE, 2 * (ex + MARGIN)))
    side = int(math.ceil(side / 100) * 100)
    return lat, lon, side


def squares(top, grain=None):
    """The first `top` cities' squares, in cities.json's order, each at its tier's grain."""
    grain = tiers() if grain is None else grain
    d = json.loads(CITIES.read_text(encoding="utf-8"))
    mus = {m["slug"]: m for m in json.loads(MUSEUMS.read_text(encoding="utf-8"))["museums"]}
    places = []
    for row in d["towns"]:
        key, name, museums, single = row[0], row[1], row[6], row[8]
        if single:
            continue          # a city that is only its museum goes straight into the museum
        if not museums and row[5] < BUSY:
            continue          # a city of a few galleries keeps its map
        pts = [(mus[s]["lat"], mus[s]["lon"], MUSEUM_WEIGHT, s) for s in museums
               if s in mus and isinstance(mus[s].get("lat"), (int, float))]
        mpts = {(round(p[0], 4), round(p[1], 4)) for p in pts}
        pts += [(v[1], v[2], 1, None) for v in d["venues"].get(key, [])
                if (round(v[1], 4), round(v[2], 4)) not in mpts]
        if not pts:
            continue
        lat, lon, side = square_for(pts, (row[3], row[4]))
        n = cells_for(side, grain.get(key, 0))
        half = side / 2
        inside = [s for s in museums if s in mus and
                  all(abs(v) <= half for v in to_m(lat, lon, mus[s]["lat"], mus[s]["lon"]))]
        places.append({"slug": "city-" + key, "key": key, "name": name,
                       "lat": round(lat, 5), "lon": round(lon, 5), "precision": "city",
                       "side": side, "n": n, "museums": inside})
        if len(places) >= top:
            break
    return places


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--top", type=int, default=13)
    args = ap.parse_args()
    places = squares(args.top)
    out = {"note": "The squares of the cities' skylines (scripts/build_city_places.py); each ground is "
                   "grounds/city-<town key>.json, read by build_grounds.py and dated by build_built_years.py.",
           "places": places}
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    for p in places:
        print(f"  {p['slug']}: {p['side']} m, {p['n']} cells ({p['side'] / p['n']:.0f} m), "
              f"{len(p['museums'])} museums in the square")


if __name__ == "__main__":
    main()
