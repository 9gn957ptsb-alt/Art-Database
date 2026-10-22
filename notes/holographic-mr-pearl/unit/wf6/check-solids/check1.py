#!/usr/bin/env python3
"""check-solids 1: today's game WITH its lod (rocket.js: lod = smoothstep(.0125,.0275,uPx*dist); res==2 discards only
if lod < .5; lod >= 1 -> col = far, no walk), on the gameblock scene; and the face rule's palette on player views."""
import sys, json, time
import numpy as np
SOL = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/solids'
sys.path.insert(0, SOL)
import os; os.chdir(SOL)
from common import *
import gameblock as G
OUT = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/check-solids/'

def ss(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)

W, H = 480, 360
res = {}
for view in G.VIEWS:
    v = G.VIEWS[view]
    O, D, shape = persp(v['eye'], v['tgt'], W, H, f=FOCAL)
    rt = walk_chunked(G.occ, O, D, film='none', K=10, stop_after=1)
    rf = walk_chunked(G.occ, O, D, film='face', K=4, stop_after=2)
    tent = np.where(rf['n'] > 0, rf['t'][:, 0], np.inf)
    vt = colour(rt, 'today', np.full(len(O), np.nan)); covt = np.isfinite(vt)
    vf = colour(rf, 'face', np.full(len(O), np.nan)); covf = np.isfinite(vf)
    solid = np.isfinite(tent)
    lod = ss(0.0125, 0.0275, tent / FOCAL)
    tests_t = np.minimum(rt['tests'], 48)
    see_nolod = solid & ~covt
    see_lod = see_nolod & (lod < 0.5)
    tests_lod = np.where(lod >= 1, 0, tests_t)
    vals, cnt = np.unique(vf[covf], return_counts=True)
    top = sorted(zip(cnt, vals), reverse=True)
    res[view] = dict(solid_px=int(solid.sum()),
                     frac_lod_ge_1=float((lod[solid] >= 1).mean()), frac_lod_ge_half=float((lod[solid] >= .5).mean()),
                     today_see_through_nolod=float(see_nolod.sum() / solid.sum()),
                     today_see_through_with_lod=float(see_lod.sum() / solid.sum()),
                     today_tests_mean_nolod=float(tests_t[solid].mean()),
                     today_tests_mean_with_lod=float(tests_lod[solid].mean()),
                     today_tests_p95_with_lod=float(np.percentile(tests_lod[solid], 95)),
                     face_see_through=float((solid & ~covf).sum() / solid.sum()),
                     face_tests_mean=float(rf['tests'][solid].mean()),
                     face_distinct_values=int(len(vals)),
                     face_frac_in_0_64_128_192_255=float(np.isin(vf[covf], [0, 64, 128, 192, 255]).mean()),
                     face_top_values=[[int(b), round(float(a) / covf.sum(), 3)] for a, b in top[:10]])
    print(view, res[view], flush=True)
dump(res, OUT + 'check1.json')
