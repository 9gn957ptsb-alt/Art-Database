#!/usr/bin/env python3
"""What a face of Rocket's blocks averages to, far off (FAR_SLANT and FAR_ON in docs/worlds/rocket/rocket.js).

Every block is the artist's figure, six bars (FIGURE in rocket.js; the SketchUp model is
scripts/sketchup/impossible_triangle.py). The shader draws a block from its face in: a ray walked block
to block through the solid behind the face, the first bar it meets seen in the tone of the way that bar's
face looks (up white, east and west grey, north and south black), a little deeper (DARKEN) for each block
it has gone in, and the dark between the bars if it is still among them after STEPS blocks. Far off,
where a bar is narrower than a pixel or two, the shader shows instead what this same walk averages to over
many rays into a solid face: the weight of white, grey, black and the dark, for each of the six faces, at
a slant (the ray 0.15 off the face, cosine to its normal) and from nearer straight on (0.75).

    python3 scripts/rocket_far.py      # prints both tables, to paste into rocket.js
"""
import math
import numpy as np

FIGURE = [[0.45, 0.45, 0, 0.55, 0.55, 1], [0, 0, 0.45, 1, 0.1, 0.55], [0.9, 0.1, 0.45, 1, 1, 0.55],
          [0.55, 0.45, 0.45, 0.9, 0.55, 0.55], [0.45, 0.1, 0.45, 0.55, 0.45, 0.55], [0.9, 0.45, 0, 1, 0.55, 0.45]]
LO = np.array([b[:3] for b in FIGURE], float)
HI = np.array([b[3:] for b in FIGURE], float)
N = [(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)]
STEPS, DARKEN = 8, 0.07


def bars(o, inv, t0, t1):
    """The nearest bar a ray meets in a block between t0 and t1: (t, axis of the face met) or (t1, -1)."""
    best, ax = t1, -1
    for i in range(len(FIGURE)):
        a = (LO[i] - o) * inv
        b = (HI[i] - o) * inv
        n, f = np.minimum(a, b), np.maximum(a, b)
        tn, tf = n.max(), f.min()
        if tn <= tf and tf >= t0 and tn < best:
            best, ax = max(tn, t0), int(n.argmax())
    return best, ax


def walk(p0, d, face):
    """From a point on a face, into the solid behind it: ('hit', axis, the way it looks, blocks in) or ('dark',)."""
    c = np.floor(p0 - np.array(N[face], float) * 0.5).astype(int)
    d = np.where(d == 0, 1e-9, d)
    inv = 1 / d
    st = np.sign(d).astype(int)
    tmax = ((c + (st > 0)) - p0) * inv
    tdel = np.abs(inv)
    tin = 0.0
    for k in range(STEPS):
        t, ax = bars(p0 - c, inv, tin, tmax.min())
        if ax >= 0:
            return ("hit", ax, -st[ax], k)
        a = int(tmax.argmin())
        c[a] += st[a]
        tin = tmax[a]
        tmax[a] += tdel[a]
    return ("dark",)


def weights(face, c0, n=5000, seed=3):
    rng = np.random.default_rng(seed)
    nrm = np.array(N[face], float)
    axn = int(np.abs(nrm).argmax())
    e1 = np.cross(nrm, [0, 1.0, 0] if axn != 1 else [1.0, 0, 0])
    e1 /= np.linalg.norm(e1)
    e2 = np.cross(nrm, e1)
    acc = np.zeros(4)
    for _ in range(n):
        c = float(np.clip(c0 + rng.uniform(-0.06, 0.06), 0.02, 0.999))
        s = math.sqrt(1 - c * c)
        ph = rng.uniform(0, 2 * math.pi)
        if axn != 1:
            # A wall is seen from about level: across it half the time, else a little from above (or below).
            ph = rng.uniform(-math.pi / 2, math.pi / 2) if rng.random() < 0.5 else \
                rng.uniform(-0.35, 0.35) + math.pi / 2 * (1 if rng.random() < 0.7 else -1)
        d = -nrm * c + s * (math.cos(ph) * e1 + math.sin(ph) * e2)
        p0 = rng.random(3)
        p0[axn] = 1.0 if nrm[axn] > 0 else 0.0
        r = walk(p0, d, face)
        if r[0] == "hit":
            _, ax, way, k = r
            f = 1 - DARKEN * k
            acc[{1: 0, 0: 1, 2: 2}[ax]] += f * (0.8 if ax == 1 and way < 0 else 1.0)
        else:
            acc[3] += 1
    return [round(float(x), 3) for x in acc / n]


if __name__ == "__main__":
    for name, c0 in (("FAR_SLANT", 0.15), ("FAR_ON", 0.75)):
        print(name, "=", [weights(f, c0) for f in range(6)])
