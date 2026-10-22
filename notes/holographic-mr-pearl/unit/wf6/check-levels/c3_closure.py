"""Independent closure check: own projections (ortho turned about an arbitrary axis, perspective from one eye,
drawn in), on every leaf and opening of a level-6 nest (deeper than the study's level 5)."""
import sys, math, json, numpy as np
sys.path.insert(0, sys.argv[1]); sys.path.insert(0, sys.argv[1] + '/../../wf1/design-nesting')
import nest as N, ladder as LD
fr = LD.nest_frames(6, 2, openings=True)
cps = [x.copy(i) for i, x in enumerate(fr)]
pts = np.array([p for k in 'ABC' for p in N.CLOSE[k]], float)
def rot(axis, ang):
    a = np.asarray(axis, float); a /= np.linalg.norm(a); K = np.array([[0,-a[2],a[1]],[a[2],0,-a[0]],[-a[1],a[0],0]])
    return np.eye(3) + math.sin(ang)*K + (1-math.cos(ang))*K@K
NH = N.NH; C = N.CENTRE
res = {}
for name, axis, ang in (('drawing', (1,0,0), 0.0), ('5deg about (1,2,-1)', (1,2,-1), 5), ('20deg about (0,1,3)', (0,1,3), 20)):
    Rm = rot(axis, math.radians(ang)); d = Rm @ (-NH); r = Rm @ N.RV; uu = Rm @ N.UPV
    rel = {}
    for cp, x in zip(cps, fr):
        Q = cp.map(pts); Sx = np.stack([Q @ r, Q @ uu], 1)
        g = max(np.linalg.norm(Sx[2*i] - Sx[2*i+1]) for i in range(3)) / (cp.s * N.LL)
        rel.setdefault('%d %s' % (x.m, x.kind), []).append(g)
    res[name] = {k: [round(min(v), 6), round(max(v), 6), len(v)] for k, v in rel.items()}
# perspective from one eye, raw and drawn in (drawn_in map applied to the points themselves)
f = 4.0 * LD.F(10) / 8; eye = C + NH * f
def persp(Q, eye):
    q = Q - eye; z = q @ (-NH); return np.stack([(q @ N.RV) / z, (q @ N.UPV) / z], 1)
def drawn_in(Q):
    q = Q - C; a, b, dd = q @ N.RV, q @ N.UPV, q @ NH
    return eye + (a[:, None]*N.RV + b[:, None]*N.UPV + f*(-NH)) / (1 + dd/f)[:, None]
for name, fn, E in (('persp raw', lambda Q: Q, eye), ('persp drawn in', drawn_in, eye),
                    ('drawn in, eye 8deg', drawn_in, C + rot((0,0,1), math.radians(8)) @ (eye - C))):
    rel = {}
    for cp, x in zip(cps, fr):
        Q = fn(cp.map(pts)); Sx = persp(Q, eye if name != 'drawn in, eye 8deg' else E)
        # size: the copy's drawn cell edge as seen (project two points one cell apart at the copy centre)
        c0 = cp.map(np.array([C, C + np.array([1.0, 0, 0])]))
        sz = np.linalg.norm(np.subtract(*persp(fn(c0), E)))
        g = max(np.linalg.norm(Sx[2*i] - Sx[2*i+1]) for i in range(3)) / sz
        rel.setdefault('%d %s' % (x.m, x.kind), []).append(g)
    res[name] = {k: [round(min(v), 6), round(max(v), 6), len(v)] for k, v in rel.items()}
print(json.dumps(res, indent=0)); json.dump(res, open('c3_closure.json', 'w'), indent=1)
