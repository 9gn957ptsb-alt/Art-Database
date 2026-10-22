#!/usr/bin/env python3
"""Nesting the unit with itself (wf6/levels).

Slot geometry of the figure, in the drawing (a, b) about its centre, for any bar half-width H (cells; L = sqrt(2/3)
is the drawn length of a cell edge):
  outline        equilateral, side (2 + 6H) L, centroid (0, 0)
  tribar i       outline side (1 + 6H) L, sharing the figure's corner i; centroid t_i:
                 A (0, L/sqrt3 * 2/2 * ...) -> A (0, 0.4714), B (0.4082, -0.2357), C (-0.4082, -0.2357)
  hole of i      side (1 - 6H) L, centred on t_i;   gap: side (1 - 6H) L, inverted, centred on (0, 0)
Relations (exact in the drawing for every H):
  OF  a copy at r = (1+6H)/(2+6H) centred on t_i has outline = tribar i's outline   (golden: r = 1/phi)
  IN  a copy at g = (1-6H)/(2+6H) centred on t_i fills hole i edge to edge; the point reflection of the
      figure at g centred on (0, 0) fills the inverted gap edge to edge          (golden: g = phi^-4 = r^4)
"""
import math
import sys

import numpy as np

sys.path.insert(0, "/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf1/design-nesting")
import unit as U  # noqa: E402
import weave_test as W  # noqa: E402
import lv  # noqa: E402

PHI = lv.PHI
HG, H9 = lv.HG, lv.H9
CENTRE, RV, UPV, NH, DIAG = lv.CENTRE, lv.RV, lv.UPV, lv.NH, lv.DIAG
LL = math.sqrt(2 / 3)
TRI = {"A": np.array([0.0, 2 * LL / math.sqrt(3) / 2 * 1.0]),      # placeholder, set below
       "B": None, "C": None}
_apex = np.array([0.0, 2 * LL / math.sqrt(3)])                      # centreline apex (0, 0.9428)
_bl = np.array([-LL, -LL / math.sqrt(3)])
_br = np.array([LL, -LL / math.sqrt(3)])
_lm, _rm, _bm = (_apex + _bl) / 2, (_apex + _br) / 2, (_bl + _br) / 2
TRI = {"A": (_apex + _lm + _rm) / 3, "B": (_rm + _bm + _br) / 3, "C": (_lm + _bl + _bm) / 3}
GAP = np.zeros(2)
PREF = -np.eye(3)                       # the point reflection through the centre: the inverted figure, on the lattice
R180 = 2 * np.outer(NH, NH) - np.eye(3)  # the half turn about the line of sight (NOT a lattice map)


def r_of(H):
    return (1 + 6 * H) / (2 + 6 * H)


def g_of(H):
    return (1 - 6 * H) / (2 + 6 * H)


def point(ab):
    """The 3D point of drawing position (a, b) at depth 0 (the centre's plane)."""
    return CENTRE + ab[0] * RV + ab[1] * UPV


def unit(H=HG, kind="woven", slices=16):
    if kind == "woven":
        return W.woven(H, slices)
    if kind == "lattice":
        return U.unit(H, curved=False)
    raise ValueError(kind)


class Copy(lv.Copy):
    def __init__(self, *a, carry=False, slot="", **k):
        super().__init__(*a, **k)
        self.carry = carry
        self.slot = slot


def child(parent, s, M, ab, t=0.0, carry=False, slot="", **kw):
    """A copy at relative scale s, rotation M, centred on the parent's drawing point ab, depth t (in the
    parent's units, along the parent's (1,1,1))."""
    c = lv.Copy.child(parent, s, M, point(ab), t)
    out = Copy(c.s, c.M, c.c, c.t, carry=carry or parent_carry(parent), slot=parent.slot + slot, **kw)
    return out


def parent_carry(p):
    return getattr(p, "carry", False)


def prims(copies, u):
    out = []
    for cp in copies:
        if getattr(cp, "carry", False):
            tone_of = lambda k: k  # noqa: E731  (tones carried with the faces: the drawing turned, not lit)
        else:
            perm = np.abs(cp.M).argmax(0)
            tone_of = lambda k, perm=perm: int(perm[k])  # noqa: E731
        tone = tuple(tone_of(k) for k in range(3))
        for nm, tb, cs in u:
            for C in cs:
                out.append(U.Prim(cp.map(C), tone, nm, cp.level))
    return out


# ---- the two relations -------------------------------------------------------------------------------

def holes(parent, H=HG, level=None, gap="pref", t=0.0):
    """IN: the four copies at g that fill the parent's openings (three upright in the tribars' openings, one
    inverted in the gap: the point reflection 'pref' (a lattice figure, lit by the same rule) or 'r180'
    (the drawing turned upside down, tones carried) or None)."""
    g = g_of(H)
    lev = parent.level + 1 if level is None else level
    out = [child(parent, g, np.eye(3), TRI[k], t, slot=k, level=lev, kind="up") for k in "ABC"]
    if gap == "pref":
        out.append(child(parent, g, PREF, GAP, t, slot="G", level=lev, kind="down"))
    elif gap == "r180":
        out.append(child(parent, g, R180, GAP, t, carry=True, slot="G", level=lev, kind="down"))
    return out


def corners(parent, H=HG, level=None, turns=False, t=None):
    """OF: the three copies at r whose outlines are the parent's tribars' outlines. Depths: the figure's own
    rule -- its tribars B and C lie one step of (1,1,1) behind A (figure_studies CONF) -- scaled to the copy."""
    r = r_of(H)
    lev = parent.level + 1 if level is None else level
    depth = {"A": 0.0, "B": -1.0, "C": -1.0} if t is None else {k: t for k in "ABC"}
    out = []
    for k in "ABC":
        M = np.eye(3)
        out.append(child(parent, r, M, TRI[k], depth[k] * r, slot=k, level=lev, kind="up"))
    return out


# ---- views --------------------------------------------------------------------------------------------

def drawing_view(prm, span=None, w=900, centre_ab=(0.0, 0.0), extent=None):
    """The drawing: orthographic down the line of sight, image up = u. `extent` (a0, a1, b0, b1) or a span."""
    if extent is None:
        sp = span or 2.9
        a0, a1 = centre_ab[0] - sp / 2, centre_ab[0] + sp / 2
        b0, b1 = centre_ab[1] - sp / 2 * 0.92, centre_ab[1] + sp / 2 * 0.92
    else:
        a0, a1, b0, b1 = extent
    O, D = lv.drawing_rays(a0, a1, b0, b1, w)
    return lv.cast(prm, O, D, want_level=True, want_depth=True)


def turned_view(prm, az, el, centre, span, w=600, h=None):
    """Orthographic, the line of sight turned by az about the vertical (z) and tilted by el."""
    d0 = -NH
    def rot(axis, ang):
        axis = np.asarray(axis, float) / np.linalg.norm(axis)
        K = np.array([[0, -axis[2], axis[1]], [axis[2], 0, -axis[0]], [-axis[1], axis[0], 0]])
        return np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * K @ K
    M = rot((0, 0, 1), math.radians(az))
    d = M @ d0
    side = np.cross(d, (0, 0, 1)); side /= np.linalg.norm(side)
    d = rot(side, math.radians(el)) @ d
    up = UPV if abs(az) < 1e-9 and abs(el) < 1e-9 else np.array([0, 0, 1.0])
    O, D = lv.ortho_rays(d, up, centre, span, w, h)
    return lv.cast(prm, O, D, want_level=True, want_depth=True)


PAL = {-1: (246, 243, 236), 0: (128, 128, 128), 1: (12, 12, 12), 2: (250, 250, 250)}


def picture(tone, lev=None, bg=(246, 243, 236), tint=None, outline=True):
    a = np.zeros(tone.shape + (3,), np.uint8)
    a[...] = bg
    for k in (0, 1, 2):
        a[tone == k] = PAL[k]
    if tint is not None and lev is not None:
        for L, col in tint.items():
            m = (lev == L) & (tone >= 0)
            base = a[m].astype(float)
            a[m] = np.clip(base * (1 - col[3]) + np.array(col[:3]) * col[3], 0, 255).astype(np.uint8)
    if outline:
        # a thin dark line wherever the tone or the level changes (the original's outlines)
        key = tone * 64 + (lev if lev is not None else 0)
        e = np.zeros(tone.shape, bool)
        e[:, 1:] |= key[:, 1:] != key[:, :-1]
        e[1:, :] |= key[1:, :] != key[:-1, :]
        e &= (tone >= 0) | np.roll(tone >= 0, 1, 0) | np.roll(tone >= 0, 1, 1)
        a[e] = (a[e].astype(float) * 0.45).astype(np.uint8)
    return a


# ---- depth orders for siblings that overlap (OF) --------------------------------------------------------
# The figure's own tribars are layered cyclically at their joints: A's inner bar over B at the right-middle
# point, B over C at the bottom-middle, C over A at the left-middle (wf1/vectorize occlusions). Siblings can be
#   'strict'  A in front of B in front of C (a possible layering);
#   'cyclic'  each sibling tilted along the line of sight, rising towards the joint where it lies over the
#             next (A over B over C over A), the figure's own impossible order one level up;
#   'flat'    all at one depth (the unit's own weave decides).
JOINT = {"AB": (_rm), "BC": (_bm), "CA": (_lm)}           # the joints, in the parent's drawing
OVER = {"A": ("AB", "CA"), "B": ("BC", "AB"), "C": ("CA", "BC")}   # (where it lies over, where it lies under)


def tilt_dir(k):
    over, under = OVER[k]
    v = JOINT[over] - JOINT[under]
    return v / np.linalg.norm(v)


class Tilted(Copy):
    """A copy whose points are moved along (1,1,1) by kappa * ((a, b) - centre) . v (in the copy's own
    drawing units): its drawing is unchanged, its depth rises towards one side."""

    def __init__(self, base, kappa, v):
        super().__init__(base.s, base.M, base.c, base.t, level=base.level, info=base.info, kind=base.kind,
                         carry=getattr(base, "carry", False), slot=getattr(base, "slot", ""))
        self.kappa, self.v = kappa, np.asarray(v, float)

    def map(self, P):
        Q = super().map(P)
        abq = (Q - self.c) @ np.stack([RV, UPV], 1)          # drawing offset from the copy's centre (world units)
        return Q + (self.kappa * (abq @ self.v))[:, None] * DIAG


def order_siblings(sibs, mode, kappa=1.0, step=1.0):
    """Re-place OF siblings (slots ending A, B, C) by a depth order."""
    out = []
    for cp in sibs:
        k = cp.slot[-1]
        if mode == "strict":
            dt = {"A": 0.0, "B": -1.0, "C": -2.0}[k] * step * cp.s
            out.append(Copy(cp.s, cp.M, cp.c, cp.t + dt, level=cp.level, info=cp.info, kind=cp.kind, slot=cp.slot))
        elif mode == "cyclic":
            out.append(Tilted(Copy(cp.s, cp.M, cp.c, cp.t, level=cp.level, info=cp.info, kind=cp.kind, slot=cp.slot), kappa, tilt_dir(k)))
        else:
            out.append(Copy(cp.s, cp.M, cp.c, cp.t, level=cp.level, info=cp.info, kind=cp.kind, slot=cp.slot))
    return out


# ---- the golden split: n parts in a frame by the figure's own rule ------------------------------------

class Slot:
    def __init__(self, ab, s, path):
        self.ab, self.s, self.path = np.asarray(ab, float), float(s), path


def golden_split(n, H=HG):
    """Split a frame (scale 1, centre (0,0)) by the figure's own rule -- three corners at r round an open gap --
    always the first of the largest slots in reading order (A top, B bottom-right, C bottom-left), until there
    are at least n slots (each split adds two). Returns the slots in reading order and the open gaps."""
    r = r_of(H)
    slots = [Slot((0, 0), 1.0, "")]
    gaps = []
    while len(slots) < n:
        smax = max(sl.s for sl in slots)
        i = next(j for j, sl in enumerate(slots) if sl.s == smax)
        sl = slots.pop(i)
        kids = [Slot(sl.ab + sl.s * TRI[k], sl.s * r, sl.path + k) for k in "ABC"]
        slots[i:i] = kids
        gaps.append(Slot(sl.ab, sl.s * g_of(H), sl.path + "G"))
    return slots, gaps


def assign(parts, H=HG):
    """parts: list of (key, weight, payload). Heaviest first (ties: the parts' own order) into the largest slots
    (ties: reading order). Returns [(part, slot)] and the slots left open."""
    slots, gaps = golden_split(len(parts), H)
    order_s = sorted(range(len(slots)), key=lambda j: (-slots[j].s, j))
    order_p = sorted(range(len(parts)), key=lambda j: (-parts[j][1], j))
    pairs = [(parts[p], slots[s]) for p, s in zip(order_p, order_s)]
    used = set(order_s[:len(parts)])
    left = [slots[j] for j in range(len(slots)) if j not in used]
    return pairs, left, gaps


def kappa_of(H=HG, steps=1.0):
    """The cyclic tilt of siblings. The woven tribar rises one step of (1,1,1) round its three corners (1/3 a
    beam); the figure of figures does the same round its three joints: each sibling rises 1/3 of a step, at
    the parent's scale, from the joint where it lies under its neighbour to the joint where it lies over the
    next (the joints are L apart at the parent's scale). Slope = steps / (3 L) steps of (1,1,1) per unit of
    drawing, the same at every level. At each joint the sibling over is then 1/3 step (parent's scale) in front
    of the one under."""
    return steps / (3 * LL)


def place_tree(node, frame, H=HG, kappa=None, level=0, out=None, depth_fn=None):
    """node: {'key', 'weight', 'parts': [...]}; frame: Copy (scale, centre, depth, tilt). A node with parts is
    the golden split of its frame into them (OF); a node without parts is drawn as the unit in its frame.
    Returns the leaves as Copies (with .info) and the open slots/gaps per node."""
    out = out if out is not None else {"leaves": [], "open": [], "gaps": [], "frames": []}
    kappa = kappa_of(H) if kappa is None else kappa
    out["frames"].append((node, frame, level))
    parts = node.get("parts") or []
    if not parts:
        frame.info = node
        frame.level = level
        out["leaves"].append(frame)
        return out
    plist = [(p.get("key"), p.get("weight", 1), p) for p in parts]
    pairs, left, gaps = assign(plist, H)
    for (key, w, p), sl in pairs:
        cf = slot_frame(frame, sl, H, kappa, level + 1)
        place_tree(p, cf, H, kappa, level + 1, out)
    for sl in left:
        out["open"].append((frame, sl))
    for sl in gaps:
        out["gaps"].append((frame, sl))
    return out


class Frame(Copy):
    """A copy with an accumulated tilt: depth (along (1,1,1)) += sum over its ancestors' splits of
    kappa * ((a, b) - centre_j) . v_j, so every sibling rises towards the joint where it lies over the next."""

    def __init__(self, s, c, t=0.0, tilts=(), level=0, slot=""):
        super().__init__(s, np.eye(3), c, t, level=level, slot=slot)
        self.tilts = list(tilts)       # (centre (3,), slope vector in the drawing (2,))

    def map(self, P):
        Q = self.s * (np.asarray(P) - CENTRE) + self.c + self.t * DIAG
        if self.tilts:
            ab_ = np.stack([(Q - CENTRE) @ RV, (Q - CENTRE) @ UPV], -1)
            dz = np.zeros(len(Q))
            for c, v in self.tilts:
                abc = np.array([(c - CENTRE) @ RV, (c - CENTRE) @ UPV])
                dz += (ab_ - abc) @ v
            Q = Q + dz[:, None] * DIAG
        return Q


def slot_frame(frame, sl, H, kappa, level):
    """The frame of a slot inside `frame` (slot geometry is relative to a frame of scale 1 at centre (0,0))."""
    ab_world = np.array([(frame.c - CENTRE) @ RV, (frame.c - CENTRE) @ UPV]) + frame.s * sl.ab
    c = point(ab_world)
    tilts = list(frame.tilts)
    # each split along the slot's path adds a tilt for the corner taken, about that split's centre
    pab = np.array([(frame.c - CENTRE) @ RV, (frame.c - CENTRE) @ UPV])
    ps = frame.s
    r = r_of(H)
    for k in sl.path:
        v = tilt_dir(k) * kappa
        tilts.append((point(pab), v))
        pab = pab + ps * TRI[k]
        ps = ps * r
    return Frame(frame.s * sl.s, c, frame.t, tilts, level=level, slot=frame.slot + sl.path + "/")


# ---- the golden Huffman: any number of parts, each sized by how much it holds ---------------------------

def weight(node):
    """How much a thing holds: the number of leaves (details) under it; a leaf weighs 1."""
    if "w" not in node:
        ps = node.get("parts") or []
        node["w"] = 1 if not ps else sum(weight(p) for p in ps)
    return node["w"]


def huffman(parts):
    """Join the three lightest into a figure of three (heaviest at A top, then B bottom-right, C bottom-left),
    and repeat until one is left. If the count is even, the first join takes four, the lightest of them going
    into the opening between the other three (the gap). Two parts: the heavier is the frame, the lighter in its
    opening. Ties: the parts' own order. Returns a join tree: ('leaf', part) or ('join', [A, B, C], gap|None)."""
    items = [(weight(p), i, ("leaf", p)) for i, p in enumerate(parts)]
    if len(items) == 1:
        return items[0][2]
    if len(items) == 2:
        (w0, i0, a), (w1, i1, b) = sorted(items, key=lambda x: (-x[0], x[1]))
        return ("pair", a, b)
    seq = len(items)
    first = True
    while len(items) > 1:
        items.sort(key=lambda x: (x[0], x[1]))
        k = 4 if (first and len(items) % 2 == 0) else 3
        take, items = items[:k], items[k:]
        first = False
        gap = None
        if k == 4:
            gap = take[0]          # the lightest of the four
            take = take[1:]
        corners = sorted(take, key=lambda x: (-x[0], x[1]))
        node = ("join", [c[2] for c in corners], gap[2] if gap else None)
        wsum = sum(c[0] for c in corners) + (gap[0] if gap else 0)
        items.append((wsum, seq, node))
        seq += 1
    return items[0][2]


def place_huffman(node, frame, H=HG, kappa=None, level=0, out=None, sub=None):
    """Lay a node's parts into its frame by the golden Huffman; recurse into every part. Leaves (no parts) are
    drawn as the unit in their frame. Every frame carries (.info = node, .level = information level)."""
    out = out if out is not None else {"leaves": [], "frames": [], "gaps_used": 0, "joins": 0}
    kappa = kappa_of(H) if kappa is None else kappa
    if sub is None:
        frame.info, frame.level = node, level
        out["frames"].append(frame)
        parts = node.get("parts") or []
        if not parts:
            out["leaves"].append(frame)
            return out
        sub = huffman(parts)
        return place_huffman(node, frame, H, kappa, level, out, sub)
    kind = sub[0]
    if kind == "leaf":
        f = Frame(frame.s, frame.c, frame.t, frame.tilts, level=level + 1, slot=frame.slot)
        return place_huffman(sub[1], f, H, kappa, level + 1, out)
    if kind == "pair":
        a, b = sub[1], sub[2]
        place_huffman(node, frame, H, kappa, level, out, a)
        gf = gap_frame(frame, H, level + 1)
        out["gaps_used"] += 1
        return place_huffman(node, gf, H, kappa, level, out, b)
    out["joins"] += 1
    corners, gap = sub[1], sub[2]
    r = r_of(H)
    fab = np.array([(frame.c - CENTRE) @ RV, (frame.c - CENTRE) @ UPV])
    for k, c in zip("ABC", corners):
        ab_ = fab + frame.s * TRI[k]
        tilts = list(frame.tilts) + [(point(fab), tilt_dir(k) * kappa)]
        f = Frame(frame.s * r, point(ab_), frame.t, tilts, level=level, slot=frame.slot + k)
        place_huffman(node, f, H, kappa, level, out, c)
    if gap is not None:
        out["gaps_used"] += 1
        place_huffman(node, gap_frame(frame, H, level), H, kappa, level, out, gap)
    return out


class GapFrame(Frame):
    """The frame of a figure's opening: the point reflection of the unit at g, centred on the opening."""

    def map(self, P):
        Q = -self.s * (np.asarray(P) - CENTRE) + self.c + self.t * DIAG
        if self.tilts:
            ab_ = np.stack([(Q - CENTRE) @ RV, (Q - CENTRE) @ UPV], -1)
            dz = np.zeros(len(Q))
            for c, v in self.tilts:
                abc = np.array([(c - CENTRE) @ RV, (c - CENTRE) @ UPV])
                dz += (ab_ - abc) @ v
            Q = Q + dz[:, None] * DIAG
        return Q


def gap_frame(frame, H, level):
    f = GapFrame(frame.s * g_of(H), frame.c, frame.t, frame.tilts, level=level, slot=frame.slot + "G")
    f.M = -np.eye(3)
    return f


def leaf_prims(leaves, u, tone_by_level=False):
    return prims(leaves, u)


# ---- one eye: the whole nest drawn in towards it ---------------------------------------------------------

def drawn_in_prims(prm, eye_dist=8.0, g=1.0, beta=None, ref=CENTRE):
    """Every point moved along its line of sight onto the ray from one eye (figure_studies.drawn_in, for
    corner arrays): a point at drawing (a, b) and depth d goes to eye + (g (a R + b U) + f F) / (1 + beta d),
    F = -NH, so that from the eye it is the drawing exactly; beta = g / f keeps depth to first order.
    One projective map for every level at once: every level closes from the same eye."""
    f = eye_dist
    beta = g / f if beta is None else beta
    eye = ref + NH * f
    out = []
    for p in prm:
        q = p.P - ref
        a, b, d = q @ RV, q @ UPV, q @ NH
        P = eye + (g * (a[:, None] * RV + b[:, None] * UPV) + f * (-NH)) / (1 + beta * d)[:, None]
        out.append(U.Prim(P, p.tone, p.part, p.level))
    return out, eye


CLOSE = {"A": ((0, 0, 0), (1, 1, 1)), "B": ((-1, 1, -1), (0, 2, 0)), "C": ((0, 1, -1), (1, 2, 0))}


def closure_gaps(copies, project, size_of):
    """For each copy, the screen distance between each tribar's start and the end that closes on it, over the
    copy's screen size (its drawn cell edge). project: (N,3) -> (N,2) screen; size_of: copy -> screen length."""
    out = []
    for cp in copies:
        pts = []
        for k in "ABC":
            pts += list(CLOSE[k])
        P = cp.map(np.array(pts, float))
        S = project(P)
        gaps = [float(np.linalg.norm(S[2 * i] - S[2 * i + 1])) for i in range(3)]
        out.append((cp.level, max(gaps) / size_of(cp)))
    return out
