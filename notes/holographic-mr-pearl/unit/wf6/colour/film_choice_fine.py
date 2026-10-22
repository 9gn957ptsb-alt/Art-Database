"""(c) choose the unit's film thickness by the covers (request 4: their aesthetics), under the constraint that the
drawing's eye sees the drawing (any d, balanced on its crux colour). Score per OPD at the crux:
  cover: mean OKLab distance from the chromatic facet colours (grey and white families, a sphere of eyes, chroma
         > 0.03) to the nearest of the covers' film and pearl colours (wf5 palette.png); lower = closer to the covers
  band:  width (deg) round the crux where chroma < 0.02 (where the drawing holds)
  strength: mean chroma over the eyes; clip: share of facet colours clipped (a channel past 0 or 1 in linear light)."""
import json, math, sys
import numpy as np
sys.path.insert(0, '.')
from common import *
from pearl_film import R, cD, cos_t
from film_designs import MP, TONE_LIN

COVER = ['#fadca3', '#f3b897', '#d998c6', '#a28ed0', '#7799ce', '#8ee8f8', '#dce9a4', '#bf9e9e', '#95889b', '#d6beb6', '#f9efd6',
         '#c57482', '#9c949e', '#e6c6d3', '#abd9eb', '#d0caeb', '#c8e9f0', '#30d6e9', '#8679ce', '#edc188']
CL = oklab(np.array([unhx(h) for h in COVER]))
i = np.arange(600) + 0.5
z = 1 - 2 * i / 600; r = np.sqrt(1 - z * z); a = i * math.pi * (3 - math.sqrt(5))
V = np.stack([r * np.cos(a), r * np.sin(a), z], -1)
ang = np.linspace(30, 80, 5001); cA = np.cos(np.radians(ang))
rows = []
for opd in range(340, 481, 10):
    d = opd / (2 * MP[0] * cos_t(cD, MP[0]))
    RD = R(np.array([cD]), *MP, d=d)[0]
    if RD.min() < 0.15 * RD.max():
        continue
    def F(c, t):
        Rc = R(c, *MP, d=d)
        ch = Rc / np.maximum(Rc @ LUMA, 1e-9)[:, None] / (RD / (RD @ LUMA))
        return t * ch + np.maximum(Rc - RD, 0)
    sc = {}
    cols, clip = [], 0
    for fam in (0, 2):
        f = F(np.abs(V[:, fam]), TONE_LIN[fam]); clip += float(((f > 1) | (f < 0)).any(-1).mean()) / 2
        ok = oklab(enc(np.clip(f, 0, 1))); cols.append(ok)
        okA = oklab(enc(np.clip(F(cA, TONE_LIN[fam]), 0, 1))); C = np.hypot(okA[:, 1], okA[:, 2])
        j = np.argmin(abs(ang - 54.7356)); lo = hi = j
        while lo > 0 and C[lo] < 0.02: lo -= 1
        while hi < len(C) - 1 and C[hi] < 0.02: hi += 1
        sc['band_' + 'xyz'[fam]] = float(ang[hi] - ang[lo])
    ok = np.concatenate(cols); C = np.hypot(ok[:, 1], ok[:, 2])
    chrom = ok[C > 0.03]
    dist = np.sqrt(((chrom[:, None, :] - CL[None]) ** 2).sum(-1)).min(1) if len(chrom) else np.array([np.nan])
    rows.append(dict(opd=opd, d_nm=float(d), cover=float(dist.mean()), strength=float(C.mean()), clip=clip, chromatic_share=float((C > 0.03).mean()), **sc))
for rr in sorted(rows, key=lambda q: q['opd']):
    print('%5d d %6.1f cover %.3f strength %.3f clip %.2f chromatic %.2f band x %.2f z %.2f' % (rr['opd'], rr['d_nm'], rr['cover'], rr['strength'], rr['clip'], rr['chromatic_share'], rr['band_x'], rr['band_z']))
json.dump(rows, open(OUT + 'film_choice_fine.json', 'w'), indent=1)
