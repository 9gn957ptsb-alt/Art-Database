#!/usr/bin/env python3
"""levels: the unit's modularity with itself across scales (wf6/levels).

Builds on wf1/design-nesting/unit.py (its Prim, cast, rays) and the vector study (wf1/vectorize).

Conventions (as figure_studies.py): cells of a cube lattice x, y, z (z up); the drawing looks along
d = -(1,1,1)/sqrt3, up u = (0,-1,1)/sqrt2, right r = (-2,1,1)/sqrt6; faces toned by the axis their normal is
along: x grey 0, y black 1, z white 2. CENTRE = (1/3, 1, -1/3). A move along (1,1,1) never changes the drawing.

THE UNIT (lattice beams, curved only where the drawing needs it):
  nine square beams of half-width H on the lattice (three tribars A, B, C); each tribar's last beam (Az, By,
  Cy, the one whose end closes on the tribar's start down the line of sight) is bent back along (1,1,1) over
  the stretch of it that borders the tribar's opening (axial s in [0.5 - (1-6H)/2, 0.5 + (1-6H)/2]: the hole's
  own side), by D steps of (1,1,1), so that its end lies behind the beam it closes on, as the original draws
  it. Outside that stretch every face is a lattice face; inside it the long faces are sheared along the line
  of sight only (their drawing is the lattice face's drawing).

PLACEMENTS that keep the one line of sight (so that every level closes from the same eye):
  p -> s M (p - CENTRE) + c + t (1,1,1),  s a power of phi, M in {I, the third turns C, C^2 about (1,1,1),
  and their point reflections -I, -C, -C^2}, c a point of the drawing, t a depth (free: it changes only
  what hides what).
"""
import math
import sys

import numpy as np

sys.path.insert(0, "/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf1/design-nesting")
sys.path.insert(0, "/home/user/site/scripts")
import unit as U  # noqa: E402

PHI = (1 + 5 ** 0.5) / 2
HG = 1 / (6 * PHI)
H9 = 1 / 9
NH = np.ones(3) / math.sqrt(3)
UPV = np.array([0, -1.0, 1]) / math.sqrt(2)
RV = np.cross(-NH, UPV)
CENTRE = np.array([1 / 3, 1, -1 / 3])
DIAG = np.ones(3)
C3 = np.array([[0, 0, 1], [1, 0, 0], [0, 1, 0]], float)   # x->y->z->x: a third turn about (1,1,1)
TURNS = [np.eye(3), C3, C3 @ C3]

BEAMS = U.BEAMS        # (name, tribar, start, axis, closes?)
CLOSERS = ("Az", "By", "Cy")


def smooth(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def beam_prims(start, axis, H, D=0.0, s0=None, s1=None, slices=8):
    """A beam [start - H, start + e + H] as hexahedra. With D, the part of it past axial s1 is moved back
    by D (1,1,1), the stretch [s0, s1] sheared smoothly between (cut in `slices` planar slices)."""
    start = np.asarray(start, float)
    e = np.zeros(3)
    e[axis] = 1
    lo, hi = start - H, start + e + H
    if not D:
        return [U.box_corners(lo, hi)]
    s0 = 0.5 - (1 - 6 * H) / 2 if s0 is None else s0
    s1 = 0.5 + (1 - 6 * H) / 2 if s1 is None else s1
    cuts = [-H, s0] + list(np.linspace(s0, s1, slices + 1)[1:]) + [1 + H]
    out = []
    for a, b in zip(cuts[:-1], cuts[1:]):
        if b - a < 1e-9:
            continue
        l2, h2 = lo.copy(), hi.copy()
        l2[axis], h2[axis] = start[axis] + a, start[axis] + b
        C = U.box_corners(l2, h2)
        s = C[:, axis] - start[axis]
        C = C - (D * smooth((s - s0) / (s1 - s0)))[:, None] * DIAG
        out.append(C)
    return out


def unit(H=HG, D=None, slices=8, closers=CLOSERS):
    """The unit in its own frame: [(beam name, tribar, [corner arrays])]. D: how far each closing beam's end
    is moved back, in steps of (1,1,1) (default 1 + 6H: one step, the one that closes the tribar, and the
    growth beyond it). D=0: the straight lattice figure."""
    D = (1 + 6 * H) if D is None else D
    out = []
    for nm, tb, st, ax, _ in BEAMS:
        out.append((nm, tb, beam_prims(st, ax, H, D if nm in closers else 0.0, slices=slices)))
    return out


def corners_of(u):
    return np.concatenate([C for _, _, cs in u for C in cs])


class Copy:
    """One placed copy of the unit: p -> s M (p - CENTRE) + c + t (1,1,1). `info` says what it stands for."""

    def __init__(self, s=1.0, M=np.eye(3), c=CENTRE, t=0.0, level=0, info=None, kind="up"):
        self.s, self.M, self.c, self.t = float(s), np.asarray(M, float), np.asarray(c, float), float(t)
        self.level, self.info, self.kind = level, info, kind

    def map(self, P):
        return self.s * (np.asarray(P) - CENTRE) @ self.M.T + self.c + self.t * DIAG

    def child(self, s, M, c_local, t_local=0.0, **kw):
        """A copy placed in this copy's frame (p -> s M (p - CENTRE) + c_local + t_local (1,1,1) there),
        composed with this one. M of this copy takes (1,1,1) to sigma (1,1,1), sigma = +-1."""
        sigma = float((self.M @ DIAG)[0])
        c = self.s * self.M @ (np.asarray(c_local, float) - CENTRE) + self.c
        return Copy(self.s * s, self.M @ np.asarray(M, float), c, self.t + self.s * sigma * t_local, **kw)


def prims_of(copies, u):
    """Ray-cast pieces for every copy. The tone of each face pair stays with the axis it was along: a third
    turn cycles the axes (x->y->z), so a face keeps the tone of the axis it now faces; a point reflection
    keeps the axes, so tones stay. (M is a signed permutation, so each face pair still faces one axis.)"""
    prims = []
    for cp in copies:
        perm = np.abs(cp.M).argmax(0)          # column j (model axis j) goes to world axis perm[j]
        for nm, tb, cs in u:
            for C in cs:
                P = cp.map(C)
                # pair k of the Hex is the face pair across model axis k -> world axis perm[k]
                tone = tuple(int(perm[k]) for k in range(3))
                prims.append(U.Prim(P, tone, nm, cp.level))
    return prims


# ---- the drawing frame --------------------------------------------------------------------------------

def ab(p):
    q = np.asarray(p, float) - CENTRE
    return np.stack([q @ RV, q @ UPV], -1)


def depth(p):
    return (np.asarray(p, float) - CENTRE) @ NH


def drawing_rays(a0, a1, b0, b1, w, h=None):
    h = h or int(round(w * (b1 - b0) / (a1 - a0)))
    ys, xs = np.mgrid[0:h, 0:w]
    a = a0 + (xs + 0.5) / w * (a1 - a0)
    b = b1 - (ys + 0.5) / h * (b1 - b0)
    O = CENTRE + a[..., None] * RV + b[..., None] * UPV + NH * 80
    return O, np.broadcast_to(-NH, O.shape).copy()


def ortho_rays(dirv, upv, centre, span, w, h=None):
    return U.ortho_rays(dirv, upv, centre, span, w, h)


def persp_rays(eye, target, up, fov, w, h):
    return U.persp_rays(eye, target, up, fov, w, h)


cast = U.cast
