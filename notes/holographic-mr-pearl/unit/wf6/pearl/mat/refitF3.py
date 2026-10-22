"""Refit the v5 pearl model with the pattern frequency set by the covers' colour correlation (F = 3), starting
from the best earlier solution (wf5 fit5c seed 101). Same objective as wf5 fit5.py."""
import sys, json, numpy as np, time
sys.path.insert(0, '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf5/material/py')
import model5 as M
M.FIX['freq'] = 3.0; M.FIX['freq2'] = 3.0
import fit5 as F
F.Z[:] = [M.noise_fields(F.n, real=r) for r in range(F.NR)]
t0 = time.time()
out = []
for seed in (0, 1):
    P = json.load(open('/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf5/material/py/fit5c.json'))[seed]['p']
    p0 = np.array([P[k] for k in M.PN])
    f0 = float(F.resid(p0) @ F.resid(p0))
    p, f = F.lm(p0, iters=40)
    r = dict(start=seed, f0=f0, f=float(f), rep=F.report(p), p=dict(zip(M.PN, map(float, p))), freq=3.0)
    out.append(r)
    print('start %d  f %.5f -> %.5f  cell dE %.4f  B %.4f  (%.0fs)' % (seed, f0, f, r['rep']['cell_dE_mean'], r['rep']['B_rms'], time.time() - t0), flush=True)
    json.dump(sorted(out, key=lambda x: x['f']), open('refitF3.json', 'w'), indent=1)
