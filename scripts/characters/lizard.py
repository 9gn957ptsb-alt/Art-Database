"""The ocellated lizard (Timon lepidus), side on, facing right — after Salvador Dalí.

DIRT's backlog paired Dalí with this lizard: "A horizon: the Catalan lizard
on Dalí's own scrub coast, still on a long flat ground." Dalí was born in
Figueres, in the Empordà, where the Pyrenees' last spur falls to the sea at
Cap de Creus; the ocellated lizard, Europe's largest, lives in the dry scrub,
stone walls and old olive groves of that coast (DIRT's grammar: Palearctic
Mediterranean scrub, "ocellated lizards"). DIRT's roster gives Dalí grammar
13, the composition after the shore at Cap de Creus in *The Persistence of
Memory* (1931): a landscape in bands, a horizon, its reflection, a fall of
flecks. So the lizard is laid in flat bands, not shaded: a back netted in
black, a flank where the blue eyes (the ocelli) fall in a row like flecks, a
pale belly; it stands on a long flat ground with a horizon under its feet,
and below the horizon the same bands upside down, broken by the water — its
reflection, a few rows, fading. His inks from the roster and from his saved
works: his dark (#383936) and near-black for the net, a grey-olive worked
from his grey-teal toward his ochre for the back, the gold of his saved works
(#c5af77) for the flank, the sand for the belly, the pale of his sky for the
ocelli.

As an ocellated lizard is made (Wikipedia: "a robust lizard with a serrated
collar … the male has a characteristic broad head … thick, strong legs, with
long, curved claws … green, overlaid with black stippling that may form a
bold pattern of interconnected rosettes … bright blue spots along the
flanks"; about two thirds of its length is tail): a long low body, a wedge of
a head with swollen cheeks, a thick neck, legs with the elbows out and long
toes, a tail that tapers to a whip. It scurries (diagonal pairs, the tail
swinging), stops and bobs up on its forelegs, turns its head to you, and lies
flat to bask.

Drawn at one CSS pixel a cell (100 by 40), as the red fox is: a lizard's
net, ocelli and toes want the finer grid.

Letters: d R r g the coat, deepest to lightest (the tail's bands and the
shade, the back, the flank, the lit ridge); w the belly and throat; W the
ocelli and the sky of the reflection; k K the net, the mouth, the claws; y
the eye; o p the outline.
"""

import math

from draw import Part, bayer, capsule, ellipse, foot_at, limb, path, raster, triangle, two_bone, union

W, H = 100, 40
GROUND = 29.0
CELL = 1
RLE = True


def hsh(i, j, s=0):
    n = (int(i) * 73856093) ^ (int(j) * 19349663) ^ (s * 83492791)
    n &= 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFFFF) % 1024 / 1024.0


HIP = (60.0, 20.6)          # where the hind legs hang from
SHO = (75.5, 20.2)          # and the forelegs
FOOT_Y = GROUND - 0.6       # the row a foot stands in
HEAD_K = 1.0                # a chimera's head is a little grown (rig, slot "head")
WHOLE_HEAD_K = 1.12         # and the whole animal's, a male's, a little broader than the base drawing
TAIL_K = 1.0                # a chimera's hindquarters have a shorter tail (rig, slot "hind")


def lit(f):
    return lambda *a: f


# ---- the net: black rosettes joined, over the back ------------------------------------------

def voronoi_edge(x, y, mesh, seed, width):
    """How near (x, y) is to the edge between two cells of a jittered grid: < width is the net's line."""
    gx, gy = int(math.floor(x / mesh)), int(math.floor(y / mesh))
    d1 = d2 = 1e9
    for a in range(-1, 2):
        for b in range(-1, 2):
            cx, cy = gx + a, gy + b
            px = (cx + 0.15 + 0.7 * hsh(cx, cy, seed)) * mesh
            py = (cy + 0.15 + 0.7 * hsh(cx, cy, seed + 1)) * mesh
            d = math.hypot(x - px, y - py)
            if d < d1:
                d1, d2 = d, d1
            elif d < d2:
                d2 = d
    return (d2 - d1) < width


def net(x, y, base="R", mesh=5.4, seed=3, width=1.15):
    """The back's black net: the lines between rosettes of the base colour."""
    return "k" if voronoi_edge(x, y, mesh, seed, width) else base


# ---- the body, painted in bands ---------------------------------------------------------------

OCELLI = [(71.0, 0.56), (66.6, 0.60), (62.4, 0.64), (58.4, 0.68), (54.6, 0.72)]      # x, how far down the flank (v)


def body_paint(top, bot):
    """The flat bands of the trunk, from the back to the belly: the back (olive, netted in black), the flank
    (ochre, the ocelli falling along it, each a little lower than the one before), the belly (sand)."""
    def paint(x, y, light, i, j):
        t, b = top(x), bot(x)
        v = (y - t) / max(1.0, b - t)
        if v >= 0.80:
            return "w"
        for ox, oy in OCELLI:
            cy = top(ox) + (bot(ox) - top(ox)) * oy
            r = math.hypot(x - ox, y - cy)
            if r < 1.05:
                return "W"
            if r < 1.85:
                return "k"
        if v >= 0.36:
            return "r"
        return net(x, y, mesh=6.2, width=0.85)
    return paint


def make_body(lift=0.0, front=0.0, hind=0.0, flat=0.0):
    yh = 18.7 - lift - hind + flat
    ys = 18.5 - lift - front + flat
    spine = path([(55.0, yh + 0.2), (66.0, (yh + ys) / 2 + 0.3), (79.0, ys + 0.2)], 3.7, 3.95)
    chest = ellipse(76.5, ys + 0.3, 6.4, 4.3)
    pelvis = ellipse(59.0, yh + 0.2, 6.2, 4.0)
    sdf = union(spine, chest, pelvis)

    def yc(x):
        t = max(0.0, min(1.0, (x - 59.0) / 17.5))
        return yh + 0.3 + (ys - yh) * t

    top = lambda x: yc(x) - 3.95
    bot = lambda x: yc(x) + 4.0
    return sdf, top, bot


# ---- the legs ------------------------------------------------------------------------------------

def foot_sdf(ankle, length):
    """The foot: a long toe along the ground and a shorter one under it, each ending in a claw."""
    fx, fy = ankle
    return union(capsule((fx, fy), (fx + length, min(fy + 0.1, FOOT_Y)), 1.0, 0.7),
                 capsule((fx + 0.5, fy + 0.5), (fx + length * 0.78, min(fy + 0.6, FOOT_Y + 0.3)), 0.8, 0.6))


def leg(joint, foot, l1, l2, bend, r0, r1, toe, group, far=False):
    knee = two_bone(joint, foot, l1, l2, bend)
    rm = (r0 + r1) / 2
    sdf = union(capsule(joint, knee, r0, rm + 0.3), capsule(knee, foot, rm + 0.2, r1), foot_sdf(foot, toe))
    tipx = foot[0] + toe

    def paint(x, y, light, i, j):
        if x > tipx - 1.4 and y > foot[1] - 0.8:
            return "k"                                           # the claws
        if far:
            return "d" if light < 0.8 else "K"
        if y > foot[1] - 0.9:
            return "d"                                           # the hand or foot, in shade
        if light < 0.3:
            return "d"
        return "r" if light > 0.74 else "R"
    part = Part(sdf, paint, group)
    if far:
        part.noline = True                                       # a far leg is shadow: no chalk round it
    return part


def legs(feet, lift=0.0, front=0.0, hind=0.0, flat=0.0, fold=1.0):
    """feet: {'nf': (x, y), 'ff': ..., 'nh': ..., 'fh': ...}: the ankle or wrist of each leg; fold shortens
    the bones (a lizard lying flat has its legs folded under it)."""
    sh = (SHO[0], SHO[1] - lift - front + flat)
    hp = (HIP[0], HIP[1] - lift - hind + flat)
    a, b = 6.0 * fold, 7.4 * fold
    far = [leg((sh[0] + 1.6, sh[1]), feet["ff"], a, a + 0.1, -1, 2.3, 1.3, 5.2, 0, far=True),
           leg((hp[0] + 1.6, hp[1]), feet["fh"], b, b + 0.1, 1, 2.9, 1.4, 6.2, 0, far=True)]
    near = [leg(hp, feet["nh"], b, b + 0.1, 1, 3.5, 1.6, 6.6, 7),
            leg(sh, feet["nf"], a, a + 0.1, -1, 2.9, 1.5, 5.6, 7)]
    limb(far[:1], "body"), limb(far[1:], "hind"), limb(near[:1], "hind"), limb(near[1:], "body")
    return far, near


def stand_feet():
    return {"nf": (77.5, FOOT_Y), "ff": (73.0, FOOT_Y), "nh": (55.5, FOOT_Y), "fh": (60.5, FOOT_Y)}


def gait_feet(p, hind=5.4, fore=4.6, duty=0.58, up=3.0):
    """A trot: diagonal pairs (near hind with far fore, near fore with far hind)."""
    def foot(ph, x0, r):
        fx, fy = foot_at(ph, x0, r, up, FOOT_Y, duty)
        return (fx, fy)
    return {"nh": foot(p, 58.0, hind), "ff": foot(p, 71.5, fore),
            "nf": foot(p + 0.5, 77.0, fore), "fh": foot(p + 0.5, 63.0, hind)}


# ---- the tail ---------------------------------------------------------------------------------------

def tail_parts(wave=0.0, lift=0.0, hind=0.0, flat=0.0, curl=0.0):
    yh = 18.9 - lift - hind + flat
    pts = [(60.0, yh + 0.4), (49.0, yh + 1.8 + 0.6 * wave), (39.0, 24.6 + 1.0 * wave - 0.7 * flat), (29.0, 26.9 - 0.4 * wave),
           (19.0, 27.4 - 1.8 * wave + 0.8 * flat), (10.0, 26.0 - 2.6 * wave - 1.2 * curl), (4.0, 22.6 - 3.4 * wave - 3.0 * curl)]
    if flat:
        # basking: the tail lies along the ground, a continuation of the flat body, not a ramp up to it
        pts = [pts[0], (49.0, 25.8 + 0.4 * wave), (39.0, 26.5), (29.0, 27.0), (19.0, 27.1), (10.0, 26.8), (4.0, 26.2 - 0.8 * curl)]
    if TAIL_K < 1.0:
        # a chimera's hindquarters: the same tail, cut shorter toward the hip so it does not run the picture's length
        pts = [(60.0 + (x - 60.0) * TAIL_K, y) for x, y in pts]
    sdf = path(pts, 4.3, 0.5)

    def paint(x, y, light, i, j):
        if int((x + 40) / 5.0) % 2 == 0 and light < 0.85:
            return "d"
        if voronoi_edge(x, y, 5.0, 11, 0.8):
            return "k"
        return "r" if light > 0.82 else "R"
    return [Part(sdf, paint, 1)]


# ---- the head -----------------------------------------------------------------------------------------

def mouth_wedge(hx, hy, mouth, K):
    """The open mouth: a dark wedge between the upper jaw's line and the lower jaw's, widest at the front."""
    return triangle((hx + 0.5, hy + 2.7 * K), (hx + 6.6 * K, hy + 2.5 * K), (hx + 6.4 * K, hy + 2.5 * K + mouth))


def head_parts(hx=86.2, hy=17.0, mouth=0.0, front=False, lid=False, tongue=0.0):
    K = HEAD_K
    if front:
        cx, hy, K = 85.0, hy - 1.0, K * 1.22
        skull = union(ellipse(cx, hy, 5.9 * K, 4.4 * K), ellipse(cx, hy + 2.9 * K, 3.5 * K, 2.7 * K),
                      ellipse(cx - 4.3 * K, hy + 1.7 * K, 1.9 * K, 2.2 * K), ellipse(cx + 4.3 * K, hy + 1.7 * K, 1.9 * K, 2.2 * K))

        def paint(x, y, light, i, j):
            if y > hy + 4.6 * K and abs(x - cx) < 3.2 * K:
                return "w"
            if y > hy + 1.2 * K or abs(x - cx) > 3.5 * K and y > hy + 0.6 * K:
                return "r"
            if voronoi_edge(x, y, 4.6, 4, 0.85):
                return "k"
            return "R"
        e = 3.5 * K
        return [Part(skull, paint, 4),
                Part(union(ellipse(cx - e, hy - 1.3 * K, 1.8, 1.8), ellipse(cx + e, hy - 1.3 * K, 1.8, 1.8)), lit("k"), 5),
                Part(union(ellipse(cx - e, hy - 1.3 * K, 1.05, 1.05), ellipse(cx + e, hy - 1.3 * K, 1.05, 1.05)), lit("y"), 6),
                Part(union(ellipse(cx - 1.1, hy + 2.4 * K, 0.55, 0.5), ellipse(cx + 1.1, hy + 2.4 * K, 0.55, 0.5)), lit("k"), 6),
                Part(capsule((cx - 3.0 * K, hy + 4.9 * K), (cx + 3.0 * K, hy + 4.9 * K), 0.5, 0.5), lit("k"), 6)]
    skull = union(ellipse(hx - 0.2, hy, 5.3 * K, 4.3 * K), capsule((hx + 1.6, hy + 0.4), (hx + 6.0 * K, hy + 1.2), 2.9 * K, 1.9 * K),
                  capsule((hx - 2.4, hy + 2.8 * K), (hx + 5.4 * K, hy + 2.9 * K + mouth), 1.9 * K, 1.2 * K))
    ym = lambda x: hy + 2.6 * K + mouth * max(0.0, (x - hx + 3.0) / 9.0)      # the mouth's line

    def paint(x, y, light, i, j):
        if y > ym(x) + 0.4:
            return "w"
        if light > 0.8 and y < hy - 2.8 * K:
            return "r"
        if voronoi_edge(x, y, 5.0, 4, 0.9) and y < hy - 1.6:
            return "k"
        if y > hy - 0.6 and x < hx + 4.6 * K:
            return "r" if not voronoi_edge(x, y, 3.4, 8, 0.6) else "R"          # the cheek, ochre, flecked
        return "R"
    parts = [Part(skull, paint, 4),
             Part(capsule((hx - 1.2, hy + 2.7 * K), (hx + 6.6 * K, hy + 2.5 * K + mouth), 0.5, 0.45), lit("k"), 6),
             Part(ellipse(hx + 6.8 * K, hy + 0.1, 0.6, 0.55), lit("k"), 6),                    # the nostril
             Part(ellipse(hx - 3.4, hy + 0.5, 0.7, 1.1), lit("k"), 6)]                          # the ear
    if mouth > 1.2:
        parts.append(Part(mouth_wedge(hx, hy, mouth, K), lit("k"), 6))
    if tongue:
        # the forked tongue, tasting the air: out of the mouth's front, a fork at its tip
        tx0, ty = hx + 6.6 * K, hy + 2.6 * K + mouth * 0.7
        parts.append(Part(union(capsule((tx0, ty), (tx0 + 5.0 * tongue, ty - 0.3), 0.55, 0.45),
                                capsule((tx0 + 4.6 * tongue, ty - 0.3), (tx0 + 6.2 * tongue, ty - 1.4), 0.4, 0.35),
                                capsule((tx0 + 4.6 * tongue, ty - 0.3), (tx0 + 6.2 * tongue, ty + 0.9), 0.4, 0.35)), lit("k"), 6))
    if lid:
        parts += [Part(capsule((hx + 0.6, hy - 1.4), (hx + 3.0, hy - 1.4), 0.55, 0.55), lit("k"), 6)]
    else:
        parts += [Part(ellipse(hx + 2.0, hy - 1.4, 1.65, 1.65), lit("k"), 5),
                  Part(ellipse(hx + 2.0, hy - 1.4, 0.95, 0.95), lit("y"), 6)]
    return parts


def neck(a, b):
    k = 1 + (HEAD_K - 1) * 0.6

    def paint(x, y, light, i, j):
        if y > b[1] + 2.6 and x > 81.0:
            return "w"
        if voronoi_edge(x, y, 5.0, 6, 0.9):
            return "k"
        return "g" if light > 0.86 else "R"
    return Part(capsule(a, b, 4.5 * k, 4.0 * k), paint, 3)


# ---- the poses -----------------------------------------------------------------------------------------------

def figure(feet=None, lift=0.0, front=0.0, hind=0.0, flat=0.0, wave=0.0, head_up=0.0, mouth=0.0, front_on=False, lid=False,
           curl=0.0, fold=1.0, tongue=0.0):
    sdf, top, bot = make_body(lift, front, hind, flat)
    far, near = legs(feet or stand_feet(), lift, front, hind, flat, fold)
    body = Part(sdf, body_paint(top, bot), 2)
    ys = 18.5 - lift - front + flat
    nk = neck((79.5, ys - 0.2), (83.4, ys - 1.4 - head_up * 0.55))
    head = head_parts(hx=86.2, hy=ys - 2.3 - head_up, mouth=mouth, front=front_on, lid=lid, tongue=tongue)
    return far + tail_parts(wave, lift, hind, flat, curl) + [body, nk] + head + near


PUSH = {"nf": (77.0, FOOT_Y), "ff": (73.0, FOOT_Y), "nh": (55.5, FOOT_Y), "fh": (60.5, FOOT_Y)}
BASK = {"nf": (80.5, FOOT_Y), "ff": (75.5, FOOT_Y), "nh": (56.0, FOOT_Y), "fh": (63.0, FOOT_Y)}
ACT = ((2.0, 1.5, 0.0), (4.0, 3.0, 2.4), (5.0, 4.0, 3.4), (4.0, 3.0, 1.4))       # front lifted, head up, mouth
RITUAL = ((3.0, 2.0, 3.4), (2.0, -1.0, 2.2))                                       # the gape, then the bite


def basking(**kw):
    return figure(flat=4.8, lid=True, feet=BASK, fold=0.62, **kw)


def reflect(rows, depth=9):
    """Below the horizon, the same bands upside down, broken by the water: the figure's lowest rows mirrored
    about the ground line, each smeared into dashes and shifted a cell as ripples take it, the nearest dark (the
    shore's band) and, further down, the pale of the sky, fading to nothing by a regular dither."""
    out = [list(r) for r in rows]
    g = int(GROUND)
    w = len(rows[0])
    for d in range(depth):
        src, dst = g - 1 - d, g + d
        if src < 0 or dst >= len(rows):
            break
        keep = (0.75, 0.7, 0.62, 0.55, 0.46, 0.36, 0.26, 0.16, 0.08)[d]
        shift = (0, 1, -1, 1, 0, -1, 1, 0, -1)[d]
        tone = "d" if d < 1 else "R" if d < 3 else "W"
        for i in range(w):
            ch = rows[src][i]
            ch2 = rows[src][i - 1] if i else "."
            if (ch == "." or ch in "op") and (ch2 == "." or ch2 in "op"):
                continue
            if keep < bayer(i + shift, d):
                continue
            ii = i + shift
            if 0 <= ii < w and out[dst][ii] == ".":
                out[dst][ii] = tone
    return ["".join(r) for r in out]


def shot(parts):
    return reflect(raster(parts, W, H, deep="d"))


def poses():
    global HEAD_K
    HEAD_K = WHOLE_HEAD_K          # the whole animal is a male: the broad head, swollen at the cheeks
    try:
        return {
            "trot": [shot(figure(feet=gait_feet(p), lift=(0.6 if p in (0.25, 0.75) else 0.0), wave=math.sin(p * 6.283)))
                     for p in (0.0, 0.25, 0.5, 0.75)],
            "stand": [shot(figure())],
            "back": [shot(figure(front=5.0, head_up=4.0, feet=PUSH))],
            "look": [shot(figure(front_on=True))],
            "sit": [shot(basking())],
            # The ethogram (characters.json): its instinct (a male holding his ground: up on his forelegs, the mouth
            # open), its idle (the tongue tasting the air) and its ritual (the gape, the bite).
            "act": [shot(figure(front=f, head_up=h, mouth=m, feet=PUSH)) for f, h, m in ACT],
            "play": [shot(figure(tongue=t)) for t in (0.0, 1.0)],
            "ritual": [shot(figure(front=f, head_up=h, mouth=m, feet=PUSH)) for f, h, m in RITUAL],
        }
    finally:
        HEAD_K = 1.0


# ---- in three parts, for a chimera (scripts/characters/chimera.py) ---------------

SEAMS = {"neck": (80.5, 18.4), "hip": (62.0, 18.6)}
CHIMERA_SCALE = 0.78
CHIMERA_SLOT_K = {}


def rig(pose, k=0, slot="body"):
    global HEAD_K, TAIL_K
    HEAD_K = 1.2 if slot == "head" else 1.0
    TAIL_K = 0.55 if slot == "hind" else 1.0
    try:
        return rig_(pose, k)
    finally:
        HEAD_K, TAIL_K = 1.0, 1.0


def rig_(pose, k=0):
    if pose == "act":
        f, h, m = ACT[k]
        return figure(front=f, head_up=h, mouth=m, feet=PUSH), 0.0
    if pose == "ritual":
        f, h, m = RITUAL[k]
        return figure(front=f, head_up=h, mouth=m, feet=PUSH), 0.0
    if pose == "walk":
        p = k / 6.0
        return figure(feet=gait_feet(p), lift=(0.6 if k in (1, 4) else 0.0), wave=math.sin(p * 6.283)), 0.0
    if pose == "stand":
        return (figure(), figure(front=0.8, head_up=0.6), figure(tongue=1.0))[k], 0.0
    if pose == "back":
        return figure(front=5.0, head_up=4.0, feet=PUSH), 0.0
    if pose == "look":
        return figure(front_on=True), 0.0
    if pose == "rest":
        return basking(), 4.8
    return figure(front=4.0, head_up=3.0, curl=1.0, feet=PUSH), 0.0


INKS = {"coat": ["#454a38", "#8b9468", "#c5af77", "#e0d8cd"], "white": ["#a9c1cf", "#d6ccb0"],
        "black": ["#141413", "#393a38"], "eye": "#e6c970", "pen": ["#8f8c80", "#2b2a25"], "box": "#c5af77"}
