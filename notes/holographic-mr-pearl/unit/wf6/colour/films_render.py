import json, math, sys
import numpy as np
from PIL import Image
sys.path.insert(0, '.')
from common import *
from obb import aabb, moved, layers as obb_layers
from films import *

GROUND3D = np.array([0.93, 0.94, 0.95])
P_SUN = unhx('#FCE5AE')                      # the covers' sun glow (wf5 palette, cover 1)
P_BAR = 1 - P_SUN                            # its complement, #031A51
ZENITH = unhx('#061D43')                     # the covers' zenith navy (wf5 palette)


def comp_palette(t):
    """tone t (0 black .. 1 white) -> the complementary pair: t=1 sun glow, t=0 its complement, t=1/2 #808080"""
    t = np.asarray(t, float)[..., None]
    return np.round((P_BAR + t * (P_SUN - P_BAR)) * 255) / 255


def panel(img, title, sub=None, w=None):
    im = to_img(img)
    if w: im = im.resize((w, int(im.height * w / im.width)), Image.LANCZOS)
    label(im, title + ('\n' + sub if sub else ''), sz=14)
    return im


def drawing_sheet():
    ss = 2
    L, O, D = drawing_layers(ss)
    cols = layer_colours(L, D)
    orig = vector_original(ss)
    has = L['n'] >= 1
    meas = json.load(open(OUT + 'films_drawing.json'))['measures']
    otone = np.where(orig >= 0, np.array([128, 0, 255])[np.clip(orig, 0, 2)], 255) / 255.0
    o3 = np.repeat(otone[..., None], 3, -1)
    o3 = outline(o3, orig >= 0, ss, col=(0.3, 0.3, 0.3))
    tiles = [panel(down(o3, ss), 'the original (vector, 13 polygons)')]
    for how, nm in [('opaque', 'opaque straight bars (nearest face)'), ('average', 'FILMS: Colour Middling Average'),
                    ('multiply', 'films: multiply (filters)'), ('add', 'films: add (light)'), ('screen', 'films: screen'),
                    ('golden', 'films: golden lean (1/phi on top)')]:
        m = compose(mix(cols, L['n'], how), np.ones(3))
        m = outline(m, has, ss, col=(0.3, 0.3, 0.3))
        tiles.append(panel(down(m, ss), nm, '|d| %.1f/255 over the figure' % meas[how]['mae_8bit_figure']))
    # the crossings alone, Average, others dimmed
    m = compose(mix(cols, L['n'], 'average'), np.ones(3))
    two = L['n'] >= 2
    dim = np.where(two[..., None], m, 0.82 + 0.18 * m)
    dim = outline(dim, has, ss, col=(0.5, 0.5, 0.5))
    tiles.append(panel(down(dim, ss), 'where two bars cross (%.1f%% of the figure)' % (100 * two.sum() / has.sum()),
                       'new colours: #C0C0C0 (grey over white), #404040 (grey over black),\n#808080 (black over white: the drawing\'s own grey)'))
    g = grid(tiles, 4, pad=6)
    g.save(OUT + 'B1_films_drawing.png'); print('B1', g.size)
    # the same in the complementary colours of the covers' sky
    tiles = []
    for how, nm in [('opaque', 'opaque, complementary pair'), ('average', 'films, Average, complementary pair')]:
        cc = layer_colours(L, D, palette=comp_palette)
        m = compose(mix(cc, L['n'], how), np.ones(3))
        m = outline(m, has, ss, col=(0.3, 0.3, 0.3))
        tiles.append(panel(down(m, ss), nm, 'white -> %s, black -> %s (its complement), grey #808080' % (hx(P_SUN), hx(P_BAR))))
    g = grid(tiles, 2, pad=6); g.save(OUT + 'B1b_films_complement.png'); print('B1b', g.size)


def turned_sheet():
    boxes = unit_boxes()
    allc = np.array([b['c'] for b in boxes]); C0 = (allc.min(0) + allc.max(0)) / 2
    views = [("the drawing's eye", -np.ones(3), np.array([0, -1.0, 1])), ('az 15 el 35', None, (15, 35)), ('az 75 el 35', None, (75, 35)),
             ('az 45 el 70', None, (45, 70)), ('az 200 el -25', None, (200, -25))]
    size, ss, span = 330, 2, 3.6
    rows = {'opaque': [], 'average': [], 'colour': []}
    stats = {}
    for title, d, ang in views:
        if d is None:
            d = -az_el(*ang); up = np.array([0, 0, 1.0])
        else:
            up = ang
        O, Dd = ortho_rays(d, up, C0, span, (size * ss, size * ss))
        Lt = obb_layers(boxes, O, Dd, K=4)
        has = Lt['n'] >= 1
        stats[title] = dict(two=int((Lt['n'] >= 2).sum()) // ss ** 2, three=int((Lt['n'] >= 3).sum()) // ss ** 2)
        for key, how, pal in [('opaque', 'opaque', None), ('average', 'average', None), ('colour', 'average', comp_palette)]:
            cols = layer_colours(Lt, Dd, palette=pal)
            m = compose(mix(cols, Lt['n'], how), GROUND3D)
            m = outline(m, has, ss, col=(0.35, 0.35, 0.35))
            t = panel(down(m, ss), title if key == 'opaque' else '')
            rows[key].append(t)
    names = {'opaque': 'opaque straight bars', 'average': 'films: Average (grey)', 'colour': 'films: Average, complementary pair'}
    tiles = []
    from PIL import ImageDraw
    for key in ('opaque', 'average', 'colour'):
        for i, t in enumerate(rows[key]):
            if i == 0:
                ImageDraw.Draw(t).text((6, t.height - 20), names[key], fill=(40, 40, 40), font=font(13))
            tiles.append(t)
    g = grid(tiles, 5, pad=6); g.save(OUT + 'B2_films_turned.png'); print('B2', g.size, stats)
    return stats


if __name__ == '__main__':
    drawing_sheet()
    st = turned_sheet()
    print('complement of sun glow', hx(P_BAR), 'zenith navy', hx(ZENITH), 'dE_ok %.4f' % np.linalg.norm(oklab(P_BAR) - oklab(ZENITH)),
          'Average(sun, zenith)', '#%02X%02X%02X' % tuple(cm_average([np.round(P_SUN * 255), np.round(ZENITH * 255)])))
