#!/usr/bin/env python3
"""Composition and feeling of a picture, as a small vector of numbers.

The artist, 23 Oct 2026 (CONCEPT.md), over a render from Holographic Mr Pearl beside van Gogh's trees
in the garden of Saint-Paul Hospital: "These are the type of juxtapositions I want to find in the Set
game ... Notice the similarities in their composition and overall feeling". measure() turns a picture
into the numbers such a pair shares; distance() says how alike two pictures are.

Everything is plain arithmetic on a 96 x 96 copy of the picture (box-averaged), so the browser can do
the same on a canvas later: draw the card to a 96 x 96 canvas, getImageData, and repeat the steps.

Usage:  python3 5s/composition.py [example.png ...]
  measures every card image of 5s/dist/deck.json and any example pictures named, and writes
  data/5s/composition.json (git-ignored: numbers derived from the deck's images).
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

N = 96            # side of the working square
INSET = 0.04      # trimmed from each side first: frames, scan borders, rounded screenshot corners

NAMES = (
    [f'value {r}{c}' for r in 'tmb' for c in 'lcr']        # value layout: light/dark on a 3x3 grid, around the mean
    + ['key', 'contrast', 'chroma', 'warmth']               # palette
    + ['edges']                                             # how busy (mean gradient)
    + [f'detail {r}{c}' for r in 'tmb' for c in 'lcr']     # where the detail sits: share of edge energy per cell
    + ['upright', 'level', 'diag /', 'diag \\']             # line directions: share of edge energy per orientation
    + ['coherence', 'straightness']                         # one direction per patch (low = laced, crossing); does it hold at a larger scale (high = straight, low = curved)
    + ['symmetry', 'figure']                                # left-right mirror; a small dark spot low in the middle
)
# Weight of each measure in distance(), applied to deck-standardised values. Groups, not single numbers,
# are weighted: the 3x3 grids count as much together as one palette or line measure does.
WEIGHTS = np.array(
    [1.0] * 9
    + [1.0, 1.0, 1.0, 1.0]
    + [1.0]
    + [1.0] * 9
    + [1.0] * 4
    + [1.0, 1.0]
    + [1.0, 1.0]
)


def blocks(a, k):
    """Sum over k x k blocks (a's sides are multiples of k)."""
    n = a.shape[0] // k
    return a.reshape(n, k, n, k).sum(axis=(1, 3))


def box(a, r):
    """Mean over a (2r+1)-square around each pixel, edges clamped (an integral image in the browser)."""
    p = np.pad(a, r, mode='edge').cumsum(0).cumsum(1)
    p = np.pad(p, ((1, 0), (1, 0)))
    k = 2 * r + 1
    return (p[k:, k:] - p[:-k, k:] - p[k:, :-k] + p[:-k, :-k]) / (k * k)


def measure(img):
    """A PIL image -> list of floats, one per name in NAMES."""
    w, h = img.size
    i = round(INSET * min(w, h))
    rgb = np.asarray(img.convert('RGB').crop((i, i, w - i, h - i)).resize((N, N), Image.BOX), float) / 255
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    L = 0.299 * r + 0.587 * g + 0.114 * b
    key = L.mean()

    value = (blocks(L, N // 3) / (N // 3) ** 2 - key).ravel()
    palette = [key, L.std(), (rgb.max(2) - rgb.min(2)).mean(), (r - b).mean()]

    gx = np.zeros_like(L); gy = np.zeros_like(L)
    gx[:, 1:-1] = L[:, 2:] - L[:, :-2]
    gy[1:-1, :] = L[2:, :] - L[:-2, :]
    e2 = gx * gx + gy * gy
    m = np.sqrt(e2)
    total = m.sum() + 1e-9
    detail = (blocks(m, N // 3) / total).ravel()

    # orientation as a doubled angle, so opposite gradients agree: c = cos 2t, s = sin 2t (times energy)
    c, s = gx * gx - gy * gy, 2 * gx * gy
    t = np.arctan2(s, c)                         # 0: horizontal gradient = an upright edge
    bins = np.round(t / (np.pi / 2)).astype(int) % 4   # 0 upright, 1 diag, 2 level, 3 other diag
    lines = [m[bins == k].sum() / total for k in (0, 2, 1, 3)]

    def coherence(k):
        cb, sb, eb = blocks(c, k), blocks(s, k), blocks(e2, k)
        return (np.hypot(cb, sb).sum()) / (eb.sum() + 1e-9)   # energy-weighted mean of |sum c,s| / sum e
    small, large = coherence(8), coherence(24)
    strokes = [small, large / (small + 1e-9)]

    sym = np.corrcoef(L.ravel(), L[:, ::-1].ravel())[0, 1] if L.std() > 1e-6 else 1.0
    spot = box(L, 7) - box(L, 1)                  # darker than its surround
    fig = spot[int(.6 * N):int(.97 * N), int(.25 * N):int(.75 * N)].max()
    return [float(x) for x in [*value, *palette, m.mean(), *detail, *lines, *strokes, sym, fig]]


def distance(a, b, std):
    """Weighted distance between two measure vectors; std is the deck's spread of each measure."""
    d = (np.asarray(a) - np.asarray(b)) / std
    return float(np.sqrt((WEIGHTS * d * d).sum() / WEIGHTS.sum()))


def main(examples):
    root = Path(__file__).resolve().parent.parent
    deck = json.loads((root / '5s/dist/deck.json').read_text())['cards']
    cards = {c['id']: measure(Image.open(root / '5s/dist' / c['img'])) for c in deck if c.get('img')}
    ex = {Path(p).stem: measure(Image.open(p)) for p in examples}
    v = np.array(list(cards.values()))
    out = {
        'about': 'Composition and feeling of each card image, from 5s/composition.py. distance(): '
                 'sqrt(sum(weight * ((a - b) / std)^2) / sum(weight)).',
        'names': NAMES, 'weights': WEIGHTS.tolist(),
        'mean': v.mean(0).tolist(), 'std': v.std(0).tolist(),
        'cards': cards, 'examples': ex,
    }
    dest = root / 'data/5s/composition.json'
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, separators=(',', ':')))
    print(f'{len(cards)} cards, {len(ex)} examples -> {dest}')


if __name__ == '__main__':
    main(sys.argv[1:])
