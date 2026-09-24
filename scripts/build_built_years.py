#!/usr/bin/env python3
"""When the buildings on each ground went up — for the timeline under a town.

For every ground in docs/v2/grounds/ (build_grounds.py), this gives each
building cell a year, and writes it into the ground as `built` (one year per
building cell, row by row from the north; 0 where nothing says). land.js then
grows the town year by year under a slider (see CLAUDE.md, "The timeline").

Where the years come from, most exact first, all open data:

  * the building's own year, where the city publishes one —
      New York: PLUTO (`yearbuilt` for every tax lot), data.cityofnewyork.us;
      the Netherlands: the BAG (`bouwjaar` for every building), service.pdok.nl;
  * otherwise the year its patch of ground was first built on —
      World Settlement Footprint Evolution (DLR; Marconcini et al.), 30 m, a
      year from 1985 to 2015 (1985 meaning "by 1985");
      and, for what WSF has as there by 1985, the Global Human Settlement
      Layer's built-up surface for 1975 and 1980 (European Commission, JRC;
      GHS-BUILT-S R2023A, 3 arc-seconds) to say whether it was there by 1975
      or 1980.

What neither knows stays 0: the town shows it from the start.

Tiles and answers are cached in data/ (not committed).

    python3 scripts/build_built_years.py [--only slug] [--force]
"""

import argparse
import io
import json
import math
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
import tifffile

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_grounds import SIDE, local  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
GROUNDS = ROOT / "docs" / "v2" / "grounds"
PLACES = [ROOT / "docs" / "v2" / "architecture.json", ROOT / "docs" / "v2" / "museums.json"]
CACHE = ROOT / "data"

WSF = "https://download.geoservice.dlr.de/WSF_EVO/files/WSFevolution_v1_{x}_{y}/WSFevolution_v1_{x}_{y}.tif"
GHSL = ("https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/GHS_BUILT_S_GLOBE_R2023A/"
        "GHS_BUILT_S_E{e}_GLOBE_R2023A_4326_3ss/V1-0/tiles/GHS_BUILT_S_E{e}_GLOBE_R2023A_4326_3ss_V1_0_R{r}_C{c}.zip")
PLUTO = "https://data.cityofnewyork.us/resource/64uk-42ks.json"
BAG = "https://service.pdok.nl/lv/bag/wfs/v2_0"
NYC = (40.49, -74.27, 40.92, -73.68)       # south, west, north, east
NL = (50.75, 3.3, 53.6, 7.25)
AGENT = {"User-Agent": "Art-Database/1.0 (artist website; github.com/9gn957ptsb-alt/Art-Database)"}
GHSL_MIN = 810        # m² of built surface in a 90 m cell (a tenth of it) to count as built


def fetch(url, timeout=300):
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers=AGENT)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            err = e
        except Exception as e:  # network hiccup
            err = e
        time.sleep(2 ** attempt)
    raise err


class Raster:
    """A GeoTIFF in plain degrees: sample it at points."""

    def __init__(self, data):
        with tifffile.TiffFile(io.BytesIO(data)) as t:
            pg = t.pages[0]
            self.a = pg.asarray()
            sx, sy = pg.tags["ModelPixelScaleTag"].value[:2]
            tp = pg.tags["ModelTiepointTag"].value
            self.x0, self.y0, self.sx, self.sy = tp[3], tp[4], sx, sy

    def at(self, lat, lon):
        j = np.floor((np.asarray(lon) - self.x0) / self.sx).astype(int)
        i = np.floor((self.y0 - np.asarray(lat)) / self.sy).astype(int)
        ok = (i >= 0) & (j >= 0) & (i < self.a.shape[0]) & (j < self.a.shape[1])
        out = np.zeros(np.shape(lat), dtype=np.int64)
        out[ok] = self.a[i[ok], j[ok]]
        return out


_tiles = {}


def wsf_tile(lat, lon):
    x, y = int(math.floor(lon / 2) * 2), int(math.floor(lat / 2) * 2)
    key = ("wsf", x, y)
    if key not in _tiles:
        path = CACHE / "wsf" / f"WSFevolution_v1_{x}_{y}.tif"
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            data = fetch(WSF.format(x=x, y=y))
            path.write_bytes(data or b"")
        data = path.read_bytes()
        _tiles[key] = Raster(data) if data else None
    return _tiles[key]


def ghsl_tile(epoch, lat, lon):
    r = int(math.floor((89.0996 - lat) / 10)) + 1
    c = int(math.floor((lon + 180.0079) / 10)) + 1
    key = ("ghsl", epoch, r, c)
    if key not in _tiles:
        # Only one GHSL tile is held at a time: each is 288 MB unpacked.
        for k in [k for k in _tiles if k[0] == "ghsl"]:
            del _tiles[k]
        path = CACHE / "ghsl" / f"E{epoch}_R{r}_C{c}.zip"
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            data = fetch(GHSL.format(e=epoch, r=r, c=c), timeout=600)
            path.write_bytes(data or b"")
        data = path.read_bytes()
        if data:
            z = zipfile.ZipFile(io.BytesIO(data))
            name = next(n for n in z.namelist() if n.endswith(".tif"))
            _tiles[key] = Raster(z.read(name))
            path.unlink()          # 16 MB each: kept only while its places are read
        else:
            _tiles[key] = None
    return _tiles[key]


def inside(box, lat, lon):
    return box[0] <= lat <= box[2] and box[1] <= lon <= box[3]


def pluto_years(box):
    """Tax lots with their year, in (south, west, north, east)."""
    s, w, n, e = box
    where = f"latitude between {s} and {n} and longitude between {w} and {e} and yearbuilt > 0"
    url = PLUTO + "?" + urllib.parse.urlencode({"$select": "latitude,longitude,yearbuilt",
                                                "$where": where, "$limit": 50000})
    rows = json.loads(fetch(url))
    pts = [(float(r["latitude"]), float(r["longitude"]), int(float(r["yearbuilt"]))) for r in rows
           if r.get("latitude") and r.get("yearbuilt")]
    return pts


def bag_polygons(box):
    """Buildings with their year, in (south, west, north, east): [(year, [ring (lon, lat)...])]."""
    s, w, n, e = box
    out, start = [], 0
    while True:
        q = {"service": "WFS", "version": "2.0.0", "request": "GetFeature", "typeNames": "bag:pand",
             "outputFormat": "application/json", "srsName": "EPSG:4326", "count": 1000,
             "startIndex": start, "bbox": f"{s},{w},{n},{e},EPSG:4326"}
        d = json.loads(fetch(BAG + "?" + urllib.parse.urlencode(q)))
        feats = d.get("features") or []
        for f in feats:
            yr = (f.get("properties") or {}).get("bouwjaar")
            g = f.get("geometry") or {}
            # The BAG writes 1005 for "not known", and 9999 for "not yet built".
            if not yr or not 1200 <= int(yr) <= time.localtime().tm_year:
                continue
            if g.get("type") not in ("Polygon", "MultiPolygon"):
                continue
            polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
            for poly in polys:
                out.append((int(yr), poly[0]))
        if len(feats) < 1000:
            return out
        start += 1000


def in_ring(x, y, ring):
    hit = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            hit = not hit
    return hit


def years_for(place, g):
    n, side = g["n"], g["side"]
    cell = side / n
    to_m, to_deg = local(place["lat"], place["lon"])
    half = side / 2
    cells = [(k // n, k % n) for k in range(n * n) if g["kind"][k] == "b"]
    if not cells:
        return [], []
    lon, lat = zip(*[to_deg((j + 0.5) * cell - half, half - (i + 0.5) * cell) for i, j in cells])
    lat, lon = np.array(lat), np.array(lon)
    years = np.zeros(len(cells), dtype=np.int64)
    said = []

    # The building's own year, where the city says.
    w, s = to_deg(-half, -half)
    e, nn = to_deg(half, half)
    box = (s, w, nn, e)
    if inside(NYC, place["lat"], place["lon"]):
        pts = pluto_years(box)
        if pts:
            P = np.array(pts, dtype=float)
            reach = max(cell, 25.0)
            for k in range(len(cells)):
                dy = (P[:, 0] - lat[k]) * 111320
                dx = (P[:, 1] - lon[k]) * 111320 * math.cos(math.radians(lat[k]))
                d2 = dx * dx + dy * dy
                m = int(np.argmin(d2))
                if d2[m] <= reach * reach:
                    years[k] = int(P[m, 2])
            said.append("New York City PLUTO")
    elif inside(NL, place["lat"], place["lon"]):
        polys = bag_polygons(box)
        if polys:
            for k in range(len(cells)):
                for yr, ring in polys:
                    if in_ring(lon[k], lat[k], ring):
                        years[k] = yr
                        break
            said.append("BAG (Kadaster)")

    # The year its ground was first built on, for what the city did not say.
    rest = years == 0
    if rest.any():
        t = wsf_tile(place["lat"], place["lon"])
        if t is not None:
            wy = t.at(lat, lon)
            years[rest] = wy[rest]
            said.append("World Settlement Footprint Evolution (DLR)")
            by85 = rest & (wy == 1985)
            if by85.any():
                older = np.full(len(cells), 1985)
                for epoch in (1980, 1975):
                    gt = ghsl_tile(epoch, place["lat"], place["lon"])
                    if gt is not None:
                        older[gt.at(lat, lon) >= GHSL_MIN] = epoch
                years[by85] = older[by85]
                said.append("GHSL built-up surface 1975–1980 (JRC)")
    return years.tolist(), said


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--only")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    places = []
    for f in PLACES:
        if f.exists():
            d = json.loads(f.read_text(encoding="utf-8"))
            places += d.get("buildings", d.get("museums", []))
    places = [p for p in places if isinstance(p.get("lat"), (int, float))]
    if args.only:
        places = [p for p in places if p["slug"] == args.only]
    # Neighbours share tiles: go through them west to east, north to south.
    places.sort(key=lambda p: (math.floor(p["lon"] / 10), -math.floor(p["lat"] / 10), p["lon"]))
    for p in places:
        path = GROUNDS / (p["slug"] + ".json")
        if not path.exists():
            continue
        g = json.loads(path.read_text(encoding="utf-8"))
        if "built" in g and not args.force:
            continue
        try:
            years, said = years_for(p, g)
        except Exception as exc:
            print(f"  ! {p['slug']}: {type(exc).__name__}: {exc}", flush=True)
            continue
        g["built"] = years
        g["builtFrom"] = said
        path.write_text(json.dumps(g, separators=(",", ":")), encoding="utf-8")
        known = [y for y in years if y]
        span = f"{min(known)}–{max(known)}" if known else "no years"
        print(f"  + {p.get('name')}: {len(known)}/{len(years)} buildings dated, {span} · {', '.join(said)}", flush=True)


if __name__ == "__main__":
    main()
