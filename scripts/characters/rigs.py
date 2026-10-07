"""The body plans: every native character of a place is drawn by one of these.

The artist, 7 Oct 2026: "Remember that I want a different character for each
place based on native artists and vegetation." There are hundreds of places,
so a native's drawing is generated: a body plan (a rig) given the proportions,
colours and markings of its species (species.py, each with its source), drawn
side on, facing right, in the cast's own way (draw.py: each part a distance
field, light from the upper left, a selective outline), at 40 by 26 cells
(a giraffe stands in a taller sheet), two CSS pixels a cell; then painted in
its artist's hand (hands.py).

Plans: `quad` (every four-footed mammal: canids, cats, bears, deer, cattle,
antelopes, goats and sheep, pigs, horses, camels, elephants, giraffes,
rodents, monkeys and apes, by their proportions), `hopper` (kangaroos and
wallabies), `bird` (perching birds, raptors and owls, vultures, geese,
waders, rheas, parrots, hummingbirds: one rig, its posture, neck, bill, legs
and tail by species), `lizard` (lizards and crocodilians), `frog`, `crab`,
`snake`, `insect` (butterflies, beetles and ants, bees, locusts and moths).

Every rig gives the poses the page reads: `trot` (its gait, four frames:
a trot, a walk, a bound, a hop, a wingbeat, a slither), `stand`, `back` (its
pause: a look back, grazing, a lizard's push-up, a frog's call), `look` (at
you) and `sit` (its rest).

Each part is painted by role, never by colour: "coat" (the ramp d R r g,
deepest to lightest), "far" (the far legs, a step darker), "pale" (W w),
"dark" (k K), "eye" (y); the hand decides how each role is laid (a dither,
strokes, flat plates, cut paper ...), and the page decides the inks.
"""

import math

from draw import LIGHT, bayer, capsule, ellipse, path, poly, triangle, two_bone, union

W, H = 40, 26
CELL = 2


def hsh(i, j, s=0):
    n = (i * 73856093) ^ (j * 19349663) ^ (s * 83492791)
    n &= 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFFFF) % 1024 / 1024.0


# ---- parts, by role ------------------------------------------------------------

class P:
    """A part: its field, its role (or a function of (x, y) giving one), its group."""

    def __init__(self, sdf, role, group=0):
        self.sdf = sdf
        self.role = role
        self.group = group


def mark_role(base, rules):
    """A role that changes by place on the part: rules are (test(x, y), role), first true wins."""
    def role(x, y):
        for test, r in rules:
            if test(x, y):
                return r
        return base
    return role


# ---- the raster: geometry once, then painted by a hand -------------------------

def geometry(parts, w, h):
    """Each cell: the part on it (the last drawn), how lit it is, and whether at its edge."""
    cells = [[None] * w for _ in range(h)]
    for n, part in enumerate(parts):
        # Where the part can be: a coarse look first, so small parts cost little.
        lo_i, hi_i, lo_j, hi_j = w, -1, h, -1
        for j in range(0, h + 2, 2):
            for i in range(0, w + 2, 2):
                if part.sdf(i, j) < 2.2:
                    lo_i, hi_i = min(lo_i, i), max(hi_i, i)
                    lo_j, hi_j = min(lo_j, j), max(hi_j, j)
        if hi_i < 0:
            continue
        for j in range(max(0, lo_j - 2), min(h, hi_j + 2)):
            for i in range(max(0, lo_i - 2), min(w, hi_i + 2)):
                x, y = i + 0.5, j + 0.5
                d = part.sdf(x, y)
                if d > 0.0:
                    continue
                e = 0.25
                gx = part.sdf(x + e, y) - part.sdf(x - e, y)
                gy = part.sdf(x, y + e) - part.sdf(x, y - e)
                g = math.hypot(gx, gy) or 1.0
                edge = 1.0 - max(0.0, min(1.0, -d / 2.6))
                light = max(0.0, min(1.0, 0.625 + 0.5 * (gx / g * LIGHT[0] + gy / g * LIGHT[1]) * edge))
                cells[j][i] = (n, x, y, light, d > -0.9)
    return cells


def paint(parts, cells, hand, w, h):
    """The geometry painted by a hand: rows of letters, outlined."""
    rows = [["."] * w for _ in range(h)]
    for j in range(h):
        for i in range(w):
            c = cells[j][i]
            if not c:
                continue
            n, x, y, light, _ = c
            role = parts[n].role
            if callable(role):
                role = role(x, y)
            rows[j][i] = hand.lay(role, x, y, light, i, j)
    # Where a part lies over one of a lower group, its edge steps down (a near leg on the body).
    deep = hand.deep
    for j in range(h):
        for i in range(w):
            c = cells[j][i]
            if not c or not c[4] or rows[j][i] in "kKy":
                continue
            for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                a, b = i + di, j + dj
                if 0 <= a < w and 0 <= b < h and cells[b][a] and parts[cells[b][a][0]].group < parts[c[0]].group:
                    rows[j][i] = deep
                    break
    out = [r[:] for r in rows]
    for j in range(h):
        for i in range(w):
            if rows[j][i] != ".":
                continue
            lit, near = 0, False
            for di, dj, k in ((1, 0, 1), (0, 1, 1), (-1, 0, -1), (0, -1, -1)):
                a, b = i + di, j + dj
                if 0 <= a < w and 0 <= b < h and rows[b][a] != ".":
                    near = True
                    lit += k
            if near:
                out[j][i] = "p" if lit > 0 else "o"
    return hand.finish(["".join(r) for r in out])


# ---- shared pieces --------------------------------------------------------------

def foot_at(phase, x, reach, lift, ground, duty=0.5):
    p = phase % 1.0
    if p < duty:
        return (x + reach * (1 - 2 * p / duty), ground)
    q = (p - duty) / (1 - duty)
    return (x - reach + 2 * reach * q, ground - lift * math.sin(math.pi * q))


def rot(x, y, cx, cy, a):
    c, s = math.cos(a), math.sin(a)
    x, y = x - cx, y - cy
    return cx + x * c - y * s, cy + x * s + y * c


def turned(sdf, a, about):
    """A field turned by a about a point."""
    cx, cy = about

    def d(x, y):
        return sdf(*rot(x, y, cx, cy, -a))
    return d


# ================================================================================
# quad: every four-footed mammal
# ================================================================================

QUAD = dict(
    size=1.0, L=11.0, legs=8.6, depth=3.3, chest=1.08, haunch=1.0, hump=0.0, sag=0.0,
    neck=4.2, neck_up=40, neck_w=2.1, head=2.6, snout=3.2, snout_w=1.3, snout_drop=0.25,
    ears="point", ear=2.6, tail="brush", tail_len=8.0, tail_up=-10, tail_w=1.6,
    horns=None, horn=1.0, mane=0.0, beard=0.0, trunk=0.0, tusks=0.0,
    leg_w=1.1, hoof=False, arms=1.0, marks=(), gait="trot", rest="lie", grazer=False,
    canvas=(W, H), face="long", cheeks=0.0, ruff=0.0, upright=False,
)


def quad_spec(sp):
    p = dict(QUAD)
    p.update(sp.get("p", {}))
    # Sizes pressed together: a lemming is not drawn a tenth of a moose, or it would not read.
    p["size"] = 0.62 + 0.38 * p["size"] if p["size"] < 1 else 1 + 0.4 * (p["size"] - 1)
    return p


def quad_parts(sp, pose, k):
    p = quad_spec(sp)
    s = p["size"]
    cw, ch = p["canvas"]
    G = ch - 1.4
    marks = set(p["marks"])
    L, legs, dep = p["L"] * s, p["legs"] * s, p["depth"] * s
    cx = cw * 0.47 - (p["neck"] * s) * 0.18
    hip_x, sh_x = cx - L / 2, cx + L / 2
    gait = p["gait"]
    dy = 0.0
    up = False
    phases = None
    lying = pose == "sit" and p["rest"] == "lie"
    if pose == "trot":
        ph = k / 4.0
        if gait == "walk":
            phases = (ph + 0.75, ph + 0.5, ph + 0.25, ph)
            duty = 0.75
        elif gait == "bound":
            phases = (ph + 0.1, ph + 0.5, ph, ph + 0.55)
            duty = 0.45
        else:
            phases = (ph + 0.5, ph, ph, ph + 0.5)
            duty = 0.5
            up = k in (1, 3)
            dy = -0.45 * s if up else 0.0
    else:
        phases = (0.1, 0.6, 0.6, 0.1)
        duty = 0.5
    if lying:
        dy = legs * 0.72
    body_y = G - legs - dep * 0.55 + dy        # the body's middle
    if p["arms"] > 1.0 and pose != "sit":
        tilt = (p["arms"] - 1.0) * 0.5          # an ape: higher at the shoulders
    else:
        tilt = 0.0
    sh_y = body_y - tilt * legs
    hp_y = body_y
    parts = []

    # ---- the coat's role, with its marks -------------------------------------------
    top = lambda x: (hp_y + (sh_y - hp_y) * (x - hip_x) / max(1e-6, sh_x - hip_x)) - dep

    def coat_role(x, y):
        mid = hp_y + (sh_y - hp_y) * (x - hip_x) / max(1e-6, sh_x - hip_x)
        rel = (y - mid) / dep                    # -1 the back, +1 the belly
        if "belly" in marks and rel > 0.42:
            return "pale"
        if "flank" in marks and 0.0 < rel < 0.38 and hip_x + 1 < x < sh_x + 1:
            return "dark"
        if "dorsal" in marks and rel < -0.72:
            return "dark"
        if "saddle" in marks and rel < -0.25 and hip_x - 1 < x < sh_x:
            return "dark"
        if "rump" in marks and x < hip_x + 0.6 and rel < 0.3:
            return "pale"
        if "bib" in marks and x > sh_x + 0.6 and rel > -0.2:
            return "pale"
        if "stripes" in marks:
            u = (x * 0.62 + 0.22 * y) * s ** -1
            if math.sin(u * 2.4) > 0.55 - 0.2 * rel:
                return "dark"
        if "spots" in marks or "rosettes" in marks:
            i, j = int(x * 1.3), int(y * 1.3)
            if hsh(i, j, 5) < 0.17 and rel < 0.6:
                return "dark"
        if "patches" in marks:
            cell = 2.2 * s
            ci, cj = math.floor(x / cell), math.floor((y + 0.5 * math.floor(x / cell)) / cell)
            fx, fy = x / cell - ci, (y + 0.5 * ci) / cell - cj
            if min(fx, fy, 1 - fx, 1 - fy) < 0.14:
                return "pale"
            return "coat"
        if "bands" in marks and int(x * 0.9) % 3 == 0 and rel < 0.5:
            return "pale"
        return "coat"

    def leg_role(far):
        def r(x, y):
            if "dark_legs" in marks and y > G - legs * 0.62:
                return "dark"
            if "socks" in marks and y > G - legs * 0.3:
                return "pale"
            if "pale_legs" in marks and y > G - legs * 0.7:
                return "pale"
            return "far" if far else "coat"
        return r

    # ---- legs ------------------------------------------------------------------------
    reach, lift = 2.6 * s * (0.75 if gait == "walk" else 1.0), 2.0 * s
    lw = p["leg_w"] * s
    fore_len = legs * (1.08 if p["arms"] > 1.0 else 1.0) * p["arms"] ** 0.5

    def leg(j, foot, l1, l2, bend, far, group, hoof):
        knee = two_bone(j, foot, l1, l2, bend)
        sdf = union(capsule(j, knee, lw * 1.25, lw), capsule(knee, foot, lw * 0.85, lw * 0.6))
        out = [P(sdf, leg_role(far), group)]
        foot_sdf = ellipse(foot[0] + 0.4 * s, foot[1] - 0.2, max(0.6, lw * 0.95), 0.55)
        out.append(P(foot_sdf, "dark" if (hoof or "dark_legs" in marks) else ("far" if far else "coat"), group))
        return out

    far_parts, near_parts = [], []
    if not lying:
        ff, fh, nf, nh = phases
        hj = (hip_x, hp_y + dep * 0.35)
        sj = (sh_x, sh_y + dep * 0.45)
        hl = G - hj[1]
        sl = G - sj[1]
        far_parts += leg((sj[0] + 0.8 * s, sj[1]), foot_at(ff, sj[0] + 0.8 * s, reach, lift, G, duty), sl * 0.49, sl * 0.55, 1, True, 0, p["hoof"])
        far_parts += leg((hj[0] + 0.8 * s, hj[1]), foot_at(fh, hj[0] + 0.8 * s, reach, lift, G, duty), hl * 0.48, hl * 0.57, -1, True, 0, p["hoof"])
        near_parts += leg(hj, foot_at(nh, hj[0], reach, lift, G, duty), hl * 0.48, hl * 0.57, -1, False, 7, p["hoof"])
        near_parts += leg(sj, foot_at(nf, sj[0], reach, lift, G, duty), sl * 0.49, sl * 0.55, 1, False, 7, p["hoof"])
    else:
        # Lying down: the legs folded under, a foreleg out in front.
        far_parts.append(P(capsule((hip_x - 0.5, G - 0.8), (hip_x + 3.5 * s, G - 0.6), lw, lw * 0.8), "far", 0))
        near_parts.append(P(capsule((sh_x - 1.0, G - 0.7), (sh_x + 3.2 * s, G - 0.6), lw, lw * 0.75), leg_role(False), 6))

    # ---- tail ------------------------------------------------------------------------
    tl, tw = p["tail_len"] * s, p["tail_w"] * s
    t0 = (hip_x - dep * 0.55, hp_y - dep * 0.62)
    ang = math.radians(180 + p["tail_up"])
    if p["tail"] in ("brush", "long", "thin"):
        droop = 0.0 if pose == "trot" else 0.6
        pts = [t0, (t0[0] + math.cos(ang) * tl * 0.5, t0[1] - math.sin(ang) * tl * 0.5 + droop * tl * 0.2),
               (t0[0] + math.cos(ang) * tl, t0[1] - math.sin(ang) * tl + droop * tl * 0.45)]
        if p["tail"] == "long" and p["arms"] >= 1.0 and p.get("primate"):
            # a monkey's: up and over in an arc
            pts = [t0, (t0[0] - tl * 0.35, t0[1] - tl * 0.25), (t0[0] - tl * 0.5, t0[1] - tl * 0.62), (t0[0] - tl * 0.3, t0[1] - tl * 0.8)]
        r0, r1 = (tw * 0.7, tw) if p["tail"] == "brush" else (tw * 0.6, tw * 0.35)
        tip = pts[-1]
        tip_role = "pale" if "tailtip" in marks else ("dark" if "tailtip_dark" in marks else None)

        def tail_role(x, y, tip=tip, tip_role=tip_role):
            if tip_role and math.hypot(x - tip[0], y - tip[1]) < tw * 1.3:
                return tip_role
            if "ringed" in marks and int(math.hypot(x - t0[0], y - t0[1]) / (1.4 * s)) % 2:
                return "dark"
            return "coat"
        parts.append(P(path(pts, r0, r1), tail_role, 1))
    elif p["tail"] == "tuft":
        a, b = t0, (t0[0] - 1.0 * s, t0[1] + tl * 0.9)
        parts.append(P(capsule(a, b, 0.35 * s + 0.2, 0.3), "coat", 1))
        parts.append(P(ellipse(b[0], b[1] + 0.4, 0.7 * s + 0.2, 1.0 * s + 0.2), "dark", 1))
    elif p["tail"] == "short":
        parts.append(P(ellipse(t0[0] - 0.3, t0[1] + 0.3, 0.9 * s + 0.2, 0.6 * s + 0.3, 0.6), "pale" if "rump" in marks else "coat", 1))
    elif p["tail"] == "curl":
        parts.append(P(path([t0, (t0[0] - 1.6 * s, t0[1] - 1.4 * s), (t0[0] - 0.4 * s, t0[1] - 2.2 * s)], 0.4 * s + 0.2, 0.35), "coat", 1))
    elif p["tail"] == "squirrel":
        parts.append(P(path([t0, (t0[0] - 2.0 * s, t0[1] - 2.5 * s), (t0[0] - 1.2 * s, t0[1] - 6.0 * s), (t0[0] + 0.6 * s, t0[1] - 7.0 * s)], tw * 0.8, tw * 1.1), "coat", 1))

    # ---- the body ----------------------------------------------------------------------
    torso = [ellipse((hip_x + sh_x) / 2, (hp_y + sh_y) / 2 + p["sag"] * s, L / 2 + 1.6 * s, dep, math.atan2(sh_y - hp_y, sh_x - hip_x)),
             ellipse(sh_x + 0.4 * s, sh_y + 0.1, 3.4 * s, dep * p["chest"]),
             ellipse(hip_x + 0.2 * s, hp_y, 3.2 * s, dep * p["haunch"])]
    if p["hump"]:
        torso.append(ellipse(sh_x - 0.6 * s, sh_y - dep * 0.75, 3.2 * s, dep * (0.6 + p["hump"] * 0.6)))
    parts.append(P(union(*torso), coat_role, 2))
    if p["mane"] and pose != "sit":
        pass

    # ---- neck and head -------------------------------------------------------------------
    nup = math.radians(p["neck_up"])
    nl = p["neck"] * s
    base = (sh_x + 1.2 * s, sh_y - dep * 0.55)
    head_dir = 1
    hdx = 0.0
    if pose == "back" and p["grazer"]:
        nup = math.radians(-55)                    # down to the grass
        nl = max(nl, (G - base[1]) * 0.9)
    if pose == "back" and not p["grazer"]:
        head_dir = -1                              # over the shoulder
    if pose == "sit" and p["rest"] != "lie":
        nup = math.radians(min(75, p["neck_up"] + 25))
    if lying:
        nup = math.radians(max(25, p["neck_up"]))
    hb = (base[0] + math.cos(nup) * nl, base[1] - math.sin(nup) * nl)
    if head_dir < 0:
        hb = (base[0] - 0.4 * s, base[1] - nl * 0.85)
    hr = p["head"] * s

    def neck_role(x, y):
        if "mane_dark" in marks and y < base[1] - 0.3:
            pass
        if "bib" in marks and x > base[0] + 0.6:
            return "pale"
        return "coat"
    parts.append(P(capsule(base, hb, p["neck_w"] * s, p["neck_w"] * s * 0.8), neck_role, 3))
    if p["mane"]:
        mt = (hb[0] - 0.4 * s, hb[1] - hr * 0.7)
        parts.append(P(capsule((base[0] - 1.6 * s, base[1] - dep * 0.6), mt, p["mane"] * s, p["mane"] * s * 0.6),
                       "dark" if "mane_dark" in marks else "coat", 3))

    look = pose == "look"
    if look:
        parts += head_front(p, hb[0], hb[1] - hr * 0.2, s, marks)
    else:
        parts += head_side(p, hb[0], hb[1], s, marks, head_dir, pose)
    if p["beard"]:
        parts.append(P(ellipse(hb[0] + 0.6 * s * head_dir, hb[1] + hr * 1.1, p["beard"] * s * 0.7, p["beard"] * s), "dark", 3))
    return far_parts + parts + near_parts, cw, ch


def ear_parts(kind, cx, cy, size, f, s, far=False):
    if kind == "none":
        return []
    z = size * s
    if kind == "point":
        return [triangle((cx - f * 1.0 * s, cy), (cx + f * 0.9 * s, cy - 0.3 * s), (cx - f * 0.5 * s, cy - z * 1.6))]
    if kind == "tuft":
        return [triangle((cx - f * 1.0 * s, cy), (cx + f * 0.9 * s, cy - 0.3 * s), (cx - f * 0.3 * s, cy - z * 1.7)),
                capsule((cx - f * 0.3 * s, cy - z * 1.6), (cx - f * 0.2 * s, cy - z * 2.3), 0.3, 0.25)]
    if kind == "round":
        return [ellipse(cx - f * 0.6 * s, cy - z * 0.55, z * 0.55, z * 0.5)]
    if kind == "long":
        return [ellipse(cx - f * 1.2 * s, cy - z * 0.7, z * 0.45, z * 1.0, f * -0.7)]
    if kind == "side":
        return [ellipse(cx - f * 1.4 * s, cy - z * 0.1, z * 0.8, z * 0.38, f * -0.35)]
    if kind == "big":                          # an elephant's
        return [ellipse(cx - f * 2.2 * s, cy + z * 0.2, z * 1.1, z * 1.45)]
    if kind == "small":
        return [ellipse(cx - f * 0.7 * s, cy - z * 0.35, z * 0.32, z * 0.32)]
    return []


def horn_parts(kind, cx, cy, size, f, s, front=False):
    z = size * s
    out = []
    if not kind:
        return out
    if kind == "antler":
        beam = path([(cx, cy), (cx - f * 1.0 * z, cy - 2.2 * z), (cx - f * 1.6 * z, cy - 4.2 * z), (cx - f * 1.1 * z, cy - 5.6 * z)], 0.45, 0.3)
        tines = union(capsule((cx - f * 0.3 * z, cy - 0.7 * z), (cx + f * 1.3 * z, cy - 1.3 * z), 0.35, 0.28),
                      capsule((cx - f * 1.2 * z, cy - 2.6 * z), (cx + f * 0.3 * z, cy - 3.3 * z), 0.32, 0.26),
                      capsule((cx - f * 1.5 * z, cy - 4.0 * z), (cx - f * 0.4 * z, cy - 4.9 * z), 0.3, 0.25))
        out.append(union(beam, tines))
    elif kind == "forward":                    # a white-tailed deer's: the beam swept forward, tines up
        beam = path([(cx, cy), (cx - f * 0.6 * z, cy - 2.0 * z), (cx + f * 0.8 * z, cy - 3.2 * z), (cx + f * 2.4 * z, cy - 3.0 * z)], 0.4, 0.28)
        tines = union(capsule((cx + f * 0.2 * z, cy - 2.9 * z), (cx + f * 0.1 * z, cy - 4.3 * z), 0.3, 0.24),
                      capsule((cx + f * 1.3 * z, cy - 3.2 * z), (cx + f * 1.3 * z, cy - 4.5 * z), 0.3, 0.24))
        out.append(union(beam, tines))
    elif kind == "palm":                       # a moose's
        out.append(union(ellipse(cx - f * 1.2 * z, cy - 1.9 * z, 2.3 * z, 1.0 * z, f * -0.3),
                         capsule((cx, cy), (cx - f * 0.6 * z, cy - 1.4 * z), 0.45, 0.4)))
    elif kind == "caribou":
        out.append(union(path([(cx, cy), (cx - f * 1.6 * z, cy - 2.6 * z), (cx - f * 1.2 * z, cy - 5.0 * z), (cx + f * 0.6 * z, cy - 5.6 * z)], 0.4, 0.28),
                         capsule((cx + f * 0.1 * z, cy - 0.5 * z), (cx + f * 1.4 * z, cy - 1.6 * z), 0.35, 0.5)))
    elif kind == "curve":                      # an ibex's: a long scimitar back
        out.append(path([(cx, cy), (cx - f * 0.6 * z, cy - 2.4 * z), (cx - f * 2.4 * z, cy - 3.6 * z), (cx - f * 3.8 * z, cy - 2.6 * z)], 0.65 * z, 0.3))
    elif kind == "spiral":                     # a mouflon's or a bighorn's: round and forward
        out.append(path([(cx, cy - 0.3 * z), (cx - f * 1.6 * z, cy - 1.6 * z), (cx - f * 2.2 * z, cy + 0.2 * z), (cx - f * 1.0 * z, cy + 1.4 * z), (cx + f * 0.2 * z, cy + 0.9 * z)], 0.8 * z, 0.35))
    elif kind == "straight":                   # an addax's, a gemsbok's
        out.append(path([(cx, cy), (cx - f * 2.4 * z, cy - 3.4 * z), (cx - f * 4.6 * z, cy - 5.6 * z)], 0.4, 0.2))
    elif kind == "lyre":                       # an impala's, a blackbuck's, a gazelle's
        out.append(path([(cx, cy), (cx - f * 0.6 * z, cy - 2.0 * z), (cx - f * 0.2 * z, cy - 3.4 * z), (cx - f * 0.9 * z, cy - 4.6 * z)], 0.4, 0.22))
    elif kind == "boss":                       # a buffalo's, a muskox's, a gaur's
        out.append(path([(cx + f * 0.6 * z, cy - 0.6 * z), (cx - f * 1.4 * z, cy - 0.9 * z), (cx - f * 2.4 * z, cy + 0.6 * z), (cx - f * 1.8 * z, cy + 1.6 * z)], 0.55 * z, 0.3))
    elif kind == "short":                      # a cow's, a wildebeest's: out and up
        out.append(path([(cx, cy - 0.2), (cx - f * 1.4 * z, cy - 0.9 * z), (cx - f * 1.3 * z, cy - 2.2 * z)], 0.45, 0.25))
    elif kind == "prong":                      # a pronghorn's
        out.append(union(capsule((cx, cy), (cx - f * 0.3 * z, cy - 2.8 * z), 0.4, 0.3),
                         capsule((cx - f * 0.15 * z, cy - 1.6 * z), (cx + f * 0.7 * z, cy - 1.9 * z), 0.3, 0.25)))
    elif kind == "ossicone":                   # a giraffe's
        out.append(union(capsule((cx, cy), (cx - f * 0.3 * z, cy - 1.5 * z), 0.35, 0.3),
                         ellipse(cx - f * 0.3 * z, cy - 1.6 * z, 0.5, 0.45)))
    return out


def head_side(p, cx, cy, s, marks, f, pose):
    hr = p["head"] * s
    out = []
    face = p["face"]
    sl, sw = p["snout"] * s, p["snout_w"] * s
    for e in ear_parts(p["ears"], cx - f * 0.1 * s, cy - hr * 0.55, p["ear"], f, s):
        out.append(P(e, "dark" if "earback" in marks else "far", 3))
    skull = ellipse(cx, cy, hr * 1.05, hr * 0.92)
    tip = (cx + f * (hr * 0.7 + sl), cy + hr * p["snout_drop"] + 0.2 * s)
    snout = capsule((cx + f * hr * 0.5, cy + hr * 0.15), tip, sw * 1.15, sw * 0.75)
    head = union(skull, snout)

    def head_role(x, y):
        if "mask" in marks and abs(x - (cx + f * hr * 0.35)) < hr * 0.55 and y < cy + hr * 0.3:
            return "dark"
        if "pale_face" in marks and f * (x - cx) > -hr * 0.2:
            return "pale"
        if "muzzle" in marks and f * (x - cx) > hr * 0.6 + sl * 0.5:
            return "pale"
        if "muzzle_dark" in marks and f * (x - cx) > hr * 0.6 + sl * 0.55:
            return "dark"
        if ("bib" in marks or "cheeks" in marks or "belly" in marks and face == "short") and y > cy + hr * 0.45:
            return "pale"
        if "blaze" in marks and abs(y - (cy - hr * 0.35 + (x - cx) * f * 0.25)) < 0.5 and f * (x - cx) > 0:
            return "pale"
        return "coat"
    out.append(P(head, head_role, 4))
    if p["trunk"]:
        tr = p["trunk"] * s
        t1 = (tip[0] + f * 0.6 * s, tip[1] + tr * 0.55)
        t2 = (tip[0] + f * 0.2 * s, tip[1] + tr)
        if pose == "trot":
            t2 = (tip[0] + f * 1.0 * s, tip[1] + tr * 0.9)
        out.append(P(path([tip, t1, t2], sw * 0.8, sw * 0.45), "coat", 4))
    if p["tusks"]:
        out.append(P(path([(cx + f * hr * 0.9, cy + hr * 0.8), (cx + f * (hr + 1.6 * s), cy + hr * 1.6), (cx + f * (hr + 2.6 * s), cy + hr * 1.0)], 0.45 * s, 0.25), "pale", 5))
    for hpart in horn_parts(p["horns"], cx - f * hr * 0.15, cy - hr * 0.7, p["horn"], f, s):
        out.append(P(hpart, "dark" if p.get("horn_dark", True) else "pale", 5))
    nose = (tip[0] + f * 0.1, tip[1] - sw * 0.2)
    if not p["trunk"]:
        out.append(P(ellipse(nose[0], nose[1], max(0.5, sw * 0.55), max(0.45, sw * 0.45)), "dark", 5))
    ex = cx + f * hr * 0.42
    out.append(P(ellipse(ex, cy - hr * 0.18, max(0.45, hr * 0.18), max(0.4, hr * 0.16)), "eye", 6))
    if p["ears"] in ("point", "tuft", "round", "long", "small"):
        for e in ear_parts(p["ears"], cx + f * 0.7 * s, cy - hr * 0.6, p["ear"], f, s):
            out.append(P(e, "dark" if "earback" in marks else "coat", 5))
    return out


def head_front(p, cx, cy, s, marks):
    hr = p["head"] * s
    out = []
    z = p["ear"] * s
    kind = p["ears"]
    for f in (-1, 1):
        ex, ey = cx + f * hr * 0.85, cy - hr * 0.55
        if kind in ("point", "tuft"):
            out.append(P(triangle((ex - 0.9 * s, ey + 0.4), (ex + 0.9 * s, ey + 0.4), (ex + f * 0.2 * s, ey - z * 1.5)), "dark" if "earback" in marks else "coat", 3))
        elif kind in ("round", "small"):
            out.append(P(ellipse(ex + f * 0.2, ey - 0.2, z * 0.5, z * 0.48), "coat", 3))
        elif kind == "long":
            out.append(P(ellipse(ex + f * 0.9 * s, ey - z * 0.3, z * 0.45, z * 0.95, f * 0.6), "coat", 3))
        elif kind in ("side", "big"):
            out.append(P(ellipse(ex + f * z * 0.6, ey + 0.6 * s, z * (1.1 if kind == "big" else 0.7), z * (1.3 if kind == "big" else 0.4)), "far", 3))
        for hpart in horn_parts(p["horns"], cx + f * hr * 0.45, cy - hr * 0.75, p["horn"] * 0.85, -f, s, True):
            out.append(P(hpart, "dark" if p.get("horn_dark", True) else "pale", 5))
    long = p["face"] == "long"
    skull = ellipse(cx, cy, hr * 0.95, hr * (1.15 if long else 0.95))

    def role(x, y):
        if "mask" in marks and abs(y - (cy - hr * 0.15)) < hr * 0.35:
            return "dark"
        if "pale_face" in marks:
            return "pale"
        if ("bib" in marks or "cheeks" in marks or "belly" in marks) and y > cy + hr * 0.25 and abs(x - cx) > hr * 0.3:
            return "pale"
        return "coat"
    out.append(P(skull, role, 4))
    my = cy + hr * (0.75 if long else 0.45)
    if p["trunk"]:
        out.append(P(path([(cx, cy + hr * 0.3), (cx, cy + hr * 1.6), (cx + 0.6 * s, cy + hr * 2.4)], 0.9 * s, 0.5), "coat", 5))
    else:
        out.append(P(ellipse(cx, my, hr * 0.5, hr * 0.42), "pale" if ("muzzle" in marks or "bib" in marks or "pale_face" in marks) else "coat", 5))
        out.append(P(ellipse(cx, my - hr * 0.18, max(0.5, hr * 0.22), max(0.4, hr * 0.15)), "dark", 6))
    for f in (-1, 1):
        out.append(P(ellipse(cx + f * hr * 0.42, cy - hr * 0.12, max(0.45, hr * 0.15), max(0.42, hr * 0.15)), "eye", 6))
    return out


def quad_sit(sp, pose):
    """Sitting up: a dog's or a cat's sitting, or a rodent's or a monkey's upright."""
    p = quad_spec(sp)
    s = p["size"]
    cw, ch = p["canvas"]
    G = ch - 1.4
    marks = set(p["marks"])
    legs, dep = p["legs"] * s, p["depth"] * s
    cx = cw * 0.5
    parts = []
    upright = p["upright"]
    hx, hy = cx - 2.0 * s, G - dep * 1.1
    if p["tail"] in ("brush", "long", "thin", "squirrel"):
        tl, tw = p["tail_len"] * s, p["tail_w"] * s
        if p["tail"] == "squirrel":
            pts = [(hx - 1.5 * s, G - 1.5), (hx - 3.5 * s, G - 5 * s), (hx - 2.6 * s, G - 9 * s), (hx - 0.8 * s, G - 10 * s)]
            parts.append(P(path(pts, tw * 0.8, tw * 1.1), "coat", 1))
        else:
            pts = [(hx - 1.5 * s, G - 1.0), (hx - tl * 0.35, G - 0.6), (hx - tl * 0.6, G - 0.9)]
            if p.get("primate"):
                pts = [(hx - 0.5 * s, G - 1.2), (hx - 1.0 * s, G - 0.3), (hx - tl * 0.5, G - 0.4)]
            tip = pts[-1]

            def tr(x, y, tip=tip):
                if "tailtip" in marks and math.hypot(x - tip[0], y - tip[1]) < tw * 1.3:
                    return "pale"
                if "ringed" in marks and int(abs(x - pts[0][0]) / (1.4 * s)) % 2:
                    return "dark"
                return "coat"
            parts.append(P(path(pts, tw * 0.7, tw * 0.6), tr, 1))
    torso_h = max(dep * (2.3 if upright else 1.9), legs * (1.0 if upright else 1.2))
    back = capsule((hx, G - dep * 0.9), (cx + (0.6 if upright else 1.6) * s, G - torso_h - dep * 0.3), dep * 0.95, dep * 0.8)
    haunch = ellipse(hx + 0.4 * s, G - dep * 1.05, dep * 1.3, dep * 1.15)

    def role(x, y):
        if ("belly" in marks or "bib" in marks) and x > cx + 0.2 * s and y > G - torso_h:
            return "pale"
        if "stripes" in marks and math.sin((y * 0.7 + x * 0.25) * 2.4) > 0.55:
            return "dark"
        if ("spots" in marks or "rosettes" in marks) and hsh(int(x * 1.3), int(y * 1.3), 5) < 0.17:
            return "dark"
        return "coat"
    parts.append(P(union(back, haunch), role, 2))
    lw = p["leg_w"] * s
    # the hind foot along the ground, the forelegs straight (or the paws held up, upright)
    parts.append(P(capsule((hx - 0.5 * s, G - 0.5), (hx + 3.0 * s, G - 0.45), lw * 0.9, lw * 0.7),
                   "dark" if "dark_legs" in marks else "coat", 4))
    top = (cx + (0.6 if upright else 1.6) * s, G - torso_h - dep * 0.3)
    if upright:
        parts.append(P(capsule((top[0] + 0.6 * s, top[1] + dep * 0.9), (top[0] + 1.6 * s, top[1] + dep * 1.8), lw * 0.7, lw * 0.55), "coat", 6))
    else:
        parts.append(P(capsule((top[0] + 0.4 * s, top[1] + dep * 0.8), (top[0] + 0.7 * s, G - 0.4), lw, lw * 0.75),
                       "dark" if "dark_legs" in marks else "coat", 6))
    hr = p["head"] * s
    hc = (top[0] + 0.6 * s, top[1] - hr * 0.9)
    parts.append(P(capsule(top, hc, p["neck_w"] * s, p["neck_w"] * s * 0.8), "coat", 3))
    parts += head_front(p, hc[0], hc[1], s, marks)
    return parts, cw, ch


def quad_draw(sp, pose, k):
    p = quad_spec(sp)
    if pose == "sit" and p["rest"] in ("sit", "upright"):
        if p["rest"] == "upright":
            sp = dict(sp)
            sp["p"] = dict(sp.get("p", {}), upright=True)
        return quad_sit(sp, pose)
    return quad_parts(sp, pose, k)


# ================================================================================
# hopper: kangaroos and wallabies
# ================================================================================

def hopper_draw(sp, pose, k):
    p = dict(size=1.0, ears=2.4, tail=10.0, marks=())
    p.update(sp.get("p", {}))
    s = p["size"]
    G = H - 1.4
    marks = set(p["marks"])
    # (lean of the body, hip height, foot back, airborne)
    if pose == "trot":
        lean, hip_up, foot_back, air = [(0.55, 4.0, 0.0, 0.0), (0.9, 6.5, 2.5, 0.0), (1.1, 8.5, 4.5, 3.0), (0.75, 5.5, 1.0, 1.0)][k]
    elif pose == "sit":
        lean, hip_up, foot_back, air = 0.35, 3.2, 0.0, 0.0
    else:
        lean, hip_up, foot_back, air = 0.2, 4.4, 0.0, 0.0
    hip = (17.0, G - hip_up * s - air * s)
    up = (hip[0] + math.sin(lean) * 7.0 * s, hip[1] - math.cos(lean) * 7.0 * s)
    parts = []
    tail_end = (hip[0] - p["tail"] * s, G - 0.6 - air * s * 0.4)
    parts.append(P(path([hip, ((hip[0] + tail_end[0]) / 2, (hip[1] + tail_end[1]) / 2 + 0.6), tail_end], 1.6 * s, 0.5), "coat", 1))
    knee = (hip[0] + 1.8 * s, hip[1] + 2.0 * s)
    heel = (hip[0] - 0.5 * s - foot_back * s * 0.3, G - 0.6 - air * s)
    toe = (heel[0] + 4.2 * s - foot_back * s * 0.4, G - 0.4 - air * s * (1.2 if pose == "trot" and k == 2 else 1.0))
    parts.append(P(union(ellipse(hip[0] + 0.4 * s, hip[1] + 0.2, 3.0 * s, 2.6 * s), capsule(knee, heel, 1.0 * s, 0.6)), "far", 0))
    torso = capsule(hip, up, 2.6 * s, 1.9 * s)

    def role(x, y):
        if "belly" in marks and (x - hip[0]) * math.cos(lean) + (hip[1] - y) * -math.sin(lean) > 0.8 * s:
            return "pale"
        return "coat"
    parts.append(P(torso, role, 2))
    parts.append(P(union(ellipse(hip[0] + 0.6 * s, hip[1] + 0.3, 3.1 * s, 2.8 * s), capsule(knee, heel, 1.1 * s, 0.6)), "coat", 6))
    parts.append(P(capsule(heel, toe, 0.7, 0.45), "dark", 6))
    arm0 = (up[0] + 0.8 * s, up[1] + 2.2 * s)
    parts.append(P(capsule(arm0, (arm0[0] + 1.4 * s, arm0[1] + 2.6 * s), 0.55 * s, 0.4), "coat", 7))
    hr = 1.8 * s
    hc = (up[0] + 1.6 * s, up[1] - 1.8 * s)
    if pose == "look":
        parts += head_front(dict(QUAD, head=1.8, ears="long", ear=p["ears"], face="long", horns=None, trunk=0), hc[0], hc[1], s, marks)
    else:
        f = -1 if pose == "back" else 1
        if f < 0:
            hc = (up[0] - 0.6 * s, up[1] - 1.6 * s)
        parts.append(P(ellipse(hc[0] - f * 0.6 * s, hc[1] - hr * 1.2, 0.55 * s, p["ears"] * s * 0.6, -f * 0.3), "coat", 3))
        parts.append(P(union(ellipse(hc[0], hc[1], hr * 1.05, hr * 0.85), capsule((hc[0] + f * hr * 0.4, hc[1] + 0.2), (hc[0] + f * (hr + 1.8 * s), hc[1] + 0.8 * s), 1.1 * s, 0.65 * s)), "coat", 4))
        parts.append(P(ellipse(hc[0] + f * (hr + 1.8 * s), hc[1] + 0.6 * s, 0.55, 0.45), "dark", 5))
        parts.append(P(ellipse(hc[0] + f * hr * 0.35, hc[1] - hr * 0.2, 0.45, 0.42), "eye", 6))
    return parts, W, H


# ================================================================================
# bird: one rig for every bird, by posture
# ================================================================================

BIRD = dict(
    size=1.0, body=5.0, deep=2.6, tilt=25, neck=1.2, neck_up=60, head=1.9, bill="cone", bill_len=1.6,
    legs=2.6, leg_w=0.35, tail=3.4, tail_drop=20, crest=0.0, casque=0.0, bare=False, ruff=0.0,
    disk=False, wing_span=10.0, marks=(), gait="fly", pale_parts=("belly",), dark_parts=(),
    bill_role="dark", leg_role="dark", ratite=False,
)


def bird_draw(sp, pose, k):
    p = dict(BIRD)
    p.update(sp.get("p", {}))
    s = p["size"] * p.get("scale", 1.55)
    G = H - 1.4
    pale, darks = set(p["pale_parts"]), set(p["dark_parts"])
    flying = pose == "trot" and p["gait"] == "fly"
    walking = pose == "trot" and p["gait"] != "fly"
    tilt = math.radians(5 if flying else p["tilt"])
    bl, bd = p["body"] * s, p["deep"] * s
    legs = p["legs"] * s
    if pose == "sit":
        legs = 0.4 * s if not p["ratite"] else legs * 0.25
    bcx = 19.0
    bcy = G - legs - bd * 0.8
    if flying:
        bcy = G - legs - bd - 3.0 * s
    parts = []
    tail_dir = math.radians(180 + p["tail_drop"]) if not flying else math.radians(180 + 5)
    rear = (bcx - math.cos(tilt) * bl * 0.8, bcy + math.sin(tilt) * bl * 0.8)
    if p["tail"]:
        tt = (rear[0] + math.cos(tail_dir) * p["tail"] * s, rear[1] - math.sin(tail_dir) * p["tail"] * s)
        parts.append(P(path([rear, tt], bd * 0.45, 0.45 * s + 0.25), "pale" if "tail" in pale else ("dark" if "tail" in darks else "coat"), 1))
    # legs
    if pose != "sit" or p["ratite"]:
        hipb = (bcx - 0.4 * s, bcy + bd * 0.6)
        for n, ph in enumerate(((k / 4.0) if walking else 0.1, (k / 4.0 + 0.5) if walking else 0.6)):
            if flying:
                foot = (hipb[0] - 2.0 * s, hipb[1] + 1.2 * s)
            else:
                foot = foot_at(ph, hipb[0] + 0.3, 1.6 * s if walking else 0.5, 1.2 * s, G, 0.55)
            knee = two_bone(hipb, foot, legs * 0.5 + 0.3, legs * 0.55 + 0.3, -1)
            lr = "far" if n == 0 and p["leg_role"] != "pale" else p["leg_role"]
            parts.append(P(union(capsule(hipb, knee, p["leg_w"] * s * 1.6 + 0.15, p["leg_w"] * s + 0.15),
                                 capsule(knee, foot, p["leg_w"] * s + 0.15, p["leg_w"] * s + 0.12),
                                 capsule(foot, (foot[0] + 1.0 * s, foot[1]), 0.3, 0.25)), lr, 0 if n == 0 else 7))
    # the far wing, flying
    sh = (bcx + 0.6 * s, bcy - bd * 0.4)
    if flying:
        a = [1.15, 0.25, -0.75, 0.25][k]
        span = p["wing_span"] * s
        tipw = (sh[0] - span * 0.35 * math.cos(a) - 1.0, sh[1] - span * 0.55 * math.sin(a))
        parts.append(P(path([sh, ((sh[0] + tipw[0]) / 2 + 0.6, (sh[1] + tipw[1]) / 2), tipw], bd * 0.5, 0.4), "far", 0))
    body = ellipse(bcx, bcy, bl, bd, -tilt)

    def body_role(x, y):
        # below the line from the throat to the rear: the belly
        u = (x - bcx) * math.cos(-tilt) + (y - bcy) * math.sin(-tilt)
        v = -(x - bcx) * math.sin(-tilt) + (y - bcy) * math.cos(-tilt)
        if "breast_dark" in darks and v > bd * 0.1 and u > 0:
            return "dark"
        if "belly" in pale and v > bd * 0.25:
            return "pale"
        if "breast" in pale and v > -bd * 0.1 and u > bl * 0.1:
            return "pale"
        if "wing_patch" in darks and v < bd * 0.1 and -bl * 0.5 < u < bl * 0.3:
            return "dark"
        if "wing_patch" in pale and v < bd * 0.1 and -bl * 0.5 < u < bl * 0.2:
            return "pale"
        if "bars" in p["marks"] and v < bd * 0.2 and int(u * 1.2 + 5) % 2:
            return "dark"
        if "spots" in p["marks"] and hsh(int(x * 1.5), int(y * 1.5), 3) < 0.2:
            return "pale"
        if "primaries" in darks and u < -bl * 0.35 and v < bd * 0.2:
            return "dark"
        return "coat"
    parts.append(P(body, body_role, 2))
    if not flying:
        # the near wing folded along the side
        wing = ellipse(bcx - bl * 0.18, bcy - bd * 0.05, bl * 0.75, bd * 0.62, -tilt)
        parts.append(P(wing, lambda x, y: "dark" if ("wing" in darks or ("primaries" in darks and x < bcx - bl * 0.45)) else ("pale" if "wing" in pale else "coat"), 3))
    else:
        a = [1.15, 0.25, -0.75, 0.25][k]
        span = p["wing_span"] * s
        tipw = (sh[0] - span * 0.3 * math.cos(a) + 1.0, sh[1] - span * 0.62 * math.sin(a))
        parts.append(P(path([sh, ((sh[0] + tipw[0]) / 2, (sh[1] + tipw[1]) / 2 - 0.4), tipw], bd * 0.7, 0.45),
                       lambda x, y: "dark" if ("wing" in darks or "primaries" in darks) and math.hypot(x - sh[0], y - sh[1]) > p["wing_span"] * s * 0.35 else ("pale" if "wing" in pale else "coat"), 6))
    # neck and head
    nup = math.radians(p["neck_up"])
    front = (bcx + math.cos(tilt) * bl * 0.7, bcy - math.sin(tilt) * bl * 0.7)
    nl = p["neck"] * s
    f = 1
    if pose == "back" and p["gait"] == "walk" and p["legs"] > 6:
        nup = math.radians(-60)               # a wader's head down, feeding
        nl = nl * 1.05
    elif pose == "back":
        f = -1
    if pose == "sit":
        nl *= 0.4
    if flying:
        nup = math.radians(10)
    hc = (front[0] + math.cos(nup) * nl, front[1] - math.sin(nup) * nl)
    if f < 0:
        hc = (front[0] - 0.6 * s, front[1] - nl * 0.8 - 0.4)
    hr = p["head"] * s
    if nl > 0.6:
        parts.append(P(capsule(front, hc, max(0.7, hr * 0.6), max(0.6, hr * 0.5)),
                       "pale" if "neck" in pale or "head" in pale and nl > 3 else ("dark" if "neck" in darks else "coat"), 4))
    if p["ruff"]:
        parts.append(P(ellipse(front[0] - 0.2, front[1] - 0.3, p["ruff"] * s, p["ruff"] * s * 0.8), "pale" if "ruff" in pale else "dark", 4))
    look = pose == "look"
    head = ellipse(hc[0], hc[1], hr * (1.0 if look else 1.1), hr)

    def head_role(x, y):
        if "cap" in darks and y < hc[1] - hr * 0.25:
            return "dark"
        if "mask" in darks and abs(y - hc[1]) < hr * 0.35:
            return "dark"
        if "head" in pale or (p["bare"] and "bare_pale" in p["marks"]):
            return "pale"
        if "head" in darks:
            return "dark"
        if "throat" in pale and y > hc[1] + hr * 0.2:
            return "pale"
        return "coat"
    parts.append(P(head, head_role, 5))
    if p["crest"]:
        cr = p["crest"] * s
        parts.append(P(triangle((hc[0] - f * hr * 0.6, hc[1] - hr * 0.6), (hc[0] + f * hr * 0.2, hc[1] - hr * 0.9),
                                (hc[0] - f * hr * 0.9, hc[1] - hr - cr)), "dark" if "crest" in darks else ("pale" if "crest" in pale else "coat"), 5))
    if p["disk"]:
        parts.append(P(ellipse(hc[0] + f * hr * 0.3, hc[1], hr * 0.7, hr * 0.8), "pale", 6))
    bl_ = p["bill_len"] * s
    br = p["bill_role"]
    bx = hc[0] + f * hr * 0.85
    if look:
        parts.append(P(triangle((hc[0] - 0.6, hc[1] + 0.1), (hc[0] + 0.6, hc[1] + 0.1), (hc[0], hc[1] + 0.5 + min(bl_, 2.2) * 0.6)), br, 7))
        for g in (-1, 1):
            parts.append(P(ellipse(hc[0] + g * hr * 0.45, hc[1] - hr * 0.15, 0.45, 0.42), "eye", 7))
    else:
        shape = p["bill"]
        if shape == "hook":
            bill = path([(bx - f * 0.3, hc[1] - 0.2), (bx + f * bl_ * 0.7, hc[1] - 0.1), (bx + f * bl_, hc[1] + 0.7)], 0.65 * s + 0.15, 0.3)
        elif shape == "down":
            bill = path([(bx, hc[1] + 0.1), (bx + f * bl_ * 0.6, hc[1] + bl_ * 0.25), (bx + f * bl_, hc[1] + bl_ * 0.7)], 0.4, 0.25)
        elif shape == "spoon":
            bill = union(capsule((bx, hc[1] + 0.1), (bx + f * bl_, hc[1] + 0.3), 0.35, 0.3), ellipse(bx + f * bl_, hc[1] + 0.3, 0.8, 0.6))
        elif shape == "bent":
            bill = path([(bx, hc[1]), (bx + f * bl_ * 0.5, hc[1] + 0.1), (bx + f * bl_ * 0.7, hc[1] + bl_ * 0.6)], 0.8 * s, 0.35)
        elif shape == "flat":
            bill = capsule((bx, hc[1] + 0.2), (bx + f * bl_, hc[1] + 0.5), 0.6 * s + 0.1, 0.45)
        elif shape == "heavy":
            bill = path([(bx, hc[1]), (bx + f * bl_, hc[1] + 0.4)], 1.0 * s, 0.55 * s)
        elif shape == "parrot":
            bill = path([(bx - f * 0.2, hc[1] - 0.5), (bx + f * bl_ * 0.8, hc[1] - 0.2), (bx + f * bl_ * 0.7, hc[1] + 1.0)], 0.9 * s, 0.35)
        elif shape == "long":
            bill = capsule((bx, hc[1] + 0.1), (bx + f * bl_, hc[1] + 0.35), 0.45 * s + 0.12, 0.22)
        else:                                  # cone, thin
            bill = triangle((bx - f * 0.2, hc[1] - 0.55 * s), (bx - f * 0.2, hc[1] + 0.55 * s), (bx + f * bl_, hc[1] + 0.15))
        parts.append(P(bill, br, 6))
        if p["casque"]:
            parts.append(P(ellipse(bx + f * bl_ * 0.35, hc[1] - 0.9 * s, bl_ * 0.4, p["casque"] * s, f * 0.15), "pale" if br == "pale" else "eye", 6))
        parts.append(P(ellipse(hc[0] + f * hr * 0.35, hc[1] - hr * 0.2, max(0.45, hr * 0.22), max(0.42, hr * 0.2)), "eye", 7))
    return parts, W, H


# ================================================================================
# lizard: lizards and crocodilians
# ================================================================================

def lizard_draw(sp, pose, k):
    p = dict(size=1.0, body=7.0, deep=1.6, head=1.6, snout=1.6, tail=12.0, legs=2.2, marks=(), croc=False, frill=0.0, spines=0.0)
    p.update(sp.get("p", {}))
    s = p["size"] * 1.45
    G = H - 1.4
    marks = set(p["marks"])
    lift = 0.0
    if pose == "back":
        lift = 1.6 * s                             # the push-up: the forelegs straightened, the head up
    if pose == "sit":
        p["legs"] *= 0.45
    bl, bd = p["body"] * s, p["deep"] * s * 1.25
    by = G - p["legs"] * s - bd * 0.6
    cx = 21.0 - (2.0 if p["croc"] else 0)
    hipx, shx = cx - bl * 0.55, cx + bl * 0.55
    wave = math.sin(k * math.pi / 2) * 0.5 * s if pose == "trot" else 0.0
    parts = []
    tl = p["tail"] * s / 1.45
    tail = path([(hipx, by), (hipx - tl * 0.4, by + bd * 0.4 + wave), (hipx - tl * 0.75, G - 0.8 - wave), (hipx - tl, G - 0.6)], bd * 0.8, 0.3)

    def tail_role(x, y):
        if "tailbands" in marks and int((hipx - x) / (1.5 * s)) % 2:
            return "dark"
        return "coat"
    parts.append(P(tail, tail_role, 1))

    def leg(j, ph, far, group):
        foot = foot_at(ph, j[0] + 0.4, 1.4 * s, 0.9 * s, G, 0.5)
        elbow = (j[0] + (0.6 if far else -0.4) * s, max(j[1] + 0.5, foot[1] - p["legs"] * s * 0.9))
        return P(union(capsule(j, elbow, 0.6 * s + 0.1, 0.5 * s + 0.1), capsule(elbow, foot, 0.45 * s + 0.1, 0.35),
                       capsule(foot, (foot[0] + 0.9 * s, foot[1]), 0.3, 0.25)), "far" if far else "coat", group)
    ph = k / 4.0 if pose == "trot" else 0.1
    front_y = by - lift
    parts.append(leg((shx + 0.4, front_y + bd * 0.6), ph + 0.5, True, 0))
    parts.append(leg((hipx + 0.4, by + bd * 0.6), ph, True, 0))
    body = union(ellipse(cx, (by + front_y) / 2, bl, bd, -math.atan2(lift, bl * 2)))

    def body_role(x, y):
        rel = (y - by) / bd
        if "belly" in marks and rel > 0.45:
            return "pale"
        if "stripes" in marks and abs(rel + 0.35) < 0.22:
            return "pale"
        if "spots" in marks and hsh(int(x * 1.2), int(y * 1.2), 9) < 0.22:
            return "pale"
        if "ocelli" in marks and hsh(int(x * 0.8), int(y * 0.8), 9) < 0.25 and rel < 0.3:
            return "pale"
        if "scutes" in marks and rel < -0.55 and int(x * 1.2) % 2:
            return "dark"
        if "bands" in marks and int(x / (1.6 * s)) % 2 and rel < 0.4:
            return "dark"
        return "coat"
    parts.append(P(body, body_role, 2))
    if p["spines"]:
        parts.append(P(union(*[triangle((x0 - 0.5, by - bd * 0.8), (x0 + 0.5, by - bd * 0.8), (x0, by - bd * 0.8 - p["spines"] * s)) for x0 in [hipx + n * 1.4 * s for n in range(int(bl * 2 / (1.4 * s)))]]), "dark", 2))
    # head
    hcx, hcy = shx + p["head"] * s * 0.9, front_y - (0.6 * s if pose == "back" else 0)
    if pose == "look":
        hd = union(ellipse(hcx, hcy - 0.3, p["head"] * s * 0.95, p["head"] * s * 0.8))
        parts.append(P(hd, "coat", 4))
        for g in (-1, 1):
            parts.append(P(ellipse(hcx + g * p["head"] * s * 0.5, hcy - p["head"] * s * 0.4, 0.5, 0.45), "eye", 6))
    else:
        f = 1
        sl = p["snout"] * s * (2.2 if p["croc"] else 1.0)
        hd = union(ellipse(hcx, hcy, p["head"] * s, p["head"] * s * 0.72),
                   capsule((hcx, hcy + 0.1), (hcx + f * sl + p["head"] * s * 0.5, hcy + 0.35 * s), p["head"] * s * 0.55, p["head"] * s * 0.32))
        parts.append(P(hd, lambda x, y: "pale" if ("belly" in marks or "throat" in marks) and y > hcy + 0.3 * s else "coat", 4))
        if p["frill"]:
            parts.append(P(ellipse(hcx - p["head"] * s * 0.6, hcy, 0.8, p["frill"] * s), "far", 3))
        parts.append(P(ellipse(hcx + f * p["head"] * s * 0.15, hcy - p["head"] * s * 0.28, 0.5, 0.45), "eye", 6))
    parts.append(leg((hipx, by + bd * 0.55), ph + 0.5, False, 7))
    parts.append(leg((shx, front_y + bd * 0.55), ph, False, 7))
    return parts, W, H


# ================================================================================
# frog
# ================================================================================

def frog_draw(sp, pose, k):
    p = dict(size=1.0, marks=())
    p.update(sp.get("p", {}))
    s = p["size"] * 1.7
    G = H - 1.4
    marks = set(p["marks"])
    stretch, air, tilt = 0.0, 0.0, 0.45
    if pose == "trot":
        stretch, air, tilt = [(0.0, 0.0, 0.45), (0.6, 1.5, 0.15), (1.0, 4.0, 0.0), (0.4, 1.2, 0.3)][k]
    if pose == "sit":
        tilt = 0.25
    cx, cy = 19.0, G - 2.8 * s - air
    parts = []
    hip = (cx - 2.6 * s, cy + 0.8 * s)
    if stretch > 0.3:
        foot = (hip[0] - 4.0 * s * stretch - 1.0, hip[1] + 1.2 * s)
        parts.append(P(union(capsule(hip, (hip[0] - 2.5 * s * stretch, hip[1] + 0.8 * s), 1.2 * s, 0.7 * s),
                             capsule((hip[0] - 2.5 * s * stretch, hip[1] + 0.8 * s), foot, 0.6 * s, 0.4 * s)), "far", 0))
    body = ellipse(cx, cy, 3.6 * s, 2.3 * s, -tilt if stretch < 0.3 else 0.05)

    def role(x, y):
        rel = (y - cy) / (2.3 * s)
        if "belly" in marks and rel > 0.45:
            return "pale"
        if "spots" in marks and hsh(int(x * 1.1), int(y * 1.1), 4) < 0.2:
            return "dark"
        if "mask" in marks and abs(y - (cy - 1.0 * s)) < 0.6 and x > cx + 1.2 * s:
            return "dark"
        if "stripe" in marks and abs(rel + 0.5) < 0.18:
            return "pale"
        return "coat"
    parts.append(P(body, role, 2))
    hc = (cx + 3.0 * s, cy - 1.2 * s + (0.4 if stretch > 0.3 else 0))
    if pose == "look":
        parts.append(P(ellipse(cx + 2.2 * s, cy - 1.0 * s, 2.4 * s, 1.6 * s), role, 4))
        for g in (-1, 1):
            parts.append(P(ellipse(cx + 2.2 * s + g * 1.4 * s, cy - 2.2 * s, 0.75 * s, 0.7 * s), "coat", 5))
            parts.append(P(ellipse(cx + 2.2 * s + g * 1.4 * s, cy - 2.25 * s, 0.4 * s + 0.1, 0.38 * s + 0.1), "eye", 6))
    else:
        parts.append(P(ellipse(hc[0], hc[1], 2.0 * s, 1.4 * s, -0.15), role, 4))
        parts.append(P(ellipse(hc[0] - 0.2 * s, hc[1] - 1.2 * s, 0.8 * s, 0.7 * s), "coat", 5))
        parts.append(P(ellipse(hc[0] - 0.1 * s, hc[1] - 1.25 * s, 0.45 * s + 0.1, 0.42 * s + 0.1), "eye", 6))
        if pose == "back":
            parts.append(P(ellipse(hc[0] + 0.6 * s, hc[1] + 1.3 * s, 1.3 * s, 1.0 * s), "pale", 6))   # the vocal sac, calling
    # hind leg folded (or out), foreleg
    if stretch <= 0.3:
        parts.append(P(union(ellipse(hip[0] + 0.6 * s, hip[1] - 0.2, 1.9 * s, 1.4 * s),
                             capsule((hip[0] + 1.6 * s, G - 0.7), (hip[0] - 1.4 * s, G - 0.5), 0.6 * s, 0.4 * s)), role, 7))
    else:
        foot = (hip[0] - 4.2 * s * stretch, hip[1] + 1.4 * s)
        parts.append(P(union(capsule(hip, (hip[0] - 2.2 * s * stretch, hip[1] + 0.9 * s), 1.3 * s, 0.7 * s),
                             capsule((hip[0] - 2.2 * s * stretch, hip[1] + 0.9 * s), foot, 0.6 * s, 0.4 * s)), role, 7))
    arm0 = (cx + 1.8 * s, cy + 1.0 * s)
    parts.append(P(capsule(arm0, (arm0[0] + (1.6 if stretch > 0.3 else 0.8) * s, G - 0.6 - air * 0.6), 0.5 * s, 0.35 * s), "coat", 7))
    return parts, W, H


# ================================================================================
# crab
# ================================================================================

def crab_draw(sp, pose, k):
    p = dict(size=1.0, claw=1.0, marks=())
    p.update(sp.get("p", {}))
    s = p["size"] * 1.3
    G = H - 1.4
    cx, cy = 20.0, G - 3.2 * s
    parts = []
    for n in range(4):
        for g in (-1, 1):
            ph = (k / 4.0 + n * 0.25 + (0.5 if g < 0 else 0)) % 1.0 if pose == "trot" else 0.2
            j = (cx + g * 1.6 * s, cy + 0.3 * s)
            foot = (cx + g * (3.4 + n * 0.9) * s + math.sin(ph * 6.28) * 0.5 * s, G - 0.4 - max(0, math.sin(ph * 6.28)) * 0.6)
            knee = (cx + g * (2.6 + n * 0.8) * s, cy - 1.0 * s)
            parts.append(P(union(capsule(j, knee, 0.35 * s, 0.3 * s), capsule(knee, foot, 0.3 * s, 0.2 * s)), "far", 0 if n % 2 else 7))
    parts.append(P(ellipse(cx, cy, 3.0 * s, 1.7 * s), "coat", 2))
    big = 1.8 * p["claw"] * s
    raise_ = 2.5 * s if pose == "back" and k % 2 == 0 else (1.0 * s if pose == "back" else 0)
    parts.append(P(union(capsule((cx + 2.2 * s, cy - 0.3 * s), (cx + 3.6 * s, cy - 1.6 * s - raise_), 0.5 * s, 0.6 * s),
                         ellipse(cx + 4.0 * s, cy - 2.4 * s - raise_, big, big * 0.62, -0.5)), "pale" if "pale_claw" in p["marks"] else "coat", 6))
    parts.append(P(capsule((cx - 2.2 * s, cy - 0.3 * s), (cx - 3.0 * s, cy - 1.2 * s), 0.35 * s, 0.45 * s), "coat", 6))
    for g in (-1, 1):
        ex = cx + g * 0.9 * s
        top = cy - 2.6 * s - (0.8 * s if pose in ("look", "back") else 0)
        parts.append(P(capsule((ex, cy - 1.2 * s), (ex, top), 0.22, 0.2), "coat", 5))
        parts.append(P(ellipse(ex, top, 0.5, 0.45), "eye", 6))
    if pose == "sit":
        parts = [P(ellipse(cx, G - 1.6 * s, 3.2 * s, 1.5 * s), "coat", 2), P(ellipse(cx + 3.0 * s, G - 1.3 * s, big * 0.8, big * 0.5), "coat", 5)] + parts[-4:]
    return parts, W, H


# ================================================================================
# snake
# ================================================================================

def snake_draw(sp, pose, k):
    p = dict(size=1.0, thick=1.1, length=30.0, head=1.3, marks=(), hood=0.0)
    p.update(sp.get("p", {}))
    s = p["size"]
    G = H - 1.4
    marks = set(p["marks"])
    th = max(1.5, p["thick"] * s * 1.45)
    parts = []
    if pose == "sit":
        # coiled: rings stacked, the head resting on top
        for n in range(3):
            r = (3.8 - n * 1.0) * s
            parts.append(P(ellipse(20.0, G - th - n * th * 1.5, r + th, th + 0.2), "coat" if n % 2 == 0 else "far", 2 + n))
        hc = (21.5, G - th - 3 * th * 1.5)
        parts.append(P(ellipse(hc[0], hc[1], p["head"] * s * 1.3, p["head"] * s * 0.8), "coat", 6))
        parts.append(P(ellipse(hc[0] + 0.5 * s, hc[1] - 0.3, 0.45, 0.4), "eye", 7))
        return parts, W, H
    phase = k * math.pi / 2 if pose == "trot" else 0.4
    n = 26
    L = p["length"] * s
    pts = []
    x0 = 20.0 - L * 0.42
    raise_ = 0.0
    for i in range(n + 1):
        u = i / n
        x = x0 + u * L * 0.85
        amp = 2.2 * s * (0.4 + 0.6 * u)
        y = G - th - 0.2 + math.sin(u * 7.0 - phase) * amp * 0.55
        pts.append((x, y))
    head_up = 0.0
    if pose in ("back", "look", "stand"):
        head_up = {"stand": 1.6, "back": 5.5, "look": 4.5}[pose] * s
        hx, hy = pts[-1]
        pts += [(hx + 1.0 * s, hy - head_up * 0.6), (hx + 1.2 * s, hy - head_up)]
    body = path(pts, th * 0.6, th)

    def role(x, y):
        u = (x - x0) / L
        if "zigzag" in marks and abs(((x * 0.8) % 2.0) - 1.0) * 1.2 > abs(y - (G - th - 0.2 + math.sin(u * 7.0 - phase) * 2.2 * s * (0.4 + 0.6 * u) * 0.55) + th * 0.2) * 1.6 and y < G - th:
            return "dark"
        if "stripes" in marks and abs(y - (G - th - 0.2 + math.sin(u * 7.0 - phase) * 2.2 * s * (0.4 + 0.6 * u) * 0.55)) < 0.35:
            return "pale"
        if "bands" in marks:
            b = int(x / (1.5 * s)) % 4
            return "dark" if b == 0 else ("pale" if b == 2 else "coat")
        if "blotches" in marks and hsh(int(x / 1.4), 0, 6) < 0.5 and int(x * 1.2) % 3 != 0:
            return "dark"
        if "belly" in marks and y > G - th * 0.7:
            return "pale"
        return "coat"
    parts.append(P(body, role, 2))
    hx, hy = pts[-1]
    f = 1
    if pose == "back":
        f = -1
    if p["hood"] and pose in ("back", "look"):
        parts.append(P(ellipse(hx - 0.2 * s, hy + 1.8 * s, p["hood"] * s, 2.2 * s), "far", 3))
    if pose == "look":
        parts.append(P(ellipse(hx, hy, p["head"] * s, p["head"] * s * 1.1), "coat", 6))
        for g in (-1, 1):
            parts.append(P(ellipse(hx + g * p["head"] * s * 0.55, hy - 0.2, 0.42, 0.4), "eye", 7))
    else:
        parts.append(P(union(ellipse(hx + f * 0.6 * s, hy, p["head"] * s * 1.4, p["head"] * s * 0.85)), "coat", 6))
        parts.append(P(ellipse(hx + f * 1.1 * s, hy - 0.35 * s, 0.45, 0.42), "eye", 7))
    return parts, W, H


# ================================================================================
# insect: butterflies, beetles and ants, bees, locusts, moths
# ================================================================================

def insect_draw(sp, pose, k):
    p = dict(size=1.0, form="beetle", marks=(), glow=False, antenna=2.4)
    p.update(sp.get("p", {}))
    s = p["size"] * 2.3
    G = H - 1.4
    marks = set(p["marks"])
    form = p["form"]
    parts = []
    if form == "butterfly":
        flying = pose == "trot"
        cy = G - 3.6 * s if flying else G - 2.2 * s
        cx = 20.0
        a = [1.0, 0.72, 0.4, 0.72][k] if flying else {"stand": 1.0, "back": 0.55, "look": 0.8, "sit": 1.0}[pose]
        fw = 5.2 * s
        # wings: the far behind, the near in front, seen from the side as they open and close
        tip = (cx - 0.5 * s - fw * 0.35 * (1 - a), cy - fw * a - 0.6)
        hind = (cx - 1.6 * s, cy - fw * 0.55 * a + 0.4 * s)

        def wing_role(x, y):
            dd = math.hypot(x - cx, y - cy)
            if "eyespot" in marks and abs(dd - fw * 0.6) < 0.7 * s:
                return "pale"
            if "eyespot" in marks and abs(dd - fw * 0.6) < 1.2 * s:
                return "dark"
            if "tigerstripes" in marks and int((x - cx) * 1.1 + 20) % 3 == 0:
                return "dark"
            if "band" in marks and abs(dd - fw * 0.45) < 0.6 * s:
                return "pale"
            if "veins" in marks and (int(x * 1.2) + int(y * 1.2)) % 4 == 0:
                return "dark"
            if "border" in marks and dd > fw * 0.75:
                return "dark"
            return "coat"
        parts.append(P(union(triangle((cx, cy), (cx + 1.0 * s, cy - 0.4), tip), ellipse(hind[0], hind[1] - 0.4, 1.6 * s, max(0.6, fw * 0.4 * abs(a) + 0.4))), "far", 0))
        parts.append(P(capsule((cx - 2.0 * s, cy + 0.3), (cx + 1.6 * s, cy - 0.2), 0.5 * s, 0.6 * s), "dark", 2))
        parts.append(P(ellipse(cx + 2.0 * s, cy - 0.3, 0.75 * s, 0.7 * s), "dark", 3))
        parts.append(P(union(capsule((cx + 2.3 * s, cy - 0.8), (cx + 3.2 * s, cy - 3.2 * s), 0.2, 0.2), ellipse(cx + 3.2 * s, cy - 3.2 * s, 0.35, 0.35)), "dark", 3))
        if not flying:
            for n in range(3):
                parts.append(P(capsule((cx - 0.4 * s + n * 0.8 * s, cy + 0.3), (cx - 0.8 * s + n * 1.0 * s, G - 0.3), 0.18, 0.15), "dark", 1))
        tip2 = (cx + 0.6 * s - fw * 0.3 * (1 - a), cy - fw * a * 0.95 - 0.3)
        parts.append(P(union(triangle((cx + 0.4 * s, cy), (cx + 1.6 * s, cy - 0.3), tip2), ellipse(hind[0] + 0.6 * s, hind[1], 1.5 * s, max(0.6, fw * 0.38 * abs(a) + 0.4))), wing_role, 6))
        parts.append(P(ellipse(cx + 2.2 * s, cy - 0.5, 0.35, 0.3), "eye", 7))
        return parts, W, H
    flying = pose == "trot" and form in ("bee", "moth", "fly")
    cx = 20.0
    cy = G - 1.9 * s - (5.0 * s if flying else 0)
    leg_len = 1.6 * s if form != "locust" else 1.4 * s
    # legs: three a side, the tripod gait (alternating)
    if not flying:
        for n in range(3):
            for side in (0, 1):
                ph = (k / 4.0 + (0.5 if (n + side) % 2 else 0)) % 1 if pose == "trot" else 0.2
                j = (cx - 1.0 * s + n * 1.0 * s, cy + 0.4 * s)
                foot = (j[0] + (n - 1) * 1.1 * s + math.sin(ph * 6.28) * 0.6 * s, G - 0.3 - max(0, math.sin(ph * 6.28)) * 0.5)
                knee = (j[0] + (n - 1) * 0.6 * s, j[1] - 0.5 * s)
                if form == "locust" and n == 0:
                    knee = (j[0] - 1.0 * s, j[1] - 2.0 * s)
                    foot = (j[0] - 3.2 * s, G - 0.3)
                parts.append(P(union(capsule(j, knee, 0.22 * s, 0.2 * s), capsule(knee, foot, 0.2 * s, 0.15)), "far" if side == 0 else "dark", 0 if side == 0 else 7))
    seg = {"ant": (1.6, 1.0, 1.4), "beetle": (2.6, 1.0, 0.9), "bee": (2.0, 1.2, 1.0), "locust": (3.6, 1.3, 1.0), "moth": (2.6, 1.2, 1.0), "fly": (2.4, 1.1, 0.9)}.get(form, (2.4, 1.0, 1.0))
    ab = ellipse(cx - 1.8 * s, cy, seg[0] * s, (1.2 if form != "ant" else 1.0) * s)

    def ab_role(x, y):
        if p["glow"] and x < cx - 2.6 * s:
            return "eye"                        # the firefly's lamp
        if "stripes" in marks and int((x - cx) * 1.0 * s ** -1 + 20) % 2:
            return "dark"
        if "spots" in marks and hsh(int(x * 1.3), int(y * 1.3), 2) < 0.25:
            return "pale"
        return "coat"
    if form in ("bee", "moth", "fly", "locust", "cicada"):
        wa = [0.9, 0.1, -0.6, 0.1][k] if flying else 0.15
        wl = 3.4 * s
        parts.append(P(ellipse(cx - 0.6 * s - wl * 0.4 * math.cos(wa), cy - 1.0 * s - wl * 0.45 * math.sin(wa), wl * 0.62, 0.9 * s, wa * 0.8), "far", 1))
    parts.append(P(ab, ab_role, 2))
    parts.append(P(ellipse(cx + 0.6 * s, cy - 0.1, seg[1] * s, 0.95 * s), "coat" if form != "ant" else "far", 3))
    hc = (cx + (1.6 + seg[1]) * s * 0.9, cy - 0.2)
    if pose == "look":
        parts.append(P(ellipse(hc[0], hc[1], seg[2] * s, seg[2] * s), "coat", 4))
        for g in (-1, 1):
            parts.append(P(ellipse(hc[0] + g * 0.6 * s, hc[1] - 0.2, 0.42, 0.42), "eye", 6))
            parts.append(P(capsule((hc[0] + g * 0.4 * s, hc[1] - 0.8 * s), (hc[0] + g * 1.6 * s, hc[1] - p["antenna"] * s), 0.18, 0.15), "dark", 5))
    else:
        parts.append(P(ellipse(hc[0], hc[1], seg[2] * s, seg[2] * s * 0.85), "coat", 4))
        up = 1.0 if pose == "back" else 0.55
        parts.append(P(path([(hc[0] + 0.3 * s, hc[1] - 0.6 * s), (hc[0] + 1.4 * s, hc[1] - p["antenna"] * s * up), (hc[0] + 2.4 * s, hc[1] - p["antenna"] * s * up * 0.8)], 0.18, 0.15), "dark", 5))
        parts.append(P(ellipse(hc[0] + 0.3 * s, hc[1] - 0.15, 0.45, 0.42), "eye", 6))
        if form == "moth":
            parts.append(P(capsule((hc[0] + seg[2] * s * 0.8, hc[1] + 0.2), (hc[0] + 3.0 * s, hc[1] + 0.8 * s), 0.15, 0.12), "dark", 6))
    if form in ("bee", "moth", "fly", "locust", "cicada"):
        wa = [0.9, 0.1, -0.6, 0.1][k] if flying else 0.15
        wl = 3.4 * s
        parts.append(P(ellipse(cx - 0.2 * s - wl * 0.4 * math.cos(wa), cy - 0.9 * s - wl * 0.45 * math.sin(wa), wl * 0.6, 0.85 * s, wa * 0.8),
                       "pale" if form in ("bee", "fly", "cicada") else "coat", 5))
    if pose == "sit" and not flying:
        pass
    return parts, W, H


PLANS = {"quad": quad_draw, "hopper": hopper_draw, "bird": bird_draw, "lizard": lizard_draw,
         "frog": frog_draw, "crab": crab_draw, "snake": snake_draw, "insect": insect_draw}
POSES = [("trot", 0), ("trot", 1), ("trot", 2), ("trot", 3), ("stand", 0), ("back", 0), ("look", 0), ("sit", 0)]


def geometries(sp):
    """Every pose's geometry for a species, once: [(name, parts, cells, w, h)]."""
    draw = PLANS[sp["plan"]]
    out = []
    for name, k in POSES:
        parts, w, h = draw(sp, name, k)
        out.append((name, parts, geometry(parts, w, h), w, h))
    return out


def poses(geo, hand):
    """The poses as rows of letters, painted in a hand."""
    got = {}
    w = h = 0
    for name, parts, cells, w, h in geo:
        got.setdefault(name, []).append(paint(parts, cells, hand, w, h))
    return got, w, h
