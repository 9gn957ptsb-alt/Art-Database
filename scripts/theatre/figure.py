"""A person, built to be dressed.

Local coordinates: the figure stands on the origin facing +x, its left hand on
+y, head at the top. About 44 units tall, which the camera draws about 54
pixels high — tall enough for a face to have eyes, a crown to have points
and a beard to be told from a collar. Everything is placed by joints, so a
pose is only a handful of angles and every frame is drawn fresh from them.
"""

import math

import numpy as np

from engine import (Union, Blend, Moved, Cut, sphere, ellipsoid, box, cylinder, cone, capsule, torus,
                    custom, _len)
from palette import MAT


def v(*a):
    return np.array(a, float)


def limb(root, angles, lengths):
    """Joint positions down a chain: each angle is (pitch from straight down, toward +x;
    spread, toward +y), in degrees."""
    pts = [np.asarray(root, float)]
    for (pitch, spread), L in zip(angles, lengths):
        p, s = math.radians(pitch), math.radians(spread)
        d = v(math.sin(p) * math.cos(s), math.sin(s), -math.cos(p) * math.cos(s))
        pts.append(pts[-1] + d * L)
    return pts


def cape_shape(top_z, bot_z, half_top, half_bot, back, thick, bow, flare=0.0):
    """A cloak hanging behind the shoulders: its width flares toward the hem and it bows
    away from the body; `flare` swings the hem out behind as if it were moving."""
    def fn(p):
        z = p[:, 2]
        t = np.clip((top_z - z) / (top_z - bot_z), 0, 1)
        half = half_top + (half_bot - half_top) * t
        xc = back - bow * t - flare * t * t
        # A curved sheet: distance from the arc across y, then thickness.
        curve = (p[:, 1] / np.maximum(half, 1e-3)) ** 2 * 1.6
        dx = np.abs(p[:, 0] - (xc + curve)) - thick
        dy = np.abs(p[:, 1]) - half
        dz = np.maximum(z - top_z, bot_z - z)
        q = np.stack([dx, dy, dz], 1)
        return _len(np.maximum(q, 0)) + np.minimum(q.max(1), 0)
    lo = v(back - bow - flare - 4, -half_bot - 1, bot_z - 1)
    hi = v(back + 5, half_bot + 1, top_z + 1)
    return fn, lo, hi


class Figure:
    """Build with keyword choices; .node(group) gives the distance field placed and turned,
    .marks() gives the face points for the decal pass."""

    def __init__(self, at=(0, 0, 0), yaw=0.0, height=1.0, **kw):
        self.at = v(*at)
        self.yaw = yaw
        self.h = height
        self.kw = kw
        self.parts = []
        self.face = {}
        self.build(**kw)

    # -- helpers --------------------------------------------------------------------------------
    def add(self, node):
        self.parts.append(node)
        return node

    def M(self, name):
        return MAT[name]

    def build(self, skin="skin", hair=None, hair_style="short", beard=None, body="doublet", top="red",
              skirt=None, skirt_len=0.0, skirt_flare=1.0, legs="black", boots="leather", cape=None,
              cape_flare=0.0, cape_len=1.0, collar=None, belt=None, sleeves=None, crown=None, hat=None,
              hood=None, arms=None, girth=1.0, stoop=0.0, pose=None, props=(), breathe=0.0, stride=0.0,
              head_turn=0.0, shoulders=1.0, beard_len=1.0, fat=0.0, bare_head=False, tail=None,
              ass_head=False, veil=None, trim=None, buttons=None, cuffs=None, **extra):
        pose = pose or {}
        g = girth
        hip_z = 20.0
        waist_z = 21.0 - breathe * 0.2
        chest_z = 29.5 + breathe * 0.35
        sh_z = 33.3 + breathe * 0.35 - stoop * 1.2
        lean = stoop * 2.2
        head_c = v(0.6 + lean, 0, 39.4 + breathe * 0.35 - stoop * 1.6)
        self.head_c = head_c

        # Legs, which a long skirt hides but which still carry it.
        if skirt_len < 0.95:
            for side in (1, -1):
                sw = stride * side
                hip = v(0, side * 2.3, hip_z)
                knee = hip + v(math.sin(math.radians(sw)) * 9.5, 0, -math.cos(math.radians(sw)) * 9.5)
                foot = knee + v(math.sin(math.radians(sw * 0.4)) * 9.0, side * 0.3, -math.cos(math.radians(sw * 0.4)) * 9.0)
                self.add(capsule(hip, knee, 2.1 * g, self.M(legs)))
                self.add(capsule(knee, foot + v(0, 0, 1.5), 1.8 * g, self.M(legs), r1=1.6 * g))
                self.add(box(foot + v(-1.6, -1.5, -0.2), foot + v(2.6, 1.5, 3.2), self.M(boots), round=0.8))

        # The body: a waist and a chest, run together.
        torso = Blend(
            ellipsoid(v(0, 0, (waist_z + chest_z) / 2 - 1), v(3.4 * g + fat * 1.2, 4.2 * g + fat * 1.6, 5.0), self.M(top)),
            ellipsoid(v(0.2 + lean * 0.5, 0, chest_z), v(3.7 * g + fat * 1.8, 5.2 * g * shoulders + fat * 1.4, 4.6), self.M(top)),
            2.0)
        if fat:
            torso = Blend(torso, ellipsoid(v(1.6, 0, 24.5), v(5.0 + fat * 2.4, 5.2 + fat * 2.0, 6.0 + fat), self.M(top)), 3.0)
        self.add(torso)

        # A skirt, a robe, a gown, or the tail of a doublet.
        if skirt:
            bottom = max(0.0, hip_z * (1 - skirt_len))
            r_top = 4.4 * g + fat * 1.6
            r_bot = (5.4 + 4.6 * skirt_len) * skirt_flare * g
            self.add(cone(v(0, 0, bottom), r_bot, r_top, waist_z - bottom + 1.5, self.M(skirt)))
            if trim:
                self.add(torus(v(0, 0, bottom + 0.9), r_bot - 0.5, 0.8, self.M(trim)))

        # Neck and head.
        self.add(capsule(v(0.3 + lean * 0.6, 0, sh_z - 0.5), head_c - v(0, 0, 2.5), 1.5, self.M(skin)))
        if ass_head:
            self.add(ellipsoid(head_c + v(0.4, 0, 0.2), v(4.2, 3.6, 4.6), self.M("ass")))
            self.add(ellipsoid(head_c + v(4.2, 0, -1.8), v(3.0, 2.4, 2.4), self.M("ass")))
            for side in (1, -1):
                self.add(capsule(head_c + v(-0.5, side * 2.2, 3.0), head_c + v(-1.8, side * 3.4, 9.0), 1.1, self.M("ass"), r1=0.6))
            self.face = {"eyes": [head_c + v(2.6, 2.0, 1.2), head_c + v(2.6, -2.0, 1.2)], "mouth": None}
        else:
            self.add(sphere(head_c, 4.1, self.M(skin)))
            self.add(sphere(head_c + v(3.9, 0, -0.6), 0.9, self.M(skin)))               # the nose
            self.face = {
                "eyes": [head_c + v(3.55, 1.55, 0.35), head_c + v(3.55, -1.55, 0.35)],
                "mouth": head_c + v(3.75, 0, -1.9),
            }

        # Hair.
        if hair and not ass_head:
            if hair_style in ("short", "long", "curls", "bob", "bald"):
                if hair_style != "bald":
                    self.add(Cut(sphere(head_c + v(-0.5, 0, 0.8), 4.35, self.M(hair)),
                                 box(head_c + v(1.4, -6, -6), head_c + v(8, 6, 0.9), self.M(hair))))
                else:
                    for side in (1, -1):
                        self.add(ellipsoid(head_c + v(-1.2, side * 3.3, -0.6), v(2.0, 1.2, 2.2), self.M(hair)))
            if hair_style == "long":
                self.add(ellipsoid(head_c + v(-2.2, 0, -4.8), v(2.8, 4.6, 7.8), self.M(hair)))
                for side in (1, -1):
                    self.add(ellipsoid(head_c + v(-0.4, side * 3.8, -4.2), v(1.8, 1.4, 6.0), self.M(hair)))
            if hair_style == "curls":
                for k in range(7):
                    a = k / 7 * math.pi * 2
                    self.add(sphere(head_c + v(-1.2 + math.cos(a) * 2.8, math.sin(a) * 3.4, 1.6 + math.sin(a * 2) * 0.8), 1.7, self.M(hair)))
            if hair_style == "bob":
                self.add(ellipsoid(head_c + v(-1.4, 0, -1.4), v(3.4, 4.8, 4.4), self.M(hair)))

        if beard and not ass_head:
            L = beard_len
            self.add(ellipsoid(head_c + v(2.4, 0, -3.4 - L * 1.4), v(2.6, 3.4, 2.4 + L * 1.8), self.M(beard)))
            self.add(ellipsoid(head_c + v(3.3, 0, -1.2), v(1.0, 2.2, 0.8), self.M(beard)))       # moustache
            self.face["mouth"] = None

        # Shoulders and arms.
        arms = arms or {}
        for side, key in ((1, "left"), (-1, "right")):
            spec = arms.get(key, {"up": (8, 12), "fore": (18, 6)})
            sh = v(0.2 + lean * 0.5, side * 5.0 * g * shoulders + side * fat * 1.2, sh_z - 1.0)
            u = spec.get("up", (8, 12))
            f = spec.get("fore", (18, 6))
            pts = limb(sh, [(u[0], u[1] * side), (f[0], f[1] * side)], [7.8, 7.4])
            sleeve = sleeves or top
            self.add(capsule(pts[0], pts[1], 2.1 * g + fat * 0.4, self.M(sleeve), r1=1.8 * g))
            self.add(capsule(pts[1], pts[2], 1.8 * g, self.M(sleeve), r1=1.5))
            self.add(sphere(pts[2], 1.55, self.M(skin)))
            if cuffs:
                d = pts[2] - pts[1]
                d = d / (np.linalg.norm(d) or 1)
                self.add(capsule(pts[2] - d * 2.4, pts[2] - d * 1.4, 2.0, self.M(cuffs)))
            setattr(self, "hand_" + key, pts[2])
            setattr(self, "elbow_" + key, pts[1])
            if sleeves == "puff" or spec.get("puff"):
                self.add(sphere(sh, 2.8, self.M(top)))

        if buttons:
            for z in (23.5, 26.5, 29.5):
                self.add(sphere(v(3.3 * g + fat * (1.8 if z < 27 else 1.4) + (0.4 if z > 28 else 0), 0, z), 0.55, self.M(buttons)))

        # Trim and finery.
        if collar == "ruff":
            self.add(torus(v(0.2 + lean * 0.6, 0, sh_z + 0.4), 2.3, 1.3, self.M("white")))
        elif collar == "fur":
            self.add(torus(v(0.1 + lean * 0.5, 0, sh_z - 0.4), 3.6, 1.9, self.M("fur")))
        elif collar:
            self.add(torus(v(0.2 + lean * 0.6, 0, sh_z - 0.2), 2.4, 1.0, self.M(collar)))
        if belt:
            self.add(torus(v(0, 0, waist_z), 3.9 * g + fat * 1.6, 0.8, self.M(belt)))
            self.add(box(v(3.2 * g + fat * 1.6, -0.8, waist_z - 0.8), v(4.4 * g + fat * 1.6, 0.8, waist_z + 0.8), self.M("gold")))

        if cape:
            fn, lo, hi = cape_shape(sh_z + 0.8, max(1.0, 22 - 20 * cape_len), 5.6 * g * shoulders, 8.2 * g,
                                    -2.2, 0.55, 1.6, cape_flare)
            self.add(custom(fn, lo, hi, self.M(cape)))
            if collar is None:
                self.add(torus(v(-0.4, 0, sh_z + 0.2), 3.2, 1.0, self.M(cape)))

        if crown:
            base = head_c + v(-0.2, 0, 2.6)
            self.add(Cut(cylinder(base, 3.5, 2.2, self.M(crown)), cylinder(base + v(0, 0, 0.3), 2.8, 3.0, self.M(crown))))
            for k in range(6):
                a = k / 6 * math.pi * 2
                self.add(cone(base + v(math.cos(a) * 3.2, math.sin(a) * 3.2, 2.0), 0.7, 0.1, 1.8, self.M(crown)))
            self.add(sphere(base + v(3.4, 0, 1.2), 0.6, self.M("flower_red")))

        if hat == "cap":           # a soft Tudor cap
            self.add(ellipsoid(head_c + v(-0.4, 0, 3.4), v(4.8, 4.8, 1.6), self.M(kw_hat_colour(self.kw))))
            self.add(sphere(head_c + v(-2.8, 2.6, 4.6), 0.9, self.M("white")))
        elif hat == "wide":        # Falstaff's
            self.add(cylinder(head_c + v(-0.3, 0, 2.2), 6.2, 0.8, self.M(kw_hat_colour(self.kw))))
            self.add(ellipsoid(head_c + v(-0.4, 0, 3.8), v(3.8, 3.8, 2.4), self.M(kw_hat_colour(self.kw))))
        elif hat == "jester":
            cols = self.kw.get("motley", ("red", "yellow", "green"))
            for k, (dy, col) in enumerate(((3.2, cols[0]), (0, cols[1]), (-3.2, cols[2]))):
                tip = head_c + v(-3.5 + k, dy * 2.0, 7.5 - abs(dy) * 0.6)
                self.add(capsule(head_c + v(-0.4, dy * 0.5, 3.2), tip, 2.2, self.M(col), r1=0.8))
                self.add(sphere(tip, 1.0, self.M("gold")))
            self.add(torus(head_c + v(0, 0, 1.4), 3.8, 0.9, self.M(cols[1])))
        elif hat == "laurel":
            self.add(torus(head_c + v(-0.3, 0, 2.2), 3.9, 0.9, self.M("leaf")))

        if hood:
            self.add(Cut(ellipsoid(head_c + v(-0.8, 0, 0.9), v(5.4, 5.3, 6.0), self.M(hood)),
                         ellipsoid(head_c + v(3.6, 0, -0.8), v(3.2, 3.4, 4.4), self.M(hood))))
            self.add(cone(head_c + v(-2.0, 0, 4.6), 2.6, 0.3, 5.0, self.M(hood)))

        if veil:
            self.add(ellipsoid(head_c + v(-2.6, 0, -2.0), v(2.2, 4.8, 8.0), self.M(veil)))

        for make in props:
            make(self)

    # -- placement ------------------------------------------------------------------------------
    def node(self, group):
        for part in self.parts:
            _set_group(part, group)
        return Moved(Union(self.parts), self.at, self.yaw, self.h)

    def world(self, local):
        c, s = math.cos(self.yaw), math.sin(self.yaw)
        q = np.asarray(local, float) * self.h
        return v(q[0] * c - q[1] * s, q[0] * s + q[1] * c, q[2]) + self.at


def kw_hat_colour(kw):
    return kw.get("hat_colour", "black")


def _set_group(node, group):
    if hasattr(node, "group"):
        node.group = group
    for attr in ("children",):
        for c in getattr(node, attr, []) or []:
            _set_group(c, group)
    for attr in ("a", "b", "child"):
        c = getattr(node, attr, None)
        if c is not None and hasattr(c, "eval"):
            _set_group(c, group)


# ---- props, each a function of the figure holding it --------------------------------------------

def sword(hand="right", length=13.0, raised=False, angle=None):
    def make(f):
        h = getattr(f, "hand_" + hand)
        el = getattr(f, "elbow_" + hand)
        d = h - el
        d = d / (np.linalg.norm(d) or 1)
        if angle is not None:
            a, b = map(math.radians, angle)
            d = v(math.sin(a) * math.cos(b), math.sin(b), -math.cos(a) * math.cos(b))
        guard = h + d * 1.4
        tip = guard + d * length
        f.add(capsule(guard, tip, 0.55, MAT["steel"], r1=0.2))
        side = np.cross(d, v(0, 0, 1))
        if np.linalg.norm(side) < 0.1:
            side = v(0, 1, 0)
        side = side / np.linalg.norm(side)
        f.add(capsule(guard - side * 1.8, guard + side * 1.8, 0.45, MAT["gold"]))
        f.add(sphere(h - d * 1.2, 0.8, MAT["gold"]))
    return make


def dagger(hand="right", point=(1, 0, 0.3)):
    def make(f):
        h = getattr(f, "hand_" + hand)
        d = v(*point)
        d = d / np.linalg.norm(d)
        f.add(capsule(h + d * 0.8, h + d * 6.0, 0.45, MAT["steel"], r1=0.12))
        side = np.cross(d, v(0, 0, 1))
        side = side / (np.linalg.norm(side) or 1)
        f.add(capsule(h + d * 0.6 - side * 1.1, h + d * 0.6 + side * 1.1, 0.35, MAT["gold"]))
    return make


def skull(hand="right", lift=(1.2, 0, 1.6)):
    def make(f):
        h = getattr(f, "hand_" + hand) + v(*lift)
        f.add(sphere(h, 2.2, MAT["bone"]))
        f.add(ellipsoid(h + v(0.8, 0, -1.6), v(1.4, 1.5, 1.0), MAT["bone"]))
        f.face.setdefault("sockets", []).extend([h + v(1.9, 0.8, 0.1), h + v(1.9, -0.8, 0.1)])
    return make


def candle(hand="right"):
    def make(f):
        h = getattr(f, "hand_" + hand)
        f.add(cylinder(h + v(0.6, 0, -0.6), 1.6, 0.5, MAT["gold"]))
        f.add(cylinder(h + v(0.6, 0, -0.2), 0.7, 3.2, MAT["candle"]))
        f.add(ellipsoid(h + v(0.6, 0, 4.0), v(0.7, 0.7, 1.3), MAT["flame"]))
        f.light = h + v(0.6, 0, 4.0)
    return make


def staff(hand="right", orb="magic", tall=30.0):
    def make(f):
        h = getattr(f, "hand_" + hand)
        top = h + v(0.6, 0, tall * 0.45)
        bot = v(h[0] + 0.6, h[1], 0.3)
        f.add(capsule(bot, top, 0.7, MAT["wood"]))
        if orb:
            f.add(sphere(top + v(0, 0, 1.6), 1.7, MAT[orb]))
            f.light = top + v(0, 0, 1.6)
    return make


def tankard(hand="right"):
    def make(f):
        h = getattr(f, "hand_" + hand)
        f.add(cylinder(h + v(0.8, 0, -1.4), 1.8, 4.0, MAT["iron"]))
        f.add(cylinder(h + v(0.8, 0, 2.4), 1.5, 0.6, MAT["foam"]))
    return make


def lantern(hand="right"):
    def make(f):
        h = getattr(f, "hand_" + hand)
        f.add(capsule(h, h + v(0, 0, -1.6), 0.25, MAT["iron"]))
        f.add(box(h + v(-1.4, -1.4, -5.6), h + v(1.4, 1.4, -1.6), MAT["iron"], round=0.3))
        f.add(box(h + v(-1.0, -1.0, -5.2), h + v(1.05, 1.05, -2.0), MAT["window"]))
        f.light = h + v(0, 0, -3.6)
    return make


def scroll(hand="right"):
    def make(f):
        h = getattr(f, "hand_" + hand)
        f.add(capsule(h + v(0.6, -2.4, 0.4), h + v(0.6, 2.4, 0.4), 0.9, MAT["cream"]))
    return make


def flowers(hand="left"):
    def make(f):
        h = getattr(f, "hand_" + hand)
        for k, col in enumerate(("flower_white", "flower_red", "lily", "flower_white", "leaf")):
            a = k * 1.3
            f.add(sphere(h + v(1.0 + math.cos(a) * 1.1, math.sin(a) * 1.3, 1.2 + (k % 2) * 0.8), 0.9, MAT[col]))
    return make


def bauble(hand="right"):
    """The fool's marotte: a little head on a stick."""
    def make(f):
        h = getattr(f, "hand_" + hand)
        top = h + v(1.2, 0, 6.5)
        f.add(capsule(h + v(0.2, 0, -1.0), top, 0.45, MAT["wood"]))
        f.add(sphere(top + v(0, 0, 1.3), 1.5, MAT["skin"]))
        for dy, col in ((1.4, "red"), (-1.4, "yellow")):
            f.add(capsule(top + v(0, dy * 0.4, 2.2), top + v(-0.6, dy * 1.6, 3.8), 0.9, MAT[col], r1=0.4))
    return make


class Extra:
    """Something drawn as a figure of its own without being a person — a pair of wings,
    a ship's company — so it can have its own outline, or be seen through."""

    def __init__(self, parts, face=None, anchor=(0, 0, 0)):
        self.parts = parts
        self.face = face or {}
        self.anchor = np.asarray(anchor, float)

    def node(self, group):
        for part in self.parts:
            _set_group(part, group)
        return Union(self.parts)

    def world(self, local):
        return np.asarray(local, float)


def wings(fig, span=11.0, flap=0.0, mat="wing"):
    """A pair of fairy wings on a figure's back, in world coordinates."""
    parts = []
    for side in (1, -1):
        for k, (up, size) in enumerate(((5.0, 1.0), (-1.5, 0.7))):
            a = math.radians(35 + flap * 20) * side
            local = v(-3.0 - size * 3.0 * math.cos(abs(a)), side * size * span * 0.45, 31 + up)
            c = fig.world(local)
            parts.append(ellipsoid(c, v(1.2 + size * 3.5, 1.2 + size * 3.5, size * 5.4), MAT[mat]))
    return Extra(parts)


def spade(hand="right"):
    def make(f):
        h = getattr(f, "hand_" + hand)
        top = h + v(0.4, 0, 4.0)
        bot = v(h[0] + 3.0, h[1], h[2] - 14.0)
        f.add(capsule(top, bot, 0.6, MAT["wood"]))
        f.add(box(bot + v(-1.6, -0.3, -5.0), bot + v(1.6, 0.3, 0.2), MAT["iron"]))
    return make


def nose(colour="flower_red"):
    def make(f):
        f.add(sphere(f.head_c + v(4.0, 0, -0.7), 1.1, MAT[colour]))
    return make


def flower_crown():
    def make(f):
        c = f.head_c + v(-0.3, 0, 2.4)
        for k in range(9):
            a = k / 9 * math.pi * 2
            col = ("flower_white", "lily", "flower_red")[k % 3]
            f.add(sphere(c + v(math.cos(a) * 3.8, math.sin(a) * 3.8, 0), 0.95, MAT[col]))
    return make


def ladle(hand="right", into=(0, 0, 0)):
    def make(f):
        h = getattr(f, "hand_" + hand)
        end = v(*into)
        f.add(capsule(h + (h - end) * 0.15, end, 0.5, MAT["wood_dark"]))
    return make
