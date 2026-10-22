#!/usr/bin/env python3
"""The far face: what a block face shows when its bars are under a pixel (LOD closed). For each face axis a (the
face's outward normal +-a) and each view direction v (towards the eye), rays enter the block through that face at
n x n uniform points (parallel, along -v); the face rule gives round((T_a + B)/2) with B = first bar's tone else
m(v). The far colour is the mean over the face (the LOD's closed mean). Tabled over v; compared with a constant."""
import sys, math
import numpy as np
sys.path.insert(0, '.')
from common import *

n = 96
out = {}
occ = np.ones((1, 1, 1), bool)
g = (np.arange(n) + 0.5) / n
U, V = np.meshgrid(g, g, indexing='ij')
rows = []
for a in range(3):
    for sgn in (+1, -1):
        res_v = []
        for th in np.radians([5, 15, 25, 35, 45, 55, 65, 75, 85]):        # angle off the face normal
            for ph in np.radians(np.arange(0, 360, 30)):
                # v: towards the eye, in the hemisphere of the face's outward normal
                b1, b2 = [k for k in range(3) if k != a]
                v = np.zeros(3); v[a] = sgn * math.cos(th); v[b1] = math.sin(th) * math.cos(ph); v[b2] = math.sin(th) * math.sin(ph)
                P = np.zeros((n * n, 3)); P[:, a] = 1.0 if sgn > 0 else 0.0
                P[:, b1] = U.ravel(); P[:, b2] = V.ravel()
                O = P + v * 5; D = np.tile(-v, (n * n, 1))
                r = walk(occ, O, D, film='face', K=4, stop_after=2)
                vals = colour(r, 'face', np.full(len(O), np.nan))
                ok = np.isfinite(vals)
                bar_frac = float(((r['k'][:, 1] == 1) & ok).mean())
                res_v.append((math.degrees(th), math.degrees(ph), float(np.nanmean(vals)), bar_frac,
                              float(np.floor(mean_tone(v) + 0.5))))
        arr = np.array(res_v)
        key = ('+' if sgn > 0 else '-') + 'xyz'[a]
        out[key] = dict(tone=float(TONE[a]), far_mean=float(arr[:, 2].mean()), far_min=float(arr[:, 2].min()),
                        far_max=float(arr[:, 2].max()), far_std=float(arr[:, 2].std()),
                        bar_frac_mean=float(arr[:, 3].mean()), bar_frac_min=float(arr[:, 3].min()),
                        bar_frac_max=float(arr[:, 3].max()),
                        by_theta={str(int(t)): float(arr[arr[:, 0] == t, 2].mean()) for t in np.unique(arr[:, 0])},
                        closed_form_err=float(np.abs(arr[:, 2] - np.floor((TONE[a] + arr[:, 4]) / 2 + 0.5)).mean()))
        print(key, {k: (round(v, 2) if isinstance(v, float) else v) for k, v in out[key].items() if k != 'by_theta'},
              {k: round(v, 1) for k, v in out[key]['by_theta'].items()}, flush=True)
# today's far face: the blocks' average (rocket.js) -- for reference the bare unit's mean seen through a face
dump(out, 'farface.json')
