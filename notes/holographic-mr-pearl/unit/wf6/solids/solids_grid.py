#!/usr/bin/env python3
"""The CUBE, the PYRAMID and the SPHERE built of game blocks (each block the unit), at three Fibonacci levels, under
the block rule chosen in gameblock.py (closed+exit: the unit's bars opaque, the cube it approaches closing where
the ray leaves its block, coloured by unitBulk m(v)). Renders from the drawing's eye, and from a player's eyes
(1.7 m) 5 m and 30 m off the footprint; numbers: blocks, volume against the ideal solid, symmetric difference,
silhouette IoU against the ideal's (drawing's eye), see-through today vs closed."""
import sys, math, time
import numpy as np
sys.path.insert(0, '.')
from common import *

W, Hh, SS = 420, 315, 2


def cube(N):
    occ = np.ones((N, N, N), bool)
    return occ, ('box', np.zeros(3), np.full(3, float(N)))


def pyramid(h):
    b = 2 * h - 1
    occ = np.zeros((b, b, h), bool)
    for j in range(1, h + 1):                 # layer j from the top: side 2j-1 at height h-j
        z = h - j
        m = (b - (2 * j - 1)) // 2
        occ[m:m + 2 * j - 1, m:m + 2 * j - 1, z] = True
    return occ, ('pyramid', np.array([b / 2, b / 2, 0.0]), (2.0 * h, float(h)))   # ideal: base 2h, apex h


def sphere(R):
    n = 2 * R
    g = np.arange(n) + 0.5 - R
    X, Y, Z = np.meshgrid(g, g, g, indexing='ij')
    occ = X ** 2 + Y ** 2 + Z ** 2 <= R * R
    return occ, ('ball', np.array([R, R, R], float), float(R))


def inside_ideal(ideal, P):
    kind = ideal[0]
    if kind == 'box':
        return ((P >= ideal[1]) & (P <= ideal[2])).all(-1)
    if kind == 'pyramid':
        c, (base, hgt) = ideal[1], ideal[2]
        z = P[..., 2]
        half = base / 2 * (1 - z / hgt)
        return (z >= 0) & (z <= hgt) & (np.abs(P[..., 0] - c[0]) <= half) & (np.abs(P[..., 1] - c[1]) <= half)
    if kind == 'ball':
        return ((P - ideal[1]) ** 2).sum(-1) <= ideal[2] ** 2


def volume_numbers(occ, ideal, n=4):
    """Monte-Carlo-free: subsample each block n^3 and the ideal on the same points."""
    X, Y, Z = occ.shape
    g = [(np.arange(s * n) + 0.5) / n for s in (X, Y, Z)]
    P = np.stack(np.meshgrid(*g, indexing='ij'), -1)
    built = np.repeat(np.repeat(np.repeat(occ, n, 0), n, 1), n, 2)
    ide = inside_ideal(ideal, P)
    vb, vi = built.mean(), ide.mean()
    return dict(built_over_ideal=float(vb / vi), sym_diff_over_ideal=float((built ^ ide).mean() / vi),
                ideal_volume_m3=float(vi * X * Y * Z))


def ideal_silhouette(ideal, O, D):
    """Does the ray meet the ideal solid? (march: sampled along the ray within the grid box)"""
    ts = np.linspace(0, 1, 1)
    return None


def render(occ, mode, film, O, D, shape, ss, paper=False):
    res = walk_chunked(occ, O, D, film=film, film_colour='mean', K=4, stop_after=1)
    bgrgb = background(D, O=O) if not paper else np.tile(np.array([240.0, 236, 228]), (len(D), 1))
    vals = colour(res, mode, np.full(len(O), np.nan))
    cover = np.isfinite(vals)
    img = to_rgb(vals, bgrgb, shape, cover).astype(float)
    h, w = shape
    img = img.reshape(h // ss, ss, w // ss, ss, 3).mean((1, 3)).astype(np.uint8)
    entered = (res['steps'] > 0) & ((res['fb'] > 0) | (res['k'] == 1).any(1))
    return img, dict(see_through=float(((~cover) & entered).sum() / max(entered.sum(), 1)),
                     tests_mean=float(res['tests'][entered].mean()) if entered.any() else 0.0), cover, res


def ideal_hit(ideal, O, D, nstep=400, tmax=900):
    """Sample each ray at nstep points across the region near the solid (cheap and exact enough for IoU)."""
    lo = np.zeros(3) - 1; hi = np.array(IDEAL_BOX) + 1
    inv = 1 / np.where(D == 0, 1e-9, D)
    t0 = np.minimum((lo - O) * inv, (hi - O) * inv).max(1); t1 = np.maximum((lo - O) * inv, (hi - O) * inv).min(1)
    hit = np.zeros(len(O), bool)
    ok = t1 > t0
    for s in np.linspace(0, 1, nstep):
        t = t0 + (t1 - t0) * s
        P = O + D * t[:, None]
        hit |= ok & inside_ideal(ideal, P)
    return hit


if __name__ == '__main__':
    import json
    which = sys.argv[1:] or ['cube', 'pyramid', 'sphere']
    LEVELS = {'cube': [3, 8, 21], 'pyramid': [2, 5, 13], 'sphere': [3, 8, 21]}
    MAKE = {'cube': cube, 'pyramid': pyramid, 'sphere': sphere}
    allstats = {}
    for name in which:
        rows, labels = [], []
        for n in LEVELS[name]:
            occ, ideal = MAKE[name](n)
            IDEAL_BOX = occ.shape
            st = dict(level=n, blocks=int(occ.sum()), units=int(occ.sum()), bars=int(6 * occ.sum()),
                      shell_blocks=int((occ & ~np.pad(np.pad(occ, 1)[2:, 1:-1, 1:-1] & np.pad(occ, 1)[:-2, 1:-1, 1:-1]
                                        & np.pad(occ, 1)[1:-1, 2:, 1:-1] & np.pad(occ, 1)[1:-1, :-2, 1:-1]
                                        & np.pad(occ, 1)[1:-1, 1:-1, 2:] & np.pad(occ, 1)[1:-1, 1:-1, :-2], 0)).sum()))
            st.update(volume_numbers(occ, ideal))
            r, l = [], []
            lo, hi = np.zeros(3), np.array(occ.shape, float)
            c = (lo + hi) / 2
            span = 1.25 * np.linalg.norm(hi - lo) * 0.82
            # drawing's eye
            O, D, shape, px = drawing_view(c, span, W * SS, Hh * SS)
            t0 = time.time()
            img, s1, cover, res = render(occ, 'closed', 'exit', O, D, shape, SS, paper=True)
            idh = ideal_hit(ideal, O, D)
            built_sil = (res['steps'] > 0) & ((res['fb'] > 0) | (res['k'] == 1).any(1))
            st['drawing_silhouette_iou'] = float((idh & built_sil).sum() / (idh | built_sil).sum())
            img_t, s0, _, _ = render(occ, 'today', 'none', O, D, shape, SS, paper=True)
            st['drawing_see_through_today'] = s0['see_through']; st['drawing_see_through_closed'] = s1['see_through']
            r += [img_t, img]; l += ['%s %d drawing today' % (name, n), '%s %d drawing closed' % (name, n)]
            for dist in (5, 30):
                (O, D, shape), eye = player(None, lo, hi, dist, W * SS, Hh * SS, f=FOCAL * SS)
                img, s2, cover, res = render(occ, 'closed', 'exit', O, D, shape, SS)
                st['p%d_see_through_closed' % dist] = s2['see_through']; st['p%d_tests_closed' % dist] = s2['tests_mean']
                r.append(img); l.append('%s %d player %dm closed' % (name, n, dist))
            print(name, n, {k: (round(v, 4) if isinstance(v, float) else v) for k, v in st.items()}, '%.0fs' % (time.time() - t0), flush=True)
            for im, lab in zip(r, l):
                save(im, 'S_' + lab.replace(' ', '_') + '.png')
            rows.append(r); labels.append(l)
            allstats['%s %d' % (name, n)] = st
        sheet(rows, 'S_%s_sheet.png' % name, labels)
        prev = {}
        try:
            prev = json.load(open('solids_grid.json'))
        except Exception:
            pass
        prev.update(allstats)
        dump(prev, 'solids_grid.json')
