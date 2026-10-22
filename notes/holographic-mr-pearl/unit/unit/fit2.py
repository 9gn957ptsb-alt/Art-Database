import sys, math, numpy as np
sys.path.insert(0, '/home/user/site/scripts')
import figure_studies as fs
cls = np.load('cls.npy')
STEP = 2
C = cls[::STEP, ::STEP]; Hh, Ww = C.shape
ys, xs = np.mgrid[0:Hh, 0:Ww]
valid = C != -2
d = np.array([-1.0, -1, -1]); d /= np.linalg.norm(d)
u = np.array([0, -1.0, 1]); u -= d * (u @ d); u /= np.linalg.norm(u)
r = np.cross(d, u)
def extent(H):
    fs.H = H
    P = np.concatenate([b.corners() for b in fs.figure()]) - fs.CENTRE
    return (P @ r).min(), (P @ r).max(), (P @ u).min(), (P @ u).max()
def render(H, s, cx, cy, k):
    fs.H = H
    a = (xs * STEP - cx) / s; b = -(ys * STEP - cy) / (s * k)
    O = fs.CENTRE + a[..., None] * r + b[..., None] * u - d * 50
    return fs.cast(fs.figure(), O, np.broadcast_to(d, O.shape))
def err(p):
    t = render(*p)
    m = (t != C) & valid
    return m.sum() / (((C >= 0) | (t >= 0)) & valid).sum()
# the original's outline: x 350..849, y 89..539
X0, X1, Y0, Y1 = 350, 849, 89, 539
def init(H, k):
    a0, a1, b0, b1 = extent(H)
    s = (X1 - X0 + 1) / (a1 - a0)
    cx = X0 - a0 * s
    cy = Y0 + b1 * s * k     # top of the figure at Y0
    return [H, s, cx, cy, k]
def refine(p, free, steps, rounds=24):
    e = err(p)
    for it in range(rounds):
        improved = False
        for i in free:
            for sgn in (-1, 1):
                q = list(p); q[i] += sgn * steps[i]
                eq = err(q)
                if eq < e: p, e, improved = q, eq, True
        if not improved: steps = [x * 0.5 for x in steps]
    return p, e
# k from the outline's height: the figure's height over its width
for H in [0.10, 0.11, 0.118, 0.125]:
    a0, a1, b0, b1 = extent(H)
    k = ((Y1 - Y0 + 1) / (X1 - X0 + 1)) * (a1 - a0) / (b1 - b0)
    p = init(H, k)
    e0 = err(p)
    p, e = refine(p, [1, 2, 3, 4], [0, 2.0, 2.0, 2.0, 0.01], 16)
    print('H', H, 'k0', round(k, 4), 'start', round(e0, 4), '->', [round(v, 3) for v in p], round(e, 4))
# then H free, from the best
best = None
for H in [0.11, 0.118]:
    a0, a1, b0, b1 = extent(H); k = ((Y1 - Y0 + 1) / (X1 - X0 + 1)) * (a1 - a0) / (b1 - b0)
    p, e = refine(init(H, k), [0, 1, 2, 3, 4], [0.004, 2.0, 2.0, 2.0, 0.01], 30)
    print('free from', H, [round(v, 4) for v in p], round(e, 4))
    if best is None or e < best[1]: best = (p, e)
np.save('fit2.npy', np.array(best[0]))
