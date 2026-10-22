# supersampled check: 3x3 samples per pixel; V3 / V1 against the straight-cut reading and against each other
from caster import *
f = dict(FIT); f['s'] *= 3; f['cx'] = f['cx'] * 3 + 1; f['cy'] = f['cy'] * 3 + 1
out = {}
T = {}
for var in ['cut', 'V3', 'V1']:
    prims = build_cut() if var == 'cut' else build(var)[0]
    T[var] = drawing_view(prims, (1890, 3600), f)['tone']
for v in ['V3', 'V1']:
    d = T[v] != T['cut']
    out[v + '_vs_cut_samples_differing'] = int(d.sum())
    if d.any():
        ys, xs = np.nonzero(d); out[v + '_where'] = [int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())]
out['samples'] = int(T['cut'].size)
print(out); json.dump(out, open(OUT + 'ss_check.json', 'w'), indent=1)
