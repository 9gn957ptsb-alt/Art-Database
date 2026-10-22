"""check6: tone-rule numbers for the ARCS form (the report quotes the quintic's), and cost."""
import sys, time; sys.path.insert(0, sys.argv[1])
from render import *
import json
ME = sys.argv[2]; out = {}
for kind in ['arcs', 'smootherstep']:
    prims = build('V3', kind=kind, n=96)[0]
    t0 = time.time(); R = drawing_view(prims); dt = time.time() - t0
    fig = R['tone'] >= 0
    snap = snap_tone(R['n'], R['tone']); mix = mix_tone(R['n'], R['tone'])
    ident = np.vectorize(TONE_RGB.get)(R['tone']).astype(float)
    cls_of = lambda v: np.array([0, 128, 255])[np.abs(v[..., None] - np.array([0, 128, 255])).argmin(-1)]
    out[kind] = dict(n_prims=len(prims), cast_seconds=round(dt, 2),
        nearest_axis_pct=round(100 * float((snap != R['tone'])[fig].mean()), 2),
        mix_pct=round(100 * float((cls_of(mix) != cls_of(ident))[fig].mean()), 2))
    print(kind, out[kind], flush=True)
ps = build('straight')[0]
t0 = time.time(); R = drawing_view(ps); out['straight'] = dict(n_prims=len(ps), cast_seconds=round(time.time() - t0, 2))
pc = build_cut()
t0 = time.time(); R = drawing_view(pc); out['cut'] = dict(n_prims=len(pc), cast_seconds=round(time.time() - t0, 2))
print(out); json.dump(out, open(ME + '/check6.json', 'w'), indent=1)
