"""Composing a scene: the set, the figures in it, and the finishing passes a pixel artist
would do by hand — faces, the glow round a flame, night, a ghost you can see through, mist,
and the clouds a night scene is framed by."""

import math

import numpy as np

from engine import (Union, custom, render, project, screen_bounds, TOWARD, BAYER4, _len, fbm, noise3,
                    cellhash, hexes)
from palette import MATERIALS, MAT

EYE = np.array([22, 12, 16], float)
SOCKET = np.array([40, 30, 26], float)
INK = np.array([20, 14, 22], float)

GLOWS = {MAT[k] for k in ("window", "moon", "flame", "ghost", "magic", "glow_green", "smoke", "lightning")}


def _shift(a, dy, dx):
    """a moved by (dy, dx) with nothing coming in round the edges."""
    out = np.zeros_like(a)
    h, w = a.shape
    out[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = a[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
    return out


def ground_z(node, x, y, top=120.0):
    """How high the surface of `node` is at (x, y), found by coming down on it."""
    z = top
    for _ in range(400):
        d = node.dist(np.array([[x, y, z]], float))[0]
        if d < 0.05:
            return z
        z -= max(d, 0.05)
        if z < -60:
            break
    return 0.0


def clod(w, d, depth=11.0, seed=0, top="grass", rough=1.4, lip=1.6, top_rough=2.2, earth="dirt"):
    """A piece of DIRT cut out of the ground with whatever grows on it on top: a chunky island,
    its edge bitten and uneven and narrower underneath, the way an isometric sprite sheet's
    tiles are."""
    def fn(p):
        q = np.abs(p - np.array([w / 2, d / 2, -depth / 2])) - np.array([w / 2, d / 2, depth / 2])
        base = _len(np.maximum(q, 0)) + np.minimum(q.max(1), 0) - 1.0
        edge = (fbm(p * np.array([1, 1, 0.35]), 7.0, seed) - 0.5) * 2 * rough
        under = np.clip(-p[:, 2] / depth, 0, 1)
        taper = under ** 1.5 * 6.0                              # narrower underneath
        return base + edge + taper
    earth = custom(fn, (-4, -4, -depth - 2), (w + 4, d + 4, 1.5), MAT[earth])
    if not top:
        return earth

    def top_fn(p):
        q = np.abs(p - np.array([w / 2, d / 2, 0.5])) - np.array([w / 2 - lip, d / 2 - lip, 0.8])
        b = _len(np.maximum(q, 0)) + np.minimum(q.max(1), 0) - 0.6
        return b + (fbm(p, 6.0, seed + 3) - 0.5) * 2 * top_rough
    cover = custom(top_fn, (lip - 4, lip - 4, -1.5), (w - lip + 4, d - lip + 4, 2.4), MAT[top])
    return Union([earth, cover])


def faces(frame, figures, speaking=None, ghosts=()):
    """Eyes, sockets and an open mouth, put in as single pixels where they can be seen."""
    for gid, fig in figures.items():
        eye = np.array([240, 250, 255], float) if gid in ghosts else EYE
        pts = [(p, eye) for p in fig.face.get("eyes", [])]
        pts += [(p, SOCKET) for p in fig.face.get("sockets", [])]
        if speaking == gid and fig.face.get("mouth") is not None:
            pts.append((fig.face["mouth"], np.array([96, 34, 36], float)))
        for local, col in pts:
            wpt = fig.world(local)
            u, vv = project(wpt)
            x = int(math.floor(u - frame.origin[0]))
            y = int(math.floor(vv - frame.origin[1]))
            if not (0 <= x < frame.rgb.shape[1] and 0 <= y < frame.rgb.shape[0]):
                continue
            depth = -(wpt @ TOWARD)
            if frame.group[y, x] == gid and abs(frame.depth[y, x] - depth) < 1.8:
                frame.rgb[y, x] = col


def _pix(frame, wpt):
    u, vv = project(wpt)
    return u - frame.origin[0], vv - frame.origin[1]


def glow(frame, where, colour, radius=10, strength=0.5, empty=False):
    """Light thrown round a flame or a moon, in stepped rings dithered into each other."""
    h, w = frame.alpha.shape
    yy, xx = np.mgrid[0:h, 0:w]
    for wpt in where:
        cx, cy = _pix(frame, wpt)
        d = np.sqrt((xx - cx) ** 2 + ((yy - cy) * 1.1) ** 2) / radius
        k = np.clip(1 - d, 0, 1) ** 1.5 * strength
        q = k * 4
        step = (np.floor(q) + (BAYER4[yy % 4, xx % 4] < (q % 1))) / 4
        a = np.clip(step, 0, 1)
        on = frame.alpha & (a > 0)
        frame.rgb[on] = frame.rgb[on] * (1 - a[on, None] * 0.6) + np.asarray(colour) * a[on, None] * 0.6
        if empty:
            off = (~frame.alpha) & (a > 0.24)
            frame.rgb[off] = np.asarray(colour) * 0.55 + frame.rgb[off] * 0.45
            frame.alpha[off] = True
            frame.soft[off] = True


def night(frame, amount=1.0, tint=(0.52, 0.60, 0.92), lift=(6, 10, 26)):
    """Moonlight: everything that does not make its own light goes blue and down."""
    keep = np.isin(frame.mat, list(GLOWS))
    t = np.asarray(tint) * amount + (1 - amount)
    grade = frame.alpha & ~keep
    frame.rgb[grade] = frame.rgb[grade] * t + np.asarray(lift) * amount


def clouds(frame, blobs, ramp, seed=0, outline=True):
    """A bank of pixel cloud behind the set: circles run together, lit from the upper left,
    stepped and dithered, outlined. blobs are (world point, radius in pixels)."""
    h, w = frame.alpha.shape
    yy, xx = np.mgrid[0:h, 0:w]
    field = np.full((h, w), -1e9)
    nx = np.zeros((h, w))
    ny = np.zeros((h, w))
    for wpt, r in blobs:
        cx, cy = _pix(frame, wpt)
        dx, dy = (xx - cx) / r, (yy - cy) / r
        f = 1 - np.sqrt(dx * dx + dy * dy)
        better = f > field
        field = np.where(better, f, field)
        nx = np.where(better, dx, nx)
        ny = np.where(better, dy, ny)
    # A ragged edge.
    pts = np.stack([xx.ravel() * 0.35, yy.ravel() * 0.35, np.zeros(xx.size)], 1)
    wob = (noise3(pts, 2.2, seed).reshape(h, w) - 0.5) * 0.16
    inside = (field + wob) > 0
    ramp = hexes(*ramp)
    lit = np.clip(0.55 - 0.55 * nx - 0.65 * ny + field * 0.5, 0, 1)
    x = lit * (len(ramp) - 1)
    i = np.floor(x).astype(int) + (BAYER4[yy % 4, xx % 4] < (x % 1)).astype(int)
    i = np.clip(i, 0, len(ramp) - 1)
    back = inside & ~frame.alpha
    frame.rgb[back] = ramp[i[back]]
    frame.mat[back] = -3
    if outline:
        edge = np.zeros_like(inside)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            edge |= _shift(inside, dy, dx) & ~inside
        edge &= ~frame.alpha
        frame.rgb[edge] = ramp[0] * 0.6
        back |= edge
    frame.alpha |= back


def sky(frame, ramp, top=0.0, bottom=0.72, width=0.94, seed=0, stars=0.0, puffs=9, puff_ramp=None):
    """The night a scene is framed by: one mass of sky behind the set, its edge made of cloud,
    dark at the top and lifting toward the horizon, with lighter cloud lumps in it and a few
    stars. It only fills where the set is not."""
    h, w = frame.alpha.shape
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = w / 2, h * (top + bottom) / 2
    rx, ry = w * width / 2, h * (bottom - top) / 2
    nx, ny = (xx - cx) / rx, (yy - cy) / ry
    rng = np.random.default_rng(seed)
    field = 1 - (np.abs(nx) ** 2.4 + np.abs(ny) ** 2.4)
    # Cloud lumps along the edge.
    for k in range(18):
        a = k / 18 * math.pi * 2 + rng.uniform(-0.1, 0.1)
        bx, by = cx + math.cos(a) * rx * 0.92, cy + math.sin(a) * ry * 0.92
        r = rng.uniform(0.10, 0.2) * min(rx, ry) * 1.6
        field = np.maximum(field, 1 - ((xx - bx) ** 2 + (yy - by) ** 2) / r ** 2)
    pts = np.stack([xx.ravel() * 0.3, yy.ravel() * 0.3, np.zeros(xx.size)], 1)
    field = field + (noise3(pts, 2.0, seed).reshape(h, w) - 0.5) * 0.18
    inside = field > 0
    ramp = hexes(*ramp)
    k = len(ramp)
    lvl = np.clip((yy - (cy - ry)) / (2 * ry), 0, 1) * 0.55 + 0.05
    # Lighter lumps of cloud inside it.
    for j in range(puffs):
        bx = cx + rng.uniform(-0.85, 0.85) * rx
        by = cy + rng.uniform(-0.55, 0.45) * ry
        r = rng.uniform(0.10, 0.2) * rx
        # A cloud is a row of lumps, flat underneath and lit along its top.
        for q in range(3):
            lx = bx + (q - 1) * r * 0.9
            ly = by - (q == 1) * r * 0.25
            lr = r * (1.0 if q == 1 else 0.72)
            dd = ((xx - lx) ** 2 + ((yy - ly) * 2.0) ** 2) / lr ** 2
            lump = (dd < 1) & (yy < by + r * 0.22)
            top_lit = np.clip(1 - dd * 1.5, 0, 1) * np.clip((ly - yy) / lr + 0.4, 0, 1)
            lvl = np.where(lump, np.maximum(lvl, 0.22 + 0.34 * top_lit + 0.08), lvl)
    x = np.clip(lvl, 0, 1) * (k - 1)
    i = np.clip(np.floor(x).astype(int) + (BAYER4[yy % 4, xx % 4] < (x % 1)), 0, k - 1)
    back = inside & ~frame.alpha
    frame.rgb[back] = ramp[i[back]]
    if stars:
        star = back & (cellhash(xx, yy, 0, seed + 9) > 1 - stars) & (lvl < 0.3)
        frame.rgb[star] = np.array([235, 240, 255.0])
    edge = np.zeros_like(inside)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        edge |= _shift(inside, dy, dx) & ~inside
    edge &= ~frame.alpha
    frame.rgb[edge] = ramp[0] * 0.55
    frame.mat[back | edge] = -3
    frame.alpha |= back | edge


def disc(frame, wpt, r, ramp, craters=True):
    """The moon: a lit disc, its shadow side a step down, a couple of seas on it."""
    h, w = frame.alpha.shape
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = _pix(frame, wpt)
    dx, dy = (xx + 0.5 - cx) / r, (yy + 0.5 - cy) / r
    d = np.sqrt(dx * dx + dy * dy)
    inside = d <= 1
    ramp = hexes(*ramp)
    lit = np.clip(0.85 - 0.45 * dx - 0.35 * dy, 0, 1)
    if craters:
        for ox, oy, rr in ((0.25, -0.2, 0.28), (-0.3, 0.3, 0.2), (0.35, 0.4, 0.14)):
            lit -= 0.28 * (np.sqrt((dx - ox) ** 2 + (dy - oy) ** 2) < rr)
    x = np.clip(lit, 0, 1) * (len(ramp) - 1)
    i = np.clip(np.floor(x).astype(int) + (BAYER4[yy % 4, xx % 4] < (x % 1)), 0, len(ramp) - 1)
    frame.rgb[inside] = ramp[i[inside]]
    frame.alpha[inside] = True
    frame.mat[inside] = MAT["moon"]


def mist(frame, wpt, rx, ry, t, colour=(176, 190, 220), seed=0, amount=0.55):
    """Bands of mist drifting across the foot of the set, laid in dithered steps."""
    h, w = frame.alpha.shape
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = _pix(frame, wpt)
    e = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
    pts = np.stack([(xx.ravel() + t * 5.0) * 0.06, yy.ravel() * 0.22, np.full(xx.size, t * 0.05)], 1)
    n = noise3(pts, 1.0, seed).reshape(h, w)
    k = np.clip((n - 0.45) * 2.4, 0, 1) * np.clip(1 - e, 0, 1) * amount
    q = k * 3
    a = (np.floor(q) + (BAYER4[yy % 4, xx % 4] < (q % 1))) / 3
    on = a > 0
    col = np.asarray(colour, float)
    over = on & frame.alpha
    frame.rgb[over] = frame.rgb[over] * (1 - a[over, None] * 0.6) + col * a[over, None] * 0.6
    bare = on & ~frame.alpha & (a > 0.3) & (e < 0.55)
    frame.rgb[bare] = col
    frame.alpha[bare] = True
    frame.soft[bare] = True


class Scene:
    """A set and its cast, drawn as one picture.

    parts: the set's distance fields. figures: {group id: Figure}. ghosts: the group ids
    drawn as seen through. before(frame, t) and after(frame, t) are the backdrop and
    atmosphere passes. extent: extra world points the picture must take in (the top of
    a cloud bank, say), so every frame of a scene is the same size."""

    def __init__(self, name, parts, figures, lights=(), ghosts=(), night=0.0, before=None, after=None,
                 extent=(), pad=4, light_colour=(255, 196, 110)):
        self.name = name
        self.parts = parts
        self.figures = figures
        self.lights = list(lights)
        self.ghosts = tuple(ghosts)
        self.night = night
        self.before = before
        self.after = after
        self.extent = [np.asarray(e, float) for e in extent]
        self.pad = pad
        self.light_colour = light_colour

    def node(self, without=()):
        nodes = list(self.parts) + [f.node(g) for g, f in self.figures.items()
                                    if g not in without and getattr(f, "parts", True)]
        return Union(nodes)

    def bounds(self):
        scene = self.node()
        lo, hi = screen_bounds(scene.lo, scene.hi)
        for e in self.extent:
            u, vv = project(e[:3])
            r = e[3] if len(e) > 3 else 0
            lo = np.minimum(lo, [u - r, vv - r])
            hi = np.maximum(hi, [u + r, vv + r])
        origin = (math.floor(lo[0]) - self.pad, math.floor(lo[1]) - self.pad)
        size = (int(math.ceil(hi[0] - lo[0])) + 2 * self.pad, int(math.ceil(hi[1] - lo[1])) + 2 * self.pad)
        return origin, size

    def draw(self, t=0, speaking=None, origin=None, size=None):
        if origin is None:
            origin, size = self.bounds()
        figs = tuple(self.figures.keys())
        out = render(self.node(), MATERIALS, origin, size, frame=t, figures=figs)
        out.origin = origin
        out.soft = np.zeros_like(out.alpha)
        if self.ghosts:
            behind = render(self.node(without=self.ghosts), MATERIALS, origin, size, frame=t, figures=figs)
            gh = np.isin(out.group, list(self.ghosts)) & out.alpha
            hh, ww = gh.shape
            yy, xx = np.mgrid[0:hh, 0:ww]
            both = gh & behind.alpha
            out.rgb[both] = out.rgb[both] * 0.6 + behind.rgb[both] * 0.4
            # Over nothing, it is a checkerboard: every other pixel of it is not there.
            alone = gh & ~behind.alpha & ((xx + yy) % 2 == 1) & (out.mat >= 0)
            out.alpha[alone] = False
            out.soft[gh & ~behind.alpha] = True
        faces(out, self.figures, speaking, self.ghosts)
        if self.night:
            night(out, self.night)
        pts = self.lights + [f.light for f in self.figures.values() if hasattr(f, "light")]
        if pts:
            glow(out, pts, self.light_colour, radius=12, strength=0.6)
        if self.before:
            self.before(out, t)
        if self.after:
            self.after(out, t)
        return out


def image(frame):
    from PIL import Image
    h, w = frame.alpha.shape
    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[..., :3] = np.clip(frame.rgb, 0, 255).astype(np.uint8)
    rgba[..., 3] = np.where(frame.alpha, 255, 0)
    return Image.fromarray(rgba, "RGBA")


def rain(frame, t, colour=(150, 170, 210), every=7, length=6, seed=0, amount=1.0, region="alpha"):
    """Rain: short diagonal strokes in held frames, over everything, a little on the air."""
    h, w = frame.alpha.shape
    if isinstance(region, str):
        region = frame.alpha.copy()
    rng = np.random.default_rng(seed)
    n = int(w * h / (every * every * 6) * amount)
    xs = rng.uniform(0, w, n)
    ys = rng.uniform(0, h, n)
    col = np.asarray(colour, float)
    for x, y in zip(xs, ys):
        y = (y + t * h / 4 * 1.0) % h
        x = (x - t * 6) % w
        for k in range(length):
            xx, yy = int(x - k * 0.5), int(y + k)
            if 0 <= xx < w and 0 <= yy < h:
                if region is not None and not region[yy, xx]:
                    continue
                if frame.alpha[yy, xx]:
                    frame.rgb[yy, xx] = frame.rgb[yy, xx] * 0.45 + col * 0.55
                else:
                    frame.rgb[yy, xx] = col
                    frame.alpha[yy, xx] = True
                    frame.soft[yy, xx] = True


def bolt(frame, top, bottom, seed=0, colour=(236, 242, 255), halo=(150, 180, 255)):
    """A fork of lightning from `top` to `bottom` (pixel points), with a halo round it."""
    rng = np.random.default_rng(seed)
    h, w = frame.alpha.shape
    pts = [np.array(top, float)]
    n = 9
    for i in range(1, n + 1):
        f = i / n
        p = np.array(top, float) * (1 - f) + np.array(bottom, float) * f
        p[0] += rng.uniform(-6, 6) * (1 - abs(f - 0.5))
        pts.append(p)
    lit = np.zeros((h, w), bool)
    for a, b in zip(pts[:-1], pts[1:]):
        for k in np.linspace(0, 1, int(np.abs(b - a).max()) + 2):
            x, y = (a * (1 - k) + b * k).astype(int)
            if 0 <= x < w and 0 <= y < h:
                lit[y, x] = True
                if 0 <= x + 1 < w:
                    lit[y, x + 1] = True
    around = np.zeros_like(lit)
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            if dx * dx + dy * dy <= 9:
                around |= _shift(lit, dy, dx)
    halo_px = around & ~lit
    frame.rgb[halo_px] = frame.rgb[halo_px] * 0.45 + np.asarray(halo) * 0.55
    frame.alpha[halo_px & ~frame.alpha] = True
    frame.rgb[lit] = colour
    frame.alpha[lit] = True
    frame.mat[lit] = MAT["lightning"]


def flash(frame, amount=0.35, colour=(210, 225, 255)):
    """The whole picture lit for a frame by lightning."""
    on = frame.alpha
    frame.rgb[on] = frame.rgb[on] * (1 - amount) + np.asarray(colour) * amount


def sparks(frame, pts, colour=(255, 246, 160), halo=(200, 230, 120)):
    """Fireflies and fairy light: a bright pixel with a plus of softer light round it."""
    h, w = frame.alpha.shape
    for wpt in pts:
        x, y = _pix(frame, wpt)
        x, y = int(x), int(y)
        for dx, dy, c, a in ((0, 0, colour, 1.0), (1, 0, halo, 0.6), (-1, 0, halo, 0.6), (0, 1, halo, 0.6), (0, -1, halo, 0.6)):
            xx, yy = x + dx, y + dy
            if 0 <= xx < w and 0 <= yy < h:
                if frame.alpha[yy, xx]:
                    frame.rgb[yy, xx] = frame.rgb[yy, xx] * (1 - a) + np.asarray(c) * a
                else:
                    frame.rgb[yy, xx] = c
                    frame.alpha[yy, xx] = True
                    frame.soft[yy, xx] = True


def smoke(frame, wpt, t, colour=(150, 230, 110), rise=46, puffs=6, seed=0, width=10):
    """Smoke going up off something, as puffs that swell and thin as they climb, dithered so
    the set shows through them."""
    h, w = frame.alpha.shape
    yy, xx = np.mgrid[0:h, 0:w]
    bx, by = _pix(frame, wpt)
    col = np.asarray(colour, float)
    for k in range(puffs):
        f = ((k + t / 4.0) / puffs) % 1.0
        cx = bx + math.sin(f * 5.0 + k * 1.3 + seed) * width * (0.3 + f)
        cy = by - f * rise
        r = 2.5 + f * width * 0.9
        d = np.sqrt((xx - cx) ** 2 + ((yy - cy) * 1.2) ** 2) / r
        k_a = np.clip(1 - d, 0, 1) * (1 - f) * 1.4
        q = np.clip(k_a, 0, 1) * 3
        a = (np.floor(q) + (BAYER4[yy % 4, xx % 4] < (q % 1))) / 3
        on = a > 0
        over = on & frame.alpha
        frame.rgb[over] = frame.rgb[over] * (1 - a[over, None] * 0.7) + col * a[over, None] * 0.7
        bare = on & ~frame.alpha & (a > 0.3)
        frame.rgb[bare] = col
        frame.alpha[bare] = True
        frame.soft[bare] = True
