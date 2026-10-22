"""check7: R3 symmetry of form.json itself (its stored centrelines and hex corners), as point sets."""
import json, sys, numpy as np
f = json.load(open(sys.argv[1])); C = np.array([1/3, 1, -1/3])
Mt = np.array([[0, 1, 0], [0, 0, 1], [1, 0, 0]], float)
R3 = lambda p: (np.asarray(p, float) - C) @ Mt.T + C
B = {b['name']: b for b in f['beams']}
MAP = {'Ay': 'Bx', 'By': 'Cx', 'Bx': 'Cz', 'Cx': 'Az', 'Cz': 'Ay', 'Az': 'By', 'Ax': 'Bz', 'Bz': 'Cy', 'Cy': 'Ax'}
def dens(P, n=20):
    P = np.asarray(P, float); t = np.linspace(0, 1, n)[:, None]
    return np.concatenate([P[i] + t * (P[i + 1] - P[i]) for i in range(len(P) - 1)])
cl = 0; hx = 0; nd = 0
for a, o in MAP.items():
    ca = R3(B[a]['centreline']); co = dens(B[o]['centreline'])
    cl = max(cl, np.sqrt(((ca[:, None] - co[None]) ** 2).sum(-1)).min(1).max())
    ha = R3(np.concatenate([np.array(h, float) for h in B[a]['hexes']])); ho = np.concatenate([np.array(h, float) for h in B[o]['hexes']])
    hx = max(hx, np.sqrt(((ha[:, None] - ho[None]) ** 2).sum(-1)).min(1).max())
    for key in ('start_node', 'end_node'):
        nd = max(nd, np.abs(R3(B[a][key]) - np.array(B[o][key])).max())
out = dict(centreline_to_polyline=float(cl), hex_corner_set=float(hx), node_map=float(nd))
print(out); json.dump(out, open(sys.argv[2], 'w'), indent=1)
