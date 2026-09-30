#!/usr/bin/env python3
"""The cities of the Museums layer: every town a saved work has been in, and the museums in it.

The artist, 29 Sep 2026: the museum names on the globe were "way too cluttered", and the artworks
belong within the museums — "have the cities displayed on the globe and then when you click on the
city that is when it shows you the museums in that city", then, quieter, the galleries, fairs and
sale rooms where saved works have been. So the globe carries cities, and a city holds its museums
and its venues.

Reads only public files, all in docs/v2/:
  museums.json         the museums that hold saved works, each at its own point
  places.json          every place a work has been (build_artwork_histories.py)
  places/<p>.json      one place's venues and works; a site museum's venue carries its slug in m
  histories/<id>.json  each work's events, for the points of the venues

and writes docs/v2/cities.json:

  {"note": ..., "towns": [[key, name, cc, lat, lon, n, museums, others, pass, file, near], ...],
   "venues": {key: [[vi, lat, lon], ...], ...}}

  key      the places.json key (and places/<key>.json when file is 1); a museum in no place and
           near none of its country becomes a town of its own, keyed slug(town) + "-" + cc
  n        works that have been there (a town of its own: the works its museum holds)
  museums  the site museums in it, most held first
  others   its venues that are not site museums, the unnamed one ("") included
  pass     1 when it is one museum and nothing else: pressing it goes straight into the museum
  near     the 8 nearest other towns within 500 km, as [row, km]
  venues   the points of a town's venues, vi being the venue's index in places/<key>.json: a site
           museum's own point, else the middle of the points its events give at venue precision (or
           at the listing partner's office, for a listing that names no other venue); a venue with
           none, with one more than 40 km from its town, or with one that is only the town's own point
           (where the sources place the town itself), has no point

The rows are in the order the globe names them — the towns with museums by rank, then the rest by
the works that have been there — so the page never sorts. A museum's town is the one place whose
venues carry its slug; towns are joined only by name (build_artwork_histories.py's CITY_NAMES),
never by distance: Neuss is not Düsseldorf, nor Cambridge Boston. The places close to a larger one
are printed for the artist to choose from. Nothing here reads data/.

    python3 scripts/build_cities.py

Also run at the end of build_museums.py and of a full build_artwork_histories.py.
"""

import json
import math
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_artwork_histories import alike, km, norm, slug  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "docs" / "v2"
OUT = SITE / "cities.json"
NOTE = ("Written by scripts/build_cities.py from museums.json, places.json, places/ and histories/"
        " — public files only.")

NEAR_KM, NEAR_MAX = 500, 8      # "Near here": the nearest towns, within a day's drive
STRAY_KM = 25                   # a museum no history places joins a town of its country this close
VENUE_KM = 40                   # a venue's point further than this from its town is some other place
TOWN_M = 50                     # a venue's point this close to where the town itself was looked up is not its own
MERGE_KM = 10                   # places this close to a larger one are printed as candidates
# A town whose name the geocoder gave wrongly, named from its museum's own name: the Anderson
# Collection at Stanford University was placed in "California".
RENAME = {"california-us": "Stanford"}


def load():
    museums = json.loads((SITE / "museums.json").read_text())["museums"]
    places = json.loads((SITE / "places.json").read_text())["places"]
    files = {}
    for f in sorted((SITE / "places").glob("*.json")):
        d = json.loads(f.read_text())
        files[d["p"]] = d
    histories = [json.loads(f.read_text()) for f in sorted((SITE / "histories").glob("*.json"))]
    return museums, places, files, histories


def home(museums, files):
    """Each museum's town: the one place whose venues carry its slug."""
    at = {}
    for key, d in files.items():
        for v in d["venues"]:
            if v[1]:
                at.setdefault(v[1], set()).add(key)
    twice = {s: sorted(k) for s, k in at.items() if len(k) > 1}
    if twice:
        sys.exit("A museum in two places: " + "; ".join(f"{s} in {', '.join(k)}" for s, k in twice.items()))
    known = {m["slug"] for m in museums}
    lost = sorted(s for s in at if s not in known)
    if lost:
        print("Venues carry museums that museums.json no longer has (rebuild the histories):", ", ".join(lost))
    return {s: next(iter(k)) for s, k in at.items() if s in known}


def town_of(m):
    """A museum's town and country, as its where writes them ("Paris, FR")."""
    town, _, cc = (m.get("where") or "").rpartition(",")
    return town.strip(), cc.strip()


def strays(museums, places, files, homes):
    """A museum no history places: into the nearest place of its country within STRAY_KM, else a
    town of its own at the museum's point. Returns the towns made."""
    made = []
    keys = {p[0] for p in places}
    for m in museums:
        if m["slug"] in homes:
            continue
        town, cc = town_of(m)
        pt = (m["lat"], m["lon"])
        near = [p for p in places if p[2] == cc and km(pt, p[3:5]) <= STRAY_KM]
        if near:
            p = min(near, key=lambda p: km(pt, p[3:5]))
            homes[m["slug"]] = p[0]
            print(f"  {m['name']}: no history places it; joins {p[1]}, {p[2]} ({km(pt, p[3:5]):.1f} km)")
            same = [v[0] for v in files.get(p[0], {}).get("venues", [])
                    if not v[1] and v[0] and alike(v[0], m["name"])]
            if same:
                print(f"    {p[1]} also has a venue of that name, not matched to it: {'; '.join(same)}"
                      " — the next histories build can match it")
            continue
        key = slug(f"{town}, {cc}")
        if not town or key in keys:
            sys.exit(f"No town for {m['name']} ({m.get('where')!r}), or {key} is taken")
        keys.add(key)
        homes[m["slug"]] = key
        made.append([key, town, cc, round(m["lat"], 4), round(m["lon"], 4), m["held"]])
        print(f"  {m['name']}: no history places it and nothing of {cc} within {STRAY_KM} km; a town of its own, {key}")
    return made


def venue_points(files, histories, by_slug):
    """{key: [[vi, lat, lon], ...]}: where each venue of a place is, as far as the sources say.

    The venue is decided as write_places decides it (the event's venue, or its holder for a holding,
    listing, offer or sale, or a site museum), without its rule joining an owner to a venue."""
    pts, towns = {}, {}
    for h in histories:
        for e in h["events"]:
            p, ll = e.get("p"), e.get("ll")
            if not p or not ll or e["k"] == "written":
                continue
            if e.get("pr") == "city":
                towns.setdefault(p, set()).add(tuple(ll))
            if not (e.get("pr") == "venue" or (e.get("pr") == "office" and not e.get("v"))):
                continue
            v = e.get("v") or (e.get("who") if e["k"] in ("held", "listed", "offered", "sold") or e.get("m") else "") or ""
            key = e.get("m") or norm(v)
            if key:
                pts.setdefault(p, {}).setdefault(key, []).append(ll)
    out = {}
    for key, d in files.items():
        mine = pts.get(key, {})
        rows = []
        for vi, v in enumerate(d["venues"]):
            if v[1] and v[1] in by_slug:
                ll = (by_slug[v[1]]["lat"], by_slug[v[1]]["lon"])
            elif not v[1] and v[0] and mine.get(norm(v[0])):
                got = mine[norm(v[0])]
                ll = (statistics.median(x[0] for x in got), statistics.median(x[1] for x in got))
            else:
                continue
            if km(ll, d["ll"]) > VENUE_KM:
                continue
            # A source's point for a gallery that is the town's own point (the Royal Academy on
            # Trafalgar Square, where London is) is where the town was looked up, not the gallery.
            if not v[1] and any(km(ll, t) < TOWN_M / 1000 for t in towns.get(key, ())):
                continue
            rows.append([vi, round(ll[0], 4), round(ll[1], 4)])
        if rows:
            out[key] = rows
    return out


def rank(t):
    """How strongly a town asks to be named: its museums first, then how much has been there."""
    return (1 + 0.5 * len(t[6]) if t[6] else 0) + 0.5 * math.log10(1 + t[5])


def main():
    if not (SITE / "places.json").exists():
        print("No docs/v2/places.json yet: run scripts/build_artwork_histories.py first.")
        return
    museums, places, files, histories = load()
    by_slug = {m["slug"]: m for m in museums}
    homes = home(museums, files)
    made = strays(museums, places, files, homes)

    inside = {}
    for s, key in homes.items():
        inside.setdefault(key, []).append(s)
    towns = []
    for p in [list(p) for p in places] + made:
        key = p[0]
        ms = sorted(inside.get(key, []), key=lambda s: (-by_slug[s]["held"], by_slug[s]["name"]))
        d = files.get(key)
        others = sum(1 for v in d["venues"] if not v[1]) if d else 0
        towns.append([key, RENAME.get(key, p[1]), p[2], round(p[3], 4), round(p[4], 4), p[5], ms, others,
                      1 if len(ms) == 1 and others == 0 else 0, 1 if d else 0, []])
    towns.sort(key=lambda t: (0, -rank(t), t[1]) if t[6] else (1, -t[5], t[1]))
    for i, t in enumerate(towns):
        near = sorted((km(t[3:5], o[3:5]), j) for j, o in enumerate(towns) if j != i)
        t[10] = [[j, max(1, round(d))] for d, j in near if d <= NEAR_KM][:NEAR_MAX]

    venues = venue_points(files, histories, by_slug)
    OUT.write_text(json.dumps({"note": NOTE, "towns": towns, "venues": venues},
                              ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    close = []
    for t in towns:
        bigger = sorted((o for o in towns if o[5] > t[5] and o[2] == t[2] and km(t[3:5], o[3:5]) <= MERGE_KM),
                        key=lambda o: -o[5])
        if bigger:
            close.append((t, bigger))
    if close:
        print(f"Places within {MERGE_KM} km of a larger one — joined only by name (CITY_NAMES), if the artist wants:")
        for t, bigger in sorted(close, key=lambda x: (-x[1][0][5], -x[0][5])):
            print(f"    {t[1]} ({t[5]}): " + ", ".join(f"{o[1]} ({o[5]}) {km(t[3:5], o[3:5]):.1f} km" for o in bigger))
    twins = [(a, b) for i, a in enumerate(towns) for b in towns[i + 1:]
             if norm(a[1]) == norm(b[1]) and a[2] != b[2] and km(a[3:5], b[3:5]) < 50]
    for a, b in twins:
        print(f"One town under two countries: {a[1]}, {a[2]} and {b[1]}, {b[2]}")
    named = sum(len(v) for v in venues.values())
    print(f"{OUT.relative_to(ROOT)}  {OUT.stat().st_size / 1024:.0f} KB  {len(towns)} towns, "
          f"{sum(1 for t in towns if t[6])} with museums ({sum(len(t[6]) for t in towns)} museums), "
          f"{sum(t[8] for t in towns)} one museum and nothing else; {named} venues placed in {len(venues)} towns")


if __name__ == "__main__":
    main()
