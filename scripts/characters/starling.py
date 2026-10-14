"""The common starling (Sturnus vulgaris) as a murmuration — after Jackson Pollock.

(Prototype: the flock only; the chimera's single bird comes after.)
"""

import math

W, H = 80, 48
GROUND = 46.6
CELL = 2
RLE = True              # 80 by 48 and eight frames a pose: its rows are run-length coded (build_characters.py)

GOLDEN = math.pi * (3.0 - math.sqrt(5.0))      # the golden angle, 2.39996 radians
TAU = 2 * math.pi
R2A, R2B = 0.7548776662466927, 0.5698402909980532     # the R2 sequence: even, never gridded

# Pollock's inks (DIRT's roster: dark #473e38, mid #998e7f, light #dbd5cc, the vivid #b66b1f)
INKS = {"coat": ["#3a322d", "#5c5248", "#8a7f70", "#b3a897"], "white": ["#dbd5cc", "#efe9df"],
        "black": ["#2a231f", "#3d352f"], "eye": "#b66b1f", "pen": ["#6f655a", "#b9b0a2"], "box": "#b66b1f"}


def hsh(*parts):
    n = 2166136261
    for ch in "|".join(str(p) for p in parts):
        n = ((n ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return n / 4294967296.0


def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def frac(x):
    return x - math.floor(x)


# ---- the flock ---------------------------------------------------------------------
#
# A murmuration is a poured line that thickens into a mass and thins to a thread. Each
# bird has a place on a ribbon (s along its spine, n across it); the ribbon undulates and a
# wave of density runs through it; the birds ride it, each with its own small weave and
# its own wingbeat. Three layers: a texture of far birds (a single cell each), the birds
# of the middle (a V, a bar or a caret by their wingbeat), and a few near ones with longer
# wings.

class Width:
    """The ribbon's half-width along its spine, and where a bird goes along it in proportion."""

    def __init__(self, f, k=240):
        self.f = f
        self.k = k
        acc, tot = [0.0], 0.0
        for q in range(k):
            tot += f((q + 0.5) / k)
            acc.append(tot)
        self.acc = [a / tot for a in acc]

    def inv(self, u):
        lo, hi = 0, self.k
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if self.acc[mid] <= u:
                lo = mid
            else:
                hi = mid
        a, b = self.acc[lo], self.acc[hi]
        return (lo + (u - a) / ((b - a) or 1.0)) / self.k


class Bird:
    __slots__ = ("s", "n", "z", "ph", "tone", "layer", "off")

    def __init__(self, layer, i, seed, width, closed=False):
        u, v = frac(0.5 + i * R2A), frac(0.5 + i * R2B)
        self.layer = layer
        self.s = width.inv(u) if not closed else u
        d = 2 * v - 1
        self.n = math.copysign(abs(d) ** 1.0, d)      # a flock's edge is crisp: birds keep company
        self.z = hsh(seed, layer, i, "z")
        self.ph = hsh(seed, layer, i, "p") * TAU
        self.tone = hsh(seed, layer, i, "t")
        self.off = int(hsh(seed, layer, i, "o") * 4)


def flock(width, counts=(230, 56, 14), seed=1, closed=False):
    out = []
    for layer, n in zip(("far", "mid", "near"), counts):
        out += [Bird(layer, i, seed, width, closed) for i in range(n)]
    return out


def put(cells, x, y, ch, z):
    i, j = int(math.floor(x + 0.5)), int(math.floor(y + 0.5))
    if 0 <= i < W and 0 <= j < H:
        old = cells.get((i, j))
        if old is None or old[0] <= z:
            cells[(i, j)] = (z, ch)


def rows_of(cells):
    grid = [["."] * W for _ in range(H)]
    for (i, j), (_, ch) in cells.items():
        grid[j][i] = ch
    return ["".join(r) for r in grid]


def ink(lum, tone, layer):
    """A bird's ink. Pollock's black and white on any ground: a third of the birds of the middle are the umber
    (they show on a pale ground), the rest take the light — warm grey to off-white by where they are — and some
    of the ochre is flung through them; the far ones are a dim texture."""
    steps = "dRrgWw"
    if layer == "far":
        if tone > 0.97:
            return "y"
        k = int(lum * 6.0 + (tone - 0.5) * 1.1)
        return steps[max(0, min(5, k))]
    if tone > 0.90:
        return "y"                                    # the vivid, flung
    if tone < 0.10:
        return "k"
    if tone < 0.30:
        return "d"
    k = int(lum * 6.0 + (tone - 0.5) * 1.1)
    return steps[max(1, min(5, k))]


def glyph(cells, b, x, y, ch, beat):
    """A bird as the sign for a bird in flight: a V of three cells (wings up), a bar (level), a caret
    (down); the near ones with longer wings, the far ones a single cell."""
    xi, yi = int(math.floor(x + 0.5)), int(math.floor(y + 0.5))
    if b.layer == "far":
        put(cells, xi, yi, ch, b.z)
        return
    dy = (-1, -1, -1, 0, 1, 1, 1, 0)[(beat + b.off * 2) % 8]
    put(cells, xi, yi, ch, 1.0 + b.z * 0.3)
    for s in (-1, 1):
        put(cells, xi + s, yi + dy, ch, 1.0 + b.z * 0.2)
        if b.layer == "near":
            put(cells, xi + 2 * s, yi + 2 * dy if dy else yi, ch, 1.0 + b.z * 0.1)


def paint_birds(birds, place, t, T, lit=(-0.6, -0.8)):
    """One frame: place(b, t) -> (x, y, nx, ny) puts each bird of the flock; the rest is the same for all
    — the light on the side that faces upper left, the far ones dimmer, the near ones brighter, each bird's
    own weave and wingbeat."""
    cells = {}
    s_ = TAU * t / T
    for b in birds:
        x, y, nx, ny = place(b, t)
        x += 0.8 * math.sin(s_ + b.ph)
        y += 0.7 * math.cos(s_ + b.ph * 1.7)
        lum = 0.5 + 0.38 * (nx * lit[0] + ny * lit[1]) * b.n + 0.25 * (-0.5 + b.z) + 0.2 * (1 - abs(b.n))
        lum -= 0.14 if b.layer == "far" else -0.1 if b.layer == "near" else 0.0
        lum = max(0.0, min(1.0, lum))
        glyph(cells, b, x, y, ink(lum, b.tone, b.layer), t)
    return cells


def throw(cells, drops, t, T, edge, gravity=0.0):
    """Paint flung off the flock: each drop leaves the flock's edge at its own frame (`edge(s, frame)` is where),
    travels outward over the loop with a streak behind it, and dims as it goes. Each is (s, vx, vy, phase, ink)."""
    dim = {"y": "R", "W": "r", "w": "r", "r": "R", "g": "R", "R": "d", "d": "d", "k": "d"}
    for s, vx, vy, ph, ch in drops:
        age = (t + ph) % T
        if age > 6:
            continue
        x0, y0 = edge(s, (t - age) % T)
        x = x0 + vx * age
        y = y0 + vy * age + gravity * age * age
        c = ch if age < 4 else dim[ch]
        put(cells, x, y, c, 2.0)
        if age >= 1:
            put(cells, x - vx * 0.8, y - (vy + gravity * 2 * age) * 0.8, dim[c] if age > 1 else c, 1.9)


def thread(cells, spine, s0, s1, t, T, gleam=True):
    """The poured line itself, where the ribbon thins to a thread: a single cell wide in the dim umber, with a
    gleam of the ochre and off-white running along it."""
    n = int(abs(s1 - s0) * 90)
    for q in range(n + 1):
        s = s0 + (s1 - s0) * q / max(1, n)
        x, y = spine(s, t)
        put(cells, x, y, "R", 0.9)
    if gleam:
        for k, ch in ((0, "y"), (1, "w"), (2, "r")):
            s = s0 + (s1 - s0) * (((t - k * 0.35) / T) % 1.0)
            x, y = spine(s, t)
            put(cells, x, y, ch, 1.0 + 0.1 * (3 - k))


def ribbon_place(width, spine, wave, T):
    """Birds along a spine, the arcs of a wave of density running through them: wave = (centre x, centre y,
    squash, k, amp, direction x, direction y)."""
    cx, cy, sq, k, amp, dx, dy = wave

    def place(b, t):
        s_ = TAU * t / T
        x0, y0 = spine(b.s, t)
        x1, y1 = spine(b.s + 0.02 if b.s < 0.98 else b.s - 0.02, t)
        tx, ty = x1 - x0, y1 - y0
        if b.s >= 0.98:
            tx, ty = -tx, -ty
        L = math.hypot(tx, ty) or 1.0
        tx, ty = tx / L, ty / L
        nx, ny = -ty, tx
        hw = width.f(b.s)
        x = x0 + nx * b.n * hw
        y = y0 + ny * b.n * hw
        d = math.hypot(x - cx, (y - cy) * sq)
        ph = k * d - s_
        return x + amp * math.sin(ph) * dx, y + amp * math.sin(ph) * dy, nx, ny
    return place


# ---- poses -------------------------------------------------------------------------

T = 8
TROT_WIDTH = Width(lambda s: 0.3 + 10.5 * math.sin(math.pi * min(1.0, s ** 0.72)) * (0.5 + 0.5 * smooth(0.0, 0.62, s)))
TROT = flock(TROT_WIDTH)


def trot_spine(s, t):
    ph = TAU * t / T
    x = 12.0 + 56.0 * s
    y = 26.0 - 3.5 * math.sin(math.pi * s) + (1.0 - s) ** 2.4 * (-9.0) + 1.3 * math.sin(ph - TAU * 0.8 * s)
    return x, y


def make_drops(n, seed, s_range, vx, vy, inks="yyWWWrrdg"):
    """Drops thrown off a flock: where along its edge, how fast each goes, from which frame, in what ink."""
    out = []
    for i in range(n):
        s = s_range[0] + (s_range[1] - s_range[0]) * hsh(seed, i, "s")
        out.append((s, vx[0] + (vx[1] - vx[0]) * hsh(seed, i, "vx"), vy[0] + (vy[1] - vy[0]) * hsh(seed, i, "vy"),
                    int(hsh(seed, i, "ph") * T), inks[int(hsh(seed, i, "ink") * len(inks))]))
    return out


def ribbon_edge(width, spine, side):
    """A point on one edge of a ribbon (side +1 the lower, -1 the upper) at s, in frame t."""
    def edge(s, t):
        x0, y0 = spine(s, t)
        x1, y1 = spine(s + 0.02 if s < 0.98 else s - 0.02, t)
        tx, ty = (x1 - x0), (y1 - y0)
        if s >= 0.98:
            tx, ty = -tx, -ty
        L = math.hypot(tx, ty) or 1.0
        hw = width.f(s) * 0.9
        return x0 + (-ty / L) * hw * side, y0 + (tx / L) * hw * side
    return edge


TROT_DROPS = make_drops(15, 31, (0.12, 0.9), (-1.7, -0.5), (0.05, 0.75))


def trot(t):
    place = ribbon_place(TROT_WIDTH, trot_spine, (2.0, 42.0, 0.8, 0.5, 3.6, 0.8, -0.6), T)
    cells = paint_birds(TROT, place, t, T)
    thread(cells, trot_spine, 0.0, 0.2, t, T)
    throw(cells, TROT_DROPS, t, T, ribbon_edge(TROT_WIDTH, trot_spine, 1), 0.03)
    return rows_of(cells)


# Wheeling in place: a pinwheel of three arms, turning.
DISC = flock(Width(lambda s: 1.0), counts=(190, 46, 12), seed=2, closed=True)


def disc_place(cx, cy, rx, ry, tilt, arms=3, turn=1.0, hole=0.0):
    ct, st = math.cos(tilt), math.sin(tilt)

    def place(b, t):
        s_ = TAU * t / T
        # a bird's place in the disc: its angle from s, its radius from |n| warped to a dense core
        a = b.s * TAU
        rr = abs(b.n) ** 0.9 * 0.5 + b.z * 0.5
        rr = hole + (1.0 - hole) * min(1.0, rr)
        a += turn * 0.55 * math.sin(arms * a - s_ + 2.2 * rr) * (0.4 + rr)
        ux, uy = math.cos(a) * rr, math.sin(a) * rr
        x = cx + (ux * rx) * ct - (uy * ry) * st
        y = cy + (ux * rx) * st + (uy * ry) * ct
        return x, y, ux, uy
    return place


def radial_drops(n, seed, speed, inks="yyWWWrrdg"):
    """Drops flung straight out from a ring or a disc: s is the angle round it, and the velocity points away."""
    out = []
    for i in range(n):
        s = hsh(seed, i, "a")
        a = s * TAU
        k = speed * (0.6 + 0.8 * hsh(seed, i, "k"))
        out.append((s, math.cos(a) * k, math.sin(a) * k * 0.7, int(hsh(seed, i, "ph") * T), inks[int(hsh(seed, i, "ink") * len(inks))]))
    return out


def rim_edge(cx, cy, rx, ry):
    def edge(s, t):
        a = s * TAU
        return cx + math.cos(a) * rx, cy + math.sin(a) * ry
    return edge


STAND_DROPS = radial_drops(14, 41, 0.9)


def stand(t):
    cells = paint_birds(DISC, disc_place(40.0, 23.0, 21.0, 13.0, -0.14), t, T)
    throw(cells, STAND_DROPS, t, T, rim_edge(40.0, 23.0, 19.0, 11.5))
    return rows_of(cells)


# Looking at you: the flock opens a ring, a hollow with one bird of the vivid in it (a vacuole).
RING = flock(Width(lambda s: 1.0), counts=(170, 44, 12), seed=3, closed=True)


def ring_place(cx, cy, rx, ry, half):
    def place(b, t):
        s_ = TAU * t / T
        a = b.s * TAU + 0.5 * math.sin(2 * TAU * b.s - s_) * 0.35
        breathe = 1.0 + 0.06 * math.sin(s_ - 3 * a)
        ux, uy = math.cos(a), math.sin(a)
        rr = 1.0 + b.n * half / ry
        return cx + ux * rx * rr * breathe, cy + uy * ry * rr * breathe, ux * b.n, uy * b.n
    return place


LOOK_DROPS = radial_drops(10, 51, 0.8, "yyWWrrd")


def look(t):
    cells = paint_birds(RING, ring_place(40.0, 23.0, 20.0, 14.0, 6.5), t, T)
    throw(cells, LOOK_DROPS, t, T, rim_edge(40.0, 23.0, 25.0, 17.5))
    # the bird at its middle, in the vivid
    wing = (-1, -1, 0, 1, 1, 1, 0, -1)[t % 8]
    for dx, dy in ((0, 0), (-1, wing), (1, wing), (-2, wing * 2), (2, wing * 2)):
        put(cells, 40 + dx, 23 + dy, "y", 3.0)
    return rows_of(cells)


# Wheeling back: the flock's head curls up and over, a wave about to break.
HOOK_WIDTH = Width(lambda s: 0.3 + 9.0 * math.sin(math.pi * min(1.0, s ** 0.8)) * (0.5 + 0.5 * smooth(0.0, 0.5, s)))
HOOK = flock(HOOK_WIDTH, counts=(160, 42, 10), seed=4)


def hook_spine(s, t):
    kappa = 2.9 + 0.55 * math.sin(TAU * t / T)
    x, y, n = 6.0, 38.0, 60
    last = (x, y)
    for q in range(n):
        u = q / n
        if u >= s:
            break
        th = -kappa * (u ** 1.9)
        x += math.cos(th) * 62.0 / n
        y += math.sin(th) * 62.0 / n
        last = (x, y)
    return last


HOOK_DROPS = make_drops(13, 61, (0.55, 1.0), (-1.3, -0.3), (-1.0, -0.2))


def back(t):
    place = ribbon_place(HOOK_WIDTH, hook_spine, (10.0, 44.0, 0.9, 0.55, 2.2, 0.7, -0.7), T)
    cells = paint_birds(HOOK, place, t, T)
    thread(cells, hook_spine, 0.0, 0.2, t, T)
    throw(cells, HOOK_DROPS, t, T, ribbon_edge(HOOK_WIDTH, hook_spine, -1), 0.05)
    return rows_of(cells)


# Settled: the flock has come down to roost. Starlings standing on the ground, in the light and the shade, heads
# up and heads down (probing), a wing flicked now and then, the last of them still pouring in from above.
# A standing starling is six cells by four: head and bill (the vivid, a breeding bird's), the back in the light,
# the tail, the legs; the spots are Pollock's flung off-white on the umber.

STAND_UP = ["....H..",
            "..BBHy.",
            ".TBBBB.",
            "...l.l."]
STAND_DOWN = ["......",
              "..BB...",
              ".TBBBH.",
              "...l.ly"]
STAND_FLICK = ["..W.....",
               "..BB.H..",
               ".TBBBHy.",
               "...l.l.."]
STAND_HOP = ["....H..",
             "..BBHy.",
             ".TBBBB.",
             "..l...l"]
PERCH = [STAND_UP, STAND_UP, STAND_DOWN, STAND_DOWN, STAND_UP, STAND_FLICK, STAND_UP, STAND_HOP]


def perched_cells(cells, x, y, pat, lit, tone, z, far=False):
    """Draw a perched starling with its feet at (x, y)."""
    for j, row in enumerate(pat):
        for i, c in enumerate(row):
            if c == ".":
                continue
            px, py = x + i - 3, y - (len(pat) - 1) + j
            if c == "y":
                ch = "y"
            elif c == "l":
                ch = "R" if far else "r"
            elif c == "W":
                ch = "W"
            else:
                # the back in the light, the belly in the shade, spots flung on it
                up = {"B": 0 if j == 1 else -1, "H": 0, "T": -1}.get(c, 0)
                spot = hsh(px, py, int(tone * 997)) > 0.78
                k = (lit + up + (1 if spot else 0) - (1 if far else 0))
                ch = "dRrgWw"[max(0, min(5, k + 1))] if not spot else ("W" if not far else "r")
            put(cells, px, py, ch, z)


# Where they stand: a pool of them under where the pour ends, thinning to the left and right; the nearest
# row bright, the farther dimmer.
ROOST = [(7, 46.2, 0), (19, 46.4, 0), (31, 46.0, 0), (43, 46.4, 0), (55, 46.0, 0), (67, 46.3, 0),
         (13, 43.4, 0), (26, 43.2, 0), (38, 43.6, 0), (50, 43.2, 0), (62, 43.5, 0),
         (20, 40.6, 1), (33, 40.4, 1), (45, 40.7, 1), (57, 40.4, 1)]
ROOST = [(x + (hsh(i, "rx") - 0.5) * 2.4, y, far, hsh(i, "ph"), hsh(i, "tone")) for i, (x, y, far) in enumerate(ROOST)]
# the pour: a line that thickens into the pool
STREAM_WIDTH = Width(lambda s: 0.5 + 5.6 * smooth(0.0, 1.0, s) ** 1.2)
STREAM = flock(STREAM_WIDTH, counts=(140, 34, 8), seed=5)


def stream_spine(s, t):
    # from the upper right, down to the roost
    x = 77.0 - 40.0 * s ** 0.85 + 2.2 * math.sin(TAU * (t / T - 1.1 * s)) * (1.0 - s)
    y = 1.0 + 35.0 * s ** 1.45
    return x, y


STREAM_DROPS = make_drops(9, 71, (0.55, 1.0), (-0.5, 0.1), (0.2, 0.7))


def sit(t):
    cells = {}
    for x, y, far, ph, tone in ROOST:
        # each bird holds a pose a few frames, its own order
        pat = PERCH[int(ph * 8 + t // 2 * (1 if ph > 0.5 else 0)) % 8]
        perched_cells(cells, int(round(x)), int(round(y)), pat, 1 if far else (3 if y < 45 else 2), tone,
                      0.3 + (0.0 if far else 0.2) + 0.1 * (y / 46.0), bool(far))
    place = ribbon_place(STREAM_WIDTH, stream_spine, (77.0, 1.0, 1.0, 0.7, 1.4, -0.6, 0.6), T)
    cells.update(paint_birds(STREAM, place, t, T))
    throw(cells, STREAM_DROPS, t, T, ribbon_edge(STREAM_WIDTH, stream_spine, 1), 0.03)
    return rows_of(cells)


def poses():
    return {"trot": [trot(t) for t in range(8)], "stand": [stand(t) for t in range(8)],
            "back": [back(t) for t in range(8)], "look": [look(t) for t in range(8)],
            "sit": [sit(t) for t in range(8)]}


# ---- the single starling, in three parts, for a chimera (scripts/characters/chimera.py) ----------------
#
# A character that is not one body gives one of the flock for its parts. One starling, side on, facing right:
# plump, a long straight bill (the vivid of a breeding bird's), a short square tail, strong legs — it walks, it
# does not hop, and bobs its head as it goes — in the umber of Pollock's saved works with his off-white flung on it
# (a starling's winter plumage is spotted) and a fleck of the ochre; no two cells of it alike. The chalk edge is
# the raster's, so it reads on a dark ground and a light one.
#
# It is drawn in a 40 by 26 frame (the ground at 24.6), as the others are, and set into the flock's 80 by 48.

from draw import Part, bayer, capsule, ellipse, foot_at, limb, path, poly, raster, triangle, turned, two_bone, union

OX, OY = 20.0, 22.0
G_ = 24.6                                       # the ground in its own frame
CHIMERA_SCALE = 1.35
SEAMS = {"neck": (24.0 + OX, 14.6 + OY), "hip": (16.2 + OX, 16.2 + OY)}
DEEP = "d"


def feathers(steps="dRrg", spots=0.15, fleck=0.03, lift=0.0, seed=5):
    """A paint: the umber ramp by the light, dithered, with off-white thrown over it (the spots) and a fleck of
    the ochre now and then."""
    n = len(steps)

    def paint(x, y, light, i, j):
        h = hsh(i, j, seed)
        if h > 1.0 - spots:
            return "W" if light > 0.35 else "r"
        if h < fleck:
            return "y"
        v = max(0.0, min(1.0, light + lift)) * n - 0.5
        k = int(math.floor(v))
        if v - k > bayer(i, j):
            k += 1
        return steps[max(0, min(n - 1, k))]
    return paint


BACK = feathers("dRrg", 0.19, 0.025, 0.05)
BELLY = feathers("dRrg", 0.27, 0.02, -0.1, 6)
HEAD = feathers("dRrg", 0.05, 0.02, 0.0, 7)
TAILP = feathers("kdRr", 0.0, 0.0, -0.1, 8)
LEG = lambda *a: "y"
BILL = lambda *a: "y"
EYE = lambda *a: "k"


def wing_paint(shoulder, angle):
    """The folded wing: rows of feathers along it, their tips edged in the lighter step, and the spots at the tips."""
    ca, sa = math.cos(angle), math.sin(angle)

    def paint(x, y, light, i, j):
        u = (x - shoulder[0]) * ca + (y - shoulder[1]) * sa         # along the wing
        v = -(x - shoulder[0]) * sa + (y - shoulder[1]) * ca        # across it
        lane = (v + 0.4 * math.sin(u * 0.7)) / 1.1
        if abs(lane - round(lane)) < 0.17 and u > 1.5:
            return "r" if light > 0.45 else "R"
        if hsh(i, j, 9) > 0.86 and u > 3.0:
            return "W"
        if light > 0.78:
            return "g"
        return "d" if light < 0.34 else "R"
    return paint


def starling_parts(tilt=-0.28, bob=0.0, head=(26.8, 11.4), bill=0.0, bill_open=0.0, wing=0.0, tail=0.0, fluff=0.0,
                   crouch=0.0, feet=None, legs_at="body", ruff=0.0, face="side", tuck=0.0, tail_fan=0.0, eye=1.0):
    """The whole bird as parts. wing: 0 folded, + raised (to 1: straight up), - dropped away from the body;
    bill: its tilt (+ down); feet: the near and far foot, or the walk's; ruff: the throat's feathers raised."""
    b = bob + crouch
    core = ellipse(19.4, 15.8 + b, 5.6 + fluff, 3.8 + fluff * 0.9, tilt)
    chest = ellipse(22.8 - tuck, 15.6 + b, 3.6 + fluff * 0.7, 3.6 + fluff * 0.7)
    body = union(core, chest)
    hx, hy = head
    neck = capsule((23.4 - tuck, 14.0 + b), (hx - 0.4, hy + 0.6), 2.3 + fluff * 0.4, 1.9)
    skull = ellipse(hx, hy, 2.2 + fluff * 0.3, 1.95 + fluff * 0.2)
    parts = []
    # the far leg, then the body over it, the near leg over the body
    lx = 20.2 if legs_at == "body" else 14.8
    hip = (lx - 0.8, 18.0 + b)
    if feet is None:
        feet = ((lx + 0.4, G_), (lx - 1.4, G_))
    near, far = feet

    def leg(foot, g):
        ank = two_bone(hip, foot, 2.4, 4.8, -1)
        toes = union(capsule((foot[0] - 0.1, foot[1] - 0.35), (foot[0] + 2.4, foot[1] - 0.2), 0.34, 0.26),
                     capsule((foot[0] - 0.1, foot[1] - 0.35), (foot[0] - 1.3, foot[1] - 0.15), 0.3, 0.24))
        return limb([Part(path([hip, ank, (foot[0], foot[1] - 0.35)], 0.55, 0.4), LEG, g), Part(toes, LEG, g)], legs_at)
    if not crouch > 2.2:
        parts += leg(far, 0)
    tail_pts = [(14.4, 14.6 + b), (9.6, 16.4 + b - tail), (9.4, 17.8 + b - tail), (10.0, 19.4 + b - tail * 0.8), (14.4, 18.6 + b)]
    if tail_fan:
        tail_pts = [(13.8, 14.2 + b), (7.6, 12.8 + b - tail), (6.8, 16.4 + b - tail), (8.2, 20.0 + b - tail * 0.6), (13.8, 18.4 + b)]
    parts.append(Part(poly(tail_pts), TAILP, 1))
    parts.append(Part(body, BACK, 3))
    belly = ellipse(21.0 - tuck, 18.0 + b, 4.4 + fluff, 1.8 + fluff * 0.5)
    parts.append(Part(belly, BELLY, 3.5))
    parts.append(Part(neck, HEAD, 4))
    if not crouch > 2.2:
        parts += leg(near, 7)
    # the wing, over the flank
    sh = (22.0 - tuck, 13.4 + b)
    wing_tip = (10.8, 17.4 + b - tail * 0.5)
    ang = math.atan2(wing_tip[1] - sh[1], wing_tip[0] - sh[0])
    wp = Part(path([sh, ((sh[0] + wing_tip[0]) / 2 + 0.4, (sh[1] + wing_tip[1]) / 2 + 0.3), wing_tip], 2.5, 0.5), wing_paint(sh, ang), 8)
    if wing:
        wp = turned([wp], -1.15 * wing, sh)[0]
    parts.append(wp)
    if wing > 0.4:
        # the far wing, up behind, darker
        parts.append(Part(path([(sh[0] + 0.6, sh[1] - 0.4), (sh[0] - 4.0, sh[1] - 5.2), (sh[0] - 9.0, sh[1] - 6.8)], 2.1, 0.5), lambda *a: "d", 0))
    if face == "front":
        parts.append(Part(ellipse(hx, hy, 2.9, 2.6), HEAD, 5))
        parts.append(Part(union(ellipse(hx - 1.3, hy - 0.5, 0.5, 0.5), ellipse(hx + 1.3, hy - 0.5, 0.5, 0.5)), EYE, 8))
        parts.append(Part(triangle((hx - 0.9, hy + 0.6), (hx + 0.9, hy + 0.6), (hx, hy + 3.0)), BILL, 6))
        return parts
    parts.append(Part(skull, HEAD, 5))
    # the bill: straight, long, a little tilted; open, two blades
    bx, by = hx + 1.9, hy + 0.5
    ex = bx + 3.9
    if bill_open > 0:
        up = capsule((bx, by - 0.2), (ex, by - 0.9 + bill - bill_open * 1.4), 0.55, 0.2)
        lo = capsule((bx, by + 0.4), (ex - 0.6, by + 1.2 + bill + bill_open * 1.5), 0.5, 0.2)
        parts.append(Part(union(up, lo), BILL, 6))
    else:
        parts.append(Part(capsule((bx, by), (ex, by + 0.5 + bill), 0.62, 0.22), BILL, 6))
    parts.append(Part(ellipse(hx + 0.7, hy - 0.5, 0.5 * eye, 0.45 * eye), EYE, 8))
    if ruff:
        spikes = [(hx - 1.4, hy + 1.4), (hx + 1.8, hy + 1.2),
                  (hx + 1.2, hy + 1.4 + 3.0 * ruff), (hx - 0.2, hy + 1.8 + 3.8 * ruff), (hx - 1.6, hy + 1.6 + 3.2 * ruff)]
        parts.append(Part(poly(spikes), feathers("dRrg", 0.22, 0.0, 0.1, 10), 5.5))
    return parts


def walk_feet(k, lx):
    p = k / 6.0 + 0.25
    return foot_at(p, lx + 0.4, 1.8, 1.5, G_, 0.6), foot_at(p + 0.5, lx - 1.4, 1.8, 1.5, G_, 0.6)


def starling_pose(pose, k, slot):
    legs_at = "hind" if slot == "hind" else "body"
    lx = 20.2 if legs_at == "body" else 14.8
    if pose == "walk":
        bob = (0.0, -0.3, -0.5, 0.0, -0.3, -0.5)[k]
        hx = 26.8 + 1.0 * math.cos(TAU * k / 3.0)
        return starling_parts(bob=bob, head=(hx, 11.4 + 0.25 * math.sin(TAU * k / 3.0)), feet=walk_feet(k, lx), legs_at=legs_at), 0.0
    if pose == "stand":
        if k == 1:
            return starling_parts(head=(27.6, 12.2), bill=0.5, legs_at=legs_at), 0.0
        if k == 2:
            return starling_parts(wing=0.3, tail=1.6, legs_at=legs_at), 0.0
        return starling_parts(legs_at=legs_at), 0.0
    if pose == "back":
        return starling_parts(tilt=-0.5, head=(27.4, 8.2), bill=-0.7, legs_at=legs_at), 0.0
    if pose == "look":
        return starling_parts(face="front", head=(26.2, 10.8), legs_at=legs_at), 0.0
    if pose == "rest":
        return starling_parts(crouch=2.8, fluff=1.0, head=(25.0, 13.0), tuck=1.2, tail=-0.3,
                              feet=((lx + 0.4, G_ - 0.2), (lx - 1.4, G_ - 0.2)), legs_at=legs_at, eye=0.55), 3.0
    if pose == "ritual":
        return starling_parts(tilt=-0.7, head=(26.6, 8.6), bill_open=(0.9, 0.0)[k], ruff=(1.0, 0.45)[k], wing=(-0.5, -0.12)[k],
                              legs_at=legs_at), 0.0
    if pose == "act":
        # joining the flock: crouch, spring, wings up, the down stroke
        if k == 0:
            return starling_parts(crouch=1.2, head=(27.2, 12.6), tilt=-0.15, legs_at=legs_at), 1.0
        if k == 1:
            return starling_parts(tilt=-0.55, bob=-0.8, wing=0.45, head=(27.6, 10.2), feet=((lx + 1.4, G_ - 1.6), (lx - 0.6, G_ - 0.2)),
                                  legs_at=legs_at), 0.0
        if k == 2:
            return starling_parts(tilt=-0.5, bob=-3.0, wing=1.0, tail_fan=1, head=(27.6, 8.6),
                                  feet=((lx + 0.2, G_ - 5.4), (lx - 1.4, G_ - 5.0)), legs_at=legs_at), 0.0
        return starling_parts(tilt=-0.4, bob=-5.0, wing=0.15, tail_fan=1, head=(27.8, 8.4),
                              feet=((lx + 0.2, G_ - 6.4), (lx - 1.4, G_ - 6.0)), legs_at=legs_at), 0.0
    # present: the song's pride, upright, bill open, the throat's feathers up
    return starling_parts(tilt=-0.8, head=(26.0, 7.8), bill_open=0.8, ruff=1.0, wing=-0.35, legs_at=legs_at), 0.0


def rig(pose, k=0, slot="body"):
    parts, drop = starling_pose(pose, k, slot)
    return turned(parts, 0.0, (0.0, 0.0), (OX, OY)), drop


def single(pose, k=0, slot="body"):
    """The one bird as a picture of its own (for looking at): 40 by 26 cells."""
    parts, _ = starling_pose(pose, k, slot)
    return raster(parts, 40, 26)
