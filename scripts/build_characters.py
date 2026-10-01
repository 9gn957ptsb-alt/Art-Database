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
                                collages' cities and the Museums layer's cities):
                                DIRT Earth's biome, realm, ecoregion and soil
                                there, and that biome's plants for that realm,
                                stratum by stratum, with their crowns' shapes

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


def plants():
    grammar = json.loads((EARTH / "grammar.json").read_text())
    atlas = Atlas()
    sets, set_index = [], {}
    ecos, eco_index = [], {}
    soils, soil_index = [], {}
    rows, seen = [], set()
    for name, lat, lon in places():
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
    p = plants()
    n = dump(OUT / "plants.json", p)
    print(f"plants: {len(p['places'])} places, {len(p['sets'])} biome-realm sets, {n} bytes")


if __name__ == "__main__":
    main()
