"""(b) where golden copies overlap: the unit (golden bar, 6H = 1/phi) with copies of itself, as films under the
recursive Average; the half-turned centre copy has faces off the axes, so the tone rule (VS) colours them."""
import json, math, sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, '.')
from common import *
from obb import aabb, moved, layers as obb_layers
from films import *

HG = 1 / PHI / 6
NH = np.ones(3) / math.sqrt(3)
R180 = 2 * np.outer(NH, NH) - np.eye(3)
GROUND3D = np.array([0.93, 0.94, 0.95])
HOLES = {'A': np.mean([(0, 0, 0), (0, 1, 0), (1, 1, 0)], 0), 'B': np.mean([(-1, 1, -1), (0, 1, -1), (0, 1, 0)], 0),
         'C': np.mean([(0, 1, -1), (1, 1, -1), (1, 1, 0)], 0)}


def golden_unit(level=0, tag=''):
    return unit_boxes(HG, 'model', level, tag)


def holes_config(depth=0.0):
    """the unit, and copies at phi^-4 in its four holes (the inverted centre turned a half about the line of sight)"""
    B = golden_unit(0, 'L0 ')
    s = PHI ** -4
    for nm, hc in HOLES.items():
        B += [moved(b, np.eye(3), s, hc - CENTRE + depth * NH, CENTRE, level=1, tag='L1%s ' % nm) for b in golden_unit()]
    B += [moved(b, R180, s, depth * NH, CENTRE, level=1, tag='L1o ') for b in golden_unit()]
    return B


def laid_config(levels=2, lift=0.9):
    """copies at 1/phi^k concentric with the unit in the drawing, each level lifted towards the eye"""
    B = []
    for k in range(levels + 1):
        B += [moved(b, np.eye(3), PHI ** -k, k * lift * NH, CENTRE, level=k, tag='L%d ' % k) for b in golden_unit()]
    return B


def owners(B):
    return [int(b['name'][1]) * 10 + ('ABCo '.index(b['name'][2]) if b['name'][2] in 'ABCo' else 0) for b in B]


def render(B, d, up, centre, span, size=420, ss=2, how='recursive', K=6, owner=None, ground=GROUND3D):
    O, D = ortho_rays(d, up, centre, span, (size * ss, size * ss))
    L = obb_layers(B, O, D, K=K, owner=owner)
    cols = layer_colours(L, D)
    m = mix(cols, L['n'], how)
    img = compose(m, ground)
    img = outline(img, L['n'] >= 1, ss, col=(0.35, 0.35, 0.35))
    return down(img, ss), L, m


def palette_of(m, n, minpx=300):
    v = np.round(m[n >= 1] * 255).astype(int)
    keys, cnt = np.unique(v[:, 0], return_counts=True)
    return [(int(k), int(c)) for k, c in zip(keys, cnt) if c >= minpx]


if __name__ == '__main__':
    out = {}
    tiles = []
    for cname, B in [('holes', holes_config()), ('laid', laid_config(2))]:
        own = owners(B)
        allc = np.array([b['c'] for b in B]); C0 = (allc.min(0) + allc.max(0)) / 2
        for title, d, up, centre, span in [("the drawing's eye", -np.ones(3), np.array([0, -1.0, 1]), CENTRE, 3.0),
                                           ('turned az 15 el 30', -az_el(15, 30), np.array([0, 0, 1.0]), C0, 4.2),
                                           ('turned az 80 el 20', -az_el(80, 20), np.array([0, 0, 1.0]), C0, 4.2)]:
            img, L, m = render(B, d, up, centre, span, owner=own)
            pal = palette_of(m, L['n'])
            out['%s / %s' % (cname, title)] = dict(colours=['#%02X%02X%02X x %d px' % (k, k, k, c // 4) for k, c in pal],
                                                    max_layers=int(L['n_all'].max()))
            t = to_img(img); label(t, '%s: %s\n%d greys formed: %s' % (cname, title, len(pal), ' '.join('%d' % k for k, c in pal)), sz=12)
            tiles.append(t)
            print(cname, title, 'layers max', int(L['n_all'].max()), 'colours', [k for k, c in pal])
    g = grid(tiles, 3, pad=6)
    g.save(OUT + 'B3_golden_films.png'); print(g.size)
    json.dump(out, open(OUT + 'golden_films.json', 'w'), indent=1)
