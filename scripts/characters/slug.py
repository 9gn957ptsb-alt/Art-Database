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


def bands(top, bottom):
    """Stacked fields: the band of a cell by its height in the body."""
    def paint(x, y, light, i, j):
        if y > GROUND - 1.0:
            return "d"
        t = (y - top) / max(1.0, bottom - top)
        if (i * 7 + j * 3) % 23 == 0 and 0.25 < t < 0.7:
            return "k"                         # a spot
        return "g" if t < 0.28 else "r" if t < 0.66 else "R"
    return paint


def slug_parts(tail_x, head_x, hump=None, rise=0.0, stalks=1.0, lift=0.0, front=False):
    """The body from tail to head along the ground; `hump` lifts it where the
    wave is; `lift` raises the head; `stalks` how far the tentacles are out."""
    base = GROUND - 2.1
    pts = []
    n = 8
    for k in range(n + 1):
        u = k / n
        x = tail_x + (head_x - tail_x) * u
        y = base
        if hump is not None:
            y -= 0.9 * math.exp(-((u - hump) / 0.12) ** 2)
        y -= lift * max(0.0, (u - 0.7) / 0.3) ** 2
        pts.append((x, y))
    body = union(path(pts[:-1], 0.6, 2.7 + rise), ellipse(pts[-2][0] + 0.4, pts[-2][1] + 0.3, 2.6, 2.4 + rise * 0.6))
    mantle = ellipse(head_x - (head_x - tail_x) * 0.22, base - 0.9 - rise * 0.5 - lift * 0.3,
                     (head_x - tail_x) * 0.21, 2.7 + rise * 0.6)
    parts = [Part(union(body, mantle), bands(base - 3.4 - rise - lift, GROUND), 2)]
    hx, hy = pts[-2][0] + 2.0, pts[-2][1]
    if stalks > 0:
        if front:
            st = union(capsule((hx - 0.4, hy - 1.4), (hx - 1.6, hy - 1.4 - 3.6 * stalks), 0.45, 0.4),
                       capsule((hx + 0.4, hy - 1.4), (hx + 1.6, hy - 1.4 - 3.6 * stalks), 0.45, 0.4))
            tips = union(ellipse(hx - 1.6, hy - 1.6 - 3.6 * stalks, 0.55, 0.55), ellipse(hx + 1.6, hy - 1.6 - 3.6 * stalks, 0.55, 0.55))
        else:
            st = union(capsule((hx + 0.6, hy - 1.2), (hx + 2.4 * stalks, hy - 1.2 - 3.4 * stalks), 0.45, 0.4),
                       capsule((hx + 1.2, hy + 0.6), (hx + 1.2 + 1.6 * stalks, hy + 1.0), 0.4, 0.35))
            tips = ellipse(hx + 2.4 * stalks, hy - 1.4 - 3.4 * stalks, 0.55, 0.55)
        parts.append(Part(st, lambda *a: "r", 3))
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
