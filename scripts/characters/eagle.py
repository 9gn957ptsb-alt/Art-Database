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

from draw import Part, capsule, ellipse, flat, offset_line, path, raster, triangle, union

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


INKS = {"coat": ["#3a2a2d", "#523d41", "#6e5552", "#a0918a"], "white": ["#c9c0ad", "#ece6d4"],
        "black": ["#241a1c", "#523d41"], "eye": "#e1c31d", "pen": ["#8a7a74", "#b3a69c"], "box": "#e1c31d"}
