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

import math

from draw import Part, capsule, ellipse, path, ramp, raster, triangle, two_bone, union

W, H = 40, 26
GROUND = 24.6                  # the soles stand on this line
CELL = 2                       # CSS pixels a cell, on the page

COAT = ramp("Rrg")
COAT_SOFT = ramp("Rrg")
WHITE = ramp("Ww")
BLACK = ramp("kK")
FAR_COAT = ramp("dR")
FAR_BLACK = ramp("k")


def coat_with_white(white_below):
    """The coat, white where `white_below(x, y)` says so (the bib, the throat)."""
    def paint(x, y, light, i, j):
        if white_below(x, y):
            return WHITE(x, y, light, i, j)
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
    top = knee[1] - 0.6
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
    tail = [(12.6, 13.0 + dy), (8.4, 14.0 + dy - tail_lift * 0.5), (4.2, 14.8 + dy - tail_lift), (1.9, 15.0 + dy - tail_lift)]
    tip = tail[-1]

    def tail_paint(x, y, light, i, j):
        if math.hypot(x - tip[0], y - tip[1]) < 2.3:
            return WHITE(x, y, light, i, j)
        return COAT_SOFT(x, y, light, i, j)
    parts.append(Part(union(path(tail[:2], 1.4, 2.6), path(tail[1:], 2.6, 2.0)), tail_paint, 1))
    # Haunch, barrel and chest, one long low body.
    torso = union(ellipse(18.6, 14.8 + dy, 8.4, 3.2),
                  ellipse(13.9, 14.4 + dy, 3.8, 3.5),
                  ellipse(24.2, 14.5 + dy, 3.6, 3.8, -0.2))
    parts.append(Part(torso, coat_with_white(lambda x, y: x > 25.4 and y > 14.0 + dy), 2))
    return parts


def head_profile(cx, cy, facing=1):
    """The head side on: skull, long muzzle, two ears. facing 1 is right, -1 left."""
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
    near_ear = triangle((cx - f * 2.0, cy - 1.0), (cx + f * 0.4, cy - 2.0), (cx - f * 1.3, cy - 6.4))
    far_ear = triangle((cx + f * 0.3, cy - 1.8), (cx + f * 2.2, cy - 1.0), (cx + f * 1.5, cy - 5.8))

    def ear_paint(x, y, light, i, j):
        return BLACK(x, y, light, i, j) if y < cy - 3.6 else COAT(x, y, light, i, j)

    def far_ear_paint(x, y, light, i, j):
        return "k" if y < cy - 3.4 else FAR_COAT(x, y, light, i, j)
    eye = ellipse(cx + f * 1.7, cy - 0.1, 0.6, 0.45)
    return [Part(far_ear, far_ear_paint, 3), Part(head, paint, 4),
            Part(near_ear, ear_paint, 5), Part(eye, lambda *a: "y", 6)]


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
    far = (leg((sh[0] + 1.0, sh[1]), stride(ff, (sh[0] + 1.0, 0), reach, lift), 4.4, 4.7, 1, 1.0, 0.65, False, 0) +
           leg((hp[0] + 1.0, hp[1]), stride(fh, (hp[0] + 1.0, 0), reach, lift), 4.4, 5.2, -1, 1.5, 0.65, False, 0))
    near = (leg(hp, stride(nh, hp, reach, lift), 4.4, 5.2, -1, 1.8, 0.7, True, 7) +
            leg(sh, stride(nf, sh, reach, lift), 4.4, 4.7, 1, 1.2, 0.7, True, 7))
    return far, near


def neck(a, b):
    def paint(x, y, light, i, j):
        # The throat is white on the side toward the head's chin.
        return COAT(x, y, light, i, j)
    return Part(capsule(a, b, 2.3, 1.9), paint, 3)


def trot(p):
    """One of four frames of the trot."""
    dy = -0.5 if p in (0.25, 0.75) else 0.0          # up between the beats
    far, near = legs_at((p + 0.5, p, p, p + 0.5), dy)
    hx, hy = 30.4, 10.4 + dy
    parts = far + body_parts(dy, tail_lift=0.4 if p in (0.25, 0.75) else 0.0)
    parts += [neck((25.4, 13.4 + dy), (hx - 1.2, hy + 0.6))] + head_profile(hx, hy) + near
    return raster(parts, W, H)


def stand(head="profile"):
    """Standing square, all four feet down; the head side on, turned back,
    or turned to look out."""
    far, near = legs_at((0.1, 0.6, 0.6, 0.1), 0.0, reach=1.2)
    parts = far + body_parts(0.0, tail_lift=-0.6)
    if head == "profile":
        parts += [neck((25.4, 13.2), (29.4, 9.6))] + head_profile(30.4, 8.8)
    elif head == "back":
        # Over the shoulder: the head turned back along the body.
        parts += [neck((25.4, 13.2), (25.6, 8.8))] + head_profile(25.0, 7.2, facing=-1)
    else:
        parts += [neck((25.4, 13.2), (27.6, 9.8))] + head_front(28.0, 8.6)
    parts += near
    return raster(parts, W, H)


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
    }
