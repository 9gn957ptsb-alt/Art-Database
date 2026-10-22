import json, math, numpy as np
import nest as N, info as I
H = N.HG; L = N.LL
# an IN nest: the figure, its 4 openings, theirs (3 levels drawn), lattice-unit closure points
root = N.Copy(level=0); cps = [root]; cur = [root]
for lev in range(2):
    nxt = []
    for p in cur: nxt += N.holes(p, H, gap='pref')
    cps += nxt; cur = nxt
# the toy tree's leaves (OF), as a second family
tree = I.toy(3)
for c in tree['parts']:
    for p in c['parts']:
        for w in p['parts']: w['parts'] = []
res = N.place_huffman(tree, N.Frame(1.0, N.CENTRE.copy()), H)
leaves = res['leaves']
def ortho_proj(d, up):
    d = np.asarray(d, float); d /= np.linalg.norm(d); u = np.asarray(up, float); u = u - d * (u @ d); u /= np.linalg.norm(u); r = np.cross(d, u)
    return lambda P: np.stack([P @ r, P @ u], -1), r, u
def rot(axis, ang):
    axis = np.asarray(axis, float) / np.linalg.norm(axis); K = np.array([[0, -axis[2], axis[1]], [axis[2], 0, -axis[0]], [-axis[1], axis[0], 0]])
    return np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * K @ K
out = {}
def summarise(name, rows):
    by = {}
    for lev, g in rows: by.setdefault(lev, []).append(g)
    out[name] = {str(k): dict(n=len(v), max=round(max(v), 5), mean=round(float(np.mean(v)), 5)) for k, v in sorted(by.items())}
    print('%-46s' % name, '  '.join('level %s: max %.4f mean %.4f (n %d)' % (k, max(v), np.mean(v), len(v)) for k, v in sorted(by.items())))
for fam, copies in (('IN nest', cps), ('OF tree leaves', leaves)):
    # 1. the drawing view
    pr, r, u = ortho_proj(-N.NH, N.UPV)
    summarise(fam + ': drawing view', N.closure_gaps(copies, pr, lambda cp: cp.s * L))
    # 2. turned about z
    for ang in (5, 20, 45):
        M = rot((0, 0, 1), math.radians(ang)); pr2, _, _ = ortho_proj(M @ -N.NH, (0, 0, 1))
        summarise(fam + ': turned %d deg' % ang, N.closure_gaps(copies, pr2, lambda cp: cp.s * L))
    # 3. plain perspective from an eye on the axis at 8 figure-sizes
    f = 8.0; E = N.CENTRE + N.NH * f
    def persp(P, E=E):
        q = P - E; z = q @ -N.NH
        return np.stack([(q @ N.RV) / z, (q @ N.UPV) / z], -1)
    summarise(fam + ': perspective from the eye (not drawn in)', N.closure_gaps(copies, persp, lambda cp: cp.s * L / np.linalg.norm(cp.c - E)))
    # 4. drawn in towards that eye: map the closure points the same way as the pieces
    beta = 1.0 / f
    def drawn(P):
        q = P - N.CENTRE; a, b, d = q @ N.RV, q @ N.UPV, q @ N.NH
        return E + (a[:, None] * N.RV + b[:, None] * N.UPV + f * (-N.NH)) / (1 + beta * d)[:, None]
    summarise(fam + ': perspective, the whole nest drawn in', N.closure_gaps(copies, lambda P: persp(drawn(P)), lambda cp: cp.s * L / np.linalg.norm(cp.c - E)))
    # 5. drawn in, seen from an eye moved 5 degrees round the centre
    M = rot((0, 0, 1), math.radians(5)); E2 = N.CENTRE + M @ (N.NH * f); F2 = (N.CENTRE - E2) / np.linalg.norm(N.CENTRE - E2)
    U2 = np.array([0, 0, 1.0]) - F2 * F2[2]; U2 /= np.linalg.norm(U2); R2 = np.cross(F2, U2)
    def persp2(P):
        q = P - E2; z = q @ F2
        return np.stack([(q @ R2) / z, (q @ U2) / z], -1)
    summarise(fam + ': drawn in, eye moved 5 deg', N.closure_gaps(copies, lambda P: persp2(drawn(P)), lambda cp: cp.s * L / np.linalg.norm(cp.c - E)))
json.dump(out, open('q_closure2.json', 'w'), indent=1)
print('theory, turned ortho: relative gap = |(1,1,1) on screen| / L = (3/sqrt2) sin(theta) for small turns:', [round(3 / math.sqrt(2) * math.sin(math.radians(a)), 4) for a in (5, 20, 45)])
