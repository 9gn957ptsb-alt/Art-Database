"""Royal Nothin — a pixel loop after Ed Bassmaster's short of 20 April 2026.

Artist, 14 Oct 2026, sending the short (youtube.com/shorts/nDsF0a6rVmo): "Recreate a gif like animation of
this YouTube short. Create Ed Bassmaster's character and have it link to his YouTube". In the short a man in
a loud knitted jumper and white-framed shades stands stiff beside the Queen's Life Guard at Horse Guards,
Whitehall — doing, like the trooper, royally nothing — while the horse turns its head about, and then walks
off toward the camera. Ten seconds.

This draws it again in the site's own pixel art, front on and 9:16 as the short is, by the theatre's rules
(scripts/theatre/engine.py) laid flat as the characters' are (scripts/characters/draw.py): every part a
signed distance field decided at the picture's own resolution, light from the upper left choosing a step on
a short hand-picked ramp, steps meeting through a narrow Bayer band, a selective outline (a dark pen on the
sides turned from the light, the part's own deepest step on the sides turned to it). The short's four stills
(YouTube's frames at 0, ¼, ½ and ¾ of its length) were looked at for where things stand and what colour they
are; nothing of them is in the repo, and nothing here is traced. The figure is the bit's costume — the
jumper, the shades, the jeans — on a face of a few cells: no likeness is drawn. The trooper does not move
(that is the joke); the plume stirs; the horse does what horses do; the ground is London's DIRT.

Writes docs/v2/characters/bits/royal-nothin.png (the loop's frames on a grid, palette PNG),
docs/v2/characters/bits/royal-nothin-small.png (the figure and the mounted trooper small, for the globe's
Characters layer and London's skyline) and docs/v2/characters/bits/royal-nothin.json (how to read both).
--gif out.gif writes the loop as a GIF (three times as big), --sheet out.png a contact sheet for checking.
Same bytes every run.

    python3 scripts/characters/royal_nothin.py [--gif out.gif] [--sheet out.png]
"""

import json
import math
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "docs", "v2", "characters", "bits")

W, H = 108, 192           # the picture, in cells (9:16, as the short)
FPS = 12
SECONDS = 10.0
N = int(FPS * SECONDS)    # 120 frames
COLS = 10                 # frames a row in the PNG

BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], float)
LIGHT = np.array([-0.52, -0.62, 0.58])
LIGHT /= np.linalg.norm(LIGHT)


def hexrgb(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def ramp(*hexes):
    return [hexrgb(h) for h in hexes]


# ---- the ramps, dark to light ---------------------------------------------------------------
STONE = ramp("#7d7465", "#a39886", "#c3b8a4", "#d8cfbd", "#e8e1d2")
STONE_JOINT = hexrgb("#8c8271")
INSIDE = ramp("#0f0c0a", "#1a1512", "#262019", "#342b22")
DOOR = ramp("#141814", "#1d231d", "#28302a")
GLASS = ramp("#22262a", "#34404a", "#4c5e6c")
BOARD = ramp("#0b0b0c", "#18181a", "#232326")
GOLD = ramp("#6e5214", "#a77d24", "#d2a945", "#efd27a")
RED = ramp("#5c0d12", "#8e1620", "#b8222c", "#d8443c")
WHITE = ramp("#7f7d78", "#aeaba4", "#d4d1c9", "#eeebe3", "#fbfaf6")
BRASS = ramp("#5a3e10", "#8d6420", "#c09434", "#e6c35c", "#fbeaa0")
SILVER = ramp("#4c5056", "#7d838b", "#b3b9c0", "#e4e8ec")
HORSE = ramp("#07080a", "#121418", "#1f232a", "#343a44", "#556070")
HOOF = ramp("#1c1c1e", "#36363a", "#55555a")
LEATHER = ramp("#050505", "#141210", "#262220")
SKIN_G = ramp("#3d2618", "#5e3c26", "#7f5536", "#9c6c47")          # the trooper's face, under the peak
SKIN = ramp("#6e4129", "#9c6243", "#c08360", "#dca27c", "#efc19c")  # the figure's
HAIR = ramp("#1a0f0a", "#2c1a10", "#43281a", "#5e3a24")
SHADES_FRAME = ramp("#9aa3a8", "#d9e0e3", "#ffffff")
LENS = ramp("#0f5f6e", "#1d97a8", "#45cfd9", "#a8f4f6")
DENIM = ramp("#3e5f86", "#5f84ad", "#82a6cc", "#a7c3e0", "#c6dbee")
SHOE = ramp("#151a33", "#252d55", "#37447a")
SHOE_PINK = ramp("#7a1736", "#b52653", "#e04a78")
SOLE = ramp("#a9a49a", "#e8e4dc")
PAVE = ramp("#7f7a72", "#99938a", "#b0aaa0", "#c4beb3", "#d4cfc5")
SETT = ramp("#4d4840", "#655f55", "#7d766b", "#958d80")
# London's DIRT (docs/v2/dirt-land.png at Horse Guards: #977d57) is what the straw and the sand lie in.
STRAW = ramp("#5b4630", "#7d6545", "#977d57", "#b49866", "#d3b97d")
LINE = ramp("#b9b5ad", "#e9e6df", "#fbfaf6")
SIGN_RED = ramp("#7c1218", "#c4242c", "#e24a46")
PEN = hexrgb("#120d0b")
GREYS = ramp("#000000", "#444444", "#888888", "#bbbbbb", "#ffffff")   # the knit's steps (its colours are the pattern's)
# The jumper's knit: blocks of these in zigzag columns (the colours of the bit's own jumper).
KNIT = [hexrgb(h) for h in ("#c7253a", "#e8b92e", "#2f9b56", "#2c5bb3", "#6a3a9e", "#22a0a4", "#e0702a", "#1d1c26")]


def bayer(xs, ys):
    return (BAYER4[(ys.astype(int)) % 4, (xs.astype(int)) % 4] + 0.5) / 16.0


# ---- distance fields over the grid (negative inside) ----------------------------------------------
class Grid:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.y, self.x = np.mgrid[0:h, 0:w].astype(float)
        self.x += 0.5
        self.y += 0.5


def ellipse(g, cx, cy, rx, ry, turn=0.0):
    c, s = math.cos(turn), math.sin(turn)
    dx, dy = g.x - cx, g.y - cy
    u, v = dx * c + dy * s, -dx * s + dy * c
    k = np.hypot(u / rx, v / ry)
    return (k - 1.0) * min(rx, ry)


def capsule(g, a, b, r0, r1=None):
    r1 = r0 if r1 is None else r1
    ax, ay = a
    bx, by = b
    px, py = g.x - ax, g.y - ay
    vx, vy = bx - ax, by - ay
    L = vx * vx + vy * vy
    t = np.zeros_like(px) if L == 0 else np.clip((px * vx + py * vy) / L, 0.0, 1.0)
    return np.hypot(px - vx * t, py - vy * t) - (r0 + (r1 - r0) * t)


def chain(g, pts, r0, r1=None):
    r1 = r0 if r1 is None else r1
    total = sum(math.dist(a, b) for a, b in zip(pts[:-1], pts[1:])) or 1.0
    d, run = None, 0.0
    for a, b in zip(pts[:-1], pts[1:]):
        L = math.dist(a, b)
        ra = r0 + (r1 - r0) * run / total
        rb = r0 + (r1 - r0) * (run + L) / total
        run += L
        e = capsule(g, a, b, ra, rb)
        d = e if d is None else np.minimum(d, e)
    return d


def box(g, x0, y0, x1, y1, r=0.0):
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    hx, hy = (x1 - x0) / 2 - r, (y1 - y0) / 2 - r
    qx, qy = np.abs(g.x - cx) - hx, np.abs(g.y - cy) - hy
    out = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0))
    return out + np.minimum(np.maximum(qx, qy), 0) - r


def poly(g, pts):
    """A polygon's signed distance (even-odd inside)."""
    n = len(pts)
    d = np.full(g.x.shape, np.inf)
    inside = np.zeros(g.x.shape, bool)
    for i in range(n):
        ax, ay = pts[i]
        bx, by = pts[(i + 1) % n]
        px, py = g.x - ax, g.y - ay
        vx, vy = bx - ax, by - ay
        L = vx * vx + vy * vy or 1.0
        t = np.clip((px * vx + py * vy) / L, 0, 1)
        d = np.minimum(d, np.hypot(px - vx * t, py - vy * t))
        cond = ((ay > g.y) != (by > g.y)) & (g.x < (bx - ax) * (g.y - ay) / ((by - ay) or 1e-9) + ax)
        inside ^= cond
    return np.where(inside, -d, d)


def union(*ds):
    out = ds[0]
    for d in ds[1:]:
        out = np.minimum(out, d)
    return out


def cut(a, b):
    return np.maximum(a, -b)


def wobble(g, d, amp, scale, seed):
    """A lumpy edge (hair, fleece, straw): the field pushed about by a little value noise."""
    return d + amp * (vnoise(g.x / scale, g.y / scale, seed) - 0.5) * 2


def vnoise(x, y, seed=0):
    ix, iy = np.floor(x).astype(np.int64), np.floor(y).astype(np.int64)
    fx, fy = x - ix, y - iy
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)

    def h(i, j):
        v = (i * 374761393 + j * 668265263 + seed * 144269504) & 0xFFFFFFFF
        v = (v ^ (v >> 13)) * 1274126177 & 0xFFFFFFFF
        return ((v ^ (v >> 16)) & 0xFFFF) / 65535.0
    a, b, c, d = h(ix, iy), h(ix + 1, iy), h(ix, iy + 1), h(ix + 1, iy + 1)
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy


def hash2(x, y, seed=0):
    v = (np.asarray(x, np.int64) * 73856093 ^ np.asarray(y, np.int64) * 19349663 ^ seed * 83492791) & 0xFFFFFFFF
    v = (v ^ (v >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((v ^ (v >> 16)) & 0xFFFF) / 65535.0


# ---- the canvas -------------------------------------------------------------------------------------
class Canvas:
    """Cells of colour, with what part and group each belongs to (for the outlines)."""

    def __init__(self, w, h):
        self.g = Grid(w, h)
        self.w, self.h = w, h
        self.rgb = np.zeros((h, w, 3), np.int32)
        self.part = np.zeros((h, w), np.int32)      # 0: nothing
        self.group = np.zeros((h, w), np.int32)
        self.deep = np.zeros((h, w, 3), np.int32)   # the part's own deepest step
        self.parts = [None]                         # part id → {line, pen}

    def copy(self):
        c = Canvas.__new__(Canvas)
        c.g, c.w, c.h = self.g, self.w, self.h
        c.rgb, c.part, c.group, c.deep = self.rgb.copy(), self.part.copy(), self.group.copy(), self.deep.copy()
        c.parts = list(self.parts)
        return c

    def level(self, d, thick, bias=0.0, flat=False):
        """How lit each cell of a part is, 0..1: a rounded part by its normal, a flat one by its facing."""
        if flat:
            return np.full(d.shape, 0.5 + bias)
        gy, gx = np.gradient(d)
        n = np.hypot(gx, gy) + 1e-9
        gx, gy = gx / n, gy / n
        t = np.clip(-d / max(thick, 0.5), 0.0, 1.0)
        nz = np.sqrt(np.clip(1 - (1 - t) ** 2, 0, 1))
        k = np.sqrt(np.clip(1 - nz * nz, 0, 1))
        lum = gx * k * LIGHT[0] + gy * k * LIGHT[1] + nz * LIGHT[2]
        return np.clip(0.5 + 0.62 * lum + bias - 0.2, 0, 1)

    def fill(self, d, rmp, group, thick=3.0, bias=0.0, flat=False, line=True, pen=True, mask=None, lv=None,
             band=0.18, colours=None, noise=0.0, seed=1):
        inside = d < 0
        if mask is not None:
            inside &= mask
        if not inside.any():
            return
        pid = len(self.parts)
        self.parts.append({"line": line, "pen": pen})
        L = self.level(d, thick, bias, flat) if lv is None else lv
        if noise:
            L = L + noise * (vnoise(self.g.x / 2.3, self.g.y / 2.3, seed) - 0.5)
        n = len(rmp) - 1
        v = np.clip(L, 0, 1) * n
        base = np.floor(v)
        frac = v - base
        th = bayer(self.g.x, self.g.y)
        up = np.where(frac > 0.5 + band, 1, np.where(frac < 0.5 - band, 0,
                      ((frac - (0.5 - band)) / (2 * band) > th).astype(int)))
        idx = np.clip(base + up, 0, n).astype(int)
        r = np.array(rmp)
        col = r[idx]
        if colours is not None:   # a pattern's colour, shaded by the step it lands on
            mid = n / 2.0
            k = (idx - mid) / max(mid, 1)
            dark = np.array(PEN)
            col = np.where(k[..., None] < 0, colours + (dark - colours) * (-k[..., None]) * 0.42,
                           colours + (255 - colours) * k[..., None] * 0.16)
            deep = colours + (dark - colours) * 0.55
        else:
            deep = np.broadcast_to(np.array(rmp[0]), col.shape)
        self.rgb[inside] = np.asarray(col)[inside].astype(np.int32)
        self.part[inside] = pid
        self.group[inside] = group
        self.deep[inside] = np.asarray(deep)[inside].astype(np.int32)

    def put(self, mask, rgb, group=None):
        self.rgb[mask] = rgb
        if group is not None:
            self.group[mask] = group

    def outline(self, groups):
        """The selective outline of the groups given: where a part meets what is outside its group, the dark
        pen on the sides turned from the light (right, below), its own deepest step on those turned to it;
        where it lies over another part of its own group painted before it, its own deepest step."""
        part, group = self.part, self.group
        out = self.rgb.copy()
        H, W = part.shape
        for gid in groups:
            mine = group == gid
            for dx, dy, lit in ((1, 0, False), (0, 1, False), (-1, 0, True), (0, -1, True)):
                nb_group = np.full((H, W), -1)
                nb_part = np.full((H, W), -1)
                ys = slice(max(0, -dy), H - max(0, dy))
                xs = slice(max(0, -dx), W - max(0, dx))
                ys2 = slice(max(0, dy), H - max(0, -dy))
                xs2 = slice(max(0, dx), W - max(0, -dx))
                nb_group[ys, xs] = group[ys2, xs2]
                nb_part[ys, xs] = part[ys2, xs2]
                edge = mine & (nb_group != gid)
                pens = np.array([bool(p and p["pen"]) for p in self.parts])
                penned = pens[part]
                if lit:
                    out[edge & penned] = self.deep[edge & penned]
                else:
                    out[edge & penned] = PEN
                lines = np.array([bool(p and p["line"]) for p in self.parts])
                inner = mine & (nb_group == gid) & (nb_part < part) & (nb_part > 0) & lines[part]
                out[inner & ~edge] = self.deep[inner & ~edge]
        self.rgb = out


# ---- the place: Horse Guards' sentry arch -------------------------------------------------------------
ARCH_L, ARCH_R, SPRING, GROUND = 37.0, 78.0, 34.0, 133.0
ARCH_CX = (ARCH_L + ARCH_R) / 2
ARCH_RAD = (ARCH_R - ARCH_L) / 2
PAVE_Y = 137.0

FONT = {   # 3 × 5, for BEWARE
    "B": ["110", "101", "110", "101", "110"], "E": ["111", "100", "110", "100", "111"],
    "W": ["101", "101", "101", "111", "101"], "A": ["010", "101", "111", "101", "101"],
    "R": ["110", "101", "110", "101", "101"],
}


def background():
    c = Canvas(W, H)
    g = c.g
    every = np.full((H, W), -1.0)
    # The stone: Portland, in courses, the joints a step darker, weathered toward the foot.
    wall = every
    lv = 0.62 + 0.18 * (vnoise(g.x / 7, g.y / 5, 3) - 0.5) - np.clip((g.y - 90) / 160, 0, 0.25)
    c.fill(wall, STONE, 0, lv=lv, line=False, pen=False, band=0.22)
    course = 11
    row = np.floor(g.y / course)
    joint_h = (g.y % course) < 1.0
    stag = np.where(row % 2 == 0, 0, 11)
    joint_v = ((g.x + stag) % 22) < 1.0
    joints = (joint_h | joint_v) & (g.y < GROUND)
    c.rgb[joints] = STONE_JOINT
    # The imposts at the arch's springing, and the plinth along the foot.
    for x0, x1 in ((0, ARCH_L - 1), (ARCH_R + 1, W)):
        d = box(g, x0, SPRING - 4, x1, SPRING)
        c.fill(d, STONE, 0, lv=np.where(g.y < SPRING - 3, 0.95, 0.7), line=False, pen=False)
        under = box(g, x0, SPRING, x1, SPRING + 1.5) < 0
        c.rgb[under] = STONE[1]
    plinth = box(g, 0, GROUND - 7, W, PAVE_Y) < 0
    c.fill(box(g, 0, GROUND - 7, W, PAVE_Y), STONE, 0, lv=0.42 + 0.12 * (vnoise(g.x / 4, g.y / 3, 9) - 0.5),
           line=False, pen=False)
    c.rgb[plinth & ((g.y % 7) < 1.0)] = STONE_JOINT
    # The arch: a moulded ring of voussoirs round a dark opening.
    ring = union(capsule(g, (ARCH_CX, SPRING), (ARCH_CX, SPRING), ARCH_RAD + 4.0),
                 box(g, ARCH_L - 4, SPRING, ARCH_R + 4, GROUND))
    opening = union(capsule(g, (ARCH_CX, SPRING), (ARCH_CX, SPRING), ARCH_RAD),
                    box(g, ARCH_L, SPRING, ARCH_R, GROUND + 6))
    moulding = cut(ring, opening)
    c.fill(moulding, STONE, 0, lv=0.78 + 0.1 * ((g.x - ARCH_CX) < 0), line=False, pen=False)
    # Voussoir joints, radiating over the arch.
    ang = np.arctan2(g.y - SPRING, g.x - ARCH_CX)
    vj = (np.abs(((ang + math.pi) / (math.pi / 9)) % 1 - 0.5) > 0.44) & (moulding < 0) & (g.y < SPRING)
    c.rgb[vj] = STONE_JOINT
    # Inside: dark, a door at the back, a window over it, the setts underfoot.
    c.fill(opening, INSIDE, 0, lv=0.18 + 0.5 * np.clip((g.y - SPRING) / 140, 0, 1) * 0
           + 0.25 * np.clip(1 - np.abs(g.x - ARCH_CX) / ARCH_RAD, 0, 1), line=False, pen=False)
    door = box(g, ARCH_CX - 8, 62, ARCH_CX + 9, GROUND + 2)
    c.fill(door, DOOR, 0, lv=0.45 + 0.25 * ((g.x % 4) < 1), mask=opening < 0, line=False, pen=False)
    win = box(g, ARCH_CX - 9, 30, ARCH_CX + 10, 56, 1.5)
    c.fill(win, GLASS, 0, lv=0.25 + 0.6 * np.clip((56 - g.y) / 26, 0, 1) * (g.x < ARCH_CX + 2), mask=opening < 0,
           line=False, pen=False)
    bars = ((np.abs(g.x - ARCH_CX - 0.5) < 0.6) | (np.abs(g.y - 43) < 0.6)) & (win < 0)
    c.rgb[bars] = INSIDE[0]
    inside_floor = (opening < 0) & (g.y >= GROUND - 4)
    setts = inside_floor
    sx = np.floor((g.x + np.where(np.floor(g.y / 2) % 2 == 0, 0, 1.5)) / 3)
    sy = np.floor(g.y / 2)
    sv = hash2(sx, sy, 5)
    c.rgb[setts] = np.array(SETT)[np.clip((sv * 2.2).astype(int), 0, 3)][setts] * 0.55
    # The board on the left pier: BEWARE, and the lines under it.
    bx0, by0, bx1, by1 = 3, 58, 33, 84
    c.fill(box(g, bx0, by0, bx1, by1, 0.6), BOARD, 0, flat=True, line=False, pen=False)
    rim = (box(g, bx0, by0, bx1, by1, 0.6) < 0) & (box(g, bx0 + 1, by0 + 1, bx1 - 1, by1 - 1) >= 0)
    c.rgb[rim] = GOLD[1]
    c.rgb[(box(g, bx0 - 0.5, by0 - 0.5, bx1 + 0.5, by1 + 0.5) < 0) & (box(g, bx0, by0, bx1, by1, 0.6) >= 0)] = PEN
    text_x = int((bx0 + bx1) / 2 - 11.5)
    for i, ch in enumerate("BEWARE"):
        for j, rowbits in enumerate(FONT[ch]):
            for k, bit in enumerate(rowbits):
                if bit == "1":
                    c.rgb[by0 + 3 + j, text_x + i * 4 + k] = GOLD[3]
    c.rgb[by0 + 9, text_x:text_x + 23] = GOLD[2]
    for yy, x0, x1, gaps in ((by0 + 12, bx0 + 4, bx1 - 3, (10, 14, 18)), (by0 + 15, bx0 + 9, bx1 - 9, (13,)),
                             (by0 + 18, bx0 + 3, bx1 - 2, (5, 10, 14, 18, 23)), (by0 + 21, bx0 + 10, bx1 - 9, (15,))):
        for xx in range(x0, x1):
            if (xx - x0) not in gaps:
                c.rgb[yy, xx] = GOLD[2] if yy < by0 + 20 else GOLD[1]
    # The prohibition sign below it.
    sd = ellipse(g, 11, 93, 6.2, 6.2)
    c.fill(sd, SIGN_RED, 0, flat=True, bias=0.1, line=False, pen=False)
    c.fill(ellipse(g, 11, 93, 4.4, 4.4), WHITE, 0, flat=True, bias=0.4, line=False, pen=False)
    c.rgb[(np.abs((g.x - 11) + (g.y - 93)) < 0.8) & (ellipse(g, 11, 93, 4.4, 4.4) < 0)] = SIGN_RED[1]
    c.rgb[(np.abs(sd) < 0.6)] = PEN
    # The pavement: big slabs in a little perspective, the line visitors keep behind, London's DIRT in the
    # straw and sand round the box.
    pave = box(g, -2, PAVE_Y, W + 2, H + 2)
    lv = 0.55 + 0.1 * (vnoise(g.x / 5, g.y / 3, 11) - 0.5) + 0.12 * np.clip((g.y - PAVE_Y) / 60, 0, 1)
    c.fill(pave, PAVE, 0, lv=lv, line=False, pen=False, band=0.25)
    for yy in (139, 150, 166, 186):
        c.rgb[(np.abs(g.y - yy) < 0.5) & (pave < 0)] = PAVE[0]
    for x0 in (8, 34, 60, 86):
        slope = (x0 - 54) / 70.0
        xs = x0 + slope * (g.y - PAVE_Y)
        c.rgb[(np.abs(g.x - xs) < 0.5) & (pave < 0)] = PAVE[0]
    line = capsule(g, (36, 192), (108, 160), 1.3)
    c.fill(line, LINE, 0, lv=0.6 + 0.4 * (vnoise(g.x / 2, g.y / 2, 13) > 0.35), line=False, pen=False)
    straw_area = union(ellipse(g, ARCH_CX + 6, GROUND + 6, 34, 9), ellipse(g, ARCH_CX + 22, GROUND + 14, 18, 5))
    straw = (straw_area < 0) & (hash2(g.x, g.y, 21) > 0.45 + 0.4 * np.clip((straw_area + 6) / 6, 0, 1))
    c.rgb[straw] = np.array(STRAW)[np.clip((hash2(g.x, g.y, 22) * 4.99).astype(int), 0, 4)][straw]
    # a scrap of paper on the pavement (it is in the short)
    c.rgb[(box(g, 92, 172, 96, 174) < 0)] = WHITE[3]
    c.rgb[(box(g, 92, 174, 96, 175) < 0)] = PAVE[0]
    return c


# ---- the trooper on his horse ------------------------------------------------------------------------
HEADS = {   # the horse's head: where its poll and muzzle are, and how far it is turned to the camera
    "low": dict(poll=(93.5, 59), muzzle=(106, 78), turn=0.0),
    "up": dict(poll=(95, 51), muzzle=(108.5, 64), turn=0.0),
    "toward": dict(poll=(94.5, 55), muzzle=(99, 73), turn=1.0),
    "right": dict(poll=(96, 56), muzzle=(109, 70), turn=0.0),
}
HOOF_Y = 132.0


def lerp(a, b, t):
    return a + (b - a) * t


def lerp2(a, b, t):
    return (lerp(a[0], b[0], t), lerp(a[1], b[1], t))


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def head_at(t):
    """The horse's head through the ten seconds: low, up, toward the camera, turned away, low again."""
    keys = [(0.0, "low"), (1.9, "low"), (2.9, "up"), (4.3, "up"), (5.3, "toward"), (7.0, "toward"),
            (7.9, "right"), (9.3, "right"), (10.0, "low")]
    for (t0, a), (t1, b) in zip(keys[:-1], keys[1:]):
        if t0 <= t <= t1:
            k = ease((t - t0) / max(t1 - t0, 1e-6))
            A, B = HEADS[a], HEADS[b]
            h = {key: (lerp2(A[key], B[key], k) if isinstance(A[key], tuple) else lerp(A[key], B[key], k))
                 for key in A}
            # a toss of the head at 3.6 s, a shake at 8.5 s
            for tt, amp in ((3.6, -3.0), (8.5, 2.0)):
                s = math.exp(-((t - tt) / 0.18) ** 2)
                h["muzzle"] = (h["muzzle"][0], h["muzzle"][1] + amp * s)
                h["poll"] = (h["poll"][0], h["poll"][1] + amp * 0.6 * s)
            return h
    return HEADS["low"]


def mounted(c, ox, oy, k, t, group=1):
    """The horse, the trooper on it, in the picture's own cells (ox, oy: where its origin is put; k: scale).
    The trooper does nothing at all — that is the joke; his plume stirs; the horse turns its head about,
    flicks an ear, swishes its tail and shifts a hind hoof."""
    g = c.g

    def P(x, y):
        return (ox + x * k, oy + y * k)

    def R(r):
        return max(0.5, r * k)

    h = head_at(t)
    turn = h["turn"]
    # the tail: hanging, swished at 1.4 s and 6.1 s
    sw = sum(math.sin((t - tt) * 9) * math.exp(-((t - tt) / 0.5) ** 2) for tt in (1.4, 6.1))
    tail = chain(g, [P(43, 84), P(39.5 + sw * 2, 98), P(38.5 + sw * 4, 112), P(40 + sw * 3, 123)], R(3.6), R(2.0))
    c.fill(wobble(g, tail, R(0.8), R(1.6), 4), HORSE, group, thick=R(2), bias=-0.05)
    # the legs, the far pair darker, then the near; a hind hoof lifted and set down at 5.5 s
    lift = 2.5 * math.exp(-((t - 5.5) / 0.3) ** 2)
    for (x0, y0), (xk, yk), (x1, y1), far in (
            ((53, 99), (55, 113), (55, HOOF_Y), True), ((81, 99), (82, 114), (82, HOOF_Y), True),
            ((47, 98), (46, 113), (48, HOOF_Y - lift), False), ((76, 99), (77, 114), (77.5, HOOF_Y), False)):
        leg = chain(g, [P(x0, y0), P(xk, yk), P(x1, y1 - 4)], R(4.4), R(1.8))
        c.fill(leg, HORSE, group, thick=R(2.2), bias=-0.2 if far else 0.0)
        fet = ellipse(g, *P(x1, y1 - 3.4), R(2.2), R(1.6))
        c.fill(fet, HORSE, group, thick=R(1), bias=-0.2 if far else -0.05)
        hoof = poly(g, [P(x1 - 2.0, y1 - 2.6), P(x1 + 2.0, y1 - 2.6), P(x1 + 2.8, y1 + 0.4), P(x1 - 2.4, y1 + 0.4)])
        c.fill(hoof, HOOF, group, thick=R(1.2), bias=-0.1 if far else 0.05)
    # the barrel, the quarters, the chest
    body = union(ellipse(g, *P(64, 91), R(21), R(10.5)), ellipse(g, *P(49, 89), R(10.5), R(11.5)),
                 ellipse(g, *P(80, 90), R(8.5), R(11.5)))
    c.fill(body, HORSE, group, thick=R(8), bias=0.03)
    # the neck, heavy, rising to the head
    poll = P(*h["poll"])
    muzzle = P(*h["muzzle"])
    neck = poly(g, [P(70, 83), P(87, 88), (poll[0] + R(3.5), poll[1] + R(6)), (poll[0] - R(5.5), poll[1] + R(2)),
                    P(67, 78)])
    neck = union(neck, capsule(g, P(78, 84), (poll[0] - R(1), poll[1] + R(5)), R(7.0), R(4.0)))
    c.fill(neck, HORSE, group, thick=R(5))
    mane = chain(g, [P(68, 78), (poll[0] - R(5.5), poll[1] + R(1.5)), (poll[0] - R(1.5), poll[1] - R(1))], R(1.7))
    c.fill(wobble(g, mane, R(0.6), R(1.2), 7), HORSE, group, bias=-0.32, thick=R(1))
    # the head: long from the side, shorter and wider turned toward us
    length = math.dist(poll, muzzle)
    head = capsule(g, (poll[0], poll[1] + R(1.5)), muzzle, R(5.2 + 1.2 * turn), R(3.4 + 1.0 * turn))
    head = union(head, ellipse(g, poll[0] + (muzzle[0] - poll[0]) * 0.25, poll[1] + (muzzle[1] - poll[1]) * 0.25 + R(1.5),
                               R(5.4 + turn), R(4.6)))
    c.fill(head, HORSE, group, thick=R(4), bias=0.07)
    nostril = ellipse(g, muzzle[0] - R(1.0 + turn), muzzle[1] - R(0.2), R(0.9), R(0.7))
    c.fill(nostril, HORSE, group, flat=True, bias=-0.5, pen=False, line=False)
    # ears, flicked now and then
    flick = 1.5 * math.sin(t * 7) * math.exp(-((t - 2.4) / 0.4) ** 2) + 1.5 * math.exp(-((t - 6.6) / 0.25) ** 2)
    for side in ((-2.2, 2.2) if turn > 0.3 else (-1.0, 1.4)):
        base = (poll[0] + R(side), poll[1])
        tip = (base[0] + R(flick * 0.6 + side * 0.5 - 0.4), base[1] - R(6.5))
        ear = capsule(g, base, tip, R(1.8), R(0.55))
        c.fill(ear, HORSE, group, thick=R(1), bias=-0.05)
    # the bridle: a white browband (as in the short), cheekpiece and noseband, a brass boss at the temple
    ux, uy = (muzzle[0] - poll[0]) / max(length, 1e-6), (muzzle[1] - poll[1]) / max(length, 1e-6)
    brow_c = (poll[0] + ux * R(2.5), poll[1] + uy * R(2.5) + R(1))
    brow = capsule(g, (brow_c[0] - R(3.4 + turn), brow_c[1] - R(0.6)), (brow_c[0] + R(3.4 + turn), brow_c[1] + R(0.6)),
                   R(0.9 + 0.3 * turn))
    c.fill(brow, WHITE, group, flat=True, bias=0.3, pen=False)
    nose_c = (poll[0] + ux * length * 0.72, poll[1] + uy * length * 0.72)
    nose = capsule(g, (nose_c[0] - uy * R(4.4), nose_c[1] + ux * R(4.4)), (nose_c[0] + uy * R(4.4), nose_c[1] - ux * R(4.4)), R(0.8))
    c.fill(nose, LEATHER, group, flat=True, bias=0.2, pen=False)
    cheek = capsule(g, brow_c, nose_c, R(0.7))
    c.fill(cheek, LEATHER, group, flat=True, bias=0.3, pen=False)
    boss = ellipse(g, brow_c[0] - uy * R(1.6), brow_c[1] + ux * R(1.6), R(1.4), R(1.4))
    c.fill(boss, BRASS, group, thick=R(1), bias=0.15, pen=False)
    eye_c = (poll[0] + ux * R(5) - uy * R(1.8 - turn * 0.5), poll[1] + uy * R(5) + R(1.5))
    for e_side in ([0.0] if turn < 0.5 else [-2.8, 2.8]):
        eye = ellipse(g, eye_c[0] + R(e_side), eye_c[1], R(1.0), R(0.8))
        c.fill(eye, ramp("#000000", "#2b3440", "#8fa0b0"), group, flat=True, bias=0.0, pen=False, line=False)
    # the breastplate with its brass, the chain reins from the bit to the trooper's hand
    breast = chain(g, [P(68, 79), P(83, 85), P(87, 96)], R(0.9))
    c.fill(breast, LEATHER, group, flat=True, bias=0.3, pen=False)
    for bx_, by_ in ((83, 86), (87, 95)):
        c.fill(ellipse(g, *P(bx_, by_), R(1.3), R(1.3)), BRASS, group, thick=R(1), bias=0.15, pen=False)
    rein = chain(g, [P(69, 77), lerp2(P(69, 77), nose_c, 0.5), nose_c], R(0.5))
    links = rein < 0
    dots = links & (((g.x + g.y).astype(int) % 2) == 0)
    c.rgb[links] = SILVER[1]
    c.rgb[dots] = SILVER[3]
    c.group[links] = group
    # the shabraque under the saddle, the white sheepskin over its front
    cloth = box(g, *P(52, 77), *P(66, 93), R(2))
    c.fill(cloth, ramp("#0b0f1c", "#16203a", "#253259"), group, thick=R(3), bias=-0.05)
    c.fill(box(g, *P(52, 91), *P(66, 93)), GOLD, group, flat=True, bias=-0.1, pen=False)
    fleece = wobble(g, union(ellipse(g, *P(68.5, 81), R(6.5), R(5.5)), ellipse(g, *P(71, 88), R(4.5), R(6))), R(0.9), R(1.1), 17)
    c.fill(fleece, WHITE, group, thick=R(3), bias=0.12)
    # the trooper: white breeches, jackboots to the stirrup, the red tunic, belts, gauntlets
    thigh = capsule(g, P(59, 76), P(67.5, 80), R(3.8), R(3.4))
    c.fill(thigh, WHITE, group, thick=R(2.5), bias=0.05)
    boot = union(chain(g, [P(66, 78), P(64.5, 90), P(64.5, 99)], R(3.3), R(2.5)), ellipse(g, *P(66.3, 100), R(3.6), R(1.7)))
    c.fill(boot, LEATHER, group, thick=R(2.5), bias=0.25)
    c.fill(box(g, *P(66, 76.5), *P(69.5, 80.5), R(1)), LEATHER, group, thick=R(1.5), bias=0.3)   # the boot's top over the knee
    c.fill(capsule(g, P(61.5, 101), P(70.5, 102.5), R(0.6)), SILVER, group, flat=True, bias=0.3, pen=False)
    torso = poly(g, [P(55.5, 57.5), P(68, 57.5), P(69.5, 70), P(67, 78.5), P(57, 78.5), P(54.5, 70)])
    c.fill(torso, RED, group, thick=R(5), bias=0.06)
    c.fill(box(g, *P(57, 75.5), *P(67.5, 77.5)), WHITE, group, flat=True, bias=0.28, pen=False)
    belt = capsule(g, P(56.5, 58.5), P(67.5, 75.5), R(1.1))
    c.fill(belt, WHITE, group, flat=True, bias=0.34, pen=False)
    for bx_ in (59.5, 64):
        c.fill(ellipse(g, *P(bx_, 64.5), R(0.6), R(0.6)), BRASS, group, flat=True, bias=0.4, pen=False, line=False)
    collar = box(g, *P(58.2, 56.5), *P(65.2, 58.6), R(0.6))
    c.fill(collar, GOLD, group, flat=True, bias=0.1, pen=False)
    arm = chain(g, [P(67.5, 59.5), P(70.5, 69), P(69, 76)], R(2.7), R(2.3))
    c.fill(arm, RED, group, thick=R(2), bias=0.0)
    gauntlet = union(capsule(g, P(69, 73), P(69, 78.5), R(2.9), R(2.6)), ellipse(g, *P(69.3, 79.5), R(2.5), R(2.1)))
    c.fill(gauntlet, WHITE, group, thick=R(2), bias=0.12)
    lhand = union(capsule(g, P(56.5, 72), P(61, 76.5), R(2.4)), ellipse(g, *P(62, 77.5), R(2.3), R(1.9)))
    c.fill(lhand, WHITE, group, thick=R(2), bias=0.0)
    # the sword at the carry: from the hand, past the helmet, up into the arch
    blade = capsule(g, P(69.5, 77.5), P(58.5, 34), R(0.7))
    c.fill(blade, SILVER, group, lv=np.where(g.x < P(64, 0)[0], 0.95, 0.72), pen=False)
    c.fill(capsule(g, P(67.5, 75.5), P(71.5, 77.5), R(0.9)), BRASS, group, flat=True, bias=0.3, pen=False)
    # the plume: white horsehair from the spike, cascading over the back and sides of the helmet to the
    # shoulders (drawn before the helmet, so the brass front shows); it stirs in the air
    stir = 0.9 * math.sin(t * 2 * math.pi / 2.6) + 0.5 * math.sin(t * 2 * math.pi / 1.1 + 1)
    strands = []
    for i, dx in enumerate((-7.4, -6.2, -4.8, -3.0, 3.0, 4.8, 6.2, 7.4)):
        sway = stir * (0.25 + 0.06 * i)
        drop = 59.5 - abs(dx) * 0.25
        strands.append(chain(g, [P(61.8, 41.5), P(61.8 + dx * 0.5 + sway * 0.3, 43.5),
                                 P(61.8 + dx * 0.92 + sway * 0.8, 48.5), P(61.8 + dx * 1.02 + sway * 1.2, 54),
                                 P(61.8 + dx * 0.98 + sway * 1.5, drop)], R(1.35), R(0.9)))
    plume = union(*strands, ellipse(g, *P(61.8, 43.8), R(5.2), R(3.4)))
    c.fill(wobble(g, plume, R(0.35), R(0.9), 23), WHITE, group, thick=R(2.6), bias=0.06)
    # hair-lines down the plume, a step darker
    hl = (plume < -0.3) & (((g.x - P(61.8, 0)[0]) * 1.0 + np.sin(g.y * 0.9) * 0.6) % 2.0 < 0.7) & (g.y > P(0, 45)[1])
    c.rgb[hl] = WHITE[2]
    # the face under the peak, the chinstrap of brass scales
    face = ellipse(g, *P(61.8, 54), R(3.3), R(3.9))
    c.fill(face, SKIN_G, group, thick=R(2), bias=0.0)
    c.fill(capsule(g, P(58.6, 52), P(61.8, 57.8), R(0.75)), BRASS, group, flat=True, bias=0.2, pen=False)
    c.fill(capsule(g, P(65.0, 52), P(61.8, 57.8), R(0.75)), BRASS, group, flat=True, bias=0.0, pen=False)
    c.fill(box(g, *P(59.4, 52.6), *P(64.4, 53.6)), SKIN_G, group, flat=True, bias=-0.32, pen=False, line=False)
    # the helmet: a brass bowl, its comb, its peak, the star on the front
    helm = union(ellipse(g, *P(61.8, 47.5), R(4.9), R(4.6)), box(g, *P(56.9, 46.5), *P(66.7, 50.8)))
    c.fill(helm, BRASS, group, thick=R(4), bias=0.1)
    comb = capsule(g, P(61.8, 43.2), P(61.8, 48), R(0.9))
    c.fill(comb, BRASS, group, flat=True, bias=0.35, pen=False)
    peak = poly(g, [P(56.2, 50.4), P(67.4, 50.4), P(66.4, 52.4), P(57.2, 52.4)])
    c.fill(peak, BRASS, group, thick=R(1), bias=-0.18)
    c.fill(ellipse(g, *P(61.8, 48.2), R(1.7), R(1.7)), SILVER, group, flat=True, bias=0.32, pen=False)
    c.fill(capsule(g, P(61.8, 40.2), P(61.8, 43.5), R(0.8)), BRASS, group, flat=True, bias=0.3, pen=False)


# ---- the figure: the bit's costume on a face of a few cells -------------------------------------------
def knit_colours(g, x0, y0, k, seed=0):
    """The jumper's knit: zigzag columns, each broken into blocks of a colour every few rows."""
    u = (g.x - x0) / k
    v = (g.y - y0) / k
    zig = np.abs(((v / 3.0) % 2) - 1) * 2.2
    col = np.floor((u + zig + 40) / 2.6)
    blk = np.floor((v + 0.0) / (5.0 + 2 * hash2(col, 0, seed + 3)))
    pick = (hash2(col, blk, seed) * len(KNIT)).astype(int) % len(KNIT)
    # a fine black fleck along each column's zigzag edge
    edge = ((u + zig + 40) % 2.6) < (0.55 if k >= 0.8 else 0.0)
    out = np.array(KNIT, float)[pick]
    out[edge] = np.array(KNIT[7], float) * 0.9
    return out


def figure(c, bx, by, k, t_pose, group=2, small=False):
    """The man in the jumper. bx, by: where his feet stand; k his scale (1: 83 cells tall).
    t_pose: {"walk": phase or None, "breath": 0..1, "look": -1..1, "chin": 0..1, "smirk": 0..1,
             "glint": 0..1 or None, "arms": 0..1 (1 held out stiff, 0 hanging)}."""
    g = c.g
    p = t_pose
    walk = p.get("walk")

    def P(x, y):
        return (bx + x * k, by + y * k)

    def R(r):
        return max(0.55, r * k)

    br = -1.0 * p.get("breath", 0)
    sw = 0.0 if walk is None else math.sin(walk)
    bob = 0.0 if walk is None else -abs(math.cos(walk)) * 1.2
    arms = p.get("arms", 1.0)
    # legs (in jeans), then the shoes. Walking toward the camera the leg in front plants its foot lower and
    # nearer (a little wider); the one swinging through is lifted, its knee bent out; the weight sways over
    # the planted foot.
    sway = 0.0 if walk is None else 1.3 * sw
    cw = 0.0 if walk is None else math.cos(walk)
    bx = bx + sway * k
    for side in (-1, 1):
        f = 0.0 if walk is None else side * sw
        lift = 0.0 if walk is None else max(0.0, side * cw) * 3.2
        hip = P(side * 5.0, -36 + bob)
        ankle = P(side * 5.6, -4.5 + 3.6 * f - lift)
        knee = P(side * (5.6 + 1.0 * lift / 3.2), (-36 + bob - 4.5 + 3.6 * f - lift) / 2 + 0.6)
        thick = 1.0 + 0.09 * f
        leg = chain(g, [hip, knee, ankle], R(5.0 * thick), R(3.9 * thick))
        c.fill(leg, DENIM, group, thick=R(3), bias=0.05 + 0.04 * side, noise=0.1, seed=31 + side)
        # a seam, faint, down the outside of each leg
        seam = capsule(g, (hip[0] + side * R(3.6), hip[1] + R(2)), (ankle[0] + side * R(2.8), ankle[1] - R(1)), R(0.35))
        c.fill(seam, DENIM, group, flat=True, bias=-0.32, pen=False, line=False, mask=leg < -0.4)
        shoe_c = (ankle[0] + side * R(0.6), ankle[1] + R(2.4))
        shoe = union(ellipse(g, shoe_c[0], shoe_c[1], R(4.6 * thick), R(2.4 * thick)),
                     box(g, shoe_c[0] - R(3.4), shoe_c[1] - R(3.2), shoe_c[0] + R(3.4), shoe_c[1], R(1)))
        c.fill(shoe, SHOE, group, thick=R(2), bias=0.08)
        panel = ellipse(g, shoe_c[0] + side * R(1.4), shoe_c[1] - R(0.6), R(2.2), R(1.4))
        c.fill(panel, SHOE_PINK, group, thick=R(1), bias=0.12, pen=False, mask=shoe < -0.3)
        sole = (shoe < 0) & (g.y > shoe_c[1] + R(1.3))
        c.put(sole, SOLE[1])
    # the jumper: its body, then the arms, each in the knit
    knit = knit_colours(g, bx, by, k, seed=5)
    shoulder_y = -66 + br + bob
    body = poly(g, [P(-12.5, shoulder_y + 1.5), P(-8, shoulder_y - 0.5), P(8, shoulder_y - 0.5), P(12.5, shoulder_y + 1.5),
                    P(12.2, -34 + bob), P(-12.2, -34 + bob)])
    body = union(body, box(g, *P(-12.2, -40 + bob), *P(12.2, -33.5 + bob), R(1.5)))
    c.fill(body, GREYS, group, thick=R(7), bias=0.0, colours=knit)
    hem = (body < 0) & (g.y > P(0, -37 + bob)[1])
    c.rgb[hem] = (c.rgb[hem] * 0.72).astype(np.int32)
    for side in (-1, 1):
        sh = P(side * 11.0, shoulder_y + 3)
        if walk is not None:
            swing = -side * sw
            el = P(side * (14.0 - 1.0 * arms), shoulder_y + 15 + 1.0 * swing)
            wr = P(side * (15.5 - 1.5 * arms) - side * 2.4 * max(0, swing), shoulder_y + 26 + 3.4 * swing)
        else:
            el = P(side * (13.0 + 2.6 * arms), shoulder_y + 15)
            wr = P(side * (14.0 + 6.0 * arms), shoulder_y + 26 - 1.0 * arms)
        arm = chain(g, [sh, el, wr], R(3.6), R(2.9))
        c.fill(arm, GREYS, group, thick=R(2.6), bias=0.04 * -side,
               colours=knit_colours(g, bx + side * 7 * k, by, k, seed=11 + side))
        cuff = capsule(g, lerp2(el, wr, 0.82), wr, R(3.0))
        c.fill(cuff, ramp("#0d0c12", "#1d1c26", "#34323f"), group, thick=R(1.5), mask=arm < 0)
        hand_c = (wr[0] + side * R(0.6 * arms), wr[1] + R(2.6))
        hand = union(ellipse(g, hand_c[0], hand_c[1], R(2.2), R(2.8)),
                     capsule(g, hand_c, (hand_c[0] + side * R(1.6 * arms), hand_c[1] + R(1.8)), R(1.1)))
        c.fill(hand, SKIN, group, thick=R(1.6), bias=0.05)
    # the collar, the neck, the head
    neck = capsule(g, P(0, shoulder_y - 3), P(0, shoulder_y + 1), R(3.2))
    c.fill(neck, SKIN, group, thick=R(2), bias=-0.12)
    collar = cut(ellipse(g, *P(0, shoulder_y + 0.5), R(5.6), R(2.6)), ellipse(g, *P(0, shoulder_y - 0.4), R(3.6), R(1.5)))
    c.fill(collar, ramp("#0d0c12", "#1d1c26", "#34323f"), group, thick=R(1), bias=0.1)
    look = p.get("look", 0.0)
    chin = p.get("chin", 0.0)
    hx, hy = P(look * 1.2, shoulder_y - 9.5 - 1.0 * chin)
    # the hair behind: a curly mullet over the collar
    back = wobble(g, union(ellipse(g, hx, hy - R(1.4), R(7.0), R(7.0)),
                           ellipse(g, hx - R(4.4), hy + R(8.2), R(2.6), R(3.0)),
                           ellipse(g, hx + R(4.4), hy + R(8.2), R(2.6), R(3.0))),
                  R(0.9), R(1.2), 41)
    c.fill(back, HAIR, group, thick=R(3), bias=0.0, noise=0.3, seed=43)
    face = union(ellipse(g, hx, hy + R(0.6), R(5.2), R(6.3)), ellipse(g, hx + R(look * 0.4), hy + R(4.2), R(4.0), R(3.2)))
    c.fill(face, SKIN, group, thick=R(3.2), bias=0.06)
    # stubble along the jaw, the moustache, the mouth (a straight face, a smirk)
    jaw = (face < 0) & (ellipse(g, hx, hy + R(5.4), R(3.6), R(2.0)) < 0) & (hash2(g.x, g.y, 51) > 0.78)
    c.rgb[jaw] = (np.array(SKIN[1]) * 0.9).astype(np.int32)
    tache = capsule(g, (hx - R(2.6) + R(look), hy + R(3.0)), (hx + R(2.6) + R(look), hy + R(3.0)), R(0.75))
    c.fill(tache, HAIR, group, flat=True, bias=0.2, pen=False, line=False)
    sm = p.get("smirk", 0.0)
    mouth = capsule(g, (hx - R(1.6) + R(look), hy + R(4.6)), (hx + R(1.6) + R(look), hy + R(4.6) - R(1.0) * sm), R(0.45))
    c.fill(mouth, ramp("#4a2015", "#6b3020"), group, flat=True, bias=0.0, pen=False, line=False)
    # the hair on top: curls, parted, falling to the brows
    top = wobble(g, union(ellipse(g, hx - R(0.3), hy - R(5.6), R(6.8), R(3.9)), ellipse(g, hx - R(4.9), hy - R(2.4), R(2.4), R(3.2)),
                          ellipse(g, hx + R(5.0), hy - R(2.2), R(2.2), R(3.2))), R(1.1), R(1.0), 47)
    c.fill(top, HAIR, group, thick=R(2.5), bias=0.1, noise=0.35, seed=49)
    # curls: small rings of a lighter step in the hair on top
    curl = (top < -0.4) & (np.abs(vnoise(g.x / max(k * 1.3, 0.6), g.y / max(k * 1.3, 0.6), 53) - 0.5) < 0.07)
    c.rgb[curl] = HAIR[3]
    # the shades: a white wraparound frame, cyan lenses, a glint that crosses them once
    sy = hy + R(0.2)
    frame_d = box(g, hx - R(5.6) + R(look), sy - R(1.6), hx + R(5.6) + R(look), sy + R(1.4), R(0.8))
    c.fill(frame_d, SHADES_FRAME, group, flat=True, bias=0.25, pen=True)
    for side in (-1, 1):
        lc = (hx + R(side * 2.7 + look), sy)
        lens = box(g, lc[0] - R(2.2), lc[1] - R(0.9), lc[0] + R(2.2), lc[1] + R(1.0), R(0.4))
        c.fill(lens, LENS, group, lv=0.35 + 0.3 * (g.y < lc[1]), pen=False, line=False)
    glint = p.get("glint")
    if glint is not None:
        gx = hx - R(6) + R(12) * glint
        gl = (frame_d < 0) & (np.abs((g.x - gx) - (g.y - sy) * 0.6) < R(0.6)) & (np.abs(g.y - sy) < R(1.0))
        c.put(gl, LENS[3])
        c.put(gl & (np.abs(g.x - gx) < R(0.5)), (255, 255, 255))
    # the ears, a little, under the hair's sides
    for side in (-1, 1):
        ear = ellipse(g, hx + side * R(5.4) + R(look * 0.4), hy + R(1.4), R(1.1), R(1.8))
        c.fill(ear, SKIN, group, thick=R(1), bias=-0.12, mask=(back < 0) | (face >= 0))


# ---- the ten seconds ----------------------------------------------------------------------------------
STAND = (30.0, 156.0)
WALK_START = 7.4


def pose_at(t):
    """What the figure does: royally nothing, then he goes."""
    if t < WALK_START:
        breath = 1.0 if (t % 2.7) < 1.1 else 0.0
        look = 0.0
        if 2.2 <= t < 3.9:
            look = ease((t - 2.2) / 0.3) * 1.0          # a glance toward the trooper
        if 3.9 <= t < 4.2:
            look = 1.0 - ease((t - 3.9) / 0.3)
        chin = ease((t - 5.0) / 0.4) if 5.0 <= t < 6.6 else (1.0 - ease((t - 6.6) / 0.3) if 6.6 <= t < 6.9 else 0.0)
        smirk = 1.0 if 4.3 <= t < 5.0 else 0.0
        glint = (t - 5.7) / 0.6 if 5.7 <= t < 6.3 else None
        arms = 1.0 if t < 7.0 else 1.0 - ease((t - 7.0) / 0.4) * 0.6
        return dict(walk=None, breath=breath, look=look, chin=chin, smirk=smirk, glint=glint, arms=arms), STAND, 1.0
    u = t - WALK_START
    phase = u * 2 * math.pi / 0.75
    d = u / (SECONDS - WALK_START)
    k = 1.0 + 0.85 * d ** 1.3
    bx = STAND[0] + 22 * ease(d * 1.1)
    by = STAND[1] + 58 * d ** 1.25
    return dict(walk=phase, breath=0, look=0.0, chin=0.0, smirk=0.0, glint=None, arms=0.35), (bx, by), k


def frame_at(base, i):
    t = i / FPS
    c = base.copy()
    mounted(c, 0, 0, 1.0, t)
    pose, (bx, by), k = pose_at(t)
    figure(c, bx, by, k, pose)
    c.outline([1, 2])
    return np.clip(c.rgb, 0, 255).astype(np.uint8)


# ---- small: the figure and the trooper for the globe and London's skyline -----------------------------
def small_frames():
    out = {}
    # the figure, stiff, 40 cells tall, and walking (four frames)
    for name, pose in (("stand", dict(walk=None, arms=1.0)), ("look", dict(walk=None, arms=1.0, look=1.0)),
                       ("walk0", dict(walk=0.0, arms=0.35)), ("walk1", dict(walk=math.pi / 2, arms=0.35)),
                       ("walk2", dict(walk=math.pi, arms=0.35)), ("walk3", dict(walk=3 * math.pi / 2, arms=0.35))):
        c = Canvas(28, 44)
        figure(c, 14, 42.5, 0.5, pose, group=2, small=True)
        c.outline([2])
        rgba = np.zeros((44, 28, 4), np.uint8)
        rgba[..., :3] = np.clip(c.rgb, 0, 255)
        rgba[..., 3] = np.where(c.group == 2, 255, 0)
        out["figure-" + name] = rgba
    # the trooper on his horse, still, the horse's head in three places
    for name, t in (("low", 0.5), ("up", 3.5), ("toward", 6.0)):
        c = Canvas(44, 58)
        mounted(c, -15.5, -10.5, 0.5, t, group=1)
        c.outline([1])
        rgba = np.zeros((58, 44, 4), np.uint8)
        rgba[..., :3] = np.clip(c.rgb, 0, 255)
        rgba[..., 3] = np.where(c.group == 1, 255, 0)
        out["guard-" + name] = rgba
    return out


def palette_image(frames):
    """Every frame on a grid, as one palette PNG (the same colours in the same order every run)."""
    rows = (len(frames) + COLS - 1) // COLS
    sheet = np.zeros((rows * H, COLS * W, 3), np.uint8)
    for i, f in enumerate(frames):
        r, q = divmod(i, COLS)
        sheet[r * H:(r + 1) * H, q * W:(q + 1) * W] = f
    cols = np.unique(sheet.reshape(-1, 3), axis=0)
    if len(cols) > 256:
        raise SystemExit("too many colours: %d" % len(cols))
    lut = {tuple(c): i for i, c in enumerate(cols)}
    flat = sheet.reshape(-1, 3)
    idx = np.array([lut[tuple(c)] for c in map(tuple, flat)], np.uint8).reshape(sheet.shape[:2])
    im = Image.fromarray(idx, "P")
    pal = cols.flatten().tolist() + [0] * (768 - 3 * len(cols))
    im.putpalette(pal)
    return im, len(cols)


# ---- the bit, as data: where it was filmed, and what is near it on the site -----------------------------
BIT = {
    "key": "royal-nothin",
    "title": "Royal Nothin",
    "who": "Ed Bassmaster",
    "handle": "@edbassmaster",
    "channel": "https://www.youtube.com/@edbassmaster",
    "video": "https://www.youtube.com/shorts/nDsF0a6rVmo",
    "date": "2026-04-20",
    "place": "Horse Guards, Whitehall, London",
    # Horse Guards on OpenStreetMap (way 133153176), as Nominatim gives it.
    "point": [51.50478, -0.12723],
    "pointFrom": "OpenStreetMap, way 133153176 (Horse Guards)",
    "town": "london-gb",
    "said": "A man in a loud knitted jumper and white shades stands stiff beside a trooper of the King's Life "
            "Guard, doing, as the trooper does, nothing, while the horse turns its head about; then he walks off.",
    "loop": "bits/royal-nothin.json",
}


def metres(a, b):
    R = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def write_bits():
    """docs/v2/characters/bits.json: the filmed bits drawn again as characters, each with the works
    painted within 1.2 km of where it was filmed (sites.json: a site or a point of view, never a town)
    and the site's museums within 2 km (museums.json), nearest first."""
    v2 = os.path.join(ROOT, "docs", "v2")
    sites = json.load(open(os.path.join(v2, "sites.json")))["sites"]
    museums = json.load(open(os.path.join(v2, "museums.json")))
    museums = museums.get("museums", museums) if isinstance(museums, dict) else museums
    row = dict(BIT)
    at = row["point"]
    painted = []
    for x in sites:
        if not x.get("ll") or x.get("pr") == "town":
            continue
        m = metres(at, x["ll"])
        if m <= 1200:
            painted.append([round(m), x["id"], x["t"], x.get("a") or "", x.get("d") or 0])
    painted.sort(key=lambda r: (r[0], r[1]))
    near = []
    for x in museums:
        if x.get("lat") is None:
            continue
        m = metres(at, (x["lat"], x["lon"]))
        if m <= 2000:
            near.append([round(m), x["slug"], x["name"]])
    near.sort()
    row["painted"] = painted
    row["museums"] = near
    out = {"note": "Written by scripts/characters/royal_nothin.py. A filmed bit drawn again as a character of the "
                   "site (the artist, 14 Oct 2026); its loop is the site's drawing, the short and the channel are "
                   "YouTube's. painted: [metres, sites.json id, title, artist, year]; museums: [metres, slug, name].",
           "bits": [row]}
    with open(os.path.join(ROOT, "docs", "v2", "characters", "bits.json"), "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")
    return len(painted), len(near)


def main():
    args = sys.argv[1:]
    base = background()
    frames = [frame_at(base, i) for i in range(N)]
    os.makedirs(OUT, exist_ok=True)
    im, ncol = palette_image(frames)
    im.save(os.path.join(OUT, "royal-nothin.png"), optimize=True)
    small = small_frames()
    names = list(small.keys())
    sw = sum(a.shape[1] for a in small.values()) + len(small) - 1
    sh = max(a.shape[0] for a in small.values())
    strip = np.zeros((sh, sw, 4), np.uint8)
    at, where = 0, {}
    for n in names:
        a = small[n]
        strip[sh - a.shape[0]:, at:at + a.shape[1]] = a
        where[n] = [at, sh - a.shape[0], a.shape[1], a.shape[0]]
        at += a.shape[1] + 1
    Image.fromarray(strip, "RGBA").save(os.path.join(OUT, "royal-nothin-small.png"), optimize=True)
    meta = {
        "note": "Written by scripts/characters/royal_nothin.py: a pixel loop after Ed Bassmaster's short "
                "\"Royal Nothin\" (20 April 2026), drawn again in the site's pixel art; nothing of the short is in it.",
        "w": W, "h": H, "fps": FPS, "frames": N, "cols": COLS, "colours": ncol,
        "small": {"file": "royal-nothin-small.png", "sprites": where,
                  "foot": {"figure": [14, 42.5], "guard": [22, 57]}},
        "walkFrom": int(round(WALK_START * FPS)),
    }
    with open(os.path.join(OUT, "royal-nothin.json"), "w") as f:
        json.dump(meta, f, indent=1)
        f.write("\n")
    print("bits.json: painted, museums", write_bits())
    print("frames", N, "colours", ncol, "png", os.path.getsize(os.path.join(OUT, "royal-nothin.png")),
          "small", os.path.getsize(os.path.join(OUT, "royal-nothin-small.png")))
    if "--gif" in args:
        path = args[args.index("--gif") + 1]
        imgs = [Image.fromarray(f).resize((W * 3, H * 3), Image.NEAREST) for f in frames]
        pal = imgs[0].quantize(colors=255, method=Image.Quantize.MEDIANCUT)
        imgs = [m.quantize(palette=pal, dither=Image.Dither.NONE) for m in imgs]
        imgs[0].save(path, save_all=True, append_images=imgs[1:], duration=int(1000 / FPS), loop=0, optimize=False)
        print("gif", path, os.path.getsize(path))
    if "--sheet" in args:
        path = args[args.index("--sheet") + 1]
        pick = [0, 18, 30, 44, 60, 66, 76, 88, 94, 100, 108, 116]
        S = 3
        sheet = Image.new("RGB", (len(pick) // 2 * (W * S + 6), 2 * (H * S + 6)), (255, 255, 255))
        for j, i in enumerate(pick):
            sheet.paste(Image.fromarray(frames[i]).resize((W * S, H * S), Image.NEAREST),
                        ((j % (len(pick) // 2)) * (W * S + 6), (j // (len(pick) // 2)) * (H * S + 6)))
        sheet.save(path)
        Image.fromarray(strip, "RGBA").resize((strip.shape[1] * 4, strip.shape[0] * 4), Image.NEAREST).save(
            path.replace(".png", "-small.png"))
        print("sheet", path)


if __name__ == "__main__":
    main()
