#!/usr/bin/env python3
"""The solid as the limit of the nesting, from the drawing's eye: the figure's four openings (three tribar holes,
the inverted gap) each filled by the figure itself, scaled so its outline is the opening (r = (1-6H)/(2+6H):
1/8 at the drawing's H = 1/9, phi^-4 at 6H = 1/phi), the inverted gap's copy point-reflected (a lattice map: tones
by axis kept); then theirs, depth after depth. Exact areas, gaps and copy counts, and renders (drawing2d polygons)."""
import sys, math
import numpy as np
sys.path.insert(0, '../levels'); sys.path.insert(0, '.')
import drawing2d as d2
from common import save, sheet, dump, PHI


def analytic(H, depths=6, L_m=0.5 * math.sqrt(2 / 3)):
    S, cut, h = 2 + 6 * H, 2 * H, 1 - 6 * H
    r = h / S
    c, q = 3 * cut ** 2 / S ** 2, 4 * h ** 2 / S ** 2
    out = []
    U = c + q
    for k in range(depths + 1):
        if k > 0:
            U = c + q * U
        widest_open = h * r ** k                    # an opening of the deepest copies, in L
        widest_cut = cut * r if k >= 1 else 0.0      # a copy's cut corner inside its parent's opening (never closes)
        out.append(dict(depth=k, copies=sum(4 ** j for j in range(1, k + 1)), unfilled_of_triangle=U,
                        filled_of_outline=(1 - U) / (1 - c), widest_opening_L=widest_open, widest_cut_L=widest_cut))
    lim = c / (1 - q)
    return dict(H=H, outline_S=S, cut=cut, hole=h, r=r, corner_fraction=c, hole_fraction=q, limit_unfilled=lim,
                limit_filled_of_outline=(1 - lim) / (1 - c), levels=out)


def px_needed(H, dist, upx=None, L_m=0.5 * math.sqrt(2 / 3), cutfill=False):
    """Depth at which the widest opening is under a pixel for the game's unit (1 block, cell 0.5 m) at dist m."""
    from common import UPX
    pix = UPX * dist
    S, cut, h = 2 + 6 * H, 2 * H, 1 - 6 * H
    r = h / S
    k = 0
    while h * r ** k * L_m > pix and k < 12:
        k += 1
    return dict(dist=dist, pixel_m=pix, depth=k, copies=sum(4 ** j for j in range(1, k + 1)),
                cut_gap_px=(cut * r * L_m / pix) if k >= 1 else None, opening0_px=h * L_m / pix)


def nested_polys(H, depth):
    base = d2.polygons(H)
    ink = [(t, p) for t, p in base if t >= 0]
    holes = [p for t, p in base if t < 0]
    S, h = 2 + 6 * H, 1 - 6 * H
    r = h / S
    out = list(ink)
    frames = [(np.eye(2), np.zeros(2))]           # (linear map, translation) of each copy at this depth
    for k in range(depth):
        new = []
        for M, t in frames:
            for hp in holes:
                c = hp.mean(0)
                inverted = hp[:, 1].max() - c[1] < c[1] - hp[:, 1].min()   # apex down
                R = -np.eye(2) if inverted else np.eye(2)
                M2 = M @ (R * r); t2 = M @ c + t
                new.append((M2, t2))
        for M, t in new:
            out += [(tn, (M @ p.T).T + t) for tn, p in ink]
        frames = new
    return out


def raster(polys, n=900, span=2.4):
    ys, xs = np.mgrid[0:n, 0:n].astype(float)
    a = (xs + 0.5 - n / 2) * span / n; b = -(ys + 0.5 - n / 2) * span / n + 0.05
    img = np.full(a.shape, -1)
    for tn, P in polys:
        lo, hi = P.min(0), P.max(0)
        m = (a >= lo[0]) & (a <= hi[0]) & (b >= lo[1]) & (b <= hi[1])
        if not m.any():
            continue
        ins = d2.inside(P, a[m], b[m])
        sub = img[m]; sub[ins] = tn; img[m] = sub
    return img


if __name__ == '__main__':
    res = {'thirds': analytic(1 / 9), 'golden': analytic(1 / (6 * PHI))}
    res['pixels'] = {'thirds': [px_needed(1 / 9, d) for d in (1, 5, 30)],
                     'golden': [px_needed(1 / (6 * PHI), d) for d in (1, 5, 30)]}
    col = {-1: (240, 236, 228), 0: (128, 128, 128), 1: (0, 0, 0), 2: (255, 255, 255)}
    imgs = []
    meas = []
    for name, H in (('thirds', 1 / 9), ('golden', 1 / (6 * PHI))):
        row = []
        for k in range(4):
            img = raster(nested_polys(H, k))
            a = np.zeros(img.shape + (3,), np.uint8)
            for t, cc in col.items():
                a[img == t] = cc
            row.append(a[::2, ::2])
            meas.append(dict(set=name, depth=k, ink_px=int((img >= 0).sum())))
        imgs.append(row)
    res['raster_ink_px'] = meas
    dump(res, 'nest2d.json')
    sheet(imgs, 'C2_nest2d.png', [['%s depth %d' % (n, k) for k in range(4)] for n in ('thirds H=1/9', 'golden 6H=1/phi')])
    for n in ('thirds', 'golden'):
        A = res[n]
        print(n, 'r %.4f limit filled of outline %.5f' % (A['r'], A['limit_filled_of_outline']),
              [(L['depth'], L['copies'], round(L['filled_of_outline'], 5)) for L in A['levels'][:4]])
        print('  pixels', res['pixels'][n])
    print(meas)
