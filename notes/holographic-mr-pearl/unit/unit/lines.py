# Every edge of the original as a line of the lattice: its value of z - y (horizontal edges), x - z (edges along y)
# or y - x (edges along z), in cells, by the fitted projection.
import numpy as np, math
cls = np.load('cls.npy')
H, s, cx, cy, k = np.load('fitb.npy')
ys, xs = np.mgrid[0:cls.shape[0], 0:cls.shape[1]]
a = (xs - cx) / s; b = -(ys - cy) / (s * k)
r6, r2 = math.sqrt(6), math.sqrt(2)
C = np.array([1/3, 1, -1/3])
fam = {
  'z-y (horizontal)': (C[2] - C[1]) + r2 * b,
  'x-z (along y)':    (C[0] - C[2]) - (3 / r6) * a - b / r2,
  'y-x (along z)':    (C[1] - C[0]) + (3 / r6) * a - b / r2,
}
c = cls.copy(); c[c == -2] = -3
# boundary pixels, split by the direction of the step: a step across a horizontal edge is vertical, etc.
dv = (c[1:, :] != c[:-1, :]) & (c[1:, :] != -3) & (c[:-1, :] != -3)
dh = (c[:, 1:] != c[:, :-1]) & (c[:, 1:] != -3) & (c[:, :-1] != -3)
B = np.zeros(c.shape, bool); B[1:, :] |= dv; B[:, 1:] |= dh
onlyv = np.zeros(c.shape, bool); onlyv[1:, :] |= dv
onlyh = np.zeros(c.shape, bool); onlyh[:, 1:] |= dh
for name, v in fam.items():
    sel = B if 'horizontal' not in name else (onlyv & ~onlyh)
    vals = v[sel]
    hist, edges = np.histogram(vals, bins=np.arange(-3, 3, 0.004))
    # peaks: local maxima well above the floor
    pk = [(edges[i] + 0.002, hist[i]) for i in range(2, len(hist) - 2) if hist[i] == hist[i-2:i+3].max() and hist[i] > 60]
    merged = []
    for x, h in pk:
        if merged and x - merged[-1][0] < 0.02:
            if h > merged[-1][1]: merged[-1] = (x, h)
        else: merged.append((x, h))
    print(name, ' '.join('%+.3f(%d)' % (x, h) for x, h in merged))
