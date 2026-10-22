# Fit the lattice figure to the artist's original drawing: bar half-width H, scale, centre, and a vertical stretch k.
import sys, math, numpy as np
sys.path.insert(0, '/home/user/site/scripts')
import figure_studies as fs
from PIL import Image
from PIL import ImageDraw
im = np.array(Image.open('original.jpg').convert('L')).astype(int)
# classes: 0 grey, 1 black, 2 white face, -1 ground (white joined to the border)
cls = np.full(im.shape, -2)
cls[im < 70] = 1; cls[(im >= 85) & (im <= 175)] = 0
white = im > 200
# the ground: the white joined to the border, grown out through white a step at a time
ground = np.zeros_like(white); ground[0, :] = white[0, :]; ground[-1, :] = white[-1, :]; ground[:, 0] = white[:, 0]; ground[:, -1] = white[:, -1]
while True:
    g = ground.copy()
    g[1:] |= ground[:-1]; g[:-1] |= ground[1:]; g[:, 1:] |= ground[:, :-1]; g[:, :-1] |= ground[:, 1:]
    g &= white
    if (g == ground).all(): break
    ground = g
cls[white & ~ground] = 2; cls[ground] = -1
np.save('cls.npy', cls)
print('pixels: grey', (cls == 0).sum(), 'black', (cls == 1).sum(), 'white', (cls == 2).sum(), 'edges', (cls == -2).sum())
STEP = 2
C = cls[::STEP, ::STEP]; Hh, Ww = C.shape
ys, xs = np.mgrid[0:Hh, 0:Ww]
valid = C != -2
def render(H, s, cx, cy, k):
    fs.H = H
    boxes = fs.figure()
    d = np.array([-1.0, -1, -1]); d /= np.linalg.norm(d)
    u = np.array([0, -1.0, 1]); u -= d * (u @ d); u /= np.linalg.norm(u)
    r = np.cross(d, u)
    a = (xs * STEP - cx) / s; b = -(ys * STEP - cy) / (s * k)
    O = fs.CENTRE + a[..., None] * r + b[..., None] * u - d * 50
    return fs.cast(boxes, O, np.broadcast_to(d, O.shape))
def err(p):
    t = render(*p)
    return ((t != C) & valid).sum() / valid.sum()
# start: the figure's width 1.992 model units over 499 px
best = [0.11, 250.0, 600.0, 330.0, 1.0]
be = err(best); print('start', best, be)
steps = [0.006, 4.0, 3.0, 3.0, 0.02]
for it in range(6):
    for i in range(5):
        for sgn in (-1, 1):
            q = list(best); q[i] += sgn * steps[i]
            e = err(q)
            if e < be: best, be = q, e
    print(it, [round(v, 4) for v in best], round(be, 4))
    steps = [s0 * 0.6 for s0 in steps]
for it in range(8):
    improved = False
    for i in range(5):
        for sgn in (-1, 1):
            q = list(best); q[i] += sgn * steps[i]
            e = err(q)
            if e < be: best, be, improved = q, e, True
    steps = [s0 * (1.0 if improved else 0.5) for s0 in steps]
print('fit', [round(v, 4) for v in best], 'mismatch', round(be, 4))
np.save('fit.npy', np.array(best))
# the same, with the bar fixed at the golden width (a bar 1/phi^3 of a tribar's side)
PHI = (1 + 5 ** 0.5) / 2
g = list(best); g[0] = PHI ** -3 / 2
gs = [0, 3.0, 2.0, 2.0, 0.02]; ge = err(g)
for it in range(10):
    for i in range(1, 5):
        for sgn in (-1, 1):
            q = list(g); q[i] += sgn * gs[i]
            e = err(q)
            if e < ge: g, ge = q, e
    gs = [s0 * 0.7 for s0 in gs]
print('golden H', round(g[0], 4), [round(v, 4) for v in g], 'mismatch', round(ge, 4))
np.save('fitg.npy', np.array(g))
