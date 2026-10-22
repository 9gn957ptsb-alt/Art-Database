import json, numpy as np
import lv, drawing2d as D
import unit as U
C = D.target('cls')
fits = json.load(open('q_a3.json'))
res = {}
for name, H in [('thirds', D.H9), ('golden', D.HG)]:
    fit = fits[name]['fit']
    s, cx, cy, k = fit
    ys, xs = np.mgrid[0:630, 0:1200].astype(float)
    a = (xs - cx) / s; b = -(ys - cy) / (s * k)
    holes = np.zeros(C.shape, bool)
    for tone, P in D.polygons(H):
        if tone < 0: holes |= D.inside(P, a, b)
    O, Dv = U.drawing_rays_for_original(*fit)
    for Dsh in [0.0, 1.0 + 6 * H, 2 / lv.PHI, lv.PHI, 1.5, 2.0]:
        u = lv.unit(H, D=Dsh)
        t = lv.cast(lv.prims_of([lv.Copy()], u), O, Dv)
        t2 = t.copy(); t2[holes & (t2 < 0)] = 2
        w = int(((t2 != C) & (C != -2)).sum())
        res['%s D=%.4f' % (name, Dsh)] = w
        print('%-7s D=%.4f  wrong %6d = %6.3f%%' % (name, Dsh, w, 100 * w / D.FIG_PX), flush=True)
json.dump(res, open('q_closure.json', 'w'), indent=1)
