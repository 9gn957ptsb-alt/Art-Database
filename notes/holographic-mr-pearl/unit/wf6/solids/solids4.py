#!/usr/bin/env python3
"""Final renders of the block solids (cube, 1:1 pyramid, sphere at 3, 8, 21 blocks) by walk_face with the texture
unit at its Fibonacci level (smallest F(j) m whose bars are >= 8 px; the full-cell rule): the drawing's eye (pixel
size fixed by the view, so one level per image) and a player's eyes at 5 m and 30 m (level per pixel by distance)."""
import sys, time, json
import numpy as np
sys.path.insert(0, '.')
from common import *
import solids_grid as SG

W, Hh, SS = 420, 315, 2


def shot(occ, O, D, shape, tex, paper):
    r = walk_face(occ, O, D, tex=tex)
    vals = r['val']; cover = np.isfinite(vals)
    bgrgb = np.tile(np.array([240.0, 236, 228]), (len(D), 1)) if paper else background(D, O=O)
    img = to_rgb(vals, bgrgb, shape, cover).astype(float)
    h, w = shape
    img = img.reshape(h // SS, SS, w // SS, SS, 3).mean((1, 3)).astype(np.uint8)
    ss = r['s'][cover]
    return img, {str(int(k)): round(float((ss == k).mean()), 3) for k in np.unique(ss)}


if __name__ == '__main__':
    MAKE = {'cube': SG.cube, 'pyramid': SG.pyramid, 'sphere': SG.sphere}
    out = {}
    for name in sys.argv[1:] or ['cube', 'pyramid', 'sphere']:
        rows, labels = [], []
        for n in (3, 8, 21):
            occ, ideal = MAKE[name](n)
            lo, hi = np.zeros(3), np.array(occ.shape, float)
            c = (lo + hi) / 2
            span = 1.25 * np.linalg.norm(hi - lo) * 0.82
            O, D, shape, px = drawing_view(c, span, W * SS, Hh * SS)
            pxw = span / Hh                                     # world metres per final pixel
            s_draw = float(tex_level(np.array([8.0 * pxw / 0.1 * FOCAL / 8.0 * 8 / 8]), FOCAL)[0]) if False else \
                float(FIBS_M[np.searchsorted(FIBS_M, 8.0 * pxw / 0.1)])
            r, l, lv = [], [], {}
            img, lv['drawing'] = shot(occ, O, D, shape, s_draw, True)
            r.append(img); l.append('%s %d drawing, texture F=%d m' % (name, n, s_draw))
            for dist in (5, 30):
                (O, D, shape), eye = player(None, lo, hi, dist, W * SS, Hh * SS, f=FOCAL * SS)
                img, lv['p%d' % dist] = shot(occ, O, D, shape, lambda t: tex_level(t, FOCAL), False)
                r.append(img); l.append('%s %d player %d m, texture by distance' % (name, n, dist))
            for im, lab in zip(r, l):
                save(im, 'S4_%s_%d_%s.png' % (name, n, lab.split(' ')[2].rstrip(',') + ('' if 'drawing' in lab else lab.split(' ')[3])))
            rows.append(r); labels.append(l)
            out['%s %d' % (name, n)] = dict(drawing_texture_m=s_draw, texture_level_px_frac=lv)
            print(name, n, out['%s %d' % (name, n)], flush=True)
        sheet(rows, 'S4_%s_sheet.png' % name, labels)
    prev = {}
    try:
        prev = json.load(open('solids4.json'))
    except Exception:
        pass
    prev.update(out); dump(prev, 'solids4.json')
