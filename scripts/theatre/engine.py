"""A small renderer for isometric pixel art.

Everything in the theatre is modelled as signed distance fields and drawn by
casting one ray per pixel at the picture's own resolution, so every pixel is
decided by the thing it lands on rather than scaled down from something
bigger. The camera is the pixel artist's 2:1 isometric: a step along x is one
pixel right and half a pixel down, a step along y one pixel left and half a
pixel down, and z is straight up.

What makes it read as pixel art rather than a render:
  - colour comes from short hand-picked ramps, never from a lighting
    calculation directly: light chooses a step on the ramp;
  - where two steps meet they are dithered through a narrow band with a
    Bayer matrix, the way it is done by hand;
  - light comes from the upper left, so tops are lit, left faces half, right
    faces in shade — the convention everything in the reference follows;
  - everything is outlined, in the darkest tone of what it is next to, and
    the figures in something darker still.
"""

import math

import numpy as np

# ---- the camera ----------------------------------------------------------------------------

ZUP = math.sqrt(1.5)                       # one unit up is this many pixels
P = np.array([[1.0, -1.0, 0.0], [0.5, 0.5, -ZUP]])
TOWARD = np.array([ZUP, ZUP, 1.0])
TOWARD /= np.linalg.norm(TOWARD)           # from the scene toward the camera
PINV = P.T @ np.linalg.inv(P @ P.T)


def project(pt):
    """World point(s) to (u, v) pixels."""
    pt = np.asarray(pt, float)
    return pt @ P.T


def screen_bounds(lo, hi):
    """The pixel rectangle a world box covers."""
    xs = [lo[0], hi[0]]
    ys = [lo[1], hi[1]]
    zs = [lo[2], hi[2]]
    corners = np.array([[x, y, z] for x in xs for y in ys for z in zs])
    uv = project(corners)
    return uv.min(0), uv.max(0)


LIGHT = np.array([-0.18, 0.62, 0.92])
LIGHT /= np.linalg.norm(LIGHT)

BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


# ---- noise ------------------------------------------------------------------------------------

def _hash3(ix, iy, iz, seed=0):
    h = (ix * 374761393 + iy * 668265263 + iz * 2147483647 + seed * 144269504) & 0xFFFFFFFF
    h = (h ^ (h >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65535.0


def noise3(p, scale=1.0, seed=0):
    """Value noise in [0, 1], smooth, over world points (N, 3)."""
    q = p / scale
    i = np.floor(q).astype(np.int64)
    f = q - i
    f = f * f * (3 - 2 * f)
    out = 0.0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = ((f[:, 0] if dx else 1 - f[:, 0]) * (f[:, 1] if dy else 1 - f[:, 1]) *
                     (f[:, 2] if dz else 1 - f[:, 2]))
                out = out + w * _hash3(i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz, seed)
    return out


def fbm(p, scale=1.0, seed=0, octaves=3):
    total, amp, norm = 0.0, 1.0, 0.0
    for o in range(octaves):
        total = total + amp * noise3(p, scale / (2 ** o), seed + o * 17)
        norm += amp
        amp *= 0.5
    return total / norm


def cellhash(ix, iy, iz=0, seed=0):
    return _hash3(np.asarray(ix, np.int64), np.asarray(iy, np.int64), np.asarray(iz, np.int64), seed)


# ---- distance fields --------------------------------------------------------------------------

def _len(v):
    return np.sqrt((v * v).sum(-1))


class Node:
    lo = hi = None

    def dist(self, p):
        return self.eval(p)[0]

    def bound(self, p):
        """A lower bound on the distance: the distance to the bounding box."""
        q = np.maximum(self.lo - p, 0) + np.maximum(p - self.hi, 0)
        return _len(q)


class Prim(Node):
    def __init__(self, fn, lo, hi, mat, group=0, pad=0.5):
        self.fn = fn
        self.lo = np.asarray(lo, float) - pad
        self.hi = np.asarray(hi, float) + pad
        self.mat = mat
        self.group = group

    def eval(self, p):
        d = self.fn(p)
        return d, np.full(len(p), self.mat, np.int32), np.full(len(p), self.group, np.int32)


class Union(Node):
    def __init__(self, children):
        self.children = [c for c in children if c is not None]
        self.lo = np.min([c.lo for c in self.children], 0)
        self.hi = np.max([c.hi for c in self.children], 0)

    def eval(self, p):
        n = len(p)
        d = np.full(n, 1e9)
        m = np.full(n, -1, np.int32)
        g = np.zeros(n, np.int32)
        for c in self.children:
            lb = c.bound(p)
            idx = np.nonzero(lb < d)[0]
            if not len(idx):
                continue
            dc, mc, gc = c.eval(p[idx])
            better = dc < d[idx]
            j = idx[better]
            d[j] = dc[better]
            m[j] = mc[better]
            g[j] = gc[better]
        return d, m, g


class Cut(Node):
    """a with b taken out of it."""

    def __init__(self, a, b):
        self.a, self.b = a, b
        self.lo, self.hi = a.lo, a.hi

    def eval(self, p):
        d, m, g = self.a.eval(p)
        db = self.b.dist(p)
        return np.maximum(d, -db), m, g


class Blend(Node):
    """a and b run together with a smooth seam of width k; the nearer one's material."""

    def __init__(self, a, b, k):
        self.a, self.b, self.k = a, b, k
        self.lo = np.minimum(a.lo, b.lo) - k
        self.hi = np.maximum(a.hi, b.hi) + k

    def eval(self, p):
        da, ma, ga = self.a.eval(p)
        db, mb, gb = self.b.eval(p)
        h = np.clip(0.5 + 0.5 * (db - da) / self.k, 0, 1)
        d = db * (1 - h) + da * h - self.k * h * (1 - h)
        near_a = da < db
        return d, np.where(near_a, ma, mb), np.where(near_a, ga, gb)


class Moved(Node):
    """A node turned about z by `yaw` (radians) and then moved to `at`."""

    def __init__(self, child, at=(0, 0, 0), yaw=0.0, scale=1.0):
        self.child = child
        self.at = np.asarray(at, float)
        self.c, self.s = math.cos(yaw), math.sin(yaw)
        self.k = scale
        corners = np.array([[x, y, z] for x in (child.lo[0], child.hi[0])
                            for y in (child.lo[1], child.hi[1]) for z in (child.lo[2], child.hi[2])])
        w = self._fwd(corners)
        self.lo, self.hi = w.min(0), w.max(0)

    def _fwd(self, q):
        q = q * self.k
        x = q[:, 0] * self.c - q[:, 1] * self.s
        y = q[:, 0] * self.s + q[:, 1] * self.c
        return np.stack([x, y, q[:, 2]], 1) + self.at

    def eval(self, p):
        q = p - self.at
        x = q[:, 0] * self.c + q[:, 1] * self.s
        y = -q[:, 0] * self.s + q[:, 1] * self.c
        d, m, g = self.child.eval(np.stack([x, y, q[:, 2]], 1) / self.k)
        return d * self.k, m, g


class Rough(Node):
    """A node with its surface pushed in and out by noise, for rock and earth."""

    def __init__(self, child, amp, scale, seed=0):
        self.child, self.amp, self.scale, self.seed = child, amp, scale, seed
        self.lo, self.hi = child.lo - amp, child.hi + amp

    def eval(self, p):
        d, m, g = self.child.eval(p)
        near = d < self.amp * 2 + 1
        if near.any():
            d = d.copy()
            d[near] += (fbm(p[near], self.scale, self.seed) - 0.5) * 2 * self.amp
        return d * 0.8, m, g


# ---- primitives, each placed in world coordinates ------------------------------------------------

def sphere(c, r, mat, group=0):
    c = np.asarray(c, float)
    return Prim(lambda p: _len(p - c) - r, c - r, c + r, mat, group)


def ellipsoid(c, r, mat, group=0):
    c = np.asarray(c, float)
    r = np.asarray(r, float)

    def fn(p):
        q = (p - c) / r
        k0 = _len(q)
        k1 = _len(q / r)
        return k0 * (k0 - 1.0) / np.maximum(k1, 1e-6)
    return Prim(fn, c - r, c + r, mat, group)


def box(lo, hi, mat, group=0, round=0.0):
    lo = np.asarray(lo, float)
    hi = np.asarray(hi, float)
    c = (lo + hi) / 2
    h = (hi - lo) / 2 - round

    def fn(p):
        q = np.abs(p - c) - h
        return _len(np.maximum(q, 0)) + np.minimum(q.max(1), 0) - round
    return Prim(fn, lo, hi, mat, group)


def cylinder(c, r, h, mat, group=0):
    """Upright, standing on c."""
    c = np.asarray(c, float)

    def fn(p):
        q = p - c
        dx = np.sqrt(q[:, 0] ** 2 + q[:, 1] ** 2) - r
        dz = np.abs(q[:, 2] - h / 2) - h / 2
        return np.minimum(np.maximum(dx, dz), 0) + _len(np.stack([np.maximum(dx, 0), np.maximum(dz, 0)], 1))
    return Prim(fn, c - [r, r, 0], c + [r, r, h], mat, group)


def cone(c, r0, r1, h, mat, group=0):
    """A frustum standing on c: radius r0 at the bottom, r1 at the top."""
    c = np.asarray(c, float)
    rm = max(r0, r1)

    def fn(p):
        q = p - c
        rr = np.sqrt(q[:, 0] ** 2 + q[:, 1] ** 2)
        z = q[:, 2]
        t = np.clip(z / h, 0, 1)
        rad = r0 + (r1 - r0) * t
        slope = math.sqrt(1 + ((r1 - r0) / h) ** 2)
        dx = (rr - rad) / slope
        dz = np.abs(z - h / 2) - h / 2
        return np.minimum(np.maximum(dx, dz), 0) + _len(np.stack([np.maximum(dx, 0), np.maximum(dz, 0)], 1))
    return Prim(fn, c - [rm, rm, 0], c + [rm, rm, h], mat, group)


def capsule(a, b, r, mat, group=0, r1=None):
    """A rod from a to b; radius r at a, r1 (or r) at b."""
    a = np.asarray(a, float)
    b = np.asarray(b, float)
    r1 = r if r1 is None else r1
    ba = b - a
    bb = float(ba @ ba) or 1e-6

    def fn(p):
        pa = p - a
        h = np.clip((pa @ ba) / bb, 0, 1)
        return _len(pa - np.outer(h, ba)) - (r + (r1 - r) * h)
    rm = max(r, r1)
    return Prim(fn, np.minimum(a, b) - rm, np.maximum(a, b) + rm, mat, group)


def torus(c, R, r, mat, group=0):
    c = np.asarray(c, float)

    def fn(p):
        q = p - c
        xy = np.sqrt(q[:, 0] ** 2 + q[:, 1] ** 2) - R
        return np.sqrt(xy ** 2 + q[:, 2] ** 2) - r
    return Prim(fn, c - [R + r, R + r, r], c + [R + r, R + r, r], mat, group)


def slab(lo, hi, mat, group=0, bend=0.0, axis=0):
    """A box whose far side bows out by `bend` in the middle — a cape, a sail."""
    lo = np.asarray(lo, float)
    hi = np.asarray(hi, float)
    c = (lo + hi) / 2
    h = (hi - lo) / 2

    def fn(p):
        q = p - c
        if bend:
            span = h[2] if axis == 0 else h[0]
            t = (q[:, 2] / max(h[2], 1e-6)) if axis == 0 else (q[:, 0] / max(h[0], 1e-6))
            q = q.copy()
            q[:, 1 if axis == 0 else 1] -= bend * (1 - np.clip(t, -1, 1) ** 2) if axis == 1 else bend * (np.clip(t, -1, 1) + 1) / 2
        q = np.abs(q) - h
        return _len(np.maximum(q, 0)) + np.minimum(q.max(1), 0)
    pad = abs(bend) + 0.5
    return Prim(fn, lo - pad, hi + pad, mat, group)


def custom(fn, lo, hi, mat, group=0):
    return Prim(fn, lo, hi, mat, group)


# ---- materials ---------------------------------------------------------------------------------

def hexes(*cs):
    return np.array([[int(c[i:i + 2], 16) for i in (1, 3, 5)] for c in cs], np.float64)


class Material:
    """A ramp of colours, dark to light, and how the surface varies.

    tex(p, n, frame) -> offset added to the light level before the ramp is read
    (mortar lines are negative, a glint positive). glow: drawn at full value
    regardless of light. spec: a hard highlight at the top of the ramp.
    """

    def __init__(self, ramp, tex=None, glow=False, spec=0.0, rim=0.0, flat=False, colour=None):
        self.ramp = hexes(*ramp)
        self.tex = tex
        self.glow = glow
        self.spec = spec
        self.rim = rim
        self.flat = flat
        self.colour = colour         # fn(p, n, frame, level) -> rgb (N,3), for DIRT


# ---- casting -------------------------------------------------------------------------------------

def march(scene, o, d, tmax, steps=220, eps=0.03):
    n = len(o)
    t = np.zeros(n)
    alive = np.ones(n, bool)
    hit = np.zeros(n, bool)
    for _ in range(steps):
        idx = np.nonzero(alive)[0]
        if not len(idx):
            break
        p = o[idx] + d[idx] * t[idx, None]
        dist = scene.dist(p)
        h = dist < eps
        hit[idx[h]] = True
        alive[idx[h]] = False
        step = np.maximum(dist, eps * 0.5)
        t[idx] += np.where(h, 0, step)
        gone = t[idx] > tmax
        alive[idx[gone]] = False
    return t, hit


def normals(scene, p, e=0.06):
    k = np.array([[1, -1, -1], [-1, -1, 1], [-1, 1, -1], [1, 1, 1]], float)
    n = np.zeros_like(p)
    for v in k:
        n += v * scene.dist(p + v * e)[:, None]
    return n / np.maximum(_len(n)[:, None], 1e-9)


def soft_shadow(scene, p, l, k=10.0, tmax=60.0, steps=48):
    res = np.ones(len(p))
    t = np.full(len(p), 0.4)
    alive = np.ones(len(p), bool)
    for _ in range(steps):
        idx = np.nonzero(alive)[0]
        if not len(idx):
            break
        h = scene.dist(p[idx] + l * t[idx, None])
        res[idx] = np.minimum(res[idx], np.clip(k * h / t[idx], 0, 1))
        t[idx] += np.clip(h, 0.15, 3.0)
        done = (h < 0.005) | (t[idx] > tmax)
        res[idx[h < 0.005]] = 0
        alive[idx[done]] = False
    return res


def occlusion(scene, p, n):
    ao = np.zeros(len(p))
    w = 1.0
    for hstep in (0.6, 1.5, 3.0, 5.0):
        d = scene.dist(p + n * hstep)
        ao += w * np.clip(hstep - d, 0, None) / hstep
        w *= 0.6
    return np.clip(1 - 0.55 * ao, 0.35, 1)


class Frame:
    """What one render produced, pixel by pixel."""

    def __init__(self, w, h):
        self.rgb = np.zeros((h, w, 3))
        self.alpha = np.zeros((h, w), bool)
        self.depth = np.full((h, w), 1e9)
        self.group = np.full((h, w), -1, np.int32)
        self.mat = np.full((h, w), -1, np.int32)
        self.level = np.zeros((h, w), np.int32)


def render(scene, materials, origin, size, frame=0, shadows=True, ambient=0.30, outline=True,
           ink=(20, 14, 22), figure_ink=(12, 8, 14), figures=(), light=LIGHT):
    """Draw `scene` into a size = (w, h) picture whose top-left pixel is at `origin` (u, v)."""
    w, h = size
    uu, vv = np.meshgrid(np.arange(w) + origin[0] + 0.5, np.arange(h) + origin[1] + 0.5)
    uv = np.stack([uu.ravel(), vv.ravel()], 1)
    base = uv @ PINV.T
    far = 600.0
    o = base + TOWARD * far
    d = np.tile(-TOWARD, (len(o), 1))
    t, hit = march(scene, o, d, far * 2)
    out = Frame(w, h)
    idx = np.nonzero(hit)[0]
    if not len(idx):
        return out
    p = o[idx] + d[idx] * t[idx, None]
    dist, mat, grp = scene.eval(p)
    n = normals(scene, p)
    lam = np.clip(n @ light, 0, 1)
    sh = soft_shadow(scene, p + n * 0.25, light) if shadows else 1.0
    ao = occlusion(scene, p, n)
    level = (ambient + (1 - ambient) * lam * (0.35 + 0.65 * sh)) * ao

    yy, xx = np.divmod(idx, w)
    dith = BAYER4[yy % 4, xx % 4]
    rgb = np.zeros((len(idx), 3))
    lvl = np.zeros(len(idx), np.int32)
    for mid in np.unique(mat):
        if mid < 0:
            continue
        M = materials[mid]
        sel = mat == mid
        lv = level[sel].copy()
        if M.tex is not None:
            lv = lv + M.tex(p[sel], n[sel], frame)
        # A rim of light down the lit edge of anything rounded, as a pixel artist
        # would pick out the side of a sleeve or a cheek.
        facing = np.clip(1 - np.abs(n[sel] @ TOWARD), 0, 1)
        lv = lv + (M.rim or 0.14) * facing ** 3 * np.clip(n[sel] @ light + 0.1, 0, 1)
        if M.spec:
            half = light + TOWARD
            half /= np.linalg.norm(half)
            lv = lv + M.spec * np.clip(n[sel] @ half, 0, 1) ** 24
        if M.glow:
            lv = np.ones(sel.sum()) * 0.99 + (M.tex(p[sel], n[sel], frame) if M.tex else 0)
        k = len(M.ramp)
        x = np.clip(lv, 0, 1) * (k - 1)
        base_i = np.floor(x)
        frac = x - base_i
        # A narrow band either side of each step is dithered; the rest is flat.
        band = 0.22
        up = np.where(frac > 0.5 + band, 1, np.where(frac < 0.5 - band, 0,
                      (dith[sel] < (frac - (0.5 - band)) / (2 * band)).astype(int)))
        i = np.clip(base_i.astype(int) + up, 0, k - 1)
        if M.colour is not None:
            rgb[sel] = M.colour(p[sel], n[sel], frame, i, k)
        else:
            rgb[sel] = M.ramp[i]
        lvl[sel] = i

    out.rgb.reshape(-1, 3)[idx] = rgb
    out.alpha.reshape(-1)[idx] = True
    out.depth.reshape(-1)[idx] = -(p @ TOWARD)        # larger is further away
    out.group.reshape(-1)[idx] = grp
    out.mat.reshape(-1)[idx] = mat
    out.level.reshape(-1)[idx] = lvl
    if outline:
        ink_lines(out, materials, ink, figure_ink, figures)
    return out


def ink_lines(f, materials, ink, figure_ink, figures):
    """Outlines: round the outside in ink, and inside wherever one thing stands in front of
    another, in the darkest tone of the thing behind."""
    a = f.alpha
    h, w = a.shape
    edge_out = np.zeros_like(a)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        sh = np.zeros_like(a)
        ys = slice(max(dy, 0), h + min(dy, 0))
        yd = slice(max(-dy, 0), h + min(-dy, 0))
        xs = slice(max(dx, 0), w + min(dx, 0))
        xd = slice(max(-dx, 0), w + min(-dx, 0))
        sh[yd, xd] = a[ys, xs]
        edge_out |= (~a) & sh
    # An ink pixel takes the figure ink if what it rims is a figure.
    fig = np.isin(f.group, list(figures)) if figures else np.zeros_like(a)
    near_fig = np.zeros_like(a)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        sh = np.zeros_like(a)
        ys = slice(max(dy, 0), h + min(dy, 0))
        yd = slice(max(-dy, 0), h + min(-dy, 0))
        xs = slice(max(dx, 0), w + min(dx, 0))
        xd = slice(max(-dx, 0), w + min(-dx, 0))
        sh[yd, xd] = fig[ys, xs]
        near_fig |= sh
    f.rgb[edge_out] = np.where(near_fig[edge_out, None], figure_ink, ink)
    f.alpha = a | edge_out
    f.mat[edge_out] = -2

    # Inside: a pixel whose neighbour below or to the side is much nearer, or belongs to a
    # different figure, is drawn as a line.
    d = f.depth
    g = f.group
    inner = np.zeros_like(a)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        ys = slice(max(dy, 0), h + min(dy, 0))
        yd = slice(max(-dy, 0), h + min(-dy, 0))
        xs = slice(max(dx, 0), w + min(dx, 0))
        xd = slice(max(-dx, 0), w + min(-dx, 0))
        nd = np.full_like(d, 1e9)
        nd[yd, xd] = d[ys, xs]
        ng = np.full_like(g, -1)
        ng[yd, xd] = g[ys, xs]
        jump = (nd < d - 3.0) & a
        other = (ng != g) & (ng >= 0) & (nd < d - 0.8) & (np.isin(ng, list(figures)) if figures else False)
        inner |= jump | other
    inner &= a & (f.mat >= 0)
    for mid in np.unique(f.mat[inner]):
        sel = inner & (f.mat == mid)
        dark = materials[mid].ramp[0] * 0.7
        f.rgb[sel] = dark


def to_image(f, scale=1):
    from PIL import Image
    h, w = f.alpha.shape
    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[..., :3] = np.clip(f.rgb, 0, 255).astype(np.uint8)
    rgba[..., 3] = np.where(f.alpha, 255, 0)
    im = Image.fromarray(rgba, "RGBA")
    if scale != 1:
        im = im.resize((w * scale, h * scale), Image.NEAREST)
    return im
