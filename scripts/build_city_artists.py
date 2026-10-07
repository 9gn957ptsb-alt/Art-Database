#!/usr/bin/env python3
"""The artists who walk each city's skyline, and the years they walk it.

The artist, 7 Oct 2026, pressing New York on the Artists layer: "I want the
isometric of the urban skyline to come up and for me to be able to select
artists from that area walking around or art buildings housing art". On a
city's skyline (skyline.js) the artists of the place walk its streets, a few
at a time, each only in the years the record puts them there:

  * born there — from the year of birth until the life's first period in
    another city (lives/<id>.json; a life whose record names nowhere else
    walks until its death, or to now);
  * a life's periods in the city (lives/<id>.json, by evidence or carried,
    as the life says it);
  * every presence movements.json's `here` gives for the city (a dated place
    of the studios, a year a life places them, a school or an employer) —
    with the studio's point where the studios place one, a door they walk
    into.

Each artist's inks are the measured colours of their saved works (the
histories' `c`, the first works that have them), so a figure is drawn in its
artist's own colours. For the cities in cityplaces.json only. Public files
only, no network, the same bytes every run. Writes docs/v2/cityartists.json:

    {note, towns: {key: [[life id, name, born, died, saved, [[y0, y1, how], ...],
                          [ink, ink, ink], [lat, lon, place] or null], ...]}}

`how` is "born", "lived" (a life's period) or the movements' word (life,
studio, school, employer). Most saved first.

    python3 scripts/build_city_artists.py
"""

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
V2 = ROOT / "docs" / "v2"
NOW = 2026


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def inks(L):
    """Three colours of the artist's saved works, dark to light."""
    seen = []
    for w in L.get("works") or []:
        p = V2 / "histories" / f"{w[0]}.json"
        if not p.exists():
            continue
        for c in json.loads(p.read_text(encoding="utf-8")).get("c") or []:
            if c not in seen:
                seen.append(c)
        if len(seen) >= 6:
            break
    if not seen:
        return []

    def light(c):
        r, g, b = (int(c[k:k + 2], 16) for k in (1, 3, 5))
        return 0.299 * r + 0.587 * g + 0.114 * b
    seen.sort(key=light)
    if len(seen) <= 3:
        return seen
    return [seen[0], seen[len(seen) // 2], seen[-1]]


def main():
    places = json.loads((V2 / "cityplaces.json").read_text(encoding="utf-8"))["places"]
    lives = json.loads((V2 / "lives.json").read_text(encoding="utf-8"))["lives"]
    saved = {r[0]: r[5] for r in lives}
    mv = json.loads((V2 / "movements.json").read_text(encoding="utf-8"))
    mv_artists = mv["artists"]
    cache = {}

    def life(lid):
        if lid not in cache:
            p = V2 / "lives" / f"{lid}.json"
            cache[lid] = json.loads(p.read_text(encoding="utf-8")) if p.exists() else None
        return cache[lid]

    town_pt = {r[0]: (r[3], r[4]) for r in json.loads((V2 / "cities.json").read_text(encoding="utf-8"))["towns"]}
    towns = {}
    for pl in places:
        key = pl["key"]
        half = pl["side"] / 2
        spans = {}            # life id -> [[y0, y1, how]]
        doors = {}

        def add(lid, y0, y1, how):
            if y0 and y1 and y1 >= y0:
                spans.setdefault(lid, []).append([int(y0), int(y1), how])

        for r in lives:
            L = life(r[0])
            if not L:
                continue
            ps = L["periods"]
            for k, p in enumerate(ps):
                if p.get("key") != key:
                    continue
                if "born" in (p.get("how") or []) and k == 0:
                    leave = next((q["y0"] - 1 for q in ps[1:] if q.get("key") != key and q["y0"] > p["y0"]), None)
                    end = leave if leave is not None else (L.get("died") or NOW)
                    add(r[0], p["y0"], max(p["y1"], end), "born")
                elif p.get("how") != ["died"]:
                    add(r[0], p["y0"], p["y1"], "lived")
        for row in mv["here"].get(key, []):
            a = mv_artists[row[0]]
            add(a[0], row[1], row[2], row[3])
            # A studio placed at its own point, inside the square and not the town's middle: a door.
            if row[3] == "studio" and row[4] is not None:
                dy = (row[4] - pl["lat"]) * 111320
                dx = (row[5] - pl["lon"]) * 111320 * math.cos(math.radians(pl["lat"]))
                if abs(dx) < half and abs(dy) < half and km((row[4], row[5]), town_pt.get(key, (pl["lat"], pl["lon"]))) > 0.3 \
                        and row[7] in ("studio", "house"):
                    doors.setdefault(a[0], [round(row[4], 5), round(row[5], 5), row[6]])
        out = []
        for lid, ss in spans.items():
            L = life(lid)
            if not L:
                continue
            ss.sort()
            # Spans that touch or overlap are one stay, said by its first word ("born" wins).
            merged = []
            for s in ss:
                if merged and s[0] <= merged[-1][1] + 1:
                    merged[-1][1] = max(merged[-1][1], s[1])
                    if s[2] == "born":
                        merged[-1][2] = "born"
                else:
                    merged.append(list(s))
            out.append([lid, L["name"], L.get("born"), L.get("died"), saved.get(lid, 0), merged,
                        inks(L), doors.get(lid)])
        out.sort(key=lambda r: (-r[4], r[0]))
        towns[key] = out
        print(f"  {key}: {len(out)} artists, {sum(1 for r in out if r[7])} with a studio door")
    note = ("The artists who walk each city's skyline (scripts/build_city_artists.py): born there until "
            "their life names another city, a life's periods there, and movements.json's presences; inks "
            "are their saved works' measured colours.")
    (V2 / "cityartists.json").write_text(json.dumps({"note": note, "towns": towns}, ensure_ascii=False,
                                                    separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
