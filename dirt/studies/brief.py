#!/usr/bin/env python3
"""Briefs for DIRT's studies: what an artist's saved works share, so a study teaches their grammar, not one picture.

A study made from a single famous painting teaches DIRT to copy that painting. This reads up to --per of each
artist's saved works (images in a private cache, never committed), measures each one, and pools the measures into
the artist's grammar:

  palette      k-means over the colour of all their works together, weighted by how much of each sheet it covers
  marks        how busy the surface is (edge density), how strongly its strokes share one direction (the
               coherence of the structure tensor) and which, and how much of the surface is left bare
  light        the spread of lightness, and how saturated the colour runs
  range        the two works farthest apart in these measures, so a study spans the artist, not one period

It then finds each artist's kin among the others measured (nearest in these measures), so one study serves several
artists at once, and writes briefs.json: per artist the measures, the kin, who counts them as kin (reach), and a
prompt for generate.py that asks for the shared grammar and names no single work; and an order to make the studies
in, each next one serving the most artists not yet served, until every artist is. A photographer (fewer than five
works that are not photographs) is read from their photographs.

    python3 dirt/studies/brief.py --db artworks.db --cache private/briefs --top 30 [--per 13]
"""

import argparse
import json
import sqlite3
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
PHOTO = ("c-print", "gelatin", "photograph", "silver print", "pigment print", "poster", "catalogue", "book")


def kmeans(X, k, w=None, it=20, seed=0):
    rng = np.random.default_rng(seed)
    C = X[rng.choice(len(X), k, replace=False)]
    for _ in range(it):
        lab = np.argmin(((X[:, None] - C[None]) ** 2).sum(-1), 1)
        C = np.array([np.average(X[lab == j], 0, w[lab == j] if w is not None else None) if (lab == j).any() else C[j] for j in range(k)])
    return C, np.bincount(lab, weights=w, minlength=k)


def measure(path):
    im = Image.open(path).convert("RGB")
    im.thumbnail((256, 256))
    a = np.asarray(im).astype(float)
    g = np.asarray(im.convert("L").filter(ImageFilter.GaussianBlur(1))).astype(float)
    gy, gx = np.gradient(g)
    mag = np.hypot(gx, gy)
    # the structure tensor over the whole surface: how much the strokes share one direction, and which
    jxx, jyy, jxy = (gx * gx).mean(), (gy * gy).mean(), (gx * gy).mean()
    coh = np.sqrt((jxx - jyy) ** 2 + 4 * jxy ** 2) / (jxx + jyy + 1e-9)
    ang = (0.5 * np.degrees(np.arctan2(2 * jxy, jxx - jyy)) + 90) % 180      # stroke direction, 0 = horizontal
    px = a.reshape(-1, 3)
    L = px @ [0.3, 0.59, 0.11]
    sat = (px.max(1) - px.min(1))
    ground = np.median(px[L > np.percentile(L, 50)], 0)
    bare = float((np.linalg.norm(px - ground, axis=1) < 30).mean())
    return {"edges": float((mag > 12).mean()), "coherence": float(coh), "angle": float(ang), "bare": bare,
            "light": [float(np.percentile(L, 10)), float(np.percentile(L, 90))], "sat": float(np.median(sat))}, px[::7]


def feature(m):
    return np.array([m["edges"] * 3, m["coherence"] * 2, m["bare"], m["light"][0] / 255, m["light"][1] / 255, m["sat"] / 128])


def describe(name, g, kin, q):
    # words from where the artist stands among all those measured (thirds), not from fixed thresholds
    def third(k, v=None):
        v = g[k] if v is None else v
        return 0 if v < q[k][0] else 2 if v > q[k][1] else 1
    kind = g["kind"]
    edges = ["sparse, calm, much of it open", "moderately marked", "dense, busy with marks"][third("edges")]
    flow = ["its marks run in many directions", "its marks lean loosely one way",
            "its strokes strongly share one direction, about %d degrees from horizontal" % g["angle"]][third("coherence")]
    bare = ["the surface mostly covered", "some bare ground left showing", "a lot of bare ground left showing"][third("bare")]
    light = ["a narrow, even range of light", "a moderate range of light", "a wide range from deep darks to bright lights"][third("span", g["light"][1] - g["light"][0])]
    sat = ["muted colour", "moderately saturated colour", "saturated colour"][third("sat")]
    pal = ", ".join(g["palette"])
    return (f"A study of the visual language shared across {name}'s saved {kind}, not a copy of any one of them and "
            f"not their most famous image: a continuous field, filling the frame, that could be any part of any of their "
            f"{kind}. Palette, in these proportions: {pal}. The surface is {edges}; {flow}; {bare}; {light}; {sat}. "
            f"Show the characteristic mark itself (the stroke, line, edge or plane) sharply, at a scale where its "
            f"texture reads, and the way marks meet and overlap. It should also sit well beside {', '.join(kin)}, whose "
            f"works share much of this grammar. Seen flat and straight on, no frame, no text, no signature.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--cache", required=True)
    ap.add_argument("--top", type=int, default=30)
    ap.add_argument("--per", type=int, default=13)
    ap.add_argument("--out", default=str(HERE / "briefs.json"))
    args = ap.parse_args()
    cache = Path(args.cache)
    cache.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(args.db)
    artists = [r[0] for r in db.execute("select artist_name, count(*) n from artworks where artist_name is not null group by artist_name order by n desc limit ?", (args.top,))]
    out = {}
    for name in artists:
        rows = db.execute("select id, medium, image_url, save_rank from artworks where artist_name = ? order by save_rank", (name,)).fetchall()
        marked = [r for r in rows if not any(p in (r[1] or "").lower() for p in PHOTO)]
        photo = len(marked) < 5                                        # a photographer: their photographs are the work
        rows = (rows if photo else marked)[: args.per]
        ms, pxs = [], []
        for wid, med, url, rank in rows:
            img = cache / f"{rank:05d}.jpg"
            if not img.exists():
                subprocess.run(["curl", "-s", "-m", "30", "-o", str(img), url], check=False)
            if not img.exists() or img.stat().st_size < 1000:
                continue
            try:
                m, px = measure(img)
            except Exception:
                continue
            ms.append(m); pxs.append(px)
        if not ms:
            continue
        P = np.concatenate(pxs)
        C, cnt = kmeans(P, 6)
        order = np.argsort(-cnt)
        F = np.array([feature(m) for m in ms])
        far = np.unravel_index(np.argmax(((F[:, None] - F[None]) ** 2).sum(-1)), (len(F), len(F)))
        g = {"works": len(ms), "kind": "photographs" if photo else "works", "edges": float(np.median([m["edges"] for m in ms])), "coherence": float(np.median([m["coherence"] for m in ms])),
             "angle": float(np.median([m["angle"] for m in ms])), "bare": float(np.median([m["bare"] for m in ms])),
             "light": [float(np.median([m["light"][0] for m in ms])), float(np.median([m["light"][1] for m in ms]))],
             "sat": float(np.median([m["sat"] for m in ms])),
             "palette": ["#%02x%02x%02x (%d%%)" % (*[int(v) for v in C[j]], round(100 * cnt[j] / cnt.sum())) for j in order],
             "range": [rows[int(far[0])][0], rows[int(far[1])][0]], "feature": F.mean(0).tolist()}
        out[name] = g
    names = list(out)
    Fm = np.array([out[n]["feature"] for n in names])
    q = {k: np.percentile([v(out[n]) for n in names], [33, 67]) for k, v in
         {"edges": lambda g: g["edges"], "coherence": lambda g: g["coherence"], "bare": lambda g: g["bare"],
          "span": lambda g: g["light"][1] - g["light"][0], "sat": lambda g: g["sat"]}.items()}
    for i, n in enumerate(names):
        d = ((Fm - Fm[i]) ** 2).sum(1)
        kin = [names[j] for j in np.argsort(d) if j != i][:3]
        out[n]["kin"] = kin
        out[n]["prompt"] = describe(n, out[n], kin, q)
        del out[n]["feature"]
    for n in names:
        out[n]["reach"] = [m for m in names if n in out[m]["kin"]]      # the artists who count this one as kin
    # The order to make studies in: each serves its artist and their kin, so take next whichever serves the most
    # artists not yet served (ties to the most saved), until every artist is served.
    served, order = set(), []
    while len(served) < len(names):
        best = max((n for n in names if n not in order), key=lambda n: len(({n} | set(out[n]["kin"])) - served))
        order.append(best)
        served |= {best} | set(out[best]["kin"])
    out = {"order": order, "artists": out}
    Path(args.out).write_text(json.dumps(out, indent=1, ensure_ascii=False))
    print(len(names), "artists briefed; studies to serve them all, in order:", ", ".join(order))


if __name__ == "__main__":
    main()
