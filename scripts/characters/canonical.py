"""The canonical chimera, drawn fine: traced from its references, cell by cell.

The artist, 1 Oct 2026: "really work on the three Artist Chimera, it should
be the most refined and well portrayed character on the entire site. It's
gotta be good, like really good. If you need to use ChatGPT to develop a
hyper specific version ... then go ahead".

"The Bowed Mantle That Leaves a Trace" — the bison's head after Elaine de
Kooning, the bald eagle's body after Warhol, the banana slug's hindquarters
after Kapoor — is drawn twice: large, about 185 cells long, for its
unfolding (2-3 CSS px a cell), and small, about 70, for walking in a city
and along the globe. Its poses were made as references with OpenAI's
gpt-image-2.5 (one design, then each pose an edit of it, so they stay in
register) and kept out of the repository; this script traces them down to
the grid and to a restrained palette of the three artists' inks, then
cleans them: every cell takes one artist (the slot whose inks most of its
pixels are nearest) and then one ink of that artist; orphan cells are
folded into their neighbours; the silhouette loses its stray hairs and
fills its pinholes; Warhol's key line is found where the reference draws it
thin, kept on its own layer, and printed one cell off register; the eye,
its light, the horn and the talons are set by hand (FIXES), as are the
folds' places.

    python3 scripts/characters/canonical.py REF_DIR

writes docs/v2/characters/parts/canonical/bison-eagle-slug.json. The
references never enter the repository; the cells this derives from them do
(an AI-derived drawing is ours to use). build_characters.py never runs this
(it needs the references); run it again only to redraw.
"""

import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "docs", "v2", "characters", "parts", "canonical", "bison-eagle-slug.json")

# The inks: letter -> (colour, slot); never a digit (the rows are run-length coded). Slots: 0 the head (de Kooning), 1 the
# body (Warhol), 2 the hindquarters (Kapoor). Drawn from each artist's inks
# in characters.json, with the steps between that the drawing needs.
INKS = {
    # de Kooning, the Cave paintings: the cave's dark, umbers, burnt ochre, pale ochre
    "A": ("#2b1a12", 0), "B": ("#5a2c10", 0), "C": ("#8a4216", 0), "D": ("#b15519", 0),
    "E": ("#c98b5c", 0), "F": ("#9e8880", 0), "G": ("#cdc5b4", 0),
    "H": ("#211915", 0), "I": ("#6b5a4e", 0),            # horn, its light
    "K": ("#120a07", 0), "W": ("#f2e6cc", 0),            # eye, its light
    "P": ("#b9a99a", 0),                                  # breath
    # Warhol, Endangered Species: flat plates, the key line, the feet
    "a": ("#241a1c", 1), "b": ("#3a2426", 1), "c": ("#523236", 1), "d": ("#6c4440", 1),
    "e": ("#8a5e55", 1),
    "Y": ("#e1c31d", 1),                                  # the key line (its own layer)
    "l": ("#a87a12", 1), "m": ("#d9a81c", 1), "n": ("#f0d66a", 1),
    "t": ("#3a2f31", 1), "u": ("#8a7a74", 1),            # talons (lit a step off the dark ground), their glint
    # Kapoor, Svayambh, Yellow: stacked pigment bands, the foot, the trace
    "J": ("#ffd27a", 2), "L": ("#ffa801", 2), "M": ("#e07f05", 2), "N": ("#b0650a", 2),
    "O": ("#3c3741", 2), "R": ("#5f5669", 2), "s": ("#5a3418", 2),
    "x": ("#2a2030", 2), "z": ("#8f80a6", 2),            # the trace, wet
}
SOIL = ["#3b2214", "#5a3420", "#4a2a18", "#6b4027", "#2e1a10"]   # the references' ground: dropped
DARK = set("AHKatxO")                                     # too dark to say whose a cell is
FEET_BELOW = set("lmntuORxzsJLMN")                        # what may stand below the ground line


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def lab(rgb):
    a = np.asarray(rgb, dtype=np.float64) / 255.0
    a = np.where(a > 0.04045, ((a + 0.055) / 1.055) ** 2.4, a / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = a @ M.T / np.array([0.9505, 1.0, 1.089])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


LETTERS = [k for k in INKS if k != "Y"]
PAL = lab([hexrgb(INKS[k][0]) for k in LETTERS])
SLOT = np.array([INKS[k][1] for k in LETTERS])
SOILLAB = lab([hexrgb(h) for h in SOIL])

# The poses, each a reference (an edit of the one design) and what is hand-set in it.
# g: the ground line (source px); hip: left of it no foot is the eagle's, right of it nothing is the slug's.
POSES = {
    "stand":   {"src": "folded1.png", "g": 832, "hip": 690},
    "present": {"src": "v2_flare.png", "g": 832, "hip": 690},
    "mantle":  {"src": "mantle.png", "g": 833, "hip": 700},
    "wind":    {"src": "wind.png", "g": 832, "hip": 690},
    "walkA":   {"src": "walkA.png", "g": 832, "hip": 690},
    "walkB":   {"src": "walkB.png", "g": 832, "hip": 700},
    "passA":   {"src": "passA.png", "g": 832, "hip": 690},
    "passB":   {"src": "passB.png", "g": 832, "hip": 700},
    "look":    {"src": "look.png", "g": 832, "hip": 690},
    "rest":    {"src": "rest.png", "g": 832, "hip": 1040},
    "settle":  {"src": "settle.png", "g": 832, "hip": 700},
}


def nearest(labimg, pal):
    d = ((labimg[..., None, :] - pal[None, None, :, :]) ** 2).sum(-1)
    return d.argmin(-1), d.min(-1)


def prepare(path, g):
    im = np.array(Image.open(path).convert("RGB")).astype(np.float64)
    H, W, _ = im.shape
    bg = np.median(im[:150, :150].reshape(-1, 3), 0)
    L = lab(im)
    bgl = lab([bg])[0][0]
    fg = (np.abs(im - bg).sum(-1) > 30) | (L[..., 0] < bgl - 3.5)
    idx, dist = nearest(L, PAL)
    sidx, sdist = nearest(L, SOILLAB)
    # Below the ground line only what stands on it: the feet, the slug's foot, its trace.
    soilish = sdist < dist
    feet = np.isin(np.array(LETTERS)[idx], list(FEET_BELOW)) & ~soilish
    rows = np.arange(H)[:, None]
    fg = np.where(rows >= g, fg & feet, fg)
    fg[g + 2 * 21:] = False
    up = fg.copy()
    up[g:] = False
    up = ndimage.binary_fill_holes(up)
    fg[:g] = up[:g]
    lab_, n = ndimage.label(fg)
    if n:
        sizes = ndimage.sum(fg, lab_, range(1, n + 1))
        keep = np.zeros(n + 1, bool)
        keep[1:] = sizes >= 160
        fg = keep[lab_]
    # Warhol's key line: thin yellow, not the feet (which survive an opening).
    yl = lab([hexrgb(INKS["Y"][0]), (180, 144, 54), (210, 166, 42)])
    ky, kd = nearest(L, yl)
    yellow = (kd < 22 ** 2) & (np.abs(im - bg).sum(-1) > 60)
    thick = ndimage.binary_opening(yellow, structure=np.ones((5, 5)))
    thick = ndimage.binary_dilation(thick, iterations=2)
    thin = yellow & ~thick
    # The eye: its light (the brightest few pixels on the head) and the dark round it.
    lum = L[..., 0]
    eyes = []
    hot = (lum > 86) & (np.arange(W)[None, :] > 1100) & (rows < g - 120)
    hl, hn = ndimage.label(ndimage.binary_dilation(hot, iterations=2))
    for k in range(1, hn + 1):
        ys, xs = np.nonzero((hl == k) & hot)
        if 2 <= len(ys) <= 80:
            cy, cx = ys.mean(), xs.mean()
            win = (slice(int(cy) - 14, int(cy) + 16), slice(int(cx) - 14, int(cx) + 16))
            dk = lum[win] < 14
            if dk.sum() > 25:
                dy, dx = np.nonzero(dk)
                eyes.append({"light": (cx, cy), "dark": (dx.mean() + int(cx) - 14, dy.mean() + int(cy) - 14),
                             "r": max(4.0, np.sqrt(dk.sum() / np.pi))})
    return {"im": im, "L": L, "fg": fg, "idx": idx, "thin": thin, "eyes": eyes, "W": W, "H": H}


def trace(P, S, g, hip, below=2):
    im, L, fg, idx, thin, W = P["im"], P["L"], P["fg"], P["idx"], P["thin"], P["W"]
    rows_up = (g // S) + 1
    top = g - rows_up * S
    nrow, ncol = rows_up + below, W // S
    cells = [["."] * ncol for _ in range(nrow)]
    key = [[False] * ncol for _ in range(nrow)]
    yy, xx = np.mgrid[0:S, 0:S]
    wgt = 1.0 + 1.5 * np.exp(-(((xx - S / 2 + 0.5) ** 2 + (yy - S / 2 + 0.5) ** 2) / (S * S * 0.18)))
    for j in range(nrow):
        y0 = top + j * S
        if y0 < 0:
            continue
        for i in range(ncol):
            x0 = i * S
            f = fg[y0:y0 + S, x0:x0 + S]
            t = thin[y0:y0 + S, x0:x0 + S]
            if t.sum() >= max(3, S * S * (0.05 if S <= 10 else 0.13)) and y0 + S <= g + 2:
                key[j][i] = True
            m = f & ~t
            if m.mean() < 0.42:
                continue
            if m.sum() < S * S * 0.2:
                m = f
            ci = idx[y0:y0 + S, x0:x0 + S][m]
            w = wgt[m]
            sl = SLOT[ci]
            dark = np.isin(np.array(LETTERS)[ci], list(DARK))
            votes = np.bincount(sl[~dark], weights=w[~dark], minlength=3) if (~dark).any() else np.bincount(sl, weights=w, minlength=3)
            cx = x0 + S / 2
            if cx > hip:
                votes[2] = -1
            slot = int(np.argmax(votes))
            sub = [k for k, l in enumerate(LETTERS) if INKS[l][1] == slot]
            li = lab_pick = L[y0:y0 + S, x0:x0 + S][m]
            pi, _ = nearest(li[None], PAL[sub])
            cnt = np.bincount(pi[0], weights=w, minlength=len(sub))
            letter = LETTERS[sub[int(np.argmax(cnt))]]
            if slot == 1 and letter in "lmn" and cx < hip - 2 * S and j < rows_up - 6:
                letter = "d"
            cells[j][i] = letter
    # The key line belongs to the eagle's plates: not the head's fur, not the feet.
    for j in range(nrow):
        for i in range(ncol):
            if not key[j][i]:
                continue
            near = [cells[y][x] for y in range(max(0, j - 1), min(nrow, j + 2)) for x in range(max(0, i - 1), min(ncol, i + 2))]
            plates = sum(1 for k in near if k in "abcde")
            other = sum(1 for k in near if k != "." and k not in "abcdeY")
            if plates == 0 or other > plates:
                key[j][i] = False
    # Warhol's drawn line: round the eagle's plates (not where they meet the
    # head: that is the fold), and the inner lines the reference draws, where
    # they run on for three cells or more.
    k2 = np.array(key)
    lab2, n2 = ndimage.label(k2, structure=np.ones((3, 3)))
    if n2:
        sz = ndimage.sum(k2, lab2, range(1, n2 + 1))
        k2 = np.isin(lab2, [q + 1 for q in range(n2) if sz[q] >= 6])
    if S > 10:
        k2[:] = False                      # small: the line round it only
    inner = k2.copy()
    k2 = np.zeros_like(k2)
    for j in range(nrow):
        for i in range(ncol):
            if cells[j][i] not in "abcde":
                continue
            if any(cells[y][x] in "lmntu" for y in range(max(0, j - 1), min(nrow, j + 2)) for x in range(max(0, i - 1), min(ncol, i + 2))):
                continue                   # not round the feet: the line is the plates'
            for y, x in ((j - 1, i), (j + 1, i), (j, i - 1), (j, i + 1)):
                if 0 <= y < nrow and 0 <= x < ncol and (cells[y][x] == "." or INKS[cells[y][x]][1] == 2):
                    k2[j][i] = True
    inner &= ~k2
    # not along the feet
    for j in range(nrow):
        for i in range(ncol):
            if inner[j][i] and any(cells[y][x] in "lmntu" for y in range(max(0, j - 1), min(nrow, j + 2)) for x in range(max(0, i - 1), min(ncol, i + 2))):
                inner[j][i] = False
    key = (k2.astype(int) + 2 * inner.astype(int)).tolist()
    # The belly behind the slug's cut: the reference leaves it in shadow as
    # dark as the ground, so it would read as a hole; it is the eagle's
    # deepest plate, from the slug's edge to the near leg.
    hipc = int(hip // S)
    for j in range(nrow):
        for i in range(max(0, hipc - 3), min(ncol, hipc + max(3, int(64 / S)))):
            if cells[j][i] != ".":
                continue
            left = any(cells[j][x] != "." and INKS[cells[j][x]][1] == 2 for x in range(max(0, i - 4), i))
            above = any(cells[y][i] in "abcde" for y in range(max(0, j - 6), j))
            if left and above:
                cells[j][i] = "a"
    # The talons, set by hand: each toe's end, on the lowest rows of the
    # feet, is hooked down into a black claw.
    feet_rows = [j for j in range(nrow) if any(k in "lmn" for k in cells[j])]
    if feet_rows:
        low = max(feet_rows)
        for j in (low - 1, low):
            r = cells[j]
            i = 0
            while i < ncol:
                if r[i] in "lmn":
                    a = i
                    while i < ncol and r[i] in "lmn":
                        i += 1
                    b = i - 1
                    for e in ((a, -1), (b, 1)):
                        x = e[0] + e[1]
                        if 0 <= x < ncol and j + 1 < nrow and cells[j][x] == "." and (j == low or cells[j + 1][e[0]] == "."):
                            if j + 1 < nrow and cells[j + 1][x] == ".":
                                cells[j + 1][x] = "t"
                            if S <= 10 and j + 1 < nrow and cells[j + 1][e[0]] == ".":
                                cells[j + 1][e[0]] = "t"
                else:
                    i += 1
    # The eye, set by hand: its dark, and its light at the upper left.
    for e in P["eyes"]:
        ex, ey = e["dark"]
        lx, ly = e["light"]
        if S <= 10:
            r = e["r"]
            for j in range(nrow):
                for i in range(ncol):
                    cx, cy = i * S + S / 2, top + j * S + S / 2
                    if abs(cx - ex) <= max(S * 0.9, r) and abs(cy - ey) <= max(S * 0.6, r * 0.8):
                        if cells[j][i] != ".":
                            cells[j][i] = "K"
            i, j = int(lx // S), int((ly - top) // S)
            if 0 <= j < nrow and 0 <= i < ncol:
                cells[j][i] = "W"
        else:
            # Small: the eye one dark cell, its light the cell before it, so it reads at a glance.
            i, j = int(ex // S), int((ey - top) // S)
            if 0 <= j < nrow and 0 <= i < ncol:
                cells[j][i] = "K"
                if i > 0 and cells[j][i - 1] != ".":
                    cells[j][i - 1] = "W"
    return cells, key, rows_up


# ---- cleaning ---------------------------------------------------------------------

KEEP = set("KWHIuts")          # small things that are meant to be small


def nbrs(c, j, i):
    out = []
    for dj in (-1, 0, 1):
        for di in (-1, 0, 1):
            if dj or di:
                y, x = j + dj, i + di
                if 0 <= y < len(c) and 0 <= x < len(c[0]):
                    out.append(c[y][x])
    return out


def clean(c, passes=2):
    h, w = len(c), len(c[0])
    for _ in range(passes):
        n = [r[:] for r in c]
        for j in range(h):
            for i in range(w):
                k = c[j][i]
                nb = nbrs(c, j, i)
                filled = [x for x in nb if x != "."]
                if k == "." and len(filled) >= 7:
                    n[j][i] = max(set(filled), key=filled.count)
                    continue
                if k == ".":
                    continue
                if len(filled) <= 1:
                    n[j][i] = "."
                    continue
                if k in KEEP:
                    continue
                four = [c[y][x] for y, x in ((j - 1, i), (j + 1, i), (j, i - 1), (j, i + 1)) if 0 <= y < h and 0 <= x < w]
                if k not in four and filled:
                    same_slot = [x for x in filled if INKS[x][1] == INKS[k][1]] or filled
                    n[j][i] = max(set(same_slot), key=same_slot.count)
        c = n
    return c


def folds(rows, ground):
    h = len(rows)
    band = range(max(0, ground - int(ground * 0.32)), max(1, ground - int(ground * 0.08)))
    necks, hips = [], []
    for j in band:
        r = rows[j]
        hs = [i for i, k in enumerate(r) if k != "." and INKS[k][1] == 0]
        ss = [i for i, k in enumerate(r) if k != "." and INKS[k][1] == 2]
        if hs:
            necks.append(min(hs))
        if ss:
            hips.append(max(ss) + 1)
    med = lambda v: sorted(v)[len(v) // 2] if v else None
    # The neck's crease is where most rows' head begins (a fold is straight).
    mode = max(set(necks), key=necks.count) if necks else None
    return {"neck": mode, "hip": med(hips)}


def to_rows(c):
    return ["".join(r) for r in c]


def rle(row):
    out, i = [], 0
    while i < len(row):
        k = row[i]
        n = 1
        while i + n < len(row) and row[i + n] == k:
            n += 1
        out.append((str(n) if n > 1 else "") + k)
        i += n
    return "".join(out)


def main(ref):
    out = {"id": "bison-eagle-slug", "inks": {k: v[0] for k, v in INKS.items()},
           "slots": {k: v[1] for k, v in INKS.items()}, "large": {}, "small": {}}
    prep = {name: prepare(os.path.join(ref, p["src"]), p["g"]) for name, p in POSES.items()}
    for scale, S in (("large", 8), ("small", 21)):
        for name, p in POSES.items():
            cells, key, ground = trace(prep[name], S, p["g"], p["hip"])
            cells = clean(cells)
            out[scale][name] = {"rows": to_rows(cells), "key": [[i, j] for j, r in enumerate(key) for i, v in enumerate(r) if v == 1],
                                "inner": [[i, j] for j, r in enumerate(key) for i, v in enumerate(r) if v == 2],
                                "ground": ground}
        # The folds, where the stand puts them: the neck's where the head's
        # cells begin, the hip's where the slug's end, in the body's middle
        # height; every pose is set so its slug meets the fold there (dx).
        st = out[scale]["stand"]
        out[scale + "Folds"] = folds(st["rows"], st["ground"])
        for name, fr in out[scale].items():
            hip = folds(fr["rows"], fr["ground"])["hip"]
            fr["dx"] = 0 if name in ("rest",) or hip is None else out[scale + "Folds"]["hip"] - hip
    # Rows run-length coded ("12.3B2C": twelve empty, three B, two C), the
    # empty rows above the tallest pose dropped (every pose keeps its ground).
    for scale in ("large", "small"):
        top = min(next((j for j, r in enumerate(fr["rows"]) if r.strip(".")), 0) for fr in out[scale].values())
        top = max(0, top - 2)
        for fr in out[scale].values():
            fr["rows"] = [rle(r) for r in fr["rows"][top:]]
            fr["key"] = [[i, j - top] for i, j in fr["key"] if j >= top]
            fr["inner"] = [[i, j - top] for i, j in fr["inner"] if j >= top]
            fr["ground"] -= top
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w"), separators=(",", ":"))
    print("wrote", OUT, os.path.getsize(OUT))


if __name__ == "__main__":
    main(sys.argv[1])
