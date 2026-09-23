#!/usr/bin/env python3
"""Measure an artist's saved works for DIRT: each work's paper, its inks, and how much of the sheet it marks.

DIRT's ground is drawn after the artists saved in the database, starting with Cy Twombly. This reads the works'
images (downloaded to a private cache, never committed) and writes only numbers: per work, the colour of the
paper (the median of its lighter pixels), up to five ink colours (k-means over the pixels far from the paper,
with each one's share of the sheet), the share of the sheet marked, and which of DIRT's grammars it belongs to.
Photographs of the studio and of the artist are left out: they show no marks.

    python3 dirt/artists/measure.py --db artworks.db --cache private/twombly --artist Twombly --out dirt/artists/twombly.json
"""

import argparse
import json
import sqlite3
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

PHOTO = ("c-print", "gelatin", "fresson", "dryprint", "dry-print", "dry print", "ditone", "digital", "catalogue", "the book")
# DIRT's grammars, each after a family of the works (see ground-gl.js): 0 collage, 1 blackboard, 2 blooms, 3 writing, 4 drips.
GRAMMAR_BY_TITLE = [
    (("lepanto", "camino", "nine discourses on commodus (1963)"), 4),
    (("natural history", "mushroom", "plate i"), 0),
    (("bowery", "flyer"), 1),
    (("summer madness", "pan", "roses", "sets", "gaeta", "1986", "hermitage", "large signature"), 2),
]


def kmeans(X, k, it=24, seed=0):
    rng = np.random.default_rng(seed)
    C = X[rng.choice(len(X), k, replace=False)]
    for _ in range(it):
        lab = np.argmin(((X[:, None] - C[None]) ** 2).sum(-1), 1)
        C = np.array([X[lab == j].mean(0) if (lab == j).any() else C[j] for j in range(k)])
    return C, np.bincount(lab, minlength=k)


def hexof(c):
    return "#%02x%02x%02x" % tuple(int(round(v)) for v in c)


def grammar(title, paper, inks):
    t = title.lower()
    for keys, g in GRAMMAR_BY_TITLE:
        if any(k in t for k in keys):
            return g
    if np.dot(paper, [0.3, 0.59, 0.11]) < 140:
        return 1                                                     # a dark ground: a blackboard
    warm = sum(s for c, s in inks if c[0] > c[2] + 40)
    return 2 if warm > 0.08 else 3


def measure(path):
    a = np.asarray(Image.open(path).convert("RGB").resize((200, 200)))[20:180, 20:180].reshape(-1, 3).astype(float)
    L = a @ [0.3, 0.59, 0.11]
    paper = np.median(a[L > np.percentile(L, 40)], 0)
    far = a[np.linalg.norm(a - paper, axis=1) > 60]
    inks = []
    if len(far) > 50:
        C, cnt = kmeans(far, min(5, max(1, len(far) // 200)))
        inks = [(C[j], cnt[j] / len(a)) for j in np.argsort(-cnt) if cnt[j]]
    return paper, len(far) / len(a), inks


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--cache", required=True, help="where the images are downloaded (keep it private)")
    ap.add_argument("--artist", default="Twombly")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    cache = Path(args.cache)
    cache.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(args.db)
    rows = db.execute("select id, title, date, medium, image_url, save_rank from artworks where artist_name like ? order by save_rank",
                      (f"%{args.artist}%",)).fetchall()
    works = []
    for wid, title, date, medium, url, rank in rows:
        if any(p in (medium or "").lower() for p in PHOTO) or (title or "").strip().lower().startswith(("interior", "studio", "tree (i)", "cy twombly - allusions")):
            continue
        img = cache / f"{rank:05d}.jpg"
        if not img.exists():
            subprocess.run(["curl", "-s", "-o", str(img), url], check=False)
        if not img.exists() or img.stat().st_size < 1000:
            continue
        paper, cover, inks = measure(img)
        if cover < 0.01:
            continue
        works.append({"id": wid, "title": (title or "").strip(), "date": date, "paper": hexof(paper), "cover": round(cover, 3),
                      "inks": [[hexof(c), round(float(s), 3)] for c, s in inks], "grammar": grammar(title or "", paper, inks)})
    Path(args.out).write_text(json.dumps({"artist": args.artist, "works": works}, indent=1, ensure_ascii=False))
    print(len(works), "works;", "grammars", np.bincount([w["grammar"] for w in works], minlength=5).tolist())


if __name__ == "__main__":
    main()
