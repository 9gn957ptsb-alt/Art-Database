#!/usr/bin/env python3
"""The roster: artists brought into DIRT's plane one by one, each as a minimal area on the ladder of complexity.

DIRT's plane has 22 artists drawn by hand on its minimal rungs (ground-gl.js, MINI) and its worlds after others.
Every artist on the roster joins them without new code: this reads their saved works, measures what they share, and
gives them one of the shader's ten parametric compositions, its parameters, and the rung their marks earn, in the
colours of their own saved works. roster.json holds only numbers, colours and names (never an image).

  palette   the dark, middle and light thirds of their works' colours (the collection's tokens), and the most vivid
  grammar   from how their marks behave (brief.py's measures over up to 13 works):
              0 a field and one band       few marks, much open ground
              1 stripes (angle, period)     marks that share one direction
              2 dots (spacing, size)        small marks on bare ground
              3 a grid (period, weight)     moderate, even structure
              4 strokes (count, width)      a few broad marks
              5 rings (period)              saturated, moderately marked
              6 stacked fields (count)      few marks, little open ground
              7 scattered marks (density)   dense marks in every direction
              8 poured stains               soft marks that flow one way
              9 cut shapes                  flat coloured shapes on open ground
  rung      0 to 3 (point and line, plane, structure, repetition) by how densely they mark

    python3 dirt/artists/roster.py --db artworks.db --cache dirt/private/briefs --add 3

adds the three most-saved artists not yet in DIRT. The coworker (dirt/artists/COWORKER.md) runs it every week.
"""

import argparse
import datetime
import json
import math
import sqlite3
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "studies"))
from brief import PHOTO, measure  # noqa: E402

ROSTER = HERE / "roster.json"
# Already in DIRT by hand: the worlds' artists and the 22 minimal ones (ground-gl.js).
BUILT_IN = {"Cy Twombly", "Pablo Picasso", "Willem de Kooning", "Paul Cézanne", "Vincent van Gogh", "Claude Monet",
            "James Turrell", "Georges Braque", "Ad Reinhardt", "Robert Ryman", "Hiroshi Sugimoto", "Anthony McCall",
            "Joan Miró", "Wassily Kandinsky", "Franz Kline", "Alberto Giacometti", "Barnett Newman", "Mark Rothko",
            "Ellsworth Kelly", "Robert Irwin", "Larry Bell", "Josef Albers", "Agnes Martin", "Sol LeWitt", "Piet Mondrian",
            "Karl Gerstner", "Bridget Riley", "Yayoi Kusama", "Donald Judd", "Giorgio Morandi"}


def palette(db, name):
    c = np.array(db.execute("select r, g, b from artwork_colors c join artworks w on w.id = c.artwork_id where w.artist_name = ?",
                            (name,)).fetchall(), float)
    if not len(c):
        return None
    L, ch = c @ [0.3, 0.59, 0.11], c.max(1) - c.min(1)
    o, n = np.argsort(L), len(c)
    third = max(1, n // 3)
    dark, light = c[o[:third]].mean(0), c[o[-third:]].mean(0)
    mid = c[o[third:n - third]].mean(0) if n > 2 else c.mean(0)
    return [[int(v) for v in x] for x in (dark, mid, light, c[np.argmax(ch)])]


def grammar(f):
    """The composition and its parameters (p1..p4) from the measures f; and the rung."""
    E, Co, ang, bare, sat = f["edges"], f["coherence"], math.radians(f["angle"]), f["bare"], f["sat"]
    rung = 0 if E < 0.08 else 1 if E < 0.14 else 2 if E < 0.22 else 3
    if Co > 0.3:                                                        # marks that share one direction
        return 1, rung, [ang, max(4.0, 21.0 - 60.0 * E), 0.0 if Co > 0.45 else 3.0, 0.0]
    if E < 0.1:                                                         # few marks: fields
        return (0, rung, [0.0 if abs(math.sin(ang)) < 0.7 else math.pi / 2, 5.0 + 30.0 * (1 - bare), 0, 0]) if bare > 0.4 \
            else (6, rung, [2.0 + round(3 * (1 - bare)), 8.0, 0, 0])
    if E < 0.14:
        if Co > 0.2:                                                    # soft marks that flow: poured stains
            return 8, rung, [ang, 34.0 + 55.0 * (1 - bare), sat / 128.0, 0]
        if bare > 0.5:                                                  # open ground: cut shapes, or a horizon
            return (9, rung, [0.0, 3.0 + round(3 * (1 - bare)), 0, 0]) if sat > 25 else (0, rung, [0.0, 5.0 + 30.0 * (1 - bare), 0, 0])
        return 2, rung, [0.0, 8.0 + 20.0 * bare, 1.5 + 4.0 * (1 - bare), 0]
    if E > 0.25:                                                        # dense marks every way: scattered
        return 7, rung, [ang, min(1.0, E * 2.5), max(3.0, 13.0 - 30.0 * E), Co]
    if sat > 60:
        return 5, rung, [0.0, 13.0 + 30.0 * (0.2 - E), 0, 0]
    if Co > 0.18:                                                       # gestures that lean
        return 4, rung, [ang, 2.0 + round(4 * E / 0.25), 3.0 + 8.0 * (1 - E / 0.25), 0]
    if bare > 0.5:
        return 2, rung, [0.0, 8.0 + 20.0 * bare, 1.5 + 4.0 * (1 - bare), 0]
    return 3, rung, [0.0, max(5.0, 21.0 - 60.0 * E), 1.0 + 2.0 * (1 - bare), 0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--cache", required=True, help="where the works' images are downloaded (keep it private)")
    ap.add_argument("--add", type=int, default=3, help="how many artists to bring in")
    ap.add_argument("--per", type=int, default=13)
    args = ap.parse_args()
    roster = json.loads(ROSTER.read_text()) if ROSTER.exists() else {"artists": []}
    have = BUILT_IN | {a["artist"] for a in roster["artists"]}
    db = sqlite3.connect(args.db)
    cache = Path(args.cache)
    cache.mkdir(parents=True, exist_ok=True)
    added = []
    for name, n in db.execute("select artist_name, count(*) n from artworks where artist_name is not null group by artist_name order by n desc"):
        if len(added) >= args.add:
            break
        if name in have or name.lower().startswith("after "):
            continue
        rows = db.execute("select medium, image_url, save_rank from artworks where artist_name = ? order by save_rank", (name,)).fetchall()
        marked = [r for r in rows if not any(p in (r[0] or "").lower() for p in PHOTO)]
        rows = (rows if len(marked) < 5 else marked)[: args.per]
        ms = []
        for med, url, rank in rows:
            img = cache / f"{rank:05d}.jpg"
            if not img.exists() and url:
                subprocess.run(["curl", "-s", "-m", "30", "-o", str(img), url], check=False)
            if img.exists() and img.stat().st_size > 1000:
                try:
                    ms.append(measure(img)[0])
                except Exception:
                    pass
        pal = palette(db, name)
        if not ms or not pal:
            print("skipped", name, "(no images or colours)")
            continue
        f = {k: float(np.median([m[k] for m in ms])) for k in ("edges", "coherence", "angle", "bare", "sat")}
        g, rung, p = grammar(f)
        entry = {"artist": name, "saved": n, "palette": pal, "grammar": g, "rung": rung, "params": [round(float(v), 3) for v in p],
                 "measures": {k: round(v, 3) for k, v in f.items()}, "works": len(ms), "added": str(datetime.date.today())}
        roster["artists"].append(entry)
        added.append(name)
        print(f"added {name} ({n} saved): grammar {g}, rung {rung}, params {entry['params']}")
    ROSTER.write_text(json.dumps(roster, indent=1, ensure_ascii=False) + "\n")
    print(len(roster["artists"]), "on the roster;", "added", ", ".join(added) if added else "none")


if __name__ == "__main__":
    main()
