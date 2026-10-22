"""(c) with the film balanced on its own crux colour, any thickness is exact at the crux. Choose the thickness by
what it costs: the angular width of the neutral band round the crux (OKLab chroma < 0.02, about one just-noticeable
step) against the hologram's strength elsewhere (mean chroma over a sphere of eyes), grey facet, Mr Pearl's film."""
import json, math, sys
import numpy as np
sys.path.insert(0, '.')
from common import *
from pearl_film import R, cD, d_for, cos_t
from film_designs import MP, TONE_LIN

i = np.arange(400) + 0.5
z = 1 - 2 * i / 400; r = np.sqrt(1 - z * z); a = i * math.pi * (3 - math.sqrt(5))
V = np.stack([r * np.cos(a), r * np.sin(a), z], -1)
ang = np.linspace(30, 80, 5001); cA = np.cos(np.radians(ang))
rows = []
for opd in [150, 250, 350, 450, 550, 700, 850, 1000, 1200, 1500, 1971, 2553]:
    d = opd / (2 * MP[0] * cos_t(cD, MP[0]))
    RD = R(np.array([cD]), *MP, d=d)[0]
    def F(c, t):
        Rc = R(c, *MP, d=d)
        ch = Rc / np.maximum(Rc @ LUMA, 1e-9)[:, None] / (RD / (RD @ LUMA))
        return t * ch + np.maximum(Rc - RD, 0)
    out = {}
    for fam, t in ((0, TONE_LIN[0]), (2, 1.0)):
        ok = oklab(enc(np.clip(F(cA, t), 0, 1))); C = np.hypot(ok[:, 1], ok[:, 2])
        j = np.argmin(abs(ang - 54.7356)); lo = hi = j
        while lo > 0 and C[lo] < 0.02: lo -= 1
        while hi < len(C) - 1 and C[hi] < 0.02: hi += 1
        ok2 = oklab(enc(np.clip(F(np.abs(V[:, fam]), t), 0, 1))); C2 = np.hypot(ok2[:, 1], ok2[:, 2])
        out['xyz'[fam]] = dict(band=[float(ang[lo]), float(ang[hi])], width=float(ang[hi] - ang[lo]), chroma_mean=float(C2.mean()), chroma_p90=float(np.percentile(C2, 90)))
    rows.append(dict(opd=opd, d_nm=float(d), **out))
    print(opd, round(float(d)), {k: (round(v['width'], 2), round(v['chroma_mean'], 3)) for k, v in out.items()})
json.dump(rows, open(OUT + 'opd_scan.json', 'w'), indent=1)
