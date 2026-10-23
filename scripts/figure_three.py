#!/usr/bin/env python3
"""The third figure of the impossible triangle: the curve that makes it possible (artist, 15 Oct 2026: "it is
not quite possible without the introduction of a curve in three dimensional space ... consider the perspective
points in which the Impossible Triangle would make sense in relation to the forms of architecture that you
build ... I like how when you get close to an aspect of architecture, a transparency, awakens, and as you
progress further from the structure, it closes back up ... I want one more version of a figure of the
impossible triangle"). The first is the figure in place, six square bars whose ends meet only down the
diagonal, seen from above, as the site draws its buildings (FIGURE in rocket.js; figure_studies.py); the
second is being made in the game's own session; this is the third.

The figure is the first's six bars (figure_studies.figure(): three tribars, nine beams on a lattice of cubes),
made one closed object. Every point of it may be slid along the line of sight without changing the drawing,
so long as nothing that was in front comes to be behind. Two slides make it:

  the closure   each tribar's path rises √3 along the line of sight going once round it (that rise is its
                cut); here every beam gives up the same share of its rise in its middle, its joints held
                square, so each cut's two ends come down to EPS apart: the near end's cube sits just in front
                of the far end's and fuses with it, the two arms parting as they leave it, so from the eye the
                near one still passes in front as the drawing has it;
  the vault     every sightline slid by one paraboloid over the drawing, springing at its three outer
                corners and rising to a crown at its middle, the rise the side over φ²: the beams bow into
                ribs. (A slide of whole sightlines can never change what is in front.)

Then it is turned over, so that it closes from below: looked up at along the diagonal, arctan(1/√2) above the
level, as a person sees a vault, an overhang or a building's corner from the street. Its tones are the
drawing's, blended where its faces turn: a face's weights are the squares of its normal's parts along the
figure's own three axes (grey, black, white), which sum to one, so at its square joints the tones are the
drawing's and along the ribs they run into each other.

    python3 scripts/figure_three.py                 # writes docs/worlds/rocket/homage.json (the three figures)
    python3 scripts/figure_three.py --check         # and checks, pixel by pixel, that from its eye it is the drawing
    python3 scripts/figure_three.py --sheet out.png # and a sheet: closed, turned, and near (perspective)

Model axes as figure_studies.py's: SketchUp's (x, y, z up) in cells of the lattice. Needs numpy (Pillow for
--sheet).
"""
import json
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import figure_studies as fs  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "worlds", "rocket", "homage.json")
PHI = (1 + 5 ** 0.5) / 2
H = fs.H
NH = fs.NH                       # towards the eye that sees the drawing (from above, before it is turned over)
R3 = math.sqrt(3)
EPS = 0.30                       # how far apart a cut's two cubes are left along the line of sight (see --check)
ALONG, ACROSS, END = 20, 3, 3    # the mesh: steps along a beam's middle, across each face, along each joint
TURN = np.array([[0, -1, 0], [-1, 0, 0], [0, 0, -1]], float)   # half a turn about (1, -1, 0): it closes from below


def beams():
    """The nine beams: each from lattice point a to b, one cell along axis k, and its box."""
    out = []
    for (r, t), base, nm in zip(fs.CONF, fs.BASE, "ABC"):
        p = np.array(base, float) + t + fs.OFFS[r]
        for ax in fs.ORDERS[r]:
            q = p.copy()
            q[ax] += 1
            out.append({"a": p.copy(), "b": q, "k": ax, "part": nm})
            p = q
    return out


def theta(p):
    """How far round the figure a lattice point is, in turns of a tribar: a third a beam, so a cut's near end
    is one more than its far end."""
    return float(np.sum(p)) / 3


def smooth(u):
    u = np.clip(u, 0, 1)
    return u * u * (3 - 2 * u)


def dsmooth(u):
    inside = (u > 0) & (u < 1)
    return np.where(inside, 6 * u * (1 - u), 0.0)


# The drawing's plane: right, up, and its middle.
RV, UV = fs.RV, fs.UPV
C2 = np.array([fs.CENTRE @ RV, fs.CENTRE @ UV])
CORNERS = [np.array(c, float) for c in [(0, 0, 0), (-1, 1, -1), (1, 1, -1)]]   # the outer joints, in the drawing
RHO = float(np.mean([np.hypot(c @ RV - C2[0], c @ UV - C2[1]) for c in CORNERS]))
SIDE = RHO * R3
RISE = SIDE / PHI ** 2


def relief(p):
    """The vault: each sightline slid by a paraboloid over the drawing, 0 at the outer corners, −RISE at the
    middle (away from the eye above; after the turn, up and away from the eye below). Returns the slide and
    its gradient (in the drawing's plane)."""
    a, b = p @ RV - C2[0], p @ UV - C2[1]
    r2 = a * a + b * b
    f = -RISE * (1 - r2 / RHO ** 2)
    gq = (2 * RISE / RHO ** 2) * (a[..., None] * RV + b[..., None] * UV)
    return f, gq


def slide(bm, p):
    """The figure's points p (n x 3, on beam bm, original) moved along the line of sight, with the gradient of
    the slide (for the normals)."""
    k, a = bm["k"], bm["a"]
    s = p[:, k] - a[k]
    u = (s - H) / (1 - 2 * H)
    th = theta(a) + smooth(u) / 3
    dth = dsmooth(u) / (3 * (1 - 2 * H))
    d = -(R3 - EPS) * th
    grad = np.zeros_like(p)
    grad[:, k] = -(R3 - EPS) * dth
    f, gq = relief(p)
    return d + f, grad + gq


def face_grid(lo, hi, k, side, bm):
    """A face of a box (the pair facing axis k, side 0 or 1) as a grid of points, finer along the beam."""
    u_ax, v_ax = (k + 1) % 3, (k + 2) % 3

    def steps(ax):
        if ax == bm["k"]:
            # Its joints too: the vault bends them, and a joint in one step lets a face behind show through.
            a = bm["a"][ax]
            return np.concatenate([np.linspace(a - H, a + H, END + 1)[:-1], np.linspace(a + H, a + 1 - H, ALONG + 1),
                                   np.linspace(a + 1 - H, a + 1 + H, END + 1)[1:]])
        return np.linspace(lo[ax], hi[ax], ACROSS + 1)

    us, vs = steps(u_ax), steps(v_ax)
    P = np.zeros((len(us), len(vs), 3))
    P[..., k] = hi[k] if side else lo[k]
    P[..., u_ax] = us[:, None]
    P[..., v_ax] = vs[None, :]
    return P, u_ax, v_ax


def mesh(closed=True):
    """The figure's surface as triangles: positions (moved), normals (in the figure's own axes, before it is
    turned over), each face's pair (its tone in the drawing), and the beam it is of."""
    V, N, K, T = [], [], [], []
    for j, bm in enumerate(beams()):
        lo = np.minimum(bm["a"], bm["b"]) - H
        hi = np.maximum(bm["a"], bm["b"]) + H
        for k in range(3):
            for side in (0, 1):
                P, ua, va = face_grid(lo, hi, k, side, bm)
                n0 = np.zeros(3)
                n0[k] = 1 if side else -1
                flat = P.reshape(-1, 3)
                if closed:
                    g, grad = slide(bm, flat)
                    Q = flat + g[:, None] * NH
                    # A normal under p -> p + NH g(p) goes by the inverse transpose: n - grad (NH . n) / (1 + grad . NH).
                    nn = n0[None, :] - grad * (NH @ n0) / (1 + grad @ NH)[:, None]
                    nn /= np.linalg.norm(nn, axis=1, keepdims=True)
                else:
                    Q, nn = flat, np.repeat(n0[None, :], len(flat), 0)
                base = len(V)
                V.extend(Q)
                N.extend(nn)
                nu, nv = P.shape[0], P.shape[1]
                for iu in range(nu - 1):
                    for iv in range(nv - 1):
                        i00, i01 = base + iu * nv + iv, base + iu * nv + iv + 1
                        i10, i11 = base + (iu + 1) * nv + iv, base + (iu + 1) * nv + iv + 1
                        # Wound to face out.
                        if (side == 1) == ((ua - k) % 3 == 1):
                            T.extend([(i00, i10, i11), (i00, i11, i01)])
                        else:
                            T.extend([(i00, i11, i10), (i00, i01, i11)])
                        K.extend([k, k])
    return np.array(V), np.array(N), np.array(T), np.array(K)


# ---- seeing it: a z-buffer, orthographic or from an eye ------------------------------------------------

def raster(V, T, K, eye_dir=None, up=None, eye=None, target=None, fov=30, size=360, span=None, centre=None, tone=None):
    """Draw the triangles: from far along eye_dir (orthographic, span across), or from a point eye looking at
    target (perspective, fov degrees). Returns the face pair seen at each pixel (-1 none) and, with tone (n x 3
    weights a vertex), the tone."""
    if eye is None:
        f = -np.array(eye_dir, float)
        f /= np.linalg.norm(f)
    else:
        f = np.array(target, float) - np.array(eye, float)
        f /= np.linalg.norm(f)
    u = np.array(up, float)
    u = u - f * (u @ f)
    u /= np.linalg.norm(u)
    r = np.cross(f, u)
    if eye is None:
        c = np.array(centre, float)
        x = (V - c) @ r / (span / 2)
        y = (V - c) @ u / (span / 2)
        z = -(V - c) @ f                     # larger nearer
    else:
        q = V - np.array(eye, float)
        zf = q @ f
        th = math.tan(math.radians(fov) / 2)
        x = (q @ r) / (zf * th)
        y = (q @ u) / (zf * th)
        z = -zf
    px = (x + 1) * size / 2
    py = (1 - y) * size / 2
    best = np.full((size, size), -np.inf)
    seen = np.full((size, size), -1, int)
    col = np.zeros((size, size)) if tone is not None else None
    for t_i, (i, j, k) in enumerate(T):
        xs, ys, zs = px[[i, j, k]], py[[i, j, k]], z[[i, j, k]]
        x0, x1 = int(max(0, math.floor(xs.min()))), int(min(size - 1, math.ceil(xs.max())))
        y0, y1 = int(max(0, math.floor(ys.min()))), int(min(size - 1, math.ceil(ys.max())))
        if x0 > x1 or y0 > y1:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        d = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(d) < 1e-12:
            continue
        l0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / d
        l1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / d
        l2 = 1 - l0 - l1
        ins = (l0 >= -1e-9) & (l1 >= -1e-9) & (l2 >= -1e-9)
        if not ins.any():
            continue
        zz = l0 * zs[0] + l1 * zs[1] + l2 * zs[2]
        sub = best[y0:y1 + 1, x0:x1 + 1]
        win = ins & (zz > sub)
        sub[win] = zz[win]
        seen[y0:y1 + 1, x0:x1 + 1][win] = K[t_i]
        if tone is not None:
            w = tone[i] * l0[..., None] + tone[j] * l1[..., None] + tone[k] * l2[..., None]
            col[y0:y1 + 1, x0:x1 + 1][win] = (w @ np.array([0.5, 0.03, 0.97]))[win]
    return seen, col


def check(size=520):
    """From its eye (above, before the turn) the closed figure is the drawing: the face seen at every pixel is
    the one the first figure shows there."""
    V0, N0, T0, K0 = mesh(closed=False)
    V1, N1, T1, K1 = mesh(closed=True)
    pts = np.concatenate([V0, V1])
    c = pts.mean(0)
    span = 1.15 * max(np.ptp(pts @ fs.RV), np.ptp(pts @ fs.UPV))
    a, _ = raster(V0, T0, K0, eye_dir=NH, up=fs.UPV, centre=c, span=span, size=size)
    b, _ = raster(V1, T1, K1, eye_dir=NH, up=fs.UPV, centre=c, span=span, size=size)
    diff = a != b
    # A pixel on an edge of the first's drawing may fall either way: only a difference with no edge next to it counts.
    edge = np.zeros_like(diff)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            edge |= a != np.roll(np.roll(a, dy, 0), dx, 1)
    real = diff & ~edge
    return int(real.sum()), int(diff.sum()), int((a >= 0).sum())


def turned(V, N):
    """Turned over, to close from below."""
    return V @ TURN.T, N @ TURN.T


def first_boxes():
    """The first figure, as boxes [lo, hi] in cells: the nine beams (the six bars, its long ones in two)."""
    return [[*map(float, np.minimum(b["a"], b["b"]) - H), *map(float, np.maximum(b["a"], b["b"]) + H)] for b in beams()]


def second():
    """The second figure, the third study of the figure (the figure and Bent, figure_studies.py): the first's nine beams,
    every point moved along the line of sight by a bow across the drawing and a lean up it (fs.bend), as lofts of 17
    stations a beam, closed at their ends. Moved only along the line of sight, it is the drawing exactly from its eye,
    and from anywhere else its beams curve away; it is looked at level, from the stone before its plinth. A mesh:
    positions, each vertex's tone by its face's normal in the figure's own axes (as the third's), triangles."""
    lofts = [st for st in fs.studies() if st["key"] == "bent"][0]["lofts"]
    V, N, T = [], [], []

    def quad(a, b, c, d):
        n = np.cross(np.subtract(b, a), np.subtract(d, a))
        n = n / (np.linalg.norm(n) or 1)
        k = len(V)
        for p in (a, b, c, d):
            V.append(p)
            N.append(n)
        T.extend([k, k + 1, k + 2, k, k + 2, k + 3])
    for lf in lofts:
        st = [np.array(ring, float) for ring in lf["stations"]]
        for s0, s1 in zip(st[:-1], st[1:]):
            for i in range(4):
                j = (i + 1) % 4
                quad(s0[i], s0[j], s1[j], s1[i])
        quad(*st[0][::-1])
        quad(*st[-1])
    return np.array(V), np.array(N), np.array(T)


def two_data(q):
    V, N, T = second()
    lo, hi = V.min(0), V.max(0)
    return {"name": "The second figure", "eye": [round(float(x), 6) for x in NH], "up": [round(float(x), 6) for x in fs.UPV], "look": 0,
            "v": q(V, 1000), "w": q(N ** 2, 255), "t": [int(i) for i in T.flatten()],
            "box": [round(float(x), 4) for x in [*lo, *hi]],
            "said": "The same nine beams, every point moved along the line of sight by a bow across the drawing: from this "
                    "stone they are straight and it is the drawing; a step aside and they curve away. The third study of "
                    "the figure, after the figure and Bent."}


def export(path):
    V, N, T, K = mesh(closed=True)
    V, N = turned(V, N)
    # The tones by the normal in the figure's own axes, before the turn (so from its eye it is the drawing's).
    _, N_own, _, _ = mesh(closed=True)
    W = N_own ** 2
    q = lambda x, s: [int(round(v * s)) for v in x.flatten()]
    lo, hi = V.min(0), V.max(0)
    data = {
        "note": "The three figures of the impossible triangle for the homage site at the start of the first world "
                "(scripts/figure_three.py; docs/worlds/rocket/homage.js). Model axes x, y, z up, in cells of the "
                "lattice. Each: eye, towards where it closes from; up, the drawing's up (with eye, its right); "
                "look, the slope in degrees it is looked at along on the site (positive: looked down on, from a "
                "step; negative: looked up at, hung in a gate; about 0: level, on a plinth); said, what the site "
                "says of it from its stone. one: the first, as boxes [x0, y0, z0, x1, y1, z1], each face's tone "
                "by its axis (x grey, y black, z white). three: the third, a mesh: v positions x1000, w each "
                "vertex's tone weights (grey, black, white) x255, t triangles. two: the second, the third study of the "
                "figure (the figure and Bent: its beams bowed along the line of sight), a mesh as three.",
        "one": {"name": "The first figure", "boxes": [[round(v, 4) for v in b] for b in first_boxes()],
                "eye": [round(float(x), 6) for x in NH], "up": [round(float(x), 6) for x in fs.UPV],
                "look": round(math.degrees(math.atan(1 / math.sqrt(2))), 4),
                "said": "Six bars whose ends meet only down the diagonal: it closes from above, as the site draws its buildings."},
        "two": two_data(q),
        "three": {"name": "The third figure", "eye": [round(float(x), 6) for x in TURN @ NH],
                  "up": [round(float(x), 6) for x in TURN @ fs.UPV],
                  "look": -round(math.degrees(math.atan(1 / math.sqrt(2))), 4),
                  "v": q(V, 1000), "w": q(W, 255), "t": [int(i) for i in T.flatten()],
                  "box": [round(float(x), 4) for x in [*lo, *hi]],
                  "eps": EPS, "rise": round(RISE, 4),
                  "said": "The same six bars made one closed thing by a curve: each cut brought together, every bar "
                          "bowed into a rib of a vault. It closes from below, as you look up at a building."},
    }
    with open(path, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    return data


def sheet(path, size=300):
    from PIL import Image, ImageDraw
    V, N, T, K = mesh(closed=True)
    _, N_own, _, _ = mesh(closed=True)
    Vt, _ = turned(V, N)
    W = N_own ** 2
    V0, _, T0, K0 = mesh(closed=False)
    eye3 = TURN @ NH
    cen = Vt.mean(0)
    span = 1.2 * max(np.ptp(Vt, 0))
    up_below = np.array([0, 0, 1.0]) - eye3 * eye3[2]
    views = [
        ("first, from above (the drawing)", V0, T0, K0, None, dict(eye_dir=NH, up=fs.UPV, centre=V0.mean(0), span=span)),
        ("third, from below (the drawing)", Vt, T, K, W, dict(eye_dir=eye3, up=TURN @ fs.UPV, centre=cen, span=span)),
        ("third, from the side", Vt, T, K, W, dict(eye_dir=np.array([1.0, -0.2, 0.05]), up=[0, 0, 1], centre=cen, span=span)),
        ("third, from below and aside", Vt, T, K, W, dict(eye_dir=np.array([-0.2, -1.0, -0.55]), up=[0, 0, 1], centre=cen, span=span)),
        ("third, near (perspective)", Vt, T, K, W, dict(eye=cen + eye3 * 3.2, target=cen, up=up_below, fov=50)),
        ("third, far (perspective)", Vt, T, K, W, dict(eye=cen + eye3 * 14, target=cen, up=up_below, fov=13)),
    ]
    img = Image.new("RGB", (size * 3, (size + 22) * 2), (240, 236, 228))
    dr = ImageDraw.Draw(img)
    for i, (label, VV, TT, KK, WW, kw) in enumerate(views):
        seen, col = raster(VV, TT, KK, size=size, tone=WW, **kw)
        a = np.full((size, size, 3), 240, np.uint8)
        a[..., 1] = 236
        a[..., 2] = 228
        if col is None:
            for k, v in ((0, 128), (1, 8), (2, 247)):
                a[seen == k] = v
        else:
            g = (np.clip(col, 0, 1) * 255).astype(np.uint8)
            m = seen >= 0
            a[m] = np.stack([g, g, g], -1)[m]
        x0, y0 = (i % 3) * size, (i // 3) * (size + 22)
        img.paste(Image.fromarray(a), (x0, y0 + 22))
        dr.text((x0 + 6, y0 + 5), label, fill=(0, 0, 0))
    img.save(path)


if __name__ == "__main__":
    data = export(OUT)
    print("homage.json: one %d boxes, three %d vertices %d triangles, rise %.3f, eps %.2f, %d KB" % (
        len(data["one"]["boxes"]), len(data["three"]["v"]) // 3, len(data["three"]["t"]) // 3, RISE, EPS,
        os.path.getsize(OUT) // 1024))
    if "--check" in sys.argv:
        real, any_, cover = check()
        print("closing view: %d pixels differ off the edges (%d on them) of %d drawn" % (real, any_, cover))
    if "--sheet" in sys.argv:
        sheet(sys.argv[sys.argv.index("--sheet") + 1])
