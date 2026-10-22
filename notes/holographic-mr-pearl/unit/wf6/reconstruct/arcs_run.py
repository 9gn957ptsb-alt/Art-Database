"""V3 with the arc-straight-arc bend: drawing-view mismatch, collisions, symmetry, supersampled agreement"""
import sys; sys.path.insert(0, '.')
from caster import *
from measure import mismatch
out = {}
prims, recs = build('V3', kind='arcs', n=96)
R = drawing_view(prims)
mm, m = mismatch(R['tone']); out['mismatch_V3_arcs'] = mm; print(mm, flush=True)
np.save(OUT + 'tone_V3_arcs.npy', R['tone'])
q = drawing_view(build('V3', kind='smootherstep')[0])['tone']
out['px_differing_from_V3_quintic'] = int((q != R['tone']).sum())
# symmetry
MAP = {'Ay': 'Bx', 'By': 'Cx', 'Bx': 'Cz', 'Cx': 'Az', 'Cz': 'Ay', 'Az': 'By', 'Ax': 'Bz', 'Bz': 'Cy', 'Cy': 'Ax'}
by = {}
for p in prims: by.setdefault(NAMES[p.beam], []).append(p)
worst = 0
for a, b in MAP.items():
    for pa, pb in zip(by[a], by[b]):
        worst = max(worst, np.abs(R3(pa.corners)[:, None] - pb.corners[None]).sum(-1).min(1).max())
out['R3_max_corner_error'] = float(worst)
# collisions
rng = np.random.default_rng(1); deepest = 0; hits = 0
for b, ps in by.items():
    pts = np.concatenate([np.concatenate([rng.dirichlet(np.ones(8), 60) @ p.corners, p.corners]) for p in ps[1:-1]])
    for qq in prims:
        if NAMES[qq.beam] == b: continue
        dep = (pts @ qq.N.T - qq.w[None]).max(1)
        if (dep < -1e-6).any(): hits += int((dep < -1e-6).sum()); deepest = max(deepest, float(-dep.min()))
out['collision_samples_inside_other_beams'] = hits; out['deepest_penetration'] = deepest
# 3x3 supersampled vs the straight cut
f = dict(FIT); f['s'] *= 3; f['cx'] = f['cx'] * 3 + 1; f['cy'] = f['cy'] * 3 + 1
Ta = drawing_view(prims, (1890, 3600), f)['tone']; Tc = drawing_view(build_cut(), (1890, 3600), f)['tone']
out['supersampled_3x3_vs_cut_differing'] = int((Ta != Tc).sum()); out['samples'] = int(Ta.size)
print(out)
json.dump(out, open(OUT + 'arcs_check.json', 'w'), indent=1)
