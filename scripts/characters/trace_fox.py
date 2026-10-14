"""The red fox after Cy Twombly, drawn fine: traced from the artist's own graphic.

The artist, 14 Oct 2026, sending a pixel fox on a dark ground with chalk loops
and lavender squares ("Here is an improved graphic for the fox that represents
Cy Twombly"). His graphic is the fox's look; the other poses the page reads
(a trot in four frames, a stand in profile, a look back over the shoulder, a
sit) were made as edits of it with OpenAI's gpt-image-2.5 — one design, every
pose an edit of it, so all stay in register — and kept out of the repository.
This script traces them down to the sprite's grid, as `canonical.py` traces the
chimera, and to the fox's own inks:

    python3 scripts/characters/trace_fox.py REF_DIR

REF_DIR holds `look.png` (the artist's graphic, the fox alone on its flat
ground), `stand.png`, `trot0.png` … `trot3.png`, `back.png`, `sit.png`. It
writes scripts/characters/fox_fine.json: the poses as rows of letters (the
same letters as every character: d R r g the coat, W w the white, k K the dark,
y the eye, o p the chalk outline), the grid, the inks measured off the graphic
and the eyes' places. The references never enter the repository; the cells this
derives from them do. build_characters.py never runs this (it needs the
references); run it again only to redraw. `fox.py` reads fox_fine.json.

How a pose is traced: the fox is the pixels that are not the flat ground; each
cell of the grid takes the mean colour of the fox's pixels in it where they
cover it by half or more, and then the nearest of the inks in Lab; the cell
grid is placed so the feet stand on the ground row and the walkers' ears sit
where the others' do (a trot does not shuffle); the outline is the chalk
outline every character has (rigs.paint), a cell of `o`/`p` round the figure;
the eyes are set by hand (EYES), the nose and the dark rims come with the
colours.
"""

import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import hands  # noqa: E402  (lab, rgb: the colour maths every hand uses)

OUT = os.path.join(HERE, "fox_fine.json")

W, H = 112, 90               # the sprite's grid, in cells; one CSS px a cell
PXC = 9.2                     # source pixels (of a 1024 picture) to a cell: about the graphic's own pixel
CELL = 1
SMOOTH_SELF = 2.0                # the weight of a cell's own colour against its four neighbours' (1 each)

# The fox's inks, measured off the artist's graphic (k-means in Lab over every pose, 14 Oct 2026), by letter.
INKS = {
    "d": "#8b3525", "R": "#b64626", "r": "#d0652b", "g": "#e18238",      # the coat, deepest to lightest
    "W": "#dcae82", "w": "#efd0b0",                                       # the white: the cream in shade, the cream lit
    "k": "#3b2025", "K": "#5a2e2c",                                       # the dark: the nose and the ears' backs, the legs' brown
    "y": "#e8a030",                                                       # the eye
    "o": "#8d7a7c", "p": "#4a2a2c",                                       # the chalk outline, and the warm grey the graphic shades its cream with
}
SHADE = "o"                    # the cool grey the graphic shades its cream with is the chalk's own

POSES = {                      # name -> (file, source scale to a 1024 picture, kind)
    "stand": ("stand.png", 1.0, "walker"),
    "trot0": ("trot0.png", 1.0, "walker"),
    "trot1": ("trot1.png", 1.0, "walker"),
    "trot2": ("trot2.png", 1.0, "walker"),
    "trot3": ("trot3.png", 1.0, "walker"),
    "back": ("back.png", 1.0, "walker"),
    "look": ("look.png", 1024 / 1254.0, "still"),
    "sit": ("sit.png", 1.0, "still"),
}

# Where each eye is, by hand, in the pixels of its own reference picture (x, y): set by looking at the reference
# (its middle, read off the picture). An eye is one cell of `y` set in its dark rim.
EYES = {
    "stand": [(845, 358)],
    "trot0": [(891, 413)], "trot1": [(891, 388)], "trot2": [(892, 412)], "trot3": [(893, 387)],
    "back": [(662, 339)],
    "look": [(845, 421), (928, 421)],
    "sit": [(571, 311), (648, 311)],
}


def lab_of(rgb):
    return hands.lab(tuple(rgb))


LETTER_LAB = {k: lab_of(hands.rgb(v)) for k, v in INKS.items() if k not in "op"}
LETTER_LAB["o"] = lab_of(hands.rgb("#7d6c6e"))          # as a shade, the chalk is a little darker than as an outline


def nearest(rgb):
    t = lab_of(rgb)
    best, bd = None, 1e18
    for k, c in LETTER_LAB.items():
        if k == "y":
            continue
        d = (t[0] - c[0]) ** 2 * 1.0 + (t[1] - c[1]) ** 2 + (t[2] - c[2]) ** 2
        if d < bd:
            best, bd = k, d
    return best


def foreground(a):
    """The pixels that are the fox: not the flat ground (the picture's background is clean to within a few levels, so the fox's
    darkest browns count), with the small holes of its darkest marks (a pupil, a nostril) filled."""
    b = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3), a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    bg = np.median(b, axis=0)
    d = np.abs(a - bg).sum(axis=2)
    m = d > 14
    m = ndimage.binary_opening(m, iterations=1)
    lab, k = ndimage.label(ndimage.binary_closing(m, iterations=2))
    if k == 0:
        return m
    sizes = ndimage.sum(m, lab, range(1, k + 1))
    keep = [i + 1 for i, s in enumerate(sizes) if s > 200]
    m = np.isin(lab, keep) & m
    holes = ndimage.binary_fill_holes(m) & ~m
    hl, hk = ndimage.label(holes)
    if hk:
        hs = ndimage.sum(holes, hl, range(1, hk + 1))
        small = [i + 1 for i, s in enumerate(hs) if s < 800]
        m = m | np.isin(hl, small)
    return m


LETTERS = [k for k in LETTER_LAB if k != "y"]
LAB_ARR = np.array([LETTER_LAB[k] for k in LETTERS])
FEATURE = {"k", "K"}           # the dark that is the nose, the rims and the ears' backs: kept when it holds a quarter of a cell


def to_lab(a):
    """sRGB (an array of ... x 3, 0-255) to Lab, as hands.lab does one colour."""
    c = a / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16 / 116)
    fx, fy, fz = f(x), f(y), f(z)
    return np.stack([116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)], axis=-1)


def letters_of(a, m):
    """Every pixel of the picture that is the fox, as the index of the ink nearest it."""
    lab = to_lab(a)
    d = ((lab[..., None, :] - LAB_ARR[None, None, :, :]) ** 2).sum(axis=-1)
    idx = d.argmin(axis=-1)
    return np.where(m, idx, -1)


def trace(path, scale, kind, ear_col=None):
    """One pose: rows of letters on the fox's own cells, where its ear tip was, and the cells' origin in the picture."""
    a = np.array(Image.open(path).convert("RGB")).astype(float)
    m = foreground(a)
    ys, xs = np.where(m)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    pxc = PXC / scale                                   # source pixels a cell, in this picture
    ncw = int(np.ceil((x1 - x0 + 1) / pxc)) + 1
    nch = int(np.ceil((y1 - y0 + 1) / pxc)) + 1
    idx = letters_of(a, m)
    cells = [["."] * ncw for _ in range(nch)]
    for j in range(nch):
        for i in range(ncw):
            ya, yb = int(y0 + j * pxc), int(min(a.shape[0], y0 + (j + 1) * pxc))
            xa, xb = int(x0 + i * pxc), int(min(a.shape[1], x0 + (i + 1) * pxc))
            blk = idx[ya:yb, xa:xb]
            if blk.size == 0:
                continue
            fg = blk[blk >= 0]
            if len(fg) < 0.5 * blk.size:
                continue
            votes = np.bincount(fg, minlength=len(LETTERS))
            dark = sum(votes[LETTERS.index(k)] for k in FEATURE)
            if dark >= 0.25 * len(fg):
                pick = max(FEATURE, key=lambda k: votes[LETTERS.index(k)])
            else:
                pick = LETTERS[int(votes.argmax())]
            cells[j][i] = pick
    top = next(j for j in range(nch) if any(c != "." for c in cells[j]))
    ear = max(i for i, c in enumerate(cells[top]) if c != ".")
    return cells, (x0, y0, pxc), ear, top


def tidy(cells):
    """Loose single cells off the figure's edge are dropped; pinholes inside it filled with their neighbours'."""
    h, w = len(cells), len(cells[0])
    out = [r[:] for r in cells]
    for j in range(h):
        for i in range(w):
            n = [cells[j + dj][i + di] if 0 <= j + dj < h and 0 <= i + di < w else "." for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            filled = [c for c in n if c != "."]
            if cells[j][i] != "." and len(filled) == 0:
                out[j][i] = "."
            elif cells[j][i] == "." and len(filled) >= 3:
                out[j][i] = max(set(filled), key=filled.count)
    return out


def place(cells, ear, kind, ear_col):
    """The traced figure on the sprite's grid: feet on the ground row; a walker's ear tip on `ear_col`, a still one's middle in the middle."""
    h, w = len(cells), len(cells[0])
    rows = [["."] * W for _ in range(H)]
    ground = H - 2
    # the lowest filled row stands on the ground
    low = max(j for j in range(h) if any(c != "." for c in cells[j]))
    dy = ground - low
    if kind == "walker":
        dx = ear_col - ear
    else:
        fi = [i for i in range(w) if any(cells[j][i] != "." for j in range(h))]
        dx = W // 2 - (min(fi) + max(fi)) // 2
    for j in range(h):
        for i in range(w):
            c = cells[j][i]
            if c == ".":
                continue
            jj, ii = j + dy, i + dx
            if 0 <= jj < H and 0 <= ii < W:
                rows[jj][ii] = c
            else:
                print("  cell off the grid:", ii, jj)
    return rows


def outline(rows):
    """The chalk outline every character has: a cell of `p` on the figure's lit side (up and left), `o` on the other."""
    h, w = len(rows), len(rows[0])
    out = [r[:] for r in rows]
    for j in range(h):
        for i in range(w):
            if rows[j][i] != ".":
                continue
            lit, near = 0, False
            for di, dj, k in ((1, 0, 1), (0, 1, 1), (-1, 0, -1), (0, -1, -1)):
                a, b = i + di, j + dj
                if 0 <= a < w and 0 <= b < h and rows[b][a] != ".":
                    near = True
                    lit += k
            if near:
                out[j][i] = "p" if lit > 0 else "o"
    return out


def run(ref_dir):
    traced = {}
    for name, (fn, scale, kind) in POSES.items():
        cells, (x0, y0, pxc), ear, top = trace(os.path.join(ref_dir, fn), scale, kind)
        cells = tidy(cells)
        for (ex, ey) in EYES.get(name, []):                 # the eyes, by hand, in the reference's own pixels
            i, j = int((ex - x0) / pxc), int((ey - y0) / pxc)
            if 0 <= j < len(cells) and 0 <= i < len(cells[0]):
                cells[j][i] = "y"
            else:
                print("  eye off the figure:", name, ex, ey)
        traced[name] = (cells, ear, kind)
    # the walkers' ears all on one column: the one that keeps every figure on the grid, centred
    spans = []
    for name, (cells, ear, kind) in traced.items():
        if kind != "walker":
            continue
        fi = [i for i in range(len(cells[0])) if any(cells[j][i] != "." for j in range(len(cells)))]
        spans.append((ear - min(fi), max(fi) - ear))
    left = max(s[0] for s in spans)
    right = max(s[1] for s in spans)
    ear_col = (W - (left + right + 1)) // 2 + left
    poses = {}
    for name, (cells, ear, kind) in traced.items():
        rows = place(cells, ear, kind, ear_col)
        poses[name] = ["".join(r) for r in outline(rows)]
    return poses


def main():
    ref = sys.argv[1]
    poses = run(ref)
    out = {"w": W, "h": H, "cell": CELL, "foot": [W // 2, round(H - 1.4, 1)], "inks": INKS, "poses": poses,
           "trot": ["trot0", "trot1", "trot2", "trot3"]}
    with open(OUT, "w") as f:
        json.dump(out, f, indent=0, separators=(",", ":"))
        f.write("\n")
    print("wrote", OUT, os.path.getsize(OUT), "bytes")


if __name__ == "__main__":
    main()
