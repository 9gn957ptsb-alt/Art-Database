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

from draw import Part, capsule, ellipse, flat, foot_at, limb, offset_line, path, poly, raster, shaggy, triangle, turned, union

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
    return offset_line(raster(fly_parts(stroke), W, H))


def fly_parts(stroke):
    body = union(ellipse(19.6, 14.4, 6.8, 3.1, -0.08), ellipse(24.6, 13.4, 2.8, 2.6))
    tail = triangle((14.0, 13.4), (6.4, 12.4), (7.0, 16.6))
    feet = capsule((17.0, 16.0), (14.6, 16.8), 0.6, 0.5)
    far = {0: [(20.0, 12.4), (19.0, 7.0)], 1: [(20.0, 13.0), (13.0, 12.2)], 2: [(20.0, 14.6), (19.0, 19.6)]}[stroke]
    parts = [Part(path(far, 1.8, 1.1), lambda *a: "d", 0), Part(tail, WHITE, 1), Part(feet, YELLOW, 2),
             Part(body, BROWN, 3)]
    parts += head(27.6, 12.2)
    parts.append(wing(stroke))
    return parts


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
        # The ethogram (characters.json): its instinct, its play, its ritual.
        "act": [offset_line(raster(mantle_parts(k), W, H)) for k in range(4)],
        "play": [offset_line(raster(soar_parts(k), W, H)) for k in range(2)],
        "ritual": [offset_line(raster(cartwheel_parts(k), W, H)) for k in range(2)],
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


def feathers(shoulder, angle):
    """Warhol's drawn line over the flat plates: rows of scalloped coverts
    near the shoulder, then the long flight feathers, each edged in the
    dark, the line drawn freely (it never quite follows the colour)."""
    ca, sa = math.cos(angle), math.sin(angle)

    def paint(x, y, light, i, j):
        u = (x - shoulder[0]) * ca + (y - shoulder[1]) * sa      # along the wing, from the shoulder
        v = -(x - shoulder[0]) * sa + (y - shoulder[1]) * ca     # across it
        if u < 5.0:
            row = (v + 0.6 * math.sin(u * 1.9)) / 1.7
            if abs(row - round(row)) < 0.16:
                return "d"
            return "R" if light >= 0.6 else "d" if light < 0.3 else "R"
        lane = (v - 0.18 * (u - 5.0)) / 1.25
        if abs(lane - round(lane)) < 0.13:
            return "d"
        return "r" if light >= 0.66 else "R"
    return paint


def mantle_wing(m, far=False):
    """The near wing raised in a mantle: m 0 folded along the back, 1 high
    and spread; the far wing is its dark shadow behind the back."""
    sh = (21.6, 11.6) if not far else (22.6, 11.2)
    if m <= 0:
        fold = union(ellipse(17.6, 13.0, 6.6, 2.6, 0.1), capsule((13.0, 13.6), (7.6, 14.6), 1.3, 0.6))
        return Part(fold, feathers((23.0, 12.0), math.pi + 0.1), 8 if not far else 0)
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
    return Part(sdf, feathers(sh, math.atan2(top[1] - sh[1], top[0] - sh[0])), 8)


LINE = lambda *a: "k"


def wing_paint(shoulder, angle, m=0.0):
    """The wing's plate, flat, with Warhol's drawn line over it: rows of
    scalloped coverts near the shoulder, then the long flight feathers
    (their lines fanning as the wing opens), the lit edge one step up."""
    ca, sa = math.cos(angle), math.sin(angle)

    def paint(x, y, light, i, j):
        u = (x - shoulder[0]) * ca + (y - shoulder[1]) * sa
        v = -(x - shoulder[0]) * sa + (y - shoulder[1]) * ca
        if light > 0.9:
            return "r"
        if u < 4.6 + 1.5 * m:
            row = (u + 0.8 * math.cos(v * 1.4)) / 2.1
            if abs(row - round(row)) < 0.09 and u > 1.2:
                return "k"
            return "R"
        lane = (v * (1.0 - 0.45 * m) - 0.12 * (u - 4.6)) / 1.7
        if abs(lane - round(lane)) < 0.09:
            return "k"
        return "d"
    return paint


def body_part(pose="stand", k=0):
    """The eagle as a chimera's body: breast and belly in the flat brown,
    the folded wing (or the mantle) over the back, the feathered trousers,
    the short yellow legs and the talons."""
    walk = pose == "walk"
    p = k / 6.0 + 0.25 if walk else 0.1
    bob = (0.0, -0.25, -0.4, 0.0, -0.25, -0.4)[k] if walk else 0.0
    # At rest its wings are held a little off the back, as the eagle stands
    # over what it has; half raised as an idle; fully, presented.
    mantle = {"present": 1.0, "back": 0.45, "stand": 0.28, "look": 0.28, "ritual": 0.28}.get(pose, 0.0)
    if pose == "stand" and k == 2:
        mantle = 0.62
    if pose == "act":
        mantle = (0.25, 0.6, 1.0, 1.0)[k]
    sit = pose == "rest"
    dy = (3.2 if sit else 0.0) + bob
    parts = []
    if mantle > 0:
        parts.append(mantle_wing_part(mantle * 0.85, dy, far=True))
    lx = 21.0
    if not sit:
        parts += talons_part((lx - 1.0, 17.0 + dy), foot_at(p + 0.5, lx - 0.8, 1.7, 1.3, GROUND, 0.6), False)
    breast = poly([(12.6, 11.6 + dy), (18.0, 10.6 + dy), (23.0, 10.0 + dy), (26.4, 10.6 + dy), (26.4, 16.6 + dy),
                   (23.6, 18.4 + dy), (18.0, 18.6 + dy), (12.6, 17.6 + dy)])
    parts.append(Part(breast, flat("Rr", 0.66), 3))
    if not sit:
        parts += talons_part((lx + 0.4, 16.8 + dy), foot_at(p, lx + 0.6, 1.7, 1.3, GROUND, 0.6), True)
    else:
        toes = capsule((lx - 0.4, GROUND - 0.45), (lx + 2.4, GROUND - 0.4), 0.45, 0.35)
        parts.append(limb([Part(toes, YELLOW, 4)], "body")[0])
        parts.append(Part(shaggy(ellipse(lx + 0.2, 18.6 + dy * 0.6, 2.6, 1.6), 0.3, 2.4), lambda *a: "d", 4))
    if mantle > 0:
        parts += mantle_wing_part(mantle, dy)
    else:
        fold = poly([(24.6, 10.6 + dy), (20.4, 9.4 + dy), (15.0, 10.2 + dy), (9.0, 12.4 + dy), (8.4, 14.2 + dy),
                     (15.2, 15.8 + dy), (21.4, 15.6 + dy), (24.8, 13.6 + dy)])
        parts.append(Part(fold, flat("Rr", 0.8), 8))
        # Warhol's drawn line: two rows of scalloped coverts, the long
        # flight feathers below them running back to the tips.
        def scallops(x0, x1, y, n):
            pts = []
            for q in range(n * 2 + 1):
                pts.append((x0 + (x1 - x0) * q / (n * 2), y + (0.0 if q % 2 == 0 else 0.75)))
            return pts
        for line in (scallops(23.8, 17.0, 12.0, 3), scallops(22.6, 15.6, 13.9, 3),
                     [(16.6, 14.6), (12.0, 14.4), (8.6, 14.0)], [(17.4, 12.6), (12.4, 12.9), (9.2, 13.2)]):
            parts.append(Part(path([(x, y + dy) for x, y in line], 0.2), LINE, 9))
    return parts


def mantle_wing_part(m, dy, far=False):
    """Mantling: the wing raised at the wrist, the hand and its primaries
    hanging down in front like a curtain over what it hides."""
    lift = 7.4 * m
    sh = (22.0, 11.2 + dy) if not far else (22.8, 10.8 + dy)
    wrist = (19.0, 10.6 + dy - lift)
    hand = (19.0 + 4.2 * m, 11.0 + dy - lift)
    if far:
        wrist, hand = (wrist[0] + 1.2, wrist[1] + 0.8), (hand[0] + 0.6, hand[1] + 0.8)
    pts = [sh, wrist, hand, (hand[0] + 0.6, hand[1] + 1.0)]
    # primaries hanging from the hand, as fingers
    hang = 3.6 + 2.0 * m
    fingers = []
    for q in range(4):
        x = hand[0] + 0.4 - 1.2 * q
        fingers.append(capsule((x, hand[1] + 0.4), (x - 0.4, hand[1] + hang - 0.6 * q), 0.6, 0.36))
    curtain = poly([sh, wrist, (wrist[0] - 3.6, wrist[1] + 2.4 + 1.6 * (1 - m)), (13.4, 11.8 + dy), (16.0, 13.2 + dy)])
    sdf = union(path(pts, 1.4, 1.0), curtain, *fingers)
    if far:
        return Part(sdf, lambda *a: "d", 0)

    def paint(x, y, light, i, j):
        if light > 0.88:
            return "r"
        if (y - wrist[1]) < 2.2 and x > wrist[0] - 3.0:
            return "R"                               # the coverts along the arm
        return "d" if x > hand[0] - 4.6 and y > hand[1] + 0.8 else "R"
    lines = []
    for q in range(1, 4):
        x = hand[0] + 0.4 - 1.2 * q + 0.6
        lines.append(path([(x, hand[1] + 0.9), (x - 0.4, hand[1] + hang - 0.6 * q - 0.4)], 0.17))
    for q in range(3):
        a = (wrist[0] - 0.6 - 1.4 * q, wrist[1] + 1.4 + 0.6 * q)
        lines.append(path([a, (a[0] - 1.8, a[1] + 3.0 + q)], 0.17))
    return [Part(sdf, paint, 8), Part(union(*lines), LINE, 9)]


def talons_part(hip, foot, near):
    fx, fy = foot
    trouser = shaggy(ellipse(hip[0] - 0.2, hip[1] + 0.9, 1.9, 2.7, 0.15), 0.3, 2.4, 0.7)
    shank = capsule((hip[0] + 0.3, hip[1] + 1.2), (fx, fy - 0.9), 0.5, 0.4)
    toes = union(capsule((fx - 0.1, fy - 0.45), (fx + 1.8, fy - 0.35), 0.42, 0.3),
                 capsule((fx - 0.1, fy - 0.45), (fx + 1.2, fy - 0.15), 0.38, 0.28),
                 capsule((fx - 0.1, fy - 0.45), (fx - 1.2, fy - 0.25), 0.36, 0.28))
    claws = union(ellipse(fx + 2.1, fy - 0.15, 0.36, 0.3), ellipse(fx - 1.5, fy - 0.15, 0.32, 0.28))
    g = 7 if near else 0
    gold = YELLOW if near else (lambda x, y, l, i, j: "y" if l > 0.75 else "d")
    parts = [Part(shank, gold, g), Part(toes, gold, g), Part(claws, lambda *a: "k", g),
             Part(trouser, (lambda x, y, l, i, j: "R" if l > 0.7 else "d") if near else (lambda *a: "d"), g)]
    return limb(parts, "body")


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
    neck = capsule((26.0, 12.4 + dy), (27.2, 10.6 + dy - up), 2.5, 2.1)
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


def mantle_parts(k):
    """Mantling, whole: standing over what it has, wings raised and spread down round it."""
    return walker(0.1, "body", mantle=(0.3, 0.65, 1.0, 1.0)[k], head_kind="down" if k >= 2 else "side")


def soar_parts(k):
    """Soaring on a thermal: wings level and still, the primaries spread, tilting."""
    return turned(fly_parts(1), (-0.08, 0.08)[k], (20.0, 13.0))


def cartwheel_parts(k):
    """The courtship cartwheel: talons locked with its mate, it turns over
    and over as the two fall."""
    return turned(fly_parts(2 if k else 0), (2.4, 3.6)[k], (20.0, 13.0))


def rig(pose, k=0, slot="body"):
    legs_at = "hind" if slot == "hind" else "body"
    if slot == "body":
        return body_part("stand" if pose == "ritual" else pose, k), (3.2 if pose == "rest" else 0.0)
    if pose == "ritual":
        return walker(0.1, legs_at, mantle=0.2 * k, up=1.0 + 0.4 * k), 0.0
    if pose == "act" and slot != "body":
        return walker(0.1, legs_at, mantle=(0.3, 0.65, 1.0, 1.0)[k], head_kind="down" if k >= 2 else "side"), 0.0
    if slot == "body":
        return body_part(pose, k), (3.2 if pose == "rest" else 0.0)
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


def finish_chimera(rows):
    """In a chimera, drawn at half as many cells again, the key plate is
    laid off register up and to the left, over the chalk edge, so the
    yellow line runs along the lit side of every shape a cell off it."""
    h, w = len(rows), len(rows[0])
    solid = [[ch not in ".op" for ch in r] for r in rows]
    out = [list(r) for r in rows]
    for j in range(h):
        for i in range(w):
            if not solid[j][i]:
                continue
            edge = any(not (0 <= i + a < w and 0 <= j + b < h and solid[j + b][i + a])
                       for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if not edge:
                continue
            ti, tj = i - 1, j - 1
            if 0 <= ti < w and 0 <= tj < h and rows[tj][ti] in ".op":
                out[tj][ti] = "y"
    return ["".join(r) for r in out]


INKS = {"coat": ["#3a2a2d", "#523d41", "#6e5552", "#a0918a"], "white": ["#c9c0ad", "#ece6d4"],
        "black": ["#241a1c", "#523d41"], "eye": "#e1c31d", "pen": ["#8a7a74", "#b3a69c"], "box": "#e1c31d"}
