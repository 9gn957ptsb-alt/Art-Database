#!/usr/bin/env python3
"""OpenStreetMap's indoor mapping of the major museums — rooms, corridors, doors, levels — for the walk.

Where mappers have drawn a museum's inside (indoor=room|area|corridor|level|wall, door=*, entrance=*,
room=*, with level, ref and name), it is a source for docs/v2/interiors/<slug>.json: which rooms there
are, their numbers, which connect (a door on the line between two rooms), and the entrances. This reads
it for the square round each major museum and writes osm/indoor/<slug>.json — OpenStreetMap data, © its
contributors, under the ODbL, credited in each file. scripts/build_interiors.py reads them (--osm):
reconstructed unless they match a documented plan (INTERIORS.md, "The sources").

It downloads, for each museum, the smallest Geofabrik extract that holds it (one download serves every
museum in the region) and cuts it with osmium-tool, as fetch_osm_dates.py does:

    osmium tags-filter (the indoor keys) -> osmium export (points, lines, outlines) -> each to its square

Geofabrik's and Overpass's servers do not answer the Claude sessions' network, so this runs on GitHub's
(.github/workflows/osm-indoor.yml, on a push touching this script, the workflow or osm/INDOOR_REQUEST);
anywhere with osmium-tool and a route to download.geofabrik.de, it runs as it is.

    python3 scripts/fetch_osm_indoor.py [--only slug] [--keep]
"""

import argparse
import json
import shutil
import sys
import tempfile
import time
from pathlib import Path

import fetch_osm_dates as od

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "osm" / "indoor"
# The major museums, both interior passes' (the ones whose own data says where works hang, and the
# other majors): their slugs in docs/v2/museums.json. A slug not there is skipped.
MAJORS = [
    "museum-the-metropolitan-museum-of-art", "museum-the-museum-of-modern-art", "museum-guggenheim-museum",
    "museum-whitney-museum-of-american-art-1", "museum-national-gallery-of-art-washington-dc",
    "museum-art-institute-of-chicago", "museum-cleveland-museum-of-art", "museum-los-angeles-county-museum-of-art",
    "museum-san-francisco-museum-of-modern-art-sfmoma", "museum-j-paul-getty-museum", "museum-hammer-museum",
    "museum-the-broad", "museum-de-young-museum", "museum-philadelphia-museum-of-art",
    "museum-museum-of-fine-arts-boston", "museum-isabella-stewart-gardner-museum", "museum-the-menil-collection",
    "museum-musee-du-louvre", "museum-musee-dorsay", "museum-centre-pompidou", "museum-musee-picasso-paris",
    "museum-musee-rodin", "museum-fondation-louis-vuitton", "museum-the-national-gallery-london",
    "museum-british-museum", "museum-tate-britain", "museum-victoria-and-albert-museum-v-and-a",
    "museum-national-portrait-gallery", "museum-museo-nacional-del-prado", "museum-museo-reina-sofia",
    "museum-museo-thyssen-bornemisza", "museum-rijksmuseum", "museum-stedelijk-museum-amsterdam",
    "museum-van-gogh-museum", "museum-kroller-muller-museum", "museum-guggenheim-museum-bilbao",
    "museum-alte-nationalgalerie", "museum-gemaldegalerie-alte-meister", "museum-museum-brandhorst",
    "museum-belvedere-museum", "museum-kunstmuseum-basel", "museum-statens-museum-for-kunst",
    "museum-louisiana-museum-of-modern-art", "museum-pushkin-museum-of-fine-arts",
    "museum-national-gallery-of-victoria",
]
# A museum's square: 700 m a side round its point (its own building, its wings and its neighbours).
SIDE = 700
FILTERS = ["nwr/indoor", "nwr/door", "nwr/entrance", "nwr/room", "nwr/highway=elevator", "nwr/stairs",
           "w/highway=steps", "nwr/repeat_on"]
KEEP = ["indoor", "door", "entrance", "room", "level", "level:ref", "repeat_on", "ref", "name", "name:en",
        "highway", "stairs", "access", "wheelchair", "width", "height", "min_level", "max_level", "building:part"]


def square(p):
    q = dict(p, precision="exact")
    od.SIDE["exact"] = SIDE - 2 * od.MARGIN
    return od.square(q)


def cut_region(src, group, fid, stamp, work):
    kept = work / "indoor.osm.pbf"
    od.run("osmium", "tags-filter", "--no-progress", str(src), *FILTERS, "-o", str(kept), "--overwrite")
    seq = work / "indoor.geojsonseq"
    od.run("osmium", "export", "--no-progress", str(kept), "-f", "geojsonseq", "-x", "print_record_separator=false",
           "--add-unique-id=type_id", "-o", str(seq), "--overwrite")
    boxes = {p["slug"]: square(p) for p in group}
    found = {slug: [] for slug in boxes}
    with open(seq, encoding="utf-8") as lines:
        for line in lines:
            f = json.loads(line)
            g = f.get("geometry") or {}
            tags = f.get("properties") or {}
            if not g:
                continue
            # a closed way that is an area is exported twice, as its line and its outline: the outline only
            if g["type"] == "LineString" and g["coordinates"][0] == g["coordinates"][-1] and \
                    tags.get("indoor") in ("room", "area", "corridor", "level"):
                continue
            pts = (g["coordinates"] if g["type"] == "Point" else
                   g["coordinates"] if g["type"] == "LineString" else
                   g["coordinates"][0] if g["type"] == "Polygon" else
                   [c for poly in g["coordinates"] for c in poly[0]] if g["type"] == "MultiPolygon" else [])
            if g["type"] == "Point":
                pts = [pts]
            if not pts:
                continue
            xs, ys = [c[0] for c in pts], [c[1] for c in pts]
            for slug, (w, s, e, n) in boxes.items():
                if max(xs) >= w and min(xs) <= e and max(ys) >= s and min(ys) <= n:
                    found[slug].append({"id": f.get("id"), "tags": {k: tags[k] for k in KEEP if k in tags},
                                        "geometry": round_geom(g)})
    for slug, got in found.items():
        (OUT / (slug + ".json")).write_text(json.dumps({
            "source": "© OpenStreetMap contributors, ODbL 1.0 (openstreetmap.org/copyright); via Geofabrik",
            "extract": fid, "read": stamp, "filters": FILTERS, "features": got,
        }, separators=(",", ":"), ensure_ascii=False))
        rooms = sum(1 for x in got if x["tags"].get("indoor") in ("room", "area", "corridor"))
        doors = sum(1 for x in got if x["tags"].get("door") or x["tags"].get("entrance"))
        print(f"  + {slug}: {len(got)} features ({rooms} rooms or areas, {doors} doors or entrances)", flush=True)
    kept.unlink()
    seq.unlink()


def round_geom(g):
    def r(c):
        return [round(c[0], 7), round(c[1], 7)]
    t = g["type"]
    if t == "Point":
        return {"type": t, "coordinates": r(g["coordinates"])}
    if t == "LineString":
        return {"type": t, "coordinates": [r(c) for c in g["coordinates"]]}
    if t == "Polygon":
        return {"type": t, "coordinates": [[r(c) for c in ring] for ring in g["coordinates"]]}
    if t == "MultiPolygon":
        return {"type": t, "coordinates": [[[r(c) for c in ring] for ring in poly] for poly in g["coordinates"]]}
    return g


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--only")
    ap.add_argument("--keep", action="store_true", help="keep the downloaded extracts")
    args = ap.parse_args()
    museums = json.loads((ROOT / "docs" / "v2" / "museums.json").read_text(encoding="utf-8"))["museums"]
    places = [m for m in museums if m["slug"] in MAJORS and isinstance(m.get("lat"), (int, float))]
    if args.only:
        places = [p for p in places if p["slug"] == args.only]
    OUT.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix="osm-indoor-"))
    stamp = time.strftime("%Y-%m-%d", time.gmtime())
    failed = []
    for fid, (pbf, group) in sorted(od.regions(places).items()):
        print(f"\n{fid}: {len(group)} museum(s) — {pbf}", flush=True)
        src = work / "region.osm.pbf"
        try:
            t = time.time()
            od.fetch(pbf, src, timeout=3600)
            print(f"  downloaded {src.stat().st_size / 1e6:.0f} MB in {time.time() - t:.0f} s", flush=True)
            cut_region(src, group, fid, stamp, work)
        except Exception as exc:           # one region failing keeps none of the others back
            print(f"  ! {fid}: {type(exc).__name__}: {exc}", flush=True)
            failed.append(fid)
        if src.exists() and not args.keep:
            src.unlink()
    shutil.rmtree(work, ignore_errors=True)
    print(f"\nRead {len(list(OUT.glob('*.json')))} museum(s); failed regions: {', '.join(failed) or 'none'}")


if __name__ == "__main__":
    sys.exit(main())
