# does any bent part pass through another beam in 3D? (sample points inside the bend hexes of each beam)
from geom import *
rng = np.random.default_rng(1)
def check(prims, label):
    out = {}
    by = {}
    for p in prims: by.setdefault(p.beam, []).append(p)
    worst = 0
    for b, ps in by.items():
        bend = ps[1:-1] if len(ps) > 1 else []
        if not bend: continue
        pts = []
        for p in bend:
            w = rng.dirichlet(np.ones(8), 60); pts.append(w @ p.corners); pts.append(p.corners)
        pts = np.concatenate(pts)
        hits = {}
        for q in prims:
            if q.beam == b: continue
            depth = (pts @ q.N.T - q.w[None, :]).max(1)   # <0 inside
            ins = depth < -1e-6
            if ins.any():
                hits[NAMES[q.beam]] = hits.get(NAMES[q.beam], 0) + int(ins.sum())
                worst = max(worst, float(-depth.min()))
        out[NAMES[b]] = hits
    print(label, out, 'deepest penetration', round(worst, 4))
    return out, worst
res = {}
for var in ['V3', 'V1']:
    for kind in ['smootherstep', 'smoothstep']:
        prims, _ = build(var, kind=kind)
        o, w = check(prims, var + ' ' + kind)
        res[var + '_' + kind] = dict(hits=o, deepest=w)
json.dump(res, open(OUT + 'collide.json', 'w'), indent=1)
