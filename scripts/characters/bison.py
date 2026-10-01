"""The American bison (Bison bison), side on, facing right — after Elaine de Kooning.

Her Cave paintings (1983-85) came from the bison of Lascaux and Altamira, and
her bulls (Bullfight, 1959-60) before them: a few broad, leaning strokes.
So the bison is laid in strokes, not dithered (DIRT's roster gives her
grammar 4, strokes): each band of cells across the coat a step lighter or
darker than the light alone would give. Her inks from the roster: the cave's
burnt ochre for the short summer coat of the hindquarters, her umbers for the
wool of the hump, head and beard, her greys for the chalk line.

As a bison is made: the hump over the shoulders, the head carried low and
massive, the beard and the woolly "chaps" on the forelegs, short black horns
curving up, slim hindquarters, a thin tail with a tuft. It walks (a four-beat
walk, the near hind, near fore, far hind, far fore, three feet down at a
time), grazes when it pauses, turns its head to you, and lies down to rest,
legs folded under it.

Letters: d R r g the summer coat, deepest to lightest; k K the wool; W w the
horn's light and the muzzle; y the eye; o p the outline.
"""

import math

from draw import Part, capsule, ellipse, foot_at, limb, path, poly, raster, scaled, shaggy, strokes, triangle, turned, two_bone, union

W, H = 40, 26
GROUND = 24.6
CELL = 2

COAT = strokes("dRrg")
WOOL = strokes("kkKd", width=2.0, swing=1.3)
FAR = strokes("kK")
FAR_COAT = strokes("dR")


def leg(joint, foot, l1, l2, bend, r0, r1, paint, group, chaps=False):
    knee = two_bone(joint, foot, l1, l2, bend)
    sdf = union(capsule(joint, knee, r0 * (1.25 if chaps else 1), (r0 + r1) / 2 * (1.2 if chaps else 1)),
                capsule(knee, foot, (r0 + r1) / 2 * 0.75, r1))
    hoof = ellipse(foot[0] + 0.4, foot[1] - 0.2, 0.9, 0.6)
    return [Part(sdf, paint, group), Part(hoof, lambda *a: "k", group)]


SHOULDER = (26.4, 17.2)
HIP = (12.8, 17.0)


def legs(phases, dy=0.0, reach=2.4, lift=1.6):
    ff, fh, nf, nh = phases
    sh, hp = (SHOULDER[0], SHOULDER[1] + dy), (HIP[0], HIP[1] + dy)
    far = (leg((sh[0] - 1.6, sh[1]), foot_at(ff, sh[0] - 1.6, reach, lift, GROUND, 0.75), 3.6, 3.8, 1, 1.2, 0.7, FAR, 0) +
           leg((hp[0] - 1.4, hp[1]), foot_at(fh, hp[0] - 1.4, reach, lift, GROUND, 0.75), 3.6, 4.0, -1, 1.6, 0.75, FAR_COAT, 0))
    near = (leg(hp, foot_at(nh, hp[0], reach, lift, GROUND, 0.75), 3.4, 4.0, -1, 2.0, 0.85, COAT, 7) +
            leg(sh, foot_at(nf, sh[0], reach, lift, GROUND, 0.75), 3.4, 3.8, 1, 1.6, 0.8, WOOL, 7, chaps=True))
    limb(far[:2], "body"), limb(far[2:], "hind"), limb(near[:2], "hind"), limb(near[2:], "body")
    return far, near


def body(dy=0.0, tail=0.0):
    parts = []
    tl = [(7.2, 12.4 + dy), (6.4, 14.6 + dy + tail), (6.2, 17.6 + dy + tail)]
    parts.append(Part(path(tl, 0.5, 0.4), lambda *a: "K", 1))
    parts.append(Part(ellipse(6.2, 18.2 + dy + tail, 0.9, 1.3), lambda *a: "k", 1))
    hind = union(ellipse(12.2, 15.0 + dy, 5.0, 3.7), ellipse(18.0, 15.0 + dy, 6.4, 4.4))
    parts.append(Part(hind, COAT, 2))
    # The wool: the hump, the shoulders and chest, down to the forelegs.
    front = union(ellipse(24.2, 11.4 + dy, 6.2, 6.9, -0.25), ellipse(27.4, 15.8 + dy, 4.6, 5.0))
    parts.append(Part(front, WOOL, 3))
    return parts


def head_side(cx, cy, down=0.0, ear=0.0, blink=False):
    """The head side on, low, the beard under it; `down` lowers it to graze;
    `ear` flicks the ear up; `blink` closes the eye."""
    cy += down
    skull = union(ellipse(cx, cy, 3.6, 3.8, 0.4), ellipse(cx + 2.4, cy + 2.8, 2.1, 1.8))
    beard = triangle((cx - 1.6, cy + 2.0), (cx + 2.2, cy + 2.6), (cx - 0.4, cy + 6.2))
    horn = path([(cx - 0.6, cy - 2.6), (cx - 0.2, cy - 4.4), (cx + 1.0, cy - 5.0)], 0.6, 0.3)

    def paint(x, y, light, i, j):
        if math.hypot(x - (cx + 3.8), y - (cy + 2.6)) < 0.9:
            return "W"                       # the muzzle, pale
        return WOOL(x, y, light, i, j)
    parts = [Part(beard, WOOL, 4), Part(skull, paint, 5), Part(horn, lambda x, y, l, i, j: "w" if l > 0.7 else "k", 6)]
    if ear:
        parts.append(Part(ellipse(cx - 2.2, cy - 1.4 - ear, 1.0, 0.6, -0.5), WOOL, 6))
    parts.append(Part(ellipse(cx + 1.0, cy + 0.2, 0.55, 0.45 if not blink else 0.2), (lambda *a: "y") if not blink else (lambda *a: "k"), 7))
    return parts


def head_front(cx, cy):
    skull = ellipse(cx, cy, 3.4, 3.8)
    beard = triangle((cx - 2.0, cy + 2.0), (cx + 2.0, cy + 2.0), (cx, cy + 6.6))
    horns = union(path([(cx - 2.8, cy - 1.8), (cx - 4.4, cy - 2.6), (cx - 4.2, cy - 4.6)], 0.6, 0.3),
                  path([(cx + 2.8, cy - 1.8), (cx + 4.4, cy - 2.6), (cx + 4.2, cy - 4.6)], 0.6, 0.3))
    eyes = union(ellipse(cx - 1.6, cy - 0.2, 0.5, 0.45), ellipse(cx + 1.6, cy - 0.2, 0.5, 0.45))
    muzzle = ellipse(cx, cy + 2.4, 1.4, 1.0)
    return [Part(horns, lambda x, y, l, i, j: "w" if l > 0.7 else "k", 4), Part(beard, WOOL, 4),
            Part(skull, WOOL, 5), Part(muzzle, lambda *a: "W", 6), Part(eyes, lambda *a: "y", 7)]


def walk_parts(p, up=None, nod=0.0):
    up = (p in (0.25, 0.75)) if up is None else up
    dy = -0.4 if up else 0.0
    far, near = legs((p + 0.75, p + 0.5, p + 0.25, p), dy)
    return far + body(dy, tail=0.3 if up else 0.0) + head_side(32.8, 17.0 + dy + nod) + near


def walk(p):
    return raster(walk_parts(p), W, H)


def stand_parts(head="side", ear=0.0, blink=False, tail=0.0):
    far, near = legs((0.15, 0.62, 0.62, 0.15), 0.0, reach=1.0)
    parts = far + body(tail=tail)
    if head == "side":
        parts += head_side(32.8, 16.8, ear=ear, blink=blink)
    elif head == "up":
        parts += head_side(33.2, 15.0)
    elif head == "graze":
        parts += head_side(32.4, 16.8, down=3.2)
    else:
        parts += head_front(32.0, 15.2)
    parts += near
    return parts


def stand(head="side"):
    return raster(stand_parts(head), W, H)


def lie_parts(head="front"):
    """Lying down, legs folded under, the head up and turned to you (or, at
    rest in a chimera, the chin down on the ground)."""
    dy = 4.6
    parts = [Part(capsule((10.0, GROUND - 1.0), (16.0, GROUND - 0.6), 1.0, 0.8), FAR_COAT, 0)]
    parts += body(dy, tail=-1.6)
    parts.append(Part(capsule((24.0, GROUND - 0.8), (30.4, GROUND - 0.8), 1.3, 1.0), WOOL, 6))
    parts.append(Part(ellipse(31.0, GROUND - 0.6, 0.9, 0.6), lambda *a: "k", 6))
    parts += head_front(31.6, 15.6) if head == "front" else head_side(32.8, 18.6, down=0.4)
    return parts


def lie():
    return raster(lie_parts(), W, H)


def poses():
    return {
        "trot": [walk(p) for p in (0.0, 0.25, 0.5, 0.75)],
        "stand": [stand("side")],
        "back": [stand("graze")],
        "look": [stand("front")],
        "sit": [lie()],
        # The ethogram (characters.json): its instinct, its play, its ritual.
        "act": [raster(wind_parts(k), W, H) for k in range(4)],
        "play": [raster(wallow_parts(k), W, H) for k in range(2)],
        "ritual": [raster(rut_parts(k), W, H) for k in range(2)],
    }


# ---- in three parts, for a chimera (scripts/characters/chimera.py) ---------------

SEAMS = {"neck": (28.0, 14.0), "hip": (18.0, 15.0)}
CHIMERA_SCALE = 1.0


# The head as a chimera's head: drawn again, finer, since a chimera is drawn
# at half as many cells again (chimera.RES) and the head leads it. The cape
# of wool rising behind the head in the cave's ochre strokes, the head
# itself in the umbers, low and heavy, the forelock a mop over the brow, the
# beard hanging, a short black horn, the pale muzzle, a dark eye with its
# light in it.

HEAD_K = 1.22                  # the head drawn this much larger in a chimera
CAPE = strokes("dRrg", angle=1.9, width=2.4, swing=0.8)
FACE = strokes("kkKdR", angle=1.75, width=2.4, swing=0.45)
MOP = strokes("kkKd", angle=2.1, width=2.0, swing=0.6)
HORN = lambda x, y, l, i, j: "W" if l > 0.66 else "k"


def head_part(pose="side", k=0):
    """The head and its mane, from the neck's fold (x 28) forward: the mane
    rising off the fold and rolling over into the forelock, the long face
    falling steeply to the muzzle, the beard under the jaw."""
    nod = (0.0, 0.3, 0.6, 0.0, 0.3, 0.6)[k % 6] if pose == "walk" else 0.0
    down = {"back": 2.6, "act": (0.6, 1.2, 1.6, 1.6)[k % 4], "rest": 3.4, "present": -1.6}.get(pose, 0.0) + nod
    fwd = {"act": 0.8, "present": 0.2, "back": 0.6}.get(pose, 0.0)
    blown = (0.3, 0.7, 1.0, 1.0)[k % 4] if pose == "act" else 0.0
    sway = 0.35 * math.sin(k * 1.05) if pose == "walk" else (0.4 if pose == "stand" and k == 1 else 0.0)
    dx, dy = fwd, down
    P = lambda pts: [(x + dx * (x - 28) / 9.0, y + dy * (x - 28) / 9.0) for x, y in pts]   # the head swings from the fold
    parts = []
    mane = shaggy(poly(P([(27.4, 11.2), (29.0, 9.0), (31.2, 7.8), (33.6, 9.4), (34.6, 12.0), (33.0, 16.4),
                          (32.6, 20.4), (31.0, 22.4), (29.6, 21.0), (27.4, 21.0)])), 0.5, 1.7, 1.3 + blown)
    parts.append(Part(mane, CAPE, 2))
    if pose == "look":
        return parts + head_front_part(32.6, 15.6 + down)
    beard = shaggy(poly(P([(31.6, 18.6), (35.4, 20.4), (34.2, 22.4), (32.8 - blown * 1.6 + sway, 25.0 - blown * 0.8),
                           (31.0, 22.0)])), 0.38, 2.3, 0.4)
    parts.append(Part(beard, MOP, 3))
    face = poly(P([(33.0, 11.4), (35.0, 12.4), (36.4, 16.6), (37.4, 19.3), (36.6, 20.8), (34.4, 20.8), (32.2, 17.6)]))
    parts.append(Part(face, FACE, 4))
    mx, my = P([(36.4, 19.6)])[0]
    parts.append(Part(ellipse(mx, my, 1.15, 1.05), lambda x, y, l, i, j: "w" if l > 0.72 else "W", 5))
    parts.append(Part(ellipse(mx + 0.55, my - 0.35, 0.34, 0.3), lambda *a: "k", 6))
    tx, ty = P([(33.4, 12.2)])[0]
    mop = shaggy(ellipse(tx - blown * 0.6, ty, 2.1, 1.6, -0.2), 0.4, 2.1, 2.2 + blown)
    parts.append(Part(mop, MOP, 5))
    flick = pose == "stand" and k == 2
    ex, ey = P([(34.5, 14.6)])[0]
    ear = ellipse(ex - 2.1, ey - 0.6 - (0.8 if flick else 0.0), 1.05, 0.5, -0.3 - (0.7 if flick else 0.0))
    parts.append(Part(ear, FACE, 6))
    horn = path(P([(33.4, 12.8), (31.8, 12.2), (30.9, 10.6), (31.2, 8.8)]), 0.9, 0.34)
    parts.append(Part(horn, HORN, 7))
    shut = (pose == "stand" and k == 1) or (pose == "act" and k >= 2)
    parts.append(Part(ellipse(ex, ey, 0.62, 0.2 if shut else 0.5), lambda *a: "k", 8))
    if not shut:
        parts.append(Part(ellipse(ex - 0.26, ey - 0.24, 0.26, 0.24), lambda *a: "y", 9))
    return parts


def head_front_part(cx, cy):
    """Turned to you: the broad face, a horn either side, the mop, the beard."""
    beard = shaggy(triangle((cx - 2.0, cy + 2.6), (cx + 2.0, cy + 2.6), (cx, cy + 7.6)), 0.4, 2.3, 0.4)
    skull = ellipse(cx, cy + 0.6, 3.0, 3.8)
    mop = shaggy(ellipse(cx, cy - 2.0, 3.6, 2.2), 0.45, 2.1, 2.2)
    horns = union(path([(cx - 2.8, cy - 1.6), (cx - 4.6, cy - 2.2), (cx - 4.6, cy - 4.4)], 0.6, 0.28),
                  path([(cx + 2.8, cy - 1.6), (cx + 4.6, cy - 2.2), (cx + 4.6, cy - 4.4)], 0.6, 0.28))
    muzzle = ellipse(cx, cy + 3.4, 1.6, 1.1)
    nost = union(ellipse(cx - 0.7, cy + 3.5, 0.35, 0.3), ellipse(cx + 0.7, cy + 3.5, 0.35, 0.3))
    eyes = union(ellipse(cx - 1.7, cy + 0.2, 0.55, 0.5), ellipse(cx + 1.7, cy + 0.2, 0.55, 0.5))
    lights = union(ellipse(cx - 1.95, cy - 0.05, 0.28, 0.26), ellipse(cx + 1.45, cy - 0.05, 0.28, 0.26))
    return [Part(horns, HORN, 3), Part(beard, MOP, 3), Part(skull, FACE, 4), Part(mop, MOP, 5),
            Part(muzzle, lambda x, y, l, i, j: "w" if l > 0.7 else "W", 6), Part(nost, lambda *a: "k", 7),
            Part(eyes, lambda *a: "k", 7), Part(lights, lambda *a: "y", 8)]


def wind_parts(k):
    """Into the blizzard: it walks on with its head low into the wind."""
    p = k / 4.0
    far, near = legs((p + 0.75, p + 0.5, p + 0.25, p), 0.0)
    return far + body(0.0, tail=1.2) + head_side(33.4, 17.0, down=1.8, blink=k % 2 == 1) + near


def wallow_parts(k):
    """Wallowing: down on its side in the dust and rolling, legs in the air."""
    return turned(stand_parts("side"), (2.5, 2.9)[k], (20.0, 16.0), (0.0, 3.8))


def rut_parts(k):
    """The rut: head down, horns forward, braced to meet another head on."""
    far, near = legs((0.2, 0.7, 0.7, 0.2), 0.3, reach=1.6)
    return far + body(0.3) + head_side(33.8, 17.6, down=2.6 + 0.6 * k) + near


def rig(pose, k=0, slot="body"):
    if pose == "ritual" and slot != "head":
        return rut_parts(k), 0.0
    if pose == "act" and slot != "head":
        return wind_parts(k), 0.0
    if pose == "ritual":
        return scaled(head_part("back", 0), HEAD_K, (28.0, 18.0)), 0.0
    if slot == "head":
        return scaled(head_part(pose, k), HEAD_K, (28.0, 18.0)), {"rest": 4.6}.get(pose, 0.0)
    if pose == "walk":
        p = k / 6.0
        return walk_parts(p, up=k in (1, 4), nod=(0.0, -0.3, -0.6, 0.0, -0.3, -0.6)[k]), 0.0
    if pose == "stand":
        return stand_parts("side", ear=(0, 0, 1.0)[k], blink=k == 1, tail=(0, 0.6, 0)[k]), 0.0
    if pose == "back":
        return stand_parts("graze"), 0.0
    if pose == "look":
        return stand_parts("front"), 0.0
    if pose == "rest":
        return lie_parts("side"), 4.6
    return stand_parts("up"), 0.0


INKS = {"coat": ["#5a2c10", "#8a4216", "#b15519", "#c98b5c"], "white": ["#9e8880", "#cdc5b4"],
        "black": ["#2b211b", "#4f4036"], "eye": "#e2c9a0", "pen": ["#9e8880", "#5a2c10"], "box": "#b15519"}
