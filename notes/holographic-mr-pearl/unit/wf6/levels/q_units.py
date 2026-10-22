import sys, json, time, numpy as np
sys.path.insert(0, '../../wf1/design-nesting')
import unit as U
import weave_test as W
import drawing2d as D
C = D.target('cls')
def score(prims, fit):
    O, Dv = U.drawing_rays_for_original(*fit)
    t = U.cast(prims, O, Dv)
    # holes: whatever the model shows there is compared as drawn; cls says 2 in holes -> a model showing ground there is 'wrong' by
    # cls's label, so compare the model's ground inside the drawn holes as 2, as the vector scoring does
    hole = np.zeros(C.shape, bool)
    s, cx, cy, k = fit
    ys, xs = np.mgrid[0:630, 0:1200].astype(float)
    a = (xs - cx) / s; b = -(ys - cy) / (s * k)
    return t
res = {}
for name, H in [('thirds', D.H9), ('golden', D.HG)]:
    fit = json.load(open('q_a3.json'))[name]['fit']
    s, cx, cy, k = fit
    ys, xs = np.mgrid[0:630, 0:1200].astype(float)
    a = (xs - cx) / s; b = -(ys - cy) / (s * k)
    holes = np.zeros(C.shape, bool)
    for tone, P in D.polygons(H):
        if tone < 0: holes |= D.inside(P, a, b)
    O, Dv = U.drawing_rays_for_original(*fit)
    for uname, prims in [('straight', U.place(U.unit(H, curved=False))), ('curved tail D=2/phi', U.place(U.unit(H, True))), ('woven', U.place(W.woven(H)))]:
        t0 = time.time()
        t = U.cast(prims, O, Dv)
        t2 = t.copy(); t2[holes & (t2 < 0)] = 2
        w = int(((t2 != C) & (C != -2)).sum())
        res['%s %s' % (name, uname)] = dict(wrong=w, pct=round(100 * w / D.FIG_PX, 3))
        print('%-7s %-20s wrong %6d = %6.3f%%  (%.1fs)' % (name, uname, w, 100 * w / D.FIG_PX, time.time() - t0), flush=True)
json.dump(res, open('q_units.json', 'w'), indent=1)
