#!/usr/bin/env python3
"""Quilts: an artist's paintings coming together where their regions would carry on into each other.

Image quilting (after Efros and Freeman, 2001): a new canvas is laid patch by patch, each patch taken from one of the
artist's saved works and chosen because the strip where it overlaps its neighbours (left and above) agrees with them
best; then the two are joined along the path through that strip where they differ least, so there is no seam to see.
Here a patch from a different painting than its neighbour is preferred, so a quilt is the artist's works meeting,
not one work rearranged: where a sky in one painting continues a sky in another, that is where they join.

A kin quilt does the same across two artists, the first on the left and the second taking over across the canvas, so
one painter becomes another through the regions of their works that continue each other.

Images come from the private cache (dirt/studies/brief.py fills it) and quilts are written to dirt/private/quilts/;
neither is ever committed.

    python3 dirt/artists/quilt.py --db artworks.db --cache dirt/private/briefs --out dirt/private/quilts
"""

import argparse
import json
import sqlite3
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
PHOTO = ("c-print", "gelatin", "photograph", "silver print", "pigment print", "poster", "catalogue", "book")
B, O = 89, 34                      # a patch, and how much of it overlaps its neighbours (a φ² of it)
LONG = 377                         # works are read at this size (their long side), so a patch holds a passage of paint


def works(db, cache, artist, per):
    rows = db.execute("select medium, save_rank from artworks where artist_name = ? order by save_rank", (artist,)).fetchall()
    rows = [r for r in rows if not any(p in (r[0] or "").lower() for p in PHOTO)][:per]
    out = []
    for med, rank in rows:
        f = cache / f"{rank:05d}.jpg"
        if not f.exists() or f.stat().st_size < 1000:
            continue
        im = Image.open(f).convert("RGB")
        s = LONG / max(im.size)
        im = im.resize((max(B + 1, round(im.width * s)), max(B + 1, round(im.height * s))), Image.LANCZOS)
        a = np.asarray(im).astype(np.float32)
        cy, cx = a.shape[0] // 21 + 3, a.shape[1] // 21 + 3
        a = a[cy:-cy, cx:-cx]                                        # a margin off every edge: frames, mats, the wall
        if a.shape[0] > B + 2 and a.shape[1] > B + 2:
            out.append(a)
    return out


def min_cut(err):
    """The path down err (rows x cols) where it is least; returns, per row, the column the cut passes."""
    h, w = err.shape
    # kept off the overlap's edges, where a cut would be a straight line along the patch's own border
    k = np.abs(np.arange(w) - (w - 1) / 2) / ((w - 1) / 2)
    E = err + (np.median(err) + 1.0) * 3.0 * k[None, :] ** 4
    for i in range(1, h):
        l = np.r_[np.inf, E[i - 1, :-1]]
        r = np.r_[E[i - 1, 1:], np.inf]
        E[i] += np.minimum(np.minimum(l, E[i - 1]), r)
    path = np.zeros(h, int)
    path[-1] = int(np.argmin(E[-1]))
    for i in range(h - 2, -1, -1):
        j = path[i + 1]
        lo, hi = max(0, j - 1), min(w, j + 2)
        path[i] = lo + int(np.argmin(E[i, lo:hi]))
    return path


def quilt(pools, n, rng, mix=None):
    """A canvas of n by n patches. pools: lists of works; mix(col) -> weights over the pools, for kin quilts.

    The canvas is a torus: its right edge carries on into its left and its bottom into its top, the last column and
    row of patches joined to the first as to their other neighbours, so it repeats without a seam or a mirror."""
    step = B - O
    size = step * n
    canvas = np.zeros((size, size, 3), np.float32)
    src = -np.ones((n, n), int)                                     # which work each patch came from
    flat = [(p, w) for p, pool in enumerate(pools) for w in range(len(pool))]
    for i in range(n):
        for j in range(n):
            y, x = i * step, j * step
            out = np.roll(canvas, (-y, -x), (0, 1))                 # the patch's place at the origin
            y = x = 0
            right, below = j == n - 1, i == n - 1                   # overlapping the first column, the first row
            weights = np.array([1.0 if mix is None else mix(j / max(1, n - 1))[p] for p, _ in flat])
            weights /= weights.sum()
            cands = []
            for k in rng.choice(len(flat), size=233, p=weights):
                p, w = flat[k]
                a = pools[p][w]
                yy, xx = rng.integers(0, a.shape[0] - B), rng.integers(0, a.shape[1] - B)
                cands.append((p, w, a[yy:yy + B, xx:xx + B]))
            errs, stds, sames = [], [], []
            for p, w, patch in cands:
                c, npx = 0.0, 0
                if j > 0: c += ((patch[:, :O] - out[y:y + B, x:x + O]) ** 2).sum(); npx += B * O
                if i > 0: c += ((patch[:O, :] - out[y:y + O, x:x + B]) ** 2).sum(); npx += B * O
                if right: c += ((patch[:, step:] - out[:B, step:B]) ** 2).sum(); npx += B * O
                if below: c += ((patch[step:, :] - out[step:B, :B]) ** 2).sum(); npx += B * O
                errs.append(c / max(1, npx))
                stds.append(patch.std())
                wid = p * 1000 + w
                sames.append((j > 0 and src[i, j - 1] == wid) + (i > 0 and src[i - 1, j] == wid))
            errs, stds, sames = np.array(errs), np.array(stds), np.array(sames)
            # how well it carries on from its neighbours, against how much is in it; another painting than theirs preferred
            costs = errs / (np.median(errs) + 1e-6) - 0.45 * stds / (np.median(stds) + 1e-6) + 0.3 * sames
            if i == 0 and j == 0: costs = -stds
            ok = np.flatnonzero(costs <= costs.min() + 0.06 * (abs(costs.min()) + 1))
            p, w, patch = cands[int(rng.choice(ok))]
            if i or j:                                              # half the difference in tone at the overlap taken up
                ov = [(patch[:, :O], out[y:y + B, x:x + O])] * (j > 0) + [(patch[:O, :], out[y:y + O, x:x + B])] * (i > 0) \
                    + [(patch[:, step:], out[:B, step:B])] * right + [(patch[step:, :], out[step:B, :B])] * below
                shift = np.mean([b.mean((0, 1)) - a.mean((0, 1)) for a, b in ov], 0)
                patch = patch + 0.5 * shift
            src[i, j] = p * 1000 + w
            mask = np.ones((B, B), bool)
            if j > 0:
                cut = min_cut(((patch[:, :O] - out[y:y + B, x:x + O]) ** 2).sum(2))
                for r in range(B): mask[r, :cut[r]] = False
            if i > 0:
                cut = min_cut(((patch[:O, :] - out[y:y + O, x:x + B]) ** 2).sum(2).T)
                for c in range(B): mask[:cut[c], c] &= False
            if right:
                cut = min_cut(((patch[:, step:] - out[:B, step:B]) ** 2).sum(2)[:, ::-1])
                for r in range(B): mask[r, B - cut[r]:] = False
            if below:
                cut = min_cut(((patch[step:, :] - out[step:B, :B]) ** 2).sum(2).T[:, ::-1])
                for c in range(B): mask[B - cut[c]:, c] = False
            m = mask.astype(np.float32)
            if i or j:
                for _ in range(8):                                      # the cut softened, only inside the overlap
                    e = np.pad(m, 1, mode="edge")
                    m = (m + e[:-2, 1:-1] + e[2:, 1:-1] + e[1:-1, :-2] + e[1:-1, 2:]) / 5.0
                inner = np.zeros((B, B), bool)
                inner[(O if i else 0):(step if below else B), (O if j else 0):(step if right else B)] = True
                m = np.where(inner, 1.0, m)
            region = out[y:y + B, x:x + B]
            region[:] = region * (1 - m[..., None]) + patch * m[..., None]
            canvas = np.roll(out, (i * step, j * step), (0, 1))
    return np.clip(canvas, 0, 255).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--cache", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--briefs", default=str(HERE.parent / "studies" / "briefs.json"))
    ap.add_argument("--n", type=int, default=8, help="patches a side (8: 440 pixels)")
    ap.add_argument("--per", type=int, default=13)
    ap.add_argument("--artists", type=int, default=16)
    args = ap.parse_args()
    db, cache, out = sqlite3.connect(args.db), Path(args.cache), Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    briefs = json.loads(Path(args.briefs).read_text())["artists"]
    names = [n for n in briefs if briefs[n].get("kind") != "photographs"][: args.artists]
    rng = np.random.default_rng(7)
    made, pools = [], {}
    for name in names:
        pools[name] = works(db, cache, name, args.per)
    for name in names:
        if len(pools[name]) < 3:
            continue
        img = quilt([pools[name]], args.n, rng)
        f = f"q{len(made):02d}.jpg"
        Image.fromarray(img).save(out / f, quality=88)
        made.append({"file": f, "artists": [name]})
        print("quilt", name, flush=True)
    # kin: each artist into its nearest kin, one painter becoming another
    seen = set()
    for name in names:
        kin = next((k for k in briefs[name]["kin"] if k in pools and len(pools[k]) >= 3), None)
        if not kin or len(pools[name]) < 3 or frozenset((name, kin)) in seen:
            continue
        seen.add(frozenset((name, kin)))
        # across the canvas and back, so the torus is one painter, the other, and the first again
        mix = lambda t: [max(0.02, 1 - abs(2 * t - 1)) ** 2, max(0.02, abs(2 * t - 1)) ** 2]
        img = quilt([pools[name], pools[kin]], args.n, rng, mix)
        f = f"q{len(made):02d}.jpg"
        Image.fromarray(img).save(out / f, quality=88)
        made.append({"file": f, "artists": [name, kin]})
        print("kin quilt", name, "->", kin, flush=True)
    (out / "quilts.json").write_text(json.dumps(made, indent=1, ensure_ascii=False))
    print(len(made), "quilts in", out)


if __name__ == "__main__":
    main()
