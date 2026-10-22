from geom import *
prims, recs = build('V3', kind='smootherstep')
MAP = {'Ay': 'Bx', 'By': 'Cx', 'Bx': 'Cz', 'Cx': 'Az', 'Cz': 'Ay', 'Az': 'By', 'Ax': 'Bz', 'Bz': 'Cy', 'Cy': 'Ax'}
by = {}
for p in prims: by.setdefault(NAMES[p.beam], []).append(p)
worst = 0
for a, b in MAP.items():
    for pa, pb in zip(by[a], by[b]):
        ca = R3(pa.corners); cb = pb.corners
        # as point sets
        d = np.abs(ca[:, None, :] - cb[None, :, :]).sum(-1).min(1).max()
        worst = max(worst, d)
# node check: every beam's end = next node
_, nodes = nodes_V3()
gap = 0
ends = {}
for nm, k, P0, bar in BEAMS:
    st = np.array(recs[nm]['start']); en = st + E[k] - M3 / 3
    ends[nm] = (st, en)
nl = list(nodes.values())
for nm, (st, en) in ends.items():
    gap = max(gap, min(np.linalg.norm(en - q) for q in nl), min(np.linalg.norm(st - q) for q in nl))
dep = [float((q - C) @ NH) for q in nl]
print('R3 maps V3 onto itself: max corner error', worst)
print('max node gap', gap, 'node depths', dep)
json.dump(dict(R3_max_corner_error=worst, max_node_gap=gap, node_depths=dep, nodes={k: v.tolist() for k, v in nodes.items()},
               R3_beam_map=MAP), open(OUT + 'symcheck.json', 'w'), indent=1)
