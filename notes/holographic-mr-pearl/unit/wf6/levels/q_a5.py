import json, numpy as np
import drawing2d as D
PHI = D.PHI
Hs = [0.098, 0.100, D.HG, 0.106, 0.108, 0.110, D.H9, 0.1125, 0.115, 0.118]
out = []
fit = list(D.FIT9)
for H in Hs:
    p, e = D.refit_cls(H, fit, steps=(1.0, 0.5, 0.5, 0.002), min_step=0.03)
    out.append(dict(H=H, six_H=6 * H, wrong=e, pct=round(100 * e / D.FIG_PX, 3), fit=[round(x, 3) for x in p]))
    print('H %.5f (6H %.4f) wrong %d = %.3f%%' % (H, 6 * H, e, 100 * e / D.FIG_PX), flush=True)
json.dump(out, open('q_a5_sweep.json', 'w'), indent=1)
