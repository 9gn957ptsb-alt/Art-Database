#!/usr/bin/env python3
"""The heights Wikidata gives the landmarks of a city's square, for build_grounds.py.

Overture's buildings come from OpenStreetMap and from machine-read footprints, and most have no height
(93% of Brussels' 100,000), so a cell stands at two storeys; and where a height is there for a landmark it
is often a machine's or a podium's: the Willis Tower, 442 m, is 31 m (USGS lidar read its low roof), the
Tour du Midi, 150 m, is 19 m, Chicago's Trump Tower 60 m. Wikidata (CC0) gives the height of the buildings
and structures people have written about — the Palace of Justice 116 m, the Town Hall's belfry 96 m,
St Peter's, Milan Cathedral — as `P2048` (height, in any unit: its normalised value is in metres) and
`P1101` (floors above ground), each item with a point (`P625`).

An item counts only if one of its classes is an architectural structure (Wikidata's Q811979 and everything
under it, as build_built_years.py reads the landmarks' years by; a hotel or a company's headquarters that is
also an organisation is kept, since it is its building that has a height) and its height lies between 8 m
and 830 m; a deprecated statement is not read, and where an item has a preferred height that is the one.
An item with only a number of floors (P1101) counts if it is a skyscraper or a high-rise building. build_grounds.py lets the cells of the building a landmark's point stands in, within
a few metres of that point, rise to its height where the building's own is missing or a good deal lower (a
spire, a tower and a dome stand at a building's middle; its nave does not).

Answers are cached in data/wikidata_heights/<slug>.json, never committed.

    python3 scripts/wikidata_heights.py city-brussels-be      # the landmarks of a place in cityplaces.json
"""

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

CACHE = ROOT / "data" / "wikidata_heights"
FLOOR = 3.2                      # metres a storey, as build_grounds.py counts them
LEAST, MOST = 8.0, 830.0         # metres: a landmark's height between a house's and the Burj Khalifa's
TOWERS = {"Q11303", "Q18142"}    # skyscraper, high-rise building: only these are read by their floors alone


def number(binding, name, kind=float):
    """A binding's number, or None: "unknown value" comes back as a blank node's address, not a number."""
    try:
        return kind(float(binding[name]["value"])) if name in binding else None
    except ValueError:
        return None


def fetch(slug, box):
    """The rows Wikidata gives for the box (south, west, north, east): [qid, class, height or None, its
    rank (2 preferred, 1 normal), floors or None, lat, lon], cached for the place."""
    path = CACHE / (slug + ".json")
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    import build_built_years as BBY          # its SPARQL helper and the class trees it keeps
    s, w, n, e = box
    # Large squares in four, so no answer is cut at the service's cap.
    parts = [(s, w, n, e)] if (n - s) < 0.04 else [(a, b, a + (n - s) / 2, b + (e - w) / 2)
                                                    for a in (s, (s + n) / 2) for b in (w, (w + e) / 2)]
    rows = []
    for ps, pw, pn, pe in parts:
        q = """SELECT ?item ?cls ?h ?rk ?fl ?lat ?lon WHERE {
  SERVICE wikibase:box { ?item wdt:P625 ?loc .
    bd:serviceParam wikibase:cornerSouthWest "Point(%f %f)"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(%f %f)"^^geo:wktLiteral . }
  ?item wdt:P31 ?cls .
  { ?item p:P2048 ?st . ?st psn:P2048/wikibase:quantityAmount ?h ; wikibase:rank ?rk .
    FILTER(?rk != wikibase:DeprecatedRank) }
  UNION { ?item wdt:P1101 ?fl }
  BIND(geof:latitude(?loc) AS ?lat) BIND(geof:longitude(?loc) AS ?lon)
}""" % (pw, ps, pe, pn)
        for b in BBY._sparql(q).get("results", {}).get("bindings", []):
            rows.append([b["item"]["value"].rsplit("/", 1)[-1], b["cls"]["value"].rsplit("/", 1)[-1],
                         number(b, "h"),
                         2 if "rk" in b and b["rk"]["value"].endswith("PreferredRank") else 1,
                         number(b, "fl", int),
                         float(b["lat"]["value"]), float(b["lon"]["value"])])
        time.sleep(2)
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rows), encoding="utf-8")
    return rows


def landmarks(slug, box):
    """[(lat, lon, metres)] — one per building or structure with a height in the box."""
    rows = fetch(slug, box)
    import build_built_years as BBY
    built = BBY._tree("Q811979")
    by = {}
    for qid, cls, h, rank, fl, lat, lon in rows:
        d = by.setdefault(qid, {"cls": set(), "h": {}, "fl": 0, "ll": (lat, lon)})
        d["cls"].add(cls)
        if h:
            d["h"][rank] = max(d["h"].get(rank, 0.0), h)
        d["fl"] = max(d["fl"], fl or 0)
    out = []
    for d in by.values():
        if not d["cls"] & built or "Q19860854" in d["cls"]:      # Q19860854: destroyed building or structure
            continue
        if d["h"]:
            h = d["h"][max(d["h"])]                    # the preferred height, else the highest
        elif d["cls"] & TOWERS:
            h = d["fl"] * FLOOR                        # a skyscraper's floors (a hotel's "120" is its rooms)
        else:
            continue
        if LEAST <= h <= MOST:
            out.append((d["ll"][0], d["ll"][1], h))
    return out


if __name__ == "__main__":
    import build_grounds as BG
    places = {p["slug"]: p for p in json.loads(BG.CITYPLACES.read_text(encoding="utf-8"))["places"]}
    p = places[sys.argv[1]]
    w, s, e, n = BG.square(p)
    got = landmarks(p["slug"], (s, w, n, e))
    print(f"{p['name']}: {len(got)} landmarks with a height")
    for lat, lon, h in sorted(got, key=lambda g: -g[2])[:20]:
        print(f"  {h:6.0f} m at {lat:.4f},{lon:.4f}")
