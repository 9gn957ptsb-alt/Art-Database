"""flow.py - the film's pattern as FLOW (soft swirling bands) rather than blobs, set by the covers.

Measure on each cover's head (wf5 head{1,2}.npz: pixel x, y, normal n, OKLab):
  coherence  the structure tensor of the chroma residual (a, b after a degree-4 trend in n), smoothed over a
             window sigma = 0.05 R (6 px on cover 1), C = |l1 - l2| / (l1 + l2) averaged over n_z > 0.35.
             Bands (one direction of change per window) give C near 1, isotropic blobs about 0.3-0.4.
  half_ab    the half-correlation angle of the chroma residual (mat/scale.py's measure), so the scale holds.
Model: thickness noise z1 = fbm(F n + o1 + W w(n)), w = three fbm at Fw = F / 2 (a domain warp: the
pattern's own larger flow bends it), so W = 0 is the shipped pearl.glsl. Grid over (F, W); choose the pair
nearest both covers' (half_ab, C). -> flow.json"""
import sys, json, numpy as np
D5 = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf5/material/py/'
sys.path.insert(0, D5)
from colour import srgb_to_oklab, lin_to_srgb
import model5 as M
from noise3 import fbm
from shfit import basis
OUT = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/pearl/mat/'
P = json.load(open(D5 + 'fit5c.json'))[0]['p']
BINS = np.radians(np.arange(0, 41, 2.0))
W_OFF = (np.array([5.2, 1.7, 9.4]), np.array([8.3, 4.4, 2.6]), np.array([1.9, 12.1, 7.3]))


def detrend(n, X):
    B = basis(n, 4); c, *_ = np.linalg.lstsq(B, X, rcond=None); return X - B @ c


def acorr(n, X, rng, npairs=300000):
    i = rng.integers(0, len(n), npairs); j = rng.integers(0, len(n), npairs)
    ang = np.arccos(np.clip((n[i] * n[j]).sum(1), -1, 1))
    Xc = X - X.mean(0); prod = (Xc[i] * Xc[j]).sum(1); var = (Xc * Xc).sum(1).mean()
    return np.array([prod[(ang >= a0) & (ang < a1)].mean() / var for a0, a1 in zip(BINS[:-1], BINS[1:])])


def half_angle(c):
    mids = np.degrees((BINS[:-1] + BINS[1:]) / 2)
    for k in range(1, len(c)):
        if c[k] < 0.5 <= c[k - 1]:
            t = (c[k - 1] - 0.5) / (c[k - 1] - c[k]); return mids[k - 1] + t * (mids[k] - mids[k - 1])
    return np.nan


def gblur(a, s):
    r = int(3 * s) + 1; x = np.arange(-r, r + 1); k = np.exp(-x * x / (2 * s * s)); k /= k.sum()
    a = np.apply_along_axis(lambda v: np.convolve(v, k, 'same'), 0, a)
    return np.apply_along_axis(lambda v: np.convolve(v, k, 'same'), 1, a)


def coherence(x, y, X, sel, s):
    """X (N, c) residual on pixels (x, y); mean coherence over sel"""
    x0, y0 = x.min(), y.min(); Wd, Hd = x.max() - x0 + 1, y.max() - y0 + 1
    m = np.zeros((Hd, Wd), bool); m[y - y0, x - x0] = True
    J = np.zeros((3, Hd, Wd))
    for c in range(X.shape[1]):
        g = np.zeros((Hd, Wd)); g[y - y0, x - x0] = X[:, c]
        gx = np.zeros_like(g); gy = np.zeros_like(g)
        gx[:, 1:-1] = (g[:, 2:] - g[:, :-2]) / 2; gy[1:-1, :] = (g[2:, :] - g[:-2, :]) / 2
        ok = m.copy(); ok[:, 1:-1] &= m[:, 2:] & m[:, :-2]; ok[1:-1, :] &= m[2:, :] & m[:-2, :]
        ok[:, 0] = ok[:, -1] = ok[0, :] = ok[-1, :] = False
        gx[~ok] = 0; gy[~ok] = 0
        J[0] += gx * gx; J[1] += gy * gy; J[2] += gx * gy
    w = gblur(ok.astype(float), s) + 1e-9
    Jxx, Jyy, Jxy = (gblur(J[k], s) / w for k in range(3))
    C = np.sqrt((Jxx - Jyy) ** 2 + 4 * Jxy ** 2) / (Jxx + Jyy + 1e-12)
    sm = np.zeros((Hd, Wd), bool); sm[y[sel] - y0, x[sel] - x0] = True
    sm &= gblur(ok.astype(float), 1.0) > 0.99
    return float(C[sm].mean())


def model_lab(n, F, Wp, real=0, sig=None):
    o1 = np.array([3.1, 7.7, 1.3]) + 37.0 * real; o2 = np.array([11.3, 2.9, 5.7]) + 37.0 * real
    q = n * F + o1
    if Wp > 0:
        Fw = F / 2
        w = np.stack([fbm(n * Fw + off + 37.0 * real, 3) for off in W_OFF], -1).astype(np.float64)
        q = q + Wp * w
    z1 = fbm(q, 3).astype(np.float64); z2 = fbm(n * F + o2, 3).astype(np.float64)
    PP = dict(P)
    if sig is not None:
        PP['sig'] = sig
    v = np.tile([0, 0, 1.0], (len(n), 1))
    return srgb_to_oklab(np.clip(lin_to_srgb(np.clip(M.shade(PP, n, v, z1, z2, M.FIX), 0, 1)), 0, 1))


def measure(x, y, n, lab, rng, s):
    sel = n[:, 2] > 0.35
    r_ab = detrend(n[sel], lab[sel, 1:])
    X = np.zeros((len(n), 2)); X[sel] = r_ab
    h = half_angle(acorr(n[sel], r_ab, rng))
    C = coherence(x, y, X, sel, s)
    return h, C, float(np.sqrt((r_ab ** 2).sum(1).mean()))


if __name__ == '__main__':
    rng = np.random.default_rng(5)
    res = {'covers': {}, 'grid': []}
    heads = {}
    for k in ('1', '2'):
        d = np.load(D5 + 'head%s.npz' % k)
        heads[k] = d
        s = 0.05 * float(d['r'])
        h, C, amp = measure(d['x'], d['y'], d['n'], d['lab'], rng, s)
        res['covers'][k] = dict(half_ab=h, coherence=C, chroma_resid_rms=amp, sigma_px=s)
        print('cover %s: half_ab %.2f deg  coherence %.3f  chroma resid rms %.4f  (sigma %.1f px)' % (k, h, C, amp, s), flush=True)
    d = heads['1']; s = 0.05 * float(d['r'])
    for F in (2.0, 2.5, 3.0, 4.0):
        for Wp in (0.0, 0.5, 1.0, 1.5, 2.0, 3.0):
            hs = []
            for real in range(2):
                lab = model_lab(d['n'], F, Wp, real)
                hs.append(measure(d['x'], d['y'], d['n'], lab, rng, s))
            h, C, amp = np.mean(hs, 0)
            res['grid'].append(dict(F=F, W=Wp, half_ab=h, coherence=C, chroma_resid_rms=amp))
            print('model F %.1f W %.1f: half_ab %.2f  coherence %.3f  rms %.4f' % (F, Wp, h, C, amp), flush=True)
            json.dump(res, open(OUT + 'flow.json', 'w'), indent=1)
