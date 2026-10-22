import sys; sys.path.insert(0, '/home/user/site/scripts')
from geom import *
import figure_studies as fs
# fine drawing grid, unit-k (true diagonal view)
n = 1600
a, b = np.meshgrid(np.linspace(-1.3, 1.3, n), np.linspace(-0.9, 1.3, n))
O = C + a[..., None] * RV + b[..., None] * U + NH * 20
Dv = np.broadcast_to(D, O.shape)
cov = []
for nm, k, P, bar in BEAMS:
    P = np.array(P, float)
    lo = P - H; hi = P + H; hi[k] += 1
    t = fs.cast([fs.Box.aabb(lo, hi)], O, Dv)
    cov.append(t >= 0)
cov = np.array(cov)
res = {}
for bi, (nm, k, P, bar) in enumerate(BEAMS):
    sg = sigma_of(O, P, k)
    mine = cov[bi]
    full = (sg[mine].min(), sg[mine].max())
    ov = {}
    for ci, (nm2, *_r) in enumerate(BEAMS):
        if ci == bi: continue
        both = mine & cov[ci]
        if both.any():
            ov[nm2] = (round(float(sg[both].min()), 4), round(float(sg[both].max()), 4))
    anyo = mine & (cov.sum(0) > 1)
    s = np.sort(np.unique(np.round(sg[anyo], 3)))
    # free span: largest gap in the sigma values covered by overlaps (within beam range)
    pts = np.concatenate([[full[0]], s, [full[1]]])
    g = np.diff(pts); i = g.argmax()
    res[nm] = dict(full=(round(float(full[0]), 4), round(float(full[1]), 4)), overlaps=ov, free=(round(float(pts[i]), 4), round(float(pts[i + 1]), 4)))
    print(nm, res[nm])
json.dump(res, open('overlap.json', 'w'), indent=1)
