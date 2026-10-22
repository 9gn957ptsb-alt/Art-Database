"""hat_settle.py - option B made a determined relation: with the head gone, nothing holds the hat; it falls straight
down (axis kept, no tumble) until it first touches the body. The drop is the least d at which some point of the
hat's solid, lowered by d, enters the body. -> hat_settle.json (drop in px and m, the parts it rests on)."""
import json, os, numpy as np
import pmodel as M, prims as P
from fit import load_params
HERE = os.path.dirname(os.path.abspath(__file__))
p = load_params(); p['FACE_YAW'] = 0.0
prims, info = M.build(p, with_head=False, with_hat=True, hat_on_head=False)
hat = [q for q in prims if q['group'] in ('hat', 'band')]
body = [q for q in prims if q['group'] not in ('hat', 'band', 'head') and not q['part'].startswith('guitar') and not q['part'].startswith('strap')]
rng = np.random.default_rng(0)
SHELL = 0.01 * M.S   # a felt crown is a shell 1 cm thick, hollow inside (the head sat in it)
pts = []
crown = [q for q in hat if q['part'].startswith(('hat_crown', 'hat_band'))]
rest = [q for q in hat if q not in crown]
tap = [q for q in crown if q['part'] == 'hat_crown_taper'][0]
A, Bt = np.asarray(tap['a'], float), np.asarray(tap['b'], float); ax = (Bt - A) / np.linalg.norm(Bt - A)
for q in hat:
    c, r = P.bound(q)
    X = c + (rng.random((400000, 3)) * 2 - 1) * r
    if q in crown:
        du = np.min([P.sdf(k, X) for k in crown], axis=0)          # the crown's solid, as one
        h = (X - A) @ ax; rad = np.linalg.norm((X - A) - h[:, None] * ax, axis=1)
        opening = (h < SHELL) & (rad < tap['ra'] - SHELL)           # its open foot, where the head went in
        keep = (du <= 0) & (du > -SHELL) & ~opening
    else:
        keep = P.sdf(q, X) <= 0
    pts.append(X[keep])
H = np.concatenate(pts); print('hat solid samples', len(H))
def inside(Y):
    m = np.full(len(Y), np.inf); who = np.full(len(Y), -1)
    for i, q in enumerate(body):
        d = P.sdf(q, Y); w = d < m; m[w] = d[w]; who[w] = i
    return m, who
# coarse-to-fine search for the first contact (z is up in the model frame)
lo, hi = 0.0, 1200.0
m, _ = inside(H)
assert m.min() > 0, 'hat already touches the body'
for step in (40.0, 5.0, 0.5):
    d = lo
    while d <= hi:
        mm, _ = inside(H - [0, 0, d])
        if mm.min() <= 0:
            hi = d; break
        lo = d; d += step
mm, who = inside(H - [0, 0, hi])
touch = sorted(set(body[i]['part'] for i in who[mm <= 0]))
out = dict(drop_px=round(hi, 1), drop_m=round(hi / M.S, 4), rests_on=touch,
           relation='with the head gone nothing holds the hat: it falls straight down, its axis kept, until it first touches the body; the crown and its band a 1 cm shell, hollow where the head sat (sampled, %d points)' % len(H))
json.dump(out, open(os.path.join(HERE, 'hat_settle.json'), 'w'), indent=1); print(out)
