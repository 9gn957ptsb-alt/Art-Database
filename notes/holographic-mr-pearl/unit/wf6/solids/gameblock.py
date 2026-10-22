#!/usr/bin/env python3
"""THE GAME BLOCK: a patch of the game's world (ground 2 blocks deep, a wall 16 x 2 x 6, a 1:1 stair and a 1:2 slope)
seen from a player's eyes (1.7 m over the ground) at 5 m and 30 m, under the block rules:
  today          rocket.js now: the first bar; 8 filled blocks with none -> dark; air -> what lies behind
  avg+crossing   wf6/colour: every bar a film, a block film where a ray crosses filled -> filled, UnitStack Average
  closed+crossing  opaque: the first of (bar, block film at a filled -> filled crossing)
  closed+exit    opaque: the first of (bar, the film where the ray leaves any filled block)
  avg+exit       Average over bars and exit films
Film colour 'mean' = sum|v_i| tone_i / sum|v_i| (unitBulk) or 'face' = the tone of the face the film lies on.
Renders are supersampled ss x ss (the mean the LOD closes into, computed rather than tabled)."""
import sys, math, time
import numpy as np
sys.path.insert(0, '.')
from common import *

GX, GY, GZ = 60, 80, 14
occ = np.zeros((GX, GY, GZ), bool)
occ[:, :, 0:2] = True                                  # the ground, two blocks deep (top at z = 2)
occ[6:22, 50:52, 2:8] = True                          # a wall 16 long, 2 thick, 6 high
for i in range(10):                                   # a 1:1 stair rising in y
    occ[30:40, 50 + i:51 + i, 2:3 + i] = True
    occ[30:40, 50 + i:, 2:3 + i] = True
for j in range(20):                                   # a 1:2 slope beside it
    occ[42:56, 50 + j:, 2:2 + (j + 1) // 2] = True
occ_wall_only = occ.copy()

GROUND_TOP = 2.0
# a player 5 m and 30 m from the wall's face (off its normal, so two faces and the ground show), and before the
# foot of the stair and the slope
VIEWS = {
    'wall5': dict(eye=(9.0, 45.0, GROUND_TOP + 1.7), tgt=(15.0, 50.0, 4.6)),
    'wall30': dict(eye=(-6.0, 20.0, GROUND_TOP + 1.7), tgt=(14.0, 50.0, 4.0)),
    'slope5': dict(eye=(44.0, 45.0, GROUND_TOP + 1.7), tgt=(42.0, 55.0, 5.5)),
    'slope30': dict(eye=(48.0, 20.0, GROUND_TOP + 1.7), tgt=(42.0, 56.0, 5.5)),
}
MODES = [('today', 'none', 'mean', 'today'), ('avg+crossing', 'crossing', 'mean', 'avg'),
         ('closed+crossing', 'crossing', 'mean', 'closed'), ('closed+exit', 'exit', 'mean', 'closed'),
         ('avg+exit', 'exit', 'mean', 'avg')]
W, Hh, SS = 480, 360, 2


def render(view, film, fcol, mode, ss=SS):
    v = VIEWS[view]
    (O, D, shape) = persp(v['eye'], v['tgt'], W * ss, Hh * ss, f=FOCAL * ss * (Hh / Hh))
    t0 = time.time()
    stop = 9 if mode == 'avg' else 1           # the walk ends at the first film when films are opaque
    res = walk_chunked(occ, O, D, film=film, film_colour=fcol, K=10, stop_after=stop)
    if mode == 'today':
        res['tests'] = np.minimum(res['tests'], 48)   # rocket.js STEPS = 8 blocks of 6 bars
    bgrgb = background(D, O=O)
    bgv = np.full(len(O), np.nan)
    vals = colour(res, mode, bgv)
    cover = np.isfinite(vals)
    img = to_rgb(vals, bgrgb, shape, cover).astype(float)
    img = img.reshape(Hh, ss, W, ss, 3).mean((1, 3)).astype(np.uint8)
    # stats at 1 sample per pixel on the solid: rays that entered a filled block
    entered = res['steps'] > 0
    solid_rays = entered & (res['fb'] + (res['k'] == 1).any(1) > 0)
    st = dict(time=time.time() - t0,
              see_through=float(((~cover) & solid_rays).sum() / max(solid_rays.sum(), 1)),
              tests_mean=float(res['tests'][solid_rays].mean()), tests_p95=float(np.percentile(res['tests'][solid_rays], 95)),
              blocks_mean=float((res['tests'][solid_rays] / 6).mean()),
              films_mean=float(res['n'][solid_rays].mean()))
    return img, st, vals.reshape(Hh * ss, W * ss), cover.reshape(Hh * ss, W * ss)


if __name__ == '__main__':
    stats = {}
    rows, labels = [], []
    for view in VIEWS:
        r, l = [], []
        for name, film, fcol, mode in MODES:
            img, st, vals, cover = render(view, film, fcol, mode)
            # texture: std of the solid's values at full resolution within 'cover' (bars + films)
            st['value_std'] = float(np.nanstd(np.where(cover, vals, np.nan)))
            stats[view + ' ' + name] = st
            r.append(img); l.append('%s | %s' % (view, name))
            print(view, name, {k: round(v, 3) for k, v in st.items()})
            save(img, 'G_%s_%s.png' % (view, name.replace(' ', '_').replace('+', '_')))
        rows.append(r); labels.append(l)
    dump(stats, 'gameblock.json')
    sheet(rows, 'G0_gameblock_sheet.png', labels)
