#!/usr/bin/env python3
"""Studies of the artist's impossible triangle in 3D (artist, 15 Oct 2026: "Use the shape with itself to
actually realize its 3D potential, I understand it's an impossible triangle that can only visually exist
like that in 2D. It's okay if all doesn't connect to itself. Explore different ways it can exist 3D").

The drawing (three tribars round an inverted gap) fixes only what is seen down one line of sight; every
point of an object can slide along that line, or be moved by anything that moves a whole sightline
together, and the drawing is unchanged. So one drawing is a whole family of objects. The studies are ten
of them, most made of the figure with itself:

  figure    the figure as built in SketchUp: nine beams on a cube lattice, three tribars
  apart     its tribars slid along the line of sight so that none touches another
  closed    its three cuts joined by struts that point straight down the line of sight
  figures   the figure's own rule applied to the figure: three of it round a gap (nine tribars)
  turns     with two copies turned a third and two thirds about its own line of sight
  tower     four of it, turned a quarter and a storey up each, closing from four corners
  drawn     stretched four times along the line of sight
  bent      bowed along the line of sight by where it is in the drawing
  point     in perspective, for one eye: every point drawn in or out along its line from the eye
  siblings  three different objects (other turns and depths of the tribars) with the same drawing

Model axes are SketchUp's (x, y, z up) in cells of the lattice (18 in in SketchUp, half a block in Rocket);
the drawing is seen looking down -(1, 1, 1), its up (0, -1, 1). A box is a parallelepiped: its centre,
three half-edges, and the tone of each pair of faces, by the axis the face looked along in the figure
(0 grey for X, 1 black for Y, 2 white for Z, as the drawing has them). A hex is a box drawn in towards
an eye: its eight corners, its faces still planes.

    python3 scripts/figure_studies.py                    # writes docs/worlds/rocket/figures.json
    python3 scripts/figure_studies.py --sheet out.png    # and a sheet: each study closed, then turned twice

The same ten are built in SketchUp, by the same rules, by scripts/sketchup/impossible_triangle_studies.py.
Needs numpy (and Pillow for --sheet).
"""
import json
import math
import os
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
H = 0.11                                      # half a beam, in cells (the drawing's proportion)
ORDERS = [(1, 0, 2), (0, 2, 1), (2, 1, 0)]    # a tribar's path, axis by axis, in its three turns
OFFS = [np.zeros(3), np.array([0, 1.0, 0]), np.array([1.0, 1, 0])]
BASE = [np.array(c, float) for c in [(0, 0, 0), (0, 1, 0), (1, 1, 0)]]
CONF = [(0, 0.0), (1, -1.0), (1, -1.0)]       # the drawing's tribars: (turn, depth) each, fitted to it
NH = np.ones(3) / math.sqrt(3)                # the line of sight, towards the eye
UPV = np.array([0, -1.0, 1]) / math.sqrt(2)   # the drawing's up
RV = np.cross(-NH, UPV)                       # and its right
CENTRE = np.array([1 / 3, 1, -1 / 3])         # the middle of the drawn triangle's corners
UPRIGHT = np.array([0.5, 0.5, 0])             # the tower's storeys turn about the upright through here
# The turns of a third about the line of sight through the origin: they take tribar 0 to tribars 1, 2.
L = [np.eye(3), np.array([[0, 1, 0], [0, 0, 1], [1, 0, 0]], float), np.array([[0, 0, 1], [1, 0, 0], [0, 1, 0]], float)]


class Box:
    """A parallelepiped: centre c, half-edges E (rows), the tone of each pair of faces, the part it is in."""

    def __init__(self, c, E, tone=(0, 1, 2), part=""):
        self.c = np.array(c, float)
        self.E = np.array(E, float)
        self.tone = tuple(tone)
        self.part = part

    @staticmethod
    def aabb(lo, hi, part=""):
        lo, hi = np.array(lo, float), np.array(hi, float)
        return Box((lo + hi) / 2, np.diag((hi - lo) / 2), (0, 1, 2), part)

    def slabs(self):
        N = np.array([np.cross(self.E[(k + 1) % 3], self.E[(k + 2) % 3]) for k in range(3)])
        N /= np.linalg.norm(N, axis=1, keepdims=True)
        return N, np.abs(np.einsum("ij,ij->i", self.E, N))

    def moved(self, M=np.eye(3), t=np.zeros(3), about=np.zeros(3), part=None):
        """p -> M (p - about) + about + t. A face pair facing a world axis afterwards takes that axis's tone."""
        M = np.array(M, float)
        b = Box(M @ (self.c - about) + about + t, (M @ self.E.T).T, self.tone, self.part if part is None else part)
        N, _ = b.slabs()
        tones = []
        for k in range(3):
            ax = np.abs(N[k])
            j = int(ax.argmax())
            tones.append(j if ax[j] > 0.999 else self.tone[k])
        b.tone = tuple(tones)
        return b

    def corners(self):
        s = np.array([[x, y, z] for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)], float)
        return self.c + s @ self.E


class Hex:
    """A box drawn in towards an eye: its eight corners in the order Box.corners() gives them (z fastest,
    then y, then x), its faces still planes, the tone of each pair of faces, the part it is in."""

    def __init__(self, P, tone=(0, 1, 2), part=""):
        self.P = np.array(P, float)
        self.tone = tuple(tone)
        self.part = part

    def corners(self):
        return self.P

    def faces(self):
        """(pair, the four corners round the face) for each of the six faces."""
        out = []
        for k in range(3):
            u, v = (k + 1) % 3, (k + 2) % 3
            for side in (0, 1):
                ring = []
                for bu, bv in ((0, 0), (1, 0), (1, 1), (0, 1)):
                    bits = [0, 0, 0]
                    bits[k], bits[u], bits[v] = side, bu, bv
                    ring.append(self.P[4 * bits[0] + 2 * bits[1] + bits[2]])
                out.append((k, np.array(ring)))
        return out

    def halfspaces(self):
        """Each face's outward normal n and offset w (inside, n . x <= w), and its pair."""
        mid = self.P.mean(0)
        N, w, pair = [], [], []
        for k, ring in self.faces():
            n = np.cross(ring[1] - ring[0], ring[3] - ring[0])
            n /= np.linalg.norm(n)
            if n @ (ring.mean(0) - mid) < 0:
                n = -n
            N.append(n); w.append(n @ ring.mean(0)); pair.append(k)
        return np.array(N), np.array(w), pair


def drawn_in(boxes, eye, F, U, f, g, beta, mid=(0.0, 0.0), part=None):
    """The boxes as the drawing seen from one eye, in perspective. A point at (a, b) in the drawing and d
    along its line of sight goes to eye + (g ((a - a0) R + (b - b0) U) + f F) / (1 + beta d): every point
    on one line of sight of the drawing onto one ray from the eye, nearer for the nearer, so that from the
    eye it is the drawing exactly, at g / f radians a cell. The map is a projective one, so a box's faces
    stay planes."""
    F = np.array(F, float) / np.linalg.norm(F)
    U = np.array(U, float)
    U = U - F * (U @ F)
    U /= np.linalg.norm(U)
    R = np.cross(F, U)
    out = []
    for b in boxes:
        q = b.corners() - CENTRE
        a, bb, d = q @ RV - mid[0], q @ UPV - mid[1], q @ NH
        P = np.array(eye, float) + (g * (a[:, None] * R + bb[:, None] * U) + f * F) / (1 + beta * d)[:, None]
        out.append(Hex(P, b.tone, b.part if part is None else part))
    return out


def tribar(c, r, part=""):
    out, p = [], np.array(c, float) + OFFS[r]
    for ax in ORDERS[r]:
        q = p.copy()
        q[ax] += 1
        out.append(Box.aabb(np.minimum(p, q) - H, np.maximum(p, q) + H, part))
        p = q
    return out


def figure(conf=CONF, names="ABC"):
    """The drawing's figure as nine beams, its three tribars named by `names`."""
    return [b for (r, t), base, nm in zip(conf, BASE, names) for b in tribar(base + t, r, nm)]


def moves(conf=CONF):
    return [(r, BASE[i] + t * np.ones(3) + OFFS[r]) for i, (r, t) in enumerate(conf)]


def level(k, conf=CONF):
    """The figure's own rule k - 1 times over tribar 0: level 2 is the drawing, 3 three of it round a gap."""
    shape = tribar(np.zeros(3), 0)
    for j in range(1, k):
        s = 2 ** (j - 1)
        shape = [b.moved(L[r], t=s * d) for (r, d) in moves(conf) for b in shape]
    return shape


def bbox(boxes):
    c = np.concatenate([b.corners() for b in boxes])
    return c.min(0), c.max(0)


def strut(p, q, w, part="Struts"):
    p, q = np.array(p, float), np.array(q, float)
    a = (q - p) / 2
    u = np.cross(a, [1.0, -1, 0])
    u = u / np.linalg.norm(u) * w
    v = np.cross(a, u)
    v = v / np.linalg.norm(v) * w
    return Box((p + q) / 2, np.array([a, u, v]), (2, 2, 2), part)


def quarter(k):
    c, s = round(math.cos(k * math.pi / 2)), round(math.sin(k * math.pi / 2))
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], float)


def bend(p):
    """Every point moved along the line of sight by a bow across the drawing and a lean up it."""
    q = p - CENTRE
    a, b = q @ RV, q @ UPV
    return p + NH * (1.6 * a * a - 0.9 * b)


DIAG = {"kind": "ortho", "dir": [-1, -1, -1], "up": [0, -1, 1]}


def studies():
    F = figure()
    out = []

    def add(key, name, idea, boxes, views, lofts=None):
        out.append({"key": key, "name": name, "idea": idea, "boxes": boxes, "views": views, "lofts": lofts})

    add("figure", "The figure",
        "The drawing as one object: nine square beams on the edges of a lattice of cubes, three tribars, "
        "whose ends meet only down the diagonal.", F, [DIAG])

    add("apart", "Apart",
        "Its three tribars slid along the line of sight, two cells either way, so that none touches another. "
        "From the diagonal the frame is the same and the middle crosses the other way.",
        [b.moved(t=np.ones(3) * {"A": 0, "B": 2, "C": -2}[b.part]) for b in F], [DIAG])

    add("closed", "Closed",
        "The three cuts joined by struts that run straight down the line of sight, hidden behind the nearer "
        "end. It is one closed object; only from the diagonal is it impossible.",
        F + [strut((0, 0, 0), (1, 1, 1), 0.8 * H), strut((-1, 1, -1), (0, 2, 0), 0.8 * H), strut((0, 1, -1), (1, 2, 0), 0.8 * H)],
        [DIAG])

    l3 = level(3)
    names = ["First figure", "Second figure", "Third figure"]
    add("figures", "Figure of figures",
        "The rule that makes the figure from three tribars, each the first turned a third about the diagonal "
        "and moved, applied to the figure itself: three of it round a gap, nine tribars.",
        [b.moved(part=names[i // 9]) for i, b in enumerate(l3)], [DIAG])

    add("turns", "Three turns",
        "The figure with two copies of itself turned a third and two thirds about its own line of sight. "
        "The frames fall on each other; the three middles cross through one another.",
        [b.moved(part="The figure") for b in F] + [b.moved(L[1], about=CENTRE, part="Turned a third") for b in F] +
        [b.moved(L[2], about=CENTRE, part="Turned two thirds") for b in F], [DIAG])

    # The upright the storeys turn about stands in the middle of a cell, not on a beam: about a beam, the
    # uprights of the storey below would line up with this one's from three of the corners and draw its
    # legs on past where they end.
    tower, views = [], []
    storeys = ["Ground storey", "Second storey", "Third storey", "Top storey"]
    for k in range(4):
        M, rise = quarter(k), np.array([0, 0, 3.2 * k])
        storey = [b.moved(M, about=UPRIGHT, t=rise, part=storeys[k]) for b in F]
        tower += storey
        views.append(frame_view({"boxes": storey, "lofts": None}, {"kind": "ortho", "dir": (M @ np.array([-1.0, -1, -1])).tolist(),
                                                                   "up": (M @ np.array([0, -1.0, 1])).tolist()}, 3.0))
    add("tower", "Tower",
        "Four of it, each turned a quarter about the upright and set a storey higher. Walk round it: from each "
        "corner a different one closes, the others crossing above and below.", tower, views)

    M = np.eye(3) + 3 * np.outer(NH, NH)
    add("drawn", "Drawn out",
        "Stretched four times along the line of sight. Nothing changes from the diagonal; from the side the "
        "beams lean into long ramps.", [b.moved(M, about=CENTRE) for b in F], [DIAG])

    lofts = []
    for b in F:
        k = int(np.argmax(np.linalg.norm(b.E, axis=1)))
        i, j = [a for a in range(3) if a != k]
        ring = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
        st = [[bend(b.c + s * b.E[k] + x * b.E[i] + y * b.E[j]) for (x, y) in ring] for s in np.linspace(-1, 1, 17)]
        lofts.append({"stations": st, "tone": [b.tone[j], b.tone[i], b.tone[k]], "part": b.part})
    add("bent", "Bent",
        "Every point moved along the line of sight by a bow across the drawing. From the diagonal the beams are "
        "straight; from anywhere else they curve away.", [], [DIAG], lofts)

    E = CENTRE + NH * 9.0
    add("point", "One point",
        "For one eye, in perspective, as the large outdoor ones are made: every point moved along its line from "
        "that eye, the near parts drawn in small and the far ones out large, so that from there it is the drawing "
        "exactly. A step to the side and it comes apart.",
        drawn_in(F, E, -NH, UPV, 9.0, 1.0, 0.3),
        [{"kind": "persp", "eye": E.tolist(), "target": CENTRE.tolist(), "up": [0, -1, 1], "fov": 26}])

    sib = []
    for k, (conf, nm) in enumerate(zip([[(0, 0.0), (1, -1), (1, -1)], [(0, 0.0), (2, -1), (1, -1)], [(0, 0.0), (2, -1), (2, -1)]],
                                       ["First", "Second", "Third"])):
        off = (k - 1) * 1.55 * np.array([-2.0, 1, 1])
        sib += [b.moved(t=off, part=nm) for b in figure(conf)]
    add("siblings", "Siblings",
        "Three different objects that all draw the figure: its tribars turned and set at other depths. One "
        "drawing never fixes one object.", sib, [DIAG])
    return out


def loft_boxes(lofts):
    """Corner boxes standing in for bent beams, for framing."""
    pts = np.array([p for lf in lofts for st in lf["stations"] for p in st])
    return pts


def extent(s):
    pts = np.concatenate([b.corners() for b in s["boxes"]] + ([loft_boxes(s["lofts"])] if s["lofts"] else []))
    return pts


def frame_view(s, v, span=None):
    """An ortho view's centre and span, from the study's own points, unless it names them; `span` fixes the span."""
    if v["kind"] != "ortho" or "centre" in v:
        return v
    d = -np.array(v["dir"], float)
    d /= np.linalg.norm(d)
    u = np.array(v["up"], float)
    u = u - d * (u @ d)
    u /= np.linalg.norm(u)
    r = np.cross(-d, u)
    pts = extent(s)
    m = pts.mean(0)
    a, b = (pts - m) @ r, (pts - m) @ u
    c = m + r * (a.min() + a.max()) / 2 + u * (b.min() + b.max()) / 2
    return dict(v, centre=c.tolist(), span=float(span or 1.1 * max(a.max() - a.min(), b.max() - b.min())))


def export(path):
    out = []
    for s in studies():
        d = {"key": s["key"], "name": s["name"], "idea": s["idea"], "views": [frame_view(s, v) for v in s["views"]]}
        seen, boxes, hexes = set(), [], []
        for b in s["boxes"]:
            if isinstance(b, Hex):
                hexes.append([round(float(x), 4) for x in b.P.flatten()] + list(b.tone) + [b.part])
                continue
            row = [round(float(x), 4) for x in [*b.c, *b.E.flatten()]]
            if tuple(row) in seen:
                continue
            seen.add(tuple(row))
            boxes.append(row + list(b.tone) + [b.part])
        d["boxes"] = boxes
        if hexes:
            d["hexes"] = hexes
        if s["lofts"]:
            d["lofts"] = [{"s": [round(float(x), 4) for st in lf["stations"] for p in st for x in p], "t": lf["tone"], "part": lf["part"]}
                          for lf in s["lofts"]]
        pts = extent(s)
        d["frame"] = [round(float(x), 3) for x in [*pts.min(0), *pts.max(0)]]
        for v in d["views"]:
            for k in ("dir", "up", "centre", "eye", "target"):
                if k in v:
                    v[k] = [round(float(x), 4) for x in v[k]]
            if "span" in v:
                v["span"] = round(float(v["span"]), 3)
        out.append(d)
    with open(path, "w") as f:
        json.dump({"note": "Studies of the artist's impossible triangle in 3D, written by scripts/figure_studies.py. Model axes "
                           "(z up), in cells of the lattice. A box: its centre, three half-edges, the tone of each pair of faces "
                           "(0 grey, 1 black, 2 white), its part. A hex: a box drawn in towards an eye, its eight corners (z fastest, then y, "
                           "then x), the tones of its pairs of faces, its part. A loft: a bent beam, 17 stations of 4 corners, the tones of "
                           "its sides along its first and second edges and of its ends.", "studies": out}, f, separators=(",", ":"))
    return out


# ---- a check sheet, by ray-casting the boxes -------------------------------------------------------

def cast(boxes, O, D):
    shp = O.shape[:-1]
    best, tone = np.full(shp, np.inf), np.full(shp, -1)
    for b in boxes:
        if isinstance(b, Hex):
            # Any convex beam by its six faces: in where the ray crosses the last face it enters by.
            N, w, pair = b.halfspaces()
            num, den = w - O @ N.T, D @ N.T
            with np.errstate(divide="ignore", invalid="ignore"):
                t = num / den
            enter, leave = np.where(den < 0, t, -np.inf), np.where(den > 0, t, np.inf)
            tn, tf, ax = enter.max(-1), leave.min(-1), enter.argmax(-1)
            ok = ((den != 0) | (num >= 0)).all(-1)
            hit = ok & (tn <= tf) & (tf > 0) & (tn < best)
            best[hit] = tn[hit]
            tone[hit] = np.array(b.tone)[np.array(pair)[ax[hit]]]
            continue
        N, w = b.slabs()
        o, dd = (O - b.c) @ N.T, D @ N.T
        with np.errstate(divide="ignore", invalid="ignore"):
            t0, t1 = (-w - o) / dd, (w - o) / dd
        lo = np.nan_to_num(np.minimum(t0, t1), nan=-np.inf)
        hi = np.nan_to_num(np.maximum(t0, t1), nan=np.inf)
        tn, tf, ax = lo.max(-1), hi.min(-1), lo.argmax(-1)
        hit = (tn <= tf) & (tf > 0) & (tn < best)
        best[hit] = tn[hit]
        tone[hit] = np.array(b.tone)[ax[hit]]
    return tone


def sliced(s):
    """Bent beams as short parallelepipeds between stations, for the sheet."""
    out = list(s["boxes"])
    for lf in s["lofts"] or []:
        st = np.array(lf["stations"])
        for m in range(len(st) - 1):
            a, b = st[m], st[m + 1]
            c = (a.mean(0) + b.mean(0)) / 2
            E = np.array([(b.mean(0) - a.mean(0)) / 2, (a[1] - a[0] + b[1] - b[0]) / 4, (a[3] - a[0] + b[3] - b[0]) / 4])
            out.append(Box(c, E, (lf["tone"][2], lf["tone"][1], lf["tone"][0])))
    return out


def sheet(path, size=240):
    from PIL import Image, ImageDraw
    col = {-1: (240, 236, 228), 0: (128, 128, 128), 1: (0, 0, 0), 2: (255, 255, 255)}
    ss = studies()
    img = Image.new("RGB", (size * 3, (size + 24) * len(ss)), "white")
    dr = ImageDraw.Draw(img)

    def pic(t):
        a = np.zeros(t.shape + (3,), np.uint8)
        for k, c in col.items():
            a[t == k] = c
        return Image.fromarray(a)

    ys, xs = np.mgrid[0:size, 0:size]
    for n, s in enumerate(ss):
        boxes = sliced(s)
        y0 = n * (size + 24)
        dr.text((6, y0 + 6), s["name"], fill=(0, 0, 0))
        v = frame_view(s, s["views"][0])
        if v["kind"] == "ortho":
            d = np.array(v["dir"], float)
            d /= np.linalg.norm(d)
            u = np.array(v["up"], float)
            u = u - d * (u @ d)
            u /= np.linalg.norm(u)
            r = np.cross(d, u)
            sx, sy = (xs + 0.5) / size * 2 - 1, 1 - (ys + 0.5) / size * 2
            O = np.array(v["centre"]) + (sx[..., None] * r + sy[..., None] * u) * v["span"] / 2 - d * 100
            closed = cast(boxes, O, np.broadcast_to(d, O.shape))
        else:
            closed = persp(boxes, v["eye"], v["target"], v["up"], v["fov"], size, xs, ys)
        img.paste(pic(closed), (0, y0 + 24))
        pts = extent(s)
        lo, hi = pts.min(0), pts.max(0)
        c, R = (lo + hi) / 2, np.linalg.norm(hi - lo) / 2
        for m, dv in enumerate([(1.0, -0.55, 0.45), (-0.35, -1.0, 0.25)]):
            dv = np.array(dv) / np.linalg.norm(dv)
            img.paste(pic(persp(boxes, c + dv * R / math.tan(math.radians(17)) * 1.05, c, (0, 0, 1), 34, size, xs, ys)), ((m + 1) * size, y0 + 24))
    img.save(path)


def persp(boxes, eye, target, up, fov, size, xs, ys):
    eye = np.array(eye, float)
    f = np.array(target, float) - eye
    f /= np.linalg.norm(f)
    u = np.array(up, float)
    u = u - f * (u @ f)
    u /= np.linalg.norm(u)
    r = np.cross(f, u)
    th = math.tan(math.radians(fov) / 2)
    sx, sy = ((xs + 0.5) / size * 2 - 1) * th, (1 - (ys + 0.5) / size * 2) * th
    D = f + sx[..., None] * r + sy[..., None] * u
    D /= np.linalg.norm(D, axis=-1, keepdims=True)
    return cast(boxes, np.broadcast_to(eye, D.shape), D)


if __name__ == "__main__":
    data = export(os.path.join(ROOT, "docs", "worlds", "rocket", "figures.json"))
    print("figures.json:", ", ".join("%s %d" % (d["key"], len(d["boxes"]) + len(d.get("lofts", []))) for d in data))
    if "--sheet" in sys.argv:
        sheet(sys.argv[sys.argv.index("--sheet") + 1])
