#!/usr/bin/env python3
"""When the buildings on each ground went up — for the timeline under a town.

For every ground in docs/v2/grounds/ (build_grounds.py), this gives each
building cell a year, and writes it into the ground as `built` (one year per
building cell, row by row from the north; 0 where nothing says). land.js then
grows the town year by year under a slider (see CLAUDE.md, "The timeline").

Where the years come from, most exact first, all open data:

  * the building's own year, where the city publishes one (CITIES below: New
      York's footprints and PLUTO, the Netherlands' BAG, London, France's BDNB,
      Washington DC, LA County, Chicago, Boston, Philadelphia, Vienna,
      Switzerland, Melbourne, Spain's Catastro, King County, Miami-Dade), with
      documented years standing in for a city's plainly wrong landmark records;
  * otherwise the year its patch of ground was first built on —
      World Settlement Footprint Evolution (DLR; Marconcini et al.), 30 m, a
      year from 1985 to 2015 (1985 meaning "by 1985");
      and, for what WSF has as there by 1985, the Global Human Settlement
      Layer's built-up surface for 1975 and 1980 (European Commission, JRC;
      GHS-BUILT-S R2023A, 3 arc-seconds) to say whether it was there by 1975
      or 1980.

What neither knows stays 0: the town shows it from the start.

Tiles and answers are cached in data/ (not committed).

    python3 scripts/build_built_years.py [--only slug] [--force] [--cities]
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
        # Each is 225 MB unpacked: hold the last two only (places are gone
        # through tile by tile), or a whole run fills the memory.
        held = [k for k in _tiles if k[0] == "wsf"]
        for k in held[:-1]:
            del _tiles[k]
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


# ---- the cities: each a coverage box and a fetcher -----------------------------------------------
# A fetcher takes (south, west, north, east) and gives
#   ("polys", [(year, [(lon, lat), ...])]) — the cells whose middles a ring holds take its year (the
#       earliest, where rings overlap); a cell a metre or two outside every ring takes the year of the
#       nearest ring within a cell, as the city's outlines and the ground's differ that much;
#   ("points", [(lat, lon, year[, radius m])]) — each cell takes the point nearest it, less the
#       point's radius, within a cell or 25 m;
#   or ("polys", rings, points) — the points date what the rings leave.
# A year is a year; 0 is a building the city has but cannot date (its cells go on to the satellite
# layers, and no neighbour's year leaks onto them); -1 is "old, year not known": it stands from the
# start of the timeline, and nothing overwrites it.
#
# Where a city's record for a landmark is plainly wrong or empty, the documented year stands in, in
# the tables by each fetcher (their sources in the comments). Checked by independent verification of
# every source on 25 Sep 2026.

THIS_YEAR = time.localtime().tm_year
OLD = -1


def year_of(v, floor=1200):
    try:
        y = int(float(str(v).strip()[:4]))
    except (TypeError, ValueError):
        return 0
    return y if floor <= y <= THIS_YEAR else 0


def padded(box, metres):
    s, w, n, e = box
    dy = metres / 111320
    dx = dy / max(0.2, math.cos(math.radians((s + n) / 2)))
    return (s - dy, w - dx, n + dy, e + dx)


def outer_rings(g):
    """The outer ring of each polygon in a GeoJSON Polygon or MultiPolygon."""
    if not g or g.get("type") not in ("Polygon", "MultiPolygon"):
        return []
    return [p[0] for p in (g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]])]


def arcgis(url, box, field, where="1=1", points=False):
    """Features with their attributes from an ArcGIS REST layer, paged: [(attributes, ring)] — one
    entry for each outer ring (clockwise in Esri JSON; holes run the other way) — or, with points,
    [(attributes, (lon, lat))]."""
    import shapely
    s, w, n, e = box
    out, offset = [], 0
    while True:
        q = {"where": where, "geometry": f"{w},{s},{e},{n}", "geometryType": "esriGeometryEnvelope",
             "inSR": 4326, "outSR": 4326, "spatialRel": "esriSpatialRelIntersects", "outFields": field,
             "returnGeometry": "true", "f": "json", "resultOffset": offset, "resultRecordCount": 1000}
        d = json.loads(fetch(url + "/query?" + urllib.parse.urlencode(q)))
        if "error" in d:          # not a last page: an answer the place must not be dated from
            raise RuntimeError(f"{url}: {d['error']}")
        feats = d.get("features") or []
        for f in feats:
            g = f.get("geometry") or {}
            at = f.get("attributes") or {}
            if points:
                if "x" in g:
                    out.append((at, (g["x"], g["y"])))
                continue
            for ring in g.get("rings") or []:
                if len(ring) >= 4 and not shapely.LinearRing(ring).is_ccw:
                    out.append((at, ring))
        if not d.get("exceededTransferLimit") or not feats:
            return out
        offset += len(feats)


# New York: the city's building footprints, each with its tax lot's year from PLUTO (else the
# footprint's own construction year).
NYC_FOOTPRINTS = "https://data.cityofnewyork.us/resource/5zhs-2jue.json"


def new_york(box):
    s, w, n, e = box
    wkt = f"POLYGON(({w} {s}, {e} {s}, {e} {n}, {w} {n}, {w} {s}))"
    q = {"$select": "construction_year,mappluto_bbl,the_geom", "$where": f"intersects(the_geom,'{wkt}')",
         "$limit": 50000}
    feats = json.loads(fetch(NYC_FOOTPRINTS + "?" + urllib.parse.urlencode(q)))
    bbl = lambda v: str(v or "").split(".")[0]
    lots = sorted({bbl(f.get("mappluto_bbl")) for f in feats} - {""})
    lot = {}
    for k in range(0, len(lots), 150):
        where = "bbl in(" + ",".join("'" + b + "'" for b in lots[k:k + 150]) + ")"
        rows = json.loads(fetch(PLUTO + "?" + urllib.parse.urlencode(
            {"$select": "bbl,yearbuilt", "$where": where, "$limit": 50000})))
        for r in rows:
            lot[bbl(r.get("bbl"))] = year_of(r.get("yearbuilt"))
    out = []
    for f in feats:
        y = lot.get(bbl(f.get("mappluto_bbl"))) or year_of(f.get("construction_year"))
        for ring in outer_rings(f.get("the_geom")):
            out.append((y, ring))
    return "polys", out


# The BAG's own records that contradict the buildings (pand identificatie: documented year).
BAG_FIX = {
    "0363100012077791": 1895,   # Stedelijk Museum, Weissman building 1891–95 (BAG 1874)
    "0363100012211564": 1999,   # Van Gogh Museum, Kurokawa wing, opened 1999 (BAG 1973)
    "0228100000029146": 1965,   # Kröller-Müller, Rietveld Pavilion, re-erected 1965 (BAG 1937)
}


def bag_polygons(box):
    """Buildings with their year, in (south, west, north, east): [(year, [ring (lon, lat)...])]."""
    s, w, n, e = box
    out, start, seen = [], 0, set()
    while True:
        # PDOK reads a page of 1000 from the box's envelope in its own projection and then drops what
        # falls outside the box, so a page short of 1000 is not the last: read on until one is empty.
        q = {"service": "WFS", "version": "2.0.0", "request": "GetFeature", "typeNames": "bag:pand",
             "outputFormat": "application/json", "srsName": "EPSG:4326", "count": 1000,
             "startIndex": start, "sortBy": "identificatie", "bbox": f"{s},{w},{n},{e},EPSG:4326"}
        d = json.loads(fetch(BAG + "?" + urllib.parse.urlencode(q)))
        feats = d.get("features") or []
        if not feats:
            return out
        for f in feats:
            pr = f.get("properties") or {}
            key = pr.get("identificatie")
            if key in seen:
                continue
            seen.add(key)
            # The BAG writes 1005 for "not known", and 9999 for "not yet built".
            yr = BAG_FIX.get(key) or pr.get("bouwjaar")
            y = int(yr) if yr and 1200 <= int(yr) <= THIS_YEAR else 0
            for ring in outer_rings(f.get("geometry")):
                out.append((y, ring))
        start += 1000


def netherlands(box):
    return "polys", bag_polygons(box)


# Philadelphia: the Water Department's parcels, joined to the assessor (OPA) on the account.
PHL_FIX = {"782513720": 1928}   # Philadelphia Museum of Art, built 1919–28 (OPA 1902)


def philadelphia(box):
    s, w, n, e = box
    q = ("SELECT o.parcel_number, o.year_built, ST_AsGeoJSON(p.the_geom) AS g FROM pwd_parcels p "
         "JOIN opa_properties_public o ON o.parcel_number = p.brt_id "
         f"WHERE p.the_geom && ST_MakeEnvelope({w},{s},{e},{n},4326)")
    rows = json.loads(fetch("https://phl.carto.com/api/v2/sql?" + urllib.parse.urlencode({"q": q}))).get("rows", [])
    out = []
    for r in rows:
        y = PHL_FIX.get(str(r.get("parcel_number"))) or year_of(r.get("year_built"))
        for ring in outer_rings(json.loads(r["g"]) if r.get("g") else None):
            out.append((y, ring))
    return "polys", out


# LA County: the assessor's parcels. Government and exempt parcels carry no year; where one holds a
# single documented building, its year (AIN: year).
LA_AIN_YEARS = {
    "5151004907": 2003,   # Walt Disney Concert Hall, opened 2003
    "5161005906": 1928,   # Los Angeles City Hall, 1928
    "5161004907": 1964,   # Dorothy Chandler Pavilion, 1964
}


def los_angeles(box):
    url = "https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0"
    out = []
    for a, ring in arcgis(url, box, "AIN,YearBuilt1,YearBuilt2,YearBuilt3,YearBuilt4,YearBuilt5"):
        later = [year_of(a.get(f"YearBuilt{k}")) for k in range(2, 6)]
        y = (LA_AIN_YEARS.get(str(a.get("AIN"))) or year_of(a.get("YearBuilt1"))
             or min([v for v in later if v] or [0]))
        out.append((y, ring))
    return "polys", out


def boston(box):
    """Assessing's parcels. 1899 is its "before 1900, not known", and 1900 on exempt (institutional)
    lots is a stand-in too: both old, year not known. Condo-main records (CM) carry a placeholder;
    their units carry the building's year."""
    url = "https://gisportal.boston.gov/arcgis/rest/services/Assessing/Property_Assessment_FY25/FeatureServer/0"
    out = []
    for a, ring in arcgis(url, box, "YR_BUILT,LU"):
        lu = (a.get("LU") or "").strip()
        if lu == "CM":
            continue
        y = year_of(a.get("YR_BUILT"))
        if y == 1899 or (y == 1900 and lu in ("E", "EA")):
            y = OLD
        out.append((y, ring))
    return "polys", out


def washington(box):
    """Record and tax lots by place (their SSL), then each lot's year from the assessor's tables (AYB,
    actual year built). One year for a lot only where its buildings agree within ten years: the Mall's
    parcels hold many buildings under one SSL."""
    base = "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator"
    lots = arcgis(base + "/MapServer/40", box, "SSL") + arcgis(base + "/MapServer/39", box, "SSL")
    ssl = sorted({a["SSL"] for a, _ in lots if a.get("SSL")})
    years = {}
    for layer in (25, 23, 24):                    # residential, commercial, condominium
        for k in range(0, len(ssl), 80):
            where = "SSL IN (" + ",".join("'" + x.replace("'", "''") + "'" for x in ssl[k:k + 80]) + ")"
            q = {"where": where, "outFields": "SSL,AYB", "returnGeometry": "false", "f": "json"}
            d = json.loads(fetch(f"{base}/FeatureServer/{layer}/query?" + urllib.parse.urlencode(q)))
            for f in d.get("features") or []:
                at = f.get("attributes") or {}
                y = year_of(at.get("AYB"))
                if y:
                    years.setdefault(at["SSL"], []).append(y)
    year = {x: min(ys) for x, ys in years.items()
            if max(ys) - min(ys) <= 10 and not x.startswith(("PAR ", "RES "))}
    return "polys", [(year.get(a.get("SSL"), 0), ring) for a, ring in lots]


# Chicago: the city's building footprints. Its own blanks for landmarks (bldg_id: documented year).
CHICAGO_YEARS = {
    "881847": 1893,   # Art Institute of Chicago: one outline for the complex; the Allerton Building, 1893
    "336138": 1869,   # Chicago Water Tower, 1869
    "335460": 1869,   # Chicago Avenue Pumping Station, 1869
    "331192": 1914,   # Fourth Presbyterian Church, 1914
}


def chicago(box):
    s, w, n, e = box
    wkt = f"POLYGON(({w} {s}, {e} {s}, {e} {n}, {w} {n}, {w} {s}))"
    q = {"$select": "bldg_id,year_built,bldg_name1,f_add1,stories,the_geom",
         "$where": f"intersects(the_geom,'{wkt}')", "$limit": 50000}
    d = json.loads(fetch("https://data.cityofchicago.org/resource/syp8-uezg.geojson?" + urllib.parse.urlencode(q)))
    out = []
    for f in d.get("features") or []:
        p = f.get("properties") or {}
        y = CHICAGO_YEARS.get(str(p.get("bldg_id"))) or year_of(p.get("year_built"))
        # Outlines added from later aerial surveys carry the survey's year: unnamed, no address, no storeys.
        if (y >= 2004 and not p.get("bldg_name1") and str(p.get("f_add1") or "0") in ("", "0")
                and str(p.get("stories") or "0") in ("", "0")):
            y = 0
        for ring in outer_rings(f.get("geometry")):
            out.append((y, ring))
    return "polys", out


# Vienna: the building-period outlines (BAUPERIODEDETAILOGD), each dated by the exact year of the
# building record with the same ACD where there is one, else the middle of its period; the building
# records (address points) date what the outlines leave. The service spells a period two ways.
VIENNA_PERIOD = {"vor1683": 1650, "1683-1740": 1712, "1741-1780": 1760, "1781-1848": 1815, "vor1848": 1800,
                 "1848-1918": 1883, "1849-1859": 1854, "1860-1883": 1872, "1884-1918": 1901, "1919-1945": 1932,
                 "nach1945": 1960, "1946-1976": 1961, "nach1976": 1990}


def vienna(box):
    import re
    s, w, n, e = box

    def layer(name):
        q = {"service": "WFS", "request": "GetFeature", "version": "1.1.0", "typeName": name,
             "srsName": "EPSG:4326", "outputFormat": "json", "bbox": f"{w},{s},{e},{n},EPSG:4326"}
        seen, out = set(), []
        for f in json.loads(fetch("https://data.wien.gv.at/daten/geo?" + urllib.parse.urlencode(q))).get("features") or []:
            key = (f.get("properties") or {}).get("OBJECTID")
            if key not in seen:
                seen.add(key)
                out.append(f)
        return out

    period = lambda t: VIENNA_PERIOD.get(re.sub(r"\s", "", t or "").lower(), 0)
    exact, pts = {}, []
    for f in layer("ogdwien:GEBAEUDEINFOOGD"):
        pr, g = f.get("properties") or {}, f.get("geometry") or {}
        y = year_of(pr.get("BAUJAHR"))
        if y and pr.get("ACD"):
            exact.setdefault(pr["ACD"], y)
        y = y or period(pr.get("L_BAUJ"))
        if y and g.get("type") == "Point":
            pts.append((g["coordinates"][1], g["coordinates"][0], y))
    polys = []
    for f in layer("ogdwien:BAUPERIODEDETAILOGD"):
        pr = f.get("properties") or {}
        y = exact.get(pr.get("ACD")) or period(pr.get("OBJ_STR_TXT"))
        for ring in outer_rings(f.get("geometry")):
            polys.append((y, ring))
    return "polys", polys, pts


# The Swiss register's period codes (gbaup), where a building has no year: the middle of each period.
# 8011 is "before 1919", which has no middle: old, year not known. So are two cantons' own stand-ins
# for it, Bern's 1900 and Basel-Stadt's 1871.
GWR_PERIOD = {8012: 1932, 8013: 1953, 8014: 1966, 8015: 1976, 8016: 1983, 8017: 1988,
              8018: 1993, 8019: 1998, 8020: 2003, 8021: 2008, 8022: 2013, 8023: 2018}
GWR_STAND_INS = {("BE", 1900), ("BS", 1871)}


def switzerland(box):
    """One point a building, with its footprint's radius, so a large building's cells all find it."""
    s, w, n, e = box
    out, offset = [], 0
    while True:
        q = {"geometryType": "esriGeometryEnvelope", "geometry": f"{w},{s},{e},{n}", "sr": 4326, "tolerance": 0,
             "layers": "all:ch.bfs.gebaeude_wohnungs_register", "returnGeometry": "true",
             "geometryFormat": "geojson", "limit": 200, "offset": offset}
        d = json.loads(fetch("https://api3.geo.admin.ch/rest/services/api/MapServer/identify?"
                             + urllib.parse.urlencode(q)))
        res = d.get("results") or []
        for r in res:
            at, g = r.get("attributes") or r.get("properties") or {}, r.get("geometry") or {}
            if g.get("type") != "Point":
                continue
            gy, gp = year_of(at.get("gbauj"), floor=1000), at.get("gbaup") or 0
            if gp == 8011 and (not gy or (at.get("gdekt"), gy) in GWR_STAND_INS):
                y = OLD
            else:
                y = gy or GWR_PERIOD.get(gp, 0)
            radius = math.sqrt(float(at.get("garea") or 0) / math.pi)
            out.append((g["coordinates"][1], g["coordinates"][0], y, radius))
        if len(res) < 200:
            return "points", out
        offset += 200


# Melbourne: the latest CLUE census's years, on the City's own footprints (joined on property);
# properties with no footprint (finished after 2020) by their point.
MELB = "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/"


def melbourne(box):
    s, w, n, e = box
    census = MELB + "buildings-with-name-age-size-accessibility-and-bicycle-facilities/records?"
    last = json.loads(fetch(census + urllib.parse.urlencode(
        {"select": "census_year", "order_by": "census_year desc", "limit": 1})))["results"][0]["census_year"][:4]
    year, where, offset = {}, {}, 0
    while True:
        q = {"select": "property_id,construction_year,latitude,longitude",
             "where": f"latitude>{s} and latitude<{n} and longitude>{w} and longitude<{e} "
                      f"and year(census_year)={last}", "limit": 100, "offset": offset}
        rows = json.loads(fetch(census + urllib.parse.urlencode(q))).get("results") or []
        for r in rows:
            y = year_of(r.get("construction_year"))
            if y and r.get("property_id") is not None:
                year[str(r["property_id"])] = y
                where[str(r["property_id"])] = (r["latitude"], r["longitude"])
        if len(rows) < 100:
            break
        offset += 100
    ps, pw, pn, pe = padded(box, 100)
    polys, has, offset = [], set(), 0
    while True:
        q = {"select": "property_id,geo_shape", "where": f"in_bbox(geo_point_2d,{ps},{pw},{pn},{pe})",
             "limit": 100, "offset": offset}
        rows = json.loads(fetch(MELB + "2020-building-footprints/records?" + urllib.parse.urlencode(q))).get("results") or []
        for r in rows:
            pid = str(r.get("property_id"))
            if pid in year:
                has.add(pid)
                for ring in outer_rings((r.get("geo_shape") or {}).get("geometry")):
                    polys.append((year[pid], ring))
        if len(rows) < 100:
            break
        offset += 100
    pts = [(la, lo, year[pid]) for pid, (la, lo) in where.items() if pid not in has]
    return "polys", polys, pts


# Spain: the Catastro's own years for landmarks it gives a refurbishment year (reference: documented).
CATASTRO_YEARS = {
    "1341701VK4714A": 1819,   # Museo del Prado, Villanueva building (opened 1819)
    "1543901VK4714D": 1635,   # Casón del Buen Retiro
    "1442601VK4714A": 1894,   # Real Academia Española
    "1344501VK4714C": 1893,   # Biblioteca Nacional / Museo Arqueológico
    "1343708VK4714C": 1910,   # Palacio de Cibeles
}


def spain(box):
    """The Catastro's INSPIRE buildings (not the Basque Country or Navarre), in pieces under its 4 km²
    cap; a piece it cannot answer in time is split in four."""
    import re
    s, w, n, e = box
    out = []

    def piece(ys, xw, yn, xe, depth=0):
        q = {"service": "wfs", "version": "2.0.0", "request": "getfeature", "typenames": "BU.BUILDING",
             "bbox": f"{ys},{xw},{yn},{xe}", "SRSNAME": "EPSG:4326"}
        try:
            gml = (fetch("https://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx?" + urllib.parse.urlencode(q))
                   or b"").decode("latin-1")
        except Exception:
            if depth >= 3:
                raise
            ym, xm = (ys + yn) / 2, (xw + xe) / 2
            for a in ((ys, xw, ym, xm), (ys, xm, ym, xe), (ym, xw, yn, xm), (ym, xm, yn, xe)):
                piece(*a, depth=depth + 1)
            return
        for part in gml.split("<gml:featureMember")[1:]:     # one bu-ext2d:Building each
            m = re.search(r"<bu-core2d:beginning>(\d{4})", part)
            ref = re.search(r'gml:id="ES\.SDGC\.BU\.([^"]+)"', part)
            y = CATASTRO_YEARS.get(ref.group(1) if ref else "") or (year_of(m.group(1)) if m else 0)
            for patch in re.findall(r"<gml:PolygonPatch>(.*?)</gml:PolygonPatch>", part, re.S) or [part]:
                ext = re.search(r"<gml:exterior>.*?<gml:posList[^>]*>([^<]+)", patch, re.S)
                if ext:
                    v = [float(t) for t in ext.group(1).split()]
                    out.append((y, [(v[k + 1], v[k]) for k in range(0, len(v) - 1, 2)]))

    step = 0.005
    y0 = s
    while y0 < n:
        x0 = w
        while x0 < e:
            piece(y0, x0, min(n, y0 + step), min(e, x0 + step))
            x0 += step
        y0 += step
    return "polys", out


# France: the BDNB's building groups, commune by commune (Paris, Lyon and Marseille by arrondissement).
# Its year is the land registers' (fichiers fonciers): for State- and City-owned buildings it is 1800,
# a re-registration year or nothing, so the monuments on these grounds carry their documented years
# (group id: year).
BDNB_YEARS = {
    "bdnb-bg-SG68-MJ2N-AR6E": 1900, "bdnb-bg-4K5U-T66N-C1DX": 1977, "bdnb-bg-7YEP-4NW1-WPHP": 1900,
    "bdnb-bg-QGRJ-QCUH-1XLS": 1732, "bdnb-bg-BQUG-8E8U-2TR3": 1659, "bdnb-bg-44W4-F1JQ-U9M1": 1857,
    "bdnb-bg-VUX4-3FY8-ZFV5": 1900, "bdnb-bg-JWA5-4BGN-K5H8": 1676, "bdnb-bg-U1LL-WUJZ-GJUN": 1676,
    "bdnb-bg-767W-2W5S-SH7Z": 1724, "bdnb-bg-KXBT-7377-FP55": 1857, "bdnb-bg-DZB9-77DA-3E6Z": 1500,
}
BDNB = "https://api.bdnb.io/v1/bdnb/donnees/batiment_groupe_complet?"


def bdnb_commune(code):
    """Every dated group in one commune, cached in data/bdnb/ (the API allows 10,000 calls a month)."""
    path = CACHE / "bdnb" / f"{code}.json"
    if path.exists():
        return json.loads(path.read_text())
    rows, offset, total = [], 0, None
    while total is None or offset < total:
        # Pages come shorter than asked when the outlines are heavy, so the true total (Content-Range,
        # with Prefer: count=exact) says when to stop; a fixed order keeps the pages from shifting.
        q = {"code_commune_insee": f"eq.{code}", "select": "batiment_groupe_id,annee_construction,geom_groupe",
             "or": "(annee_construction.not.is.null,batiment_groupe_id.in.(" + ",".join(BDNB_YEARS) + "))",
             "order": "batiment_groupe_id", "limit": 1000, "offset": offset}
        for attempt in range(5):
            try:
                req = urllib.request.Request(BDNB + urllib.parse.urlencode(q), headers={**AGENT, "Prefer": "count=exact"})
                with urllib.request.urlopen(req, timeout=300) as resp:
                    rng = resp.headers.get("Content-Range") or ""
                    page = json.loads(resp.read() or b"[]")
                break
            except Exception:
                if attempt == 4:
                    raise
                time.sleep(2 ** (attempt + 1))
        if total is None:
            total = int(rng.split("/")[-1]) if "/" in rng and rng.split("/")[-1].isdigit() else 0
        if not page:
            break
        rows += page
        offset += len(page)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rows))
    return rows


def france(box):
    from pyproj import Transformer
    s, w, n, e = box
    communes = set()
    q = urllib.parse.urlencode({"lat": (s + n) / 2, "lon": (w + e) / 2, "format": "jsonv2", "zoom": 3, "addressdetails": 1})
    if (json.loads(fetch("https://nominatim.openstreetmap.org/reverse?" + q) or b"{}").get("address") or {}).get("country_code") != "fr":
        return "polys", []
    time.sleep(1.1)
    for la, lo in ((s, w), (s, e), (n, w), (n, e), ((s + n) / 2, (w + e) / 2)):
        # At zoom 12 the answer is the commune, or the arrondissement in Paris, Lyon and Marseille,
        # as the BDNB counts them, and OpenStreetMap carries its INSEE code.
        q = urllib.parse.urlencode({"lat": la, "lon": lo, "format": "jsonv2", "zoom": 12,
                                    "addressdetails": 1, "extratags": 1})
        d = json.loads(fetch("https://nominatim.openstreetmap.org/reverse?" + q) or b"{}")
        code = (d.get("extratags") or {}).get("ref:INSEE", "")
        pc = (d.get("address") or {}).get("postcode", "")
        if len(code) == 5 and code != "75056":
            communes.add(code)
        elif pc.startswith("750") and len(pc) == 5:
            communes.add("751" + pc[3:])                 # Paris: postcode 750NN is arrondissement 751NN
        time.sleep(1.1)
    to_ll = Transformer.from_crs(2154, 4326, always_xy=True)
    out = []
    for code in sorted(communes):
        for r in bdnb_commune(code):
            y = BDNB_YEARS.get(r.get("batiment_groupe_id")) or year_of(r.get("annee_construction"))
            for ring in outer_rings(r.get("geom_groupe")):
                xs, ys = zip(*[c[:2] for c in ring])
                lons, lats = to_ll.transform(xs, ys)
                if max(lats) < s or min(lats) > n or max(lons) < w or min(lons) > e:
                    continue
                out.append((y, list(zip(lons, lats))))
    return "polys", out


# London: the GLA's building stock model, borough by borough (the boroughs round our places): one
# point a building (its OS TOID), the band most of its dwellings give — observed bands before modelled
# ones, the earlier band on a tie — each band standing for its middle year. Homes only: the museums,
# churches and offices go on to the satellite layers.
LBSM = "https://data.london.gov.uk/download/2k55d/"
LBSM_BOROUGHS = {
    "Westminster": "b871c181-1be1-4e43-b10b-154dea109555/LBSMv2_Westminster.csv",
    "Camden": "3d4072e0-2731-4617-a166-6a0e18067b6f/LBSMv2_Camden.csv",
    "Kensington and Chelsea": "d9453dfa-7c4e-4330-b4ce-035bc2b29b0a/"
                              "London%20Building%20Stock%20Model%202%20-%20Kensington%20and%20Chelsea.csv",
    "City of London": "f1eecee2-7f7d-41b1-a574-02edc383d13a/LBSMv2_City_of_London.csv",
    "Lambeth": "c7845e78-00fc-4f93-b70c-c5d245713110/LBSMv2_Lambeth.csv",
    "Southwark": "76f9f478-7636-45be-adaf-19903354ec73/LBSMv2_Southwark.csv",
}
LBSM_BAND = {"pre-1900": 1880, "1900-1929": 1915, "1930-1949": 1940, "1950-1966": 1958, "1967-1982": 1975,
             "1983-1995": 1989, "1996-2011": 2004, "2012-onwards": 2016}
_lbsm = None


def london(box):
    global _lbsm
    if _lbsm is None:
        import csv
        from collections import Counter, defaultdict
        from pyproj import Transformer
        to_ll = Transformer.from_crs(27700, 4326, always_xy=True)
        toid = defaultdict(lambda: {"e": [], "n": [], "known": Counter(), "all": Counter()})
        for name, path in LBSM_BOROUGHS.items():
            local_csv = CACHE / "lbsm" / (name.replace(" ", "_") + ".csv")
            if not local_csv.exists():
                local_csv.parent.mkdir(parents=True, exist_ok=True)
                local_csv.write_bytes(fetch(LBSM + path, timeout=900) or b"")
            with open(local_csv, encoding="utf-8", errors="ignore") as f:
                for r in csv.DictReader(f):
                    y = LBSM_BAND.get(r.get("construction_age_band", ""))
                    if not y or not r.get("easting"):
                        continue
                    t = toid[r.get("os_topo_toid") or r.get("uprn")]
                    t["e"].append(float(r["easting"]))
                    t["n"].append(float(r["northing"]))
                    t["all"][y] += 1
                    if str(r.get("construction_age_band_known")) == "1":
                        t["known"][y] += 1
        pts = []
        for t in toid.values():
            bands = t["known"] or t["all"]
            y = min(bands, key=lambda b: (-bands[b], b))
            pts.append((sum(t["e"]) / len(t["e"]), sum(t["n"]) / len(t["n"]), y))
        _lbsm = []
        if pts:
            E, N, Y = zip(*pts)
            lons, lats = to_ll.transform(E, N)
            _lbsm = list(zip(lats, lons, Y))
    s, w, n, e = padded(box, 25)
    return "points", [p for p in _lbsm if s <= p[0] <= n and w <= p[1] <= e]


# King County (Seattle): the Assessor's building-age layers, published by King County GIS (a February
# 2021 snapshot). One point an address, with its building's year; where one place is in several
# layers, commercial first, then apartments, houses, condominiums. 1900 is the Assessor's floor:
# "1900 or earlier".
KC = "https://services.arcgis.com/Ej0PsM5Aw677QF1W/arcgis/rest/services/{}_Parcels_with_Building_Age/FeatureServer/2"


def king_county(box):
    got = {}
    for layer in ("Commercial", "Apartment", "Residential", "Condo_Complex"):
        for a, (lo, la) in arcgis(KC.format(layer), padded(box, 40), "PIN,YrBuilt", points=True):
            y = year_of(a.get("YrBuilt"))
            if not y:
                continue
            key = (a.get("PIN"), round(lo, 6), round(la, 6))
            if key not in got:
                got[key] = (la, lo, OLD if y <= 1900 else y)
    return "points", list(got.values())


# Miami-Dade: the county's building footprints with their folio's year built (the Property
# Appraiser's). 9999 is "under construction or not known".
MIAMI = "https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/BuildingFootprintUBIDFolio_gdb/FeatureServer/0"


def miami_dade(box):
    return "polys", [(year_of(a.get("YEAR_BUILT")), ring)
                     for a, ring in arcgis(MIAMI, box, "YEAR_BUILT", where="YEAR_BUILT>0 AND YEAR_BUILT<9999")]


CITIES = [   # (the name builtFrom gives it, south, west, north, east, fetcher)
    ("New York City building footprints and PLUTO", *NYC, new_york),
    ("BAG (Kadaster)", *NL, netherlands),
    ("London Building Stock Model 2 (GLA)", 51.28, -0.51, 51.70, 0.34, london),
    ("BDNB (CSTB)", 41.3, -5.2, 51.1, 9.6, france),
    ("DC assessor (CAMA)", 38.79, -77.12, 39.0, -76.90, washington),
    ("LA County Assessor", 33.70, -118.95, 34.85, -117.65, los_angeles),
    ("Chicago building footprints", 41.64, -87.94, 42.03, -87.52, chicago),
    ("Boston assessing", 42.22, -71.20, 42.40, -70.98, boston),
    ("Philadelphia OPA and PWD parcels", 39.86, -75.29, 40.14, -74.95, philadelphia),
    ("Vienna building information (Stadt Wien)", 48.11, 16.18, 48.33, 16.58, vienna),
    ("Swiss building register (GWR)", 45.8, 5.9, 47.9, 10.5, switzerland),
    ("City of Melbourne CLUE", -37.86, 144.89, -37.77, 145.0, melbourne),
    ("Catastro (Spain)", 35.9, -9.4, 43.8, 4.4, spain),
    ("King County Assessor", 47.08, -122.54, 47.78, -121.06, king_county),
    ("Miami-Dade County Property Appraiser", 25.13, -80.87, 25.98, -80.11, miami_dade),
]


def city_years(place, box, lat, lon, cell):
    """Years for the cells from whichever city covers the place: (years, name), or (None, None)."""
    import shapely
    for name, s, w, n, e, fetcher in CITIES:
        if not (s <= place["lat"] <= n and w <= place["lon"] <= e):
            continue
        got = fetcher(box)
        rows = got[1] if got[0] == "polys" else []
        pts = got[1] if got[0] == "points" else (got[2] if len(got) > 2 else [])
        if not rows and not pts:
            continue            # a box that also takes in a neighbour (France's takes in Bern): try the next
        years = np.zeros(len(lat), dtype=np.int64)
        covered = np.zeros(len(lat), dtype=bool)
        here = shapely.points(lon, lat)
        polys, ys = [], []
        for y, ring in rows:
            if len(ring) >= 3:
                polys.append(shapely.Polygon(ring))
                ys.append(y)
        if polys:
            ys = np.asarray(ys, dtype=np.int64)
            hit_pt, hit_poly = shapely.STRtree(polys).query(here, predicate="within")
            for kp, kq in zip(hit_pt, hit_poly):
                covered[kp] = True
                y = ys[kq]
                if y > 0 and (years[kp] <= 0 or y < years[kp]):
                    years[kp] = y
                elif y < 0 and years[kp] == 0:
                    years[kp] = y
            # The ground's footprints (Overture's) and the city's differ by a metre or two, so a cell in
            # none of the city's outlines takes the year of its nearest outline within a cell — never a
            # cell inside an outline the city leaves undated.
            said = np.flatnonzero(ys != 0)
            miss = np.flatnonzero(~covered)
            if miss.size and said.size:
                tree = shapely.STRtree([polys[k] for k in said])
                ip, iq = tree.query_nearest(here[miss], max_distance=cell / 111320, all_matches=False)
                years[miss[ip]] = ys[said][iq]
                covered[miss[ip]] = True
        if pts:
            P = np.array([(r[0], r[1], r[2], r[3] if len(r) > 3 else 0.0) for r in pts], dtype=float)
            reach = max(cell, 25.0)
            for k in np.flatnonzero(~covered):
                dy = (P[:, 0] - lat[k]) * 111320
                dx = (P[:, 1] - lon[k]) * 111320 * math.cos(math.radians(lat[k]))
                d = np.sqrt(dx * dx + dy * dy) - P[:, 3]
                m = int(np.argmin(d))
                if d[m] <= reach:
                    years[k] = int(P[m, 2])
        return years, name
    return None, None


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
    got, name = city_years(place, (s, w, nn, e), lat, lon, cell)
    if got is not None:
        years = got
        if (got != 0).any():
            said.append(name)

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
        # "By 1975" is the satellites' floor. Where the city's own years go back before it, such a
        # building is as likely old as not: it stands from the start rather than rising in 1975.
        if got is not None and ((got > 0) & (got < 1975)).any():
            years[rest & (years == 1975)] = 0
    years[years < 0] = 0          # old, year not known: there from the start
    return years.tolist(), said


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--only")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--cities", action="store_true", help="only the places a city source covers (with --force: re-date them)")
    args = ap.parse_args()
    places = []
    for f in PLACES:
        if f.exists():
            d = json.loads(f.read_text(encoding="utf-8"))
            places += d.get("buildings", d.get("museums", []))
    places = [p for p in places if isinstance(p.get("lat"), (int, float))]
    if args.only:
        places = [p for p in places if p["slug"] == args.only]
    if args.cities:
        places = [p for p in places if any(c[1] <= p["lat"] <= c[3] and c[2] <= p["lon"] <= c[4] for c in CITIES)]
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
