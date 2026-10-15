"""The banana slug (Ariolimax), side on, facing right — after Anish Kapoor.

Kapoor's Svayambh (2007) is a mass of wax that moves through the museum on
its own, slowly, leaving its trace on the doorways; his Yellow (1999) is a
field of one colour so deep it has no edge. DIRT's roster gives him grammar
6, stacked fields: few marks, little open ground. So the slug is drawn in
fields, not light and shade: stacked bands of one yellow, from the dark of
the foot's fringe up to the pale of its back, each band flat, the steps
between them clean (no dither). His inks from the roster: the deep yellow of
his saved works (his pigment), their pale for the back, their violet-grey
dark, the void's, for the fringe, the spots and the eyes. Behind it, it
leaves its trace (characters.js, the trail "slime"): a line of that dark
along the ground with a glint in it, that dries in steps.

As a banana slug is made: a long soft body, the mantle a smooth saddle over
the front third, two long upper tentacles with the eyes at their tips and
two short ones below, the tail drawn to a point, the foot's fringe along the
ground, a few dark spots. It crawls (a wave going along the foot from the
tail to the head, the body stretching and gathering), stops with its
tentacles out, lifts its head toward you, and rests drawn up short with its
tentacles in.

Letters: d the fringe, R r g the bands, deepest to palest; k the spots and
eyes; o p the outline.
"""

import math

from draw import Part, capsule, ellipse, path, raster, union

W, H = 40, 26
GROUND = 24.6
CELL = 2


SPOTS = [(0.16, 0.52), (0.35, 0.68), (0.50, 0.40), (0.84, 0.62)]            # along the body, down it


def profile(tail_x, head_x, hump, rise, lift):
    """The body's thickness and centre line along its length: thin at the tail, the back arching to its fullest
    over the mantle (a dome with the sole flat on the ground), narrower again to the blunt head."""
    L = head_x - tail_x

    def r_of(u):
        if u < 0.62:
            return 0.5 + (2.9 + rise - 0.5) * math.sin(math.pi / 2 * (u / 0.62)) ** 1.15
        return 2.9 + rise - (1.0 + rise * 0.3) * ((u - 0.62) / 0.38) ** 1.7

    def yc_of(u):
        y = GROUND - 1.1 - r_of(u)
        if hump is not None:
            y -= 0.9 * math.exp(-((u - hump) / 0.12) ** 2)
        return y - lift * max(0.0, (u - 0.7) / 0.3) ** 2
    return L, r_of, yc_of


def bands(tail_x, head_x, r_of, yc_of):
    """Stacked fields: the band of a cell by its height in the body, a pale highlight over the back, the banana's
    own yellow, a deeper one below, the foot's margin pale; and the dark spots, laid by where they are along it."""
    L = head_x - tail_x

    def paint(x, y, light, i, j):
        u = max(0.0, min(1.0, (x - tail_x) / L))
        r, yc = r_of(u), yc_of(u)
        t = (y - (yc - r)) / max(1.0, 2 * r)
        if y > GROUND - 1.15:
            return "g"                                          # the foot's margin, pale along the ground
        for su, sv in SPOTS:
            sx = tail_x + su * L
            su2 = max(0.0, min(1.0, su))
            sy = yc_of(su2) - r_of(su2) + sv * 2 * r_of(su2)
            if math.hypot(x - sx, (y - sy) * 1.25) < 0.8:
                return "k"                                      # a spot
        return "g" if t < 0.14 else "r" if t < 0.66 else "R"
    return paint


def slug_parts(tail_x, head_x, hump=None, rise=0.0, stalks=1.0, lift=0.0, front=False):
    """The body from tail to head along the ground; `hump` lifts it where the
    wave is; `lift` raises the head; `stalks` how far the tentacles are out."""
    L, r_of, yc_of = profile(tail_x, head_x, hump, rise, lift)
    n = 12
    pts = [(tail_x + L * k / n, yc_of(k / n)) for k in range(n + 1)]
    segs = [capsule(pts[k], pts[k + 1], r_of(k / n), r_of((k + 1) / n)) for k in range(n - 1)]
    hx, hy = pts[-1][0] - 1.2, pts[-1][1] + 0.5
    body = union(*segs, ellipse(hx, hy, 2.5, r_of(1.0) + 0.5))
    # the mantle: the saddle over the front third, glossy, with the breathing pore on its edge
    mu = 0.62
    mx, mr = tail_x + L * mu, r_of(mu)
    my = yc_of(mu) - mr * 0.45
    mantle = ellipse(mx, my, L * 0.2, mr * 0.62)
    parts = [Part(body, bands(tail_x, head_x, r_of, yc_of), 2),
             Part(mantle, lambda x, y, light, i, j: "g" if light > 0.55 else "r", 2),
             Part(ellipse(mx + L * 0.13, my + mr * 0.5, 0.55, 0.5), lambda *a: "k", 2)]
    if stalks > 0:
        ey = hy - 1.0
        if front:
            st = union(capsule((hx - 0.6, ey), (hx - 2.0, ey - 3.8 * stalks), 0.55, 0.5),
                       capsule((hx + 0.6, ey), (hx + 2.0, ey - 3.8 * stalks), 0.55, 0.5))
            tips = union(ellipse(hx - 2.0, ey - 3.9 * stalks, 0.85, 0.85), ellipse(hx + 2.0, ey - 3.9 * stalks, 0.85, 0.85))
            low = union(capsule((hx - 1.2, hy + 1.0), (hx - 2.2, hy + 1.6), 0.45, 0.4), capsule((hx + 1.2, hy + 1.0), (hx + 2.2, hy + 1.6), 0.45, 0.4))
        else:
            far = capsule((hx + 0.2, ey + 0.2), (hx + 2.2 * stalks, ey - 3.8 * stalks), 0.5, 0.45)
            near = capsule((hx + 1.2, ey), (hx + 3.6 * stalks, ey - 3.6 * stalks), 0.6, 0.5)
            st = union(far, near)
            tips = union(ellipse(hx + 2.2 * stalks, ey - 3.9 * stalks, 0.8, 0.8), ellipse(hx + 3.6 * stalks, ey - 3.7 * stalks, 0.85, 0.85))
            low = union(capsule((hx + 1.8, hy + 0.9), (hx + 1.8 + 2.0 * stalks, hy + 1.5), 0.45, 0.4))
        parts.append(Part(st, lambda *a: "r", 3))
        parts.append(Part(low, lambda *a: "R", 3))
        parts.append(Part(tips, lambda *a: "k", 4))
    return parts


def slug(*a, **k):
    return raster(slug_parts(*a, **k), W, H)


def poses():
    return {
        "trot": [slug(4.0, 34.0, hump=0.15), slug(4.0, 34.8, hump=0.4), slug(4.6, 35.4, hump=0.65),
                 slug(5.2, 35.0, hump=0.9)],
        "stand": [slug(4.0, 34.6)],
        "back": [slug(4.0, 34.6, stalks=1.35)],
        "look": [slug(4.0, 33.8, lift=3.4, front=True)],
        "sit": [slug(9.0, 30.0, rise=1.0, stalks=0.0)],
        # The ethogram (characters.json): its instinct (the glide along a
        # trail, the wave running the length of the foot) and its ritual.
        "act": [slug(4.0 + 0.3 * k, 34.0 + 0.3 * k, hump=(k + 0.5) / 4.0, stalks=1.2) for k in range(4)],
        "ritual": [raster(court_parts(k), W, H) for k in range(2)],
    }


# ---- in three parts, for a chimera (scripts/characters/chimera.py) ---------------

SEAMS = {"neck": (32.0, 21.6), "hip": (20.0, 22.4)}
CHIMERA_SCALE = 1.0
CHIMERA_SLOT_K = {"hind": 0.8}   # its long foot, as a chimera's hindquarters, ran twice the length of a bison's body


def court_parts(k):
    """Courtship: two circle each other, and lunge; the front lifted and
    curled toward the other, the tentacles out."""
    return slug_parts(6.0 + k, 32.0 + k, lift=2.6 + 1.2 * k, stalks=1.3, hump=0.5)


def rig(pose, k=0):
    if pose == "act":
        return slug_parts(4.0 + 0.3 * k, 34.0 + 0.3 * k, hump=(k + 0.5) / 4.0, stalks=1.2), 0.0
    if pose == "ritual":
        return court_parts(k), 0.0
    if pose == "walk":
        # The wave runs along the foot from the tail to the head.
        return slug_parts(4.0 + 0.2 * k, 34.0 + 0.2 * (k % 3), hump=k / 6.0), 0.0
    if pose == "stand":
        return slug_parts(4.0, 34.6, hump=(None, None, 0.3)[k], stalks=(1.0, 0.85, 1.0)[k]), 0.0
    if pose == "back":
        return slug_parts(4.0, 34.6, stalks=1.35), 0.0
    if pose == "look":
        return slug_parts(4.0, 33.8, lift=3.4, front=True), 0.0
    if pose == "rest":
        return slug_parts(6.0, 33.0, rise=0.6, stalks=0.3), 0.0
    return slug_parts(4.0, 34.6, lift=2.0, stalks=1.4), 0.0


INKS = {"coat": ["#3c3741", "#c98a10", "#ffa801", "#ffd27a"], "white": ["#e4e2dd", "#e4e2dd"],
        "black": ["#3c3741", "#3c3741"], "eye": "#3c3741", "pen": ["#aca69a", "#7a5a10"],
        "box": "#ffa801", "writing": ["#3c3741", "#e4e2dd"]}
