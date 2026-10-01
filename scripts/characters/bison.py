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

from draw import Part, capsule, ellipse, foot_at, path, raster, strokes, triangle, two_bone, union

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


def head_side(cx, cy, down=0.0):
    """The head side on, low, the beard under it; `down` lowers it to graze."""
    cy += down
    skull = union(ellipse(cx, cy, 3.6, 3.8, 0.4), ellipse(cx + 2.4, cy + 2.8, 2.1, 1.8))
    beard = triangle((cx - 1.6, cy + 2.0), (cx + 2.2, cy + 2.6), (cx - 0.4, cy + 6.2))
    horn = path([(cx - 0.6, cy - 2.6), (cx - 0.2, cy - 4.4), (cx + 1.0, cy - 5.0)], 0.6, 0.3)

    def paint(x, y, light, i, j):
        if math.hypot(x - (cx + 3.8), y - (cy + 2.6)) < 0.9:
            return "W"                       # the muzzle, pale
        return WOOL(x, y, light, i, j)
    return [Part(beard, WOOL, 4), Part(skull, paint, 5), Part(horn, lambda x, y, l, i, j: "w" if l > 0.7 else "k", 6),
            Part(ellipse(cx + 1.0, cy + 0.2, 0.55, 0.45), lambda *a: "y", 7)]


def head_front(cx, cy):
    skull = ellipse(cx, cy, 3.4, 3.8)
    beard = triangle((cx - 2.0, cy + 2.0), (cx + 2.0, cy + 2.0), (cx, cy + 6.6))
    horns = union(path([(cx - 2.8, cy - 1.8), (cx - 4.4, cy - 2.6), (cx - 4.2, cy - 4.6)], 0.6, 0.3),
                  path([(cx + 2.8, cy - 1.8), (cx + 4.4, cy - 2.6), (cx + 4.2, cy - 4.6)], 0.6, 0.3))
    eyes = union(ellipse(cx - 1.6, cy - 0.2, 0.5, 0.45), ellipse(cx + 1.6, cy - 0.2, 0.5, 0.45))
    muzzle = ellipse(cx, cy + 2.4, 1.4, 1.0)
    return [Part(horns, lambda x, y, l, i, j: "w" if l > 0.7 else "k", 4), Part(beard, WOOL, 4),
            Part(skull, WOOL, 5), Part(muzzle, lambda *a: "W", 6), Part(eyes, lambda *a: "y", 7)]


def walk(p):
    dy = -0.4 if p in (0.25, 0.75) else 0.0
    far, near = legs((p + 0.75, p + 0.5, p + 0.25, p), dy)
    parts = far + body(dy, tail=0.3 if p in (0.25, 0.75) else 0.0) + head_side(32.8, 17.0 + dy) + near
    return raster(parts, W, H)


def stand(head="side"):
    far, near = legs((0.15, 0.62, 0.62, 0.15), 0.0, reach=1.0)
    parts = far + body()
    if head == "side":
        parts += head_side(32.8, 16.8)
    elif head == "graze":
        parts += head_side(32.4, 16.8, down=3.2)
    else:
        parts += head_front(32.0, 15.2)
    parts += near
    return raster(parts, W, H)


def lie():
    """Lying down, legs folded under, the head up and turned to you."""
    dy = 4.6
    parts = [Part(capsule((10.0, GROUND - 1.0), (16.0, GROUND - 0.6), 1.0, 0.8), FAR_COAT, 0)]
    parts += body(dy, tail=-1.6)
    parts.append(Part(capsule((24.0, GROUND - 0.8), (30.4, GROUND - 0.8), 1.3, 1.0), WOOL, 6))
    parts.append(Part(ellipse(31.0, GROUND - 0.6, 0.9, 0.6), lambda *a: "k", 6))
    parts += head_front(31.6, 15.6)
    return raster(parts, W, H)


def poses():
    return {
        "trot": [walk(p) for p in (0.0, 0.25, 0.5, 0.75)],
        "stand": [stand("side")],
        "back": [stand("graze")],
        "look": [stand("front")],
        "sit": [lie()],
    }


INKS = {"coat": ["#5a2c10", "#8a4216", "#b15519", "#c98b5c"], "white": ["#9e8880", "#cdc5b4"],
        "black": ["#2b211b", "#4f4036"], "eye": "#e2c9a0", "pen": ["#9e8880", "#5a2c10"], "box": "#b15519"}
