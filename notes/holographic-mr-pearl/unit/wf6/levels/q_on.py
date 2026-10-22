"""Re-check of q_b ON (ratio 0.452 vs 1/phi): width across the outer left bar, parent and the copy at r on tribar A,
measured along the left side's inward normal at several points along it, on the exact polygons (no raster)."""
import math, numpy as np, json
import drawing2d as D2, nest as N
out = {}
for name, H in (('golden', N.HG), ('thirds', N.H9)):
    POL = D2.polygons(H); SIL = [P for t, P in POL if t >= 0]
    r = N.r_of(H)
    def inside_any(polys, pts):
        m = np.zeros(len(pts), bool)
        for P in polys: m |= D2.inside(P, pts[:, 0], pts[:, 1])
        return m
    allP = np.concatenate(SIL); apex = allP[allP[:, 1].argmax()]; bl = allP[allP[:, 0].argmin()]
    side = bl - apex; side /= np.linalg.norm(side); nin = np.array([side[1], -side[0]])
    if nin[0] < 0: nin = -nin
    res = []
    for f in np.linspace(0.08, 0.45, 12):
        p0 = apex + (bl - apex) * f - nin * 0.01
        ts = np.linspace(0, 0.5, 20001); pts = p0 + ts[:, None] * nin
        par = inside_any(SIL, pts)
        kid = inside_any([P * r + N.TRI['A'] for P in SIL], pts)
        def first_run(m):
            i = np.nonzero(m)[0]
            if not len(i): return None
            j = i[0]; k = j
            while k + 1 < len(m) and m[k + 1]: k += 1
            return ts[k] - ts[j]
        res.append((round(f, 3), first_run(par), first_run(kid)))
    ratios = [k / p for f, p, k in res if p and k]
    out[name] = dict(r=r, samples=res, ratio_median=float(np.median(ratios)), bar_across_analytic=2 * math.sqrt(3) * H * math.sqrt(2/3) )
    print(name, 'r=%.4f' % r, 'median kid/parent outer-bar width %.4f' % np.median(ratios)); print(res)
json.dump(out, open('q_on.json', 'w'), indent=1)
