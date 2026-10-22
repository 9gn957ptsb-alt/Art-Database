#!/usr/bin/env python3
"""check-solids 3: does the game unit (rocket.js FIGURE, the one the solids are textured with) close into the original
from the crux, and how far is it from the original (mismatch against cls, holes as paper, -2 ignored)?  Also the
straight lattice model (figure_studies.figure at H = 1/9) for the floor."""
import sys, json, math
import numpy as np
SOL = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/solids'
sys.path.insert(0, SOL)
import os; os.chdir(SOL)
from common import *
SP = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/'
OUT = SP + 'wf6/check-solids/'
cls = np.load(SP + 'unit/cls.npy'); cc = np.load(SP + 'wf3/colour-albers/cls_clean.npy')
valid = cls != -2
target = cc

Wr = 1600; span = 1.8
O, D, shape, px = drawing_view((0.5, 0.5, 0.5), span, Wr, Wr)
r = walk(np.ones((1, 1, 1), bool), O, D, film='none', K=2, stop_after=1)
v = colour(r, 'bare', np.full(len(O), np.nan)).reshape(Wr, Wr)
lab = np.full(v.shape, -1); lab[v == 128] = 0; lab[v == 0] = 1; lab[v == 255] = 2
ys, xs = np.nonzero(lab >= 0)
print('unit render bbox px', xs.min(), xs.max(), ys.min(), ys.max())
A0 = (xs.min() + xs.max()) / 2; B0 = (ys.min() + ys.max()) / 2; wid_u = (xs.max() - xs.min()) * px
ty, tx = np.nonzero(target >= 0)
wid_o = tx.max() - tx.min()
yy, xx = np.mgrid[0:630, 0:1200]

def mism(s, cx, cy, k):
    a = (xx - cx) / s; b = (yy - cy) / (s * k)
    j = np.round(A0 + a / px - 0.5).astype(int); i = np.round(B0 + b / px - 0.5).astype(int)
    ok = (j >= 0) & (j < Wr) & (i >= 0) & (i < Wr)
    L = np.full((630, 1200), -1); L[ok] = lab[i[ok], j[ok]]
    return float(((L != target) & valid).sum() / valid.sum()), L

s0 = wid_o / wid_u; cx0 = (tx.min() + tx.max()) / 2; cy0 = (ty.min() + ty.max()) / 2
best = None
for k in (1.0, 1.0393):
    p = np.array([s0, cx0, cy0]); st = np.array([s0 * 0.02, 4.0, 4.0]); e, _ = mism(*p, k)
    for it in range(60):
        imp = False
        for d in range(3):
            for sg in (1, -1):
                q = p.copy(); q[d] += sg * st[d]; e2, _ = mism(*q, k)
                if e2 < e: p, e, imp = q, e2, True
        if not imp:
            st /= 2
            if st[1] < 0.1: break
    print('k', k, 'fit s cx cy', p, 'mismatch', e)
    if best is None or e < best[0]: best = (e, p, k)
e, p, k = best
_, L = mism(*p, k)
pal = {-1: (255, 255, 255), 0: (128, 128, 128), 1: (0, 0, 0), 2: (235, 235, 235)}
img = np.zeros((630, 1200, 3), np.uint8)
for kk, c in pal.items(): img[L == kk] = c
diff = np.full((630, 1200, 3), 255, np.uint8); bad = (L != target) & valid
diff[target >= 0] = (200, 200, 200); diff[bad] = (220, 30, 30)
from PIL import Image
Image.fromarray(np.concatenate([img, diff], 1)).save(OUT + 'K3_gameunit_vs_original.png')
# unit's proportions: bar thickness / tribar side as drawn
res = dict(mismatch_vs_cls=e, fit=dict(s=p[0], cx=p[1], cy=p[2], k=k), floor_lattice_model=0.02103,
           unit_bar_over_block=0.1, note='game unit = rocket.js FIGURE; mismatch counts every pixel class (ground/grey/black/white) differing, -2 ignored, holes as paper')
dump(res, OUT + 'check3.json'); print(res)
