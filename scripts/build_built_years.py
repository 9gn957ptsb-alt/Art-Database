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
            key = (f.get("properties") or {}).get("identificatie")
            if key in seen:
                continue
            seen.add(key)
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
        start += 1000


# ---- more cities: each a coverage box and a fetcher ----------------------------------------------
# A fetcher takes (south, west, north, east) and gives ("points", [(lat, lon, year)]) — each to the
# nearest building cell within a cell or 25 m — or ("polys", [(year, [(lon, lat), ...])]) — each to
# the cells whose middles it holds.

THIS_YEAR = time.localtime().tm_year


def year_of(v):
    try:
        y = int(float(str(v).strip()[:4]))
    except (TypeError, ValueError):
        return 0
    return y if 1200 <= y <= THIS_YEAR else 0


def arcgis(url, box, field):
    """Polygons with their attributes from an ArcGIS REST layer, paged: [(attributes, ring)]."""
    s, w, n, e = box
    out, offset = [], 0
    while True:
        q = {"where": "1=1", "geometry": f"{w},{s},{e},{n}", "geometryType": "esriGeometryEnvelope",
             "inSR": 4326, "outSR": 4326, "spatialRel": "esriSpatialRelIntersects", "outFields": field,
             "returnGeometry": "true", "f": "json", "resultOffset": offset, "resultRecordCount": 1000}
        d = json.loads(fetch(url + "/query?" + urllib.parse.urlencode(q)))
        feats = d.get("features") or []
        for f in feats:
            rings = (f.get("geometry") or {}).get("rings") or []
            if rings:
                out.append((f.get("attributes") or {}, rings[0]))
        if not d.get("exceededTransferLimit") or not feats:
            return out
        offset += len(feats)


def philadelphia(box):
    s, w, n, e = box
    q = ("SELECT year_built, ST_Y(the_geom) AS lat, ST_X(the_geom) AS lon FROM opa_properties_public "
         f"WHERE the_geom && ST_MakeEnvelope({w},{s},{e},{n},4326)")
    rows = json.loads(fetch("https://phl.carto.com/api/v2/sql?" + urllib.parse.urlencode({"q": q}))).get("rows", [])
    return "points", [(r["lat"], r["lon"], year_of(r["year_built"])) for r in rows
                      if r.get("lat") and year_of(r.get("year_built"))]


def los_angeles(box):
    url = "https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0"
    return "polys", [(year_of(a.get("YearBuilt1")), ring) for a, ring in arcgis(url, box, "YearBuilt1")
                     if year_of(a.get("YearBuilt1"))]


def boston(box):
    url = "https://gisportal.boston.gov/arcgis/rest/services/Assessing/Property_Assessment_FY25/FeatureServer/0"
    return "polys", [(year_of(a.get("YR_BUILT")), ring) for a, ring in arcgis(url, box, "YR_BUILT")
                     if year_of(a.get("YR_BUILT"))]


def washington(box):
    """Lots by place (their SSL), then each lot's year from the assessor's tables (AYB, actual year built)."""
    base = "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator"
    lots = arcgis(base + "/MapServer/39", box, "SSL")
    ssl = sorted({a["SSL"] for a, _ in lots if a.get("SSL")})
    year = {}
    for layer in (25, 23, 24):                    # residential, commercial, condominium
        for k in range(0, len(ssl), 80):
            where = "SSL IN (" + ",".join("'" + x.replace("'", "''") + "'" for x in ssl[k:k + 80]) + ")"
            q = {"where": where, "outFields": "SSL,AYB", "returnGeometry": "false", "f": "json"}
            d = json.loads(fetch(f"{base}/FeatureServer/{layer}/query?" + urllib.parse.urlencode(q)))
            for f in d.get("features") or []:
                at = f.get("attributes") or {}
                y = year_of(at.get("AYB"))
                if y and (at["SSL"] not in year or y < year[at["SSL"]]):
                    year[at["SSL"]] = y
    return "polys", [(year[a["SSL"]], ring) for a, ring in lots if a.get("SSL") in year]


def chicago(box):
    s, w, n, e = box
    q = {"$select": "year_built,the_geom", "$where": f"within_box(the_geom,{n},{w},{s},{e})", "$limit": 50000}
    d = json.loads(fetch("https://data.cityofchicago.org/resource/syp8-uezg.geojson?" + urllib.parse.urlencode(q)))
    out = []
    for f in d.get("features") or []:
        y = year_of((f.get("properties") or {}).get("year_built"))
        g = f.get("geometry") or {}
        if y and g.get("type") in ("Polygon", "MultiPolygon"):
            for poly in (g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]):
                out.append((y, poly[0]))
    return "polys", out


def vienna(box):
    s, w, n, e = box
    q = {"service": "WFS", "request": "GetFeature", "version": "1.1.0", "typeName": "ogdwien:GEBAEUDEINFOOGD",
         "srsName": "EPSG:4326", "outputFormat": "json", "bbox": f"{w},{s},{e},{n},EPSG:4326"}
    d = json.loads(fetch("https://data.wien.gv.at/daten/geo?" + urllib.parse.urlencode(q)))
    pts, polys = [], []
    for f in d.get("features") or []:
        y = year_of((f.get("properties") or {}).get("BAUJAHR"))
        g = f.get("geometry") or {}
        if not y or not g:
            continue
        if g["type"] == "Point":
            pts.append((g["coordinates"][1], g["coordinates"][0], y))
        elif g["type"] in ("Polygon", "MultiPolygon"):
            for poly in (g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]):
                polys.append((y, poly[0]))
    return ("polys", polys) if polys else ("points", pts)


# The Swiss register's period codes (gbaup), where a building has no year: the middle of each period.
GWR_PERIOD = {8011: 1900, 8012: 1932, 8013: 1953, 8014: 1966, 8015: 1976, 8016: 1983, 8017: 1988,
              8018: 1993, 8019: 1998, 8020: 2003, 8021: 2008, 8022: 2013, 8023: 2018}


def switzerland(box):
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
            y = year_of(at.get("gbauj")) or GWR_PERIOD.get(at.get("gbaup") or 0, 0)
            if y and g.get("type") == "Point":
                out.append((g["coordinates"][1], g["coordinates"][0], y))
        if len(res) < 200:
            return "points", out
        offset += 200


def melbourne(box):
    s, w, n, e = box
    base = ("https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/"
            "buildings-with-name-age-size-accessibility-and-bicycle-facilities/records?")
    latest, offset = {}, 0
    while offset < 9900:
        q = {"select": "property_id,construction_year,latitude,longitude,census_year",
             "where": f"latitude>{s} and latitude<{n} and longitude>{w} and longitude<{e}",
             "order_by": "census_year desc", "limit": 100, "offset": offset}
        rows = json.loads(fetch(base + urllib.parse.urlencode(q))).get("results") or []
        for r in rows:
            latest.setdefault(r.get("property_id"), r)       # the latest census first
        if len(rows) < 100:
            break
        offset += 100
    return "points", [(r["latitude"], r["longitude"], year_of(r.get("construction_year")))
                      for r in latest.values() if r.get("latitude") and year_of(r.get("construction_year"))]


def spain(box):
    """The Catastro's INSPIRE buildings (not the Basque Country or Navarre), in pieces under its 4 km² cap."""
    import re
    s, w, n, e = box
    out, step = [], 0.012
    y0 = s
    while y0 < n:
        x0 = w
        while x0 < e:
            q = {"service": "wfs", "version": "2.0.0", "request": "getfeature", "typenames": "BU.BUILDING",
                 "bbox": f"{y0},{x0},{min(n, y0 + step)},{min(e, x0 + step)}", "SRSNAME": "EPSG:4326"}
            gml = (fetch("https://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx?" + urllib.parse.urlencode(q))
                   or b"").decode("latin-1")
            for part in gml.split("<gml:featureMember")[1:]:     # one bu-ext2d:Building each
                m = re.search(r"<bu-core2d:beginning>(\d{4})", part)
                pl = re.search(r"<gml:posList[^>]*>([^<]+)", part)
                if not m or not pl or not year_of(m.group(1)):
                    continue
                v = [float(t) for t in pl.group(1).split()]
                out.append((year_of(m.group(1)), [(v[k + 1], v[k]) for k in range(0, len(v) - 1, 2)]))
            x0 += step
        y0 += step
    return "polys", out


def france(box):
    """The BDNB's building groups, commune by commune (Paris by arrondissement), kept where they meet the box."""
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
        offset, total = 0, None
        while total is None or offset < total:
            # It answers pages shorter than asked when the outlines are heavy, so the true total (from
            # Content-Range, with Prefer: count=exact) says when to stop, not a short page.
            q = {"code_commune_insee": f"eq.{code}", "select": "annee_construction,geom_groupe",
                 "annee_construction": "not.is.null", "limit": 1000, "offset": offset}
            req = urllib.request.Request("https://api.bdnb.io/v1/bdnb/donnees/batiment_groupe_complet?"
                                         + urllib.parse.urlencode(q), headers={**AGENT, "Prefer": "count=exact"})
            with urllib.request.urlopen(req, timeout=300) as resp:
                rng = resp.headers.get("Content-Range") or ""
                rows = json.loads(resp.read() or b"[]")
            if total is None:
                total = int(rng.split("/")[-1]) if "/" in rng and rng.split("/")[-1].isdigit() else 0
            for r in rows:
                y, g = year_of(r.get("annee_construction")), r.get("geom_groupe") or {}
                if not y or g.get("type") not in ("Polygon", "MultiPolygon"):
                    continue
                for poly in (g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]):
                    xs, ys = zip(*[c[:2] for c in poly[0]])
                    lons, lats = to_ll.transform(xs, ys)
                    if max(lats) < s or min(lats) > n or max(lons) < w or min(lons) > e:
                        continue
                    out.append((y, list(zip(lons, lats))))
            if not rows:
                break
            offset += len(rows)
    return "polys", out


# London: the GLA's building stock model, borough by borough (the boroughs round our places), each age
# band standing for its middle year.
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
        from pyproj import Transformer
        to_ll = Transformer.from_crs(27700, 4326, always_xy=True)
        pts = []
        for name, path in LBSM_BOROUGHS.items():
            local_csv = CACHE / "lbsm" / (name.replace(" ", "_") + ".csv")
            if not local_csv.exists():
                local_csv.parent.mkdir(parents=True, exist_ok=True)
                local_csv.write_bytes(fetch(LBSM + path, timeout=900) or b"")
            with open(local_csv, encoding="utf-8", errors="ignore") as f:
                for r in csv.DictReader(f):
                    y = LBSM_BAND.get(r.get("construction_age_band", ""))
                    if y and r.get("easting"):
                        pts.append((float(r["easting"]), float(r["northing"]), y))
        _lbsm = []
        if pts:
            E, N, Y = zip(*pts)
            lons, lats = to_ll.transform(E, N)
            _lbsm = list(zip(lats, lons, Y))
    s, w, n, e = box
    return "points", [p for p in _lbsm if s <= p[0] <= n and w <= p[1] <= e]


def new_york(box):
    return "points", pluto_years(box)


def netherlands(box):
    return "polys", bag_polygons(box)


CITIES = [   # (the name builtFrom gives it, south, west, north, east, fetcher)
    ("New York City PLUTO", *NYC, new_york),
    ("BAG (Kadaster)", *NL, netherlands),
    ("London Building Stock Model 2 (GLA)", 51.28, -0.51, 51.70, 0.34, london),
    ("BDNB (CSTB)", 41.3, -5.2, 51.1, 9.6, france),
    ("DC assessor (CAMA)", 38.79, -77.12, 39.0, -76.90, washington),
    ("LA County Assessor", 33.70, -118.95, 34.85, -117.65, los_angeles),
    ("Chicago building footprints", 41.64, -87.94, 42.03, -87.52, chicago),
    ("Boston assessing", 42.22, -71.20, 42.40, -70.98, boston),
    ("Philadelphia OPA", 39.86, -75.29, 40.14, -74.95, philadelphia),
    ("Vienna building information (Stadt Wien)", 48.11, 16.18, 48.33, 16.58, vienna),
    ("Swiss building register (GWR)", 45.8, 5.9, 47.9, 10.5, switzerland),
    ("City of Melbourne CLUE", -37.86, 144.89, -37.77, 145.0, melbourne),
    ("Catastro (Spain)", 35.9, -9.4, 43.8, 4.4, spain),
]


def city_years(place, box, lat, lon, cell):
    """Years for the cells from whichever city covers the place: (years, name), or (None, None)."""
    import shapely
    for name, s, w, n, e, fetcher in CITIES:
        if not (s <= place["lat"] <= n and w <= place["lon"] <= e):
            continue
        kind, rows = fetcher(box)
        years = np.zeros(len(lat), dtype=np.int64)
        if not rows:
            continue            # a box that also takes in a neighbour (France's takes in Bern): try the next
        if kind == "points":
            P = np.array(rows, dtype=float)
            reach = max(cell, 25.0)
            for k in range(len(lat)):
                dy = (P[:, 0] - lat[k]) * 111320
                dx = (P[:, 1] - lon[k]) * 111320 * math.cos(math.radians(lat[k]))
                d2 = dx * dx + dy * dy
                m = int(np.argmin(d2))
                if d2[m] <= reach * reach:
                    years[k] = int(P[m, 2])
        else:
            polys, ys = [], []
            for y, ring in rows:
                if len(ring) >= 3:
                    polys.append(shapely.Polygon(ring))
                    ys.append(y)
            tree = shapely.STRtree(polys)
            hit_pt, hit_poly = tree.query(shapely.points(lon, lat), predicate="within")
            for kp, kq in zip(hit_pt, hit_poly):
                if not years[kp]:
                    years[kp] = ys[kq]
            # The ground's footprints (Overture's) and the city's differ by a metre or two, so a cell
            # at a building's edge takes the year of the city's building within a cell of it.
            miss = np.flatnonzero(years == 0)
            if miss.size and polys:
                ip, iq = tree.query_nearest(shapely.points(lon[miss], lat[miss]),
                                            max_distance=cell / 111320, all_matches=False)
                years[miss[ip]] = np.asarray(ys)[iq]
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
        if (got > 0).any():
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
