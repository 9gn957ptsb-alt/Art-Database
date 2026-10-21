"""Anna's hummingbird (Calypte anna), facing right — after Helen Frankenthaler.

DIRT's backlog paired Frankenthaler with this bird: "Stacked fields: the gorget's colour soaks and floods as it
turns, the way her stain soaks the canvas." DIRT's roster gives her grammar 8, poured stains — soft marks that
flow one way (Mountains and Sea, 1952: thinned paint soaked into raw canvas, a wash's edge feathering into the
ground, never a line). So the hummingbird is laid in stains, not shaded: a rose that soaks out of the throat
into the bronze of the back along a soft dithered edge, a wash of grey that thins up the flank, and the wings
not drawn as feathers but stained across the air as the fans they make when they beat. Her inks from the roster
and from her saved works: the plum-brown (#6b4f55) for the wings, tail and bill, her gold (#e7bb4c) worked
toward the plum for the bronze of the back, her cream (#e8e1d8) for the dusky belly, and her terracotta
(#bd6c4b) worked toward the gorget's rose for the soak.

As an Anna's hummingbird is made (the English Wikipedia article as remembered, not re-read on 21 Oct 2026, when
Wikimedia answered 429 — check it: about 10 cm long and 4 g; bronze-green above,
dusky grey below with a greenish wash on the flanks; the male's crown and gorget iridescent rose-red, the
gorget's feathers flared at its sides; a short straight black bill; a dark tail; a white spot behind the eye;
the only North American hummingbird with a red crown): a small compact body held tilted when it hovers, a head
that is mostly the rose, a bill as long as the head, a tail as long as the body, long narrow wings. It hovers
(the wings beat so fast they show only as a stained fan), darts, backs away (the only bird that flies
backward: its pause), faces you with the gorget blazing, and perches on a twig with its wings folded and the gorget
dark: iridescence is structural colour, rose only where the light is where it is turned.

Drawn at 64 by 48 cells; the bird is about 40 cells long. Every pose has frames that play on the clock
(`moves.live`).

Letters: d R r g the back's bronze, deepest to lightest, g the dusky belly; W w the gorget, shaded and lit;
k K the black of the bill and the plum of the wings and tail; y the eye's glint; o p the chalk edge.
"""

import math

from draw import Part, bayer, capsule, ellipse, foot_at, limb, path, poly, raster, triangle, union

W, H = 64, 48
GROUND = 44.0
CELL = 1.5
RLE = True
DEEP = "d"


def hsh(i, j, s=0):
    n = (int(i) * 73856093) ^ (int(j) * 19349663) ^ (s * 83492791)
    n &= 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFFFF) % 1024 / 1024.0


def lit(f):
    return lambda *a: f


class Fr:
    """A frame laid on the bird: its origin, the axis it points along (up from the horizontal by `a` radians,
    toward the right or, mirrored, the left) and the side that is down."""

    def __init__(self, cx, cy, a, dirx=1):
        self.cx, self.cy, self.a, self.dirx = cx, cy, a, dirx
        self.d = (dirx * math.cos(a), -math.sin(a))
        self.n = (dirx * math.sin(a), math.cos(a))

    def pt(self, u, v):
        return (self.cx + u * self.d[0] + v * self.n[0], self.cy + u * self.d[1] + v * self.n[1])

    def uv(self, x, y):
        dx, dy = x - self.cx, y - self.cy
        return dx * self.d[0] + dy * self.d[1], dx * self.n[0] + dy * self.n[1]

    def ell(self, u, v, ru, rv):
        x, y = self.pt(u, v)
        return ellipse(x, y, ru, rv, math.atan2(self.d[1], self.d[0]))

    def cap(self, a, b, r0, r1=None):
        return capsule(self.pt(*a), self.pt(*b), r0, r1)

    def path(self, pts, r0, r1=None):
        return path([self.pt(*p) for p in pts], r0, r1)

    def poly(self, pts):
        return poly([self.pt(*p) for p in pts])

    def tri(self, a, b, c):
        return triangle(self.pt(*a), self.pt(*b), self.pt(*c))


# ---- the stain: a colour that soaks out of one part into the next, along a soft edge ---------------------------------

def soak(s, i, j, band=1.8):
    """Whether a cell is the stain's colour: s is how far past the stain's edge the cell lies (cells); within
    `band` either side the edge is a dither (a wash feathering into its ground), never a line."""
    t = s / band * 0.5 + 0.5
    return t > bayer(i, j)


def dithered(sdf, keep):
    """A field with holes, in blocks of two cells: a cell is kept where the Bayer matrix is under `keep` (a
    number, or a function of the cell's centre): a stained fan, a wash seen through. A cell's centre is constant
    inside it, so the picture's own gradient still works."""
    def d(x, y):
        k = keep(x, y) if callable(keep) else keep
        return sdf(x, y) if bayer(int(x) // 2, int(y) // 2) < k else 1.0
    return d


def rose(light, gleam):
    """The gorget's iridescence: lit rose where the light is where it is turned (gleam 1), dark where it is not
    (0), blazing all over when it faces you (2)."""
    if gleam >= 2.0:
        return "w" if light > 0.28 else "W"
    if gleam <= 0.0:
        return "W" if light < 0.74 else "R"
    return "w" if light > 0.52 else "W"


def back_paint(F, gleam=1.0):
    """The trunk: the bronze back (three steps by the light), the dusky belly, and the rose soaking back out of
    the throat along the body, its edge a feathered dither."""
    def paint(x, y, light, i, j):
        u, v = F.uv(x, y)
        edge = 6.4 - 0.55 * (v + 1.0) + 0.45 * math.sin(v * 0.9 + 0.8)
        if u - edge > -1.0 and soak(u - edge, i, j, 1.9):
            return rose(light, gleam)
        flank = 1.3 + 0.1 * u
        if (v > flank and soak(v - flank, i, j, 1.5)) or (u < -4.5 and v > -1.0):
            return "g" if light > 0.3 else "R"
        if light < 0.22:
            return "d"
        return "r" if light > 0.66 else "R"
    return paint


def head_paint(HF, gleam=1.0):
    """The head: the crown, the face and the chin all the rose; the nape behind it soaks back into bronze; a
    white spot behind the eye."""
    def paint(x, y, light, i, j):
        p, q = HF.uv(x, y)
        if -2.0 < p < -0.5 and -1.5 < q < -0.4:
            return "g"                                       # the white spot behind the eye
        edge = -2.4 + 0.4 * math.sin(q * 1.3) + 0.35 * q
        if p - edge < -1.3 or not soak(p - edge, i, j, 2.0):
            return "R" if light > 0.5 else "d"
        return rose(light, gleam)
    return paint


# ---- the wings, stained across the air -----------------------------------------------------------------------

def wing_sdf(sh, phi, L):
    p = math.radians(phi)
    dx, dy = math.cos(p), -math.sin(p)
    nx, ny = -dy, dx
    mid = (sh[0] + dx * L * 0.5 + nx * 1.5, sh[1] + dy * L * 0.5 + ny * 1.5)
    tip = (sh[0] + dx * L, sh[1] + dy * L)
    pts = [sh, (sh[0] + dx * L * 0.25 + nx * 0.7, sh[1] + dy * L * 0.25 + ny * 0.7), mid,
           (sh[0] + dx * L * 0.78 + nx * 1.1, sh[1] + dy * L * 0.78 + ny * 1.1), tip]
    rad = [2.4, 2.9, 2.2, 1.2, 0.45]
    parts = [capsule(pts[k], pts[k + 1], rad[k], rad[k + 1]) for k in range(4)]
    return (lambda x, y: min(f(x, y) for f in parts)), tip


def wing_paint(sh, phi, L):
    p = math.radians(phi)
    dx, dy = math.cos(p), -math.sin(p)

    def paint(x, y, light, i, j):
        t = ((x - sh[0]) * dx + (y - sh[1]) * dy) / L
        if t < 0.2:
            return "R" if light > 0.4 else "d"               # the coverts, the bronze of the back
        return "K" if (light > 0.45 or t < 0.45) else "k"
    return paint


def fan_part(sh, a0, a1, L):
    """The stain the stroke leaves: a wash of the plum between where the wing was and where it is, densest at the
    wing's edge and thinning back."""
    _, t0 = wing_sdf(sh, a0, L)
    _, t1 = wing_sdf(sh, a1, L)

    def keep(x, y):
        ang = math.degrees(math.atan2(-(y - sh[1]), x - sh[0]))
        f = max(0.0, min(1.0, (ang - a0) / (a1 - a0))) if a1 != a0 else 1.0
        return 0.12 + 0.62 * f * f
    part = Part(dithered(poly([sh, t0, t1]), keep), lit("K"), 8)
    part.noline = True
    return part


def wings(sh, phis, L=19.0, far_k=0.8, far_phi=None):
    """The pair: the far wing darker and a little behind, the near wing over the body, and the fan the stroke
    sweeps."""
    a0, a1 = phis
    parts = []
    far, _ = wing_sdf((sh[0] - 0.8, sh[1] - 0.8), a1 + 14 if far_phi is None else far_phi, L * far_k)
    fp = Part(far, lit("k"), 0)
    fp.noline = True
    parts.append(fp)
    if abs(a0 - a1) > 1:
        parts.append(fan_part(sh, a0, a1, L))
    near, _ = wing_sdf(sh, a1, L)
    parts.append(Part(near, wing_paint(sh, a1, L), 8))
    return parts


# ---- the bird --------------------------------------------------------------------------------------------------

def tail_part(F, spread=0.0, droop=0.17, L=11.4, base=-6.6):
    """The tail: dark plum, as long as the body, squared at the end, the outer feathers tipped pale."""
    s = 1.5 + 1.4 * spread
    e = 2.4 + 3.4 * spread
    T = Fr(*F.pt(base, 0.0), F.a + droop, F.dirx)
    pts = [(0.0, -s), (0.0, s), (-L, e), (-L - 0.7, 0.0), (-L, -e)]
    sdf = T.poly(pts)

    def paint(x, y, light, i, j):
        u, v = T.uv(x, y)
        if u < -L + 1.6 and abs(v) > e * 0.5:
            return "g"
        return "K" if light > 0.5 else "k"
    return Part(sdf, paint, 1)


def bill_part(hx, hy, bill_deg, dirx=1, L=8.0, tongue=0.0):
    b = math.radians(bill_deg)
    dx, dy = dirx * math.cos(b), -math.sin(b)
    x0, y0 = hx + dx * 3.7, hy + dy * 3.7
    x1, y1 = hx + dx * (3.7 + L), hy + dy * (3.7 + L)
    parts = [Part(capsule((x0, y0), (x1, y1), 0.8, 0.3), lambda x, y, l, i, j: "K" if l > 0.8 else "k", 6)]
    if tongue > 0:
        # the tongue: a thin rose line out of the bill's tip
        parts.append(Part(capsule((x1, y1), (x1 + dx * tongue * 3.0, y1 + dy * tongue * 3.0), 0.35, 0.25), lit("w"), 7))
    return parts


def bird(F, wing_phis, bill_deg=8.0, gleam=1.0, tail_spread=0.0, eye=1.0, head=None, head_dirx=1, feet=False,
         wings_on=True, droop=0.17, flare=1.0, folded=False, tongue=0.0, wing_len=19.0, far_phi=None, tail_L=11.4):
    """The whole bird, side on. F is the body's frame (its axis, tilted); the head is set at the end of it unless
    `head` puts it elsewhere (turned to look back); wing_phis the stroke (where it was, where it is); `folded`
    lays the wings along the back instead."""
    parts = []
    hx, hy = head if head else F.pt(10.4, -0.5)
    HF = Fr(hx, hy, math.radians(bill_deg), head_dirx)
    if wings_on and not folded:
        parts += wings(F.pt(2.2, -2.8), wing_phis, wing_len, far_phi=far_phi)
    parts.append(tail_part(F, tail_spread, droop, L=tail_L))
    body = union(F.path([(-7.2, -0.1), (-1.5, 0.1), (4.2, 0.6)], 1.9, 4.4), F.ell(4.0, 0.8, 5.0, 4.3))
    parts.append(Part(body, back_paint(F, gleam), 3))
    if folded:
        # perched: the wings folded along the back, their tips crossing at the base of the tail
        sh = F.pt(3.6, -2.9)
        tip = F.pt(-12.8, -0.9)
        wsdf = path([sh, F.pt(-4.0, -2.4), tip], 2.5, 0.5)

        def wp(x, y, light, i, j):
            u, v = F.uv(x, y)
            if u > 0.2:
                return "R" if light > 0.45 else "d"
            return "K" if light > 0.5 else "k"
        parts.append(Part(wsdf, wp, 8))
    # the gorget's flares, the feathers at its sides pointing back along the throat
    fl = F.tri((7.6, 2.0), (7.6 - 5.6 * flare, 2.0 + 3.8 * flare), (4.6, 2.4))
    parts.append(Part(fl, lambda x, y, l, i, j: rose(l, gleam), 3))
    if feet:
        parts += limb([Part(F.cap((-1.0, 3.4), (-1.4, 6.0), 0.42, 0.35), lit("k"), 2),
                       Part(F.cap((0.6, 3.6), (0.9, 6.0), 0.42, 0.35), lit("k"), 2)], "body")
    turn = math.atan2(-math.sin(math.radians(bill_deg)), head_dirx * math.cos(math.radians(bill_deg)))
    parts.append(Part(ellipse(hx, hy, 3.7, 3.4, turn), head_paint(HF, gleam), 3))
    parts += bill_part(hx, hy, bill_deg, head_dirx, tongue=tongue)
    ex, ey = HF.pt(0.4, -0.9)
    ex, ey = math.floor(ex) + 0.5, math.floor(ey) + 0.5
    if eye > 0.5:
        parts.append(Part(ellipse(ex, ey, 1.0, 0.95), lit("k"), 8))
        parts.append(Part(ellipse(ex - 0.35 * head_dirx, ey - 0.35, 0.3, 0.3), lit("y"), 9))
    else:
        parts.append(Part(capsule((ex - 0.9, ey + 0.2), (ex + 0.9, ey + 0.2), 0.42, 0.42), lit("k"), 8))
    return parts


# ---- the poses ----------------------------------------------------------------------------------------------------

STROKE = [(100, 125), (125, 85), (85, 45), (45, 85)]           # the wing's tip angle: where it was, where it is


def hover(k, **kw):
    F = Fr(26.0, 27.0, math.radians(38) + 0.03 * math.sin(k * 1.57))
    return bird(F, STROKE[k % 4], **kw)


def dart(k):
    F = Fr(30.0, 24.0, math.radians(14))
    return bird(F, [(115, 120), (120, 80), (80, 38), (38, 80)][k % 4], bill_deg=4.0, tail_spread=0.2, droop=0.08)


def back(k):
    """Backing away: the only bird that flies backward. The body upright, the wings level at the sides, swept
    back and forward in a horizontal figure of eight (so seen edge-on, a wide stained band), the head a little
    turned to the way it is going."""
    F = Fr(30.0, 27.0, math.radians(74) + 0.02 * math.sin(k * 1.57))
    return bird(F, [(175, 160), (160, 148), (148, 160), (160, 175)][k % 4], bill_deg=(22, 18, 24, 18)[k % 4], far_phi=26,
                wing_len=20.0)


def look(k):
    """Faces you: the head and its bill toward the viewer, the gorget blazing, the wings out either side as the
    two fans they make, the tail spread under."""
    cx = 32.0
    parts = []
    left = [(165, 150), (150, 128), (128, 150), (150, 165)][k % 4]
    for side, sh in ((-1, (cx - 4.2, 29.0)), (1, (cx + 4.2, 29.0))):
        a0, a1 = [(180 - a if side > 0 else a) for a in left]
        wing = Part(wing_sdf(sh, a1, 20.0)[0], wing_paint(sh, a1, 20.0), 8)
        parts += [fan_part(sh, a0, a1, 20.0), wing]
    tail = poly([(cx - 2.0, 36.0), (cx + 2.0, 36.0), (cx + 3.6, 45.0), (cx, 45.6), (cx - 3.6, 45.0)])
    parts.append(Part(tail, lambda x, y, l, i, j: "g" if y > 43.6 and abs(x - cx) > 1.8 else ("K" if l > 0.5 else "k"), 1))
    chest = ellipse(cx, 31.6, 5.4, 6.6)

    def chest_paint(x, y, light, i, j):
        if y < 28.2 and soak(28.2 - y, i, j, 1.9):
            return "w" if light > 0.3 else "W"
        # the flanks' bronze soaks in from the sides, over the dusky belly, a wash that thins toward the middle
        edge = 2.6 + 0.9 * math.sin(y * 0.8)
        if abs(x - cx) > edge and soak(abs(x - cx) - edge, i, j, 3.2):
            return "R" if light > 0.4 else "d"
        return "g" if light > 0.4 else "R"
    parts.append(Part(chest, chest_paint, 3))
    throat = ellipse(cx, 24.8, 5.6, 3.8)
    parts.append(Part(throat, lambda x, y, l, i, j: "w" if l > 0.3 else "W", 3))
    parts.append(Part(triangle((cx - 4.8, 24.0), (cx - 9.6, 30.6), (cx - 3.8, 28.4)), lambda x, y, l, i, j: "w" if l > 0.35 else "W", 3))
    parts.append(Part(triangle((cx + 4.8, 24.0), (cx + 9.6, 30.6), (cx + 3.8, 28.4)), lambda x, y, l, i, j: "w" if l > 0.35 else "W", 3))
    head = ellipse(cx, 17.4, 5.0, 4.6)
    parts.append(Part(head, lambda x, y, l, i, j: "w" if l > 0.3 or y < 16 else "W", 3))
    for sx in (-1, 1):
        ex = cx + sx * 3.0
        parts.append(Part(ellipse(ex, 16.4, 1.0, 1.0), lit("k"), 8))
        parts.append(Part(ellipse(ex - 0.3, 16.0, 0.3, 0.3), lit("y"), 9))
        parts.append(Part(ellipse(cx + sx * 4.6, 16.2, 0.6, 0.5), lit("g"), 8))
    parts.append(Part(capsule((cx, 20.2), (cx + 0.2, 25.8), 1.0, 0.35), lambda x, y, l, i, j: "K" if l > 0.8 else "k", 6))
    return parts


def sit(k):
    """Perched on a twig: upright, the wings folded to the tail, the gorget dark (the light is not where it is
    turned), the head up; every so often the head turns, the tail flicks, the eye shuts."""
    F = Fr(27.0, 25.0, math.radians(66))
    bill = (14, 14, 18, 26, 26, 18, 14, 14)[k % 8]
    droop = 0.05 + (0.2 if k % 8 == 5 else 0.0)
    parts = [Part(path([(4.0, 33.6), (30.0, 31.2), (60.0, 28.8)], 1.3, 1.0), lambda x, y, l, i, j: "K" if l > 0.5 else "k", 0)]
    parts.append(Part(capsule((44.0, 29.6), (47.6, 25.0), 0.6, 0.35), lit("k"), 0))
    parts += bird(F, (0, 0), bill_deg=bill, gleam=0.0, eye=0.0 if k % 8 == 6 else 1.0, folded=True, feet=True, droop=droop,
                  wings_on=False, flare=0.7)
    return parts


def dive(k):
    """The display dive: up on the wing, hanging at the top, then straight down head first with the tail spread,
    and out of it with the wings open."""
    if k == 0:
        return bird(Fr(26.0, 27.0, math.radians(72)), STROKE[1], bill_deg=30)
    if k == 1:
        return bird(Fr(28.0, 27.0, math.radians(58)), (100, 96), bill_deg=20, wing_len=17.0)
    if k == 2:
        return bird(Fr(31.0, 20.0, math.radians(-74)), (0, 0), bill_deg=-62, tail_spread=1.0, gleam=2.0, droop=0.0, folded=True)
    return bird(Fr(30.0, 27.0, math.radians(8)), (60, 105), bill_deg=-2, tail_spread=0.5, gleam=2.0)


def feed(k):
    """At a flower: hovering, the head down, the bill a little down, the tongue out and in."""
    F = Fr(25.0, 25.0, math.radians(32) + 0.03 * math.sin(k * 3.14))
    return bird(F, STROKE[(k * 2) % 4], bill_deg=-14, tongue=(0.0, 1.0)[k % 2], head=F.pt(10.2, 0.6))


def chase(k):
    return bird(Fr(26.0, 27.0, math.radians(52 - 14 * k)), STROKE[k * 2], bill_deg=(24, 4)[k], gleam=2.0, flare=1.3 - 0.3 * k,
                tail_spread=(0.8, 0.2)[k])


def shot(parts):
    return raster(parts, W, H, deep=DEEP)


def poses():
    return {
        "trot": [shot(dart(k)) for k in range(4)],
        "stand": [shot(hover(k)) for k in range(4)],
        "back": [shot(back(k)) for k in range(4)],
        "look": [shot(look(k)) for k in range(4)],
        "sit": [shot(sit(k)) for k in range(8)],
        # The ethogram (characters.json): its instinct (the display dive), its idle (feeding at a flower) and its
        # ritual (the territorial chase).
        "act": [shot(dive(k)) for k in range(4)],
        "play": [shot(feed(k)) for k in range(2)],
        "ritual": [shot(chase(k)) for k in range(2)],
    }


# ---- in three parts, for a chimera (scripts/characters/chimera.py) ---------------------------------------------
#
# In a chimera it is the bird held level, as it perches or shuffles along a twig (a hummingbird never walks: its
# feet are for perching and shuffling sideways): the body nearly horizontal, the tiny feet down to the ground
# line, the wings folded along the back, or beating, or flicked; the head, with its bill, the part that leads.

FRAME = (30.0, 34.0, math.radians(10))
SEAMS = {"neck": (36.1, 33.2), "hip": (24.9, 34.8)}
CHIMERA_SCALE = 1.12


def shuffle(F, p, near):
    """The two tiny feet, under the belly, down to the ground line; shuffling, they slide a cell or two."""
    parts = []
    for off, ph, g in ((-1.4, p + 0.5, 0), (0.8, p, 7)):
        hx, hy = F.pt(off, 3.4)
        fx, fy = foot_at(ph, hx, 1.3, 0.9, GROUND - 0.4, 0.6)
        parts.append(Part(capsule((hx, hy), (fx, fy - 0.3), 0.8, 0.6), lit("k"), g))
        parts.append(Part(capsule((fx - 0.8, fy - 0.3), (fx + 1.6, fy - 0.3), 0.55, 0.45), lit("k"), g))
    return limb(parts, "body")


def level(pose, k, slot):
    F = Fr(*FRAME)

    def B(phis, **kw):
        # as a chimera's hindquarters the wings are folded along the back (a beating wing would be cut at the hip's
        # fold and float, a tip with no wing)
        if slot == "hind":
            kw.pop("wing_len", None)
            kw["folded"] = True
            kw["tail_L"] = 7.0
            kw["tail_spread"] = min(kw.get("tail_spread", 0.0), 0.3)
        return bird(F, phis, **kw)
    legs = shuffle(F, 0.1, True)
    kw = dict(droop=0.06, wings_on=True, folded=True)
    drop = 0.0
    if pose == "walk":
        legs = shuffle(F, k / 6.0, True)
        kw = dict(droop=0.06, folded=False, wing_len=17.0)
        phis = STROKE[k % 4]
        return B(phis, bill_deg=8.0, **kw) + legs, 0.0
    if pose == "stand":
        if k == 1:
            return B((100, 112), bill_deg=14.0, droop=0.06, wing_len=15.0) + legs, 0.0
        if k == 2:
            return B((0, 0), bill_deg=26.0, droop=0.2, folded=True) + legs, 0.0
        return B((0, 0), bill_deg=8.0, droop=0.06, folded=True) + legs, 0.0
    if pose == "back":
        return B((0, 0), bill_deg=20.0, head_dirx=-1, head=F.pt(10.2, -0.6), droop=0.06, folded=True) + legs, 0.0
    if pose == "look":
        return B((0, 0), bill_deg=48.0, gleam=2.0, folded=True, droop=0.06) + legs, 0.0
    if pose == "rest":
        F2 = Fr(F.cx, F.cy + 3.0, F.a)
        return bird(F2, (0, 0), bill_deg=-6.0, eye=0.0, gleam=0.0, folded=True, droop=0.0, flare=0.5) + shuffle(F2, 0.1, True), 3.0
    if pose == "present":
        return B((100, 125), bill_deg=24.0, gleam=2.0, flare=1.5, tail_spread=0.7, wing_len=17.0) + legs, 0.0
    if pose == "act":
        # the display dive, level: up on the wing, the tail spread, the head down, the wings out
        return (B((100, 125), bill_deg=26.0, wing_len=17.0), B((100, 96), bill_deg=34.0, tail_spread=0.7, wing_len=15.0),
                B((0, 0), bill_deg=-30.0, tail_spread=1.0, gleam=2.0, folded=True, droop=0.0),
                B((60, 105), bill_deg=0.0, tail_spread=0.5, gleam=2.0, wing_len=17.0))[k] + legs, 0.0
    # ritual: the chase, the gorget flared and blazing
    return B(STROKE[k * 2], bill_deg=(24, 4)[k], gleam=2.0, flare=1.3, tail_spread=(0.8, 0.2)[k], wing_len=17.0) + legs, 0.0


def rig(pose, k=0, slot="body"):
    return level(pose, k, slot)


INKS = {"coat": ["#343326", "#6f6c3c", "#9c9456", "#cdc6b8"], "white": ["#a8485a", "#e5707a"],
        "black": ["#2f2428", "#6b4f55"], "eye": "#e7bb4c", "pen": ["#8a7f7c", "#bdb3aa"], "box": "#be5257"}
