"""The common eastern firefly (Photinus pyralis), facing right — after Paul Caponigro.

DIRT's backlog paired Caponigro with fireflies: "Dots: points of light in the dark, as his silver prints hold light."
DIRT's roster gives him grammar 2, dots (spacing, size): small marks on bare ground (dirt/artists/roster.py, from his
saved works: the dark #161515, a charcoal #454444, a near-white #f1f1f1, a warm dark #2e1d1c). So the firefly is a
dark beetle drawn in the grain of a silver print, and its lantern is laid in dots: where the light is it is a halftone,
a screen of points that are large and close at the lamp and thin out into the dark, never an edge (`bloom`).

As a Photinus pyralis is made (English Wikipedia, "Photinus pyralis", read on 23 Oct 2026): a small soft-bodied
beetle 9 to 19 mm long, a flat black or brown body whose wing covers (elytra) run the length of the thorax and
abdomen and have a yellow border; the head shield (pronotum) pale yellow with a black dot in the centre surrounded
by pink or red; a light organ on the underside of the abdomen, along the last three segments in a male; nocturnal.
The male patrols in flight in a J, lighting on the upswing, every 5 to 7 seconds, "flying in a nearly vertical
orientation, their antennae held forward and stiff while their legs are held toward the body"; a female waits on the
vegetation and answers one to two seconds after his flash, twisting her abdomen toward it.

Drawn fine, as the fox and the lizard are: 96 by 64 cells at one CSS pixel a cell; the beetle is about 66 cells long.
Every pose is of 24 frames that play on the clock (`moves.live`: the page counts frames modulo 24), so a flash comes
once in a cycle: the wings and the antennae go round in the frames, the lamp goes up and down over all 24.

Letters: d R r the elytra's black-brown, deepest to lightest, g the yellow border, the pale of the lantern unlit and
the dots round it lit; W w the pronotum's pink and its pale yellow; k K the black of the eyes, the dot and the
underside; y the light of the lantern; o p the chalk edge.
"""

import math

from draw import Part, bayer, capsule, ellipse, foot_at, limb, path, poly, raster, triangle, two_bone, union

W, H = 96, 64
GROUND = 58.0
CELL = 1
RLE = True
DEEP = "d"
CYCLE = 24                                      # frames in a pose: the page counts modulo 24
K = 1.65                                        # cells to a unit of the frame below (the beetle is 40 units long)


def hsh(i, j, s=0):
    n = (int(i) * 73856093) ^ (int(j) * 19349663) ^ (s * 83492791)
    n &= 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFFFF) % 1024 / 1024.0


def lit(f):
    return lambda *a: f


class Fr:
    """A frame laid on the beetle: its origin (in cells), the axis it points along (up from the horizontal by `a`
    radians) and the side that is down. u runs forward along the body, v down, in units of K cells."""

    def __init__(self, cx, cy, a=0.0, dirx=1):
        self.cx, self.cy, self.a, self.dirx = cx, cy, a, dirx
        self.d = (dirx * math.cos(a), -math.sin(a))
        self.n = (dirx * math.sin(a), math.cos(a))

    def pt(self, u, v):
        return (self.cx + K * (u * self.d[0] + v * self.n[0]), self.cy + K * (u * self.d[1] + v * self.n[1]))

    def uv(self, x, y):
        dx, dy = (x - self.cx) / K, (y - self.cy) / K
        return dx * self.d[0] + dy * self.d[1], dx * self.n[0] + dy * self.n[1]

    def ell(self, u, v, ru, rv, turn=0.0):
        """An ellipse at (u, v) of the frame, its long axis turned by `turn` (counter-clockwise on the page for a
        positive turn, so the rear of a body pointing right goes up)."""
        x, y = self.pt(u, v)
        ax = (math.cos(turn) * self.d[0] + math.sin(turn) * self.n[0], math.cos(turn) * self.d[1] + math.sin(turn) * self.n[1])
        return ellipse(x, y, ru * K, rv * K, math.atan2(ax[1], ax[0]))

    def cap(self, a, b, r0, r1=None):
        return capsule(self.pt(*a), self.pt(*b), r0 * K, (r0 if r1 is None else r1) * K)

    def path(self, pts, r0, r1=None):
        return path([self.pt(*p) for p in pts], r0 * K, (r0 if r1 is None else r1) * K)

    def poly(self, pts, round_=0.0):
        f = poly([self.pt(*p) for p in pts])
        if round_:
            return lambda x, y: f(x, y) - round_ * K
        return f


def rot(p, about, th):
    """A point of the frame turned about another, so that a positive angle lifts what lies behind it."""
    x, y = p[0] - about[0], p[1] - about[1]
    return (about[0] + x * math.cos(th) - y * math.sin(th), about[1] + x * math.sin(th) + y * math.cos(th))


# ---- the lamp: a halftone of points that thin out into the dark ----------------------------------------------------

LAMP = [0.0] * CYCLE
for _k, _v in zip(range(10, 17), (0.3, 0.75, 1.0, 1.0, 0.8, 0.45, 0.2)):
    LAMP[_k] = _v                                  # one flash in a cycle: up, held, down


def halo(at, level, reach=21.0):
    """The lamp's light, as a halftone: round the point `at` a cell is lit where the light that reaches it beats the
    Bayer screen (so the points are close at the lamp and fall away to nothing), the lightest letter near it, the
    pale one further out. A part with no edge of its own, laid under the beetle, which keeps its own."""
    if level <= 0.05:
        return []
    R = reach * (0.55 + 0.45 * level)

    def light_at_(x, y):
        d = math.hypot(x - at[0], (y - at[1]) * 1.1)
        return (0.0 if d > R else (1.0 - d / R) ** 1.4 * level * 1.25), d

    def sdf(x, y):
        t, _ = light_at_(x, y)
        return -1.0 if t > bayer(int(x), int(y)) + 0.04 else 1.0

    def paint(x, y, light, i, j):
        t, d = light_at_(x, y)
        return "y" if (t > 0.62 and d < 6.0) else "g"
    part = Part(sdf, paint, 99)
    part.noline = True
    return [part]


# ---- the parts ---------------------------------------------------------------------------------------------------------

HINGE = (7.0, -4.2)                              # the shoulder: where the wing covers and the flying wings turn


def elytra_paint(F, th=0.0):
    """The wing covers: black-brown with a grain (a silver print's), faint ridges along them, and the yellow border
    along the lower edge and round the tip."""
    def paint(x, y, light, i, j):
        u, v = F.uv(x, y)
        if th:
            u, v = rot((u, v), HINGE, -th)
        v0 = v + 0.9
        if v0 > 2.35 or u < -17.0:
            return "g" if light > 0.3 else "r"
        k = (hsh(i, j, 5) - 0.5) * 0.55 + light
        if abs(v0 - 0.4) < 0.34 or abs(v0 + 1.3) < 0.3:
            k -= 0.3                                       # a ridge
        if v0 < -2.9 and light > 0.62:
            k += 0.25                                      # the sheen along the back
        if light > 0.7 and hsh(i, j, 9) < 0.07:
            return "g"                                     # a speck of silver, as a print's highlight
        return "d" if k < 0.3 else ("R" if k < 0.7 else "r")
    return paint


def pronotum_paint(F):
    """The head shield seen from the side: pale yellow at its edge, pink inside, the black dot high in its middle."""
    def paint(x, y, light, i, j):
        u, v = F.uv(x, y)
        if math.hypot((u - 11.4) * 0.9, (v + 3.5) * 1.6) < 1.5:
            return "k"
        edge = min(abs(v + 5.2), abs(u - 17.6) * 0.8, abs(u - 5.4) * 0.8)
        if v > -0.2 or edge < 0.95 or u > 16.8:
            return "w" if light > 0.3 else "W"
        return "W" if light < 0.78 or hsh(i, j, 3) < 0.7 else "w"
    return paint


def abdomen_paint(F, level):
    """The underside of the abdomen: segments, and along the last three the light organ."""
    def paint(x, y, light, i, j):
        u, v = F.uv(x, y)
        seam = ((u + 20.0) / 2.9) % 1.0 < 0.16 and (i + j) % 2 == 0
        if u < -8.3 and v > 2.4:
            if seam:
                return "r" if level < 0.6 else "g"          # the segments' joints, a dither of the dark unlit, paler in the flash
            return "y" if level > 0.3 else "g"
        return ("K" if int((u + 20.0) / 2.9) % 2 else "k") if light > 0.35 else "k"
    return paint


def beetle_body(F, lamp=0.0, raise_=0.0, antenna=None, head_dip=0.0, twist=0.0):
    """The body without its legs or wings: the abdomen with its lantern, the thorax, the elytra, the pronotum, the
    head with its eye and the antennae. `raise_` lifts the wing covers from the shoulder; `twist` turns the abdomen
    down (the female's)."""
    parts = []
    parts.append(Part(F.ell(-9.5, 3.2 + twist, 8.8, 2.1, 0.0), abdomen_paint(F, lamp), 2))
    parts.append(Part(F.ell(7.0, 3.0, 8.4, 2.3), lambda x, y, l, i, j: "K" if l > 0.5 else "k", 2))
    c = rot((-5.5, -0.9), HINGE, raise_)
    parts.append(Part(F.ell(c[0], c[1], 12.8, 3.5, raise_ - 0.02), elytra_paint(F, raise_), 4))
    hood = F.poly([(7.6, -3.3), (13.0, -3.6), (15.6, -2.0), (14.6, -0.4), (10.6, 0.3), (7.6, -0.2)], 2.3)
    parts.append(Part(hood, pronotum_paint(F), 5))
    hy = 2.5 + head_dip
    parts.append(Part(F.ell(17.4, hy, 2.6, 2.4), lambda x, y, l, i, j: "K" if l > 0.5 else "k", 3))
    ex, ey = F.pt(18.1, hy - 0.1)
    ex, ey = math.floor(ex) + 0.5, math.floor(ey) + 0.5
    parts.append(Part(ellipse(ex, ey, 3.0, 2.9), lit("k"), 8))
    parts.append(Part(ellipse(ex - 1.2 * F.dirx, ey - 1.2, 0.8, 0.8), lit("w"), 9))
    a0, a1 = antenna if antenna else (-0.30, -0.22)
    base = (19.8, hy - 1.4)
    mid = (base[0] + 5.2 * math.cos(a0), base[1] + 5.2 * math.sin(a0))
    tip = (mid[0] + 4.8 * math.cos(a1), mid[1] + 4.8 * math.sin(a1))
    ant = Part(F.path([base, mid, tip], 0.46, 0.32), lit("r"), 3)
    ant.noline = True
    parts.append(ant)
    return parts


def hindwing(F, th, th2, L=26.0):
    """The flying wing: a long narrow membrane from the shoulder beyond the wing cover's tip, and the fan its
    beat sweeps (a wash dithered in blocks of two cells, thinning back)."""
    parts = []
    tip0 = rot((HINGE[0] - L, HINGE[1]), HINGE, th)
    tip1 = rot((HINGE[0] - L, HINGE[1]), HINGE, th2)
    fan = poly([F.pt(*HINGE), F.pt(*tip0), F.pt(*tip1)])

    def fd(x, y):
        return fan(x, y) if bayer(int(x) // 2, int(y) // 2) < 0.34 else 1.0
    part = Part(fd, lit("R"), 1)
    part.noline = True
    parts.append(part)
    c = rot((HINGE[0] - L / 2, HINGE[1]), HINGE, th2)
    parts.append(Part(F.ell(c[0], c[1], L / 2, 1.1, th2), lambda x, y, l, i, j: "r" if l > 0.55 else "R", 1))
    return parts


def shot(parts):
    return raster(parts, W, H, deep=DEEP)


# ---- legs ----------------------------------------------------------------------------------------------------------------

HIPS = (13.0, 5.0, -3.0)                      # the three pairs' hips along the underside (frame u)
BEND = (1, 1, -1)                             # the knee forward, forward, back


def leg(hip, foot, bend, near=True, l1=7.6, l2=8.4):
    """One leg from its hip (world) to its foot: a femur and a tibia met at a knee, the tarsus flat on the ground."""
    knee = two_bone(hip, foot, l1, l2, bend)
    ink = lit("r" if near else "R")
    g = 3 if near else 0
    parts = [Part(capsule(hip, knee, 1.3, 1.1), ink, g), Part(capsule(knee, foot, 1.05, 0.75), ink, g),
             Part(capsule((foot[0] - 1.5, foot[1] - 0.4), (foot[0] + 2.6, foot[1] - 0.4), 0.7, 0.62), ink, g)]
    for part in parts:
        part.noline = True
    return parts


def legs_to(F, feet_near, feet_far):
    """Six legs: three near (drawn over the body), three far (darker, behind it)."""
    parts = []
    for n, (hu, b) in enumerate(zip(HIPS, BEND)):
        parts += leg(F.pt(hu + 1.6, 3.8), feet_far[n], b, near=False)
    for n, (hu, b) in enumerate(zip(HIPS, BEND)):
        parts += leg(F.pt(hu, 4.0), feet_near[n], b, near=True)
    return limb(parts, "body")


def planted(F, near_u=(18.0, 6.5, -8.0), far_u=(15.5, 4.0, -5.5), ground=GROUND):
    """Every foot on the ground, at a place along the body (a frame u, taken at the ground)."""
    def foot(u):
        return (F.cx + K * u * F.d[0], ground - 0.5)
    return legs_to(F, [foot(u) for u in near_u], [foot(u) for u in far_u])


def tucked(F, trail=0.0):
    """In flight the legs are held toward the body, folded: short, a little back."""
    parts = []
    for n, (hu, b) in enumerate(zip(HIPS, BEND)):
        for near, du in ((False, 1.6), (True, 0.0)):
            h = F.pt(hu + du, 4.0 - (0 if near else 0.2))
            k = F.pt(hu + du - 1.2 + trail, 7.0)
            f = F.pt(hu + du - 3.6 + trail, 6.6)
            ink = lit("r" if near else "R")
            g = 3 if near else 0
            for part in (Part(capsule(h, k, 1.15, 0.95), ink, g), Part(capsule(k, f, 0.95, 0.7), ink, g)):
                part.noline = True
                parts.append(part)
    return limb(parts, "body")


# ---- the poses ------------------------------------------------------------------------------------------------------------

def sway(k, n=4):
    return math.sin(k * 2 * math.pi / n)


LAMP_AT = (-14.5, 4.4)                        # the lantern's middle, in the body's frame


def lamp_world(F):
    return F.pt(*LAMP_AT)


def stand(k):
    """On the ground, all six feet down, the antennae forward and feeling; the lamp pale."""
    F = Fr(46.0, 39.0, 0.0)
    s = sway(k, 6)
    return planted(F) + beetle_body(F, 0.0, 0.0, antenna=(-0.34 + 0.1 * s, -0.12 - 0.12 * s))


def fly(k, pitch=0.8, cx=48.0, cy=30.0, raise_=0.5, wing=None, lamp=None, trail=0.0):
    """A patrolling male: the body pitched up, the wing covers lifted from the shoulder, the flying wing's beat
    swept as a stained fan, the antennae stiff forward, the legs held toward the body, the lamp lit on the upswing."""
    lamp = LAMP[k % CYCLE] if lamp is None else lamp
    F = Fr(cx, cy + 0.9 * math.sin(k * 2 * math.pi / 8), pitch + 0.045 * math.sin(k * 2 * math.pi / 12))
    w0, w1 = wing if wing else [(1.0, 0.2), (0.2, -0.5), (-0.5, 0.2), (0.2, 1.0)][k % 4]
    parts = hindwing(F, w0, w1) + tucked(F, trail) + beetle_body(F, lamp, raise_, antenna=(-0.12 + 0.05 * sway(k, 6), -0.04 - 0.06 * sway(k, 6)))
    return parts, F, lamp


def flight(k, **kw):
    parts, F, lamp = fly(k, **kw)
    return shot(halo(lamp_world(F), lamp) + parts)


def back(k):
    """The pause: it stops where it is, hanging nearly upright as a male flies when he patrols (Wikipedia: "in a
    nearly vertical orientation, their antennae held forward and stiff while their legs are held toward the
    body"), the wing covers up, the lamp lit in a flash of its own."""
    parts, F, lamp = fly(k, pitch=1.3, cx=44.0, cy=34.0, raise_=0.45, lamp=LAMP[(k + 8) % CYCLE])
    return shot(halo(lamp_world(F), lamp) + parts)


def leg2(a, b, c, near=True):
    ink = lit("r" if near else "R")
    ps = [Part(capsule(a, b, 1.35, 1.15), ink, 3 if near else 0), Part(capsule(b, c, 1.1, 0.8), ink, 3 if near else 0),
          Part(capsule((c[0] - 2.0, c[1] - 0.4), (c[0] + 2.0, c[1] - 0.4), 0.7, 0.7), ink, 3 if near else 0)]
    for q in ps:
        q.noline = True
    return ps


def look(k):
    """Faces you: the head shield a broad pink shield with its black dot, the two big eyes below it, the antennae
    up and out, the wing covers behind it, the front legs forward and the middle legs out."""
    cx = 48.0
    s = sway(k, 4)
    parts = []
    legs = []
    for sx in (-1, 1):
        legs += leg2((cx + sx * 5, 45.0), (cx + sx * 12.5, 48.5), (cx + sx * 9.5, 57.5), near=False)     # hind: behind
        legs += leg2((cx + sx * 8, 43.5), (cx + sx * 17, 44.5), (cx + sx * 20.5, 57.5))                  # middle: out
        legs += leg2((cx + sx * 4.5, 46.0), (cx + sx * 9.5, 51.0), (cx + sx * 6.5, 57.5))                # front: forward
    parts += limb(legs, "body")
    body = ellipse(cx, 35.5, 15.0, 11.5)

    def body_paint(x, y, l, i, j):
        if abs(x - cx) > 12.6:
            return "g" if l > 0.3 else "r"                               # the yellow border down each side
        k = (hsh(i, j, 5) - 0.5) * 0.55 + l
        if abs(x - cx) < 1.0:
            return "d"                                                   # where the two covers meet
        return "d" if k < 0.3 else ("R" if k < 0.7 else "r")
    parts.append(Part(body, body_paint, 4))
    shield = ellipse(cx, 29.0, 12.4, 8.8)

    def shield_paint(x, y, l, i, j):
        e = math.hypot((x - cx) / 12.4, (y - 29.0) / 8.8)
        if math.hypot((x - cx) / 3.6, (y - 28.2) / 2.8) < 1.0:
            return "k"
        if e > 0.82 or y > 35.0:
            return "w" if l > 0.3 else "W"
        return "W" if l < 0.78 or hsh(i, j, 3) < 0.7 else "w"
    parts.append(Part(shield, shield_paint, 5))
    parts.append(Part(ellipse(cx, 40.0, 6.4, 4.6), lambda x, y, l, i, j: "K" if l > 0.5 else "k", 6))
    for sx in (-1, 1):
        ex = cx + sx * 4.6
        parts.append(Part(ellipse(ex, 40.2, 3.5, 3.6), lit("k"), 8))
        parts.append(Part(ellipse(ex - 1.1, 39.0, 0.8, 0.8), lit("w"), 9))
        base = (cx + sx * 2.4, 36.4)
        mid = (cx + sx * (9.0 + 1.2 * s), 32.8 - 2.0 * s)
        tip = (cx + sx * (16.5 + 2.0 * s), 31.4 - 3.0 * s)
        ant = Part(path([base, mid, tip], 0.8, 0.5), lit("r"), 7)
        ant.noline = True
        parts.append(ant)
    parts.append(Part(capsule((cx - 1.6, 44.4), (cx + 1.6, 44.4), 0.9, 0.9), lit("K"), 7))
    return shot(parts)


def sit(k):
    """At rest, low on the ground, the legs folded under it, the antennae laid forward; on the clock the lamp
    answers once, as a female's does: a flash, one to two seconds after another's."""
    F = Fr(46.0, 47.5, 0.0)
    lamp = LAMP[(k + 4) % CYCLE]
    parts = []
    for n, (hu, b) in enumerate(zip(HIPS, BEND)):
        for near, du in ((False, 1.6), (True, 0.0)):
            h = F.pt(hu + du, 4.2)
            kn = F.pt(hu + du + 2.8 * b, 6.8)
            f = (F.pt(hu + du + 4.6 * b, 6.9)[0], GROUND - 0.5)
            ink = lit("r" if near else "R")
            for part in (Part(capsule(h, kn, 1.25, 1.05), ink, 3 if near else 0), Part(capsule(kn, f, 1.0, 0.75), ink, 3 if near else 0)):
                part.noline = True
                parts.append(part)
    parts = limb(parts, "body")
    s = sway(k, 12)
    parts += beetle_body(F, lamp, 0.0, antenna=(0.12 + 0.05 * s, 0.34 + 0.06 * s), head_dip=-0.1)
    return shot(halo(lamp_world(F), lamp) + parts)


# ---- its ethogram: the J, the answer, the call -----------------------------------------------------------------------

def jswoop(k):
    """The male's patrol, a J: he drops, levels, then climbs and lights on the upswing."""
    pitch, lamp, wing = ((-0.5, 0.0, (0.2, -0.5)), (-0.05, 0.0, (-0.4, 0.3)), (0.6, 0.6, (0.9, 0.1)), (1.05, 1.0, (0.1, 1.0)))[k]
    parts, F, lamp = fly(k, pitch=pitch, cx=46.0, cy=(24, 31, 34, 36)[k], raise_=0.5, wing=wing, lamp=lamp)
    return shot(halo(lamp_world(F), lamp) + parts)


def answer(k):
    """A female answering from the grass: the lamp lit."""
    F = Fr(46.0, 47.5, 0.04)
    lamp = (0.0, 1.0)[k]
    parts = beetle_body(F, lamp, 0.0, antenna=(-0.1, 0.1))
    return shot(halo(lamp_world(F), lamp) + parts)


def call(k):
    parts, F, lamp = fly(k * 12 + 12, pitch=0.5, cx=46.0, cy=32.0, raise_=0.4, lamp=(1.0, 0.0)[k])
    return shot(halo(lamp_world(F), lamp) + parts)


def poses():
    return {"trot": [flight(k) for k in range(CYCLE)], "stand": [shot(stand(k)) for k in range(6)],
            "back": [back(k) for k in range(CYCLE)], "look": [look(k) for k in range(4)],
            "sit": [sit(k) for k in range(CYCLE)],
            # The ethogram (characters.json): its instinct (the J), its idle (the answer) and its ritual (the call).
            "act": [jswoop(k) for k in range(4)], "play": [answer(k) for k in range(2)], "ritual": [call(k) for k in range(2)]}


# ---- in three parts, for a chimera (scripts/characters/chimera.py) ---------------------------------------------
#
# In a chimera it is the beetle on the ground, walking in a tripod gait (the near front, the far middle and the near
# hind leg step together, then the other three): the head the shield with its dot, its eye and its antennae; the body
# the wing covers over the thorax with the front and middle legs; the hindquarters the abdomen with its lantern and
# the hind legs, so a firefly's lamp can light the end of any animal.

FR = (46.0, 39.0, 0.0)
SEAMS = {"neck": (46.0 + K * 5.6, 37.4), "hip": (46.0 - K * 4.2, 39.0)}
CHIMERA_SCALE = 0.58
CH_HIPS = (7.4, 0.8, -6.8)                    # in a chimera the front legs start behind the neck's fold, the hind ones past the hip's
CH_FEET = (12.5, 3.2, -12.0)                  # where each pair stands, in u, with the body still


def chim_legs(F, near, far):
    """The six legs of a chimera's beetle: the front and the middle belong to its body, the hind to its hindquarters."""
    parts = []
    for n, (hu, b) in enumerate(zip(CH_HIPS, BEND)):
        slot = "hind" if n == 2 else "body"
        parts += limb(leg(F.pt(hu + 1.4, 3.8), far[n], b, near=False), slot)
        parts += limb(leg(F.pt(hu, 4.0), near[n], b, near=True), slot)
    return parts


def chim_feet(F, p=None, reach=3.4, lift=3.0):
    """Feet at rest (p None) or at a phase of the tripod gait: A is the near front, the far middle, the near hind."""
    def at(n, ph):
        u = CH_FEET[n]
        if ph is None:
            return (F.cx + K * u, GROUND - 0.5)
        x, y = foot_at(ph, F.cx + K * u, reach, lift, GROUND - 0.5, 0.55)
        return (x, y)
    a, b = (None, None) if p is None else (p, p + 0.5)
    near = [at(0, a), at(1, b), at(2, a)]
    far = [at(0, b), at(1, a), at(2, b)]
    return near, far


def level(pose, k, slot):
    F = Fr(*FR)
    walk = pose == "walk"
    near, far = chim_feet(F, k / 6.0 if walk else None)
    lamp, raise_, dip, anten = 0.0, 0.0, 0.0, (-0.34, -0.12)
    drop = 0.0
    if walk:
        F = Fr(FR[0], FR[1] - 0.5 * abs(math.sin(k / 6.0 * 2 * math.pi * 2)), 0.0)
        anten = (-0.34 + 0.08 * sway(k, 6), -0.12 - 0.1 * sway(k, 6))
    elif pose == "stand":
        lamp, anten, dip = ((0.0, (-0.34, -0.12), 0.0), (0.0, (-0.46, -0.3), 0.0), (0.7, (-0.3, -0.1), 0.0))[k]
    elif pose == "back":
        raise_, anten = 0.5, (-0.5, -0.4)
    elif pose == "look":
        anten, dip = (-0.6, -0.5), 0.5
    elif pose == "rest":
        lamp, anten, drop = 0.6, (0.12, 0.34), 3.0
        F = Fr(FR[0], FR[1] + 3.0, 0.0)
        near, far = chim_feet(F, None)
    elif pose == "present":
        lamp, raise_, anten = 1.0, 0.6, (-0.5, -0.4)
    elif pose == "act":
        lamp, raise_, anten = (0.0, 0.4, 1.0, 1.0)[k], (0.0, 0.2, 0.45, 0.6)[k], (-0.2, -0.1)
    else:                                       # ritual: the call and its answer
        lamp, anten = (1.0, 0.0)[k], (-0.2, -0.1)
    if slot != "body":
        raise_ = 0.0                            # a lifted wing cover would be cut at a fold and float
    parts = chim_legs(F, near, far) + beetle_body(F, lamp, raise_, antenna=anten, head_dip=dip)
    return halo(lamp_world(F), lamp) + parts, drop


def rig(pose, k=0, slot="body"):
    return level(pose, k, slot)


# Caponigro's own colours where his works have them (hands.inks_for on the 89 colours of his 33 saved works: the black-
# browns of the wing covers #222120 and #413c3a, the greys #565654, the blacks #100d0c and #363636, the warm tan
# #958571, a pink #cd7f80 and a chalk #948881), worked toward the firefly's yellow only where his works have none
# (the border and the lamp: his lightest, #f1f1f1 of the roster, worked toward the lamp's yellow-green).
INKS = {"coat": ["#222120", "#413c3a", "#565654", "#cbc27e"], "white": ["#9a5b5e", "#dcd5b4"],
        "black": ["#100d0c", "#363636"], "eye": "#e2ea78", "pen": ["#948881", "#c8c3be"], "box": "#a43738"}
