#!/usr/bin/env python3
"""Run 3: THE GAME BLOCK under the SURFACE-FILM rule ('face'), against today and run 2's rules.
Scene and views from gameblock.py (ground 2 deep, wall 16x2x6, 1:1 stair, 1:2 slope; player eyes 1.7 m up, 5 m and
30 m). Per face family (x grey / y black / z white, by the face film the ray entered by) the mean and std of the
pixel values: the faces must stay apart (solid) while the unit shows on each (texture)."""
import sys, time
import numpy as np
sys.path.insert(0, '.')
from common import *
import gameblock as G

MODES = [('today', 'none', 'mean', 'today', 1), ('avg+crossing', 'crossing', 'mean', 'avg', 9),
         ('closed+exit', 'exit', 'mean', 'closed', 1),
         ('face', 'face', 'mean', 'face', 2), ('face-self', 'face', 'self', 'face', 2)]
W, Hh, SS = 480, 360, 2


def render(view, film, fcol, mode, stop):
    v = G.VIEWS[view]
    O, D, shape = persp(v['eye'], v['tgt'], W * SS, Hh * SS, f=FOCAL * SS)
    t0 = time.time()
    res = walk_chunked(G.occ, O, D, film=film, film_colour=fcol, K=10, stop_after=stop)
    if mode == 'today':
        res['tests'] = np.minimum(res['tests'], 48)
    bgrgb = background(D, O=O)
    vals = colour(res, mode, np.full(len(O), np.nan))
    cover = np.isfinite(vals)
    img = to_rgb(vals, bgrgb, shape, cover).astype(float)
    img = img.reshape(Hh, SS, W, SS, 3).mean((1, 3)).astype(np.uint8)
    solid = (res['steps'] > 0) & (res['fb'] + (res['k'] == 1).any(1) > 0)
    st = dict(time=round(time.time() - t0, 1),
              see_through=float(((~cover) & solid).sum() / max(solid.sum(), 1)),
              tests_mean=float(res['tests'][solid].mean()), tests_p95=float(np.percentile(res['tests'][solid], 95)),
              blocks_mean=float((res['tests'][solid] / 6).mean()), films_mean=float(res['n'][solid].mean()),
              value_std=float(np.nanstd(np.where(cover, vals, np.nan))))
    # face families: which block face the ray met the solid by (first entry into a filled block from air)
    if film == 'face':
        fam = res['c'][:, 0]
        for t, name in ((128, 'x_grey'), (0, 'y_black'), (255, 'z_white')):
            m = cover & (res['k'][:, 0] == 2) & (fam == t)
            if m.any():
                st['face_' + name] = dict(px_frac=float(m.sum() / cover.sum()), mean=float(vals[m].mean()),
                                          std=float(vals[m].std()))
    return img, st


if __name__ == '__main__':
    stats, rows, labels = {}, [], []
    views = sys.argv[1:] or list(G.VIEWS)
    for view in views:
        r, l = [], []
        for name, film, fcol, mode, stop in MODES:
            img, st = render(view, film, fcol, mode, stop)
            stats[view + ' ' + name] = st
            r.append(img); l.append('%s | %s' % (view, name))
            print(view, name, st, flush=True)
            save(img, 'G3_%s_%s.png' % (view, name.replace('+', '_')))
        rows.append(r); labels.append(l)
    dump(stats, 'gameblock3.json')
    sheet(rows, 'G3_gameblock_sheet.png', labels)
