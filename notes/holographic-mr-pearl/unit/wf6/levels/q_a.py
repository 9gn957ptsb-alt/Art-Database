import json, time, numpy as np
import drawing2d as D
T = D.target('holes'); valid = T != -2
t0 = time.time()
e9, n9 = D.wrong(D.H9, D.FIT9, T)
print('H=1/9 at the vectorize fit: wrong %d of %d figure px = %.3f%%  (%.1fs)' % (e9, n9, 100 * e9 / n9, time.time() - t0))
res = {}
for name, H in [('thirds 1/9', D.H9), ('golden 1/(6 phi)', D.HG)]:
    p, e = D.refit(H, D.FIT9, T)
    e1, n1 = D.wrong(H, p, T)
    res[name] = dict(H=H, fit=p, wrong=e1, figure_px=n1, pct=100 * e1 / n1)
    print('%-18s H=%.5f fit s=%.3f cx=%.3f cy=%.3f k=%.5f  wrong %d / %d = %.3f%%' % (name, H, *p, e1, n1, 100 * e1 / n1), flush=True)
# golden drawn at the thirds' own fit (no refit)
eg, ng = D.wrong(D.HG, res['thirds 1/9']['fit'], T)
res['golden at thirds fit'] = dict(wrong=eg, figure_px=ng, pct=100 * eg / ng)
print('golden at the thirds fit: %d = %.3f%%' % (eg, 100 * eg / ng))
# the two drawings against each other (each at its own best fit)
R9 = D.raster(D.H9, res['thirds 1/9']['fit']); RG = D.raster(D.HG, res['golden 1/(6 phi)']['fit'])
d = (R9 != RG); res['thirds_vs_golden_px'] = int(d.sum())
print('pixels where the two drawings differ (own fits):', d.sum(), 'of', ((R9 >= 0) | (RG >= 0)).sum())
np.save('R9.npy', R9); np.save('RG.npy', RG)
json.dump(res, open('q_a.json', 'w'), indent=1)
