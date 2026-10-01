#!/usr/bin/env python3
"""The faces in Aries's saved paintings, for DRIFT's friezes (ground-gl.js, GROUND_COLLAGE, frieze()).

Finds faces in the saved paintings (OpenCV's Haar cascades, frontal and profile), crops each with its hair and chin,
and packs them into one atlas, faces/faces.jpg, 8 faces a row, each 96 by 120 pixels, with faces/faces.json saying how
many there are and whose. DRIFT lines them up in friezes after Mark Rothko's paintings of 1938 to 1942 (heads in a
register over torsos and feet) and blurs them as a panned camera does. The images stay in dirt/private/ (never
committed) and are published beside the page, as the quilts are.

    python3 dirt/artists/faces.py --db data/artworks.db --cache dirt/private/faces/src --out dirt/private/faces
    python3 dirt/artists/faces.py --pairs dirt/private/faces      # only (re)find the pairs, in an atlas already made

It also finds the pairs that weld: two faces from different paintings whose eyes, mouths and light fall in the same
places (their blurred greys correlate, their colours are near), 13 of them, no face in two, for DRIFT's welds, a pair
dissolving into each other in a Rothko (ground-gl.js, weld()). Crops with almost no contrast are not faces (a Rothko
read as one) and are never paired.
"""

import argparse
import json
import sqlite3
import urllib.request
from pathlib import Path

import cv2
import numpy as np

CW, CH, COLS = 96, 120, 8


def detect(img):
    g = cv2.equalizeHist(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY))
    h, w = g.shape
    out = []
    for name, mn in (("frontalface_alt2", 6), ("profileface", 7)):
        cc = cv2.CascadeClassifier(cv2.data.haarcascades + f"haarcascade_{name}.xml")
        for (x, y, fw, fh) in cc.detectMultiScale(g, 1.08, mn, minSize=(max(20, w // 14),) * 2):
            out.append((x, y, fw, fh))
    # one face per place: drop a box that mostly overlaps one already kept
    kept = []
    for b in sorted(out, key=lambda b: -b[2] * b[3]):
        if all(min(b[0] + b[2], k[0] + k[2]) - max(b[0], k[0]) < 0.5 * b[2] or min(b[1] + b[3], k[1] + k[3]) - max(b[1], k[1]) < 0.5 * b[3] for k in kept):
            kept.append(b)
    return kept


def pairs(F, works, keep=13):
    """The pairs of faces that weld best, [[a, b, score]], each face in one pair at most."""
    def feat(im):
        g = cv2.GaussianBlur(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(float), (0, 0), 4)[12:108, 10:86]
        g = (g - g.mean()) / (g.std() + 1e-6)
        return g.ravel() / np.sqrt(g.size)
    fs = [feat(f) for f in F]
    mc = [f.reshape(-1, 3).mean(0) for f in F]
    ok = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).std() > 14 for f in F]   # flat crops are not faces
    sc = [(float(fs[i] @ fs[j] - 0.5 * np.linalg.norm(mc[i] - mc[j]) / 255), i, j)
          for i in range(len(F)) for j in range(i + 1, len(F)) if ok[i] and ok[j] and works[i] != works[j]]
    used, out = set(), []
    for v, i, j in sorted(sc, reverse=True):
        if i in used or j in used:
            continue
        out.append([i, j, round(v, 3)])
        used |= {i, j}
        if len(out) == keep:
            break
    return out


def cells(atlas, n):
    return [atlas[(k // COLS) * CH:(k // COLS + 1) * CH, (k % COLS) * CW:(k % COLS + 1) * CW] for k in range(n)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db")
    ap.add_argument("--cache", help="where the paintings' images are kept (downloaded if missing)")
    ap.add_argument("--out")
    ap.add_argument("--max", type=int, default=89)
    ap.add_argument("--pairs", help="an atlas's folder: only find its pairs")
    a = ap.parse_args()
    if a.pairs:
        meta = json.load(open(Path(a.pairs) / "faces.json"))
        F = cells(cv2.imread(str(Path(a.pairs) / meta["file"])), meta["n"])
        meta["pairs"] = pairs(F, [w["work"] for w in meta["from"]])
        json.dump(meta, open(Path(a.pairs) / "faces.json", "w"), indent=1)
        print(len(meta["pairs"]), "pairs")
        return
    cache, out = Path(a.cache), Path(a.out)
    cache.mkdir(parents=True, exist_ok=True)
    out.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(a.db)
    rows = db.execute("select id, artist_name, image_url from artworks where category = 'Painting' and image_url is not null order by save_rank").fetchall()
    faces = []
    for wid, artist, url in rows:
        f = cache / (url.split("/")[3] + ".jpg")
        if not f.exists():
            try:
                urllib.request.urlretrieve(url, f)
            except Exception:
                continue
        img = cv2.imread(str(f))
        if img is None:
            continue
        H, W = img.shape[:2]
        for (x, y, fw, fh) in detect(img):
            # with the hair above and the chin below, at the atlas cell's proportions
            cx, cy, s = x + fw / 2, y + fh * 0.55, fw * 1.35
            x0, x1, y0, y1 = int(cx - s / 2), int(cx + s / 2), int(cy - s * 0.625), int(cy + s * 0.625)
            if x0 < 0 or y0 < 0 or x1 > W or y1 > H:
                continue
            faces.append((cv2.resize(img[y0:y1, x0:x1], (CW, CH), interpolation=cv2.INTER_AREA), wid, artist))
        if len(faces) >= a.max:
            break
    faces = faces[:a.max]
    rows_n = (len(faces) + COLS - 1) // COLS
    atlas = np.zeros((rows_n * CH, COLS * CW, 3), np.uint8)
    for k, (im, _, _) in enumerate(faces):
        atlas[(k // COLS) * CH:(k // COLS + 1) * CH, (k % COLS) * CW:(k % COLS + 1) * CW] = im
    cv2.imwrite(str(out / "faces.jpg"), atlas, [cv2.IMWRITE_JPEG_QUALITY, 88])
    json.dump({"file": "faces.jpg", "n": len(faces), "cols": COLS, "rows": rows_n, "cell": [CW, CH],
               "from": [{"work": w, "artist": ar} for _, w, ar in faces],
               "pairs": pairs([im for im, _, _ in faces], [w for _, w, _ in faces])}, open(out / "faces.json", "w"), indent=1)
    print(len(faces), "faces from", len({w for _, w, _ in faces}), "paintings")


if __name__ == "__main__":
    main()
