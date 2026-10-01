"""The bald eagle (Haliaeetus leucocephalus), side on, facing right — after Andy Warhol.

Warhol's Endangered Species (1983) has the bald eagle: a drawn line printed
over flat fields of colour, out of register. So the eagle is in flat inks,
no dither (a screenprint's plates), and its outline is the key plate laid
one cell off, down and to the right, so line and colour never quite meet
(offset_line in draw.py). His inks from DIRT's roster: the plum-brown dark
of his saved works for the body, their cream for the head and tail, their
yellow for the beak, the eye and the feet.

As a bald eagle is made: a dark brown body and wings, the white head and
white tail, a heavy yellow hooked bill, yellow feet. It flies (four frames of
the wingbeat: up, level, down, level; the wings long and broad, the
primaries spread as fingers at the tip), stands on the ground, turns its
white head to you, looks back over its shoulder, and settles with its wings
folded and its feathers a little fluffed.

Letters: d R r g the brown, deepest to lightest; W w the white; y the yellow;
k the eye's pupil; o p the chalk edge; the yellow (y) again for the key line
printed out of register.
"""

import math

from draw import Part, capsule, ellipse, flat, foot_at, limb, offset_line, path, raster, triangle, union

W, H = 40, 26
GROUND = 24.6
CELL = 2

BROWN = flat("Rr", 0.62)
DARK = flat("dR", 0.6)
WHITE = flat("Ww", 0.5)
YELLOW = lambda *a: "y"


def head(cx, cy, facing=1):
    f = facing
    skull = union(ellipse(cx, cy, 2.9, 2.5), ellipse(cx - f * 1.8, cy + 1.4, 2.3, 2.0))
    bill = union(triangle((cx + f * 1.6, cy - 0.6), (cx + f * 1.6, cy + 1.4), (cx + f * 4.6, cy + 0.2)),
                 ellipse(cx + f * 3.9, cy + 0.9, 0.8, 0.9))
    eye = ellipse(cx + f * 0.7, cy - 0.5, 0.5, 0.45)
    return [Part(skull, WHITE, 5), Part(bill, YELLOW, 6), Part(eye, lambda *a: "k", 7)]


def head_front(cx, cy):
    skull = ellipse(cx, cy, 2.8, 2.6)
    bill = union(ellipse(cx, cy + 1.0, 1.0, 1.4), triangle((cx - 0.8, cy + 1.6), (cx + 0.8, cy + 1.6), (cx, cy + 3.2)))
    eyes = union(ellipse(cx - 1.4, cy - 0.5, 0.45, 0.45), ellipse(cx + 1.4, cy - 0.5, 0.45, 0.45))
    return [Part(skull, WHITE, 5), Part(bill, YELLOW, 6), Part(eyes, lambda *a: "k", 7)]


def wing(stroke):
    """The near wing at a point of the beat: 0 up, 1 level, 2 down."""
    sh = (21.0, 13.2)
    if stroke == 0:
        pts, tip = [sh, (18.6, 7.6), (15.0, 2.4)], (13.6, 0.8)
    elif stroke == 1:
        pts, tip = [sh, (15.4, 11.6), (8.6, 10.8)], (6.6, 10.6)
    else:
        pts, tip = [sh, (18.4, 18.6), (15.6, 23.2)], (14.6, 24.8)
    arm = path(pts, 3.0, 1.5)
    dx, dy = tip[0] - pts[-1][0], tip[1] - pts[-1][1]
    fingers = []
    for k in (-1, 0, 1):
        nx, ny = -dy, dx
        L = math.hypot(nx, ny) or 1
        a = (pts[-1][0] + nx / L * k * 1.0, pts[-1][1] + ny / L * k * 1.0)
        fingers.append(capsule(a, (tip[0] + nx / L * k * 1.6, tip[1] + ny / L * k * 1.6), 0.55, 0.35))
    return Part(union(arm, *fingers), DARK, 8)


def fly(stroke):
    body = union(ellipse(19.6, 14.4, 6.8, 3.1, -0.08), ellipse(24.6, 13.4, 2.8, 2.6))
    tail = triangle((14.0, 13.4), (6.4, 12.4), (7.0, 16.6))
    feet = capsule((17.0, 16.0), (14.6, 16.8), 0.6, 0.5)
    far = {0: [(20.0, 12.4), (19.0, 7.0)], 1: [(20.0, 13.0), (13.0, 12.2)], 2: [(20.0, 14.6), (19.0, 19.6)]}[stroke]
    parts = [Part(path(far, 1.8, 1.1), lambda *a: "d", 0), Part(tail, WHITE, 1), Part(feet, YELLOW, 2),
             Part(body, BROWN, 3)]
    parts += head(27.6, 12.2)
    parts.append(wing(stroke))
    return offset_line(raster(parts, W, H))


def perched(head_kind="side", fluff=0.0):
    body = ellipse(20.2, 15.0 + fluff * 0.5, 4.5 + fluff, 6.4, 0.34)
    wing_ = ellipse(19.0, 15.8, 3.0 + fluff * 0.6, 6.0, 0.42)
    tail = triangle((16.8, 19.6), (13.0, GROUND - 0.4), (15.6, GROUND))
    legs = union(capsule((20.0, 20.4), (20.2, GROUND - 0.6), 0.6, 0.45), capsule((21.6, 20.2), (21.8, GROUND - 0.6), 0.6, 0.45))
    toes = union(ellipse(20.8, GROUND - 0.3, 0.9, 0.45), ellipse(22.4, GROUND - 0.3, 0.9, 0.45))
    trousers = ellipse(21.0, 20.6, 2.2, 1.6)
    parts = [Part(tail, WHITE, 1), Part(legs, YELLOW, 2), Part(toes, YELLOW, 2), Part(body, BROWN, 3),
             Part(trousers, DARK, 3), Part(wing_, DARK, 4)]
    if head_kind == "side":
        parts += head(22.8, 7.8 + fluff)
    elif head_kind == "back":
        parts += head(20.4, 7.8, facing=-1)
    else:
        parts += head_front(21.6, 7.6 + fluff)
    return offset_line(raster(parts, W, H))


def poses():
    return {
        "trot": [fly(0), fly(1), fly(2), fly(1)],
        "stand": [perched("side")],
        "back": [perched("back")],
        "look": [perched("front")],
        "sit": [perched("front", fluff=0.9)],
    }


# ---- walking, and in three parts, for a chimera (scripts/characters/chimera.py) ----
#
# In a chimera the eagle walks: its body level, the breast forward, the
# yellow legs under the breast (as the body) or under the rump (as the
# hindquarters), its wings folded along the back or raised in a mantle — the
# arch an eagle makes over what it has caught, primaries spread as fingers.

SEAMS = {"neck": (25.4, 13.6), "hip": (13.8, 15.2)}
CHIMERA_SCALE = 1.0
GROUND_W = GROUND


def talons(hip, foot, near, slot):
    """A leg: the feathered trouser, the bare yellow tarsus, three toes
    forward and the hind toe, black talons."""
    fx, fy = foot
    thigh = ellipse(hip[0], hip[1], 2.0, 1.6, 0.3)
    shank = capsule((hip[0] + 0.2, hip[1] + 1.0), (fx, fy - 0.8), 0.62, 0.5)
    toes = union(capsule((fx - 0.2, fy - 0.4), (fx + 1.9, fy - 0.3), 0.42, 0.32),
                 capsule((fx - 0.2, fy - 0.4), (fx - 1.3, fy - 0.2), 0.38, 0.3))
    claws = union(ellipse(fx + 2.2, fy - 0.1, 0.38, 0.32), ellipse(fx - 1.6, fy - 0.1, 0.34, 0.3))
    g = 7 if near else 0
    parts = [Part(thigh, DARK if near else (lambda *a: "d"), g), Part(shank, YELLOW, g),
             Part(toes, YELLOW, g), Part(claws, lambda *a: "k", g)]
    return limb(parts, slot)


def mantle_wing(m, far=False):
    """The near wing raised in a mantle: m 0 folded along the back, 1 high
    and spread; the far wing is its dark shadow behind the back."""
    sh = (21.6, 11.6) if not far else (22.6, 11.2)
    if m <= 0:
        fold = union(ellipse(17.6, 13.0, 6.6, 2.5, 0.1), capsule((13.0, 13.6), (7.6, 14.6), 1.3, 0.6))
        return Part(fold, DARK, 8 if not far else 0)
    top = (19.0 - 2.0 * m, 11.0 - 7.4 * m)
    tip = (12.4 - 4.8 * m, 10.6 - 4.2 * m)
    arm = path([sh, top, tip], 2.6, 1.6)
    fingers = []
    for k in range(4):
        a = (tip[0] + 2.4 * k * 0.5, tip[1] + 0.6 * k)
        b = (a[0] - 2.6 + k * 0.25, a[1] + 3.2 + 0.7 * k)
        fingers.append(capsule(a, b, 0.75, 0.45))
    secondaries = triangle(sh, top, (tip[0] + 3.0, tip[1] + 6.6 * m + 1.0))
    sdf = union(arm, secondaries, *fingers)
    if far:
        return Part(sdf, lambda *a: "d", 0)
    return Part(sdf, DARK, 8)


def walker(phase=0.0, legs_at="body", mantle=0.0, head_kind="side", lower=0.0, up=0.0, fluff=0.0, sit=False):
    """The walking eagle, as parts. `legs_at` puts the legs under the breast
    (as a body) or under the rump (as hindquarters)."""
    dy = (2.0 if sit else 0.0) + lower
    parts = []
    if mantle > 0:
        parts.append(mantle_wing(mantle * 0.9, far=True))
    tail = triangle((14.4, 13.0 + dy), (5.4, 13.2 + dy - up), (6.2, 17.0 + dy - up))
    parts.append(Part(tail, WHITE, 1))
    lx = 21.4 if legs_at == "body" else 15.6
    slot = legs_at
    if sit:
        feet = [Part(capsule((lx - 1.0, GROUND - 0.5), (lx + 2.4, GROUND - 0.4), 0.5, 0.4), YELLOW, 2)]
        parts += limb(feet, slot)
    else:
        far = talons((lx - 0.6, 17.6 + dy), foot_at(phase + 0.5, lx - 0.4, 1.8, 1.4, GROUND, 0.6), False, slot)
        parts += far
    body = union(ellipse(19.2, 15.0 + dy, 7.4 + fluff, 3.9 + fluff * 0.5, -0.1),
                 ellipse(24.2, 13.8 + dy, 2.9, 3.0))
    parts.append(Part(body, BROWN, 3))
    neck = capsule((24.6, 13.0 + dy), (27.0, 10.6 + dy - up), 2.5, 2.1)
    parts.append(Part(neck, WHITE, 4))
    if head_kind == "front":
        parts += head_front(28.0, 9.4 + dy - up)
    elif head_kind == "down":
        parts += head(29.4, 12.4 + dy)
    else:
        parts += head(28.6, 9.6 + dy - up)
    if not sit:
        parts += talons((lx + 0.4, 17.2 + dy), foot_at(phase, lx + 0.6, 1.8, 1.4, GROUND, 0.6), True, slot)
    parts.append(mantle_wing(mantle) if mantle > 0 else mantle_wing(0))
    return parts


def rig(pose, k=0, legs_at="body"):
    if pose == "walk":
        p = k / 6.0 + 0.25
        return walker(p, legs_at, mantle=(0.0, 0.08, 0.16, 0.0, 0.08, 0.16)[k] * 0), 0.0
    if pose == "stand":
        return walker(0.1, legs_at, mantle=(0, 0, 0.55)[k], fluff=(0, 0.35, 0)[k]), 0.0
    if pose == "back":
        return walker(0.1, legs_at, head_kind="down", mantle=0.3), 0.0
    if pose == "look":
        return walker(0.1, legs_at, head_kind="front"), 0.0
    if pose == "rest":
        return walker(0.1, legs_at, sit=True, fluff=0.4, lower=1.6), 3.6
    return walker(0.1, legs_at, mantle=1.0, up=1.0), 0.0


def finish(rows):
    return offset_line(rows)


INKS = {"coat": ["#3a2a2d", "#523d41", "#6e5552", "#a0918a"], "white": ["#c9c0ad", "#ece6d4"],
        "black": ["#241a1c", "#523d41"], "eye": "#e1c31d", "pen": ["#8a7a74", "#b3a69c"], "box": "#e1c31d"}
