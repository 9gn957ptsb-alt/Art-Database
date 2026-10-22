import json, numpy as np, time
import drawing2d as D
out = {}
fit = list(D.FIT9)
for name, H in [('thirds', D.H9), ('golden', D.HG)]:
    t0 = time.time()
    p, e = D.refit_cls(H, D.FIT9)
    out[name] = dict(H=H, fit=[round(x, 4) for x in p], wrong=e, pct=round(100 * e / D.FIG_PX, 3))
    print(name, out[name], '%.0fs' % (time.time() - t0), flush=True)
json.dump(out, open('q_a3.json', 'w'), indent=1)
