#!/usr/bin/env python3
"""The cities' own building years, from sources that do not answer the Claude sessions.

The artist, 8 Oct 2026: "Right now there are plenty of places in which the map does not show up
before a certain date, many European cities do not show up until the 1940s or 60s. Use any available
information you have across the Internet to fill in the geographical maps of cities that are blank
before a certain date." Several cities publish when their buildings went up — a year a building, or
a period a block or a census section — on servers the sessions' network does not reach (Spain's
Catastro answers nothing; others are not on its list). This runs where they answer: on GitHub's
runners (.github/workflows/city-records.yml), or anywhere with a route to them.

For every ground (docs/v2/grounds/<slug>.json, the squares build_grounds.py cuts round the cities'
skylines, the museums, the buildings and the lives' places) that a source in SOURCES covers, it reads
the source over the square and gives each building cell the year of the outline (or block, or section)
it stands in — the same join build_built_years.py makes for the sources that do answer the session
(join_years) — and writes

    records/years/<slug>.json   {sources, licence, read, floor, n, side, cells: {cell index: year}}

with only the cells a source dates (a year; -1 for "old": a source's open first class, "before 1919",
whose year is its `floor`). Building cells are indexed i * n + j, row i from the north. Nothing
personal is read or kept: years and outlines only, and only the years are written. build_built_years.py
reads these after the city's own source and before OpenStreetMap's dates and the satellites.

A second kind of source counts a block's buildings by period instead of giving each its year
(Italy's census sections): --census joins every building cell to its block and writes

    records/census/<slug>.json  {source, licence, read, n, side, periods [[label, year]], floor,
                                 codes [block], sections [[count a period]], cells: {cell index: block}}

and build_built_years.py deals each block's cells that nothing else dates in the block's shares.
--probe prints what the hosts of the sources still to write offer (their layers, their downloads).

    python3 scripts/fetch_city_records.py [--only slug] [--source name] [--list] [--census] [--probe]
"""

import argparse
import csv
import io
import json
import math
import re
import shutil
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_built_years as B  # noqa: E402
from build_grounds import local  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
GROUNDS = ROOT / "docs" / "v2" / "grounds"
OUT = ROOT / "records" / "years"
DATA = ROOT / "data" / "records"          # downloads, not committed (and on a runner, thrown away)

# (name builtFrom gives it, licence, (south, west, north, east), floor or None, reader(box) -> answer)
# An answer is build_built_years' ("polys", [(year, ring [(lon, lat)...])]) or ("points", [(lat, lon,
# year[, radius m])]); a year of -1 is "old" (before the floor). Readers are added below as their
# sources are confirmed (see the docstring of each).
SOURCES = []

# Brussels: urban.brussels' WFS (Brussels-Capital Region). The inventory of the architectural heritage
# (Irismonument), 40,919 buildings on 8 Oct 2026, each a point at its address with the year it was
# built ("BULT"; the scientific inventory's "BUILT"); and BruCiel's map of the region built up by 1930
# (Historique_Urbanisation_1930): a building inside it stood by 1930 (old, floor 1930), and one the
# satellites have as there by 1975 outside it went up between 1930 and 1975 (EXTENT; build_built_years).
BXL_WFS_GET = ("https://gis.urban.brussels/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature"
               "&outputFormat=application/json&")
BXL_BOX = (50.75, 4.22, 50.93, 4.50)
EXTENT = {}


def _bxl(layer, box):
    """A layer's features over the square, in pages, and the transform from the region's Lambert 72."""
    from pyproj import Transformer
    to_l72 = Transformer.from_crs(4326, 31370, always_xy=True)
    s, w, n, e = box
    xs, ys = to_l72.transform([w, e, w, e], [s, s, n, n])
    bbox = f"{min(xs)},{min(ys)},{max(xs)},{max(ys)},urn:ogc:def:crs:EPSG::31370"
    out, start = [], 0
    while True:
        q = {"typeNames": layer, "bbox": bbox, "count": 5000, "startIndex": start}
        d = json.loads(B.fetch(BXL_WFS_GET + urllib.parse.urlencode(q), timeout=600) or b"{}")
        feats = d.get("features") or []
        out += feats
        if len(feats) < 5000:
            return out, Transformer.from_crs(31370, 4326, always_xy=True)
        start += len(feats)


def brussels_inventory(box):
    pts = []
    for layer, field in (("URBAN_DCH_IBH:Irismonument_inventory", "BULT"),
                         ("URBAN_DCH_IBH:Irismonument_scientific_inventory", "BUILT")):
        feats, to_ll = _bxl(layer, box)
        took = 0
        for f in feats:
            g = f.get("geometry") or {}
            m = re.search(r"\b(1[0-9]{3}|20[0-2][0-9])\b", str((f.get("properties") or {}).get(field) or ""))
            if g.get("type") != "Point" or not m or not 1000 <= int(m.group(1)) <= B.THIS_YEAR:
                continue
            lon, lat = to_ll.transform(*g["coordinates"][:2])
            pts.append((lat, lon, int(m.group(1))))
            took += 1
        print(f"    {layer}: {len(feats)} in the square, {took} with a year", flush=True)
    return "points", pts


def brussels_1930(box):
    feats, to_ll = _bxl("BRUCIEL:Historique_Urbanisation_1930", box)
    rings = []
    for f in feats:
        g = f.get("geometry") or {}
        polys = (g.get("coordinates") or []) if g.get("type") == "MultiPolygon" else [g.get("coordinates") or []]
        for poly in polys:
            if poly and len(poly[0]) >= 4:        # the outer ring: a hole in what was built up is left in it
                xs, ys = zip(*[c[:2] for c in poly[0]])
                rings.append((B.OLD, list(zip(*to_ll.transform(xs, ys)))))
    print(f"    built up by 1930: {len(feats)} areas, {len(rings)} rings", flush=True)
    return "polys", rings


SOURCES += [
    ("Brussels heritage inventory (urban.brussels)", "Brussels-Capital Region open data (urban.brussels)",
     BXL_BOX, None, brussels_inventory),
    ("Brussels built up by 1930 (urban.brussels, BruCiel)", "Brussels-Capital Region open data (urban.brussels)",
     BXL_BOX, 1930, brussels_1930),
]
EXTENT["Brussels built up by 1930 (urban.brussels, BruCiel)"] = 1930


def cells_of(place, g):
    """The ground's building cells: their indexes and their middles (lat, lon)."""
    n, side = g["n"], g["side"]
    cell = side / n
    half = side / 2
    _, to_deg = local(place["lat"], place["lon"])
    idx = [k for k in range(n * n) if g["kind"][k] == "b"]
    pts = [to_deg((k % n + 0.5) * cell - half, half - (k // n + 0.5) * cell) for k in idx]
    lon = np.array([p[0] for p in pts])
    lat = np.array([p[1] for p in pts])
    return idx, lat, lon, cell


def square(place, g):
    _, to_deg = local(place["lat"], place["lon"])
    half = g["side"] / 2
    w, s = to_deg(-half, -half)
    e, n = to_deg(half, half)
    return (s, w, n, e)


def places():
    out = []
    for f in B.PLACES:
        if f.exists():
            d = json.loads(f.read_text(encoding="utf-8"))
            out += [p for p in d.get("buildings", d.get("museums", d.get("places", [])))
                    if isinstance(p.get("lat"), (int, float))]
    return out


def download(url, name):
    """A file, once, into data/records/."""
    path = DATA / name
    if not path.exists():
        DATA.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(url, headers=B.AGENT)
        with urllib.request.urlopen(req, timeout=900) as r, open(str(path) + ".part", "wb") as f:
            shutil.copyfileobj(r, f)
        Path(str(path) + ".part").replace(path)
        print(f"    downloaded {name}: {path.stat().st_size // 1_000_000} MB", flush=True)
    return path


# Italy: ISTAT's 2011 census sections — each block's residential buildings by period of construction
# (E8–E16 of the sections' variables) — and their outlines, region by region (CC BY 3.0 IT). Each period
# stands for its middle year; "before 1919" is old, floor 1919.
ISTAT_SECTIONS = "https://www.istat.it/storage/cartografia/basi_territoriali/WGS_84_UTM/2011/R{r:02d}_11_WGS84.zip"
ISTAT_VARIABLES = "https://www.istat.it/storage/cartografia/variabili-censuarie/dati-cpa_2011.zip"
ISTAT_NAME = "ISTAT census 2011 (each block's buildings by period; which is which is not known)"
ISTAT_PERIODS = [["E8", "before 1919", -1], ["E9", "1919–1945", 1932], ["E10", "1946–1960", 1953],
                 ["E11", "1961–1970", 1966], ["E12", "1971–1980", 1976], ["E13", "1981–1990", 1986],
                 ["E14", "1991–2000", 1996], ["E15", "2001–2005", 2003], ["E16", "after 2005", 2008]]
ISTAT_REGIONS = {"piemonte": 1, "valle": 2, "lombardia": 3, "trentino": 4, "veneto": 5, "friuli": 6,
                 "liguria": 7, "emilia": 8, "toscana": 9, "umbria": 10, "marche": 11, "lazio": 12,
                 "abruzzo": 13, "molise": 14, "campania": 15, "puglia": 16, "basilicata": 17, "calabria": 18,
                 "sicilia": 19, "sardegna": 20}
_regions = None


def italy_region(p):
    """The ISTAT region a place is in (Nominatim's state), or None outside Italy."""
    global _regions
    path = DATA / "regions.json"
    if _regions is None:
        _regions = json.loads(path.read_text()) if path.exists() else {}
    at = f"{p['lat']:.4f},{p['lon']:.4f}"
    if at not in _regions:
        q = urllib.parse.urlencode({"lat": p["lat"], "lon": p["lon"], "format": "jsonv2", "zoom": 5,
                                    "addressdetails": 1, "accept-language": "it"})
        a = (json.loads(B.fetch("https://nominatim.openstreetmap.org/reverse?" + q) or b"{}").get("address") or {})
        state = (a.get("state") or a.get("region") or "").lower()
        _regions[at] = next((r for k, r in ISTAT_REGIONS.items() if state.startswith(k)), 0) \
            if a.get("country_code") == "it" else 0
        DATA.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(_regions, sort_keys=True))
        time.sleep(1.1)
    return _regions[at] or None


_sections = {}


def istat_sections(r):
    """The region's census sections: their codes and outlines (shapely, degrees)."""
    if r in _sections:
        return _sections[r]
    import shapefile
    import shapely
    from pyproj import CRS, Transformer
    z = zipfile.ZipFile(download(ISTAT_SECTIONS.format(r=r), f"istat_R{r:02d}_11_WGS84.zip"))
    names = z.namelist()
    shp = next(n for n in names if n.lower().endswith(".shp"))
    base = shp[:-4]
    pick = lambda ext: next(n for n in names if n.lower() == (base + ext).lower())
    prj = next((n for n in names if n.lower() == (base + ".prj").lower()), None)
    crs = CRS.from_wkt(z.read(prj).decode("latin-1")) if prj else CRS.from_epsg(32632)
    to_ll = Transformer.from_crs(crs, 4326, always_xy=True)
    sf = shapefile.Reader(shp=io.BytesIO(z.read(shp)), dbf=io.BytesIO(z.read(pick(".dbf"))),
                          shx=io.BytesIO(z.read(pick(".shx"))), encoding="latin-1")
    fields = [f[0] for f in sf.fields[1:]]
    print(f"    ISTAT R{r:02d}: {len(sf)} sections · {crs.name} · fields {fields}", flush=True)
    key = next(f for f in fields if f.upper() == "SEZ2011")
    codes, polys = [], []
    for sr in sf.iterShapeRecords():
        pts = sr.shape.points
        if not pts:
            continue
        parts = list(sr.shape.parts) + [len(pts)]
        shell, holes, out = None, [], []
        for a, b in zip(parts, parts[1:]):
            ring = pts[a:b]
            if len(ring) < 4:
                continue
            xs, ys = zip(*ring)
            ll = list(zip(*to_ll.transform(xs, ys)))
            if not shapely.LinearRing(ring).is_ccw:          # clockwise: an outer ring
                if shell:
                    out.append(shapely.Polygon(shell, holes))
                shell, holes = ll, []
            else:
                holes.append(ll)
        if shell:
            out.append(shapely.Polygon(shell, holes))
        if out:
            codes.append(int(float(sr.record[key])))
            polys.append(out[0] if len(out) == 1 else shapely.MultiPolygon(out))
    _sections[r] = (codes, polys)
    return codes, polys


_counts = {}


def istat_counts(r):
    """Each section's residential buildings by period: {SEZ2011: [count a period]}."""
    if r in _counts:
        return _counts[r]
    z = zipfile.ZipFile(download(ISTAT_VARIABLES, "istat_dati-cpa_2011.zip"))
    names = z.namelist()
    if not _counts:
        print(f"    ISTAT variables: {len(names)} files · {[n for n in names if not n.lower().endswith('.csv')][:12]}",
              flush=True)
        for n in names:                   # the variables' own descriptions, to check E8–E16 are the periods
            if re.search(r"tracciato|descri", n, re.I) and n.lower().endswith((".csv", ".txt")):
                for line in z.read(n).decode("latin-1").splitlines():
                    if re.match(r"\W*E(8|9|1[0-6])\b", line):
                        print("      " + line.strip()[:140], flush=True)
    want = next(n for n in names if n.lower().endswith(".csv") and "sezion" in n.lower()
                and re.search(rf"(^|[/_])R{r:02d}_", n, re.I))
    raw = z.read(want)
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    rows = csv.reader(io.StringIO(text), delimiter=";" if text[:2000].count(";") > text[:2000].count(",") else ",")
    head = [h.strip().upper().lstrip("\ufeff") for h in next(rows)]
    print(f"    {want}: columns {head[:14]} … {[h for h in head if h.startswith('E')][:20]}", flush=True)
    k_sez = head.index("SEZ2011")
    ks = [head.index(c) for c, _, _ in ISTAT_PERIODS]
    out = {}
    for row in rows:
        try:
            out[int(float(row[k_sez]))] = [int(float(row[k] or 0)) for k in ks]
        except (ValueError, IndexError):
            continue
    _counts[r] = out
    return out


def census(args):
    import shapely
    out = ROOT / "records" / "census"
    out.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y-%m-%d", time.gmtime())
    wrote = 0
    for p in places():
        if args.only and p["slug"] != args.only:
            continue
        path = GROUNDS / (p["slug"] + ".json")
        if not path.exists() or not (35.4 <= p["lat"] <= 47.2 and 6.5 <= p["lon"] <= 18.6):
            continue
        try:
            r = italy_region(p)
            if not r:
                continue
            g = json.loads(path.read_text(encoding="utf-8"))
            idx, lat, lon, cell = cells_of(p, g)
            if not idx:
                continue
            codes, polys = istat_sections(r)
            counts = istat_counts(r)
        except Exception as exc:
            print(f"  ! ISTAT · {p['slug']}: {type(exc).__name__}: {exc}", flush=True)
            continue
        hit_pt, hit_poly = shapely.STRtree(polys).query(shapely.points(lon, lat), predicate="within")
        sec = {}
        for kp, kq in zip(hit_pt.tolist(), hit_poly.tolist()):
            c = codes[kq]
            if sum(counts.get(c) or [0]) > 0:
                sec.setdefault(kp, c)
        used = sorted(set(sec.values()))
        at = {c: i for i, c in enumerate(used)}
        cells = {str(idx[kp]): at[c] for kp, c in sorted(sec.items())}
        if not cells:
            print(f"  · ISTAT · {p['slug']}: no section with buildings under its cells", flush=True)
            continue
        rec = {"source": ISTAT_NAME, "licence": "CC BY 3.0 IT (ISTAT)", "read": stamp, "n": g["n"],
               "side": g["side"], "periods": [[label, y] for _, label, y in ISTAT_PERIODS], "floor": 1919,
               "codes": used, "sections": [counts[c] for c in used], "cells": cells}
        (out / (p["slug"] + ".json")).write_text(json.dumps(rec, separators=(",", ":"), sort_keys=True),
                                                 encoding="utf-8")
        wrote += 1
        tot = [sum(col) for col in zip(*rec["sections"])]
        print(f"  + ISTAT · {p['slug']}: {len(cells)} of {len(idx)} cells in {len(used)} sections · "
              f"buildings by period {tot}", flush=True)
    print(f"\nWrote {wrote} census record(s) into records/census")


# The hosts of the sources still to write, and what to look for on each: (name, url, pattern to grab,
# pattern to keep), or with no pattern the answer's first characters as they come.
BXL_WFS = "https://gis.urban.brussels/geoserver/ows?service=WFS&version=2.0.0&"
PROBES = [
    ("Brussels inventory: fields", BXL_WFS + "request=DescribeFeatureType&typeNames=URBAN_DCH_IBH:Irismonument_inventory",
     None, None),
    ("Brussels inventory: two buildings", BXL_WFS + "request=GetFeature&typeNames=URBAN_DCH_IBH:Irismonument_inventory"
     "&count=2&outputFormat=application/json", None, None),
    ("Brussels scientific inventory: two", BXL_WFS + "request=GetFeature&typeNames="
     "URBAN_DCH_IBH:Irismonument_scientific_inventory&count=2&outputFormat=application/json", None, None),
    ("Brussels heritage: two", BXL_WFS + "request=GetFeature&typeNames=URBAN_DCH_IBH:Heritage&count=2"
     "&outputFormat=application/json", None, None),
    ("Brussels urbanisation 1930: one", BXL_WFS + "request=GetFeature&typeNames=BRUCIEL:Historique_Urbanisation_1930"
     "&count=1&outputFormat=application/json", None, None),
    ("Brussels inventory: how many", BXL_WFS + "request=GetFeature&typeNames=URBAN_DCH_IBH:Irismonument_inventory"
     "&resultType=hits", None, None),
    ("Statbel cadastral building stock", "https://statbel.fgov.be/en/open-data/cadastral-statistics-building-stock",
     r'href="([^"]+)"', r"\.zip|\.xlsx|\.txt|\.csv"),
    ("Colouring London data extracts", "https://colouringlondon.org/data-extracts", r'href="([^"]+)"',
     r"\.zip|\.csv|extract|download"),
    ("Colouring London extracts API", "https://colouringlondon.org/api/extracts", None, None),
]


def probe():
    for name, url, grab, keep in PROBES:
        try:
            req = urllib.request.Request(url, headers=B.AGENT)
            with urllib.request.urlopen(req, timeout=120) as r:
                text = r.read().decode("utf-8", "replace")
                print(f"\n## {name}: {r.status} · {len(text)} characters", flush=True)
        except Exception as exc:
            print(f"\n## {name}: {type(exc).__name__}: {exc}", flush=True)
            continue
        if not grab:
            print(text[:3500], flush=True)
            continue
        seen = []
        for m in re.findall(grab, text):
            if re.search(keep, m, re.I) and m not in seen:
                seen.append(m)
        for m in seen[:80]:
            print("   " + m[:200], flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--only", help="one ground's slug")
    ap.add_argument("--source", help="one source, by (part of) its name")
    ap.add_argument("--list", action="store_true", help="list the grounds each source covers, and stop")
    ap.add_argument("--census", action="store_true", help="the census blocks (Italy's sections), and stop")
    ap.add_argument("--probe", action="store_true", help="what the sources still to write offer, and stop")
    args = ap.parse_args()
    if args.probe:
        return probe()
    if args.census:
        return census(args)
    todo = []
    for name, licence, (s, w, n, e), floor, reader in SOURCES:
        if args.source and args.source.lower() not in name.lower():
            continue
        for p in places():
            if args.only and p["slug"] != args.only:
                continue
            if s <= p["lat"] <= n and w <= p["lon"] <= e and (GROUNDS / (p["slug"] + ".json")).exists():
                todo.append((name, licence, floor, reader, p))
    if args.list:
        for name, _, _, _, p in todo:
            print(f"{name}: {p['slug']}")
        return
    OUT.mkdir(parents=True, exist_ok=True)
    DATA.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y-%m-%d", time.gmtime())
    done = {}
    for name, licence, floor, reader, p in todo:
        g = json.loads((GROUNDS / (p["slug"] + ".json")).read_text(encoding="utf-8"))
        idx, lat, lon, cell = cells_of(p, g)
        if not idx:
            continue
        try:
            got = reader(square(p, g))
        except Exception as exc:          # one source failing keeps none of the others back
            print(f"  ! {name} · {p['slug']}: {type(exc).__name__}: {exc}", flush=True)
            continue
        years = B.join_years(got, lat, lon, cell)
        if years is None:
            print(f"  · {name} · {p['slug']}: nothing in its square", flush=True)
            continue
        rec = done.setdefault(p["slug"], {"sources": [], "licence": [], "read": stamp, "floor": None,
                                          "n": g["n"], "side": g["side"], "cells": {}})
        took = 0
        for k, y in zip(idx, years.tolist()):
            if y and str(k) not in rec["cells"]:          # the first source listed for a place wins
                rec["cells"][str(k)] = int(y)
                took += 1
        if took:
            rec["sources"].append(name)
            rec["licence"].append(licence)
            if floor and any(v < 0 for v in rec["cells"].values()):
                rec["floor"] = max(rec["floor"] or 0, floor)
            if name in EXTENT:
                rec["extent"] = EXTENT[name]
        dated = sum(1 for y in years.tolist() if y > 0)
        old = sum(1 for y in years.tolist() if y < 0)
        print(f"  + {name} · {p['slug']}: {dated} of {len(idx)} cells dated, {old} old", flush=True)
    for slug, rec in done.items():
        if rec["cells"]:
            (OUT / (slug + ".json")).write_text(json.dumps(rec, separators=(",", ":"), sort_keys=True),
                                               encoding="utf-8")
    print(f"\nWrote {sum(1 for r in done.values() if r['cells'])} record(s) into {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
