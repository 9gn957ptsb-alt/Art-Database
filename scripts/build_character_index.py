#!/usr/bin/env python3
"""The Characters layer's index: every place's own animal, where it is, for the globe.

The artist, 15 Oct 2026: "Add Character as a category filter". Each of the places with a character
(docs/v2/characters/places/<key>.json, written by build_characters.py: the Museums layer's cities, the
collages' cities, the notable lives' places and every saved artist's birthplace) is one mark on the
Characters layer, at the place, its animal drawn (characters.js `Characters.hand`) and named. The globe
cannot read 911 files to know where they are, so this writes the little it needs, public files only,
the same bytes every run:

  docs/v2/characters/index.json
  {"note": ..., "places": [[key, place, lat, lon, animal, artist, rank, life], ...]}

  key     the place's key (characters/places/<key>.json)
  place   its name
  animal  the animal's name (a drawn one of the cast's, or the generated species')
  artist  its native artist, the one it is drawn after ("" when it is after the ground)
  rank    how much it matters on the globe, for the naming: a city of museums as the Museums layer
          ranks it, then the works that have been there, then the artist's saved works here
  life    the artist's life (lives.json id) where there is one, else ""

The rows are in naming order, the one that matters most first, so the page never sorts.

    python3 scripts/build_character_index.py
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "docs" / "v2"
CH = SITE / "characters"
OUT = CH / "index.json"
NOTE = ("The Characters layer of the globe (land.js, globedial.js): each place's own animal, drawn after "
        "its native artist (characters/places/<key>.json), where it is. Rows [key, place, lat, lon, animal, "
        "artist, rank, life], in naming order. Written by scripts/build_character_index.py.")


def main():
    cast = {c["id"]: c for c in json.loads((CH / "characters.json").read_text(encoding="utf-8"))["cast"]}
    towns = {t[0]: t for t in json.loads((SITE / "cities.json").read_text(encoding="utf-8"))["towns"]}
    lives = {r[0]: r for r in json.loads((SITE / "lives.json").read_text(encoding="utf-8"))["lives"]}
    rows = []
    for f in sorted(CH.glob("places/*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        native = d.get("native") or {}
        if d.get("cast"):
            c = cast.get(d["cast"])
            if not c:
                continue
            animal = c["name"]
        elif d.get("species") and d.get("sprite"):
            animal = d["species"]["name"]
        else:
            continue
        artist = native.get("artist") or ""
        life = native.get("id") or ""
        if life and life not in lives:
            life = ""
        t = towns.get(d["key"])
        if t:
            n = t[5] or 0
            rank = (1 + 0.5 * len(t[6]) + 0.5 * math.log10(1 + n)) if t[6] else 0.5 * math.log10(1 + n)
        else:
            rank = 0.2 + 0.3 * math.log10(1 + (d.get("here") or 0))
        lat, lon = d["ll"]
        rows.append([d["key"], d["name"], round(lat, 4), round(lon, 4), animal, artist, round(rank, 3), life])
    rows.sort(key=lambda r: (-r[6], r[1]))
    OUT.write_text(json.dumps({"note": NOTE, "places": rows}, ensure_ascii=False, separators=(",", ":")),
                   encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}  {OUT.stat().st_size // 1024} KB  {len(rows)} places")


if __name__ == "__main__":
    main()
