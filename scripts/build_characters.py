#!/usr/bin/env python3
"""The characters: who comes out of the wave in a city, and the plants that come with them.

The artist, 1 Oct 2026: the wave of pixel light that answers a touch in a
city is where "character generation" ties into the website "through DIRT
along with corresponding plants and artists … start with one character",
with a daily update of characters under the same rules as the buildings'.

This writes, from public files only (no network, never data/):

  docs/v2/characters/<id>.json  each character in docs/v2/characters/characters.json
                                that has a drawing in scripts/characters/<id>.py:
                                its poses, one letter a cell (see draw.py)
  docs/v2/characters/plants.json  for every place the page can be down in (the
                                collages' cities and the Museums layer's cities)
                                and every artist's birthplace: DIRT Earth's biome,
                                realm, ecoregion and soil there, and that biome's
                                plants for that realm, stratum by stratum, with
                                their crowns' shapes
  docs/v2/characters/artists.json  each artist's map (the cast's and the backlog's,
                                so a new character works the day it is drawn):
                                every city on the site where the artist's saved
                                works are held now or have been, in the order of a
                                route from home, with the works and the museums
                                holding them; and the artist's home (homes.json,
                                from Wikidata) with the plants of home

The artist, 1 Oct 2026: "Establish a correspondence between the Artist
associated with animals and plants and where their artwork is located
throughout the world … implement both a local aspect of where the museum is
in addition to the transcendental aspect of non-native artist and their
plants and animals to that area. When an animal comes up that is associated
with an artist, I want you to be able to use that animal as an additional
way to navigate through the globe."

The plants come from DIRT's grammar of places (dirt/earth/out/grammar.json,
dirt/earth/GRAMMAR.md); the place from DIRT Earth's atlas (dirt/earth/out/,
read as dirt/earth/where.py reads it). A city on the water (San Francisco's
point is in the bay) takes the nearest land cell.

    python3 scripts/build_characters.py

Same bytes every run.
"""

import importlib
import json
import math
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "characters"))

OUT = ROOT / "docs" / "v2" / "characters"
EARTH = ROOT / "dirt" / "earth" / "out"
NEAR_LAND = 12                 # cells (a quarter degree each) to look for land


def dump(path, obj):
    text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    path.write_text(text + "\n", encoding="utf-8")
    return len(text)


class Atlas:
    def __init__(self):
        self.meta = json.loads((EARTH / "atlas.json").read_text())
        self.place = np.asarray(Image.open(EARTH / "place.png").convert("RGB")).astype(int)
        self.ground = np.asarray(Image.open(EARTH / "ground.png").convert("RGB")).astype(int)

    def cell(self, lat, lon):
        j = min(719, max(0, int((90 - lat) / 0.25)))
        i = int(((lon + 180) % 360) / 0.25) % 1440
        return i, j

    def land_near(self, lat, lon):
        """The cell at the point, or the nearest land cell to it."""
        i0, j0 = self.cell(lat, lon)
        best = None
        for r in range(NEAR_LAND + 1):
            for dj in range(-r, r + 1):
                for di in range(-r, r + 1):
                    if max(abs(di), abs(dj)) != r:
                        continue
                    i, j = (i0 + di) % 1440, j0 + dj
                    if not 0 <= j < 720:
                        continue
                    pl = self.place[j, i]
                    if pl[2] >= 254 or not (pl[0] or pl[1]):
                        continue
                    d = di * di + dj * dj
                    if best is None or d < best[0] or (d == best[0] and (j, i) < best[1:]):
                        best = (d, j, i)
            if best is not None:
                return best[2], best[1]
        return None

    def at(self, lat, lon):
        got = self.land_near(lat, lon)
        if not got:
            return None
        i, j = got
        pl = self.place[j, i]
        eco = self.meta["ecoregions"][pl[0] + 256 * pl[1]]
        soil = self.meta["soils"][self.ground[j, i][0]]
        return {
            "biome": int(pl[2]),
            "realm": self.meta["realms"][eco["realm"]],
            "ecoregion": eco["name"],
            "soil": (soil["name"], soil["colour"]),
        }


def places():
    """Every place the page can be down in that a character can come out in:
    the collages' cities (WHERE in land.js) and the Museums layer's cities."""
    out = []
    land = (ROOT / "docs" / "v2" / "land.js").read_text(encoding="utf-8")
    for m in re.finditer(r'\{ slug: "([^"]+)",\s*where: "([^"]+)",\s*lat: (-?[\d.]+),\s*lon: (-?[\d.]+) \}', land):
        out.append((m.group(2), float(m.group(3)), float(m.group(4))))
    cities = json.loads((ROOT / "docs" / "v2" / "cities.json").read_text())
    for row in cities["towns"]:
        out.append((row[1], float(row[3]), float(row[4])))
    return out


def plants(extra=()):
    grammar = json.loads((EARTH / "grammar.json").read_text())
    atlas = Atlas()
    sets, set_index = [], {}
    ecos, eco_index = [], {}
    soils, soil_index = [], {}
    rows, seen = [], set()
    for name, lat, lon in list(places()) + list(extra):
        key = (round(lat, 2), round(lon, 2))
        if key in seen:
            continue
        seen.add(key)
        here = atlas.at(lat, lon)
        if not here or str(here["biome"]) not in grammar["biomes"]:
            continue
        b = grammar["biomes"][str(here["biome"])]
        sk = (here["biome"], here["realm"])
        if sk not in set_index:
            strata = []
            for s in b.get("strata", []):
                names = s["plants"].get(here["realm"]) or s["plants"].get("*") or []
                if names:
                    strata.append([s["name"], s["shape"], s["r"], s["cover"], names])
            look = grammar["looks"].get(b["looks"].get("green", ""), None) or \
                grammar["looks"].get(next(iter(b["looks"].values())), [])
            set_index[sk] = len(sets)
            sets.append({"biome": b["name"], "realm": here["realm"], "look": look, "strata": strata})
        if here["ecoregion"] not in eco_index:
            eco_index[here["ecoregion"]] = len(ecos)
            ecos.append(here["ecoregion"])
        if here["soil"] not in soil_index:
            soil_index[here["soil"]] = len(soils)
            soils.append(list(here["soil"]))
        rows.append([key[0], key[1], set_index[sk], eco_index[here["ecoregion"]], soil_index[here["soil"]]])
    return {
        "note": "For every city the page can be down in: DIRT Earth's biome, realm, ecoregion and soil there, "
                "and the plants of that biome in that realm, stratum by stratum (name, crown shape, crown radius "
                "in DIRT cells, cover, plants). From DIRT's atlas and grammar of places; written by "
                "scripts/build_characters.py. places: [lat, lon, set, ecoregion, soil].",
        "crowns": grammar["crowns"],
        "sets": sets,
        "ecoregions": ecos,
        "soils": soils,
        "places": rows,
    }


V2 = ROOT / "docs" / "v2"


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371 * math.asin(min(1, math.sqrt(h)))


def year_of(text):
    m = re.search(r"\d{4}", str(text or ""))
    return int(m.group(0)) if m else 0


def artist_names(cast):
    return [c["artist"] for c in cast["cast"]] + [b["artist"] for b in cast.get("backlog", [])]


def homes():
    path = OUT / "homes.json"
    return json.loads(path.read_text())["artists"] if path.exists() else {}


def artist_maps(cast, home_of, plant_rows):
    """For each artist, every city of the site where the artist's saved works are held or have
    been, as a route from home: nearest first, then the nearest to that, and on. The artist's
    works are the members of the artist's thread (threads/, by the name the histories give);
    where each has been, its history's events with a place; what is held now, museums.json."""
    finding = json.loads((V2 / "finding.json").read_text())
    thread_of = {t[2]: t[0] for t in finding["t"] if t[1] == "artist"}
    cities = json.loads((V2 / "cities.json").read_text())
    town = {r[0]: r for r in cities["towns"]}
    venue_ll = {k: {v[0]: (v[1], v[2]) for v in vs} for k, vs in cities["venues"].items()}
    museums = json.loads((V2 / "museums.json").read_text())["museums"]
    out = {}
    for name in artist_names(cast):
        tid = thread_of.get(name)
        if not tid:
            out[name] = {"note": "no saved works by this artist on the site"}
            continue
        thread = json.loads((V2 / "threads" / (tid + ".json")).read_text())
        works = sorted(thread["works"], key=lambda w: (w[4] or 9999, w[0]))
        index = {w[0]: i for i, w in enumerate(works)}
        at = {}                                   # town key -> {work index: first year there}
        for w in works:
            h = json.loads((V2 / "histories" / (w[0] + ".json")).read_text())
            for e in h.get("events", []):
                k = e.get("p")
                if k not in town:
                    continue
                y = year_of(e.get("y"))
                got = at.setdefault(k, {})
                i = index[w[0]]
                if i not in got or (y and (not got[i] or y < got[i])):
                    got[i] = y
        held = {}                                 # museum slug -> its works by the artist, held now
        for m in museums:
            ids = sorted(index[x["id"]] for x in m.get("works", []) if x["id"] in index)
            if ids:
                held[m["slug"]] = ids
        rows = {}
        for k, got in at.items():
            r = town[k]
            mus = sorted(([slug, held[slug]] for slug in r[6] if slug in held),
                         key=lambda x: (-len(x[1]), x[0]))
            wait = ["m", mus[0][0]] if mus else None
            if not wait and r[9]:
                # Else the gallery, fair or sale room here that has had most of the artist's works,
                # where it has a point.
                pf = json.loads((V2 / "places" / (k + ".json")).read_text())
                count = {}
                for row in pf["works"]:
                    if row[0] in index and row[5] in venue_ll.get(k, {}):
                        count.setdefault(row[5], set()).add(row[0])
                if count:
                    vi = sorted(count, key=lambda v: (-len(count[v]), v))[0]
                    ll = venue_ll[k][vi]
                    wait = ["v", pf["venues"][vi][0], ll[0], ll[1]]
            ids = sorted(got, key=lambda i: (got[i] or 9999, i))
            first = min((y for y in got.values() if y), default=0)
            rows[k] = [k, r[1], r[2], r[3], r[4], ids, [[m[0], len(m[1])] for m in mus], wait, first]
        # The route: from home, or else from the city with most of the artist's works.
        home = home_of.get(name, {}).get("born")
        left = sorted(rows.values(), key=lambda r: (-len(r[5]), r[0]))
        here = tuple(home["ll"]) if home else (left[0][3], left[0][4]) if left else None
        route = []
        while left:
            nxt = min(left, key=lambda r: (km(here, (r[3], r[4])), r[0]))
            route.append(nxt)
            left.remove(nxt)
            here = (nxt[3], nxt[4])
        rec = {
            "thread": tid,
            "works": [[w[0], w[1], w[3], w[4] or 0] for w in works],
            "held": sum(len(v) for v in held.values()),
            "places": [[r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8]] for r in route],
        }
        h = home_of.get(name, {})
        if home:
            got = plant_rows.get((round(home["ll"][0], 2), round(home["ll"][1], 2)))
            rec["home"] = {"where": home["where"], "name": home["name"], "ll": home["ll"], "wd": home["wd"],
                           "plants": got[2:5] if got else None}
        if h.get("worked") or h.get("lived"):
            seen = []
            for w in h.get("worked", []) + h.get("lived", []):
                if w["where"] not in seen and w["where"] != (home or {}).get("where"):
                    seen.append(w["where"])
            rec["worked"] = seen
        rec["source"] = h.get("source") or h.get("note") or "no home found on Wikidata"
        out[name] = rec
        print(f"{name}: {len(works)} works, {len(route)} cities, {rec['held']} held"
              f"{', of ' + home['where'] if home else ', no home'}")
    return out


def main():
    cast = json.loads((OUT / "characters.json").read_text())
    for c in cast["cast"]:
        mod = importlib.import_module(c["id"])
        poses = mod.poses()
        n = dump(OUT / (c["id"] + ".json"), {
            "id": c["id"], "w": mod.W, "h": mod.H, "cell": mod.CELL,
            "foot": [mod.W // 2, int(mod.GROUND)],
            "poses": poses,
        })
        print(f"{c['id']}: {sum(len(v) for v in poses.values())} frames, {n} bytes")
    home_of = homes()
    extra = [(h["born"]["where"], h["born"]["ll"][0], h["born"]["ll"][1])
             for _, h in sorted(home_of.items()) if h.get("born")]
    p = plants(extra)
    n = dump(OUT / "plants.json", p)
    print(f"plants: {len(p['places'])} places, {len(p['sets'])} biome-realm sets, {n} bytes")
    rows = {(r[0], r[1]): r for r in p["places"]}
    maps = artist_maps(cast, home_of, rows)
    n = dump(OUT / "artists.json", {
        "note": "Each character's artist (the cast's and the backlog's): every city on the site where the artist's "
                "saved works are held now or have been, as a route from home (nearest first), and the artist's "
                "home with the plants of home. Written by scripts/build_characters.py from public files: "
                "finding.json, threads/, histories/, museums.json, cities.json, places/, homes.json (Wikidata). "
                "works: [id, title, image, year]; places: [city key, name, country, lat, lon, [works there, by "
                "index, earliest first], [[museum slug, works it holds]], where the animal waits (['m', museum "
                "slug] or ['v', venue, lat, lon] or null), first year]; home.plants: [set, ecoregion, soil] "
                "in plants.json.",
        "artists": maps,
    })
    print(f"artists: {len(maps)} artists, {n} bytes")


if __name__ == "__main__":
    main()
