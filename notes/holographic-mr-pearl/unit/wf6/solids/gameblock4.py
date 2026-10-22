#!/usr/bin/env python3
"""Run 3 final: THE GAME BLOCK by walk_face (surface film + the texture unit's bars tested once), at the player's
height, the texture unit at 1 m ('face1'), by the Fibonacci LOD ('faceLOD': the smallest F(j) m whose bars are
>= 8 px), and the far face alone ('far': round((T_a + m(v))/2), no bars: what the old close gives past 16.6 m).
Scene: gameblock.py (ground 2 deep, wall 16x2x6, 1:1 stair, 1:2 slope), plus a far view from ~110 m."""
import sys, time
import numpy as np
sys.path.insert(0, '.')
from common import *
import gameblock as G

G.VIEWS['far110'] = dict(eye=(-70.0, -35.0, G.GROUND_TOP + 1.7), tgt=(30.0, 55.0, 4.0))
W, Hh, SS = 480, 360, 2
KINDS = sys.argv[1:] or ['face1', 'faceLOD', 'far']
FPX = FOCAL                     # the final image's focal (phone: 422 px half-height / tan 35)
# extend the ground for the far view so the horizon is land
occ = np.zeros((140, 160, 14), bool)
OFF = np.array([-80, -60, 0])
occ[80:140, 60:140, :] = G.occ
occ[:, :, 0:2] = True


def render(view, kind):
    v = G.VIEWS[view]
    O, D, shape = persp(v['eye'], v['tgt'], W * SS, Hh * SS, f=FOCAL * SS)
    t0 = time.time()
    if kind == 'face1':
        tex = 1.0
    elif kind == 'faceLOD':
        tex = lambda t: tex_level(t, FPX)
    else:
        tex = 1.0
    r = walk_face(occ, O, D, origin=OFF, tex=tex)
    vals = r['val'].copy()
    if kind == 'far':
        vals = np.where(np.isfinite(r['t']), np.floor((r['face'] + np.floor(mean_tone(-D) + 0.5)) / 2 + 0.5), np.nan)
    cover = np.isfinite(vals)
    bgrgb = background(D, O=O)
    img = to_rgb(vals, bgrgb, shape, cover).astype(float)
    img = img.reshape(Hh, SS, W, SS, 3).mean((1, 3)).astype(np.uint8)
    st = dict(time=round(time.time() - t0, 1), tests_mean=float(r['tests'][cover].mean()),
              steps_mean=float(r['steps'][cover].mean()), value_std=float(vals[cover].std()))
    for tval, name in ((128, 'x_grey'), (0, 'y_black'), (255, 'z_white')):
        m = cover & (r['face'] == tval)
        if m.sum() > 50:
            st['face_' + name] = dict(px_frac=round(float(m.sum() / cover.sum()), 4), mean=round(float(vals[m].mean()), 1),
                                      std=round(float(vals[m].std()), 1))
    if kind == 'faceLOD':
        ss = r['s'][cover]
        st['tex_levels_px_frac'] = {str(int(k)): round(float((ss == k).mean()), 4) for k in np.unique(ss)}
        st['dist_range_m'] = [round(float(np.percentile(r['t'][cover], 1)), 1), round(float(np.percentile(r['t'][cover], 99)), 1)]
    return img, st


if __name__ == '__main__':
    stats, rows, labels = {}, [], []
    for view in ['wall5', 'wall30', 'slope5', 'slope30', 'far110']:
        r, l = [], []
        for kind in KINDS:
            img, st = render(view, kind)
            stats[view + ' ' + kind] = st
            print(view, kind, st, flush=True)
            save(img, 'G4_%s_%s.png' % (view, kind))
            r.append(img); l.append('%s | %s' % (view, kind))
        rows.append(r); labels.append(l)
    dump(stats, 'gameblock4_%s.json' % '_'.join(KINDS))
    sheet(rows, 'G4_gameblock_sheet_%s.png' % '_'.join(KINDS), labels)
