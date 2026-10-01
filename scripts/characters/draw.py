"""A small flat pixel-art drawer for the characters.

The theatre (scripts/theatre/) draws in isometric 3D; a character is drawn
side on, as a sprite is, so this is the same idea in two dimensions: each
part is a signed distance field, every cell is decided by the part it lands
on at the picture's own resolution, light comes from the upper left and
chooses a step on a short ramp, the steps meet through a narrow Bayer band,
and the outline is selective: dark pen on the sides turned from the light,
the coat's own deepest step on the sides turned to it.

A picture is a list of rows of letters, one letter a cell. What each letter
is drawn in is decided on the page (docs/v2/characters.js), where every cell
becomes a dot of DIRT in the soil of the place it stands on.
"""

import math

BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
LIGHT = (-0.62, -0.78)          # toward the light: up and to the left


def bayer(i, j):
    return (BAYER4[j % 4][i % 4] + 0.5) / 16.0


# ---- distance fields, in cells -------------------------------------------------

def ellipse(cx, cy, rx, ry, turn=0.0):
    c, s = math.cos(turn), math.sin(turn)

    def d(x, y):
        dx, dy = x - cx, y - cy
        u, v = dx * c + dy * s, -dx * s + dy * c
        k = math.hypot(u / rx, v / ry)
        return (k - 1.0) * min(rx, ry)
    return d


def capsule(a, b, r0, r1=None):
    r1 = r0 if r1 is None else r1

    def d(x, y):
        ax, ay = a
        bx, by = b
        px, py = x - ax, y - ay
        vx, vy = bx - ax, by - ay
        L = vx * vx + vy * vy
        t = 0.0 if L == 0 else max(0.0, min(1.0, (px * vx + py * vy) / L))
        return math.hypot(px - vx * t, py - vy * t) - (r0 + (r1 - r0) * t)
    return d


def path(points, r0, r1=None):
    """A thick line through several points, tapering from r0 to r1."""
    r1 = r0 if r1 is None else r1
    segs = list(zip(points[:-1], points[1:]))
    lens = [math.dist(a, b) for a, b in segs]
    total = sum(lens) or 1.0
    parts, run = [], 0.0
    for (a, b), L in zip(segs, lens):
        ra = r0 + (r1 - r0) * run / total
        rb = r0 + (r1 - r0) * (run + L) / total
        parts.append(capsule(a, b, ra, rb))
        run += L

    def d(x, y):
        return min(p(x, y) for p in parts)
    return d


def triangle(a, b, c):
    pts = [a, b, c]

    def side(p, q, x, y):
        return (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0])

    def d(x, y):
        best = 1e9
        for k in range(3):
            (x0, y0), (x1, y1) = pts[k], pts[(k + 1) % 3]
            vx, vy = x1 - x0, y1 - y0
            px, py = x - x0, y - y0
            L = vx * vx + vy * vy
            t = max(0.0, min(1.0, (px * vx + py * vy) / L))
            best = min(best, math.hypot(px - vx * t, py - vy * t))
        s = [side(pts[k], pts[(k + 1) % 3], x, y) for k in range(3)]
        inside = all(v >= 0 for v in s) or all(v <= 0 for v in s)
        return -best if inside else best
    return d


def union(*fs):
    def d(x, y):
        return min(f(x, y) for f in fs)
    return d


def two_bone(j, foot, l1, l2, bend):
    """The knee of a leg from joint j to foot, bending toward +x (bend 1) or -x (-1)."""
    dx, dy = foot[0] - j[0], foot[1] - j[1]
    D = math.hypot(dx, dy)
    D = min(D, l1 + l2 - 1e-3)
    a = math.acos(max(-1.0, min(1.0, (l1 * l1 + D * D - l2 * l2) / (2 * l1 * D))))
    base = math.atan2(dy, dx)
    # Two answers; take the one on the asked side.
    k1 = (j[0] + l1 * math.cos(base + a), j[1] + l1 * math.sin(base + a))
    k2 = (j[0] + l1 * math.cos(base - a), j[1] + l1 * math.sin(base - a))
    return k1 if (k1[0] - k2[0]) * bend > 0 else k2


# ---- the picture ---------------------------------------------------------------

class Part:
    """One piece of a figure: where it is, and how it is coloured.

    `paint(x, y, light)` gives the letter for a cell inside it; `light` runs
    0 (turned from the light) to 1 (facing it). `group` keeps parts apart:
    where a part meets one of a lower group, its edge is drawn a step darker,
    the way a near leg is told from the body behind it."""

    def __init__(self, sdf, paint, group=0):
        self.sdf = sdf
        self.paint = paint
        self.group = group


def limb(parts, slot):
    """Mark parts as a limb of one of a chimera's three parts ("head", "body",
    "hind"): a limb is drawn whole by its part even where it reaches a little
    past the fold (scripts/characters/chimera.py), where everything else is
    cut at the crease. Drawn whole, nothing changes."""
    for part in parts:
        part.limb = slot
    return parts


def light_at(sdf, x, y, d, reach=2.6):
    e = 0.25
    gx = sdf(x + e, y) - sdf(x - e, y)
    gy = sdf(x, y + e) - sdf(x, y - e)
    g = math.hypot(gx, gy) or 1.0
    nx, ny = gx / g, gy / g
    edge = 1.0 - max(0.0, min(1.0, -d / reach))
    return max(0.0, min(1.0, 0.625 + 0.5 * (nx * LIGHT[0] + ny * LIGHT[1]) * edge))


def ramp(steps):
    """A paint from a ramp of letters, darkest first, dithered at each step."""
    def paint(x, y, light, i, j):
        n = len(steps)
        v = light * n - 0.5
        k = int(math.floor(v))
        frac = v - k
        if frac > bayer(i, j):
            k += 1
        return steps[max(0, min(n - 1, k))]
    return paint


def raster(parts, w, h, ink_dark="o", ink_light="p", deep="d"):
    """Draw the parts (back to front) into rows of letters, outlined."""
    cells = [["." for _ in range(w)] for _ in range(h)]
    owner = [[-1 for _ in range(w)] for _ in range(h)]
    edge = [[False for _ in range(w)] for _ in range(h)]
    for n, part in enumerate(parts):
        for j in range(h):
            for i in range(w):
                x, y = i + 0.5, j + 0.5
                d = part.sdf(x, y)
                if d > 0.0:
                    continue
                cells[j][i] = part.paint(x, y, light_at(part.sdf, x, y, d), i, j)
                owner[j][i] = n
                edge[j][i] = d > -0.9
    # A part's own edge, where it lies over a part of a lower group, steps down.
    for j in range(h):
        for i in range(w):
            n = owner[j][i]
            if n < 0 or not edge[j][i]:
                continue
            for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                a, b = i + di, j + dj
                if 0 <= a < w and 0 <= b < h and owner[b][a] >= 0 and \
                        parts[owner[b][a]].group < parts[n].group and cells[j][i] not in "kKy":
                    cells[j][i] = deep
                    break
    # The outline: dark where the shape turns from the light, the coat's
    # deepest step where it faces it.
    out = [row[:] for row in cells]
    for j in range(h):
        for i in range(w):
            if cells[j][i] != ".":
                continue
            lit = 0
            near = False
            for di, dj, k in ((1, 0, 1), (0, 1, 1), (-1, 0, -1), (0, -1, -1)):
                a, b = i + di, j + dj
                if 0 <= a < w and 0 <= b < h and cells[b][a] != ".":
                    near = True
                    lit += k
            if near:
                out[j][i] = ink_light if lit > 0 else ink_dark
    return ["".join(r) for r in out]


# ---- shared by the cast after the fox ---------------------------------------------

def foot_at(phase, x, reach, lift, ground, duty=0.5):
    """Where a foot is at a phase of a gait: on the ground going back for the
    first `duty` of the cycle (0.5 a trot, 0.75 a walk), in the air coming
    forward for the rest."""
    p = phase % 1.0
    if p < duty:
        return (x + reach * (1 - 2 * p / duty), ground)
    q = (p - duty) / (1 - duty)
    return (x - reach + 2 * reach * q, ground - lift * math.sin(math.pi * q))


def strokes(steps, angle=1.68, width=2.4, swing=0.9):
    """A ramp laid in broad strokes, not dithered: the cells across each
    stroke band (`width` cells wide, the marks running at `angle` radians)
    share a step, each band a little lighter or darker than the light alone
    would give, by the golden ratio's fractions, so it reads as a few broad
    marks of a brush (DIRT's grammar 4)."""
    a = angle - math.pi / 2

    def paint(x, y, light, i, j):
        n = len(steps)
        u = x * math.cos(a) + y * math.sin(a)
        band = math.floor(u / width)
        off = ((band * 0.6180339) % 1.0 - 0.5) * swing
        k = int(math.floor(light * n - 0.5 + off + 0.5))
        return steps[max(0, min(n - 1, k))]
    return paint


def flat(steps, cut=0.5):
    """Flat colour, no dither: the lit side one ink, the other its neighbour,
    cut where the light passes `cut` (a cut paper, a screenprint's plate)."""
    def paint(x, y, light, i, j):
        if len(steps) == 1:
            return steps[0]
        return steps[1] if light >= cut else steps[0]
    return paint


def unline(rows):
    """Rows without their outline (o, p): a cut shape has only its edge."""
    return ["".join("." if ch in "op" else ch for ch in r) for r in rows]


def offset_line(rows, dx=1, dy=1, ink="y"):
    """A screenprint's key plate printed out of register: the outline taken
    from the shape itself, shifted by (dx, dy) cells, showing where it falls
    off the colour, so line and colour never quite meet (Warhol's
    misregistration). The shape keeps its own chalk edge; at two pixels a
    cell a line printed over the fills would bury them."""
    h, w = len(rows), len(rows[0])
    base = unline(rows)
    filled = [[ch != "." for ch in r] for r in base]
    out = [list(r) for r in base]
    for j in range(h):
        for i in range(w):
            sj, si = j - dy, i - dx
            inside = 0 <= sj < h and 0 <= si < w and filled[sj][si]
            if not inside:
                continue
            edge = False
            for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                aa, bb = si + a, sj + b
                if not (0 <= aa < w and 0 <= bb < h and filled[bb][aa]):
                    edge = True
            if edge and rows[j][i] == ".":
                out[j][i] = ink
            elif rows[j][i] in "op":
                out[j][i] = rows[j][i]
    for j in range(h):
        for i in range(w):
            if rows[j][i] in "op" and out[j][i] == ".":
                out[j][i] = rows[j][i]
    return ["".join(r) for r in out]
