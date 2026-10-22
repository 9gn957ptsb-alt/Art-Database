"""The pattern's scale on the covers' heads: angular autocorrelation of the colour residual (OKLab a,b and L, after
removing a smooth degree-4 trend in the normal), versus the shader's thickness-noise frequency F (cells per unit
of normal). Picks F so that the half-correlation angle matches the covers."""
import sys, json, numpy as np
sys.path.insert(0, '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf5/material/py')
from colour import *
import model5 as M
from shfit import basis
D = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf5/material/py/'
P = json.load(open(D + 'fit5c.json'))[0]['p']
rng = np.random.default_rng(3)
BINS = np.radians(np.arange(0, 41, 2.0))

def detrend(n, X):
    B = basis(n, 4); c, *_ = np.linalg.lstsq(B, X, rcond=None); return X - B @ c

def acorr(n, X, npairs=400000):
    """correlation of residual vectors as a function of the angle between normals"""
    i = rng.integers(0, len(n), npairs); j = rng.integers(0, len(n), npairs)
    ang = np.arccos(np.clip((n[i] * n[j]).sum(1), -1, 1))
    Xc = X - X.mean(0)
    prod = (Xc[i] * Xc[j]).sum(1); var = (Xc * Xc).sum(1).mean()
    out = []
    for a0, a1 in zip(BINS[:-1], BINS[1:]):
        s = (ang >= a0) & (ang < a1)
        out.append(prod[s].mean() / var if s.sum() > 50 else np.nan)
    return np.array(out)

def half_angle(c):
    mids = np.degrees((BINS[:-1] + BINS[1:]) / 2)
    for k in range(1, len(c)):
        if c[k] < 0.5 <= c[k - 1]:
            t = (c[k - 1] - 0.5) / (c[k - 1] - c[k]); return mids[k - 1] + t * (mids[k] - mids[k - 1])
    return np.nan

res = {}
for k in ('1', '2'):
    d = np.load(D + 'head%s.npz' % k)
    n, lab = d['n'], d['lab']
    sel = n[:, 2] > 0.35          # avoid the limb, where the projection squeezes the pattern
    n, lab = n[sel], lab[sel]
    r_ab = detrend(n, lab[:, 1:]); r_L = detrend(n, lab[:, :1])
    cab, cL = acorr(n, r_ab), acorr(n, r_L)
    res['cover' + k] = dict(half_ab=half_angle(cab), half_L=half_angle(cL), c_ab=cab.round(3).tolist())
    print('cover %s: half-correlation angle  chroma %.1f deg   lightness %.1f deg' % (k, half_angle(cab), half_angle(cL)))
    if k == '1':
        n1 = n
v = np.tile([0, 0, 1.0], (len(n1), 1))
for F in (1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0):
    fix = dict(M.FIX); fix['freq'] = F; fix['freq2'] = F
    hs = []
    for real in range(2):
        z1, z2 = M.noise_fields(n1, fix, real=real)
        lab_m = srgb_to_oklab(np.clip(lin_to_srgb(np.clip(M.shade(P, n1, v, z1, z2, fix), 0, 1)), 0, 1))
        hs.append((half_angle(acorr(n1, detrend(n1, lab_m[:, 1:]))), half_angle(acorr(n1, detrend(n1, lab_m[:, :1])))))
    hs = np.array(hs).mean(0)
    res['F%.1f' % F] = dict(half_ab=hs[0], half_L=hs[1])
    print('model F %.1f: chroma %.1f deg   lightness %.1f deg' % (F, hs[0], hs[1]))
json.dump(res, open('/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/pearl/mat/scale.json', 'w'), indent=1)
