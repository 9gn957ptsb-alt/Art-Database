#!/usr/bin/env python3
"""The original drawing as exact polygons at any bar half-width H (wf1/vectorize/vector.json gives every vertex
as lattice expressions in H), rasterised at pixel centres through a fit, and compared with the original's classes.

Lattice coordinates of a point p: (z-y, x-z, y-x). In the drawing (CENTRE = (1/3, 1, -1/3)):
    b = ((z-y) + 4/3) / sqrt2,   a = ((y-x) - (x-z)) / sqrt6
Pixels through a fit (s, cx, cy, k):  px = cx + s a,  py = cy - s k b.
"""
import json
import math
import re

import numpy as np

S = "/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/"
V = json.load(open(S + "wf1/vectorize/vector.json"))
PHI = (1 + 5 ** 0.5) / 2
HG = 1 / (6 * PHI)
H9 = 1 / 9
FIT9 = (V["fit"]["s"], V["fit"]["cx"], V["fit"]["cy"], V["fit"]["k"])
TONE = {"grey": 0, "black": 1, "white": 2, "hole": -1}


def lin(expr):
    """'2+2H' -> (2, 2); '-1-4H' -> (-1, -4); '-2H' -> (0, -2); '0' -> (0, 0)."""
    e = expr.replace(" ", "")
    c0, cH = 0.0, 0.0
    for sign, num, h in re.findall(r"([+-]?)(\d*)(H?)", e):
        if not num and not h:
            continue
        v = float(num) if num else 1.0
        v = -v if sign == "-" else v
        if h:
            cH += v
        else:
            c0 += v
    return c0, cH


POLYS = []
for p in V["drawn"]:
    L = np.array([[lin(q["z-y"]), lin(q["x-z"]), lin(q["y-x"])] for q in p["lattice"]])  # (n, 3, 2)
    POLYS.append((TONE[p["tone_name"]], L))


def polygons(H):
    """The 13 drawn polygons at H, as (tone, (n, 2) array of drawing (a, b))."""
    out = []
    for tone, L in POLYS:
        c = L[..., 0] + H * L[..., 1]          # (n, 3): z-y, x-z, y-x
        b = (c[:, 0] + 4 / 3) / math.sqrt(2)
        a = (c[:, 2] - c[:, 1]) / math.sqrt(6)
        out.append((tone, np.stack([a, b], 1)))
    return out


def inside(poly, X, Y):
    """Even-odd point in polygon, vectorised over points X, Y."""
    n = len(poly)
    res = np.zeros(X.shape, bool)
    for i in range(n):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % n]
        cond = (y0 > Y) != (y1 > Y)
        with np.errstate(divide="ignore", invalid="ignore"):
            xc = x0 + (Y - y0) * (x1 - x0) / (y1 - y0)
        res ^= cond & (X < xc)
    return res


def raster(H, fit, shape=(630, 1200), step=1, polys=None):
    s, cx, cy, k = fit
    ys, xs = np.mgrid[0:shape[0]:step, 0:shape[1]:step].astype(float)
    a = (xs - cx) / s
    b = -(ys - cy) / (s * k)
    out = np.full(a.shape, -1, int)
    for tone, P in (polys or polygons(H)):
        if tone < 0:
            continue
        lo, hi = P.min(0), P.max(0)
        m = (a >= lo[0]) & (a <= hi[0]) & (b >= lo[1]) & (b <= hi[1])
        if not m.any():
            continue
        sel = inside(P, a[m], b[m])
        idx = np.nonzero(m)
        out[idx[0][sel], idx[1][sel]] = tone
    # the four holes are paper
    for tone, P in (polys or polygons(H)):
        if tone >= 0:
            continue
        lo, hi = P.min(0), P.max(0)
        m = (a >= lo[0]) & (a <= hi[0]) & (b >= lo[1]) & (b <= hi[1])
        if m.any():
            sel = inside(P, a[m], b[m])
            idx = np.nonzero(m)
            out[idx[0][sel], idx[1][sel]] = -1
    return out


def target(kind="holes"):
    if kind == "holes":
        return np.load(S + "wf3/colour-albers/cls_holes.npy")
    if kind == "clean":
        return np.load(S + "wf3/colour-albers/cls_clean.npy")
    return np.load(S + "unit/cls.npy")


def wrong(H, fit, T, step=1):
    R = raster(H, fit, T.shape, step)
    Ts = T[::step, ::step]
    valid = Ts != -2
    return int(((R != Ts) & valid).sum()) * step * step, int(((R >= 0) | (Ts >= 0)).sum()) * step * step


def refit(H, fit0, T, steps=(2.0, 1.0, 1.0, 0.004), rounds=24, step=2):
    p = list(fit0)
    e = wrong(H, p, T, step)[0]
    st = list(steps)
    for _ in range(rounds):
        improved = False
        for i in range(4):
            for sg in (-1, 1):
                q = list(p)
                q[i] += sg * st[i]
                eq = wrong(H, q, T, step)[0]
                if eq < e:
                    p, e, improved = q, eq, True
        if not improved:
            st = [x * 0.5 for x in st]
            if st[0] < 0.02:
                break
    return p, e


# ---- scoring as wf1/vectorize does: holes drawn as 2 (cls's label for enclosed paper), -2 ignored,
# ---- the percentage over cls's figure pixels (130462)
CLS = None


def raster_cls(H, fit, shape=(630, 1200), step=1):
    """The drawing with its four holes given cls's label 2."""
    s, cx, cy, k = fit
    ys, xs = np.mgrid[0:shape[0]:step, 0:shape[1]:step].astype(float)
    a = (xs - cx) / s
    b = -(ys - cy) / (s * k)
    out = np.full(a.shape, -1, int)
    for tone, P in polygons(H):
        lo, hi = P.min(0), P.max(0)
        m = (a >= lo[0]) & (a <= hi[0]) & (b >= lo[1]) & (b <= hi[1])
        if not m.any():
            continue
        sel = inside(P, a[m], b[m])
        idx = np.nonzero(m)
        out[idx[0][sel], idx[1][sel]] = 2 if tone < 0 else tone
    return out


def wrong_cls(H, fit, step=1):
    global CLS
    if CLS is None:
        CLS = target("cls")
    R = raster_cls(H, fit, CLS.shape, step)
    T = CLS[::step, ::step]
    return int(((R != T) & (T != -2)).sum()) * step * step


FIG_PX = 130462


def refit_cls(H, fit0, steps=(1.0, 0.5, 0.5, 0.002), step=1, min_step=0.01):
    p = list(fit0)
    e = wrong_cls(H, p, step)
    st = list(steps)
    while st[0] >= min_step:
        improved = False
        for i in range(4):
            for sg in (-1, 1):
                q = list(p)
                q[i] += sg * st[i]
                eq = wrong_cls(H, q, step)
                if eq < e:
                    p, e, improved = q, eq, True
        if not improved:
            st = [x * 0.5 for x in st]
    return p, e
