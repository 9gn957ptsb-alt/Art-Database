#!/usr/bin/env python3
"""The places of the notable lives, as grounds can be read for them.

"The place, then" (CLAUDE.md): when a life's place is entered, the view is
that neighbourhood in that year, a clod of its ground in DIRT with its
buildings standing as far as their years are known. This lists the squares
those clods are cut from, for build_grounds.py and build_built_years.py,
and which period of which life stands on which.

Public files only (docs/v2/lives.json, docs/v2/lives/<id>.json), no network,
the same bytes every run. Writes docs/v2/lifeplaces.json:

    {note, places: [{slug, name, lat, lon, precision, studio?, why}],
     periods: {"<life>:<k>": [town slug, studio slug or null]}}

Every period with a point gets its town's square (precision "town": the
town's own point, SIDE 2400 m), shared by every life that passes through
it; a studio the studios placed exactly (a museum, a house museum, a listed
building — never a private home, which the studios only ever place at its
town) gets its own square round its door (precision exact or street).

    python3 scripts/build_life_places.py
"""

import json
import math
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIVES = ROOT / "docs" / "v2" / "lives.json"
FILES = ROOT / "docs" / "v2" / "lives"
OUT = ROOT / "docs" / "v2" / "lifeplaces.json"
MERGE_KM = 30          # one town under one name: its points within this go together
# Not towns: a country, a zone, an item with no name. No square is cut for them.
NOT_TOWNS = {"Great Britain", "Panama Canal Zone", "United States", "France", "Italy", "Spain", "England"}


def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "place"


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def main():
    rows = json.loads(LIVES.read_text(encoding="utf-8"))["lives"]
    notable = [r[0] for r in rows if r[9]]
    towns = {}            # slug -> place
    studios = {}
    periods = {}
    uses = {}             # slug -> {(lat, lon): count}

    def town_slug(name, ll):
        base = "life-" + slugify(name)
        k = 1
        while True:
            s = base if k == 1 else f"{base}-{k}"
            t = towns.get(s)
            if t is None or km((t["lat"], t["lon"]), ll) <= MERGE_KM:
                return s
            k += 1

    for lid in notable:
        L = json.loads((FILES / f"{lid}.json").read_text(encoding="utf-8"))
        for k, p in enumerate(L["periods"]):
            ll = p.get("ll")
            if not ll or p["place"] in NOT_TOWNS or re.fullmatch(r"Q\d+", p["place"] or ""):
                continue
            s = town_slug(p["place"], ll)
            uses.setdefault(s, {})
            pt = (round(ll[0], 5), round(ll[1], 5))
            uses[s][pt] = uses[s].get(pt, 0) + 1
            if s not in towns:
                towns[s] = {"slug": s, "name": p["place"], "lat": pt[0], "lon": pt[1], "precision": "town",
                            "why": "the town's point: a life places the artist in the town"}
            st = None
            for a in p.get("at") or []:
                if a.get("pr") in ("exact", "street") and a.get("ll"):
                    ss = "life-studio-" + slugify(a["name"])
                    if ss not in studios:
                        studios[ss] = {"slug": ss, "name": a["name"], "lat": round(a["ll"][0], 6),
                                       "lon": round(a["ll"][1], 6), "precision": a["pr"], "studio": True,
                                       "why": "the studios place it exactly (" + (a.get("kind") or "studio") + ")"}
                    st = ss
                    break
            periods[f"{lid}:{k}"] = [s, st]

    # A town shared by several lives stands on the point most of them give.
    for s, pts in uses.items():
        best = sorted(pts.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
        towns[s]["lat"], towns[s]["lon"] = best

    places = sorted(towns.values(), key=lambda p: p["slug"]) + sorted(studios.values(), key=lambda p: p["slug"])
    out = {
        "note": "The squares of the notable lives' places (scripts/build_life_places.py); each ground is "
                "grounds/<slug>.json, read by build_grounds.py and dated by build_built_years.py.",
        "places": places,
        "periods": dict(sorted(periods.items())),
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(towns)} towns, {len(studios)} studios, {len(periods)} periods")


if __name__ == "__main__":
    main()
