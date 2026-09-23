"""The builder's yard: walls, towers, arches, rocks, trees, water — each a few lines of
distance field, so a set is written the way it would be described."""

import math

import numpy as np

from engine import (Node, Union, Cut, Blend, Moved, Rough, Prim, sphere, ellipsoid, box, cylinder, cone, capsule,
                    torus, custom, _len, fbm, cellhash)
from palette import MAT


def v(*a):
    return np.array(a, float)


def wall(x0, y0, x1, y1, z0, h, mat="stone", thick=4.0):
    """A straight wall from (x0, y0) to (x1, y1), `thick` through, standing on z0."""
    if abs(x1 - x0) >= abs(y1 - y0):
        return box(v(min(x0, x1), y0 - thick / 2, z0), v(max(x0, x1), y0 + thick / 2, z0 + h), MAT[mat])
    return box(v(x0 - thick / 2, min(y0, y1), z0), v(x0 + thick / 2, max(y0, y1), z0 + h), MAT[mat])


def merlons(x0, y0, x1, y1, z, mat="stone", thick=4.0, w=3.2, gap=2.6, h=3.4):
    """Crenellations along the top of a wall."""
    out = []
    along_x = abs(x1 - x0) >= abs(y1 - y0)
    L = abs(x1 - x0) if along_x else abs(y1 - y0)
    n = max(1, int((L + gap) // (w + gap)))
    start = (L - (n * w + (n - 1) * gap)) / 2
    for i in range(n):
        a = start + i * (w + gap)
        if along_x:
            x = min(x0, x1) + a
            out.append(box(v(x, y0 - thick / 2, z), v(x + w, y0 + thick / 2, z + h), MAT[mat]))
        else:
            y = min(y0, y1) + a
            out.append(box(v(x0 - thick / 2, y, z), v(x0 + thick / 2, y + w, z + h), MAT[mat]))
    return out


def rampart(x0, y0, x1, y1, z0, h, mat="stone", thick=4.0):
    return [wall(x0, y0, x1, y1, z0, h, mat, thick)] + merlons(x0, y0, x1, y1, z0 + h, mat, thick)


def tower(c, r, h, mat="stone", roof="slate", roof_h=None, crenel=True, window=None):
    """A round tower on c: its body, a ring of merlons or a conical roof, a lit window."""
    c = v(*c)
    parts = [cylinder(c, r, h, MAT[mat])]
    if crenel:
        parts.append(cylinder(c + v(0, 0, h), r + 1.2, 2.0, MAT[mat]))
        n = max(6, int(r * 1.3))
        for k in range(n):
            a = (k + 0.5) / n * math.pi * 2
            parts.append(box(c + v(math.cos(a) * (r + 0.3) - 1.2, math.sin(a) * (r + 0.3) - 1.2, h + 2),
                             c + v(math.cos(a) * (r + 0.3) + 1.2, math.sin(a) * (r + 0.3) + 1.2, h + 5), MAT[mat]))
    if roof:
        rh = roof_h or r * 2.2
        parts.append(cone(c + v(0, 0, h + (2.0 if crenel else 0)), r + (0.2 if crenel else 1.4), 0.2, rh, MAT[roof]))
    if window:
        z, face = window
        a = math.radians(face)
        wpos = c + v(math.cos(a) * (r - 0.6), math.sin(a) * (r - 0.6), z)
        parts.append(ellipsoid(wpos, v(1.4, 1.4, 2.4), MAT["window"]))
    return parts


def lit_window(x, y, z, w=2.4, h=4.4, on="x", mat="window"):
    """A window as a glowing inset: on='x' for a wall facing +x, 'y' for one facing +y."""
    if on == "x":
        glass = box(v(x - 0.8, y - w / 2, z), v(x + 0.4, y + w / 2, z + h), MAT[mat])
        sill = box(v(x - 0.2, y - w / 2 - 0.6, z - 0.8), v(x + 0.9, y + w / 2 + 0.6, z), MAT["stone"])
    else:
        glass = box(v(x - w / 2, y - 0.8, z), v(x + w / 2, y + 0.4, z + h), MAT[mat])
        sill = box(v(x - w / 2 - 0.6, y - 0.2, z - 0.8), v(x + w / 2 + 0.6, y + 0.9, z), MAT["stone"])
    return [glass, sill]


def arch_cut(x, y, z, w, h, on="x", depth=6.0):
    """The shape of a round-headed arch, for cutting out of a wall."""
    r = w / 2
    if on == "x":
        return Union([box(v(x - depth, y - r, z), v(x + depth, y + r, z + h - r), 0),
                      _hcyl(v(x, y, z + h - r), r, depth, "x")])
    return Union([box(v(x - r, y - depth, z), v(x + r, y + depth, z + h - r), 0),
                  _hcyl(v(x, y, z + h - r), r, depth, "y")])


def _hcyl(c, r, half, axis):
    """A horizontal cylinder through c along x or y."""
    def fn(p):
        q = p - c
        if axis == "x":
            rr = np.sqrt(q[:, 1] ** 2 + q[:, 2] ** 2) - r
            a = np.abs(q[:, 0]) - half
        else:
            rr = np.sqrt(q[:, 0] ** 2 + q[:, 2] ** 2) - r
            a = np.abs(q[:, 1]) - half
        return np.minimum(np.maximum(rr, a), 0) + _len(np.stack([np.maximum(rr, 0), np.maximum(a, 0)], 1))
    ext = v(half, r, r) if axis == "x" else v(r, half, r)
    return custom(fn, c - ext, c + ext, 0)


def rock(c, r, mat="rock", seed=0, squash=0.7, amp=1.6):
    c = v(*c)
    return Rough(ellipsoid(c, v(r, r * 0.9, r * squash), MAT[mat]), amp, r * 0.6, seed)


def tree(c, h=26, crown=11, mat="leaf", trunk="wood_dark", seed=0, dead=False):
    c = v(*c)
    parts = [capsule(c, c + v(0.4, -0.3, h * 0.7), 1.8, MAT[trunk], r1=1.2)]
    if dead:
        rnd = np.random.default_rng(seed)
        for k in range(5):
            base = c + v(0, 0, h * (0.35 + 0.1 * k))
            a = rnd.uniform(0, math.pi * 2)
            tip = base + v(math.cos(a) * 7, math.sin(a) * 7, rnd.uniform(3, 8))
            parts.append(capsule(base, tip, 1.0, MAT[trunk], r1=0.3))
            parts.append(capsule(tip, tip + v(math.cos(a + 0.8) * 3, math.sin(a + 0.8) * 3, 3), 0.4, MAT[trunk], r1=0.15))
        return parts
    rnd = np.random.default_rng(seed)
    blobs = [sphere(c + v(0, 0, h * 0.78), crown, MAT[mat])]
    for k in range(5):
        a = k / 5 * math.pi * 2 + rnd.uniform(0, 1)
        blobs.append(sphere(c + v(math.cos(a) * crown * 0.7, math.sin(a) * crown * 0.7, h * 0.72 + rnd.uniform(-2, 3)),
                            crown * 0.62, MAT[mat]))
    parts.append(Rough(Union(blobs), 1.3, 3.0, seed + 5))
    return parts


def steps(x, y, z, w, n, rise=2.2, run=3.0, mat="stone", dir="x"):
    out = []
    for i in range(n):
        if dir == "x":
            out.append(box(v(x + i * run, y, z), v(x + (i + 1) * run, y + w, z + (n - i) * rise), MAT[mat]))
        else:
            out.append(box(v(x, y + i * run, z), v(x + w, y + (i + 1) * run, z + (n - i) * rise), MAT[mat]))
    return out


def plane_water(x0, y0, x1, y1, z, mat="water"):
    return box(v(x0, y0, z - 2), v(x1, y1, z), MAT[mat])


def flagpole(c, h=20, flag="banner_red", wave=0.0):
    c = v(*c)
    parts = [capsule(c, c + v(0, 0, h), 0.4, MAT["wood_dark"])]

    def fn(p):
        q = p - (c + v(0, 0, h - 5))
        x = q[:, 0]
        t = np.clip(x / 8, 0, 1)
        y = q[:, 1] - np.sin(x * 0.7 + wave) * 0.8 * t
        d = np.stack([np.abs(x - 4) - 4, np.abs(y) - 0.25, np.abs(q[:, 2] - 2.2) - 2.2], 1)
        return _len(np.maximum(d, 0)) + np.minimum(d.max(1), 0)
    parts.append(custom(fn, c + v(-1, -2, h - 6), c + v(9, 2, h), MAT[flag]))
    return parts


def gable(x0, y0, x1, y1, z0, rise, mat="terracotta", ridge="x", eave=1.6):
    """A pitched roof on the rectangle (x0,y0)-(x1,y1) at z0, its ridge along x or y."""
    xm, ym = (x0 + x1) / 2, (y0 + y1) / 2
    hx, hy = (x1 - x0) / 2 + eave, (y1 - y0) / 2 + eave

    def fn(p):
        x, y, z = p[:, 0] - xm, p[:, 1] - ym, p[:, 2]
        across, along, half, length = (y, x, hy, hx) if ridge == "x" else (x, y, hx, hy)
        k = rise / half
        slope = (z - z0 - rise + k * np.abs(across)) / math.sqrt(1 + k * k)
        return np.maximum.reduce([slope, z0 - 0.8 - z, np.abs(along) - length, np.abs(across) - half])
    return custom(fn, v(xm - hx, ym - hy, z0 - 1), v(xm + hx, ym + hy, z0 + rise + 1), MAT[mat])


def hcyl(c, r, half, axis, mat):
    node = _hcyl(v(*c), r, half, axis)
    node.mat = MAT[mat]
    return node


def glow_arch(x, y, z, w, h, on="y", mat="window", frame="stone_warm"):
    """A lit, round-headed opening in a wall face, with its stone surround."""
    r = w / 2
    parts = []
    if on == "y":
        parts.append(box(v(x - r - 1.2, y - 0.6, z - 0.6), v(x + r + 1.2, y + 0.9, z + h - r), MAT[frame]))
        parts.append(hcyl((x, y + 0.15, z + h - r), r + 1.2, 0.75, "y", frame))
        parts.append(box(v(x - r, y - 0.2, z), v(x + r, y + 1.1, z + h - r), MAT[mat]))
        parts.append(hcyl((x, y + 0.45, z + h - r), r, 0.65, "y", mat))
    else:
        parts.append(box(v(x - 0.6, y - r - 1.2, z - 0.6), v(x + 0.9, y + r + 1.2, z + h - r), MAT[frame]))
        parts.append(hcyl((x + 0.15, y, z + h - r), r + 1.2, 0.75, "x", frame))
        parts.append(box(v(x - 0.2, y - r, z), v(x + 1.1, y + r, z + h - r), MAT[mat]))
        parts.append(hcyl((x + 0.45, y, z + h - r), r, 0.65, "x", mat))
    return parts


def ivy(x0, x1, z0, z1, y, seed=0, n=26, face="y", mat="ivy", flowers=0):
    """Growth over a wall face: clumps of leaves, roughened, with the odd flower."""
    rnd = np.random.default_rng(seed)
    blobs = []
    for k in range(n):
        a = rnd.uniform(x0, x1)
        z = z0 + (z1 - z0) * rnd.uniform(0, 1) ** 1.4
        r = rnd.uniform(1.6, 3.2)
        c = v(a, y + r * 0.35, z) if face == "y" else v(y + r * 0.35, a, z)
        blobs.append(sphere(c, r, MAT[mat]))
    parts = [Rough(Union(blobs), 0.8, 1.6, seed + 3)]
    for k in range(flowers):
        a = rnd.uniform(x0, x1)
        z = z0 + (z1 - z0) * rnd.uniform(0, 0.8)
        c = v(a, y + 2.2, z) if face == "y" else v(y + 2.2, a, z)
        parts.append(sphere(c, 0.8, MAT[rnd.choice(["flower_red", "flower_white", "lily"])]))
    return parts


def bush(c, r=5.0, seed=0, flowers=8, mat="leaf", bloom=("flower_red",)):
    c = v(*c)
    rnd = np.random.default_rng(seed)
    parts = [Rough(ellipsoid(c + v(0, 0, r * 0.7), v(r, r, r * 0.8), MAT[mat]), 1.1, 2.0, seed)]
    for k in range(flowers):
        a = rnd.uniform(0, math.pi * 2)
        e = rnd.uniform(0.2, 1.2)
        parts.append(sphere(c + v(math.cos(a) * r * 0.8 * math.cos(e), math.sin(a) * r * 0.8 * math.cos(e),
                                  r * 0.7 + math.sin(e) * r * 0.75), 0.9, MAT[rnd.choice(bloom)]))
    return parts


def cypress(c, h=44, r=5.0, seed=0):
    c = v(*c)
    return [capsule(c, c + v(0, 0, 4), 1.2, MAT["wood_dark"]),
            Rough(ellipsoid(c + v(0, 0, h * 0.52), v(r, r, h * 0.5), MAT["leaf"]), 1.2, 2.4, seed)]


def column(c, h, r=2.2, mat="marble", capital=True):
    c = v(*c)
    parts = [box(c + v(-r - 1, -r - 1, 0), c + v(r + 1, r + 1, 1.6), MAT[mat]),
             cylinder(c + v(0, 0, 1.6), r, h - 3.2, MAT[mat])]
    if capital:
        parts.append(box(c + v(-r - 1.2, -r - 1.2, h - 1.6), c + v(r + 1.2, r + 1.2, h), MAT[mat]))
    return parts


def cauldron(c, r=6.5, brew="glow_green", fire=True, t=0):
    c = v(*c)
    lift = 4.0
    pot = Cut(sphere(c + v(0, 0, lift + r * 0.8), r, MAT["iron"]),
              Union([cylinder(c + v(0, 0, lift + r * 1.35), r * 2, r * 2, 0),
                     sphere(c + v(0, 0, lift + r * 0.8), r - 1.0, 0)]))
    parts = [pot, torus(c + v(0, 0, lift + r * 1.3), r * 0.83, 0.9, MAT["iron"]),
             cylinder(c + v(0, 0, lift + r * 1.05), r * 0.8, 0.4, MAT[brew])]
    for k in range(3):
        a = k / 3 * math.pi * 2 + 0.4
        parts.append(capsule(c + v(math.cos(a) * r * 0.55, math.sin(a) * r * 0.55, lift + 1.5),
                             c + v(math.cos(a) * r * 0.8, math.sin(a) * r * 0.8, 0.5), 0.8, MAT["iron"]))
    if fire:
        for k in range(4):
            a = k / 4 * math.pi * 2 + 0.7
            parts.append(capsule(c + v(math.cos(a) * 5, math.sin(a) * 5, 0.8), c + v(-math.cos(a) * 1.5, -math.sin(a) * 1.5, 1.4),
                                 0.9, MAT["wood_dark"]))
        for k in range(5):
            a = k / 5 * math.pi * 2 + t * 0.9
            fl = 2.2 + 1.2 * math.sin(t * 2.1 + k * 1.7)
            parts.append(ellipsoid(c + v(math.cos(a) * 2.2, math.sin(a) * 2.2, 1.8 + fl / 2), v(1.2, 1.2, fl), MAT["flame"]))
    return parts


def barrel(c, r=3.6, h=8.0, on_side=False):
    c = v(*c)
    if on_side:
        return [hcyl(c + v(0, 0, r), r, h / 2, "x", "wood"),
                hcyl(c + v(h * 0.3, 0, r), r + 0.35, 0.4, "x", "iron"),
                hcyl(c + v(-h * 0.3, 0, r), r + 0.35, 0.4, "x", "iron")]
    return [cylinder(c, r, h, MAT["wood"]),
            cylinder(c + v(0, 0, h * 0.18), r + 0.3, 0.8, MAT["iron"]),
            cylinder(c + v(0, 0, h * 0.72), r + 0.3, 0.8, MAT["iron"])]


def headstone(c, w=5.0, h=7.0, t=1.6, mat="stone", cross=False, yaw=0.0):
    c = v(*c)
    if cross:
        return [box(c + v(-t / 2, -0.8, 0), c + v(t / 2, 0.8, h), MAT[mat]),
                box(c + v(-t / 2, -w / 2, h * 0.62), c + v(t / 2, w / 2, h * 0.82), MAT[mat])]
    return [box(c + v(-t / 2, -w / 2, 0), c + v(t / 2, w / 2, h - w / 2), MAT[mat]),
            hcyl((c[0], c[1], c[2] + h - w / 2), w / 2, t / 2, "x", mat)]


def toadstool(c, h=8.0, r=5.0, seed=0):
    c = v(*c)
    return [cone(c, r * 0.32, r * 0.24, h, MAT["stem"]),
            Cut(ellipsoid(c + v(0, 0, h), v(r, r, r * 0.62), MAT["toadstool"]),
                box(c + v(-r - 1, -r - 1, h - r), c + v(r + 1, r + 1, h - 0.2), 0))]


def log(a, b, r=2.6, mat="wood_dark", moss=True, seed=0):
    parts = [capsule(v(*a), v(*b), r, MAT[mat])]
    if moss:
        m = (v(*a) + v(*b)) / 2
        parts.append(Rough(ellipsoid(m + v(0, 0, r * 0.7), v(abs(b[0] - a[0]) / 2 + 1, abs(b[1] - a[1]) / 2 + 1.4, 1.2),
                                     MAT["moss"]), 0.6, 1.2, seed))
    return parts


def ship(c, yaw=0.0, roll=0.0, pitch=0.0, scale=1.0):
    """A small galleon: hull, deck, two masts, sails full of wind, a flag. It rolls."""
    L, B, H = 34.0, 11.0, 8.0

    def hull(p):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        tx = np.clip(np.abs(x) / (L / 2), 0, 1)
        half = B / 2 * np.sqrt(np.clip(1 - tx ** 2.2, 0.02, 1)) * np.clip((z + 1.5) / (H * 0.55), 0.35, 1)
        dy = np.abs(y) - half
        dz = np.maximum(-z - 1.5, z - (H * 0.62 + tx ** 2 * 3.0))
        dx = np.abs(x) - L / 2
        q = np.stack([np.maximum(dx, -30), dy, dz], 1)
        return _len(np.maximum(q, 0)) * 0.8 + np.minimum(q.max(1), 0)
    parts = [custom(hull, v(-L / 2 - 1, -B / 2 - 1, -3), v(L / 2 + 1, B / 2 + 1, H + 4), MAT["wood"]),
             box(v(-L / 2 + 3, -B / 2 + 1.2, H * 0.62 - 0.4), v(L / 2 - 4, B / 2 - 1.2, H * 0.62 + 0.3), MAT["wood_dark"]),
             box(v(-L / 2 + 1, -B / 2 + 0.8, H * 0.62), v(-L / 2 + 9, B / 2 - 0.8, H * 0.62 + 5), MAT["wood"])]
    for mx, mh, sw in ((5.0, 34.0, 10.0), (-8.0, 28.0, 8.5)):
        parts.append(capsule(v(mx, 0, H * 0.5), v(mx, 0, mh), 0.6, MAT["wood_dark"]))
        parts.append(capsule(v(mx, -sw, mh - 5), v(mx, sw, mh - 5), 0.35, MAT["wood_dark"]))

        def sail(p, mx=mx, mh=mh, sw=sw):
            x, y, z = p[:, 0] - mx, p[:, 1], p[:, 2]
            t = np.clip((mh - 5 - z) / (mh - 5 - H - 4), 0, 1)
            half = sw * (0.8 + 0.25 * t)
            bow = 2.6 * (1 - (y / np.maximum(half, 1)) ** 2)
            dx = np.abs(x - bow) - 0.35
            dy = np.abs(y) - half
            dz = np.maximum(z - (mh - 5), (H + 4) - z)
            q = np.stack([dx, dy, dz], 1)
            return _len(np.maximum(q, 0)) + np.minimum(q.max(1), 0)
        parts.append(custom(sail, v(mx - 1, -sw * 1.1, H + 3), v(mx + 4, sw * 1.1, mh - 4), MAT["sail"]))
    parts.append(capsule(v(L / 2 - 2, 0, H * 0.7), v(L / 2 + 9, 0, H + 6), 0.5, MAT["wood_dark"]))  # bowsprit
    body = Union(parts)
    return Moved(RolledNode(body, roll, pitch), at=c, yaw=yaw, scale=scale)


class RolledNode(Node):
    """A node tipped about x (roll) and y (pitch), for a ship in a sea."""

    def __init__(self, child, roll, pitch):
        self.child = child
        self.cr, self.sr = math.cos(roll), math.sin(roll)
        self.cp, self.sp = math.cos(pitch), math.sin(pitch)
        pad = np.abs(child.hi - child.lo).max() * 0.3
        self.lo, self.hi = child.lo - pad, child.hi + pad

    def eval(self, p):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        y2 = y * self.cr + z * self.sr
        z2 = -y * self.sr + z * self.cr
        x3 = x * self.cp - z2 * self.sp
        z3 = x * self.sp + z2 * self.cp
        return self.child.eval(np.stack([x3, y2, z3], 1))


def table(c, w=16, d=9, h=9, mat="wood", cloth=None):
    c = v(*c)
    parts = [box(c + v(0, 0, h - 1.2), c + v(w, d, h), MAT[mat])]
    for dx in (1, w - 2):
        for dy in (1, d - 2):
            parts.append(box(c + v(dx, dy, 0), c + v(dx + 1.2, dy + 1.2, h - 1.2), MAT[mat]))
    if cloth:
        parts.append(box(c + v(-0.6, -0.6, h - 1.0), c + v(w + 0.6, d + 0.6, h + 0.2), MAT[cloth]))
        parts.append(box(c + v(-0.8, -0.8, h - 4), c + v(w + 0.8, 0.2, h), MAT[cloth]))
    return parts


def bench(c, w=12, d=3.5, h=4.5, mat="wood"):
    c = v(*c)
    return [box(c + v(0, 0, h - 1), c + v(w, d, h), MAT[mat]),
            box(c + v(1, 0.5, 0), c + v(2.2, d - 0.5, h - 1), MAT[mat]),
            box(c + v(w - 2.2, 0.5, 0), c + v(w - 1, d - 0.5, h - 1), MAT[mat])]


def torch(c, t=0):
    c = v(*c)
    fl = 2.4 + 0.8 * math.sin(t * 2.3)
    return [capsule(c, c + v(0.8, 0.8, 4), 0.5, MAT["wood_dark"]),
            cylinder(c + v(0.8, 0.8, 3.6), 1.1, 1.2, MAT["iron"]),
            ellipsoid(c + v(0.8, 0.8, 5.2 + fl / 2), v(1.1, 1.1, fl), MAT["flame"])]
