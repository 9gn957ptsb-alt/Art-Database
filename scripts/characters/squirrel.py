"""The red squirrel (Sciurus vulgaris), side on, facing right — after Henri Matisse.

DIRT's backlog paired Matisse with the grey squirrel; the red is the one of
his own country (DIRT's grammar: Palearctic broadleaf and conifer crowns,
"red squirrels"), and the one that crosses the crowns of the Nord, where he
was born. Matisse cut his late pictures out of painted paper (Jazz, 1947;
the Oceania panels, 1946): flat shapes, one colour each, laid edge to edge
with the ground showing between them. DIRT's roster gives him grammar 9, cut
shapes. So the squirrel is cut, not drawn: no outline, no shading, each part
one flat ink, and where one piece lies over another a gap of the ground
between them, as between two pieces of paper (raster's deep step is the
ground itself). His inks from the roster: the yellow of his saved works,
the same yellow worked toward the dark for the coat, their cream for the
belly, their dark for the ear tufts and the eye.

As a red squirrel is made: a small rounded body, a big bushy tail held up in
an S over the back, tufted ears, a white belly, long hind feet. It bounds
(four frames of the half-bound: gathered, pushing off, stretched in the air,
landing on the forefeet), sits up on its haunches to look, turns to you,
and sits with its tail curled up its back and its paws at its mouth.

Letters: R the coat; r the tail; w the belly; k the tufts, the eye and the
claws.
"""

import math

from draw import Part, capsule, ellipse, limb, path, raster, triangle, union, unline

W, H = 40, 26
GROUND = 24.6
CELL = 2

COAT = lambda *a: "R"
TAIL = lambda *a: "r"
BELLY = lambda *a: "w"
DARK = lambda *a: "k"


def head(cx, cy, front=False):
    g = 5 if WHOLE else 3          # the whole animal's head is a paper laid over the body's: a gap of ground round it
    if front:
        skull = ellipse(cx, cy, 3.3, 2.9)
        ears = union(triangle((cx - 3.3, cy - 0.5), (cx - 0.9, cy - 2.3), (cx - 3.1, cy - 5.6)),
                     triangle((cx + 0.9, cy - 2.3), (cx + 3.3, cy - 0.5), (cx + 3.1, cy - 5.6)))
        eyes = union(ellipse(cx - 1.7, cy - 0.5, 0.65, 0.65), ellipse(cx + 1.7, cy - 0.5, 0.65, 0.65))       # on cell centres
        return [Part(ears, lambda x, y, l, i, j: "k" if y < cy - 4.1 else "R", g - 1 if WHOLE else 3), Part(skull, COAT, g),
                Part(clip(skull, ellipse(cx, cy + 1.8, 1.9, 1.2)), BELLY, 7),
                Part(eyes, DARK, 8), Part(ellipse(cx, cy + 0.9, 0.55, 0.5), DARK, 8)]
    skull = union(ellipse(cx, cy, 2.9, 2.6), ellipse(cx + 2.0, cy + 0.7, 1.6, 1.4))
    ear = triangle((cx - 3.0, cy - 0.8), (cx + 1.0, cy - 1.9), (cx - 1.0, cy - 5.0))

    def paint(x, y, light, i, j):
        return "k" if y < cy - 4.2 else "R"
    if HEAD:
        # A chimera's head is seen on its own: the red squirrel's own marks,
        # cut as Matisse cut them — the ear's long dark tuft, a cream ring
        # round the eye, the cream of the chin, the nose a dark spot.
        tuft = union(ear, triangle((cx - 2.1, cy - 3.9), (cx + 0.1, cy - 4.5), (cx - 1.7, cy - 7.4)))
        ring = [] if WHOLE else [Part(ellipse(cx + 1.0, cy - 0.5, 1.0, 0.95), BELLY, 7)]     # at a cell of two pixels the ring is a white dot
        return [Part(union(tuft, skull), lambda x, y, l, i, j: "k" if y < cy - 4.3 else "R", g),
                Part(clip(skull, ellipse(cx + 2.4, cy + 1.7, 1.7, 1.0)), BELLY, 6 if not WHOLE else 7)] + ring + [
                Part(ellipse(cx + 1.1, cy - 0.5, 0.6, 0.62), DARK, 8),
                Part(ellipse(cx + 3.5, cy + 0.5, 0.45, 0.4), DARK, 8)]
    return [Part(union(ear, skull), paint, g), Part(ellipse(cx + 1.0, cy - 0.4, 0.55, 0.55), DARK, 8)]


HEAD = False          # drawing a chimera's head (rig, slot "head")
WHOLE = False         # drawing the whole animal's poses (its face is the chimera's head's, less the eye-ring)


def clip(a, b):
    """Where both fields are inside: a paper cut to lie inside another."""
    return lambda x, y: max(a(x, y), b(x, y))


def frond(points, widths, lobe=3.3, amp=0.5):
    """A cut-paper plume: a ribbon along `points` whose half-width goes through `widths`, its two edges scalloped
    every `lobe` cells (the lobed fronds of Matisse's Oceania, the Sea)."""
    segs = list(zip(points[:-1], points[1:]))
    lens = [math.dist(a, b) for a, b in segs]

    def d(x, y):
        best, at, run = 1e9, 0.0, 0.0
        for (a, b), L, wa, wb in zip(segs, lens, widths[:-1], widths[1:]):
            vx, vy = b[0] - a[0], b[1] - a[1]
            t = max(0.0, min(1.0, ((x - a[0]) * vx + (y - a[1]) * vy) / (L * L or 1.0)))
            px, py = a[0] + vx * t, a[1] + vy * t
            dd = math.hypot(x - px, y - py) - (wa + (wb - wa) * t)
            if dd < best:
                best, at = dd, run + L * t
            run += L
        return best + amp * math.sin(at * 6.2832 / lobe)
    return d


INNER = lambda *a: "R"


def tail(points, r0=1.7, r1=2.5):
    """The tail: a broad plume, narrow at the root, fullest toward the tip, in yellow paper with a narrower orange
    one laid along it."""
    n = len(points)
    prof = [1.9, 2.7, 3.2, 2.4, 1.6][:n] if n < 5 else [1.9, 2.5, 3.1, 3.0, 1.8]
    prof = [prof[min(i, len(prof) - 1)] for i in range(n)]
    outer = Part(frond(points, prof), TAIL, 1)
    inner = Part(frond(points[1:], [w * 0.38 for w in prof[1:]], lobe=2.6, amp=0.25), INNER, 1)
    return [outer, inner]


def bound_parts(k):
    """The half-bound: 0 gathered, 1 pushing off, 2 stretched, 3 landing."""
    if k == 0:
        bd = [Part(union(ellipse(19.0, 18.4, 4.6, 3.8), ellipse(22.6, 18.0, 2.6, 2.6)), COAT, 3)]
        hind = [Part(ellipse(17.0, 20.2, 3.0, 2.8), COAT, 3), Part(capsule((17.6, 23.4), (22.0, 24.0), 0.8, 0.6), COAT, 3)]
        fore = [Part(capsule((23.0, 20.0), (22.4, 24.0), 0.7, 0.6), COAT, 3)]
        t = tail([(15.4, 18.4), (10.4, 15.6), (10.0, 10.2), (12.6, 6.8), (14.4, 7.4)])
        h = head(25.6, 15.8)
    elif k == 1:
        bd = [Part(union(ellipse(20.0, 16.8, 5.6, 3.2, -0.25), ellipse(24.4, 15.2, 2.4, 2.2)), COAT, 3)]
        hind = [Part(ellipse(16.4, 18.4, 2.8, 2.6), COAT, 3), Part(capsule((15.4, 20.2), (11.8, 24.0), 0.9, 0.6), COAT, 3)]
        fore = [Part(capsule((25.0, 17.0), (28.6, 16.0), 0.7, 0.5), COAT, 3)]
        t = tail([(14.4, 16.0), (9.6, 15.2), (6.6, 11.8), (7.6, 8.2)])
        h = head(27.4, 13.0)
    elif k == 2:
        bd = [Part(union(ellipse(20.0, 15.4, 6.2, 2.8, -0.08), ellipse(25.0, 14.6, 2.4, 2.2)), COAT, 3)]
        hind = [Part(ellipse(15.6, 16.2, 2.6, 2.4), COAT, 3), Part(capsule((14.4, 17.4), (9.8, 19.2), 0.8, 0.6), COAT, 3)]
        fore = [Part(capsule((25.6, 16.0), (29.6, 18.4), 0.7, 0.5), COAT, 3)]
        t = tail([(13.6, 14.4), (8.4, 13.8), (5.0, 11.6), (4.2, 8.4)])
        h = head(28.0, 12.6)
    else:
        bd = [Part(union(ellipse(20.4, 16.6, 5.4, 3.2, 0.3), ellipse(24.6, 18.6, 2.4, 2.4)), COAT, 3)]
        hind = [Part(ellipse(16.0, 15.6, 2.6, 2.4), COAT, 3), Part(capsule((15.4, 16.6), (12.6, 18.4), 0.8, 0.6), COAT, 3)]
        fore = [Part(capsule((25.4, 20.0), (26.2, 24.0), 0.7, 0.6), COAT, 3)]
        t = tail([(14.0, 14.6), (10.0, 12.6), (9.0, 8.4), (11.6, 5.6)])
        h = head(27.2, 15.6)
    # the cream underside, one paper laid along the lower edge of the body, from the chest to the haunch
    under = {0: (20.6, 22.0, 4.0, 1.9, 0.0), 1: (20.6, 19.7, 4.8, 1.7, -0.25), 2: (20.6, 18.0, 5.4, 1.5, -0.08),
             3: (20.8, 19.6, 4.6, 1.7, 0.3)}[k]
    belly = Part(clip(bd[0].sdf, ellipse(*under)), BELLY, 3.5)
    limb(fore, "body"), limb(hind[1:], "hind")
    return t + fore + bd + [belly] + hind + h


def bound(k):
    return unline(raster(bound_parts(k), W, H, deep="."))


def upright(front=False, eating=False):
    """Sitting up on its haunches: a pear, the haunch fat and low, the chest and back narrowing to a head held up, the
    long hind feet flat on the ground in front of it, the paws up at the chest (at its mouth, eating); the tail
    curled up its back in an S. Front on, the same pear seen square, a foot out each side."""
    if front:
        body = union(ellipse(22.0, 18.6, 3.5, 5.0), ellipse(22.0, 21.8, 4.9, 2.9))
        belly = clip(body, ellipse(22.0, 19.2, 2.0, 4.6))
        feet = [Part(capsule((17.2, GROUND - 0.5), (19.6, GROUND - 0.5), 0.8, 0.8), COAT, 3),
                Part(capsule((24.4, GROUND - 0.5), (26.8, GROUND - 0.5), 0.8, 0.8), COAT, 3)]
        paws = [Part(capsule((20.6, 16.4), (21.4, 14.2), 0.65, 0.6), COAT, 5), Part(capsule((23.4, 16.4), (22.6, 14.2), 0.65, 0.6), COAT, 5)]
        t = tail([(18.6, 23.0), (14.2, 19.8), (13.2, 13.4), (16.0, 8.6)])
        parts = t + [Part(body, COAT, 3), Part(belly, BELLY, 4)] + feet + paws + head(22.0, 11.0, front=True)
        return unline(raster(parts, W, H, deep="."))
    haunch = ellipse(18.4, 20.8, 4.7, 3.9)
    back = capsule((19.4, 19.0), (21.6, 12.8), 3.3, 2.6)
    chest = ellipse(22.2, 16.8, 2.6, 3.6)
    body = union(haunch, back, chest)
    belly = clip(body, ellipse(24.2, 17.8, 1.9, 4.2, 0.2))              # the cream down the front, cut to the body's edge
    foot = capsule((17.4, GROUND - 0.6), (24.8, GROUND - 0.5), 0.85, 0.7)
    if eating:
        t = tail([(16.4, 23.0), (12.8, 19.4), (12.8, 12.8), (16.2, 8.2), (19.4, 9.4)])
        paws = capsule((22.8, 15.4), (24.8, 12.4), 0.7, 0.6)
        food = Part(ellipse(25.6, 12.0, 1.1, 1.0), DARK, 9)             # a nut, held to the mouth
    else:
        t = tail([(16.4, 23.0), (12.4, 19.6), (11.8, 13.4), (14.4, 8.8)])
        paws = capsule((23.0, 15.6), (24.6, 14.0), 0.7, 0.6)
        food = None
    parts = t + [Part(body, COAT, 3), Part(belly, BELLY, 4), Part(foot, COAT, 3), Part(paws, COAT, 5)]
    parts += head(23.0, 10.6)
    if food:
        parts.append(food)
    return unline(raster(parts, W, H, deep="."))


def stand_parts(cy=15.4, flick=False, front=False, cx=25.8):
    bd = [Part(union(ellipse(19.6, 18.6, 4.8, 3.4), ellipse(23.0, 18.0, 2.4, 2.6)), COAT, 3)]
    hind = [Part(ellipse(17.0, 20.0, 2.8, 2.6), COAT, 3), Part(capsule((17.2, 23.6), (21.0, 24.0), 0.8, 0.6), COAT, 3)]
    fore = [Part(capsule((23.6, 20.2), (24.0, 24.0), 0.7, 0.6), COAT, 3)]
    if flick:
        t = tail([(14.8, 18.8), (10.2, 16.6), (9.2, 11.2), (11.4, 7.0)])
    else:
        t = tail([(15.4, 18.8), (10.8, 16.0), (10.0, 10.6), (12.6, 6.6), (14.6, 7.2)])
    limb(fore, "body"), limb(hind[1:], "hind")
    return t + fore + bd + [Part(clip(bd[0].sdf, ellipse(20.6, 22.0, 4.2, 1.7)), BELLY, 3.5)] + hind + head(cx, cy, front=front)


def stand():
    return unline(raster(stand_parts(), W, H, deep="."))


def poses():
    global HEAD, WHOLE
    HEAD = WHOLE = True  # the whole animal wears the face a chimera's head has: the tufted ear, the chin, the eye
    try:
        return {
            "trot": [bound(k) for k in range(4)],
            "stand": [stand()],
            "back": [upright()],
            "look": [upright(front=True)],
            "sit": [upright(eating=True)],
            # The ethogram (characters.json): its instinct and its play (the tail flicked).
            "act": [unline(raster(bury_parts(k), W, H, deep=".")) for k in range(4)],
            "play": [unline(raster(stand_parts(flick=bool(k)), W, H, deep=".")) for k in range(2)],
        }
    finally:
        HEAD = WHOLE = False


# ---- in three parts, for a chimera (scripts/characters/chimera.py) ---------------

SEAMS = {"neck": (22.8, 18.0), "hip": (17.4, 18.6)}
CHIMERA_SCALE = 1.45
CHIMERA_SLOT_K = {"hind": 0.78, "head": 0.9}   # its tail, as a chimera's hindquarters, is not to outweigh the rest; its head, grown to meet the marks, is a size under
DEEP = "."


def finish(rows):
    return unline(rows)


def bury_parts(k):
    """Scatter-hoarding: a nut in its mouth, it digs, pushes the nut in with
    its nose, and pats the earth down over it."""
    if k == 0:
        parts = stand_parts(cy=15.0)
        parts.append(Part(ellipse(28.6, 16.4, 1.0, 0.9), lambda *a: "k", 9))
        return parts
    bd = [Part(union(ellipse(19.6, 19.8, 4.8, 3.2, 0.25), ellipse(23.2, 20.6, 2.4, 2.4)), COAT, 3)]
    hind = [Part(ellipse(17.0, 20.4, 2.8, 2.6), COAT, 3), Part(capsule((17.2, 23.6), (21.0, 24.0), 0.8, 0.6), COAT, 3)]
    reach = (0, (25.2, 24.2), (24.4, 23.6), (25.6, 23.8))[k]
    fore = [Part(capsule((23.6, 21.2), reach, 0.7, 0.6), COAT, 3)]
    t = tail([(14.8, 19.4), (10.6, 16.6), (10.4, 11.4), (13.8, 8.0 + (0.6 if k == 3 else 0))])
    limb(fore, "body"), limb(hind[1:], "hind")
    parts = t + fore + bd + hind + head(26.4, 21.4 + (0.6 if k == 2 else 0))
    if k == 1:
        parts.append(Part(ellipse(27.6, 24.2, 1.6, 0.5), lambda *a: "k", 9))       # the earth thrown up
    return parts


def rig(pose, k=0, slot="body"):
    global HEAD
    HEAD = slot == "head"
    try:
        parts, drop = rig_(pose, k)
    finally:
        HEAD = False
    if slot == "body":
        # Cut out of the body, the cream belly reads as a face: the body is all
        # coat, in two papers, the darker laid over the back as Matisse laid
        # one cut colour on another, so the body has a top and a side.
        parts = [p for p in parts if p.paint is not BELLY]
        trunk = [p for p in parts if p.paint is COAT and getattr(p, "limb", None) is None]
        if trunk:
            body = trunk[0]
            back = Part(lambda x, y, b=body.sdf: max(b(x, y), y - (16.6 if pose != "rest" else 17.6) - 0.35 * math.sin(x * 0.9)),
                        lambda *a: "d", body.group + 0.5)
            parts.append(back)
    return parts, drop


def rig_(pose, k=0):
    if pose == "act":
        return bury_parts(k), 0.0
    if pose == "ritual":
        return stand_parts(flick=k == 1, cy=14.6), 0.0
    if pose == "walk":
        return bound_parts((0, 1, 1, 2, 3, 3)[k]), 0.0
    if pose == "stand":
        return stand_parts(flick=k == 2, cy=(15.4, 15.0, 15.4)[k]), 0.0
    if pose == "back":
        return stand_parts(cy=13.8, cx=26.2), 0.0
    if pose == "look":
        return stand_parts(front=True, cx=25.4, cy=14.8), 0.0
    if pose == "rest":
        return bound_parts(0), 0.0
    return stand_parts(cy=13.4, cx=26.4, flick=True), 0.0


INKS = {"coat": ["#a5641e", "#c7792a", "#eec027", "#eec027"], "white": ["#e5ddc9", "#e5ddc9"],
        "black": ["#3f3134", "#51414a"], "eye": "#3f3134", "pen": ["#e5ddc9", "#e5ddc9"], "box": "#eec027"}
