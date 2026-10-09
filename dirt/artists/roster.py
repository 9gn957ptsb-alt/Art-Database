#!/usr/bin/env python3
"""The roster: artists brought into DIRT's plane one by one, each as a minimal area on the ladder of complexity.

DIRT's plane has 22 artists drawn by hand on its minimal rungs (ground-gl.js, MINI) and its worlds after others.
Every artist on the roster joins them without new code: this reads their saved works, measures what they share, and
gives them one of the shader's ten parametric compositions, its parameters, and the rung their marks earn, in the
colours of their own saved works. roster.json holds only numbers, colours and names (never an image).

  palette   measured from the pixels of their works (k-means in Lab, as brief.py does): the darkest and the lightest
            colours that cover a real share of the works, the middle one that covers most and is most coloured, and
            the most coloured one that is more than a fleck (from 9 Oct 2026; until then the dark, middle and light
            thirds of the works' colours averaged, which turned every artist the same beige)
  grammar   from how their marks behave (brief.py's measures over up to 13 works):
              0 a field and one band       few marks, much open ground
              1 stripes (angle, period)     marks that share one direction
              2 dots (spacing, size)        small marks on bare ground
              3 a net (period, weight)      moderate, even structure (cells bent, never a grid)
              4 strokes (count, width)      a few broad marks
              5 rings (period)              saturated, moderately marked
              6 stacked fields (count)      few marks, little open ground
              7 scattered marks (density)   dense marks in every direction
              8 poured stains               soft marks that flow one way
              9 cut shapes                  flat coloured shapes on open ground
            and for artists whose way of working those ten miss, the composition after a body of their work
            (FAMILY, below):
             10 ruled planes                large planes, a drawn line or two, the old lines showing through
             11 elegy                       black ovals pressed between black bars
             12 dabs                        short strokes of colour laid side by side
             13 bands and their reflection  a landscape in bands, a horizon, its reflection, a fall of flecks
             14 out of the dark             a warm light coming out of a dark ground
             15 combine                     torn and pasted sheets, printed bars, a drip
             16 scrawl                      lashes and crowns, words written and crossed out
             17 quartered circles           circles on a lattice, each cut in four colours
             18 concentric bands            bands round a centre, an unpainted pinstripe between them
  rung      0 to 3 (point and line, plane, structure, repetition) by how densely they mark

    python3 dirt/artists/roster.py --db artworks.db --cache dirt/private/briefs --add 3

adds the three most-saved artists not yet in DIRT. The coworker (dirt/artists/COWORKER.md) runs it every week.
--repalette measures again the palettes of those already on the roster (and gives them their FAMILY composition);
--mini prints the 22 hand-drawn minimal artists' palettes, measured the same way, for MINI in ground-gl.js.
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
from brief import PHOTO, kmeans, measure  # noqa: E402

ROSTER = HERE / "roster.json"
# Already in DIRT by hand: the worlds' artists and the 22 minimal ones (ground-gl.js).
BUILT_IN = {"Cy Twombly", "Pablo Picasso", "Willem de Kooning", "Paul Cézanne", "Vincent van Gogh", "Claude Monet",
            "James Turrell", "Georges Braque", "Ad Reinhardt", "Robert Ryman", "Hiroshi Sugimoto", "Anthony McCall",
            "Joan Miró", "Wassily Kandinsky", "Franz Kline", "Alberto Giacometti", "Barnett Newman", "Mark Rothko",
            "Ellsworth Kelly", "Robert Irwin", "Larry Bell", "Josef Albers", "Agnes Martin", "Sol LeWitt", "Piet Mondrian",
            "Karl Gerstner", "Bridget Riley", "Yayoi Kusama", "Donald Judd", "Giorgio Morandi", "Susan Weil"}
# The 22 minimal artists, in the order of MINI in ground-gl.js.
MINI = ["Ad Reinhardt", "Robert Ryman", "Hiroshi Sugimoto", "Anthony McCall", "Joan Miró", "Wassily Kandinsky", "Franz Kline",
        "Alberto Giacometti", "Barnett Newman", "Mark Rothko", "Ellsworth Kelly", "Robert Irwin", "Larry Bell", "Josef Albers",
        "Agnes Martin", "Sol LeWitt", "Piet Mondrian", "Karl Gerstner", "Bridget Riley", "Yayoi Kusama", "Donald Judd",
        "Giorgio Morandi"]
# Artists whose way of working the ten measured compositions miss, given the composition after a body of their work.
FAMILY = {
    "Richard Diebenkorn": 10,      # ruled planes: the Ocean Park paintings (1967-88)
    "Brice Marden": 10,            # planes: the Grove Group (1972-76)
    "Robert Motherwell": 11,       # Elegy to the Spanish Republic (from 1948)
    "Richard Serra": 11,           # massed black: the paintstick drawings
    "Edgar Degas": 12,             # the pastels of dancers
    "Childe Hassam": 12,           # the flag paintings (1916-19)
    "Emil Nolde": 12,              # the flower watercolours
    "Odilon Redon": 12,            # the pastel flowers
    "Peter Doig": 13,              # Canoe-Lake (1997-98): bands, a horizon, a reflection
    "Graham Sutherland": 13,       # the Pembrokeshire landscapes
    "Anselm Kiefer": 13,           # furrowed fields to a high horizon (Märkischer Sand, 1982)
    "Winslow Homer": 13,           # the seas
    "Rembrandt van Rijn": 14,      # light out of the dark
    "Diego Velázquez": 14,
    "Eugène Delacroix": 14,
    "Leonardo da Vinci": 14,
    "Robert Rauschenberg": 15,     # the Combines (1954-64)
    "Mark Bradford": 15,           # paper laid down, torn and sanded back
    "Julian Schnabel": 15,         # the plate paintings
    "Conrad Marca-Relli": 15,      # canvas collage
    "Jean-Michel Basquiat": 16,    # crowns, scrawls, words crossed out
    "Georges Mathieu": 16,         # calligraphic lashes
    "Eddie Martinez": 16,
    "Oscar Murillo": 16,
    "Gabriel Orozco": 17,          # the Samurai Tree paintings: circles quartered in four colours
    "Marcel Duchamp": 17,          # the Rotoreliefs (1935)
    "Frank Stella": 18,            # the Black Paintings (1958-60) and the Protractor series (1967-71)
    "Salvador Dalí": 13,           # the shore at Cap de Creus in The Persistence of Memory (1931)
    "J. M. W. Turner": 13,         # the seas (Snow Storm, 1842)
    "Helen Frankenthaler": 8,      # soak-stain: Mountains and Sea (1952)
    "David Hockney": 12,           # the Yorkshire spring drawn on an iPad (The Arrival of Spring, 2011)
    "Karel Appel": 16,             # CoBrA's scrawled figures
    "Richard Prince": 15,
    "M. C. Escher": 3,             # Regular Division of the Plane
    "Dorothy Napangardi": 2,       # the salt lakes of Mina Mina, in dots
    "Wayne Thiebaud": 9,           # cakes and pies, flat shapes on open ground
}


def lab(c):
    """sRGB (0-255) to CIE Lab."""
    c = np.asarray(c, float) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]).T / [0.9505, 1.0, 1.089]
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def rgb_of(L):
    """CIE Lab back to sRGB (0-255)."""
    L = np.asarray(L, float)
    fy = (L[..., 0] + 16) / 116
    f = np.stack([fy + L[..., 1] / 500, fy, fy - L[..., 2] / 200], -1)
    xyz = np.where(f > 0.2069, f ** 3, (f - 16 / 116) / 7.787) * [0.9505, 1.0, 1.089]
    c = xyz @ np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]]).T
    c = np.where(c > 0.0031308, 1.055 * np.clip(c, 0, None) ** (1 / 2.4) - 0.055, 12.92 * c)
    return np.clip(np.round(c * 255), 0, 255).astype(int)


def palette_of(px, k=8):
    """Dark, middle, light and vivid, from pixels (or swatches): clusters in Lab, each kept only if it covers a share."""
    X = lab(px)
    k = min(k, len(X))
    C, W = kmeans(X, k, it=25)
    share = W / W.sum()
    chroma = np.hypot(C[:, 1], C[:, 2])
    real = [j for j in range(k) if share[j] >= 0.03] or list(np.argsort(-share)[:3])
    d = min(real, key=lambda j: C[j, 0])
    l = max(real, key=lambda j: C[j, 0])
    far = lambda j, i: np.linalg.norm(C[j] - C[i]) >= 18                # (a paper margin is not a middle colour)
    rest = [j for j in real if j not in (d, l) and far(j, d) and far(j, l)] or [j for j in real if j not in (d, l)] or [d]
    m = max(rest, key=lambda j: share[j] * (1 + chroma[j] / 30))
    seen = [j for j in range(k) if share[j] >= 0.02 and j not in (d, l, m) and chroma[j] >= 15]
    if seen:
        vivid = C[max(seen, key=lambda j: chroma[j])]
    elif chroma[m] >= 15:
        vivid = C[m]
    else:
        vivid = X[np.argsort(np.hypot(X[:, 1], X[:, 2]))[int(0.98 * (len(X) - 1))]]
    return [[int(x) for x in rgb_of(c)] for c in (C[d], C[m], C[l], vivid)]


def palette(db, name, px=None):
    """From the pixels of their works where there are any, else from the collection's three colours a work."""
    if px is not None and len(px) >= 64:
        return palette_of(px)
    c = np.array(db.execute("select r, g, b from artwork_colors c join artworks w on w.id = c.artwork_id where w.artist_name = ?",
                            (name,)).fetchall(), float)
    return palette_of(c, 6) if len(c) >= 3 else None


def works_of(db, name, cache, per):
    """Up to per of their works (paintings and prints before photographs), downloaded into the cache: measures and pixels."""
    rows = db.execute("select medium, image_url, save_rank from artworks where artist_name = ? order by save_rank", (name,)).fetchall()
    marked = [r for r in rows if not any(p in (r[0] or "").lower() for p in PHOTO)]
    rows = rows if len(marked) < 5 else marked
    rows = rows[:: len(rows) // per] if len(rows) > 2 * per else rows   # (across all of a prolific artist's saves, not their first)
    rows = rows[:per]
    ms, px = [], []
    for med, url, rank in rows:
        img = cache / f"{rank:05d}.jpg"
        if not img.exists() and url:
            subprocess.run(["curl", "-s", "-m", "30", "-o", str(img), url], check=False)
        if img.exists() and img.stat().st_size > 1000:
            try:
                m, p = measure(img)
                ms.append(m)
                px.append(p[:: max(1, len(p) // 600)])                 # (about as many from every work)
            except Exception:
                pass
    return ms, (np.concatenate(px) if px else None)


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


def grammar_params(g, f):
    """The params composition g (one of the ten) takes from the measures f, as grammar() gives them."""
    E, Co, ang, bare, sat = f["edges"], f["coherence"], math.radians(f["angle"]), f["bare"], f["sat"]
    return {0: [0.0 if abs(math.sin(ang)) < 0.7 else math.pi / 2, 5.0 + 30.0 * (1 - bare), 0, 0],
            1: [ang, max(4.0, 21.0 - 60.0 * E), 0.0 if Co > 0.45 else 3.0, 0.0],
            2: [0.0, 8.0 + 20.0 * bare, 1.5 + 4.0 * (1 - bare), 0],
            3: [0.0, max(5.0, 21.0 - 60.0 * E), 1.0 + 2.0 * (1 - bare), 0],
            4: [ang, 2.0 + round(4 * min(E, 0.25) / 0.25), 3.0 + 8.0 * (1 - min(E, 0.25) / 0.25), 0],
            5: [0.0, 13.0 + 30.0 * (0.2 - E), 0, 0],
            6: [2.0 + round(3 * (1 - bare)), 8.0, 0, 0],
            7: [ang, min(1.0, E * 2.5), max(3.0, 13.0 - 30.0 * E), Co],
            8: [ang, 34.0 + 55.0 * (1 - bare), sat / 128.0, 0],
            9: [0.0, 3.0 + round(3 * (1 - bare)), 0, 0]}[g]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--cache", required=True, help="where the works' images are downloaded (keep it private)")
    ap.add_argument("--add", type=int, default=3, help="how many artists to bring in")
    ap.add_argument("--per", type=int, default=13)
    ap.add_argument("--repalette", action="store_true", help="measure again the palettes of those on the roster")
    ap.add_argument("--mini", action="store_true", help="print the minimal artists' palettes for MINI in ground-gl.js")
    args = ap.parse_args()
    roster = json.loads(ROSTER.read_text()) if ROSTER.exists() else {"artists": []}
    db = sqlite3.connect(args.db)
    cache = Path(args.cache)
    cache.mkdir(parents=True, exist_ok=True)
    if args.mini:
        for i, name in enumerate(MINI):
            _, px = works_of(db, name, cache, args.per)
            pal = palette(db, name, px)
            print("  " + ", ".join(f"vec3({c[0]}, {c[1]}, {c[2]})" for c in pal) + ("," if i < len(MINI) - 1 else ");") + f"  // {i:2d} {name}")
        return
    if args.repalette:
        for a in roster["artists"]:
            _, px = works_of(db, a["artist"], cache, args.per)
            a["palette"] = palette(db, a["artist"], px) or a["palette"]
            if a["artist"] in FAMILY and a["grammar"] != FAMILY[a["artist"]]:
                g = FAMILY[a["artist"]]                                  # (one of the ten takes the params its measures give)
                a["grammar"], a["params"] = g, ([round(float(v), 3) for v in grammar_params(g, a["measures"])] if g < 10 and "measures" in a else [0.0, 0.0, 0.0, 0.0])
            print(f"{a['artist']}: palette {a['palette']}, grammar {a['grammar']}")
    have = BUILT_IN | {a["artist"] for a in roster["artists"]}
    added = []
    for name, n in db.execute("select artist_name, count(*) n from artworks where artist_name is not null group by artist_name order by n desc"):
        if len(added) >= args.add:
            break
        if name in have or name.lower().startswith("after "):
            continue
        ms, px = works_of(db, name, cache, args.per)
        pal = palette(db, name, px)
        if not ms or not pal:
            print("skipped", name, "(no images or colours)")
            continue
        f = {k: float(np.median([m[k] for m in ms])) for k in ("edges", "coherence", "angle", "bare", "sat")}
        g, rung, p = grammar(f)
        if name in FAMILY:                                             # a body of work the measures miss
            g = FAMILY[name]
            p = grammar_params(g, f) if g < 10 else [0.0, 0.0, 0.0, 0.0]
        entry = {"artist": name, "saved": n, "palette": pal, "grammar": g, "rung": rung, "params": [round(float(v), 3) for v in p],
                 "measures": {k: round(v, 3) for k, v in f.items()}, "works": len(ms), "added": str(datetime.date.today())}
        roster["artists"].append(entry)
        added.append(name)
        print(f"added {name} ({n} saved): grammar {g}, rung {rung}, params {entry['params']}")
    ROSTER.write_text(json.dumps(roster, indent=1, ensure_ascii=False) + "\n")
    print(len(roster["artists"]), "on the roster;", "added", ", ".join(added) if added else "none")


if __name__ == "__main__":
    main()
