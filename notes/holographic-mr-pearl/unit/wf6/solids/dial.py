#!/usr/bin/env python3
"""CUBE (a): the thickness dial. The figure (fs.figure, the straight lattice model of the drawing) and the cube's
12-edge frame, drawn from the drawing's eye at bar half-width H, scored against the cube's hexagon of three rhombi
(the cube seen down its diagonal), convex corner and concave corner, scale fitted. Also the 3D volume of each."""
import sys, math, json, itertools
import numpy as np
sys.path.insert(0, '/home/user/site/scripts'); sys.path.insert(0, '.')
import figure_studies as fs
from common import *

R6, R2 = math.sqrt(6), math.sqrt(2)
PX = {0: np.array([-2 / R6, 0]), 1: np.array([1 / R6, -1 / R2]), 2: np.array([1 / R6, 1 / R2])}  # P(e_i) in (a, b)
W = 360
SPAN = 3.6     # drawing units across the image


def grid(c=(0, 0)):
    ys, xs = np.mgrid[0:W, 0:W]
    a = (xs + 0.5 - W / 2) * SPAN / W + c[0]
    b = -(ys + 0.5 - W / 2) * SPAN / W + c[1]
    return a, b


def render_boxes(boxes, c=(0, 0)):
    a, b = grid(c)
    O = fs.CENTRE + a[..., None] * fs.RV + b[..., None] * fs.UPV + fs.NH * 50
    D = np.broadcast_to(-fs.NH, O.shape)
    return fs.cast(boxes, O, D)


def hexagon(s, convex=True, c=(0, 0)):
    """Tone class image of a cube of edge s seen down its diagonal, centred at c: each rhombus spanned (from the
    centre) by -P(e_j), -P(e_k) (convex: the near corner at the centre) or +P(e_j), +P(e_k) (concave)."""
    a, b = grid(c)
    a = a - c[0]; b = b - c[1]
    out = np.full(a.shape, -1)
    sg = -1 if convex else 1
    for i in range(3):
        j, k = [q for q in range(3) if q != i]
        M = np.array([sg * PX[j], sg * PX[k]]).T * s
        Mi = np.linalg.inv(M)
        al = Mi[0, 0] * a + Mi[0, 1] * b
        be = Mi[1, 0] * a + Mi[1, 1] * b
        out[(al >= 0) & (al <= 1) & (be >= 0) & (be <= 1)] = i
    return out


def score(img, hexi):
    U = (img >= 0) | (hexi >= 0)
    same = (img == hexi) & (img >= 0)
    sil = ((img >= 0) & (hexi >= 0)).sum() / U.sum()
    return same.sum() / U.sum(), sil


def best_hex(img, c):
    best = None
    for convex in (True, False):
        for s in np.linspace(0.6, 4.0, 69):
            iou, sil = score(img, hexagon(s, convex, c))
            if best is None or iou > best[0]:
                best = (iou, sil, s, convex)
    # refine
    iou, sil, s0, convex = best
    for s in np.linspace(s0 - 0.05, s0 + 0.05, 21):
        i2, sl = score(img, hexagon(s, convex, c))
        if i2 > best[0]:
            best = (i2, sl, s, convex)
    return best


def centroid(img):
    a, b = grid()
    m = img >= 0
    return float(a[m].mean()), float(b[m].mean())


def cube_frame(H, side=1.0):
    """The 12 edges of the cube [0, side]^3 as square bars of half-width H."""
    out = []
    for ax in range(3):
        o = [q for q in range(3) if q != ax]
        for u in (0, side):
            for v in (0, side):
                lo = np.zeros(3); hi = np.zeros(3)
                lo[ax], hi[ax] = -H, side + H
                lo[o[0]], hi[o[0]] = u - H, u + H
                lo[o[1]], hi[o[1]] = v - H, v + H
                out.append(fs.Box.aabb(lo, hi))
    return out


def union_volume(boxes, n=96):
    lo = np.min([b.c - np.abs(b.E).sum(0) for b in boxes], 0)
    hi = np.max([b.c + np.abs(b.E).sum(0) for b in boxes], 0)
    g = [np.linspace(lo[i], hi[i], n) for i in range(3)]
    X, Y, Z = np.meshgrid(*g, indexing='ij')
    ins = np.zeros(X.shape, bool)
    for b in boxes:
        l = b.c - np.abs(b.E).sum(0); h = b.c + np.abs(b.E).sum(0)
        ins |= (X >= l[0]) & (X <= h[0]) & (Y >= l[1]) & (Y <= h[1]) & (Z >= l[2]) & (Z <= h[2])
    return ins.mean() * np.prod(hi - lo), np.prod(hi - lo)


if __name__ == '__main__':
    out = {'figure': [], 'frame': []}
    Hs = [1 / 9, 0.125, 0.14, 0.155, 1 / 6, 0.2, 0.25, 1 / 3, 0.5]
    imgs_fig, imgs_frame, imgs_hex = [], [], []
    col = {-1: (240, 236, 228), 0: (128, 128, 128), 1: (0, 0, 0), 2: (255, 255, 255)}

    def pic(t):
        a = np.zeros(t.shape + (3,), np.uint8)
        for k, cc in col.items():
            a[t == k] = cc
        return a
    for H in Hs:
        fs.H = H
        F = fs.figure()
        img = render_boxes(F)
        c = centroid(img)
        img = render_boxes(F, c)       # re-centred
        iou, sil, s, convex = best_hex(img, (0, 0))
        ink = (img >= 0).mean() * SPAN ** 2
        fr = [float(((img == t).sum()) / max((img >= 0).sum(), 1)) for t in range(3)]
        # the figure's 3D volume against its bounding box
        vol, bb = union_volume(F)
        out['figure'].append(dict(H=H, sixH=6 * H, tone_iou_vs_hexagon=iou, silhouette_iou=sil, hex_edge=s,
                                  convex=convex, drawn_area=ink, tone_fractions=fr, volume=vol, bbox_volume=bb,
                                  volume_fill_of_bbox=vol / bb))
        imgs_fig.append(pic(img))
        # the cube frame, side 1
        Fr = cube_frame(H)
        ci = fs.CENTRE * 0 + 0.5   # the cube's centre
        cc = ((np.array([0.5, 0.5, 0.5]) - fs.CENTRE) @ fs.RV, (np.array([0.5, 0.5, 0.5]) - fs.CENTRE) @ fs.UPV)
        im2 = render_boxes(Fr, cc)
        iou2, sil2, s2, cv2 = best_hex(im2, (0, 0))
        exact = score(im2, hexagon(1 + 2 * H, True))
        vol2, bb2 = union_volume(Fr)
        out['frame'].append(dict(H=H, bar_over_side=2 * H, tone_iou_vs_hexagon=iou2, silhouette_iou=sil2, hex_edge=s2,
                                 convex=cv2, tone_iou_vs_own_cube=exact[0], volume=vol2,
                                 cube_volume=(1 + 2 * H) ** 3, volume_fill=vol2 / (1 + 2 * H) ** 3))
        imgs_frame.append(pic(im2))
        imgs_hex.append(pic(hexagon(s, convex)))
        print('H %.4f fig iou %.3f sil %.3f s %.2f %s | frame iou %.3f sil %.3f vol %.3f' % (
            H, iou, sil, s, 'convex' if convex else 'concave', iou2, sil2, vol2 / (1 + 2 * H) ** 3))
    dump(out, 'dial.json')
    labels = [['fig H=%.3f' % H for H in Hs], ['best hexagon' for H in Hs], ['frame H=%.3f' % H for H in Hs]]
    small = lambda L: [im[::2, ::2] for im in L]
    sheet([small(imgs_fig), small(imgs_hex), small(imgs_frame)], 'C1_dial.png', labels)
