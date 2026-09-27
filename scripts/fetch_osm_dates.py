#!/usr/bin/env python3
"""OpenStreetMap's construction dates for the buildings round every place — for the timeline.

Many buildings in OpenStreetMap carry the year they were built (start_date, and a few older keys),
and a landmark nearly always does. This reads them for the square round every place on the globe
(docs/v2/architecture.json and museums.json, the same square build_grounds.py cuts) and writes, for
each place, the dated buildings' outlines to osm/dates/<slug>.json — OpenStreetMap data, © its
contributors, under the ODbL, and credited as such in each file. build_built_years.py reads them to
date what the city sources leave undated, before the satellites.

It downloads, for each place, the smallest of Geofabrik's regional extracts that holds it (one
download serves every place in the region), and cuts it with osmium-tool:

    osmium tags-filter (the date keys) -> osmium export (outlines) -> each to the squares it meets

Geofabrik's and Overpass's servers do not answer the Claude sessions' network, so this runs on
GitHub's (.github/workflows/osm-dates.yml); anywhere with osmium-tool and a route to
download.geofabrik.de, it runs as it is.

    python3 scripts/fetch_osm_dates.py [--only slug] [--keep]
"""

import argparse
import json
import math
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLACES = [ROOT / "docs" / "v2" / "architecture.json", ROOT / "docs" / "v2" / "museums.json"]
OUT = ROOT / "osm" / "dates"
INDEX = "https://download.geofabrik.de/index-v1.json"
AGENT = {"User-Agent": "Art-Database/1.0 (artist website; github.com/9gn957ptsb-alt/Art-Database)"}

# The same squares build_grounds.py cuts (its SIDE, metres a side by how exactly a point is known),
# and a margin, so a building across the edge comes whole.
SIDE = {"exact": 560, "street": 700, "district": 3600, "town": 2400, "region": 9000}
MARGIN = 60

# The keys a building's year is written under, most used first. Kept as written: the dating script
# reads them ("1890", "1890s", "C19", "~1890", "1885..1890", "late 19th century" ...).
DATE_KEYS = ["start_date", "building:start_date", "construction_date", "building:year",
             "year_built", "construction:year", "year_of_construction"]


def fetch(url, path=None, timeout=600):
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers=AGENT)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                if path is None:
                    return r.read()
                with open(path, "wb") as f:
                    shutil.copyfileobj(r, f, 1 << 20)
                return path
        except Exception as exc:  # network hiccup
            err = exc
            time.sleep(5 * 2 ** attempt)
    raise err


def square(p):
    side = SIDE.get(p.get("precision"), SIDE["town"]) + 2 * MARGIN
    dy = side / 2 / 111320
    dx = dy / max(0.2, math.cos(math.radians(p["lat"])))
    return [round(p["lon"] - dx, 6), round(p["lat"] - dy, 6), round(p["lon"] + dx, 6), round(p["lat"] + dy, 6)]


def regions(places):
    """Each place's smallest Geofabrik extract: {extract id: (pbf url, [places])}."""
    import shapely
    from shapely.geometry import shape
    index = json.loads(fetch(INDEX))
    feats = []
    for f in index["features"]:
        pbf = (f["properties"].get("urls") or {}).get("pbf")
        if pbf and f.get("geometry"):
            g = shape(f["geometry"])
            feats.append((g.area, f["properties"]["id"], pbf, g))
    feats.sort(key=lambda t: t[0])
    tree = shapely.STRtree([t[3] for t in feats])
    out = {}
    for p in places:
        pt = shapely.Point(p["lon"], p["lat"])
        hits = sorted(tree.query(pt, predicate="within"))       # tree order is smallest first
        if not hits:
            print(f"  ! {p['slug']}: in no Geofabrik extract", flush=True)
            continue
        _, fid, pbf, _ = feats[hits[0]]
        out.setdefault(fid, (pbf, []))[1].append(p)
    return out


def rings(geom):
    """The outer rings of a GeoJSON Polygon or MultiPolygon, rounded to a decimetre or so."""
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    return [[[round(x, 6), round(y, 6)] for x, y in poly[0]] for poly in polys if poly and len(poly[0]) >= 4]


def date_of(tags):
    for k in DATE_KEYS:
        v = (tags.get(k) or "").strip()
        if v:
            return k, v
    return None, None


def cut_region(src, group, fid, stamp, work):
    """Every place's dated buildings out of one region's extract, into osm/dates/.

    One pass keeps only what carries a date key (and the nodes and ways it is drawn with), which
    leaves a small file; that is exported once and each outline goes to every square it meets. (Cutting
    the squares out of the whole region with osmium extract held an ID table a square and ran the
    runner out of memory.)"""
    dated = work / "dated.osm.pbf"
    run("osmium", "tags-filter", "--no-progress", str(src), *[f"wr/{k}" for k in DATE_KEYS],
        "-o", str(dated), "--overwrite")
    seq = work / "dated.geojsonseq"
    run("osmium", "export", "--no-progress", str(dated), "-f", "geojsonseq", "--geometry-types=polygon",
        "-x", "print_record_separator=false", "-o", str(seq), "--overwrite")
    boxes = {p["slug"]: square(p) for p in group}
    found = {slug: [] for slug in boxes}
    with open(seq, encoding="utf-8") as lines:
        for line in lines:
            f = json.loads(line)
            tags = f.get("properties") or {}
            if tags.get("building", "no") == "no" and not tags.get("building:part"):
                continue
            key, value = date_of(tags)
            if not value:
                continue
            for r in rings(f["geometry"]):
                xs, ys = [c[0] for c in r], [c[1] for c in r]
                for slug, (w, s, e, n) in boxes.items():
                    if max(xs) >= w and min(xs) <= e and max(ys) >= s and min(ys) <= n:
                        found[slug].append([value, r])
    for slug, got in found.items():
        (OUT / (slug + ".json")).write_text(json.dumps({
            "source": "© OpenStreetMap contributors, ODbL 1.0 (openstreetmap.org/copyright); via Geofabrik",
            "extract": fid, "read": stamp, "keys": DATE_KEYS, "buildings": got,
        }, separators=(",", ":")))
        print(f"  + {slug}: {len(got)} dated outlines", flush=True)
    dated.unlink()
    seq.unlink()


def run(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--only")
    ap.add_argument("--keep", action="store_true", help="keep the downloaded extracts")
    args = ap.parse_args()
    places = []
    for f in PLACES:
        if f.exists():
            d = json.loads(f.read_text(encoding="utf-8"))
            places += [p for p in d.get("buildings", d.get("museums", [])) if isinstance(p.get("lat"), (int, float))]
    if args.only:
        places = [p for p in places if p["slug"] == args.only]
    OUT.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix="osm-"))
    stamp = time.strftime("%Y-%m-%d", time.gmtime())
    failed = []
    for fid, (pbf, group) in sorted(regions(places).items()):
        print(f"\n{fid}: {len(group)} place(s) — {pbf}", flush=True)
        src = work / "region.osm.pbf"
        try:
            t = time.time()
            fetch(pbf, src, timeout=3600)
            print(f"  downloaded {src.stat().st_size / 1e6:.0f} MB in {time.time() - t:.0f} s", flush=True)
            cut_region(src, group, fid, stamp, work)
        except Exception as exc:           # one region failing keeps none of the others back
            print(f"  ! {fid}: {type(exc).__name__}: {exc}", flush=True)
            failed.append(fid)
        if src.exists() and not args.keep:
            src.unlink()
    shutil.rmtree(work, ignore_errors=True)
    print(f"\nRead {len(list(OUT.glob('*.json')))} place(s); failed regions: {', '.join(failed) or 'none'}")


if __name__ == "__main__":
    sys.exit(main())
