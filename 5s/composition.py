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
  data/5s/composition.json (git-ignored: numbers derived from the deck's images). Given two examples
  (the artist's pair), it prints what share of deck pairs are closer than they are to each other.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

N = 96            # side of the working square
INSET = 0.04      # trimmed from each side first: frames, scan borders, rounded screenshot corners

NAMES = (
    [f'value {r}{c}' for r in 'tmb' for c in 'lcr']   # value layout: light and dark on a 3x3 grid (thirds), around the mean
    + ['masses',                                       # how strongly it is built of light and dark masses (spread of that grid)
       'key', 'contrast', 'chroma', 'warmth']          # palette: lightness, its spread, colourfulness, how warm the tint is
    + ['edges',                                        # how busy: mean gradient
       'calm ground',                                  # share of the detail in the bottom third (low: a quiet ground)
       'interest height']                              # height of the centre of the detail (0 top, 1 bottom)
    + ['upright', 'level',                             # share of edges that run upright, that run level (high: built, straight)
       'directions',                                   # spread of edge directions over 8 bins (high: curving, every way)
       'laced',                                        # one direction per small patch, at half size (low: crossing, hatched)
       'one way',                                      # one direction over the whole picture, at half size
       'symmetry']                                     # left-right mirror correlation
)
# Weight of each measure in distance(), applied to deck-standardised values. The 3x3 grid counts as
# three measures together; chroma and warmth half each, since a muted render and a painted garden can
# share an earth palette at different strengths.
WEIGHTS = np.array([1 / 3] * 9 + [1, 1, 1, .5, .5] + [1, 1, 1] + [1, 1, 1, 1, 1, 1])


def blocks(a, k):
    """Sum over k x k blocks (a's sides are multiples of k)."""
    n = a.shape[0] // k
    return a.reshape(n, k, n, k).sum(axis=(1, 3))


def gradients(L):
    """Central differences (zero on the border), and orientation as a doubled angle so opposite gradients agree."""
    gx = np.zeros_like(L); gy = np.zeros_like(L)
    gx[:, 1:-1] = L[:, 2:] - L[:, :-2]
    gy[1:-1, :] = L[2:, :] - L[:-2, :]
    return gx * gx + gy * gy, gx * gx - gy * gy, 2 * gx * gy     # energy, energy * cos 2t, energy * sin 2t


def coherence(c, s, e, k):
    """Energy-weighted mean over k x k patches of how much the patch's edges agree in direction (0..1)."""
    return np.hypot(blocks(c, k), blocks(s, k)).sum() / (e.sum() + 1e-9)


def measure(img):
    """A PIL image -> list of floats, one per name in NAMES."""
    w, h = img.size
    i = round(INSET * min(w, h))
    rgb = np.asarray(img.convert('RGB').crop((i, i, w - i, h - i)).resize((N, N), Image.BOX), float) / 255
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    L = 0.299 * r + 0.587 * g + 0.114 * b
    key = L.mean()
    value = blocks(L, N // 3) / (N // 3) ** 2 - key
    chroma = (rgb.max(2) - rgb.min(2)).mean()
    palette = [value.std(), key, L.std(), chroma, (r - b).mean() / (chroma + .02)]

    e, c, s = gradients(L)
    m = np.sqrt(e)
    total = m.sum() + 1e-9
    rows = np.linspace(0, 1, N)[:, None]
    detail = [m.mean(), m[2 * N // 3:].sum() / total, (m * rows).sum() / total]

    t = np.arctan2(s, c)                                   # 0: horizontal gradient, an upright edge
    hist = np.bincount(np.round(t / (np.pi / 4)).astype(int).ravel() % 8, weights=m.ravel(), minlength=8) / total
    spread = -(hist * np.log(hist + 1e-9)).sum() / np.log(8)
    e2, c2, s2 = gradients(blocks(L, 2) / 4)              # half size: brushwork and grain average out
    lines = [hist[0], hist[4], spread, coherence(c2, s2, e2, 4), coherence(c2, s2, e2, N // 2)]

    sym = np.corrcoef(L.ravel(), L[:, ::-1].ravel())[0, 1] if L.std() > 1e-6 else 1.0
    return [float(x) for x in [*value.ravel(), *palette, *detail, *lines, sym]]


def distance(a, b, std):
    """Weighted distance between two measure vectors; std is the deck's spread of each measure."""
    d = (np.asarray(a) - np.asarray(b)) / std
    return float(np.sqrt((WEIGHTS * d * d).sum() / WEIGHTS.sum()))


def check():
    """Pictures whose answers are known."""
    x = np.arange(240)
    stripes = Image.fromarray(np.uint8(np.tile((x // 12 % 2) * 255, (240, 1))))       # upright stripes
    m = dict(zip(NAMES, measure(stripes)))
    assert m['upright'] > .9 and m['level'] < .05 and m['laced'] > .9 and m['one way'] > .9, m
    m = dict(zip(NAMES, measure(stripes.transpose(Image.Transpose.ROTATE_90))))
    assert m['level'] > .9 and m['upright'] < .05 and m['symmetry'] > .99, m
    warm, cool = (dict(zip(NAMES, measure(Image.new('RGB', (100, 100), c)))) for c in ((200, 120, 60), (60, 120, 200)))
    assert warm['warmth'] > .9 > -.9 > cool['warmth'] and warm['edges'] == 0, (warm, cool)


def main(examples):
    check()
    root = Path(__file__).resolve().parent.parent
    deck = json.loads((root / '5s/dist/deck.json').read_text())['cards']
    cards = {c['id']: measure(Image.open(root / '5s/dist' / c['img'])) for c in deck if c.get('img')}
    ex = {Path(p).stem: measure(Image.open(p)) for p in examples}
    v = np.array(list(cards.values()))
    out = {
        'about': 'Composition and feeling of each card image, from 5s/composition.py. distance(): '
                 'sqrt(sum(weight * ((a - b) / std)^2) / sum(weight)).',
        'names': NAMES, 'weights': WEIGHTS.tolist(),
        'std': v.std(0).tolist(),
        'cards': cards, 'examples': ex,
    }
    dest = root / 'data/5s/composition.json'
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, separators=(',', ':')))
    print(f'{len(cards)} cards, {len(ex)} examples -> {dest}')
    if len(ex) >= 2:
        a, b = list(ex.values())[:2]
        z = v / v.std(0)
        d = np.sqrt(((z[:, None] - z[None]) ** 2 * WEIGHTS).sum(-1) / WEIGHTS.sum())[np.triu_indices(len(v), 1)]
        pair = distance(a, b, v.std(0))
        print(f'{" and ".join(list(ex)[:2])}: distance {pair:.3f}, closer than {100 * (d > pair).mean():.2f}% of '
              f'{len(d)} deck pairs (median deck pair {np.median(d):.3f})')


if __name__ == '__main__':
    main(sys.argv[1:])
