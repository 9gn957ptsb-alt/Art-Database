"""After hat_settle's drop: does the hat pass through the parts hat_settle left out (guitar, strap)? and where is the
contact? Same sampling as hat_settle.py."""
import sys, os, json, numpy as np
P = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/pearl'
sys.path.insert(0, P); os.chdir(P)
import pmodel as M, prims as PR
from fit import load_params
p = load_params(); p['FACE_YAW'] = 0.0
prims, info = M.build(p, with_head=False, with_hat=True, hat_on_head=False)
hat = [q for q in prims if q['group'] in ('hat', 'band')]
left_out = [q for q in prims if q['part'].startswith('guitar') or q['part'].startswith('strap')]
body = [q for q in prims if q['group'] not in ('hat', 'band', 'head') and q not in left_out]
drop = json.load(open('hat_settle.json'))['drop_px']
rng = np.random.default_rng(1); pts = []; tag = []
SHELL = 0.01 * M.S
crown = [q for q in hat if q['part'].startswith(('hat_crown', 'hat_band'))]
tap = [q for q in crown if q['part'] == 'hat_crown_taper'][0]
A, Bt = np.asarray(tap['a'], float), np.asarray(tap['b'], float); ax = (Bt - A) / np.linalg.norm(Bt - A)
for q in hat:
    c, r = PR.bound(q); X = c + (rng.random((400000, 3)) * 2 - 1) * r
    if q in crown:
        du = np.min([PR.sdf(k, X) for k in crown], axis=0)
        h = (X - A) @ ax; rad = np.linalg.norm((X - A) - h[:, None] * ax, axis=1)
        keep = (du <= 0) & (du > -SHELL) & ~((h < SHELL) & (rad < tap['ra'] - SHELL))
    else:
        keep = PR.sdf(q, X) <= 0
    pts.append(X[keep]); tag += [q['part']] * int(keep.sum())
H = np.concatenate(pts) - [0, 0, drop]; tag = np.array(tag)
res = {}
for grp, name in ((left_out, 'guitar+strap'), (body, 'body')):
    for q in grp:
        d = PR.sdf(q, H); w = d < 0
        if w.any():
            res.setdefault(name, {})[q['part']] = dict(n=int(w.sum()), depth_mm=round(float(-d[w].min() / M.S * 1000), 1),
                                                       hat_parts=sorted(set(tag[w])))
# brim height above the shoulders
br = H[tag == 'hat_brim']
print('drop m', drop / M.S, 'brim z range m', round(br[:, 2].min() / M.S, 3), round(br[:, 2].max() / M.S, 3))
print(json.dumps(res, indent=1))
json.dump(res, open('/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/check-pearl/hat_check.json', 'w'), indent=1)
