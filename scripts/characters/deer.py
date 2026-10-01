"""The red deer (Cervus elaphus), a stag, side on, facing right — after David Hockney.

Hockney went home to the Yorkshire Wolds to paint them (Woldgate Woods,
2006; the iPad drawings of the East Riding, 2008-11): the lanes and the
edges of woods where deer come out, drawn in a bent net of strokes, every
field crossed by lines that follow it. DIRT's roster gives him grammar 3, a
net: moderate, even structure, the cells bent, never a grid. So the coat is
crossed by a bent net of its darker step (net in draw.py's terms: the cells
on two families of wavering lines). His inks from the roster: the red of
his saved works worked into their olive dark for the coat, their pale for
the rump patch and the antlers' tips, their olive for the hooves, the eye
and the line.

As a red deer stag is made: long legs, a deep chest, a thick neck with a
mane in the autumn, a pale rump patch with a short tail, a long head with
big ears, branching antlers (brow, bez and trez tines, the beam sweeping
back). It trots (diagonal pairs, as a deer covers ground at the edge of a
wood), stops and looks back, turns its head to you, and lies down, legs
folded, head up.

Letters: d R r g the coat, deepest to lightest; W w the rump and the
antlers' pale; k K the hooves, the muzzle, the dark of the mane; y the eye;
o p the outline.
"""

import math

from draw import Part, capsule, ellipse, foot_at, limb, path, ramp, raster, triangle, two_bone, union

W, H = 40, 26
GROUND = 24.6
CELL = 2

BASE = ramp("Rrg")
FAR_COAT = ramp("dR")


def net(steps):
    """A coat crossed by a bent net: two families of wavering lines, about
    three cells apart, where the coat takes its darker step."""
    def paint(x, y, light, i, j):
        a = (x + 1.6 * math.sin(y * 0.55)) / 4.2
        b = (y + 0.9 * x + 1.3 * math.sin(x * 0.42)) / 4.6
        on = abs(a - round(a)) < 0.12 or abs(b - round(b)) < 0.1
        ch = steps(x, y, light, i, j)
        if on:
            return {"g": "r", "r": "R", "R": "d"}.get(ch, ch)
        return ch
    return paint


COAT = net(BASE)
MANE = net(ramp("dR"))


def leg(joint, foot, l1, l2, bend, r0, r1, paint, group):
    knee = two_bone(joint, foot, l1, l2, bend)
    sdf = union(capsule(joint, knee, r0, (r0 + r1) / 2), capsule(knee, foot, (r0 + r1) / 2 * 0.7, r1))
    return [Part(sdf, paint, group), Part(ellipse(foot[0] + 0.3, foot[1] - 0.2, 0.7, 0.5), lambda *a: "k", group)]


SHOULDER = (24.4, 15.2)
HIP = (13.6, 14.8)


def legs(phases, dy=0.0, reach=2.6, lift=2.0):
    ff, fh, nf, nh = phases
    sh, hp = (SHOULDER[0], SHOULDER[1] + dy), (HIP[0], HIP[1] + dy)
    far = (leg((sh[0] + 0.8, sh[1]), foot_at(ff, sh[0] + 0.8, reach, lift, GROUND), 4.6, 5.0, 1, 1.0, 0.5, FAR_COAT, 0) +
           leg((hp[0] + 0.8, hp[1]), foot_at(fh, hp[0] + 0.8, reach, lift, GROUND), 4.6, 5.4, -1, 1.4, 0.5, FAR_COAT, 0))
    near = (leg(hp, foot_at(nh, hp[0], reach, lift, GROUND), 4.6, 5.4, -1, 1.8, 0.55, COAT, 7) +
            leg(sh, foot_at(nf, sh[0], reach, lift, GROUND), 4.6, 5.0, 1, 1.4, 0.55, COAT, 7))
    limb(far[:2], "body"), limb(far[2:], "hind"), limb(near[:2], "hind"), limb(near[2:], "body")
    return far, near


def body(dy=0.0):
    torso = union(ellipse(18.8, 12.6 + dy, 8.0, 4.0), ellipse(24.6, 12.8 + dy, 3.4, 4.0))

    def paint(x, y, light, i, j):
        if x < 13.2 and y < 13.8 + dy:
            return "W" if light < 0.62 else "w"          # the rump patch
        return COAT(x, y, light, i, j)
    tail = capsule((10.8, 10.8 + dy), (10.2, 13.0 + dy), 0.7, 0.5)
    return [Part(tail, lambda *a: "W", 1), Part(torso, paint, 2)]


def antlers(cx, cy, f=1):
    """The beam sweeping back and up from the skull, with brow, bez and trez
    tines forward, and a crown at the top."""
    beam = path([(cx, cy), (cx - f * 1.2, cy - 2.2), (cx - f * 1.9, cy - 4.2), (cx - f * 1.4, cy - 5.8)], 0.5, 0.35)
    tines = union(capsule((cx - f * 0.3, cy - 0.6), (cx + f * 1.6, cy - 1.2), 0.4, 0.3),
                  capsule((cx - f * 0.9, cy - 1.8), (cx + f * 0.9, cy - 2.6), 0.35, 0.3),
                  capsule((cx - f * 1.7, cy - 3.4), (cx - f * 0.2, cy - 4.0), 0.35, 0.3),
                  capsule((cx - f * 1.5, cy - 5.4), (cx - f * 2.7, cy - 6.6), 0.35, 0.3))
    return union(beam, tines)


def antler_paint(x, y, light, i, j):
    return "w" if y < 4.4 else "W"


def head_side(cx, cy, f=1, dy=0.0):
    cy += dy
    skull = union(ellipse(cx, cy, 2.0, 1.7), capsule((cx + f * 0.8, cy + 0.4), (cx + f * 3.6, cy + 1.6), 1.2, 0.8))

    def paint(x, y, light, i, j):
        if math.hypot(x - (cx + f * 3.4), y - (cy + 1.5)) < 0.8:
            return "k"
        return BASE(x, y, light, i, j)
    ear = triangle((cx - f * 1.2, cy - 0.6), (cx - f * 0.2, cy - 1.2), (cx - f * 2.8, cy - 2.6))
    return [Part(antlers(cx - f * 0.2, cy - 1.4, f), antler_paint, 3), Part(ear, BASE, 4), Part(skull, paint, 5),
            Part(ellipse(cx + f * 0.8, cy - 0.3, 0.45, 0.4), lambda *a: "y", 6)]


def head_front(cx, cy):
    skull = union(ellipse(cx, cy, 1.9, 2.0), ellipse(cx, cy + 2.0, 1.2, 1.3))
    ears = union(triangle((cx - 1.6, cy - 0.6), (cx - 1.0, cy - 1.6), (cx - 4.0, cy - 1.4)),
                 triangle((cx + 1.6, cy - 0.6), (cx + 1.0, cy - 1.6), (cx + 4.0, cy - 1.4)))
    ant = union(antlers(cx - 0.8, cy - 1.6, 1), antlers(cx + 0.8, cy - 1.6, -1))
    eyes = union(ellipse(cx - 1.0, cy - 0.2, 0.4, 0.4), ellipse(cx + 1.0, cy - 0.2, 0.4, 0.4))
    return [Part(ant, antler_paint, 3), Part(ears, BASE, 4), Part(skull, BASE, 5),
            Part(ellipse(cx, cy + 2.6, 0.7, 0.5), lambda *a: "k", 6), Part(eyes, lambda *a: "y", 6)]


def neck(a, b, dy=0.0):
    return Part(capsule((a[0], a[1] + dy), (b[0], b[1] + dy), 2.4, 1.6), MANE, 3)


def trot_parts(p, phases=None, up=None):
    up = (p in (0.25, 0.75)) if up is None else up
    dy = -0.5 if up else 0.0
    far, near = legs(phases or (p + 0.5, p, p, p + 0.5), dy)
    return far + body(dy) + [neck((25.6, 11.6), (28.8, 8.6), dy)] + head_side(30.0, 7.8, dy=dy) + near


def trot(p):
    return raster(trot_parts(p), W, H)


def stand_parts(head="side"):
    far, near = legs((0.1, 0.6, 0.6, 0.1), 0.0, reach=1.0)
    parts = far + body()
    if head == "side":
        parts += [neck((25.6, 11.6), (28.4, 8.2))] + head_side(29.6, 7.4)
    elif head == "up":
        parts += [neck((25.6, 11.6), (28.8, 7.0))] + head_side(30.2, 5.8)
    elif head == "down":
        parts += [neck((25.6, 11.6), (29.0, 11.8))] + head_side(30.4, 12.6)
    elif head == "back":
        parts += [neck((25.0, 11.6), (24.4, 8.2))] + head_side(23.2, 7.4, f=-1)
    else:
        parts += [neck((25.6, 11.6), (27.4, 8.6))] + head_front(27.8, 7.6)
    return parts + near


def stand(head="side"):
    return raster(stand_parts(head), W, H)


def lie_parts():
    dy = 7.2
    parts = [Part(capsule((11.6, GROUND - 0.8), (18.0, GROUND - 0.6), 1.0, 0.7), FAR_COAT, 0)]
    parts += body(dy)
    parts.append(Part(capsule((22.0, GROUND - 0.7), (28.0, GROUND - 0.7), 1.0, 0.7), COAT, 6))
    parts.append(Part(ellipse(28.4, GROUND - 0.6, 0.7, 0.5), lambda *a: "k", 6))
    parts += [neck((24.6, 18.4), (26.2, 13.6))] + head_front(26.6, 12.4)
    return parts


def lie():
    return raster(lie_parts(), W, H)


def poses():
    return {
        "trot": [trot(p) for p in (0.0, 0.25, 0.5, 0.75)],
        "stand": [stand("side")],
        "back": [stand("back")],
        "look": [stand("front")],
        "sit": [lie()],
    }


# ---- in three parts, for a chimera (scripts/characters/chimera.py) ---------------

SEAMS = {"neck": (27.4, 11.0), "hip": (17.4, 12.6)}
CHIMERA_SCALE = 1.0


def rig(pose, k=0):
    if pose == "walk":
        p = k / 6.0
        return trot_parts(p, (p + 0.75, p + 0.5, p + 0.25, p), up=k in (1, 4)), 0.0
    if pose == "stand":
        return stand_parts(("side", "side", "up")[k]), 0.0
    if pose == "back":
        return stand_parts("down"), 0.0
    if pose == "look":
        return stand_parts("front"), 0.0
    if pose == "rest":
        return lie_parts(), 7.2
    return stand_parts("up"), 0.0


INKS = {"coat": ["#4e2a1c", "#7d3622", "#a8452c", "#c56a48"], "white": ["#979580", "#d5d4cb"],
        "black": ["#45432f", "#5d5b42"], "eye": "#d5d4cb", "pen": ["#979580", "#45432f"], "box": "#eb1d14"}
