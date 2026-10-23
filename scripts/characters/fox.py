"""The red fox (Vulpes vulpes), side on, facing right.

Its parts as a red fox is made: a long low body, a deep chest; a long narrow
muzzle; tall pointed ears, black behind; the throat, cheeks and chest bib
white; black stockings up the legs; a brush about two thirds the body's
length, held out level as it trots, with a white tip. It trots in diagonal
pairs, the near fore with the far hind and the far fore with the near hind,
the way a fox covers ground; between the beats it is in the air for a
moment. A trotting fox carries its head low and its brush level.

Letters: d R r g the coat, deepest to lightest; W w the white; k K the black
(K the lit side of it); y the eye; o p the outline, dark and light.
"""

import json
import math
import os

from draw import Part, bayer, capsule, ellipse, limb, path, ramp, raster, triangle, turned, two_bone, union

W, H = 40, 26
GROUND = 24.6                  # the soles stand on this line
CELL = 2                       # CSS pixels a cell, on the page

def blocks(steps):
    """A ramp dithered in blocks of two cells, not one: soft patches of the coat, as the fox the page draws has, not
    a speckle of single cells (and the dark steps lie in clumps, as the graphic's do)."""
    def paint(x, y, light, i, j):
        n = len(steps)
        v = light * n - 0.5
        k = int(math.floor(v))
        if v - k > bayer(i // 2, j // 2):
            k += 1
        return steps[max(0, min(n - 1, k))]
    return paint


COAT = blocks("Rrg")
COAT_SOFT = blocks("Rrg")
WHITE = ramp("Ww")
BLACK = ramp("kK")
FAR_COAT = ramp("dR")
FAR_BLACK = ramp("k")


def coat_with_white(white_below):
    """The coat, white where `white_below(x, y)` says so (the bib, the throat)."""
    def paint(x, y, light, i, j):
        if white_below(x, y):
            return WHITE(x, y, light, i, j)
        if y < 12.9:
            return "R" if light < 0.8 else COAT(x, y, light, i, j)       # the saddle: the back a step deeper than the flank
        return COAT(x, y, light, i, j)
    return paint


def stocking(top, near=True):
    """A leg: coat above `top` (a y), black below."""
    def paint(x, y, light, i, j):
        if y < top:
            return (COAT if near else FAR_COAT)(x, y, light, i, j)
        return (BLACK if near else FAR_BLACK)(x, y, light, i, j)
    return paint


def leg(joint, foot, l1, l2, bend, r0, r1, near, group):
    knee = two_bone(joint, foot, l1, l2, bend)
    sdf = union(capsule(joint, knee, r0, (r0 + r1) / 2), capsule(knee, foot, (r0 + r1) / 2 * 0.8, r1))
    top = knee[1] - 1.7                  # the black stocking starts above the knee, at the elbow or the hock
    paw = ellipse(foot[0] + 0.5, foot[1] - 0.1, 1.1, 0.7)
    return [Part(sdf, stocking(top, near), group),
            Part(paw, BLACK if near else FAR_BLACK, group)]


def stride(phase, joint, reach, lift):
    """Where a foot is at a phase of the trot: on the ground going back for the
    first half, in the air coming forward for the second."""
    p = phase % 1.0
    if p < 0.5:
        x = joint[0] + reach * (1 - 4 * p)
        y = GROUND
    else:
        q = (p - 0.5) * 2
        x = joint[0] - reach + 2 * reach * q
        y = GROUND - lift * math.sin(math.pi * q)
    return (x, y)


def body_parts(dy=0.0, tail_lift=0.0, head=None):
    """The body, neck and brush; the head is passed in, since it turns."""
    parts = []
    # The brush, behind everything: level, a little down, white at the tip.
    # The brush is narrow where it leaves the rump, fullest a little past its middle, and
    # tapers to a point: not a bar of the body's own thickness.
    tail = [(12.8, 13.0 + dy), (9.4, 14.0 + dy - tail_lift * 0.4), (6.0, 14.9 + dy - tail_lift * 0.8), (3.0, 15.6 + dy - tail_lift), (0.8, 16.0 + dy - tail_lift)]
    tip = tail[-1]

    def tail_paint(x, y, light, i, j):
        # the white tip is the last quarter of the brush, a flame with a ragged edge, not a ball on its end
        if x < tip[0] + 3.6 + 0.7 * math.sin(y * 1.9):
            return WHITE(x, y, light, i, j)
        if y < 14.2 + dy - tail_lift * 0.5 and x < 9.0 and light < 0.55:
            return "R"                              # the dusky line of black-tipped guard hairs along the top
        return COAT_SOFT(x, y, light, i, j)
    # a brush is narrow where it leaves the rump, fullest at three fifths of its length, and tapers to its point
    parts.append(Part(union(path(tail[:2], 1.4, 2.7), path(tail[1:3], 2.7, 3.4), path(tail[2:4], 3.4, 2.4), path(tail[3:], 2.4, 0.6)), tail_paint, 1))
    # Haunch, barrel and chest, one long low body.
    # (The belly tucks up behind the ribs: a fox's chest is its deepest part.)
    torso = union(ellipse(18.6, 14.5 + dy, 8.4, 2.95),
                  ellipse(13.9, 14.3 + dy, 3.8, 3.4),
                  ellipse(24.2, 14.6 + dy, 3.6, 3.9, -0.2))
    parts.append(Part(torso, coat_with_white(lambda x, y: x > 25.4 and y > 14.0 + dy), 2))
    return parts


def head_profile(cx, cy, facing=1, ear=0.0):
    """The head side on: skull, long muzzle, two ears. facing 1 is right, -1 left;
    `ear` lays the near ear back by that many cells at its tip."""
    f = facing
    skull = ellipse(cx, cy, 3.0, 2.6)
    snout = capsule((cx + f * 1.6, cy + 0.7), (cx + f * 5.8, cy + 1.6), 1.7, 0.7)
    head = union(skull, snout)

    def paint(x, y, light, i, j):
        # The nose, black at the tip of the muzzle; the white under the jaw.
        if math.hypot(x - (cx + f * 5.6), y - (cy + 1.4)) < 0.8:
            return "k"
        if y > cy + 1.2 + 0.18 * (x - cx) * f:
            return WHITE(x, y, light, i, j)
        return COAT(x, y, light, i, j)
    near_ear = triangle((cx - f * 2.1, cy - 1.0), (cx + f * 0.5, cy - 2.0), (cx - f * (1.3 + ear), cy - 7.3 + ear * 0.5))
    far_ear = triangle((cx + f * 0.3, cy - 1.8), (cx + f * 2.3, cy - 1.0), (cx + f * 1.5, cy - 6.6))

    def ear_paint(x, y, light, i, j):
        return BLACK(x, y, light, i, j) if y < cy - 3.9 else COAT(x, y, light, i, j)

    def far_ear_paint(x, y, light, i, j):
        return "k" if y < cy - 3.7 else FAR_COAT(x, y, light, i, j)
    # The eye is amber, the colour of the coat's light step, so it is set in a dark rim (a fox's
    # eye is lined in black, the line running on toward the muzzle): without it, it vanished.
    rim = union(ellipse(cx + f * 1.7, cy - 0.1, 1.05, 0.8), capsule((cx + f * 2.2, cy + 0.15), (cx + f * 3.3, cy + 0.55), 0.35, 0.3))
    eye = ellipse(cx + f * 1.75, cy - 0.1, 0.55, 0.42)
    return [Part(far_ear, far_ear_paint, 3), Part(head, paint, 4),
            Part(near_ear, ear_paint, 5), Part(rim, lambda *a: "k", 6), Part(eye, lambda *a: "y", 7)]


def head_front(cx, cy):
    """The head turned to look out of the picture: two ears, two eyes, a white
    muzzle under a black nose."""
    skull = ellipse(cx, cy, 3.1, 2.7)

    def paint(x, y, light, i, j):
        if y > cy + 0.6 and abs(x - cx) > 0.9:
            return WHITE(x, y, light, i, j)       # the cheeks
        return COAT(x, y, light, i, j)
    left = triangle((cx - 3.0, cy - 0.9), (cx - 0.9, cy - 2.4), (cx - 2.7, cy - 6.4))
    right = triangle((cx + 0.9, cy - 2.4), (cx + 3.0, cy - 0.9), (cx + 2.7, cy - 6.4))

    def ear(x, y, light, i, j):
        return BLACK(x, y, light, i, j) if y < cy - 4.0 else COAT(x, y, light, i, j)
    muzzle = ellipse(cx, cy + 1.6, 1.5, 1.3)
    nose = ellipse(cx, cy + 1.1, 0.6, 0.45)
    eyes = union(ellipse(cx - 1.35, cy - 0.3, 0.5, 0.45), ellipse(cx + 1.35, cy - 0.3, 0.5, 0.45))
    return [Part(left, ear, 3), Part(right, ear, 3), Part(skull, paint, 4),
            Part(muzzle, WHITE, 5), Part(nose, lambda *a: "k", 6), Part(eyes, lambda *a: "y", 6)]


SHOULDER = (24.8, 15.8)
HIP = (14.6, 15.4)


def legs_at(phases, dy=0.0, reach=3.0, lift=2.2):
    """Four legs at the trot's phases (far fore, far hind, near fore, near hind)."""
    ff, fh, nf, nh = phases
    sh = (SHOULDER[0], SHOULDER[1] + dy)
    hp = (HIP[0], HIP[1] + dy)
    far = (leg((sh[0] + 1.0, sh[1]), stride(ff, (sh[0] + 1.0, 0), reach, lift), 4.4, 4.7, 1, 0.9, 0.6, False, 0) +
           leg((hp[0] + 1.0, hp[1]), stride(fh, (hp[0] + 1.0, 0), reach, lift), 4.4, 5.2, -1, 1.3, 0.6, False, 0))
    near = (leg(hp, stride(nh, hp, reach, lift), 4.4, 5.2, -1, 1.6, 0.65, True, 7) +
            leg(sh, stride(nf, sh, reach, lift), 4.4, 4.7, 1, 1.05, 0.65, True, 7))
    limb(far[:2], "body"), limb(far[2:], "hind"), limb(near[:2], "hind"), limb(near[2:], "body")
    return far, near


def neck(a, b):
    ax, ay = a
    bx, by = b

    def paint(x, y, light, i, j):
        # The throat is white on the underside, from the chin down to the chest's bib: seen
        # side on it was coat all the way, and the white stopped at the jaw.
        if bx - ax > 1.5:
            t = max(0.0, min(1.0, (x - ax) / (bx - ax)))
            if t > 0.2 and y > ay + (by - ay) * t + 0.6:
                return WHITE(x, y, light, i, j)
        elif x > ax + 1.0 and y > min(ay, by) + 1.5:
            return WHITE(x, y, light, i, j)
        return COAT(x, y, light, i, j)
    return Part(capsule(a, b, 2.3, 1.9), paint, 3)


def trot_parts(p, phases=None, up=None):
    """One of the frames of the trot, as parts (a walk, given its phases)."""
    up = (p in (0.25, 0.75)) if up is None else up
    dy = -0.5 if up else 0.0          # up between the beats
    far, near = legs_at(phases or (p + 0.5, p, p, p + 0.5), dy)
    hx, hy = 30.4, 10.4 + dy
    parts = far + body_parts(dy, tail_lift=0.4 if up else 0.0)
    parts += [neck((25.4, 13.4 + dy), (hx - 1.2, hy + 0.6))] + head_profile(hx, hy) + near
    return parts


def trot(p):
    """One of four frames of the trot."""
    return raster(trot_parts(p), W, H)


def stand_parts(head="profile", tail_lift=-0.6, ear=0.0):
    """Standing square, all four feet down; the head side on, turned back,
    or turned to look out (`ear` lays the near ear back, a flick)."""
    far, near = legs_at((0.1, 0.6, 0.6, 0.1), 0.0, reach=1.2)
    parts = far + body_parts(0.0, tail_lift=tail_lift)
    if head == "profile":
        parts += [neck((25.4, 13.2), (29.4, 9.6))] + head_profile(30.4, 8.8, ear=ear)
    elif head == "up":
        parts += [neck((25.4, 13.2), (29.8, 8.2))] + head_profile(31.0, 6.8)
    elif head == "back":
        # Over the shoulder: the head turned back along the body.
        parts += [neck((25.4, 13.2), (25.6, 8.8))] + head_profile(25.0, 7.2, facing=-1)
    else:
        parts += [neck((25.4, 13.2), (27.6, 9.8))] + head_front(28.0, 8.6)
    parts += near
    return parts


def stand(head="profile"):
    return raster(stand_parts(head), W, H)


def sit():
    """Sitting up on its haunches, forelegs straight, the brush round its feet,
    looking out."""
    parts = []
    # The far foreleg, then the brush laid round in front of the feet.
    parts += [Part(capsule((24.4, 17.0), (24.9, GROUND - 0.4), 0.95, 0.65), stocking(20.0, False), 0)]
    haunch = ellipse(16.8, 19.8, 4.6, 4.3)
    chest = ellipse(22.6, 15.4, 2.9, 4.4, 0.25)
    back = capsule((17.0, 17.4), (21.8, 12.0), 2.6, 2.3)

    def torso(x, y, light, i, j):
        if x > 22.6 and y > 12.6:
            return WHITE(x, y, light, i, j)
        return COAT(x, y, light, i, j)
    parts.append(Part(union(haunch, chest, back), torso, 2))
    hind_foot = capsule((16.0, GROUND - 0.6), (21.0, GROUND - 0.5), 1.0, 0.8)
    parts.append(Part(hind_foot, BLACK, 4))
    tail = [(13.2, 20.6), (12.8, 22.8), (16.4, 23.4), (21.2, 23.2)]
    tip = tail[-1]

    def tail_paint(x, y, light, i, j):
        if math.hypot(x - tip[0], y - tip[1]) < 2.0:
            return WHITE(x, y, light, i, j)
        return COAT_SOFT(x, y, light, i, j)
    parts.append(Part(path(tail, 2.1, 1.5), tail_paint, 5))
    parts.append(Part(capsule((23.0, 16.6), (23.2, GROUND - 0.4), 1.15, 0.75), stocking(20.0, True), 6))
    parts.append(Part(ellipse(23.7, GROUND - 0.5, 1.1, 0.7), BLACK, 6))
    parts += [neck((22.0, 12.4), (23.0, 9.4))] + head_front(23.2, 8.4)
    return raster(parts, W, H)


def poses():
    return {
        "trot": [trot(p) for p in (0.0, 0.25, 0.5, 0.75)],
        "stand": [stand("profile")],
        "back": [stand("back")],
        "look": [stand("front")],
        "sit": [sit()],
        # The ethogram (characters.json): its instinct, its play, its ritual.
        "act": [raster(pounce_parts(k), W, H) for k in range(4)],
        "play": [raster(toss_parts(k), W, H) for k in range(2)],
        "ritual": [raster(gekker_parts(k), W, H) for k in range(2)],
    }


# ---- in three parts, for a chimera (scripts/characters/chimera.py) ---------------

SEAMS = {"neck": (27.4, 12.4), "hip": (17.6, 14.8)}     # x of each fold, and a height inside the body there
CHIMERA_SCALE = 1.0


def lie_parts(head="profile"):
    """Lying down, legs folded under, the brush round, the head up."""
    dy = 6.4
    parts = [Part(capsule((11.6, GROUND - 0.8), (17.0, GROUND - 0.6), 1.0, 0.7), FAR_COAT, 0)]
    parts += body_parts(dy, tail_lift=-2.0)
    parts.append(Part(capsule((22.4, GROUND - 0.7), (29.0, GROUND - 0.6), 1.0, 0.7), BLACK, 6))
    if head == "front":
        parts += [neck((25.4, 13.2 + dy), (27.4, 9.8 + dy))] + head_front(28.0, 8.6 + dy)
    else:
        parts += [neck((25.4, 13.2 + dy), (29.4, 10.0 + dy))] + head_profile(30.4, 9.2 + dy)
    return parts, dy


def listen_parts(k=0):
    """Mousing: it stands stock still, head cocked down, ears forward, listening."""
    far, near = legs_at((0.1, 0.6, 0.6, 0.1), 0.0, reach=1.0)
    hx, hy = 31.2, 11.6 + 0.6 * k
    return far + body_parts(0.0, tail_lift=-0.2) + [neck((25.4, 13.2), (hx - 1.0, hy - 0.4))] + \
        head_profile(hx, hy, ear=-0.6) + near


def pounce_parts(k):
    """The mouse jump (Červený et al. 2011): from listening, a crouch, the
    leap up in a high arc, and down nose-first into the ground."""
    if k == 0:
        return listen_parts(1)
    if k == 1:
        far, near = legs_at((0.25, 0.75, 0.75, 0.25), 1.2, reach=1.6, lift=0.0)
        return far + body_parts(1.2, tail_lift=0.6) + [neck((25.4, 14.4), (29.8, 13.2))] + head_profile(30.8, 13.4, ear=-0.6) + near
    if k == 2:
        return turned(trot_parts(0.25, (0.6, 0.1, 0.6, 0.1), up=True), -0.42, (20.0, 14.0), (0.0, -5.2))
    return turned(trot_parts(0.5, (0.85, 0.35, 0.85, 0.35), up=False), 0.62, (20.0, 14.0), (2.0, -1.4))


def gekker_parts(k):
    """Gekkering: side on to a rival, back arched, ears flat, mouth open."""
    far, near = legs_at((0.1, 0.6, 0.6, 0.1), -0.6, reach=1.0)
    hx, hy = 30.6, 10.0
    parts = far + body_parts(-0.9, tail_lift=1.8) + [neck((25.4, 12.4), (hx - 1.2, hy + 0.6))]
    parts += head_profile(hx, hy, ear=2.2)
    if k:
        parts.append(Part(triangle((hx + 2.2, hy + 1.8), (hx + 5.4, hy + 2.6), (hx + 4.6, hy + 3.4)), lambda *a: "k", 6))
    return parts + near


def toss_parts(k):
    """Play: tossing a vole, head flung up, the vole in the air."""
    parts = stand_parts("up" if k else "profile", tail_lift=0.8)
    vx, vy = (34.6, 3.0) if k else (35.6, 11.4)
    parts.append(Part(ellipse(vx, vy, 1.2, 0.8, 0.5 if k else 0.0), lambda *a: "d", 8))
    return parts


def rig(pose, k=0, slot="body"):
    """The whole fox in a chimera's pose, as parts, and how far it is lowered."""
    if pose == "act":
        # Cut at the folds, the whole fox's arc would fling its part off the
        # others: in a chimera the leap is the same crouch, a smaller lift
        # (the part rises, tipped up), and the dive a short tip nose-down.
        if k == 2:
            return turned(trot_parts(0.25, (0.6, 0.1, 0.6, 0.1), up=True), -0.16, (20.0, 14.0), (0.0, -2.2)), 0.0
        if k == 3:
            return turned(trot_parts(0.5, (0.85, 0.35, 0.85, 0.35), up=False), 0.22, (20.0, 14.0), (0.6, 0.0)), 0.0
        return pounce_parts(k), (1.2 if k == 1 else 0.0)
    if pose == "ritual":
        return gekker_parts(k), 0.0
    if pose == "walk":
        p = k / 6.0
        return trot_parts(p, (p + 0.75, p + 0.5, p + 0.25, p), up=k in (1, 4)), 0.0
    if pose == "stand":
        return stand_parts("profile", tail_lift=(-0.6, -1.2, 0.6)[k], ear=(0, 0, 1.6)[k]), 0.0
    if pose == "back":
        return stand_parts("profile", tail_lift=0.2, ear=0.8), 0.0
    if pose == "look":
        return stand_parts("front"), 0.0
    if pose == "rest":
        return lie_parts()
    return stand_parts("up", tail_lift=1.4), 0.0


# ---- the fox drawn fine, after the artist's own graphic -------------------------

FINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fox_fine.json")


def fine_sprite():
    """The fox the page draws: traced from the artist's graphic and its edits (trace_fox.py), one CSS pixel a cell —
    a trot in four frames, a stand, a look back, a look at you, a sit. None where fox_fine.json is not there, and
    the whole animal is then the procedural one above. (Its ethogram poses, the pounce, the toss and the gekkering,
    are drawn only as the chimera's parts, rig(): the page never asks the whole fox for them.)"""
    if not os.path.exists(FINE):
        return None
    d = json.load(open(FINE))
    pose = lambda n: list(d["poses"][n])
    return {"w": d["w"], "h": d["h"], "cell": d["cell"], "foot": d["foot"],
            "poses": {"trot": [pose("trot%d" % k) for k in range(4)], "stand": [pose("stand")], "back": [pose("back")],
                      "look": [pose("look")], "sit": [pose("sit")]}}
